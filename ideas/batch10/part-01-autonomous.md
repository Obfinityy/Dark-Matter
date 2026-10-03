90005. **One-Click Hunt Ignition** — a single entry point that converts a pasted URL into a fully running autonomous hunt with no further configuration required.
90006. **Autonomous Loop Entry Criteria** — a rules engine that decides whether a submitted target qualifies for fully unattended hunting based on scope clarity and safety checks.
90007. **Hunt Loop Lifecycle States** — a formal state machine (queued, arming, hunting, verifying, reporting, done) that every autonomous loop moves through with visible transitions.
90008. **Loop Completion Guarantees** — a contract that an autonomous hunt either finishes with a report or with an explicit failure reason, never silently stalling.
90009. **Autonomous Loop Watchdog** — an independent monitor that detects stalled or looping hunt agents and restarts them from the last checkpoint.
90010. **Loop Time-Budget Allocator** — a planner that divides a hunt's total time budget across recon, testing, chaining, and reporting phases before the loop starts.
90011. **Adaptive Phase Rebalancing** — a runtime that shifts unused time budget from quiet phases into productive ones while the hunt is running.
90012. **Hunt Loop Checkpointing** — periodic snapshots of hunt state so an interrupted loop resumes exactly where it stopped instead of restarting.
90013. **Resume Token for Hunts** — a portable token that lets a hunt loop be paused on one machine and resumed on another without losing context.
90014. **Loop Dry-Run Simulator** — a preview mode that shows the planned hunt stages, estimated duration, and request counts before any traffic is sent.
90015. **Loop Calibration Run** — a short low-intensity probe that measures target responsiveness so the main loop can tune its pace safely.
90016. **Autonomous Hunt Sandbox Stage** — an isolated first stage where the loop validates its tooling against a mirror before touching the live target.
90017. **Loop Request Budget Governor** — a cap on total outbound requests per loop with graceful wind-down as the budget nears exhaustion.
90018. **Loop Concurrency Governor** — dynamic adjustment of parallel workers in a hunt loop based on target response health signals.
90019. **Autonomous Loop Kill Switch** — a single control that halts every running loop instantly and preserves partial evidence for review.
90020. **Loop Blackout Windows** — user-defined hours during which autonomous loops pause automatically to respect target maintenance periods.
90021. **Loop Maintenance Mode** — a degraded state where loops continue read-only recon but stop active testing during target instability.
90022. **Loop Failure Budgets** — per-loop allowances for tool errors and timeouts that trigger graceful stage skipping instead of hard crashes.
90023. **Loop Error Budget Alerts** — notifications when a loop burns through its failure budget faster than expected, with a suggested remedy.
90024. **Hunt Loop SLOs** — service-level objectives such as "report delivered within X hours" tracked per loop and surfaced on a dashboard.
90025. **Loop Telemetry Stream** — a live structured feed of loop events (stage changes, findings, decisions) consumable by dashboards and webhooks.
90026. **Loop Decision Log** — an append-only record of every autonomous decision a loop made, with the inputs and confidence at decision time.
90027. **Loop Forensics Replay** — the ability to replay a finished loop's decisions and actions step-by-step for auditing or learning.
90028. **Loop Versioning** — versioned hunt-loop definitions so methodology changes are tracked and older loops remain reproducible.
90029. **Loop Definition Diffing** — a visual diff between two loop versions showing exactly what changed in strategy or tooling.
90030. **Loop Template Library** — reusable pre-built loop definitions for common target types like SaaS apps, APIs, and e-commerce sites.
90031. **Loop Cloning** — one-click duplication of a past loop's configuration onto a new target with scope variables remapped.
90032. **Loop Export and Import** — portable loop definitions that can be shared between teams or moved across environments as JSON.
90033. **Loop API Trigger** — a REST endpoint that starts an autonomous loop programmatically for CI/CD or orchestration integrations.
90034. **Loop Webhook Hooks** — outbound webhooks fired at loop milestones so external systems can react to hunt progress.
90035. **Loop Scheduling Windows** — calendar-based rules that start loops at approved times and pause them outside those windows.
90036. **Loop Priority Queues** — multiple priority lanes so urgent targets preempt routine loops without manual reordering.
90037. **Loop Starvation Detection** — monitoring that flags low-priority loops waiting too long and escalates them automatically.
90038. **Loop Fairness Scheduler** — allocation logic that balances compute across concurrent loops so no single hunt monopolizes resources.
90039. **Loop Cost Tracker** — real-time accounting of compute and API costs consumed by each autonomous loop.
90040. **Loop Cost Caps** — hard spending limits per loop that trigger a controlled shutdown before overruns occur.
90041. **Loop Quality Gates** — checkpoints that block a loop from advancing until minimum evidence standards for the current stage are met.
90042. **Loop Sign-Off Flow** — an optional human approval step before a loop publishes its final report, configurable per policy.
90043. **Loop Archival Policy** — automatic archival of finished loops with their evidence, logs, and reports after a retention period.
90044. **Loop Evidence Snapshots** — immutable snapshots of collected evidence attached to each loop for later verification.
90045. **Loop Comparison View** — side-by-side comparison of two loops against similar targets showing findings, duration, and decisions.
90046. **Loop A/B Methodology Testing** — running two loop variants against comparable targets to measure which strategy finds more.
90047. **Loop Canary Deployment** — rolling out a new loop version to a small subset of hunts before fleet-wide adoption.
90048. **Loop Health Score** — a composite score of loop liveness, progress rate, and error rate shown on the hunts dashboard.
90049. **Loop Incident Hooks** — automatic incident creation in the user's ticketing system when a loop hits a critical failure.
90050. **Loop Post-Mortem Generator** — an auto-written retrospective for failed or anomalous loops with root-cause hypotheses.
90051. **Loop Retrospective Digest** — a weekly summary of loop outcomes, anomalies, and improvement suggestions across all hunts.
90052. **Loop Scorecards** — per-loop report cards grading coverage, efficiency, finding quality, and autonomy level achieved.
90053. **Loop Dashboard** — a single operations view showing all running, queued, and finished loops with live status.
90054. **Loop Notification Policies** — fine-grained rules controlling which loop events notify the user and through which channel.
90055. **Loop Escalation Paths** — automatic escalation of stuck or high-value loops to a supervisor agent or human reviewer.
90056. **Loop Delegation** — the ability for a loop to spawn supervised sub-loops for distinct target areas with merged reporting.
90057. **Loop Handoff Protocol** — structured transfer of a running loop from one agent instance to another with full context.
90058. **Loop Approval Gates** — policy-driven pause points where a loop waits for explicit approval before high-impact actions.
90059. **Loop Audit Trail** — a tamper-evident log of every loop action for compliance and client assurance.
90060. **Loop Compliance Profiles** — preconfigured rule sets that keep loops within legal and contractual testing boundaries.
90061. **Loop Rollback** — reverting a loop to a previous checkpoint when a strategy change makes results worse.
90062. **Loop Context Compaction** — automatic summarization of long loop histories so context windows never overflow mid-hunt.
90063. **Loop Memory Pruning** — selective forgetting of low-value loop observations while retaining findings and decisions.
90064. **Loop Stage Parallelism** — running independent loop stages concurrently with a merge step that reconciles their outputs.
90065. **Loop Dependency Graph** — an explicit map of which loop stages depend on which others, used to parallelize safely.
90066. **Loop Idle Detection** — recognizing when a loop is waiting on external factors and parking it cheaply until conditions change.
90067. **Autonomous Target Queue Intake** — a backlog where submitted targets wait with metadata until a loop slot opens.
90068. **Loop Warm-Up Phase** — a preliminary stage where the loop learns target behavior patterns before committing to a strategy.
90069. **Loop Cool-Down Phase** — a final stage where the loop verifies no target side effects remain and tidies its artifacts.
90070. **Loop Outcome Contracts** — machine-readable definitions of what counts as a successful loop used for automated evaluation.
90071. **Self-Directed Target Triage** — an agent that ranks incoming targets by estimated finding potential before assigning loop resources.
90072. **Target Attractiveness Scoring** — a model that predicts how fruitful a target will be based on technology signals and surface size.
90073. **Autonomous Target Prioritization** — continuous re-ranking of the hunt queue as new intelligence arrives about each target.
90074. **Target Portfolio Balancing** — spreading loop capacity across target types to avoid over-concentration on one stack.
90075. **Target Difficulty Estimation** — pre-hunt assessment of how hard a target will be, used to pick the right loop intensity.
90076. **Target Selection Rationale Log** — a readable explanation of why the agent chose each target, stored for review.
90077. **Autonomous Scope Boundary Inference** — deriving sensible testing boundaries from the target's own published scope and structure.
90078. **Target Deduplication** — detecting when two submitted targets are the same asset and merging them into one loop.
90079. **Target Alias Resolution** — automatically discovering that different hostnames or apps belong to the same organization.
90080. **Target Relationship Mapping** — building a graph of how targets relate (subsidiaries, acquisitions, shared infra) for smarter selection.
90081. **Autonomous Target Enrichment** — gathering public context about a target (tech stack, size, history) before the loop starts.
90082. **Target Risk Profiling** — assessing the operational risk of testing a target to set appropriate loop aggressiveness.
90083. **Target Seasonality Awareness** — avoiding heavy autonomous testing during a target's known peak business periods.
90084. **Target Change Detection** — noticing when a target's technology or structure changes and re-queuing it for a fresh look.
90085. **Stale Target Retirement** — automatically retiring targets that show no change and no findings across multiple loops.
90086. **Target Revisit Scoring** — deciding which previously hunted targets deserve another loop based on elapsed time and changes.
90087. **Competitor Target Benchmarking** — comparing a target's posture against similar organizations to focus effort where it lags.
90088. **Autonomous Niche Targeting** — the agent specializing loop strategies for target categories where it historically excels.
90089. **Target Category Rotation** — cycling focus across categories so the agent's skills stay sharp everywhere.
90090. **Opportunistic Target Picking** — letting the agent start low-effort loops on promising targets during idle capacity.
90091. **Target Intake Validation** — verifying a submitted target is reachable and in scope before consuming loop resources.
90092. **Target Ownership Verification** — checks that confirm the user is authorized to test a target before autonomous hunting begins.
90093. **Target Consent Records** — storing proof of testing authorization alongside each target for compliance.
90094. **Multi-Target Campaign Seeding** — selecting a coherent set of related targets to hunt as one coordinated campaign.
90095. **Target Dependency Ordering** — sequencing targets so shared-infrastructure targets are hunted before their dependents.
90096. **Target Blast Radius Estimation** — predicting how broadly a target's compromise could spread, used to prioritize high-impact assets.
90097. **Autonomous Target Blacklisting** — the agent learning which targets waste loop time and deprioritizing them automatically.
90098. **Target Whitelist Fast-Track** — pre-approved targets that skip intake checks and go straight into autonomous loops.
90099. **Target Metadata Normalization** — standardizing target descriptions so selection models compare apples to apples.
90100. **Selection Bias Audits** — periodic reviews ensuring the agent's target choices are not skewed by training or recency bias.
90101. **Target Diversity Metrics** — tracking the spread of hunted targets across industries, stacks, and sizes.
90102. **Autonomous Target Sourcing** — discovering new in-scope targets from public sources tied to an existing client portfolio.
90103. **Target Pipeline Funnel** — a funnel view from intake to selection to loop to report showing conversion at each stage.
90104. **Selection Confidence Thresholds** — minimum confidence levels the agent must reach before committing loop resources to a target.
90105. **Target Rejection Reasons** — structured explanations when the agent declines a target, visible to the user.
90106. **Human Override on Selection** — a simple control for the user to pin or exclude targets regardless of agent ranking.
90107. **Selection Outcome Feedback** — feeding actual hunt results back into the target-selection model to improve future picks.
90108. **Target Lifetime Value** — estimating the total finding value a target will yield across many loops to guide investment.
90109. **Autonomous Micro-Targeting** — breaking a large target into sub-areas and selecting the most promising ones first.
90110. **Target Heatmaps** — visual maps showing where the agent believes findings are most likely within a target.
90111. **Selection Explainability Panel** — a UI panel translating the agent's target-ranking math into plain-language reasons.
90112. **Target Intake SLA** — a guarantee on how quickly a submitted target gets triaged and scheduled.
90113. **Autonomous Target Archiving** — moving fully-exhausted targets to an archive with a summary of everything learned.
90114. **Target Resurrection Triggers** — conditions (new tech, breach news, major redesign) that pull an archived target back into the queue.
90115. **Target Affinity Learning** — the agent learning which target traits historically led to findings and weighting selection toward them.
90116. **Target Cold-Start Strategy** — a default selection policy for brand-new accounts with no hunt history to learn from yet.
90117. **Target Clustering** — grouping similar targets so loops share methodology and learnings transfer faster.
90118. **Cluster Representative Hunting** — hunting one representative per cluster deeply, then applying learnings to the rest cheaply.
90119. **Target Anomaly Flagging** — selecting targets that deviate from their cluster's baseline as higher-priority unknowns.
90120. **Target History Timeline** — a chronological view of everything the agent has done to a target across all loops.
90121. **Cross-Target Pattern Matching** — reusing a finding pattern discovered on one target to check sibling targets automatically.
90122. **Target Similarity Search** — finding targets structurally similar to one that just yielded findings.
90123. **Autonomous Target Expansion Requests** — the agent proposing additional in-scope targets to the user with justification.
90124. **Target Portfolio Reports** — periodic summaries of portfolio health: coverage, findings per target, and revisit recommendations.
90125. **Target ROI Dashboard** — showing findings value versus loop cost per target to guide future selection.
90126. **Link-to-Target Compiler** — a guided flow that turns a raw pasted link into a fully enriched, validated, queued target.
90127. **Bulk Target Import** — importing hundreds of targets from CSV with automatic validation and deduplication.
90128. **Target Intake from Bug Bounty Platforms** — syncing in-scope targets directly from connected bounty programs.
90129. **Target Intake from Asset Inventory** — pulling targets from the user's own asset management system.
90130. **Target Freshness Score** — how up-to-date the agent's knowledge of a target is, decaying over time.
90131. **Target Knowledge Refresh** — lightweight re-scans that update target metadata without a full hunt loop.
90132. **Continuous Target Sentinel** — user-pinned targets the agent monitors continuously for changes worth hunting.
90133. **Watchlist Change Alerts** — notifications when a watched target's technology or structure changes significantly.
90134. **Target Decommission Detection** — recognizing when a target goes offline permanently and retiring it gracefully.
90135. **Target Succession Mapping** — tracking when a retired target is replaced by a new asset and transferring its hunt history.
90136. **Adaptive Methodology Engine** — the core decision system that rewrites the hunt plan mid-run based on what the target reveals.
90137. **Methodology Playbook Library** — a versioned collection of hunting strategies the adaptive engine can switch between.
90138. **Playbook Performance Tracking** — measuring which playbooks produce findings on which target types over time.
90139. **Playbook Matchmaking Engine** — the agent choosing the best playbook for a target from historical performance data.
90140. **Mid-Hunt Playbook Switching** — abandoning a failing strategy for a better-fitting one without restarting the loop.
90141. **Playbook Blending** — combining stages from multiple playbooks into a custom plan for unusual targets.
90142. **Methodology Mutation** — small random variations on proven playbooks to discover better strategies through evolution.
90143. **Playbook Fitness Scoring** — evaluating strategy variants by findings-per-hour to drive evolutionary improvement.
90144. **Adaptive Recon Depth** — deepening or shallowing reconnaissance based on early signals of target complexity.
90145. **Adaptive Test Intensity** — dialing testing aggressiveness up or down based on target stability and responsiveness.
90146. **Adaptive Check Ordering** — reordering vulnerability checks in real time so the most promising ones run first.
90147. **Signal-Driven Pivoting** — redirecting hunt effort toward newly discovered interesting endpoints or parameters immediately.
90148. **Dead-End Detection** — recognizing when a line of investigation is exhausted and reallocating effort elsewhere.
90149. **Rabbit-Hole Guard** — a time-box that prevents the agent from over-investing in a single fascinating but unproductive lead.
90150. **Serendipity Budget** — a small reserved slice of loop time for exploring unexpected leads outside the plan.
90151. **Adaptive Evidence Standards** — raising or lowering proof requirements based on finding severity and context.
90152. **Context-Aware Retesting** — automatically re-probing an endpoint when its context changes (new params, new auth state).
90153. **Technology-Triggered Checks** — launching specific test suites the moment a technology is fingerprinted.
90154. **Behavior-Triggered Deep Dives** — escalating to intensive testing when target behavior deviates from expectations.
90155. **Adaptive Authentication Handling** — the loop learning login flows on the fly and maintaining sessions through changes.
90156. **Session Refresh Autonomy** — detecting expired sessions and re-authenticating without human help.
90157. **Adaptive Rate Limiting** — the loop learning a target's throttling behavior and pacing itself just under the limit.
90158. **Backoff Strategy Learning** — remembering which backoff patterns worked on a target and reusing them.
90159. **Adaptive Fingerprinting** — refining technology detection as more responses arrive during the hunt.
90160. **Parameter Discovery Adaptation** — changing parameter-mining tactics based on what naming conventions the target uses.
90161. **Adaptive Wordlist Selection** — picking discovery wordlists matched to the target's stack instead of using generic ones.
90162. **Response Pattern Learning** — learning a target's normal response shapes so anomalies stand out automatically.
90163. **Baseline Drift Handling** — adjusting the learned baseline when the target legitimately changes mid-hunt.
90164. **Adaptive False-Positive Tuning** — tightening or loosening FP filters based on the target's noise characteristics.
90165. **Trust Calibration from Verdicts** — updating the agent's confidence model as verification results confirm or refute findings.
90166. **Methodology Version Pinning** — locking a loop to a known-good methodology version for reproducibility on demand.
90167. **Hunt Strategy Diary** — a human-readable log of every methodology change the agent made during a hunt and why.
90168. **Tactic Effectiveness Heatmap** — a visual map of which tactics worked where across the target's surface.
90169. **Adaptive Chaining Strategy** — changing how findings are combined into chains based on what the target's architecture allows.
90170. **Impact Escalation Logic** — the agent autonomously deciding when a low-severity finding deserves escalation to a bigger chain attempt.
90171. **Adaptive PoC Depth** — deciding how far to take a proof-of-concept based on severity and verification value.
90172. **Safe-Mode Testing** — an adaptive mode that switches to non-destructive checks when the target shows fragility.
90173. **Fragility Detection** — recognizing error patterns that indicate the target is unstable and throttling back.
90174. **Adaptive Scope Focus** — narrowing the hunt to the most promising areas when time runs short.
90175. **Coverage-Guided Fuzzing Direction** — steering input testing toward code paths the loop has not yet exercised.
90176. **State-Aware Test Sequencing** — ordering tests to respect application state dependencies discovered during the hunt.
90177. **Adaptive Retest Logic** — deciding which checks to rerun after a target change versus which results still stand.
90178. **Learning Rate Controls** — tuning how aggressively the agent updates its strategy from new evidence versus sticking to the plan.
90179. **Exploration-Exploitation Balancer** — a control that shifts the loop between trying new tactics and milking proven ones.
90180. **Methodology Snapshots** — saving the exact strategy state at key moments so adaptations can be reviewed or reverted.
90181. **Strategy Regression Detection** — flagging when a methodology change makes outcomes worse across multiple loops.
90182. **Cross-Loop Strategy Sharing** — a successful adaptation in one loop being proposed to other running loops.
90183. **Adaptive Reporting Depth** — expanding report detail for high-value findings and compressing it for routine ones.
90184. **Methodology Compliance Checks** — verifying the agent's adaptations never violate the loop's compliance profile.
90185. **Adaptation Audit Log** — a dedicated log of every autonomous methodology change for accountability.
90186. **Strategy Confidence Display** — showing the user how confident the agent is in its current hunt strategy live.
90187. **Manual Strategy Override** — letting the user pin a specific methodology mid-hunt while the agent handles the rest.
90188. **Adaptive Timeout Tuning** — learning per-target timeout values instead of using global defaults.
90189. **Retry Policy Adaptation** — adjusting retry counts and delays based on observed target flakiness.
90190. **Proxy Rotation Logic** — the loop managing its own egress rotation when targets throttle by IP.
90191. **Adaptive Data Sampling** — deciding how much response data to store based on its evidentiary value.
90192. **Noise Filtering Adaptation** — learning which target responses are noise and deprioritizing them automatically.
90193. **Adaptive Scheduling Within Loops** — reordering remaining loop tasks nightly based on partial results.
90194. **Methodology Marketplace** — a shared repository where teams publish and rate hunt strategies.
90195. **Playbook Peer Review** — a workflow for human experts to review and approve agent-proposed playbook changes.
90196. **Adaptive Hunt Personas** — the agent adopting different hunting styles (thorough, fast, stealthy) per loop based on goals.
90197. **Persona Switching Rules** — transparent rules governing when and why the agent changes its hunting persona.
90198. **Methodology Benchmarks** — standard target fixtures used to benchmark strategy changes before production use.
90199. **Adaptive Learning from Failures** — structured extraction of lessons from loops that found nothing, not just successes.
90200. **Strategy Debt Tracking** — flagging outdated playbook assumptions that need refreshing as the web evolves.
90201. **Autonomous Decision Framework** — the explicit policy tree the agent consults before making high-stakes hunt decisions.
90202. **Decision Confidence Scoring** — every autonomous decision carrying a calibrated confidence value stored with it.
90203. **Decision Threshold Policies** — configurable confidence levels below which the agent must ask instead of act.
90204. **Low-Risk Autonomy Zone** — a defined set of actions the agent may always take without approval.
90205. **High-Risk Action Gates** — mandatory pause-and-approve checkpoints before potentially impactful actions.
90206. **Autonomous Escalation Decisions** — the agent deciding on its own when to escalate a finding's severity based on new evidence.
90207. **Autonomous De-escalation** — the agent lowering a finding's severity when verification weakens the evidence.
90208. **Finding Acceptance Logic** — the criteria the agent uses to promote a raw observation into a reported finding.
90209. **Finding Rejection Logic** — the criteria for discarding observations as false positives, with logged reasons.
90210. **Autonomous Verification Depth** — deciding how many independent confirmations a finding needs before reporting.
90211. **Evidence Sufficiency Rules** — formal rules for when collected evidence is enough to stop testing a finding.
90212. **Autonomous PoC Go/No-Go** — the agent deciding whether building a proof-of-concept is worth the loop time.
90213. **Chain Attempt Decisions** — logic for when to try combining findings into higher-impact chains.
90214. **Chain Abandonment Rules** — criteria for stopping a chain attempt that is consuming too much budget.
90215. **Autonomous Retest Decisions** — the agent deciding which findings merit re-verification before the report.
90216. **Report Inclusion Decisions** — rules for which findings make the final report versus an appendix.
90217. **Severity Assignment Autonomy** — the agent assigning severity scores with a documented rationale per finding.
90218. **CVSS Vector Auto-Generation** — producing standard CVSS vectors for findings without human input.
90219. **Remediation Priority Ranking** — the agent ordering findings by fix urgency for the client's developers.
90220. **Autonomous Client Notification** — deciding when a critical finding warrants immediate alerting before the report is done.
90221. **Notification Timing Logic** — balancing alert speed against evidence completeness for critical findings.
90222. **Autonomous Scope Interpretation** — the agent resolving ambiguous scope language into concrete test boundaries.
90223. **Out-of-Scope Auto-Rejection** — automatically excluding discovered assets that fall outside the defined scope.
90224. **Scope Ambiguity Escalation** — pausing and asking the user when scope boundaries cannot be resolved safely.
90225. **Autonomous Pause Decisions** — the agent choosing to pause a loop when target conditions make continued testing unwise.
90226. **Autonomous Resume Decisions** — the agent deciding conditions have improved enough to resume a paused loop.
90227. **Autonomous Abort Decisions** — criteria for the agent to terminate a loop early as unproductive or unsafe.
90228. **Loop Continuation Votes** — periodic self-assessments where the agent justifies continuing versus stopping the hunt.
90229. **Fresh-Eyes Hunt Review** — logic that prevents the agent from continuing a failing hunt just because time was already spent.
90230. **Next-Best-Target Comparison** — the agent weighing a struggling loop against starting a fresher, more promising target.
90231. **Autonomous Budget Reallocation** — moving time and request budgets between stages or loops without human input.
90232. **Emergency Budget Requests** — the agent requesting extra budget for a breakthrough lead with a clear justification.
90233. **Budget Denial Handling** — graceful wind-down behavior when a requested budget extension is refused.
90234. **Autonomous Tool Selection** — the agent picking which scanner or technique to deploy for each task from its arsenal.
90235. **Tool Failure Fallbacks** — automatic substitution of an equivalent tool when the primary one fails.
90236. **Tool Output Validation** — the agent sanity-checking tool results before acting on them.
90237. **Conflicting Signal Resolution** — logic for reconciling contradictory findings from different tools.
90238. **Autonomous Hypothesis Testing** — the agent forming hypotheses about vulnerabilities and designing tests to confirm them.
90239. **Hypothesis Ranking** — prioritizing which hypotheses to test first by expected value and cost.
90240. **Hypothesis Retirement** — discarding disproven hypotheses with their evidence preserved for learning.
90241. **Autonomous Assumption Logging** — recording every assumption the agent makes so they can be challenged later.
90242. **Assumption Debt Board** — a backlog of agent assumptions scheduled for verification when budget allows.
90243. **Decision Reversibility Tags** — marking decisions as reversible or irreversible to apply appropriate caution.
90244. **Irreversible Action Safeguards** — extra verification steps before any action that cannot be undone.
90245. **Autonomous Rollback Decisions** — the agent reverting its own strategy or configuration when metrics degrade.
90246. **Decision Explainability Engine** — generating plain-language explanations for any autonomous decision on demand.
90247. **Decision Appeal Flow** — a way for the user to challenge an agent decision and have it reconsider with new input.
90248. **Autonomous Consensus** — multiple agent sub-instances voting on high-stakes decisions to reduce single-model error.
90249. **Dissent Recording** — preserving minority opinions from consensus votes for later review.
90250. **Decision Latency Budgets** — maximum time the agent may deliberate before it must act or escalate.
90251. **Fast-Path Decisions** — pre-approved decision shortcuts for recurring low-risk situations.
90252. **Decision Playbook** — a codified set of decision patterns the agent follows for common hunt situations.
90253. **Ethical Decision Layer** — a final check that blocks decisions violating testing ethics or authorization.
90254. **Legal Boundary Engine** — automated enforcement of jurisdictional and contractual testing limits.
90255. **Autonomous Disclosure Timing** — the agent recommending when a critical finding should be disclosed to the client.
90256. **Stakeholder Mapping** — the agent identifying who needs to know about a finding based on its nature.
90257. **Decision Fatigue Prevention** — batching low-stakes decisions so the agent's reasoning stays sharp for hard ones.
90258. **Autonomous Prioritization Matrix** — a live matrix ranking all open leads by impact, confidence, and cost.
90259. **Lead Potential Forecaster** — machine-learned scoring of investigative leads from historical outcomes.
90260. **Lead Aging Rules** — deprioritizing leads that have not panned out after sustained effort.
90261. **Autonomous Focus Sessions** — the agent dedicating uninterrupted effort blocks to the single highest-value lead.
90262. **Context Switching Costs** — the agent accounting for the overhead of jumping between leads when scheduling.
90263. **Decision Quality Metrics** — tracking how often autonomous decisions led to good outcomes over time.
90264. **Decision Calibration Reports** — comparing the agent's confidence scores against actual decision outcomes.
90265. **Autonomous Governance Dashboard** — a single view of all pending, approved, and denied autonomous decisions.
90266. **Self-Correction Engine** — the subsystem that detects the agent's own mistakes mid-hunt and corrects course.
90267. **Mid-Hunt Error Detection** — real-time identification of flawed assumptions, bad tooling, or wrong turns during a loop.
90268. **Course-Correction Triggers** — defined conditions that force the agent to stop and replan instead of pushing on.
90269. **Plan Adherence Watchdog** — warnings when the agent's actual behavior diverges from its approved hunt plan.
90270. **Plan Adherence Scoring** — measuring how closely a running loop follows its intended methodology.
90271. **Autonomous Plan Repair** — the agent rewriting a broken hunt plan while preserving completed work.
90272. **Broken Chain Recovery** — re-establishing lost tool chains or sessions without restarting the loop.
90273. **Session Loss Recovery** — automatically re-authenticating and resuming after dropped sessions.
90274. **State Desync Repair** — detecting when the agent's model of the target diverges from reality and resynchronizing.
90275. **Stale Assumption Refresh** — periodically re-validating old assumptions that newer evidence may have invalidated.
90276. **Disagreement Root-Cause Trace** — a routine that hunts down the source when two pieces of evidence disagree.
90277. **Evidence Reconciliation** — merging conflicting observations into a coherent picture before proceeding.
90278. **False-Positive Self-Audit** — the agent re-examining its own accepted findings for signs of error.
90279. **Finding Retraction Flow** — a clean process for withdrawing a finding the agent later determines was wrong.
90280. **Retraction Notifications** — alerting stakeholders when a previously reported finding is retracted.
90281. **Autonomous Peer Review** — a second agent instance reviewing the first's findings before they are finalized.
90282. **Adversarial Self-Review** — the agent deliberately trying to disprove its own findings to harden them.
90283. **Red-Team Self-Check** — the agent attacking its own conclusions the way a skeptical reviewer would.
90284. **Confidence Downgrade Protocol** — automatically lowering confidence when verification attempts fail.
90285. **Confidence Upgrade Protocol** — raising confidence only when independent evidence corroborates.
90286. **Premature Conclusion Guard** — blocking the agent from finalizing a finding before minimum verification steps complete.
90287. **Tunnel Vision Breaker** — forcing the agent to consider alternative explanations for its observations.
90288. **Confirmation Bias Counter** — requiring the agent to seek disconfirming evidence for favored hypotheses.
90289. **Overfitting Guard** — preventing the agent from building theories on too few data points.
90290. **Sampling Bias Correction** — adjusting conclusions when the agent realizes it only tested a skewed subset.
90291. **Survivorship Bias Checks** — reminding the agent that untested areas may hide the biggest findings.
90292. **Recency Bias Dampening** — preventing the latest observation from outweighing the full evidence history.
90293. **Autonomous Calibration Runs** — periodic self-tests against known targets to measure the agent's current accuracy.
90294. **Precision Decay Monitor** — flagging when the agent's finding accuracy trends downward over weeks.
90295. **Technique Rust Detection** — detecting when the agent gets worse at specific techniques and scheduling retraining.
90296. **Self-Correction Learning Loop** — feeding every corrected mistake back into the agent's models.
90297. **Mistake Pattern Mining** — discovering recurring error patterns across many loops for systemic fixes.
90298. **Correction Effectiveness Tracking** — measuring whether self-corrections actually improved outcomes.
90299. **Autonomous Checklist Enforcement** — the agent running pre-flight and stage-gate checklists on itself.
90300. **Missed-Step Detection** — noticing skipped methodology steps and scheduling them before the loop ends.
90301. **Coverage Gap Self-Repair** — the agent identifying untested surface and filling gaps before reporting.
90302. **Orphaned Lead Cleanup** — revisiting leads the agent opened but never closed out.
90303. **Dangling Task Resolution** — automatically finishing or explicitly dropping tasks left hanging by crashed stages.
90304. **Resource Leak Self-Repair** — the agent cleaning up its own abandoned sessions, files, and connections.
90305. **Configuration Drift Repair** — detecting when loop configuration drifted from intent and restoring it.
90306. **Tool Misuse Detection** — recognizing when the agent is using a tool incorrectly and correcting the invocation.
90307. **Prompt Injection Self-Defense** — the agent detecting when target content tries to influence its behavior and quarantining it.
90308. **Data Poisoning Awareness** — treating target-supplied data as untrusted when it shapes hunt decisions.
90309. **Hallucination Guards** — verification steps that catch the agent asserting findings without evidence.
90310. **Evidence-Claim Linkage** — requiring every claim in a report to link to concrete stored evidence.
90311. **Unverified Claim Quarantine** — holding unverified assertions out of reports until proven.
90312. **Autonomous Sanity Benchmarks** — quick self-checks like re-verifying a known finding to confirm the loop is healthy.
90313. **Loop Health Self-Diagnosis** — the agent assessing its own operational health and reporting degradation.
90314. **Degraded Mode Self-Entry** — the agent voluntarily reducing intensity when it detects its own errors rising.
90315. **Recovery Playbooks** — pre-built recovery procedures for common loop failure modes.
90316. **Failure Mode Library** — a catalog of known ways hunts go wrong with detection signatures.
90317. **Autonomous Incident Response** — the agent containing and documenting its own operational incidents.
90318. **Blast Radius Self-Assessment** — the agent estimating the impact of its own mistake before correcting it.
90319. **Safe Correction Ordering** — applying fixes in an order that cannot make things worse.
90320. **Correction Rollback** — undoing a self-correction that turned out to be wrong.
90321. **Self-Correction Transparency** — every correction logged with what was wrong, what changed, and why.
90322. **Correction Fatigue Guard** — preventing endless correction loops by capping corrections per stage.
90323. **Human Review Triggers** — conditions under which self-correction pauses and asks a human to arbitrate.
90324. **Correction Confidence Scores** — the agent rating how sure it is that its correction is right.
90325. **Second-Order Error Checks** — verifying that a correction did not introduce a new, subtler error.
90326. **Autonomous Quality Sampling** — the agent randomly re-verifying a sample of its own work for quality control.
90327. **Quality Trend Dashboards** — visualizing the agent's self-correction rates and accuracy over time.
90328. **Self-Improvement Backlog** — a prioritized list of the agent's own weaknesses discovered through self-correction.
90329. **Correction Knowledge Base** — a searchable archive of past mistakes and their fixes for the agent to consult.
90330. **Hunt Integrity Attestation** — a signed statement that the loop's self-correction systems ran and what they caught.
90331. **Autonomous Learning Pipeline** — the end-to-end system that turns hunt outcomes into improved future behavior.
90332. **Hunt Outcome Labeling** — structured labeling of what each loop achieved for training data.
90333. **Finding-to-Lesson Extraction** — distilling reusable tactics from successful findings automatically.
90334. **Failure-to-Lesson Extraction** — distilling what to avoid from loops that found nothing or went wrong.
90335. **Tactic Success Database** — a queryable store of which tactics worked on which stacks with statistical significance.
90336. **Technique Embeddings** — vector representations of hunting techniques enabling similarity-based tactic recommendations.
90337. **Cross-Target Transfer Learning** — applying lessons from one target category to accelerate hunting in another.
90338. **Few-Shot Hunt Adaptation** — the agent adapting to a novel stack from just a handful of observations.
90339. **Zero-Shot Check Prioritization** — ordering vulnerability checks sensibly even for never-before-seen technologies.
90340. **Hunt Memory Consolidation** — nightly merging of daily hunt learnings into long-term agent knowledge.
90341. **Knowledge Half-Life Engine** — decaying the weight of old learnings as the web platform landscape evolves.
90342. **Learning Rate Scheduling** — adjusting how fast the agent updates beliefs based on evidence volume and quality.
90343. **Curriculum Learning for Agents** — training the agent on progressively harder targets to build competence systematically.
90344. **Self-Play Hunt Simulations** — the agent hunting simulated targets to practice without consuming real loop budget.
90345. **Training Range Builder** — creating realistic vulnerable-by-design targets for agent training and benchmarking.
90346. **Training Target Difficulty Tiers** — graded synthetic targets from beginner to expert for structured agent improvement.
90347. **Agent Skill Trees** — a modeled map of hunting competencies with the agent's proficiency in each.
90348. **Competency Heat Mapping** — identifying which competencies lag and directing training effort there.
90349. **Personalized Agent Coaching** — targeted practice scenarios generated for the agent's weakest skills.
90350. **Learning from Human Hunters** — ingesting expert write-ups and translating their tactics into agent playbooks.
90351. **Write-Up Mining Pipeline** — automatically extracting techniques from public security research into testable checks.
90352. **CVE-to-Check Synthesis** — converting new vulnerability disclosures into hunt checks without human authoring.
90353. **Threat Intel Ingestion** — feeding threat intelligence into the agent's prioritization models automatically.
90354. **Exploit Trend Tracking** — monitoring which vulnerability classes are trending to weight hunt focus accordingly.
90355. **Seasonal Attack Pattern Learning** — recognizing time-based patterns in vulnerability emergence.
90356. **Technology Adoption Tracking** — watching which frameworks gain adoption to prepare checks in advance.
90357. **Framework-Specific Check Packs** — auto-generated test suites tailored to newly popular frameworks.
90358. **Regression Learning** — the agent remembering which checks used to work on a target to detect security regressions.
90359. **Baseline Posture Memory** — storing each target's historical security baseline for change comparison.
90360. **Improvement Attribution** — crediting specific learnings or changes when hunt performance improves.
90361. **Learning ROI Measurement** — quantifying how much each learning source contributes to finding rates.
90362. **Knowledge Freshness Audits** — periodically testing whether old learnings still hold true.
90363. **Deprecated Tactic Retirement** — automatically retiring checks that no longer produce findings anywhere.
90364. **Tactic Revival Detection** — noticing when an old technique becomes effective again due to tech cycles.
90365. **Collective Fleet Learning** — all agent instances sharing learnings through a central knowledge service.
90366. **Federated Learning Across Tenants** — improving shared models from many users' hunts without exposing their data.
90367. **Privacy-Preserving Lesson Sharing** — sanitizing shared learnings so no client-identifying details leak.
90368. **Learning Consent Controls** — letting users opt out of contributing their hunt data to collective learning.
90369. **Knowledge Versioning** — versioned agent knowledge so improvements are traceable and reversible.
90370. **Knowledge Rollback** — reverting to a previous knowledge version when a learning update degrades performance.
90371. **Learning Canary** — testing new learnings on a subset of loops before fleet-wide deployment.
90372. **A/B Learning Experiments** — controlled experiments measuring whether a new learning actually helps.
90373. **Learning Changelog** — a human-readable feed of what the agent learned each day and from which hunts.
90374. **Explainable Learning** — the agent explaining why a new lesson changed its behavior in plain language.
90375. **User Feedback Incorporation** — turning user corrections on reports into durable agent improvements.
90376. **Analyst-in-the-Loop Training** — structured workflows where experts review agent decisions to generate training signal.
90377. **Active Learning Queries** — the agent asking humans the most informative questions to fill its knowledge gaps.
90378. **Uncertainty-Driven Exploration** — directing hunt effort toward areas where the agent's models are least certain.
90379. **Curiosity Rewards** — intrinsic motivation signals that encourage the agent to explore novel target behaviors.
90380. **Novelty Detection in Results** — flagging observations that do not match anything the agent has seen before.
90381. **Surprise Logging** — recording events that violated the agent's expectations as prime learning material.
90382. **Expectation Calibration** — the agent continuously comparing predicted versus actual hunt outcomes.
90383. **Prediction Accuracy Leaderboard** — ranking the agent's predictive models by how well they forecast findings.
90384. **Meta-Learning Dashboard** — a view into how the agent learns: rates, sources, and effectiveness over time.
90385. **Learning Budget Allocation** — dedicating a slice of compute specifically to training and experimentation.
90386. **Offline Learning Jobs** — background training runs that do not compete with live hunts for resources.
90387. **Online Learning Safeguards** — constraints that keep live learning updates from destabilizing running loops.
90388. **Catastrophic Forgetting Prevention** — techniques ensuring new learnings do not erase previously mastered skills.
90389. **Skill Rehearsal Scheduling** — periodically re-practicing old skills on synthetic targets to keep them sharp.
90390. **Learning Milestones** — defined capability thresholds the agent works toward with progress tracking.
90391. **Capability Maturity Model** — a staged model of agent autonomy from supervised to fully independent.
90392. **Autonomy Level Certification** — formal assessment and certification of the agent's autonomy level per capability.
90393. **Learning from Near Misses** — extracting lessons from almost-findings that did not quite verify.
90394. **Counterfactual Hunt Analysis** — the agent analyzing what it would have found with different decisions.
90395. **Regret Minimization** — decision policies explicitly designed to minimize missed high-value findings.
90396. **Goal-Driven Hunt Mode** — hunts configured around explicit objectives like "maximize critical findings in 4 hours".
90397. **Natural Language Goal Input** — letting the user state hunt goals in plain words that the agent converts to a plan.
90398. **Goal Parsing Engine** — translating "find RCE in 2 hours" into budgets, priorities, and success criteria.
90399. **Goal Feasibility Assessment** — the agent honestly estimating whether a stated goal is achievable before starting.
90400. **Milestone Derivation Engine** — breaking a high-level goal into staged sub-goals with measurable checkpoints.
90401. **Sub-Goal Tracking** — live progress bars for each decomposed sub-goal during the hunt.
90402. **Goal Progress Predictor** — forecasting the likelihood of achieving the goal given current progress.
90403. **Goal Abandonment Protocol** — a dignified process for the agent to declare a goal unreachable with evidence.
90404. **Goal Renegotiation** — the agent proposing adjusted goals mid-hunt when the original proves infeasible.
90405. **Time-Boxed Finding Sprints** — hunts optimized purely for maximum findings within a fixed time window.
90406. **Critical-First Goal Mode** — a goal preset that biases every decision toward critical-severity outcomes.
90407. **Coverage Goal Mode** — a preset optimizing for maximum attack-surface coverage rather than depth.
90408. **Speed Goal Mode** — a preset minimizing time-to-first-finding for rapid assessments.
90409. **Stealth Goal Mode** — a preset minimizing detection footprint while still pursuing findings.
90410. **Compliance Goal Mode** — a preset ensuring every required check for a standard is completed and evidenced.
90411. **Multi-Goal Balancing** — the agent trading off competing goals like speed versus thoroughness transparently.
90412. **Goal Weight Sliders** — user controls that weight speed, depth, stealth, and coverage for the agent to optimize.
90413. **Pareto Frontier Display** — showing the user the trade-off curve between goals so they pick informed settings.
90414. **Goal Achievement Scoring** — grading each finished hunt on how well it met its stated goals.
90415. **Goal Library** — saved goal templates like "pre-launch audit" or "bug-bounty sprint" for one-click reuse.
90416. **Goal Recommendation** — the agent suggesting appropriate goals based on target type and context.
90417. **OKR-Style Hunt Objectives** — structuring hunts with objectives and measurable key results.
90418. **Key Result Auto-Measurement** — the agent measuring its own key results without manual tracking.
90419. **Goal Stretch Targets** — ambitious secondary goals the agent pursues opportunistically after primary goals are met.
90420. **Minimum Viable Hunt** — the smallest loop that still satisfies a goal, used when budgets are tight.
90421. **Goal-Based Budget Splitting** — dividing time and requests across sub-goals by their importance weights.
90422. **Dynamic Goal Reprioritization** — the agent reordering sub-goals live as evidence changes their expected value.
90423. **Goal Conflict Detection** — flagging when two stated goals cannot both be satisfied and asking for priority.
90424. **Goal Clarification Dialog** — the agent asking targeted questions when a goal statement is ambiguous.
90425. **Goal Templates by Industry** — prebuilt goal sets for finance, healthcare, e-commerce, and other verticals.
90426. **Goal Templates by Target Type** — prebuilt goals for APIs, web apps, mobile backends, and cloud assets.
90427. **Bounty-Maximization Mode** — a goal mode that optimizes for expected bounty payout using program reward tables.
90428. **Reward Table Ingestion** — the agent reading bounty program scopes and payouts to inform prioritization.
90429. **Expected Value Calculation** — the agent estimating finding probability times payout for each lead.
90430. **Payout-Aware Lead Ranking** — ordering investigation leads by expected bounty value.
90431. **Duplicate-Avoidance Logic** — the agent checking whether a finding is likely already reported before investing heavily.
90432. **Freshness Premium** — weighting newly deployed features higher since they are less likely to be already reported.
90433. **Goal-Based Reporting** — structuring the final report around the stated goals and how each was met.
90434. **Executive Goal Summary** — a one-page summary translating hunt goal achievement for non-technical stakeholders.
90435. **Goal Retrospectives** — post-hunt analysis of why goals were or were not met, feeding future planning.
90436. **Goal Difficulty Calibration** — learning how hard different goal types are to set realistic expectations.
90437. **Personal Goal History** — the user's past hunt goals with achievement rates to inform new goal setting.
90438. **Team Goal Alignment** — coordinating goals across multiple agents hunting for the same organization.
90439. **Goal Handoff Between Loops** — passing unmet sub-goals from a finished loop into the next scheduled loop.
90440. **Continuous Goal Pursuit** — an always-on mode where the agent keeps working toward a standing goal across loops.
90441. **Goal Expiry Rules** — standing goals automatically expiring or renewing based on time or achievement.
90442. **Goal Achievement Celebrations** — the agent highlighting major goal completions with summary digests.
90443. **Missed Goal Analysis** — deep-dives into why ambitious goals failed to improve future goal setting.
90444. **Goal Benchmark Comparisons** — comparing goal achievement rates against anonymized fleet averages.
90445. **Goal-Based Agent Personas** — different agent behavior profiles activated automatically by the chosen goal.
90446. **Goal Risk Appetite Mapping** — translating goal aggressiveness into concrete testing-intensity parameters.
90447. **Conservative Goal Presets** — prebuilt cautious goals for sensitive production targets.
90448. **Aggressive Goal Presets** — prebuilt intensive goals for staging or explicitly permissive targets.
90449. **Goal Audit Trail** — a record of who set which goals and every mid-hunt goal change.
90450. **Goal Versioning** — tracking goal definitions over time so achievement is measured against the right version.
90451. **Goal Sharing** — exporting goal configurations for teammates to reuse on similar targets.
90452. **Goal Marketplace** — a community library of proven goal templates rated by achievement rates.
90453. **Goal Effectiveness Ratings** — user ratings on whether suggested goals were actually useful.
90454. **Adaptive Goal Suggestions** — the agent learning which goals suit the user's style and proposing them proactively.
90455. **Goal Completion Webhooks** — external notifications fired when hunt goals are achieved or missed.
90456. **Goal SLA Tracking** — measuring whether hunts meet their time-boxed goals consistently.
90457. **Goal Escalation Rules** — automatic escalation when a high-priority goal falls behind schedule.
90458. **Goal Recovery Plans** — agent-generated plans to get a slipping goal back on track.
90459. **Stretch Goal Auto-Detection** — the agent recognizing when it is ahead and proposing ambitious extensions.
90460. **Goal Satisfaction Surveys** — lightweight post-hunt prompts capturing whether the goal felt right.
90461. **Unsupervised Surface Discovery** — the agent finding attack surface nobody told it to look for, within authorized bounds.
90462. **Shadow Asset Detection** — discovering forgotten or undocumented assets belonging to the target organization.
90463. **Orphaned Subdomain Finder** — identifying subdomains with no clear owner that may be unmaintained.
90464. **Stale DNS Record Hunting** — finding DNS entries pointing at deprovisioned infrastructure.
90465. **Cloud Asset Sprawl Mapping** — uncovering cloud resources the organization may not know it has.
90466. **Forgotten Environment Detection** — locating old staging, dev, or QA environments still exposed.
90467. **Legacy Endpoint Discovery** — finding deprecated API versions and endpoints still serving traffic.
90468. **Hidden Parameter Mining** — discovering undocumented parameters across the target's surface.
90469. **Hidden Path Enumeration** — uncovering unlinked pages and routes through behavioral analysis.
90470. **Unlinked Content Discovery** — finding content reachable but not referenced anywhere in navigation.
90471. **Deep Web Surface Mapping** — systematically mapping authenticated areas the agent can legitimately reach.
90472. **API Shadow Discovery** — finding undocumented API endpoints by observing client application traffic patterns.
90473. **Mobile API Surface Extraction** — discovering backend endpoints by analyzing the target's mobile app behavior.
90474. **Third-Party Integration Mapping** — identifying external services wired into the target that expand its surface.
90475. **Supply Chain Surface Discovery** — mapping vendor and library dependencies that constitute indirect attack surface.
90476. **Acquired Asset Discovery** — finding assets from company acquisitions that were never integrated into security scope.
90477. **Brand Impersonation Surface** — discovering lookalike domains and assets that could affect the target.
90478. **Certificate Transparency Mining** — using public certificate logs to discover target subdomains and assets.
90479. **Passive DNS Discovery** — leveraging historical DNS data to find assets without touching the target.
90480. **Public Index Harvesting** — systematically querying search engines for exposed target assets.
90481. **Code Repository Leakage Discovery** — finding target code or secrets exposed in public repositories within scope rules.
90482. **Paste Site Monitoring** — watching paste sites for target-related leaks that reveal new surface.
90483. **Dark Web Mention Tracking** — monitoring for target mentions that indicate exposed or compromised assets.
90484. **Social Media Surface Clues** — extracting infrastructure hints from the organization's public posts.
90485. **Job Posting Intel** — inferring technology stacks and projects from the target's public hiring posts.
90486. **Developer Footprint Mapping** — finding target infrastructure clues in developers' public profiles and posts.
90487. **Conference Talk Mining** — extracting architecture details from the organization's public engineering talks.
90488. **Open Source Contribution Analysis** — discovering internal tooling hints from employees' public code contributions.
90489. **Documentation Discovery** — finding public docs, wikis, and help centers that reveal system details.
90490. **Changelog Intelligence** — mining public changelogs for hints about new features worth hunting.
90491. **Status Page Analysis** — using public status pages to map infrastructure components.
90492. **Error Message Harvesting** — collecting verbose errors that reveal internal structure, within authorized testing.
90493. **Banner Intelligence** — aggregating service banners into a technology and version inventory.
90494. **Favicon Fingerprinting** — identifying frameworks and apps from favicon hashes across discovered assets.
90495. **TLS Fingerprint Clustering** — grouping assets by TLS configurations to find related infrastructure.
90496. **HTTP Header Profiling** — building technology profiles from header combinations across the surface.
90497. **Cookie Pattern Analysis** — inferring frameworks and session architectures from cookie naming.
90498. **JavaScript Bundle Analysis** — extracting API endpoints and logic hints from client-side code.
90499. **Source Map Discovery** — locating exposed source maps that reveal application structure.
90500. **Comment Intelligence** — mining HTML and code comments for developer notes about hidden functionality.
90501. **Robots and Sitemap Mining** — extracting intended-but-sensitive paths from crawler directives.
90502. **Sitemap Change Tracking** — watching sitemaps over time to spot newly added areas.
90503. **Wayback Machine Recon** — using archived snapshots to discover removed but possibly still-live endpoints.
90504. **Historical Surface Comparison** — diffing current surface against historical snapshots to find drift.
90505. **New Surface Alerts** — notifying when previously unseen assets or endpoints appear for a watched target.
90506. **Surface Growth Tracking** — measuring how a target's attack surface expands or shrinks over time.
90507. **Surface Freshness Scoring** — rating how recently each discovered asset was verified as live.
90508. **Discovery Confidence Ratings** — the agent scoring how sure it is that a discovered asset belongs to the target.
90509. **Ownership Inference** — determining asset ownership from registration, certificates, and content signals.
90510. **Asset Attribution Engine** — assigning discovered assets to organizational units with evidence.
90511. **Discovery Deduplication** — merging multiple discovery signals about the same asset into one record.
90512. **Discovery Prioritization** — ranking newly found surface by hunting value before loop resources are spent.
90513. **Autonomous Discovery Scheduling** — background discovery loops that run continuously between hunts.
90514. **Discovery Budget Controls** — separate resource caps for unsupervised discovery versus active hunting.
90515. **Discovery Safety Rails** — ensuring discovery techniques stay within passive and authorized bounds.
90516. **Discovery Audit Log** — recording every discovery action for scope compliance review.
90517. **Surface Inventory Dashboard** — a living map of everything discovered about a target with verification status.
90518. **Asset Lifecycle Tracking** — following discovered assets from first sighting through verification to hunting.
90519. **Discovery-to-Hunt Handoff** — automatically queuing high-value discovered assets for active hunt loops.
90520. **Cross-Client Surface Correlation** — noticing shared infrastructure patterns across a user's portfolio.
90521. **Industry Surface Benchmarks** — comparing a target's discovered surface size against industry peers.
90522. **Surface Complexity Scoring** — quantifying how tangled a target's surface is to calibrate hunt planning.
90523. **Hidden Surface Estimation** — the agent estimating how much surface remains undiscovered to guide effort.
90524. **Discovery Completeness Metrics** — measuring coverage of known discovery techniques per target.
90525. **Unknown Unknown Tracking** — explicitly logging areas where the agent suspects surface exists but cannot yet see it.
90526. **Autonomous Scope Expansion Governor** — a policy engine that approves or denies scope growth with a full audit trail.
90527. **Scope Expansion Proposals** — agent-generated requests to add discovered assets, with justification and risk notes.
90528. **One-Click Scope Approval** — a streamlined UI for the user to approve or reject expansion proposals.
90529. **Auto-Approved Expansion Rules** — pre-authorized patterns (like same-organization subdomains) the agent may add itself.
90530. **Scope Expansion Confidence** — the agent scoring how certain it is that a new asset is truly in scope.
90531. **Expansion Evidence Packets** — ownership proof bundled with every scope expansion proposal.
90532. **Scope Contraction Triggers** — conditions under which the agent voluntarily narrows scope, like repeated out-of-scope hits.
90533. **Out-of-Scope Learning** — the agent learning boundary patterns to avoid repeated scope violations.
90534. **Scope Violation Prevention** — pre-action checks that block tests against assets outside approved scope.
90535. **Scope Violation Alerts** — immediate notifications if the agent detects it may have touched out-of-scope assets.
90536. **Scope Territory Map** — a visual map showing exactly what is in and out of scope for a hunt.
90537. **Dynamic Scope Documents** — living scope definitions that update as expansions are approved.
90538. **Scope Evolution Timeline** — tracking every scope change with who or what authorized it.
90539. **Scope Diff Reports** — showing what changed in scope between hunts for the same target.
90540. **Scope Inheritance Rules** — child loops automatically inheriting parent campaign scope with modifications logged.
90541. **Scope Templates** — reusable scope definitions for common engagement types.
90542. **Scope from Bounty Programs** — automatically importing and tracking scope from connected bounty platforms.
90543. **Scope Sync Monitoring** — watching bounty program scope pages for changes and updating hunt scope.
90544. **Program Scope Watch** — notifying when an external program modifies its scope mid-campaign.
90545. **Graceful Scope Reduction** — the agent winding down testing on assets removed from scope without losing prior evidence.
90546. **Scope-Limited Evidence** — automatically segregating evidence by the scope version under which it was collected.
90547. **Retroactive Scope Review** — checking completed hunts against final scope to flag any boundary issues.
90548. **Boundary Incident Counter** — grading each loop on how well it stayed within authorized boundaries.
90549. **Scope Negotiation Assistant** — the agent drafting scope clarification questions for the client.
90550. **Wildcard Scope Handling** — special logic for interpreting and bounding wildcard scope definitions.
90551. **Scope Ambiguity Resolver** — a decision tree for resolving unclear scope language conservatively.
90552. **Conservative Default Boundaries** — when in doubt, the agent defaults to the narrower interpretation of scope.
90553. **Scope Expansion Rate Limits** — capping how fast scope can grow to keep human oversight meaningful.
90554. **Expansion Fatigue Prevention** — batching expansion proposals so users are not spammed with approvals.
90555. **Scope Proposal Batching** — grouping related expansion requests into single reviewable bundles.
90556. **Scope Decision SLA** — time limits for expansion approvals before the agent proceeds conservatively.
90557. **Expired Proposal Handling** — automatically withdrawing scope proposals that go unanswered past the SLA.
90558. **Scope Expansion Analytics** — tracking how often expansions yield findings to calibrate future proposals.
90559. **High-Yield Expansion Patterns** — the agent learning which kinds of scope growth historically pay off.
90560. **Scope-Aware Scheduling** — prioritizing newly approved scope areas in the remaining loop budget.
90561. **Scope Freeze Mode** — locking scope for the remainder of a hunt when stability matters more than growth.
90562. **Emergency Scope Override** — a break-glass flow for urgent scope changes with mandatory post-hoc review.
90563. **Scope Override Audit** — detailed logging of every emergency override for compliance.
90564. **Multi-Party Scope Approval** — requiring multiple stakeholders to sign off on large expansions.
90565. **Scope Delegation** — letting trusted team members approve routine expansions on the user's behalf.
90566. **Scope Approval Analytics** — measuring approval latency and patterns to streamline the process.
90567. **Auto-Contraction on Risk** — the agent narrowing scope automatically when target fragility is detected.
90568. **Scope Health Checks** — periodic verification that scope definitions still match reality.
90569. **Dormant Scope Pruning** — removing scope areas with no activity or findings across many loops.
90570. **Scope Revalidation** — re-confirming scope authorization on long-running campaigns at defined intervals.
90571. **Authorization Expiry Tracking** — monitoring when testing authorizations lapse and pausing loops accordingly.
90572. **Reauthorization Workflows** — guided flows for renewing expired testing authorizations.
90573. **Scope Ownership Attribution** — recording which stakeholder authorized each scope element.
90574. **Scope Communication Log** — all scope-related messages with clients preserved alongside the hunt.
90575. **Client Scope Portal** — a shareable view where clients review and approve scope changes.
90576. **Scope-Stamped Findings** — reports clearly delineating which findings fall under which scope version.
90577. **Scope Boundary Testing** — the agent verifying its understanding of boundaries with safe probe requests.
90578. **Boundary Probe Logging** — recording boundary-verification probes separately from hunt evidence.
90579. **Scope Education Mode** — the agent explaining scope decisions to junior users in plain language.
90580. **Scope Policy Engine** — codified organizational policies governing all scope decisions automatically.
90581. **Policy Firewall** — hard blocks preventing any action that violates scope policy.
90582. **Exception Petition Flow** — a formal path for requesting exceptions to scope policies.
90583. **Scope Risk Scoring** — rating each scope element by testing risk to calibrate intensity.
90584. **Sensitive Scope Flagging** — marking production or sensitive assets for extra-cautious handling.
90585. **Scope-Specific Intensity** — different testing aggressiveness per scope zone within one hunt.
90586. **Scope Zone Mapping** — dividing scope into zones (safe, cautious, restricted) with per-zone rules.
90587. **Zone Transition Guards** — checks the agent runs before moving testing from one zone to another.
90588. **Scope Completion Tracking** — measuring tested versus untested scope to report coverage honestly.
90589. **Untestable Scope Logging** — documenting scope areas that could not be tested and why.
90590. **Scope Coverage Attestation** — a signed statement of what scope was actually covered by the hunt.
90591. **Hunt Autopilot Modes** — selectable autonomy levels from supervised to fully hands-off per hunt.
90592. **Copilot Mode** — the agent suggests each next step and waits for user confirmation before acting.
90593. **Supervised Autopilot** — the agent acts freely on low-risk steps but pauses for approval on significant ones.
90594. **Full Autopilot** — the agent runs the entire hunt start to finish with no interruptions.
90595. **Autopilot Mode Switching** — changing autonomy level mid-hunt without losing progress.
90596. **Mode Switch Audit** — logging every autopilot mode change with reason and authorizer.
90597. **Scheduled Autopilot** — hunts that run fully autonomously during defined windows like overnight.
90598. **Long-Haul Autopilot Preset** — an autopilot preset optimized for long unattended weekend hunts.
90599. **Overnight Hunt Mode** — tuning loop behavior for quiet hours: slower pace, batched notifications.
90600. **Silent Running Mode** — autopilot with all non-critical notifications suppressed until completion.
90601. **Checkpoint Mode** — autopilot that pauses at defined milestones for quick human review.
90602. **Milestone Definitions** — user-configurable checkpoints like "recon complete" or "first critical found".
90603. **Checkpoint Digests** — concise updates fired only at milestones, not for every event.
90604. **Milestone Skip Rules** — conditions under which the agent may pass a milestone without waiting.
90605. **Autopilot Confidence Display** — a live indicator of how confident the agent is in its autonomous path.
90606. **Autopilot Intervention Requests** — the agent proactively asking for help when it detects it is stuck.
90607. **Intervention Request Routing** — directing help requests to the right human based on the problem type.
90608. **Intervention Response SLA** — expected human response times with agent fallback behavior if exceeded.
90609. **Graceful Degradation on No Response** — the agent safely continuing or parking when humans do not respond.
90610. **Autopilot Handoff to Human** — cleanly transferring a stuck hunt to a human analyst with full context.
90611. **Human-to-Autopilot Resume** — handing a manually-advanced hunt back to the agent seamlessly.
90612. **Autopilot Learning from Interventions** — the agent studying human takeovers to need fewer of them.
90613. **Intervention Pattern Mining** — finding common triggers for human takeovers to address root causes.
90614. **Autopilot Trust Score** — a per-user metric of how much autonomy they grant based on history.
90615. **Trust-Based Autonomy Scaling** — the agent earning higher autonomy as its track record with a user grows.
90616. **New User Guardrails** — conservative autopilot defaults for accounts with no history.
90617. **Autopilot Onboarding Tour** — a guided first hunt teaching users what each autopilot mode does.
90618. **Mode Recommendation** — the agent suggesting the right autopilot level based on target sensitivity and history.
90619. **Autopilot Safety Briefing** — a pre-hunt summary of what the agent will do unattended in the chosen mode.
90620. **Pre-Flight Autonomy Checklist** — the agent verifying authorization, scope, and budgets before engaging autopilot.
90621. **Autopilot Kill Conditions** — user-defined conditions that automatically disengage autopilot.
90622. **Disengagement Logging** — recording every autopilot disengagement with cause and hunt state.
90623. **Autopilot Incident Playbook** — predefined responses when autopilot encounters unexpected situations.
90624. **Remote Monitoring Dashboard** — a mobile-friendly view for checking autopilot hunts while away.
90625. **Push Alert Triage** — smart phone notifications that distinguish "FYI" from "needs you now".
90626. **Autopilot Daily Digest** — a morning summary of everything the autopilot did overnight.
90627. **Voice Briefing Mode** — spoken summaries of autopilot progress for hands-free monitoring.
90628. **Autopilot Companion App** — a lightweight mobile interface for approving gates and viewing progress.
90629. **Approval from Anywhere** — secure mobile approvals for autopilot gates with biometric confirmation.
90630. **Autopilot Pause from Lock Screen** — one-tap hunt pausing via phone notification actions.
90631. **Geofenced Autopilot Rules** — autonomy restrictions that tighten when the user is unreachable, like on flights.
90632. **Calendar-Aware Autopilot** — the agent checking the user's calendar to pick safe unattended windows.
90633. **Sleep-Friendly Scheduling** — deferring noisy or decision-heavy phases to waking hours.
90634. **Autopilot Energy Saver** — reducing loop intensity during the user's off-hours to save costs.
90635. **Multi-Hunt Autopilot** — one autopilot session managing several concurrent hunts with unified oversight.
90636. **Fleet Autopilot View** — a single screen showing all autopilot hunts across the organization.
90637. **Autopilot Priority Signals** — the agent surfacing which of many autopilot hunts needs attention first.
90638. **Cross-Hunt Learning in Autopilot** — insights from one autopilot hunt improving others running in parallel.
90639. **Autopilot Resource Governor** — ensuring many concurrent autopilot hunts do not exhaust shared budgets.
90640. **Autopilot Queue Management** — intelligent ordering of queued autopilot hunts by value and urgency.
90641. **Autopilot Templates** — saved autopilot configurations for recurring hunt types.
90642. **Autopilot Recipe Exchange** — teams sharing proven autopilot templates with each other.
90643. **Autopilot Version Control** — tracking changes to autopilot configurations over time.
90644. **Autopilot Rollback** — reverting to a previous autopilot configuration when a change misbehaves.
90645. **Autopilot Experimentation** — safely testing new autopilot settings on low-stakes hunts first.
90646. **Autopilot Performance Benchmarks** — comparing autopilot outcomes against manually supervised hunts.
90647. **Autonomy ROI Reports** — quantifying time saved and findings gained through autopilot usage.
90648. **Autopilot Adoption Metrics** — tracking how teams progressively trust higher autonomy levels.
90649. **Autopilot Failure Analysis** — structured reviews of hunts where autopilot underperformed.
90650. **Autopilot Best Practices Guide** — auto-generated guidance from fleet-wide autopilot performance data.
90651. **Autopilot Certification** — formal validation that an autopilot configuration is safe for unattended use.
90652. **Regulated Autopilot Profiles** — prebuilt autopilot settings satisfying specific compliance regimes.
90653. **Autopilot Audit Mode** — a mode that logs extra detail for hunts requiring strict oversight.
90654. **Autopilot Insurance** — explicit risk acceptance records for fully unattended hunts.
90655. **Autopilot Sunset Rules** — automatically ending autopilot hunts that exceed maximum unattended durations.
90656. **Autonomous Re-Test Scheduler** — a system that decides when each finding or target deserves re-verification without prompting.
90657. **Finding Lifecycle Tracking** — following each finding from discovery through verification, reporting, and re-test.
90658. **Fix Verification Queues** — automatically queuing findings for re-testing after the client reports a fix.
90659. **Fix Confirmation Logic** — the agent rigorously verifying a fix actually works, not just that the symptom changed.
90660. **Incomplete Fix Detection** — recognizing when a fix is partial or bypassable and flagging it.
90661. **Regression Re-Test** — re-checking previously fixed findings on a schedule to catch regressions.
90662. **Fix Relapse Warnings** — notifying when a previously fixed vulnerability reappears.
90663. **Re-Test Priority Scoring** — ranking re-tests by finding severity, fix likelihood, and age.
90664. **Re-Test Budget Allocation** — reserving loop capacity specifically for verification of old findings.
90665. **Scheduled Verification Sweeps** — periodic autonomous sweeps that re-verify all open findings for a target.
90666. **Sweep Frequency Tuning** — adjusting re-test cadence per finding based on severity and change likelihood.
90667. **Change-Triggered Re-Tests** — automatically re-testing findings when the target deploys new code or config.
90668. **Deployment Detection** — the agent noticing target deployments through fingerprint and behavior changes.
90669. **Deploy-Aftermath Checks** — immediate re-tests of critical findings right after a detected deployment.
90670. **Canary Re-Testing** — verifying fixes on a small subset before declaring them resolved.
90671. **Before-After Evidence Diffing** — diffing new evidence against original finding evidence to confirm the fix.
90672. **Re-Test Report Addenda** — automatically appending re-test results to the original hunt report.
90673. **Finding Status Automation** — moving findings through open, fixed, verified, and regressed states without manual updates.
90674. **Status Change Notifications** — alerting stakeholders when a finding's verification status changes.
90675. **SLA-Based Re-Test Escalation** — escalating when fixes are not verified within agreed timeframes.
90676. **Client Fix Claims Intake** — a structured way for clients to declare fixes and trigger verification.
90677. **Fix Claim Validation** — the agent sanity-checking fix claims before spending re-test budget.
90678. **Bulk Re-Test Campaigns** — scheduling mass re-verification across many findings or targets at once.
90679. **Re-Test Windows** — designated low-impact times for running verification sweeps.
90680. **Re-Test Throttling** — keeping verification traffic gentle so it never resembles an attack.
90681. **Re-Test Result Confidence** — the agent scoring how conclusive each re-test was.
90682. **Inconclusive Re-Test Handling** — scheduling follow-up verification when a re-test cannot reach a conclusion.
90683. **Re-Test Chains** — verifying that fixing one finding did not break the fix for another.
90684. **Cross-Finding Fix Verification** — checking related findings together since fixes often interact.
90685. **Environment Parity Checks** — ensuring re-tests run against the same environment where the finding was found.
90686. **Environment Drift Alerts** — warning when the re-test environment differs meaningfully from the original.
90687. **Historical Re-Test Archive** — a complete history of every verification attempt per finding.
90688. **Re-Test Analytics** — dashboards showing fix rates, verification times, and regression rates.
90689. **Remediation Craftsmanship Rating** — rating how well clients remediate findings to inform future severity guidance.
90690. **Recurring Finding Detection** — flagging vulnerability classes that keep reappearing despite fixes.
90691. **Systemic Fix Recommendations** — the agent suggesting root-cause fixes when the same bug class recurs.
90692. **Re-Test Cost Tracking** — accounting for the resources consumed by verification loops.
90693. **Re-Test ROI Analysis** — measuring whether scheduled re-tests catch enough regressions to justify their cost.
90694. **Smart Re-Test Skipping** — the agent skipping re-tests with negligible expected value to save budget.
90695. **Re-Test Sampling** — verifying a statistical sample of low-severity fixes instead of every one.
90696. **Continuous Verification Mode** — an always-on mode where the agent perpetually re-verifies a target's findings.
90697. **Verification Coverage Metrics** — tracking what fraction of findings have been re-verified recently.
90698. **Stale Finding Expiry** — retiring findings that cannot be re-verified because the target changed beyond recognition.
90699. **Finding Lineage Tracking** — linking re-test results back through the full history of a finding.
90700. **Re-Test Assignment** — distributing verification work across agent instances for large portfolios.
90701. **Verification Playbooks** — standardized re-test procedures per vulnerability class.
90702. **Playbook Compliance Checks** — ensuring re-tests follow the approved verification procedure.
90703. **Re-Test Peer Review** — a second agent reviewing verification conclusions before status changes.
90704. **Disputed Verification Flow** — a process for resolving disagreements between agent and client on fix status.
90705. **Fix Proof Bar** — defined proof requirements for marking a finding as fixed.
90706. **Screenshot Diff Verification** — comparing visual evidence before and after fixes for UI-level findings.
90707. **Behavioral Fix Verification** — confirming fixes through behavior change rather than just absence of the old signal.
90708. **Negative Testing on Fixes** — the agent trying to bypass the fix to prove it is robust.
90709. **Fix Bypass Reporting** — clearly reporting when a claimed fix can be circumvented.
90710. **Re-Test Scheduling AI** — a model that predicts the optimal re-test moment for each finding.
90711. **Optimal Verification Timing** — balancing early verification against giving clients reasonable fix time.
90712. **Fix-Time Prediction** — the agent estimating how long each fix will take to prioritize scheduling.
90713. **Verification Backlog Health** — monitoring the re-test queue for growing backlogs and adjusting capacity.
90714. **Auto-Scaling Verification** — spinning up more verification capacity when the backlog spikes.
90715. **Re-Test Prioritization UI** — a user-facing view of the verification queue with override controls.
90716. **Verification SLAs by Severity** — different re-test deadlines for critical versus low findings.
90717. **SLA Breach Alerts** — notifications when verification deadlines are missed.
90718. **Client Verification Portal** — a shareable page where clients watch fix verification happen live.
90719. **Verification Transparency Log** — a public-per-client log of every verification attempt and outcome.
90720. **Closed-Loop Remediation** — the full cycle from finding to verified fix managed autonomously end to end.
90721. **Self-Healing Hunt Pipelines** — hunt infrastructure that detects and repairs its own failures without human intervention.
90722. **Pipeline Vital Signs** — continuous checks on every stage of the hunt pipeline for degradation.
90723. **Stage Failure Auto-Recovery** — restarting failed pipeline stages from their last good state automatically.
90724. **Pipeline Circuit Breakers** — halting cascading failures by isolating misbehaving stages.
90725. **Failure Containment Bulkheads** — design patterns that stop one stage's failure from poisoning downstream stages.
90726. **Pipeline Retry Orchestration** — intelligent retry logic with backoff across the whole pipeline.
90727. **Dead Letter Queues** — holding pipeline tasks that repeatedly fail for later analysis instead of dropping them.
90728. **Poison Message Handling** — quarantining tasks that crash workers so they do not block the pipeline.
90729. **Worker Auto-Scaling** — adding or removing hunt workers based on pipeline backlog in real time.
90730. **Worker Health Checks** — each worker proving its liveness and capability before receiving tasks.
90731. **Unhealthy Worker Quarantine** — automatically removing misbehaving workers from the pool.
90732. **Worker Warm Pools** — pre-initialized workers ready to absorb sudden hunt load spikes.
90733. **Pipeline Backpressure** — slowing intake when downstream stages cannot keep up, instead of dropping work.
90734. **Load Shedding Policies** — defined rules for which pipeline work gets dropped first under extreme load.
90735. **Pipeline Priority Lanes** — separate fast lanes for urgent findings through the processing pipeline.
90736. **Stage Timeout Enforcement** — killing stages that exceed their time budget and routing around them.
90737. **Stuck Stage Detection** — identifying stages that are alive but making no progress.
90738. **Pipeline Checkpointing** — persisting pipeline state so crashes resume instead of restart.
90739. **Exactly-Once Processing** — guarantees that pipeline tasks are neither lost nor duplicated after failures.
90740. **Idempotent Stage Design** — stages built so re-running them after a crash is always safe.
90741. **Pipeline State Reconciliation** — periodic audits that fix inconsistencies between pipeline stages.
90742. **Orphaned Task Reaping** — finding tasks abandoned by crashed workers and reassigning them.
90743. **Zombie Process Cleanup** — the pipeline hunting down and killing its own leaked processes.
90744. **Resource Exhaustion Guards** — preventing pipeline stages from consuming all memory, disk, or connections.
90745. **Disk Space Janitor** — automatic cleanup of old pipeline artifacts before disks fill.
90746. **Connection Pool Healing** — detecting and recycling stale or broken connections in shared pools.
90747. **Dependency Health Probes** — the pipeline continuously verifying its external dependencies are responsive.
90748. **Dependency Failover** — switching to backup services when a primary dependency degrades.
90749. **Graceful Dependency Degradation** — continuing hunts with reduced capability when a dependency is down.
90750. **Pipeline Schema Evolution** — handling version changes in inter-stage data formats without breaking.
90751. **Backward Compatibility Shims** — temporary adapters letting old and new stage versions interoperate.
90752. **Rolling Pipeline Upgrades** — updating pipeline components without stopping running hunts.
90753. **Blue-Green Pipeline Deploys** — switching hunt traffic between pipeline versions with instant rollback.
90754. **Pipeline Canary Analysis** — automatically comparing new pipeline version metrics against the old before full rollout.
90755. **Auto-Rollback on Regression** — reverting pipeline upgrades when quality metrics degrade.
90756. **Pipeline Configuration Drift Detection** — alerting when running pipeline config differs from the declared version.
90757. **Config Self-Repair** — restoring pipeline configuration to the declared state automatically.
90758. **Secret Rotation Handling** — the pipeline surviving credential rotations without manual restarts.
90759. **Credential Expiry Recovery** — automatically refreshing or requesting new credentials before they lapse.
90760. **Pipeline Observability Stack** — metrics, logs, and traces unified for every pipeline stage.
90761. **Metric Outlier Spotting** — machine learning that spots abnormal pipeline behavior early.
90762. **Predictive Failure Alerts** — warning of likely pipeline failures before they happen based on trends.
90763. **Self-Tuning Pipeline Parameters** — the pipeline adjusting its own concurrency, timeouts, and batch sizes.
90764. **Performance Regression Detection** — flagging when pipeline stages get slower over successive releases.
90765. **Pipeline Chaos Testing** — deliberately injecting failures to verify self-healing actually works.
90766. **Game Day Drills** — scheduled simulated outages that exercise the pipeline's recovery paths.
90767. **Recovery Time Tracking** — measuring how fast the pipeline heals from each failure class.
90768. **Recovery Point Tracking** — measuring how much work is lost in each failure to minimize it.
90769. **Pipeline Resilience Score** — a composite grade of the pipeline's self-healing capability.
90770. **Resilience Improvement Backlog** — prioritized weaknesses in pipeline self-healing to address.
90771. **Multi-Region Pipeline Failover** — shifting hunt processing to another region when one fails.
90772. **Pipeline Data Replication** — keeping pipeline state replicated so failover loses nothing.
90773. **Partition Authority Arbitration** — ensuring only one pipeline instance is authoritative after network partitions.
90774. **Pipeline Quorum Logic** — requiring agreement among pipeline coordinators before critical actions.
90775. **Pipeline Audit Snapshots** — immutable records of pipeline state at failure moments for post-mortems.
90776. **Failure Injection Safeguards** — ensuring chaos tests can never affect real hunts or targets.
90777. **Pipeline Runbook Automation** — codified operational responses executed automatically on known failures.
90778. **Runbook Effectiveness Tracking** — measuring whether automated runbooks actually resolve incidents.
90779. **Pipeline On-Call Handoff** — structured escalation to humans when self-healing is exhausted.
90780. **Exhaustion Detection** — the pipeline recognizing when it has tried every recovery and needs help.
90781. **Pipeline Freeze on Corruption** — halting everything when data corruption is detected to prevent spread.
90782. **Corruption Containment** — isolating corrupted pipeline data so healthy hunts continue.
90783. **Pipeline Data Repair** — automated reconstruction of corrupted intermediate results where possible.
90784. **Healing Transparency Reports** — user-visible summaries of what the pipeline fixed by itself.
90785. **Pipeline Self-Test Suite** — a battery of tests the pipeline runs on itself after every recovery.
90786. **Autonomous Evidence Triage** — the agent sorting raw observations into findings, noise, and leads without human help.
90787. **Evidence Ingestion Pipeline** — structured intake that normalizes every artifact the hunt collects.
90788. **Evidence Uniqueness Filter** — merging duplicate evidence items that describe the same underlying issue.
90789. **Near-Duplicate Detection** — recognizing evidence that is similar but distinct enough to matter.
90790. **Evidence Clustering** — grouping related evidence so analysts see coherent stories, not fragments.
90791. **Evidence-to-Finding Linker** — automatically attaching each evidence item to the finding it supports.
90792. **Orphaned Evidence Review** — periodically examining evidence not linked to any finding for missed connections.
90793. **Evidence Quality Scoring** — rating each artifact on clarity, reproducibility, and evidentiary value.
90794. **Low-Quality Evidence Quarantine** — holding weak evidence out of reports until strengthened.
90795. **Evidence Strengthening Tasks** — the agent generating follow-up tasks to improve weak but promising evidence.
90796. **Evidence Expiry Watch** — flagging evidence that may be stale due to target changes.
90797. **Evidence Revalidation** — re-collecting evidence that has aged past its reliability window.
90798. **Evidence Provenance Ledger** — tracking every touch of an evidence item from collection to report.
90799. **Tamper-Evident Evidence Store** — cryptographic sealing of evidence so its integrity is provable.
90800. **Evidence Shelf-Life Manager** — automatic lifecycle rules for how long evidence is kept per severity and client.
90801. **Evidence Redaction Engine** — automatically masking secrets and PII accidentally captured in evidence.
90802. **PII Detection in Evidence** — scanning collected artifacts for personal data before storage.
90803. **Need-to-Know Evidence Gates** — role-based permissions governing who can view sensitive evidence.
90804. **Expiring Evidence Passes** — time-limited secure links for sharing specific evidence with clients.
90805. **Evidence Annotation** — the agent adding explanatory notes to evidence for human reviewers.
90806. **Evidence Timeline Builder** — assembling evidence into a chronological narrative of the finding.
90807. **Evidence Comparison View** — side-by-side display of related evidence items for quick assessment.
90808. **Evidence Search** — full-text and metadata search across all collected evidence.
90809. **Evidence Tagging** — automatic tags like "reproducible", "screenshot", "network-log" applied at ingestion.
90810. **Custom Evidence Views** — user-defined filtered views over the evidence store.
90811. **Evidence Export Packs** — one-click bundles of all evidence for a finding in a portable format.
90812. **Leak-Tracing Evidence Marks** — invisible marks proving the provenance of exported evidence files.
90813. **Screenshot Triage AI** — the agent judging which screenshots actually demonstrate a vulnerability.
90814. **Log Triage Automation** — extracting the relevant lines from verbose logs without human sifting.
90815. **Network Capture Summarization** — condensing packet captures into readable request-response narratives.
90816. **Video Evidence Clipping** — automatically clipping the key seconds from hunt session recordings.
90817. **Evidence Highlighting** — the agent marking the exact bytes or pixels that prove each finding.
90818. **Diff-Based Evidence** — presenting evidence as before/after diffs for maximum clarity.
90819. **Replay Kits for Findings** — bundling everything needed for a third party to reproduce the finding.
90820. **One-Click Reproduction** — a button that replays the exact steps that produced a finding.
90821. **Reproduction Environment Notes** — recording the precise conditions under which evidence was captured.
90822. **Flaky Evidence Detection** — identifying findings that reproduce inconsistently and flagging them.
90823. **Intermittent Finding Handling** — special workflows for vulnerabilities that only manifest sometimes.
90824. **Evidence Contradiction Flags** — alerting when new evidence contradicts previously accepted proof.
90825. **Corroborating Evidence Finder** — the agent actively seeking independent confirmation for thin evidence.
90826. **Independent Verification Tasks** — scheduling separate agent runs to confirm high-stakes findings.
90827. **Evidence Consensus Rules** — requiring multiple evidence types to agree before critical findings are finalized.
90828. **Single-Source Evidence Warnings** — flagging findings supported by only one evidence type.
90829. **Evidence Gap Analysis** — the agent identifying what proof is still missing for each open finding.
90830. **Evidence Collection Planner** — generating the minimal additional tests needed to close evidence gaps.
90831. **Triage Priority Queue** — ordering evidence review by finding severity and evidence completeness.
90832. **Triage Turnaround Monitor** — ensuring evidence gets triaged within defined timeframes.
90833. **Observation-to-Finding Velocity** — measuring how fast the agent processes raw observations into findings.
90834. **Triage Accuracy Audits** — sampling triage decisions to measure and improve correctness.
90835. **Human Triage Override** — letting analysts correct the agent's triage with feedback fed back into models.
90836. **Triage Model Retraining** — periodically retraining triage models on corrected decisions.
90837. **False-Positive Triage Tuning** — adjusting triage thresholds based on measured false-positive rates.
90838. **False-Negative Hunting** — deliberately searching discarded observations for wrongly rejected findings.
90839. **Triage Calibration Sets** — known-good labeled evidence used to calibrate triage accuracy.
90840. **Evidence Triage Explainability** — the agent explaining why each item was classified the way it was.
90841. **Triage Decision Broadcasting** — applying the same triage decision to clusters of similar evidence at once.
90842. **Triage Undo** — reverting triage decisions with full history preserved.
90843. **Evidence Versioning** — tracking revisions when evidence is re-collected or enhanced.
90844. **Evidence Merge Conflicts** — resolving when two agent runs produce conflicting evidence for the same finding.
90845. **Cross-Hunt Evidence Linking** — connecting evidence across hunts that describes the same underlying issue.
90846. **Evidence Knowledge Graph** — a graph linking findings, evidence, assets, and techniques for exploration.
90847. **Graph-Based Triage** — using the knowledge graph to spot findings the agent has not yet connected.
90848. **Evidence-Driven Hunt Steering** — letting triage results redirect the active hunt toward promising leads.
90849. **Triage Feedback to Recon** — telling the recon stage what evidence was useful so it collects better data.
90850. **Triage Outcome Reports** — summaries of triage decisions per hunt for transparency.
90851. **Agent-Initiated Deep Dives** — the agent deciding on its own to investigate a lead far beyond the original plan.
90852. **Deep-Dive Trigger Conditions** — defined signals like anomalous behavior that authorize intensive investigation.
90853. **Deep-Dive Budget Requests** — the agent justifying extra time for a promising lead with expected value.
90854. **Deep-Dive Budget Fencing** — strict limits preventing deep dives from consuming the whole hunt.
90855. **Deep-Dive Exit Criteria** — clear conditions for when a deep dive ends, successfully or not.
90856. **Deep-Dive Progress Reports** — periodic updates while a deep dive is running so it never goes dark.
90857. **Nested Deep Dives** — a deep dive spawning its own sub-investigation with merged results.
90858. **Deep-Dive Priority Preemption** — a high-value lead pausing routine work for immediate deep investigation.
90859. **Lead Promise Scoring** — the agent estimating a lead's potential before committing deep-dive resources.
90860. **Lead Cooling** — parking leads that look promising but lack immediate evidence, with automatic revisit.
90861. **Lead Warming Alerts** — notifying when new evidence makes a parked lead worth revisiting.
90862. **Deep-Dive Technique Arsenal** — the full set of intensive methods available for deep investigations.
90863. **Technique Sequencing** — the agent ordering deep-dive techniques from least to most intensive.
90864. **Deep-Dive State Tracking** — maintaining rich state across long investigations spanning hours.
90865. **Investigation Journaling** — the agent keeping a running log of hypotheses and tests during deep dives.
90866. **Journal Summarization** — condensing long investigation journals into readable narratives.
90867. **Deep-Dive Collaboration** — multiple agent instances cooperating on different angles of one lead.
90868. **Angle Assignment** — dividing a deep dive into parallel investigative angles with a merge step.
90869. **Deep-Dive Merge Logic** — combining parallel investigation results into a coherent conclusion.
90870. **Contradictory Angle Resolution** — reconciling when parallel angles reach different conclusions.
90871. **Deep-Dive Evidence Standards** — higher proof bars for claims emerging from intensive investigations.
90872. **Extraordinary Claim Protocols** — extra verification required before reporting exceptional findings.
90873. **Deep-Dive Peer Challenge** — a second agent stress-testing deep-dive conclusions before acceptance.
90874. **Premature Deep-Dive Prevention** — stopping the agent from diving deep before basic recon is complete.
90875. **Shallow-First Policy** — requiring broad coverage before any single lead gets intensive attention.
90876. **Deep-Dive Quotas** — limiting how many simultaneous deep dives one hunt may run.
90877. **Deep-Dive Starvation Guard** — ensuring routine coverage is not entirely crowded out by deep dives.
90878. **Opportunistic Deep Dives** — using idle loop capacity for speculative deep investigations.
90879. **Scheduled Deep Dives** — user-requested intensive investigations on specific areas or findings.
90880. **Deep-Dive Request Queue** — a backlog where users or agents propose leads for deep investigation.
90881. **Deep-Dive ROI Tracking** — measuring findings per hour of deep-dive investment to calibrate triggers.
90882. **Deep-Dive Pattern Learning** — the agent learning which lead characteristics predict successful deep dives.
90883. **Successful Dive Archetypes** — a library of deep-dive patterns that historically produced findings.
90884. **Dive Archetype Matching** — matching new leads against archetypes to decide dive-worthiness.
90885. **Deep-Dive Debrief Generator** — auto-written summaries of what each deep dive tried and learned.
90886. **Failed Dive Analysis** — extracting lessons from deep dives that found nothing.
90887. **Dive Fatigue Detection** — recognizing when repeated deep dives on a target stop paying off.
90888. **Dive Pivot Recommendations** — the agent suggesting new angles when a deep dive stalls.
90889. **External Intel for Dives** — automatically pulling threat intel relevant to an active deep dive.
90890. **Dive-Specific Tooling** — spinning up specialized tools or environments for a particular investigation.
90891. **Isolated Dive Sandboxes** — running risky deep-dive techniques in isolated environments.
90892. **Dive Safety Monitors** — watching deep dives for unintended target impact with auto-throttle.
90893. **Deep-Dive Notifications** — alerting the user when the agent starts, progresses, or completes a deep dive.
90894. **Dive Opt-Out Controls** — letting users forbid autonomous deep dives on sensitive targets.
90895. **Dive Approval Gates** — requiring approval before deep dives on production or high-risk assets.
90896. **Deep-Dive Audit Trail** — complete records of autonomous deep-dive decisions and actions.
90897. **Dive Cost Attribution** — tracking exactly how much each deep dive cost in time and requests.
90898. **Dive Budget Alerts** — warning when a deep dive approaches its allocated budget.
90899. **Cross-Target Dive Insights** — applying a successful deep-dive technique to similar leads on other targets.
90900. **Dive Technique Effectiveness** — measuring which intensive methods produce findings most reliably.
90901. **Adaptive Dive Intensity** — the agent modulating deep-dive aggressiveness based on target tolerance.
90902. **Dive Recovery Points** — checkpoints within long deep dives enabling resume after interruption.
90903. **Interrupted Dive Resume** — cleanly continuing a deep dive that was paused or crashed.
90904. **Dive Result Propagation** — feeding deep-dive learnings back into the main hunt strategy immediately.
90905. **Strategic Dive Planning** — the agent planning deep dives as part of overall hunt strategy, not just reactively.
90906. **Dive Portfolio View** — a dashboard of all active and past deep dives with outcomes.
90907. **Dive Comparison Analytics** — comparing deep-dive approaches across hunts to find best practices.
90908. **Dive Playbook Library** — codified deep-dive procedures for common lead types.
90909. **Community Dive Patterns** — shared deep-dive strategies rated by the user community.
90910. **Dive Mentorship Mode** — the agent explaining its deep-dive reasoning to teach human analysts.
90911. **Analyst Dive Shadowing** — humans observing agent deep dives live to learn techniques.
90912. **Dive Replay for Training** — replaying recorded deep dives as training material for junior analysts.
90913. **Deep-Dive Certification** — validating that the agent's deep-dive capability meets quality bars.
90914. **Dive Quality Scoring** — grading deep dives on thoroughness, creativity, and evidence quality.
90915. **Elite Dive Recognition** — highlighting exceptional autonomous investigations as exemplars.
90916. **Autonomous Campaign Management** — the agent planning and running multi-target, multi-week hunting campaigns end to end.
90917. **Campaign Objective Setting** — translating business goals into concrete campaign plans with milestones.
90918. **Campaign Blueprint Library** — reusable campaign structures for common objectives like pre-launch or compliance.
90919. **Campaign Timeline Planner** — the agent scheduling hunts, re-tests, and reports across a campaign calendar.
90920. **Campaign Milestone Tracking** — live progress against campaign milestones with forecasts.
90921. **Campaign Resource Planning** — allocating loop capacity, budgets, and agent time across campaign targets.
90922. **Campaign Budget Management** — tracking and controlling spend across all hunts in a campaign.
90923. **Campaign Threat Board** — the agent maintaining a list of campaign risks with mitigation plans.
90924. **Campaign Stakeholder Map** — identifying everyone who needs updates and tailoring communication per stakeholder.
90925. **Campaign Communication Plan** — automated status updates at the right cadence for each audience.
90926. **Campaign Kickoff Automation** — the agent preparing scope, schedules, and notifications when a campaign starts.
90927. **Campaign Target Sequencing** — ordering targets within a campaign for maximum learning transfer.
90928. **Campaign Wave Planning** — organizing hunts into waves so early results inform later targeting.
90929. **Wave Retrospectives** — the agent reviewing each wave's results before planning the next.
90930. **Campaign Learning Loops** — systematically applying lessons from finished hunts to upcoming ones.
90931. **Campaign-Wide Pattern Detection** — spotting vulnerability patterns recurring across campaign targets.
90932. **Systemic Issue Flagging** — the agent identifying organization-wide weaknesses from cross-target patterns.
90933. **Campaign Finding Deduplication** — recognizing the same root cause manifesting across multiple targets.
90934. **Root Cause Campaign Analysis** — tracing widespread findings back to shared components or practices.
90935. **Campaign Severity Calibration** — ensuring severity ratings are consistent across all campaign hunts.
90936. **Campaign Report Rollup** — merging individual hunt reports into one coherent campaign report.
90937. **Executive Campaign Summary** — a leadership-level view of campaign outcomes, risks, and trends.
90938. **Cross-Campaign Trajectory Review** — comparing current campaign results against previous campaigns.
90939. **Campaign Peer Comparison** — measuring campaign performance against industry or historical baselines.
90940. **Campaign Pulse Index** — a composite indicator of campaign progress, quality, and risk.
90941. **Campaign Early Warning** — the agent flagging campaigns likely to miss objectives in time to intervene.
90942. **Campaign Recovery Plans** — agent-generated plans to rescue underperforming campaigns.
90943. **Campaign Cryo-Freeze** — freezing an entire campaign and restarting it later with context intact.
90944. **Campaign Scope Evolution** — managing how campaign scope grows or shrinks over its lifetime.
90945. **Campaign Change Control** — formal tracking of every change to campaign plans, targets, or goals.
90946. **Campaign Approval Workflows** — routing major campaign decisions to the right approvers.
90947. **Campaign Audit Trail** — complete records of campaign decisions for compliance and review.
90948. **Campaign Access Controls** — role-based permissions over who can view or modify campaigns.
90949. **Multi-Team Campaigns** — coordinating several teams' agents hunting different parts of one campaign.
90950. **Team Workload Balancing** — the agent distributing campaign work fairly across teams and instances.
90951. **Inter-Team Discovery Broadcast** — ensuring one team's discovery immediately benefits other teams' hunts.
90952. **Campaign Conflict Resolution** — resolving when teams' hunts interfere or duplicate effort.
90953. **Campaign Standup Summaries** — auto-generated daily briefings on campaign status for the team.
90954. **Campaign Retrospective Generator** — comprehensive post-campaign reviews with lessons and metrics.
90955. **Campaign Knowledge Capture** — preserving campaign learnings in a searchable organizational memory.
90956. **Campaign Template Evolution** — improving campaign blueprints based on retrospective outcomes.
90957. **Recurring Campaign Scheduler** — automatically launching periodic campaigns like quarterly assessments.
90958. **Campaign Seasonality** — the agent timing campaigns around business cycles and change freezes.
90959. **Campaign Blackout Coordination** — ensuring no campaign activity during client-declared blackouts.
90960. **Stakeholder Update Tuning** — per-stakeholder controls over campaign update frequency and channel.
90961. **Campaign Escalation Matrix** — defined paths for raising campaign issues by severity and type.
90962. **Campaign SLA Management** — tracking service commitments across the campaign lifecycle.
90963. **Campaign Spend Projection** — predicting total campaign cost from early hunt data.
90964. **Campaign ROI Reporting** — relating campaign findings value to campaign cost for stakeholders.
90965. **Campaign Pause Triggers** — automatic campaign pauses on critical incidents or scope disputes.
90966. **Campaign Incident Response** — the agent managing its own operational incidents during campaigns.
90967. **Campaign Data Retention** — lifecycle policies for campaign data balancing utility and privacy.
90968. **Campaign Time Capsules** — packaging finished campaigns with all evidence, reports, and learnings.
90969. **Campaign Blueprint Replication** — launching a new campaign from a previous one's structure with one click.
90970. **Campaign Comparison View** — side-by-side metrics across multiple campaigns.
90971. **Campaign Portfolio Dashboard** — overseeing all active campaigns in one operations view.
90972. **Campaign Prioritization** — the agent ranking campaigns by business value when resources are constrained.
90973. **Campaign Resource Contention** — resolving competition for agent capacity between campaigns fairly.
90974. **Campaign Preemption Rules** — letting critical campaigns borrow resources from lower-priority ones.
90975. **Campaign Fairness Monitor** — ensuring no campaign is starved of resources indefinitely.
90976. **Inter-Campaign Linkage Map** — tracking dependencies between campaigns, like shared targets or teams.
90977. **Campaign Handoff Protocols** — transferring campaign ownership between teams or agents cleanly.
90978. **Campaign Continuity Planning** — ensuring campaigns survive agent restarts, failures, or personnel changes.
90979. **Campaign Phoenix Restore** — restoring full campaign state from backups after catastrophic failure.
90980. **Campaign Simulation Mode** — dry-running a campaign plan against historical data to validate it.
90981. **Campaign Scenario Modeling** — the agent modeling how plan changes would affect campaign outcomes.
90982. **Campaign Optimization Engine** — continuously improving campaign plans as real results arrive.
90983. **Campaign Autonomy Levels** — per-campaign settings for how independently the agent may manage it.
90984. **Campaign Human Checkpoints** — scheduled human reviews built into long autonomous campaigns.
90985. **Campaign Trust Calibration** — adjusting campaign autonomy based on the agent's track record.
90986. **Campaign Satisfaction Tracking** — measuring stakeholder satisfaction with autonomous campaign management.
90987. **Campaign Feedback Loops** — systematically collecting and acting on stakeholder feedback mid-campaign.
90988. **Campaign Adaptation Speed** — measuring how quickly the agent adjusts campaign plans to new information.
90989. **Campaign Experiment Journal** — recording novel strategies the agent tried during campaigns and their results.
90990. **Campaign Best Practice Extraction** — distilling reusable management patterns from successful campaigns.
90991. **Campaign Maturity Model** — stages of campaign management sophistication for teams to progress through.
90992. **Campaign Certification** — formal validation that a campaign was run to professional standards.
90993. **Campaign Compliance Packs** — prebuilt evidence bundles proving campaign compliance for auditors.
90994. **Campaign Legacy Reports** — long-term outcome tracking showing whether campaign findings stayed fixed.
90995. **Campaign Alumni Network** — connecting stakeholders from past campaigns to share long-term security outcomes.
90996. **Campaign Anniversary Reviews** — the agent revisiting old campaigns annually to assess lasting impact.
90997. **Campaign Storytelling Mode** — auto-generated narratives that make campaign results compelling for executives.
90998. **Campaign Gamification** — team leaderboards and achievements that make campaign participation engaging.
90999. **Analyst Apprenticeship Placement** — matching junior analysts with agent-run campaigns to accelerate learning.
91000. **Campaign Skill Transfer** — structured extraction of analyst skills demonstrated during campaigns.
91001. **Autonomous Campaign Sunset** — the agent gracefully winding down campaigns that met all objectives.
91002. **Campaign Success Criteria Engine** — formal, measurable definitions of campaign success set at kickoff.
91003. **Campaign Outcome Attestation** — signed agent statements certifying what each campaign achieved and covered.
91004. **Self-Running Security Program** — the ultimate vision where campaigns chain perpetually, keeping the organization continuously hunted without human scheduling.
