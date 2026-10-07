# Track 3 — Elite Hunter Tooling & The AI Gap

**Mission:** Map the tooling top hunters actually use daily, then brutally document where AI agents fail vs humans — with concrete software-architecture fixes for each weakness. This file directly drives Dark Matter's implementation plan.

**Research date:** 7 Oct 2026. Sources linked at the end.

---

# PART A — ELITE TOOLING

## A1. The daily-driver stack (what top hunters actually run)

Elite hunters converge on a small, sharp toolkit. The pattern from methodology repos, 2025–2026 tool roundups, and hunter roadmaps is consistent: **fewer tools, deeper understanding of each.**

### Recon (passive → active)
| Tool | Role | Why elites pick it |
|---|---|---|
| `subfinder` | Subdomain enumeration | Fast, passive sources, scriptable; the entry point of every pipeline |
| `amass` | ASN-aware enumeration | Catches what subfinder misses; active + passive |
| `httpx` | Live-host probing + tech detection | One binary: status codes, titles, tech fingerprints, JSON output |
| `dnsx` | DNS resolution at scale | Fast resolver for big subdomain lists |
| `naabu` | Port scanning | Fast SYN scanning, feeds httpx |
| `gau` / `waybackurls` | Historical URL collection | Finds forgotten endpoints, old params, backup files |
| `katana` | Web crawling | ProjectDiscovery crawler; feeds JS/endpoint mining |
| `ctfr` / crt.sh queries | Certificate transparency | Surfaces briefly-active staging/internal hosts passive DNS misses |
| `gotator` / `dnsgen` | Subdomain permutation | Active guessing against naming conventions — finds hosts in *no* passive source |
| `puredns` | High-speed resolving | With trusted resolvers, for brute-forcing |

### Fuzzing & content discovery
| Tool | Role |
|---|---|
| `ffuf` | Directory/parameter fuzzing — the workhorse |
| `feroxbuster` | Recursive content discovery |
| `Arjun` | HTTP parameter discovery |
| `x8` | Smart parameter payload generation + attacks |
| `ParamSpider` | Scrapes params from JS files, links, archives |
| `LinkFinder` | JS endpoint extraction |

### Vulnerability detection
| Tool | Role |
|---|---|
| `nuclei` | Template-based scanning — "THE vulnerability scanner"; community templates + custom ones |
| `dalfox` | Context-aware XSS scanning (better than legacy scanners for DOM XSS) |
| `sqlmap` | SQLi automation (used carefully, scope-respecting) |
| `XSStrike` | Advanced XSS detection |
| `jwt_tool` | JWT analysis and attacks |
| `gf` (+ Gf-Patterns) | Pattern grep over URL lists: `gf xss`, `gf sqli`, `gf ssrf`, `gf idor`, `gf redirect` |

### The manual core: Burp Suite Pro
Every elite methodology calls Burp Pro **non-negotiable** — the central tool where manual testing happens. Key extensions:
- **Autorize** — authorization bypass testing
- **JSParser** — find JS files, extract endpoints
- **Turbo Intruder** — high-speed request attacks
- **Collaborator Everywhere** — out-of-band interaction injection
- **Reflector** — reflection analysis
- **OAuth toolkit** — OAuth flow testing

### Cloud
`awscli`, `pacu` (AWS exploitation), `ScoutSuite` (multi-cloud audit), `cloudfox` (AWS/Azure attack-surface discovery), `cloud_enum`.

### Glue (the unglamorous force-multipliers)
`anew` (append-only-new-lines — the backbone of diff monitoring), `unfurl` (URL parsing), `qsreplace` (query-string value swapping), `jq` (JSON pipelines), `notify` (Slack/Discord/Telegram alerts from pipelines), `cewl` (target-specific wordlist generation).

**Takeaway for Dark Matter:** the engine layer must wrap these exact tools as callable primitives — not reimplement them. Elites win on *orchestration and judgment*, not on having a novel scanner.

---

## A2. The recon pipeline (how elites wire it)

The canonical pipeline, repeated across hunter write-ups with minor variations:

```
subfinder → dnsx → naabu → httpx → gowitness → ffuf → nuclei
```

