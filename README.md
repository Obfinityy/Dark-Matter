# Dark Matter — Autonomous Bug-Bounty Agent

> **Paste a link. The agent hunts. You get the report.**

Dark Matter by **Obfinity** is an autonomous AI security researcher for authorized bug-bounty hunting. It reasons like an elite human hunter — reconnaissance, attack-surface mapping, hypothesis testing, vulnerability chaining, controlled validation — and delivers professional, submission-ready PDF reports.

**Hunt AI** — Paste a URL you own or a bug-bounty program link. The agent autonomously:
- Understands the target and scope by itself (HackerOne, Bugcrowd, Intigriti, or direct URLs)
- Maps the attack surface (subdomain enum, live-host probing, JS-aware crawling, port scanning)
- Tests real security hypotheses (XSS, SQLi, IDOR, SSRF, and 12,000+ more via community templates)
- Chains small weaknesses into high-impact attack paths, like an elite hunter
- Validates findings with working proof-of-concepts
- Generates submission-ready PDF reports — on demand, even mid-hunt

**Infinity AI** — Your AI companion with four modes:
- **Chat** — Ask anything, debug, brainstorm
- **Plan** — Get step-by-step build plans
- **Build** — The agent reads and edits real files
- **Control** — Command your computer (see the screen, click, type)

**Infinity Voice** — Neural text-to-speech with real lip-sync on the avatar.

[![Status](https://img.shields.io/badge/Status-Production-blue)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018-61dafb)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js-339933)](#)

---

## What It Does

**Hunt AI** — Paste a URL you own. The agent autonomously:
- Maps the attack surface (recon, fingerprinting)
- Tests real security hypotheses (XSS, SQLi, IDOR, SSRF, and more)
- Validates findings with working proof-of-concepts
- Generates submission-ready PDF reports

**Infinity AI** — Your AI companion with four modes:
- **Chat** — Ask anything, debug, brainstorm
- **Plan** — Get step-by-step build plans
- **Build** — The agent reads and edits real files
- **Control** — Command your computer (see the screen, click, type)

**Infinity Voice** — Neural text-to-speech with real lip-sync on the avatar.

---

## How It Thinks

**Triple-brain architecture** — three specialized models, each on your machine:

| Brain | Role | Rule |
|-------|------|------|
| **Hacking** | The sole decision-maker. Strategizes, chains vulnerabilities, writes reports. | Thinks — never clicks |
| **Vision** | Sees screenshots, returns exactly the data the hacker asked for. | Sees — never decides |
| **Grounding** | Converts element descriptions to screen coordinates. | Clicks — never decides |

**Message queue** — the remote GPU handles one message at a time (FIFO). The hunt loop, mid-hunt chat, and background workers can all talk to the brain simultaneously without overlap or corruption.

**Unlimited thinking** — a rolling brain-written summary compresses aging history every K steps, so the agent reasons coherently at step 500 exactly as at step 5. Long outputs auto-continue from truncation points.

**Task decomposition** — complex objectives are split into independent sub-tasks (parallel tool runs + focused analyses), then synthesized into one conclusion — the same plan → delegate → synthesize pattern a human operator uses.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│ Frontend │────▶│ Backend  │────▶│   MongoDB    │
│(Cloudflare│     │ (Render) │     │   (Atlas)    │
│  Pages)  │     │          │     │              │
└──────────┘     └──────────┘     └──────────────┘
     │                 │
     │                 ▼
     │           ┌──────────────┐
     │           │ Auth, Hunts, │
     │           │ Reports,     │
     │           │ Payments     │
     │           └──────────────┘
     │
     ▼
┌──────────────────────────────────┐
│   YOUR LOCAL MACHINE             │
│                                  │
│   • Hacking brain (thinks)       │
│   • Vision brain (sees)          │
│   • Grounding brain (clicks)     │
│   • Kali Linux VM (acts)         │
│   • Recon tools (nmap, nuclei…)  │
│   • Infinity Voice (speaks)      │
│                                  │
│   Models NEVER leave your        │
│   computer.                      │
└──────────────────────────────────┘
```

**Key principle:** AI models run exclusively on your machine. The cloud backend handles auth, orchestration, and storage. Computer-control commands never touch the cloud.

---

## Quick Start

### Backend
```bash
cd backend
npm install
npm start          # → http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

Sign up in the UI, open Hunt AI, paste a URL you own.

---

## Project Structure

```
.
├── backend/                    # Node.js (ESM) + Express API
│   └── src/
│       ├── agent/              # Autonomous hunting brain (providers, state machine)
│       ├── engines/            # ~590 pure-function security engines
│       ├── hunt/               # Hunt orchestration (runner, planner, reporting)
│       ├── recon/              # Reconnaissance scan loops
│       ├── tools/              # Security tool integrations (nuclei, katana, …)
│       ├── computer/           # Desktop control bridge (Node.js half)
│       ├── control/            # Control-mode agent loop
│       ├── routes/             # API routing table (index.js — start here)
│       ├── controllers/        # Thin HTTP controllers
│       ├── services/           # Business logic (auth, chat, voice, billing)
│       ├── models/             # MongoDB schemas
│       ├── jobs/               # Background workers
│       ├── middleware/         # Express middleware
│       ├── core/               # Shared primitives (crypto, errors, utils)
│       ├── avatar/             # Avatar emotion system
│       └── voice/              # Infinity Voice TTS service layer
├── frontend/                   # React 18 + Vite application
│   └── src/
│       ├── pages/              # Routes (Landing, Auth, agent workspace, Hunt)
│       ├── components/         # Reusable UI (agent, brand, fx, hunt wave galleries)
│       ├── services/           # API clients (api.js, voice.js, …)
│       ├── auth/               # Auth context
│       ├── hooks/              # Shared React hooks
│       ├── styles/             # Design system CSS
│       ├── utils/              # Pure helpers
│       └── data/               # Static data (model catalog)
├── ideas/                      # Idea bank — 100,000+ numbered product ideas
├── research/                   # Methodology and strategy research
├── AGENTS.md                   # Project guide for AI agents (read first)
├── VISION.md                   # Product vision
└── THIRD_PARTY_NOTICES.md      # License attributions
```

Every directory carries a short `README.md` explaining what lives there and why.

---

## Safety

> **Authorized testing only.** Use only on targets you own, bug-bounty programs you're enrolled in, or with explicit written permission.

- Scope allowlist enforced before any network action
- Non-destructive testing only — no data modification, no DoS
- Every finding requires evidence, not just status codes

---

## Tech Stack

- **Frontend:** React 18, React Router, Vite, Lucide icons
- **Backend:** Node.js (ESM), Express, MongoDB
- **AI:** Triple-brain (hacker/vision/grounding) — local GGUF via llama.cpp or Kaggle Gradio GPU links
- **Security tools:** nuclei, subfinder, httpx, katana, naabu, dalfox, ffuf (auto-downloaded, MIT)
- **Voice:** Infinity Voice neural TTS (Kokoro-82M default, VoxCPM2 premium), CPU-friendly
- **Reports:** Brain-written sections → pdfkit professional PDF
- **Deploy:** Cloudflare Pages (frontend, auto-deploy), Render (backend)

---

## Key Docs

- [AGENTS.md](AGENTS.md) — full project guide for contributors and AI agents
- [VISION.md](VISION.md) — product vision
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — license attributions

---

## License

Private — Obfinity. All rights reserved.

---

<p align="center">
  Built by <b>Obfinity</b> — Dark Matter <i>hunts smarter, not harder.</i>
</p>
