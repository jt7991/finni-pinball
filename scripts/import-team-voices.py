"""Download approved studio WAVs, expand recording aliases, and optionally install.

Set VOICE_TEAM_TOKEN to a signed-in PocketBase team member's token. This script
never generates audio. Without --install it only prepares files and a report.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import shutil
import tempfile
import wave
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MAX_WAV = 4_000_000


def import_voices(url, token, output, install=None, require_complete=False):
    base = url.rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1')):
        raise ValueError('Use an HTTPS studio URL or HTTP localhost.')
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('Use the studio origin URL, without a path or credentials.')
    if not token:
        raise ValueError('Set VOICE_TEAM_TOKEN to a signed-in team member token.')

    def request(path, method='GET', audio=False):
        req = Request(f'{base}/api/{path}', headers={'Authorization': token}, method=method)
        try:
            with urlopen(req, timeout=60) as response:
                data = response.read(MAX_WAV + 1 if audio else 8_000_000)
        except HTTPError as error:
            raise ValueError(f'Voice API request failed (HTTP {error.code}). Check membership and token expiry.') from None
        except URLError:
            raise ValueError('Could not connect to the voice studio.') from None
        if audio:
            if len(data) > MAX_WAV:
                raise ValueError('An approved WAV exceeds the studio file limit.')
            return data
        return json.loads(data)

    builder = runpy.run_path(str(ROOT / 'scripts/build-finni-callouts.py'))
    config, mapping = builder['lines'](validate_source=False)
    aliases = config['recording_aliases']
    canonical = builder['recording_lines'](config, mapping)
    chatter = {f'quote{n}' for n in config['random_quotes']}
    chosen = {}
    page = 1
    while True:
        query = urlencode({'filter': 'status = "approved"', 'perPage': 100, 'page': page})
        batch = request(f'collections/voice_takes/records?{query}')
        for take in batch['items']:
            id = take['line_id']
            if id == 'custom' or id in chatter or id in aliases:
                continue
            if id not in canonical or take['line_text'].strip() != canonical[id]:
                raise ValueError(f'Approved take {take["id"]} does not match the current script for {id}. Review it before importing.')
            if id in chosen:
                raise ValueError(f'Multiple approved takes for {id}. Leave exactly one approved take per line.')
            chosen[id] = take
        if page >= batch['totalPages']:
            break
        page += 1
    if not chosen:
        raise ValueError('No approved game takes found. Approve takes in PocketBase first.')
    missing = sorted(canonical.keys() - chosen.keys())
    if require_complete and missing:
        raise ValueError(f'{len(missing)} recording tasks still need an approved take. No files were installed.')
    file_token = request('files/token', method='POST')['token']
    report = {'source': base, 'callouts': {}, 'missing_recordings': missing}
    # Stage and validate all audio before changing the destination or table.
    with tempfile.TemporaryDirectory(prefix='finni-team-voices-') as temporary:
        staged = Path(temporary)
        for id, take in chosen.items():
            file_path = '/'.join(quote(str(take[key]), safe='') for key in ('collectionId', 'id', 'processed'))
            path = staged / f'{id}.wav'
            path.write_bytes(request(f'files/{file_path}?{urlencode({"token": file_token})}', audio=True))
            frames = builder['pcm'](path)
            if not frames:
                raise ValueError(f'Approved take for {id} contains no audio frames.')
            report['callouts'][id] = {
                'text': canonical[id], 'silent': False, 'seconds': len(frames) / (32000 * 4),
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'take_id': take['id'], 'speaker': take['speaker'],
            }
        for slot, target in aliases.items():
            if target in chosen:
                shutil.copyfile(staged / f'{target}.wav', staged / f'{slot}.wav')
                report['callouts'][slot] = {**report['callouts'][target], 'reused_from': target}
        output.mkdir(parents=True, exist_ok=True)
        for id in report['callouts']:
            shutil.copyfile(staged / f'{id}.wav', output / f'{id}.wav')
        (output / 'voice-report.json').write_text(json.dumps(report, indent=2) + '\n')
    if install:
        builder['install'](install, output)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True, help='Studio origin, e.g. https://pinball.example.com')
    parser.add_argument('--output', type=Path, default=ROOT / '.work/team-voices')
    parser.add_argument('--install', type=Path, help='Extracted VPX table directory; never a .vpx file')
    parser.add_argument('--require-complete', action='store_true', help='Require all recording tasks before writing files')
    args = parser.parse_args()
    try:
        report = import_voices(args.url, os.environ.get('VOICE_TEAM_TOKEN', ''), args.output, args.install, args.require_complete)
    except (ValueError, AssertionError, OSError, EOFError, wave.Error) as error:
        parser.exit(1, f'Import stopped: {error or "Invalid WAV: expected 32 kHz stereo 16-bit PCM."}\n')
    print(f'Prepared {len(report["callouts"])} game slots; {len(report["missing_recordings"])} recording tasks still pending.')
    print(f'Report: {args.output / "voice-report.json"}')
    if args.install:
        print('Installed in the extracted table. Repack the VPX table to use these takes in play.')
