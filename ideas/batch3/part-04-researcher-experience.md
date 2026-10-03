23005. **Per-hunt focus picker** — at hunt creation, choose exactly which phases run (recon only, auth testing only, full stack) so agent budget is spent only where the operator cares.
23006. **Custom skip-list per hunt** — define URL patterns or endpoints the agent must never touch (e.g. `/payments/*`), hard-blocked at the request layer.
23007. **Depth limits per phase** — set separate max depths for recon, fuzzing, and exploitation so a deep crawl can pair with shallow fuzzing.
23008. **Custom wordlist upload per hunt** — attach target-specific wordlists that override defaults for that hunt only, without polluting global lists.
23009. **Time-box controls** — cap total hunt duration and per-phase minutes; the agent auto-wraps findings and writes the report when time expires.
23010. **Aggressiveness slider** — a 1–5 scale from passive-only observation to full active exploitation, mapped to payload intensity and request volume.
23011. **Payload category toggles** — enable or disable individual payload families (XSS, SSRF, SQLi) per hunt for tightly scoped engagements.
23012. **Scope freeze mid-hunt** — lock declared scope so newly discovered out-of-scope hosts queue for operator review instead of being tested.
23013. **Phase order override** — reorder phases (e.g. fuzz before recon) when prior intel suggests a better sequence.
23014. **Custom headers per hunt** — inject tenant headers or auth tokens into every request for multi-tenant target testing.
23015. **Rate-limit ceiling** — set a max requests-per-second cap per hunt to avoid tripping WAFs or breaking fragile targets.
23016. **Login credential profiles** — save named credential sets (test user, admin) that can be attached to any hunt for authenticated testing.
23017. **Hunt configuration templates** — save a full setup (focus, wordlists, aggressiveness) as a reusable template for recurring target types.
23018. **Clone hunt with tweaks** — duplicate a finished hunt's configuration with edits applied, for fast retesting after fixes.
23019. **Do-not-touch time windows** — specify hours when the agent must pause active testing against production targets.
23020. **Out-of-scope auto-detect** — the agent flags discovered assets outside declared scope and pauses for operator confirmation before touching them.
23021. **Phase retry budgets** — per-phase retry limits (e.g. recon gets two retries) that prevent infinite loops on flaky targets.
23022. **Evidence verbosity setting** — choose minimal, screenshot-rich, or verbose evidence capture per hunt to control report size.
23023. **Minimum severity floor** — filter findings below a chosen severity so the triage queue shows only what matters.
23024. **Target environment tags** — label targets dev, staging, or prod; prod auto-forces low aggressiveness and quiet-hours compliance.
23025. **Parallel engine toggles** — choose which engines run (recon, vulnDetector, secretScanner) instead of all-by-default.
23026. **Custom exclusion regexes** — regex patterns for URLs or parameters to skip, such as logout links or CSRF-protected forms.
23027. **Session timeout for authenticated hunts** — automatically invalidate test-account sessions when the hunt ends for credential hygiene.
23028. **Per-hunt notification override** — a hunt's own notification rules take precedence over global preferences.
23029. **Hunt priority tier** — mark hunts low, normal, or critical; critical hunts preempt shared agent capacity.
23030. **PoC depth choice** — decide whether proof-of-concepts stop at detection or include full exploitation chains.
23031. **Target technology hints** — declare the stack (WordPress, React SPA) to preload the most relevant payload sets.
23032. **Manual step injection** — queue operator-authored custom test steps that the agent executes in sequence.
23033. **Enforced hunt naming conventions** — auto-name hunts from target, date, and focus area for a consistent, searchable history.
23034. **Retest diff mode** — rerun a prior hunt configuration and highlight only findings whose status changed.
23035. **API-only vs UI-only mode** — restrict testing to API endpoints or the browser UI surface per hunt.
23036. **Data-handling policy per hunt** — specify whether the agent may submit realistic-looking data or synthetic-only data in forms.
23037. **Egress geo region** — choose the request exit region so traffic matches the target's expected geography.
23038. **Custom TLS fingerprint** — rotate or pin JA3 fingerprints to reduce bot-detection blocks.
23039. **CAPTCHA handling policy** — choose pause-for-operator, skip-forms, or attempt-solve when CAPTCHAs appear.
23040. **JavaScript rendering toggle** — enable or disable headless-browser rendering for SPA-heavy targets.
23041. **Cookie-banner auto-dismiss** — opt the agent into auto-dismissing consent banners during crawling.
23042. **Form-fill persona** — named synthetic personas (name, email, phone) the agent uses when submitting forms.
23043. **Maximum findings cap** — stop active exploitation after N confirmed findings to keep reports focused.
23044. **Severity-weighted time allocation** — automatically allocate more phase time to high-impact areas like auth and payments.
23045. **Hunt notes field** — free-text operator notes attached to the hunt and shown in the report header.
23046. **Custom stop conditions** — define string or regex signals (e.g. "account locked") that halt the hunt immediately.
23047. **Checkpoint save frequency** — control how often hunt state snapshots persist for crash recovery.
23048. **Warm-start from prior hunt** — reuse a previous hunt's cached recon data to skip re-enumeration.
23049. **Baseline profile import** — import an earlier scan's findings as the known baseline so only new issues surface.
23050. **Tag-based rule packs** — tags like "pci" or "fintech" auto-apply curated configuration packs.
23051. **Operator approval gates** — require an operator click before exploitation phases begin on sensitive targets.
23052. **Per-phase compute budgets** — allocate agent compute credits per phase for cost control.
23053. **Testing locale setting** — set Accept-Language and locale to exercise region-specific behavior.
23054. **Mobile emulation mode** — test the mobile variant with mobile headers and viewport.
23055. **Subdomain enumeration scope** — choose passive-only, active brute-force, or both for subdomain discovery.
23056. **Port-scan intensity** — light (top 100 ports) versus full coverage toggle for network-visible targets.
23057. **DNS enumeration depth** — control zone-transfer attempts and DNS brute-force aggressiveness.
23058. **Certificate-transparency toggle** — include or exclude CT-log-derived subdomains from scope.
23059. **Archive source toggle** — include historical URL data from web archives in recon, or skip for speed.
23060. **Public-repo secret search toggle** — enable or disable searching public code for target secrets per hunt.
23061. **External intel enrichment toggle** — pull Shodan/Censys-style data on discovered IPs when enabled.
23062. **Whois lookup toggle** — include registrar and ownership intel in recon reports.
23063. **Fingerprint verbosity** — basic header-based versus deep JS-bundle stack detection.
23064. **Parameter-mining intensity** — control how aggressively hidden parameters are mined per endpoint.
23065. **Fuzz payload cap per parameter** — bound request volume with a per-parameter payload limit.
23066. **Encoding-variation toggle** — test URL and double-encoding bypass variants, or skip them.
23067. **HTTP method-tampering toggle** — include method-override and verb-tampering tests in the auth phase.
23068. **Header-injection test toggle** — run header-injection and log-poisoning checks as a standalone option.
23069. **JWT analysis depth** — decode-only versus full algorithm-confusion testing for discovered tokens.
23070. **CORS misconfiguration toggle** — test cross-origin policies as an independent phase.
23071. **Subdomain-takeover check toggle** — verify dangling DNS records per hunt.
23072. **Secret-scanning scope** — choose which surfaces (repos, JS bundles, responses) get scanned for leaked keys.
23073. **Dependency CVE correlation** — match discovered JS libraries against vulnerability databases.
23074. **Screenshot cadence** — capture screenshots every step, on findings only, or never.
23075. **Exploit replay clips** — record short video replays of exploitation steps for critical findings.
23076. **Network log capture toggle** — save HAR files per finding for traffic-level evidence.
23077. **Request replay bundles** — export each finding as an importable Burp or curl replay file.
23078. **Hunt summary language** — generate the executive summary in the operator's chosen language.
23079. **Report template per hunt** — pick detailed-technical or executive report skeletons per hunt.
23080. **Compliance mapping per hunt** — attach frameworks (OWASP Top 10, PCI DSS) so findings auto-tag to controls.
23081. **SLA clock-start definition** — choose whether the SLA timer starts at detection or at triage acceptance.
23082. **Auto-remediation hints toggle** — include fix suggestions in findings or keep detection-only output.
23083. **False-positive learning toggle** — let the hunt feed the fpFilter learner or run in read-only mode.
23084. **Confidence threshold for reporting** — surface only findings above a chosen confidence score.
23085. **Duplicate-detection strictness** — fuzzy versus exact matching when merging duplicate findings.
23086. **Finding title style** — auto-generated technical titles versus plain-language titles per hunt.
23087. **Risk-score model choice** — pick CVSS-only or business-impact-weighted scoring per hunt.
23088. **Exploit-chain assembly toggle** — allow chaining findings into attack paths or report them atomically.
23089. **Chain max length** — cap attack-chain steps so PoCs stay readable.
23090. **Operator review checkpoints** — pause after recon for operator sign-off before exploitation begins.
23091. **Live hunt pause and resume** — freeze and resume the agent mid-run without losing state.
23092. **Mid-hunt scope-expansion requests** — the agent proposes newly discovered assets; the operator approves with one click.
23093. **Hunt A/B cloning** — run the same configuration with one variable changed to compare coverage.
23094. **Recurring hunt calendar scheduling** — calendar-style scheduling with recurrence for continuous monitoring.
23095. **Hunt blackout dates** — skip scheduled runs on releases, freezes, or specified dates.
23096. **Pre-hunt authorization checklist** — the operator confirms authorization and scope before the agent starts.
23097. **Authorization artifact attach** — upload the signed scope letter, linked inside every report.
23098. **Emergency stop button** — one-click global kill switch for all running hunts.
23099. **Hunt dry-run mode** — simulate the plan and estimated request count without sending traffic.
23100. **Pre-run cost estimator** — show projected compute and time cost before the hunt starts.
23101. **Shareable hunt-config link** — export a configuration as a link teammates can import.
23102. **Configuration version history** — every config change logged with diff and author for audits.
23103. **Hunt archiving rules** — auto-archive completed hunts after N days with export on demand.
23104. **Engagement-type presets** — one-click presets for pentest, bug-bounty, compliance-audit, and quick-triage setups.
23105. **Per-severity notification rules** — choose channel and urgency separately for critical, high, medium, and low findings.
23106. **Per-target mute** — silence all notifications for a noisy target while keeping alerts live for everything else.
23107. **Per-target mute with expiry** — mute a target for 24 hours or 7 days with auto-unmute and a catch-up summary of what was missed.
23108. **Digest mode selector** — pick instant, hourly, or daily delivery per notification rule.
23109. **Critical-always-instant override** — critical findings bypass digests and alert immediately regardless of mode.
23110. **Channel routing per rule** — route criticals to SMS, highs to Slack, and lows to email from a single rule screen.
23111. **Webhook routing per rule** — send finding events to custom webhooks with per-rule payload templates.
23112. **Quiet hours** — define do-not-disturb windows; alerts queue and arrive as a morning digest.
23113. **Weekend quiet mode** — suppress non-critical alerts on configured off-days.
23114. **Escalation chains** — if a critical goes unacknowledged for 15 minutes, escalate to a second contact, then a manager.
23115. **Acknowledgment requirement** — alerts stay "unacked" and re-notify until the operator confirms them.
23116. **Finding status-change alerts** — notify when a finding moves from open to fixed or verified.
23117. **Hunt lifecycle notifications** — start, phase complete, paused, finished, and failed events each independently toggleable.
23118. **Report-ready notification** — ping the operator when the PDF or markdown report finishes generating.
23119. **Mid-hunt question alerts** — when the agent asks the operator a question, notify on the fastest configured channel.
23120. **Scope-expansion approval alerts** — instant notification when the agent requests scope expansion.
23121. **Credential expiry warnings** — alert before saved test credentials expire.
23122. **Model download-complete alerts** — notify when a brain model finishes downloading.
23123. **Scheduled-hunt reminders** — notify 15 minutes before a scheduled hunt starts.
23124. **Scheduled-hunt failure alerts** — alert if a scheduled hunt fails to start.
23125. **Digest content customization** — choose which fields (title, severity, target, link) appear in digests.
23126. **Digest max items** — cap digest length, with overflow linking to the full list.
23127. **Smart digest grouping** — group digest items by target or severity instead of chronology.
23128. **Duplicate-finding suppression** — never re-notify for a finding already alerted in the last 7 days.
23129. **Status-change-only mode** — notify only when severity or status changes, not on every update.
23130. **Comment mention notifications** — instant alert on @mentions with the comment text quoted.
23131. **Assignment notifications** — notify when a finding is assigned to you, with accept and decline buttons.
23132. **SLA breach warnings** — alert at 50% and 90% of SLA remaining, then on breach.
23133. **Team-lead SLA escalation rule** — automatically escalate to the team lead when an SLA breaches.
23134. **Watchlist-target alerts** — instant alert for any finding on pinned or favorite targets.
23135. **Watchlist severity filter** — only alert watchlist findings above a chosen severity.
23136. **Teammate activity alerts** — optionally notify when a teammate starts a hunt on your watchlist target.
23137. **Leaderboard movement alerts** — weekly opt-in notification of rank changes.
23138. **Achievement unlocked alerts** — celebrate badges through the operator's chosen channel.
23139. **Milestone progress nudges** — opt-in pings like "2 more hunts to Gold tier".
23140. **Skill-match hunt alerts** — opt-in notification when a hunt matching your skills appears.
23141. **Mentorship request alerts** — alert senior researchers when a junior requests a hunt review.
23142. **Review-completed alerts** — notify the junior when their mentor finishes a review.
23143. **Team activity digest** — daily summary of team hunts, findings, and comments.
23144. **Manager rollup** — weekly executive digest with counts by severity, SLA health, and top targets.
23145. **Export completion alerts** — notify when a scheduled export or compliance report finishes.
23146. **Integration failure alerts** — alert when Slack, webhook, or email delivery fails, with retry status.
23147. **Notification health dashboard** — see delivery success rates per channel.
23148. **Test notification button** — send a sample alert per channel to verify routing works.
23149. **Channel fallback ordering** — if SMS fails, automatically fall back to push, then email.
23150. **Per-device do-not-disturb** — mute phone notifications while keeping desktop alerts active.
23151. **Calendar-aware quiet** — suppress non-critical alerts during calendar "focus" events.
23152. **Notification sound profiles** — distinct sounds per severity on desktop and mobile.
23153. **Desktop banner actions** — acknowledge, assign, or snooze directly from the notification banner.
23154. **Snooze a finding's alerts** — mute notifications for one finding for a chosen duration.
23155. **Snooze a rule** — temporarily disable a notification rule with automatic re-enable.
23156. **Per-phase notifications** — notify when the hunt enters exploitation or reporting phases.
23157. **Threshold alerts** — notify when open criticals exceed N or a target's finding count spikes.
23158. **Trend alerts** — alert when a target's new-finding rate doubles week over week.
23159. **Zero-finding hunt alerts** — notify when a hunt finishes with zero findings, flagging possible misconfiguration.
23160. **High false-positive-rate alerts** — warn when a hunt's FP rate exceeds the operator's threshold.
23161. **Agent-stuck alerts** — notify if the agent makes no progress for a configurable idle period.
23162. **Compute-credit low alerts** — warn when agent compute credits drop below a threshold.
23163. **Plan and tier alerts** — notify about tier changes, renewals, and usage caps.
23164. **Account security alerts** — login from a new device, password change, or API key creation.
23165. **API key expiry alerts** — warn before personal API tokens expire.
23166. **Shared-link access alerts** — notify when someone opens your shared hunt link.
23167. **Comment reply notifications** — alert when someone replies to your comment thread.
23168. **Triage-board change alerts** — optionally notify on bulk moves affecting your assigned findings.
23169. **Handoff-note alerts** — notify the receiver when a hunt handoff note is written for them.
23170. **Conflict-resolution alerts** — alert both researchers when a duplicate or ownership conflict is flagged.
23171. **Triage-vote notifications** — notify when a teammate requests a vote on a finding's severity.
23172. **Retest-due reminders** — remind the operator when a fixed finding's retest window approaches.
23173. **Fix-verified alerts** — notify the reporter when their finding is verified as fixed.
23174. **Bounty payout status alerts** — track and notify on payout submitted, approved, and paid via platform integrations.
23175. **Custom event webhooks** — define your own triggers (e.g. "finding tagged pci") for notifications.
23176. **Notification history log** — searchable archive of every alert sent, with delivery status.
23177. **Mark-all-read per rule** — clear notification backlog scoped to a single rule.
23178. **Noisy-rule consolidation suggestions** — see which rules fire most and get suggestions to consolidate noisy ones.
23179. **Smart quiet suggestions** — the system proposes muting rules you always ignore.
23180. **Per-severity digest cadence** — criticals instant, highs hourly, mediums daily, lows weekly in one preset.
23181. **Timezone-aware digests** — digests arrive at 8am in the operator's timezone.
23182. **Multi-timezone team digests** — manager rollups delivered at each recipient's local morning.
23183. **Alert language preference** — render alerts in the operator's chosen language.
23184. **Plain-text alert mode** — stripped-down alerts for low-bandwidth or screen-reader users.
23185. **Deep-linking alerts** — every alert opens the exact finding or hunt, not just the dashboard.
23186. **One-click rule unsubscribe** — stop a noisy rule from any alert in one tap.
23187. **Notification preview pane** — see exactly what an alert will look like before saving a rule.
23188. **Rule template gallery** — import community notification packs such as "on-call researcher".
23189. **Copy rule to teammate** — share a notification rule configuration with one click.
23190. **Audit log of rule changes** — record who changed which notification rule and when.
23191. **Emergency broadcast channel** — team-wide critical alerts that bypass all quiet settings.
23192. **Broadcast acknowledgment tracking** — see who has acknowledged an emergency broadcast.
23193. **Scheduled broadcasts** — queue a team announcement for a future time.
23194. **Notification API** — programmatic endpoint to inject custom alerts into your own notification stream.
23195. **Slack thread replies** — reply to a finding's Slack alert and have it posted as a comment.
23196. **Email reply-to-comment** — reply to a finding email to add a comment-thread entry.
23197. **SMS keyword actions** — reply ACK or ASSIGN to act on critical alerts by text message.
23198. **Push notification grouping** — collapse related alerts into expandable groups on mobile.
23199. **Badge counts for unacked criticals** — app icon badge reflects only unacknowledged criticals.
23200. **Critical bypass of silent mode** — optional OS-level override so on-call criticals always ring.
23201. **Notification fatigue score** — a personal metric of alert load with suggestions for digest tuning.
23202. **Weekly notification review** — auto-generated summary prompting the operator to prune noisy rules.
23203. **Location-based quiet** — auto-enable quiet hours when the phone is at a configured place (opt-in).
23204. **Per-hunt phase-complete pings** — optional per-hunt toggle for phase milestones without touching global rules.
23205. **Kanban triage board** — drag findings across New, Triaging, Accepted, Rejected, and Verified columns with per-column WIP limits.
23206. **50-finding bulk triage** — select 50 findings at once to accept, reject, or assign them in a single operation.
23207. **Triage macros** — one-click recorded sequences (e.g. accept + assign to me + tag "xss") applied to any selection.
23208. **SLA timers per finding** — visible countdown chips per severity tier with color shifts as deadlines approach.
23209. **Assignee routing rules** — auto-assign findings by type, target, or severity to the right researcher on creation.
23210. **Duplicate auto-merge suggestions** — the system proposes likely duplicates with a side-by-side diff for one-click merging.
23211. **Keyboard-first triage flow** — j/k navigation, a/r to accept/reject, and Enter to open, so a queue clears without touching the mouse.
23212. **Triage queue filters** — filter by severity, target, engine, confidence, and age, with savable filter presets.
23213. **Confidence-ranked queue** — sort the triage queue by model confidence so the clearest wins surface first.
23214. **Swimlane grouping** — group the board by target, severity, or assignee for at-a-glance workload views.
23215. **Slide-over evidence drawer** — slide-over panel showing evidence, PoC, and history without leaving the board.
23216. **Inline evidence preview** — screenshots and request/response pairs render inside the finding card.
23217. **Quick-reject reasons** — one-tap reject reasons (false positive, duplicate, out of scope, won't fix) with optional notes.
23218. **Reject reason analytics** — chart which rejection reasons dominate to tune engines and reduce noise.
23219. **Triage session mode** — fullscreen distraction-free queue with progress bar and session stats.
23220. **Triage session goals** — set "clear 30 findings" targets with a live counter and completion animation.
23221. **Undo triage action** — reverse the last accept/reject/assign with Ctrl+Z within a grace window.
23222. **Triage history per finding** — full audit trail of every triage decision with actor and timestamp.
23223. **Batch confidence review** — review all low-confidence findings in one pass with accept/reject/skip.
23224. **Similar-findings cluster view** — group near-identical findings across targets for batch decisions.
23225. **Cross-target duplicate detection** — flag the same vulnerability pattern recurring across different targets.
23226. **Merge with evidence union** — merging duplicates combines evidence from all copies into the surviving finding.
23227. **Split finding action** — split one finding into two when it actually covers two distinct issues.
23228. **Finding severity override** — operator-adjusted severity recorded separately from the engine's score, with reason.
23229. **Severity vote** — teammates vote on disputed severity; majority sets the value with a visible tally.
23230. **Triage checklist per severity** — criticals require evidence review, PoC replay, and scope check before acceptance.
23231. **Required fields on accept** — enforce assignee, severity confirmation, and remediation note before a finding can be accepted.
23232. **Auto-assign on accept** — accepting a finding auto-assigns it to you unless a routing rule says otherwise.
23233. **Round-robin auto-assignment** — distribute new findings evenly across the on-duty researcher pool.
23234. **Workload-balanced assignment** — assignment engine considers current open counts before routing new findings.
23235. **XSS-expertise assignment routing** — route XSS findings to researchers with XSS expertise from their skill profiles.
23236. **Assignment accept/decline** — assignees can decline with a reason, returning the finding to the pool.
23237. **Reassignment with context** — reassigning carries the full comment and triage history to the new owner.
23238. **Watch a finding** — follow findings you don't own to get updates on status changes.
23239. **Triage SLA policies** — define per-severity triage deadlines (e.g. criticals triaged within 4 hours).
23240. **SLA pause on weekends** — optionally exclude weekends and holidays from SLA clocks.
23241. **SLA breach queue** — dedicated view of breached and at-risk findings sorted by lateness.
23242. **Untouched-finding auto-reminders** — auto-remind assignees of findings untouched for N days.
23243. **Auto-escalate stale findings** — reassign or escalate findings idle beyond a threshold.
23244. **Triage velocity metrics** — per-researcher findings-per-hour and median time-to-triage dashboards.
23245. **Queue aging report** — show how long findings sit in each triage stage to spot bottlenecks.
23246. **First-touch time tracking** — measure time from detection to first human triage action.
23247. **Triage accuracy feedback** — track overturned decisions to coach and calibrate triage quality.
23248. **Calibration sessions** — periodic blind re-triage of sampled findings to measure inter-rater agreement.
23249. **Triage decision templates** — prewritten accept/reject rationales insertable with one keystroke.
23250. **Canned evidence requests** — one-click "need more evidence" requests sent back to the agent with specifics.
23251. **Request re-verification** — send a finding back to the agent for a fresh verification pass.
23252. **Finding discussion threads** — per-finding comment threads for triage deliberation.
23253. **Resolve thread on decision** — closing a finding auto-resolves its open discussion threads.
23254. **Triage polls** — quick accept/reject/severity polls for ambiguous findings.
23255. **Expert review requests** — route a finding to a domain expert for a second opinion.
23256. **Second-opinion SLA** — experts get their own deadline for review requests.
23257. **Triage leaderboard** — opt-in ranking by triage volume and accuracy for the week.
23258. **Finding tags** — freeform and controlled tags (e.g. "needs-retest", "client-visible") for slicing queues.
23259. **Tag-based triage views** — saved views like "all findings tagged pci awaiting verification".
23260. **Smart tag suggestions** — the system suggests tags based on finding type and history.
23261. **Tag governance** — controlled vocabularies with synonyms merged to keep tags clean.
23262. **Bulk tagging** — apply or remove tags across a multi-select in one action.
23263. **Finding relationships** — link findings as duplicates, related, or chained-attack-path.
23264. **Attack-path visualization** — graph view of chained findings showing the full compromise path.
23265. **Root-cause grouping** — group findings sharing a root cause (e.g. one misconfigured header) for single-fix tracking.
23266. **Fix-once tracking** — mark one root-cause fix as resolving all grouped findings after verification.
23267. **Retest workflow** — mark fixed, trigger agent retest, then verify with evidence comparison.
23268. **Retest evidence diff** — side-by-side before/after evidence for fix verification.
23269. **Partial-fix handling** — record partially fixed findings with remaining sub-issues tracked separately.
23270. **Won't-fix with expiry** — won't-fix decisions expire and re-surface for re-evaluation after N months.
23271. **Risk-acceptance approver workflow** — formal risk-acceptance with approver, expiry, and compensating controls recorded.
23272. **False-positive training** — one-click "teach the filter" sends rejected FPs to the fpFilter learner.
23273. **FP pattern dashboard** — show which engines and payload types produce the most false positives.
23274. **Engine trust scores** — per-engine precision metrics visible during triage to weight confidence.
23275. **Triage from email** — accept/reject/comment on findings directly from notification emails.
23276. **Triage from Slack** — interactive Slack messages with accept/reject/assign buttons.
23277. **Mobile triage swipe** — swipe right to accept, left to reject, up to skip on the companion app.
23278. **Voice-dictated triage notes** — dictate rejection reasons and notes on mobile.
23279. **Triage offline mode** — queue decisions offline on mobile; sync when reconnected.
23280. **Conflict-free offline sync** — offline triage decisions merge cleanly with server state on reconnect.
23281. **Triage assignment pools** — findings route to a team pool instead of individuals for pull-based triage.
23282. **Claim from pool** — researchers claim findings from the pool with one click.
23283. **Pool aging alerts** — notify leads when pool findings sit unclaimed past a threshold.
23284. **Priority inbox** — a personal queue ranking your findings by SLA urgency and severity.
23285. **Deep-triage focus mode** — hide everything except the current finding and its evidence for deep triage.
23286. **Compare with past decisions** — show how similar findings were triaged historically before you decide.
23287. **Decision confidence meter** — the UI shows historical agreement rates for the action you're about to take.
23288. **Triage shortcuts customizer** — remap every triage keyboard shortcut to personal preference.
23289. **Macro sharing** — publish useful triage macros to the team library.
23290. **Conditional macros** — macros with if/then branches (e.g. if severity is critical, also page on-call).
23291. **Scheduled bulk actions** — queue bulk triage operations to run at a set time.
23292. **Dry-run bulk actions** — preview exactly which findings a bulk action will affect before committing.
23293. **Bulk action audit log** — every bulk operation logged with actor, filter used, and affected IDs.
23294. **Triage API** — programmatic accept/reject/assign endpoints for custom automation.
23295. **Webhook on triage events** — fire webhooks when findings are accepted, rejected, or merged.
23296. **Jira-style status sync** — two-way sync of finding status with external trackers.
23297. **Export triage queue** — export filtered queues to CSV for client or auditor review.
23298. **Printable triage packets** — generate per-finding printable summaries for war-room reviews.
23299. **Triage war-room view** — shared big-screen mode showing queue health for team triage sessions.
23300. **Live cursors on board** — see teammates' cursors and selections on the shared kanban in real time.
23301. **Board presence avatars** — show who is currently viewing or triaging which column.
23302. **Triage handoff within board** — drag a finding onto a teammate's avatar to reassign instantly.
23303. **End-of-shift triage summary** — auto-generated recap of what you triaged, decided, and left pending.
23304. **Triage streaks** — opt-in daily streak counter for triage sessions to build review habits.
23305. **Inline comments on findings** — threaded comments anchored to specific evidence lines or screenshots within a finding.
23306. **@mentions in comments** — notify teammates instantly with the comment quoted and a deep link.
23307. **Lightweight comment emoji reactions** — emoji reactions on comments for lightweight agreement without noise.
23308. **Resolve comment threads** — mark discussion threads resolved, keeping a collapsible history.
23309. **Comment edit history** — edited comments show a diff and timestamp for auditability.
23310. **Private internal notes** — researcher-only notes on findings hidden from client-facing exports.
23311. **Shared hunt annotations** — pin notes to hunt timeline events (e.g. "WAF started blocking here") visible to the whole team.
23312. **Annotation on the attack path** — annotate nodes in the chained-attack graph with team observations.
23313. **Finding assignment with workload balancing** — assignment suggestions account for each researcher's current open load.
23314. **Assignment proposals** — propose an assignee; the proposal pends until they accept or decline.
23315. **Co-assignees** — attach multiple researchers to complex findings with a primary owner designated.
23316. **Team activity feed** — chronological feed of hunts started, findings triaged, comments, and merges across the team.
23317. **Activity feed filters** — filter the feed by teammate, target, project, or event type.
23318. **Follow teammates** — subscribe to specific researchers' public activity.
23319. **Hunt handoff notes** — structured shift-handoff template (status, blockers, next steps, watch items) attached to hunts.
23320. **Handoff acknowledgment** — the receiving researcher confirms they read the handoff note.
23321. **Scheduled handoff reminders** — prompt the outgoing researcher to write handoff notes before shift end.
23322. **Conflict detection** — flag when two researchers triage or edit the same finding simultaneously.
23323. **Conflict resolution view** — side-by-side of both researchers' decisions with a merge or pick-winner flow.
23324. **Finding ownership locks** — soft-lock a finding while someone is actively triaging it to prevent collisions.
23325. **Presence on findings** — show avatars of teammates currently viewing the same finding.
23326. **Live collaborative triage** — multiple researchers triage one queue together with live cursors and instant updates.
23327. **Shared triage sessions** — start a timed group triage room with a shared queue and voice-note support.
23328. **Team hunt workspaces** — shared spaces grouping hunts, findings, notes, and chat per engagement.
23329. **Workspace chat** — persistent per-workspace discussion channel separate from finding comments.
23330. **Pinned workspace messages** — pin key decisions and scope notes to the top of workspace chat.
23331. **Shared saved views** — publish personal dashboard views and filters for the whole team.
23332. **Team tag vocabularies** — shared controlled tag sets with definitions everyone follows.
23333. **Shared wordlists** — team wordlist library with versioning and per-hunt attachment.
23334. **Shared hunt templates** — team template gallery for common engagement types.
23335. **Shared notification rule packs** — import a teammate's proven rule set with one click.
23336. **Shared triage macros** — publish and install team triage macros from a library.
23337. **Peer review workflow** — request a teammate's review on a finding before marking it verified.
23338. **Review checklists** — structured review forms (evidence sufficient, severity correct, PoC replays).
23339. **Expertise-based reviewer routing** — auto-route review requests by expertise and availability.
23340. **Review turnaround SLA** — reviewers get deadlines with escalation on breach.
23341. **Review feedback loop** — review outcomes feed back into the original researcher's accuracy stats.
23342. **Pair-hunting mode** — two researchers co-pilot one hunt with shared control and split roles (driver/navigator).
23343. **Hunt shadowing** — juniors observe a senior's live hunt read-only with a Q&A side channel.
23344. **Comment-only collaborators** — invite external stakeholders who can comment but not triage.
23345. **Client view sharing** — share a sanitized, client-safe view of findings without internal notes.
23346. **Time-boxed guest access** — grant temporary finding access to auditors with automatic expiry.
23347. **Team roles and permissions** — admin, lead, researcher, reviewer, and viewer roles with granular scopes.
23348. **Per-workspace roles** — different permission levels per engagement workspace.
23349. **Severity-override approval workflow** — require lead approval for severity overrides and risk acceptances.
23350. **Delegation of approval** — leads can delegate approval authority during leave.
23351. **Team skill directory** — searchable directory of who knows what (XSS, cloud, mobile) for quick consults.
23352. **Ask-an-expert button** — route a question with finding context to the right expert in one click.
23353. **Office-hours scheduling** — experts publish availability slots for consults.
23354. **Knowledge base** — team wiki of playbooks, payload notes, and target-specific quirks.
23355. **Finding-to-playbook linking** — link findings to the playbook used, building a reference trail.
23356. **Per-hunt retro templates** — structured retro template (what worked, misses, FP causes) per completed hunt.
23357. **Retro action items** — assign follow-ups from retrospectives with owners and due dates.
23358. **Team performance dashboard** — aggregate triage velocity, accuracy, and SLA health across researchers.
23359. **Contribution graphs** — per-researcher activity heatmaps like a code-contribution calendar.
23360. **Kudos system** — give teammates recognition for great catches, visible on profiles.
23361. **Team goals** — shared quarterly targets (e.g. 50 verified criticals) with a progress bar.
23362. **Celebration feed** — team-wide feed of milestones, badges, and kudos.
23363. **Weekly critical-alert rotation** — schedule who handles critical alerts each week with automatic routing.
23364. **On-call handoff checklist** — structured checklist for rotating on-call duty.
23365. **Escalation policy editor** — visual builder for who gets paged, in what order, after how long.
23366. **Incident bridges** — one-click call bridge for critical-findings war rooms.
23367. **Shared hunt calendar** — team calendar of scheduled hunts, blackouts, and on-call shifts.
23368. **Workload heatmap** — see each researcher's open findings and upcoming hunts at a glance.
23369. **Capacity planning view** — forecast triage load against researcher availability for the sprint.
23370. **Vacation coverage rules** — auto-reassign a researcher's queue to their backup during time off.
23371. **Team digest customization** — leads configure what goes into the daily team digest.
23372. **Cross-team finding sharing** — share sanitized findings with partner teams with one click.
23373. **Finding referral** — refer a finding to another team with full context preserved.
23374. **Duplicate across teams** — detect when two teams report the same underlying issue.
23375. **Federated search** — search findings, comments, and notes across all workspaces you can access.
23376. **Global @mention directory** — mention anyone in the org with autocomplete and presence status.
23377. **Status messages** — set a personal status (focusing, in triage, OOO) visible to the team.
23378. **Do-not-disturb for individuals** — respect a teammate's DND when assigning or mentioning.
23379. **Comment drafts** — autosaved comment drafts per finding so thoughts aren't lost.
23380. **Scheduled comments** — queue a comment to post at a future time (e.g. after a client meeting).
23381. **Triage comment snippet library** — team-approved snippet library for common triage communications.
23382. **Translation of comments** — one-click translation of teammate comments into your language.
23383. **Voice notes in comments** — attach short audio notes to findings for nuanced explanations.
23384. **Screen-share links in handoffs** — attach recorded walkthroughs to handoff notes.
23385. **Triage decision rationale log** — team-visible log of key triage and scope decisions with rationale.
23386. **Change notifications for shared items** — notify followers when shared views, templates, or macros change.
23387. **Version history for shared artifacts** — diffs and rollback for shared templates and wordlists.
23388. **Fork shared templates** — customize a team template privately without affecting the original.
23389. **Team API tokens** — scoped tokens for team-level integrations and automation.
23390. **Audit trail for collaboration** — immutable log of who viewed, edited, or exported shared findings.
23391. **Data-access requests** — formal flow for requesting access to restricted workspaces.
23392. **Emergency restricted-finding access** — emergency temporary access to restricted findings with full logging.
23393. **Team invite links** — role-scoped invite links with expiry for onboarding.
23394. **Onboarding checklist for teams** — new researchers get a guided tour: triage sim, macro install, buddy assign.
23395. **Buddy assignment** — every new researcher gets a named buddy for the first month.
23396. **Team announcement banner** — dismissible banner for important team-wide notices.
23397. **Polls for team decisions** — quick polls on severity standards or process changes.
23398. **Meeting-notes integration** — attach meeting notes to workspaces with action-item extraction.
23399. **Shared hunt replay** — replay a completed hunt's timeline together for training.
23400. **Team retrospective analytics** — aggregate retro themes across hunts to spot systemic issues.
23401. **Collaboration streaks** — recognize pairs who co-triage or co-hunt frequently.
23402. **Cross-training matcher** — suggest researchers swap hunt types to broaden team coverage.
23403. **Skill-gap team view** — aggregate team skills to reveal coverage gaps for hiring or training.
23404. **Team charter page** — shared page stating triage SLAs, severity definitions, and communication norms.
23405. **Researcher skill profiles** — structured profiles listing expertise areas (XSS, SSRF, cloud, mobile) with self-ratings and evidence links.
23406. **Skill endorsements** — teammates endorse skills, adding credibility weight to profile claims.
23407. **Skill verification challenges** — short practical challenges that verify claimed skills with a passing badge.
23408. **Auto-suggested hunts by skill** — the system recommends open hunts matching your strongest skills.
23409. **Hunt-skill match score** — every hunt shows a 0–100 match score against your profile before you claim it.
23410. **Difficulty ratings on hunts** — hunts labeled beginner, intermediate, advanced, or expert based on target complexity.
23411. **Difficulty calibration** — difficulty ratings adjust based on actual researcher performance data over time.
23412. **Stretch-hunt recommendations** — suggest hunts slightly above your level to promote growth.
23413. **Comfort-zone alerts** — gentle nudge when you've only taken same-difficulty hunts for a month.
23414. **Skill-gap recommendations** — analyze your profile against in-demand hunt types and suggest what to learn next.
23415. **Learning paths** — curated sequences (web basics → auth → SSRF) that build toward advanced hunt types.
23416. **Learning path progress** — track completed steps, linked hunts, and verification challenges per path.
23417. **Mentorship pairing** — match juniors with seniors for guided hunt reviews based on complementary skills.
23418. **Mentor availability calendar** — seniors publish office hours juniors can book for reviews.
23419. **Guided first hunts** — a junior's first three hunts include senior checkpoints at each phase.
23420. **Shadow senior hunts** — juniors observe live senior hunts read-only with a Q&A channel.
23421. **Reverse shadowing** — seniors observe junior hunts and intervene only at defined checkpoints.
23422. **Mentorship milestones** — track mentee progress (first solo critical, first zero-FP hunt) for both parties.
23423. **Mentor recognition** — mentors earn badges and kudos visible on team leaderboards.
23424. **Skill-based triage routing** — findings route to researchers whose profiles match the vulnerability class.
23425. **Reviewer matching** — review requests auto-route to available experts in that finding's category.
23426. **Expert-on-demand queue** — juniors submit questions; the right expert is paged by skill match.
23427. **Skill decay indicators** — flag skills unused for 6+ months and suggest refresher hunts.
23428. **Skill refresh challenges** — short re-verification tasks to keep stale skills current.
23429. **Cross-training suggestions** — recommend hunt types outside your specialty to broaden coverage.
23430. **Team skill coverage map** — heatmap of team skills versus hunt-type demand revealing gaps.
23431. **Hiring-signal reports** — aggregate uncovered skill gaps into a hiring or training brief for leads.
23432. **Hunt claiming with prerequisites** — advanced hunts require verified prerequisite skills before claiming.
23433. **Probationary hunt access** — new researchers get supervised access to advanced hunts first.
23434. **Skill-based hunt caps** — limit concurrent advanced hunts per researcher to protect quality.
23435. **Performance by skill area** — break down your accuracy and velocity per vulnerability class.
23436. **Weakest-skill spotlight** — monthly report highlighting your lowest-performing area with practice hunts.
23437. **Practice hunt sandbox** — safe, synthetic targets for drilling specific skills without production risk.
23438. **Timed practice drills** — speed drills (e.g. triage 10 XSS findings in 15 minutes) with scoring.
23439. **Drill leaderboards** — opt-in rankings for practice drills separate from real hunts.
23440. **Certification tracks** — internal certifications (Web Fundamentals, API Security) earned via challenges and hunts.
23441. **Certification expiry and renewal** — certs expire after a year; renewal requires a refresher challenge.
23442. **Public skill badges** — verified skills display as badges on your researcher profile.
23443. **Profile portfolio** — showcase best findings, certifications, and mentorship given on one page.
23444. **Peer skill reviews** — periodic 360-style skill feedback from collaborators.
23445. **Skill history timeline** — see how your skills and ratings evolved over time.
23446. **Hunt debrief skill notes** — after each hunt, note which skills you used or learned for profile updates.
23447. **Auto skill inference** — the system suggests profile updates based on your hunt history and finding types.
23448. **Skill inference approval** — suggested profile changes pend until you accept them.
23449. **Language-skill tagging** — tag skills with relevant languages or frameworks (e.g. "SSRF in Node.js").
23450. **Tool proficiency tracking** — record proficiency with tools (Burp, custom scripts) alongside vulnerability skills.
23451. **Preferred hunt-type settings** — set favorite vulnerability classes to bias recommendations.
23452. **Disliked hunt-type mute** — mute hunt types you don't want recommended.
23453. **Hunt queue personalization** — your open-hunt list sorts by skill match, difficulty fit, and preference.
23454. **New-hunt alerts by skill** — notify when a hunt matching your top skills becomes available.
23455. **Team skill leaderboard** — opt-in ranking of verified skill counts across the team.
23456. **Skill diversity score** — personal metric rewarding breadth across vulnerability classes.
23457. **Specialist vs generalist tracks** — choose a growth track; recommendations and challenges adapt accordingly.
23458. **Track switching** — change tracks anytime with a transition plan preserving earned progress.
23459. **Manager skill-planning view** — leads see team skills, gaps, and growth trajectories for planning.
23460. **Succession coverage alerts** — warn when only one researcher holds a critical skill.
23461. **Knowledge-transfer tasks** — structured tasks for experts to document rare skills before they become single points of failure.
23462. **Skill-share session scheduler** — researchers propose and schedule short skill-share sessions.
23463. **Session recordings library** — archive internal training sessions, searchable by topic.
23464. **Playbook authorship credit** — authors of team playbooks get profile credit and kudos.
23465. **Playbook quality ratings** — team rates playbooks; top-rated ones surface in recommendations.
23466. **Hunt-type mastery levels** — bronze/silver/gold mastery per vulnerability class based on verified findings.
23467. **Mastery progress bars** — visible progress toward the next mastery level per class.
23468. **Mastery decay** — mastery levels soften without recent verified findings, encouraging practice.
23469. **Rival skill challenges** — friendly head-to-head practice duels on synthetic targets (opt-in).
23470. **Team vs team hunt events** — scheduled competitive hunts between squads with scoring.
23471. **Skill-based team formation** — auto-suggest balanced squads for team events by complementary skills.
23472. **Event handicap system** — difficulty adjustments keep mixed-skill team events competitive.
23473. **Post-event skill reports** — events generate per-participant skill observations for profiles.
23474. **External certification import** — link OSCE, GWAPT, or similar certs to your profile with verification.
23475. **Conference talk credit** — record talks and publications on your profile as expertise evidence.
23476. **CVE publication tracking** — link CVEs you've authored to your profile automatically.
23477. **Bug-bounty platform sync** — import verified findings from external platforms into your skill evidence.
23478. **Skill-based report assignment** — report-writing tasks route to researchers with strong writing ratings.
23479. **Writing-skill coaching** — targeted feedback on report clarity with before/after examples.
23480. **Client-facing readiness levels** — track who's cleared for client calls and presentations.
23481. **Presentation practice mode** — rehearse finding walkthroughs with AI-generated tough questions.
23482. **Interview-question bank** — skill-tagged practice questions for career growth.
23483. **Career ladder mapping** — show which skills and milestones lead to senior/principal researcher roles.
23484. **Promotion readiness checklist** — transparent checklist of skill and impact requirements per level.
23485. **Goal-linked skill plans** — tie learning goals to your user goal tracker with milestones.
23486. **Weekly skill digest** — personalized email of recommended hunts, drills, and sessions for your gaps.
23487. **Skill streak rewards** — maintain weekly practice streaks for bonus XP.
23488. **Learning buddy matching** — pair researchers studying the same skill for mutual accountability.
23489. **Study group formation** — form small groups around a learning path with shared drills.
23490. **Group drill scheduling** — coordinate practice sessions across timezones automatically.
23491. **Skill swap marketplace** — offer to teach a skill in exchange for learning another.
23492. **Office-hours Q&A archive** — searchable archive of past expert Q&A sessions.
23493. **Ask-me-anything sessions** — scheduled AMAs with senior researchers, recorded for later.
23494. **New-hire skill baselining** — assess incoming researchers' skills in week one to personalize onboarding.
23495. **30-60-90 skill plans** — structured ramp plans with skill milestones for new hires.
23496. **Buddy skill check-ins** — buddies review mentee skill progress at 30/60/90 days.
23497. **Exit skill documentation** — departing researchers record rare skills in structured handover docs.
23498. **Alumni expert network** — keep departed experts reachable for consults (opt-in).
23499. **Skill taxonomy governance** — curated, versioned skill taxonomy so profiles stay comparable.
23500. **Skill synonym merging** — merge duplicate skill labels (e.g. "XSSI" vs "XSS") automatically.
23501. **Emerging-skill detection** — detect new vulnerability classes from hunt data and propose taxonomy additions.
23502. **Skill demand forecasting** — predict which skills the hunt pipeline will need next quarter.
23503. **Training budget tracking** — log courses and certs against personal training budgets.
23504. **Skill ROI dashboard** — correlate training investments with finding quality improvements.
23505. **First-critical badge** — award a badge the first time a researcher verifies a critical-severity finding.
23506. **Ten-hunts badge** — recognize researchers completing their first 10 hunts.
23507. **Zero-FP streak badge** — reward 25 consecutive accepted findings with no false positives.
23508. **Speed-demon badge** — for triaging 50 findings in a single day with 95%+ accuracy.
23509. **Night-owl hunts** — playful badge for hunts run during quiet hours (opt-in humor).
23510. **Bug-chain architect badge** — for assembling a 4+ step verified attack chain.
23511. **Secret-hunter badge** — for 10 verified leaked-secret findings.
23512. **Auth-breaker badge** — for verified authentication-bypass findings across 3 targets.
23513. **Report wordsmith badge** — for reports rated excellent by reviewers 5 times.
23514. **Mentor badge** — for completing 5 mentorship pairings with positive mentee feedback.
23515. **Onboarding buddy badge** — for guiding a new researcher through their first month.
23516. **XP for hunts** — earn experience points per completed hunt, scaled by difficulty.
23517. **XP for verified findings** — bonus XP weighted by severity of verified findings.
23518. **XP for triage** — smaller XP for triage decisions, rewarding the unglamorous work.
23519. **XP for reviews** — XP for completing peer reviews to encourage quality culture.
23520. **Researcher levels** — XP thresholds map to levels (Scout → Hunter → Elite → Legend).
23521. **Level-up celebrations** — animated overlay and team feed post when someone levels up.
23522. **Level perks** — higher levels unlock cosmetic perks like profile frames and custom themes.
23523. **Seasonal challenges** — quarterly themed challenges (e.g. "SSRF September") with special badges.
23524. **Season leaderboards** — per-season rankings reset quarterly so newcomers can compete.
23525. **Season rewards** — top seasonal performers choose profile cosmetics or charity donations.
23526. **Leaderboard divisions by experience** — separate boards for rookie, pro, and veteran tiers.
23527. **Division promotion** — top rookies get promoted to pro division each season with fanfare.
23528. **All-time hall of fame** — permanent record of legendary achievements across seasons.
23529. **Milestone celebrations** — confetti-style overlays for 100 verified findings, 1-year anniversary, and similar.
23530. **Shareable achievement cards** — generate beautiful image cards of badges for social sharing.
23531. **Achievement card templates** — multiple visual styles for shareable cards.
23532. **Private achievements mode** — hide badges and levels from others for privacy-minded researchers.
23533. **Team achievements** — collective badges (e.g. "1000 verified findings as a team").
23534. **Squad challenges** — small groups compete on shared goals like fastest full-triage week.
23535. **Daily quests** — small daily goals (triage 5, review 1) with streak tracking.
23536. **Weekly quests** — bigger weekly goals with escalating rewards.
23537. **Quest reroll** — swap an unappealing daily quest once per day.
23538. **Streak freezes** — one forgiven missed day per month to protect streaks.
23539. **Comeback quests** — tailored re-engagement goals after a period of inactivity.
23540. **First-hunt completion badge** — celebrate finishing the very first hunt.
23541. **First-mentored-hunt badge** — for juniors completing their first senior-reviewed hunt.
23542. **Polyglot badge** — verified findings across 5 different technology stacks.
23543. **Cloud-surgeon badge** — for cloud-misconfiguration findings across 3 providers.
23544. **Mobile-maestro badge** — for mobile-app findings (API and client-side).
23545. **API-ace badge** — 25 verified API vulnerabilities.
23546. **Recon-ranger badge** — for exceptional recon contributions reused across hunts.
23547. **PoC-perfectionist badge** — 10 PoCs replayed successfully by reviewers without changes.
23548. **Doc-diver badge** — for contributing 5 playbooks to the team knowledge base.
23549. **Calibration-champion badge** — top inter-rater agreement in quarterly calibration sessions.
23550. **SLA-guardian badge** — a full quarter with zero SLA breaches on owned findings.
23551. **Inbox-zero badge** — clear your entire triage queue in one session.
23552. **Comeback-kid badge** — return from a 30+ day break and verify a finding within a week.
23553. **Early-adopter badge** — for trying new engines or features within a week of release.
23554. **Bug-reporter badge** — for filing quality product bug reports that get fixed.
23555. **Community-helper badge** — for answering teammate questions in the expert queue.
23556. **Retro-regular badge** — attend 8 retrospectives in a season.
23557. **Handoff-hero badge** — consistently rated excellent handoff notes by receivers.
23558. **Conflict-resolver badge** — for amicably resolving triage conflicts.
23559. **Accessibility-advocate badge** — for contributions improving product accessibility.
23560. **Security-champion badge** — for account-security best practices (MFA, key rotation).
23561. **Four-tier badge rarity visuals** — common, rare, epic, and legendary tiers with distinct visuals.
23562. **Badge progress tracking** — see "7/10 secrets found" progress toward each badge.
23563. **Hidden secret badges** — surprise badges for delightful behaviors, revealed on unlock.
23564. **Badge showcase slots** — pin your 3 proudest badges to your profile header.
23565. **Animated badge art** — subtle animations on epic and legendary badges.
23566. **Badge sound effects** — optional celebratory sounds on unlock (mutable).
23567. **Achievement timeline** — chronological visual timeline of everything you've earned.
23568. **Year-in-review recap** — annual personalized summary of hunts, findings, badges, and growth.
23569. **Recap share cards** — shareable year-in-review graphics.
23570. **Peer-nominated awards** — quarterly awards (best mentor, sharpest triage) voted by the team.
23571. **Award ceremony feed** — team feed celebration when peer awards are announced.
23572. **Trophy case view** — 3D-style gallery view of all earned badges and awards.
23573. **Badge comparison** — compare badge collections with a teammate (opt-in).
23574. **Achievement search** — search all possible badges and see unlock requirements.
23575. **Roadmap to next badge** — "you're 2 verified XSS away from Webslinger" guidance.
23576. **Anti-grind safeguards** — XP diminishing returns on repetitive low-value actions to prevent gaming.
23577. **Quality-weighted XP** — XP scales with reviewer ratings, not just volume.
23578. **XP audit log** — transparent history of every XP gain with its source.
23579. **XP dispute flow** — contest missing XP with evidence; resolved by leads.
23580. **Leaderboard opt-out** — compete privately without appearing on public boards.
23581. **Anonymous leaderboard mode** — boards show pseudonyms for privacy.
23582. **Team-vs-team seasons** — squads compete for collective trophies each quarter.
23583. **Rivalry matchups** — opt-in head-to-head weekly challenges between matched researchers.
23584. **Handicapped rivalries** — scoring adjusts for experience gaps to keep matchups fair.
23585. **Tournament brackets** — single-elimination triage-speed tournaments on synthetic queues.
23586. **Tournament replays** — watch top tournament runs to learn techniques.
23587. **Prediction leagues** — predict hunt outcomes (finding counts) for fun points.
23588. **Fantasy hunt league** — draft researchers onto fantasy teams scored by real verified findings (opt-in).
23589. **Achievement API** — pull badges and XP into external profiles or dashboards.
23590. **LinkedIn badge export** — one-click export of certifications and major badges to LinkedIn.
23591. **Resume generator** — build a researcher resume from verified achievements and stats.
23592. **Reference letters** — leads can issue verified reference letters citing platform achievements.
23593. **Milestone emails** — celebratory emails for big milestones, forwardable to managers.
23594. **Manager visibility controls** — choose which achievements managers see in rollups.
23595. **Kids-mode-safe sharing** — shareable cards with no sensitive target details for public posts.
23596. **Redacted share cards** — auto-redact target names on public achievement cards.
23597. **Charity bounties** — convert achievement points into charitable donations each season.
23598. **Swag unlocks** — legendary achievements unlock real-world swag requests.
23599. **Anniversary rewards** — yearly platform-anniversary recognition with exclusive badge art.
23600. **Founder badges** — permanent badges for researchers active in the platform's first year.
23601. **Beta-tester badges** — for researchers who tested pre-release features.
23602. **Localization hero badges** — for translating UI strings or docs into new languages.
23603. **Accessibility tester badges** — for filing verified accessibility issues.
23604. **Hidden midnight-triage achievements** — hidden fun achievements (e.g. triage at exactly midnight) for delight.
23605. **Drag-drop widget layout** — rearrange dashboard widgets freely with snap-to-grid and resize handles.
23606. **Widget library** — 30+ widgets (open criticals, SLA health, hunt timeline, XP progress) addable to any dashboard.
23607. **Saved dashboard views** — save named layouts (e.g. "Monday triage", "Exec review") and switch instantly.
23608. **Per-role dashboard defaults** — hunters, managers, and execs each get a tailored starting layout.
23609. **Favorite targets pinning** — pin targets to a dashboard widget for one-click access and live finding counts.
23610. **Custom date ranges** — any widget can use custom ranges (last 14 days, this quarter) not just presets.
23611. **Dashboard templates gallery** — install community dashboard layouts with one click.
23612. **Publish dashboard templates** — share your layout to the gallery with a preview screenshot.
23613. **Widget-level filters** — each widget has independent filters (severity, target, assignee).
23614. **Cross-widget filtering** — click a target in one widget to filter all linked widgets.
23615. **Drill-down from widgets** — click any chart segment to open the underlying findings list.
23616. **Widget refresh controls** — per-widget auto-refresh intervals or manual refresh.
23617. **Dashboard auto-refresh** — whole-dashboard live mode for war-room displays.
23618. **TV/kiosk dashboard mode** — fullscreen, high-contrast, auto-rotating views for team screens.
23619. **Dashboard rotation playlists** — cycle through multiple dashboards on a schedule for displays.
23620. **Personal KPI cards** — configurable cards for your key metrics (verified this month, triage accuracy).
23621. **Goal progress widgets** — widgets bound to user goals showing live progress bars.
23622. **SLA health widget** — at-risk and breached counts with trend arrows.
23623. **Queue aging widget** — histogram of finding age in your queues.
23624. **Triage velocity widget** — your findings-per-hour trend over selectable periods.
23625. **Hunt timeline widget** — Gantt-style view of your active and scheduled hunts.
23626. **Severity distribution donut** — interactive donut of open findings by severity.
23627. **Target risk heatmap** — matrix of targets versus severity for portfolio views.
23628. **Engine precision widget** — per-engine true-positive rates from your triage history.
23629. **FP trend widget** — false-positive rate over time to spot engine regressions.
23630. **Workload forecast widget** — predicted triage load for the next 7 days from hunt schedules.
23631. **Capacity widget** — your available hours versus assigned workload.
23632. **Team comparison widget** — opt-in anonymized benchmark of your metrics versus team medians.
23633. **Achievement progress widget** — badges in progress with completion bars.
23634. **XP and level widget** — current level, XP to next, and recent gains.
23635. **Streak widget** — daily quest and triage streaks with freeze indicators.
23636. **Mentorship widget** — mentee progress and upcoming review sessions.
23637. **Review queue widget** — findings awaiting your expert review with their SLAs.
23638. **Handoff inbox widget** — handoff notes addressed to you, with acknowledgment buttons.
23639. **Announcement widget** — team announcements and broadcast history.
23640. **Learning recommendations widget** — suggested drills and hunts for your skill gaps.
23641. **Calendar widget** — scheduled hunts, on-call shifts, and review deadlines in one view.
23642. **Recent activity widget** — your latest actions across hunts and findings.
23643. **Comment mentions widget** — unread @mentions with quick-reply.
23644. **Watchlist widget** — live finding counts and latest items for pinned targets.
23645. **Hunt health widget** — agent progress, phase, and stuck warnings for running hunts.
23646. **Notification summary widget** — unread counts by rule with quick links.
23647. **Export widget** — one-click exports of your common reports.
23648. **Quick-action widget** — customizable buttons (start hunt, new triage session, log finding).
23649. **Notes widget** — personal scratchpad synced across devices.
23650. **Links widget** — personal bookmark list for targets, docs, and tools.
23651. **Weather-of-security widget** — playful daily "threat weather" summary for your watchlist.
23652. **Quote-of-the-day widget** — security-community quotes (dismissible).
23653. **Multi-dashboard tabs** — organize dashboards into tabs (Triage, Hunts, Growth, Team).
23654. **Dashboard sharing** — share a read-only dashboard link with managers or clients.
23655. **Shared team dashboards** — team-maintained dashboards everyone sees by default.
23656. **Dashboard permissions** — control who can view or edit shared dashboards.
23657. **Dashboard layout restore history** — restore previous layouts after accidental changes.
23658. **Duplicate dashboard** — clone any dashboard to experiment safely.
23659. **Dashboard import/export** — JSON export/import of layouts for backup or sharing.
23660. **Responsive dashboard grid** — layouts adapt gracefully from ultrawide to tablet.
23661. **Mobile dashboard companion** — condensed widget versions optimized for phones.
23662. **Widget density settings** — comfortable, compact, or spacious spacing per dashboard.
23663. **Dark-mode-aware widgets** — all widgets respect theme and high-contrast settings.
23664. **Widget color coding** — consistent severity colors across every widget.
23665. **Custom widget titles** — rename widgets to match your mental model.
23666. **Widget descriptions** — hover tooltips explaining what each widget measures.
23667. **Empty-state guidance** — helpful empty states suggesting what to add when a widget has no data.
23668. **Widget error states** — graceful fallbacks with retry when a widget's data fails.
23669. **Dashboard performance mode** — defer heavy widgets for faster loads on slow machines.
23670. **Scheduled dashboard snapshots** — email yourself a PDF snapshot of a dashboard daily or weekly.
23671. **Snapshot annotations** — add commentary to snapshots before sending.
23672. **Dashboard alerts** — get notified when a widget metric crosses a threshold (e.g. open criticals > 10).
23673. **Anomaly highlighting** — widgets flag unusual spikes or drops automatically.
23674. **Compare periods** — overlay this week versus last week on trend widgets.
23675. **Year-over-year view** — long-range comparisons for manager dashboards.
23676. **Cohort analysis widget** — compare finding metrics across target groups or teams.
23677. **Funnel widget** — visualize detected → triaged → accepted → verified conversion.
23678. **Bottleneck detector** — highlight the funnel stage losing the most findings.
23679. **Spend-per-verified-finding widget** — compute spend divided by verified findings for budget views.
23680. **Bounty ROI widget** — payouts versus effort for platform-synced bounty work.
23681. **Time-to-verify widget** — median detection-to-verified duration trends.
23682. **Reopen-rate widget** — track findings reopened after being marked fixed.
23683. **Client-facing dashboard mode** — sanitized widgets safe to show clients, hiding internal notes.
23684. **Presentation mode** — fullscreen widget slideshow with speaker notes for reviews.
23685. **Dashboard search** — find any widget, view, or metric by keyword.
23686. **Recently viewed** — quick access to recently opened dashboards and views.
23687. **Favorites bar** — pin favorite dashboards to a top bar.
23688. **Default landing dashboard** — choose which dashboard opens on login.
23689. **Role-switch preview** — preview how your dashboard looks for hunter, manager, and exec roles.
23690. **Guided dashboard tour** — interactive tour highlighting each widget for new users.
23691. **Dashboard tips** — contextual suggestions ("add the SLA widget — you have 3 at-risk findings").
23692. **Usage analytics** — see which widgets you actually use; get prompts to remove dead ones.
23693. **A/B dashboard testing** — try two layouts for a week and compare your triage speed.
23694. **Accessibility widget checks** — dashboard builder warns about low-contrast or tiny-text widgets.
23695. **Keyboard-navigable widgets** — tab through widgets and operate them without a mouse.
23696. **Screen-reader widget summaries** — each widget exposes a text summary for assistive tech.
23697. **Reduced-motion dashboards** — disable widget animations when reduced motion is set.
23698. **Print-friendly dashboards** — clean print stylesheets for dashboard snapshots.
23699. **Dashboard API** — embed widget data in external tools via API.
23700. **Webhook widget** — custom widget rendering data from your own webhook endpoint.
23701. **SQL widget (advanced)** — write custom queries against your finding data for bespoke widgets.
23702. **Widget marketplace** — install community-built widgets with ratings and reviews.
23703. **Widget sandboxing** — third-party widgets run isolated with explicit data permissions.
23704. **Dashboard onboarding checklist** — new users get a guided setup: pick role, add 3 widgets, save view.
23705. **Full keyboard navigation** — every page, dialog, and menu reachable and operable without a mouse.
23706. **Command palette (Ctrl+K)** — fuzzy-search actions, hunts, findings, and settings from one overlay.
23707. **Palette command history** — recently used commands surface first in the palette.
23708. **Palette natural-language** — type "start hunt on example.com" and the palette parses it into an action.
23709. **Vim mode for log viewer** — hjkl navigation, / search, and visual selection in hunt logs.
23710. **Vim keybindings option** — optional vim-style bindings (j/k, gg/G) across list views.
23711. **Emacs keybindings option** — alternative emacs-style bindings for text fields and navigation.
23712. **Shortcut cheat-sheet overlay** — press ? anywhere to see all shortcuts for the current view.
23713. **Contextual cheat sheets** — the overlay shows only shortcuts relevant to the focused panel.
23714. **Macro recording** — record keystroke and click sequences, save as named macros, replay with one shortcut.
23715. **Macro editor** — view and edit recorded macro steps, adjusting delays and parameters.
23716. **Macro library** — save, name, and organize macros with search.
23717. **Shared macro packs** — install team macro packs for common triage flows.
23718. **Bulk selection shortcuts** — Shift+click ranges, Ctrl+click toggles, Ctrl+A selects filtered results.
23719. **Select-all-filtered** — Ctrl+Shift+A selects everything matching current filters, not just the visible page.
23720. **Invert selection** — one shortcut flips the current multi-selection.
23721. **Keyboard multi-cursor triage** — spacebar toggles selection while arrow keys move, for rapid batch building.
23722. **Quick-find in page (/)** — slash focuses a universal search scoped to the current view.
23723. **Go-to shortcuts (g then key)** — g+h hunts, g+f findings, g+d dashboard, g+s settings sequences.
23724. **Recent items (Ctrl+E)** — quick-switch between recently viewed hunts and findings.
23725. **Breadcrumb keyboard nav** — Alt+arrows move through navigation history.
23726. **Focus-mode toggle (F)** — fullscreen the current finding or log panel.
23727. **Zen triage mode** — hides all chrome except the queue and current finding, toggled by shortcut.
23728. **Split-pane shortcuts** — open findings side-by-side with keyboard-driven pane management.
23729. **Pane focus cycling** — Ctrl+Tab cycles focus between panes; Ctrl+W closes the active pane.
23730. **Quick preview (Space)** — spacebar previews the selected finding without opening it.
23731. **Open in new tab (Ctrl+Enter)** — open findings or hunts in background tabs.
23732. **Tab management shortcuts** — Ctrl+1..9 jump to tabs, Ctrl+Shift+T reopens closed ones.
23733. **Copy finding link (Ctrl+L)** — copy a deep link to the current finding instantly.
23734. **Copy evidence as markdown** — one shortcut copies the finding summary as formatted markdown.
23735. **Copy PoC curl** — copy the finding's replay curl command with one keystroke.
23736. **Paste-to-create finding** — paste a URL or finding JSON anywhere to start manual finding creation.
23737. **Quick-add note (N)** — append a note to the current finding without opening the comments panel.
23738. **Quick-tag (T)** — tag the current finding from a fuzzy tag picker.
23739. **Quick-assign (A)** — assign via fuzzy researcher picker.
23740. **Quick-severity (S)** — change severity from a keyboard picker.
23741. **Quick-status transitions** — 1..5 keys move findings through triage pipeline stages.
23742. **Undo/redo for triage (Ctrl+Z/Y)** — reverse and reapply triage decisions.
23743. **Repeat last action (.)** — vim-style dot repeats the last triage action on the next finding.
23744. **Batch repeat** — apply the last action to all selected findings.
23745. **Filter-as-you-type** — typing in list views incrementally filters without a search box.
23746. **Saved filter shortcuts** — Ctrl+1..5 apply your saved filter presets in list views.
23747. **Clear filters (Esc)** — escape clears active filters and search.
23748. **Column sorting shortcuts** — Alt+click or keyboard toggles sort on any column.
23749. **Column chooser shortcut** — quickly show/hide table columns from the keyboard.
23750. **Density toggle (D)** — switch comfortable/compact row density.
23751. **Expand-all/collapse-all** — one shortcut expands or collapses grouped findings.
23752. **Jump to next un-triaged (])** — skip directly to the next finding needing triage.
23753. **Jump to next critical ([)** — jump between critical findings.
23754. **Mark reviewed (M)** — mark findings reviewed without changing their status.
23755. **Snooze shortcut (Z)** — snooze the current finding's alerts for a preset duration.
23756. **Escalate shortcut (E)** — escalate the current finding per the escalation chain.
23757. **Request review (R)** — send the current finding for peer review.
23758. **Start retest (V)** — trigger agent retest on the current finding.
23759. **Merge suggestions shortcut** — open the duplicate-merge view for the current finding.
23760. **Split finding shortcut** — split the current finding from the keyboard.
23761. **Link findings shortcut** — link the current finding to another via fuzzy search.
23762. **Add to attack path (P)** — attach the finding to an attack-path graph.
23763. **Export finding (X)** — export the current finding to PDF or markdown.
23764. **Print shortcut** — print-friendly finding view via Ctrl+P override.
23765. **Hunt control shortcuts** — pause (Space), resume, and stop running hunts from the keyboard.
23766. **Phase skip approval** — approve or deny agent phase-gate requests via keyboard.
23767. **Scope expansion approve/deny** — Y/N keys on scope-expansion requests.
23768. **Mid-hunt chat shortcuts** — Ctrl+Enter sends, Esc minimizes the agent chat panel.
23769. **Chat history search** — search past mid-hunt conversations by keyword.
23770. **Quick replies in chat** — number-key shortcuts for suggested agent replies.
23771. **Terminal shortcuts in hunt view** — Ctrl+` focuses the live terminal, with command history.
23772. **Terminal command snippets** — saved snippet library insertable into the hunt terminal.
23773. **Log filter shortcuts** — F toggles follow-mode, L clears, / searches in log streams.
23774. **Log level toggles** — number keys toggle debug/info/warn/error visibility.
23775. **Bookmark log lines (B)** — bookmark interesting log lines for later review.
23776. **Share log excerpt** — copy a selected log range as a shareable snippet.
23777. **Settings search shortcut** — Ctrl+, opens settings with search focused.
23778. **Theme toggle shortcut** — Ctrl+Shift+L cycles dark/light themes.
23779. **Font size shortcuts** — Ctrl+plus/minus scales UI text.
23780. **High-contrast toggle** — one shortcut switches to high-contrast mode.
23781. **Reduced-motion toggle** — quick toggle for motion-sensitive users.
23782. **Screen-reader mode toggle** — enable enhanced announcements with one shortcut.
23783. **Shortcut conflict detector** — warn when a custom binding clashes with an existing one.
23784. **Custom shortcut editor** — remap any action to any key combination, with profiles.
23785. **Shortcut profiles** — save named binding sets (e.g. "vim-user", "default") and switch between them.
23786. **Import/export shortcut profiles** — share binding profiles as JSON.
23787. **Mouse-gesture support** — optional right-drag gestures for back, close tab, and refresh.
23788. **Touch-bar support** — macOS touch-bar shows contextual triage actions.
23789. **Gamepad navigation (experimental)** — navigate triage queues with a controller for accessibility.
23790. **Voice-command shortcuts** — "next", "accept", "reject" voice commands for hands-free triage.
23791. **Sticky keys support** — full compatibility with OS sticky-keys for modifier-heavy shortcuts.
23792. **Shortcut usage analytics** — see your most-used shortcuts and discover faster alternatives.
23793. **Shortcut coach marks** — subtle hints surface unused shortcuts for actions you do with the mouse.
23794. **Power-user score** — opt-in metric of keyboard versus mouse usage with improvement tips.
23795. **Onboarding shortcut tutorial** — interactive 5-minute tutorial teaching core shortcuts.
23796. **Shortcut of the day** — daily tip highlighting one useful shortcut.
23797. **CLI companion** — terminal CLI mirroring UI actions (list findings, accept, assign) for automation.
23798. **CLI autocomplete** — rich shell completions for the companion CLI.
23799. **API playground** — in-app console to try API calls with your own data.
23800. **Bulk import via paste** — paste CSV rows to bulk-create manual findings or targets.
23801. **Spreadsheet-style editing** — edit finding fields inline in table views with keyboard flow.
23802. **Fill-down in tables** — drag or shortcut to fill a value down a column of selected rows.
23803. **Quick calculations** — select numeric columns to see sums and averages in the status bar.
23804. **Power-search syntax** — Gmail-style operators (severity:critical target:example.com age:<7d) in every search box.
23805. **Dark theme** — a true-dark OLED-friendly theme with carefully tuned contrast ratios.
23806. **Light theme** — a clean light theme with soft surfaces for bright environments.
23807. **High-contrast theme** — WCAG AAA-oriented theme maximizing text and control contrast.
23808. **Auto theme by time** — switch between light and dark automatically on a schedule.
23809. **Auto theme by OS** — follow the operating system's dark/light preference.
23810. **UI-wide accent color picker** — pick any accent color applied consistently to buttons, links, and highlights.
23811. **Accent per workspace** — different accent colors per engagement for instant visual context.
23812. **Severity color customization** — remap severity colors to personal or org conventions.
23813. **Deuteranopia-protanopia-tritanopia palettes** — built-in palettes verified for deuteranopia, protanopia, and tritanopia.
23814. **Colorblind simulation preview** — preview the UI as seen with each color-vision deficiency.
23815. **Never color-only** — severity always pairs color with icon and text label, never color alone.
23816. **Pattern fills for charts** — charts offer patterned fills as a non-color differentiator.
23817. **Font-size controls** — global UI text scaling from 80% to 200%.
23818. **Per-panel font sizing** — logs and evidence viewers get independent font-size controls.
23819. **Font family choice** — select from curated UI fonts including system and readable options.
23820. **Dyslexic-font reading mode** — OpenDyslexic-style font, increased spacing, and ragged-right text.
23821. **Line-height controls** — adjustable line spacing for reading comfort.
23822. **Letter-spacing controls** — adjustable tracking for low-vision readers.
23823. **Focus indicators** — highly visible keyboard focus rings on all interactive elements.
23824. **Focus-visible customization** — adjust focus-ring thickness and color.
23825. **Skip-to-content links** — keyboard users jump straight to main content, nav, or search.
23826. **Landmark regions** — proper header, nav, main, and complementary landmarks throughout.
23827. **Screen-reader optimizations** — meaningful ARIA labels, roles, and live regions on dynamic content.
23828. **Screen-reader announcements** — polite announcements for hunt phase changes, new findings, and triage actions.
23829. **Assertive alerts for criticals** — critical findings use assertive live regions so they're never missed.
23830. **Data-table semantics** — real table markup with headers and captions for finding lists.
23831. **Chart text alternatives** — every chart ships with a data table and textual summary.
23832. **Image alt text** — evidence screenshots get auto-generated descriptive alt text, editable by the operator.
23833. **Animation-free UI mode** — disables animations, parallax, and auto-playing effects.
23834. **Motion sensitivity levels** — off, reduced, and full motion granularity beyond a binary toggle.
23835. **No auto-playing media** — videos and animations never auto-play; always user-initiated.
23836. **Prefers-reduced-motion respect** — the OS setting is honored automatically on first load.
23837. **Seizure-safe mode** — eliminates flashing and rapid transitions above safe thresholds.
23838. **Calm notification style** — non-urgent alerts use gentle, non-flashing indicators.
23839. **Text scaling without breakage** — layouts reflow correctly at 200% browser zoom.
23840. **Minimum touch targets** — all interactive elements meet 44px minimum touch size.
23841. **Touch-target spacing** — adequate spacing between adjacent controls on touch devices.
23842. **Hover-independent actions** — no action requires hover; everything works with tap or keyboard.
23843. **Sticky header controls** — key actions stay reachable when scrolling long finding lists.
23844. **Readable link text** — links use descriptive text, never "click here".
23845. **Form label association** — every input has a programmatic label; errors link to fields.
23846. **Inline validation messages** — form errors appear next to fields with clear correction guidance.
23847. **Error summary boxes** — forms show a summary of errors with jump links to each field.
23848. **Timeout warnings** — warn before sessions expire with a chance to extend.
23849. **Undo for destructive actions** — deletions and bulk rejects offer undo, not just confirmation.
23850. **Confirmation customization** — choose which destructive actions require confirmation.
23851. **Jargon-free UI copy mode** — simplify jargon-heavy UI copy for junior researchers.
23852. **Glossary tooltips** — hover any security term for a plain-language definition.
23853. **Reading-level indicator** — reports show estimated reading level for client audiences.
23854. **Interface language selection** — full UI localization in major languages.
23855. **RTL layout support** — mirrored layouts for right-to-left languages.
23856. **Date/time format localization** — dates, times, and numbers follow locale conventions.
23857. **Timezone display options** — show times in UTC, local, or target timezone.
23858. **Currency localization** — bounty amounts render in the operator's currency.
23859. **Keyboard-only onboarding** — the new-user tour is fully completable without a mouse.
23860. **WCAG target-level statement page** — public statement of WCAG target level and known issues.
23861. **Accessibility feedback channel** — dedicated route for reporting accessibility barriers.
23862. **Accessibility audit log** — record of audits performed and issues fixed per release.
23863. **Contrast checker tool** — in-app checker validating custom colors against WCAG ratios.
23864. **Theme builder** — visual editor to create and share custom themes.
23865. **Theme marketplace** — install community themes with previews and ratings.
23866. **Per-user theme sync** — themes follow you across devices.
23867. **Scheduled theme rotation** — rotate favorite themes on a schedule for variety.
23868. **Seasonal themes** — opt-in festive theme variants.
23869. **Focus-timer theme dimming** — UI dims non-essential chrome during focus sessions.
23870. **Night-shift warm tint** — reduce blue light with a warm overlay after hours.
23871. **Grayscale mode** — full grayscale rendering for distraction reduction.
23872. **Inverted-grayscale option** — light-on-dark grayscale variant.
23873. **Transparency reduction** — replace translucent surfaces with solid colors for clarity.
23874. **Animation speed control** — slow down or speed up UI animations globally.
23875. **Transition style choice** — fade, slide, or instant transitions.
23876. **Sound effects toggle** — UI sounds on/off with per-event volume.
23877. **Screen-reader verbosity** — concise versus verbose announcement styles.
23878. **Haptic feedback (mobile)** — subtle vibrations confirming triage actions on phones.
23879. **Voice control support** — navigate core flows with OS voice control.
23880. **Switch-device support** — operable with single-switch scanning interfaces.
23881. **Eye-tracking compatibility** — large targets and dwell-click support for eye-gaze users.
23882. **Cognitive-load mode** — decluttered UI showing one task at a time for neurodivergent users.
23883. **ADHD-friendly focus mode** — hide badges, streaks, and feeds that encourage distraction.
23884. **Anxiety-aware wording** — non-alarming copy for SLA warnings ("due in 2h" not "BREACH IMMINENT").
23885. **Customizable dashboard density** — reduce information density per dashboard for calmer views.
23886. **Reading ruler** — on-screen reading guide line following the cursor in long reports.
23887. **Text-to-speech for findings** — listen to finding summaries with adjustable speed.
23888. **Speech-to-text for notes** — dictate comments and triage notes.
23889. **Captioned video replays** — exploit replay clips include captions and transcripts.
23890. **Audio descriptions for charts** — spoken summaries of chart data on demand.
23891. **Refreshable-braille linear output** — clean linear text output for refreshable braille displays.
23892. **Keyboard shortcut remapping for motor needs** — single-key alternatives to chord-heavy shortcuts.
23893. **Dwell-click support** — activate controls by hovering for a configurable duration.
23894. **Large-cursor option** — extra-large, high-visibility cursor choices.
23895. **Cursor trails off by default** — no decorative cursor effects that hinder tracking.
23896. **Scroll behavior controls** — smooth versus instant scrolling preference.
23897. **Auto-scroll pause on hover** — live logs pause scrolling when hovered for reading.
23898. **Sticky column headers** — table headers stay visible in long finding lists.
23899. **Frozen first column** — keep finding titles visible while scrolling wide tables.
23900. **Wrap versus truncate** — choose text wrapping or truncation in table cells.
23901. **Compact evidence viewer** — low-vision-friendly evidence layout with large controls.
23902. **Magnifier-friendly layout** — UI remains usable at high OS magnifier zoom levels.
23903. **Accessibility quick-settings panel** — one panel for font size, contrast, motion, and spacing.
23904. **Accessibility profile presets** — one-click presets (low vision, motor, cognitive) configuring multiple settings.
23905. **Hunt start from phone** — configure and launch a full hunt from the mobile app with the same options as desktop.
23906. **Finding review swipe UI** — Tinder-style swipe triage: right to accept, left to reject, up to skip.
23907. **Swipe action customization** — remap swipe directions to your preferred triage actions.
23908. **Photo-of-whiteboard to hunt notes** — snap a whiteboard photo; OCR converts it into hunt notes.
23909. **Whiteboard photo enhancement** — auto-crop, de-skew, and contrast-boost whiteboard captures.
23910. **Offline finding drafts** — write findings offline on the go; they sync when reconnected.
23911. **Offline triage queue** — triage a cached queue without connectivity; decisions sync later.
23912. **Mobile offline decision merge** — offline decisions merge cleanly with server state on reconnect.
23913. **Biometric login** — Face ID, fingerprint, or passkeys for instant secure sign-in.
23914. **Watchlist widgets** — iOS/Android home-screen widgets showing watchlist finding counts.
23915. **Critical-alert widget** — home-screen widget with unacknowledged critical count and one-tap ack.
23916. **Hunt progress widget** — live hunt phase and progress bar on the home screen.
23917. **Home-screen streak widget** — daily quest streak visible without opening the app.
23918. **Push notification actions** — accept, reject, assign, and snooze directly from push notifications.
23919. **Rich push notifications** — finding pushes include severity, target, and evidence thumbnail.
23920. **Critical push bypass** — optional critical alerts that break through Do Not Disturb (opt-in).
23921. **Notification grouping** — related pushes collapse into expandable stacks.
23922. **Quiet hours sync** — mobile respects the same quiet-hours schedule as desktop.
23923. **Mobile triage inbox** — dedicated priority inbox optimized for one-handed triage.
23924. **One-handed mode** — bottom-anchored controls and reachable action zones.
23925. **Large-text mobile mode** — extra-large type option for the mobile app.
23926. **Voice-dictated notes** — dictate finding notes and comments with on-device transcription.
23927. **Voice-command triage** — "next", "accept", "reject" hands-free triage commands.
23928. **Photo evidence attach** — attach phone photos (e.g. of a physical device screen) to findings.
23929. **Screenshot markup** — annotate evidence screenshots with arrows and highlights on-device.
23930. **Screen recording for PoCs** — record short PoC demos from the phone for mobile-target findings.
23931. **QR-code hunt sharing** — share a hunt link as a QR code for quick handoff in person.
23932. **QR login to desktop** — scan a QR code on the desktop app to sign in instantly and securely.
23933. **Handoff to desktop** — push your current mobile view to the desktop app with one tap.
23934. **Continue on phone** — pick up exactly where you left off when switching from desktop to mobile.
23935. **Mobile dashboard** — condensed widget dashboard with the metrics you chose on desktop.
23936. **Mobile command palette** — same Ctrl+K-style fuzzy action search adapted for touch.
23937. **Hunt timeline on mobile** — scrollable hunt event timeline with phase markers.
23938. **Agent chat on mobile** — full mid-hunt chat with the agent, including voice input.
23939. **Approve gates on mobile** — approve phase gates and scope expansions from push notifications.
23940. **Emergency stop on mobile** — big, unmissable kill-switch for running hunts.
23941. **SLA countdown widget** — per-finding SLA timers visible in the mobile finding view.
23942. **Escalate from mobile** — trigger escalation chains with one tap.
23943. **On-call schedule view** — see who's on call and swap shifts from the phone.
23944. **Team activity feed mobile** — condensed team feed optimized for small screens.
23945. **Comment and @mention on mobile** — full threaded comments with mention autocomplete.
23946. **In-notification assignment actions** — accept or decline assigned findings from the notification itself.
23947. **Workload view mobile** — see your open findings and upcoming hunts at a glance.
23948. **Phone-calendar hunt sync** — hunts and SLA deadlines sync to the phone calendar.
23949. **Siri/Google shortcuts** — "triage my queue" voice shortcuts launching key flows.
23950. **Apple Watch app** — critical alerts, ack, and SLA timers on the wrist.
23951. **Wear OS app** — same critical-alert triage actions for Android watches.
23952. **Watch complications** — unacked-critical count on the watch face.
23953. **Smartwatch quick-ack** — acknowledge criticals from the watch without the phone.
23954. **Tablet-optimized layout** — two-pane triage layout taking advantage of tablet screens.
23955. **Landscape triage mode** — side-by-side finding list and evidence in landscape.
23956. **External keyboard support** — full keyboard shortcuts work with iPad and Android keyboards.
23957. **Mouse/trackpad support** — proper pointer interactions on tablets.
23958. **Split-screen multitasking** — run the app alongside a browser or notes app.
23959. **Drag-and-drop on tablet** — drag findings between kanban columns with touch.
23960. **Offline mode indicator** — clear banner showing offline state and queued action count.
23961. **Offline map of actions** — review everything queued offline before it syncs.
23962. **Selective sync** — choose which workspaces sync offline to save storage.
23963. **Storage management** — see and clear cached evidence, logs, and offline queues.
23964. **Low-data mode** — compress images and skip auto-playing media on metered connections.
23965. **Wi-Fi-only sync** — defer large evidence downloads until on Wi-Fi.
23966. **Background sync** — findings and notifications sync quietly in the background.
23967. **Background hunt monitoring** — get phase-complete updates without keeping the app open.
23968. **Battery-saver mode** — reduce polling frequency and animations to save battery.
23969. **Dark mode follows system** — mobile theme matches OS appearance automatically.
23970. **Dynamic type support** — respect OS text-size settings on iOS and Android.
23971. **Screen-reader mobile support** — full VoiceOver and TalkBack compatibility.
23972. **Haptic confirmations** — subtle vibrations confirming accept/reject/assign actions.
23973. **Shake to undo** — shake the phone to undo the last triage action.
23974. **App icon badges** — badge counts reflect unacked criticals only, configurable.
23975. **App shortcuts (long-press)** — home-screen shortcuts to start hunt, open queue, view criticals.
23976. **Widgets deep-link** — tapping any widget opens the exact relevant screen.
23977. **Secure app lock** — require biometrics after 5 minutes of inactivity.
23978. **Screenshot prevention option** — block screenshots in sensitive finding views (opt-in).
23979. **Remote wipe for MDM** — enterprise remote-wipe support for managed devices.
23980. **Certificate pinning** — pinned API certificates protect mobile traffic from interception.
23981. **Jailbreak/root detection** — warn or restrict on compromised devices per org policy.
23982. **Mobile audit log** — every mobile action logged with device identifiers.
23983. **Device management** — see and revoke signed-in mobile devices from desktop settings.
23984. **Beta mobile builds** — opt into TestFlight/Play beta channels for early features.
23985. **In-app feedback** — shake-to-report bugs with screenshot and logs attached.
23986. **Feature voting on mobile** — vote on upcoming mobile features from the app.
23987. **Onboarding tour mobile** — 60-second interactive tour of swipe triage and key flows.
23988. **Gesture tutorial** — interactive guide teaching swipe and long-press gestures.
23989. **Accessibility settings mobile** — font size, contrast, motion, and haptics in one panel.
23990. **Reduce-motion mobile** — honor OS reduced-motion in all app animations.
23991. **High-contrast mobile theme** — dedicated high-contrast theme for outdoor visibility.
23992. **One-tap report export** — generate and share finding PDFs from the phone.
23993. **Share sheet integration** — send findings to Slack, email, or files via the OS share sheet.
23994. **Print from mobile** — AirPrint/Google-print triage packets directly.
23995. **NFC hunt tags** — tap NFC tags in the office to open specific hunts or targets.
23996. **Location-based hunt suggestions** — suggest relevant site hunts when on-site at a client (opt-in).
23997. **Travel mode** — one-tap lockdown: stricter auth, no offline caching of sensitive evidence.
23998. **Data-usage dashboard** — see how much data the app uses, per feature.
23999. **Roaming guard** — pause background sync automatically while roaming.
24000. **Cross-device clipboard** — copy a PoC curl on desktop, paste it on mobile.
24001. **Universal links** — finding links open directly in the app instead of the browser.
24002. **App clips / instant app** — lightweight instant triage for shared finding links without full install.
24003. **Mobile release notes** — in-app changelog with "what's new" highlights per update.
24004. **Mobile accessibility audit badge** — public commitment badge showing the app's WCAG target level.
