# AGENTS.md — Dark-Matter Project Guide

> **For AI agents**: Read this file first. It explains the entire project so you can work on it without asking questions.
> Rebuilt from scratch on 13 Oct 2026 (commit `cabd537`). Anything describing the pre-rebuild app is obsolete.

## What is Dark-Matter?

**Dark Matter** (company: **Obfinity**) is an autonomous AI bug-bounty agent with a ChatGPT-like interface. The agent thinks, hunts, verifies, and writes reports autonomously — the user can also chat with it mid-hunt and steer it.

Product UI branding: **Dark Matter / Infinity AI**. Never expose "PentAGI" in the UI (it's the integrated engine, MIT-licensed, credited in `third_party/pentagi/`).

## Topology (13 Oct 2026 rebuild)

```
┌─ frontend/          Vite + React — ChatGPT-exact dark UI (#212121/#171717).
│                      Sidebar (New chat, history, profile menu), top bar
│                      ("Dark Matter ▾"), composer ("Ask anything"), hunt cards.
│                      Deploys: Vercel (dark-matter-frontend) + Cloudflare Pages
│                      (hack.thebhavesh.online) — both auto-deploy from main.
├─ backend/           Node.js (ESM) + Express — orchestrator. NEVER runs hunts.
│                      Routes: /api/v1/health, /chat, /hunts, /plugins,
│                      /models, /reports, /voice (+ WS /api/v1/hunts/:id/stream).
│                      Plugin keys encrypted (AES-256-GCM, PLUGIN_MASTER_KEY).
│                      Deploys: Render (dark-matter-90nw) — manual deploy from
│                      the Render dashboard (auto-deploy is OFF).
├─ engine/pentagi/    PentAGI (vxcontrol, MIT) integrated BY REFERENCE, cleaned
│                      154M→16M. The hunt brain: multi-agent (Orchestrator →
│                      Researcher → Developer → Executor), Docker tool sandbox.
│                      Runs on the USER'S Linux machine, not in the cloud.
│                      API contract: engine/pentagi/INTEGRATION.md (exact paths).
│                      4 upstream *_test.go files removed (fake secret-like keys
│                      trip GitHub push protection GH013).
├─ voice/             faster-whisper STT (:8001) + Piper TTS (:8002), local.
├─ docker/            Compose + setup script for the user's Linux machine.
└─ third_party/pentagi/  PentAGI LICENSE + NOTICE (legal — keep).
```

**Critical boundaries**
- Hunts execute on the user's machine via the engine. Render is orchestration-only (chat/plugin APIs); computer-control commands NEVER route via Render.
- Hunt memory/state lives on the user's device only — never as the cloud backend's store.
- The engine has NO operator pause: `pause` = snapshot checkpoint to hunt meta, then terminal-stop the flow; `resume` = continue a `waiting` flow via `{action:"input"}` or recreate a new flow carrying the checkpoint (returns a new huntId). See `backend/src/engine.js`.
- Hunt launch requires an explicitly named target + `confirmedAuthorized: true` (+ `ALLOWED_TARGETS` allowlist in prod).

## Quick Start

```bash
# Backend (orchestrator)
cd backend && npm start          # → http://localhost:4000

# Frontend
cd frontend && npm run dev       # → http://localhost:5173

# Engine (user's Linux machine)
cd docker && ./setup.sh          # Docker + PentAGI stack (see INTEGRATION.md)

# Voice (user's machine)
cd voice/stt && uvicorn app:app --port 8001
cd voice/tts && uvicorn app:app --port 8002  # after downloading a Piper voice
```

## Key API Routes (backend)

```
GET  /api/v1/health
POST /api/v1/chat                        # chat (streams via WS/SSE)
POST /api/v1/hunts                       # {target, scope, confirmedAuthorized:true}
GET  /api/v1/hunts/:id
POST /api/v1/hunts/:id/pause|resume|stop
WS   /api/v1/hunts/:id/stream            # live events: thinking|tool_call|finding|status|done
POST /api/v1/hunts/:id/report            # report anytime, incl. mid-hunt
GET  /api/v1/plugins/providers
POST /api/v1/plugins/:id/keys           # encrypted storage
GET  /api/v1/reports
```

## Conventions

- **Language**: User speaks Hindi/Hinglish — match their register. GitHub/README/product UI = professional English only.
- **Git**: push completed work directly to `main` (token in `~/.git-credentials`; push via `git -c credential.helper= push "https://Obfinity:${TOKEN}@github.com/Obfinityy/Dark-Matter.git" main`). NEVER commit secrets — GitHub push protection (GH013) blocks the push.
- **Shared clone**: `~/workspace/dm-v2/work/repo` is shared with other agents — verify `git branch --show-current` in the SAME shell command before any checkout/merge/reset.
- **Frontend**: ChatGPT-exact visual language. Verify every flow in the real browser UI (desktop + mobile); never say "done" until it's visibly working.
- **No mock UI**: real loops only, no simulate buttons.
- **Security**: authorized targets only, non-destructive. Never invent user facts (names, tools, experience) when representing the user.
- **Rebrand rule**: third-party OSS integrated by reference is 100% rebranded in product UI; LICENSE/NOTICE kept in-repo.
