# Dark Matter — DEVELOPERS.md

> **The complete technical reference for the Dark Matter autonomous bug bounty agent.**
> If you are a developer joining this project, this is the ONE file to read.
> Everything A to Z — nothing is left out.

---

## Table of Contents

1. [What Is Dark Matter?](#1-what-is-dark-matter)
2. [Why Does It Exist?](#2-why-does-it-exist)
3. [The Vision](#3-the-vision)
4. [System Architecture](#4-system-architecture)
5. [Components Deep Dive](#5-components-deep-dive)
   - 5.1 [The Brain](#51-the-brain)
   - 5.2 [Memory System](#52-memory-system)
   - 5.3 [OS Control](#53-os-control)
   - 5.4 [Auto-Filer](#54-auto-filer)
   - 5.5 [OCR Pipeline](#55-ocr-pipeline)
   - 5.6 [Verifier](#56-verifier)
   - 5.7 [Hunt Engine (humanLoop.js)](#57-hunt-engine-humanloopjs)
6. [Hunt Lifecycle](#6-hunt-lifecycle)
7. [Data Flow — End to End](#7-data-flow--end-to-end)
8. [JSON Action Contract](#8-json-action-contract)
9. [Claim Filing Contract](#9-claim-filing-contract)
10. [Directory Structure](#10-directory-structure)
11. [Deployment](#11-deployment)
12. [Configuration & Environment](#12-configuration--environment)
13. [Testing](#13-testing)
14. [Key Design Decisions](#14-key-design-decisions)
15. [Current Status & Roadmap](#15-current-status--roadmap)
16. [Glossary](#16-glossary)

---

## 1. What Is Dark Matter?

**Dark Matter** is an **autonomous bug bounty agent** — an AI system that hunts for security vulnerabilities in web applications the way an elite human bug bounty hunter would.

**The user experience is dead simple:**
1. User pastes a URL (target website)
2. Presses Enter
3. The agent opens the target in its own controlled operating system
4. It hunts the entire website autonomously — recon, exploitation, verification
5. Verified vulnerabilities appear on the frontend with proof

**What it is NOT:**
- Not a scanner (it doesn't just run automated scans)
- Not a chatbot (it takes actions, not just talks)
- Not a script runner (every step is decided fresh by the brain)

**Product naming (owner-set, 31 Oct 2026):**
- Product = **Dark Matter**
- Repo = **Dark-Matter** (github.com/Obfinityy/Dark-Matter, private)
- Company = **Obfinity**
- Internal AI agent = **Infinity AI**

---

## 2. Why Does It Exist?

### The Problem
Bug bounty hunting requires elite human expertise. A skilled hunter:
- Understands business logic (not just technical vulns)
- Thinks creatively (chains vulnerabilities)
- Verifies carefully (no false positives)
- Adapts to each target (no two sites are the same)

This expertise is scarce and expensive. Most companies can't afford continuous human hunting.

### The Solution
Build an AI agent that **replaces a real human bug bounty expert**:
- Thinks like a human (no predefined sequences)
- Controls a full OS like a developer (browser, shell, GUI tools)
- Remembers everything (persistent memory across hunts)
- Verifies rigorously (independent verifier re-runs every claim)
- Works non-stop (only stops on force-stop or budget exhaustion)

### The Business Plan (owner's vision)
1. **Prove** the agent on training grounds (DVWA → Juice Shop)
2. **Submit** to Meta AI Developer Hackathon (video demo)
3. **Hunt** on public bug bounty platforms (HackerOne, Bugcrowd, YesWeHack)
4. **Earn** from found vulnerabilities
5. **Scale** into a company

---

## 3. The Vision

### The "Complete Human" Formula
```
Brain + Memory + OS = Complete Human Hunter
```

- **Brain** = The AI model that thinks and decides (currently Meta API for testing)
- **Memory** = Persistent, per-hunt isolated knowledge (never repeats mistakes)
- **OS** = Full Kali Linux under agent control (browser, shell, GUI, tools)

### Core Principles
1. **Human-style thinking**: NO predefined attack sequences. Every step is decided fresh from memory + live observation.
2. **100% truth rule**: Only verifier-confirmed findings count. No false positives on the frontend.
3. **Per-hunt isolation**: Each target gets its own memory. Never mix contexts.
4. **Non-stop operation**: Hunt runs until force-stopped or budget exhausted.
5. **Proof over claims**: "Ban gaya" (it's done) is only said with evidence.

---

## 4. System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│              hack.thebhavesh.online                          │
│         (React SPA on Cloudflare Pages)                      │
│                                                              │
│  - Hunt dashboard (live view)                                │
│  - Chat interface (talk to agent)                            │
│  - Reports (verified vulns with proof)                       │
│  - Admin portal                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (REST API)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│              api.thebhavesh.online                           │
│         (Node.js on EC2, systemd)                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Hunt Engine │  │ Auto-Filer   │  │    Verifier      │    │
│  │ humanLoop.js │  │ autoFiler.js │  │ (independent)    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘    │
│         │                 │                                   │
│  ┌──────▼─────────────────▼───────┐  ┌──────────────────┐    │
│  │      Brain Provider            │  │  Memory System   │    │
│  │   (Meta API / OpenRouter)      │  │  huntMemory.js   │    │
│  └────────────────────────────────┘  └──────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │ Docker API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   HUNT CONTAINER                             │
│              (Docker, per-hunt isolated)                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Kali Linux  │  │   Chromium   │  │   Xvfb Desktop   │    │
│  │  (full OS)   │  │  (browser)   │  │   (GUI via VNC)  │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
│                                                              │
│  Target: DVWA / Juice Shop / Real sites (scope-controlled)   │
└─────────────────────────────────────────────────────────────┘
```

### Infrastructure
- **Frontend**: Cloudflare Pages (hack.thebhavesh.online), auto-deploys on git push
- **Backend**: AWS EC2 ap-south-1 (m7i-flex.large, 2 vCPU, 8GB RAM)
  - URL: https://api.thebhavesh.online
  - Process: systemd unit `darkmatter-backend` (MUST run via systemd for env vars)
  - Health: `GET /api/v1/health` → `{"ok":true}`
- **Hunt containers**: Docker, one per hunt, named `dm-hunt-<huntId>`
- **Target (testing)**: DVWA at `http://172.17.0.1:3100` (Docker on EC2)

---

## 5. Components Deep Dive

### 5.1 The Brain

**What it is:** The AI model that makes decisions. It receives context and returns JSON actions.

**Current testing brain:** Meta `muse-spark-1.3` via API.

**Key insight (owner, 1 Nov 2026):** "The brain is a stateless API. Every call is FRESH, it remembers nothing. Send EVERYTHING it needs on EVERY call."

**Brain prompt structure:**
- Identity: "You are an elite bug-bounty hunter, human"
- NO pre-written plan (brain decides fresh every turn)
- Receives: memory summary, current goal, progress so far, available actions
- Returns: JSON with `task`, `goal`, `progress`, `why_this`, `why_not_alternatives`, `action`

**Brain providers** (`backend/src/brainProvider.js`):
- Meta API (6 models, for testing)
- OpenRouter (1 model)
- 8B local models REMOVED (1 Nov 2026 — OOM on 8GB box)

**Why not local 8B?** The 8B model OOM'd the 8GB EC2 box to 97% memory. No local LLM.

### 5.2 Memory System

**File:** `backend/src/huntMemory.js`

**Design:**
- **Per-hunt isolated**: Each hunt has its own memory. Never global. Never mix targets.
- **Single read path**: All memory reads go through one function.
- **State of Mind (SOM)**: 12,000-char budget, tail-trimmed. Sent to brain every turn.
- **Append-only**: Everything is preserved forever (mistakes included, so repeats drop).

**What gets stored:**
- Episode ledger (every thought/action, append-only)
- Dead-end registry (what didn't work, so it's not retried)
- Verified findings (with proof)
- Successful chains (technique → target-type → payload)

**Memory flow:**
```
Brain call N:
  Input:  [SOM summary] + [current goal] + [progress]
  Output: [action] + [reasoning]
  Saved:  [full reasoning] → episode ledger
          [outcome] → memory

Brain call N+1:
  Input:  [updated SOM] + [current goal] + [progress]
  ... (brain sees what happened, decides fresh)
```

### 5.3 OS Control

**File:** `backend/src/osControl.js`

**17 actions available to the brain:**
1. `shell` — Run any shell command
2. `browser_navigate` — Go to URL
3. `browser_click` — Click element
4. `browser_type` — Type into field
5. `browser_snapshot` — Get page accessibility tree
6. `screenshot` — Capture screenshot (page)
7. `see_screen` — Capture desktop + OCR (full GUI)
8. `key` — Press keyboard key
9. `open_url` — Open URL in browser
10. `upload_file` — Upload file to target
11. `download_file` — Download from target
12. `intercept_proxy` — Burp/ZAP proxy control
13. `run_tool` — Run security tool (nmap, sqlmap, etc.)
14. `gui_click` — Click at desktop coordinates
15. `gui_type` — Type at desktop
16. `terminal` — Open GUI terminal
17. `claim_finding` — File a vulnerability claim

**The Docker + Xvfb desktop IS the full Kali GUI:**
- fluxbox window manager
- Chromium browser
- xterm terminal
- VNC for live viewing (owner watches LIVE on frontend)

**Real KVM is impossible** on this EC2 box (no /dev/kvm, 2 vCPU). Docker + Xvfb is the solution.

### 5.4 Auto-Filer

**File:** `backend/src/autoFiler.js` (ES module)

**Purpose:** The brain hunts, the filer files. The brain is good at finding vulns but bad at filing claims (won't transcribe hashes). The auto-filer bridges this gap.

**How it works:**
1. After every brain turn, scan `thinkingText + observation` for evidence
2. If strong evidence found, construct a `claim_finding` action automatically
3. The claim goes through the normal verification pipeline

**Strict evidence gate** (v4, commit 1dbd724):
Triggers ONLY on undeniable evidence:
- (a) MD5 hash `/\b[a-f0-9]{32}\b/` in text → SQLi claim, confidence HIGH
- (b) "you have an error in your sql syntax" → SQLi, MEDIUM
- (c) `<script>alert` or "xss confirmed" → XSS, MEDIUM
- (d) `uid=` + `gid=`/`groups=` → CMDI, MEDIUM
- Otherwise: returns null (no trigger)

**Why strict?** Earlier versions fired on verbal intent ("I will prove SQLi") causing false positives and budget burn. The strict gate collapsed the fire rate to zero false triggers.

**Target-agnostic** (commit 7215efd): All hardcoded DVWA URLs replaced with `<TARGET>` placeholder. The verifier substitutes the actual hunt target.

### 5.5 OCR Pipeline

**File:** `backend/src/screenMap.js`

**Purpose:** Extract text from screenshots so the auto-filer can "see" what the brain sees visually.

**How it works:**
1. `captureScreenMap(huntId, deps)` runs INSIDE the hunt container
2. Takes desktop screenshot via `scrot`
3. Runs `tesseract` OCR → TSV format
4. Returns `{ok: true, map: "...", words: [...]}` or `{ok: false, error: "..."}`

**Two integration points:**

**A. OCR-to-Filer** (commit 633c9ca, 1 Nov 2026):
- In the `screenshot` action handler in humanLoop.js
- After screenshot, run OCR and append to observation
- Auto-filer scans observation → sees hashes → files claim
- **Problem:** Brain never takes screenshot action, so this never fires

**B. OCR Loop-Breaker** (commit 55492b9, 1 Nov 2026):
- In the `proof_file_nudge` branch (when brain proven 3x but won't file)
- SYSTEM captures screen via OCR itself, bypassing model's refusal
- Appends `[OCR screen text — system-captured during proof loop]` to observation
- **Status:** Deployed but unexercised (0 OCR events as of 1 Nov 21:00 IST)

### 5.6 Verifier

**Purpose:** Independently verify every filed claim. The brain can be wrong; the verifier is the truth.

**How it works:**
1. Brain (or auto-filer) files claim with `command` (replayable proof)
2. Verifier runs the command independently in a clean environment
3. Verifier judges: does the output prove the vulnerability?
4. Only `verified: true` findings appear on frontend as "Confirmed"

**Claim bounce vs rejection:**
- **BOUNCE**: Claim incomplete (missing fields) → not recorded, no cooldown
- **REJECTION**: Verifier ran the proof, judged it false → recorded as dead end

**100% truth rule:** HuntCard shows ONLY verified vulnerabilities as 'Confirmed'. Unverified leads hidden behind "N leads under investigation" note.

### 5.7 Hunt Engine (humanLoop.js)

**File:** `backend/src/humanLoop.js` (ES module, ~6000 lines)

**This is the core.** The main loop that drives everything.

**Loop structure:**
```
WHILE hunt is running:
  1. Build prompt (SOM + goal + progress + instructions)
  2. Call brain API → get JSON action
  3. Parse and validate action
  4. Check for loops (stuck_detector, proof_file_nudge, dedup_block)
  5. Execute action via osControl
  6. Get observation
  7. Run auto-filer scan (thinkingText + observation)
  8. If claim filed → send to verifier
  9. Save to memory (episode ledger)
  10. Repeat
```

**Loop protection:**
- `stuck_detector`: Fires when brain repeats same action
- `proof_file_nudge`: Fires when claim proven 3x but not filed ("file it, don't re-prove")
- `dedup_block`: Blocks reworded repeat questions
- `exhausted_block`: When all angles tried

**Session management:**
- Human mode runs in sessions (configured 6 turns, but actually ~1 due to bug)
- Container respawn loses DVWA session → re-login loop (known issue)

---

## 6. Hunt Lifecycle

### States
- `running` — Actively hunting
- `paused` — Checkpoint saved, can resume
- `failed` — Error (auto-resume from checkpoint on backend restart)
- `finished` — Hunt finished (not `completed` — the code never uses that string)
- `stopped` — Hunt stopped by the owner
- `out_of_credits` — Budget exhausted, waits for top-up (not `budget_paused` — the code never uses that string; the resume path handles `meta.state === 'out_of_credits'`)

### Creating a Hunt
```
POST /api/v1/hunts
{
  "target": "http://example.com",
  "mode": "human",
  "brain": "muse-spark-1.3"
}
→ Returns huntId (e.g., h_7d49c6ef7447)
→ Docker container spawned: dm-hunt-<huntId>
→ Brain loop starts
```

### Pausing/Resuming
- Pause: Saves exact checkpoint to `data/hunts/<id>/meta.json`
- Resume: Restores from checkpoint, continues from same iteration
- Backend restart: Auto-resumes all `running` hunts from checkpoint

### One-Hunt-at-a-Time
`MAX_CONCURRENT_HUNTS=1`. Additional hunts queue (FIFO, first-started runs first).

---

## 7. Data Flow — End to End

### The Happy Path (what SHOULD happen)

```
1. Brain thinks: "I see SQLi in the login form"
              ↓
2. Brain acts: {"action": "shell", "command": "curl ... UNION SELECT ..."}
              ↓
3. OS executes: Runs curl in hunt container
              ↓
4. Observation: "5f4dcc3b5aa765d61d8327deb882cf99 ..." (hashes in output)
              ↓
5. Auto-filer scans: Finds MD5 hash → constructs claim
              ↓
6. Claim filed: {title, class: "sqli", evidence, command, confidence: "high"}
              ↓
7. Verifier: Re-runs command independently
              ↓
8. Verified: true → Frontend shows "Confirmed: SQL Injection (CRITICAL)"
              ↓
9. Owner notified: Instant alert with proof
```

### What's Actually Happening (1 Nov 2026)

```
1. Brain thinks: "SQLi proven ×3, filing required"
              ↓
2. Brain acts: {"action": "recall", ...} (loops, doesn't file)
              ↓
3. proof_file_nudge fires: "Proof complete — file it!"
              ↓
4. OCR loop-breaker: Tries to capture screen...
              ↓
5. ❌ 0 OCR events — screen capture returns nothing useful
              ↓
6. Brain loops back to recall#267
              ↓
7. (Repeat indefinitely, burning budget)
```

**The blocker:** The Meta model will not transcribe 32-char hash strings from screen to text, and will not take screenshot actions. The system-level bypasses are built but not yet triggering successfully.

---

## 8. JSON Action Contract

Every brain response MUST be valid JSON with this structure:

```json
{
  "task": "Current micro-task (e.g., 'Test SQLi in login form')",
  "goal": "Overall hunt goal (e.g., 'Find all vulns in DVWA')",
  "progress": "What's done so far (e.g., 'Logged in, found SQLi in User ID field')",
  "why_this": "Why this action now (min 20 chars)",
  "why_not_alternatives": "Why not other actions (min 20 chars)",
  "action": {
    "action": "shell",
    "command": "curl 'http://target/vuln.php?id=1 UNION SELECT 1,2--' "
  }
}
```

**Exactly ONE action per turn.** Multiple actions are rejected.

### Valid Action Types
See [5.3 OS Control](#53-os-control) for the 17 available actions.

### Claim Filing Action
```json
{
  "action": "claim_finding",
  "title": "SQL Injection in User ID field",
  "class": "sqli",
  "evidence": "UNION query dumped 5 users with MD5 hashes: 5f4dcc3b...",
  "command": "curl 'http://<TARGET>/vulnerabilities/sqli/?id=1 UNION SELECT user,password FROM users-- &'",
  "counterevidence": "Tested with benign input, no error; only UNION triggers dump",
  "confidence": "high"
}
```

**Required fields:** `title`, `class`, `evidence`, `command`, `confidence`
**Required if confidence != "high":** `confidence_rationale`

---

## 9. Claim Filing Contract

### Proof Gate (completeness check)
Before a claim reaches the verifier, it must pass the proof gate:
- All required fields present? If no → **BOUNCE** (not recorded)

### Independent Verification
1. Verifier extracts the `command` from the claim
2. Runs it in a clean container (no brain context)
3. Compares output to `evidence`
4. Judges: does this PROVE the vulnerability?

### Verdicts
- `verified: true` → Shows on frontend as "Confirmed", owner notified
- `verified: false` (false_positive) → Recorded as dead end, never re-filed as-is
- `verified: false` (exploit_failed) → Command didn't work, can retry with new proof

### Never Re-file As-is
These are permanently dead (do not re-file without genuinely new proof):
- File Upload (rejected twice)
- Weak Session IDs (rejected twice)
- Insecure CAPTCHA (all angles exhausted)
- /phpinfo.php (not a vuln)
- CSP module (one sink, already found)
- FTP directory listing (false-positive family)

---

## 10. Directory Structure

```
Dark-Matter/
├── README.md                   # Project overview
├── AGENTS.md                   # Operating manual (how to work here)
├── COORDINATION.md             # Multi-AI sync (Infinity One ↔ Two)
├── VISION.md                   # Product vision
├── THIRD_PARTY_NOTICES.md      # Legal (licenses)
├── DEVELOPERS.md               # THIS FILE (complete technical reference)
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── App.jsx             # Main app (ChatGPT-like UI)
│   │   ├── pages/              # ChatPage, AdminPage, etc.
│   │   └── components/         # HuntCard, LiveViewer, etc.
│   └── public/
│       └── d/                  # Obfinity dashboard (/d route)
│
├── backend/                    # Node.js API + hunt engine
│   └── src/
│       ├── humanLoop.js        # THE HUNT ENGINE (~6000 lines)
│       ├── autoFiler.js        # Auto-claim filer
│       ├── brainProvider.js    # Brain API abstraction
│       ├── huntMemory.js       # Per-hunt memory system
│       ├── osControl.js        # 17 OS actions
│       ├── screenMap.js        # OCR pipeline
│       ├── llm.js              # LLM client
│       └── routes/             # API endpoints
│
├── brain-py/                   # Python brain demos (parent-as-brain)
│   └── brain-apiloop-v1.py     # Proven 11/11 on DVWA, $0
│
├── engine/                     # Security tools (pentagi, etc.)
│
├── ideas/                      # Future roadmap (10,000 ideas)
│
└── docs/                       # Additional documentation
    └── aws-deploy.md           # EC2 deployment guide
```

**Root holds ONLY:** frontend, backend, ideas, brain-py, engine, docs, .gitignore, AGENTS.md, COORDINATION.md, README.md, VISION.md, DEVELOPERS.md, THIRD_PARTY_NOTICES.md

---

## 11. Deployment

### Backend (EC2)
```bash
# SSH (direct route, Tailscale is down)
ssh -o ProxyCommand="python3 ~/workspace/proxy_ssh_direct.py %h %p" \
    -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 \
    ubuntu@13.233.230.240 "<command>"

# Deploy (from EC2 /opt/Dark-Matter)
git pull origin main  # or merge --ff-only origin/main
sudo systemctl restart darkmatter-backend
curl https://api.thebhavesh.online/api/v1/health  # → {"ok":true}

# MUST run via systemd (not manually)
# Manual processes lack EGRESS_SKIP_LAB/EGRESS_USE_SUDO env vars
# Always verify: cat /proc/<pid>/environ | tr '\0' '\n' | grep EGRESS
```

### Frontend (Cloudflare Pages)
- Auto-deploys on git push to main (takes ~5 min)
- URL: https://hack.thebhavesh.online
- Manual check: curl the URL and verify bundle hash changed

### Git Push (from EC2)
```bash
# Token-URL method (GIT_ASKPASS fails)
TOKEN=$(cat ~/.git-credentials | grep -oP 'https://[^:]+:\K[^@]+' | head -1)
git push "https://Obfinity:${TOKEN}@github.com/Obfinityy/Dark-Matter.git" main
# NOTE: This does NOT update local origin/main ref — run git fetch after
```

---

## 12. Configuration & Environment

### Required Environment Variables (systemd)
```
META_API_KEY=<secret>          # Never print/log this
EGRESS_USE_SUDO=1              # Required for hunt network isolation
EGRESS_SKIP_LAB=1              # Skip lab network restrictions
JWT_SECRET=<secret>            # In /etc/darkmatter/env (0600)
```

### Key Configuration
- `MAX_CONCURRENT_HUNTS=1` — One hunt at a time
- `DEFAULT_BRAIN_MODEL` — Currently points to removed model (latent bug, awaiting owner decision)
- Budget: Enforced per-hunt and globally

### Hunt Data Location
```
/opt/Dark-Matter/backend/data/hunts/<huntId>/
├── meta.json          # State, iteration, checkpoint
├── events.jsonl       # All events (append-only)
├── reasoning.jsonl    # Brain reasoning history
├── driver.lock        # Freshness heartbeat
├── outputs.json       # Structured outputs
└── artifacts/         # Screenshots, dumps, etc.
```

---

## 13. Testing

### Backend Test Suite
```bash
cd /opt/Dark-Matter/backend
npm ci  # Fresh install first
node --test 'src/**/*.test.js'
# Baseline (1 Nov 2026): 859 tests, 848 pass, 0 fail, 11 skipped
```

**Note:** `huntCrashRecovery.test.js` boots a REAL backend (~20s). Run sequentially or ≤2-way parallel.

### Manual Verification
1. **Health**: `curl https://api.thebhavesh.online/api/v1/health`
2. **Hunt state**: Check `meta.json` for state/iteration
3. **Container**: `docker ps --filter name=dm-hunt-<id>`
4. **Frontend**: Open hack.thebhavesh.online in browser, verify visually

### The "Ban Gaya" Bar
Never say "it's done" without:
1. Root cause identified (not just symptom fixed)
2. Verified in the live browser (not just API check)
3. Exact reproducible numbers (not vague "it works")

---

## 14. Key Design Decisions

### Why no predefined attack sequences?
The owner ordered: "brain's reply carries current task + goal + progress; NOTHING predefined." A real human doesn't follow a script — they adapt. The brain must decide fresh every turn.

### Why per-hunt memory isolation?
Different targets have different contexts. Mixing them causes confusion and false positives. Each hunt is a clean slate with its own lessons.

### Why a separate auto-filer?
The Meta model is good at hunting but bad at filing (won't transcribe hashes). Instead of fighting the model, we built a system that files for it. "The brain hunts; the filer files. Together they are the complete human."

### Why OCR instead of asking the model to transcribe?
We tried (prompt instruction, commit 2a1a963). The model still wouldn't do it. OCR bypasses the model entirely — a permanent system-level fix.

### Why Docker + Xvfb instead of real KVM?
Real KVM is impossible on the EC2 box (no /dev/kvm, 2 vCPU, ~154MB RAM free). Docker + Xvfb provides a full GUI desktop that the agent can control.

### Why one hunt at a time?
Resource constraints (2 vCPU, 8GB RAM) and focus. One elite hunter does one target well, not five targets poorly.

---

## 15. Current Status & Roadmap

### As of 1 Nov 2026, 21:00 IST

**Built (infrastructure):**
- ✅ Full OS control (17 actions)
- ✅ Per-hunt memory system
- ✅ Auto-filer with strict evidence gate
- ✅ OCR pipeline (screenMap.js)
- ✅ OCR-to-filer integration
- ✅ OCR loop-breaker
- ✅ Independent verifier
- ✅ Frontend with live view
- ✅ Admin portal

**Not yet proven:**
- ❌ End-to-end auto-claim (0 filed, 0 verified on Meta test hunt)
- ❌ OCR actually capturing hashes in production
- ❌ Brain breaking out of transcription loop

**The blocker:** Meta muse-spark-1.3 will not transcribe 32-char hashes or take screenshot actions. System bypasses are built but not yet firing successfully.

**Next milestones:**
1. **Prove end-to-end**: First auto-filed claim verified on DVWA → say "Done Boss"
2. **Juice Shop**: Next training ground after DVWA
3. **Meta Hackathon**: Video demo → submit by 5 Nov 07:30 IST
4. **Public bug bounty**: HackerOne/Bugcrowd/YesWeHack → earn → scale

### Training Ground Order
1. **DVWA** (current) — Training ground, prove the level
2. **Juice Shop** — Next, after DVWA proven
3. **Infomaniak** (h_de4fc035049d, PAUSED at iter 129) — Real target, after level proven

---

## 16. Glossary

- **Brain**: The AI model that thinks and decides actions
- **Hunt**: One autonomous bug bounty session against one target
- **Iteration**: One brain turn (think → act → observe)
- **Claim**: A filed vulnerability report awaiting verification
- **Verified**: A claim the independent verifier confirmed as true
- **Proof file nudge**: System telling brain "you've proven this 3x, FILE it"
- **Stuck detector**: System detecting when brain repeats same action
- **Dedup block**: System blocking reworded repeat questions
- **OCR**: Optical Character Recognition (image → text)
- **SOM**: State of Mind (memory summary sent to brain each turn)
- **Auto-filer**: System that files claims automatically from evidence
- **Egress**: Network traffic leaving the hunt container (scope-controlled)

---

## Appendix: Quick Reference

### SSH to EC2
```bash
ssh -o ProxyCommand="python3 ~/workspace/proxy_ssh_direct.py %h %p" \
    -o StrictHostKeyChecking=no -o ConnectTimeout=20 \
    -i ~/.ssh/id_ed25519 ubuntu@13.233.230.240 "<cmd>"
```

### Check Hunt Status
```bash
cat /opt/Dark-Matter/backend/data/hunts/<huntId>/meta.json | python3 -m json.tool
```

### Check Backend Health
```bash
curl -s https://api.thebhavesh.online/api/v1/health
# → {"ok":true}
```

### View Hunt Events
```bash
tail -50 /opt/Dark-Matter/backend/data/hunts/<huntId>/events.jsonl
```

### Restart Backend
```bash
sudo systemctl restart darkmatter-backend
sleep 5
curl -s https://api.thebhavesh.online/api/v1/health
```

---

*Last updated: 1 Nov 2026, 21:20 IST*
*Maintained by: Infinity One (main agent)*
*For: Bhavesh Sharma (owner) and all future developers*
