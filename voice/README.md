# Dark Matter — Local Voice Pipeline

Local speech-to-text (STT) and text-to-speech (TTS) microservices. Everything
runs on the user's own machine; **no cloud voice APIs, no keys, no accounts.**

The Node backend proxies to these services. They are intentionally separate
processes on separate ports so either can be restarted/upgraded independently.

```
voice/
  README.md          <- this file (setup + backend contract)
  stt/
    app.py           <- STT service (faster-whisper)
    requirements.txt
    download_model.py
  tts/
    app.py           <- TTS service (Piper)
    requirements.txt
    voices.json      <- curated, verified voice list (single source of truth)
    VOICES.md        <- verification report + download URLs
    download_voice.py
```

## Backend contract (the backend agent proxies to these)

### STT — http://localhost:8001

| | |
|---|---|
| Health | `GET /health` → `{"ok":true,"service":"stt","model":"small",...}` |
| Transcribe | `POST /stt` — **multipart/form-data**, field `file` = audio (wav/mp3/ogg…) |

Success response:

```json
{ "text": "hello world", "model": "small", "language": "en", "language_probability": 0.99 }
```

- `{"text": ...}` is always present on success (empty string if silence).
- Errors: `400` empty payload · `422` validation error · `503` model unavailable (missing dep / failed download).
- `language`/`language_probability` included when the model reports them.

curl example:

```bash
curl -F "file=@/tmp/clip.wav" http://localhost:8001/stt
```

### TTS — http://localhost:8002

| | |
|---|---|
| Health | `GET /health` → `{"ok":true,"service":"tts","engine":"piper-binary",...}` |
| Voices | `GET /tts/voices` → `[{"id":"en_US-amy-medium","name":"Amy","lang":"en-US","gender":"female","available":true}, ...]` |
| Speak | `POST /tts` — JSON body → **audio/wav bytes** |

Speak request:

```json
{ "text": "Namaste, main Dark Matter hoon.", "voice": "hi_IN-priyamvada-medium" }
```

