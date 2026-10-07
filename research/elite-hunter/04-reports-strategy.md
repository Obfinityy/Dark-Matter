# Track 4 — Report Excellence & Program Strategy

**Mission:** What makes bug bounty reports get accepted and paid maximum + program strategy
**Date:** 2026-10-07
**Purpose:** Feed Dark Matter's report generator + hunt-planning engine with elite-level reporting standards.

> Core insight from the research: the report is the product. The vulnerability is raw material. Triagers handle 50–100 reports/week; bounty amounts are partly discretionary; signal-to-noise ratio gates private invites. An elite report makes a triager able to reproduce the bug in under 10 minutes and understand business impact in 60 seconds — without asking a single question.

---

## 1. Anatomy of a Perfect Report

### The triager's 60-second checklist
Within the first minute, a triager silently asks six questions. Your report must answer all of them:

| Triager asks | They look for | Your job |
|---|---|---|
| Is this in scope? | Target matches program policy | State scope in the first line |
| Is this a duplicate? | Unique vuln or attack path | Highlight what makes yours unique |
| Can I reproduce it? | Numbered steps with exact payloads | Steps a junior engineer can follow |
| Is it really a security issue? | Real-world impact, not theory | Demonstrate concrete business impact |
| How severe is it? | CVSS + business context | Justify severity with attack scenario |
| Is the hunter legit? | Professional tone, no begging | Write like a consultant, not a beggar |

If any answer is not obvious in 60 seconds, the report is too long, too vague, or missing information.

### Winning report structure (used by top hunters)
- **Title** (1 line, 10–15 words): vuln type + location + impact hint. Bad: "XSS found." Good: "Stored XSS in profile bio executes in other users' sessions."
- **Summary** (2–3 sentences, 50–80 words): what, where, why it matters. Answers the three questions: what is it, where is it, what is the consequence.
- **Severity** (1 line): CVSS score + vector + recommended rating (Critical/High/Medium/Low).
- **Vulnerability type** (1 line): CWE ID + name, e.g. CWE-79 XSS, CWE-89 SQLi, CWE-639 authorization bypass.
- **Affected endpoint/asset** (1–2 lines): exact URL, parameter, app version, platform.
- **Steps to reproduce** (5–15 numbered steps): exact URLs, parameters, headers, payloads, account roles, prerequisites. Write like a recipe for someone who has never seen the app.
- **Proof of concept** (3–8 screenshots, raw request/response, short video for UI bugs): evidence, not claims.
- **Impact** (100–200 words): business impact in non-technical language.
- **Remediation** (2–4 lines): root-cause-specific fix. Bad: "sanitize input." Good: "Add server-side authorization check verifying `request.user.id == params.id` before returning the record; reject and log unauthorized requests."
- **Supporting materials**: raw HTTP logs, PoC script, video link.

**Length guidance:** 300–800 words + 3–8 screenshots. Long enough to reproduce in under 10 minutes; short enough that key facts are in the first few lines.

### What separates paid from ignored (same bug, different report)
A real pattern observed across sources: a 3-sentence report ("Found IDOR on /api/users/{id}. Can see other users' data") gets ~$250 or "Informative." The same IDOR with numbered steps, raw request/response, screenshots proving account takeover, a CVSS 8.1 vector, and a business-impact statement (GDPR fines, user count, mass data exposure) gets ~$7,500 and triage within hours. Presentation determines payout as much as the bug itself.

### Style rules from elite hunters
- Conversational but professional tone; no leetspeak, slang, jokes, or memes — a security report is a business document.
- Don't assume the reader knows the app. Spell out every assumption.
- One vulnerability per report (unless chaining for impact under one root cause).
- Be specific, never vague: never "this could be dangerous," always "this leads to account takeover of any user."
- Never claim what you didn't prove: "rate what you proved" — if you proved read access, don't rate as if you proved takeover.

