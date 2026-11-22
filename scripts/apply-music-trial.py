"""Silence background music and install locally supplied multiball songs."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FF = shutil.which('ffmpeg') or str(ROOT / '.tools/pydeps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe')


def install(table):
    config = json.loads((ROOT / 'design/music-trial.json').read_text())
    entries = json.loads((table / 'sounds.json').read_text())
    by_name = {s['name'].lower(): s for s in entries}
    configured = config['silent_ids'] + [name for track in config['tracks'] for name in track['ids']]
    music_ids = {name for name in by_name if name.startswith('mu_')}
    if len(configured) != len(set(configured)) or set(configured) != music_ids:
        raise ValueError('Music configuration must cover every table music slot exactly once.')
    out = ROOT / 'output/party-audio'
    out.mkdir(parents=True, exist_ok=True)
    silent = out / 'music-silence.ogg'
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y',
                    '-f', 'lavfi', '-i', 'anullsrc=r=32000:cl=stereo', '-t', '1',
                    '-c:a', 'libvorbis', '-q:a', '5', str(silent)], check=True)
    replacements = dict.fromkeys(config['silent_ids'], silent)
    pending = []
    sources = {}
    notes = [config['direction']]
    for track in config['tracks']:
        source = ROOT / track['source_file']
        converted = silent
        if source.is_file():
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            if track.get('sha256') and source_hash != track['sha256']:
                raise ValueError(f"Music source checksum mismatch: {source}")
            converted = out / (track['ids'][0] + '-trial.ogg')
            subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y',
                            '-ss', str(track.get('start_seconds', 0)), '-i', str(source),
                            '-map', '0:a:0', '-vn', '-sn', '-dn',
                            '-af', 'loudnorm=I=-20:TP=-2:LRA=9', '-ar', '32000', '-ac', '2',
                            '-c:a', 'libvorbis', '-q:a', '5', str(converted)], check=True)
            sources[track['ids'][0]] = source_hash
        else:
            pending.append(track)
        replacements.update(dict.fromkeys(track['ids'], converted))
        status = 'pending source; silent' if converted == silent else 'installed; loudness normalized'
        notes.append(f"{track['mode']}: {track['title']} — {track['artist']} ({status})")
        if track.get('source_url'):
            notes.append(track['source_url'])

    sound_files = list((table / 'sounds').iterdir())
    for name, file in replacements.items():
        entry = by_name[name]
        for old in sound_files:
            if old.stem.lower() == name:
                old.unlink()
        shutil.copyfile(file, table / 'sounds' / (entry['name'] + '.ogg'))
        entry['path'] = entry['name'] + '.ogg'
        entry['internal_name'] = ''
    (table / 'sounds.json').write_text(json.dumps(entries, indent=2) + '\n')
    info = json.loads((table / 'info.json').read_text())
    marker = '\n\nFinni music trial credits:\n'
    info['table_description'] = (info.get('table_description') or '').split(marker)[0] + marker + '\n'.join(notes)
    (table / 'info.json').write_text(json.dumps(info, indent=2) + '\n')
    (out / 'MUSIC-CREDITS.txt').write_text('\n'.join(notes) + '\n')
    report = dict(config, ids=list(replacements), pending_tracks=pending,
                  source_sha256=sources,
                  installed_sha256_by_id={name: hashlib.sha256(file.read_bytes()).hexdigest()
                                          for name, file in replacements.items()},
                  installed_silent_ids=[name for name, file in replacements.items() if file == silent])
    (out / 'music-trial-report.json').write_text(json.dumps(report, indent=2) + '\n')
    for track in pending:
        print(f"Pending {track['mode']} source: {track['source_file']} (slot silenced)")
    return len(replacements)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install', type=Path, default=ROOT / '.work/finni-live-extracted')
    args = parser.parse_args()
    print('MUSIC_TRIAL_READY', install(args.install))
