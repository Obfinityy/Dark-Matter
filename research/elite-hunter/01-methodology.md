# Track 1: Elite Bug Bounty Hunter Methodology & Mindset

**Research date:** 2026-10-07/08
**Purpose:** Distill how top-earning hunters (HackerOne/Bugcrowd/Intigriti top 100) think and work, so Dark Matter's agent can replicate their behaviors in software.
**Method:** Synthesized from disclosed methodology repos, top-hunter writeups, 2025–2026 industry reports (HackerOne 8th Annual Report, YesWeHack 2025), and practitioner guides. All ideas attributed to their sources; this document is original synthesis, not reproduction.

---

## 1. The Core Differentiator: Understanding Over Tooling

The single most repeated claim across elite sources is blunt: **average hunters run tools; elite hunters build mental models of the application's internals.** One practitioner guide frames it as asking "why does this work the way it does?" rather than "what does this endpoint do?" — i.e., reconstructing the *developer's* decision, not just enumerating surface.

**What "understanding" concretely means (the elite checklist):**
- Know the app's core business model (what makes it money / what data it guards)
- Use the app as a real user for 15+ minutes before testing anything
- Know the tech stack: language, framework, auth system, caching layer
- Read at least 3 disclosed reports for the same program
- Have 2 test accounts ready (attacker + victim) from minute zero
- Define ONE crown jewel per session (see §2)

**AI replication:** Dark Matter should, before any request is sent, build an explicit target model: business type → crown-jewel candidate → tech stack → auth model → roles. This model should be stored and consulted before every test ("does this test serve the crown-jewel goal?"). The "use as a real user for 15 minutes" step maps to an automated onboarding crawl: register accounts, walk core flows, record request sequences as baseline behavior.

---

## 2. The Pre-Hunt Mental Framework

Four questions elite hunters ask before touching a target (distilled from top-1% methodology notes):

### 2.1 Crown Jewel Thinking
"If I were the attacker and could do ONE thing to this app, what causes the most damage?" — then work backward from that goal. Examples: financial app → drain funds; SaaS → tenant data crossing; auth provider → full SSO chain compromise; healthcare → PII leak.

**AI replication:** Per-hunt goal selection. Instead of "find any bug," the agent picks one of 5 ultimate goals per session: confidentiality, integrity, availability (app-level), account takeover, or RCE. All subsequent decisions (which feature to probe, which chain to build) are scored against this goal.

### 2.2 Developer Empathy
Think like the tired developer who built the feature: What was the simplest implementation? What shortcut would someone take at 2am? Where is auth checked — controller, middleware, or DB layer? What happens when you call endpoint B without going through endpoint A first?

**AI replication:** Generate "shortcut hypotheses" automatically: for each endpoint, ask the reasoning brain — "what's the laziest correct-looking implementation of this?" and test the gap between that and the observed behavior. Missing-auth-on-one-of-ten-endpoints (authorization inconsistency) is the single most productive pattern this thinking produces.

### 2.3 Trust Boundary Mapping
Map where the app *stops trusting input* vs where it *assumes input is already validated*: Client → CDN → LB → App → DB. The bugs live at the boundary where a downstream layer trusts an upstream one.

**AI replication:** The agent should maintain an explicit trust map per target and prioritize tests at boundary seams (e.g., mobile API vs web API hitting the same backend with different validation; CDN-cached responses served with user-specific data → cache poisoning/deception).

### 2.4 Feature Interaction Thinking
"Does this new feature reuse old auth, or does it have its own? Does the mobile API share auth logic with the web app? Was this built by the same team or a third party?" New features interacting with legacy code is the #1 structural bug source named by Google VRP-oriented hunters.

**AI replication:** Version/feature diffing as a first-class capability: compare mobile vs web API behavior on identical operations, free-tier vs paid-tier responses, old API docs vs new. Diffs find bugs.

---

## 3. Session Discipline: The Anti-Wandering System

Elites treat wandering as the enemy. The discipline pattern, repeated across sources:

