"""Serve the real VPX WebAssembly player locally; no native VPX process required."""
import argparse
import base64
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import ipaddress
import json
import runpy
from urllib.parse import urlsplit
import os
import re
import urllib.error
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / '.work/browser-engine/package/dist'
VERSION = '0.3.4'
URL = 'https://dev.pivoine.art/api/packages/valknar/npm/%40valknar%2Fvpinball-wasm/-/0.3.4/vpinball-wasm-0.3.4.tgz'
INTEGRITY = 'ULJ8jF3Q8sxmkkSdC70SSKzkvaNHORPZEFuJzQbmfH9aeqh4kYmqj59KX7bNywmAxLz4yLtr8r4i/oWEo8bbSw=='


def prepare():
    required = ('vpinball.js', 'vpinball.wasm', 'vpinball.data')
    if all((ENGINE / name).is_file() for name in required):
        return
    print(f'Downloading VPX WebAssembly {VERSION} (first run only)…', flush=True)
    with urllib.request.urlopen(URL, timeout=120) as response:
        archive = response.read()
    if base64.b64encode(hashlib.sha512(archive).digest()).decode() != INTEGRITY:
        raise SystemExit('Engine archive checksum mismatch')
    ENGINE.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as package:
        for name in required:
            with package.extractfile(f'package/dist/{name}') as source:
                (ENGINE / name).write_bytes(source.read())


