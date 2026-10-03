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
0101. **Collapsible repro-step accordions** — each finding's reproduction steps render as expandable stages (setup, payload, observation) so readers drill in without losing the narrative.
0102. **Embedded request/response viewer** — an in-report HTTP inspector with syntax-highlighted raw request/response, headers tab, and copy-as-curl button per evidence item.
0103. **Payload diff highlighter** — shows the exact bytes that differ between benign and malicious requests with inline diff coloring for instant comprehension.
0104. **Finding relationship graph** — an interactive force-directed graph linking findings by shared asset, shared root cause, and chain membership, clickable to jump to each finding.
0105. **Hunt timeline visualization** — a zoomable timeline of the hunt: recon milestones, first detection, confirmation, chaining attempts, plotted against elapsed time.
0106. **Attack-path stepper** — for chained findings, a step-by-step visual path (node → edge → node) with per-step evidence thumbnails and "replay this step" links.
0107. **Severity distribution sunburst** — an interactive sunburst chart breaking findings by severity, then category, then asset, with drill-down counts.
0108. **Asset risk heatmap** — a treemap of tested assets sized by exposure and colored by max severity, hoverable for finding lists.
0109. **Evidence carousel** — screenshots, response snippets, and terminal outputs per finding presented as a swipeable carousel with captions and timestamps.
0110. **Annotated screenshot overlays** — report screenshots carry numbered callouts and arrows explaining exactly what to look at, toggleable between clean and annotated views.
0111. **Live severity recalculator** — an interactive CVSS control panel where readers tweak metrics (e.g., scope changed) and watch the severity update live.
0112. **Scope coverage explorer** — a clickable sitemap tree of the target where each node shows tested endpoints, findings count, and untested branches.
0113. **Parameter playground panel** — for injection findings, an embedded panel showing the vulnerable parameter, the payload used, and a sanitized safe-test input.
0114. **Chain simulator widget** — lets the reader toggle individual findings in a chain on/off to see how the composite impact score changes.
0115. **Remediation progress tracker** — an in-report checklist per finding (acknowledged → fixing → retest requested → verified) that syncs with the client's ticketing system.
0116. **Comment threads per finding** — embedded discussion threads so engineers and the hunt team can debate a finding inside the report itself.
0117. **In-report Q&A assistant** — a chat widget scoped to the report that answers "why is this critical?" by citing the finding's evidence.
0118. **Evidence authenticity badge** — each evidence block carries a hash, timestamp, and collection-method tag with a one-click integrity verification.
0119. **Before/after fix preview** — an interactive slider comparing the vulnerable response vs the expected fixed response side by side.
0120. **Fix-effort estimator dial** — an interactive dial per finding where readers adjust team size and familiarity to get a fix-time estimate range.
0121. **Business-impact scenario switcher** — toggles between impact scenarios (single user, mass exploitation, targeted attack) with recalculated loss estimates.
0122. **Compliance overlay toggle** — overlays framework control badges (PCI Req 6.5.1, SOC2 CC6.1) onto each finding, toggleable per framework.
0123. **Keyboard-navigable report** — full keyboard navigation with a command palette (jump to finding, filter by severity) for power readers.
0124. **Deep-linkable findings** — every finding, evidence item, and section gets a stable URL anchor so teams can link precisely in tickets and chat.
0125. **Reading-progress indicator** — a subtle progress rail showing how much of the report has been viewed, with "unread criticals" highlighting.
0126. **Print-view toggle** — one click flattens all interactive elements into a clean paginated print layout without losing content.
0127. **Dark/light report theme** — the HTML report ships with theme switching that preserves contrast ratios for charts and code blocks.
0128. **Font-size and density controls** — reader-adjustable typography density (compact/comfortable) persisted per user for long reports.
0129. **Finding comparison view** — select any two findings to compare side by side: severity, evidence, affected code, and remediation steps.
0130. **Bulk-evidence download tray** — a tray where readers tick evidence items across findings and download them as one ZIP with a manifest.
0131. **Evidence redaction preview** — interactive toggle showing exactly what the redacted vs full evidence looks like before sharing externally.
0132. **Timeline scrubber for PoC** — for multi-request exploits, a scrubber that steps through each request in order with the response shown per step.
0133. **Network waterfall of attack** — renders the exploit's request sequence as a DevTools-style waterfall with timing and size per request.
0134. **DOM-state snapshots** — for XSS findings, captures DOM snapshots before/after payload execution with the injected node highlighted.
0135. **Console-log evidence pane** — embeds the browser console output captured during PoC execution as a filterable log pane.
0136. **Cookie/session inspector** — an interactive viewer of session artifacts captured during auth findings (tokens decoded, flags shown).
0137. **JWT decoder widget** — any JWT in evidence gets an inline decode widget showing header/payload claims with risk flags.
0138. **Certificate transparency pane** — for TLS findings, an embedded view of the certificate chain with weak-link highlighting.
0139. **Header-security grader** — an interactive panel grading the target's security headers per endpoint with fix snippets.
0140. **CSP evaluator widget** — pastes the observed Content-Security-Policy into an inline evaluator showing bypass paths found during the hunt.
0141. **CORS policy visualizer** — diagrams the observed CORS behavior (origins allowed, credentials) against the attacker's origin used.
0142. **Rate-limit probe chart** — plots the rate-limit probing results as a chart showing where throttling kicked in (or didn't).
0143. **Fuzzing coverage dial** — shows parameter fuzzing coverage per endpoint as a dial with untested-parameter callouts.
0144. **Wordlist hit explorer** — browsable list of discovered paths/parameters from wordlists with status codes and finding links.
0145. **Subdomain map** — an interactive map of discovered subdomains with tech fingerprints and per-host finding counts.
0146. **Technology fingerprint cards** — flip-cards per detected technology showing version, known CVEs, and hunt relevance.
0147. **Dependency risk cards** — for vulnerable libraries found, cards with CVE, fixed version, and upgrade diff notes.
0148. **Git-history evidence links** — where a finding traces to a commit, an embedded mini-view of the blame/commit with the introducing change.
0149. **Code-context viewer** — shows the vulnerable code region with surrounding context lines and data-flow arrows from source to sink.
0150. **Taint-flow diagram** — an interactive data-flow diagram from untrusted input to sink for injection findings, steppable.
0151. **Call-graph snippet** — renders the relevant call graph around the vulnerable function as an explorable mini-graph.
0152. **Stack-trace explorer** — captured stack traces render as collapsible frames with frame-level code context.
0153. **Environment matrix** — a table showing which environments (prod/staging/dev) each finding reproduces in, with per-env evidence links.
0154. **Browser matrix badges** — for client-side findings, badges showing reproduction across tested browsers/versions.
0155. **Mobile-device matrix** — for mobile-relevant findings, a matrix of tested OS versions and devices with results.
0156. **Regression-guard panel** — each finding embeds the regression test snippet that would catch a reintroduction, with CI-ready formatting.
0157. **Threat-actor lens switcher** — re-renders impact narratives through different actor lenses (script kiddie, organized crime, insider, nation-state).
0158. **Likelihood adjuster** — readers adjust exploit-likelihood assumptions (public exploit exists, asset internet-facing) and see risk reorder live.
0159. **Cost-of-delay calculator** — interactive: input days-to-fix, get expected-loss accrual per finding from the quantified model.
0160. **Fix-priority drag board** — a kanban-style board in the report where stakeholders drag findings into sprint buckets, exporting the plan.
0161. **Owner-assignment picker** — assign each finding to a team/owner inside the report, generating the RACI table automatically.
0162. **SLA countdown chips** — live countdown chips per finding showing time remaining against the severity-based SLA policy.
0163. **Escalation-path diagram** — a flowchart per severity tier showing who gets notified when and through which channel.
0164. **Notification preview** — shows exactly what the Slack/email/page alert for each finding looks like before enabling notifications.
0165. **Report diff highlighter** — when viewing a new version, changed sections glow with inline diffs against the previous version.
0166. **Annotation layer** — readers can pin private or shared annotations to any paragraph, with annotation export for review meetings.
0167. **Highlight-and-share** — select any report text to generate a shareable deep link with the selection highlighted for the recipient.
0168. **Citation generator** — one-click generation of a formal citation for any finding (for audit papers) in APA/IEEE-ish security format.
0169. **Export-selection tool** — tick sections across the report to build a custom sub-report (e.g., "only payment findings") and export it.
0170. **Table-of-contents minimap** — a scroll-linked minimap of the report structure with finding severity dots for orientation.
0171. **Search-with-semantics** — report search that understands "auth issues on checkout" and returns ranked findings, not just keyword hits.
0172. **Filter-preset saver** — save filter combinations (e.g., "critical + payments + unowned") as named views shareable via URL.
0173. **Finding status pipeline** — visual pipeline (new → triaged → fixing → retesting → closed) with counts, updated from the client's tracker.
0174. **Stale-evidence warning** — flags evidence older than the retest window with a "re-verify before citing" banner.
0175. **Cross-hunt finding linker** — links a finding to its appearances in previous hunts, showing recurrence history inline.
0176. **Duplicate-cluster viewer** — shows which reported items were merged as duplicates and the evidence for the merge decision.
0177. **Confidence-meter per claim** — every major claim in the narrative carries a confidence meter with the supporting evidence count.
0178. **Methodology trace links** — each finding links back to the methodology step and tool/technique that produced it.
0179. **Tool-attribution footer** — per finding, which engines contributed (recon, detector, PoC) with their version numbers for reproducibility.
0180. **Reproducibility checklist** — an interactive checklist confirming each artifact needed to reproduce is present (request, payload, session, environment).
0181. **Offline evidence pack** — one-click download of a self-contained offline bundle (HTML + evidence) that works without network.
0182. **Evidence chain-of-custody log** — a tamper-evident log of who accessed or exported each evidence item, viewable by the report owner.
0183. **Watermark preview toggle** — shows how the recipient watermark renders on every page before distribution.
0184. **Recipient-view simulator** — preview the report exactly as a specific recipient role sees it (with their redactions applied).
0185. **Translation switcher** — in-report language switcher that re-renders the narrative in 20 languages while keeping evidence in source language.
0186. **Glossary hover definitions** — hovering any security term shows the glossary definition without leaving the reading position.
0187. **Acronym tooltip expander** — first-use acronyms expand on hover with a link to the full acronym index.
0188. **Audio narration toggle** — the executive summary can be played as generated narration for accessibility and commute listening.
0189. **Video-summary embed slot** — reserves an embed slot for the auto-generated video PoC summary at the top of critical findings.
0190. **Executive dashboard embed** — the report header embeds a live dashboard (posture score, open criticals, MTTR) fed by the client's tracker.
0191. **Risk-trend sparkline** — per-asset sparklines showing finding counts across the last N hunts inline in the asset table.
0192. **Benchmark bar overlays** — industry benchmark bars overlaid on the client's severity distribution for instant context.
0193. **What-if remediation planner** — check off findings as "planned fixed" to preview the resulting posture score and residual risk.
0194. **Dependency-upgrade planner** — interactive table of vulnerable dependencies with target versions and breaking-change risk flags.
0195. **Sprint-capacity fitter** — input sprint capacity in story points; the report suggests which findings fit, ordered by risk reduction per point.
0196. **Risk-acceptance workflow** — initiate a risk-acceptance request for a finding from inside the report, routing to the approver with context attached.
0197. **Exception-request form** — embedded exception/waiver request for findings that can't be fixed by SLA, with auto-filled justification draft.
0198. **Retest-request button** — per finding, a button that packages the repro bundle and files a retest request with the hunt team.
0199. **Fix-verification uploader** — lets engineers upload their patch or deploy notes against a finding, triggering an automated re-verification hunt.
0200. **Report-quality rating widget** — a one-click rating per section ("was this clear?") feeding the report engine's continuous improvement loop.
0201. **Scripted browser-replay PoC videos** — auto-records the exploit as a narrated screen capture by replaying the exact request sequence in a headless browser with step captions.
0202. **Narrated exploit voiceover** — generates a spoken narration track explaining each PoC step in plain language, synced to the replay timeline.
0203. **GIF exploit snippets** — produces short looping GIFs of the key 5-second exploit moment for embedding in tickets and chat where video is heavy.
0204. **Frame-by-frame PoC storyboard** — renders the exploit as a comic-style storyboard with annotated frames for reports that must stay static/printable.
0205. **Multi-angle PoC capture** — records attacker view and victim view side-by-side (e.g., stored XSS: injector screen + victim session) in one split-screen video.
0206. **Terminal-session recordings** — captures the PoC's terminal session as an asciinema-style replayable recording embedded in the HTML report.
0207. **Packet-capture evidence clips** — attaches filtered PCAP excerpts of the exploit traffic with a built-in packet viewer highlighting malicious packets.
0208. **Before/after screen morph** — a video morph transitioning from the vulnerable UI state to the exploited state to make impact visceral.
0209. **Exploit timeline captions** — every PoC video carries burned-in captions with timestamps, request numbers, and severity callouts for silent viewing.
0210. **Chaptered PoC videos** — long exploit videos get chapters (recon, weaponization, exploitation, impact) with clickable chapter navigation.
0211. **Slow-motion payload moment** — the critical payload-delivery frame is replayed in slow motion with zoom to make the technique unmistakable.
0212. **Redacted-for-sharing video cut** — auto-produces a second video cut with secrets, tokens, and internal hostnames blurred for external sharing.
0213. **Video evidence hashing** — each generated video is hashed at creation with the hash printed in the report for chain-of-custody.
0214. **PoC video transcript** — auto-generates a full text transcript of the narrated PoC for accessibility and searchability.
0215. **Multilingual video subtitles** — subtitles the narrated PoC in 20 languages using the security-terminology glossary for consistent translation.
0216. **Silent-mode storyboard fallback** — environments blocking video get an auto-generated frame storyboard with the same narration as text.
0217. **Interactive video hotspots** — clickable hotspots overlaid on the PoC video that pause and explain the technique at that moment.
0218. **Exploit replay sandbox link** — a link that replays the exploit steps in a safe sandbox viewer without executing against the real target.
0219. **Side-by-side code/video sync** — the vulnerable code scrolls in sync with the video moment that exploits it, linking cause and effect visually.
0220. **Impact-demonstration montage** — a 30-second montage per critical finding showing data accessed or actions performed, suitable for executive viewing.
0221. **Voiceover tone selector** — choose narration tone (neutral technical, executive-friendly, training-style) when generating the PoC voiceover.
0222. **Avatar-narrated PoC** — the Infinity AI avatar narrates the PoC video on-screen, pointing at relevant UI regions during explanation.
0223. **Whiteboard explainer generator** — converts the attack chain into an animated whiteboard-style explainer video for training use.
0224. **Attack-flow animation** — an animated diagram showing request flow from attacker through the app to the data store, with the flaw highlighted mid-flow.
0225. **3D attack-surface flythrough** — a stylized 3D visualization flying through the target's asset graph, pausing at vulnerable nodes.
0226. **Audio-only PoC briefings** — generates a podcast-style 3-minute audio briefing per critical finding for on-call listening.
0227. **Hunt highlight reel** — a 2-minute sizzle reel of the hunt's top moments (discoveries, confirmations) for program showcase purposes.
0228. **Fix-demo videos** — after remediation, auto-records a "fix confirmed" video showing the same PoC steps now failing safely.
0229. **Regression-test screen recordings** — records the regression test executing against the fixed build as evidence for the retest report.
0230. **Side-channel visualization** — for timing attacks, renders response-time charts as animated bars synced to the request replay.
0231. **Blind-injection visualizer** — animates blind SQLi/XSS exfiltration bit-by-bit as it happens, making invisible exfiltration visible.
0232. **Race-condition race replay** — visualizes race-condition exploitation with parallel request timelines converging on the winning request.
0233. **SSRF network-path animation** — animates the SSRF request's path from the app server into the internal network with reached hosts lighting up.
0234. **IDOR traversal map animation** — animates the IDOR object-ID enumeration sweeping across the ID space with hit markers.
0235. **Privilege-escalation ladder** — a vertical ladder animation showing each privilege step gained, from unauthenticated to admin.
0236. **Session-hijack flow video** — split-screen showing token theft on the left and victim-session takeover on the right in real time.
0237. **CSRF one-click demo** — records the single-click CSRF exploitation from the victim's perspective with the forged request revealed.
0238. **Clickjacking overlay demo** — video showing the invisible iframe overlay technique with the overlay made visible via highlight.
0239. **File-upload bypass montage** — shows each bypassed file-type check in sequence with the server's responses, ending in execution proof.
0240. **XXE exfiltration viewer** — visualizes the XXE payload's outbound entity resolution with the exfiltrated file content revealed.
0241. **SSTI render-chain video** — shows the template-injection payload escalating from math evaluation to command output step by step.
0242. **Deserialization gadget replay** — animates the deserialization payload's object graph unfolding into code execution.
0243. **JWT forgery walkthrough** — video stepping through header/payload edits, re-signing with the cracked key, and privileged access.
0244. **OAuth flow hijack animation** — animates the OAuth redirect flow with the attacker's interception point flashing.
0245. **WebSocket hijack demo** — records the WebSocket message interception and injection with the message frames annotated.
0246. **GraphQL introspection tour** — video tour of the exposed GraphQL schema exploration leading to the sensitive query.
0247. **API mass-assignment demo** — shows the extra-field injection and the resulting privilege change in the admin panel.
0248. **Business-logic abuse reel** — compiles the business-logic exploit (coupon stacking, price tampering) into a narrative demo.
0249. **Payment-tampering proof clip** — a tightly-scoped clip proving price manipulation with the final charged amount visible.
0250. **Account-takeover end-to-end film** — the full ATO chain (enumeration → reset poisoning → takeover) as one continuous narrated film.
0251. **Data-exfiltration counter** — a live counter overlay in the video showing records exfiltrated during the demo, capped at a safe sample.
0252. **Screenshot contact-sheet** — a printable contact sheet of all PoC screenshots with timestamps and finding references.
0253. **Evidence thumbnail index** — a visual index page of every evidence thumbnail in the report for quick scanning.
0254. **Zoomable hi-res evidence** — screenshots stored at full resolution with deep-zoom so fine details (tokens, DOM) stay legible.
0255. **Responsive-video embeds** — PoC videos embed responsively with lazy loading so large reports stay fast on mobile.
0256. **Video-chapter deep links** — every video chapter gets a deep link so a ticket can point at "exploitation starts here".
0257. **PoC reproducibility scorecard** — each video carries a scorecard rating how reliably the PoC replays (deterministic/flaky/environment-dependent).
0258. **Environment-fingerprint slate** — videos open with a slate showing browser, target build, and timestamp for evidentiary context.
0259. **Dual-language narration tracks** — PoC videos ship with two narration audio tracks (e.g., English + Hindi) switchable in-player.
0260. **Sign-language overlay option** — critical PoC videos can include a sign-language interpreter overlay for accessibility compliance.
0261. **Descriptive-audio track** — an additional audio track describing on-screen actions for visually impaired reviewers.
0262. **Video-evidence retention policy** — auto-applies the client's retention policy to video evidence with expiry and purge scheduling.
0263. **Bandwidth-adaptive streaming** — PoC videos stream adaptively so reviewers on poor connections still get the key frames.
0264. **Offline video bundle** — packages all PoC videos with the offline evidence pack in a compressed, playable format.
0265. **Video-to-ticket attachment** — one-click attach of the redacted PoC clip to the corresponding JIRA/GitHub issue.
0266. **Executive cut auto-edit** — generates a 60-second executive cut per critical finding: impact first, technique summarized, fix preview last.
0267. **Training cut auto-edit** — generates a longer training cut with pauses explaining each technique for secure-coding workshops.
0268. **Auditor cut auto-edit** — a dry, evidence-first cut ordered as: control, test procedure, observation, verdict — no narrative flair.
0269. **Bounty-platform video formatter** — re-encodes PoC videos to each bounty platform's preferred specs (HackerOne/Bugcrowd/Intigriti) automatically.
0270. **Thumbnail storyboard picker** — lets the report author pick the video thumbnail frame that best represents the finding.
0271. **Caption-style presets** — caption styling presets (broadcast, minimal, technical) applied consistently across all PoC videos.
0272. **Lower-third finding IDs** — every PoC video burns in the finding ID as a lower-third so clips stay attributable when shared alone.
0273. **End-card remediation CTA** — videos end with an end-card summarizing the fix and linking to the remediation section.
0274. **Bloopers-free guarantee pass** — an automated review pass trims dead air, failed attempts, and mistyped payloads from PoC recordings.
0275. **Multi-take selector** — when the PoC was recorded multiple times, the author picks the cleanest take with failed takes archived.
0276. **Voice-clone disclosure label** — any AI-narrated audio is labeled as synthetic narration to maintain evidentiary honesty.
0277. **Evidence-tamper seals** — video files carry embedded tamper-evident seals verifiable with a one-click checker.
0278. **Cross-finding montage builder** — select multiple findings to build a combined montage showing how they chain, for the chain section.
0279. **Hunt-narrator director mode** — a guided mode where the report author records voice notes per section and the system assembles the final narration.
0280. **Live-PoC webinar exporter** — packages the PoC videos and slides into a webinar-ready deck for presenting findings to the client live.
0281. **Q&A timestamp mapper** — maps audience questions from a findings-review call to video timestamps for follow-up reference.
0282. **GIF-to-video upgrader** — any GIF evidence can be upgraded to a full narrated clip on demand without re-running the hunt.
0283. **Video search indexing** — PoC video transcripts are indexed so report search finds moments ("show me where the token leaks").
0284. **Moment-clip extractor** — select a transcript phrase to extract that exact video moment as a shareable clip.
0285. **Comparison replay (vuln vs fixed)** — plays the vulnerable and fixed recordings side by side in sync for the retest report.
0286. **Performance-overlay mode** — overlays request timing data on the PoC video to show performance-impacting flaws visually.
0287. **Mobile-screen PoC capture** — mobile-relevant PoCs are captured in a device frame with touch indicators for clarity.
0288. **Dark-mode video grading** — PoC videos are color-graded for legibility in both report themes without re-recording.
0289. **Watermarked screener videos** — pre-release video screeners carry per-recipient watermarks and expiry for controlled review.
0290. **Video analytics hooks** — tracks which PoC videos stakeholders actually watch, feeding report-engagement metrics.
0291. **Auto-alt-text for video** — generates detailed alt-text descriptions of each PoC video for screen-reader users.
0292. **Keyframe summary strip** — a filmstrip of keyframes under each video for quick visual scanning without playback.
0293. **Request-to-frame mapper** — click any request in the evidence viewer to jump the video to the frame where it was sent.
0294. **Payload-typing visualizer** — shows the payload being typed character-by-character with syntax coloring for technique clarity.
0295. **Response-diff flash** — the video flashes a highlight on the exact response bytes that prove the vulnerability.
0296. **Attacker-notebook overlay** — overlays the agent's reasoning notes ("trying boolean-based blind next") as picture-in-picture commentary.
0297. **Confidence annotation track** — a subtitle track stating the confidence of each demonstrated step (confirmed vs inferred).
0298. **Scope-boundary markers** — video chapters mark where in-scope testing ended so reviewers see no out-of-scope actions were taken.
0299. **Cleanup-verification tail** — each PoC video ends with a short segment proving test artifacts were cleaned from the target.
0300. **Video-evidence manifest** — a machine-readable manifest listing every video, its hash, duration, finding linkage, and redaction status.
0301. **CVSS 4.0 vector auto-builder** — derives the full CVSS 4.0 vector from finding evidence (attack vector from exposure, privileges from auth context) with per-metric justification traces.
0302. **CVSS 3.1 legacy vectors** — also emits CVSS 3.1 vectors for clients whose tooling hasn't migrated, with a mapping note explaining deltas.
0303. **EPSS probability enrichment** — attaches the Exploit Prediction Scoring System percentile per finding type to prioritize what's likely to be exploited next.
0304. **CISA KEV cross-check** — flags findings matching CISA Known Exploited Vulnerabilities catalog entries with binding-operational-directive urgency notes.
0305. **SSVC decision-tree scoring** — runs each finding through the Stakeholder-Specific Vulnerability Categorization tree producing track/outcome decisions for prioritization.
0306. **OWASP Risk Rating calculator** — scores findings with the OWASP risk-rating methodology (threat agent, vulnerability, technical/business impact factors) shown factor-by-factor.
0307. **FAIR loss-exposure model** — builds per-finding FAIR analyses with loss-event frequency and loss-magnitude ranges for finance audiences.
0308. **Business-impact tiering** — tiers findings by business capability impacted (revenue, trust, operations) independent of technical severity.
0309. **Exploit-maturity ladder** — grades each finding on an exploit-maturity ladder (theoretical → PoC → weaponized → in-the-wild) with evidence for the grade.
0310. **Reachability-adjusted scoring** — downgrades or upgrades scores based on measured network reachability (internet-facing vs internal-only) from recon data.
0311. **Authentication-context scoring** — adjusts severity by the privilege level required, measured from the actual session used in the PoC.
0312. **Data-sensitivity multiplier** — multiplies impact when the finding touches PII, credentials, or payment data, classified from observed responses.
0313. **Chained-impact composer** — computes composite scores for finding chains that exceed the sum of parts, with the chain math shown.
0314. **Blast-radius estimator** — estimates affected user/record counts from observed IDs and pagination behavior, with the estimation method disclosed.
0315. **Revenue-at-risk calculator** — for commerce findings, models revenue at risk from cart/payment abuse using the client's order-volume inputs.
0316. **Reputation-risk scorer** — scores reputational impact via a rubric (data type × user count × media likelihood) for comms-team planning.
0317. **Regulatory-fine estimator** — estimates maximum applicable fines per finding under GDPR/CCPA/PCI using the exposure facts, clearly labeled as estimates.
0318. **Remediation-cost estimator** — estimates engineering cost per finding (hours × role rates) so prioritization weighs cost vs risk.
0319. **Risk-reduction-per-point metric** — ranks findings by risk reduced per story point, giving engineering the most efficient fix order.
0320. **Time-to-exploit forecaster** — forecasts median time-to-exploitation per finding class from threat-intel feeds to justify SLA urgency.
0321. **Severity-confidence matrix** — presents severity alongside evidence confidence in a 2D matrix so "critical but uncertain" is visually distinct.
0322. **Disputed-severity tracker** — logs client severity disputes per finding with both rationales and the final agreed rating.
0323. **Severity-drift monitor** — watches threat feeds post-report and notifies when a finding's real-world exploitability changes its effective priority.
0324. **Environmental-score tuner** — lets clients set their environmental CVSS metrics (confidentiality requirement etc.) once and applies them to all findings.
0325. **Temporal-score decay** — shows how temporal metrics (exploit code maturity) evolve, with a "re-score me in 30 days" schedule.
0326. **Asset-criticality weighting** — weights findings by asset criticality tags from the client's CMDB import, reordering the fix queue.
0327. **Crown-jewel proximity score** — scores findings by graph distance to crown-jewel assets, surfacing unglamorous bugs near critical data.
0328. **Lateral-movement potential grade** — grades each foothold finding on usefulness for lateral movement, guiding network-segmentation fixes.
0329. **Persistence-potential grade** — grades whether the flaw enables persistent access (backdoor accounts, stored payloads) for IR prioritization.
0330. **Detection-difficulty rating** — rates how hard each attack would be to detect in logs, informing monitoring investments.
0331. **User-interaction dependency flag** — explicitly flags findings needing user interaction (phishing-adjacent) vs fully remote, per CVSS UI metric.
0332. **Scope-change sensitivity** — shows how the score changes if scope is "changed" vs "unchanged" with the reasoning for the call.
0333. **Attack-complexity evidence** — documents the measured attack complexity (requests needed, timing precision) as scoring evidence.
0334. **Privileges-required proof** — cites the exact session/role used in the PoC as the privileges-required justification.
0335. **Safety-impact flag** — flags findings with potential physical-safety impact (IoT, healthcare, automotive) for special handling.
0336. **Automatable-exploitation flag** — marks findings exploitable by fully automated scanning/worms, raising urgency for internet-facing assets.
0337. **Value-density score** — scores the value an attacker gains per unit effort, highlighting efficient attack paths.
0338. **Fix-verification confidence** — after retest, scores confidence that the fix is complete (not just the PoC blocked) with residual-risk notes.
0339. **Partial-fix detector** — detects when a fix blocks the demonstrated PoC but leaves variants open, scoring the residual exposure.
0340. **Regression-risk score** — estimates the likelihood of the finding's reintroduction based on code-churn and test-coverage signals.
0341. **Comparative severity normalizer** — normalizes severities across hunts and scanners so trends aren't skewed by methodology changes.
0342. **Severity-appeal evidence pack** — auto-assembles the evidence bundle backing a severity rating for dispute resolution.
0343. **Board-risk appetite mapper** — maps findings against the board's stated risk appetite thresholds, flagging appetite breaches.
0344. **Risk-register exporter** — exports findings as formal risk-register entries (risk description, owner, treatment, residual) in spreadsheet form.
0345. **Heat-map matrix builder** — builds 5x5 likelihood×impact heat maps per business unit from the finding set.
0346. **Monte-Carlo loss simulation** — runs Monte-Carlo simulations over the FAIR inputs to produce loss-exceedance curves per finding.
0347. **Single-loss-expectancy table** — computes SLE/ARO/ALE per finding for clients using classic quantitative risk formulas.
0348. **Cyber-insurance deductible mapper** — maps findings to policy deductibles and sublimits to show what's actually covered.
0349. **Security-investment ROI sheet** — compares remediation cost vs expected loss reduction to justify the security budget line by line.
0350. **Opportunity-cost framing** — frames deferred fixes as accruing expected loss per week, making delay costs explicit.
0351. **Peer-percentile ranking** — ranks the client's finding density against anonymized peers, percentile-styled for executive consumption.
0352. **Industry-loss benchmark** — cites industry loss data for the finding's vulnerability class to ground impact claims.
0353. **CVE-analog mapper** — maps novel findings to the closest public CVEs for comparability, with similarity rationale.
0354. **CWE-weakness clustering** — clusters findings by CWE to reveal systemic weaknesses (e.g., "6/10 findings are CWE-79") with root-cause themes.
0355. **OWASP Top-10 mapper** — maps each finding to OWASP Top 10 (2021) categories with coverage-gap analysis.
0356. **OWASP API Top-10 mapper** — maps API findings to the OWASP API Security Top 10 with per-category counts.
0357. **OWASP Mobile Top-10 mapper** — maps mobile-surface findings to the OWASP Mobile Top 10.
0358. **OWASP LLM Top-10 mapper** — maps AI-feature findings to the OWASP LLM Top 10 for clients shipping AI features.
0359. **MITRE ATT&CK mapper** — tags each finding's exploitation steps with ATT&CK techniques for SOC consumption.
0360. **MITRE D3FEND countermeasure links** — links each ATT&CK technique to D3FEND defensive countermeasures for the blue team.
0361. **NIST CSF 2.0 function mapper** — maps findings to NIST Cybersecurity Framework 2.0 functions/categories for program alignment.
0362. **Kill-chain phase tagger** — tags each finding with the cyber kill-chain phase it enables, showing where defenses should interdict.
0363. **Diamond-model annotations** — annotates key findings with the diamond model (adversary, capability, infrastructure, victim) for intel teams.
0364. **Threat-profile matcher** — matches the finding set against named threat-actor profiles to show which actors could exploit them.
0365. **Exploit-kit availability check** — checks whether public exploit kits cover the finding's class and cites availability in scoring.
0366. **Dark-web chatter monitor** — monitors for chatter about the client's assets post-report and updates exposure priority accordingly.
0367. **Vulnerability-age tracker** — tracks how long each finding class has been known industry-wide ("XSS known since 2000") for urgency framing.
0368. **Zero-day vs n-day labeler** — labels whether each finding is a zero-day in the client's stack or a known-pattern (n-day) issue.
0369. **Patch-lag analyzer** — for dependency findings, shows days between upstream fix release and the client's still-vulnerable version.
0370. **Compensating-control credit** — reduces effective risk scores where verified compensating controls (WAF rules, network isolation) demonstrably blunt impact.
0371. **Defense-in-depth gap finder** — identifies findings where multiple layers failed simultaneously, flagging systemic defense gaps.
0372. **Single-point-of-failure flag** — flags findings where one control is the only barrier, recommending layered fixes.
0373. **Residual-risk statement builder** — drafts the formal residual-risk statement per finding after planned remediation.
0374. **Risk-acceptance threshold checker** — checks each finding against the client's risk-acceptance thresholds, auto-routing exceptions.
0375. **Aggregate-risk composer** — composes portfolio-level risk from individual findings without double-counting shared root causes.
0376. **Correlation-adjusted aggregation** — adjusts aggregate risk for correlated failures (one library → many findings) using the dependency graph.
0377. **Worst-plausible-scenario writer** — writes the worst-plausible (not worst-possible) scenario narrative per critical finding for balanced communication.
0378. **Best-case framing note** — includes the best-case interpretation alongside, preventing both alarmism and complacency.
0379. **Uncertainty-quantifier** — attaches explicit uncertainty ranges to loss estimates with the top drivers of uncertainty listed.
0380. **Sensitivity tornado chart** — shows which input assumptions most affect each finding's loss estimate via tornado charts.
0381. **Scenario-probability labels** — labels each impact scenario with calibrated probability language (likely, plausible, unlikely).
0382. **Pre-mortem prompt pack** — generates pre-mortem prompts ("assume this finding caused a breach in 6 months — what did we miss?") for review meetings.
0383. **Red-team difficulty rating** — rates how hard a human red team would find each bug, informing bounty pricing.
0384. **Bounty-value estimator** — estimates fair bounty payouts per finding using platform data for the client's own bounty program.
0385. **Fix-priority poker deck** — generates planning-poker style cards per finding for team prioritization sessions.
0386. **WSJF prioritization** — applies Weighted Shortest Job First (cost of delay ÷ job size) ranking for SAFe-aligned teams.
0387. **RICE scoring overlay** — overlays RICE (reach, impact, confidence, effort) scores for product-minded prioritization.
0388. **MoSCoW fix bucketing** — buckets findings into Must/Should/Could/Won't-fix-now with rationale for stakeholder sign-off.
0389. **Eisenhower-matrix view** — plots findings on urgent/important quadrants for executive prioritization workshops.
0390. **Kano-model security framing** — frames security fixes in Kano terms (basic expectations vs delighters) for product teams.
0391. **Technical-debt interest table** — shows each finding's "interest rate" (risk accrual per month unfixed) in a sortable table.
0392. **Fix-batch optimizer** — groups findings sharing root causes or files into efficient fix batches with combined effort estimates.
0393. **Parallelization planner** — shows which fixes can proceed in parallel vs which are sequential, with a Gantt-style remediation timeline.
0394. **Critical-path analyzer** — identifies the remediation critical path (longest dependency chain) for program planning.
0395. **Resource-levelling view** — spreads fix effort across teams/weeks to avoid overload, respecting team capacity inputs.
0396. **Milestone-risk burndown** — projects risk burndown against remediation milestones for steering-committee tracking.
0397. **Confidence-interval burndown** — shows best/worst-case risk burndown bands reflecting fix-uncertainty.
0398. **What-fixed-this-week digest** — auto-generates the weekly "what got fixed" digest from tracker updates for morale and visibility.
0399. **Risk-score API** — exposes per-finding and aggregate scores via API so client dashboards consume them programmatically.
0400. **Score-explainability sheet** — a one-page-per-finding explainability sheet tracing every scoring input back to its evidence source.
0401. **Remediation diff generator** — produces a copy-paste code patch for the vulnerable function in the target's detected framework/language, with before/after and test case.
0402. **Framework-aware fix snippets** — emits fix code in the detected stack (e.g., parameterized queries for the specific ORM in use, not generic advice).
0403. **Multi-language fix variants** — when the vulnerable pattern spans services, provides the fix in each detected language (Node, Python, Go, Java).
0404. **Pull-request auto-drafter** — drafts a PR against the client's repo with the fix, tests, and a description linking the finding ID.
0405. **Patch confidence grading** — grades each suggested patch (safe refactor vs behavior-changing) so engineers know the review burden.
0406. **Patch blast-radius note** — analyzes which callers/tests the patch touches, warning about risky broad fixes.
0407. **Alternative-fix options** — offers 2-3 fix strategies per finding (quick mitigation vs proper fix vs architectural) with trade-off tables.
0408. **Quick-mitigation playbook** — a 15-minute mitigation (config toggle, WAF rule, feature flag) buying time before the real fix.
0409. **WAF rule generator** — emits tested ModSecurity/Cloudflare/AWS-WAF rules blocking the demonstrated payloads without breaking legit traffic.
0410. **Virtual-patch verifier** — includes a test harness proving the WAF rule blocks the PoC payloads while allowing the benign baseline.
0411. **Rate-limit config snippets** — provides exact rate-limit configurations (nginx, envoy, API gateway) tuned to the observed abuse rate.
0412. **Security-header fix blocks** — copy-paste header configurations (CSP, HSTS, permissions-policy) tailored to the app's observed resource needs.
0413. **CORS policy corrector** — generates the corrected CORS configuration with the minimal origin allowlist replacing the wildcard.
0414. **Cookie-flag fixer** — lists every cookie missing Secure/HttpOnly/SameSite with the exact Set-Cookie corrections.
0415. **TLS configuration hardening** — provides the hardened TLS config (cipher suites, versions) for the detected server software.
0416. **Auth-flow redesign sketch** — for broken auth findings, sketches the corrected flow as a sequence diagram plus implementation checklist.
0417. **Session-management fix kit** — rotation, invalidation, and timeout code for the detected session mechanism.
0418. **Password-policy enforcer** — provides the policy configuration (length, breach-check via k-anonymity) for the auth stack in use.
0419. **MFA rollout plan** — a phased MFA enforcement plan targeting the affected user roles first, with fallback procedures.
0420. **OAuth scope minimizer** — recommends least-privilege scope sets per client with the config diff to apply.
0421. **JWT hardening snippet** — algorithm pinning, expiry, issuer/audience validation code for the JWT library detected.
0422. **API-key rotation runbook** — step-by-step rotation runbook for the leaked key type found, including revocation order to avoid downtime.
0423. **Secret-scanning pre-commit hook** — provides the pre-commit configuration that would have caught the committed secret.
0424. **Dependency-upgrade PR** — drafts the version-bump PR for the vulnerable library with changelog highlights and breaking-change scan.
0425. **Transitive-dependency resolver** — identifies which direct dependency pulls the vulnerable transitive one and the minimal upgrade path.
0426. **Container base-image fixer** — recommends the patched base image tag with the Dockerfile diff and rebuild verification steps.
0427. **IaC remediation snippets** — Terraform/CloudFormation/Pulumi fixes for misconfigurations (open S3 buckets, permissive SGs) found during recon.
0428. **Kubernetes policy pack** — PodSecurity/network-policy YAML correcting the cluster misconfigurations observed.
0429. **IAM least-privilege diff** — the trimmed IAM policy JSON removing the excessive permissions the hunt abused.
0430. **S3 bucket policy corrector** — the corrected bucket policy with public access blocked and the exact AWS CLI apply commands.
0431. **Input-validation library picker** — recommends the right validation library for the stack with integration code for the vulnerable endpoints.
0432. **Output-encoding cheat sheet** — context-specific encoding guidance (HTML, JS, URL, CSS contexts) mapped to the XSS variants found.
0433. **CSP builder from observed needs** — generates a strict CSP derived from the app's actual resource usage observed during the hunt.
0434. **DOMPurify integration snippet** — the exact sanitizer integration for the frontend framework detected at the sink.
0435. **SQLi fix per ORM** — parameterized-query rewrites for the specific ORM (Sequelize, Prisma, SQLAlchemy, Hibernate) in use.
0436. **Command-injection safe-exec** — rewrites shell invocations to safe exec forms (argument arrays, allowlists) in the detected language.
0437. **SSRF allowlist proxy** — provides an egress-proxy pattern with allowlisted destinations replacing direct URL fetching.
0438. **XXE parser hardening** — the secure parser configuration disabling external entities for the XML library detected.
0439. **Deserialization guard** — allowlist-based deserialization code or signed-payload patterns for the serializer in use.
0440. **File-upload validator** — content-type sniffing + extension + size validation code with safe storage (randomized names, non-executable dir).
0441. **Path-traversal normalizer** — canonicalization + jail-directory enforcement snippet for the file-serving code.
0442. **IDOR authorization middleware** — object-level authorization check middleware for the detected web framework.
0443. **Mass-assignment allowlist** — explicit field allowlists for the ORM's create/update calls at the affected endpoints.
0444. **Business-logic guardrails** — server-side invariant checks (price re-validation, coupon single-use) with the failing test cases.
0445. **Race-condition locker** — idempotency-key or distributed-lock implementation for the raced endpoint.
0446. **Replay-protection nonce** — nonce/timestamp validation snippet for the replayable requests observed.
0447. **Clickjacking frame-buster** — X-Frame-Options/CSP frame-ancestors config plus the JS fallback for legacy browsers.
0448. **CSRF token integration** — synchronizer-token or SameSite-strict implementation for the framework's form handling.
0449. **Open-redirect allowlist** — redirect-target validation against an allowlist with the exact code change.
0450. **Host-header validation fix** — Host/forwarded-header validation middleware with the cache-poisoning test case.
0451. **Cache-poisoning key fixer** — corrected cache-key configuration excluding the poisonable components.
0452. **HTTP-smuggling guard** — frontend/backend transfer-encoding alignment config for the detected proxy stack.
0453. **WebSocket origin validator** — origin-checking code for the WebSocket handshake handler.
0454. **GraphQL depth limiter** — query-complexity/depth limiting configuration for the GraphQL server detected.
0455. **GraphQL introspection toggle** — the production-safe introspection disable flag with the introspection test proving it.
0456. **API pagination guard** — max page-size and total-result caps preventing mass-assignment-style enumeration.
0457. **Enumeration throttle** — account/user enumeration mitigations (generic responses + throttling) with test matrix.
0458. **Verbose-error silencer** — error-handler configuration returning safe messages in production with the stack-trace test.
0459. **Debug-endpoint remover** — checklist and code removal for the debug endpoints discovered, with route-audit script.
0460. **CORS misconfig test suite** — a regression test suite asserting the corrected CORS behavior across origins.
0461. **Security-unit-test pack** — generates JUnit/pytest/vitest security tests per finding that fail pre-fix and pass post-fix.
0462. **DAST regression script** — a re-runnable scan script encoding each finding's detection logic for CI pipelines.
0463. **Negative-test case bank** — boundary/negative test cases per finding for the QA suite, mapped to requirements.
0464. **Fuzzing seed corpus** — exports the successful payloads as a fuzzing seed corpus for the client's continuous fuzzing.
0465. **SAST rule author** — writes custom SAST rules (Semgrep/CodeQL) detecting the vulnerable pattern across the codebase.
0466. **Secrets-scan rule pack** — custom gitleaks/trufflehog rules for the secret formats actually found in the hunt.
0467. **Dependency-policy gate** — dependency-approval policy (allowlist/blocklist) preventing reintroduction of the vulnerable library.
0468. **Container-scan baseline** — records the fixed image's vulnerability baseline so future scans diff against it.
0469. **License-compliance note** — when upgrades change licenses, flags the license implications for legal review.
0470. **Rollback plan per fix** — a rollback procedure for each significant fix, with the verification query proving rollback safety.
0471. **Feature-flagged fix rollout** — wraps risky fixes in feature-flag steps with percentage-rollout and kill-switch guidance.
0472. **Canary-deploy checklist** — canary analysis metrics (error rate, latency) to watch while rolling out each security fix.
0473. **Dark-launch verifier** — verifies the fix in shadow mode (logging would-block decisions) before enforcing.
0474. **Fix-communication template** — the internal changelog entry and customer-facing note for each shipped fix.
0475. **Post-fix monitoring queries** — SIEM/log queries detecting exploitation attempts against the fixed endpoint, proving the fix holds.
0476. **Honeytoken deployment guide** — plants honeytokens at the previously vulnerable spots to detect regression or attacker return.
0477. **Deception follow-up** — suggests honeypot endpoints mimicking the fixed flaw to gather attacker intel.
0478. **Secure-defaults checklist** — a checklist of secure defaults for the detected stack preventing the whole finding class.
0479. **Hardening baseline diff** — diffs the client's config against CIS benchmarks for the detected components, with remediation commands.
0480. **Golden-image updater** — updates the VM/container golden image build scripts with the hardened configuration.
0481. **Developer training module** — a 20-minute training module built from the client's own findings, with quiz questions.
0482. **Secure-coding standard update** — proposes concrete additions to the client's coding standards derived from the hunt's root causes.
0483. **Code-review checklist** — a per-finding-class code-review checklist for reviewers to catch recurrences.
0484. **Threat-model delta doc** — documents how the threat model must change so the finding class is considered next time.
0485. **Architecture-review trigger** — flags findings needing architecture review (not just code fix) with the review agenda.
0486. **API-design guideline patch** — updates the client's API design guidelines (authZ patterns, pagination, error formats) from API findings.
0487. **Mobile-build hardening steps** — code-signing, cert-pinning, anti-tamper steps for the mobile findings observed.
0488. **CI security-gate config** — the exact CI pipeline YAML adding the new security checks as blocking gates.
0489. **Branch-protection recommender** — recommends branch protection settings so fixes can't be bypassed by direct pushes.
0490. **Release-gate criteria** — defines the release-gate security criteria (zero criticals, etc.) informed by the hunt.
0491. **Exception-workflow config** — configures the risk-exception workflow in the client's GRC tool with the hunt's data.
0492. **Remediation SLA policy** — drafts the severity-based SLA policy table calibrated to the client's observed fix velocity.
0493. **Escalation-matrix builder** — builds the escalation matrix (who, when, how) from the org chart and finding severities.
0494. **Fix-verification API** — an API endpoint clients call post-fix to trigger automated re-verification of specific findings.
0495. **Self-service retest portal** — a portal where engineers request retests per finding with the repro bundle auto-attached.
0496. **Fix-attribution tracker** — tracks which commit/PR closed each finding, building the team's fix-velocity leaderboard.
0497. **Mean-time-to-fix dashboard** — MTTR per severity/team trended across hunts, embedded as a report appendix.
0498. **Reopened-finding alert** — detects and prominently reports findings that were previously marked fixed but reappeared.
0499. **Fix-quality grader** — grades each fix (complete/partial/workaround) from retest evidence with residual-risk notes.
0500. **Remediation-coverage meter** — a single meter showing % of risk remediated vs accepted vs outstanding, for steering committees.
0501. **SOC 2 control mapper** — maps each finding to SOC 2 Trust Services Criteria (CC6.1, CC7.2, etc.) with the auditor-ready observation text.
0502. **PCI DSS 4.0 requirement linker** — links findings to PCI DSS 4.0 requirements (6.2.4, 11.3.1, etc.) with the exact control-test language.
0503. **HIPAA safeguard mapper** — maps findings to HIPAA administrative/technical safeguards (164.312(a)(1), etc.) with ePHI-impact notes.
0504. **ISO 27001:2022 Annex A mapper** — maps each finding to Annex A controls (A.8.9, A.8.26, etc.) with SoA-ready justification text.
0505. **GDPR article linker** — ties findings to GDPR articles (Art. 32, Art. 33/34 triggers) with the DPO notification-evaluation worksheet.
0506. **CCPA/CPRA exposure notes** — flags findings exposing California residents' personal information with statutory-damage exposure framing.
0507. **NIST 800-53 control mapper** — maps findings to NIST 800-53 rev5 controls (SI-10, AC-3, etc.) for federal-adjacent clients.
0508. **NIST CSF 2.0 outcome mapper** — aligns findings to CSF 2.0 subcategories (PR.AC, DE.CM) for program-maturity reporting.
0509. **FedRAMP control mapper** — maps findings to FedRAMP baselines (low/mod/high) with POA&M-ready entries.
0510. **POA&M auto-generator** — generates Plan of Action & Milestones entries per finding with milestones, resources, and scheduled completion dates.
0511. **MAS TRM mapper** — maps findings to MAS Technology Risk Management guidelines for Singapore-regulated clients.
0512. **APRA CPS 234 mapper** — maps findings to APRA CPS 234 controls for Australian financial entities.
0513. **FCA SYSC mapper** — aligns findings to FCA Senior Management Arrangements expectations for UK firms.
0514. **DORA ICT-risk mapper** — maps findings to EU DORA ICT risk-management articles with incident-classification notes.
0515. **NIS2 obligation tracker** — flags findings triggering NIS2 cybersecurity risk-management and incident-reporting duties.
0516. **PIPEDA safeguard notes** — maps findings to PIPEDA Schedule 1 safeguards for Canadian clients.
0517. **LGPD article linker** — ties findings to Brazil's LGPD articles with ANPD-notification evaluation.
0518. **PDPA (Singapore) mapper** — maps findings to PDPA protection obligations with PDPC breach-notification assessment.
0519. **POPIA condition mapper** — aligns findings to South Africa's POPIA conditions for lawful processing.
0520. **RBI cybersecurity mapper** — maps findings to RBI Cyber Security Framework controls for Indian banks/NBFCs.
0521. **IRDAI ISNP mapper** — aligns findings to IRDAI Information Security and Network Protection norms for insurers.
0522. **SEBI CSCRF mapper** — maps findings to SEBI's Cybersecurity and Cyber Resilience Framework for regulated entities.
0523. **CERT-In incident-reporting pack** — pre-fills the CERT-In incident report format for findings meeting India's reporting thresholds.
0524. **DPDP Act 2023 mapper** — maps findings to India's Digital Personal Data Protection Act duties with breach-intimation drafting.
0525. **UAE PDPL mapper** — aligns findings to UAE Federal PDPL obligations for Gulf-region clients.
0526. **Saudi PDPL mapper** — maps findings to Saudi Personal Data Protection Law requirements.
0527. **Qatar PDPPL notes** — flags findings under Qatar's data-protection law for regional entities.
0528. **Israel PPL mapper** — aligns findings to Israel's Protection of Privacy Law amendments for tech clients.
0529. **Japan APPI mapper** — maps findings to Japan's APPI security-control obligations.
0530. **Australia Privacy Act mapper** — maps findings to Australian Privacy Principle 11 (security) with OAIC notifiable-breach assessment.
0531. **NYDFS Part 500 mapper** — maps findings to NYDFS cybersecurity regulation sections for covered financial entities.
0532. **GLBA Safeguards mapper** — aligns findings to the GLBA Safeguards Rule elements for US financial institutions.
0533. **FERPA notes for edtech** — flags findings exposing student records with FERPA implications for education clients.
0534. **COPPA notes for kids' apps** — flags findings in children's apps with COPPA verifiable-consent and data-minimization notes.
0535. **SOX IT-control mapper** — maps findings touching financial-reporting systems to SOX IT general controls.
0536. **SOC 1 IPE notes** — flags findings in systems feeding SOC 1-relevant financial processing.
0537. **PCI PIN mapper** — for PIN-processing findings, maps to PCI PIN security requirements.
0538. **PCI P2PE notes** — assesses findings against PCI P2PE solution requirements where applicable.
0539. **PCI SSF mapper** — maps software findings to PCI Secure Software Framework controls for payment-software vendors.
0540. **SWIFT CSCF mapper** — maps findings to SWIFT Customer Security Controls Framework for banking clients.
0541. **Basel operational-risk notes** — frames findings for Basel operational-risk capital considerations.
0542. **PSD2 SCA mapper** — maps payment-auth findings to PSD2 Strong Customer Authentication requirements.
0543. **EBA guidelines linker** — links findings to relevant EBA ICT-risk guidelines for EU banks.
0544. **BaFin BAIT mapper** — maps findings to BaFin's BAIT requirements for German financial institutions.
0545. **ACPR notes** — aligns findings to ACPR expectations for French financial entities.
0546. **HKMA TM-E-1 mapper** — maps findings to HKMA cyber-resilience expectations for Hong Kong banks.
0547. **OJK POJK mapper** — aligns findings to OJK IT-risk regulations for Indonesian financial firms.
0548. **BSP circulars mapper** — maps findings to Bangko Sentral ng Pilipinas IT-risk circulars.
0549. **CBN framework mapper** — aligns findings to Central Bank of Nigeria cybersecurity framework requirements.
0550. **SARB notes** — maps findings to South African Reserve Bank cyber-resilience guidance.
0551. **OSFI B-13 mapper** — maps findings to OSFI Guideline B-13 technology and cyber risk for Canadian FIs.
0552. **FINRA 4370 notes** — flags findings relevant to FINRA business-continuity planning for broker-dealers.
0553. **SEC Reg S-P mapper** — maps customer-data findings to SEC Regulation S-P safeguards for broker-dealers/advisers.
0554. **SEC cyber-disclosure timer** — starts the 4-business-day Form 8-K materiality assessment workflow for critical findings at US issuers.
0555. **EU CRA mapper** — maps findings in products to EU Cyber Resilience Act essential requirements with vulnerability-handling duties.
0556. **FDA premarket mapper** — maps findings in medical-device software to FDA premarket cybersecurity guidance sections.
0557. **FDA postmarket plan notes** — drafts the postmarket surveillance implications for device findings.
0558. **EU MDR cybersecurity annex** — aligns medical-device findings to EU MDR cybersecurity expectations.
0559. **Automotive ISO 21434 mapper** — maps findings to ISO/SAE 21434 clauses for connected-vehicle components.
0560. **UNECE R155/R156 notes** — flags findings relevant to UNECE vehicle cybersecurity/type-approval duties.
0561. **DO-326A airworthiness notes** — maps findings in aviation software to DO-326A airworthiness security objectives.
0562. **IEC 62443 zone mapper** — maps OT/ICS findings to IEC 62443 zones, conduits, and security levels.
0563. **NERC CIP mapper** — maps findings in bulk-power systems to NERC CIP requirements.
0564. **TSA pipeline directive notes** — flags findings under TSA pipeline cybersecurity directives.
0565. **NIS2 sector annexes** — applies the sector-specific NIS2 annex obligations (energy, health, digital infra) per finding.
0566. **Telecom security-code mapper** — maps findings to national telecom security codes (UK TSR, etc.) for carriers.
0567. **Aviation NIS notes** — aligns airport/airline findings to aviation-specific NIS2 and ICAO expectations.
0568. **Maritime IMO notes** — maps findings in maritime systems to IMO cyber-risk management guidelines.
0569. **Gaming-regulator mapper** — maps findings to gambling-commission technical standards for iGaming clients.
0570. **Elections-infrastructure notes** — flags findings in election systems with CISA election-infrastructure guidance.
0571. **Water-sector AWIA notes** — maps findings to America's Water Infrastructure Act cyber requirements.
0572. **Chemical CFATS notes** — flags findings at chemical facilities under CFATS cyber expectations.
0573. **Defense CMMC mapper** — maps findings to CMMC 2.0 practices for defense-industrial-base clients.
0574. **ITAR data-handling flags** — flags findings exposing ITAR-controlled technical data for defense clients.
0575. **NIST 800-171 mapper** — maps CUI-handling findings to NIST 800-171 requirements.
0576. **IRAP mapper (Australia)** — aligns findings to Australian IRAP assessment criteria for government cloud.
0577. **UK Cyber Essentials mapper** — maps findings to Cyber Essentials controls for UK SME certification.
0578. **Cyber Essentials Plus evidence** — formats technical evidence to satisfy Cyber Essentials Plus audit requirements.
0579. **Singapore CSA CCoP mapper** — maps findings to CSA's Cybersecurity Code of Practice for CII owners.
0580. **India NCIIPC notes** — flags findings in critical-information infrastructure under NCIIPC expectations.
0581. **Brazil Bacen mapper** — maps findings to Banco Central do Brasil cyber requirements.
0582. **Mexico CNBV notes** — aligns findings to CNBV cybersecurity provisions for Mexican FIs.
0583. **South Korea PIPA mapper** — maps findings to Korea's PIPA security measures.
0584. **China CSL/DSL/PIPL triage** — triages findings against China's CSL, Data Security Law, and PIPL duties with MLPS level notes.
0585. **Hong Kong PCPD notes** — maps findings to PCPD recommended security measures.
0586. **Taiwan PDPA mapper** — aligns findings to Taiwan's PDPA security-maintenance obligations.
0587. **Thailand PDPA mapper** — maps findings to Thailand's PDPA Section 37 security duties.
0588. **Indonesia PDP Law mapper** — maps findings to Indonesia's PDP Law security obligations.
0589. **Vietnam PDPD notes** — aligns findings to Vietnam's Personal Data Protection Decree.
0590. **Philippines DPA mapper** — maps findings to NPC Circular 16-01 security measures.
0591. **Malaysia PDPA mapper** — maps findings to Malaysia's PDPA security principle.
0592. **New Zealand Privacy Act mapper** — maps findings to NZ IPP 5 (security safeguards) with notifiable-privacy-breach assessment.
0593. **Dubai DIFC/ADGM notes** — maps findings to DIFC/ADGM data-protection regulations for UAE free-zone entities.
0594. **QFC data-protection notes** — aligns findings to Qatar Financial Centre data rules.
0595. **Bahrain PDPL mapper** — maps findings to Bahrain's data-protection law security duties.
0596. **Kuwait data-law notes** — flags findings under Kuwait's data-privacy regulation.
0597. **Oman PDPL mapper** — maps findings to Oman's Royal Decree 6/2022 security obligations.
0598. **Egypt PDPL notes** — aligns findings to Egypt's Data Protection Law 151/2020.
0599. **Nigeria NDPR mapper** — maps findings to Nigeria Data Protection Regulation security duties.
0600. **Kenya DPA mapper** — maps findings to Kenya's Data Protection Act security obligations.
0601. **Report versioning engine** — every report edit creates an immutable version with semantic versioning, changelog, and author attribution.
0602. **Version-compare viewer** — side-by-side diff of any two report versions with change highlighting at paragraph and field level.
0603. **Amendment appendix** — formal amendment pages appended (never silently edited) when findings change post-publication.
0604. **Errata publisher** — a one-click errata workflow issuing corrected pages with distribution to all prior recipients.
0605. **Supersedure chain** — each report version links to the version it supersedes, forming an auditable chain for regulators.
0606. **Hunt-diff reports** — "what changed since last hunt": new, fixed, reopened, and persistent findings with delta severity analysis.
0607. **Finding-lifecycle timeline** — per finding, the full lifecycle (introduced → found → triaged → fixed → verified) as a visual timeline.
0608. **Recurrence detector** — flags findings that are recurrences of previously closed issues, with the original fix commit referenced.
0609. **Fix-persistence tracker** — verifies fixed findings stay fixed across subsequent hunts, reporting fix half-life per team.
0610. **Retest verification reports** — standalone retest reports proving each fix with fresh evidence, linked bidirectionally to the original finding.
0611. **Partial-retest scoping** — scopes retests to only the changed attack surface, with a coverage statement for what wasn't retested.
0612. **Retest-evidence attacher** — attaches retest traffic logs and screenshots as tamper-evident appendices to the original report.
0613. **Fix-rejection notes** — when a claimed fix fails retest, generates a precise rejection note showing which bypass still works.
0614. **Wont-fix register** — a formal register of accepted-risk findings with approver, expiry, and compensating controls.
0615. **Risk-acceptance expiry alerts** — alerts when a risk acceptance nears expiry, prompting re-evaluation before it lapses.
0616. **Disclosure timeline tracker** — tracks coordinated disclosure per finding: discovery → vendor notified → patch → public, with SLA timers.
0617. **Vendor-notification drafter** — drafts the responsible-disclosure email to the affected vendor with severity, impact, and safe-harbor language.
0618. **Embargo manager** — manages disclosure embargoes with per-party timelines and automatic lift notifications.
0619. **CVE-request packager** — assembles the CVE ID request package (description, affected versions, references) for qualifying findings.
0620. **CWE-assignment verifier** — verifies each finding's CWE assignment against the CWE dictionary with definition quotes.
0621. **Advisory publisher** — generates the client's public security advisory in a standard format (affected, fixed, credits, timeline).
0622. **Credit-attribution block** — a standardized researcher-credit block for advisories, handling anonymous/pseudonymous preferences.
0623. **Bug-bounty submission tracker** — tracks each finding's submission state per platform (draft → submitted → triaged → rewarded).
0624. **Duplicate-prediction scores** — predicts duplicate likelihood before submission using historical platform data to set expectations.
0625. **Bounty-payout reconciler** — reconciles paid bounties against submitted findings, flagging unpaid or underpaid awards.
0626. **SLA-breach forecaster** — forecasts which open findings will breach remediation SLA based on current velocity.
0627. **Escalation-ladder automator** — auto-escalates ageing findings up the management chain per the configured ladder.
0628. **Stale-finding archiver** — archives findings dormant past the retention policy with a reactivation path.
0629. **Finding-merge historian** — keeps the full history when findings merge/split so no audit trail is lost.
0630. **Reclassification log** — logs every severity reclassification with before/after, rationale, and approver.
0631. **Scope-change impact notes** — documents how mid-program scope changes affected coverage and finding counts.
0632. **Program-health scorecard** — monthly program health: submission quality, fix rates, duplicate rates, researcher satisfaction signals.
0633. **Quarterly trend report** — quarter-over-quarter finding trends with root-cause theme analysis for the security steering group.
0634. **Year-in-review security report** — the annual narrative: biggest wins, hardest bugs, lessons, and next-year focus areas.
0635. **Hunt-calendar planner** — proposes the next 12 months of hunt scheduling based on release cadence and risk changes.
0636. **Release-gate verdicts** — per release, a go/no-go security verdict derived from open findings against the gate criteria.
0637. **Hotfix-verification sprints** — rapid retest cycles for emergency patches with a 4-hour evidence turnaround format.
0638. **Continuous-hunt digest** — for always-on hunting, a weekly digest of new findings instead of monolithic reports.
0639. **Finding-debt burndown** — burndown of open findings over time with projected zero-date at current fix velocity.
0640. **Fix-velocity leaderboard** — team-level fix velocity rankings (opt-in) to gamify remediation positively.
0641. **Time-in-state analytics** — measures how long findings sit in each state, exposing triage bottlenecks.
0642. **Reopen-rate analytics** — tracks fix quality via reopen rates per team and per finding class.
0643. **Duplicate-rate analytics** — tracks internal duplicate rates to improve scoping and deduplication.
0644. **False-positive trend** — trends the agent's false-positive rate per engine to guide tuning.
0645. **Coverage-growth tracker** — tracks tested-surface growth hunt-over-hunt as the program matures.
0646. **Asset-onboarding checklist** — a checklist for onboarding new assets into the hunting program with baseline-hunt scheduling.
0647. **Offboarding evidence purge** — certifies evidence purge when an asset leaves the program, with retention-policy citations.
0648. **Data-retention enforcer** — auto-applies retention schedules to reports and evidence with legal-hold overrides.
0649. **Legal-hold freezer** — freezes deletion for findings under legal hold with custodian notifications.
0650. **Report-access audit log** — a complete log of who viewed, downloaded, or shared each report version.
0651. **Recipient-management console** — manages per-report recipient lists with role-based redaction profiles.
0652. **Distribution-list sync** — syncs report recipients with the client's identity provider groups.
0653. **Secure-share links** — time-limited, password-optional share links with per-link access logs and revocation.
0654. **Link-expiry notifier** — notifies owners before share links expire with one-click renewal.
0655. **Download-watermark injector** — injects per-recipient visible and forensic watermarks at download time.
0656. **Print-tracking codes** — embeds traceable codes in printed copies so leaked printouts identify the source.
0657. **Screenshot-deterrent banners** — optional on-screen deterrent banners for highly sensitive report sections.
0658. **Redacted-variant manager** — manages multiple redaction profiles (internal, partner, public) per report with diff views.
0659. **Redaction-approval workflow** — routes redacted variants for approval before external release.
0660. **Declassification scheduler** — schedules automatic declassification/downgrading of report sensitivity over time.
0661. **FOIA-safe variant** — produces a variant safe for freedom-of-information release with exemptions pre-applied.
0662. **Public-summary publisher** — publishes the approved public summary to the trust center with versioning.
0663. **Changelog publisher** — maintains a public-facing security changelog from remediated findings.
0664. **Status-page integrator** — posts hunt-driven security maintenance notices to the status page in the client's format.
0665. **Customer-notification tracker** — tracks which customers were notified of which issues under contractual obligations.
0666. **Contractual-SLA verifier** — verifies remediation met contractual security SLAs in customer agreements, with evidence.
0667. **MSA security-exhibit updater** — proposes updates to MSA security exhibits based on hunt-learned control gaps.
0668. **DPA-evidence pack** — generates the data-processing-agreement evidence pack proving required technical measures.
0669. **Subprocessor-notice drafter** — drafts subprocessor security notifications when findings implicate subprocessors.
0670. **Joint-controller memo** — for joint-controller setups, apportions finding responsibility between controllers.
0671. **Tabletop-after-action linker** — links findings exercised in tabletops to the after-action reports.
0672. **Pen-test report importer** — imports the client's prior human pen-test reports to build unified cross-hunt history.
0673. **Scanner-report correlator** — correlates agent findings with the client's scanner outputs, marking confirmed vs scanner-only.
0674. **Unified-finding registry** — a single registry deduplicating agent, scanner, bounty, and audit findings into canonical records.
0675. **Canonical-ID assigner** — assigns stable canonical IDs surviving across hunts, renames, and platform migrations.
0676. **Cross-source confidence blender** — blends confidence from multiple sources (agent + scanner + human) into one rating.
0677. **Source-reliability scorer** — scores each finding source's historical precision to weight future triage.
0678. **Coverage-union mapper** — shows the union of coverage across all testing sources to reveal true blind spots.
0679. **Gap-attribution notes** — attributes each coverage gap to a cause (scope, tooling, auth) with a remediation proposal.
0680. **Program-maturity assessor** — assesses the vulnerability-management program's maturity from lifecycle metrics.
0681. **Maturity-roadmap builder** — builds the 12-month roadmap to the next maturity level with hunt-informed priorities.
0682. **Benchmark-submission pack** — anonymizes program metrics for industry benchmark submission.
0683. **Insurance-renewal pack** — assembles the annual cyber-insurance renewal evidence from the year's hunt lifecycle data.
0684. **Audit-evidence exporter** — exports the year's findings lifecycle as auditor-ready evidence with sampling support.
0685. **Evidence-sampling helper** — helps auditors sample findings with statistically valid selection and full traceability.
0686. **Management-response tracker** — tracks management's formal response to each audit-relevant finding to closure.
0687. **Corrective-action planner** — converts audit findings into corrective-action plans with owners and dates.
0688. **Preventive-action suggester** — suggests preventive actions from root-cause patterns across the finding history.
0689. **Lessons-learned synthesizer** — synthesizes cross-hunt lessons into the organization's knowledge base entries.
0690. **Root-cause taxonomy** — maintains a taxonomy of root causes with counts, guiding systemic fixes over whack-a-mole.
0691. **Systemic-fix recommender** — recommends systemic fixes (framework upgrades, guardrail libraries) when root-cause clusters emerge.
0692. **Control-effectiveness rater** — rates each security control's effectiveness from how findings bypassed or were stopped by it.
0693. **Control-gap heatmap** — heatmaps controls vs finding classes to show where investment is most needed.
0694. **Security-architecture reviewer** — triggers architecture-review recommendations when findings cluster at design level.
0695. **Threat-model refresh proposer** — proposes threat-model updates from the accumulated finding patterns.
0696. **Secure-SDLC gate tuner** — tunes SDLC gate thresholds from false-negative/false-positive history.
0697. **Training-needs analyzer** — identifies which teams need which training from their finding patterns.
0698. **Hiring-signal extractor** — extracts hiring signals (e.g., "need AppSec reviewer for payments team") from chronic finding areas.
0699. **Tooling-gap identifier** — identifies which tooling would have caught recurring classes, with build-vs-buy notes.
0700. **Lifecycle-SLA dashboard** — a single dashboard of every lifecycle SLA (triage, fix, retest, disclose) with breach alerts.
0701. **20-language report translation** — full narrative translation into 20 languages with security-terminology glossaries keeping terms like "SSRF" consistent.
0702. **Security-terminology glossary builder** — builds per-language glossaries of security terms with approved translations and definitions.
0703. **Glossary-consistency checker** — verifies translated reports use only glossary-approved terms, flagging drift.
0704. **Right-to-left (RTL) report layout** — fully mirrored RTL editions (Arabic, Hebrew, Urdu) with correct chart and code-block handling.
0705. **Hindi (Devanagari) edition** — a complete Hindi report edition matching the user's preferred register for local stakeholders.
0706. **Hinglish executive variant** — a Hindi-English mixed variant for Indian executives who brief in Hinglish.
0707. **Transliteration support** — transliterates key terms for audiences who read the Latin script but speak the local language.
0708. **Locale-aware date/number formats** — dates, currencies, and numbers render per locale conventions in every translated edition.
0709. **Currency-localized loss estimates** — financial impact figures convert to local currency with the rate source and date cited.
0710. **Regulation-localized callouts** — translations swap in the locally applicable regulation (e.g., DPDP Act in the Hindi edition).
0711. **Cultural-severity framing** — adjusts impact narratives for cultural context (e.g., privacy expectations) without changing technical facts.
0712. **Formality-level selector** — translations offer formal vs informal register choice per language (e.g., Japanese keigo levels).
0713. **Dialect variants** — supports major dialect variants (pt-BR vs pt-PT, es-MX vs es-ES) for key languages.
0714. **Translation-memory reuse** — reuses approved translations of recurring finding descriptions across hunts for consistency.
0715. **Human-review workflow** — routes machine translations to human reviewers with a side-by-side diff and approval gate.
0716. **Translation-quality scorer** — scores translation quality per section using back-translation checks and terminology compliance.
0717. **Untranslatable-term keeper** — keeps product names, CVE IDs, and code identifiers untranslated with a protected-terms list.
0718. **Code-comment translation** — translates code comments in fix snippets while leaving code itself intact.
0719. **Evidence-language preserver** — guarantees raw evidence (requests, responses) is never translated, with clear source-language labels.
0720. **Bilingual parallel edition** — side-by-side source/translation columns for reviewers validating the translation.
0721. **Sign-language video edition** — key report summaries delivered as sign-language-interpreted video for accessibility.
0722. **Easy-read edition** — a simplified-language, pictogram-supported edition for readers with cognitive accessibility needs.
0723. **Screen-reader optimized HTML** — semantic HTML with ARIA landmarks, skip links, and logical heading order verified by automated checks.
0724. **Alt-text for every figure** — meaningful alt-text auto-generated for charts, graphs, and diagrams, human-reviewed for criticals.
0725. **Data-table alternatives** — every chart ships with an equivalent accessible data table.
0726. **Keyboard-only navigation audit** — verifies the entire interactive report is operable keyboard-only with visible focus states.
0727. **Focus-order verifier** — checks logical focus order through findings, evidence viewers, and dialogs.
0728. **Color-contrast compliance** — enforces WCAG AA contrast on all report themes including charts and severity badges.
0729. **Colorblind-safe palettes** — severity colors use colorblind-safe palettes with redundant shape/text encoding.
0730. **Reduced-motion mode** — honors prefers-reduced-motion, replacing animations with static equivalents.
0731. **Text-spacing resilience** — report layout survives 200% text spacing without overlap per WCAG 1.4.12.
0732. **Reflow at 400% zoom** — two-column layouts reflow to single column at 400% zoom without horizontal scrolling.
0733. **PDF/UA conformance** — generated PDFs meet PDF/UA accessibility standards with tagged structure.
0734. **PDF tagged-structure validator** — validates heading hierarchy, table headers, and list tags in exported PDFs.
0735. **EPUB accessible edition** — an EPUB edition for e-readers with accessibility features for offline reading.
0736. **DAISY format exporter** — exports the executive summary in DAISY digital talking-book format where required.
0737. **Braille-ready export** — a text-only structured export suitable for braille embossing workflows.
0738. **Large-print edition** — an 18pt large-print PDF variant generated on demand.
0739. **Dyslexia-friendly mode** — optional dyslexia-friendly font, spacing, and background tint for the HTML report.
0740. **Plain-language certifier** — certifies the executive summary meets plain-language standards with readability scores shown.
0741. **Reading-level tuner** — adjusts narrative complexity per audience (grade 8 for execs, technical for engineers) with the level labeled.
0742. **Jargon-buster inline** — every jargon term links to a plain-language explanation with a real-world analogy.
0743. **Acronym-pronunciation guide** — adds pronunciation hints for spoken briefings ("SSRF — 's-s-r-f'").
0744. **Multilingual glossary hover** — glossary hovers show definitions in the reader's selected language.
0745. **Voice-narration language picker** — the audio narration of the summary is generated in the reader's language.
0746. **Subtitle-style selector** — narration subtitles styled per accessibility preferences (size, background, font).
0747. **Transcript-first design** — every audio/video element ships with a complete transcript as the primary accessible alternative.
0748. **Seizure-safe animations** — all report animations verified against photosensitivity thresholds (no >3 flashes/second).
0749. **Cognitive-load meter** — estimates per-section cognitive load and suggests breaks in very long reports.
0750. **Section-complexity labels** — labels sections (overview/technical/deep-dive) so readers can choose their depth.
0751. **Progressive-complexity path** — a guided reading path that ramps complexity gradually for non-technical readers.
0752. **Summary-first architecture** — every long section opens with a 3-line summary before detail, aiding skimming.
0753. **TL;DR auto-generator** — generates accurate TL;DRs per finding validated against the full text for fidelity.
0754. **Key-takeaway callouts** — visually distinct callout boxes for the one thing to remember per section.
0755. **Decision-needed flags** — explicitly flags every point requiring a reader decision with a due date.
0756. **Action-item extractor** — extracts all action items into a checklist with owners and due dates at the report end.
0757. **Meeting-agenda generator** — generates the findings-review meeting agenda from open decisions and disputes.
0758. **Pre-read time estimator** — estimates reading time per section so invitees can prepare proportionally.
0759. **Role-based pre-reads** — auto-extracts the minimal pre-read per attendee role for the review meeting.
0760. **Follow-up tracker** — tracks follow-ups raised during the review meeting against report items.
0761. **Minutes-template filler** — pre-fills review-meeting minutes with findings discussed and decisions recorded.
0762. **Stakeholder-RACI auto-map** — builds the RACI matrix for remediation from org-chart and finding ownership data.
0763. **Communication-plan builder** — builds the stakeholder communication plan (who gets what, when, how) for the remediation program.
0764. **Notification-preference center** — lets stakeholders choose notification granularity (criticals only, weekly digest, etc.).
0765. **Digest-frequency tuner** — per-stakeholder digest cadence (real-time, daily, weekly) with smart batching.
0766. **Quiet-hours respecter** — non-critical notifications respect recipient quiet hours and time zones.
0767. **Timezone-aware scheduling** — all report timestamps and SLA clocks render in the viewer's timezone with the source zone noted.
0768. **Holiday-calendar aware SLAs** — SLA countdowns skip regional holidays from the client's holiday calendar.
0769. **Multi-calendar date display** — shows key dates in Gregorian plus Hijri/Saka where locally relevant.
0770. **Localized severity names** — severity labels translated with culturally appropriate urgency wording.
0771. **Localized risk metaphors** — impact analogies adapted per culture (e.g., locally resonant comparisons) while keeping facts identical.
0772. **Local-contact directory** — per-region reports include the local security contacts and escalation numbers.
0773. **Local-lawyer review flag** — flags sections needing local counsel review before distribution in each jurisdiction.
0774. **Export-control checker** — checks whether report content (exploit detail) is subject to export controls per recipient country.
0775. **Sanctions-screening for sharing** — screens external recipients against sanctions lists before report distribution.
0776. **Data-residency router** — stores and serves report data in the client's required residency region.
0777. **Sovereign-cloud variant** — a report-hosting variant deployable in sovereign clouds for government clients.
0778. **Offline-translation packs** — downloadable translation packs so field teams can read reports without connectivity.
0779. **Low-bandwidth edition** — a sub-1MB report edition (no videos, compressed images) for low-connectivity regions.
0780. **Print-shop handoff pack** — press-ready files with bleed, CMYK, and font embedding for professional printing.
0781. **Binding-layout presets** — print layouts for spiral, perfect-bound, and stapled binding with correct margins.
0782. **Multilingual cover pages** — cover pages localized per edition with correct title translations and disclaimers.
0783. **Localized disclaimer text** — legal disclaimers translated and jurisdiction-adapted by legal review.
0784. **Notarization-ready export** — exports with hash manifests suitable for notarization where legally required.
0785. **Apostille-workflow notes** — guidance for apostille/legalization when reports cross borders for legal proceedings.
0786. **Sworn-translation tracker** — tracks which editions have sworn/certified translations for court use.
0787. **Court-exhibit formatter** — formats findings as numbered court exhibits with chain-of-custody pages.
0788. **Expert-witness CV annex** — attaches the agent methodology's expert-witness-style credentials annex for litigation.
0789. **Deposition-prep brief** — generates the briefing pack for defending the hunt methodology under deposition.
0790. **Cross-examination Q&A** — anticipates cross-examination questions on each finding with evidence-backed answers.
0791. **Plain-language jury edition** — a jury-comprehensible edition of key findings for legal proceedings.
0792. **Regulator-interview prep** — prepares the team for regulator interviews about the hunt with likely questions and answers.
0793. **Press-inquiry response kit** — localized press holding statements per finding for multi-region incidents.
0794. **Social-media monitoring brief** — briefs comms teams on what to watch for if a finding leaks publicly.
0795. **Rumor-response templates** — pre-drafted corrections for common misinterpretations of each finding type.
0796. **Community-translation program** — a workflow for community-contributed translations with glossary enforcement and review.
0797. **Translation-changelog** — tracks what changed in each translated edition across report versions.
0798. **Untranslated-new-content flag** — flags report sections added after translation so nothing ships silently untranslated.
0799. **Fallback-language policy** — defines per-recipient fallback (e.g., English) when their language edition isn't ready.
0800. **Localization QA scorecard** — a per-edition QA scorecard (terminology, layout, RTL, dates) signed off before release.
0801. **HackerOne report formatter** — emits HackerOne-structured reports (summary, steps, impact, asset) with severity mapped to their taxonomy and attachment packaging.
0802. **Bugcrowd submission builder** — builds Bugcrowd-compliant submissions with their required fields, CVSS, and researcher-note conventions.
0803. **Intigriti template adapter** — adapts findings to Intigriti's submission template with their severity and endpoint classifications.
0804. **YesWeHack formatter** — formats findings for YesWeHack programs with French/English bilingual field support.
0805. **Synack workflow adapter** — packages findings for Synack's managed workflow with their evidence and categorization expectations.
0806. **Cobalt submission pack** — generates Cobalt-formatted pentest findings with their required remediation-guidance fields.
0807. **Open Bug Bounty formatter** — creates Open Bug Bounty disclosures with their responsible-disclosure workflow fields.
0808. **Google VRP formatter** — formats findings to Google's Vulnerability Reward Program rules with product-panel routing.
0809. **Microsoft MSRC adapter** — packages findings per MSRC submission requirements with their severity and reproducibility bars.
0810. **Apple Security Bounty formatter** — adapts iOS/macOS findings to Apple's bounty submission expectations.
0811. **Meta Bug Bounty formatter** — formats findings for Meta's program with their impact-focused writeup style.
0812. **Platform-duplicate pre-check** — checks the finding's fingerprint against the platform's known-issue signals before submission.
0813. **Bounty-brief optimizer** — rewrites titles and impacts using historical payout data to maximize triage clarity (never exaggeration).
0814. **Researcher-notes composer** — drafts the researcher notes field explaining methodology without leaking agent internals.
0815. **Retest-request formatter** — formats retest requests per platform's workflow with the fix-verification evidence attached.
0816. **Appeal-letter drafter** — drafts professional severity/appeal letters to platform triagers with evidence citations.
0817. **JIRA issue creator** — creates one JIRA issue per finding with fields mapped (severity→priority, labels, components) and evidence attached.
0818. **JIRA bulk importer** — imports the full finding set as a CSV/JIRA-JSON bulk upload with field-mapping preview.
0819. **JIRA workflow sync** — two-way sync of finding status with JIRA workflow transitions (In Progress → Done triggers retest).
0820. **JIRA SLA auto-timer** — starts JIRA SLA clocks per severity with breach-risk escalation automation.
0821. **GitHub issue generator** — creates GitHub issues per finding with labels, milestones, and the PoC video embedded.
0822. **GitHub Security Advisory drafter** — drafts GitHub Security Advisories for the client's own repos with CVE-request integration.
0823. **GitLab issue sync** — creates and syncs GitLab issues with scoped labels and weight-based prioritization.
0824. **Linear issue importer** — imports findings into Linear with team routing, cycle assignment, and estimate fields.
0825. **Asana task builder** — builds Asana tasks per finding with subtasks for fix, test, and verify stages.
0826. **Monday.com board loader** — loads findings into a monday.com board with status columns and owner assignment.
0827. **ClickUp importer** — creates ClickUp tasks with custom fields for severity, CWE, and SLA dates.
0828. **Notion findings database** — publishes findings as a Notion database with filtered views per team and severity.
0829. **ServiceNow SecOps sync** — creates ServiceNow security incidents/vulnerable-items with CMDB asset matching.
0830. **ServiceNow VR workflow** — drives the Vulnerability Response workflow states from finding lifecycle events.
0831. **BMC Helix adapter** — syncs findings into BMC Helix ITSM as security incidents with categorization.
0832. **Cherwell ticket builder** — creates Cherwell tickets with the client's custom security ticket template.
0833. **Zendesk security tickets** — files internal Zendesk tickets for findings needing cross-team coordination.
0834. **Freshservice sync** — creates Freshservice incidents with SLA policies applied per severity.
0835. **Azure DevOps work items** — creates Azure Boards work items with area-path routing and severity-mapped priority.
0836. **Azure DevOps pipeline gates** — wires findings as release-gate checks blocking deployments while criticals are open.
0837. **Bitbucket issue sync** — creates Bitbucket issues linked to the affected repos and branches.
0838. **Trello remediation board** — builds a Trello board with lists per state and cards carrying evidence checklists.
0839. **Slack finding alerts** — posts rich Slack messages per finding with severity color, owner buttons, and thread-based discussion.
0840. **Slack digest bot** — a daily/weekly digest bot posting hunt summaries to configured channels.
0841. **Slack interactive triage** — triage buttons (accept severity, dispute, assign) inside Slack messages updating the finding live.
0842. **Teams adaptive cards** — posts findings as Teams adaptive cards with action buttons for assignment and status.
0843. **Teams channel digest** — weekly Teams digest with the risk burndown chart embedded.
0844. **Discord webhook alerts** — Discord-formatted alerts for community/bounty-team servers with role pings per severity.
0845. **Telegram critical pings** — Telegram instant alerts for critical findings with the one-line impact and report link.
0846. **PagerDuty incident trigger** — triggers PagerDuty incidents for critical findings with runbook links and severity mapping.
0847. **Opsgenie alert router** — routes findings to Opsgenie teams per asset ownership with escalation policies.
0848. **VictorOps integration** — posts findings into VictorOps timelines for on-call correlation.
0849. **Email digest composer** — beautifully formatted HTML email digests per stakeholder role with inline charts.
0850. **Calendar-invite SLA reminders** — auto-creates calendar holds for SLA deadlines with the finding summary attached.
0851. **SIEM finding forwarder** — forwards findings as SIEM events (CEF/LEEF) for SOC correlation with hunt telemetry.
0852. **Splunk dashboard pack** — a Splunk dashboard definition visualizing findings, trends, and SLA compliance.
0853. **Elastic detection pack** — Elastic Security detection rules derived from each finding's exploitation signals.
0854. **Sentinel workbook** — an Azure Sentinel workbook for tracking the hunt's findings lifecycle.
0855. **Chronicle YARA-L rules** — YARA-L rules for Google Chronicle detecting the observed attack patterns.
0856. **QRadar offense mapper** — maps findings to QRadar offense categories with custom properties.
0857. **SOAR playbook triggers** — triggers SOAR playbooks (containment, notification) for critical findings via webhook.
0858. **Cortex XSOAR pack** — a XSOAR integration pack with incident layouts and remediation playbooks per finding class.
0859. **Tines story starter** — generates Tines story stubs automating the finding-notification workflow.
0860. **Torq workflow templates** — Torq workflow templates for finding triage and escalation automation.
0861. **GRC platform exporter** — exports findings to GRC tools (Archer, ServiceNow GRC, OneTrust) as control deficiencies.
0862. **AuditBoard sync** — syncs findings into AuditBoard as issues with owner and due-date management.
0863. **Drata evidence uploader** — uploads hunt evidence into Drata as control-monitoring proof.
0864. **Vanta control tester** — maps findings to Vanta controls with automated test-evidence attachments.
0865. **SecureFrame sync** — pushes findings into SecureFrame's vulnerability management with remediation tracking.
0866. **Tugboat Logic pack** — formats findings for Tugboat Logic audit workflows.
0867. **Wiz issue sync** — creates Wiz issues for cloud findings with cloud-asset context merged.
0868. **Orca alert correlator** — correlates hunt findings with Orca cloud alerts to confirm exploitability of misconfigurations.
0869. **Prisma Cloud adapter** — forwards cloud findings to Prisma Cloud Compute with compliance-policy mapping.
0870. **Snyk code-issue linker** — links findings to Snyk code issues for the same files, unifying fix guidance.
0871. **Snyk container sync** — syncs dependency findings with Snyk container scan results.
0872. **Dependabot PR linker** — links findings to existing Dependabot PRs that would remediate them.
0873. **Renovate config suggester** — suggests Renovate rules preventing reintroduction of the vulnerable dependency ranges.
0874. **SonarQube issue importer** — imports findings as SonarQube issues with rule-key mapping for developer visibility.
0875. **Checkmarx correlator** — correlates with Checkmarx SAST results, marking agent-confirmed vs static-only.
0876. **Veracode findings sync** — syncs into Veracode's platform for unified application-security reporting.
0877. **Burp Suite importer** — exports findings in Burp-compatible XML for teams living in Burp.
0878. **OWASP ZAP importer** — exports findings as ZAP alerts for baseline comparisons.
0879. **Nessus cross-reference** — cross-references network findings with Nessus plugin outputs where available.
0880. **DefectDojo uploader** — uploads the full finding set to DefectDojo with engagement and test-type mapping.
0881. **Faraday importer** — exports findings into Faraday's collaborative pentest workspace format.
0882. **PlexTrac report sync** — syncs findings into PlexTrac with their report-template field mapping.
0883. **Dradis pack exporter** — exports findings as Dradis-ready content blocks for consultant report assembly.
0884. **Sysdig runtime correlator** — correlates findings with Sysdig runtime signals for containerized targets.
0885. **Datadog security dashboard** — a Datadog dashboard definition tracking findings alongside APM security signals.
0886. **New Relic vulnerability sync** — syncs findings into New Relic vulnerability management views.
0887. **PagerDuty postmortem linker** — links findings to related PagerDuty postmortems for incident context.
0888. **Confluence space publisher** — publishes the report as a Confluence space with per-finding child pages.
0889. **SharePoint library uploader** — uploads versioned reports into SharePoint with metadata columns and retention labels.
0890. **Google Drive distributor** — distributes redacted variants via Drive with per-recipient permission sets.
0891. **Dropbox shared-folder sync** — syncs report packages to client Dropbox folders with link-expiry policies.
0892. **S3 evidence vault** — archives evidence in client-owned S3 with object-lock immutability and lifecycle policies.
0893. **Webhook event emitter** — emits finding lifecycle events (created, fixed, verified) to client webhooks in a versioned schema.
0894. **GraphQL report API** — serves the report data model over GraphQL for custom client integrations.
0895. **REST report API** — a versioned REST API exposing findings, evidence, and lifecycle transitions.
0896. **SARIF exporter** — exports findings in SARIF for ingestion by GitHub code scanning and other SARIF consumers.
0897. **CycloneDX VEX generator** — generates VEX statements per finding for software-supply-chain transparency.
0898. **OSV record linker** — links dependency findings to OSV.dev records with affected-version ranges.
0899. **CSA FAM exporter** — exports cloud findings in CSA-compatible assessment formats.
0900. **Integration-health monitor** — monitors every configured integration's health and alerts when a sync target goes stale.
0901. **Pixel-perfect PDF renderer** — generates print-grade PDFs with professional typography, running headers, and figure numbering matching the HTML edition.
0902. **HTML/PDF/Markdown parity checker** — automated checks guaranteeing the three editions carry identical findings, severities, and evidence references.
0903. **DOCX editable edition** — a Word edition with styles, editable tables, and track-changes-friendly structure for client redlining.
0904. **XLSX findings workbook** — a spreadsheet edition with one finding per row, filterable columns, and pivot-ready fields.
0905. **CSV machine feed** — a flat CSV feed of findings for data-warehouse ingestion with a stable column contract.
0906. **JSON canonical export** — the report's canonical JSON data model with JSON Schema published for integrators.
0907. **XML legacy export** — an XML edition for clients with legacy GRC ingestion pipelines.
0908. **Markdown Git-friendly edition** — a Markdown edition with relative asset links, ideal for committing alongside code.
0909. **Single-file HTML bundle** — a self-contained .html with inlined assets that renders identically offline.
0910. **Progressive-web-app report** — the HTML report installable as a PWA with offline caching for field reviewers.
0911. **AMP-lite edition** — an ultra-light HTML edition loading in under a second on 2G connections.
0912. **Print-stylesheet master** — a dedicated print CSS producing clean page breaks, widow control, and TOC page numbers.
0913. **E-ink optimized edition** — a high-contrast, image-light edition for e-ink readers used by traveling executives.
0914. **Infographic summary page** — a one-page visual infographic (icons, stats, flow) summarizing the hunt for slide reuse.
0915. **Social-card generator** — generates share-safe summary cards (no sensitive detail) for internal social channels.
0916. **Poster-format criticals** — prints critical findings as wall posters for security-awareness displays in offices.
0917. **One-page cheat sheets** — per-finding-class one-pagers (XSS, SSRF, IDOR) with detection and fix essentials for developers.
0918. **Laminated runbook cards** — pocket runbook cards for on-call engineers covering the top incident scenarios from the hunt.
0919. **Slide-deck auto-builder** — builds a full findings-review slide deck (title, agenda, findings, roadmap, appendix) from the report model.
0920. **Speaker-notes generator** — writes speaker notes for every auto-built slide with timing cues.
0921. **Handout-companion generator** — produces the audience handout matching the slide deck with note-taking space.
0922. **Whitepaper-grade narrative** — a long-form whitepaper edition weaving findings into a narrative about the client's security journey.
0923. **Case-study anonymizer** — converts the hunt into an anonymized case study for the client's marketing with approval workflow.
0924. **Press-release security wins** — drafts the "we fixed X critical issues" release from remediated findings with legal review gates.
0925. **Investor-update paragraph** — a quarterly investor-update paragraph on security posture drawn from hunt trends.
0926. **Annual-report disclosure** — drafts the cybersecurity disclosure paragraph for the annual report from the year's findings.
0927. **ESG-report security section** — writes the governance section of ESG reports from the hunt program's metrics.
0928. **Sustainability-angle note** — notes where security fixes reduce compute waste (e.g., bot abuse) for sustainability reporting.
0929. **Watermarking engine** — visible and forensic watermarks (text, pattern, metadata) applied per recipient at distribution time.
0930. **Forensic-watermark decoder** — a tool proving which recipient a leaked copy was issued to from the forensic watermark.
0931. **Copy-paste deterrence** — optional JavaScript deterrents against casual copy-paste of sensitive evidence sections.
0932. **Screenshot-trace pixels** — imperceptible pixel patterns identifying the recipient in rendered report pages.
0933. **Document-fingerprint registry** — registers each distributed copy's fingerprint for leak investigations.
0934. **Canary-trap paragraphs** — unique canary sentences per recipient copy enabling leak-source identification.
0935. **Redaction-verification pass** — automated verification that redacted PDFs contain no hidden text layers or metadata leaks.
0936. **Metadata-scrubber** — strips author, timestamps, and tool metadata from distributed files per policy.
0937. **Exif-cleaner for evidence** — removes GPS and device metadata from evidence screenshots before sharing.
0938. **Secure-print release** — integrates with secure-print queues so sensitive reports only print on authenticated release.
0939. **View-only streaming** — streams the report as view-only pages (no download) for highly sensitive findings.
0940. **Time-boxed access grants** — grants report access windows (e.g., 48 hours for auditors) with automatic revocation.
0941. **Geo-fenced access** — restricts report access to approved countries/IP ranges for sensitive programs.
0942. **Device-posture gating** — requires managed-device posture checks before opening critical-finding reports.
0943. **Step-up-auth for criticals** — critical findings require step-up authentication even for authorized readers.
0944. **Break-glass access** — emergency break-glass access to sealed reports with full audit logging and manager notification.
0945. **Access-recertification** — periodic recertification of who retains access to historical reports.
0946. **Report-engagement analytics** — tracks which sections stakeholders read, informing future report design.
0947. **Clarity-score per section** — reader ratings aggregated into a clarity score driving report-template improvements.
0948. **Time-to-comprehension metric** — measures how long readers take to reach key findings, optimizing information architecture.
0949. **Decision-latency tracker** — tracks time from report delivery to remediation decisions as a program KPI.
0950. **Fix-rate attribution** — attributes fix-rate improvements to specific report features (e.g., diff patches) via A/B testing.
0951. **A/B report testing** — tests two report variants with different stakeholder groups to learn what drives faster fixes.
0952. **Template-version manager** — versions the report templates themselves with changelogs and rollback.
0953. **Brand-kit applier** — applies the client's brand kit (logo, colors, fonts) to all editions automatically.
0954. **White-label engine** — full white-labeling for MSSPs delivering hunts under their own brand.
0955. **Co-branded editions** — joint client/vendor branded editions for shared-responsibility findings.
0956. **Letterhead-compliant PDFs** — PDFs matching the client's official letterhead and document-control standards.
0957. **Document-control numbering** — applies the client's document-control numbering and classification markings.
0958. **Records-schedule tagging** — tags reports with records-retention schedules for records-management compliance.
0959. **E-discovery export** — exports reports and evidence in e-discovery-friendly formats with load files.
0960. **Litigation-hold wrapper** — wraps reports under litigation hold with chain-of-custody documentation.
0961. **Archive-format exporter** — exports to long-term archival formats (PDF/A) with preservation metadata.
0962. **Checksum-manifest publisher** — publishes SHA-256 manifests for every distributed file enabling integrity checks.
0963. **Timestamp-authority stamping** — RFC 3161 timestamps proving report existence at a point in time.
0964. **Blockchain-anchored hashes** — optionally anchors report hashes to a public ledger for tamper-evidence.
0965. **Digital-signature pack** — signs reports with the hunt team's certificate; verification instructions included.
0966. **Multi-signer workflow** — routes reports through multiple signers (lead, reviewer, approver) with signature blocks.
0967. **Approval-audit trail** — records every approval, comment, and change in the pre-release workflow.
0968. **Release-gate checklist** — a mandatory pre-release checklist (evidence verified, redactions checked, recipients confirmed).
0969. **Distribution-manifest** — a manifest of exactly who received which version when, for audit purposes.
0970. **Recall-procedure** — a formal procedure for recalling a distributed report version with recipient confirmations.
0971. **Supersede-notifications** — automatically notifies all recipients when a newer version supersedes theirs.
0972. **Read-receipt tracker** — tracks which recipients opened critical findings, escalating unread criticals.
0973. **Acknowledgment workflow** — requires owners to acknowledge their findings with a recorded timestamp.
0974. **Comment-resolution tracker** — tracks reviewer comments to resolution before the report is finalized.
0975. **Pre-release review stages** — configurable stages (draft → technical review → client review → final) with stage gates.
0976. **Client-redline merger** — merges client redlines from the DOCX edition back into the canonical report model.
0977. **Change-request log** — logs every client-requested change with disposition (accepted/rejected + rationale).
0978. **Final-acceptance sign-off** — a formal sign-off page capturing client acceptance of the final report.
0979. **Satisfaction-survey embed** — a post-delivery survey measuring report usefulness, feeding the quality loop.
0980. **Testimonial-request workflow** — requests client testimonials from high-satisfaction deliveries for program marketing.
0981. **Referral-kit generator** — generates the one-pager clients can forward to peers describing the hunt program.
0982. **Renewal-brief builder** — builds the renewal brief from the year's delivered value (findings, fixes, risk reduced).
0983. **Expansion-proposal drafter** — drafts scope-expansion proposals from coverage gaps found across hunts.
0984. **Upsell-insight notes** — identifies adjacent services (code review, training) the findings suggest, for account teams.
0985. **Churn-risk signals** — detects disengagement signals (unread reports, stalled fixes) alerting the account team early.
0986. **Value-realization report** — quantifies realized value (losses avoided, fines avoided) from the remediated findings.
0987. **Before/after posture film** — an animated visualization of posture improvement across the engagement for QBRs.
0988. **Milestone-celebration pack** — auto-generates the "1000th finding fixed" style celebration assets for security culture.
0989. **Security-champions leaderboard** — recognizes top-fixing engineers/teams with shareable badges.
0990. **Fix-streak tracker** — tracks consecutive weeks of SLA-compliant fixing as a team motivation metric.
0991. **Report-card for vendors** — grades third-party vendors on their components' finding rates for procurement reviews.
0992. **SLA-scorecard for clients** — the client's own responsiveness scorecard (triage speed, fix speed) for joint reviews.
0993. **Joint-success-plan builder** — builds the joint client/vendor success plan from hunt outcomes and commitments.
0994. **Executive-sponsor brief** — a quarterly one-pager keeping the executive sponsor engaged with wins and asks.
0995. **Steering-committee pack** — the full steering-committee pack: metrics, decisions needed, risks, roadmap.
0996. **Program-charter updater** — proposes charter updates (scope, SLAs, cadence) informed by program performance data.
0997. **RACI-for-reporting** — defines who creates, reviews, approves, and distributes each report type in the program.
0998. **Report-catalog indexer** — a searchable catalog of all reports ever delivered with faceted search (client, date, severity).
0999. **Knowledge-base synthesizer** — distills every report's lessons into a searchable organizational knowledge base.
1000. **Report-retirement ceremony** — formally retires reports past retention with archival confirmation and access revocation receipts.
