# Phase 2: Gap Analysis — Dark Matter vs Elite Human Hunters

**Date:** 2026-10-07
**Method:** Audited 573 engine files + agent orchestration against Tracks 1–4 research.
**Verdict style:** Brutally honest. What's shallow is called shallow.

---

## 1. What We Have (Honest Inventory)

### 1.1 Recon: STRONG (best-in-class breadth)

**573 engine files** in `backend/src/engines/`. The recon coverage is genuinely impressive:
- Subdomain/CT recon (`ctRecon.js`, `subdomainCandidates` in eliteRecon)
- Tech fingerprinting (`eliteRecon.js` — `fingerprintTech`, `scoreEndpoint`)
- JS bundle mining (`bundleEndpointMiner.js`, `bundleGraphMining.js`, `jsBundleIntel.js`, `sourceMapHunter.js`)
- Secret scanning (`secretScanner.js` — AWS keys, Stripe, GitHub tokens, private keys)
- JWT analysis (`jwtAnalyzer.js` — alg:none, weak secrets, sensitive payload)
- CORS checker (`corsChecker.js` — wildcard + credentials)
- Takeover checker (`takeoverChecker.js` + prescreen)
- GraphQL recon (`graphqlIntrospector.js`, `graphqlEndpointFingerprint.js`)
- Cloud recon (`cloudEngine.js` — S3 buckets, Firebase)
- Parameter mining (`paramMiner.js`)
- CDN/origin analysis (`cdnOriginHunter.js`, `cdnCacheBypassProber.js`)
- External tools via registry: nuclei, sqlmap, dalfox, ffuf, subfinder, amass, naabu, katana, arjun, gau, waybackurls, wafw00f, subzy

**Honest assessment:** This is the strongest layer. An elite hunter's recon pipeline (subfinder → httpx → JS mining → secrets → takeover) is substantially covered. The *weakness* is orchestration, not coverage (see §2.1).

### 1.2 Active Probing: SHALLOW (the critical weakness)

Built-in probes in `tools/builtin/`:
| Probe | What it does | Elite equivalent | Gap |
|---|---|---|---|
| `xssProbe` | Reflected canary check | Context analysis, CSP bypass, mXSS, DOM | Tests reflection only; no context/CSP reasoning |
| `sqliProbe` | Error-based signatures | Blind/time-based, WAF ladder, second-order | Error patterns only; no blind extraction, no bypass ladder |
| `idorProbe` | GET /users/1 vs /users/2 **unauthenticated** | Two-account harness, tenant headers, GraphQL pivots | **No authenticated testing at all.** Only tests missing-auth, not real IDOR |
| `jwtProbe` | (exists, untested depth) | alg:none → RS256/HS256 → kid injection → jku SSRF | Unknown depth; likely basic |
| `sstiProbe` | Template markers | Fingerprinting, filter bypass, RCE escalation | Marker detection only |
| `xxeProbe` | (exists) | Blind OOB, parameter entities, two-stage exfil | Unknown depth |
| `graphqlProbe` | Endpoint discovery | Introspection, field-IDOR, batching, alias attacks | Discovery only |
| `websocketProbe` | (exists) | CSWSH, per-message auth, frame injection | Unknown depth |
| `raceProbe` | (exists) | Single-packet H2, multi-endpoint, Turbo Intruder | Unknown depth |
| `secretsProbe` | Regex scanning | Prove-what-it-accesses | Finds secrets; doesn't validate access |

**Honest assessment:** The probes test the *easy case* of each vuln class. An elite hunter's value is in the hard cases: authenticated IDOR, blind SQLi behind WAFs, CSP-bypassing XSS, second-order injections. Our probes would catch what a scanner catches — and scanners get duped.

### 1.3 Vulnerability Detection: PASSIVE PATTERN MATCHING

