# Infinity AI — Autonomous Bug-Bounty & Coding Agent

> **Paste a link. The agent hunts. You get the report.**

Infinity AI is an autonomous AI security researcher for authorized bug-bounty hunting, plus an AI coding companion — in one app. It reasons like a human hunter (reconnaissance, attack-surface mapping, hypothesis testing, controlled validation) and delivers professional, submission-ready reports.

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

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│ Frontend │────▶│ Backend  │────▶│   MongoDB    │
│ (Vercel) │     │ (Render) │     │   (Atlas)    │
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
│   (localhost:4000)               │
│                                  │
│   • Inference engine (llama.cpp) │
│   • Vision Brain (sees screen)   │
│   • Grounding Brain (clicks)     │
│   • Hacking Brain (finds vulns)  │
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
- **AI:** Local GGUF models via llama.cpp; Kaggle Gradio vision link; cloud APIs
- **Voice:** Kokoro-82M neural TTS (Apache-2.0), CPU-friendly
- **Deploy:** Vercel (frontend), Render (backend)

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
  Built by <b>Infinity AI</b> — <i>hunt smarter, not harder.</i>
</p>
