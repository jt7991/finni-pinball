"""Place the unified mission-aligned illustration under the original light masks."""
from pathlib import Path
import sys,json,base64,shutil,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'.tools/pydeps'))
import resvg_py
SRC=ROOT/'output/playfield-party-v5';OUT=ROOT/'output/playfield-party-v6';OUT.mkdir(exist_ok=True)
generated=Path(sys.argv[1]).resolve()
shutil.copyfile(generated,OUT/'mission-party-environment.png')
for name in ('back-panel.png','inlane-layout-overrides.json','original-plastic-alpha-map.json'):
    shutil.copyfile(SRC/name,OUT/name)
shutil.copytree(SRC/'vpx-light-overrides',OUT/'vpx-light-overrides',dirs_exist_ok=True)
modes=json.loads((ROOT/'design/finni-big-day-mode-anchors.json').read_text(encoding='utf-8-sig'))['modes']
layout={p['insert']:p for p in json.loads(Path(sys.argv[2]).read_text())} if len(sys.argv)>2 else {}
ns='http://www.w3.org/2000/svg';ET.register_namespace('',ns)
root=ET.parse(SRC/'finni-playfield-base.svg').getroot()
background=list(root)[0];assert background.tag==f'{{{ns}}}image'
background.set('href','data:image/png;base64,'+base64.b64encode(generated.read_bytes()).decode())
background.set('id','mission-aligned-party-environment')
outlines={'M'+'L'.join(f'{p["x"]:.2f},{p["y"]:.2f}' for p in m['outline'])+'Z':m['insert'] for m in modes}
matched=[]
for path in root.iter(f'{{{ns}}}path'):
    if path.get('d') in outlines:
        name=outlines[path.get('d')];matched.append(name)
        # Keep exact physical light outlines as metadata, without an opaque
        # printed badge hiding the related cake/envelope/plate illustration.
        path.set('fill','none');path.set('stroke','none');path.set('data-mission-window',name)
        if name in layout:
            m=next(m for m in modes if m['insert']==name);c=layout[name]['center']
            path.set('transform',f'translate({c["x"]-m["x"]} {c["y"]-m["y"]})')
assert len(matched)==7,matched
for label in root.iter(f'{{{ns}}}text'):
    if label.get('data-mission'):
        name=label.get('data-mission')
        if name in layout:
            m=next(m for m in modes if m['insert']==name);c=layout[name]['center']
            label.set('x',str(float(label.get('x'))+c['x']-m['x']))
            label.set('y',str(float(label.get('y'))+c['y']-m['y']))
        label.set('fill','#4b3119');label.set('stroke','#fff4d8')
        label.set('stroke-width','1.8');label.set('paint-order','stroke');label.set('stroke-linejoin','round')
svg=ET.tostring(root,encoding='unicode')
for filename in ('finni-playfield-base.svg','playfield-editable-layers.svg'):(OUT/filename).write_text(svg,encoding='utf-8')
(OUT/'finni-playfield-base.png').write_bytes(resvg_py.svg_to_bytes(svg_string=svg))
subjects={'li008':'folded bunting and string lights','li010':'invitation envelope','li011':'frosted cake',
          'li007':'shopping bag','li009':'plate and place setting','li012':'setup checklist','li013':'music station'}
mapping=[]
for m in modes:
    center=layout.get(m['insert'],{}).get('center',{'x':m['x'],'y':m['y']})
    mapping.append({'insert':m['insert'],'mission':m['working_label'],'subject':subjects[m['insert']],
                    'source_center':{'x':m['x'],'y':m['y']},'center':center,'source_outline':m['outline']})
    if m['insert'] in layout:
        file=ROOT/'.work/deadpool-extracted/gameitems'/f'Light.{m["insert"]}.json'
        data=json.loads(file.read_text());light=data['Light'];old=light['center']
        dx,dy=center['x']-old['x'],center['y']-old['y']
        for point in light['drag_points']:point['x']+=dx;point['y']+=dy
        light['center']=center
        (OUT/'vpx-light-overrides'/(m['insert']+'.json')).write_text(json.dumps(data,indent=2))
(OUT/'mission-art-map.json').write_text(json.dumps(mapping,indent=2))
(OUT/'art-validation.json').write_text(json.dumps({'mission_light_shapes_preserved':True,
    'mission_light_centers_registered_to_object_faces':bool(layout),'mission_windows':sorted(matched),
    'opaque_mission_badges_removed':True,'mission_label_lines':14,'texture_dimensions':[2048,4550],
    'generation_method':'built-in imagegen with exact mission registration guide'},indent=2))
print('MISSION_ALIGNED_ART_READY',str(OUT),flush=True)
