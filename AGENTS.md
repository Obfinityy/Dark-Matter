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
POST /api/v1/jobs/:id/ask              # Mid-hunt chat ("what are you doing?")
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

## Current Status (9 Oct 2026)

### Triple-Brain Architecture (production)
- **Hacker brain** (sole decision-maker) → **Vision brain** (sees only) → **Grounding brain** (clicks only)
- Each slot: local model OR Kaggle Gradio link, resolved per-call by `tripleBrainOrchestrator.js`
- `observeThinkAct` loop: see → think → act, with `visionInstruction`/`groundingInstruction` orders
- **Vision delegation with expected output**: hacking brain sets `visionExpectedOutput` — exactly what data to bring back (e.g. "list of input names and button labels"). Vision returns exactly that; hacker processes it.

### Brain Message Queue (9 Oct 2026)
- **Problem**: 4–5 concurrent messages (hunt loop + mid-hunt chat + poller) all hit the one Kaggle GPU → VRAM contention, timeouts, failures.
- **Fix** (`backend/src/agent/providers/gradioProvider.js`): per-endpoint FIFO queue. One inference at a time per GPU, first-in-first-out, no overlap, no input/output mixing. Errors never jam the queue. Different endpoints run independently.
- **Tests**: `backend/tests/gradioQueue.test.js` (4 tests: no-overlap, failure-resilience, endpoint-independence, drain).

### Brain-Written PDF Reports (9 Oct 2026)
- **Problem**: 8B model can't write a full report in one shot (context limit).
- **Fix** (`backend/src/services/htmlReportService.js`): report planned as sections; brain writes ONE section per call (executive summary, methodology, per-finding deep dives, attack chains, remediation). Critical/high findings get their own sections; lower ones grouped.
- **Unlimited output**: `_generateWithContinuation` detects truncation (mid-sentence, unclosed tags) and auto-continues from the exact cutoff point, deduping overlap. Sections can be arbitrarily long.
- **PDF** (`backend/src/services/brainReportPdf.js`): pdfkit renderer converts brain HTML fragments to submission-quality PDF — cover page, severity color badges, tables, code blocks, page numbers. No 170MB Chromium download (puppeteer rejected).
- **On-demand**: `POST /api/v1/jobs/:id/report.html` → 202 + generationId (works MID-HUNT); `GET /api/v1/jobs/:id/report.html/:generationId` → status or PDF download.
- **Tests**: `backend/tests/htmlReportService.test.js` (5), `backend/tests/brainReportPdf.test.js` (5).

### TaskDecomposer — works like the operator (9 Oct 2026)
- `backend/src/agent/taskDecomposer.js`: plan → delegate → synthesize.
- Brain breaks a complex objective into 2–6 independent sub-tasks (analyze | tool).
- Tools run in parallel; brain analyses go through the FIFO queue; results synthesized into one conclusion with key facts and next steps.
- One delegation level only (workers never spawn workers). Failures don't kill synthesis.
- **Tests**: `backend/tests/taskDecomposer.test.js` (4 tests).

### Recon Tools (integrated, download-on-demand)
- `subfinder`, `httpx`, `katana`, `naabu`, `nuclei`, `dalfox`, `ffuf` — registered in `backend/src/tools/registry.js`, binaries auto-downloaded from official GitHub releases via `backend/src/tools/managedBinaries.js` (`~/.darkmatter/tools/`).
- Brain sees all tools in its system prompt; `parallel_tools` decision runs independent tools concurrently; `FALLBACK_TOOLS` in `executor.js` retries with alternatives on failure.
- UI branding: "Infinity Scanner", "Infinity Recon", "Infinity Crawler" — never upstream names. Licenses in `THIRD_PARTY_NOTICES.md`.

### Unlimited Thinking (rolling context)
- `huntContextManager.maybeRefreshSummary`: every K steps, the brain compresses aging history into a rolling summary (extractive fallback). The brain never loses track at step 500.
- Token-budgeted context per step: HOT (recent) + WARM (summary) + COLD (file memory).

### UI Controls (verified present)
- HuntView: Pause/Resume buttons; `POST /jobs/:id/pause`, `/jobs/:id/resume`
- Mid-hunt chat: `ChatDock.jsx` ("ask the brain anything mid-hunt")
- VM screen: `VmScreen.jsx` (noVNC) + Terminal: `VmTerminal.jsx` (xterm.js)
- Hunt memory: per-hunt isolated, local device only, ZIP export/import

### Still needs the owner's machines
- Windows runner E2E (Start-Runner.bat → Kali download → VM boot → noVNC handshake)
- Live Gradio → hunt loop E2E; live Razorpay payment; BRAIN_LINKS_KEY on Render

## Legacy status (3 Oct 2026, kept for history)

- ✅ 7 elite engines built and tested
- ✅ Gradio 6.x predict API support
- ✅ Control mode wiring (frontend → backend → SSE)
- ✅ Model downloads fixed (verified HF URLs, per-slot localhost servers)
- ✅ Full frontend redesign (fx design system: DarkVeil, SpotlightCard, DecryptedText, ElectricBorder, Bento)
- ✅ Infinity AI avatar (male/female) with action intents + bottom mode dock
- ✅ Infinity Voice — built-in neural TTS, avatar speaks with real lip-sync
- ⏳ Real Windows E2E test pending (user runs via Anti Gravity)
- ⏳ Infinity Agent (renamed Agent S) integration in progress