A concrete published version (Bugitrix, 2026):
1. `subfinder -d $TARGET -all -recursive` + `assetfinder --subs-only` → merged, deduped subdomains
2. `dnsx` → resolved hosts
3. `naabu -top-ports 1000` → open ports
4. `httpx -status-code -title -tech-detect -follow-redirects` → live web hosts
5. `gowitness` → screenshots of everything (visual triage)
6. `ffuf` per live host (raft-large wordlist, match 200/301/302/403)
7. `nuclei -t exposures/ -t misconfiguration/ -t default-logins/ -t cves/ -severity medium,high,critical`

A more engineered Python version (SecurityElites, 2026) adds four layers:
- **Layer 1:** subfinder → SQLite dedup → only genuinely *new* subdomains returned each run
- **Layer 2:** httpx fingerprint → SHA-256 body hash → change detection on known assets
- **Layer 3:** nuclei with JSON output, parsed/filtered programmatically
- **Layer 4:** Telegram alerts, deduplicated, severity-filtered (high/critical only)
- **Rate limiting:** token bucket, 2 req/sec per domain; cron every 6 hours

Full frameworks exist for those who don't want to build it: **reconftw**, **osmedeus**, **reNgine**, **LazyRecon**, **AutoReconX**.

**Takeaway for Dark Matter:** the hunt orchestrator should implement exactly this staged pipeline with *stateful diffing* — only new/changed assets get probed each cycle. Recon output must be structured (JSONL/SQLite), never raw text blobs.

---

## A3. Continuous monitoring (the elite edge)

The highest-leverage automation insight from the research: **point-in-time scans are table stakes; continuous monitoring is the edge.**

The pattern (ReconOPS, bug-bounty-handbook):
```bash
# cron: enumerate passively, diff against ALL-TIME state, alert only on delta
subfinder -d $TARGET -silent | sort -u > subs-today.txt
new_hosts=$(anew state/subs.all < subs-today.txt)   # prints only unseen lines
# only NEW hosts get probed — re-probing known hosts is noise
```

Why it works: new subdomains on a live target = freshly deployed, often misconfigured, less hardened. Certificate-transparency monitoring catches staging environments that were briefly exposed. Multiple sources stress: **new assets are disproportionately rewarding.**

Design rules from practitioners:
- State file must outlive any single run and be separate from run output
- Probe only the delta, never the full set
- Passive sources only for the monitor loop (zero target touch)
- Alert on: new subdomains, changed response bodies (hash diff), new open ports, new technologies

**Takeaway for Dark Matter:** hunts should be *resumable and continuous*, not one-shot. A "monitor mode" per target with all-time state is a first-class feature, not an afterthought.

---

## A4. Nuclei template craft (where elites write their own ammo)

Community templates catch known patterns. Elites write **custom templates** — one hunter calls it "one of the highest-leverage skills you can build." The craft is entirely in the matcher.

### Template anatomy (minimum viable)
```yaml
id: acme-widget-config-disclosure
info:
  name: ACME Widget <2.3 — Unauthenticated Config Disclosure
  severity: high
http:
  - method: GET
    path: ["{{BaseURL}}/api/config"]
    matchers-condition: and
    matchers:
      - type: word
        part: body
        words: ['"admin_token"', '"acme_widget"']  # SECOND anchor — can't fire on any JSON
        condition: and
      - type: status
        status: [200]
    extractors:
      - type: regex
        part: body
        regex: ['"admin_token"\s*:\s*"([a-f0-9]{32})"']
```

### Matcher discipline (from agent-skill guides and the official creation guide)
1. **Narrowest reliable signal:** prefer `matchers-condition: and` combining status + body/header evidence
2. **Two independent anchors:** a single string match fires on unrelated pages; two anchors make false positives structurally unlikely
3. **Explicit `part:`** (`body`, `header`, `all`) — never rely on defaults when precision matters
4. **Negative matchers** to exclude known false-positive pages
5. **DSL matchers** for cross-field logic: `status_code == 200 && contains(body, "x")`
6. **Dynamic extractors** (`internal: true`) to chain requests — extract CSRF tokens, feed into subsequent raw requests via `{{csrf_token}}`
7. **Global matchers** (`-egm`) for cross-template secret detection (e.g., API key regexes over all responses)
8. **`unsafe: true` rawhttp** for malformed-request classes (request smuggling, host-header injection, CRLF)

