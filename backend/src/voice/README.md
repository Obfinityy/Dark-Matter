# Infinity Voice — studio-quality TTS tier

`backend/src/voice/ttsService.js` is the **scaffold** for the studio-quality
voice engine behind Infinity Voice. It is *not* wired into the API yet —
the current `/api/v1/voice/*` routes keep using `voiceManager` (the bundled
Python voice service) until this is set up on the owner's machine.

## Architecture

```
browser (avatar lip-sync)
   │  POST /api/v1/voice/speak  (unchanged — same 4 voice presets)
   ▼
Express voiceController
   │  today: voiceManager (bundled Python service)
   │  after setup: ttsService (this scaffold)
   ▼
TtsService
   ├─► Chatterbox-TTS-Server sidecar  (studio quality, GPU, Hindi)  [primary]
   └─► Piper local binary             (CPU fallback, real Hindi voices)
```

**Engine pick:** Chatterbox Multilingual v3 (Resemble AI, MIT) served by the
community Chatterbox-TTS-Server (FastAPI, OpenAI-compatible `/v1/audio/speech`,
SSE streaming, Docker CPU/GPU). **Piper** (MIT) is the always-on no-GPU
fallback tier with real Hindi voices (`hi_IN-priyamvada-medium`,
`hi_IN-pratham-medium`). Both are MIT-licensed — see THIRD_PARTY_NOTICES.md.

`VoiceStudio` ("voice studio.sh", debpalash/VoiceStudio) was evaluated as a
**concept reference only** — it is AGPL-3.0, so it is never vendored, linked,
or shipped here.

## Setup on the owner's machine

### Option A — sidecar (recommended, needs GPU for real-time)

1. Install the server (pick one):
   ```bash
   # Docker (GPU)
   git clone https://github.com/devnen/Chatterbox-TTS-Server
   cd Chatterbox-TTS-Server
   docker compose up -d        # serves http://127.0.0.1:8004
   ```
   CPU-only also works (`device: cpu` in `config.yaml`) but is slower than
   real-time — fine for short avatar replies, not for long narration.
2. Open the server's web UI once and place ~10s reference clips for the two
   avatar voices in `./voices` (or clone via the UI into `./reference_audio`).
3. Point the backend at it:
   ```bash
   INFINITY_TTS_URL=http://127.0.0.1:8004
   INFINITY_TTS_FEMALE_VOICE=aria      # predefined voice name on the server
   INFINITY_TTS_MALE_VOICE=kai
   INFINITY_TTS_LANGUAGE=en            # 'hi' for Hindi-first replies
   ```
4. First run downloads ~2–3 GB of model weights (one time, on that machine —
   never on this dev box).

### Option B — Piper fallback (no GPU, always works)

1. Install Piper (single binary, no Python env needed):
   ```bash
   # Linux/macOS — download a release binary from the Piper project page
   # Windows — piper.exe release zip
   ```
2. Download two Hindi ONNX voices (each 15–100 MB):
   - female: `hi_IN-priyamvada-medium.onnx`
   - male:   `hi_IN-pratham-medium.onnx`
3. Configure:
   ```bash
   INFINITY_TTS_ENGINE=auto            # sidecar first, Piper on failure
   INFINITY_PIPER_BIN=/usr/local/bin/piper
   INFINITY_PIPER_MODEL_FEMALE=/path/to/hi_IN-priyamvada-medium.onnx
   INFINITY_PIPER_MODEL_MALE=/path/to/hi_IN-pratham-medium.onnx
   ```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `INFINITY_TTS_URL` | _(empty)_ | Sidecar base URL, e.g. `http://127.0.0.1:8004` |
| `INFINITY_TTS_ENGINE` | `auto` | `auto` (sidecar → Piper) \| `sidecar` \| `piper` |
| `INFINITY_TTS_TIMEOUT_MS` | `60000` | Per-request timeout |
| `INFINITY_TTS_LANGUAGE` | `en` | Language hint sent to the sidecar (`hi` for Hindi) |
| `INFINITY_TTS_EXAGGERATION` | `0.5` | Chatterbox emotion exaggeration 0–1 |
| `INFINITY_TTS_TEMPERATURE` | `0.7` | Chatterbox sampling temperature |
| `INFINITY_TTS_FEMALE_VOICE` | `aria` | Sidecar voice name for Aria presets |
| `INFINITY_TTS_MALE_VOICE` | `kai` | Sidecar voice name for Kai presets |
| `INFINITY_TTS_FEMALE_REF` | _(empty)_ | Reference clip path (ops doc; cloning happens server-side) |
| `INFINITY_TTS_MALE_REF` | _(empty)_ | Reference clip path (ops doc; cloning happens server-side) |
| `INFINITY_PIPER_BIN` | `piper` | Piper binary path |
| `INFINITY_PIPER_MODEL_FEMALE` | _(empty)_ | Female ONNX voice model path |
| `INFINITY_PIPER_MODEL_MALE` | _(empty)_ | Male ONNX voice model path |

## Wiring it into the API (follow-up)

`backend/src/routes/index.js` currently builds the voice controller with
`voiceManager`. To switch engines, construct the controller with an adapter
around `ttsService` — the method shapes are intentionally compatible
(`speak(text, voice) → Buffer`, `health() → { ok, … }`):

```js
import { ttsService } from '../voice/ttsService.js';
// const controllers = { voice: createVoiceController({ voiceManager: ttsServiceAdapter }) }
```

The adapter maps `health()` to `{ ok, ready }` (the controller reads
`h.ok && h.ready`). Keep the `aria/aria2/kai/kai2` preset ids — the frontend
already uses them and `ttsService.listVoices()` returns the same list.

## Runtime status

- [x] Scaffold + config + Piper fallback (this machine — no GPU, no sidecar)
- [x] Voice presets mapped to existing Infinity Voice ids (frontend unchanged)
- [ ] Sidecar installed and `INFINITY_TTS_URL` set (**owner's machine**)
- [ ] Reference clips recorded for Aria/Kai (**owner's machine**)
- [ ] Controller wired to `ttsService` + spoken-reply QA (**owner's machine**)

Until then, replies keep working through the existing engine chain:
Infinity Voice Python service → browser speech fallback.
