"""Build the ElevenLabs placeholder cast. Cached PCM rebuilds offline."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import shutil
import subprocess
import runpy
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".work/deadpool-extracted"
ADDED_STORY_IDS = {'vo_friendshipmb', 'vo_caketimetoppings', 'vo_caketimefinish', 'vo_caketimefrosting'}
ADDED_EVENT_IDS = {'vo_ballsaved', 'vo_spinnerrush', 'vo_supplyrun', 'vo_confettiburst'}
BUNDLED_FF = ROOT / ".tools/pydeps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe"
FF = BUNDLED_FF if BUNDLED_FF.is_file() else "ffmpeg"


def lines(validate_source=True):
    config = json.loads((ROOT / "design/finni-callouts.json").read_text(encoding="utf-8"))
    result = dict(config["callouts"])
    for n in range(2, 7):
        result[f"vo_{n}xcombo"] = f"{n} times combo!"
        if n < 6:
            result[f"vo_{n}xbonus"] = f"{n} times bonus."
            result[f"vo_{n}xplayfield"] = f"{n} times playfield."
    quotes = config["random_quotes"]
    assert set(quotes) == {str(n) for n in range(1, 43)}, "Incomplete random quotes"
    assert len(set(quotes.values())) == 42 and all(t.strip() for t in quotes.values())
    result.update({f"quote{n}": text for n, text in quotes.items()})
    reactions = config["toy_reactions"]
    assert reactions and len(set(reactions.values())) == len(reactions)
    assert all(text.strip() for text in reactions.values()), "Silent toy reaction"
    canonical = {f"vo_lildp{n}": text for n, text in reactions.items()}
    aliases = config["recording_aliases"]
    assert not (aliases.keys() & canonical.keys()), "Aliased canonical reaction"
    assert canonical.keys() | aliases.keys() == {f"vo_lildp{n}" for n in range(1, 45)}
    assert set(aliases.values()) <= canonical.keys(), "Unknown recording alias target"
    result.update(canonical)
    result.update({slot: canonical[target] for slot, target in aliases.items()})
    # These two IDs are referenced by the source script but missing from its sound bank.
    result["vo_enterinitials"] = "Enter your initials."
    result["vo_nocredits"] = result["nocredits"]
    if validate_source:
        source_names = {s["name"] for s in json.loads((SOURCE / "sounds.json").read_text())
                        if s["name"].startswith(("vo_", "quote")) or s["name"] in ("player", "nocredits")}
        effects = json.loads((ROOT / "design/party-audio.json").read_text())["effects"]
        source_names.difference_update(effects)
        assert source_names <= result.keys(), f"Unmapped source speech: {source_names - result.keys()}"
        assert result.keys() - source_names == {"vo_enterinitials", "vo_nocredits"} | ADDED_STORY_IDS | ADDED_EVENT_IDS
    return config, result


def recording_lines(config, mapping):
    chatter = {f"quote{n}" for n in config["random_quotes"]}
    return {name: text for name, text in mapping.items()
            if name not in chatter and name not in config["recording_aliases"]}


def pcm(path):
    with wave.open(str(path), "rb") as wav:
        assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) == (32000, 2, 2)
        return wav.readframes(wav.getnframes())


def write_pcm(path, frames):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(32000)
        wav.writeframes(frames)


def voice_role(config, name):
    for role, voice in config["voices"].items():
        if name in voice.get("slots", ()) or ("prefix" in voice and name.startswith(voice["prefix"])):
            return role
    return "finni"


def synthesize(config, reads, cache):
    model = config["model"]
    paths = {}
    for role, text in sorted(set(reads)):
        voice = config["voices"][role]["id"]
        signature = json.dumps([model, voice, text, "pcm-v1"])
        paths[role, text] = cache / (hashlib.sha256(signature.encode()).hexdigest() + ".wav")

    missing = [(read, path) for read, path in paths.items() if not path.exists()]
    if missing:
        api = runpy.run_path(str(ROOT / "scripts/voice-ai.py"))
        key = api["retrieve_key"]()

        def generate(item):
            (role, text), path = item
            voice = config["voices"][role]["id"]
            mp3 = path.with_suffix(".mp3")
            # Keep a successful response if a later local conversion fails.
            if not mp3.exists():
                body = json.dumps({"text": text, "model_id": model}).encode("utf-8")
                audio, headers = api["api_request"](
                    f"/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
                    key, body, "application/json",
                )
                if not audio or not headers.get("Content-Type", "").startswith("audio/"):
                    raise ValueError(f"Expected ElevenLabs audio for role {role}")
                mp3.write_bytes(audio)
            temp = path.with_suffix(".tmp.wav")
            subprocess.run([str(FF), "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp3),
                            "-af", "highpass=f=85,lowpass=f=10500,loudnorm=I=-18:TP=-2:LRA=7",
                            "-ar", "32000", "-ac", "2", "-c:a", "pcm_s16le", str(temp)], check=True)
            pcm(temp)
            temp.replace(path)

        # Work in small batches so a provider failure stops further requests.
        with ThreadPoolExecutor(max_workers=2) as executor:
            for offset in range(0, len(missing), 2):
                list(executor.map(generate, missing[offset:offset + 2]))
                done = min(offset + 2, len(missing))
                if done % 10 == 0 or done == len(missing):
                    print(f"VOICE_PROGRESS {done}/{len(missing)} new reads", flush=True)

    for path in paths.values():
        pcm(path)
    return paths


def build(destination, validate_source=True):
    config, mapping = lines(validate_source=validate_source)
    cache = destination / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    roles = {name: voice_role(config, name) for name in mapping}
    reads = [(roles[name], text) for name, text in mapping.items()]
    generated = synthesize(config, reads, cache)
    report = {"model": config["model"], "voices": config["voices"], "callouts": {}}
    for name, text in mapping.items():
        path = destination / (name + ".wav")
        shutil.copyfile(generated[roles[name], text], path)
        frames = pcm(path)
        report["callouts"][name] = {"text": text, "role": roles[name], "silent": False,
                                    "seconds": len(frames) / (32000 * 4),
                                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    preview = []
    for name in ("vo_deadpool", "vo_chooseyourbattle", "vo_juggernaut", "vo_mystique", "vo_sabretooth",
                 "vo_trex", "vo_megalodon", "vo_sauron", "vo_mrsinister",
                 "vo_lockislit", "vo_ball1locked", "vo_friendshipmb", "vo_lildp_multiball2",
                 "vo_caketimetoppings", "vo_caketimefinish", "vo_jackpot", "vo_ballsaved",
                 "vo_spinnerrush", "vo_katanaramaisready", "vo_supplyrun", "vo_confettiburst",
                 "quote1", "quote2", "quote3", *(f"vo_lildp{slot}" for slot in config["toy_reactions"]), "vo_discoloops"):
        preview.extend((pcm(destination / (name + ".wav")), bytes(32000)))
    write_pcm(destination / "finni-callouts-sampler.wav", b"".join(preview))
    (destination / "voice-report.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def install(table, destination):
    report = json.loads((destination / "voice-report.json").read_text())
    metadata = json.loads((table / "sounds.json").read_text())
    existing = {s["name"].lower(): s for s in metadata}
    script = (table / "script.vbs").read_bytes()
    for name in report["callouts"]:
        entry = existing.get(name.lower())
        if entry is None:
            entry = dict(existing["nocredits"], name=name)
            metadata.append(entry)
        for old in (table / "sounds").iterdir():
            if old.stem.lower() == name.lower():
                old.unlink()
        shutil.copyfile(destination / (name + ".wav"), table / "sounds" / (entry["name"] + ".wav"))
        entry["path"] = entry["name"] + ".wav"
        entry["internal_name"] = ""
    (table / "sounds.json").write_text(json.dumps(metadata, indent=2) + "\n")
    assert script == (table / "script.vbs").read_bytes()
    return len(report["callouts"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "output/finni-voice")
    parser.add_argument("--install", type=Path)
    args = parser.parse_args()
    report = build(args.output)
    if args.install:
        print("Installed", install(args.install, args.output), "Finni voice slots")
    print("FINNI_VOICE_READY", len(report["callouts"]))
