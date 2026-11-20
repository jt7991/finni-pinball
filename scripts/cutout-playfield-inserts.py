"""Separate opaque party print from the registered, light-transmitting inserts.

VPX uses the assembled print/lens texture for its floor and existing dynamic
Light objects. The production print export has real alpha holes; the independent
lens layer supplies the neutral plastic visible through those holes.
"""
from pathlib import Path
import argparse, base64, copy, io, json, shutil, sys, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/pydeps'))
import resvg_py
from PIL import Image, ImageChops, ImageFilter, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--illustration', type=Path, required=True)
parser.add_argument('--output', type=Path, default=ROOT/'output/playfield-party-v10')
args = parser.parse_args()
SRC = ROOT / 'output/playfield-party-v6'
OUT = args.output.resolve()
OUT.mkdir(exist_ok=True)
if args.illustration.resolve() != OUT/'mission-party-environment.png':
    shutil.copyfile(args.illustration, OUT/'mission-party-environment.png')
for name in ('back-panel.png',
             'inlane-layout-overrides.json', 'original-plastic-alpha-map.json',
             'mission-art-map.json'):
    shutil.copyfile(SRC / name, OUT / name)
shutil.copytree(SRC / 'vpx-light-overrides', OUT / 'vpx-light-overrides', dirs_exist_ok=True)

NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
def el(tag, attrs=None):
    return ET.Element(f'{{{NS}}}{tag}', attrs or {})

original = ET.parse(SRC / 'finni-playfield-base.svg').getroot()
background = next(original.iter(f'{{{NS}}}image'))
background.set('href', 'data:image/png;base64,' + base64.b64encode(args.illustration.read_bytes()).decode())
font_file = ROOT / 'assets/fonts/chewy/Chewy-Regular.ttf'
font_measure = ImageFont.truetype(str(font_file), 1000)
mapping = json.loads((OUT / 'mission-art-map.json').read_text())
modes = json.loads((ROOT/'design/party-tasks.json').read_text(encoding='utf-8'))['modes']
tasks = {m['insert']:m for m in modes}
for m in mapping:
    m['mission'] = tasks[m['insert']]['label']
    m['subject'] = tasks[m['insert']]['subject']
(OUT/'mission-art-map.json').write_text(json.dumps(mapping, indent=2, ensure_ascii=False), encoding='utf-8')
centers = {m['insert']: m['center'] for m in mapping}
mission_words = {m['insert']:m['words'] for m in modes}
mission_lines = {}
for label in original.iter(f'{{{NS}}}text'):
    if label.text == 'Finni Fox Multiball':
        label.text = 'Cake Time Multiball'
    label.set('font-family', 'Chewy')
    label.set('font-weight', 'normal')
    label.set('fill', '#ffffff')
    label.set('stroke', '#080808')
    label.set('paint-order', 'stroke fill')
    label.set('stroke-linejoin', 'round')
    name = label.get('data-mission')
    if name:
        line = mission_lines.get(name, 0)
        mission_lines[name] = line + 1
        words = mission_words[name]
        widest = max(font_measure.getlength(w) / 1000 for w in words)
        size = min(15.0 if name == 'li013' else 13.0, 57 / widest)
        label.text = words[line]
        label.set('font-size', str(size))
        label.set('x', str(centers[name]['x']))
        label.set('stroke-width', str(size * .145))
        label.set('y', str(centers[name]['y'] + (-1.6 if line == 0 else size * .88)))
    else:
        label.set('stroke-width', str(float(label.get('font-size', '14')) * .145))
paths = [c for c in original if c.tag == f'{{{NS}}}path']
assert len(paths) == 52
mission_paths = [p for p in paths if p.get('data-mission-window')]
assert len(mission_paths) == 7

# Fit against the actual irregular lamp shape, including the black text outline.
# A width estimate alone can leave letters outside the sloping insert edges.
def raster(elements):
    svg = el('svg', dict(original.attrib))
    svg.extend(copy.deepcopy(elements))
    return Image.open(io.BytesIO(resvg_py.svg_to_bytes(
        svg_string=ET.tostring(svg, encoding='unicode'), font_files=[str(font_file)]))).convert('RGBA')

for path in mission_paths:
    name = path.get('data-mission-window')
    labels = [t for t in original.iter(f'{{{NS}}}text') if t.get('data-mission') == name]
    shape = copy.deepcopy(path)
    shape.set('fill', 'white'); shape.set('stroke', 'none')
    safe = raster([shape]).getchannel('A').filter(ImageFilter.MinFilter(3)).point(lambda v: 255 if v == 255 else 0)
    for attempt in range(24):
        ink = raster(labels).getchannel('A').point(lambda v: 255 if v > 8 else 0)
        if ImageChops.subtract(ink, safe).getbbox() is None:
            break
        size = float(labels[0].get('font-size')) * .96
        for i, label in enumerate(labels):
            label.set('font-size', str(size)); label.set('stroke-width', str(size * .145))
            label.set('y', str(centers[name]['y'] + (-1.6 if i == 0 else size * .88)))
    else:
        raise AssertionError(f'Cannot fit text within {name}')

defs = el('defs')
font_style = el('style')
font_style.text = "@font-face{font-family:'Chewy';src:url(data:font/ttf;base64," + base64.b64encode(font_file.read_bytes()).decode() + ") format('truetype');font-weight:400;}"
defs.append(font_style)
mask = el('mask', {'id': 'opaque-print-cutouts', 'maskUnits': 'userSpaceOnUse',
                  'x': '0', 'y': '0', 'width': '952', 'height': '2115',
                  'style': 'mask-type:luminance'})
