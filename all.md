# Dark Matter — Complete Project Documentation

> **Company:** Obfinity | **Product:** Dark Matter (Hunt AI + Infinity AI assistant)
> **Repo:** Obfinityy/Dark-Matter | **Branch:** main
> **Last updated:** 15 Oct 2026

This file documents EVERYTHING built in this project. Nothing omitted.

---

## 1. Architecture Overview

```
┌─ frontend/          Vite + React — ChatGPT-style dark UI
│                      Deploys: Cloudflare Pages (hack.thebhavesh.online) + Vercel
│                      Auto-deploys from main branch
│
├─ backend/           Node.js (ESM) + Express — runs on AWS EC2
│                      URL: https://api.thebhavesh.online
│                      Serves: auth, chat, hunts, billing, reports, admin
│                      Hunt engine: host-side agent loop (runAutonomousHunt)
│                      AI brain: Ollama (dolphin-mistral:7b → deepseek-r1-abliterated:8b)
│                      Runs under systemd (darkmatter-backend.service)
│
├─ docker/            Kali Linux hunt container (darkmatter/hunt:latest)
│                      Each hunt spawns an isolated Kali container
│                      Tools: nmap, nikto, sqlmap, subfinder, amass, nuclei,
│                             chromium, john, selenium, python3
│                      Agent controls it via `docker exec` like a human hacker
│
├─ engine/pentagi/    PentAGI (vxcontrol, MIT) integrated BY REFERENCE
│
├─ voice/             faster-whisper STT + Piper TTS
│
└─ third_party/       Licenses and notices (legal)
```

**Topology:** Frontend (Cloudflare) → Backend (AWS EC2 ap-south-1) → Kali containers (Docker on EC2). Hunts run on EC2, NEVER on user's device. Backend + AI + hunt engine ALL on EC2.

---

## 2. Infrastructure (Live)

| Component | Details |
|-----------|---------|
| Frontend | https://hack.thebhavesh.online (Cloudflare Pages) |
| Backend | https://api.thebhavesh.online (nginx → localhost:4000) |
| EC2 | ap-south-1, m7i-flex.large (2 vCPU, 8GB RAM, 50GB gp3) |
| EC2 Public IP | 13.233.230.240 |
| EC2 Internal IP | 172.31.36.149 |
| Backend service | darkmatter-backend.service (systemd, Restart=always, boot-enabled) |
| AI Brain | Ollama on EC2 (127.0.0.1:11434), model: huihui_ai/deepseek-r1-abliterated:8b |
| Hunt containers | darkmatter/hunt:latest (Kali Linux) |
| AWS Account | 027224425643 |

---

## 3. Backend — Complete Feature List

### 3.1 Authentication (`src/routes/auth.js`)
- Invite-only: NO public signup. Admin creates every account via /admin portal
- JWT auth (Bearer token in localStorage `dm_token`)
- Admin user: Bhavesh189 (hash+salt in EC2 backend/.env)
- Control levels: minimal (Normal/Medium modes) or maximum (all modes)
- Per-user data isolation: chats, hunts, balance all scoped by userId

### 3.2 Hunt Engine (`src/huntAgent.js`)
- **Autonomous agent loop:** recon → plan → execute → verify → chain → repeat
- **UNLIMITED hunting:** no iteration cap, no rate limiter. Stops ONLY on:
  1. User force-stop
  2. Wallet balance exhaustion (pauses, resumes after top-up)
  3. AI backend unavailable (circuit breaker pauses after 3 consecutive failures)
- **Checkpoint system:** every iteration writes checkpoint (iteration, phase, timestamp) to `data/hunts/<hunt-id>/meta.json`
- **Auto-resume on boot:** hunts left 'running' auto-resume from last checkpoint; explicitly paused stays paused
- **One hunt at a time:** backend rejects new hunt if one is running/paused (409 hunt_already_running)
- **Per-hunt isolated Docker container:** auto-spawns on hunt creation, destroyed on stop/timeout
- **Cost tracking:** per-iteration charging, $0 ledger for Ollama (self-hosted)

### 3.3 Orchestrator (`src/orchestrator.js`)
- **Head (lead hacker brain):** plans strategy, spawns workers, reviews work, generates reports
- **Specialist workers:**
  - `recon` — maps target (ports, services, tech stack, subdomains)
  - `exploiter` — tests vulnerabilities like a human
  - `verifier` — independently confirms findings (only reproducible = vulnerability)
  - `reporter` — writes professional bug bounty reports
