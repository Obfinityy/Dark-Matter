Research complete. Here is the structured report.

---

# RESEARCH REPORT: High-Level Vulnerability Discovery Repos & Techniques
*Research-only. Nothing cloned, no code written. Techniques extracted for original implementation.*

## Context calibration (from the field)
Per the curated benchmark data found (`acorzo1983/awesome-autonomous-pentest`): autonomous agents still top out around **13–21% on real-world exploitation**. Two landmark papers set the design direction: a **single** GPT-4 agent autonomously exploits **87% of 15 critical one-day CVEs** (arXiv 2404.08144), while **teams** of agents (HPTSA, arXiv 2406.01637) exploit **14 real zero-days** with **4.3× improvement** over single agents — because zero-day work needs multi-agent decomposition, not just a bigger model. This directly informs the technique ranking below.

---

## REPOS BY CATEGORY

### 1. LLM/AI-driven pentest agents

**1a. GreyDGL/PentestGPT** — https://github.com/GreyDGL/PentestGPT — ~8k+ stars (approx) — MIT
USENIX Security 2024 paper (NTU). The canonical academic LLM pentest agent. Core innovation is the **three-module split**: a **Reasoning module** ("what should I do next?", maintains a task tree), a **Generation module** ("write the exact command"), and a **Parsing module** ("what did that output mean?", cleans tool output). v1.0 added an autonomous agentic pipeline, session persistence, and Docker-first execution.
*Implementable techniques:*
- **Reasoning/Generation/Parsing separation** — stop asking one LLM call to plan+act+interpret; split into three focused prompts. Parsing module alone cuts hallucinated "success" claims dramatically.
- **Persistent task tree** — maintain an explicit tree of tried/planned actions (not just chat history) so the agent never re-tries dead ends and can backtrack.
- **Session persistence** — serialize hunt state (task tree + findings + tool outputs) so a 3-day hunt survives restarts; this is exactly the user's "close browser, come back in 3 days" requirement.

**1b. HPTSA — "Teams of LLM Agents can Exploit Zero-Day Vulnerabilities"** (arXiv 2406.01637)
Research system (paper + prototype): a **hierarchical planner** decomposes the attack surface and orchestrates **specialized subagents per vulnerability class** (SQLi agent, XSS agent, SSRF agent…), feeding results back to the planner for strategy adjustment. 4.3× better than single agents on zero-days.
*Implementable techniques:*
- **Planner + specialist subagents** — our engine already has Orchestrator→Researcher→Developer→Executor; add a **vuln-class specialist layer** (each specialist owns one CWE family with its own playbook) coordinated by the planner.
- **Feedback-driven strategy adjustment** — planner re-ranks attack surface after each specialist report instead of following a fixed plan.

### 2. Vulnerability scanners with novel detection

**2a. projectdiscovery/nuclei** — https://github.com/projectdiscovery/nuclei — **27,713 stars** (verified) — MIT
YAML-DSL template scanner. Key insight from the ecosystem docs: templates define the **exact request/response workflow to confirm a vulnerability**, simulating real exploitation — so results have **near-zero false positives**. 12,000+ community templates; 1,496 templates cover actively-exploited (KEV) vulns.
*Implementable techniques:*
- **Integrate nuclei as a Docker-sandbox tool** (JSON output) — instant KEV coverage with near-zero FP, community-maintained.
- **Verified-check pattern** — write our own custom checks in the nuclei style: every check must include a *confirmation step* (not just a signature match).

**2b. projectdiscovery/nuclei-templates** — https://github.com/projectdiscovery/nuclei-templates — **13,057 stars** (verified)
The template corpus itself. Notable: templates now use **differential checks** (baseline vs always-false predicate) and **nuclei flow (JS)** for multi-step logic — e.g. the CVE-2026-27886 Strapi template enumerates admin credentials character-by-character via differential `$startsWith` queries.
*Implementable techniques:*
- **Differential confirmation** — for any "does X exist/leak?" probe, send a true-condition and a false-condition request and compare; kills false positives from generic error pages.
- **Subscribe to template feed** — new templates = new one-day coverage within hours of disclosure.

**2c. zaproxy/zaproxy (OWASP ZAP)** — https://github.com/zaproxy/zaproxy — **~15,000 stars** (verified) — Apache 2.0
The DAST workhorse with a full REST API: spider + AJAX spider + active scanner, authenticated-scan contexts, OpenAPI/GraphQL import, scan policies per OWASP category.
*Implementable techniques:*
- **Run ZAP daemon in the sandbox, drive via its JSON API** — spider discovers the real attack surface (JS-heavy apps need the AJAX spider), active scan runs per-category policies.
- **Authenticated contexts** — record a login sequence once, then scan *behind* auth (where the high-value IDOR/BOLA bugs live).

### 3. Zero-day discovery tooling

