"""Assemble visuals, audio, multiball stories and the approved scoop feed; retain source rules."""
import bpy,json,shutil,copy,math,sys,runpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'.tools/pydeps'))
from PIL import Image,ImageDraw
SOURCE=ROOT/'.work/deadpool-extracted';WORK=ROOT/'.work/finni-live-extracted';OUT=ROOT/'output/live-vpx'
ART=ROOT/json.loads((ROOT/'design/current-assets.json').read_text())['playfield_directory']
OUT.mkdir(exist_ok=True)
shutil.copytree(SOURCE,WORK,dirs_exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/vpx-v1/finni-table-scene.blend'))
items=json.loads((WORK/'gameitems.json').read_text());images=json.loads((WORK/'images.json').read_text())
template=json.loads((WORK/'gameitems/Primitive.LilHead.json').read_text())['Primitive']
palette_colors={}
for obj in bpy.data.objects:
    if obj.name.startswith('Party'):
        for m in obj.data.materials:
            if m and m.name not in palette_colors:
                color=m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value
                def srgb(c):return round(255*(12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055))
                palette_colors[m.name]=tuple(srgb(c) for c in color[:3])
palette_names=list(palette_colors)
palette=Image.new('RGB',(512,512),'white');draw=ImageDraw.Draw(palette)
for i,name in enumerate(palette_names):draw.rectangle(((i%8)*64,(i//8)*64,(i%8+1)*64-1,(i//8+1)*64-1),fill=palette_colors[name])
palette.save(WORK/'images/finni-party-palette.png')
images.append({'name':'finni-party-palette','path':'finni-party-palette.png','alpha_test_value':1.0,'is_signed':False})
shutil.copyfile(ROOT/'output/vpx-v1/finni-fox-atlas.png',WORK/'images/finni-fox-atlas.png')
images.append({'name':'finni-fox-atlas','path':'finni-fox-atlas.png','alpha_test_value':1.0,'is_signed':False})

def export_obj(name,objects,fox=False):
    # VPXTOOL's OBJ convention flips local Y/Z; source primitives use size=100.
    verts=[];uvs=[];normals=[];faces=[];deps=bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
        transform=obj.matrix_world.copy()
        if fox:
            pivot=obj.matrix_world.copy();pivot.translation.z+=.0215
            transform=pivot.inverted()@obj.matrix_world
        normal_matrix=transform.to_3x3().inverted().transposed()
        offset=len(verts)
        for v in mesh.vertices:
            p=(transform@v.co)/.053975;verts.append((p.x,-p.y,-p.z))
        for triangle in mesh.loop_triangles:
            entries=[]
            mi=mesh.polygons[triangle.polygon_index].material_index
            m=mesh.materials[mi] if mesh.materials else None
            colorindex=palette_names.index(m.name) if m and m.name in palette_names else 0
            for li in triangle.loops:
                if fox and mesh.uv_layers.active:uv=tuple(mesh.uv_layers.active.data[li].uv)
                else:uv=((colorindex%8+.5)/8,1-(colorindex//8+.5)/8)
                normal=(normal_matrix@mesh.corner_normals[li].vector).normalized()
                uvs.append(uv);normals.append((normal.x,-normal.y,-normal.z));ti=len(uvs)
                entries.append(f'{offset+mesh.loops[li].vertex_index+1}/{ti}/{ti}')
            faces.append(entries)
        evaluated.to_mesh_clear()
    lines=['# Finni live VPX replacement',f'o {name}']
    lines.extend('v '+' '.join(f'{c:.9g}' for c in p) for p in verts)
    lines.extend('vt '+' '.join(f'{c:.9g}' for c in p) for p in uvs)
    lines.extend('vn '+' '.join(f'{c:.9g}' for c in p) for p in normals)
    lines.extend('f '+' '.join(p) for p in faces)
    (WORK/'gameitems'/f'Primitive.{name}.obj').write_text('\n'.join(lines)+'\n')
    return len(faces)

parts={}
for name in ('LilHead','LilLeftArm','LilRightArm','Primitive077'):
    path=WORK/'gameitems'/f'Primitive.{name}.json';p=json.loads(path.read_text())['Primitive']
    p['image']='finni-fox-atlas';p['position']['z']+=.0215/.00053975
    p['is_collidable']=False;p['is_toy']=True;p['use_3d_mesh']=True;p['mesh_file_name']=name+'.obj'
    parts[name]=export_obj(name,[bpy.data.objects[name]],fox=True)
    path.write_text(json.dumps({'Primitive':p},indent=2))

for name,prefix in [('FinniCake','Party cake'),('FinniBalloons','Party balloon'),('FinniWireRamp','Party wire ramp'),('FinniSlingCovers','Party sling cover')]:
    objects=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith(prefix) and not o.hide_render]
    p=copy.deepcopy(template);p.update(name=name,position={'x':0.,'y':0.,'z':0.},size={'x':100.,'y':100.,'z':100.},
        rot_and_tra=[0.]*9,image='finni-party-palette',material='Toys',
        is_visible=True,is_collidable=False,is_toy=True,static_rendering=True,use_3d_mesh=True,mesh_file_name=name+'.obj')
    assert objects, f'Missing replacement geometry: {prefix}'
    if name == 'FinniWireRamp':
        p.update(image='', material='Metal')
    parts[name]=export_obj(name,objects)
    filename=f'Primitive.{name}.json';(WORK/'gameitems'/filename).write_text(json.dumps({'Primitive':p},indent=2))
    items.append({'file_name':filename,'is_locked':False,'editor_layer':0,'editor_layer_name':'Finni replacement visuals','editor_layer_visibility':True})

# Match the saved scene's visibility, while retaining every collision flag.
for entry in items:
    path=WORK/'gameitems'/entry['file_name'];data=json.loads(path.read_text());kind=next(iter(data));obj=data[kind];name=obj['name']
    if kind=='Wall':
        for suffix,key in [('Top','is_top_bottom_visible'),('Side','is_side_visible')]:
            scene_obj=bpy.data.objects.get(name+suffix)
            if scene_obj and scene_obj.hide_render:obj[key]=False
    elif kind in ('Primitive','Ramp'):
        scene_obj=bpy.data.objects.get(name)
        if scene_obj and scene_obj.hide_render:obj['is_visible']=False
    elif kind=='Bumper':obj['is_base_visible']=False
    elif kind=='Flasher' and name=='LightInserts':obj['is_visible']=False
    path.write_text(json.dumps(data,indent=2))

# Replace textures by their existing VPX names, retaining all original UVs.
def replace_image(name,file):
    meta=next(i for i in images if i['name']==name)
    for old in (WORK/'images').glob(name+'.*'):old.unlink()
    destination=WORK/'images'/(name+'.png');shutil.copyfile(file,destination);meta['path']=name+'.png'
replace_image('pf',ART/'finni-playfield-base.png')
replace_image('backwall',ART/'back-panel.png')
for name in ('plastics','plastics2'):
    file=next((WORK/'images').glob(name+'.*'));im=Image.open(file).convert('RGBA')
    flat=Image.new('RGBA',im.size,(56,117,31,255));flat.putalpha(im.getchannel('A'));flat.save(file)
for name in ('hellhouse','spinner','spinnerw','target-snikt','target','droptarget','chibitarget','Cabinet_Sides','Cabinet_Sides black','flipperltop','flipperrtop','flipperx'):
    matches=list((WORK/'images').glob(name+'.*'))
    if matches:
        im=Image.open(matches[0]).convert('RGBA')
        color=(56,117,31,255) if 'Cabinet' in name else (255,240,205,255) if 'flipper' in name else (237,118,47,255)
        flat=Image.new('RGBA',im.size,color);flat.putalpha(im.getchannel('A'));flat.save(matches[0])
if (WORK/'images/backdrop.webp').exists():Image.new('RGB',Image.open(WORK/'images/backdrop.webp').size,(8,12,16)).save(WORK/'images/backdrop.webp')
for patch in (ART/'vpx-light-overrides').glob('*.json'):
    target=WORK/'gameitems'/('Light.'+patch.stem+'.json')
    if target.exists():shutil.copyfile(patch,target)
lighting=runpy.run_path(str(ROOT/'scripts/apply-finni-lighting.py'))['install'](WORK)
(WORK/'gameitems.json').write_text(json.dumps(items,indent=2));(WORK/'images.json').write_text(json.dumps(images,indent=2))
runpy.run_path(str(ROOT/'scripts/build-party-supply-icons.py'))['install'](WORK)
dmd_assets=runpy.run_path(str(ROOT/'scripts/build-finni-dmd.py'))['install'](WORK)
gamedata=json.loads((WORK/'gamedata.json').read_text())
gamedata['bg_view_mode_desktop']='legacy';gamedata['bg_rotation_desktop']=0.
(WORK/'gamedata.json').write_text(json.dumps(gamedata,indent=2))
# Retain existing sound IDs; add approved story and ball-save cues.
party_audio=runpy.run_path(str(ROOT/'scripts/build-party-audio.py'))
audio_dir=ROOT/'output/party-audio'
party_audio['build'](audio_dir)
audio_count=party_audio['install'](WORK,audio_dir)
voice=runpy.run_path(str(ROOT/'scripts/build-finni-callouts.py'))
voice_dir=ROOT/'output/finni-voice'
voice['build'](voice_dir)
voice_count=voice['install'](WORK,voice_dir)
music=runpy.run_path(str(ROOT/'scripts/apply-music-trial.py'))
music_count=music['install'](WORK)
tuning=runpy.run_path(str(ROOT/'scripts/apply-gameplay-tuning.py'))
tuning['install'](WORK)
configuration=json.loads((ROOT/'design/current-assets.json').read_text())
if configuration.get('appearance')=='comic-party-prep':
    appearance=runpy.run_path(str(ROOT/'scripts/apply-comic-appearance.py'))['install'](WORK,palette_names,configuration)
    (OUT/'appearance-report.json').write_text(json.dumps(appearance,indent=2))
runpy.run_path(str(ROOT/'scripts/apply-finni-lighting.py'))['install_visuals'](WORK)
# VPX can prefer a neighboring VBS over the embedded script. Keep it in sync.
shutil.copyfile(WORK/'script.vbs',OUT/'Finni-Big-Day.vbs')
# Source rules, lock collision geometry and the real bobble routine must survive.
assert (WORK/'script.vbs').read_bytes()==tuning['tuned_script']((SOURCE/'script.vbs').read_bytes())
for name in ('Ramp012','Ramp013'):
    filename='Ramp.'+name+'.json'
    a=json.loads((SOURCE/'gameitems'/filename).read_text())['Ramp'];b=json.loads((WORK/'gameitems'/filename).read_text())['Ramp']
    for key in ('drag_points','is_collidable','height_bottom','height_top'):assert a[key]==b[key],(name,key)
for filename in ('Wall.Leftslingshot.json', 'Wall.Rightslingshot.json'):
    assert json.loads((SOURCE/'gameitems'/filename).read_text()) == json.loads((WORK/'gameitems'/filename).read_text()), filename
for path in (SOURCE/'gameitems').glob('Rubber.*Sling*.json'):
    assert json.loads(path.read_text()) == json.loads((WORK/'gameitems'/path.name).read_text()), path.name
(OUT/'build-report.json').write_text(json.dumps({'meshes':parts,'finni_dmd':dmd_assets,'party_audio_replacements':audio_count,'finni_voice_slots':voice_count,'music_trial_slots':music_count,'source_script_changes':['approved HellHouse scoop kick: 164, 12, 0','small aligned lock-ramp entrance assist (18 entry / 24 climb speed)','Cake Time / Friendship display and voice cues','Ball saved voice on the existing save display','seven approved party-task DMD titles, instructions and completion cues','complete Finni DMD scenes, icons and secondary-feature presentation'],'all_other_script_bytes_unchanged':True,'lock_collisions_unchanged':True,'slingshot_collisions_and_animation_unchanged':True,'sling_covers':'plain rounded triangles over original mounting posts','fox_animation':'original Target012_Hit / LilDPShake / lilShakeTimer'},indent=2))
print('LIVE_ASSETS_READY',json.dumps(parts),flush=True)
print('FINNI_LIGHTING',len(lighting),'lamps and flashers; runtime palette and shows themed',flush=True)
