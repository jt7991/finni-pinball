"""Check the real player UI in headless Chromium with an isolated engine fixture.

Exercises browser multi-touch and fullscreen, not VPX physics or device GPU speed.
"""
import argparse
import importlib.util
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('server', ROOT/'scripts/serve-browser.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Handler(module.Handler):
    def do_GET(self):
        if self.path == '/app.js':
            source = (ROOT/'browser/app.js').read_text(encoding='utf-8')
            source = source.replace('placeFlippers();boot();', 'placeFlippers();')
            source += """
window.playerTest={scripts:[]};
engine={ccall:(name,type,args,[script])=>{playerTest.scripts.push(script);return 1;}};
connected=true;paint();views.apply();
document.body.classList.add('playing','game-in-play');
document.getElementById('waiting').hidden=true;
const preview=new Image();preview.src='/test-playfield.png';
preview.onload=()=>{
  const c=document.getElementById('canvas'),ctx=c.getContext('2d');
  ctx.fillStyle='#090f0d';ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(preview,(c.width-c.height*.7)/2,0,c.height*.7,c.height);
};
"""
            data = source.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()

    def translate_path(self, path):
        if path == '/test-playfield.png':
            return str(ROOT/'output/playfield-party-v13/finni-playfield-base.png')
        return super().translate_path(path)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--renderer', action='store_true', help='Test the real VPX engine and shader programs instead of the UI fixture.')
parser.add_argument('--profile', action='store_true', help='Compare real engine graphics profiles in desktop Chromium with a phone viewport.')
args = parser.parse_args()
real_engine = args.renderer or args.profile
output = ROOT/('.work/render-profiles' if args.profile else '.work/renderer-review' if args.renderer else '.work/mobile-review')
output.mkdir(exist_ok=True)
edge = Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
with ThreadingHTTPServer(('127.0.0.1', 0), module.Handler if real_engine else Handler) as server:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            debug_port = sock.getsockname()[1]
        with tempfile.TemporaryDirectory(prefix='mobile-player-', dir=ROOT/'.work') as profile:
            process = subprocess.Popen([
                str(edge), '--headless=new', '--enable-unsafe-swiftshader' if real_engine else '--disable-gpu', '--no-first-run',
                f'--user-data-dir={profile}', f'--remote-debugging-port={debug_port}', 'about:blank',
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(100):
                    try:
                        urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json/list')
                        break
                    except OSError:
                        time.sleep(.1)
                subprocess.run([
                    str(ROOT/'.tools/node-v22.16.0-win-x64/node.exe'),
                    str(ROOT/'scripts'/('profile-renderer-browser.mjs' if args.profile else 'test-renderer-browser.mjs' if args.renderer else 'test-mobile-player.mjs')),
                    f'http://127.0.0.1:{debug_port}', f'http://127.0.0.1:{server.server_port}', str(output),
                ], check=True, timeout=240 if args.profile else 120 if real_engine else 90)
            finally:
                process.terminate()
                process.wait(timeout=10)
    finally:
        server.shutdown()
