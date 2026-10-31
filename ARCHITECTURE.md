# ARCHITECTURE — Dark Matter / Infinity AI

**Date:** 31 Oct 2026  
**Branch:** `feat/final-integration` @ `2100042`

---

## System Overview

Dark Matter is an autonomous bug bounty agent. The user provides an authorized target URL and scope; the agent hunts for vulnerabilities using real tool execution in an isolated Kali Linux container, verifies findings with code-enforced evidence checks, and reports results via a live frontend.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Frontend   │────▶│   Backend    │────▶│  Kali Container │
│  (React)    │◀────│  (Node.js)   │◀────│  (Docker)       │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │                       │
                           ▼                       ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │    Brain     │     │  Target (DVWA)  │
                    │ (Ollama 8B)  │     │  (Lab/Real)     │
                    └──────────────┘     └─────────────────┘
```

---

## Component Details

### Frontend (`frontend/src/`)

**Stack:** React, Vite, Tailwind CSS  
**Deployed:** Cloudflare Pages (https://hack.thebhavesh.online)

**Key components:**
- `NewHuntModal.jsx` — target URL + scope intake
- `HuntCard.jsx` — hunt status, findings, timer
- `LiveMachine.jsx` — streaming Kali desktop (via CDP)
- `Terminal.jsx` — live command output
- `FindingDetail.jsx` — evidence viewer
- `ModelSelector.jsx` — brain provider selection

**State:** Real-time via polling + WebSocket (partial; no periodic re-poll for hunt list)

---

### Backend (`backend/src/`)

**Stack:** Node.js, Express, file-based storage (no database)  
**Deployed:** EC2 (https://api.thebhavesh.online, port 4000 via nginx)

**Entry points:**
- `server.js` — Express app, route mounting
- `routes/hunts.js` — hunt CRUD, scope persistence
- `routes/reports.js` — dossier generation

**Hunt lifecycle:**
1. `POST /api/v1/hunts` → `huntRunner.js` creates Docker container `dm-hunt-<id>`
2. `huntAgent.js` drives the autonomous loop (see below)
3. State persisted to `/opt/Dark-Matter/backend/data/hunts/<id>/`
4. Frontend polls for updates

---

### Agent Brain (`backend/src/llm.js`, `brainProvider.js`, `brainMode.js`)

**Providers:**
- **Ollama 8B** (default) — `dm-hunter` model on localhost:11434
- **Meta API** — muse-spark, frozen at $10.0288 (owner approval required)
- **Parent** — file-based handoff for testing (does NOT steer autonomous loop)

**Flow:**
1. Brain receives: memory (titles+hashes), process (current task), screenshot (not yet — text only)
2. Brain returns: structured JSON with `task`, `action`, `why_this`, `why_not_alternatives`
3. `actionPlan.js` validates structure
4. `actionVerify.js` validates executability
5. `scopeGuard.js` validates scope (P1, not deployed)
6. `docker exec` runs the command
7. Output observed, assessed, verified

**Files:**
- `llm.js` (765 lines) — provider abstraction, heartbeat
- `brainProvider.js` — provider selection
- `brainMode.js` (954 lines) — parent mode (discrete actions only)
- `hunt-intel/actionPlan.js` — structured plan validation
- `hunt-intel/actionVerify.js` — pre-execution verification

---

### Memory System

**Per-hunt isolated storage:** `/opt/Dark-Matter/backend/data/hunts/<huntId>/`

| File | Purpose |
|------|---------|
| `meta.json` | Hunt state, iteration, checkpoint, scope |
| `events.jsonl` | Immutable event log (all actions, outputs, findings) |
| `reasoning.jsonl` | Brain reasoning traces |
| `memory.json` | Hunt working memory (via `huntMemory.js`) |
| `process.json` | Current process (via `processMemory`) |
| `DOSSIER.md` | Generated report |
| `driver.lock` | Liveness indicator |

**Memory modules:**
- `huntMemory.js` (976 lines) — working memory, STATE OF MIND
- `reasoningMemory.js` (558 lines) — episodic, premise ledger
- `globalMemory.js` — cross-hunt knowledge (top-6)
- `coverageLedger.js` — attack surface coverage
- `actionIndex.js` — action recall by hash

**Isolation:** Each hunt has its own directory. No cross-hunt leakage observed.

---

### Execution Environment (`backend/src/huntRunner.js`)

**Per-hunt Docker container:**
- Image: Kali Linux
- Name: `dm-hunt-<huntId>`
- Network: `dm-net-<huntId>` (P2, not deployed) or default bridge
- Lifecycle: created on hunt start, persists on pause, never auto-removed

**Execution:**
- `execInHuntContainer(huntId, cmd, timeout)` → `docker exec`
- Captures: stdout, stderr, exit code, timestamps
- Timeout: 120s default
- Auto-respawn if container missing

**Security (P1+P2, not deployed):**
- P1: `scopeGuard.js` validates commands before exec (app layer)
- P2: `egressControl.js` + `egressProxy.js` enforce network isolation (iptables + filtering proxy)

---

### Verifier (`backend/src/hunt-intel/differential.js`)

**Pipeline (4 steps):**
1. `reachability` — target responds
2. `payload_validation` — payload reaches sink
3. `impact_assessment` — behavior proves impact
4. `exploit_confirmation` — reproducible and attacker-controlled

**Class-specific validators (NEW, not deployed):**
- `validateSqliAuthBypass()` — requires auth-state change, rejects login forms
- `validateXssClaim()` — requires unencoded reflection
- `validateCommandInjection()` — requires command output
- `validatePathTraversal()` — requires file content
- `validateVulnClaim()` — dispatcher

**False-positive protections:**
- `executionFailed()` — failed exec produces no evidence
- `httpErrorStatus()` — error pages are not evidence
- `assessContentRelevance()` — signal must be novel vs baseline
- `claimTitleGuard` — probe names never become verified findings (not deployed)
- `evidenceReproduced()` — re-run must reproduce claimed evidence

---

### Scope Enforcement (P1, not deployed)

**File:** `backend/src/scopeGuard.js` (317 lines)

**Enforcement points:**
- Hunt creation: scope persisted immutably in `routes/hunts.js`
- Pre-execution: gate in `huntAgent.js` `executeWithEvasion` (exit 99 on block)
- Validates: hostnames, IPs, ports, protocols, redirects, private networks

**Gap:** Brain Console manual shell path is NOT gated.

---

### Egress Control (P2, not deployed)

**Files:** `backend/src/egressControl.js` (610 lines), `egressProxy.js` (185 lines)

**Design:**
- Per-hunt iptables chain (`dm-hunt-<id>`)
- Per-hunt ipset for allowed destinations
- Filtering proxy for HTTP/HTTPS (ports 80/443 only)
- Default DROP for all other egress
- Fail-closed: if proxy fails, no network

**Status:** 32 unit tests pass. Live T1-T18 battery never executed.

---

## Data Flow: Hunt Turn

```
1. Brain receives context
   ├── memory.json (titles + hashes)
   ├── process.json (current task)
   └── reasoning.jsonl (recent history)