- **Define → Select → Execute:** Before touching any tool, state "Today I target [feature/domain] to achieve [goal]." Pick 1–2 vuln classes only. No wandering.
- **One bug class at a time, go deep.** Hunters who try to learn XSS, SQLi, SSRF, IDOR simultaneously become mediocre at all of them.
- **Time-box rules:** 5-minute rule (nothing after 5 min of 401/403/404 probing → move on); 20-minute rule per endpoint; 1-hour rule (stuck an hour with no progress → switch context).
- **Breadth-before-depth in early phases:** Confirm primitives, park hypotheses, keep moving; escalation/chaining is a later, separate phase. (Noted in the sane_android doctrine: "a primitive is not a finding.")
- **Hunting journal:** Document *everything*, including failed tests. Failed tests are not wasted — they map application behavior. Weeks later, old notes become the source of new finds.

**AI replication:** Dark Matter already has per-hunt phases; add: (a) explicit per-session goal + vuln-class selection at hunt start; (b) per-endpoint time budgets with automatic rotation; (c) a hypothesis journal (parked primitives with evidence) that persists across hunts and is re-consulted when new signals appear; (d) "no wandering" enforcement — every request batch must cite the hypothesis it serves.

---

## 4. Target Selection: Where the Money Is

Elite program-selection criteria, consistently reported:

**Choose:**
- Recently launched or updated programs/scopes (less picked over; new features = lowest security maturity — "New == unreviewed")
- Large scope (wildcard domains) with complex business logic (fintech, healthcare, SaaS)
- Fast triage response (< 2 weeks) and fair payouts; P3/P4 minimums actually paid
- Private / less-hyped programs over crowded ones (avoid 1000+ hunter programs)
- Emerging areas with few specialists: CI/CD, ML/AI, mobile, OAuth/OIDC chains

**Avoid:**
- Months-long response times; points-only programs; narrow scope; programs that mark valid reports informational
- Anything that's been in scope since program launch (the main login page has been tested by thousands)

**The Goldilocks observation:** too small = no surface; too big = everything duplicated 47 times; "just right" ≈ 50–200 hunters, decent scope, active program.

**AI replication:** Dark Matter takes a user-supplied target, so program selection is the *user's* job — but the agent should assess target richness at hunt start and advise: scope breadth, estimated competition (based on program age/public reports), and a recommended depth strategy. Also: prioritize *new scope additions* and recently changed features first.

---

## 5. Recon: The 60–80% Phase

Elite consensus: recon is where bounties are won or lost. Practitioners report spending 60–70% of hunt time in recon. The bugs that pay are "almost never on www.target.com" — they're on the forgotten subdomain, the accidentally exposed internal tool, the staging environment with debug mode on.

### 5.1 The canonical recon pipeline (passive → active)

1. **Subdomain enumeration:** subfinder + amass (passive) + assetfinder, merged and deduped. Certificate transparency (crt.sh) and DNS aggregation from multiple public sources beat any single tool.
2. **Live-host probing + tech fingerprinting:** httpx (status, title, tech, IP), whatweb/Wappalyzer. Screenshot review of live hosts.
3. **ASN/IP range discovery:** find assets *outside the CDN* — origin IPs, acquisitions' infrastructure.
4. **Content discovery:** ffuf/feroxbuster on each host; vhost fuzzing; check /api, /v1, /graphql, /actuator, /.git, /swagger, /debug.
5. **JavaScript analysis** (see §5.2 — the highest-ROI recon step for web targets).
6. **Wayback/archive mining:** waybackurls + gau — historical URLs reveal old API versions, forgotten admin paths, and parameters that still work. Bucket archived URLs by likely vuln type with gf patterns.
7. **Parameter discovery:** arjun / ParamMiner / paramspider on live hosts; params from JS + wayback.
8. **Port scanning:** masscan/naabu on resolved IPs — non-standard ports host admin panels, debug services, internal APIs (:8080/actuator, :9200 Elasticsearch, :6379 Redis).
9. **Subdomain takeover check:** subzy/subjack across all subs.
10. **Prioritized attack-surface map** — then, only then, start testing.

### 5.2 JavaScript recon: the highest-ROI step

Workflow, repeated nearly identically across a dozen sources:
- Collect JS: `gau | grep .js`, `waybackurls | grep .js`, katana crawl with `-jc`, plus robots.txt and page source.
- **LinkFinder** → endpoints/paths hidden in bundles (API routes, GraphQL, admin paths).
- **SecretFinder / trufflehog / gf apikeys** → hardcoded API keys, tokens, client secrets in bundles.
- Fetch `sourceMappingURL` → recover original source from .map files.
- For Next.js/Vue SPAs: extract framework config (env vars, RPC URLs, auth flow reconstruction) from webpack chunks.
- Manual grep for high-value params: `url=, next=, redirect=, file=, path=, id=, callback=, domain=, dest=, html=`.

