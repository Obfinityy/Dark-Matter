# Part 02 — Detection engineering

0001. **Differential response oracle** — sends paired benign-vs-probe requests and diffs responses at the DOM/JSON/schema level, flagging injection only when the probe response diverges from the benign baseline beyond 3-sigma significance instead of naive string matching.
0002. **Out-of-band interaction correlator** — matches DNS/HTTP callbacks on the agent's canary server to the exact probe that triggered them via per-probe tokens plus timestamp windows, attributing blind SSRF/SSTI with zero false positives.
0003. **Timing oracle with jitter compensation** — measures response-time deltas for time-based detection while modeling network jitter as noise, requiring p<0.01 significance over 20 paired samples before flagging any sleep-based finding.
0004. **Multi-encoding differential oracle** — replays the same probe in URL-encoded, double-encoded, UTF-7, and HTML-entity forms and compares reflected output diffs to detect server-side normalization that only fires for one encoding, proving a real sink.
0005. **Canonical-response baseline learner** — learns the canonical JSON shape and status codes per endpoint from benign traffic, then flags probe responses whose schema drift (new fields, type changes, error verbosity) indicates attacker-influenced paths.
0006. **Error-message entropy analyzer** — quantifies Shannon entropy differences between benign and probe error pages, detecting verbose exception disclosure when error detail scales with input complexity rather than remaining constant.
0007. **Response-length invariant oracle** — establishes per-endpoint response-length baselines over multiple benign samples, then detects reflected content or broken access control by flagging length anomalies beyond learned tolerance bands.
0008. **Semantic diff oracle for reflection** — parses rendered DOM into a semantic tree and compares benign vs probe trees, detecting XSS-relevant reflection only when the probe alters tag structure rather than merely appearing as text.
0009. **Paired-context reflection detector** — injects marker strings with known safe contexts and verifies whether reflection preserves context or escapes it, distinguishing inert reflection from genuine context-breaking sinks.
0010. **Header-injection differential oracle** — sends probes with CRLF-split payloads and compares raw response headers (including via a second hop) to detect header injection that is invisible at the body level.
0011. **Cookie-scope mutation oracle** — tracks Set-Cookie headers across benign vs probe sessions to detect probes that alter cookie scope, flags, or session identifiers, proving state influence beyond the current response.
0012. **Redirect-chain differential oracle** — follows redirect chains for benign and probe inputs and flags open-redirect or chain poisoning only when the final landing URL diverges, not on intermediate hops alone.
0013. **JSON schema mutation detector** — compares the JSON schema of probe responses against learned benign schemas to catch type-confusion or injection that changes field types without changing values visibly.
0014. **Blind boolean oracle builder** — automatically constructs TRUE/FALSE condition pairs for boolean-based blind detection in SQLi/XPath/EL contexts, requiring consistent complementary results across 10 pairs before flagging.
0015. **Content-type confusion oracle** — requests the same resource with different Accept headers and detects content-type confusion by flagging cases where sniffable active content is served under a benign MIME type.
0016. **Cache-hit differential oracle** — compares X-Cache/Age headers for benign vs probe requests to determine whether a probe's response was cached, enabling cache-poisoning detection before any victim impact.
0017. **TLS-behavior differential oracle** — compares TLS handshake details (cipher suite, cert chain, SNI behavior) for direct vs Host-header-rewritten requests to detect TLS-layer request-smuggling or virtual-host confusion.
0018. **Language-locale reflection oracle** — replays probes across Accept-Language variants to detect localization-dependent reflection where a sink only exists in one locale's template, which single-locale scanning misses.
0019. **Compression side-channel oracle** — measures compressed response sizes for crafted secrets in reflectable fields to detect BREACH-style leakage with statistical rigor over repeated samples.
0020. **Charset-detection differential oracle** — varies the declared charset parameter and observes whether the server re-encodes reflected input unsafely, detecting XSS vectors that depend on charset negotiation.
0021. **HTTP method differential oracle** — replays the same probe across GET/POST/PUT/PATCH/DELETE and diffs responses to detect method-override or hidden-method vulnerabilities where only one verb reaches the vulnerable sink.
0022. **Parameter-pollution ordering oracle** — sends duplicate parameters with conflicting values and compares which value the backend honors, detecting parser desync that enables HPP-based access-control bypass.
0023. **Status-code transition oracle** — records the benign status-code matrix per endpoint and flags probe-induced transitions (e.g., 200→500, 403→200) as candidate vulnerabilities with the transition itself as the signal.
0024. **Response-time baseline profiler** — builds per-endpoint latency histograms from benign traffic so that anomalous probe latencies are judged against the endpoint's own distribution, not a global threshold.
0025. **Nested-context reflection tracker** — tracks a marker through nested contexts (HTML → JS string → URL parameter) in the response and reports the exact context stack, proving where sanitization failed.
0026. **DOM-clobbering differential oracle** — compares benign vs probe DOM property resolution to detect DOM clobbering where injected markup shadows legitimate JS variables without classic XSS strings.
0027. **Shadow-DOM reflection oracle** — detects reflection inside shadow DOM boundaries and web components, which standard page-text searches miss, by instrumenting shadow-root serialization.
0028. **Web-cache key differential oracle** — varies cache-key components (headers, query params) and observes hit/miss patterns to map the cache key, enabling reliable unkeyed-input cache-poison detection.
0029. **Origin-reflection oracle** — sends varied Origin headers and diffs Access-Control-Allow-Origin reflections to detect dynamic-origin CORS misconfigurations with exact reflected-value attribution.
0030. **Subdomain-takeover fingerprint oracle** — matches CNAME targets against a maintained fingerprint database of dangling-service error signatures, proving takeover only on signature match rather than DNS liveness alone.
0031. **SRI-integrity differential oracle** — compares subresource integrity attributes across benign page loads and detects when attacker-influenced resources drop or alter integrity hashes.
0032. **CSP-report-only oracle** — deploys a report-only CSP via injected meta tags where possible and collects violation reports to detect which injected contexts the browser would actually execute.
0033. **Trusted-types violation oracle** — enables Trusted Types enforcement in the test harness and observes violation events to prove whether reflected content reaches a dangerous sink in a modern browser.
0034. **Mutation-XSS differential oracle** — round-trips probe HTML through the browser's parser and serializer and diffs the result, detecting mutation-XSS where innerHTML re-serialization creates executable markup.
0035. **Template-injection arithmetic oracle** — uses inert arithmetic expressions per template engine dialect and detects evaluation by comparing computed output against literal output, identifying the engine without executing code.
0036. **Second-request reflection oracle** — follows stored-input flows by requesting the page where user input is later displayed, detecting stored XSS via multi-step reflection chains instead of single-response checks.
0037. **Email-rendering reflection oracle** — captures outbound emails triggered by probe input (via test mailbox) and checks whether the input is rendered unsafely in HTML email contexts.
0038. **PDF-export reflection oracle** — triggers PDF/report exports containing probe input and analyzes the generated document for script-capable contexts, detecting XSS-to-PDF vectors.
0039. **CSV-injection formula oracle** — exports data containing probe markers and inspects whether spreadsheet formulas survive export unescaped, detecting CSV injection at the export layer.
0040. **Log-injection reflection oracle** — writes probe markers into application logs via monitored actions and checks log-viewer rendering for unsanitized display, detecting stored XSS in admin panels.
0041. **Webhook-payload reflection oracle** — registers a webhook receiver, triggers events with probe payloads, and inspects delivered payloads for unsafe reflection in third-party-facing data.
0042. **Notification-rendering oracle** — triggers push/email/SMS notifications containing probe markers and verifies rendering safety in each channel's client.
0043. **Search-index reflection oracle** — submits probe content, waits for indexing, then searches for it to detect stored reflection in search-result rendering.
0044. **API-error verbosity oracle** — systematically triggers error paths with malformed probes and grades error verbosity, detecting stack-trace or query disclosure via graded scoring.
0045. **GraphQL error-path oracle** — sends malformed GraphQL queries and analyzes error extensions for schema, resolver, or database detail leakage.
0046. **gRPC status-detail oracle** — probes gRPC endpoints with invalid payloads and inspects status details metadata for internal error disclosure.
0047. **WebSocket close-code oracle** — sends malformed WebSocket frames and analyzes close codes/reasons for internal state disclosure.
0048. **HTTP/2 rapid-reset differential oracle** — measures server behavior under HTTP/2 stream resets to detect rapid-reset DoS susceptibility with controlled, minimal request counts.
0049. **Slow-read detection oracle** — measures server tolerance for slow request bodies with bounded tests to detect slowloris-class susceptibility without completing an attack.
0050. **Range-request amplification oracle** — issues overlapping range requests and measures amplification factor to detect range-based DoS with a single bounded probe pair.
0051. **Regex-backtracking timing oracle** — sends inputs of increasing pathological length to suspected regex sinks and fits timing growth to detect ReDoS via super-linear curve fitting, not single timeouts.
0052. **Hash-collision timing oracle** — measures hash-table insertion timing with crafted keys to detect hash-flooding susceptibility via distribution analysis.
0053. **XML-entity expansion oracle** — sends bounded billion-laughs-style probes with strict size caps and measures memory/time growth to detect XXE expansion without resource exhaustion.
0054. **JSON-depth recursion oracle** — sends deeply nested JSON with bounded depth and measures parser behavior to detect stack-exhaustion vectors safely.
0055. **Multipart-boundary confusion oracle** — varies multipart boundaries and diffs parsed results to detect parser confusion enabling file-upload bypass.
0056. **Chunked-encoding desync oracle** — sends paired CL/TE variations and observes which length the backend honors, detecting request-smuggling desync with differential attribution.
0057. **Header-folding desync oracle** — tests obsolete line folding handling differences between front and back ends to detect smuggling via differential parsing.
0058. **Trailing-header differential oracle** — compares handling of chunked trailers between proxy and origin to detect smuggling or cache poisoning via trailer confusion.
0059. **HTTP/3 QUIC differential oracle** — compares HTTP/3 vs HTTP/1.1 handling of the same probe to detect protocol-translation vulnerabilities at the edge.
0060. **WebSocket upgrade smuggling oracle** — tests whether the upgrade path bypasses WAF rules applied to plain HTTP, detecting filter bypass via protocol upgrade.
0061. **Early-hints (103) injection oracle** — detects whether 103 Early Hints responses can carry attacker-influenced Link headers, enabling preload-based attacks.
0062. **Server-push differential oracle** — compares pushed resources for benign vs probe requests to detect cache poisoning via HTTP/2 server push.
0063. **Alt-Svc hijack oracle** — tests whether attacker-influenced Alt-Svc headers can redirect subsequent connections, detecting protocol-downgrade vectors.
0064. **HSTS-bypass detection oracle** — verifies HSTS preload and includeSubDomains coverage to detect SSL-stripping windows on subdomains.
0065. **Certificate-transparency monitor** — watches CT logs for the target's domains during the hunt to detect rogue certificate issuance as a detection signal for takeover or MITM.
0066. **DNS-rebinding detection oracle** — tests whether the application validates Host against DNS-rebound addresses, detecting rebinding-to-internal-service vectors.
0067. **SSRF cloud-metadata oracle** — uses non-routable canary tokens (not real metadata IPs) to detect SSRF intent, proving the request left the server without touching real cloud metadata.
0068. **SSRF redirect-chain oracle** — chains the canary URL through redirects to detect SSRF filters that validate only the initial URL but follow redirects unsafely.
0069. **SSRF DNS-time oracle** — measures DNS resolution timing for probe domains to detect SSRF via timing side channels when responses are suppressed.
0070. **SSRF error-differential oracle** — compares error messages for internal vs external probe URLs to detect SSRF via error-message differences.
0071. **XXE out-of-band oracle** — uses parameter entities pointing at the canary server with unique tokens, attributing blind XXE via token-tagged DNS callbacks.
0072. **XXE error-based oracle** — triggers XML parser errors with probe entities and analyzes error text for file-content disclosure.
0073. **DTD-retrieval timing oracle** — measures external DTD fetch timing to detect XXE when the parser fetches remote DTDs but suppresses content.
0074. **XInclude detection oracle** — tests XInclude processing with canary hrefs to detect server-side include via out-of-band callbacks.
0075. **SVG-script reflection oracle** — uploads SVG probes and verifies whether script contexts survive sanitization when rendered, detecting stored XSS via file upload.
0076. **Polyglot-file differential oracle** — uploads polyglot files and requests them with different content types to detect MIME-sniffing XSS.
0077. **EXIF-reflection oracle** — embeds markers in image EXIF data and checks whether metadata is rendered unsafely in galleries or admin views.
0078. **ID3-tag reflection oracle** — embeds markers in audio metadata and verifies safe rendering in media players and listings.
0079. **Font-file parsing oracle** — uploads crafted font files with bounded mutations to detect parser crashes without causing denial of service.
0080. **Archive-traversal oracle** — uploads archives with canary path-traversal entries and verifies whether extraction is contained, detecting zip-slip via canary file placement.
0081. **Symlink-extraction oracle** — includes symlinks in uploaded archives pointing at canary paths to detect unsafe symlink handling during extraction.
0082. **Macro-detection oracle** — uploads Office documents and inspects whether macro execution contexts are reachable, detecting macro-based vectors via metadata analysis.
0083. **PDF-JS differential oracle** — compares PDF JavaScript handling across viewers to detect PDF-based XSS that only fires in specific renderers.
0084. **Image-tragick canary oracle** — uploads images with canary-laden MVG-like metadata processed only by vulnerable delegates, detecting ImageMagick-style RCE intent via out-of-band callbacks without payload execution.
0085. **FFmpeg-metadata oracle** — uploads media with crafted metadata and observes processing behavior to detect command-injection intent via canary callbacks.
0086. **Thumbnail-generation oracle** — measures thumbnail service behavior with probe images to detect SSRF or RCE in image pipelines via canary attribution.
0087. **OCR-reflection oracle** — uploads images containing text markers and checks whether OCR-extracted text is rendered unsafely, detecting stored XSS via OCR pipelines.
0088. **Virus-scan bypass oracle** — tests whether uploaded files reach storage before scan verdicts, detecting race conditions in upload-scan flows via timing analysis.
0089. **Content-disposition differential oracle** — varies Content-Disposition handling to detect content-type confusion enabling download-based XSS.
0090. **Nosniff-bypass oracle** — verifies X-Content-Type-Options coverage on user-uploaded content endpoints to detect sniffing-based script execution.
0091. **Download-filename injection oracle** — injects markers into download filenames and verifies safe Content-Disposition encoding, detecting header injection via downloads.
0092. **Range-request cache oracle** — tests whether range requests poison caches with partial content, detecting cache poisoning via range confusion.
0093. **Vary-header analysis oracle** — inspects Vary headers to determine cache-key completeness, detecting unkeyed-input vulnerabilities analytically.
0094. **Cache-deception differential oracle** — requests static-looking URLs with path confusion and compares authenticated vs unauthenticated responses to detect web-cache deception.
0095. **Path-normalization differential oracle** — sends encoded and mixed-separator paths and compares routing decisions to detect path-confusion access-control bypass.
0096. **Trailing-slash differential oracle** — compares responses for trailing-slash variants to detect routing inconsistencies enabling auth bypass.
0097. **Case-sensitivity differential oracle** — varies URL case and compares access-control decisions to detect case-based bypass on case-insensitive filesystems.
0098. **Semicolon-parameter oracle** — tests semicolon path parameters (e.g., ;jsessionid) handling differences to detect auth bypass via parameter confusion.
0099. **Dot-segment normalization oracle** — sends dot-segment paths and compares normalization between WAF and backend to detect filter bypass.
0100. **Unicode-normalization differential oracle** — sends Unicode-variant paths and compares normalization behavior to detect access-control bypass via normalization mismatch.
0101. **Canary-tokenized OOB listener mesh** — runs a mesh of DNS, HTTP, SMTP, and LDAP canary listeners that each mint per-probe tokens, so any out-of-band hit is attributed to the exact probe, payload variant, and timestamp with no cross-talk.
0102. **Blind-XSS callback correlator** — injects unique per-field tokens into every input vector and monitors the canary collector for script executions, attributing stored XSS callbacks to the specific injection point and session.
0103. **SSRF cloud-canary discriminator** — issues probes to sentinel domains that resolve to documentation-only IPs, proving the server attempted egress without ever touching real cloud metadata endpoints.
0104. **DNS-exfiltration oracle** — encodes probe markers into subdomain labels of canary domains and watches for resolver queries, detecting blind command injection that exfiltrates via DNS.
0105. **SMTP-callback oracle** — supplies canary email addresses in profile fields and monitors the mail collector for outbound mail, detecting server-side mail injection or notification forgery.
0106. **LDAP-bind canary oracle** — points directory-service probes at a canary LDAP listener with unique bind DNs, detecting LDAP injection that reaches the directory layer.
0107. **XXE parameter-entity correlator** — crafts parameter entities referencing tokenized canary URLs and correlates fetch callbacks to the exact XML document and entity, confirming blind XXE.
0108. **SSRF redirect-following oracle** — places a canary URL that 302-redirects to a second tokenized URL and checks which token arrives, proving the fetcher follows redirects past SSRF validation.
0109. **Time-delay OOB correlator** — combines a time-delay payload with a canary callback so confirmation requires both the delay signature and the callback token, eliminating network-noise false positives.
0110. **Collaborator polling with jitter windows** — polls the canary server in adaptive intervals keyed to probe send-time plus expected network delay, avoiding missed callbacks from premature polling.
0111. **FTP-protocol canary oracle** — supplies ftp:// canary URLs to file-fetch features and monitors the FTP listener, detecting SSRF in services that accept non-HTTP schemes.
0112. **Gopher/dict scheme oracle** — tests legacy scheme handlers against canary listeners to detect SSRF-to-internal-service pivots without scanning real internals.
0113. **WebSocket-callback oracle** — triggers server-side WebSocket dial-outs to canary endpoints and correlates connection attempts to probes, detecting blind SSRF in real-time features.
0114. **Server-side PDF-fetch oracle** — embeds canary URLs in HTML-to-PDF inputs and watches for fetch callbacks, detecting SSRF in document-generation pipelines.
0115. **Thumbnail-fetch attribution oracle** — submits canary image URLs to thumbnail/preview features and attributes fetch callbacks to the submitting user action, proving SSRF with user-action linkage.
0116. **Favicon-fetch oracle** — uses canary favicon URLs in link-preview features to detect SSRF in metadata-fetching services via callback attribution.
0117. **OpenGraph-scraper oracle** — submits canary URLs to social-preview endpoints and correlates scraper fetches to the submission, detecting SSRF in unfurling services.
0118. **Webhook-retry timing oracle** — analyzes webhook delivery retry patterns to a canary receiver to infer server-side processing of attacker URLs without direct feedback.
0119. **SSRF via DNS-rebinding canary** — uses canary domains with short-TTL rebinding between external and sentinel-internal IPs to detect SSRF filters that validate DNS once but connect later.
0120. **Header-based OOB oracle** — places canary URLs in Referer/User-Agent-driven server features (analytics, logging webhooks) to detect secondary SSRF in logging pipelines.
0121. **Error-page callback oracle** — injects canary URLs into fields rendered on error pages that fetch remote avatars/resources, detecting stored SSRF via error-page rendering.
0122. **CSS-import fetch oracle** — injects @import canary URLs into style contexts and monitors fetch callbacks, detecting server-side CSS fetching vulnerabilities.
0123. **Font-fetch oracle** — supplies canary font URLs in theme customization and correlates fetch attempts, detecting SSRF in asset pipelines.
0124. **Video-transcode callback oracle** — submits canary media URLs to transcoding services and attributes fetch callbacks to detect SSRF in media pipelines.
0125. **Document-conversion oracle** — submits canary document URLs to conversion APIs and watches for fetch callbacks, detecting SSRF in office-document pipelines.
0126. **Epub/mobi fetch oracle** — tests ebook-conversion features with canary URLs to detect SSRF in publishing pipelines.
0127. **QR-code fetch oracle** — submits canary URLs to QR-generation services that fetch remote logos, detecting SSRF via callback attribution.
0128. **Barcode-label oracle** — tests label-generation features with canary image URLs for server-side fetch detection.
0129. **Map-tile fetch oracle** — supplies canary tile URLs to custom-map features and correlates fetch callbacks, detecting SSRF in geospatial services.
0130. **Captcha-audio fetch oracle** — tests audio-captcha features that fetch remote resources with canary URLs, detecting SSRF in accessibility services.
0131. **SAML-metadata fetch oracle** — registers canary SAML metadata URLs and monitors fetch callbacks, detecting XXE/SSRF in SSO configuration.
0132. **OIDC-discovery fetch oracle** — supplies canary OIDC discovery URLs and correlates fetch attempts, detecting SSRF in federation setup.
0133. **Webhook-signature bypass oracle** — sends webhooks with mutated signatures to canary receivers and analyzes acceptance, detecting signature-verification flaws via delivery behavior.
0134. **XXE billion-laughs canary** — uses bounded entity-expansion probes referencing canary tokens so that expansion is detected via callback rather than resource exhaustion.
0135. **YAML-deserialization canary** — submits YAML with canary-tagged anchors that phone home only through parser-supported external references, detecting unsafe YAML loading without code execution.
0136. **Pickle-import canary oracle** — crafts pickle payloads whose only side effect is a DNS lookup to a tokenized canary domain via documented import behavior, detecting deserialization without executing attacker code.
0137. **Java-gadget canary oracle** — uses gadget chains that terminate in a canary HTTP callback class present in common libraries, detecting Java deserialization via callback without RCE.
0138. **PHP-phar canary oracle** — triggers phar deserialization paths that emit canary callbacks through metadata parsing, detecting phar vectors without code execution.
0139. **Node-serialization canary oracle** — uses node-serialize payloads that invoke only a canary getter performing a DNS lookup, detecting unsafe deserialization safely.
0140. **Ruby-YAML canary oracle** — crafts Ruby YAML payloads whose evaluation is limited to a canary method that phones home, detecting unsafe loading without shell access.
0141. **Dotnet-viewstate canary oracle** — submits ViewState with canary object graphs that trigger only logging callbacks, detecting unsafe ViewState deserialization.
0142. **AMF-deserialization oracle** — sends AMF payloads with canary Externalizable classes that perform DNS callbacks, detecting BlazeDS-style deserialization safely.
0143. **Hessian-canary oracle** — crafts Hessian payloads with canary readResolve hooks that phone home, detecting Java Hessian deserialization without RCE.
0144. **Kryo-canary oracle** — uses Kryo payloads with canary serializers that emit callbacks, detecting unsafe Kryo usage in RPC services.
0145. **Protobuf-unknown-field oracle** — sends protobuf messages with unknown canary fields and observes whether the server reflects or processes them, detecting parser-confusion vectors.
0146. **MessagePack-extension oracle** — tests MessagePack extension-type handling with canary extension IDs to detect unsafe extension dispatch.
0147. **BSON-regex canary oracle** — submits BSON with canary regex objects and observes evaluation behavior, detecting NoSQL operator injection via callback.
0148. **CBOR-tag oracle** — tests CBOR tag handling with canary tags to detect tag-confusion vulnerabilities in IoT/API services.
0149. **Avro-schema canary oracle** — submits Avro data with canary schema references and monitors resolution callbacks, detecting schema-injection vectors.
0150. **Thrift-field oracle** — sends Thrift payloads with canary field IDs and observes parsing, detecting deserialization confusion safely.
0151. **GraphQL-batch OOB oracle** — embeds canary URLs in batched GraphQL mutations and attributes callbacks to the specific batched operation, detecting blind injection per-operation.
0152. **GraphQL-subscription callback oracle** — triggers subscriptions with canary payloads and monitors delivery, detecting stored injection in real-time channels.
0153. **WebSocket-frame OOB oracle** — sends WebSocket messages containing canary URLs and correlates server-side fetch callbacks to the frame, detecting blind SSRF over sockets.
0154. **SSE-stream injection oracle** — injects markers into server-sent-event streams and verifies whether clients execute them, detecting XSS in streaming endpoints.
0155. **gRPC-metadata OOB oracle** — places canary values in gRPC metadata and monitors downstream callbacks, detecting metadata-injection vectors.
0156. **MQTT-topic canary oracle** — publishes canary topics/payloads and monitors broker-side processing callbacks, detecting injection in IoT messaging layers.
0157. **STOMP-frame oracle** — tests STOMP frame handling with canary headers to detect header-injection in message brokers.
0158. **AMQP-routing oracle** — publishes canary routing keys and monitors exchange behavior, detecting routing-confusion vectors.
0159. **Kafka-header canary oracle** — injects canary Kafka headers and observes consumer-side processing, detecting header-trust vulnerabilities.
0160. **NATS-subject oracle** — tests NATS subject handling with canary subjects to detect wildcard-subscription leaks.
0161. **Redis-pubsub canary oracle** — publishes canary channels and monitors subscriber callbacks, detecting pub/sub injection in caching layers.
0162. **Elasticsearch-query canary** — submits search queries with canary DSL fragments and observes slow-log or callback behavior, detecting query-DSL injection safely.
0163. **Solr-select canary oracle** — tests Solr select handlers with canary parameters and correlates behavior, detecting parameter injection.
0164. **Prometheus-query oracle** — submits PromQL with canary metric names and observes evaluation, detecting query-injection in monitoring endpoints.
0165. **Graphite-render canary** — tests Graphite render APIs with canary targets to detect server-side request forgery in metrics pipelines.
0166. **InfluxDB-query oracle** — submits InfluxQL with canary measurements and observes execution, detecting injection in time-series APIs.
0167. **MongoDB-operator canary** — submits JSON with canary $where-like operators (inert, callback-only) to detect NoSQL injection without database access.
0168. **CouchDB-view canary** — tests CouchDB view queries with canary map functions that only emit callbacks, detecting server-side JS execution safely.
0169. **Neo4j-Cypher canary** — submits Cypher with canary LOAD CSV URLs pointing at the canary server, detecting Cypher injection via callback attribution.
0170. **Gremlin-traversal canary** — tests Gremlin endpoints with canary traversals that phone home, detecting graph-query injection safely.
0171. **SPARQL-query canary** — submits SPARQL with canary SERVICE URLs and monitors fetch callbacks, detecting SPARQL injection via out-of-band attribution.
0172. **LDAP-search canary** — submits directory queries with canary filters that trigger only logging callbacks, detecting LDAP injection without directory access.
0173. **XPath-boolean canary** — uses boolean-based XPath probes with canary predicates that alter result counts measurably, detecting XPath injection via result-set differentials.
0174. **XQuery canary oracle** — submits XQuery with canary doc() URLs and correlates fetch callbacks, detecting XQuery injection safely.
0175. **Template-engine canary** — uses per-engine inert expressions that render canary strings only if evaluated, detecting SSTI without executing code.
0176. **EL-expression canary** — submits expression-language probes that resolve to canary values only when evaluated, detecting EL injection via output differentials.
0177. **OGNL canary oracle** — tests OGNL contexts with canary property chains that phone home only through documented getters, detecting Struts-style injection safely.
0178. **SpEL canary oracle** — submits Spring EL probes resolving to canary beans that emit callbacks, detecting SpEL injection without code execution.
0179. **MVEL canary oracle** — tests MVEL evaluation contexts with canary expressions that only log, detecting injection safely.
0180. **Jinja-sandbox canary** — probes Jinja sandboxes with canary attribute chains that trigger only sandbox-escape detectors, measuring escape without payload execution.
0181. **Twig-sandbox canary** — tests Twig sandbox escapes with canary function calls that phone home, detecting sandbox bypass safely.
0182. **Freemarker canary oracle** — submits Freemarker probes with canary directives that emit callbacks, detecting SSTI via attribution.
0183. **Velocity canary oracle** — tests Velocity templates with canary references that only log, detecting injection safely.
0184. **Handlebars canary oracle** — submits Handlebars probes with canary helpers that phone home, detecting helper-injection vectors.
0185. **Pug/Jade canary oracle** — tests Pug templates with canary code blocks that emit callbacks, detecting SSTI via attribution.
0186. **ERB canary oracle** — submits ERB probes with canary expressions that only log, detecting Ruby template injection safely.
0187. **Smarty canary oracle** — tests Smarty templates with canary modifiers that phone home, detecting injection via callback.
0188. **Blade canary oracle** — submits Blade probes with canary directives that emit callbacks, detecting Laravel SSTI safely.
0189. **Thymeleaf canary oracle** — tests Thymeleaf expressions with canary utility calls that only log, detecting injection via output differentials.
0190. **Mustache-lambda canary** — submits Mustache lambdas with canary functions that phone home, detecting lambda-injection vectors.
0191. **Dust.js canary oracle** — tests Dust templates with canary helpers that emit callbacks, detecting SSTI safely.
0192. **EJS canary oracle** — submits EJS probes with canary scriptlets that only log, detecting injection via attribution.
0193. **Nunjucks canary oracle** — tests Nunjucks with canary filters that phone home, detecting sandbox escapes safely.
0194. **Lodash-template canary** — submits lodash template probes with canary interpolations that emit callbacks, detecting client/server template injection.
0195. **Underscore-template canary** — tests underscore templates with canary evaluations that only log, detecting injection safely.
0196. **Squirrelly canary oracle** — submits Squirrelly probes with canary helpers that phone home, detecting injection via callback.
0197. **Eta canary oracle** — tests Eta templates with canary expressions that emit callbacks, detecting SSTI safely.
0198. **Liquid canary oracle** — submits Liquid probes with canary drops that only log, detecting Shopify-style injection via output differentials.
0199. **Genshi canary oracle** — tests Genshi templates with canary directives that phone home, detecting Python template injection safely.
0200. **Mako canary oracle** — submits Mako probes with canary expressions that emit callbacks, detecting SSTI via attribution.
0201. **Backend-state mutation verifier** — snapshots observable state (profile fields, cart contents, resource counts) before and after a probe, confirming IDOR/BOLA only when the backend state actually mutated for an unauthorized actor.
0202. **Cross-principal state oracle** — performs an action as attacker principal A and reads resulting state as victim principal B, detecting cross-tenant writes that single-principal testing misses.
0203. **Database-row-count differential** — monitors list-endpoint counts before/after probe writes to detect unauthorized record creation with numeric proof of mutation.
0204. **Idempotency-key replay oracle** — replays requests with reused idempotency keys and compares outcomes to detect broken idempotency enabling double-spend or duplicate actions.
0205. **Optimistic-locking bypass detector** — varies ETag/version fields and observes whether stale writes succeed, detecting lost-update vulnerabilities via version-differential testing.
0206. **Soft-delete resurrection oracle** — attempts to access soft-deleted records via direct IDs and compares responses to detect IDOR on logically deleted data.
0207. **Trash/restore state oracle** — moves resources through trash/restore flows as a low-privilege user and verifies whether ownership checks apply at each transition.
0208. **Ownership-transfer mutation oracle** — attempts ownership-transfer actions and verifies via a second principal whether the transfer persisted, detecting privilege escalation with state proof.
0209. **Role-assignment state verifier** — tries to grant roles to attacker-controlled accounts and confirms via token refresh whether the role materialized, proving privilege escalation.
0210. **API-key scope mutation oracle** — creates API keys with elevated scopes as a low-privilege user and tests the key's actual permissions, detecting scope-escalation with functional proof.
0211. **Webhook-secret rotation oracle** — attempts to rotate another tenant's webhook secrets and verifies via delivery behavior, detecting cross-tenant mutation.
0212. **Billing-plan mutation oracle** — attempts plan upgrades/downgrades via parameter tampering and verifies the persisted plan via invoice endpoints, detecting business-logic bypass with state proof.
0213. **Quota-exhaustion state oracle** — consumes quotas as one user and verifies whether another user's quota is affected, detecting shared-quota confusion.
0214. **Coupon-reuse state tracker** — redeems single-use coupons twice and verifies both redemptions persisted, detecting race-prone business logic with ledger proof.
0215. **Refund-state differential oracle** — issues refunds and verifies ledger entries for duplicates or negative balances, detecting financial logic flaws via state inspection.
0216. **Inventory-reservation oracle** — reserves inventory concurrently and verifies oversell by comparing reserved vs available counts, detecting race conditions with numeric proof.
0217. **Second-order stored-payload monitor** — plants inert markers in every writable field, then crawls all read surfaces (including admin, export, email) to detect where markers render, mapping stored-XSS reachability.
0218. **Second-order SQLi confirmation** — stores probe strings and later triggers features that consume stored data in queries, detecting second-order SQLi via error or timing differentials on the consuming request.
0219. **Delayed-execution job monitor** — plants markers in scheduled-job inputs and monitors job outputs for marker execution, detecting SSTI/RCE in async workers.
0220. **Report-generation sink monitor** — injects markers into report inputs and inspects generated reports for evaluation, detecting template injection in batch pipelines.
0221. **Search-index poisoning detector** — plants markers via user content, waits for index cycles, then queries the search API to detect stored injection in search rendering.
0222. **Recommendation-engine oracle** — plants interaction markers and observes whether recommendations reflect attacker-influenced data across principals, detecting cross-user data leaks.
0223. **Cache-poison second-order verifier** — poisons a cache entry with a marker, then fetches the resource as an unauthenticated user from multiple PoPs to confirm the poisoned response is served to victims.
0224. **Multi-PoP cache confirmation** — verifies cache-poisoning findings by requesting the poisoned URL from geographically distinct egress points, requiring consistent poisoned responses before flagging.
0225. **CDN-purge bypass oracle** — tests whether cache purges actually invalidate poisoned entries by re-requesting post-purge, detecting purge-authentication flaws.
0226. **Edge-include (ESI) injection oracle** — injects ESI tags into cacheable responses and verifies server-side inclusion via marker rendering, detecting ESI injection with differential proof.
0227. **Cache-key fragmentation oracle** — varies fragment identifiers and query ordering to map cache-key normalization, detecting poisoning via key-confusion.
0228. **Web-cache deception confirmer** — accesses a deception URL as attacker, then requests the same cached object as victim to prove the victim receives the attacker's private data.
0229. **Cookie-based cache poison oracle** — tests whether attacker-controlled cookies become part of cached responses served to others, detecting session-dependent cache poisoning.
0230. **Header-based cache poison oracle** — varies unkeyed headers (X-Forwarded-Host, User-Agent) with markers and verifies poisoned responses served to clean requests.
0231. **Fat-GET cache oracle** — sends GET requests with bodies to detect caching layers that ignore bodies, enabling parameter-smuggling cache poisoning.
0232. **Method-override cache oracle** — tests whether X-HTTP-Method-Override alters cached variants, detecting cache poisoning via method confusion.
0233. **Normalized-path cache oracle** — compares cache behavior for encoded vs decoded paths to detect poisoning via normalization mismatch between cache and origin.
0234. **Query-string ordering cache oracle** — permutes query parameters to detect order-sensitive cache keys enabling duplicate-cache-entry attacks.
0235. **Trailing-dot cache oracle** — tests trailing-dot hostnames against cache-key logic to detect poisoning via host-normalization gaps.
0236. **Port-in-URL cache oracle** — varies explicit ports in URLs to detect cache-key port handling flaws.
0237. **Case-normalization cache oracle** — varies URL case to detect case-sensitive cache keys on case-insensitive origins, enabling poisoning.
0238. **Double-encoding cache oracle** — tests double-encoded paths against cache normalization to detect desync between cache key and origin routing.
0239. **Semicolon-param cache oracle** — tests semicolon parameters in cached URLs to detect routing-vs-cache desync.
0240. **Fragment-smuggling cache oracle** — verifies that URL fragments never reach the origin but may affect edge logic, detecting fragment-based cache confusion.
0241. **State-changing GET detector** — crawls GET endpoints with side-effect-sensitive probes and verifies state mutations, detecting CSRF-able state changes via unsafe methods.
0242. **CSRF-token binding verifier** — replays tokens across sessions and users to verify token-to-session binding, detecting CSRF where tokens are not bound.
0243. **SameSite-cookie bypass oracle** — tests top-level navigation flows that bypass SameSite=Lax to detect CSRF in Lax-by-default deployments.
0244. **Referer-validation differential** — varies Referer/Origin headers systematically to map CSRF validation logic and detect validation gaps.
0245. **Login-CSRF state oracle** — performs login CSRF and verifies the victim session is bound to attacker credentials, detecting session-fixation via login CSRF.
0246. **Logout-CSRF impact oracle** — tests logout CSRF and measures session invalidation to assess whether logout is state-changing without protection.
0247. **JSON-CSRF content-type oracle** — tests whether JSON endpoints accept text/plain or form-encoded bodies, detecting CSRF via content-type confusion.
0248. **CORS-credentialed CSRF oracle** — combines permissive CORS with credentialed requests to detect CSRF-equivalent cross-origin writes.
0249. **WebSocket-CSRF oracle** — tests whether WebSocket handshakes validate Origin, detecting cross-site WebSocket hijacking.
0250. **Clickjacking-state oracle** — frames state-changing pages and verifies frame-ability plus absence of frame-busting, detecting UI-redressing with X-Frame-Options/CSP analysis.
0251. **File-upload state verifier** — uploads files and verifies via direct fetch whether they persist with executable content types, detecting unrestricted upload with persistence proof.
0252. **Upload-then-include oracle** — uploads a canary file and tests whether it can be included via LFI parameters, detecting upload-to-RCE chains safely.
0253. **Avatar-processing state oracle** — uploads avatar images and verifies processing-pipeline behavior for SSRF/RCE via canary callbacks.
0254. **Chunked-upload reassembly oracle** — tests chunked-upload reassembly for path-traversal in chunk metadata, detecting traversal via canary placement.
0255. **Resumable-upload session oracle** — tests resumable-upload session IDs for predictability and cross-user access, detecting IDOR in upload sessions.
0256. **Virus-scan race oracle** — uploads a canary EICAR-like marker (inert) and measures time-to-availability vs scan completion, detecting scan-bypass races.
0257. **Archive-extraction state oracle** — uploads archives with canary entries and verifies extraction containment via filesystem callbacks, detecting zip-slip with proof.
0258. **Image-dimension state oracle** — uploads images with extreme dimensions and observes processing to detect decompression-bomb handling via bounded tests.
0259. **SVG-upload state oracle** — uploads SVG with canary scripts and verifies sanitization by fetching the stored file, detecting stored XSS with persistence proof.
0260. **HTML-upload sandbox oracle** — uploads HTML files and verifies whether they are served with sandboxing headers, detecting stored-XSS via upload.
0261. **CSV-upload formula state oracle** — uploads CSVs with formula markers and re-exports them to detect formula persistence through the pipeline.
0262. **Document-macro state oracle** — uploads Office docs and verifies macro-strip behavior via metadata comparison, detecting macro persistence.
0263. **Font-upload parsing oracle** — uploads fonts with bounded mutations and monitors renderer behavior, detecting parser flaws without DoS.
0264. **Video-codec state oracle** — uploads videos with canary codec parameters and monitors transcode callbacks, detecting pipeline injection.
0265. **Subtitle-upload oracle** — uploads subtitle files with markup markers and verifies rendering safety, detecting stored XSS via subtitles.
0266. **Sitemap-upload oracle** — tests sitemap imports with canary URLs and monitors fetch callbacks, detecting SSRF in SEO tools.
0267. **Plugin-upload oracle** — tests plugin/theme uploads for code-execution primitives via canary callbacks, detecting unsafe extensibility.
0268. **Backup-restore state oracle** — tests backup import with canary entries and verifies restore isolation, detecting path traversal in restore flows.
0269. **Import-mapping state oracle** — imports CSV mappings with canary fields and verifies field binding, detecting mass-assignment via import.
0270. **Bulk-action state verifier** — performs bulk updates and verifies per-record authorization, detecting IDOR in batch endpoints with state proof.
0271. **Export-scope state oracle** — triggers exports and verifies row-level filtering matches the requester's permissions, detecting data over-exposure with content proof.
0272. **Pagination-IDOR oracle** — walks paginated APIs with cursor tampering to detect unauthorized record access via pagination.
0273. **Sort-field injection oracle** — injects sort parameters and observes query behavior for SQLi via error/timing differentials.
0274. **Filter-operator oracle** — tests filter operators (gt, lt, regex) for NoSQL/SQL injection via behavioral differentials.
0275. **Field-selection oracle** — requests restricted fields via sparse fieldsets and verifies enforcement, detecting over-exposure with content proof.
0276. **Include-depth oracle** — varies relationship-include depth to detect DoS or data-exposure via nested includes.
0277. **Aggregation-pipeline oracle** — tests aggregation parameters for injection via timing/error differentials.
0278. **Full-text-search injection oracle** — submits search operators and observes parser behavior for injection via result differentials.
0279. **Geo-query oracle** — submits geo parameters and verifies boundary enforcement, detecting location-data leaks.
0280. **Date-range filter oracle** — tests date filters for injection and boundary bypass via result-set differentials.
0281. **Multi-tenant filter bypass oracle** — removes tenant filters and verifies whether cross-tenant rows appear, detecting tenant-isolation failure with data proof.
0282. **Tenant-ID tampering oracle** — swaps tenant identifiers in requests and verifies data isolation, detecting broken tenant boundaries.
0283. **Subdomain-tenant confusion oracle** — tests tenant resolution via Host vs path vs token to detect tenant-confusion vulnerabilities.
0284. **Schema-per-tenant leak oracle** — probes for schema differences across tenants to detect information leakage via schema introspection.
0285. **Cross-tenant search oracle** — searches as one tenant and verifies no other tenant's documents appear, detecting search-index tenant leaks.
0286. **Cross-tenant notification oracle** — triggers notifications and verifies recipients stay within tenant boundaries, detecting notification leaks.
0287. **Cross-tenant export oracle** — exports data and verifies tenant scoping of exported rows, detecting export leaks with content proof.
0288. **Cross-tenant analytics oracle** — queries analytics endpoints and verifies metric isolation, detecting aggregation leaks.
0289. **API-key tenant-binding oracle** — uses one tenant's API key against another tenant's resources to verify binding enforcement.
0290. **JWT-tenant claim oracle** — tampers with tenant claims in JWTs and verifies enforcement, detecting claim-trust vulnerabilities.
0291. **Session-tenant confusion oracle** — tests whether sessions carry tenant context securely across tenant switches.
0292. **Cache-tenant isolation oracle** — poisons cache as one tenant and verifies other tenants are unaffected, detecting cache tenant leaks.
0293. **Log-tenant isolation oracle** — verifies logs do not commingle tenant data via log-query differentials.
0294. **Backup-tenant isolation oracle** — tests backup scoping to ensure restores cannot cross tenant boundaries.
0295. **Invite-token tenant oracle** — tests invitation tokens for tenant-confusion enabling cross-tenant joins.
0296. **SSO-tenant mapping oracle** — tests SSO attribute mapping for tenant-confusion in federated login.
0297. **Custom-domain tenant oracle** — tests custom-domain tenant resolution for takeover or confusion vectors.
0298. **Wildcard-tenant oracle** — tests wildcard subdomain handling for tenant-routing bypass.
0299. **Trial-tenant escalation oracle** — tests trial-to-paid boundary enforcement for privilege confusion.
0300. **Deleted-tenant resurrection oracle** — tests whether deleted tenants' data remains accessible, detecting incomplete deletion.
0301. **Paired-sample timing oracle** — interleaves baseline and probe requests in ABAB order and applies a Wilcoxon signed-rank test, detecting time-based SQLi while canceling slow network drift.
0302. **Jitter-adaptive threshold oracle** — continuously estimates network jitter from benign requests and sets per-probe timing thresholds at jitter-mean plus 5 standard deviations, preventing false positives on noisy links.
0303. **Multi-quantile timing analyzer** — compares full latency distributions (p50/p90/p99) between benign and probe traffic instead of means, detecting subtle time-based blind injections hidden in averages.
0304. **Sequential probability ratio timing test** — applies Wald's SPRT to timing samples so detection stops early with statistical guarantees once enough evidence accumulates, minimizing request volume.
0305. **Time-delay payload calibrator** — first measures the target's baseline latency, then selects sleep durations that are provably distinguishable (baseline + 6σ), ensuring time-based probes are resolvable.
0306. **DNS-timing side-channel oracle** — measures resolution time for canary subdomains with wildcard vs NXDOMAIN responses to detect blind SSRF via resolver timing differences.
0307. **Connection-timing SSRF oracle** — measures TCP connect timing to canary hosts with open vs filtered ports to infer SSRF target reachability without response content.
0308. **TLS-handshake timing oracle** — measures handshake duration differences to detect SSRF to TLS vs non-TLS internal services via timing side channels.
0309. **Regex-backtracking curve fitter** — fits response times against input lengths to polynomial/exponential models and flags ReDoS only when the exponent fits super-linear growth with R²>0.95.
0310. **HashDoS distribution analyzer** — measures bucket-distribution timing across crafted key sets to detect hash-flooding susceptibility via collision-rate statistics.
0311. **Bcrypt-cost timing oracle** — measures login timing across passwords to detect user-enumeration via timing differences in hash verification.
0312. **HMAC-compare timing oracle** — uses high-resolution timing over many samples to detect non-constant-time signature comparisons with Welch's t-test.
0313. **Password-reset timing oracle** — compares reset-flow timing for valid vs invalid accounts to detect enumeration via timing side channels.
0314. **2FA-code timing oracle** — measures verification timing for correct-length vs incorrect codes to detect timing leaks in OTP validation.
0315. **Token-validation timing oracle** — compares API-token validation latency for valid-format vs invalid tokens to detect parsing-time leaks.
0316. **Search-timing oracle** — measures search latency for matching vs non-matching terms to detect blind data extraction via timing.
0317. **Pagination-timing oracle** — measures page-fetch timing across deep offsets to detect offset-based enumeration or query-cost leaks.
0318. **Export-timing oracle** — measures export-generation time for small vs large datasets to detect unthrottled export DoS via cost modeling.
0319. **Report-timing oracle** — measures report rendering latency with complexity-scaled inputs to detect algorithmic-complexity DoS safely.
0320. **Image-resize timing oracle** — measures resize latency vs image dimensions to detect decompression-bomb susceptibility via scaling analysis.
0321. **Archive-extract timing oracle** — measures extraction time vs archive metadata to detect zip-bomb handling flaws with bounded inputs.
0322. **XML-parse timing oracle** — measures parse time vs entity count with capped inputs to detect XXE expansion via growth-rate analysis.
0323. **JSON-parse timing oracle** — measures parse latency vs nesting depth to detect stack-exhaustion vectors via depth-scaling fits.
0324. **CSV-parse timing oracle** — measures CSV parsing vs row/column counts to detect formula-evaluation DoS via scaling analysis.
0325. **Markdown-render timing oracle** — measures render time vs input complexity to detect renderer-based ReDoS via curve fitting.
0326. **Template-render timing oracle** — measures template rendering vs expression complexity to detect SSTI-adjacent DoS via timing models.
0327. **GraphQL-depth timing oracle** — measures query latency vs nesting depth to detect GraphQL DoS via depth-scaling analysis.
0328. **GraphQL-batch timing oracle** — measures batch latency vs batch size to detect batch-amplification DoS via linear-fit analysis.
0329. **WebSocket-flood timing oracle** — measures message-processing latency under bounded burst rates to detect frame-handling DoS safely.
0330. **SSE-backpressure oracle** — measures stream latency under bounded event rates to detect backpressure-handling flaws.
0331. **gRPC-stream timing oracle** — measures stream processing vs message count to detect streaming DoS via scaling fits.
0332. **Multipart-parse timing oracle** — measures multipart parsing vs part count to detect parser DoS via growth analysis.
0333. **Chunked-transfer timing oracle** — measures chunked-body processing vs chunk count to detect chunk-handling DoS.
0334. **Header-count timing oracle** — measures request processing vs header count to detect header-parsing DoS with bounded headers.
0335. **Cookie-size timing oracle** — measures session handling vs cookie size to detect deserialization-cost DoS via scaling analysis.
0336. **JWT-verify timing oracle** — measures verification latency vs token complexity to detect algorithm-confusion cost asymmetries.
0337. **SAML-parse timing oracle** — measures SAML response parsing vs assertion count to detect XML-signature DoS via scaling fits.
0338. **OIDC-discovery timing oracle** — measures discovery-document processing vs document size to detect federation DoS vectors.
0339. **Password-hash upgrade oracle** — detects whether legacy hashes are upgraded on login by measuring timing deltas, identifying weak-hash persistence.
0340. **Rate-limit timing oracle** — measures 429-onset timing to fingerprint rate-limit windows, enabling precise limit-boundary detection without brute force.
0341. **Lockout-timing oracle** — measures lockout-trigger timing to detect account-enumeration via lockout behavior differences.
0342. **Session-creation timing oracle** — measures session-issuance latency to detect session-fixation windows via timing analysis.
0343. **Token-refresh timing oracle** — measures refresh latency for valid vs revoked tokens to detect revocation-check gaps.
0344. **MFA-enrollment timing oracle** — measures enrollment flows to detect enrollment-bypass via timing differentials.
0345. **Recovery-code timing oracle** — measures recovery-code validation to detect timing leaks in backup-code checks.
0346. **Email-verification timing oracle** — measures verification-link processing to detect token-enumeration via timing.
0347. **Invite-accept timing oracle** — measures invitation acceptance for valid vs invalid tokens to detect token-guessing oracles.
0348. **Passwordless-login timing oracle** — measures magic-link validation timing to detect link-enumeration vectors.
0349. **WebAuthn-timing oracle** — measures WebAuthn ceremony timing to detect user-verification bypass via timing analysis.
0350. **OAuth-code timing oracle** — measures authorization-code exchange timing for valid vs invalid codes to detect code-enumeration.
0351. **PKCE-verification timing oracle** — measures PKCE challenge verification to detect downgrade vectors via timing differentials.
0352. **Token-introspection timing oracle** — measures introspection latency for active vs revoked tokens to detect introspection-cache flaws.
0353. **Scope-validation timing oracle** — measures scope-check latency across scope combinations to detect scope-confusion via timing.
0354. **Consent-screen timing oracle** — measures consent-flow timing to detect consent-bypass via response-time analysis.
0355. **Backchannel-logout timing oracle** — measures logout propagation timing to detect session-persistence after logout.
0356. **Frontchannel-logout oracle** — verifies frontchannel logout iframe behavior to detect incomplete session termination.
0357. **Session-revocation timing oracle** — measures revocation propagation delay to detect revocation races.
0358. **Concurrent-session oracle** — tests concurrent session limits and measures enforcement timing to detect session-limit bypass.
0359. **Device-fingerprint timing oracle** — measures device-check latency to detect fingerprint-spoofing tolerance.
0360. **Risk-based-auth timing oracle** — measures step-up-auth trigger timing to detect risk-engine bypass via behavioral analysis.
0361. **Captcha-bypass timing oracle** — measures captcha-validation latency to detect validation-skipping via timing differentials.
0362. **Bot-score timing oracle** — measures bot-detection scoring latency to infer score thresholds via timing side channels.
0363. **WAF-bypass timing oracle** — compares WAF-block vs pass timing to fingerprint rule evaluation and detect bypass windows.
0364. **IDS-evasion timing oracle** — measures detection latency to map IDS rule coverage via timing analysis.
0365. **Honeypot-detection timing oracle** — measures response timing anomalies to identify honeypot-like deterministic delays.
0366. **Sandbox-evasion timing oracle** — measures execution timing in sandboxed features to detect sandbox-timeout bypasses.
0367. **AV-scan timing oracle** — measures upload-acceptance timing to detect scan-bypass races via timing windows.
0368. **DLP-scan timing oracle** — measures data-loss-prevention scan latency to detect scan-evasion via timing analysis.
0369. **Content-moderation timing oracle** — measures moderation-decision latency to detect moderation-bypass via timing differentials.
0370. **Fraud-score timing oracle** — measures fraud-scoring latency to infer score thresholds via timing side channels.
0371. **Payment-auth timing oracle** — measures 3DS/auth timing to detect authentication-bypass via timing analysis.
0372. **Refund-timing oracle** — measures refund-processing latency to detect double-refund races via timing windows.
0373. **Settlement-timing oracle** — measures settlement timing to detect settlement-manipulation via timing analysis.
0374. **Ledger-consistency timing oracle** — measures ledger-read timing under concurrent writes to detect read-your-write races.
0375. **Cache-stampede timing oracle** — measures thundering-herd behavior on cache expiry to detect stampede-amplification DoS safely.
0376. **DB-failover timing oracle** — measures failover latency to detect failover-window exploits via timing analysis.
0377. **Replication-lag timing oracle** — measures replica lag to detect read-after-write consistency violations.
0378. **Queue-depth timing oracle** — measures queue-processing latency to detect queue-poisoning DoS via depth analysis.
0379. **Worker-scale timing oracle** — measures autoscale reaction time to detect scale-exhaustion DoS safely.
0380. **Cold-start timing oracle** — measures serverless cold-start latency to detect cold-start amplification vectors.
0381. **Connection-pool timing oracle** — measures pool-exhaustion onset to detect pool-drain DoS with bounded connections.
0382. **File-descriptor timing oracle** — measures descriptor-exhaustion behavior to detect fd-leak DoS safely.
0383. **Memory-pressure timing oracle** — measures GC-pause latency under bounded load to detect memory-exhaustion vectors.
0384. **CPU-throttle timing oracle** — measures throttle onset to detect CPU-exhaustion DoS via scaling analysis.
0385. **Bandwidth-throttle timing oracle** — measures throttle behavior to detect bandwidth-amplification vectors.
0386. **DNS-amplification timing oracle** — measures DNS response sizes for canary queries to detect amplification via size analysis.
0387. **NTP-amplification oracle** — measures NTP response amplification with single bounded queries to detect reflection vectors.
0388. **Memcached-amplification oracle** — tests memcached UDP responses with canary keys to detect amplification safely.
0389. **SSDP-amplification oracle** — measures SSDP response sizes to detect UPnP amplification vectors.
0390. **SNMP-amplification oracle** — tests SNMP bulk responses with bounded queries to detect amplification.
0391. **CLDAP-amplification oracle** — measures CLDAP response sizes to detect amplification vectors.
0392. **CharGEN-amplification oracle** — tests chargen services with single packets to detect legacy amplification.
0393. **QOTD-amplification oracle** — tests quote-of-the-day services for reflection amplification.
0394. **Echo-amplification oracle** — tests echo services with bounded probes to detect reflection vectors.
0395. **RIPv1-amplification oracle** — tests routing-protocol responses for amplification potential.
0396. **BGP-timing oracle** — measures BGP session behavior to detect route-leak susceptibility via timing analysis.
0397. **Anycast-routing oracle** — measures anycast latency from multiple vantage points to detect routing hijacks via latency anomalies.
0398. **BGP-hijack detection oracle** — monitors origin-AS changes for target prefixes during the hunt to detect concurrent hijacking.
0399. **RPKI-validation oracle** — checks RPKI ROA coverage for target prefixes to detect hijack susceptibility.
0400. **DNSSEC-validation oracle** — verifies DNSSEC chain validity for target domains to detect DNS-spoofing susceptibility.
0401. **Role-matrix differential tester** — builds a principal×endpoint access matrix with 3+ roles and flags cells where a lower role receives the same status/body-length signature as a higher role, proving vertical privilege escalation.
0402. **Horizontal IDOR matrix tester** — tests object IDs across two same-role accounts and flags responses where account A reads account B's objects with identical success signatures, proving horizontal escalation.
0403. **JWT none-algorithm oracle** — replays tokens with alg=none and verifies acceptance via a privileged probe action, detecting none-alg acceptance with functional proof.
0404. **JWT algorithm-confusion oracle** — swaps RS256→HS256 using the public key as HMAC secret (from JWKS) and verifies forged-token acceptance, detecting key-confusion with proof.
0405. **JWT kid-injection oracle** — injects canary kid values (including path traversal and SQLi in kid) and observes verification behavior to detect kid-trust vulnerabilities via error/timing differentials.
0406. **JWT jku-confusion oracle** — supplies attacker-controlled jku URLs pointing at the canary server and correlates fetch callbacks, detecting jku trust via out-of-band attribution.
0407. **JWT x5u-confusion oracle** — supplies canary x5u certificate URLs and monitors fetch callbacks, detecting x5u trust vulnerabilities.
0408. **JWT missing-claim oracle** — strips exp/aud/iss claims systematically and verifies acceptance, detecting claim-validation gaps with functional proof.
0409. **JWT expiry-bypass oracle** — replays expired tokens and measures acceptance, detecting missing expiry enforcement.
0410. **JWT nbf-bypass oracle** — uses not-yet-valid tokens to detect missing nbf enforcement via acceptance testing.
0411. **JWT audience-confusion oracle** — swaps aud claims across services and verifies cross-service acceptance, detecting audience-trust flaws.
0412. **JWT issuer-confusion oracle** — forges tokens with alternate issuers and verifies acceptance, detecting issuer-validation gaps.
0413. **JWT weak-secret oracle** — tests HMAC secrets against a bounded dictionary with rate-limit awareness, detecting weak secrets via acceptance (never brute-forcing aggressively).
0414. **JWT key-rotation oracle** — tests whether revoked/rotated keys still validate to detect rotation-propagation failures.
0415. **JWT embedded-JWK oracle** — embeds attacker JWKs in jwk headers and verifies signature acceptance, detecting embedded-key trust.
0416. **JWT crit-header oracle** — tests critical-header handling to detect implementations that ignore crit constraints.
0417. **JWT typ-confusion oracle** — varies typ headers to detect type-confusion in verification logic.
0418. **JWT cty-confusion oracle** — tests nested-JWT handling via cty to detect nested-token validation gaps.
0419. **JWT claim-type confusion oracle** — submits string-vs-array vs object claim types to detect type-confusion in authorization checks.
0420. **JWT scope-escalation oracle** — tampers with scope claims and verifies elevated access, detecting scope-trust with functional proof.
0421. **JWT role-claim oracle** — modifies role claims and verifies authorization decisions, detecting role-claim trust.
0422. **JWT tenant-claim oracle** — swaps tenant claims and verifies cross-tenant access, detecting tenant-claim trust.
0423. **JWT replay oracle** — replays single-use tokens (password-reset, invite) to detect missing replay protection with state proof.
0424. **Session-fixation oracle** — plants a session ID pre-login and verifies it survives authentication, detecting fixation with session proof.
0425. **Session-prediction oracle** — analyzes session-ID entropy over samples to detect predictable session generation via statistical tests.
0426. **Cookie-flag regression oracle** — diffs Set-Cookie flags (HttpOnly, Secure, SameSite) across releases to detect security-flag regressions.
0427. **Cookie-tossing oracle** — plants cookies from subdomains and verifies whether the application honors attacker-set cookies, detecting cookie-tossing.
0428. **Cookie-encryption oracle** — analyzes encrypted-cookie formats for ECB patterns or padding oracles via differential testing.
0429. **Padding-oracle detector** — sends mutated CBC ciphertexts and applies statistical padding-oracle tests with error/timing differentials to detect padding oracles safely.
0430. **Compression-oracle detector** — combines compression with encryption observations to detect CRIME/BREACH susceptibility via size differentials.
0431. **IV-reuse oracle** — analyzes IV patterns across encrypted values to detect IV reuse via statistical analysis.
0432. **Nonce-reuse oracle** — tests nonce uniqueness in cryptographic protocols to detect replay-enabling reuse.
0433. **Password-reset token entropy oracle** — analyzes reset-token entropy and lifetime to detect guessable tokens via statistical tests.
0434. **Reset-token binding oracle** — tests whether reset tokens are bound to the requesting account/email, detecting token-swapping.
0435. **Reset-token leakage oracle** — checks whether reset tokens appear in Referer headers, logs, or emails to third parties via flow analysis.
0436. **Host-header reset-poisoning oracle** — poisons Host headers in reset flows and monitors canary callbacks for reset-link poisoning, detecting password-reset poisoning.
0437. **Token-in-URL leakage oracle** — crawls authenticated flows to detect session tokens in URLs via proxy logs and history analysis.
0438. **OAuth redirect-uri oracle** — tests redirect-URI validation with variations (subdomain, path traversal, fragment) to detect open-redirector chains in OAuth.
0439. **OAuth state-parameter oracle** — tests state validation by omitting/replaying state to detect CSRF in OAuth flows.
0440. **OAuth PKCE-downgrade oracle** — attempts code_challenge_method=plain downgrades to detect PKCE enforcement gaps.
0441. **OAuth implicit-flow oracle** — tests whether implicit flow is still enabled to detect token-in-fragment leakage.
0442. **OAuth scope-escalation oracle** — requests elevated scopes and verifies granted scopes, detecting scope-validation flaws.
0443. **OAuth client-impersonation oracle** — tests client authentication to detect public-client confusion.
0444. **SAML signature-wrapping oracle** — applies XSW variants and verifies acceptance, detecting signature-wrapping with functional proof.
0445. **SAML assertion-replay oracle** — replays assertions to detect missing replay protection.
0446. **SAML recipient-confusion oracle** — alters Recipient/Destination and verifies acceptance, detecting recipient-validation gaps.
0447. **SAML NameID-confusion oracle** — swaps NameID formats to detect identifier-confusion vulnerabilities.
0448. **OIDC nonce-bypass oracle** — omits/replays nonce values to detect nonce-validation gaps.
0449. **OIDC at_hash oracle** — tests at_hash validation to detect token-substitution vectors.
0450. **OIDC hybrid-flow oracle** — tests hybrid-flow response handling for code/token confusion.
0451. **MFA-bypass via flow-skip oracle** — attempts to skip MFA steps by direct navigation and verifies session elevation, detecting flow-enforcement gaps.
0452. **MFA replay oracle** — replays used TOTP/backup codes to detect missing replay protection.
0453. **MFA brute-force oracle** — measures rate-limiting on MFA endpoints with minimal attempts to detect unthrottled guessing.
0454. **MFA enrollment-bypass oracle** — tests whether MFA can be disabled without re-authentication, detecting enrollment-flow flaws.
0455. **Backup-code entropy oracle** — analyzes backup-code formats for predictability via statistical tests.
0456. **Remember-device oracle** — tests remember-device token binding to detect device-token theft vectors.
0457. **Step-up auth bypass oracle** — attempts sensitive actions without step-up and verifies enforcement, detecting step-up gaps.
0458. **Password-change CSRF oracle** — tests password-change endpoints for CSRF protection with state verification.
0459. **Email-change verification oracle** — changes account email and verifies whether re-verification is enforced, detecting account-takeover via email change.
0460. **Account-recovery oracle** — walks recovery flows to detect identity-verification gaps with functional proof.
0461. **Username-enumeration differential** — compares registration/login/reset responses for valid vs invalid accounts using statistical response analysis, detecting enumeration.
0462. **Login-error differential oracle** — applies paired valid/invalid credential tests to detect user-enumeration via error-message differences.
0463. **Response-time enumeration oracle** — uses timing analysis to detect account-enumeration via hash-verification timing.
0464. **SSO-enumeration oracle** — tests SSO discovery endpoints for account-existence disclosure.
0465. **API-key enumeration oracle** — tests key-validation endpoints for key-existence oracles via response differentials.
0466. **Invite-enumeration oracle** — tests invitation endpoints for email-existence disclosure.
0467. **Subdomain-enumeration oracle** — uses certificate-transparency and DNS analysis to map attack surface without brute force.
0468. **Directory-enumeration guardrail** — detects directory-listing exposure via status/body analysis with bounded wordlists.
0469. **Backup-file oracle** — tests for backup/config file exposure via status-code and content analysis.
0470. **Git-exposure oracle** — tests .git/HEAD accessibility to detect repository exposure with content verification.
0471. **Env-file oracle** — tests .env accessibility to detect secret exposure with redacted verification.
0472. **Swagger-exposure oracle** — detects exposed API documentation and analyzes it for sensitive endpoint disclosure.
0473. **GraphQL-introspection oracle** — tests introspection availability and analyzes schema for sensitive field exposure.
0474. **Debug-endpoint oracle** — tests common debug paths and analyzes responses for debug-mode disclosure.
0475. **Health-check oracle** — analyzes health endpoints for internal-detail disclosure.
0476. **Metrics-endpoint oracle** — tests metrics endpoints for unauthenticated access and sensitive-label disclosure.
0477. **Pprof-exposure oracle** — tests Go pprof endpoints for profiling-data exposure.
0478. **Actuator-exposure oracle** — tests Spring Actuator endpoints for sensitive-endpoint exposure.
0479. **Status-page oracle** — analyzes status pages for infrastructure-detail disclosure.
0480. **Error-stack oracle** — triggers errors systematically to detect stack-trace disclosure with graded verbosity scoring.
0481. **Version-disclosure oracle** — fingerprints server/framework versions from headers and error pages to detect version disclosure.
0482. **Internal-IP disclosure oracle** — analyzes responses for internal IP/hostname leakage via pattern analysis.
0483. **Path-disclosure oracle** — triggers errors to detect filesystem-path disclosure in messages.
0484. **SQL-error oracle** — analyzes database-error messages for query-structure disclosure with graded scoring.
0485. **LDAP-error oracle** — analyzes directory-error messages for schema disclosure.
0486. **XML-error oracle** — analyzes parser-error messages for file-content disclosure.
0487. **Template-error oracle** — analyzes template-error messages for code-structure disclosure.
0488. **Deserialization-error oracle** — analyzes deserialization errors for class-path disclosure.
0489. **CORS-wildcard oracle** — tests wildcard origins with credentials to detect CORS misconfigurations with proof-of-concept harness.
0490. **CORS-null-origin oracle** — tests null-origin acceptance to detect null-origin trust vulnerabilities.
0491. **CORS-regex oracle** — tests origin-validation regexes with crafted origins to detect regex-bypass flaws.
0492. **CORS-subdomain oracle** — tests subdomain-origin trust to detect overly broad subdomain matching.
0493. **CORS-preflight oracle** — analyzes preflight handling for method/header over-permission.
0494. **PostMessage-origin oracle** — analyzes postMessage handlers for origin-validation gaps via dynamic analysis.
0495. **WebSocket-origin oracle** — tests WebSocket Origin validation to detect cross-site hijacking.
0496. **JSONP-callback oracle** — tests JSONP endpoints for callback-validation flaws enabling XSS.
0497. **Cross-origin-embed oracle** — analyzes COEP/COOP headers to detect cross-origin isolation gaps.
0498. **CORP-analysis oracle** — verifies Cross-Origin-Resource-Policy coverage on sensitive resources.
0499. **Fetch-metadata oracle** — analyzes Sec-Fetch-* handling to detect resource-isolation enforcement gaps.
0500. **Referrer-policy regression oracle** — diffs Referrer-Policy headers to detect referrer-leakage regressions.
0501. **Price-tampering invariant checker** — replays checkout flows with mutated prices and verifies the charged amount via order/invoice state, detecting price-tampering with ledger proof.
0502. **Quantity-boundary invariant checker** — submits negative, zero, and extreme quantities and verifies ledger effects, detecting quantity-logic flaws with state proof.
0503. **Currency-confusion checker** — swaps currency codes mid-checkout and verifies charged currency, detecting currency-confusion vulnerabilities.
0504. **Discount-stacking checker** — applies multiple coupons and verifies stacking rules, detecting stacking bypass with total proof.
0505. **Coupon-scope checker** — applies coupons to out-of-scope items and verifies discount application, detecting scope-enforcement gaps.
0506. **Gift-card balance checker** — manipulates gift-card balances and verifies ledger consistency, detecting balance-tampering.
0507. **Loyalty-points invariant checker** — earns and redeems points with boundary values and verifies point-ledger integrity, detecting points-manipulation.
0508. **Refund-amount checker** — requests refunds exceeding purchase amounts and verifies ledger entries, detecting refund-logic flaws.
0509. **Partial-refund checker** — issues multiple partial refunds and verifies the sum never exceeds the original charge, detecting refund-race flaws.
0510. **Chargeback-state checker** — analyzes dispute flows for state inconsistencies that enable double-recovery.
0511. **Trial-abuse checker** — creates multiple trials with identity variations and verifies trial-entitlement enforcement, detecting trial-abuse vectors.
0512. **Subscription-downgrade checker** — downgrades mid-cycle and verifies proration logic, detecting billing-logic flaws.
0513. **Seat-count invariant checker** — manipulates team seat counts and verifies billing alignment, detecting seat-tampering.
0514. **Usage-metering checker** — generates usage and verifies metering accuracy, detecting metering-bypass vectors.
0515. **Overage-billing checker** — exceeds quotas and verifies overage charges, detecting overage-evasion flaws.
0516. **Invoice-tampering checker** — manipulates invoice parameters and verifies invoice integrity, detecting invoice-manipulation.
0517. **Tax-calculation checker** — varies jurisdictions and verifies tax computation, detecting tax-evasion vectors.
0518. **Shipping-cost checker** — manipulates shipping parameters and verifies cost enforcement, detecting shipping-tampering.
0519. **Workflow-step skip detector** — attempts to skip checkout/onboarding steps via direct navigation and verifies server-side enforcement, detecting step-bypass with state proof.
0520. **State-machine transition fuzzer** — maps order/ticket state machines and attempts illegal transitions, detecting transition-enforcement gaps.
0521. **Approval-workflow bypass checker** — attempts to approve own requests and verifies segregation enforcement, detecting SoD violations.
0522. **Multi-approver checker** — tests whether multi-approval requirements can be satisfied by one actor, detecting approval-bypass.
0523. **Escalation-path checker** — tests ticket-escalation authorization to detect privilege-escalation via escalation.
0524. **SLA-manipulation checker** — manipulates SLA timestamps and verifies enforcement, detecting SLA-gaming vectors.
0525. **Queue-jump checker** — tests queue-position parameters for manipulation enabling priority bypass.
0526. **Auction-bid invariant checker** — places boundary bids and verifies bid-ledger integrity, detecting bid-manipulation.
0527. **Bid-sniping window checker** — tests auction-close timing enforcement to detect close-time manipulation.
0528. **Reserve-price checker** — tests reserve-price enforcement to detect reserve-bypass vectors.
0529. **Proxy-bidding checker** — tests proxy-bid logic for manipulation enabling bid-shielding.
0530. **Voting-integrity checker** — casts duplicate votes with identity variations and verifies deduplication, detecting vote-manipulation with count proof.
0531. **Poll-option injection checker** — injects poll options and verifies option-creation authorization, detecting poll-poisoning.
0532. **Rating-manipulation checker** — submits boundary ratings and verifies aggregation integrity, detecting rating-manipulation.
0533. **Review-authenticity checker** — tests review-eligibility enforcement (purchase verification), detecting fake-review vectors.
0534. **Referral-fraud checker** — generates referrals with identity variations and verifies reward integrity, detecting referral-fraud.
0535. **Signup-bonus checker** — claims bonuses repeatedly and verifies one-per-identity enforcement, detecting bonus-abuse.
0536. **Airdrop-eligibility checker** — tests airdrop-claim authorization to detect claim-replay vectors.
0537. **Staking-reward checker** — manipulates staking parameters and verifies reward computation, detecting reward-manipulation.
0538. **Vesting-schedule checker** — tests vesting-timeline enforcement to detect early-unlock vectors.
0539. **Governance-vote checker** — tests vote-weight computation for manipulation enabling governance attacks.
0540. **Treasury-spend checker** — tests treasury-proposal authorization to detect fund-diversion vectors.
0541. **KYC-bypass checker** — attempts verification with synthetic identities and verifies enforcement, detecting KYC-bypass (with consent-scoped testing only).
0542. **Age-gate checker** — tests age-verification enforcement via boundary dates, detecting age-gate bypass.
0543. **Geo-restriction checker** — tests geo-fencing via egress variations to detect restriction bypass.
0544. **Sanctions-screening checker** — tests screening enforcement in payment flows to detect screening gaps.
0545. **Fraud-rule checker** — probes fraud-rule thresholds with bounded tests to detect rule-evasion vectors.
0546. **Velocity-limit checker** — measures transaction-velocity enforcement to detect velocity-bypass.
0547. **Amount-limit checker** — tests per-transaction limits with boundary values to detect limit-bypass.
0548. **Daily-limit checker** — tests daily-limit aggregation to detect limit-reset manipulation.
0549. **Beneficiary-validation checker** — tests payee-validation to detect validation gaps enabling misdirected payments.
0550. **IBAN-validation checker** — tests IBAN checksum enforcement to detect account-number confusion.
0551. **SWIFT-code checker** — tests BIC validation to detect routing-manipulation vectors.
0552. **Settlement-account checker** — tests settlement-account binding to detect account-swapping.
0553. **Payout-approval checker** — tests payout-approval workflows for bypass enabling unauthorized disbursement.
0554. **Escrow-release checker** — tests escrow-release conditions to detect premature-release vectors.
0555. **Milestone-payment checker** — tests milestone-verification enforcement to detect payment-without-delivery.
0556. **Invoice-approval checker** — tests invoice-approval chains for bypass enabling fraudulent invoices.
0557. **Expense-limit checker** — tests expense-policy enforcement to detect policy-bypass.
0558. **Procurement-bypass checker** — tests procurement-approval thresholds to detect split-purchase evasion.
0559. **Contract-approval checker** — tests contract-signature workflows for bypass vectors.
0560. **Document-version checker** — tests version-control enforcement to detect version-confusion in contracts.
0561. **E-signature binding checker** — tests signature-to-document binding to detect signature-transplantation.
0562. **Notarization checker** — tests notarization-workflow enforcement to detect notarization-bypass.
0563. **Witness-requirement checker** — tests witness-requirement enforcement in signing flows.
0564. **Consent-record checker** — verifies consent records are immutable and bound to the consenting identity.
0565. **GDPR-erasure checker** — requests erasure and verifies data removal across read surfaces, detecting incomplete erasure.
0566. **Data-portability checker** — tests export completeness to detect portability gaps.
0567. **Retention-policy checker** — verifies retention enforcement by probing aged data accessibility.
0568. **Anonymization checker** — tests whether anonymized datasets resist re-identification via linkage analysis.
0569. **Pseudonymization checker** — verifies pseudonym-mapping isolation to detect re-identification vectors.
0570. **Consent-scope checker** — tests whether processing stays within granted consent scopes.
0571. **Purpose-limitation checker** — verifies data collected for one purpose is not used for another via flow analysis.
0572. **Data-minimization checker** — analyzes collected fields against stated purposes to detect over-collection.
0573. **Third-party sharing checker** — monitors outbound data flows to detect undisclosed sharing via canary data.
0574. **Cookie-consent checker** — verifies tracking technologies respect consent choices via before/after analysis.
0575. **Do-not-track checker** — tests DNT/GPC signal handling to detect signal-ignoring.
0576. **Opt-out checker** — verifies opt-out requests propagate to all processing systems.
0577. **Access-request checker** — tests subject-access-request completeness to detect access gaps.
0578. **Rectification checker** — verifies correction requests propagate to all data stores.
0579. **Restriction checker** — tests processing-restriction enforcement during disputes.
0580. **Objection checker** — verifies objection-to-processing requests are honored.
0581. **Automated-decision checker** — tests for human-review rights in automated-decision flows.
0582. **Profiling-optout checker** — verifies profiling opt-outs are enforced in personalization.
0583. **Cross-border transfer checker** — analyzes data-transfer mechanisms to detect unlawful transfers.
0584. **SCC-compliance checker** — verifies standard-contractual-clause coverage for transfers.
0585. **DPIA-trigger checker** — tests whether high-risk processing triggers impact assessments.
0586. **Breach-notification checker** — analyzes breach-response workflows for notification-timing compliance.
0587. **DPO-contact checker** — verifies data-protection-officer contact accessibility.
0588. **Records-of-processing checker** — tests RoPA completeness via processing-activity analysis.
0589. **Privacy-by-design checker** — evaluates default settings for privacy-preserving defaults.
0590. **Dark-pattern checker** — analyzes consent UX for manipulative patterns via interaction analysis.
0591. **Subscription-trap checker** — tests cancellation-flow parity with signup ease to detect roach-motel patterns.
0592. **Drip-pricing checker** — analyzes price disclosure completeness through checkout flows.
0593. **Fake-urgency checker** — verifies scarcity claims against actual inventory via state analysis.
0594. **Confirm-shaming checker** — analyzes opt-out language for manipulative framing.
0595. **Forced-continuity checker** — tests trial-to-paid conversion disclosures for compliance.
0596. **Hidden-fee checker** — compares advertised vs final prices to detect fee concealment.
0597. **Bait-and-switch checker** — verifies advertised offers remain available through checkout.
0598. **Drip-consent checker** — analyzes progressive permission requests for scope creep.
0599. **Nagging-pattern checker** — measures consent-prompt frequency to detect coercive nagging.
0600. **Preselection checker** — verifies optional consents are not preselected by default.
0601. **Parallel-request interleaving analyzer** — fires N concurrent requests with barrier synchronization and analyzes response interleavings to detect TOCTOU races with statistical repeatability scoring.
0602. **Single-flight race confirmer** — repeats a suspected race 30 times with synchronized starts and requires a success-rate above baseline noise before confirming, eliminating flaky single-shot claims.
0603. **Coupon-double-redeem racer** — races single-use coupon redemptions with precise timing and verifies ledger state for duplicates, detecting redemption races with proof.
0604. **Balance-transfer racer** — races concurrent transfers and verifies balance conservation, detecting lost-update races with ledger proof.
0605. **Vote-double-count racer** — races vote submissions and verifies count integrity, detecting counting races.
0606. **Seat-reservation racer** — races seat holds and verifies no double-booking via state inspection.
0607. **Username-claim racer** — races username registrations and verifies uniqueness enforcement, detecting claim races.
0608. **Invite-code racer** — races single-use invite redemptions to detect reuse races.
0609. **Password-reset racer** — races reset-token use to detect token-reuse races.
0610. **Email-change racer** — races email-change confirmations to detect verification races.
0611. **2FA-disable racer** — races disable requests to detect state-confusion races.
0612. **API-key rotation racer** — races key rotations to detect rotation-window races.
0613. **Webhook-secret racer** — races secret rotations to detect delivery races.
0614. **Subscription-cancel racer** — races cancel/reactivate to detect state-machine races.
0615. **Refund-issue racer** — races refund requests to detect double-refund races with ledger proof.
0616. **Payout racer** — races payout requests to detect double-disbursement races.
0617. **File-upload overwrite racer** — races uploads to the same path to detect overwrite races.
0618. **Avatar-update racer** — races profile updates to detect last-write-wins data loss.
0619. **Cart-checkout racer** — races checkout submissions to detect double-charge races.
0620. **Inventory-decrement racer** — races purchases and verifies stock conservation, detecting oversell races.
0621. **Rate-limit window racer** — races requests across window boundaries to detect window-reset races.
0622. **Token-bucket racer** — races token consumption to detect bucket-accounting races.
0623. **Lockout-counter racer** — races login attempts to detect counter races enabling lockout bypass.
0624. **Attempt-counter racer** — races OTP attempts to detect attempt-counting races.
0625. **Nonce-consumption racer** — races nonce use to detect replay-enabling races.
0626. **Idempotency racer** — races idempotent requests to detect duplicate-execution races.
0627. **Cache-stampede racer** — races cache-miss requests to detect stampede amplification safely.
0628. **Leader-election racer** — tests distributed lock acquisition races to detect split-brain vectors.
0629. **Distributed-lock racer** — races lock holders to detect lock-expiry races.
0630. **Lease-renewal racer** — races lease renewals to detect renewal races.
0631. **Optimistic-concurrency racer** — races versioned writes to detect version-check races.
0632. **Pessimistic-lock racer** — races lock acquisition to detect deadlock or bypass vectors.
0633. **Saga-compensation racer** — races saga steps to detect compensation races.
0634. **Outbox-pattern racer** — races outbox publishers to detect duplicate-event races.
0635. **Event-sourcing racer** — races event appends to detect sequence-number races.
0636. **CQRS-sync racer** — races command/query sides to detect read-model staleness races.
0637. **Materialized-view racer** — races view refreshes to detect refresh races.
0638. **Search-index racer** — races index updates to detect index-consistency races.
0639. **Replication racer** — races primary/replica reads to detect replication-lag exploitation.
0640. **Failover racer** — races requests during failover to detect failover-window races.
0641. **DNS-TTL racer** — races DNS changes to detect TTL-propagation races.
0642. **CDN-purge racer** — races purge/invalidate to detect purge races.
0643. **Config-reload racer** — races config updates to detect reload races.
0644. **Feature-flag racer** — races flag evaluations to detect flag-propagation races.
0645. **AB-test racer** — races experiment assignments to detect assignment races.
0646. **Session-migration racer** — races session transfers to detect migration races.
0647. **Token-refresh racer** — races refresh requests to detect refresh races.
0648. **Device-registration racer** — races device enrollments to detect enrollment races.
0649. **Push-token racer** — races push-token updates to detect token-confusion races.
0650. **Notification-dispatch racer** — races notification sends to detect duplicate-delivery races.
0651. **Email-send racer** — races email triggers to detect duplicate-email races.
0652. **SMS-send racer** — races SMS triggers to detect duplicate-SMS races.
0653. **Webhook-dispatch racer** — races webhook deliveries to detect duplicate-delivery races.
0654. **Retry-storm racer** — races retries to detect retry-amplification races safely.
0655. **Circuit-breaker racer** — races breaker state transitions to detect half-open races.
0656. **Bulkhead racer** — races bulkhead partitions to detect partition-exhaustion races.
0657. **Backpressure racer** — races producers/consumers to detect backpressure races.
0658. **Dead-letter racer** — races dead-letter processing to detect poison-message races.
0659. **Poison-pill racer** — tests poison-message handling to detect queue-stall vectors safely.
0660. **Ordering-guarantee racer** — races ordered-message producers to detect ordering-violation races.
0661. **Exactly-once racer** — races exactly-once processors to detect duplicate-processing races.
0662. **Deduplication racer** — races deduplication checks to detect dedup races.
0663. **Watermark racer** — races stream watermarks to detect late-data races.
0664. **Checkpoint racer** — races checkpoint commits to detect checkpoint races.
0665. **Snapshot racer** — races snapshot restores to detect restore races.
0666. **Migration racer** — races schema migrations to detect migration races.
0667. **Rollback racer** — races rollback operations to detect rollback races.
0668. **Blue-green racer** — races traffic during deployments to detect cutover races.
0669. **Canary-deploy racer** — races canary analysis to detect promotion races.
0670. **Feature-toggle racer** — races toggle evaluations during rollout to detect rollout races.
0671. **Kill-switch racer** — races kill-switch activation to detect activation races.
0672. **Maintenance-mode racer** — races maintenance toggles to detect mode races.
0673. **Read-only-mode racer** — races mode transitions to detect transition races.
0674. **Graceful-shutdown racer** — races in-flight requests during shutdown to detect drain races.
0675. **Connection-drain racer** — races drain operations to detect drain races.
0676. **Health-check racer** — races health transitions to detect flapping races.
0677. **Autoscale racer** — races scale decisions to detect oscillation races safely.
0678. **Bin-packing racer** — races scheduler placements to detect placement races.
0679. **Preemption racer** — races preemption decisions to detect preemption races.
0680. **Eviction racer** — races eviction decisions to detect eviction races.
0681. **Affinity racer** — races affinity assignments to detect affinity races.
0682. **Topology racer** — races topology updates to detect routing races.
0683. **Endpoint-slice racer** — races endpoint updates to detect slice races.
0684. **Service-discovery racer** — races discovery registrations to detect discovery races.
0685. **Load-balancer racer** — races backend selections to detect stickiness races.
0686. **Sticky-session racer** — races session affinity to detect affinity-break races.
0687. **Consistent-hash racer** — races ring changes to detect rebalance races.
0688. **Gossip-protocol racer** — races gossip dissemination to detect convergence races.
0689. **Raft-election racer** — races leader elections to detect election races safely.
0690. **Paxos-proposal racer** — races proposals to detect consensus races safely.
0691. **Two-phase-commit racer** — races commit/abort to detect coordinator races.
0692. **Saga-orchestration racer** — races orchestrator steps to detect orchestration races.
0693. **Choreography racer** — races choreographed events to detect choreography races.
0694. **Idempotent-consumer racer** — races consumer offsets to detect offset races.
0695. **Transactional-outbox racer** — races outbox relays to detect relay races.
0696. **Change-data-capture racer** — races CDC events to detect capture races.
0697. **Eventual-consistency measurer** — quantifies convergence time under races to detect SLA violations.
0698. **Causal-consistency checker** — verifies causal ordering under races to detect ordering violations.
0699. **Session-consistency checker** — verifies read-your-write under races to detect session violations.
0700. **Bounded-staleness checker** — measures staleness bounds under races to detect bound violations.
0701. **Gadget-chain canary without execution** — builds deserialization payloads whose terminal gadget only performs a DNS lookup to a tokenized canary domain, proving deserialization without executing attacker code.
0702. **Commons-collections canary oracle** — uses transformer chains ending in a canary URL-fetching transformer to detect Java deserialization via callback attribution.
0703. **Spring-core canary oracle** — crafts payloads abusing Spring gadgets that terminate in canary callbacks, detecting deserialization in Spring apps safely.
0704. **Groovy canary oracle** — uses Groovy method-closure gadgets ending in canary invocations to detect deserialization via attribution.
0705. **Clojure canary oracle** — tests Clojure data-reader gadgets with canary evals that only phone home, detecting unsafe read safely.
0706. **Scala canary oracle** — uses Scala gadget chains terminating in canary callbacks to detect deserialization in Scala services.
0707. **Kotlin canary oracle** — tests Kotlin serialization gadgets with canary readResolve hooks, detecting unsafe deserialization safely.
0708. **Jackson-polymorphism oracle** — submits Jackson payloads with canary type IDs and monitors class-loading callbacks, detecting polymorphic deserialization.
0709. **Gson-unsafe oracle** — tests Gson deserialization with canary object graphs that phone home via toString, detecting unsafe patterns.
0710. **Fastjson canary oracle** — uses Fastjson autoType payloads with canary JdbcRowSet-like callbacks that only perform DNS lookups, detecting Fastjson RCE intent safely.
0711. **XStream canary oracle** — crafts XStream payloads with canary converters that emit callbacks, detecting XStream deserialization.
0712. **SnakeYAML canary oracle** — submits YAML with canary ScriptEngine-like tags limited to DNS callbacks, detecting unsafe YAML loading.
0713. **PyYAML canary oracle** — uses python/object tags resolving only to canary functions that phone home, detecting unsafe load safely.
0714. **Ruby-MARSHAL canary oracle** — crafts Marshal payloads with canary instance variables that trigger callbacks, detecting unsafe unmarshal.
0715. **PHP-unserialize canary oracle** — uses __wakeup/__destruct chains ending in canary file operations on sentinel paths, detecting unserialize via callback.
0716. **PHP-phar stub oracle** — triggers phar metadata parsing with canary stubs that phone home, detecting phar deserialization safely.
0717. **igbinary canary oracle** — tests igbinary unserialization with canary objects that emit callbacks, detecting unsafe usage.
0718. **Node-serialize canary oracle** — uses IIFE payloads limited to canary require() of a logging module, detecting node-serialize RCE intent without shell.
0719. **Funcster canary oracle** — tests function-serialization libraries with canary function bodies that only log, detecting unsafe eval.
0720. **JNDI-canary oracle** — submits JNDI URLs pointing at a canary LDAP listener with unique DNs, detecting Log4Shell-style injection via callback attribution.
0721. **LDAP-deserialization canary** — tests LDAP attribute deserialization with canary object classes that phone home, detecting unsafe LDAP handling.
0722. **RMI-registry canary** — probes RMI registries with canary bind names to detect registry manipulation vectors.
0723. **JRMP-canary oracle** — sends JRMP payloads with canary callbacks to detect JRMP deserialization safely.
0724. **JMX-canary oracle** — tests JMX endpoints with canary MBeans that only log, detecting JMX deserialization.
0725. **Jolokia-canary oracle** — probes Jolokia with canary MBean operations that phone home, detecting unsafe JMX-HTTP bridging.
0726. **Hessian-service canary** — tests Hessian endpoints with canary service methods that emit callbacks, detecting unsafe Hessian.
0727. **Burlap-canary oracle** — submits Burlap XML with canary types that phone home, detecting Burlap deserialization.
0728. **AMF-endpoint canary** — tests AMF gateways with canary Externalizable classes, detecting BlazeDS deserialization safely.
0729. **WDDX-canary oracle** — submits WDDX packets with canary recordsets that emit callbacks, detecting WDDX deserialization.
0730. **XML-RPC canary oracle** — tests XML-RPC with canary method calls that phone home, detecting unsafe XML-RPC.
0731. **SOAP-deserialization canary** — submits SOAP with canary types that emit callbacks, detecting SOAP deserialization flaws.
0732. **.NET BinaryFormatter canary** — crafts payloads with canary gadget chains ending in DNS callbacks, detecting BinaryFormatter RCE intent safely.
0733. **LosFormatter canary oracle** — tests LosFormatter with canary objects that phone home, detecting unsafe usage.
0734. **ObjectStateFormatter canary** — probes ViewState-adjacent formatters with canary graphs, detecting deserialization.
0735. **DataContract canary oracle** — tests DataContractSerializer with canary known-types that emit callbacks.
0736. **NetDataContract canary** — probes NetDataContractSerializer with canary types for callback attribution.
0737. **SoapFormatter canary** — tests SoapFormatter with canary objects that phone home.
0738. **YAMLDotNet canary** — submits YAML with canary tags limited to callbacks, detecting unsafe YAMLDotNet.
0739. **MessagePack-C# canary** — tests MessagePack resolvers with canary types that emit callbacks.
0740. **Protobuf-net canary** — probes protobuf-net with canary surrogates that phone home.
0741. **ZeroFormatter canary** — tests ZeroFormatter with canary types for callback attribution.
0742. **Go-gob canary oracle** — submits gob payloads with canary types that only log, detecting unsafe gob decode.
0743. **Go-encoding canary** — tests encoding/json with canary UnmarshalJSON hooks that phone home.
0744. **Rust-serde canary** — probes serde with canary Deserialize impls that emit callbacks.
0745. **Swift-Codable canary** — tests Codable with canary types that phone home.
0746. **Dart-json canary** — probes Dart JSON with canary fromJson hooks that emit callbacks.
0747. **Elixir-term canary** — tests :erlang.binary_to_term with canary atoms that only log, detecting unsafe term decode.
0748. **Haskell-read canary** — probes Read instances with canary values that phone home.
0749. **OCaml-Marshal canary** — tests Marshal.from_string with canary values that emit callbacks.
0750. **Lua-load canary** — tests load() with canary chunks that only log, detecting unsafe code loading.
0751. **Tcl-eval canary** — probes Tcl eval with canary scripts that phone home.
0752. **Perl-Storable canary** — tests Storable thaw with canary objects that emit callbacks.
0753. **R-serialize canary** — probes R unserialize with canary objects that phone home.
0754. **Julia-serialize canary** — tests Julia deserialize with canary types that emit callbacks.
0755. **MATLAB-mat canary** — probes .mat loading with canary variables that phone home.
0756. **Pickle-protocol canary** — tests each pickle protocol version with canary opcodes for callback attribution.
0757. **Dill-canary oracle** — probes dill loads with canary objects that emit callbacks.
0758. **Cloudpickle canary** — tests cloudpickle with canary functions that only log.
0759. **Shelve-canary oracle** — probes shelve with canary keys that phone home.
0760. **Marshal-python canary** — tests marshal.loads with canary code objects that only log.
0761. **ConfigParser canary** — probes ConfigParser interpolation with canary values that phone home.
0762. **Plist-canary oracle** — tests plist parsing with canary objects that emit callbacks.
0763. **Bplist-canary oracle** — probes binary plists with canary objects for callback attribution.
0764. **JSON5-canary oracle** — tests JSON5 parsers with canary extensions that phone home.
0765. **HJSON-canary oracle** — probes HJSON with canary constructs that emit callbacks.
0766. **TOML-canary oracle** — tests TOML parsers with canary dates/arrays that phone home.
0767. **INI-canary oracle** — probes INI parsers with canary sections that emit callbacks.
0768. **CSV-formula canary** — tests CSV parsers with canary formulas that only log, detecting formula evaluation.
0769. **TSV-canary oracle** — probes TSV with canary fields for callback attribution.
0770. **PSV-canary oracle** — tests pipe-separated parsing with canary fields that phone home.
0771. **Fixed-width canary** — probes fixed-width parsers with canary records that emit callbacks.
0772. **EDI-canary oracle** — tests EDI parsing with canary segments that phone home.
0773. **HL7-canary oracle** — probes HL7 with canary segments that emit callbacks, detecting healthcare-parser flaws safely.
0774. **FHIR-canary oracle** — tests FHIR JSON with canary resources that phone home.
0775. **DICOM-canary oracle** — probes DICOM metadata with canary tags that emit callbacks.
0776. **SWF-canary oracle** — tests SWF parsing with canary tags that phone home.
0777. **RTF-canary oracle** — probes RTF with canary control words that emit callbacks.
0778. **OLE-canary oracle** — tests OLE containers with canary streams that phone home.
0779. **OOXML-canary oracle** — probes OOXML with canary relationships that emit callbacks.
0780. **ODF-canary oracle** — tests ODF with canary elements that phone home.
0781. **iCalendar-canary oracle** — probes iCal with canary properties that emit callbacks.
0782. **vCard-canary oracle** — tests vCard with canary fields that phone home.
0783. **MIME-canary oracle** — probes MIME parsing with canary parts that emit callbacks.
0784. **Multipart-canary oracle** — tests multipart with canary boundaries that phone home.
0785. **Chunked-canary oracle** — probes chunked encoding with canary chunks that emit callbacks.
0786. **Gzip-canary oracle** — tests gzip handling with canary members that phone home.
0787. **Brotli-canary oracle** — probes Brotli with canary streams that emit callbacks.
0788. **Zstd-canary oracle** — tests Zstd with canary frames that phone home.
0789. **LZ4-canary oracle** — probes LZ4 with canary blocks that emit callbacks.
0790. **Snappy-canary oracle** — tests Snappy with canary chunks that phone home.
0791. **Tar-canary oracle** — probes tar with canary headers that emit callbacks.
0792. **Cpio-canary oracle** — tests cpio with canary entries that phone home.
0793. **7z-canary oracle** — probes 7z with canary headers that emit callbacks.
0794. **Rar-canary oracle** — tests RAR with canary blocks that phone home.
0795. **Cab-canary oracle** — probes CAB with canary folders that emit callbacks.
0796. **MSI-canary oracle** — tests MSI with canary tables that phone home.
0797. **DMG-canary oracle** — probes DMG with canary partitions that emit callbacks.
0798. **ISO-canary oracle** — tests ISO with canary descriptors that phone home.
0799. **WIM-canary oracle** — probes WIM with canary images that emit callbacks.
0800. **VHD-canary oracle** — tests VHD with canary footers that phone home.
0801. **GraphQL introspection-leak detector** — probes __schema/__type with auth variations and analyzes exposed types, mutations, and directives to quantify schema over-exposure.
0802. **GraphQL field-suggestion oracle** — triggers did-you-mean suggestions and analyzes leaked field names to detect information disclosure via error hints.
0803. **GraphQL directive-abuse oracle** — tests @include/@skip with variables to detect authorization bypass via directive-driven field selection.
0804. **GraphQL alias-amplification detector** — measures cost growth vs alias count with bounded aliases to detect alias-based DoS via scaling analysis.
0805. **GraphQL batch-attack detector** — measures batch latency vs operation count to detect batching-amplification DoS safely.
0806. **GraphQL depth-limit oracle** — probes nesting depth to verify depth-limit enforcement via depth-scaling tests.
0807. **GraphQL complexity-scoring oracle** — reverse-engineers complexity scoring by submitting calibrated queries to detect scoring bypass.
0808. **GraphQL persisted-query oracle** — tests persisted-query allowlists for hash-collision or bypass vectors.
0809. **GraphQL subscription-auth oracle** — tests subscription resolvers for authorization enforcement independent of query auth.
0810. **GraphQL mutation-idempotency oracle** — replays mutations to detect missing idempotency with state proof.
0811. **GraphQL union-leak oracle** — analyzes union/interface resolution to detect type-confusion data leaks.
0812. **GraphQL error-path oracle** — grades error verbosity across malformed queries to detect resolver/database disclosure.
0813. **GraphQL timing oracle** — applies paired timing analysis to field resolvers to detect blind injection in resolvers.
0814. **GraphQL federation oracle** — tests _entities/_service for cross-subgraph authorization gaps.
0815. **GraphQL schema-stitching oracle** — analyzes stitched schemas for authorization inconsistencies across services.
0816. **WebSocket message-schema fuzzer** — learns the message schema from benign traffic, then mutates fields and scores anomalies to detect injection and logic flaws.
0817. **WebSocket frame-type oracle** — tests binary/text/continuation/ping frame handling for parser-confusion vectors.
0818. **WebSocket compression oracle** — tests permessage-deflate with canary payloads to detect compression side channels.
0819. **WebSocket auth-timing oracle** — measures handshake auth timing to detect token-validation gaps.
0820. **WebSocket subprotocol oracle** — tests subprotocol negotiation for confusion enabling protocol smuggling.
0821. **WebSocket close-handshake oracle** — analyzes close-code handling for state-disclosure vectors.
0822. **WebSocket backpressure oracle** — measures backpressure behavior under bounded bursts to detect DoS safely.
0823. **WebSocket broadcast-leak oracle** — joins rooms/channels and verifies message isolation, detecting broadcast leaks.
0824. **WebSocket presence-leak oracle** — tests presence channels for user-enumeration via presence differentials.
0825. **WebSocket replay oracle** — replays captured frames to detect missing replay protection.
0826. **WebSocket CSRF oracle** — tests Origin validation on handshakes to detect cross-site hijacking.
0827. **WebSocket rate-limit oracle** — measures message rate-limiting to detect unthrottled messaging.
0828. **SSE event-schema fuzzer** — learns SSE event schemas and mutates them to detect injection in streaming endpoints.
0829. **SSE reconnection oracle** — tests Last-Event-ID handling for IDOR in stream resumption.
0830. **SSE auth-expiry oracle** — tests whether streams survive token expiry to detect auth-lapse vectors.
0831. **gRPC reflection oracle** — probes grpc.reflection for exposed service descriptors and analyzes method sensitivity.
0832. **gRPC method-enumeration oracle** — tests unlisted methods via reflection data to detect hidden-method exposure.
0833. **gRPC metadata-injection oracle** — injects canary metadata and verifies downstream handling, detecting metadata trust flaws.
0834. **gRPC status-leak oracle** — grades status-detail verbosity to detect internal-error disclosure.
0835. **gRPC stream-auth oracle** — tests per-message auth in streaming RPCs to detect auth-lapse vectors.
0836. **gRPC deadline oracle** — tests deadline enforcement to detect deadline-bypass DoS.
0837. **gRPC max-message oracle** — probes message-size limits to detect oversized-message DoS safely.
0838. **REST schema-drift detector** — diffs live OpenAPI responses against the published spec to detect shadow endpoints and undocumented parameters.
0839. **OpenAPI-spec oracle** — fetches exposed specs and analyzes them for sensitive endpoints, deprecated auth, and over-permissive schemas.
0840. **API-versioning oracle** — tests old API versions for unpatched vulnerabilities via version-differential testing.
0841. **Deprecated-endpoint oracle** — probes deprecated endpoints for continued functionality and weaker controls.
0842. **Shadow-endpoint detector** — compares routed paths against the spec to detect undocumented endpoints via 404-vs-405 differentials.
0843. **Mass-assignment oracle** — submits extra fields in write requests and verifies persistence, detecting mass-assignment with state proof.
0844. **Read-only-field oracle** — attempts to modify read-only fields (ids, timestamps, roles) and verifies enforcement.
0845. **Hidden-parameter miner** — discovers undocumented parameters via response-behavior differentials and tests them for authorization gaps.
0846. **HTTP-verb tampering oracle** — tests verb-based access control with method overrides to detect verb-confusion bypass.
0847. **Content-type negotiation oracle** — tests format parameters (.json, Accept) for differential authorization, detecting format-based bypass.
0848. **API-key scope oracle** — tests key scopes against endpoint requirements to detect scope-enforcement gaps.
0849. **OAuth-scope oracle** — verifies granted scopes match requested scopes to detect scope-escalation.
0850. **Rate-limit header oracle** — analyzes rate-limit headers for limit disclosure and tests enforcement boundaries.
0851. **Pagination-abuse oracle** — tests deep pagination for performance DoS and data-exfiltration via cursor analysis.
0852. **Cursor-tampering oracle** — mutates cursors to detect IDOR in paginated APIs.
0853. **Sort-injection oracle** — injects sort fields to detect NoSQL/SQL injection via behavioral differentials.
0854. **Filter-injection oracle** — tests filter syntax for injection via result-set differentials.
0855. **Search-operator oracle** — tests search operators for injection and information disclosure.
0856. **Aggregation oracle** — tests aggregation pipelines for injection via timing/error differentials.
0857. **GraphQL-to-REST parity oracle** — compares GraphQL and REST authorization for the same data to detect parity gaps.
0858. **Webhook-verification oracle** — tests webhook signature verification with mutated payloads to detect verification bypass.
0859. **Webhook-replay oracle** — replays webhooks to detect missing replay protection with state proof.
0860. **Webhook-secret oracle** — tests secret rotation and binding to detect secret-confusion vectors.
0861. **Callback-URL oracle** — tests callback-URL validation to detect open-redirector and SSRF chains.
0862. **Redirect-chain follower** — follows open-redirect chains to final destinations to prove exploitability and map chain depth.
0863. **OAuth-redirect oracle** — tests OAuth redirect URIs for validation bypass enabling token theft.
0864. **SAML-redirect oracle** — tests SAML RelayState for open-redirect vectors.
0865. **Password-reset redirect oracle** — tests reset flows for redirect manipulation enabling token theft.
0866. **Logout-redirect oracle** — tests logout redirects for open-redirect vectors.
0867. **Login-redirect oracle** — tests post-login redirects for validation gaps.
0868. **Error-page redirect oracle** — tests error-page redirects for open-redirect vectors.
0869. **Subdomain-takeover prover** — places canary files via claimed takeovers (where authorized) or matches fingerprints to prove takeover with evidence.
0870. **Dangling-CNAME detector** — correlates CNAMEs against service fingerprints to detect dangling records with signature proof.
0871. **Dangling-A-record detector** — analyzes A records pointing at deprovisioned cloud IPs to detect IP-takeover risk.
0872. **Dangling-MX detector** — tests MX records for mail-service takeover vectors.
0873. **Dangling-TXT detector** — analyzes TXT records for stale verification tokens enabling re-claim.
0874. **NS-takeover oracle** — tests delegated nameservers for lame-delegation enabling zone takeover.
0875. **Cloud-storage takeover oracle** — tests cloud-bucket hostnames for unclaimed-bucket takeovers via fingerprinting.
0876. **CDN-takeover oracle** — tests CDN custom hostnames for unclaimed-service takeovers.
0877. **PaaS-takeover oracle** — fingerprints PaaS error pages on subdomains to detect unclaimed-app takeovers.
0878. **Issue-tracker takeover oracle** — tests helpdesk subdomains for unclaimed-instance takeovers.
0879. **Status-page takeover oracle** — tests status subdomains for unclaimed-page takeovers.
0880. **Docs-site takeover oracle** — tests docs subdomains for unclaimed-site takeovers.
0881. **Blog-takeover oracle** — tests blog subdomains for unclaimed-platform takeovers.
0882. **Shop-takeover oracle** — tests shop subdomains for unclaimed-store takeovers.
0883. **Forum-takeover oracle** — tests community subdomains for unclaimed-forum takeovers.
0884. **Wiki-takeover oracle** — tests wiki subdomains for unclaimed-wiki takeovers.
0885. **CI-takeover oracle** — tests CI subdomains for unclaimed-pipeline takeovers.
0886. **Monitoring-takeover oracle** — tests monitoring subdomains for unclaimed-dashboard takeovers.
0887. **Analytics-takeover oracle** — tests analytics subdomains for unclaimed-property takeovers.
0888. **Email-takeover oracle** — tests mail subdomains for unclaimed-mail-service takeovers.
0889. **VPN-takeover oracle** — tests VPN subdomains for unclaimed-gateway takeovers.
0890. **API-takeover oracle** — tests API subdomains for unclaimed-gateway takeovers.
0891. **Staging-takeover oracle** — tests staging subdomains for forgotten-environment exposure.
0892. **Dev-takeover oracle** — tests dev subdomains for unclaimed-environment takeovers.
0893. **QA-takeover oracle** — tests QA subdomains for exposure and takeover vectors.
0894. **UAT-takeover oracle** — tests UAT subdomains for unclaimed-environment takeovers.
0895. **Demo-takeover oracle** — tests demo subdomains for unclaimed-demo takeovers.
0896. **Sandbox-takeover oracle** — tests sandbox subdomains for unclaimed-sandbox takeovers.
0897. **Legacy-takeover oracle** — tests legacy subdomains for forgotten-service takeovers.
0898. **Wildcard-DNS oracle** — analyzes wildcard DNS for subdomain-enumeration and takeover implications.
0899. **Zone-transfer oracle** — tests AXFR to detect DNS zone-transfer exposure.
0900. **DNS-cache-poisoning oracle** — tests resolver behavior for Kaminsky-style poisoning susceptibility via bounded tests.
0901. **Per-endpoint ML anomaly classifier** — trains a lightweight model on benign response features per endpoint and scores probe responses for anomalies, detecting novel injection without signatures.
0902. **Response-embedding drift detector** — embeds benign responses and measures probe-response distance in embedding space to detect subtle attacker influence.
0903. **Sequence-model request fuzzer** — trains on benign request sequences and generates anomalous-but-valid sequences to detect state-machine flaws.
0904. **Autoencoder error-page detector** — trains autoencoders on benign error pages and flags probe errors with high reconstruction loss as information-disclosure candidates.
0905. **Clustering-based parameter miner** — clusters observed parameters to discover hidden/debug parameters via outlier analysis.
0906. **Bayesian timing classifier** — applies Bayesian inference to timing samples to compute posterior probability of time-based injection.
0907. **Hidden-Markov session analyzer** — models session state transitions and detects anomalous transitions indicating fixation or hijacking.
0908. **Isolation-forest rate-limit detector** — applies isolation forests to request-timing data to detect rate-limit bypass patterns.
0909. **NLP error-message classifier** — classifies error messages into disclosure levels using trained text models, grading verbosity automatically.
0910. **Vision-model UI-diff detector** — screenshots benign vs probe renders and uses vision models to detect visual anomalies indicating XSS or defacement.
0911. **Graph-neural API mapper** — builds API relationship graphs and uses GNNs to predict hidden endpoints and IDOR links.
0912. **Reinforcement-learning probe scheduler** — uses RL to prioritize probes by expected information gain, maximizing findings per request.
0913. **Active-learning oracle selector** — selects the most informative next probe using uncertainty sampling, reducing redundant testing.
0914. **Transfer-learning vuln predictor** — transfers patterns from historical hunts to predict vulnerable endpoints on new targets.
0915. **Few-shot finding classifier** — classifies findings into vuln types from few examples, standardizing detection output.
0916. **Header-security regression differ** — snapshots security headers per endpoint and diffs across releases to detect regressions automatically.
0917. **CSP-policy drift detector** — parses CSP headers over time and flags weakenings (new unsafe-inline, broadened sources) as regressions.
0918. **HSTS-coverage differ** — diffs HSTS deployment across subdomains to detect coverage regressions.
0919. **Cookie-flag differ** — diffs cookie attributes across releases to detect flag regressions.
0920. **CORS-policy differ** — diffs CORS configurations to detect permissiveness regressions.
0921. **TLS-config differ** — diffs TLS settings (versions, ciphers) to detect cryptographic regressions.
0922. **WAF-rule differ** — infers WAF rule changes via probe-behavior diffs to detect protection regressions.
0923. **Auth-flow differ** — diffs authentication flows across releases to detect enforcement regressions.
0924. **Permission-matrix differ** — diffs role matrices across releases to detect authorization regressions.
0925. **Error-verbosity differ** — diffs error verbosity across releases to detect disclosure regressions.
0926. **Dependency-drift detector** — fingerprints library versions to detect vulnerable-dependency regressions.
0927. **Config-drift detector** — diffs exposed configuration to detect misconfiguration regressions.
0928. **Feature-flag differ** — infers flag changes via behavior diffs to detect rollout regressions.
0929. **Schema-drift detector** — diffs API schemas across releases to detect breaking or risky changes.
0930. **Certificate-drift detector** — monitors certificate changes to detect issuance anomalies.
0931. **DNS-drift detector** — diffs DNS records to detect hijack or misconfiguration.
0932. **Subdomain-drift detector** — monitors subdomain inventory changes to detect shadow-IT.
0933. **Port-drift detector** — diffs open ports to detect service-exposure regressions.
0934. **Banner-drift detector** — diffs service banners to detect version regressions.
0935. **Response-header differ** — diffs full header sets to detect infrastructure changes.
0936. **HTML-structure differ** — diffs DOM structure across releases to detect injection-relevant changes.
0937. **JS-bundle differ** — diffs JavaScript bundles to detect new sinks and sources.
0938. **Source-map leak detector** — tests for exposed source maps and analyzes them for secret disclosure.
0939. **Debug-symbol detector** — analyzes binaries/endpoints for debug-symbol leakage.
0940. **Stack-trace differ** — diffs stack traces across releases to detect new disclosure paths.
0941. **Log-verbosity differ** — infers log-verbosity changes via error-message diffs.
0942. **Timing-baseline differ** — diffs timing baselines to detect performance regressions indicating new flaws.
0943. **Cache-behavior differ** — diffs caching behavior to detect cache-configuration regressions.
0944. **Redirect-behavior differ** — diffs redirect chains to detect open-redirect regressions.
0945. **Session-behavior differ** — diffs session handling to detect session-management regressions.
0946. **MFA-behavior differ** — diffs MFA flows to detect authentication regressions.
0947. **OAuth-behavior differ** — diffs OAuth flows to detect federation regressions.
0948. **Webhook-behavior differ** — diffs webhook handling to detect integration regressions.
0949. **Export-behavior differ** — diffs export functionality to detect data-exposure regressions.
0950. **Search-behavior differ** — diffs search behavior to detect injection-relevant changes.
0951. **Upload-behavior differ** — diffs upload handling to detect validation regressions.
0952. **Payment-behavior differ** — diffs payment flows to detect financial-logic regressions.
0953. **Notification-behavior differ** — diffs notification flows to detect leak regressions.
0954. **Privacy-setting differ** — diffs privacy controls to detect consent regressions.
0955. **Retention-behavior differ** — diffs data-retention behavior to detect compliance regressions.
0956. **Backup-behavior differ** — diffs backup handling to detect exposure regressions.
0957. **Multi-armed-bandit prober** — allocates probe budgets across vuln classes using bandit algorithms to maximize confirmed findings.
0958. **Causal-inference confirmer** — applies causal-inference methods to distinguish correlation from causation in probe-response relationships.
0959. **Counterfactual probe generator** — generates minimal counterfactual probes to isolate the exact input feature causing a vulnerability.
0960. **SHAP-based evidence ranker** — uses SHAP values to rank which evidence features most support each finding, improving report quality.
0961. **Confidence-calibration engine** — calibrates finding confidence scores against historical true/false-positive rates for honest reporting.
0962. **False-positive feedback learner** — learns from analyst-marked false positives to suppress similar future findings.
0963. **Finding-deduplication clusterer** — clusters findings by root cause to avoid duplicate reports of the same flaw.
0964. **Root-cause localizer** — traces findings to the responsible code path via differential analysis of similar endpoints.
0965. **Exploitability scorer** — scores findings by exploitability using reachability analysis, not just severity.
0966. **Business-impact modeler** — maps findings to business assets to prioritize by actual impact.
0967. **Attack-path graph builder** — builds graphs of chained findings to detect multi-step attack paths.
0968. **Chaining-feasibility oracle** — tests whether low-severity findings combine into high-severity chains via state-based verification.
0969. **Privilege-escalation pathfinder** — searches role-transition graphs for escalation paths using confirmed findings.
0970. **Data-exfiltration pathfinder** — traces data-flow paths from injection points to exfiltration sinks.
0971. **Lateral-movement modeler** — models tenant-to-tenant movement paths from confirmed isolation flaws.
0972. **Persistence-mechanism detector** — identifies mechanisms for maintaining access from confirmed flaws.
0973. **Defense-evasion analyzer** — analyzes which detections each finding evades to prioritize stealthy flaws.
0974. **Detection-coverage mapper** — maps which attack techniques the target's defenses actually detect via controlled probes.
0975. **Blue-team feedback oracle** — correlates findings with defensive telemetry to measure real-world detectability.
0976. **Deception-detection oracle** — identifies honeypot-like responses to avoid false findings from deception systems.
0977. **Canary-token tripwire** — plants canary tokens in test data and monitors for their appearance in unexpected places, detecting data leaks.
0978. **Honey-record detector** — creates honey records and monitors access to detect unauthorized browsing.
0979. **Honey-endpoint monitor** — registers honey endpoints and monitors hits to detect scanner-evasion or attacker activity.
0980. **Watermark-tracer** — watermarks test data and traces its flow through the system to detect unexpected processing.
0981. **Provenance tracker** — tracks data provenance from input to output to detect transformation flaws.
0982. **Lineage analyzer** — analyzes data lineage to detect unauthorized derivation or aggregation.
0983. **Taint-tracking emulator** — emulates taint tracking via marker propagation to detect unsanitized flows.
0984. **Sanitizer-effectiveness measurer** — quantifies sanitizer bypass rates across contexts to grade sanitizer strength.
0985. **Encoding-normalization tester** — tests normalization consistency across layers to detect bypass vectors.
0986. **Validation-consistency checker** — compares client vs server validation to detect client-only validation.
0987. **Allowlist-bypass tester** — tests allowlist enforcement with edge cases to detect bypass vectors.
0988. **Denylist-bypass tester** — tests denylist completeness via mutation to detect bypass vectors.
0989. **Regex-filter tester** — analyzes filter regexes for bypass via differential testing.
0990. **WAF-effectiveness scorer** — scores WAF coverage per vuln class via controlled bypass attempts.
0991. **Input-length boundary tester** — tests length limits for truncation-based bypass vectors.
0992. **Truncation-attack detector** — detects vulnerabilities from string truncation via boundary analysis.
0993. **Null-byte oracle** — tests null-byte handling for truncation vectors in legacy stacks.
0994. **Overlong-encoding oracle** — tests overlong UTF-8 for filter bypass in legacy parsers.
0995. **Homoglyph detector** — tests Unicode homoglyphs for identifier-confusion vectors.
0996. **Bidirectional-text oracle** — tests bidi overrides for display-spoofing vectors.
0997. **Zero-width-character oracle** — tests zero-width characters for filter-evasion vectors.
0998. **Normalization-form oracle** — tests NFC/NFD/NFKC/NFKD handling for comparison-bypass vectors.
0999. **Case-mapping oracle** — tests Unicode case mappings (e.g., Turkish i) for comparison flaws.
1000. **Confusable-detection scorer** — scores identifier confusability to detect spoofing-enabling flaws.
