# Quality assurance (57005–58004)

57005. **Claim-evidence entailment scorer** — Score every declarative sentence in a finding against captured artifacts with an entailment model and block claims scoring below the support threshold.
57006. **Atomic fact decomposition for findings** — Split each finding into atomic checkable facts (endpoint, parameter, payload effect, impact) so QA can verify each independently instead of the whole narrative at once.
57007. **Per-fact verdict rollup** — Record a supported/unsupported verdict per atomic fact and compute an overall finding verdict from the rollup, exposing exactly which fact failed.
57008. **Assertion provenance tagging** — Tag every claim with the engine, model, and hunt step that produced it so reviewers can trace suspicious assertions back to their origin.
57009. **Cross-engine corroboration requirement** — Require two independent engines to corroborate auto-confirmed critical findings before they bypass human review.
57010. **Confidence threshold gating** — Hold findings below a calibrated confidence score in a pending-evidence state instead of letting them reach the report pipeline.
57011. **Evidence freshness window check** — Reject evidence captured outside the finding's hunt window or older than the retest policy, forcing a fresh capture.
57012. **Request-response pairing integrity** — Verify each stored response is cryptographically paired with its request (matching IDs, timestamps, connection) so orphaned artifacts can't support claims.
57013. **Canonical URL matching between claim and evidence** — Normalize and compare URLs cited in the narrative against URLs in evidence, flagging any drift in host, path, or query.
57014. **Parameter-name consistency check** — Confirm parameter names in the write-up exactly match those in the raw requests, catching renamed or hallucinated parameters.
57015. **Decoded-vs-raw payload equivalence** — Check that decoded payload representations shown to reviewers are byte-equivalent to the raw bytes actually sent.
57016. **Status-code semantic validation** — Flag claims whose described outcome contradicts the recorded HTTP status semantics (e.g., "created" with a 4xx).
57017. **Redirect-chain plausibility check** — Validate that claimed redirect behavior matches the captured redirect chain hop by hop.
57018. **Timestamp ordering of exploit steps** — Verify multi-step exploit evidence is chronologically ordered and causally plausible, rejecting backdated or out-of-order artifacts.
57019. **Chain-link input-output continuity** — For chained exploits, verify each step's output artifact feeds the next step's input, with no unexplained gaps.
57020. **Dropped-candidate spot audit** — Randomly re-examine findings the agent discarded as non-issues to estimate the false-negative rate of the triage stage.
57021. **Golden-target benchmark comparison** — Run accuracy checks against seeded targets with known vulnerabilities and compare reported claims to ground truth.
57022. **Claim-strength anomaly flagging** — Statistically flag findings whose asserted impact is an outlier relative to similar findings from the same engine.
57023. **Evidence-snippet locator links** — Require every key claim to link to the exact evidence snippet (line-anchored) that supports it for one-click reviewer verification.
57024. **Reviewer-facing claim map UI** — Render findings as a visual map of claims connected to their supporting artifacts so reviewers see coverage gaps instantly.
57025. **Contradictory-evidence detector** — Scan the evidence bundle for artifacts that contradict the finding's conclusion and surface them to the reviewer automatically.
57026. **Overclaim pattern linter** — Detect absolute phrasing like "all users affected" or "full database access" lacking proportional evidence and downgrade or flag it.
57027. **Scope-of-impact quantifier check** — Require impact claims to cite a measured quantity (records, accounts, endpoints) rather than unquantified adjectives.
57028. **Exploitability-evidence sufficiency rubric** — Grade whether the evidence proves exploitability (not just presence of a weakness) on a fixed rubric before severity is assigned.
57029. **Assumption flagging in findings** — Force explicit labeling of every assumption ("assumes victim clicks link") so reviewers can challenge them separately from facts.
57030. **Precondition documentation audit** — Verify all preconditions (auth state, feature flags, test data) are documented and evidenced, not implied.
57031. **Environment parity check (qa)** — Confirm the evidence environment (staging vs production, version, region) matches the environment named in the report.
57032. **Auth-state consistency check** — Verify the authenticated/unauthenticated state claimed matches session artifacts attached to the evidence.
57033. **Session-cookie presence audit** — Check that session artifacts claimed to exist are actually present and valid in the captured cookie jar.
57034. **Multi-step session continuity** — Validate that a single coherent session spans multi-request evidence, flagging session swaps mid-exploit.
57035. **Replay artifact auto-generation check** — Require a machine-generated replay script for every finding and verify it reproduces the claimed request sequence.
57036. **Hash-chained evidence integrity** — Chain SHA-256 hashes across evidence artifacts in capture order so tampering or reordering is detectable at review.
57037. **Engine self-grading vs reviewer grade delta** — Track the gap between the engine's self-assessed confidence and the reviewer's final grade to calibrate self-scoring.
57038. **Hallucination keyword scan on model-generated findings** — Scan narratives for hedge-free assertions about unobserved internals (e.g., specific backend queries) and demand evidence or rewording.
57039. **Numeric claim verification** — Cross-check every number in the report (record counts, response sizes, timing) against the raw evidence values.
57040. **Version-string corroboration** — Verify software version strings cited as vulnerable match version evidence captured from banners, headers, or files.
57041. **Header-evidence alignment** — Confirm security-header claims (missing/present) match the actual captured response headers verbatim.
57042. **Body-evidence alignment** — Confirm reflected-content or error-content claims match the captured response body exactly, including encoding.
57043. **Timing-evidence alignment for race claims** — Require timing measurements attached to race-condition findings to support the claimed concurrency window.
57044. **Error-message provenance** — Trace quoted error messages back to the exact response and request that produced them.
57045. **DNS evidence standard for takeover claims** — Require captured DNS records (CNAME, NXDOMAIN) attached to every subdomain-takeover finding.
57046. **Certificate evidence standard for TLS claims** — Require the captured certificate chain for findings about TLS misconfiguration or expiry.
57047. **Screenshot-text cross-check** — OCR screenshots and verify visible text matches the narrative description of what the screenshot shows.
57048. **Log-line referencing accuracy** — Verify every cited log line exists in the attached logs with correct timestamps and ordering.
57049. **CWE-to-evidence mapping completeness** — Require each assigned CWE to have at least one mapped evidence artifact, blocking CWE labels with no support.
57050. **Attack-surface claim scoping** — Check that "affects all endpoints" style claims are backed by tested endpoint lists, otherwise narrow the claim automatically.
57051. **Negative-control check** — Require evidence that a benign input does not trigger the behavior, distinguishing real findings from noise-prone detectors.
57052. **Control-group comparison requirement** — For behavioral findings, require a control comparison (e.g., low-privilege vs high-privilege) captured under identical conditions.
57053. **Evidence sufficiency tiering** — Classify each finding's evidence as weak, moderate, or strong on a fixed scale and route weak-evidence findings to mandatory human review.
57054. **Tier-based routing to human review** — Automatically route weak-tier findings to senior reviewers and strong-tier findings to standard queues.
57055. **Claim revision diffing after feedback** — Show reviewers a clean diff of claim changes between finding versions so re-review focuses on what changed.
57056. **Accuracy regression suite per engine** — Maintain a suite of historical findings with known verdicts and re-run accuracy checks on every engine update.
57057. **Weekly accuracy sampling by QA lead** — Have the QA lead manually verify a rotating sample of auto-approved findings each week and publish the hit rate.
57058. **Disputed-claim arbitration queue** — Route findings where the engine and reviewer disagree on factual claims to a dedicated arbitration lane with a third adjudicator.
57059. **Stale-evidence detector** — Flag evidence older than the retest window or captured before the last target deployment as stale and requiring refresh.
57060. **Redaction-accuracy check** — Verify PII redactions in evidence do not destroy the artifacts needed to support the claim, balancing privacy with provability.
57061. **Raw HTTP request archive requirement** — Require the complete raw request (method, path, headers, body) stored verbatim for every finding as the minimum evidence unit.
57062. **Raw HTTP response archive requirement** — Require the complete raw response paired with each request, with no truncation of security-relevant sections.
57063. **Replay curl artifact mandate** — Auto-generate a working curl command reproducing the key request and store it as a mandatory evidence artifact.
57064. **Step-by-step reproduction checklist completeness** — Validate that reproduction steps are numbered, ordered, and each references its corresponding evidence artifact.
57065. **Evidence timestamp coverage** — Require capture timestamps on every artifact and reject bundles with missing or inconsistent timing metadata.
57066. **Scope membership proof** — Require evidence that the tested asset was inside the authorized scope (scope list snapshot + asset match record).
57067. **Session and auth context capture** — Require documentation of the authentication state, role, and session identifiers active during evidence capture.
57068. **Environment metadata bundle** — Require target environment details (hostname, resolved IP, software versions, region) attached to every evidence set.
57069. **HAR capture standard** — Store a full HTTP archive of the exploit session so reviewers can replay the entire interaction in context.
57070. **Console log attachment rule** — Require browser console logs for client-side findings to corroborate script execution and errors.
57071. **Before-and-after state captures** — Require state snapshots before and after the exploit step for findings claiming state change (data modification, privilege change).
57072. **Request chain ordering manifest** — Store an ordered manifest of multi-request exploit chains with sequence numbers linking each artifact.
57073. **Cookie jar snapshot** — Archive the full cookie jar at capture time for findings involving sessions, CSRF, or cookie security flags.
57074. **CSRF token handling note** — Require an explicit note on how anti-CSRF tokens were handled (bypassed, omitted, replayed) with supporting artifacts.
57075. **Rate-limit context record** — Document request rates and any rate-limit responses observed, since throttling affects reproducibility.
57076. **Proxy log retention** — Retain the intercepting proxy log for the hunt session as a tamper-evident record of all traffic.
57077. **DNS resolution record** — Store the DNS answers observed at capture time for findings involving hostnames, takeovers, or SSRF.
57078. **TLS handshake info capture** — Record negotiated TLS version, cipher, and certificate summary for transport-security findings.
57079. **Redirect chain log** — Capture the complete redirect chain with status codes and Location headers for open-redirect and auth-flow findings.
57080. **File upload metadata record** — For upload findings, store filename, MIME type, size, storage path evidence, and retrieval proof.
57081. **Multipart boundary record** — Preserve exact multipart boundaries and part headers so upload requests replay byte-identically.
57082. **WebSocket frame log** — Capture full WebSocket frame sequences (with opcodes and direction) for findings over socket-based protocols.
57083. **GraphQL query and variables bundle** — Store the exact GraphQL query document plus variables JSON for API findings.
57084. **API schema reference attachment** — Attach the relevant OpenAPI/GraphQL schema excerpt showing the tested operation's definition.
57085. **Auth token scope claims record** — Document the scopes/claims of tokens used during testing to prove the privilege context.
57086. **User-role evidence** — Capture proof of the test account's role and permissions at the time of the finding.
57087. **Screenshot attachment rule** — Require at least one screenshot for UI-visible findings, validated by the screenshot QA lane.
57088. **Video PoC standard** — Require a short screen recording for complex multi-step or timing-sensitive findings.
57089. **Terminal transcript capture** — Store unedited terminal transcripts for command-line-driven proof steps.
57090. **Code location citation** — For findings referencing source or config, cite exact file paths and line numbers with excerpts.
57091. **Configuration excerpt attachment** — Attach the relevant configuration snippet (redacted) for misconfiguration findings.
57092. **Database query log excerpt** — For injection findings, attach the observed or inferred query evidence with safe redaction.
57093. **Stack trace capture** — Preserve full stack traces for error-based findings instead of paraphrased summaries.
57094. **WAF and edge response header record** — Document edge/WAF headers and block responses to distinguish filtered vs unfiltered behavior.
57095. **Cache-busting proof** — For cache-related findings, attach proof that caching was bypassed or accounted for during testing.
57096. **Idempotency evidence** — For state-changing findings, document retry behavior proving whether the action is idempotent.
57097. **Pagination state record** — For findings spanning paginated data, record cursors and page boundaries tested.
57098. **Multi-tenant isolation proof (qa)** — For tenant-boundary findings, attach evidence from at least two tenants demonstrating the boundary violation.
57099. **Correlation ID capture** — Store request correlation IDs so reviewers or clients can trace the finding in server-side logs.
57100. **Request signing details** — For signed-request APIs, document the signing process and capture the signed artifacts.
57101. **HMAC and nonce capture** — Record nonces, timestamps, and signatures used in authenticated request evidence.
57102. **Webhook delivery logs (qa)** — For webhook/SSRF findings, attach the receiver-side delivery logs proving the outbound request arrived.
57103. **Email receipt proof** — For email-based flows (reset, verification), attach headers and body of the received message.
57104. **Payment flow receipts** — For commerce-logic findings, attach order confirmations, amounts, and transaction IDs.
57105. **Order ID and transaction record** — Store immutable transaction identifiers tying the finding to a real processed transaction.
57106. **Target audit log entries** — Where accessible, attach the target's own audit log entries corroborating the tested actions.
57107. **Chain-of-custody hash manifest** — Hash every artifact at capture and store the manifest so reviewers can verify nothing changed.
57108. **PII redaction certificate** — Require a signed attestation that evidence was scanned and PII redacted per policy before report inclusion.
57109. **Evidence completeness scoring** — Compute a 0-100 completeness score from required-vs-present artifacts and display it on every finding.
57110. **Missing-artifact auto-request** — When QA detects missing artifacts, automatically task the agent to re-capture them instead of failing silently.
57111. **Evidence SLA timer** — Start a clock when evidence is requested from the agent and escalate if capture is not completed in time.
57112. **Evidence completeness dashboard** — Show per-hunt, per-engine completeness scores with drill-down to the missing artifacts.
57113. **Required-artifact matrix per vuln class** — Maintain a matrix mapping each vulnerability class to its mandatory evidence artifacts, enforced by QA gates.
57114. **Conditional artifact rules** — Define artifacts required only under conditions (e.g., auth proof only for authenticated findings) to avoid pointless failures.
57115. **Evidence artifact versioning** — Version evidence bundles across re-captures so reviewers can see exactly what changed between attempts.
57116. **Stale artifact refresh workflow** — Automatically flag artifacts older than the freshness policy and queue targeted re-capture jobs.
57117. **Readability scoring for reports** — Score every report with Flesch-Kincaid and flag sections above the target grade level for simplification.
57118. **Jargon density meter** — Measure unexplained technical terms per section and require definitions or plain-language alternatives above a threshold.
57119. **Section coverage checklist** — Verify all required report sections (summary, description, impact, reproduction, remediation, references) are present and non-empty.
57120. **Executive summary adequacy rubric** — Grade the executive summary on whether a non-technical reader can grasp risk, scope, and urgency without reading further.
57121. **Remediation actionability score** — Score remediation guidance on specificity: exact fix, code location, and verification step, penalizing generic advice.
57122. **CVSS justification completeness** — Require a written rationale for each CVSS metric value, blocking vector-only severity assignments.
57123. **Impact narrative quality review** — Assess whether the impact section describes concrete business consequences, not just technical effects.
57124. **Severity consistency across sections** — Automatically check that severity stated in the title, summary, CVSS, and risk rating all agree.
57125. **Title specificity score** — Penalize vague titles ("Security issue found") and require titles naming the flaw, asset, and mechanism.
57126. **Description structure adherence** — Enforce a fixed description structure (what, where, why it matters) and score compliance per report.
57127. **Steps-to-reproduce clarity score** — Have an independent check confirm the reproduction steps are executable by someone unfamiliar with the hunt.
57128. **Evidence embedding completeness** — Verify every referenced artifact is actually embedded or linked, with no dangling "see attached" pointers.
57129. **Screenshot caption quality** — Require captions explaining what each screenshot proves, rejecting decorative or unexplained images.
57130. **Code-block formatting lint** — Validate code and request blocks use correct fencing, language tags, and redaction of secrets.
57131. **Markdown structural lint** — Lint heading hierarchy, list formatting, and table syntax so reports render cleanly on every platform.
57132. **Dead link detector** — Crawl all links in the report and flag broken references, CWE/CVE links, and expired evidence URLs.
57133. **Internal cross-reference check** — Verify internal references ("see section 3", "finding DM-1042") resolve to real sections and findings.
57134. **Terminology consistency glossary check** — Enforce a controlled glossary so the same component isn't called three different names in one report.
57135. **Acronym definition check** — Require first-use expansion of every acronym, with a generated acronym table per report.
57136. **Length appropriateness flags** — Flag reports or sections that are suspiciously short (thin evidence) or bloated (unfocused) against class baselines.
57137. **Duplication within report scan** — Detect repeated paragraphs or evidence across findings in the same report and consolidate them.
57138. **Copy-paste artifact detection** — Flag boilerplate copied across findings without adaptation, which signals low-effort reporting.
57139. **Template compliance score** — Score adherence to the client or platform report template, section by section.
57140. **Branding and format compliance** — Check logos, headers, footers, and styling against brand guidelines before client delivery.
57141. **Table formatting validation** — Verify tables have headers, aligned columns, and render correctly in both HTML and PDF exports.
57142. **Heading hierarchy check** — Enforce a single H1, logical nesting, and descriptive headings instead of generic ones.
57143. **Numbered-step integrity** — Verify reproduction steps are sequentially numbered with no gaps, duplicates, or missing steps.
57144. **Imperative-mood check on remediation** — Prefer direct imperative remediation language ("Sanitize input with...") over vague passive suggestions.
57145. **Passive-voice density monitor** — Flag excessive passive voice in impact and description sections where directness aids comprehension.
57146. **Hedging calibration review** — Align hedge words ("may", "could") with actual evidence strength, removing false certainty and false doubt.
57147. **Certainty-evidence alignment** — Require strong claims ("allows full takeover") to cite strong evidence, downgrading language otherwise.
57148. **Executive comprehension test** — Sample-check reports with a non-technical reader proxy to confirm the summary communicates risk clearly.
57149. **Remediation effort estimation presence** — Require an effort estimate (trivial/moderate/significant) alongside each remediation so clients can plan.
57150. **Workaround vs fix distinction** — Require reports to separate temporary mitigations from permanent fixes explicitly.
57151. **Fix-verification guidance quality** — Score the included verification steps for confirming a fix actually works, including what to retest.
57152. **References quality audit** — Check that external references are authoritative, current, and directly relevant to the finding.
57153. **CVE and CWE linkage correctness** — Validate assigned CVE/CWE identifiers exist and match the described weakness.
57154. **Affected-versions precision** — Require exact tested versions and a statement of version coverage rather than "latest".
57155. **Disclosure timeline section** — Require a disclosure and coordination timeline section for reports destined for external parties.
57156. **Risk rating rationale paragraph** — Require a short paragraph explaining the risk rating in plain language, not just the score.
57157. **Business-impact translation score** — Score how well technical impact is translated into business terms (revenue, trust, compliance).
57158. **Visual asset quality rollup** — Aggregate screenshot, diagram, and video QA scores into a single visual-quality metric per report.
57159. **Appendix completeness** — Verify appendices contain promised raw artifacts, logs, and supplementary data.
57160. **Report revision changelog** — Maintain a visible changelog of report revisions so reviewers and clients see what changed and why.
57161. **Reviewer comment resolution rate** — Track the percentage of reviewer comments addressed before release as a quality signal.
57162. **Post-revision diff readability** — After reviewer feedback, verify the revised report reads coherently rather than as patched fragments.
57163. **Multilingual report parity check** — When reports ship in multiple languages, verify section-by-section parity of content and severity.
57164. **PDF rendering QA** — Render the final PDF and check pagination, image placement, fonts, and table breaks before delivery.
57165. **Export fidelity check** — Compare markdown source to PDF/HTML exports to catch rendering-induced content loss.
57166. **Report accessibility check** — Verify alt text on images, logical reading order, and tagged PDF structure for accessibility compliance.
57167. **Report completeness percentage** — Compute and display a completeness percentage from required elements, blocking release below threshold.
57168. **Quality gate score threshold** — Set a minimum composite quality score that reports must reach before leaving the QA pipeline.
57169. **Historical quality trend per engine** — Chart report quality scores over time for each report-generating engine to spot degradation.
57170. **Peer benchmark comparison** — Compare each report's quality score against peer reports of the same class and period.
57171. **Client feedback correlation** — Correlate internal quality scores with client acceptance and satisfaction to validate the scoring model.
57172. **Quality leaderboard input feed** — Feed report quality scores into the QA leaderboard system to recognize consistently strong reporting.
57173. **Mandatory second-reviewer signoff for high and critical** — Require an independent second reviewer to approve every high or critical finding before release.
57174. **Blind review mode (qa)** — Hide the authoring engine and first reviewer's identity during peer review to reduce bias toward familiar sources.
57175. **Reviewer skill matching** — Route findings to reviewers whose expertise tags match the vulnerability class and target technology.
57176. **Quorum rules for release** — Define quorum (e.g., two approvals, no unresolved blocks) that must be met before a report ships.
57177. **Review escalation path** — Provide a defined escalation route when reviewers disagree or when a finding exceeds reviewer authority.
57178. **Review SLA timers (qa)** — Attach visible countdown timers to each review assignment based on finding severity.
57179. **Approve, reject, and request-changes states** — Use explicit tri-state review decisions with required rationale for reject and request-changes.
57180. **Structured review checklist per review** — Require reviewers to complete a fixed checklist (evidence, severity, duplicates, language) rather than freeform approval.
57181. **Comment threads with resolution tracking** — Keep threaded reviewer comments with explicit resolve/reopen states and resolution notes.
57182. **Inline evidence annotation (qa)** — Let reviewers annotate specific evidence lines or screenshots with questions and verdicts.
57183. **Review reassignment workflow** — Allow clean handoff of in-progress reviews with transferred context notes and no lost history.
57184. **Conflict-of-interest exclusion** — Automatically exclude reviewers who authored, tuned, or previously approved the same finding from its review.
57185. **Rotating reviewer assignment** — Rotate reviewers across engines and targets to prevent familiarity blindness and distribute load.
57186. **Expertise-weighted review votes** — Weight review votes by demonstrated expertise in the finding's class when consensus is computed.
57187. **Critical-findings expert panel** — Convene a standing panel of senior reviewers for rapid collective review of critical findings.
57188. **Review calibration sessions** — Hold regular sessions where reviewers grade the same findings and discuss scoring differences.
57189. **Shadow reviews for trainee reviewers** — Pair new reviewers with mentors who co-review and grade the trainee's judgments before solo work.
57190. **Review-of-reviewers audit** — Periodically audit review decisions themselves for thoroughness, fairness, and checklist compliance.
57191. **Reviewer agreement tracking** — Measure pairwise agreement between reviewers to identify calibration drift or training needs.
57192. **Dissent documentation** — Record minority reviewer opinions permanently so disagreements are visible even after majority approval.
57193. **Majority-vote deadlock breaker** — Use structured majority voting with documented criteria when reviewers cannot reach consensus.
57194. **Senior tie-break authority** — Designate a senior reviewer to break ties with a written rationale that becomes precedent.
57195. **Review batching for efficiency** — Group related findings into single review sessions to reduce context-switching overhead.
57196. **Finding clustering for batch review** — Cluster findings by root cause or component so one reviewer handles the coherent set.
57197. **Review queue prioritization (qa)** — Order review queues by severity, SLA urgency, and client commitment rather than arrival time.
57198. **Pre-review automated triage** — Run automated checks (duplicates, evidence presence, formatting) before human review so reviewers focus on judgment.
57199. **Review handoff notes** — Require outgoing reviewers to leave structured handoff notes when shifts or assignments change.
57200. **Review session timeboxing** — Timebox review sessions per finding class to keep throughput predictable without rushing judgment.
57201. **Async and sync review modes** — Support both asynchronous queue review and synchronous live review sessions for complex findings.
57202. **Pair review for novel vulnerability classes** — Require two reviewers working together on findings in classes the team has rarely seen.
57203. **External researcher review pool** — Maintain a vetted pool of external researchers for independent review of sensitive or disputed findings.
57204. **Bounty platform liaison review** — Include a review step aligned with target platform triage expectations before submission.
57205. **Client-side reviewer seats** — Offer clients optional reviewer seats so they can approve, question, or contextualize findings pre-release.
57206. **Immutable review audit trail** — Write every review action to an append-only log for compliance and dispute resolution.
57207. **SLA breach auto-escalation (qa)** — Automatically escalate reviews approaching SLA breach to backup reviewers and team leads.
57208. **Reviewer workload caps** — Enforce maximum concurrent reviews per reviewer to protect decision quality under load.
57209. **Review throughput metrics** — Track reviews completed per reviewer per period, segmented by finding class and severity.
57210. **Review comment templates** — Provide structured templates for common review feedback (evidence gap, severity dispute, language fix).
57211. **Severity-challenge workflow** — Give reviewers a dedicated lane to challenge severity assignments with counter-evidence.
57212. **Evidence-challenge workflow** — Give reviewers a dedicated lane to challenge evidence sufficiency and request specific artifacts.
57213. **Duplicate-challenge workflow** — Give reviewers a dedicated lane to flag suspected duplicates with candidate matches.
57214. **Remediation-advice review lane** — Route remediation sections to reviewers with fix-verification expertise for accuracy checking.
57215. **Report-language review lane** — Route final prose to language reviewers for tone, clarity, and professionalism checks.
57216. **Screenshot review lane** — Route visual evidence to reviewers trained in screenshot QA standards.
57217. **Reproducibility review lane** — Route reproducibility attestations to reviewers who independently re-run the replay artifacts.
57218. **Review decision rationale requirement** — Require a written rationale for every approve/reject decision, stored with the finding permanently.
57219. **Overturn with justification** — Allow overturning prior review decisions only with new evidence and a documented justification.
57220. **Review analytics per reviewer** — Provide each reviewer with personal analytics: agreement rate, overturn rate, throughput, and calibration trends.
57221. **Reviewer onboarding checklist** — Require new reviewers to complete training, shadow reviews, and calibration quizzes before solo assignments.
57222. **Review playbook per severity** — Publish severity-specific review playbooks defining depth, required checks, and approval authority.
57223. **Emergency review fast-lane** — Provide an expedited review path for actively-exploited or time-critical findings with compressed SLAs.
57224. **Post-release review sampling** — Sample already-released reports for retrospective review to catch escaped defects and improve the process.
57225. **Review retrospective meetings** — Hold periodic retrospectives on the review process itself, acting on reviewer-proposed improvements.
57226. **Continuous reviewer feedback channel** — Maintain an always-open channel for reviewers to propose checklist, tooling, and workflow improvements.
57227. **Review tooling UX improvements** — Track reviewer friction points in the tooling and prioritize fixes that reduce review time without cutting rigor.
57228. **Vacation coverage and delegation rules** — Define automatic delegation and coverage rules so reviews never stall when reviewers are unavailable.
57229. **Reflected XSS checklist** — Require proof of non-persistent reflection, exact injection point, encoding context, and a benign-payload negative control.
57230. **Stored XSS checklist** — Require proof of persistence, retrieval trigger steps, affected viewers, and stored payload location evidence.
57231. **DOM XSS checklist** — Require identification of the vulnerable sink and source, client-side execution trace, and console evidence.
57232. **Error-based SQLi checklist** — Require the database error artifact, query context inference, and proof the error is injectable rather than incidental.
57233. **Blind SQLi checklist** — Require boolean or time-differential evidence across multiple requests with statistical significance noted.
57234. **Time-based SQLi checklist** — Require calibrated timing measurements with baseline comparisons and network-jitter controls.
57235. **IDOR checklist** — Require proof of unauthorized object access, ownership records for both accounts, and identical-condition control tests.
57236. **Broken access control checklist** — Require horizontal and vertical privilege test matrices with expected-vs-actual outcomes documented.
57237. **SSRF checklist** — Require receiver-side proof of the outbound request, internal target evidence, and cloud-metadata access attempts documented safely.
57238. **XXE checklist** — Require proof of external entity resolution via controlled out-of-band or error-based evidence with safe payloads.
57239. **SSTI checklist** — Require template-engine identification, expression evaluation proof, and sandbox-escape boundaries documented.
57240. **Command injection checklist** — Require command-execution evidence via safe side effects (e.g., time delay, DNS ping) with output redaction.
57241. **RCE checklist** — Require the strongest safe proof tier achieved, blast-radius documentation, and mandatory senior review signoff.
57242. **Unrestricted file upload checklist** — Require uploaded file metadata, retrieval URL proof, content-type handling evidence, and execution-context analysis.
57243. **Path traversal and LFI checklist** — Require file-read proof via safe canary files, traversal depth documentation, and null-byte/encoding variants tested.
57244. **RFI checklist** — Require proof of remote file inclusion via controlled remote content with collaboration-platform-safe payloads.
57245. **CSRF checklist** — Require proof that state-changing requests lack unguessable tokens, with auto-submitted PoC and SameSite analysis.
57246. **Clickjacking checklist** — Require frame-embeddability proof, absence of frame-busting headers, and UI-redressing impact demonstration.
57247. **Open redirect checklist** — Require redirect chain capture, allowlist-bypass analysis, and phishing-impact assessment.
57248. **JWT none-algorithm checklist** — Require token forgery proof with alg=none accepted, plus key-confusion variants tested.
57249. **JWT weak-secret checklist** — Require demonstration of weak-secret exploitation only against test keys, with cracking methodology documented.
57250. **JWT key-confusion checklist** — Require RS256-to-HS256 confusion proof with key material handling documented safely.
57251. **Authentication brute-force checklist** — Require rate-limit absence proof, account-lockout testing results, and credential-stuffing guardrails observed.
57252. **Session fixation checklist** — Require proof that a pre-auth session identifier remains valid post-authentication.
57253. **Mass assignment checklist** — Require proof of privileged field modification via parameter injection with before/after object state.
57254. **GraphQL introspection checklist** — Require introspection query evidence, schema exposure assessment, and disabled-introspection verification steps.
57255. **GraphQL batching and depth checklist** — Require query-complexity abuse proof with measured resource impact and rate-limit observations.
57256. **HTTP verb tampering checklist** — Require method-override and verb-confusion test matrices with authorization outcomes per verb.
57257. **HTTP request smuggling checklist** — Require desync proof via safe timing differentials with frontend/backend behavior documented.
57258. **Host header injection checklist** — Require poisoned-host evidence including password-reset link capture and cache-poisoning assessment.
57259. **Cache poisoning checklist** — Require cache-hit proof of poisoned responses with cache-key analysis and busting controls.
57260. **CRLF injection checklist** — Require header-injection proof with response-splitting impact contained to safe demonstrations.
57261. **LDAP injection checklist** — Require filter-manipulation proof with safe boolean-based extraction evidence.
57262. **XPath injection checklist** — Require expression-manipulation proof with document-structure inference documented.
57263. **NoSQL injection checklist** — Require operator-injection proof with query-semantics evidence for the specific database.
57264. **Prototype pollution checklist** — Require pollution proof via safe property injection with gadget-impact analysis.
57265. **Race condition checklist** — Require concurrency evidence with request timing, success-rate statistics, and single-threaded control tests.
57266. **Price tampering checklist** — Require order-flow evidence with manipulated amounts, transaction records, and payment-gateway behavior.
57267. **Workflow bypass checklist** — Require step-skipping proof with state-machine mapping of the intended versus actual flow.
57268. **Account takeover via reset checklist** — Require reset-token evidence with entropy analysis and delivery-channel interception proof.
57269. **2FA bypass checklist** — Require bypass proof for each second factor with brute-force, replay, and logic-flaw variants tested.
57270. **OAuth misconfiguration checklist** — Require redirect-uri, state, and token-leakage tests with provider-specific checklist items.
57271. **CORS misconfiguration checklist** — Require credentialed cross-origin read proof with origin-reflection analysis.
57272. **Subdomain takeover checklist** — Require DNS evidence, dangling-service proof, and safe content-hosting demonstration.
57273. **TLS configuration checklist** — Require cipher-suite enumeration, certificate chain capture, and protocol-version evidence.
57274. **Stack trace disclosure checklist** — Require error-trigger evidence with trace capture and information-value assessment.
57275. **Repository and env file exposure checklist** — Require exposed-file retrieval proof with secret-redaction verification before reporting.
57276. **Backup file exposure checklist** — Require backup-artifact retrieval proof with staleness and sensitivity assessment.
57277. **Default credentials checklist** — Require login proof with vendor-default pairs on in-scope assets only, with immediate disclosure handling.
57278. **Verbose error message checklist** — Require error-response corpus with information-leakage classification per message.
57279. **Missing rate-limit checklist** — Require request-rate measurements, threshold observations, and abuse-impact assessment.
57280. **SAML assertion checklist** — Require assertion-tampering proof with signature-validation analysis and audience checks.
57281. **API object-level authorization checklist** — Require BOLA test matrices across object IDs with ownership proof for each test account.
57282. **Email header injection checklist** — Require header-injection proof via contact-form or notification flows with delivery evidence.
57283. **HTTP parameter pollution checklist** — Require duplicate-parameter behavior mapping with backend parsing-order evidence.
57284. **Checklist versioning per vulnerability class** — Version every class checklist, track which version certified each finding, and require re-certification on major updates.
57285. **Ten-percent auto-confirmed audit** — Independently re-review a random 10% sample of auto-confirmed findings each period to validate the auto-confirm pipeline.
57286. **Severity-stratified sampling** — Stratify audit samples by severity so critical and high findings are proportionally represented beyond their population share.
57287. **Engine-stratified sampling** — Stratify by detection engine so every engine's output is audited regardless of its volume.
57288. **Vulnerability-class-stratified sampling** — Ensure rare vulnerability classes appear in audit samples even when they are numerically uncommon.
57289. **Target-stratified sampling** — Stratify by target so high-value or high-risk targets receive proportionally deeper audit coverage.
57290. **Random spot audits** — Run unannounced random spot audits outside the scheduled program to detect process drift.
57291. **Double-sampling methodology** — Audit a subsample of already-audited findings with a second auditor to measure audit reliability itself.
57292. **Sequential sampling with stop rules** — Use sequential statistical sampling that stops early when quality is clearly acceptable or clearly deficient.
57293. **Audit of rejected and dropped findings** — Sample findings the agent discarded to estimate false negatives escaping the pipeline.
57294. **Auditor calibration with gold set** — Require auditors to score a gold-standard finding set periodically and track their calibration.
57295. **Blind re-audit** — Re-audit findings without showing the original audit verdict to measure true agreement.
57296. **Defect-rate estimation with confidence intervals** — Report audit defect rates with confidence intervals rather than point estimates alone.
57297. **Escaped-defect tracking** — Log defects found after release that sampling missed, and analyze why the sample design didn't catch them.
57298. **Audit rotation across auditors** — Rotate auditors across engines, targets, and classes to prevent familiarity bias.
57299. **Auditor independence rule** — Prohibit auditors from auditing findings they reviewed, authored, or tuned.
57300. **Sampling audit dashboard** — Display live sampling coverage, defect rates, and auditor activity in a dedicated dashboard.
57301. **Audit finding taxonomy** — Classify audit findings (evidence gap, severity error, duplicate, language) for trend analysis.
57302. **Audit SLA** — Define turnaround targets for audit completion per sample batch.
57303. **Audit queue management** — Maintain a visible queue of pending audit samples with priority and aging indicators.
57304. **Quarterly deep-dive audits** — Conduct intensive quarterly audits on a focused theme (e.g., severity accuracy) with full write-ups.
57305. **Targeted audits after engine updates** — Trigger focused audit samples whenever a detection engine ships a significant update.
57306. **Targeted audits after incidents** — Launch incident-triggered audit sweeps on the affected engine, class, or target segment.
57307. **New-reviewer oversampling** — Oversample findings reviewed by new reviewers until their calibration is established.
57308. **High-risk target oversampling** — Oversample findings from high-risk or high-visibility targets beyond the base rate.
57309. **Critical-severity census audit** — Audit 100% of critical findings (census, not sample) given their outsized consequences.
57310. **Audit evidence re-verification** — Have auditors independently re-verify evidence artifacts rather than trusting the original review.
57311. **Audit reproducibility spot-check** — Re-run replay artifacts on a sample of audited findings to verify reproducibility claims.
57312. **Severity assignment audit** — Dedicate audit capacity specifically to checking severity accuracy across the sample.
57313. **Duplicate-handling audit** — Audit how duplicates and near-duplicates were resolved in the sampled findings.
57314. **Report language audit** — Audit the sampled findings' prose for tone, clarity, and professionalism.
57315. **Audit scoring rubric** — Publish a fixed rubric auditors use so audit verdicts are comparable across auditors and periods.
57316. **Inter-auditor agreement tracking** — Measure agreement between auditors on overlapping samples and investigate divergence.
57317. **Audit dispute resolution** — Provide a defined process for resolving disagreements between auditors with documented outcomes.
57318. **Audit report template** — Standardize audit write-ups with findings, defect rates, root causes, and recommendations.
57319. **Audit-to-engine feedback routing** — Route audit findings directly to the owning engine's backlog with severity-weighted priority.
57320. **Audit trend analysis** — Analyze defect rates over time to distinguish noise from genuine quality trends.
57321. **Audit coverage heatmap** — Visualize which engines, classes, and targets are under- or over-audited.
57322. **Under-audited segment alerts** — Alert QA leads when any segment falls below its minimum audit coverage for the period.
57323. **Audit cost tracking** — Track auditor hours per sample to balance rigor against cost and optimize sample sizes.
57324. **Audit automation assist** — Provide auditors with automated pre-checks (evidence presence, link validity) so human effort focuses on judgment.
57325. **Sampling seed transparency** — Publish the random seeds and stratification rules so sampling is reproducible and auditable.
57326. **Reproducible sampling** — Ensure the same seed and rules regenerate the identical sample for verification purposes.
57327. **Audit window definition** — Define clear time windows for each audit cycle so coverage claims are unambiguous.
57328. **Retroactive audit triggers** — Allow retroactive audits when new defect patterns are discovered in already-released findings.
57329. **Feedback-loop effectiveness audit** — Audit whether reviewer feedback actually resulted in engine improvements, closing the loop.
57330. **Meta-audit of QA gates** — Periodically audit the QA gates themselves to verify they catch what they claim to catch.
57331. **SLA compliance audit** — Audit whether QA SLAs were met across review, audit, and release stages.
57332. **Audit archive** — Retain all audit samples, verdicts, and reports in a searchable archive for compliance and learning.
57333. **Audit access controls** — Restrict audit data access to authorized QA staff with full access logging.
57334. **Auditor performance metrics** — Track auditor calibration, throughput, and defect-detection rates for coaching.
57335. **Auditor training program** — Maintain a structured training curriculum with refreshers tied to audit performance.
57336. **Audit checklist library** — Maintain a versioned library of audit checklists per finding class and QA dimension.
57337. **Sampling policy documentation** — Publish the full sampling policy (rates, stratification, triggers) for transparency.
57338. **Audit exception approvals** — Require documented approval for any deviation from the sampling policy.
57339. **Audit result publication** — Share sanitized audit results with the broader team to build a quality culture.
57340. **Audit-driven engine quarantine** — Automatically quarantine an engine from auto-confirm when its audit defect rate breaches the threshold.
57341. **Precision per detection engine** — Dashboard true-positive precision for each engine over rolling windows with trend arrows.
57342. **Recall per detection engine** — Estimate per-engine recall using golden targets and audit-discovered false negatives.
57343. **F1 score per engine** — Combine precision and recall into a single comparable F1 metric per engine.
57344. **Precision per vulnerability class** — Break precision down by vulnerability class to reveal class-specific weaknesses.
57345. **Recall per vulnerability class** — Break recall down by class to find systematically missed flaw types.
57346. **Per-target accuracy view** — Show precision and recall segmented by target to identify target-specific detection problems.
57347. **Reviewer agreement rate** — Display the rate at which independent reviewers agree on finding verdicts.
57348. **Cohen's kappa for reviewer pairs** — Show chance-adjusted agreement (kappa) for reviewer pairs to measure true calibration.
57349. **Overturn rate tracking** — Track how often reviewer or audit verdicts overturn the engine's original call, per engine.
57350. **Severity calibration error** — Measure the gap between engine-assigned and final severity as a calibration error metric.
57351. **Defect escape rate** — Track defects discovered after release per hundred findings as the headline escape metric.
57352. **False-confirmation rate** — Measure how often auto-confirmed findings are later invalidated.
57353. **Evidence sufficiency score trend** — Chart average evidence completeness scores over time per engine.
57354. **Report quality score trend** — Chart average report quality scores over time per report-generating component.
57355. **Time-to-first-review** — Display median and p95 time from finding submission to first human review.
57356. **Time-to-approval** — Display median and p95 time from submission to final approval.
57357. **Review throughput** — Show reviews completed per day segmented by severity and class.
57358. **Review queue depth** — Display current queue depth with aging bands to predict SLA risk.
57359. **Audit pass rate** — Show the percentage of audited findings passing without defect, per segment.
57360. **Sampling defect rate** — Display audit-sample defect rates with confidence intervals on the dashboard.
57361. **Engine quality ranking** — Rank engines by composite quality score combining precision, recall, and evidence quality.
57362. **Week-over-week deltas** — Highlight significant week-over-week changes in every headline metric.
57363. **Cohort comparison by engine version** — Compare quality metrics across engine versions to validate improvements.
57364. **Confidence calibration curve** — Plot engine confidence against empirical accuracy to reveal over- or under-confidence.
57365. **Confidence intervals on metrics** — Display uncertainty bands on sampled metrics so viewers don't over-read noise.
57366. **Drill-down from engine to finding** — Allow one-click drill-down from aggregate metrics to the individual findings behind them.
57367. **Exportable metrics** — Export any dashboard view to CSV or API for external reporting and analysis.
57368. **Metric regression alerting** — Alert QA owners automatically when a key metric regresses beyond its control band.
57369. **Anomaly detection on metrics (qa)** — Apply anomaly detection to metric time series to catch subtle degradations early.
57370. **SLA compliance percentage (qa)** — Show the share of reviews, audits, and releases meeting their SLAs.
57371. **Reviewer-level precision** — Display precision of findings approved by each reviewer as a coaching input.
57372. **Overturns given and received** — Show per-reviewer overturn statistics in both directions for calibration insight.
57373. **Feedback incorporation rate** — Track the share of reviewer feedback items that resulted in engine or process changes.
57374. **Retraining impact measurement** — Measure quality deltas before and after model retraining events on the dashboard.
57375. **Cost per verified finding** — Combine compute, review, and audit costs into a cost-per-verified-finding efficiency metric.
57376. **Quality-adjusted throughput** — Report throughput discounted by defect rates so speed can't mask poor quality.
57377. **Client acceptance rate** — Track the share of submitted findings accepted by clients or bounty platforms.
57378. **Duplicate rate** — Display the duplicate and near-duplicate rate per engine and per target.
57379. **Reproducibility rate** — Show the share of findings whose replay artifacts reproduce successfully on re-run.
57380. **Screenshot quality rate** — Display the share of visual evidence passing screenshot QA standards.
57381. **Language flag rate** — Track how often language/tone checks flag report prose, per report generator.
57382. **QA gate block rate** — Show how often each pre-report gate blocks findings, revealing gate strictness and upstream quality.
57383. **Gate override rate** — Track override frequency per gate as a signal of gate miscalibration or process pressure.
57384. **Appeal rate and outcomes** — Display finding appeal rates and their outcomes to monitor fairness of QA decisions.
57385. **Audit coverage percentage** — Show audit coverage achieved versus policy targets per segment.
57386. **Golden-set benchmark scores** — Display engine scores on the golden finding set as a stable reference metric.
57387. **Synthetic target scores** — Show engine performance on synthetic seeded targets refreshed each cycle.
57388. **Red-team exercise scores** — Incorporate periodic red-team exercise results as an external accuracy reference.
57389. **Metric definitions glossary** — Publish precise definitions for every dashboard metric to prevent misinterpretation.
57390. **Dashboard access roles** — Control metric visibility by role so sensitive reviewer analytics stay appropriately restricted.
57391. **Scheduled metric digests** — Email scheduled quality digests to stakeholders with highlights and exceptions.
57392. **Metrics API for integrations** — Expose all quality metrics via API for SIEM, BI, and workflow integrations.
57393. **Historical metric snapshots** — Snapshot metrics daily so past states can be reconstructed for investigations.
57394. **Deploy markers on metric charts** — Annotate metric timelines with engine deploys and process changes for causal reading.
57395. **Target- and difficulty-adjusted scoring** — Normalize engine scores for target difficulty so hard targets don't unfairly penalize engines.
57396. **Quality OKR tracking** — Map headline quality metrics to quarterly OKRs with progress visualization on the dashboard.
57397. **Skill-based review routing** — Assign findings to reviewers whose verified skills match the vulnerability class and stack.
57398. **Reviewer expertise tags** — Maintain granular expertise tags per reviewer (e.g., deserialization, OAuth) used by the routing engine.
57399. **Review load balancing** — Distribute assignments to equalize active review load while respecting skill constraints.
57400. **Severity-weighted queue priority** — Order queues so critical findings are always assigned before lower-severity backlog.
57401. **SLA-aware scheduling (qa)** — Prioritize assignments by remaining SLA time, not just severity, to prevent breaches.
57402. **Reviewer availability calendar** — Integrate reviewer working hours and leave into assignment eligibility.
57403. **Reviewer capacity limits** — Cap concurrent assignments per reviewer based on historical throughput and quality.
57404. **Junior mentoring queues** — Route a supervised subset of findings to junior reviewers with mandatory mentor co-sign.
57405. **Senior-only critical queue** — Restrict critical findings to reviewers holding senior certification.
57406. **Timeout reassignment** — Automatically reassign reviews idle past a threshold, preserving partial progress notes.
57407. **Escalation reassignment** — Move escalated findings to higher-authority reviewers with full dispute context attached.
57408. **Round-robin fallback (qa)** — Use round-robin assignment when skill-based routing yields no eligible reviewer.
57409. **Reviewer preference profiles** — Let reviewers declare class preferences that influence, but don't dictate, assignment.
57410. **Language-matched assignment** — Assign reports to reviewers fluent in the report's language for language-lane reviews.
57411. **Timezone-aware routing (qa)** — Route urgent reviews to reviewers currently in working hours across timezones.
57412. **Target-familiarity bonus** — Prefer reviewers with prior history on the same target for context-rich findings.
57413. **Conflict-of-interest filter** — Block assignment to reviewers with authorship, tuning, or financial interest in the finding.
57414. **Reviewer workload dashboard** — Show live per-reviewer load, queue position, and predicted clear time.
57415. **Queue health alerts** — Alert leads when queue depth, aging, or imbalance exceeds healthy thresholds.
57416. **Aging item escalation** — Escalate individual queue items automatically as they approach SLA breach.
57417. **Batch assignment** — Assign coherent batches of related findings to one reviewer to amortize context setup.
57418. **Finding-cluster assignment** — Assign findings clustered by root cause to the same reviewer for consistent verdicts.
57419. **Shift handover notes** — Require structured handover notes when review responsibility crosses shifts.
57420. **On-call reviewer rotation** — Maintain an on-call rotation for after-hours critical reviews with defined response times.
57421. **Backup reviewer pool** — Keep a standby pool activated automatically during surge or absence events.
57422. **Vacation coverage planning** — Require reviewers to designate coverage before leave, with pending items reassigned in advance.
57423. **Queue forecasting** — Forecast queue depth from hunt schedules and historical finding rates for staffing decisions.
57424. **Throughput planning** — Plan reviewer capacity from measured throughput per class rather than generic estimates.
57425. **Assignment audit log** — Log every assignment decision with its routing rationale for fairness audits.
57426. **Assignment fairness metrics** — Monitor distribution of desirable and undesirable assignments across reviewers.
57427. **Performance-weighted routing** — Weight routing toward reviewers with stronger calibration in the finding's class.
57428. **New-reviewer ramp-up limits** — Gradually increase assignment volume and difficulty for new reviewers over their probation.
57429. **Probation review quotas** — Define explicit review quotas and quality bars reviewers must meet during probation.
57430. **Cross-training assignments** — Deliberately assign reviewers occasional out-of-specialty findings to broaden team capability.
57431. **Review pair assignments** — Assign complex findings to reviewer pairs who must produce a joint verdict.
57432. **Audit-reviewer separation** — Ensure audit samples are never assigned to the finding's original reviewer.
57433. **External reviewer onboarding** — Maintain a streamlined onboarding path for vetted external reviewers with scoped access.
57434. **Client reviewer seats** — Provision limited client reviewer accounts with visibility restricted to their own findings.
57435. **Assignment SLA per severity** — Define how quickly each severity tier must be assigned after submission.
57436. **Re-queue rules** — Define when and how findings return to the queue after request-changes or reassignment.
57437. **Priority override with justification (qa)** — Allow manual priority overrides only with a logged business justification.
57438. **Queue lane segmentation** — Segment queues into lanes (standard, fast-lane, language, screenshot) with dedicated capacity.
57439. **Fast-lane assignment** — Route actively-exploited findings to a dedicated fast-lane with senior reviewers on standby.
57440. **Bulk triage assignment** — Assign large low-severity batches to triage specialists with streamlined checklists.
57441. **Assignment notifications (qa)** — Notify reviewers through their preferred channel the moment an assignment lands.
57442. **Reminder nudges** — Send escalating reminders as assignments approach their SLA deadlines.
57443. **Stale assignment auto-release** — Release assignments untouched beyond a threshold back to the pool with an incident note.
57444. **Assignment analytics (qa)** — Analyze assignment patterns for bottlenecks, bias, and routing-rule effectiveness.
57445. **Reviewer utilization tracking** — Track utilized versus available review capacity to guide hiring and scheduling.
57446. **Queue burndown charts** — Display burndown of review backlog against SLA commitments.
57447. **WIP limits per reviewer** — Enforce work-in-progress limits so reviewers finish started reviews before taking new ones.
57448. **Context-switch minimization** — Batch similar findings per reviewer session to reduce cognitive switching costs.
57449. **Mobile review queue** — Provide a mobile-optimized queue for triage-level decisions on the go.
57450. **Offline review sync** — Allow reviewers to download assignments, review offline, and sync verdicts later.
57451. **Review queue API** — Expose queue operations via API for custom tooling and integrations.
57452. **Configurable assignment rule engine with sandbox** — Let QA leads configure routing rules and test them in a sandbox against historical data before activation.
57453. **Structured correction labels** — Capture every reviewer correction as a structured label (class, field, before, after) usable for retraining.
57454. **Reviewer rationale capture** — Require reviewers to record the reasoning behind corrections, not just the corrected value.
57455. **Correction taxonomy** — Maintain a fixed taxonomy of correction types (severity, evidence, duplicate, language, CWE) for aggregation.
57456. **Overturn reason codes** — Assign coded reasons to every overturned finding for pattern analysis.
57457. **Feedback routing to engine owners** — Route labeled corrections automatically to the owning engine's backlog with context attached.
57458. **Per-engine feedback inbox** — Give each engine a dedicated feedback inbox with triage, priority, and aging views.
57459. **Weekly feedback digest** — Send engine teams a weekly digest of corrections, overturns, and emerging patterns.
57460. **Prompt refinement from correction patterns** — Convert recurring correction patterns into prompt or instruction updates for generative components.
57461. **Detection-rule tuning tickets** — Auto-create tuning tickets when corrections cluster around a specific detection rule.
57462. **Evidence-standard updates from feedback** — Evolve evidence requirements when reviewers repeatedly request the same missing artifacts.
57463. **Severity-guideline updates from feedback** — Update severity guidelines when calibration feedback reveals systematic misgrading.
57464. **Checklist updates from feedback** — Revise class checklists when reviewers consistently add the same extra checks.
57465. **Golden-set expansion from corrections** — Promote interesting corrected findings into the golden evaluation set.
57466. **Retraining dataset curation** — Curate reviewer corrections into labeled datasets for model fine-tuning with quality sampling.
57467. **Feedback latency tracking** — Measure time from correction to deployed improvement as a loop-health metric.
57468. **Feedback incorporation verification** — Verify that claimed fixes actually address the feedback via targeted re-evaluation.
57469. **Before-and-after quality deltas** — Measure quality metric deltas attributable to specific feedback-driven changes.
57470. **Reviewer-engine feedback threads** — Host persistent discussion threads between reviewers and engine owners per finding class.
57471. **Disagreement resolution workflow** — Provide a structured path for resolving reviewer-versus-engine-owner disagreements on feedback validity.
57472. **Feedback quality rating** — Let engine owners rate the actionability of feedback to improve reviewer guidance.
57473. **Meta-feedback on feedback** — Collect second-order feedback on whether the feedback process itself is working.
57474. **Positive feedback capture** — Systematically capture what engines and reviewers did well so good patterns are reinforced.
57475. **False-negative feedback from audits** — Feed audit-discovered missed findings back as high-priority detection gaps.
57476. **Client feedback ingestion** — Ingest client and platform triager feedback into the same correction pipeline as internal review.
57477. **Platform feedback ingestion** — Parse bounty-platform triage notes (N/A, duplicate, informative) into structured correction labels.
57478. **Feedback deduplication** — Cluster duplicate feedback items so engine teams see one consolidated request.
57479. **Feedback prioritization scoring** — Score feedback by frequency, severity impact, and fix cost to order engine backlogs.
57480. **Feedback SLA for engine teams** — Define response-time expectations for engine teams acknowledging and acting on feedback.
57481. **Feedback dashboard** — Display feedback volume, aging, incorporation rate, and impact per engine.
57482. **Feedback-driven A/B tests** — Validate feedback-driven changes with A/B tests measuring correction-rate reduction.
57483. **Canary engine releases validated by feedback** — Gate canary promotions on feedback-derived quality metrics, not just unit tests.
57484. **Rollback triggers from feedback** — Define automatic rollback triggers when post-release feedback spikes indicate a regression.
57485. **Feedback archive search** — Make all historical feedback full-text searchable for engine developers.
57486. **Feedback trend analysis** — Analyze feedback themes over time to spot emerging detection or reporting weaknesses.
57487. **Seasonal pattern detection** — Detect cyclical feedback patterns (e.g., post-release spikes) for proactive planning.
57488. **Feedback attribution** — Attribute feedback to reviewer, engine version, and target context for precise root-causing.
57489. **Anonymous feedback option** — Allow reviewers to submit sensitive process feedback anonymously.
57490. **Feedback templates** — Provide structured templates ensuring feedback includes reproduction, expected behavior, and suggested fix.
57491. **Inline feedback on findings** — Let reviewers attach feedback directly to finding fields rather than separate tickets.
57492. **Batch feedback mode** — Let reviewers submit feedback across a batch of similar findings in one consolidated item.
57493. **Feedback API** — Expose feedback submission and retrieval via API for tooling integrations.
57494. **Feedback webhooks** — Push feedback events to engine teams' systems in real time via webhooks.
57495. **Issue tracker integration** — Sync feedback items bidirectionally with the engineering issue tracker.
57496. **Improvement ticket auto-creation** — Auto-create improvement tickets when correction volume for a pattern crosses a threshold.
57497. **Ticket-to-finding linkage** — Link improvement tickets back to the originating findings for traceability.
57498. **Fix verification loop** — Re-evaluate corrected patterns after fixes deploy to confirm the feedback is resolved.
57499. **Regression test generation from corrections** — Generate regression tests from corrected findings to prevent reintroduction.
57500. **Hallucination-pattern feedback to model team** — Route recurring model hallucination patterns to the model team with examples.
57501. **Tone feedback to report writer** — Route language corrections to the report-generation component with before/after pairs.
57502. **Screenshot feedback to evidence capturer** — Route visual-evidence corrections to the capture pipeline with annotated examples.
57503. **Calibration feedback loop** — Feed severity disagreements back into calibration training and guideline updates.
57504. **Quarterly feedback review meeting** — Hold cross-functional reviews of feedback trends, loop health, and systemic fixes.
57505. **Feedback-driven roadmap input** — Require product roadmaps to cite feedback evidence for quality-related priorities.
57506. **Feedback loop health metrics** — Monitor loop latency, incorporation rate, and stale-feedback counts as first-class metrics.
57507. **Cross-engine feedback sharing** — Share relevant corrections across engines when the root cause spans components.
57508. **Feedback-driven reviewer coaching** — Use feedback quality data to coach reviewers on writing more actionable corrections.
57509. **Defect taxonomy for QA** — Maintain a standard taxonomy of quality defects (missed vuln, wrong severity, weak evidence, poor prose) used across all improvement work.
57510. **Root-cause analysis workflow** — Require a structured RCA for every escaped defect above a severity threshold before closure.
57511. **Five-whys template for QA incidents** — Provide a guided five-whys template tailored to finding-quality incidents.
57512. **Improvement ticket lifecycle** — Define states from proposed through validated for every quality improvement ticket.
57513. **Improvement velocity metric** — Track improvements shipped per period as a measure of learning speed.
57514. **Kaizen board for QA** — Maintain a visible board of small continuous improvements proposed, in progress, and done.
57515. **Quality OKRs** — Set quarterly objectives and key results for finding quality with measurable targets.
57516. **Quarterly quality reviews** — Hold formal quarterly reviews of quality trends, improvement ROI, and next-quarter priorities.
57517. **Escaped-defect postmortems** — Run blameless postmortems for defects that reached clients, with published learnings.
57518. **Blameless postmortem template (qa)** — Standardize postmortems to focus on process and system causes, never individuals.
57519. **Corrective action tracking** — Track every corrective action from postmortem to verified completion.
57520. **Preventive action tracking** — Track preventive actions separately to ensure systemic fixes, not just incident fixes.
57521. **Effectiveness checks on actions** — Re-measure after actions complete to confirm the defect class actually declined.
57522. **Regression checks on fixes** — Re-run golden and historical cases after each fix to ensure no quality regression elsewhere.
57523. **Improvement experiment design** — Require a hypothesis, success metric, and rollback plan for every quality experiment.
57524. **A/B testing framework for QA changes** — Run QA process changes as A/B tests comparing defect and throughput metrics.
57525. **Experiment registry (qa)** — Log all quality experiments with design, results, and decisions in a searchable registry.
57526. **Success criteria definition** — Define quantitative success criteria before any improvement is declared complete.
57527. **Statistical significance checks** — Require significance testing before concluding an improvement actually worked.
57528. **Staged rollout for improvements** — Roll improvements out pilot-first, then expand based on measured results.
57529. **Rollback plans for QA changes** — Prepare rollback procedures for every process or tooling change in QA.
57530. **Improvement backlog grooming** — Groom the quality improvement backlog regularly with severity-weighted prioritization.
57531. **Prioritization matrix for improvements** — Score improvements on impact versus effort to sequence the backlog transparently.
57532. **Cost-benefit scoring** — Attach estimated quality gain and implementation cost to each proposed improvement.
57533. **Quick-wins lane** — Maintain a fast lane for low-effort, high-confidence improvements with lightweight approval.
57534. **Strategic initiatives lane** — Separate multi-quarter quality initiatives with dedicated ownership and milestones.
57535. **Improvement ownership assignment** — Assign a single owner accountable for each improvement's outcome.
57536. **Cross-functional improvement squads** — Form temporary squads spanning review, engineering, and data for systemic issues.
57537. **Quality champions network** — Designate quality champions in each team to surface and drive local improvements.
57538. **Lessons-learned database** — Store searchable lessons from postmortems, audits, and experiments.
57539. **Searchable improvement archive** — Archive all completed improvements with context so future teams don't repeat solved problems.
57540. **Improvement newsletter** — Publish a periodic newsletter highlighting quality wins, learnings, and upcoming changes.
57541. **Quality town halls** — Hold open town halls where anyone can raise quality concerns and hear improvement plans.
57542. **Maturity model assessments** — Assess QA maturity against a defined model annually and target the next level.
57543. **Capability benchmarking** — Benchmark QA capabilities against industry peers using public and shared data.
57544. **External benchmark comparison** — Compare defect and acceptance rates against published bounty-platform statistics.
57545. **Peer organization learning** — Exchange sanitized quality practices with peer security organizations.
57546. **Research paper watch** — Monitor academic and industry research for applicable QA techniques and pilot the promising ones.
57547. **Tooling evaluation pipeline** — Evaluate new QA tools through a standard pilot-scorecard-adopt pipeline.
57548. **Pilot program framework** — Define how pilots are scoped, measured, and decided for any QA innovation.
57549. **Improvement ROI tracking** — Measure return on quality investments in defect reduction and reviewer hours saved.
57550. **Quality cost model** — Track prevention, appraisal, and failure costs to optimize total quality spending.
57551. **Defect cost quantification** — Quantify the downstream cost of escaped defects (rework, reputation, credits) to justify prevention.
57552. **Improvement dashboards** — Visualize improvement pipeline health: proposed, active, completed, and measured impact.
57553. **Quality trend reports** — Publish regular trend reports connecting improvements to metric movements.
57554. **Leading indicators for quality** — Track predictive leading indicators (reviewer load, gate overrides) alongside lagging defect rates.
57555. **Lagging indicators review** — Review lagging indicators (escapes, acceptance) on a fixed cadence with variance analysis.
57556. **Balanced quality scorecard** — Combine accuracy, timeliness, cost, and satisfaction into one balanced scorecard.
57557. **Quality awards program** — Recognize individuals and teams behind the most impactful quality improvements.
57558. **Improvement suggestion box** — Maintain an always-open channel for quality improvement suggestions from anyone.
57559. **Suggestion triage process** — Triage suggestions quickly with transparent accept/defer/decline decisions and reasons.
57560. **Quality hackathon** — Run periodic hackathons focused on QA tooling, automation, and process innovations.
57561. **Improvement documentation standard** — Document every improvement's rationale, design, and measured outcome consistently.
57562. **Versioned quality playbook** — Maintain the QA playbook under version control with review and approval for changes.
57563. **QA process changelog** — Publish a changelog of QA process changes so everyone knows what changed and when.
57564. **Process audit schedule with maturity scoring** — Audit the QA process itself on a schedule and score improvement maturity over time.
57565. **Evidence-presence gate** — Block any report where a finding lacks its mandatory evidence bundle.
57566. **Raw request artifact gate** — Block findings missing the complete raw HTTP request artifact.
57567. **Raw response artifact gate** — Block findings missing the complete raw HTTP response artifact.
57568. **Replay-script gate** — Block findings whose auto-generated replay script fails a syntax and completeness check.
57569. **Steps-to-reproduce gate** — Block findings with missing, unordered, or unnumbered reproduction steps.
57570. **Screenshot gate for UI findings** — Block UI-visible findings that lack at least one screenshot passing visual QA.
57571. **Severity-justification gate** — Block findings whose severity lacks a written justification tied to evidence.
57572. **CVSS vector gate** — Block findings with malformed, incomplete, or evidence-contradicted CVSS vectors.
57573. **CWE assignment gate** — Block findings with missing or invalid CWE identifiers.
57574. **Duplicate-check gate** — Block findings that match a known issue above the duplicate-confidence threshold pending merge review.
57575. **Scope-membership gate** — Block findings on assets that cannot be proven inside the authorized scope.
57576. **Authorization-proof gate** — Block findings lacking proof that testing stayed within authorized bounds.
57577. **PII-redaction gate** — Block reports containing unredacted PII in evidence, detected by automated scanning.
57578. **Placeholder-text scan gate** — Block reports containing template placeholders like TODO, TBD, or [INSERT].
57579. **TODO-marker scan gate** — Scan evidence and prose for leftover TODO/FIXME markers and block on detection.
57580. **Tone-check gate** — Block reports failing the automated tone and professionalism checks pending language review.
57581. **Readability-floor gate** — Block reports scoring below the minimum readability threshold.
57582. **Report-completeness-score gate** — Block reports below the composite completeness score threshold.
57583. **Title-quality gate** — Block findings with vague, duplicated, or malformed titles.
57584. **Remediation-section gate** — Block findings missing actionable remediation guidance.
57585. **Impact-section gate** — Block findings missing a concrete business-impact statement.
57586. **Affected-asset identification gate** — Block findings that don't precisely identify affected assets and versions.
57587. **Version-precision gate** — Block findings citing vague versions ("latest") without tested-version evidence.
57588. **Reproducibility-attestation gate** — Block findings lacking a signed reproducibility attestation or successful re-run record.
57589. **Confidence-threshold gate** — Block auto-confirmation of findings below the calibrated confidence floor.
57590. **Cross-engine corroboration gate** — Require corroboration evidence for auto-confirmed criticals before release.
57591. **Reviewer-approval gate for criticals** — Hard-block critical findings from release without recorded human approval.
57592. **Checklist-completion gate per class** — Block findings whose vulnerability-class QA checklist is incomplete.
57593. **Chain-of-custody hash gate** — Block evidence bundles failing hash-chain integrity verification.
57594. **Evidence-freshness gate** — Block findings relying on evidence older than the freshness policy.
57595. **Environment-parity gate** — Block findings where evidence environment contradicts the reported environment.
57596. **Language-lane gate** — Route reports through the language review lane automatically when tone checks are marginal.
57597. **Client-template compliance gate** — Block reports deviating from the client's required template structure.
57598. **Export-render gate** — Block release when the PDF or HTML export fails to render or loses content.
57599. **Link-validity gate** — Block reports containing broken internal or external links.
57600. **Image-embed gate** — Block reports with missing, corrupt, or uncaptioned embedded images.
57601. **Metadata-completeness gate** — Block reports missing required metadata: target, dates, hunter identity, scope reference.
57602. **Disclosure-policy gate** — Block external release of findings violating the disclosure or embargo policy.
57603. **Embargo-date gate** — Prevent release of embargoed findings before their embargo date passes.
57604. **Severity-cap gate** — Prevent auto-assignment of critical severity without human review, capping automation at high.
57605. **Known-FP-pattern novelty gate** — Block findings matching known false-positive signatures pending human confirmation.
57606. **Regression-vs-baseline gate** — Compare outgoing findings against baseline quality metrics and hold on significant regression.
57607. **Gate results dashboard** — Display per-gate pass, block, and override rates in real time.
57608. **Gate block analytics** — Analyze which gates block most often to find upstream quality problems.
57609. **Gate override workflow with dual approval** — Allow gate overrides only with two authorized approvers and a recorded reason.
57610. **Override audit log** — Write every gate override to an immutable audit log with approver identities.
57611. **Override reason taxonomy** — Classify override reasons (client urgency, evidence pending, false block) for analysis.
57612. **Emergency bypass with post-hoc review** — Permit emergency bypasses for active exploitation with mandatory retrospective review within 24 hours.
57613. **Staged gates (auto, human, release)** — Sequence gates into automated, human-review, and pre-release stages with clear entry criteria.
57614. **Per-client gate configuration** — Allow clients to tighten (never loosen below minimum) gate strictness per engagement.
57615. **Gate dry-run mode** — Run new or tuned gates in dry-run mode measuring would-block rates before enforcement.
57616. **Gate performance timing** — Monitor each gate's execution time to keep the pipeline fast.
57617. **Gate failure notifications** — Notify the responsible engine or author immediately when a gate blocks, with specific reasons.
57618. **Gate remediation guidance** — Have blocking gates tell the agent exactly which artifact or fix is missing, not just that it failed.
57619. **Gate effectiveness metrics** — Measure each gate's precision and recall against audit outcomes to tune or retire ineffective gates.
57620. **CVSS vector audit** — Have reviewers independently re-derive the CVSS vector from evidence and compare against the assigned one.
57621. **Impact-likelihood matrix review** — Re-score findings on a fixed impact-versus-likelihood matrix as a cross-check on CVSS.
57622. **Exploitability evidence standard** — Define the minimum evidence required to claim each exploitability level and audit compliance.
57623. **Business-context adjustment review** — Review severity adjustments made for business context (asset criticality, data sensitivity) with documented rationale.
57624. **Peer calibration sessions** — Run regular sessions where reviewers severity-grade the same findings and reconcile differences.
57625. **Benchmark severity set** — Maintain a gold set of findings with consensus severity used to calibrate reviewers and engines.
57626. **Severity drift detection** — Statistically detect when an engine's or reviewer's severity distribution drifts from baseline.
57627. **Severity change log** — Record every severity change with before, after, reason, and author for auditability.
57628. **Severity appeal process** — Provide a formal path to appeal severity decisions with independent re-evaluation.
57629. **Severity rationale paragraph requirement** — Require a plain-language paragraph justifying the severity in every finding.
57630. **Pre- and post-mitigation severity** — Record both inherent and residual severity where mitigations partially apply.
57631. **Environmental metrics review** — Audit CVSS environmental metric choices against actual deployment context.
57632. **Temporal metrics review** — Audit CVSS temporal metric choices (exploit maturity, remediation level) against current intelligence.
57633. **Scope-changed assessment** — Explicitly assess CVSS scope-changed cases where exploitation crosses security boundaries.
57634. **Safety-impact consideration** — Include physical-safety and operational-safety impact in severity for relevant targets.
57635. **Data-sensitivity weighting (qa)** — Weight severity by the classification of data at risk, documented per finding.
57636. **Asset-criticality weighting (qa)** — Weight severity by asset criticality tiers defined with the client.
57637. **Exposure weighting** — Adjust severity for internet-facing versus internal exposure with evidence of reachability.
57638. **Authentication-required discounting** — Apply consistent, documented discounts when exploitation requires authenticated access.
57639. **User-interaction discounting** — Apply consistent, documented discounts when victim interaction is required.
57640. **Chaining-potential uplift review** — Review severity uplifts claimed from chaining with evidence for each link.
57641. **Wormability consideration** — Flag and separately assess findings with wormable or self-propagating potential.
57642. **Mass-exploitability check** — Assess whether exploitation can be automated at scale and reflect it in severity.
57643. **Severity floor and ceiling rules** — Define per-class severity floors and ceilings that automation cannot cross without review.
57644. **Auto-severity guardrails** — Constrain engine-assigned severity within guardrails derived from historical reviewer corrections.
57645. **Human override of auto-severity** — Ensure reviewers can override automated severity with one action and a required reason.
57646. **Severity consensus voting** — Use structured voting among qualified reviewers for borderline severity decisions.
57647. **Severity distribution monitoring** — Monitor the overall severity distribution for inflation or deflation trends.
57648. **Grade inflation detection** — Statistically flag reviewers or engines whose severity runs hot versus peers.
57649. **Per-engine severity bias detection** — Measure each engine's severity bias against final reviewer verdicts.
57650. **Per-reviewer severity bias** — Measure each reviewer's severity bias for personalized calibration coaching.
57651. **Calibration workshop curriculum** — Maintain a training curriculum with worked severity examples per class.
57652. **Severity quiz for reviewers** — Require periodic severity quizzes; remedial training follows below-threshold scores.
57653. **Inter-rater reliability tracking (qa)** — Track severity agreement statistics across reviewer pairs over time.
57654. **Severity guideline versioning** — Version severity guidelines and record which version governed each finding.
57655. **Guideline change communication** — Announce guideline changes with examples and a grace period before enforcement.
57656. **Client-specific severity mapping** — Maintain documented mappings from internal severity to each client's risk scale.
57657. **Platform-specific severity mapping** — Maintain mappings to bounty-platform severity scales with triage-expectation notes.
57658. **CVSS version migration checks** — Validate severity consistency when migrating between CVSS versions.
57659. **Severity consistency in executive summary** — Verify the summary states the same severity as the scored sections.
57660. **Severity consistency in title** — Flag titles implying a different severity than the assigned rating.
57661. **Downgrade justification requirement** — Require written justification with evidence whenever severity is downgraded.
57662. **Upgrade justification requirement** — Require written justification with evidence whenever severity is upgraded.
57663. **Severity versus bounty-table alignment** — Cross-check severity against the client's bounty table to catch payout mismatches.
57664. **Historical severity accuracy** — Track how often assigned severities matched platform or client acceptance outcomes.
57665. **Platform acceptance correlation** — Correlate internal severity with bounty-platform triage decisions to validate calibration.
57666. **Severity language standardization** — Enforce standard severity descriptors so "high" means the same thing everywhere.
57667. **Severity visualization standards** — Standardize severity badges, colors, and charts across reports and dashboards.
57668. **Severity calibration review SLA** — Define turnaround targets for dedicated severity reviews.
57669. **Calibration review queue** — Maintain a separate queue for findings flagged for severity calibration review.
57670. **Severity review audit trail** — Log all severity review actions immutably.
57671. **Severity metrics dashboard** — Display calibration error, bias, drift, and appeal metrics in one view.
57672. **Severity calibration leaderboard** — Recognize reviewers and engines with the best calibration accuracy.
57673. **Severity review sampling** — Sample severity decisions in audits even when the finding itself passed other checks.
57674. **Annual severity framework review** — Reassess the entire severity framework yearly against outcomes and industry practice.
57675. **Finding fingerprint matching** — Compute deterministic fingerprints from normalized endpoint, parameter, and CWE, and match against the known-issue registry.
57676. **Semantic similarity search over reports** — Run semantic search over historical report text to surface likely duplicates the fingerprint missed.
57677. **Embedding-based near-duplicate detection** — Use finding embeddings to detect near-duplicates with similarity scores and reviewer-facing explanations.
57678. **Historical report full-text search** — Index all past reports for fast full-text duplicate investigation by reviewers.
57679. **Cross-hunt deduplication (qa)** — Compare new findings against findings from all previous hunts on the same target, not just the current one.
57680. **Per-target known-issue registry** — Maintain a living registry of confirmed issues per target with fingerprints and canonical records.
57681. **Canonical issue records** — Designate one canonical record per unique issue that duplicates merge into, preserving history.
57682. **Duplicate merge workflow (qa)** — Define how duplicates merge: evidence consolidation, reporter attribution, and canonical enrichment.
57683. **Duplicate confidence scoring** — Score duplicate matches with calibrated confidence so reviewers know how much to trust the suggestion.
57684. **Human review for near-duplicates** — Route similarity scores in the uncertain band to human review instead of auto-merging.
57685. **Duplicate precision metrics** — Measure the precision of duplicate decisions via audit sampling.
57686. **Duplicate recall audits** — Audit released findings for missed duplicates to estimate duplicate recall.
57687. **Fingerprint versioning** — Version the fingerprint algorithm and re-fingerprint the registry on changes to avoid stale matches.
57688. **Parameter normalization before matching** — Normalize parameter names, ordering, and encoding before fingerprinting to catch disguised duplicates.
57689. **URL canonicalization for matching** — Canonicalize URLs (trailing slashes, case, default ports) so equivalent endpoints match.
57690. **HTTP method sensitivity in fingerprints** — Include the HTTP method in fingerprints since the same path via different methods can be distinct issues.
57691. **Auth-context in fingerprint** — Include privilege context in the fingerprint so the same flaw at different privilege levels isn't wrongly merged.
57692. **Response-signature matching** — Match on normalized response signatures (error patterns, reflection markers) as a secondary duplicate signal.
57693. **Screenshot perceptual hashing** — Use perceptual hashes of PoC screenshots to catch visually identical duplicate evidence.
57694. **PoC payload similarity** — Compare PoC payloads with similarity metrics to link variants of the same underlying flaw.
57695. **Root-cause clustering (qa)** — Cluster findings by inferred root cause so same-cause findings are reviewed as duplicates or variants.
57696. **Variant-versus-duplicate policy** — Publish clear rules distinguishing true duplicates from variants worth separate tracking.
57697. **Variant documentation standard** — Document accepted variants with their relationship to the canonical issue.
57698. **Reopened-issue detection** — Detect when a previously closed issue reappears and link it to its history instead of treating it as new.
57699. **Fixed-then-regressed detection** — Distinguish genuine regressions of fixed issues from duplicates of still-open ones.
57700. **Wontfix registry check** — Check new findings against the wontfix registry to avoid re-reporting accepted risks.
57701. **Duplicate-of-wontfix handling** — Define handling when a new finding duplicates a wontfix item, including re-escalation criteria.
57702. **Bounty-platform known-issue sync** — Sync with platform disclosed and duplicate databases where available.
57703. **CVE-match check** — Check findings against CVE databases for the target's software versions before claiming novelty.
57704. **Advisory-match check** — Check vendor and community advisories for prior disclosure of the same issue.
57705. **Public-disclosure match check** — Search public write-ups and disclosures for the same vulnerability pattern on the target.
57706. **Internal pentest history check** — Compare against internal pentest reports to avoid duplicating already-known issues.
57707. **Previous bounty report check** — Check the client's prior bounty reports for the same issue before submission.
57708. **Duplicate appeal process** — Allow hunters and reviewers to appeal duplicate verdicts with additional differentiating evidence.
57709. **Merge audit trail** — Log every merge decision immutably with the matched canonical record and rationale.
57710. **Canonical record enrichment** — Enrich canonical records with evidence from merged duplicates to strengthen the master finding.
57711. **Duplicate rate dashboard** — Display duplicate rates per engine, target, and class with trend lines.
57712. **Per-engine duplicate rate** — Track which engines produce the most duplicates to target detection tuning.
57713. **Duplicate-rate alerting** — Alert when duplicate rates spike, indicating possible detection or scoping problems.
57714. **Fingerprint collision monitoring** — Monitor for fingerprint collisions that wrongly merge distinct issues.
57715. **Manual fingerprint override** — Let senior reviewers override fingerprint matches with documented justification.
57716. **Bulk dedup for imports** — Run batch deduplication when importing historical findings into the registry.
57717. **Dedup during triage** — Perform duplicate checks at triage time so reviewers never waste effort on obvious duplicates.
57718. **Dedup API for agents** — Expose duplicate-check as an API so hunting agents can self-check before submitting.
57719. **Dedup feedback loop** — Feed duplicate-decision corrections back to improve fingerprinting and similarity models.
57720. **False-duplicate correction** — Provide a fast path to unmerge wrongly merged findings with full history restoration.
57721. **Missed-duplicate postmortem** — Analyze duplicates discovered after release to improve matching coverage.
57722. **Dedup quality sampling (qa)** — Include duplicate decisions in audit samples with dedicated scoring.
57723. **Registry hygiene process** — Periodically clean stale, superseded, or low-quality canonical records.
57724. **Registry access controls** — Restrict registry modification to authorized roles with full change logging.
57725. **Registry export** — Export the known-issue registry for client review and archival.
57726. **Dedup in QA gate** — Enforce the duplicate check as a blocking pre-report QA gate.
57727. **Dedup SLA** — Define turnaround targets for duplicate investigations.
57728. **Dedup documentation** — Document the full dedup methodology, fingerprint design, and reviewer guidance.
57729. **Cross-target pattern linking** — Link the same vulnerability pattern across different targets for trend analysis while tracking each instance separately.
57730. **Profanity filter for reports** — Scan all report prose for profanity and block release until cleaned.
57731. **Accusatory language detection** — Flag language that accuses the client of negligence rather than describing the finding objectively.
57732. **Blame-shifting flags** — Detect phrasing that shifts responsibility to users or third parties without evidence.
57733. **Certainty calibration review** — Align modal verbs and certainty markers with the actual strength of evidence.
57734. **Absolute-claim flags** — Flag absolutes like "always", "never", and "impossible" for evidence verification or rewording.
57735. **Legal-risk phrasing flags** — Flag guarantees, warranties, and liability-adjacent phrasing for legal review.
57736. **Defamation-risk scan** — Scan for statements about named vendors or individuals that could carry defamation risk.
57737. **Alarmist tone detection** — Detect exaggerated urgency that isn't supported by the severity and evidence.
57738. **Condescending tone detection** — Flag patronizing phrasing toward client developers and suggest collaborative alternatives.
57739. **Jargon explanation check** — Require plain-language explanations or definitions alongside necessary technical terms.
57740. **Reading-level target enforcement** — Enforce target reading levels per section (simpler for summaries, technical for details).
57741. **Executive-tone check** — Verify executive sections use business language free of unexplained technical detail.
57742. **Technical-tone check** — Verify technical sections are precise and complete without dumbing down critical detail.
57743. **Consistent voice check** — Enforce a single consistent voice across sections instead of mixed authorial styles.
57744. **Tense consistency check** — Enforce consistent tense usage (past for testing performed, present for the vulnerability).
57745. **Person consistency check** — Enforce impersonal or consistent-person prose with no stray first-person intrusions.
57746. **Template phrase compliance** — Check required standard phrases appear where the template mandates them.
57747. **Banned-phrase list** — Maintain a list of prohibited phrases (slang, hyperbole, blame) blocked at the QA gate.
57748. **Discouraged-phrase suggestions** — Suggest better alternatives inline for discouraged but not banned phrasing.
57749. **Inclusive language check** — Scan for non-inclusive terminology and suggest neutral replacements.
57750. **Locale spelling consistency** — Enforce one spelling locale per report (e.g., US vs UK English) throughout.
57751. **Grammar lint** — Run grammar checking tuned for technical security prose and require fixes above an error threshold.
57752. **Punctuation lint** — Check punctuation in lists, code references, and version strings for consistency.
57753. **Capitalization standards** — Enforce consistent capitalization of product names, vulnerability classes, and severity labels.
57754. **Number formatting standard** — Enforce consistent formatting of counts, percentages, and measurements.
57755. **Date formatting standard** — Enforce ISO or client-specified date formats uniformly.
57756. **Unit formatting standard** — Enforce consistent units for timing, sizes, and rates.
57757. **Acronym handling rule** — Require first-use expansion and consistent casing for all acronyms.
57758. **Hyperlink text quality** — Require descriptive link text instead of raw URLs or "click here".
57759. **Alt-text quality check** — Require meaningful alt text on every report image describing what it proves.
57760. **Caption tone check** — Verify figure captions are neutral, informative, and consistent in style.
57761. **Heading tone check** — Verify headings are descriptive and professional rather than sensational.
57762. **Summary neutrality check** — Verify summaries present risk neutrally without editorializing about the client.
57763. **Impact statement objectivity** — Check impact statements describe consequences factually without speculative catastrophizing.
57764. **Remediation tone check** — Verify remediation guidance reads as collaborative advice, not condescending instruction.
57765. **Severity descriptor phrasebook for reports** — Maintain an approved phrasebook of severity descriptions that report authors must use verbatim for consistency.
57766. **Non-native phrasing polish** — Identify awkward machine-generated phrasing and rewrite for natural professional English.
57767. **Translation QA for multilingual reports** — Verify translated reports preserve meaning, severity, and technical accuracy.
57768. **Machine-translation post-edit check** — Require human post-editing verification for any machine-translated report sections.
57769. **Client style-guide compliance** — Check reports against client-specific style guides before delivery.
57770. **Platform style-guide compliance** — Check submissions against bounty-platform writing guidelines.
57771. **Tone scoring model** — Score report tone on professionalism dimensions and track scores per report generator.
57772. **Tone regression tests** — Include tone test cases in the QA suite so generator updates can't silently degrade prose.
57773. **Tone feedback loop** — Feed tone corrections back to the report-generation component with paired examples.
57774. **Reviewer tone-edit tracking** — Track how heavily reviewers edit tone per generator to prioritize improvements.
57775. **Tone guideline documentation** — Publish tone guidelines with do-and-don't examples for authors and reviewers.
57776. **Tone examples library** — Maintain a library of exemplary passages reviewers can reference and generators can learn from.
57777. **Humor policy** — Define where, if anywhere, humor is acceptable in reports and enforce the boundary.
57778. **Emoji policy** — Define and enforce emoji usage rules for client-facing versus internal reports.
57779. **Exclamation policy** — Limit exclamation marks in professional reports with automated flagging.
57780. **Rhetorical question policy** — Discourage rhetorical questions in findings in favor of direct statements.
57781. **Cultural sensitivity check** — Screen examples, metaphors, and idioms for cultural sensitivity across client regions.
57782. **Human tone sign-off for criticals** — Require a human language reviewer to sign off tone on every critical report.
57783. **Tone check in QA gate** — Wire automated tone checks into the pre-report gate pipeline as a blocking or routing step.
57784. **Tone metrics dashboard** — Display tone scores, flag rates, and edit distances per generator and reviewer.
57785. **PoC visibility detection** — Use computer vision to confirm the exploit payload or its effect is actually visible in the screenshot.
57786. **Screenshot resolution minimums** — Enforce minimum resolution standards so evidence remains legible when zoomed.
57787. **Aspect ratio checks** — Flag screenshots with distorted or unusual aspect ratios indicating capture problems.
57788. **Blur detection** — Automatically detect blurry screenshots and require re-capture.
57789. **Annotation presence check** — Verify screenshots include required annotations (arrows, highlights) pointing at the proof.
57790. **Annotation accuracy check** — Verify annotations point at the correct UI element, not adjacent or empty areas.
57791. **Redaction verification in screenshots** — Confirm PII and secrets are actually obscured in screenshots, not merely covered by selectable overlays.
57792. **Before-and-after pair completeness** — Require paired screenshots for state-change findings, captured under identical conditions.
57793. **Timestamp overlay check** — Verify screenshots carry trustworthy timestamps matching the evidence timeline.
57794. **Browser chrome inclusion** — Require browser chrome (address bar, tabs) in web PoC screenshots for context and authenticity.
57795. **URL bar visibility** — Specifically verify the address bar is visible and legible, proving which URL was tested.
57796. **Devtools evidence panels** — Require relevant devtools panels (network, console, application) visible for client-side findings.
57797. **Console error capture** — Require console output visible in screenshots for findings involving script errors.
57798. **Network tab capture** — Require network-panel screenshots showing the key request and response for web findings.
57799. **Viewport size labeling** — Label screenshots with viewport dimensions so responsive issues are interpretable.
57800. **Device labeling for mobile shots** — Require device, OS, and browser identification on mobile evidence screenshots.
57801. **OS and browser metadata** — Attach capture environment metadata (OS, browser, version) to every screenshot.
57802. **Full-page versus viewport appropriateness** — Check that the capture framing matches the finding (full page for layout issues, focused for specific elements).
57803. **Cropping appropriateness** — Flag over-cropped screenshots that remove the context needed to interpret the proof.
57804. **Screenshot file size limits** — Enforce size limits with compression guidance to keep reports portable.
57805. **Screenshot format standards** — Standardize on lossless PNG for evidence screenshots with documented exceptions.
57806. **Color accuracy check** — Flag screenshots with color distortion that could misrepresent UI states.
57807. **Dark-mode labeling** — Label screenshots captured in dark mode to avoid confusion about actual UI appearance.
57808. **Duplicate screenshot detection** — Detect identical or near-identical screenshots reused across findings.
57809. **Screenshot-to-claim alignment** — Verify each screenshot supports the specific claim its caption makes.
57810. **Step-number overlays** — Require step numbers overlaid on multi-step PoC screenshot sequences.
57811. **Multi-step sequence ordering** — Verify screenshot sequences are ordered and complete for the claimed workflow.
57812. **Video PoC quality standard** — Enforce resolution, frame-rate, and audio standards for video evidence.
57813. **Video length limits** — Cap video PoC length with chapter markers so reviewers can navigate efficiently.
57814. **Video narration quality** — Require clear narration or captions explaining each step in video PoCs.
57815. **Terminal transcript readability** — Enforce font size, contrast, and wrapping standards for terminal evidence.
57816. **Font legibility check** — Flag screenshots where critical text is too small to read at normal zoom.
57817. **Highlight contrast check** — Verify annotation highlights have sufficient contrast against the underlying UI.
57818. **Screenshot naming convention** — Enforce descriptive filenames linking each screenshot to its finding and step.
57819. **Alt-text presence on screenshots** — Require alt text describing each screenshot's evidentiary content.
57820. **Screenshot caption presence** — Require captions explaining what each screenshot proves, tied to the narrative.
57821. **Embedding check in report** — Verify every claimed screenshot is actually embedded and renders in the final report.
57822. **Thumbnail generation** — Generate thumbnails for quick reviewer scanning of visual evidence sets.
57823. **Zoomed detail insets** — Require magnified insets for small but critical on-screen details.
57824. **Before-and-after comparison sliders** — Provide interactive comparison views for paired state-change screenshots.
57825. **Screenshot retention policy** — Define how long raw screenshots are retained and when they are purged.
57826. **Screenshot access controls** — Restrict access to raw screenshots containing sensitive data with audit logging.
57827. **Screenshot QA scoring** — Compute a composite screenshot quality score per finding from the automated checks.
57828. **Auto-reject rules for screenshots** — Define hard auto-reject criteria (blank, corrupt, wrong window) with instant re-capture requests.
57829. **Re-capture request workflow** — Provide a one-click workflow for reviewers to request screenshot re-capture with specific guidance.
57830. **Screenshot lane in peer review** — Route visual evidence through a dedicated reviewer lane with visual-QA training.
57831. **Screenshot quality leaderboard input** — Feed screenshot QA scores into engine and reviewer quality leaderboards.
57832. **Screenshot guideline documentation** — Publish capture guidelines with good and bad examples per finding type.
57833. **Screenshot example gallery** — Maintain a gallery of exemplary evidence screenshots for training.
57834. **Screenshot tooling recommendations** — Standardize approved capture tools and settings across the team.
57835. **Capture automation hooks** — Trigger automatic screenshot capture at key hunt milestones for consistent evidence.
57836. **Headless capture verification** — Verify headless-browser captures match headed-browser rendering for the tested flows.
57837. **Screenshot falsification detection** — Apply tamper detection (metadata, pixel analysis) to catch manipulated evidence.
57838. **Screenshot versioning across retests** — Version screenshots across re-capture attempts so reviewers see the progression.
57839. **Screenshot quality trend dashboard** — Chart screenshot QA scores over time per engine and capture pipeline.
57840. **Automated re-trigger pipeline** — Re-execute every finding's replay artifacts in an isolated environment before report release.
57841. **Environment snapshot capture** — Snapshot the full test environment (versions, config, data) at finding time for faithful reproduction.
57842. **Dependency pinning record** — Record exact dependency versions involved in the finding so re-runs don't drift.
57843. **Containerized repro environment** — Provide containerized reproduction environments so anyone can re-trigger the finding identically.
57844. **N-of-m flakiness scoring** — Re-run findings n times and score flakiness from the success ratio, flagging intermittent results.
57845. **Time-decay re-check scheduling** — Schedule re-verification of findings after time intervals to catch environment-drift invalidation.
57846. **Independent second-engine re-execution** — Have a different engine independently re-execute the finding to confirm it's not an artifact of one pipeline.
57847. **Replay script generation** — Auto-generate executable replay scripts from captured evidence for every finding.
57848. **State-reset procedure documentation** — Document how to reset target state between reproduction attempts.
57849. **Documented preconditions checklist** — List all preconditions (accounts, data, flags) required before reproduction can begin.
57850. **Test account provisioning records** — Record which test accounts were provisioned with what roles for the reproduction.
57851. **Seed data documentation** — Document the seed data present during the original finding for reproducible setup.
57852. **Database fixture versioning** — Version database fixtures used in reproduction so re-runs use identical data.
57853. **Feature-flag state capture** — Record feature-flag states at finding time since flags change application behavior.
57854. **Cache state documentation** — Document cache states relevant to the finding (warmed, cold, poisoned).
57855. **CDN state note** — Note CDN configuration and cache status where edge behavior affects reproduction.
57856. **DNS state note** — Record DNS answers at finding time for hostname-dependent findings.
57857. **Time-dependent behavior handling** — Define how to handle findings depending on time (expiry, scheduling) during re-runs.
57858. **Rate-limit-aware retry** — Build rate-limit awareness into re-run harnesses so reproduction isn't blocked by throttling.
57859. **Auth token refresh handling** — Handle token expiry gracefully in replay scripts with documented refresh procedures.
57860. **Session expiry handling** — Document session lifetimes and re-authentication steps for long reproduction sequences.
57861. **Multi-step atomicity check** — Verify multi-step reproductions either complete fully or roll back cleanly.
57862. **Cleanup procedure** — Define cleanup steps restoring the target to its pre-test state after reproduction.
57863. **Side-effect disclosure** — Require disclosure of all side effects the reproduction causes on the target.
57864. **Safe-mode repro for destructive tests** — Provide safe-mode reproduction variants that prove the flaw without destructive effects.
57865. **Repro in staging mirror** — Reproduce against a staging mirror when production re-testing is restricted.
57866. **Repro result comparison criteria** — Define match criteria (exact, semantic, threshold) for comparing re-run results to originals.
57867. **Evidence diff on re-run** — Diff re-run evidence against original evidence and flag meaningful divergences.
57868. **Repro attestation signing** — Have the reproducing party cryptographically sign the attestation of successful reproduction.
57869. **Reproducibility SLA** — Define turnaround targets for completing reproducibility verification per severity.
57870. **Reproducibility queue** — Maintain a visible queue of findings awaiting reproducibility verification.
57871. **Repro failure triage** — Triage reproduction failures into flaky, environment-drift, invalid-finding, or harness-bug categories.
57872. **Flaky-finding quarantine (qa)** — Quarantine findings that reproduce intermittently pending root-cause analysis.
57873. **Flaky root-cause analysis** — Investigate flakiness causes (timing, state, concurrency) with documented conclusions.
57874. **Repro coverage metrics** — Track what share of findings completed reproducibility verification.
57875. **Repro success rate dashboard** — Display reproduction success rates per engine, class, and target.
57876. **Per-engine repro rates** — Compare engines on reproducibility to identify pipelines producing fragile findings.
57877. **Per-class repro difficulty index** — Publish a difficulty index per vulnerability class to set reviewer expectations.
57878. **Repro cost tracking** — Track compute and human cost of reproduction to optimize verification depth.
57879. **Repro prioritization by severity** — Prioritize reproducibility verification effort by finding severity.
57880. **Client-witnessed repro sessions** — Offer live witnessed reproduction sessions for high-stakes findings.
57881. **Video-recorded repro** — Record reproduction runs on video as durable proof.
57882. **Repro script archival** — Archive replay scripts with the finding permanently for future re-verification.
57883. **Replay script versioning** — Version replay scripts as they are fixed or improved.
57884. **Replay script linting** — Lint replay scripts for correctness, safety, and style before acceptance.
57885. **Replay script security review** — Review replay scripts for embedded credentials or unsafe operations.
57886. **Credential vault integration (qa)** — Source test credentials for reproduction from a vault, never from hardcoded values.
57887. **Secret rotation after repro** — Rotate any secrets used during reproduction per policy.
57888. **Target-state verification post-repro** — Verify the target returned to a clean state after reproduction completes.
57889. **No-residue attestation** — Require attestation that reproduction left no residual data, accounts, or configuration changes.
57890. **Repro sign-off workflow** — Define sign-off roles and records for completed reproducibility verification.
57891. **Repro dispute handling** — Provide a process for disputing failed reproductions with re-run rights.
57892. **Reproducibility guidelines documentation** — Publish end-to-end reproducibility guidelines with examples per class.
57893. **Repro-driven confidence scoring** — Adjust finding confidence based on reproduction outcomes (strengthened, unchanged, weakened).
57894. **Reproducibility in QA gate** — Make successful reproduction (or a documented waiver) a blocking pre-report gate.
57895. **Review turnaround SLA by severity** — Define explicit review turnaround targets: critical in hours, high in a day, medium and low in days.
57896. **Triage SLA** — Define how quickly new findings must be triaged into the review pipeline.
57897. **Evidence-completeness SLA** — Define turnaround for the agent to supply missing evidence after a QA request.
57898. **Reproducibility verification SLA** — Define turnaround targets for completing re-run verification per severity tier.
57899. **Sampling audit SLA** — Define how quickly audit samples must be completed within each audit cycle.
57900. **Appeal SLA** — Define turnaround for resolving severity and duplicate appeals.
57901. **Gate-override review SLA** — Define how quickly override requests must be decided by authorized approvers.
57902. **Client-report delivery SLA** — Define end-to-end delivery targets from hunt completion to client-ready report.
57903. **Language-lane SLA** — Define turnaround targets for the language and tone review lane.
57904. **Screenshot-lane SLA** — Define turnaround targets for the screenshot QA lane.
57905. **Severity-calibration SLA** — Define turnaround for dedicated severity calibration reviews.
57906. **Duplicate-investigation SLA** — Define turnaround for resolving suspected-duplicate investigations.
57907. **Gate-processing SLA** — Define maximum processing time for the automated pre-report gate pipeline.
57908. **Feedback-incorporation SLA** — Define how quickly engine teams must acknowledge and plan feedback items.
57909. **Postmortem SLA** — Define how quickly postmortems must be completed after escaped defects.
57910. **Business-hours versus 24-7 definitions** — Define precisely which SLAs run on business hours and which run around the clock.
57911. **Weekend coverage SLA** — Define minimum review coverage and response times for weekends.
57912. **Holiday coverage SLA** — Define holiday staffing and degraded-but-defined SLA targets.
57913. **Timezone-aware SLA clocks** — Compute SLA deadlines in the reviewer's local timezone with handoff rules across zones.
57914. **SLA pause rules** — Define when SLA clocks pause (waiting on agent evidence, client input) with automatic resume.
57915. **SLA breach alerts (qa)** — Alert assignees, backups, and leads at progressive thresholds before breach.
57916. **Breach escalation matrix** — Define who gets notified and what actions trigger at each breach severity level.
57917. **Breach postmortem** — Require a lightweight postmortem for repeated or severe SLA breaches.
57918. **SLA dashboards** — Display live SLA compliance, at-risk items, and breach counts per queue.
57919. **Per-queue SLA tracking** — Track SLA performance separately for each review lane and queue.
57920. **Per-reviewer SLA adherence** — Track individual SLA adherence as a coaching and capacity signal.
57921. **SLA attainment headline metric** — Report the share of work items meeting SLA as a headline quality metric.
57922. **Backlog burndown versus SLA** — Chart backlog burndown against SLA commitments to predict future breaches.
57923. **Queue aging reports** — Report age distribution of queued items with SLA-risk banding.
57924. **Predictive breach warnings** — Predict likely breaches from queue velocity and alert before they happen.
57925. **Capacity planning from SLA data** — Use SLA performance data to model required reviewer headcount.
57926. **Reviewer staffing models** — Build staffing models linking finding volume forecasts to SLA-feasible reviewer counts.
57927. **On-call SLA** — Define response and resolution targets for on-call reviewers handling critical findings.
57928. **Fast-lane SLA** — Define compressed SLAs for the emergency review fast-lane.
57929. **Bulk-triage SLA** — Define throughput-based SLAs for bulk low-severity triage batches.
57930. **External reviewer SLA** — Contract turnaround expectations with external reviewers in the review pool.
57931. **Client reviewer SLA** — Set expectations for client-side reviewer response times in collaborative reviews.
57932. **SLA definitions glossary** — Publish precise definitions of every SLA: start, stop, pause, and breach conditions.
57933. **SLA versioning** — Version SLA policies and record which version governed each measurement period.
57934. **Client-specific SLA profiles** — Maintain per-client SLA profiles reflecting contractual commitments.
57935. **Platform SLA alignment** — Align internal SLAs with bounty-platform response expectations.
57936. **SLA reporting to clients** — Include SLA performance summaries in client-facing quality reports.
57937. **SLA credits and penalties tracking** — Track contractual credits or penalties tied to SLA performance.
57938. **SLA exemption log** — Log approved SLA exemptions with reasons for audit transparency.
57939. **SLA review cadence** — Review and recalibrate SLA targets on a fixed cadence using historical performance.
57940. **SLA improvement targets** — Set quarterly targets for improving SLA compliance where it lags.
57941. **SLA-versus-quality tradeoff guardrails** — Define guardrails preventing SLA pressure from degrading review thoroughness.
57942. **SLA gaming prevention** — Detect and prevent gaming such as premature closure or reassignment churn to beat the clock.
57943. **SLA measurement integrity audit** — Audit SLA measurements themselves for accuracy and manipulation.
57944. **SLA change communication** — Announce SLA changes with rationale, effective dates, and transition handling.
57945. **SLA training for reviewers** — Train reviewers on SLA policies, pause rules, and escalation paths.
57946. **SLA in client contracts** — Reflect agreed QA SLAs explicitly in client contracts and statements of work.
57947. **SLA exception approvals** — Require documented approval for SLA exceptions with expiry dates.
57948. **SLA trend analysis** — Analyze SLA compliance trends to distinguish seasonal effects from structural problems.
57949. **SLA leaderboard input** — Feed SLA adherence into QA leaderboards to recognize reliably responsive reviewers.
57950. **Reviewer accuracy ranking** — Rank reviewers by the precision of findings they approve, validated against audits.
57951. **Top defect catchers** — Recognize reviewers who catch the most substantive defects per review hour.
57952. **Fastest quality reviews** — Rank reviewers on a composite of speed and accuracy so haste alone never wins.
57953. **Severity calibration champions** — Highlight reviewers with the smallest severity calibration error over the quarter.
57954. **Evidence completeness champions** — Recognize reviewers who most consistently enforce evidence standards.
57955. **Reproducibility verifiers ranking** — Rank reviewers by thoroughness and accuracy of reproducibility verification.
57956. **Screenshot quality reviewers** — Recognize reviewers excelling in the visual-evidence QA lane.
57957. **Tone and polish editors ranking** — Recognize reviewers whose language edits most improve report quality scores.
57958. **Audit performance ranking** — Rank auditors by calibration, defect detection, and report quality.
57959. **Feedback quality contributors** — Recognize reviewers whose corrections are most actionable for engine teams.
57960. **Most improved reviewer** — Celebrate the reviewer with the largest quality-score improvement each period.
57961. **Reviewer streaks** — Track consecutive defect-free review streaks as a positive motivator.
57962. **Engine quality scores** — Publish composite quality scores per detection engine updated continuously.
57963. **Most improved engine** — Recognize the engine with the largest quality improvement each quarter.
57964. **Engine precision leaders** — Rank engines by precision on the rolling evaluation window.
57965. **Engine recall leaders** — Rank engines by recall against golden targets and audit findings.
57966. **Lowest escape-rate engine** — Recognize engines whose findings least often produce post-release defects.
57967. **Best report-writing engine** — Rank report-generation components by report quality scores.
57968. **QA gate pass-rate by engine** — Show first-pass gate success rates per engine as a quality signal.
57969. **Audit team leaderboard** — Rank audit squads by calibration and defect-detection effectiveness.
57970. **Calibration participation ranking** — Recognize consistent participation in calibration sessions and workshops.
57971. **Feedback loop contributors** — Recognize engine owners who most effectively act on reviewer feedback.
57972. **Improvement suggestion leaders** — Track whose improvement suggestions get adopted and deliver measured impact.
57973. **Postmortem contributors** — Recognize valuable participation in postmortems and follow-through on actions.
57974. **Mentoring leaders** — Recognize senior reviewers who develop junior reviewers effectively.
57975. **Onboarding buddy scores** — Score onboarding buddies on their trainees' ramp-up quality and speed.
57976. **Review throughput leaders** — Recognize high throughput only when paired with above-bar accuracy.
57977. **SLA adherence ranking** — Rank reviewers and lanes by SLA compliance.
57978. **Client satisfaction by reviewer** — Attribute client satisfaction signals to reviewing teams where data allows.
57979. **Platform acceptance by engine** — Rank engines by bounty-platform acceptance rates of their findings.
57980. **Duplicate-detection leaders** — Recognize reviewers and components with the best duplicate-detection precision.
57981. **Language-lane leaders** — Recognize top performers in the language and tone review lane.
57982. **Leaderboard fairness normalization** — Normalize rankings by volume, difficulty, and class mix so comparisons are fair.
57983. **Division leaderboards by specialty** — Run separate leaderboards per specialty (web, API, mobile, cloud) for relevant comparison.
57984. **Rookie leaderboard (qa)** — Maintain a separate board for reviewers in their first two quarters.
57985. **Veteran leaderboard** — Maintain a board recognizing sustained excellence over long tenures.
57986. **Team leaderboards (qa)** — Rank review teams and squads on aggregate quality metrics.
57987. **Weekly, monthly, and quarterly boards** — Publish boards at multiple cadences to reward both sprints and consistency.
57988. **All-time hall of fame (qa)** — Maintain a hall of fame for exceptional long-term quality contributions.
57989. **Leaderboard recency weighting** — Weight recent performance more heavily so boards reflect current form.
57990. **Anti-gaming safeguards (qa)** — Design scoring to resist gaming, such as cherry-picking easy findings.
57991. **Transparent scoring formulas** — Publish the exact formulas behind every leaderboard for trust.
57992. **Leaderboard opt-out (qa)** — Allow individuals to opt out of public boards while remaining in private analytics.
57993. **Private versus public boards** — Keep sensitive rankings private to leads while celebrating appropriate wins publicly.
57994. **Rewards integration** — Tie leaderboard performance to recognition, bonuses, or career progression transparently.
57995. **Badge system (qa)** — Award badges for quality milestones (e.g., 100 calibrated reviews, zero-escape quarter).
57996. **Quality champion spotlight** — Feature top quality contributors in internal communications with their practices shared.
57997. **Leaderboard API (qa)** — Expose leaderboard data via API for dashboards and integrations.
57998. **Leaderboard dashboard widgets** — Provide embeddable widgets showing live leaderboard standings.
57999. **Leaderboard-driven coaching triggers** — Trigger coaching conversations automatically when rankings drop significantly.
58000. **New-metric proposals** — Accept proposals for new leaderboard metrics with a defined evaluation process.
58001. **Leaderboard retrospectives** — Review leaderboard effects periodically to ensure they motivate quality, not perverse incentives.
58002. **Seasonal quality competitions** — Run time-boxed competitions (e.g., lowest escape rate quarter) with clear rules.
58003. **Cross-functional quality cup** — Run a friendly competition across review, engineering, and audit functions on shared quality goals.
58004. **Leaderboard data retention policy** — Define how long leaderboard history is kept and when old boards are archived.