**AI replication:** This is almost fully automatable and should be a standard Dark Matter recon stage: JS bundle download → endpoint extraction → secret scan → endpoint inventory with method/param annotations → feed into the attack-surface map. Flag any secret found, then *prove what it accesses* (keys alone are not findings).

### 5.3 GitHub / OSINT dorking

- GitHub code search: `"target.com" in:code`, `org:TargetOrg password|api_key|.env|"BEGIN RSA PRIVATE KEY"`; time-bounded (`pushed:>2025-01-01`) for fresh leaks; GitDorker automation.
- Google dorks: `site:target.com ext:env|sql|bak|log`, `inurl:admin|api|graphql|debug|staging`, `intitle:"index of"`.
- Shodan/Censys: `hostname:target.com`, `org:"Target Inc"` — exposed services tied to org ASN.
- npm/PyPI: internal-looking packages accidentally published.

**AI replication:** OSINT stage with dork templates parameterized by target; results feed the same attack-surface map. Treat leaked credentials as *primitives* (see §6), not findings.

### 5.4 The prioritization decision (what to attack first)

Highest priority: forgotten subdomains on old software with known CVEs; internal tools exposed publicly (Jenkins, Grafana, Kibana); unauthenticated APIs on non-standard ports; high-entropy params that look like object references (IDOR surface); any endpoint accepting a URL (SSRF surface); auth endpoints on acquisition infrastructure.

Lower priority: main app login pages, standard contact forms, anything in scope since day one.

**AI replication:** Score every discovered asset/endpoint on: novelty (how long in scope / how obscure), auth exposure, input dangerousness (URL params, IDs, file paths), and business proximity to the crown jewel. Attack in score order.

---

## 6. Finding What Others Miss: Chaining & Business Logic

### 6.1 The A→B→C chain methodology

The most consistently cited elite technique: **when you find bug A, systematically hunt for B and C nearby.** Single bugs pay; chains pay 3–10x more. Report one chain per report, not one bug per report.

The "primitive translation" habit: never dismiss a low-severity finding — translate it into what it *grants*:
- Info disclosure (.git, stack trace) → `read` primitive on source/config
- SSRF, even GET-only → internal surface + cloud metadata (169.254.169.254) → IAM creds
- Open redirect → OAuth redirect_uri abuse → auth code theft → ATO
- CORS reflecting origin → test with credentials → credentialed data theft
- Rate-limit bypass → OTP brute force → ATO
- Host header injection → password reset poisoning → ATO
- Self-XSS + CSRF on profile mutation → stored XSS in victim session → ATO
- Debug endpoint → env vars → cloud credentials → infrastructure access

Real-world shape (widely cited): JS bundle in a listable S3 bucket → OAuth client secret → missing PKCE → full auth-code interception chain. Or: info disclosure in JS → internal API endpoint → IDOR → password reset tokens → ATO → SSRF via webhook config → cloud metadata → credentials.

**AI replication:** This is Dark Matter's core differentiator to build: a **chain engine**. Every confirmed primitive enters a graph; the agent systematically asks "what does this primitive unlock?" and tests the edges (sibling endpoints, same-module controllers, downstream consumers). The hunt should not end at first finding — it should *expand* from it. "Could be used in a chain if…" is banned as a report; the chain must be built first, then reported as one.

### 6.2 Business logic hunting

The $1,000+ reports live in business logic: payment flows, privilege escalation between roles, race conditions (coupon redemption, balances), workflow bypasses. These require understanding the product, not running tools. The uncomfortable truth from top earners: you won't have a finding to show for your first week on a serious target — that "nothing to show yet" phase *is* the work.

Concrete business-logic test patterns: price/quantity/coupon manipulation; double-booking and reuse; state-machine skipping (call endpoint B without A); role confusion (act as role X on role-Y-only flows); mass assignment on profile-update APIs; second-order flows (URL saved now, fetched by a cron job later — second-order SSRF; stored-clean input rendered unsafely in an admin panel — second-order XSS).

