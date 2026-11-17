import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/vpx-v1'
bpy.ops.wm.open_mainfile(filepath=str(out/'finni-table-scene.blend'))
scene=bpy.context.scene;camera=scene.camera
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU'
camera.location=(.315,-.388,.6)
camera.rotation_euler=(Vector((.315,-.388,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=.235
scene.render.resolution_x=1500;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.render.filepath=str(out/'finni-fox-top-down.png')
bpy.ops.render.render(write_still=True)
print('TOP_DOWN_RENDER_COMPLETE')
