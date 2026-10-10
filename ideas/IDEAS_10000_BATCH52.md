# Dark-Matter IDEAS — Batch 52: API gateway & schema-governance security posture, WebSocket/streaming & real-time protocol hardening, DNS, CDN & edge-delivery security verification, OAuth/OIDC & federated identity integration safety, Session lifecycle & token-bridge assurance, Payment & billing-infrastructure integrity, CI/CD pipeline & supply-chain hygiene, Container & orchestration security posture, AI/LLM integration & prompt-surface safety, IoT & connected-device attack-surface review (141005–142004)
> 1,000 ideas 141005–142004, generated 2026-10-11.
> Professional English. Defensive/product framing.

Batch 52 covers ten fresh capability frontiers: API gateway & schema-governance security posture (141005–141104), WebSocket/streaming & real-time protocol hardening (141105–141204), DNS, CDN & edge-delivery security verification (141205–141304), OAuth/OIDC & federated identity integration safety (141305–141404), Session lifecycle & token-bridge assurance (141405–141504), Payment & billing-infrastructure integrity (141505–141604), CI/CD pipeline & supply-chain hygiene (141605–141704), Container & orchestration security posture (141705–141804), AI/LLM integration & prompt-surface safety (141805–141904), IoT & connected-device attack-surface review (141905–142004) — each framed as defensive capabilities of an authorized bug-bounty agent.

| # | Category | Ideas |
|---|----------|-------|
| 1 | API gateway & schema-governance security posture | 141005–141104 |
| 2 | WebSocket/streaming & real-time protocol hardening | 141105–141204 |
| 3 | DNS, CDN & edge-delivery security verification | 141205–141304 |
| 4 | OAuth/OIDC & federated identity integration safety | 141305–141404 |
| 5 | Session lifecycle & token-bridge assurance | 141405–141504 |
| 6 | Payment & billing-infrastructure integrity | 141505–141604 |
| 7 | CI/CD pipeline & supply-chain hygiene | 141605–141704 |
| 8 | Container & orchestration security posture | 141705–141804 |
| 9 | AI/LLM integration & prompt-surface safety | 141805–141904 |
| 10 | IoT & connected-device attack-surface review | 141905–142004 |

