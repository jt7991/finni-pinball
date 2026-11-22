"""Export the authored top meshes/textures without rounded OBJ coordinates."""
import argparse
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--vpx-source',type=Path,required=True)
parser.add_argument('--extracted-root',type=Path,required=True)
parser.add_argument('--pydeps',type=Path,required=True)
args=parser.parse_args()
sys.path.insert(0,str(args.pydeps))
from native_vpx_mesh import read_meshes

root=Path(__file__).resolve().parents[1]
out=root/'three/public'
meshes=read_meshes(args.vpx_source,render=True)
parts=[]
payload=bytearray()
for side in ['Left','Right']:
    name=side+'FlipperTop'
    spec=json.loads((args.extracted_root/'gameitems'/('Primitive.'+name+'.json')).read_text())['Primitive']
    mesh=meshes[name]
    part={'spec':spec,'vertices':len(mesh['vertices']),'vertexByteOffset':len(payload)}
    payload.extend(mesh['render_bytes'])
    part['indices']=len(mesh['indices'])
    part['indexByteOffset']=len(payload)
    payload.extend(struct.pack('<'+'H'*len(mesh['indices']),*mesh['indices']))
    parts.append(part)
    shutil.copyfile(args.extracted_root/'images'/(spec['image']+'.webp'),out/(spec['image']+'.webp'))
(out/'flipper-tops.bin').write_bytes(payload)
metadata={'file':'flipper-tops.bin','parts':parts,'sha256':hashlib.sha256(payload).hexdigest(),'sourceTableSHA256':hashlib.sha256(args.vpx_source.read_bytes()).hexdigest()}
(out/'flipper-tops.json').write_text(json.dumps(metadata,separators=(',',':')))
print(json.dumps({'bytes':len(payload),'sha256':metadata['sha256'],'parts':[{'name':p['spec']['name'],'vertices':p['vertices'],'indices':p['indices']} for p in parts]}))
