"""Serve the existing native player read-only for isolated comparison tests."""
import argparse
import importlib.util
import hashlib
import json
import socket
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root',type=Path,required=True)
parser.add_argument('--port',type=int,default=8766)
parser.add_argument('--table',type=Path,help='Optional controlled reference table; never changes the original.')
parser.add_argument('--metadata',type=Path,help='Measurement metadata matching the controlled table hash.')
parser.add_argument('--browser-root',type=Path,help='Optional isolated native UI snapshot; original assets remain read-only.')
parser.add_argument('--runtime-root',type=Path,help='Optional matching DMD and browser-music assets for the selected source table.')
parser.add_argument('--engine-root',type=Path,help='Use a separately pinned engine cache without modifying its checkout.')
args=parser.parse_args()
spec=importlib.util.spec_from_file_location('reference_server',args.source_root/'scripts/serve-browser.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
if args.engine_root:
    module.ENGINE=args.engine_root.resolve()
module.Handler.table_path=(args.table or args.source_root/'runtime/Finni-Big-Day.vpx').resolve()
metadata=json.loads(args.metadata.read_text()) if args.metadata else None
if metadata and metadata['controlledSha256']!=hashlib.sha256(module.Handler.table_path.read_bytes()).hexdigest():
    raise RuntimeError('Controlled reference metadata does not match the served table')
class Handler(module.Handler):
    def translate_path(self,path):
        relative=path.split('?',1)[0].lstrip('/') or 'index.html'
        if args.runtime_root and (relative in ('dmd-atlas.json','dmd-atlas.png','dmd-animations.json') or relative.startswith('music/')):
            candidate=(args.runtime_root/relative).resolve()
            if candidate.is_relative_to(args.runtime_root.resolve()) and candidate.is_file():return str(candidate)
        if args.browser_root:
            candidate=(args.browser_root/relative).resolve()
            if candidate.is_relative_to(args.browser_root.resolve()) and candidate.is_file():
                return str(candidate)
        return super().translate_path(path)
    def do_GET(self):
        if self.path=='/reference-metadata.json' and metadata:
            payload=json.dumps(metadata).encode()
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        else:super().do_GET()
class ReferenceServer(ThreadingHTTPServer):
    allow_reuse_address=False
    def server_bind(self):
        if sys.platform=='win32':self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        super().server_bind()
with ReferenceServer(('127.0.0.1',args.port),Handler) as server:
    print(f'Native reference: http://127.0.0.1:{server.server_port}',flush=True)
    server.serve_forever()
