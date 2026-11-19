"""Serve the real VPX WebAssembly player locally; no native VPX process required."""
import argparse
import base64
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
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
    def proxy_api(self):
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
        if self.headers.get('Origin') not in (None, 'http://' + self.headers.get('Host', '')):
            self.send_error(403)
            return
        self.proxy_api()

    def translate_path(self, path):
        path = path.split('?', 1)[0]
        routes = {'/': ROOT / 'browser/index.html',
                  '/app.js': ROOT / 'browser/app.js', '/leaderboard.js': ROOT / 'browser/leaderboard.js', '/views.js': ROOT / 'browser/views.js', '/style.css': ROOT / 'browser/style.css',
                  '/dmd-atlas.png': ROOT / '.work/browser-assets/dmd-atlas.png',
                  '/dmd-atlas.json': ROOT / '.work/browser-assets/dmd-atlas.json',
                  '/table.vpx': ROOT / 'output/live-vpx/Finni-Big-Day.vpx',
                  '/chewy.ttf': ROOT / 'assets/fonts/chewy/Chewy-Regular.ttf'}
        for name in ('voice.html', 'voice.css', 'voice.js', 'voice-audio.js', 'voice-lines.json'):
            routes['/' + name] = ROOT / 'browser' / name
        routes['/voice'] = ROOT / 'browser/voice.html'
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
    args = parser.parse_args()
    if not (ROOT / 'output/live-vpx/Finni-Big-Day.vpx').is_file():
        raise SystemExit('Build output/live-vpx/Finni-Big-Day.vpx first. See README.md.')
    prepare()
    import runpy
    runpy.run_path(str(ROOT/'scripts/package-browser-assets.py'))['package'](ROOT/'.work/browser-assets', copy_table=False)
    with ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
        print(f'Finni browser player: http://127.0.0.1:{args.port}', flush=True)
        print('The actual VPX engine runs in your browser. Ctrl+C stops the file server.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
