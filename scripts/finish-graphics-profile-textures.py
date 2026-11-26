"""Losslessly encode the observed native Detailed texture uploads."""
import argparse,hashlib,json,sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pydeps',type=Path,required=True)
parser.add_argument('--staging',type=Path)
args=parser.parse_args();sys.path.insert(0,str(args.pydeps))
from PIL import Image
root=Path(__file__).resolve().parents[1];staging=root/'.work/graphics-profile-textures';target=root/'three/public/native-table'
if args.staging:staging=args.staging.resolve()
metadata=json.loads((target/'native-table.json').read_text())
for entry in json.loads((staging/'textures.json').read_text()):
    raw=(staging/entry['raw']).read_bytes();assert hashlib.sha256(raw).hexdigest()==entry['sourceSHA256']
    image=Image.frombytes('RGBA',(entry['width'],entry['height']),raw);path=target/entry['file']
    image.save(path,format='WEBP',lossless=True,exact=True,quality=100,method=6)
    assert Image.open(path).convert('RGBA').tobytes()==raw
    data=path.read_bytes();metadata['textures'][entry['id']]['variants']['detailed']['levels'][0].update(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
    print(json.dumps({'id':entry['id'],'bytes':len(data),'pixelsExact':True}),flush=True)
(target/'native-table.json').write_text(json.dumps(metadata,separators=(',',':')))
