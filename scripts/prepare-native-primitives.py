"""Export original VPX primitive vertex bytes, never rounded Blender/OBJ meshes."""
import argparse,hashlib,json,struct,sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--vpx-source',type=Path,required=True)
parser.add_argument('--extracted-root',type=Path,required=True)
parser.add_argument('--pydeps',type=Path,required=True)
parser.add_argument('--output-directory',type=Path,required=True)
parser.add_argument('--deduplicate',action='store_true',help='Merge only bit-identical 32-byte vertices; preserve triangle and attribute bits.')
args=parser.parse_args();sys.path.insert(0,str(args.pydeps))
from native_vpx_mesh import read_meshes
meshes=read_meshes(args.vpx_source,render=True);payload=bytearray();parts=[]
for file in sorted((args.extracted_root/'gameitems').glob('Primitive.*.json')):
    spec=json.loads(file.read_text())['Primitive'];name=spec['name']
    if name in ['playfield_mesh','LeftFlipperTop','RightFlipperTop'] or name not in meshes:continue
    mesh=meshes[name];source_vertices=mesh['render_bytes'];source_indices=struct.pack('<'+'I'*len(mesh['indices']),*mesh['indices']);vertices=source_vertices;index_values=mesh['indices']
    if args.deduplicate:
        lookup={};unique=bytearray();remap=[]
        for offset in range(0,len(source_vertices),32):
            vertex=source_vertices[offset:offset+32]
            index=lookup.get(vertex)
            if index is None:index=len(lookup);lookup[vertex]=index;unique.extend(vertex)
            remap.append(index)
        vertices=bytes(unique);index_values=[remap[i] for i in index_values]
    part={'spec':spec,'vertices':len(vertices)//32,'sourceVertices':len(source_vertices)//32,'sourceVertexSHA256':hashlib.sha256(source_vertices).hexdigest(),'sourceIndexSHA256':hashlib.sha256(source_indices).hexdigest(),'vertexByteOffset':len(payload),'vertexSHA256':hashlib.sha256(vertices).hexdigest()}
    payload.extend(vertices);part['indexByteOffset']=len(payload);part['indices']=len(index_values)
    indices=struct.pack('<'+'I'*len(index_values),*index_values);part['indexSHA256']=hashlib.sha256(indices).hexdigest();payload.extend(indices);parts.append(part)
args.output_directory.mkdir(parents=True,exist_ok=True)
(args.output_directory/'primitive-meshes.bin').write_bytes(payload)
metadata={'sourceTableSHA256':hashlib.sha256(args.vpx_source.read_bytes()).hexdigest(),'file':'primitive-meshes.bin','sha256':hashlib.sha256(payload).hexdigest(),'deduplicated':args.deduplicate,'parts':parts}
(args.output_directory/'primitive-meshes.json').write_text(json.dumps(metadata,separators=(',',':')))
print(json.dumps({'parts':len(parts),'bytes':len(payload),'sha256':metadata['sha256']}))
