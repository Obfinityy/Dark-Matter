# Batch 4 — Part 04: Target profiling & fingerprinting (33005–34004)

33005. **Multi-signal stack unifier** — merges HTTP headers, HTML markers, JS artifacts, and TLS fingerprints into a single confidence-scored technology profile per host.
33006. **Header-signature stack classifier** — classifies backend technologies from Server, X-Powered-By, and Via header combinations against a trained header-pattern corpus.
33007. **HTML-marker stack inference engine** — extracts generator meta tags, template comments, and framework-specific DOM patterns to identify frontend and backend stacks.
33008. **Cookie-name stack detector** — infers server frameworks from session-cookie naming conventions (e.g., JSESSIONID, PHPSESSID) correlated with other signals.
33009. **Error-page stack revealer** — triggers safe diagnostic error pages to capture framework-branded stack traces and version banners.
33010. **Favicon-hash stack matcher** — hashes favicons and matches them against a known database of default CMS/framework icons to identify platforms.
33011. **TLS-cipher stack profiler** — correlates negotiated TLS cipher suites and extensions with default configurations of known web servers and frameworks.
33012. **Response-timing stack fingerprint** — measures per-framework timing signatures of identical requests to distinguish between candidate backends.
33013. **DNS-TXT stack correlator** — cross-references SPF, verification, and provider TXT records with observed stack signals to confirm SaaS-based stacks.
33014. **Sitemap-generator stack extractor** — parses sitemap XML generator attributes and URL structures to infer CMS or framework origins.
33015. **Robots-txt stack analyzer** — matches robots.txt directives, sitemap references, and disallowed paths against CMS-specific default files.
33016. **HTTP/2 settings fingerprint** — fingerprints servers from HTTP/2 SETTINGS frame parameters and flow-control behaviors unique to server implementations.
33017. **Case-sensitivity stack probe** — tests URL path case sensitivity to distinguish case-sensitive Linux stacks from case-insensitive Windows/IIS stacks.
33018. **Trailing-slash behavior profiler** — records how each endpoint handles trailing slashes and redirects to build a routing-behavior fingerprint per stack.
33019. **Default-file stack checker** — requests stack-specific default files (readme.html, web.config, phpinfo artifacts) to confirm suspected platforms.
33020. **Directory-listing style classifier** — classifies auto-index page layouts (Apache, nginx, IIS styles) into server-implementation families.
33021. **ETag format stack identifier** — parses ETag formatting conventions (inode-size-mtime vs weak validators) to identify web server software.
33022. **Date-format header profiler** — inspects Date header formats and timezone behaviors to distinguish server implementations and OS timezones.
33023. **Content-encoding order analyzer** — fingerprints servers from the order and case of Accept-Encoding negotiation responses.
33024. **Chunked-transfer behavior profiler** — observes chunked transfer-encoding quirks and trailer handling to fingerprint server implementations.
33025. **Keep-alive parameter extractor** — reads Keep-Alive timeout and max values from headers to distinguish server defaults (Apache vs nginx vs IIS).
33026. **OPTIONS-method capability profiler** — parses Allow headers from OPTIONS responses to map supported methods per endpoint and infer framework routers.
33027. **WebSocket handshake fingerprint** — fingerprints WebSocket upgrade implementations from Sec-WebSocket-Accept computation and header quirks.
33028. **CORS-preflight behavior profiler** — records preflight response patterns (headers echoed, credentials allowed) to fingerprint CORS middleware per framework.
33029. **Redirect-chain stack inference** — analyzes redirect status codes, Location header formats, and hop counts to infer framework routing layers.
33030. **Canonical-host redirect profiler** — captures www-vs-apex and HTTP-to-HTTPS redirect behavior to fingerprint CDN or framework defaults.
33031. **HSTS-policy stack profiler** — extracts HSTS max-age, includeSubDomains, and preload flags as part of the target's security-stack fingerprint.
33032. **Security-header stack mapper** — inventories X-Frame-Options, CSP, and Referrer-Policy combinations to identify security-middleware stacks.
33033. **Cache-header stack classifier** — classifies caching layers from X-Cache, Age, and Cache-Control header families per response route.
33034. **Session-token format analyzer** — decodes session token structure (JWT vs opaque vs signed) to identify authentication frameworks.
33035. **Password-reset flow profiler** — maps reset-token delivery mechanisms and URL patterns to identify auth providers and frameworks.
33036. **Login-form stack detector** — parses login form field names, CSRF token formats, and hidden fields to identify auth frameworks.
33037. **CSRF-token scheme classifier** — classifies CSRF token generation schemes (synchronizer, double-submit, encrypted) per framework.
33038. **API-error format profiler** — fingerprints API frameworks from error response schemas (JSON:API, Problem Details, GraphQL errors).
33039. **GraphQL-introspection stack probe** — uses introspection availability and schema shapes to identify GraphQL server implementations.
33040. **OpenAPI-spec stack extractor** — fetches published OpenAPI/Swagger specs to extract server, framework, and version metadata.
33041. **gRPC-reflection stack probe** — queries gRPC reflection endpoints to enumerate services and identify server implementations.
33042. **Health-endpoint stack discoverer** — probes conventional health/readiness endpoints (/healthz, /actuator/health) to identify framework conventions.
33043. **Metrics-endpoint stack finder** — checks for exposed Prometheus/OpenMetrics endpoints whose metric names reveal frameworks and versions.
33044. **Debug-toolbar detector** — detects framework debug toolbars (Django, Symfony, Laravel) injected in development-mode responses.
33045. **Source-map stack revealer** — downloads exposed source maps to recover original framework file paths and build-tool signatures.
33046. **Build-artifact fingerprint scanner** — identifies bundler fingerprints (webpack, Vite, esbuild) from chunk naming and runtime code in JS assets.
33047. **CSS-framework classifier** — classifies CSS frameworks from class-name conventions (Tailwind, Bootstrap, Bulma) in rendered styles.
33048. **Font-loading stack profiler** — inventories webfont loading strategies and font providers as auxiliary stack signals.
33049. **Image-format stack inference** — detects server-side image optimization (WebP/AVIF conversion, srcset generation) to identify image pipelines.
33050. **Video-player stack detector** — identifies video player libraries and streaming backends from player markup and manifest URLs.
33051. **Comment-system stack identifier** — detects embedded comment platforms (Disqus, custom) from script tags and iframe origins.
33052. **Search-implementation profiler** — identifies site-search backends (Algolia, Elasticsearch, custom) from query parameters and response shapes.
33053. **Form-builder stack detector** — recognizes form-builder platforms from embed scripts and field-naming patterns.
33054. **Chat-widget stack identifier** — inventories live-chat widgets from script sources and maps them to vendor platforms.
33055. **A/B-testing framework detector** — detects experimentation platforms from injected scripts and variant cookie patterns.
33056. **Tag-manager stack profiler** — identifies tag-management systems (GTM, Segment) and enumerates tags they load.
33057. **Consent-banner stack classifier** — classifies cookie-consent platforms from banner markup and consent-string formats.
33058. **Payment-form stack detector** — identifies payment processors from checkout form fields, iframe origins, and tokenization scripts.
33059. **Map-embed stack profiler** — detects mapping providers (Google Maps, Mapbox, Leaflet) from embed scripts and tile URLs.
33060. **Calendar-widget stack identifier** — recognizes scheduling widgets from embed patterns and booking-flow URLs.
33061. **Social-login provider mapper** — enumerates OAuth providers from login-button URLs and authorization endpoint domains.
33062. **Email-capture stack detector** — identifies newsletter/marketing platforms from signup form actions and script sources.
33063. **Push-notification stack profiler** — detects web-push providers from service-worker registrations and manifest files.
33064. **PWA-manifest stack extractor** — parses web app manifests for platform hints, icon sets, and display-mode conventions.
33065. **Service-worker stack analyzer** — inspects service-worker scripts for caching-library fingerprints (Workbox) and offline strategies.
33066. **Manifest-icon stack matcher** — matches PWA icon filenames and sizes against framework starter-template defaults.
33067. **Structured-data stack extractor** — parses JSON-LD blocks for generator hints and platform-specific schema usage.
33068. **RSS-feed generator profiler** — reads RSS/Atom feed generator elements to identify publishing platforms.
33069. **Sitemap-index stack analyzer** — analyzes sitemap index structures and URL patterns for CMS-specific generation logic.
33070. **AMP-page stack detector** — detects AMP implementations and their generator toolchains from AMP boilerplate variants.
33071. **PWA-vs-native wrapper detector** — distinguishes true PWAs from WebView wrappers via user-agent handling and native-bridge scripts.
33072. **Hybrid-app bridge profiler** — detects native-bridge interfaces (Capacitor, Cordova) exposed to web content.
33073. **Electron-app stack identifier** — identifies Electron-based desktop apps from exposed process versions and DevTools markers.
33074. **Serverless-platform detector** — detects serverless hosting from response headers, cold-start timing, and provider-specific artifacts.
33075. **Edge-compute stack profiler** — identifies edge runtimes (Cloudflare Workers, Lambda@Edge) from execution headers and timing patterns.
33076. **Container-orchestration hint extractor** — reads orchestration hints from headers and routing behaviors indicating Kubernetes or similar platforms.
33077. **Reverse-proxy chain reconstructor** — reconstructs proxy chains from layered Via, X-Forwarded-For, and Server headers.
33078. **Load-balancer fingerprint engine** — fingerprints load balancers from cookie names (BIGipServer, AWSALB) and stickiness behaviors.
33079. **Rate-limit header profiler** — inventories rate-limit header schemes (X-RateLimit, Retry-After formats) to identify gateway products.
33080. **API-gateway stack classifier** — classifies API gateways (Kong, Apigee, AWS) from gateway-specific headers and error formats.
33081. **Service-mesh signal detector** — detects service-mesh sidecars from injected headers and mTLS behavior indicators.
33082. **CDN-vs-origin differentiator** — distinguishes CDN-edge responses from origin responses via header and timing differentials per route.
33083. **Multi-region stack profiler** — probes regional endpoints to map geo-distributed stack variations of the same application.
33084. **Staging-environment stack finder** — discovers staging/dev subdomains and profiles their stacks to reveal pre-production technologies.
33085. **Mobile-API stack profiler** — profiles mobile backend APIs separately from web stacks via versioned endpoints and client hints.
33086. **WebSocket-subprotocol profiler** — enumerates negotiated WebSocket subprotocli to identify real-time frameworks.
33087. **SSE-implementation fingerprint** — fingerprints Server-Sent Events implementations from stream framing and retry headers.
33088. **HTTP/3 stack detector** — detects HTTP/3/QUIC support and identifies server implementations from Alt-Svc advertisements.
33089. **Early-hints stack profiler** — observes 103 Early Hints support to fingerprint servers with preload capabilities.
33090. **Compression-algorithm profiler** — fingerprints servers from supported compression algorithms (Brotli, zstd) and negotiation order.
33091. **Content-negotiation behavior mapper** — maps content-negotiation outcomes across Accept variants to fingerprint framework routers.
33092. **Language-negotiation stack probe** — tests Accept-Language handling to identify i18n middleware per framework.
33093. **Timezone-handling stack profiler** — observes datetime serialization formats in APIs to infer backend language and framework.
33094. **Number-format stack inference** — detects locale-aware number/currency formatting in responses to infer backend localization stacks.
33095. **Pagination-scheme classifier** — classifies API pagination styles (cursor, offset, page tokens) to identify framework conventions.
33096. **Sorting-parameter stack probe** — tests sort-parameter syntaxes (?sort=, ?order_by=) to fingerprint API framework query conventions.
33097. **Filtering-syntax stack mapper** — maps filter-query syntaxes (RSQL, JSON:API filters) to backend framework families.
33098. **Bulk-operation stack detector** — probes bulk/batch endpoint conventions to identify API framework patterns.
33099. **Webhook-signature scheme profiler** — identifies webhook signing schemes (HMAC headers, timestamp tolerance) to map provider platforms.
33100. **Event-stream format classifier** — classifies event payload formats (CloudEvents, custom envelopes) to identify eventing stacks.
33101. **Message-queue hint extractor** — extracts queue-system hints from async API response patterns and callback conventions.
33102. **Cache-invalidation pattern profiler** — observes cache-busting query parameters and purge behaviors to identify caching layers.
33103. **Stack-drift change detector** — re-profiles targets on a schedule and diffs stack signatures to alert on technology changes.
33104. **Confidence-weighted stack reporter** — renders the unified stack profile with per-signal confidence scores and conflicting-evidence flags.
33105. **Version-banner harvester** — collects Server and X-Powered-By version strings across all endpoints and resolves them to exact framework releases.
33106. **Asset-hash version matcher** — hashes served JS/CSS assets and matches them against a versioned database of framework release bundles.
33107. **Changelog-marker version probe** — requests known changelog or readme files whose content identifies the precise installed release.
33108. **Comment-version extractor** — parses HTML/JS comments containing version stamps to pin exact framework builds.
33109. **API-schema version correlator** — correlates OpenAPI version fields and schema quirks with framework release histories.
33110. **Error-message version oracle** — catalogs framework-specific error message wording changes across releases to identify versions.
33111. **Behavioral-version differential** — tests version-dependent behaviors (e.g., changed default headers) to narrow the release range.
33112. **Dependency-manifest reader** — fetches exposed package manifests (package.json, composer.json) to enumerate exact dependency versions.
33113. **Lockfile exposure checker** — detects publicly accessible lockfiles that pin every dependency to exact versions.
33114. **Source-map version revealer** — extracts version strings embedded in exposed source maps and original file paths.
33115. **Build-timestamp version inference** — reads build timestamps in assets and correlates them with official release dates.
33116. **Font-version fingerprint** — matches bundled icon-font versions against release histories of UI frameworks.
33117. **CSS-class version classifier** — classifies utility-class naming generations (e.g., Bootstrap 4 vs 5) to identify major versions.
33118. **JS-runtime version detector** — detects runtime helpers ($.fn.jquery version, React internals) exposed in page scripts.
33119. **Polyfill-version profiler** — inventories polyfill bundles whose composition reveals target browser eras and framework versions.
33120. **Transpiler-output version probe** — analyzes transpiled code patterns to identify Babel/TypeScript compiler versions.
33121. **Sourcemap-URL version hunter** — follows sourcemap comment URLs that sometimes encode build hashes traceable to releases.
33122. **Webpack-runtime version identifier** — fingerprints webpack runtime versions from bootstrap code signatures.
33123. **Vite-manifest version extractor** — parses Vite manifest files for hashed asset names tied to specific build versions.
33124. **Next.js-build-id version probe** — extracts Next.js build IDs and correlates them with deployment versions.
33125. **Nuxt-payload version detector** — reads Nuxt payload structures that change shape between major versions.
33126. **Angular-version artifact scanner** — detects Angular version markers in compiled bundles and zone.js signatures.
33127. **React-version fiber profiler** — fingerprints React versions from internal fiber properties and devtool hooks.
33128. **Vue-version global detector** — reads Vue global object version properties exposed on window.
33129. **Svelte-compile version probe** — identifies Svelte compiler versions from generated component code patterns.
33130. **Ember-version marker scanner** — detects Ember version metadata embedded in application namespaces.
33131. **Backbone-version identifier** — fingerprints Backbone/Underscore versions from library file headers.
33132. **Django-version admin probe** — uses Django admin login page markup variants to identify Django releases.
33133. **Rails-version asset fingerprint** — matches Rails asset pipeline fingerprints and CSRF meta formats to Rails versions.
33134. **Laravel-version cookie probe** — reads Laravel encrypted-cookie formats and version-specific response headers.
33135. **Symfony-version profiler** — detects Symfony versions from profiler toolbar artifacts and exception page layouts.
33136. **Express-version header probe** — infers Express versions from X-Powered-By variants and middleware header behaviors.
33137. **Koa-version middleware fingerprint** — fingerprints Koa versions from context-object behaviors and error formats.
33138. **Fastify-version schema probe** — identifies Fastify versions from schema-validation error message formats.
33139. **NestJS-version decorator probe** — detects NestJS versions from dependency-injection metadata and error shapes.
33140. **Spring-Boot-version actuator probe** — reads Spring Boot Actuator responses whose fields vary by release.
33141. **ASP.NET-version header classifier** — classifies ASP.NET Core versions from Server header and Kestrel behaviors.
33142. **PHP-version extension probe** — infers PHP versions from extension-specific behaviors and error output formats.
33143. **WordPress-version readme matcher** — matches readme.html content and generator tags to exact WordPress releases.
33144. **Drupal-version changelog probe** — reads CHANGELOG.txt variants to pin Drupal core versions.
33145. **Joomla-version manifest reader** — parses Joomla XML manifests that declare exact component versions.
33146. **Magento-version static probe** — fingerprints Magento versions from static asset paths and admin URL conventions.
33147. **Shopify-theme version detector** — reads theme version metadata from Shopify theme files and asset URLs.
33148. **Ghost-version API probe** — queries Ghost Content API version fields and admin client build markers.
33149. **Strapi-version admin probe** — detects Strapi versions from admin panel bundle signatures.
33150. **Directus-version schema probe** — reads Directus API schema version fields and SDK markers.
33151. **Payload-CMS version detector** — fingerprints Payload CMS versions from admin UI bundle hashes.
33152. **KeystoneJS-version probe** — identifies KeystoneJS versions from GraphQL schema generation patterns.
33153. **Flask-version debugger probe** — detects Flask/Werkzeug versions from debugger PIN page markers in debug mode.
33154. **FastAPI-version docs probe** — reads FastAPI auto-generated docs metadata for version and dependency pins.
33155. **Tornado-version header classifier** — classifies Tornado versions from Server header strings.
33156. **Bottle-version error probe** — identifies Bottle versions from error page templates.
33157. **Pyramid-version tween probe** — fingerprints Pyramid versions from tween and renderer behaviors.
33158. **Phoenix-version websocket probe** — detects Phoenix versions from channel protocol negotiation details.
33159. **Gin-version header probe** — infers Gin versions from response header conventions.
33160. **Echo-version error classifier** — classifies Echo framework versions from HTTP error JSON shapes.
33161. **Fiber-version probe** — fingerprints Fiber versions from fasthttp-derived behaviors.
33162. **Actix-version header probe** — identifies Actix-web versions from Server header values.
33163. **Rocket-version fairing probe** — detects Rocket versions from fairing and responder behaviors.
33164. **Axum-version tower probe** — fingerprints Axum versions from tower middleware header patterns.
33165. **Hapi-version plugin probe** — identifies Hapi versions from plugin registration error formats.
33166. **Restify-version probe** — detects Restify versions from formatter and audit-log behaviors.
33167. **Sails-version blueprint probe** — fingerprints Sails versions from blueprint API conventions.
33168. **AdonisJS-version probe** — identifies AdonisJS versions from exception page and validator formats.
33169. **FeathersJS-version probe** — detects Feathers versions from service event and hook behaviors.
33170. **LoopBack-version explorer probe** — reads LoopBack API explorer metadata for version pins.
33171. **Meteor-version DDP probe** — fingerprints Meteor versions from DDP protocol negotiation messages.
33172. **DerbyJS-version probe** — identifies Derby versions from ShareDB protocol markers.
33173. **CakePHP-version debug probe** — detects CakePHP versions from debug-kit toolbar signatures.
33174. **CodeIgniter-version probe** — fingerprints CodeIgniter versions from error page and config behaviors.
33175. **Yii-version asset probe** — identifies Yii versions from asset bundle naming conventions.
33176. **Zend-Laminas version probe** — detects Laminas versions from module-manager and DI behaviors.
33177. **Slim-version probe** — fingerprints Slim versions from route collector and error handler formats.
33178. **Lumen-version probe** — identifies Lumen versions from Laravel-derived response markers.
33179. **October-CMS version probe** — detects October CMS versions from backend UI asset hashes.
33180. **Statamic-version probe** — fingerprints Statamic versions from control-panel bundle signatures.
33181. **Craft-CMS version probe** — identifies Craft CMS versions from control panel markup and headers.
33182. **Kirby-version probe** — detects Kirby versions from panel asset fingerprints.
33183. **Grav-version probe** — fingerprints Grav versions from admin plugin markers.
33184. **Hugo-version generator probe** — reads Hugo generator meta tags for exact version strings.
33185. **Jekyll-version feed probe** — detects Jekyll versions from feed generator tags.
33186. **Gatsby-version webpack probe** — fingerprints Gatsby versions from page-data JSON structures.
33187. **Gridsome-version probe** — identifies Gridsome versions from GraphQL schema markers.
33188. **Docusaurus-version probe** — detects Docusaurus versions from docs bundle signatures.
33189. **VuePress-version probe** — fingerprints VuePress versions from generated page markers.
33190. **MkDocs-version probe** — identifies MkDocs versions from theme template signatures.
33191. **Sphinx-version probe** — detects Sphinx versions from documentation HTML boilerplate.
33192. **BookStack-version probe** — fingerprints BookStack versions from UI asset hashes.
33193. **Wiki.js-version probe** — identifies Wiki.js versions from admin bundle signatures.
33194. **Outline-version probe** — detects Outline versions from editor bundle markers.
33195. **Discourse-version probe** — fingerprints Discourse versions from Ember bundle hashes and API version fields.
33196. **NodeBB-version probe** — identifies NodeBB versions from theme and plugin markers.
33197. **Flarum-version probe** — detects Flarum versions from forum bundle signatures.
33198. **Vanilla-Forums version probe** — fingerprints Vanilla versions from Smarty template markers.
33199. **phpBB-version probe** — identifies phpBB versions from style and language file markers.
33200. **MyBB-version probe** — detects MyBB versions from theme and plugin signatures.
33201. **XenForo-version probe** — fingerprints XenForo versions from JS bundle hashes.
33202. **vBulletin-version probe** — identifies vBulletin versions from template and phrase markers.
33203. **Version-confidence aggregator** — combines all version signals into a single best-estimate release with uncertainty bounds.
33204. **EOL-version risk flagger** — flags detected framework versions that are end-of-life and maps them to known CVE exposure windows.
33205. **WAF-vendor block-page classifier** — matches block-page HTML, status codes, and reference IDs against a vendor block-page signature library.
33206. **WAF-response-header profiler** — inventories WAF-specific response headers (e.g., X-Sucuri, CF-RAY families) to identify vendors passively.
33207. **WAF-cookie signature matcher** — identifies WAF vendors from injected cookies and their naming/encryption conventions.
33208. **WAF-challenge behavior profiler** — records JavaScript-challenge and CAPTCHA interstitial patterns to fingerprint bot-management products.
33209. **WAF-status-code taxonomy mapper** — builds a per-target map of which attack probes return 403 vs 406 vs 419 to fingerprint rule engines.
33210. **WAF-evasion-strategy selector** — recommends per-vendor evasion approaches (encoding, chunking, method tweaks) based on the identified WAF model.
33211. **WAF-rule-paranoia estimator** — estimates WAF paranoia level from block thresholds on graded benign-to-malicious probe ladders.
33212. **WAF-learning-mode detector (profiling context)** — detects whether the WAF is in monitoring-only mode by comparing logged vs blocked probe outcomes.
33213. **WAF-per-path policy mapper** — profiles which routes are WAF-protected vs unprotected to find coverage gaps in the policy.
33214. **WAF-per-method policy profiler** — tests method-specific rule application to map which HTTP methods the WAF inspects.
33215. **WAF-header-inspection profiler** — determines which request headers trigger rules to infer inspected header sets.
33216. **WAF-body-inspection profiler** — tests whether JSON, XML, and multipart bodies are inspected equally to map body-parsing coverage.
33217. **WAF-encoding-normalization profiler** — profiles how the WAF normalizes double-encoding and unicode to fingerprint normalization engines.
33218. **WAF-multipart-parsing profiler** — observes multipart boundary handling differences to fingerprint WAF parsers.
33219. **WAF-JSON-depth profiler** — tests nested-JSON depth limits to fingerprint parser configurations.
33220. **WAF-XML-entity profiler** — probes XML external-entity handling to identify WAF XML inspection capabilities.
33221. **WAF-websocket-coverage profiler** — determines whether WebSocket upgrade traffic is inspected by the WAF.
33222. **WAF-gRPC-coverage profiler** — tests whether gRPC binary payloads pass through WAF inspection.
33223. **WAF-API-vs-web policy differ** — compares WAF strictness between web routes and API routes to find policy inconsistencies.
33224. **WAF-mobile-vs-desktop profiler** — tests whether WAF rules differ by user-agent class to find mobile-specific gaps.
33225. **WAF-geo-policy mapper** — probes from multiple egress regions to map geo-based WAF rule variations.
33226. **WAF-rate-limit correlator** — correlates WAF blocks with rate-limit headers to distinguish WAF rules from throttling.
33227. **WAF-false-positive baseline** — sends benign traffic shaped like attacks to measure WAF false-positive rates per rule class.
33228. **WAF-version banner extractor** — captures WAF version disclosures in headers, block pages, and error responses.
33229. **WAF-cloud-vs-onprem classifier** — distinguishes cloud WAF deployments from on-premise appliances via network and header signals.
33230. **WAF-managed-ruleset identifier** — identifies which managed ruleset (OWASP CRS version, vendor defaults) is active from block patterns.
33231. **WAF-custom-rule detector** — detects custom rules layered over managed rulesets from anomalous block behaviors.
33232. **WAF-virtual-patching profiler** — infers virtual-patching coverage by testing recently disclosed CVE probes against the WAF.
33233. **WAF-DDoS-layer mapper** — profiles DDoS mitigation layers (L3/L4 vs L7) from challenge behaviors under load.
33234. **WAF-bot-score profiler** — extracts bot-score headers or behaviors to fingerprint bot-management scoring models.
33235. **WAF-TLS-fingerprinting detector** — detects JA3/JA4-based blocking by testing with varied TLS fingerprints.
33236. **WAF-IP-reputation profiler** — tests whether blocks correlate with IP reputation by rotating source IPs.
33237. **WAF-account-takeover ruleset profiler** — probes credential-stuffing-shaped traffic to identify ATO-specific rule coverage.
33238. **WAF-API-abuse ruleset profiler** — tests API-scraping-shaped traffic to map API-abuse rule coverage.
33239. **WAF-payment-fraud ruleset profiler** — probes carding-shaped traffic patterns to identify payment-fraud rule sets.
33240. **WAF-CMS-ruleset detector** — tests CMS-specific attack probes to detect CMS-targeted managed rules.
33241. **WAF-logging-visibility probe** — determines whether blocked requests appear in accessible logs or status pages.
33242. **WAF-bypass-history learner** — records which evasion techniques historically worked against the identified WAF to prioritize future attempts.
33243. **WAF-signature-update detector** — re-tests fixed probe sets over time to detect WAF signature updates.
33244. **Multi-WAF stack detector** — identifies layered WAF deployments (CDN WAF + origin WAF) from stacked headers and double blocks.
33245. **WAF-origin-bypass path finder** — maps origin IPs and alternate hostnames that bypass the WAF layer entirely.
33246. **WAF-header-spoof sensitivity** — tests whether X-Forwarded-For and similar headers alter WAF decisions to find trust misconfigurations.
33247. **WAF-host-header policy profiler** — tests Host-header variants to map WAF virtual-host policy scoping.
33248. **WAF-SNI-policy profiler** — tests SNI variations to determine whether WAF policy binds to TLS handshake data.
33249. **WAF-HTTP/2-vs-HTTP/1 profiler** — compares WAF strictness across HTTP versions to find protocol-specific gaps.
33250. **WAF-HTTP/3-coverage profiler** — tests whether QUIC/HTTP-3 traffic receives the same WAF inspection.
33251. **WAF-chunked-evasion profiler** — profiles WAF handling of chunked transfer encoding variants.
33252. **WAF-range-request profiler** — tests Range-request handling to fingerprint WAF request-smuggling defenses.
33253. **WAF-pipelining profiler** — observes HTTP pipelining handling to identify WAF connection-level behaviors.
33254. **WAF-0day-virtual-patch tracker** — tracks how quickly the WAF blocks probes for newly published CVEs to score vendor responsiveness.
33255. **WAF-rule-ID extractor (profiling context)** — harvests WAF rule IDs from block pages and headers to enumerate active rule sets.
33256. **WAF-anomaly-score profiler** — infers anomaly-scoring thresholds from graduated probe severities.
33257. **WAF-correlation-engine detector** — tests multi-request attack patterns to detect cross-request correlation rules.
33258. **WAF-session-tracking profiler** — determines whether the WAF tracks sessions to inform stateful rule detection.
33259. **WAF-device-fingerprint profiler** — detects WAF-side device fingerprinting from challenge and scoring behaviors.
33260. **WAF-CAPTCHA-vendor identifier** — identifies CAPTCHA providers (reCAPTCHA, hCaptcha, Turnstile) used in WAF challenges.
33261. **WAF-JS-challenge solver profiler** — profiles JavaScript challenge complexity to estimate bot-mitigation strength.
33262. **WAF-proof-of-work detector** — detects proof-of-work challenges and estimates their computational cost.
33263. **WAF-TLS-challenge profiler** — detects TLS-level challenges and fingerprinting in the handshake phase.
33264. **WAF-DNS-challenge detector** — identifies DNS-based verification steps in WAF onboarding flows.
33265. **WAF-API-shield profiler** — profiles API-shield features like schema validation and token enforcement.
33266. **WAF-schema-validation detector** — tests whether the WAF validates requests against OpenAPI schemas.
33267. **WAF-graphql-inspection profiler** — tests GraphQL query inspection depth and complexity limits.
33268. **WAF-file-upload profiler** — profiles file-upload inspection (MIME sniffing, archive scanning) behaviors.
33269. **WAF-SQLi-rule granularity mapper** — maps which SQLi payload classes are blocked to infer rule granularity.
33270. **WAF-XSS-rule granularity mapper** — maps which XSS payload classes are blocked to infer rule granularity.
33271. **WAF-RCE-rule granularity mapper** — maps which command-injection classes are blocked to infer rule coverage.
33272. **WAF-LFI-rule granularity mapper** — maps which path-traversal classes are blocked to infer rule coverage.
33273. **WAF-SSRF-rule granularity mapper** — maps which SSRF target classes are blocked to infer egress rule coverage.
33274. **WAF-XXE-rule granularity mapper** — maps which XXE payload classes are blocked to infer XML rule coverage.
33275. **WAF-deserialization-rule mapper** — tests deserialization payload shapes to map WAF object-injection rules.
33276. **WAF-prototype-pollution profiler** — tests prototype-pollution payloads to identify JS-specific rule coverage.
33277. **WAF-SSTI-rule mapper** — maps template-injection payload coverage to infer template-engine rules.
33278. **WAF-open-redirect profiler** — tests redirect payloads to map open-redirect rule presence.
33279. **WAF-CSRF-rule detector** — determines whether the WAF enforces any CSRF protections.
33280. **WAF-clickjacking-rule detector** — checks whether the WAF injects frame-protection headers.
33281. **WAF-information-disclosure profiler** — tests whether the WAF strips stack traces and version banners.
33282. **WAF-cache-poisoning guard profiler** — tests cache-key handling to detect cache-deception protections.
33283. **WAF-subdomain-takeover guard detector** — checks for WAF-level dangling-DNS protections.
33284. **WAF-CDN-integration profiler** — profiles how the WAF integrates with the CDN layer (shared vs separate policy).
33285. **WAF-origin-shield detector** — detects origin-shield configurations that hide origin infrastructure.
33286. **WAF-log-pipeline mapper** — identifies where WAF logs flow (SIEM, vendor dashboards) from exposed integrations.
33287. **WAF-alert-threshold profiler** — estimates alerting thresholds from graduated attack intensities.
33288. **WAF-incident-response profiler** — observes block-duration escalation to infer automated incident-response playbooks.
33289. **WAF-allowlist detector** — detects IP/ASN allowlisting by testing from varied sources.
33290. **WAF-maintenance-mode profiler** — identifies maintenance-mode behaviors that reveal WAF bypass windows.
33291. **WAF-staging-policy differ** — compares WAF strictness between production and staging environments.
33292. **WAF-canary-deployment detector** — detects canary WAF policy rollouts from inconsistent block behaviors.
33293. **WAF-A/B-policy detector** — identifies A/B-tested WAF policies from request-cohort block variations.
33294. **WAF-report-confidence scorer** — scores overall WAF identification confidence and lists corroborating evidence.
33295. **WAF-fingerprint change alerter** — monitors WAF signatures over time and alerts when vendor or policy changes.
33296. **WAF-vendor market correlator** — correlates identified WAF with vendor market data for procurement-context reporting.
33297. **WAF-cost-tier estimator** — estimates the WAF subscription tier from enabled features and limits observed.
33298. **WAF-coverage heatmap builder** — renders a route-by-method heatmap of WAF protection coverage.
33299. **WAF-residual-risk scorer** — scores residual risk from WAF gaps mapped during profiling.
33300. **WAF-profile export packager** — exports the complete WAF profile as a structured evidence pack for the hunt report.
33301. **WAF-evasion playbook generator** — generates a vendor-specific, policy-aware testing playbook from the WAF profile.
33302. **WAF-safe-test planner** — plans probe sequences that stay within WAF-safe boundaries to avoid IP bans during hunts.
33303. **WAF-ban recovery advisor** — detects IP bans and recommends rotation or cooldown strategies.
33304. **WAF-profile diff reporter** — diffs WAF profiles across re-scans to highlight policy drift for regression tracking.
33305. **CDN-provider header classifier** — identifies CDN vendors from provider-specific response headers (Server, Via, X-Cache families).
33306. **CDN-edge-node mapper** — maps edge node identities from response headers to geographic PoP locations.
33307. **CDN-cache-behavior profiler** — profiles per-route cache HIT/MISS/EXPIRED behaviors to map the target's cache policy.
33308. **CDN-cache-key profiler** — determines which request elements (query params, headers, cookies) form cache keys per route.
33309. **CDN-cache-TTL extractor** — extracts TTL values from Age, Cache-Control, and Expires headers per content type.
33310. **CDN-purge-capability profiler** — detects purge endpoints and authentication to map cache-invalidation workflows.
33311. **CDN-stale-content profiler** — measures stale-while-revalidate and stale-if-error behaviors per route.
33312. **CDN-tiered-cache detector** — detects multi-tier caching (edge + shield/origin-shield) from layered cache headers.
33313. **CDN-origin-shield mapper** — identifies shield PoP assignments and origin-shield routing configurations.
33314. **CDN-arl-token profiler** — detects authenticated-request/URL-token schemes used for protected CDN content.
33315. **CDN-signed-URL detector** — identifies signed-URL and signed-cookie schemes protecting premium content.
33316. **CDN-token-auth profiler** — profiles token-authentication parameters (expiry, IP binding) on protected assets.
33317. **CDN-geo-restriction mapper** — tests geo-blocked content delivery to map geographic restriction policies.
33318. **CDN-image-optimization profiler** — profiles on-the-fly image transformation parameters (width, format, quality) per CDN.
33319. **CDN-video-segment profiler** — analyzes HLS/DASH segment delivery to identify video-CDN configurations.
33320. **CDN-websocket-support profiler** — determines WebSocket proxying support and timeout behaviors per CDN.
33321. **CDN-HTTP/3-support detector** — detects QUIC/HTTP-3 availability per edge PoP.
33322. **CDN-early-hints profiler** — observes 103 Early Hints support across CDN edge nodes.
33323. **CDN-compression profiler** — profiles per-content-type compression (Brotli, zstd) applied at the edge.
33324. **CDN-minification detector** — detects edge-side HTML/CSS/JS minification and its configurability.
33325. **CDN-header-manipulation mapper** — maps edge-injected, stripped, and rewritten headers per route.
33326. **CDN-cookie-handling profiler** — profiles how the CDN treats cookies (strip, forward, vary) per route.
33327. **CDN-query-string profiler** — maps query-string caching rules (ignore, whitelist, all) per route.
33328. **CDN-device-detection profiler** — detects edge device detection and variant serving (mobile/desktop) behaviors.
33329. **CDN-A/B-testing profiler** — identifies edge-side experimentation and traffic-splitting configurations.
33330. **CDN-edge-compute detector** — detects edge functions/workers modifying responses at the edge.
33331. **CDN-edge-redirect profiler** — maps edge-level redirect rules distinct from origin redirects.
33332. **CDN-edge-auth profiler** — detects edge-executed authentication (JWT validation, basic auth) before origin.
33333. **CDN-bot-management profiler** — profiles CDN-integrated bot management scores and challenge behaviors.
33334. **CDN-DDoS-profile mapper** — maps DDoS mitigation tiers from rate-limit and challenge behaviors.
33335. **CDN-rate-limit profiler** — measures edge rate-limit thresholds and window behaviors per route.
33336. **CDN-origin-health profiler** — detects origin health-check behaviors and failover routing.
33337. **CDN-failover-behavior mapper** — observes failover responses during simulated origin issues to map resilience configs.
33338. **CDN-multi-CDN detector** — detects multi-CDN deployments from DNS steering and header variations.
33339. **CDN-DNS-steering profiler** — profiles DNS-based traffic steering (geographic, performance) across CDN vendors.
33340. **CDN-anycast mapper** — maps anycast IP ranges to PoPs via multi-vantage-point probing.
33341. **CDN-IPv6-support profiler** — tests IPv6 delivery support per edge node.
33342. **CDN-TLS-config profiler** — profiles edge TLS versions, cipher suites, and certificate configurations.
33343. **CDN-cert-issuer mapper** — maps certificate issuers per hostname to identify CDN-managed vs customer certificates.
33344. **CDN-SNI-routing profiler** — tests SNI-based routing behaviors to map CDN virtual-host configurations.
33345. **CDN-custom-domain profiler** — detects CDN usage behind custom domains via CNAME chains and header leaks.
33346. **CDN-subdomain-enumeration profiler** — profiles which subdomains sit behind the CDN vs direct-origin.
33347. **CDN-partial-adoption mapper** — maps mixed CDN adoption (some routes cached, others direct) per target.
33348. **CDN-cache-deception profiler** — tests path-confusion cache behaviors to map cache-deception exposure.
33349. **CDN-cache-poisoning profiler** — profiles unkeyed-input reflection to map cache-poisoning risk per route.
33350. **CDN-web-cache-deception mapper** — maps static-extension handling that enables web-cache-deception attacks.
33351. **CDN-normalization-differ** — compares CDN vs origin URL normalization to find desync issues.
33352. **CDN-origin-IP hunter** — discovers origin IPs leaked through misconfigured DNS, headers, or historical records.
33353. **CDN-origin-protection profiler** — evaluates origin shielding effectiveness (firewall rules, header secrets).
33354. **CDN-true-client-IP profiler** — identifies which headers carry true client IPs through the CDN layer.
33355. **CDN-log-pipeline detector** — detects CDN log delivery integrations (S3, SIEM) from configuration leaks.
33356. **CDN-analytics profiler** — identifies CDN analytics and RUM integrations from beacon endpoints.
33357. **CDN-WAF-integration profiler** — profiles WAF features bundled with the CDN vs standalone WAF layers.
33358. **CDN-firewall-rule profiler** — maps CDN edge firewall rules distinct from origin WAF rules.
33359. **CDN-access-control profiler** — profiles edge access controls (IP allowlists, ASN blocks, country blocks).
33360. **CDN-hotlink-protection profiler** — detects hotlink protection on media assets and its bypass surface.
33361. **CDN-leech-protection profiler** — profiles leech protection on downloads and streaming content.
33362. **CDN-bandwidth-throttle profiler** — measures edge bandwidth throttling behaviors per content type.
33363. **CDN-large-file profiler** — profiles large-file delivery optimizations and segmentation behaviors.
33364. **CDN-range-request profiler** — tests Range-request support and multi-range handling at the edge.
33365. **CDN-prefetch profiler** — detects edge prefetching behaviors and their cache implications.
33366. **CDN-push-profiler** — profiles HTTP/2 server-push or 103-based push behaviors at the edge.
33367. **CDN-stale-if-error profiler** — measures stale-serving during origin outages to map resilience configs.
33368. **CDN-soft-purge profiler** — detects soft-purge vs hard-purge semantics in cache invalidation.
33369. **CDN-surrogate-key profiler** — identifies surrogate-key/tag-based purging schemes.
33370. **CDN-cache-tag mapper** — maps cache-tag usage for grouped invalidation workflows.
33371. **CDN-grace-mode profiler** — profiles grace-mode serving of expired content under origin load.
33372. **CDN-shield-selection profiler** — identifies shield PoP selection logic and regional assignments.
33373. **CDN-collapsed-forwarding detector** — detects request collapsing/coalescing at the edge.
33374. **CDN-origin-retry profiler** — profiles edge retry logic on origin failures (counts, backoff).
33375. **CDN-timeout profiler** — measures edge-to-origin timeout configurations per route.
33376. **CDN-keepalive profiler** — profiles edge-to-origin keepalive and connection reuse behaviors.
33377. **CDN-header-size profiler** — tests edge header-size limits to fingerprint CDN software.
33378. **CDN-URL-length profiler** — measures edge URL-length limits per CDN implementation.
33379. **CDN-method-support profiler** — maps HTTP method support at the edge (WebDAV, custom methods).
33380. **CDN-websocket-timeout profiler** — measures WebSocket idle timeouts enforced at the edge.
33381. **CDN-SSE-support profiler** — tests Server-Sent Events streaming through the CDN layer.
33382. **CDN-gRPC-support profiler** — tests gRPC proxying support and protocol handling at the edge.
33383. **CDN-HTTP/2-prioritization profiler** — profiles HTTP/2 prioritization handling per CDN.
33384. **CDN-connection-coalescing profiler** — observes connection coalescing behaviors across hostnames.
33385. **CDN-OCSP-stapling profiler** — checks OCSP stapling support per edge certificate.
33386. **CDN-CT-log mapper** — correlates Certificate Transparency logs with CDN certificate issuance.
33387. **CDN-certificate-transparency profiler** — profiles CDN certificate automation and renewal behaviors.
33388. **CDN-private-PKI detector** — detects private PKI or custom CA usage behind the CDN.
33389. **CDN-mTLS-support profiler** — tests mutual-TLS termination capabilities at the edge.
33390. **CDN-client-cert profiler** — profiles client-certificate authentication passthrough behaviors.
33391. **CDN-token-bucket profiler** — infers token-bucket rate-limit parameters from throttling patterns.
33392. **CDN-abuse-contact extractor** — extracts abuse-contact and NOC details from CDN provider records.
33393. **CDN-terms-of-service mapper** — maps CDN acceptable-use constraints relevant to authorized testing.
33394. **CDN-cost-tier estimator** — estimates CDN plan tier from enabled features and limits.
33395. **CDN-performance benchmarker** — benchmarks TTFB and throughput per PoP for performance context.
33396. **CDN-cache-efficiency scorer** — scores cache-hit ratios per route to quantify CDN effectiveness.
33397. **CDN-configuration-drift detector** — re-profiles CDN configs over time to detect drift.
33398. **CDN-migration detector** — detects CDN vendor migrations from header and DNS changes.
33399. **CDN-fingerprint confidence scorer** — scores CDN identification confidence with corroborating evidence.
33400. **CDN-profile export packager** — exports the full CDN profile as structured evidence for the hunt report.
33401. **CDN-edge-config visualizer** — renders per-route edge behavior as an interactive configuration map.
33402. **CDN-route risk scorer** — scores per-route risk from cache behaviors (poisoning, deception, stale auth).
33403. **CDN-vs-origin diff reporter** — diffs edge vs origin responses to highlight edge-introduced discrepancies.
33404. **CDN-change alert monitor** — monitors CDN configurations continuously and alerts on meaningful changes.
33405. **Cloud IP-range correlator** — matches target IPs against published cloud provider IP ranges to attribute infrastructure.
33406. **Cloud reverse-DNS profiler** — parses PTR records for provider-specific hostname patterns (e.g., ec2, cloudapp) to identify clouds.
33407. **Cloud ASN mapper** — maps BGP ASN ownership to cloud providers for network-level attribution.
33408. **Cloud TLS-cert correlator** — correlates certificate issuers, SANs, and transparency logs with cloud-managed certificate services.
33409. **Cloud DNS-NS profiler** — identifies cloud DNS hosting (Route53, Cloud DNS, Azure DNS) from nameserver patterns.
33410. **Cloud load-balancer fingerprint** — fingerprints cloud load balancers (ALB, NLB, Azure LB) from header and behavior signatures.
33411. **Cloud object-storage detector** — detects cloud object storage (S3, GCS, Blob) from URL patterns and response headers.
33412. **Cloud CDN-origin correlator** — correlates CDN origins with cloud storage buckets and compute endpoints.
33413. **Cloud Kubernetes detector** — detects managed Kubernetes (EKS, GKE, AKS) from ingress behaviors and header artifacts.
33414. **Cloud serverless detector** — identifies serverless platforms (Lambda, Cloud Functions, Azure Functions) from execution signatures.
33415. **Cloud API-gateway mapper** — maps cloud API gateways (API Gateway, APIM) from endpoint structures and headers.
33416. **Cloud WAF-service profiler** — identifies cloud-native WAF services (AWS WAF, Cloud Armor) from rule behaviors.
33417. **Cloud DDoS-service detector** — detects cloud DDoS protection services (Shield, Cloud Armor) from mitigation behaviors.
33418. **Cloud database-service profiler** — identifies managed database services from connection behaviors and error messages.
33419. **Cloud cache-service detector** — detects managed cache services (ElastiCache, Memorystore) from latency and behavior hints.
33420. **Cloud queue-service profiler** — identifies managed messaging services from async API patterns.
33421. **Cloud function-URL mapper** — enumerates cloud function URLs and their invocation patterns.
33422. **Cloud container-registry profiler** — detects container registry usage from image pull URLs and auth flows.
33423. **Cloud CI/CD artifact detector** — finds CI/CD pipeline artifacts (build IDs, deployment markers) revealing cloud DevOps services.
33424. **Cloud IAM-hint extractor** — extracts IAM role and policy hints from error messages and metadata endpoints.
33425. **Cloud metadata-endpoint profiler** — safely profiles metadata service accessibility to identify cloud platforms.
33426. **Cloud region mapper** — determines cloud regions from latency triangulation and region-specific endpoints.
33427. **Cloud AZ-distribution profiler** — infers availability-zone distribution from response variations.
33428. **Cloud multi-region detector** — detects multi-region deployments from geo-routing behaviors.
33429. **Cloud failover profiler** — observes failover behaviors to map disaster-recovery configurations.
33430. **Cloud backup-service detector** — identifies cloud backup services from snapshot and restore URL patterns.
33431. **Cloud logging-service profiler** — detects cloud logging integrations (CloudWatch, Stackdriver) from log-format leaks.
33432. **Cloud monitoring-service detector** — identifies cloud monitoring agents from beacon endpoints and headers.
33433. **Cloud tracing-service profiler** — detects distributed tracing headers (X-Ray, Cloud Trace) revealing observability stacks.
33434. **Cloud secret-manager detector** — finds secret-manager references in configuration leaks and error messages.
33435. **Cloud KMS-usage profiler** — detects key-management service usage from encryption header patterns.
33436. **Cloud service-mesh detector** — identifies cloud service-mesh offerings (App Mesh, Anthos) from sidecar behaviors.
33437. **Cloud VPC-hint extractor** — extracts VPC and subnet hints from internal hostnames and error messages.
33438. **Cloud NAT-gateway profiler** — identifies NAT gateway egress IPs from outbound-request behaviors.
33439. **Cloud VPN-service detector** — detects cloud VPN endpoints from handshake behaviors.
33440. **Cloud Direct-Connect profiler** — infers dedicated interconnect usage from latency and routing patterns.
33441. **Cloud private-link detector** — detects PrivateLink/Private Service Connect endpoints from DNS patterns.
33442. **Cloud peering-hint extractor** — extracts peering relationship hints from routing and latency data.
33443. **Cloud marketplace-service detector** — identifies third-party services procured via cloud marketplaces.
33444. **Cloud cost-center hint extractor** — finds billing/project identifiers in URLs and headers revealing cloud account structure.
33445. **Cloud organization-mapper** — reconstructs cloud account/project hierarchies from resource naming patterns.
33446. **Cloud tag-hint extractor** — extracts resource-tag hints from exposed metadata and error messages.
33447. **Cloud compliance-service detector** — detects cloud compliance tooling (Security Hub, Security Command Center) from headers.
33448. **Cloud guardrail profiler** — identifies cloud policy guardrails from blocked-action error messages.
33449. **Cloud audit-log detector** — finds audit-log delivery configurations from log-format artifacts.
33450. **Cloud SIEM-integration profiler** — detects SIEM forwarding integrations from log destinations.
33451. **Cloud SOAR-hint extractor** — finds automation/orchestration hints in incident-response behaviors.
33452. **Cloud backup-region mapper** — maps backup regions from replication behaviors and endpoints.
33453. **Cloud DR-drill detector** — detects disaster-recovery testing windows from traffic pattern changes.
33454. **Cloud spot-instance profiler** — infers spot/preemptible usage from interruption-pattern artifacts.
33455. **Cloud autoscaling profiler** — detects autoscaling behaviors from capacity-change patterns.
33456. **Cloud scheduled-scaling detector** — identifies scheduled scaling from periodic capacity patterns.
33457. **Cloud burstable-instance profiler** — infers burstable instance usage from CPU-credit behavior hints.
33458. **Cloud GPU-workload detector** — detects GPU-backed workloads from ML endpoint behaviors.
33459. **Cloud TPU-workload detector** — identifies TPU usage from ML serving patterns.
33460. **Cloud inference-endpoint profiler** — profiles ML inference endpoints to identify serving frameworks.
33461. **Cloud vector-DB detector** — detects managed vector databases from semantic-search API behaviors.
33462. **Cloud feature-store profiler** — identifies feature-store usage from ML pipeline artifacts.
33463. **Cloud MLOps-service detector** — detects MLOps platform integrations from experiment-tracking artifacts.
33464. **Cloud data-warehouse profiler** — identifies data-warehouse query patterns in analytics endpoints.
33465. **Cloud ETL-service detector** — detects ETL pipeline artifacts in data API behaviors.
33466. **Cloud stream-processing profiler** — identifies stream-processing services (Kinesis, Pub/Sub) from event patterns.
33467. **Cloud batch-processing detector** — detects batch-job artifacts in report-generation endpoints.
33468. **Cloud workflow-orchestrator profiler** — identifies workflow orchestrators (Step Functions, Workflows) from execution patterns.
33469. **Cloud event-bus detector** — detects event-bus integrations (EventBridge) from event schemas.
33470. **Cloud scheduler-service profiler** — identifies scheduled-job services from cron-like execution patterns.
33471. **Cloud notification-service detector** — detects notification services (SNS, Pub/Sub) from webhook patterns.
33472. **Cloud email-service profiler** — identifies cloud email services (SES, SendGrid-on-cloud) from mail headers.
33473. **Cloud SMS-service detector** — detects cloud SMS services from message-delivery patterns.
33474. **Cloud push-service profiler** — identifies cloud push-notification services from device-token flows.
33475. **Cloud identity-service detector** — detects cloud identity services (Cognito, Identity Platform) from auth flows.
33476. **Cloud directory-service profiler** — identifies directory integrations (AD, Cloud Directory) from login behaviors.
33477. **Cloud SSO-service detector** — detects cloud SSO brokers from SAML/OIDC endpoint patterns.
33478. **Cloud certificate-service profiler** — identifies certificate-management services from issuance patterns.
33479. **Cloud DNSSEC profiler** — checks DNSSEC deployment across cloud DNS zones.
33480. **Cloud private-DNS detector** — detects split-horizon DNS indicating private cloud zones.
33481. **Cloud hybrid-connector detector** — identifies hybrid-cloud connectors from on-prem routing hints.
33482. **Cloud edge-location mapper** — maps cloud edge locations serving the target via latency and headers.
33483. **Cloud wavelength-zone detector** — detects edge-compute zone usage from ultra-low-latency endpoints.
33484. **Cloud local-zone profiler** — identifies local-zone deployments from metro-specific endpoints.
33485. **Cloud outpost-detector** — detects on-premises cloud extensions from hybrid behaviors.
33486. **Cloud sovereign-region detector** — identifies sovereign-cloud region usage from endpoint patterns.
33487. **Cloud multi-cloud detector** — detects multi-cloud deployments from mixed provider signals.
33488. **Cloud portability profiler** — assesses cloud-portability signals (abstraction layers, standard APIs).
33489. **Cloud lock-in scorer** — scores vendor lock-in depth from proprietary-service usage.
33490. **Cloud spend-tier estimator** — estimates cloud spend tier from resource-scale signals.
33491. **Cloud support-plan profiler** — infers cloud support engagement from response patterns.
33492. **Cloud TAM-hint extractor** — finds technical-account-management hints in enterprise behaviors.
33493. **Cloud partner-network detector** — detects cloud partner integrations from co-branded artifacts.
33494. **Cloud reseller hint extractor** — identifies reseller relationships from billing artifacts.
33495. **Cloud attribution confidence scorer** — scores cloud-provider attribution confidence with evidence chains.
33496. **Cloud infrastructure graph builder** — builds a visual graph of attributed cloud resources and relationships.
33497. **Cloud misconfig correlator** — correlates cloud attribution with known misconfiguration patterns per provider.
33498. **Cloud shared-responsibility mapper** — maps observed controls to cloud shared-responsibility models.
33499. **Cloud profile diff tracker** — tracks cloud infrastructure changes across re-profiles.
33500. **Cloud migration detector** — detects cloud-to-cloud or on-prem-to-cloud migrations from signal changes.
33501. **Cloud exit-signal detector** — identifies signals of cloud repatriation or provider switching.
33502. **Cloud compliance-region mapper** — maps data-residency compliance from region attributions.
33503. **Cloud data-flow mapper** — maps cross-region and cross-service data flows from observed behaviors.
33504. **Cloud profile export packager** — exports the complete cloud attribution profile as structured hunt evidence.
33505. **CMS generator-tag harvester** — collects generator meta tags across pages to identify CMS platforms and versions.
33506. **CMS readme-file matcher** — fetches CMS-specific readme/license files and matches content to exact releases.
33507. **CMS login-page fingerprint** — fingerprints CMS admin login pages by markup, CSS, and script signatures.
33508. **CMS admin-path enumerator** — probes conventional admin paths per CMS to confirm platform presence.
33509. **CMS REST-API detector** — detects CMS REST APIs (wp-json, Drupal JSON:API) and enumerates exposed endpoints.
33510. **CMS GraphQL detector** — identifies CMS GraphQL endpoints (WPGraphQL, Drupal) and schema shapes.
33511. **CMS XML-RPC profiler** — profiles XML-RPC endpoints to identify CMS platforms and enabled methods.
33512. **CMS plugin inventory builder** — enumerates installed plugins from asset paths, readme files, and API disclosures.
33513. **CMS theme inventory builder** — enumerates installed themes from stylesheet paths and screenshot markers.
33514. **CMS plugin-version extractor** — extracts plugin versions from readme.txt stable-tag fields and asset headers.
33515. **CMS theme-version extractor** — extracts theme versions from style.css headers.
33516. **CMS known-vuln cross-referencer** — cross-references detected CMS/plugin/theme versions against vulnerability databases.
33517. **CMS abandoned-plugin detector** — identifies plugins not updated in years as high-risk components.
33518. **CMS nulled-plugin detector** — detects pirated/nulled premium plugins from license-check bypass artifacts.
33519. **CMS shortcode inventory** — inventories active shortcodes to infer installed plugins and page-builder usage.
33520. **CMS block inventory** — enumerates Gutenberg/custom blocks revealing plugin and theme capabilities.
33521. **CMS widget inventory** — maps sidebar/widget configurations to plugin footprints.
33522. **CMS menu-structure profiler** — analyzes navigation structures for CMS-specific menu management patterns.
33523. **CMS media-library profiler** — profiles media URL patterns (uploads/year/month) to confirm CMS platforms.
33524. **CMS user-enumeration profiler** — safely tests author archives and API user endpoints to map user exposure.
33525. **CMS comment-system profiler** — identifies comment plugins and moderation configurations.
33526. **CMS form-plugin mapper** — enumerates form-builder plugins from form markup and submission endpoints.
33527. **CMS SEO-plugin detector** — detects SEO plugins (Yoast, RankMath) from meta-tag patterns.
33528. **CMS cache-plugin profiler** — identifies caching plugins from cache headers and comment markers.
33529. **CMS security-plugin detector** — detects security plugins (Wordfence, Sucuri) from firewall behaviors.
33530. **CMS backup-plugin detector** — finds backup plugins from backup-file artifacts and schedules.
33531. **CMS migration-artifact finder** — detects migration-plugin leftovers revealing previous platforms.
33532. **CMS multilingual-plugin profiler** — identifies translation plugins (WPML, Polylang) from URL and hreflang patterns.
33533. **CMS e-commerce detector** — detects e-commerce extensions (WooCommerce, Drupal Commerce) from cart and checkout flows.
33534. **CMS membership-plugin profiler** — identifies membership/restriction plugins from gated-content behaviors.
33535. **CMS LMS-plugin detector** — detects learning-management plugins from course URL structures.
33536. **CMS forum-plugin profiler** — identifies forum plugins (bbPress) from forum URL patterns.
33537. **CMS event-plugin detector** — detects event-management plugins from calendar markup.
33538. **CMS booking-plugin profiler** — identifies booking plugins from reservation-flow artifacts.
33539. **CMS donation-plugin detector** — detects donation plugins from fundraising form patterns.
33540. **CMS job-board detector** — identifies job-board plugins from listing URL structures.
33541. **CMS directory-plugin profiler** — detects directory/listing plugins from structured listing markup.
33542. **CMS real-estate detector** — identifies real-estate plugins from property-listing patterns.
33543. **CMS restaurant-plugin profiler** — detects restaurant/menu plugins from menu markup patterns.
33544. **CMS page-builder detector** — identifies page builders (Elementor, Divi, WPBakery) from markup signatures.
33545. **CMS page-builder version probe** — extracts page-builder versions from asset URLs and data attributes.
33546. **CMS headless detector** — detects headless CMS architectures from decoupled frontend/backend signals.
33547. **CMS static-generator detector** — identifies static-site generators behind CMS-like content from build artifacts.
33548. **CMS preview-mode profiler** — profiles draft/preview URL schemes revealing editorial workflows.
33549. **CMS revision-history profiler** — detects revision systems from URL parameters and API fields.
33550. **CMS workflow-plugin detector** — identifies editorial workflow plugins from status-transition artifacts.
33551. **CMS scheduled-publish profiler** — detects scheduled publishing from cron artifacts and future-dated content.
33552. **CMS multisite detector** — detects multisite/network installations from domain-mapping behaviors.
33553. **CMS domain-mapping profiler** — profiles domain-mapping plugins in multisite networks.
33554. **CMS staging-sync detector** — detects staging-sync plugins from environment markers.
33555. **CMS search-plugin profiler** — identifies enhanced-search plugins (Relevanssi, SearchWP) from search behaviors.
33556. **CMS related-posts profiler** — detects related-content plugins from recommendation markup.
33557. **CMS social-share detector** — identifies social-sharing plugins from share-button markup.
33558. **CMS newsletter-plugin profiler** — detects newsletter plugins from subscription form patterns.
33559. **CMS popup-plugin detector** — identifies popup builders from overlay markup and triggers.
33560. **CMS analytics-plugin profiler** — detects analytics plugins from tracking-code injection patterns.
33561. **CMS cookie-consent profiler** — identifies consent plugins from banner markup and script blocking.
33562. **CMS lazy-load profiler** — detects lazy-loading plugins from image-loading attributes.
33563. **CMS image-optimization profiler** — identifies image-optimization plugins from transformed image URLs.
33564. **CMS CDN-integration detector** — detects CDN-integration plugins from rewritten asset URLs.
33565. **CMS firewall-rule profiler** — profiles application-firewall plugins' rule behaviors.
33566. **CMS login-protection profiler** — detects login-hardening plugins from lockout and 2FA behaviors.
33567. **CMS 2FA-plugin detector** — identifies two-factor plugins from authentication-flow steps.
33568. **CMS captcha-plugin profiler** — detects CAPTCHA plugins from challenge markup on forms.
33569. **CMS honeypot detector** — identifies honeypot anti-spam techniques in form markup.
33570. **CMS spam-filter profiler** — detects spam-filtering plugins from comment-moderation behaviors.
33571. **CMS broken-link profiler** — finds broken-link-checker artifacts revealing link-management plugins.
33572. **CMS redirect-plugin detector** — identifies redirect-management plugins from redirect-rule behaviors.
33573. **CMS 404-handler profiler** — profiles custom 404 handlers revealing CMS error-management plugins.
33574. **CMS sitemap-plugin detector** — detects sitemap plugins from sitemap index structures.
33575. **CMS schema-plugin profiler** — identifies schema-markup plugins from JSON-LD injection patterns.
33576. **CMS AMP-plugin detector** — detects AMP plugins from AMP page variants.
33577. **CMS PWA-plugin profiler** — identifies PWA plugins from manifest and service-worker injection.
33578. **CMS maintenance-mode detector** — detects maintenance-mode plugins from holding-page markers.
33579. **CMS coming-soon profiler** — identifies coming-soon plugins from landing-page templates.
33580. **CMS database-prefix profiler** — infers database table prefixes from error messages and SQL artifacts.
33581. **CMS config-exposure checker** — checks for exposed CMS config files (wp-config backups, settings.php).
33582. **CMS install-script detector** — detects leftover installer scripts indicating incomplete hardening.
33583. **CMS upgrade-script detector** — finds upgrade scripts revealing version history.
33584. **CMS debug-mode detector** — detects enabled debug modes from verbose error output.
33585. **CMS cron-profiler** — profiles CMS cron systems (WP-Cron) from scheduled-task behaviors.
33586. **CMS heartbeat profiler** — analyzes admin-ajax heartbeat behaviors revealing CMS activity.
33587. **CMS autosave profiler** — detects autosave endpoints revealing editorial configurations.
33588. **CMS oEmbed profiler** — profiles oEmbed providers to map embeddable content types.
33589. **CMS RSS-customization profiler** — detects feed-customization plugins from feed modifications.
33590. **CMS API-auth profiler** — profiles CMS API authentication schemes (application passwords, JWT).
33591. **CMS webhook detector** — detects CMS webhook integrations from delivery endpoints.
33592. **CMS import-tool detector** — finds import-tool artifacts revealing migration history.
33593. **CMS export-endpoint profiler** — profiles content-export endpoints and their access controls.
33594. **CMS content-staging profiler** — detects content-staging workflows from preview domains.
33595. **CMS translation-memory profiler** — identifies translation workflows from multilingual content patterns.
33596. **CMS accessibility-plugin detector** — detects accessibility plugins from toolbar markup.
33597. **CMS GDPR-plugin profiler** — identifies GDPR-compliance plugins from data-request flows.
33598. **CMS update-policy profiler** — infers auto-update policies from version freshness patterns.
33599. **CMS core-vs-custom differ** — distinguishes core CMS files from custom modifications via hash comparison.
33600. **CMS child-theme detector** — detects child-theme usage indicating customization depth.
33601. **CMS must-use-plugin profiler** — identifies must-use plugins from always-loaded behaviors.
33602. **CMS drop-in detector** — detects drop-in replacements (object-cache.php) revealing performance stacks.
33603. **CMS confidence scorer** — scores CMS identification confidence across all corroborating signals.
33604. **CMS inventory export packager** — exports the full CMS/plugin/theme inventory with vuln cross-references for the report.
33605. **Client-side library census builder** — enumerates every JS library loaded across crawled pages into a deduplicated inventory.
33606. **Vulnerable-version flagger** — flags inventoried libraries with known CVEs by matching exact versions.
33607. **Library-version extractor** — extracts versions from file headers, banner comments, and global version properties.
33608. **Minified-library identifier** — identifies minified libraries via code-signature matching when headers are stripped.
33609. **Bundled-library decomposer** — decomposes webpack/rollup bundles to attribute code segments to source libraries.
33610. **Duplicate-library detector** — finds multiple versions of the same library loaded simultaneously.
33611. **Unused-library detector** — detects loaded-but-never-invoked libraries as dead-weight attack surface.
33612. **jQuery-version profiler** — fingerprints jQuery versions from API availability and behavior quirks.
33613. **jQuery-plugin inventory** — enumerates jQuery plugins from $.fn extensions.
33614. **jQuery-UI version detector** — identifies jQuery UI versions from widget markup and theme artifacts.
33615. **Lodash-version profiler** — fingerprints Lodash/Underscore versions from method availability.
33616. **Moment.js-version detector** — identifies Moment.js versions and locale-bundle inclusion.
33617. **Day.js-vs-Moment classifier** — distinguishes modern date libraries from legacy Moment usage.
33618. **Axios-version profiler** — fingerprints Axios versions from interceptor and adapter behaviors.
33619. **Fetch-polyfill detector** — detects fetch polyfills indicating legacy-browser support burdens.
33620. **Chart-library inventory** — enumerates charting libraries (Chart.js, D3, Highcharts) and their versions.
33621. **D3-version profiler** — fingerprints D3 versions from module structure and API shapes.
33622. **Three.js-version detector** — identifies Three.js versions from WebGL renderer signatures.
33623. **Map-library inventory** — enumerates mapping libraries (Leaflet, OpenLayers) and versions.
33624. **Editor-library inventory** — detects rich-text editors (TinyMCE, CKEditor, Quill) and versions.
33625. **Editor-plugin enumerator** — enumerates editor plugins revealing extended attack surface.
33626. **Date-picker inventory** — detects date-picker libraries and their versions.
33627. **Modal-library detector** — identifies modal/dialog libraries from markup patterns.
33628. **Carousel-library profiler** — detects carousel/slider libraries and versions.
33629. **Lightbox-library detector** — identifies lightbox libraries from gallery markup.
33630. **Form-validation inventory** — enumerates client-side validation libraries and rule sets.
33631. **Masking-library detector** — detects input-masking libraries from field behaviors.
33632. **Autocomplete-library profiler** — identifies autocomplete/typeahead libraries and data sources.
33633. **Drag-drop library detector** — detects drag-and-drop libraries from interaction handlers.
33634. **Animation-library inventory** — enumerates animation libraries (GSAP, Anime.js) and versions.
33635. **Scroll-library profiler** — detects scroll-jacking and smooth-scroll libraries.
33636. **Parallax-library detector** — identifies parallax libraries from transform patterns.
33637. **Lazy-load library profiler** — detects lazy-loading libraries and their configurations.
33638. **Infinite-scroll detector** — identifies infinite-scroll implementations and pagination APIs.
33639. **Virtual-scroll profiler** — detects virtualized-list libraries in data-heavy pages.
33640. **State-management inventory** — enumerates state libraries (Redux, MobX, Zustand) and devtools exposure.
33641. **Router-library detector** — identifies client-side routers and route-definition leaks.
33642. **i18n-library profiler** — detects internationalization libraries and exposed translation keys.
33643. **Template-engine detector** — identifies client-side template engines (Handlebars, Mustache) and versions.
33644. **Markdown-library profiler** — detects markdown renderers and their sanitization configurations.
33645. **Sanitizer-library auditor** — audits DOMPurify/sanitize-html versions and configurations for bypass risk.
33646. **Crypto-library inventory** — enumerates client-side crypto libraries (CryptoJS, js-sha) and versions.
33647. **JWT-library detector** — detects client-side JWT handling libraries and validation gaps.
33648. **OAuth-client profiler** — identifies OAuth client libraries and flow configurations.
33649. **WebSocket-client inventory** — enumerates WebSocket client libraries (Socket.IO) and versions.
33650. **Realtime-library profiler** — detects realtime frameworks (SignalR, Pusher clients) and versions.
33651. **GraphQL-client detector** — identifies GraphQL clients (Apollo, Relay) and cache configurations.
33652. **REST-client inventory** — enumerates REST client abstractions and their versions.
33653. **Testing-library leak detector** — detects testing libraries (Jest, Cypress) shipped to production.
33654. **Devtools-exposure profiler** — detects exposed framework devtools hooks in production builds.
33655. **Source-map leak enumerator** — enumerates exposed source maps across all JS assets.
33656. **Hot-reload artifact detector** — finds development hot-reload clients in production bundles.
33657. **Error-tracking inventory** — detects error-tracking SDKs (Sentry) and their configurations.
33658. **Analytics-library census** — enumerates analytics libraries separate from tag-manager loads.
33659. **A/B-testing client detector** — detects experimentation clients and exposed variant logic.
33660. **Feature-flag client profiler** — identifies feature-flag SDKs and exposed flag evaluations.
33661. **Consent-library auditor** — audits consent-management libraries for compliance gaps.
33662. **Fingerprinting-library detector** — detects browser-fingerprinting libraries and their data collection.
33663. **Bot-detection client profiler** — identifies bot-detection clients (PerimeterX, DataDome) and versions.
33664. **CAPTCHA-client inventory** — enumerates CAPTCHA client integrations and versions.
33665. **Payment-SDK inventory** — detects payment SDKs (Stripe.js) and their versions.
33666. **Fraud-SDK detector** — identifies fraud-detection SDKs and device-fingerprinting behaviors.
33667. **Identity-verification profiler** — detects KYC/identity-verification SDKs in onboarding flows.
33668. **Chat-SDK inventory** — enumerates chat SDKs (Intercom, Zendesk) and versions.
33669. **Support-widget profiler** — detects support widgets and their data-access scopes.
33670. **Video-player inventory** — enumerates video players (Video.js, JW) and versions.
33671. **Audio-player detector** — detects audio players and streaming SDKs.
33672. **PDF-viewer profiler** — identifies PDF viewers (PDF.js) and versions.
33673. **Document-viewer detector** — detects document preview libraries and conversion services.
33674. **Spreadsheet-library profiler** — identifies spreadsheet components (Handsontable) and versions.
33675. **Calendar-library inventory** — enumerates calendar components (FullCalendar) and versions.
33676. **Kanban-library detector** — detects kanban/board libraries in project tools.
33677. **Diagram-library profiler** — identifies diagramming libraries (Mermaid, GoJS) and versions.
33678. **Code-editor inventory** — detects embedded code editors (Monaco, CodeMirror) and versions.
33679. **Terminal-emulator detector** — identifies web terminal emulators and their backends.
33680. **File-upload library profiler** — detects upload libraries (Dropzone, Uppy) and versions.
33681. **Image-cropper detector** — identifies image-manipulation libraries in upload flows.
33682. **QR-library profiler** — detects QR generation/scanning libraries.
33683. **Barcode-library detector** — identifies barcode libraries in logistics flows.
33684. **Signature-pad profiler** — detects signature-capture libraries and their data formats.
33685. **Webcam-library detector** — identifies webcam-access libraries and permission flows.
33686. **Geolocation-library profiler** — detects geolocation wrappers and their fallbacks.
33687. **Offline-library detector** — identifies offline-first libraries (localForage) and sync strategies.
33688. **PWA-library profiler** — detects PWA helper libraries (Workbox) and versions.
33689. **Push-library inventory** — enumerates web-push libraries and subscription flows.
33690. **Notification-library detector** — detects toast/notification libraries.
33691. **Clipboard-library profiler** — identifies clipboard-access libraries and permission handling.
33692. **Fullscreen-library detector** — detects fullscreen API wrappers.
33693. **Vibration-library profiler** — identifies haptic-feedback library usage.
33694. **Battery-API detector** — detects Battery Status API usage for fingerprinting risk.
33695. **Sensor-library profiler** — detects device-sensor access (accelerometer, gyroscope) libraries.
33696. **WebRTC-library inventory** — enumerates WebRTC libraries and STUN/TURN configurations.
33697. **WebGL-library profiler** — detects WebGL usage patterns for fingerprinting surface.
33698. **Canvas-fingerprinting detector** — detects canvas-fingerprinting code in third-party scripts.
33699. **Library-license auditor** — audits library licenses for compliance and copyleft exposure.
33700. **Library-supply-chain scorer** — scores each library's supply-chain risk (maintainer activity, known compromises).
33701. **Library-update-lag measurer** — measures how far behind latest each library version is.
33702. **Library EOL flagger** — flags libraries whose upstream projects are abandoned.
33703. **Library CVE auto-matcher** — continuously matches the inventory against fresh CVE feeds.
33704. **Library inventory export packager** — exports the full JS census with versions, CVEs, and risk scores for the report.
33705. **External-dependency graph builder** — constructs a graph of all third-party domains contacted, categorized by function.
33706. **Analytics-provider mapper** — identifies analytics providers (GA4, Mixpanel, Amplitude) from tracking endpoints.
33707. **Tag-manager dependency mapper** — maps all tags fired through tag managers to their vendor destinations.
33708. **Auth-provider mapper** — enumerates third-party identity providers (Auth0, Okta, Cognito) from login flows.
33709. **Payment-processor mapper** — identifies payment processors (Stripe, Adyen, PayPal) from checkout integrations.
33710. **CDN-dependency mapper** — maps third-party CDN usage for assets, fonts, and libraries.
33711. **Font-provider mapper** — identifies webfont providers and their data-collection implications.
33712. **Map-provider mapper** — maps mapping service dependencies and API-key exposures.
33713. **Video-hosting mapper** — identifies third-party video hosting (YouTube, Vimeo, Wistia) dependencies.
33714. **Image-hosting mapper** — maps image CDN and hosting dependencies (Cloudinary, Imgix).
33715. **File-storage mapper** — identifies third-party file-storage integrations.
33716. **Email-service mapper** — detects email-delivery services from transactional-mail artifacts.
33717. **SMS-service mapper** — identifies SMS providers from verification-flow artifacts.
33718. **Push-service mapper** — maps push-notification providers and their SDKs.
33719. **Chat-service mapper** — enumerates live-chat and messaging vendors.
33720. **Support-desk mapper** — identifies helpdesk platforms (Zendesk, Freshdesk) from support flows.
33721. **CRM-integration mapper** — detects CRM integrations (Salesforce, HubSpot) from tracking and forms.
33722. **Marketing-automation mapper** — identifies marketing platforms (Marketo, Pardot) from form handlers.
33723. **Ad-network mapper** — enumerates advertising networks and their tracking pixels.
33724. **Retargeting-pixel mapper** — maps retargeting pixels to their ad platforms.
33725. **Affiliate-network detector** — detects affiliate-tracking integrations.
33726. **Consent-platform mapper** — identifies consent-management platforms and their configurations.
33727. **A/B-testing vendor mapper** — maps experimentation vendors to their script payloads.
33728. **Feature-flag vendor mapper** — identifies feature-flag services (LaunchDarkly) from SDK traffic.
33729. **Error-tracking vendor mapper** — maps error-reporting services and their data scopes.
33730. **Performance-monitoring mapper** — identifies RUM/APM vendors (New Relic, Datadog RUM).
33731. **Session-replay detector** — detects session-replay tools (FullStory, Hotjar) and their capture scope.
33732. **Heatmap-tool mapper** — identifies heatmap tools and their data collection.
33733. **Survey-tool mapper** — detects embedded survey tools (Typeform, Qualtrics).
33734. **Review-platform mapper** — identifies review widgets (Trustpilot, Yotpo) and their APIs.
33735. **Social-plugin mapper** — enumerates social-media embeds and their tracking.
33736. **Comment-platform mapper** — identifies third-party comment systems (Disqus) and data flows.
33737. **Forum-service mapper** — detects hosted forum services.
33738. **Knowledge-base mapper** — identifies hosted knowledge-base platforms.
33739. **Status-page mapper** — detects status-page providers (Statuspage) and their APIs.
33740. **Uptime-monitor detector** — identifies uptime-monitoring beacons.
33741. **Search-service mapper** — maps hosted search services (Algolia, Swiftype).
33742. **Translation-service mapper** — detects machine-translation integrations.
33743. **Currency-service mapper** — identifies currency-conversion APIs in commerce flows.
33744. **Tax-service mapper** — detects tax-calculation services (Avalara) in checkout.
33745. **Shipping-service mapper** — identifies shipping-rate APIs in commerce flows.
33746. **Fraud-service mapper** — maps fraud-prevention vendors (Riskified, Forter).
33747. **Identity-verification mapper** — identifies KYC vendors (Onfido, Jumio).
33748. **Background-check mapper** — detects background-check integrations where present.
33749. **E-signature mapper** — identifies e-signature services (DocuSign) in document flows.
33750. **Calendar-service mapper** — maps scheduling services (Calendly) and their APIs.
33751. **Video-conference mapper** — detects embedded video-conference SDKs.
33752. **Webinar-platform mapper** — identifies webinar platform integrations.
33753. **LMS-service mapper** — detects hosted learning-platform integrations.
33754. **HR-service mapper** — identifies HR/recruiting tool embeds (Greenhouse, Lever).
33755. **Payroll-service mapper** — detects payroll provider integrations where exposed.
33756. **Accounting-service mapper** — identifies accounting integrations (QuickBooks, Xero).
33757. **Invoicing-service mapper** — detects invoicing platform integrations.
33758. **Subscription-billing mapper** — identifies subscription-billing vendors (Chargebee, Recurly).
33759. **Donation-platform mapper** — detects fundraising platform integrations.
33760. **Crowdfunding mapper** — identifies crowdfunding embeds.
33761. **Booking-engine mapper** — maps travel-booking engine dependencies.
33762. **Property-service mapper** — detects property-management integrations.
33763. **Restaurant-service mapper** — identifies reservation/delivery integrations.
33764. **Fitness-service mapper** — detects class-booking integrations.
33765. **Healthcare-service mapper** — identifies telehealth and scheduling integrations.
33766. **Insurance-service mapper** — detects quote-engine integrations.
33767. **Banking-service mapper** — identifies open-banking integrations (Plaid).
33768. **Crypto-service mapper** — detects crypto-payment and wallet integrations.
33769. **NFT-service mapper** — identifies NFT platform integrations where present.
33770. **Gaming-service mapper** — detects game-backend services.
33771. **Streaming-service mapper** — identifies DRM and streaming vendors.
33772. **Music-service mapper** — detects music-embed integrations.
33773. **Podcast-service mapper** — identifies podcast-hosting embeds.
33774. **Newsletter-service mapper** — maps newsletter platforms (Substack, Beehiiv).
33775. **RSS-service mapper** — detects feed-service integrations.
33776. **Weather-service mapper** — identifies weather-API dependencies.
33777. **News-service mapper** — detects news-API integrations.
33778. **Sports-data mapper** — identifies sports-data providers.
33779. **Stock-data mapper** — detects market-data integrations.
33780. **Domain-service mapper** — identifies domain-registration integrations.
33781. **SSL-service mapper** — detects certificate-service integrations.
33782. **DNS-service mapper** — identifies managed-DNS dependencies.
33783. **DDoS-service mapper** — maps DDoS-mitigation vendors beyond the primary CDN.
33784. **WAF-service mapper** — identifies standalone WAF vendors in the chain.
33785. **Bot-service mapper** — maps dedicated bot-management vendors.
33786. **API-management mapper** — identifies API-management platforms.
33787. **Integration-platform mapper** — detects iPaaS integrations (Zapier, Workato).
33788. **Webhook-service mapper** — identifies webhook-delivery services.
33789. **Queue-service mapper** — detects managed-queue dependencies.
33790. **Cache-service mapper** — identifies edge-cache and CDN dependencies.
33791. **Database-service mapper** — detects database-as-a-service integrations.
33792. **Backup-service mapper** — identifies backup vendors from client artifacts.
33793. **Monitoring-service mapper** — maps infrastructure-monitoring vendors.
33794. **Logging-service mapper** — identifies log-management vendors.
33795. **Incident-service mapper** — detects incident-management integrations (PagerDuty).
33796. **On-call mapper** — identifies on-call scheduling integrations.
33797. **Third-party risk scorer** — scores each vendor relationship by data sensitivity and trust tier.
33798. **Vendor-data-flow mapper** — maps what user data flows to each third party.
33799. **Vendor-subprocessor graph** — extends the graph to vendors' own subprocessors where discoverable.
33800. **Vendor-breach correlator** — correlates vendor list with public breach disclosures.
33801. **Vendor-consolidation advisor** — identifies redundant vendors performing the same function.
33802. **Vendor-sprawl quantifier** — quantifies third-party sprawl with trend tracking.
33803. **Dependency-change monitor** — monitors third-party dependencies for additions, removals, and swaps.
33804. **Dependency-map export packager** — exports the third-party graph with risk scores for the report.
33805. **Employee-tech-footprint aggregator** — aggregates public employee profiles mentioning technologies to infer the internal stack.
33806. **Job-posting stack miner** — mines job listings for required technologies to profile the engineering stack.
33807. **Job-posting tooling extractor** — extracts DevOps tooling (CI, IaC, monitoring) from job descriptions.
33808. **Job-posting cloud extractor** — identifies cloud platforms from infrastructure-role postings.
33809. **Job-posting seniority mapper** — maps team seniority and size from posting volumes and levels.
33810. **Job-posting location mapper** — maps engineering office locations from job postings.
33811. **Tech-blog stack extractor** — parses engineering blogs for stack disclosures and architecture posts.
33812. **Conference-talk miner** — mines conference talks by employees for architecture and tooling details.
33813. **Meetup-talk profiler** — profiles local meetup presentations for stack hints.
33814. **Podcast-appearance miner** — extracts stack details from employee podcast appearances.
33815. **Webinar-content extractor** — mines vendor webinars featuring the target's engineers.
33816. **Open-source contribution mapper** — maps employees' public code contributions to infer internal tooling.
33817. **GitHub-org profiler** — profiles the organization's public GitHub for languages, frameworks, and practices.
33818. **GitLab-org profiler** — profiles public GitLab groups for stack signals.
33819. **Package-registry profiler** — finds organization-scoped packages in public registries.
33820. **Docker-Hub profiler** — profiles public container images for base-image and tooling choices.
33821. **Stack-Overflow footprint mapper** — maps employee Stack Overflow activity to technology usage.
33822. **Dev-forum footprint mapper** — profiles employee activity on framework-specific forums.
33823. **Certification footprint mapper** — infers platform usage from employee cloud certifications.
33824. **Training-footprint extractor** — finds corporate training enrollments revealing platform adoption.
33825. **Vendor case-study miner** — extracts stack details from vendor case studies featuring the target.
33826. **Partner-directory profiler** — profiles partnership listings revealing technology alliances.
33827. **Procurement-record miner** — mines public procurement records for purchased technologies.
33828. **RFP-response miner** — extracts technology requirements from public RFP documents.
33829. **Patent-filing profiler** — profiles patent filings for technology and architecture disclosures.
33830. **Trademark-filing mapper** — maps product names from trademark filings to profile offerings.
33831. **Press-release tech extractor** — extracts technology mentions from press releases and launches.
33832. **Funding-announcement profiler** — profiles investor announcements for scaling and stack hints.
33833. **Acquisition-tech profiler** — analyzes acquired companies' stacks to infer integration targets.
33834. **Merger-stack correlator** — correlates merging organizations' stacks for integration profiling.
33835. **Spin-off tech tracker** — tracks technology choices of spun-off entities.
33836. **Subsidiary-stack mapper** — maps subsidiary technology stacks from their public footprints.
33837. **Org-chart reconstructor** — reconstructs engineering org structure from public profiles.
33838. **Team-topology mapper** — maps team boundaries and ownership from repository and posting signals.
33839. **Engineering-leadership profiler** — profiles CTO/VP engineering backgrounds to infer stack preferences.
33840. **Founder-stack profiler** — infers initial stack choices from founders' technical backgrounds.
33841. **Advisor-footprint mapper** — maps technical advisors' expertise to likely stack influences.
33842. **Board-tech profiler** — profiles board members' technology affiliations.
33843. **Investor-portfolio correlator** — correlates investor portfolio companies' stacks for pattern inference.
33844. **Accelerator-cohort profiler** — profiles accelerator batch-mates' stacks for cohort patterns.
33845. **University-pipeline mapper** — maps hiring pipelines from universities to infer junior-stack training.
33846. **Bootcamp-pipeline detector** — detects bootcamp hiring patterns indicating stack choices.
33847. **Contractor-footprint mapper** — profiles contracting firms used to infer project stacks.
33848. **Agency-partner profiler** — identifies digital agencies from portfolio pages revealing build stacks.
33849. **Freelancer-footprint mapper** — maps freelancer engagements to technology choices.
33850. **Consulting-engagement profiler** — detects consulting engagements from case studies.
33851. **Audit-report miner** — mines public audit and compliance reports for control disclosures.
33852. **Security-certification mapper** — maps SOC2/ISO certifications to infer security tooling.
33853. **Bug-bounty-program profiler** — profiles the target's own bounty program scope and history.
33854. **Disclosure-policy mapper** — maps vulnerability disclosure policies and past researcher interactions.
33855. **Security-team profiler** — profiles the security team's size and tooling from postings.
33856. **CISO-background profiler** — infers security program maturity from CISO career history.
33857. **Incident-history mapper** — maps public incident disclosures to infer defensive gaps.
33858. **Breach-notification miner** — mines breach notifications for compromised-system details.
33859. **Ransomware-history profiler** — profiles ransomware incidents revealing backup and segmentation posture.
33860. **Phishing-history mapper** — maps phishing incidents to infer email-security tooling.
33861. **Downtime-history profiler** — profiles outage postmortems for architecture disclosures.
33862. **Status-history miner** — mines historical status pages for incident patterns.
33863. **Changelog-archaeology engine** — reconstructs stack evolution from historical changelogs and release notes.
33864. **Wayback-stack differ** — diffs historical site versions to trace technology migrations.
33865. **DNS-history profiler** — profiles historical DNS records for infrastructure evolution.
33866. **Certificate-history mapper** — maps certificate issuance history for infrastructure changes.
33867. **IP-history tracker** — tracks historical IP assignments revealing hosting migrations.
33868. **ASN-history profiler** — profiles ASN changes indicating provider switches.
33869. **Tech-debt narrative extractor** — extracts tech-debt admissions from blogs and talks.
33870. **Migration-announcement tracker** — tracks announced migrations to predict future stacks.
33871. **Deprecation-notice miner** — mines deprecation notices for legacy-system identification.
33872. **Sunset-product tracker** — tracks sunset products revealing retired stacks.
33873. **API-version-history profiler** — profiles API versioning history for platform longevity signals.
33874. **SDK-history mapper** — maps SDK release history for client-stack evolution.
33875. **Mobile-app history profiler** — profiles app-store version history for mobile-stack signals.
33876. **Review-sentiment miner** — mines app reviews for technology complaints revealing stack pain.
33877. **Support-forum miner** — profiles support forums for recurring technical issues.
33878. **Community-size estimator** — estimates user-community size from forum and social signals.
33879. **Developer-relations profiler** — profiles DevRel activity indicating API-platform investment.
33880. **Hackathon-footprint mapper** — maps hackathon sponsorships and projects to stack signals.
33881. **OSS-sponsorship tracker** — tracks open-source sponsorships revealing dependency gratitude.
33882. **Foundation-membership mapper** — maps foundation memberships (CNCF, Linux) to stack alignment.
33883. **Standards-participation profiler** — profiles standards-body participation for protocol influence.
33884. **Whitepaper miner** — extracts architecture details from published whitepapers.
33885. **Benchmark-disclosure extractor** — finds published benchmarks revealing infrastructure scale.
33886. **Sustainability-report miner** — mines sustainability reports for data-center disclosures.
33887. **Real-estate footprint mapper** — maps office and data-center locations from real-estate records.
33888. **Data-center disclosure finder** — finds data-center usage disclosures in reports.
33889. **PeeringDB profiler** — profiles the organization's PeeringDB entries for network footprint.
33890. **IRR-record mapper** — maps Internet Routing Registry records for network ownership.
33891. **RPKI-status checker** — checks RPKI deployment status for routing-security posture.
33892. **Org-confidence scorer** — scores OSINT-derived stack inferences with source-reliability weighting.
33893. **OSINT-source cataloger** — catalogs every OSINT source consulted with retrieval dates.
33894. **OSINT-contradiction resolver** — flags and resolves contradictions between OSINT sources.
33895. **OSINT-freshness tracker** — tracks source recency to weight recent disclosures higher.
33896. **Insider-threat-surface mapper** — maps publicly exposed employee details useful for social-engineering awareness.
33897. **Executive-digital-footprint mapper** — profiles executive public footprints for targeted-phishing awareness.
33898. **Org-chart export packager** — exports the organizational profile with stack inferences for the report.
33899. **Org-profile change monitor** — monitors OSINT sources for organizational changes.
33900. **Hiring-velocity tracker** — tracks hiring velocity as a proxy for engineering investment.
33901. **Layoff-impact profiler** — profiles layoff announcements for security-team impact assessment.
33902. **M&A-rumor tracker** — tracks acquisition rumors indicating impending stack changes.
33903. **Competitor-stack comparator** — compares the target's inferred stack against competitors.
33904. **OSINT-profile export packager** — exports the complete OSINT org profile as structured hunt evidence.
33905. **Outdated-component scorer** — quantifies stack staleness by measuring version lag across all detected components.
33906. **EOL-component inventory** — lists every detected component past end-of-life with support-end dates.
33907. **EOL-exposure window calculator** — computes days-since-EOL per component to rank urgency.
33908. **CVE-backlog quantifier** — counts unpatched CVEs applicable to detected versions.
33909. **Patch-lag measurer** — measures days between CVE publication and observed patching per component.
33910. **Version-skew analyzer** — detects inconsistent versions of the same component across services.
33911. **Legacy-protocol detector** — flags legacy protocols (TLS 1.0/1.1, SMBv1 hints) in the target's surface.
33912. **Deprecated-API usage profiler** — detects usage of deprecated API versions and endpoints.
33913. **Deprecated-library detector** — flags libraries deprecated by their maintainers.
33914. **Abandoned-dependency flagger** — flags dependencies with no upstream commits in over two years.
33915. **Unmaintained-fork detector** — detects forks that diverged from maintained upstreams.
33916. **Polyfill-burden scorer** — scores legacy-browser support burden from polyfill inventory.
33917. **IE-compatibility debt detector** — detects Internet Explorer compatibility code as debt signal.
33918. **Flash-remnant scanner** — finds Flash-era artifacts indicating incomplete modernization.
33919. **Silverlight-remnant detector** — detects Silverlight-era artifacts in enterprise surfaces.
33920. **Java-applet remnant finder** — finds Java-applet references indicating legacy enterprise stacks.
33921. **ActiveX-hint detector** — detects ActiveX references in legacy application flows.
33922. **VBScript-remnant scanner** — finds VBScript artifacts in legacy pages.
33923. **Table-layout debt detector** — detects table-based layouts indicating unmaintained frontends.
33924. **Inline-style debt profiler** — quantifies inline-style usage as frontend-maintenance debt.
33925. **jQuery-dependence scorer** — scores jQuery dependence depth as modernization debt.
33926. **Mixed-content debt mapper** — maps HTTP subresources on HTTPS pages as hygiene debt.
33927. **Mixed-framework detector** — detects multiple frontend frameworks coexisting as integration debt.
33928. **Framework-version sprawl mapper** — maps version sprawl of the same framework across pages.
33929. **Duplicate-functionality detector** — finds overlapping libraries doing the same job as consolidation debt.
33930. **Dead-code burden estimator** — estimates dead JS/CSS weight as maintenance debt.
33931. **Unminified-asset debt profiler** — detects unminified production assets indicating immature pipelines.
33932. **Missing-source-map debt flagger** — flags missing source maps as debuggability debt.
33933. **Hardcoded-secret debt scanner** — finds hardcoded credentials and keys as security debt.
33934. **Hardcoded-URL debt mapper** — maps hardcoded environment URLs indicating configuration debt.
33935. **Commented-code debt estimator** — estimates commented-out code volume as hygiene debt.
33936. **TODO-comment debt miner** — mines TODO/FIXME comments revealing known deferred work.
33937. **Console-log debt detector** — detects console.log statements in production as pipeline debt.
33938. **Debugger-statement finder** — finds debugger statements shipped to production.
33939. **Alert-statement scanner** — detects alert() calls indicating unfinished development.
33940. **Placeholder-content detector** — finds lorem-ipsum and placeholder content as completeness debt.
33941. **Broken-link debt quantifier** — quantifies broken internal links as maintenance debt.
33942. **Broken-image debt mapper** — maps broken images indicating content debt.
33943. **Stale-copyright detector** — detects outdated copyright years as freshness signal.
33944. **Stale-blog detector** — measures content freshness decay on corporate blogs.
33945. **Stale-docs profiler** — detects outdated documentation as maintenance debt.
33946. **Orphan-page detector** — finds pages with no inbound navigation as information-architecture debt.
33947. **Redirect-chain debt mapper** — maps long redirect chains as technical debt.
33948. **Redirect-loop remnant finder** — detects redirect-loop handling gaps.
33949. **Canonicalization debt profiler** — profiles duplicate-content issues from poor canonicalization.
33950. **Trailing-slash inconsistency mapper** — maps inconsistent slash handling as routing debt.
33951. **Case-sensitivity inconsistency detector** — detects mixed case-handling as platform-migration debt.
33952. **Charset-inconsistency profiler** — profiles mixed character encodings as legacy debt.
33953. **HTTP/1.1-only debt flagger** — flags HTTP/1.1-only origins as protocol-modernization debt.
33954. **No-IPv6 debt detector** — flags missing IPv6 support as infrastructure debt.
33955. **Weak-cipher debt profiler** — profiles weak TLS configurations as crypto-agility debt.
33956. **SHA1-cert debt detector** — detects SHA-1 certificates as PKI debt.
33957. **Short-key debt flagger** — flags short RSA keys as crypto debt.
33958. **Expired-cert debt tracker** — tracks expired-certificate incidents as operational debt.
33959. **Self-signed-cert debt mapper** — maps self-signed certificates on public surfaces.
33960. **Missing-HSTS debt flagger** — flags missing HSTS as security-header debt.
33961. **Missing-CSP debt detector** — detects absent Content-Security-Policy as hardening debt.
33962. **Permissive-CSP debt scorer** — scores overly permissive CSP policies as configuration debt.
33963. **Missing security.txt debt flagger** — flags absent security.txt as disclosure-process debt.
33964. **Verbose-error debt detector** — detects verbose errors in production as hardening debt.
33965. **Directory-listing debt mapper** — maps enabled directory listings as configuration debt.
33966. **Default-credential debt tester** — safely checks default credentials on admin interfaces as debt.
33967. **Unchanged-default detector** — detects unchanged default configurations across services.
33968. **Sample-app remnant finder** — finds sample applications left deployed as hygiene debt.
33969. **Test-endpoint debt mapper** — maps exposed test endpoints as lifecycle debt.
33970. **Staging-leak debt detector** — detects staging environments indexed publicly as process debt.
33971. **Backup-file debt scanner** — finds backup files on production as operational debt.
33972. **Log-exposure debt mapper** — maps exposed log files as operational debt.
33973. **Git-exposure debt checker** — checks for exposed .git directories as deployment debt.
33974. **Env-file exposure scanner** — detects exposed .env files as secret-management debt.
33975. **Dependency-confusion debt tester** — assesses internal package-name squatting risk as supply-chain debt.
33976. **Typosquat-dependency scanner** — detects typosquatted dependencies in manifests.
33977. **Unpinned-dependency debt mapper** — maps unpinned dependency ranges as reproducibility debt.
33978. **Lockfile-absent debt flagger** — flags missing lockfiles as build-reproducibility debt.
33979. **Monolith-debt estimator** — estimates monolith characteristics from deployment behaviors.
33980. **Microservice-sprawl debt scorer** — scores service sprawl without discovery as architecture debt.
33981. **API-versioning debt profiler** — profiles inconsistent API versioning as design debt.
33982. **No-rate-limit debt detector** — detects missing rate limits as abuse-protection debt.
33983. **No-audit-log debt flagger** — infers missing audit logging as compliance debt.
33984. **Session-timeout debt profiler** — profiles excessive session lifetimes as session-management debt.
33985. **Password-policy debt assessor** — assesses weak password policies as auth debt.
33986. **MFA-absence debt detector** — detects missing MFA options as authentication debt.
33987. **SSO-absence debt flagger** — flags missing SSO on business apps as identity debt.
33988. **SCIM-absence debt detector** — detects missing automated provisioning as lifecycle debt.
33989. **Backup-absence debt assessor** — assesses backup indicators as resilience debt.
33990. **DR-evidence debt mapper** — maps disaster-recovery evidence gaps as continuity debt.
33991. **Monitoring-gap debt profiler** — profiles missing health and status endpoints as observability debt.
33992. **Status-page-absence debt flagger** — flags missing status pages as transparency debt.
33993. **Changelog-absence debt detector** — detects missing changelogs as process debt.
33994. **Accessibility-debt scanner** — scans for accessibility gaps as compliance debt.
33995. **Mobile-parity debt profiler** — profiles mobile-vs-desktop feature gaps as platform debt.
33996. **Localization-debt detector** — detects incomplete translations as internationalization debt.
33997. **Tech-debt composite scorer** — combines all debt signals into a single 0–100 tech-debt index.
33998. **Tech-debt trend tracker** — tracks the debt index over time to show improvement or decay.
33999. **Tech-debt peer benchmarker** — benchmarks the target's debt index against industry peers.
34000. **Remediation-priority ranker** — ranks debt items by risk-reduction per effort for fix planning.
34001. **Quick-win debt identifier** — surfaces high-impact, low-effort debt fixes.
34002. **Debt-interest estimator** — estimates ongoing incident likelihood attributable to each debt item.
34003. **Debt-paydown roadmap generator** — generates a sequenced remediation roadmap from ranked debt.
34004. **Tech-debt report packager** — exports the full tech-debt profile with evidence for the hunt report.
