# Dark Matter backend — full rebuild (13 Oct 2026)

Fresh Node.js + Express orchestrator. It does **not** hunt by itself: it
bridges the frontend to the **PentAGI hunt engine** (separate process, owned by
the engine agent), the **voice service** (Whisper/Piper, owned by the voice
agent), and **plugin LLM providers** (API keys managed here, encrypted).

## Quick start

```bash
cd backend
npm install
npm start            # -> http://localhost:4000
curl http://localhost:4000/api/v1/health   # {"ok":true}
```

No external LLM API key is required for the core flows (health, plugins,
models catalog, chat summaries, reports). Hunt creation needs `ALLOWED_TARGETS`
and a reachable engine.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Listen port (Render injects its own) |
| `ENGINE_URL` | `http://localhost:8080` | PentAGI hunt engine base URL |
| `ENGINE_TOKEN` | _(empty)_ | Bearer token sent to the engine, if set |
| `ENGINE_TIMEOUT_MS` | `8000` | Engine request timeout — failures surface as HTTP 502, never a hang |
| `VOICE_URL` | `http://localhost:8001` | Voice service base URL (STT/TTS proxy) |
| `VOICE_TIMEOUT_MS` | `30000` | Voice proxy timeout |
| `ALLOWED_TARGETS` | _(empty)_ | Comma-separated authorized-target allowlist. Entries match a target's hostname exactly, as parent domain (subdomains included), or as a full-URL prefix. **Empty = hunt creation disabled (all creates → 403).** |
| `PLUGIN_MASTER_KEY` | _(empty)_ | 64-hex (32-byte) master key for AES-256-GCM plugin-key encryption. Generate: `openssl rand -hex 32`. If unset, an ephemeral key is generated at boot (warning logged) and stored keys do **not** survive restarts. |
| `DATA_DIR` | `./data` | Local storage: encrypted plugin keys, model download jobs, hunt event cache |
| `STREAM_POLL_MS` | `1000` | WS stream bridge poll interval against the engine's REST events endpoint |

See `.env.example` for a ready-to-copy template.

## API contract (all under `/api/v1`)

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | → `{ok:true}` |
| POST | `/chat` | `{message, huntId?}` → `{reply}`. With `huntId`: reply includes live hunt status context (engine) + cached findings. Steering: "pause the hunt", "resume", "stop the hunt", "what did you find" / "status" map to hunt actions / summaries. |
| WS | `/hunts/:id/stream` | Live event stream. See "Streaming bridge" below. |
| POST | `/hunts` | `{target, scope, confirmedAuthorized:true}` → `{huntId}`. **Authorized-targets-only**: 403 unless `confirmedAuthorized === true` AND target matches `ALLOWED_TARGETS`; rejections are logged. |
| POST | `/hunts/:id/pause` `/resume` `/stop` | Proxied to the engine. |
| GET | `/hunts/:id` | Engine status snapshot. |
| GET | `/hunts/:id/report?format=md\|pdf` | Report from the **local event cache** — works at any time, even mid-hunt. PDF rendered with pdfkit (bundled); if rendering ever fails, markdown is returned with an `X-Report-Note` header. Unknown hunt → 404. |
| GET | `/plugins/providers` | Provider catalog (Groq, Gemini, NVIDIA, OpenRouter, DeepSeek, Custom, AWS, Local) with `{id, name, configured}` — **keys are never returned**. |
| PUT | `/plugins/providers/:id` | `{apiKey, baseUrl?, model?, extra?}` → stored **AES-256-GCM encrypted** (master key from `PLUGIN_MASTER_KEY`). Never logged, never returned after save. Empty `apiKey` clears the provider. |
| GET | `/models` | Downloadable model catalog (faster-whisper sizes + real Piper voice IDs) with latest download-job status. |
| POST | `/models/download` | `{modelId}` → `{jobId, status:"queued"}` (202); best-effort local download attempted, status tracked in `data/model-downloads.json`. `GET /models/downloads/:jobId` for status. |
| POST | `/voice/stt` | `multipart/form-data {audio}` → proxied to voice service. |
| POST | `/voice/tts` | `{text, voice?}` → audio stream proxied to voice service. |

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

- Hunt creation is **allowlist-gated** (`ALLOWED_TARGETS`) **plus**
  per-request `confirmedAuthorized: true`. Both required; rejections logged.
- Plugin keys: AES-256-GCM at rest; master key from env only; never logged;
  never returned over the API. GET catalog exposes only `configured` booleans.
- No auth layer is built into this rebuild yet — treat deployment as
  internal/trusted-network until auth is added (open gap, see below).

## Deploy (Render)

`render.yaml` (web service, `npm install` build, `npm start`, health check
`/api/v1/health`). Set `ENGINE_URL`, `ENGINE_TOKEN`, `ALLOWED_TARGETS`,
`PLUGIN_MASTER_KEY` in the Render dashboard (marked `sync: false`).
Alternatively `docker build -t dm-backend . && docker run -p 4000:4000 dm-backend`.

## Remaining gaps (honest)

- No authentication/authorization on the API yet (see Security notes).
- Chat replies are template/summary-based (no external LLM needed) — richer
  generation can be wired to plugin providers later.
- Model downloads are best-effort and async; `queued`/`failed` statuses are
  honest, not guaranteed completions.
- The engine contract above is assumed — must be aligned with the engine agent.
