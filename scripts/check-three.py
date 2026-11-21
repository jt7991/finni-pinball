"""Run real Three.js/WebGL and multi-touch checks in headless Edge.

Start npm run dev first. This checks desktop Chromium, not physical phone FPS.
"""
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.work/three-review'
OUT.mkdir(parents=True,exist_ok=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    port=sock.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='three-check-',dir=ROOT/'.work',ignore_cleanup_errors=True) as profile:
    process=subprocess.Popen([
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        '--headless=new','--enable-unsafe-swiftshader','--no-first-run',
        f'--user-data-dir={profile}',f'--remote-debugging-port={port}','about:blank',
    ],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list');break
            except OSError:time.sleep(.1)
        runner='test-bulb-render-browser.mjs' if '--lamp-render' in sys.argv else 'probe-vpx-script-random.mjs' if '--native-random' in sys.argv else 'probe-vpx-contact.mjs' if '--native-contact' in sys.argv else 'probe-vpx-physics.mjs' if '--native-reference' in sys.argv else 'benchmark-worker-browser.mjs' if '--worker-performance' in sys.argv else 'benchmark-three-browser.mjs' if '--performance' in sys.argv else 'test-three-ui.mjs'
        subprocess.run(['node',str(ROOT/'scripts'/runner),f'http://127.0.0.1:{port}',
                        sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5173/three/',str(OUT),*sys.argv[2:]],check=True,timeout=150)
    finally:
        process.terminate()
        try:process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill();process.wait(timeout=10)
