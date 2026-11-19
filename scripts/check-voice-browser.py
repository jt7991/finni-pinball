"""Headless Edge visual captures and real browser OfflineAudioContext smoke check."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import threading
from http.server import ThreadingHTTPServer

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('server', ROOT/'scripts/serve-browser.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
edge=Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
output=ROOT/'.work/voice-studio-review';output.mkdir(exist_ok=True)
with ThreadingHTTPServer(('127.0.0.1',0),module.Handler) as server:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        import socket, time, urllib.request
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); debug_port=sock.getsockname()[1]
        with tempfile.TemporaryDirectory(prefix='edge-voice-',dir=ROOT/'.work') as profile:
            command=[str(edge),'--headless=new','--disable-gpu','--no-first-run','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',f'--user-data-dir={profile}',f'--remote-debugging-port={debug_port}','about:blank']
            process=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                for _ in range(100):
                    try: urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json/list'); break
                    except OSError:time.sleep(.1)
                subprocess.run([str(ROOT/'.tools/node-v22.16.0-win-x64/node.exe'),str(ROOT/'scripts/test-voice-browser.mjs'),f'http://127.0.0.1:{debug_port}',f'http://127.0.0.1:{server.server_port}',str(output)],check=True,timeout=40)
            finally:process.terminate();process.wait(timeout=10)
    finally:server.shutdown()
