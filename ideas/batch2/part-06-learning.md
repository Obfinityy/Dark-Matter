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
