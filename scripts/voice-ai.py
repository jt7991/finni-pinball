"""Local-only ElevenLabs recording-enhancement bridge. Credentials stay in memory."""
import io
import json
import os
import secrets
import subprocess
import threading
import urllib.error
import urllib.request
import wave

MIN_ISOLATION_SECONDS = 6
MAX_AUDIO = 4_000_000
ENHANCEMENT_LOCK = threading.Lock()


class VoiceAIError(Exception):
    def __init__(self, message, status=503):
        super().__init__(message)
        self.status = status


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def retrieve_key():
    secret_id = os.environ.get('ELEVENLABS_BWS_SECRET_ID')
    command = ['bws', 'secret', 'get', secret_id] if secret_id else ['bws', 'secret', 'list']
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise VoiceAIError('Secrets Manager lookup failed. Start the local server from a shell with bws authenticated.')
        payload = json.loads(result.stdout)
        matches = [payload] if secret_id else [entry for entry in payload if entry.get('key') == os.environ.get('ELEVENLABS_BWS_SECRET_NAME', 'Elevenlabs')]
        if len(matches) != 1 or not isinstance(matches[0].get('value'), str) or not matches[0]['value'].strip():
            raise VoiceAIError('Expected one Elevenlabs secret. Configure ELEVENLABS_BWS_SECRET_ID or ELEVENLABS_BWS_SECRET_NAME on the local server.')
        return matches[0]['value'].strip()
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError, AttributeError):
        raise VoiceAIError('Secrets Manager is unavailable or unauthenticated. Check the local bws setup; raw output is withheld.') from None


def api_request(path, key, body=None, content_type=None):
    headers = {'xi-api-key': key}
    if content_type:
        headers['Content-Type'] = content_type
    request = urllib.request.Request('https://api.elevenlabs.io' + path, data=body, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=180 if body is not None else 30) as response:
            data = response.read(8_000_001)
            if len(data) > 8_000_000:
                raise VoiceAIError('ElevenLabs returned an oversized result. Check usage before trying again.', 502)
            return data, response.headers
    except urllib.error.HTTPError as error:
        # Surface only the structured provider error, with credentials redacted.
        reason = ''
        try:
            payload = json.loads(error.read(16_000))
            detail = payload.get('detail', {}) if isinstance(payload, dict) else {}
            if isinstance(detail, dict):
                message = detail.get('message')
                if isinstance(message, str):
                    reason = ' '.join(message.replace(key, '[redacted]').split())[:500]
        except (OSError, ValueError, TypeError):
            pass
        if not reason:
            reason = {
                400: 'The recording or request was rejected.',
                401: 'Check the ElevenLabs API key.',
                403: 'Check the key’s Voice Isolation permission and account access.',
                429: 'The account is rate limited or has insufficient quota.',
            }.get(error.code, 'The provider could not complete cleanup.')
        raise VoiceAIError(f'ElevenLabs returned HTTP {error.code}. {reason} No retry was made.', 502) from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        message = 'ElevenLabs could not be reached.'
        if body is not None:
            message += ' The enhancement may have been billed. Check ElevenLabs history before retrying.'
        raise VoiceAIError(message, 502) from None


def options():
    # Check local credentials only; this never sends audio or starts paid work.
    retrieve_key()
    return {'enabled': True, 'provider': 'elevenlabs', 'tool': 'audio_isolation', 'price_per_minute': .12, 'minimum_seconds': MIN_ISOLATION_SECONDS}


def enhance(audio):
    if len(audio) > MAX_AUDIO:
        raise VoiceAIError('Use a recording under 30 seconds and 4 MB.', 413)
    try:
        with wave.open(io.BytesIO(audio), 'rb') as wav:
            if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getcomptype()) != (32000, 2, 2, 'NONE'):
                raise ValueError()
            frames = wav.getnframes()
            samples = wav.readframes(frames)
            if not 0 < frames <= 32000 * 30.1 or len(samples) != frames * 4:
                raise ValueError()
    except (wave.Error, EOFError, ValueError):
        raise VoiceAIError('Use a complete 32 kHz stereo 16-bit WAV of 30 seconds or less. Record or upload a new take in the studio.', 400) from None
    # Give short takes headroom over the five-second cutoff. Trailing silence
    # keeps the speech aligned so the browser can crop back to the take length.
    padding_frames = max(0, 32000 * MIN_ISOLATION_SECONDS - frames)
    if padding_frames:
        padded = io.BytesIO()
        with wave.open(padded, 'wb') as wav:
            wav.setparams((2, 2, 32000, 0, 'NONE', 'not compressed'))
            wav.writeframes(samples + bytes(padding_frames * 4))
        audio = padded.getvalue()
    if not ENHANCEMENT_LOCK.acquire(blocking=False):
        raise VoiceAIError('An enhancement is already running. Wait for it to finish; no additional request was sent.', 409)
    try:
        key = retrieve_key()
        boundary = 'finni-' + secrets.token_hex(16)
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="file_format"\r\n\r\nother\r\n'.encode()]
        parts.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="audio"; filename="take.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode(), audio, f'\r\n--{boundary}--\r\n'.encode()])
        data, headers = api_request('/v1/audio-isolation', key, b''.join(parts), f'multipart/form-data; boundary={boundary}')
        if not data or not headers.get('Content-Type', '').lower().startswith('audio/'):
            raise VoiceAIError('ElevenLabs returned no usable audio. Check usage before trying again.', 502)
        return data, headers.get('Content-Type').split(';')[0]
    finally:
        ENHANCEMENT_LOCK.release()
