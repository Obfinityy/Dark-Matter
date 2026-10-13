"""Pre-download (warm the cache for) the faster-whisper model.

faster-whisper auto-downloads the model from Hugging Face on first use;
this script does that download ahead of time so the first /stt request
is fast.

Usage:
    python download_model.py [--model small]

Approximate download sizes (faster-whisper CTranslate2 int8):
    tiny   ~ 75 MB
    base   ~145 MB
    small  ~466 MB
"""

import argparse
import os


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"),
                        choices=["tiny", "base", "small", "medium", "large-v3"],
                        help="whisper model size to download")
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    print(f"Downloading faster-whisper model {args.model!r} (first use "
          f"may take a while)...")
    WhisperModel(args.model, device="cpu", compute_type="int8")
    print(f"Model {args.model!r} is cached and ready.")


if __name__ == "__main__":
    main()
