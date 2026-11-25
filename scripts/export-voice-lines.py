"""Export the active recording tasks for Voice Studio."""
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
builder = runpy.run_path(str(ROOT / 'scripts/build-finni-callouts.py'))
config, mapping = builder['lines'](validate_source=False)
lines = builder['recording_lines'](config, mapping)
output = ROOT / 'browser/voice-lines.json'
output.write_text(json.dumps(dict(sorted(lines.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Exported {len(lines)} game lines to {output}')
