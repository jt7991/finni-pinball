"""Import the actual VPX GLB and inventory models, textures and transforms.

Run with Blender: --background --python scripts/inspect-vpx-scene.py -- <table.glb>
"""
import bpy
import sys
import json
import re
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]).resolve()
out=root/'.work'
out.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
inventory=[]
for obj in bpy.data.objects:
    if obj.type!='MESH':
        continue
    corners=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    mats=[]
    for slot in obj.material_slots:
        mat=slot.material
        textures=[]
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image:
                    textures.append({'name':node.image.name,'size':list(node.image.size),'path':node.image.filepath})
        mats.append({'name':mat.name if mat else None,'textures':textures})
    inventory.append({'name':obj.name,'vertices':len(obj.data.vertices),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'dimensions':list(obj.dimensions),'world_bounds':[[min(c[i] for c in corners) for i in range(3)],[max(c[i] for c in corners) for i in range(3)]],'matrix_world':[list(row) for row in obj.matrix_world],'materials':mats,'properties':{k:str(v) for k,v in obj.items()}})
(out/'deadpool-scene-inventory.json').write_text(json.dumps(inventory,indent=2))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'deadpool-source.blend'))
matches=[item for item in inventory if re.search(r'deadpool|mini|lil|bash|toy|spring',item['name'],re.I)]
print('SOURCE_OBJECTS',len(inventory))
print('TOY_NAME_MATCHES',json.dumps(matches,indent=2))
print('SOURCE_IMAGES',json.dumps([{'name':i.name,'size':list(i.size)} for i in bpy.data.images]))