### The forge workflow
1. **Source** — a CVE advisory + PoC, a disclosed report, or your own validated manual finding. Feed the *real text*, never memory.
2. **Extract** — the trigger request and the response feature that *proves* vulnerability.
3. **Draft** — AI can write the YAML; add the second anchor; tag `cve,<year>,<product>,<class>`.
4. **Validate (non-negotiable)** — must fire GREEN on a vulnerable instance and stay SILENT on a clean one.
5. **Curate** — dedup against the corpus, record provenance, drop into the private template dir.

**Key operational insight** (from an agent-oriented nuclei skill): *nuclei belongs in recon/monitoring, not discovery* — keep the engine, swap the ammunition for your own. Spraying default templates at mature targets yields dups and N/A.

**Takeaway for Dark Matter:** implement a template forge — CVE advisory in → validated template out — plus a private template corpus with provenance tracking. Every validated manual finding should be convertible into a template automatically.

---

## A5. Wordlists & payloads (the canon + the custom edge)

### The canon (install day one)
| Collection | What it is |
|---|---|
| **SecLists** | The de-facto reference: web discovery, DNS, passwords, usernames, fuzzing payloads |
| **PayloadsAllTheThings** | The authoritative payload + bypass library for every vuln class |
| **Assetnote wordlists** | `httparchive_*`, `apiroutes`, `swagger` — generated from real web traffic, kept fresh |
| **OneListForAll** | Merged "rockyou for web fuzzing" superlist |
| **jhaddix `all.txt`** | Classic large directory/file list — still finds forgotten admin pages and backups |
| **FuzzDB** | Attack patterns and known files |
| **kiterunner `.kite` routes** | API route fuzzing |
| **n0kovo_subdomains** | 3M subdomains from SSL CT logs |

### The elite edge: target-specific generation
Generic lists are the floor. Elites build per-target lists:
- **`cewl`** — crawl the target site, generate a wordlist from its own vocabulary
- **`cook`** — combine known prefixes/suffixes/patterns into permutations
- **`CWFF`** — generates a custom wordlist per target from its own pages
- **`fuzzuli`** — dynamic backup-file wordlist from a domain
- **Manual mining** — extract terms from JS files, historical URLs (gau/wayback), response bodies, about pages, docs; dedupe with `anew`; feed back into ffuf
- **Stack-tailored extensions** — PHP→`.php .phtml`, ASP→`.aspx .asmx`, backup hunting→`.bak .old .zip .sql .env .git`

Suggested layout (`$HOME/wordlists/`): SecLists, OneListForAll, fuzz4bounty, PayloadsAllTheThings, plus a per-target generated directory.

**Takeaway for Dark Matter:** ship the canon pre-bundled, but the differentiator is *automatic target-specific wordlist generation* — mine JS + historical URLs + response bodies during recon, dedupe, and feed the fuzzer without human intervention.

---

# PART B — THE AI GAP (brutally honest)

## B1. State of AI in bug bounty, 2024–2026

