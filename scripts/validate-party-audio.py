"""Verify Finni speech coverage/PCM, effects, Funkorama, routing and untouched assets."""
import hashlib
import json
import runpy
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / ".work/deadpool-extracted"
table = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".work/finni-live-extracted"
audio = ROOT / "output/party-audio"
report = json.loads((audio / "audio-report.json").read_text())
voice_dir = ROOT / "output/finni-voice"
voice = json.loads((voice_dir / "voice-report.json").read_text())
expected_lines = runpy.run_path(str(ROOT/'scripts/build-finni-callouts.py'))['lines']()[1]
assert {name: spec['text'] for name, spec in voice['callouts'].items()} == expected_lines, 'Stale speech transcript'
music = json.loads((audio / "music-trial-report.json").read_text())
# BASS cannot load OGG files containing a video stream (including MP3 cover art).
probe = subprocess.run([str(ROOT / '.tools/pydeps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe'),
                        '-hide_banner', '-i', str(audio / 'funkorama-trial.ogg')], capture_output=True, text=True)
assert 'Audio: vorbis' in probe.stderr and 'Video:' not in probe.stderr, probe.stderr
replaced = {**report["effects"], **voice["callouts"], **dict.fromkeys(music["ids"])}
before = json.loads((source / "sounds.json").read_text())
after = json.loads((table / "sounds.json").read_text())
assert [s["name"] for s in before] == [s["name"] for s in after[:len(before)]]
added_story = {'vo_friendshipmb', 'vo_caketimetoppings', 'vo_caketimefinish', 'vo_caketimefrosting'}
assert {s["name"] for s in after[len(before):]} == {"vo_enterinitials", "vo_nocredits", "vo_ballsaved"} | added_story
assert all(expected_lines.values()), 'Speech parity requires no silent slots'
tuning=runpy.run_path(str(ROOT/'scripts/apply-gameplay-tuning.py'))
assert tuning['tuned_script']((source/'script.vbs').read_bytes()) == (table/'script.vbs').read_bytes()
original_files = {p.stem.lower(): p for p in (source / "sounds").iterdir()}
new_files = {p.stem.lower(): p for p in (table / "sounds").iterdir()}
lookup = {name.lower(): name for name in replaced}
source_metadata = {s['name'].lower(): s for s in before}
for new in after:
    old = source_metadata.get(new['name'].lower(), source_metadata['nocredits'])
    for key in ("volume", "balance", "fade", "output_target"):
        assert old[key] == new[key], (old["name"], key)
    key = new["name"].lower()
    file = new_files[key]
    if key not in lookup:
        assert original_files[key].read_bytes() == file.read_bytes(), key
        continue
    name = lookup[key]
    if name in music["ids"]:
        assert hashlib.sha256(file.read_bytes()).hexdigest() == music["installed_sha256"], name
        continue
    # VPX may rewrite the WAV header on extraction; compare decoded PCM as well.
    with wave.open(str(file), "rb") as wav:
        assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) == (32000, 2, 2), name
        frames = wav.readframes(wav.getnframes())
        data = np.frombuffer(frames, dtype="<i2").reshape(-1, 2).astype(float) / 32768
    generated_dir = voice_dir if name in voice["callouts"] else audio
    with wave.open(str(generated_dir / (name + ".wav")), "rb") as wav:
        assert frames == wav.readframes(wav.getnframes()), name
    assert np.isfinite(data).all(), name
    if name in voice["callouts"]:
        spec = voice["callouts"][name]
        assert len(data) / 32000 < 6, (name, spec["seconds"])
        if spec["silent"]:
            assert not np.any(data), name
        else:
            assert .03 < np.sqrt(np.mean(data ** 2)) < .30, name
            assert np.max(np.abs(data)) < .90, name
    else:
        assert .02 < np.sqrt(np.mean(data ** 2)) < .13, name
        assert np.max(np.abs(data)) < .71, name
speech_names = {s["name"] for s in after if s["name"].startswith(("vo_", "quote")) or s["name"] in ("player", "nocredits")}
assert speech_names == voice["callouts"].keys(), "Unreplaced speech slot"
assert 'Funkorama' in json.loads((table / "info.json").read_text())["table_description"]
result = {"replacements": len(replaced),
          "finni_voice_slots": len(speech_names), "silent_voice_slots": sum(s["silent"] for s in voice["callouts"].values()),
          "funkorama_slots": len(music["ids"]),
          "original_music_preserved": sum(s["name"].lower().startswith("mu_") for s in before) - len(music["ids"]),
          "unchanged_sounds": len(after) - len(replaced),
          "script_identical_except_approved_scoop_and_story_presentation": True, "routing_and_levels_identical": True,
          "decoded_audio_matches_generated_files": True,
          "table": str(table)}
(audio / "validation.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
