"""Create the small, versioned Three.js assets from the accepted table sources.

Run with the bundled Blender Python, which has Pillow available via .tools/pydeps.
The extracted VPX is needed to rebuild geometry, never to play the experiment.
"""
import json
import shutil
import sys
import argparse
import re
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root',type=Path,default=ROOT,help='Read local extracted sources/tools here; outputs always stay in this worktree.')
parser.add_argument('--extracted-root',type=Path,help='Read an explicitly selected unmodified extraction, rather than a shared checkout cache.')
parser.add_argument('--vpx-source',type=Path,help='Use original binary Float32 primitive meshes instead of rounded OBJ coordinates (requires olefile).')
args=parser.parse_args()
SOURCE_ROOT=args.source_root.resolve()
sys.path.insert(0, str(SOURCE_ROOT / '.tools/pydeps'))
from PIL import Image

OUT = ROOT / 'three/public'
OUT.mkdir(parents=True, exist_ok=True)
(OUT/'draco').mkdir(exist_ok=True)
for filename in ('draco_wasm_wrapper.js','draco_decoder.wasm'):
    shutil.copyfile(ROOT/'node_modules/three/examples/jsm/libs/draco/gltf'/filename,OUT/'draco'/filename)
(OUT/'licenses').mkdir(exist_ok=True)
for source_file,filename in (
    ('node_modules/three/LICENSE','Three.txt'),
    ('node_modules/@dimforge/rapier3d-compat/LICENSE','Rapier.txt'),
    ('node_modules/@devscholar/vbs-engine-js/LICENSE.md','VBScriptEngine.md'),
    ('assets/fonts/chewy/LICENSE.txt','Chewy.txt'),
    ('node_modules/three/examples/jsm/libs/draco/README.md','Draco-README.md'),
):
    shutil.copyfile(ROOT/source_file,OUT/'licenses'/filename)
art = ROOT / json.loads((ROOT / 'design/current-assets.json').read_text())['playfield_directory']
image = Image.open(art / 'finni-playfield-base.png').convert('RGB')
image.thumbnail((1024, 2048), Image.Resampling.LANCZOS)
image.save(OUT / 'playfield.webp', quality=88, method=6)
shutil.copyfile(ROOT / 'assets/fonts/chewy/Chewy-Regular.ttf', OUT / 'chewy.ttf')

source = (args.extracted_root.resolve() if args.extracted_root else SOURCE_ROOT / '.work/finni-live-extracted')/'gameitems'
materials={m['name']:m for m in json.loads((source.parent/'materials.json').read_text())}
def contact_physics(item):
    # PinTable::GetMaterial returns its zero-physics dummy material for empty
    # or missing names. The object's own values apply only with overwrite on.
    material=materials.get(item.get('physics_material'),{})
    return {k:(item.get(k,0) if item.get('overwrite_physics') else material.get(k if k!='scatter' else 'scatter_angle',0))
            for k in ('elasticity','elasticity_falloff','friction','scatter')}
source_order={item['file_name']:index for index,item in enumerate(json.loads((source.parent/'gameitems.json').read_text()))}
source_files=sorted(source/name for name in source_order)
object_order={}
native_meshes=None
if args.vpx_source:
    from native_vpx_mesh import read_meshes,transformed
    native_meshes=read_meshes(args.vpx_source)
def primitive_collision(path,item):
    """VPX Primitive::RecalculateMatrices, with vpxtool's OBJ Z reflection."""
    if native_meshes is not None:return transformed(native_meshes[item['name']],item)
    vertices=[];indices=[];rot=item['rot_and_tra'];size=item['size'];position=item['position']
    for line in path.with_suffix('.obj').read_text().splitlines():
        if line.startswith('v '):
            x,y,z=map(float,line.split()[1:4]);x*=size['x'];y*=size['y'];z*=-size['z']
            x+=rot[3];y+=rot[4];z+=rot[5]
            for axis,index in [('z',2),('y',1),('x',0),('z',8),('y',7),('x',6)]:
                a=math.radians(rot[index]);c=math.cos(a);s=math.sin(a)
                if axis=='z':x,y=x*c-y*s,x*s+y*c
                elif axis=='y':x,z=x*c+z*s,-x*s+z*c
                else:y,z=y*c-z*s,y*s+z*c
            vertices.extend([round((x+position['x'])*.01,8),round((2115-y-position['y'])*.01,8),round((z+position['z'])*.01,8)])
        elif line.startswith('f '):
            face=[int(v.split('/')[0])-1 for v in line.split()[1:]]
            for i in range(1,len(face)-1):indices.extend([face[0],face[i],face[i+1]])
    # OBJ reverses Z and its winding; reversing Y into world space restores
    # outward normals. Keep the OBJ triangle order, including native seams.
    return {'vertices':vertices,'indices':indices}
