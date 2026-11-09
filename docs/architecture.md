# Architecture

Written from the code on `main` (Nov 2026). If the code and this document disagree, the code wins — open an issue to fix the document.

## Components

### Frontend — `frontend/`

React 18 + Vite 6 single-page app. The operator UI: hunts, live hunt view, mid-hunt chat, reports, plugins, admin, payments.

- **Entry:** `frontend/src/main.jsx` mounts `App` (`frontend/src/App.jsx`); styles are `design-system.css` (tokens) + `index.css` (component rules).
- **Pages** (`frontend/src/pages/`): `ChatPage`, `AdminPage`, `PluginsPage`, `ReportsPage`, `LiveMachinesPage`, `SettingsPage`, `UpiPayPage`, `LegalPage`, `AuthPage`.
- **Components** (`frontend/src/components/`): `HuntCard`, `BrainConsole`, `LiveMachine`, `Sidebar`, `TopBar`, `ChatThread`, `AuthModal`, `NewHuntModal`, and others.
- **API layer** (`frontend/src/lib/api.js`): all backend calls. The backend base URL comes from `frontend/src/config.js` — `VITE_BACKEND_URL` or the hosted default `https://api.thebhavesh.online`. There is no local-backend switcher in the UI.
- **Auth:** JWT via `frontend/src/lib/auth.jsx`; hunts require login. Pending-hunt intent survives login and opens hunt setup afterwards.
- **Tests:** none yet — the check is `npm run build`.

### Backend — `backend/`

Node.js 20+ (ESM) + Express 4 orchestrator. It **never runs hunts itself** — it bridges the frontend to the hunt engine and the scanner, and owns auth, payments, reports, and voice proxying.

- **Entry:** `backend/src/server.js` — mounts routers under `/api/v1`, serves the WebSocket hunt stream.
- **Routes** (`backend/src/routes/`): `auth.js` (signup/login, JWT, admin bootstrap), `hunts.js` (create/list/get/pause/resume/stop/report), `chat.js` (mid-hunt chat + steering), `chats.js`, `admin.js`, `plugins.js` (provider credentials, AES-256-GCM encrypted with `PLUGIN_MASTER_KEY`), `models.js`, `payments.js` (manual UPI claims + admin verification), `voice.js`, `notifications.js`.
- **Hunt engine loop** (`backend/src/humanLoop.js`, ~369 KB — the largest file in the repo): the brain loop — perceive (memory briefing + findings + machine state), think (one model call, exactly one JSON action), act (via `osControl.js`, 17 actions: shell, browser, screenshot, OCR, tools, `claim_finding`), observe, file, remember. Loop protections: stuck detector, proof-file nudge, dedup block, exhausted block.
- **Hunt agent** (`backend/src/huntAgent.js`): the newer agent driver, with `huntRunner.js` (Docker container per hunt, `dm-hunt-<huntId>`) and `huntMemory.js` (per-hunt isolated memory, state-of-mind summary, episode ledger, dead-end registry).
- **Brain** (`backend/src/brainProvider.js`, `llm.js`): provider abstraction over the model API; the brain is a stateless API — every call carries everything it needs.
- **Auto-filer** (`backend/src/autoFiler.js`): scans brain output + observations for hard evidence (e.g. a 32-char MD5 hash, a SQL error string) and files claims automatically. Strict evidence gate — verbal intent never files.
- **Verifier:** claims are verified independently by re-running their proof command; only `verified: true` findings are shown as "Confirmed" (the 100% truth rule).
- **Scanner** (`backend/src/scanner/`): deterministic rule-based scanner — no AI spend. `index.js` runs the probe battery (`probes/`, one module per vulnerability class), Nuclei templates, and differential verification (`verifier.js` wraps `hunt-intel` confirmation). Same target + same code = same result. Documented in `docs/scanner/`.
- **Hunt-intel** (`backend/src/hunt-intel/`): finding analysis — `chainEngine.js` (exploit-chain equations, BFS chaining), `differential.js` (true/false control probes, confirmation verdicts), `variantDb.js` (patch-gap variant patterns).
- **Billing** (`backend/src/billing/credits.js`): credits bookkeeping. **Access** (`backend/src/access.js`): 1-day access (`accessUntil`) granted by `grantAccess(user, 1)` after admin verification of a UPI payment claim (`paymentClaims.js`, `upiPay.js`).
- **Storage:** file-based JSON under `DATA_DIR` (default `./data`) — users, hunts, claims, events. There is no database.
- **Tests:** `node --test`, ~2,980 tests colocated as `*.test.js` next to the code they cover.

### Hunt engine — `engine/pentagi/`

PentAGI (MIT) integrated **by reference** — the hunt brain: multi-agent (Orchestrator → Researcher → Developer → Executor) with a Docker tool sandbox. The API contract is `engine/pentagi/INTEGRATION.md`. License and notice are kept in `third_party/pentagi/`; the engine is never exposed under its own name in the product UI (rebrand rule — see `AGENTS.md`).

### Voice — `voice/`

faster-whisper STT (`:8001`) + Piper TTS (`:8002`), local services. The backend proxies them (`VOICE_URL`).

### Docker — `docker/`

Hunt image (`Dockerfile.hunt`, Kali-based desktop) and engine image (`Dockerfile.engine`), Compose files, setup scripts (`setup.sh`, `setup-kali-hunt.sh`, `setup-linux.sh`), and sandbox tools (`docker/tools/`: JWT battery, Nuclei runner, API sequencer).

## Data flow — a hunt

```
Operator (frontend)
  │  POST /api/v1/hunts {target, confirmedAuthorized: true}
  ▼
Backend — auth + ALLOWED_TARGETS check (403 unless authorized)
  │
  ├─ AI hunt ──────────────▶ humanLoop / huntAgent
  │                            │ Docker container dm-hunt-<id>
  │                            │ brain ⇄ osControl ⇄ observation
  │                            │ auto-filer → claim → verifier
  │
  └─ Scanner hunt ─────────▶ backend/src/scanner
                               │ crawl → probe battery → Nuclei
                               │ differential verification
                               ▼
                          verified findings only
  ▼
Frontend — live stream (WS /api/v1/hunts/:id/stream), report (MD/PDF)
```

Key invariants: hunts require an explicitly named target + `confirmedAuthorized: true` + an `ALLOWED_TARGETS` match; testing is non-destructive; only verifier-confirmed findings are shown as "Confirmed"; every hunt runs in its own container, destroyed on hunt end.

## Deployment

- **Frontend:** Cloudflare Pages, auto-deploys on push to `main`. An emergency GitHub Pages workflow (`.github/workflows/deploy-gh-pages.yml`) also exists.
- **Backend:** two deploy paths exist in this repo — AWS EC2 via systemd (`.github/workflows/deploy-backend.yml`, runbook in `docs/aws-deploy.md`) and Render (`backend/render.yaml`). The canonical backend host is under owner review (see issue #493); do not assume one from the other.
- **CI:** `.github/workflows/ci.yml` runs the frontend build and the backend test suite on pull requests.

## Known large files (split later, not in this PR)

`backend/src/humanLoop.js` (~369 KB), `backend/src/huntAgent.js` (~175 KB), `backend/src/scanner/index.js` (~117 KB), `backend/src/routes/hunts.js` (~84 KB), `frontend/src/components/HuntCard.jsx` (~61 KB). These are flagged for a follow-up refactor, not renamed or split here.