`vulnDetector.js` (182 lines):
- SQLi: regex on error messages in responses
- XSS: canary string reflection check
- SSRF: parameter *name* matching (doesn't test SSRF)
- IDOR: numeric ID *detection* (doesn't test IDOR)

**Honest assessment:** This is **recon-level hinting**, not vulnerability testing. It flags "this parameter *looks like* it could be SSRF" without sending a single SSRF payload. Useful for prioritization; useless for findings.

### 1.4 Chain Building: STATIC LABELING (not a chain engine)

`chainBuilder.js` `findChains()`: checks if findings match predefined pairs (XSS+Session=OAuth chain, etc.). It does NOT:
- Actively test whether A enables B
- Time-box B-hunting after finding A
- Build novel chains from unexpected combinations
- Prove the chain end-to-end

**Honest assessment:** It's a report formatter, not a chain engine. The research says chains are the #1 elite differentiator and ~70% automatable. We have ~5% of that.

### 1.5 Business Logic: SCAFFOLDING ONLY

`businessLogicEngine.js` (399 lines): has mutation helpers (`mutateParam`, `duplicateParam`, `stripAuth`, `skipToFinalStep`, `markParallel`, `incrementIdParam`) and detectors (`detectLogicChange`, `detectAuthBypass`, `detectRaceWin`, `detectIdor`).

**Honest assessment:** The *primitives* exist but there's no **stateful multi-step scenario runner**. No purchase flow, no refund flow, no two-account invite flow. The research says business logic is blind spot #1 for AI and the highest-paying class. We have the Lego bricks but no assembled scenarios.

### 1.6 Report Generation: FORMATTER (not elite report engine)

`aiReportWriter.js` (102 lines): `findingToMarkdown`, `huntReportToMarkdown`. Basic markdown assembly.

**Missing vs Track 4:**
- No 60-second triager checklist validator
- No replay-before-submit
- No real CVSS vector computation (riskScorer does 0–10 internal scale)
- No impact engine (4-question framework)
- No CWE → remediation lookup (generic advice risk)
- No evidence hygiene (token/PII redaction)
- No duplicate pre-screening
- No severity-request paragraph generation

### 1.7 Memory: DESTRUCTIVE TRUNCATION

`chatMemoryService.js`: `MAX_MESSAGES = 200` with `messages.slice(-MAX_MESSAGES)` — **deletes history**. No summaries, no indexes, no cross-hunt persistence.

`agent/memory/` has `agentMemory.js` (215 lines) + `fileMemory.js` (258 lines) — better, but the chat path (what the user sees) is destructive.

**Research says:** Context Amnesia is 38% of AI failures. We're living it.

### 1.8 Hunt Orchestration: STAGED BUT NOT GOAL-DRIVEN

`methodology.js`: stages `recon → enumeration → probing → exploitation → chaining → reporting`. Good skeleton.

**Missing vs Track 1:**
- No per-session goal selection (crown jewel thinking)
- No vuln-class focus (1–2 classes per session)
- No time budgets per endpoint (5-min/20-min/1-hour rules)
- No hypothesis journal (parked primitives)
- No "every action cites its hypothesis" enforcement
- No yield telemetry / strategy rotation

### 1.9 Missing Entirely (no code)

- **OAuth flow tester** (only miners, no active redirect_uri mutation)
- **Two-account harness** (critical for IDOR/auth testing)
- **Anti-surrender engine** (no WAF bypass ladder, no retry logic)
- **Triage gate** (5-check validation before findings advance)
- **Validator agents** (XBOW pattern — peer review)
- **Monitor mode** (continuous per-target state)
- **Novelty watcher** (changelog monitoring)
- **Program intelligence** (scoring, dossier compiler)
- **HTTP desync/smuggling tester** (only one differential file)
- **Mass assignment tester** (no dedicated module)
- **Second-order testing** (stored → triggered elsewhere)
- **Differential testing** (mobile vs web, free vs paid)

---

## 2. Gaps by Category

### 2.1 Methodology Gaps

| # | Gap | Impact | Effort | Automatable? |
|---|---|---|---|---|
| M1 | No crown-jewel goal selection per hunt | HIGH — hunts lack direction | LOW — prompt + scoring | YES |
| M2 | No per-session vuln-class focus (1–2 classes) | HIGH — wandering, shallow coverage | LOW | YES |
| M3 | No time budgets (5/20/60-min rules) | MED — prevents stuck loops | LOW | YES |
| M4 | No hypothesis journal (parked primitives) | HIGH — loses leads across sessions | MED — needs state store | YES |
| M5 | No "action cites hypothesis" enforcement | MED — untraceable decisions | MED | YES |
| M6 | No yield telemetry / strategy rotation | MED — can't learn what works | MED | YES |
| M7 | No target richness assessment at hunt start | LOW — nice-to-have | LOW | YES |

### 2.2 Technical Gaps (vuln classes)

| # | Gap | Impact | Effort | Automatable? |
|---|---|---|---|---|
| T1 | **Two-account IDOR harness** (authenticated) | **CRITICAL** — IDOR is #1 API vuln, we test 0% of real cases | MED — needs auth flow | YES |
| T2 | **OAuth active tester** (redirect_uri matrix, PKCE, state) | HIGH — $500–$20k payouts | MED | HYBRID |
| T3 | **Blind SQLi** (time-based, boolean, WAF ladder) | HIGH — we only do error-based | MED — payload library | HYBRID |
| T4 | **XSS context engine** (CSP analysis, bypass ladder) | HIGH — reflection ≠ exploitability | HIGH | HYBRID |
| T5 | **SSRF active tester** (Collaborator, metadata, parser diffs) | **CRITICAL** — $25k–$40k payouts | MED | HYBRID |
| T6 | **Mass assignment tester** | HIGH — fully automatable per research | LOW — param injection loop | YES |
| T7 | **Race condition runner** (parallel requests, H2) | MED — $2.5k–$15k payouts | MED | YES |
| T8 | **GraphQL attacker** (introspection → field IDOR → batching) | HIGH — under-hunted | MED | HYBRID |
| T9 | **JWT forge matrix** (alg:none → kid → jku) | MED — scriptable loop | LOW | YES |
| T10 | **SSTI fingerprinter + RCE ladder** | HIGH — $5k–$30k | MED | HYBRID |
| T11 | **XXE OOB tester** (blind, parameter entities) | MED | MED | HYBRID |
| T12 | **Desync/smuggling prober** | MED — $5k–$30k, low dup rate | HIGH | HYBRID |
| T13 | **WebSocket tester** (CSWSH, per-message auth) | MED | LOW | YES |
| T14 | **Second-order tester** (stored → triggered) | HIGH — elite technique | HIGH | HYBRID |
| T15 | **Business-logic scenarios** (purchase, refund, invite, role) | **CRITICAL** — highest-paying class, blind spot #1 | HIGH | HYBRID |
| T16 | **Cache poisoning tester** | MED — $6k–$19k | MED | HYBRID |
| T17 | **Prototype pollution oracle** | MED | LOW | YES |

### 2.3 Tooling Gaps

| # | Gap | Impact | Effort | Automatable? |
|---|---|---|---|---|
| TL1 | **Anti-surrender engine** (WAF fingerprint → bypass ladder) | HIGH — recovers 21% of bounties | MED | YES |
| TL2 | Tools not actually invoked (registry exists, wiring unclear) | HIGH — nuclei/sqlmap/dalfox in registry but hunt flow unclear | MED — integration | YES |
| TL3 | No target-specific wordlist generation | MED — elite edge | LOW | YES |
| TL4 | No nuclei template forge (CVE → template) | MED | MED | YES |

### 2.4 Report Gaps

| # | Gap | Impact | Effort | Automatable? |
|---|---|---|---|---|
| R1 | **No replay-before-submit** | **CRITICAL** — #1 rejection reason | MED | YES |
| R2 | **No real CVSS computation** | HIGH — triagers expect vectors | LOW — formula exists | YES |
| R3 | **No impact engine** (4-question framework) | HIGH — $500 vs $5k difference | MED | YES |
| R4 | **No evidence hygiene** (token/PII redaction) | HIGH — safety + professionalism | LOW | YES |
| R5 | **No duplicate pre-screen** | HIGH — 40% of submissions duped | MED | YES |
| R6 | **No CWE → remediation lookup** | MED | LOW | YES |
| R7 | Generic 0–10 risk score instead of CVSS | MED | LOW | YES |

### 2.5 AI-Architecture Gaps

| # | Gap | Impact | Effort | Automatable? |
|---|---|---|---|---|
| A1 | **Destructive memory truncation** (200-msg cliff) | **CRITICAL** — 38% of AI failures | MED — needs redesign | YES |
| A2 | **No triage gate** (5-check validation) | **CRITICAL** — 31% FP flooding | MED | YES |
| A3 | **No validator agents** (XBOW peer review) | HIGH — 0% FP achievable | HIGH | YES |
| A4 | **Chain planner is static** (not active) | **CRITICAL** — elite differentiator | HIGH | YES (70%) |
| A5 | **No monitor mode** (continuous state) | HIGH — elite edge | MED — needs A1 | YES |
| A6 | **No insight ranker** (anomaly over recon) | HIGH — data→insight gap | MED | YES |
| A7 | **No logic modeler** (app state machine) | **CRITICAL** — business logic blindness | HIGH | HYBRID |
| A8 | **No program intelligence** | MED | MED | YES |
| A9 | **No novelty watcher** | MED | LOW | YES |

---

## 3. Gap Priority Matrix

Scored by: **Bounty Impact** × **Feasibility** (automatable = higher feasibility)

### Tier 0 — Build First (highest ROI)

| Priority | Gap | Why first |
|---|---|---|
| 1 | **A2: Triage Gate** | Kills FP flooding (31% of failures). Without this, everything else produces noise. Post-Google-pause, programs demand evidence. |
| 2 | **R1: Replay-before-submit** | #1 rejection reason is "cannot reproduce." This is the gate that makes reports submittable. |
| 3 | **A1: Memory redesign** | 38% of failures. Unlocks chaining, monitor mode, cross-hunt learning. Foundation for everything. |
| 4 | **T1: Two-account IDOR harness** | IDOR/BOLA is the #1 API vuln. We currently test 0% of real (authenticated) cases. Fully automatable. |
| 5 | **T6: Mass assignment tester** | Fully automatable per research. Param injection + GET-diff loop. Quick win. |

### Tier 1 — Build Second (elite differentiators)

| Priority | Gap | Why second |
|---|---|---|
| 6 | **A4: Active chain planner** | Turns lows into criticals (3–10× payout). The #1 elite technique. ~70% automatable. |
| 7 | **TL1: Anti-surrender engine** | Recovers 21% of bounties left on table. WAF bypass ladders are scriptable. |
| 8 | **T5: SSRF active tester** | $25k–$40k payouts. Collaborator + metadata ladder is well-understood. |
| 9 | **R2+R3: CVSS + Impact engine** | $500 vs $5,000 difference is presentation. Formula + slot-fill. |
| 10 | **M1+M2+M4: Goal-driven hunting** | Crown jewel + vuln focus + hypothesis journal. Low effort, high direction. |

### Tier 2 — Build Third (depth)

| Priority | Gap |
|---|---|
| 11 | T2: OAuth active tester |
| 12 | T3: Blind SQLi + WAF ladder |
| 13 | T8: GraphQL attacker |
| 14 | A6: Insight ranker |
| 15 | T15: Business-logic scenarios (start with 4 flows) |

### Tier 3 — Advanced (later)

| Priority | Gap |
|---|---|
| 16 | A3: Validator agents |
| 17 | A5: Monitor mode |
| 18 | T4: XSS context engine |
| 19 | T12: Desync/smuggling |
| 20 | A7: Full logic modeler |

---

## 4. Top 10 Implementation Priorities (Concrete Build Order)

### 1. Triage Gate Service (`backend/src/engines/triageGate.js`)
**What:** 5-check validation every finding must pass: (1) target in scope, (2) vuln class identified with CWE, (3) detection evidence captured, (4) **impact demonstrated** (hard gate — no theoretical findings), (5) confidence ≥ 0.70.
**Why first:** Without this, all new testing capability produces noise. This is the foundation of program trust.
**Effort:** 2–3 days. Pure logic, no new recon needed.

### 2. Replay Pipeline (`backend/src/engines/replayValidator.js`)
**What:** Before any finding reaches a report, re-run the exact attack in a clean session. If replay fails → downgrade, don't submit. Store the replay as the PoC artifact.
**Why:** #1 rejection reason is "cannot reproduce." This makes every report submittable.
**Effort:** 3–4 days. Needs request recording + clean-session replay harness.

### 3. Memory Redesign (`backend/src/services/huntMemoryService.js`)
**What:** Replace 200-message destructive truncation with 3-layer system: working memory (full recent) → summaries (rolling) → long-term index (searchable). Preserve across hunts. Crash-safe resume via `ledger.json` + `worklog.jsonl`.
**Why:** 38% of AI failures. Unlocks chaining, monitor mode, learning.
**Effort:** 4–5 days. Architectural, touches multiple paths.

### 4. Two-Account IDOR Harness (`backend/src/engines/idorHarness.js`)
**What:** Automated attacker+victim account flow: register two accounts (or use provided creds), crawl as victim to map object IDs, replay as attacker with swapped IDs, diff responses. Test path IDs, query params, body fields, headers, GraphQL.
**Why:** We test 0% of real IDOR today. This is the #1 API vulnerability class.
**Effort:** 4–5 days. Needs auth handling + crawling.

### 5. Mass Assignment Tester (`backend/src/engines/massAssignTester.js`)
**What:** For every write endpoint (PUT/PATCH/POST): inject `role`, `is_admin`, `is_verified`, `plan`, `balance` etc., then GET to verify persistence. Test JSON and form encodings separately.
**Why:** Fully automatable, high hit rate, quick to build.
**Effort:** 2 days. Simple loop.

### 6. Active Chain Planner (`backend/src/engines/chainPlanner.js`)
**What:** Replace static `findChains()` with an active engine: every validated finding becomes a graph node; planner asks "what does this unlock?" using a signal table (A→B pairs from research); time-boxed B-probing (20 min per candidate); prove each hop; iterate to C.
**Why:** The elite differentiator. Chains pay 3–10× singles.
**Effort:** 1–2 weeks. The hardest Tier 0/1 item, but highest value.

### 7. Anti-Surrender Engine (`backend/src/engines/antiSurrender.js`)
**What:** Detect capitulation patterns (WAF block → abort). On block: fingerprint the WAF, inject bypass strategies (encoding, method tampering, header smuggling, timing), track attempts per control, escalate after N failures.
**Why:** Recovers 21% of bounties. Scriptable bypass ladders.
**Effort:** 3–4 days. Playbook library + detection logic.

### 8. SSRF Active Tester (`backend/src/engines/ssrfTester.js`)
**What:** For every URL-accepting parameter: inject Collaborator URL → confirm DNS callback → aim at cloud metadata (AWS/GCP/Azure) → test parser differentials (decimal/octal/hex IP, @-confusion, redirect hops).
**Why:** $25k–$40k payouts. Well-understood technique.
**Effort:** 3–4 days. Needs OOB infrastructure (interactsh).

### 9. CVSS + Impact Engine (`backend/src/engines/cvssEngine.js`, `impactEngine.js`)
**What:** Real CVSS 3.1 vector computation from evidence (not eyeballing). 4-question impact slot-fill: who/what/business consequence/scale. Multiplier detection (chain/admin/regulatory/scale). CWE → remediation lookup table.
**Why:** Presentation is the $500 vs $5,000 difference.
**Effort:** 3 days. Formula + templates.

### 10. Goal-Driven Hunt Controller (`backend/src/agent/huntDirector.js`)
**What:** At hunt start: select crown-jewel goal (1 of 5) + 1–2 vuln classes. Every action must cite its hypothesis. Hypothesis journal for parked primitives. Time budgets per endpoint. Yield tracking.
**Why:** Stops wandering. Gives hunts direction. Low effort, high leverage.
**Effort:** 3–4 days. Orchestration logic.

---

## 5. Brutal Summary

**What we're good at:** Recon. 573 engines of recon coverage is genuinely elite-tier breadth. If the job were "map the attack surface," we'd be top-10%.

**What we're bad at:** Everything after recon. Our "exploitation" is shallow probes testing easy cases. Our "chaining" is static labeling. Our "reports" are markdown formatting. Our "memory" deletes itself.

**The gap in one sentence:** We built the eyes of an elite hunter but not the hands, the memory, or the judgment.

**The path:** Tier 0 (triage + replay + memory + IDOR + mass-assign) makes us *credible*. Tier 1 (chaining + anti-surrender + SSRF + reports + direction) makes us *dangerous*. Tier 2+ makes us *elite*.

**Estimated timeline for Tier 0:** 3–4 weeks of focused implementation.
**Estimated timeline for Tier 0+1:** 8–10 weeks.
**Full elite parity:** 6+ months, and even then the human-intuition gaps (novel techniques, business-logic abduction) remain partially open — which is exactly where the research says AI should stay human-supervised.