- Workers execute inside Kali container via `docker exec`
- State persisted to hunt meta for resume

### 3.4 AI Brain (`src/llm.js`)
- **Ollama route:** `OLLAMA_URL` (default http://localhost:11434), `OLLAMA_MODEL` env configurable
- **Tuned for 2vCPU:** 150s timeout + 1 retry, num_predict 600, num_ctx 8192
- **Privacy gateway:** secrets/PII stripped before model (both providers)
- **Circuit breaker:** 3 consecutive AI failures → hunt pauses with clear message
- Bedrock route exists but account-blocked ("Operation not allowed")

### 3.5 Hunt Intelligence (`src/hunt-intel/`)
- `chainEngine.js` — 30 exploit chain equations (read+write=RCE, etc.)
- `differential.js` — true/false control probes, FP rejection
- `variantDb.js` — 10 patch-gap variant patterns
- `index.js` — analysis pipeline
- Elite modules: 21 BLFinder business-logic modules, BugTraceAI evidence gate, 4-step verification

### 3.6 Chat System (`src/routes/chat.js`, `src/routes/chats.js`)
- **Mid-hunt chat:** works during running hunts (Send button independent of hunt Stop)
- **Cross-device sync:** messages sync via backend (GET/POST /api/v1/chats/:id/messages)
- **Title sync:** chat titles sync across devices
- **Delete sync:** tombstone mechanism — deleted chats don't resurrect on refresh
- **Per-user storage:** `dm.chats.<userId>` localStorage keys, backend per-user files
- **Logout isolation:** logout wipes in-memory data, shows nothing

### 3.7 Billing (`src/routes/billing.js`, Razorpay)
- Top-up credits via Razorpay (test mode)
- Per-iteration charging based on mode intensity
- Out-of-credits → hunt pauses (not stops), resumes after top-up
- Admin hunts free (owner exemption)
- Balance visible in sidebar

### 3.8 Reports (`src/routes/hunts.js` → `GET /:id/report`)
- Generate anytime: running, paused, stopped, finished, failed
- Formats: Markdown (?format=md) and PDF (?format=pdf)
- **100% truth rule:** ONLY verified findings shown as "Confirmed vulnerabilities"
- Unverified leads shown only as "N leads under investigation"
- Professional HTML styling, convertible via JS library

### 3.9 Admin Portal (`src/routes/admin.js`)
- User management (create, delete, set control level)
- **Hunt monitoring:** GET /api/v1/admin/hunts — all hunts on backend, running first
- **Memory download:** GET /api/v1/hunts/:id/memory — full hunt memory (meta + events) as JSON

### 3.10 API Routes Summary
```
GET  /api/v1/health
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/chat                          # mid-hunt chat
GET  /api/v1/chats                         # user's chat titles
POST /api/v1/chats/sync                   # title sync with tombstones
GET  /api/v1/chats/:id/messages
POST /api/v1/chats/:id/messages
POST /api/v1/hunts                        # {target, scope, confirmedAuthorized, mode}
GET  /api/v1/hunts                        # user's hunts
GET  /api/v1/hunts/:id
POST /api/v1/hunts/:id/pause|resume|stop
GET  /api/v1/hunts/:id/report?format=md|pdf
GET  /api/v1/hunts/:id/events
GET  /api/v1/hunts/:id/memory             # download full memory
GET  /api/v1/hunts/:id/cost
GET  /api/v1/hunts/:id/analysis
GET  /api/v1/hunts/:id/logic-tests
GET  /api/v1/hunts/:id/playbook
POST /api/v1/billing/order|verify
GET  /api/v1/billing/status
GET  /api/v1/admin/users
POST /api/v1/admin/users
GET  /api/v1/admin/hunts                   # all hunts (admin only)
WS   /api/v1/hunts/:id/stream              # live events
```

---

## 4. Frontend — Complete Feature List

### 4.1 Pages
- **ChatPage** — main chat interface (ChatGPT-style)
- **AdminPage** — user management + hunt monitoring + memory download
- **TopUpPage** — credit top-up via Razorpay (login gate when signed out)
- **ReportsPage** — all hunt reports (backend + local merged)
- **PluginsPage** — API integrations (Shodan-style recon keys)
- **SettingsPage** — voice settings, preferences

### 4.2 Hunt UI (HuntCard)
- **Live terminal:** timestamped logs ([HH:MM:SS] elapsed), plain-English activity
- **Thinking panel:** AI reasoning visible ("Head online...", "Spawning recon...")
- **Findings panel:** ONLY verified vulnerabilities shown; unverified = "N leads under investigation"
- **Controls:** Pause / Resume / Stop / Re-run / Report
- **Timer:** HH:MM:SS elapsed
- **Status:** honest state from backend (running/paused/stopped/finished)

### 4.3 Chat Features
- Copy/edit user messages
- Selectable terminal text
- Message timestamps (h:mm AM/PM)
- Reaction buttons (👍👎❤️) on assistant messages
- Mid-hunt chat (Send works during active hunt)
- Per-user localStorage isolation

### 4.4 Sync & Privacy
- Cross-device chat sync (debounced push + pull on open)
- Title sync across devices
- Delete tombstones (deleted chats stay deleted)
- Logout wipes all in-memory data
- Per-user storage keys

---

## 5. Docker — Kali Hunt Environment

### 5.1 Image (`docker/Dockerfile.hunt`)
- Base: kalilinux/kali-rolling
- **Recon:** nmap, subfinder, amass, dnsutils
- **Web:** nikto, sqlmap, nuclei, chromium + selenium
- **Crypto:** john, hashcat
- **Scripting:** python3 (+ requests, beautifulsoup4, selenium, pyjwt, dnspython), nodejs
- Build: `docker build -f docker/Dockerfile.hunt -t darkmatter/hunt:latest .`
- Setup: `bash docker/setup-kali-hunt.sh` (one-time on EC2)

### 5.2 Container Lifecycle (`src/huntRunner.js`)
- Spawned per-hunt with isolated network
- Environment: DM_TARGET, DM_HUNT_ID, DM_MODE
- Agent drives via `docker exec` (the "hands")
- Destroyed on stop/timeout/completion
- No model loop inside container, no cloud credentials

---

## 6. Key Design Decisions

| Decision | Date | Rationale |
|----------|------|-----------|
| AWS-only (no Render) | 14 Oct | Owner order; single EC2 box for backend+AI+hunts |
| Invite-only accounts | 13 Oct | No public signup; admin creates all accounts |
| Unlimited hunting | 14 Oct | No iteration cap; money is the only limit |
| Ollama (not Bedrock) | 14 Oct | Bedrock account-blocked; uncensored models only |
| EC2-only computer control | 15 Oct | Owner chose EC2, not user's device |
| One hunt at a time | 15 Oct | Backend runs single hunt; prevents resource contention |
| Verified-only findings | 15 Oct | 100% truth rule; never claim unverified as vulnerability |
| Per-user isolation | 14 Oct | Strict privacy; User A never sees User B's data |

---

## 7. Commit History (Key Milestones)

| Commit | Date | What |
|--------|------|------|
| cabd537 | 13 Oct | Full rebuild (frontend + backend from scratch) |
| 7d87009 | 14 Oct | Elite hunter gaps (7/10 code-fixed) |
| e3eba51 | 14 Oct | Checkpoint auto-resume |
| 0032bca | 14 Oct | Unlimited hunting (no iteration cap) |
| eb3141e | 15 Oct | Chat sync + verified-only display |
| 999b698 | 15 Oct | Logout isolation fix |
| 8dba9d1 | 15 Oct | Report button on terminal states |
| 49de6be | 15 Oct | Orchestrator + workers + Kali tooling |
| 7fbb9a5 | 15 Oct | Ollama engine fix (timeouts, circuit breaker) |
| 23d30e9 | 15 Oct | Chat delete tombstone sync |
| 53081b2 | 15 Oct | Immediate tombstone on delete |

---

## 8. Pending / Known Issues

- [ ] Bedrock account-blocked (support case 179198761900860) — Ollama is the working brain
- [ ] 2vCPU Ollama is slow — 32B via SageMaker async is the upgrade path (~$4-5/session)
- [ ] Razorpay test keys in chat history — rotate after testing
- [ ] PLUGIN_MASTER_KEY not set — plugin keys ephemeral across restarts
- [ ] Two mystery hunts appeared on thebhavesh.online (user didn't create) — investigate

---

## 9. Scheduled Work

- **hunt-health-watch** (every 15 min) — checks backend/frontend health, alerts on failure
- **daily-internship-applications** (daily 09:13 IST) — job hunt automation (separate goal)

---

*This file is auto-maintained. Update it when major features are added.*
