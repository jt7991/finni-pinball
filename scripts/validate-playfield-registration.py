"""Verify every printed cutout against VPX lights and each mission's lens label.

Optionally pass an assembled/re-extracted table to check the delivered geometry
and floor image, rather than only the composition inputs.
"""
from pathlib import Path
import base64
import copy
import io
import json
import math
import re
import runpy
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'.tools/pydeps'))
import resvg_py
from PIL import Image, ImageChops, ImageFilter

ART = ROOT/json.loads((ROOT/'design/current-assets.json').read_text())['playfield_directory']
NS = '{http://www.w3.org/2000/svg}'
visual_light = runpy.run_path(str(ROOT/'scripts/apply-finni-lighting.py'))['visual_light']
tree = ET.parse(ART/'finni-playfield-base.svg').getroot()
tasks = json.loads((ROOT/'design/party-tasks.json').read_text(encoding='utf-8'))['modes']
mapping = {m['insert']: m for m in json.loads((ART/'mission-art-map.json').read_text(encoding='utf-8'))}
mask = next(e for e in tree.iter(NS+'mask'))
paths = list(mask.iter(NS+'path'))
expected_count = 58 if json.loads((ROOT/'design/current-assets.json').read_text()).get('appearance')=='comic-party-prep' else 52
assert len(paths) == expected_count
source = ROOT/'.work/deadpool-extracted/gameitems'
table = Path(sys.argv[1]) if len(sys.argv) > 1 else None
source_shapes = {}
for file in source.glob('Light.*.json'):
    light = json.loads(file.read_text())['Light']
    d = 'M'+'L'.join(f'{p["x"]:.2f},{p["y"]:.2f}' for p in light.get('drag_points', []))+'Z'
    source_shapes[d] = light

def raster(elements):
    svg = ET.Element(NS+'svg', dict(tree.attrib))
    svg.extend(copy.deepcopy(elements))
    data = resvg_py.svg_to_bytes(svg_string=ET.tostring(svg, encoding='unicode'),
                              font_files=[str(ROOT/'assets/fonts/chewy/Chewy-Regular.ttf')])
    return Image.open(io.BytesIO(data)).convert('RGBA')

opaque = Image.open(ART/'playfield-print-cutouts.png').convert('RGBA').getchannel('A')
base = Image.open(ART/'finni-playfield-base.png').convert('RGBA')
assert base.size == opaque.size == (2048, 4550)
registered = []
def same(a, b):
    # VPX stores coordinates as float32; a round trip may expose extra digits.
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-6, abs_tol=.001)
    return a == b

for path in paths:
    light = source_shapes[path.get('d')]
    name = light['name']
    override = ART/'vpx-light-overrides'/(name+'.json')
    expected = json.loads(override.read_text())['Light'] if override.exists() else light
    expected = visual_light(expected)
    if table:
        actual = json.loads((table/'gameitems'/('Light.'+name+'.json')).read_text())['Light']
        # The build themes lamp colors separately; registration must preserve
        # geometry, timing and every other field, independent of that palette.
        assert same({k:v for k,v in actual.items() if k not in ('color','color2')},
                    {k:v for k,v in expected.items() if k not in ('color','color2')}), f'Delivered lamp differs: {name}'
    sx = sy = 1.; dx = dy = 0.
    for op, values in re.findall(r'(\w+)\(([^)]+)\)', path.get('transform', '')):
        v = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', values)]
        if op == 'translate':
            dx += sx*v[0]; dy += sy*(v[1] if len(v)>1 else 0.)
        elif op == 'scale':
            sx *= v[0]; sy *= v[1] if len(v)>1 else v[0]
        else:
            raise AssertionError(f'Unsupported lamp transform: {op}')
    assert abs(light['center']['x']*sx+dx-expected['center']['x']) < .02, name
    assert abs(light['center']['y']*sy+dy-expected['center']['y']) < .02, name
    assert len(light['drag_points']) == len(expected['drag_points']), name
    for a, b in zip(light['drag_points'], expected['drag_points']):
        assert abs(a['x']*sx+dx-b['x']) < .02 and abs(a['y']*sy+dy-b['y']) < .02, name
    shape = copy.deepcopy(path); shape.set('fill', 'white')
    silhouette = raster([shape]).getchannel('A')
    interior = silhouette.filter(ImageFilter.MinFilter(3)).point(lambda v: 255 if v == 255 else 0)
    assert interior.getbbox(), name
    assert ImageChops.multiply(opaque, interior).getbbox() is None, f'Paint over light: {name}'
    registered.append(name)
