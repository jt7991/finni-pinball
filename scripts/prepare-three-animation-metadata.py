"""Refresh authored animation properties without regenerating table geometry."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-dir', type=Path, required=True)
args = parser.parse_args()
path = ROOT / 'three/public/objects.json'
data = json.loads(path.read_text())
updated = []
for item in data['objects']:
    if item['kind'] != 'Trigger':
        continue
    source = json.loads((args.source_dir / ('Trigger.' + item['name'] + '.json')).read_text())['Trigger']
    item['anim_speed'] = source['anim_speed']
    updated.append(item['name'])
path.write_text(json.dumps(data, separators=(',', ':')))
print('Preserved authored animation speed for', len(updated), 'triggers:', ', '.join(updated))
