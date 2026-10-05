# Infinity AI Avatar — Phase-2 Lifelike Motion (scaffold)

This directory holds the avatar emotion system (shipped) and the interface +
plan for the future **lifelike avatar** (phase 2, not yet implemented).

## What exists today

| File | Status | Purpose |
|---|---|---|
| `emotionPicker.js` | Shipped | Deterministic rule-based emotion per assistant reply: `happy` / `angry` / `surprised` / `thinking` / `neutral`. Keyword + intent rules, dependency-free, unit-testable. |
| `motionInterface.js` | Shipped (scaffold) | JS contract for the phase-2 motion driver: `startSession(avatarImage)` / `renderFrame(emotion, audioChunk)` / `stopSession()`. `NoopMotionDriver` satisfies it with zero side effects. |
| `README.md` | This file | Phase-2 plan. |
| `THIRD_PARTY_NOTICES.md` | Shipped | License attributions. |

The frontend renders emotions today with CSS/SVG variants of the existing
human-like avatar (`frontend/src/components/fx/Avatar.jsx`) — no emoji anywhere.

## Phase-2 plan: LivePortrait + MuseTalk sidecar

The long-term goal is a lifelike talking head (LivePortrait-class) that the
user sees in the Hunt view and in Infinity AI. Chosen stack (see the
integration research report):

- **LivePortrait** (KwaiVGI, MIT license) — image-driven portrait animation.
  Takes one reference portrait and a driving signal (head pose + expression)
  and renders a photorealistic animated head at real-time frame rates.
- **MuseTalk** (TMElyralab, MIT license) — real-time lip-sync from audio.
  Takes the PCM speech audio and drives the mouth region so speech looks
  natural. Use its `realtime_inference` path.

### Proposed pipeline (owner's GPU machine)

```
reference portrait (user picks male/female)
        │
        ▼
┌──────────────────┐   emotion template clips (.pkl, one per emotion)
│  LivePortrait    │◄──────────────────────────────────  happy / angry /
│  (pose+express)  │     rendered once from driving videos of a real face
└────────┬─────────┘
         │  frame + pose
         ▼
┌──────────────────┐   16 kHz mono PCM from Infinity Voice / browser TTS
│  MuseTalk        │◄──────────────────────────────────
│  realtime_inference│
└────────┬─────────┘
         │  final frames (H.264 / MJPEG)
         ▼
  backend motion driver ──► frontend <video>/<canvas> stream
```

1. **Face analysis swap:** LivePortrait's reference implementation depends on
   **InsightFace `buffalo_l`**, whose license is **non-commercial — it is NOT
   bundled or vendored here.** Replace it with **MediaPipe Face Mesh**
   (Apache 2.0): extract the 468-landmark face mesh from the reference
   portrait and feed the landmarks into LivePortrait's motion pipeline in
   place of InsightFace's keypoints. This is the one integration task that
   needs a computer-vision engineer, and it is documented explicitly so the
   company never ships non-commercial code.
2. **Emotion template library:** for each of the five emotions
   (`happy`, `angry`, `surprised`, `thinking`, `neutral`), record a short
   driving clip of a real face and pre-render a LivePortrait `.pkl`
   expression template. The backend's `emotionPicker` output selects the
   template; `renderFrame(emotion, audioChunk)` blends it with the live
   audio-driven lip-sync.
3. **Sidecar protocol:** a small Python service (FastAPI or gRPC) exposing
   `POST /session/start {image}`, `POST /session/{id}/frame {emotion, audio}`,
   `POST /session/{id}/stop`. The Node backend talks to it over HTTP using
   the contract in `motionInterface.js`; `AVATAR_SIDECAR_URL` configures the
   address. No frames are stored — sessions are in-memory and torn down on
   `stopSession()`.
4. **Frontend:** the overlay keeps its layout; the `<Avatar>` SVG is swapped
   for a video/canvas element fed by the frame stream. Emotion, mute, and
   captions keep working unchanged.

### GPU requirements (owner's machine)

- NVIDIA GPU with **8 GB+ VRAM** (LivePortrait real-time + MuseTalk).
- CUDA 11.8+ / cuDNN, Python 3.10, PyTorch 2.x.
- Expected footprint: ~2–4 GB of model weights (downloaded once on the
  owner's machine — never in this repo, never in CI).

### Why phase 2 is scaffold-only now

The build machine has no GPU, and the models are multi-GB downloads. Phase 1
ships the emotion contract, the driver interface, and these docs so phase 2
is a pure implementation task: write the Python sidecar, swap MediaPipe for
InsightFace, and point `AVATAR_SIDECAR_URL` at it.

## Product naming

All user-visible surfaces say **Infinity AI**. The upstream project names
(LivePortrait, MuseTalk, MediaPipe) appear only in code comments, this README,
and `THIRD_PARTY_NOTICES.md` — never in the product UI.
