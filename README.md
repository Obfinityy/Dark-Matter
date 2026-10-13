# Dark Matter — Autonomous Bug-Bounty Agent

> **Paste a link. Close your browser. Come back in 3 days. Read the report.**

Dark Matter by **Obfinity** is an autonomous AI security researcher for **authorized** bug-bounty hunting. It thinks like an elite human hunter — recon, attack-surface mapping, hypothesis testing, vulnerability chaining, controlled validation — and delivers professional, submission-ready reports.

[![Status](https://img.shields.io/badge/Status-Production-blue)](#)
[![Frontend](https://img.shields.io/badge/Frontend-React-61dafb)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js-339933)](#)
[![Engine](https://img.shields.io/badge/Engine-PentAGI-orange)](#)

---

## How it works (for users)

1. **Sign up / log in** — hunting requires an account (browsing is open to everyone).
2. **New hunt** — paste a target URL you own or are authorized to test, confirm authorization.
3. **The agent hunts** — multi-agent system (PentAGI engine) runs recon, testing, and chaining in a Docker sandbox on your machine.
4. **Live with it** — Pause / Resume / Stop anytime from the hunt card. Chat with the agent mid-hunt: ask *"what did you find?"*, say *"pause the hunt"*.
5. **Close the browser** — the hunt keeps running. Come back anytime: **Reports** shows your hunts with live status.
6. **Get the report** — one click, Markdown or PDF, even mid-hunt. Findings include exploit chains (3 mediums → 1 critical), confirmation status, and next-step probes.

### Screenshots

| Home | Hunt running |
|------|--------------|
| *ChatGPT-style home — "Where should we begin?"* | *Live hunt card with thinking, tool calls, findings, Pause/Resume/Stop* |

| Plugins (AWS) | Reports |
|---------------|---------|
| *Connect AWS Bedrock — keys stored encrypted* | *Your hunts, live status, one-click reports* |

> Screenshots live in `docs/screenshots/`. (Add yours after `npm run dev` — see below.)

---

## What makes it "infinity level"

- **Exploit-chain engine** — findings become capability primitives; 30 chain equations turn mediums into criticals (`read + write = RCE`).
- **Differential confirmation** — every finding needs a true/false control probe; false positives are rejected, not reported.
- **Variant mining** — patch-gap patterns (WAF bypasses, JWT confusion, filter evasions) hunt zero-day variants.
- **Stateful API sequencing** — producer→consumer request chains reach the business-logic bugs single-request scanners miss.
- **Engine tools** — JWT attack battery, nuclei verified-check templates, API sequencer (`docker/tools/`).

Details: `docs/vuln-research-2026-10-13.md` · `backend/src/hunt-intel/` · `AGENTS.md`.

---

## Quick start (developers)

```bash
# Backend (orchestrator — never runs hunts itself)
cd backend && npm install && npm start        # → http://localhost:4000

# Frontend
cd frontend && npm install && npm run dev     # → http://localhost:5173

# Engine (your Linux machine — Docker)
cd docker && ./setup-linux.sh                 # PentAGI + pgvector + tool sandbox

# Voice (your machine, optional)
cd voice/stt && uvicorn app:app --port 8001
cd voice/tts && uvicorn app:app --port 8002
```

**Deploy:** frontend auto-deploys (Vercel + Cloudflare Pages) on push to `main`. Backend on Render — **manual deploy** from the dashboard (auto-deploy is off).

**Env (backend):** `JWT_SECRET` (persistent!), `PLUGIN_MASTER_KEY`, `ALLOWED_TARGETS` (comma-separated, required for hunts), `CORS_ORIGINS`, `DATA_DIR`.

---

## Safety

Authorized targets only. Every hunt requires explicit `confirmedAuthorized: true` plus the `ALLOWED_TARGETS` allowlist. Non-destructive testing. Never submit reports blindly — review before sending to a program.

---

## License

Dark Matter © Obfinity. PentAGI engine: MIT (vxcontrol) — see `third_party/pentagi/`.
