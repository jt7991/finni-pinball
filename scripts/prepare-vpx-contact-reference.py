"""Build a zero-scatter native measurement copy without changing the source table."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root',type=Path,required=True)
args=parser.parse_args()
source=args.source_root.resolve()
tool=source/'.tools/vpxtool/vpxtool.exe'
table=source/'runtime/Finni-Big-Day.vpx'
out=ROOT/'.work/vpx-contact-reference'
out.mkdir(parents=True,exist_ok=True)
extracted=out/'extracted'
subprocess.run([str(tool),'extract',str(table),'-o',str(extracted),'-f'],check=True)
data_path=extracted/'gamedata.json'
data=json.loads(data_path.read_text())
overrides={'scatter':0,'default_scatter':0}
original={k:data[k] for k in overrides}
data.update(overrides)
data_path.write_text(json.dumps(data,indent=2)+'\n')
copy=out/'zero-scatter.vpx'
subprocess.run([str(tool),'assemble','-f',str(extracted),str(copy)],check=True)
verify=json.loads(subprocess.check_output([str(tool),'verify','--json',str(copy)],text=True))[0]
if not verify.get('valid'):raise RuntimeError(f'Reference failed VPX verification: {verify}')
comparison=subprocess.run([str(tool),'table','diff',str(table),str(copy)],text=True,capture_output=True)
if comparison.returncode not in (0,1):raise RuntimeError(comparison.stderr)
diff=comparison.stdout
metadata={'engine':'@valknar/vpinball-wasm 0.3.4','upstreamCommit':'195f214dd4849b8ef6113fd377258b78d0dec3bf',
          'sourceSha256':hashlib.sha256(table.read_bytes()).hexdigest(),
          'controlledSha256':hashlib.sha256(copy.read_bytes()).hexdigest(),
          'controlledOverrides':overrides,'originalValues':original,'diff':diff,'verification':verify}
(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(diff)
print(f'Controlled native reference: {copy}')