**AI replication:** Business-logic tests need stateful multi-step scenarios with two accounts (attacker + victim) — Dark Matter should script these as first-class "logic scenarios" (purchase flow, refund flow, invite flow, role-change flow), mutating one variable at a time and diffing outcomes.

### 6.3 Second-order & differential techniques

- **Second-order:** input stored safely, executed unsafely elsewhere/later. Always ask "where does this data *go*?" not just "what happens now?"
- **Differential testing:** compare old API docs vs new; mobile API vs web API; free-user requests vs paid-user responses. Diffs find bugs.
- **Mobile API asymmetry:** mobile apps often call older/different API versions — same company, different attack surface, lower maturity.
- **Error-first probing:** try error-based payloads first (`'`, `"`, `{{7*7}}`), watch for 500s/stack traces; then time-based; then OOB (interactsh); then boolean. In that order.

---

## 7. Time & Energy Management

- **Depth beats breadth, every time.** Switching programs feels productive; it isn't. Every new app forces rebuilding understanding from scratch. Commit to one target for weeks, not hours.
- **The "breadth-first trap":** optimizing for the *feeling* of trying many things vs actually understanding one thing deeply.
- **Systems over motivation:** track hours and findings (even failures); set a floor not a ceiling ("90 focused minutes today," not "find a bug today"); rotate deep-dives with light recon so dry spells don't kill momentum. Three focused hours/day for six months beats sporadic 12-hour binges.
- **Kill weak findings fast:** run an impact gate *before* writing any report. "Could theoretically allow…" = not a bug. "An attacker with X, Y, Z conditions could…" = too many preconditions. Dead code = not reachable = not a bug. **Demonstrate actual harm or drop it.**
- **Impact-first hunting:** ask "what's the worst thing if auth was broken here?" If nothing valuable, skip the target.

**AI replication:** Hunt-level telemetry (time per feature, findings per hour, hypothesis kill-rate) with automatic strategy adjustment: if yield-per-hour drops below threshold on a feature, rotate. Maintain a global "technique yield" memory across hunts so the agent learns which techniques pay on which target types.

---

## 8. Game-Changing Writeups (techniques that shifted the field)

