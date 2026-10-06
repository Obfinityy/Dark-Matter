# AGENTS.md — Dark-Matter Project Guide

> **For AI agents** (Anti Gravity, Cursor, Copilot, etc.): Read this file first.
> It explains the entire project so you can work on it without asking questions.

## What is Dark-Matter?

An **autonomous AI bug bounty agent** + **autonomous coding agent** in one app.
Goal: replace human bug bounty hunters — the agent thinks, hunts, verifies,
writes PoCs, and generates professional reports, all autonomously.

## Tech Stack

| Layer    | Tech                                    |
|----------|-----------------------------------------|
| Backend  | Node.js (ESM) + Express, port 4000      |
| Frontend | React + Vite, port 5173                 |
| Database | MongoDB Atlas (prod) / in-memory (dev)  |
| AI Brain | Kaggle Gradio link (Qwen2.5-VL vision)  |
| Local AI | llama.cpp via `src/services/modelRunner/`|
| Desktop  | Python bridge (`backend/computer/`)     |

## Quick Start

```bash
# Backend
cd backend && npm start          # → http://localhost:4000

# Frontend
cd frontend && npm run dev        # → http://localhost:5173
```

## Project Structure

```
backend/
  src/
    engines/           # Elite bug bounty engines (NEW)
      eliteRecon.js    # Subdomain + tech fingerprinting
      vulnDetector.js  # SQLi/XSS/SSRF/IDOR detection
      pocGenerator.js  # Auto PoC (curl + Python)
      riskScorer.js    # CVSS-style 0-10 scoring
      fpFilter.js      # False-positive filter
      learningEngine.js# Learns from every hunt
      aiReportWriter.js# Professional bounty reports
    agent/
      providers/       # Brain providers
        gradioProvider.js  # Kaggle Gradio (supports 6.x predict API)
        resilientBrainProvider.js  # Fallback chain
    computer/          # Desktop control
      actionSchema.js  # Whitelisted actions
    jobs/
      computerTaskWorker.js  # Control mode agent loop
    services/
      modelRunner/     # llama.cpp download → run (no Ollama)
    routes/
      index.js         # ALL API routes (start here for API)
frontend/
  src/
    pages/agent/
      InfinityAI.jsx   # Chat/Plan/Build/Control modes
      HuntView.jsx     # Bug bounty hunt UI
    services/
      api.js           # All backend API calls
```

## Key API Routes

```
POST /api/v1/auth/register, /auth/login
GET  /api/v1/model-runner/library      # Model list (18 models)
POST /api/v1/model-runner/download     # Download with SSE progress
GET  /api/v1/computer-tasks            # Control mode tasks
POST /api/v1/computer-tasks            # Create control task
GET  /api/v1/computer-tasks/:id/events # SSE event stream (?accessToken=)
POST /api/v1/jobs                      # Start bug bounty hunt
POST /api/v1/jobs/:id/ask              # Mid-hunt chat ("kya kar raha hai?")
GET  /api/v1/infinite/chat             # Infinity AI chat
GET  /api/v1/voice/health              # Infinity Voice status
GET  /api/v1/voice/voices              # Available voices (aria, aria2, kai, kai2)
POST /api/v1/voice/speak               # { text, voice? } → audio/wav (24kHz mono)
```

## Infinity Voice (neural TTS)

The Infinity AI avatar speaks every reply with a natural voice. Architecture:

```
frontend/src/services/voice.js          # fetch WAV → Web Audio API → live amplitude → lip-sync
  → POST /api/v1/voice/speak
    → backend/src/services/voiceManager.js   # spawns/manages Python service
      → backend/voice/voice_service.py       # HTTP server on 127.0.0.1:4120
        → Kokoro-82M (Apache-2.0, 82M params, CPU-friendly)
```