**3a. AFLplusplus/AFLplusplus** — https://github.com/AFLplusplus/AFLplusplus — ~5k+ stars (approx) — Apache 2.0
The industry-standard coverage-guided fuzzer. Persistent mode, CmpLog, custom mutators, ASan/UBSan integration.
*Implementable techniques:*
- **Crash-triage pipeline** (the real prize, not the fuzzer itself): `afl-tmin` minimization → ASan replay → **stack-hash dedup** → exploitability rubric. Copy the *pipeline*, run it on any crash source (including web 500s).
- **Structure-aware dictionaries** — auto-build token dictionaries from the target's format/API vocabulary before fuzzing; biggest cheap coverage win.

**3b. semgrep/semgrep** — https://github.com/semgrep/semgrep — **14,794 stars** (verified) — LGPL-2.1 (engine)
Fast static analysis with **taint mode** (source→sink tracking across functions) and a YAML rule DSL (`pattern-either`, `pattern-not`, metavariables).
*Implementable techniques:*
- **Taint-lite for black-box**: pair requests/responses — inject a canary token into every input, then grep all responses/logs for the canary to map data flows without source access. (This is the black-box analog of taint tracking.)
- **Custom Semgrep rule packs per target** — when a target's stack is fingerprinted (e.g. Laravel, Express), auto-generate framework-specific taint rules; run against any exposed source (JS bundles, GitHub leaks).

**3c. AI Fuzzing Taskflow pattern** (GitHub Security Lab Taskflow Agent, via huntaegis.com analysis)
Autonomous pipeline: identify entrypoints → analyze build → **write harnesses automatically** → run AFL++ → read coverage → improve harnesses → triage crashes. Coverage-feedback loop with plateau detection (stop when gains < 1%).
*Implementable techniques:*
- **LLM-written fuzz harnesses** — the harness is the bottleneck; have the agent write `LLVMFuzzerTestOneInput`-style harnesses for parser-like code it finds.
- **Coverage-plateau stopping rule** — don't fuzz blindly; stop/redirect when marginal coverage gain drops below threshold.

### 4. Attack chaining / exploit composition

**4a. jakeloai/JLF-Exploit-Chain-Suggester** — https://github.com/jakeloai/JLF-Exploit-Chain-Suggester — small/new — GPL-3.0
CLI that takes *confirmed findings* and suggests **exploit chains**: `escalate --current sqli` shows what a finding unlocks (data-exfil, auth-bypass, RCE…); `goal --goal "data breach"` reverse-searches paths to a target impact; generates HackerOne-style report drafts.
*Implementable techniques:*
- **Finding → capability mapping**: every confirmed finding emits *capabilities* (read-file, auth-bypass, cred-leak…); a chain engine BFS-searches capability combinations toward high-impact goals.
- **Goal-driven reverse planning** — start from "RCE / data breach" and work backward to what primitives are missing, then hunt specifically for those.

**4b. awarexone/axguard** — https://github.com/awarexone/axguard — small — (license unverified, check before use)
Implements an **attack-graph engine**: composes findings into multi-hop paths `entrypoint → … → sensitive outcome`, reusing one confidence vocabulary; marks a path BLOCKED when a control sits on it.
*Implementable techniques:*
- **Attack-path rollup layer** — after the hunt, compose all findings into paths; report *paths* (with $ impact) not isolated vulns. This is what turns 3 mediums into one critical bounty.
- **Single confidence system** — don't invent a second scoring scheme for chains; reuse finding confidence.

**4c. Capability-chaining pattern** (from `mhuzaifajamil/agentic-vapt-personal-lab` skill docs)
Express every finding as **capability primitives** (read/write/exec/ssrf/sqli/cred/idor…); treat RCE as a *primitive-combination equation*; search forward/backward through the capability graph.
*Implementable techniques:*
- **Primitive equations**: e.g. `read + write = RCE` (SQLi `LOAD_FILE`→`INTO OUTFILE`), `ssrf + cloud-metadata = infra-compromise`, `xss-in-admin-panel + session = auth-RCE`. Encode ~30 such equations; the agent's job becomes "collect primitives, solve equations."

### 5. Business-logic / API security testing

