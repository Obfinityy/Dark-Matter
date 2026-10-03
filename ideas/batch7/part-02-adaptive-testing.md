# Dark-Matter Ideation — Batch 7, Category 2: Adaptive Testing (61005–62004)

61005. **Finding-rate-drop trigger** — Automatically propose a strategy switch when confirmed findings per hour fall below the hunt's rolling baseline for a configurable window.
61006. **Error-spike trigger** — Detect sudden surges in 4xx/5xx or timeout responses and pivot from active probing to passive fingerprinting until the target stabilizes.
61007. **Coverage-plateau trigger** — Switch tactics when new-endpoint discovery stalls for N consecutive minutes despite continued crawling effort.
61008. **Response-anomaly trigger** — Flag statistically unusual response latencies or sizes as a cue to shift from breadth scanning to targeted anomaly investigation.
61009. **WAF-signature trigger** — Recognize block-page fingerprints or challenge responses mid-hunt and swap in the low-and-slow stealth strategy automatically.
61010. **Session-decay trigger** — Monitor auth token freshness and switch to re-authentication or session-refresh workflows before probes start failing silently.
61011. **Rate-limit-encounter trigger** — Treat 429 bursts as a switch signal that throttles concurrency and rotates to a patience-first request pacing strategy.
61012. **Deploy-detected trigger** — Spot asset-hash or banner changes indicating a target redeploy, then re-run fingerprinting before resuming the prior strategy.
61013. **New-tech-fingerprint trigger** — When recon uncovers an unanticipated framework or service, hot-swap in the matching technology-specific test pack.
61014. **Honeypot-suspicion trigger** — If responses look deliberately deceptive (too-perfect errors, instant blocks), switch to a verification-first strategy that confirms target authenticity.
61015. **Switch-hysteresis policy** — Require trigger conditions to persist past a dampening window so brief noise never causes strategy flapping.
61016. **Switch-cooldown window** — Enforce a minimum dwell time after each strategy change before another switch can fire, preventing thrash cascades.
61017. **Multi-signal quorum policy** — Only switch when at least two independent signals agree, reducing false pivots from single noisy indicators.
61018. **Switch-cost estimator** — Score the expected cost of changing strategies (queue rebuild, lost context) and block switches whose cost exceeds projected gain.
61019. **Escalation-ladder policy** — Define ordered fallback strategies so each switch moves one rung (e.g., aggressive → balanced → stealth) rather than jumping randomly.
61020. **Time-bounded trial switches** — Run a candidate strategy for a fixed trial period, then auto-revert if its finding rate underperforms the incumbent.
61021. **User-defined trigger rules** — Let researchers write custom switch conditions in a simple rule DSL with access to live hunt metrics.
61022. **Target-type policy packs** — Ship default switch policies tuned per target archetype (SPA, REST API, legacy monolith, e-commerce).
61023. **Risk-weighted trigger scoring** — Weight each trigger by the business risk of a wrong switch, so high-stakes pivots demand stronger evidence.
61024. **Cross-brain switch voting** — Require the hacking brain and control brain to vote on major strategy changes, with ties resolved by the configured tiebreaker.
61025. **Strategy-portfolio library** — Maintain a versioned catalog of named hunt strategies (e.g., "Silent Cartographer", "Logic Bloodhound") selectable per hunt phase.
61026. **Phase-to-portfolio mapping** — Auto-assign strategies from the portfolio to recon, mapping, probing, validation, and chaining phases with per-phase overrides.
61027. **Strategy blending** — Run weighted hybrids of two strategies (e.g., 70% stealth recon + 30% aggressive probing) instead of hard switching.
61028. **Portfolio-performance registry** — Record every strategy's historical finding yield per target type so future hunts pick proven winners.
61029. **Strategy tagging and filters** — Tag strategies by noise level, speed, depth, and tech fit, then filter the portfolio to match hunt constraints.
61030. **Custom-strategy authoring** — Provide a builder for composing new strategies from primitive tactics, probes, and pacing rules without code.
61031. **Strategy versioning** — Version every strategy definition so hunts can pin, diff, and roll back strategy content itself.
61032. **Deprecated-strategy retirement** — Flag strategies whose recent yields collapsed and quarantine them from auto-selection until re-validated.
61033. **Portfolio-recommendation engine** — Suggest the best-fit strategy portfolio at hunt start based on target fingerprint and past similar hunts.
61034. **Strategy-compatibility matrix** — Declare which strategies can follow which others, blocking incoherent sequences like stealth → loud fuzzing.
61035. **Strategy checkpoint snapshots** — Freeze queues, scores, blacklists, and coverage maps before every switch so the prior state is fully restorable.
61036. **One-click rollback** — Restore the exact pre-switch strategy and state with a single action from the hunt timeline.
61037. **Partial rollback** — Revert only the tactic layer while keeping newly learned fingerprints and payload rankings from the abandoned strategy.
61038. **Rollback auto-triggers** — Define conditions (e.g., zero findings in trial window, error surge) that automatically roll back a fresh switch.
61039. **Switch-audit trail** — Log every strategy change with trigger, rationale, actor (agent or user), and outcome for post-hunt review.
61040. **State-restore verification** — After rollback, run a consistency check confirming queues, sessions, and coverage maps match the snapshot.
61041. **Rollback drills** — Periodically simulate a switch-and-rollback in a sandbox target to prove the mechanism works before real hunts need it.
61042. **Rollback-impact preview** — Show what will be lost and kept if the user confirms a rollback, before it executes.
61043. **Checkpoint-retention policy** — Keep per-hunt strategy snapshots for a configurable period, then compress them into switch summaries.
61044. **Rollback-worthiness scoring** — After each rollback, score whether it improved finding rate, feeding the switch-policy learner.
61045. **Cross-strategy state transfer** — Migrate live context (active sessions, in-flight probes) between strategies without dropping work.
61046. **Confidence-score portability** — Carry endpoint confidence scores across strategy switches so hard-won knowledge is never recomputed.
61047. **Heat-map handoff** — Pass the live finding-heat map to the incoming strategy so it starts with full situational awareness.
61048. **Payload-ranking inheritance** — Let the new strategy inherit the old one's live payload effectiveness rankings instead of starting cold.
61049. **Queue migration on switch** — Re-prioritize the pending probe queue through the incoming strategy's lens rather than discarding it.
61050. **Blacklist carryover** — Preserve rate-limited, blocked, or dead endpoints across switches so the new strategy doesn't repeat forbidden work.
61051. **Learned-signature transfer** — Hand off discovered WAF signatures, framework fingerprints, and custom headers to the incoming strategy.
61052. **Session-continuity guarantee** — Keep authenticated sessions alive across strategy switches with seamless token reuse.
61053. **Knowledge-distillation on switch** — Compress the outgoing strategy's session learnings into a compact brief the incoming strategy can ingest.
61054. **Transfer-quality scoring** — Measure how much transferred context the new strategy actually uses, improving future handoff design.
61055. **Mid-hunt plan regeneration** — Rebuild the remaining hunt plan from scratch when accumulated signals invalidate the original plan's assumptions.
61056. **Plan-diff visualization** — Show side-by-side what changed between the old and regenerated plan so the user sees exactly what adapted.
61057. **Major-switch approval gate** — Pause for user confirmation before high-impact switches (e.g., stealth → aggressive) while auto-approving minor ones.
61058. **Switch-rationale narration** — Generate a plain-language explanation of why the strategy changed, shown in the hunt timeline and mid-hunt chat.
61059. **Strategy timeline** — Render a visual timeline of which strategy was active when, annotated with triggers and finding markers.
61060. **Alternative-strategy preview** — Simulate the likely outcome of candidate strategies on current state before committing to one.
61061. **What-if switch simulation** — Dry-run a proposed switch against historical data from similar hunts to estimate its finding lift.
61062. **Re-plan frequency governor** — Cap how often the full plan may regenerate per hour to keep the hunt stable and reviewable.
61063. **Plan-stability score** — Track how much of the plan survives each adaptation cycle as a health metric for strategy design.
61064. **Switch notifications** — Push concise strategy-change alerts to the user with the option to veto within a short window.
61065. **Trigger-signal dashboard** — Display live values of every switch trigger with thresholds, so users see switches coming before they fire.
61066. **Trigger-sensitivity tuning** — Provide per-trigger sensitivity sliders that trade responsiveness against false-switch risk.
61067. **Trigger false-positive tracking** — Record switches that produced no benefit and auto-suggest sensitivity reductions for their triggers.
61068. **Signal-health monitors** — Watch the trigger inputs themselves for staleness or sensor failure, and degrade gracefully when a signal dies.
61069. **Custom-signal plugins** — Let advanced users register new trigger signals (webhooks, custom metrics) that the switch engine can consume.
61070. **Signal-correlation view** — Show which triggers tend to fire together, revealing redundant signals to merge or prune.
61071. **Trigger-test sandbox** — Replay a recorded hunt's signal stream against new trigger settings to validate tuning without a live target.
61072. **Signal-latency measurement** — Track the delay between a real condition and its trigger firing, and optimize slow signal paths.
61073. **Trigger marketplace** — Share community-built trigger packs (e.g., "e-commerce switch pack") that users can install into their hunts.
61074. **Signal export for analysis** — Export the full trigger signal time-series per hunt for offline tuning and research.
61075. **Oscillation detector** — Identify A→B→A strategy ping-ponging and force a stabilizing choice with a mandatory dwell period.
61076. **Per-hunt switch budget** — Limit the total number of strategy switches per hunt, spending them where expected gain is highest.
61077. **Thrashing circuit breaker** — Trip a breaker that freezes strategy changes for a cooldown when switches exceed a rate threshold.
61078. **Minimum-dwell enforcement** — Guarantee every adopted strategy runs long enough to produce a measurable signal before it can be replaced.
61079. **Switch-fatigue alerts** — Warn the user when the agent is switching unusually often, suggesting manual review of trigger settings.
61080. **Critical-phase strategy lock** — Lock the strategy during delicate phases (e.g., active chaining) so no mid-flight switch can corrupt evidence.
61081. **Safe-mode fallback strategy** — Define a conservative default strategy the hunt drops into whenever the switch engine itself errors.
61082. **Switch-preconditions checklist** — Verify session health, queue integrity, and budget headroom before any switch is allowed to execute.
61083. **Post-switch stabilization window** — Give the new strategy a protected warmup period where its performance isn't judged against the old one.
61084. **Switch-rehearsal mode** — Practice strategy transitions on a mirrored staging target before allowing them on production hunts.
61085. **Brain-disagreement resolver** — When hacking and control brains want different strategies, run a structured arbitration with logged reasoning.
61086. **Control-brain veto right** — Let the execution brain veto a switch it cannot safely perform (e.g., missing tooling), with automatic fallback selection.
61087. **Hacking-brain strategy bids** — Have the strategy brain submit ranked strategy bids with expected-yield estimates for the arbiter to choose from.
61088. **Dual-brain switch protocol** — Define a handshake where both brains acknowledge state transfer before the switch commits.
61089. **Brain-confidence fusion** — Combine both brains' confidence in a switch decision into a single fused score with disagreement flags.
61090. **Strategy-arbitration log** — Keep a dedicated log of inter-brain strategy disputes and their resolutions for tuning the arbitration rules.
61091. **Brain-specific strategy pools** — Maintain separate strategy portfolios optimized for the hacking brain's planning style versus the control brain's execution style.
61092. **Cross-brain trigger sharing** — Propagate triggers observed by one brain (e.g., control brain sees CAPTCHA) instantly to the other's switch engine.
61093. **Brain-health-gated switching** — Block strategy switches when either brain reports degraded performance until health recovers.
61094. **Strategy-handoff packets** — Package outgoing strategy state into a structured packet the incoming strategy's brain can parse deterministically.
61095. **Meta-strategy scheduler** — Run a higher-level scheduler that plans which strategies run in which hunt phases before the hunt begins.
61096. **Strategy-of-strategies optimizer** — Use hunt outcomes to optimize the sequencing rules themselves, not just the individual strategies.
61097. **Historical-switch mining** — Mine past hunt logs for switch patterns that preceded breakthroughs and promote them into default policies.
61098. **Switch-outcome learning** — Train a model on switch contexts and their results to predict whether a proposed switch will help.
61099. **Portfolio-rebalancing engine** — Periodically reweight the strategy portfolio based on recent win rates across the fleet of hunts.
61100. **Hunt-phase strategy templates** — Ship phase templates (recon-heavy start, logic-heavy middle, validation-heavy end) that auto-wire strategy portfolios.
61101. **Adaptive-strategy mutation** — Let the agent propose small mutations to strategy parameters mid-hunt and keep the ones that improve yield.
61102. **Strategy-fitness scoring** — Score each strategy on findings, stealth, speed, and coverage to rank the portfolio objectively.
61103. **Switch-policy A/B testing** — Experiment with competing switch policies on mirrored hunts to discover better adaptation rules.
61104. **Strategy-lifecycle manager** — Govern strategies from draft through validation, production, deprecation, and archival with clear ownership.
61105. **Live-confidence scoring engine** — Maintain a per-endpoint 0–100 confidence score that updates after every probe and drives how deep the agent digs.
61106. **Shallow-sweep pass design** — Run a fast first pass over all endpoints with minimal probes to establish baseline confidence before any deep dive.
61107. **Deep-dive confidence gate** — Require an endpoint's confidence to cross a threshold before unlocking expensive multi-step attack chains against it.
61108. **Per-area depth budgets** — Allocate a fixed probe budget per URL subtree, scaled by that area's aggregate confidence score.
61109. **Confidence-decay over time** — Reduce endpoint confidence as minutes pass without fresh evidence, forcing periodic re-validation of stale areas.
61110. **Confirmation-probe ladders** — Escalate probe intensity in fixed rungs (passive → single probe → multi-vector → chained) as confidence climbs.
61111. **Depth-meter visualization** — Show a per-endpoint depth gauge in the hunt UI so the user sees exactly how deep each area has been tested.
61112. **Confidence-weighted queue ordering** — Sort the probe queue by expected information gain, computed from current confidence and probe cost.
61113. **Low-confidence quarantine list** — Park endpoints whose confidence stays low after the shallow sweep so they stop consuming deep-dive budget.
61114. **Depth-reclamation policy** — Pull back unspent depth budget from areas that resolved cleanly and redistribute it to rising-confidence zones.
61115. **Bayesian confidence updater** — Treat each probe result as Bayesian evidence, updating endpoint vulnerability probability with proper priors per tech stack.
61116. **Confidence floor for reporting** — Only surface findings from areas whose testing depth exceeded a minimum confidence-backed bar.
61117. **Cross-endpoint confidence sharing** — Boost confidence of sibling endpoints when one endpoint in the same module yields a confirmed finding.
61118. **Negative-evidence confidence drop** — Sharply reduce depth allocation when clean, well-formed responses consistently indicate hardened code.
61119. **Confidence-volatility tracking** — Measure how wildly an endpoint's score swings and spend extra probes to stabilize high-volatility areas.
61120. **Probe-cost-adjusted depth** — Cap depth per endpoint by the ratio of probe cost to that endpoint's business criticality.
61121. **Confidence-annotated coverage map** — Render the target's attack surface as a heat map colored by live confidence, not just visited-or-not.
61122. **Depth-budget alerts** — Notify the user when a high-confidence area is about to exhaust its depth budget mid-investigation.
61123. **Confidence-threshold profiles** — Ship presets (paranoid, balanced, fast) that set the shallow/deep gates differently per hunt style.
61124. **Endpoint-confidence API** — Expose live confidence scores via API so external tooling and the mid-hunt chat can query "how sure are we about /admin?".
61125. **Confidence-driven screenshot capture** — Automatically capture and attach visual evidence when a high-confidence area enters deep-dive mode.
61126. **Depth-audit log** — Record every depth decision (why this endpoint got N more probes) for post-hunt explainability.
61127. **Confidence-reset on deploy** — Zero out depth-derived confidence when a target redeploy is detected, forcing honest re-testing.
61128. **Multi-signal confidence fusion** — Combine response anomalies, tech risk, and historical data into one fused confidence number per endpoint.
61129. **Confidence-gated chaining** — Only attempt vulnerability chains through endpoints whose individual confidence scores all exceed the chain threshold.
61130. **Depth-fairness guard** — Prevent a single high-confidence endpoint from monopolizing the hunt's total probe budget.
61131. **Shallow-sweep completeness metric** — Track what fraction of the discovered surface received at least the shallow pass, as a hunt health KPI.
61132. **Confidence-based retry policy** — Retry failed probes more aggressively on high-confidence endpoints and abandon them quickly on low-confidence ones.
61133. **Depth-escalation approval** — Ask the user before crossing into the deepest (potentially disruptive) probe tier on production targets.
61134. **Confidence-history sparklines** — Show mini time-series of each endpoint's confidence in the hunt dashboard for at-a-glance trends.
61135. **Depth-budget rollover** — Let unspent shallow-sweep budget flow into the deep-dive pool instead of expiring.
61136. **Confidence-calibrated severity** — Adjust reported severity by the depth of testing behind the finding, so shallow-scan findings aren't overstated.
61137. **Peer-endpoint confidence comparison** — Flag endpoints whose confidence diverges sharply from structurally similar peers as warranting review.
61138. **Confidence-driven de-duplication** — Merge candidate findings more aggressively when they come from low-depth, low-confidence probing.
61139. **Depth-bonus for auth-walled areas** — Grant extra depth budget to authenticated areas since they historically yield higher-severity findings.
61140. **Confidence-aware crawl frontier** — Prioritize crawling links discovered on high-confidence pages over those from low-confidence ones.
61141. **Depth-sprint allocation** — Divide the hunt into depth sprints, each with a fixed probe count distributed by live confidence rankings.
61142. **Confidence-stagnation detector** — Detect endpoints where additional probes no longer move confidence and freeze their depth spending.
61143. **Probe-diversity depth rule** — Require deep dives to use diverse probe families, not just more of the same probe that raised confidence.
61144. **Confidence-explained tooltips** — Every confidence number in the UI expands to show the top signals that produced it.
61145. **Depth-budget forecasting** — Predict when each area's depth budget will run out at current burn rate and surface it early.
61146. **Confidence-threshold auto-tuning** — Learn per-target-type optimal shallow/deep gates from historical hunt outcomes.
61147. **High-confidence fast-track lane** — Route the most promising endpoints into a priority lane with dedicated concurrency.
61148. **Depth receipts** — Attach a machine-readable "depth receipt" to each finding listing probes run, confidence trajectory, and budget spent.
61149. **Confidence-gated report sections** — Structure the final report so deep-dive-validated findings headline, with shallow-scan notes in an appendix.
61150. **Depth-budget inheritance for chains** — Let chained findings borrow depth budget from each link's endpoint pool with proper accounting.
61151. **Confidence-snapshot export** — Export the full confidence state at any moment for offline analysis or hunt handoff.
61152. **Depth-vs-noise tradeoff dial** — A single user-facing control that shifts the whole hunt between deeper testing and stealthier footprint.
61153. **Confidence-weighted evidence ranking** — Order evidence items inside a finding by the confidence each probe contributed.
61154. **Endpoint-confidence leaderboard** — Rank all endpoints by live confidence so the user can watch the hunt's attention focus in real time.
61155. **Depth-gate bypass justification** — If the agent skips a depth gate, require it to log a structured justification reviewed in the hunt timeline.
61156. **Confidence-driven WAF probing** — Spend WAF-evasion probes only on endpoints whose confidence justifies the extra stealth cost.
61157. **Shallow-pass quality sampling** — Randomly deep-dive a sample of low-confidence endpoints to validate that the shallow sweep isn't missing things.
61158. **Confidence-correlation with findings** — Continuously measure how well confidence predicts actual findings and recalibrate the scorer.
61159. **Depth-budget per vulnerability class** — Reserve dedicated depth pools for high-value classes (IDOR, SSRF, auth flaws) regardless of endpoint confidence.
61160. **Confidence-aware rate limiting** — Spend the target's rate-limit allowance preferentially on high-confidence endpoints.
61161. **Depth-milestone celebrations** — Mark in the timeline when an endpoint graduates from shallow to deep to validated, for user visibility.
61162. **Confidence-decay exemptions** — Exempt actively-chained endpoints from time decay so in-flight investigations aren't starved.
61163. **Depth-budget top-up requests** — Let the agent propose budget increases for hot areas, approved via mid-hunt chat or auto-policy.
61164. **Confidence-normalized benchmarks** — Compare hunt depth against historical hunts on similar targets using confidence-adjusted coverage.
61165. **Depth-gate audit sampling** — Independently re-test a sample of gate-blocked endpoints post-hunt to verify the gates weren't too strict.
61166. **Confidence-driven pause points** — Suggest natural user-review pauses when several endpoints simultaneously cross into deep-dive territory.
61167. **Endpoint-depth SLA tracking** — Guarantee every in-scope endpoint receives at least the shallow pass, tracked as a hunt SLA.
61168. **Confidence-boost from user hints** — Let user-provided tips ("check the checkout flow") inject confidence into named areas instantly.
61169. **Depth-spend efficiency score** — Compute findings-per-probe per area and steer future depth budgets toward efficient zones.
61170. **Confidence-aware scheduling** — Schedule deep dives during the target's low-traffic hours when the user enables time-aware hunting.
61171. **Depth-freeze for legal holds** — Instantly freeze all depth spending on user command, preserving state for compliance review.
61172. **Confidence-versioned findings** — Stamp each finding with the confidence-model version that produced it for reproducibility.
61173. **Depth-budget fairness across users** — In multi-tenant runs, ensure one hunt's depth appetite can't starve others sharing compute.
61174. **Confidence-driven report narratives** — Generate report prose that reflects testing depth honestly ("deeply validated" vs "initially observed").
61175. **Endpoint-depth comparison view** — Side-by-side depth bars for endpoints in the same module to spot under-tested outliers.
61176. **Confidence-threshold breach log** — Record every gate crossing with timestamp and triggering evidence for audit trails.
61177. **Depth-budget burn-rate chart** — Live chart of probe spend per area so users see where hunt effort is going.
61178. **Confidence-aware exploitability checks** — Only run heavier exploitability confirmation on findings backed by sufficient depth.
61179. **Shallow-sweep parallelization** — Maximize concurrency during the cheap shallow pass, then serialize deep dives for care and stealth.
61180. **Depth-gate machine-readable schema** — Publish the gate configuration as JSON so teams can version-control hunt depth policies in git.
61181. **Confidence-prior library** — Maintain prior probability tables per technology (e.g., WordPress plugin endpoints start with higher priors).
61182. **Depth-credit system** — Award areas "depth credits" for clean deep-dive results, spendable on future hunts against the same target.
61183. **Confidence-drift alerts** — Warn when an endpoint's confidence moves sharply without new probes, indicating scorer or data issues.
61184. **Depth-budget negotiation between brains** — Let hacking and control brains negotiate depth allocation with a structured bid protocol.
61185. **Confidence-gated auto-remediation advice** — Only attach fix recommendations to findings whose depth supports confident remediation guidance.
61186. **Endpoint-depth heat timeline** — Animate the confidence heat map over hunt time so users can replay where attention flowed.
61187. **Confidence-sampling for QA** — QA reviewers sample findings stratified by confidence tier to validate the depth model's calibration.
61188. **Depth-budget emergency reserve** — Hold back 10% of total probe budget for late-hunt high-confidence discoveries.
61189. **Confidence-aware notification throttling** — Notify the user immediately about high-confidence deep-dive hits, batch low-confidence shallow notes.
61190. **Depth-gate override audit** — Any manual override of a depth gate requires a reason captured in the immutable hunt log.
61191. **Confidence-transfer between hunts** — Seed a new hunt's priors with the previous hunt's final confidence map for the same target.
61192. **Depth-budget per HTTP method** — Track and budget probe spend separately for GET, POST, PUT, DELETE to avoid method-blind spots.
61193. **Confidence-weighted crawl depth** — Let the crawler follow links deeper on high-confidence pages and stay shallow elsewhere.
61194. **Endpoint-depth anomaly detection** — Flag areas consuming far more depth than their confidence justifies as possible agent confusion.
61195. **Confidence-explainable AI summaries** — Generate natural-language summaries of why the hunt went deep in specific areas for stakeholder reports.
61196. **Depth-gate performance analytics** — Measure gate precision/recall against final findings to tune thresholds fleet-wide.
61197. **Confidence-driven scope suggestions** — Propose scope expansions specifically for high-confidence adjacent areas just outside current scope.
61198. **Depth-budget charity pool** — Donate unspent budget from completed areas into a shared pool any hot area can draw from with approval.
61199. **Confidence-score API webhooks** — Fire webhooks when any endpoint crosses configured confidence thresholds for external automation.
61200. **Depth-model version pinning** — Pin hunts to a specific confidence-model version so results stay comparable across re-runs.
61201. **Confidence-aware evidence pruning** — Drop low-value evidence from low-confidence probes to keep finding records clean and reviewable.
61202. **Depth-gate bypass rate metric** — Track how often gates are bypassed as a governance metric for hunt discipline.
61203. **Confidence-driven hunt summarization** — Weight hunt-summary content by depth so the executive summary reflects where real effort went.
61204. **Adaptive-depth post-mortem** — After each hunt, analyze whether depth was allocated optimally and feed lessons into the next hunt's budgets.
61205. **Zero-yield quit rule** — Terminate a probe line automatically after N consecutive probes yield no new information or anomalies.
61206. **Sunk-cost guard** — Block the agent from continuing a failing line merely because budget was already spent, enforcing forward-looking expected value.
61207. **Diminishing-returns detector** — Measure the marginal finding rate per additional probe and quit the line when it drops below a floor.
61208. **Statistical stop rule** — Apply sequential hypothesis testing to decide with quantified confidence that a vector is unproductive.
61209. **Time-boxed vector trials** — Give each attack vector a fixed trial window; lines that produce nothing in-window are retired for the hunt.
61210. **Budget-burn stop** — Halt a testing line the moment its spend exceeds its allocated budget with no findings to show.
61211. **User-defined quit conditions** — Let researchers author custom termination rules (e.g., "stop IDOR tests after 50 clean object IDs").
61212. **Graceful line wind-down** — When quitting, finish in-flight probes and record partial evidence instead of abandoning mid-request.
61213. **Quit-signal taxonomy** — Classify termination reasons (no-signal, hardened, rate-limited, out-of-scope-drift) for consistent reporting.
61214. **Termination learning loop** — Feed every quit decision and its outcome back into the stop-rule tuner to sharpen future thresholds.
61215. **Quit-report snippets** — Auto-generate a one-line justification for each terminated line, visible in the hunt timeline.
61216. **Sunk-cost dashboard** — Show live spend-vs-yield per testing line so users can see exactly where the agent refuses to throw good effort after bad.
61217. **Escalation-before-quit** — Require one escalation attempt (different probe family, higher stealth) before a high-priority line may terminate.
61218. **Quit veto window** — Notify the user of pending terminations with a short window to veto and keep a line alive.
61219. **Partial-credit preservation** — On termination, archive all partial evidence and coverage data so a future hunt can resume smarter.
61220. **Termination-cascade prevention** — Ensure quitting one line doesn't starve dependent lines that share its sessions or setup.
61221. **Rate-limit-forced pause vs quit** — Distinguish temporary rate-limit pauses from permanent quits, with automatic resume scheduling.
61222. **Hardened-target early exit** — Recognize uniformly clean, well-secured responses and recommend ending the hunt early with a hardening attestation.
61223. **Quit-confidence scoring** — Attach a confidence score to each quit decision indicating how sure the agent is the line is truly dead.
61224. **Termination replay** — Allow re-running a terminated line later in the hunt if new signals (e.g., a fresh finding nearby) revive its prospects.
61225. **Cross-line quit correlation** — If several related lines quit for the same reason, trigger a meta-review of the shared assumption.
61226. **Minimum-evidence quit bar** — Forbid quitting a line until a minimum number of diverse probes have actually executed.
61227. **Quit-rate health metric** — Track the fraction of lines terminated early as a hunt-efficiency KPI, with healthy target bands.
61228. **Premature-quit detector** — Post-hunt, sample terminated lines with spot re-tests to catch stop rules that quit too aggressively.
61229. **Termination-budget accounting** — Count the compute saved by early termination and report it as hunt efficiency gain.
61230. **User quit-policy profiles** — Offer aggressive, balanced, and thorough termination profiles matching different risk appetites.
61231. **Conditional quit chains** — Define "quit A only if B also shows no signal" rules for logically coupled testing lines.
61232. **Quit-signal strength meter** — Visualize how close each active line is to its termination threshold in the hunt dashboard.
61233. **Termination-audit export** — Export every quit decision with evidence for compliance or client review.
61234. **Adaptive quit thresholds** — Tighten or loosen termination thresholds per vector based on that vector's live fleet-wide yield.
61235. **Quit-on-scope-drift** — Terminate lines whose probes start drifting toward out-of-scope assets, with automatic scope-violation logging.
61236. **Stale-session quit** — End lines whose authenticated sessions died and cannot be refreshed within the retry policy.
61237. **Duplicate-signal quit** — Stop a line when its outputs exactly duplicate an already-terminated line's results.
61238. **Quit recommendation engine** — Proactively suggest lines to terminate, ranked by wasted-spend projection, for user approval.
61239. **Termination dry-run mode** — Simulate which lines would quit under proposed thresholds against a recorded hunt before applying them.
61240. **Quit-freeze for critical vectors** — Exempt user-marked critical vectors (e.g., auth bypass) from automatic termination entirely.
61241. **Line-liveness heartbeat** — Require each testing line to emit periodic progress heartbeats; silent lines get investigated then terminated.
61242. **Termination-grace for new tech** — Give unfamiliar technology stacks longer trial windows before quit rules apply, avoiding premature exits.
61243. **Quit-bias correction** — Counteract the agent's tendency to quit novel vectors early by adding an exploration bonus to trial windows.
61244. **Multi-armed quit comparison** — When two similar lines quit at different times, analyze the difference to refine per-vector thresholds.
61245. **Termination-notification batching** — Batch quit notifications to avoid spamming the user during mass termination events.
61246. **Quit-decision explainability** — Every termination includes the exact metrics and thresholds that triggered it, in plain language.
61247. **Hunt-level early-exit proposal** — When most lines have quit unproductively, propose ending the entire hunt early with a summary.
61248. **Early-exit savings estimate** — Show projected time and compute saved by accepting an early hunt termination.
61249. **Quit-pattern anomaly alerts** — Alert when termination patterns deviate sharply from historical norms, suggesting target or agent issues.
61250. **Termination-rule versioning** — Version the stop-rule set per hunt so results remain reproducible and comparable.
61251. **Per-severity quit floors** — Never auto-terminate lines hunting critical-severity classes until exhaustive minimums are met.
61252. **Quit-debt tracking** — Track terminated lines as "quit debt" that future hunts against the same target should revisit first.
61253. **Termination-intervals analytics** — Analyze time-to-quit distributions per vector to right-size trial windows fleet-wide.
61254. **Quit-signal marketplace** — Share community-contributed quit rules (e.g., "WordPress plugin dead-end pack") installable per hunt.
61255. **Contextual quit messages** — Tailor termination explanations to the audience: terse for the timeline, detailed for the audit log.
61256. **Quit-while-chaining guard** — Forbid terminating a line that is currently part of an in-progress vulnerability chain investigation.
61257. **Termination-priority queue** — Order pending quits by wasted-spend rate so the most expensive dead lines die first.
61258. **Quit-rule A/B testing** — Run competing stop-rule sets on mirrored hunts to empirically discover better termination policies.
61259. **Line-resurrection protocol** — Define a formal path (new evidence threshold + user or policy approval) for reviving terminated lines.
61260. **Termination-cost accounting** — Include the cost of wind-down and evidence archival in each line's total spend for honest ROI math.
61261. **Quit-threshold heat map** — Visualize which vectors quit fastest across the fleet to spot systematically under-tuned trial windows.
61262. **User-override quit log** — Record every manual veto or forced quit separately from agent decisions for policy tuning.
61263. **Termination-fairness check** — Ensure quit rules don't systematically under-test certain areas (e.g., authenticated zones) due to slower signals.
61264. **Quit-signal latency tracking** — Measure how long dead lines kept burning budget before termination fired, and minimize it.
61265. **Hunt-abandonment safeguards** — Require explicit user confirmation before the agent proposes abandoning an entire paid hunt early.
61266. **Termination templates** — Ship prebuilt quit-rule templates per target type (API, SPA, WordPress, e-commerce) with sensible defaults.
61267. **Quit-confidence calibration** — Compare quit-confidence scores against spot re-test outcomes to keep the scorer honest.
61268. **Line-merge-before-quit** — Before terminating, check whether a struggling line's remaining probes can merge into a healthier sibling line.
61269. **Termination-impact forecast** — Estimate the finding-probability lost by each quit so users can judge whether termination was wise.
61270. **Quit-rule documentation generator** — Auto-document the active stop rules at hunt start in the hunt brief for client transparency.
61271. **Stuck-line detector** — Identify lines making no progress (same probe retried, no state change) versus merely slow lines, and quit the stuck ones.
61272. **Termination-backoff schedule** — After a line quits and is resurrected, apply progressively longer trial windows to avoid quit-resurrect loops.
61273. **Quit-attribution analysis** — Attribute each termination to its dominant cause to guide engineering fixes (e.g., flaky sessions causing false quits).
61274. **Hunt-velocity quit link** — Feed termination events into sprint velocity tracking so planning reflects real line mortality.
61275. **Termination-safe snapshots** — Snapshot line state at quit time so resurrected lines resume exactly where they stopped.
61276. **Quit-notification preferences** — Let users choose per-severity notification levels for terminations (silent, batched, immediate).
61277. **Cross-hunt quit memory** — Remember which vectors quit unproductively on this target before, and shorten their trial windows next hunt.
61278. **Termination-regret metric** — Track findings later discovered in areas whose lines had quit, as the ultimate stop-rule quality metric.
61279. **Quit-rule governance board** — A review UI where teams approve, tune, or retire stop rules based on regret and savings data.
61280. **Emergency-quit switch** — A single user action that gracefully terminates all active lines and parks the hunt in a resumable state.
61281. **Quit-on-legal-flag** — Immediately terminate any line touching assets flagged by legal or scope-review systems, with full evidence preservation.
61282. **Termination-efficiency leaderboard** — Rank stop rules by budget saved per unit of regret across the fleet to promote the best.
61283. **Line-terminal-state archive** — Store the final state of every terminated line for forensic review and model training.
61284. **Quit-signal feature store** — Centralize the features used by stop rules so new rules can reuse proven signals.
61285. **Termination-policy inheritance** — Let child hunts (re-tests, expansions) inherit tuned quit policies from their parent hunt.
61286. **Quit-decision latency SLA** — Guarantee termination decisions execute within seconds of threshold breach to stop budget bleed.
61287. **Sunk-cost narrative blocker** — When the agent argues to continue a dead line, require it to cite forward-looking expected value, never past spend.
61288. **Termination-coverage guarantee** — Ensure quitting a line never drops the hunt below its minimum coverage SLA without user approval.
61289. **Quit-correlation with deploys** — Detect when mass terminations coincide with target deploys and auto-schedule re-validation instead of permanent quits.
61290. **Termination-summary in reports** — Include a concise "lines investigated and retired" section in client reports to demonstrate thoroughness.
61291. **Quit-rule simulation harness** — Test new stop rules against years of archived hunt telemetry before fleet rollout.
61292. **Adaptive-trial extensions** — Grant promising-but-slow lines one principled extension based on early weak signals, not gut feel.
61293. **Termination-handshake with scheduler** — Notify the hunt scheduler on every quit so freed capacity is instantly reallocated.
61294. **Quit-aware finding triage** — Deprioritize findings from lines that were near termination, since they received thinner validation.
61295. **Line-death post-mortem** — Auto-generate a short post-mortem for high-spend terminated lines: what was tried, why it failed, what would change.
61296. **Termination-budget reclamation** — Instantly return a quit line's unspent budget to the hunt pool with full audit entries.
61297. **Quit-rule explainability cards** — Render each active stop rule as a card showing its logic, thresholds, and live trigger proximity.
61298. **Cross-vector quit learning** — Transfer termination insights between similar vectors (e.g., IDOR learnings inform BOLA trial windows).
61299. **Termination-gated autopilot** — Only allow fully autonomous quitting after a hunt's stop rules have been validated on similar targets.
61300. **Quit-signal confidence intervals** — Express termination triggers with confidence intervals so borderline cases get human review instead of auto-quit.
61301. **Hunt-terminal-state report** — When a hunt ends, summarize every line's terminal state (completed, quit, paused) in one view.
61302. **Termination-policy diffing** — Diff quit policies between hunts to explain why two similar hunts terminated lines differently.
61303. **Quit-rule performance badges** — Award visible badges to stop rules with proven savings-and-low-regret records to encourage reuse.
61304. **Adaptive-termination retrospective** — Quarterly fleet review of all termination data producing updated default quit policies.
61305. **Finding-heat map** — Render live geographic-style heat over the target's attack surface showing where findings cluster, driving attention shifts.
61306. **Heat-driven scheduler** — Reorder the probe queue continuously so hot zones get disproportionate concurrency and cold zones get maintenance-level effort.
61307. **Attention-market mechanism** — Let testing lines bid for compute using expected-finding-value currency, creating an internal market for hunt focus.
61308. **Focus-reallocation engine** — Move probe budget between areas in real time based on a transparent scoring function the user can inspect.
61309. **Hot-zone surge protocol** — When a confirmed finding lands, automatically surge surrounding endpoints with a time-limited investigation burst.
61310. **Cold-zone reclamation** — Pull idle capacity from areas with no signals for a sustained period and auction it to active zones.
61311. **Reallocation-announcement feed** — Publish every significant focus shift to the hunt timeline with the triggering evidence.
61312. **Anti-herding guard** — Prevent all capacity from piling onto one hot zone by enforcing minimum coverage across the committed scope.
61313. **Focus-budget accounting** — Track attention as a first-class budget with debits, credits, and per-area statements.
61314. **Reallocation-history replay** — Let users replay how focus moved across the target over the hunt's lifetime as an animated timeline.
61315. **Finding-proximity boost** — Temporarily raise the priority of endpoints sharing code, parameters, or auth context with a fresh finding.
61316. **Heat-decay function** — Let zone heat cool over time without fresh findings so attention naturally redistributes to unexplored areas.
61317. **Focus-fairness floor** — Guarantee every in-scope area a minimum attention share regardless of how hot other zones burn.
61318. **Reallocation-threshold tuning** — Expose the sensitivity of focus shifts as tunable parameters with live preview of their effect.
61319. **Cross-module heat propagation** — Spread heat from a finding to architecturally related modules, not just URL neighbors.
61320. **Attention-dividend policy** — Reward zones that produce validated findings with sustained priority boosts across the rest of the hunt.
61321. **Focus-shift veto** — Let users pin specific areas to fixed attention levels, exempting them from automatic reallocation.
61322. **Reallocation-impact scoring** — After each shift, measure whether finding rate improved to validate the reallocation logic.
61323. **Heat-source attribution** — Label every hot zone with the specific findings and signals generating its heat for transparency.
61324. **Focus-concentration alerts** — Warn when over X% of effort concentrates in one zone, prompting review of the reallocation aggressiveness.
61325. **Idle-area heartbeat probes** — Keep cold zones warm with cheap periodic probes so reactivation is instant if signals appear.
61326. **Reallocation-simulation preview** — Show the projected queue impact of a proposed focus shift before it executes.
61327. **Multi-objective focus optimizer** — Balance findings, coverage, and stealth simultaneously when reallocating, not just raw finding rate.
61328. **Focus-shift cooldowns** — Enforce minimum intervals between major reallocations to avoid attention whiplash.
61329. **Heat-normalized benchmarking** — Compare zone heat against historical baselines for the same target type to spot genuinely anomalous clusters.
61330. **Attention-auction rounds** — Run periodic auction rounds where zones bid for the next time slice's capacity using expected-value estimates.
61331. **Focus-debt ledger** — Track under-served zones as accumulating debt that must be repaid with attention before the hunt closes.
61332. **Reallocation-policy packs** — Ship focus policies (aggressive chaser, balanced explorer, coverage guardian) selectable per hunt.
61333. **Heat-map export** — Export the final attention heat map as evidence of where hunt effort was actually spent for client reports.
61334. **Focus-shift rationale cards** — Render each major reallocation as a card: trigger, from→to, expected gain, actual outcome.
61335. **Zone-staleness detection** — Detect zones that haven't been probed recently despite rising heat and fast-track them.
61336. **Attention-fragmentation guard** — Prevent focus from scattering across too many lukewarm zones by enforcing a minimum viable attention chunk.
61337. **Finding-severity-weighted heat** — Weight heat contributions by finding severity so a critical finding pulls harder than an informational one.
61338. **Reallocation-backtesting** — Replay historical hunts with new focus policies to measure their hypothetical improvement before rollout.
61339. **Focus-lock for compliance** — Lock attention distribution during regulated test windows where the plan was pre-approved.
61340. **Heat-anomaly investigation** — Auto-launch a diagnostic when a zone's heat spikes without any finding, checking for sensor or scorer errors.
61341. **Cross-hunt heat memory** — Seed a new hunt's focus priors with the previous hunt's final heat map for the same target.
61342. **Attention-reserve pool** — Hold back a slice of capacity unallocated, deployable instantly to breaking hot zones.
61343. **Focus-shift approval tiers** — Auto-approve small reallocations, require agent-lead approval for medium ones, user approval for massive pivots.
61344. **Heat-driven evidence depth** — Automatically deepen evidence collection in hot zones (more screenshots, request logs) while findings are fresh.
61345. **Reallocation-fairness audit** — Post-hunt, verify no in-scope area was starved below its fairness floor without documented justification.
61346. **Zone-priority inheritance** — Child endpoints inherit a fraction of their parent zone's heat so new discoveries near hot zones get early attention.
61347. **Focus-shift latency metric** — Measure time from finding confirmation to attention surge as a responsiveness KPI for the reallocation engine.
61348. **Attention-market price history** — Chart the internal price of compute per zone over time as a diagnostic of hunt dynamics.
61349. **Heat-threshold alerts** — Notify the user when any zone crosses configurable heat thresholds, with one-click drill-down.
61350. **Reallocation-rollback** — Undo a focus shift that demonstrably hurt finding rate, restoring the prior attention distribution.
61351. **Multi-zone surge coordination** — Coordinate simultaneous surges across related zones to test for systemic issues rather than isolated bugs.
61352. **Focus-efficiency scoring** — Score each zone's findings-per-attention-unit to guide future allocation policy tuning.
61353. **Cold-start focus bootstrap** — Use fleet-wide priors to allocate initial attention sensibly before any hunt-specific signals exist.
61354. **Attention-saturation detection** — Recognize when adding more probes to a hot zone stops helping and redirect the surplus elsewhere.
61355. **Focus-shift explanations in chat** — Have the mid-hunt chat proactively explain major reallocations when the user asks "what are you focusing on?".
61356. **Heat-weighted report ordering** — Order report sections partly by the attention each area received, reflecting investigative depth honestly.
61357. **Reallocation-policy A/B testing** — Test competing focus policies on mirrored hunts to find the best attention strategy empirically.
61358. **Zone-attention SLA** — Guarantee minimum probe counts per zone per hour as a contractual hunt-quality measure.
61359. **Focus-drift detection** — Alert when actual attention distribution drifts from the planned distribution beyond tolerance.
61360. **Attention-credit trading** — Allow zones to trade attention credits with interest, modeling opportunity cost explicitly in the scheduler.
61361. **Heat-map time-lapse export** — Generate a shareable animation of attention flow for compelling client presentations.
61362. **Reallocation-guardian mode** — A conservative mode that only reallocates on confirmed findings, never on weak signals.
61363. **Focus-shift batching** — Batch small reallocations into periodic adjustments to keep the queue stable and reviewable.
61364. **Zone-heat confidence intervals** — Express zone heat with uncertainty bands so the scheduler doesn't overreact to noisy signals.
61365. **Attention-market circuit breaker** — Freeze the internal market if bidding becomes unstable, falling back to a simple priority queue.
61366. **Cross-target heat transfer** — Apply heat patterns learned from one target to focus the initial allocation on similar targets.
61367. **Focus-reallocation webhooks** — Emit events on major shifts so external SOAR or ticketing systems can react.
61368. **Heat-driven retest prioritization** — When re-testing, prioritize zones that were hottest in the previous hunt.
61369. **Attention-floor exemptions** — Let the user exempt decommissioned or out-of-scope-adjacent zones from fairness floors.
61370. **Reallocation-decision log** — Immutable log of every attention move with inputs, decision, and outcome for audit and learning.
61371. **Focus-concentration risk score** — Quantify the risk of over-concentration (missing bugs elsewhere) as a live hunt-health metric.
61372. **Heat-source diversity bonus** — Prefer heat backed by multiple independent signal types over single-source spikes.
61373. **Attention-rebalancing triggers** — Define explicit conditions (coverage gap, SLA breach) that force rebalancing regardless of heat.
61374. **Zone-focus profiles** — Assign each zone a focus profile (sprinter, marathoner, sleeper) governing how it earns and spends attention.
61375. **Reallocation-narrative generator** — Produce a plain-language story of how focus evolved during the hunt for the final report.
61376. **Heat-map differential view** — Compare heat maps between two hunts on the same target to show how attention strategy changed.
61377. **Focus-shift impact on stealth** — Factor the noise cost of surging a zone into reallocation decisions on stealth-sensitive hunts.
61378. **Attention-market maker** — A background process that provides liquidity so new zones can always buy minimum attention.
61379. **Heat-decay customization** — Let users tune how fast heat cools per zone type, reflecting different re-test values.
61380. **Reallocation-policy documentation** — Auto-generate human-readable docs of the active focus policy at hunt start.
61381. **Zone-attention anomaly alerts** — Flag zones receiving far more or less attention than the policy intends, indicating scheduler bugs.
61382. **Focus-shift user suggestions** — Surface "suggested focus moves" for user approval in supervised hunts instead of auto-executing.
61383. **Heat-weighted vulnerability chaining** — Prioritize chain-building attempts that pass through the hottest zones first.
61384. **Attention-burn-rate monitor** — Track how fast the attention budget is consumed versus hunt progress to catch runaway focus.
61385. **Reallocation-fleet analytics** — Aggregate focus-shift effectiveness across all hunts to continuously improve the reallocation engine.
61386. **Zone-heat export API** — Programmatic access to live zone heat for custom dashboards and integrations.
61387. **Focus-shift dry-run** — Preview a policy change's effect on current attention distribution without applying it.
61388. **Heat-driven scope recommendations** — Recommend scope expansions specifically around persistently hot boundary zones.
61389. **Attention-fairness dashboard** — Visualize per-zone attention vs. fairness floors so users can spot starvation at a glance.
61390. **Reallocation-event streaming** — Stream focus-shift events over SSE so the frontend heat map updates in real time.
61391. **Zone-heat peer comparison** — Compare a zone's heat against the same zone in prior hunts to detect meaningful change.
61392. **Focus-shift cost model** — Account for the switching cost (queue rebuild, session warmup) of each reallocation in its expected-value math.
61393. **Heat-map annotation** — Let users annotate heat map regions with notes that persist across hunts on the same target.
61394. **Reallocation-policy inheritance** — Child hunts inherit the parent's tuned focus policy, with deltas logged.
61395. **Attention-scarcity mode** — When compute is constrained, switch to a triage focus policy that only serves the hottest zones.
61396. **Heat-confidence fusion** — Combine raw heat with confidence scores so high-heat low-confidence zones get verification before surges.
61397. **Focus-shift retrospectives** — After each hunt, review the biggest reallocations and score whether they paid off.
61398. **Zone-attention forecasting** — Predict each zone's attention needs for the next hour from heat trends and schedule capacity ahead.
61399. **Reallocation-policy marketplace** — Share community focus policies (e.g., "API-heavy chaser") installable with one click.
61400. **Heat-driven hunt summarization** — Weight the auto-generated hunt summary by attention heat so it reflects where the real work happened.
61401. **Focus-shift guardrails for prod** — Extra approval and noise checks before surging attention on production targets.
61402. **Attention-ledger export** — Export the full attention ledger (every debit/credit per zone) for client or compliance review.
61403. **Heat-map accessibility mode** — Provide non-color encodings (patterns, labels) of the heat map for color-blind users.
61404. **Adaptive-focus maturity score** — Grade each hunt on how effectively it reallocated focus, feeding a fleet-wide improvement program.
61405. **Intra-hunt payload reranking** — Reorder the live payload queue after every batch of results, promoting payload families that are hitting.
61406. **Session tactic scoreboard** — Track each tactic's hit rate within the current hunt and display it as a live leaderboard.
61407. **Online learning-rate control** — Tune how aggressively the hunt updates its beliefs from new evidence, with faster learning early and stabilization later.
61408. **Live feature-weight updates** — Adjust the weights of endpoint-risk features (parameter count, auth presence) as the hunt reveals what predicts findings.
61409. **Negative-pattern learning** — Explicitly learn which probe patterns consistently fail on this target and deprioritize them hunt-wide.
61410. **Tactic-success attribution** — Attribute each finding to the tactic chain that produced it, building per-hunt tactic effectiveness profiles.
61411. **Forgetting stale learnings** — Decay learnings derived from early-hunt conditions when the target's behavior demonstrably changes mid-hunt.
61412. **Transfer learning within hunt** — Apply a lesson learned on one endpoint (e.g., "filters strip quotes") instantly to all similar endpoints.
61413. **Payload-family performance tracking** — Monitor hit rates per payload family in real time and shift generation toward winning families.
61414. **Adaptive probe templating** — Mutate probe templates based on which mutations historically bypassed this target's filters during the hunt.
61415. **Learning-dashboard for hunts** — Show what the agent has learned so far (top tactics, dead patterns, updated priors) in a dedicated hunt view.
61416. **Confidence-in-learning metric** — Track how certain the intra-hunt learner is about each updated belief to avoid overfitting to noise.
61417. **Learning-rate schedules** — Apply decay schedules to intra-hunt updates so late-hunt learning doesn't thrash stable strategies.
61418. **Counterfactual tactic evaluation** — Estimate how untried tactics would have performed using logged context, guiding mid-hunt tactic adoption.
61419. **Session-embedding memory** — Encode the hunt's evolving understanding as embeddings retrievable for similar decisions later in the same hunt.
61420. **Learning-gated tactic unlocks** — Unlock advanced tactics only after the learner confirms the target's defenses warrant them.
61421. **Probe-outcome feature logging** — Log rich features for every probe outcome to feed the intra-hunt learner with clean training data.
61422. **Learning-sandbox validation** — Validate a learned rule against held-out recent probes before applying it hunt-wide.
61423. **Tactic-fatigue detection** — Detect when a previously winning tactic's hit rate decays and demote it before it wastes budget.
61424. **Cross-vector lesson sharing** — Propagate a filter-bypass lesson from XSS probes to SQLi probes automatically within the hunt.
61425. **Learning-velocity tracking** — Measure how fast the agent's beliefs improve (prediction error over time) as a hunt-quality signal.
61426. **Human-in-the-loop learning** — Let user feedback ("that was a false positive") directly update the intra-hunt learner's weights.
61427. **Learning-checkpoint snapshots** — Snapshot the learner's state periodically so bad updates can be rolled back without losing the hunt.
61428. **Regret-minimizing tactic selection** — Choose tactics to minimize expected regret using the latest learned payoff estimates.
61429. **Session-prior auto-calibration** — Recalibrate technology priors mid-hunt when observed finding rates diverge from initial assumptions.
61430. **Learning-explanation feed** — Narrate key belief updates ("XSS payloads with event handlers now ranked higher because 3/5 hit") in the timeline.
61431. **Probe-diversity learning** — Learn the optimal diversity level: when varied probes beat repeated similar ones on this target.
61432. **Temporal-pattern learning** — Learn time-based target behaviors (e.g., stricter WAF at peak hours) and schedule probes accordingly.
61433. **Response-cluster learning** — Cluster target responses online and learn which clusters correlate with vulnerable versus hardened endpoints.
61434. **Learning-based probe budgeting** — Allocate more probes to tactics whose learned expected value is highest, updated continuously.
61435. **Session-knowledge distillation** — Compress the hunt's learnings into a compact brief transferable to the next hunt on the same target.
61436. **Learning-audit trail** — Log every significant belief update with triggering evidence for post-hunt review and debugging.
61437. **Overfitting guardrails** — Cap how much a handful of early results can skew the learner, requiring minimum sample sizes per update.
61438. **Tactic-synergy discovery** — Learn which tactic pairs perform better in sequence than alone and chain them preferentially.
61439. **Learning-driven scope hints** — Surface learned patterns ("admin panels here often expose debug endpoints") as scope-expansion suggestions.
61440. **Session model versioning** — Version the intra-hunt learner's model so updates are traceable and reproducible.
61441. **Learning-warmup period** — Delay major belief-driven decisions until the learner has seen enough probes to be trustworthy.
61442. **Probe-outcome prediction** — Train an online predictor of probe success and use it to skip likely-futile probes pre-execution.
61443. **Learning-based deduplication** — Use learned similarity to merge near-duplicate candidate findings more accurately mid-hunt.
61444. **Session-embedding search** — Let the agent query its own evolving hunt memory ("what worked on similar params earlier?") semantically.
61445. **Learning-rate per tactic** — Give fast-learning rates to high-volume tactics and conservative rates to rare, expensive ones.
61446. **Belief-conflict resolution** — When new evidence contradicts learned beliefs, apply a structured update-or-discard protocol with logging.
61447. **Learning-influenced reporting** — Annotate findings with what the hunt learned while validating them for richer report narratives.
61448. **Tactic-retirement proposals** — Propose retiring tactics whose learned expected value stays negative across a full hunt phase.
61449. **Session-learning API** — Expose the live learner state via API so researchers can inspect and steer beliefs programmatically.
61450. **Learning-curriculum ordering** — Order probes from most informative to least, maximizing what the learner discovers per probe spent.
61451. **Probe-generation feedback loop** — Feed probe outcomes directly into the payload generator to evolve better probes within the hunt.
61452. **Learning-stability monitor** — Watch for oscillating beliefs (flip-flopping rankings) and dampen updates when instability is detected.
61453. **Session-prior marketplace** — Share anonymized learned priors per technology so new hunts start smarter fleet-wide.
61454. **Learning-based session management** — Learn optimal session-refresh timing from observed token lifetimes during the hunt.
61455. **Tactic-cost learning** — Learn the true time and stealth cost of each tactic on this target and factor it into selection.
61456. **Learning-driven evidence standards** — Raise evidence requirements for tactics the learner flags as historically FP-prone in this hunt.
61457. **Session-knowledge export** — Export the hunt's learned model as a portable artifact for offline analysis and team sharing.
61458. **Learning-fairness checks** — Ensure the learner doesn't systematically undervalue low-volume but critical tactics like auth-bypass probes.
61459. **Probe-sequencing learner** — Learn the best order to run probe families against this target rather than using fixed sequences.
61460. **Learning-based throttling** — Adjust request pacing from learned target tolerance instead of static delays.
61461. **Session-anomaly learning** — Learn what "normal" looks like for this target's responses to sharpen anomaly-driven probing.
61462. **Learning-gated automation** — Only enable fully autonomous tactic switching after the learner's predictions beat a reliability threshold.
61463. **Tactic-embedding similarity** — Represent tactics as embeddings to generalize learnings to novel tactics resembling known winners.
61464. **Learning-decay profiles** — Apply different forgetting rates per learning type (payload rankings decay fast, tech priors decay slow).
61465. **Session-learning health score** — A single metric summarizing learner stability, sample sufficiency, and prediction accuracy.
61466. **Learning-based false-negative hunt** — Direct extra probes at areas the learner predicts are under-tested relative to their risk.
61467. **Probe-outcome labeling UI** — Let users quickly label probe outcomes to provide supervised signal to the intra-hunt learner.
61468. **Learning-transfer consent** — Ask before carrying a hunt's learnings to other targets when data-sensitivity policies require it.
61469. **Tactic-portfolio rebalancing** — Continuously rebalance the mix of active tactics toward learned winners, like a portfolio manager.
61470. **Learning-explainability reports** — Generate a post-hunt report section detailing what the agent learned and how it changed behavior.
61471. **Session-knowledge graph** — Build a live graph linking endpoints, tactics, payloads, and outcomes for the learner to reason over.
61472. **Learning-based chain prioritization** — Rank vulnerability-chain hypotheses by learned chaining success rates on similar findings.
61473. **Probe-mutation learner** — Learn which probe mutations (encoding, case, nesting) evade this target's filters and generate accordingly.
61474. **Learning-rate anomaly alerts** — Alert when the learner's update magnitude spikes, indicating possible poisoned or anomalous feedback.
61475. **Session-learning rollback** — Revert the learner to a prior checkpoint if its recent updates demonstrably hurt finding rate.
61476. **Tactic-discovery engine** — Propose entirely new tactic variants by combining elements of learned winners during the hunt.
61477. **Learning-weighted coverage** — Weight coverage metrics by learned risk so "coverage" reflects meaningful testing, not just requests sent.
61478. **Session-learning benchmarks** — Compare the learner's prediction accuracy against a static baseline to prove intra-hunt learning adds value.
61479. **Learning-driven user prompts** — Ask the user targeted questions only when the learner's uncertainty is highest and the answer is most valuable.
61480. **Probe-batch outcome analysis** — Analyze results in batches to detect tactic performance shifts faster than per-probe updates allow.
61481. **Learning-based retry logic** — Decide probe retries from learned transient-failure patterns instead of fixed retry counts.
61482. **Session-knowledge retention policy** — Define how long intra-hunt learnings persist and when they expire for privacy and relevance.
61483. **Learning-influenced stealth** — Learn the target's detection thresholds and keep probe patterns just under them automatically.
61484. **Tactic-complementarity mapping** — Map which tactics cover each other's blind spots and schedule complementary pairs together.
61485. **Learning-saturation detection** — Recognize when additional probes stop teaching the learner anything new and shift to pure exploitation.
61486. **Session-learning diff view** — Show how the learner's beliefs changed between any two hunt timestamps for debugging and demos.
61487. **Learning-based finding triage** — Prioritize human review of findings from tactics the learner rates as high-precision.
61488. **Probe-outcome drift detection** — Detect when the relationship between probes and outcomes shifts mid-hunt (target changed) and reset relevant learnings.
61489. **Learning-gated scope expansion** — Only propose scope expansions the learner predicts have positive expected finding value.
61490. **Session-embedding clustering** — Cluster similar hunt situations in embedding space to reuse successful responses from earlier in the hunt.
61491. **Learning-rate auto-tuning** — Meta-learn the best learning rate for this target type from how quickly beliefs converged in past hunts.
61492. **Tactic-evolution tracking** — Track how tactic definitions themselves mutate during the hunt under the discovery engine.
61493. **Learning-based cost forecasting** — Predict remaining hunt cost from learned tactic costs and planned probe mix.
61494. **Session-knowledge access controls** — Restrict who can view or export a hunt's learned model based on target sensitivity.
61495. **Learning-validation holdout** — Reserve a slice of probes as a holdout set to honestly validate learned rankings mid-hunt.
61496. **Probe-priority learning** — Learn per-endpoint probe orderings that historically surfaced findings fastest on similar endpoints.
61497. **Learning-driven de-escalation** — When the learner concludes an area is hardened, gracefully de-escalate rather than abruptly quitting.
61498. **Session-learning telemetry** — Stream learner metrics (update counts, prediction error) to the hunt dashboard in real time.
61499. **Learning-based hunt replay** — Replay a hunt with learning disabled versus enabled to quantify the value of intra-hunt adaptation.
61500. **Tactic-knowledge base seeding** — Seed the intra-hunt learner with the global tactic knowledge base so it never starts from zero.
61501. **Learning-confidence overlays** — Overlay learner confidence on the heat map so users distinguish solid beliefs from guesses.
61502. **Session-learning governance** — Define who approves learner-driven autonomous decisions at each confidence tier.
61503. **Learning-based report prioritization** — Order report findings using learned severity-accuracy to put the most reliable findings first.
61504. **Intra-hunt learning retrospective** — End each hunt with an auto-generated review of what was learned, what changed, and what to carry forward.
61505. **Mirrored-scope experiment setup** — Split a target's scope into two statistically comparable halves to test competing strategies head-to-head.
61506. **Strategy traffic splitter** — Route probe traffic between strategy A and B with configurable ratios while keeping sessions isolated.
61507. **Significance-testing engine** — Apply proper statistical tests to finding-rate differences before declaring a strategy winner.
61508. **Winner-promotion protocol** — Define the formal handoff: significance reached, loser retired, winner scaled to full scope.
61509. **Experiment-hygiene guardrails** — Prevent cross-contamination (shared sessions, shared rate limits) from invalidating A/B results.
61510. **Multi-armed experiment support** — Test three or more strategies simultaneously with adaptive traffic allocation to emerging winners.
61511. **Experiment-library catalog** — Maintain reusable experiment templates (stealth vs speed, breadth vs depth) launchable in one click.
61512. **Minimum-detectable-effect calculator** — Compute the sample size each strategy needs before the experiment can detect meaningful differences.
61513. **Experiment-budget allocator** — Reserve a fixed slice of hunt budget for experimentation without starving the main effort.
61514. **A/B outcome reporting** — Generate experiment report cards showing lift, confidence intervals, and the decision rationale.
61515. **Sequential experiment monitoring** — Use sequential testing methods to stop experiments early when a winner is clear, saving budget.
61516. **Experiment-stratification** — Stratify mirrored halves by endpoint type so both strategies face equivalent mixes of easy and hard targets.
61517. **Carryover-effect detection** — Detect when strategy A's probes alter the target state (sessions, caches) in ways that bias strategy B's results.
61518. **Experiment-blind mode** — Hide which strategy is winning from the agent's other decision systems to prevent feedback contamination.
61519. **Loser-analysis reports** — Auto-analyze why the losing strategy underperformed to extract lessons beyond the win/loss verdict.
61520. **Experiment-approval workflow** — Require user sign-off for experiments on production targets, auto-approve on staging.
61521. **Cross-hunt experiment memory** — Remember which strategy won on similar targets and seed future experiments with that prior.
61522. **Experiment-interference alerts** — Warn when external factors (target deploy, traffic spikes) threaten experiment validity mid-run.
61523. **Adaptive-traffic experiments** — Shift traffic toward the leading strategy during the experiment using bandit-style allocation.
61524. **Experiment-fairness verification** — Continuously verify both arms receive equivalent target conditions (latency, error rates).
61525. **Holdout-arm design** — Keep a small control arm running the baseline strategy even after a winner is promoted, for ongoing validation.
61526. **Experiment-timeline visualization** — Show both strategies' cumulative findings over time so the user watches the race unfold.
61527. **Peeking-bias protection** — Prevent premature winner declarations from repeated significance peeking with proper alpha-spending.
61528. **Experiment-segment analysis** — Break down results by endpoint type to discover strategies that win overall but lose on specific segments.
61529. **Meta-experiment scheduler** — Automatically propose the next experiment based on current strategic uncertainties in the hunt.
61530. **Experiment-cost accounting** — Track the opportunity cost of running the inferior arm and report experiment ROI.
61531. **Strategy-champion registry** — Crown per-target-type champion strategies from experiment history for fast future selection.
61532. **Experiment-replication** — Re-run a concluded experiment on a fresh scope slice to verify the winner replicates before fleet-wide adoption.
61533. **Interaction-effect detection** — Test whether strategy effectiveness depends on hunt phase, not just the strategy itself.
61534. **Experiment-pause protocol** — Gracefully pause experiments during target incidents and resume with validity checks afterward.
61535. **A/B-tested trigger thresholds** — Use experiments to tune the very switch triggers from theme 1, closing the adaptation loop.
61536. **Experiment-data export** — Export full per-probe experiment data for external statistical analysis.
61537. **Novelty-effect correction** — Discount early experiment leads that come from novelty rather than sustained superiority.
61538. **Experiment-arm isolation** — Enforce separate credentials, sessions, and IP rotation per arm where the target might link behavior.
61539. **Winner-decay monitoring** — Keep watching promoted winners; demote them if their edge evaporates on new scope.
61540. **Experiment-idea backlog** — Maintain a prioritized backlog of strategy comparisons proposed by the agent, researchers, and fleet analytics.
61541. **Contextual experiment results** — Qualify every verdict with the target type, phase, and conditions so winners aren't overgeneralized.
61542. **Experiment-velocity metric** — Track how many conclusive experiments the fleet runs per week as an innovation KPI.
61543. **Failed-experiment post-mortems** — Analyze inconclusive experiments to distinguish "no difference" from "bad design".
61544. **Experiment-template versioning** — Version experiment designs so results stay comparable as templates evolve.
61545. **Cross-team experiment sharing** — Let teams share experiment designs and results without exposing sensitive target details.
61546. **Experiment-ethics review** — Flag experiments that could double the load on fragile production targets for extra approval.
61547. **Bandit-to-AB graduation** — Promote promising bandit-tested tactics into formal A/B experiments for rigorous validation.
61548. **Experiment-arm health checks** — Monitor each arm for stuck queues or dead sessions that would silently invalidate results.
61549. **Winner-rollout planner** — Plan the phased rollout of a winning strategy across the remaining scope with risk checkpoints.
61550. **Experiment-dashboard** — A dedicated view showing all live experiments, their arms, traffic splits, and interim statistics.
61551. **Historical-experiment search** — Search past experiments by strategy pair and target type before launching a duplicate.
61552. **Experiment-sample-ratio-mismatch detection** — Alert when actual traffic splits deviate from planned ratios, indicating routing bugs.
61553. **Strategy-embeddings for matching** — Match new strategies to historically tested similar ones to predict experiment outcomes.
61554. **Experiment-budget burn alerts** — Warn when an experiment consumes disproportionate budget without approaching significance.
61555. **Multi-metric experiment scoring** — Judge strategies on findings, stealth, speed, and coverage together, not finding count alone.
61556. **Experiment-winner confidence tiers** — Label verdicts as proven, suggestive, or inconclusive based on statistical strength.
61557. **Loser-quarantine policy** — Temporarily exclude losing strategies from auto-selection on similar targets pending re-validation.
61558. **Experiment-narrative generator** — Produce plain-language experiment summaries for stakeholders who don't read p-values.
61559. **Cross-phase experiment continuity** — Carry experiment learnings across hunt phases instead of resetting at phase boundaries.
61560. **Experiment-arm mimicry detection** — Ensure the two arms don't converge on identical behavior, which would void the comparison.
61561. **Experiment-priority queue** — Rank proposed experiments by expected information value and run the highest-value ones first.
61562. **A/B-tested payload families** — Run payload-family shootouts on mirrored endpoints to discover the best generators per target type.
61563. **Experiment-data retention** — Retain experiment datasets long enough for re-analysis as statistical methods improve.
61564. **Winner-generalization scoring** — Score how likely a winning strategy is to generalize beyond the tested target before promoting it fleet-wide.
61565. **Experiment-interruption handling** — Define exactly how to treat data from experiments interrupted by user pauses or target outages.
61566. **Strategy-tournament brackets** — Run elimination tournaments across many candidate strategies to find champions efficiently.
61567. **Experiment-calibration checks** — Periodically run A/A tests (identical strategies) to verify the experiment machinery reports no false winners.
61568. **Contextual-bandit experiments** — Allocate experiment traffic using contextual bandits that learn which strategy fits which endpoint type.
61569. **Experiment-result API** — Expose experiment verdicts programmatically so the strategy portfolio auto-updates from wins.
61570. **Human-judged experiment arms** — Include researcher-rated finding quality as an experiment metric, not just machine-counted findings.
61571. **Experiment-scope mirroring validator** — Statistically validate that the two scope halves are truly comparable before the experiment starts.
61572. **Time-varying strategy tests** — Test whether strategy A beats B early but loses late, informing phase-specific strategy choices.
61573. **Experiment-cost-benefit gate** — Require proposed experiments to pass an expected-value gate before consuming hunt budget.
61574. **Winner-adoption tracking** — Track whether promoted winners actually get adopted and sustain their edge in production hunts.
61575. **Experiment-failure taxonomy** — Classify failed experiments (underpowered, contaminated, interrupted) to improve future designs.
61576. **Strategy-diversity experiments** — Test whether running diverse strategy pairs beats running the single best strategy twice.
61577. **Experiment-blind-spot analysis** — Check that experiments don't systematically neglect areas neither strategy covers well.
61578. **Cross-fleet experiment pooling** — Pool experiment data across hunts on similar targets for faster significance.
61579. **Experiment-arm switch auditing** — Log every traffic-allocation change during adaptive experiments for reproducibility.
61580. **Winner-explanation engine** — Generate hypotheses about why the winner won (pace, probe mix, ordering) for strategy design insights.
61581. **Experiment-scheduling optimizer** — Schedule experiments during the hunt phases where their answers are most actionable.
61582. **A/B-tested reporting formats** — Experiment with different finding-presentation styles to see which researchers resolve fastest.
61583. **Experiment-guardian agent** — A watchdog that monitors experiment validity in real time and pauses compromised experiments automatically.
61584. **Strategy-swap experiments** — Mid-experiment, swap the arms' scope halves to control for scope-half effects.
61585. **Experiment-learning-rate link** — Feed experiment results into the intra-hunt learner so validated winners get immediate belief boosts.
61586. **Minimum-runtime enforcement** — Prevent experiments from concluding before a minimum runtime, avoiding novelty-driven false verdicts.
61587. **Experiment-portfolio dashboard** — Fleet-level view of all experiments, their status, and cumulative learnings.
61588. **Winner-champion defense** — Periodically re-test reigning champions against challengers to prevent strategy stagnation.
61589. **Experiment-data anonymization** — Strip target-identifying details from shared experiment datasets for safe collaboration.
61590. **Cross-vector experiment design** — Test strategy pairs that differ in exactly one dimension to isolate what drives performance.
61591. **Experiment-result notifications** — Alert relevant users the moment an experiment reaches a confident verdict.
61592. **A/B-tested stealth profiles** — Compare stealth settings head-to-head on detection rate versus finding rate.
61593. **Experiment-replay capability** — Replay an experiment's decisions against logged data to audit the verdict.
61594. **Strategy-fitness experiment loop** — Continuously evolve the strategy pool through scheduled tournaments and promotions.
61595. **Experiment-bias self-check** — Automatically test whether the experimenter's own preferences leak into arm configuration.
61596. **Winner-rollback plan** — Keep the losing strategy warm briefly after promotion in case the winner regresses on new scope.
61597. **Experiment-insight knowledge base** — Distill every concluded experiment into a searchable insight entry for strategy designers.
61598. **Multi-objective experiment verdicts** — Declare winners per objective (speed champion, stealth champion) when no strategy dominates all.
61599. **Experiment-simulation sandbox** — Simulate proposed experiments against historical data to right-size them before launch.
61600. **A/B-tested learning rates** — Experiment with intra-hunt learning aggressiveness to find the best adaptation speed per target type.
61601. **Experiment-arm cost parity** — Ensure compared arms spend equivalent budget so verdicts reflect efficiency, not spend.
61602. **Winner-promotion announcements** — Broadcast strategy promotions fleet-wide with evidence so all hunts benefit immediately.
61603. **Experiment-debt tracking** — Track strategic questions that lack experimental answers and prioritize them in the backlog.
61604. **Experiment-maturity model** — Grade the organization's experimentation practice from ad-hoc to continuous, with improvement roadmaps.
61605. **Bandit-based attention allocator** — Use multi-armed bandit algorithms to distribute probes between known-good tactics and untested ones.
61606. **Novelty-bonus scoring** — Add an explicit exploration bonus to untried endpoints and tactics so the scheduler doesn't ignore them.
61607. **Coverage-vs-depth dial** — A single user control that shifts the hunt along the explore-exploit spectrum in real time.
61608. **Frontier-tracking map** — Visualize the boundary between tested and untested attack surface as an explorable frontier.
61609. **Diminishing-returns switchpoint** — Detect when exploitation stops paying and automatically pivot budget back to exploration.
61610. **Exploration-budget reserve** — Ring-fence a fixed percentage of probes purely for exploration, untouchable by exploitation demands.
61611. **Adaptive epsilon-greedy** — Tune the exploration rate dynamically: high early, decaying as the hunt matures, spiking on new discoveries.
61612. **Exploration-portfolio manager** — Maintain a set of exploration tactics (novel payloads, odd endpoints, weird methods) rotated systematically.
61613. **Exploitation-depth governor** — Cap how deep exploitation may go on a single lead before exploration gets its turn.
61614. **Balance-health metric** — A live score showing whether the hunt is over-exploring (shallow everywhere) or over-exploiting (tunnel vision).
61615. **UCB probe selection** — Apply upper-confidence-bound selection to choose the next probe, balancing known payoff with uncertainty.
61616. **Thompson-sampling scheduler** — Sample tactic choices from learned payoff distributions to achieve principled explore-exploit balance.
61617. **Exploration-diversity quota** — Require a minimum variety of probe families per hour so exploration stays genuinely diverse.
61618. **Exploitation-cascade limiter** — Limit how many follow-up probes one finding can trigger before exploration resumes.
61619. **Novel-endpoint discovery bonus** — Reward the scheduler for finding previously unknown endpoints, not just testing known ones.
61620. **Explore-exploit phase planner** — Plan explicit phase transitions (explore → exploit → re-explore) instead of leaving the balance to chance.
61621. **Contextual-bandit endpoint picker** — Choose which endpoint to probe next using features like tech stack, parameter richness, and auth state.
61622. **Exploration-regret tracking** — Measure findings missed in under-explored areas via post-hunt sampling to calibrate the balance.
61623. **Exploitation-validation fast lane** — Give exploitation a fast lane for confirming findings while exploration continues in parallel.
61624. **Balance-policy presets** — Ship presets (pioneer, settler, balanced) encoding different explore-exploit philosophies per hunt goal.
61625. **Frontier-expansion incentives** — Bonus the scheduler for pushing the tested frontier into entirely new modules or subdomains.
61626. **Exploitation-confidence requirement** — Only allow deep exploitation when the learner's confidence in the payoff exceeds a threshold.
61627. **Exploration-sprint scheduling** — Dedicate whole sprints purely to exploration at planned hunt milestones.
61628. **Balance-drift alerts** — Notify when the actual explore-exploit ratio drifts from the planned ratio beyond tolerance.
61629. **Information-gain estimator** — Estimate each probe's expected information gain and prefer high-gain exploratory probes early.
61630. **Exploitation-saturation signal** — Detect when a lead's marginal payoff flattens and release its budget back to exploration automatically.
61631. **Novelty-decay curves** — Model how fast novelty bonuses should fade per area type so exploration stays fresh without thrashing.
61632. **Explore-exploit audit view** — Show the hunt's probe mix over time as a stacked chart for post-hunt balance review.
61633. **Curiosity-driven probing** — Bonus probes that maximize the learner's uncertainty reduction, even with no immediate finding payoff.
61634. **Exploitation-opportunity scoring** — Score each lead's exploitation potential so the best leads win exploitation budget competitively.
61635. **Exploration-seed strategies** — Seed exploration with diverse starting points (sitemap, JS files, robots.txt, API docs) systematically.
61636. **Balance-tuning experiments** — A/B test explore-exploit ratios on mirrored scope to find the sweet spot per target type.
61637. **Exploitation-time caps** — Hard-cap continuous exploitation time per lead to guarantee exploration gets regular turns.
61638. **Frontier-heat overlay** — Overlay exploration frontier with finding heat to spot high-potential unexplored neighbors of hot zones.
61639. **Exploration-quality scoring** — Score exploration not by probe count but by genuinely new surface covered per probe.
61640. **Exploitation-depth receipts** — Itemize what each exploitation dive cost and found, keeping deep dives accountable.
61641. **Balance-aware rate limiting** — Spend scarce rate-limit allowance preferentially on exploitation of confirmed leads over speculative exploration.
61642. **Novelty-source tracking** — Attribute discoveries to their exploration source to learn which seeding strategies work best.
61643. **Explore-exploit handoff protocol** — Formalize how a discovery graduates from exploration to exploitation with clear criteria.
61644. **Exploitation-parallelism control** — Limit concurrent deep dives so one mega-lead can't consume all exploitation capacity.
61645. **Exploration-breadth guarantees** — Guarantee minimum coverage breadth before any exploitation dive may exceed a depth threshold.
61646. **Balance-maturity stages** — Define hunt maturity stages (infant explorer → adolescent balancer → mature exploiter) with stage-appropriate policies.
61647. **Curiosity-budget accounting** — Track pure-curiosity probes separately so their long-term value can be measured honestly.
61648. **Exploitation-yield forecasting** — Predict a lead's remaining yield from early exploitation signals to decide when to stop digging.
61649. **Exploration-pattern library** — Catalog proven exploration patterns (parameter mining, method fuzzing, path traversal of docs) for systematic use.
61650. **Balance-violation veto** — Let users veto exploitation dives that would breach the planned explore-exploit ratio on supervised hunts.
61651. **Frontier-staleness detection** — Flag frontier regions untouched for too long and schedule targeted exploration sorties.
61652. **Exploitation-cannibalization guard** — Prevent exploitation of one lead from starving the validation of another confirmed finding.
61653. **Novelty-bonus calibration** — Tune novelty bonuses from historical data on how often novel probes actually paid off per target type.
61654. **Explore-exploit equilibrium finder** — Continuously solve for the allocation that maximizes expected total findings given remaining budget.
61655. **Exploitation-evidence standards** — Require stronger evidence for deeper exploitation tiers to keep deep dives honest.
61656. **Exploration-telemetry export** — Export exploration coverage data for integration with external asset-discovery tools.
61657. **Balance-policy inheritance** — Carry tuned explore-exploit policies from parent hunts to retests and expansions.
61658. **Exploitation-lead ranking** — Rank all active leads by expected remaining value so exploitation always works the best lead first.
61659. **Frontier-priority scoring** — Score unexplored frontier regions by predicted value using tech signals and structural hints.
61660. **Exploration-fatigue detection** — Detect when exploration keeps returning empty and shift to exploitation rather than grinding.
61661. **Balance-dashboard** — Real-time dashboard with the explore-exploit ratio, frontier size, lead queue, and balance health.
61662. **Exploitation-spillover capture** — When exploitation uncovers adjacent new surface, log it as exploration credit to keep metrics honest.
61663. **Novelty-weighted reporting** — Note in reports which findings came from deliberate exploration versus exploitation follow-through.
61664. **Explore-exploit skill separation** — Run exploration and exploitation as distinct scheduler lanes with their own budgets and policies.
61665. **Balance-backtesting harness** — Replay hunts with different balance policies to find the optimal ratio empirically.
61666. **Exploitation-depth benchmarking** — Compare dive depths against fleet norms to spot hunts digging too shallow or too deep.
61667. **Frontier-completeness metric** — Track what fraction of the discoverable frontier has been pushed, as an exploration KPI.
61668. **Exploration-incentive alignment** — Align the agent's internal rewards so exploration that finds nothing still earns credit for coverage gained.
61669. **Exploitation-bottleneck detection** — Identify when findings queue up awaiting exploitation and rebalance capacity toward clearing the backlog.
61670. **Novelty-bonus decay on repetition** — Reduce novelty bonuses for areas that have been "explored" repeatedly without yielding new surface.
61671. **Balance-aware notifications** — Only notify users about balance issues that need decisions, not every minor ratio wobble.
61672. **Exploitation-chain budgeting** — Budget multi-step chain exploitation separately from single-finding validation.
61673. **Frontier-expansion retrospectives** — Review which frontier pushes paid off to refine frontier-priority scoring.
61674. **Explore-exploit toggle in chat** — Let users tell the mid-hunt chat "explore more" or "dig deeper here" to shift the balance conversationally.
61675. **Balance-policy marketplace** — Share community explore-exploit policies tuned for specific industries or tech stacks.
61676. **Exploitation-interrupt protocol** — Define how exploration can interrupt a low-yield exploitation dive with minimal context loss.
61677. **Novelty-source diversification** — Ensure exploration seeds come from diverse sources, not just the crawler's link graph.
61678. **Balance-stability scoring** — Penalize balance policies that oscillate wildly, favoring smooth, deliberate shifts.
61679. **Exploitation-milestone tracking** — Track leads through validation stages (suspected → confirmed → chained → reported) with per-stage budgets.
61680. **Frontier-risk weighting** — Weight frontier regions by business risk so exploration prioritizes high-impact unknowns.
61681. **Exploration-debt repayment** — Schedule dedicated exploration to repay areas skipped during intense exploitation phases.
61682. **Balance-aware stealth** — Factor that exploration is noisier than targeted exploitation into stealth-sensitive balance decisions.
61683. **Exploitation-yield leaderboard** — Rank leads by realized yield to train the opportunity scorer on ground truth.
61684. **Novelty-bonus for new tech** — Give extra exploration bonus to newly fingerprinted technologies the hunt hasn't tested before.
61685. **Balance-policy documentation** — Auto-generate readable docs of the active explore-exploit policy at hunt start.
61686. **Exploitation-pause for re-exploration** — Periodically pause all exploitation for a pure exploration sweep at hunt milestones.
61687. **Frontier-visualization export** — Export frontier maps as shareable visuals for client status updates.
61688. **Explore-exploit correlation analysis** — Analyze whether exploration-heavy hunts actually find more, controlling for target type.
61689. **Exploitation-depth auto-limits** — Set per-lead depth limits from predicted yield so dives stop at the point of diminishing returns.
61690. **Novelty-bonus audit** — Review whether novelty bonuses actually drove valuable discoveries or just burned budget.
61691. **Balance-guardian mode** — Ultra-conservative balance mode for fragile targets: minimal exploration noise, exploitation only on strong leads.
61692. **Exploitation-evidence freshness** — Require exploitation evidence to be re-confirmed if the lead goes cold before reporting.
61693. **Frontier-priority user overrides** — Let users manually boost frontier regions ("definitely check the mobile API") with one click.
61694. **Balance-metric API** — Expose live explore-exploit metrics via API for external monitoring and automation.
61695. **Exploitation-concurrency tuning** — Tune how many simultaneous deep dives the hunt sustains based on target responsiveness.
61696. **Novelty-decay visualization** — Show how novelty bonuses fade over time per area so users understand exploration priorities.
61697. **Balance-retrospective generator** — Auto-produce a post-hunt analysis of whether the explore-exploit balance was right, with evidence.
61698. **Exploitation-lead aging** — Age leads over time so stale leads lose exploitation priority to fresher opportunities.
61699. **Frontier-coverage SLA** — Contractually guarantee a minimum frontier-push rate for managed hunt offerings.
61700. **Explore-exploit co-evolution** — Let exploration and exploitation strategies evolve together, with exploration feeding leads and exploitation feeding lessons back.
61701. **Balance-simulation mode** — Simulate the rest of the hunt under different balance settings to pick the best path forward.
61702. **Exploitation-quality gates** — Require peer-review-style automated checks before a deep dive's findings graduate to reported status.
61703. **Novelty-bonus fairness** — Ensure novelty bonuses don't systematically favor easy-to-reach areas over hard-to-reach high-value ones.
61704. **Adaptive-balance maturity report** — Fleet-level report on explore-exploit effectiveness trends driving continuous policy improvement.
61705. **Per-hunt time budgets** — Set explicit wall-clock budgets per hunt with configurable behavior when the clock runs out.
61706. **Compute-budget metering** — Meter CPU, memory, and brain-inference spend per hunt in real time against allocated quotas.
61707. **Cost-per-finding governor** — Cap the allowable spend per confirmed finding, throttling expensive tactics when the ratio breaches the cap.
61708. **Graceful wind-down sequencer** — As budget depletes, orchestrate an orderly shutdown: finish validations, archive state, draft the summary.
61709. **Budget-burn dashboards** — Live visualization of spend versus progress with projected exhaustion time.
61710. **Budget-reallocation between phases** — Move unspent recon budget into testing phases automatically when recon finishes under budget.
61711. **Overrun-policy engine** — Define what happens on budget overrun: hard stop, user approval to extend, or automatic degraded mode.
61712. **Budget templates** — Ship budget presets (quick scan, standard hunt, deep assessment) with sensible time/compute splits.
61713. **Burn-rate forecasting** — Predict budget exhaustion from current burn rate and warn well before the cliff.
61714. **Budget-alert tiers** — Notify at 50%, 80%, and 95% consumption with escalating detail and suggested actions.
61715. **Cost-aware tactic selection** — Prefer cheaper tactics with similar expected yield when budget runs tight.
61716. **Budget-weighted scheduling** — Schedule expensive probes early when budget is plentiful, cheap probes late.
61717. **Finding-value budgeting** — Allocate bigger budgets to hunts on high-value targets using expected finding value.
61718. **Budget-extension requests** — Let the agent formally request more budget with a justification citing current yield trends.
61719. **Graceful-degradation modes** — Define degraded hunt modes (reduced concurrency, cheaper probes) triggered automatically at budget thresholds.
61720. **Budget-fairness across tenants** — Ensure one tenant's heavy hunt can't consume shared compute beyond its fair share.
61721. **Per-phase budget envelopes** — Give recon, testing, validation, and reporting each its own envelope with controlled borrowing rules.
61722. **Budget-burn attribution** — Attribute every unit of spend to tactic, endpoint, and phase for precise cost accounting.
61723. **Remaining-budget optimizer** — Continuously re-optimize the plan for the remaining budget to maximize expected findings.
61724. **Budget-pause protocol** — Pause the hunt cleanly on user command with exact budget state preserved for resume.
61725. **Cost-of-delay modeling** — Factor the user's time value into budget decisions, not just compute cost.
61726. **Budget-vs-yield analytics** — Post-hunt analysis of spend efficiency feeding better budget templates.
61727. **Minimum-viable-hunt budget** — Compute the smallest budget that can still deliver a meaningful hunt and refuse underfunded starts.
61728. **Budget-top-up automation** — Auto-approve small budget extensions when yield trends strongly justify them, within user-set limits.
61729. **Compute-spot-market usage** — Shift deferrable hunt work to cheaper off-peak compute when the user enables cost optimization.
61730. **Budget-burn anomaly detection** — Flag hunts burning far faster or slower than similar historical hunts for investigation.
61731. **Per-finding cost leaderboard** — Rank hunts and tactics by cost per confirmed finding to drive efficiency culture.
61732. **Budget-gated feature unlocks** — Reserve expensive capabilities (deep chaining, heavy fuzzing) for hunts with sufficient budget.
61733. **Wind-down checklist** — A formal checklist executed during graceful wind-down: evidence sealed, state archived, summary drafted.
61734. **Budget-consumption API** — Programmatic access to live budget state for external orchestration and billing.
61735. **Time-boxed hunt contracts** — Offer hunts as fixed time-box contracts with guaranteed deliverables at each box boundary.
61736. **Budget-rollover policy** — Let unspent budget from one hunt roll into the next hunt on the same target.
61737. **Cost-center tagging** — Tag hunt spend by team, client, or project for chargeback and invoicing.
61738. **Budget-scenario planner** — Let users model "what would $X buy?" before launching, with predicted coverage and finding estimates.
61739. **Emergency-budget reserve** — Hold an untouchable reserve for critical late-hunt validations that must never be starved.
61740. **Budget-burn heat map** — Visualize where budget was spent across the target's surface for accountability.
61741. **Compute-efficiency scoring** — Score tactics by findings per compute-dollar to guide cost-aware selection.
61742. **Budget-aware stealth tradeoffs** — Explicitly model the cost of stealth (slower, more requests) in budget planning.
61743. **Hunt-pacing controller** — Pace spend evenly across the planned hunt duration instead of front-loading everything.
61744. **Budget-exhaustion post-mortem** — When a hunt runs out of budget, auto-analyze whether the budget or the strategy was at fault.
61745. **Multi-currency budget support** — Express budgets in time, compute units, API credits, or money, with conversion between them.
61746. **Budget-approval workflows** — Route budget-extension requests through the user's approval chain with full context attached.
61747. **Cost-per-coverage metric** — Track cost per percentage point of meaningful coverage as a hunt-efficiency KPI.
61748. **Budget-aware retest scoping** — Size retest hunts from the original hunt's spend data, not from scratch estimates.
61749. **Idle-budget reclamation** — Detect paused or stuck hunts holding budget and reclaim it after a configurable idle period.
61750. **Budget-floor guarantees** — Guarantee a minimum useful hunt even under the tightest budget via a prioritized essential-probe list.
61751. **Spend-velocity governors** — Cap how fast budget can burn per hour to prevent runaway tactics from draining the hunt.
61752. **Budget-vs-scope optimizer** — Recommend scope trims when the budget can't cover the full scope at the desired depth.
61753. **Cost-aware evidence depth** — Scale evidence collection thoroughness to remaining budget, keeping critical evidence always complete.
61754. **Budget-dashboard embeds** — Embeddable budget widgets for client portals showing live hunt spend.
61755. **Hunt-budget insurance** — Offer "yield insurance": if a hunt finds nothing, a discounted retest is automatically scheduled.
61756. **Budget-learning loop** — Learn from every hunt's actuals to make the next budget estimate more accurate per target type.
61757. **Time-budget micro-allocations** — Break hunt time into micro-allocations per endpoint cluster with local accountability.
61758. **Budget-breach circuit breaker** — Hard-stop all spending the instant a non-overridable budget cap is hit, with state safely parked.
61759. **Cost-of-findings reporting** — Include a cost-per-finding breakdown in client reports for transparency on hunt economics.
61760. **Budget-aware scheduling windows** — Schedule expensive phases during cheap compute windows when cost optimization is enabled.
61761. **Remaining-value estimator** — Continuously estimate the expected finding value remaining in the hunt versus budget left.
61762. **Budget-triage mode** — Under severe constraint, switch to a triage policy testing only the highest-expected-value areas.
61763. **Spend-approval thresholds** — Require approval for any single tactic or phase projected to exceed a spend threshold.
61764. **Budget-comparison view** — Compare planned versus actual spend per phase in real time with variance explanations.
61765. **Hunt-extension pricing** — Show the user exactly what additional findings an extended budget is likely to buy before they approve.
61766. **Budget-aware model selection** — Choose cheaper brain models for routine decisions and reserve premium inference for hard calls.
61767. **Compute-quota inheritance** — Child hunts inherit remaining quota from parents with full audit trails.
61768. **Budget-burn notifications** — Configurable notifications for burn milestones, anomalies, and projected overruns.
61769. **Zero-budget reconnaissance mode** — A free passive-only mode that never spends probe budget, for initial target assessment.
61770. **Budget-efficiency badges** — Award hunts efficiency badges (gold/silver/bronze) based on cost per validated finding.
61771. **Spend-justification log** — Every major spend decision logged with expected-value reasoning for later audit.
61772. **Budget-aware chain depth** — Limit vulnerability-chain exploration depth by remaining budget with explicit tradeoff logging.
61773. **Time-zone-aware pacing** — Pace hunts to finish during the user's working hours when they want to review results same-day.
61774. **Budget-pool sharing** — Let teams pool hunt budgets across targets with fair-use policies and transparent ledgers.
61775. **Cost-anomaly forensics** — Deep-dive tooling to investigate exactly why a particular hunt overspent.
61776. **Budget-gated parallelism** — Scale concurrency up or down automatically to fit the remaining budget and deadline.
61777. **Hunt-value dashboard** — Show findings value (severity-weighted) against spend as a live ROI gauge.
61778. **Budget-carryover rules** — Define precisely which budget types carry over between hunts and which expire.
61779. **Spend-freeze command** — Instantly freeze all spending hunt-wide on user command, with one-click resume.
61780. **Budget-aware report generation** — Scale report polish (extra PoC variants, screenshots) to remaining budget at hunt end.
61781. **Compute-rightsizing advisor** — Recommend the cheapest compute configuration that still meets the hunt's deadline.
61782. **Budget-variance explanations** — Auto-generate plain-language explanations when actuals deviate from the budget plan.
61783. **Hunt-abandonment economics** — Compute the economics of abandoning versus continuing a low-yield hunt to inform the quit decision.
61784. **Budget-performance regression** — Detect fleet-wide drift in cost efficiency and alert when hunts get more expensive over time.
61785. **Time-budget trading** — Allow phases to trade time allocations with each other through a governed internal market.
61786. **Budget-aware notification batching** — Batch low-priority work to reduce overhead when budget is tight.
61787. **Spend-cap per endpoint** — Prevent any single endpoint from consuming more than its fair share of the hunt budget.
61788. **Budget-health score** — A single 0–100 score combining burn rate, yield, and forecast accuracy for hunt financial health.
61789. **Hunt-budget API webhooks** — Fire webhooks on budget events for integration with finance and ticketing systems.
61790. **Cost-aware target prioritization** — In multi-target operations, fund targets by expected finding value per dollar.
61791. **Budget-scenario comparison** — Compare multiple budget scenarios side-by-side before committing to a hunt plan.
61792. **Wind-down quality gates** — Ensure graceful wind-down still meets minimum evidence and reporting standards before closing.
61793. **Budget-ledger export** — Export the complete spend ledger per hunt for client billing and audits.
61794. **Spend-efficiency coaching** — Give researchers personalized tips on running more cost-efficient hunts from their history.
61795. **Budget-aware auto-scaling** — Scale infrastructure up for well-funded hunts and down for lean ones automatically.
61796. **Hunt-budget governance board** — Team-level view approving, tracking, and reviewing hunt budgets across the organization.
61797. **Cost-per-severity analytics** — Break down hunt cost by finding severity to show where the money actually went.
61798. **Budget-forecast accuracy tracking** — Measure how accurate burn forecasts were and improve the forecasting model continuously.
61799. **Time-budget rescue protocol** — When a hunt falls behind schedule, trigger a formal rescue: re-scope, re-budget, or extend with approval.
61800. **Graceful-degradation testing** — Regularly drill wind-down and degradation modes on staging hunts to prove they work under pressure.
61801. **Budget-aware learning rates** — Slow expensive intra-hunt learning updates when budget is tight, favoring cheap heuristics.
61802. **Spend-transparency mode** — Show the user the live dollar cost of every major agent decision for full economic transparency.
61803. **Hunt-budget benchmarking** — Compare hunt budgets and efficiency against anonymized fleet benchmarks per target type.
61804. **Budget-maturity model** — Grade budget management practice from ad-hoc to optimized, guiding teams toward better hunt economics.
61805. **Sprint-based hunt planner** — Divide each hunt into fixed-length sprints with planned goals, replacing one monolithic run.
61806. **Sprint-goal setter** — Define measurable goals per sprint (e.g., "map checkout flow, validate 3 IDOR hypotheses") before it starts.
61807. **Sprint-review ceremony** — Auto-generate an end-of-sprint review summarizing goals hit, findings, and learnings for user sign-off.
61808. **In-sprint velocity tracking** — Measure probes executed, coverage gained, and findings per sprint as a live velocity chart.
61809. **Sprint-retrospective generator** — Produce a structured retro after each sprint: what worked, what didn't, what changes next sprint.
61810. **Sprint-backlog manager** — Maintain a prioritized backlog of testing tasks that sprints pull from, with reprioritization between sprints.
61811. **Sprint-carryover handling** — Formally carry unfinished sprint tasks forward with explicit re-planning rather than silent drift.
61812. **Sprint-board visualization** — Kanban-style board showing testing tasks moving through planned, active, validating, and done.
61813. **Sprint-demo snapshots** — Capture a demo-ready snapshot at each sprint end showing new findings with evidence for stakeholders.
61814. **Sprint-failure recovery** — Define recovery paths when a sprint misses its goals: extend, re-scope, or escalate with user input.
61815. **Sprint-capacity planning** — Estimate each sprint's achievable scope from historical velocity before committing to goals.
61816. **Sprint-goal achievement scoring** — Score sprints on goal completion to calibrate future planning accuracy.
61817. **Cross-sprint learning transfer** — Ensure lessons from sprint N's retro are encoded into sprint N+1's plan automatically.
61818. **Sprint-interruption protocol** — Handle mid-sprint interruptions (user pause, target incident) with clean state preservation and resume.
61819. **Sprint-theme assignment** — Give each sprint a theme (auth week, API week, logic week) to focus effort coherently.
61820. **Sprint-burndown charts** — Show remaining sprint tasks burning down over time so progress is visible at a glance.
61821. **Sprint-planning assistant** — AI-drafted sprint plans from the backlog and hunt context, editable by the user before approval.
61822. **Sprint-goal negotiation** — Let the user adjust proposed sprint goals conversationally via mid-hunt chat before the sprint locks.
61823. **Sprint-velocity forecasting** — Predict end-of-sprint completion from current velocity with confidence intervals.
61824. **Sprint-scope-change control** — Govern mid-sprint scope changes with a lightweight approval capturing reason and impact.
61825. **Sprint-standalone reporting** — Generate a mini-report per sprint so stakeholders get value even if the hunt continues.
61826. **Sprint-health indicators** — Green/amber/red health per sprint from velocity, blockers, and goal-risk signals.
61827. **Sprint-blocker tracker** — Log blockers (rate limits, dead sessions, WAF blocks) per sprint with resolution ownership.
61828. **Sprint-comparison analytics** — Compare velocity and yield across sprints to spot improving or degrading hunt dynamics.
61829. **Sprint-goal templates** — Reusable goal templates per target type (e.g., "API sprint: test all mutations on 20 endpoints").
61830. **Sprint-time-box enforcement** — Hard-stop sprint work at the time box end, forcing planning discipline and preventing sprawl.
61831. **Sprint-review approval gate** — Require user approval of the sprint review before the next sprint's plan executes on supervised hunts.
61832. **Sprint-backlog grooming** — Periodically re-estimate and reprioritize backlog items between sprints with agent assistance.
61833. **Sprint-demo scheduling** — Schedule stakeholder demos at sprint boundaries automatically for managed hunt offerings.
61834. **Sprint-risk register** — Maintain per-sprint risks (target instability, budget shortfall) with mitigation owners.
61835. **Sprint-velocity normalization** — Normalize velocity for target difficulty so sprints on hard targets aren't misjudged.
61836. **Sprint-goal traceability** — Link every finding back to the sprint goal that produced it for accountability.
61837. **Sprint-pause-and-resume** — Pause a sprint mid-execution preserving all state, resuming later without losing context.
61838. **Sprint-overlap planning** — Plan the next sprint during the current sprint's final stretch to eliminate idle gaps.
61839. **Sprint-capacity buffers** — Reserve buffer capacity per sprint for emergent hot-zone surges without breaking the plan.
61840. **Sprint-definition-of-done** — Formal checklists defining when a testing task counts as done (probed, validated, evidenced).
61841. **Sprint-goal stretch targets** — Set ambitious stretch goals alongside committed goals to motivate without punishing misses.
61842. **Sprint-timeline export** — Export the sprint plan and results as a shareable timeline for client status meetings.
61843. **Sprint-efficiency coaching** — Suggest process improvements from sprint data, like reordering tasks that consistently block.
61844. **Sprint-budget envelopes** — Give each sprint its own time/compute envelope with borrowing rules between sprints.
61845. **Sprint-goal dependency mapping** — Map dependencies between sprint goals so the planner sequences them correctly.
61846. **Sprint-review recordings** — Save narrated sprint-review summaries as shareable artifacts for async stakeholders.
61847. **Sprint-velocity leaderboards** — Compare sprint velocity across hunts (anonymized) to identify best practices fleet-wide.
61848. **Sprint-goal risk scoring** — Score each proposed goal's achievability from historical data before the sprint commits.
61849. **Sprint-context briefs** — Auto-generate a briefing doc at each sprint start summarizing state, goals, and known risks.
61850. **Sprint-end state snapshots** — Immutable snapshots of hunt state at every sprint boundary for audit and replay.
61851. **Sprint-goal amendment log** — Track every change to sprint goals mid-sprint with reasons for governance.
61852. **Sprint-parallelization planner** — Identify which sprint tasks can run in parallel versus sequentially for optimal scheduling.
61853. **Sprint-demo feedback loop** — Capture stakeholder feedback on sprint demos and convert it into backlog items automatically.
61854. **Sprint-velocity debt** — Track planned-but-unfinished work as velocity debt that future sprints must explicitly schedule.
61855. **Sprint-goal alignment check** — Verify each sprint's goals still align with the overall hunt objectives before locking.
61856. **Sprint-interruption analytics** — Analyze interruption patterns to reduce their frequency and impact over time.
61857. **Sprint-team assignments** — In collaborative hunts, assign sprint tasks to specific researchers or agents with clear ownership.
61858. **Sprint-goal completion certificates** — Formal sign-off artifacts per completed sprint for compliance-heavy engagements.
61859. **Sprint-burnup charts** — Show cumulative completed work against total planned scope as an alternative progress view.
61860. **Sprint-planning poker** — Gamified effort estimation where the agent and user converge on task sizes before sprint start.
61861. **Sprint-goal auto-decomposition** — Break high-level goals into concrete probe tasks automatically during planning.
61862. **Sprint-review action items** — Convert retro decisions into tracked action items with owners and due sprints.
61863. **Sprint-calendar integration** — Sync sprint boundaries and reviews with the user's calendar for managed engagements.
61864. **Sprint-goal confidence levels** — Attach confidence to each goal so stakeholders see which are safe bets versus moonshots.
61865. **Sprint-waste analysis** — Identify probes and tasks that consumed sprint capacity without contributing to goals, and eliminate them.
61866. **Sprint-handoff protocol** — Formal handoff between sprints: state transfer, open-item briefing, and plan acknowledgment.
61867. **Sprint-goal prioritization matrix** — Rank goals by expected finding value versus cost to sequence sprints optimally.
61868. **Sprint-demo automation** — Auto-assemble demo materials (finding summaries, evidence clips) from sprint artifacts.
61869. **Sprint-velocity confidence bands** — Show velocity forecasts with uncertainty bands so plans reflect real variability.
61870. **Sprint-goal kill criteria** — Define in advance when a sprint goal should be abandoned rather than pursued past its value.
61871. **Sprint-learning capture** — Structured capture of tactical learnings per sprint feeding the intra-hunt learner and knowledge base.
61872. **Sprint-budget burndown** — Track sprint budget consumption against plan with the same rigor as task burndown.
61873. **Sprint-goal stakeholder mapping** — Map each goal to the stakeholder who cares about it for targeted demo content.
61874. **Sprint-retro action verification** — Verify retro action items were actually implemented in the following sprint.
61875. **Sprint-planning time-box** — Time-box the planning ceremony itself so it doesn't consume disproportionate hunt time.
61876. **Sprint-goal progress API** — Programmatic access to sprint progress for external dashboards and client portals.
61877. **Sprint-compression option** — Allow compressing remaining sprints when a hunt must finish early, with automatic reprioritization.
61878. **Sprint-extension protocol** — Governed process for extending a sprint's time box with documented justification.
61879. **Sprint-goal quality gates** — Require goals to be specific, measurable, and risk-scored before sprint lock.
61880. **Sprint-velocity anomaly alerts** — Alert when sprint velocity deviates sharply from plan, triggering diagnostic review.
61881. **Sprint-backlog aging** — Flag backlog items aging across multiple sprints for re-estimation or removal.
61882. **Sprint-goal dependency alerts** — Warn when a dependency slips, threatening dependent sprint goals.
61883. **Sprint-demo Q&A capture** — Record stakeholder questions from demos as new backlog items or scope considerations.
61884. **Sprint-performance scorecards** — Per-sprint scorecards grading planning accuracy, velocity, yield, and learning capture.
61885. **Sprint-goal rebalancing** — Mid-sprint rebalancing of goal priorities when new high-value findings emerge.
61886. **Sprint-context switching cost** — Account for the overhead of sprint transitions in capacity planning.
61887. **Sprint-goal achievement predictions** — ML-based predictions of goal completion likelihood updated daily within the sprint.
61888. **Sprint-artifact repository** — Central per-sprint storage of plans, reviews, demos, and retros for the hunt record.
61889. **Sprint-goal negotiation history** — Keep the full negotiation trail of how sprint goals were set for accountability.
61890. **Sprint-velocity benchmarking** — Benchmark sprint velocity against similar hunts to set realistic expectations.
61891. **Sprint-goal risk mitigation** — Attach explicit mitigation plans to high-risk sprint goals during planning.
61892. **Sprint-end retrospectives archive** — Searchable archive of all sprint retros feeding organizational learning.
61893. **Sprint-goal outcome linking** — Link completed goals to the findings and coverage they produced for ROI analysis.
61894. **Sprint-planning checklists** — Standardized checklists ensuring nothing (budget, scope, risks) is missed in planning.
61895. **Sprint-velocity smoothing** — Use rolling averages to avoid overreacting to single-sprint velocity spikes or dips.
61896. **Sprint-goal visibility wall** — Always-visible display of current sprint goals in the hunt UI for constant alignment.
61897. **Sprint-interruption cost tracking** — Measure the cost of interruptions to motivate protecting sprint focus time.
61898. **Sprint-goal completion webhooks** — Emit events as goals complete for integration with project management tools.
61899. **Sprint-planning retrospectives** — Review the planning process itself quarterly to improve estimation and goal-setting.
61900. **Sprint-maturity model** — Grade sprint discipline from ad-hoc to optimized, guiding teams toward better hunt execution.
61901. **Sprint-goal dependency visualization** — Graph view of goal dependencies revealing critical paths through the hunt.
61902. **Sprint-capacity forecasting** — Forecast available capacity for future sprints from current burn and planned changes.
61903. **Sprint-demo effectiveness scoring** — Score demos on stakeholder comprehension to improve future demo content.
61904. **Adaptive-sprint retrospective** — Fleet-level analysis of sprint data continuously refining sprint planning defaults.
61905. **Scope-expansion signal detector** — Identify live signals (shared infra, linked subdomains, API references) that justify proposing scope growth.
61906. **Scope-contraction recommender** — Recommend trimming scope areas that prove out-of-scope, decommissioned, or unproductive, with evidence.
61907. **Scope-change proposal flow** — Generate structured expansion/contraction proposals for user approval with rationale, risk, and expected value.
61908. **Out-of-scope near-miss log** — Record interesting findings just outside scope without testing them, creating a ready list for scope negotiations.
61909. **Scope-diff visualization** — Show exactly what changed between scope versions as an annotated diff for audit clarity.
61910. **Scope-change history** — Immutable timeline of every scope addition and removal with who approved it and why.
61911. **Adaptive-scope guardrails** — Hard rules preventing automatic scope changes from touching production-critical or legally sensitive assets.
61912. **Scope-budget linkage** — Automatically recompute budget needs when scope changes, flagging expansions the budget can't support.
61913. **Scope-expansion ROI estimator** — Estimate the expected finding value of a proposed scope addition before the user approves it.
61914. **Near-miss triage queue** — Prioritize out-of-scope near-misses by severity signals so the most valuable ones get proposed first.
61915. **Scope-proposal templates** — Prebuilt proposal formats for common expansions (subdomain, API version, mobile backend) with auto-filled evidence.
61916. **Scope-change notifications** — Alert stakeholders the moment scope changes are proposed, approved, or rejected.
61917. **Auto-scope-discovery** — Continuously discover in-scope-adjacent assets during the hunt and queue them as expansion candidates.
61918. **Scope-drift detection** — Detect when actual probing drifts from approved scope and either correct course or propose formal expansion.
61919. **Scope-approval SLAs** — Track proposal-to-decision time so scope decisions don't stall the hunt, with escalation on breach.
61920. **Scope-version pinning** — Pin findings and evidence to the scope version active when they were produced for legal defensibility.
61921. **Scope-expansion experiments** — Trial-test a proposed scope addition with a small probe budget before requesting full approval.
61922. **Scope-contraction savings report** — Show budget and time saved by each approved contraction to demonstrate hunt efficiency.
61923. **Near-miss severity pre-scoring** — Estimate the severity of near-miss observations from passive signals to prioritize proposals.
61924. **Scope-change impact analysis** — Analyze how a proposed change affects coverage, budget, timeline, and risk before approval.
61925. **Scope-boundary heat map** — Visualize finding heat near scope edges to make expansion decisions data-driven.
61926. **Scope-proposal approval tiers** — Auto-approve trivial expansions (same-domain subpaths), escalate risky ones (new domains, prod systems).
61927. **Scope-change rollback** — Revert a scope expansion cleanly, quarantining any findings from the reverted area for review.
61928. **Scope-intelligence feed** — Continuously feed newly discovered asset intelligence into scope proposals throughout the hunt.
61929. **Out-of-scope touch prevention** — Technical enforcement blocking probes to unapproved assets even when the agent's curiosity suggests them.
61930. **Scope-expansion playbooks** — Step-by-step playbooks for evaluating common expansion types with checklists and evidence requirements.
61931. **Scope-change cost accounting** — Track the full cost of each scope change (re-planning, re-budgeting, re-testing) for governance.
61932. **Near-miss export for clients** — Package near-miss observations as a professional "recommended scope additions" appendix for client reports.
61933. **Scope-advisory chatbot** — Conversational interface where users ask "should we include X?" and get an evidence-backed recommendation.
61934. **Scope-change simulation** — Simulate the hunt plan under a proposed scope to show coverage and budget effects before deciding.
61935. **Scope-version comparison** — Compare findings, coverage, and cost across scope versions to learn which expansions paid off.
61936. **Adaptive-scope policy packs** — Configurable policies from conservative (never auto-propose) to aggressive (propose on any signal).
61937. **Scope-expansion veto log** — Record rejected proposals with reasons to avoid re-proposing and to train the proposer.
61938. **Scope-change stakeholder routing** — Route proposals to the right approver based on asset ownership and risk tier.
61939. **Near-miss decay policy** — Age near-miss entries so stale observations don't clutter the triage queue indefinitely.
61940. **Scope-boundary probing rules** — Define exactly how close to the boundary probes may go without triggering a proposal requirement.
61941. **Scope-expansion success tracking** — Measure whether approved expansions actually yielded findings to calibrate future proposals.
61942. **Scope-change audit export** — Export the complete scope-change record for compliance, insurance, or legal review.
61943. **Dynamic-scope contracts** — Offer engagement contracts where scope adapts within pre-approved bounds without per-change paperwork.
61944. **Scope-proposal evidence packs** — Auto-assemble the screenshots, logs, and traces supporting each expansion proposal.
61945. **Scope-contraction approval** — Require explicit approval for contractions too, since removing scope can hide risk from stakeholders.
61946. **Near-miss pattern mining** — Mine near-miss logs across hunts to identify systematically under-scoped asset classes.
61947. **Scope-change frequency governor** — Limit how often scope may change per hunt to keep the engagement stable and reviewable.
61948. **Scope-expansion risk scoring** — Score each proposal's legal, stability, and reputation risk alongside its finding potential.
61949. **Scope-versioned reporting** — Generate report sections segmented by scope version so readers see what was tested under which authorization.
61950. **Adaptive-scope maturity model** — Grade scope-management discipline from static to fully adaptive with improvement guidance.
61951. **Scope-proposal A/B testing** — Test different proposal framings to learn which evidence presentations get approvals fastest.
61952. **Scope-change blackout windows** — Forbid scope changes during critical hunt phases (e.g., final validation) except emergencies.
61953. **Near-miss anonymization** — Strip sensitive details from near-miss logs shared across teams or with the community.
61954. **Scope-expansion dependency check** — Verify a proposed asset doesn't depend on unapproved third-party systems before proposing.
61955. **Scope-change communication templates** — Professional notification templates for informing clients about scope proposals and decisions.
61956. **Scope-drift auto-correction** — When minor drift is detected, automatically steer probes back inside scope and log the correction.
61957. **Scope-proposal priority scoring** — Rank pending proposals by expected value so approvers handle the most important first.
61958. **Scope-change retrospective** — Review all scope decisions post-hunt to improve future scoping accuracy.
61959. **Near-miss to finding pipeline** — When a near-miss area gets approved, automatically convert its log entries into active testing tasks.
61960. **Scope-expansion budget pre-check** — Verify sufficient budget exists for a proposed expansion before bothering the approver.
61961. **Scope-versioned evidence locker** — Store evidence partitioned by scope version for clean legal discovery.
61962. **Adaptive-scope API** — Programmatic scope proposal and approval for integration with client GRC systems.
61963. **Scope-change impact on reports** — Automatically flag report sections affected by late scope changes for re-validation.
61964. **Scope-proposal conversation threading** — Keep full discussion threads on each proposal in mid-hunt chat for context.
61965. **Near-miss heat ranking** — Rank near-misses by passive severity signals so triage focuses on the scariest observations first.
61966. **Scope-expansion time-boxing** — Give newly approved scope areas their own time-boxed trial before full integration into the hunt plan.
61967. **Scope-change policy inheritance** — Child hunts inherit the parent's scope policies and version history with deltas logged.
61968. **Scope-boundary test harness** — Safely verify boundary assets' in/out-of-scope status with minimal-touch probes before proposing.
61969. **Scope-proposal auto-expiry** — Expire unanswered proposals after a configurable window, defaulting to the conservative no-expansion stance.
61970. **Scope-change analytics dashboard** — Fleet view of proposal volume, approval rates, and expansion ROI across all hunts.
61971. **Near-miss deduplication** — Merge duplicate near-miss observations across probes into single triage entries.
61972. **Scope-expansion legal pre-check** — Automatically verify authorization documents cover a proposed asset class before proposal.
61973. **Scope-version diff alerts** — Notify when the active scope version changes so everyone works from the same authorization.
61974. **Adaptive-scope guardrail testing** — Regularly test that scope enforcement actually blocks unapproved probing, with audit proof.
61975. **Scope-proposal success badges** — Recognize proposers (agent or human) whose expansions yielded findings, encouraging good scoping.
61976. **Scope-change emergency protocol** — Fast-track path for urgent expansions (e.g., active incident adjacent to scope) with post-hoc review.
61977. **Near-miss trend analysis** — Track near-miss volume trends to spot scoping practices that systematically miss important assets.
61978. **Scope-expansion stakeholder map** — Map who must approve which asset types so proposals route correctly the first time.
61979. **Scope-change documentation generator** — Auto-produce formal scope amendment documents from approved proposals for the engagement file.
61980. **Scope-versioned billing** — Tie invoicing line items to scope versions so clients see exactly what each expansion cost.
61981. **Adaptive-scope learning loop** — Learn from approval/rejection patterns to propose only expansions this client typically accepts.
61982. **Scope-proposal evidence standards** — Define minimum evidence required per proposal tier to keep proposals credible and reviewable.
61983. **Near-miss review cadence** — Scheduled reviews of the near-miss queue so valuable observations don't languish.
61984. **Scope-change conflict resolution** — Resolve conflicting proposals (expand vs contract the same area) with structured evidence comparison.
61985. **Scope-expansion sandbox testing** — Validate proposed assets in an isolated sandbox before live probing where risk warrants it.
61986. **Scope-versioned hunt replay** — Replay hunts under different scope versions to quantify what each expansion contributed.
61987. **Adaptive-scope notifications digest** — Daily digest of scope activity for stakeholders who don't follow the live feed.
61988. **Scope-proposal machine-readable schema** — Standardize proposals as structured data for automation and cross-tool integration.
61989. **Near-miss severity validation** — Spot-check near-miss severity estimates with minimal safe probes where policy allows.
61990. **Scope-change approval delegation** — Let approvers delegate routine proposal decisions with full audit trails.
61991. **Scope-expansion performance leaderboard** — Rank expansion types by historical finding yield to guide future scoping.
61992. **Scope-version freeze for reporting** — Freeze the scope version during final report generation so the report matches a stable authorization.
61993. **Adaptive-scope exception log** — Log every case where guardrails blocked a desired change, reviewed periodically for policy tuning.
61994. **Scope-proposal collaboration** — Multi-stakeholder proposal workspace with comments, votes, and decision records.
61995. **Near-miss export API** — Programmatic access to near-miss data for SIEM and asset-management integrations.
61996. **Scope-change timeline export** — Shareable visual timeline of scope evolution for client presentations.
61997. **Scope-expansion confidence scoring** — Attach the agent's confidence to each proposal so approvers calibrate their scrutiny.
61998. **Adaptive-scope policy simulator** — Simulate a policy's proposal behavior against historical hunts before deploying it.
61999. **Scope-change post-approval monitoring** — Watch newly approved areas for unexpected risk signals in their first hours of testing.
62000. **Near-miss to scope-playbook feedback** — Feed near-miss patterns back into scoping playbooks so future engagements start with better scope.
62001. **Scope-versioned compliance mapping** — Map each scope version to the compliance controls it satisfies for regulated engagements.
62002. **Adaptive-scope exception approvals** — Governed path for one-time guardrail exceptions with mandatory post-hoc review.
62003. **Scope-proposal outcome tracking** — Track every proposal from signal to decision to finding, closing the loop on scope intelligence.
62004. **Continuous-scope-refinement retrospective** — Fleet-wide quarterly review of scope adaptation data driving the next generation of scoping policy.