items = []
rubbers = []
for path in source_files:
    data = json.loads(path.read_text())
    kind, item = next(iter(data.items()))
    object_order[kind,item['name']]=source_order[path.name]
    if kind == 'Wall':
        items.append({'kind': kind, **{k: item[k] for k in ('name', 'is_collidable', 'hit_event', 'threshold', 'height_bottom', 'height_top', 'is_bottom_solid', 'slingshot_force', 'slingshot_threshold', 'elasticity', 'friction', 'elasticity_falloff', 'scatter', 'physics_material', 'overwrite_physics', 'drag_points')}})
    elif kind in ('Bumper', 'Flipper', 'Plunger') or kind == 'Kicker' and item['name'] == 'HellHouse':
        items.append({'kind': kind, **item})
    elif kind == 'Ramp':
        items.append({'kind': kind, **item})
    elif kind == 'Rubber':
        rubbers.append({'kind':kind,**item,'native_source_order':source_order[path.name],'contact_physics':contact_physics(item)})
    elif kind=='Primitive' and item.get('is_collidable') and not item.get('is_toy') and item['name']!='playfield_mesh':
        if not item['use_3d_mesh'] or item['collision_reduction_factor']!=0:
            raise ValueError(f"Unported native primitive collision variant: {item['name']}")
        fields=('name','position','size','rot_and_tra','hit_event','threshold','elasticity','elasticity_falloff','friction','scatter','physics_material','overwrite_physics')
        items.append({'kind':kind,**{k:item[k] for k in fields},'collision_mesh':primitive_collision(path,item)})

for item in items:
    item['native_source_order']=object_order[item['kind'],item['name']]
    if item['kind'] in ('Wall','Ramp','Primitive'):
        item['contact_physics']=contact_physics(item)
    if 'drag_points' in item:
        item['drag_points'] = [{k: p[k]
                                for k in ('x', 'y', 'smooth', 'is_slingshot', *(['z'] if item['kind']=='Ramp' else []))} for p in item['drag_points']]
gamedata=json.loads((source.parent/'gamedata.json').read_text())
# Retain the stable grid query order. Native collider insertion order alone is
# not its quadtree traversal order; keep that index as provenance for a future
# port of the native broadphase, rather than changing collision priorities.
# vpxtool OBJ coordinates already include the primitive's 1/100 mesh scale;
# OBJ reverses Z. This table's playfield primitive has identity transforms.
playfield={'vertices':[],'indices':[],'native_source_order':source_order['Primitive.playfield_mesh.json']}
for line in (source/'Primitive.playfield_mesh.obj').read_text().splitlines():
    if line.startswith('v '):
        x,y,z=map(float,line.split()[1:4])
        playfield['vertices'].extend([x,21.15-y,-z])
    elif line.startswith('f '):
        face=[int(p.split('/')[0])-1 for p in line.split()[1:]]
        for i in range(1,len(face)-1):playfield['indices'].extend([face[0],face[i],face[i+1]])
if native_meshes is not None:
    item=json.loads((source/'Primitive.playfield_mesh.json').read_text())['Primitive']
    playfield.update(transformed(native_meshes['playfield_mesh'],item))
data = {'width': 952, 'height': 2115, 'scale': 0.01,
        'cabinet':{k:gamedata[k] for k in ('left','right','top','bottom','glass_top_height','glass_bottom_height')},
        'physics':{'gravity':gamedata['gravity'],'slope':gamedata['angle_tilt_min'],
                   'friction':gamedata['friction'],'elasticity':gamedata['elasticity'],
                   'elasticity_falloff':gamedata['elastic_falloff'],'scatter':gamedata['scatter'],
                   'default_scatter':gamedata['default_scatter'],'difficulty':gamedata['global_difficulty']},'playfield':playfield,'items': items,'rubbers':rubbers}
