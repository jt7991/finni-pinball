"""Serve the existing native player read-only for isolated comparison tests."""
import argparse
import importlib.util
from http.server import ThreadingHTTPServer
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root',type=Path,required=True)
parser.add_argument('--port',type=int,default=8766)
args=parser.parse_args()
spec=importlib.util.spec_from_file_location('reference_server',args.source_root/'scripts/serve-browser.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
module.Handler.table_path=args.source_root/'runtime/Finni-Big-Day.vpx'
with ThreadingHTTPServer(('127.0.0.1',args.port),module.Handler) as server:
    print(f'Native reference: http://127.0.0.1:{args.port}',flush=True)
    server.serve_forever()