class Handler(SimpleHTTPRequestHandler):
    voice_origin = os.environ.get('VOICE_STUDIO_ORIGIN', '').rstrip('/')
    voice_ai_enabled = False
    voice_ai = None
    table_path = ROOT / 'output/live-vpx/Finni-Big-Day.vpx'
    def voice_ai_api(self):
        def send_json(status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        if not self.voice_ai_enabled:
            send_json(503, {'message': 'ElevenLabs is available locally when the server is started with --voice-ai.'})
            return
        # AI requests must arrive locally, directly or through the configured HTTPS proxy.
        host = urlsplit('http://' + self.headers.get('Host', '')).hostname
        local_host = host in ('localhost', '127.0.0.1', '::1')
        proxy_host = bool(self.voice_origin and host == urlsplit(self.voice_origin).hostname)
        if not ipaddress.ip_address(self.client_address[0]).is_loopback or not (local_host or proxy_host):
            send_json(403, {'message': 'Open the studio on localhost or its configured Tailscale HTTPS address.'})
            return
        route = urlsplit(self.path)
        try:
            if self.command == 'GET' and route.path == '/api/voice-ai/options':
                send_json(200, self.voice_ai['options']())
            elif self.command == 'POST' and route.path == '/api/voice-ai/enhance':
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= self.voice_ai['MAX_AUDIO']:
                    send_json(413, {'message': 'Use a recording of 30 seconds or less and under 4 MB.'})
                    return
                if self.headers.get('Content-Type', '').split(';')[0] != 'audio/wav':
                    send_json(415, {'message': 'Enhancement requires a game-format WAV.'})
                    return
                payload, content_type = self.voice_ai['enhance'](self.rfile.read(size))
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            else:
                send_json(404, {'message': 'Unknown voice processing route.'})
        except self.voice_ai['VoiceAIError'] as error:
            send_json(error.status, {'message': str(error)})
        except (OSError, ValueError):
            send_json(503, {'message': 'Local voice processing failed. Check ElevenLabs history before retrying an enhancement.'})

    def proxy_api(self):
        if self.path.startswith('/api/voice-ai/'):
            self.voice_ai_api()
            return
        routes = {'/api/leaderboard': '/api/finni/leaderboard', '/api/runs': '/api/finni/runs', '/api/scores': '/api/finni/scores'}
        voice_api = re.fullmatch(r'/api/(?:collections/(?:voice_team/auth-with-password|voice_takes/records)|files/token|files/[a-zA-Z0-9_]+/[a-zA-Z0-9_]+/[a-zA-Z0-9_.-]+)(?:\?[^\r\n]*)?', self.path)
        if self.path not in routes and not voice_api:
            self.send_error(404)
            return
        try:
            size = int(self.headers.get('Content-Length', 0))
            if size < 0 or size > (8500000 if voice_api else 4096):
                self.send_error(413)
                return
            body = self.rfile.read(size) if self.command == 'POST' else None
            headers = {'Content-Type': self.headers.get('Content-Type', 'application/json'), 'X-Real-IP': self.client_address[0]}
            if self.headers.get('Authorization'):
                headers['Authorization'] = self.headers['Authorization']
            request = urllib.request.Request(os.environ.get('POCKETBASE_URL', 'http://127.0.0.1:8090').rstrip('/') + routes.get(self.path, self.path), data=body, method=self.command, headers=headers)
            try:
                response = urllib.request.urlopen(request, timeout=10)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                payload = response.read()
                self.send_response(response.code)
                self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
                if response.headers.get('Content-Disposition'):
                    self.send_header('Content-Disposition', response.headers['Content-Disposition'])
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except (OSError, ValueError):
            self.send_error(503, 'Leaderboard unavailable. Start PocketBase and retry.')

    def do_GET(self):
        if self.path.startswith('/api/'):
            self.proxy_api()
        else:
            super().do_GET()

    def do_POST(self):
        allowed_origins = (None, 'http://' + self.headers.get('Host', ''))
        if self.voice_origin:
            allowed_origins += (self.voice_origin,)
        if self.headers.get('Origin') not in allowed_origins:
            self.send_error(403)
            return
        self.proxy_api()

    def translate_path(self, path):
        path = path.split('?', 1)[0]
        routes = {'/': ROOT / 'browser/index.html',
                  '/app.js': ROOT / 'browser/app.js', '/leaderboard.js': ROOT / 'browser/leaderboard.js', '/views.js': ROOT / 'browser/views.js', '/style.css': ROOT / 'browser/style.css',
                  '/renderer.js': ROOT / 'browser/renderer.js',
                  '/framebuffer-copy.js': ROOT / 'browser/framebuffer-copy.js',
                  '/arcade.css': ROOT / 'browser/arcade.css',
                  '/arcade-background.svg': ROOT / 'browser/arcade-background.svg',
                  '/start-dmd.png': ROOT / 'browser/start-dmd.png',
                  '/player-preview.png': ROOT / 'browser/player-preview.png',
                  '/dmd-atlas.png': ROOT / '.work/browser-assets/dmd-atlas.png',
                  '/dmd-atlas.json': ROOT / '.work/browser-assets/dmd-atlas.json',
                  '/dmd-animations.json': ROOT / '.work/browser-assets/dmd-animations.json',
                  '/table.vpx': self.table_path,
                  '/chewy.ttf': ROOT / 'assets/fonts/chewy/Chewy-Regular.ttf'}
        for name in ('voice.html', 'voice.css', 'voice.js', 'voice-audio.js', 'voice-pitch-worker.js', 'vendor/voice-pitch.js', 'vendor/voice-pitch-LICENSES.txt', 'voice-lines.json', 'voice-cast.json'):
            routes['/' + name] = ROOT / 'browser' / name
        for name in ('PressStart2P-Regular.ttf', 'DMSans.ttf'):
            routes['/fonts/' + name] = ROOT / 'browser/fonts' / name
        routes['/voice'] = ROOT / 'browser/voice.html'
        for name in ('manifest.json', 'favicon.png', 'favicon.ico',
                     'icons/icon-192.png', 'icons/icon-512.png',
                     'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'):
            routes['/' + name] = ROOT / 'browser' / name
        for name in ('vpinball.js', 'vpinball.wasm', 'vpinball.data'):
            routes['/engine/' + name] = ENGINE / name
        return str(routes.get(path, ROOT / '.work/nonexistent-browser-route'))

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *_):
        pass

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.wasm': 'application/wasm'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--host', default='127.0.0.1', help='Address to bind; use this PC\'s Tailscale IP for tailnet testing.')
    parser.add_argument('--table', type=Path, default=Handler.table_path, help='Optional separate table build for concept testing.')
    parser.add_argument('--voice-only', action='store_true', help='Serve the studio without preparing the game engine or table.')
    parser.add_argument('--voice-ai', action='store_true', help='Enable localhost-only ElevenLabs processing using Bitwarden Secrets Manager.')
    args = parser.parse_args()
    if args.voice_ai and args.host not in ('localhost', '127.0.0.1'):
        parser.error('--voice-ai requires a loopback --host (localhost or 127.0.0.1).')
    Handler.voice_ai_enabled = args.voice_ai
    if args.voice_ai:
        Handler.voice_ai = runpy.run_path(str(ROOT / "scripts/voice-ai.py"))
    Handler.table_path = args.table.resolve()
    if not args.voice_only:
        if not Handler.table_path.is_file():
            raise SystemExit(f'Table not found: {Handler.table_path}')
        prepare()
        runpy.run_path(str(ROOT/'scripts/package-browser-assets.py'))['package'](ROOT/'.work/browser-assets', copy_table=False)
    with ThreadingHTTPServer((args.host, args.port), Handler) as server:
        print(f'Finni browser player: http://{args.host}:{args.port}', flush=True)
        print(f'Voice studio: http://{args.host}:{args.port}/voice', flush=True)
        if args.voice_ai:
            print('ElevenLabs enabled for localhost only; keys are retrieved from Secrets Manager.', flush=True)
        print('Voice studio only. Ctrl+C stops the server.' if args.voice_only else 'The actual VPX engine runs in your browser. Ctrl+C stops the file server.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
