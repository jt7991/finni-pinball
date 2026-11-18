"""Synthesize Finni party effects, preserve source music and install them by existing VPX sound ID.

Uses numpy bundled with Blender. No downloads, samples, voice synthesis or rule edits.
Generated effects stay local; this script and design/party-audio.json are the sources.
"""
import argparse
import hashlib
import json
import shutil
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 32000
TAU = 2 * np.pi


def tone(note, seconds, kind="pluck"):
    t = np.arange(round(seconds * RATE)) / RATE
    f = 440 * 2 ** ((note - 69) / 12)
    attack = np.minimum(t / .008, 1)
    if kind == "bass":
        y = np.sin(TAU * f * t) + .22 * np.sin(TAU * 2 * f * t)
        env = attack * np.exp(-t * 5)
    elif kind == "pad":
        y = .7 * np.sin(TAU * f * t) + .2 * np.sin(TAU * (f * 2.002) * t)
        env = np.minimum(t / .07, 1) * np.minimum((seconds - t) / .15, 1) * .5
    else:
        # Soft electric piano/mallet: rounded fundamental, quick upper partials.
        y = np.sin(TAU * f * t) + .3 * np.sin(TAU * 2 * f * t) * np.exp(-t * 9)
        y += .12 * np.sin(TAU * 3 * f * t) * np.exp(-t * 15)
        env = attack * np.exp(-t * (7 if kind == "bell" else 5))
    return y * env * np.minimum((seconds - t) / .015, 1)


def drum(kind, rng):
    seconds = {"kick": .22, "clap": .16, "hat": .065, "pop": .13}[kind]
    t = np.arange(round(seconds * RATE)) / RATE
    noise = rng.uniform(-1, 1, len(t))
    if kind == "kick":
        y = np.sin(TAU * (48 * t + 3.5 * (1 - np.exp(-t * 35)))) * np.exp(-t * 23)
    elif kind == "pop":
        y = np.sin(TAU * (390 * t + 20 * (1 - np.exp(-t * 32)))) * np.exp(-t * 38)
    else:
        noise = np.concatenate(([0.], np.diff(noise))) * .45
        y = noise * np.exp(-t * (65 if kind == "hat" else 30))
        if kind == "clap":
            y *= .65 + .35 * np.cos(TAU * 65 * t)
    return y * np.minimum(t / .002, 1) * np.minimum((seconds - t) / .008, 1)


def add(mix, sound, start, gain=1., pan=0., wrap=False):
    offset = round(start * RATE)
    stereo = sound[:, None] * np.array([np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)]) * gain
    if wrap:
        indices = (offset + np.arange(len(sound))) % len(mix)
        np.add.at(mix, indices, stereo)
    elif offset < len(mix):
        count = min(len(sound), len(mix) - offset)
        mix[offset:offset + count] += stereo[:count]


def master(mix, target_rms, peak_limit):
    rms = np.sqrt(np.mean(mix ** 2))
    if rms:
        mix = mix * min(target_rms / rms, peak_limit / np.max(np.abs(mix)))
    return mix


def effect(kind, variant=0):
    rng = np.random.default_rng(300 + variant)
    notes = {"pop": [72 + variant % 5], "sparkle": [72, 76, 79],
             "success": [72, 76, 79, 84], "power": [60, 67, 72, 76],
             "shuffle": [67, 72]}[kind]
    mix = np.zeros((round((.27 if kind == "pop" else .9) * RATE), 2))
    if kind in ("pop", "shuffle"):
        add(mix, drum("pop" if kind == "pop" else "clap", rng), 0, .25)
    for i, note in enumerate(notes):
        add(mix, tone(note + (variant % 3) * 2, .35, "bell"), i * .085, .22, (i % 3 - 1) * .2)
    return master(mix, .095, .65)


def write_wav(path, mix):
    pcm = np.round(np.clip(mix, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    return {"seconds": round(len(mix) / RATE, 3), "peak": round(float(np.max(np.abs(mix))), 4),
            "rms": round(float(np.sqrt(np.mean(mix ** 2))), 4),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def build(destination):
    destination.mkdir(parents=True, exist_ok=True)
    config = json.loads((ROOT / "design/party-audio.json").read_text())
    report = {"sample_rate": RATE, "channels": 2, "bits": 16, "music": {}, "effects": {}}
    for i, name in enumerate(config["effects"]):
        report["effects"][name] = write_wav(destination / (name + ".wav"), effect(config["effects"][name], i))
    # Audition the effect families; the table retains its original soundtrack.
    parts = []
    for name in ("pop", "sparkle", "power", "success"):
        parts.extend((effect(name), np.zeros((RATE // 4, 2))))
    write_wav(destination / "finni-audio-sampler.wav", np.concatenate(parts))
    (destination / "audio-report.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def install(table, audio_dir):
    """Replace assets only, retaining original script, IDs, routing and sound levels."""
    report = json.loads((audio_dir / "audio-report.json").read_text())
    replacements = report["effects"]
    metadata = json.loads((table / "sounds.json").read_text())
    # Restore source music even when updating an extraction with older generated cues.
    source = ROOT / ".work/deadpool-extracted"
    originals = {entry["name"].lower(): entry for entry in json.loads((source / "sounds.json").read_text())}
    source_files = {file.stem.lower(): file for file in (source / "sounds").iterdir()}
    for index, entry in enumerate(metadata):
        key = entry["name"].lower()
        if key.startswith("mu_"):
            original = source_files[key]
            for old in (table / "sounds").iterdir():
                if old.stem.lower() == key:
                    old.unlink()
            shutil.copyfile(original, table / "sounds" / original.name)
            metadata[index] = originals[key]
    existing = {entry["name"].lower(): entry for entry in metadata}
    assert all(name.lower() in existing for name in replacements), "Unknown source sound ID"
    script_before = (table / "script.vbs").read_bytes()
    for name in replacements:
        entry = existing[name.lower()]
        for old in (table / "sounds").iterdir():
            if old.stem.lower() == name.lower():
                old.unlink()
        shutil.copyfile(audio_dir / (name + ".wav"), table / "sounds" / (entry["name"] + ".wav"))
        entry["path"] = entry["name"] + ".wav"
        entry["internal_name"] = ""
    (table / "sounds.json").write_text(json.dumps(metadata, indent=2) + "\n")
    assert (table / "script.vbs").read_bytes() == script_before
    return len(replacements)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "output/party-audio")
    parser.add_argument("--install", type=Path, help="Extracted VPX directory to update")
    args = parser.parse_args()
    report = build(args.output)
    if args.install:
        print("Installed", install(args.install, args.output), "party sounds")
    print("PARTY_AUDIO_READY: original soundtrack retained;", len(report["effects"]), "party effects")


if __name__ == "__main__":
    main()
