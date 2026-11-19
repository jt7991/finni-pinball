"""Export the same complete callout IDs used by the game build for the studio."""
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
_, lines = runpy.run_path(str(ROOT / 'scripts/build-finni-callouts.py'))['lines']()
output = ROOT / 'browser/voice-lines.json'
output.write_text(json.dumps(dict(sorted(lines.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Exported {len(lines)} game lines to {output}')
