"""Check the delivered primitive origins, OBJ data and texture dimensions."""
from pathlib import Path
import json,sys,math
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'.tools/pydeps'))
from PIL import Image
out=root/'output/vpx-v1';report=json.loads((out/'fox-fit-report.json').read_text())
results={}
for name,part in report['parts'].items():
    assert part['original_pivot']==part['final_pivot'],f'Pivot changed: {name}'
    vertices=[];uvs=[];normals=[];faces=[]
    for line in (out/(name+'.obj')).read_text().splitlines():
        cols=line.split()
        if not cols:continue
        if cols[0]=='v':vertices.append([float(x) for x in cols[1:]])
        elif cols[0]=='vt':uvs.append([float(x) for x in cols[1:]])
        elif cols[0]=='vn':normals.append([float(x) for x in cols[1:]])
        elif cols[0]=='f':faces.append(cols[1:])
    assert len(faces)==part['triangles']
    assert vertices and normals and len(normals)==len(uvs)
    assert all(math.isfinite(x) for p in vertices+uvs+normals for x in p)
    assert all(-.0001<=x<=1.0001 for uv in uvs for x in uv)
    assert all(len(face)==3 for face in faces)
    for face in faces:
        for entry in face:
            vi,ui,ni=map(int,entry.split('/'))
            assert 1<=vi<=len(vertices) and 1<=ui<=len(uvs) and 1<=ni<=len(normals)
    results[name]={'vertices':len(vertices),'triangles':len(faces),'pivot_unchanged':True,'normals_and_uvs_valid':True}
assert Image.open(out/'finni-fox-atlas.png').size==(2048,2048)
assert Image.open(out/'finni-playfield-base.png').size==(2048,4550)
validation={'parts':results,'playfield_texture':[2048,4550],'fox_atlas':[2048,2048],'total_triangles':sum(p['triangles'] for p in results.values())}
(out/'asset-validation.json').write_text(json.dumps(validation,indent=2))
print(json.dumps(validation))
