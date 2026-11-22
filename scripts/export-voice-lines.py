"""Export one recording task per canonical game callout; omit reused aliases."""
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
config, lines = runpy.run_path(str(ROOT / 'scripts/build-finni-callouts.py'))['lines'](validate_source=False)
lines = {id: text for id, text in lines.items() if id not in config['recording_aliases']}
output = ROOT / 'browser/voice-lines.json'
output.write_text(json.dumps(dict(sorted(lines.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Exported {len(lines)} game lines to {output}')