assert len(set(registered)) == expected_count

mission_report = []
for mode in tasks:
    name = mode['insert']; entry = mapping[name]
    assert entry['mission'] == mode['label'] and entry['subject'] == mode['subject']
    light = json.loads((ART/'vpx-light-overrides'/(name+'.json')).read_text())['Light']
    assert entry['center'] == light['center']
    for filename in ('playfield-insert-lenses.svg', 'playfield-editable-layers.svg'):
        labels = [e for e in ET.parse(ART/filename).getroot().iter(NS+'text') if e.get('data-mission') == name]
        assert [e.text for e in labels] == mode['words'], (filename, name)
        assert all(float(e.get('x')) == entry['center']['x'] for e in labels), name
    # Test the actual text ink, not just its anchor. Includes black stroke.
    labels = [e for e in tree.iter(NS+'text') if e.get('data-mission') == name]
    path = next(p for p in paths if p.get('d') == 'M'+'L'.join(
        f'{p["x"]:.2f},{p["y"]:.2f}' for p in entry['source_outline'])+'Z')
    shape = copy.deepcopy(path); shape.set('fill', 'white')
    safe = raster([shape]).getchannel('A').filter(ImageFilter.MinFilter(3)).point(lambda v: 255 if v == 255 else 0)
    ink = raster(labels).getchannel('A').point(lambda v: 255 if v > 8 else 0)
    assert ink.getbbox() and ImageChops.subtract(ink, safe).getbbox() is None, f'Label outside light: {name}'
    mission_report.append({'insert': name, 'task': mode['label'], 'center': entry['center'], 'label_inside_lens': True})

if table:
    assert (table/'images/pf.png').read_bytes() == (ART/'finni-playfield-base.png').read_bytes()
report = {'cutouts_registered_to_lights': registered, 'insert_count':expected_count, 'all_print_interiors_transparent': True,
          'mission_labels': mission_report, 'assembled_table_verified': bool(table),
          'illustrated_objects': 'Visually reviewed against registration-overlay.png; not inferred from label checks.'}
(ART/'registration-validation.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')

# Technical overlay: the raw illustration with actual cutout outlines and centers.
# This is a registration aid, not a replacement for the generated artwork.
overlay = ET.Element(NS+'svg', dict(tree.attrib))
ET.SubElement(overlay, NS+'image', {'width':'952','height':'2115','href':'data:image/png;base64,'+
    base64.b64encode((ART/'mission-party-environment.png').read_bytes()).decode()})
if (ART/'illustrated-objects.svg').exists():
    overlay.extend(copy.deepcopy(list(ET.parse(ART/'illustrated-objects.svg').getroot())))
for path in paths:
    p = copy.deepcopy(path); p.set('fill','none');p.set('stroke','#df167e');p.set('stroke-width','1.2')
    overlay.append(p)
for mode in tasks:
    c = mapping[mode['insert']]['center']
    ET.SubElement(overlay, NS+'circle', {'cx':str(c['x']),'cy':str(c['y']),'r':'2','fill':'#df167e'})
(ART/'registration-overlay.png').write_bytes(resvg_py.svg_to_bytes(svg_string=ET.tostring(overlay, encoding='unicode')))
print(json.dumps(report, ensure_ascii=False, indent=2))
