# Dark Matter backend — orchestrator (rewritten 2 Nov 2026)

Node.js + Express orchestrator. It runs hunts in per-hunt Docker
containers driven by the backend's own hunt loop (human-mode:
`humanLoop.js` + brain provider), serves the frontend API, and
stores hunt state, credits, and encrypted plugin keys. Auth is
built in (JWT; signup requires admin approval — see Security
notes). This file replaces the 13 Oct 2026 rebuild note, whose
headline claims no longer matched the code (see issue #440).

## Quick start

```bash
cd backend
npm install
npm start            # -> http://localhost:4000
curl http://localhost:4000/api/v1/health   # {"ok":true}
```

No external LLM API key is required for the core flows (health,
plugins, models catalog, chat summaries, reports). Hunt creation
needs `confirmedAuthorized: true` (plus SSRF, control-level, and
credit checks) — there is no target allowlist since its
15 Oct 2026 removal by owner order, and human-mode hunts do not
need a separate PentAGI engine process.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Listen port (Render injects its own) |
| `ENGINE_URL` | `http://localhost:8080` | PentAGI hunt engine base URL (engine-bridge path; see below) |
| `ENGINE_TOKEN` | _(empty)_ | Bearer token sent to the engine, if set |
| `ENGINE_TIMEOUT_MS` | `8000` | Engine request timeout — failures surface as HTTP 502, never a hang |
| `VOICE_URL` | `http://localhost:8001` | Voice service base URL (STT/TTS proxy) |
| `VOICE_TIMEOUT_MS` | `30000` | Voice proxy timeout |
| `ALLOWED_TARGETS` | _(empty)_ | Parsed but INERT since the 15 Oct 2026 owner-order removal: it no longer gates hunt creation. Retained in config only; do not rely on it. |
| `PLUGIN_MASTER_KEY` | _(empty)_ | 64-hex (32-byte) master key for AES-256-GCM plugin-key encryption. Generate: `openssl rand -hex 32`. If unset, an ephemeral key is generated at boot (warning logged) and stored keys do **not** survive restarts. |
| `DATA_DIR` | `./data` | Local storage: encrypted plugin keys, model download jobs, hunt event cache |
| `STREAM_POLL_MS` | `1000` | WS stream bridge poll interval against the engine's REST events endpoint |

See `.env.example` for a ready-to-copy template.

## API contract (all under `/api/v1`)

Routers mounted by `src/server.js`: `/hunts`, `/auth`, `/admin`,
`/chat`, `/chats`, `/plugins`, `/models`, `/voice`, `/payments`,
`/notifications`, plus `/health` and WS streams (`/hunts/:id/stream`,
`/hunts/:id/terminal`, `/hunts/:id/control`).

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | → `{ok:true}` |
| POST | `/auth/signup` `/login` | JWT auth. Signup creates a pending account; an admin must approve it before login works. |
| GET | `/auth/me` | Current user (requires a valid token). |
| POST | `/chat` | `{message, huntId?}` → `{reply}`. With `huntId`: reply includes live hunt status context + cached findings. Steering: "pause the hunt", "resume", "stop the hunt", "what did you find" / "status" map to hunt actions / summaries. Chat replies are produced by the brain provider (Meta / OpenRouter), not templates. |
| WS | `/hunts/:id/stream` | Live event stream. See "Streaming bridge" below. |
| POST | `/hunts` | `{target, scope, confirmedAuthorized:true}` → `{huntId}`. **Authorized-targets-only**: 403 unless `confirmedAuthorized === true` (plus SSRF, control-level, and credit checks); rejections are logged. No allowlist. |
| POST | `/hunts/:id/pause` `/resume` `/stop` | Hunt lifecycle (checkpoint + terminal-stop on pause; resume continues or recreates carrying the checkpoint). |
| GET | `/hunts/:id` | Hunt status snapshot. |
| GET | `/hunts/:id/report?format=md\|pdf` | Report from the **local event cache** — works at any time, even mid-hunt. PDF rendered with pdfkit (bundled); if rendering ever fails, markdown is returned with an `X-Report-Note` header. Unknown hunt → 404. Requires auth. |
| GET | `/plugins/providers` | Provider catalog (`github`, `shodan`, `virustotal`, `payloads`, built-in) with `{id, name, configured}` — **keys are never returned**. |
| PUT | `/plugins/providers/:id` | `{apiKey, baseUrl?, model?, extra?}` → stored **AES-256-GCM encrypted** (master key from `PLUGIN_MASTER_KEY`). Never logged, never returned after save. Empty `apiKey` clears the provider. Requires auth. |
| GET | `/models` | Downloadable model catalog (faster-whisper sizes + real Piper voice IDs) with latest download-job status. |
| POST | `/models/download` | `{modelId}` → `{jobId, status:"queued"}` (202); best-effort local download attempted, status tracked in `data/model-downloads.json`. `GET /models/downloads/:jobId` for status. |
| POST | `/voice/stt` | `multipart/form-data {audio}` → proxied to voice service. Requires auth. |
| POST | `/voice/tts` | `{text, voice?}` → audio stream proxied to voice service. Requires auth. |

## Engine bridge (for the engine agent)

The backend **assumes** the following engine REST contract. If the engine
implements different paths, align here or change them in `src/engine.js`:

```
POST {ENGINE_URL}/api/v1/hunts                    {target, scope}  -> {huntId} (or {id})
GET  {ENGINE_URL}/api/v1/hunts/:id                -> {huntId, target, state, stepCount, phase, findings?}
POST {ENGINE_URL}/api/v1/hunts/:id/pause
POST {ENGINE_URL}/api/v1/hunts/:id/resume
POST {ENGINE_URL}/api/v1/hunts/:id/stop
GET  {ENGINE_URL}/api/v1/hunts/:id/events?since=<seq> -> {events:[{seq, type, ...}]} (array also accepted)
```

Event `type` values: `"thinking" | "tool_call" | "finding" | "status" | "done"`.
`Authorization: Bearer <ENGINE_TOKEN>` is sent when the token is set.

**Failure policy:** engine unreachable (connection refused, timeout, DNS) →
HTTP **502** `{ok:false, error:"engine_unreachable", message: ...}`. The
backend never hangs on the engine and never returns faked success.

## Streaming bridge

The PentAGI engine exposes no WebSocket/SSE feed (as far as documented), so
`WS /api/v1/hunts/:id/stream` **polls** `GET .../hunts/:id/events?since=<seq>`
every `STREAM_POLL_MS` (default 1s) per connected client:

1. On connect: locally cached events are replayed, then a live status snapshot
   is sent.
2. New events are forwarded as `{type, ...payload}` and cached to
   `data/hunts/<huntId>/events.jsonl`.
3. A `done` event closes the socket cleanly; engine unreachable → one
   `{type:"status", state:"engine_unreachable"}` event then close with code 1011.

If the engine later gains SSE/WS, swap the poll loop in `src/server.js` —
the outbound contract to the frontend stays identical.

## Security notes

- Hunt creation requires per-request `confirmedAuthorized: true`
  (plus SSRF, control-level, and credit checks). There is no
  allowlist gate since the 15 Oct 2026 owner-order removal.
- Auth is built in: JWT sessions; signup creates a pending
  account that an admin must approve; admins can block/reject
  accounts, and blocked/demoted users lose access even with a
  live token (the auth middleware re-reads the user store).
- Plugin keys: AES-256-GCM at rest; master key from env only; never logged;
  never returned over the API. GET catalog exposes only `configured` booleans.

## Deploy

`render.yaml` (web service, `npm install` build, `npm start`, health check
`/api/v1/health`) and the EC2 auto-deploy workflow
(`.github/workflows/deploy-backend.yml`, on push to main touching
`backend/**`). Which backend target is currently live is open per
issue #430 — see DEVELOPERS.md Infrastructure for the two-target
picture. Set `ENGINE_URL`, `ENGINE_TOKEN`,
`PLUGIN_MASTER_KEY` in the Render dashboard (marked `sync: false`).
Alternatively `docker build -t dm-backend . && docker run -p 4000:4000 dm-backend`.

## Remaining gaps (honest)

- Model downloads are best-effort and async; `queued`/`failed` statuses are
  honest, not guaranteed completions.
- The engine contract above is assumed — must be aligned with the engine agent.
- Kept accurate from the old note: port 4000, health shape `{"ok":true}`,
  models catalog content (faster-whisper + Piper IDs match
  `routes/models.js`), voice proxy paths.
