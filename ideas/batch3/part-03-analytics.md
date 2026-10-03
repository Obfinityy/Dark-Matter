# Batch 3 — Part 03: Hunt Analytics & Metrics (22005–23004)

## 1. Coverage dashboards (22005–22104)

22005. **Endpoint coverage donut** — a live donut chart showing the percentage of discovered endpoints that received at least one security probe, so hunters instantly see how much of the target was actually exercised.
22006. **Parameter coverage grid** — a per-endpoint table listing every discovered parameter with a tested/untested badge, making it obvious which inputs never got fuzzed.
22007. **Auth-state coverage matrix** — a matrix of endpoints versus guest, authenticated, and admin sessions showing which auth states were probed on each route to expose privilege-testing gaps.
22008. **JavaScript route coverage map** — extraction of client-side SPA routes from bundled JS with a covered/not-covered flag per route so hidden frontend views are not missed.
22009. **API version coverage comparison** — side-by-side coverage bars for v1, v2, v3 (and unversioned) APIs so older, often-neglected versions get equal scrutiny.
22010. **Crawler depth visualization** — an interactive tree showing how many URLs were found at each crawl depth, revealing whether the crawler stalled before reaching deep pages.
22011. **Unprobed-URL risk prioritizer** — an automatic highlight of discovered-but-never-probed URLs ranked by estimated risk, giving the agent a prioritized re-attack queue.
22012. **HTTP method coverage table** — per-route checklist of GET, POST, PUT, PATCH, DELETE, and OPTIONS with tested flags, catching method-tampering gaps.
22013. **Coverage growth timeline** — a time-series line chart of coverage percentage over the hunt duration so users watch the attack surface get consumed in real time.
22014. **Per-domain coverage breakdown** — coverage percentages split across every in-scope domain and subdomain to prevent one forgotten subdomain from hiding risk.
22015. **Subdomain coverage completeness score** — a single 0–100 score per subdomain combining endpoint, parameter, and auth coverage for quick triage.
22016. **Robots/sitemap route audit** — comparison of routes listed in robots.txt and sitemap.xml against actually-tested routes, flagging crawler-ignored entries.
22017. **Coverage delta vs previous hunt** — a diff view showing which endpoints gained or lost coverage since the last hunt on the same target.
22018. **Orphan page coverage flag** — identification of pages unreachable from site navigation (orphans) with their coverage status, since orphans often hide legacy risk.
22019. **WebSocket endpoint coverage tracker** — a dedicated panel listing discovered ws/wss endpoints and which message types were fuzzed on each.
22020. **GraphQL query/mutation coverage map** — schema-driven listing of every query, mutation, and subscription with tested flags so no resolver goes unprobed.
22021. **REST vs GraphQL coverage split** — a stacked bar comparing coverage across API styles to balance effort between them.
22022. **Static asset exclusion audit** — a transparent log of which static files the crawler skipped and the rule that skipped them, proving nothing was dropped silently.
22023. **Form coverage meter** — the percentage of discovered HTML forms that were submitted with attack payloads, with per-form drill-down.
22024. **File-upload endpoint coverage** — a checklist of upload handlers showing which file types and polyglot payloads were attempted per endpoint.
22025. **Coverage by content type** — coverage split across JSON, XML, multipart, and form-encoded endpoints so format-specific weaknesses are not under-tested.
22026. **Authenticated vs unauthenticated route coverage** — dual bars showing coverage with and without session tokens to expose auth-bypass testing gaps.
22027. **Coverage confidence score** — a per-endpoint 0–100 score based on probe diversity (methods, payloads, auth states) rather than a binary tested flag.
22028. **Coverage CSV export** — one-click export of the full endpoint/parameter coverage table for auditors and client evidence packs.
22029. **Coverage heatmap over site map** — a visual site map where node color intensity reflects coverage depth, making cold spots jump out.
22030. **Parameter location coverage** — breakdown of tested parameters by location (query, path, header, cookie, body) to catch header/cookie blind spots.
22031. **Required vs optional parameter coverage** — separate tracking of required and optional fields so optional-but-dangerous inputs are not skipped.
22032. **Error-page coverage check** — verification that 404/500 handlers and custom error pages were probed, since error paths leak stack traces.
22033. **Mobile route coverage view** — coverage computed from a mobile user-agent crawl to catch mobile-only routes and responsive endpoints.
22034. **Coverage by tech-stack component** — grouping endpoints by detected framework or service (e.g., all /api/* on Express) with per-group coverage bars.
22035. **Third-party integration coverage** — tracking of webhook receivers, OAuth callbacks, and payment-gateway return URLs with tested flags.
22036. **Coverage SLA gate** — a configurable rule (e.g., 90% endpoint coverage) that blocks hunt completion until met, enforcing a minimum bar.
22037. **Coverage blocker list** — an explicit list of endpoints that could not be reached with the reason (WAF block, auth wall, timeout) for honest reporting.
22038. **Live coverage ticker** — a real-time counter during the hunt showing endpoints tested in the last minute and total remaining.
22039. **Historical coverage trend per target** — a chart of coverage percentage across all past hunts on the same target to show progress over time.
22040. **Coverage by HTTP status class** — split of tested endpoints by 2xx/3xx/4xx/5xx responses to ensure error paths got attention.
22041. **JSON schema field coverage** — for JSON APIs, per-field tested flags derived from request schemas so nested fields are not missed.
22042. **Environment coverage comparison** — staging versus production coverage side by side to catch staging-only or prod-only exposure.
22043. **Admin panel route coverage** — dedicated tracking of /admin, /dashboard, and internal-tool routes with auth-state flags.
22044. **Deprecated API version flagging** — deprecated versions get their own coverage lane so sunset-but-live endpoints are visibly tracked.
22045. **URL vs body parameter coverage split** — separate meters for query-string and request-body parameter testing to balance GET/POST effort.
22046. **Pagination parameter coverage** — explicit flags for page/limit/offset/sort params, which are classic injection points.
22047. **Search endpoint fuzzing flag** — marks whether free-text search inputs received payload fuzzing, a top XSS/SQLi surface.
22048. **Multi-tenant route coverage** — tracking of tenant-scoped paths (e.g., /org/:id) with cross-tenant probe flags.
22049. **Export/download endpoint coverage** — checklist of CSV/PDF/data-export handlers with tested flags for IDOR and injection.
22050. **Notification trigger coverage** — tracking of endpoints that fire emails, SMS, or webhooks with abuse-testing flags.
22051. **Session-state coverage matrix** — per-endpoint flags for valid session, expired token, and no-token probes to verify auth enforcement.
22052. **Rate-limited endpoint marking** — endpoints where the agent hit rate limits are marked so coverage gaps from throttling are visible, not hidden.
22053. **CDN vs origin coverage split** — flags showing whether each route was tested through the CDN and directly at origin.
22054. **Locale route coverage** — coverage of internationalized URL variants (/en/, /hi/, ?lang=) since they often duplicate vulnerable code.
22055. **Embedded widget coverage** — tracking of iframes and embedded third-party widgets with tested flags.
22056. **API docs vs reality diff** — comparison of Swagger/OpenAPI-documented endpoints against actually discovered ones, flagging shadow endpoints.
22057. **Feature-flag route coverage** — tracking of dark-launch and feature-flagged routes discovered via JS or headers.
22058. **Redirect chain coverage** — verification that full redirect chains were followed and each hop was probed.
22059. **Error-triggering input coverage** — per-endpoint flag showing whether malformed inputs were sent to trigger error-handling paths.
22060. **Coverage completeness badge** — a hunt-level badge (Bronze/Silver/Gold) based on weighted coverage thresholds for quick quality signaling.
22061. **RBAC role coverage matrix** — endpoints versus every discovered user role (viewer, editor, owner) with tested flags for privilege checks.
22062. **Batch/bulk endpoint coverage** — explicit tracking of bulk-action endpoints, which multiply the impact of IDOR flaws.
22063. **Long-polling/SSE endpoint coverage** — tested flags for server-sent-events and long-poll endpoints with message-injection checks.
22064. **File-download content validation** — flags showing whether download endpoints were tested for path traversal and content-type spoofing.
22065. **Password-reset flow coverage** — step-by-step coverage of reset flows (request, token, reset) with per-step probe flags.
22066. **Checkout/payment flow coverage** — staged coverage of cart, payment, and confirmation steps with tampering-test flags.
22067. **Comment/review endpoint coverage** — tested flags for user-content submission points, prime stored-XSS territory.
22068. **Profile/settings endpoint coverage** — tracking of account-settings routes with mass-assignment probe flags.
22069. **Invitation/signup flow coverage** — per-step coverage of invite and registration flows with token-reuse flags.
22070. **API key management coverage** — tracking of key create/revoke/rotate endpoints with privilege-test flags.
22071. **Two-factor endpoint coverage** — tested flags for 2FA setup, verify, and backup-code endpoints.
22072. **SSO/OAuth flow coverage** — step-level coverage of social-login and SAML flows with token-validation flags.
22073. **GDPR endpoint coverage** — tracking of data-export and account-deletion endpoints with auth and IDOR flags.
22074. **Contact/support form coverage** — tested flags for contact forms with header-injection and stored-XSS checks.
22075. **Newsletter/subscription coverage** — tracking of subscribe/unsubscribe endpoints with token-guessing flags.
22076. **Coupon/discount endpoint coverage** — tested flags for promo-code handlers with logic-abuse probe flags.
22077. **Referral endpoint coverage** — tracking of referral-code flows with self-referral abuse flags.
22078. **Leaderboard/ranking coverage** — tested flags for score-submission endpoints with tampering flags.
22079. **Booking/scheduling coverage** — tracking of reservation endpoints with double-booking and IDOR flags.
22080. **Messaging/chat endpoint coverage** — tested flags for direct-message and chat APIs with stored-XSS and IDOR checks.
22081. **Video/streaming endpoint coverage** — tracking of media endpoints with signed-URL bypass flags.
22082. **Location/geofence coverage** — tested flags for geo endpoints with spoofing and enumeration checks.
22083. **Push-notification registration coverage** — tracking of device-token endpoints with spoofing flags.
22084. **Telemetry endpoint marking** — analytics/tracking endpoints marked informational with a tested flag so they are acknowledged, not ignored.
22085. **Health-check endpoint coverage** — tested flags for /health and /status endpoints with info-disclosure checks.
22086. **Exposed debug endpoint coverage** — tracking of publicly reachable debug/admin endpoints with critical-priority flags.
22087. **Backup/archive endpoint coverage** — tested flags for backup download routes with auth and traversal checks.
22088. **Import/CSV endpoint coverage** — tracking of file-import handlers with formula-injection and parsing flags.
22089. **Template endpoint coverage** — tested flags for template-render routes with SSTI probe flags.
22090. **Preview/draft endpoint coverage** — tracking of unpublished-content preview URLs with auth-bypass flags.
22091. **Cron-trigger endpoint coverage** — tested flags for scheduled-job trigger URLs with unauthenticated-access checks.
22092. **Feature-toggle endpoint coverage** — tracking of toggle-management APIs with privilege flags.
22093. **A/B experiment endpoint coverage** — tested flags for experiment-assignment endpoints with manipulation checks.
22094. **Legacy redirect coverage** — tracking of old-path redirects with open-redirect probe flags.
22095. **Wildcard route coverage** — tested flags for catch-all routes with parameter-pollution checks.
22096. **CORS preflight coverage** — per-endpoint flags showing whether OPTIONS preflight behavior was analyzed.
22097. **OPTIONS method response audit** — logging of Allow headers per endpoint to map the real method surface.
22098. **HEAD request coverage** — flags showing whether HEAD responses were compared against GET for info leaks.
22099. **TRACE/TRACK method check** — per-host flags for dangerous-method probing with XST risk notes.
22100. **Business-critical flow tagging** — lets users tag flows (login, pay, signup) so coverage is reported separately for what matters most.
22101. **PII-handling endpoint flagging** — endpoints handling personal data get a PII badge and deeper-probe coverage targets.
22102. **Overall hunt coverage score** — a single weighted 0–100 score blending endpoint, parameter, method, and auth coverage for the whole hunt.
22103. **Coverage drill-down explorer** — clicking any coverage bar opens the exact list of untested endpoints with one-click re-queue.
22104. **Coverage JSON API** — a documented endpoint exposing live coverage data so external SIEMs and dashboards can consume it.

## 2. Finding velocity (22105–22204)

22105. **Findings-per-hour velocity chart** — a live line chart plotting confirmed findings per hour so users can see exactly when the hunt was most productive.
22106. **Time-to-first-finding card** — a KPI card showing minutes from hunt start to the first confirmed finding, benchmarking agent warm-up speed per target.
22107. **Velocity by vulnerability class** — a stacked bar chart of findings-per-hour split by XSS, SQLi, IDOR, and others to reveal which classes the agent finds fastest.
22108. **Velocity by tech stack** — comparison of findings-per-hour across detected frameworks (e.g., WordPress vs Laravel) to show where the agent is most effective.
22109. **Acceleration/deceleration alerts** — automatic notifications when finding velocity drops 50% below the hunt's rolling average, signaling a stalled strategy.
22110. **Estimated time-to-completion** — a live ETA computed from remaining coverage and current velocity so users know when the hunt will finish.
22111. **Velocity heatmap by hunt phase** — recon, scanning, exploitation, and verification phases each get a velocity score to show which phase yields most.
22112. **Cumulative findings curve** — an S-curve chart of total findings over time with the inflection point marked where discovery peaked.
22113. **Findings velocity leaderboard** — ranking of all hunts by findings-per-hour so users can identify their most productive targets and strategies.
22114. **Time-to-first-critical metric** — separate tracking of minutes until the first high/critical finding, the number bounty hunters actually care about.
22115. **Velocity normalized by attack surface** — findings-per-hour divided by endpoint count so small and large targets can be compared fairly.
22116. **Probe-to-finding conversion rate** — the percentage of sent probes that became confirmed findings, measuring agent precision over time.
22117. **Velocity decay curve** — a chart showing how finding rate naturally decays as coverage saturates, with the current hunt overlaid.
22118. **Peak velocity timestamp** — marks the exact minute the hunt hit maximum findings-per-hour for post-hunt strategy review.
22119. **Velocity by auth state** — compares findings-per-hour for unauthenticated vs authenticated vs admin sessions to guide credential investment.
22120. **Velocity by endpoint type** — splits finding rate across APIs, forms, file uploads, and WebSockets to show the richest surfaces.
22121. **Stall detector** — flags any 30-minute window with zero new findings and suggests the strategy switch that historically broke similar stalls.
22122. **Velocity comparison vs last hunt** — overlays current velocity curve on the previous hunt for the same target to show improvement or regression.
22123. **Findings-per-1000-probes metric** — a normalized efficiency KPI that stays comparable even when hunt durations differ wildly.
22124. **Time-to-first-finding by severity** — separate timers for first low, medium, high, and critical findings to profile discovery depth.
22125. **Velocity during business hours vs off-hours** — compares finding rates across time-of-day to detect WAF or rate-limit interference patterns.
22126. **Agent strategy velocity attribution** — attributes each finding to the active strategy module so users see which module earns its keep.
22127. **Velocity forecast for next hour** — a short-term prediction of expected findings in the coming hour based on the current decay curve.
22128. **Quiet-period analyzer** — breaks down zero-finding gaps by cause (WAF block, auth expiry, crawler stall) with timestamps.
22129. **Velocity per subdomain** — findings-per-hour for each subdomain to identify the juiciest parts of the attack surface.
22130. **Duplicate-aware velocity** — recalculates velocity counting only unique findings so re-discoveries do not inflate the numbers.
22131. **Severity-weighted velocity** — weights each finding by severity score before computing per-hour rates so criticals move the needle more.
22132. **Velocity by parameter type** — compares finding rates for query, body, header, and cookie parameters to focus fuzzing effort.
22133. **Time-to-triage metric** — measures minutes from finding confirmation to the agent finishing its FP check and evidence capture.
22134. **Time-to-PoC metric** — tracks how long after confirmation the auto-generated PoC is ready, measuring exploit-generation speed.
22135. **Velocity of FP-filtered findings** — plots the rate at which the FP filter rejects candidates, exposing noisy strategy modules.
22136. **Reopened-finding velocity** — tracks how fast previously closed findings get reopened, a quality signal for verification rigor.
22137. **Velocity by HTTP method** — findings-per-hour attributed to GET, POST, PUT, DELETE probes to tune method coverage.
22138. **Velocity by payload family** — shows which payload families (polyglots, time-based, OOB) convert fastest into confirmed findings.
22139. **Concurrent-hunt velocity comparison** — side-by-side velocity of hunts running in parallel to spot resource contention.
22140. **Velocity milestone badges** — awards badges at 1, 5, 10 findings-per-hour thresholds to gamify hunt performance tracking.
22141. **Cost-per-finding-per-hour** — combines compute cost with velocity to show the real-time price of each confirmed finding.
22142. **Velocity-adjusted coverage priority** — reorders the remaining attack surface by expected findings-per-hour so the agent always works the richest queue first.
22143. **Night-vs-day velocity split** — compares overnight autonomous velocity against supervised daytime velocity for the same target.
22144. **Velocity by crawler depth** — findings-per-hour at depth 1, 2, 3+ to prove whether deep crawling pays off.
22145. **First-finding source attribution** — records which module and probe produced the first finding of each hunt for strategy tuning.
22146. **Velocity confidence interval** — shows error bands around the velocity curve so users do not over-read small fluctuations.
22147. **Rolling 15-minute velocity** — a smoothed short-window velocity that reacts fast enough to guide live strategy switches.
22148. **Velocity by target size tier** — benchmarks findings-per-hour against targets of similar size (small/medium/enterprise) for fair comparison.
22149. **Diminishing-returns detector** — alerts when projected findings from remaining coverage fall below a cost threshold, suggesting hunt wrap-up.
22150. **Velocity by week of hunt** — for long-running hunts, weekly velocity bars reveal fatigue or fresh-surface effects.
22151. **Exploit-chain velocity** — measures how fast the agent converts single findings into chained exploits, tracking depth not just breadth.
22152. **Velocity by response-time bucket** — correlates finding rates with target response latency to detect throttling effects.
22153. **Blind-spot re-attack velocity** — tracks findings-per-hour specifically on blind-spot re-queues to validate the blind-spot detector.
22154. **Velocity by IP/ASN** — for multi-origin targets, splits velocity by hosting provider to find weaker infrastructure segments.
22155. **Time-to-first-finding distribution** — a histogram across all hunts showing the typical warm-up distribution for new targets.
22156. **Velocity vs coverage scatter** — plots findings-per-hour against coverage percentage to find the sweet spot of maximum yield.
22157. **Strategy-switch velocity delta** — measures velocity before and after each automatic strategy switch to score the switcher itself.
22158. **Velocity by day of week** — aggregates findings-per-hour by weekday to detect target-side deployment or WAF-tuning patterns.
22159. **False-positive velocity** — tracks FP confirmations per hour as a negative KPI, penalizing noisy modules in rankings.
22160. **Velocity by severity over time** — stacked area chart showing how the severity mix of new findings evolves through the hunt.
22161. **Hunt momentum score** — a single 0–100 number combining current velocity, acceleration, and remaining coverage into a live momentum readout.
22162. **Velocity by language/framework version** — splits finding rates by detected version (e.g., PHP 7.4 vs 8.2) to spot version-specific weakness.
22163. **Time-to-second-finding** — measures the gap between first and second findings as a signal of whether the first was luck or surface richness.
22164. **Velocity per dollar of bounty** — findings-per-hour weighted by estimated payout so high-value velocity is visible separately.
22165. **Regression velocity** — tracks how fast previously fixed vulnerabilities reappear across hunts on the same target.
22166. **Velocity by geographic region** — for geo-distributed targets, splits finding rates by region to catch region-specific misconfigurations.
22167. **Agent idle-time percentage** — measures what fraction of hunt time the agent spent waiting (rate limits, timeouts) versus actively probing.
22168. **Velocity by authentication method** — compares cookie, token, and OAuth session finding rates to guide auth setup effort.
22169. **Peak-to-trough velocity ratio** — the ratio of best to worst hourly velocity in a hunt, flagging inconsistent strategy performance.
22170. **Velocity after FP-filter tuning** — before/after comparison showing whether filter changes improved net confirmed-finding velocity.
22171. **Time-to-first-finding SLA** — a configurable target (e.g., 30 minutes) with pass/fail per hunt to hold the agent accountable.
22172. **Velocity by file type** — findings-per-hour from probes against PDFs, images, CSVs, and archives to justify upload-fuzzing spend.
22173. **Cross-hunt velocity percentile** — shows where the current hunt's velocity ranks among all hunts ever run on similar targets.
22174. **Velocity by chain length** — compares single-finding velocity against 2-chain and 3-chain exploit velocity to value depth.
22175. **Sustained-velocity record** — tracks the longest streak above a velocity threshold, gamifying consistent performance.
22176. **Velocity drop root-cause hints** — when velocity falls, the dashboard lists the top three correlated causes (coverage saturation, WAF, auth expiry).
22177. **Findings-per-session metric** — velocity normalized by authenticated session count so multi-account hunts compare fairly.
22178. **Velocity by request size** — correlates finding rates with probe payload sizes to detect size-based filtering on the target.
22179. **Time-to-first-finding by target tier** — benchmarks warm-up time separately for small, medium, and enterprise targets.
22180. **Velocity volatility index** — a single number capturing how spiky the velocity curve is, warning against over-interpreting bursty hunts.
22181. **Hunt-half comparison** — splits the hunt into first and second halves and compares velocity to show whether the agent finished strong.
22182. **Velocity by evidence quality** — weights findings by PoC completeness so well-evidenced findings count more in velocity stats.
22183. **Quiet-surface velocity** — findings-per-hour on endpoints with zero prior coverage, measuring pure exploration yield.
22184. **Revisit velocity** — findings-per-hour when re-hunting a previously completed target, quantifying regression and drift value.
22185. **Velocity by WAF presence** — compares finding rates on WAF-protected versus unprotected endpoints to quantify WAF impact.
22186. **Time-to-first-duplicate** — measures when the agent starts re-finding known issues, signaling it is time to redirect effort.
22187. **Velocity by proxy/egress IP** — detects whether certain egress IPs get blocked, splitting velocity by outbound IP.
22188. **Findings-per-GB-traffic** — efficiency KPI relating findings to bandwidth consumed, useful for metered environments.
22189. **Velocity by TLS version** — splits finding rates by negotiated TLS version to correlate with legacy-stack weakness.
22190. **Hunt velocity report card** — an auto-generated one-page summary of every velocity metric for the hunt, exportable as PDF.
22191. **Velocity by business-critical flow** — findings-per-hour on user-tagged critical flows (login, pay) versus everything else.
22192. **Time-to-first-chained-exploit** — tracks minutes until the first multi-step exploit chain completes, measuring depth speed.
22193. **Velocity by scan aggressiveness** — compares polite versus aggressive scan modes on finding rate to tune the risk/speed tradeoff.
22194. **Post-stall recovery velocity** — measures how fast findings resume after a stall is resolved, scoring the recovery playbook.
22195. **Velocity by header presence** — correlates finding rates with security-header presence to show headers' real protective effect.
22196. **Findings-per-auth-token** — for hunts using multiple tokens, velocity per token to spot burned or low-privilege credentials.
22197. **Velocity by content encoding** — splits rates across gzip, br, and identity responses to catch encoding-related parser bugs.
22198. **Time-to-first-finding by module** — per-module warm-up timers revealing which strategy modules start producing fastest.
22199. **Velocity anomaly baseline** — stores each target's historical velocity profile so future hunts can be scored against it.
22200. **Velocity by redirect depth** — findings-per-hour on endpoints behind 0, 1, 2+ redirects to justify redirect-chain following.
22201. **Hunt velocity replay** — a scrubbable timeline replaying the hunt's velocity curve alongside the strategy active at each moment.
22202. **Velocity by query complexity** — for GraphQL targets, finding rates bucketed by query depth and complexity score.
22203. **Findings-per-unique-parameter** — velocity normalized by distinct parameters tested, the fairest cross-target efficiency metric.
22204. **Velocity target setter** — lets users set a findings-per-hour goal per hunt with live progress and projected hit/miss.

## 3. MTTR & remediation metrics (22205–22304)

22205. **Mean-time-to-remediate by severity** — a dashboard card showing average days from finding confirmation to verified fix, split by critical, high, medium, and low.
22206. **MTTR by team leaderboard** — ranks engineering teams by remediation speed so security can praise fast teams and coach slow ones with data.
22207. **MTTR by vulnerability class** — compares fix times for XSS, SQLi, IDOR, and others to reveal which bug types stall in engineering queues.
22208. **Remediation SLA tracker** — per-severity countdown timers (e.g., criticals in 7 days) with breach highlighting and escalation alerts.
22209. **Reopen rate metric** — the percentage of marked-fixed findings that fail re-verification, exposing patch quality problems per team.
22210. **Fix-verification turnaround** — measures hours from a fix being claimed to the agent completing its re-test, tracking verification responsiveness.
22211. **MTTR trend line** — a month-over-month chart of mean remediation time showing whether the organization is getting faster or slower at fixing.
22212. **SLA compliance percentage** — the share of findings remediated within their SLA window, reported per team and per severity.
22213. **Aging findings report** — lists all open findings older than 30/60/90 days with owner, severity, and days-overdue for escalation meetings.
22214. **Time-to-acknowledge metric** — measures hours from finding notification to the owning team acknowledging it, catching triage bottlenecks.
22215. **Time-to-first-fix-attempt** — tracks how long before the first patch attempt appears, separating triage delay from engineering delay.
22216. **Remediation velocity chart** — findings closed per week plotted against findings opened per week to show whether the backlog is growing or shrinking.
22217. **MTTR by asset criticality** — compares fix times on production, staging, and internal assets to verify critical systems get priority.
22218. **Sibling-endpoint partial-fix finder** — flags findings where the fix worked on one endpoint but the same flaw persists on sibling endpoints.
22219. **Fix confidence score** — a 0–100 score per remediation based on re-test depth, regression coverage, and code-change scope.
22220. **MTTR by reporter source** — compares remediation speed for agent-found versus human-reported findings to quantify automation's impact.
22221. **7-day SLA breach forecaster** — forecasts which open findings will breach SLA in the next 7 days using current team velocity.
22222. **Remediation cost estimator** — estimates engineering hours per fix by vuln class from historical data to help teams plan sprints.
22223. **Fix-verification pass rate** — the percentage of re-tests that confirm the fix on first attempt, measuring patch correctness.
22224. **MTTR by day reported** — shows whether findings reported on Fridays or before holidays take longer, exposing calendar effects.
22225. **Mean-time-to-mitigate vs remediate** — separates quick mitigations (WAF rules, feature flags) from full code fixes with two distinct timers.
22226. **Remediation backlog burndown** — a burndown chart of open findings over time with the projected zero-date at current velocity.
22227. **Team capacity planner** — converts open findings into estimated engineer-days so managers can staff remediation realistically.
22228. **Fix deployment lag** — measures days from code fix merged to fix live in production, catching slow release pipelines.
22229. **MTTR by programming language** — compares fix times across PHP, Node, Python, and Java stacks to find ecosystem friction.
22230. **Recurrence rate by vuln class** — tracks how often the same vulnerability class reappears after being fixed, signaling systemic causes.
22231. **Remediation SLA calendar view** — a calendar showing every open finding's SLA deadline as an event with color-coded urgency.
22232. **Auto-escalation workflow** — automatically escalates findings approaching SLA breach to team leads with evidence and fix guidance attached.
22233. **MTTR percentile bands** — shows p50, p90, and p99 remediation times instead of just the mean so outliers do not hide the story.
22234. **Fix quality scorecard** — per-team grades combining reopen rate, verification pass rate, and recurrence into one quality number.
22235. **Time-to-fix by finding age at report** — correlates how long a bug existed before discovery with how fast it gets fixed.
22236. **Remediation comment sentiment** — analyzes engineer comments on tickets to flag frustrated or confused teams needing security support.
22237. **Wont-fix tracking** — a dedicated ledger of accepted-risk decisions with expiry dates so they get re-reviewed, not forgotten.
22238. **MTTR by vendor vs in-house** — compares fix times for third-party components against in-house code to inform build-vs-buy risk.
22239. **Patch Tuesday alignment** — shows what share of fixes ship in scheduled releases versus emergency patches.
22240. **Remediation dependency map** — visualizes which fixes are blocked waiting on other fixes or vendor patches.
22241. **Mean-time-to-detect vs remediate** — pairs detection speed with fix speed in one view to show the full vulnerability lifecycle.
22242. **Fix verification evidence locker** — stores before/after proof for every verified fix so audits have a complete paper trail.
22243. **SLA achievement streaks** — tracks consecutive SLA-compliant sprints per team to gamify consistent remediation.
22244. **MTTR by exploitability** — compares fix times for actively-exploitable findings versus theoretical ones to check prioritization sanity.
22245. **Remediation heatmap by service** — a heatmap of open findings across microservices so the riskiest services stand out.
22246. **Time-to-remediate distribution** — a histogram of fix times revealing whether most fixes are fast with a long tail of stuck ones.
22247. **Fix-owner accountability view** — every open finding shows a named owner, days held, and escalation path with no orphans allowed.
22248. **MTTR improvement attribution** — credits specific process changes (new runbooks, auto-PRs) with measured MTTR improvements.
22249. **Auto-generated fix PRs metric** — tracks what share of findings got agent-generated fix pull requests and their merge rate.
22250. **Remediation meeting agenda builder** — auto-compiles the week's SLA breaches, aging findings, and blockers into a ready meeting brief.
22251. **MTTR by CVSS vector** — breaks fix times down by attack vector (network, adjacent, local) to see if remote bugs get priority.
22252. **Fix rollback detector** — flags findings that were fixed then reintroduced by later deploys, with the offending commit identified.
22253. **Mean-time-to-workaround** — tracks how fast temporary mitigations go live separately from permanent fixes.
22254. **Remediation SLA by compliance framework** — maps SLA targets to SOC 2, ISO 27001, and PCI DSS requirements with compliance-gap flags.
22255. **Team remediation load balancer** — visualizes open-findings load per engineer to prevent burnout-driven quality drops.
22256. **Fix verification scheduling** — auto-schedules re-tests at off-peak hours and reports the queue so verification never blocks hunts.
22257. **MTTR by finding confidence** — compares fix times for high-confidence versus low-confidence findings to see if doubt slows action.
22258. **Duplicate-fix consolidation** — groups duplicate findings across hunts into one remediation ticket with linked evidence.
22259. **Remediation ROI per team** — estimates dollars of risk removed per engineering hour spent, ranking teams by fix efficiency.
22260. **Stale-ticket auto-nudge** — sends escalating reminders on tickets with no activity for 7, 14, and 21 days.
22261. **MTTR by region** — compares remediation speed across geographic engineering offices to share best practices.
22262. **Fix-release correlation** — links each verified fix to the release version that shipped it for changelog accuracy.
22263. **Mean-time-to-patch-dependency** — specifically tracks how fast vulnerable libraries get upgraded, separate from code fixes.
22264. **Remediation confidence decay** — lowers the fix-confidence score over time if no re-test confirms it, preventing stale green statuses.
22265. **SLA exception log** — records every granted SLA extension with approver and reason for audit transparency.
22266. **MTTR by authentication complexity** — checks whether bugs in SSO or session code take longer to fix than simpler flaws.
22267. **Fix-test coverage gate** — requires the re-test to cover the original PoC plus variants before a fix counts as verified.
22268. **Remediation weekly digest** — an email/Slack summary of fixes verified, SLAs breached, and aging findings for leadership.
22269. **MTTR by data sensitivity** — compares fix times for findings touching PII or payment data against others to verify risk-based prioritization.
22270. **Chained-finding remediation tracker** — tracks exploit chains as one unit so partial chain fixes do not get marked complete prematurely.
22271. **Mean-time-to-first-response** — the fastest remediation KPI, measuring minutes from alert to any human or automated response.
22272. **Fix suggestion acceptance rate** — the percentage of agent-suggested fixes that engineers actually apply, tuning suggestion quality.
22273. **Remediation bottleneck analyzer** — identifies the stage (triage, dev, QA, deploy) where each team's fixes stall most.
22274. **MTTR by ticket system** — compares fix times across Jira, Linear, and GitHub Issues to spot tooling friction.
22275. **Auto-close verification** — when a ticket closes, the agent re-tests within 24 hours and reopens automatically if the flaw persists.
22276. **Remediation forecast** — predicts the date the current backlog clears at present velocity with confidence bands.
22277. **Fix diff analyzer** — attaches the code diff of each fix to the finding record so reviewers can audit patch correctness.
22278. **MTTR by microservice ownership** — per-service-owner fix times revealing which service teams need security pairing.
22279. **Emergency patch tracker** — a dedicated lane for out-of-band fixes with its own MTTR separate from routine remediation.
22280. **Remediation gamification board** — points for on-time fixes, streaks, and zero-reopen months with team rankings.
22281. **Mean-time-to-revoke** — for credential leaks, tracks minutes until the exposed secret is rotated, the metric that actually stops bleeding.
22282. **Fix verification SLA** — a separate SLA for the agent's own re-test turnaround so verification delays are visible too.
22283. **Remediation risk acceptance workflow** — formal accept/transfer/mitigate decisions with expiry and re-approval dates built in.
22284. **MTTR by exploit-publicity** — compares fix times before and after a public PoC or CVE appears to measure reactive pressure.
22285. **Cross-team fix collaboration map** — shows which teams co-own fixes on shared services to clarify joint accountability.
22286. **Remediation template library** — stores proven fix patterns per vuln class with one-click insertion into tickets.
22287. **Fix verification depth selector** — lets users choose smoke, standard, or deep re-test levels per severity with time estimates.
22288. **MTTR anomaly alerts** — notifies when a team's MTTR deviates significantly from its own baseline, catching process breakdowns early.
22289. **Remediation audit trail** — an immutable log of every status change, assignee change, and verification result per finding.
22290. **Time-to-fix by reporter reputation** — checks whether findings from trusted hunters get fixed faster, exposing triage bias.
22291. **Fix environment parity check** — verifies the fix in staging before production and flags parity gaps.
22292. **Remediation capacity forecast** — predicts engineer-hours needed next quarter from finding inflow trends.
22293. **MTTR by business unit** — compares fix times across product lines for portfolio-level risk reporting.
22294. **Auto-prioritized fix queue** — a single ranked list of open findings ordered by risk-times-SLA-urgency for daily standups.
22295. **Fix verification video proof** — records a short screen capture of the re-test so stakeholders can see the fix working.
22296. **Remediation SLA simulator** — models how changing SLA targets or team capacity would affect breach rates before committing.
22297. **MTTR by fix type** — compares code fixes, config changes, WAF rules, and upgrades on speed and durability.
22298. **Post-fix monitoring window** — watches fixed endpoints for 14 days after verification and alerts if the flaw signature returns.
22299. **Remediation knowledge base** — links each closed finding to its fix write-up so future similar bugs get fixed faster.
22300. **Fix-review turnaround** — measures hours from fix PR opened to merged, isolating review latency from coding time.
22301. **MTTR by severity drift** — tracks whether severity re-ratings during triage correlate with faster or slower fixes.
22302. **Remediation completeness audit** — quarterly check that every finding has a verified fix, accepted risk, or active ticket — nothing in limbo.
22303. **Time-to-lesson-learned** — measures days from critical fix to published postmortem, closing the learning loop.
22304. **Remediation health score** — a single 0–100 organizational score blending MTTR, SLA compliance, reopen rate, and backlog trend.

## 4. Bounty ROI calculator (22305–22404)

22305. **Estimated payout per finding** — auto-estimates bounty dollars for each finding using the program's published payout table and severity mapping.
22306. **Cost-per-hunt calculator** — totals compute, brain-inference, and time costs per hunt so profitability is measured against real spend.
22307. **ROI by target dashboard** — per-target cards showing total estimated payouts minus hunt costs, ranking targets by actual profitability.
22308. **ROI by program comparison** — compares net returns across HackerOne, Bugcrowd, and private programs to focus effort where it pays.
22309. **Projected annual bounty income** — extrapolates current monthly earnings into a 12-month forecast with best/base/worst scenarios.
22310. **Effort-adjusted ROI ranking** — ranks targets by dollars earned per hunt-hour so high-effort low-pay targets drop out of the queue.
22311. **Payout-by-severity breakdown** — a chart of earned versus expected payouts per severity tier to calibrate severity-to-dollar expectations.
22312. **Duplicate-adjusted earnings** — recalculates income counting only first-to-report findings using program duplicate-rate estimates.
22313. **Time-to-payout tracker** — measures days from report submission to bounty payment per program, revealing cash-flow speed.
22314. **Bounty-per-vuln-class table** — average payout earned per XSS, SQLi, IDOR, and other classes to guide where to hunt next.
22315. **Hunt profitability alert** — warns when a running hunt's projected payout falls below its running cost so it can be stopped early.
22316. **Program payout-table importer** — ingests a program's scope and reward ranges to keep estimates accurate as tables change.
22317. **ROI by tech stack** — shows which stacks (WordPress, Laravel, custom) produce the highest dollars-per-hour for the hunter.
22318. **Scope-efficiency score** — dollars earned per in-scope endpoint, identifying programs with dense, rewarding attack surfaces.
22319. **First-finder probability estimator** — estimates the chance a finding is a duplicate based on program age, hunter count, and vuln class.
22320. **Bounty income timeline** — a cumulative earnings chart with payout events marked, showing income growth over months.
22321. **Cost-per-confirmed-finding** — divides total hunt spend by unique confirmed findings for a clean unit-economics KPI.
22322. **ROI by hunt strategy** — compares earnings per strategy module so budget flows to the modules that actually earn.
22323. **Program triage-speed factor** — weights ROI by each program's median triage time since slow triage delays duplicate protection.
22324. **Estimated vs actual payout variance** — tracks how far estimates deviate from real payouts to continuously calibrate the model.
22325. **Bounty tax estimator** — rough after-tax income projection by the user's country so earnings expectations stay realistic.
22326. **Private-invite ROI tracker** — separate P&L for invite-only programs, which typically pay more per finding than public ones.
22327. **Target re-hunt ROI** — measures dollars earned on second and third hunts of the same target to decide when a target is tapped out.
22328. **Opportunity-cost dashboard** — shows what the current hunt is earning versus the best alternative target waiting in the queue.
22329. **Payout-by-program-tier** — compares earnings across VDP (no pay), low-pay, and top-tier programs to justify scope choices.
22330. **Bounty-per-hour leaderboard** — ranks every hunt by dollars-per-hour, making the most lucrative sessions obvious.
22331. **Duplicate-rate by program** — tracks the hunter's historical duplicate percentage per program to discount future estimates.
22332. **Scope-change ROI impact** — quantifies how program scope expansions or reductions changed earnings per hunt.
22333. **Critical-finding jackpot tracker** — highlights outsized payouts from criticals separately since they dominate total income.
22334. **Bounty income goal tracker** — lets users set monthly or annual earnings goals with live progress and required run-rate.
22335. **Cost-per-critical metric** — the fully-loaded cost to produce one critical finding, the most honest efficiency number.
22336. **Program responsiveness score** — blends triage speed, payout speed, and communication quality into a per-program desirability score.
22337. **ROI by time-of-day** — checks whether hunts started at certain hours earn more, catching fresh-scope or deployment windows.
22338. **Chain-bonus estimator** — adds expected payout uplift for exploit chains since chained impact usually raises rewards.
22339. **Bounty-per-endpoint-covered** — earnings divided by endpoints tested, rewarding deep coverage of rich targets.
22340. **Hunt budget setter** — lets users cap spend per hunt with auto-pause when the budget is hit, enforcing unit economics.
22341. **Program lifetime value** — total earned per program since first hunt, identifying the long-term cash cows.
22342. **ROI by authentication level** — compares earnings from unauthenticated versus authenticated versus admin-session hunting.
22343. **Payout delay cost** — estimates the time-value cost of slow-paying programs to compare them fairly against fast payers.
22344. **Bounty-per-payload-family** — shows which payload families produce the highest-earning findings to tune fuzzing investment.
22345. **Target saturation curve** — plots cumulative earnings per target against hunt count to visualize diminishing returns.
22346. **New-scope bounty rush detector** — flags freshly added program scope where first-finder odds (and payouts) are highest.
22347. **ROI by report quality** — correlates report completeness scores with actual payouts to prove good reports earn more.
22348. **Hall-of-fame earnings tracker** — tracks points and bonuses toward program leaderboards alongside cash earnings.
22349. **Bounty-per-GB-traffic** — earnings relative to bandwidth used, useful when hunting from metered connections.
22350. **Program payout trend** — tracks whether a program's average payouts are rising or falling over time.
22351. **ROI by day-of-week** — aggregates earnings by hunt start day to find the most lucrative scheduling patterns.
22352. **Duplicate-insurance metric** — estimates earnings protected by fast submission (reporting within hours of confirmation).
22353. **Bounty income diversification** — shows earnings concentration across programs, warning when one program dominates income.
22354. **Cost-per-report-submitted** — fully-loaded cost per submitted report including triage and re-test time.
22355. **Program scope-density map** — visualizes endpoints-per-dollar across programs to find the densest opportunities.
22356. **ROI by hunt duration** — compares short sprints versus long campaigns on dollars-per-hour to optimize hunt length.
22357. **Payout-by-CWE table** — average earnings per CWE identifier for granular strategy tuning.
22358. **Bounty seasonality chart** — monthly earnings across years revealing seasonal patterns in program generosity or scope.
22359. **Target acquisition cost** — tracks recon and setup time per new target as an upfront investment against future earnings.
22360. **ROI by subdomain** — earnings per subdomain to find which parts of a target pay best on re-hunts.
22361. **Program bonus tracker** — logs discretionary bonuses, swag, and leaderboard prizes separately from base payouts.
22362. **Bounty-per-session-token** — for multi-account hunts, earnings attributed per credential to spot burned accounts.
22363. **Hunt profit watermark** — a live P&L line during the hunt that turns red when costs exceed projected payouts.
22364. **ROI by exploit depth** — compares earnings from single findings versus 2-chain and 3-chain exploits.
22365. **Program churn detector** — alerts when a historically profitable program's payouts drop or scope shrinks.
22366. **Bounty income vs salary benchmark** — compares annualized bounty earnings against market security salaries for career context.
22367. **Target portfolio optimizer** — recommends a weekly target mix (new vs re-hunt, big vs small) maximizing expected dollars-per-hour.
22368. **ROI by WAF presence** — checks whether WAF-protected targets still pay enough to justify the extra effort.
22369. **Payout-by-business-impact** — correlates payouts with the agent's own impact scoring to find undervalued finding types.
22370. **Duplicate clustering analysis** — shows which vuln classes get duplicated most per program so effort shifts to rarer bugs.
22371. **Bounty-per-API-version** — earnings split by API version to justify hunting deprecated endpoints.
22372. **Program response SLA tracker** — measures each program's actual response times against its promises, feeding the desirability score.
22373. **ROI by geographic region** — for region-scoped programs, earnings per region to focus on the best-paying locales.
22374. **Hunt sunk-cost advisor** — recommends continue-or-stop for running hunts based on marginal expected value of the next hour.
22375. **Bounty income forecast bands** — Monte Carlo earnings forecast with 10th/50th/90th percentile bands for honest planning.
22376. **Program entry-timing score** — rates how early the hunter joined each program since early entry correlates with higher ROI.
22377. **ROI by mobile vs web** — compares earnings from mobile-app versus web attack surfaces within the same program.
22378. **Payout-by-report-format** — tests whether video PoCs or longer reports correlate with higher payouts.
22379. **Target freshness index** — scores targets by days since last hunt and scope changes to prioritize fresh opportunity.
22380. **Bounty-per-crawler-depth** — earnings attributed to findings at each crawl depth to justify deep-crawl compute spend.
22381. **Program dispute tracker** — logs appealed triage decisions and their outcomes to measure dispute ROI.
22382. **ROI by language of target** — checks whether non-English targets (less hunter competition) pay better per hour.
22383. **Hunt cost breakdown pie** — splits each hunt's cost into inference, compute, bandwidth, and verification for cost control.
22384. **Bounty income milestone alerts** — celebrates $1k, $10k, $100k lifetime milestones with a shareable earnings card.
22385. **Program exclusivity premium** — quantifies the payout premium of private invites versus public programs for the same effort.
22386. **ROI by finding age** — compares payouts for fresh zero-day-style finds versus long-known bug classes.
22387. **Target rotation scheduler** — auto-suggests which targets to hunt each week based on freshness, ROI history, and scope changes.
22388. **Bounty-per-auth-state** — earnings split by the auth state that produced the finding to value credential acquisition.
22389. **Program payout reliability score** — tracks what share of accepted reports actually got paid versus closed unpaid.
22390. **Hunt efficiency frontier** — a scatter of all hunts on cost versus earnings with the Pareto frontier highlighted.
22391. **ROI by payload novelty** — compares earnings from novel custom payloads versus standard lists to value payload research.
22392. **Bounty income export** — one-click CSV of all earnings, costs, and payouts for tax filing and accounting.
22393. **Program scope-change alerts** — notifies when a profitable program expands scope, the highest-ROI moment to hunt.
22394. **Target lifetime earnings curve** — cumulative dollars per target over time showing exactly when each target stopped paying.
22395. **ROI by team size** — for collaborative hunting, earnings per contributor-hour to evaluate team efficiency.
22396. **Bounty-per-vulnerability-chain** — average payout for chained exploits versus singles to justify chain-building effort.
22397. **Program hunter-density estimate** — estimates competing hunters per program from duplicate rates to find low-competition gems.
22398. **Hunt break-even timer** — live countdown showing when the current hunt's projected earnings exceed its costs.
22399. **ROI by response-time bucket** — checks whether slower (heavily protected) targets pay enough to justify the patience.
22400. **Bounty income attribution** — attributes every dollar to the strategy, module, and payload family that produced it.
22401. **Program negotiation helper** — compiles a hunter's stats (signal, impact, report quality) into a brief for requesting payout bumps or invites.
22402. **ROI by file-upload findings** — earnings specifically from upload-related bugs to justify specialized fuzzing modules.
22403. **Target dormancy value** — estimates expected earnings from re-hunting a target after N dormant months using historical decay curves.
22404. **Annual bounty P&L statement** — an auto-generated profit-and-loss summary (revenue, costs, net, hourly rate) for the year.

## 5. Hunt comparison (22405–22504)

22405. **Before/after hunt diff view** — side-by-side comparison of two hunts on the same target showing new, fixed, and persistent findings at a glance.
22406. **A/B strategy comparison** — runs two strategy configurations against the same target snapshot and compares findings, coverage, and cost.
22407. **Baseline deviation alerts** — notifies when a new hunt's finding count or severity mix deviates sharply from the target's established baseline.
22408. **Improvement scorecard** — a per-target card grading coverage growth, finding reduction, and fix verification across consecutive hunts.
22409. **Regression detector** — automatically flags findings present in the latest hunt that were marked fixed in the previous one.
22410. **New-findings-since-last-hunt feed** — a dedicated list of only the findings that did not exist in the prior hunt, the highest-signal view for re-hunts.
22411. **Coverage delta map** — visualizes which endpoints gained coverage and which lost it between two hunts.
22412. **Severity-mix shift chart** — compares the severity distribution of two hunts to show whether the target is getting safer or just differently broken.
22413. **Hunt fingerprint comparison** — compares technique usage, payload families, and module mix between hunts to explain result differences.
22414. **Time-to-parity metric** — measures how long a re-hunt takes to rediscover all previously known findings, a consistency KPI for the agent.
22415. **Finding persistence rate** — the percentage of findings from hunt N still present in hunt N+1, measuring real remediation progress.
22416. **Strategy effectiveness delta** — shows which strategy changes between hunts produced more findings per hour and which hurt.
22417. **Target drift report** — summarizes how the target's tech stack, endpoints, and auth changed between hunts to contextualize new findings.
22418. **Cross-hunt duplicate linker** — automatically links the same underlying flaw across hunts even when URLs or parameters shifted slightly.
22419. **Hunt quality score comparison** — compares coverage, evidence completeness, and FP rates between hunts as an agent-quality trend.
22420. **Cost-per-hunt trend** — tracks how the fully-loaded cost of hunting the same target changes as the agent learns it.
22421. **Velocity comparison overlay** — overlays the findings-per-hour curves of two hunts to see which strategy found things faster.
22422. **Blind-spot closure rate** — measures what share of previously identified blind spots got covered in the latest hunt.
22423. **False-positive rate delta** — compares FP rates between hunts to show whether detection precision is improving.
22424. **Exploit-chain evolution** — shows how chained exploits changed between hunts as individual links got fixed or new ones appeared.
22425. **Auth-coverage comparison** — compares which auth states and roles were tested across hunts to catch testing regressions.
22426. **Parameter-coverage delta** — lists parameters tested in the old hunt but missed in the new one, and vice versa.
22427. **Hunt duration normalizer** — scales metrics from hunts of different lengths so a 2-hour and a 20-hour hunt compare fairly.
22428. **Finding aging across hunts** — tracks individual findings across multiple hunts showing days-open and status transitions.
22429. **Scope-change impact view** — isolates findings attributable to scope additions versus true new vulnerabilities.
22430. **Technique-adoption tracker** — shows which new attack techniques were used in the latest hunt and what they found.
22431. **Hunt-to-hunt learning proof** — quantifies findings in the new hunt that came directly from lessons recorded in the old hunt.
22432. **Regression severity escalator** — auto-escalates regressions of previously critical findings to the top of the new report.
22433. **Coverage-efficiency comparison** — findings per coverage-point for each hunt, revealing which hunt squeezed more value from its testing.
22434. **WAF-evasion progress** — compares bypass success rates between hunts to show whether evasion techniques are improving.
22435. **Payload-novelty comparison** — measures what share of payloads in each hunt were new versus reused.
22436. **Hunt configuration diff** — a clean diff of settings, scope, credentials, and modules between two hunts for reproducibility.
22437. **Finding-evidence quality delta** — compares PoC completeness and evidence depth between hunts as a professionalism metric.
22438. **Time-to-first-finding race** — head-to-head warm-up times across hunts on the same target to benchmark agent improvements.
22439. **Stall-pattern comparison** — compares where each hunt stalled to see if the same bottlenecks keep recurring.
22440. **Module-contribution shift** — shows how each strategy module's share of findings changed between hunts.
22441. **Target-surface growth chart** — plots endpoint count across hunts to separate target growth from agent improvement.
22442. **Fix-verification consistency** — checks that fixes verified in hunt N are still fixed in hunt N+1, catching rollback regressions.
22443. **Hunt report diff** — generates a redline diff between the PDF reports of two hunts for stakeholder review.
22444. **Duplicate-rate trend** — tracks what share of each hunt's findings were duplicates of known issues over time.
22445. **New-tech risk comparison** — flags newly detected frameworks or services between hunts and their associated findings.
22446. **Credential-effectiveness delta** — compares what each hunt's credentials unlocked, catching expired or downgraded access.
22447. **Hunt ROI comparison** — side-by-side dollars-per-hour and total profit for hunts on the same target.
22448. **Crawler-behavior diff** — compares crawl depth, breadth, and discovery counts to explain coverage differences.
22449. **Peak-velocity comparison** — head-to-head maximum findings-per-hour to see which hunt hit hardest.
22450. **Quiet-period analysis** — compares zero-finding gaps between hunts to identify recurring environmental interference.
22451. **Strategy-switch count** — compares how many mid-hunt strategy pivots each hunt needed, a stability signal.
22452. **Finding-clustering stability** — checks whether the same finding clusters appear across hunts or the agent's grouping drifts.
22453. **Severity-regrade tracker** — logs findings whose severity changed between hunts with the reason, keeping ratings honest.
22454. **Hunt-completeness grade** — an A–F grade per hunt based on coverage, verification, and reporting thoroughness for trend tracking.
22455. **Cross-hunt finding timeline** — a Gantt-style timeline of every finding's lifecycle across all hunts on a target.
22456. **New-endpoint risk scorer** — scores endpoints that appeared between hunts by likelihood of introducing vulnerabilities.
22457. **Removed-endpoint audit** — lists endpoints that disappeared between hunts to confirm deprecations actually removed risk.
22458. **Hunt-notes comparison** — surfaces the agent's own post-hunt notes side by side to track evolving understanding of the target.
22459. **False-negative estimator** — uses findings from the newer hunt to estimate what the older hunt missed, a recall metric.
22460. **Technique-coverage matrix diff** — compares which attack techniques ran against which endpoint classes across hunts.
22461. **Hunt reproducibility score** — measures how consistently the agent reproduces its own results, a reliability KPI.
22462. **Cost-per-new-finding** — the marginal cost of each genuinely new finding in a re-hunt, the key re-hunt economics number.
22463. **Baseline auto-establishment** — automatically designates the first thorough hunt on a target as its baseline for all future comparisons.
22464. **Deviation severity grading** — grades baseline deviations as info, warning, or critical based on finding severity and count.
22465. **Hunt-weather comparison** — compares external conditions (target response times, WAF behavior) between hunts to explain variance.
22466. **Finding-title stability** — tracks whether the agent names the same flaw consistently across hunts for clean deduplication.
22467. **Verification-depth delta** — compares how thoroughly findings were re-tested in each hunt.
22468. **Report-length and quality trend** — tracks report page count, evidence items, and readability scores across hunts.
22469. **Hunt-goal achievement** — compares each hunt against its pre-set goals (coverage target, finding target) with pass/fail history.
22470. **Strategy-rollback advisor** — recommends reverting to the previous hunt's strategy when the new one underperforms on every metric.
22471. **Target-maturity score** — a composite of finding decline, fix speed, and coverage that grades how hardened a target has become.
22472. **Hunt-pair shareable link** — generates a link showing the before/after comparison for clients or program managers.
22473. **Regression root-cause hints** — correlates regressions with deploys, rollbacks, or config changes detected between hunts.
22474. **New-finding triage queue** — auto-builds a triage list containing only genuinely new findings from the latest hunt.
22475. **Hunt-overlap heatmap** — a matrix showing finding overlap between every pair of hunts on a target.
22476. **Diminishing-returns crossover** — pinpoints the hunt number where re-hunting stopped being profitable for each target.
22477. **Strategy-champion tracker** — records which strategy won each A/B test per target, building a playbook of what works where.
22478. **Finding-half-life metric** — the median hunts-until-fixed for findings on a target, measuring remediation responsiveness.
22479. **Coverage-saturation point** — identifies the coverage percentage beyond which new findings historically stop appearing per target.
22480. **Hunt-consistency dashboard** — aggregates reproducibility, parity time, and FP stability into one agent-reliability view.
22481. **Before/after risk-dollars** — compares the estimated dollar-risk of the target before and after remediation between hunts.
22482. **Technique-decay monitor** — tracks whether once-effective techniques stop working on a target (defenses adapting).
22483. **Hunt-narrative generator** — auto-writes a paragraph explaining what changed between hunts in plain language for reports.
22484. **Cross-hunt PoC reuse rate** — measures how often old PoCs still work, indicating target stability.
22485. **Finding-migration tracker** — detects when the same flaw moves to a new URL or parameter between hunts (refactors).
22486. **Hunt-effort parity** — normalizes comparison metrics by probe count so effort differences do not masquerade as effectiveness differences.
22487. **Baseline drift score** — a single number capturing how far the latest hunt deviates from baseline across all dimensions.
22488. **New-hunt kickoff brief** — auto-generates a pre-hunt brief summarizing last hunt's gaps, blind spots, and open findings.
22489. **Hunt-diff export** — exports the full before/after comparison as a stakeholder-ready PDF appendix.
22490. **Regression-free streak** — counts consecutive hunts with zero regressions as a target-health gamification metric.
22491. **Finding-severity migration** — tracks individual findings that got more or less severe between hunts and why.
22492. **Strategy-blend optimizer** — recommends a blend of the two hunts' strategies weighted by their per-module wins.
22493. **Hunt-calendar overlay** — plots all hunts on a timeline with findings and deploys marked to correlate changes with events.
22494. **Cross-hunt credential audit** — verifies the same credential set was used so auth differences do not corrupt comparisons.
22495. **New-surface hunt mode** — a comparison-driven mode that hunts only the delta (new endpoints, changed code) since the last hunt.
22496. **Hunt-comparison API** — exposes before/after diffs programmatically so external dashboards can embed them.
22497. **Finding-resurrection log** — a special log of findings declared fixed that came back, with full history for accountability.
22498. **Strategy-swap simulator** — estimates what hunt B would have found using hunt A's strategy, from logged probe data.
22499. **Hunt-pair anomaly flags** — highlights metric pairs that moved in opposite directions (e.g., coverage up but findings down) for investigation.
22500. **Target-learning curve** — plots agent effectiveness on a target across hunts to prove the learning engine compounds.
22501. **Comparison confidence score** — grades how comparable two hunts really are (scope, config, duration similarity) before showing diffs.
22502. **Hunt-diff commenting** — lets users annotate specific diffs with notes for team review and client explanations.
22503. **Regression-sla tracker** — gives regressions their own accelerated SLA since a returned bug is worse than a new one.
22504. **Multi-hunt trend ribbon** — a compact ribbon across 5+ hunts showing coverage, findings, and cost in one glanceable strip.

## 6. Attack-surface heatmaps (22505–22604)

22505. **Riskiest-endpoints heatmap** — a color-coded grid of endpoints ranked by combined severity and exploitability so the hottest routes glow red.
22506. **Parameter-risk treemap** — a treemap where each parameter's box size reflects finding count and color reflects max severity.
22507. **Geographic infrastructure heatmap** — a world map coloring regions by exposed infrastructure and finding density per hosting location.
22508. **Finding-timeline heatmap** — a calendar heatmap showing on which days and hours findings appeared during the hunt.
22509. **Subdomain risk heatmap** — every subdomain plotted with color intensity by total risk score for instant weakest-link spotting.
22510. **Endpoint-method risk matrix** — a matrix of endpoints versus HTTP methods with cells colored by finding severity found via each method.
22511. **CWE density heatmap** — weakness types plotted against target components showing where each bug class concentrates.
22512. **Auth-state risk heatmap** — endpoints versus guest/user/admin with color showing the highest severity reachable per state.
22513. **Crawl-depth risk gradient** — colors each crawl depth by findings-per-endpoint to show whether depth correlates with risk.
22514. **Technology-stack heatmap** — detected frameworks and libraries as a heatmap by known-CVE exposure and hunt findings.
22515. **Port-service heatmap** — open ports and services colored by risk score from banner and misconfiguration analysis.
22516. **Certificate-risk heatmap** — subdomains colored by TLS issues (expired, weak cipher, mismatched hostname).
22517. **DNS-exposure heatmap** — record types and subdomains colored by information disclosure risk (zone transfers, verbose TXT).
22518. **Header-security heatmap** — endpoints colored by missing security headers, with darker cells for more missing headers.
22519. **Cookie-risk heatmap** — cookies plotted by missing flags (HttpOnly, Secure, SameSite) with severity-weighted coloring.
22520. **File-upload risk map** — upload endpoints colored by accepted file types and validation gaps.
22521. **API-version risk comparison** — versions as heatmap rows showing which generation of the API carries the most risk.
22522. **Time-of-day exposure heatmap** — hours of the week colored by when sensitive endpoints were reachable or debug modes were on.
22523. **Response-size anomaly heatmap** — endpoints colored by unusual response sizes that may indicate verbose errors or data leaks.
22524. **Status-code heatmap** — endpoints versus status codes with color showing unexpected codes that hint at hidden behavior.
22525. **Redirect heatmap** — redirect chains visualized with open-redirect and chain-length risk coloring.
22526. **Third-party risk heatmap** — external scripts, iframes, and integrations colored by their own vulnerability and trust scores.
22527. **JavaScript-library heatmap** — detected JS libraries colored by known vulnerabilities in their versions.
22528. **Form-risk heatmap** — every form colored by finding severity, with stored-XSS-capable forms glowing brightest.
22529. **Search-endpoint heatmap** — search inputs colored by reflected-XSS and injection finding density.
22530. **Login-surface heatmap** — authentication endpoints colored by brute-force, enumeration, and bypass findings.
22531. **Password-reset heatmap** — reset-flow steps colored by token-weakness and enumeration findings.
22532. **Payment-surface heatmap** — checkout and payment endpoints colored by tampering and logic-flaw findings.
22533. **PII-density heatmap** — endpoints colored by the volume of personal data in responses, highlighting breach-impact zones.
22534. **Admin-surface heatmap** — internal and admin routes colored by exposure level and missing-auth findings.
22535. **WebSocket risk heatmap** — ws endpoints colored by message-injection and auth findings per message type.
22536. **GraphQL-field heatmap** — schema fields colored by finding density to show which resolvers are weakest.
22537. **Mobile-API heatmap** — mobile-only endpoints colored separately from web to compare platform risk.
22538. **Legacy-path heatmap** — old and deprecated routes colored by risk to justify decommissioning.
22539. **CDN-bypass heatmap** — origin IPs and direct-access paths colored by exposure when the CDN is bypassed.
22540. **WAF-coverage heatmap** — endpoints colored by whether WAF protection was detected, exposing unprotected routes.
22541. **Rate-limit heatmap** — endpoints colored by missing or weak rate limiting, with brute-forceable routes highlighted.
22542. **CORS-risk heatmap** — endpoints colored by CORS misconfiguration severity, wildcard-with-credentials glowing red.
22543. **JWT-weakness heatmap** — token-handling endpoints colored by none-alg, weak-secret, and missing-expiry findings.
22544. **SSRF-surface heatmap** — URL-fetching parameters colored by SSRF finding density and cloud-metadata proximity.
22545. **XXE-surface heatmap** — XML-parsing endpoints colored by entity-expansion and external-entity findings.
22546. **SSTI-surface heatmap** — template-rendering routes colored by injection finding severity.
22547. **Deserialization heatmap** — endpoints accepting serialized objects colored by deserialization findings.
22548. **IDOR-density heatmap** — object-reference endpoints colored by IDOR finding count, the classic access-control view.
22549. **Mass-assignment heatmap** — update endpoints colored by extra-field acceptance findings.
22550. **Business-logic heatmap** — workflow endpoints (coupons, referrals, bookings) colored by logic-flaw findings.
22551. **Race-condition surface map** — concurrency-sensitive endpoints colored by race-window findings.
22552. **Cache-poisoning heatmap** — cacheable endpoints colored by poisoning and deception findings.
22553. **Subdomain-takeover heatmap** — dangling DNS records colored by takeover confirmability.
22554. **Email-header injection map** — contact and notification endpoints colored by header-injection findings.
22555. **Open-redirect heatmap** — redirect parameters colored by open-redirect confirmation density.
22556. **Clickjacking heatmap** — pages colored by missing frame-ancestors protection weighted by action sensitivity.
22557. **MIME-sniffing heatmap** — upload and download endpoints colored by content-type confusion findings.
22558. **Directory-listing heatmap** — paths colored by exposed listings and backup-file discoveries.
22559. **Backup-file heatmap** — discovered .bak, .old, .swp files plotted by location with credential-leak risk coloring.
22560. **Git-exposure heatmap** — repos and .git paths colored by exposed-history severity.
22561. **Env-file exposure map** — discovered .env and config files colored by secret content found.
22562. **Cloud-storage heatmap** — S3 buckets and storage URLs colored by public-access and listing findings.
22563. **Container-registry heatmap** — exposed registries colored by unauthenticated-pull findings.
22564. **CI/CD exposure heatmap** — pipeline and webhook endpoints colored by unauthenticated-trigger findings.
22565. **Database-exposure heatmap** — direct database ports and phpMyAdmin-style panels colored by auth findings.
22566. **IoT/OT surface map** — device management endpoints colored by default-credential and firmware findings.
22567. **VPN/remote-access heatmap** — gateways colored by auth-bypass and enumeration findings.
22568. **Email-infrastructure heatmap** — MX, SPF, DMARC records colored by spoofing-risk scores.
22569. **BGP/ASN risk view** — hosting ASNs colored by historical abuse and finding density.
22570. **IPv6-exposure heatmap** — IPv6-reachable services colored separately since they are often forgotten by defenders.
22571. **Dark-web mention heatmap** — target assets colored by breach-data and credential-leak mentions found in OSINT.
22572. **Certificate-transparency heatmap** — subdomains from CT logs colored by whether they were in scope and tested.
22573. **Technology-eol heatmap** — components colored by end-of-life status with unpatched-CVE counts.
22574. **Dependency-risk heatmap** — libraries plotted by known CVEs weighted by reachability from the attack surface.
22575. **Chained-exploit path map** — exploit chains drawn as glowing paths across the endpoint graph showing multi-step attack routes.
22576. **Blast-radius heatmap** — each finding colored by estimated blast radius (data, users, systems affected).
22577. **Service pivot-path difficulty map** — post-exploitation pivot paths between services colored by difficulty.
22578. **Privilege-escalation heatmap** — roles and endpoints colored by escalation-path findings.
22579. **Data-exfiltration surface map** — export, download, and API bulk endpoints colored by exfiltration feasibility.
22580. **Session-fixation heatmap** — session-handling endpoints colored by fixation and hijacking findings.
22581. **2FA-bypass surface map** — second-factor endpoints colored by bypass and brute-force findings.
22582. **OAuth-scope heatmap** — granted scopes colored by over-permission and token-leak findings.
22583. **API-key exposure heatmap** — endpoints and JS bundles colored by leaked-key discoveries.
22584. **Webhook-security heatmap** — inbound webhooks colored by missing-signature and replay findings.
22585. **GraphQL-depth heatmap** — queries colored by depth/complexity abuse findings.
22586. **gRPC-method heatmap** — gRPC services and methods colored by auth and input-validation findings.
22587. **SOAP-action heatmap** — SOAP operations colored by XXE and auth findings for legacy services.
22588. **FTP/SMB exposure map** — file-protocol services colored by anonymous-access and traversal findings.
22589. **RDP/SSH exposure map** — remote-access services colored by brute-force and weak-auth findings.
22590. **Kubernetes-surface heatmap** — clusters, dashboards, and etcd colored by exposure findings.
22591. **Serverless-function map** — cloud functions colored by event-injection and over-permission findings.
22592. **CDN-configuration heatmap** — cache rules colored by poisoning and bypass findings.
22593. **DNS-rebinding surface map** — endpoints colored by rebinding-susceptible patterns.
22594. **Prototype-pollution heatmap** — JS-heavy endpoints colored by pollution finding density.
22595. **DOM-XSS sink map** — client-side sinks colored by confirmed DOM-XSS with source-to-sink paths drawn.
22596. **PostMessage-risk heatmap** — pages colored by insecure postMessage handlers and origin-validation gaps.
22597. **Service-worker risk map** — registered workers colored by scope-hijack and cache-poison findings.
22598. **Web-cache heatmap** — cache keys and behaviors colored by deception and poisoning findings.
22599. **HTTP/2-specific heatmap** — endpoints colored by request-smuggling and rapid-reset findings.
22600. **HTTP/3/QUIC exposure map** — QUIC-enabled services colored separately as an often-untested surface.
22601. **Heatmap time-lapse** — animates the risk heatmap across hunt history showing hotspots cooling as fixes land.
22602. **Heatmap export for board** — one-click export of any heatmap as a presentation-ready slide with legend and summary.
22603. **Custom heatmap builder** — lets users pick any two dimensions (e.g., CWE × subdomain) to generate their own heatmap.
22604. **Heatmap alert subscriptions** — notifies owners when their service's heatmap cell crosses a risk threshold.

## 7. Trend analysis (22605–22704)

22605. **Vulnerability-class trend chart** — multi-line chart of XSS, SQLi, IDOR, and other counts per month revealing which bug classes are rising or fading.
22606. **Tech-stack risk trend** — tracks average findings per framework version over time to show which stacks are getting safer.
22607. **Seasonal pattern detector** — identifies recurring seasonal spikes (e.g., more findings after holiday code freezes) with statistical confidence.
22608. **Emerging-threat correlator** — cross-references hunt findings with newly published CVEs and exploit-db entries to flag trend alignment.
22609. **Predictive trendline** — forecasts next quarter's expected finding counts per vuln class using historical slopes with confidence bands.
22610. **What-breaks-next predictor** — ranks target components by predicted near-term vulnerability likelihood from trend and change signals.
22611. **Severity trend over time** — stacked area chart of severity mix by month showing whether new bugs are getting more or less severe.
22612. **New-vs-regression trend** — plots genuinely new findings against regressions monthly to separate fresh risk from fix failures.
22613. **Coverage trend line** — average coverage percentage across hunts per month proving testing thoroughness improves.
22614. **MTTR trend by quarter** — quarterly remediation-speed trend with annotations for process changes that moved the needle.
22615. **Hunter duplicate-rate trend** — tracks the hunter's duplicate percentage over time as a skill-maturation signal.
22616. **Payout trend by program** — monthly average payouts per program revealing which programs are getting more or less generous.
22617. **Zero-day-likeness trend** — tracks the share of findings resembling novel techniques versus known patterns over time.
22618. **Exploit-chain length trend** — average chain length per quarter showing whether the agent is finding deeper bugs.
22619. **FP-rate trend** — monthly false-positive rates proving detection precision improves with tuning.
22620. **Time-to-first-finding trend** — warm-up speed trend across months showing agent efficiency gains.
22621. **Findings-per-hunt trend** — average unique findings per hunt over time, adjusted for target size.
22622. **Target-hardening trend** — composite score per target over time showing security posture trajectory.
22623. **New-target onboarding trend** — tracks how quickly new targets reach baseline coverage, measuring process maturity.
22624. **WAF-evasion success trend** — bypass-rate trend showing whether defenses or the agent are winning the arms race.
22625. **Auth-bypass trend** — monthly counts of authentication flaws indicating whether auth code quality is improving.
22626. **Injection-flaw trend** — combined XSS/SQLi/command-injection trend as the classic input-validation health metric.
22627. **Access-control trend** — IDOR and privilege-escalation counts over time measuring authorization maturity.
22628. **Crypto-weakness trend** — tracks weak-crypto findings as libraries and TLS configs get modernized.
22629. **Info-disclosure trend** — verbose-error and leak finding counts showing whether secure-defaults adoption works.
22630. **SSRF trend** — server-side request forgery counts over time, a cloud-era risk barometer.
22631. **Deserialization trend** — unsafe-deserialization findings tracking legacy-code cleanup progress.
22632. **Business-logic trend** — logic-flaw counts revealing whether threat modeling is catching up.
22633. **API-security trend** — API-specific findings (BOLA, mass assignment) trended as API-first development grows.
22634. **Mobile-surface trend** — mobile-app findings over time as the mobile attack surface expands.
22635. **Supply-chain trend** — dependency and third-party findings tracking software-supply-chain risk.
22636. **Cloud-misconfig trend** — S3, IAM, and cloud-config findings showing cloud-hygiene trajectory.
22637. **Container-security trend** — Kubernetes and Docker findings over time as container adoption matures.
22638. **CI/CD-security trend** — pipeline findings tracking DevSecOps maturity.
22639. **IoT-surface trend** — device findings as IoT footprints grow.
22640. **AI-surface trend** — prompt-injection and model-API findings, the newest risk category to watch.
22641. **Subdomain-takeover trend** — dangling-DNS findings showing DNS-hygiene improvement.
22642. **Phishing-surface trend** — lookalike-domain and email-spoofing findings over time.
22643. **Ransomware-readiness trend** — composite of backup, RDP, and patching findings as a readiness proxy.
22644. **Compliance-gap trend** — findings mapped to SOC 2/PCI controls trended for audit readiness.
22645. **Risk-dollars trend** — total estimated dollar-risk per month, the executive trend that matters most.
22646. **Bounty-earned trend** — monthly hunter earnings with moving average and growth rate.
22647. **Cost-per-finding trend** — unit-economics trend proving hunts get cheaper per finding over time.
22648. **Hunt-duration trend** — average hunt length trend showing efficiency gains.
22649. **Probe-efficiency trend** — findings per thousand probes over time, the precision improvement curve.
22650. **Coverage-per-hour trend** — how fast the agent covers new surface, a throughput maturity metric.
22651. **Reopen-rate trend** — fix-quality trend showing whether patches are getting more durable.
22652. **SLA-compliance trend** — monthly SLA hit-rate proving remediation discipline.
22653. **Backlog-size trend** — open-findings count over time, the ultimate are-we-winning chart.
22654. **Mean-finding-age trend** — average days-open trend showing whether old bugs get cleared.
22655. **New-scope velocity trend** — how fast new program scope gets hunted after announcement.
22656. **First-finder-rate trend** — share of findings that were first-to-report, a competitiveness metric.
22657. **Report-acceptance trend** — accepted-versus-rejected report rates over time.
22658. **Critical-density trend** — criticals per hundred findings, watching for severity inflation or real risk shifts.
22659. **Weekend-deployment risk trend** — correlates finding spikes with weekend releases to inform deploy policy.
22660. **Framework-upgrade impact** — annotates trend charts with upgrade events to visualize their security payoff.
22661. **WAF-rule-change impact** — overlays WAF tuning dates on evasion trends to measure rule effectiveness.
22662. **Pen-test vs agent trend** — compares human pen-test finding trends against agent trends for the same targets.
22663. **Bug-bounty vs internal trend** — contrasts externally reported versus internally found trends.
22664. **Industry-event correlator** — overlays major breaches and CVE storms on trends to explain spikes.
22665. **Hiring-impact tracker** — annotates security-hiring dates on remediation trends to show staffing ROI.
22666. **Tooling-change annotations** — marks agent version upgrades on trend lines so improvements are attributable.
22667. **Trend-break detector** — statistically flags when a trend's slope changes significantly, prompting investigation.
22668. **Forecast-accuracy tracker** — compares past predictions against actuals to calibrate the forecasting model.
22669. **Anomaly-adjusted trends** — recomputes trends excluding one-off incidents so the underlying direction is clear.
22670. **Cohort trend analysis** — groups targets by onboarding quarter and compares their hardening trajectories.
22671. **Vuln-class lifecycle chart** — shows each bug class moving through emerging, peaking, and declining phases.
22672. **Technology-adoption risk curve** — plots finding rates against months-since-adoption for new frameworks.
22673. **Deprecation-risk timeline** — forecasts risk spikes as components approach end-of-life dates.
22674. **Threat-intel fusion trend** — merges hunt data with threat-intel feeds to trend exploited-in-the-wild overlap.
22675. **Attacker-interest proxy** — trends dark-web mentions and scanning activity against own finding trends.
22676. **Patch-lag trend** — tracks days between CVE publication and patch deployment across the estate.
22677. **Exposure-window trend** — average hours a critical finding stays exposed, the trend attackers care about.
22678. **Detection-gap trend** — time between introduction and discovery of flaws, measuring detection maturity.
22679. **Fix-durability trend** — share of fixes still holding after 90 days, the long-view quality metric.
22680. **Security-champion impact** — trends team metrics before and after champion-program rollout.
22681. **Training-effectiveness trend** — correlates developer security-training dates with subsequent finding trends.
22682. **Secure-defaults adoption** — trends the share of new endpoints shipping with security headers and safe configs.
22683. **Code-churn risk trend** — correlates commit velocity with finding rates to find the safe speed of development.
22684. **Microservice-sprawl trend** — tracks service count against findings to quantify sprawl risk.
22685. **API-version-sprawl trend** — counts live API versions over time against version-specific findings.
22686. **Third-party-growth trend** — tracks integration count versus third-party findings.
22687. **Data-growth risk trend** — correlates stored-data volume with PII-exposure findings.
22688. **User-growth attack trend** — plots user-count growth against account-takeover findings.
22689. **Feature-flag risk trend** — tracks flag count versus flag-related findings.
22690. **Experiment-velocity risk** — correlates A/B test volume with logic-flaw findings.
22691. **M&A surface trend** — tracks attack-surface growth from acquisitions and associated findings.
22692. **Cloud-spend vs risk trend** — plots infrastructure spend against misconfiguration findings for efficiency insight.
22693. **Remote-work surface trend** — tracks VPN and remote-access findings since work-from-home expansion.
22694. **Quarterly security review pack** — auto-compiles all trend charts into a board-ready quarterly deck.
22695. **Year-over-year comparator** — aligns this year's monthly metrics against last year's for annual reviews.
22696. **Trend alerting** — subscribes users to alerts when any tracked trend crosses warning thresholds.
22697. **Custom trend builder** — lets users define any metric-versus-time chart from the analytics data model.
22698. **Trend export API** — exposes all time-series data programmatically for data-warehouse ingestion.
22699. **Peer-trend overlay** — overlays anonymized industry trend lines on the user's own for context.
22700. **Executive trend narrative** — auto-writes a plain-language summary of what the trends mean each month.
22701. **Leading-indicator dashboard** — surfaces the metrics that historically predict next-quarter incidents.
22702. **Trend confidence scoring** — grades each trend's statistical reliability so weak signals are not overacted on.
22703. **Multi-target aggregate trends** — rolls up trends across the whole portfolio for enterprise-wide visibility.
22704. **Trend-driven hunt scheduler** — recommends which targets to hunt next based on which trends are worsening.

## 8. Industry benchmarking (22705–22804)

22705. **Anonymized peer benchmark** — compares the user's MTTR, coverage, and finding density against anonymized peers without exposing anyone's data.
22706. **Percentile ranking per metric** — shows the user's percentile (e.g., top 15%) for each KPI against the benchmark pool.
22707. **Best-in-class gap analysis** — quantifies the numeric gap between the user's metrics and top-decile performers with closing recommendations.
22708. **Benchmark by company size** — segments comparisons into startup, mid-market, and enterprise so comparisons stay fair.
22709. **Benchmark by industry vertical** — compares fintech against fintech and SaaS against SaaS for relevant peer groups.
22710. **Coverage percentile** — ranks the user's hunt coverage depth against the industry distribution.
22711. **Finding-density benchmark** — compares findings per thousand endpoints against peers to contextualize results.
22712. **MTTR industry ranking** — places the user's remediation speed on an industry ladder with quartile markers.
22713. **SLA-compliance benchmark** — compares on-time fix rates against peer averages and leaders.
22714. **Reopen-rate benchmark** — shows whether the user's fix quality beats or trails the industry.
22715. **Severity-mix benchmark** — compares the user's severity distribution against typical profiles to spot rating bias.
22716. **Vuln-class prevalence benchmark** — shows which bug classes peers find most, highlighting the user's blind spots.
22717. **Tech-stack risk benchmark** — compares finding rates per framework against industry norms for the same stack.
22718. **Bounty-ROI benchmark** — ranks the hunter's dollars-per-hour against anonymized hunter earnings.
22719. **Duplicate-rate benchmark** — compares first-to-report rates against the hunter community average.
22720. **Report-acceptance benchmark** — places report acceptance rates on an industry scale.
22721. **Time-to-first-finding benchmark** — compares agent warm-up speed against other autonomous hunters.
22722. **Probe-efficiency benchmark** — findings-per-probe ranked against peer agents and human hunters.
22723. **Hunt-cost benchmark** — compares fully-loaded cost per hunt against industry medians.
22724. **Critical-density benchmark** — criticals-per-hunt compared across the benchmark pool.
22725. **Exposure-window benchmark** — compares how long criticals stay exposed versus peers.
22726. **Patch-lag benchmark** — CVE-to-patch speed ranked against industry data.
22727. **Security-header adoption benchmark** — compares header coverage against peer websites.
22728. **TLS-hygiene benchmark** — ranks certificate and cipher configurations against industry scans.
22729. **Subdomain-hygiene benchmark** — compares takeover-risk and DNS hygiene scores with peers.
22730. **API-security benchmark** — BOLA and auth-finding rates compared for API-heavy peers.
22731. **Cloud-misconfig benchmark** — compares cloud-hygiene scores against same-cloud-provider peers.
22732. **Third-party risk benchmark** — integration-risk scores ranked within the industry vertical.
22733. **Phishing-resistance benchmark** — email-auth (SPF/DKIM/DMARC) adoption compared against peers.
22734. **Ransomware-readiness benchmark** — composite readiness score ranked anonymously.
22735. **Compliance-posture benchmark** — control-coverage percentages compared for SOC 2 and ISO peers.
22736. **Risk-dollars benchmark** — estimated dollar-risk per revenue-dollar compared across peers.
22737. **Findings-per-employee** — normalizes finding counts by engineering headcount for fair cross-company comparison.
22738. **Security-spend efficiency** — risk reduced per security dollar, benchmarked anonymously.
22739. **Hunt-frequency benchmark** — compares how often peers re-hunt the same targets.
22740. **Regression-rate benchmark** — compares fix-durability against industry averages.
22741. **Zero-day-readiness benchmark** — compares time-to-assess new CVEs across peers.
22742. **Incident-correlation benchmark** — compares the share of findings that later became incidents.
22743. **Chained-exploit benchmark** — compares exploit-chain discovery rates, a depth-maturity signal.
22744. **Automation-maturity benchmark** — ranks what share of the hunt pipeline is automated versus manual.
22745. **AI-adoption benchmark** — compares autonomous-agent usage maturity across the peer set.
22746. **Coverage-depth benchmark** — compares parameter and auth-state coverage depth, not just endpoint counts.
22747. **Verification-rigor benchmark** — compares PoC and re-test thoroughness scores.
22748. **Report-quality benchmark** — compares report completeness and readability scores.
22749. **Remediation-capacity benchmark** — compares engineer-hours per finding across peers.
22750. **Backlog-health benchmark** — compares open-finding aging profiles.
22751. **WAF-effectiveness benchmark** — compares bypass rates against peers using similar WAFs.
22752. **Auth-maturity benchmark** — compares MFA adoption and session-security scores.
22753. **Secrets-hygiene benchmark** — compares leaked-secret discovery rates in code and configs.
22754. **Dependency-freshness benchmark** — compares outdated-library counts against peers.
22755. **Container-maturity benchmark** — compares Kubernetes hardening scores.
22756. **CI/CD-maturity benchmark** — compares pipeline-security control adoption.
22757. **Data-protection benchmark** — compares PII-exposure finding rates within regulated verticals.
22758. **Mobile-security benchmark** — compares mobile-app finding density for app-heavy peers.
22759. **IoT-security benchmark** — compares device finding rates for hardware companies.
22760. **AI-surface benchmark** — compares prompt-injection and model-API readiness as the newest category.
22761. **Supply-chain benchmark** — compares SBOM adoption and dependency-vetting scores.
22762. **Insider-risk benchmark** — compares privilege-finding rates as an insider-threat proxy.
22763. **DDoS-readiness benchmark** — compares rate-limiting and absorption maturity.
22764. **Backup-resilience benchmark** — compares backup and recovery control scores.
22765. **Log-coverage benchmark** — compares security-event logging completeness.
22766. **Detection-speed benchmark** — compares mean-time-to-detect across peers.
22767. **Threat-intel usage benchmark** — compares intel-integration maturity levels.
22768. **Red-team frequency benchmark** — compares adversarial-testing cadence.
22769. **Tabletop-exercise benchmark** — compares incident-response drill frequency.
22770. **Security-training benchmark** — compares developer-training coverage and effectiveness.
22771. **Champion-program benchmark** — compares security-champion density and impact.
22772. **Policy-maturity benchmark** — compares documented-policy coverage scores.
22773. **Vendor-risk benchmark** — compares third-party assessment rigor.
22774. **M&A-security benchmark** — compares acquisition-integration security speed.
22775. **Benchmark trend over time** — shows the user's percentile movement across quarters, proving improvement.
22776. **Peer-group builder** — lets users define custom peer groups (e.g., Series-B SaaS) for tailored benchmarks.
22777. **Opt-in data contribution** — contributes anonymized metrics to the pool with granular per-metric consent controls.
22778. **Benchmark confidence indicator** — shows sample size behind each benchmark so thin comparisons are flagged.
22779. **Regional benchmark split** — compares against peers in the same regulatory region (EU, US, APAC).
22780. **Growth-stage benchmark** — segments by funding stage since security maturity tracks growth.
22781. **Revenue-normalized benchmark** — normalizes risk and spend metrics by revenue for cross-size fairness.
22782. **Benchmark gap-closure planner** — turns the biggest percentile gaps into a prioritized improvement roadmap.
22783. **Leader interview snippets** — anonymized quotes from top-decile performers on what moved their metrics.
22784. **Benchmark alerting** — notifies when the user drops a quartile on any tracked metric.
22785. **Board-ready benchmark slide** — auto-generates a one-slide percentile summary for board decks.
22786. **Benchmark methodology disclosure** — documents exactly how each benchmark is computed for audit trust.
22787. **Differential-privacy guarantee** — publishes the anonymization technique so contributors trust the pool.
22788. **Benchmark API** — exposes percentile data programmatically for internal dashboards.
22789. **Historical benchmark archive** — stores past industry distributions to show how the bar itself moves.
22790. **Emerging-metric benchmarks** — adds new metrics (e.g., AI-surface) to the pool as categories mature.
22791. **Self-assessment quiz** — maps questionnaire answers to estimated percentiles for teams without full data.
22792. **Benchmark vs budget** — correlates security-budget percentiles with outcome percentiles to find efficient spenders.
22793. **Outperformer playbook** — distills the practices common to top-decile performers into an actionable guide.
22794. **Underperformer risk flag** — warns when metrics sit in the bottom quartile on risk-critical KPIs.
22795. **Benchmark-driven goal setter** — suggests targets like "reach 60th percentile MTTR by Q2" from peer data.
22796. **Industry threat-landscape brief** — pairs benchmark positions with current threat trends for context.
22797. **Peer incident learning** — anonymized incident lessons from peers mapped to the user's own weak metrics.
22798. **Benchmark participation score** — grades data-contribution completeness, encouraging richer pools.
22799. **Cross-vertical comparison** — optionally compares against all verticals to find unexpected best practices.
22800. **Benchmark export pack** — one-click PDF of all percentile charts for auditors and insurers.
22801. **Cyber-insurance benchmark** — compares the metrics insurers actually price on, with premium-impact estimates.
22802. **Regulatory-readiness benchmark** — compares control maturity against peers facing the same regulations.
22803. **Talent benchmark** — compares security-team size and skill mix against peer outcomes.
22804. **Benchmark community forum** — anonymized discussion of how peers closed specific metric gaps.

## 9. Executive KPI cards (22805–22904)

22805. **Security posture score card** — a single 0–100 card blending findings, coverage, MTTR, and hardening trends for one-glance health.
22806. **Risk-in-dollars card** — converts open findings into an estimated dollar exposure figure executives can compare against revenue.
22807. **Board-ready summary card** — a quarterly card with posture score, top risks, and remediation progress formatted for board decks.
22808. **Week-over-week delta card** — shows this week versus last week for findings opened, closed, and risk-dollars with trend arrows.
22809. **Red/amber/green rollup** — rolls every target's status into RAG colors with drill-down to the findings driving each color.
22810. **Open-criticals card** — a prominent count of unresolved critical findings with age and owner, impossible to ignore.
22811. **SLA-at-risk card** — counts findings breaching SLA in the next 7 days with the dollar-risk attached.
22812. **Mean-time-to-remediate card** — the headline MTTR number with quarter-over-quarter delta and industry percentile.
22813. **Coverage-completeness card** — portfolio-wide hunt coverage percentage with the lowest-coverage targets listed.
22814. **Hunt-velocity card** — findings-per-hour this month with trend and top-performing targets.
22815. **Bounty-earned card** — total bounty income this quarter with projection to quarter-end for hunter users.
22816. **Cost-per-finding card** — unit-economics headline showing fully-loaded cost per confirmed finding with trend.
22817. **Backlog-burn card** — open findings count with burndown projection date for zero backlog.
22818. **Fix-verification card** — share of claimed fixes verified this month with reopen-rate context.
22819. **New-vs-regression card** — splits this month's findings into genuinely new versus regressions for honest progress reading.
22820. **Top-5-risks card** — the five highest risk-dollar findings with one-line business impact each.
22821. **Remediation-capacity card** — engineer-days of open work versus available capacity with a staffing verdict.
22822. **Compliance-posture card** — percentage of findings mapped to failing compliance controls, per framework.
22823. **Exposure-window card** — average hours criticals stayed exposed this month with the worst offender named.
22824. **Target-hardening card** — count of targets improving, flat, or worsening in posture score this quarter.
22825. **Third-party-risk card** — open findings in vendor and dependency components with the riskiest vendor named.
22826. **Incident-likelihood card** — model-estimated probability of a material incident in the next 90 days from current exposure.
22827. **Security-ROI card** — dollars of risk removed per security dollar spent this quarter.
22828. **Team-performance card** — fastest and slowest remediating teams with MTTR and SLA compliance side by side.
22829. **Hunt-coverage SLA card** — share of in-scope targets meeting the coverage completeness gate.
22830. **Zero-day-readiness card** — hours to assess and triage the latest critical CVE across the estate.
22831. **Data-exposure card** — count of findings touching PII or payment data with records-at-risk estimate.
22832. **Ransomware-readiness card** — composite readiness score with the three weakest controls listed.
22833. **Phishing-surface card** — lookalike domains and email-auth gaps summarized with takedown status.
22834. **Cloud-hygiene card** — misconfiguration count and trend with the worst-offending cloud account named.
22835. **API-risk card** — API-specific finding counts with the riskiest API product highlighted.
22836. **Mobile-risk card** — mobile-app findings summary for companies with customer-facing apps.
22837. **Insider-risk card** — privilege and access-control findings framed as insider-threat exposure.
22838. **Supply-chain card** — vulnerable-dependency counts with the highest-risk library named.
22839. **AI-surface card** — prompt-injection and model-API findings as the emerging-risk headline.
22840. **Quarterly-goal card** — progress bars for the quarter's security OKRs with projected completion.
22841. **Year-to-date card** — cumulative findings, fixes, risk removed, and bounty earned since January.
22842. **Peer-percentile card** — the company's median percentile across benchmarked metrics in one number.
22843. **Budget-vs-risk card** — security spend plotted against risk-dollars reduced to justify budget asks.
22844. **Headcount-leverage card** — findings fixed per security engineer, showing team productivity.
22845. **Automation-dividend card** — hours saved and extra coverage attributed to autonomous hunting this quarter.
22846. **Board-question anticipator** — predicts the three toughest questions the board will ask from the data and drafts answers.
22847. **One-page executive brief** — auto-generates a single-page narrative summary combining all cards into prose.
22848. **Executive alert digest** — a weekly email with only the cards that changed significantly, respecting executive attention.
22849. **KPI-card customizer** — drag-and-drop builder letting executives choose which cards appear on their dashboard.
22850. **Card drill-down guardrails** — each card links to exactly one evidence view so executives never drown in detail.
22851. **RAG-threshold editor** — lets leadership define what red, amber, and green mean per metric for their risk appetite.
22852. **What-if simulator card** — models how fixing the top 10 findings would move the posture score and risk-dollars.
22853. **Investment-priority card** — ranks proposed security investments by projected risk reduction per dollar.
22854. **M&A-diligence card** — one-card security summary of an acquisition target for deal teams.
22855. **Cyber-insurance card** — the metrics insurers request, packaged with premium-impact estimates.
22856. **Regulator-ready card** — control-effectiveness summary formatted for examiner review.
22857. **Customer-trust card** — public-facing-safe metrics (uptime of fixes, response times) for customer security pages.
22858. **Post-incident card** — after an incident, a card tracking containment, root-cause fixes, and lessons-learned closure.
22859. **Transformation-progress card** — tracks multi-quarter security-program maturity against the roadmap.
22860. **Risk-appetite alignment card** — compares actual risk-dollars against the board's stated risk appetite with variance flags.
22861. **Top-movers card** — the five metrics that moved most this week, up or down, with explanations.
22862. **Quiet-metrics watchdog** — flags important cards that have not changed in 90 days, catching stale or broken measurement.
22863. **Seasonal-context card** — annotates cards with seasonal expectations so holiday dips are not misread.
22864. **Confidence-graded cards** — each card shows a data-confidence badge so leaders know which numbers are solid.
22865. **Narrative-behind-the-number** — every card expands to a two-sentence plain-language explanation of what changed and why.
22866. **Card-sharing links** — generates a secure link for any single card to share with specific stakeholders.
22867. **KPI-card TV mode** — a full-screen rotating display of cards for security operations centers.
22868. **Mobile-executive view** — a phone-optimized card stack so leaders check posture from anywhere.
22869. **Voice-briefing mode** — reads the key cards aloud as a two-minute audio briefing via the avatar voice.
22870. **Card anomaly callouts** — automatically highlights cards deviating from their normal range with a "why" hint.
22871. **Benchmark-context card** — pairs each internal KPI with its industry percentile right on the card.
22872. **Forecast card** — projects each headline KPI to quarter-end with confidence bands.
22873. **Scenario cards** — best/base/worst-case cards showing posture under different investment levels.
22874. **Decision-log card** — records which executive decisions were informed by which cards for accountability.
22875. **Card freshness timestamp** — every card shows exactly when its data was last computed to prevent stale trust.
22876. **Escalation-path card** — for each red card, shows who owns the fix and the next escalation step.
22877. **Cross-portfolio card** — for holding companies, rolls up KPIs across all subsidiaries into one view.
22878. **ESG-security card** — frames security posture for ESG reporting with governance-relevant metrics.
22879. **Talent-risk card** — security-team attrition and hiring gaps framed as a risk metric for the board.
22880. **Vendor-concentration card** — shows risk concentrated in top vendors with single-point-of-failure flags.
22881. **Innovation-velocity card** — balances feature-ship speed against introduced findings for product leaders.
22882. **Customer-impact card** — translates technical findings into affected-customer counts and churn risk.
22883. **Revenue-at-risk card** — estimates revenue exposed by critical findings in payment and checkout flows.
22884. **Brand-risk card** — scores findings by reputational impact (data leaks, defacements) separately from technical severity.
22885. **Legal-exposure card** — flags findings with regulatory-notification implications (GDPR, breach laws).
22886. **Audit-readiness card** — percentage of findings with complete evidence packs ready for auditor review.
22887. **Pen-test-alignment card** — compares agent findings against the last human pen-test for coverage confidence.
22888. **Red-team card** — summarizes adversarial-exercise outcomes alongside hunt metrics.
22889. **Tabletop-readiness card** — incident-response drill scores next to real exposure metrics.
22890. **Security-culture card** — training completion, phishing-click rates, and champion activity as a culture KPI.
22891. **Policy-coverage card** — share of systems covered by current security policies.
22892. **Exception-aging card** — risk acceptances past their review dates, a governance hygiene metric.
22893. **Control-effectiveness card** — per-control-family effectiveness scores from finding and test data.
22894. **Maturity-trajectory card** — plots the security program on a maturity model with quarter-by-quarter movement.
22895. **North-star metric card** — the one metric leadership chose (e.g., risk-dollars) displayed above all others.
22896. **KPI-card changelog** — logs every definition change so historical comparisons stay honest.
22897. **Executive Q&A bot** — lets leaders ask "why did MTTR spike?" and get a data-grounded answer from the cards.
22898. **Card export to slides** — one-click export of selected cards into a PowerPoint-ready deck.
22899. **Scheduled card snapshots** — archives card states weekly for historical board-meeting reconstruction.
22900. **Anonymous peer card** — shows the company's posture score against the anonymized industry median on one card.
22901. **Risk heat by business unit** — RAG colors per product line so leaders see which business carries the risk.
22902. **Security-debt card** — total "security debt" in engineer-days, framed like tech debt for engineering leaders.
22903. **Fix-commitment card** — tracks leadership-committed fix dates against actual delivery for accountability.
22904. **Morning-brief card** — a single card summarizing overnight hunt results, new criticals, and today's priorities.

## 10. Anomaly detection in results (22905–23004)

22905. **Sudden-spike detector** — alerts when a hunt's finding count exceeds three standard deviations above the target's baseline, catching incidents or misconfigurations early.
22906. **Unusual-vuln-class flag** — flags when a vulnerability class never seen on a target suddenly appears, suggesting new code or a new attack path.
22907. **Coverage-drop alert** — notifies when coverage falls significantly versus the previous hunt, catching crawler failures or scope breakage.
22908. **Agent-stuck-loop detector** — identifies when the agent repeats the same probes without progress and auto-suggests a strategy pivot.
22909. **Data-quality anomaly flags** — marks hunts with suspicious metrics (zero probes but findings, impossible velocity) for review.
22910. **Finding-duplication burst** — alerts when duplicate findings spike, indicating the agent is re-treading covered ground.
22911. **Severity-inflation detector** — flags when average severity jumps without new criticals, catching scoring drift.
22912. **Silent-target alarm** — triggers when a normally productive target yields zero findings, distinguishing hardened from broken hunts.
22913. **Probe-failure surge** — alerts on sudden jumps in timed-out or blocked probes, signaling WAF changes or target instability.
22914. **Auth-session anomaly** — detects when authenticated coverage collapses mid-hunt, usually an expired token needing refresh.
22915. **Response-time anomaly** — flags endpoints whose latency changed dramatically, hinting at backend changes or throttling.
22916. **Status-code flip detector** — alerts when endpoints start returning different status codes than baseline, catching deploys or breakage.
22917. **New-endpoint surge** — notifies when discovered endpoint counts jump, usually a major release or scope expansion.
22918. **Disappearing-endpoint alert** — flags when previously tested endpoints vanish, distinguishing deprecation from outage.
22919. **Header-change detector** — alerts on sudden security-header additions or removals across the target.
22920. **TLS-change monitor** — flags certificate swaps, cipher changes, or new TLS errors between hunts.
22921. **DNS-change anomaly** — detects unexpected DNS record changes that could indicate hijack or migration.
22922. **WAF-behavior shift** — alerts when block patterns change, suggesting new rules or a WAF swap.
22923. **Rate-limit change detector** — flags when throttling thresholds move, affecting hunt planning.
22924. **Content-change anomaly** — alerts on dramatic page-content changes on sensitive endpoints (login, payment).
22925. **JS-bundle anomaly** — flags unusually large or entirely new JavaScript bundles that may hide new attack surface.
22926. **API-schema drift alert** — detects GraphQL or OpenAPI schema changes that invalidate prior coverage.
22927. **Parameter-appearance anomaly** — flags brand-new parameters on old endpoints, prime spots for fresh bugs.
22928. **Cookie-behavior anomaly** — alerts when session cookie attributes or names change unexpectedly.
22929. **Redirect-behavior shift** — flags altered redirect chains that may signal open-redirect or auth-flow changes.
22930. **Error-rate anomaly** — alerts when 5xx rates spike during a hunt, distinguishing target instability from agent-caused errors.
22931. **FP-rate anomaly** — flags sudden false-positive jumps, usually a broken detection rule needing tuning.
22932. **Verification-failure cluster** — alerts when many re-tests fail at once, suggesting environment or credential issues.
22933. **PoC-breakage detector** — flags when previously working PoCs stop working without a recorded fix.
22934. **Chain-break anomaly** — alerts when established exploit chains break, indicating partial remediation.
22935. **Credential-decay detector** — flags when a credential's effectiveness drops across hunts, signaling expiry or rotation.
22936. **Out-of-scope probe alerter** — alerts when the agent tests out-of-scope hosts, an authorization safety issue.
22937. **Traffic-volume anomaly** — flags hunts generating far more or fewer requests than planned, catching runaway loops.
22938. **Bandwidth-spike alert** — notifies on unusual data-transfer volumes that could indicate aggressive or stuck behavior.
22939. **Cost-overrun anomaly** — alerts when hunt spend deviates sharply from the estimate for its coverage level.
22940. **Duration anomaly** — flags hunts running far longer or shorter than the target's norm.
22941. **Midnight-activity flag** — highlights hunts with unusual activity timing that may indicate scheduling bugs.
22942. **Concurrent-hunt interference** — detects when parallel hunts degrade each other's velocity or trigger target defenses.
22943. **Egress-IP block detector** — flags when an outbound IP starts getting blocked, suggesting target-side blacklisting.
22944. **Captcha-appearance alert** — notifies when CAPTCHAs suddenly appear, blocking automated coverage.
22945. **Honeypot-suspicion flag** — warns when responses look deliberately deceptive, suggesting the agent hit a honeypot.
22946. **Tarpit detector** — identifies intentionally slow responses designed to stall scanners.
22947. **Clock-skew anomaly** — flags timestamp inconsistencies in responses that may indicate proxying or replay.
22948. **Geo-fencing change** — alerts when content varies by region differently than before, catching new geo-restrictions.
22949. **Language-mix anomaly** — flags unexpected language changes in responses hinting at backend swaps.
22950. **Duplicate-content surge** — alerts when many endpoints return identical content, suggesting a broken deploy or wildcard.
22951. **Empty-response anomaly** — flags endpoints that suddenly return empty bodies, possibly a broken API version.
22952. **Oversized-response alert** — notifies on responses far larger than baseline, potential data-leak indicators.
22953. **Encoding-change detector** — flags unexpected charset or encoding shifts that may hide injection contexts.
22954. **Compression-behavior shift** — alerts when compression handling changes, relevant for BREACH-style analysis.
22955. **HTTP-version anomaly** — flags protocol downgrades or upgrades across the target.
22956. **Port-change detector** — alerts on newly opened or closed ports between hunts.
22957. **Banner-change monitor** — flags server-banner changes indicating stack swaps.
22958. **Subdomain-appearance burst** — alerts on many new subdomains at once, usually infrastructure expansion.
22959. **Certificate-transparency surge** — notifies on spikes in new certificates for the target's domains.
22960. **Takeover-risk emergence** — flags newly dangling DNS records as they appear, before attackers notice.
22961. **Secret-appearance alert** — notifies when new leaked secrets show up in JS bundles or responses.
22962. **PII-appearance anomaly** — flags endpoints that newly start returning personal data.
22963. **Payment-flow change** — alerts on structural changes to checkout flows that need re-testing.
22964. **Auth-flow change** — flags login or SSO flow modifications that may introduce fresh flaws.
22965. **Permission-change detector** — alerts when role capabilities shift, catching privilege-model changes.
22966. **Feature-flag flip monitor** — notifies when dark-launch features suddenly go live, expanding the surface.
22967. **A/B-test surface alert** — flags new experiment variants that create untested code paths.
22968. **Third-party-script surge** — alerts on newly added external scripts, a supply-chain risk signal.
22969. **Iframe-appearance anomaly** — flags new embedded frames that may introduce clickjacking or data-sharing risk.
22970. **Webhook-endpoint emergence** — notifies on newly discovered inbound webhooks needing signature checks.
22971. **Admin-panel exposure alert** — fires when admin interfaces become reachable that were previously hidden.
22972. **Debug-mode detector** — flags stack traces or debug pages appearing where they were absent before.
22973. **Backup-file emergence** — alerts on newly discoverable backup or config files.
22974. **Directory-listing flip** — flags listings that newly appear on previously closed directories.
22975. **CORS-policy loosening** — alerts when CORS headers become more permissive between hunts.
22976. **CSP-weakening detector** — flags content-security-policy downgrades that reopen XSS avenues.
22977. **HSTS-removal alert** — notifies if strict-transport-security disappears, a downgrade-attack enabler.
22978. **Cookie-flag regression** — flags Secure or HttpOnly flags disappearing from session cookies.
22979. **MFA-bypass emergence** — alerts when second-factor enforcement appears weakened on tested flows.
22980. **Password-policy relaxation** — flags weakened password rules detected during auth testing.
22981. **Session-timeout change** — alerts on dramatically longer session lifetimes, an increased hijack window.
22982. **API-version resurrection** — flags deprecated API versions becoming reachable again.
22983. **Legacy-protocol reappearance** — alerts when old TLS versions or protocols return after being disabled.
22984. **Anomaly correlation engine** — groups related anomalies into single incidents so one deploy does not fire twenty alerts.
22985. **Anomaly severity auto-grading** — scores each anomaly by likely security impact so critical ones page and minor ones digest.
22986. **Baseline auto-relearn** — rebuilds anomaly baselines after confirmed legitimate changes so alerts stay relevant.
22987. **Anomaly false-alarm feedback** — learns from dismissed anomalies to reduce noise on the same pattern.
22988. **Anomaly digest mode** — batches low-severity anomalies into a daily summary instead of instant alerts.
22989. **Anomaly-to-hunt trigger** — auto-launches a focused hunt when a high-severity anomaly is detected.
22990. **Anomaly evidence pack** — attaches before/after request-response pairs to every anomaly for quick verification.
22991. **Cross-target anomaly** — flags when the same anomaly pattern hits multiple targets, suggesting a shared-platform issue.
22992. **Anomaly timeline view** — plots all anomalies on the hunt timeline to correlate them with finding spikes.
22993. **Anomaly watchlist** — lets users pin specific anomaly types for instant alerts on critical targets.
22994. **Anomaly API webhooks** — pushes anomaly events to external SIEMs and incident-response tools in real time.
22995. **Seasonality-aware detection** — adjusts anomaly thresholds for known seasonal patterns to cut false positives.
22996. **Multi-signal anomaly fusion** — combines weak signals (latency + headers + status) into strong anomaly verdicts.
22997. **Anomaly root-cause hints** — suggests the most likely cause (deploy, WAF, outage) for each anomaly from correlated signals.
22998. **Anomaly confidence score** — attaches a 0–100 confidence to every anomaly so users triage by certainty.
22999. **Quiet-period anomaly** — specifically flags unusual silence (no findings, no errors) as its own anomaly class.
23000. **Anomaly retro-hunt** — re-analyzes stored hunt data with new detection rules to find anomalies that were missed live.
23001. **Anomaly benchmarking** — compares anomaly rates against peers to distinguish target instability from agent issues.
23002. **Anomaly-driven coverage** — auto-expands coverage targets when anomalies suggest untested new surface.
23003. **Anomaly SLA** — gives security-relevant anomalies their own response-time SLA with escalation.
23004. **Anomaly health dashboard** — a single view of anomaly counts, severities, resolutions, and false-alarm rates over time.
