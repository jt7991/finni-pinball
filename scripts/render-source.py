import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'.work/deadpool-source.blend'))
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX'; prefs.get_devices()
for d in prefs.devices: d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.7,.73,.8,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.35
for obj in list(bpy.data.objects):
    if obj.type in ('LIGHT','CAMERA'): bpy.data.objects.remove(obj,do_unlink=True)
for mat in bpy.data.materials:
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type=='BSDF_PRINCIPLED':
                n.inputs['Transmission Weight'].default_value=0
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size,target):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc; aim(obj,target)
area('Key',(.1,-.5,1.2),75,1,(.25,-.6,0))
area('Fill',(.8,-.4,.7),40,.8,(.25,-.6,.03))
area('Rim',(.2,.3,.6),40,.6,(.25,-.4,.04))
data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);scene.camera=cam
data.type='ORTHO';data.ortho_scale=1.3
scene.render.image_settings.file_format='PNG';scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.resolution_x=1000;scene.render.resolution_y=2200
cam.location=(.257,-.571,2);aim(cam,(.257,-.571,0))
scene.render.filepath=str(root/'.work/source-table-top.png');bpy.ops.render.render(write_still=True)
toy_names={'LilHead','LilLeftArm','LilRightArm','Primitive077'}
for obj in bpy.data.objects:
    if obj.type=='MESH':obj.hide_render=obj.name not in toy_names
bpy.ops.mesh.primitive_plane_add(size=20,location=(0,0,.0325))
floor=bpy.context.object;floor.name='Temporary studio floor'
mat=bpy.data.materials.new('Cream floor');mat.diffuse_color=(.66,.61,.54,1);floor.data.materials.append(mat)
data.ortho_scale=.165
cam.location=(.52,-.69,.24);aim(cam,(.337,-.366,.09))
scene.render.resolution_x=1100;scene.render.resolution_y=1100
scene.render.filepath=str(root/'.work/source-mini-deadpool.png');bpy.ops.render.render(write_still=True)
pf=bpy.data.images.get('pf').copy();pf.scale(700,1555);pf.filepath_raw=str(root/'.work/source-pf-reference.png');pf.file_format='PNG';pf.save()
print('SOURCE_RENDER_COMPLETE')
