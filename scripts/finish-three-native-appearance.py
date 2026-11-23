"""Losslessly encode new native texture uploads and verify every RGBA byte."""
import argparse,hashlib,json,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--staging',type=Path,required=True);p.add_argument('--pillow-root',type=Path,required=True);args=p.parse_args()
sys.path.insert(0,str(args.pillow_root));from PIL import Image
root=Path(__file__).resolve().parents[1];target=root/'three/public/native-table';metadata=json.loads((target/'native-table.json').read_text())
for entry in json.loads((args.staging/'textures.json').read_text()):
    raw=(args.staging/entry['raw']).read_bytes();assert hashlib.sha256(raw).hexdigest()==entry['sourceSHA256']
    image=Image.frombytes('RGBA',(entry['width'],entry['height']),raw);path=target/entry['file'];image.save(path,format='WEBP',lossless=True,exact=True,quality=100,method=6)
    assert Image.open(path).convert('RGBA').tobytes()==raw
    data=path.read_bytes();metadata['textures'][entry['id']]['levels'][0].update(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
    print(json.dumps({'texture':entry['id'],'bytes':len(data),'pixelsExact':True}),flush=True)
(target/'native-table.json').write_text(json.dumps(metadata,separators=(',',':')))
