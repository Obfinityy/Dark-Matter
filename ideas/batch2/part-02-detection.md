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
