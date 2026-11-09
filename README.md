# Dark Matter — Autonomous Bug-Bounty Agent

> **Hire an elite bug-bounty hunter. Give it a link. It does the rest.**

Dark Matter by **Obfinity** is an autonomous AI security researcher that works like an elite human bug-bounty hunter — not a vulnerability scanner. An Obfinity operator hands it an authorized target, and it takes it from there: understanding the application, following its curiosity, testing its own hypotheses, verifying what it finds, and writing a professional report.

**Live site:** https://hackwithai.xyz/

---

## What it is

Most security tools run a checklist: test for SQL injection, then XSS, then move on. Dark Matter works the way a hired expert works:

1. **An operator submits a link** — a target Obfinity is authorized to test.
2. **It runs in a dedicated cloud environment** — every test executes in an isolated container. Operator infrastructure is never touched.
3. **It understands the app first** — before testing anything, it builds a mental model: *what does this app do, where does money flow, where does trust flow, who controls this number?*
4. **It follows curiosity, not a checklist** — like a human, it notices things that look odd and wonders "what if I…". A price it can see, an ID that looks guessable, a step in a checkout that could be skipped — it pulls those threads.
5. **It verifies before it reports** — every finding goes through confirmation probes. Unreproducible results are discarded, not reported. Only verified vulnerabilities reach the operator.
6. **It remembers** — everything it learns is saved to its persistent memory, so each hunt makes it sharper.

The product has two hunting modes: an AI-driven hunt (the brain plans and acts in a loop) and a deterministic rule-based scanner (`backend/src/scanner/`) that runs predefined probes with differential verification — no AI spend, same result for the same target and code.

---

## What it can do

- **Reconnaissance** — maps the attack surface: endpoints, parameters, technologies, authentication flows.
- **Business-logic testing** — the bugs scanners miss: price manipulation, quantity tampering, IDOR, workflow bypasses, coupon/credit abuse, state-machine flaws.
- **Classic vulnerability classes** — SQL/NoSQL injection, XSS, SSRF, authentication bypasses, access-control flaws.
- **Exploit chaining** — connects smaller findings into higher-impact chains (three mediums can become one critical).
- **Differential verification** — every finding is confirmed with true/false control probes before it's reported.
- **Professional reporting** — one-click reports (Markdown/PDF) with evidence, reproduction steps, and impact — ready for human review before any submission.
- **Mid-hunt collaboration** — chat with the agent while it works: ask what it's found, steer it toward an area, pause or stop anytime.

---

## Architecture

```
┌──────────────────┐     HTTPS / REST + WebSocket      ┌──────────────────┐
│  frontend/       │ ─────────────────────────────────▶ │  backend/        │
│  Vite + React    │                                     │  Node 20 +       │
│  operator UI     │ ◀───────────────────────────────── │  Express         │
└──────────────────┘     live hunt events               │  orchestrator    │
                                                         └──────┬───────────┘
                                                                │
                                        ┌───────────────────────┼───────────────────────┐
                                        ▼                       ▼                       ▼
                                 engine/pentagi/        backend/src/scanner/    voice/
                                 hunt brain (by         deterministic rule-     faster-whisper
                                 reference, MIT)        based scanner           STT + Piper TTS
                                        │                       │
                                        ▼                       ▼
                                 docker/ hunt containers (one isolated container per hunt)
```

| Part | What it is | Entry point |
|---|---|---|
| `frontend/` | React 18 + Vite 6 single-page app — the operator UI (hunts, live view, chat, reports, admin) | `frontend/src/main.jsx` |
| `backend/` | Node.js (ESM) + Express 4 orchestrator — auth, hunts, chat, reports, payments, voice proxy. Never runs hunts itself. | `backend/src/server.js` |
| `backend/src/scanner/` | Deterministic rule-based scanner — predefined probes with differential verification, no AI spend | `backend/src/scanner/index.js` |
| `backend/src/hunt-intel/` | Finding analysis — exploit chains, confirmation probes, variant mining | `backend/src/hunt-intel/index.js` |
| `engine/pentagi/` | PentAGI hunt engine, integrated by reference (MIT, credited in `third_party/pentagi/`) | `engine/pentagi/INTEGRATION.md` |
| `voice/` | faster-whisper STT (:8001) + Piper TTS (:8002), local services | `voice/README.md` |
| `docker/` | Hunt + engine images, Compose files, sandbox tools | `docker/README.md` |

Storage is file-based JSON under the backend data directory (`DATA_DIR`) — there is no database. See [`docs/architecture.md`](docs/architecture.md) for the full picture.

---

## Quickstart

### Prerequisites

