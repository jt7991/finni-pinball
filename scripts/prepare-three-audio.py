"""Encode the installed table sounds as individually loaded AAC files."""
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import struct

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-dir',type=Path,default=ROOT/'.work/finni-live-extracted',help='Extracted table directory containing sounds and sounds.json.')
parser.add_argument('--metadata-only',action='store_true',help='Update metadata for existing AAC files without re-encoding them.')
args=parser.parse_args()
SOURCE=args.source_dir/'sounds'
OUT=ROOT/'three/public/audio'
OUT.mkdir(parents=True,exist_ok=True)
encoder=shutil.which('ffmpeg')
if not encoder and not args.metadata_only:raise SystemExit('ffmpeg is required to rebuild browser audio.')
files={p.stem.lower():p for p in SOURCE.iterdir() if p.is_file()}
entries=json.loads((SOURCE.parent/'sounds.json').read_text())

def sample_rate(path):
    if path.suffix.lower()!='.wav':return None
    with path.open('rb') as stream:
        if stream.read(4)!=b'RIFF':raise RuntimeError('Unsupported WAV header '+str(path))
        stream.read(4)
        if stream.read(4)!=b'WAVE':raise RuntimeError('Unsupported WAV data '+str(path))
        while True:
            header=stream.read(8)
            if len(header)!=8:raise RuntimeError('WAV has no fmt chunk '+str(path))
            kind,size=struct.unpack('<4sI',header)
            if kind==b'fmt ':
                data=stream.read(size)
                if len(data)<16:raise RuntimeError('Short WAV format '+str(path))
                return struct.unpack_from('<I',data,4)[0]
            stream.seek(size+(size%2),1)
def encode(entry):
    name=entry['name'].lower()
    source=files.get(name)
    if source is None:raise RuntimeError('Missing installed sound '+name)
    filename=hashlib.sha256(name.encode()).hexdigest()[:16]+'.m4a'
    target=OUT/filename
    if not target.exists():
        if args.metadata_only:raise RuntimeError('Missing previously encoded audio '+str(target))
        subprocess.run([encoder,'-hide_banner','-loglevel','error','-y','-i',str(source),
                        '-c:a','aac','-b:a','96k' if name.startswith('mu_') else '64k',
                        '-movflags','+faststart',str(target)],check=True)
    metadata={'file':filename,'music':name.startswith('mu_')}
    rate=sample_rate(source)
    if rate:metadata['sampleRate']=rate
    return name,metadata
with ThreadPoolExecutor(max_workers=4) as pool:
    manifest=dict(pool.map(encode,entries))
(OUT.parent/'audio.json').write_text(json.dumps(manifest,separators=(',',':')))
print('Encoded',len(manifest),'sounds;',sum(p.stat().st_size for p in OUT.iterdir()),'bytes, loaded on demand')