**5a. microsoft/restler-fuzzer** — https://github.com/microsoft/restler-fuzzer — ~2k+ stars (approx) — MIT
*First stateful REST API fuzzer* (ICSE'19). Infers **producer-consumer dependencies** from OpenAPI (POST /resources returns `id` → GET /resources/{id} consumes it) and fuzzes *sequences*, reaching deep states single-request fuzzers never touch. Found real bugs in Azure services.
*Implementable techniques:*
- **Dependency-inferred request sequencing** — parse OpenAPI/Swagger (or infer from traffic), build a producer→consumer graph, fuzz ordered sequences. This is the #1 way to reach state-dependent business-logic bugs automatically.
- **500-class crash oracle** — any sequence producing an unhandled 500 is a finding (often the entry to deeper bugs).

**5b. schemathesis/schemathesis** — https://github.com/schemathesis/schemathesis — ~2k+ stars (approx) — MIT (verified)
Property-based API testing from OpenAPI/GraphQL via Hypothesis: generates thousands of edge-case inputs, checks response-schema conformance + 5xx detection, auto-shrinks failures to minimal curl repros. Used by Netflix, SAP, Red Hat.
*Implementable techniques:*
- **Schema-conformance oracle** — response violating its own OpenAPI schema = bug (often leaks data or reveals broken validation).
- **Auto-shrink to curl** — every finding ships with a minimal reproducer; this doubles as PoC generation.

**5c. ticarpi/jwt_tool** — https://github.com/ticarpi/jwt_tool — ~2k+ stars (approx) — (verify license before vendoring)
The JWT attack battery: `alg:none`, RS256→HS256 key confusion, key injection, `kid` manipulation, HMAC secret cracking, interactive tamper.
*Implementable techniques:*
- **Automated JWT battery as a hunt phase** — whenever a JWT is observed in traffic: decode claims → run the full attack matrix (none/confusion/crack/tamper-role-to-admin) → verify by replaying.
- **Claim-tamper verification loop** — flip `role`/`id` claims, replay, diff responses; acceptance = privilege-escalation finding.

### 6. False-positive reduction / exploit confirmation

**6a. tyrusrc/praetor (fuzz lane)** — https://github.com/tyrusrc/praetor — 7 stars (verified) — small but the *technique* is the point
Implements a **crash-triage exploitability rubric**: re-run under ASan → parse sanitizer report → classify **LIKELY-EXPLOITABLE / MEDIUM / BENIGN** → dedup by stack-hash → minimize with afl-tmin. Key line: *"it classifies whether a crash gives attacker control, it does NOT weaponize"* — confirmation without weaponization.
*Implementable techniques:*
- **Exploitability rubric for web findings too** — every finding gets a verdict: does the attacker control data, code path, or just cause an error? Only "control" findings become high severity.
- **Stack-hash-style dedup** — dedup findings by (vuln-class + sink location + trigger), not by URL, to stop 50 duplicate reports.

**6b. Differential confirmation** (from nuclei-templates CVE-2026-27886 analysis)
Baseline-vs-always-false predicate testing: to confirm a boolean oracle, query both a true and a false condition and require *divergence*.
*Implementable techniques:*
- **Mandatory differential step in every check** — no finding is "confirmed" without a control request proving the signal isn't ambient noise. This single rule eliminates most scanner false positives.

---

## TOP 5 TECHNIQUES — ranked by (impact on HIGH-SEVERITY bugs ÷ implementation effort)

| Rank | Technique | Why it wins | Effort |
|------|-----------|-------------|--------|
| **1** | **Exploit-chain graph over capability primitives** (4a/4b/4c) | Turns 3 mediums into 1 critical — this is literally how high bounties are manufactured. Pure logic layer over findings we already collect; no new infra. | Low–Medium |
| **2** | **Variant analysis + patch-gap mining** (zero-day skill pattern) | Practitioners call it the highest-yield 0day method: take a CVE patch → extract the pattern → grep the target for unpatched variants; read blacklist filters and bypass the missed encoding/alias. Needs only a CVE-feed ingester + pattern matcher. | Medium |
| **3** | **Stateful API sequencing (RESTler-lite)** (5a) | Reaches the deep stateful business-logic bugs (the expensive ones) that single-request scanners never touch. Start with OpenAPI parse + producer→consumer chaining + 500-oracle; skip full RESTler. | Medium |
| **4** | **Nuclei integration (verified-check templates)** (2a/2b) | Instant KEV/one-day coverage maintained by the community, near-zero FP by construction. It's a binary in the Docker sandbox + JSON parsing. | Low |
| **5** | **Differential confirmation on every check** (2b/6b) | The cheapest FP-killer in existence: every "confirmed" finding requires a true/false control pair. Kills the noise that gets hunters banned and buries real bugs. | Low |

**Honorable mentions (implement next):** JWT attack battery (5c) — high bounty density, low effort; taint-lite via canary pairing (3b) — maps data flows black-box; PentestGPT's Reasoning/Generation/Parsing split (1a) — cuts hallucinated findings; crash-triage exploitability rubric (6a) — severity you can defend.

## Notes / caveats
- Star counts marked "(verified)" came from today's search results; "(approx)" are best-known estimates — re-verify before citing publicly.
- Licenses: GPL-3.0 code (JLF-Exploit-Chain-Suggester) must not be vendored into a proprietary codebase — **extract the technique, don't copy the code** (which is exactly the assignment). Check axguard's and jwt_tool's licenses before any vendoring.
- The single highest-leverage architectural takeaway: the research consensus is that **zero-day capability comes from multi-agent decomposition + chaining + confirmation**, not from a bigger model — which maps directly onto the parent's "make it infinity-level" goal without requiring new model spend.