### AUTO-GENERATION MAP — report structure
| Element | How Dark Matter generates it |
|---|---|
| Title | Template: `{vuln-type} in {endpoint/feature} allows {impact}` — assembled from classified finding + affected asset + impact keyword |
| Summary | 3-sentence synthesiser: what (vuln class + CWE), where (asset), consequence (impact class). Max ~70 words |
| Severity line | CVSS vector computed from evidence (see §5), formatted as `CVSS v3.1: X.X (Rating) Vector: CVSS:3.1/...` |
| Vuln type | CWE lookup from vuln-class taxonomy (Track 2) — mandatory field |
| Affected endpoint | Pulled verbatim from the hunt's validated evidence (URL, parameter, app version) |
| Steps to reproduce | Convert the agent's own action log into numbered steps — the agent literally replays what it did, with exact payloads. QC pass: strip session-specific tokens, keep test-account credentials |
| PoC | Embed captured raw HTTP request/response; screenshots auto-captured at exploitation moment; auto-generate short screen recording for UI-class bugs |
| Impact | Impact engine (§3 framework): who/what/business consequence/scale, populated from vuln class + data type + user base |
| Remediation | CWE → fix-pattern lookup table with before/after code sketch; never generic advice |
| Supporting materials | Auto-attached: raw logs, PoC script, video link |
| QC gate | Pre-submit checklist (§2): friend-test reproducibility, scope check, duplicate search, evidence redaction, severity sanity |

---

## 2. PoC Quality — the Heart of the Report

**The #1 rejection reason across all sources: "Cannot reproduce" / "Insufficient PoC."** A report without a working PoC is a claim; with one, it's undeniable evidence.

### The 5 elements of a perfect PoC
1. **Reproducible** — a triager with no context reproduces it in under 10 minutes.
2. **Self-contained** — everything needed is in the report; no "ask me for credentials."
3. **Safe** — demonstrate impact without real damage: own test accounts, redacted data, non-destructive payloads.
4. **Visual** — screenshots with annotations showing the vulnerable state and the exploitation result.
5. **Minimal** — only what's necessary; 3 screenshots that tell a story beat 50 dumps.

### Per-class PoC standards
- **XSS:** show `alert(document.domain)` (proves execution context), not `alert(1)`. For impact demo, exfiltrate cookie to your own collaborator endpoint.
- **SSRF:** show internal service response or cloud metadata returned; target your own webhook/Burp Collaborator.
- **SQLi:** show database version or table names — never dump full tables.
- **IDOR:** show access to your *own secondary account's* data, never real users'.
- **RCE:** show `id`/`whoami` — never destructive commands.
- **Never:** access more data than needed, modify production data, crash systems, or exfiltrate real customer data — this can get you banned.

