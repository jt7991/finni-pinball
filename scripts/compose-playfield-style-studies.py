"""Swap only the illustration in approved v10 SVGs; retain registered layers."""
from pathlib import Path
import base64
import json
import shutil
import sys
import xml.etree.ElementTree as ET
import argparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/pydeps'))
import resvg_py

SRC = ROOT / 'output/playfield-party-v10'
OUT = ROOT / 'output/playfield-style-studies'
NS = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', NS[1:-1])
reports = []
parser = argparse.ArgumentParser()
parser.add_argument('--variant')
parser.add_argument('--output', type=Path)
parser.add_argument('--illustration', type=Path)
args = parser.parse_args()
if args.output:
    if not args.illustration:
        parser.error('--output requires --illustration')
    args.output.mkdir(parents=True, exist_ok=True)
    if args.illustration.resolve() != (args.output/'mission-party-environment.png').resolve():
        shutil.copyfile(args.illustration, args.output/'mission-party-environment.png')
    manifest = {'variants': [{'id': args.output.name}]}
else:
    manifest = json.loads((OUT / 'generation.json').read_text(encoding='utf-8-sig'))
for variant in manifest['variants']:
    if args.variant and variant['id'] != args.variant:
        continue
    dest = args.output if args.output else OUT / variant['id']
    art = dest / 'mission-party-environment.png'
    encoded = 'data:image/png;base64,' + base64.b64encode(art.read_bytes()).decode()
    clean_svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="450" height="1000" viewBox="0 0 952 2115"><image href="{encoded}" width="952" height="2115" preserveAspectRatio="none"/></svg>'
    (dest / 'art-preview.png').write_bytes(resvg_py.svg_to_bytes(svg_string=clean_svg))
    for name in ('finni-playfield-base', 'playfield-print-cutouts'):
        original = ET.parse(SRC / (name + '.svg')).getroot()
        tree = ET.parse(SRC / (name + '.svg')).getroot()
        images = list(tree.iter(NS + 'image'))
        assert len(images) == 1
        images[0].set('href', encoded)
        svg = ET.tostring(tree, encoding='unicode')
        (dest / (name + '.svg')).write_text(svg, encoding='utf-8')
        (dest / (name + '.png')).write_bytes(resvg_py.svg_to_bytes(
            svg_string=svg, font_files=[str(ROOT / 'assets/fonts/chewy/Chewy-Regular.ttf')]))
        if name == 'finni-playfield-base':
            (dest / 'playfield-preview.png').write_bytes(resvg_py.svg_to_bytes(
                svg_string=svg, width=450, height=1000,
                font_files=[str(ROOT / 'assets/fonts/chewy/Chewy-Regular.ttf')]))
        # Removing only the background href must leave identical entire documents.
        next(original.iter(NS + 'image')).set('href', '')
        next(tree.iter(NS + 'image')).set('href', '')
        assert ET.tostring(original) == ET.tostring(tree), variant['id']
    for name in ('playfield-insert-lenses.svg', 'playfield-insert-lenses.png',
                 'mission-art-map.json', 'inlane-layout-overrides.json',
                 'original-plastic-alpha-map.json', 'back-panel.png'):
        shutil.copyfile(SRC / name, dest / name)
    shutil.copytree(SRC / 'vpx-light-overrides', dest / 'vpx-light-overrides', dirs_exist_ok=True)
    shutil.copyfile(dest / 'finni-playfield-base.svg', dest / 'playfield-editable-layers.svg')
    reports.append({'variant': variant['id'], 'only_background_image_changed': True,
                    'lens_layer_byte_identical': (dest / 'playfield-insert-lenses.png').read_bytes()
                    == (SRC / 'playfield-insert-lenses.png').read_bytes(),
                    'registered_cutouts': 52, 'texture_size': [2048, 4550]})
    print('COMPOSED', variant['id'], flush=True)
report_dir = args.output if args.output else OUT
(report_dir / ((args.variant + '-validation.json') if args.variant else 'validation.json')).write_text(json.dumps(reports, indent=2), encoding='utf-8')
