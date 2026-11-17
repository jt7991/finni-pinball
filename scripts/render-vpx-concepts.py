"""Render the Finni fox and base on the actual extracted VPX geometry."""
import bpy,json,re,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/vpx-v1'
ART=ROOT/json.loads((ROOT/'design/current-assets.json').read_text())['playfield_directory']
bpy.ops.wm.open_mainfile(filepath=str(OUT/'finni-table-layout-source.blend'))
source_hidden={o.name for o in bpy.data.objects if o.hide_render}
old_ground=bpy.data.objects.get('Presentation ground')
if old_ground:bpy.data.objects.remove(old_ground,do_unlink=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU'
TOY={'LilHead','LilLeftArm','LilRightArm','Primitive077'}
F=Vector((-.5239493847,-.8517494202,0));R=Vector((-F.y,F.x,0))
def rgba(hex):
    def lin(c):
        c=int(c,16)/255;return c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4
    return tuple(lin(hex[i:i+2]) for i in (0,2,4))+(1,)
def mat(name,color,metal=0,rough=.4):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=rgba(color);s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=rgba(color);s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=rough
    return m
purple=mat('Finni | satin violet plastics','8272F5',rough=.32)
plum=mat('Finni | dark plum trim','49344F',rough=.34)
cream=mat('Finni | warm cream rubber','FBEAD0',rough=.52)
orange=mat('Finni | tangerine caps','ED762F',rough=.32)
floor_mat=mat('Studio | warm stone','E8DFD1',rough=.7)
pf=bpy.data.images.load(str(ART/'finni-playfield-base.png'),check_existing=False)
back=bpy.data.images.load(str(ART/'back-panel.png'),check_existing=False)
# Rebind packed textures too: the imported layout has an earlier embedded base.
for material in bpy.data.materials:
    if not material.use_nodes:continue
    for node in material.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image:
            if node.image.name=='pf' or 'finni-playfield-base' in node.image.name:node.image=pf
            elif node.image.name in {'backwall','backwall2'} or 'finni-back-panel' in node.image.name:node.image=back
decor={'dazzler','wolverine','domino','colossus','deadpool1','truck2','trucktop'}
import runpy
party = runpy.run_path(str(ROOT/'scripts/party-hardware.py'))
hidden, cake_names = party['build_party_hardware'](OUT, mat, F, R)
hidden=list(set(hidden)|source_hidden)
TOY = TOY | cake_names
for obj in bpy.data.objects:
    if obj.type!='MESH' or obj.name in TOY:continue
    if obj.name in hidden:continue
    if obj.name.startswith('REFERENCE_'):
        obj.hide_render=True;hidden.append(obj.name);continue
    bounds=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    center=sum(bounds,Vector())/8
    if center.x<-.035 or center.x>.55 or center.y< -1.20 or center.y>.055:
        obj.hide_render=True;hidden.append(obj.name);continue
    # VPX glow polygons are large additive effects, not physical geometry.
    if obj.name.endswith(('_insert','_bulb','_socket')) or obj.name=='LightInserts':
        obj.hide_render=True;hidden.append(obj.name);continue
    for slot in obj.material_slots:
        m=slot.material
        if not m or not m.use_nodes:continue
        image_names={n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
        if image_names & decor:
            obj.hide_render=True;hidden.append(obj.name);continue
        if 'backwall2' in image_names:
            obj.hide_render=True;hidden.append(obj.name);continue
        if image_names & {'plastics','plastics2','Cabinet_Sides','lildpgate','chibitarget'}:
            slot.material=purple
            continue
        if image_names & {'flipperltop','flipperrtop','CustomBlackTip_red','flipperx'}:
            slot.material=cream
            continue
        for n in m.node_tree.nodes:
            if n.type=='TEX_IMAGE' and n.image:
                if n.image.name=='pf':n.image=pf
                elif n.image.name in {'backwall','backwall2'}:n.image=back
            if n.type=='BSDF_PRINCIPLED':
                n.inputs['Roughness'].default_value=max(.24,n.inputs['Roughness'].default_value)
                n.inputs['Coat Weight'].default_value=0
                if 'Playfield' in m.name:
                    n.inputs['Roughness'].default_value=.31;n.inputs['Coat Weight'].default_value=.25
                # Preserve real transparent ramp plastics; opaque Toys are only
                # on the replacement meshes above, with their own material.
    if 'Rubber' in obj.name and obj.material_slots:
        for slot in obj.material_slots:slot.material=cream
    if obj.name.lower().startswith(('bumpercap','bumperring')):
        for slot in obj.material_slots:slot.material=orange

# Preserve the latest playfield's green plastics, alpha cutouts and plain targets.
alpha_mapping=json.loads((ART/'original-plastic-alpha-map.json').read_text())
for image_name in ('plastics','plastics2'):
    material=mat('Party | green '+image_name,'38751F',rough=.5)
    shader=material.node_tree.nodes.get('Principled BSDF')
    tex=material.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(ROOT/'.work/deadpool-extracted/images'/f'{image_name}.webp'))
    material.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
    for name,slots in alpha_mapping.items():
        obj=bpy.data.objects.get(name)
        if not obj:continue
        for index,source in slots.items():
            if source==image_name and int(index)<len(obj.material_slots):obj.material_slots[int(index)].material=material
target_green=mat('Party | plain green target','38751F',rough=.6)
for obj in bpy.data.objects:
    if obj.type!='MESH':continue
    for slot in obj.material_slots:
        material=slot.material
        if not material or not material.use_nodes:continue
        names={n.image.name for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
        if names & {'hellhouse','spinner','spinnerw','target-snikt','target','droptarget'}:
            slot.material=target_green if 'hellhouse' in names else orange

for obj in list(bpy.data.objects):
    if obj.type in ('LIGHT','CAMERA'):bpy.data.objects.remove(obj,do_unlink=True)
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.72,.76,.84,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.25
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size,target,color=(1,1,1)):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;aim(o,target);return o
lights=[area('Key softbox',(-.4,-.6,1.4),50,1.2,(.25,-.55,0),(1,.94,.84)),area('Fill softbox',(.9,-.4,.9),25,1,(.25,-.55,0),(.85,.9,1)),area('Rim softbox',(.2,.6,.8),35,.7,(.25,-.35,0),(1,.9,.75))]
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));floor=bpy.context.object;floor.name='Presentation ground';floor.data.materials.append(floor_mat)
data=bpy.data.cameras.new('Finni camera');camera=bpy.data.objects.new('Finni camera',data);scene.collection.objects.link(camera);scene.camera=camera
data.type='ORTHO'
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.75
def render(name,loc,target,scale,size):
    camera.location=loc;aim(camera,target);data.ortho_scale=scale;scene.render.resolution_x=size[0];scene.render.resolution_y=size[1];scene.render.filepath=str(OUT/name)
    if '--skip-renders' not in sys.argv:bpy.ops.render.render(write_still=True)
