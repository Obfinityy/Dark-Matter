# Part 04 — Report quality & communication

0001. **Stakeholder-variant report generator** — emits three versions from one finding set: executive (business risk, dollar exposure), engineering (repro steps, code fix), compliance (control mappings) — each with appropriate depth and jargon level.
0002. **Board-ready one-page brief** — distills the entire hunt into a single page with risk posture dial, top-3 exposures, and required budget decision, readable by a non-technical director in 60 seconds.
0003. **Engineering deep-dive dossier** — produces a per-finding technical brief with full HTTP traces, payload anatomy, affected code paths, and framework-specific root-cause analysis for the owning developer.
0004. **Compliance auditor packet** — generates control-by-control evidence bundles mapping each finding to the auditor's requested framework clauses with test procedures and pass/fail verdicts.
0005. **Legal counsel advisory memo** — translates findings into exposure language for counsel: data categories at risk, breach-notification triggers per jurisdiction, and recommended disclosure posture.
0006. **Insurance underwriter summary** — formats the hunt into a cyber-insurance submission: attack surface inventory, control gaps, and a residual-risk score suitable for premium calculation.
0007. **Product manager impact sheet** — maps each vulnerability to user-facing features, affected user segments, and prioritization guidance aligned to sprint planning vocabulary.
0008. **Customer-facing security bulletin** — drafts a public-safe disclosure notice per critical finding describing impact in plain language without revealing exploit details.
0009. **DevOps/SRE operational brief** — lists findings as runbook items: detection signals, mitigation toggles, rollback steps, and on-call escalation paths per severity.
0010. **Investor due-diligence snapshot** — summarizes security posture for M&A or funding review: material risks, remediation cost estimate, and historical trend line across hunts.
0011. **QA team regression brief** — converts each finding into a testable acceptance criterion with negative test cases the QA team can add to their suite.
0012. **Support team triage card** — gives customer-support a one-card summary per finding: user-visible symptoms, safe scripted response, and escalation trigger.
0013. **PR/crisis comms playbook** — pre-drafts holding statements and FAQ answers for each critical finding in case of public disclosure or press inquiry.
0014. **Data-protection officer (DPO) memo** — flags findings touching personal data with GDPR article references, data-subject risk assessment, and 72-hour notification evaluation.
0015. **Internal red-team handoff doc** — packages findings as starting points for human red teams: confirmed footholds, unexplored branches, and suggested next objectives.
0016. **Blue-team detection brief** — for each finding emits Sigma/YARA-style detection logic candidates, log sources to query, and IOC lists derived from the hunt traffic.
0017. **Third-party vendor risk note** — when a finding lives in a vendor component, generates a vendor-facing security questionnaire response and remediation request letter.
0018. **Pen-test peer review checklist** — creates a reviewer-facing checklist so a second tester can verify coverage, evidence quality, and severity calls before the report ships.
0019. **Executive risk heat statement** — renders portfolio-level heat statements ("3 critical paths expose payment flows") with business-capability impact rather than CVE-style listings.
0020. **Developer-onboarding security primer** — turns the hunt's findings into a team-specific secure-coding primer showing the team's own past mistakes as teaching examples.
0021. **Threat-model update proposal** — proposes concrete updates to the target's threat model (new trust boundaries, assets, abuse cases) derived from confirmed findings.
0022. **Risk-acceptance memo generator** — for findings the team may defer, drafts a formal risk-acceptance document with compensating controls and expiry review dates.
0023. **Security champion briefing kit** — produces a slide-and-script kit for embedded security champions to present the hunt results to their squads.
0024. **CISO weekly rollup** — aggregates the hunt into the CISO's weekly format: new criticals, aging findings, MTTR movement, and budget asks tied to findings.
0025. **Founder-mode blunt summary** — a deliberately plain-spoken variant for startup founders: what's broken, what it costs if exploited, what to fix first this week.
0026. **Procurement security annex** — generates the security annex for RFP responses citing the hunt's verified controls and remediated findings as evidence.
0027. **Bug-bounty triager digest** — reformats findings for internal triage teams with duplicate-likelihood scores and canonical-severity recommendations.
0028. **Incident-response pre-brief** — converts critical findings into IR tabletop scenarios: "if this were exploited tonight, here's the first 60 minutes" playbooks.
0029. **Accessibility-team variant** — reports the PDF/HTML output's own accessibility conformance for teams required to distribute accessible documents internally.
0030. **Data-science risk export** — emits findings as a structured dataset (features per finding) so the client's data team can train internal risk models.
0031. **Finance/quantified-risk sheet** — attaches FAIR-model loss estimates (primary + secondary loss, annualized) per finding for finance-owned risk registers.
0032. **HR/people-risk note** — for social-engineering-adjacent findings, produces a training-focused note for HR with safe example lures and awareness metrics.
0033. **Mobile-team variant** — when findings touch mobile surfaces, generates a mobile-specific report with platform (iOS/Android) severity nuance and store-policy risk.
0034. **API-consumer advisory** — for API findings, drafts the advisory the client sends to API consumers: deprecation timelines, migration steps, and breaking-change notices.
0035. **Open-source maintainer disclosure** — when the flaw is in an OSS dependency, prepares a responsible-disclosure package formatted for the upstream maintainer.
0036. **Regulator examination binder** — assembles findings into the exact binder structure a named regulator (OCC, FCA, MAS) expects for a supervisory exam.
0037. **Cyber-tabletop inject pack** — turns the top findings into tabletop exercise injects with facilitator notes and expected participant decisions.
0038. **M&A technical appendix** — a due-diligence appendix grading the target's code security with remediation liability estimates for deal pricing.
0039. **Site-reliability error-budget note** — frames availability-impacting findings against the team's error budget with burn-rate style urgency language.
0040. **Accessibility of evidence note** — ensures every screenshot and diagram in the report carries alt-text and long descriptions for screen-reader users.
0041. **Multi-subsidiary rollup** — when one hunt covers several brands/subsidiaries, splits findings per entity with per-entity risk scores and local contacts.
0042. **Franchisee/partner advisory** — produces a partner-safe variant that discloses only the partner's exposure slice with joint-remediation steps.
0043. **Board-deck slide exporter** — auto-builds a 5-slide board deck (posture, top risks, trend, ask, roadmap) directly from the report data model.
0044. **Standup-ready daily delta** — emits a 3-bullet standup update ("2 new highs, 1 verified fix, 1 retest pending") for embedding in team rituals.
0045. **All-hands security minute** — drafts a 60-second all-hands script translating the hunt into one memorable lesson for the whole company.
0046. **New-hire security orientation snippet** — converts the most instructive finding into a 5-minute onboarding story with the lesson and the fix.
0047. **Customer trust-center update** — generates the public trust-center changelog entry summarizing the hunt's outcome without sensitive detail.
0048. **Pen-test scope-gap disclosure** — honestly lists what the hunt could NOT cover (authenticated areas, out-of-scope hosts) as a scope-gap appendix per audience.
0049. **Severity-appeal response template** — pre-writes the evidence-backed response for when a client disputes a severity rating, with the scoring rationale attached.
0050. **False-positive concession note** — a gracious, evidence-linked template for withdrawing a finding the client proves invalid, preserving trust.
0051. **Finding-merge explanation** — when duplicate or overlapping findings merge, generates a plain-language note explaining the merge to each affected owner.
0052. **Split-finding justification** — when one observation splits into multiple findings, documents the split rationale so owners don't double-count.
0053. **Ageing-finding nudge letter** — auto-drafts polite escalation nudges for findings past SLA, escalating tone per overdue tier, addressed to the right owner.
0054. **Remediation kudos report** — a positive variant celebrating the fastest-fixed findings and teams, usable in internal security newsletters.
0055. **Security debt statement** — frames unresolved findings as accruing security debt with interest-rate metaphors and payoff prioritization for engineering leadership.
0056. **Threat-intel consumer brief** — packages the hunt's TTPs and IOCs for the client's threat-intel team in STIX-flavored structure with confidence ratings.
0057. **Fraud-team variant** — for business-logic findings, writes the fraud-team edition: abuse scenarios, transaction monitoring rules, and loss-per-day estimates.
0058. **Privacy-engineering variant** — isolates findings with privacy impact and rewrites them for privacy engineers with data-flow diagrams and minimization advice.
0059. **Safety-team variant (trust & safety)** — for user-safety findings (harassment vectors, CSAM-adjacent gaps), formats for trust & safety with policy references.
0060. **Platform-abuse brief** — converts rate-limit/bot findings into an abuse-team brief with bot-signature samples and mitigation tiers.
0061. **Payments-team PCI note** — for payment-flow findings, emits a payments-team note with card-data exposure analysis and acquirer-notification guidance.
0062. **Infra-team network brief** — translates network-layer findings into firewall/WAF/edge-config change tickets with exact rule syntax.
0063. **Identity-team IAM brief** — packages auth findings for the IAM team with token-lifecycle diagrams and session-policy recommendations.
0064. **Data-team warehouse note** — for findings exposing analytics/BI surfaces, writes the data-team note with query-audit and access-review steps.
0065. **Marketing-site variant** — when findings hit marketing pages, produces a marketer-readable note (SEO/brand impact, CMS fix steps) without exploit detail.
0066. **Executive voice memo script** — generates a 2-minute spoken script so the CISO can brief the CEO verbally with the exact numbers and asks.
0067. **One-line risk ticker** — a single-line-per-finding ticker format for dashboards and status screens ("CRITICAL: unauth RCE on checkout — fix ETA 48h").
0068. **Regional variant pack** — splits the report per operating region with local regulation callouts (EU/US/APAC) and regional owner assignments.
0069. **Language-simplified variant** — a plain-language edition at ~8th-grade reading level for non-technical stakeholders, verified against readability scores.
0070. **Technical-glossary appendix** — auto-builds a glossary defining every security term used in the report, linked from first use in HTML editions.
0071. **Acronym expander** — scans the report and expands every acronym on first use with a linked acronym index for mixed audiences.
0072. **Reading-path guide** — inserts a "how to read this report" page routing each role (exec, dev, auditor) to their sections and estimated reading time.
0073. **Decision-log appendix** — records every severity and scoping decision made during the hunt with rationale, so reviewers can audit judgment calls.
0074. **Assumption register** — lists all assumptions the hunt operated under (credentials provided, scope interpretations) with impact-if-wrong notes.
0075. **Methodology attestation page** — a signed-style page describing tools, techniques, and coverage methodology for clients who must evidence process.
0076. **Tester-credential disclosure** — documents exactly which test accounts, API keys, and sessions were used, with a revocation checklist post-hunt.
0077. **Clean-desk certificate** — certifies that test data, payloads, and artifacts were purged from the target, with per-system confirmation notes.
0078. **Non-disclosure footer pack** — embeds the correct confidentiality footer per recipient tier (internal, client-confidential, public-safe).
0079. **Report audience selector UI** — an interactive picker in the HTML report letting the reader choose their role and re-rendering depth accordingly.
0080. **Progressive disclosure layers** — structures each finding in three expandable layers (headline → technical → raw evidence) so every audience self-serves.
0081. **Persona-based navigation** — the HTML report offers persona tabs (Executive, Developer, Auditor) that reorder and filter content per persona.
0082. **Print-optimized stakeholder set** — generates a paginated print bundle with per-audience cover pages, table of contents, and page-number cross-refs.
0083. **Email-ready executive summary** — renders the summary as a self-contained HTML email with inline styles that survives Outlook/Gmail rendering.
0084. **Chat-ops digest card** — a compact card format for Slack/Teams posting: severity emoji, one-line impact, owner, link to full finding.
0085. **SMS-critical alert text** — a 160-character critical-finding alert template with severity, asset, and report link for on-call paging.
0086. **Quarterly business review pack** — aggregates hunts into a QBR deck: posture trend, program ROI, benchmark vs industry, next-quarter plan.
0087. **Annual security review chapter** — writes the year's hunts into a board-level annual review chapter with year-over-year risk movement.
0088. **Post-incident lessons appendix** — when a finding matches a past incident, appends the incident's lessons-learned with links to the postmortem.
0089. **Peer-benchmark insert** — inserts anonymized industry benchmark bars next to the client's metrics (findings per asset, MTTR) for context.
0090. **Maturity-model mapping** — maps the hunt outcome onto a security maturity model (e.g., BSIMM/SAMM) showing which practices the findings implicate.
0091. **OKR-linked security objectives** — converts top findings into proposed quarterly OKRs with measurable key results for the security team.
0092. **Budget-justification worksheet** — attaches a worksheet translating findings into tooling/headcount budget asks with cost-of-inaction math.
0093. **Vendor-comparison evidence sheet** — formats results as evidence for comparing scanner vendors, with per-finding detection-attribution notes.
0094. **Pen-test vs agent comparison** — a variant comparing this autonomous hunt's coverage and findings against the client's last human pen-test scope.
0095. **Continuous-assurance statement** — for retainer clients, frames the report as one pulse in a continuous assurance program with cumulative posture.
0096. **Hunt-coverage map** — a visual sitemap-style coverage map showing tested vs untested routes per audience, with plain-language legend.
0097. **Confidence-graded findings list** — presents every finding with an explicit confidence grade (confirmed/probable/suspected) and what would raise it.
0098. **Negative-results report** — when a hunt finds little, produces an honest negative-results report detailing effort, coverage, and why assurance is still limited.
0099. **Scope-extension proposal** — from coverage gaps, drafts a scoped proposal for the follow-on hunt with estimated effort and expected value.
0100. **Audience-feedback capture form** — embeds a per-section feedback widget in the HTML report so readers can flag unclear parts, feeding report-quality metrics.