- Node.js **20+** and npm
- Docker (only if you want to run the hunt engine / hunt containers locally)
- No LLM API key is needed for the core flows (health, auth, reports). Creating a hunt needs `ALLOWED_TARGETS` and a reachable engine — see below.

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in JWT_SECRET at minimum; see the table below
npm start              # → http://localhost:4000
curl http://localhost:4000/api/v1/health   # → {"ok":true}
```

| Variable | Purpose |
|---|---|
| `PORT` | Listen port (default `4000`) |
| `JWT_SECRET` | Signs auth tokens — **required, generate a long random value** |
| `DATA_DIR` | File storage for users, hunts, claims (default `./data`) |
| `ALLOWED_TARGETS` | Comma-separated authorized-target allowlist. Empty = hunt creation disabled (all creates → 403) |
| `ENGINE_URL` | PentAGI hunt engine base URL (default `http://localhost:8080`) |
| `PLUGIN_MASTER_KEY` | 64-hex key for AES-256-GCM plugin-key encryption (`openssl rand -hex 32`) |
| `CORS_ORIGINS` | Allowed frontend origins |

Full list with defaults: [`backend/.env.example`](backend/.env.example). Never commit `.env`.

### Frontend

```bash
cd frontend
npm install
npm run dev            # → http://localhost:5173
```

| Variable | Purpose |
|---|---|
| `VITE_BACKEND_URL` | Backend API base. Unset = local default; production sets it to the live backend URL |

Production frontend deploys automatically to Cloudflare Pages on push to `main`. See [`frontend/README.md`](frontend/README.md).

### Engine (optional, for real hunts)

```bash
cd docker && ./setup.sh   # Docker + PentAGI stack — see engine/pentagi/INTEGRATION.md
```

---

## Repository structure

```
Dark-Matter/
├── README.md                    # This file
├── CONTRIBUTING.md              # How to contribute
├── SECURITY.md                  # How to report vulnerabilities
├── AGENTS.md                    # Onboarding guide for AI coding agents
├── DEVELOPERS.md                # Complete technical reference
├── VISION.md                    # Product vision
├── PROOF.md                     # Live proof log (verified hunt results)
├── THIRD_PARTY_NOTICES.md       # Third-party licenses
├── frontend/                    # React SPA (operator UI)
├── backend/                     # Node.js API + hunt engine + scanner
├── engine/                      # PentAGI hunt engine (by reference)
├── docker/                      # Hunt/engine images, Compose, sandbox tools
├── docs/                        # Documentation index + architecture + research
│   ├── archive/                 # Frozen history (old AI coordination log)
│   ├── proofs/                  # PDF evidence for PROOF.md
│   └── scanner/                 # Scanner probe documentation
├── ideas/                       # Feature-idea backlog (waves currently paused)
├── labs/                        # Local test labs
├── research/                    # Hunter research notes
├── third_party/                 # Vendored third-party code + licenses
└── voice/                       # STT/TTS services
```

---

## Scripts

| Command | What it does |
|---|---|
| `cd frontend && npm run dev` | Vite dev server (:5173) |
| `cd frontend && npm run build` | Production build (`vite build`) |
| `cd frontend && npm run preview` | Serve the production build locally |
| `cd backend && npm start` | Start the backend (:4000) |
| `cd backend && npm run dev` | Start with file watching (`node --watch`) |
| `cd backend && npm test` | Run the backend test suite (`node --test`) |

## Testing

- **Backend:** `cd backend && npm test` — the suite is ~2,980 tests (Nov 2026), colocated as `*.test.js` next to the code it covers. One test boots a real backend (~20s); run sequentially or at most 2-way parallel.
- **Frontend:** there is no frontend test suite yet — the check is `npm run build`. Contributions that add frontend tests are welcome.
- **Manual checks:** backend health (`GET /api/v1/health` → `{"ok":true}`), frontend in the browser. Never claim a change is done until it is verified — see [`DEVELOPERS.md`](DEVELOPERS.md) §13.

## Documentation

- [`docs/README.md`](docs/README.md) — documentation index (every doc, what it is, whether it's live or historical)
- [`docs/architecture.md`](docs/architecture.md) — architecture from the actual code
- [`DEVELOPERS.md`](DEVELOPERS.md) — complete technical reference (brain, memory, OS control, hunt lifecycle, deployment)
- [`PROOF.md`](PROOF.md) — live proof log: verified scanner hunts against lab targets, with evidence
- [`backend/README.md`](backend/README.md) — backend API contract and environment variables
- [`frontend/README.md`](frontend/README.md) — frontend setup and structure

---

## Safety

- **Authorized targets only.** Every hunt requires an explicitly named target plus `confirmedAuthorized: true`, enforced against an `ALLOWED_TARGETS` allowlist.
- **Non-destructive testing.** The agent never runs denial-of-service, brute-force, or destructive payloads.
- **Isolated execution.** Every hunt runs in its own Docker container with no access to host infrastructure. Containers are destroyed on hunt end.
- **Human review before submission.** Reports are for human review. The agent never submits to a bounty program on its own.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Short version: find or open an issue first, work on a branch, open a pull request — never push directly to `main`, and never commit secrets.

## Security

Found a vulnerability in Dark Matter itself? See [`SECURITY.md`](SECURITY.md) for how to report it.

## License

No open-source license is currently attached to this repository (`backend/package.json` declares it `UNLICENSED`; the frontend is marked private). The code is © Obfinity and is not distributed for external use. Licensing is under owner review — see issue [#493](https://github.com/Obfinityy/Dark-Matter/issues/493). Third-party components retain their own licenses — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
