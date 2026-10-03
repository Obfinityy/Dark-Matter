# Part 06 — Stealth & safety (45005–46004)

45005. **429-driven exponential backoff** — When a target returns HTTP 429, the agent doubles the inter-request delay per endpoint instead of retrying at fixed speed.
45006. **Retry-After header honoring** — The scheduler parses `Retry-After` (seconds or HTTP date) on every 429/503 and suspends that endpoint until the timestamp passes.
45007. **Per-endpoint rate learning** — The agent records the request-per-second threshold that triggered the first 429 on each path and caps future traffic at 70% of that value.
45008. **X-RateLimit quota tracking** — The agent reads `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers and stops a module before the quota hits zero.
45009. **Gentle-by-default profile** — Every hunt starts on the conservative profile (≤2 req/s per host) and escalates only after operator approval or explicit config.
45010. **Business-hours traffic reduction** — The scheduler detects the target's local timezone and halves request rates during 9:00–17:00 local weekdays.
45011. **Aggressive-profile consent gate** — Switching to the aggressive profile requires an explicit operator checkbox acknowledging higher target load.
45012. **Latency-gradient throttling** — If median response latency rises 50% over a rolling baseline, the agent proportionally reduces concurrency.
45013. **Error-rate-triggered slowdown** — A rolling 5xx rate above 2% pauses new request issuance and halves the queue until errors subside.
45014. **Token-bucket request governor** — Each target gets a token bucket refilled at a configurable rate; no request leaves without a token.
45015. **Adaptive concurrency ladder** — Concurrency steps up one worker at a time and steps back three on any timeout, 429, or 5xx.
45016. **Request jitter injection** — Randomizes inter-request delays by ±40% to avoid mechanical traffic patterns that stress rate-limit windows.
45017. **Endpoint heat-map pacing** — The agent builds a per-path request heat map and avoids hammering any single endpoint more than 10× its median.
45018. **Global hunt request ceiling** — A per-hunt cap on total requests (default 50,000) stops runaway loops from overloading a small target.
45019. **Per-host request ceiling** — Caps requests per discovered host so a sprawling subdomain list cannot concentrate traffic on one weak server.
45020. **Cooldown queue for hot endpoints** — Endpoints that recently errored move to a cooldown queue retried no more than once per 5 minutes.
45021. **Canary request calibration** — Each phase opens with 5 slow canary requests; if p99 latency exceeds 3s, the phase stays at minimum speed.
45022. **Burst guard limiter** — Prevents more than 10 requests within any 1-second window per host regardless of queue depth.
45023. **Module-level rate budgets** — Recon, fuzzing, and exploitation modules each receive a share of the total request budget, preventing one module from starving the target.
45024. **Queue-depth backpressure** — When the outbound queue exceeds 500 pending requests, the planner stops generating new work until the queue drains.
45025. **Sleep intervals between phases** — The agent inserts a configurable quiet gap (default 60s) between major hunt phases to let the target recover.
45026. **Weekend traffic profile** — Detects Saturday/Sunday in the target's timezone and applies a gentler default on days ops teams are thin.
45027. **API-vs-web rate differentiation** — API endpoints get stricter limits (learned from docs or 429s) than static web pages.
45028. **GraphQL cost-aware throttling** — Estimates query complexity from the schema and throttles expensive nested queries harder than simple ones.
45029. **WebSocket message pacing** — Limits outbound WebSocket frames per second and reconnect attempts to avoid connection churn.
45030. **Auth-endpoint sensitivity mode** — Login and token endpoints run at ≤1 req/s with mandatory jitter to avoid account-lockout storms.
45031. **Password-reset rate cap** — Caps password-reset triggers at 1 per 10 minutes per account to prevent email flooding.
45032. **Email-trigger suppression** — The agent avoids actions that send outbound email (signup, invite, notify) unless the target is a designated test account.
45033. **Notification-storm prevention** — Webhook and notification endpoints are never fuzzed at volume; only single crafted requests are allowed.
45034. **CDN-vs-origin pacing split** — Requests that resolve to origin IPs (bypassing CDN) run at half speed since they hit backend capacity directly.
45035. **Shared rate budget across modules** — All parallel modules draw from one target-wide budget so concurrent modules cannot double the effective rate.
45036. **Per-ASN capacity awareness** — When multiple target hosts share an ASN/datacenter, their budgets are pooled to respect shared infrastructure.
45037. **Time-of-day request scheduler** — High-volume fuzzing is scheduled for the target's detected low-traffic hours by default.
45038. **Holiday blackout awareness** — The agent checks a public-holiday calendar for the target's country and pauses aggressive phases on those dates.
45039. **Maintenance-window detection** — A 503 with a maintenance page or `Retry-After` over 1 hour pauses the hunt until the window ends.
45040. **Traffic-spike auto-pause** — If third-party uptime signals or response degradation suggest a live traffic spike, the hunt pauses automatically.
45041. **Slow-start ramp per host** — Every newly discovered host begins at 1 req/s for the first 60 requests before any ramp-up.
45042. **Dynamic inter-request delay** — Delay adapts in real time from the last 20 response times instead of using a fixed sleep.
45043. **Concurrent-hunt rate sharing** — When two hunts target the same organization, their schedulers share one rate budget via a lock file.
45044. **Operator rate-override audit** — Any manual rate increase is logged with operator identity, reason, and timestamp for the audit trail.
45045. **Rate-limit learning persistence** — Learned per-endpoint thresholds are saved per target so future hunts start from known-safe rates.
45046. **Stale rate-profile expiry** — Saved rate profiles older than 90 days are discarded and re-learned, since infrastructure may have changed.
45047. **Polite crawler delays** — Standard crawling respects `Crawl-delay` directives from robots.txt on in-scope hosts.
45048. **Sitemap-guided breadth-first crawl** — Uses sitemaps to crawl efficiently with fewer requests instead of brute-force discovery.
45049. **Conditional-request usage** — Sends `If-Modified-Since`/`ETag` headers on repeat fetches so unchanged pages cost the target a 304, not a full render.
45050. **HEAD-before-GET probing** — Uses HEAD requests to check resource existence before committing to full GET downloads.
45051. **Range-request sampling** — Downloads only the first bytes of large files via Range headers when checking for exposed content.
45052. **Response-size abort** — Stops downloading a response body above a size threshold to avoid saturating target or agent bandwidth.
45053. **Compression negotiation** — Requests gzip/brotli on every fetch to reduce bytes served by the target.
45054. **Connection reuse pooling** — Keeps HTTP connections alive across requests to avoid TCP/TLS handshake storms on the target.
45055. **HTTP/2 multiplexing preference** — Prefers HTTP/2 where offered so many requests share one connection instead of many.
45056. **DNS query minimization** — Caches DNS resolutions for the hunt duration to avoid hammering resolvers with repeat lookups.
45057. **Parallel-host load spreading** — Distributes concurrent requests across discovered hosts rather than serializing on one.
45058. **Low-priority queue for bulk scans** — Directory and parameter brute-forcing runs in a low-priority queue that yields to interactive-phase traffic.
45059. **Wordlist-size governor** — Large wordlists are chunked and each chunk requires the rate governor's approval before dispatch.
45060. **Recursive-scan depth limiter** — Caps crawl depth and per-directory file counts to prevent exponential request blowups.
45061. **Duplicate-request deduplication** — The scheduler drops identical (method, URL, body-hash) requests already sent in the hunt.
45062. **Redirect-chain request accounting** — Follows at most 3 redirects and counts each hop against the rate budget.
45063. **Session-creation minimization** — Reuses authenticated sessions instead of re-logging-in for every module.
45064. **Logout hygiene** — Explicitly logs out test sessions at hunt end so stale sessions don't consume server resources.
45065. **Database-query cost estimation** — For endpoints with observable query patterns, the agent prefers filters that minimize backend query cost.
45066. **Search-endpoint result capping** — Search and listing fuzzing requests small page sizes to avoid expensive full-table scans.
45067. **Export-endpoint avoidance** — CSV/PDF export and bulk-download endpoints are excluded from volume testing by default.
45068. **Report-generation endpoint guard** — Endpoints that trigger server-side report generation are limited to single requests with long timeouts.
45069. **File-upload size restraint** — Upload tests use the smallest file that proves the vulnerability class, never multi-megabyte payloads.
45070. **Image-processing endpoint care** — Image upload/resize endpoints get tiny test images to avoid CPU-intensive processing loops.
45071. **PDF-generation endpoint care** — Never feeds large inputs to PDF renderers; uses minimal templates for proof-of-concept.
45072. **Video-transcode avoidance** — Media transcoding endpoints are excluded from fuzzing due to extreme CPU cost per request.
45073. **SMS/OTP trigger blocking** — The agent never triggers real SMS or voice OTP sends; it uses test-mode bypasses or skips.
45074. **Payment-endpoint dry-run only** — Payment flows are tested in sandbox/test mode; live charges are never attempted.
45075. **Third-party API call minimization** — When the target calls external APIs (maps, payments), the agent minimizes requests that incur the target costs.
45076. **Webhook-outbound suppression** — Avoids actions that make the target fire webhooks to third parties at volume.
45077. **Cache-friendly request ordering** — Groups identical-parameter requests so CDN caching absorbs repeats.
45078. **Idempotent-method preference** — Prefers GET/HEAD/OPTIONS for discovery so repeated requests have no side effects.
45079. **Safe-method-only recon** — The recon phase uses only safe HTTP methods; unsafe methods are gated to later phases with approval.
45080. **OPTIONS-based capability mapping** — Uses OPTIONS responses to map allowed methods instead of probing each method with real requests.
45081. **Rate-profile per program tier** — Free-tier targets on shared hosting get stricter defaults than enterprise programs.
45082. **Small-site extra care mode** — When the target appears to be a small business site (shared hosting signals), rates drop to 1 req/2s.
45083. **Government-site restraint** — Public-sector targets run at the gentlest profile with business-hours-only scheduling by default.
45084. **Healthcare-target caution** — Health-related targets get reduced rates and a mandatory safety review before any active phase.
45085. **CDN cache-buster avoidance** — The agent does not append random cache-busters at volume, which would defeat CDN protection.
45086. **Origin-exposure rate reduction** — If an origin IP is discovered, direct-origin requests run at 25% of the CDN-facing rate.
45087. **Multi-region target awareness** — For geo-distributed targets, the agent paces per region to avoid concentrating on one PoP.
45088. **IPv6/IPv4 dual pacing** — Dual-stack hosts share one budget across both address families.
45089. **Subdomain enumeration throttling** — DNS brute-forcing is capped and prefers certificate-transparency and passive sources first.
45090. **Passive-first discovery** — Exhausts passive sources (CT logs, search, archives) before any active enumeration.
45091. **Active enumeration volume caps** — Active subdomain/DNS enumeration is capped at a per-hunt wordlist budget.
45092. **Port-scan rate shaping** — Port scans run at ≤10 ports/second with randomized order to avoid IDS-triggered blocks.
45093. **Service-banner grab limits** — Banner grabbing sends one probe per port, not protocol-negotiation floods.
45094. **Vulnerability-scan plugin pacing** — Each scanner plugin gets a per-minute request quota within the global budget.
45095. **Exploit-verification single-shot** — Proof-of-concept verification sends exactly one crafted request, then stops to assess.
45096. **Retest request minimization** — Remediation retests reuse prior evidence and send the minimum requests to confirm the fix.
45097. **Mid-hunt chat responsiveness** — The scheduler reserves headroom so operator chat queries never queue behind bulk traffic.
45098. **Emergency stop latency** — The stop signal propagates to all workers within 2 seconds, draining in-flight requests safely.
45099. **Graceful queue drain on pause** — Pausing finishes in-flight requests but cancels queued ones, never abandoning half-open connections.
45100. **Rate-violation self-report** — If the agent detects it exceeded a learned threshold, it logs a rate-violation incident and backs off.
45101. **Per-finding request accounting** — Every reported finding lists the exact request count used to discover and verify it.
45102. **Request-count safety badge** — The hunt summary shows total requests vs. budget with a green/amber/red safety indicator.
45103. **Target-load post-hunt survey** — After each hunt the agent records observed target behavior to refine the next hunt's starting rates.
45104. **Rate-control configuration export** — The full rate profile used in a hunt is exported with the audit package for program-owner review.
45105. **WAF presence detection for accuracy** — The agent detects WAF indicators (headers, block pages, challenge scripts) solely to label findings, never to craft bypasses.
45106. **Block-vs-absence classifier** — A response classifier distinguishes WAF blocks (403 with vendor page) from genuine 404s to avoid false-negative conclusions.
45107. **WAF block-event logging** — Every detected block is logged with timestamp, payload hash, and rule hint for transparency.
45108. **Vendor block-page fingerprint catalog** — A local catalog of WAF block-page fingerprints labels which product blocked the request in reports.
45109. **Block-signature header reader** — Reads headers like `cf-ray`, `x-sucuri-id`, or `server` to attribute blocks without probing further.
45110. **False-negative risk flagging** — Findings marked "not vulnerable" on WAF-protected endpoints carry a flag noting that WAF masking may hide the true state, with retest advised.
45111. **WAF interference score** — Each finding gets a 0–100 score of how likely WAF interference affected the test outcome.
45112. **Per-endpoint WAF coverage map** — The agent maps which endpoints sit behind the WAF and which are directly exposed, and reports the gap.
45113. **Block-rate monitor** — If blocks exceed 10% of requests in a phase, the agent slows down and notifies the operator instead of pushing harder.
45114. **Challenge-page detector (safety)** — JavaScript challenges and CAPTCHAs are detected; the module pauses and reports rather than attempting to solve them.
45115. **Rate-limit vs signature-block distinguisher** — The agent tells 429-style throttling apart from signature-based 403 blocks to choose the right safe response.
45116. **WAF learning-mode detection** — Detects when a WAF appears to be in monitoring-only mode (alerts logged, requests pass) and notes it in the report.
45117. **Transparent block reporting** — The final report includes a dedicated "WAF interactions" section listing every block event.
45118. **Blocked-payload hash ledger** — Stores hashes (not full payloads) of blocked requests so program owners can correlate with their WAF logs.
45119. **Safe retest-after-block** — After a block, the agent waits a full cooldown before one careful retest at lower intensity, then stops.
45120. **No-bypass policy enforcement** — The agent is hard-coded to never mutate payloads specifically to evade a detected WAF signature.
45121. **Payload-intensity reducer** — On WAF-protected endpoints, the agent reduces payload aggressiveness and documents the limitation.
45122. **WAF-change detection mid-hunt** — If block patterns change mid-hunt (new vendor, new rules), the agent re-baselines and alerts the operator.
45123. **Honeypot endpoint detector** — Endpoints that behave like honeypots (instant blocks, tarpits) are flagged, avoided, and logged.
45124. **Tarpit response handler** — Abnormally slow defensive responses trigger an immediate backoff and a "possible tarpit" note.
45125. **IP-reputation block handler** — If the agent's IP gets blocked, it stops the hunt and reports instead of switching identities.
45126. **No identity-rotation rule** — The agent never rotates IPs, user agents, or fingerprints to dodge a block; blocks are treated as stop signals.
45127. **Block-notification template** — A ready-to-send note informs the program owner which of their WAF rules fired during testing.
45128. **WAF allowlist request helper** — Drafts a professional allowlist request (agent IP, test window, contact) for the program owner to approve.
45129. **Pre-hunt WAF disclosure check** — Before testing, the agent checks program policy for WAF testing rules and configures behavior accordingly.
45130. **WAF-safe test planning** — The planner preferentially schedules tests on endpoints with the least WAF interference first for clean baselines.
45131. **Baseline-without-WAF request** — Where the program provides a WAF-bypass test token, the agent uses it only via the documented mechanism.
45132. **Header-based WAF identification** — Identifies WAF presence from response headers alone, avoiding any probe designed to trigger rules.
45133. **DNS-based WAF identification** — Uses CNAME/DNS records (e.g., CDN hostnames) to infer protection without sending test payloads.
45134. **Certificate-based WAF inference** — Reads certificate issuer/organization fields as a passive WAF/CDN signal.
45135. **ASN-based protection inference** — Maps target IPs to known WAF/CDN ASNs passively before any active request.
45136. ** robots.txt WAF hints** — Parses robots.txt and security.txt for stated WAF or testing policies.
45137. **Security.txt testing policy reader** — Reads `/.well-known/security.txt` for contact and testing-scope directives and obeys them.
45138. **Block-page language catalog** — Multilingual block-page fingerprints prevent misclassifying foreign-language blocks as errors.
45139. **Soft-block detector** — Detects silent blocks (200 OK with empty/blocked content) that masquerade as successful responses.
45140. **Redirect-to-block detector** — Flags redirects to block or challenge pages as WAF interference, not navigation.
45141. **Content-length anomaly flag** — Sudden uniform response sizes across varied payloads are flagged as likely WAF templating.
45142. **Timing-based block inference** — Consistent fast rejections (vs. normal latency) are logged as probable WAF-edge blocks.
45143. **WAF rule-ID extraction** — Where block pages expose rule IDs, they are captured to help the program owner tune rules.
45144. **False-positive block appeal draft** — Drafts a note to the program owner when legitimate test traffic appears wrongly blocked.
45145. **WAF coverage gap reporter** — Reports endpoints that unexpectedly lack WAF protection as informational findings for the owner.
45146. **API-gateway block differentiation** — Distinguishes API-gateway policy blocks from WAF blocks for accurate reporting.
45147. **Bot-management detection** — Detects bot-management layers and pauses automated phases, reporting the limitation.
45148. **DDoS-protection respect mode** — On targets with always-on DDoS protection, the agent keeps traffic well under published thresholds.
45149. **Under-attack-mode detector** — Detects "under attack" interstitial pages and suspends the hunt until they clear.
45150. **WAF incident timeline** — Builds a timeline of all WAF interactions for the audit package.
45151. **Operator WAF override log** — Any operator instruction to continue despite blocks is logged with explicit acknowledgment.
45152. **Program-owner WAF coordination** — Suggests scheduling a coordinated test window with the WAF team for deeper coverage.
45153. **WAF-evasion attempt detector (self)** — The agent monitors its own payload mutations and flags any that look like evasion attempts for review.
45154. **Evasion-pattern denylist** — Known evasion encodings are blocked from the payload generator when a WAF is detected.
45155. **Transparent limitation statement** — Every report states plainly which areas could not be tested due to WAF interference.
45156. **Retest recommendation engine** — For WAF-masked areas, the agent recommends specific retest conditions (allowlisted window, rule disabled).
45157. **WAF-bypass token hygiene** — Test tokens provided by programs are used only within the agreed window and never shared or logged in plaintext.
45158. **Multi-WAF stack mapper** — Identifies layered protections (CDN + WAF + gateway) and reports each layer's observed behavior.
45159. **Geo-block awareness** — Detects geo-based blocks and reports them as coverage limitations rather than probing from other regions.
45160. **WAF log-correlation export** — Exports timestamped block events in a format the program owner can join against their WAF logs.
45161. **Block-event severity tagging** — Each block is tagged informational/warning/critical based on whether it halted a test phase.
45162. **WAF rule-change alert** — New block signatures appearing mid-hunt trigger an operator alert and a coverage re-plan.
45163. **Safe-mode finding confidence** — Findings from WAF-protected areas carry calibrated confidence levels, never overstated.
45164. **WAF-transparent PoC notes** — Proof-of-concept writeups note exactly which WAF interactions occurred during verification.
45165. **Program WAF policy quiz** — Before the hunt, the agent summarizes the program's WAF rules back to the operator for confirmation.
45166. **WAF testing consent record** — The operator's acknowledgment of WAF testing boundaries is stored with the hunt record.
45167. **Block-driven phase skip** — If an entire phase's endpoints are blocked, the agent skips it cleanly and reallocates budget elsewhere.
45168. **WAF-induced timeout handling** — Timeouts that correlate with WAF presence are classified as interference, not target failure.
45169. **Connection-reset classifier** — Distinguishes WAF RST behavior from genuine server errors for accurate diagnostics.
45170. **TLS-fingerprint block inference** — Passive TLS handshake observations help attribute edge blocks without extra probes.
45171. **WAF vendor advisory links** — Reports link to the vendor's own testing guidance so owners can validate safely.
45172. **Coordinated WAF-tuning proposal** — Drafts a proposal for the owner to temporarily tune specific rules during a retest window.
45173. **WAF false-negative disclaimer** — The report's methodology section discloses that WAFs can mask vulnerabilities.
45174. **Block-pattern trend chart** — Visualizes block events over the hunt timeline in the safety dashboard.
45175. **Per-rule block attribution** — Where identifiable, blocks are attributed to specific rule categories for owner actionability.
45176. **WAF-interaction operator digest** — Sends the operator a periodic summary of WAF interactions instead of per-event noise.
45177. **Safe harbor WAF clause check** — Verifies the program's safe-harbor language covers WAF-triggering test traffic before starting.
45178. **WAF-triggered auto-pause** — A configurable threshold of blocks per minute auto-pauses the hunt for operator review.
45179. **Post-block cooldown timer** — After any block, the affected endpoint cools down for a program-configurable period.
45180. **WAF-aware scheduling** — Block-prone endpoints are scheduled during agreed testing windows to reduce operational noise.
45181. **Defense-in-depth respect note** — The report acknowledges the WAF as a valid layer and frames findings as defense-in-depth improvements.
45182. **WAF configuration review offer** — Offers the owner an optional WAF rule-review add-on based purely on observed block data.
45183. **No-WAF-assumption default** — The agent never assumes a WAF exists; it verifies presence before applying WAF-aware logic.
45184. **WAF-detection evidence pack** — Each WAF determination includes the headers, pages, or DNS records that evidenced it.
45185. **Cross-hunt WAF memory** — WAF fingerprints learned on a target persist to future hunts for faster, quieter baselining.
45186. **WAF-fingerprint expiry** — Stored WAF fingerprints expire after 60 days since protections change frequently.
45187. **Shared WAF intelligence (opt-in)** — Anonymized WAF fingerprints can be shared across the user's hunts to reduce redundant detection traffic.
45188. **WAF-safe wordlist selection** — On WAF-protected targets, the agent prefers smaller, high-signal wordlists to reduce block noise.
45189. **Block-aware finding deduplication** — Findings are not duplicated across blocked and unblocked variants of the same test.
45190. **WAF-interaction cost accounting** — Blocked requests still count against the rate budget, discouraging block-generating patterns.
45191. **Operator block-threshold tuning** — Operators can tune block thresholds per program with changes logged to the audit trail.
45192. **WAF-transparency API** — A hunt API endpoint exposes live WAF interaction data for external monitoring dashboards.
45193. **WAF-event webhook** — Critical block events can trigger a webhook to the operator's incident channel.
45194. **Program-owner block summary email** — A concise post-hunt email summarizes WAF interactions for the program owner.
45195. **WAF-testing ethics checklist** — A pre-hunt checklist confirms WAF testing stays within authorized, transparent bounds.
45196. **Third-party WAF notification** — When a third-party WAF (not the target's) blocks traffic, the agent logs and routes around without probing it.
45197. **CDN edge-block handling** — Edge blocks are treated as hard stops for that path, not as invitations to try alternate routes.
45198. **WAF-bypass attempt alarm** — Any payload that appears designed to bypass a known WAF signature triggers an internal policy alarm.
45199. **WAF policy version pinning** — The agent records the observed WAF behavior version so retests compare against the same baseline.
45200. **WAF-interaction retention policy** — Block logs are retained per program policy, then securely deleted.
45201. **WAF-safe default payloads** — The default payload set avoids known WAF-triggering patterns to keep testing signal clean.
45202. **Block-event correlation IDs** — Each block gets a correlation ID shared with the operator for program-owner follow-up.
45203. **WAF-coverage confidence meter** — The dashboard shows how much of the attack surface was actually testable given WAF interference.
45204. **WAF transparency score** — A per-hunt metric scoring how completely WAF interactions were detected, logged, and reported.
45205. **Pre-send scope gate** — Every outbound request is checked against the parsed scope rules milliseconds before sending; out-of-scope requests are dropped and logged.
45206. **Scope-rule compiler** — Converts program scope text into an enforceable allow/deny rule set loaded into the request pipeline.
45207. **Out-of-scope URL blocker** — A middleware layer blocks any URL whose host, path, or port falls outside parsed scope, with a violation event emitted.
45208. **Scope-violation alarm** — Any blocked out-of-scope attempt raises an immediate operator-visible alarm with the offending URL and rule.
45209. **Wildcard-boundary enforcer** — For `*.target.com` scope, the enforcer permits subdomains of the apex but rejects sibling or parent domains.
45210. **Apex-domain anchor check** — Every new host is verified to be a true subdomain of the scoped apex via DNS, not string matching alone.
45211. **Scope snapshot at hunt start** — The exact scope rules in force are snapshotted and hashed when the hunt begins for later comparison.
45212. **Mid-hunt scope re-verification** — Scope rules are re-parsed on a schedule; any change pauses testing until re-verified.
45213. **Scope-change auto-pause** — When the program's scope page changes mid-hunt, all active modules pause and await operator confirmation.
45214. **Scope-diff operator alert** — Diffs between the start snapshot and current rules are shown to the operator with accept/reject options.
45215. **Revoked-scope instant halt** — If the program revokes scope or the target leaves the program, the hunt halts within seconds.
45216. **Out-of-scope result quarantine** — Any finding on an asset later ruled out of scope is quarantined, not reported, and logged.
45217. **Scope attestation pre-hunt** — The operator confirms the parsed scope summary in plain language before the first request is sent.
45218. **Redirect-to-out-of-scope blocker** — Redirect chains landing outside scope are not followed; the redirect is logged as a scope boundary event.
45219. **CNAME-chain scope evaluation** — CNAME targets are resolved and checked against scope before any request follows the alias.
45220. **DNS-rebinding scope guard** — If a resolved IP changes mid-hunt (rebinding), the new IP is re-checked against IP-based scope rules.
45221. **Direct-IP testing scope gate** — Testing by raw IP is allowed only when the program explicitly lists IP ranges in scope.
45222. **Port-scan scope limiter** — Port scanning runs only against in-scope hosts and ports; everything else is excluded at the scheduler level.
45223. **Certificate-transparency scope cross-check** — Newly discovered hosts from CT logs are admitted only after scope-rule verification.
45224. **Third-party asset quarantine** — Discovered third-party services (analytics, chat widgets) are quarantined from active testing pending explicit scope coverage.
45225. **Acquired-domain safety hold** — Domains from acquisitions stay on hold until scope text explicitly covers them, even if DNS suggests ownership.
45226. **Scope checklist per finding** — Every finding carries a checklist proving the asset, endpoint, and test type were all in scope.
45227. **In-scope evidence attachment** — Each report includes the scope evidence (rule citation, DNS proof) for every reported asset.
45228. **Scope-violation incident log** — All near-miss scope violations are recorded as safety incidents, even when the blocker caught them.
45229. **Scope-violation trend review** — Recurring near-misses trigger a review of whether the scope parser misunderstood a rule.
45230. **Subdomain-takeover scope fast-lane (safe)** — Dangling subdomains get priority scope adjudication, but testing still waits for the verdict.
45231. **Cloud-bucket scope proof requirement** — Buckets require ownership evidence before enrollment; unproven buckets are never probed.
45232. **IP-range scope proof requirement** — IP ranges require ASN/org/reverse-DNS alignment with the target before any packet is sent.
45233. **Geo-scope safety exclusion** — Assets in program-excluded regions are filtered even when DNS matches, protecting sanctioned-region rules.
45234. **Mobile-backend scope linker (safe)** — Mobile API hosts are linked to web scope only with bundle-ID and certificate evidence, then gated like web assets.
45235. **API-version scope gating** — New API versions are treated as unscoped until version-level rules confirm coverage.
45236. **CDN-origin scope re-check** — Discovered origin IPs undergo fresh scope adjudication since origins often have stricter rules.
45237. **Parking-page scope filter** — Domains serving parking pages are excluded from enrollment as non-assets.
45238. **Scope-expansion operator digest** — Expansion decisions are batched into a digest so operators can audit without alert fatigue.
45239. **Expansion kill-switch (safety)** — One toggle freezes all automatic scope decisions and routes them to manual review.
45240. **Scope-drift safety dashboard** — Live in-scope asset count vs. baseline is shown with drift alerts at configurable thresholds.
45241. **Scope-rule freshness check** — The scope page is re-fetched before each hunt and diffed against the last known version.
45242. **Multi-program scope merger (safe)** — Overlapping program scopes are unioned conservatively: the strictest rule wins on conflicts.
45243. **Scope-conflict resolver** — When two programs disagree on an asset, the agent picks the more restrictive interpretation and logs the conflict.
45244. **User scope-override with justification** — Manual scope additions require a typed justification, logged permanently.
45245. **Scope-override expiry** — Manual overrides expire after the hunt unless re-confirmed, preventing stale permissions.
45246. **Read-only scope for sensitive assets** — Assets flagged sensitive in scope notes are automatically limited to read-only testing.
45247. **Scope-note action restrictions** — "Do not test X" notes in program scope become hard blocks in the request pipeline.
45248. **Rate-limit scope notes** — Program-stated rate limits ("max 10 rps") override the agent's learned rates as hard ceilings.
45249. **Scope-based module gating** — Modules whose actions a program forbids (e.g., no social engineering) are disabled at plan time.
45250. **Forbidden-technique denylist** — Program-forbidden techniques are compiled into a denylist checked before every payload is built.
45251. **Scope-compliant payload filter** — Payloads are filtered against program rules (e.g., no real PII, no destructive commands) before sending.
45252. **Data-extraction scope limits** — Exfiltration-style verification is capped at the minimum bytes proving impact, per program rules.
45253. **Scope-aware evidence redaction** — Evidence containing out-of-scope data is redacted before it enters reports.
45254. **Post-hunt scope reconciliation** — At hunt end, all tested assets are re-checked against final scope rules and mismatches flagged.
45255. **Scope-rule natural-language explainer** — Translates the compiled scope rules into a plain-language summary the operator verifies before the hunt.
45256. **Scope-education tooltip system** — Inline explanations teach operators what each scope rule means as they review the pre-hunt summary.
45257. **Historical scope-violation learner** — Past near-misses train the scope parser to catch ambiguous rules earlier.
45258. **Scope-parser confidence score** — Each parsed rule carries a confidence level; low-confidence rules require operator confirmation.
45259. **Ambiguous-scope clarification request** — When scope text is ambiguous, the agent drafts a clarification question for the program owner instead of guessing.
45260. **Conservative-default on ambiguity** — Ambiguous scope is always interpreted restrictively until clarified.
45261. **Scope-audit sampling** — A random sample of in-hunt requests is re-verified against scope rules to catch pipeline drift.
45262. **Scope-gate performance monitor** — Measures the pre-send gate's latency to guarantee it never slows safety below 5ms per request.
45263. **Scope-gate fail-closed design** — If the scope service errors, all requests block rather than pass through unchecked.
45264. **Scope-rule versioning** — Every rule change is versioned so any hunt can be replayed against the rules in force at its start.
45265. **Scope-time-travel debugger** — Operators can replay a hunt's scope decisions against historical rule versions for dispute resolution.
45266. **Cross-hunt scope consistency check** — Flags when two hunts on the same program used materially different scope interpretations.
45267. **Scope-owner contact lookup** — Resolves the program's security contact from scope pages for clarification requests.
45268. **Scope-change RSS watcher** — Monitors the program's policy feed for scope updates between hunts.
45269. **Scope-email alert parser** — Parses program notification emails for scope changes and applies them as pending rule updates.
45270. **Pending-scope-change queue** — Rule updates await operator approval before taking effect mid-hunt.
45271. **Scope-freeze during critical phases** — Scope rules lock during active exploitation phases to avoid mid-phase interpretation shifts.
45272. **Scope-boundary test probes (safe)** — Benign requests near scope boundaries verify the gate's accuracy without touching out-of-scope assets.
45273. **Scope-gate unit-test suite** — The gate ships with tests covering wildcards, redirects, CNAMEs, and IP ranges.
45274. **Scope-decision explainability** — Every allow/block decision logs the rule, matched pattern, and evidence in human-readable form.
45275. **Scope-appeal workflow** — Operators can appeal a block with one click; appeals are logged and reviewed post-hunt.
45276. **Scope-block false-positive feedback** — Confirmed false blocks improve the parser's pattern matching.
45277. **Scope-coverage completeness meter** — Shows what percentage of declared scope the hunt actually exercised.
45278. **Untested-scope reporter** — Lists in-scope assets the hunt never reached so coverage gaps are visible.
45279. **Scope-prioritization advisor** — Suggests which in-scope areas deserve attention based on risk, not just coverage.
45280. **Scope-budget allocator** — Distributes the request budget across in-scope assets proportional to their risk scores.
45281. **Scope-excluded asset inventory** — Maintains a visible list of discovered-but-excluded assets with exclusion reasons.
45282. **Excluded-asset re-check scheduler** — Periodically re-evaluates excluded assets in case scope expanded to cover them.
45283. **Scope-sunset reviewer** — When a program ends, the agent archives its scope rules and purges related target data per policy.
45284. **Multi-target scope switcher** — Hunts covering several targets keep each target's scope rules isolated with zero cross-contamination.
45285. **Scope-rule template library** — Common program-scope patterns ship as templates operators can apply and customize.
45286. **Scope-policy linter** — Flags contradictory or unimplementable scope rules before the hunt starts.
45287. **Scope-rule test harness** — Operators can test hypothetical URLs against parsed rules before approving the hunt.
45288. **Scope-decision API** — External tools can query the scope gate ("is this URL in scope?") for integrations.
45289. **Scope-gate webhook** — Scope violations can trigger webhooks to the operator's SIEM or chat channel.
45290. **Scope-violation SIEM format** — Violation events export in a SIEM-friendly schema for enterprise customers.
45291. **Scope-compliance attestation** — Post-hunt, the agent signs an attestation that all requests stayed in scope, with the evidence bundle.
45292. **Scope-attestation verifier** — Program owners can independently verify the attestation against the exported request log.
45293. **Scope-safe finding deduplicator** — Findings are deduplicated only within scope; out-of-scope duplicates are never merged in.
45294. **Scope-aware severity adjustment** — Severity is calibrated to program scope notes (e.g., lower for explicitly low-priority areas).
45295. **Scope-note severity caps** — Program-stated severity caps ("XSS on marketing site = low") are enforced in scoring.
45296. **Duplicate-program scope handler** — When the same asset appears in two programs, findings route to the correct program per scope priority.
45297. **Scope-transfer safety** — Moving a finding between programs re-validates scope under the destination program's rules.
45298. **Scope-retention policy** — Scope decisions and evidence are retained per the program's data-retention policy, then purged.
45299. **Scope-data minimization** — The agent stores only the scope evidence needed for attestation, nothing more.
45300. **Scope-privacy guard** — Scope evidence containing user data is redacted before export.
45301. **Scope-transparency report** — A public-facing summary shows scope adherence stats without exposing target details.
45302. **Scope-maturity score** — Programs get a score for scope clarity, helping operators spot risky vague scopes early.
45303. **Vague-scope warning** — Programs with ambiguous scope trigger a warning recommending clarification before aggressive phases.
45304. **Scope-safety certification** — A hunt earns a scope-safety badge only with zero violations and full attestation.
45305. **Read-only testing mode** — A global toggle restricts the entire hunt to safe HTTP methods and non-mutating API calls.
45306. **Write-action classifier** — Every planned action is classified as read, create, update, or delete before execution.
45307. **Destructiveness tier system** — Actions are tiered 0 (read) to 4 (irreversible delete); higher tiers need stronger approval.
45308. **Pre-flight impact check** — Before any tier-2+ action, the agent estimates affected records, users, and reversibility.
45309. **Rollback plan generator (safety)** — For every mutating test, the agent drafts a rollback procedure before executing.
45310. **Rollback-plan verification** — Rollback steps are validated against a safe copy before the mutation runs.
45311. **Mutation budget per hunt** — Caps the number of state-changing requests; exceeding it requires operator approval.
45312. **Destructive-payload denylist** — Payloads containing destructive primitives are rejected at generation time.
45313. **Destructive-keyword filter** — Scans payloads for destructive keywords and blocks matches with an explanatory log.
45314. **Safe-payload rewriter** — Rewrites destructive proofs into non-destructive equivalents (e.g., comment instead of delete).
45315. **Non-destructive proof standard** — Verification must use the least-privileged proof that still demonstrates impact.
45316. **Backup-before-mutation** — Where the program allows, the agent snapshots the target state before any mutation.
45317. **Idempotency-key injection** — Mutating requests carry idempotency keys so accidental retries don't duplicate effects.
45318. **Test-account isolation** — All mutating tests run against designated test accounts, never real user data.
45319. **Sandbox-tenant preference** — The agent prefers sandbox/staging tenants for destructive-class verification.
45320. **Data-integrity post-check** — After mutating tests, the agent verifies target data integrity and reports any drift.
45321. **Destructive-finding safe verification** — Deletion-class findings are verified via non-destructive means (e.g., permission check, not actual deletion).
45322. **Confirmation prompt for writes** — Tier-3+ actions pause for explicit operator confirmation with impact summary.
45323. **Two-person rule for tier-4** — Irreversible actions require two independent operator approvals.
45324. **Write-action audit record** — Every mutation logs before/after state, justification, and approver.
45325. **Mutation replay protection** — Executed mutations are fingerprinted so retries or duplicates are blocked.
45326. **Time-boxed mutation windows** — Mutating phases run only inside operator-approved time windows.
45327. **Mutation-free recon guarantee** — The recon phase is cryptographically restricted to read-only actions.
45328. **State-change detector** — Monitors responses for evidence of unintended state changes and alerts immediately.
45329. **Unintended-write alarm** — A GET that unexpectedly mutates state triggers an incident and a hunt pause.
45330. **CSRF-safe test harness** — CSRF tests use the agent's own test session so no real user session is ever at risk.
45331. **Mass-assignment safe proving** — Proves mass assignment by setting a harmless field, never privilege or billing fields.
45332. **Privilege-escalation non-persistence** — Escalation proofs check permission grants without persisting elevated roles.
45333. **IDOR read-only proving** — IDOR is proven by reading metadata (status codes, object counts), not dumping full records.
45334. **Record-count minimization** — Enumeration stops at the smallest count proving the flaw (e.g., 3 records, not 10,000).
45335. **PII-avoidance in proofs** — Proofs never extract real personal data; they use synthetic or redacted samples.
45336. **File-upload safe types** — Upload tests use inert file types and minimal sizes; executable uploads are never executed.
45337. **XXE safe proving** — XXE is proven via DNS/HTTP out-of-band to a controlled listener or via error messages, never file exfiltration.
45338. **SSRF safe proving** — SSRF is proven against agent-controlled endpoints or cloud metadata blocklists, never internal production hosts.
45339. **SSTI safe proving** — Template injection is proven with arithmetic or marker strings, never command execution.
45340. **Command-injection safe proving** — Proven via time delays or DNS callbacks, never destructive commands.
45341. **SQLi safe proving** — Proven with boolean/time-based techniques on non-destructive queries; stacked queries are never used.
45342. **Deserialization safe proving** — Proven with sleep or DNS callbacks using inert gadget chains.
45343. **Race-condition safe testing** — Race tests use the agent's own test resources with strict attempt caps.
45344. **Denial-of-service prohibition** — The agent never performs DoS testing; load-adjacent checks are capped at trivial volumes.
45345. **Resource-exhaustion guard (safety)** — Any test showing disproportionate server cost is aborted immediately.
45346. **Infinite-loop payload guard** — Payloads that could trigger server-side loops are rejected by the payload filter.
45347. **Regex-DoS safe patterns** — ReDoS probes use short inputs and strict timeouts, one at a time.
45348. **Zip-bomb avoidance** — The agent never uploads compressed archives that expand disproportionately.
45349. **Billion-laughs guard** — XML payloads are capped in size and entity depth.
45350. **GraphQL depth limiting respect** — Tests stay within the server's published query-depth limits.
45351. **Batch-endpoint volume caps** — Batch APIs are tested with 2–3 items, never hundreds.
45352. **Pagination abuse guard** — Pagination tests request small pages; deep-pagination floods are prohibited.
45353. **Cache-poisoning safe proving** — Proven with unique marker keys on test paths, never poisoning shared production caches.
45354. **Cache-deception read-only check** — Checks caching behavior without storing attacker-controlled content.
45355. **Subdomain-takeover non-claim rule** — Takeover is proven via DNS/CNAME evidence; the agent never actually claims the dangling resource.
45356. **Cloud-resource non-provisioning** — The agent never provisions cloud resources to prove takeover or access.
45357. **Email-spoof safe proving** — SPF/DKIM/DMARC is evaluated via DNS records, never by sending spoofed mail.
45358. **Password-reset safe flow** — Reset flows are tested on the agent's own test account with token delivery to controlled inboxes.
45359. **Account-takeover non-persistence** — Takeover proofs stop at token receipt; sessions are never hijacked or persisted.
45360. **2FA-bypass safe proving** — Proven against test accounts with operator-supplied bypass codes, never real users.
45361. **Session-fixation safe test** — Tested with the agent's own sessions only.
45362. **OAuth flow test-account use** — OAuth tests use agent-controlled test apps and accounts.
45363. **JWT-forgery safe proving** — Forged tokens are tested against non-production endpoints or with immediate revocation.
45364. **API-key exposure safe handling** — Exposed keys are reported without ever using them to access data.
45365. **Secret-verification read-only** — Leaked secrets are verified via metadata endpoints, never used for data access.
45366. **Database-access prohibition** — The agent never writes to or dumps databases; read proofs are minimal and redacted.
45367. **Backup-file safe handling** — Discovered backups are fingerprinted by headers, never fully downloaded.
45368. **Log-file safe sampling** — Log exposures are sampled (first KB) to confirm without bulk download.
45369. **Git-history safe cloning** — Exposed repos are cloned shallowly or inspected via listing, not fully exfiltrated.
45370. **Container-escape prohibition** — Container breakouts are never attempted, even on in-scope infrastructure.
45371. **Lateral-movement prohibition (safety)** — The agent never pivots to adjacent systems; each asset is tested in isolation.
45372. **Internal-network non-probing** — SSRF-discovered internal hosts are reported, not probed.
45373. **Metadata-service blocklist** — Cloud metadata endpoints are never requested, even to prove SSRF.
45374. **Production-data non-touch rule** — Production databases, queues, and storage are never written to under any circumstance.
45375. **Canary-data verification** — Where programs provide canary records, proofs target those records exclusively.
45376. **Synthetic-data preference** — The agent generates synthetic test data rather than reusing real user content.
45377. **Test-data cleanup** — All agent-created test data is deleted at hunt end with a cleanup report.
45378. **Orphaned-resource sweeper** — A post-hunt sweep finds and removes resources the agent created.
45379. **Cleanup verification** — Cleanup actions are verified and any leftovers reported to the operator.
45380. **Destructive-action insurance log** — A separate tamper-evident log records every mutation for dispute resolution.
45381. **Operator destructiveness briefing** — Before mutating phases, the operator gets a plain-language briefing of planned writes.
45382. **Program destructiveness policy check** — The agent verifies the program explicitly permits each destructive class before attempting it.
45383. **Default-deny destructive policy** — Any destructive class not explicitly allowed by the program is denied.
45384. **Destructiveness policy versioning** — Policy decisions are versioned and attached to the hunt record.
45385. **Non-destructive proof confidence** — Findings proven non-destructively carry confidence annotations explaining the proof limits.
45386. **Impact-limited PoC standard** — Every PoC ships with an "impact during testing" statement quantifying what was touched.
45387. **PoC cleanup instructions** — Each PoC includes steps for the owner to reverse any test artifacts.
45388. **Non-destructive retest protocol** — Remediation retests repeat only the safe proof, never the full original sequence.
45389. **Destructiveness incident playbook** — A predefined playbook triggers if any unintended mutation is detected.
45390. **Unintended-mutation auto-remediation** — Where safe, the agent immediately reverses accidental writes and reports them.
45391. **Mutation blast-radius estimator** — Before executing, the agent estimates how many records/users a mutation could affect.
45392. **Blast-radius hard cap** — Mutations estimated above the cap are blocked pending operator override.
45393. **Cascading-effect analyzer** — Checks whether a mutation could trigger webhooks, emails, or downstream jobs before running.
45394. **Downstream-effect suppressor** — Prefers test paths that don't trigger notifications or downstream processing.
45395. **Feature-flag safety check** — Mutations respect feature flags; disabled features are never force-enabled.
45396. **Kill-switch for mutating phases** — One control halts all in-flight mutations across every worker instantly.
45397. **Mutation dry-run preview** — Operators see the exact requests planned for a mutating phase before approval.
45398. **Mutation dry-run state viewer** — Shows expected state changes side-by-side with current state for operator review.
45399. **Gradual mutation rollout** — Mutations apply to one record first; broader application needs fresh approval.
45400. **Mutation canary verification** — After the first mutation, the agent verifies expected effects before continuing.
45401. **Non-destructive guarantee badge** — Hunts with zero mutations earn a badge in the report and dashboard.
45402. **Mutation-free attestation** — The agent can attest that a hunt performed no state-changing requests, with log evidence.
45403. **Destructive-class training data** — Past destructive incidents (anonymized) train the classifier to catch risky actions earlier.
45404. **Safety-first payload library** — The default payload library contains only non-destructive proofs, curated and reviewed.
45405. **Low-traffic window scheduler** — High-volume phases are auto-scheduled in the target's historically quietest hours.
45406. **Traffic-baseline learner** — The agent learns the target's traffic rhythm from response-time patterns over days.
45407. **Quiet-hours auto-resume** — Paused hunts automatically resume when the next quiet window opens.
45408. **Maintenance-mode detector** — Detects maintenance pages, banners, and status APIs, then pauses until service restores.
45409. **Deploy-freeze awareness (safety)** — Pauses aggressive testing when the target shows signs of an active deployment (version flips, 503s).
45410. **Status-page watcher** — Monitors the target's public status page; incidents there pause the hunt automatically.
45411. **Traffic-spike abort** — A sudden latency or error spike pauses the hunt on the assumption of real-user impact.
45412. **On-call-hours respect** — Aggressive phases avoid hours when the target's on-call team is likely offline, per program notes.
45413. **Weekend blackout option** — Operators can black out weekends entirely for targets with no weekend ops coverage.
45414. **Holiday calendar integration** — Public holidays in the target's country automatically become low-activity days.
45415. **Program-announced window compliance** — Program-specified testing windows are enforced as hard schedule boundaries.
45416. **Window-violation prevention** — The scheduler refuses to start aggressive phases outside approved windows.
45417. **Graceful window-boundary stop** — Phases wind down 15 minutes before a window closes instead of hard-stopping mid-request.
45418. **Window-extension request flow** — Operators can request window extensions with logged justification.
45419. **Timezone-aware scheduling (safety)** — All windows are interpreted in the target's local timezone, never the operator's.
45420. **Multi-region window planner** — For global targets, windows are planned per region to always test somewhere quiet.
45421. **Health-check heartbeat (safety)** — A lightweight health probe runs before each phase; unhealthy targets pause the hunt.
45422. **Synthetic-user impact monitor** — Monitors key user journeys' latency as a proxy for real-user impact during testing.
45423. **Apdex-guard testing** — If the target's apparent Apdex drops during testing, rates reduce automatically.
45424. **Error-budget awareness** — For targets with published SLOs, the agent estimates its error-budget consumption and stays trivial.
45425. **Load-proportional scheduling** — Test intensity scales inversely with observed target load.
45426. **Auto-scaling respect** — Detects auto-scaling events and avoids testing during scale-up instability.
45427. **Cold-start avoidance** — Serverless targets get gentle warm-up traffic, not cold-start stampedes.
45428. **Cache-warmth preservation** — Testing patterns avoid invalidating hot caches that serve real users.
45429. **Database-load guard** — Query-heavy tests pause if database response times degrade.
45430. **Queue-depth monitor** — If the target's async queues appear backed up, the agent reduces fire-and-forget requests.
45431. **Cron-job collision avoidance** — Detects scheduled job patterns (hourly spikes) and avoids testing during them.
45432. **Backup-window avoidance** — Identifies likely backup windows from latency patterns and deprioritizes heavy tests then.
45433. **Report-generation hour avoidance** — Avoids heavy testing when the target typically generates reports (end-of-day patterns).
45434. **Flash-sale blackout** — E-commerce targets get automatic blackouts during detected sale events.
45435. **Launch-day detection** — Product-launch traffic patterns trigger an automatic hunt pause.
45436. **Incident-response pause** — Any sign of an active incident (status page, error storms) pauses all testing immediately.
45437. **Post-incident cool-down** — After an incident clears, the agent waits a configurable cool-down before resuming.
45438. **Change-freeze calendar** — Operator-defined freeze periods (e.g., Black Friday week) block aggressive phases.
45439. **Business-event awareness** — Detects earnings, elections, or events relevant to the target and suggests pauses.
45440. **Safe-window recommender** — Recommends optimal testing windows based on learned traffic patterns.
45441. **Window-effectiveness scorer** — Scores past windows by target stability to improve future scheduling.
45442. **Operator window override** — Operators can force a window with logged justification and extra monitoring.
45443. **Emergency testing window** — A break-glass window for urgent retests with mandatory operator presence.
45444. **Window audit trail** — Every schedule decision logs the window rules applied and traffic signals observed.
45445. **Quiet-window verification** — Before ramping up, the agent verifies the window is actually quiet with probe traffic.
45446. **Window-drift detector** — If traffic patterns shift (growth, new markets), windows are re-learned automatically.
45447. **Staged intensity ramp** — Each window opens with a ramp-up period rather than full intensity immediately.
45448. **Window-close checklist** — At window end, the agent verifies no mutations are in flight and sessions are closed.
45449. **Overnight low-risk mode** — Overnight windows run read-heavy phases; mutating phases wait for staffed hours.
45450. **Staffed-hours mutation rule** — Mutating tests run only when the target's team is likely staffed, per timezone inference.
45451. **Follow-the-sun scheduling** — Global hunts rotate intensity to always favor the quietest region.
45452. **Regional holiday awareness** — Regional holidays pause testing for region-specific infrastructure.
45453. **Latency-based quiet detection** — Sustained low latency is treated as a quiet signal; rising latency as busy.
45454. **Throughput-based quiet detection** — The agent estimates target throughput from timing channels to find quiet periods.
45455. **Safe-window API** — External schedulers can query the agent for the next recommended safe window.
45456. **Calendar-export of windows** — Planned testing windows export to the operator's calendar.
45457. **Window-notification to owner** — Program owners can opt into notifications when testing windows open and close.
45458. **Owner-defined quiet hours** — Program owners can define quiet hours that override the agent's learned windows.
45459. **Dynamic window shrinking** — If the target gets busier mid-window, the window shrinks automatically.
45460. **Dynamic window extension** — Quiet windows can extend when the target stays calm, within operator limits.
45461. **Window-interruption handler** — Interruptions (incidents, spikes) pause cleanly and resume from checkpoints.
45462. **Checkpoint-based resume** — Every phase checkpoints progress so window interruptions never lose work or repeat requests.
45463. **Duplicate-request prevention on resume** — Resume logic skips already-completed requests to avoid double load.
45464. **Window-fairness across targets** — Multi-target hunts rotate windows fairly so no target is always tested at its busiest.
45465. **Small-target window priority** — Small targets get the quietest windows first in multi-target schedules.
45466. **Window-conflict resolver** — Overlapping program windows are resolved in favor of the stricter constraint.
45467. **Safe-window compliance badge** — Hunts run entirely inside approved windows earn a compliance badge.
45468. **Window-violation incident** — Any request outside an approved window is logged as a safety incident.
45469. **Real-user traffic estimator** — Estimates concurrent real users from timing signals to avoid peak overlap.
45470. **Peak-hour predictor** — Predicts the target's next peak from historical patterns and schedules around it.
45471. **Off-peak verification** — The agent confirms off-peak status with a 5-minute observation before heavy phases.
45472. **Gradual off-peak exit** — As a window nears its end, intensity tapers instead of stopping abruptly.
45473. **Safe-window dry-run** — Operators can simulate a window schedule to preview when phases would run.
45474. **Window-simulation report** — The dry-run produces a timeline showing planned intensity per hour.
45475. **Operator window approval** — Recommended windows can require operator approval before the hunt starts.
45476. **Auto-window mode** — Fully autonomous hunts let the agent pick windows within operator-set boundaries.
45477. **Window-boundary alerts** — Operators are notified when windows open, close, or are interrupted.
45478. **Missed-window recovery** — If a window is missed, the agent re-plans rather than compressing work into less time.
45479. **Window-compression guard** — The agent refuses to compress a full phase into a short window by raising intensity.
45480. **Phase-to-window matcher** — Heavy phases are matched to the longest quiet windows; light phases fill gaps.
45481. **Window-utilization reporter** — Reports how efficiently each window was used for the audit package.
45482. **Cross-timezone team handoff** — Window schedules include handoff notes for globally distributed operator teams.
45483. **Safe-window policy templates** — Common industries (banking, health, retail) ship with sensible default windows.
45484. **Custom window rule builder** — Operators can build custom window rules with a visual editor.
45485. **Window-rule versioning** — Window rules are versioned and attached to the hunt record.
45486. **Safe-window learning sharing** — Anonymized window patterns can be shared across the user's hunts for similar targets.
45487. **Window-privacy guard** — Learned traffic patterns never expose target-identifying details in shared data.
45488. **Seasonal pattern learner** — Learns seasonal traffic shifts (holidays, sales seasons) for long-running programs.
45489. **Event-driven window pause** — Breaking-news events affecting the target's sector trigger precautionary pauses.
45490. **Safe-window operator dashboard** — A calendar view shows past and planned windows with target-calm indicators.
45491. **Window-anomaly investigator** — Unexpected busyness during a quiet window triggers a diagnostic and a re-learn.
45492. **Target-capacity estimator (safety)** — Estimates the target's serving capacity to right-size test intensity per window.
45493. **Capacity-headroom rule** — Testing never exceeds an estimated 5% of target capacity during any window.
45494. **Headroom-violation alarm** — Exceeding the headroom estimate triggers an immediate slowdown and incident log.
45495. **Safe-window attestation** — The hunt record attests which windows were used and that no window rules were violated.
45496. **Window-attestation verifier** — Program owners can verify window compliance from the exported schedule log.
45497. **Quiet-window proof pack** — Includes the traffic signals observed that justified each window choice.
45498. **Window-decision explainability** — Every scheduling decision logs the signals and rules behind it.
45499. **Safe-window incident playbook** — A playbook covers what to do when a window goes wrong mid-hunt.
45500. **Post-window target check** — After each window, a health check confirms the target is stable before the next begins.
45501. **Window-to-window state carryover** — Only safe, idempotent state carries across windows; mutations re-verify.
45502. **Safe-window kill-switch** — One control cancels all future windows and parks the hunt safely.
45503. **Window-schedule change log** — Every schedule change is logged with reason, operator, and timestamp.
45504. **Safe-window maturity score** — A per-hunt score reflects how well testing respected safe windows.
45505. **Pre-request impact predictor** — Before sending, the agent scores each request's likely impact from method, endpoint history, and payload class.
45506. **Payload risk scorer** — Every generated payload gets a 0–100 risk score based on destructiveness, blast radius, and reversibility.
45507. **Cumulative impact budget** — Each hunt gets an impact budget; every action spends from it based on its predicted impact.
45508. **Impact-budget exhaustion halt** — When the budget runs out, mutating phases stop and only read-only work continues.
45509. **Endpoint sensitivity scorer** — Endpoints are scored for sensitivity (auth, payments, admin) from paths, docs, and behavior.
45510. **Sensitivity-aware test selection** — High-sensitivity endpoints get fewer, gentler tests with stronger proofs.
45511. **Affected-users estimator** — For user-data endpoints, the agent estimates how many users a test could affect and caps accordingly.
45512. **Blast-radius mapper** — Maps which records, caches, and downstream systems a request could touch before sending it.
45513. **Dependency-graph impact analysis** — Builds a service dependency graph so tests avoid single points of failure.
45514. **User-facing vs internal weighting** — User-facing endpoints carry 3× the impact weight of internal ones in budget math.
45515. **Revenue-path protection** — Checkout, payment, and signup flows get maximum impact weighting and minimal test volumes.
45516. **Data-classification awareness** — Endpoints handling PII, health, or financial data are auto-flagged as high-sensitivity.
45517. **Historical incident correlator** — Past target incidents inform impact scores for similar endpoints.
45518. **Impact heat-map visualizer** — A live map shows predicted impact per endpoint across the target.
45519. **Request-cost estimator** — Estimates CPU, DB, and bandwidth cost per request class to keep testing cheap for the target.
45520. **Expensive-query detector** — Endpoints showing slow-query patterns get cost-capped test plans.
45521. **Third-party cost guard** — Tests that would incur the target third-party API costs are minimized or skipped.
45522. **Notification-cost estimator** — Estimates emails, SMS, and push notifications a test could trigger and blocks high counts.
45523. **Log-volume estimator** — Estimates log volume generated per test to avoid drowning the target's logging pipeline.
45524. **Storage-impact estimator** — Upload and creation tests estimate storage consumed and stay within tiny quotas.
45525. **Compute-impact estimator** — CPU-heavy endpoints (rendering, crypto, search) get strict per-test compute caps.
45526. **Memory-impact estimator** — Tests that could bloat server memory are identified and volume-capped.
45527. **Connection-pool impact guard** — Slow or hanging requests are capped to avoid exhausting the target's connection pool.
45528. **Lock-contention estimator** — Tests on likely-locked resources (counters, balances) run serially with delays.
45529. **Cache-invalidation impact** — Tests that invalidate caches are minimized since they shift load to origins.
45530. **CDN-origin shift guard** — Patterns that would shift traffic from CDN to origin are detected and throttled.
45531. **Failover-trigger avoidance** — The agent avoids patterns that could trigger failover or auto-scaling events.
45532. **Circuit-breaker respect** — If the target's circuit breakers appear to trip, testing backs off immediately.
45533. **Retry-storm prevention (safety)** — The agent never retries aggressively; retries are capped and spaced.
45534. **Thundering-herd avoidance** — Scheduled tests are jittered so multiple hunts don't synchronize against one target.
45535. **Impact-decay model** — Predicted impact decays as the agent learns an endpoint is resilient, freeing budget for new areas.
45536. **Resilience learning** — Endpoints that handle tests gracefully earn lower future impact scores.
45537. **Fragility learning** — Endpoints that error under light load earn higher scores and gentler treatment.
45538. **Impact-score calibration** — Post-hunt reviews compare predicted vs. observed impact to calibrate the scorer.
45539. **Operator impact-threshold tuning** — Operators set per-program impact thresholds with changes audit-logged.
45540. **Impact-threshold breach alarm** — Exceeding a threshold pauses the hunt and notifies the operator.
45541. **Per-phase impact allocation** — Each hunt phase gets an impact sub-budget so one phase can't spend it all.
45542. **Impact rollover rules** — Unused impact budget doesn't automatically roll over; rollover needs operator approval.
45543. **High-impact action queue** — Actions above an impact score wait in a queue for operator review instead of auto-running.
45544. **Impact-justification requirement** — High-impact actions require a written justification stored in the audit log.
45545. **Dual-control for high impact** — The highest-impact actions need two operator approvals.
45546. **Impact-simulation sandbox** — High-impact plans are simulated against a model of the target before approval.
45547. **What-if impact analyzer** — Operators can ask "what if we run this phase?" and get a predicted impact breakdown.
45548. **Impact-comparison across plans** — The planner compares candidate plans by predicted impact and prefers the gentler one.
45549. **Gentlest-viable-plan selector** — Among plans achieving the goal, the agent picks the lowest predicted impact.
45550. **Impact-vs-coverage tradeoff view** — A dashboard shows the tradeoff curve so operators pick their risk point.
45551. **Coverage-per-impact metric** — Efficiency is measured as findings per unit of impact, rewarding gentle effectiveness.
45552. **Impact-efficient technique ranking** — Techniques are ranked by findings-per-impact from historical data.
45553. **Low-impact technique preference** — The planner prefers historically low-impact techniques for initial passes.
45554. **Impact-escalation ladder** — Techniques escalate in impact only when gentler ones fail to produce signal.
45555. **De-escalation triggers** — Any target distress signal steps the ladder back down immediately.
45556. **Impact-ladder audit** — Every escalation step is logged with the signal that justified it.
45557. **Time-bounded impact windows** — High-impact techniques run only inside short, approved time boxes.
45558. **Impact-cool-down between escalations** — Mandatory cool-downs separate escalation steps.
45559. **Maximum-impact ceiling** — A hard ceiling no plan can exceed, set per program.
45560. **Ceiling-breach prevention** — The planner mathematically cannot emit plans exceeding the ceiling.
45561. **Impact-attribution per finding** — Each finding records the impact spent to discover and verify it.
45562. **Impact-ROI reporter** — Post-hunt reports show impact spent vs. findings gained per module.
45563. **Wasteful-impact detector** — Modules spending impact without findings are flagged for plan revision.
45564. **Impact-budget forecasting** — The agent forecasts whether the remaining budget covers the remaining plan.
45565. **Budget-replanning trigger** — Forecast shortfalls trigger a replan toward higher-ROI, lower-impact work.
45566. **Impact-aware prioritization** — The queue orders work by expected findings per impact unit.
45567. **Diminishing-returns detector (safety)** — When findings-per-impact drops, the agent pivots to new areas or stops.
45568. **Graceful impact exhaustion** — Running out of budget ends the hunt cleanly with a summary, not an abrupt kill.
45569. **Impact-budget top-up flow** — Operators can top up the budget with logged justification.
45570. **Program-level impact accounting** — Impact is tracked per program across hunts to respect long-term relationships.
45571. **Target-fatigue tracker** — Cumulative impact across recent hunts informs gentler starts for frequently tested targets.
45572. **Fatigue-based scheduling** — Recently heavily-tested targets get longer cool-downs between hunts.
45573. **Impact-debt reporter** — Shows operators the cumulative impact footprint they own across targets.
45574. **Sustainability score** — A per-operator metric rewarding low-impact, high-yield hunting.
45575. **Impact-benchmark comparisons** — Anonymized benchmarks show how a hunt's impact compares to similar hunts.
45576. **Outlier-impact review** — Hunts with outlier impact trigger a post-hunt review prompt.
45577. **Impact-incident postmortem** — Any impact incident gets a structured postmortem template.
45578. **Postmortem action tracker** — Postmortem actions are tracked to completion.
45579. **Impact-model versioning** — The impact model is versioned so predictions are reproducible.
45580. **Impact-prediction explainability** — Every score shows the factors behind it in plain language.
45581. **Operator impact-score override** — Operators can adjust scores with logged reasons; overrides train the model.
45582. **Impact-score disagreement log** — Disagreements between model and operator are recorded for model improvement.
45583. **Conservative-bias default** — The scorer errs toward overestimating impact when uncertain.
45584. **Uncertainty-aware budgeting** — Uncertain predictions consume budget at the upper bound of the estimate.
45585. **Impact-confidence intervals** — Scores carry confidence intervals; wide intervals trigger caution.
45586. **Low-confidence action gating** — Actions with low-confidence impact estimates need operator approval.
45587. **Impact-scenario planner** — Plans include best/worst-case impact scenarios for operator review.
45588. **Worst-case impact cap** — Plans are approved against worst-case, not expected, impact.
45589. **Impact-gated phase transitions** — Phases advance only if cumulative impact stays within plan.
45590. **Phase-impact reconciliation** — After each phase, predicted vs. actual impact is reconciled and reported.
45591. **Reconciliation-drift alarm** — Large prediction errors trigger a scorer review.
45592. **Live impact meter** — The dashboard shows real-time impact spend vs. budget.
45593. **Impact-velocity alert** — Spending impact too fast triggers a slowdown suggestion.
45594. **Projected-exhaustion warning** — Warns operators well before the budget would run out.
45595. **Impact-freeze control** — One button freezes all impact-spending actions instantly.
45596. **Read-only fallback mode** — On freeze, the hunt continues in read-only mode rather than dying.
45597. **Impact-resume checklist** — Resuming after a freeze requires a checklist confirming target health.
45598. **Impact-ledger export** — The full impact ledger exports with the audit package.
45599. **Ledger-tamper evidence** — The ledger is hash-chained so tampering is detectable.
45600. **Impact-ledger program summary** — Program owners get a plain-language summary of impact their program absorbed.
45601. **Owner impact-acknowledgment** — Program owners can acknowledge the impact report, closing the loop.
45602. **Impact-dispute workflow** — Owners can dispute impact assessments with a structured response flow.
45603. **Dispute-resolution log** — Disputes and resolutions are logged for relationship history.
45604. **Impact-maturity score** — A per-hunt score reflects how accurately impact was predicted and controlled.
45605. **Target-error auto-stop** — A sustained 5xx rate above 5% halts the hunt automatically.
45606. **Error-spike circuit breaker** — A sudden error spike trips a breaker that stops new requests in under 2 seconds.
45607. **Latency-death detector** — If p99 latency exceeds 30s, the hunt stops on the assumption of target distress.
45608. **Connection-failure auto-stop** — Repeated connection failures pause the hunt instead of hammering a dead target.
45609. **DNS-failure pause** — DNS resolution failures pause testing until the target's DNS recovers.
45610. **TLS-failure pause** — Certificate or handshake failures pause the hunt and alert the operator.
45611. **Target-down detector** — Distinguishes target-down from network issues before deciding to stop or wait.
45612. **Partial-outage handler** — If only some endpoints fail, testing continues on healthy ones with reduced scope.
45613. **Degraded-mode testing** — In degraded states, only the gentlest read-only checks continue.
45614. **Graceful degradation ladder** — The hunt steps down through intensity levels before fully stopping.
45615. **Auto-resume on recovery** — After errors clear for a sustained period, the hunt resumes from checkpoints.
45616. **Recovery-verification probes** — A series of gentle probes confirms real recovery before resuming.
45617. **Flapping-target handler** — Targets that flap up/down get longer backoffs and operator notification.
45618. **On-call alerting hooks** — Critical aborts can page the operator via webhook, email, or chat integration.
45619. **Abort-notification templates** — Pre-written, professional abort notifications for program owners.
45620. **Owner abort-notification opt-in** — Program owners can opt into real-time abort notifications.
45621. **Abort-reason taxonomy** — Every abort is classified (target-error, scope, safety, operator) for trend analysis.
45622. **Abort-timeline builder** — Builds a second-by-second timeline of events leading to the abort.
45623. **Abort-evidence packager** — Packages logs, metrics, and decisions around the abort for review.
45624. **Post-abort diagnostics** — An automated diagnostic runs after abort to assess whether the agent caused the issue.
45625. **Self-causation analyzer** — Correlates the agent's request timeline with the target's error timeline to assess causation.
45626. **Causation-honesty report** — If the agent likely caused the outage, the report says so plainly with evidence.
45627. **Owner apology-assist draft** — Drafts a professional, honest incident note for the program owner when warranted.
45628. **Incident playbook library** — Predefined playbooks for target-down, data-exposure, scope-breach, and WAF-lockout scenarios.
45629. **Playbook auto-selection** — The abort reason auto-selects the matching playbook.
45630. **Playbook step tracker** — Playbook steps are checked off with timestamps during incident response.
45631. **Incident commander mode** — The UI switches to an incident view with clear status and next steps on abort.
45632. **Incident-role assigner** — Suggests who does what (notify owner, preserve logs, verify recovery) during incidents.
45633. **Log-preservation on abort** — All relevant logs are snapshotted immutably the moment an abort triggers.
45634. **Evidence-freeze control** — One action freezes all hunt state for forensic review.
45635. **Forensic-timeline exporter** — Exports a forensic timeline for the operator or program owner.
45636. **Blameless postmortem template** — Postmortems focus on systemic fixes, never operator blame.
45637. **Postmortem scheduler** — Schedules the postmortem and assigns an owner automatically.
45638. **Corrective-action tracker** — Tracks corrective actions from postmortems to completion.
45639. **Abort-drill mode** — Operators can run simulated aborts to practice incident response safely.
45640. **Drill-scenario library** — Realistic drill scenarios (outage, breach-scare, scope-revocation) ship built-in.
45641. **Drill-performance scorer** — Scores drill response times and completeness.
45642. **Dead-man switch** — If the agent loses contact with the operator console for a configured period, it parks safely.
45643. **Heartbeat monitor** — A heartbeat between workers and the coordinator detects stuck or runaway workers.
45644. **Runaway-worker killer** — Workers exceeding request or time limits are terminated automatically.
45645. **Watchdog timer** — A watchdog stops phases that exceed their planned duration by 2×.
45646. **Phase-timeout handler** — Timed-out phases checkpoint and yield rather than running forever.
45647. **Infinite-loop detector** — Detects request loops (same URLs repeating) and breaks them.
45648. **Recursion-depth guard** — Caps crawl and redirect recursion to prevent runaway depth.
45649. **Memory-leak guard** — The agent monitors its own memory and sheds load before it can affect the host.
45650. **Disk-space guard** — Evidence collection pauses if disk space runs low, protecting the operator's machine.
45651. **Operator panic button** — A prominent, always-visible stop control halts everything within 2 seconds.
45652. **Panic-button confirmation** — The panic action is instant; confirmation happens after, never before.
45653. **Two-stage stop** — First press parks gracefully; second press (or hold) kills immediately.
45654. **Stop-reason prompt** — After stopping, the operator is asked for a reason to improve future safety.
45655. **Resume-safety checklist** — Resuming requires confirming target health, scope validity, and window status.
45656. **Abort-on-scope-revocation** — Scope revocation is a non-overridable abort, even mid-exploitation.
45657. **Abort-on-legal-notice** — Detected legal or takedown notices halt the hunt immediately.
45658. **Abort-on-data-breach-signal** — Any sign of real user data exposure stops the hunt and triggers the breach playbook.
45659. **Breach-playbook auto-launch** — The data-breach playbook starts automatically: freeze, preserve, notify.
45660. **PII-exposure detector** — Responses are scanned for real-looking PII; hits trigger immediate pause and review.
45661. **Credential-exposure handler** — Discovered real credentials trigger pause, redaction, and owner notification flow.
45662. **Secrets-handling protocol** — Found secrets are never used, only fingerprinted and reported through secure channels.
45663. **Abort-on-WAF-lockout** — Full IP lockout by the target's defenses ends the hunt with a report, not evasion.
45664. **Abort-on-captcha-wall** — Hitting CAPTCHAs across a phase ends that phase; the agent never solves them.
45665. **Abort-on-honeypot** — Confirmed honeypot interaction ends the phase and logs the encounter.
45666. **Abort-on-third-party-impact** — Signs of impact on third-party services halt the relevant module.
45667. **Abort-on-operator-command** — Any operator stop command is obeyed within 2 seconds, no questions asked.
45668. **Abort-priority hierarchy** — Safety aborts outrank operator resume commands until explicitly cleared.
45669. **Abort-clearance workflow** — Clearing a safety abort requires acknowledging the cause and the remediation.
45670. **Clearance-audit record** — Abort clearances are logged with identity, reason, and timestamp.
45671. **Stuck-abort detector** — If an abort doesn't stop traffic within the SLA, an escalation fires.
45672. **Abort-escalation ladder** — Failed aborts escalate: worker kill, process kill, network isolation, operator page.
45673. **Network-isolation last resort** — As a final safety, the agent can cut its own target network access.
45674. **Abort-testing harness** — The abort pipeline is tested regularly with synthetic fault injection.
45675. **Fault-injection drills** — Simulated target failures verify abort logic without touching real targets.
45676. **Abort-latency benchmark** — Abort latency is measured and must stay under the 2-second SLA.
45677. **Abort-coverage mapper** — Maps which abort conditions cover which hunt phases to find gaps.
45678. **Uncovered-phase alert** — Phases lacking abort coverage are flagged before the hunt starts.
45679. **Abort-condition customizer** — Operators can add custom abort conditions per program.
45680. **Custom-condition tester** — Custom conditions can be dry-run against historical hunts.
45681. **Abort-condition versioning** — Condition sets are versioned and attached to hunt records.
45682. **Abort-decision explainability** — Every abort logs the exact condition, threshold, and observed values.
45683. **Abort-false-positive review** — Aborts later judged unnecessary are reviewed to tune thresholds.
45684. **Threshold-tuning advisor** — Suggests threshold adjustments from false-positive history.
45685. **Abort-rate dashboard** — Shows abort frequency across hunts to spot systemic issues.
45686. **Abort-cluster analyzer** — Clusters aborts by cause to prioritize systemic fixes.
45687. **Near-abort logger** — Near-misses (thresholds almost hit) are logged for preventive tuning.
45688. **Near-miss trend review** — Recurring near-misses trigger proactive safety reviews.
45689. **Abort-communication log** — All abort-related communications are logged in one place.
45690. **Stakeholder-notification matrix (safety)** — Defines who gets notified for each abort class.
45691. **Notification-fatigue guard** — Batches non-critical abort notifications to avoid desensitizing operators.
45692. **Critical-abort paging** — Critical aborts page immediately through the operator's configured channel.
45693. **Abort-summary digest** — Daily digest of aborts across all hunts for the operator.
45694. **Program-owner abort report** — Owners get a clear, jargon-free explanation of any abort affecting their program.
45695. **Abort-transparency score** — Scores how completely each abort was detected, communicated, and documented.
45696. **Abort-playbook effectiveness review** — Playbooks are reviewed after each real use.
45697. **Playbook-update workflow** — Lessons learned update playbooks with version control.
45698. **Cross-hunt abort learning** — Abort lessons from one hunt improve conditions for future hunts.
45699. **Abort-lesson sharing (opt-in)** — Anonymized abort lessons can be shared across the user's hunts.
45700. **Abort-privacy guard** — Shared lessons never include target-identifying details.
45701. **Safety-abort certification** — Hunts with zero safety aborts earn a clean-run badge.
45702. **Abort-free streak tracker** — Tracks consecutive clean hunts as an operator safety metric.
45703. **Abort-drill certification** — Operators can certify on abort drills for team readiness.
45704. **Abort-maturity assessment** — A periodic assessment scores the whole abort system's readiness.
45705. **Immutable action log** — Every agent action is appended to a write-once log that no process can modify retroactively.
45706. **Hash-chained log entries (safety)** — Each log entry includes the hash of the previous one, making tampering detectable.
45707. **Per-request justification record** — Every request logs why it was sent: phase, hypothesis, and expected signal.
45708. **Justification-quality checker** — Flags vague justifications ("testing") and requires specific hypotheses.
45709. **Decision-point logging** — Every autonomous decision (escalate, pivot, stop) logs its inputs and rationale.
45710. **Operator-action attribution** — Manual overrides log who acted, what changed, and the stated reason.
45711. **Timestamped evidence capture** — Evidence is captured with trusted timestamps at the moment of observation.
45712. **Evidence-integrity hashing** — Evidence files are hashed on capture; hashes are logged immutably.
45713. **Chain-of-custody tracker (safety)** — Tracks who handled each evidence item from capture to report.
45714. **Tamper-evident storage** — Audit logs live in append-only storage with periodic integrity verification.
45715. **Log-integrity verifier** — A scheduled job re-verifies hash chains and alerts on any break.
45716. **WORM export option** — Audit packages can export to write-once-read-many storage for compliance.
45717. **Exportable audit package** — One click exports the full hunt record: logs, justifications, evidence, decisions.
45718. **Audit-package manifest** — Each export includes a signed manifest listing every contained file and hash.
45719. **Program-owner audit portal** — Owners get read-only access to their program's audit packages.
45720. **Owner-access audit log** — Owner views and downloads are themselves logged.
45721. **Compliance-format exports** — Audit data exports in formats mapped to SOC 2, ISO 27001, and PCI evidence needs.
45722. **Retention-policy enforcer (safety)** — Logs are retained per program policy, then securely deleted with a deletion certificate.
45723. **Deletion-certificate issuer** — Proof of secure deletion is issued and logged when retention expires.
45724. **Legal-hold support** — Legal holds suspend deletion for specified hunts with full audit of the hold.
45725. **Audit-log search** — Full-text search across the action log with filters by phase, actor, and outcome.
45726. **Timeline reconstructor** — Rebuilds a second-by-second hunt timeline from the log for review.
45727. **Log-anonymization for sharing** — Exports can anonymize target details while preserving action semantics.
45728. **Anonymization-verifier** — Verifies no target-identifying data leaks into anonymized exports.
45729. **Multi-hunt audit rollup** — Rolls up audit data across hunts for program-level compliance reviews.
45730. **Quarterly audit digest** — Auto-generates a quarterly safety and compliance summary for the operator.
45731. **Auditor-role access** — A read-only auditor role can inspect logs without hunt-control permissions.
45732. **Separation-of-duties** — The person who ran the hunt cannot solely approve its audit package.
45733. **Dual-approval for exports** — Sensitive audit exports require two approvals.
45734. **Export-watermarking** — Audit exports carry invisible watermarks identifying the recipient.
45735. **Leak-tracing support** — Watermarks allow tracing leaked audit packages back to the recipient.
45736. **Scope-attestation log** — The scope rules in force and every scope decision are part of the immutable log.
45737. **Rate-decision log** — Every rate change logs the signal observed and the new limit applied.
45738. **WAF-interaction log** — All WAF detections and blocks are immutably logged with evidence.
45739. **Impact-ledger log** — Impact spend per action is recorded in the tamper-evident ledger.
45740. **Abort-event log** — Every abort and near-abort is logged with full context.
45741. **Mutation log** — Every state-changing request logs before/after state and approval.
45742. **Window-compliance log** — Schedule decisions and window compliance are logged per phase.
45743. **Communication log (safety)** — Owner notifications, disclosure emails, and chat transcripts are archived.
45744. **Model-decision log** — Key AI judgments (severity, prioritization) log their inputs for reproducibility.
45745. **Configuration-change log (safety)** — Any config change mid-hunt is logged with old/new values.
45746. **Access log** — Every human access to hunt data is logged with identity and purpose.
45747. **API-call audit (safety)** — External API calls made by the agent are logged with purpose and response class.
45748. **Third-party interaction log** — Interactions with third-party services are logged separately for review.
45749. **Credential-use log** — Every use of a stored credential logs purpose without exposing the value.
45750. **Secret-handling log** — Discovered secrets log handling actions (fingerprinted, redacted, reported) without values.
45751. **Data-access log** — Any accessed user-data-like content logs what was touched and why, minimized.
45752. **Redaction log** — Every redaction action logs what was redacted and under which policy.
45753. **Evidence-access log** — Views of sensitive evidence are logged for accountability.
45754. **Report-generation log** — Report creation logs sources used and transformations applied.
45755. **Log-retention dashboard** — Shows retention status per hunt with upcoming deletion dates.
45756. **Pre-deletion review** — Operators review logs before scheduled deletion with an option to extend.
45757. **Deletion-approval workflow** — Deletions require approval; approvals are themselves logged.
45758. **Secure-deletion verifier** — Verifies deleted logs are unrecoverable and issues a certificate.
45759. **Audit-log backup** — Encrypted backups of audit logs with tested restore procedures.
45760. **Backup-restore drill** — Periodic drills verify audit backups actually restore.
45761. **Geo-redundant log storage** — Critical audit logs replicate across regions for durability.
45762. **Log-encryption at rest** — Audit logs are encrypted with keys managed per program.
45763. **Key-rotation for log encryption** — Encryption keys rotate on schedule without breaking hash chains.
45764. **Log-access MFA** — Accessing raw audit logs requires multi-factor authentication.
45765. **Break-glass log access** — Emergency access is possible but triggers immediate alerts and full logging.
45766. **Audit-log performance monitor** — Ensures logging never slows the hunt beyond a 5ms per-action budget.
45767. **Log-volume governor** — Caps log volume per hunt with sampling rules for high-frequency events.
45768. **Sampling-policy log** — When sampling applies, the policy and sample rate are logged.
45769. **Structured-log schema** — All audit events follow a versioned JSON schema for machine processing.
45770. **Schema-migration log** — Schema changes are versioned with migration records.
45771. **SIEM-integration exporter** — Streams audit events to the operator's SIEM in real time.
45772. **SIEM-format validator** — Validates exported events against the SIEM's expected schema.
45773. **Real-time audit stream** — Operators can tail the audit log live during a hunt.
45774. **Audit-alert rules** — Custom rules alert on patterns like repeated scope near-misses.
45775. **Alert-rule tester** — Alert rules can be tested against historical logs before activation.
45776. **Audit-anomaly detector** — ML flags unusual action patterns (e.g., sudden mutation spikes) for review.
45777. **Anomaly-investigation workflow** — Flagged anomalies get a structured investigation checklist.
45778. **Audit-completeness checker** — Verifies every hunt phase has complete log coverage with no gaps.
45779. **Gap-investigation protocol** — Log gaps trigger an investigation into whether logging or the hunt failed.
45780. **Clock-sync verifier** — Verifies log timestamps against NTP to prevent timeline disputes.
45781. **Timezone-normalized timestamps** — All timestamps store UTC with the target's local time as annotation.
45782. **Audit-log signing** — Periodic signatures by the operator's key attest to log completeness.
45783. **Third-party log attestation (safety)** — Optional timestamping-service attestation for legal-grade evidence.
45784. **Court-ready evidence pack** — Exports evidence with chain-of-custody documentation suitable for legal proceedings.
45785. **Evidence-admissibility checklist** — Checks evidence handling against admissibility requirements.
45786. **Audit-readiness scorer** — Scores each hunt on audit completeness for continuous improvement.
45787. **Readiness-trend tracker** — Tracks audit-readiness scores over time across hunts.
45788. **Audit-gap remediation planner** — Suggests specific fixes for recurring audit gaps.
45789. **Pre-hunt audit checklist** — Confirms logging, retention, and access controls before the first request.
45790. **Post-hunt audit review** — A guided review verifies the audit package is complete before archiving.
45791. **Audit-package approval** — The package needs sign-off before being shared externally.
45792. **Package-version tracker** — Shared packages are versioned so updates are traceable.
45793. **Recipient-access expiry** — Shared audit access expires automatically per policy.
45794. **Access-renewal workflow** — Recipients can request extensions with logged approval.
45795. **Audit-transparency report** — A public summary shows audit practices without exposing hunt details.
45796. **Trust-center integration** — Audit summaries feed the operator's trust center for customer assurance.
45797. **Certification-evidence mapper** — Maps audit data to specific certification control requirements.
45798. **Control-gap reporter** — Identifies certification controls lacking evidence from hunt data.
45799. **Continuous-compliance monitor (safety)** — Tracks compliance posture continuously, not just at audit time.
45800. **Compliance-drift alert** — Alerts when practices drift from the documented compliance baseline.
45801. **Baseline-update workflow** — Compliance baselines update through a reviewed, versioned process.
45802. **Audit-lesson repository** — Lessons from audits are stored and searchable for future hunts.
45803. **Lesson-application tracker** — Tracks whether audit lessons were actually applied.
45804. **Audit-maturity assessment** — A periodic assessment scores the audit system's overall maturity.
45805. **Disclosure-email drafter (safety)** — Generates a professional first-contact email to the program owner with finding summary and severity.
45806. **Severity-justified timeline builder** — Proposes disclosure timelines scaled to severity (critical = days, low = 90 days) with rationale.
45807. **Coordinated-disclosure tracker (safety)** — Tracks each finding through reported → acknowledged → fixed → disclosed states.
45808. **Program-policy compliance checker** — Verifies every disclosure step against the program's published policy before acting.
45809. **Safe-harbor language verifier** — Checks the program's safe-harbor clause covers the testing performed before disclosure.
45810. **Embargo manager (safety)** — Manages disclosure embargoes with automatic reminders before expiry.
45811. **Embargo-breach preventer** — Blocks premature public disclosure while an embargo is active.
45812. **Multi-vendor coordination helper** — When a finding spans vendors, drafts coordinated notifications with a shared timeline.
45813. **Vendor-contact resolver** — Finds the correct security contact from security.txt, policy pages, or program directories.
45814. **Contact-verification step** — Verifies security contacts through official channels before sending sensitive details.
45815. **PGP-encryption for disclosures** — Encrypts disclosure emails with the vendor's published PGP key when available.
45816. **Secure-channel recommender** — Recommends the vendor's preferred secure reporting channel over plain email.
45817. **Disclosure-template library** — Professional templates for initial report, follow-up, escalation, and public disclosure.
45818. **Template-tone calibrator** — Adjusts template tone (collaborative, never adversarial) based on program culture signals.
45819. **CVSS-justification writer** — Writes plain-language CVSS vector justifications for each finding.
45820. **Business-impact narrator** — Translates technical findings into business-impact language owners understand.
45821. **Remediation-guidance generator** — Produces specific, actionable fix guidance tailored to the finding.
45822. **Fix-verification offer** — Offers the program a free retest window after remediation, scheduled safely.
45823. **Retest-scheduling assistant (safety)** — Coordinates retest timing within safe windows with minimal target load.
45824. **Disclosure-timeline negotiator** — Drafts timeline-extension requests when fixes need more time, with justification.
45825. **Good-faith extension granter** — Tracks when the operator grants extensions and logs the reasoning.
45826. **Non-responsive-vendor escalator** — A graduated escalation path for vendors who don't acknowledge reports.
45827. **Escalation-timeline guardrails** — Escalations follow industry norms (e.g., 90-day default) unless the program states otherwise.
45828. **Public-disclosure readiness check** — Verifies fix deployment and embargo expiry before any public writeup.
45829. **Disclosure-impact reviewer** — Reviews public writeups to ensure no unpatched details or third-party harm.
45830. **Coordinated-release planner (safety)** — Plans simultaneous vendor-patch and publication timing.
45831. **CVE-request assistant (safety)** — Drafts CVE requests with proper descriptions and references when appropriate.
45832. **CWE-mapping verifier** — Verifies each finding's CWE mapping for accurate classification.
45833. **Disclosure-credit tracker** — Tracks researcher credit and hall-of-fame listings per program.
45834. **Bounty-eligibility checker** — Checks findings against program bounty tables before submission.
45835. **Duplicate-finding checker** — Searches program history and public disclosures to avoid duplicate submissions.
45836. **Report-quality scorer** — Scores draft disclosures on clarity, evidence, and reproducibility before sending.
45837. **Reproducibility verifier (safety)** — Confirms each PoC reproduces cleanly in a fresh session before disclosure.
45838. **Minimal-PoC standard** — PoCs include only the steps needed to reproduce, nothing extra.
45839. **Environment-notes attacher** — Attaches test environment details so vendors can reproduce accurately.
45840. **False-positive self-filter** — Re-verifies findings once more before disclosure to avoid wasting vendor time.
45841. **Vendor-question responder** — Drafts clear answers to common vendor follow-up questions from hunt evidence.
45842. **Triage-call preparation** — Prepares a briefing pack for live triage calls with vendors.
45843. **Disclosure-meeting notes** — Structured templates for recording vendor discussion outcomes.
45844. **Agreement-tracker** — Tracks verbal/written agreements with vendors (timelines, credit, scope of writeup).
45845. **NDA-awareness check** — Flags when a program's NDA terms affect what can be publicly discussed.
45846. **Legal-review trigger** — Suggests legal review before disclosing findings with regulatory implications.
45847. **Regulatory-notification helper** — Drafts notifications for regulators when the law requires breach disclosure.
45848. **Breach-notification assessor** — Assesses whether observed exposures trigger breach-notification obligations.
45849. **Data-protection liaison draft** — Drafts DPO notifications for findings involving personal data.
45850. **Sector-specific disclosure norms** — Applies healthcare, finance, and government disclosure norms where relevant.
45851. **Critical-infrastructure caution** — Extra coordination steps for findings in critical-infrastructure targets.
45852. **Active-exploitation reporter** — If active exploitation is observed, drafts an urgent, responsible notification.
45853. **Exploitation-evidence preserver** — Preserves exploitation evidence immutably for vendor and law-enforcement use.
45854. **Law-enforcement liaison draft** — Drafts a factual referral when criminal activity is observed, without speculation.
45855. **Victim-notification support** — Helps draft notifications if the finding indicates third parties are affected.
45856. **Supply-chain disclosure helper** — Coordinates disclosure when the flaw lies in a third-party component.
45857. **Upstream-notification drafter** — Drafts notifications to upstream maintainers for open-source flaws.
45858. **Downstream-impact assessor** — Assesses how many downstream users a component flaw affects for timeline urgency.
45859. **Patch-availability tracker** — Tracks vendor patch releases to time public disclosure correctly.
45860. **Patch-verification retest** — Re-tests after patching to confirm the fix before disclosure closes.
45861. **Incomplete-fix detector (safety)** — Detects partial fixes and drafts a respectful follow-up with new evidence.
45862. **Regression-tracker** — Watches for the flaw reappearing in later versions and re-notifies.
45863. **Disclosure-archive** — Archives every disclosure with full correspondence for the operator's records.
45864. **Correspondence-timeline builder** — Builds a timeline of all vendor correspondence per finding.
45865. **Response-time tracker (safety)** — Tracks vendor response times to inform future timeline expectations.
45866. **Vendor-reliability scorer** — Scores vendors on responsiveness to help plan disclosure strategies.
45867. **Relationship-health dashboard** — Shows the operator's disclosure relationship health per program.
45868. **Gratitude-note drafter** — Drafts professional thank-you notes to responsive vendors.
45869. **Testimonial-request helper** — Requests permission to cite cooperative vendors in case studies.
45870. **Case-study builder** — Builds anonymized case studies from exemplary coordinated disclosures.
45871. **Disclosure-metrics reporter** — Reports mean-time-to-acknowledge, fix, and disclose across programs.
45872. **SLA-compliance tracker** — Tracks vendor SLA compliance on disclosure timelines.
45873. **Policy-feedback drafter** — Drafts constructive feedback when a program's disclosure policy caused friction.
45874. **Program-policy improver** — Suggests policy improvements based on disclosure experience.
45875. **Safe-harbor advocacy notes** — Documents safe-harbor gaps to support industry advocacy.
45876. **Disclosure-training material** — Generates training summaries from past disclosures for team learning.
45877. **New-researcher disclosure guide** — An onboarding guide teaching responsible disclosure norms.
45878. **Disclosure-ethics checklist** — A pre-send checklist covering accuracy, tone, legality, and embargo compliance.
45879. **Accidental-disclosure preventer** — Scans outgoing disclosures for embargoed or out-of-scope details.
45880. **Recipient-verification** — Double-checks recipient addresses against verified security contacts before sending.
45881. **Send-confirmation logger** — Logs every disclosure sent with timestamp, recipient, and content hash.
45882. **Read-receipt tracker (safety)** — Tracks acknowledgments without intrusive read-receipt demands.
45883. **Follow-up scheduler (safety)** — Schedules polite follow-ups at policy-appropriate intervals.
45884. **Follow-up tone manager** — Keeps follow-ups professional and patient, never threatening.
45885. **Stale-disclosure reviewer** — Flags disclosures stalled beyond expected timelines for operator review.
45886. **Disclosure-closure checklist** — Verifies fix, credit, and archive completeness before closing.
45887. **Post-disclosure retrospective** — A structured review of what went well and what to improve.
45888. **Retrospective-action tracker** — Tracks improvement actions from retrospectives.
45889. **Disclosure-playbook library** — Playbooks for standard, urgent, multi-vendor, and hostile-vendor scenarios.
45890. **Playbook-selector** — Recommends the right playbook based on finding severity and vendor profile.
45891. **Disclosure-simulator** — Lets new operators practice disclosures against simulated vendors.
45892. **Simulation-scorer** — Scores practice disclosures on professionalism and completeness.
45893. **Cross-program disclosure norms** — Compares disclosure norms across programs to set expectations.
45894. **Norm-deviation flagger** — Flags when a planned disclosure deviates from established norms.
45895. **Disclosure-risk assessor** — Assesses legal and reputational risk of each disclosure plan.
45896. **Risk-mitigation planner** — Plans mitigations for identified disclosure risks.
45897. **Insurance-notification helper** — Drafts cyber-insurance notifications when incidents require them.
45898. **Media-inquiry handler** — Prepares holding statements if a disclosure attracts press attention.
45899. **Public-writeup reviewer** — Reviews public technical writeups for safety before publication.
45900. **Writeup-embargo checker** — Verifies all embargoes cleared before a writeup goes live.
45901. **Community-disclosure norms guide** — Guidance on sharing with the security community responsibly.
45902. **Conference-talk preparer** — Helps prepare conference talks from disclosed research with vendor approval.
45903. **Disclosure-maturity score** — Scores the operator's disclosure practice maturity over time.
45904. **Responsible-disclosure certification** — Hunts earn a badge when every finding followed the full responsible-disclosure workflow.
45905. **Safety dashboard** — A single live view of rate status, impact spend, scope health, WAF events, and abort readiness.
45906. **Per-hunt safety score** — A 0–100 score combining scope adherence, impact control, and incident history.
45907. **Safety-score trend chart** — Tracks the safety score across hunts to show improvement or drift.
45908. **Operator override controls** — Clearly labeled controls to pause, slow, or stop any aspect of the hunt instantly.
45909. **Override-audit trail** — Every override logs who, what, when, and why.
45910. **Dry-run preview** — Shows the exact planned actions for a phase before it runs, with predicted impact.
45911. **Dry-run diff viewer** — Compares the planned run against the previous hunt's plan.
45912. **Traffic-light status indicator** — Green/amber/red safety status visible at all times during the hunt.
45913. **Live request monitor** — A real-time feed of outbound requests with rate, target, and purpose.
45914. **Request-inspector** — Click any live request to see its justification, impact score, and scope verdict.
45915. **One-click pause/resume (safety)** — A single control pauses all workers gracefully and resumes from checkpoints.
45916. **Phase-control panel** — Start, pause, skip, or replan individual phases independently.
45917. **Module-safety toggles** — Enable or disable modules per safety profile with one switch each.
45918. **Safety-profile editor** — A visual editor for gentle/balanced/aggressive profiles with plain-language effects.
45919. **Profile-impact preview** — Shows predicted request volume and impact before applying a profile.
45920. **Per-module rate sliders** — Fine-tune per-module request rates with live budget feedback.
45921. **Global rate-limit slider** — One slider caps the entire hunt's request rate instantly.
45922. **Impact-budget editor** — Set and adjust the hunt's impact budget with spend projections.
45923. **Budget-spend gauge** — A live gauge shows impact budget consumed vs. remaining.
45924. **High-risk action approval queue** — High-impact actions wait here for operator review with full context.
45925. **Approval-queue SLA timer** — Shows how long each action has waited to keep reviews timely.
45926. **Bulk-approval guard** — Prevents blind bulk-approvals; each action needs individual review.
45927. **Approval-delegation** — Operators can delegate approvals for defined action classes with limits.
45928. **Delegation-audit log** — Delegations and their use are fully logged.
45929. **Safety-incident inbox** — All safety incidents (near-misses, violations, aborts) arrive in one triage inbox.
45930. **Incident-triage workflow** — Structured triage: acknowledge, investigate, remediate, close.
45931. **Incident-severity auto-tagging** — Incidents are auto-tagged by severity with operator override.
45932. **Safety-policy editor** — Edit destructiveness tiers, abort thresholds, and window rules visually.
45933. **Policy-change preview** — Shows the effect of policy changes on running and planned hunts.
45934. **Policy-version history** — Every policy change is versioned with diffs and authors.
45935. **Policy-simulator** — Simulates a policy against historical hunts to preview its effect.
45936. **Pre-hunt safety checklist** — An interactive checklist (scope, windows, budget, contacts) before launch.
45937. **Checklist-completion gate** — The hunt cannot start until the checklist is complete.
45938. **Launch-readiness score** — Scores readiness from checklist completeness and config sanity.
45939. **Safety-briefing generator** — Generates a plain-language briefing of what the hunt will do and its safeguards.
45940. **Briefing-share link** — Share the safety briefing with stakeholders via an expiring link.
45941. **Stakeholder-notification center** — Manage who gets notified for windows, aborts, and completions.
45942. **Notification-preference editor** — Per-stakeholder preferences for channels and frequency.
45943. **Quiet-mode toggle** — Reduces non-critical notifications during focused work.
45944. **Critical-alert bypass** — Critical safety alerts always break through quiet mode.
45945. **Mobile safety companion** — A mobile view for monitoring safety status and hitting the panic button remotely.
45946. **Panic-button widget** — A home-screen widget for instant hunt shutdown.
45947. **Voice-command safety stop** — A voice command ("stop the hunt") triggers the same instant shutdown.
45948. **Safety-status screensaver** — An ambient display showing hunt safety status for ops rooms.
45949. **Multi-hunt safety overview** — One screen comparing safety scores across all active hunts.
45950. **Hunt-comparison tool** — Side-by-side safety comparison of two hunts.
45951. **Safety-leaderboard (private)** — Ranks the operator's hunts by safety score for self-improvement.
45952. **Safety-goal setter** — Set safety-score goals per quarter and track progress.
45953. **Goal-progress tracker** — Visual progress toward safety goals.
45954. **Safety-coaching tips** — Contextual tips suggest safer configurations based on hunt patterns.
45955. **Unsafe-pattern warner** — Warns when a configuration matches historically incident-prone patterns.
45956. **Configuration-linter** — Flags contradictory or risky hunt configurations before launch.
45957. **Safe-default restorer** — One click restores all safety settings to vetted defaults.
45958. **Configuration-diff viewer** — Shows exactly what changed between config versions.
45959. **Config-change approval** — Risky config changes need a second pair of eyes.
45960. **Safety-tour for new users** — An interactive tour teaching safety features on first use.
45961. **Contextual safety help** — Every safety control links to plain-language documentation.
45962. **Safety-glossary** — Defines terms like impact budget and destructiveness tier in plain language.
45963. **Video-safety briefings** — Short videos explaining key safety concepts.
45964. **Safety-certification quiz** — Operators can certify their safety knowledge with a quiz.
45965. **Certification-badge display** — Certified operators show a badge on their profile.
45966. **Team-safety dashboard** — Team leads see aggregate safety metrics across operators.
45967. **Operator-safety coaching** — Private coaching insights help operators improve safety scores.
45968. **Safety-standup digest** — A morning digest of safety status across active hunts.
45969. **Weekly safety report** — Auto-generated weekly summary of safety metrics and incidents.
45970. **Monthly safety review pack** — A review pack for monthly safety retrospectives.
45971. **Safety-OKR tracker** — Tracks safety objectives and key results for the team.
45972. **Incident-heatmap** — Visualizes where and when safety incidents cluster.
45973. **Risk-concentration view** — Shows which targets or phases concentrate the most risk.
45974. **Safety-drill scheduler** — Schedules regular safety drills (abort, breach-scare, scope-change).
45975. **Drill-calendar integration** — Drills appear on the operator's calendar.
45976. **Drill-results dashboard** — Tracks drill performance over time.
45977. **Safety-maturity model** — A five-level model showing the operator's safety-practice maturity.
45978. **Maturity-assessment wizard** — A guided assessment placing the operator on the maturity model.
45979. **Improvement-roadmap generator** — Generates a prioritized roadmap to the next maturity level.
45980. **Roadmap-progress tracker** — Tracks roadmap completion.
45981. **Peer-safety benchmarks (opt-in)** — Anonymous benchmarks against similar operators.
45982. **Benchmark-privacy guard** — Benchmarks never expose identifying details.
45983. **Safety-champion program** — Recognizes operators with exemplary safety records.
45984. **Safety-feedback channel** — Operators can suggest safety-feature improvements directly.
45985. **Feature-request tracker** — Tracks safety feature requests to delivery.
45986. **Safety-changelog** — A changelog of safety-system improvements per release.
45987. **Release-safety notes** — Each release documents its safety implications.
45988. **Deprecation-safety review** — Removing safety features requires a formal review.
45989. **Accessibility of safety controls** — All safety controls meet accessibility standards for operability under stress.
45990. **High-contrast safety mode** — Critical safety states are perceivable in high-contrast mode.
45991. **Keyboard-only safety operation** — Every safety control is operable by keyboard alone.
45992. **Screen-reader safety labels** — Safety states announce correctly to screen readers.
45993. **Safety-control localization** — Safety UI is translated so non-English operators act correctly under pressure.
45994. **Offline safety reference** — Key safety procedures are available offline during incidents.
45995. **Printable safety playbook** — A printable quick-reference for incident response.
45996. **Safety-contact directory** — One-tap access to program security contacts during incidents.
45997. **Escalation-path visualizer** — Shows exactly who gets contacted at each escalation level.
45998. **Post-incident safety debrief** — A guided debrief captures lessons after every incident.
45999. **Debrief-action tracker** — Debrief actions are tracked to completion.
46000. **Safety-retrospective scheduler** — Schedules regular retrospectives on safety performance.
46001. **Continuous-safety-improvement loop** — Incidents, drills, and feedback feed a visible improvement backlog.
46002. **Improvement-backlog dashboard** — The backlog is visible with priorities and owners.
46003. **Safety-transparency page** — A public page describing the agent's safety practices for program owners.
46004. **Safety-commitment statement** — A published commitment to responsible, non-destructive testing signed by the operator.
