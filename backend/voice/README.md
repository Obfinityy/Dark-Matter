# Infinity Voice — Setup Guide

Infinity Voice is Dark-Matter's built-in neural text-to-speech engine.
It gives the Infinity AI avatar a natural, human-like voice — fully offline,
zero API cost, no data leaves your machine.

## One-time setup (on your machine)

```bash
# 1. Create a Python virtual environment
cd backend/voice
python3 -m venv .venv

# 2. Install PyTorch (CPU-only, ~2GB)
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu

# 3. Install the voice engine
.venv/bin/pip install -r requirements.txt
```

The first time the avatar speaks, the ~300MB voice model downloads
automatically from Hugging Face (one time only, then cached).

### Premium voice quality (optional)

For studio-quality 48kHz speech with best-in-class Hindi:

```bash
.venv/bin/pip install voxcpm
```

First run downloads ~9.5GB (one-time). The engine auto-detects VoxCPM2
and uses it; otherwise it falls back to the standard voice. No config change needed.

## How it works

- Backend auto-starts the voice service on the first `/api/v1/voice/speak` call
- Service runs on `127.0.0.1:4120` (configurable via `INFINITY_VOICE_PORT`)
- Model loads once (~30-60s first time), then speech is fast (~7s per sentence)
- Frontend plays the audio and drives the avatar's lip-sync from the
  REAL audio amplitude via the Web Audio API

## Voices

| ID | Name | Gender | Description |
|----|------|--------|-------------|
| `aria` | Aria | Female | Warm and friendly (default) |
| `aria2` | Aria Soft | Female | Soft and calm |
| `kai` | Kai | Male | Warm male |
| `kai2` | Kai Deep | Male | Deep, authoritative |

The avatar's voice follows the gender toggle: female → Aria, male → Kai.
Use the 🔊/🔇 button in the avatar header to mute/unmute.

## API

```
GET  /api/v1/voice/health   → { ok, ready, voices }
GET  /api/v1/voice/voices   → [{ id, label, gender, description }]
POST /api/v1/voice/speak    → { text, voice? } → audio/wav (24kHz mono)
```

## Troubleshooting

- **"Voice service did not become ready"** — check Python is installed and
  requirements are installed in `backend/voice/.venv`
- **First speak is slow** — normal, the model is loading (~30-60s)
- **No sound** — check the 🔊 button isn't muted; browser needs audio permission
