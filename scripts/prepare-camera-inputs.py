"""Export authored camera inputs, never measured/fitted camera matrices."""
import argparse
import gzip
import hashlib
import json
import sys
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--vpx-source',type=Path,required=True)
parser.add_argument('--extracted-root',type=Path,required=True)
parser.add_argument('--pydeps',type=Path,required=True)
args=parser.parse_args()
sys.path.insert(0,str(args.pydeps))
from native_vpx_mesh import read_meshes
meshes=read_meshes(args.vpx_source)
parts=[]
for file in sorted((args.extracted_root/'gameitems').glob('*.json')):
    data=json.loads(file.read_text());kind,item=next(iter(data.items()))
    if kind not in ['Wall','Ramp','Rubber','Primitive']:continue
    keys={'Wall':['height_bottom','height_top'],'Ramp':['drag_points','height_top','height_bottom','width_top','width_bottom','ramp_type','wire_diameter','wire_distance_x'],'Rubber':['drag_points','height','thickness','static_rendering'],'Primitive':['position','size','rot_and_tra','use_3d_mesh']}[kind]+['name','is_visible']
    part={'kind':kind,**{k:item[k] for k in keys if k in item}}
    if 'drag_points' in part:part['drag_points']=[{k:p[k] for k in ['x','y','z','smooth'] if k in p} for p in part['drag_points']]
    if kind=='Primitive':
        mesh=meshes.get(item['name'])
        if mesh:
            part['local_bounds']=[[min(p[i] for p in mesh['vertices']) for i in range(3)],[max(p[i] for p in mesh['vertices']) for i in range(3)]]
        else:continue
    parts.append(part)
table=json.loads((args.extracted_root/'gamedata.json').read_text())
payload={'sourceTableSHA256':hashlib.sha256(args.vpx_source.read_bytes()).hexdigest(),'sourceCommit':'195f214dd4849b8ef6113fd377258b78d0dec3bf','parts':parts,'table':{k:table[k] for k in ['left','right','top','bottom']}}
out=Path(__file__).resolve().parents[1]/'three/tests/fixtures/camera-authored-inputs.json.gz'
out.write_bytes(gzip.compress(json.dumps(payload,separators=(',',':')).encode(),compresslevel=9,mtime=0))
print(json.dumps({'parts':len(parts),'bytes':out.stat().st_size}))
