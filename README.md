# Dark Matter — Autonomous AI Bug Bounty Agent

> **Paste a link. The agent hunts. You get the report.**

Dark Matter is an autonomous AI security researcher for authorized bug bounty hunting. It reasons like a human hunter — reconnaissance, attack-surface mapping, hypothesis testing, controlled validation — and delivers professional PDF reports.

**Infinity AI** is the built-in AI assistant with four modes: Chat, Plan, Build, and Control.

[![Status](https://img.shields.io/badge/Status-Production-blue)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018-61dafb)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js-339933)](#)
[![License](https://img.shields.io/badge/License-Private-red)](#)

---

## What It Does

**Hunt AI** — Paste a URL you own. The agent autonomously:
- Maps the attack surface (recon, fingerprinting)
- Tests real security hypotheses (XSS, SQLi, IDOR, SSRF, and more)
- Validates findings with working proof-of-concepts
- Generates submission-ready PDF reports

**Infinity AI** — Your AI coding companion:
- **Chat** — Ask anything, debug, brainstorm
- **Plan** — Get step-by-step build plans
- **Build** — Agent reads and edits real files
- **Control** — Command your computer (see screen, click, type)

---

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│ Frontend │────▶│ Backend  │────▶│   MongoDB    │
│ (Vercel) │     │ (Render) │     │ (Atlas)      │
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

### Frontend
```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

### Backend
```bash
cd backend
npm install
npm start          # → http://localhost:4000
```

Sign up in the UI, open Hunt AI, paste a URL you own.

---

## Project Structure

```
Dark-Matter/
├── frontend/               # React 18 application
│   └── src/
│       ├── pages/          # Routes (Landing, Hunt, Infinity AI, Models, etc.)
│       ├── components/     # Reusable UI components
│       ├── services/       # API clients
│       └── styles/         # Design system
├── backend/                # Node.js + Express API
│   └── src/
│       ├── agent/          # Autonomous hunting brain
│       ├── tools/          # Security tools integration
│       ├── computer/       # Computer-control bridge
│       ├── jobs/           # Hunt queue and workers
│       └── routes/         # REST API endpoints
├── ideas/                  # Product roadmap (100k+ ideas)
└── docs/                   # Documentation
```

---

## Safety

> **Authorized testing only.** Use only on targets you own, bug-bounty programs you're enrolled in, or with explicit written permission.

- Scope allowlist enforced before any network action
- Non-destructive testing only — no data modification, no DoS
- Every finding requires evidence, not just status codes

---

## Tech Stack

- **Frontend:** React 18, React Router, Lucide icons
- **Backend:** Node.js, Express, MongoDB
- **AI:** Local GGUF models via llama-server, Kaggle/Colab remote, cloud APIs
- **Deploy:** Vercel (frontend), Render (backend)

---

## License

Private — Obfinity. All rights reserved.

---

<p align="center">
  Built by <b>Obfinity</b> — <i>hunt smarter, not harder.</i>
</p>
