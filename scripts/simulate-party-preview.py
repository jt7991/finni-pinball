"""Scripted lighting/gameplay visualization, not VPX physics or game logic."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/game-preview';OUT.mkdir(exist_ok=True)
ART=ROOT/json.loads((ROOT/'design/current-assets.json').read_text())['playfield_directory']
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/vpx-v1/finni-table-scene.blend'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
scene.cycles.use_denoising=True
scene.render.resolution_x=640;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.fps=20;scene.frame_start=1;scene.frame_end=400
scene.view_settings.exposure=-.15
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.07
for obj in list(bpy.data.objects):
    if obj.type=='LIGHT':obj.data.energy*=.16
ground=bpy.data.objects.get('Presentation ground')
if ground:ground.hide_render=True
scene.render.film_transparent=False
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.012,.016,.027,1)
scene.camera.location=(.37,-1.22,1.85)
scene.camera.rotation_euler=(Vector((.255,-.56,.01))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=1.38
scene.use_nodes=True;nodes=scene.node_tree.nodes;nodes.clear()
source=nodes.new('CompositorNodeRLayers');glow=nodes.new('CompositorNodeGlare')
glow.glare_type='FOG_GLOW';glow.quality='MEDIUM';glow.threshold=1.5
output=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(source.outputs['Image'],glow.inputs['Image']);scene.node_tree.links.new(glow.outputs['Image'],output.inputs['Image'])

def material(name,color,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    sh=m.node_tree.nodes['Principled BSDF'];sh.inputs['Base Color'].default_value=(*color,1)
    sh.inputs['Metallic'].default_value=metal;sh.inputs['Roughness'].default_value=.12 if metal else .4
    return m

def point(name,pos,color,power,radius=.018):
    data=bpy.data.lights.new(name,'POINT');data.color=color;data.energy=power;data.shadow_soft_size=radius
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos
    return obj

lights={}
for path in (ROOT/'.work/deadpool-extracted/gameitems').glob('Light.*.json'):
    light=json.loads(path.read_text())['Light'];lights[light['name']]=light
scale=.00053975
for i,name in enumerate(sorted(n for n in lights if n.startswith('gi'))):
    l=lights[name];c=l['center']
    # Warm general illumination at the source lamp centers.
    point('Preview GI '+name,(c['x']*scale,-c['y']*scale,.022),(1,.71,.39),.045 if i%2 else .07,.012)

pf=bpy.data.images.load(str(ART/'finni-playfield-base.png'),check_existing=True)
overrides={l['name']:l for l in json.loads((ART/'inlane-layout-overrides.json').read_text())}
insert_materials=[]
for name,l in lights.items():
    if not name.startswith('li') or not name[2:].isdigit():continue
    n=int(name[2:])
    if not 2<=n<=53 or n==44:continue
    drag=l.get('drag_points',[])
    if len(drag)<3:continue
    coords=[]
    for p in drag:
        x,y=p['x'],p['y']
        if name in overrides:
            o=overrides[name];x=(x-o['old_center']['x'])*o['scale']+o['new_center']['x'];y=(y-o['old_center']['y'])*o['scale']+o['new_center']['y']
        coords.append((x*scale,-y*scale,.0007))
    mesh=bpy.data.meshes.new('Lit insert '+name);mesh.from_pydata(coords,[],[tuple(range(len(coords)))]);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        p=mesh.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.x/(952*scale),1+p.y/(2115*scale))
    obj=bpy.data.objects.new('Preview insert '+name,mesh);scene.collection.objects.link(obj)
    m=material('Preview lit '+name,(1,.7,.2));sh=m.node_tree.nodes['Principled BSDF']
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=pf
    m.node_tree.links.new(tex.outputs['Color'],sh.inputs['Base Color']);m.node_tree.links.new(tex.outputs['Color'],sh.inputs['Emission Color'])
    mesh.materials.append(m);insert_materials.append((n,sh.inputs['Emission Strength']))

bumper_lights=[]
for i in range(1,4):
    pos=bpy.data.objects[f'Bumper{i}Ring'].matrix_world.translation.copy();pos.z=.055
    bumper_lights.append(point('Preview bumper flash '+str(i),pos,[(1,.48,.12),(.45,.3,1),(.25,1,.65)][i-1],0,.024))
flash=point('Preview celebration flash',(.28,-.35,.16),(1,.78,.5),0,.12)
ballmat=material('Preview polished pinball',(.8,.82,.88),1)
balls=[]
for i in range(3):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=.0069)
    ball=bpy.context.object;ball.name='Preview ball '+str(i+1);ball.data.materials.append(ballmat)
    for p in ball.data.polygons:p.use_smooth=True
    balls.append(ball)

route=[(0,(.49,-1.02,.009)),(.7,(.49,-.23,.009)),(1.1,(.475,-.06,.012)),
       (1.5,(.28,-.04,.014)),(1.9,(.12,-.14,.012)),(2.35,(.2,-.65,.009)),
       (2.8,(.29,-.94,.01)),(3.2,(.115,-.45,.012)),(3.6,(.08,-.3,.074)),
       (4.0,(.12,-.25,.063)),(4.35,(.16,-.42,.063)),(4.7,(.11,-.63,.058)),
       (5.15,(.064,-.79,.052)),(5.5,(.19,-.94,.01)),(5.9,(.29,-.59,.009)),
       (6.3,(.438,-.365,.0474)),(6.65,(.438,-.299,.0484)),(7.5,(.438,-.299,.0484)),
       (7.8,(.438,-.5,.0474)),(8.15,(.425,-.67,.0474)),(8.45,(.407,-.79,.0474)),
       (8.9,(.285,-.94,.011)),(9.3,(.28,-.21,.016)),(9.6,(.345,-.27,.016)),
       (10,(.28,-.34,.016)),(10.6,(.16,-.7,.01)),(11.1,(.2,-.94,.011)),
       (11.5,(.12,-.34,.012)),(12.0,(.25,-.19,.016)),(12.5,(.36,-.3,.016)),
       (13.1,(.32,-.62,.011)),(13.65,(.29,-.94,.011)),(14,(.2,-.52,.011))]

def route_at(t):
    if t>=14:
        # Two explicit hits to Target012 beneath the fox, then rebound.
        hero=[(14,(.24,-.62,.008)),(15,(.326,-.387,.008)),(15.25,(.285,-.48,.008)),
              (16,(.24,-.65,.008)),(17.5,(.326,-.387,.008)),(17.75,(.29,-.48,.008)),
              (20,(.22,-.75,.008))]
        for i in range(len(hero)-1):
            t0,a=hero[i];t1,b=hero[i+1]
            if t0<=t<=t1:return Vector(a).lerp(Vector(b),(t-t0)/(t1-t0))
    t=t%14
    for i in range(len(route)-1):
        t0,a=route[i];t1,b=route[i+1]
        if t0<=t<t1:return Vector(a).lerp(Vector(b),(t-t0)/(t1-t0))
    return Vector(route[-1][1])

flippers=[(o,o.rotation_euler.copy()) for o in bpy.data.objects if o.name.startswith(('LeftFlipper','RightFlipper'))]
toy_parts=[]
for name in ('LilHead','LilLeftArm','LilRightArm'):
    obj=bpy.data.objects[name]
    # Raise the animation origin with the lifted sculpture so the joints stay
    # at the actual neck/shoulders above the small cake.
    offset=obj.matrix_world.inverted().to_3x3()@Vector((0,0,.0215))
    for v in obj.data.vertices:v.co-=offset
    obj.location.z+=.0215
    toy_parts.append((obj,obj.rotation_euler.copy()))
wide_location=scene.camera.location.copy();wide_rotation=scene.camera.rotation_euler.copy()
forward=Vector((-.5239493847,-.8517494202,0));right=Vector((-forward.y,forward.x,0))
close_target=Vector((.337,-.38,.076))
close_location=close_target+forward*.28+right*.13+Vector((0,0,.22))
close_rotation=(close_target-close_location).to_track_quat('-Z','Y').to_euler()
for frame in range(1,401):
    t=(frame-1)/20
    for n,strength in insert_materials:
        chase=math.sin(t*6-n*.68)>.55
        if 7<=n<=13:lit=(int(t*2)%7)==n-7 or t>9
        elif t>9:lit=math.sin(t*12+n)>.1
        else:lit=chase or (n in (28,32,33) and 5.5<t<7.7)
        strength.default_value=3.5 if lit else .08;strength.keyframe_insert('default_value',frame=frame)
    for i,ball in enumerate(balls):
        ball.location=route_at(t+i*2.8)
        if t>=14 and i==0:ball.location=route_at(t)
        ball.hide_render=i>0 and (t<9 or t>=14);ball.keyframe_insert('location',frame=frame);ball.keyframe_insert('hide_render',frame=frame)
    for i,obj in enumerate(bumper_lights):
        hit=max(0,math.sin(t*15-i*2))**20 if 9<t<14 else 0
        obj.data.energy=hit*.45;obj.data.keyframe_insert('energy',frame=frame)
        balloon=bpy.data.objects[f'Party balloon {i+1}']
        balloon.scale=(1+hit*.05,1+hit*.05,1-hit*.06);balloon.keyframe_insert('scale',frame=frame)
    target_flash=sum(math.exp(-(t-hit)*12) for hit in (15,17.5) if t>=hit)
    flash.data.energy=(.75*(max(0,math.sin(t*15))**16) if 9<t<14 else .35*target_flash);flash.data.keyframe_insert('energy',frame=frame)
    for obj,original in flippers:
        pulse=max(0,1-abs(t-2.8)/.14)+max(0,1-abs(t-5.5)/.14)+max(0,1-abs(t-8.9)/.14)
        if t>9:pulse=max(0,math.sin(t*12+(0 if obj.name.startswith('Left') else 1.5)))**8
        obj.rotation_euler=original.copy();obj.rotation_euler.z+=(1 if obj.name.startswith('Right') else -1)*pulse*.65
        obj.keyframe_insert('rotation_euler',frame=frame)
    # Target012_Hit calls LilDPShake 5 in JP's table. The source drives three
    # independent joints using hidden physics balls; this visual approximation
    # uses damped oscillations, triggered only at those same target-hit events.
    for i,(obj,rest) in enumerate(toy_parts):
        obj.rotation_euler=rest.copy()
        for hit in (15,17.5):
            age=t-hit
            if age<0:continue
            decay=math.exp(-age*1.65)
            obj.rotation_euler.x+=(.16 if i==0 else .21)*decay*math.sin(age*(24+i*2))*(-1 if i==2 else 1)
            obj.rotation_euler.y+=(.12 if i==0 else .17)*decay*math.sin(age*(20+i*3))
        obj.keyframe_insert('rotation_euler',frame=frame)
    scene.camera.location=close_location if t>=14 else wide_location
    scene.camera.rotation_euler=close_rotation if t>=14 else wide_rotation
    scene.camera.data.ortho_scale=.285 if t>=14 else 1.38
    scene.camera.keyframe_insert('location',frame=frame);scene.camera.keyframe_insert('rotation_euler',frame=frame)
    scene.camera.data.keyframe_insert('ortho_scale',frame=frame)

scene.frame_set(210)
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'lighting-preview.png')
if '--movie' not in sys.argv:bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'finni-game-preview.blend'))
if '--movie' in sys.argv:
    scene.render.image_settings.file_format='FFMPEG';scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264';scene.render.ffmpeg.constant_rate_factor='MEDIUM';scene.render.ffmpeg.ffmpeg_preset='GOOD'
    scene.render.filepath=str(OUT/'finni-game-preview.mp4');bpy.ops.render.render(animation=True)
print('SCRIPTED_PREVIEW_COMPLETE',flush=True)
