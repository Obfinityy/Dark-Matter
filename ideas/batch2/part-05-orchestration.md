# Part 05 — Hunt orchestration & autonomy

0001. **Dynamic scope expander** — when recon discovers a new subdomain owned by the target org (via WHOIS/cert/ASN correlation), auto-expands scope after a confidence threshold instead of stopping at the pasted URL.
0002. **Scope contraction guard** — automatically removes out-of-scope third-party widgets, CDNs, and SaaS embeds discovered mid-hunt from the active target set so tests never stray.
0003. **ASN-anchored scope inference** — maps the pasted URL's ASN to sibling netblocks and proposes in-scope IP ranges with supporting evidence for review.
0004. **Certificate SAN harvester** — parses Subject Alternative Names from the target's TLS certificate chain to seed candidate subdomains for scope review.
0005. **Passive-DNS scope seeding** — pulls historical DNS records for the apex domain to recover forgotten or legacy subdomains into scope candidates.
0006. **WHOIS org-match correlator** — clusters domains by registrant organization and contact emails to suggest org-wide scope expansion with evidence.
0007. **Cloud-storage scope discovery** — finds org-named S3/GCS/Azure buckets via naming patterns and certificate logs, adding them as scope candidates with confidence scores.
0008. **Mobile-app scope bridge** — extracts API hostnames from the target's public Android APK or iOS app metadata and proposes them as in-scope assets.
0009. **JS-bundle endpoint miner** — statically extracts API base URLs and internal hostnames from the target's JavaScript bundles to grow scope autonomously.
0010. **Scope confidence scorer** — assigns 0–100 evidence scores to each candidate asset; auto-includes ≥90 and queues the rest for human review.
0011. **Scope freeze toggle** — lets the user lock scope at hunt start so autonomous expansion can never surprise them mid-hunt.
0012. **Scope change journal** — every auto-expand or auto-contract writes a timestamped entry with evidence links for audit and reporting.
0013. **Out-of-scope tripwire** — halts testing instantly if a planned request would leave approved scope, raising a one-click expand request instead.
0014. **Third-party CNAME flagger** — detects CNAMEs pointing at external SaaS providers and marks them excluded-but-monitored rather than testing them.
0015. **Typosquat brand-abuse watcher** — scans for lookalike domains of the target brand and reports them as informational scope notes without active testing.
0016. **Punycode homoglyph detector** — flags IDN homographs of the target domain for phishing-risk reporting, kept out of the active test set.
0017. **Parked-domain excluder** — identifies parked or monetized pages among scope candidates and auto-excludes them with a recorded rationale.
0018. **Wildcard-DNS precheck** — probes random subdomains to detect wildcard DNS before spending enumeration budget on brute-forcing.
0019. **Scope diffing between hunts** — compares this hunt's scope against the previous hunt's and highlights new and removed assets first.
0020. **Robots/sitemap scope hints** — parses robots.txt and sitemaps for hidden paths and stages them as scoped path candidates.
0021. **DNS zone-transfer attempt** — tries AXFR against authoritative nameservers once per hunt for cheap, complete enumeration.
0022. **Scope proposal queue** — candidate assets wait in a review queue the user can approve or reject in bulk from the hunt dashboard.
0023. **Bug-bounty program scope import** — imports the program's published scope policy and maps it onto discovered assets automatically.
0024. **Scope policy conflict resolver** — when program policy and discovered assets disagree, defaults to the narrower scope and flags the conflict.
0025. **Dangling-CNAME priority boost** — subdomain-takeover candidates found during expansion jump to the front of the test queue.
0026. **Scope evidence pack** — each expanded asset carries its discovery evidence (certificate-log URL, WHOIS snippet) into the final report.
0027. **IPv6 scope parity** — mirrors every IPv4 scope rule onto discovered AAAA records so IPv6 doesn't become a blind spot.
0028. **Scope TTL and revalidation** — expanded assets expire after N days and must be re-evidenced before the next hunt tests them.
0029. **Org-chart scope mapping** — links discovered assets to business units via certificate O-fields and page footers for reporting context.
0030. **Acquisition-aware scoping** — detects recently acquired brands via WHOIS creation dates and news signals, prompting a scope review.
0031. **Scope-aware payload routing** — every scheduled test carries its scope verdict so workers can never test without a scope decision.
0032. **Shadow-IT detector** — flags assets with valid org certificates that are absent from known inventory as shadow IT in the report.
0033. **WAF-driven scope narrowing** — when a whole ASN starts blocking, automatically contracts active scope to the responsive subset.
0034. **Geographic scope filter** — excludes assets geolocated outside the program's allowed regions when policy requires it.
0035. **Scope simulation mode** — previews what auto-expansion would add without sending any traffic, for pre-hunt approval.
0036. **Historical scope snapshots** — stores a scope snapshot per hunt so regressions trace to scope changes rather than technique changes.
0037. **Scope-based budget splitting** — divides the request budget across scope segments proportionally to their attack surface.
0038. **API-version scope tracking** — treats /v1 versus /v2 as separate scope entries with independent test state.
0039. **Staging/dev quarantine profile** — auto-detected staging hosts get a gentler, read-leaning test profile by default.
0040. **Cross-campaign scope merge** — unifies overlapping scopes from multiple hunts into one canonical organization asset graph.
0041. **Decommissioned-asset pruner** — removes assets that stop resolving across two consecutive hunts from active scope.
0042. **Scope ownership attestation** — periodically re-checks WHOIS and certificate org fields and flags assets that changed hands.
0043. **CDN origin unmasker** — uses certificate history and DNS history to find origin IPs, adding them as scope with caution flags.
0044. **Scope risk labeling** — tags each asset as internet-facing, internal, or staging to steer test intensity appropriately.
0045. **Federated scope import** — pulls scope from the user's asset-inventory API on a schedule and reconciles differences.
0046. **Scope-change notifications** — pings the user when auto-expansion adds more than N assets or any high-value asset.
0047. **Exclusion-list learning** — remembers user-rejected scope candidates and stops proposing lookalikes.
0048. **Scope-aware finding dedup** — the same finding on two scope aliases collapses into one canonical finding.
0049. **Microservice scope inference** — follows service-mesh headers and internal hostnames to map backend services into scope.
0050. **Scope coverage heatmap** — visualizes which scope segments received the most testing versus findings to guide expansion.
0051. **Legal-scope guardrails** — blocks testing of assets in sanctioned regions or on explicit deny lists with no override path.
0052. **Scope intent parser** — reads the user's pasted note ("just the API") and biases expansion toward matching asset types.
0053. **SPA route scope nodes** — treats each client-side route as a scope node with its own API dependency map.
0054. **Webhook sink scoping** — discovered outbound webhook endpoints are scoped as data-flow sinks, not as test targets.
0055. **Scope version pinning** — a hunt can pin to a dated scope snapshot for reproducible compliance re-tests.
0056. **Cross-protocol scope entries** — discovered non-HTTP services (FTP, SMTP, MQTT) on in-scope hosts become scoped service entries.
0057. **Dynamic-DNS re-resolution** — assets behind dynamic DNS are re-resolved before every test batch.
0058. **Scope-aware reporting** — the PDF groups findings by scope segment with per-segment coverage statistics.
0059. **Emergency scope halt** — one click freezes all scope expansion campaign-wide when something looks wrong.
0060. **Scope expansion rate limiter** — caps auto-added assets per hour so a wildcard misfire can't explode the hunt.
0061. **Enumeration budget guard** — stops subdomain brute-forcing once the marginal discovery rate falls below threshold.
0062. **Scope finalization checkpoint** — at the recon-to-testing transition, the orchestrator locks a scope manifest the rest of the hunt obeys.
0063. **Priority queue with aging** — hunts gain priority the longer they wait so low-priority targets never starve.
0064. **SLA-aware scheduler** — orders hunts by deadline proximity and estimated duration rather than static priority alone.
0065. **Overnight batch window** — queues long deep-dives to run automatically during user-configured night hours.
0066. **Timezone-aware quiet hours** — pauses active testing during the target's local business hours when configured.
0067. **Cron-style recurring hunts** — schedules weekly regression hunts against the same scope with diff-based reporting.
0068. **Target traffic-aware scheduling** — learns the target's peak hours from response latency patterns and shifts heavy tests off-peak.
0069. **Hunt preemption** — a P0 incident hunt can pause lower-priority hunts and seize workers, resuming them afterward automatically.
0070. **Fair-share multi-user scheduling** — divides worker capacity across users by weighted shares so one user can't hog the cluster.
0071. **Earliest-deadline-first ordering** — the scheduler continuously re-sorts the queue as deadlines approach.
0072. **Dependency-aware ordering** — hunts with unmet dependencies wait efficiently without polling workers.
0073. **Worker-affinity placement** — pins hunts to workers with warm caches or matching egress geography.
0074. **Hunt slot reservation** — lets the user reserve capacity in advance for a future high-stakes hunt.
0075. **Blackout-period calendar** — a global calendar of no-test windows (holidays, client freezes) the scheduler always respects.
0076. **Staggered start jitter** — randomizes hunt start times within a window to avoid synchronized traffic fingerprints.
0077. **Scheduled scope revalidation** — re-runs scope discovery on a cadence and opens a review task when assets change.
0078. **Campaign milestone scheduler** — triggers phase transitions (recon to test to report) across a campaign on a timetable.
0079. **Chain-trigger scheduling** — hunt B auto-queues the moment hunt A emits its configured trigger finding.
0080. **Auto-snooze on WAF** — when blocks spike, the scheduler parks the hunt and retries with backoff instead of failing it.
0081. **Exponential-backoff retry queue** — failed hunts re-enter the queue with growing delays and a maximum-attempt cap.
0082. **Retry queue with decay** — low-value retries gradually lose priority so fresh hunts aren't crowded out.
0083. **High-value fast lane** — targets above a value threshold skip the normal queue into reserved capacity.
0084. **Compliance-deadline scheduling** — audit-driven hunts are scheduled backward from the filing date with buffer time.
0085. **Periodic regression hunts** — auto-schedules re-tests of previously found vulnerabilities after the fix SLA expires.
0086. **Always-on low-rate monitoring** — keeps a trickle of canary requests running to detect target changes between hunts.
0087. **Incident burst mode** — on user trigger, the scheduler concentrates all workers onto one target within safety limits.
0088. **Hunt duration estimator** — predicts runtime from scope size and template to give the scheduler realistic ETAs.
0089. **Deadline negotiation** — when a hunt can't fit before its deadline, the scheduler proposes a reduced-scope variant.
0090. **Multi-region scheduling** — runs hunts from the egress region closest to the target to cut latency and look local.
0091. **Maintenance-window detector** — watches for the target's deploy patterns and avoids testing mid-deployment.
0092. **Schedule templates** — "weeknight deep dive" or "weekend sweep" presets the user applies in one click.
0093. **Hunt calendar view** — shows all scheduled hunts on a timeline with drag-to-reschedule interaction.
0094. **Capacity forecasting** — predicts worker saturation for the next 7 days from the scheduled queue.
0095. **Overrun protection** — checkpoints or stops hunts exceeding twice their estimated duration for review.
0096. **Priority inheritance** — a hunt blocking a high-priority dependent temporarily inherits that priority.
0097. **Weekend-only heavy tests** — intrusive techniques auto-defer to weekend windows when configured.
0098. **Hunt batching by target** — groups queued hunts against the same target to share recon and rate-limit budget.
0099. **Notification scheduling** — status updates batch and deliver at user-chosen times, never at 3am unless P0.
0100. **Schedule-aware budget allocation** — longer scheduled windows unlock proportionally larger request budgets.
0101. **Dynamic re-scheduling on findings** — a critical finding can pull its follow-up hunt forward in the queue.
0102. **Worker drain for maintenance** — gracefully checkpoints and migrates hunts off a worker before its maintenance window.
0103. **Hunt affinity to egress IP** — keeps one hunt on one egress IP to avoid tripping per-IP anomaly detection.
0104. **Cold-start prewarming** — the scheduler pre-resolves DNS and warms TLS sessions minutes before a big hunt starts.
0105. **Queue-depth alerts** — warns the user when backlog exceeds capacity, with a suggested reprioritization.
0106. **SLA breach predictor** — forecasts which hunts will miss deadlines at current velocity and suggests actions.
0107. **Scheduled technique refresh** — queues hunts to re-test with newly released techniques on a cadence.
0108. **Hunt interleaving** — alternates requests across targets within one worker to smooth per-target load.
0109. **Deadline-driven degradation** — as a deadline nears, the scheduler swaps the hunt to a faster template automatically.
0110. **One-click "hunt tonight"** — a single button scheduling the full pipeline for the next quiet window.
0111. **Recurring scope-drift hunts** — monthly light hunts whose only job is detecting new assets and configuration changes.
0112. **Scheduling audit log** — every queue decision (why this hunt now) is recorded for transparency.
0113. **Energy-aware scheduling** — defers GPU-heavy analysis to off-peak local hours when the user pays time-of-use power rates.
0114. **Hunt start conditions** — a hunt can wait for conditions like "target responds under 500ms" before starting.
0115. **Multi-hunt synchronization barrier** — campaign phases start only when all member hunts reach the gate.
0116. **Adaptive concurrency per schedule** — raises parallelism off-peak and lowers it during the target's busy hours.
0117. **Schedule conflict resolver** — when two hunts want the same target window, merges them instead of double-testing.
0118. **Deferred heavy-payload queue** — intrusive payloads wait for the next approved window while safe tests proceed.
0119. **Hunt curfew** — a hard stop time after which hunts checkpoint and sleep until the next window.
0120. **Sunrise resume** — hunts paused by curfew auto-resume at the next window with strategy memory intact.
0121. **Schedule-based egress rotation** — rotates egress IPs on a timetable independent of block events.
0122. **Campaign Gantt auto-layout** — renders dependency chains and milestones as an editable timeline.
0123. **"What-if" schedule simulator** — previews queue impact before the user commits a new scheduled hunt.
0124. **Schedule health score** — rates how well the queue meets SLAs and surfaces the top three fixes.
0125. **Request-rate governor** — tracks requests per minute per target and holds under a learned safe ceiling.
0126. **Error-rate sentinel** — watches 4xx/5xx ratios against baseline and pauses the hunt when errors spike beyond tolerance.
0127. **WAF block classifier** — distinguishes WAF blocks (403 patterns, challenge pages) from application errors so the orchestrator reacts correctly.
0128. **Challenge-page detector** — recognizes CAPTCHA and JS-challenge interstitials and backs off instead of hammering them.
0129. **IP reputation watcher** — checks egress IP reputation continuously and rotates before blocks cascade across hunts.
0130. **Finding-velocity tracker** — measures findings per hour; a flatline triggers strategy review rather than more of the same.
0131. **Coverage-velocity meter** — tracks newly covered endpoints per hour to detect recon stalls early.
0132. **Strategy-stagnation detector** — flags when the same technique yields nothing for N cycles and forces a pivot.
0133. **Auto-throttle on degradation** — smoothly reduces concurrency as latency or errors climb, before a hard pause becomes necessary.
0134. **Strategy pivot engine** — swaps the active technique mix when health signals show the current mix is burned.
0135. **Proxy rotation on blocks** — rotates egress on confirmed blocks with a cool-down period for the burned IP.
0136. **User-agent rotation policy** — cycles realistic user-agent strings per session to avoid trivial fingerprinting.
0137. **Session-health monitor** — watches for session-expiry signals and re-authenticates before tests start failing.
0138. **Auth-token expiry predictor** — refreshes tokens proactively based on observed TTL instead of after failures.
0139. **DNS-resolution health** — detects poisoned or failing resolvers and fails over to alternates automatically.
0140. **TLS-error classifier** — separates transient TLS hiccups from target-side certificate changes worth reporting.
0141. **Latency-baseline anomaly detector** — learns per-endpoint latency and flags sudden shifts as possible WAF or deploy events.
0142. **Honeypot/tarpit detector** — spots artificially slow or looping responses and deprioritizes those paths.
0143. **Rate-limit header parser** — honors Retry-After and X-RateLimit headers to stay under the target's stated limits.
0144. **CAPTCHA encounter protocol** — on CAPTCHA, the hunt checkpoints and notifies rather than attempting any bypass.
0145. **Account-lockout guard** — detects lockout signals and halts authentication-adjacent testing immediately.
0146. **Target-downtime detector** — distinguishes target outage from blocks via multi-point checks, then pauses cleanly.
0147. **Response-baseline differ** — alerts when the target's responses structurally change mid-hunt (deploy or defense change).
0148. **False-positive rate as health signal** — a rising FP rate automatically throttles the technique generating it.
0149. **Operator-attention score** — estimates how closely the target is watched (blocks, challenges) and adjusts stealth accordingly.
0150. **Bandwidth governor** — caps bytes per second per hunt so large-response endpoints don't saturate the link.
0151. **Connection-pool hygiene** — recycles stale keep-alive connections that start producing errors.
0152. **Egress-failure failover** — reroutes a hunt to a healthy egress region when the current one degrades.
0153. **Target fingerprint-change alert** — flags when server headers or TLS fingerprints change mid-hunt.
0154. **Per-hunt health dashboard** — live gauges for rate, errors, blocks, and velocity in one view.
0155. **Degraded-mode presets** — stealth, normal, and aggressive profiles the health monitor can drop into automatically.
0156. **Block-pattern learner** — records which behaviors preceded each block to avoid repeating them.
0157. **Cool-down advisor** — recommends exact wait times per target based on observed block recovery.
0158. **Health-based worker selection** — routes new hunts to workers with the cleanest egress reputation.
0159. **Cross-hunt block correlation** — notices when multiple hunts get blocked simultaneously, indicating a shared egress issue.
0160. **Canary-request prober** — sends occasional benign requests to measure true target health versus test-induced errors.
0161. **Health-check heartbeat** — every hunt emits a heartbeat; missing heartbeats page the orchestrator.
0162. **Health-driven degradation ladder** — defines ordered fallback steps (slow down, go stealth, pause) per hunt template.
0163. **Recovery prober** — after a pause, sends escalating probe traffic to confirm recovery before resuming full load.
0164. **Hunt-health score rollup** — one 0–100 health number driving all throttle, pivot, and pause decisions.
0165. **Anomaly journal** — every health anomaly logged with context for post-hunt review.
0166. **Per-endpoint health tracking** — tracks error rates per endpoint so one sick endpoint doesn't throttle the whole hunt.
0167. **Bot-score estimator** — infers how bot-flagged the session looks from challenge frequency and adapts behavior.
0168. **Health-aware payload chooser** — prefers low-noise payloads when the target looks heavily monitored.
0169. **Session-rotation schedule** — rotates sessions and cookies periodically to distribute behavioral footprint.
0170. **Egress warmup routine** — new egress IPs start with benign traffic before joining aggressive hunts.
0171. **Block-evasion audit log** — logs every evasion-adjacent decision for user review, never silently.
0172. **Health-threshold profiles** — per-target-type thresholds (bank versus blog) instead of one global setting.
0173. **Real-user traffic mimicry** — spaces requests with human-like timing distributions during stealth mode.
0174. **Health-event webhooks** — pushes throttle, block, and pause events to the user's automation endpoint.
0175. **Post-block strategy mutator** — after a block, the hunt resumes with a mutated quieter strategy, never the same one.
0176. **Target-capacity estimator** — infers how much load the target tolerates and sizes concurrency to a safe fraction.
0177. **Health regression alerts** — warns when a target that was healthy last hunt is hostile this hunt.
0178. **Multi-signal fusion** — combines latency, errors, blocks, and challenges into one pause-or-continue verdict.
0179. **Health snapshot in reports** — the PDF includes a health timeline showing throttles and pauses with reasons.
0180. **Self-healing session pool** — the orchestrator maintains warm backup sessions to swap in on expiry.
0181. **Degradation drills** — periodically simulates degraded health to verify the throttle ladder actually works.
0182. **Health-cost tradeoff display** — shows the user "stealth mode costs roughly 3x time" before they enable it.
0183. **Target-specific backoff memory** — remembers per-target cool-downs across hunts instead of relearning them.
0184. **Health-gated chaining** — exploit-chaining steps only fire when target health is green, never mid-degradation.
0185. **Quiet-hours auto-stealth** — the health monitor drops to the stealth profile during the target's business hours automatically.
0186. **Hunt-health API** — exposes live health metrics so external dashboards can consume them.
0187. **Time-based checkpointing** — serializes full hunt state every N minutes to crash-proof storage.
0188. **Event-based checkpoints** — checkpoints on milestones (recon done, first finding), not just on timers.
0189. **Full-state serialization** — captures queue, findings, tried payloads, sessions, and strategy weights in one bundle.
0190. **Incremental checkpoints** — stores only deltas between checkpoints to keep them fast and small.
0191. **Fresh-angle resume** — on resume, the planner explicitly avoids re-running completed techniques and picks new angles.
0192. **Strategy memory ledger** — records which techniques worked, failed, or were blocked for this target.
0193. **Tried-payload registry** — a dedup set of payload-plus-endpoint pairs so resumed hunts never repeat shots.
0194. **Differential resume** — on re-hunt, tests only attack surface that changed since the last checkpoint.
0195. **Crash-safe journaling** — an append-only action log lets any interrupted hunt rebuild exact state.
0196. **User-commanded pause** — "pause" freezes the hunt in seconds with zero lost findings.
0197. **Schedule-driven pause** — hunts auto-pause at curfew and resume at the next window.
0198. **Anomaly-driven auto-pause** — health anomalies trigger instant pause with a resumable checkpoint.
0199. **Cross-machine resume** — checkpoint bundles export and import so a hunt can move machines via file transfer.
0200. **Checkpoint compression** — compresses state bundles to keep long hunts' storage footprint small.
0201. **Checkpoint encryption** — encrypts checkpoints containing session tokens at rest.
0202. **Checkpoint retention policy** — keeps the last N checkpoints per hunt, pruning older ones automatically.
0203. **Resume dry-run verifier** — validates a checkpoint's integrity and target reachability before resuming.
0204. **Partial-result preservation** — findings found before a crash are never lost, even if state is partial.
0205. **Hunt hibernation** — stale hunts serialize to cold storage and unload from memory entirely.
0206. **Wake-on-change resume** — a hibernated hunt wakes when target change-detection fires.
0207. **Strategy-version-aware resume** — resumed hunts adopt the newest strategy library but keep their memory of what failed.
0208. **Multi-branch resume** — from one checkpoint, the user can fork two alternative strategies to compare.
0209. **Checkpoint integrity hashing** — detects corrupted checkpoints and falls back to the previous good one.
0210. **Pause-reason taxonomy** — every pause records why (user, schedule, health, budget) for honest reporting.
0211. **Resume-with-upgrade** — lets the user attach a new technique pack before resuming an old hunt.
0212. **Session rehydration** — paused hunts restore cookies and tokens on resume or re-login automatically.
0213. **Queue-position memory** — the exact pending-test queue order survives pause and resume.
0214. **Finding-state continuity** — triage states (new, confirmed, reported) persist across resumes.
0215. **Budget carryover** — remaining request and time budget is preserved exactly through pause cycles.
0216. **Pause-notify digest** — the user gets one summary on pause, not a stream of alerts.
0217. **Resume confidence check** — the orchestrator re-probes target health before unleashing the full queue.
0218. **Checkpoint diffing** — shows what changed between checkpoints for debugging stuck hunts.
0219. **Long-pause decay** — after 30 idle days, a resumed hunt re-runs recon first since the target likely changed.
0220. **Pause-safe chaining** — exploit chains checkpoint between steps so a pause never leaves half-executed chains.
0221. **Resume strategy proposal** — on resume, the agent proposes its fresh angle and the user can veto or edit it.
0222. **Checkpoint access control** — only the hunt owner can resume or export its checkpoints.
0223. **Auto-checkpoint before risky steps** — the orchestrator snapshots right before exploit-chaining or auth changes.
0224. **Resume-from-any-checkpoint** — the user can roll back to an earlier checkpoint, not just the latest.
0225. **Checkpoint metadata index** — searchable index of all checkpoints by target, date, and findings count.
0226. **Storage-quota-aware checkpoints** — shrinks checkpoint frequency when disk runs low, never fails silently.
0227. **Resume telemetry** — tracks how often hunts resume versus finish to tune default checkpoint intervals.
0228. **Pause cascades to dependents** — pausing hunt A auto-pauses hunts waiting on A's findings.
0229. **Campaign resume ordering** — campaign resume restores member hunts in dependency order.
0230. **Checkpoint-anchored reporting** — reports can be generated from any checkpoint, not just live state.
0231. **Zero-downtime orchestrator restart** — the orchestrator itself can restart without losing running hunts.
0232. **Pause-on-budget-exhaustion** — hitting budget pauses (not kills) so a top-up can resume the hunt.
0233. **Resume-with-new-scope** — lets the user add scope at resume time; the planner integrates it without redoing old work.
0234. **Checkpoint portability manifest** — declares strategy-library versions so imports fail loudly on mismatch.
0235. **Hibernation cost saver** — hibernated hunts consume zero workers, CPU, or egress budget.
0236. **Resume warmup ramp** — resumed hunts ramp traffic gradually instead of bursting at full concurrency.
0237. **Pause-state dashboard** — one view of every paused hunt, why it's paused, and what it needs to resume.
0238. **Auto-resume on dependency met** — a hunt paused waiting for hunt A resumes the moment A's trigger fires.
0239. **Checkpoint signing** — signs checkpoints so tampering is detectable for compliance hunts.
0240. **Resume conflict resolver** — if the target changed a lot during pause, the planner re-scopes before continuing.
0241. **Pause budget for users** — users can park a fixed number of hunts long-term without schedule pressure.
0242. **Checkpoint lifecycle hooks** — user scripts can run on checkpoint and resume events for custom integrations.
0243. **Resume-from-report** — clicking a finding in an old PDF offers to resume the hunt from that checkpoint.
0244. **Graceful worker-loss resume** — if a worker dies, its hunts re-checkpoint from the journal on a survivor.
0245. **Pause reason in status API** — external tools can read why each hunt is paused.
0246. **Resume ETA estimator** — predicts remaining time from checkpoint state and current velocity.
0247. **Checkpoint-less micro-hunts** — sub-five-minute hunts skip checkpointing overhead by policy.
0248. **Resume strategy memory export** — the "what worked" ledger exports as a reusable playbook for similar targets.
0249. **Zero-finding auto-retry** — hunts ending with no findings auto-retry once with a mutated strategy instead of closing.
0250. **Strategy mutation operators** — formal transforms (payload-set swap, order shuffle, depth change) generate retry variants.
0251. **Retry budget cap** — each hunt gets N retries; exceeding it produces an honest "no findings" report instead of looping forever.
0252. **Stale-hunt detector** — flags hunts with no new findings or coverage for X hours as stale and eligible for revival logic.
0253. **Stale-hunt revival triggers** — target change, new CVE, or new technique auto-revives a stale hunt with a fresh plan.
0254. **Crash recovery orchestrator** — restarts interrupted hunts from the last checkpoint with zero user action required.
0255. **Network-partition recovery** — hunts survive orchestrator and worker disconnects and reconcile state on reconnect.
0256. **Worker failover** — a dead worker's hunts migrate to healthy workers with state intact.
0257. **Checkpoint rollback** — rolls a corrupted hunt back to the last known-good checkpoint automatically.
0258. **Poisoned-state detector** — recognizes bad auth or corrupted sessions and rebuilds state instead of retrying blindly.
0259. **Flaky-strategy quarantine** — techniques with inconsistent results get quarantined pending human review.
0260. **Retry with fresh egress** — retries route through a different egress IP to rule out IP-based blocking.
0261. **Retry with new timing profile** — retries use a different request cadence to dodge behavioral blocks.
0262. **Retry escalation ladder** — retry one mutates payloads, retry two changes strategy, retry three expands scope slightly.
0263. **Failed-hunt post-mortem** — auto-generates why the hunt failed (blocks, scope, target down) with supporting evidence.
0264. **Give-up criteria** — explicit rules for when to stop retrying and report honestly.
0265. **Partial-credit reporting** — failed hunts still produce a report of coverage achieved and blockers encountered.
0266. **Retry-on-target-change** — if the target deploys mid-hunt, the hunt retries affected areas instead of continuing blind.
0267. **Dependency-failure handler** — when hunt A fails, dependent hunt B gets a degraded plan or a clean cancellation.
0268. **Session-poison recovery** — detects when a session starts returning anomalous data and rotates it.
0269. **DNS-failure fallback** — retries failed resolutions through alternate resolvers before marking hosts dead.
0270. **TLS-failure triage** — separates expired certificates (reportable) from transient errors (retryable).
0271. **Rate-limit recovery** — on 429 storms, backs off with jitter and resumes exactly where it stopped.
0272. **WAF-block recovery playbook** — a defined sequence: cool down, rotate egress, mutate strategy, resume.
0273. **Target-restore detection** — after downtime, verifies the target is truly back before resuming full load.
0274. **Data-loss guard** — verifies finding integrity after any recovery before continuing.
0275. **Retry-storm prevention** — a global cap on concurrent retries so one bad day can't cascade.
0276. **Recovery-time objective per hunt** — each template declares maximum acceptable recovery time; breaches alert.
0277. **Chaos drills** — periodically kills a worker mid-hunt to verify recovery actually works.
0278. **Recovery audit trail** — every recovery action logged with before and after state.
0279. **Manual retry with edits** — the user can edit the mutated strategy before approving a retry.
0280. **Retry-effectiveness tracking** — measures whether retries actually find things to tune retry policy over time.
0281. **Cross-region retry** — retries a blocked hunt from a different egress region.
0282. **Time-shifted retry** — retries a hunt at a different time of day to dodge time-based defenses.
0283. **Technique-substitution retry** — swaps a burned technique for its nearest effective neighbor.
0284. **Scope-narrowed retry** — retries focus on the highest-value slice when the full retry is too expensive.
0285. **Auth-refresh retry** — retries authentication-dependent hunts after forcing a fresh login flow.
0286. **Cache-busted retry** — retries with cache-busters to rule out stale CDN responses hiding vulnerabilities.
0287. **Alternate-protocol retry** — retries blocked paths over alternate protocol presentations where policy allows.
0288. **Retry with expanded wordlists** — second passes use bigger, smarter wordlists seeded by first-pass findings.
0289. **Retry with reduced noise** — stealth retries for targets that blocked the aggressive first pass.
0290. **Retry with increased depth** — deep-dive retries crawl more levels when shallow passes found nothing.
0291. **Hunt-resurrection review** — revived stale hunts get a human-readable "why now" summary.
0292. **Zombie-hunt reaper** — kills hunts stuck in retry loops with no progress, producing a final report.
0293. **Recovery confidence scoring** — the orchestrator scores how trustworthy post-recovery state is before continuing.
0294. **Dependent-hunt repair** — when a dependency recovers, downstream hunts repair their plans instead of restarting.
0295. **Multi-checkpoint recovery choice** — recovery picks the best checkpoint by integrity, not just the latest one.
0296. **Recovery dry-run** — simulates resume from checkpoint without touching the target to validate state.
0297. **Hunt-merge recovery** — two duplicate hunts from a split-brain merge into one, deduplicating effort.
0298. **Split-brain detector** — notices two orchestrators running the same hunt and reconciles them.
0299. **Recovery notification batching** — one digest per incident, not one alert per hunt.
0300. **Post-recovery health watch** — recovered hunts get extra health scrutiny for the first 15 minutes.
0301. **Retry-budget top-up flow** — the user can grant extra retries to a promising-but-unlucky hunt in one click.
0302. **Failure-pattern mining** — clusters failed hunts to find systemic causes like bad egress or dead techniques.
0303. **Auto-ticket on repeated failure** — after N failed retries, opens a review task with full context attached.
0304. **Graceful target-gone handling** — when a target permanently disappears, the hunt closes with a clean archived report.
0305. **Recovery SLA dashboard** — shows mean time to recovery per hunt template and worker.
0306. **Pre-mortem on risky hunts** — before starting, the orchestrator lists likely failure modes and mitigations.
0307. **Retry with human hints** — the user can inject a hint ("try the API docs page") into the retry plan.
0308. **Recovery from bad config** — detects hunts failing from misconfiguration and pauses for a fix instead of retrying.
0309. **Hunt transplant** — moves a hunt to a different worker pool (for example, the stealth pool) as a recovery action.
0310. **Last-resort manual mode** — converts an unrecoverable autonomous hunt into a guided checklist for the user.
0311. **Multi-target campaign manager** — one campaign object owns dozens of hunts with shared configuration.
0312. **Global priority queue** — all campaign hunts draw from one ordered queue, not per-hunt silos.
0313. **Shared-learnings bus** — a finding pattern on target A immediately informs target B's strategy.
0314. **Per-target budget caps** — each campaign member gets its own request and time ceiling within the campaign budget.
0315. **Unified campaign dashboard** — one view of progress, findings, health, and spend across every target.
0316. **Campaign templates** — "fintech API sweep" or "portfolio quarterly" presets with targets and cadence.
0317. **Target onboarding pipeline** — add 50 targets via CSV or import; the campaign validates, scopes, and queues them.
0318. **Campaign phases** — recon-all, test-all, chain, report, with gates between phases.
0319. **Cross-target pattern detection** — flags the same vulnerability class appearing across the portfolio as a systemic issue.
0320. **Campaign-level dedup** — identical findings across targets link to one canonical issue with an affected-target list.
0321. **Campaign reporting** — rollup PDF with per-target appendix and portfolio-level executive summary.
0322. **Campaign scheduling** — staggers member hunts across nights and weeks to fit capacity.
0323. **Campaign pause/resume** — one control pauses every member hunt with individual checkpoints.
0324. **Target dropout handling** — when a target goes dark, the campaign reroutes its budget to the next target.
0325. **Campaign cost tracking** — rollup of requests, time, and compute per target and in total.
0326. **Campaign SLA** — per-campaign deadlines with member-level milestones and breach prediction.
0327. **Campaign roles** — owner, viewer, and approver roles for shared campaigns.
0328. **Quarter-over-quarter comparison** — diffs this campaign against the last one for the same portfolio.
0329. **Campaign auto-expansion** — new targets matching campaign criteria (for example, a new subdomain) auto-join.
0330. **Campaign kill-switch** — one button halts every member hunt and freezes spend instantly.
0331. **Campaign finding triage** — portfolio-wide triage queue sorted by severity times exploitability.
0332. **Campaign-wide scope policy** — one scope rulebook applied consistently to all members.
0333. **Member-hunt templates** — different templates per target tier within one campaign.
0334. **Campaign health rollup** — worst-member health surfaces first so problems aren't hidden in averages.
0335. **Shared egress pool** — campaign members share warmed egress IPs with coordinated rotation.
0336. **Cross-member rate limiting** — the campaign enforces a global per-organization request ceiling across its targets.
0337. **Campaign change detection** — when any member's target changes significantly, the campaign re-prioritizes it.
0338. **Campaign milestone alerts** — notifies on phase completion, not on every member event.
0339. **Campaign budget rebalancing** — shifts unused budget from finished members to struggling ones automatically.
0340. **Target tiering** — tiers targets (crown jewels versus long tail) with different templates and budgets.
0341. **Campaign dependency chains** — "test staging before production" orderings inside campaigns.
0342. **Campaign blackout sync** — all members respect the same blackout calendar.
0343. **Multi-campaign portfolio view** — the user sees all campaigns' status in one portfolio dashboard.
0344. **Campaign cloning** — duplicates a campaign's structure for the next quarter with fresh state.
0345. **Campaign archival** — finished campaigns compress to searchable archives with full reports.
0346. **Campaign access audit** — logs who viewed or changed campaign configuration for compliance.
0347. **Campaign-level WAF intelligence** — a block on one member teaches stealth behavior to all members.
0348. **Campaign finding SLA** — per-severity fix tracking across the portfolio with reminders.
0349. **Campaign technique rotation** — ensures members don't all use identical techniques simultaneously (fingerprint risk).
0350. **Campaign dry-run** — simulates the full campaign schedule and budget before launch.
0351. **Campaign member health ranking** — ranks members by health so the user spots troubled targets fast.
0352. **Auto-member retry** — failed members retry with mutated strategy without stalling the campaign.
0353. **Campaign report scheduling** — auto-generates and delivers the rollup report on campaign completion.
0354. **Campaign-wide exclusions** — one deny-list entry propagates to every member instantly.
0355. **Campaign notes and runbook** — shared operator notes attached to the campaign for the team.
0356. **Campaign API** — programmatic campaign creation and status for CI/CD integration.
0357. **Campaign webhooks** — phase changes and critical findings push to user endpoints.
0358. **Campaign cost forecasting** — predicts total campaign spend from member estimates before launch.
0359. **Campaign risk register** — tracks campaign-level risks (target outage, WAF) with mitigations.
0360. **Campaign retrospectives** — auto-generated lessons-learned per campaign feeding the strategy library.
0361. **Nested campaigns** — a campaign can contain sub-campaigns per business unit with rollup reporting.
0362. **Campaign versus solo arbitration** — the global scheduler fairly arbitrates between campaign and ad-hoc hunts.
0363. **Campaign member cap** — limits concurrent active members to protect shared budgets.
0364. **Campaign finding correlation** — links findings across members into attack-path narratives.
0365. **Campaign compliance mapping** — maps campaign coverage to frameworks (SOC2, PCI) automatically.
0366. **Campaign stealth coordination** — staggers member start times so the organization doesn't see a synchronized sweep.
0367. **Campaign data residency** — keeps campaign data in the user's chosen region for compliance.
0368. **Campaign export pack** — full campaign state exports as one portable archive.
0369. **Campaign SLA breach auto-escalation** — missed milestones page the owner with options.
0370. **Campaign technique effectiveness** — compares technique yield across members to tune the next campaign.
0371. **Campaign target churn report** — shows added and removed targets with reasons over the campaign lifetime.
0372. **Campaign completion criteria** — an explicit definition of done (coverage percent, all members reported) enforced by the orchestrator.
0373. **Per-hunt CPU budget** — caps compute per hunt so one heavy analysis can't starve others.
0374. **Per-hunt network budget** — caps bytes transferred, with graceful stop at the limit.
0375. **Per-hunt request budget** — the core currency: maximum requests per hunt, tracked live.
0376. **Per-hunt time budget** — wall-clock ceiling with checkpoint-and-stop behavior at the limit.
0377. **Egress IP pool manager** — allocates and rotates a pool of egress IPs across hunts.
0378. **Proxy budget allocator** — distributes proxy bandwidth across concurrent hunts by priority.
0379. **Per-target concurrency limit** — never exceeds N parallel connections to one target.
0380. **Global concurrency cap** — cluster-wide ceiling protecting overall infrastructure.
0381. **Fair-share scheduler** — divides capacity by weighted shares across users and campaigns.
0382. **Burst-token system** — hunts earn burst capacity for short sprints, then return to baseline.
0383. **Cost-per-finding tracker** — attributes requests, time, and compute to each confirmed finding.
0384. **Budget-exhaustion behavior** — at the limit: checkpoint, generate partial report, notify — never vanish silently.
0385. **Budget top-up flow** — one-click grant of extra requests or time to a promising hunt.
0386. **Per-strategy budgets** — each technique gets a sub-budget so one hungry technique can't eat the hunt.
0387. **Evidence storage budget** — caps screenshots and packets stored per hunt with smart pruning.
0388. **State-memory budget** — caps in-memory hunt state; overflows spill to disk checkpoints.
0389. **GPU budget for analysis** — rations ML-assisted analysis (for example, response clustering) per hunt.
0390. **Budget forecasting** — predicts whether the current plan fits the budget before starting.
0391. **Eighty-percent budget alerts** — warns the user early enough to top up or narrow scope.
0392. **Campaign budget pooling** — members draw from a shared pool with per-member floors.
0393. **Spot versus reserved capacity** — cheap interruptible workers for background hunts, reserved workers for P0.
0394. **Budget-aware strategy picker** — chooses techniques that fit the remaining budget, not just the best ones.
0395. **Request-cost weighting** — expensive operations (large uploads) count more against the budget.
0396. **Budget burn-rate display** — live "requests per hour versus plan" gauge per hunt.
0397. **Idle-budget reclamation** — paused hunts release reserved capacity back to the pool.
0398. **Budget inheritance in chains** — dependent hunts derive budgets from the parent's remaining budget.
0399. **Template default budgets** — each template ships with sane budget defaults the user can override.
0400. **Budget override audit** — every manual top-up logged with who and why.
0401. **Multi-currency budgets** — tracks requests, time, bytes, and compute as separate convertible budget lines.
0402. **Budget rollover** — unused campaign budget rolls into the next scheduled campaign.
0403. **Finding-value-weighted spend** — the orchestrator spends more aggressively where expected finding value is high.
0404. **Diminishing-returns cutoff** — stops a technique when its marginal finding rate drops below threshold.
0405. **Budget-versus-coverage optimizer** — allocates requests to maximize predicted coverage per unit cost.
0406. **Worker bin packing** — schedules hunts onto workers to minimize idle capacity.
0407. **Egress-cost awareness** — prefers cheaper egress paths when quality is equivalent.
0408. **Storage lifecycle policy** — hot evidence to warm archive to cold delete on a schedule.
0409. **Budget fairness audit** — periodic check that no user or campaign is systematically starved.
0410. **Emergency budget reserve** — a protected pool only P0 incident hunts can tap.
0411. **Budget simulation** — "what if I add 10k requests" preview before committing.
0412. **Per-finding cost benchmark** — compares cost-per-finding across templates to guide template choice.
0413. **Budget-aware retries** — retries get a fraction of the original budget, not a full refill.
0414. **Quota API** — external systems can query and reserve budget programmatically.
0415. **Budget alert routing** — over-budget warnings go to the hunt owner, not broadcast.
0416. **Time-of-day cost multiplier** — night-window compute costs less in the internal accounting.
0417. **Budget debt tracking** — hunts that overspend (with approval) carry visible debt into reporting.
0418. **Resource contention resolver** — when two hunts want the last worker, priority plus fairness decides, logged.
0419. **Worker autoscaling** — spins up workers when queue depth exceeds thresholds, scales down when idle.
0420. **Cold-start budget** — accounts for warmup costs in the first minutes of a hunt.
0421. **Budget checkpoints** — at 25, 50, and 75 percent spend, the orchestrator re-validates that the plan still makes sense.
0422. **Wasted-request detector** — flags requests returning identical responses as waste to eliminate.
0423. **Duplicate-request guard** — the scheduler never sends the same request twice, even across retries.
0424. **Budget-portable hunts** — a hunt's budget travels with it across workers and machines.
0425. **Compute quota per technique** — ML-heavy techniques get bounded GPU and CPU slices.
0426. **Network-egress accounting** — per-hunt byte counts feed the cost dashboard.
0427. **Budget-based preemption** — an over-budget low-priority hunt yields to an under-budget high-priority one.
0428. **Campaign spend guardrails** — a campaign-level circuit breaker halts spend on anomalous burn.
0429. **Budget reconciliation report** — end-of-hunt ledger showing planned versus spent per line item.
0430. **Zero-budget dry run** — simulates a hunt's plan against budgets without sending traffic.
0431. **Budget-aware scope expansion** — auto-expansion pauses if the budget can't cover the new assets.
0432. **Priority-weighted budget pools** — P0 hunts get deeper budget pools than P3 by policy.
0433. **Budget expiry** — granted top-ups expire if unused, preventing hoarding.
0434. **Cost-anomaly detection** — flags hunts burning three times their forecast for review.
0435. **Quick-recon template** — fifteen-minute passive-heavy sweep producing an attack-surface map, no intrusive tests.
0436. **Deep-dive template** — multi-hour full pipeline: recon, testing, chaining, verification, report.
0437. **Compliance-sweep template** — maps every test to OWASP Top 10 and ASVS controls for audit-ready evidence.
0438. **API-focused template** — prioritizes endpoint discovery, auth flaws, BOLA, and mass assignment.
0439. **SPA and JS-heavy template** — renders the app, maps client routes, and extracts API calls from bundles.
0440. **WordPress template** — CMS-specific checks: plugins, themes, users, xmlrpc, wp-json.
0441. **Cloud-config template** — audits exposed storage, misconfigured keys, and cloud metadata endpoints.
0442. **Mobile-backend template** — tests the API surface backing mobile apps, including versioned endpoints.
0443. **Auth-focused template** — deep session, OAuth, MFA, password-reset, and token-logic testing.
0444. **Business-logic template** — workflow abuse: pricing, coupons, quotas, and state-machine bypasses.
0445. **Template composer** — mixes modules from multiple templates into a custom pipeline.
0446. **Template parameters** — exposes tunables (depth, aggressiveness, budget) without editing the template.
0447. **Template versioning** — every template change is versioned; hunts pin to a version for reproducibility.
0448. **Custom user templates** — users save their own tuned pipelines as reusable templates.
0449. **Template sharing** — export and import templates as files for team reuse.
0450. **Template dry-run estimator** — predicts duration, requests, and coverage before launch.
0451. **Template-to-schedule binding** — "run compliance sweep monthly" ties a template to a cadence.
0452. **Template guardrails** — each template declares maximum intrusiveness; the orchestrator enforces it.
0453. **Template inheritance** — child templates override parent modules without copying.
0454. **Template diff viewer** — shows exactly what changed between template versions.
0455. **Template effectiveness score** — data-driven rating from past hunts using the template.
0456. **Template recommendation** — suggests the best template from the pasted URL's technology fingerprint.
0457. **Template preconditions** — a template refuses to run if its requirements (for example, auth credentials) are missing.
0458. **Template postconditions** — defines what "done" means per template for the orchestrator to verify.
0459. **Template-local budgets** — default request and time budgets tuned per template.
0460. **Template health profiles** — per-template throttle thresholds (auth template is gentler than recon).
0461. **Template chaining rules** — declares which templates can feed into which (recon into deep dive).
0462. **Template marketplace** — curated community templates with ratings and changelogs.
0463. **Template sandbox test** — runs a new template against a deliberately vulnerable fixture before real use.
0464. **Template rollback** — one click reverts to the previous template version across scheduled hunts.
0465. **Template audit log** — who changed what template and when, for compliance.
0466. **Template linting** — validates template definitions for impossible orderings or missing modules.
0467. **Template cost labels** — shows expected cost tier (S, M, L) on every template card.
0468. **Template coverage promises** — states which vulnerability classes the template covers so gaps are explicit.
0469. **Template gap analyzer** — compares two templates' coverage to explain their differences.
0470. **Template A/B testing** — runs two template variants against similar targets to measure yield.
0471. **Template deprecation flow** — old templates warn, then retire, migrating scheduled hunts gracefully.
0472. **Template documentation generator** — auto-builds human-readable docs from the template definition.
0473. **Template variable injection** — hunts pass variables (target tier, credentials) into templates at launch.
0474. **Template conditional modules** — modules that only run when conditions match (for example, "if WordPress detected").
0475. **Template fallback chain** — if a module fails, the template defines the fallback module automatically.
0476. **Template timeout policies** — per-module timeouts so one stuck module can't hang the hunt.
0477. **Template evidence standards** — defines what proof each module must capture for the report.
0478. **Template review workflow** — new or edited templates need approval before running on production targets.
0479. **Template usage analytics** — which templates run most, with finding yields, for tuning.
0480. **Template quick-switch** — mid-hunt, the user can swap templates; the orchestrator preserves completed work.
0481. **Template presets per industry** — banking, healthcare, and SaaS presets with tuned modules and budgets.
0482. **Template import from report** — converts a past successful hunt's module sequence into a new template.
0483. **Template signing** — verifies template integrity before execution in shared environments.
0484. **Template dry-run diff** — previews what a template change would alter in scheduled hunts.
0485. **Template notification hooks** — template events (phase done) trigger user webhooks.
0486. **Template localization** — template names and descriptions render in the user's language.
0487. **Template rollback window** — recent template edits can be undone within 24 hours without version juggling.
0488. **Template performance budget** — flags templates whose modules are known to be slow or noisy.
0489. **Template dependency graph** — visualizes module dependencies inside a template.
0490. **Template export to PDF** — documents the exact methodology used, attached to compliance reports.
0491. **Template star and favorite** — users pin favorite templates for one-click hunt launches.
0492. **Template search** — full-text search across templates by vulnerability class, tech, or industry.
0493. **Template clone-and-tweak** — duplicates a template for safe experimentation.
0494. **Template scheduled review** — prompts the owner to re-validate templates quarterly.
0495. **Template change impact** — shows which scheduled hunts a template edit will affect before saving.
0496. **Template minimal mode** — strips a template to its fastest safe subset for time-critical hunts.
0497. **Target value scorer** — combines bounty payout history, asset criticality, and exposure into one score.
0498. **Vulnerability-value predictor** — estimates expected severity before testing to order targets.
0499. **Dynamic mid-hunt reprioritization** — a promising lead boosts its hunt's queue position automatically.
0500. **Finding triage queue** — all findings across hunts in one queue ranked by severity times confidence.
0501. **Exploitability-weighted ranking** — findings with working proof-of-concepts outrank theoretical ones.
0502. **Business-impact scorer** — maps technical findings to business consequences for ordering.
0503. **Tech-stack risk scorer** — targets on risky stacks (old frameworks) rank higher.
0504. **Exposure scorer** — internet-facing, unauthenticated assets outrank internal ones.
0505. **Freshness scorer** — recently changed targets get priority since change breeds bugs.
0506. **Threat-intel priority boost** — targets matching actively-exploited CVE patterns jump the queue.
0507. **Queue aging** — waiting hunts slowly gain priority to prevent starvation.
0508. **Transitive priority propagation** — priority flows through multi-level dependency chains with decay per hop so deep blockers get fair precedence.
0509. **Manual priority override** — the user can pin any hunt to the top with a reason logged.
0510. **Priority classes P0–P3** — four explicit tiers with defined scheduler behavior for each.
0511. **Per-priority SLA** — P0 gets four-hour turnaround, P3 gets best-effort; tracked and reported.
0512. **Priority-based preemption** — higher tiers can pause lower tiers, with automatic resume afterward.
0513. **Portfolio heatmap** — visual grid of targets by value versus risk to guide manual prioritization.
0514. **Priority decay** — boosted hunts decay back to base priority over time to avoid permanent fast-lane hogging.
0515. **Finding-count feedback** — targets yielding findings get more budget; dry ones get less, automatically.
0516. **Crown-jewel tagging** — user-tagged critical assets always get top-tier treatment.
0517. **Priority audit** — every priority change logged with cause for transparency.
0518. **SLA countdown display** — live "time left" per hunt against its priority SLA.
0519. **Priority-aware budget split** — higher-priority hunts get larger budget shares by policy.
0520. **Risk-adjusted scheduling** — multiplies value by risk so high-risk, high-value targets lead.
0521. **Deprioritize-stable targets** — targets unchanged and clean for three hunts drop to background cadence.
0522. **Priority pools** — separate worker pools per tier so P3 floods can't touch P0 capacity.
0523. **Escalation on severity** — a critical finding auto-escalates its hunt to P0 for follow-up.
0524. **Priority-template mapping** — each priority tier defaults to an appropriate template.
0525. **User-defined scoring weights** — the user tunes what "value" means (payout versus coverage versus learning).
0526. **Priority simulation** — previews queue-order changes before applying a reprioritization.
0527. **Cross-campaign priority** — one global priority space across campaigns and solo hunts.
0528. **Priority floor for compliance** — compliance hunts never drop below P2 regardless of value score.
0529. **New-target priority boost** — first hunts on new targets get a discovery bonus.
0530. **Stale-priority refresh** — priorities recompute on target change, not just on schedule.
0531. **Priority-aware notifications** — P0 events notify immediately; P3 batches into digests.
0532. **Deprioritization reasons** — when a hunt drops in priority, the reason is visible to the user.
0533. **Priority-versus-cost tradeoff** — shows "raising to P0 costs roughly X in displaced work" before confirming.
0534. **Learning-value priority** — targets with novel stacks get bonus priority for strategy learning.
0535. **Priority inheritance cap** — prevents long dependency chains from inflating priority without bound.
0536. **Hunt-value decay** — completed coverage reduces a target's priority until something changes.
0537. **Priority-aware egress** — best-reputation egress IPs are reserved for highest-priority hunts.
0538. **Tiered finding review** — P0 findings get immediate human review slots; P3 queues in batches.
0539. **Priority-driven technique choice** — top-priority hunts unlock the most expensive, highest-yield techniques.
0540. **Fairness guardrail** — no single user can hold more than X percent of P0 slots concurrently.
0541. **Priority history chart** — shows how a hunt's priority evolved and why.
0542. **Auto-deprioritize blocked hunts** — hunts stuck on WAF blocks sink until they recover.
0543. **Priority-aware checkpointing** — high-priority hunts checkpoint more often.
0544. **Value-per-request ranking** — orders queued test batches by expected findings per request cost.
0545. **Priority-aware retries** — P0 retries jump the queue; P3 retries wait for idle capacity.
0546. **Strategic reserve** — ten percent of capacity held unallocated for surprise P0 work.
0547. **Priority calibration review** — monthly report on whether priority predicted actual finding value.
0548. **Multi-objective ranking** — balances value, SLA urgency, and fairness in one transparent score.
0549. **Priority explanation** — every queue position shows its top three ranking factors to the user.
0550. **Deprioritized-hunt digest** — weekly summary of what sank and why, so nothing disappears silently.
0551. **Priority-aware archiving** — low-priority finished hunts archive sooner to save storage.
0552. **Crowd-priority signals** — opt-in anonymized yield data nudges priority for similar targets.
0553. **Priority-based report depth** — P0 hunts get executive summaries; P3 get standard reports.
0554. **Dynamic tier reassignment** — hunts move tiers automatically as findings or blockers change the picture.
0555. **Priority freeze windows** — during incidents, priorities lock so the queue stays stable.
0556. **Priority-weighted learning** — strategy learning weighs P0 hunt outcomes more heavily.
0557. **Hunt-priority API** — external ticketing systems can raise or lower hunt priority programmatically.
0558. **Priority sanity alerts** — warns when a hunt's priority and its actual value diverge sharply.
0559. **DAG-based hunt workflows** — hunts declare dependencies forming an executable directed acyclic graph.
0560. **Finding-triggered follow-ups** — "hunt B starts when hunt A finds an admin panel" as a first-class rule.
0561. **Conditional branching** — workflow paths diverge based on findings (found auth, run auth template).
0562. **Fan-out and fan-in** — one recon hunt fans out to N test hunts, then fans in to one report.
0563. **Artifact passing** — recon outputs (asset lists, fingerprints) flow as typed inputs to downstream hunts.
0564. **Workflow templates** — reusable multi-hunt pipelines like "acquisition security review".
0565. **Workflow versioning** — workflow definitions version like code; running instances pin versions.
0566. **Workflow pause and resume** — pauses the whole DAG with per-node checkpoints.
0567. **Node failure policies** — per-node skip, retry, or abort-with-compensation on failure.
0568. **Parallel branches** — independent workflow branches run concurrently with join synchronization.
0569. **Join conditions** — downstream nodes wait for all or any upstream completions per policy.
0570. **Workflow-level timeouts** — global deadlines with per-node budgets underneath.
0571. **Workflow audit log** — every node transition recorded for compliance and debugging.
0572. **Nested workflows** — a workflow node can itself be a sub-workflow for modularity.
0573. **Event-driven triggers** — webhooks or finding events launch workflows, not just schedules.
0574. **Scheduled workflow runs** — cron-like recurrence for whole pipelines.
0575. **Workflow cost rollup** — total budget consumed across all nodes in one ledger.
0576. **Workflow dry-run** — validates the DAG (cycles, missing inputs) without launching hunts.
0577. **Dynamic node spawning** — a node can spawn new hunt nodes at runtime based on discoveries.
0578. **Human-approval gates** — workflow pauses at defined gates until the user approves continuation.
0579. **Compensation actions** — on abort, the workflow runs cleanup (revoke sessions, archive partials).
0580. **Workflow variable context** — shared key-value context all nodes read and update.
0581. **Node retry with backoff** — failed nodes retry per policy without restarting the workflow.
0582. **Workflow visualization** — live DAG view with node states (waiting, running, done, failed).
0583. **Cross-workflow dependencies** — a node can wait on a node in another workflow.
0584. **Workflow priorities** — whole pipelines carry priority inherited by member hunts.
0585. **Workflow notifications** — alerts on workflow milestones, failures, and gate waits.
0586. **Workflow input validation** — typed inputs validated before the first node runs.
0587. **Workflow output contracts** — each node declares outputs; mismatches fail fast.
0588. **Workflow replay** — re-runs a workflow from any node with original or new inputs.
0589. **Workflow forking** — clones a running workflow to test an alternative branch safely.
0590. **Time-based triggers** — "start phase 2 at 02:00" nodes inside the DAG.
0591. **Finding-threshold gates** — proceed only if finding count or severity crosses a threshold.
0592. **Workflow resource pools** — nodes share a bounded pool so parallel branches can't overspend.
0593. **Workflow SLA tracking** — per-node and end-to-end SLA with breach alerts.
0594. **Workflow access control** — who can edit, launch, or approve each workflow.
0595. **Workflow change approval** — edits to production workflows need a second pair of eyes.
0596. **Workflow execution history** — every run archived with inputs, timings, and outcomes.
0597. **Workflow performance analytics** — bottleneck nodes highlighted from historical timings.
0598. **Workflow error taxonomy** — classified failures (target, infra, config) with tailored handling.
0599. **Workflow-level dedup** — identical workflow runs merge instead of double-executing.
0600. **Workflow pause-on-finding** — critical findings pause the workflow for human review before continuing.
0601. **Workflow budget inheritance** — child hunts derive budgets from the workflow's allocation.
0602. **Workflow secrets handling** — credentials flow to nodes via references, never plaintext in definitions.
0603. **Workflow dry-run cost estimate** — predicts total requests and time for the whole DAG.
0604. **Workflow node pinning** — pins specific nodes to specific workers or egress regions.
0605. **Workflow conditional budgets** — branches get budgets proportional to their expected value.
0606. **Workflow milestone reports** — auto-generates interim reports at each phase gate.
0607. **Workflow rollback** — returns the workflow to the last gate on systemic failure.
0608. **Workflow node marketplace** — reusable node definitions (for example, "subdomain-scan") shared across workflows.
0609. **Workflow testing harness** — runs workflows against fixture targets to validate logic.
0610. **Workflow drift detection** — alerts when a running workflow's behavior diverges from its definition.
0611. **Workflow import and export** — workflows serialize to portable files for sharing and backup.
0612. **Workflow scheduling blackouts** — workflow nodes respect blackout calendars individually.
0613. **Workflow-level health** — aggregated health across nodes with worst-node-first display.
0614. **Workflow completion webhooks** — pushes structured results to CI/CD or ticketing on finish.
0615. **Workflow queue fairness** — one workflow can't monopolize the cluster; per-workflow concurrency caps.
0616. **Workflow node timeout cascade** — a timed-out node's dependents fast-fail instead of hanging.
0617. **Workflow evidence aggregation** — collects every node's evidence into one chain-of-custody bundle.
0618. **Workflow lessons log** — post-run notes attached to the workflow for the next operator.
0619. **Workflow auto-documentation** — generates a human-readable runbook from the DAG definition.
0620. **Workflow kill-switch** — one action halts every node and freezes spend immediately.
0621. **Cross-hunt test dedup** — identical payload-plus-endpoint tests never run twice across hunts.
0622. **Shared tech-fingerprint DB** — host-to-stack fingerprints cached globally with TTL.
0623. **Shared WAF-signature DB** — learned WAF fingerprints reused so every hunt doesn't rediscover them.
0624. **Payload-effectiveness stats** — global stats on which payloads actually yield findings per tech stack.
0625. **Transfer learning** — strategies that worked on similar stacks get prioritized on new targets.
0626. **Global negative-result cache** — "tested clean at version X" suppresses redundant retesting across hunts.
0627. **Finding canonical identity** — the same vulnerability across URLs and hunts collapses to one canonical finding.
0628. **Cross-hunt session reuse** — valid sessions for a target shared across its hunts with safety checks.
0629. **Recon-data cache with TTL** — DNS, certificates, and fingerprints cached and reused across hunts.
0630. **Organization asset graph** — unified graph of the organization's assets shared by all its hunts.
0631. **Per-target rate-limit memory** — learned limits persist across hunts so each hunt doesn't relearn by tripping.
0632. **Technique deprecation** — techniques with near-zero global yield auto-retire with an announcement.
0633. **Technique yield leaderboard** — ranks techniques by findings per thousand requests, updated continuously.
0634. **Strategy recommendation engine** — suggests the highest-yield strategy for a target's fingerprint.
0635. **Fleet-wide learning aggregation** — anonymized outcomes from all hunts improve global strategy weights.
0636. **Similar-target clustering** — groups targets by stack for shared strategy tuning.
0637. **Payload dedup across campaigns** — campaign members coordinate so the same payload set isn't repeated blindly.
0638. **Finding dedup across time** — a finding from last month's hunt suppresses its duplicate this month, linked instead.
0639. **Canonical URL normalization** — treats URL variants (trailing slash, case) as one endpoint for dedup.
0640. **False-positive pattern DB** — globally learned FP signatures auto-flagged before human review.
0641. **Wordlist effectiveness tracking** — learns which wordlists discover the most per target type.
0642. **Block-pattern sharing** — "this behavior got blocked on five similar targets" warns new hunts proactively.
0643. **Auth-flow pattern library** — reusable login and session handling per app type, learned across hunts.
0644. **Crawl-frontier sharing** — discovered URLs for a target shared across its concurrent hunts.
0645. **Header-fingerprint DB** — server header combinations mapped to exact tech versions globally.
0646. **Error-page fingerprint DB** — custom error pages recognized globally to avoid misclassification.
0647. **Honeypot signature sharing** — known honeypot markers shared so hunts deprioritize them everywhere.
0648. **Safe-technique allowlist** — globally verified low-risk techniques get fast-track approval.
0649. **Risky-technique registry** — techniques needing approval tracked with their incident history.
0650. **Learning-rate guardrails** — global strategy weights update slowly to avoid one bad hunt poisoning the fleet.
0651. **Cold-start strategy defaults** — new targets get the globally best-performing default strategy mix.
0652. **Per-industry strategy packs** — banking versus SaaS strategies tuned from industry-clustered outcomes.
0653. **Strategy drift alerts** — warns when a hunt's strategy diverges far from what works for its cluster.
0654. **Knowledge-distillation pipeline** — compresses lessons from deep hunts into fast-hunt heuristics.
0655. **Hunt-similarity search** — "find past hunts like this target" for strategy inspiration.
0656. **Outcome-labeled dataset** — every hunt's technique-to-outcome pairs stored for analysis.
0657. **Counterfactual logging** — records what the strategy considered but didn't try, for offline learning.
0658. **Exploration budget** — a fixed percentage of requests reserved for trying unproven techniques.
0659. **Exploit-chain pattern library** — successful chains abstracted into reusable chain templates.
0660. **Chain-step effectiveness** — learns which chain steps actually connect in practice.
0661. **Report-language learning** — learns which phrasing gets findings accepted fastest by program owners.
0662. **Triage-time learning** — tracks review time per finding type to prioritize high-signal work.
0663. **Duplicate-finding merger** — near-duplicate findings auto-merge with combined evidence.
0664. **Finding-lineage tracking** — shows which hunt, technique, and payload produced each finding.
0665. **Global scope intelligence** — opt-in organization asset graphs improve everyone's scoping.
0666. **Technique-combination learning** — learns which technique pairs synergize, not just solo yields.
0667. **Time-to-first-finding predictor** — predicts how long a strategy takes to land the first finding.
0668. **Strategy-aging model** — discounts old success data as targets and defenses evolve.
0669. **Adversarial-drift detection** — notices when global yields drop (defenses adapting) and raises exploration.
0670. **Learning opt-out** — users can exclude their hunts from fleet learning entirely.
0671. **Federated learning mode** — strategy improvements shared as weight updates, never raw hunt data.
0672. **Strategy rollback** — if a global weight update hurts yields, it auto-rolls back.
0673. **Champion-challenger testing** — new strategies compete against the champion on live hunts safely.
0674. **Bandit-based allocation** — multi-armed bandits distribute requests across techniques by live yield.
0675. **Contextual bandits** — technique choice conditioned on target fingerprint, not just global averages.
0676. **Thompson sampling** — probabilistic technique selection balancing exploration and exploitation.
0677. **Yield-confidence intervals** — strategies show uncertainty, not just point estimates of yield.
0678. **Regret tracking** — measures how much yield was lost to suboptimal technique choices.
0679. **Meta-learning warm start** — new technique packs bootstrap from the most similar existing pack.
0680. **Catastrophic-forgetting guard** — global updates preserve performance on previously learned target types.
0681. **Learning dashboard** — visualizes technique yields, trends, and deprecations over time.
0682. **Strategy changelog** — human-readable log of what the fleet learned each week.
0683. **Time-boxed hunt contracts** — every hunt declares a deadline; the planner builds a plan that fits.
0684. **Time-box degradation ladder** — ordered fallback from deep tests to shallow to recon-only as the deadline approaches.
0685. **Anytime reports** — the report is valid whenever the hunt stops, with coverage honestly stated.
0686. **Deadline-aware strategy picker** — chooses techniques by expected yield per remaining minute.
0687. **Sprint mode** — maximum-intensity short hunts for incident response with safety caps.
0688. **Minimum-viable-hunt guarantee** — even a ten-minute hunt delivers a recon map plus top-risk checks.
0689. **Deadline-extension requests** — the hunt proposes an extension with justification instead of silently overrunning.
0690. **Soft versus hard deadlines** — soft deadlines degrade gracefully; hard deadlines checkpoint and stop exactly on time.
0691. **Degradation policies per template** — each template defines its own fallback ladder.
0692. **Progress-based time reallocation** — time shifts from finished areas to promising unfinished ones.
0693. **Checkpoint-before-deadline** — forces a checkpoint five minutes before the deadline for clean reporting.
0694. **Post-deadline wrap-up window** — a short grace period for report generation after testing stops.
0695. **Time-boxed recon phase** — recon gets a fixed slice; testing starts on time even if recon is incomplete.
0696. **Per-phase time budgets** — recon, test, chain, and report each get allocations the orchestrator enforces.
0697. **Overtime authorization** — exceeding the time box needs explicit user approval, logged.
0698. **Time-box presets** — "15-minute triage", "2-hour standard", and "overnight deep" one-click options.
0699. **Deadline-driven parallelism** — raises concurrency (within safety limits) as the deadline approaches.
0700. **Early-finish detection** — when coverage targets are met early, the hunt finishes and frees capacity.
0701. **Time-boxed technique trials** — new techniques get bounded trial time before full adoption.
0702. **Degradation transparency** — the report states exactly which degradations engaged and why.
0703. **Time-aware chaining** — exploit chains only start if there's time to finish and verify them.
0704. **Deadline-risk indicator** — live gauge showing probability of finishing the plan in time.
0705. **Time-box negotiation** — the scheduler proposes scope and time tradeoffs when the box is too tight.
0706. **Graceful pause at box end** — hitting the deadline pauses the hunt, never kills it, ready to resume with a new box.
0707. **Time-sliced campaigns** — campaign members get fair time slices instead of running to completion serially.
0708. **Remaining-time estimator** — continuously predicts time-to-completion from velocity.
0709. **Time-boxed retests** — fix-verification hunts get tight boxes with binary pass-or-fail outcomes.
0710. **Deadline inheritance** — dependent hunts derive deadlines from the workflow's end date.
0711. **Time-box-aware scoping** — auto-expansion is disabled or limited inside tight time boxes.
0712. **Urgency-weighted spending** — burns budget faster when the deadline is near and value is high.
0713. **Time-box compliance mode** — compliance hunts guarantee control coverage within the box or flag gaps.
0714. **Degradation drill mode** — practices graceful degradation on demand to verify ladders work.
0715. **Time-box history** — tracks planned versus actual durations to improve future estimates.
0716. **Deadline-miss autopsy** — analyzes why a hunt missed its box and updates estimators.
0717. **Time-boxed learning** — exploration gets a bounded slice so it can't consume the whole hunt.
0718. **Partial-chain handling** — chains that run out of time checkpoint mid-chain with resume notes.
0719. **Time-boxed report depth** — short boxes produce concise reports; long boxes get full narratives.
0720. **Deadline-aware notifications** — warns at 50 and 90 percent of elapsed time, not just at expiry.
0721. **Time-box templates** — each template ships with a default box and degradation ladder.
0722. **Multi-box hunts** — long hunts split into sequential time boxes with review gates between.
0723. **Time-box overrun guard** — hard-stops runaway modules that exceed their slice by three times.
0724. **Timezone-aware boxes** — boxes defined in the user's local time and displayed clearly.
0725. **Box-versus-scope fitter** — automatically trims scope to fit the box, showing what was cut.
0726. **Time-boxed stealth** — stealth techniques get realistic time multipliers in estimates.
0727. **Deadline-driven evidence triage** — near deadline, only high-severity evidence gets full capture.
0728. **Time-box fairness** — the scheduler prevents one long hunt from eating all night-window capacity.
0729. **Box-extension audit** — every granted extension logged with reason and impact.
0730. **Time-boxed campaign phases** — each campaign phase has its own box with gate criteria.
0731. **Remaining-value estimator** — estimates findings still on the table to justify extension requests.
0732. **Time-box versus quality tradeoff display** — shows the user what extra hours would likely buy.
0733. **Auto-boxing by target size** — scope size suggests a sensible default time box.
0734. **Box-breach circuit breaker** — repeated overruns trigger a mandatory plan review before the next launch.
0735. **Time-boxed dry runs** — estimates produced within seconds for scheduling decisions.
0736. **Deadline-staggered campaigns** — member deadlines cascade so reports assemble in order.
0737. **Time-box-aware retries** — retries get smaller boxes than original hunts by policy.
0738. **Graceful-degradation score** — rates how well a hunt degraded (coverage kept versus lost).
0739. **Box-completion certificates** — compliance hunts get a signed statement of box, coverage, and method.
0740. **Time-box marketplace** — shared community presets for common hunt durations.
0741. **Deadline API** — external systems can set or query hunt deadlines programmatically.
0742. **Time-box pause exclusion** — paused time doesn't count against the box, tracked separately.
0743. **Box-efficient technique ranking** — ranks techniques by findings per minute for tight boxes.
0744. **Final-sweep reserve** — the last ten percent of the box reserved for verification and report polish.
0745. **OODA-loop orchestrator** — explicit observe, orient, decide, act cycles drive every autonomous hunt.
0746. **Hypothesis engine** — the agent states testable hypotheses ("admin panel at /admin") before probing.
0747. **Curiosity-driven recon** — prioritizes the least-understood attack surface next, not just the biggest.
0748. **Surprise-driven pivoting** — unexpected responses (odd status codes, strange headers) trigger investigation.
0749. **Confidence-calibrated actions** — each action carries a confidence score; low-confidence risky actions get deferred.
0750. **Risk-sensitive autonomy** — intrusive actions require higher confidence than read-only ones.
0751. **Self-interruption on confusion** — when observations contradict the plan, the agent stops and replans instead of pushing on.
0752. **Plan-repair engine** — patches broken plans (dead end becomes alternative path) instead of restarting from scratch.
0753. **Opportunistic deep-dives** — a juicy finding temporarily suspends the plan for focused exploitation, then returns.
0754. **Attention over attack surface** — a learned attention map focuses effort where expected value is highest.
0755. **Working-memory manager** — keeps the active context window pruned to the most decision-relevant facts.
0756. **Goal decomposition** — "own the app" decomposes into sub-goals with per-goal strategies.
0757. **Sub-goal prioritization** — sub-goals ranked by expected information gain and finding value.
0758. **Information-gain estimator** — each candidate action scored by how much it would teach the agent.
0759. **Expected-value planner** — actions chosen by probability of finding times severity divided by cost, recomputed continuously.
0760. **Counterfactual planner** — "what would I test if this assumption were wrong" runs as a background thread.
0761. **Assumption tracker** — the agent lists its working assumptions and watches for violations.
0762. **Belief-state representation** — maintains probabilistic beliefs about the target (tech, vulnerabilities) updated per observation.
0763. **Bayesian technique selection** — updates technique priors with every observation via Bayes' rule.
0764. **Decision journaling** — every major decision logged with its reasoning for later review.
0765. **Regret-minimizing planner** — chooses actions minimizing worst-case wasted effort.
0766. **Satisficing thresholds** — stops optimizing a sub-goal once "good enough" evidence is reached.
0767. **Escalation-of-commitment guard** — prevents pouring requests into a dead lead; forces periodic re-evaluation.
0768. **Fresh-eyes replanning** — periodically replans from scratch ignoring sunk cost, then compares to the current plan.
0769. **Devil's-advocate module** — a sub-agent argues against the current plan to surface blind spots.
0770. **Red-team and blue-team split** — one planner attacks while another predicts defenses, sharpening both.
0771. **Scenario planning** — maintains two or three contingency plans for likely target responses.
0772. **Decision latency budget** — caps how long the planner can deliberate before it must act.
0773. **Hierarchical planning** — strategic (which vulnerability class) to tactical (which payload) to operational (exact request).
0774. **Reactive versus deliberative balance** — fast reflexes for obvious cases, deep planning for novel ones.
0775. **Memory-augmented decisions** — past hunt outcomes retrieved as context for current choices.
0776. **Causal reasoning** — distinguishes correlation from causation in observations (block versus coincidence).
0777. **Abductive diagnosis** — infers the most likely explanation for anomalies (WAF, deploy, honeypot).
0778. **Deductive verification** — derives testable predictions from hypotheses and checks them.
0779. **Analogical reasoning** — "this looks like target X" retrieves X's winning strategy.
0780. **Meta-cognitive monitor** — watches the planner's own performance and tunes its parameters.
0781. **Cognitive-load limiter** — caps concurrent hypotheses so the agent doesn't thrash.
0782. **Decision explainability** — every autonomous choice can show its top reasons on demand.
0783. **Value-of-information analysis** — decides whether another probe is worth it before acting.
0784. **Optimal-stopping rules** — knows when to stop testing an endpoint via formal diminishing-returns rules.
0785. **Portfolio of strategies** — runs a small ensemble of strategies and allocates by live performance.
0786. **Strategy arbitrage** — shifts requests to whichever strategy is currently outperforming.
0787. **Exploration schedule** — exploration rate decays as the hunt matures, formalized per template.
0788. **Novelty bonus** — untried techniques get a selection bonus to prevent premature convergence.
0789. **Anti-herding** — avoids all concurrent hunts converging on identical techniques.
0790. **Decision checkpoints** — the planner must re-justify its plan every N actions.
0791. **Goal-gradient effect** — effort intensifies as coverage nears completion, countering tail drag.
0792. **Premortem reasoning** — before big moves, the agent lists why it might fail and mitigates.
0793. **Second-order effects** — considers how an action changes target behavior (alerts, blocks).
0794. **Temporal reasoning** — sequences actions considering time (token expiry, rate windows).
0795. **Resource-aware planning** — plans respect remaining budget as a first-class constraint.
0796. **Robust planning** — prefers plans that survive likely disruptions (blocks, downtime).
0797. **Anytime planning** — the planner always has a valid fallback plan ready, refined over time.
0798. **Plan-diversity enforcement** — concurrent hunts on one target use deliberately different plans.
0799. **Decision-fatigue guard** — after long hunts, the planner simplifies choices to avoid thrash.
0800. **Introspection reports** — periodic "what I'm thinking and why" summaries for the user.
0801. **Goal-revision protocol** — the agent can propose changing the hunt goal when evidence warrants, with approval.
0802. **Constraint propagation** — new constraints (budget cut, scope change) propagate through the whole plan instantly.
0803. **Decision versioning** — planner decisions versioned so regressions in autonomy can be bisected.
0804. **Ethical-constraint checker** — every planned action screened against safety policy before execution.
0805. **Autonomy-level dial** — per-hunt setting from "suggest" to "full auto" controlling decision latitude.
0806. **Decision-latency analytics** — tracks planner speed to catch pathological deliberation loops.
0807. **Approval gates for risky actions** — exploit chaining pauses for one-tap approval by default.
0808. **Escalation policies** — defines who gets notified for what severity, with fallback chains.
0809. **Mid-hunt chat routing** — user questions route to the orchestrator with full hunt context attached.
0810. **Notification batching** — non-urgent updates bundle into digests at user-chosen intervals.
0811. **Quiet hours for pings** — no non-P0 notifications during user-configured sleep hours.
0812. **Critical-finding escalation** — criticals trigger an immediate alert with evidence summary and suggested next step.
0813. **Human veto window** — the agent announces a risky action and waits N seconds for veto.
0814. **Supervised autonomy levels** — per-hunt dial: supervised, semi-auto, full-auto.
0815. **Human handoff package** — one export with state, findings, and "where I was going" for seamless takeover.
0816. **Human-feedback incorporation** — thumbs up or down on agent decisions tunes future autonomy.
0817. **On-call rotation** — campaign alerts route to whoever is on call, with escalation on no-acknowledgement.
0818. **Finding review queue** — human triage queue with bulk actions and keyboard shortcuts.
0819. **False-positive dispute flow** — one-click "not a vulnerability" with reason feeds the FP database.
0820. **Approval audit trail** — every approval and denial logged with context for accountability.
0821. **Standing approvals** — pre-approve action classes ("read-only chaining OK") to reduce interruptions.
0822. **Approval expiry** — granted approvals lapse after a scope or time boundary.
0823. **Break-glass override** — the user can force-continue a paused hunt with full logging.
0824. **Human-in-the-loop analytics** — tracks interruption rate to tune autonomy (fewer pings means better).
0825. **Escalation-fatigue guard** — caps alerts per hour; overflow becomes a digest.
0826. **Context-rich alerts** — every alert includes what happened, why it matters, and one-tap actions.
0827. **Alert-severity calibration** — learns which alerts the user actually acts on and tunes thresholds.
0828. **Two-person rule** — destructive-adjacent actions need two approvals in team setups.
0829. **Approval delegation** — the user can delegate approvals to a teammate temporarily.
0830. **Scheduled check-ins** — the agent summarizes progress at user-set intervals during long hunts.
0831. **Interrupt coalescing** — simultaneous questions from multiple hunts merge into one prompt.
0832. **Human-readable plan diffs** — when the agent replans, the user sees what changed in plain language.
0833. **Undo for agent actions** — reversible actions (scope changes, pauses) get one-click undo.
0834. **Human override of strategy** — the user can pin or ban techniques mid-hunt; the planner obeys.
0835. **Question batching** — the agent saves up non-urgent questions and asks them together.
0836. **Confidence-gated questions** — the agent only asks when its own confidence is below threshold.
0837. **Suggested replies** — mid-hunt chat offers one-tap answers to the agent's questions.
0838. **Voice-note briefings** — the agent can deliver spoken progress summaries on request.
0839. **Handoff to expert queue** — hard problems route to the most relevant human expert.
0840. **Approval templates** — reusable approval policies per hunt type ("pentest engagement", "bug bounty").
0841. **Emergency contact protocol** — for P0 findings, the agent follows a defined call tree.
0842. **Human-latency tracking** — measures approval wait times to right-size veto windows.
0843. **Autonomy report card** — weekly summary of decisions made, approvals needed, and overrides, trending autonomy.
0844. **Shadow mode** — the agent proposes actions without executing, for training and trust-building.
0845. **Graduated autonomy** — new users start supervised; autonomy expands as the agent proves itself.
0846. **Per-action autonomy matrix** — read, scan, chain, and verify each get their own autonomy level.
0847. **Human-intent inference** — the agent infers intent from vague commands ("go deeper on the API").
0848. **Clarification protocol** — asks precise clarifying questions instead of guessing on ambiguity.
0849. **Conversation memory** — mid-hunt chat remembers prior decisions across sessions.
0850. **Multilingual interaction** — the agent converses in the user's language, including mid-hunt.
0851. **Accessibility-first alerts** — alerts work with screen readers and support text-only fallbacks.
0852. **Approval from mobile** — one-tap approvals optimized for phone notifications.
0853. **Time-boxed approvals** — approvals auto-resolve per policy if the human doesn't respond in time.
0854. **Approval decision support** — each approval request shows risk, evidence, and rollback plan.
0855. **Human-curated allowlists** — user-approved payload classes skip future approvals.
0856. **Post-approval monitoring** — approved risky actions get extra scrutiny while executing.
0857. **Approval revocation** — the user can revoke a standing approval instantly, halting affected hunts.
0858. **Team annotation** — multiple humans can comment on a hunt's timeline collaboratively.
0859. **Expert-escalation routing** — auth issues go to the identity expert, infra issues to the infra expert.
0860. **Human QA sampling** — random samples of autonomous decisions get human review for quality.
0861. **Trust scoring per hunt type** — the system tracks demonstrated reliability per template to set defaults.
0862. **Override analytics** — analyzes human overrides to improve the autonomy defaults.
0863. **Collaborative planning** — the user and agent co-edit the hunt plan before launch.
0864. **One-line status** — "hunt 63% done, 2 highs, healthy" always available for a glance.
0865. **End-of-hunt debrief** — the agent walks the user through what it did and learned.
0866. **Human feedback loop closure** — the user sees how their feedback changed future hunts.
0867. **Operator skill profiles** — different team members get different approval powers.
0868. **Autonomy incident review** — any autonomy mistake gets a blameless post-mortem with fixes.
0869. **Hunt journal timeline** — every action, finding, and decision on a scrollable timeline.
0870. **Real-time hunt dashboard** — live progress, health, findings, and spend in one view.
0871. **Immutable audit trail** — append-only log of all hunt actions for compliance.
0872. **MTTD and MTTR metrics** — mean time to detect findings and to recover from failures, tracked per template.
0873. **Distributed action tracing** — each request traced from planner decision to response.
0874. **Structured log levels** — debug, info, warn, error with per-hunt verbosity control.
0875. **Evidence chain of custody** — every artifact hashed and timestamped from capture to report.
0876. **Hunt replay** — re-executes a hunt's journal against fixtures to reproduce behavior for debugging.
0877. **Alerting rules engine** — user-defined rules ("alert if critical found") evaluated on hunt events.
0878. **Campaign status page** — shareable live page showing campaign progress to stakeholders.
0879. **Hunt diffing** — visual diff of coverage, findings, and scope between two hunts.
0880. **Exportable ops reports** — CSV and JSON exports of hunt metrics for external BI tools.
0881. **Retention policies** — auto-prune raw traffic logs after N days while keeping findings forever.
0882. **PII redaction in logs** — automatic masking of tokens, emails, and secrets in stored logs.
0883. **Log sampling** — high-volume hunts store sampled traffic but full findings, keeping storage sane.
0884. **Metric cardinality guard** — prevents metric explosion from unbounded label values.
0885. **SLOs per hunt type** — defined objectives (for example, "report within 4h") with burn-rate alerts.
0886. **Error-budget policy** — autonomy features pause when their error budget burns too fast.
0887. **Trace sampling** — full traces for interesting requests, sampled traces for routine ones.
0888. **Live tail mode** — streams a hunt's live log to the dashboard like tail -f.
0889. **Hunt search** — full-text search across all hunts' journals and findings.
0890. **Anomaly annotations** — health anomalies auto-annotated on the timeline with causes.
0891. **Performance flame graphs** — shows where hunt time goes (DNS, TLS, waiting, analysis).
0892. **Dependency map** — visualizes which hunts and strategies depend on shared services.
0893. **Capacity dashboard** — cluster-wide worker, egress, and budget utilization shown live.
0894. **Finding-lifecycle view** — each finding's journey from found to verified to triaged to reported.
0895. **Coverage treemap** — visual map of tested versus untested attack surface.
0896. **Technique waterfall** — per-technique timeline showing when each ran and what it found.
0897. **Network topology view** — discovered hosts, services, and trust relationships graphed.
0898. **Change feed** — every significant hunt event as a filterable feed.
0899. **Dashboard personalization** — users pin the metrics they care about per hunt type.
0900. **Scheduled digest emails** — daily and weekly rollups of hunt activity delivered by email.
0901. **Webhook event stream** — every hunt event pushable to user infrastructure.
0902. **Metrics API** — Prometheus-style endpoint for hunt and fleet metrics.
0903. **Log-redaction audit** — verifies redaction actually caught secrets via sampling.
0904. **Evidence preview** — click any finding to see its raw request and response evidence inline.
0905. **Timeline export** — the hunt journal exports as a shareable HTML timeline.
0906. **Multi-hunt comparison** — side-by-side metrics for hunts against similar targets.
0907. **Fleet health overview** — one screen with all hunts' health scores and drill-down.
0908. **Alert correlation** — groups related alerts (block storm across hunts) into one incident.
0909. **Incident timeline** — auto-built timeline for any hunt incident from correlated events.
0910. **Observability cost control** — caps telemetry spend; degrades gracefully (samples more) under pressure.
0911. **Data-residency controls** — telemetry stored in the user's chosen region.
0912. **Audit-ready exports** — one-click package of logs, configs, and approvals for auditors.
0913. **Tamper-evident logs** — hash-chained logs detect post-hoc modification.
0914. **Read-only observer role** — stakeholders watch live hunts without any control powers.
0915. **Hunt bookmarks** — users bookmark timeline moments for review or reporting.
0916. **Automated RCA** — root-cause analysis drafted automatically for hunt failures.
0917. **Telemetry schema versioning** — log formats versioned for long-term parseability.
0918. **Dark-mode ops console** — the dashboard respects user theme for late-night operations.
0919. **Keyboard-driven console** — the full dashboard operable via keyboard for speed.
0920. **Mobile ops view** — condensed live hunt status for phones.
0921. **Ops runbook linking** — alerts link to the relevant runbook section automatically.
0922. **Metric forecasting** — predicts tonight's capacity needs from scheduled hunts.
0923. **Saturation warnings** — warns before worker or egress pools saturate.
0924. **Hunt scorecard** — one-page grade per hunt: coverage, findings, efficiency, health.
0925. **Benchmark comparisons** — compares hunt metrics against fleet medians.
0926. **Data-quality monitors** — watches for broken telemetry (missing heartbeats, skewed clocks).
0927. **Clock-skew detection** — flags worker clock drift that would corrupt timelines.
0928. **Log-integrity verification** — periodic checks that audit logs are complete and ordered.
0929. **Observer-effect guard** — telemetry collection never meaningfully slows the hunt.
0930. **Ops retrospective generator** — auto-drafts the operations section of post-hunt reviews.
0931. **Post-hunt retrospectives** — auto-generated summaries of what worked, what didn't, and what to change.
0932. **Strategy effectiveness scoring** — per-strategy yield scores updated after every hunt.
0933. **Strategy library versioning** — strategies versioned like code with changelogs.
0934. **Technique A/B testing** — controlled experiments comparing technique variants on live hunts.
0935. **Technique yield tracking** — findings per thousand requests, per technique, tracked continuously.
0936. **Auto-deprecation of dead techniques** — zero-yield techniques retire automatically with notice.
0937. **New-technique onboarding** — new techniques get sandboxed trials before fleet rollout.
0938. **Hunt quality score** — composite grade covering coverage, finding value, efficiency, and report quality.
0939. **Benchmark suite** — standard fixture targets every strategy must pass before release.
0940. **Strategy regression tests** — catches strategy updates that break previously working hunts.
0941. **Knowledge distillation** — compresses deep-hunt insights into fast-hunt heuristics.
0942. **Fleet-wide aggregation** — anonymized outcomes improve global strategy weights nightly.
0943. **Curriculum learning** — strategies progress from easy fixtures to hard real targets in order.
0944. **Few-shot strategy adaptation** — new target types get working strategies from a handful of examples.
0945. **Meta-controller tuning** — the orchestrator's own parameters tuned from historical hunt outcomes.
0946. **Hyperparameter search** — automated sweeps for planner settings (concurrency, timeouts) per template.
0947. **Strategy embeddings** — vector representations of strategies enabling similarity search.
0948. **Hunt-outcome prediction** — predicts finding count and severity before launch from plan plus target features.
0949. **Counterfactual evaluation** — estimates how alternative strategies would have performed, offline.
0950. **Off-policy learning** — learns from hunts run under old strategies without rerunning them.
0951. **Safe policy updates** — new strategies roll out behind guardrails with automatic rollback.
0952. **Strategy cards** — model-card-style docs per strategy: strengths, weaknesses, costs.
0953. **Bias detection in learning** — checks that strategy learning isn't biased toward easy target types.
0954. **Fairness across target types** — ensures learning improves all clusters, not just the common ones.
0955. **Learning-rate scheduling** — global updates slow as the strategy library matures.
0956. **Catastrophic-interference guard** — new learning can't destroy old competence, verified by benchmarks.
0957. **Ensemble strategy selection** — combines multiple learned models for technique choice.
0958. **Uncertainty-aware learning** — strategies express confidence; uncertain ones get exploration budget.
0959. **Active learning** — the fleet deliberately hunts targets that would teach it the most.
0960. **Self-play** — attack planner versus defense predictor spar in simulation to harden both.
0961. **Adversarial robustness** — strategies tested against simulated adaptive defenses.
0962. **Sim-to-real transfer** — simulation-learned tactics validated on fixture targets before production.
0963. **Human-demonstration learning** — operator-corrected hunts become training examples.
0964. **Preference learning** — learns strategy preferences from human thumbs up and down.
0965. **Inverse reinforcement learning** — infers expert operators' implicit strategies from their hunt logs.
0966. **Skill chaining** — learned micro-skills (for example, "bypass this WAF pattern") compose into bigger plays.
0967. **Hierarchical skill learning** — low-level tactics and high-level strategies learned at separate timescales.
0968. **Memory-augmented meta-learning** — a shared memory of "what worked where" that all strategies query.
0969. **Continual learning** — the fleet learns continuously without forgetting, verified by retained benchmarks.
0970. **Learning dashboards** — visualizes what the fleet learned this week in plain language.
0971. **Strategy genealogy** — traces each strategy's lineage: which hunts and updates shaped it.
0972. **Ablation studies** — measures each strategy component's contribution by removing it in trials.
0973. **Causal strategy analysis** — determines which strategy changes actually caused yield improvements.
0974. **Learning audit trail** — every weight update logged with the data that caused it.
0975. **Reproducible learning** — learning runs are seeded and replayable for debugging.
0976. **Federated meta-learning** — fleets share learned improvements without sharing hunt data.
0977. **Differential-privacy learning** — fleet aggregates add noise so no single hunt is identifiable.
0978. **Learning incentive alignment** — strategies optimized for true finding value, not vanity metrics.
0979. **Goodhart guard** — watches for strategies gaming metrics (for example, inflating coverage numbers).
0980. **Strategy diversity index** — measures fleet strategy diversity; low diversity triggers exploration.
0981. **Innovation budget** — fixed capacity reserved for experimental strategies.
0982. **Strategy incubator** — promising experimental strategies get mentored rollout with extra monitoring.
0983. **Kill criteria for experiments** — experiments stop automatically when futility is statistically clear.
0984. **Learning from failures** — failed hunts contribute as much to learning as successful ones.
0985. **Near-miss analysis** — "almost findings" mined for technique improvements.
0986. **Cross-domain transfer** — web-hunting lessons transferred to API and mobile-backend hunting.
0987. **Temporal pattern learning** — learns time-based target behaviors (deploy windows, batch jobs).
0988. **Seasonal re-tuning** — strategies re-tuned quarterly as the threat landscape shifts.
0989. **Learning SLA** — new CVEs get working detection strategies within a target timeframe.
0990. **Community strategy contributions** — vetted external strategies onboarded with attribution.
0991. **Strategy review board** — human experts approve major strategy changes before rollout.
0992. **Transparent learning log** — users can read exactly what the fleet learned from their hunts (opt-in).
0993. **Learning off-switch** — one toggle freezes all learning for fully deterministic hunts.
0994. **Deterministic replay mode** — learning-disabled hunts replay bit-identically for compliance.
0995. **Learning impact reports** — quantifies how much learning improved yields this quarter.
0996. **Strategy sunset ceremonies** — retired strategies get a final report of their lifetime contributions.
0997. **Meta-learning research queue** — open questions ("why do auth techniques underperform?") tracked and investigated.
0998. **Cross-fleet benchmarking** — opt-in comparison of strategy yields across deployments.
0999. **Learning-driven roadmap** — the product roadmap informed by what the fleet struggles to learn.
1000. **Autonomy maturity model** — five defined levels from assisted to fully autonomous, with graduation criteria per hunt type.