### What has actually worked
- **XBOW (commercial leader):** first autonomous system to reach **#1 on HackerOne's US leaderboard (June 2025)** — 1,060+ vulnerabilities in 90 days, 1,400+ total zero-days, 80x faster than manual teams, **0% false positives on reported findings**, matched a 40-hour manual pentest in ~28 minutes. Architecture: multi-agent system with *validator agents* (automated peer reviewers); all findings human-reviewed before submission. Caveat: currently excels at *known-pattern* vulns (SQLi, XSS); business-logic chaining is the stated frontier.
- **Big Sleep (Google DeepMind + Project Zero):** found a SQLite stack-buffer underflow that Google's own OSS-Fuzz had missed; later isolated CVE-2025-6965 (CVSS 7.2) from partial attacker signals — described as the first time an AI agent directly interrupted an attacker's exploitation plans.
- **ATLANTIS (DARPA AI Cyber Challenge winner, $4M, Aug 2025):** hybrid LLM + symbolic execution + directed fuzzing; 86% synthetic vulns detected, 18 real-world zero-days.
- **Benchmarks:** CVE-Bench — SOTA agents exploit 10–13% of real web CVEs zero-day, up to 25% one-day; CVE-Genie 51% exploit-generation success; Cybench — Claude Sonnet 4.5 at 76.5% (CTF tasks, doubling roughly every 6 months per Anthropic's retrospective); CyberGym — 5% single-try new-vuln discovery, 33% given 30 attempts (~$45).

### The backlash (the part vendors don't advertise)
- **Google paused its open-source VRP (Oct 2026)** after a surge of AI-generated reports, most invalid. Curl's maintainer called AI submissions "slop" and said not one valid AI-assisted report had been seen.
- **The bottleneck moved from discovery to validation.** AI made candidate vulnerabilities cheap to generate; reproduction, impact demonstration, and exploit-path proof remain expensive. Triagers now spend their time *disproving* machine claims instead of validating real issues.
- A top-30 YesWeHack hunter (Apr 2026): Claude found 10 bugs overnight — half were duplicates, the rest sat weeks in an unmanageable triage queue. Verdict: **"AI is a multiplier, not a replacement."**

### Net assessment
AI has conquered the *pattern layer* (known vuln classes at scale, 80x faster). It has not conquered the *judgment layer* (what's real, what chains, what matters, what's novel). Programs are adapting: stronger evidence requirements, AI-specific VRP tracks, and rebalanced payouts.

---

## B2. Where AI agents fail vs human hunters (failure taxonomy)

### The measured failures (50 real-world engagements, 2024–2025 — Mastermind analysis)
| Failure mode | Share | Symptom | Root cause |
|---|---|---|---|
| **Context Amnesia** | 38% | Agent repeats recon every session restart | No persistent hunt state; context window limits |
| **False-Positive Flooding** | 31% | Every reflected payload reported as "XSS found" | Detection treated as exploitation; no impact validation |
| **Premature Defensive Surrender** | 21% | "WAF blocked me" → aborts after 1–2 attempts | No surrender-pattern detection; no bypass injection |
| **Tool Integration Errors** | 7% | Misconfigured/failed tool calls | Brittle orchestration |

### The structural blind spots (what AI *cannot* see by construction)
From Bugitrix's 2026 analysis — these are architectural, not prompt-engineering problems:

1. **Business-logic flaws (blind spot #1).** The code works exactly as written; the *intent* was wrong. Coupon applied twice via API call reordering; subscription downgrade→refund→re-upgrade; shared token pools across "forgot password" flows; referral webhooks firing before payment settles. No signature exists to match — the bug is visible only when you understand what the app is *supposed* to do.
2. **Multi-step chained exploits.** Real 2026 findings are 3–4 lows chained into a critical (IDOR user-ID leak + reset rate-limit gap + predictable tokens = account takeover). AI evaluates findings in isolation; chaining needs the whole app's mental model held across sessions and days.
3. **Novel attack surfaces.** New frameworks, AI-agent tool patterns, new auth schemes ship constantly with zero training data. Models trained on history are definitionally behind on anything genuinely new. Hunters who read changelogs and test beta features first win here.
4. **Human trust and context.** Process vulnerabilities, support-agent behavior, escalation paths — the target as a *system of people*, not code.
5. **Impact framing.** Two hunters, same bug, wildly different payouts — the winner wrote a business-impact narrative (specific revenue stream, specific PII), not "an attacker could access sensitive data."

### The data→insight gap
Automation genuinely accelerates asset discovery, fingerprinting, and scope mapping. It fails at the transition from data to insight: a 500-subdomain list is raw material, not intelligence. The documented example — a subdomain with an anomalous naming convention (legacy staging, never decommissioned) sharing production auth cookies with different access-control rules — was found because a human *noticed what the automation didn't know to look for.*

### The surrender problem, precisely
Agents treat a blocked request as a verdict rather than a data point. Humans treat it as the *start* of bypass work (encoding variations, method tampering, header smuggling, timing). The 21% figure represents bounties literally left on the table.

---

## B3. What it would take to match a top-100 hunter

Synthesizing the research, an AI system needs these capabilities — each is a *software architecture* requirement, not a bigger model:

1. **Persistent, structured hunt state** — survive restarts, resume mid-chain, never re-do recon. (Fixes 38% of failures.)
2. **Impact-gated triage** — no finding advances without demonstrated security impact; confidence scoring calibrated on historical acceptance data (≥0.70 ≈ 84% acceptance, ≥0.90 ≈ 96%).
3. **Anti-surrender engine** — detect capitulation patterns, inject bypass strategies automatically, track bypass attempts per control.
4. **Application-model builder** — construct the app's intended state machine (user flows, roles, object lifecycles); test *invariants*, not just inputs. This is the business-logic attack surface.
5. **Chain planner** — every finding becomes a graph node; the planner continuously asks "what else does this unlock?" and pursues multi-step paths.
6. **Novelty watcher** — changelog/beta monitoring, new-tech heuristic packs, first-mover testing on fresh features.
7. **Evidence-first pipeline** — PoC is not a report attachment; it's the *gate*. No reproducible evidence → no finding. (This is also what programs now demand post-Google-pause.)
8. **Validator agents** — XBOW's proven pattern: independent agents peer-review findings before they reach humans. Zero-FP on reported findings is achievable *with* this loop.
9. **Human-in-the-loop where it matters** — novel techniques, ambiguous vulns, final validation, disclosure decisions. The research consensus: human-led, AI-powered — not fully autonomous.

The honest timeline signal: frontier cyber capabilities are roughly doubling every 6 months. Whatever we build must be architected for *capability upgrades*, not frozen around today's model limits.

---

## B4. Human + AI: the winning combination (documented cases)

- **$500K Google VRP pipeline (2026):** an AI-assisted pipeline scanning Google APIs found a complete lack of access controls on a Voice/Fiber management API — unauthenticated PII retrieval and phone-number assignment via a single curl. Google rated it P0/S0, patched in hours, $20K for that one finding; $500K total in under 90 days. *Pattern: AI at scale on access-control testing + human judgment on what to pursue.*
- **$670 Burp AI IDOR (2026):** hunter mapped the app manually, then asked Burp AI to analyze proxy traffic; AI flagged an authorization concern on `/api/orders/{id}` — the human investigated and confirmed IDOR. *Pattern: human does the mapping, AI does the tireless review.*
- **Claude overnight (2026):** 10 bugs found, half duplicates, triage queue choked. *Pattern: AI needs dedup + validation gates or it manufactures triage debt.*
- **XBOW's operating model:** fully autonomous discovery, *human-reviewed submission*. The autonomy is in the hunting; the judgment is in the reporting.

**The division of labor the evidence supports:**
- **AI handles:** recon at scale, pattern matching, payload generation, duplicate detection, initial code analysis, reproduction attempts, evidence checking, report drafting, 24/7 monitoring.
- **Humans handle:** target selection, business-logic reasoning, exploit chaining, novel techniques, ambiguous findings, impact narratives, final validation, disclosure decisions.

**For Dark Matter (autonomous product):** where no human is in the loop, the *validator agents + impact gates* must substitute for human judgment — and the system must be honest about confidence, never submitting below the evidence bar.

---

## B5. Architecture fixes for Dark Matter (per weakness)

Each row: observed AI weakness → root cause → the software architecture that fixes it → Dark Matter component to build/extend.

| # | Weakness | Root cause | Architecture fix | Dark Matter component |
|---|---|---|---|---|
| 1 | Context Amnesia (38% of failures) | No persistent hunt state; context windows reset | 3-layer memory: working → summary → long-term; `ledger.json` (hunt metadata) + `worklog.jsonl` (append-only event stream) + `handoff.md` (session resume); state hydration on every session start | **Hunt State Store** — replace destructive 200-message truncation with preserved history + summaries + indexes; crash-safe resume |
| 2 | False-Positive Flooding (31%) | Detection ≠ exploitation; no validation | 5-check triage gate: target present → vuln class identified → detection evidence → **impact demonstrated (hard gate)** → confidence ≥ 0.70; validator agents peer-review before report | **Triage Gate service** — every finding must carry reproducible evidence; confidence scorer calibrated on acceptance data |
| 3 | Premature Defensive Surrender (21%) | Capitulation after 1–2 blocks; no bypass logic | Retry detector with surrender-pattern matching; bypass strategy injector (encoding, method tampering, header smuggling, timing); per-control attempt ledger | **Anti-Surrender Engine** — WAF/ban fingerprinting + bypass playbook library + attempt tracking |
| 4 | No chaining (structural) | Findings evaluated in isolation | Finding graph: each validated low becomes a node; chain planner runs "what else does this unlock?" continuously; multi-session chain memory | **Chain Planner** — graph of findings × capabilities; automated chain hypothesis generation and testing |
| 5 | Business-logic blindness (blind spot #1) | No model of intended behavior | App-model builder: extract user flows, roles, object lifecycles from crawling + API observation; invariant checker; out-of-order API call testing; state-transition fuzzing | **Logic Modeler** — state-machine extraction + invariant violation detector (the highest-value module) |
| 6 | Novelty lag | Training data is historical by definition | Changelog/beta watcher; new-framework heuristic packs; tech-stack fingerprint → fresh-attack-surface prioritization | **Novelty Watcher** — monitor target changelogs + fingerprint new tech for first-mover testing |
| 7 | Weak impact framing | Generic "attacker could..." narratives | Impact calculator: map finding → specific data/revenue at risk; business-narrative report templates; per-program payout history awareness | **Report Engine** — evidence-backed, business-impact reports (already partially built; harden the impact section) |
| 8 | Validation bottleneck (post-Google-pause reality) | Cheap generation, expensive verification | PoC-first pipeline: no finding exists without a reproducible PoC artifact; automated re-verification before submission; dedup against all prior reports | **PoC Pipeline** — PoC is the gate, not the attachment; re-run verification service |
| 9 | Data→insight gap | 500 subdomains, zero understanding | Anomaly ranker: flag naming-convention outliers, tech-stack outliers, recently-changed assets, auth-cookie-sharing across hosts; present *ranked hypotheses*, not raw lists | **Insight Ranker** — anomaly detection over recon data feeding the planner |
| 10 | One-shot hunts | No continuity; monitor mode missing | Resumable hunts + per-target monitor mode: all-time state, delta-only probing, change alerts | **Monitor Mode** — continuous per-target state (ties to #1) |

### Priority order for implementation (impact × feasibility)
1. **Triage Gate + PoC-first pipeline** (#2, #8) — kills the FP problem; required for program trust post-2026.
2. **Hunt State Store** (#1) — unlocks everything else; 38% failure share.
3. **Anti-Surrender Engine** (#3) — recovers the 21% left on the table.
4. **Chain Planner** (#4) — turns lows into criticals; the elite differentiator.
5. **Insight Ranker** (#9) — makes recon data actionable.
6. **Logic Modeler** (#5) — highest bounty value, hardest to build; start with invariant templates per app type.
7. **Monitor Mode** (#10) — the elite edge; builds on #1.
8. **Novelty Watcher** (#6), **Report Engine hardening** (#7) — continuous improvements.

---

## Sources

### Part A — Tooling
- ardakocadoru/bug-bounty-methodology (GitHub) — elite tool stack + reporting structure — https://github.com/ardakocadoru/bug-bounty-methodology
- expl0itlab/ReconOPS (GitHub) — pipeline architecture, gf patterns, monitoring, wordlist engineering — https://github.com/expl0itlab/ReconOPS
- mirshad0w/bug-bounty-handbook, workbook 30-automation (GitHub) — monitor-vs-pipeline design — https://github.com/mirshad0w/bug-bounty-handbook/blob/HEAD/workbook/en/30-automation.md
- SecurityElites — Bug Bounty Automation Python 2026 (4-layer pipeline, costs, policy) — https://securityelites.com/bug-bounty-automation-python-stack/
- Bugitrix — recon toolchain 2026 (full recon.sh) — https://medium.com/@bugitrix/i-automated-my-bug-bounty-recon-stack-heres-the-exact-toolchain-2026-fb8df3b6c0ea
- R.H. Rizvi — automating recon 2026 (CT monitoring, permutation, continuous monitoring) — https://medium.com/@R.H_Rizvi/everyone-is-automating-bug-bounty-recon-in-2026-almost-nobody-is-automating-the-right-things-feafb1b500f2
- projectdiscovery/nuclei-templates TEMPLATE-CREATION-GUIDE.md — https://github.com/projectdiscovery/nuclei-templates/blob/HEAD/TEMPLATE-CREATION-GUIDE.md
- santosomar/ethical-hacking-agent-skills, pt-nuclei-template-creation — https://github.com/santosomar/ethical-hacking-agent-skills/blob/HEAD/skills/pt-nuclei-template-creation/SKILL.md
- w1nt3rday/claude-bughunter, nuclei-template-forge — https://github.com/w1nt3rday/claude-bughunter/blob/HEAD/skills/nuclei-template-forge/SKILL.md
- gbk99700-oss/bug-bounty-checklist, wordlists reference — https://github.com/gbk99700-oss/bug-bounty-checklist/blob/HEAD/99-reference/02-wordlists.md
- awarexone/agentic-bug-hunter, wordlists REFERENCES — https://github.com/awarexone/agentic-bug-hunter/blob/HEAD/wordlists/REFERENCES.md

### Part B — AI gap
- r00t-kim/terminator research, llm_bug_bounty_sota_2024_2026.md — XBOW/ATLANTIS/RoboDuck systems + sources — https://github.com/r00t-kim/terminator/blob/HEAD/research/llm_bug_bounty_sota_2024_2026.md
- XBOW #1 HackerOne US (SparTech summary) — https://www.spartechsoftware.com/cybersecurity-news/xbow-achieves-a-groundbreaking-milestone-as-the-first-ai-system-to-surpass-human-hackers-in-the-hackerone-competition/
- Pouria Navidkia — AI takeover timeline 2025–2026 (Big Sleep, CVE-2025-6965, XBOW) — https://medium.com/@babolilpoip/how-ai-quietly-took-over-vulnerability-hunting-in-2025-2026-051818418d13
- Dark Reading — XBOW Black Hat session, "zero false positives," AI slop problem — https://Www.Darkreading.com/vulnerabilities-threats/ai-based-pen-tester-top-bug-hunter-hackerone
- hellodqy/mastermind-bug-bounty DEEP_DIVE.md — failure taxonomy, 6-hook lifecycle, triage gate, confidence scoring — https://github.com/hellodqy/mastermind-bug-bounty/blob/HEAD/article/DEEP_DIVE.md
- Bugitrix — The Bugs AI Still Can't Find (5 structural blind spots) — https://medium.com/@bugitrix/the-bugs-ai-still-cant-find-what-will-make-you-a-valuable-bug-hunter-in-2026-902e37a199a6
- R.H. Rizvi — Everyone Is Using AI for Bug Bounty in 2026 (data→insight gap) — https://medium.com/@R.H_Rizvi/everyone-is-using-ai-for-bug-bounty-in-2026-almost-nobody-is-using-it-correctly-fe7e3356010e
- UndercodeNews — Google pauses OSS VRP over AI report flood (Oct 2026) — https://undercodenews.com/google-pauses-open-source-bug-bounty-program-as-ai-floods-security-teams-with-fake-vulnerabilities-video/
- BitcoinVersus — Google pause analysis (validation bottleneck) — https://bitcoinversus.tech/2026/10/04/computer-security-google-pauses-open-source-bug-bounty-ai-report-flood/
- SecurityWeek — Will AI Kill Bug Bounty (Khouani, multiplier-not-replacement) — https://www.securityweek.com/will-ai-kill-the-bug-bounty-industry/
- CyberSecurityNews — $500K Google VRP AI-assisted pipeline — https://cybersecuritynews.com/google-infrastructure-hacked-ai/
- Cybervolt — $670 Burp AI IDOR story — https://medium.com/@cybervolt/how-i-won-a-670-bug-bounty-using-burp-ai-from-recon-to-responsible-disclosure-1985546adc39
- CVE-Bench (arXiv 2503.17332) — agent exploit benchmarks — https://arxiv.org/abs/2503.17332v4
- EmergentMind — CVE-Bench results synthesis — https://www.emergentmind.com/topics/cve-bench
- Pradhyuman Pandey — LLM cyber paradigm shift (Cybench/CyberGym numbers) — https://medium.com/@pradhyuman-pandey/how-the-cybersecurity-paradigm-is-being-changed-by-llms-cybersec-ai-applications-f6cce8c6ada0

---

*End of Track 3. Next: parent synthesizes Tracks 1–4 → gap analysis → implementation plan.*