- **Branding**: always "Infinity Voice" — the underlying engine is an implementation detail, never user-facing.
- **Voices**: `aria`/`aria2` (female), `kai`/`kai2` (male). Avatar gender toggle maps female→aria, male→kai.
- **Setup** (one-time, user's machine): `cd backend/voice && python3 -m venv .venv && .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu && .venv/bin/pip install -r requirements.txt`
- First `/speak` auto-starts the service; model downloads once (~300MB) then cached.
- `voice_service.py` sanitizes `no_proxy` env (strips bracketed IPv6) — some sandboxes break httpx parsing.
- Frontend falls back to browser `speechSynthesis` if the service isn't installed.
- Chat replies use a speakable system prompt (short, no markdown tables/code blocks) in `healthController.js` `directChat`.

## The 7 Elite Engines

All in `backend/src/engines/`, all pure functions, all tested:

1. **eliteRecon** — `fingerprintTech({headers, body})` → tech names; `subdomainCandidates(domain)`; `scoreEndpoint(path, status, len)` → 0-100+
2. **vulnDetector** — `scanResponse({url, body}, {canary})` → findings array with type/confidence/evidence/CWE
3. **pocGenerator** — `generatePoC(finding)` → {curl, python, steps[]}
4. **riskScorer** — `scoreFinding(f)` → {score 0-10, severity}; `prioritize(findings)` sorts by risk
5. **fpFilter** — `filterBatch(findings)` → {passed[], filtered[]} with reasons
6. **learningEngine** — `recordHuntOutcome(store, {...})`; `suggestChecks(store, techStack)` → prioritized checks
7. **aiReportWriter** — `huntReportToMarkdown({target, findings, techStack})` → full bounty report
8. **chainBuilder** — `findChains(findings)` → vulnerability chains (XSS+session=ATO, etc.)
9. **secretScanner** — `scanForSecrets(text)` → leaked API keys/tokens (redacted logging)
10. **jwtAnalyzer** — `analyzeJWT(token)` → none-alg, missing exp, sensitive payload
11. **corsChecker** — `checkCORS({headers})` → wildcard+credentials misconfig
12. **paramMiner** — `mineParams(url)` → hidden debug/admin parameter URLs
13. **takeoverChecker** — `checkTakeover({subdomain, cname, httpBody})` → subdomain takeover

## Brain / Model Setup

- **Vision brain**: Kaggle Gradio link → Models page → paste link → Connect
- **Gradio API**: `gradioProvider.js` supports both old (`/api/chat`) and new (`/call/predict` with MultimodalData)
- **Grounding**: UI-TARS model from Models → Plugins (for Control mode coordinates)
- **Local models**: Downloaded via `modelRunner/` using llama.cpp (no Ollama needed)

## Testing

```bash
cd backend
node --test tests/*.test.js    # Unit tests (261 pass individually)
# Note: full `npm test` has parallel-run isolation issues; run files individually
```

## Conventions

- **Language**: User speaks Hindi/Hinglish — match their register. GitHub/README = professional English only.
- **No mock UI**: Never add Simulate/mock buttons. Real brain-driven loops only.
- **Frontend**: Agent actively maintains and polishes the frontend (design inspired by reactbits.dev — original implementations, never verbatim). Cards and layouts must have proper margin/padding and breathing room.
- **Commits**: Agent pushes completed work directly to `main` automatically — no approval needed. User supplied a token; push via GIT_ASKPASS, never store the raw token.
- **GitHub self-service**: Agent may create issues, open PRs, and merge them itself using the token. No approval cards. For bulk tracking, prefer epic-level issues over thousands of individual issues.
- **Idea bank**: `ideas/IDEAS_10000*.md` (100,004 ideas) is the long-term roadmap. Implement ideas continuously in small verified batches, referencing idea numbers in commits/PRs.
- **Security**: Hunt only authorized targets. No destructive testing. Minimal PoCs.

## Current Status (3 Oct 2026)

- ✅ 7 elite engines built and tested
- ✅ Gradio 6.x predict API support
- ✅ Control mode wiring (frontend → backend → SSE)
- ✅ Model downloads fixed (verified HF URLs, per-slot localhost servers)
- ✅ Full frontend redesign (fx design system: DarkVeil, SpotlightCard, DecryptedText, ElectricBorder, Bento)
- ✅ Infinity AI avatar (male/female) with action intents + bottom mode dock
- ✅ Infinity Voice — built-in neural TTS, avatar speaks with real lip-sync
- ⏳ Real Windows E2E test pending (user runs via Anti Gravity)
- ⏳ Infinity Agent (renamed Agent S) integration in progress
