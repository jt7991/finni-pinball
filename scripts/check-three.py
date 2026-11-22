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
        runner='probe-native-camera-browser.mjs' if '--native-camera' in sys.argv else 'test-flipper-render-browser.mjs' if '--flipper-render' in sys.argv else 'probe-native-flipper-render-browser.mjs' if '--native-flipper-render' in sys.argv else 'test-classic-render-browser.mjs' if '--classic-render' in sys.argv else 'probe-native-lighting-browser.mjs' if '--native-lighting' in sys.argv else 'test-bulb-render-browser.mjs' if '--lamp-render' in sys.argv else 'probe-vpx-script-random.mjs' if '--native-random' in sys.argv else 'probe-vpx-contact.mjs' if '--native-contact' in sys.argv else 'probe-vpx-physics.mjs' if '--native-reference' in sys.argv else 'benchmark-worker-browser.mjs' if '--worker-performance' in sys.argv else 'benchmark-three-browser.mjs' if '--performance' in sys.argv else 'test-three-ui.mjs'
        if '--camera-render' in sys.argv:runner='test-camera-render-browser.mjs'
        if '--native-materials' in sys.argv:runner='probe-native-materials-browser.mjs'
        if '--flipper-projection' in sys.argv:runner='test-flipper-projection-browser.mjs'
        if '--native-primitives' in sys.argv:runner='test-native-primitives-browser.mjs'
        if '--transmission-render' in sys.argv:runner='test-transmission-render-browser.mjs'
        if '--native-textures' in sys.argv:runner='test-native-textures-browser.mjs'
        if '--native-actors' in sys.argv:runner='test-native-actors-browser.mjs'
        if '--reflection-render' in sys.argv:runner='test-native-reflection-browser.mjs'
        if '--playfield-render' in sys.argv:runner='test-native-playfield-browser.mjs'
        if '--native-cache' in sys.argv:runner='test-native-cache-browser.mjs'
        if '--ball-render' in sys.argv:runner='test-native-ball-render-browser.mjs'
        if '--ball-live' in sys.argv:runner='test-native-ball-live-browser.mjs'
        if '--flasher-render' in sys.argv:runner='test-native-flasher-render-browser.mjs'
        if '--native-flasher-properties' in sys.argv:runner='probe-native-flasher-properties.mjs'
        if '--bulb-emission' in sys.argv:runner='test-native-bulb-emission-browser.mjs'
        if '--alpha-order' in sys.argv:runner='test-native-alpha-order-browser.mjs'
        if '--halo-render' in sys.argv:runner='test-native-halo-render-browser.mjs'
        if '--native-classic' in sys.argv:runner='test-native-classic-render-browser.mjs'
        if '--native-timer' in sys.argv:runner='probe-native-timer-browser.mjs'
        subprocess.run(['node',str(ROOT/'scripts'/runner),f'http://127.0.0.1:{port}',
                        sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5173/three/',str(OUT),*sys.argv[2:]],check=True,timeout=150)
    finally:
        process.terminate()
        try:process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill();process.wait(timeout=10)
