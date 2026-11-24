"""Encode the committed DMD atlas losslessly and bind it to its source bytes."""
import argparse,hashlib,io,json,sys
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--public',type=Path,default=Path(__file__).resolve().parents[1]/'three/public')
parser.add_argument('--pillow-root',type=Path)
args=parser.parse_args()
if args.pillow_root:sys.path.insert(0,str(args.pillow_root))
from PIL import Image

root=args.public.resolve();source=root/'dmd-atlas.png';target=root/'dmd-atlas.webp';temporary=root/'dmd-atlas.webp.tmp'
data=source.read_bytes();sha=lambda value:hashlib.sha256(value).hexdigest()
image=Image.open(io.BytesIO(data)).convert('RGBA');raw=image.tobytes()
settings={'format':'WEBP','lossless':True,'exact':True,'quality':100,'method':6}
if image.info.get('icc_profile'):settings['icc_profile']=image.info['icc_profile']
image.save(temporary,**settings)
assert Image.open(temporary).convert('RGBA').tobytes()==raw,'Every RGBA byte, including transparent RGB, must remain unchanged'
assert source.read_bytes()==data,'Source atlas changed while encoding'
encoded=temporary.read_bytes();temporary.replace(target)
metadata={'version':1,'source':'dmd-atlas.png','sourceSHA256':sha(data),'sourceBytes':len(data),'file':'dmd-atlas.webp','encoding':'webp-lossless','sha256':sha(encoded),'bytes':len(encoded),'width':image.width,'height':image.height,'rgbaSHA256':sha(raw)}
manifest=root/'dmd-atlas-encoding.json';manifest.write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
print(json.dumps(metadata))
