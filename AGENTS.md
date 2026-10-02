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
```

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
- **Frontend**: User maintains it — do NOT modify frontend files unless asked.
- **Commits**: User controls GitHub pushes. Work locally; push only when told.
- **Security**: Hunt only authorized targets. No destructive testing. Minimal PoCs.

## Current Status (2 Oct 2026)

- ✅ 7 elite engines built and tested
- ✅ Gradio 6.x predict API support
- ✅ Control mode wiring (frontend → backend → SSE)
- ⏳ Real Windows E2E test pending (user runs via Anti Gravity)
- ⏳ Infinity Agent (renamed Agent S) integration in progress
