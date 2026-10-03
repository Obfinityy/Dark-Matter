# 🛡️ Dark-Matter — Autonomous AI Bug Bounty Agent

> **Paste a link. The agent hunts. You get the report.**
> An autonomous AI security researcher for authorized bug bounty hunting — plus **Infinity AI**, your AI coding agent with Chat, Plan & Build modes.

[![Status](https://img.shields.io/badge/Status-v2%20Elite-blue)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018-61dafb)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20Express-339933)](#)
[![AI](https://img.shields.io/badge/AI-Multi--Provider%20Brain-9b59b6)](#)
[![License](https://img.shields.io/badge/License-Private-red)](#)

---

## ✨ What is this?

**Dark-Matter** is an autonomous AI agent that performs security research on targets **you own or are authorized to test**. You paste a URL, the agent reasons like a human hunter — reconnaissance → attack-surface mapping → hypothesis → controlled validation → evidence → professional PDF report.

**Infinity AI** is your AI coding companion living in the same app: chat with it, let it plan your project, or have it build for you — with a full **Infinity Control** panel to command the entire system.

### Two tabs. That's the whole UI.

| Tab | What it does |
|-----|--------------|
| 🎯 **Hunt** | Paste a URL → autonomous bug-bounty hunt with live terminal, mid-hunt chat, and PDF reports |
| ♾️ **Infinity AI** | Chat / Plan / Build modes + Infinity Control for the whole system |

---

## 🧠 The Brain

One brain powers both Hunt and Infinity AI. Pick yours in **Models**:

- **Local models** — download & run on your machine (no Ollama needed)
- **Remote GPU** — paste a Kaggle / Colab Gradio link, connect in one click
- **Cloud APIs** — plug in your provider

The brain is swappable anytime. The agent's skills don't change — only the intelligence behind them.

---

## 🏹 Hunt — how it works

```
Paste URL → Agent thinks → Recon → Attack surface → Hypotheses
    → Controlled tests → Evidence → Findings → PDF report
```

**9 elite hunting engines** run under the hood:

| Engine | What it finds |
|--------|---------------|
| 🧪 Business-logic testing | Price manipulation, auth bypass, workflow skipping, race conditions, mass assignment |
| 💥 Exploit PoC generator | XSS, SQLi, IDOR, SSRF, open redirect, CSRF proof-of-concepts |
| 📜 JS deep analysis | Secrets in bundles, hidden endpoints, client-side logic flaws, source maps |
| 🥷 Stealth & evasion | WAF detection, rate-limit backoff, safe bypass techniques |
| ☁️ Cloud misconfig | Public S3/Azure/GCP buckets, open Firebase databases |
| 🔌 Deep API security | BOLA/IDOR, JWT `alg=none`, mass assignment, GraphQL introspection |
| 🌐 Subdomain takeover | 30+ service fingerprints (GitHub Pages, Heroku, S3…) |
| 🎓 Continuous learning | Remembers what worked — per user, persisted |
| 📸 Visual proof | Screenshots embedded in every report |

**Safety first:** scope is enforced deterministically (never delegated to the AI alone). All tests are non-destructive — no real purchases, no data modification, no spam. Findings require confirmation, never just a status-code guess.

---

## ♾️ Infinity AI — modes

| Mode | Purpose |
|------|---------|
| 💬 **Chat** | Ask anything — explain code, debug, brainstorm, casual talk |
| 📋 **Plan** | Describe your idea → get a step-by-step build plan |
| 🔨 **Build** | The agent reads/edits real workspace files and builds for you |
| 🎛️ **Infinity Control** | Command center — system status, brain, backend, hunts, models, all in one place |

### 🎙️ Infinity Voice — the avatar speaks

Every reply in Infinity AI is **spoken aloud** by a natural, human-like voice — with real lip-sync driven by the actual audio. Four voices (Aria, Aria Soft, Kai, Kai Deep), auto-matched to the avatar's gender. Fully offline, zero API cost.

**One-time setup:**

```bash
cd backend/voice
python -m venv .venv
# Windows:
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\pip install -r requirements.txt
# Linux/macOS (use python3 instead of python):
# .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
# .venv/bin/pip install -r requirements.txt
```

The backend starts the voice engine automatically on first use (~300MB model downloads once, then cached). Toggle voice with the 🔊 button in the avatar header.

---

## 🚀 Quick start (2 minutes)

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
npm start          # → http://localhost:4000  (zero-config: works without MongoDB)
```

That's it. Sign up in the UI, open the **Hunt** tab, paste a URL you own.

### One-click backend switching

In **Settings** → **Backend**, switch between:

- ☁️ **Cloud** — always-on hosted backend
- 💻 **Localhost** — full power on your machine (hunts, computer control, local models)

One tap. The app reconnects automatically.

---

## 🖥️ Supported platforms

| OS | Status |
|----|--------|
| 🐧 Kali Linux | ✅ Primary — full native tool support |
| 🐧 Linux | ✅ Full support |
| 🪟 Windows | ✅ Via Python scripts / Docker fallbacks |
| 🍎 macOS | ✅ Via Python scripts / Docker fallbacks |

---

## 📁 Project structure

```
Dark-Matter/
├── frontend/                 # React 18 app (the whole UI)
│   └── src/
│       ├── pages/agent/      # Hunt, Infinity AI, Models, Reports, Settings
│       ├── components/agent/ # Live terminal, screen viewer, findings board…
│       └── services/         # API client, backend-mode switch
├── backend/                  # Node.js + Express API
│   └── src/
│       ├── agent/            # The autonomous brain + 9 hunting engines
│       ├── tools/            # 28 security tools (nmap, nuclei, sqlmap…)
│       ├── computer/         # Computer-control bridge (see your screen)
│       ├── jobs/             # Hunt queue, workers, state machine
│       └── routes/           # REST API
```

---

## 🔐 Security & authorized use

> ⚠️ **Authorized testing only.** This platform is for targets you own, bug-bounty programs you're enrolled in, or assessments you have explicit written permission to perform.

- Scope allowlist enforced before any network action
- No credential attacks, brute force, or DoS — ever
- Every finding needs evidence, not just a status code
- The AI proposes; deterministic code disposes

---

## 🛠️ Tech

- **Frontend:** React 18, React Router, Lucide icons
- **Backend:** Node.js, Express, MongoDB (optional — in-memory fallback for dev)
- **AI:** Multi-provider brain (local GGUF via llama-server, Gradio/Kaggle remote, cloud APIs)
- **Deploy:** Vercel-ready (`vercel.json` in both `frontend/` and `backend/`)

---

## 📄 License

Private — Team Infinity. All rights reserved.

---

<p align="center">
  Built with ♾️ by <b>Team Infinity</b> — <i>hunt smarter, not harder.</i>
</p>
