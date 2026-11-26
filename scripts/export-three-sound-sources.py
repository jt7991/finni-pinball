"""Export source audio directly from the selected VPX without running it."""
import argparse
import hashlib
import json
from pathlib import Path
from three_sound_settings import table_sound_sources

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--table', type=Path, default=root/'runtime/Finni-Big-Day.vpx')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if args.output.exists():
    raise SystemExit('Choose a new output directory; previous exports are retained.')
manifest = json.loads((root/'three/public/audio.json').read_text())
sources = {name: (payload, settings) for name, payload, settings in table_sound_sources(args.table)}
if set(sources) != set(manifest):
    raise SystemExit('Sound names changed: '+json.dumps({'added': sorted(set(sources)-set(manifest)), 'removed': sorted(set(manifest)-set(sources))}))
out = args.output/'sounds'
out.mkdir(parents=True)
rows = []
for name, entry in manifest.items():
    if Path(name).name != name or '\\' in name:
        raise ValueError('Unsafe sound name '+name)
    payload, settings = sources[name]
    sha = hashlib.sha256(payload).hexdigest()
    filename = name+('.ogg' if entry['music'] else '.wav')
    (out/filename).write_bytes(payload)
    rows.append({'name': name, 'sourceSHA256': sha, 'changed': sha != entry['sourceSHA256'], **settings})
report = {'tableSHA256': hashlib.sha256(args.table.read_bytes()).hexdigest(), 'sounds': rows}
(args.output/'sound-source-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'sounds': len(rows), 'changed': sum(row['changed'] for row in rows), 'tableSHA256': report['tableSHA256']}))