### Common PoC mistakes
- Theoretical PoC ("an attacker could potentially…") — show it, do it, screenshot it.
- Self-XSS — requires the victim to paste the payload themselves; not valid.
- Broken reproduction (works on your machine, not triage's: missing cookies, wrong environment, unstated prerequisites).
- Scanner output pasted raw — never submit unvalidated tool output.

### Evidence hygiene (what goes IN the report)
- Use throwaway test accounts created specifically for the engagement.
- Redact real PII, production cookies, real emails/tokens in PoC steps.
- Rotate cookies/tokens after each submission — don't reuse the cookie pasted in the report.
- Blur user lists in admin-panel screenshots; blur URL bars containing tokens.
- Short video helps for multi-step/UI bugs (clickjacking); never record other users' private data.

### AUTO-GENERATION MAP — PoC
| Element | How Dark Matter generates it |
|---|---|
| Reproducible steps | Replay-validated: agent re-runs its own attack in a clean session before writing; if replay fails, finding is downgraded, not submitted |
| Screenshots | Auto-capture at each exploitation stage; annotate the vulnerable parameter and the result |
| Raw HTTP | Store request/response pairs from the exploit; auto-redact session tokens via pattern rules (session=, Authorization:, Set-Cookie values) |
| PoC script | Emit a minimal replay script (curl or Python) generated from the validated request sequence |
| Class-specific evidence | Per-class evidence checklist from Track 2 taxonomy (e.g., XSS→document.domain proof, SSRF→metadata response) |
| Safety | Enforce non-destructive payloads at hunt time; report generator refuses to include evidence touching real-user data |
| QC | "Friend test": an independent validation pass replays the report's steps verbatim; any ambiguity → steps rewritten before submit |

---

## 3. Impact Statements — Where Payouts Are Won

**The impact statement translates technical findings into business risk. This is what moves a bounty from $500 to $5,000 for the same bug.**

### The 4-question impact framework
Every impact statement answers:
1. **Who is affected?** Users, admins, the company, third parties.
2. **What can the attacker do?** Read data, modify data, take over accounts, execute code.
3. **What is the business consequence?** Data breach, financial loss, regulatory fine (GDPR/CCPA/PSD2), reputational damage.
4. **How many people/systems are at risk?** Scale — user counts, transaction volume.

### Good vs bad
- Bad: "An attacker can execute JavaScript on the page."
- Good: "An attacker crafts a malicious link; when a logged-in user clicks it, JavaScript executes in their session. The attacker can (1) steal session cookies and take over any account including admins, (2) act on the victim's behalf (transfer funds, change settings), (3) persist malware via DOM manipulation. With 250,000 active users and $50M monthly transaction volume, exploitation could cause mass account takeover, direct financial fraud, and regulatory fines up to 4% of annual turnover under GDPR. The attack needs no authentication and delivers via any channel."

### Impact multipliers (bounty amplifiers)
| Multiplier | Example | Bounty effect |
|---|---|---|
| Chain multiple bugs | IDOR + privesc = account takeover | 2–5× increase |
| Affect admin/critical systems | Admin panel vs user panel | 3–10× increase |
| Demonstrate real-world attack | Full phishing scenario with video | 2–3× increase |
| Regulatory implications | PII/PCI/health data exposure | 2–5× increase |
| Scale of impact | All users vs single user | 2–10× increase |
| New vuln class on the platform | First-of-kind finding | Bonus (varies) |

### AUTO-GENERATION MAP — impact
| Element | How Dark Matter generates it |
|---|---|
| 4-question block | Slot-fill: affected party (from vuln class + asset), attacker capability (from demonstrated exploit), business consequence (from data-type → regulation mapping: PII→GDPR, payment→PCI/PSD2, health→HIPAA), scale (user count / asset reach from recon) |
| Multiplier detection | Auto-check: does the chain cross a privilege boundary? (→ chain multiplier) Is the asset admin-tier? (→ admin multiplier) Is regulated data involved? (→ regulatory multiplier) What fraction of users affected? (→ scale multiplier) |
| Tone | Business language for non-technical readers; numbers wherever the hunt measured them (user counts, records exposed) |
| Anti-pattern guard | Reject vague phrasing ("could be dangerous"); require concrete verbs ("exfiltrate," "modify," "take over") |

---

## 4. Common Rejection Reasons & Elite Avoidance

| Rejection | Why it happens | Elite avoidance |
|---|---|---|
| Cannot reproduce | Unclear steps, missing payloads, undocumented preconditions | Friend-test: someone reproduces from the report alone before submit |
| Duplicate | Someone reported it first | Submit fast; unique attack chains; less-crowded programs (see §7) |
| Out of scope | Target/policy not read | Re-read scope + exclusions before testing AND before submitting |
| Intended behavior | Actually how the app works | Verify against docs; check "known issues" lists |
| Informative | Real issue, no security impact / too low severity | Demonstrate concrete impact; chain with other bugs to raise severity |
| Not applicable | Self-XSS, theoretical, no real exploitation path | Only report what you actually exploited with proof |
| Spam / low quality | Raw scanner output, no human analysis | Never submit tool output; manually validate every finding |
| Insufficient proof | Claim without evidence | Screenshots + raw request/response + working PoC, always |

**Additional elite rules:**
- Check disclosed reports (HackerOne Hacktivity) before hunting a program — learn what triage accepts and how they rate.
- One vuln per report keeps triage clean; only chain when demonstrating a single attack path.
- If a finding turns out constrained (internal-only, narrow precondition, privileged role), downgrade severity honestly — don't silently drop it, and don't inflate it.

### AUTO-GENERATION MAP — rejection-proofing
| Check | How Dark Matter enforces it |
|---|---|
| Reproducibility | Independent replay pass before submit (see §2) |
| Duplicate risk | Pre-submit search: disclosed reports for the program + variant analysis (is this the same root cause as a known issue?) |
| Scope | Scope-checker runs the target against the program's in-scope asset list and exclusions; blocks out-of-scope submission |
| Intended behavior | Flag when behavior matches documented/known-issue patterns; require explicit justification to proceed |
| Severity floor | Severity self-assessment (§5) — if nothing tangible, kill the finding, don't submit |
| Scanner-output guard | Block submission of unvalidated tool output; require manual-confirmation flag from the validation loop |

---

## 5. CVSS Scoring Done Right

### Discipline rules elites follow
- **Score before writing the report, not after.** Writing impact first inflates your own perception; score the facts cold.
- **Always use the official FIRST calculator.** Never eyeball. Small metric changes swing scores significantly.
- **CVSS is a shared vocabulary, not a substitute for business impact.** State the vector, then argue real-world context in prose.
- **Rate what you proved.** Proved read access? Don't score as account takeover.
- **Match the program's version.** CVSS 3.1 and 4.0 scores are not interchangeable — convert when the program specifies one.
- **Know VC vs SC (CVSS 4.0).** Confidentiality of the vulnerable component vs subsequent systems — e.g., SSRF endpoint itself reveals little (VC low) but reaches cloud metadata (SC high). Getting this right swings 2–3 points.

### Typical scores by bug class (reference ranges)
- Auth bypass → admin: ~9.8 Critical
- SSRF → cloud metadata: ~9.1 Critical
- JWT `alg=none`: ~9.1 Critical
- SQLi with data exfil: ~8.6 High
- GraphQL auth bypass: ~8.7 High
- IDOR write/delete: ~7.5 High
- IDOR read PII: ~6.5 Medium
- Stored XSS (broad reach): 5.4–8.8 Med–High
- Reflected XSS (needs user interaction): lower — the UI metric (Active vs None/Passive) often separates Medium from High

### Severity decision guide
- **Critical (P1):** unauthenticated RCE, full account takeover at scale, mass PII exfil, admin privesc from unauthenticated state.
- **High (P2):** authenticated RCE, IDOR on sensitive data, SSRF to internal creds, stored XSS on sensitive features, unlimited payment bypass.
- **Medium (P3):** reflected XSS, CSRF on non-critical actions, limited business-logic flaws, non-PII info disclosure.
- **Low (P4):** minor leaks, verbose errors without sensitive data, clickjacking on non-sensitive pages (with working PoC).

### Severity self-assessment (each YES raises severity)
1. Exposes PII/health/financial data of other users? → +1
2. Allows account takeover or privilege escalation? → +2
3. Requires zero victim interaction? → +1
4. Affects all users, not a narrow condition? → +1
5. Remotely exploitable without internal access? → baseline for High+

### When triage rates lower than your CVSS (common: CVSS 7.x High vs platform default P4/Medium)
1. Put a severity-request paragraph as the **first body section**, grounded in the CVSS vector string + business impact, not feelings: "CVSS 3.1 AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N = 7.5 High because Confidentiality:High applies to cross-tenant data exposure."
2. Cite the platform's own taxonomy entry (Bugcrowd VRT) that matches your finding. Route *within* the platform's system; don't argue against it.
3. Escalation isn't automatic — you must ask, with grounded reasoning.

### Downgrade counters (ready-made rebuttals)
- "Requires authentication" → "Attacker needs only a free self-registered account — no special role."
- "Limited impact" → "Affects N users / exposes [PII type] / $X at risk."
- "Low CVSS" → "CVSS doesn't capture business impact — attacker extracts [X] in [Y] minutes."
- "Not exploitable" → "Here is the exact response showing victim data returned to the attacker session."

### AUTO-GENERATION MAP — severity
| Element | How Dark Matter generates it |
|---|---|
| Vector computation | Metric-picker from evidence: AV (network?), AC (repeatable?), PR (auth level used), UI (victim action needed?), S (crosses boundary?), C/I/A (demonstrated read/write/down) |
| Score | Run the actual CVSS formula (embed the calculator logic), never eyeball |
| Self-assessment | Run the 5-question checklist; adjust band; justify in 1–2 sentences ("Requires login, exposes other users' data, no write access") |
| Program alignment | Prefer the program's published severity guide when present; convert 3.1↔4.0 when required |
| Severity-request paragraph | Auto-draft when platform default < computed severity: vector + business anchor, first body section |
| Honesty guard | If computed severity and gut disagree, re-check PR/AC/impact metrics — fix the metric, don't override the score |

---

## 6. Triager Communication — Disputes, Bumps, Follow-ups

### Etiquette (the professional standard)
- Respond to triage questions within 24–48 hours; provide what they ask without making them chase you.
- Ask politely for clarification on rejections; add evidence, not pressure.
- Thank the team for their time — even on closed reports.
- If you believe a duplicate is different, explain *specifically* why (attack path X vs Y, additional impact Z), not just "mine is different."
- Never: demand amounts, threaten disclosure, resubmit the same report, argue aggressively, ghost the team, use all-caps/emoji/unprofessional language, or complain publicly about a program.

### Getting severity reconsidered
- Respect the company's decision but politely ask for clarification, referencing *similar reports from the same company* — never compare payouts across different companies (each program values vulns differently).
- Use the downgrade counters in §5; lead with new evidence, not repetition.
- Sample approach: acknowledge the review, then highlight additional context that may justify a higher amount (extended attack path, broader affected population), while respecting the final decision.

### Dispute edge cases (community-standard resolutions, per bug-bounty-standards)
- Bug fixed before triage reviewed the submission: program must prove the submission wasn't accessed pre-fix; if accessed, pay; otherwise it's a duplicate.
- Program claims "already knew internally": program must show proof (e.g., dated internal ticket); without proof, pay the bounty.
- Incorrectly duped against a *newer* report: statuses corrected; whoever triaged wrong pays.
- Severity disagreement: submit reasoning on the ticket; if no response in ~14 days, escalate to the platform's support channel. Upgrades are per-submission.

### AUTO-GENERATION MAP — communication
| Element | How Dark Matter generates it |
|---|---|
| Follow-up drafts | Template library: evidence-supplied reply, duplicate-differentiation reply, severity-reconsideration request, polite rejection query — auto-filled with the finding's facts |
| Duplicate differentiation | Auto-extract: attack path diff, root-cause diff, impact delta vs the cited original — structured as "original covers X; mine demonstrates Y leading to Z" |
| Escalation timing | Track triage SLA per program; auto-remind at 14 days of silence on a severity dispute |
| Tone guard | Strip demanding language; enforce factual, evidence-led phrasing |

---

## 7. Program Selection Strategy

**Picking the right program is as important as how you hunt.** Elite hunters score programs *before* spending a minute.

### High-value indicators
- Recently launched or updated programs (least picked over — freshness is the strongest signal)
- Large scope: wildcards (`*.company.com`), 15+ assets, APIs + mobile + web
- Generous payout table; fast response times (triage < 1 week)
- Complex business logic: fintech, healthcare, SaaS (logic flaws live here)
- Wide accepted vuln-type range; no exclusions on core features
- Technologies you know well; source code available

### Avoid signals
- Months-long response times; "points only" programs (unless learning)
- Extremely narrow scope / heavy restrictions on interesting features
- History of marking valid reports "informative" or disputing payouts
- 2+ years active with no scope updates (likely picked clean)
- All recent reports N/A or duplicate (saturated)
- Max bounty < $500 — not worth the time

### Scoring models used by elites
One published formula: `Program Score = max_bounty × sqrt(value_at_risk) × freshness_multiplier × complexity_bonus` where freshness is 3× for launched-within-30-days, 2× for updated-within-30-days, and complexity is 1.5× for novel mechanics.

A simpler go/no-go checklist (score before hunting, skip if < 4):
- Max bounty ≥ $5K: +2; large user base or handles money: +2; launched < 60 days ago: +2
- Complex features (API, OAuth, upload, GraphQL): +1; recent code/feature changes: +1
- Private program: +1; tech stack you know: +1; source available: +1; prior disclosed reports to study: +1
- 6–8: good, spend 1–3 days. 9+: excellent, spend up to a week.

### Timing strategies
- Hunt immediately after scope additions or major feature releases — new code has migration bugs and state-transition errors.
- Monitor changelogs, app-store updates, job postings (reveals stack and new features).
- Build expertise in emerging tech *before* it becomes a common target.
- Watch program announcements for bounty increases or special events.
- After 4 hours with no leads, pivot to a different target; maintain a rotating list of 3–5 programs.

### New vs established programs
- New/under-hunted (< 20–50 researchers): low duplicate risk, best signal — hunt first.
- Established with 1000+ researchers: easy bugs gone; only chains, edge cases, and business logic survive.
- Private programs (invite-only): higher rewards, less competition — earned via public-program reputation (§9).

### AUTO-GENERATION MAP — program selection
| Element | How Dark Matter generates it |
|---|---|
| Program scoring | Implement the scoring formula: pull max_bounty from payout tables, freshness from program launch/scope-change dates, scope width from asset count, complexity from tech-stack fingerprinting → ranked target list |
| Scope-change monitoring | Continuous diff: new JS bundles, new API endpoints/GraphQL ops, new subdomains, mobile version bumps → alert when fresh surface appears |
| Pre-hunt dossier | Auto-compile before hunting: full scope + exclusions, last 10 disclosed reports (what paid, what didn't), changelog (30d), tech stack, response-time stats |
| Pivot rule | No validated lead after N hours → auto-suggest next ranked target |
| Payout intelligence | Track per-program payout history and dispute rates to refine future scoring (learning loop) |

---

## 8. Duplicates — the Bane of Every Hunter

Up to ~40% of submissions on crowded programs are rejected as duplicates. Elites treat duplicate-avoidance as a core skill.

### Core strategies
1. **Speed** — submit within minutes of validating; on new program launches, low-hanging fruit goes in the first 5 minutes. Automated recon pipelines are non-negotiable for full-time hunters.
2. **Program choice** — avoid 1000+ researcher programs; sweet spot is private/smaller programs or 50–200 active hunters.
3. **Depth over breadth** — go deep on one target instead of surface-level on many.
4. **Business logic** — scanners find the easy stuff first; logic flaws need human thinking and are rarely duped.
5. **New features/releases** — monitor changelogs and app updates; fresh attack surface.
6. **Unique attack surface** — mobile apps, thick clients, internal tools, integration points get less scrutiny.
7. **Chain** — self-XSS + CSRF → stored XSS; chains are almost never duplicates.
8. **Variants near patched bugs** — when a bug gets fixed, hunt sibling endpoints/parameters for the same class.
9. **Pre-report research** — check disclosed reports on HackerOne/Bugcrowd, search GitHub for existing exploits, review the program's fix history.

### When you get duped anyway
- A duplicate validates your skill — it means you found a real bug.
- Politely ask the triager for the original report's date: hours/days/weeks before yours tells you about competition speed.
- Sweep for sibling vulnerabilities around the duped finding; apply the knowledge forward.
- Diversify: keep 3–5 programs rotating so a dupe doesn't kill momentum.
- Note: on HackerOne, duplicates still earn +2 reputation when the original resolves — better to dupe than to submit invalid/theoretical findings.

### AUTO-GENERATION MAP — duplicate avoidance
| Element | How Dark Matter generates it |
|---|---|
| Speed | Report pipeline generates the full report *immediately* after validation — minutes, not days |
| Uniqueness scoring | Before hunting: disclosed-report analysis → which vuln classes are already burned on this program → steer the hunt toward unburned classes and business logic |
| Variant hunting | After any finding (or after reading a disclosed fix): auto-generate sibling-attack tasks on adjacent endpoints/params |
| Freshness alerts | Scope-change monitor (§7) → hunt new surface within hours of deployment |
| Chain priority | chainBuilder (exists in repo) findings get submission priority — chains are the anti-duplicate weapon |
| Post-dupe learning | Record dupe events; feed back into program scoring (saturation signal) and methodology notes |

---

## 9. Reputation Building — the Long Game

**Reputation compounds.** Signal-to-noise ratio and impact quality unlock private invites, priority access, and trust. You're not writing one report — you're building a track record.

### How platforms reward reputation
- **HackerOne:** Signal and Impact scores gate future program invitations; use the Weakness field accurately (maps to CWE); retesting programs pay you to verify fixes; mediation available for disputes.
- **Bugcrowd:** P1–P5 priority scale; crowd analysts triage first; Vulnerability Rating Taxonomy (VRT) determines priority — precise VRT classification matters; quality beats quantity every time. Unlocks: private invites, priority access to high-paying targets, NextGen pentest eligibility, recurring enterprise engagements.
- **Intigriti:** European focus, highly technical triage that appreciates detailed PoCs; leaderboard reputation; bonuses for exceptional reports.
- **YesWeHack:** thorough documentation valued; include CVSS + CWE on every report.

### The compounding loop
1. Submit valid, well-documented reports — even low-severity ones build the relationship.
2. High signal-to-noise → private program invites (higher rewards, less competition).
3. Private programs → deeper engagement → bigger chains → higher payouts.
4. Clean conduct on lost reports (dupes, informatives) is still a deposit in the reputation account.
5. Specialize: become the expert in a niche (bridge security, payment logic, mobile) — deep specialization spots subtle bugs others miss.
6. Community presence: conferences, researcher communities — many private invites come through relationships, not cold outreach.

### AUTO-GENERATION MAP — reputation
| Element | How Dark Matter generates it |
|---|---|
| Signal tracking | Per-program dashboard: submitted / accepted / duped / informative → signal-to-noise ratio; steer effort toward high-signal programs |
| Quality consistency | Every report passes the same QC gate (§2) — no low-effort submissions that damage signal |
| CWE/VRT accuracy | Auto-classify findings to exact CWE + platform taxonomy entries (HackerOne Weakness, Bugcrowd VRT) |
| Retest harvesting | Track fixed findings; auto-claim retest bounties where programs offer them |
| Specialization memory | learningEngine records which vuln classes and tech stacks yield accepted reports → focus future hunts where the agent's hit rate is highest |

---

## 10. Platform-Specific Reporting Notes

| Platform | Report specifics |
|---|---|
| **HackerOne** | Use structured fields (Weakness→CWE, Severity, Assets). Read Hacktivity disclosed reports for the target program before submitting — it shows exactly what triage accepts, how they rate, and what detail they expect. Best pre-submit research available. |
| **Bugcrowd** | Use VPR to justify severity; business context weighted heavily; crowd analysts triage before the program sees it — clear impact statements essential. Check the announcements page for known/resolved issues first. |
| **Intigriti** | Highly technical triage; detailed PoCs appreciated and often bonused. EU/GDPR-heavy programs — regulatory impact framing resonates. |
| **YesWeHack** | English reports fine; thorough documentation valued; always include CVSS + CWE. |

**Universal pro tip:** read 5 recently disclosed, well-paid reports for any program you target. Model your structure, detail level, and impact framing on them.

---

## 11. PERFECT REPORT TEMPLATE

Copy-paste ready. Fill every `[bracket]`; delete nothing.

```markdown
# [Vuln Type] in [Feature/Endpoint] allows [Impact] — [Asset]

## Summary
[2–3 sentences: what the vulnerability is, where it lives, and why it matters.
Example: "An Insecure Direct Object Reference (IDOR) exists in the
/api/billing/invoice endpoint. By changing the invoice_id parameter, an
authenticated user can retrieve invoices belonging to other customers,
including names, addresses, and payment details."]

## Severity
CVSS v3.1: [X.X] ([Critical/High/Medium/Low])
Vector: CVSS:3.1/[full vector string]
Justification: [1–2 sentences on what was actually demonstrated.
Example: "Requires login as any user, exposes other customers' PII,
no write access demonstrated."]

## Vulnerability Type
CWE-[ID]: [Name] (e.g., CWE-639: Authorization Bypass Through User-Controlled Key)

## Affected Asset
- URL/Endpoint: [exact URL]
- Parameter/Field: [exact parameter]
- Scope confirmation: [in-scope per program policy section X]
- Environment: [app version / platform / browser if relevant]

## Steps to Reproduce
1. [Create two test accounts: attacker@example.com and victim@example.com]
2. [Log in as victim@example.com]
3. [Navigate to https://target.com/...]
4. [Intercept the request in Burp Suite]
5. [Modify parameter X from A to B]
6. [Forward the request]
7. [Observe: response contains victim's data — see screenshot 2]

Prerequisites: [account type, settings, feature flags — or "none"]

## Proof of Concept
### Request
```http
[raw HTTP request — redact session tokens]
```
### Response (abridged)
```http
[raw HTTP response showing the vulnerability — redact real user PII]
```
### Screenshots
1. [Vulnerable request with parameter highlighted]
2. [Response showing unauthorized data access]
3. [Impact demonstration — e.g., victim data rendered in attacker session]
### Video (for UI/multi-step bugs)
[link — under 60 seconds, no real user data]

## Impact
[100–200 words answering the 4 questions:
1. Who is affected? — [e.g., all 50,000 registered users]
2. What can the attacker do? — [e.g., read any customer's invoices]
3. Business consequence? — [e.g., mass PII breach, GDPR fines up to 4% turnover]
4. Scale? — [e.g., every customer record reachable by ID enumeration]
Attack scenario: [concrete walkthrough a non-technical reader understands]]

## Remediation
[Root-cause-specific fix with before/after sketch.
Example: "Add a server-side authorization check in the /api/billing/invoice
handler verifying request.user.id owns the requested invoice_id (or the user
holds an admin role) before returning the record. Reject unauthorized requests
with 403 and log the attempt. Do not rely on client-side ID validation."]

## References
- CWE-[ID]: https://cwe.mitre.org/data/definitions/[ID].html
- [OWASP cheat sheet / relevant standard]

## Attachments
- [ ] Raw HTTP request/response logs
- [ ] PoC replay script (curl/Python)
- [ ] Screenshots (annotated)
- [ ] Video demo (if UI-class)

## Pre-submit checklist
- [ ] Reproduced from these exact steps in a clean session
- [ ] Target confirmed in-scope; exclusions re-checked
- [ ] Disclosed reports searched — not a known duplicate
- [ ] Severity scored BEFORE writing impact; vector verified in calculator
- [ ] Real user data redacted; own test accounts only
- [ ] One vulnerability per report (or one demonstrated chain)
- [ ] Professional tone; no demands, no threats, no slang
```

---

## 12. Dark Matter Integration Notes

The repo already has `backend/src/engines/aiReportWriter.js` (`huntReportToMarkdown`). This research upgrades it from "markdown formatter" to "elite report engine":

1. **Add the 60-second checklist as a structural validator** — every generated report must answer the six triager questions in its first screen; fail closed (don't submit) otherwise.
2. **Replay-before-submit** — wire the existing `pocGenerator` output through a clean-session replay; only validated findings reach the report writer.
3. **CVSS engine** — replace/augment `riskScorer`'s 0–10 scale with real CVSS 3.1 vector computation from evidence + the 5-question self-assessment; keep the 0–10 for internal prioritization, emit CVSS for submissions.
4. **Impact engine** — new module: 4-question slot-fill + multiplier detection (chain/admin/regulatory/scale) + data-type→regulation mapping.
5. **Remediation lookup** — CWE → fix-pattern table with before/after sketches; forbid generic advice.
6. **Evidence hygiene pass** — token/PII redaction as a pipeline stage before report assembly.
7. **Communication drafts** — template library for follow-ups, duplicate-differentiation, and severity-reconsideration, auto-filled per finding.
8. **Program intelligence** — program scoring model + scope-change monitoring + pre-hunt dossier compiler feeding hunt planning.
9. **Duplicate pre-screen** — disclosed-report search + variant analysis before submit; chain prioritization via existing `chainBuilder`.
10. **Reputation ledger** — per-program signal tracking feeding future target selection (learning loop with `learningEngine`).

---

## Sources

- hackersonlineclub.com — "How to Write Bug Bounty Report That Gets Paid (2026)" (report structure, triager checklist, impact framework, severity guide, rejection table, communication etiquette, platform tips)
- bugitrix.com — "Bug Bounty Report Template: Write Reports That Get Paid" (weak-vs-strong report table, severity guidance, beginner mistakes, FAQ)
- amrelsagaei.com — "The Bug Bounty Report Blueprint Triagers Don't Ignore" (IDOR report anatomy walkthrough)
- github.com/hakluke/bug-bounty-standards (dispute edge-case resolutions)
- github.com/Wiziwax/bug_hunting_report — bug_report_guide.md (report anatomy, triager etiquette do/don't)
- github.com/r-s0n/ars0n-framework-v2 — knowledge-base/reports/rejected/common-rejections.md (rejection taxonomy from disclosed reports + research)
- github.com/ak-cybe/awesome-offensive-security-skills — bug-bounty-report-writer references/vickie-li-bootcamp.md (escalate impact, mitigation guidance, style rules)
- github.com/zxq092/redbee — platform/agents/skills/reporting/report-writing.md (CVSS vs VRT gaps, severity-request paragraph, evidence hygiene)
- github.com/mhuzaifajamil/agentic-vapt-personal-lab — skills/triage-validation/SKILL.md (severity validation gates, kill-fast rules, anti-patterns)
- github.com/parsamajidipour/bug-bounty-checklist — reports/severity-guide.md (scoring discipline: impact/reach/prerequisites/reliability)
- github.com/lissy93/bug-bounties — learn/understanding-cvss-scoring-for-bounty-hunters.md (score-before-writing, VC vs SC, version conversion)
- github.com/sekolah76/syadagentic — report-writing/SKILL.md (CVSS quick scoring, typical scores by bug class, severity decision guide, downgrade counters)
- github.com/aaditkarki215-collab/web-pentest-methodology — 05-reporting.md (severity heuristics, one-vuln-per-report rule)
- github.com/r00t-kim/terminator — research/bug_bounty_triage_insights_2024_2026.md (duplicate avoidance strategies, high-value PoC standards)
- undercodetesting.com — The Duplicate Dilemma (duplicate avoidance playbook, scope expansion, recon speed)
- github.com/ajtazer/heckit — agents/pentest-ai-bug-bounty.md (program evaluation, duplicate strategies, platform tips)
- github.com/conjure-3301/skills — bounty-hunting-strategy/SKILL.md (program scoring formula, pivot rules)
- github.com/lifejiggy/prompt-hunting — Bug-Bounty-Program-Strategy/09-Private-vs-Public-Programs.md (timing strategies, program tiers, economic optimization)
- github.com/srvfernandes/bounty-watch (hunt-score model: freshness/new-surface/attack-surface/reward/saturation)
- github.com/mirshad0w/bug-bounty-handbook — 34-reporting-communication.md (report lifecycle, reputation compounding)
- medium.com/@penoughcyber — Bugcrowd reputation framework (quality > quantity, unlocks)
- dev.to/devprogramming — "My 100 Hour Rule for Bug Bounty" (overlooked vuln classes, infrastructure misconfig goldmines)
- medium.com/@userwithheart — "How to Choose a Target That Won't Waste Your Time" (program activity/payout/competition checks)
- dev.to/mjdjll — "Crafting The Perfect Bug Bounty Report" (structure guide)
- facebook.com/whitehat — bug bounty education (what well-written reports enable)
