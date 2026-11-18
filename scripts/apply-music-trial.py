"""Install Funkorama in regular-play and title-screen slots, with embedded credit."""
import argparse
import hashlib
import json
import shutil
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FF = ROOT / ".tools/pydeps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe"


def install(table):
    config = json.loads((ROOT / "design/music-trial.json").read_text())
    original = ROOT / config["source_file"]
    original.parent.mkdir(parents=True, exist_ok=True)
    if not original.exists():
        urllib.request.urlretrieve(config["source_url"], original)
    assert hashlib.sha256(original.read_bytes()).hexdigest() == config["sha256"], "Music source checksum mismatch"
    out = ROOT / "output/party-audio"
    converted = out / "funkorama-trial.ogg"
    subprocess.run([str(FF), "-hide_banner", "-loglevel", "error", "-y", "-i", str(original),
                    "-map", "0:a:0", "-vn", "-sn", "-dn",
                    "-af", "loudnorm=I=-20:TP=-2:LRA=9", "-ar", "32000", "-ac", "2",
                    "-c:a", "libvorbis", "-q:a", "5", str(converted)], check=True)
    entries = json.loads((table / "sounds.json").read_text())
    by_name = {s["name"].lower(): s for s in entries}
    for name in config["ids"]:
        entry = by_name[name]
        for old in (table / "sounds").iterdir():
            if old.stem.lower() == name:
                old.unlink()
        shutil.copyfile(converted, table / "sounds" / (entry["name"] + ".ogg"))
        entry["path"] = entry["name"] + ".ogg"
        entry["internal_name"] = ""
    (table / "sounds.json").write_text(json.dumps(entries, indent=2) + "\n")
    credit = ('"Funkorama" Kevin MacLeod (incompetech.com)\n'
              'Licensed under Creative Commons: By Attribution 4.0 License\n'
              'https://creativecommons.org/licenses/by/4.0/\n'
              + config["source_page"] + '\n' + config["changes"])
    info = json.loads((table / "info.json").read_text())
    marker = "\n\nFinni music trial credits:\n"
    info["table_description"] = (info.get("table_description") or "").split(marker)[0] + marker + credit
    (table / "info.json").write_text(json.dumps(info, indent=2) + "\n")
    (out / "MUSIC-CREDITS.txt").write_text(credit + "\n")
    (out / "music-trial-report.json").write_text(json.dumps(dict(config,
        installed_sha256=hashlib.sha256(converted.read_bytes()).hexdigest()), indent=2) + "\n")
    return len(config["ids"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", type=Path, default=ROOT / ".work/finni-live-extracted")
    args = parser.parse_args()
    print("FUNKORAMA_READY", install(args.install))
