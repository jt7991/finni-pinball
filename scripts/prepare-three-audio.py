"""Encode the installed table sounds as individually loaded AAC files."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'.work/finni-live-extracted/sounds'
OUT=ROOT/'three/public/audio'
OUT.mkdir(parents=True,exist_ok=True)
encoder=shutil.which('ffmpeg')
if not encoder:raise SystemExit('ffmpeg is required to rebuild browser audio.')
files={p.stem.lower():p for p in SOURCE.iterdir() if p.is_file()}
entries=json.loads((SOURCE.parent/'sounds.json').read_text())
def encode(entry):
    name=entry['name'].lower()
    source=files.get(name)
    if source is None:raise RuntimeError('Missing installed sound '+name)
    filename=hashlib.sha256(name.encode()).hexdigest()[:16]+'.m4a'
    target=OUT/filename
    if not target.exists():
        subprocess.run([encoder,'-hide_banner','-loglevel','error','-y','-i',str(source),
                        '-c:a','aac','-b:a','96k' if name.startswith('mu_') else '64k',
                        '-movflags','+faststart',str(target)],check=True)
    return name,{'file':filename,'music':name.startswith('mu_')}
with ThreadPoolExecutor(max_workers=4) as pool:
    manifest=dict(pool.map(encode,entries))
(OUT.parent/'audio.json').write_text(json.dumps(manifest,separators=(',',':')))
print('Encoded',len(manifest),'sounds;',sum(p.stat().st_size for p in OUT.iterdir()),'bytes, loaded on demand')
