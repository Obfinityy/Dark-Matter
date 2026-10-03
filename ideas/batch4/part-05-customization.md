# Batch 4 — Part 05: Hunt customization & targeting (34005–35004)

34005. **Fintech endpoint wordlist auto-selector** — classifies the target as banking or finance and loads a wordlist of endpoints like /wire-transfer, /kyc-upload, and /ledger-export before fuzzing begins.
34006. **Healthcare FHIR path dictionary** — selects a wordlist of FHIR resource paths such as Patient, Observation, and Claim when the target is identified as a health-tech application.
34007. **E-commerce checkout path corpus** — loads cart, checkout, coupon, and order-tracking path guesses automatically for targets classified as online retail.
34008. **Government service portal wordlist** — applies a civic-services path set including /citizen-login, /grievance-status, and /certificate-download for public-sector targets.
34009. **EdTech LMS route lexicon** — switches to course, enrollment, assignment, and gradebook path guesses when the target is an education platform.
34010. **Travel booking endpoint set** — loads itinerary, fare-quote, seat-map, and refund path guesses for airline, hotel, and OTA targets.
34011. **Media CMS path collection** — selects article, paywall, syndication, and asset-manager path guesses for publishing and news targets.
34012. **Gaming leaderboard API wordlist** — applies matchmaking, leaderboard, inventory, and clan-management endpoint guesses for game backends.
34013. **SaaS admin route dictionary** — loads tenant-admin, billing-portal, and audit-log path guesses for B2B SaaS targets.
34014. **Logistics tracking endpoint list** — selects shipment, manifest, proof-of-delivery, and warehouse path guesses for supply-chain targets.
34015. **Real-estate listing path wordlist** — applies property, agent-dashboard, viewing-schedule, and offer path guesses for property platforms.
34016. **Insurance claim route set** — loads policy, claim-file, adjuster-note, and settlement path guesses for insurer targets.
34017. **Telecom self-care portal wordlist** — selects recharge, usage-history, sim-swap, and plan-change path guesses for carrier targets.
34018. **Energy utility dashboard paths** — applies meter-reading, outage-report, and tariff-plan guesses for utility customer portals.
34019. **Automotive telematics endpoint list** — loads vehicle-status, remote-lock, trip-history, and service-booking guesses for connected-car platforms.
34020. **Legaltech document route dictionary** — selects matter, e-signature, redaction, and court-filing path guesses for legal software targets.
34021. **HR applicant-tracking path list** — applies job-posting, candidate-pipeline, interview-slot, and offer-letter guesses for recruiting platforms.
34022. **Social network API surface wordlist** — loads feed, follow-graph, story, and moderation-queue endpoint guesses for social targets.
34023. **Dating app endpoint corpus** — selects match, swipe-history, super-like, and verification-badge guesses for dating platforms.
34024. **Food-delivery order route set** — applies menu-sync, courier-track, promo-stack, and refund-request guesses for delivery apps.
34025. **Crypto exchange path wordlist** — loads order-book, withdrawal-whitelist, staking, and futures-margin guesses for exchange targets.
34026. **DeFi protocol endpoint list** — selects pool-stats, liquidity-add, governance-vote, and bridge-status guesses for DeFi frontends.
34027. **Agritech sensor dashboard wordlist** — applies field-map, irrigation-schedule, and yield-report guesses for farm-management platforms.
34028. **Sports betting endpoint set** — loads odds-feed, bet-slip, cashout, and responsible-gambling-limit guesses for wagering targets.
34029. **Nonprofit donation flow paths** — selects campaign, donor-receipt, recurring-gift, and fundraiser-page guesses for charity platforms.
34030. **Marketplace seller route list** — applies seller-onboarding, inventory-bulk-upload, payout-schedule, and dispute-center guesses for marketplace targets.
34031. **B2B procurement portal wordlist** — loads RFQ, vendor-scorecard, purchase-order, and invoice-match guesses for procurement platforms.
34032. **Wordlist hit-rate analytics per industry** — tracks which entries in each industry pack historically produced hits and surfaces the top performers.
34033. **Community-curated industry packs** — lets researchers publish, subscribe to, and rate industry wordlist packs maintained by the community.
34034. **Wordlist versioning with changelogs** — versions every built-in and custom pack so hunts can pin a specific wordlist release for reproducibility.
34035. **Auto-classifier confidence threshold tuner** — lets the researcher set the minimum industry-classification confidence before a specialized pack is auto-applied.
34036. **Multi-industry hybrid wordlist merger** — merges two or more industry packs with deduplication when a target spans sectors, such as fintech plus e-commerce.
34037. **Industry wordlist mutator engine** — applies prefix, suffix, and case-mutation rules tuned per industry, like -v2, -api, and -internal variants.
34038. **Parameter-name wordlist per industry** — swaps generic parameter guesses for sector terms, such as account_number in banking versus patient_id in healthcare.
34039. **Subdomain wordlist per industry** — uses sector-typical subdomain guesses like trading, claims, or admissions instead of a generic list.
34040. **File-extension bias per industry** — prioritizes extensions common to the sector, such as .pdf in legaltech or .csv in fintech exports.
34041. **Admin panel path guesses per industry** — loads sector-specific admin guesses like /underwriter-desk for insurance or /registrar for education.
34042. **Backup filename guesses per industry** — tries sector-flavored backup names such as ledger-backup.sql or roster-backup.zip.
34043. **API version path patterns per industry** — enumerates versioned route styles favored by the sector, including /v1, /api/v2, and date-versioned paths.
34044. **Webhook endpoint guesses per industry** — probes sector webhooks like /stripe-webhook, /kyc-callback, or /shipment-update based on classification.
34045. **Export and download endpoint guesses per industry** — targets statement-export, report-download, and data-dump routes typical of the sector.
34046. **Report endpoint guesses per industry** — enumerates MIS, compliance, and analytics report routes common in the target's vertical.
34047. **Search endpoint parameter guesses per industry** — fuzzes sector search fields like policy_number, sku, or case_id instead of generic q.
34048. **Pagination parameter guesses per industry** — tries sector API pagination styles such as cursor, page_token, or offset variants observed in the wild.
34049. **Filter and sort parameter guesses per industry** — probes sort_by, filter_status, and date_range parameters named the way the industry's APIs name them.
34050. **Industry-specific GraphQL field wordlist** — loads likely GraphQL fields per sector, such as balance and transactions for fintech.
34051. **Industry-specific header guesses** — tries headers like X-Bank-Token or X-Claim-Session that sector applications commonly require.
34052. **Industry-specific cookie name guesses** — guesses session cookie names patterned after sector conventions during session analysis.
34053. **Industry error-page fingerprint wordlist** — matches localized and sector-typical error strings to identify the underlying platform faster.
34054. **Competitor-site crawl wordlist builder** — crawls a same-industry competitor the researcher names and harvests its path vocabulary into a custom pack.
34055. **Past-hunt learning wordlist** — promotes paths that produced findings in the researcher's previous same-industry hunts to the front of the pack.
34056. **Regulatory endpoint wordlist** — probes compliance routes like /gdpr-export, /ccpa-delete, and /data-retention-policy on every hunt.
34057. **Onboarding flow path wordlist per industry** — enumerates signup, verification, and first-run routes shaped by sector onboarding norms.
34058. **KYC identity-verification path wordlist** — targets document-upload, liveness-check, and verification-status routes for regulated targets.
34059. **Payment-method path wordlist** — probes card-add, bank-link, wallet-bind, and payout-method routes on commerce and fintech targets.
34060. **Subscription and billing path wordlist** — enumerates plan-change, invoice-history, dunning, and cancellation routes for subscription businesses.
34061. **Notification-preference path wordlist** — targets alert-settings, channel-preferences, and digest routes across industries.
34062. **Audit-log path wordlist** — probes activity-log, access-history, and audit-export routes where sector apps expose them.
34063. **Support-ticket path wordlist** — enumerates helpdesk, ticket-status, and escalation routes for service-heavy industries.
34064. **Knowledge-base path wordlist** — targets docs, faq, and article routes that often leak internal paths.
34065. **Status-page path wordlist** — probes /status, /health, and /uptime routes that reveal infrastructure details.
34066. **Developer-docs path wordlist** — enumerates /developers, /api-docs, and /reference routes that document hidden endpoints.
34067. **Sandbox and test-environment path guesses** — tries /sandbox, /playground, and /demo routes that may expose test data.
34068. **Staging subdomain guesses per industry** — uses sector-flavored staging names like staging-trading or qa-claims during enumeration.
34069. **Legacy path guesses per industry** — probes /old-portal, /classic, and /v1-legacy routes common in long-lived sector apps.
34070. **Mobile API path guesses per industry** — enumerates /mapi, /mobile/v1, and /app-api routes used by sector mobile clients.
34071. **Partner and affiliate path guesses per industry** — targets /partners, /affiliates, and /reseller routes with weaker access controls.
34072. **White-label path guesses per industry** — probes white-label tenant routes that often share a single backend with inconsistent authorization.
34073. **Multi-tenant path guesses per industry** — enumerates tenant-scoped routes to test cross-tenant isolation per sector patterns.
34074. **Wordlist deduplication across packs** — removes overlapping entries when multiple packs are combined so no request is wasted.
34075. **Wordlist size estimator before hunt** — shows the projected request count for the selected packs so the researcher can trim before launching.
34076. **Wordlist shuffle and randomization mode** — randomizes pack order to avoid predictable scan signatures on monitored targets.
34077. **Wordlist priority ordering by hit rate** — sorts entries by historical success so high-probability paths are tested first.
34078. **Custom wordlist upload** — accepts researcher-supplied TXT or CSV wordlists and validates their format on import.
34079. **Wordlist editor with inline preview** — provides an in-app editor that previews how entries expand with active mutation rules.
34080. **Wordlist sharing via link** — generates a shareable link for a custom pack with optional expiry and access control.
34081. **Wordlist fork from built-in pack** — clones a built-in industry pack into an editable personal copy without touching the original.
34082. **Wordlist merge conflict resolver** — offers a side-by-side resolver when an updated built-in pack collides with personal edits.
34083. **Wordlist A/B testing across hunts** — runs two pack variants on comparable targets and reports which produced more findings per request.
34084. **Industry wordlist for WebSocket endpoints** — enumerates /ws, /socket.io, and /realtime paths with sector-typical channel names.
34085. **Industry wordlist for SSE and stream endpoints** — probes /events, /stream, and /feed routes used for live sector updates.
34086. **Industry wordlist for gRPC service names** — guesses service and method names patterned after sector protobuf conventions.
34087. **Industry wordlist for GraphQL operations** — enumerates likely query and mutation names per sector vocabulary.
34088. **Industry-specific IDOR parameter guesses** — tries identifiers like policy_number, prescription_id, or enrollment_id based on classification.
34089. **Industry-specific mass-assignment field guesses** — probes settable fields like is_verified or credit_limit named per sector conventions.
34090. **Industry-specific SSRF target guesses** — suggests internal hostnames like ledger-internal or pacs-archive when testing server-side request forgery.
34091. **Industry-specific open-redirect parameter guesses** — tries parameters like next_claim or return_shipment that sector apps use for post-action navigation.
34092. **Industry-specific file-upload extension guesses** — prioritizes upload types the sector accepts, such as .hl7 in healthcare or .mt940 in banking.
34093. **Industry-specific template-injection context guesses** — selects template contexts like invoice rendering or certificate generation for SSTI probing.
34094. **Wordlist freshness checker** — flags packs that have not been updated in a configurable period and suggests a refresh.
34095. **Auto-update of built-in packs from feed** — pulls signed pack updates from the maintained feed with a changelog preview before applying.
34096. **Wordlist contribution workflow** — lets researchers submit new entries with evidence, routed through review before merging into built-ins.
34097. **Wordlist licensing and attribution tracker** — records the source and license of every pack so redistributed lists stay compliant.
34098. **Per-hunt wordlist override picker** — lets the researcher swap or supplement the auto-selected packs on the hunt launch screen.
34099. **Wordlist preview diff between industries** — shows a side-by-side diff of which entries change when switching the industry classification.
34100. **Industry classifier training-data viewer** — displays the signals and sample targets behind a classification so researchers can audit or correct it.
34101. **Manual industry override dropdown** — allows forcing a specific industry pack when auto-classification is wrong or the target is deliberately disguised.
34102. **Wordlist generation from target sitemap** — parses the target's own sitemap.xml into a seed pack tailored to its actual URL vocabulary.
34103. **Wordlist generation from JS bundles** — extracts route strings, API paths, and parameter names from the target's JavaScript into a custom pack.
34104. **Scheduled wordlist pack review** — reminds pack maintainers to re-validate industry packs quarterly against fresh target samples.
34105. **PHP-oriented probe profile** — prioritizes php:// wrappers, filter chains, and loose-comparison tricks when the stack fingerprint indicates PHP.
34106. **Node.js prototype-pollution payload pack** — leads with __proto__, constructor, and prototype payloads tuned for Express, Fastify, and NestJS targets.
34107. **Python Jinja2 SSTI pack** — loads template-injection payloads crafted for Jinja2, Mako, and Tornado rendering contexts on Python targets.
34108. **Ruby ERB SSTI pack** — selects Embedded Ruby code-execution probes for Rails and Sinatra applications.
34109. **Java Spring EL injection pack** — prioritizes Spring Expression Language and Thymeleaf SSTI payloads on Spring Boot targets.
34110. **.NET Razor SSTI pack** — loads Razor and ASPX template-injection probes when ASP.NET is detected.
34111. **Go template injection pack** — targets text/template and html/template injection vectors on Go services.
34112. **Rust Tera template pack** — probes Tera and Askama template contexts on Rust web targets.
34113. **Elixir EEx injection pack** — selects Embedded Elixir evaluation probes for Phoenix applications.
34114. **WordPress plugin-probe pack** — loads REST API abuse, plugin-enumeration, and wp-config disclosure probes for WordPress targets.
34115. **Laravel-specific payload set** — prioritizes Blade SSTI, mass-assignment, and .env disclosure probes on Laravel apps.
34116. **Django-specific payload set** — loads Django template injection, ORM-injection, and DEBUG-mode probes for Django targets.
34117. **Flask-specific payload set** — selects Jinja2 SSTI and Werkzeug debugger PIN probes for Flask apps.
34118. **FastAPI-specific payload set** — probes OpenAPI doc exposure, Pydantic validation quirks, and dependency-injection bypasses.
34119. **Express-specific payload set** — targets query-parser prototype pollution and middleware-ordering flaws on Express apps.
34120. **NestJS-specific payload set** — probes decorator-driven validation gaps and guard-bypass vectors in NestJS APIs.
34121. **Rails-specific payload set** — loads strong-parameter bypasses, ActiveRecord injection, and secret-token probes for Rails.
34122. **Spring Boot actuator probe pack** — enumerates /actuator endpoints and tests heapdump, env, and restart exposure.
34123. **ASP.NET-specific pack** — probes ViewState deserialization, padding-oracle vectors, and trace.axd exposure.
34124. **Next.js-specific pack** — targets draft-mode, image-optimizer SSRF, and middleware-bypass vectors in Next.js apps.
34125. **Nuxt-specific pack** — probes Nuxt server-route injection and payload-extraction endpoints.
34126. **GraphQL introspection payload set** — leads with introspection, field-suggestion, and batching-abuse probes on GraphQL endpoints.
34127. **REST mass-assignment pack** — fuzzes extra JSON fields per framework binding behavior to detect mass-assignment.
34128. **gRPC reflection probe pack** — enables server reflection enumeration and method-level authorization tests.
34129. **SOAP XXE-oriented pack** — loads XML external-entity payloads tuned to the detected SOAP parser.
34130. **Serverless event-injection pack** — probes Lambda-style event-shape confusion and environment-variable exfiltration vectors.
34131. **Cloudflare Workers runtime pack** — targets Workers-specific globals, KV leakage, and route-handler quirks.
34132. **Stack fingerprint confidence meter** — displays how certain the stack detection is and which signals produced it.
34133. **Multi-stack fallback payload ordering** — gracefully degrades to generic payloads when stack confidence is low, ordered by likelihood.
34134. **Payload pack versioning** — versions every stack pack so hunts can pin the exact payload set used for reproducibility.
34135. **Payload pack diff viewer** — shows what changed between pack versions before the researcher accepts an update.
34136. **Custom payload pack builder** — lets researchers compose their own stack-tuned packs from a payload library.
34137. **Payload pack import and export** — moves packs between installations as signed JSON bundles.
34138. **Payload effectiveness telemetry per stack** — records hit rates per payload per detected stack to continuously re-rank packs.
34139. **Auto-disable irrelevant payload families** — skips PHP deserialization probes on a confirmed Node.js target to save requests.
34140. **PHP filter-chain payload subset** — loads php://filter conversion-chain RCE probes only on confirmed PHP targets.
34141. **Node.js child_process RCE probes** — targets command-execution sinks reachable through Node-specific injection points.
34142. **Python pickle deserialization probes** — sends crafted pickle payloads to endpoints that accept serialized Python objects.
34143. **Java deserialization gadget subset** — loads gadget chains matched to the libraries fingerprinted on the target.
34144. **.NET ViewState MAC-bypass probes** — tests ViewState tampering only when ASP.NET ViewState is actually observed.
34145. **Ruby YAML deserialization probes** — targets Psych/YAML load sinks in Rails-adjacent endpoints.
34146. **PHP object-injection pop-chain pack** — loads property-oriented-programming chains for common PHP frameworks.
34147. **WordPress REST API abuse pack** — probes wp-json user enumeration, post manipulation, and route authorization gaps.
34148. **Drupal-specific pack** — targets Drupalgeddon-class vectors and RESTful Web Services misconfigurations.
34149. **Joomla-specific pack** — probes Joomla extension and session-handling flaws by detected version.
34150. **Magento and Adobe Commerce pack** — targets admin token, checkout, and API misconfigurations on commerce installs.
34151. **Shopify-specific pack** — probes app-proxy, storefront API, and webhook-verification gaps on Shopify stores.
34152. **Strapi-specific pack** — targets Strapi admin, plugin, and permission misconfigurations by version.
34153. **Ghost CMS pack** — probes Ghost members, admin API, and theme-upload vectors.
34154. **Payload encoding matched to stack** — auto-selects UTF-7 for legacy .NET or overlong UTF-8 for older Java containers.
34155. **WAF-evasion variants per stack** — pairs each payload with bypass variants tuned to the WAF commonly fronting that stack.
34156. **Time-based blind payloads tuned per DB** — picks SLEEP, pg_sleep, or WAITFOR DELAY based on the fingerprinted database.
34157. **Error-based payloads per DB engine** — selects extractvalue, cast-error, or convert-error techniques matching the DB.
34158. **Boolean-blind payloads per DB** — orders boolean inference payloads by the comparison semantics of the detected database.
34159. **Stack-specific SSRF cloud-metadata targets** — probes 169.254.169.254 plus provider-specific metadata paths matching the hosting stack.
34160. **Stack-specific path traversal prefixes** — orders ../, ..\\, and wrapper prefixes by OS and framework likelihood.
34161. **Stack-specific LFI wrappers** — tries php://, file://, and framework resource loaders according to the stack.
34162. **Stack-specific log-poisoning vectors** — targets the log locations and formats the detected server actually writes.
34163. **Header-injection payloads per server** — tunes CRLF and header-splitting probes for nginx, Apache, IIS, or Caddy behavior.
34164. **HTTP request-smuggling variants per server** — selects CL.TE and TE.CL permutations matched to the front-end/back-end pair.
34165. **Cache-poisoning payloads per CDN** — crafts cache-key manipulation probes for the detected CDN's normalization rules.
34166. **CRLF payloads per framework** — adapts line-break injection to how each framework joins headers and redirects.
34167. **Open-redirect payloads per framework routing** — uses framework-specific redirect helpers and their known bypasses.
34168. **JWT algorithm-confusion per library** — targets none-alg and RSA-to-HMAC confusion only for the JWT library in use.
34169. **OAuth flow-abuse per provider** — loads provider-specific redirect_uri and state-handling bypasses.
34170. **SAML payload pack** — probes signature-wrapping and assertion-confusion vectors on SAML endpoints.
34171. **XML parser-specific XXE pack** — tunes entity-expansion payloads to libxml2, Xerces, or .NET parser behaviors.
34172. **NoSQL injection per database** — selects MongoDB operator, Redis, or CouchDB payloads by detected store.
34173. **LDAP injection pack** — probes directory-search filters on login and lookup endpoints backed by LDAP.
34174. **XPath injection pack** — targets XML-query construction flaws in search and auth flows.
34175. **CSV formula injection pack** — tests export endpoints for spreadsheet-formula injection in downloadable reports.
34176. **Markdown XSS per renderer** — tunes payloads to marked, markdown-it, or other detected renderers.
34177. **PDF generation XSS per library** — probes wkhtmltopdf, Puppeteer, and WeasyPrint rendering contexts.
34178. **Email header injection per MTA hint** — adapts header-injection probes to the mail transfer agent suggested by banners.
34179. **OTP abuse pack per flow** — tests OTP brute-force, replay, and channel-confusion vectors in the target's verification flow.
34180. **Rate-limit bypass per stack behavior** — applies header-spoofing and parameter-pollution bypasses matched to the limiter's implementation.
34181. **Session fixation per framework** — tests session-adoption flaws using the framework's session-cookie mechanics.
34182. **Cookie-tossing per framework** — probes subdomain cookie-injection against the framework's cookie-parsing order.
34183. **CORS misconfiguration probes per framework defaults** — tests the CORS defaults each framework ships with.
34184. **Host-header poisoning per server** — adapts cache-poisoning and reset-link probes to virtual-host handling.
34185. **Web cache deception per framework routes** — targets static-file path confusion in framework routing tables.
34186. **HTTP method override per framework** — tests _method and X-HTTP-Method-Override handling where frameworks honor it.
34187. **Content-type confusion per parser** — probes JSON/XML/form parser disagreements in the detected stack.
34188. **Charset mismatch XSS per stack** — exploits declared-versus-actual encoding gaps in framework responses.
34189. **DOM XSS sinks per frontend framework** — scans for React dangerouslySetInnerHTML, Vue v-html, and Angular bypassSecurityTrust patterns.
34190. **Client-side prototype pollution per library** — probes jQuery, lodash, and framework-specific gadget sources.
34191. **PostMessage handler probes** — tests message-event listeners for origin-validation flaws in embedded widgets.
34192. **Service worker hijack probes** — checks service-worker registration scope for takeover-able paths.
34193. **Payload pack staged rollout** — releases updated packs to a subset of hunts first and promotes on clean telemetry.
34194. **Payload pack dry-run preview** — shows exactly which payloads would fire against the fingerprinted stack before launch.
34195. **Payload pack rollback** — reverts to the previous pack version in one click if a new pack underperforms.
34196. **Community payload pack ratings** — surfaces researcher ratings and hit-rate stats for community-contributed packs.
34197. **Payload pack maintainer attribution** — credits pack authors and links their profiles for accountability.
34198. **Stack detection from response headers** — fingerprints frameworks from Server, X-Powered-By, and bespoke headers.
34199. **Stack detection from error pages** — matches stack-specific error templates in 404 and 500 responses.
34200. **Stack detection from JS bundle analysis** — identifies frameworks and versions from bundle strings and source maps.
34201. **Stack detection from cookie names** — maps session-cookie naming conventions to frameworks.
34202. **Stack detection from URL patterns** — infers routing conventions like .aspx, /wp-json/, or .php extensions.
34203. **Manual stack override with payload preview** — lets the researcher force a stack and instantly preview the resulting payload set.
34204. **Payload pack compliance notes** — attaches safe-mode variants and scope warnings to intrusive payload families.
34205. **Scope engine hard-block** — kills any request whose host, IP, or path falls outside the parsed scope, even mid-hunt.
34206. **Pivot-discovered host quarantine** — holds newly discovered hosts in quarantine until the scope engine confirms they are in scope.
34207. **Subdomain scope auto-expansion rules** — expands *.example.com automatically only when the program explicitly includes wildcards.
34208. **Wildcard scope resolver** — interprets program wildcard phrasing into exact matching rules with edge cases documented.
34209. **IP range scope validator** — checks every probed IP against the program's CIDR list before any packet is sent.
34210. **CIDR boundary enforcer** — blocks requests to adjacent addresses that fall one host outside the listed range.
34211. **ASN scope limiter** — restricts infrastructure scanning to the autonomous system numbers named in the program.
34212. **Out-of-scope DNS hit alarm** — raises an immediate alert when enumeration resolves a host outside the scope definition.
34213. **Scope change mid-hunt approval flow** — pauses the hunt and requires researcher approval when the program updates its scope.
34214. **Program scope version tracker** — snapshots the scope at hunt start and records every subsequent program-side change.
34215. **Scope diff viewer (customization context)** — shows added and removed assets between scope versions with effective dates.
34216. **Auto-pause on scope violation** — halts the hunt the moment a check attempts an out-of-scope request.
34217. **Scope violation audit log** — records every blocked request with timestamp, check name, and the rule that blocked it.
34218. **Researcher scope attestation prompt** — asks the researcher to confirm they read the scope before the first request fires.
34219. **Scope import from program URL** — fetches the program's policy page and converts its scope section into enforceable rules.
34220. **Scope import from platform API** — pulls structured scope directly from the bounty platform's API when connected.
34221. **Scope regex tester** — lets researchers test whether a hostname or URL matches the compiled scope rules before hunting.
34222. **Scope test harness** — answers "is target X in scope?" with the exact rule that matched or missed.
34223. **Exclusion list manager** — maintains per-hunt exclusion entries with reasons, expiry, and who added them.
34224. **Inclusion list manager** — maintains explicit allowlists for assets the program added by exception.
34225. **Do-not-test window scheduler** — blocks all requests during program-declared maintenance or blackout windows.
34226. **Rate-limit scope per host** — applies per-host request budgets derived from program rules and past 429 responses.
34227. **Credential scope definition** — declares which test accounts are authorized and blocks the use of any others.
34228. **Data classification scope** — encodes PII handling rules so the hunt avoids exfiltrating real user data during testing.
34229. **Third-party service exclusion detector** — identifies embedded third-party hosts in page loads and excludes them automatically.
34230. **CDN edge node scope normalizer** — treats CDN edge IPs as the origin's scope rather than flagging them as new assets.
34231. **Redirect-chain scope validator** — re-validates every hop in a redirect chain against scope before following it.
34232. **CNAME-follow scope guard** — checks the final CNAME target against scope before resolving through it.
34233. **Acquired-domain scope expiry** — removes domains the program no longer owns, detected via registration changes.
34234. **Staging versus production scope splitter** — keeps staging-only findings tagged separately when both environments are in scope.
34235. **Mobile app scope with bundle IDs** — ties API testing scope to the program's listed Android package and iOS bundle identifiers.
34236. **API scope with base URLs** — restricts API testing to the declared base URLs and version prefixes.
34237. **Source-review repo scope** — limits code-review checks to the GitHub repositories the program explicitly lists.
34238. **Scope-aware crawler boundary** — stops the crawler from following links that leave the scope definition.
34239. **Scope-aware fuzzer boundary** — constrains every fuzzing payload to in-scope hosts and paths.
34240. **Scope-aware port scanner limiter** — caps port scanning to in-scope IPs with program-approved port lists.
34241. **Scope-aware subdomain enumerator cap** — bounds brute-force enumeration depth by program rules.
34242. **Scope-aware screenshot capture** — captures evidence screenshots only for in-scope pages.
34243. **Scope evidence redaction for out-of-scope** — automatically redacts any accidentally captured out-of-scope data from evidence.
34244. **Scope compliance report generator** — produces a per-hunt report proving every request stayed within scope.
34245. **Multi-program scope switcher** — swaps the active scope rule set when the researcher moves between programs.
34246. **Scope conflict detector for overlapping programs** — warns when two programs claim the same asset with different rules.
34247. **Scope priority resolver** — picks the stricter rule set when program scopes overlap on an asset.
34248. **Temporary scope grant workflow** — requests and tracks time-limited permission for a specific asset.
34249. **Scope grant expiry timer** — counts down temporary grants and hard-blocks when they lapse.
34250. **Scope reminder nudges** — surfaces scope summaries at configurable intervals during long hunts.
34251. **Scope onboarding checklist** — walks new researchers through reading and acknowledging program scope.
34252. **Program-specific scope quiz** — tests researcher understanding of tricky scope clauses before the hunt starts.
34253. **Scope violation auto-report to program** — drafts a disclosure note if the hunt accidentally touched out-of-scope assets.
34254. **Safe-harbor clause extractor** — surfaces the program's legal safe-harbor text alongside the scope summary.
34255. **Scope gray-area flagger** — highlights assets the rules do not clearly include or exclude for human review.
34256. **Researcher-defined custom scope notes** — attaches personal annotations to scope entries for future hunts.
34257. **Scope map visualizer** — renders in-scope domains, IPs, and apps as an interactive graph.
34258. **Scope coverage heatmap (customization context)** — shows which in-scope assets received testing and which remain untouched.
34259. **Untested in-scope asset reminder** — nudges the researcher about in-scope assets the hunt has not yet covered.
34260. **Scope creep detector (customization context)** — flags gradual expansion of tested hosts beyond the original scope snapshot.
34261. **DNS scope drift monitor** — watches for DNS changes that move in-scope hosts to new infrastructure.
34262. **New subdomain scope auto-check** — evaluates newly discovered subdomains against scope rules in real time.
34263. **Acquired asset scope re-validator** — re-checks ownership signals for assets added through acquisitions.
34264. **Decommissioned asset scope pruner** — drops assets that stop resolving or return sunset banners.
34265. **Scope-aware scheduling by business hours** — restricts intrusive checks to the program's declared testing hours.
34266. **Scope-aware aggressiveness cap** — lowers concurrency and payload intensity to the program's declared limits.
34267. **Scope-aware payload intensity** — selects safe versus intrusive payload variants based on scope permissions.
34268. **Scope per-check allowlist** — enables only the check families the program permits for each asset class.
34269. **Per-host scope notes** — attaches researcher notes and caveats to individual scoped hosts.
34270. **Scope templates per program type** — ships starter scope rule sets for public, private, and VDP-style programs.
34271. **Scope inheritance for child hunts** — passes the validated scope into follow-up or retest hunts automatically.
34272. **Scope snapshot before hunt** — freezes the scope definition at launch for later compliance proof.
34273. **Scope snapshot diff after hunt** — compares end-of-hunt scope against the launch snapshot.
34274. **Scope export to PDF and JSON** — exports the compiled scope rules for records and integrations.
34275. **Scope API for CI integration** — exposes scope evaluation as an endpoint for pipeline-driven hunts.
34276. **Scope webhook on change** — notifies connected systems the moment program scope changes.
34277. **Scope change notification** — alerts the researcher in-app and by email when scope updates arrive.
34278. **Scope history timeline** — renders every scope change as a chronological, auditable timeline.
34279. **Scope approver role** — designates who on a team can approve scope changes for shared hunts.
34280. **Dual-control scope changes** — requires two team members to confirm any scope expansion.
34281. **Scope testing sandbox** — validates new scope rules against sample hosts before they go live.
34282. **Scope rule simulator** — previews which discovered assets a proposed rule change would include or exclude.
34283. **Scope what-if analyzer** — models the coverage impact of adding or removing an asset class.
34284. **Out-of-scope honeypot detector** — warns when a probed host exhibits honeypot traits suggesting a scope trap.
34285. **Scope-aware deduplication** — suppresses duplicate findings only within the same scope context.
34286. **Scope-aware report routing** — routes findings to the correct program when scopes overlap.
34287. **Scope plain-English to rules parser** — converts researcher-written scope notes into enforceable matching rules.
34288. **Scope ambiguity highlighter** — marks vague program phrasing like "main properties" for clarification.
34289. **Scope FAQ generator per program** — builds a scope Q&A from the parsed policy for quick reference.
34290. **Scope cheat-sheet per hunt** — pins a one-page scope summary to the hunt dashboard.
34291. **Scope widget in hunt dashboard** — shows live scope status, coverage, and violations in a compact widget.
34292. **Scope status indicator** — displays green, yellow, or red based on violations, gray areas, and drift.
34293. **Scope countdown for time-boxed grants** — shows remaining time on temporary testing permissions.
34294. **Scope renewal reminder** — notifies the researcher before a time-boxed grant expires.
34295. **Scope revocation handler** — immediately halts affected checks when a grant is revoked mid-hunt.
34296. **Emergency scope stop button** — one-click halt of all hunt traffic with a scope-incident log entry.
34297. **Scope incident postmortem template** — generates a structured write-up for any scope violation event.
34298. **Scope training module links** — links program-specific scope training next to the scope summary.
34299. **Scope compliance score** — grades each hunt on scope adherence for researcher self-review.
34300. **Scope-aware leaderboard fairness** — normalizes credit so researchers on narrow scopes are not penalized.
34301. **Scope exception request form** — drafts a permission request to the program for a gray-area asset.
34302. **Scope exception approval chain** — tracks the request from draft through program approval.
34303. **Scope exception audit trail** — logs every exception request, decision, and expiry permanently.
34304. **Scope analytics dashboard** — aggregates scope sizes, violation rates, and gray-area frequency across programs.
34305. **NLP policy page reader** — parses a program's policy page into structured data covering scope, rules, and payouts.
34306. **Scope clause extractor** — isolates the in-scope and out-of-scope sections from free-form policy text.
34307. **Out-of-scope clause extractor** — compiles every explicit exclusion into a machine-readable blocklist.
34308. **Safe-harbor clause extractor (citable legal panel)** — pulls the legal safe-harbor language into a dedicated, citable panel.
34309. **Bounty table parser** — converts payout tables into structured severity-to-reward mappings.
34310. **Severity-to-payout mapper** — links each severity grade to its minimum and maximum reward from the parsed table.
34311. **Duplicate policy extractor** — captures how the program defines and handles duplicate submissions.
34312. **Disclosure policy extractor** — records coordinated-disclosure timelines and publication rules.
34313. **Response SLA extractor** — pulls promised triage and response timeframes into trackable commitments.
34314. **Eligibility rule extractor** — identifies who may participate, including employee, residency, and age restrictions.
34315. **Prohibited technique list extractor** — compiles banned testing methods like DoS or social engineering into hunt guardrails.
34316. **Testing window extractor** — captures allowed testing hours, days, and blackout periods as scheduling rules.
34317. **Credential provision parser** — extracts how test accounts are issued and any usage constraints attached.
34318. **Asset list parser** — converts asset tables and bullet lists into structured scope entries.
34319. **Wildcard interpreter** — translates wildcard phrasing into exact subdomain-matching semantics.
34320. **Do-not rule compiler** — turns every "do not" sentence into an enforceable hunt constraint.
34321. **Rule conflict detector within policy** — flags contradictions, such as an asset listed as both in and out of scope.
34322. **Policy change detector** — monitors the policy page and alerts when wording changes.
34323. **Policy version archiver** — stores timestamped snapshots of every observed policy revision.
34324. **Policy diff alerter** — highlights exactly which clauses changed between policy versions.
34325. **Multi-language policy parser** — parses program policies written in non-English languages with translation support.
34326. **PDF policy parser** — extracts rules from policy PDFs attached to program pages.
34327. **Policy Q&A chatbot** — answers researcher questions like "is subdomain X in scope?" from the parsed policy.
34328. **Rule severity classifier** — distinguishes hard prohibitions from soft guidelines in policy language.
34329. **Rule machine-enforceability scorer** — grades each parsed rule on whether the hunt engine can enforce it automatically.
34330. **Auto-generated scope rules from policy** — compiles parsed clauses directly into the scope engine's rule format.
34331. **Auto-generated test-plan constraints** — converts parsed rules into check allowlists, rate limits, and time windows.
34332. **Policy-to-checklist converter** — builds a pre-hunt compliance checklist from the parsed requirements.
34333. **Researcher acknowledgment tracker** — records which policy version each researcher confirmed before hunting.
34334. **Policy quiz generator** — creates comprehension questions from tricky clauses to verify researchers understood them.
34335. **Ambiguous clause flagger** — marks vague phrasing for human clarification before the hunt begins.
34336. **Missing safe-harbor warner** — warns when a program policy contains no safe-harbor language at all.
34337. **Payout range normalizer** — converts all bounty figures to a common currency for comparison.
34338. **Currency converter for bounties** — applies current exchange rates to normalize multi-currency payout tables.
34339. **Bonus clause extractor** — captures bonus multipliers for chains, critical assets, or exceptional write-ups.
34340. **Live-hacking-event scope parser** — extracts temporary event-specific scope and rules from event announcements.
34341. **NDA clause detector** — flags non-disclosure requirements that restrict what researchers may publish.
34342. **Data handling rule extractor** — captures rules about storing, transmitting, and deleting test data.
34343. **PII minimization rule extractor** — compiles the program's personal-data minimization requirements into hunt guardrails.
34344. **Report format requirement parser** — extracts required report sections, templates, and formatting rules.
34345. **Required evidence parser** — identifies mandatory evidence types such as screenshots, videos, or HTTP logs.
34346. **Triage process summarizer** — condenses the described triage workflow into a step-by-step summary.
34347. **Appeal process extractor** — captures how to dispute a triage decision and the applicable deadlines.
34348. **Program tier classifier** — labels programs as VDP, private bounty, public bounty, or event based on parsed signals.
34349. **New program onboarding parser** — runs the full parse pipeline automatically when a researcher adds a new program.
34350. **Policy URL monitor** — watches the canonical policy URL on a schedule and re-parses on change.
34351. **Policy readability scorer** — grades policy clarity so researchers can spot confusing programs early.
34352. **Rule coverage mapper** — maps each parsed rule to the hunt configuration that enforces it, exposing gaps.
34353. **Unenforceable rule reporter** — lists parsed rules the engine cannot enforce, assigned for manual compliance.
34354. **Human review queue for low-confidence parses** — routes uncertain extractions to a researcher for confirmation.
34355. **Parse confidence indicator** — shows per-clause confidence so researchers know which extractions to trust.
34356. **Manual rule override editor** — lets researchers correct or supplement any parsed rule with an audit trail.
34357. **Rule test sandbox** — validates parsed rules against sample hosts and payloads before the hunt uses them.
34358. **Historical policy archive search** — searches past policy versions for clauses that were added, removed, or softened.
34359. **Cross-program rule comparison** — compares rules across programs to highlight stricter or looser terms.
34360. **Industry rule benchmark** — benchmarks a program's rules against sector norms for scope breadth and payout fairness.
34361. **Rule template library** — provides starter rule sets researchers can attach when a program has no published policy.
34362. **Program rule API** — exposes parsed rules as structured data for external tooling and dashboards.
34363. **Rule webhook** — pushes rule-change events to connected systems in real time.
34364. **Rule change digest email** — sends researchers a periodic summary of policy changes across their programs.
34365. **Policy summarizer** — condenses a full policy into a one-paragraph brief for quick orientation.
34366. **Policy TL;DR card** — renders scope, top payouts, prohibitions, and SLA as a glanceable card.
34367. **Key dates extractor** — pulls program launch, event, and deadline dates into the researcher's calendar.
34368. **Contact info extractor** — captures security-team contact channels listed in the policy.
34369. **PGP key extractor for reports** — retrieves published PGP keys when encrypted submission is required.
34370. **Report encryption requirement parser** — detects whether submissions must be PGP-encrypted and to which key.
34371. **CVSS requirement parser** — detects whether reports must include CVSS vectors and which version.
34372. **CWE requirement parser** — detects whether findings must be mapped to CWE identifiers.
34373. **PoC video requirement detector** — flags programs that require video proof of concept.
34374. **Report language requirement parser** — captures the required submission language for the report.
34375. **Resubmission policy parser** — extracts rules for retesting fixed issues and claiming retest credit.
34376. **Out-of-scope auto-reject predictor** — estimates the chance a finding will be rejected as out of scope before submission.
34377. **Rule-based pre-submission validator** — checks a draft report against parsed rules and flags violations.
34378. **Submission checklist auto-builder** — generates a per-program submission checklist from parsed requirements.
34379. **Policy-conformant report assembler** — orders report sections and evidence to match the program's required format.
34380. **Rule violation risk scorer per finding** — scores how likely each finding is to breach a program rule if submitted as-is.
34381. **Program fit scorer** — rates how well a program matches the researcher's skills, preferences, and availability.
34382. **Effort estimator from policy** — predicts the testing effort implied by scope breadth and asset count.
34383. **Expected payout estimator** — models likely earnings from severity distribution and payout tables.
34384. **Competition level estimator** — gauges researcher crowding from program age, visibility, and payout signals.
34385. **Program freshness scorer** — rates how recently the program or its assets were updated or expanded.
34386. **Triage speed predictor** — predicts time-to-first-response from historical SLA adherence signals.
34387. **Policy sentiment analyzer** — gauges researcher-friendliness from policy tone and past dispute language.
34388. **Program trust scorer** — combines payout reliability, dispute fairness, and communication signals into one score.
34389. **Rule update impact analyzer** — predicts how a policy change affects in-flight hunts and queued findings.
34390. **Grandfather clause detector** — identifies whether findings from before a rule change keep old terms.
34391. **Retroactive rule change flagger** — warns when a policy update applies new restrictions to already-submitted work.
34392. **Policy effective-date tracker** — records when each rule version takes effect for dispute timelines.
34393. **Rule exception parser** — captures carve-outs and exceptions buried in policy footnotes.
34394. **Temporary rule parser for events** — handles event-specific overrides that expire after the event ends.
34395. **Rule expiry tracker** — counts down temporary rules and reverts to baseline terms on expiry.
34396. **Multi-program rule aggregator** — merges rules across all of a researcher's programs into one compliance view.
34397. **Rule search across programs** — full-text searches parsed rules across every tracked program at once.
34398. **Rule bookmarking** — saves important clauses for quick access during hunts and disputes.
34399. **Rule annotation for researchers** — attaches private notes and interpretations to individual clauses.
34400. **Shared rule notes** — lets teams collaboratively annotate ambiguous program rules.
34401. **Rule discussion threads** — hosts per-clause discussions so teams align on interpretation.
34402. **Program rule changelog RSS** — publishes rule changes as a feed researchers can subscribe to.
34403. **Policy parser accuracy feedback loop** — collects researcher corrections to improve future parses.
34404. **Parser model retraining pipeline** — periodically retrains the extraction model on corrected examples.
34405. **Per-program severity mapper** — stores a custom severity scale per program so the same finding grades differently everywhere.
34406. **P2-here P4-there translator** — converts a finding's severity between programs using their published rubrics.
34407. **CVSS-to-program-grade converter** — maps a CVSS vector to each program's native grade like P1 through P5 or Critical to Info.
34408. **Program severity rubric importer** — ingests a program's published rubric into a structured, versioned mapping.
34409. **Custom severity scale designer** — lets researchers define their own internal severity ladder for triage prioritization.
34410. **Severity override rules engine** — applies conditional rules such as "auth bypass on payment host is always Critical".
34411. **Finding-type severity defaults per program** — sets baseline grades per vulnerability class, tuned to each program's history.
34412. **Impact-based re-grader** — adjusts severity up or down based on demonstrated data or access impact.
34413. **Exploitability-based re-grader** — adjusts severity based on authentication required, user interaction, and reliability.
34414. **Asset-criticality multiplier** — raises severity for findings on payment, auth, or admin hosts per program weighting.
34415. **Data-sensitivity multiplier (customization context)** — raises severity when the exposed data class is PII, credentials, or financial records.
34416. **Program payout-tier aligner** — snaps computed severity to the program's actual payout tiers to avoid unpayable grades.
34417. **Severity confidence scorer** — rates how certain the assigned grade is, based on evidence strength.
34418. **Triage-prediction model** — predicts the grade the program's triage team will most likely assign.
34419. **Historical triage outcome learner** — learns from past accepted, downgraded, and disputed grades per program.
34420. **Severity dispute predictor** — estimates the probability the program will contest the submitted grade.
34421. **Downgrade risk flagger** — warns when a finding's grade is likely to be lowered, with the probable reason.
34422. **Upgrade opportunity detector** — spots findings whose impact evidence justifies arguing for a higher grade.
34423. **Severity justification generator** — drafts the impact paragraph that supports the chosen grade per program rubric.
34424. **Program-specific impact statement builder** — assembles impact text using the program's preferred terminology.
34425. **Severity calibration dashboard** — compares submitted versus final grades across programs to reveal bias.
34426. **Cross-program severity benchmark** — shows how the same finding class grades across all tracked programs.
34427. **Severity drift tracker** — monitors whether a program's grading strictness changes over time.
34428. **Rubric change impact preview** — previews how a new rubric version would re-grade existing findings.
34429. **Bulk re-grade on rubric update** — re-applies severity mappings to queued findings when a program updates its rubric.
34430. **Severity audit trail** — logs every grade change with who, when, and the rationale.
34431. **Researcher severity agreement tracker** — measures how often each researcher's grades match final triage outcomes.
34432. **Program strictness profiler** — profiles each program as lenient, balanced, or strict based on grade history.
34433. **Severity appeal assistant** — drafts dispute messages citing rubric clauses and comparable accepted findings.
34434. **Severity evidence linker** — attaches the exact screenshots and logs that justify each grade component.
34435. **CVSS vector auto-builder** — constructs the CVSS vector string from finding attributes with per-metric explanations.
34436. **CVSS environmental metric tuner** — adjusts environmental metrics per program asset criticality definitions.
34437. **SSVC decision-point mapper** — maps findings to SSVC decision points for programs that use that framework.
34438. **Stakeholder-specific severity view** — renders executive, developer, and triager views of the same grade.
34439. **Executive severity translator** — converts technical grades into business-risk language for leadership summaries.
34440. **Developer severity translator** — converts grades into fix-priority guidance with remediation urgency.
34441. **Severity-to-SLA mapper** — links each grade to the program's promised fix or response timeline.
34442. **Severity-to-bounty estimator** — predicts the payout range for a finding at its mapped grade.
34443. **Payout predictor per finding** — combines grade, program history, and bonus clauses into an expected reward.
34444. **Severity normalization for reports** — presents grades consistently when one report covers multiple programs.
34445. **Multi-program report severity switcher** — flips a report's grades between program rubrics without rewriting it.
34446. **Severity glossary per program** — defines what each grade means in the program's own words.
34447. **Severity examples library** — curates real anonymized examples of each grade per program.
34448. **Borderline case classifier** — identifies findings that sit on grade boundaries and need extra evidence.
34449. **Severity peer-review workflow** — routes borderline grades to a teammate for a second opinion.
34450. **Severity consensus voter** — collects team votes on contested grades and records the outcome.
34451. **Program triager persona model** — models individual triager grading tendencies from public and historical data.
34452. **Severity language localizer** — renders grade names and descriptions in the researcher's preferred language.
34453. **Severity color-code customizer** — lets researchers remap grade colors for accessibility or preference.
34454. **Severity badge designer** — creates branded grade badges for reports and portfolios.
34455. **Severity filter in hunt dashboard** — filters live findings by mapped grade during the hunt.
34456. **Severity-weighted hunt prioritizer** — steers testing toward asset classes likely to yield high-grade findings.
34457. **Severity-targeted check selector** — enables check families historically correlated with critical grades on the program.
34458. **High-severity fast-lane testing** — runs the checks most likely to find critical issues first on new targets.
34459. **Severity-gated notification rules** — notifies immediately on critical-grade candidates, batches lower grades.
34460. **Severity-based auto-escalation** — escalates a finding's grade automatically when new impact evidence arrives.
34461. **Severity trend analyzer** — charts grade distributions over time per program and researcher.
34462. **Severity distribution chart** — visualizes the portfolio's grade mix for planning and reporting.
34463. **Program comparison matrix (customization context)** — compares rubrics, tiers, and strictness side by side.
34464. **Severity migration tool** — converts a finding's grade when moving it from one program's rubric to another.
34465. **Rubric version control** — versions every imported rubric with diffable history.
34466. **Rubric diff viewer** — shows exactly what changed between rubric versions.
34467. **Rubric rollback** — restores a previous rubric version if an update proves wrong.
34468. **Rubric template gallery** — ships starter rubrics modeled on common industry grading schemes.
34469. **Industry rubric benchmarks** — compares a program's rubric against sector grading norms.
34470. **Severity QA checklist** — walks researchers through evidence, impact, and exploitability before finalizing a grade.
34471. **Severity sign-off workflow** — requires approval for critical-grade submissions on team hunts.
34472. **Severity change notifier** — alerts stakeholders when a finding's grade changes after review.
34473. **Severity API for integrations** — exposes grade computation and mapping as a service for pipelines.
34474. **Severity webhook events** — emits events on grade assignment, change, and dispute.
34475. **Severity in export formats** — includes mapped grades and vectors in JSON, CSV, and PDF exports.
34476. **Severity mapping documentation generator** — produces a human-readable document of all active mappings.
34477. **Researcher severity coaching tips** — surfaces contextual guidance when a researcher's grades diverge from triage outcomes.
34478. **Program-specific severity quiz** — tests understanding of a program's rubric with graded examples.
34479. **Severity decision tree visualizer** — renders the rubric as an interactive decision tree for consistent grading.
34480. **What-would-program-X-say simulator** — predicts grades for a finding across every tracked program at once.
34481. **Severity sandbox tester** — lets researchers experiment with grading scenarios without touching live findings.
34482. **Historical severity accuracy report** — scores past grading accuracy per researcher and program.
34483. **Triager feedback importer** — ingests triage comments to refine future grade predictions.
34484. **Severity model retrainer** — retrains the prediction model on newly resolved triage outcomes.
34485. **Edge-case severity library** — collects unusual grading decisions as reference precedents.
34486. **Zero-day severity fast-track** — applies an expedited grading path for novel vulnerability classes.
34487. **Chain severity aggregator** — computes a combined grade for chained findings reflecting total impact.
34488. **Business-logic severity assessor** — grades logic flaws by financial or operational impact rather than technical CVSS alone.
34489. **Privacy-impact severity assessor** — grades findings by the volume and sensitivity of exposed personal data.
34490. **Safety-impact severity assessor** — raises grades for flaws affecting physical safety in IoT, automotive, or medical targets.
34491. **Financial-impact severity assessor** — quantifies direct monetary impact for fraud and payment flaws.
34492. **Reputational-impact severity assessor** — factors brand and trust damage into grades for public-facing flaws.
34493. **Compliance-impact severity assessor** — raises grades when a flaw violates PCI DSS, HIPAA, or other program-relevant regimes.
34494. **Severity versus effort matrix** — plots grade against exploitation effort to prioritize high-value, low-effort targets.
34495. **Severity versus likelihood matrix** — plots grade against exploitation likelihood for risk-based planning.
34496. **Risk matrix customizer** — lets teams define their own severity-likelihood matrix per program.
34497. **Severity threshold alerter** — triggers alerts when findings cross a configurable grade threshold.
34498. **Portfolio severity overview** — aggregates grades across all hunts for executive reporting.
34499. **Program health via severity trends** — infers program maturity from how its grade distribution evolves.
34500. **Severity SLA compliance tracker** — tracks whether triage and remediation met promised timelines per grade.
34501. **Under-graded finding detector** — flags findings whose evidence supports a higher grade than assigned.
34502. **Over-graded finding detector** — flags findings likely to be downgraded, protecting researcher credibility.
34503. **Severity consistency scorer** — measures grading consistency across a researcher's portfolio over time.
34504. **Annual severity calibration report** — summarizes a year's grading accuracy, disputes, and lessons learned.
34505. **Sandboxed JS check API** — runs researcher-written checks in an isolated JavaScript runtime with network and scope guardrails.
34506. **Check plugin SDK** — ships typed helpers for requests, parsing, findings, and evidence tailored to hunt checks.
34507. **Plugin version control** — tracks every check revision with diffs, authors, and rollback support.
34508. **Plugin marketplace (customization context)** — lets researchers publish, discover, and install community check plugins with ratings.
34509. **In-app plugin code editor** — provides syntax highlighting, autocomplete for the check API, and inline docs.
34510. **Plugin testing sandbox** — executes a check against mock responses before it ever touches a live target.
34511. **Plugin debugger** — offers breakpoints, step-through, and variable inspection for check development.
34512. **Plugin linting** — flags unsafe patterns, scope violations, and performance anti-patterns in check code.
34513. **Plugin permission manifest** — declares required capabilities like raw sockets or file writes, approved at install time.
34514. **Plugin resource limits** — caps CPU, memory, requests, and runtime per check execution.
34515. **Plugin signing (customization context)** — cryptographically signs published plugins so hunts can verify authorship and integrity.
34516. **Plugin review workflow** — routes community plugins through security and quality review before listing.
34517. **Private plugin registry (customization context)** — hosts team-internal checks separate from the public marketplace.
34518. **Plugin dependency manager** — resolves and pins shared libraries used by check plugins.
34519. **Plugin update notifier** — alerts when an installed plugin has a new reviewed version.
34520. **Plugin rollback (customization context)** — reverts to the previous plugin version if an update misbehaves mid-hunt.
34521. **Plugin A/B testing** — runs two check versions side by side and compares findings per request.
34522. **Plugin performance profiler** — measures per-check latency, request count, and memory to catch expensive checks.
34523. **Plugin telemetry** — collects anonymized hit rates and error rates to rank plugin effectiveness.
34524. **Plugin error reporter** — captures stack traces and failing inputs, routed to the plugin author.
34525. **Check template gallery** — ships starter templates for common check shapes like endpoint probes and auth tests.
34526. **No-code check wizard** — builds checks from guided steps without writing code.
34527. **Request builder block** — configures method, URL, headers, and body as a reusable check component.
34528. **Response matcher block** — defines status, header, and body matchers that decide pass or fail.
34529. **Logic branch block** — adds if-then-else branching on response values inside a check.
34530. **Loop block** — iterates a check over lists of paths, parameters, or payloads.
34531. **Variable store block** — persists extracted values across steps, such as tokens for chained requests.
34532. **Check scheduling** — runs checks on a cron-like schedule for continuous monitoring hunts.
34533. **Check chaining** — pipes one check's output as the next check's input for multi-step validations.
34534. **Check parameterization** — exposes tunables like depth, wordlist, and timeout without editing code.
34535. **Check input validator** — validates parameters before execution and rejects unsafe combinations.
34536. **Check output normalizer** — converts heterogeneous check results into the standard finding schema.
34537. **Finding formatter hook** — lets plugins customize how their findings render in reports.
34538. **Severity hook** — lets a check propose or adjust severity with justification.
34539. **Evidence collector hook** — standardizes screenshots, logs, and request dumps per check.
34540. **Pre-hunt hook** — runs setup logic such as login or token fetch before checks begin.
34541. **Post-hunt hook** — runs cleanup, summary, or notification logic after checks complete.
34542. **On-finding hook** — triggers follow-up actions the moment a specific check reports a finding.
34543. **Scope-check hook** — lets plugins add custom scope validations beyond the built-in engine.
34544. **Auth-refresh hook** — refreshes expiring session tokens mid-hunt without restarting checks.
34545. **Sandboxed Python check runtime** — executes Python checks in a restricted interpreter for data-heavy logic.
34546. **WASM check runtime for Go** — runs compiled Go checks as WebAssembly modules in a sandbox.
34547. **Rego policy checks** — expresses compliance-style checks as declarative Rego policies.
34548. **YAML-defined checks** — declares simple request-match checks in readable YAML for non-programmers.
34549. **Nuclei template importer** — converts community Nuclei templates into native checks with metadata preserved.
34550. **Nuclei template converter** — translates check logic both ways for teams that maintain both formats.
34551. **Check export to Nuclei** — publishes a native check as a Nuclei template for wider sharing.
34552. **Check documentation generator** — builds reference docs from check code, parameters, and examples.
34553. **Check example generator** — synthesizes sample invocations and expected outputs for new checks.
34554. **Check best-practice linter** — scores checks against guidelines for safety, scope, and evidence quality.
34555. **Check self-security scan** — scans check code for vulnerabilities like command injection in its own logic.
34556. **Malicious plugin detector** — heuristically flags plugins exhibiting exfiltration or sabotage behavior.
34557. **Plugin reputation scorer** — combines author history, reviews, and telemetry into a trust score.
34558. **Community plugin ratings** — collects star ratings and written reviews from researchers who ran the plugin.
34559. **Plugin usage analytics** — shows installs, runs, and finding yields per plugin over time.
34560. **Plugin author profiles (customization context)** — showcases an author's plugins, ratings, and specialization areas.
34561. **Plugin bounty for check authors** — lets teams fund specific checks they want built.
34562. **Plugin license manager** — tracks open-source versus commercial licenses across installed plugins.
34563. **Plugin forking** — clones any plugin into a personal editable copy with attribution retained.
34564. **Plugin pull-request workflow** — proposes improvements to a plugin through reviewable change requests.
34565. **Plugin CI pipeline** — runs lint, sandbox tests, and security scans on every plugin change.
34566. **Plugin test fixtures** — bundles recorded request-response pairs for deterministic check testing.
34567. **Mock target server for tests** — spins up a fake vulnerable app so checks can be tested end to end.
34568. **Record-replay test harness** — records live traffic once, then replays it for repeatable check tests.
34569. **Check coverage mapper** — maps which checks cover which vulnerability classes and target surfaces.
34570. **Untested surface suggester** — recommends new checks for target areas no existing check covers.
34571. **Check recommendation engine** — suggests plugins based on target stack, industry, and researcher history.
34572. **Auto-check generator from OpenAPI spec** — synthesizes parameter and auth checks directly from a Swagger or OpenAPI file.
34573. **Auto-check generator from traffic capture** — turns a recorded session into replay-and-mutate checks.
34574. **Check deduplication detector** — identifies plugins that duplicate built-in or installed checks.
34575. **Check conflict resolver** — resolves ordering and overlap conflicts when multiple plugins target the same surface.
34576. **Check execution order optimizer** — sequences checks to maximize early findings within request budgets.
34577. **Parallel check executor** — runs independent checks concurrently while respecting rate limits.
34578. **Check result cache** — caches idempotent check results to avoid repeat requests across hunts.
34579. **Incremental check runner** — re-runs only checks affected by target or code changes since the last run.
34580. **Check timeout manager** — enforces per-check timeouts with graceful degradation and partial results.
34581. **Check retry policy** — retries transient failures with backoff, capped per check configuration.
34582. **Check circuit breaker** — pauses a check that repeatedly errors instead of burning the request budget.
34583. **Check dry-run mode** — previews the requests a check would send without transmitting them.
34584. **Check impact estimator** — predicts request volume and intrusiveness before a check runs.
34585. **Check safety classifier** — labels checks as safe, cautious, or intrusive for guardrail decisions.
34586. **Intrusive check gate** — requires explicit approval before intrusive checks run on a target.
34587. **Check approval workflow** — routes new or updated checks through team approval before hunt use.
34588. **Check audit log** — records every check execution with parameters, scope, and outcome.
34589. **Check compliance tags** — labels checks with regimes like PCI DSS or SOC 2 for audit reporting.
34590. **Check MITRE mapping** — maps checks to MITRE ATT&CK techniques for coverage reporting.
34591. **Check CWE mapping** — maps checks to CWE identifiers for standardized classification.
34592. **Check OWASP mapping** — maps checks to OWASP categories for methodology alignment.
34593. **Check scheduling calendar** — visualizes scheduled check runs across hunts and targets.
34594. **Check run history** — browses past executions with inputs, outputs, and findings produced.
34595. **Check diff between versions** — compares two plugin versions line by line before upgrading.
34596. **Check release notes generator** — drafts release notes from commit messages and behavior changes.
34597. **Check deprecation workflow** — marks superseded checks deprecated with migration guidance.
34598. **Check migration assistant** — rewrites deprecated check calls to their replacements automatically.
34599. **Shared check workspaces for teams** — provides collaborative folders for developing team checks together.
34600. **Check commenting** — threads discussions on specific lines of check code.
34601. **Check code review assignments** — assigns reviewers to plugin changes with due dates.
34602. **Check quality score** — grades plugins on docs, tests, safety, and telemetry performance.
34603. **Check author leaderboard** — ranks contributors by plugin quality and finding yield.
34604. **Check SDK changelog** — publishes versioned notes for every SDK and API change.
34605. **Startup mode fast shallow sweep** — runs a time-capped, high-signal scan tuned for small codebases and tight deadlines.
34606. **Enterprise mode deep thorough hunt** — enables exhaustive checks, full crawling, and chained validation for large estates.
34607. **Stealth mode low-noise profile** — minimizes request rate, avoids intrusive payloads, and randomizes timing to stay under monitoring radar.
34608. **Aggressive mode full-throttle profile** — maximizes concurrency and payload depth where the program explicitly permits it.
34609. **Time-boxed sprint mode** — packs the highest-yield checks into a researcher-defined window like two hours.
34610. **Overnight soak mode** — runs slow, polite, long-duration testing that completes by morning without tripping alarms.
34611. **Weekend warrior mode** — schedules an intensive multi-day hunt across a target list with progress checkpoints.
34612. **Lunch-break quick scan** — executes a fifteen-minute high-confidence check bundle for a fast health read.
34613. **Pre-release gate mode** — focuses on regressions and critical paths before a deployment goes live.
34614. **Post-deploy verification mode** — re-tests changed surfaces and confirms no new exposures after a release.
34615. **Continuous monitoring mode** — keeps a lightweight watch on the target, alerting on new endpoints or changed behavior.
34616. **One-shot assessment mode** — performs a single comprehensive pass with no follow-ups, suited to fixed-scope gigs.
34617. **Red-team emulation mode** — chains findings toward an objective like data access, emulating adversary progression.
34618. **Purple-team collaboration mode** — shares live findings and detection notes with the defending team during the hunt.
34619. **Compliance audit mode** — maps checks to SOC 2, PCI DSS, or ISO 27001 control families for audit evidence.
34620. **Bug-bounty program mode** — optimizes for payout: high-severity-first checks with strict scope and duplicate awareness.
34621. **Private program mode** — adds discretion settings like minimal footprint and NDA-aware evidence handling.
34622. **Live-hacking-event mode** — tunes for speed and collaboration during time-limited hacking events.
34623. **Interview prep mode (customization context)** — narrates reasoning step by step so the researcher can study methodology.
34624. **Training mode with hints** — guides junior researchers with progressive hints instead of doing the work silently.
34625. **CTF mode** — optimizes for flag capture with aggressive enumeration and creative chaining.
34626. **Research mode for novel vulns** — allocates budget to unusual surfaces and custom probes aimed at zero-days.
34627. **Regression mode for re-testing** — replays the exact checks from a previous hunt to verify fixes.
34628. **Patch verification mode** — narrowly re-tests patched vulnerabilities with bypass-focused payloads.
34629. **M&A due-diligence mode** — produces an executive-grade risk summary of an acquisition target's posture.
34630. **Vendor assessment mode** — evaluates a third-party product against a standardized security questionnaire.
34631. **API-first mode** — skips UI crawling and focuses entirely on API discovery and authorization testing.
34632. **Mobile-backend mode** — prioritizes mobile API endpoints, certificate pinning tests, and app-specific flows.
34633. **Web-only mode** — excludes APIs and infrastructure, concentrating on the browser-facing application.
34634. **Infrastructure mode** — focuses on network services, TLS, headers, and server misconfigurations.
34635. **Cloud-config mode** — targets cloud storage, metadata services, and IAM-adjacent web exposures.
34636. **Source-code-assisted mode** — incorporates provided source access to guide targeted dynamic checks.
34637. **Black-box pure mode** — disables any credentialed or insider assumptions for a true outsider test.
34638. **Gray-box credentialed mode** — uses provided low-privilege accounts to test authorization boundaries.
34639. **White-box full-access mode** — leverages docs, source, and admin access for maximum-depth validation.
34640. **Profile builder wizard** — guides researchers through creating a custom hunt profile question by question.
34641. **Profile cloning** — duplicates any built-in or shared profile as a starting point for tweaks.
34642. **Profile sharing** — publishes a profile to teammates or the community with one click.
34643. **Profile marketplace** — browses community hunt profiles ranked by effectiveness and reviews.
34644. **Profile versioning** — tracks every profile change with diffs and restore points.
34645. **Profile diff viewer** — compares two profiles setting by setting before switching.
34646. **Profile import and export** — moves profiles between installations as portable files.
34647. **Organization default profile** — sets the baseline profile every team member's hunt starts from.
34648. **Team profile inheritance** — lets team profiles extend the org default with their own overrides.
34649. **Per-target profile auto-suggest** — recommends the best profile based on target classification and history.
34650. **Profile effectiveness analytics** — measures findings per hour and per request for each profile.
34651. **Profile A/B testing** — runs two profiles against comparable targets and compares outcomes.
34652. **Adaptive profile auto-tuning** — adjusts concurrency and check selection mid-hunt based on live signal.
34653. **Profile scheduler** — queues profiles to run at specific times, like stealth mode overnight.
34654. **Profile chaining across phases** — runs recon profile first, then automatically switches to exploitation profile.
34655. **Conditional profile switching** — changes profile when triggers fire, such as WAF detection or auth discovery.
34656. **Manual profile override mid-hunt** — lets the researcher swap profiles without losing hunt state.
34657. **Profile pause and resume** — freezes a hunt's profile state and continues it later intact.
34658. **Profile dry-run estimator** — predicts duration, requests, and coverage before the hunt launches.
34659. **Profile cost estimator** — estimates compute and API costs for cloud-backed hunt components.
34660. **Profile time estimator** — forecasts wall-clock time from target size and profile settings.
34661. **Profile coverage estimator** — predicts which vulnerability classes the profile will and will not cover.
34662. **Noise-level slider per profile** — tunes request rate and evasion from silent to loud on one control.
34663. **Request-budget cap per profile** — hard-limits total requests to respect program or cost constraints.
34664. **Concurrency tuner per profile** — sets parallel request limits matched to target tolerance.
34665. **Payload-depth selector per profile** — chooses shallow, standard, or deep payload expansion per check.
34666. **Check-family toggles per profile** — enables or disables whole vulnerability families with one switch each.
34667. **Phase toggles per profile** — turns recon, mapping, exploitation, and reporting phases on or off.
34668. **Reporting depth per profile** — selects terse, standard, or exhaustive report generation.
34669. **Evidence level per profile** — controls how much proof is captured, from minimal to court-grade.
34670. **Language per profile** — sets the hunt's working language for payloads, parsing, and reports.
34671. **Notification rules per profile** — configures which events ping the researcher and through which channel.
34672. **Auto-escalation per profile** — defines when critical findings trigger immediate alerts versus batched digests.
34673. **Profile compliance guardrails** — hard-blocks profile settings that would violate program rules.
34674. **Profile safety interlocks** — prevents destructive check combinations regardless of profile settings.
34675. **Profile approval workflow** — requires sign-off before aggressive profiles run on production targets.
34676. **Profile audit log** — records profile selections and mid-hunt changes for accountability.
34677. **Profile usage analytics** — shows which profiles the team uses most and their outcomes.
34678. **Profile recommendation engine** — suggests profiles from target traits and researcher track record.
34679. **Start-from-template gallery** — offers curated profile templates for common hunting scenarios.
34680. **Industry-tuned profile presets** — ships profiles pre-tuned for fintech, healthcare, retail, and other sectors.
34681. **Target-size-tuned profiles** — adjusts depth and breadth automatically for single-app versus enterprise-estate targets.
34682. **Tech-stack-tuned profiles** — pre-configures checks and payloads for detected frameworks.
34683. **Goal-oriented profiles** — optimizes for max payout, max coverage, or fastest completion per researcher goal.
34684. **Risk-appetite selector** — sets how aggressively the hunt pursues uncertain but high-impact leads.
34685. **Stealth-versus-speed tradeoff visualizer** — graphs the expected detection risk against completion time per setting.
34686. **Profile simulation** — predicts findings, time, and requests for a profile against a target model.
34687. **Profile benchmarking** — compares profile performance across standardized test targets.
34688. **Profile leaderboard** — ranks community profiles by verified hunting outcomes.
34689. **Profile author attribution** — credits profile creators and links their hunting credentials.
34690. **Profile reviews and ratings** — collects researcher feedback on shared profiles.
34691. **Profile update subscriptions** — notifies followers when a profile they use gets improved.
34692. **Deprecated profile migrator** — moves hunts off retired profiles onto their recommended successors.
34693. **Profile backup and restore** — snapshots all profiles for disaster recovery.
34694. **Profile sync across devices** — keeps profiles identical on desktop, laptop, and mobile.
34695. **Profile API** — manages profiles programmatically for automation and integrations.
34696. **Profile webhooks** — emits events on profile changes, hunt starts, and completions.
34697. **Profile in CI/CD** — runs profile-defined checks as pipeline gates on every deployment.
34698. **Profile git integration** — stores profiles as versioned files alongside infrastructure code.
34699. **Profile secrets handling** — injects credentials from the vault without persisting them in profile files.
34700. **Profile environment variables** — parameterizes profiles with per-environment values.
34701. **Profile conditional variables** — switches settings based on target attributes evaluated at runtime.
34702. **Profile math expressions** — computes budgets and timeouts from formulas instead of fixed numbers.
34703. **Profile documentation generator** — produces human-readable docs explaining what each profile does and why.
34704. **Profile quick-switch hotkeys** — swaps active profiles instantly with keyboard shortcuts mid-hunt.
34705. **Locale-aware payload switcher** — swaps payload character sets and encodings based on the target's detected language.
34706. **Site language detector** — identifies the primary and secondary languages from HTML lang attributes, content, and headers.
34707. **Multi-locale hunt coordinator** — runs the same checks across each locale version of the site and compares results.
34708. **Hindi Devanagari payload pack** — crafts injection probes for inputs rendered in Devanagari script contexts.
34709. **Arabic RTL payload pack** — adapts XSS and injection probes for right-to-left rendering and bidirectional text handling.
34710. **Chinese GBK encoding payload pack** — exploits GBK multibyte quirks for filter bypasses on Chinese-language targets.
34711. **Japanese Shift_JIS payload pack** — targets Shift_JIS encoding edge cases in form handling and output encoding.
34712. **Korean EUC-KR payload pack** — probes EUC-KR decoding inconsistencies in legacy Korean web applications.
34713. **Russian Windows-1251 pack** — tests charset-handling flaws on Cyrillic targets served as Windows-1251.
34714. **Turkish ISO-8859-9 pack** — probes the Turkish dotted-I case-mapping issue in input validation.
34715. **UTF-7 legacy payload pack** — tests UTF-7 decoding attacks where older frameworks still honor the encoding.
34716. **UTF-16BE and UTF-16LE payload pack** — crafts byte-order-specific probes for endpoints that decode UTF-16.
34717. **Overlong UTF-8 encoding pack** — tests non-shortest-form sequences that bypass naive input filters.
34718. **Unicode normalization attack pack** — exploits NFC, NFD, and NFKC normalization differences between validation and use.
34719. **Homoglyph and IDN attack pack** — tests confusable-character handling in usernames, domains, and display names.
34720. **BiDi control character pack** — probes U+202A through U+202E handling in names, messages, and file displays.
34721. **Zero-width character pack** — tests zero-width joiner and non-joiner bypasses in filters and uniqueness checks.
34722. **Fullwidth character pack** — probes fullwidth ASCII variants that slip past keyword blacklists.
34723. **Right-to-left override pack** — tests RLO spoofing in filenames, URLs, and displayed identifiers.
34724. **Locale-specific XSS contexts** — tunes script contexts for localized templates, translated strings, and regional layouts.
34725. **Translated error-message fingerprinter** — matches error strings across languages to identify frameworks behind localized messages.
34726. **Localized admin path guesses** — enumerates admin routes using translated terms like /verwaltung or /administracion.
34727. **Localized login path guesses** — tries /connexion, /anmelden, and /iniciar-sesion alongside /login.
34728. **Language-prefixed route enumerator** — discovers /en/, /hi/, /ar/, and similar locale prefixes and tests each.
34729. **Accept-Language fuzzer** — mutates the Accept-Language header to find locale-dependent behavior differences.
34730. **Content-Language mismatch detector** — flags responses whose declared language contradicts their actual content.
34731. **Charset declaration mismatch tester** — compares meta charset, HTTP header, and actual byte content for exploitable gaps.
34732. **Meta-charset versus header tester** — checks which charset declaration wins when they disagree, and whether it enables XSS.
34733. **Transliteration edge-case tester** — probes romanization conversions that change string meaning or length.
34734. **Locale-specific input validator probe** — tests validators that behave differently per locale, such as phone or postal formats.
34735. **Date-format injection per locale** — probes dd/mm versus mm/dd ambiguities and locale date parsers.
34736. **Number-format injection per locale** — tests comma-versus-dot decimal separators in price and quantity fields.
34737. **Currency-format injection per locale** — probes currency symbol placement and code handling in payment flows.
34738. **Phone-number format probe per locale** — tests international format handling, extensions, and validation bypasses.
34739. **Address-format probe per locale** — checks address fields for locale-specific assumptions that break validation.
34740. **Name-field probe for multi-part names** — tests patronymics, multiple surnames, and mononyms against name validators.
34741. **ID-number format probe per country** — probes national ID patterns for enumeration or validation flaws.
34742. **Postal-code probe per country** — tests postal formats that vary wildly across locales for bypasses.
34743. **Right-to-left layout break tester** — checks whether RTL rendering breaks security-relevant UI like permission dialogs.
34744. **Mirrored UI logic flaw detector** — finds logic errors introduced when layouts are mirrored for RTL languages.
34745. **Translated string XSS via language files** — tests whether translator-supplied strings are rendered unsanitized.
34746. **i18n key enumeration** — enumerates translation keys that may reveal hidden features or debug strings.
34747. **Missing-translation fallback tester** — checks fallback behavior for untranslated keys, which can leak internal identifiers.
34748. **Language-file inclusion tester** — probes locale file-loading for path traversal in language parameters.
34749. **Locale-specific open redirect** — tests localized "continue" parameters and regional domain allowlists.
34750. **Country-specific SSO provider tester** — probes regional identity providers wired into the login flow.
34751. **Localized payment method tester** — tests region-specific payment options like UPI, iDEAL, or Boleto for logic flaws.
34752. **Localized CAPTCHA bypass variants** — adapts CAPTCHA analysis to regional providers and language-specific challenges.
34753. **Localized rate-limit message parser** — understands throttling messages in the site's language to tune request pacing.
34754. **Localized 2FA flow tester** — tests two-factor flows delivered via regional channels and languages.
34755. **Localized password-reset message tester** — checks reset emails and SMS in each locale for token leakage or predictability.
34756. **Localized email template injection** — probes template rendering in transactional emails across languages.
34757. **Localized PDF generation tester** — tests PDF exports in each locale for content-injection and encoding flaws.
34758. **Localized search injection** — probes search backends with locale-specific stemming and tokenization quirks.
34759. **Stemming-related search bypass** — exploits aggressive stemming that collapses distinct terms into one.
34760. **Tokenizer-difference exploit probe** — finds gaps between the search tokenizer and the security filter's tokenizer.
34761. **Localized WAF bypass** — uses language-specific keywords that the WAF's rules do not cover.
34762. **Localized keyword blacklist tester** — checks whether profanity and injection blacklists exist per supported language.
34763. **Profanity-filter bypass per language** — tests filter coverage gaps in each supported language.
34764. **Localized file-upload name tester** — probes filename handling with locale-specific characters and extensions.
34765. **Unicode filename traversal pack** — uses normalized and confusable separators to escape upload directories.
34766. **NFKC normalization bypass pack** — crafts inputs that change meaning after NFKC normalization.
34767. **Turkish-I case-mapping bypass pack** — exploits the Turkish dotted-I issue in case-insensitive comparisons.
34768. **Locale-aware regex bypass pack** — defeats locale-sensitive regex classes with crafted multibyte input.
34769. **Localized GraphQL field guesses** — enumerates translated field names in localized GraphQL schemas.
34770. **Localized API error-code catalog** — builds a per-locale map of error codes to speed up response analysis.
34771. **Localized status-page tester** — checks regional status pages for infrastructure disclosures.
34772. **Language toggle CSRF tester** — verifies locale-switching endpoints are protected against cross-site request forgery.
34773. **Locale cookie tampering tester** — mutates locale cookies to find parser differential vulnerabilities.
34774. **Geo-IP versus locale mismatch tester** — flags inconsistent personalization when geography and locale disagree.
34775. **VPN-locale consistency checker** — validates that locale handling stays coherent across egress regions.
34776. **Localized subdomain enumerator** — guesses region and language subdomains like fr., de., or in.
34777. **Country-code TLD variant tester** — checks ccTLD siblings of the target for scope-relevant exposures.
34778. **Localized WHOIS parser** — extracts registrant signals from WHOIS records in regional formats.
34779. **Localized certificate transparency watcher** — monitors CT logs for locale-flavored subdomains of the target.
34780. **Multi-language report generator** — renders the final bounty report in the researcher's or program's language.
34781. **Finding description localizer** — translates finding titles and summaries without losing technical precision.
34782. **Remediation advice localizer** — adapts fix guidance to the developer's language and regional conventions.
34783. **Severity label localizer** — renders grade names appropriately per language while keeping mappings exact.
34784. **Hunt UI language switcher** — changes the entire hunt interface language on the fly.
34785. **Researcher language preference** — defaults payloads, parsing, and reports to the researcher's chosen language.
34786. **Target-language-first evidence capture** — preserves evidence in the original language with translations attached.
34787. **Screenshot OCR per language** — reads text from evidence screenshots using locale-appropriate OCR models.
34788. **Translated DOM text differ** — compares page content across locales to spot untranslated or leaked strings.
34789. **Language-specific crawler politeness** — respects regional crawling norms and robots directives per locale.
34790. **Localized robots.txt parser** — handles non-English comments and directives in robots files.
34791. **Localized sitemap parser** — processes sitemaps with locale-specific URL patterns and annotations.
34792. **Hreflang alternate enumerator** — harvests hreflang alternate URLs as additional in-scope entry points.
34793. **Language-negotiation cache poison tester** — probes cache poisoning via Accept-Language manipulation.
34794. **Vary Accept-Language cache tester** — checks whether caches properly key on language headers.
34795. **Localized ETag behavior tester** — verifies ETags vary correctly across locale representations.
34796. **Time-zone handling flaw tester** — probes scheduling, expiry, and logging logic across time zones.
34797. **Locale-specific session timeout tester** — checks whether timeout policies differ unexpectedly by locale.
34798. **Non-Gregorian calendar edge tester** — probes Hijri, Hebrew, and other calendar conversions in date logic.
34799. **Localized password policy tester** — tests password rules that vary by locale, such as minimum lengths.
34800. **Localized username enumeration** — adapts enumeration techniques to locale-specific account identifier formats.
34801. **Localized account lockout message parser** — understands lockout and error messages in the site's language.
34802. **Language pack version manager** — versions locale payload packs with changelogs and rollback.
34803. **Community translation contributions** — lets native speakers improve locale packs with review.
34804. **Locale coverage reporter** — reports which locales were tested and which remain untested per hunt.
34805. **SPA preset** — reconfigures the hunt for single-page apps with JS-bundle analysis, API discovery, and DOM XSS focus.
34806. **WordPress preset** — tunes enumeration, plugin probing, and REST API checks for WordPress targets in one click.
34807. **API-only preset** — strips browser checks and focuses on endpoint discovery, auth, and business-logic testing.
34808. **E-commerce preset** — prioritizes cart, checkout, coupon, payment, and order-flow logic checks.
34809. **Mobile-backend preset** — targets mobile API endpoints, token handling, and app-specific authentication flows.
34810. **GraphQL-API preset** — enables introspection, batching abuse, and field-level authorization checks.
34811. **Static-site preset** — runs a fast, light pass focused on headers, exposed files, and third-party includes.
34812. **Server-rendered preset** — emphasizes SSTI, SQLi, and traditional injection against server-side rendering.
34813. **Headless-CMS preset** — probes content APIs, preview modes, and draft-content authorization.
34814. **Marketplace preset** — focuses on buyer-seller isolation, payout flows, and listing manipulation.
34815. **SaaS multi-tenant preset** — prioritizes tenant isolation, subdomain takeovers, and cross-tenant IDOR.
34816. **Fintech-app preset** — loads transaction-integrity, KYC, and payment-flow checks with conservative safety limits.
34817. **Health-portal preset** — emphasizes PHI exposure, FHIR authorization, and appointment-flow logic.
34818. **Gov-portal preset** — focuses on citizen-data exposure, form logic, and document-download authorization.
34819. **Gaming-backend preset** — targets matchmaking, inventory, leaderboard, and virtual-currency logic.
34820. **IoT-dashboard preset** — probes device pairing, telemetry APIs, and firmware-update flows.
34821. **Streaming-service preset** — tests DRM-adjacent APIs, subscription tiers, and content-access controls.
34822. **EdTech-platform preset** — focuses on enrollment, grading, and student-data isolation.
34823. **Real-estate-portal preset** — probes listing management, agent impersonation, and offer flows.
34824. **Job-board preset** — tests resume exposure, application flows, and employer-candidate isolation.
34825. **Social-network preset** — emphasizes privacy controls, follow-graph leaks, and content-visibility logic.
34826. **Forum and community preset** — probes moderation bypasses, private-message access, and trust-level escalation.
34827. **Wiki and knowledge-base preset** — tests revision history leaks, draft visibility, and permission inheritance.
34828. **Blog-network preset** — focuses on multi-author isolation, draft leaks, and comment-system abuse.
34829. **URL-shortener preset** — probes link enumeration, analytics exposure, and redirect manipulation.
34830. **File-sharing preset** — tests share-link entropy, expiry enforcement, and preview-generation flaws.
34831. **Pastebin-like preset** — focuses on private-paste discovery, burn-after-reading bypasses, and scraping limits.
34832. **CI/CD-dashboard preset** — probes build-log exposure, secret leakage, and pipeline-trigger authorization.
34833. **Monitoring-dashboard preset** — tests metric exposure, alert-rule manipulation, and dashboard sharing links.
34834. **Admin-panel preset** — focuses on auth bypass, privilege escalation, and function-level access control.
34835. **Login-portal preset** — concentrates on credential stuffing defenses, MFA, and session management.
34836. **SSO-hub preset** — probes SAML, OIDC, and federation flows for assertion and redirect flaws.
34837. **Payment-gateway preset** — tests amount tampering, currency confusion, and webhook verification.
34838. **Booking-system preset** — focuses on inventory races, price manipulation, and reservation logic.
34839. **Chat-application preset** — probes message privacy, attachment handling, and real-time channel authorization.
34840. **Video-conferencing preset** — tests meeting-link entropy, lobby bypasses, and recording access.
34841. **Email-client preset** — focuses on mailbox isolation, filter rules abuse, and attachment handling.
34842. **CRM preset** — probes contact-data isolation, pipeline visibility, and export controls.
34843. **ERP preset** — tests module-level authorization and financial workflow integrity.
34844. **HRM preset** — focuses on employee-data privacy, payroll exposure, and role hierarchies.
34845. **Preset auto-detector** — classifies the target type from tech signals and suggests the matching preset.
34846. **Preset confidence scorer** — shows how strongly the target matches each available preset.
34847. **Manual preset picker** — lets the researcher choose or override the preset on the launch screen.
34848. **Preset customizer** — adjusts any preset's checks, payloads, and limits before applying it.
34849. **Preset forking** — clones a built-in preset into a personal editable variant.
34850. **Preset sharing** — publishes customized presets to teammates or the community.
34851. **Preset marketplace** — browses community presets with ratings and verified outcome stats.
34852. **Preset versioning** — tracks preset revisions with diffs and rollback.
34853. **Preset changelog** — documents what changed in each preset release.
34854. **Preset diff viewer** — compares two presets setting by setting.
34855. **Preset rollback** — restores the previous preset version in one click.
34856. **Preset effectiveness analytics** — measures findings per hunt for each preset across target types.
34857. **Preset recommendation engine** — suggests presets from target classification and researcher history.
34858. **Multi-preset stacking** — layers two presets, like SPA plus fintech-app, with conflict resolution.
34859. **Preset conflict resolver** — reconciles contradictory settings when presets are stacked.
34860. **Preset quick-apply** — applies a preset to a running hunt without restarting it.
34861. **Preset scheduling** — queues different presets for different phases of a long hunt.
34862. **Preset dry-run preview** — shows the checks, payloads, and budgets a preset would activate.
34863. **Preset coverage estimator** — predicts vulnerability-class coverage for the chosen preset.
34864. **Preset time estimator** — forecasts hunt duration under the preset's settings.
34865. **Preset request-budget estimator** — predicts total requests before the hunt starts.
34866. **Per-preset check toggles** — enables or disables individual check families within a preset.
34867. **Per-preset payload depth** — sets shallow, standard, or deep payload expansion per preset.
34868. **Per-preset wordlist binding** — attaches the right industry wordlist pack to each preset automatically.
34869. **Per-preset scope template** — pairs each preset with sensible default scope rules.
34870. **Per-preset severity rubric hint** — suggests the grading emphasis that fits the preset's target type.
34871. **Per-preset report template** — formats reports with sections relevant to the preset's domain.
34872. **Per-preset notification rules** — tunes alerting urgency to the preset's typical finding profile.
34873. **Preset onboarding tour** — walks first-time users through what each preset does.
34874. **Preset best-practice guide** — documents recommended workflows per target type.
34875. **Preset anti-pattern warner** — warns when a preset is applied to a mismatched target type.
34876. **Preset update notifier** — alerts when a used preset receives improvements.
34877. **Preset deprecation migrator** — moves hunts from retired presets to their successors.
34878. **Preset A/B testing** — compares two presets on similar targets to measure effectiveness.
34879. **Preset benchmarking** — scores presets against standardized vulnerable test applications.
34880. **Organization preset library** — curates approved presets for the whole team.
34881. **Team preset inheritance** — lets team presets extend org presets with local overrides.
34882. **Personal preset collection** — organizes a researcher's favorite presets in one place.
34883. **Preset search** — finds presets by target type, technique, or keyword.
34884. **Preset tagging** — labels presets for filtering by industry, stack, or goal.
34885. **Preset ratings and reviews** — collects community feedback on preset quality.
34886. **Preset author profiles** — showcases creators and their hunting specializations.
34887. **Preset usage analytics** — tracks adoption and outcomes per preset.
34888. **Preset API** — manages presets programmatically for automation.
34889. **Preset webhooks** — emits events on preset changes and applications.
34890. **Preset CI integration** — runs preset-defined checks as deployment gates.
34891. **Preset git sync** — stores presets as versioned files in a repository.
34892. **Preset environment variables** — parameterizes presets per deployment environment.
34893. **Preset secrets vault binding** — injects credentials securely without storing them in preset files.
34894. **Preset compliance tags** — labels presets with applicable regulatory frameworks.
34895. **Preset safety interlocks** — blocks dangerous check combinations regardless of preset settings.
34896. **Preset approval workflow** — requires sign-off before sensitive presets run on production.
34897. **Preset audit log** — records preset applications and modifications.
34898. **Preset documentation generator** — produces readable docs for each preset's rationale and settings.
34899. **Preset localization** — translates preset names and descriptions for global teams.
34900. **Preset accessibility notes** — documents keyboard and screen-reader support for preset UI.
34901. **Preset mobile companion** — surfaces preset controls in the mobile hunt companion app.
34902. **Preset keyboard shortcuts** — applies presets instantly with hotkeys.
34903. **Preset import from scan config** — converts existing scanner configurations into presets.
34904. **Preset export bundle** — packages a preset with its wordlists and payload packs for sharing.
34905. **Saved hunter profile** — stores statements like "I focus on IDOR and logic flaws, skip XSS" that shape every hunt's check selection.
34906. **Focus-area selector** — lets researchers pick vulnerability families to prioritize across all hunts.
34907. **Skip-list manager** — permanently excludes chosen check families the researcher never wants run.
34908. **Weakness-category weighting** — assigns personal weights to CWE categories to steer hunt prioritization.
34909. **Preferred-technique ranking** — orders techniques like IDOR, SSRF, and race conditions by personal strength.
34910. **Notification preference center** — controls which hunt events notify, through which channels, and how urgently.
34911. **Working-hours scheduler** — aligns hunt scheduling and notifications with the researcher's active hours.
34912. **Timezone-aware quiet hours (customization context)** — silences non-critical alerts during the researcher's local night.
34913. **Payout-goal tracker** — sets monthly earnings targets and tracks progress across programs.
34914. **Skill-level self-assessment** — records proficiency per technique to calibrate hints and check depth.
34915. **Learning-path recommender** — suggests tutorials and practice targets based on skill gaps.
34916. **Mentor matching (customization context)** — pairs junior researchers with experienced hunters who share their focus areas.
34917. **Profile visibility controls** — chooses what parts of the hunter profile are public, team-only, or private.
34918. **Portfolio builder** — assembles a shareable portfolio of anonymized findings and achievements.
34919. **Hall-of-fame tracker (customization context)** — monitors acknowledgments and hall-of-fame listings across programs.
34920. **Reputation dashboard** — aggregates signal, impact, and accuracy metrics into one reputation view.
34921. **Specialization badges** — awards verifiable badges for demonstrated expertise in technique areas.
34922. **Preferred program types** — ranks VDP, private, public, and event programs by researcher preference.
34923. **Blocked program list** — hides programs the researcher never wants to see or join.
34924. **Preferred industries** — prioritizes targets in sectors the researcher knows best.
34925. **Preferred tech stacks** — favors targets running frameworks the researcher specializes in.
34926. **Language preferences** — sets preferred languages for UI, payloads, and reports.
34927. **Report style preferences** — chooses concise, narrative, or heavily-evidence report formatting.
34928. **Evidence depth preference** — sets how much proof is captured by default per finding.
34929. **PoC format preference** — defaults to curl, Python, video, or written steps per researcher habit.
34930. **Communication tone preference** — sets professional, friendly, or terse defaults for program messages.
34931. **Triage interaction preferences** — configures how the researcher wants to handle questions and disputes.
34932. **Auto-pilot versus manual balance slider** — blends autonomous hunting with researcher-driven checkpoints.
34933. **Check-aggressiveness preference** — sets the default intrusiveness level for all hunts.
34934. **Stealth preference** — defaults hunts to low-noise operation unless overridden.
34935. **Speed preference** — prioritizes fast completion over exhaustive coverage by default.
34936. **Depth preference** — prioritizes thorough validation over breadth by default.
34937. **Breadth preference** — prioritizes wide asset coverage over deep single-target focus.
34938. **Novelty preference** — biases hunts toward zero-day-style research versus known vulnerability classes.
34939. **Duplication tolerance** — sets how aggressively the hunt avoids likely-duplicate findings.
34940. **False-positive tolerance slider** — trades recall against precision in finding reporting.
34941. **Verification rigor preference** — sets how much confirmation is required before a finding is reported.
34942. **Retest preference** — configures automatic retesting of fixed findings when programs allow it.
34943. **Collaboration preferences** — sets defaults for sharing hunts, findings, and notes with teammates.
34944. **Team role preferences** — declares preferred roles like recon lead or exploit validator in team hunts.
34945. **Solo versus team mode** — defaults new hunts to individual or collaborative operation.
34946. **Preferred hunt duration** — sets typical session lengths that scheduling and profiles respect.
34947. **Session length preference** — configures pomodoro-style focus intervals with break reminders.
34948. **Break reminder settings** — nudges researchers to rest during marathon hunts.
34949. **Focus mode distraction-free UI** — hides non-essential panels during deep work sessions.
34950. **Dashboard layout customizer** — arranges hunt dashboard widgets by drag and drop.
34951. **Widget picker** — adds or removes dashboard widgets like coverage, findings, and scope status.
34952. **Theme preferences** — selects dark, light, or high-contrast themes for the hunt interface.
34953. **Font and size preferences** — adjusts typography for readability during long sessions.
34954. **Color-blind-safe palettes** — offers palettes verified for common color-vision deficiencies.
34955. **Keyboard shortcut customizer** — remaps hunt controls to the researcher's muscle memory.
34956. **Command palette preferences** — configures fuzzy-command access to hunt actions.
34957. **Default landing page** — chooses which view opens when the researcher starts the app.
34958. **Default hunt profile** — pre-selects the profile every new hunt starts with.
34959. **Default preset** — pre-selects the target-type preset applied at hunt creation.
34960. **Default wordlist pack** — sets the fallback wordlist when auto-classification is uncertain.
34961. **Default severity rubric** — chooses the grading scheme applied before program-specific mapping.
34962. **Default report template** — pre-selects the report format for new findings.
34963. **Auto-apply preferences toggle** — switches between always applying saved preferences or asking each time.
34964. **Preference sync across devices** — keeps profiles identical on every device the researcher uses.
34965. **Preference backup and restore** — snapshots all preferences for recovery after reinstalls.
34966. **Preference import and export** — moves preference sets between accounts as portable files.
34967. **Preference version history** — tracks changes to preferences with restore points.
34968. **Preference reset** — restores factory defaults with a confirmation safeguard.
34969. **Preference templates gallery** — ships starter preference sets modeled on successful hunter archetypes.
34970. **Clone-a-pro-hunter starter profiles** — provides anonymized preference profiles of top performers as learning templates.
34971. **Preference-based hunt recommendations** — suggests targets matching the researcher's strengths and interests.
34972. **Preference-based program recommendations** — ranks programs by fit with the researcher's profile.
34973. **Preference-based check recommendations** — surfaces checks aligned with the researcher's focus areas.
34974. **Preference learning from behavior** — auto-tunes preferences based on observed hunting patterns, with opt-out.
34975. **Preference drift detector** — notices when behavior diverges from saved preferences and suggests updates.
34976. **Preference change impact preview** — shows which hunts and defaults a preference change would affect.
34977. **Preference analytics** — visualizes how preferences correlate with hunting outcomes.
34978. **Preference-based leaderboard filters** — compares performance against hunters with similar profiles.
34979. **Opt-in preference sharing** — shares anonymized preferences to improve community recommendations.
34980. **Team preference alignment view** — shows where team members' preferences overlap or conflict.
34981. **Organization preference defaults** — sets org-wide baseline preferences that members can override.
34982. **Preference compliance guardrails** — prevents preferences from violating program or legal constraints.
34983. **Preference audit log** — records preference changes for team accountability.
34984. **Preference API** — manages preferences programmatically for power users and integrations.
34985. **Preference webhooks** — emits events when key preferences change.
34986. **Preferences in CI** — applies researcher preferences to pipeline-triggered hunts.
34987. **Multi-persona switcher** — maintains separate profiles for contexts like day-job versus bounty hunting.
34988. **Persona scheduler** — activates personas automatically by time of day or calendar.
34989. **Persona quick-switch** — swaps active personas instantly without losing hunt state.
34990. **Per-persona statistics** — tracks outcomes separately for each persona.
34991. **Goal setter for monthly bounties** — defines earnings and submission targets with progress tracking.
34992. **Streak tracker** — counts consecutive active hunting days to encourage consistency.
34993. **Achievement system (customization context)** — awards milestones for first blood, chains, and technique mastery.
34994. **Skill tree visualizer** — maps technique proficiency as an explorable skill tree.
34995. **Weak-area detector** — identifies vulnerability classes the researcher consistently misses.
34996. **Practice target recommender** — suggests labs and intentionally vulnerable apps for weak areas.
34997. **Lab environment launcher** — spins up disposable vulnerable targets for safe practice.
34998. **CVE-to-practice mapper** — links recent CVEs to practice labs exercising the same flaw class.
34999. **Writeup recommender** — suggests writeups matching the researcher's current focus areas.
35000. **Conference talk tracker** — follows talks and workshops relevant to the researcher's specialties.
35001. **Certification goal tracker** — plans study milestones for security certifications.
35002. **Public profile page builder** — creates a polished public hunter page with verified stats.
35003. **Anonymous mode toggle** — hides identity across hunts, reports, and leaderboards with one switch.
35004. **Data export for portability** — exports all preferences, history, and findings in a portable format.