2. Brain plans
   └── actionPlan.js validates structure

3. Pre-execution checks
   ├── actionVerify.js (executability)
   ├── scopeGuard.js (scope) [P1, not deployed]
   └── premiseDedup.js (dead-end check)

4. Execution
   └── docker exec in dm-hunt-<id>
       ├── stdout/stderr/exit captured
       └── timeout enforced

5. Assessment
   ├── assessResult() analyzes output
   ├── claimTitleGuard bounces probe names [not deployed]
   └── evidenceSignalIds extracts signals

6. Verification
   ├── Re-run command (deterministic)
   ├── evidenceReproduced() checks
   ├── verifyPipeline() 4-step
   └── validateVulnClaim() class-specific [not deployed]

7. Persistence
   ├── finding() appends to events.jsonl
   ├── memory updated
   └── checkpoint saved

8. Frontend
    └── Polls API, displays updates
```

---

## Deployment Topology

```
┌─────────────────────────────────────────────────────────┐
│ EC2 (ap-south-1, 2vCPU, 8GB RAM)                        │
│ 13.233.230.240                                          │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   nginx      │  │   Backend    │  │    Ollama    │   │
│  │   :443       │─▶│   :4000      │  │   :11434     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                          │                   │          │
│                          ▼                   ▼          │
│                   ┌──────────────┐  ┌──────────────┐   │
│                   │ Hunt containers│ │  dm-hunter  │   │
│                   │ dm-hunt-*    │  │     8B       │   │
│                   └──────────────┘  └──────────────┘   │
│                                                         │
│  /opt/Dark-Matter/backend/data/hunts/<id>/              │
│  /opt/dm-data (500GB, mounted, empty)                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Cloudflare Pages                                        │
│ https://hack.thebhavesh.online                          │
│ (Frontend, git-integration deploy)                      │
└─────────────────────────────────────────────────────────┘
```

---

## Known Architecture Gaps

1. **No database** — file-based storage works but lacks queries, transactions
2. **No formal tool registry** — 17 OS actions defined ad-hoc, no schemas
3. **Brain is text-only** — no screenshot/pixel input (fundamental limitation)
4. **Two dispatch paths** — `huntAgent.js` and `humanLoop.js` (technical debt)
5. **P1/P2 not deployed** — security controls exist in code only
6. **No mock provider** — cannot test without live LLM
