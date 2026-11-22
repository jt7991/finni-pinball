"""Encode native RGBA uploads losslessly, checking every decoded source byte."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--metadata', default='native-world.json')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--pillow-root', type=Path)
args = parser.parse_args()
if args.pillow_root:
    sys.path.insert(0, str(args.pillow_root))
from PIL import Image

source = args.source.resolve()
output = args.output.resolve()
assert source != output, 'Keep the raw native inputs intact'
output.mkdir(parents=True, exist_ok=True)
metadata = json.loads((source / args.metadata).read_text())
files = [metadata['geometry']['file']]
for program in metadata['programs'].values():
    files.extend([program['vertex'], program['fragment']])
for name in set(files):
    shutil.copyfile(source / name, output / name)
raw_total = encoded_total = 0
for texture_id, texture in metadata['textures'].items():
    assert texture['pixelFormat'] == 6408 and texture['pixelType'] == 5121
    assert len(texture['levels']) == 1, 'Explicit native mip uploads need their own encoding path'
    level = texture['levels'][0]
    raw = (source / level['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == level['sha256']
    assert len(raw) == texture['width'] * texture['height'] * 4
    image = Image.frombytes('RGBA', (texture['width'], texture['height']), raw)
    name = 'texture-' + texture_id + '.webp'
    image.save(output / name, format='WEBP', lossless=True, exact=True, quality=100, method=6)
    with Image.open(output / name) as decoded:
        assert decoded.convert('RGBA').tobytes() == raw, 'Lossless decode must preserve transparent RGB too'
    encoded = (output / name).read_bytes()
    texture['encoding'] = 'webp-lossless'
    level.update(file=name, sourceBytes=len(raw), sourceSHA256=level['sha256'],
                 bytes=len(encoded), sha256=hashlib.sha256(encoded).hexdigest())
    raw_total += len(raw)
    encoded_total += len(encoded)
    print(json.dumps({'texture': texture_id, 'raw': len(raw), 'encoded': len(encoded)}), flush=True)
(output / args.metadata).write_text(json.dumps(metadata, separators=(',', ':')))
if (source / 'reference.json').exists():
    # Development fixture only; the eventual production pack excludes references.
    shutil.copyfile(source / 'reference.json', output / 'reference.json')
print(json.dumps({'raw': raw_total, 'encoded': encoded_total, 'output': str(output)}))