render('finni-combined-playfield.png',(.52,-1.48,1.62),(.255,-.56,.015),1.55,(1500,2600))
render('finni-playfield-overhead.png',(.257,-.571,2),(.257,-.571,0),1.25,(1300,2700))
target=Vector((.337,-.365,.094))
render('finni-fox-installed.png',target+F*.25+R*.12+Vector((0,0,.20)),target,.26,(1600,1200))
# Isolate the same table-fitted mesh for an individual product view.
for obj in bpy.data.objects:
    if obj.type=='MESH':obj.hide_render=obj.name not in TOY
floor.hide_render=False;floor.location.z=.0327
for o in lights:bpy.data.objects.remove(o,do_unlink=True)
lights=[area('Toy key',target+F*.22-R*.17+Vector((0,0,.28)),3,.23,target,(1,.93,.84)),area('Toy fill',target+F*.10+R*.23+Vector((0,0,.15)),1.8,.20,target,(.85,.9,1)),area('Toy rim',target-F*.18+Vector((0,0,.23)),3,.18,target,(1,.94,.82))]
render('finni-fox-individual.png',target+F*.24+R*.12+Vector((0,0,.13)),target,.18,(1500,1500))
render('finni-fox-front.png',target+F*.30+Vector((0,0,.08)),target,.18,(1500,1500))
bpy.ops.object.select_all(action='DESELECT')
for name in TOY:bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['LilHead']
bpy.ops.file.pack_all()
for screen in bpy.data.screens:
    for viewport_area in screen.areas:
        if viewport_area.type=='VIEW_3D':viewport_area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'finni-fox-source-fit.blend'))
# Restore the table for the combined scene file, keeping VPX-only glow meshes
# and the source character billboards excluded from this design preview.
for obj in bpy.data.objects:
    if obj.type=='MESH':obj.hide_render=obj.name in hidden
floor.location.z=-.025
for o in lights:bpy.data.objects.remove(o,do_unlink=True)
area('Key softbox',(-.4,-.6,1.4),50,1.2,(.25,-.55,0),(1,.94,.84));area('Fill softbox',(.9,-.4,.9),25,1,(.25,-.55,0),(.85,.9,1));area('Rim softbox',(.2,.6,.8),35,.7,(.25,-.35,0),(1,.9,.75))
camera.location=(.52,-1.48,1.62);aim(camera,(.255,-.56,.015));data.ortho_scale=1.55
scene.render.resolution_x=1500;scene.render.resolution_y=2600
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'finni-table-scene.blend'))
print('FINNI_VPX_RENDERS_COMPLETE')
