"""Refresh collision event metadata without regenerating accepted geometry."""
import argparse
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-dir',type=Path,required=True,help='Unmodified extracted gameitems directory, read-only.')
args=parser.parse_args()
if not args.source_dir.is_dir():raise SystemExit('Extracted gameitems directory is missing: '+str(args.source_dir))
source={}
for path in args.source_dir.glob('*.json'):
    kind,item=next(iter(json.loads(path.read_text()).items()))
    source[kind,item['name']]=item
if not source:raise SystemExit('No extracted gameitem JSON files found.')
for filename in ['layout.json','objects.json']:
    path=ROOT/'three/public'/filename
    data=json.loads(path.read_text())
    for item in data.get('items',[])+data.get('rubbers',[])+data.get('objects',[]):
        if item['kind'] not in ('Wall','Primitive','Rubber','Ramp'):continue
        original=source.get((item['kind'],item['name']))
        if original is None:
            if 'native_source_order' in item:raise RuntimeError('Native object missing from extraction: '+item['name'])
            continue # accepted decorative extras have no native object
        for key in ['hit_event','threshold']:
            if key in original:item[key]=original[key]
    path.write_text(json.dumps(data,separators=(',',':')))
    print('Updated event metadata:',filename)
