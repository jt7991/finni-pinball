"""Retain current VPX sound output/mix settings in the existing audio manifest."""
import argparse
import hashlib
import json
from pathlib import Path
from three_sound_settings import table_sound_settings

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--vpx', type=Path, default=root/'runtime/Finni-Big-Day.vpx')
args = parser.parse_args()
source = json.loads((root/'three/public/source-table.json').read_text())
assert hashlib.sha256(args.vpx.read_bytes()).hexdigest() == source.get('playbackTableSHA256', source['sourceTableSHA256'])
settings = table_sound_settings(args.vpx)
path = root/'three/public/audio.json'
manifest = json.loads(path.read_text())
assert settings.keys() == manifest.keys()
for name, sound in manifest.items():
    assert sound['sourceSHA256'] == settings[name]['sourceSHA256'], name
    sound.update(settings[name])
path.write_text(json.dumps(manifest, separators=(',', ':')))
print(json.dumps({'sounds':len(settings), 'backglass':sum(s['outputTarget']=='backglass' for s in settings.values()),
                  'playfield':sum(s['outputTarget']=='playfield' for s in settings.values())}))
