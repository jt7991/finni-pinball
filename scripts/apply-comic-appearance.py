"""Install the approved comic hardware palette and readable table-wide fill."""
from pathlib import Path
import copy,json,math,runpy
from PIL import Image,ImageDraw

def round_gi_outline(light):
    obj=copy.deepcopy(light)
    point=light['drag_points'][0]
    radius=light['falloff_radius']*1.08
    obj['drag_points']=[]
    for i in range(48):
        p=copy.deepcopy(point)
        p.update(x=light['center']['x']+radius*math.cos(i*math.tau/48),
                 y=light['center']['y']+radius*math.sin(i*math.tau/48),smooth=True)
        obj['drag_points'].append(p)
    return obj

def fill_light(template,spec):
    obj=copy.deepcopy(template)
    obj.update(name=spec['name'],center={'x':spec['x'],'y':spec['y']},
        falloff_radius=spec['radius'],falloff_power=2.0,intensity=spec['intensity'],
        state_u32=1,state=1.0,color='#182329',color2='#eff8ff',
        surface='',height=0.0,bulb_halo_height=spec['height'],
        transmission_scale=0.0,show_bulb_mesh=False,has_static_bulb_mesh=False,
        show_reflection_on_ball=False,is_timer_enabled=False,image='')
    point=template['drag_points'][0]
    obj['drag_points']=[]
    for i in range(32):
        p=copy.deepcopy(point)
        p.update(x=spec['x']+spec['radius']*math.cos(i*math.tau/32),
                 y=spec['y']+spec['radius']*math.sin(i*math.tau/32),smooth=True)
        obj['drag_points'].append(p)
    return obj

def install(extracted, palette_names, configuration):
    extracted=Path(extracted)
    images=json.loads((extracted/'images.json').read_text())
    for name in ('Cabinet_Sides','Cabinet_Sides black'):
        entry=next((e for e in images if e['name']==name),None)
        if not entry:continue
        source=next((extracted/'images').glob(name+'.*'))
        alpha=Image.open(source).convert('RGBA').getchannel('A')
        image=Image.new('RGBA',alpha.size,(20,38,81,255));image.putalpha(alpha)
        image.save(extracted/'images'/(name+'.png'));entry['path']=name+'.png'
    (extracted/'images.json').write_text(json.dumps(images,indent=2))
    file=extracted/'images/finni-party-palette.png'
    palette=Image.open(file).convert('RGB');draw=ImageDraw.Draw(palette)
    def fill(index,rgb):
        draw.rectangle(((index%8)*64,(index//8)*64,(index%8+1)*64-1,(index//8+1)*64-1),fill=rgb)
    for name,rgb in [('Party | peach balloon',(244,111,79)),('Party | lilac balloon',(73,188,235)),('Party | mint balloon',(255,212,85))]:
        fill(palette_names.index(name),rgb)
    slots={}
    for name,rgb in [('pink-cake',(255,32,133)),('pink-balloon',(255,0,112)),('blue-balloon',(0,112,255)),('yellow-balloon',(255,230,0))]:
        index=len(palette_names)+len(slots);assert index<64
        slots[name]=index;fill(index,rgb)
    palette.save(file)
    def recolor_mesh(name,mapping):
        file=extracted/'gameitems'/('Primitive.'+name+'.obj')
        before=file.read_text();lines=[];changed=0
        for line in before.splitlines():
            if line.startswith('vt '):
                u,v=map(float,line.split()[1:3])
                for old,new in mapping.items():
                    if abs(u-(old%8+.5)/8)<.00001 and abs(v-(1-(old//8+.5)/8))<.00001:
                        line=f'vt {(new%8+.5)/8:.9g} {1-(new//8+.5)/8:.9g}';changed+=1;break
            lines.append(line)
        assert changed,name
        after='\n'.join(lines)+'\n'
        assert [s for s in before.splitlines() if not s.startswith('vt ')]==[s for s in after.splitlines() if not s.startswith('vt ')]
        file.write_text(after)
        return changed
    cake=recolor_mesh('FinniCake',{palette_names.index('Party | lavender icing'):slots['pink-cake']})
    balloons=recolor_mesh('FinniBalloons',{
        palette_names.index('Party | peach balloon'):slots['pink-balloon'],
        palette_names.index('Party | lilac balloon'):slots['blue-balloon'],
        palette_names.index('Party | mint balloon'):slots['yellow-balloon']})
    file=extracted/'gamedata.json';data=json.loads(file.read_text())
    for key,value in configuration['table_lighting'].items():
        assert key in ('light_ambient','global_emission_scale','light0_emission')
        data[key]=value
    # The old outdoor backglass texture is not part of the comic world.
    data['backglass_image_full_desktop']=''
    data['backdrop_color']='#090f22'
    file.write_text(json.dumps(data,indent=2))
    items=json.loads((extracted/'gameitems.json').read_text())
    template=json.loads((extracted/'gameitems/Light.gi001.json').read_text())['Light']
    rounded_gi=[]
    # Legacy GI polygons were cropped tightly to the old plastics. Their flat
    # edges cut through the glow on the new art. Extend only these decorative
    # light contours beyond their falloff, leaving the radial edge to fade out.
    for path in (extracted/'gameitems').glob('Light.gi*.json'):
        original=json.loads(path.read_text())['Light']
        path.write_text(json.dumps({'Light':round_gi_outline(original)},indent=2))
        rounded_gi.append(original['name'])
    for spec in configuration.get('center_fill',[]):
        filename='Light.'+spec['name']+'.json'
        (extracted/'gameitems'/filename).write_text(json.dumps({'Light':fill_light(template,spec)},indent=2))
        if not any(i['file_name']==filename for i in items):
            items.append({'file_name':filename,'is_locked':False,'editor_layer':0,
                'editor_layer_name':'Finni center illumination','editor_layer_visibility':True})
    (extracted/'gameitems.json').write_text(json.dumps(items,indent=2))
    plastics=runpy.run_path(str(Path(__file__).with_name('build-party-plastics.py')))['install'](extracted)
    return {'party_plastics':plastics,'cake_material_coordinates':cake,'balloon_material_coordinates':balloons,
        'lighting':configuration['table_lighting'],'center_fill':configuration.get('center_fill',[]),'rounded_gi':rounded_gi,
        'collisions_and_mesh_vertices_unchanged':True}
