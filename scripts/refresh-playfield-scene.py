"""Repack current playfield art without rebuilding or moving accepted hardware."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/json.loads((ROOT/'design/current-assets.json').read_text())['playfield_directory']
scene_file=ROOT/'output/vpx-v1/finni-table-scene.blend'
bpy.ops.wm.open_mainfile(filepath=str(scene_file))
texture=bpy.data.images.load(str(ART/'finni-playfield-base.png'),check_existing=False)
count=0
for material in bpy.data.materials:
    if not material.use_nodes:continue
    for node in material.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image and (node.image.name=='pf' or 'finni-playfield-base' in node.image.name):
            node.image=texture;count+=1
assert count,'No playfield material found'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(scene_file))
scene=bpy.context.scene
scene.cycles.samples=24
camera=scene.camera
camera.location=(.257,-.571,2)
camera.rotation_euler=(Vector((.257,-.571,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=1.25
scene.render.resolution_x=720;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.render.filepath=str(ART/'on-table.png')
bpy.ops.render.render(write_still=True)
print('PLAYFIELD_TEXTURE_REFRESHED',count,flush=True)