141005. **Undocumented Endpoint Discovery Audit** — crawl and diff live routes against the published OpenAPI spec to surface undocumented endpoints, since hidden routes skip the security review the documented ones get.
141006. **Shadow API Traffic Baseline Detector** — compare gateway access logs against the service registry to flag endpoints receiving real traffic that no team owns, since shadow APIs become unpatched attack surface.
141007. **Orphaned Version Route Sweeper** — enumerate old API version prefixes still responding and verify each is intentional, since forgotten v1 routes keep serving with decade-old auth logic.
141008. **Staging Mirror Endpoint Exposure Check** — probe whether staging or dev gateway hostnames answer on production IPs, since mirrored environments leak debug endpoints and real credentials.
141009. **Internal Admin Route Leakage Test** — request gateway paths containing admin, internal, debug, or ops markers from an external client, since routing misconfigurations expose internal tooling.
141010. **Partner API Scope Creep Audit** — verify that third-party partner keys can only reach their contracted endpoints, since overly broad partner access turns a vendor breach into your breach.
141011. **Mobile Backend Endpoint Parity Review** — diff the routes the mobile app actually calls against the public API docs, since mobile-only endpoints often ship without gateway auth checks.
141012. **Webhook Receiver Route Inventory** — list every inbound webhook URL and verify HMAC or secret validation on each, since unauthenticated receivers accept forged events that drive business logic.
141013. **Deprecated Endpoint Sunset Compliance Check** — verify that endpoints past their announced sunset date actually return 410 Gone, since zombie endpoints linger with known flaws.
141014. **Sunset Header Presence Audit** — check that deprecated endpoints return Sunset and Deprecation headers with dates, since silent deprecations leave clients and hunters guessing.
141015. **Breaking-Change Detection Between Releases** — diff consecutive OpenAPI snapshots for removed fields or tightened types, since unannounced breaking changes desynchronize client validation.
141016. **Schema Drift Live Diff Monitor** — compare live request validation behavior against the checked-in schema on every deploy, since drifted validation silently admits malformed payloads.
141017. **Response Schema Leakage Review** — verify that error and success responses never include fields absent from the published schema, since extra fields leak internal data models.
141018. **Additional-Properties Default Audit** — test whether object schemas default to allowing undeclared properties, since permissive defaults let attackers smuggle unexpected keys.
141019. **Required-Field Enforcement Spot Check** — submit requests omitting each required field and confirm rejection, since missing required-field checks corrupt downstream state.
141020. **Type-Coercion Validation Test** — send strings where numbers are expected and booleans where strings are expected, since lenient coercion bypasses input sanitization.
141021. **Enum Value Strictness Check** — submit out-of-enum values to every enum-typed parameter, since unvalidated enums reach code paths the developers never tested.
141022. **Format Validator Bypass Probe** — test email, UUID, and date formats with edge-case strings to see if format keywords are actually enforced, since decorative formats invite injection.
141023. **Maximum-Length Enforcement Audit** — send oversized strings to every documented maxLength field, since unenforced limits enable buffer abuse and storage DoS.
141024. **Nested Object Depth Limit Test** — submit deeply nested JSON payloads to verify a depth cap, since unbounded nesting exhausts parsers and memory.
141025. **Array Size Cap Verification** — send arrays far beyond any documented maximum, since uncapped arrays turn one request into a batch-processing DoS.
141026. **GraphQL Introspection Exposure Audit** — query __schema on production to verify introspection is disabled, since a live schema hands attackers the full attack map.
141027. **GraphQL Field Suggestion Leakage Check** — trigger did-you-mean error messages and verify they do not reveal hidden fields, since suggestions enumerate non-public schema parts.
141028. **GraphQL Query Cost Analyzer Review** — submit deeply nested queries and confirm a cost or complexity limit rejects them, since unbounded queries are trivial DoS.
141029. **GraphQL Batching Abuse Test** — pack dozens of aliased mutations into one request to verify batch limits, since batching multiplies the impact of every other flaw.
141030. **Persisted Query Allowlist Enforcement** — verify that only pre-registered persisted queries execute in production, since arbitrary query execution defeats complexity budgeting.
141031. **GraphQL Field-Level Authorization Audit** — request sensitive fields as a low-privilege user to confirm resolver-level checks, since type-level auth misses field-level leaks.
141032. **GraphQL Directive Abuse Review** — test @include, @skip, and custom directives for auth bypass, since directives execute before some authorization layers.
141033. **REST Mass-Assignment Guard Test** — attempt to set read-only fields like role or balance through update endpoints, since unguarded binding grants privilege escalation.
141034. **PATCH Semantics Confusion Audit** — compare JSON Merge Patch versus JSON Patch handling to verify semantics match documentation, since confused patching corrupts records.
141035. **Header-Driven Verb Spoofing Check** — verify X-HTTP-Method-Override and similar headers cannot turn a safe-method request into a state-changing one, since gateway auth often keys off the original verb.
141036. **Verb Tampering Access Check** — replay an authorized GET as HEAD, OPTIONS, or an invented verb on protected routes, since some gateways only guard GET and POST.
141037. **Parameter Pollution Resilience Test** — duplicate query parameters with conflicting values to see which one the backend honors, since pollution flips authorization decisions.
141038. **Trailing-Slash Route Duplication Audit** — request each endpoint with and without trailing slashes to find duplicates with different auth, since routers treat them as distinct routes.
141039. **Case-Sensitivity Routing Mismatch Check** — vary path casing to detect routes that bypass case-sensitive auth middleware, since /Admin and /admin may resolve differently.
141040. **URL Normalization Bypass Probe** — test encoded slashes, dots, and semicolons against gateway routing, since normalization gaps reach backend-only paths.
141041. **Duplicate Alias Route Inventory** — list all registered aliases for the same handler and verify identical auth on each, since aliases are added without security review.
141042. **Gateway Authentication Enforcement Sweep** — hit every route without credentials and confirm 401 or 403, since one unguarded route in a guarded API is the classic finding.
141043. **Anonymous Route Justification Audit** — review each intentionally public endpoint for a documented business reason, since public-by-default accumulates over time.
141044. **Query-String Credential Exposure Audit** — verify that no documented flow requires secrets in query strings, since URLs persist in logs, caches, and referrer headers.
141045. **Legacy Basic-Auth Remnant Scan** — probe for endpoints still accepting basic auth or legacy tokens, since remnants survive migrations with weaker credential policies.
141046. **Session-Token Mixing Confusion Test** — send a session cookie to a token-only endpoint and vice versa, since mixed auth modes confuse identity resolution.
141047. **Gateway JWT Validation Completeness Audit** — verify signature, expiry, issuer, and audience are all checked at the gateway, since partial validation admits forged tokens.
141048. **JWKS Rotation Readiness Review** — confirm the gateway handles key rotation without downtime or fallback to stale keys, since rotation windows are prime forgery time.
141049. **Algorithm Confusion Gateway Guard** — attempt none-algorithm and RS256-to-HS256 confusion tokens at the gateway, since gateway-level JWT parsing is a common weak point.
141050. **Token Binding Enforcement Check** — verify that tokens bound to a client certificate or DPoP key are rejected when presented without the binding proof, since unbound bearer tokens replay freely.
141051. **Scope Granularity Audit** — review whether scopes are fine-grained enough to express least privilege, since coarse scopes like full-access defeat key scoping.
141052. **Scope Downgrade Attack Test** — request a token with reduced scopes then attempt higher-privilege calls, since some gateways cache the original grant.
141053. **Granted-Scope Expansion Drift Audit** — diff currently granted OAuth scopes against originally approved ones for long-lived integrations, since re-auth flows quietly widen permissions.
141054. **Key-Scoped Endpoint Mapping** — verify each API key's allowed endpoints match its documented purpose, since keys issued for one integration get reused everywhere.
141055. **Tenant-Scoped Key Isolation Test** — use one tenant's key to request another tenant's resources, since missing tenant binding is cross-tenant access.
141056. **API Key Lifecycle Hygiene Audit** — check for keys older than the rotation policy and keys belonging to departed staff, since stale keys are silent persistence.
141057. **Key Revocation Propagation Timing** — revoke a key and measure how fast every gateway node stops accepting it, since slow propagation leaves a usable window.
141058. **Rate-Limit Posture Mapping** — probe each endpoint to document actual limits versus documented ones, since undocumented endpoints often have no limits at all.
141059. **Per-Tenant Rate-Limit Isolation Test** — exhaust one tenant's quota and confirm other tenants are unaffected, since shared buckets let one abuser throttle everyone.
141060. **Burst Versus Sustained Limit Review** — test short bursts against sustained-rate limits to find burst windows, since burst tolerance enables credential-stuffing bursts.
141061. **Cost-Based Rate Limiting Audit** — verify expensive endpoints have tighter limits than cheap ones, since uniform limits let attackers hammer the costliest operations.
141062. **Rate-Limit Header Leakage Check** — inspect X-RateLimit headers for internal quota values or tenant identifiers, since headers leak capacity planning data.
141063. **Retry-After Manipulation Test** — verify clients cannot shorten backoff by altering Retry-After handling server-side, since the header is advisory but often trusted.
141064. **Quota Reset Timing Predictability Audit** — determine whether quota windows reset on fixed boundaries attackers can time, since predictable resets enable metered abuse.
141065. **429 Response Consistency Check** — confirm every rate-limited endpoint returns 429 rather than 200 with an error body, since inconsistent signals confuse client retry logic.
141066. **IP-Based Allowlist Bypass Probe** — test X-Forwarded-For and similar headers against IP allowlisted endpoints, since gateways behind proxies misidentify clients.
141067. **Geofencing Enforcement Verification** — request region-restricted endpoints from disallowed regions via the gateway, since geofence checks often live only in the app layer.
141068. **mTLS Client Certificate Enforcement** — verify the gateway rejects requests without valid client certificates on mTLS routes, since optional mTLS is no mTLS.
141069. **TLS Termination Downgrade Audit** — check that the gateway never forwards credentials over plaintext to backends, since termination points are where TLS gets forgotten.
141070. **Gateway Plugin Vulnerability Inventory** — list all installed gateway plugins and Lua or WASM extensions with versions, since custom plugins are unaudited code in the request path.
141071. **Request Transformation Integrity Check** — verify gateway request rewriting does not strip auth headers or inject trusted internal headers, since transformations can forge identity.
141072. **Response Transformation Data Leak Audit** — check that gateway response masking actually removes sensitive fields in all content types, since masking regexes miss nested structures.
141073. **Gateway Caching Poisoning Test** — attempt to poison cached responses via unkeyed headers or query parameters, since poisoned cache serves attacker content to everyone.
141074. **Cache Key Completeness Review** — verify cache keys include authorization context, since shared cache entries leak one user's response to another.
141075. **Request Smuggling at Gateway Probe** — test CL.TE and TE.CL desync between gateway and backends, since smuggled requests bypass gateway auth entirely.
141076. **Content-Type Confusion Audit** — send JSON bodies with XML content types and vice versa, since parser selection bugs route data past validation.
141077. **Multipart Parsing Boundary Test** — submit malformed multipart boundaries to file-upload endpoints, since parser differences let files slip past type checks.
141078. **Pagination Cursor Integrity Check** — tamper with opaque cursors to verify they are signed or validated, since forged cursors skip records or access others' pages.
141079. **Dynamic Query-Builder Injection Probe** — inject sort, filter, and order parameters to test for injection through ORM query builders, since dynamic sorting is string-concatenated more often than admitted.
141080. **Batch-Item Authorization Completeness Check** — verify bulk endpoints check authorization per item, not just per request, since one authorized item smuggles a hundred unauthorized ones.
141081. **Async Job Endpoint Polling Abuse Test** — verify job-status endpoints enforce ownership of the job ID, since sequential job IDs let attackers read others' results.
141082. **Callback URL SSRF Guard Review** — submit internal URLs as webhook callbacks at the gateway, since callback registration is a classic SSRF vector.
141083. **Redirect Handling Openness Check** — test redirect parameters on API endpoints for open-redirect behavior, since APIs that redirect are rarely audited for it.
141084. **CORS Policy at Gateway Audit** — verify Access-Control-Allow-Origin never reflects arbitrary origins with credentials, since gateway-level CORS misconfig defeats browser isolation.
141085. **OPTIONS Preflight Response Integrity Test** — check that cached preflight responses cannot be manipulated to widen allowed methods, since stale preflights expand the attack surface.
141086. **API Version Negotiation Confusion Test** — mix version headers, query params, and path prefixes to find which version actually serves, since negotiation bugs serve the wrong version's auth rules.
141087. **Accept-Header Version Drift Audit** — verify custom media-type versioning maps to the intended handler, since Accept-header routing is rarely fuzzed.
141088. **SDK and Schema Drift Detector** — diff official SDK method signatures against the live schema, since drifted SDKs call endpoints with stale assumptions.
141089. **Schema Registry Freshness Check** — verify the gateway validates against the current schema version, not a cached older one, since stale schemas admit removed fields.
141090. **Contract Test Coverage Audit** — check that consumer-driven contract tests run on every gateway change, since untested changes break client security assumptions.
141091. **Error Verbosity Standardization Review** — verify error responses use generic codes without stack traces or SQL fragments, since verbose errors map the backend.
141092. **Error Code Enumeration Guard** — test whether distinct error codes let attackers distinguish valid from invalid resource IDs, since enumeration enables targeted attacks.
141093. **Health Check Endpoint Exposure Audit** — verify /health, /ready, and /metrics do not leak version or dependency details publicly, since health endpoints are reconnaissance gold.
141094. **Metrics Endpoint Authorization Check** — confirm Prometheus-style metrics endpoints require auth, since metrics leak request patterns and internal hostnames.
141095. **API Analytics Anomaly Baseline** — establish per-endpoint traffic baselines so sudden pattern shifts trigger review, since anomalies precede discovered abuse.
141096. **Gateway Access Log Completeness Audit** — verify logs capture authenticated identity, not just IP, for every request, since IP-only logs cannot attribute abuse.
141097. **gRPC Schema Safety Review** — verify .proto definitions are not served publicly and reflection is disabled, since exposed protos map every RPC method.
141098. **gRPC Transcoding Parity Test** — compare gRPC-native and REST-transcoded paths for identical auth, since transcoding layers often skip interceptors.
141099. **Legacy SOAP Endpoint Inventory** — enumerate surviving SOAP or XML-RPC endpoints and verify they meet current auth standards, since legacy protocols escape modern gateway policies.
141100. **XML External Entity Gateway Guard** — submit XXE payloads to XML-accepting endpoints to verify parser hardening, since gateway XML parsing is a forgotten vector.
141101. **Idempotency Key Enforcement Test** — replay requests with reused idempotency keys to verify duplicate suppression, since missing idempotency double-charges and double-creates.
141102. **Idempotency Key Scope Audit** — verify idempotency keys are scoped per user and per operation, since global keys let one user replay another's requests.
141103. **Deprecated-Shadow Endpoint Cross-Check** — correlate deprecated endpoint lists with live traffic to find shadows still called by old clients, since shadows keep vulnerable code reachable.
141104. **Gateway Configuration Drift Detector** — snapshot gateway routes, plugins, and policies into version control and alert on unreviewed changes, since manual console edits bypass change review.
141105. **Upgrade Request Origin Allowlist Verification** — verify that the WebSocket upgrade endpoint validates the Origin header against an allowlist, since a missing check lets any site open an authenticated socket in the victim's browser.
141106. **Upgrade Cookie Auth Binding Check** — confirm that session cookies accepted on the HTTP upgrade request are bound to the resulting socket, because unauthenticated sockets inheriting ambient credentials leak data to cross-site pages.
141107. **Handshake Query-String Credential Exposure Review** — test whether auth tokens passed as WebSocket query parameters get logged by proxies and retained in server logs, since URLs are not secret storage.
141108. **Sec-WebSocket-Protocol Downgrade Detector** — check whether the server accepts an attacker-chosen subprotocol during negotiation, which can bypass protocol-level message validation assumptions.
141109. **Upgrade CSRF Ticket Nonce Review** — verify that WebSocket connections require a single-use CSRF ticket issued over an authenticated HTTP call, closing the cross-site WebSocket hijacking path.
141110. **Socket Auth Expiry Enforcement Test** — hold a socket open past the underlying session or JWT expiry and confirm the server terminates it, since a sessionless socket is a stale credential.
141111. **Role-Change Mid-Socket Revocation Check** — downgrade the user's role while a socket is live and verify topic subscriptions are re-evaluated, because privilege changes must propagate to open streams.
141112. **Logout Socket Drain Audit** — confirm that logging out invalidates all associated sockets within seconds, as orphaned sockets after logout let a shared machine keep receiving sensitive events.
141113. **Multi-Device Socket Token Isolation Test** — verify that revoking one device's session does not leave its sockets silently alive, since device-level logout must kill its streams too.
141114. **Re-auth on Sensitive Channel Elevation** — check that subscribing to elevated topics re-prompts or re-validates authorization rather than inheriting the base socket's trust.
141115. **Token Refresh Race Gap Measurement** — measure the window between access-token expiry and refreshed socket re-auth to confirm no unauthenticated frames are accepted during the race.
141116. **Impersonation-Header Injection on Upgrade** — test whether headers like X-User-Id or X-Forwarded-User on the upgrade request can override the authenticated identity of the socket.
141117. **Anonymous Socket Rate and Scope Ceiling** — verify that sockets with no credentials get a hard-limited scope and throttle, since public endpoints are abused as free message relays.
141118. **Service-to-Service Socket mTLS Verification** — confirm that internal pub/sub bridge sockets require mutual TLS, because plaintext internal streams become network eavesdropping targets.
141119. **Auth Ticket Replay Across Devices Test** — replay a captured single-use upgrade ticket from a second device and verify the server rejects it, closing ticket-sharing abuse.
141120. **Session Fixation on Socket Id Check** — verify the server assigns a fresh socket session identifier at upgrade rather than adopting a client-supplied one.
141121. **Channel Topic Authorization Matrix Audit** — subscribe to every documented topic with a low-privilege identity and verify rejections map to the declared authorization matrix, catching wildcard grants.
141122. **Topic Enumeration Resistance Test** — probe sequential and guessed topic names to confirm the server returns indistinguishable errors, since distinct responses enumerate private channels.
141123. **Wildcard Subscription Containment Check** — attempt wildcard or pattern subscriptions (e.g. `rooms.*`) and verify the server denies or scopes them to authorized prefixes only.
141124. **Dynamic Topic Creation Guard** — test whether a client can create arbitrary topic names and publish to them, which turns the broker into attacker-controlled infrastructure.
141125. **Cross-Tenant Topic Isolation Verification** — subscribe to another tenant's namespaced topic with a valid own-tenant socket and confirm strict rejection at the broker layer.
141126. **Topic Name Injection Review** — inject path separators, null bytes, and unicode into topic names to verify canonicalization prevents escaping the tenant namespace.
141127. **Subscribe-Before-Auth Race Test** — send subscribe frames before the auth handshake completes and confirm the server queues or rejects them rather than applying them.
141128. **Unsubscribe Completeness Audit** — verify that unsubscribing removes the listener at the broker, not just the client, since phantom subscriptions keep pushing sensitive events.
141129. **Resubscribe After Revocation Check** — revoke a topic grant mid-session and confirm the client cannot silently resubscribe over the same socket.
141130. **Private-Message Channel Direction Test** — attempt to publish into another user's DM channel and verify the server enforces sender-receiver pairing, blocking impersonated direct messages.
141131. **Topic-Level Field Redaction Verification** — confirm that a single broadcast topic redacts privileged fields per subscriber role instead of sending the full object to everyone.
141132. **Presence Channel Authorization Audit** — verify that joining a presence channel requires the same authorization as the resource it mirrors, since presence reveals who is active where.
141133. **Admin Broadcast Fan-out Restriction** — test that only authorized publishers can emit to broadcast or announcement topics, preventing forged mass notifications.
141134. **Topic Migration Stale-Grant Sweep** — after a channel is renamed or its ACL changed, confirm existing subscribers are re-authorized rather than grandfathered.
141135. **Ephemeral Channel Lifetime Enforcement** — verify that temporary channels expire server-side and stop delivering, because client-deleted ephemeral rooms often keep streaming on the broker.
141136. **Message Sequence Integrity Monitor** — attach sequence numbers to outbound frames and verify the receiver detects gaps and replays, since silent frame drops corrupt real-time state.
141137. **Server-Side Ordering Guarantee Audit** — publish rapid conflicting updates and confirm subscribers receive them in server-applied order, not arrival-race order.
141138. **Client-Timestamp Trust Review** — verify the server ignores client-supplied timestamps for ordering and uses its own commit time, closing timestamp forgery.
141139. **Duplicate Frame Delivery Detector** — replay a delivered frame and confirm idempotency keys or dedupe windows prevent double-processing of payments or votes.
141140. **Out-of-Order Reconnect Catch-Up Test** — reconnect with a stale cursor and verify the server replays the missed range exactly once, without gaps or duplicates.
141141. **Backfill Cursor Tampering Check** — manipulate the resume cursor to earlier offsets and verify the server validates cursor ownership and bounds, blocking history scraping.
141142. **Cursor Forgery Across Topics Test** — present a cursor issued for topic A when resuming topic B and confirm the server rejects the mismatch.
141143. **Exactly-Once Delivery Claim Verification** — stress the redelivery path to verify the broker's exactly-once claims hold under reconnect storms, since duplicates cause double charges.
141144. **Message Expiry and TTL Enforcement** — verify that time-sensitive stream messages carry and honor TTLs, so stale commands are not executed after reconnect.
141145. **Reconnection Backoff Abuse Guard** — attempt aggressive reconnect loops and confirm exponential backoff with jitter is enforced server-side, protecting the broker from retry storms.
141146. **Resume Token Theft Simulation** — steal a resume token from one client and use it on another, verifying the server binds tokens to the originating connection or device.
141147. **Reconnect Ticket Privilege Containment Review** — confirm a resume token replays only its original topic set and cannot be upgraded to wider subscriptions on reconnect.
141148. **Stale Resume Window Limit** — verify resume cursors older than the retention window are rejected instead of silently starting from the oldest available message.
141149. **Reconnection Auth Revalidation Check** — confirm that reconnecting with a resume token still revalidates the user's current authorization rather than restoring a stale grant.
141150. **Concurrent Resume Collision Test** — open two connections with the same resume token simultaneously and verify the server kills one or merges safely instead of double-delivering.
141151. **SSE Stream Authorization Parity Audit** — verify Server-Sent Event endpoints enforce the same authentication and topic ACLs as their WebSocket equivalents, since SSE is often the forgotten sibling.
141152. **SSE Last-Event-ID Tampering Test** — manipulate the Last-Event-ID header to request arbitrary history ranges and confirm server-side bounds and ownership checks.
141153. **SSE Connection Multiplexing Limit** — verify the server caps concurrent SSE streams per user, since browsers allow six and attackers open hundreds.
141154. **SSE Event-Type Spoofing Check** — attempt to inject event names that the client router treats as privileged commands, confirming the server allowlists emitted event types.
141155. **SSE Retry Directive Abuse Review** — test whether the server honors client-influenced retry intervals that could be tuned into a self-inflicted DDoS.
141156. **SSE Cache Poisoning Audit** — verify stream responses carry no-store cache headers and per-user vary keys, so shared caches do not serve one user's events to another.
141157. **SSE Heartbeat Deception Test** — confirm heartbeat comments cannot be forged by publishers to keep dead streams appearing alive to monitoring.
141158. **SSE to WebSocket Privilege Drift Check** — verify that migrating a session from SSE to WebSocket re-runs authorization rather than trusting the SSE session cookie blindly.
141159. **Long-Poll Fallback Auth Parity** — test the HTTP long-polling fallback for identical auth, rate limiting, and topic ACLs as the primary socket transport.
141160. **Transport Downgrade Attack Surface Review** — verify the client cannot be forced from WebSocket to a weaker transport by an attacker stripping the upgrade, with security controls intact on every fallback.
141161. **Pub/Sub Fan-out Authorization Recheck** — verify the broker re-evaluates subscriber authorization at publish time for large fan-outs, not just at subscribe time.
141162. **Subscriber List Disclosure Audit** — confirm that channel subscriber rosters are not exposed to ordinary subscribers, since membership lists map organizational structure.
141163. **Fan-out Storm Throttle Test** — publish bursts to a high-subscriber topic and verify per-topic and per-publisher rate ceilings protect the broker.
141164. **Poison Message Quarantine Check** — inject malformed payloads and verify the broker dead-letters them instead of redelivering poison to every subscriber.
141165. **Publisher Identity Spoofing Test** — attempt to publish with a forged sender identity and verify the broker stamps authoritative publisher metadata server-side.
141166. **Cross-Topic Publish Confusion Check** — verify the broker validates that the publish topic matches the authenticated channel grant, blocking publishes that hop topics mid-frame.
141167. **Fan-out Acknowledgment Integrity** — confirm aggregated delivery receipts cannot be forged by a subscriber to fake readership or trigger workflows.
141168. **Broadcast Content Injection Guard** — test whether subscriber-supplied fields in a broadcast template escape sanitization, turning one publish into stored XSS for all viewers.
141169. **Topic Retention Policy Enforcement** — verify retained messages honor the topic's retention window and authorization, so new subscribers do not receive expired sensitive history.
141170. **Retained Message Poisoning Test** — publish a malicious retained message and verify moderation or publisher-allowlist controls prevent it from greeting every future subscriber.
141171. **Binary Frame Type Confusion Audit** — send binary frames where text is expected and verify strict frame-type validation, since type confusion corrupts parsers.
141172. **Binary Frame Size Ceiling Enforcement** — transmit oversized binary frames and confirm the server enforces max frame and message size limits before buffering.
141173. **Fragmentation Reassembly Bomb Test** — send a message split into thousands of tiny fragments and verify reassembly has count and total-size caps.
141174. **Masking Requirement Verification** — confirm the server rejects unmasked client frames per RFC 6455, since unmasked frames enable cache-poisoning attacks through intermediaries.
141175. **Control Frame Flood Protection** — flood ping frames and verify the server rate-limits control frames instead of replying to each one into exhaustion.
141176. **Ping Payload Reflection Review** — verify ping/pong payloads are size-capped and not reflected verbatim into logs, closing log-injection via control frames.
141177. **Close Frame Reason Sanitization** — test that client-supplied close codes and reasons are validated and sanitized before being surfaced to other subscribers.
141178. **Binary Protocol Version Negotiation Guard** — verify the server pins the binary schema version per connection and rejects frames from a different schema instead of misparsing them.
141179. **Compressed Frame Bomb Resistance** — enable per-message deflate and send highly compressible payloads, verifying decompression ratio caps defeat zip-bomb frames.
141180. **Continuation Frame State Machine Audit** — interleave continuation frames from forged sequences and verify the parser's state machine rejects orphaned or nested fragments.
141181. **Backpressure Signal Honesty Test** — verify the server actually slows or pauses publishers when subscribers lag, rather than buffering unboundedly until memory exhausts.
141182. **Slow-Consumer Disconnection Policy** — confirm that persistently slow subscribers are disconnected with a clear code after a documented grace, protecting broker memory.
141183. **Per-Connection Buffer Quota Audit** — verify each socket has an independent outbound buffer cap so one lagging consumer cannot starve the broker.
141184. **Publish Rate Limiter Precision Test** — measure the token-bucket publish limiter under burst and sustained load to confirm it matches the documented policy.
141185. **Message Size Tier Enforcement** — verify different topics enforce their own payload size tiers, so a chat topic cannot be used to smuggle large file blobs.
141186. **Connection Count Per Identity Cap** — open many sockets as one user and verify the per-identity connection ceiling holds, blocking socket-farm abuse.
141187. **Idle Connection Reaper Verification** — confirm idle sockets are closed after the documented timeout, since silent idle sockets accumulate into resource exhaustion.
141188. **Heartbeat Timeout Strictness Audit** — stop responding to pings and verify the server drops the dead connection promptly instead of holding ghost subscribers.
141189. **Priority Lane Fairness Check** — verify priority message lanes cannot be abused by marking every frame urgent, with per-sender priority quotas enforced.
141190. **Graceful Shutdown Drain Test** — during server restart, verify in-flight messages are drained or redelivered rather than silently dropped for connected hunters.
141191. **GraphQL Subscription Auth Directive Audit** — verify each subscription field enforces its auth directive independently, since resolvers often inherit query-level checks incorrectly.
141192. **Subscription Argument Injection Test** — fuzz subscription filter arguments and verify the server validates them against the caller's scope before applying server-side filters.
141193. **Live Query Cost Ceiling Check** — subscribe with expensive live-query shapes and verify query-complexity limits apply to subscriptions, not just one-shot queries.
141194. **Subscription N+1 Fan-out Measurement** — measure backend load per subscriber for nested subscriptions and verify dataloader or batching prevents N+1 amplification.
141195. **Realtime Database Rule Parity Test** — for Firebase-style realtime paths, verify security rules are evaluated on every read, write, and listen, not just on initial attach.
141196. **Presence Write Auth Enforcement** — verify onDisconnect and presence writes validate the writer's authorization, since presence nodes are attacker-writable state.
141197. **Realtime Query Filter Bypass Check** — test whether clients can bypass server-side query filters by listening at a parent path with crafted orderBy parameters.
141198. **Socket.io Namespace Isolation Audit** — verify Socket.io namespaces enforce independent auth middleware and cannot be reached through the default namespace.
141199. **Socket.io Room Join Authorization** — attempt to join rooms by guessed names and verify server-side join handlers check membership before admitting.
141200. **STOMP Destination ACL Verification** — for STOMP brokers, verify destination-level ACLs reject SEND and SUBSCRIBE to unauthorized queues and topics.
141201. **MQTT Publish-Subscribe Access Boundary Probe** — verify the MQTT broker's topic ACLs block both publish and subscribe on unauthorized topic filters, including `#` and `+` wildcards.
141202. **MQTT Retained Session Hijack Check** — verify clean-session semantics so a reconnecting attacker cannot inherit another client's subscriptions and retained state.
141203. **AMQP Binding Manipulation Audit** — verify clients cannot declare bindings that reroute another tenant's exchange traffic into their own queue.
141204. **Event Webhook Re-delivery Signature Defense** — confirm event webhooks carry signatures over timestamped payloads with replay windows, so intercepted deliveries cannot be re-fired.
141205. **Dangling CNAME Takeover Surface Scanner** — enumerate CNAME records pointing to unclaimed cloud services and expired platforms, since an orphaned alias hands an attacker a trusted subdomain on the organization's own domain.
141206. **Stale NS Delegation Authority Audit** — verify that delegated nameserver records still resolve to the organization's own infrastructure, since an abandoned delegation silently transfers zone control to whoever claims the stale nameserver.
141207. **MX Record Shadow-Mailbox Review** — check that MX records do not point to discontinued mail providers whose domains are re-registerable, since mail routing is then capturable along with password-reset flows.
141208. **TXT Record Credential Residue Sweep** — scan TXT records for leftover verification tokens, API keys, and vendor challenge strings that were never removed, since public DNS is readable by everyone on the internet.
141209. **Wildcard DNS Blast-Radius Assessment** — map wildcard record coverage and flag zones where a single wildcard materially expands the takeover and phishing surface, since every covered name inherits trust without individual review.
141210. **Subdomain Enumeration Hygiene Gap Test** — confirm that certificate-transparency logs, zone transfers, and brute-forceable names do not leak unadvertised internal hostnames, since shadow subdomains are the first targets an attacker catalogs.
141211. **DNSSEC Chain-of-Trust Break Detector** — validate that DS records, DNSKEY rollovers, and NSEC chains verify end to end, since a single unsigned link in the chain lets resolvers silently accept forged answers.
141212. **Domain Expiry Reclaim Lapse Monitor** — monitor registered domains backing critical DNS records for imminent expiry, since a lapsed domain instantly re-points every dependent record to the new registrant.
141213. **Registrar Account Takeover Exposure Check** — verify registrar locks, transfer auth codes, and DNSSEC key custody procedures are enforced, since registrar compromise reroutes every service the organization owns.
141214. **CAA Record Coverage Gap Analysis** — confirm Certificate Authority Authorization records restrict issuance to approved CAs across the zone, since missing CAA lets any public CA issue a valid certificate for the domain.
141215. **DMARC Policy Enforcement Depth Test** — verify DMARC is set to reject with strict alignment on the apex and all organizational subdomains, since a monitoring-only policy leaves phishing mail deliverable under the organization's brand.
141216. **SPF Record Oversize and Void-Lookup Audit** — check that SPF records stay within the ten DNS-lookup limit and reference no dead includes, since a permerror turns sender authentication into an unreliable pass for spoofed mail.
141217. **DKIM Key Rotation Freshness Review** — confirm DKIM selectors rotate keys on schedule and retired selectors are unpublished, since long-lived signing keys make domain impersonation recoverable only by incident response.
141218. **BIMI Logo Verification Posture Check** — verify BIMI records reference properly attested logos and that enforcement prerequisites are met, since BIMI rewards strict email authentication with visible brand trust.
141219. **Dangling A Record Cloud-Resource Probe** — identify A records pointing at deprovisioned cloud IPs or load balancers that accept arbitrary host bindings, since a re-claimed endpoint serves attacker content under the organization's IP.
141220. **SRV Record Service-Enumeration Review** — audit SRV records for services unintentionally advertised, since they hand attackers a prioritized target list of ports, protocols, and hostnames.
141221. **DNS Zone Transfer Exposure Test** — confirm AXFR and IXFR are denied to unauthorized queriers on every authoritative server, since a successful transfer dumps the entire infrastructure map in one request.
141222. **Reverse DNS PTR Consistency Check** — verify PTR records resolve forward to the same hostnames and match the services actually running, since inconsistent PTR records complicate incident triage and enable infrastructure spoofing.
141223. **GeoDNS Failover Integrity Test** — simulate regional outages and confirm DNS-based failover directs users to healthy, authorized endpoints only, since stale failover answers can park traffic on decommissioned infrastructure.
141224. **Anycast Route-Hijack Resilience Review** — assess whether the authoritative DNS footprint resists prefix-hijack redirection to hostile resolvers, since hijacked anycast steers all client lookups to attacker-controlled answers.
141225. **EDNS Client-Subnet Privacy Audit** — verify resolvers and authoritative servers do not leak more precise client subnets than necessary, since over-granular ECS data exposes user geography to upstream parties.
141226. **Forged NXDOMAIN Cache Persistence Probe** — probe how long forged NXDOMAIN answers persist in resolver caches, since a poisoned negative cache can blackhole real subdomains without touching the zone.
141227. **DNS Cache Snooping Exposure Check** — test whether resolvers disclose cached entries to unauthenticated queries, since cache inspection reveals which internal services users are actively contacting.
141228. **Random-Subdomain Flood Absorption Test** — verify authoritative servers withstand pseudo-random subdomain floods without exhausting CPU or memory, since this classic attack degrades DNS before anything else is touched.
141229. **DNS-over-HTTPS Policy Bypass Audit** — confirm that enterprise DNS policy, filtering, and logging still apply when clients use encrypted DNS transports, since DoH tunnels silently bypass perimeter DNS controls.
141230. **Split-Horizon DNS Divergence Review** — compare internal and external views for unintentionally exposed internal hostnames, since view mismatches are a reliable source of infrastructure leakage.
141231. **CDN Origin IP Exposure Sweep** — hunt historical DNS records, certificate data, and misconfigured headers for the true origin address, since a bypassed CDN exposes the unprotected backend directly.
141232. **Origin Allow-List Enforcement Test** — verify the origin server rejects requests that do not arrive through the CDN edge network, since an unguarded origin accepts attack traffic with no filtering.
141233. **Host Header Origin-Bypass Probe** — confirm the origin cannot be reached by addressing it with forged or mismatched Host headers, since header confusion defeats CDN-based routing protections.
141234. **CDN Cache-Key Normalization Review** — audit which headers, cookies, and query parameters feed the cache key, since under-specified keys serve one user's private response to many others.
141235. **Cache-Poisoning Denial-of-Inventory Test** — inject abnormal requests and confirm the edge caches only validated responses, since a single poisoned object persists damage across the whole edge network.
141236. **Unkeyed Input Reflection Cache Test** — verify that inputs excluded from the cache key cannot be reflected into cached responses, since stored reflection turns one request into an attack delivered to every visitor.
141237. **Cache-Deception Path-Confusion Probe** — request static-file paths that the backend treats as dynamic and confirm the edge does not cache authenticated responses as public assets, since path confusion leaks private pages.
141238. **Vary Header Poisoning Resistance Check** — test whether manipulated Vary inputs fragment the cache into poisonable variants, since variant explosion lets attackers plant per-variant malicious content.
141239. **Web Cache Deception Normalization Audit** — verify that trailing slashes, encoded characters, and semicolons cannot smuggle authenticated content into the static cache, since normalization gaps are the classic deception vector.
141240. **Edge-Side Include Injection Guard** — confirm that edge templates never interpolate user input into include directives, since a successful interpolation executes attacker markup from the edge cache itself.
141241. **Stale-While-Revalidate Poison Window Test** — measure how long a poisoned object can be served during revalidation windows, since asynchronous refresh extends the blast radius of a single bad cache write.
141242. **Purge API Authorization Review** — verify that cache-purge endpoints authenticate callers and scope purges narrowly, since unauthorized purges convert the edge into a denial-of-service amplifier.
141243. **Cache-Tag Permission Boundary Test** — confirm cache-tag namespaces cannot be purged or poisoned across tenants or properties, since shared tag spaces let one property invalidate another's cache.
141244. **Edge Rule Drift Detection Monitor** — diff deployed edge configurations against the approved baseline continuously, since silently drifted rules weaken protections that audits once verified.
141245. **WAF Bypass Surface Mapping Probe** — catalog which request encodings, chunking tricks, and method variations reach the origin unfiltered, since edge evasion renders application rules irrelevant.
141246. **WAF Learning-Mode Exposure Check** — verify the WAF never runs in passive monitor-only mode on production traffic, since logging without blocking gives attackers a free tuning environment.
141247. **False-Positive Rate Regression Test** — replay legitimate traffic samples against updated WAF rulesets and confirm block rates stay within tolerance, since noisy rules get disabled in practice and protection quietly evaporates.
141248. **Custom Rule Shadowing Detector** — identify managed WAF rules unintentionally overridden by custom allow rules, since shadowing silently carves holes through default protections.
141249. **Rate-Limit Bypass Vector Sweep** — test IP rotation, header spoofing, and path variations against edge rate limits, since trivial bypasses reduce throttling to a suggestion.
141250. **Bot-Management Fingerprint Evasion Review** — verify edge bot scoring resists headless-browser emulation and TLS fingerprint rotation, since weak scoring invites credential stuffing through the front door.
141251. **TLS Termination Version Floor Audit** — confirm the edge negotiates no protocol below TLS 1.2 and no deprecated cipher suites, since weak termination lets attackers decrypt or downgrade edge sessions.
141252. **Edge Certificate Renewal Automation Review** — verify edge certificates renew automatically with monitoring before expiry, since a lapsed edge certificate takes down every property behind it at once.
141253. **OCSP Stapling Reliability Review** — confirm the edge staples fresh revocation responses and fails safely when the responder is unreachable, since missing stapling pushes revocation checks onto clients that skip them.
141254. **SNI Routing Confusion Probe** — test whether mismatched SNI and Host combinations route to the wrong backend or certificate, since routing confusion can expose one property's content under another's domain.
141255. **ALPN Downgrade Resistance Test** — verify the edge honors negotiated application protocols and cannot be forced onto legacy plaintext paths, since protocol downgrade strips HTTP/2 and HTTP/3 security properties.
141256. **HSTS Preload Coverage Check** — confirm strict-transport-security headers include preload and cover subdomains, since gaps let first-visit users be intercepted on plaintext.
141257. **Mixed-Content Edge Rewrite Review** — verify the edge upgrades or blocks insecure subresources consistently, since a single HTTP script on an HTTPS page voids the whole page's transport security.
141258. **Origin Pull Encryption Enforcement Test** — confirm CDN-to-origin connections always use TLS with certificate validation, since plaintext origin pulls let network observers read and modify backend traffic.
141259. **Mutual TLS Origin Authentication Check** — verify the origin authenticates the edge with client certificates or signed tokens, since unauthenticated origin pull invites impersonation by any network neighbor.
141260. **Edge Function Privilege Boundary Audit** — review edge worker code for excessive secrets, network reach, and state access, since a compromised worker runs on every request the property serves.
141261. **Edge Worker Storage Namespace Segregation Check** — confirm edge key-value namespaces cannot be read or written across properties, since shared storage leaks session data and configuration between tenants.
141262. **Geo-Fencing Enforcement Integrity Probe** — test that geo-restrictions hold against VPN endpoints, DNS manipulation, and header spoofing, since weak geo checks fail exactly when licensing or export law depends on them.
141263. **GeoIP Database Freshness Review** — verify the edge geolocation feed updates on schedule, since stale GeoIP data blocks legitimate users and admits sanctioned regions.
141264. **Anycast Edge Failover Coherence Test** — simulate edge PoP failures and confirm traffic lands on healthy nodes with consistent policy, since failover divergence applies different rules to the same user mid-session.
141265. **Edge Redirection Cycle Amplification Scanner** — trace redirect chains across edge rules and confirm they terminate quickly, since looping redirects amplify traffic and break clients at the edge.
141266. **Canonical Redirect Drift Audit** — verify apex-to-www and HTTP-to-HTTPS redirects match the approved canonical map, since drifted redirects leak link equity and confuse security scanners.
141267. **Trailing-Slash Canonicalization Consistency Test** — confirm the edge and origin agree on trailing-slash handling, since disagreement creates duplicate cache entries and authentication bypasses.
141268. **Query-Parameter Ordering Cache Fragmentation Check** — verify equivalent parameter orders map to the same cache entry, since fragmentation multiplies origin load and cache-poisoning surface.
141269. **Case-Sensitivity Routing Divergence Probe** — test whether the edge and origin treat path casing identically, since divergence exposes content and bypasses case-sensitive access rules.
141270. **Unicode Normalization Path Confusion Test** — verify that encoded and normalized path forms resolve to the same resource decision, since normalization gaps are a classic access-control bypass.
141271. **Dangling Edge Hostname Claim Audit** — scan CDN configurations for custom hostnames whose verification lapsed, since an unclaimed hostname lets attackers serve content under the organization's certificate.
141272. **Subdomain Takeover via CDN Validation Probe** — verify CDN domain-ownership checks cannot be satisfied by abandoned DNS records, since stale validation is the doorway to branded content impersonation.
141273. **Multi-CDN Consistency Policy Test** — confirm security headers, WAF rules, and caching policy match across every CDN vendor in use, since the weakest CDN becomes the de facto policy.
141274. **CDN Failover Origin-Fallback Guard** — test what the edge serves when all origins are unreachable, ensuring it never serves stale authenticated content or error pages with debug details.
141275. **Stale Error Page Information Leakage Check** — verify edge error pages disclose no backend versions, stack traces, or internal hostnames, since verbose errors hand attackers a reconnaissance summary.
141276. **Health-Check Endpoint Exposure Review** — confirm origin health probes are not reachable from the public internet, since exposed health endpoints reveal infrastructure topology and backend state.
141277. **Real-IP Forwarding Integrity Test** — verify X-Forwarded-For handling cannot be spoofed to falsify client identity, since forged forwarding headers poison rate limiting, geo checks, and audit logs.
141278. **Client-IP allow-List Bypass Probe** — test whether edge IP allow-lists can be bypassed through header injection or alternate connection paths, since a bypassable allow-list is security theater.
141279. **Connection Reuse Cross-Tenant Leakage Check** — verify pooled edge-to-origin connections never mix requests from different tenants, since multiplexing bugs can splice one tenant's data into another's session.
141280. **HTTP Request Smuggling Edge-Origin Sync Test** — confirm the edge and origin agree on transfer-encoding and content-length handling, since desync lets smuggled requests hijack other users' sessions.
141281. **Chunked Encoding Edge Validation Review** — verify the edge rejects malformed chunk sizes and trailer abuse, since lax parsing forwards attacker-crafted framing to the origin.
141282. **HTTP/2 Rapid-Reset Edge Resilience Test** — confirm the edge absorbs rapid stream resets without exhausting connection resources, since this attack turns the edge itself into the bottleneck.
141283. **HTTP/3 QUIC Migration Posture Review** — verify QUIC deployment inherits the same WAF, logging, and access controls as HTTP/2 traffic, since protocol upgrades often ship with policy gaps.
141284. **WebSocket Edge Upgrade Authentication Check** — confirm the edge authenticates WebSocket upgrade requests before proxying them, since unauthenticated upgrades bypass the entire HTTP security stack.
141285. **WebSocket Message Inspection Gap Test** — verify edge monitoring and rate limiting extend into WebSocket frames, since the upgraded channel otherwise escapes all HTTP-layer defenses.
141286. **SSE Stream Cache Contamination Probe** — confirm server-sent event streams are never cached or multiplexed across users, since a cached stream delivers one user's live updates to strangers.
141287. **Range Request Amplification Guard** — verify the edge validates and limits byte-range requests, since overlapping ranges turn small requests into large origin responses.
141288. **Large File Edge-Timeout Behavior Test** — confirm slow downloads cannot pin edge connections indefinitely, since connection hoarding degrades the whole PoP.
141289. **Image Optimization SSRF Surface Review** — verify edge image-resizing services cannot be pointed at internal addresses, since fetch-and-transform features are a reliable SSRF vector.
141290. **Edge Redirect Open-Destination Audit** — confirm edge redirect rules only target approved destinations and reject user-controlled hosts, since open redirects at the edge inherit the domain's trust.
141291. **URL Rewrite Rule Injection Test** — verify edge rewrite patterns cannot be manipulated through crafted paths to access restricted origins, since rewrite logic is effectively an access-control layer.
141292. **A/B Test Routing Integrity Check** — confirm experiment routing cannot be forced by cookie or header manipulation to expose unreleased features, since variant forcing leaks pre-release attack surface.
141293. **Edge A/B Persistence Tampering Probe** — verify experiment assignment cookies are signed and server-validated, since forged assignments let attackers hold themselves in the vulnerable variant.
141294. **Time-Bound Edge URL Expiration Verification** — confirm edge-signed URLs become invalid exactly at expiry with no clock-skew tolerance abuse, since generous tolerance windows extend unauthorized access.
141295. **Signed Cookie Scope Boundary Review** — verify signed cookies cannot be replayed across paths or properties, since over-broad scope turns one grant into a master key.
141296. **Tokenized Access Edge Validation Audit** — confirm short-lived edge tokens are validated at every PoP with synchronized revocation, since revocation lag lets cancelled tokens keep working.
141297. **DDoS Absorption Headroom Measurement** — measure edge scrubbing capacity against the organization's traffic baseline, since unknown headroom means the first real attack is also the first capacity test.
141298. **L7 Slowloris Edge Tolerance Test** — verify the edge times out slow-header attacks without starving legitimate connections, since slow-drip attacks specifically target edge connection tables.
141299. **DNS Amplification Reflector Check** — confirm authoritative servers refuse recursive queries from the public and rate-limit ANY queries, since open resolvers recruit the organization's DNS into attacks on others.
141300. **Edge Log Completeness and Tamper Audit** — verify edge access logs capture security-relevant fields and are shipped immutably, since incomplete logs blind incident response exactly when it matters.
141301. **Log Injection via Host Header Test** — confirm hostile Host and header values cannot inject forged entries into edge logs, since log injection fabricates evidence and hides real attacks.
141302. **Edge Analytics Data Residency Review** — verify edge analytics and logging storage respects the organization's data-residency commitments, since edge PoPs routinely replicate logs across jurisdictions.
141303. **Certificate Transparency Monitoring Coverage** — confirm every domain and subdomain is watched for unauthorized certificate issuance, since rogue certificates are issued against the organization long before anyone notices.
141304. **Edge Configuration Backup and Rollback Drill** — verify edge configurations are versioned with tested rollback, since a bad rule push can take down security controls globally in minutes.
141305. **Redirect-URI Exact-Match Enforcement Audit** — verify the authorization server rejects any redirect URI not byte-identical to the registered value, since prefix or regex matching lets an attacker redirect tokens to a controlled host.
141306. **Redirect-URI Trailing-Dot Bypass Test** — probe whether DNS-trailing-dot or casing tricks slip past URI validation, since such loopholes hand the authorization code to an attacker domain.
141307. **Open-Redirector Relay in Login-Completion Check** — confirm the post-authentication landing step performs its own allowlist validation instead of trusting a next parameter, since an open relay turns a trusted login flow into a phishing delivery vehicle.
141308. **State Parameter Cryptographic Freshness Check** — verify state carries an expiry timestamp and unpredictable entropy, because a static or forgeable state value defeats CSRF protection on the callback.
141309. **OAuth State Single-Redemption Guard** — attempt to reuse a consumed state value in a fresh session and confirm it is rejected, since replayable state lets an attacker bind a victim session to the attacker's own OAuth account.
141310. **Login-CSRF Binding Integrity Review** — verify the callback session is the same one that initiated the authorization request, since a missing binding allows login CSRF that silently links the victim to the attacker's identity.
141311. **ID-Token Nonce One-Time Acceptance Test** — verify each nonce is accepted exactly once and rejected on reuse, since a replayable nonce allows injection of a stale ID token into a different session.
141312. **Nonce Entropy Strength Audit** — check the nonce carries at least 128 bits of unpredictable randomness, because a guessable nonce undermines the replay defence it exists to provide.
141313. **PKCE Verifier Randomness Strength Audit** — confirm generated verifiers meet the 43–128 character high-entropy requirement, since short verifiers let an attacker brute-force the challenge and redeem an intercepted code.
141314. **PKCE Challenge-Method Downgrade Guard** — verify the server refuses the plain transform when S256 was advertised at registration, since method downgrade removes the verifier's secrecy guarantee.
141315. **PKCE Verifier Single-Use Enforcement Test** — redeem the same code twice with the verifier and confirm the second redemption fails, because reusable verifiers turn a leaked authorization code into a standing credential.
141316. **Authorization Code Brief-Lifetime and One-Time Redemption Audit** — verify codes expire within minutes and cannot be redeemed twice, since long-lived reusable codes multiply the blast radius of any interception.
141317. **Authorization Code Leakage in Browser History Review** — verify codes are delivered only via a server-side callback and never echoed into HTML or logs, since logged codes can be harvested by anyone with log access.
141318. **Token-Endpoint Client Authentication Strength Audit** — confirm confidential clients authenticate with private-key JWT or mTLS instead of shared secrets where feasible, since leaked client secrets become silent token-minting keys.
141319. **Refresh-Token Rotation Atomicity Test** — verify a rotated refresh token invalidates its predecessor atomically under concurrent requests, because race windows yield two live tokens from one rotation.
141320. **Refresh-Token Reuse Theft Detection** — confirm that presenting an already-rotated refresh token triggers revocation of the whole token family, since reuse is the canonical signal of token theft.
141321. **Silent-Auth Session-Drift Monitor** — verify prompt=none flows re-validate the session age against policy maxima, since drifted silent sessions can grant fresh tokens long after the user believed they were logged out.
141322. **Silent Re-Authentication Consent Bypass Check** — test whether silent flows silently widen scopes without fresh user consent, because scope creep without consent breaks the authorization contract.
141323. **Consent Screen Scope-Fidelity Audit** — verify the scopes displayed to the user exactly match the scopes encoded in the authorization request, since mismatched copy is consent fraud.
141324. **Consent Persistence Tampering Test** — attempt to revoke or alter stored consent grants via direct API calls without the user flow and confirm it is rejected, since writable consent stores let an attacker silently re-grant access.
141325. **Scope Downgrade Detection at Token Exchange** — verify the server issues exactly the granted scopes and flags any silent reduction or expansion, because unexplained scope changes signal parameter tampering or a confused client.
141326. **IdP Discovery Metadata Signature Verification** — confirm the client validates the signature or TLS-transported origin of the IdP's discovery document, since unsigned metadata enables provider-in-the-middle reconfiguration.
141327. **JWKS Key-Set Cache Integrity Test** — verify the client pins fetched JWKS entries to the metadata URL and rejects out-of-band key injection, since cache poisoning lets an attacker mint valid-looking tokens.
141328. **JWKS Signing-Key Age Watchdog** — flag signing keys whose rotation interval exceeds policy or whose old keys remain trusted indefinitely, since stale trust anchors extend the life of any key compromise.
141329. **Issuer-Claim Strict Validation Audit** — verify the token audience and issuer are checked against exact allowlists rather than substring matching, because loose matching admits tokens minted by a sibling or attacker IdP.
141330. **Audience Restriction Cross-Client Check** — attempt to present a token issued for one client to another service and confirm rejection, since multi-tenant issuers that skip audience checks collapse the client boundary.
141331. **JWT Algorithm Confusion Hardening Test** — confirm the validator rejects tokens whose alg header deviates from the registered algorithm, since alg swapping turns a public key into a signing key.
141332. **Token Expiry and Clock-Skew Policy Review** — verify access tokens carry short lifetimes and the validator enforces a tight clock-skew ceiling, since generous skew windows extend stolen-token usefulness.
141333. **DPoP Sender-Constrained Token Binding Audit** — verify DPoP proofs bind tokens to the presenting client's key on every request, since unbound bearer tokens remain fully replayable after interception.
141334. **Device-Authorization User-Code Entropy Check** — confirm device flow user codes are short-lived, high-entropy, and rate-limited, since guessable codes let an attacker complete a victim's device login.
141335. **Device Flow Verification-URI Authenticity Test** — verify the displayed verification URI is bound to the registered client identity, because a swapped URI in a phishing overlay completes the attacker's device session instead.
141336. **IdP-Initiated SSO RelayState Integrity Check** — verify unsolicited responses require signed RelayState targeting the intended SP, since unvalidated RelayState turns IdP-initiated SSO into an open login relay.
141337. **SAML Response Destination Binding Audit** — confirm the response destination matches the SP's ACS URL exactly, because a mismatched destination lets assertions be consumed at attacker-controlled endpoints.
141338. **SAML Assertion Encryption Posture Review** — verify sensitive assertions are encrypted and not merely signed, since signed-only assertions leak identity attributes to any intermediary.
141339. **Account-Linking Ownership Proof Requirement** — verify linking a federated identity to an existing account requires proving control of both sides, since one-sided linking enables account takeover by email collision.
141340. **Federated Email-Change Drift Detector** — flag accounts where the IdP-side email changed without re-verification on the relying party, since drifted identifiers break the identity binding the link was built on.
141341. **Pre-Hijacking via Unclaimed Federated Email Test** — attempt to register a federated login for an email the victim will later claim and confirm the flow blocks silent takeover, since pre-registration of IdP accounts is a documented account-pre-hijacking vector.
141342. **Social-Login Email-Verification Gap Audit** — verify the relying party checks the IdP's email_verified claim instead of assuming social emails are verified, since unverified social emails enable impersonation.
141343. **Multiple-IdP Collision Handling Review** — verify two IdPs asserting the same email produce a resolution flow rather than silent merge, because silent merging lets a weaker IdP absorb a stronger account.
141344. **Just-in-Time Provisioning Attribute Trust Test** — confirm JIT-provisioned attributes like roles are sourced from allowlisted claims only, since untrusted claim mapping turns IdP compromise into privilege escalation.
141345. **Deprovisioning Propagation Completeness Check** — verify disabling a user at the IdP revokes relying-party sessions within policy time, because orphaned downstream sessions outlive the revocation event.
141346. **Back-Channel Logout Session Termination Audit** — confirm logout propagates to every relying party with an active session and partial failures are retried, since silent non-participation leaves zombie sessions behind.
141347. **Front-Channel Logout Token Leakage Review** — verify front-channel logout frames do not carry tokens in query strings, since URL-embedded tokens leak through browser history and referrer headers.
141348. **Session-Index Consistency Check** — verify logout requests reference the same session index that was issued, because mismatched indices let an attacker terminate or preserve the wrong session.
141349. **Post-Logout Token Revocation Verification** — present access and refresh tokens issued before logout and confirm they are all invalidated, since logout that leaves tokens alive is cosmetic only.
141350. **Client-Secret Rotation and Versioning Audit** — verify clients can rotate secrets without downtime and old secrets stop working within policy time, because immortal secrets accumulate exposure across staff turnover.
141351. **Public-Client Impersonation Resistance Test** — verify public clients are distinguished from confidential ones by redirect-URI integrity and PKCE rather than a static identifier, since copyable identifiers offer no client authentication.
141352. **Token Exchange Delegation Scope Ceiling** — verify exchanged tokens cannot exceed the original grant's scopes under token-exchange flows, because unbounded delegation turns a narrow grant into a master key.
141353. **On-Behalf-Of Chain Depth Limiter** — confirm the server caps delegation-chain length and records the full actor trail, since unbounded chains obscure accountability and amplify a single compromise.
141354. **PAR Request-URI Single-Use Check** — verify pushed authorization request URIs expire after one use and within seconds, because reusable request URIs re-open tampering windows that PAR exists to close.
141355. **JAR Signature Enforcement Audit** — confirm the server rejects unsigned or weakly signed authorization requests when JAR is the registered policy, since unsigned requests reintroduce the parameter-injection surface.
141356. **Response-Mode Fragment Leakage Review** — verify sensitive parameters use form_post or fragment-only delivery and never appear in server logs, since query-mode leakage exposes tokens to intermediaries.
141357. **Error-Response Information Disclosure Check** — verify OAuth error pages return generic failures without revealing whether a client_id or user exists, because differential errors enable account and client enumeration.
141358. **Rate-Limiting on Token Endpoint Audit** — confirm the token endpoint throttles code-redemption attempts per client and IP, since unthrottled redemption invites brute-forcing of short codes.
141359. **Client Registration Metadata Validation Test** — attempt to register redirect URIs with localhost or custom schemes on a production client and confirm rejection, because lax registration is the root of most redirect attacks.
141360. **Dynamic Client Registration Trust Review** — verify self-registration requires an initial access token or admin approval, since open registration lets attackers mint trusted clients at will.
141361. **Redirect-URI Fragment Smuggling Test** — attempt to smuggle attacker data through URI fragments or matrix parameters and confirm the server strips them, since smuggled fragments survive validation and reach the attacker's page.
141362. **Authorization Prompt Bypass Detection** — verify the server does not honour prompt=none for clients registered to require interaction, because bypassable prompts defeat step-up authentication policies.
141363. **Step-Up Authentication Scope Escalation Check** — confirm elevation to sensitive scopes forces a fresh authentication factor, since silent elevation lets a hijacked low-assurance session reach privileged scopes.
141364. **Authentication-Context Claim Enforcement Review** — verify the server vouches for authentication-context claims and clients enforce minimum ACR, because unenforced context claims make assurance levels decorative.
141365. **Cross-Device Session Transfer Safety Review** — verify QR-code or magic-link session transfers bind to the originating device context, since unbound transfers let an attacker clone the victim's authenticated session.
141366. **WebAuthn-Bound Federated Session Check** — confirm sessions established with passkeys carry a credential-bound flag that downstream checks enforce, because unflagged sessions downgrade the assurance the passkey provided.
141367. **Token Introspection Caller Authorization Test** — verify only the issuing authorization server or authorized resource servers can introspect tokens, since open introspection endpoints leak token validity to attackers.
141368. **Revocation Endpoint Idempotency and Completeness Audit** — confirm revocation accepts already-revoked tokens gracefully and purges all associated refresh tokens, because partial revocation leaves standing access.
141369. **Federated Logout Across Multiple IdPs Test** — verify a user with two linked IdPs gets both upstream sessions terminated on logout, since single-IdP logout leaves the alternate session live.
141370. **IdP Session Cookie Hardening Review** — verify IdP session cookies carry SameSite and Secure flags, because lax cookie flags expose the upstream session to cross-site request attacks.
141371. **Authorization Server Metadata Tampering Detector** — monitor the authorization server's own metadata endpoint for unexpected field changes, since altered metadata silently redirects clients to attacker endpoints.
141372. **Client Assertion Replay Window Check** — verify private_key_jwt client assertions carry tight expiry and unique jti values, because replayable assertions let an attacker impersonate the client at the token endpoint.
141373. **mTLS Client Certificate Binding Audit** — confirm the token endpoint binds issued tokens to the presented client certificate throughout the token lifetime, since unbound issuance breaks the mTLS security model.
141374. **Federated Group-Membership Freshness Test** — verify group and role claims are re-fetched at session refresh rather than cached from first login, because stale membership grants access after the user was removed.
141375. **SCIM Provisioning Race-Condition Review** — verify IdP-driven provisioning and relying-party JIT creation cannot create duplicate accounts under concurrency, since duplicate identities split audit trails and access.
141376. **IdP-Originated Deep-Link Tampering Probe** — attempt to inject parameters into IdP-initiated deep links and confirm the SP sanitizes them, because unsanitized deep links deliver payloads under the IdP's trusted brand.
141377. **OAuth Scope Documentation Drift Audit** — verify the scopes a client actually requests match what its privacy policy and app listing declare, since undocumented scopes erode user trust and invite regulatory action.
141378. **Consent-Screen Brand Impersonation Check** — verify the consent screen renders the verified app name and logo from registration rather than request parameters, because attacker-supplied branding turns consent into a phishing lure.
141379. **Incremental Authorization Justification Test** — confirm each new scope request presents a fresh consent prompt naming the scope, since bundled silent additions train users to grant access they never reviewed.
141380. **Token Storage Posture in SPA Review** — verify single-page clients keep tokens in memory or secure workers rather than localStorage, since script-accessible storage turns any XSS into full token theft.
141381. **Silent Token Renewal iframe Origin Check** — verify renewal iframes enforce the IdP origin and ignore messages from any other source, because promiscuous postMessage handling lets attacker frames harvest renewed tokens.
141382. **Logout Redirect Allowlist Enforcement** — verify post_logout_redirect_uri values are matched against the registered allowlist, since open logout redirects are a classic phishing primitive.
141383. **Federated Account Recovery Collision Test** — verify password-reset flows for linked accounts do not reset the IdP binding without re-verification, because naive recovery breaks the federation trust the link was built on.
141384. **IdP Metadata Refresh Interval Policy** — confirm IdP metadata is re-fetched on a bounded schedule rather than cached forever, since eternal caching blinds the client to key rotations and endpoint moves.
141385. **Emergency IdP Failover Integrity Check** — verify failover to a backup IdP requires administrative approval and re-registration checks, because silent failover lets an attacker trigger a downgrade to a weaker provider.
141386. **Token-Age Policy Enforcement at APIs** — verify resource servers reject tokens older than the maximum session age for sensitive operations, since ancient tokens from forgotten sessions should not authorize privileged actions.
141387. **Federated Impersonation and Delegated-Admin Audit** — confirm delegated administration features log the impersonator's identity distinctly from the subject, because conflated audit entries hide who actually acted.
141388. **OAuth Flow Version Downgrade Detector** — verify the client refuses legacy implicit-flow responses when code flow is configured, since implicit-flow responses expose tokens directly in the redirect fragment.
141389. **Hybrid Flow Component Validation Test** — verify hybrid-flow responses are validated as a coherent set rather than as independent parts, because partially validated hybrids allow token substitution between the code and the ID token.
141390. **CIBA Binding-Message Integrity Check** — confirm Client-Initiated Backchannel Authentication binding messages are shown verbatim and unmodifiable, since editable binding messages defeat the user's ability to detect a swapped request.
141391. **CIBA Polling Endpoint Abuse Guard** — verify the backchannel polling endpoint rate-limits and binds polls to the original auth request, because unbound polling lets attackers harvest completed authentications.
141392. **Richer Authorization Request Detail Binding** — verify rich authorization request objects bind the authorized details to the issued token so they cannot be swapped at the resource server, since unbound details enable authorization-detail substitution.
141393. **Pushed-Detail Tampering at Token Endpoint** — attempt to alter authorized details between the pushed request and token redemption and confirm rejection, because the gap between authorization and redemption is a tampering window.
141394. **Federated Session Anomaly Signal Export** — verify the IdP emits risk signals such as impossible-travel or new-device events that relying parties can consume, since downstream services cannot defend against anomalies they never see.
141395. **IdP-Initiated Provisioning Webhook Authentication** — confirm provisioning webhooks require mutual authentication and payload signatures, because unauthenticated provisioning hooks let attackers create privileged accounts.
141396. **OAuth Client Metrics Tampering Guard** — verify usage metrics and quota counters are computed server-side and not client-reported, since client-reported metrics let an attacker hide brute-force campaigns.
141397. **Authorization-Code Interception on Mobile Audit** — verify mobile clients use claimed HTTPS redirect URIs or private-use schemes bound to the app, because custom-scheme interception is the primary mobile OAuth attack.
141398. **App-Attest Binding for Mobile Token Exchange** — confirm mobile token exchange requires device attestation where the platform supports it, since unattested clients let cloned apps redeem stolen codes.
141399. **Federated Logout Front-Channel Race Test** — verify the SP session is destroyed before front-channel logout frames are dispatched, because ordering races leave the local session alive when a frame fails.
141400. **IdP Signing-Key Compromise Playbook Drill** — verify a documented and tested procedure exists for rotating IdP signing keys and revoking issued tokens under compromise, since an unrehearsed rotation extends the attacker's window indefinitely.
141401. **Cross-IdP Token Confusion Test** — attempt to present an access token minted by IdP-A to a resource server trusting IdP-B and confirm rejection, since multi-IdP deployments that skip issuer pinning accept foreign tokens.
141402. **Federated Session Fixation Resistance Check** — verify the relying party rotates its session identifier after successful federated login, because carrying the pre-login session ID through authentication enables fixation.
141403. **Authorization Request Replay Across Clients** — replay a captured authorization request at a different registered client and confirm rejection, since cross-client request replay breaks the per-client trust boundary.
141404. **OIDC Discovery Spoofing via DNS Review** — verify webfinger-based issuer discovery validates the issuer against a pinned allowlist, because unauthenticated discovery lets DNS-level attackers nominate a rogue IdP.
141405. **Session-Fixation Resistance Verification** — confirm the server mints a fresh session identifier at login instead of adopting a pre-login value, since fixation lets an attacker plant and later ride a known session.
141406. **Pre-Authentication Session Token Discard Check** — verify that tokens issued on anonymous pages are invalidated once authentication completes, so tokens seeded before login can never be promoted.
141407. **Concurrent-Session Limit Enforcement Audit** — test that the account's maximum parallel session count is actually enforced server-side, since unenforced limits quietly allow credential-sharing abuse.
141408. **Session-Sprawl Anomaly Notification** — verify the platform alerts the user when a new session appears from an unusual device or geography while other sessions are active, catching hijacks early.
141409. **Oldest-Session Eviction Policy Test** — check that exceeding the session cap evicts the oldest session deterministically rather than silently allowing overflow.
141410. **Refresh-Token Rotation Completeness Check** — confirm each refresh consumes the old token and issues a new one, since reuse of a refresh token is the canonical signal of theft.
141411. **Refresh-Token Reuse Breach Detection** — verify that presenting an already-rotated refresh token invalidates the entire token family and forces re-authentication, closing the compromise window.
141412. **Refresh-Token Grace-Period Abuse Audit** — test whether the rotation grace period is short and single-use, since generous windows let a stolen token race the legitimate client indefinitely.
141413. **Absolute Refresh-Token Lifetime Cap Review** — verify a maximum lifetime bounds every refresh chain, preventing sessions that rotate forever without fresh credentials.
141414. **Sliding-Window Session Extension Audit** — confirm activity-based renewal extends sessions only within a capped absolute lifetime, so perpetual sliding extensions cannot create immortal sessions.
141415. **Idle-Timeout Enforcement Across Tabs** — verify inactivity timers track real user interaction rather than ambient tab noise, since background keep-alives defeat the purpose of idle lockout.
141416. **Server-Side Idle-Timeout Authority Check** — confirm idle expiry is enforced on the server clock, not trusting client-reported activity that a script can fabricate.
141417. **Idle-Timeout Warning Fidelity Test** — verify the pre-timeout warning fires reliably and cannot be suppressed by muting the client, giving users a real chance to stay signed in.
141418. **Post-Timeout Token Rejection Audit** — confirm access and refresh tokens are rejected immediately after idle expiry, since half-expired sessions often still pass lax validation.
141419. **Cross-Device Session Sync Safety Review** — verify that syncing sessions between devices transfers only encrypted session metadata over mutually authenticated channels, never bearer tokens in the clear.
141420. **Multi-Device Session Kill Verification** — revoke a session on one device and verify it dies on all synced devices within seconds, since stale mirrors otherwise stay authenticated.
141421. **Device-Trust Transfer Authorization Check** — confirm adding a new device to a sync group requires explicit approval from an already-trusted device, blocking silent enrollment by an attacker.
141422. **DPoP Token-Binding Verification** — verify proof-of-possession binding actually ties tokens to the holder's key, so a stolen token is useless without the private key.
141423. **MTLS Client-Certificate Token-Binding Check** — test that client-certificate-bound tokens are rejected when presented without the matching certificate, since loose binding degrades to bearer semantics.
141424. **Sender-Constrained Token Proxy Bypass Test** — verify a bound token cannot be forwarded through a malicious proxy that terminates TLS, catching binding that is validated only at issuance.
141425. **Token-Binding Downgrade Resistance Check** — confirm clients cannot negotiate away token binding to plain bearer mode, since silent downgrade reopens replay.
141426. **Logout Completeness Server-Side Audit** — verify logout destroys the server-side session record and blacklists the refresh token, not merely deleting client cookies.
141427. **All-Sessions Logout Reliability Test** — exercise the sign-out-everywhere function and verify every device session dies, since partial fan-out leaves forgotten sessions alive.
141428. **Post-Logout Back-Button Replay Check** — confirm cached pages and tokens stop working after logout, since history-navigation replay is a classic session resurrection vector.
141429. **Logout CSRF Resistance Review** — verify logout endpoints require anti-CSRF protection or explicit intent, since forced logouts enable denial-of-service and session-swapping attacks.
141430. **Remember-Me Token Hygiene Audit** — verify long-lived remember-me tokens are opaque, single-purpose, and stored hashed, never as the user's credentials in another form.
141431. **Remember-Me Scope Limitation Test** — confirm remember-me sessions carry reduced privileges and cannot touch sensitive actions, since persistent cookies are high-value targets.
141432. **Remember-Me Revocation on Password Change** — verify changing the password or email invalidates every remember-me token, closing the stale-persistence gap.
141433. **Remember-Me Token Rotation Check** — verify remember-me cookies rotate on each use like refresh tokens, so a stolen cookie has a short usable life.
141434. **Session-Cookie Flag Hardening Review** — verify session and token cookies carry HttpOnly, Secure, and appropriate SameSite flags, since flag gaps enable theft and CSRF.
141435. **Cookie Prefix Enforcement Check** — confirm session cookies use __Host- or __Secure- prefixes where the domain model allows, blocking cookie-injection from sibling subdomains.
141436. **Subdomain Session-Cookie Scope Audit** — verify session cookies are not scoped to a parent domain that untrusted subdomains share, since that hands sessions to any compromised tenant.
141437. **Session Identifier Entropy Review** — test that session tokens carry at least 128 bits of CSPRNG entropy, because short or predictable IDs fall to brute-force enumeration.
141438. **Query-String Session Identifier Leakage Detector** — verify session identifiers never appear in URLs, referers, or logs, since query-string sessions leak through sharing and analytics.
141439. **Session Regeneration on Privilege Escalation** — confirm the session ID rotates when a user elevates to admin or approves a sensitive action, containing the blast radius of a stolen low-privilege session.
141440. **Step-Up Authentication Session Tagging** — verify sessions record the strength and freshness of the authentication they are built on, so sensitive endpoints can demand step-up when the tag is weak.
141441. **Step-Up Downgrade Detection** — verify a session cannot silently fall back to a weaker auth level after step-up, since downgrade defeats the elevated assurance.
141442. **Session-Duration Tier Policy Audit** — verify different session lifetimes apply per risk tier, with short lifetimes on privileged accounts and longer ones on read-only roles.
141443. **Impersonation Session Marking Test** — confirm support-impersonation sessions are visibly marked and time-boxed, so staff sessions can never be confused with the real user's.
141444. **Impersonation Token Non-Refreshability Check** — verify impersonation tokens cannot be refreshed or converted into persistent sessions, preventing lingering backdoor access.
141445. **Delegated-Session Scope Boundary Audit** — verify OAuth-style delegated sessions carry the exact granted scopes, and check that scope creep cannot be added mid-session.
141446. **Consent-Grant Session Linkage Review** — confirm sessions created via delegated consent record the grant they derive from, so revoking consent terminates derived sessions.
141447. **API-Key Session Parity Check** — verify long-lived API keys follow the same rotation, binding, and revocation rules as browser sessions, since key sprawl often bypasses them.
141448. **Service-Account Session Hygiene Audit** — confirm machine sessions use short-lived tokens with automatic rotation, avoiding immortal credentials in cron jobs and pipelines.
141449. **Session Metadata Tampering Guard** — verify server-stored session attributes like roles and tenant IDs cannot be altered by client-supplied claims, since forged metadata escalates privilege.
141450. **JWT Claim Injection Resistance Test** — test that user-supplied values in profile fields cannot alter signed session claims such as admin flags through parsing confusion.
141451. **Token Signature Algorithm Confusion Check** — verify the verifier pins the expected algorithm and rejects alg:none or key-confusion variants, closing classic signature bypasses.
141452. **JWKS Key-Rotation Safety Review** — verify key rotation overlaps old and new keys safely without accepting tokens signed by retired or revoked keys.
141453. **Token-Expiry Leeway Hardening Audit** — verify the expiry leeway is minimal and documented, since generous skew windows extend the life of stolen tokens.
141454. **Not-Before Enforcement Check** — confirm nbf and iat claims are validated, so tokens cannot be pre-minted and activated ahead of their intended start.
141455. **Audience and Issuer Pinning Audit** — verify tokens are rejected when aud or iss do not match this service, blocking cross-service token replay.
141456. **Session-Token Replay Across Endpoints** — test that a token minted for one API surface cannot be replayed against a different privileged surface, since scope-naive validation invites replay.
141457. **Single-Use Action Token Expiry Audit** — verify password-reset, email-change, and magic-link tokens are single-use and short-lived, since reusable action tokens enable account takeover.
141458. **Magic-Link Session Binding Check** — confirm magic-link tokens bind to the requesting device or IP context, so a forwarded email link cannot be redeemed elsewhere.
141459. **Magic-Link Redemption Race Test** — redeem the same magic link twice concurrently and verify exactly one session is created, closing double-spend redemption.
141460. **Password-Reset Token Invalidation on Use** — verify using a reset token destroys all other outstanding reset tokens for the account, preventing token-stockpile attacks.
141461. **Email-Change Session Revalidation Check** — confirm changing the account email forces re-authentication and revokes old sessions, since email takeover otherwise inherits every session.
141462. **Account-Recovery Session Quarantine Audit** — verify post-recovery sessions start in a limited, verified state until the user confirms, containing damage from fraudulent recoveries.
141463. **Session Hijack Behavioral Signal Audit** — verify the platform scores session behavior like impossible travel and device drift, escalating suspicious sessions to re-authentication.
141464. **Impossible-Travel Detection Tuning Review** — test the velocity-check logic with realistic travel scenarios to confirm it catches token theft without locking out genuine travelers.
141465. **Device-Fingerprint Drift Tolerance Check** — verify fingerprint matching tolerates normal browser updates but flags wholesale device swaps, balancing usability with hijack detection.
141466. **Session Takeover Canary Token** — verify honeytoken sessions exist that trigger alerts when used, catching attackers who harvest session stores.
141467. **Session-Store Encryption-at-Rest Audit** — confirm the server session store encrypts tokens and secrets at rest, since a leaked session table is a credential goldmine.
141468. **Session-Store Access Isolation Review** — verify session records are partitioned by tenant with no cross-tenant read path, since store bugs leak other customers' sessions.
141469. **Session Export Data-Leakage Check** — verify admin exports and diagnostics never include live session tokens, which would turn support tools into session harvesters.
141470. **Session-Listing Privacy Audit** — verify the user's own session list shows device and location details without exposing full tokens or IP addresses to shoulder surfers.
141471. **Remote Session Revocation UX Completeness** — verify users can identify and revoke individual sessions by device, and confirm revoked sessions actually stop authorizing within the documented window.
141472. **Revocation Propagation Latency Measurement** — measure how long a revoked token remains accepted across edge caches and microservices, since slow fan-out leaves a usable window.
141473. **Token-Revocation Allowlist Fallback Check** — verify the revocation path works during downstream outages rather than failing open, since fail-open revocation restores revoked sessions.
141474. **Distributed Session Consistency Audit** — verify session state converges across regions so a revocation in one region cannot be bypassed by routing to another.
141475. **Sticky-Session Affinity Security Review** — verify load-balancer session affinity cannot be manipulated to pin a victim to an attacker-observed node or bypass invalidation.
141476. **Session Cache Poisoning Resistance** — test that per-user session fragments in shared caches carry tenant keys, preventing one user from being served another's session data.
141477. **Token Introspection Endpoint Authorization** — verify introspection APIs reveal token validity only to authorized callers, since open introspection oracles aid token guessing.
141478. **Session Count API Information Disclosure** — verify endpoints reporting active-session counts do not leak whether an account exists or how valuable it is to attackers.
141479. **Login-History Accuracy Audit** — verify the account's login history records real authentication events with correct timestamps, since falsified history hides takeovers.
141480. **Session Creation Audit-Trail Completeness** — confirm every session birth, rotation, revocation, and expiry is logged with device context, giving incident responders a full timeline.
141481. **Session-Audit Immutable Ledger Verification** — verify session audit records are append-only and protected from modification by the account owner, preserving forensic integrity.
141482. **Suspicious-Session Forced Reauth Flow** — verify flagged sessions are challenged with step-up authentication rather than silently continued, containing suspected hijacks.
141483. **Graceful Session Migration on Reauth** — verify forced re-authentication preserves in-progress work and migrates it to the new session, so security challenges do not destroy user state.
141484. **WebSocket Session Lifecycle Binding** — verify persistent sockets die with their parent session and cannot outlive logout, since orphaned sockets bypass revocation.
141485. **Long-Polling Session Continuity Audit** — verify long-poll channels re-validate the session on each reconnect instead of trusting the initial handshake indefinitely.
141486. **SSO Session Bridge Integrity Check** — verify sessions created via SSO carry the IdP's assurance level and expire with it, so IdP logout propagates to the service.
141487. **SLO Front-Channel Logout Coverage** — test single-logout across every relying-party tab and iframe, since partial logout leaves live sessions in forgotten frames.
141488. **SLO Back-Channel Reliability Audit** — verify back-channel logout notifications are retried and confirmed, because dropped notifications leave downstream sessions alive.
141489. **IdP Session Not-On-Or-After Enforcement** — confirm the service honors the IdP's session lifetime limits rather than extending trust beyond the assertion's expiry.
141490. **Federation Token Audience-Switch Guard** — verify tokens from one federation partner cannot be replayed against another tenant's endpoint, blocking cross-tenant token misuse.
141491. **Session Fixation via SSO RelayState Test** — verify RelayState and request IDs are freshly generated per SSO flow, so an attacker cannot fixate an SSO session.
141492. **Silent-Reauth Prompt-None Safety** — verify prompt=none flows only succeed inside a valid IdP session and never mint sessions from stale cookies alone.
141493. **Offline-Access Scope Justification Audit** — verify offline_access grants are logged with business justification and expire, since perpetual offline tokens are high-value theft targets.
141494. **Token-Exchange Delegation Chain Audit** — verify exchanged tokens record the full delegation chain with per-hop scope reduction, so a chain cannot silently regain dropped privileges.
141495. **Downscoped-Token Escalation Resistance** — test that downscoped child tokens cannot mint broader tokens than their parent grant, closing privilege-regrowth paths.
141496. **Session-Bridge Secret Rotation Check** — verify secrets used to bridge sessions between services rotate automatically and old secrets are rejected, since static bridge keys become permanent backdoors.
141497. **Bridge-Token Audience Pinning Audit** — verify inter-service bridge tokens are bound to a single target service, preventing one bridge credential from roaming the mesh.
141498. **Session Migration on App Upgrade** — verify app upgrades preserve session continuity securely, rotating secrets while migrating, instead of invalidating everyone or carrying weak legacy tokens.
141499. **Session-Payload Field-Minimization Audit** — verify session payloads carry only the claims needed for authorization, since bloated sessions leak PII into logs and caches.
141500. **Token Size Denial-of-Service Guard** — verify oversized tokens are rejected before expensive signature verification, stopping CPU-exhaustion via bloated credentials.
141501. **Session Endpoint Rate-Limit Bypass Audit** — test that login, refresh, and revocation endpoints resist enumeration and brute-force without blocking legitimate users, since these are the session system's front door.
141502. **Refresh-Storm Backpressure Test** — flood the refresh endpoint with concurrent requests and verify rotation stays consistent with exactly one surviving token lineage, preventing split-brain sessions.
141503. **Session Lifecycle Chaos Drill** — simulate cascading expiry, revocation, and IdP outage together and verify the session layer degrades to re-authentication rather than failing open.
141504. **Token-Bridge End-to-End Assurance Score** — verify the platform computes a per-session assurance score from binding, freshness, device trust, and IdP level, and enforces it at every sensitive action.
141505. **Client-Side Price Tamper Resistance Audit** — verify the checkout total is recomputed server-side from catalog prices rather than trusting any amount the browser submits, since client-supplied totals are trivially editable.
141506. **Cart Total Integrity Reconciliation Check** — confirm line items, discounts, taxes, and shipping are re-derived from canonical data at charge time, catching desync bugs where the displayed price differs from the billed price.
141507. **Currency Swap Pricing Arbitrage Detector** — test whether switching the billing currency between quote and charge changes the effective amount paid, which would let a buyer pick the cheapest FX conversion path.
141508. **Negative Line-Item Quantity Guard** — submit negative line-item quantities and verify the order engine rejects them, since accepted negatives can drive the total below zero or create store credit.
141509. **Decimal Precision Rounding Drift Review** — check that per-line rounding is applied consistently and sums to the charged total, because mixed rounding strategies leak cents at scale that attackers can farm.
141510. **Checkout Session Amount Fixation Check** — verify a payment session created for one amount cannot be replayed to settle a different cart, which would allow price substitution after authorization.
141511. **Price Override API Field Audit** — probe order-creation endpoints for undocumented amount or unit_price fields and confirm they are ignored, since hidden writable fields are a classic tamper vector.
141512. **Catalog Price Cache Poisoning Test** — verify that stale or attacker-influenced price caches cannot be served at checkout after a price change, catching cache-key bugs that honor outdated prices.
141513. **Flash-Sale Price Window Enforcement Review** — confirm promotional prices are gated by server-side time windows rather than client flags, so a sale price cannot be claimed after it ends.
141514. **Geographic Price Tier Spoofing Check** — test whether region-based pricing follows a verified billing address and not a spoofable header or VPN-detected locale, which would allow buying at the cheapest regional tier.
141515. **Coupon Single-Use Replay Guard** — verify single-use coupons are atomically marked redeemed before the response returns, since race conditions let the same code discount two concurrent checkouts.
141516. **Coupon Stacking Policy Enforcement Test** — attempt to combine coupons flagged as non-stackable and confirm the engine rejects the combination, catching logic gaps that compound discounts to zero or below.
141517. **Expired Coupon Time-Boundary Check** — redeem coupons exactly at and just after expiry and verify server-side timestamps govern, since client clocks or timezone tricks often extend validity.
141518. **Coupon Spend-Threshold Evasion Check** — test whether minimum-cart thresholds are re-validated at charge time after items are removed, which would let a buyer qualify then drop the filler items.
141519. **Hidden Discount Code Discovery Guard** — check that coupon lookup endpoints do not confirm or deny codes in a way that enables brute-forcing, and that rate limits stop systematic guessing.
141520. **Public Coupon Leak Detection Sweep** — scan public sources for leaked internal promo codes and verify high-value ones are rotated or restricted, since leaked codes spread fast and erode revenue.
141521. **Coupon Per-User Limit Enforcement Audit** — verify per-account redemption caps are tracked by canonical account identity rather than session or email variants, catching alias-based reuse.
141522. **Self-Referral Reward Fraud Detector** — test whether an account can refer itself through disposable emails or device resets, and confirm identity-linking rules block the reward payout.
141523. **Referral Farming Velocity Monitor** — flag accounts generating statistically impossible referral rates and verify the program pauses payouts pending review, since bot farms industrialize referral abuse.
141524. **Referral Reward Premature Payout Check** — confirm referral credits are released only after the referred user completes a qualifying paid action, not at signup, which would otherwise pay for fake accounts.
141525. **Affiliate Cookie Stuffing Exposure Review** — check that affiliate attribution cannot be injected via forged click records or parameter replay, protecting the program from credit theft.
141526. **Gift Card Secret Harvesting Guard** — verify gift-card balance lookups require a full secret and resist sequential guessing, since enumerable codes turn the balance checker into a theft tool.
141527. **Gift Card Concurrent Redemption Race Test** — redeem the same gift card from two concurrent sessions and confirm the ledger debits exactly once, catching missing row-level locking.
141528. **Promo Balance Expiry Policy Audit** — verify promo credits expire on schedule and cannot be revived by timezone manipulation or balance transfers, which would otherwise make them permanent.
141529. **Store Credit Negative Balance Guard** — test refund and adjustment flows for paths that drive a wallet balance negative, since negative balances are often exploitable as free credit.
141530. **Credit Transfer Between Accounts Review** — check whether store credit can be moved between accounts without both-party consent, which enables laundering of fraudulently obtained balances.
141531. **Webhook Signature Verification Audit** — verify every payment webhook handler validates the provider's HMAC signature on the raw body before acting, since unsigned handlers accept forged payment confirmations.
141532. **Webhook Replay Attack Guard** — check that event IDs are deduplicated with a persistent store so a captured webhook cannot be replayed to double-credit an account.
141533. **Webhook Timestamp Freshness Check** — verify handlers reject events with stale timestamps, closing the window for delayed-replay attacks on time-sensitive billing actions.
141534. **Webhook Secret Rotation Readiness Review** — confirm the system can hold two active signing secrets during rotation without dropping valid events, since single-secret rotation causes either outages or verification gaps.
141535. **Webhook Delivery Order Resilience Test** — deliver payment events out of order and verify the ledger reaches the correct final state, catching state-machine bugs triggered by provider retries.
141536. **Webhook Endpoint Authentication Scope Check** — verify webhook URLs are unguessable and carry no session privileges, since a leaked endpoint that accepts state changes is a direct ledger-write primitive.
141537. **Provider Failover Event Consistency Audit** — test that switching between payment providers mid-flow does not double-record or drop charges, keeping a single source of truth during failover.
141538. **Test-Mode Event Leakage Guard** — verify sandbox or test-mode webhooks can never mutate production billing state, since environment confusion has historically credited real accounts.
141539. **Charge Idempotency Key Enforcement Test** — submit duplicate charge requests with the same idempotency key and confirm exactly one charge is created, catching key-generation bugs that double-bill on retries.
141540. **Idempotency Key Scope Collision Review** — check that keys are namespaced per merchant and operation type, so a key for a refund cannot accidentally suppress a charge or vice versa.
141541. **Idempotency Window Expiry Policy Audit** — verify the retention window for idempotency keys matches documented behavior and that expired keys do not silently permit duplicates, since ambiguity here causes double charges.
141542. **Double-Charge Detection Monitor** — scan the ledger for same-account, same-amount, near-simultaneous charges and verify alerts fire before settlement, catching duplicate billing before customers notice.
141543. **Retry Storm Backoff Verification** — confirm failed-payment retries use exponential backoff with jitter rather than tight loops, since retry storms can multiply charges and trigger provider rate limits.
141544. **Partial Capture Amount Integrity Check** — verify partial captures cannot exceed the authorized amount in aggregate across multiple captures, closing a path to overcharging a single authorization.
141545. **Payment Intent Reuse Guard** — test whether a confirmed payment intent can be attached to a second order, which would let one authorization pay for two purchases.
141546. **Refund Double-Entry Ledger Reconciliation** — verify every refund writes balanced debit and credit entries that tie back to the original charge, catching silent ledger drift.
141547. **Refund-to-Different-Card Policy Check** — confirm refunds route to the original payment method unless a verified exception workflow runs, since redirecting refunds is a classic cash-out path.
141548. **Duplicate Refund Race Detector** — issue two concurrent refunds against the same charge and verify the total refunded never exceeds the captured amount.
141549. **Serial Refunding Pattern Detector** — flag accounts with statistically abnormal refund rates and verify the system throttles or reviews them, since serial refunding is a low-risk theft pattern.
141550. **Chargeback Evidence Integrity Audit** — verify dispute evidence bundles are assembled from immutable transaction records rather than editable fields, so representment cannot be undermined by post-hoc edits.
141551. **Subscription State-Machine Drift Detector** — reconcile subscription statuses between the billing provider and the local database on a schedule, catching webhooks that were missed or applied out of order.
141552. **Plan Upgrade Proration Math Audit** — verify upgrades compute prorated charges from the canonical plan catalog and remaining time, since proration math bugs systematically over- or under-bill.
141553. **Downgrade Credit Timing Review** — confirm downgrade credits are applied at the documented billing boundary rather than immediately as withdrawable credit, closing an upgrade-downgrade arbitrage loop.
141554. **Trial Conversion Consent Record Check** — verify trials convert to paid plans only with explicit, recorded consent and a clear charge notification, catching dark-pattern auto-conversions.
141555. **Grace Cycle Exploitation Monitor** — monitor accounts cycling through repeated grace periods without ever paying and verify the policy limits consecutive grace grants.
141556. **Dunning Sequence Integrity Check** — confirm failed-payment dunning emails reflect the true outstanding balance and retry count, since stale dunning content confuses customers and support.
141557. **Subscription Pause Billing Freeze Test** — verify paused subscriptions accrue no charges and resume at the correct billing date, catching pause logic that bills silently in the background.
141558. **Seat-Based License Count Enforcement Audit** — verify active seats are counted from real provisioned users rather than self-reported numbers, since under-counting is the standard way seat licenses are abused.
141559. **Metered Usage Event Ordering Review** — confirm usage events are aggregated in event-time order with late-arrival handling, so out-of-sequence meter data does not corrupt the billable total.
141560. **Duplicate Metered Event Deduplication Test** — submit the same usage event twice and verify the meter counts it once, catching retry-induced overbilling.
141561. **Usage Quota Bypass Detection Monitor** — flag consumption patterns that exceed quota without triggering enforcement, revealing quota checks that run on a schedule attackers can race.
141562. **Overage Alert Reliability Audit** — verify overage warnings fire from the same metering pipeline that bills, since decoupled alerting lets bills surprise customers after silent overages.
141563. **Invoice Sequential Numbering Gap Audit** — verify invoice numbers are gapless per tax jurisdiction and flag missing sequences, since gaps indicate deleted or hidden invoices that break tax compliance.
141564. **Invoice PDF Predictable URL Guard** — test whether invoice PDFs are reachable via guessable URLs without authentication, which would expose every customer's billing details.
141565. **Invoice Data Exposure Scope Review** — confirm invoices show only the requesting account's data and redact other tenants' identifiers, catching cross-tenant leakage in shared invoice templates.
141566. **Credit Note Linkage Integrity Check** — verify credit notes reference their original invoices and cannot be issued standalone as untraceable credit, which would break audit trails.
141567. **Tax Rate Drift Detection Monitor** — reconcile applied VAT, GST, and sales-tax rates against current jurisdictional tables on a schedule, catching stale rates that create compliance exposure.
141568. **Tax ID Validation Enforcement Audit** — verify business tax IDs are validated at invoice time and invalid ones block zero-rated treatment, since unchecked IDs enable fraudulent tax-free billing.
141569. **Tax Nexus Threshold Tracker** — monitor revenue per jurisdiction against nexus thresholds and alert before collection obligations trigger, keeping the business ahead of registration duties.
141570. **Receipt Localization Accuracy Review** — confirm receipts render amounts, tax labels, and legal text correctly per customer locale, since mistranslated tax lines create disputes and compliance risk.
141571. **Multi-Currency Settlement Reconciliation Check** — verify settled amounts match authorized amounts after FX conversion within documented tolerance, catching provider-side conversion drift.
141572. **FX Rounding Policy Consistency Audit** — confirm currency conversions use a single documented rounding rule end to end, since mixed rules create penny discrepancies that compound across volume.
141573. **Saved Card Tokenization Scope Review** — verify stored payment tokens are merchant-scoped and cannot be replayed against other merchants, closing a token-reuse theft path.
141574. **Stored Card Detail Harvesting Guard** — check that adding or listing payment methods does not reveal whether a card number is valid or already on file for another account, which would aid card testing.
141575. **Card Testing Velocity Detector** — flag rapid small-amount authorization attempts from a single source and verify the gateway blocks them, since card testers probe with micro-charges.
141576. **3DS Liability Evidence Recorder Check** — confirm liability-shift records are stored per transaction and surfaced in disputes, so the business can prove authentication actually occurred.
141577. **SCA Exemption Concentration Tracker** — track low-value and transaction-risk-analysis exemptions for abnormal concentration, catching merchants or attackers routing fraud through exemption paths.
141578. **Stored Credential Consent Record Audit** — verify merchant-initiated transactions carry a recorded customer mandate with amount limits, since missing mandates make recurring charges indefensible in disputes.
141579. **Micro-Deposit Verification Replay Guard** — test whether bank-account micro-deposit verification codes can be reused or brute-forced, which would let an attacker link someone else's account.
141580. **Billing Portal Session Privilege Review** — verify the self-service billing portal cannot reach admin-only actions like manual adjustments or other customers' invoices through parameter tampering.
141581. **Billing Adjustment Dual-Control Audit** — confirm credits, discounts, and write-offs above a threshold require a second approver and leave an immutable audit entry, since unilateral adjustments enable insider fraud.
141582. **Billing Support Social Engineering Guardrails** — verify support tools require step-up verification before changing payment methods or issuing refunds, limiting what a persuaded agent can do.
141583. **PCI Log Redaction Verification Sweep** — scan application logs, error trackers, and webhooks for full PANs, CVVs, or secrets and confirm redaction is enforced at the logging layer.
141584. **Sandbox Key Production Leakage Check** — verify test or sandbox API keys cannot authenticate against production endpoints, since leaked test keys in client bundles are common.
141585. **Billing API Rate Limit Adequacy Test** — probe invoice, refund, and coupon endpoints for missing or generous rate limits that would allow automated abuse at scale.
141586. **Dunning Email Spoofing Resistance Review** — verify billing emails carry aligned SPF, DKIM, and DMARC so attackers cannot send convincing fake payment-failure notices to customers.
141587. **Invoice Email Tampering Detection Check** — confirm invoice emails are generated from signed templates with tamper-evident links, so altered payment instructions are detectable.
141588. **Marketplace Escrow Release Integrity Audit** — verify escrowed funds release only when all release conditions are verifiably met, since premature release is irreversible.
141589. **Platform Fee Calculation Accuracy Test** — reconcile platform fees against the documented rate card across split payments, catching fee logic that under-collects on edge cases.
141590. **Seller Payout Manipulation Guard** — verify payout amounts derive from the settled ledger rather than editable dashboard fields, closing a path to inflating one's own payout.
141591. **Annual-versus-Monthly Arbitrage Detector** — test plan-switch timing for paths that capture annual discounts while paying monthly rates, which erode the pricing model.
141592. **Family Plan Seat Sharing Abuse Review** — verify household or team plan seats are bound to real distinct users, since shared logins turn one seat into many.
141593. **Enterprise PO Invoice Approval Chain Audit** — confirm purchase-order invoices require the documented approval chain before issuance, since skipping approvals bypasses procurement controls.
141594. **Billing Timezone Cutoff Consistency Check** — verify billing-day boundaries use a single canonical timezone, catching cutoff bugs that grant or steal a day of service.
141595. **Leap-Year and DST Billing Edge Test** — run billing-date math across February 29 and daylight-saving transitions to confirm cycles stay exactly one period, since date libraries often slip a day.
141596. **Late-Arriving Usage Backfill Policy Review** — confirm backfilled usage events are billed under the period they occurred in with clear customer disclosure, preventing surprise retroactive charges.
141597. **Wallet Balance Integrity Reconciliation** — reconcile wallet balances against the transaction ledger on a schedule and alert on any drift, since silent drift indicates missing or duplicated entries.
141598. **Donation and Tip Flow Fraud Review** — verify tip and donation amounts cannot be altered between intent and capture, and that refunds of tips follow the same ledger rules as purchases.
141599. **BNPL Settlement Mismatch Detector** — reconcile buy-now-pay-later authorizations against provider settlement reports, catching orders shipped on authorizations that never settle.
141600. **Invoice PDF Metadata Leakage Sweep** — check generated invoices for embedded metadata like internal paths, usernames, or software versions that aid targeted attacks.
141601. **E-Invoice Signature Validity Audit** — verify electronic invoices carry valid cryptographic signatures per jurisdiction requirements, since unsigned e-invoices are rejected in audits.
141602. **Payment Provider Dashboard Access Review** — confirm only authorized finance roles can access provider dashboards with refund and payout powers, and that access is logged.
141603. **Billing Metrics Tampering Guard** — verify MRR, churn, and revenue dashboards read from the immutable ledger rather than editable aggregates, so metrics cannot be cosmetically inflated.
141604. **Subscription Transfer Consent Verification** — confirm moving a subscription between accounts requires explicit consent from both sides plus re-verified payment details, preventing account-takeover billing theft.
141605. **Pipeline Artifact Signature Verification Gate** — verify release artifacts carry valid signatures before deployment, since unsigned artifacts let a compromised build step ship tampered binaries unnoticed.
141606. **Provenance Attestation Completeness Check** — check that each build emits a signed provenance attestation recording source, inputs, and parameters, enabling downstream verifiers to detect forged builds.
141607. **Signature Transparency-Log Consistency Monitor** — compare artifact signatures against a transparency log to detect key misuse or unauthorized signing events that would otherwise go unnoticed.
141608. **Key-Rotation Signature Overlap Audit** — verify old and new signing keys coexist during rotation so valid artifacts remain verifiable while a compromised key is retired quickly.
141609. **Expired-Signature Artifact Rejection Test** — confirm the deployment gate rejects artifacts whose signatures or certificates have expired, since stale signatures mask post-release tampering.
141610. **Multi-Signer Threshold Release Check** — require k-of-n signers on production releases so a single compromised pipeline identity cannot authorize a release alone.
141611. **Signature Stripping Detection in Artifact Stores** — detect registry objects whose signatures were removed or replaced after upload, which indicates tampering at the store level.
141612. **Detached-Signature Availability Verifier** — ensure detached signatures are published alongside every artifact, since artifacts shipped without them cannot be verified by downstream consumers.
141613. **Build-Reproducibility Witness Attestation Audit** — check that independent rebuild witnesses countersign artifacts, proving the shipped binary matches its claimed source.
141614. **SBOM Signature Binding Check** — verify the SBOM is cryptographically bound to the artifact hash, preventing SBOM substitution that hides vulnerable components.
141615. **Lockfile Drift Detection Monitor** — flag builds whose resolved dependency tree diverges from the committed lockfile, since drift silently introduces unreviewed code.
141616. **Transitive Dependency Provenance Graph Builder** — map every transitive dependency to its registry, publisher, and version so provenance gaps are visible before release.
141617. **Dependency Publisher Identity Verification** — confirm each dependency's publisher identity matches expected namespaces, catching typosquat and account-takeover packages.
141618. **New-Dependency Approval Gate** — require security approval before a first-time dependency enters the build, since novel packages are the primary supply-chain attack vector.
141619. **Dependency Pinning Strictness Audit** — check that manifests pin exact versions or hashes rather than ranges, because floating ranges pull unreviewed updates mid-build.
141620. **Abandoned Dependency Risk Scorer** — score dependencies on maintenance signals such as commit recency and maintainer activity and flag abandoned ones, which accumulate unpatched vulnerabilities.
141621. **Vendored Dependency Freshness Tracker** — track vendored copies against upstream releases and alert when a vendored library lags behind published security fixes.
141622. **Duplicate Dependency Version Conflict Analyzer** — detect multiple versions of the same dependency in one build, since shadowing lets an older vulnerable copy execute.
141623. **Private Registry Fallback Leak Check** — verify private package names cannot fall through to public registries, which enables dependency-confusion attacks.
141624. **Dependency License Provenance Collector** — record the license of every dependency alongside its provenance so unlicensed or license-violating code is caught at build time.
141625. **Ephemeral Runner Attestation Check** — verify each build ran on a fresh, single-use runner so artifacts from one job cannot contaminate the next.
141626. **Runner Filesystem Residue Scanner** — inspect the runner disk after job completion for leftover credentials, caches, or artifacts that could leak into subsequent builds.
141627. **Cross-Job Cache Poisoning Detector** — detect cache entries written by one job and consumed by another without integrity checks, which enable supply-chain poisoning.
141628. **Runner Network Egress Allowlist Audit** — confirm build runners can only reach approved hosts, since open egress lets compromised build steps exfiltrate secrets.
141629. **Lifespan-Based Runner Isolation Tiering Audit** — tier runner isolation controls by runner lifespan, since persistent runners accumulate state and trust that ephemeral runners never do, making them the richer target.
141630. **Runner Label Spoofing Guard** — test whether untrusted forks can request privileged runner labels, which would execute attacker-controlled code on trusted infrastructure.
141631. **Container Escape Surface Review for Job Sandboxes** — evaluate the isolation of job containers across seccomp, user namespaces, and capabilities to confirm a malicious build step cannot reach the host.
141632. **Build Artifact Cross-Tenant Isolation Test** — verify artifacts from different tenants never share runner storage or caches, preventing cross-customer contamination.
141633. **Runner Metadata Service Exposure Check** — check that cloud metadata endpoints are unreachable from job code, since they yield credentials for the runner's cloud identity.
141634. **Post-Job Secret Scrubbing Verifier** — confirm secrets injected into the runner environment are scrubbed from memory and disk after the job ends.
141635. **Build Log Secret Pattern Scanner** — scan all pipeline logs for credential patterns such as tokens, keys, and connection strings, and redact them before logs become visible to contributors.
141636. **Log Streaming Real-Time Redaction Monitor** — redact secrets from streaming logs at emit time, since post-hoc redaction leaves a window where secrets are visible.
141637. **Masked-Variable Bypass Detector** — test whether masked secret values can be recovered through substring, length, or echo tricks in build scripts, which defeats masking.
141638. **Debug Artifact Secret Leak Audit** — inspect debug dumps, core files, and verbose traces attached to failed builds for embedded credentials.
141639. **Artifact Metadata Secret Exposure Check** — verify container labels, image manifests, and package metadata do not embed secrets copied from the build environment.
141640. **Fork-Triggered Secret-Log Redaction Gap Review** — verify logs from fork-triggered runs are redacted even when the fork controls workflow inputs, since input-driven echo is the easiest way to defeat masking.
141641. **Historical Log Retroactive Secret Scan** — scan archived logs for secrets logged before scanning was enabled, since rotation is impossible without knowing the exposure.
141642. **Secret Rotation After Log Exposure Trigger** — automatically rotate any credential detected in build logs, because detection without rotation leaves the secret usable.
141643. **Environment Variable Dump Detection** — flag build steps that print the full environment, a classic accidental secret exposure in CI scripts.
141644. **Marketplace Action Telemetry Exfiltration Review** — inspect whether third-party actions transmit execution telemetry to vendor endpoints, which would carry any secrets those steps captured.
141645. **Workflow Token Scope Minimization Audit** — verify every workflow declares minimal permissions instead of inheriting broad defaults, since overprivileged tokens let compromised steps rewrite releases.
141646. **OIDC Identity Claim Restriction Check** — confirm short-lived OIDC tokens are scoped to the exact repository, branch, and environment so stolen tokens cannot be replayed elsewhere.
141647. **Environment Protection Rule Coverage Audit** — check that production environments require manual approval and restricted reviewers, preventing automatic deployment from any branch.
141648. **Fork Pull-Request Privilege Boundary Test** — verify workflows triggered by forks run with read-only tokens and no secret access until maintainer approval.
141649. **Deployment Key Rotation Cadence Monitor** — track the age of pipeline deploy keys and flag stale ones, since long-lived keys widen the blast radius of a repository compromise.
141650. **CI Identity Standing-Permission Decay Audit** — measure how many pipeline identities retain permissions unused for 90+ days and require periodic re-attestation, because stale grants turn one breach into full infrastructure access.
141651. **Secrets Scope Narrowing Analyzer** — detect repository-wide secrets that are needed by only one environment and recommend scoping them down.
141652. **Pull-Request Label Privilege Escalation Test** — test whether adding labels to a pull request can trigger privileged workflows, which lets external contributors run trusted pipelines.
141653. **Reusable Workflow Caller Authorization Check** — verify shared workflows validate their callers so a malicious repository cannot invoke privileged pipeline logic.
141654. **Branch Protection Bypass Permission Audit** — list identities allowed to bypass branch protections and confirm each is justified, since bypass rights can silently push unreviewed code.
141655. **Bit-for-Bit Rebuild Comparison Harness** — rebuild releases from source on independent infrastructure and compare hashes, proving the shipped binary matches the reviewed code.
141656. **Build Timestamp Normalization Check** — verify timestamps are normalized so rebuilds produce identical artifacts instead of nondeterministic ones.
141657. **Build Input Ordering Determinism Test** — confirm file and input ordering is deterministic across builds, since nondeterministic ordering breaks reproducibility silently.
141658. **Embedded Path Leakage Normalizer** — check that absolute build paths are stripped or normalized in artifacts, which both leaks infrastructure details and breaks reproducibility.
141659. **Compiler Version Pinning Audit** — verify the exact toolchain version is pinned and recorded, because toolchain drift changes binaries without source changes.
141660. **Reproducibility Regression Monitor** — rebuild each release candidate twice on different hosts and alert on any hash mismatch before release.
141661. **Hermetic Build Network Isolation Test** — confirm release builds fetch no undeclared network resources, since hidden downloads undermine reproducibility claims.
141662. **Build Cache Determinism Guard** — test that cache hits return byte-identical outputs to fresh builds, catching cache corruption or poisoning.
141663. **Source Archive Integrity Verification** — verify release source archives match the tagged commit exactly, so the reviewed code is what actually gets built.
141664. **Reproducible Container Image Builder Audit** — check container builds for nondeterministic layers such as timestamps and package install order, and enforce deterministic layer generation.
141665. **Pre-Release Vulnerability Gate Enforcer** — block releases when dependencies contain vulnerabilities above the severity threshold, since gates without enforcement are decoration.
141666. **Required Check Bypass Attempt Detector** — test whether release pipelines can be triggered while required status checks are pending or failing.
141667. **Release Branch Policy Compliance Audit** — verify only designated release branches can produce production artifacts, preventing feature branches from shipping.
141668. **Manual Approval Chain Integrity Check** — confirm multi-stage approvals cannot be self-approved or reordered to skip a reviewer.
141669. **Hotfix Exception Trail Recorder** — record every emergency bypass of release gates with approver identity and rationale so hotfixes stay auditable.
141670. **Canary Gate Automatic Rollback Trigger** — verify canary deployments automatically roll back when error budgets burn, since a gate without automated response is just a delay.
141671. **Release Notes Vulnerability Disclosure Reviewer** — check release notes for accidental disclosure of exploitable details before coordinated disclosure dates.
141672. **Tag Immutability Enforcement Test** — confirm release tags cannot be moved or deleted after signing, because mutable tags let attackers repoint releases at malicious commits.
141673. **Draft Release Exposure Boundary Check** — verify draft and prerelease artifacts are not publicly accessible before the release is finalized.
141674. **Rollback Artifact Availability Verifier** — ensure the previous known-good artifact remains signed and deployable so rollbacks do not require rebuilding from potentially compromised sources.
141675. **Workflow File Blast-Radius Change Gate** — require multi-person review for workflow edits touching credentials, environments, or runner selection, since those edits control the whole pipeline's trust.
141676. **Inline Script vs. Action Audit** — flag long inline scripts in workflows and recommend pinned external actions, because inline scripts evade version control and review tooling.
141677. **Floating-Ref Action Resolution Freeze Check** — verify no workflow resolves actions by branch or tag at runtime and that all references resolve to immutable SHAs at queue time, so compromised refs cannot inject malicious steps.
141678. **Compromised Action Version Drift Detector** — monitor pinned actions for upstream changes that indicate account takeover of a trusted action.
141679. **Workflow Secret Inheritance Tracer** — trace which secrets each workflow job actually consumes so unused secrets can be removed from scope.
141680. **Secrets Manager Integration Health Check** — verify pipeline secrets are fetched from a secrets manager at runtime rather than stored as long-lived repository secrets.
141681. **Short-Lived Credential Issuance Audit** — confirm pipeline credentials expire within the job lifetime so leaked tokens are useless after the build ends.
141682. **Build Provenance Retention Policy Check** — verify provenance records and attestations are retained long enough for post-incident forensics.
141683. **Out-of-Band Pipeline Setting Change Alerter** — alert on pipeline setting changes made through APIs or admin consoles rather than version-controlled files, which bypass review.
141684. **Release Decision Policy Attribution Recorder** — record which policy rules produced each release approval or denial so contested gate outcomes can be reconstructed exactly.
141685. **CI Audit Trail Immutability Verifier** — verify CI audit trails are write-once and mirrored externally so attackers cannot erase evidence of malicious builds.
141686. **Anomalous Build Behavior Baseline Detector** — learn normal build patterns for duration, network, and egress, and flag deviations that suggest compromised build steps.
141687. **Unauthorized Pipeline Trigger Detector** — alert when pipelines are triggered outside expected events such as schedules and merges, which can indicate token abuse.
141688. **Build Queue Starvation Monitor** — detect jobs stuck in queue that delay security patch releases, since starved pipelines miss disclosure windows.
141689. **Dependency Update Bot Oversight Check** — verify automated dependency pull requests still pass the full gate suite and human review before merge.
141690. **License Change Detection in Dependencies** — flag dependency updates that change licenses, which can silently introduce compliance risk into releases.
141691. **Malicious Maintainer Behavior Watchlist** — correlate dependency updates against maintainer-compromise indicators such as sudden ownership changes and minified diffs.
141692. **Package Registry Mirror Integrity Check** — verify internal mirrors serve byte-identical copies of upstream packages to detect mirror tampering.
141693. **Air-Gapped Build Dependency Bundle Verifier** — check that offline build bundles match approved dependency manifests before use in isolated environments.
141694. **Build Environment Variable Provenance Logger** — record which variables were injected into each build so post-incident review can distinguish legitimate from malicious values.
141695. **Runner Image Supply-Chain Audit** — verify runner base images come from trusted, signed sources and are rebuilt on a schedule.
141696. **Ephemeral Environment Secret Zeroization Test** — confirm secrets are zeroed in memory before runner teardown, not merely dereferenced.
141697. **Pipeline Notification Spoofing Guard** — verify build status notifications are authenticated so attackers cannot forge passing status on malicious builds.
141698. **Status Check Context Impersonation Test** — test whether an attacker can post fake passing status checks under a trusted context name to bypass branch protection.
141699. **Freeze-Window Break-Glass Usage Auditor** — audit every emergency deploy made during freeze windows for authorization, timing, and completed post-hoc review, since break-glass paths are the weakest gate.
141700. **Multi-Slot Release Consistency Checker** — verify all deployment slots converge on the same signed artifact version before and after traffic shifts, catching partial rollouts.
141701. **Release Artifact Retention Attack-Surface Review** — audit retained old artifacts for known vulnerabilities so a rollback target is never an exploitable build.
141702. **Decommissioned Pipeline Credential Sweeper** — find credentials belonging to deleted pipelines and revoke them, since orphaned credentials are invisible to their owners.
141703. **Cross-Repository Secret Reuse Detector** — flag the same secret value used across repositories, which turns one repository compromise into many.
141704. **Pipeline Disaster-Recovery Drill Verifier** — verify the release pipeline can be rebuilt from source after total loss, since recovery plans that were never tested are assumptions.
141705. **Base-Image Freshness Drift Audit** — flag base images whose OS packages lag behind upstream security patches by N days, since stale layers silently reintroduce fixed CVEs into every downstream build.
141706. **Distroless Adoption Coverage Check** — measure which workloads still ship full OS userlands, since minimal images shrink the attack surface and remove the shell tooling an intruder would rely on.
141707. **SBOM Completeness Verification** — verify every deployed image carries a machine-readable SBOM covering all layers, since missing manifests turn vulnerability triage into guesswork.
141708. **Layer-Level CVE Accumulation Scan** — attribute each known CVE to the exact image layer that introduced it, so teams rebuild from the guilty layer instead of re-cutting the whole image.
141709. **Digest Pinning Enforcement Review** — confirm deployments reference images by immutable digest rather than mutable tags, since tag reassignment can silently swap what actually runs in production.
141710. **Tag Mutability Risk Assessment** — detect registries that allow overwriting released tags, since a rewritten tag undermines every signature and scan tied to the original.
141711. **Provenance Attestation Presence Check** — verify each image carries signed build provenance, so the agent can trace a running container back to the exact source commit and builder.
141712. **Signature Verification Gap Audit** — check whether admission only allows images with valid signatures, since an unenforced signing policy provides no real supply-chain guarantee.
141713. **SLSA Build-Level Attestation Review** — grade images against SLSA build levels, since hermetic, attested builds are what make provenance claims trustworthy.
141714. **Registry Cache Poisoning Resilience Test** — verify the registry cache cannot serve attacker-influenced layers, since a poisoned cache silently feeds tainted images to the cluster.
141715. **Registry Credential Namespace Confinement Review** — check that pull secrets are scoped to the namespaces that need them, since cluster-wide secrets let any compromised pod pull private images.
141716. **Private Registry TLS Enforcement Check** — verify registries are reachable only over verified TLS, since plaintext pulls expose image contents and credentials on the wire.
141717. **RunAsNonRoot Enforcement Gap Finder** — list workloads missing runAsNonRoot, since a container running as UID 0 inherits host-level privileges on escape.
141718. **Immutable Container Filesystem Coverage Audit** — check which pods lack readOnlyRootFilesystem, since a writable root lets malware persist inside the container filesystem.
141719. **Privilege-Escalation Flag Misconfiguration Scan** — flag allowPrivilegeEscalation left true, since it lets a process gain capabilities the pod spec never granted.
141720. **Capability-Drop Completeness Review** — verify containers drop ALL capabilities then add back only what is needed, since default capability sets include rights an ordinary workload should never hold.
141721. **Privileged Container Detection Sweep** — enumerate any privileged:true workloads, since privileged mode disables nearly every container isolation boundary at once.
141722. **Seccomp Profile Coverage Audit** — check that every pod runs under a restrictive seccomp profile, since unfiltered syscalls expose the full kernel attack surface.
141723. **AppArmor Profile Binding Verification** — confirm AppArmor profiles are actually loaded and bound to pods, since a referenced-but-missing profile silently runs unconfined.
141724. **Host-Network Namespace Exposure Audit** — flag pods sharing the host network namespace, since they can sniff node traffic and bind host ports.
141725. **Host-PID Namespace Sharing Review** — detect hostPID:true pods, since visibility into host processes enables escape primitives and credential harvesting from the node.
141726. **Host-IPC Namespace Sharing Check** — flag hostIPC:true pods, since shared IPC lets a container snoop on or inject into host and sibling processes.
141727. **HostPath Volume Risk Audit** — enumerate hostPath mounts and grade their paths, since mounting / or the container runtime socket hands the host to the container.
141728. **SubPath Symlink Traversal Review** — check subPath mounts for symlink-escape exposure, since a crafted symlink can redirect the mount to host directories.
141729. **Shared-Volume Cross-Container Leakage Test** — verify volumes shared between containers do not leak secrets across trust boundaries, since sidecars often over-share with the main container.
141730. **EmptyDir Size-Limit Enforcement Check** — flag emptyDir volumes without sizeLimit, since unbounded ephemeral writes let one pod exhaust node disk.
141731. **Ephemeral-Storage Quota Coverage Review** — check ephemeral-storage requests and limits on every pod, since missing quotas turn disk pressure into node-wide evictions.
141732. **Tmpfs Mount Sensitivity Audit** — review tmpfs mounts for keys and secrets, since memory-backed volumes vanish on restart and can bypass persistent audit trails.
141733. **Default-Deny NetworkPolicy Coverage Check** — verify every namespace has default-deny ingress and egress policies, since without them pods accept traffic from anywhere in the cluster.
141734. **Namespace Isolation Policy Gap Finder** — find namespaces lacking isolation policies between tenant workloads, since flat networking lets one tenant reach another tenant's pods.
141735. **Metadata-Endpoint Egress Restriction Audit** — verify cloud metadata endpoints are blocked by egress policy, since SSRF inside a pod can harvest node credentials from them.
141736. **Pod-to-Pod CIDR Allowlist Review** — check that network policies use narrow CIDR ranges, since overly broad ranges recreate the flat network the policy was meant to fix.
141737. **DNS Egress Policy Enforcement Test** — verify DNS traffic is restricted to the cluster resolver, since open DNS egress enables tunneling and data exfiltration.
141738. **NetworkPolicy Audit-Logging Coverage Check** — check that denied connections are logged, since silent drops give defenders no signal of lateral-movement attempts.
141739. **Ingress TLS Default Review** — flag Ingress resources serving plaintext or weak TLS, since edge misconfiguration exposes every backend service at once.
141740. **Service-Mesh mTLS Strictness Audit** — verify the mesh enforces STRICT mTLS, since permissive mode lets unmeshed pods talk to meshed services unauthenticated.
141741. **Sidecar Injection Trust Review** — check which namespaces allow automatic sidecar injection, since a malicious or misconfigured sidecar observes all pod traffic.
141742. **Env-Var Secret Exposure Audit** — find secrets passed as environment variables, since env is visible in pod specs, logs, and process listings to anyone with read access.
141743. **Secret Volume-Mount Permission Review** — verify secret volumes mount with restrictive file modes, since world-readable secret files leak to any process in the pod.
141744. **Secret SubPath Mount Isolation Check** — check subPath-mounted secrets do not expose sibling keys, since a directory mount can leak more than the intended single key.
141745. **Etcd Secret-Store Cipher Audit** — confirm the encryption provider is configured for Secrets, since unencrypted etcd leaks every secret to anyone with etcd read access.
141746. **Secret Rotation Freshness Audit** — flag secrets older than the rotation policy, since long-lived credentials widen the window after an undetected leak.
141747. **External-Secrets Sync Health Review** — verify external secret syncs are succeeding and fresh, since a stale sync leaves pods running with revoked credentials.
141748. **ServiceAccount Token Automount Audit** — list pods with automountServiceAccountToken left on unnecessarily, since every mounted token is a credential an attacker can steal.
141749. **ServiceAccount Least-Privilege Review** — check that each service account's RBAC grants match what the workload actually calls, since over-broad accounts turn a pod compromise into a cluster compromise.
141750. **ClusterRole Binding Scope Audit** — flag ClusterRoleBindings granting cluster-wide power to namespace workloads, since cluster scope multiplies the blast radius of one stolen token.
141751. **RBAC Wildcard Permission Finder** — detect roles using wildcards on verbs or resources, since wildcard grants silently expand with every new API the cluster enables.
141752. **Impersonation Privilege Review** — check who holds impersonate rights, since impersonation lets an attacker act as any user, including cluster-admin.
141753. **Admission-Webhook Bypass Gap Check** — verify no service accounts can bypass validating webhooks, since a bypass path nullifies every policy the webhook enforces.
141754. **Mutating-Webhook Ordering Review** — check that mutating webhooks run in a safe order, since a later webhook can undo the security defaults an earlier one applied.
141755. **Policy-Exception Allowlist Drift Audit** — track policy exceptions over time and flag stale ones, since forgotten exceptions become permanent holes.
141756. **Dry-Run vs Enforce Mode Gap Check** — find policies stuck in dry-run or warn mode, since unenforced policies give a false sense of coverage.
141757. **Policy-Engine Coverage Review** — measure what fraction of workloads the policy engine actually evaluates, since unscoped namespaces run with no guardrails at all.
141758. **Pod Security Standards Baseline Audit** — check namespaces against the restricted Pod Security Standard, since baseline gaps are the fastest path to privilege escalation.
141759. **Kubelet Unauthenticated Port Exposure Audit** — verify the kubelet read-only port is disabled or firewalled, since it leaks pod specs, including env secrets, without authentication.
141760. **Kubelet Anonymous-Auth Review** — check that anonymous requests to the kubelet are denied, since anonymous exec and log access is a direct pod-compromise primitive.
141761. **Dashboard Exposure Audit** — detect reachable Kubernetes dashboards, since an exposed dashboard with weak auth is a cluster-admin shortcut.
141762. **Helm Chart Default-Value Risk Review** — scan chart defaults for insecure settings, since teams deploy charts verbatim and inherit every unsafe default.
141763. **Operator RBAC Scope Audit** — check that operators request only the RBAC they need, since over-permissioned operators are high-value compromise targets.
141764. **CRD Validation-Schema Gap Check** — find CustomResourceDefinitions lacking validation schemas, since unvalidated CRDs let attackers inject malformed spec data into controllers.
141765. **Init-Container Privilege Review** — check init containers for elevated privileges, since init containers run first with the same host access and are often overlooked.
141766. **Resource-Limit Absence Audit** — flag containers without CPU or memory limits, since one runaway container can starve the node and evict its neighbors.
141767. **ResourceQuota Coverage Check** — verify every namespace has quotas, since quota-less namespaces let one tenant consume the whole cluster.
141768. **PodDisruptionBudget Absence Review** — find critical services without disruption budgets, since missing budgets let voluntary disruptions take down the entire service.
141769. **CronJob History-Limit Review** — check failed-job history limits, since unbounded history keeps dead pods with stale secrets around indefinitely.
141770. **Image-Scan CI-Gate Coverage Audit** — verify the CI pipeline blocks unscanned or failing images, since a gate that only warns ships vulnerable images anyway.
141771. **Admission-Webhook TLS Verification Check** — confirm webhook servers present valid certificates, since a webhook over unverified TLS can be impersonated to approve malicious pods.
141772. **Taint-Toleration Bypass Review** — check that sensitive nodes' taints cannot be trivially tolerated, since weak taints fail to keep untrusted workloads off special nodes.
141773. **Workload-Identity Federation Audit** — verify cloud IAM bindings map to the intended service accounts, since a misbound identity hands cloud privileges to the wrong pod.
141774. **RuntimeClass Sandbox Coverage Review** — check that untrusted workloads use sandboxed runtimes, since the default runtime shares the kernel with every tenant.
141775. **Sysctl Allowlist Review** — audit unsafe sysctls permitted on pods, since kernel tunables can be abused for host-level effects.
141776. **Confidential-Container Enclave Audit** — verify confidential-computing protections are actually attested, since an unmeasured enclave gives no integrity guarantee.
141777. **Registry-Mirror Trust Review** — check configured registry mirrors for TLS and authenticity, since a rogue mirror can serve trojaned images to the whole fleet.
141778. **Layer-Cache Poisoning Check** — verify build caches cannot be poisoned across tenants, since a tainted cache layer ships the attacker's code into victim builds.
141779. **Crash-Loop Log Secret-Exposure Check** — check that crash-looping pods do not dump secrets into logs, since repeated restarts multiply the copies of leaked credentials.
141780. **Probe Secret-Leakage Review** — verify liveness and readiness probes do not embed credentials in URLs, since probe definitions are readable by low-privilege viewers.
141781. **Interactive Pod-Shell Session Logging Review** — verify exec sessions into pods are logged with user identity, since unlogged exec is an invisible interactive shell.
141782. **Ephemeral Debug-Container Policy Review** — check that ephemeral debug containers require approval, since debug containers can run privileged and bypass image policy.
141783. **Node Disk-Pressure Eviction Safety Audit** — verify eviction behavior under disk pressure, since an attacker filling disk can force eviction of security agents.
141784. **Multi-Container Log Interleaving Leakage Check** — check that sidecar logs do not capture main-container secrets, since shared log streams mix trust levels.
141785. **Termination-Message Secret-Leakage Review** — verify termination messages do not include secrets, since they persist in the API after the pod dies.
141786. **Downward-API Field Exposure Audit** — review which pod fields are exposed via the downward API, since over-exposure leaks node and pod metadata to the workload.
141787. **Projected-Token Expiry Review** — verify projected service-account tokens use short expirations, since long-lived tokens remain valid long after the pod is gone.
141788. **Pod Anti-Affinity Tenancy Review** — check anti-affinity rules actually separate tenants across nodes, since co-located tenants share the kernel attack surface.
141789. **Topology-Spread Blast-Radius Audit** — verify spread constraints limit how many replicas share a zone, since a zone failure or compromise then takes the whole service.
141790. **PriorityClass Preemption-Abuse Review** — check who can create high-priority pods, since priority preemption lets an attacker evict other tenants' workloads.
141791. **Node-Selector Evasion Detection Check** — verify workloads cannot self-select onto restricted nodes, since node labels are advisory without admission enforcement.
141792. **Control-Plane Certificate Rotation Audit** — verify control-plane certificates rotate before expiry, since an expired cert breaks the API and forces insecure workarounds.
141793. **Etcd Snapshot Exposure Review** — check etcd backups for encryption and access control, since a snapshot contains every secret in the cluster in recoverable form.
141794. **Control-Plane Endpoint Exposure Audit** — verify the API server is not reachable from untrusted networks, since an exposed API invites credential-stuffing against cluster auth.
141795. **Kubernetes Audit-Log Retention Review** — check audit-log retention covers incident-response windows, since short retention deletes the evidence of a breach.
141796. **Runtime Threat-Detection Coverage Review** — verify runtime sensors cover every node, since an unmonitored node is where container escapes go unnoticed.
141797. **Image Garbage-Collection Policy Audit** — check image GC actually reaps old images, since stale images on disk can be resurrected with known vulnerabilities.
141798. **Orphaned-Workload Detection Sweep** — find pods and jobs no controller owns, since orphaned workloads escape policy updates and ownership accountability.
141799. **Namespace Termination Stall Review** — check for namespaces stuck terminating, since stalled namespaces keep running workloads outside lifecycle controls.
141800. **LimitRange Default Coverage Audit** — verify LimitRanges set safe defaults in every namespace, since missing defaults let pods launch with no constraints at all.
141801. **Sandbox Overhead Accounting Review** — check that sandboxed runtimes account CPU and memory overhead, since unaccounted overhead lets pods exceed node capacity.
141802. **ConfigMap Secret-Material Detection Scan** — find secrets mistakenly stored in ConfigMaps, since ConfigMaps are readable under far broader RBAC grants.
141803. **Binary-Authorization Policy Drift Audit** — verify deploy-time binary authorization matches the declared policy, since drift reopens the door to unsigned images.
141804. **Kube-Proxy Configuration Review** — audit kube-proxy mode and settings for exposure, since misconfigured proxying can bypass network policies at the node level.
141805. **Prompt-Injection Resistance Harness** — run a seeded indirect-prompt corpus against the model's tool loop and score pass/fail per case, since untested assistants obey attacker-planted instructions hiding inside retrieved content.
141806. **Tool-Result Command-Following Sentinel** — mark tool results as untrusted and verify the model never treats them as user commands, since tool outputs are the primary injection channel in agentic systems.
141807. **Cross-User Context Boundary Enforcer** — partition conversation memory per user and session, then prove no bleed-through occurs, since shared context leaks one user's data into another's answers.
141808. **System-Prompt Extraction Probe** — attempt graduated elicitation of the system instructions and measure leakage severity, since exposed system prompts reveal guardrails and internal policies.
141809. **Tool-Call Authorization Gate Review** — verify every function call passes an allow-listed, scope-checked authorization step before execution, since models invent or overreach tool calls without it.
141810. **Function-Schema Strictness Auditor** — test that the dispatcher rejects tool calls carrying extra, mismatched, or malformed parameters, since lax schemas let the model smuggle instructions into arguments.
141811. **RAG Retrieval Exfiltration Guard** — confirm retrieved documents are filtered by the requester's clearance before grounding begins, since RAG pipelines routinely serve chunks the user was never meant to see.
141812. **RAG Citation Provenance Checker** — verify every grounded claim cites a permitted source chunk, since ungrounded answers hide where sensitive facts came from.
141813. **Embedding Inversion Exposure Test** — assess whether embeddings returned by the API can be inverted to recover source text, since vector stores leak documents through similarity endpoints.
141814. **Conversation Summary Leakage Audit** — check that long-chat summaries do not retain other users' secrets, since rolling summaries propagate context across sessions.
141815. **Plugin Permission Hygiene Scanner** — audit installed plugins for over-broad scopes and verify runtime checks match declared scopes, since plugins request everything and enforce nothing.
141816. **Tool Description Poisoning Detector** — scan tool descriptions for instruction-like language and flag their providers, since the model reads tool documentation as commands.
141817. **Multi-Turn Instruction Drift Monitor** — detect when the model's behavior diverges from the originally authorized task over long turns, since drift is how injections quietly escalate.
141818. **Action Budget Enforcer** — cap consecutive tool calls per task with hard limits and anomaly alerts, since runaway agents burn quota or exfiltrate data in volume.
141819. **Destructive-Call Confirmation Gate** — require explicit user approval before writes, deletes, or external sends, since a single misparsed intent is enough to destroy data.
141820. **Output PII Redaction Validator** — run seeded PII through the model and verify redaction fires before display, since models repeat credentials and identifiers verbatim.
141821. **Training-Data Memorization Probe** — query the model with known public-secret patterns to detect verbatim recall, since memorized keys become regurgitation risk.
141822. **Jailbreak Regression Suite** — re-run a maintained jailbreak corpus after every model update, since guardrail regressions silently re-open previously closed bypasses.
141823. **Refusal Consistency Checker** — verify refusal behavior stays stable across paraphrases of the same disallowed request, since inconsistent refusals reveal classifier gaps.
141824. **Delimiter Spoofing Test** — feed documents carrying fake system and user delimiters and verify the model does not obey them, since delimiter spoofing is a classic injection vector.
141825. **Homoglyph Injection Screen** — detect look-alike characters used to hide instructions inside content, since homoglyphs bypass keyword-based injection filters.
141826. **Zero-Width Payload Detector** — strip and flag invisible characters in retrieved content before it reaches the model, since hidden text carries hidden instructions.
141827. **Multilingual Injection Coverage Audit** — test injection defenses across every language the model serves, since attackers switch languages to dodge English-trained filters.
141828. **Image-Embedded Instruction Review** — verify vision inputs are scanned for text instructions embedded in pixels, since OCR-visible text inside images steers the model.
141829. **Audio Transcript Trust Filter** — check that transcribed audio is treated as untrusted data rather than commands, since voice inputs can carry spoken instructions.
141830. **File-Upload Quarantine Check** — isolate uploaded files from instruction-following until they are scanned, since PDFs and documents embed prompt payloads.
141831. **Fetched-URL Trust Boundary Test** — confirm fetched web pages are labeled untrusted and summarized safely, since pages are attacker-controlled instruction stores.
141832. **Email Thread Injection Probe** — test whether quoted history inside emails can redirect the assistant's actions, since reply chains carry third-party instructions.
141833. **Calendar Event Smuggling Check** — verify event titles and descriptions cannot schedule unauthorized actions, since shared calendars inject commands.
141834. **Code-Comment Injection Scanner** — check that reviewed code comments are never executed as instructions, since code-review assistants read attacker-written comments.
141835. **Log-File Poisoning Audit** — confirm pasted logs are analyzed strictly as data, since logs with embedded prompts redirect incident-response agents.
141836. **Query-Result Injection Guard** — treat database rows as untrusted text inside NL-to-SQL assistants, since stored rows can carry instruction payloads.
141837. **API Error-Message Shield** — verify error strings returned from APIs are never followed as directives, since verbose errors double as injection channels.
141838. **Tool-Output Size Bomb Guard** — cap and truncate oversized tool outputs, since giant results hide malicious instructions deep in the payload.
141839. **Instruction Hierarchy Resolver** — enforce a strict authority order of system over developer over user over tool over content, since flat prompts let content outrank commands.
141840. **Conflicting-Instruction Arbitration Test** — verify the model resolves contradictions by authority rank rather than recency, since later injections should never win.
141841. **Model Output Leakage Detector** — scan completions for secrets, internal URLs, and configuration fragments before delivery, since models echo infrastructure details.
141842. **Reasoning-Trace Exposure Audit** — confirm internal reasoning is stripped from user-visible responses, since chain-of-thought leaks deliberation and secrets.
141843. **Tool-Argument Disclosure Check** — verify users cannot trick the model into revealing raw tool arguments, since arguments contain credentials and paths.
141844. **Conversation Export Scrubber** — test that exported chats redact secrets before download, since chat exports travel over insecure channels.
141845. **Shared-Link Leakage Test** — verify shared chat links do not expose earlier private turns, since link sharing can publish the whole thread.
141846. **Fine-Tune Poisoning Risk Review** — audit training pipelines for untrusted web data that teaches backdoors, since poisoned corpora create hidden triggers.
141847. **Reward-Hacking Monitor** — watch safety evaluations for sycophancy and metric-gaming, since optimized scores hide misaligned behavior.
141848. **Benchmark Contamination Checker** — verify evaluation questions are absent from training data, since contaminated scores fake safety readiness.
141849. **Model Card Claims Verifier** — test the vendor's published safety claims against the deployed build, since marketing copy outruns the actual guardrails.
141850. **Prompt-Cache Isolation Test** — confirm cached prompts never leak between tenants on shared inference, since cache reuse is a side channel.
141851. **Inference Log Retention Auditor** — check that stored prompts and completions carry proper access controls, since logs are a concentrated trove of secrets.
141852. **Streaming Abort Safety Check** — verify the model stops cleanly on abort without leaking partial secrets, since cancelled streams still render fragments.
141853. **Logit Exposure Review** — assess whether probability outputs enable secret extraction, since token probabilities leak what the model is unsure about.
141854. **Batch Cross-Request Leakage Test** — confirm batched requests cannot influence one another's outputs, since shared batches cross-contaminate.
141855. **Agent-Loop Recursion Guard** — detect and break self-referential tool loops, since agents can spin forever on failed subtasks.
141856. **Tool-Chain Depth Limiter** — enforce a maximum reasoning-action chain depth per task, since unbounded chains amplify a single bad decision.
141857. **External-Action Allowlist Enforcer** — verify the agent can reach only pre-approved domains and endpoints, since open network access turns injections into data theft.
141858. **Credential Vault Boundary Test** — confirm the model never sees raw secrets even when its tools need them, since credential visibility invites exfiltration.
141859. **Just-In-Time Scope Narrowing Check** — verify tool tokens are minted per call with minimal scopes, since standing tokens outlive their purpose.
141860. **Manual Approval Escalation Trigger** — route high-risk actions to manual approval with full context attached, since autonomy needs a brake pedal.
141861. **Compensation Plan Generator** — require every destructive plan to ship with a rollback procedure, since agents break things that cannot be unbroken.
141862. **Plan-Execution Divergence Alarm** — alert when executed actions deviate from the approved plan, since drifted execution is unauthorized execution.
141863. **Sub-Agent Spawn Permission Review** — verify child agents inherit only the scopes they need, since spawned agents inherit the parent's full power by default.
141864. **Agent Collusion Detector** — monitor cooperating agents for coordinated policy evasion, since divided labor hides each step from monitors.
141865. **Persistent Memory Ingress Authorization Check** — verify long-term memory stores only user-approved facts, since poisoned memory persists across sessions.
141866. **Memory Read Filtering Audit** — confirm retrieved memories are scoped to the current user, since shared memory leaks other users' data.
141867. **Cutoff Hallucination Guard** — test that the model flags uncertainty on post-cutoff facts, since confident hallucinations become false security findings.
141868. **Citation Fabricator Detector** — verify cited sources exist and actually say what is claimed, since models invent convincing references.
141869. **Source Quota Enforcer** — limit how many external sources a single task may query, since unbounded browsing enables data harvesting.
141870. **Retrieval History Privacy Check** — verify cache hits never reveal which documents other users retrieved, since hit patterns leak retrieval history.
141871. **Query-Rewrite Leakage Test** — check that query rewriters do not inject user PII into search strings, since expanded queries travel to third parties.
141872. **Vector Store ACL Audit** — confirm the retriever enforces per-document ACLs at query time, since post-filtering races leak denied chunks.
141873. **Ranking Manipulation Probe** — test whether crafted documents can force themselves into top-k results, since ranking control is injection by another name.
141874. **Reranker Bias Injection Test** — verify rerankers do not favor attacker-planted passages, since reranking overrides retrieval safety.
141875. **Chunk-Stitching Reconstruction Guard** — check that overlapping chunks cannot be stitched to rebuild redacted text, since overlap defeats redaction.
141876. **Metadata Exfiltration Check** — verify document metadata such as authors, paths, and timestamps is filtered like content, since metadata carries its own secrets.
141877. **Annotation-Prompt Integrity Audit** — confirm labeling prompts cannot be altered by annotators to bias labels, since labeling pipelines are soft targets.
141878. **Synthetic Data Leakage Review** — verify synthetic training data does not reproduce real records, since generators memorize their inputs.
141879. **Model Distillation Guard** — assess whether the API can be distilled to clone the model, since extraction steals the vendor's asset.
141880. **Watermark Robustness Evaluator** — test whether output watermarks survive paraphrasing, since weak watermarks cannot prove provenance.
141881. **Provenance Attestation Verifier** — verify signed attestations on model artifacts and datasets, since unsigned artifacts invite substitution.
141882. **Model Registry Audit** — check that downloaded models come from pinned, verified registries, since typosquatted models ship backdoors.
141883. **Prompt-Template Hardening Check** — verify shared prompt templates sanitize their variable slots, since templates are reused injection surfaces.
141884. **Few-Shot Poisoning Detector** — scan example sets for planted malicious demonstrations, since examples teach behavior more than instructions.
141885. **Persona Hijacking Resistance Test** — verify the model cannot be locked into a rogue persona by the user, since persona overrides bypass safety policies.
141886. **Emotional Manipulation Guard** — test that flattery, urgency, and distress do not weaken refusal behavior, since social engineering targets the model too.
141887. **Authority Impersonation Detector** — verify claims of admin or developer status are challenged, since fake authority is the oldest trick.
141888. **Hypothetical Framing Evasion Check** — test "what if" and fictional framings of disallowed requests, since hypotheticals launder intent.
141889. **Decomposition Evasion Probe** — verify that splitting a disallowed task into pieces is still caught, since decomposition hides the goal.
141890. **Encoding Obfuscation Screen** — detect base64, hex, and leetspeak hiding of disallowed content, since encodings dodge keyword filters.
141891. **Translation Pivot Attack Test** — verify safety holds when requests pass through intermediate languages, since translation resets guardrails.
141892. **Roleplay Boundary Enforcer** — test that in-character requests cannot authorize out-of-character actions, since roleplay is a policy escape hatch.
141893. **Tool-Inventory Disclosure Control** — verify the model does not narrate its tool inventory to untrusted parties, since tool lists map the attack surface.
141894. **Model Fingerprinting Guard** — check that error messages do not reveal the exact model version, since version disclosure targets known weaknesses.
141895. **Fallback-Model Routing Test** — verify fallback models do not skip the primary's safety filters, since routing downgrades policy.
141896. **Multi-Modal Consistency Auditor** — check that text, vision, and audio paths enforce the same policy, since the weakest modality wins.
141897. **Filter Timing Side-Channel Review** — verify filter latency does not reveal which rule fired, since timing tells attackers what was blocked.
141898. **Adversarial Suffix Detector** — scan inputs for gradient-crafted suffixes that flip model behavior, since suffixes are portable jailbreaks.
141899. **Context-Overflow Guard** — verify truncation cannot be abused to drop safety instructions, since overflow pushes guardrails out of context.
141900. **Instruction Position Sensitivity Test** — verify safety holds regardless of where instructions sit in the context, since position biases policy adherence.
141901. **Long-Context Smuggling Probe** — hide instructions deep inside long documents and test detection, since attention dilutes over distance.
141902. **Conversation Fork Poisoning Check** — verify branched conversations cannot inherit escalated privileges, since forks replay privileged turns.
141903. **Session Replay Attack Auditor** — confirm captured sessions cannot be replayed to re-execute authorized actions, since replayed approvals are forged consent.
141904. **LLM Security Scorecard Generator** — roll prompt-surface, tool-use, RAG, and output checks into one graded deployment report, since scattered checks never become decisions.
141905. **OTA Firmware Signature Verification Audit** — confirm each firmware image is verified against a pinned public key before flashing, since an unsigned update path lets an attacker push malicious firmware to every device in the fleet.
141906. **OTA Rollback Downgrade Protection Check** — verify the updater rejects images with version numbers below the installed one, since a forced downgrade re-opens already-patched vulnerabilities on the device.
141907. **Firmware Manifest Hash Binding Test** — check that the update manifest cryptographically binds image hashes to device model and hardware revision, since an unbound manifest allows cross-flashing the wrong firmware onto incompatible hardware.
141908. **Staged Rollout Kill-Switch Review** — verify the update pipeline can halt and revoke a partially deployed release, since a poisoned firmware caught mid-rollout without a kill switch bricks or compromises the remaining devices.
141909. **Delta Patch Integrity Chain Audit** — confirm delta patches chain hashes from the currently installed image through to the new image, since a broken chain lets tampered fragments assemble into untrusted firmware.
141910. **OTA Over Insecure Transport Detector** — flag update downloads served over plaintext HTTP or unverified TLS, since a network adversary can substitute the firmware image in transit.
141911. **Firmware Download Redirect Validation Check** — verify update URLs cannot be redirected to attacker-controlled hosts by a compromised manifest mirror, since unsigned redirect acceptance enables image substitution.
141912. **Secure-Boot Chain Continuity Test** — check that each boot stage verifies the next before execution, since a single unverified stage gives persistent malware a place to hide below the operating system.
141913. **Bootloader Unlock Policy Audit** — verify that debug and unlock interfaces require hardware-backed authorization tokens, since an always-unlockable bootloader turns any stolen device into a rooted test bench.
141914. **Anti-Rollback Fuse Enforcement Review** — confirm version counters are stored in tamper-resistant hardware fuses rather than rewritable flash, since software-only counters can be reset to permit downgrades.
141915. **Default Credential Inventory Sweep** — probe management interfaces for factory usernames and passwords still valid after setup, since unchanged defaults are the fastest path to fleet-wide compromise.
141916. **First-Boot Forced Credential Rotation Check** — verify the device requires the owner to set a unique admin password on first use, since a skipped rotation leaves every shipped unit sharing one known secret.
141917. **Hardcoded Service Account Discovery Test** — scan firmware strings for embedded maintenance accounts and backdoor usernames, since hidden accounts bypass every user-facing credential policy.
141918. **Credential Storage Encryption Audit** — confirm stored credentials use hardware-backed encryption with per-device keys, since a shared global key lets one extracted device decrypt secrets from all units.
141919. **Password Reset Flow Hijack Review** — test whether the device's local reset mechanism accepts unauthenticated requests, since a physical attacker with network access can otherwise seize ownership.
141920. **BLE Pairing Method Strength Audit** — verify pairing uses numeric comparison or passkey entry rather than Just Works, since Just Works pairing is vulnerable to silent man-in-the-middle interception.
141921. **Bluetooth Advertisement Data Leakage Check** — confirm BLE advertisements do not broadcast device identifiers, serial numbers, or owner names, since static identifiers enable long-term tracking of the device and its owner.
141922. **BLE GATT Unauthorized Access Test** — probe readable and writable characteristics without pairing to find exposed controls, since unprotected GATT endpoints let nearby attackers read sensors or trigger actions.
141923. **Pairing PIN Brute-Force Rate-Limit Review** — check that short PIN-based pairing locks out after repeated failures, since an unlimited PIN attempt rate makes six-digit pairing trivially breakable.
141924. **Device Re-Pairing Ownership Transfer Guard** — verify pairing a device to a new account first deauthorizes the previous owner, since a lingering old owner retains silent access after a sale or reset.
141925. **QR-Code Pairing Token Entropy Audit** — confirm setup tokens encoded in QR codes carry sufficient entropy and short expiry, since a guessable or everlasting token lets anyone claim the device during setup.
141926. **Companion-App Deep-Link Pairing Hijack Test** — check that app deep links carrying pairing tokens cannot be intercepted or replayed by another app, since a hijacked link transfers device ownership to the attacker.
141927. **Out-of-Band Pairing Channel Verification** — verify the pairing flow confirms the physical device through an independent channel like a button press or displayed code, since channel-less pairing can bind the app to an impostor device.
141928. **MQTT Broker Credential Policy Hardening Audit** — verify the broker enforces unique per-device credentials with rotation instead of shared or anonymous logins, since one extracted shared credential lets an attacker impersonate the entire fleet.
141929. **MQTT Topic ACL Segregation Audit** — verify each device can publish and subscribe only to its own topic namespace, since flat topic access lets one compromised device spy on or command every other device.
141930. **MQTT Retained-Message Poisoning Detector** — test whether retained messages can be overwritten by unauthorized publishers, since a poisoned retained message replays malicious state to every device that reconnects.
141931. **MQTT Last-Will Spoofing Guard** — check that last-will messages cannot be forged by a third party, since a fake will message triggers false offline alarms and automation cascades.
141932. **Broker Wildcard Subscription Abuse Test** — verify subscribers cannot use multi-level wildcards to siphon the whole topic tree, since wildcard access collapses per-device isolation on the broker.
141933. **MQTT Over TLS Enforcement Check** — confirm the broker rejects plaintext connections and validates client certificates where configured, since unencrypted MQTT exposes credentials and commands to network sniffing.
141934. **CoAP DTLS Handshake Hardening Review** — verify constrained devices negotiate DTLS with replay protection rather than falling back to plaintext CoAP, since unsecured CoAP leaks sensor data and accepts forged commands.
141935. **Hub-to-Cloud Mutual TLS Verification** — check that the hub presents a client certificate and validates the cloud server certificate, since one-sided TLS leaves the hub open to rogue-server command injection.
141936. **Cloud Command Replay Protection Audit** — verify hub-bound commands carry nonces or timestamps validated server-side, since replayable commands let an attacker re-trigger unlocks or disarms captured earlier.
141937. **Hub Local API Exposure Review** — probe the hub's LAN interface for unauthenticated management endpoints, since a compromised home network device can then pivot into full hub control.
141938. **Hub Firmware Decoupling Integrity Check** — confirm the hub validates the provenance of each connected device's firmware version report, since a lying device can claim it is patched while running vulnerable code.
141939. **Zigbee Network Key Rotation Policy Audit** — verify the coordinator rotates the network key on device join and supports trust-center rekeying, since a static key captured once decrypts all future Zigbee traffic.
141940. **Zigbee Touchlink Commissioning Abuse Test** — check that touchlink joining is disabled or proximity-gated after setup, since open touchlink lets an attacker at the window force-join a rogue controller.
141941. **Z-Wave S2 Downgrade Resistance Check** — confirm the hub refuses to fall back to insecure S0 inclusion when S2 is available, since a forced downgrade strips encryption from the pairing session.
141942. **UPnP SSDP Spoofing Exposure Review** — verify the device ignores SSDP responses from untrusted LAN sources, since forged discovery replies can redirect the device to attacker services.
141943. **mDNS Service Advertisement Hardening Test** — check that multicast advertisements expose only necessary service records, since verbose mDNS records fingerprint the device model and firmware for targeted attacks.
141944. **Telemetry Payload Minimization Audit** — verify uploaded telemetry contains only declared fields with no raw identifiers or precise location, since over-collection turns routine diagnostics into owner surveillance.
141945. **Telemetry Transport Encryption Check** — confirm telemetry leaves the device over encrypted channels with certificate validation, since plaintext telemetry leaks usage patterns to passive network observers.
141946. **Telemetry Consent Enforcement Test** — verify opt-out actually stops collection at the device rather than only hiding the dashboard, since fake consent controls violate privacy commitments.
141947. **Sensor Data Retention Limit Review** — check that cloud-stored telemetry honors the documented retention window and auto-purges, since indefinite retention magnifies the impact of any future breach.
141948. **Voice Assistant Wake-Word False-Trigger Audit** — verify the device does not stream audio to the cloud on ambiguous triggers, since over-eager streaming records conversations the owner never intended to send.
141949. **Camera Frame Local-Processing Verification** — confirm person detection and similar analytics run on-device with only event metadata uploaded, since raw frame uploads expose the owner's home to cloud storage risk.
141950. **Companion-App TLS Pinning Enforcement Audit** — verify the app pins the cloud API certificate and refuses user-installed CA interception, since missing pinning lets a malicious profile read the owner's device tokens.
141951. **Companion-App Token Storage Security Audit** — confirm OAuth and device tokens are stored in the OS keychain or keystore rather than plaintext preferences, since extractable tokens give full account control.
141952. **Companion-App Session Fixation Test** — check that login issues fresh tokens and invalidates pre-authentication session identifiers, since a fixed session lets an attacker ride the victim's login.
141953. **Device Sharing Invitation Scope Review** — verify shared-access invites grant only the selected permissions and expire as configured, since overbroad invites turn guests into full administrators.
141954. **Revoked Share Token Enforcement Check** — confirm that removing a shared user immediately invalidates their tokens on device and cloud, since lingering tokens let an ex-guest keep controlling the home.
141955. **Factory Reset Completeness Audit** — verify reset wipes credentials, tokens, paired accounts, and local logs from all storage partitions, since leftover secrets let the next owner or a reseller recover them.
141956. **Deprovisioning Cloud Unlink Verification** — confirm that removing a device from the account deletes its cloud shadow state and queued commands, since a stale shadow can resurrect control after the owner believes the device is gone.
141957. **Second-Hand Ownership Transfer Flow Test** — verify a new owner cannot be blocked or spied on by the previous owner's lingering registration, since incomplete transfer keeps the old owner in the loop.
141958. **Warranty RMA Data Sanitization Check** — confirm returned devices are wiped under a documented process before refurbishment, since RMA units carry the previous owner's Wi-Fi credentials and cloud tokens.
141959. **UART Debug Console Exposure Review** — check that production firmware disables or password-protects serial consoles, since an open UART gives a physical attacker a root shell in seconds.
141960. **JTAG Boundary-Scan Lockdown Audit** — verify debug fuses are blown or authenticated on shipped units, since live JTAG allows firmware extraction and runtime memory inspection.
141961. **Firmware Image Encryption Review** — confirm update images are encrypted in addition to being signed, since signed-but-readable firmware hands attackers the exact code to reverse engineer.
141962. **Hardcoded Cryptographic Key Hunt** — scan firmware for embedded AES keys, private keys, and API secrets, since one extracted key compromises every device sharing it.
141963. **Per-Device Key Provisioning Verification** — verify each unit receives unique keys at manufacturing with no shared fallback, since a fleet-wide key makes one device teardown a fleet-wide breach.
141964. **Certificate Expiry and Renewal Flow Test** — check that device certificates renew automatically before expiry with a working fallback, since expired certificates brick cloud connectivity or force insecure fallbacks.
141965. **Time Source Spoofing Resilience Check** — verify the device validates NTP responses and tolerates clock skew safely, since a shifted clock breaks certificate validation and scheduled security controls.
141966. **Power-Glitch Fault-Injection Hardening Review** — confirm secure-boot and key operations resist voltage glitching to the documented threat level, since fault injection can skip signature checks on unhardened hardware.
141967. **Side-Channel Emission Assessment** — verify cryptographic operations use constant-time code and noise countermeasures where feasible, since power and timing traces can leak keys from physically accessible devices.
141968. **Tamper-Evident Enclosure Signal Audit** — check that chassis-intrusion switches trigger key zeroization or alerts, since silent physical opening lets an attacker extract secrets at leisure.
141969. **Over-the-Air Consent Prompt Verification** — confirm updates require explicit owner approval or a configured auto-update policy, since silent forced updates erode trust and can push untested firmware.
141970. **Update Changelog Transparency Check** — verify each release ships a human-readable changelog with security fixes disclosed, since opaque updates hide whether known vulnerabilities were actually patched.
141971. **Beta Firmware Channel Isolation Audit** — confirm experimental builds are cryptographically segregated from the stable channel, since a beta image accepted by stable devices bypasses release-grade review.
141972. **Offline Update Media Validation Test** — verify USB or SD-card sideloaded updates pass the same signature checks as OTA, since local media is the easiest vector for malicious firmware.
141973. **Device Shadow State Desync Detector** — check that the cloud shadow and the physical device state reconcile with conflict resolution, since a desynced shadow lets stale commands act on a device whose real state changed.
141974. **Command Queue Poisoning Guard** — verify queued cloud-to-device commands are authenticated per recipient and expire, since an unauthenticated queue lets anyone inject delayed actions like unlocking doors.
141975. **Automation Rule Privilege Escalation Test** — check that user-created automation rules cannot trigger actions above the rule creator's permission level, since a guest's routine could otherwise disarm the alarm.
141976. **Geofence Trigger Spoofing Review** — verify location-based automations validate the device position cryptographically rather than trusting client reports, since spoofed geofences unlock doors remotely.
141977. **Firmware Bill-of-Materials Disclosure Check** — confirm the vendor publishes SBOM data for third-party components in the firmware, since hidden libraries delay patching of known CVEs in the supply chain.
141978. **Vulnerability Disclosure Contact Visibility Test** — verify the product and its app surface a clear security contact and reporting channel, since unreachable vendors leave researcher reports and owner incidents unanswered.
141979. **End-of-Life Update Policy Audit** — check that discontinued models receive a documented final security update and clear EOL notice, since abandoned devices stay online running exploitable firmware for years.
141980. **Companion-App Minimum Version Enforcement** — verify the cloud rejects API calls from app versions with known vulnerabilities, since outdated apps bypass server-side fixes the vendor already shipped.
141981. **Device API Rate-Limiting Review** — confirm the device and its cloud endpoints throttle command and telemetry requests per identity, since unlimited request rates enable credential stuffing and command flooding.
141982. **Log Redaction Before Upload Check** — verify diagnostic bundles strip credentials, tokens, and PII before leaving the device, since support uploads routinely leak secrets into vendor ticket systems.
141983. **Crash Report Privacy Scrubbing Audit** — confirm crash dumps are sanitized of memory contents that may hold keys or personal data, since raw dumps sent to the vendor expose whatever was in RAM.
141984. **Local Network Pairing Eavesdropper Test** — check that Wi-Fi credential provisioning during setup uses encrypted exchange, since plaintext provisioning lets a neighbor capture the owner's network password.
141985. **WPS and Easy-Setup Downgrade Guard** — verify the device does not fall back to PIN-based WPS when modern provisioning fails, since WPS PIN is brute-forceable in hours.
141986. **Guest Network Isolation Recommendation Check** — verify the setup flow advises or enforces placing IoT devices on a segmented network, since flat home networks let one compromised bulb reach the owner's laptop.
141987. **Port Exposure Minimization Audit** — scan the device for open TCP and UDP ports and flag any not required for its function, since each listening service is a remotely reachable attack surface.
141988. **Telnet and Legacy Service Disablement Test** — confirm telnet, FTP, and other legacy cleartext services are absent or disabled on production firmware, since they persist as low-hanging remote-access vectors.
141989. **SNMP Community String Hygiene Check** — verify default SNMP community strings are changed or SNMP is disabled, since public community strings expose device configuration to the LAN.
141990. **Web Management CSRF Protection Review** — test the device's local web UI for anti-CSRF tokens on state-changing actions, since a malicious page on the LAN can otherwise reconfigure the device through the owner's browser.
141991. **DNS Rebinding Guard on Local UI** — verify the device web interface rejects requests with mismatched Host headers, since DNS rebinding lets an external site drive the local management UI.
141992. **Captive-Portal Setup Phishing Resistance Test** — check that the setup access point uses a distinctive SSID pattern and the app validates the device identity, since an evil-twin AP can harvest the owner's Wi-Fi credentials.
141993. **OTA Update Notification Authenticity Check** — verify in-app update prompts are signed by the vendor backend and cannot be spoofed by a rogue local page, since fake update prompts are a classic credential-harvesting lure.
141994. **Child Safety and Camera Consent Audit** — verify cameras and microphones in shared spaces surface clear recording indicators and consent controls, since silent recording features create serious privacy exposure.
141995. **Pet and Elderly Monitoring Data Access Review** — check that monitoring feeds enforce the same authentication as admin functions, since monitoring streams are high-value targets for unauthorized viewers.
141996. **Smart Lock Audit-Trail Integrity Check** — verify lock and unlock events are append-only and tamper-evident, since an editable history lets an intruder erase evidence of entry.
141997. **Alarm Panel Duress Code Support Review** — check whether the system supports a duress PIN that silently alerts while appearing to disarm, since forced-disarm scenarios need a safe reporting path.
141998. **Emergency Override Authorization Test** — verify physical emergency overrides log the event and re-secure automatically, since an unlogged override becomes a permanent backdoor into the protected space.
141999. **Interoperability Protocol Fuzzing Harness** — build a fuzzer for the device's Matter, Zigbee, or proprietary protocol parser, since malformed frames are the fastest route to remote code execution on constrained stacks.
142000. **Firmware Fuzzing Corpus Seed Review** — verify the vendor or hunter maintains a seeded corpus for update-parser fuzzing, since untested parsers accept malformed images that crash or exploit the updater.
142001. **Supply-Chain Component Provenance Audit** — confirm critical chips and modules come from authorized distributors with verifiable provenance, since counterfeit components can ship with pre-installed backdoors.
142002. **Third-Party Skill and Integration Permission Review** — verify voice-assistant skills and cloud integrations request only minimum scopes, since overprivileged integrations expose every device to a compromised partner.
142003. **Data Portability Export Completeness Test** — check that the owner's data export includes all telemetry and account records in a usable format, since incomplete exports block migration and hide what the vendor collected.
142004. **Right-to-Erasure Device Wipe Verification** — verify an erasure request deletes cloud backups, telemetry archives, and device shadows within the promised window, since retained copies defeat the purpose of deletion.
