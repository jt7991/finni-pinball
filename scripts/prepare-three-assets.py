"""Create the small, versioned Three.js assets from the accepted table sources.

Run with the bundled Blender Python, which has Pillow available via .tools/pydeps.
The extracted VPX is needed to rebuild geometry, never to play the experiment.
"""
import json
import shutil
import sys
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root',type=Path,default=ROOT,help='Read local extracted sources/tools here; outputs always stay in this worktree.')
SOURCE_ROOT=parser.parse_args().source_root.resolve()
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

source = SOURCE_ROOT / '.work/finni-live-extracted/gameitems'
materials={m['name']:m for m in json.loads((source.parent/'materials.json').read_text())}
items = []
for path in sorted(source.glob('*.json')):
    data = json.loads(path.read_text())
    kind, item = next(iter(data.items()))
    if kind == 'Wall' and item.get('is_collidable'):
        items.append({'kind': kind, **{k: item[k] for k in ('name', 'height_bottom', 'height_top', 'is_bottom_solid', 'slingshot_force', 'slingshot_threshold', 'elasticity', 'friction', 'elasticity_falloff', 'scatter', 'physics_material', 'overwrite_physics', 'drag_points')}})
    elif kind in ('Bumper', 'Flipper', 'Plunger') or kind == 'Kicker' and item['name'] == 'HellHouse':
        items.append({'kind': kind, **item})
    elif kind == 'Ramp' and item.get('is_collidable'):
        items.append({'kind': kind, **item})

for item in items:
    if item['kind'] in ('Wall','Ramp'):
        material=materials.get(item.get('physics_material'))
        item['contact_physics']={k:(material[k if k!='scatter' else 'scatter_angle'] if material and not item.get('overwrite_physics') else item.get(k,0)) for k in ('elasticity','elasticity_falloff','friction','scatter')}
    if 'drag_points' in item:
        item['drag_points'] = [{k: round(p[k], 4) if type(p[k]) is float else p[k]
                                for k in ('x', 'y', 'smooth', 'is_slingshot', *(['z'] if item['kind']=='Ramp' else []))} for p in item['drag_points']]
gamedata=json.loads((source.parent/'gamedata.json').read_text())
# vpxtool OBJ coordinates already include the primitive's 1/100 mesh scale;
# OBJ reverses Z. This table's playfield primitive has identity transforms.
playfield={'vertices':[],'indices':[]}
for line in (source/'Primitive.playfield_mesh.obj').read_text().splitlines():
    if line.startswith('v '):
        x,y,z=map(float,line.split()[1:4])
        playfield['vertices'].extend([x,21.15-y,-z])
    elif line.startswith('f '):
        face=[int(p.split('/')[0])-1 for p in line.split()[1:]]
        for i in range(1,len(face)-1):playfield['indices'].extend([face[0],face[i],face[i+1]])
data = {'width': 952, 'height': 2115, 'scale': 0.01,
        'physics':{'gravity':gamedata['gravity'],'slope':gamedata['angle_tilt_min'],
                   'friction':gamedata['friction'],'elasticity':gamedata['elasticity'],
                   'elasticity_falloff':gamedata['elastic_falloff'],'scatter':gamedata['scatter'],
                   'default_scatter':gamedata['default_scatter'],'difficulty':gamedata['global_difficulty']},'playfield':playfield,'items': items}
