"""Compare all style textures on the same actual extracted VPX table geometry."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/playfield-style-studies'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/vpx-v1/finni-table-scene.blend'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type == 'OPTIX'
scene.cycles.device = 'GPU'
camera = scene.camera
camera.location = (.257, -.571, 2)
camera.rotation_euler = (Vector((.257, -.571, 0))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.25
scene.render.resolution_x = 720
scene.render.resolution_y = 1500
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
nodes = [node for mat in bpy.data.materials if mat.use_nodes
         for node in mat.node_tree.nodes
         if node.type == 'TEX_IMAGE' and node.image
         and (node.image.name == 'pf' or 'finni-playfield-base' in node.image.name)]
assert nodes, 'No registered playfield material found'
for dest in sorted(OUT.glob('0*')):
    if not dest.is_dir():
        continue
    texture = dest/'finni-playfield-base.png'
    assert texture.exists(), str(texture)
    image = bpy.data.images.load(str(texture), check_existing=False)
    for node in nodes:
        node.image = image
    scene.render.filepath = str(dest/'on-table.png')
    bpy.ops.render.render(write_still=True)
    print('TABLE_STYLE_RENDERED', dest.name, flush=True)
print('SIX_TABLE_STYLES_COMPLETE', flush=True)
