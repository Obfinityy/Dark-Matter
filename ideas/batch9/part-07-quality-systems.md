# Batch 9 — Quality Systems (86005–87004)

86005. **Staged finding QA pipeline** — Route every finding through machine pre-triage, human peer review, and certifier sign-off with mandatory state transitions.
86006. **Severity-driven QA depth selector** — Automatically assign deeper review stages (panel review for criticals, single reviewer for lows) based on severity.
86007. **QA policy engine** — Encode per-program quality rules (evidence minimums, reviewer seniority) as versioned, executable policy evaluated at each pipeline stage.
86008. **Finding lifecycle state machine** — Enforce valid transitions (draft → in-review → certified → submitted) with guards that block skipping required QA stages.
86009. **QA exemption tracking** — Require documented approval with expiry for any finding that skips a QA stage, and audit all exemptions quarterly.
86010. **Bulk QA workflow** — Let reviewers certify batches of near-duplicate low-severity findings together while preserving per-finding decision records.
86011. **QA orchestration for distributed reviewers** — Coordinate review stages across time zones with handoff notes so a finding never stalls waiting for one reviewer.
86012. **Quality policy versioning** — Pin each finding to the QA policy version active at submission so audits can replay exactly what rules applied.
86013. **QA stage timing telemetry** — Measure dwell time per stage to detect bottlenecks and feed queue-health dashboards.
86014. **Parallel review routing** — Send evidence completeness and technical validity checks to different reviewers simultaneously to cut cycle time.
86015. **QA escalation ladder** — Define explicit escalation paths (reviewer → senior → panel) with time triggers when reviews stall.
86016. **Automated first-pass scoring** — Score every finding on completeness, clarity, and evidence before human review so reviewers start from a triaged baseline.
86017. **Deduplication as a QA stage** — Run cluster-based duplicate detection inside the QA pipeline, not before it, so merges get reviewer confirmation.
86018. **QA workflow templates per program** — Let each bounty program define its own stage sequence, SLAs, and sign-off requirements from a shared template library.
86019. **QA pipeline health monitoring** — Alert when stage throughput drops, queue age spikes, or bypass rates exceed thresholds.
86020. **Regression QA on model updates** — Re-run a golden set of past findings through the QA pipeline after every agent or policy change to catch regressions.
86021. **QA exception approval workflow** — Route exception requests to a quality lead with justification, scope limit, and automatic expiry.
86022. **Cross-program QA standard harmonization** — Map program-specific rules to a common internal standard so reviewers apply consistent bars everywhere.
86023. **QA queue backpressure management** — Throttle new finding intake or auto-scale reviewer capacity when queues exceed safe depth.
86024. **QA throughput analytics** — Report findings certified per reviewer-hour per stage to support capacity planning.
86025. **Quality incident postmortems** — Run blameless reviews when a bad finding ships, producing action items tracked to closure.
86026. **QA runbook templates** — Provide step-by-step playbooks for common QA situations (severity dispute, missing evidence, platform rejection).
86027. **QA coverage heatmaps** — Visualize which vulnerability classes and programs get deep vs shallow QA to spot under-reviewed areas.
86028. **QA bottleneck detection** — Identify the single slowest stage or reviewer pool constraining pipeline flow each week.
86029. **Reviewer workload balancing algorithm** — Assign reviews to minimize max queue depth while respecting expertise and availability constraints.
86030. **P0 critical fast-lane** — Give critical-severity findings a dedicated priority lane with guaranteed reviewer response within hours.
86031. **SLA countdown per QA stage** — Show live remaining time for each stage and escalate automatically on breach.
86032. **QA handoff notes standard** — Require structured handoff summaries (what was checked, what remains, open questions) between stages.
86033. **Review assignment constraints engine** — Enforce rules like no self-review, minimum seniority per severity, and conflict-of-interest exclusion.
86034. **QA pipeline dry-run sandbox** — Let quality leads test policy changes against historical findings before deploying them.
86035. **QA stage skip authorization** — Allow skipping only with dual approval and a recorded reason, never silently.
86036. **QA cost tracking per finding** — Attribute reviewer minutes and tooling cost to each finding for ROI analysis.
86037. **QA policy diff viewer** — Show exactly what changed between policy versions with impact estimates on in-flight findings.
86038. **QA rule conflict resolver** — Detect when program-specific rules contradict global standards and route to a quality lead for resolution.
86039. **QA dashboard for team leads** — Give leads a live view of queue depth, SLA risk, bypass rates, and reviewer load.
86040. **QA pipeline autoscaling** — Spin up additional reviewer capacity (on-call pool) when queue depth crosses thresholds.
86041. **Finding state transition guards** — Block illegal transitions in code, not convention, with clear error messages naming the missing prerequisite.
86042. **QA notification routing** — Notify the right reviewer, lead, or program contact per event type with preference-aware channels.
86043. **QA comment templates** — Provide structured comment macros (evidence request, severity challenge, approval) to keep reviews consistent.
86044. **QA outcome codes taxonomy** — Standardize decision codes (certified, returned-for-evidence, severity-adjusted, rejected-as-FP) for analytics.
86045. **QA pipeline latency alerts** — Page the quality lead when end-to-end certification time exceeds the 95th-percentile target.
86046. **Calibration-gated promotion** — Prevent reviewers from certifying findings until they pass the current calibration round.
86047. **QA sandbox for trainee reviewers** — Let trainees practice on historical findings with mentor feedback before touching live queues.
86048. **QA replay of past decisions** — Reconstruct any past certification decision with full provenance for audits or appeals.
86049. **Separate QA lanes for automated findings** — Apply stricter evidence and hallucination checks to AI-generated findings than human-authored ones.
86050. **QA for retest requests** — Run fix-verification findings through a dedicated lightweight pipeline with before/after evidence comparison.
86051. **QA of duplicate cluster merges** — Require reviewer confirmation that merged findings are truly the same root cause before consolidating.
86052. **QA of severity change requests** — Route every requested severity change through an independent reviewer with a written rationale.
86053. **QA of dispute and appeal findings** — Handle contested decisions in a separate track with fresh reviewers and full history visible.
86054. **QA of platform syncs** — Validate that findings pushed to bounty platforms match the certified internal record field-for-field.
86055. **QA of out-of-scope claims** — Have a second reviewer confirm scope rulings before rejecting a finding as out of scope.
86056. **QA sampling stratification** — Stratify audit samples by severity, class, and reviewer so rare criticals are always represented.
86057. **QA checklist engine** — Render dynamic per-class checklists inside the review UI, generated from validation standards.
86058. **QA rubric designer UI** — Let quality leads build scoring rubrics with weighted criteria without code changes.
86059. **QA rubric version pinning** — Lock the rubric version used for each review so later rubric changes don't rewrite history.
86060. **QA decision provenance log** — Record who decided what, when, under which policy version, with linked evidence hashes.
86061. **QA stage owners matrix** — Publish a RACI matrix naming the owner of every stage, gate, and escalation path.
86062. **QA rotation scheduler** — Rotate reviewers across programs and classes on a schedule to prevent capture and broaden expertise.
86063. **QA shadow review mode** — Let a second reviewer silently review the same finding to measure agreement without influencing the primary.
86064. **QA double-blind option** — Hide author identity from reviewers for sensitive or disputed findings to reduce bias.
86065. **QA consensus rules for disputed severity** — Require majority or unanimous panel agreement when reviewers disagree on severity by more than one level.
86066. **QA tie-breaker protocol** — Define who breaks deadlocks (duty principal reviewer) and the documentation required.
86067. **QA evidence chain-of-custody checks** — Verify evidence hashes at each stage so tampering between stages is detectable.
86068. **QA legal and embargo holds** — Pause pipeline progression for findings under legal review or coordinated-disclosure embargo.
86069. **QA for coordinated disclosure** — Add disclosure-timeline and vendor-communication stages for findings going through responsible disclosure.
86070. **QA multilingual review routing** — Route findings to reviewers fluent in the report's language, with translation QA for cross-language cases.
86071. **QA timezone-aware SLAs** — Compute SLA deadlines in the assigned reviewer's working hours, not raw elapsed time.
86072. **QA holiday coverage planner** — Forecast reviewer availability around holidays and pre-assign coverage to avoid SLA breaches.
86073. **QA on-call rotation** — Maintain a duty roster for urgent criticals with defined response-time commitments.
86074. **QA merge queue for batch certifications** — Queue ready findings for certification in scheduled batches to smooth reviewer load.
86075. **QA release train for report batches** — Ship certified findings to platforms on a fixed cadence with a final pre-ship gate.
86076. **QA policy lint on save** — Validate new policy rules for contradictions, unreachable stages, and missing owners before activation.
86077. **QA metrics instrumentation hooks** — Emit structured events at every transition for downstream analytics without code changes.
86078. **QA webhook events** — Push stage transitions and decisions to external systems (ticketing, SIEM, program portals) in real time.
86079. **QA API for external tools** — Expose pipeline state, assignment, and decisions through a documented API for integrations.
86080. **QA identity binding** — Tie every decision to an SSO identity so audit trails survive reviewer renames or role changes.
86081. **QA data retention policy** — Define retention tiers for review artifacts, balancing audit needs with storage cost and privacy.
86082. **QA PII redaction in review** — Automatically redact personal data from evidence surfaced in review UIs while preserving the original securely.
86083. **QA export compliance flags** — Flag findings containing export-controlled technical details before they leave the pipeline.
86084. **QA customer-visibility settings** — Control per program which internal QA notes are visible to the bounty platform or client.
86085. **QA internal vs external notes split** — Keep candid internal review discussion separate from the client-facing report narrative.
86086. **QA provenance labeling for AI findings** — Tag AI-generated findings through the pipeline so downstream consumers know the origin.
86087. **QA model provenance tagging** — Record which model version produced each AI finding for accuracy-by-model analytics.
86088. **QA confidence threshold routing** — Route low-confidence agent findings to senior reviewers and high-confidence ones to standard queues.
86089. **QA low-confidence auto-escalation** — Escalate automatically when the agent's self-reported confidence falls below a per-class threshold.
86090. **QA feedback loop wiring** — Connect pipeline outcomes back to agent training data and prompt updates through a defined interface.
86091. **QA pipeline A/B testing** — Run two policy variants on randomized finding cohorts to measure quality impact before full rollout.
86092. **QA change management log** — Record every pipeline or policy change with author, rationale, and rollback plan.
86093. **QA training data curation pipeline** — Convert certified and rejected findings into labeled training data with quality filters.
86094. **QA golden set maintenance** — Curate and version a reference set of findings with known-correct decisions for regression testing.
86095. **QA drift alerting** — Alert when decision distributions (severity mix, reject rates) drift beyond historical bands.
86096. **QA seasonal calibration windows** — Schedule organization-wide calibration exercises quarterly, tied to policy review cycles.
86097. **QA annual framework review** — Reassess the entire QA framework yearly against industry benchmarks and incident learnings.
86098. **QA maturity model assessment** — Score the QA organization on a 5-level maturity model and publish the improvement roadmap.
86099. **QA benchmarking harness** — Compare pipeline metrics (cycle time, precision, cost) against anonymized industry peers.
86100. **QA vendor and third-party review integration** — Plug external review vendors into the same pipeline stages with identical SLAs and audit trails.
86101. **QA stage preconditions display** — Show reviewers exactly which prerequisites are met or missing before they can approve.
86102. **QA decision reversal workflow** — Allow certified findings to be recalled through a controlled reversal with reason and re-review.
86103. **QA pipeline simulation** — Forecast cycle-time impact of proposed policy changes using historical finding distributions.
86104. **QA continuous improvement backlog** — Maintain a prioritized backlog of QA process improvements fed by postmortems, audits, and reviewer suggestions.
86105. **Expertise-matched review assignment** — Match findings to reviewers by tech stack, vulnerability class, and language tags instead of round-robin.
86106. **Blind peer review option** — Hide finding author identity during review to reduce halo and seniority bias.
86107. **Review quorum rules** — Require two independent reviewers for high severity and a three-person panel for criticals.
86108. **Review voting mechanism** — Let reviewers vote certify/return/reject on disputed findings with weighted votes by certification level.
86109. **Reviewer tier system** — Classify reviewers (associate, senior, principal) and gate which severities each tier may certify.
86110. **Review SLA per severity** — Commit to review turnaround targets (e.g., 4h for critical, 48h for low) and track compliance publicly.
86111. **Stuck-review detection** — Flag reviews idle beyond 50% of SLA and auto-reassign or escalate before breach.
86112. **Review queue priority scoring** — Rank queue items by severity, SLA risk, bounty value, and business impact for optimal ordering.
86113. **Reviewer availability calendar** — Feed reviewer working hours and leave into assignment so queues never land on absent reviewers.
86114. **Review load forecasting** — Predict next week's review demand from hunt schedules and historical arrival rates.
86115. **Surge handling playbook** — Define exactly how review capacity scales (on-call, overflow pool, batch triage) during finding spikes.
86116. **Review delegation workflow** — Let overloaded reviewers delegate with one click while retaining accountability and full audit trail.
86117. **Review reassignment audit** — Log every reassignment with reason to detect cherry-picking or avoidance patterns.
86118. **Cross-team review pools** — Share reviewer capacity across teams during spikes with skill-tag filtering.
86119. **Meta-review of reviews** — Sample completed reviews and grade the review quality itself (thoroughness, tone, correctness).
86120. **Reviewer disagreement analytics** — Track how often each reviewer's decisions get overturned to spot calibration needs.
86121. **Review comment quality rubric** — Score review comments on specificity, actionability, and professionalism.
86122. **Review turnaround benchmarking** — Compare team turnaround against internal targets and industry peers quarterly.
86123. **Reviewer onboarding pipeline** — Move new reviewers through training, shadow shifts, and supervised reviews before solo certification rights.
86124. **Reviewer mentoring pairs** — Pair each junior reviewer with a senior mentor who co-reviews their first 50 findings.
86125. **Review queue dashboards** — Show depth, age distribution, SLA risk, and reviewer load in one live view.
86126. **Review batching strategies** — Group similar findings (same class, same target) for efficient context-switch-free review sessions.
86127. **Review time tracking** — Capture minutes per review automatically to feed cost accounting and capacity models.
86128. **Review cost accounting** — Attribute fully-loaded review cost to programs and findings for ROI reporting.
86129. **Quality-weighted review routing** — Route the hardest findings to reviewers with the best historical accuracy, not just availability.
86130. **Reviewer specialization tracks** — Certify reviewers in tracks (web, mobile, API, cloud, binary) and route accordingly.
86131. **Reviewer language proficiency matching** — Match report language to reviewer fluency, with translation QA fallback.
86132. **Reviewer timezone overlap optimization** — Prefer reviewers whose working hours overlap the finding author's for fast clarification loops.
86133. **Review handoff protocols** — Standardize what a reviewer must document when handing a review to another reviewer mid-flight.
86134. **Domain-expert escalation** — Escalate niche findings (crypto, kernel, ICS) to vetted domain experts outside the normal queue.
86135. **Critical review panel** — Convene a standing panel for critical-severity findings with mandatory multi-discipline representation.
86136. **Zero-day war-room protocol** — Define the rapid-review process (dedicated channel, decision log, comms plan) for suspected zero-days.
86137. **Review retrospective meetings** — Hold monthly reviews of the review process itself, with action items and owners.
86138. **Review process improvement proposals** — Accept structured improvement proposals from any reviewer with a defined evaluation path.
86139. **Reviewer suggestion box** — Collect anonymous tooling and process feedback from reviewers quarterly.
86140. **Review tooling feedback loop** — Feed reviewer UX pain points directly into the review platform roadmap.
86141. **Review keyboard-first UX** — Optimize the review interface for keyboard navigation to cut per-review handling time.
86142. **Review mobile support** — Allow approve/return/comment actions from mobile for on-call reviewers.
86143. **Review offline mode** — Cache assigned reviews for offline work with conflict-safe sync on reconnect.
86144. **Review notification preferences** — Let reviewers choose channels and digest frequency per event type to avoid alert fatigue.
86145. **Review digest emails** — Send daily summaries of queue state, SLA risks, and calibration tasks instead of per-item pings.
86146. **Review queue gamification** — Award points for quality-weighted throughput with safeguards against gaming.
86147. **Quality-weighted reviewer leaderboards** — Rank reviewers by accuracy-adjusted throughput, never raw volume alone.
86148. **Reviewer badges** — Grant visible badges for calibration streaks, zero-overturn months, and mentorship contributions.
86149. **Review streak tracking** — Track consecutive SLA-met weeks to recognize consistent reliability.
86150. **Review mentorship hours tracking** — Credit mentors for time spent coaching, counted toward their own quality goals.
86151. **Reviewer NPS** — Survey reviewers on process fairness and tooling quality twice a year.
86152. **Review dispute mediation** — Provide a neutral mediator path when author and reviewer deadlock, with binding decision rules.
86153. **Reviewer code of conduct** — Publish expected behaviors (respectful tone, evidence-based challenges) with enforcement steps.
86154. **Conflict-of-interest declaration** — Require reviewers to disclose relationships with finding authors or target vendors.
86155. **Reviewer recusal workflow** — Make recusal one click, no justification required, with automatic reassignment.
86156. **Review independence requirements** — Prohibit the finding author, their manager, and their mentees from reviewing it.
86157. **Review rotation to prevent capture** — Limit consecutive reviews of the same program by one reviewer to avoid cozy relationships.
86158. **Reviewer performance improvement plans** — Trigger structured PIPs with coaching when accuracy or SLA metrics fall below thresholds.
86159. **Reviewer offboarding** — Revoke certification rights, reassign queues, and archive decision history when reviewers leave.
86160. **Reviewer alumni network** — Keep former reviewers available for surge consulting and calibration panels.
86161. **Review queue SLA breach playbooks** — Define automatic actions (escalate, reassign, notify program) for each breach scenario.
86162. **Review queue auto-escalation** — Escalate aging items up the ladder without human intervention at defined thresholds.
86163. **Review queue overflow to partner teams** — Formalize cross-team overflow agreements with skill and SLA parity requirements.
86164. **Review capacity planning model** — Convert forecasted finding volume into reviewer headcount needs per tier and track.
86165. **Review hiring forecast** — Project reviewer hiring needs 6 months out from pipeline growth and attrition data.
86166. **Reviewer interview loop** — Standardize hiring with practical review exercises on historical findings.
86167. **Reviewer trial period** — Grant provisional certification with 100% meta-review during the first 90 days.
86168. **Reviewer shadow shifts** — Require new hires to shadow senior reviewers for two weeks before their first solo review.
86169. **Second-order review (QA of QA)** — Have principals periodically re-review certified findings to validate the review layer itself.
86170. **Review decision explanation requirement** — Require a written rationale for every reject or severity change, stored with the decision.
86171. **Review decision reversibility tracking** — Measure how often decisions are reversed on appeal as a reviewer quality signal.
86172. **Review reversal analytics** — Analyze reversal patterns by reviewer, class, and severity to target coaching.
86173. **Reviewer overturn rate monitoring** — Alert leads when a reviewer's overturn rate exceeds twice the team median.
86174. **Calibration-linked assignment** — Restrict reviewers to classes where their calibration scores are current and passing.
86175. **Reviewer trust tiers** — Grant auto-certify privileges for low-severity findings to reviewers with sustained high accuracy.
86176. **Review sandbox for experiments** — Let reviewers try new checklists or rubrics on historical findings without affecting live queues.
86177. **AI pre-review summaries** — Generate structured summaries (claims, evidence, gaps) so human reviewers start faster.
86178. **Review evidence re-verification steps** — Require reviewers to independently re-run key PoC steps for high-severity findings.
86179. **Review severity challenge process** — Give authors a formal, time-boxed path to challenge severity with new evidence.
86180. **Review audit trails** — Immutable logs of every review action, comment edit, and decision change.
86181. **Reviewer anonymity controls** — Let programs choose whether authors see reviewer identities, with anti-retaliation monitoring.
86182. **Review bias detection** — Statistically flag severity inflation or deflation patterns per reviewer vs the calibrated baseline.
86183. **Review language quality checks** — Lint reviewer comments for clarity and professionalism before they reach authors.
86184. **Review template enforcement** — Require structured review forms (verdict, rationale, evidence assessment) instead of free text.
86185. **Reviewer productivity dashboards** — Show each reviewer their throughput, accuracy, SLA compliance, and calibration status privately.
86186. **Reviewer burnout signals** — Detect declining quality or rising handle time as early warnings and trigger workload relief.
86187. **Review queue aging alerts** — Notify leads when the 90th-percentile queue age trends upward for three consecutive days.
86188. **Review delegation chains** — Allow multi-hop delegation with full visibility so accountability never gets lost.
86189. **Review pair sessions** — Schedule two reviewers to co-review complex findings live, splitting evidence and reasoning checks.
86190. **Review office hours** — Hold weekly open sessions where authors can ask reviewers clarifying questions.
86191. **Reviewer certification paths** — Define clear, public criteria for advancing reviewer tiers.
86192. **Reviewer deactivation criteria** — Publish objective triggers (sustained low accuracy, conduct violations) for suspending review rights.
86193. **Review queue fairness metrics** — Ensure no reviewer is systematically assigned only low-value or only punishing work.
86194. **Skill-tagged reviewer directory** — Maintain searchable reviewer profiles (classes, stacks, languages, certifications).
86195. **Review buddy system** — Assign every reviewer a peer buddy for second opinions on ambiguous calls.
86196. **Review decision SLAs for appeals** — Commit to appeal decision timelines separately from initial review SLAs.
86197. **Review tooling uptime SLA** — Guarantee review platform availability with the same seriousness as production systems.
86198. **Review data export** — Let quality analysts export anonymized review data for research and benchmarking.
86199. **Review API for automation** — Allow programmatic assignment, status checks, and decision posting for integrated workflows.
86200. **Reviewer wellness program** — Provide rotation off high-severity queues and mental-health resources for reviewers handling disturbing content.
86201. **Review queue simulation** — Model queue behavior under staffing changes before making them.
86202. **Review quality incentives** — Tie bonuses and recognition to accuracy and calibration scores, not volume.
86203. **Review knowledge base** — Capture exemplary reviews as training examples with reviewer permission.
86204. **Review process maturity reviews** — Assess the peer-review system itself annually against the quality maturity model.
86205. **Per-class validity definitions** — Publish explicit criteria for what counts as a valid finding for each vulnerability class (e.g., XSS requires executed PoC).
86206. **Reproducibility criteria** — Require step-by-step reproduction that an independent validator can follow without author assistance.
86207. **Environment specification requirements** — Mandate target version, browser, OS, and configuration details needed to reproduce.
86208. **Scope verification rules** — Define how reviewers confirm the affected asset was in scope at discovery time, using archived scope snapshots.
86209. **Duplicate determination criteria** — Standardize when two findings are the same root cause vs distinct issues sharing symptoms.
86210. **CVSS v4 adoption standard** — Require CVSS v4 vectors with documented rationale for every scored finding.
86211. **Exploitability ladder** — Define levels from theoretical to weaponized with evidence required at each rung.
86212. **Impact demonstration requirements** — Specify what proof of impact each severity demands (data read, write, RCE, etc.).
86213. **Vulnerability chaining rules** — Govern when chained primitives count as one finding vs several, and how severity combines.
86214. **Out-of-scope determination rules** — Checklist for scope rulings with mandatory evidence (scope doc version, asset inventory).
86215. **Informational vs finding thresholds** — Draw the line between hardening suggestions and reportable findings per program.
86216. **Wont-fix category taxonomy** — Standardize wont-fix reasons (accepted risk, compensating control, end-of-life) with required justification.
86217. **Validation environment parity** — Require validation in an environment matching production configuration, documented explicitly.
86218. **Third-party component rules** — Define when vulnerabilities in dependencies count (exploitable in context vs merely present).
86219. **Rate-limit vs vulnerability distinction** — Standardize when missing rate limiting is a finding vs an accepted design choice.
86220. **Best-practice vs vulnerability line** — Codify which missing headers or configs are findings and which are informational.
86221. **Validation evidence minimums per severity** — Matrix of required artifacts (screenshots, requests, videos) scaled by severity.
86222. **Validation timeout standards** — Set maximum reasonable validation effort per class so validators don't gold-plate.
86223. **Retest validation criteria** — Define what proves a fix works, including regression checks on adjacent functionality.
86224. **Fix-completeness validation** — Require validators to check the fix addresses root cause, not just the reported PoC.
86225. **Partial fix handling** — Standardize severity and status when a fix mitigates but doesn't eliminate the issue.
86226. **Validation sampling for large-scale issues** — Define statistically valid sampling when an issue affects thousands of assets.
86227. **Mass-assignment validation rules** — Specify which parameter-binding behaviors constitute a finding vs framework defaults.
86228. **Business logic validation standards** — Require abuse-case narratives with quantified business impact for logic flaws.
86229. **Authentication bypass validation** — Mandate multi-account, multi-role test matrices for auth findings.
86230. **IDOR validation standard** — Require cross-account object access proof with clear ownership boundaries documented.
86231. **SSRF validation standard** — Require internal metadata or service interaction proof, never just outbound request logs.
86232. **SSTI validation standard** — Require template-context execution proof distinguishing SSTI from reflected content.
86233. **Deserialization validation standard** — Require gadget-chain or state-manipulation proof beyond error messages.
86234. **Race condition validation standard** — Require timing logs and success-rate statistics across repeated attempts.
86235. **Cryptography validation standards** — Require test vectors and parameter analysis, not just "weak algorithm" claims.
86236. **Scanner-reported finding validation** — Apply human verification rules to tool output with mandatory manual confirmation steps.
86237. **Validation confidence levels** — Label each validated finding high/medium/low confidence with defined meanings.
86238. **Validation labels taxonomy** — Standardize labels (confirmed, likely, needs-info, disputed) used across the pipeline.
86239. **Validation uncertainty handling** — Define what happens when evidence is suggestive but not conclusive (escalate, don't guess).
86240. **Validation when vendor disputes** — Process for re-validation with fresh eyes when the asset owner contests a finding.
86241. **Design flaw validation** — Standards for validating architectural issues that lack a simple PoC.
86242. **Missing-control validation** — Rules for when absence of a control (MFA, logging) is a finding, requiring threat-model context.
86243. **Validation effort estimation** — Provide per-class effort benchmarks to plan validator capacity.
86244. **Validation playbook library** — Maintain step-by-step validation playbooks for the top 50 vulnerability classes.
86245. **Validation tooling standards** — Approve and version the tools validators may use, with output-format requirements.
86246. **Validation data handling rules** — Prohibit exfiltration of real PII during validation; require synthetic or redacted data.
86247. **Validation safe-harbor rules** — Define the authorized testing boundaries validators must stay within.
86248. **Scope expansion request process** — Formalize how validators request testing beyond original scope when pivoting.
86249. **Chained finding validation** — Validate each link in a chain independently before accepting the combined severity.
86250. **Severity upgrade criteria** — Define the evidence bar for raising severity after initial triage.
86251. **Severity downgrade criteria** — Define the evidence bar for lowering severity, protecting against unjustified downgrades.
86252. **CVSS vector correctness checks** — Validate each CVSS metric choice against the standard's definitions with examples.
86253. **Affected versions validation** — Require version-range testing or code analysis, not just "latest is affected" assumptions.
86254. **Remediation advice accuracy checks** — Verify fix guidance is correct, complete, and version-appropriate.
86255. **Reference link validation** — Check that citations support the claims made and aren't dead or irrelevant.
86256. **PoC code safety review** — Scan submitted PoC code for malicious payloads before validators execute it.
86257. **PoC determinism checks** — Require PoCs to succeed reliably, with flaky PoCs flagged for rework.
86258. **PoC environment cleanup verification** — Confirm validation activities leave no residual changes or test data.
86259. **Report field completeness validation** — Enforce required fields per severity before a finding can advance.
86260. **Title and description clarity standards** — Require titles that name the flaw and asset; ban vague titles like "Security issue".
86261. **Readability scoring for findings** — Score descriptions with readability metrics and flag those below threshold.
86262. **Cross-finding consistency checks** — Flag when similar findings get different severities, forcing reconciliation.
86263. **Historical precedent lookup** — Surface how similar past findings were dispositioned to guide consistent validation.
86264. **Platform rule ingestion** — Import HackerOne, Bugcrowd, Intigriti, and YesWeHack program rules into validation checklists.
86265. **Platform rule diff alerts** — Notify validators when a program changes its rules mid-engagement.
86266. **Validation SLA per severity** — Time-box validation effort with escalation when exceeded.
86267. **Validation queue triage** — Prioritize validation work by severity, bounty value, and disclosure deadlines.
86268. **Validation assignment** — Route validation tasks by required skills and validator certification.
86269. **Validation outcome codes** — Standardize validation results for analytics (confirmed, FP, duplicate, needs-info).
86270. **Validation FP root-cause tagging** — Tag every false positive with its root cause for systemic analysis.
86271. **Validation metrics dashboard** — Track confirmation rate, cycle time, and overturn rate per validator and class.
86272. **Validation calibration** — Include validators in severity calibration exercises, not just reviewers.
86273. **Validator certification** — Certify validators per class with practical exams on historical findings.
86274. **Validation audit sampling** — Independently re-validate a sample of confirmed findings to measure validator accuracy.
86275. **Validation inter-rater checks** — Have two validators independently validate a sample to measure agreement.
86276. **Validation appeal process** — Give authors a structured path to contest validation outcomes with new evidence.
86277. **Validation finality rules** — Define when a validation decision is final vs reopenable on new evidence.
86278. **Validation record retention** — Keep validation artifacts for the program's required retention period.
86279. **Validation export formats** — Export validation packages (evidence + decision) in standard formats for clients.
86280. **Validation API** — Programmatic access to validation status, assignments, and outcomes.
86281. **Validation webhook events** — Push validation completions and disputes to integrated systems.
86282. **Validation dashboard** — Live view of validation queue, throughput, and quality metrics.
86283. **Validation trend reports** — Monthly analysis of confirmation rates and FP causes by class.
86284. **Validation benchmarking** — Compare validation accuracy and speed against industry peers.
86285. **Validation cost per finding** — Track fully-loaded validation cost to optimize the human/automation mix.
86286. **Validation automation coverage** — Measure what share of validation steps are automated vs manual per class.
86287. **Human-in-loop triggers** — Define confidence and risk thresholds that force human validation of agent findings.
86288. **AI finding validation standards** — Apply extra scrutiny (hallucination checks, reasoning-trace review) to agent-discovered findings.
86289. **Provenance labeling** — Mark every finding human, AI-assisted, or fully automated through validation.
86290. **Reasoning trace review** — Require validators to spot-check agent reasoning traces for flawed logic behind AI findings.
86291. **Validation red-teaming** — Periodically test validators with planted flawed findings to measure vigilance.
86292. **Validation of validation tooling** — Certify the scanners and scripts used in validation against known ground truth.
86293. **Validation knowledge base** — Maintain a searchable library of validation precedents and edge-case rulings.
86294. **Validation glossary** — Define terms (exploitable, confirmed, impactful) precisely to prevent semantic drift.
86295. **Validation for mobile findings** — Require device, OS version, and app build details with screen recordings.
86296. **Validation for API findings** — Require complete request collections and authentication context.
86297. **Validation for cloud findings** — Require configuration snapshots and blast-radius analysis.
86298. **Validation for IoT findings** — Require firmware version and hardware revision documentation.
86299. **Validation for AI/ML findings** — Require model version, dataset details, and attack success-rate statistics.
86300. **Validation multilingual support** — Provide playbooks and rubrics in reviewers' working languages.
86301. **Validation accessibility** — Ensure validation tooling works with assistive technologies.
86302. **Validation continuous improvement** — Feed validation metrics into quarterly standard revisions.
86303. **Validation standard ownership** — Assign a named owner per vulnerability class playbook with review cadence.
86304. **Validation standard changelog** — Publish every change to validation standards with rationale and effective date.
86305. **Required artifacts matrix per severity** — Publish exactly which evidence types each severity demands (e.g., critical needs video + requests + logs).
86306. **Screenshot annotation standards** — Require highlighted, redacted, full-context screenshots with timestamps and URLs visible.
86307. **Video PoC standards** — Cap length, require narration or captions, timestamps, and unedited single-take recordings.
86308. **HTTP capture standards** — Require raw request/response pairs with headers, reproducible via exported collections.
86309. **Log capture standards** — Define which server, application, and timing logs must accompany time-based or blind findings.
86310. **Environment metadata standards** — Mandate browser, OS, app version, and test-account roles recorded with every finding.
86311. **Chain-of-custody hashing** — Hash every evidence file at capture and verify at each QA stage to detect tampering.
86312. **Evidence tamper detection** — Flag metadata inconsistencies (edited screenshots, spliced videos) with automated checks.
86313. **Evidence retention tiers** — Keep critical evidence for 7 years, lows for 2, with automated lifecycle enforcement.
86314. **Evidence PII redaction standards** — Define what must be redacted (names, emails, tokens) and verify redaction before sharing.
86315. **Evidence storage encryption** — Encrypt evidence at rest and in transit with per-program access controls.
86316. **Evidence access controls** — Restrict evidence visibility by role, program, and need-to-know with full access logging.
86317. **Evidence completeness scoring algorithm** — Score each finding 0–100 on artifact presence, quality, and relevance.
86318. **Evidence gap detection** — Automatically identify missing artifacts for the finding's class and severity, and request them.
86319. **Evidence request-back workflow** — Structured loop for asking authors for missing evidence with deadlines and escalation.
86320. **Evidence freshness requirements** — Require re-capture when evidence is older than the program's freshness window.
86321. **Reproducibility packaging** — Encourage containerized or scripted PoCs that validators can run with one command.
86322. **Logic flaw evidence standard** — Require abuse-case narrative plus transaction traces showing the business impact.
86323. **Auth finding evidence matrix** — Require multi-account, multi-role test matrices with session artifacts.
86324. **Crypto evidence standard** — Require test vectors, parameter dumps, and attack cost estimates.
86325. **Race condition evidence standard** — Require timing logs, attempt counts, and success-rate statistics.
86326. **SSRF evidence standard** — Require callback server logs proving internal interaction, with redacted internals.
86327. **Stored XSS persistence proof** — Require proof the payload persists across sessions and affects other users.
86328. **Blind SQLi evidence standard** — Require time-based or out-of-band logs with statistical significance, not single samples.
86329. **Evidence completeness checklist engine** — Generate dynamic checklists per class/severity inside the submission UI.
86330. **Evidence template library** — Provide fill-in templates for common evidence types (request pairs, impact narratives).
86331. **Evidence quality rubric** — Score evidence on clarity, completeness, reproducibility, and redaction quality.
86332. **Evidence reviewer certification** — Certify reviewers specifically on evidence assessment with practical exams.
86333. **Evidence sampling audits** — Independently audit a sample of certified evidence packages quarterly.
86334. **Evidence inter-rater reliability** — Measure agreement between reviewers scoring the same evidence packages.
86335. **Evidence defect taxonomy** — Classify evidence defects (missing, unclear, unreproducible, unredacted) for trend analysis.
86336. **Evidence root-cause analysis** — Investigate why evidence gaps recur (tooling, training, incentives) and fix systemically.
86337. **Evidence quality coaching** — Coach authors with repeated evidence gaps using their own anonymized examples.
86338. **Evidence linter automation** — Automatically check screenshots for annotations, videos for length, requests for completeness.
86339. **Evidence trend dashboards** — Track completeness scores over time by author, class, and program.
86340. **Evidence benchmarking** — Compare evidence quality against industry peers and top bounty programs.
86341. **Mobile evidence standard** — Require device model, OS version, app build, and screen recordings for mobile findings.
86342. **API evidence standard** — Require exported collections (Postman/Burp) with environment variables documented.
86343. **Cloud evidence standard** — Require configuration snapshots, policy documents, and blast-radius diagrams.
86344. **Evidence versioning** — Version evidence packages so updates don't silently replace what reviewers approved.
86345. **Evidence supersession rules** — Define when new evidence replaces old vs appends, with reviewer visibility.
86346. **Evidence deduplication** — Detect identical evidence files reused across findings to catch copy-paste.
86347. **Evidence compression standards** — Balance file size and fidelity with approved codecs and resolution floors.
86348. **Evidence watermarking** — Watermark shared evidence with recipient identity to deter leaks.
86349. **Evidence legal hold** — Freeze deletion for evidence under litigation or regulatory hold.
86350. **Evidence PDF export** — Render evidence packages into tamper-evident PDFs with hashes and timestamps.
86351. **Evidence chain export** — Export the full chain-of-custody log alongside evidence for client audits.
86352. **Integrity verification on download** — Verify hashes automatically when anyone downloads evidence.
86353. **Evidence expiry for time-sensitive findings** — Flag evidence that may no longer reproduce after target changes.
86354. **Evidence re-capture requests** — Formalize requesting fresh evidence with clear reasons and deadlines.
86355. **Evidence annotation tools** — Provide built-in screenshot and video annotation in the submission platform.
86356. **Before/after evidence comparison** — Side-by-side view of vulnerable vs fixed state for retest findings.
86357. **Dispute evidence packaging** — One-click bundle of all evidence and decisions for appeals or platform disputes.
86358. **Evidence multilingual support** — Support evidence narratives in multiple languages with translation QA.
86359. **Evidence accessibility** — Require alt-text for screenshots and transcripts for videos.
86360. **Evidence search and indexing** — Full-text and metadata search across the evidence corpus for precedent research.
86361. **Evidence tagging taxonomy** — Standard tags (poc, impact, config, log) for filtering and analytics.
86362. **Evidence linking to code commits** — Link findings to the fixing commit for closed-loop verification.
86363. **Evidence linking to tickets** — Bidirectional links between findings and remediation tickets.
86364. **Evidence completeness SLA** — Time-box how long authors get to complete evidence before the finding is paused.
86365. **Evidence as report gate** — Block report certification until the completeness score meets the severity threshold.
86366. **Evidence score in dashboards** — Surface completeness scores on every quality dashboard and scorecard.
86367. **Evidence quality SLAs** — Commit to evidence review turnaround separate from technical review.
86368. **Evidence reviewer workload** — Balance evidence-review assignments to avoid bottlenecks at the completeness gate.
86369. **Evidence automation coverage metrics** — Track what share of evidence checks are automated per class.
86370. **AI-assisted completeness checking** — Use models to pre-score evidence completeness and suggest missing artifacts.
86371. **Missing-field prediction** — Predict which required fields authors will omit and prompt proactively.
86372. **Evidence auto-redaction** — Automatically detect and redact secrets, tokens, and PII in uploaded evidence.
86373. **Evidence OCR for screenshots** — Extract text from screenshots to verify URLs, timestamps, and error messages.
86374. **Evidence video transcription** — Transcribe narrated PoC videos for searchability and reviewer speed.
86375. **Evidence metadata extraction** — Pull EXIF, creation dates, and tool versions automatically for provenance.
86376. **Geolocation stripping** — Remove GPS metadata from evidence files before storage or sharing.
86377. **EXIF sanitization** — Strip device-identifying metadata from images while preserving capture timestamps.
86378. **Evidence file type allowlist** — Accept only approved formats to reduce malware and compatibility risk.
86379. **Evidence malware scanning** — Scan all uploads for malware before they reach reviewer machines.
86380. **Evidence size limits** — Enforce per-file and per-finding size caps with guided compression.
86381. **Evidence chunked upload** — Support resumable uploads for large video evidence.
86382. **Evidence offline capture** — Provide a desktop capture tool that works offline and syncs later.
86383. **Evidence mobile capture app** — Native mobile app for capturing and annotating mobile findings.
86384. **Evidence browser extension** — One-click capture of requests, screenshots, and console logs from the browser.
86385. **Evidence CLI capture tool** — Command-line tool for API and infrastructure findings to bundle evidence.
86386. **Evidence API ingestion** — Accept evidence packages programmatically from hunting agents and scanners.
86387. **Evidence webhook ingestion** — Receive evidence from external tools via signed webhooks.
86388. **Evidence quality OKRs** — Set quarterly objectives for completeness scores and gap-closure rates.
86389. **Evidence quality incentives** — Recognize authors and reviewers with consistently high evidence quality.
86390. **Evidence continuous improvement** — Review evidence standards quarterly against FP causes and reviewer feedback.
86391. **Evidence standard ownership** — Assign owners per evidence type with a defined review cadence.
86392. **Evidence precedent library** — Showcase exemplary evidence packages as training references.
86393. **Evidence anti-pattern gallery** — Show anonymized poor evidence with explanations to train authors.
86394. **Evidence for AI findings** — Require reasoning traces and tool-call logs alongside traditional artifacts.
86395. **Evidence hallucination checks** — Verify AI-generated evidence artifacts correspond to real observed behavior.
86396. **Evidence provenance for agents** — Record which agent, model, and prompt version produced each artifact.
86397. **Evidence cross-validation** — Require independent re-capture for critical findings by a second party.
86398. **Evidence statistical significance** — Define minimum trial counts for probabilistic findings (race conditions, blind injection).
86399. **Evidence negative controls** — Require proof that the PoC fails where it should (e.g., low-privilege account unaffected).
86400. **Evidence peer attestation** — Allow a second researcher to attest reproducibility with their own environment details.
86401. **Evidence timestamp authority** — Use trusted timestamps so evidence age can't be disputed.
86402. **Evidence disclosure packaging** — Prepare vendor-safe evidence bundles stripped of internal notes for disclosure.
86403. **Evidence archival format** — Store long-term evidence in open, future-readable formats with format migration plans.
86404. **Evidence quality maturity model** — Assess evidence practices on a 5-level scale with a published improvement roadmap.
86405. **Pre-submission report lint** — Run automated checks (structure, links, secrets, clarity) on every report before it can enter review.
86406. **Blocking quality rules** — Hard-block submission when critical defects exist (missing PoC, dead links, exposed secrets).
86407. **Severity-gated report requirements** — Demand executive summary, business impact, and remediation plan for high/critical reports.
86408. **Readability scoring gate** — Block reports below a readability threshold with specific rewrite guidance.
86409. **Title quality checks** — Enforce titles that name the vulnerability class and affected asset; reject generic titles.
86410. **Description structure enforcement** — Require summary, impact, reproduction, and remediation sections in a fixed order.
86411. **Impact statement requirement** — Every report must state concrete impact (data exposed, privilege gained) in business terms.
86412. **Remediation advice quality check** — Verify fix guidance is specific, version-appropriate, and validated against references.
86413. **CVSS vector validation gate** — Reject reports with malformed or unjustified CVSS vectors before review.
86414. **Report citation integrity checks** — Check all citations resolve and actually support the claims made.
86415. **Duplicate title detection** — Warn when a report title closely matches an existing finding to catch duplicates early.
86416. **Tone and professionalism check** — Flag aggressive, informal, or unprofessional language before client delivery.
86417. **PII leak scan in reports** — Block reports containing unredacted personal data with exact location highlighted.
86418. **Secret scan in reports** — Block reports containing API keys, tokens, or credentials accidentally pasted.
86419. **PoC safety scan** — Analyze embedded PoC code for destructive or malicious behavior before distribution.
86420. **Screenshot presence check** — Require at least one annotated screenshot for UI-affecting findings.
86421. **Minimum evidence thresholds** — Enforce the artifacts matrix from evidence standards as a hard gate.
86422. **Executive summary requirement** — Mandate a non-technical summary for criticals suitable for leadership.
86423. **Business impact quantification** — Require estimated affected users, records, or revenue at risk for highs and criticals.
86424. **Affected asset inventory** — Require enumerated affected hosts, endpoints, or components with versions.
86425. **Fix verification steps** — Require explicit steps the asset owner can follow to confirm remediation.
86426. **Report completeness score** — Compute 0–100 and block below per-severity floors.
86427. **Quality gate bypass authorization** — Allow bypass only with named approver, reason, and expiry; log all bypasses.
86428. **Gate override audit log** — Immutable record of every override with who, why, and what was skipped.
86429. **Gate configuration per program** — Let programs tune strictness while global minimums remain non-negotiable.
86430. **Gate versioning** — Version gate rule sets so reports are judged against the rules active at submission.
86431. **Gate A/B testing** — Trial stricter gates on a cohort and measure FP reduction vs author friction.
86432. **Gate false-block monitoring** — Track how often gates block reports that reviewers would have accepted, and tune.
86433. **Gate appeal process** — Give authors a fast path to contest automated blocks with human review.
86434. **Gate analytics dashboard** — Show block rates, top blocked rules, and author rework time.
86435. **Gate latency impact** — Measure and budget the time gates add to the submission flow.
86436. **Gate rule marketplace** — Share community-contributed gate rules (e.g., for new vulnerability classes) with ratings.
86437. **Custom gate rules DSL** — Let quality leads write program-specific rules in a safe domain-specific language.
86438. **Gate CI integration** — Run report linting in CI for agent-generated reports before they reach humans.
86439. **Gate webhooks** — Notify external systems on gate pass/fail for workflow automation.
86440. **Gate API** — Programmatic gate evaluation for bulk imports and agent pipelines.
86441. **Gate notifications** — Tell authors exactly which rules failed and how to fix them, with examples.
86442. **Gate training mode** — Warn without blocking during rollout so authors learn the rules first.
86443. **Gate rollout stages** — Deploy new rules as warn → soft-block → hard-block with measured transitions.
86444. **Gate rollback** — Revert a rule version instantly when it causes excessive false blocks.
86445. **Gate change log** — Publish every gate rule change with rationale and effective date.
86446. **Gate ownership** — Assign a named owner per rule responsible for tuning and false-block review.
86447. **Gate review cadence** — Reassess every rule quarterly against block precision data.
86448. **Gate benchmarking** — Compare gate strictness and precision against peer organizations.
86449. **Gate maturity model** — Assess gating practices from ad-hoc to fully automated with a roadmap.
86450. **Report scoring model** — ML model predicting report quality from text, structure, and evidence features.
86451. **Report grades (A–F)** — Assign transparent grades driving routing (A auto-fast-track, D mandatory senior review).
86452. **Report quality SLA** — Commit to first-review turnaround by report grade.
86453. **Report rework loops** — Track return-for-rework cycles per report and flag chronic rework patterns.
86454. **Report rework analytics** — Analyze top rework causes to target author training and gate rules.
86455. **Report first-pass yield** — Measure the share of reports passing gates and review without rework.
86456. **Report defect density** — Track defects per report by author, class, and program over time.
86457. **Report coaching triggers** — Auto-enroll authors in coaching after repeated gate failures on the same rule.
86458. **Report template enforcement** — Lock section structure while allowing content flexibility.
86459. **Section word-count floors** — Require minimum substantive content per section to prevent one-line reports.
86460. **Jargon detection** — Flag unexplained acronyms and suggest plain-language alternatives.
86461. **Clarity scoring (Flesch)** — Score reading ease and require minimums for client-facing sections.
86462. **Translation quality gate** — Check machine-translated reports for fidelity before cross-language review.
86463. **Consistency checks** — Flag contradictions between severity, CVSS, impact statement, and evidence.
86464. **Historical comparison** — Compare new reports against the author's past quality to detect drift.
86465. **Plagiarism detection** — Detect copy-pasted text across findings, which often signals low-effort or wrong details.
86466. **AI-generation disclosure** — Require labeling of AI-drafted report sections for appropriate scrutiny.
86467. **Report provenance labeling** — Show human/AI contribution breakdown per section.
86468. **Reviewer sign-off gate** — Block certification until the assigned reviewer records an explicit decision.
86469. **Dual sign-off for criticals** — Require two independent sign-offs before a critical report ships.
86470. **Legal review trigger** — Route reports with disclosure, liability, or regulatory implications to legal.
86471. **Embargo handling gate** — Hold reports under coordinated disclosure until the embargo lifts.
86472. **Customer preview workflow** — Share draft reports with the program for factual accuracy check before final.
86473. **Report redaction workflow** — Structured redaction of internal notes and sensitive details before external sharing.
86474. **PDF rendering checks** — Verify exported PDFs render correctly (fonts, images, page breaks) automatically.
86475. **Report accessibility checks** — Ensure PDFs meet accessibility standards (tagged, alt-text, reading order).
86476. **Report branding compliance** — Enforce program-specific branding, headers, and disclosure footers.
86477. **Report versioning** — Version every report revision with diffs and approval history.
86478. **Report amendment workflow** — Controlled process for correcting shipped reports with client notification.
86479. **Report retraction workflow** — Formal retraction with reason, notifications, and audit trail for invalid shipped findings.
86480. **Report archival quality** — Verify archived reports remain complete and readable after format migrations.
86481. **Report search quality** — Ensure reports are indexed with metadata for future precedent research.
86482. **Report feedback capture** — Collect recipient ratings and comments on every delivered report.
86483. **Report recipient ratings** — 1–5 star ratings from programs feeding author and reviewer quality scores.
86484. **Report NPS** — Survey program contacts on overall report quality twice a year.
86485. **Report quality trend** — Track grades, rework, and ratings over time by author, team, and program.
86486. **Report quality benchmarking** — Compare report quality metrics against industry peers.
86487. **Report quality OKRs** — Set quarterly objectives for first-pass yield and recipient ratings.
86488. **Report quality incentives** — Reward sustained A-grade reporting with recognition and advancement credit.
86489. **Report quality in performance reviews** — Make report quality a formal component of researcher evaluations.
86490. **Auto-improvement suggestions** — AI suggestions to strengthen weak sections before submission.
86491. **Report rewrite assistance** — Guided rewriting tool that preserves technical accuracy while improving clarity.
86492. **Report summarization quality** — Check auto-generated executive summaries for fidelity to the full report.
86493. **Report diff view** — Side-by-side diff of revisions for reviewers and auditors.
86494. **Comment resolution tracking** — Ensure every reviewer comment is addressed or explicitly dismissed with reason.
86495. **Report approval chain** — Configurable multi-level approval for sensitive or high-value reports.
86496. **Gate stage SLAs** — Time-box each gate stage separately with its own escalation.
86497. **Stricter gates for AI findings** — Apply additional hallucination and claim-verification checks to agent-authored reports.
86498. **Humanization check** — Flag reports that read as unreviewed AI output for mandatory human editing.
86499. **Hallucination detection** — Cross-check factual claims (versions, URLs, behaviors) against captured evidence.
86500. **Claim verification pipeline** — Systematically verify each technical claim in a report against its evidence.
86501. **Citation checking** — Verify that cited CVEs, advisories, and docs actually support the statements made.
86502. **Fact-check sampling** — Human fact-checkers audit a sample of AI-generated reports for accuracy.
86503. **Report quality postmortems** — Investigate high-impact report failures (wrong severity shipped, missing impact) blamelessly.
86504. **Report quality handbook** — Living guide with examples of excellent reports per class, updated quarterly.
86505. **Precision/recall definitions for findings** — Formally define true positive, false positive, and missed finding for security-finding operations.
86506. **Ground-truth dataset curation** — Build a labeled corpus of findings with expert-verified correct dispositions.
86507. **Labeled finding corpus** — Maintain thousands of findings labeled valid/FP/duplicate with rationales for measurement.
86508. **Precision tracking per reviewer** — Compute each reviewer's precision from audit samples with confidence intervals.
86509. **Recall estimation via sampling** — Estimate missed findings by re-hunting sampled targets with independent teams.
86510. **Recall via red-team seeding** — Plant known vulnerabilities and measure what fraction the pipeline catches.
86511. **Seeded vulnerability injection** — Continuously inject synthetic flaws into test targets to measure detection recall.
86512. **Precision by severity** — Track precision separately per severity since critical FPs cost more than low FPs.
86513. **Precision by vulnerability class** — Identify which classes suffer low precision and target them for process fixes.
86514. **Precision by program** — Compare precision across bounty programs to spot scope or rule-clarity problems.
86515. **Precision by agent version** — Measure how each model or prompt change affects finding precision.
86516. **Recall by class** — Determine which vulnerability classes are systematically under-detected.
86517. **F1 dashboards** — Present precision, recall, and F1 together so teams optimize the balance, not one metric.
86518. **Accuracy over time** — Plot precision/recall trends to show whether quality initiatives actually work.
86519. **Accuracy regression alerts** — Alert when precision drops beyond statistical noise after a process or model change.
86520. **Accuracy after process changes** — Require before/after accuracy measurement for every QA process change.
86521. **Accuracy A/B tests** — Randomize findings between process variants and compare measured accuracy.
86522. **Accuracy confidence intervals** — Report uncertainty bounds on all accuracy metrics to prevent overreaction to noise.
86523. **Sample-size calculator** — Compute how many audits are needed for a target confidence level per metric.
86524. **Stratified sampling for accuracy** — Stratify audits by severity, class, and reviewer for representative measurement.
86525. **Accuracy audit methodology** — Document the independent re-review process used to establish ground truth.
86526. **Accuracy reviewer agreement** — Measure agreement between accuracy auditors themselves to validate the measurement.
86527. **Accuracy vs platform acceptance correlation** — Check that internal precision predicts actual bounty platform acceptance.
86528. **Accuracy leading indicators** — Track early signals (evidence scores, calibration drift) that predict precision drops.
86529. **Accuracy lagging indicators** — Monitor platform rejection rates and dispute losses as ground-truth outcomes.
86530. **Accuracy OKRs** — Set quarterly precision and recall objectives with clear owners.
86531. **Accuracy incentives** — Reward teams for sustained accuracy improvements, not just volume.
86532. **Accuracy in performance reviews** — Include precision/recall contributions in researcher and reviewer evaluations.
86533. **Accuracy coaching triggers** — Auto-trigger coaching when a reviewer's precision falls below threshold for two periods.
86534. **Accuracy improvement plans** — Structured plans with root-cause analysis and measurable targets for struggling reviewers.
86535. **Accuracy root-cause analysis** — Investigate precision drops with 5-whys to find systemic causes.
86536. **Accuracy defect taxonomy linkage** — Break precision losses down by defect type to target the biggest causes.
86537. **Accuracy by evidence quality** — Correlate evidence completeness scores with downstream precision.
86538. **Accuracy by finding source** — Compare precision of human, AI-assisted, and fully automated findings.
86539. **Accuracy by automation level** — Measure precision at each automation stage to find where quality leaks in.
86540. **Accuracy benchmarking vs industry** — Compare precision/recall against anonymized peer data.
86541. **Accuracy benchmarking vs peers** — Internal benchmarking across teams to spread best practices.
86542. **Accuracy public reporting** — Publish aggregate accuracy metrics to build trust with programs and researchers.
86543. **Accuracy internal scorecards** — Monthly scorecards per team with precision, recall, and trend.
86544. **Accuracy data pipeline** — Automated ETL from pipeline events into the accuracy warehouse.
86545. **Accuracy warehouse schema** — Star schema (findings, decisions, audits, reviewers) optimized for quality analytics.
86546. **Accuracy BI dashboards** — Self-serve dashboards for leads to slice accuracy by any dimension.
86547. **Accuracy alerting** — Real-time alerts on metric breaches with runbook links.
86548. **Accuracy anomaly detection** — Statistical detection of unusual precision/recall shifts.
86549. **Accuracy drift detection** — Distinguish gradual drift from sudden breaks for appropriate response.
86550. **Accuracy seasonal adjustment** — Account for holiday staffing and program cycles when interpreting trends.
86551. **Accuracy normalization** — Normalize metrics for finding mix so teams aren't punished for harder portfolios.
86552. **Accuracy weighting by severity** — Weight errors by severity so critical FPs count more than low FPs.
86553. **Cost-of-error modeling** — Quantify the dollar cost of FPs (rework, reputation) and misses (risk) to prioritize fixes.
86554. **ROI of QA** — Compare QA spend against error-cost reduction to justify quality investment.
86555. **Accuracy staffing model** — Convert accuracy targets into required reviewer headcount and skill mix.
86556. **Accuracy capacity planning** — Forecast audit and review capacity needed to sustain accuracy SLAs.
86557. **Accuracy SLA** — Commit to minimum precision levels per severity tier.
86558. **Accuracy SLOs** — Set service-level objectives (e.g., 95% precision on highs) with error budgets.
86559. **Accuracy error budgets** — Allow bounded FP rates per period; freeze risky changes when the budget is exhausted.
86560. **Accuracy blameless postmortems** — Review major accuracy incidents without blame, producing systemic fixes.
86561. **Accuracy incident reviews** — Treat shipped critical FPs as incidents with formal review.
86562. **Accuracy knowledge base** — Document lessons from accuracy investigations for future reference.
86563. **Accuracy training data** — Feed adjudicated findings back into agent and reviewer training.
86564. **Accuracy calibration linkage** — Use accuracy data to choose calibration exercise topics.
86565. **Accuracy certification linkage** — Require minimum measured precision to earn or keep reviewer certification.
86566. **Accuracy sampling audit linkage** — Size audit samples from accuracy targets and current uncertainty.
86567. **Accuracy inter-rater linkage** — Combine IRR and accuracy data to distinguish disagreement from error.
86568. **Accuracy feedback loop** — Close the loop from measurement to process change with tracked actions.
86569. **Platform feedback ingestion** — Parse accept/reject decisions from bounty platforms into accuracy metrics.
86570. **Accept/reject reason-code taxonomy** — Normalize platform rejection reasons into analyzable categories.
86571. **Duplicate-adjusted precision** — Compute precision excluding duplicates to separate dedup quality from validity quality.
86572. **Scope-adjusted metrics** — Adjust accuracy for scope difficulty so narrow scopes don't inflate precision.
86573. **Time-to-detect** — Measure how long known-seeded flaws survive before detection as a recall proxy.
86574. **Time-to-validate** — Track validation cycle time as a quality-system efficiency metric.
86575. **Accuracy aging** — Analyze whether older findings in queue lose accuracy (stale evidence, changed targets).
86576. **Backlog impact on accuracy** — Measure how queue depth correlates with precision to justify staffing.
86577. **Queue health correlation** — Link queue metrics to accuracy outcomes in a unified model.
86578. **Reviewer workload correlation** — Quantify how overload degrades individual precision.
86579. **Tool-assisted measurement** — Use LLMs as first-pass accuracy judges with human adjudication of disagreements.
86580. **LLM-judge validation** — Validate LLM judges against human ground truth before trusting their scores.
86581. **Human-judge panels** — Convene expert panels for the highest-stakes accuracy adjudications.
86582. **Judge agreement measurement** — Track agreement between human and LLM judges over time.
86583. **Judge calibration** — Calibrate LLM judges with the same exercises used for human reviewers.
86584. **Gold-standard maintenance** — Keep the ground-truth corpus current as vulnerability classes evolve.
86585. **Accuracy dataset versioning** — Version labeled datasets so measurements are reproducible.
86586. **Accuracy reproducibility** — Document methods so any analyst can reproduce published accuracy numbers.
86587. **Accuracy audit trail** — Immutable log of every label, adjudication, and metric computation.
86588. **Accuracy export** — Export anonymized accuracy datasets for research and benchmarking.
86589. **Accuracy API** — Programmatic access to precision/recall metrics for integrations.
86590. **Accuracy webhooks** — Push metric breaches and report completions to subscribed systems.
86591. **Accuracy notifications** — Alert owners when their accuracy metrics cross thresholds.
86592. **Accuracy gamification** — Team challenges to improve precision with safeguards against metric gaming.
86593. **Accuracy leaderboards** — Quality-weighted rankings that reward precision over volume.
86594. **Accuracy badges** — Recognize sustained high precision and recall improvements.
86595. **Accuracy team competitions** — Friendly cross-team contests on accuracy improvement.
86596. **Accuracy research program** — Fund internal research on better measurement methods.
86597. **Accuracy publications** — Share anonymized measurement methodology with the security community.
86598. **Accuracy metric definitions catalog** — Single source of truth defining every accuracy metric precisely.
86599. **Accuracy review board** — Quarterly board reviewing metrics, incidents, and improvement plans.
86600. **Accuracy continuous improvement loop** — Formalize measure → analyze → improve → re-measure as an operating cadence.
86601. **Accuracy debt tracking** — Log known measurement gaps and metric blind spots as debt with remediation plans.
86602. **Accuracy tooling roadmap** — Plan investments in measurement automation and judge quality.
86603. **Accuracy stakeholder reporting** — Tailored accuracy reports for executives, programs, and researchers.
86604. **Accuracy maturity assessment** — Score measurement practices from ad-hoc to predictive with an improvement roadmap.
86605. **Platform webhook ingestion** — Ingest accept/reject/duplicate decisions from HackerOne, Bugcrowd, Intigriti, and YesWeHack in real time.
86606. **Accept/reject decision parsing** — Normalize platform-specific statuses into a common decision model.
86607. **Rejection reason-code normalization** — Map free-text rejection reasons into a standard taxonomy for analysis.
86608. **Duplicate mapping** — Link platform-marked duplicates back to the canonical internal finding automatically.
86609. **Severity-change tracking** — Record every platform-driven severity change with before/after and reason.
86610. **Bounty amount correlation** — Correlate payouts with internal severity and quality scores to validate calibration.
86611. **Feedback latency tracking** — Measure time from submission to platform decision as a responsiveness metric.
86612. **Feedback routing to finding owner** — Deliver platform decisions to the original researcher with full context.
86613. **Feedback routing to reviewer** — Notify the certifying reviewer of accepts, rejects, and severity changes on their findings.
86614. **Feedback digest** — Weekly personalized summaries of platform outcomes per researcher and reviewer.
86615. **Feedback sentiment analysis** — Analyze triager comments for tone and recurring complaints to spot relationship risks.
86616. **Feedback-driven reviewer coaching** — Trigger coaching when a reviewer's certified findings get rejected repeatedly.
86617. **Feedback-driven process change** — Convert recurring rejection patterns into QA policy or checklist updates.
86618. **Feedback knowledge base** — Searchable archive of platform decisions with triager rationales as precedent.
86619. **Feedback search** — Full-text search across platform feedback by class, program, and reason code.
86620. **Feedback trend dashboards** — Track acceptance rate, rejection reasons, and severity-change rates over time.
86621. **Feedback by reviewer** — Break down platform outcomes per certifying reviewer to measure review quality.
86622. **Feedback by class** — Identify vulnerability classes with systematically poor platform acceptance.
86623. **Feedback by program** — Compare acceptance across programs to detect scope or relationship issues.
86624. **Feedback by severity** — Check whether platform severity adjustments cluster at certain levels.
86625. **Feedback root-cause tagging** — Tag every rejection with its root cause (evidence, scope, duplicate, severity).
86626. **Feedback defect taxonomy** — Classify feedback-driven defects consistently with internal QA taxonomy.
86627. **Feedback loop closure tracking** — Track each rejection from receipt through process fix to verified improvement.
86628. **Feedback response SLA** — Commit to acknowledging and triaging platform feedback within defined hours.
86629. **Feedback appeal workflow** — Structured process for disputing platform decisions with evidence repackaging.
86630. **Appeal evidence bundle builder** — One-click bundle of finding, evidence, and rationale formatted for platform appeals.
86631. **Feedback win/loss analysis** — Analyze won vs lost disputes to improve future appeal strategies.
86632. **Feedback pattern mining** — Mine rejection patterns to discover unspoken program preferences.
86633. **Feedback-driven calibration topics** — Choose calibration exercises based on real platform disagreement patterns.
86634. **Feedback-driven training modules** — Build training from anonymized real rejections and their fixes.
86635. **Feedback-driven checklist updates** — Update validation checklists when rejections reveal checklist gaps.
86636. **Feedback-driven gate rule updates** — Add gate rules that would have caught rejected submissions.
86637. **Feedback-driven validation standard updates** — Revise validation playbooks based on platform rejection causes.
86638. **Feedback-driven evidence standard updates** — Strengthen evidence requirements where rejections cite weak proof.
86639. **Feedback-driven rubric updates** — Tune scoring rubrics when platform outcomes diverge from internal scores.
86640. **Feedback anomaly detection** — Alert on sudden acceptance-rate drops that may signal program or relationship issues.
86641. **Feedback spike alerts** — Notify leads immediately when rejections spike for a program or class.
86642. **Platform feedback quality scoring** — Rate the usefulness of triager feedback to prioritize relationship investment.
86643. **Platform relationship health** — Composite score of acceptance, responsiveness, and dispute outcomes per program.
86644. **Platform rule-change ingestion** — Automatically import program policy updates into validation checklists.
86645. **Platform policy diff alerts** — Notify relevant teams when a program changes scope, severity, or payout rules.
86646. **Program scope-change ingestion** — Version scope documents and re-validate in-flight findings against new scope.
86647. **Triager preference learning** — Model individual triager preferences from historical decisions to pre-check submissions.
86648. **Triager decision modeling** — Build per-program acceptance models from historical platform outcomes.
86649. **Platform-specific acceptance prediction** — Predict acceptance probability before submission using program history.
86650. **Pre-submission acceptance scoring** — Score each report's likely acceptance and route low scorers to senior review.
86651. **Feedback-weighted reviewer scoring** — Weight reviewer quality scores by downstream platform outcomes.
86652. **Feedback-informed reviewer assignment** — Route program findings to reviewers with the best acceptance history there.
86653. **Feedback-informed QA depth** — Increase QA depth for programs or classes with historically low acceptance.
86654. **Feedback-informed sampling** — Oversample audits where platform feedback shows weakness.
86655. **Feedback-informed calibration** — Prioritize calibration cases from classes with high platform disagreement.
86656. **Feedback-informed certification** — Require demonstrated platform acceptance history for senior reviewer certification.
86657. **Feedback loop metrics** — Measure time from rejection to deployed process fix as a learning-velocity KPI.
86658. **Feedback action tracking** — Track every process action spawned by platform feedback to completion.
86659. **Feedback action effectiveness** — Verify that actions actually improved acceptance before closing them.
86660. **Feedback retrospectives** — Monthly reviews of platform feedback themes with action owners.
86661. **Feedback blameless culture** — Treat rejections as system signals, never individual blame, in all communications.
86662. **Feedback transparency reports** — Share aggregate acceptance and rejection data openly with researchers.
86663. **Feedback API** — Programmatic access to normalized platform decisions for analytics and automation.
86664. **Feedback export** — Export anonymized feedback datasets for research and benchmarking.
86665. **Feedback retention policy** — Define how long platform feedback is kept, balancing learning value and privacy.
86666. **Feedback PII handling** — Redact personal data from triager comments before internal distribution.
86667. **Feedback multilingual parsing** — Parse and translate platform feedback in multiple languages.
86668. **Feedback translation QA** — Verify translated feedback preserves technical meaning.
86669. **Feedback categorization ML** — Automatically classify incoming feedback into reason codes.
86670. **Feedback clustering** — Cluster similar rejections to reveal systemic issues faster.
86671. **Feedback topic modeling** — Discover emerging rejection themes with unsupervised models.
86672. **Feedback urgency scoring** — Prioritize feedback indicating relationship risk or systemic failure.
86673. **Feedback escalation** — Escalate high-risk feedback (program threatening removal) to leadership immediately.
86674. **Feedback to agent training** — Convert adjudicated platform outcomes into RLHF and fine-tuning data.
86675. **Feedback to prompt engineering** — Update agent prompts when rejections reveal systematic agent mistakes.
86676. **Feedback to model fine-tuning** — Fine-tune finding-generation models on accepted vs rejected report pairs.
86677. **Feedback dataset curation** — Maintain clean, labeled accept/reject datasets for model training.
86678. **Feedback data versioning** — Version training datasets derived from platform feedback.
86679. **Feedback bias monitoring** — Check that feedback-driven models don't amplify program-specific quirks unfairly.
86680. **Feedback fairness review** — Ensure feedback loops don't disadvantage certain researchers or finding types.
86681. **Feedback for AI vs human findings** — Compare platform acceptance of agent-generated vs human findings separately.
86682. **Feedback provenance** — Track which platform, program, and triager each feedback item came from.
86683. **Feedback audit trail** — Immutable log of feedback receipt, routing, and resulting actions.
86684. **Feedback compliance** — Ensure feedback handling meets program NDAs and data agreements.
86685. **Feedback legal review** — Route feedback involving legal threats or liability claims to counsel.
86686. **Feedback NDA handling** — Respect program confidentiality when sharing feedback-derived learnings.
86687. **Feedback embargo awareness** — Hold feedback-derived disclosures until embargoes lift.
86688. **Public disclosure linkage** — Link platform feedback to eventual public disclosures for learning.
86689. **CVE linkage** — Track which accepted findings receive CVEs as an ultimate quality signal.
86690. **Bounty payout tracking** — Record payouts per finding to correlate quality investment with revenue.
86691. **Feedback ROI analysis** — Compare the cost of the feedback system against rejection reduction.
86692. **Cost of rejection** — Quantify rework, delay, and reputation cost per rejection type.
86693. **Rework cost tracking** — Measure the cost of fixing and resubmitting rejected findings.
86694. **Prevention ROI** — Show how gate and checklist investments reduce rejection costs.
86695. **Feedback benchmarking** — Compare acceptance rates against industry peers.
86696. **Feedback maturity model** — Assess feedback-loop maturity from ad-hoc to predictive.
86697. **Researcher feedback loop** — Share platform outcomes and learnings directly with researchers, not just reviewers.
86698. **Reviewer feedback loop** — Give reviewers their platform outcome stats with coaching context.
86699. **Program feedback loop** — Share quality improvements back with programs to strengthen relationships.
86700. **Closed-loop learning dashboard** — Visualize the full cycle from rejection to process fix to improved acceptance.
86701. **Feedback SLA compliance** — Track whether feedback is triaged and actioned within committed times.
86702. **Feedback backlog management** — Prioritize and burn down the queue of unprocessed platform feedback.
86703. **Feedback quality gates** — Validate incoming feedback data quality (parse errors, missing fields) before analytics.
86704. **Feedback system health monitoring** — Monitor ingestion pipelines for delays, failures, and data drift.
86705. **Calibration session scheduler** — Schedule quarterly calibration exercises automatically with attendance tracking.
86706. **Calibration case library** — Maintain a curated library of real, anonymized findings chosen for their judgment difficulty.
86707. **Calibration case authoring** — Structured process for creating cases with known-correct dispositions and rationales.
86708. **Calibration difficulty ratings** — Rate each case's difficulty so sessions mix easy anchors with hard edge cases.
86709. **Calibration blind review** — Participants judge cases without seeing others' answers until everyone submits.
86710. **Calibration scoring rubric** — Score participants on severity accuracy, evidence assessment, and rationale quality.
86711. **Calibration agreement metrics** — Compute Fleiss' kappa and percent agreement per session and per case.
86712. **Calibration drift detection** — Alert when a reviewer's judgments drift from the calibrated baseline over time.
86713. **Calibration refresher cadence** — Require recalibration every 6 months, more often after major policy changes.
86714. **Calibration for new reviewers** — Mandatory calibration pass before new reviewers get certification rights.
86715. **Calibration for severity changes** — Run targeted calibration when severity standards or CVSS versions change.
86716. **Calibration for new vulnerability classes** — Build calibration sets for emerging classes before reviewers judge them live.
86717. **Calibration for platform rule changes** — Re-calibrate on program-specific rules when platforms update policies.
86718. **Calibration panel discussions** — Facilitated group discussion of disagreed cases to build shared understanding.
86719. **Calibration decision rationales** — Require written rationales so disagreement sources become visible.
86720. **Calibration dissent documentation** — Record principled dissent even after consensus, preserving minority views.
86721. **Calibration consensus building** — Structured deliberation process to converge on the correct disposition.
86722. **Calibration facilitator role** — Train facilitators to run unbiased, productive calibration sessions.
86723. **Calibration session recordings** — Record discussions (with consent) as training material for future reviewers.
86724. **Anonymized calibration results** — Share aggregate results openly while keeping individual scores private.
86725. **Calibration agreement leaderboard** — Recognize reviewers with consistently high agreement to the gold standard.
86726. **Calibration improvement plans** — Personalized plans for reviewers scoring below the agreement threshold.
86727. **Calibration-linked certification** — Make passing calibration a prerequisite for certification and renewal.
86728. **Calibration-gated review routing** — Restrict reviewers to classes where their calibration is current and passing.
86729. **Calibration-linked QA depth** — Route findings to deeper QA when assigned reviewers have stale calibration.
86730. **Calibration trend dashboards** — Track agreement scores over time by reviewer, cohort, and class.
86731. **Calibration by class** — Run separate calibration tracks per vulnerability class with class-specific cases.
86732. **Calibration by severity** — Focus sessions on severity-boundary cases where disagreement is costliest.
86733. **Calibration by reviewer cohort** — Compare cohorts (new vs senior, team vs team) to find training gaps.
86734. **Calibration inter-rater reliability** — Use calibration data as the primary IRR measurement instrument.
86735. **Calibration intra-rater reliability** — Re-present cases months later to measure each reviewer's self-consistency.
86736. **Calibration case retirement** — Retire cases that become too easy or outdated, with documented rationale.
86737. **Calibration case versioning** — Version cases as standards evolve so historical scores remain interpretable.
86738. **Calibration gold standard** — Adjudicate correct answers via expert panel with published rationales.
86739. **Calibration adjudication panel** — Standing panel that sets gold-standard answers for disputed cases.
86740. **Calibration edge-case forum** — Async forum for discussing ambiguous cases between scheduled sessions.
86741. **Calibration office hours** — Weekly drop-in sessions with senior reviewers for judgment questions.
86742. **Calibration async exercises** — Self-paced online calibration for distributed teams across time zones.
86743. **Calibration micro-exercises** — 5-minute weekly cases keeping judgment sharp between major sessions.
86744. **Calibration gamification** — Points and streaks for participation and agreement, with anti-gaming design.
86745. **Calibration badges** — Visible credentials for calibration streaks and top agreement scores.
86746. **Calibration streaks** — Track consecutive passing calibrations as a reliability signal.
86747. **Calibration reminders** — Nudge reviewers when their calibration is approaching expiry.
86748. **Calibration attendance tracking** — Record participation and follow up on chronic absentees.
86749. **Calibration effectiveness measurement** — Measure whether calibration actually reduces live disagreement afterward.
86750. **Calibration ROI** — Compare calibration program cost against reduced overturns and rejections.
86751. **Calibration feedback survey** — Collect participant feedback after each session to improve the program.
86752. **Calibration continuous improvement** — Iterate case library and facilitation based on effectiveness data.
86753. **Calibration benchmarking** — Compare agreement levels against industry peers.
86754. **Calibration maturity model** — Assess calibration practices from ad-hoc to continuous with a roadmap.
86755. **Calibration tooling** — Purpose-built UI for blind judging, rationale capture, and agreement visualization.
86756. **Calibration mobile support** — Complete micro-exercises and async cases from mobile.
86757. **Calibration API** — Programmatic access to cases, scores, and schedules for integrations.
86758. **Calibration webhooks** — Notify systems when reviewers pass, fail, or let calibration expire.
86759. **Calibration notifications** — Targeted reminders for upcoming sessions and expiring certifications.
86760. **Calibration calendar integration** — Sync sessions with reviewers' calendars automatically.
86761. **Calibration timezone handling** — Schedule fairly across regions with async options for those who can't attend live.
86762. **Calibration multilingual** — Offer cases and facilitation in reviewers' working languages.
86763. **Calibration accessibility** — Ensure calibration tooling works with assistive technologies.
86764. **Calibration for AI reviewers** — Run LLM judges through the same calibration exercises as humans.
86765. **Human-AI agreement measurement** — Track agreement between human reviewers and AI review assistants.
86766. **LLM judge calibration** — Calibrate automated judges with gold-standard cases before trusting their scores.
86767. **Calibration dataset for models** — Use the calibration library as training and evaluation data for review models.
86768. **Calibration-driven prompt updates** — Update AI reviewer prompts based on calibration disagreement patterns.
86769. **Calibration-driven rubric updates** — Revise scoring rubrics when calibration reveals ambiguity.
86770. **Calibration-driven training data** — Feed adjudicated calibration cases into model fine-tuning.
86771. **Root-cause of disagreement** — Classify why reviewers disagree (evidence reading, severity philosophy, scope) per case.
86772. **Disagreement type taxonomy** — Standard categories of judgment disagreement for targeted training.
86773. **Severity boundary cases** — Dedicated case sets for high/critical and medium/high boundaries.
86774. **Impact vs exploitability debates** — Cases designed to separate impact assessment from exploitability assessment.
86775. **Business-context cases** — Cases where correct severity depends on understanding business context.
86776. **Chaining judgment cases** — Cases testing whether reviewers correctly assess chained vulnerabilities.
86777. **Duplicate-judgment cases** — Cases testing consistent duplicate vs distinct decisions.
86778. **Scope-boundary cases** — Cases with genuinely ambiguous scope requiring careful rule application.
86779. **Evidence-sufficiency cases** — Cases testing whether reviewers demand the right amount of proof.
86780. **Report-quality cases** — Cases testing consistent assessment of report clarity and completeness.
86781. **Retest judgment cases** — Cases testing whether a fix is truly complete.
86782. **Appeal judgment cases** — Cases testing fair handling of author appeals.
86783. **Cross-program cases** — Cases showing how the same finding is judged under different program rules.
86784. **Cross-platform cases** — Cases comparing HackerOne vs Bugcrowd vs Intigriti decision norms.
86785. **Historical precedent cases** — Cases anchored to real past decisions to teach consistency.
86786. **Emerging-threat cases** — Cases on novel attack classes to align judgment before live exposure.
86787. **Zero-day judgment cases** — Tabletop exercises for high-stakes, uncertain zero-day dispositions.
86788. **Supply-chain cases** — Cases on dependency and third-party component judgment.
86789. **Cloud-misconfiguration cases** — Cases testing consistent severity for common cloud issues.
86790. **Mobile judgment cases** — Cases on mobile-specific evidence and impact assessment.
86791. **API judgment cases** — Cases on API vulnerability severity and chaining.
86792. **IoT judgment cases** — Cases on hardware/firmware finding assessment.
86793. **AI/ML judgment cases** — Cases on model vulnerability severity with probabilistic outcomes.
86794. **Compliance-vs-security cases** — Cases distinguishing compliance gaps from real security risk.
86795. **Risk-acceptance cases** — Cases testing consistent application of risk-acceptance criteria.
86796. **Wont-fix judgment cases** — Cases on when wont-fix is the right call.
86797. **Informational-threshold cases** — Cases drawing the line between informational and reportable.
86798. **Duplicate-vs-distinct cases** — Hard cases on same-root-cause determination.
86799. **Severity-upgrade cases** — Cases testing justified severity increases with new evidence.
86800. **Severity-downgrade cases** — Cases testing justified decreases without author pressure.
86801. **CVSS-vector cases** — Cases drilling correct CVSS metric selection.
86802. **Exploit-maturity cases** — Cases on how exploit availability should affect severity.
86803. **Calibration effectiveness audits** — Independently audit whether calibration improves live decisions.
86804. **Calibration program ownership** — Assign a named owner accountable for calibration quality and outcomes.
86805. **Executive quality dashboard** — One-page view of precision, acceptance rate, SLA compliance, and cost for leadership.
86806. **Reviewer quality dashboard** — Private per-reviewer view of accuracy, calibration, SLA, and coaching status.
86807. **Team lead dashboard** — Operational view of queue health, reviewer load, accuracy trends, and risks.
86808. **Program quality dashboard** — Per-program acceptance rates, severity alignment, and relationship health.
86809. **Class-level quality dashboards** — Precision, recall, and rejection causes broken down by vulnerability class.
86810. **Severity quality dashboards** — Quality metrics sliced by severity to protect the highest-stakes decisions.
86811. **Quality trend charts** — Time-series visualization of every core quality metric with target lines.
86812. **Quality anomaly detection** — Automatic flagging of statistically unusual metric movements.
86813. **Dashboard drill-downs** — Click from aggregate metrics to individual findings and decisions.
86814. **Cohort analysis** — Compare quality metrics across reviewer cohorts, teams, and time periods.
86815. **Quality forecasting** — Predict next quarter's accuracy and capacity needs from trend models.
86816. **Quality heatmaps** — Matrix views (reviewer × class, program × severity) revealing weak spots.
86817. **Quality scorecards** — Monthly one-page scorecards per team with grades and trends.
86818. **Quality OKR tracking** — Dashboard tracking of quality objectives and key results with ownership.
86819. **Quality alerting** — Configurable alerts on metric thresholds with runbook links.
86820. **Quality digest emails** — Weekly automated summaries tailored to executives, leads, and reviewers.
86821. **Quality Slack integration** — Push alerts and digests into team channels with interactive drill-downs.
86822. **Quality data warehouse** — Central warehouse unifying pipeline, review, platform, and audit data.
86823. **Quality ETL pipelines** — Reliable, monitored data pipelines feeding all quality analytics.
86824. **Quality metric definitions catalog** — Governed definitions ensuring everyone means the same thing by "precision".
86825. **Dashboard permissions** — Role-based access so reviewers see their own data and leads see their teams.
86826. **Dashboard embedding** — Embed quality dashboards in wikis, program portals, and executive decks.
86827. **Dashboard mobile view** — Responsive dashboards for on-call leads checking queue health.
86828. **Dashboard export** — Export any view to PDF or CSV for reports and audits.
86829. **Dashboard annotations** — Annotate charts with events (policy changes, incidents) to explain shifts.
86830. **Dashboard comments** — Threaded discussion on metrics directly within the dashboard.
86831. **Dashboard sharing** — Share live dashboard views with programs and clients securely.
86832. **Dashboard templates** — Prebuilt dashboard layouts for common roles and use cases.
86833. **Quality API** — Programmatic access to all quality metrics for custom analysis.
86834. **Quality webhooks** — Push metric updates and breaches to external systems.
86835. **BI tool integration** — Native connectors for Tableau, Looker, and Power BI.
86836. **Benchmark overlays** — Overlay industry benchmark bands on internal trend charts.
86837. **Target lines** — Display SLO targets directly on charts with variance indicators.
86838. **Traffic-light indicators** — Red/amber/green status for every KPI at a glance.
86839. **Quality sparklines** — Inline mini-trends in tables and lists for quick scanning.
86840. **Distribution histograms** — Show score and severity distributions, not just averages.
86841. **Pareto charts** — Highlight the vital few defect causes driving most quality loss.
86842. **Control charts (SPC)** — Statistical process control charts distinguishing noise from real shifts.
86843. **Run charts** — Simple time-ordered plots for every metric with median lines.
86844. **Funnel analysis** — Visualize finding flow from submission through gates, review, and platform acceptance.
86845. **Cohort retention analysis** — Track whether quality improvements persist across reviewer cohorts.
86846. **Seasonality analysis** — Identify and adjust for cyclical patterns in quality metrics.
86847. **Regression detection** — Automatically detect when metrics regress after changes.
86848. **Changepoint detection** — Statistically identify when a metric's behavior fundamentally changed.
86849. **Correlation analysis** — Explore relationships between metrics (e.g., queue depth vs precision).
86850. **Driver analysis** — Decompose metric changes into contributing factors automatically.
86851. **Root-cause drill-down** — Guided investigation from a metric anomaly to likely causes.
86852. **What-if modeling** — Simulate how staffing or policy changes would affect quality metrics.
86853. **Scenario planning** — Model quality outcomes under growth, surge, and attrition scenarios.
86854. **Capacity forecasting** — Predict reviewer capacity needs from volume and quality targets.
86855. **Staffing model dashboard** — Translate forecasts into hiring plans by tier and track.
86856. **Cost dashboards** — Track QA cost per finding, per program, and per severity.
86857. **ROI dashboards** — Show quality investment vs error-cost reduction over time.
86858. **Rework dashboards** — Visualize rework loops, causes, and costs.
86859. **Aging dashboards** — Show finding age distributions and stale-item risks.
86860. **Backlog dashboards** — Track backlog size, composition, and burn-down.
86861. **SLA dashboards** — Real-time SLA compliance by stage, severity, and team.
86862. **Breach dashboards** — Log and analyze every SLA breach with causes.
86863. **Audit dashboards** — Track sampling audit progress, findings, and actions.
86864. **Calibration dashboards** — Visualize agreement scores, participation, and drift.
86865. **Certification dashboards** — Track certification status, expiries, and pass rates.
86866. **Training dashboards** — Monitor training completion and its correlation with quality.
86867. **Coaching dashboards** — Track coaching plans, sessions, and outcomes.
86868. **Feedback dashboards** — Visualize platform feedback themes and loop-closure rates.
86869. **Platform dashboards** — Per-platform acceptance, latency, and relationship health.
86870. **Acceptance dashboards** — Track submission-to-acceptance funnels by program.
86871. **Precision dashboards** — Dedicated views of precision by every meaningful dimension.
86872. **Recall dashboards** — Dedicated views of recall estimates and seeded-detection results.
86873. **Precision-recall equilibrium dashboards** — Balanced precision/recall views preventing single-metric gaming.
86874. **Inter-rater dashboards** — Visualize agreement metrics across reviewers and classes.
86875. **Sampling dashboards** — Show audit sample coverage and representativeness.
86876. **Gate dashboards** — Monitor gate block rates, false blocks, and rule performance.
86877. **Lint dashboards** — Track linter findings, auto-fixes, and rule precision.
86878. **Evidence dashboards** — Visualize completeness scores and gap trends.
86879. **Report dashboards** — Track report grades, rework, and recipient ratings.
86880. **Validation dashboards** — Monitor validation throughput, confirmation rates, and accuracy.
86881. **Peer-review dashboards** — Track review turnaround, overturns, and reviewer load.
86882. **Queue dashboards** — Live queue depth, age, and SLA risk across all queues.
86883. **Workload dashboards** — Per-reviewer load vs capacity with burnout risk flags.
86884. **Burnout dashboards** — Aggregate early-warning indicators for reviewer well-being.
86885. **Fairness dashboards** — Monitor assignment fairness and bias indicators.
86886. **Bias dashboards** — Track severity inflation/deflation and demographic parity signals.
86887. **Multilingual dashboards** — Quality metrics sliced by report language.
86888. **Dashboard accessibility** — WCAG-compliant dashboards usable with assistive tech.
86889. **Dashboard dark mode** — Full dark-mode support for late-night operations.
86890. **Dashboard performance** — Sub-second load for core dashboards via caching and precomputation.
86891. **Dashboard caching** — Intelligent caching balancing freshness with speed.
86892. **Real-time streaming** — Live metric updates for operational dashboards.
86893. **Historical replay** — Replay any past date's dashboard state for investigations.
86894. **Comparison mode** — Side-by-side comparison of periods, teams, or programs.
86895. **Scheduled reports** — Automated PDF quality reports on daily, weekly, and monthly cadences.
86896. **Dashboard subscriptions** — Subscribe to specific metrics with personalized thresholds.
86897. **Alert tuning** — Tune alert sensitivity per metric to balance signal and noise.
86898. **Alert fatigue management** — Deduplicate and prioritize alerts to protect on-call attention.
86899. **Incident linkage** — Link quality incidents directly to the metrics they affected.
86900. **Postmortem linkage** — Connect postmortem actions to the dashboards that verify them.
86901. **Knowledge base linkage** — Link metric definitions to explanatory documentation.
86902. **Continuous improvement tracking** — Dashboard showing improvement backlog burn-down and impact.
86903. **Dashboard usage analytics** — Track which dashboards get used to focus development effort.
86904. **Dashboard feedback loop** — Collect and act on user feedback about dashboard usefulness.
86905. **Reviewer certification program design** — Define levels, requirements, and governance for the full certification lifecycle.
86906. **Certification levels** — Associate, senior, and principal tiers with distinct privileges and requirements.
86907. **Certification exams** — Proctored assessments combining theory and practical finding judgment.
86908. **Certification practical assessments** — Grade candidates on real historical findings with gold-standard answers.
86909. **Certification renewal** — Require re-examination and calibration currency every two years.
86910. **Certification revocation** — Clear, fair process for suspending certification after sustained quality failures.
86911. **Certification audits** — Independently audit certification decisions for fairness and consistency.
86912. **Certification registry** — Public internal directory of certified reviewers with levels and expiry dates.
86913. **Certification badges** — Verifiable digital credentials reviewers can display.
86914. **Certification-linked compensation** — Tie pay bands and bonuses to certification level and maintenance.
86915. **Certification-linked assignment** — Only certified reviewers may certify findings at their level and below.
86916. **Certification prerequisites** — Required experience, training, and calibration history before exam eligibility.
86917. **Certification study guides** — Official materials covering standards, rubrics, and example judgments.
86918. **Certification mentorship** — Pair candidates with certified mentors during preparation.
86919. **Certification exam security** — Protect question banks with rotation, non-disclosure, and cheating detection.
86920. **Certification question bank** — Large, versioned bank of exam items with psychometric metadata.
86921. **Certification psychometrics** — Analyze exam items for difficulty and discrimination; retire poor items.
86922. **Certification pass-rate analytics** — Monitor pass rates for bias or exam drift.
86923. **Certification bias monitoring** — Check for disparate pass rates across demographic groups and remediate.
86924. **Sampling audit methodology** — Documented standard for independent re-review audits.
86925. **Stratified audit sampling** — Stratify by severity, class, reviewer, and program for representative audits.
86926. **Random audit sampling** — Pure random samples to catch issues stratification might miss.
86927. **Risk-based audit sampling** — Oversample high-risk segments (new reviewers, new classes, low calibration).
86928. **Audit sample-size calculator** — Compute required samples for target precision of audit estimates.
86929. **Audit scheduling** — Quarterly audit calendar with coverage targets per segment.
86930. **Independent audit assignment** — Auditors must be independent of the original review chain.
86931. **Audit rubrics** — Standardized scoring rubrics for auditors assessing finding quality.
86932. **Audit scoring** — Quantitative audit scores feeding accuracy metrics and coaching triggers.
86933. **Audit disagreement resolution** — Panel adjudication when auditors disagree with original decisions.
86934. **Audit reporting** — Formal audit reports with findings, root causes, and recommendations.
86935. **Audit trend analysis** — Track audit scores over time to measure systemic improvement.
86936. **Audit-driven coaching** — Convert audit findings into personalized coaching plans.
86937. **Audit-driven process change** — Turn systemic audit findings into policy and checklist updates.
86938. **Audit independence requirements** — Structural separation between audit and operations functions.
86939. **Audit rotation** — Rotate auditors across segments to prevent familiarity bias.
86940. **Meta-audit (audit the auditors)** — Sample audit decisions for second-order quality assurance.
86941. **Inter-rater reliability metrics** — Track Cohen's kappa and Fleiss' kappa as core quality KPIs.
86942. **IRR dashboards** — Visualize agreement by reviewer pair, class, and severity.
86943. **IRR by class** — Identify classes with poor agreement for targeted calibration.
86944. **IRR by severity** — Monitor agreement at severity boundaries where stakes are highest.
86945. **IRR trend analysis** — Track whether agreement improves after calibration and training.
86946. **IRR improvement plans** — Targeted interventions for reviewer pairs or classes with low agreement.
86947. **IRR-linked certification** — Require minimum agreement scores for certification maintenance.
86948. **IRR sampling design** — Design overlap in review assignments specifically to measure agreement.
86949. **IRR adjudication** — Expert panels resolve systematic disagreement patterns.
86950. **Quality SLA definitions** — Formal SLAs for review turnaround, accuracy, and evidence completeness.
86951. **SLA per severity** — Tighter SLAs for criticals, relaxed for lows, all published.
86952. **SLA per pipeline stage** — Separate commitments for triage, review, and certification stages.
86953. **SLA breach handling** — Automatic escalation, client notification, and root-cause review on breach.
86954. **SLA reporting** — Monthly SLA compliance reports to programs and leadership.
86955. **SLA negotiation with programs** — Data-driven SLA setting based on measured capability, not aspiration.
86956. **SLA capacity modeling** — Prove SLA feasibility with queueing models before committing.
86957. **Defect taxonomy design** — Standard classification of finding defects (wrong severity, weak evidence, unclear writing, missed duplicate, scope error, FP, bad remediation).
86958. **Defect severity grading** — Grade defects by impact (critical defect = shipped wrong critical) for prioritization.
86959. **Defect tagging workflow** — Make defect tagging a mandatory step in audits, appeals, and postmortems.
86960. **Defect analytics** — Analyze defect distributions to find the biggest quality levers.
86961. **Defect Pareto analysis** — Focus improvement on the few defect types causing most harm.
86962. **Defect trend analysis** — Track defect rates over time by type, team, and class.
86963. **Defect by reviewer** — Private defect profiles guiding personalized coaching.
86964. **Defect by class** — Reveal which vulnerability classes generate which defect types.
86965. **Defect root-cause analysis** — Investigate why defects occur using structured methods.
86966. **RCA methodology standard** — Adopt 5-whys and fishbone analysis as the standard toolkit.
86967. **RCA facilitation** — Train facilitators to run blameless, effective root-cause sessions.
86968. **RCA action tracking** — Track every RCA action to verified completion, never just assignment.
86969. **RCA effectiveness review** — Verify that actions actually eliminated the root cause.
86970. **RCA knowledge base** — Searchable library of past RCAs preventing repeat investigations.
86971. **RCA training** — Teach all leads to run rigorous root-cause analyses.
86972. **Quality coaching program** — Structured coaching for reviewers and researchers with quality gaps.
86973. **Coaching triggers** — Automatic enrollment based on accuracy, calibration, defect, or feedback signals.
86974. **Coaching plans** — Personalized plans with goals, exercises, and timelines.
86975. **Coaching sessions** — Regular 1:1 sessions with trained quality coaches.
86976. **Coaching effectiveness measurement** — Verify metric improvement after coaching before closing plans.
86977. **Coach certification** — Certify coaches on feedback skills and quality domain knowledge.
86978. **Coaching analytics** — Track coaching volume, outcomes, and ROI.
86979. **Report linter rule catalog** — Comprehensive catalog of automated report checks with documentation.
86980. **Custom lint rule authoring** — Let quality leads add program-specific lint rules safely.
86981. **Lint severity levels** — Errors block, warnings advise; tune per rule from data.
86982. **Lint auto-fix** — Automatically fix trivial issues (formatting, link syntax) with author review.
86983. **Lint CI integration** — Run linters on agent-generated reports in CI before human review.
86984. **Lint analytics** — Track lint hit rates and false positives per rule.
86985. **Lint false-positive tuning** — Continuously tune rules using reviewer override data.
86986. **Lint rule contribution workflow** — Community submission, review, and rollout process for new rules.
86987. **QA bot assistance** — Conversational assistant helping reviewers check standards during review.
86988. **Auto-triage** — Automatically classify and route incoming findings by class and severity signals.
86989. **Auto-evidence-check** — Verify evidence presence and basic quality without human effort.
86990. **Auto-severity-suggest** — Suggest severity with rationale for reviewer confirmation, never auto-decision.
86991. **Quality trend analysis program** — Dedicated analysts turning metric trends into improvement initiatives.
86992. **Industry benchmarking** — Compare quality metrics against anonymized industry data annually.
86993. **Benchmark data sourcing** — Partner with peers and platforms for comparable benchmark datasets.
86994. **Benchmark normalization** — Adjust for portfolio mix so comparisons are fair.
86995. **Benchmark reporting** — Share benchmark results with leadership and teams transparently.
86996. **Benchmark-driven goals** — Set improvement targets relative to top-quartile peers.
86997. **Maturity model assessment** — Score quality systems on a 5-level model across all dimensions.
86998. **Maturity roadmap** — Published plan for advancing maturity levels with owners and timelines.
86999. **Quality awards** — Recognize teams and individuals with exceptional quality contributions.
87000. **Quality culture program** — Initiatives making quality a shared value, not just a QA team job.
87001. **Quality champions network** — Embedded advocates in each team spreading quality practices.
87002. **Quality guild** — Community of practice for reviewers to share techniques and learnings.
87003. **Quality onboarding** — Quality training as a mandatory part of every new hire's first month.
87004. **Quality handbook** — Single living reference for all quality standards, processes, and roles.
