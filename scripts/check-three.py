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
import re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.work/three-review'
review_subdir=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--review-subdir=')),None)
if review_subdir is not None:
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*',review_subdir):
        raise ValueError('Review subdirectory must be a single named directory')
    OUT=OUT/review_subdir
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
        if '--native-abs' in sys.argv:runner='probe-native-abs.mjs'
        if '--native-light-state' in sys.argv:runner='probe-native-light-state.mjs'
        if '--native-object-dispatch' in sys.argv:runner='probe-native-object-dispatch.mjs'
        if '--native-chooser-spam' in sys.argv:runner='probe-native-chooser-spam.mjs'
        if '--chooser-spam' in sys.argv:runner='test-chooser-spam-production.mjs'
        if '--native-postprocess' in sys.argv:runner='probe-native-postprocess-browser.mjs'
        if '--postprocess-render' in sys.argv:runner='test-native-postprocess-browser.mjs'
        if '--native-nudge-render' in sys.argv:runner='probe-native-nudge-render-browser.mjs'
        if '--nudged-postprocess' in sys.argv:runner='test-native-postprocess-browser.mjs'
        if '--production-nudge' in sys.argv:runner='test-three-nudge-production.mjs'
        if '--native-ball-presentation' in sys.argv:runner='probe-native-ball-presentation-browser.mjs'
        if '--ball-presentation' in sys.argv:runner='test-ball-presentation-browser.mjs'
        if '--native-whole-frame' in sys.argv:runner='probe-native-whole-frame-browser.mjs'
        if '--whole-frame-render' in sys.argv:runner='test-native-whole-frame-browser.mjs'
        if '--native-frame-history' in sys.argv:runner='probe-native-frame-history.mjs'
        if '--native-gameplay-history' in sys.argv:runner='probe-native-gameplay-history.mjs'
        if '--frame-history-render' in sys.argv:runner='test-native-frame-history.mjs'
        if '--postprocess-history' in sys.argv:runner='test-native-postprocess-history.mjs'
        if '--flipper-assembly' in sys.argv:runner='test-native-flipper-assembly-browser.mjs'
        if '--native-static-prepass' in sys.argv:runner='probe-native-static-prepass-browser.mjs'
        if '--trigger-animation' in sys.argv:runner='test-trigger-animation-browser.mjs'
        if '--static-render' in sys.argv:runner='test-native-static-render-browser.mjs'
        if '--production-worker-performance' in sys.argv:runner='benchmark-production-worker-browser.mjs'
        if '--worker-throttle-coverage' in sys.argv:runner='probe-worker-throttle-browser.mjs'
        if '--startup-resource-audit' in sys.argv:runner='audit-production-startup-browser.mjs'
        if '--startup-profile' in sys.argv:runner='profile-production-startup-browser.mjs'
        if '--dmd-decode-performance' in sys.argv:runner='benchmark-dmd-decode-browser.mjs'
        if '--native-colon-calls' in sys.argv:runner='probe-native-colon-calls.mjs'
        if '--native-flash-timers' in sys.argv:runner='probe-native-flash-timers.mjs'
        if '--native-vpm-timers' in sys.argv:runner='probe-native-vpm-timers.mjs'
        if '--native-timer-enabled' in sys.argv:runner='probe-native-timer-enabled.mjs'
        if '--native-timer-interval' in sys.argv:runner='probe-native-timer-interval.mjs'
        if '--native-initial-timers' in sys.argv:runner='probe-native-initial-timers.mjs'
        if '--production-dmd-animation' in sys.argv:runner='test-dmd-animation-production.mjs'
        if '--dmd-atlas-conformance' in sys.argv:runner='test-dmd-atlas-browser.mjs'
        if '--native-tilt-bob' in sys.argv:runner='probe-native-tilt-bob.mjs'
        if '--production-tilt' in sys.argv:runner='test-tilt-production.mjs'
        if '--main-player' in sys.argv:runner='test-main-player-production.mjs'
        if '--production-lifecycle' in sys.argv:runner='test-automatic-budget-gameplay.mjs'
        if '--high-scores' in sys.argv:runner='test-high-scores-browser.mjs'
        if '--native-startup' in sys.argv:runner='probe-native-startup.mjs'
        if '--native-scene-startup' in sys.argv:runner='probe-native-scene-startup.mjs'
        if '--graphics-profile' in sys.argv:runner='probe-graphics-profile-browser.mjs'
        if '--profile-postprocess' in sys.argv:runner='test-graphics-profile-postprocess-browser.mjs'
        if '--player-backdrop' in sys.argv:runner='test-native-backdrop-browser.mjs'
        if '--audio-players' in sys.argv:runner='test-audio-players-browser.mjs'
        if '--audio-cache' in sys.argv:runner='test-audio-cache-browser.mjs'
        if '--production-audio-recovery' in sys.argv:runner='test-audio-recovery-production.mjs'
        if '--production-audio-startup' in sys.argv:runner='test-audio-startup-production.mjs'
        if '--audio-preparation' in sys.argv:runner='test-audio-preparation-browser.mjs'
        if '--native-audio-mix' in sys.argv:runner='probe-native-audio-mix.mjs'
        if '--audio-mix' in sys.argv:runner='test-native-audio-mix-browser.mjs'
        timeout=150
        if '--native-gameplay-history' in sys.argv:timeout=240
        if '--native-gameplay-history' in sys.argv and '--paged-history' in sys.argv:
            through_ms=next((int(arg.split('=',1)[1]) for arg in sys.argv if arg.startswith('--through-ms=')),30000)
            timeout=max(timeout,through_ms/1000*2+120)
        if '--production-lifecycle' in sys.argv:timeout=260
        if '--native-frame-history' in sys.argv:
            frame_count=next((int(arg.split('=',1)[1]) for arg in sys.argv if arg.startswith('--frames=')),6)
            timeout=max(timeout,60+frame_count*4)
        if '--frame-history-render' in sys.argv:
            capture_name=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--capture-name=')),'initial-history-r6')
            capture_path=OUT/('native-frame-history-'+capture_name)/'capture.json'
            if capture_path.is_file():
                import json
                frame_count=len(json.loads(capture_path.read_text(encoding='utf-8'))['frames'])
                timeout=max(timeout,60+frame_count)
        if '--native-contact' in sys.argv and '--packed-frames' in sys.argv:
            record_ms=next((int(arg.split('=',1)[1]) for arg in sys.argv if arg.startswith('--record-through-ms=')),0)
            timeout=max(timeout,record_ms/1000+90)
        subprocess.run(['node',str(ROOT/'scripts'/runner),f'http://127.0.0.1:{port}',
                        sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5173/three/',str(OUT),*sys.argv[2:]],check=True,timeout=timeout)
    finally:
        process.terminate()
        try:process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill();process.wait(timeout=10)
