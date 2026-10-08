# services/ — Frontend API Clients

All backend communication: REST clients, streaming, device detection, and
local-model helpers.

## Key files

- `api.js` — **all** backend API calls (auth, hunts, reports, billing, …)
- `voice.js` — Infinity Voice: fetch WAV → Web Audio API → live amplitude → lip-sync
- `gradioDirect.js` — direct browser → Kaggle Gradio brain link (bypasses backend)
- `localModelApi.js`, `modelDownload.js` — local model library + SSE download progress
- `chatHistory.js` — chat persistence helpers
- `backendMode.js`, `deviceDetect.js`, `permissions.js` — environment capabilities

## Conventions

- No component imports `fetch` directly — everything goes through these clients.
- `api.js` reads the auth token from `auth/AuthContext.jsx`.
