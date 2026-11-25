"""Build lossless PCM effects from the hash-verified native table sound files.

24-bit FLAC contains the original PCM16 values with eight zero low bits. This
also avoids browser PCM16 positive-sample normalization. Music is unchanged.
The original WAV is retained as a codec-independent fallback.
"""
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile
from three_sound_settings import table_sound_settings

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-dir', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--ffmpeg', type=Path, required=True)
parser.add_argument('--settings-vpx', type=Path, default=ROOT/'runtime/Finni-Big-Day.vpx')
parser.add_argument('--refresh-sources', action='store_true', help='Accept changed sources only when verified against the selected VPX.')
parser.add_argument('--reuse-existing', action='store_true', help='Reuse verified lossless bytes for unchanged sources.')
args = parser.parse_args()
manifest = json.loads((ROOT/'three/public/audio.json').read_text())
settings = table_sound_settings(args.settings_vpx)
out = args.output_dir/'audio'
out.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()

def store(data, suffix):
    filename = sha(data)[:24]+suffix
    target = out/filename
    if target.exists():
        if target.read_bytes() != data: raise RuntimeError('Asset name collision '+filename)
    else:
        target.write_bytes(data)
    return filename

def wave(data):
    if data[:4] != b'RIFF' or data[8:12] != b'WAVE': raise RuntimeError('Invalid source WAV')
    at, fmt, pcm = 12, None, None
    while at+8 <= len(data):
        tag, size = struct.unpack_from('<4sI', data, at)
        if at+8+size > len(data): raise RuntimeError('Truncated source WAV')
        if tag == b'fmt ': fmt = struct.unpack_from('<HHIIHH', data, at+8)
        if tag == b'data': pcm = data[at+8:at+8+size]
        at += 8+size+(size%2)
    if not fmt or pcm is None or fmt[0] != 1 or fmt[5] != 16 or fmt[1] not in (1, 2) or fmt[4] != fmt[1]*2 or len(pcm)%fmt[4]:
        raise RuntimeError('Expected complete source PCM16')
    return {'channels':fmt[1], 'sampleRate':fmt[2], 'frames':len(pcm)//fmt[4], 'pcm16SHA256':sha(pcm)}, pcm

# Check every named entry against both the current manifest and serialized VPX.
sources, unique, updated = {}, {}, {}
for name, entry in manifest.items():
    file = args.source_dir/'sounds'/(name+('.ogg' if entry['music'] else '.wav'))
    data = file.read_bytes()
    if sha(data) != settings[name]['sourceSHA256'] or (not args.refresh_sources and sha(data) != entry['sourceSHA256']):
        raise RuntimeError('Source differs from current table: '+name)
    updated[name] = {**entry, **settings[name]}
    sources[name] = data
    if not entry['music']: unique.setdefault(sha(data), (file, data))

def encode(item):
    source_hash, (source, data) = item
    metadata, pcm = wave(data)
    previous = next((entry for entry in manifest.values() if not entry['music'] and entry['sourceSHA256'] == source_hash), None)
    if args.reuse_existing and previous and previous.get('encoding') == 'flac-pcm24':
        encoded = (ROOT/'three/public/audio'/previous['file']).read_bytes()
        fallback = (ROOT/'three/public/audio'/previous['fallbackFile']).read_bytes()
        if sha(encoded) != previous['encodedSHA256'] or fallback != data or any(previous[key] != value for key, value in metadata.items()):
            raise RuntimeError('Existing lossless source differs: '+str(source))
        return source_hash, {**metadata, 'encoding':'flac-pcm24', 'file':store(encoded, '.flac'),
                             'encodedSHA256':sha(encoded), 'fallbackFile':store(data, '.wav')}
    with tempfile.TemporaryDirectory(prefix='native-audio-', dir=args.output_dir) as temporary:
        target = Path(temporary)/'effect.flac'
        subprocess.run([str(args.ffmpeg), '-hide_banner', '-loglevel', 'error', '-i', str(source),
                        '-map_metadata', '-1', '-c:a', 'flac', '-compression_level', '12',
                        '-sample_fmt', 's32', '-bits_per_raw_sample', '24',
                        '-metadata_header_padding', '0', str(target)], check=True)
        encoded = target.read_bytes()
        decoded = subprocess.run([str(args.ffmpeg), '-hide_banner', '-loglevel', 'error', '-i', str(target),
                                  '-f', 's16le', '-c:a', 'pcm_s16le', '-'], check=True, capture_output=True).stdout
        if decoded != pcm: raise RuntimeError('Lossless round trip failed: '+str(source))
    return source_hash, {**metadata, 'encoding':'flac-pcm24', 'file':store(encoded, '.flac'),
                         'encodedSHA256':sha(encoded), 'fallbackFile':store(data, '.wav')}

with ThreadPoolExecutor(max_workers=4) as pool:
    effects = dict(pool.map(encode, unique.items()))
result = {}
for name, entry in updated.items():
    if entry['music']:
        data = (ROOT/'three/public/audio'/entry['file']).read_bytes()
        filename = store(data, '.m4a')
        result[name] = {**entry, 'file':filename}
    else:
        result[name] = {**entry, **effects[entry['sourceSHA256']]}
(args.output_dir/'audio.json').write_text(json.dumps(result, separators=(',', ':')))
report = {'sounds':len(result), 'effects':sum(not v['music'] for v in result.values()),
          'uniqueEffects':len(effects), 'allSourceFilesVerified':True, 'allPCM16RoundTripsExact':True,
          'ffmpegSHA256':sha(args.ffmpeg.read_bytes()), 'sourceTableSHA256':sha(args.settings_vpx.read_bytes()),
          'deliveryFiles':len(list(out.iterdir())), 'deliveryBytes':sum(p.stat().st_size for p in out.iterdir())}
(args.output_dir/'audio-build-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
