# Part 05 — Hunt memory & context (44005–45004)
44005. **Append-only hunt event log** — Every agent action, observation, and decision is written to an immutable append-only event stream with monotonic sequence numbers.
44006. **Causal decision graph** — Each decision node links to the observations that caused it and the actions it spawned, forming a navigable cause-effect graph per hunt.
44007. **What-was-tried ledger** — A deduplicated record of every endpoint-plus-technique combination attempted, so resumed hunts never re-probe the same surface.
44008. **Decision rationale snapshots** — At each strategy fork the agent records the options considered, their scores, and the winner, preserving the reasoning behind the hunt.
44009. **Counterfactual branch log** — Rejected strategies are recorded with their rejection reasons, enabling later review of missed opportunities.
44010. **Belief-state timeline** — Captures what the agent believed about the target, including stack guesses and scope confidence, at each decision point.
44011. **Action provenance tags** — Every request carries the identifier of the decision that ordered it, making any probe traceable to its strategic origin.
44012. **Interrupt-safe event writes** — Events flush to disk in write-ahead fashion so a crash mid-hunt never loses the latest reasoning steps.
44013. **Checksum-chained event log** — Each event embeds a hash of its predecessor, making tampering or corruption of hunt history detectable.
44014. **Delta checkpointing** — Periodic checkpoints store only the state delta since the previous checkpoint, keeping resume points cheap for long hunts.
44015. **Resume-diff preview** — Before resuming, the agent shows what changed since the pause point, including target responses, memory updates, and elapsed time.
44016. **Hunt hibernation tiers** — Paused hunts cascade from hot memory to warm disk to cold archive based on age and resume likelihood.
44017. **Planned-versus-executed diff** — Compares the strategy intended at hunt start with what actually happened, highlighting where the agent adapted.
44018. **Decision rollback points** — Named save points in the event stream allow rewinding the strategy to a known-good state after a bad branch.
44019. **Event-log compaction** — Repeated identical observations collapse into a single entry with a repeat count, keeping long timelines readable.
44020. **Timeline scrubber interface** — A scrubbable timeline lets reviewers replay the hunt's decision flow at any granularity.
44021. **Slow-motion replay mode** — Replays key decision moments with full surrounding context so researchers can audit why a strategy was chosen.
44022. **State-hash verification** — The hunt state hash is recorded at each checkpoint, catching corruption before a faulty resume proceeds.
44023. **Queue-order persistence** — The exact pending-test queue order serializes with each checkpoint so a resume continues mid-queue.
44024. **Mid-hunt annotation anchors** — Researcher notes attach to specific event identifiers and survive compaction and export.
44025. **Evidence-to-event linking** — Every stored request and response pair links to the decision event that requested it.
44026. **Observation deduplication** — Identical tool outputs merge into one event with a repeat counter instead of flooding the log.
44027. **Strategy-fork markers** — Explicit markers record when the agent pivots strategy, citing the trigger observation.
44028. **Stall detection from event gaps** — Long gaps between decision events trigger a watchdog that nudges or escalates the hunt.
44029. **Event-schema versioning** — The event log format is versioned so old hunt logs remain readable after agent upgrades.
44030. **Cross-session event correlation** — Events from browser, API, and model layers carry a shared trace identifier for unified analysis.
44031. **Privacy-scoped event filtering** — Sensitive fields such as credentials and tokens are redacted in the event log per the engagement policy.
44032. **Export-safe event serialization** — The event log serializes to a self-describing format that replays identically on another device.
44033. **Live event streaming API** — External dashboards subscribe to the hunt's event stream in real time over a websocket.
44034. **Event-driven hunt webhooks** — Key events such as finding confirmation, strategy pivot, or hunt stall fire webhooks to integrations.
44035. **Attempt fingerprinting** — Each attempt hashes endpoint, technique, payload family, and parameters so identical attempts dedupe across restarts.
44036. **Negative-result ledger** — Failed attempts are first-class records with failure evidence, preventing repetition and training better priors.
44037. **Partial-evidence staging** — Inconclusive observations are staged as pending events that later evidence can confirm or refute.
44038. **Hypothesis registry** — The agent registers explicit hypotheses about the target and tracks their confirmation or refutation.
44039. **Hypothesis confidence tracking** — Each hypothesis carries a running confidence score updated by every relevant observation.
44040. **Milestone event markers** — Recon complete, first finding, deep-dive start, and report drafted are marked as milestones for quick navigation.
44041. **Hunt-phase segmentation** — The event stream segments into labeled phases with per-phase statistics on effort and yield.
44042. **Per-phase token accounting** — Token spend is tracked per phase, revealing which strategies are context-hungry.
44043. **Request-budget ledger** — Request quota consumption is logged against the plan, flagging overruns before they bite.
44044. **Time-box enforcement events** — When a phase exceeds its time box, a decision event records whether to extend, pivot, or abort.
44045. **Scope-drift detector (memory)** — Events referencing out-of-scope hosts trigger an immediate scope-check event and halt further probing.
44046. **Scope-decision trail** — Every scope boundary judgment is logged with the rule applied, supporting compliance review.
44047. **Authorization checkpoint events** — Privileged actions log their authorization basis before executing.
44048. **Rate-limit encounter log** — Every throttle signal is logged with the backoff applied, building per-target etiquette records.
44049. **Block-and-ban event records** — Captchas, IP blocks, and WAF bans are logged with the recovery actions taken.
44050. **Human-intervention markers** — Every researcher override, pause, or redirect is marked with the before and after state.
44051. **Override-reason capture** — Human overrides require a one-line reason that becomes a permanent searchable event.
44052. **Autonomous-versus-assisted ratio** — The log computes what fraction of decisions were autonomous versus human-guided per hunt.
44053. **Decision latency histogram** — Time between observation and decision is logged, exposing slow reasoning loops.
44054. **Tool-call ledger** — Every tool invocation is logged with arguments, duration, and outcome, separate from the reasoning stream.
44055. **Tool-failure taxonomy** — Failed tool calls are classified by cause to guide retry policy and tooling fixes.
44056. **Retry-decision records** — Each retry logs its reason, the changed parameter, and whether it succeeded.
44057. **Model-call attribution** — Every model call logs which decision it served, enabling per-decision cost analysis.
44058. **Prompt-version pinning** — The exact prompt template version used for each decision is recorded for reproducibility.
44059. **Sampling-parameter logging** — Temperature and seed values are logged per decision so runs can be reproduced or debugged.
44060. **Hallucination-flag events** — When the agent catches its own unsupported claim, a correction event is logged with the evidence.
44061. **Self-correction chains** — Sequences of claim, doubt, and verification are linked as first-class learning episodes.
44062. **Dead-end registry** — Exhausted attack paths close with a summary of what was tried and why they died.
44063. **Loop-detection events** — When the agent revisits the same state three times, a loop event fires and forces a strategy change.
44064. **Novelty scoring per event** — Each event is scored on how much new information it added, highlighting productive moments.
44065. **Redundant-work detector** — Scans the event log for repeated equivalent attempts and suggests consolidating them.
44066. **Hunt fingerprint** — A compact hash of the hunt's decision sequence enables comparing strategies across similar hunts.
44067. **Strategy-signature extraction** — The decision trail compresses into a reusable strategy signature for similar targets.
44068. **Replay-to-verify** — A completed hunt's event log can replay against fresh target state to validate reproducibility.
44069. **Deterministic replay mode (memory)** — Replays use recorded seeds and observations to reproduce a hunt's exact decision path for debugging.
44070. **Event-log export formats** — Hunt episodes export to JSONL, SQLite, and narrative PDF with a single command.
44071. **Episode-naming convention** — Each hunt episode gets a human-readable codename plus a unique identifier for easy reference.
44072. **Multi-episode hunt linking** — Multi-day engagements link their episodes into one chain with shared context.
44073. **Episode diffing** — Two episodes on the same target diff to show what changed in strategy and coverage.
44074. **Coverage-attribution events** — Each tested endpoint links to the decision that prioritized it, explaining coverage choices.
44075. **Coverage-gap explanations** — Untested endpoints get a logged reason instead of silent omission.
44076. **Priority-queue rationale** — The test queue ordering is logged with the scoring that produced it.
44077. **Dynamic reprioritization log** — Every queue reorder logs the new signal that triggered it.
44078. **Parallel-branch tracking** — Concurrent probe threads are tracked as branches that merge back into the main timeline.
44079. **Branch-merge conflict log** — When parallel branches disagree, the resolution is logged as a decision event.
44080. **External-signal ingestion events** — Threat intel or researcher tips arriving mid-hunt are logged as first-class events.
44081. **Mid-hunt goal-change records** — If the objective changes, the old goal, new goal, and trigger are all recorded.
44082. **Stakeholder-question events** — Questions asked mid-hunt are logged with the agent's answer and its confidence.
44083. **Chat-to-decision linkage** — Mid-hunt chat answers that changed strategy link to the resulting decision events.
44084. **Finding-lifecycle events (memory)** — Each finding's journey from suspicion to confirmation to report is tracked as linked events.
44085. **Evidence-preservation events** — Captures are hashed and timestamped at collection, creating a chain of custody.
44086. **Finding-confidence evolution** — Finding confidence is re-logged as new evidence arrives.
44087. **False-positive postmortems** — Confirmed false positives get a root-cause event explaining which signal misled the agent.
44088. **Missed-finding reviews** — Late-discovered findings get a review event analyzing why they were not found earlier.
44089. **Hunt-completeness attestation** — At completion the agent logs an attestation of what was and was not covered.
44090. **Sign-off event chain** — Researcher sign-off links to the completeness attestation for audit purposes.
44091. **Post-hunt debrief generator** — The event log auto-summarizes into a debrief of key decisions, surprises, and lessons.
44092. **Lesson-promotion proposals** — Debrief items can be promoted to semantic knowledge with one click, linking back to the episode.
44093. **Episode-embedding index** — Each hunt episode is embedded for similarity search across the episode archive.
44094. **Similar-episode retrieval** — Starting a hunt surfaces the most similar past episodes with their outcomes.
44095. **Episode-based strategy seeding** — The new hunt's initial plan is seeded from the winning strategy of the most similar episode.
44096. **Resume tokens** — A paused hunt produces a shareable resume token that restores exact state on another device.
44097. **Crash-recovery autopilot** — After a crash the agent reconstructs working state from the event log without human help.
44098. **Corruption quarantine** — If the event log fails checksum validation, the hunt forks into a quarantine branch preserving good events.
44099. **Event-retention policy** — Episodes age through retention tiers with configurable deletion schedules per engagement.
44100. **Legal-hold on episodes** — Flagged episodes are exempted from retention deletion with an immutable hold marker.
44101. **Episode access audit** — Every read or export of a hunt episode is logged for compliance.
44102. **Anonymized episode sharing** — Episodes can be scrubbed of target identifiers for community strategy sharing.
44103. **Episode quality scoring** — Completed episodes are scored on coverage, efficiency, and finding yield for strategy ranking.
44104. **Golden-episode library** — Top-scoring episodes are curated as reference hunts for training and strategy design.
44105. **Vuln-class knowledge cards** — Structured cards per vulnerability class with description, typical severity range, common sinks, and detection heuristics.
44106. **Class-relationship graph** — Vulnerability classes link to related classes in a navigable knowledge graph that informs chained testing.
44107. **Framework quirk library** — Per-framework behavioral quirks, such as parameter-parsing edge cases, stored as testable rules with version bounds.
44108. **Version-behavior matrix** — For each technology, a matrix of versions versus known behaviors, default configurations, and patched flaws.
44109. **Default-credential knowledge** — Per-product default credentials and their change history stored as facts with last-verified dates.
44110. **WAF fingerprint catalog** — WAF and CDN identification signatures with version-specific blocking behaviors maintained as reference data.
44111. **Server-banner decoder** — Maps Server and X-Powered-By banners to product, version, and known quirks via a maintained lookup.
44112. **Error-message signature library** — Distinctive error strings mapped to technologies and versions for stack fingerprinting support.
44113. **Auth-scheme profiles** — Per-scheme structural knowledge covering token formats, common misconfigurations, and validation rules.
44114. **Session-mechanism catalog** — How frameworks generate, store, and expire sessions, including known weaknesses per version.
44115. **Cryptography defaults table** — Per-library default algorithms, key sizes, and padding modes with their current security status.
44116. **API-framework conventions** — REST, GraphQL, and gRPC conventions per framework informing where parameters and auth material live.
44117. **CMS plugin vulnerability map** — CMS platforms linked to their plugin ecosystems and historically vulnerable components.
44118. **Cloud-service behavior profiles** — How object storage services handle ACLs, versioning, and signed URLs by default.
44119. **Header-semantics reference** — What security headers mean per browser and server, and how misconfigurations manifest in practice.
44120. **Encoding-and-parsing quirks** — Per-language URL, HTML, and JSON parsing edge cases that affect injection test design.
44121. **Database-error dialect map** — SQL and NoSQL error messages mapped to engine and version for blind-inference support.
44122. **Deserialization sink knowledge** — Per-language deserialization sinks and gadget chains with affected version ranges.
44123. **Template-engine catalog** — Template engines with their syntax, sandboxing behavior, and version-specific escape notes.
44124. **SSRF-allowlist bypass knowledge** — Per-cloud metadata endpoints, redirect behaviors, and parser differentials stored as facts.
44125. **DNS-and-TLS behavior notes** — Per-provider DNS wildcard, certificate authority, and issuance behaviors captured as reference facts.
44126. **Mobile-backend conventions** — How mobile APIs differ in token handling, certificate pinning, and versioning, captured as platform notes.
44127. **IoT-firmware patterns** — Common firmware web interfaces, default services, and update mechanisms organized by vendor.
44128. **ICS-gateway exposure notes** — Industrial protocol gateways and their typical web exposures stored as reference facts.
44129. **Knowledge-entry schema** — Every knowledge entry follows a versioned schema of claim, evidence, confidence, provenance, and last-verified date.
44130. **Provenance tracking per fact** — Each fact records its source, whether a hunt episode, advisory feed, or researcher, with a direct link.
44131. **Confidence scoring for facts** — Facts carry calibrated confidence scores updated by confirming or contradicting evidence.
44132. **Multi-source corroboration** — A fact's confidence rises when independent sources agree, tracked explicitly per source.
44133. **Contradiction flagging** — When two facts conflict, both are flagged and routed for resolution instead of silently coexisting.
44134. **Fact deprecation workflow** — Outdated facts move through proposed, approved, and deprecated states with recorded reasons.
44135. **Expiry dates on volatile facts** — Facts about SaaS defaults or cloud behaviors carry explicit review-by dates.
44136. **Knowledge edit proposals** — Researchers propose knowledge changes that pass review before becoming canonical.
44137. **Reviewer assignment for knowledge** — Edits route to domain experts based on the fact's tags.
44138. **Knowledge change-log** — Every knowledge mutation is logged with author, diff, and rationale, like a wiki history.
44139. **Rollback for bad edits** — Any knowledge change can be reverted to a prior version with one action.
44140. **Knowledge branching for experiments** — Experimental knowledge lives on a branch until validated, then merges to the main line.
44141. **Staging knowledge environment** — New facts are tested against historical hunts in staging before promotion.
44142. **Fact validation harness** — Each testable fact ships with an associated check that runs against new data.
44143. **CVE-feed ingestion** — CVE entries auto-convert into draft knowledge facts mapped to affected products and versions.
44144. **Vendor advisory ingestion (memory)** — Vendor security advisories are parsed into version-behavior updates.
44145. **Release-note mining** — Framework release notes are scanned for security-relevant behavior changes.
44146. **Changelog-driven quirk updates** — When a framework patches a quirk, the knowledge base records old and new behavior with version boundaries.
44147. **Community knowledge contributions** — Vetted external contributors can submit facts with evidence requirements.
44148. **Contribution quality scoring** — Contributors earn reputation based on how often their facts verify in practice.
44149. **Duplicate-fact detection** — New submissions are checked against existing facts to prevent knowledge bloat.
44150. **Semantic knowledge search** — Facts are retrievable by meaning, not just keywords, during hunt planning.
44151. **Fact-to-episode linking** — Knowledge facts link to the hunt episodes that confirmed them.
44152. **Episode-to-fact backlinks** — Hunt episodes show which knowledge facts they validated or contradicted.
44153. **Knowledge freshness dashboard** — Shows what fraction of facts were verified in the trailing ninety days.
44154. **Stale-fact re-verification queue** — Facts past their review date queue for re-confirmation against new hunts.
44155. **Technology radar** — Emerging frameworks and versions are tracked as watch entries before they earn full profiles.
44156. **End-of-life technology archive** — End-of-life products keep their entries marked archival for legacy-target hunts.
44157. **Regional tech variations** — Region-specific deployment notes layer onto base facts for localized services.
44158. **Knowledge API for agents** — The hunting agent queries the knowledge base through a structured API with relevance-ranked results.
44159. **Knowledge query audit log** — Every agent knowledge lookup is logged, revealing which knowledge actually drives hunts.
44160. **Fact usage analytics** — Facts track how often they were retrieved and whether they led to findings.
44161. **Low-value fact pruning** — Facts never retrieved or never useful become candidates for archival.
44162. **High-impact fact highlighting** — Facts correlated with confirmed findings surface first in retrieval.
44163. **Knowledge embeddings index** — All facts are embedded for similarity search across the knowledge graph.
44164. **Cross-fact inference** — The knowledge base suggests related facts during retrieval based on graph edges.
44165. **Knowledge namespaces** — Separate namespaces for web, mobile, cloud, and ICS knowledge with cross-links.
44166. **Private knowledge overlays** — Researchers keep private notes layered over shared facts without modifying them.
44167. **Client-specific knowledge partitions** — Per-client knowledge stays isolated according to engagement contracts.
44168. **Knowledge encryption at rest** — Sensitive facts are encrypted with per-partition keys.
44169. **Offline knowledge snapshot** — A portable snapshot of the knowledge base works without network for air-gapped hunts.
44170. **Delta knowledge sync** — Devices sync only changed facts, keeping multi-device knowledge bases consistent cheaply.
44171. **Knowledge conflict resolution** — Concurrent edits to the same fact merge with a field-level conflict interface.
44172. **Knowledge schema migrations** — Schema upgrades migrate all facts with validation and rollback support.
44173. **Knowledge backup and restore** — Full snapshots with point-in-time restore capability.
44174. **External-source knowledge import** — Imports from public taxonomies with configurable field mapping.
44175. **CWE mapping per fact** — Every vulnerability-class fact links to its CWE identifiers.
44176. **OWASP-category tagging** — Facts tagged to OWASP Top 10 and API Top 10 categories for coverage planning.
44177. **Compliance-control mapping** — Facts link to the compliance controls they inform.
44178. **Mitigation knowledge** — Each vulnerability-class card includes canonical remediation guidance for reports.
44179. **Detection-rule generation** — Knowledge facts can generate scanner detection rules automatically.
44180. **Rule-to-fact traceability** — Generated rules link back to the facts they came from.
44181. **Knowledge-driven hunt planning** — The planner pulls relevant facts to build a target-specific test plan.
44182. **Fact-based payload selection** — Payload families are chosen based on knowledge facts about the detected stack.
44183. **Counter-indication facts** — The knowledge base records when a technique is known not to work on a stack, preventing wasted probes.
44184. **Cost-of-test annotations** — Facts note the relative request and time cost of testing for that class.
44185. **Risk-of-disruption flags** — Facts flag tests that could disrupt production, gating them behind approval.
44186. **Safe-mode test variants** — For risky facts, the knowledge base stores low-impact verification alternatives.
44187. **Knowledge for report writing** — Report templates pull definitions and remediation text from knowledge facts.
44188. **Glossary generation** — The knowledge base auto-generates a client-facing glossary from facts used in a hunt.
44189. **Fact citation in reports** — Reports cite the knowledge facts behind each finding's classification.
44190. **Knowledge completeness scoring** — Per-technology coverage scores show where knowledge is thin.
44191. **Knowledge-gap-driven research** — Gaps trigger research tasks to fill missing framework profiles.
44192. **Fact lifecycle states** — Draft, review, canonical, deprecated, and archived states with clear transitions.
44193. **Canonical-fact locking** — High-stakes facts require multiple reviewers to change.
44194. **Automated fact-checking** — Periodic jobs re-verify testable facts against live reference targets.
44195. **Reference-target registry** — A set of known-vulnerable lab targets used to validate knowledge facts.
44196. **Fact decay modeling** — Confidence decays over time without re-verification, modeled per fact type.
44197. **Knowledge health score** — A composite of freshness, coverage, contradiction rate, and usage.
44198. **Knowledge diff between versions** — Releases of the knowledge base diff cleanly so teams see what changed.
44199. **Knowledge release notes** — Human-readable notes accompany each knowledge base version.
44200. **Knowledge rollback to version** — The whole knowledge base can revert to a prior versioned snapshot.
44201. **Knowledge as versioned package** — The knowledge base ships as a versioned artifact installable into any agent deployment.
44202. **Vulnerability-class severity priors** — Each class card stores the historical severity distribution to seed risk scoring.
44203. **Exploit-maturity annotations** — Facts note whether public exploit code exists, informing prioritization without hosting it.
44204. **Knowledge stewardship rotation** — Domain ownership of knowledge areas rotates on a schedule to prevent stale fiefdoms.
44205. **Target dossier document** — A living profile per target aggregating identity, scope, stack, history, and notes in one place.
44206. **Dossier confidence scoring** — Each profile field carries confidence based on evidence count and recency.
44207. **Stack fingerprint history** — The detected technology stack per hunt, versioned over time inside the dossier.
44208. **Stack-drift alerts** — When a new hunt detects a different stack than the dossier records, the agent flags the drift.
44209. **Scope boundary records** — The exact in-scope and out-of-scope rules per engagement stored with the profile.
44210. **Scope-change log** — Every scope expansion or reduction is logged with the authorizer and date.
44211. **Engagement history timeline** — All hunts, retests, and reports on the target in chronological order.
44212. **Retest calendar** — Scheduled and completed retests with their scope and outcomes tracked per target.
44213. **Past-finding rollup** — All historical findings on the target summarized by class and status in the dossier.
44214. **Finding recurrence tracking** — Findings that reappear across hunts are linked into recurrence chains.
44215. **Fix-verification history** — Every fix check with before and after evidence linked to the original finding.
44216. **Target-specific researcher notes** — Free-form notes attached to the target, searchable and versioned.
44217. **Note templates per target type** — Web app, API, and mobile backend templates structure target notes consistently.
44218. **Sensitivity classification** — Targets tagged by data sensitivity driving caution levels for testing intensity.
44219. **Production-versus-staging mapping** — Which hosts are production versus staging, with different test-intensity policies.
44220. **Maintenance-window records** — Known deploy and maintenance windows when testing should pause or stay gentle.
44221. **Contact and escalation info** — Engagement contacts stored with the profile for block or incident escalation.
44222. **Auth profile per target** — How authentication works on this target, covering schemes, token lifetimes, and test accounts.
44223. **Test-account registry** — Test account credentials stored securely and linked to the target profile.
44224. **Credential rotation log** — Records when test credentials were last rotated, with expiry reminders.
44225. **IP allowlist records** — Which source IPs are allowlisted for testing, with expiry dates.
44226. **Rate-limit profile** — Learned rate limits per endpoint family, persisted across hunts.
44227. **WAF profile per target** — The WAF's observed behavior, block triggers, and cool-down periods.
44228. **Block-history log** — Every block or ban on the target with the cause and the recovery steps that worked.
44229. **Preferred testing windows** — Agreed quiet hours for aggressive testing stored in the profile.
44230. **Traffic budget per target** — Maximum requests per day or week agreed with the client, enforced by the agent.
44231. **Infrastructure lineage** — Hosting, CDN, and DNS providers with their change history per target.
44232. **Certificate history** — TLS certificate issuers, fingerprints, and rotation dates tracked per target.
44233. **Subdomain inventory** — All known subdomains with first-seen dates and discovery methods.
44234. **Asset-ownership mapping** — Which team owns which asset, for routing findings and questions.
44235. **Third-party dependency list** — Vendors and scripts the target relies on, with their own risk notes.
44236. **Shared-component flagging** — Components shared with other targets linked across dossiers.
44237. **Target-family classification** — Targets grouped into families for strategy transfer between similar systems.
44238. **Family-template profiles** — New targets inherit a starter profile from their family with family-level notes.
44239. **Lookalike-target suggestions** — The dossier suggests similar past targets for strategy seeding.
44240. **Dossier freshness score** — How up-to-date the profile is, decaying since the last hunt.
44241. **Stale-dossier revalidation** — Profiles older than a threshold trigger a light re-fingerprint before deep testing.
44242. **Profile merge on rebrand** — When a target rebrands or migrates domains, dossiers merge with lineage preserved.
44243. **Domain-alias registry** — All known aliases, redirects, and parked domains linked to one dossier.
44244. **Acquisition-history notes** — When targets merge or get acquired, dossiers link with ownership changes recorded.
44245. **Dossier access controls** — Per-engagement permissions control who can view or edit a target's profile.
44246. **Client-visible dossier view** — A sanitized profile view shareable with the client.
44247. **Dossier change audit** — Every profile edit logged with author and diff.
44248. **Profile-version snapshots** — The dossier snapshots before each hunt for before and after comparison.
44249. **Pre-hunt briefing generator** — The dossier auto-compiles into a briefing covering stack, past findings, watch-outs, and plan.
44250. **Briefing customization** — Researchers choose briefing depth per hunt, from quick to deep.
44251. **Post-hunt dossier update** — The agent proposes dossier updates after each hunt and the researcher approves them.
44252. **Auto-update rules** — Low-risk facts update automatically while sensitive ones require approval.
44253. **Dossier conflict queue** — When hunts disagree on a profile fact, it queues for human resolution.
44254. **Target-priority scoring** — Targets scored by risk, sensitivity, and finding history for scheduling.
44255. **Hunt-cadence recommendations (memory)** — The dossier suggests retest frequency based on change rate and risk.
44256. **Change-detection subscriptions** — Monitors the target's stack and certificates between hunts, alerting on drift.
44257. **Technology watch per target** — New advisories affecting the target's stack auto-attach to the dossier.
44258. **Threat-intel feed per target** — Relevant threat reports linked to the target's technologies.
44259. **Compliance-scope tags** — Which compliance regimes cover the target, shaping test requirements.
44260. **Data-residency notes** — Where the target's data lives, for jurisdictional testing constraints.
44261. **Pen-test history import** — Prior human pen-test reports imported into the dossier timeline.
44262. **Bug-bounty program linkage** — If the target has a public program, its scope and rules attach to the dossier.
44263. **Bounty-payout history** — Past bounty awards per finding class, informing prioritization.
44264. **Researcher-assignment history** — Who hunted this target before, with their notes and specialties.
44265. **Handoff notes between researchers** — Structured handoff covering what was tested, what is pending, and watch-outs.
44266. **Dossier templates by industry** — Fintech, healthtech, and government templates with industry-specific checklist items.
44267. **Custom fields per dossier** — Engagements define extra profile fields for their own workflow needs.
44268. **Dossier search across targets** — Find targets by stack, finding history, or note content.
44269. **Target-comparison view** — Side-by-side dossiers for portfolio-level analysis.
44270. **Portfolio-risk rollup** — Aggregate risk across all target dossiers in a single dashboard.
44271. **Dossier export** — Single-target export for client delivery or archival.
44272. **Dossier import** — Import a target profile from a partner's export with field mapping.
44273. **Dossier anonymization** — Scrub identifiers for sharing profiles as case studies.
44274. **Archived-target handling** — Decommissioned targets archive with full history retained.
44275. **Target reactivation** — Archived dossiers restore cleanly when the target returns to scope.
44276. **Duplicate-dossier detection** — Fuzzy matching catches the same target entered twice.
44277. **Dossier-merge tool** — Merge duplicate dossiers with field-level conflict resolution.
44278. **Dossier-split tool** — Split a dossier when one target turns out to be two distinct systems.
44279. **Dossier API** — Integrations read and update dossiers programmatically.
44280. **Dossier webhooks** — Changes to key fields such as stack or scope fire webhooks.
44281. **Dossier-linked hunt config** — New hunts inherit scope, budgets, and caution flags from the dossier automatically.
44282. **Caution-flag enforcement** — High-sensitivity targets automatically enable safe-mode testing.
44283. **Target-specific payload budgets** — Per-target limits on aggressive payload families.
44284. **Custom wordlists per target** — Target-derived wordlists from past hunts stored in the dossier.
44285. **Endpoint inventory per target** — All discovered endpoints with last-tested dates.
44286. **Endpoint-staleness tracking** — Endpoints untested for months flag for re-coverage.
44287. **Parameter inventory per target** — Known parameters with their historical behaviors.
44288. **Interesting-pattern notes** — Recurring near-miss patterns specific to this target documented once.
44289. **Known-weird registry** — Target-specific oddities documented once so future hunts calibrate immediately.
44290. **False-positive memory per target** — Target-specific false-positive patterns so the agent does not re-flag them.
44291. **Noise baseline per target** — The target's normal error and noise profile for anomaly calibration.
44292. **Business-logic notes** — How the target's workflows operate, informing logic testing.
44293. **User-role matrix** — Roles and their privileges on this target, mapped for authorization testing.
44294. **Test-data inventory** — What test data exists and how to create more.
44295. **Environment-parity notes** — How staging differs from production, guiding where findings transfer.
44296. **Deployment-pipeline notes** — How the target deploys, informing when retests are meaningful.
44297. **Incident-history log** — Past security incidents on the target with lessons recorded.
44298. **Dossier-completeness meter** — Shows which profile sections are filled versus missing.
44299. **Profile-quality scoring** — Dossiers scored on accuracy of verified facts versus assumptions.
44300. **Dossier-review cadence** — Periodic human review of high-value target profiles.
44301. **Target-profile changelog digest** — A periodic digest of profile changes across the portfolio.
44302. **Dossier-driven scheduling** — The scheduler prioritizes targets by risk score and staleness.
44303. **Multi-target campaign profiles** — Campaigns spanning targets share a campaign-level dossier.
44304. **Dossier-retention policy** — Profiles follow engagement retention rules with legal-hold support.
44305. **Technique-by-stack success matrix** — Success rates for each technique on each detected stack, updated after every hunt.
44306. **Payload-family effectiveness ranking** — Per-stack ranking of payload families by confirmed-finding yield.
44307. **Strategy Elo ratings** — Hunting strategies rated like chess players, rising or falling with hunt outcomes.
44308. **Bayesian prior updating** — Each hunt's results update priors for technique effectiveness via Bayesian inference.
44309. **Cold-start priors** — New stacks start with priors borrowed from the nearest known stack.
44310. **Confidence-interval display** — Success rates shown with confidence intervals so small samples are not overtrusted.
44311. **Sample-size gating** — Patterns only influence strategy after a minimum number of observations.
44312. **Negative-evidence tracking** — Failed attempts count as evidence, not just successes, in effectiveness models.
44313. **Diminishing-returns curves** — Per technique, the marginal finding rate over attempts, signaling when to stop.
44314. **Attempt-budget optimizer** — Allocates probe budgets across techniques using expected-yield models.
44315. **Strategy-attribution engine** — Each confirmed finding is attributed to the strategy decisions that led to it.
44316. **Multi-touch attribution** — Credit splits across recon, hypothesis, and probing steps, not just the final probe.
44317. **Strategy A/B testing** — Competing strategies run on similar targets and their yield is compared.
44318. **Canary strategy rollout (memory)** — New strategies first run on low-risk targets before general use.
44319. **Strategy-performance dashboard** — Win rates, yield, and cost per strategy across the fleet.
44320. **Technique-decay detection** — Alerts when a technique's success rate drops, suggesting patches or WAF updates.
44321. **Breakout-technique alerts** — Flags techniques whose success suddenly spikes on a stack.
44322. **Seasonal-pattern detection** — Finds time-based patterns in finding yield, such as post-deploy windows.
44323. **Target-similarity scoring** — Quantifies how similar two targets are for knowledge transfer purposes.
44324. **Transfer-confidence weighting** — Transferred patterns weight by similarity score rather than applying blindly.
44325. **Analog-target recommendations** — For a new target, surfaces the most analogous past targets with their outcomes.
44326. **Few-shot strategy adaptation (memory)** — Adapts a strategy from two or three analogous hunts instead of requiring large samples.
44327. **Meta-learning across stacks** — Learns which strategy features transfer across stacks versus which are stack-specific.
44328. **Cross-stack generalization score** — Measures how well a pattern holds across different stacks.
44329. **Stack-specific versus universal split** — Patterns classified as universal, stack-family, or stack-specific.
44330. **Finding-pattern embeddings** — Finding patterns embedded for similarity-based transfer between hunts.
44331. **Pattern-to-strategy compiler** — Converts observed patterns into executable strategy updates.
44332. **Human-in-the-loop pattern review** — Researchers approve high-impact pattern changes before they alter strategy.
44333. **Pattern changelog** — Every learned pattern change logged with the evidence behind it.
44334. **Pattern rollback** — Reverts a learned pattern to its prior state if it degrades performance.
44335. **Shadow-mode patterns** — New patterns run in shadow, scored but not acted on, until validated.
44336. **Counterfactual yield estimation** — Estimates what a different strategy would have found using logged hunt data.
44337. **Off-policy evaluation** — Evaluates strategies on historical hunt data without running new hunts.
44338. **Propensity-score correction** — Corrects for the bias that successful strategies get tried more often.
44339. **Survivorship-bias guards** — Ensures failed hunts, not just successful ones, feed the learning models.
44340. **Hunt-outcome labeling** — Hunts labeled by outcome quality for supervised learning.
44341. **Label-quality auditing** — Samples outcome labels for human verification.
44342. **Feature store for hunts** — Engineered features such as stack, size, and auth type stored for model training.
44343. **Feature-drift monitoring** — Alerts when hunt feature distributions shift, invalidating old patterns.
44344. **Model-retraining pipeline** — Effectiveness models retrain on a schedule with versioned outputs.
44345. **Model-performance tracking** — Tracks prediction accuracy of yield models over time.
44346. **Champion-challenger models** — New models compete against the production model on recent hunts.
44347. **Explainable pattern summaries** — Learned patterns render as human-readable rules with examples.
44348. **Pattern-evidence browser** — Clicking a pattern reveals the hunts and findings behind it.
44349. **Disagreement analysis** — Surfaces cases where the model predicted success but the hunt failed, for review.
44350. **Anomaly-driven reweighting** — Surprising outcomes get extra weight in model updates.
44351. **Recency-weighted learning** — Recent hunts weigh more than old ones, with a configurable half-life.
44352. **Forgetting in models** — Old data decays so models adapt to the current threat landscape.
44353. **Concept-drift alarms** — Alerts when the relationship between features and outcomes shifts.
44354. **Regime detection** — Identifies distinct eras with separate models, such as before and after a major framework release.
44355. **Per-researcher effectiveness** — Tracks which researchers' strategies yield most, used for coaching.
44356. **Team-benchmark sharing** — Anonymized benchmarks let teams compare strategy effectiveness.
44357. **Tactic-combination mining** — Finds technique combinations that outperform their individual parts.
44358. **Sequence-pattern mining** — Learns effective orderings of hunt phases from outcomes.
44359. **Timing-pattern learning** — Learns when during a hunt each technique pays off best.
44360. **Depth-versus-breadth optimizer** — Learns the optimal recon depth per target type from outcomes.
44361. **Probe-intensity tuning** — Learns how aggressive probing can be per target before blocks occur.
44362. **False-positive pattern learning** — Learns which technique and stack combinations produce false positives, auto-suppressing them.
44363. **False-positive feedback loop (memory)** — Researcher false-positive labels flow back into effectiveness models within hours.
44364. **Precision-recall balancing** — Models optimize for useful findings, not raw probe counts.
44365. **Cost-aware learning** — Effectiveness measured per token and request, favoring efficient strategies.
44366. **Latency-aware strategy choice** — Slow targets get strategies with fewer round trips, learned from timing data.
44367. **Flakiness-aware scheduling** — Flaky targets get retry patterns that historically succeed on retry.
44368. **Time-of-day effects** — Learns whether hunt timing affects outcomes for certain targets.
44369. **Day-of-week patterns** — Detects weekly patterns in target behavior that affect strategy.
44370. **Version-specific effectiveness** — Success rates tracked per framework version, not just family.
44371. **Patch-level sensitivity** — Detects when a minor version bump kills a technique.
44372. **Configuration-pattern learning** — Learns which misconfigurations cluster together on real targets.
44373. **Default-config exploitation rates** — Tracks how often default configurations are actually left in place.
44374. **Cloud-provider patterns** — Learns provider-specific misconfiguration frequencies.
44375. **CMS-ecosystem patterns** — Learns which CMS plugin categories yield most per unit effort.
44376. **API-versus-web models** — Separate effectiveness models for API targets versus web applications.
44377. **Mobile-backend patterns** — Dedicated effectiveness models for mobile API backends.
44378. **Auth-scheme effectiveness** — Which auth-testing techniques work per authentication scheme.
44379. **Business-logic pattern library** — Logic-flaw patterns with their preconditions and hit rates.
44380. **Chain-pattern mining** — Learns which finding pairs chain together most often.
44381. **Chain-yield scoring** — Strategies scored on chained impact, not just single findings.
44382. **Novelty bonus in scoring** — Strategies that find new vulnerability classes get extra credit.
44383. **Coverage-quality metric** — Measures whether probes covered the meaningful surface, not just URL counts.
44384. **Blind-spot detection** — Finds target areas systematically under-tested across hunts.
44385. **Under-testing alerts** — Flags target types where the fleet consistently under-invests effort.
44386. **Over-testing detection** — Flags where effort repeatedly yields nothing, suggesting strategy change.
44387. **Portfolio-learning rollup** — Organization-level view of what is being learned across all targets.
44388. **Effectiveness-improvement rate** — Tracks how fast strategy effectiveness improves per hundred hunts.
44389. **Cumulative-yield attribution** — Attributes cumulative finding-yield gains to specific learned patterns over time.
44390. **Experiment registry** — All strategy experiments logged with hypothesis and result.
44391. **Experiment templates** — Reusable experiment designs for common strategy questions.
44392. **Statistical-significance gating** — Experiments only conclude with sufficient statistical power.
44393. **Multi-armed bandit allocation** — Live hunts allocate effort across strategies via bandit algorithms.
44394. **Contextual bandits (memory)** — Bandit choices condition on target features.
44395. **Exploration budget (memory)** — A fixed fraction of probes reserved for trying unproven techniques.
44396. **Exploration-outcome tracking** — Exploration results feed back into the models explicitly.
44397. **Serendipity log** — Unexpected discoveries logged as learning events even when off-strategy.
44398. **Cross-team pattern sharing** — Patterns shared across teams with privacy controls.
44399. **Federated pattern learning** — Learns from hunts across deployments without moving raw data.
44400. **Differential privacy in sharing** — Shared patterns noised to protect target confidentiality.
44401. **Pattern marketplace** — Teams can publish and subscribe to strategy patterns.
44402. **Pattern-quality ratings** — Subscribers rate shared patterns, surfacing the best ones.
44403. **Deprecation of learned patterns** — Patterns that stop working are retired with notice.
44404. **Learning-audit trail** — Every model update traceable to the hunts that caused it.
44405. **Hunt-phase retrieval profiles** — Each hunt phase gets a tailored memory-retrieval profile defining what to load.
44406. **Context-budget allocator** — Divides the token budget across memory types per phase with hard caps.
44407. **Retrieval top-k tuning** — Per-query-type limits on how many memories load, tuned by precision and recall.
44408. **Relevance-scoring function** — Combines semantic similarity, recency, importance, and source trust into one score.
44409. **Recency-decay curves** — Configurable half-lives per memory type so old facts fade at the right rate.
44410. **Importance-signal registry** — Explicit importance markers boost retrieval for starred or finding-linked memories.
44411. **Source-trust weighting** — Memories from verified hunts outrank those from unreviewed notes.
44412. **Multi-stage retrieval** — Coarse candidate fetch followed by fine re-ranking for quality at scale.
44413. **Query expansion for memory** — Hunt queries expanded with synonyms and related techniques before retrieval.
44414. **Hypothetical-document retrieval** — Generates a hypothetical ideal memory, then retrieves the nearest real ones.
44415. **Retrieval-audit trail** — Every loaded memory logged with the query and score that selected it.
44416. **Memory citation in reasoning** — The agent cites which memories informed each decision.
44417. **Unused-memory detection** — Loaded but never-referenced memories flagged to tighten future retrieval.
44418. **Retrieval-precision metrics** — Measures whether loaded memories were actually used in decisions.
44419. **Lazy memory loading** — Deep details load only when the agent drills into a topic.
44420. **Prefetch for likely needs** — The agent preloads memories for the next planned phase during idle time.
44421. **Retrieval cache with TTL** — Recent retrievals cached to avoid repeat embedding costs.
44422. **Cache invalidation on update** — Edited memories invalidate cached retrievals immediately.
44423. **Token accounting per retrieval** — Every retrieval's token cost tracked against the hunt budget.
44424. **Retrieval-latency budget** — Maximum milliseconds per retrieval with graceful degradation beyond it.
44425. **Fallback retrieval tiers** — If semantic search fails, fall back to keyword search, then to recency lists.
44426. **Offline retrieval mode** — A local index serves retrievals without network access.
44427. **Retrieval for mid-hunt replanning** — Replans trigger a fresh retrieval scoped to the new direction.
44428. **Context-packing order** — Most decision-relevant memories placed where the model attends best.
44429. **Redundancy elimination** — Near-duplicate retrieved memories merged before loading into context.
44430. **Contradiction surfacing** — When retrieved memories disagree, both are shown with provenance.
44431. **Retrieval-diversity controls** — Ensures results are not all drawn from one hunt or one author.
44432. **Freshness-versus-authority balance** — A tunable tradeoff between recent and authoritative memories.
44433. **Personalized retrieval** — Retrieval weights adapt to the researcher's past usefulness ratings.
44434. **Retrieval-feedback loop** — Thumbs up and down on loaded memories tunes future ranking.
44435. **Negative-retrieval signals** — Memories marked unhelpful are down-weighted rather than merely ignored.
44436. **Retrieval for chat questions** — Mid-hunt chat queries retrieve with a conversational profile.
44437. **Retrieval for report writing** — The report phase retrieves with emphasis on facts needing citation.
44438. **Retrieval for retest planning** — Retest queries prioritize past findings and fix verifications.
44439. **Time-scoped retrieval** — Queries like what was known last quarter filter by memory timestamp.
44440. **Provenance-filtered retrieval** — Restricts loading to memories from verified hunts or trusted authors.
44441. **Client-scoped retrieval** — Only memories from the same client load for sensitive engagements.
44442. **Engagement-isolated retrieval** — Strict mode loads nothing from outside the current engagement.
44443. **Cross-engagement retrieval opt-in** — With approval, patterns from other engagements inform the hunt.
44444. **Retrieval-permission checks** — Every candidate memory checked against the requester's access rights before loading.
44445. **Redacted-memory retrieval** — Sensitive memories load in redacted form when clearance is partial.
44446. **Retrieval-explanation interface** — Researchers see why each memory was loaded for a decision.
44447. **Retrieval sandbox** — Tests retrieval profiles against historical hunts before deploying them.
44448. **A/B retrieval profiles** — Compares two ranking configurations on the same hunt replays.
44449. **Retrieval-quality sampling** — Humans rate retrieval relevance on sampled decisions.
44450. **Embedding-model versioning** — Memory embeddings versioned with re-indexing tracked.
44451. **Hybrid sparse-dense retrieval** — Keyword and vector search combined with learned weights.
44452. **Reranker-model selection** — Pluggable rerankers with benchmarked quality and latency.
44453. **Retrieval-index sharding** — Memory index sharded by tenant for scale and isolation.
44454. **Incremental indexing** — New memories indexed within seconds rather than in batch windows.
44455. **Index-health monitoring** — Tracks index size, latency, and recall degradation.
44456. **Retrieval circuit breaker** — Trips to cached or simplified retrieval when the index is unhealthy.
44457. **Memory-summarization index** — Long memories indexed by their summaries for fast coarse retrieval.
44458. **Hierarchical retrieval** — Summary to section to full detail, drilling down on demand.
44459. **Graph-based retrieval** — Traverses knowledge-graph edges outward from seed facts.
44460. **Temporal retrieval** — Answers what was believed about a topic at a past date from versioned memories.
44461. **Counterfactual retrieval** — Retrieves memories about what was tried and failed, not just successes.
44462. **Analogy retrieval** — Finds memories from analogous rather than identical situations.
44463. **Procedural-memory retrieval** — Retrieves how-to sequences, not just facts, for strategy execution.
44464. **Checklist retrieval** — Loads relevant testing checklists based on target features.
44465. **Playbook retrieval** — Full playbooks for the target family load at hunt start.
44466. **Playbook-version pinning** — Hunts pin the playbook version for reproducibility.
44467. **Just-in-time knowledge injection** — Facts injected at the exact decision point that needs them.
44468. **Proactive memory suggestions** — The agent surfaces relevant memories before being asked.
44469. **Memory digest at hunt start** — A one-page brief of loaded memories for researcher review.
44470. **Digest customization** — Researchers choose digest length and emphasis.
44471. **Memory-load warnings** — Alerts when a hunt loads unusually much or unusually little memory.
44472. **Retrieval-budget exhaustion handling** — Graceful degradation when the budget runs out mid-hunt.
44473. **Priority-based shedding** — Under budget pressure, lowest-value memories shed first.
44474. **Memory compression for context** — Long memories compressed to fit without losing key facts.
44475. **Lossy-versus-lossless choice** — Critical memories load in full while background ones load compressed.
44476. **Streaming retrieval** — Memories stream in as the agent reasons rather than all loading upfront.
44477. **Parallel retrieval channels** — Facts, episodes, and knowledge queried concurrently.
44478. **Retrieval-result merging** — Parallel results merged with cross-source deduplication.
44479. **Confidence-calibrated loading** — Low-confidence memories flagged inline so the agent treats them cautiously.
44480. **Uncertainty propagation** — Memory uncertainty flows into decision confidence scores.
44481. **Retrieval for anomaly triage** — Unexpected observations trigger retrieval of similar past anomalies.
44482. **Retrieval for false-positive adjudication** — Suspected false positives trigger retrieval of past false-positive patterns.
44483. **Memory-gap-triggered retrieval** — When no relevant memory exists, the agent records the gap for later filling.
44484. **Retrieval-driven question asking** — Knowledge gaps prompt the agent to ask the researcher or run a probe.
44485. **Session-scoped memory** — Per-hunt-session scratch memories that do not pollute the long-term store.
44486. **Structured scratchpad** — The agent's scratchpad uses typed fields for hypotheses, todos, and blockers.
44487. **Scratchpad persistence** — The scratchpad survives pauses and crashes.
44488. **Scratchpad-to-memory promotion** — Useful scratchpad items promote to long-term memory at hunt end.
44489. **Working-set visualization** — Researchers see what is currently in the agent's working memory.
44490. **Memory-inspection debugger** — Steps through what the agent knew at any decision point.
44491. **Retrieval replay for debugging** — Re-runs a hunt's retrievals to diagnose bad decisions.
44492. **Retrieval-config versioning** — Retrieval profiles versioned and diffable.
44493. **Tenant-default retrieval profiles** — Per-workspace default retrieval profiles.
44494. **Compliance-mode retrieval** — Retrieval restricted to approved sources for regulated hunts.
44495. **Air-gapped retrieval** — A fully local retrieval stack for disconnected environments.
44496. **Retrieval encryption** — Memory contents encrypted with decryption per access rights at retrieval time.
44497. **Retrieval-audit exports** — Compliance exports of everything loaded during a hunt.
44498. **Memory-residency controls** — Chooses which region's index serves retrievals.
44499. **Retrieval-SLO dashboard** — Latency percentiles and recall service objectives tracked.
44500. **Degraded-mode playbooks** — Predefined behavior when retrieval is only partially available.
44501. **Retrieval-chaos testing** — Simulated index failures validate fallback behavior.
44502. **Memory warming on schedule** — Indexes pre-warmed before planned hunt windows.
44503. **Retrieval-cost attribution** — Embedding and rerank costs attributed per hunt and tenant.
44504. **Retrieval-roadmap planner** — Proposes retrieval improvements from quality metrics.
44505. **Time-to-live on memories** — Every memory carries a TTL after which it becomes a revalidation candidate.
44506. **Forgetting-curve modeling** — Memory relevance decays on a curve tuned per memory type.
44507. **Review-by dates** — Volatile facts get explicit review dates and overdue ones queue for re-verification.
44508. **Stale-memory quarantine** — Outdated memories move to quarantine, excluded from retrieval until reviewed.
44509. **Soft-delete with restore** — Deleted memories linger recoverably for thirty days before hard deletion.
44510. **Tombstone records** — Deletions leave tombstones so sync and audit know the memory existed.
44511. **Hard-delete for compliance** — Erasure requests remove all copies including backups, with proof.
44512. **Deletion-audit log** — Every forget action logged with authorizer and reason.
44513. **Contradiction detector (memory)** — Background jobs find memories that mutually contradict.
44514. **Contradiction-resolution workflow** — Conflicting memories route to a human with evidence on both sides.
44515. **Auto-resolution rules** — Newer verified evidence auto-wins over older unverified claims, with logging.
44516. **Confidence decay on conflict (memory)** — Conflicting memories both lose confidence until resolved.
44517. **Memory-version chains** — Each edit creates a new version with the full history browsable.
44518. **Version-diff viewer** — Shows exactly what changed between memory versions.
44519. **Version rollback (memory)** — Restores any prior version with one action.
44520. **Schema migration for memories** — Old memories migrate to new schemas with validation.
44521. **Migration dry-run** — Previews schema migration effects before applying them.
44522. **Corruption scanner** — Periodic integrity checks detect bit-rot or malformed memories.
44523. **Corruption auto-repair** — Repairable corruption fixed automatically from redundant copies.
44524. **Quarantine for corrupt entries** — Unrepairable entries isolated with diagnostics attached.
44525. **Duplicate-memory merger** — Near-duplicate memories merged with provenance preserved.
44526. **Redundancy scoring** — Measures how much of the memory store is redundant.
44527. **Canonical-memory election** — Among duplicates, the best-sourced memory becomes canonical.
44528. **Dead-payload deprecation** — Payloads with zero hits over many hunts move to deprecated status.
44529. **Payload-sunset workflow** — Deprecated payloads get a sunset notice before removal.
44530. **Payload reinstatement** — A deprecated payload returns if new evidence shows it works.
44531. **Technique-obsolescence tracking** — Techniques killed by patches or defenses marked obsolete.
44532. **Obsolete-strategy archive** — Retired strategies kept read-only for historical analysis.
44533. **Knowledge-half-life dashboard** — Shows decay rates per knowledge category.
44534. **Hygiene scheduler** — Forgetting and review jobs run on a configurable schedule.
44535. **Hygiene policy per tenant** — Each workspace sets its own retention and forgetting rules.
44536. **Legal-hold exemptions** — Flagged memories exempt from all hygiene deletion.
44537. **Researcher-note protection** — Human-authored notes never auto-deleted without explicit approval.
44538. **Finding-linked memory protection** — Memories cited by findings are protected from forgetting.
44539. **Protected-memory registry** — An explicit list of memories exempt from hygiene.
44540. **Hygiene-impact preview** — Shows what would be forgotten before running a hygiene pass.
44541. **Hygiene-approval workflow** — Destructive hygiene requires human approval with a diff.
44542. **Hygiene-rollback window** — Hygiene deletions reversible within a grace period.
44543. **Incremental hygiene** — Small continuous cleanups instead of disruptive bulk purges.
44544. **Hygiene metrics** — Tracks volume forgotten, contradictions resolved, and duplicates merged.
44545. **Memory-freshness score** — A composite health metric per memory partition.
44546. **Freshness alerts** — Partitions dropping below freshness thresholds alert their owners.
44547. **Re-verification campaigns** — Targeted drives to re-confirm aging high-value memories.
44548. **Crowd verification** — Researchers confirm or refute queued memories with one click.
44549. **Verification bounties** — Gamified rewards for verifying stale knowledge.
44550. **Memory-lineage pruning** — Prunes derivation chains that no longer support any live memory.
44551. **Orphan-memory detection** — Memories with no links or usage flagged for review.
44552. **Orphan-adoption workflow** — Useful orphans get linked into the knowledge graph instead of deleted.
44553. **Low-confidence purge** — Memories below the confidence threshold with no recent use are purged.
44554. **Confidence recalibration** — Periodic recalibration of confidence scores against outcomes.
44555. **Evidence-attachment requirements** — Low-confidence memories require evidence to survive hygiene.
44556. **Single-source demotion** — Facts with only one weak source demoted in retrieval ranking.
44557. **Source-reliability tracking** — Sources scored by how often their facts verify.
44558. **Unreliable-source quarantine** — Facts from repeatedly wrong sources quarantined.
44559. **Circular-reference breaker** — Detects memories that only cite each other and flags them.
44560. **Self-referential cleanup** — Removes memories whose only evidence is themselves.
44561. **Overfitted-pattern pruning** — Patterns that only ever matched one hunt are pruned.
44562. **Spurious-correlation review** — Statistically shaky patterns flagged for human review.
44563. **Multiple-comparison guards** — Prevents promoting patterns discovered through unfocused fishing.
44564. **Memory-bloat alerts** — Alerts when store growth exceeds expected rates.
44565. **Storage quota per partition** — Caps per tenant and engagement with graceful handling.
44566. **Compression of cold memories** — Old memories compressed onto slower, cheaper storage.
44567. **Tiered-storage policy** — Hot, warm, and cold tiers with automatic promotion and demotion.
44568. **Cold-storage retrieval SLA** — Slower retrieval from the cold tier with explicit expectations.
44569. **Archive-format versioning** — Archived memories use versioned formats for future readability.
44570. **Format migration for archives** — Old archives migrated forward on access.
44571. **Checksum-verified archives** — Archives carry checksums verified on restore.
44572. **Archive-restore testing** — Periodic test restores validate archive integrity.
44573. **Retention-policy engine (memory)** — Declarative rules enforced automatically across the store.
44574. **Retention exceptions** — Per-engagement overrides to retention defaults.
44575. **Retention-compliance reports (memory)** — Proves to auditors what was kept and deleted and when.
44576. **Data-minimization mode (memory)** — Stores only what is needed for the engagement's purpose.
44577. **Minimization audit** — Verifies the store holds no more than policy allows.
44578. **PII scrubbing in memories** — Personal data detected and redacted or removed from memories.
44579. **Secret scrubbing** — Credentials and tokens purged from memory content automatically.
44580. **Scrub-verification sampling** — Humans spot-check scrubbing quality on samples.
44581. **Consent-scoped retention** — Memories kept only as long as the data subject consented.
44582. **Consent-expiry handling** — Expired-consent memories auto-quarantined.
44583. **Right-to-be-forgotten workflow (memory)** — One action purges a subject's data across all memory tiers.
44584. **Erasure certificates** — Cryptographic proof of deletion for compliance.
44585. **Memory-access recertification** — Periodic review of who can access sensitive memory partitions.
44586. **Dormant-access revocation** — Access grants unused for ninety days auto-expire.
44587. **Privilege-creep detection** — Flags accumulating permissions on memory partitions.
44588. **Hygiene-change notifications** — Stakeholders notified before bulk forgetting runs.
44589. **Forget-request inbox** — Researchers request forgetting with reasons and stewards approve.
44590. **Forget-appeal process** — Appeals a forgetting decision with new evidence.
44591. **Memory-steward roles** — Named stewards own hygiene for their partitions.
44592. **Steward dashboard** — Stewards see pending reviews, contradictions, and staleness.
44593. **Hygiene SLOs** — Targets like contradiction resolution within fourteen days, tracked openly.
44594. **Cross-partition dedup** — Duplicates across partitions merged with access-control awareness.
44595. **Partition-merge hygiene** — Merging partitions triggers dedup and conflict resolution.
44596. **Partition-split hygiene** — Splitting partitions re-evaluates what belongs where.
44597. **Import-hygiene gate** — Imported memories pass hygiene checks before merging.
44598. **Export-hygiene gate** — Exports exclude quarantined or unreliable memories by default.
44599. **Hygiene playbooks** — Documented procedures for common hygiene scenarios.
44600. **Hygiene simulation** — Simulates a hygiene policy change and previews its effects.
44601. **Hygiene A/B testing** — Compares hygiene policies on cloned partitions.
44602. **Memory-health score** — A single composite score per partition covering freshness, consistency, and coverage.
44603. **Health-trend charts** — Health score over time per partition.
44604. **Hygiene roadmap** — Planned hygiene improvements driven by health metrics.
44605. **Three-layer context architecture** — Working, summary, and long-term layers with explicit promotion rules between them.
44606. **Layer-boundary definitions** — Documented criteria for what belongs in each context layer.
44607. **Working-memory capacity caps** — Hard token limits per layer with defined overflow policies.
44608. **Spillover protocol** — When working memory fills, lowest-saliency items spill to the summary layer.
44609. **Summarization triggers** — Time, token-count, phase-change, and staleness triggers for summarization.
44610. **Rolling summaries** — The summary layer maintains a continuously updated hunt narrative.
44611. **Summary-fidelity checks** — Verifies that summaries preserve decision-critical facts.
44612. **Fact-preservation checklist** — Must-keep facts that summaries can never drop, such as target, scope, and findings.
44613. **Saliency scoring** — Every working-memory item scored on decision relevance.
44614. **Attention-budget allocation** — Limited attention distributed to the highest-saliency items.
44615. **Decision-point snapshots** — Working memory snapshotted at each major decision for audit.
44616. **Snapshot-diff viewer** — Compares working memory across decision points.
44617. **Crash recovery from snapshots** — Rebuilds working state from the last snapshot plus the event log.
44618. **Overflow guardrails** — Hard stops prevent any single item from consuming the whole context.
44619. **Token firewall between layers** — Layers cannot silently borrow each other's budgets.
44620. **Layer-promotion rules** — Defines when and how items move from working to summary to long-term memory.
44621. **Layer-demotion rules** — Defines when long-term facts get pulled back into working memory.
44622. **Promotion-audit log** — Every promotion logged with the triggering signal.
44623. **Summarizer-version pinning** — The summarizer model and prompt version recorded per summary.
44624. **Summary-validation harness** — Automated checks that summaries stay faithful to source events.
44625. **Hallucination-in-summary detector** — Flags summary claims with no source event.
44626. **Summary regeneration** — Rebuilds a summary from source events when validation fails.
44627. **Multi-granularity summaries** — One-line, paragraph, and page summaries maintained in parallel.
44628. **Phase summaries** — Each hunt phase gets its own summary feeding the global one.
44629. **Finding-centric summaries** — Summaries organized around findings for reporting use.
44630. **Strategy-centric summaries** — Summaries organized around strategy evolution for debriefs.
44631. **Token-compression ratios** — Tracks how aggressively each layer compresses content.
44632. **Compression-quality tradeoff control** — A tunable knob between context size and fidelity.
44633. **Lossless critical sections** — Findings and scope stored losslessly even under memory pressure.
44634. **Lossy background sections** — Recon noise summarized aggressively to save context.
44635. **Context defragmentation** — Periodic reorganization to reduce redundancy in working memory.
44636. **Deduplication within working memory** — Repeated observations merged in the working set.
44637. **Contradiction alerts in working memory** — Conflicting live observations surfaced immediately.
44638. **Recency boost in working memory** — Recent items weighted higher within the working layer.
44639. **Pinning critical facts** — Researcher or agent can pin facts immune to summarization.
44640. **Pin expiry** — Pins expire after their relevance window unless renewed.
44641. **Working-memory search** — The agent can query its own working memory explicitly.
44642. **Working-memory inspection interface** — Researchers see the live working set during a hunt.
44643. **Memory-pressure gauge** — Live display of layer fill levels.
44644. **Pressure-triggered behaviors** — At high fill levels the agent switches summarization aggressiveness.
44645. **Emergency-shedding protocol** — Under extreme pressure, a defined shed order protects critical facts.
44646. **Shedding audit** — Everything shed is logged and recoverable from the event log.
44647. **Pre-decision context assembly** — Before big decisions, the agent assembles a bespoke context pack.
44648. **Context-pack templates** — Templates for common decisions such as pivot, escalate, or conclude.
44649. **Post-decision context release** — Unneeded context released after the decision resolves.
44650. **Sub-agent memory scoping** — Sub-agents get scoped memory slices, not the whole context.
44651. **Slice-permission model** — Defines what each sub-agent may read and write.
44652. **Sub-agent result integration** — Sub-agent results merged back with provenance.
44653. **Parallel-branch memory isolation** — Concurrent branches do not contaminate each other's working memory.
44654. **Branch-merge protocol** — Merging branches reconciles their working memories.
44655. **Long-hunt memory management** — Special policies for multi-day hunts with daily summaries and archival.
44656. **Multi-session continuity** — Working memory persists across browser sessions and restarts.
44657. **Session-handoff summaries** — When a researcher takes over, a handoff summary is generated.
44658. **Handoff acknowledgment (memory)** — The new owner confirms understanding of key facts.
44659. **Idle-time consolidation** — During quiet periods the agent consolidates working memory.
44660. **Consolidation-quality metrics** — Measures whether consolidation preserved decision quality.
44661. **Offline consolidation replay** — Idle-time replay of recent hunts to consolidate working memory into durable knowledge.
44662. **Memory rehearsal** — Key facts rehearsed into long-term memory through spaced retrieval.
44663. **Interference management** — Similar targets' facts kept distinct to avoid cross-contamination.
44664. **Proactive forgetting in working memory** — Irrelevant details dropped deliberately and logged.
44665. **Intentional-ignorance markers** — The agent marks what it chose not to track and why.
44666. **Working-memory budgets per phase** — Recon gets breadth budget while verification gets depth budget.
44667. **Budget rebalancing** — Unused budget from one phase flows to the next.
44668. **Starvation detection** — Flags phases that never received enough context.
44669. **Context-quality scoring** — Rates whether the working set actually supports current decisions.
44670. **Quality-triggered refresh** — Low quality triggers re-retrieval instead of more summarization.
44671. **Stale-context detection** — Flags working-memory items invalidated by new observations.
44672. **Invalidation propagation** — When a fact changes, dependent items update or flag.
44673. **Belief-revision log** — Tracks how the agent's beliefs changed during the hunt.
44674. **Confidence in context** — Working-memory items carry confidence the agent can inspect.
44675. **Uncertainty-driven probing** — High-uncertainty items generate targeted verification probes.
44676. **Question queue** — Open questions maintained explicitly until resolved.
44677. **Assumption registry** — The agent's working assumptions listed with the risk if each is wrong.
44678. **Assumption-testing scheduler** — Risky assumptions get scheduled verification.
44679. **Working-memory export** — Dumps the live working set for debugging.
44680. **Time-travel debugging** — Reconstructs working memory at any past event.
44681. **Decision replay with context** — Replays a decision with the exact context the agent had.
44682. **What-if context editing** — Researchers tweak working memory in a sandbox to see how decisions change.
44683. **Context-poisoning detection** — Detects injected or misleading content in working memory.
44684. **Sanitization pipeline** — Untrusted tool outputs sanitized before entering working memory.
44685. **Trust levels for inputs** — Tool outputs labeled by trustworthiness.
44686. **Quarantined observations** — Suspicious observations isolated until verified.
44687. **Memory-injection alerts** — Alerts on patterns resembling prompt or memory injection.
44688. **Working-memory encryption** — Sensitive working sets encrypted at rest.
44689. **Memory-access logging** — Reads and writes to working memory logged for audit.
44690. **Multi-model context sharing** — When hunts use multiple models, context translates between them.
44691. **Model-handoff protocol** — Switching models preserves working memory faithfully.
44692. **Context-format adapters** — Working memory serialized per model's preferred format.
44693. **Tokenizer-aware budgeting** — Budgets computed with the actual model's tokenizer.
44694. **Cross-model summary compatibility** — Summaries validated to work across model families.
44695. **Working-memory analytics** — Tracks which items get referenced most to inform saliency models.
44696. **Attention heatmaps** — Visualizes what the agent attended to per decision.
44697. **Context-efficiency score** — Findings per context token as an efficiency metric.
44698. **Efficiency leaderboard** — Hunts ranked by context efficiency for process learning.
44699. **Working-memory templates** — Starter working sets for common hunt types.
44700. **Template customization** — Templates adapt to target features automatically.
44701. **Onboarding memory for new hunts** — Every hunt starts with a standard memory scaffold.
44702. **Shutdown checklist** — At hunt end, working memory archived per policy with verification.
44703. **Post-mortem context review** — Reviewers examine whether context failures caused misses.
44704. **Working-memory roadmap** — Planned improvements driven by working-memory analytics.
44705. **Memory namespaces** — Personal, team, engagement, and global namespaces with clear boundaries.
44706. **Namespace inheritance** — Engagement namespaces inherit from team, and team from global.
44707. **Private researcher memory** — Personal notes and heuristics never visible to others by default.
44708. **Private-to-shared promotion** — Researchers promote personal insights to team memory with one action.
44709. **Promotion-review queue** — Shared-memory additions reviewed before going live.
44710. **Team knowledge base** — Curated shared facts owned collectively by the team.
44711. **Knowledge editors and reviewers** — Distinct roles for proposing versus approving shared knowledge.
44712. **Knowledge attribution** — Every shared fact credits its contributors.
44713. **Contribution scoring** — Contributors earn points for facts that prove useful in hunts.
44714. **Attribution in reporting** — Internal reports show which team knowledge contributed to findings.
44715. **Memory access control lists** — Per-memory read and write permissions.
44716. **Role-based memory access** — Roles map to memory permissions consistently.
44717. **Engagement-scoped access** — Memories visible only to the engagement team.
44718. **Client-data isolation** — One client's memories never leak to another client's team.
44719. **Need-to-know enforcement** — Sensitive memories require explicit grant, not just team membership.
44720. **Time-boxed access grants (memory)** — Temporary access that auto-expires.
44721. **Access-request workflow (memory)** — Requests for restricted memories include justification.
44722. **Grant-approval chain** — Access requests route to memory owners for decision.
44723. **Access-audit log** — Every read of sensitive memory logged.
44724. **Read receipts for critical memories** — Owners see who read safety-critical knowledge.
44725. **Memory-sharing links** — Share a memory snapshot via an expiring link.
44726. **Link-permission scoping** — Shared links carry view-only or comment permissions.
44727. **Shared-memory versioning** — Team edits versioned with author attribution.
44728. **Edit-conflict resolution** — Concurrent team edits merge through a guided interface.
44729. **Comment threads on memories** — Discuss shared facts inline with context preserved.
44730. **Discussion resolution** — Resolved threads archive with the outcome recorded.
44731. **Team-memory templates** — Standard structures for shared playbooks and notes.
44732. **Onboarding packs** — New members get a curated memory pack per specialty.
44733. **Pack-completion tracking** — Tracks which onboarding memories were read.
44734. **Mentorship-memory sharing** — Seniors share curated memory collections with juniors.
44735. **Shadowing mode** — Juniors observe a senior's memory retrievals during a hunt in read-only mode.
44736. **Pair-hunting shared context** — Two researchers share one working memory in real time.
44737. **Handoff-memory protocol** — Structured knowledge transfer when hunts change owners.
44738. **Handoff checklists (memory)** — Required knowledge items confirmed as transferred.
44739. **Team-standup digest** — A daily auto-summary of new team knowledge.
44740. **Knowledge champions** — Per-domain owners who curate their area of the shared base.
44741. **Champion dashboard** — Champions see pending reviews and staleness in their domain.
44742. **Team-memory search** — Searches across all accessible namespaces at once.
44743. **Namespace-aware ranking** — Personal memories rank higher for their owner.
44744. **Shared-memory quality ratings** — The team rates shared facts on usefulness.
44745. **Low-rated fact review** — Poorly rated shared facts queue for improvement or removal.
44746. **Forking shared knowledge** — Teams fork shared playbooks to customize without affecting others.
44747. **Fork merge-back** — Useful fork improvements merge back upstream.
44748. **Divergence tracking** — Shows how far a fork drifted from upstream.
44749. **Team-memory analytics** — Shows which shared knowledge gets used and by whom.
44750. **Knowledge-silo detection** — Finds expertise trapped in private memories that should be shared.
44751. **Sharing nudges** — Gentle prompts when private notes look broadly useful.
44752. **Privacy-preserving sharing** — Shares patterns without exposing client specifics.
44753. **Anonymized team benchmarks** — Compares strategy effectiveness across teams anonymously.
44754. **Cross-team learning circles** — Scheduled reviews of shared learnings.
44755. **Memory-governance policy** — Documented rules for what belongs in shared memory.
44756. **Governance-violation detection** — Flags client data placed in shared spaces.
44757. **Auto-remediation of violations** — Misplaced sensitive memories auto-quarantined.
44758. **Data-classification labels (memory)** — Public, internal, confidential, and restricted labels on memories.
44759. **Label-based access enforcement** — Labels drive automatic access decisions.
44760. **Label inheritance** — Derived memories inherit the strictest source label.
44761. **Declassification workflow** — Confidential memories declassified after review.
44762. **Retention by label** — Stricter labels get shorter retention periods.
44763. **Team-memory backup** — Shared namespaces backed up independently.
44764. **Namespace restore** — Restores one namespace without affecting others.
44765. **Multi-workspace memory** — Memories span workspaces with explicit sharing rules.
44766. **Workspace trust levels** — Trusted workspaces share more freely.
44767. **External-collaborator access** — Clients or partners get scoped memory views.
44768. **Partner-memory sandbox** — External contributions isolated until reviewed.
44769. **Memory escrow for disputes** — Disputed knowledge held in escrow during resolution.
44770. **Arbitration workflow** — Neutral review resolves knowledge disputes.
44771. **Team-vocabulary glossary** — Shared terminology preventing miscommunication.
44772. **Glossary enforcement in interface** — Consistent terms suggested when writing notes.
44773. **Acronym expander (memory)** — Team acronyms auto-expanded for newcomers.
44774. **Knowledge graph of people** — Maps who knows what, derived from contributions.
44775. **Expertise locator** — Finds the teammate with knowledge about a topic.
44776. **Expertise freshness** — Expertise scores decay without recent contributions.
44777. **Skill matrix from memory** — Team capabilities inferred from knowledge contributions.
44778. **Training-need detection** — Gaps in team knowledge trigger training suggestions.
44779. **Team-learning velocity** — Measures how fast shared knowledge grows per quarter.
44780. **Knowledge ROI per team** — Findings attributed to shared knowledge versus solo work.
44781. **Credit splitting for co-authored facts** — Multiple contributors share attribution fairly.
44782. **Dispute-free attribution** — Clear credit rules prevent authorship conflicts.
44783. **Memory-contribution leaderboards** — Recognizes top contributors on an opt-in basis.
44784. **Contribution badges** — Badges for milestones such as one hundred verified facts.
44785. **Team-memory health score** — A composite of coverage, freshness, and participation.
44786. **Participation equity** — Ensures knowledge is not dominated by a few voices.
44787. **Quiet-expert surfacing** — Identifies holders of valuable private knowledge.
44788. **Knowledge retention on offboarding** — Departing members' key knowledge captured systematically.
44789. **Exit-interview knowledge capture** — Structured capture of tacit knowledge when members leave.
44790. **Offboarding-access revocation** — Immediate, audited revocation of memory access.
44791. **Knowledge-continuity score** — Measures risk if a key member leaves.
44792. **Succession-memory packs** — Critical knowledge packaged for successors.
44793. **Team-memory API** — Programmatic access for integrations with access rights enforced.
44794. **Webhooks for team memory** — Notifies on shared-knowledge changes.
44795. **Chat-tool integration** — Shares and discusses memories inside team chat tools.
44796. **Chat-to-memory capture** — Valuable chat discussions promoted to memory.
44797. **Meeting-notes-to-memory** — Debrief notes structured into shared knowledge.
44798. **Decision records for teams** — Architecture decision records for strategy and tooling choices.
44799. **Decision-to-outcome linkage** — Decisions linked to their results for learning.
44800. **Blameless postmortems (memory)** — Shared postmortem memory without finger-pointing.
44801. **Postmortem-action tracking** — Action items from postmortems tracked to completion.
44802. **Team-memory roadmap** — Planned knowledge initiatives per quarter.
44803. **Memory-culture guidelines** — Norms for writing, sharing, and crediting knowledge.
44804. **Annual knowledge audit (memory)** — A yearly review of team memory health and governance.
44805. **Selective export builder** — Chooses namespaces, date ranges, targets, and techniques for an export package.
44806. **Export manifests** — A machine-readable inventory of everything inside an export package.
44807. **Manifest checksums** — Per-file hashes in the manifest for integrity verification.
44808. **Incremental export** — Exports only what changed since the last export.
44809. **Delta-chain exports** — A series of deltas reconstructable in order.
44810. **Full-snapshot exports** — Complete point-in-time memory snapshots.
44811. **Export-format options** — ZIP, tarball, or single-file archive formats.
44812. **Export-compression levels** — Tunable compression trading size against speed.
44813. **Encrypted exports** — AES-256 encryption with passphrase or key file.
44814. **Key management for exports** — Export keys stored in the vault, never inside the archive.
44815. **Public-key exports** — Encrypts exports to a recipient's public key.
44816. **Export-access audit** — Logs who exported what and when.
44817. **Export-approval workflow (memory)** — Sensitive exports require approval before release.
44818. **Export-policy engine** — Rules defining what may leave the device.
44819. **Policy-violation blocking** — Exports containing prohibited data are blocked with an explanation.
44820. **Anonymized exports** — Strips target identifiers for sharing or research.
44821. **Anonymization verification** — Checks that anonymized exports cannot be re-identified.
44822. **Pseudonymized exports** — Consistent pseudonyms preserve linkability without identity.
44823. **Export scheduling** — Automatic exports on a schedule to backup storage.
44824. **Export retention** — Old export files age out per policy.
44825. **Import dry-run** — Previews what an import would change before applying it.
44826. **Import-impact report** — Counts of new, updated, conflicting, and skipped memories.
44827. **Import-preview interface** — Browses the incoming memories before committing.
44828. **Selective import** — Imports only chosen namespaces or items from a package.
44829. **Merge-strategy selection** — Chooses last-write-wins, manual, or field-level merge per import.
44830. **Three-way merge** — Base, local, and incoming versions merged intelligently.
44831. **Field-level conflict interface** — Resolves conflicts field by field with both values shown.
44832. **Conflict auto-resolution rules** — Trusted-source-wins and newer-verified-wins presets.
44833. **Conflict escalation** — Unresolvable conflicts queue for human decision.
44834. **Import rollback** — Reverts an entire import with one action.
44835. **Import snapshots** — Automatic pre-import snapshot for safe rollback.
44836. **Idempotent imports** — Re-importing the same package changes nothing.
44837. **Import deduplication** — Incoming memories deduped against existing ones.
44838. **Provenance preservation** — Imports keep original authorship and timestamps.
44839. **Provenance-rewriting option** — Attributes imported memories to the importer when desired.
44840. **Schema-version negotiation** — Importer and package agree on compatible schema versions.
44841. **Schema upgrade on import** — Old packages migrate forward during import.
44842. **Schema-downgrade warnings** — Warns when a package is newer than the importer.
44843. **Corrupt-package handling** — Damaged archives fail gracefully with diagnostics.
44844. **Partial-package recovery** — Salvages undamaged portions of a corrupt package.
44845. **Package-signature verification** — Signed exports verified before import.
44846. **Signature-trust store** — Manages trusted signer keys.
44847. **Unsigned-package warnings** — Clear warnings for packages without signatures.
44848. **Malware scan on import** — Scans imported payloads and scripts before merging.
44849. **Quarantined imports** — Suspicious packages held for review.
44850. **Import-rate limiting** — Throttles large imports to protect live hunts.
44851. **Background imports** — Large imports run asynchronously with progress tracking.
44852. **Import cancellation** — Cancels a running import cleanly.
44853. **Cross-device sync (memory)** — Paired devices sync memories continuously.
44854. **Sync-conflict handling** — Concurrent edits across devices merge per policy.
44855. **Sync-status dashboard** — Shows what is synced, pending, or conflicted per device.
44856. **Device-pairing flow** — Secure pairing with code verification.
44857. **Device-trust revocation** — Unpairs a lost device and purges its synced data.
44858. **Selective-device sync** — Chooses which namespaces sync to which device.
44859. **Bandwidth-aware sync (memory)** — Syncs deltas first and bulk data on fast networks.
44860. **Offline-device queue** — Changes queue while a device is offline and sync on reconnect.
44861. **Sync encryption in transit** — Transport encryption plus payload encryption for sync traffic.
44862. **End-to-end encrypted sync (memory)** — Sync servers cannot read synced memories.
44863. **Cloud-backup integration** — Optional encrypted backup to user-chosen storage.
44864. **Backup versioning (memory)** — Multiple backup generations retained.
44865. **Backup-restore testing** — Periodic test restores validate backups.
44866. **Disaster-recovery runbook** — A documented full-restore procedure.
44867. **Memory-portability standard** — An open format so memories move between tools.
44868. **Portability-conformance tests** — Validates that exports meet the standard.
44869. **Vendor-lock-in avoidance** — No proprietary extensions required for core data.
44870. **Export to SIEM** — Hunt memories exportable to SIEM formats.
44871. **Export to ticketing** — Findings and context push to ticketing systems.
44872. **Export to wiki** — The knowledge base publishes to wiki platforms.
44873. **API-driven export** — Scripted exports via REST with authentication.
44874. **Webhook on export complete** — Notifies integrations when scheduled exports finish.
44875. **Export templates** — Reusable export configurations.
44876. **Template sharing (memory)** — Shares export templates across teams.
44877. **Compliance-export packs** — Regulator-ready packages with chain of custody.
44878. **Legal-hold exports** — Immutable exports for litigation.
44879. **Export chain of custody** — A cryptographic log from export to delivery.
44880. **Client-delivery packages** — Curated memory subsets for client handoff.
44881. **Delivery acknowledgment** — Clients confirm receipt of memory packages.
44882. **Time-limited delivery links** — Expiring links for client packages.
44883. **Export watermarking (memory)** — Invisible watermarks trace leaked packages.
44884. **Leak-investigation support** — Watermarks identify the source of a leak.
44885. **Import from scanners** — Third-party scanner outputs import as memories.
44886. **Import field mapping** — Maps scanner fields to the memory schema.
44887. **Mapping templates** — Reusable field mappings per scanner.
44888. **Import from reports** — Old PDF reports parsed into structured memories.
44889. **Report-parsing quality scores** — Confidence in parsed imports shown inline.
44890. **Human review of parsed imports** — Low-confidence parses queue for review.
44891. **Import from spreadsheets (memory)** — CSV and Excel target lists and notes import cleanly.
44892. **Bulk-import validation** — Row-level errors reported without failing the batch.
44893. **Migration from legacy systems** — One-shot migration from older memory systems.
44894. **Migration verification** — Post-migration checks confirm completeness.
44895. **Migration rollback** — Reverts a failed migration.
44896. **Federated memory exchange** — Organizations exchange sanitized memories under policy.
44897. **Exchange-policy controls** — Defines precisely what may be shared externally.
44898. **Exchange audit** — Logs all cross-organization memory flows.
44899. **Memory marketplace** — Publishes and subscribes to community memory packs.
44900. **Pack-quality ratings** — The community rates shared packs.
44901. **Pack-update subscriptions** — Auto-updates subscribed packs.
44902. **Export and import analytics** — Tracks volume, frequency, and failure rates of transfers.
44903. **Transfer-performance tuning** — Parallel streams and compression for large transfers.
44904. **Transfer roadmap** — Planned transfer improvements driven by analytics.
44905. **Knowledge-coverage map** — A visual map of what the agent knows across vulnerability classes and stacks.
44906. **Coverage-by-stack matrix** — Knowledge depth per technology stack.
44907. **Coverage-by-technique matrix** — Knowledge depth per testing technique.
44908. **Knowledge-gap detector** — Finds stack and technique combinations with thin knowledge.
44909. **Gap prioritization** — Gaps ranked by how often hunts encounter them.
44910. **Gap-driven research queue** — Gaps auto-create research tasks.
44911. **Research-task tracking** — Tracks gap-filling research through to completion.
44912. **Knowledge-freshness heatmap** — Recency of verification across knowledge areas.
44913. **Knowledge-staleness alerts** — Knowledge areas going stale trigger re-verification drives.
44914. **Memory-health dashboard** — A single pane for size, freshness, contradictions, and usage.
44915. **Health-score trending** — Health over time per partition.
44916. **Health benchmarks** — Compares partitions against fleet averages.
44917. **Learning-velocity metric** — New verified facts per week.
44918. **Velocity by domain** — Learning speed per vulnerability class or stack.
44919. **Velocity-anomaly alerts** — Sudden drops in learning velocity investigated.
44920. **Knowledge-compounding chart** — Cumulative value of knowledge over time.
44921. **Memory-ROI analysis** — Findings attributed to memory versus discovered cold.
44922. **ROI by memory type** — Which memory types pay off most, compared directly.
44923. **Retrieval-hit rate** — Fraction of retrievals that influenced a decision.
44924. **Retrieval-miss analysis** — Decisions made without relevant memory, categorized by cause.
44925. **Unused-knowledge report** — Knowledge never retrieved, flagged for pruning or promotion.
44926. **Over-relied knowledge** — Knowledge used so often it may indicate blind spots elsewhere.
44927. **Decision-influence scoring** — How much each memory contributed to hunt outcomes.
44928. **Counterfactual-value estimation** — Estimated findings lost if a memory had not existed.
44929. **Hallucination-from-memory rate** — How often the agent misused a memory.
44930. **Misuse-pattern analysis** — Categories of memory misuse feeding training fixes.
44931. **Memory-precision metric** — Retrieved memories that were actually correct and relevant.
44932. **Memory-recall metric** — Relevant memories that retrieval failed to surface.
44933. **Precision-recall tradeoff dashboard** — Tunes retrieval with live metrics.
44934. **Confidence-calibration analysis** — Whether memory confidence scores match reality.
44935. **Calibration plots** — Visual calibration curves per memory type.
44936. **Overconfidence detection** — Systematically overconfident memories flagged.
44937. **Under-confidence detection** — Useful but timid memories boosted.
44938. **Contradiction heatmap** — Shows where contradictions cluster in the knowledge graph.
44939. **Contradiction-resolution time** — How long contradictions take to resolve, tracked.
44940. **Contradiction-aging report** — Old unresolved contradictions escalated.
44941. **Redundancy analysis** — How much storage is duplicate or near-duplicate.
44942. **Deduplication savings** — Storage and retrieval gains from dedup, quantified.
44943. **Growth forecasting** — Predicts memory-store growth for capacity planning.
44944. **Growth by source** — Which sources drive growth fastest.
44945. **Storage-cost attribution** — Memory costs attributed per tenant and engagement.
44946. **Cost-efficiency score** — Knowledge value per storage dollar.
44947. **Query-performance analytics** — Retrieval latency percentiles by query type.
44948. **Slow-query log** — Worst retrievals investigated individually.
44949. **Index-efficiency metrics** — Index size versus recall tradeoffs.
44950. **Embedding-drift detection** — Detects when embeddings go stale relative to content.
44951. **Re-indexing scheduler** — Re-indexes based on drift rather than fixed schedules.
44952. **Usage analytics per researcher** — Which memories each researcher uses, privacy-aware.
44953. **Usage analytics per team** — Team-level knowledge consumption patterns.
44954. **Peak-usage analysis** — Identifies when memory systems are stressed, for capacity planning.
44955. **Hunt-outcome correlation** — Which memory patterns correlate with successful hunts.
44956. **A/B memory-enabled hunts** — Compares hunts with and without memory assistance.
44957. **Memory-ablation studies** — Systematically disables memory types to measure their value.
44958. **Ablation report** — Published results of what each memory layer contributes.
44959. **Feature importance for retrieval** — Which ranking signals matter most.
44960. **Ranking-signal tuning** — Auto-tunes ranking weights from outcome data.
44961. **Personalization effectiveness** — Whether personalized retrieval beats generic retrieval.
44962. **Cold-start performance** — How well the agent performs with empty memory.
44963. **Warm-start lift** — Improvement from loaded target profiles, quantified.
44964. **Profile-completeness versus outcome** — Correlation between dossier completeness and findings.
44965. **Note-quality scoring** — Researcher notes scored on usefulness to future hunts.
44966. **Note-quality feedback** — Authors see how their notes performed over time.
44967. **Knowledge-lifecycle analytics** — Time from draft to canonical to deprecated per fact.
44968. **Bottleneck detection** — Finds where facts stall in the lifecycle.
44969. **Reviewer throughput** — Review capacity versus queue depth, for staffing decisions.
44970. **Review-quality sampling** — Audits review decisions for consistency.
44971. **Contribution analytics** — Who contributes, what types, and acceptance rates.
44972. **Contributor retention** — Whether contributors keep contributing over time.
44973. **Knowledge-diversity metric** — Breadth of sources and viewpoints in the knowledge base.
44974. **Bias detection in knowledge** — Over-representation of certain stacks or techniques.
44975. **Debiasing initiatives** — Targeted efforts for underrepresented areas.
44976. **Temporal analytics** — How knowledge value changes with age.
44977. **Half-life estimation** — Empirical half-life per knowledge category.
44978. **Predictive staleness** — Predicts which facts will go stale next.
44979. **Proactive-refresh scheduling** — Refreshes facts before they go stale.
44980. **Event-volume analytics** — Hunt event rates and what drives them.
44981. **Decision-quality scoring** — Rates hunt decisions against outcomes.
44982. **Decision-regret analysis** — Decisions the agent would reverse with hindsight.
44983. **Regret-driven training** — High-regret decisions become training examples.
44984. **Strategy-diversity metric** — Whether the agent tries diverse strategies or falls into ruts.
44985. **Rut detection** — Alerts when strategy diversity collapses.
44986. **Exploration effectiveness** — Whether exploration probes pay off.
44987. **Serendipity rate** — Unexpected discoveries per thousand probes.
44988. **Cross-hunt learning curves** — Effectiveness improvement over hunt count.
44989. **Learning-plateau detection** — When improvement stalls, triggers strategy review.
44990. **Forgetting effectiveness** — Whether hygiene improved retrieval precision.
44991. **Hygiene ROI** — Precision gains per unit of hygiene effort.
44992. **Transfer-failure root-cause analysis** — Categorizes why memory transfers fail.
44993. **Sync-health metrics** — Sync latency and conflict rates per device pair.
44994. **Backup-reliability score** — Restore-test pass rates over time.
44995. **Compliance analytics** — Retention compliance and access-audit completeness.
44996. **Audit-readiness score** — How ready memory systems are for an audit.
44997. **Privacy metric** — Personal-data incidents in memory over time, targeting zero.
44998. **Security-incident tracking** — Memory-related security events and their response.
44999. **Analytics-access controls** — Defines who can see aggregate analytics, protecting privacy.
45000. **Differential privacy in analytics** — Aggregates noised to protect individuals.
45001. **Embeddable analytics widgets** — Dashboard widgets embeddable in external tools.
45002. **Scheduled analytics reports** — Weekly and monthly memory-health reports auto-generated.
45003. **Report customization** — Stakeholders choose metrics and depth.
45004. **Analytics roadmap** — Planned metrics driven by stakeholder requests.