1. **Frans Rosén — OAuth "Dirty Dancing" (Detectify Labs, 2022; PortSwigger Top 10 Web Hacks #1):** response-type switching + lax postMessage origin checks → OAuth code/token leakage with *no XSS required*. Multi-vendor (Apple, Microsoft, Slack). Lesson: test the *non-happy paths* of auth protocols, not just the documented flow.
2. **S3 subdomain takeover research (Rosén):** hostile takeover via dangling DNS (Heroku/GitHub/S3) — created the entire takeover-check industry (subjack/subzy/nuclei templates).
3. **Salt Labs — "Pass-the-Token" (2023):** missing `aud` validation on social-login tokens → cross-client token replay → ~1B account exposure across Grammarly/Vidio/Bukalapak. Lesson: verify *token audience binding*, not just token validity.
4. **Zoom OAuth chained ATO ($15,000, 2024):** response_mode=web_message + promiscuous postMessage + cookie tossing. Lesson: chains across *three* individually-low issues.
5. **Sam Curry-style acquisition hunting:** "abusing HTTP path normalization and cache poisoning to steal accounts" — infrastructure of *acquisitions*, not the main app.
6. **Dependency confusion (Alex Birsan):** hacked Apple/Microsoft via package-manager namespace confusion. Lesson: the supply chain *is* attack surface.

**Pattern across all of them:** none were found by scanners. All came from understanding a protocol/feature *better than its implementers* and testing the seams.

---

## 9. 2024–2026 Trends (where the field is moving)

- **AI/LLM is the exploding category:** HackerOne reports +200% YoY on AI vulns; prompt injection +540%; 1,121 programs with AI in scope (+270%). AI-native bounties exceed $50K for agent-level compromise. **Paid vs N/A line:** injection → unauthorized action with real impact (data exfil, ATO, fraud) pays; "I made the model say something bad" doesn't.
- **Highest-payout AI classes:** indirect prompt injection (attacker plants instructions in *data* processed on a victim's behalf), RAG poisoning, MCP tool poisoning, agent-to-agent injection, LLM SSRF.
- **MCP is the new OAuth:** tool poisoning, tool shadowing, covert invocation — a whole protocol to learn, mirroring the 2022 OAuth gold rush.
- **70% of researchers now use AI tools** (HackerOne 2025) — the baseline is rising; advantage goes to whoever *directs* AI best, not whoever has it.
- **Payout concentration:** criticals take ~88% of spend; the median payout sits ~$2,000 while the mean is ~$52,800 — a power-law game. Chasing P4/P5 findings is a losing strategy; depth on high-impact classes is the only rational play.
- **API-first world:** GraphQL/BOLA, mass assignment, and broken function-level auth dominate web findings; mobile APIs remain the under-hunted twin.

**AI replication (strategic):** Dark Matter should add AI-target testing as a first-class hunt mode (LLM endpoint discovery → indirect injection → RAG/MCP testing), since it's the highest-growth, lowest-competition surface — and ironically, an AI agent testing AI systems is a natural fit.

---

## 10. Synthesis: The Elite Hunter Operating System (for Dark Matter)

If the above were compressed into agent architecture:

1. **Target model first** — business type, crown jewel, tech stack, auth model, roles. No requests before the model exists.
2. **Goal-driven sessions** — one ultimate goal + 1–2 vuln classes per session; every action cites its hypothesis.
3. **Recon as a pipeline, not a phase** — subdomain → live hosts → JS mining → archives → params → ports → takeover → scored attack-surface map. 60%+ of hunt budget here.
4. **Primitive graph + chain engine** — every finding becomes a node; the agent systematically expands edges (siblings, downstream consumers, second-order sinks) before reporting.
5. **Impact gate** — "can an attacker do this RIGHT NOW to a real user?" If no, kill it. No theoretical reports.
6. **Business-logic scenarios** — stateful multi-account flows (purchase, refund, invite, role-change) as first-class test programs.
7. **Differential testing** — mobile vs web, free vs paid, old vs new; diffs find bugs.
8. **Time budgets + rotation** — per-endpoint and per-feature time boxes; yield telemetry drives strategy.
9. **Report as a business case** — impact in the first two sentences; numbered reproduction; suggested fix. (Track 4 covers this in depth.)
10. **Compounding memory** — every hunt's notes, failed hypotheses, and technique yields persist and inform the next hunt.

---

## Sources consulted

- SkillHub `library/bugbounty/01/SKILL.md` (Top-1% mindset, A→B→C chains, kill-rules) — https://github.com/abhishek1kr/skillhub/blob/HEAD/library/bugbounty/01/SKILL.md
- SkillHub `library/logic/bb-methodology/SKILL.md` (5-phase workflow, operator notes) — https://github.com/abhishek1kr/skillhub/blob/HEAD/library/logic/bb-methodology/SKILL.md
- SkillHub `library/recon/bb-local-toolkit/SKILL.md` (master workflow, impact question) — https://github.com/abhishek1kr/skillhub/blob/HEAD/library/recon/bb-local-toolkit/SKILL.md
- RedBee `platform/agents/skills/methodology/bug-bounty.md` (mindset, chains) — https://github.com/zxq092/redbee/blob/HEAD/platform/agents/skills/methodology/bug-bounty.md
- RedBee `platform/agents/skills/methodology/bb-methodology.md` (phased discovery, decision flows) — https://github.com/zxq092/redbee/blob/HEAD/platform/agents/skills/methodology/bb-methodology.md
- RedBee `platform/agents/skills/vulnerabilities/hunt-xss.md` (XSS chain patterns) — https://github.com/zxq092/redbee/blob/HEAD/platform/agents/skills/vulnerabilities/hunt-xss.md
- novahaku `testing/hunt/hunt-oauth/SKILL.md` (OAuth ATO case catalog) — https://github.com/yoniku/novahaku/blob/HEAD/testing/hunt/hunt-oauth/SKILL.md
- lu1sdv skillsmd `vuln-research/references/auth-access-logic.md` (OAuth non-happy paths) — https://github.com/lu1sdv/skillsmd/blob/HEAD/vuln-research/references/auth-access-logic.md
- mhuzaifajamil agentic-vapt `Actual-Setup/skills/bb-methodology/SKILL.md` (mindset + workflow) — https://github.com/mhuzaifajamil/agentic-vapt-personal-lab/blob/HEAD/Actual-Setup/skills/bb-methodology/SKILL.md
- mhuzaifajamil agentic-vapt `Actual-Setup/skills/capability-chaining/SKILL.md` (primitive translation) — https://github.com/mhuzaifajamil/agentic-vapt-personal-lab/blob/HEAD/Actual-Setup/skills/capability-chaining/SKILL.md
- lordoftheheights thanatos-antihermes `skills/security/bug-bounty-methodology/SKILL.md` (scope discipline, recon pipeline) — https://github.com/lordoftheheights/thanatos-antihermes/blob/HEAD/skills/security/bug-bounty-methodology/SKILL.md
- ardakocadoru/bug-bounty-methodology (2026 methodology repo: recon/web/API/cloud/AI-mobile) — https://github.com/ardakocadoru/bug-bounty-methodology
- r00t-kim/terminator `research/bug_bounty_triage_insights_2024_2026.md` (elite report benchmarks) — https://github.com/r00t-kim/terminator/blob/HEAD/research/bug_bounty_triage_insights_2024_2026.md
- lifejiggy/prompt-hunting `Bug-Bounty-Program-Strategy/01-Program-Selection-Criteria.md` (hunter profiles) — https://github.com/lifejiggy/prompt-hunting/blob/HEAD/Bug-Bounty-Program-Strategy/01-Program-Selection-Criteria.md
- ajtazer/heckit `agents/pentest-ai-bug-bounty.md` (program evaluation) — https://github.com/ajtazer/heckit/blob/HEAD/agents/pentest-ai-bug-bounty.md
- hnc-sec/roadmap `roadmap/content/roadmap/bug-bounty-fundamentals.md` (fundamentals + chaining) — https://github.com/hnc-sec/roadmap/blob/HEAD/roadmap/content/roadmap/bug-bounty-fundamentals.md
- sanehunters/sane_android `skills/android-bounty/SKILL.md` (breadth-before-depth doctrine) — https://github.com/sanehunters/sane_android/blob/HEAD/skills/android-bounty/SKILL.md
- joasasantos/neurosploit `agents_md/meta/bugbounty_methodology.md` (KingOfBugBounty-style recon) — https://github.com/joasasantos/neurosploit/blob/HEAD/agents_md/meta/bugbounty_methodology.md
- deathbringer-gd/bug-bounty-methodology `archived/01-Recon-and-Mapping-Methodology.md` (passive recon) — https://github.com/deathbringer-gd/bug-bounty-methodology/blob/HEAD/archived/01-Recon-and-Mapping-Methodology.md
- faizan00/claude-bug-bounty `skills/web2-recon/SKILL.md` (JS analysis, ffuf) — https://github.com/faizan00/claude-bug-bounty/blob/HEAD/skills/web2-recon/SKILL.md
- sekolah76/syadagentic `arsenal-skills/.../web2-recon/SKILL.md` (secret scanning, JS recon) — https://github.com/sekolah76/syadagentic/blob/HEAD/arsenal-skills/skills-lengkap/bug-bounty/bug-bounty/skills/web2-recon/SKILL.md
- s1n6h/bug-bounty-skills `skills/Gabson0x-bountyforge-skills-web2-recon.md` (30-min recon protocol) — https://github.com/s1n6h/bug-bounty-skills/blob/HEAD/skills/Gabson0x-bountyforge-skills-web2-recon.md
- r-s0n/rs0n-bug-bounty-mcp-server `knowledge-base/methodology/recon-methodology.md` (JS analysis, dorking) — https://github.com/r-s0n/rs0n-bug-bounty-mcp-server/blob/HEAD/knowledge-base/methodology/recon-methodology.md
- cybersecplayground/bugbounty-tips-and-tricks `TIPS/Advanced-Bug-Bounty-Recon -Playbook.md` (recon playbook, dorking) — https://github.com/cybersecplayground/bugbounty-tips-and-tricks/blob/HEAD/TIPS/Advanced-Bug-Bounty-Recon%20-Playbook.md
- umar1122/dorkrecon (dork reference) — https://github.com/umar1122/dorkrecon/blob/HEAD/README.md
- gotr00t0day/gotr00t0day.github.io `Guides/Dorking-Guide-Bug-Bounty.md` (GitHub dorks) — https://github.com/gotr00t0day/gotr00t0day.github.io/blob/HEAD/Guides/Dorking-Guide-Bug-Bounty.md
- zeekeey-jpeg/leroy-hq `modules/security/skills/ai-bounty-attacks.md` (AI bounty attacks 2026) — https://github.com/zeekeey-jpeg/leroy-hq/blob/HEAD/modules/security/skills/ai-bounty-attacks.md
- dot-hunter/anonymous-bug-bounty-platform `skills/hunt-llm-ai/SKILL.md` (LLM hunting methodology) — https://github.com/dot-hunter/anonymous-bug-bounty-platform/blob/HEAD/skills/hunt-llm-ai/SKILL.md
- acaacx/ai-ml-free-resources-for-security-and-prompt-injection (AI pentest roadmap) — https://github.com/acaacx/ai-ml-free-resources-for-security-and-prompt-injection
- nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters `assets/blogposts.md` (canonical writeup index) — https://github.com/nahamsec/Resources-for-Beginner-Bug-Bounty-Hunters/blob/master/assets/blogposts.md
- Bugitrix, "The $0 to $10,000 Bug Bounty Mindset" (Medium, Aug 2026) — https://medium.com/@bugitrix/the-0-to-10-000-bug-bounty-mindset-how-successful-hunters-think-differently-96219304e252
- eliteOm3n, "Recon is 80% of the Bug" (Medium) — https://medium.com/@eliteOm3n/recon-is-80-of-the-bug-heres-the-methodology-that-actually-finds-them-f5980dbc94bf
- atnoforcybersecurity, "The 5 Most Common Vulnerabilities I Find in Every Bug Bounty Program" (Medium) — https://medium.com/@atnoforcybersecurity/the-5-most-common-vulnerabilities-i-find-in-every-bug-bounty-program-359cfd4f9942
- rushivenkatadri, "My First Month Bug Bounty Hunting Changed the Way I Think" (Medium) — https://medium.com/@rushivenkatadri/my-first-month-bug-bounty-hunting-changed-the-way-i-think-about-security-8f4bf18a206c
- mrktn, "Bug Bounty Hunting & Discipline" (Medium) — https://medium.com/@mrktn/bug-bounty-hunting-discipline-the-skill-nobody-talks-about-8e1982369dc4
- telynor, "Bug Bounty for Beginners: The Real Talk Guide (No BS Edition)" (Medium) — https://medium.com/@telynor_51425/bug-bounty-for-beginners-the-real-talk-guide-no-bs-edition-b47f8e92efb5
- 0xkarthi, "JavaScript Enumeration for Bug Bounty Hunters" (Medium) — https://medium.com/@0xkarthi/javascript-enumeration-for-bug-bounty-hunters-0e38520492e7
- osintteam, "How Top Bug Bounty Hunters Actually Use ChatGPT in 2026" — https://osintteam.blog/how-top-bug-bounty-hunters-actually-use-chatgpt-in-2026-e6dd2fa2e544
- Undercode Testing, "From HackerOne's Frontlines" (2026 career guide) — https://undercodetesting.com/from-hackerones-frontlines-how-to-forge-a-top-tier-bug-bounty-career-in-2026-video/
- Undercode Testing, "From Lab to Live Fire: Field Manual for 2026" — https://undercodetesting.com/from-lab-to-live-fire-the-bug-bounty-hunters-field-manual-for-2026-video/
- Undercode Testing, "How I Hacked Google" (deep-dive methodology) — https://undercodetesting.com/how-i-hacked-google-the-deep-dive-bug-bounty-methodology-that-landed-two-vulnerabilities-video/
- GitHub Blog, "How we found 24 Android vulnerabilities using our open source AI security agent" — https://github.blog/security/how-we-found-24-android-vulnerabilities-using-our-open-source-ai-security-agent/
- HackerOne 8th Annual Hacker-Powered Security Report (Oct 2025) via SQ Magazine — https://sqmagazine.co.uk/smart-contract-bug-bounties-statistics/
- YesWeHack Bug Bounty Report 2025 (cited via triage-insights research)
- jhaddix, "The Bug Hunter's Methodology v4.0 — Recon Edition" (NahamCon 2020) — https://www.youtube.com/watch?v=p4JgIu1mceI
- Critical Thinking Bug Bounty Podcast, Ep. 75: Frans Rosén — https://podcast365.ro/episoade/critical-thinking-a-bug-bounty-podcast/episode-75-rerun-of-the-og-bug-bounty-king-frans-rosen-Y9Lf-naJJM