(OUT / 'layout.json').write_text(json.dumps(data, separators=(',', ':')))
specs=[]
target_shapes={}
for target_type,file,prefix in [('drop_target_simple','dropTargetT3Mesh.h','hitTargetT3'),('hit_target_rectangle','hitTargetRectangleMesh.h','hitTargetRectangle')]:
    header=(ROOT/'references/vpx-physics/meshes'/file).read_text()
    vertex_body=re.search(prefix+r'Mesh\[[^]]+\]\s*=\s*\{(.*?)\};',header,re.S)[1]
    vertices=[list(map(float,re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?',line)))[:3] for line in re.findall(r'\{([^{}]+)\}',vertex_body)]
    indices=list(map(int,re.findall(r'\d+',re.search(prefix+r'Indices\[[^]]+\]\s*=\s*\{(.*?)\};',header,re.S)[1])))
    target_shapes[target_type]={'vertices':vertices,'indices':indices}
for path in source_files:
    kind,item=next(iter(json.loads(path.read_text()).items()))
    specs.append({'kind':kind,**{k:v for k,v in item.items() if k in (
        'name','center','position','rot_z','rot_and_tra','rotation','radius','shape','drag_points',
        'height','height_bottom','height_top','is_collidable','is_enabled','is_visible','size','target_type','collection','update_interval','pos_x','pos_y','backglass','is_backglass',
        'is_dropped','state','state_u32','color','color2','intensity','blink_interval','hit_event','threshold',
        'is_timer_enabled','timer_interval','surface','hit_height','width','length')}})
    specs[-1]['native_source_order']=source_order[path.name]
    if kind in ('Spinner','Gate'):
        specs[-1].update({k:item[k] for k in ('damping','angle_max','angle_min','elasticity','friction','scatter','gravity_factor','two_way','show_bracket') if k in item})
    if kind=='Kicker':
        specs[-1].update({k:item[k] for k in ('legacy_mode','fall_through','hit_accuracy','scatter')})
    if kind=='HitTarget':
        specs[-1].update({k:item[k] for k in ('is_legacy','use_hit_event','threshold','drop_speed','raise_delay')})
        specs[-1]['contact_physics']=contact_physics(item)
        shape=target_shapes[item['target_type']]
        specs[-1]['collision_mesh']=shape
    if 'drag_points' in specs[-1]:specs[-1]['drag_points']=[{k:p[k] for k in ('x','y',*(['smooth'] if kind in ('Trigger','Flasher') else []))} for p in specs[-1]['drag_points']]
appearance=json.loads((ROOT/'three/appearance-overrides.json').read_text())
for spec in specs:
    override=appearance['objects'].get(spec['name'])
    if override:
        if spec['kind'] not in ('Light','Primitive') or spec['kind']=='Primitive' and spec.get('is_collidable'):
            raise ValueError(f"Appearance override changes a physical object: {spec['name']}")
        if set(override)-{'position','drag_points'}:
            raise ValueError(f"Unsupported appearance fields: {spec['name']}")
        spec.update(override)
for extra in appearance['extraObjects']:
    if extra.get('is_collidable',True):raise ValueError('Decorative extras cannot introduce colliders')
    specs.append(extra)
(OUT/'objects.json').write_text(json.dumps({'objects':specs,'collections':json.loads((source.parent/'collections.json').read_text()),'sound_names':[entry['name'].lower() for entry in json.loads((source.parent/'sounds.json').read_text())]},separators=(',',':')))
script=(source.parent/'script.vbs').read_text()
# The game script is retained in full; only its native-host bootstrap is adapted.
import re
script=re.sub(r'Sub LoadCoreFiles\b.*?End Sub', 'Sub LoadCoreFiles\nEnd Sub',script,flags=re.S|re.I)
script=script.replace('Set plungerIM = New cvpmImpulseP','Set plungerIM = HostPlunger')
script=script.replace('ReDim rolling(tnob)','Dim rolling()\nReDim rolling(tnob)')
script=script.replace('Len(TempStr)> Space(dCharsPerLine(id) )','Len(TempStr)> dCharsPerLine(id)')
script=script.replace('Left(TempStr, Space(dCharsPerLine(id) ) )','Left(TempStr, dCharsPerLine(id) )')
script=script.replace('set RainbowLights = n','RainbowLights = n')
# Native event scripts bind Me to the firing timer. The JS VB engine reserves
# Me for class instances, so bind these two authored uses to their own object.
for timer in ('LilDPTimer','LilDPSpinner'):
    pattern=r'Sub '+timer+r'_Timer\b.*?End Sub'
    def bind_timer(match):
        body,count=re.subn(r'\bMe\.Enabled\b',timer+'.Enabled',match[0],flags=re.I)
        if count!=1:raise ValueError(f'Unexpected native timer alias in {timer}')
        return body
    script,count=re.subn(pattern,bind_timer,script,count=1,flags=re.S|re.I)
    if count!=1:raise ValueError(f'Missing native timer handler {timer}')
# Retain the three physical bobble balls, their authored shake/animation timer
# and original GetBalls locked-ball offset. They participate in native timing.
script=re.sub(r'^Sub FlashForMs\(MyLight, TotalPeriod, BlinkPeriod, FinalState\).*?^End Sub',
              'Sub FlashForMs(MyLight, TotalPeriod, BlinkPeriod, FinalState)\n HostFlash MyLight, TotalPeriod, BlinkPeriod, FinalState\nEnd Sub',script,flags=re.S|re.I|re.M)
(OUT/'rules.vbs').write_text(script)
shutil.copyfile(ROOT/'runtime/dmd-atlas.json',OUT/'dmd-atlas.json')
shutil.copyfile(ROOT/'runtime/dmd-atlas.png',OUT/'dmd-atlas.png')
print('Prepared playfield and layout:', image.size, len(items), 'objects')