mask.append(el('rect', {'width': '952', 'height': '2115', 'fill': 'white'}))
clip = el('clipPath', {'id': 'insert-windows', 'clipPathUnits': 'userSpaceOnUse'})
for p in paths:
    shape = {'d': p.get('d')}
    if p.get('transform'):
        shape['transform'] = p.get('transform')
    mask.append(el('path', dict(shape, fill='black')))
    clip.append(el('path', shape))
defs.extend([mask, clip])
for name, colors in {
    'milk': ['#fff9df', '#f2d6a0', '#b99561'],
    'amber': ['#fff0be', '#f5cb70', '#be8c39'],
    'green': ['#e6edc9', '#b5ce8c', '#718e52'],
}.items():
    gradient = el('linearGradient', {'id': 'lens-' + name, 'x1': '0', 'y1': '0', 'x2': '0.3', 'y2': '1'})
    for offset, color in zip(('0%', '58%', '100%'), colors):
        gradient.append(el('stop', {'offset': offset, 'stop-color': color}))
    defs.append(gradient)

print_layer = el('g', {'id': 'opaque-party-print', 'mask': 'url(#opaque-print-cutouts)'})
lens_layer = el('g', {'id': 'insert-lenses', 'clip-path': 'url(#insert-windows)'})
for p in paths:
    lens = copy.deepcopy(p)
    tint = 'milk' if p.get('data-mission-window') or p.get('fill') == '#fbe7b7' else 'green' if p.get('fill') == '#a9d57d' else 'amber'
    lens.set('fill', 'url(#lens-' + tint + ')')
    lens.set('stroke', '#775d39')
    lens.set('stroke-width', '1.5')
    lens_layer.append(lens)
for c in original:
    if c in paths:
        continue
    if not c.get('data-mission'):
        print_layer.append(copy.deepcopy(c))
    if c.tag != f'{{{NS}}}image':
        label = copy.deepcopy(c)
        lens_layer.append(label)

def write_svg(name, layers):
    svg = el('svg', dict(original.attrib))
    svg.append(copy.deepcopy(defs))
    svg.extend(copy.deepcopy(layers))
    text = ET.tostring(svg, encoding='unicode')
    (OUT / (name + '.svg')).write_text(text, encoding='utf-8')
    (OUT / (name + '.png')).write_bytes(resvg_py.svg_to_bytes(svg_string=text, font_files=[str(font_file)]))

write_svg('playfield-print-cutouts', [print_layer])
write_svg('playfield-insert-lenses', [lens_layer])
write_svg('finni-playfield-base', [lens_layer, print_layer])
shutil.copyfile(OUT / 'finni-playfield-base.svg', OUT / 'playfield-editable-layers.svg')

# Check actual raster transparency at every registered mission center. This
# catches a missing/inverted mask or an accidental painted label over the hole.
print_image = Image.open(OUT / 'playfield-print-cutouts.png').convert('RGBA')
lenses = Image.open(OUT / 'playfield-insert-lenses.png').convert('RGBA')
composite = Image.open(OUT / 'finni-playfield-base.png').convert('RGBA')
for m in mapping:
    x = round(m['center']['x'] / 952 * print_image.width)
    y = round(m['center']['y'] / 2115 * print_image.height)
    assert print_image.getpixel((x, y))[3] == 0, m['insert']
    assert lenses.getpixel((x, y))[3] == 255, m['insert']
    assert composite.getpixel((x, y))[3] == 255, m['insert']
report = {'insert_cutout_count': len(paths), 'mission_cutout_count': len(mission_paths),
          'mission_centers_alpha_checked': [m['insert'] for m in mapping],
          'print_layer': 'playfield-print-cutouts.png', 'lens_layer': 'playfield-insert-lenses.png',
          'vpx_floor_texture': 'finni-playfield-base.png',
          'light_geometry_and_rules_changed': False,
          'typography': 'Chewy playful bubble lettering; white fill and black outline; font embedded in SVG',
          'vpx_rendering': 'assembled print/lens floor texture beneath original dynamic Light objects'}
(OUT / 'art-validation.json').write_text(json.dumps(report, indent=2))
(OUT / 'README.md').write_text('''# Party playfield with insert cutouts

The opaque illustration has 52 alpha cutouts at the existing insert outlines,
including all seven registered mission windows. No opaque scene artwork crosses
those holes. Labels and warm neutral plastic are on the separate lens layer.

`playfield-print-cutouts.png` is the transparent print separation.
`playfield-insert-lenses.png` is the independent insert/lens separation.
`playfield-editable-layers.svg` contains both named editable groups.
`finni-playfield-base.png` assembles those layers for VPX's floor texture;
the existing dynamic Light objects illuminate the clean lens regions.
The v6 lamp positions and source gameplay remain unchanged.
The lettering uses Chewy, bundled under the Apache License 2.0 in
`assets/fonts/chewy/`. White bubbly letters have a black outline painted behind
the white fill, and each two-line mission label is fitted to its lens.
''', encoding='utf-8')
(ROOT / 'design/current-assets.json').write_text(json.dumps({
    'playfield_directory': OUT.relative_to(ROOT).as_posix(),
    'description': 'Approved party chores with object-registered light cutouts and Chewy lens labels'
}, indent=2))
print('INSERT_CUTOUTS_READY', json.dumps(report), flush=True)