- `voice` defaults to `TTS_DEFAULT_VOICE` (`en_US-amy-medium`).
- Only voice IDs from `GET /tts/voices` are accepted; unknown/download-missing IDs → `404`.
- Success: `Content-Type: audio/wav` (16-bit mono, Piper's native sample rate, usually 22050 Hz).
- Errors: `422` empty/oversized text (max 5000 chars) · `404` voice not downloaded · `503` no Piper engine installed.
- `available` in the voices list tells the backend whether the model file is on disk.

curl examples:

```bash
curl http://localhost:8002/tts/voices
curl -X POST http://localhost:8002/tts -H 'Content-Type: application/json' \
  -d '{"text":"Hello from Dark Matter","voice":"en_US-ryan-medium"}' \
  --output /tmp/out.wav
```

## Setup

Python **3.10+** (3.11/3.12 recommended). Use a venv per service.

### 1. STT (faster-whisper)

```bash
cd voice/stt
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Pre-download the model (otherwise it downloads on the first /stt call):
.venv/bin/python download_model.py          # default: small
# .venv/bin/python download_model.py --model tiny   # smaller/faster option
```

Model sizes (approx, CTranslate2 int8): `tiny` ~75 MB · `base` ~145 MB ·
`small` ~466 MB. `small` is the default — good accuracy on CPU.

Start it:

```bash
STT_PORT=8001 .venv/bin/python app.py
# or: STT_PORT=8001 .venv/bin/uvicorn app:app --port 8001
```

### 2. TTS (Piper)

```bash
cd voice/tts
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Download voices (see VOICES.md for the verified list):
.venv/bin/python download_voice.py --all            # all 8 curated voices (~500 MB total)
# .venv/bin/python download_voice.py en_US-amy-medium  # just one
```

The service needs **one** synthesis engine — it auto-detects whichever is present:

- **Option A (recommended): Piper CLI binary.** Download the `linux_x86_64`
  (or your platform's) tarball from https://github.com/rhasspy/piper/releases,
  extract, and either put `piper` on PATH or set `PIPER_BIN=/path/to/piper`.
  No extra Python deps, includes espeak-ng.
- **Option B: `piper-tts` pip package** (in requirements.txt). Also requires
  the system `espeak-ng` library (`sudo apt install espeak-ng` on Debian/Ubuntu).

Start it:

```bash
TTS_PORT=8002 PIPER_VOICES_DIR=~/.local/share/piper/voices .venv/bin/python app.py
# or: TTS_PORT=8002 .venv/bin/uvicorn app:app --port 8002
```

### Quick check

```bash
curl -s http://localhost:8001/health | python3 -m json.tool
curl -s http://localhost:8002/health | python3 -m json.tool
curl -s http://localhost:8002/tts/voices | python3 -m json.tool
```

## Environment variables

### STT

| Var | Default | Meaning |
|-----|---------|---------|
| `STT_PORT` | `8001` | listen port |
| `WHISPER_MODEL` | `small` | `tiny` / `base` / `small` (+ others faster-whisper supports) |
| `WHISPER_DEVICE` | `cpu` | `cpu` or `cuda` |
| `WHISPER_COMPUTE_TYPE` | `int8` | quantization; `float32` if accuracy matters more than speed |
| `WHISPER_LANGUAGE` | unset (auto) | e.g. `en`, `hi` — set to skip auto-detection |
| `WHISPER_PRELOAD` | `0` | `1` = load model at startup instead of first request |

### TTS

| Var | Default | Meaning |
|-----|---------|---------|
| `TTS_PORT` | `8002` | listen port |
| `PIPER_VOICES_DIR` | `~/.local/share/piper/voices` | where `<voice-id>.onnx` + `.onnx.json` live |
| `PIPER_BIN` | `piper` | path to Piper CLI binary (Option A) |
| `TTS_DEFAULT_VOICE` | `en_US-amy-medium` | voice used when the request omits `voice` |
| `TTS_LENGTH_SCALE` | `1.0` | <1 faster, >1 slower |
| `TTS_NOISE_SCALE` | `0.667` | |
| `TTS_NOISE_W` | `0.8` | |
| `TTS_SPEAKER_ID` | `0` | for multi-speaker models |

## How the backend reaches the services

Both bind **127.0.0.1 only** — they are never exposed to the network. The Node
backend (Render in Cloud mode, `localhost:4000` in My-Device mode) proxies:

- voice input: browser mic → backend → `POST http://localhost:8001/stt` → text
- voice output: chat reply → backend → `POST http://localhost:8002/tts` → wav bytes → browser audio

When the local voice stack isn't running, the backend should degrade
gracefully (e.g. browser `speechSynthesis` fallback) — a refused connection to
8001/8002 means "voice services not installed/started", never a fatal error.

## Troubleshooting

- **`POST /stt` → 503 "STT model unavailable"**: faster-whisper isn't
  installed or the model download failed. Run
  `voice/stt/.venv/bin/pip install faster-whisper` and
  `voice/stt/.venv/bin/python download_model.py`, then retry. Needs internet
  for the one-time model download.
- **`/stt` is slow**: expected on first call (model load + download). Set
  `WHISPER_PRELOAD=1` and use `tiny`/`base` for lower latency.
- **`GET /health` (TTS) shows `"engine": null`**: neither the `piper-tts`
  pip package nor a `piper` CLI binary was found. Install one (see Setup step 2).
- **`POST /tts` → 404 "voice … is not downloaded"**: run
  `voice/tts/.venv/bin/python download_voice.py <voice-id>`.
- **`POST /tts` → 503 "no Piper engine available"**: see engine-null above.
- **Hindi text spoken with an English voice**: request a `hi_IN-*` voice
  explicitly (`hi_IN-pratham-medium`, `hi_IN-priyamvada-medium`,
  `hi_IN-rohan-medium`).
- **Port already in use**: change `STT_PORT`/`TTS_PORT` and point the backend
  at the new ports.
- **Services die on logout**: run them under systemd user units or tmux on
  the user's machine; they are local-only daemons.
