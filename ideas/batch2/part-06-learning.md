# Part 06 — Learning & memory systems

0001. **Payload effectiveness decay model** — tracks each payload's hit-rate over time and auto-deprioritizes payloads whose effectiveness decays (indicating patched vuln classes or improved WAFs), with half-life per vuln class.
0002. **Payload genealogy tree** — records which payload mutations descended from which parent payloads so credit for a finding flows back to the originating lineage and winning families can be bred further.
0003. **Vulnerability knowledge graph** — builds a graph linking tech stacks → vuln classes → payloads → findings, enabling queries like "what works against Laravel 10 + Cloudflare?" with confidence scores.
0004. **Strategy A/B tester** — runs two hunt strategies against similar targets and statistically compares finding velocity, auto-promoting the winner to default.
0005. **Per-payload context success matrix** — learns which payload works in which response context (reflected in HTML vs JS string vs SQL error page) and reorders candidates per context instead of using a global ranking.
0006. **Payload family clustering** — groups payloads by structural similarity (token shingles) so a win for one member lifts the prior of its whole family during the current hunt.
0007. **Mutation operator win-rate ledger** — tracks which mutation operators (encoding, case-flip, comment injection, polyglot wrapping) historically produce working exploits per vuln class and biases the fuzzer toward high-yield operators.
0008. **Negative payload cache** — remembers payload+context pairs that provably failed (with proof, not timeouts) and skips them within the same fingerprint to avoid burning requests on dead ends.
0009. **Payload resurrection queue** — periodically re-tests long-retired payloads because frameworks regress; a payload that failed for six months may work again after a dependency upgrade.
0010. **Finding-to-payload credit assignment** — when a chained exploit succeeds, distributes credit across every payload in the chain proportionally to its marginal contribution, training a reinforcement signal for future chain planning.
0011. **Payload brittleness score** — measures how often a payload that works stops working after trivial target changes (header tweaks, version bumps) and prefers robust payloads for the first exploitation pass.
0012. **Encoding-layer learning** — learns which encoding layers (URL, double-URL, unicode, HTML entity, base64-in-parameter) bypass which WAF fingerprints and applies the right layer before trying more payloads.
0013. **WAF fingerprint → payload filter map** — stores observed WAF responses per target fingerprint and retrieves the subset of payloads historically known to pass that exact WAF family.
0014. **Payload length vs success curve** — learns the optimal payload length per injection point (shorter often wins in length-limited fields) and truncates or selects accordingly instead of always sending maximal payloads.
0015. **Polyglot payload effectiveness tracking** — tracks which polyglot payloads (valid in multiple contexts simultaneously) actually convert into findings and prioritizes them at ambiguous injection points.
0016. **Second-order payload memory** — remembers payloads that only trigger on second-order effects (stored XSS, delayed SQL) and schedules the follow-up verification read automatically rather than marking them failed.
0017. **Time-based payload outcome correlation** — correlates slow responses with time-based injection payloads and learns per-target baseline latency so blind payloads get accurate sleep thresholds.
0018. **Payload ordering optimizer** — learns the optimal send order of payload batches (highest expected information gain first) using historical conversion data per vuln class and target type.
0019. **Canary payload set** — maintains a tiny set of ultra-reliable payloads used to calibrate whether a target is even injectable before committing to a full fuzz run.
0020. **Payload-to-finding latency ledger** — records how many requests each finding historically required from first probe to confirmation, letting the planner budget request counts per vuln class realistically.
0021. **Failed-exploit autopsy log** — stores near-miss payloads (reflected but sanitized, error without data) with the sanitization observed, so the mutator learns which filter to attack next instead of retrying blindly.
0022. **Filter fingerprint learner** — infers the active sanitization rules from how probes are transformed (lowercased, stripped tags, escaped quotes) and generates payloads specifically shaped to dodge the inferred filter.
0023. **Payload diversity controller** — ensures each batch contains structurally diverse payloads rather than 50 near-identical variants, maximizing coverage per request budget.
0024. **Historical payload de-duplication** — across hunts on the same target, never resends a payload+parameter pair already proven ineffective unless the target fingerprint changed.
0025. **Payload success seasonality** — detects that certain payload classes spike in effectiveness at specific times (e.g., after major framework releases introduce regressions) and boosts their priority in those windows.
0026. **Template-injection dialect memory** — remembers which template engine dialects (Twig, Jinja2, Smarty, Blade) each payload targets and only deploys dialect-matched payloads once the engine is fingerprinted.
0027. **SSTI probe escalation ladder** — learns the minimal escalation path from detection (`{{7*7}}`) to RCE per engine from past hunts and skips straight to the known-working ladder.
0028. **XXE payload variant bank** — tracks which XXE variants (external entity, parameter entity, XInclude, SVG-based) succeed per parser library and version, selecting the variant with the best historical odds first.
0029. **SSRF bypass technique ranking** — ranks SSRF bypass techniques (DNS rebinding, decimal IP, redirect chains, 0.0.0.0 variants) by historical success against each cloud provider's metadata endpoint protections.
0030. **Deserialization gadget memory** — remembers which gadget chains worked against which library versions (Java, PHP, Python pickle, .NET) and proposes the version-matched chain before generic fuzzing.
0031. **JWT attack playbook learner** — learns which JWT attacks (alg=none, key confusion, kid injection, jku spoofing) succeed per observed token profile and orders attempts by historical conversion.
0032. **IDOR pattern memory** — stores IDOR-prone endpoint shapes (sequential IDs in /api/v2/orders/{id}) per industry and pre-generates object-reference swap tests for matching new endpoints.
0033. **Race condition timing profiles** — learns the request-timing windows that historically won race conditions per target infrastructure and replays the winning cadence first.
0034. **Business-logic flaw template library** — accumulates abstract logic-flaw templates (price manipulation, coupon stacking, negative quantity) with the parameter shapes that carried them, instantiated per new target.
0035. **Auth bypass sequence memory** — remembers multi-step auth bypass sequences (parameter pollution + header injection + method override) that worked and replays the sequence shape on similar login flows.
0036. **File-upload bypass ranking** — ranks upload bypass techniques (double extension, MIME spoof, polyglot, null byte legacy) per observed upload handler stack and tries the top-ranked first.
0037. **Command injection separator learning** — learns which command separators (`;`, `|`, `&&`, newline, backticks) survive each target's filtering and leads with the historically surviving separator.
0038. **LDAP/XPath injection dialect tracking** — tracks which query-language injection payloads work per backend directory/query engine observed in past findings.
0039. **NoSQL operator injection memory** — remembers which NoSQL operators (`$ne`, `$gt`, `$where`, `$regex`) bypassed which ODM/framework combos and prioritizes them on matching stacks.
0040. **GraphQL abuse pattern library** — accumulates GraphQL-specific attack patterns (introspection-enabled, batching brute force, deep query DoS, field suggestion leaks) with per-implementation success rates.
0041. **CORS misconfiguration signature memory** — learns which CORS misconfigurations (reflected origin, null origin, subdomain trust) appear with which framework CORS middlewares and tests the likely one first.
0042. **Open redirect gadget memory** — stores redirect gadget chains (whitelisted-domain bypass via `//evil.com`, parameter smuggling) that worked per framework router.
0043. **CSRF token weakness profiles** — learns per-framework CSRF token weaknesses observed (static tokens, missing validation on state-changing GETs) and checks the historically weak spot first.
0044. **Clickjacking frame-buster detection memory** — remembers which frame-busting bypasses worked per observed header combination and replays them before declaring the target protected.
0045. **Subdomain takeover signature evolution** — tracks which takeover signatures (dangling CNAME patterns per provider) still convert, retiring signatures for providers that fixed their dangling-record behavior.
0046. **Secrets pattern hit-rate ledger** — tracks which secret regexes/entropy detectors produce true positives per file type and hosting context, tuning thresholds per context to cut noise.
0047. **Dependency vuln reachability memory** — learns which dependency findings historically proved reachable (actually imported, exposed route) vs theoretical, and prioritizes reachability checks that previously confirmed exploitability.
0048. **Prototype pollution gadget ranking** — ranks prototype pollution gadgets per JS framework/library observed and leads with the gadget that historically escalated to XSS or RCE on that stack.
0049. **HTTP request smuggling technique memory** — remembers which smuggling variants (CL.TE, TE.CL, TE.TE with obfuscation) worked per server/proxy combo fingerprint and tries the historically winning variant first.
0050. **Cache poisoning key memory** — learns which unkeyed inputs (headers, parameters) historically poisoned caches per CDN fingerprint and targets those inputs first on matching CDNs.
0051. **Web cache deception path memory** — stores path-confusion patterns that historically returned cached authenticated responses per framework static-file handling.
0052. **Host header attack outcome memory** — tracks which host-header attacks (password reset poisoning, cache poisoning via host) worked per framework and mailer setup.
0053. **OAuth flow flaw templates** — accumulates OAuth/OIDC flaw templates (redirect_uri bypass, code leakage, state fixation) with the provider quirks that made each work.
0054. **SAML parsing quirk memory** — remembers SAML signature-verification bypass quirks per identity provider library version and tests the version-matched quirk first.
0055. **2FA bypass technique ranking** — ranks 2FA bypass techniques (response manipulation, backup-code brute force, rate-limit gaps) by historical success per 2FA implementation observed.
0056. **Password reset token entropy learning** — learns token patterns per framework (timestamp-based, short, predictable PRNG) from past findings and predicts weak token schemes on similar stacks.
0057. **Username enumeration oracle memory** — remembers which oracles (timing, message diff, status code) revealed enumeration per login implementation and probes the historically leaking oracle first.
0058. **Rate-limit bypass pattern memory** — stores rate-limit bypass patterns (header spoofing, IP rotation via headers, endpoint variants) that worked per rate-limiter fingerprint.
0059. **Mass assignment field memory** — learns which hidden fields (role, is_admin, balance) were mass-assignable per framework/ORM and auto-generates candidate fields on similar stacks.
0060. **API versioning flaw patterns** — remembers flaws tied to API versioning (v1 unprotected while v2 is, deprecated endpoints with old vulns) and checks old versions first on versioned APIs.
0061. **HTTP method override memory** — tracks which method-override headers/methods bypassed access controls per framework and replays them on new targets with matching stacks.
0062. **Parameter pollution effect memory** — learns how each backend language/framework handles duplicate parameters (first wins, last wins, array) from past findings and crafts pollution payloads for the observed behavior.
0063. **Cookie security misconfig memory** — remembers which cookie misconfigurations (missing flags, overly broad domain, JWT in localStorage) correlated with session hijack findings per stack.
0064. **Session fixation pattern memory** — tracks session fixation vectors that worked per session-management implementation and tests the historically working vector first.
0065. **Privilege escalation path memory** — stores observed escalation paths (low-priv API → admin function via missing check) as graph patterns reused to guide testing on similar RBAC layouts.
0066. **Tenant isolation flaw templates** — accumulates multi-tenant isolation flaw templates (tenant ID in JWT vs URL mismatch) with the SaaS shapes where they appeared.
0067. **Webhook SSRF vector memory** — remembers webhook/URL-fetch features that yielded SSRF per product category and prioritizes testing URL inputs in similar features.
0068. **PDF/Office generation SSRF memory** — tracks server-side document generation features that fetched remote URLs (wkhtmltopdf, headless Chrome) per stack and tests them with metadata-endpoint payloads first.
0069. **Image processing vuln memory** — remembers image-processing library vulns (ImageMagick, libvips) per observed version and pairs them with upload features found during recon.
0070. **Archive extraction flaw memory** — tracks zip-slip and symlink attacks that worked per extraction library and tests archive upload features with the historically winning payload.
0071. **CSV formula injection context memory** — learns which export features produce formula-executable CSVs per framework and tests the payload shapes that previously executed.
0072. **Log injection pattern memory** — remembers log-injection-to-RCE or log-poisoning chains per logging stack observed and replays the chain shape on similar stacks.
0073. **CRLF injection outcome memory** — tracks which CRLF vectors (header injection, log splitting) worked per server/framework and the response-splitting payloads that converted.
0074. **HTTP/2-specific attack memory** — learns HTTP/2-specific issues (request smuggling via downgrade, rapid reset) per server version fingerprint and tests version-matched vectors first.
0075. **WebSocket vuln pattern memory** — accumulates WebSocket flaws (missing origin check, CSRF over WS, message confusion) per WS library and tests the historically common flaw first.
0076. **PostMessage handler flaw memory** — remembers postMessage origin-validation flaws per observed JS bundle patterns and generates targeted origin-spoof tests.
0077. **DOM clobbering gadget memory** — tracks DOM-clobbering gadgets per library (e.g., HTML sanitizer bypasses) and replays them on pages using the same library version.
0078. **Client-side prototype pollution sink memory** — learns which client-side sinks were reachable per framework and prioritizes pollution payloads aimed at those sinks.
0079. **Electron app attack memory** — remembers Electron-specific issues (nodeIntegration, preload bypasses) per Electron version observed in desktop-adjacent targets.
0080. **Mobile API backend flaw memory** — tracks flaws specific to mobile backends (device-ID trust, missing cert pinning checks server-side) per BaaS fingerprint.
0081. **GraphQL→REST translation flaw memory** — learns flaws in GraphQL gateways that translate to REST backends (auth dropped in translation) per gateway product.
0082. **gRPC attack pattern memory** — accumulates gRPC-specific tests (reflection abuse, method enumeration) per framework (grpc-go, grpc-java) with historical hit rates.
0083. **Thick-client API flaw memory** — remembers flaws in APIs serving thick clients (over-trusted client validation) per client framework observed.
0084. **Payment flow flaw templates** — stores payment manipulation templates (currency switch, amount tampering, race on checkout) with the gateway quirks that made each work.
0085. **Promo/loyalty abuse templates** — accumulates loyalty-point and promo-code abuse patterns per e-commerce platform with historical conversion data.
0086. **Search injection pattern memory** — learns which search backends (Elasticsearch, Solr, Algolia) leaked data via query injection per observed search behavior.
0087. **Autocomplete info-disclosure memory** — remembers autocomplete/suggestion endpoints that leaked PII per framework and tests them with prefix enumeration first.
0088. **Error message intel memory** — learns which error messages historically preceded findings (stack traces, SQL errors, debug pages) and escalates targets emitting them.
0089. **Debug endpoint pattern memory** — stores debug/admin endpoint paths that yielded access per framework (/.env, /debug, /actuator) with hit rates per stack.
0090. **Backup file discovery memory** — tracks which backup/config file names were found per deployment pattern (Capistrano, Docker, CI artifacts) and prioritizes those paths on matching deployments.
0091. **Git metadata exposure memory** — remembers /.git exposure findings per hosting setup and the extraction techniques that converted them into source leaks.
0092. **CI artifact leak memory** — tracks CI/CD artifact exposures (Jenkins, GitLab CI, GitHub Actions artifacts) per observed header/behavior fingerprint.
0093. **Container escape indicator memory** — learns container-escape-relevant misconfigurations per observed orchestration fingerprint (exposed Docker socket, K8s API).
0094. **Cloud metadata SSRF memory** — stores cloud-metadata SSRF chains per cloud provider fingerprint with the exact endpoint paths that historically returned credentials.
0095. **Storage bucket misconfig memory** — remembers bucket misconfiguration patterns per provider (S3, GCS, Azure Blob) and the enumeration techniques that found them.
0096. **DNS misconfiguration memory** — tracks DNS issues (zone transfer, dangling records, subdomain brute-force hits) per DNS provider fingerprint.
0097. **Email security misconfig memory** — learns SPF/DKIM/DMARC misconfigurations per mail provider that historically enabled spoofing findings.
0098. **Subresource integrity gap memory** — remembers SRI-missing third-party script inclusions per observed bundling practice and flags them with historical exploitability rates.
0099. **Dependency confusion pattern memory** — tracks dependency-confusion-susceptible package scopes per language ecosystem and registry behavior observed.
0100. **Typosquat-adjacent risk memory** — learns which internal package names were guessable per observed naming convention, informing targeted namespace probing.
0101. **Knowledge graph schema versioning** — versions the vuln knowledge graph schema so old hunts' data migrates cleanly when new node types (e.g., AI-agent tool-call vulns) are added, preventing silent query breakage.
0102. **Typed edge confidence propagation** — propagates confidence along graph edges with type-specific decay (stack→vuln edges decay slower than payload→finding edges), so multi-hop queries stay calibrated.
0103. **Graph neighborhood prefetch** — when a target fingerprint matches a graph node, prefetches the 2-hop neighborhood (related vulns, payloads, WAF notes) into the hunt planner's working memory before testing starts.
0104. **Counterfactual graph edges** — stores "would-have-worked" edges from near-misses so the planner can ask what payload would have succeeded if one filter were absent, guiding filter-bypass generation.
0105. **Embedding-based vuln similarity** — embeds finding descriptions into vectors and retrieves historically similar findings to suggest the exploitation path that worked last time for the same shape.
0106. **Tech-stack co-occurrence matrix** — learns which technologies appear together (Next.js + Vercel + Prisma) and transfers priors from the bundle, not just individual stack items.
0107. **Vuln class ontology with inheritance** — organizes vuln classes in an inheritance tree so learnings about "injection" partially transfer to children like SQLi, XSS, and SSTI without conflating them.
0108. **Attack surface schema memory** — stores per-target-type endpoint schemas (routes, params, methods) as reusable templates so new targets of the same product get instant structural priors.
0109. **Finding deduplication graph** — links findings across hunts that are the same root cause (same vuln, re-hunted) so metrics and learning count unique vulns, not repeated observations.
0110. **Parameter role taxonomy** — learns a taxonomy of parameter roles (identifier, quantity, price, redirect, callback, sort) with per-role vuln priors so unseen parameters get instant risk scores by role.
0111. **Endpoint role classifier memory** — remembers endpoint roles (auth, admin, export, upload, webhook, search) and their historically observed vuln distributions, applied to newly discovered endpoints by role.
0112. **Response archetype library** — clusters HTTP responses into archetypes (SPA shell, JSON API error, server-rendered form) with per-archetype testing playbooks learned from past hunts.
0113. **Header constellation memory** — learns which header combinations (Server + X-Powered-By + cookie names) identify exact stack versions better than any single header, improving fingerprint precision.
0114. **JavaScript bundle signature memory** — stores hashes/signatures of common JS bundles (framework versions, vulnerable libraries) seen in past hunts for instant client-side tech identification.
0115. **Cookie name → stack inference** — learns mappings from cookie/session names (laravel_session, connect.sid, JSESSIONID) to stacks, giving fingerprint evidence even when headers are stripped.
0116. **Error page fingerprint bank** — stores distinctive error page bodies per framework version so a 500 page alone can identify Django 4.2 vs 5.0 from past observations.
0117. **Favicon hash → tech memory** — remembers favicon hashes mapped to frameworks/CMSs from past recon, enabling identification when all other signals are hidden.
0118. **TLS/JA3 stack hints memory** — learns correlations between TLS fingerprints and backend stacks observed historically, adding a passive fingerprinting channel.
0119. **DNS record pattern memory** — stores DNS configurations (TXT, CNAME chains) that historically revealed tech stacks or takeover opportunities per provider.
0120. **Robots/sitemap intel memory** — learns which sitemap/robots entries historically exposed admin paths or staging hosts per CMS/platform.
0121. **Changelog/version leak memory** — remembers version-disclosure locations (headers, /version, JS comments, package.json leaks) per stack so new targets get checked at the historically leaking spots first.
0122. **Default credential pair memory** — stores default credentials that worked per product (not brute-forcing blindly), scoped to explicit user authorization for credentialed testing.
0123. **Admin path dictionary evolution** — evolves the admin-path wordlist per CMS/framework based on which paths historically hit, pruning dead paths and promoting winners.
0124. **Hidden parameter name memory** — accumulates hidden/debug parameter names (debug, _method, __proto__, admin) that worked per framework and injects them into param mining on matching stacks.
0125. **API documentation endpoint memory** — remembers doc endpoint paths (/swagger.json, /openapi.yaml, /graphql) per framework with hit rates, so recon checks the historically present paths first.
0126. **Source map exposure memory** — tracks source-map exposures per build tool (webpack, Vite, Next.js) and the secrets/endpoints historically extracted from them.
0127. **Environment file path memory** — stores .env/config exposure paths per deployment style with historical success rates guiding the discovery order.
0128. **Backup naming convention memory** — learns backup file naming conventions per platform (.bak, ~, .old, timestamped) that historically yielded config leaks.
0129. **Directory listing signature memory** — remembers directory-listing page signatures per server and the sensitive files historically found inside listings.
0130. **Virtual host discovery memory** — learns vhost naming patterns per organization type from past hunts to guide targeted vhost fuzzing.
0131. **Subdomain naming convention memory** — stores subdomain patterns (dev-, staging-, api-, internal-) per industry with historical hit rates for takeover or staging exposure.
0132. **Certificate transparency mining memory** — remembers CT-log-derived subdomain patterns that historically revealed forgotten assets per target profile.
0133. **ASN/IP-range association memory** — learns which IP ranges/ASNs historically hosted a target's infrastructure, focusing port/service scanning on the learned ranges.
0134. **Port → service → vuln chaining memory** — stores which open ports historically led to which services and then which findings, enabling port-scan results to seed web-testing priorities.
0135. **Service banner → exploit mapping** — maps service banners to historically successful exploit paths per version, kept current through decay when vendors patch.
0136. **Technology EOL awareness** — tracks end-of-life dates for frameworks/libraries and boosts testing priority on EOL components where unpatched vulns accumulate.
0137. **CVE-to-stack applicability memory** — remembers which CVEs historically applied to which observed stack fingerprints, so version detection immediately surfaces relevant CVE checks.
0138. **Patch-gap timing memory** — learns the typical delay between a CVE disclosure and a target class patching, prioritizing fresh-CVE checks in the window where targets are statistically unpatched.
0139. **Exploit-kit-free technique memory** — stores manual exploitation techniques per CVE that worked when automated scanners failed, preserving human-grade tradecraft.
0140. **N-day regression memory** — tracks N-day vulns that reappear after upgrades (regressions) per product, re-testing historically regressing vulns on version changes.
0141. **Configuration drift baseline memory** — stores per-target configuration baselines (headers, TLS, exposed paths) and flags drift between hunts as a trigger for re-testing config-sensitive vulns.
0142. **Staging-vs-prod divergence memory** — learns how staging environments historically differ from prod (weaker auth, debug on) and applies staging-specific test profiles when a staging host is found.
0143. **CDN behavior profile memory** — stores per-CDN caching/header behaviors learned from past hunts to predict cache-deception and poisoning viability.
0144. **WAF rule-update detection memory** — learns each observed WAF's rule-update cadence from blocking-behavior changes, timing heavy fuzzing for windows after updates settle.
0145. **Bot-detection evasion memory** — remembers which evasion techniques (TLS fingerprint rotation, request pacing, header ordering) bypassed which bot-detection systems historically.
0146. **Honeypot signature memory** — stores honeypot/tarpit signatures encountered (fake vulns, infinite redirects) so the agent recognizes and deprioritizes them instead of burning budget.
0147. **Tarpit response memory** — learns which endpoints historically tarpit scanners (slowloris-like delays) and routes around them with minimal probing.
0148. **Rate-limit threshold memory** — remembers observed rate limits per endpoint type and target, pacing requests just under the learned threshold to avoid lockouts.
0149. **IP block recovery memory** — learns how long IP blocks last per target class and what behavior triggered them, adjusting future pacing to stay under the learned tripwire.
0150. **Session lifecycle memory** — learns session timeout and rotation behaviors per app so long hunts re-authenticate before sessions die mid-exploitation.
0151. **CSRF token lifecycle memory** — remembers token rotation rules per framework (per-request vs per-session) so automated exploit replays fetch fresh tokens correctly.
0152. **Multi-step flow state memory** — stores state-machine models of multi-step flows (checkout, onboarding) learned from past hunts to enable state-aware logic testing.
0153. **Business rule inference memory** — learns inferred business rules (max transfer, coupon limits) per app category and generates rule-violation tests automatically.
0154. **Currency/locale edge-case memory** — remembers locale/currency handling flaws per e-commerce platform (comma vs dot decimals, currency switching) with historical conversion data.
0155. **Timezone handling flaw memory** — tracks timezone-related logic flaws (coupon expiry, auction end) per framework datetime handling observed.
0156. **Pagination/IDOR hybrid memory** — learns pagination implementations that leaked cross-user data per framework and tests cursor/offset manipulation first on matching APIs.
0157. **Search ranking manipulation memory** — remembers search/ordering parameters that enabled data exfiltration or DoS per search backend.
0158. **Export feature abuse memory** — tracks export/report features that leaked data or enabled SSRF per reporting library observed.
0159. **Import feature abuse memory** — learns file-import features (CSV/XML/Excel) that yielded XXE or formula injection per parser library.
0160. **Avatar/upload processing chain memory** — stores image-processing chains (resize → convert → store) per stack and the historically successful malicious-image payloads for each stage.
0161. **Video/audio processing memory** — remembers media-processing vulns (ffmpeg, sox) per observed version and pairs them with upload features.
0162. **Document conversion memory** — tracks document-conversion features (HTML→PDF, DOCX→PDF) that yielded SSRF/RCE per converter library.
0163. **Email template injection memory** — learns email-template rendering engines per product and the injection payloads that historically executed in them.
0164. **SMS/OTP flow flaw memory** — remembers OTP implementation flaws (no expiry, predictable, reusable) per provider/implementation observed.
0165. **Notification system abuse memory** — tracks push/email notification features abused for spam or header injection per framework.
0166. **Comment/review feature flaw memory** — learns stored-XSS-prone rich-text implementations per editor library (TinyMCE, CKEditor, Quill) and version.
0167. **WYSIWYG sanitizer bypass memory** — stores sanitizer bypasses per HTML sanitizer library version (DOMPurify, sanitize-html) with historical success data.
0168. **Markdown rendering flaw memory** — remembers markdown renderer XSS vectors per library (marked, showdown) and version.
0169. **BBCode/shortcode injection memory** — tracks legacy BBCode/shortcode parsers with injection flaws per forum/CMS platform.
0170. **Emoji/unicode handling flaw memory** — learns unicode normalization flaws (homoglyph, overlong UTF-8, case mapping) per language/framework.
0171. **Filename handling flaw memory** — remembers filename-based attacks (path traversal via filename, null byte, unicode) per upload handler.
0172. **Archive format quirk memory** — tracks archive parser quirks (zip, tar, 7z, rar) per library that historically enabled traversal or symlink attacks.
0173. **Compression bomb indicator memory** — learns decompression-bomb-susceptible endpoints per library to avoid self-DoS while testing.
0174. **Regex DoS pattern memory** — stores ReDoS-vulnerable regex patterns per validation library and the crafted inputs that historically triggered catastrophic backtracking.
0175. **Hash collision DoS memory** — remembers hash-flooding-susceptible parameter handling per language runtime version.
0176. **Algorithmic complexity memory** — tracks endpoints with superlinear complexity per framework (deep JSON, nested includes) for controlled DoS-resistance probing within authorized limits.
0177. **GraphQL depth/complexity memory** — learns query-complexity bypasses per GraphQL server implementation with historical success rates.
0178. **REST nested-include abuse memory** — remembers ?include= recursion flaws per ORM/serializer (Rails, Django, Laravel) that caused data leaks or DoS.
0179. **JSON parsing differential memory** — tracks JSON parser differentials (duplicate keys, big numbers, deep nesting) per language that historically caused logic flaws.
0180. **XML parser differential memory** — learns XML parser behavior differences per library (entity handling, DTD) guiding XXE variant selection.
0181. **YAML deserialization memory** — remembers YAML parser unsafe-load issues per library/language version with historical exploit data.
0182. **Pickle/marshal format memory** — tracks unsafe deserialization entry points per Python/Ruby framework with the gadget chains that worked.
0183. **PHP unserialize gadget memory** — stores PHP object-injection gadgets per CMS/plugin version with historical conversion rates.
0184. **Java deserialization gadget memory** — remembers Java gadget chains per library (CommonsCollections, etc.) with version-specific applicability.
0185. **.NET deserialization memory** — tracks .NET deserialization vectors (BinaryFormatter, ViewState) per framework version with historical success.
0186. **Node.js deserialization memory** — learns node-serialize and similar vectors per Express middleware stack observed.
0187. **JWT library quirk memory** — stores JWT library-specific quirks (none-alg acceptance, kid path traversal) per library version.
0188. **OAuth library flaw memory** — remembers OAuth client/server library flaws per version with the flows that were exploitable.
0189. **SAML library quirk memory** — tracks SAML library signature-bypass quirks per version guiding targeted tests.
0190. **Session serializer memory** — learns session serialization formats per framework and the tampering vectors that historically worked.
0191. **Cache key collision memory** — remembers cache-key construction flaws per framework/CDN that enabled poisoning or deception.
0192. **CDN edge-rule abuse memory** — tracks edge-rule misconfigurations (header injection via edge logic, path rewrites) per CDN provider.
0193. **Origin validation flaw memory** — learns origin/Host validation flaws per reverse-proxy setup (nginx, HAProxy, Cloudflare) with bypass techniques that worked.
0194. **Proxy header trust memory** — remembers X-Forwarded-For/Host trust issues per proxy chain observed, guiding IP-spoof and cache-poison tests.
0195. **Request smuggling via CDN memory** — tracks desync vectors through specific CDN→origin combinations with historical success data.
0196. **HTTP/3/QUIC quirk memory** — learns HTTP/3-specific behaviors per server implementation relevant to smuggling or cache attacks.
0197. **TLS misconfiguration memory** — remembers TLS issues (weak ciphers, expired certs, SNI quirks) per hosting setup with historical finding rates.
0198. **HSTS/preload gap memory** — tracks HSTS misconfigurations per deployment that historically enabled SSL-stripping-adjacent findings.
0199. **Certificate issue memory** — learns certificate problems (wildcard overreach, internal names) per CA/issuer pattern with historical intel value.
0200. **Security.txt/humans.txt intel memory** — remembers contact/policy disclosures per target class that historically revealed scope or bug-bounty program details.
0201. **Framework version → vuln prior table** — maintains a learned table mapping exact framework versions to the vuln classes most often found on them, so fingerprinting Laravel 9.3 instantly reorders the test plan.
0202. **New-version cold inference** — when an unseen framework version appears, interpolates priors from adjacent versions' historical data instead of starting from a flat uniform prior.
0203. **Stack-drift early warning** — detects when a re-hunted target's stack changed (new framework, added CDN) and triggers a focused differential test plan on the changed components only.
0204. **Plugin/theme version memory** — learns which CMS plugin/theme versions historically carried vulns per CMS, so version detection immediately surfaces plugin-specific checks.
0205. **Transitive dependency risk memory** — remembers which transitive dependencies historically introduced vulns (via lockfile/source leaks) per ecosystem, prioritizing reachability analysis on them.
0206. **CDN-added attack surface memory** — learns how adding a specific CDN historically changed a target's attack surface (new cache attacks, WAF changes) and adjusts the plan when CDN adoption is detected.
0207. **WAF-added blind-spot memory** — tracks which vuln classes historically became harder/easier to detect after a specific WAF was added, rebalancing test effort accordingly.
0208. **Framework migration flaw memory** — remembers flaws introduced during framework migrations (mixed old/new auth, leftover endpoints) per migration pair observed.
0209. **Monolith→microservice split memory** — learns auth-boundary flaws that historically appeared when monoliths split into services (trust between services, exposed internal APIs).
0210. **SPA migration artifact memory** — tracks leftover server-rendered endpoints with old vulns after SPA migrations per framework pair.
0211. **Similar-target transfer engine** — computes target similarity (stack, industry, size, region) and transfers the full learned test plan from the most similar past target as the starting plan.
0212. **Cross-target payload warm start** — seeds a new hunt's payload ordering with the payload rankings learned from the K most similar past targets instead of global defaults.
0213. **Industry transfer profiles** — builds per-industry testing profiles from all past hunts in that industry (fintech→logic flaws, healthcare→IDOR/PHI, e-commerce→payment flaws) applied at hunt start.
0214. **Target-size test scaling** — learns how test-plan depth should scale with target size (startup vs enterprise) from historical findings-per-request curves, avoiding over/under-testing.
0215. **Region-specific pattern transfer** — learns regional deployment patterns (common local hosting providers, popular regional frameworks) and transfers their associated vuln priors.
0216. **Language-locale prior transfer** — transfers priors learned on same-language targets (e.g., Hindi-language apps' common stacks) where framework popularity correlates with locale.
0217. **Bounty-program scope learning** — learns from past hunts which asset types in a program scope historically yielded findings, focusing effort on high-yield asset classes.
0218. **Program-response pattern memory** — remembers how specific programs historically triaged (fast on XSS, slow on logic) to calibrate report emphasis — purely from public/observed data, never private.
0219. **Duplicate-pattern transfer** — learns which finding shapes were historically marked duplicates per program type and de-emphasizes them early to save testing budget.
0220. **Out-of-scope pattern memory** — learns recurring out-of-scope shapes per program type (e.g., marketing sites) and avoids burning requests there.
0221. **Subdomain-role transfer** — transfers learned test plans by subdomain role (api., app., admin., dev.) across targets, since api.* subdomains share flaw distributions regardless of company.
0222. **Environment-role transfer** — applies staging/dev-specific test profiles learned across all past staging hosts to any newly discovered staging host.
0223. **Acquired-company stack memory** — remembers stacks of acquired subsidiaries historically lagging in patching, prioritizing them when corporate-structure recon reveals acquisitions.
0224. **Vendor-product fingerprint transfer** — when recon identifies a third-party product (helpdesk, forum, CRM), instantly loads the learned vuln profile for that product version from past hunts.
0225. **White-label product detection memory** — learns to recognize white-labeled SaaS products from behavioral fingerprints and transfers the base product's vuln priors.
0226. **Shared-codebase correlation** — detects when multiple targets share a codebase (same JS bundle hashes, same error strings) and transfers findings bidirectionally between them.
0227. **Template-boilerplate flaw memory** — remembers flaws in popular starter templates/boilerplates (create-react-app variants, SaaS starters) that propagate to every target built from them.
0228. **Low-code platform flaw profiles** — builds vuln profiles per low-code platform (Retool, Bubble, Webflow) from past hunts and applies them when the platform is fingerprinted.
0229. **Headless CMS flaw profiles** — learns flaw distributions per headless CMS (Strapi, Contentful, Sanity) including API-key exposure patterns.
0230. **E-commerce platform profiles** — builds per-platform (Shopify, WooCommerce, Magento) flaw profiles including app/plugin-layer vulns from historical data.
0231. **Forum software profiles** — learns per-forum-software (Discourse, phpBB, Flarum) vuln patterns including plugin ecosystems.
0232. **Helpdesk software profiles** — tracks per-helpdesk-product (Zendesk, Freshdesk, Intercom) misconfigurations like exposed ticket APIs.
0233. **Analytics platform leakage profiles** — learns which analytics setups historically leaked PII or exposed keys per provider.
0234. **Chat widget flaw profiles** — remembers chat-widget (Intercom, Drift, Crisp) misconfigurations per product from past hunts.
0235. **Payment provider integration profiles** — learns per-payment-provider (Stripe, Razorpay, PayU) integration flaws observed in merchant implementations.
0236. **Auth provider misconfig profiles** — tracks per-OAuth-provider (Auth0, Firebase, Cognito, Clerk) misconfigurations seen in client implementations.
0237. **CDN provider flaw profiles** — builds per-CDN-provider misconfiguration profiles (open S3-style buckets, cache rules) from historical findings.
0238. **Cloud provider misconfig profiles** — learns per-cloud-provider (AWS, GCP, Azure) web-exposed misconfigurations with historical frequency.
0239. **DNS provider flaw profiles** — tracks per-DNS-provider takeover or misconfiguration patterns from past recon.
0240. **Email provider flaw profiles** — learns per-email-provider (SendGrid, Mailgun) API-key exposure and webhook verification flaws.
0241. **SMS provider flaw profiles** — remembers per-SMS-provider OTP implementation weaknesses observed in client apps.
0242. **Storage provider flaw profiles** — tracks per-object-storage-provider bucket/policy misconfigurations with historical hit rates.
0243. **CI provider leak profiles** — learns per-CI-provider (GitHub Actions, GitLab, Jenkins, CircleCI) secret/artifact exposure patterns.
0244. **Container registry flaw profiles** — remembers per-registry (Docker Hub, ECR, GCR) exposure patterns for private images.
0245. **Kubernetes dashboard profiles** — tracks exposed K8s dashboards/APIs per distribution with historical exploitability.
0246. **Service mesh misconfig profiles** — learns per-service-mesh (Istio, Linkerd) exposure patterns from past infra-adjacent findings.
0247. **API gateway flaw profiles** — builds per-gateway (Kong, Apigee, AWS API GW) misconfiguration profiles including auth-bypass quirks.
0248. **WAF product bypass profiles** — maintains per-WAF-product (Cloudflare, Akamai, Imperva, ModSecurity) bypass technique rankings learned from successful evasions.
0249. **Bot manager bypass profiles** — learns per-bot-manager (PerimeterX, DataDome, Kasada) bypass techniques that historically worked.
0250. **Captcha implementation profiles** — tracks per-captcha-provider (reCAPTCHA, hCaptcha, Turnstile) implementation flaws in client integrations.
0251. **Fraud tool bypass memory** — remembers client-side fraud-tool (FingerprintJS, Sift) trust issues per implementation.
0252. **AB-test framework leakage profiles** — learns per-experimentation-platform (Optimizely, LaunchDarkly) flag/config exposures.
0253. **Feature flag exposure profiles** — tracks exposed feature-flag endpoints per provider with historical intel value.
0254. **Error tracker exposure profiles** — remembers exposed Sentry/Rollbar/Bugsnag projects leaking stack traces and keys per setup.
0255. **Status page intel profiles** — learns which status-page providers (Statuspage, Instatus) historically revealed infra details.
0256. **Documentation host profiles** — tracks per-docs-platform (ReadMe, GitBook, Docusaurus) exposure of internal docs or keys.
0257. **Survey/form builder profiles** — learns per-form-builder (Typeform, Jotform) misconfigurations exposing responses.
0258. **Scheduling tool exposure profiles** — remembers per-scheduling-tool (Calendly, Cal.com) exposure patterns for internal event data.
0259. **Video platform integration profiles** — tracks per-video-platform (Mux, Vimeo, Cloudflare Stream) signed-URL flaws in client implementations.
0260. **Map API key exposure profiles** — learns per-maps-provider (Google Maps, Mapbox) key-restriction bypass patterns from past findings.
0261. **Translation API exposure profiles** — remembers exposed translation API keys per provider with historical abuse potential.
0262. **AI API integration flaw profiles** — builds per-AI-provider (OpenAI, Anthropic, open models) client-integration flaw profiles: prompt injection sinks, key exposure, unvalidated tool calls.
0263. **LLM prompt-injection sink memory** — learns which app features historically acted as prompt-injection sinks per AI integration pattern, with payload shapes that worked.
0264. **RAG poisoning vector memory** — remembers retrieval-poisoning vectors per RAG implementation (uploaded docs, indexed URLs) with historical success data.
0265. **Agent tool-abuse pattern memory** — tracks AI-agent tool-call abuse patterns (unauthorized actions via prompt) per agent framework observed.
0266. **Model endpoint exposure profiles** — learns exposed model-inference endpoints per serving framework (vLLM, TGI, Ollama-exposed) with historical findings.
0267. **Vector DB exposure profiles** — remembers exposed vector databases (Pinecone, Weaviate, Qdrant) per deployment with data-leak history.
0268. **MCP server flaw profiles** — builds Model Context Protocol server flaw profiles (over-permissive tools, missing auth) as the ecosystem emerges.
0269. **AI plugin marketplace profiles** — tracks per-plugin-platform (GPT plugins, Copilot extensions) auth and data-flow flaws.
0270. **Voice assistant integration profiles** — learns per-voice-platform (Alexa, Dialogflow) webhook verification flaws from past findings.
0271. **IoT cloud backend profiles** — builds per-IoT-platform (AWS IoT, Tuya, Blynk) device-API flaw profiles including device-ID trust issues.
0272. **Smart home hub profiles** — remembers per-hub (Home Assistant, SmartThings) exposed-instance patterns with historical exploitability.
0273. **Fitness API integration profiles** — tracks per-fitness-API (Strava, Fitbit) OAuth and data-scope flaws in third-party clients.
0274. **Health data API profiles** — learns per-health-API (FHIR servers, EHR portals) IDOR/PHI exposure patterns with strict defensive framing.
0275. **Banking API profiles** — builds per-open-banking-implementation flaw profiles (consent bypass, scope escalation) from observed patterns.
0276. **Crypto exchange integration profiles** — remembers per-exchange-API (Binance, Coinbase) key-permission and withdrawal-flow flaws in third-party bots.
0277. **DeFi frontend profiles** — tracks per-DeFi-frontend (Uniswap forks, lending UIs) flaws like malicious token-list injection or approval phishing surfaces.
0278. **NFT marketplace profiles** — learns per-marketplace (OpenSea, Blur) listing/signature flaw patterns from historical findings.
0279. **Wallet integration flaw profiles** — remembers per-wallet-connector (WalletConnect, MetaMask snaps) dApp-side verification flaws.
0280. **Bridge protocol frontend profiles** — tracks cross-chain bridge UI flaws (address poisoning, fake token) per bridge product.
0281. **DAO governance UI profiles** — learns per-governance-platform (Snapshot, Tally) vote-manipulation or signature-replay surfaces.
0282. **Gaming backend profiles** — builds per-game-backend (PlayFab, Nakama, custom) flaw profiles: currency manipulation, matchmaking abuse.
0283. **Anti-cheat client trust profiles** — remembers server-side validation gaps per anti-cheat approach with historical exploitability.
0284. **Streaming platform profiles** — tracks per-streaming-backend (Twitch, custom RTMP) token and entitlement flaws.
0285. **EdTech platform profiles** — learns per-LMS (Moodle, Canvas, custom) flaw patterns including quiz/grade manipulation surfaces.
0286. **HR software profiles** — remembers per-HRIS (Workday, BambooHR, custom) IDOR and PII exposure patterns with defensive framing.
0287. **ATS (hiring) platform profiles** — tracks per-ATS (Greenhouse, Lever) resume-data exposure and webhook flaws.
0288. **CRM integration profiles** — learns per-CRM (Salesforce, HubSpot) custom-integration flaws like exposed APIs and weak webhooks.
0289. **ERP web module profiles** — remembers per-ERP (SAP Fiori, Odoo, NetSuite) web-module auth gaps from past findings.
0290. **Ticketing platform profiles** — tracks per-ticketing-system (Jira, Linear, custom) permission and attachment-access flaws.
0291. **Password manager web profiles** — learns per-password-manager (Bitwarden, 1Password) web-vault sharing and API flaws with careful defensive framing.
0292. **VPN portal profiles** — remembers per-VPN-portal (custom SSL-VPN web UIs) pre-auth RCE patterns from historical CVEs mapped to fingerprints.
0293. **Firewall web UI profiles** — tracks per-firewall-vendor web management flaws per version fingerprint.
0294. **NAS device web profiles** — learns per-NAS-vendor (Synology, QNAP) web UI flaw patterns per version.
0295. **Router web UI profiles** — remembers per-router-vendor admin UI flaws with version-matched CVE applicability.
0296. **Printer/MFP web profiles** — tracks per-printer-vendor embedded web server flaws from historical data.
0297. **Camera/NVR web profiles** — learns per-camera-vendor web UI auth bypass patterns per firmware fingerprint.
0298. **Industrial HMI web profiles** — remembers per-HMI/SCADA web interface flaws with strict authorized-target framing.
0299. **Building automation profiles** — tracks per-BMS-vendor web interface exposures from past authorized assessments.
0300. **Kiosk/tablet app backend profiles** — learns per-kiosk-platform backend flaws (device trust, local API exposure) from historical findings.
0301. **Finding staleness scorer** — assigns each stored finding a freshness score that decays with target changes and time, so re-hunt plans prioritize re-verifying stale high-severity findings first.
0302. **Intel half-life per category** — learns distinct decay half-lives for different intel types (payload effectiveness decays fast, stack priors decay slow) and applies the right curve when weighting old data.
0303. **Forgetting curve for payload memory** — deliberately forgets payload outcomes older than their learned relevance window, keeping the payload ranker responsive to the current threat landscape.
0304. **Version-supersession forgetting** — when a framework releases a major version, aggressively decays learnings tied to the old major version while preserving version-agnostic technique knowledge.
0305. **WAF-signature expiry** — expires stored WAF bypass techniques when the WAF vendor's observed behavior changes, preventing the planner from trusting dead bypasses.
0306. **CVE applicability decay** — decays CVE-to-target applicability scores as patch probability rises over time since disclosure, modeled per industry patch cadence.
0307. **Negative-result expiry** — expires "payload failed" records faster than "payload succeeded" records, since failures are more likely caused by transient conditions than successes are by luck.
0308. **Fingerprint drift invalidation** — invalidates all target-specific learned data (payload rankings, bypasses) the moment recon detects a stack fingerprint change, forcing re-learning instead of trusting stale intel.
0309. **Seasonal relevance windows** — learns that some intel is only relevant in windows (holiday freeze configs, tax-season logic) and suspends it outside those windows rather than deleting it.
0310. **Confidence decay on unreplicated findings** — decays confidence in findings that were never independently re-verified, so the knowledge base doesn't fossilize unconfirmed claims.
0311. **Analyst-correction decay override** — when an analyst corrects the agent, that correction gets a slow-decay (long memory) weight, since human-verified labels are the scarcest signal.
0312. **Duplicate-label propagation decay** — propagates "duplicate" labels to similar findings with decaying strength over similarity distance, suppressing near-duplicates without hiding genuinely new variants.
0313. **False-positive memory with appeal** — stores FP labels with the evidence that justified them and allows automatic appeal when new contradictory evidence arrives, preventing permanent blindness.
0314. **Concept drift detector** — monitors the distribution of successful payload features over time and alerts when drift exceeds a threshold, triggering retraining of rankers rather than silent degradation.
0315. **Prior reversion under drift** — when drift is detected in a payload family, temporarily reverts its ranking to the global prior until enough fresh data accumulates, avoiding thrash on small samples.
0316. **Catastrophic forgetting guard** — when learning a new target deeply, uses elastic-weight-style protection so new knowledge doesn't overwrite rare-but-valuable old knowledge (e.g., mainframe-era techniques).
0317. **Rare-technique preservation vault** — isolates rarely-used but historically decisive techniques (e.g., specific deserialization gadgets) from normal decay so they're never forgotten entirely.
0318. **Hunt outcome summarization** — compresses each finished hunt into a compact lesson record (what worked, what didn't, surprises) instead of storing raw request logs, keeping the memory store bounded.
0319. **Lesson deduplication** — merges new hunt lessons with existing ones when they teach the same thing, incrementing a support counter instead of storing redundant records.
0320. **Surprise-weighted retention** — retains surprising outcomes (unexpected successes, confident predictions that failed) longer than routine confirmations, since surprises carry the most learning signal.
0321. **Boring-outcome compression** — aggressively compresses runs of expected outcomes into counts ("XSS payloads failed 200x on React SPA") rather than individual records.
0322. **Memory budget allocator** — allocates the local memory budget across knowledge types by their measured contribution to finding velocity, expanding what helps and shrinking what doesn't.
0323. **Knowledge pruning scheduler** — runs periodic pruning passes that remove low-support, high-age, low-surprise records, with a pre-prune snapshot so nothing is irrecoverable.
0324. **Snapshot-and-rollback for learning** — snapshots the knowledge base before each hunt and can roll back learning updates from a hunt that produced corrupted signals (e.g., target was a honeypot).
0325. **Honeypot contamination quarantine** — detects honeypot-like targets post-hunt and quarantines all learnings from them so fake responses don't poison the knowledge base.
0326. **Poisoned-feedback detector** — detects analyst feedback patterns indicative of mistakes or gaming (contradictory labels, bulk dismissals) and down-weights suspicious feedback batches.
0327. **Feedback source reputation** — tracks per-analyst label accuracy over time (agreement with later verification) and weights future feedback by learned reputation.
0328. **Self-label verification loop** — periodically re-tests a sample of the agent's own past labels (FP vs TP) against fresh evidence to estimate and correct its labeling bias.
0329. **Label noise robustness** — trains rankers with noise-robust objectives so a fraction of mislabeled findings doesn't collapse payload ordering quality.
0330. **Temporal train-test splits** — evaluates learning models with time-based splits (train on old hunts, test on recent) so reported accuracy reflects real forward-looking performance, not hindsight.
0331. **Cold-start performance tracker** — measures finding velocity on targets with zero prior similar-target data to quantify how good the cold-start priors really are.
0332. **Transfer-gain measurer** — quantifies how much similar-target transfer actually improves finding velocity vs cold start, per similarity tier, to tune transfer aggressiveness.
0333. **Negative transfer detector** — detects when transferred knowledge hurts (worse than cold start) on a target class and disables transfer for that class automatically.
0334. **Similarity metric learner** — learns which target-similarity features (stack overlap, industry, size) actually predict transfer success, replacing hand-tuned similarity weights.
0335. **Per-hunt learning rate** — adapts how strongly a single hunt updates global knowledge based on hunt quality signals (coverage, verification rigor), so sloppy hunts don't move the needle much.
0336. **Outlier hunt dampener** — detects hunts whose outcomes wildly diverge from priors (possible misconfiguration or honeypot) and dampens their global update weight.
0337. **Consensus across hunts** — requires multiple independent hunts to agree before promoting a tentative lesson to a trusted rule, preventing single-hunt flukes from becoming policy.
0338. **Rule promotion pipeline** — moves learned patterns through stages (hypothesis → candidate → validated → default) with statistical gates at each stage, mirroring how the agent should treat its own beliefs.
0339. **Rule demotion pipeline** — symmetric demotion path: validated rules that start failing get demoted through the same stages with full audit history of why.
0340. **Learned-rule explainability** — every promoted rule carries its supporting evidence (hunt IDs, success counts, confidence intervals) so analysts can audit why the agent believes something.
0341. **Counter-evidence tracker** — stores counter-evidence against each learned rule and triggers review when counter-evidence crosses a threshold, keeping rules honest.
0342. **Rule conflict resolver** — detects when two learned rules contradict (e.g., "always test X first" vs "X is dead on this stack") and resolves by specificity, recency, and evidence weight.
0343. **Default-strategy challenger** — periodically pits the current default strategy against challengers on live hunts (with safety bounds) so defaults must continuously earn their position.
0344. **Strategy performance attribution** — attributes finding-velocity changes to specific strategy components (payload order, recon depth, chaining aggressiveness) via ablation-style experiments.
0345. **Hyperparameter evolution** — evolves hunt hyperparameters (timeouts, concurrency, depth limits) via evolutionary search across hunts, keeping the config that maximizes verified findings per hour.
0346. **Budget allocation learner** — learns the optimal split of request budget across recon/testing/chaining/verification phases per target class from historical ROI.
0347. **Depth-vs-breadth balancer** — learns per target class whether deep testing of few endpoints or shallow testing of many yields more verified findings, and sets the balance accordingly.
0348. **Early-stopping learner** — learns when to stop testing a vuln class on a target (diminishing returns curve) from historical conversion-vs-effort data, freeing budget for higher-ROI classes.
0349. **Diminishing-returns curve fitter** — fits per-class effort→findings curves from past hunts so the planner can predict the marginal value of the next 100 requests.
0350. **Opportunity-cost estimator** — estimates what the agent gives up by continuing the current test (expected value of the next-best untested class) and switches when opportunity cost exceeds expected gain.
0351. **Exploration-exploitation scheduler** — uses bandit-style scheduling to balance exploiting known-good payloads against exploring novel mutations, with exploration rate tuned by hunt phase.
0352. **Novelty bonus for payloads** — gives untested payload families an exploration bonus proportional to their structural novelty, ensuring the agent doesn't converge prematurely on a few winners.
0353. **Thompson sampling payload selector** — selects payloads via Thompson sampling over per-payload beta distributions of success, naturally balancing exploration and exploitation with uncertainty.
0354. **Contextual bandit test planner** — treats vuln-class selection as a contextual bandit with target features as context, learning a policy that picks the best class to test next given the current target.
0355. **Hierarchical test planner** — learns a hierarchy (recon strategy → vuln class → payload family → payload) where bandits at each level allocate effort, enabling credit assignment at the right granularity.
0356. **Meta-bandit for strategy choice** — runs a bandit over whole hunt strategies (aggressive, stealthy, thorough) learning which strategy suits which target class.
0357. **Regret tracker** — tracks the regret of test-planning decisions (what the best hindsight choice would have found) to quantify planner quality over time.
0358. **Counterfactual hunt simulator** — replays hunt decision logs through alternative policies offline to estimate what a different strategy would have found, without spending requests.
0359. **Offline policy evaluator** — evaluates candidate strategy changes against logged hunt data with importance weighting before deploying them on live targets.
0360. **Safe strategy rollout** — rolls out learned strategy changes gradually (10% → 50% → 100% of hunts) with automatic rollback if finding velocity drops.
0361. **Champion-challenger registry** — keeps a registry of champion vs challenger strategies with live performance stats, making strategy evolution auditable.
0362. **Experiment guardrails** — constrains live A/B experiments with guardrails (max budget, no destructive tests, scope limits) so learning never endangers the target or the hunt.
0363. **Experiment sample-size planner** — computes required hunt counts for statistically meaningful A/B comparisons given observed variance, avoiding premature conclusions.
0364. **Sequential testing for strategies** — uses sequential statistical tests so winning strategies can be promoted early without waiting for fixed sample sizes, while controlling false positives.
0365. **Stratified experiment assignment** — stratifies experiment assignment by target class so strategy comparisons aren't confounded by target difficulty differences.
0366. **Crossover experiment design** — on re-hunted targets, uses crossover designs (strategy A then B) to compare strategies while controlling for target-specific effects.
0367. **Experiment contamination guard** — prevents learnings from an experimental strategy leaking into the champion's knowledge base until the experiment concludes.
0368. **Multi-armed payload tournament** — runs periodic tournaments where payload families compete head-to-head on standardized test fixtures, updating global rankings from results.
0369. **Test fixture farm** — maintains local vulnerable-by-design fixtures per vuln class so payload tournaments and regression tests run without touching real targets.
0370. **Fixture fidelity scorer** — scores how well each fixture predicts real-target payload success, retiring fixtures that diverge from reality.
0371. **Regression suite for payloads** — keeps a regression set of historically-confirmed working payloads per class; any ranker change must not demote them without cause.
0372. **Canary hunt set** — maintains a set of previously-hunted targets (with permission) used to validate strategy changes end-to-end before wide rollout.
0373. **Shadow-mode strategy evaluation** — runs candidate strategies in shadow mode (logging decisions without acting) alongside live hunts to gather comparison data risk-free.
0374. **Decision-log completeness checker** — verifies hunt decision logs capture everything needed for offline replay (state, action, outcome), flagging gaps that would corrupt counterfactual analysis.
0375. **Hunt replay engine** — re-executes logged hunts against new strategies in simulation, estimating finding velocity deltas before live deployment.
0376. **Replay fidelity validator** — validates that replayed hunts reproduce original outcomes under the original strategy, ensuring the simulator is trustworthy.
0377. **What-if payload injector** — injects hypothetical payloads into replayed hunts to estimate their marginal value before adding them to the live arsenal.
0378. **Strategy diff explainer** — explains in plain language how a challenger strategy differs from the champion and why the data favors it, for analyst review.
0379. **Analyst veto on strategy promotion** — requires analyst acknowledgement (not just auto-promotion) before a challenger becomes the default on high-stakes target classes.
0380. **Promotion audit trail** — logs every strategy/rule promotion with evidence, authorizing experiment, and performance delta for full accountability.
0381. **Rollback drill memory** — remembers past rollback triggers and their signatures so similar degradations trigger faster automatic rollbacks in future.
0382. **Post-mortem generator** — auto-generates post-mortems for failed experiments (why the challenger lost) and stores the lessons to avoid repeating the same losing idea.
0383. **Idea graveyard with resurrection** — stores rejected strategy ideas with the conditions that would make them worth retrying (e.g., "retry when WAF X updates"), enabling principled resurrection.
0384. **Cross-hunt anomaly detector** — flags hunts whose patterns deviate strongly from the learned norm (possible target-side changes or agent bugs) for review before their data updates global knowledge.
0385. **Data quality scorer per hunt** — scores each hunt's learning-data quality (coverage, verification rigor, label confidence) and weights its global updates accordingly.
0386. **Verification rigor tracker** — tracks how rigorously each finding was verified (manual-equivalent checks passed) and uses rigor as a weight in all downstream learning.
0387. **Evidence strength ledger** — records the evidence strength behind each stored lesson so weakly-evidenced lessons get revisited before being trusted.
0388. **Belief calibration dashboard data** — exports the agent's predicted-vs-actual success rates per category as structured data so calibration can be monitored and improved.
0389. **Calibration binning per vuln class** — bins the agent's confidence predictions per vuln class and computes empirical accuracy per bin, exposing over/under-confidence patterns.
0390. **Confidence recalibrator** — applies learned per-class calibration maps (e.g., "when I say 80% on XSS I mean 62%") so reported confidences match reality.
0391. **Severity calibration learner** — learns how the agent's severity scores map to analyst-agreed severities and recalibrates scoring to match human judgment.
0392. **Exploitability calibration** — calibrates "exploitable" predictions against actual PoC success rates, per vuln class and stack.
0393. **FP-rate estimator per check** — learns the empirical false-positive rate of each check type from verification outcomes and surfaces it alongside findings.
0394. **Precision-recall tradeoff tuner** — tunes per-class detection thresholds to the analyst's revealed precision/recall preference (learned from which FPs they tolerate vs which misses they complain about).
0395. **Analyst tolerance profiler** — builds a profile of each analyst's tolerance for noise vs missed findings from their feedback history, personalizing report filtering.
0396. **Report-length preference learner** — learns how detailed each analyst wants reports (from their edits and feedback) and adjusts generated report depth accordingly.
0397. **Finding-title style learner** — learns title/description conventions the analyst prefers from edited reports and applies them to new findings.
0398. **Remediation-detail preference** — learns whether the analyst wants terse or detailed remediation guidance per vuln class from past report edits.
0399. **Duplicate-threshold personalizer** — learns each analyst's similarity threshold for "duplicate" from their duplicate labels and tunes suppression accordingly.
0400. **Severity-override pattern learner** — learns when analysts override the agent's severity (up or down) and adjusts the scoring features that drove those overrides.
0401. **Dismissal reason taxonomy learner** — learns a taxonomy of why analysts dismiss findings (not-exploitable, duplicate, out-of-scope, wont-fix, false-positive) and trains per-reason suppressors.
0402. **Wont-fix pattern miner** — mines patterns in findings analysts mark wont-fix (e.g., informational headers on static sites) and stops reporting that shape proactively.
0403. **Not-exploitable evidence learner** — learns what evidence convinces analysts something isn't exploitable and pre-gathers that evidence before reporting borderline findings.
0404. **Duplicate signature extractor** — extracts signatures from analyst-marked duplicates (same root cause, different URL) so future near-duplicates auto-merge instead of re-reporting.
0405. **Feedback-to-feature attribution** — attributes analyst feedback to the specific features that drove the wrong decision (bad payload, wrong severity feature) so learning updates the right component.
0406. **Inline correction ingestion** — lets analysts correct a finding inline (severity, title, description) and converts each correction into a labeled training example for the report writer.
0407. **Natural-language feedback parser** — parses free-text analyst comments ("this is a duplicate of #123", "not reachable from internet") into structured labels the learning system can consume.
0408. **Feedback completeness prompter** — when feedback is vague ("not useful"), asks one targeted clarifying question to convert it into an actionable label, minimizing analyst effort.
0409. **Batch feedback importer** — ingests bulk analyst triage decisions (CSV/API from bug-bounty platforms, with permission) as labeled data for retraining classifiers.
0410. **Platform verdict sync** — syncs public/authorized platform verdicts (accepted, duplicate, informative, N/A) back to the originating findings as ground-truth labels.
0411. **Verdict delay modeler** — models the delay between report and verdict per program so the learner knows when absence of a verdict means "pending" vs "ignored".
0412. **Accepted-finding amplifier** — boosts the strategies and payloads behind accepted findings more strongly than mere detections, since acceptance is the scarcest positive signal.
0413. **N/A-pattern suppressor** — learns patterns in findings marked N/A (not applicable) per program type and suppresses those shapes before they waste report space.
0414. **Informative-vs-vuln separator** — learns the boundary each analyst draws between informative and vulnerability from their labels, calibrating what gets reported as a finding vs a note.
0415. **Severity drift aligner** — tracks how an analyst's severity standards drift over time and continuously re-aligns the agent's scoring to match their current bar.
0416. **Cross-analyst disagreement resolver** — when analysts disagree on labels, models each analyst's bias and estimates a consensus label weighted by learned reliability.
0417. **Feedback latency optimizer** — learns the best moment to ask for feedback (right after a hunt vs batched weekly) per analyst to maximize response rate.
0418. **Micro-feedback widgets data** — captures one-click micro-feedback (thumbs up/down per finding) as weak labels that accumulate into strong training signals over time.
0419. **Finding-level A/B reports** — A/B tests report phrasings per finding type and learns which phrasing gets faster acceptance from analysts.
0420. **PoC quality scorer from feedback** — learns what makes a PoC convincing (replayability, minimal steps, clear impact) from analyst reactions to past PoCs.
0421. **Remediation acceptance learner** — tracks which remediation suggestions analysts actually forward to developers vs rewrite, and learns to write the forwarded kind.
0422. **Executive-summary preference learner** — learns each stakeholder's preferred summary style (risk-focused, metrics-focused, narrative) from their engagement with past summaries.
0423. **Question-answering from hunt memory** — builds a Q&A index over past hunts so mid-hunt questions ("have we seen this before?") get answered from learned experience, not just the current hunt.
0424. **Hunt narrative memory** — stores narrative summaries of past hunts (strategy, surprises, outcome) enabling the agent to explain its current plan by analogy to past hunts.
0425. **Analogy-based plan justification** — justifies test-plan choices with retrieved analogies ("we found IDOR on 3 similar fintech APIs by testing pagination first") grounded in stored hunt narratives.
0426. **Surprise journal** — maintains a journal of surprising hunt outcomes reviewed periodically to extract meta-lessons about the agent's blind spots.
0427. **Blind-spot detector** — compares the agent's predicted finding distribution per target class against actuals to find vuln classes it systematically under-tests.
0428. **Coverage-gap learner** — learns which endpoint/parameter types historically escape testing (websockets, file downloads, webhooks) and adds explicit coverage checks for them.
0429. **Untested-surface estimator** — estimates what fraction of the attack surface went untested per hunt from crawl coverage vs discovered surface, and learns to shrink the gap.
0430. **Crawl completeness predictor** — predicts crawl completeness from site-structure signals learned historically, deciding when deeper crawling has diminishing returns.
0431. **JS-rendered surface learner** — learns which SPA frameworks historically hide the most API surface from static crawling and allocates headless-rendering budget accordingly.
0432. **API discovery recall learner** — measures API endpoint discovery recall against ground truth from past hunts (where full specs were later obtained) and improves discovery heuristics.
0433. **Parameter discovery recall learner** — tracks hidden-parameter discovery recall per technique (brute force, JS mining, doc mining) and rebalances effort toward the highest-recall technique per target class.
0434. **Subdomain enumeration recall learner** — estimates subdomain enumeration completeness per technique from past hunts and combines techniques to maximize recall per budget.
0435. **Content discovery precision learner** — learns which wordlist entries historically hit per tech stack, evolving per-stack wordlists that maximize hits per request.
0436. **Fuzz-point prioritizer** — learns which injection points (which parameters, headers, paths) historically yield findings per app type and orders fuzzing by learned point-value.
0437. **High-value endpoint recognizer** — trains a recognizer for historically high-value endpoints (password reset, export, admin, payment) from URL+behavior features so they're tested first on new targets.
0438. **Low-value endpoint deprioritizer** — learns which endpoint shapes historically never yield findings (static assets, health checks) and skips them quickly.
0439. **State-changing action risk learner** — learns which state-changing tests historically caused problems vs were safe, calibrating how aggressively the agent tests destructive-adjacent flows within authorization.
0440. **Safe-mode effectiveness tracker** — measures finding velocity with safety constraints on vs off (in authorized test environments) to quantify the cost of caution per target class.
0441. **Destructive-test boundary memory** — remembers per-target-class which tests were flagged as too destructive by analysts and hard-codes those boundaries into future plans.
0442. **Scope-creep detector** — learns the signature of scope creep (drifting to out-of-scope hosts mid-hunt) from past incidents and auto-constrains the crawler when detected.
0443. **Authorization evidence keeper** — stores the authorization basis per hunt (scope definition, program policy snapshot) so learned behaviors never generalize beyond authorized testing.
0444. **Policy-change adapter** — detects when a program's policy changes (new out-of-scope rules) and updates learned scope-avoidance patterns accordingly.
0445. **Rate-limit incident memory** — remembers rate-limit incidents per target (what triggered them) and encodes avoidance rules so future hunts don't repeat the trigger.
0446. **Block-incident autopsy** — performs autopsies on IP/account blocks (request pattern that caused it) and learns pacing rules that keep future hunts under the tripwire.
0447. **Captcha-trigger memory** — learns which behaviors trigger captchas per target and avoids those patterns, since captcha walls kill autonomous hunts.
0448. **Account-lockout avoidance learner** — learns lockout thresholds per login implementation from near-misses and caps credentialed-testing attempts below them.
0449. **Session-abuse guard learner** — learns how many sessions/requests per account are safe per app from past incidents, preventing accidental DoS of the test account.
0450. **Data-exposure minimization learner** — learns to minimize PII accessed during testing (sample one record, not dump tables) from analyst feedback on over-collection.
0451. **PII handling policy memory** — remembers per-analyst/per-program PII handling rules (redact, don't store, report-only-counts) and enforces them in evidence collection.
0452. **Evidence retention policy learner** — learns appropriate evidence retention per finding type and program, auto-expiring sensitive evidence on schedule.
0453. **Screenshot redaction learner** — learns which screen regions typically contain PII per app type and auto-suggests redaction boxes for PoC screenshots.
0454. **Log sanitization verifier** — verifies that stored hunt logs contain no credentials/secrets by learning secret patterns from past leaks and scanning before persist.
0455. **Secret-in-learning-data scrubber** — scrubs secrets from data before it enters the learning store, with a learned detector for novel secret formats.
0456. **Differential privacy for shared stats** — when aggregating statistics across hunts, applies noise so per-target details can't be reconstructed from learned aggregates.
0457. **Target anonymization in lessons** — strips target-identifying details from stored lessons while preserving the technical pattern, so the knowledge base is safe to inspect.
0458. **Lesson export filter** — filters lessons on export (ZIP transfer) to exclude anything target-identifying or sensitive, with a learned classifier for edge cases.
0459. **Multi-device sync conflict resolver** — when hunt memory syncs across the user's devices via ZIP, resolves conflicts by recency, evidence strength, and analyst labels.
0460. **Merge-strategy learner for sync** — learns which merge strategies (union, intersection, recency-wins) produce the best post-merge finding velocity, tuning sync behavior.
0461. **Device-specific adaptation memory** — remembers per-device constraints (RAM, CPU) and adapts learning-model complexity so the knowledge base stays usable on the weakest device.
0462. **Offline learning queue** — queues learning updates when offline and applies them in dependency order on reconnect, with conflict detection against newer knowledge.
0463. **Bandwidth-aware sync prioritizer** — prioritizes syncing high-value learnings first (new vuln patterns, analyst corrections) when bandwidth is limited.
0464. **Incremental model updater** — updates learned rankers incrementally per hunt instead of full retrains, keeping CPU/memory usage bounded on the user's device.
0465. **Full-retrain scheduler** — schedules occasional full retrains during idle time to correct drift that incremental updates can't fix, with learned optimal frequency.
0466. **Model version registry** — versions every learned model (payload ranker v3, calibrator v2) with performance stats so regressions can be traced to a specific version.
0467. **Model rollback on regression** — automatically rolls back a learned model to the previous version if its live performance drops below a threshold, with alerting.
0468. **Feature importance tracker** — tracks which features drive each learned model's decisions over time, detecting when a model starts relying on spurious signals.
0469. **Spurious correlation detector** — detects features that correlate with success for non-causal reasons (e.g., time-of-day artifacts) and excludes them from models.
0470. **Causal vs correlational separator** — uses targeted experiments to separate causal payload features (actually cause success) from correlational ones, prioritizing causal features in generation.
0471. **Interventional payload testing** — deliberately varies one payload feature at a time in controlled tests to establish causal effects on success rates.
0472. **Natural experiment miner** — mines past hunts for natural experiments (same payload, different WAF versions) to estimate causal effects without new requests.
0473. **Instrumental variable learner** — uses framework version upgrades as instruments to estimate the causal effect of stack changes on vuln prevalence.
0474. **Propensity-weighted transfer** — weights transferred knowledge by the propensity of the source target to be similar, correcting for selection bias in which targets got hunted.
0475. **Selection bias corrector** — corrects for the fact that hunted targets aren't random (analysts pick interesting ones) when generalizing learnings to new targets.
0476. **Survivorship bias guard** — guards against learning only from completed hunts by modeling which hunts get abandoned and why, correcting success-rate estimates.
0477. **Reporting bias corrector** — corrects for analysts reporting successes more than failures when ingesting external/bulk feedback data.
0478. **Publication bias modeler** — models the bias in public write-ups toward spectacular findings so the learner doesn't overweight exotic techniques.
0479. **Base-rate restorer** — restores true base rates of vuln classes from biased observation data using learned observation probabilities per class.
0480. **Dark-figure estimator** — estimates the number of missed findings per hunt (the "dark figure") from re-hunt data, calibrating how much to trust "no findings" conclusions.
0481. **Re-hunt delta analyzer** — analyzes what re-hunts find that original hunts missed, attributing misses to specific planner weaknesses for targeted improvement.
0482. **Miss taxonomy learner** — builds a taxonomy of miss types (never tested, tested wrong, tested right but misjudged) from re-hunt deltas and tracks each type's frequency.
0483. **Never-tested miss reducer** — specifically targets the "never tested" miss category by learning which surfaces get skipped and adding explicit coverage for them.
0484. **Misjudged-evidence learner** — studies findings that were observed but dismissed as FPs and later confirmed real, learning to recognize the evidence patterns of subtle true positives.
0485. **Subtle-signal amplifier** — learns to amplify weak signals (slight timing differences, minor content reflections) that historically preceded confirmed findings.
0486. **Weak-oracle combiner** — learns to combine multiple weak oracles (timing + error message + status code) into a strong detection decision per vuln class.
0487. **Oracle reliability scorer** — scores each detection oracle's reliability per target class from historical precision, weighting oracle votes accordingly.
0488. **Ensemble detector tuner** — tunes ensemble weights of multiple detection methods per vuln class to maximize verified precision on historical data.
0489. **Detection threshold personalizer** — learns per-analyst detection thresholds (how much evidence before reporting) from their FP tolerance profile.
0490. **Borderline-case router** — routes borderline findings to extra verification steps automatically, learning which verification steps historically resolved borderline cases per class.
0491. **Verification-step recommender** — recommends the highest-ROI verification step for each finding type based on historical confirmation rates per step.
0492. **Verification cost modeler** — models the request/time cost of each verification technique so the planner can budget verification like it budgets testing.
0493. **Confirmation-bias guard** — detects when the agent over-verifies findings it "wants" to be true and enforces symmetric falsification attempts.
0494. **Falsification attempt generator** — generates falsification tests for each candidate finding (ways it could be a false positive) with learned effectiveness per class.
0495. **Devil's-advocate reviewer** — maintains a learned checklist of "why this might not be a vuln" per class, applied before any finding is reported.
0496. **Independent re-verification sampler** — randomly re-verifies a sample of reported findings with a different technique to estimate the true FP rate continuously.
0497. **FP root-cause clusterer** — clusters false positives by root cause (bad oracle, misread response, test artifact) so fixes target causes, not symptoms.
0498. **Test-artifact FP suppressor** — learns signatures of FPs caused by the agent's own testing (e.g., self-triggered rate limits) and suppresses them automatically.
0499. **Environment-noise modeler** — models environment noise (flaky responses, CDN variance) per target so the detector doesn't mistake noise for signal.
0500. **Flakiness scorer for checks** — scores each check's result flakiness from repeat runs and requires more evidence from flaky checks before reporting.
0501. **Hierarchical Bayesian vuln priors** — models vuln-class probabilities hierarchically (global → industry → stack → target) so a new target inherits sensible priors at every level with uncertainty quantified.
0502. **Industry prior profiles** — maintains per-industry prior distributions over vuln classes learned from all hunts (fintech: logic flaws; healthcare: IDOR; media: XSS) applied before any target-specific data exists.
0503. **Fintech logic-flaw prior boost** — specifically boosts business-logic test priority on fintech targets from the learned industry prior, since logic flaws dominate that sector's historical findings.
0504. **Healthcare PHI-exposure prior** — boosts IDOR and access-control testing on healthcare targets from learned priors, with strict minimum-necessary data handling baked in.
0505. **E-commerce payment-flow prior** — front-loads payment and pricing-logic tests on e-commerce targets based on the sector's historical finding distribution.
0506. **SaaS tenant-isolation prior** — prioritizes tenant-isolation tests on multi-tenant SaaS from the learned cross-tenant finding rate in the sector.
0507. **Government accessibility-over-security prior** — adjusts priors for government sites (older stacks, verbose errors) learned from historical public-sector hunt data.
0508. **Education-sector prior** — boosts LMS-specific and default-credential-adjacent checks on education targets from sector history (within authorization).
0509. **Startup tech-debt prior** — learns that early-stage startups exhibit specific flaw clusters (exposed staging, debug endpoints, weak auth) and applies the cluster prior on startup-like targets.
0510. **Enterprise legacy prior** — learns enterprise targets carry legacy-system flaws (old TLS, verbose errors, forgotten subdomains) and weights recon toward legacy discovery.
0511. **Cold-start stack questionnaire** — when the stack is unidentifiable, asks the learned minimal question set (via passive signals) that maximally reduces prior uncertainty.
0512. **Maximum-entropy default plan** — designs the cold-start test plan to maximize information gain about the target (which vuln classes are viable) rather than maximizing immediate findings.
0513. **Prior-strength calibrator** — learns how strongly to weight priors vs early hunt evidence per target class, avoiding both prior-stubbornness and evidence-overfitting.
0514. **Prior override detector** — detects when early evidence strongly contradicts priors and switches to evidence-driven planning fast, logging the prior failure for prior revision.
0515. **Unseen-stack similarity fallback** — for never-seen stacks, falls back to priors from the most structurally similar known stack (same language, same architecture pattern).
0516. **Language-family priors** — maintains priors per language family (PHP, Python, JS, Java, Go, Ruby) capturing each ecosystem's characteristic flaw distribution.
0517. **Architecture-pattern priors** — learns priors per architecture pattern (monolith, microservices, serverless, JAMstack) since flaw distributions differ structurally.
0518. **Hosting-pattern priors** — maintains priors per hosting pattern (shared hosting, VPS, PaaS, serverless) reflecting historically observed misconfigurations.
0519. **CDN-presence prior adjustment** — adjusts the full prior distribution when a CDN is detected (cache attacks up, direct-origin attacks need bypass discovery).
0520. **WAF-presence prior adjustment** — rebalances priors when a WAF is fingerprinted (filter-evasion techniques up, naive payloads down).
0521. **Auth-type prior adjustment** — shifts priors based on detected auth (OAuth, SAML, basic, API keys), each with its characteristic flaw distribution.
0522. **API-style prior adjustment** — adjusts priors for REST vs GraphQL vs gRPC vs SOAP based on learned per-style flaw distributions.
0523. **Mobile-backend prior adjustment** — applies mobile-backend-specific priors (device trust, cert issues, API versioning) when mobile API patterns are detected.
0524. **Seasonal hunt calendar** — learns seasonal patterns in target posture (holiday code freezes → config drift; post-release → fresh bugs) and times test emphasis accordingly.
0525. **Holiday code-freeze drift detector** — learns that targets change less but drift more in config during holiday freezes, shifting effort from code vulns to misconfigurations in those windows.
0526. **Release-day bug surge model** — models the surge in fresh bugs after major releases per target class and prioritizes re-hunts in the post-release window.
0527. **Patch-Tuesday re-test scheduler** — learns vendor patch cadences and schedules re-tests of historically regressing vulns just after patch windows.
0528. **Conference-season disclosure surge** — accounts for the surge in public exploit techniques after major security conferences, boosting related checks in the following weeks.
0529. **Tax-season logic prior** — boosts financial-logic testing on relevant targets during tax season from learned seasonal flaw patterns.
0530. **Shopping-season scale prior** — adjusts priors during peak shopping seasons (more aggressive caching, rushed deploys) toward cache and config flaws.
0531. **Back-to-school edtech prior** — boosts edtech testing intensity before academic terms from learned seasonal deployment rushes.
0532. **Year-end freeze prior** — learns year-end change freezes reduce code bugs but increase stale-config exposure, rebalancing the plan in December.
0533. **Day-of-week effect modeler** — learns day-of-week effects on target behavior (deployments on Tuesdays, quiet weekends) and times heavy testing for historically stable windows.
0534. **Time-of-day pacing learner** — learns per-target safe testing windows from past incident data, concentrating aggressive tests when the target historically tolerates load.
0535. **Deploy-window detector** — learns each target's deployment windows from observed changes and avoids heavy testing during deploys (noisy signals) while scheduling fresh-bug hunts right after.
0536. **Event-driven re-hunt triggers** — learns which external events (CVE disclosure, vendor advisory, stack change detection) historically precede new findings and triggers focused re-hunts on those events.
0537. **CVE-to-target matching engine** — matches new CVE disclosures against stored target fingerprints automatically, generating prioritized re-test lists within hours of disclosure.
0538. **Advisory ingestion pipeline** — ingests vendor security advisories (with permission/sources configured by user) and converts them into targeted check updates.
0539. **Threat-intel correlation learner** — learns correlations between public threat-intel trends and finding types on the user's targets, adjusting emphasis without ingesting target-identifying intel.
0540. **Exploit-publication monitor** — tracks when PoCs for known vulns become public and boosts testing for those vulns on matching stacks before mass exploitation.
0541. **Version-release watcher** — watches for new releases of fingerprinted components and triggers differential testing for regressions introduced by the upgrade.
0542. **Dependency-release risk scorer** — scores new dependency releases by historical regression rate of that dependency, prioritizing testing when risky updates are detected.
0543. **Framework LTS transition memory** — learns flaw patterns that emerge during LTS transitions (rushed migrations, mixed versions) per framework.
0544. **Beta/RC exposure prior** — boosts testing when beta/RC versions are detected in production fingerprints, from learned pre-release flaw rates.
0545. **Nightly-build detection prior** — adjusts priors when nightly/dev builds are fingerprinted (debug features likely enabled).
0546. **Canary-deployment detector** — learns to detect canary deployments (version inconsistencies across requests) and tests both versions for differential flaws.
0547. **Blue-green drift memory** — remembers blue-green deployment inconsistencies (old version still serving some paths) that historically hid unpatched endpoints.
0548. **Feature-flag rollout flaw memory** — learns flaws exposed during gradual rollouts (inconsistent auth between flag states) per flag provider.
0549. **A/B-test variant differential** — tests A/B variants differentially, learning which variant-handling bugs (state leakage between variants) occur per experimentation platform.
0550. **Multi-region inconsistency learner** — learns to compare regions (different headers, versions, WAF rules per region) and exploits the weakest region's configuration.
0551. **Edge-vs-origin differential** — systematically diffs edge (CDN) vs origin responses, learning which differential patterns historically indicated bypassable protections.
0552. **Staging-prod parity scorer** — scores staging/prod parity from observations and learns that low-parity targets deserve staging-first deep testing (staging often weaker).
0553. **Shadow-API discovery learner** — learns where shadow APIs hide (old mobile versions, partner endpoints, undocumented v1) per target class from past discoveries.
0554. **Zombie-endpoint memory** — remembers deprecated-but-live endpoints that historically carried old vulns, and learns their hiding patterns per framework.
0555. **Orphaned-subdomain learner** — learns orphaned-subdomain patterns (forgotten marketing sites, old docs) per organization type with historical takeover/exposure rates.
0556. **Forgotten-bucket learner** — learns forgotten storage bucket patterns per company naming convention with historical exposure rates.
0557. **Ex-employee artifact learner** — learns artifacts left by departed teams (personal subdomains, test accounts) per org size with historical finding rates.
0558. **M&A artifact learner** — learns post-merger leftover assets (acquired company's staging, old VPN portals) with historical vulnerability rates.
0559. **Rebrand leftover learner** — learns assets left behind after rebrands (old domains, old app versions) that historically stayed vulnerable.
0560. **Conference-demo leftover learner** — learns demo environments spun up for conferences and forgotten, with historical exposure patterns.
0561. **Hackathon-project exposure learner** — learns hackathon/prototype deployments on corporate domains that historically exposed internal APIs.
0562. **Intern-project artifact learner** — learns intern/summer-project deployments with historically weak security postures per org type.
0563. **Contractor handoff gap learner** — learns security gaps at contractor-built sections (identified by code style/bundle differences) from past findings.
0564. **Offshore-team pattern learner** — avoids stereotyping; instead learns purely technical signals (mixed framework versions, inconsistent auth) that historically correlate with integration seams worth testing.
0565. **Integration-seam flaw prior** — boosts testing at integration seams (places where two systems meet: SSO bridges, payment webhooks) from learned seam flaw rates.
0566. **Third-party script risk learner** — learns which third-party script categories historically introduced XSS/skimmer risk per inclusion pattern.
0567. **Supply-chain script monitor** — learns baseline hashes of third-party scripts per target and flags changes for review (defensive integrity monitoring).
0568. **Compromised-dependency indicator learner** — learns behavioral indicators of compromised dependencies (unexpected exfiltration, new obfuscation) from historical incidents.
0569. **Typosquat detection memory** — remembers typosquat-adjacent package risks per ecosystem with learned naming-confusion patterns.
0570. **Dependency-confusion test prioritizer** — prioritizes dependency-confusion checks on internal package names learned from namespace patterns, within authorization.
0571. **Private-registry exposure learner** — learns private registry exposure patterns (npm, PyPI mirrors) per org with historical leak rates.
0572. **Artifact-repository exposure learner** — tracks exposed artifact repos (Nexus, Artifactory) per deployment with historical finding rates.
0573. **Container-image leak learner** — learns where container images leak (public registries, backup buckets) per org with historical secret-extraction rates.
0574. **Image-layer secret miner memory** — remembers secret types historically found in image layers per base image, guiding authorized image analysis.
0575. **Dockerfile misconfig memory** — learns Dockerfile anti-patterns (secrets in ENV, latest tags, root user) per org from past findings.
0576. **K8s manifest exposure learner** — tracks exposed K8s manifests per deployment with historical secret/config leak rates.
0577. **Helm chart flaw memory** — learns Helm chart misconfigurations (default passwords, exposed dashboards) per chart with historical data.
0578. **Terraform state exposure learner** — remembers exposed Terraform state files per deployment with historical secret yields.
0579. **CI config secret learner** — learns CI config files (.github/workflows, .gitlab-ci.yml) exposure patterns with historical secret findings.
0580. **Env-file convention learner** — learns per-framework env-file naming/locations beyond .env (.env.local, config/secrets.yml) with historical hit rates.
0581. **Secrets-in-JS-bundle learner** — learns secret patterns in JS bundles per bundler (webpack, Vite) with historical true-positive rates per secret type.
0582. **Source-map secret learner** — tracks secrets historically recovered from source maps per build tool, prioritizing source-map discovery on matching stacks.
0583. **Mobile-app secret learner** — learns secrets historically extracted from mobile app binaries/APIs per platform, informing backend-focused tests.
0584. **APK/IPA endpoint extractor memory** — remembers API endpoints historically discovered via mobile app analysis per app framework (Flutter, React Native).
0585. **Deep-link flaw memory** — learns deep-link/universal-link hijack patterns per mobile framework with historical success data.
0586. **App-clip/instant-app exposure learner** — tracks instant-app attack surface exposures per platform with historical findings.
0587. **Wearable companion API learner** — learns companion-app API flaws (weak pairing, device-ID trust) per wearable platform.
0588. **Smart-TV app backend learner** — tracks smart-TV app backend flaws per platform (Tizen, webOS, tvOS) with historical data.
0589. **Game-console companion learner** — learns companion-app API flaws per console ecosystem with historical findings.
0590. **Voice-skill backend learner** — tracks Alexa/Google-Action backend verification flaws per skill type with historical data.
0591. **Chatbot backend learner** — learns chatbot (rule-based and LLM) backend flaws per platform (Dialogflow, Rasa, custom) including logic bypasses.
0592. **IVR/phone-system web learner** — tracks web interfaces of IVR/phone systems per vendor with historical flaw patterns.
0593. **Kiosk-mode escape indicator learner** — learns kiosk web-view escape indicators per platform for authorized assessments.
0594. **Digital-signage exposure learner** — tracks exposed digital-signage controllers per vendor with historical findings.
0595. **POS web-interface learner** — learns POS web interface flaws per vendor with strict authorized-target framing.
0596. **ATM/terminal web learner** — tracks terminal management web UIs per vendor with historical vuln patterns (authorized assessments only).
0597. **Medical-device portal learner** — learns patient-portal-adjacent web flaws per vendor with defensive framing and authorization emphasis.
0598. **Vehicle telematics API learner** — tracks vehicle API flaws (VIN enumeration, weak auth) per manufacturer with historical data.
0599. **Fleet-management portal learner** — learns fleet portal IDOR/tracking-data exposures per vendor with defensive framing.
0600. **SCADA-web hybrid learner** — learns IT/OT boundary web flaws per ICS vendor for authorized assessments, with safety-first test constraints.
0601. **Payload-level A/B testing** — runs head-to-head payload comparisons on matched injection points across similar targets, promoting statistically significant winners.
0602. **Mutation-strategy bake-off** — pits mutation strategies (grammar-based vs ML-guided vs manual-templates) against each other quarterly on the fixture farm, adopting the winner.
0603. **Recon-depth experiment** — experiments with recon depth levels (shallow/medium/deep) measuring findings-per-hour to learn the optimal depth per target class.
0604. **Crawl-budget experiment** — A/B tests crawl page budgets to find the knee of the discovery curve per site type, avoiding both under-crawling and crawl bloat.
0605. **Verification-rigor experiment** — tests whether extra verification steps pay for themselves in reduced FP-handling cost, per vuln class.
0606. **Chaining-aggressiveness experiment** — experiments with chaining depth limits to learn where deeper chaining stops paying off per target class.
0607. **Stealth-vs-speed experiment** — compares stealthy (slow, low-noise) vs fast hunt profiles on finding velocity and block rates, learning the optimal profile per target class.
0608. **Concurrency-level tuner** — learns optimal request concurrency per target from block-rate and response-time data, auto-tuning within safe bounds.
0609. **Timeout tuner** — learns per-target response-time distributions and sets timeouts that catch slow blind-injection signals without wasting budget on dead endpoints.
0610. **Retry-policy learner** — learns which failures deserve retries (transient 5xx, timeouts) vs which don't (definitive 4xx, WAF blocks) per target class.
0611. **Backoff-strategy learner** — learns optimal backoff curves per target from rate-limit responses, minimizing time lost to 429s.
0612. **Session-rotation learner** — learns when rotating sessions/IPs helps vs hurts per target, from block and success data.
0613. **Header-rotation experiment** — tests whether rotating User-Agents/headers changes WAF behavior per target, adopting rotation only where it measurably helps.
0614. **TLS-fingerprint rotation learner** — learns which targets fingerprint TLS and whether rotation improves access, applied only where evidence supports it.
0615. **Request-order randomizer test** — tests whether randomized request order reduces bot-detection vs sequential patterns per target class.
0616. **Decoy-traffic evaluator** — evaluates whether decoy requests help evade detection per target, with strict scope compliance (decoys only hit in-scope assets).
0617. **Timing-jitter optimizer** — learns optimal inter-request jitter distributions per target to stay under behavioral detection thresholds.
0618. **Working-hours mimicry learner** — learns whether mimicking human working-hours traffic patterns reduces blocks per target class.
0619. **Bursty-vs-steady experiment** — compares bursty vs steady request patterns on completion rate and block rate per target class.
0620. **Checkpoint-frequency tuner** — learns optimal hunt checkpoint intervals (for pause/resume) per hunt length from interruption data.
0621. **Incremental-result streamer** — learns which partial results analysts want streamed live vs batched, from engagement data.
0622. **Notification-timing learner** — learns when to notify analysts of high-severity findings (immediately vs batched) from their response patterns.
0623. **Auto-pause trigger learner** — learns signals that should auto-pause a hunt (target instability, mass 5xx, scope questions) from past incidents.
0624. **Resume-strategy learner** — learns the best resume strategy after interruption (re-verify state vs continue) per interruption type.
0625. **Hunt-priority scheduler** — learns to schedule multiple hunts by expected value (target value × predicted findings) when the user queues several targets.
0626. **Queue-order optimizer** — orders queued hunts to maximize learning (diverse targets early) vs maximize findings (high-value first), per user preference learned from history.
0627. **Parallel-hunt interference learner** — learns how parallel hunts interfere (shared rate limits, IP reputation) and schedules to minimize interference.
0628. **Resource-contention modeler** — models CPU/memory contention between parallel hunts and the learning system on the user's device, throttling gracefully.
0629. **Overnight-hunt planner** — learns which hunt types complete reliably overnight unattended vs need supervision, from historical completion data.
0630. **Weekend-hunt risk learner** — learns weekend-specific risks (nobody to approve scope questions, slower incident response) and adjusts autonomy levels.
0631. **Unattended-verification limits** — learns which verification steps are safe unattended vs need analyst eyes, from past verification incidents.
0632. **Confidence-gated autonomy** — adjusts autonomous action depth by confidence: high-confidence routine actions proceed, low-confidence novel actions pause for input, with thresholds learned from incident history.
0633. **Novelty-triggered caution** — triggers extra caution when encountering novel situations (unseen stack, unusual response) with the caution level learned from past novel-situation outcomes.
0634. **Blast-radius estimator** — estimates the blast radius of planned test batches from historical incident data and caps batch sizes accordingly.
0635. **Irreversible-action classifier** — learns to classify actions by reversibility from past hunts and requires explicit authorization for irreversible classes.
0636. **State-pollution detector** — learns to detect when testing pollutes target state (created test data, triggered emails) and adds cleanup steps automatically.
0637. **Test-data cleanup verifier** — verifies cleanup of test artifacts post-hunt, learning which artifacts get missed per app type.
0638. **Email-trigger minimizer** — learns which tests trigger emails/notifications per app and batches or avoids them to reduce noise for target owners.
0639. **SMS-trigger avoider** — learns OTP/SMS-triggering flows per app and avoids burning the target's SMS budget during testing.
0640. **Payment-gateway sandbox detector** — learns to detect sandbox vs live payment gateways and refuses live-gateway tests without explicit authorization.
0641. **Production-vs-staging discriminator** — learns stronger production/staging discrimination from historical misclassification incidents, defaulting to safer assumptions.
0642. **Destructive-pattern blocklist learner** — learns new destructive patterns from near-misses and adds them to the hard blocklist with analyst review.
0643. **Authorization-scope compiler** — compiles scope definitions into machine-checkable URL/host/path rules, learning common scope-specification patterns from past programs.
0644. **Scope-ambiguity flagger** — learns linguistic patterns in scope definitions that historically led to ambiguity incidents and flags them for clarification before hunting.
0645. **Out-of-scope near-miss learner** — studies near-misses where the agent almost tested out-of-scope assets and strengthens the guardrails at those decision points.
0646. **Subdomain-scope inference** — learns how programs typically treat subdomains (in scope by default vs enumerated list) from past program data to set safe defaults.
0647. **Acquisition-scope lag learner** — learns that newly acquired assets often have unclear scope status and defaults to conservative treatment until clarified.
0648. **Third-party-service scope learner** — learns how programs scope third-party services (CDN, SaaS integrations) and avoids testing them without explicit inclusion.
0649. **Bug-bounty etiquette learner** — learns program-specific etiquette (reporting tempo, duplicate handling, communication style) from verdict and response data.
0650. **Report-timing optimizer** — learns optimal report timing per program (immediate for critical, batched for lows) from acceptance-speed data.
0651. **Follow-up cadence learner** — learns appropriate follow-up cadences for unacknowledged reports per program from historical response times.
0652. **Retest-request learner** — learns when programs want retest requests vs silent re-hunts from their fix-verification workflows.
0653. **Fix-verification prioritizer** — prioritizes fix verification by learned fix-failure rates per vuln class and vendor (some fixes historically fail more).
0654. **Patch-bypass predictor** — learns patch patterns that historically get bypassed (blocklist additions vs proper fixes) and tests bypasses on "fixed" findings.
0655. **Incomplete-fix detector** — learns signatures of incomplete fixes (one vector blocked, siblings open) per vuln class and tests sibling vectors automatically.
0656. **Regression-after-fix learner** — learns which fixes historically introduce new vulns (e.g., overzealous filtering breaking functionality, new bypasses) and tests around fixes.
0657. **Wont-fix resurface tracker** — tracks wont-fix findings that later became exploitable (context changed) and re-surfaces them when conditions change.
0658. **Duplicate-of-duplicate resolver** — learns duplicate chains (A dup of B dup of C) to attribute credit to the true original finding.
0659. **Credit-attribution learner** — learns fair credit attribution when multiple hunts/tools contributed to a finding, for accurate strategy evaluation.
0660. **Tool-contribution estimator** — estimates each engine's marginal contribution to findings (recon vs detector vs chaining) via ablation on replayed hunts.
0661. **Engine-ablation scheduler** — periodically ablates engines in replay to detect when an engine stops pulling its weight, triggering investigation.
0662. **Pipeline-bottleneck detector** — learns where findings get lost in the pipeline (detected but filtered, chained but unverified) and fixes the leakiest stage first.
0663. **Stage-yield tracker** — tracks yield at each pipeline stage per vuln class, learning which stages need better models for which classes.
0664. **End-to-end conversion learner** — learns the full probe→finding→accepted conversion funnel per class and optimizes the stage with the worst conversion.
0665. **Funnel-dropout autopsy** — autopsies findings that dropped out of the funnel (detected but never reported) to find systematic reporting gaps.
0666. **Near-miss funnel analysis** — analyzes near-misses at each funnel stage to learn what almost worked, feeding the mutator and verifier.
0667. **Cross-stage feature sharing** — learns which features computed early (recon) predict late-stage success (chaining), sharing them forward to improve decisions.
0668. **Early-abort predictor** — learns to predict early whether a hunt will be fruitful (from first-hour signals), enabling early reallocation of effort.
0669. **Hunt-success forecaster** — forecasts expected findings per hunt from target features, used for scheduling and for detecting underperforming hunts.
0670. **Underperformance alerter** — alerts when a hunt underperforms its forecast significantly, triggering diagnostic review of what went wrong.
0671. **Overperformance analyzer** — analyzes overperforming hunts to extract what went right, promoting those behaviors to defaults.
0672. **Luck-vs-skill separator** — separates lucky outcomes from skillful ones by comparing against the forecast distribution, so learning rewards skill, not luck.
0673. **Forecast-calibration tracker** — tracks forecast calibration over time (predicted vs actual findings) as a top-level health metric of the whole learning system.
0674. **Learning-system health dashboard data** — exports learning-system health metrics (calibration, transfer gain, experiment velocity) as structured data for review.
0675. **Knowledge-base coverage estimator** — estimates what fraction of the relevant vuln universe the knowledge base covers, per stack, guiding research priorities.
0676. **Research-priority ranker** — ranks gaps in the knowledge base by expected finding value, directing manual research or new fixture development.
0677. **Technique-import evaluator** — evaluates externally-sourced techniques (from analyst input or public research the user provides) in the fixture farm before admitting them to the live arsenal.
0678. **Technique-sourcing ledger** — tracks the provenance of every technique (learned, analyst-provided, user-imported) for auditability and selective rollback.
0679. **User-taught technique compiler** — compiles user-taught techniques ("try X when you see Y") into executable checks with automatic fixture validation.
0680. **Natural-language rule authoring** — lets analysts author detection rules in natural language, compiled to checks and validated against historical labeled data before deployment.
0681. **Rule-precision estimator** — estimates a new rule's precision on historical data before deployment, blocking rules predicted to be noisy.
0682. **Rule-recall estimator** — estimates a new rule's recall on historical confirmed findings, flagging rules that would miss known vulns.
0683. **Shadow-rule evaluation** — runs new analyst-authored rules in shadow mode on live hunts, promoting only rules that prove their precision.
0684. **Rule-interaction tester** — tests new rules for interactions with existing rules (double-reporting, suppression conflicts) in replay before deployment.
0685. **Suppression-rule auditor** — audits suppression rules periodically against fresh data to catch suppressions that have started hiding real findings.
0686. **Allowlist-rule auditor** — audits allowlist rules (things never tested) to ensure they're still justified, expiring stale allowlists.
0687. **Blocklist-rule reviewer** — reviews blocklist rules (things never reported) with sample audits to catch over-blocking.
0688. **Sampling auditor for filters** — randomly samples filtered-out findings for manual review, estimating the filter's miss rate continuously.
0689. **Filter-bypass bounty** — treats filter misses found by sampling as high-value learning events, triggering root-cause fixes to the filter.
0690. **Adversarial filter testing** — deliberately crafts findings designed to fool the FP filter (in fixtures) to harden it against edge cases.
0691. **Filter robustness scorer** — scores filter robustness per vuln class from adversarial tests, prioritizing hardening where the filter is weakest.
0692. **Explainable filter decisions** — requires every filter decision to carry a human-readable reason linked to learned patterns, enabling analyst override and feedback.
0693. **Filter-override learner** — learns from analyst overrides of filter decisions to refine filter thresholds per class.
0694. **Two-stage filter with learned gate** — learns when a cheap first-stage filter suffices vs when expensive deep analysis is warranted, optimizing the cost/accuracy tradeoff.
0695. **Cost-aware verification planner** — plans verification to minimize expected cost (requests + time + risk) for a target confidence level, per finding type.
0696. **Value-of-information calculator** — computes the expected value of additional testing before reporting a finding, reporting immediately when VOI goes negative.
0697. **Optimal-stopping for hunts** — learns optimal hunt stopping rules per target class (when marginal expected findings < cost), preventing both premature stops and endless hunts.
0698. **Anytime-report generator** — maintains a continuously updated draft report so any hunt can be stopped anytime with a coherent deliverable, learning which sections analysts read first.
0699. **Progress-predictor for ETA** — predicts hunt completion time from progress signals learned historically, giving analysts reliable ETAs.
0700. **Milestone-based learning checkpoints** — checkpoints learning updates at hunt milestones (recon done, testing done) so partial hunts still contribute knowledge.
0701. **Per-analyst calibration maps** — learns separate confidence-calibration maps per analyst since different analysts' "confirmed" bars differ, keeping reported confidence meaningful to each recipient.
0702. **Per-program calibration maps** — calibrates confidence separately per program type (bug bounty vs pentest vs self-assessment) since acceptance standards differ.
0703. **Severity-probability decoupling** — learns to report severity and confidence as independent calibrated quantities instead of conflating "severe" with "certain".
0704. **Impact-uncertainty modeler** — models uncertainty in impact assessment separately from exploitability uncertainty, since impact often depends on business context the agent can't see.
0705. **Business-context uncertainty flagger** — flags findings where business context could change severity, learning which finding types are most context-sensitive from analyst overrides.
0706. **Exploit-chain probability composer** — composes per-link success probabilities into chain-level probabilities with learned dependence corrections (links aren't independent).
0707. **Chain-link dependence learner** — learns which chain links' successes correlate (shared root causes) vs are independent, correcting naive probability multiplication.
0708. **Conditional exploitability scorer** — scores exploitability conditioned on prerequisites (auth, specific config), learning prerequisite structures per vuln class.
0709. **Prerequisite discovery learner** — learns to discover hidden prerequisites (required headers, state, roles) from failed-then-successful exploit attempts.
0710. **Environment-conditioned scoring** — learns how exploitability scores shift with environment (prod vs staging, with/without WAF) and reports conditioned scores.
0711. **Temporal exploitability modeler** — models how exploitability changes over time (patch likelihood, exploit publication) for each finding, with learned decay per class.
0712. **Fix-likelihood predictor** — predicts how likely each finding is to get fixed (from historical fix rates per class/vendor/severity) to help analysts prioritize follow-up.
0713. **Time-to-fix estimator** — estimates fix timelines per finding from historical data, informing retest scheduling.
0714. **Retest-timing optimizer** — learns optimal retest delays per vuln class and vendor from fix-verification history.
0715. **Working-memory tier manager** — manages the 3-tier memory (working → summary → long-term) with learned promotion/demotion policies based on access patterns and predictive value.
0716. **Attention-like retrieval scorer** — scores memory records by learned relevance to the current hunt state (not just recency), retrieving what matters now.
0717. **Episodic hunt memory** — stores hunts as episodes with rich context (goal, plan, surprises, outcome) enabling case-based reasoning: "this hunt resembles hunt #42".
0718. **Semantic lesson memory** — stores generalized lessons separate from episodes, with learned generalization strength per lesson.
0719. **Procedural skill memory** — stores learned procedures (how to test X on Y) as executable skills that improve with practice, separate from declarative knowledge.
0720. **Skill-practice scheduler** — schedules practice of procedural skills on the fixture farm during idle time, with priority by skill decay and importance.
0721. **Skill-decay modeler** — models how procedural skills decay without practice (e.g., rarely-used exploit chains) and refreshes them before live use.
0722. **Interleaved practice planner** — interleaves practice across skills (vs blocked practice) based on learned retention benefits, mirroring effective human learning.
0723. **Spaced-repetition for techniques** — applies spaced repetition scheduling to technique practice, with intervals adapted per technique from retention data.
0724. **Desirable-difficulty calibrator** — calibrates practice difficulty (fixture complexity) to the agent's current skill level per technique, maximizing learning rate.
0725. **Transfer-of-training measurer** — measures how fixture practice transfers to live hunts per technique, focusing practice where transfer is highest.
0726. **Negative-transfer warner** — warns when fixture practice might teach behaviors that hurt live performance (fixture artifacts), with learned artifact signatures.
0727. **Mental-model debugger** — maintains an explicit model of the agent's beliefs about each target and debugs it when predictions fail, pinpointing which belief was wrong.
0728. **Belief-revision logger** — logs every significant belief revision (what changed, what evidence caused it) creating an auditable trail of the agent's learning during a hunt.
0729. **Assumption tracker** — tracks assumptions made during a hunt (e.g., "assuming no WAF") with learned assumption-risk scores, revisiting high-risk assumptions first when stuck.
0730. **Stuck-detector** — learns the signature of being stuck (repeated similar failures, no new information) and triggers strategy shifts instead of grinding.
0731. **Strategy-shift recommender** — recommends specific strategy shifts when stuck, ranked by historical success of each shift in similar stuck states.
0732. **Fresh-eyes simulator** — periodically re-examines the target "as if new" (ignoring accumulated assumptions), learning when fresh-eyes reviews historically found missed vulns.
0733. **Red-team self-critique** — runs a learned critic that argues why the current plan will fail, trained on past plan failures, before committing major budget.
0734. **Pre-mortem generator** — generates pre-mortems ("assume this hunt found nothing; why?") from learned failure patterns, then patches the plan against the top reasons.
0735. **Alternative-hypothesis tracker** — maintains competing hypotheses about the target (e.g., "custom WAF" vs "no WAF") with learned likelihood updates from each observation.
0736. **Hypothesis-discrimination planner** — plans tests specifically to discriminate between competing hypotheses (maximum information gain), not just to find vulns.
0737. **Bayesian hunt-state updater** — maintains a Bayesian belief state over target properties updated with each observation, with learned observation models per check.
0738. **Observation-model learner** — learns the likelihood of each observation given each hidden state (e.g., P(403 | WAF) vs P(403 | no WAF)) from historical data.
0739. **Prior-predictive checker** — checks whether observations are surprising under current priors, triggering model revision when systematic surprises occur.
0740. **Posterior-predictive validator** — validates the belief state by predicting the next observation and scoring the prediction, tracking belief quality over a hunt.
0741. **Information-gain test selector** — selects the next test by expected information gain about the target (not just expected findings), learned from historical gain measurements.
0742. **Exploration-bonus decay scheduler** — decays exploration bonuses as hunt certainty grows, with the decay schedule learned per target class.
0743. **Curiosity-driven recon** — allocates a learned fraction of recon budget to pure curiosity (anomalous responses, weird endpoints) since anomalies historically precede novel findings.
0744. **Anomaly-response prioritizer** — prioritizes anomalous responses (unexpected status codes, strange headers) for deep investigation, with anomaly interestingness learned from past payoffs.
0745. **Serendipity logger** — logs serendipitous discoveries (findings from unplanned tests) and mines them for new systematic checks.
0746. **Serendipity-to-system converter** — converts recurring serendipitous discoveries into first-class checks with learned triggers.
0747. **Check-genesis tracker** — tracks the origin story of each check (serendipity, analyst suggestion, CVE, theory) to understand which sources produce the best checks.
0748. **Source-ROI ranker** — ranks check sources by historical ROI, directing future check-development effort toward the highest-ROI sources.
0749. **Theory-driven check designer** — generates checks from first-principles reasoning about new tech (e.g., "how would auth work in this new protocol?"), validated against fixtures before live use.
0750. **First-principles vuln predictor** — predicts likely vuln classes for novel technology from architectural reasoning, bootstrapping priors where no history exists.
0751. **Analogy engine for novel tech** — maps novel tech to the closest known analog ("this new framework is like Express + EJS") and inherits the analog's priors with uncertainty penalties.
0752. **Uncertainty-penalized transfer** — penalizes transferred priors by the distance between source and target, with the penalty function learned from transfer outcomes.
0753. **Abstention learner** — learns when to abstain from predicting (say "I don't know") rather than guessing, with abstention thresholds tuned by the cost of wrong predictions.
0754. **Selective prediction for severity** — abstains from severity scoring when uncertainty is high, reporting a range instead of a point estimate.
0755. **Confidence-interval reporter** — reports confidence intervals (not just point estimates) for key quantities, with interval calibration learned from historical coverage.
0756. **Conformal prediction for findings** — applies conformal prediction to finding confidence, giving statistically valid coverage guarantees tuned on historical data.
0757. **Risk-sensitive planner** — plans hunts to optimize risk-adjusted returns (not just expected findings), with risk aversion learned from incident history.
0758. **Worst-case scenario planner** — maintains worst-case plans for high-stakes targets (what if the WAF is stricter than it looks), with scenario probabilities learned historically.
0759. **Robust-strategy selector** — prefers strategies that perform well across a range of possible target properties (minimax regret) when uncertainty is high, with robustness learned from past variance.
0760. **Minimax-regret test ordering** — orders tests to minimize worst-case regret (missing an easy critical) rather than maximizing expected findings, for high-stakes hunts.
0761. **High-stakes mode trigger** — learns triggers for high-stakes mode (production, critical infra, sensitive data) from past incidents and tightens all safety/verification thresholds automatically.
0762. **Safety-margin learner** — learns appropriate safety margins (extra verification, reduced aggression) per stake level from historical incident costs.
0763. **Incident-cost modeler** — models the cost of different incident types (block, data exposure, service impact) from past data to inform risk-sensitive planning.
0764. **Near-miss cost estimator** — estimates what near-misses would have cost had they become incidents, keeping risk models honest about close calls.
0765. **Safety-investment optimizer** — optimizes how much hunt budget to spend on safety (verification, pacing) vs finding, per stake level, from historical cost-benefit data.
0766. **Defense-in-depth for autonomy** — layers multiple independent safety checks (learned from past bypass incidents) so no single failure enables unsafe autonomous action.
0767. **Safety-check effectiveness tracker** — tracks each safety check's historical catch rate, strengthening checks that catch real issues and fixing checks that never fire.
0768. **Adversarial safety testing** — red-teams the agent's own safety constraints in fixtures, learning where constraints can be circumvented and hardening them.
0769. **Constraint-bypass memory** — remembers how safety constraints were bypassed in testing (so they can be fixed), never as a capability to use.
0770. **Safe-exploration certifier** — certifies exploration strategies as safe via fixture testing before live use, with certification criteria learned from past incidents.
0771. **Corrigibility preserver** — ensures learning updates never degrade the agent's responsiveness to analyst overrides and stop commands, with regression tests for corrigibility.
0772. **Override-response learner** — learns to respond to overrides gracefully (acknowledge, adjust, explain) from analyst satisfaction data.
0773. **Stop-command reliability tracker** — tracks stop-command latency and reliability as a top safety metric, with learned early-warning signals from past slowdowns.
0774. **Pause-state consistency learner** — learns to reach consistent, resumable pause states reliably, from past pause/resume failure autopsies.
0775. **Resume-safety verifier** — verifies target state hasn't changed dangerously during a pause before resuming, with change-significance learned from past incidents.
0776. **Long-hunt drift monitor** — monitors for goal drift in long hunts (gradually expanding scope or changing objectives), with drift signatures learned from past incidents.
0777. **Objective-alignment checker** — periodically re-checks hunt actions against the original objective, learning which action patterns indicate drift.
0778. **Reward-hacking detector** — detects when the agent optimizes metrics (finding counts) at the expense of real goals (verified, valuable findings), with hacking signatures learned from past episodes.
0779. **Metric-gaming guard** — guards against gaming any single metric by optimizing a learned composite that balances quantity, quality, and safety.
0780. **Goodhart-effect monitor** — monitors for Goodhart effects (metric improves, reality doesn't) by tracking metric-reality divergence on held-out verification data.
0781. **Verification-holdout set** — maintains a holdout set of hunts never used for training, used solely to measure true generalization of the learning system.
0782. **Generalization-gap tracker** — tracks the gap between training-hunt performance and holdout performance per model, triggering simplification when the gap grows.
0783. **Model-complexity penalizer** — penalizes model complexity (Occam) in learning updates, with the penalty strength learned from generalization data.
0784. **Simple-baseline challenger** — keeps simple baselines (e.g., "test SQLi first on PHP") competing against complex learned models, adopting complexity only when it provably wins.
0785. **Interpretability requirement** — requires learned strategies to be explainable in analyst terms, with learned explainability checks blocking inscrutable-but-effective strategies from default status (they stay experimental).
0786. **Strategy-distillation to rules** — distills complex learned policies into simple human-readable rules where possible, verified to preserve performance on holdouts.
0787. **Rule-extraction validator** — validates extracted rules against the original policy on diverse scenarios before replacing the policy with rules.
0788. **Human-readable strategy cards** — maintains a card per strategy (when to use, why it works, evidence) auto-updated from experiment data, for analyst trust.
0789. **Trust-calibration communicator** — learns how to communicate the agent's capabilities and limits honestly (from analyst trust surveys/feedback), avoiding both overclaiming and underselling.
0790. **Limitation disclosure learner** — learns which limitations matter to analysts per hunt type and discloses them proactively in reports.
0791. **Uncertainty communicator** — learns phrasing that conveys uncertainty accurately without undermining justified confidence, from analyst comprehension feedback.
0792. **Expectation setter** — learns to set accurate expectations (what the hunt will/won't cover) from past expectation-mismatch incidents.
0793. **Progress communicator** — learns which progress signals analysts find meaningful (coverage, findings, ETA) vs noise, from engagement data.
0794. **Mid-hunt Q&A memory** — remembers analyst questions asked mid-hunt across hunts and learns which questions predict important findings (asking about X often precedes finding Y).
0795. **Question-driven test prioritizer** — when an analyst asks about a specific area mid-hunt, learns how to rebalance the plan to address the question without abandoning the systematic hunt.
0796. **Explanation-request learner** — learns which agent decisions analysts most want explained (from "why" questions) and proactively explains those decision types.
0797. **Decision-rationale logger** — logs concise rationales for major hunt decisions, with learned rationale templates per decision type for consistency.
0798. **Rationale-quality scorer** — scores rationale quality from analyst feedback ("that explanation helped" vs "confusing"), improving future explanations.
0799. **Counterfactual explainer** — explains decisions counterfactually ("I tested X first because on similar targets it finds 3x more than Y"), grounded in learned statistics.
0800. **Analogy explainer** — explains novel situations via retrieved similar past hunts, with analogy relevance learned from analyst ratings.
0801. **Lifelong learning orchestrator** — coordinates all learning subsystems (payload ranker, calibrator, transfer engine, experimenter) with a unified update schedule that prevents interference between learners.
0802. **Learner-interference detector** — detects when two learning subsystems pull in opposite directions (e.g., transfer says test X, bandit says test Y) and arbitrates by expected value.
0803. **Update-batching scheduler** — batches learning updates to run during idle CPU windows on the user's device, keeping interactive hunt performance smooth.
0804. **Background consolidation process** — runs nightly consolidation (like sleep): compressing the day's hunt data into lessons, pruning, and retraining, with learned optimal consolidation depth.
0805. **Dream-like replay for consolidation** — replays sampled past hunts during idle time to consolidate procedural knowledge, prioritizing surprising or high-value hunts.
0806. **Memory-replay prioritizer** — prioritizes which hunts to replay for consolidation by surprise, value, and staleness, learned from consolidation effectiveness.
0807. **Catastrophic-interference tester** — tests consolidated models against old holdout hunts after each consolidation to catch interference-induced forgetting.
0808. **Elastic knowledge protection** — protects high-value, rarely-updated knowledge (core vuln facts) from being overwritten by frequent small updates, with protection strength learned from value estimates.
0809. **Knowledge-version diff viewer** — shows analysts what changed in the knowledge base between versions (new rules, retired payloads) as structured data for review.
0810. **Change-impact predictor** — predicts the impact of a knowledge-base change on future hunt performance using replay simulation before applying it.
0811. **Graduated knowledge rollout** — rolls out knowledge changes to a fraction of hunts first, measuring impact before full adoption.
0812. **Knowledge-change rollback** — rolls back knowledge changes that degrade live performance, with automatic detection and analyst notification.
0813. **Multi-timescale learning** — maintains fast (per-hunt), medium (per-week), and slow (per-quarter) learning timescales, with each timescale's updates validated at its own cadence.
0814. **Timescale-interaction modeler** — models how fast-timescale adaptations interact with slow-timescale priors, preventing fast learning from corrupting stable knowledge.
0815. **Meta-learning rate tuner** — learns the learning rates themselves (how fast to update each subsystem) from historical update effectiveness.
0816. **Update-step validator** — validates each learning update against holdout data before committing, rejecting updates that don't generalize.
0817. **Pessimistic update rule** — applies pessimistic (conservative) updates when evidence is thin, with pessimism strength learned from past overconfident-update failures.
0818. **Optimistic exploration reserve** — reserves a fraction of learning capacity for optimistic exploration of uncertain knowledge, preventing premature convergence.
0819. **Knowledge-uncertainty quantifier** — quantifies uncertainty for every stored belief (not just point estimates), driving exploration toward the most uncertain high-value beliefs.
0820. **Active-learning query planner** — plans hunts partly to reduce knowledge uncertainty (active learning), choosing targets/tests that maximally reduce uncertainty about important beliefs.
0821. **Expected-value-of-experiment calculator** — computes the expected long-term value of running an experiment (knowledge gained × future hunts affected) to prioritize the experiment backlog.
0822. **Experiment-backlog ranker** — ranks candidate experiments by expected value, cost, and risk, maintaining a prioritized queue the agent works through over time.
0823. **Opportunistic experiment piggybacker** — piggybacks low-cost experiments onto live hunts when the marginal cost is near zero, with safety guardrails.
0824. **Natural-experiment harvester** — harvests natural experiments from hunt logs (variation that occurred naturally) converting them into causal evidence without new tests.
0825. **Quasi-experimental designer** — designs quasi-experiments (regression discontinuity, diff-in-diff) on observational hunt data to estimate causal effects of strategy changes.
0826. **Causal-graph learner** — learns a causal graph over hunt variables (target features → test choices → outcomes) enabling principled what-if reasoning.
0827. **Do-calculus query engine** — answers interventional queries ("what if we always tested IDOR first on fintech?") using the learned causal graph and historical data.
0828. **Counterfactual fairness checker** — checks that learned strategies don't systematically under-serve certain target classes (e.g., non-English targets) by comparing counterfactual outcomes.
0829. **Target-class equity monitor** — monitors finding velocity across target classes (language, region, size) and investigates systematic gaps as potential learning biases.
0830. **Language-bias corrector** — corrects for the knowledge base's bias toward English-language targets by upweighting learnings from non-English hunts.
0831. **Stack-popularity bias corrector** — corrects for over-representation of popular stacks in training data when generalizing to rare stacks.
0832. **Recency-bias balancer** — balances recency (new data matters more) against stability (old data has more samples) with learned per-category weights.
0833. **Sample-size-aware updater** — scales update strength by effective sample size, preventing tiny samples from causing wild swings in beliefs.
0834. **Hierarchical shrinkage applier** — shrinks per-target estimates toward parent-category means (industry, stack) when samples are small, with shrinkage learned from data.
0835. **Empirical-Bayes prior fitter** — fits priors empirically from the full hunt history (empirical Bayes) rather than hand-tuning, updating the fit as history grows.
0836. **Full-Bayesian critical beliefs** — maintains full posterior distributions (not point estimates) for the most decision-critical beliefs, updated with each hunt.
0837. **Posterior-predictive hunt simulator** — simulates hunts by sampling from posterior beliefs, generating realistic outcome distributions for planning.
0838. **Thompson-sampling hunt planner** — plans hunts by Thompson sampling over posterior beliefs about test effectiveness, naturally balancing exploration/exploitation at the hunt level.
0839. **Information-directed test selection** — selects tests by information-directed sampling (balancing regret and information gain) with learned tradeoff parameters.
0840. **Knowledge-gradient test prioritizer** — prioritizes tests by the gradient of expected knowledge gain, focusing effort where learning is fastest.
0841. **Learning-curve forecaster** — forecasts how quickly the agent will improve on a new target class given current knowledge, informing whether to invest in exploration.
0842. **Diminishing-learning detector** — detects when additional hunts on a target class stop teaching anything new, signaling it's time to explore new classes or techniques.
0843. **Novelty-seeking scheduler** — schedules hunts on novel target classes partly for learning value (not just finding value), with the novelty premium learned from past breakthroughs.
0844. **Breakthrough autopsy** — autopsies breakthrough hunts (unexpected big wins) to extract the generalizable lesson, preventing breakthroughs from remaining anecdotes.
0845. **Breakthrough-pattern amplifier** — amplifies breakthrough patterns across similar targets quickly while the window is open (before patches).
0846. **Window-of-opportunity tracker** — tracks time windows where specific techniques work (after disclosure, before patch) with learned window lengths per class.
0847. **Patch-race prioritizer** — prioritizes testing newly-disclosed vulns on matching targets during the patch race window, ranked by learned exploitability and target value.
0848. **Disclosure-to-test latency minimizer** — minimizes the latency from CVE disclosure to tested-on-user-targets by automating fingerprint matching and check generation.
0849. **Zero-day readiness drills** — runs drills on fixtures simulating zero-day scenarios (unknown vuln class) to keep the agent's novel-vuln response sharp, with learned drill scenarios.
0850. **Novel-vuln response playbook** — maintains a learned playbook for "we've never seen this vuln class" (isolate, characterize, generalize, weaponize-defensively, report) refined by drills.
0851. **Characterization-procedure learner** — learns procedures for characterizing unknown behaviors (is it injection? what context?) from past novel-vuln encounters.
0852. **Generalization-from-one learner** — learns to generalize from a single novel finding to a systematic check (one example → detector), validated on fixtures before live use.
0853. **One-shot check synthesizer** — synthesizes a detection check from a single observed novel finding, with learned synthesis templates per vuln family.
0854. **Few-shot payload generator** — generates payload variants from few examples of a novel filter using learned mutation grammars.
0855. **Grammar-induction for filters** — induces the grammar of an unknown filter from probe responses (which inputs pass/blocked), then generates bypasses from the induced grammar.
0856. **Filter-grammar library** — stores induced filter grammars per WAF/product with versioning, enabling instant bypass generation on re-encounter.
0857. **Bypass-transfer across filters** — learns which bypasses transfer across similar filters (same vendor, different version) vs need regeneration.
0858. **Adversarial-filter co-evolution** — co-evolves payload generators against learned filter models in simulation, staying ahead of filter updates.
0859. **Filter-model fidelity tracker** — tracks how accurately the learned filter model predicts real filter behavior, regenerating bypasses when fidelity drops.
0860. **Generative payload designer** — trains a local generative model on successful payloads to design novel payloads, with novelty and validity constraints learned from data.
0861. **Payload-validity discriminator** — learns to discriminate valid (syntactically plausible, context-appropriate) generated payloads from garbage before wasting requests.
0862. **Human-plausibility scorer** — scores generated payloads by how much they resemble human-crafted ones (analysts trust familiar shapes), learned from analyst feedback.
0863. **Payload-aesthetics learner** — learns that cleaner, minimal payloads get better analyst reception and prioritizes minimal working payloads in reports.
0864. **Minimal-PoC reducer** — learns delta-debugging strategies per vuln class to reduce working exploits to minimal PoCs automatically.
0865. **PoC-robustness tester** — tests PoCs for robustness (do they work repeatedly, across sessions) with learned robustness criteria per class.
0866. **PoC-portability scorer** — scores how portable a PoC is (works for the analyst without special setup), learning portability factors from analyst success reports.
0867. **Environment-dependency mapper** — maps PoC environment dependencies (tools, versions, network) explicitly, learning which dependencies analysts most often lack.
0868. **One-command PoC compiler** — compiles PoCs into single-command reproductions where possible, learning compilation patterns per vuln class.
0869. **PoC-failure diagnoser** — diagnoses why a PoC failed for an analyst (from their feedback) and learns to preempt those failure modes.
0870. **Analyst-environment modeler** — builds a model of the analyst's likely environment (OS, tools) from past interactions to tailor PoC formats.
0871. **Remediation-verifiability scorer** — scores remediation advice by how verifiable the fix is (can the analyst confirm it worked), learning verifiability from retest data.
0872. **Fix-confirmation check generator** — generates fix-confirmation checks alongside findings, learning which confirmation checks analysts actually run.
0873. **Regression-test suggester** — suggests regression tests to prevent reintroduction, learning which suggestions get adopted per vuln class.
0874. **Defense-in-depth recommender** — recommends layered defenses beyond the immediate fix, learning which recommendations analysts value per context.
0875. **Root-cause explainer** — explains root causes (not just symptoms) with learned root-cause patterns per vuln class, from analyst comprehension feedback.
0876. **Code-pattern-to-fix mapper** — maps vulnerable code patterns to fix patterns per language/framework, learned from historical remediation data.
0877. **Framework-specific fix advisor** — gives framework-version-specific fix advice (exact config, exact function), learning precision levels analysts prefer.
0878. **Fix-effort estimator** — estimates remediation effort per finding from historical fix data, helping analysts prioritize.
0879. **Fix-risk assessor** — assesses the risk of breaking functionality with each fix approach, learned from past fix-induced incidents.
0880. **Compensating-control suggester** — suggests compensating controls (WAF rules, monitoring) when immediate fixes aren't feasible, learning which controls analysts deploy.
0881. **WAF-rule generator from findings** — generates WAF rules that would have blocked the finding as a stopgap, validated in simulation before suggesting.
0882. **Detection-rule generator** — generates SIEM/detection rules for the vuln's exploitation signatures, learning rule quality from analyst adoption.
0883. **Threat-model updater** — suggests threat-model updates implied by findings, learning which suggestions improve future hunt planning.
0884. **Security-requirement generator** — generates security requirements that would have prevented the finding class, for the analyst's SDL process.
0885. **Training-material pointer** — points to relevant secure-coding training per finding class, learning which resources developers actually use.
0886. **Developer-empathy scorer** — scores report tone for developer empathy (blameless, constructive) from analyst/developer feedback, improving fix acceptance.
0887. **Blameless-language enforcer** — learns blameless phrasing patterns and applies them, avoiding language that historically caused defensive reactions.
0888. **Actionability scorer** — scores each report section by actionability (can the reader act on it?) learned from analyst behavior data.
0889. **Report-skim optimizer** — learns how analysts skim reports (eye-tracking proxies: which sections get edited/quoted) and front-loads what matters.
0890. **Executive-risk translator** — translates technical findings into business risk language, learning each stakeholder's risk vocabulary from feedback.
0891. **Compliance-mapping learner** — learns mappings from findings to compliance frameworks (OWASP, PCI, HIPAA) that auditors accept, from past audit feedback.
0892. **OWASP-category drift tracker** — tracks how the agent's OWASP categorizations align with analyst corrections over Top-10 revisions.
0893. **CWE-assignment accuracy learner** — learns CWE assignment accuracy from analyst corrections, improving automated CWE tagging.
0894. **CVSS-vector learner** — learns to construct accurate CVSS vectors from analyst-corrected scores, capturing environmental metrics properly.
0895. **Severity-framework adapter** — adapts severity to the analyst's framework (CVSS, custom scales, qualitative) learned from their past usage.
0896. **Risk-aggregation learner** — learns how analysts aggregate multiple findings into overall risk (not just max severity) from their executive summaries.
0897. **Finding-relationship mapper** — learns to map relationships between findings (same root cause, chain links, shared component) from analyst-merged reports.
0898. **Report-deduplication learner** — learns report-level deduplication (across hunts, across time) from analyst merge behavior.
0899. **Trend-report generator** — generates trend reports across hunts (is this target getting better/worse?), learning which trends analysts act on.
0900. **Posture-score learner** — learns a defensible security-posture scoring formula per target class from analyst agreement data.
0901. **Cross-hunt sequential pattern miner** — mines sequential patterns across hunts (recon signal A → testing choice B → finding C) to discover reusable playbooks the agent didn't explicitly program.
0902. **Playbook-extraction from traces** — extracts executable playbooks from successful hunt traces automatically, generalizing target-specific details into parameters.
0903. **Playbook-parameter learner** — learns which parts of an extracted playbook are parameters (target-specific) vs fixed structure, from variation across hunts.
0904. **Playbook-success predictor** — predicts a playbook's success probability on a new target from target features, learned from playbook application history.
0905. **Playbook-composition learner** — learns to compose playbooks (recon playbook + XSS playbook + chaining playbook) into coherent hunt plans, from successful compositions.
0906. **Hierarchical playbook library** — organizes playbooks hierarchically (strategy → phase → technique → payload) with learned navigation policies.
0907. **Playbook-versioning with lineage** — versions playbooks with full lineage (derived from which hunts, modified when/why) enabling rollback and attribution.
0908. **Playbook-A/B at scale** — runs playbook A/B tests continuously in the background of normal hunts (with guardrails), creating a perpetual improvement loop.
0909. **Negative-playbook library** — stores anti-playbooks (what NOT to do: patterns that waste budget or cause incidents) learned from failures, checked before planning.
0910. **Failure-pattern recognizer** — recognizes early signatures of known failure patterns mid-hunt and intervenes before the failure fully plays out.
0911. **Recovery-playbook library** — stores recovery procedures for hunt failures (blocked, broken auth, target down) with learned effectiveness per failure type.
0912. **Graceful-degradation planner** — plans hunts with degradation levels (full → reduced → minimal) switching down gracefully when problems occur, with switch triggers learned from incidents.
0913. **Partial-result valuator** — values partial hunt results (what was learned even without findings) so interrupted hunts still contribute calibrated knowledge.
0914. **Hunt-embedding for retrieval** — embeds whole hunts into vectors for similarity retrieval ("find hunts like this one"), with the embedding trained on hunt-outcome prediction.
0915. **Case-based reasoning engine** — retrieves the most similar past hunts and adapts their plans to the current target, with adaptation rules learned from past adaptations.
0916. **Adaptation-success tracker** — tracks whether adapted plans outperform fresh plans, tuning how aggressively the agent adapts vs invents.
0917. **Derivational analogy applier** — replays the reasoning trace (not just the actions) of a similar past hunt, adapting the reasoning to new evidence.
0918. **Transformational analogy learner** — learns transformation rules for adapting old plans to new targets (e.g., "replace PHP-specific steps with Node equivalents").
0919. **Analogy-quality estimator** — estimates how good an analogy is before committing to it, from features of the source-target match, learned from analogy outcomes.
0920. **Multi-source analogy blender** — blends plans from multiple similar hunts (not just the single best match), with blending weights learned from outcome data.
0921. **Ensemble-of-histories planner** — plans by ensembling predictions from many past hunts weighted by similarity, reducing dependence on any single analogy.
0922. **Diversity-promoting retrieval** — retrieves a diverse set of similar hunts (not just near-duplicates) to avoid groupthink in planning.
0923. **Contrarian-history miner** — specifically retrieves hunts where the obvious plan failed, ensuring the planner considers non-obvious approaches.
0924. **Outlier-hunt investigator** — investigates outlier hunts (wildly better/worse than predicted) deeply, since outliers carry disproportionate learning signal.
0925. **Black-swan finding archiver** — archives unprecedented findings with full context, building the agent's repertoire for truly novel vuln classes.
0926. **Novel-class detector** — detects when a finding doesn't fit any known vuln class (novelty scoring), triggering the novel-vuln response playbook.
0927. **Taxonomy-expansion proposer** — proposes taxonomy expansions for novel findings with supporting evidence, for analyst approval before adoption.
0928. **Emerging-threat radar** — synthesizes weak signals across hunts (slight upticks in odd behaviors) into early warnings of emerging threat patterns.
0929. **Weak-signal aggregator** — aggregates sub-threshold anomalies across hunts that individually mean nothing but collectively indicate a trend.
0930. **Trend-confirmer** — confirms suspected trends with targeted follow-up tests before promoting them to knowledge, controlling false alarms.
0931. **False-trend autopsy** — autopsies trends that didn't pan out, learning to distinguish real emergence from noise.
0932. **Hype-cycle modeler** — models the hype cycle of new techniques (inflated expectations → disillusionment → productive use) to time adoption sensibly.
0933. **Technique-maturity scorer** — scores technique maturity (experimental → proven → commodity → obsolete) with transitions learned from historical lifecycles.
0934. **Obsolescence predictor** — predicts when a technique will become obsolete (patch saturation, WAF coverage) from lifecycle features, timing retirement.
0935. **Successor-technique linker** — links obsolete techniques to their successors (what replaced X), so retirement automatically suggests the replacement.
0936. **Technique-lineage visualizer data** — exports technique lineage (parent → mutations → successors) as structured data for analyst review of the arsenal's evolution.
0937. **Arsenal-diversity monitor** — monitors the diversity of the active arsenal (technique families, vuln classes covered) and flags monoculture risks.
0938. **Monoculture-risk mitigator** — deliberately maintains minority techniques (even at lower ROI) as insurance against the dominant approach failing, with the insurance premium learned from past failures.
0939. **Redundant-capability pruner** — prunes truly redundant capabilities (identical coverage, worse performance) while preserving complementary ones, learned from coverage analysis.
0940. **Capability-coverage mapper** — maps which capabilities cover which parts of the vuln space, revealing uncovered regions for development.
0941. **Coverage-gap prioritizer** — prioritizes coverage gaps by expected finding value × likelihood of encountering the gap, directing research.
0942. **Research-direction recommender** — recommends research directions (new checks to develop) from coverage gaps, trend signals, and analyst requests.
0943. **Build-vs-borrow evaluator** — evaluates whether to build a new capability vs adapt an existing one, from historical build/adapt ROI data.
0944. **Capability-development tracker** — tracks new capability development from idea → fixture → shadow → live, with stage-gate criteria learned from past launches.
0945. **Launch-readiness scorer** — scores new capabilities' launch readiness (precision, recall, safety, cost) with thresholds learned from past launches.
0946. **Post-launch monitor** — monitors new capabilities post-launch for performance vs predictions, triggering fixes or rollback on divergence.
0947. **Capability-sunset process** — sunsets obsolete capabilities gracefully (deprecate → shadow → remove) with learned timing per capability type.
0948. **Legacy-capability archiver** — archives sunset capabilities with full documentation, enabling resurrection if the threat landscape cycles back.
0949. **Cyclical-threat memory** — remembers threat patterns that cycle (old vulns in new frameworks, retro tech revivals) so archived capabilities can be revived fast.
0950. **Retro-tech revival detector** — detects when old technology revives (e.g., server-rendered HTML comeback) and revives the corresponding archived knowledge.
0951. **Paradigm-shift adapter** — detects paradigm shifts (e.g., AI-agent targets, passkeys replacing passwords) and triggers accelerated learning for the new paradigm.
0952. **New-paradigm bootstrap** — bootstraps knowledge for new paradigms from first principles + analogy + aggressive experimentation, with learned bootstrap protocols.
0953. **Passkey-era auth prior builder** — builds auth-flaw priors for the passkey/WebAuthn era from early observations, replacing password-era priors where they no longer apply.
0954. **AI-agent-target playbook builder** — builds testing playbooks for AI-agent targets (prompt injection, tool abuse, memory poisoning) from early hunt data.
0955. **MCP-ecosystem threat modeler** — develops threat models for MCP-based integrations as the ecosystem matures, updated with each new observation.
0956. **Post-quantum crypto transition watcher** — watches for post-quantum crypto deployments and builds the corresponding testing knowledge (implementation flaws, downgrade attacks).
0957. **Confidential-computing attack surface learner** — learns the web-exposed attack surface of confidential-computing deployments (attestation flaws, side channels via APIs).
0958. **Edge-computing flaw profiler** — builds flaw profiles for edge-deployed apps (inconsistent state, edge-specific auth) from early observations.
0959. **WASM-module analyzer memory** — learns to analyze WASM modules for embedded secrets and logic flaws, with technique effectiveness tracked per toolchain.
0960. **eBPF-adjacent exposure learner** — tracks web-exposed eBPF/monitoring interfaces per vendor with historical flaw data.
0961. **Service-mesh API learner** — learns service-mesh admin API exposures (Istio, Linkerd) per distribution with historical findings.
0962. **GitOps pipeline exposure learner** — tracks exposed GitOps dashboards (ArgoCD, Flux) per deployment with historical auth-bypass data.
0963. **Feature-store exposure learner** — learns ML feature-store exposures (Feast, Tecton) per deployment with data-leak history.
0964. **Model-registry exposure learner** — tracks exposed ML model registries (MLflow, W&B) per deployment with historical findings.
0965. **Notebook-server exposure learner** — learns Jupyter/notebook server exposures per deployment with code-execution history.
0966. **Data-pipeline UI learner** — tracks data-pipeline UIs (Airflow, Prefect, Dagster) exposures per version with historical auth flaws.
0967. **BI-dashboard exposure learner** — learns BI dashboard (Superset, Metabase, Tableau) exposures per version with data-leak findings.
0968. **Low-code-admin exposure learner** — tracks low-code platform admin panels (Retool, Appsmith) exposures with historical misconfigurations.
0969. **Headless-CMS admin learner** — learns headless CMS admin exposures (Strapi, Directus, Payload) per version with historical findings.
0970. **Static-hosting misconfig learner** — tracks static-hosting (S3+CloudFront, Netlify, Vercel) misconfigurations per provider with historical exposure rates.
0971. **Edge-function flaw learner** — learns edge-function (Cloudflare Workers, Lambda@Edge) flaws per runtime with historical data.
0972. **Cron-job endpoint learner** — tracks exposed cron/scheduled-job endpoints per framework with historical unauthorized-trigger findings.
0973. **Webhook-receiver flaw learner** — learns webhook receiver verification flaws per provider (Stripe, GitHub) from client implementations.
0974. **API-key rotation gap learner** — learns API-key rotation and scoping flaws per provider from historical exposure data.
0975. **Service-account sprawl learner** — tracks service-account over-permission patterns per cloud provider with historical privilege-escalation findings.
0976. **Cross-account trust flaw learner** — learns cross-account IAM trust misconfigurations per cloud provider with historical data.
0977. **SSO-integration flaw learner** — tracks SSO integration flaws (SAML/OIDC misconfig) per identity provider with version-specific data.
0978. **Directory-sync flaw learner** — learns directory-sync (SCIM, LDAP sync) provisioning flaws per provider with historical findings.
0979. **Secrets-manager exposure learner** — tracks secrets-manager (Vault, AWS SM) web UI/API exposures per deployment with historical data.
0980. **Certificate-manager exposure learner** — learns certificate-manager (smallstep, EJBCA) web exposures with historical findings.
0981. **Backup-service exposure learner** — tracks backup-service (Veeam, Acronis) web console exposures per version with historical vulns.
0982. **Monitoring-dashboard learner** — learns monitoring dashboard (Grafana, Datadog, Prometheus) exposures per version with historical auth flaws.
0983. **Logging-platform exposure learner** — tracks logging platform (ELK, Splunk, Loki) web exposures with historical data-leak findings.
0984. **Tracing-platform exposure learner** — learns tracing platform (Jaeger, Tempo) exposures with historical data-leak findings.
0985. **Status-page admin learner** — tracks status-page (Cachet, Statuspage) admin exposures with historical findings.
0986. **Feature-flag admin learner** — learns feature-flag admin (LaunchDarkly, Unleash) exposures per deployment with historical findings.
0987. **Experimentation-admin learner** — tracks experimentation platform admin exposures with historical misconfigurations.
0988. **CDN-config exposure learner** — learns CDN config/purge API exposures per provider with historical findings.
0989. **DNS-admin exposure learner** — tracks DNS admin panel exposures per provider with historical takeover-adjacent findings.
0990. **Domain-registrar session learner** — learns registrar-session and domain-management flaws per registrar with historical data.
0991. **Certificate-transparency alerter** — learns issuance patterns per target from CT logs and alerts on unexpected certificates (defensive monitoring).
0992. **Subdomain-takeover sentinel** — continuously re-checks previously-safe subdomains for newly-dangling records, learning provider-specific dangling signatures.
0993. **Expiring-domain watcher** — watches target-adjacent domains for expiration (typosquats, old brands) with learned risk scoring per domain type.
0994. **Lookalike-domain detector** — learns lookalike-domain patterns targeting the user's scope (homoglyphs, combosquats) for defensive alerting.
0995. **Phishing-kit reuse detector** — learns phishing-kit fingerprints impersonating target brands from historical data, for defensive reporting.
0996. **Brand-impersonation monitor** — monitors for brand-impersonating assets (fake login pages, apps) with learned impersonation signatures per industry.
0997. **Data-breach correlator** — correlates public breach data (user-provided) with target exposure to prioritize credential-stuffing-adjacent tests within authorization.
0998. **Leaked-credential policy learner** — learns each target's response to leaked-credential testing signals (from authorized tests) to calibrate password-spray-adjacent checks.
0999. **Continuous-learning health score** — computes a single health score for the entire learning system (calibration + transfer gain + experiment velocity + knowledge freshness) tracked over time as the ultimate meta-metric.
1000. **Learning-system self-improvement loop** — the learning system itself learns how to learn better: tracking which learning algorithms improved hunt outcomes most and allocating more capacity to the winners, closing the meta-learning loop entirely on-device.
