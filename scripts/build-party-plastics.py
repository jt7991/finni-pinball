"""Draw registered party plastics and install them without changing table physics.

Usage: python3 scripts/build-party-plastics.py --source <extracted> [--install <extracted>]
Requires Pillow and resvg_py (the same rasterizer as the playfield pipeline).
"""
import argparse
import base64
import io
import json
import math
from pathlib import Path
import random
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/pydeps'))
from PIL import Image, ImageChops, ImageFilter
import resvg_py

OUT = ROOT / 'output/party-plastics'
NAVY, INK, CREAM = '#142651', '#080f2b', '#fff1ce'
PINK, CYAN, GOLD = '#ff478e', '#40cce3', '#ffce54'
CARD = {'x': 60, 'y': 1955, 'width': 310, 'height': 120}


def uri(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()


def star(x, y, r, color, angle=0):
    points = []
    for i in range(10):
        a = angle + i * math.pi / 5 - math.pi / 2
        radius = r if i % 2 == 0 else r * .43
        points.append(f'{x + math.cos(a)*radius:.2f},{y + math.sin(a)*radius:.2f}')
    return f'<polygon points="{" ".join(points)}" fill="{color}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'


def gift(x, y, s, color, angle=0):
    return f'''<g transform="translate({x} {y}) rotate({angle}) scale({s})" stroke="{INK}" stroke-width="3" stroke-linejoin="round">
    <rect x="-27" y="-18" width="54" height="47" rx="4" fill="{color}"/>
    <path d="M-22 -19 Q-40 -45 -18 -40 Q-3 -39 0 -19 Q4 -46 22 -40 Q42 -28 0 -19" fill="{CYAN}"/>
    <rect x="-31" y="-23" width="62" height="13" rx="3" fill="{color}"/>
    <path d="M-5 -22 H5 V29 H-5Z" fill="{CREAM}" stroke="none"/>
    <path d="M-19 0 l5 4 m25 13 l5 -5" stroke="{CREAM}"/>
    </g>'''


def balloon(x, y, s, color, angle=0):
    return f'''<g transform="translate({x} {y}) rotate({angle}) scale({s})" stroke="{INK}" stroke-width="3">
    <path d="M0 24 C-18 44 20 46 0 68" fill="none" stroke="{CREAM}"/>
    <ellipse cx="0" cy="-5" rx="22" ry="29" fill="{color}"/>
    <path d="M-12 -15 Q-14 -22 -6 -25" fill="none" stroke="{CREAM}" stroke-width="4" stroke-linecap="round"/>
    <path d="M0 23 l-5 8 h10Z" fill="{color}"/></g>'''


def artwork(card_path):
    parts = [f'<rect width="952" height="2115" fill="{NAVY}"/>']
    # Quiet halftone beneath larger, individually placed party objects.
    parts.append('<g fill="#26416c">')
    for y in range(0, 2115, 14):
        for x in range(0, 952, 14):
            parts.append(f'<circle cx="{x + (7 if y%28 else 0)}" cy="{y}" r="1.4"/>')
    parts.append('</g>')
    rng = random.Random(81)
    for _ in range(280):
        x, y = rng.randrange(952), rng.randrange(2115)
        color = rng.choice([PINK, CYAN, GOLD])
        if rng.random() < .5:
            parts.append(f'<path d="M{x} {y} l4 8" stroke="{color}" stroke-width="3" stroke-linecap="round"/>')
        else:
            parts.append(f'<circle cx="{x}" cy="{y}" r="2" fill="{color}"/>')
    # Long flowing ribbons tie the separate covers into one party world.
    for path, color in [
        ('M-20 170 Q70 80 155 115 T340 180', PINK),
        ('M680 120 Q820 80 940 210', CYAN),
        ('M68 590 Q15 800 55 1000 T55 1380', CYAN),
        ('M840 650 Q800 880 850 1050 T835 1410', PINK),
        ('M100 1480 Q80 1690 260 1780', PINK),
        ('M760 1480 Q800 1700 610 1780', CYAN),
    ]:
        parts.append(f'<path d="{path}" fill="none" stroke="{INK}" stroke-width="21"/>')
        parts.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="12"/>')
    # Bunting sits along the rear covers, away from shot lanes.
    parts.append(f'<path d="M-20 45 Q475 185 980 45" fill="none" stroke="{CREAM}" stroke-width="4"/>')
    for x in range(10, 960, 42):
        y = 45 + 70 * (1 - ((x-476)/496)**2)
        parts.append(f'<path d="M{x} {y:.1f} l35 3 l-16 32Z" fill="{[PINK,GOLD,CYAN][(x//42)%3]}" stroke="{INK}" stroke-width="3"/>')
    for x,y,s,c,a in [(148,341,1.5,PINK,-18),(796,352,1.2,GOLD,16),
                      (680,555,1,CYAN,25),(520,736,1.25,PINK,-20),
                      (53,1080,.85,GOLD,-12),(841,1195,.8,PINK,14),
                      (165,1620,.8,GOLD,-24),(700,1620,.8,PINK,24)]:
        parts.append(gift(x,y,s,c,a))
    for x,y,s,c,a in [(228,213,1,PINK,-24),(382,162,.9,GOLD,24),
                      (870,171,1.2,PINK,15),(494,333,.95,CYAN,-15),
                      (75,710,.85,PINK,-12),(822,903,.85,GOLD,12),
                      (160,490,.9,CYAN,-20)]:
        parts.append(balloon(x,y,s,c,a))
    for x,y,r,c in [(85,140,29,GOLD),(765,104,25,PINK),(308,443,24,GOLD),
                     (600,820,28,GOLD),(68,1250,22,PINK),(827,1420,20,CYAN),
                     (197,1535,19,PINK),(671,1535,19,GOLD)]:
        parts.append(star(x,y,r,c))
    # Apron: clear upper drain opening, celebratory title, one reserved card well.
    parts.extend([balloon(105,1835,1.15,PINK,-24), gift(750,1850,1.25,GOLD,18),
                  star(185,1885,19,CYAN), star(680,1900,18,PINK)])
    parts.append(f'<path d="M0 1940 Q430 1890 880 1940 V2115 H0Z" fill="{INK}"/>')
    parts.append(f'<path d="M0 1937 Q430 1887 880 1937" fill="none" stroke="{PINK}" stroke-width="7"/>')
    parts.append(f'<path d="M0 1948 Q430 1898 880 1948" fill="none" stroke="{GOLD}" stroke-width="2"/>')
    parts.append(f'''<g id="instruction-card">
    <title>Quick-start instruction card: 310 × 120 table units</title>
    <rect x="54" y="1949" width="322" height="132" rx="9" fill="{NAVY}" stroke="{CYAN}" stroke-width="2"/>
    <rect x="60" y="1955" width="310" height="120" rx="5" fill="{CREAM}"/>
    <path d="M65 1973 v-13 h13 M352 1960 h13 v13 M65 2057 v13 h13 M352 2070 h13 v-13" fill="none" stroke="#bcae91" stroke-width="2"/>
    </g>''')
    parts.append(f'<image x="60" y="1955" width="310" height="120" href="{uri(Image.open(card_path))}"/>')
    font = base64.b64encode((ROOT/'assets/fonts/chewy/Chewy-Regular.ttf').read_bytes()).decode()
    parts.insert(0, f'<style>@font-face{{font-family:Chewy;src:url(data:font/ttf;base64,{font})}} text{{font-family:Chewy}}</style>')
    parts.append(f'''<g text-anchor="middle" paint-order="stroke" stroke="{INK}" stroke-width="5" stroke-linejoin="round">
    <text x="597" y="1993" font-size="44" fill="{CREAM}">Finni’s</text>
    <text x="597" y="2052" font-size="61" fill="{GOLD}">Big Day!</text></g>''')
    parts.extend([gift(784,2033,.9,PINK,-12),star(424,2000,17,CYAN),star(745,1965,13,PINK)])
    return ''.join(parts)


def build(source, output=OUT):
    output.mkdir(parents=True, exist_ok=True)
    index = json.loads((source/'images.json').read_text())
    runpy.run_path(str(Path(__file__).with_name('build-party-instruction-card.py')))['build'](output)
    art = artwork(output/'instruction-card.png')
    for name in ('plastics', 'plastics2'):
        entry = next(e for e in index if e['name'] == name)
        alpha = Image.open(source/'images'/entry['path']).convert('RGBA').getchannel('A')
        w,h = alpha.size
        mask = Image.merge('RGB', (alpha,alpha,alpha))
        # Crisp double printed edge follows the exact legacy cutouts.
        rim = Image.new('RGBA',alpha.size,CREAM)
        rim.putalpha(ImageChops.subtract(alpha,alpha.filter(ImageFilter.MinFilter(13))))
        edge = f'<image width="952" height="2115" href="{uri(rim)}"/>'
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 952 2115">
        <defs><mask id="cutouts"><image width="952" height="2115" href="{uri(mask)}"/></mask></defs>
        <g mask="url(#cutouts)">{art}{edge}</g></svg>'''
        (output/f'{name}.svg').write_text(svg)
        image = Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_string=svg, font_files=[str(ROOT/'assets/fonts/chewy/Chewy-Regular.ttf')]))).convert('RGBA')
        # Preserve the exact source alpha, including anti-aliased windows.
        image.putalpha(alpha)
        image.save(output/f'{name}.png',optimize=True)
    # The new decorative sling mesh uses planar UVs against this same artwork.
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="4550" viewBox="0 0 952 2115">{art}</svg>'
    (output/'sling-art.png').write_bytes(resvg_py.svg_to_bytes(svg_string=svg, font_files=[str(ROOT/'assets/fonts/chewy/Chewy-Regular.ttf')]))
    (output/'layout.json').write_text(json.dumps({'table_size':[952,2115], 'instruction_card':CARD,
        'description':'Quick-start card on the lower-left apron; full rules use the native VPX rulescard image.'},indent=2)+'\n')


def install(extracted, artwork_dir=OUT):
    extracted=Path(extracted)
    runpy.run_path(str(Path(__file__).with_name('build-party-instruction-card.py')))['install'](extracted,artwork_dir)
    index_path=extracted/'images.json'
    images=json.loads(index_path.read_text())
    import shutil
    for name in ('plastics','plastics2'):
        entry=next(e for e in images if e['name']==name)
        shutil.copyfile(artwork_dir/f'{name}.png',extracted/'images'/f'{name}.png')
        entry['path']=f'{name}.png'
    name='finni-sling-art'
    shutil.copyfile(artwork_dir/'sling-art.png',extracted/'images'/f'{name}.png')
    if not any(e['name']==name for e in images):
        images.append({'name':name,'path':f'{name}.png','alpha_test_value':1.0,'is_signed':False})
    index_path.write_text(json.dumps(images,indent=2))
    path=extracted/'gameitems/Primitive.FinniSlingCovers.json'
    primitive=json.loads(path.read_text())
    primitive['Primitive']['image']=name
    path.write_text(json.dumps(primitive,indent=2))
    path=path.with_suffix('.obj')
    lines=path.read_text().splitlines()
    vertices=[list(map(float,l.split()[1:4])) for l in lines if l.startswith('v ')]
    # UVs may be shared after vpxtool extraction. Rebuild per face corner.
    uvs=[]; faces=[]
    for line in lines:
        if not line.startswith('f '):continue
        face=[]
        for token in line.split()[1:]:
            fields=token.split('/');vertex=vertices[int(fields[0])-1]
            uvs.append(f'vt {vertex[0]*100/952:.9g} {1-vertex[1]*100/2115:.9g}')
            face.append(f'{fields[0]}/{len(uvs)}/{fields[2]}')
        faces.append('f '+' '.join(face))
    unchanged=[l for l in lines if not l.startswith(('vt ','f '))]
    path.write_text('\n'.join(unchanged+uvs+faces)+'\n')
    return {'textures':['plastics','plastics2',name], 'instruction_card':CARD,
            'mesh_vertices_and_physics_unchanged':True}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--install',type=Path)
    args=parser.parse_args()
    build(args.source)
    if args.install:print(json.dumps(install(args.install)))