(OUT / 'layout.json').write_text(json.dumps(data, separators=(',', ':')))
specs=[]
target_shapes={}
for target_type,file,prefix in [('drop_target_simple','dropTargetT3Mesh.h','hitTargetT3'),('hit_target_rectangle','hitTargetRectangleMesh.h','hitTargetRectangle')]:
    header=(ROOT/'references/vpx-physics/meshes'/file).read_text()
    vertex_body=re.search(prefix+r'Mesh\[[^]]+\]\s*=\s*\{(.*?)\};',header,re.S)[1]
    vertices=[list(map(float,re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?',line)))[:3] for line in re.findall(r'\{([^{}]+)\}',vertex_body)]
    indices=list(map(int,re.findall(r'\d+',re.search(prefix+r'Indices\[[^]]+\]\s*=\s*\{(.*?)\};',header,re.S)[1])))
    target_shapes[target_type]={'vertices':vertices,'indices':indices}
for path in sorted(source.glob('*.json')):
    kind,item=next(iter(json.loads(path.read_text()).items()))
    specs.append({'kind':kind,**{k:v for k,v in item.items() if k in (
        'name','center','position','rot_z','rotation','radius','shape','drag_points',
        'height','height_bottom','height_top','is_collidable','is_enabled','is_visible','size','target_type','collection','update_interval',
        'is_dropped','state','state_u32','color','color2','intensity','blink_interval',
        'is_timer_enabled','timer_interval','surface','hit_height','width','length')}})
    if kind=='HitTarget':
        specs[-1].update({k:item[k] for k in ('is_legacy','use_hit_event','threshold','drop_speed','raise_delay')})
        material=materials.get(item.get('physics_material'))
        specs[-1]['contact_physics']={k:(material[k if k!='scatter' else 'scatter_angle'] if material and not item.get('overwrite_physics') else item.get(k,0)) for k in ('elasticity','elasticity_falloff','friction','scatter')}
        shape=target_shapes[item['target_type']]
        specs[-1]['collision_mesh']=shape
    if 'drag_points' in specs[-1]:specs[-1]['drag_points']=[{'x':p['x'],'y':p['y']} for p in specs[-1]['drag_points']]
(OUT/'objects.json').write_text(json.dumps({'objects':specs,'collections':json.loads((source.parent/'collections.json').read_text())},separators=(',',':')))
script=(source.parent/'script.vbs').read_text()
# The game script is retained in full; only its native-host bootstrap is adapted.
import re
script=re.sub(r'Sub LoadCoreFiles\b.*?End Sub', 'Sub LoadCoreFiles\nEnd Sub',script,flags=re.S|re.I)
script=script.replace('Set plungerIM = New cvpmImpulseP','Set plungerIM = HostPlunger')
script=script.replace('ReDim rolling(tnob)','Dim rolling()\nReDim rolling(tnob)')
script=script.replace('Len(TempStr)> Space(dCharsPerLine(id) )','Len(TempStr)> dCharsPerLine(id)')
script=script.replace('Left(TempStr, Space(dCharsPerLine(id) ) )','Left(TempStr, dCharsPerLine(id) )')
script=script.replace('set RainbowLights = n','RainbowLights = n')
script=re.sub(r'Sub LilDPInit\b.*?End Sub','Sub LilDPInit\nEnd Sub',script,flags=re.S|re.I)
# Physical toy bobble is animated by Three.js rather than three invisible VPX balls.
script=re.sub(r'Sub LilDPShake\(strength\).*?End Sub','Sub LilDPShake(strength)\n HostShake strength\nEnd Sub',script,flags=re.S|re.I)
script=re.sub(r'Sub lilShakeTimer_Timer\b.*?End Sub','Sub lilShakeTimer_Timer\nEnd Sub',script,flags=re.S|re.I)
# The JS host omits the three bobble balls. GetBalls therefore starts directly
# with playable balls; retain the original 10ms spin/speed controller and audio.
script=script.replace('Const lob = 3','Const lob = 0')
script=re.sub(r'^Sub FlashForMs\(MyLight, TotalPeriod, BlinkPeriod, FinalState\).*?^End Sub',
              'Sub FlashForMs(MyLight, TotalPeriod, BlinkPeriod, FinalState)\n HostFlash MyLight, TotalPeriod, BlinkPeriod, FinalState\nEnd Sub',script,flags=re.S|re.I|re.M)
(OUT/'rules.vbs').write_text(script)
shutil.copyfile(ROOT/'runtime/dmd-atlas.json',OUT/'dmd-atlas.json')
shutil.copyfile(ROOT/'runtime/dmd-atlas.png',OUT/'dmd-atlas.png')
print('Prepared playfield and layout:', image.size, len(items), 'objects')
