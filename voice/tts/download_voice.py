"""Download Piper voice models for the Dark Matter TTS service.

Voices come from the official rhasspy/piper-voices Hugging Face repo
(the same source as https://github.com/rhasspy/piper/releases):

    https://huggingface.co/rhasspy/piper-voices/resolve/main/<lang>/<locale>/<speaker>/<quality>/<voice-id>.onnx
    https://huggingface.co/rhasspy/piper-voices/resolve/main/<lang>/<locale>/<speaker>/<quality>/<voice-id>.onnx.json

Each voice needs BOTH the .onnx model and its .onnx.json config.

Usage:
    python download_voice.py en_US-amy-medium            # one voice
    python download_voice.py --all                      # all curated voices
    python download_voice.py --list                     # list curated voices

Files land in PIPER_VOICES_DIR (default ~/.local/share/piper/voices).
"""

import argparse
import json
import os
import sys
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

with open(os.path.join(_HERE, "voices.json"), encoding="utf-8") as fh:
    CURATED = json.load(fh)

CURATED_IDS = [v["id"] for v in CURATED]


def voice_url_parts(voice_id):
    """Split 'en_US-amy-medium' -> (lang_dir, locale, speaker, quality)."""
    locale, speaker, quality = voice_id.rsplit("-", 2)
    lang_dir = locale.split("_")[0]
    return lang_dir, locale, speaker, quality


def download(voice_id, dest_dir):
    lang_dir, locale, speaker, quality = voice_url_parts(voice_id)
    os.makedirs(dest_dir, exist_ok=True)
    for ext in (".onnx", ".onnx.json"):
        filename = f"{voice_id}{ext}"
        url = (f"{BASE_URL}/{lang_dir}/{locale}/{speaker}/"
               f"{quality}/{filename}")
        dest = os.path.join(dest_dir, filename)
        if os.path.isfile(dest):
            print(f"  [skip] {filename} (already present)")
            continue
        print(f"  [get ] {url}")
        try:
            urllib.request.urlretrieve(url, dest)
        except Exception as exc:
            print(f"  [FAIL] {filename}: {exc}")
            if os.path.isfile(dest):
                os.remove(dest)
            return False
        # Hugging Face returns a 15-byte body when the file doesn't exist
        if os.path.getsize(dest) < 1024:
            print(f"  [FAIL] {filename}: file missing at that quality "
                  f"({os.path.getsize(dest)} bytes)")
            os.remove(dest)
            return False
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("voice", nargs="?",
                        help="voice id, e.g. en_US-amy-medium")
    parser.add_argument("--all", action="store_true",
                        help="download every curated voice in voices.json")
    parser.add_argument("--list", action="store_true",
                        help="list curated voice ids")
    parser.add_argument("--dir", default=None,
                        help="destination dir (default: $PIPER_VOICES_DIR "
                             "or ~/.local/share/piper/voices)")
    args = parser.parse_args()

    if args.list:
        for v in CURATED:
            print(f'{v["id"]:28} {v["name"]:12} {v["lang"]}')
        return 0

    dest_dir = args.dir or os.path.expandvars(os.path.expanduser(
        os.environ.get("PIPER_VOICES_DIR",
                       os.path.join("~", ".local", "share", "piper", "voices"))))

    targets = CURATED_IDS if args.all else ([args.voice] if args.voice else [])
    if not targets:
        parser.print_usage(sys.stderr)
        return 2

    failed = []
    for vid in targets:
        print(f"Downloading {vid} ...")
        if not download(vid, dest_dir):
            failed.append(vid)
    if failed:
        print("FAILED:", ", ".join(failed))
        return 1
    print("All requested voices downloaded to", dest_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
