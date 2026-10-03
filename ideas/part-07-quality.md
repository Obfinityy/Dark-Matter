## S. Risk scoring & false-positive elimination
0001. **Reachability-based exploitability scoring** — score each finding by the number of network hops from an unauthenticated internet position, since bugs reachable in one hop are exploited far sooner than ones buried behind VPNs.
0002. **Auth-context privilege weighting** — multiply severity by the privilege level required to trigger the flaw (anonymous > low-priv user > admin), because unauthenticated bugs carry the highest real-world risk.
0003. **User-interaction dependency discount** — automatically discount findings requiring improbable victim actions (multi-step phishing chains), reflecting how exploitation likelihood drops with each required interaction.
0004. **Asset-tier business impact multiplier** — assign payment, identity, and admin assets higher impact multipliers than marketing pages so identical bugs score differently by what they endanger.
0005. **Attack-path length chaining bonus** — boost severity when a finding chains with other confirmed issues into a longer attack path, since exploit chains compound impact.
0006. **CWE-to-business-impact translation table** — map each CWE class to concrete business consequences (data theft, fraud, downtime) so scores reflect outcomes rather than abstract technical severity.
0007. **Evidence-strength confidence scoring** — derive a 0–100 confidence value from evidence depth (full response exfiltration > error message > heuristic guess), separating proven issues from speculation.
0008. **Temporal freshness scoring** — raise priority for vulnerabilities in code or configs changed in the last 30 days, because fresh changes are both buggier and less reviewed.
0009. **EPSS-style exploitation-probability weighting** — weight each finding by public threat-intel signals (exploit-kit inclusion, in-the-wild chatter) so actively-exploited classes outrank theoretical ones.
0010. **Per-vuln-class safe confirmation probes** — run non-destructive confirmation requests tailored to each class (e.g., time-delay for blind SQLi) and only keep findings that pass, killing heuristic FPs.
0011. **Hunter-feedback FP classifier** — train a classifier on accept/reject labels from past triage to predict which new findings a human would reject, cutting review load.
0012. **Cross-hunt duplicate clustering** — group findings with identical root causes across hunts and targets so one underlying flaw yields one scored issue, not twenty.
0013. **Near-duplicate fuzzy matching** — merge findings whose evidence differs only in cosmetic details (timestamps, session IDs) using similarity hashing, preventing report bloat.
0014. **Data-sensitivity severity adjustment** — auto-escalate issues touching endpoints that return PII, credentials, or payment data, detected from response field names and content patterns.
0015. **Scanner-consensus confidence boost** — raise confidence when two or more independent engines flag the same root cause, and lower it when engines disagree.
0016. **Noise-floor calibration per target** — measure each target's baseline FP rate during a calibration phase and tune thresholds so noisy apps don't drown the queue.
0017. **Bounty-payout prediction per finding** — estimate likely payout from historical program data per vuln class and severity, letting hunters chase the highest-value bugs first.
0018. **Manual-review queue prioritization** — order the triage queue by expected-value (severity × confidence × payout) instead of discovery time so reviewers see the best findings first.
0019. **FP reason taxonomy auto-labeling** — classify every rejected finding into reasons (WAF block page, honeypot, test data, misconfigured probe) to expose systematic scanner weaknesses.
0020. **Score explanation traces** — attach a human-readable "why this is High" chain (evidence + weights + precedents) to every score so hunters can audit and trust it.
0021. **Dynamic rescoring after retest** — recompute scores when retests show changed behavior (fixed, WAF-mitigated, worse) so priorities always reflect current reality.
0022. **Asset-criticality inference from naming** — infer criticality from hostname and path conventions (api, pay, admin, prod) to weight assets the organization itself treats as important.
0023. **Asset-criticality inference from traffic** — infer importance from observed request volume and authenticated-user ratios, since high-traffic endpoints affect more users.
0024. **Exploit-kit availability check** — check whether public exploit code exists for the detected software version and raise scores for bugs with ready-made weapons.
0025. **Patch-availability severity discount** — slightly discount findings where a vendor patch exists and is merely unapplied, distinguishing them from zero-days needing novel research.
0026. **Zero-day novelty premium** — boost scores for vulnerability patterns with no known CVE or public writeup, since novel bugs are both rarer and more valuable.
0027. **WAF-presence exploitability discount** — reduce exploitability scores when an active WAF demonstrably blocks the attack class, while flagging bypass as a follow-up task.
0028. **Compensating-control detection** — detect mitigations like HttpOnly cookies, CSRF tokens, or strict CSP and factor them into the real exploitability of XSS/CSRF findings.
0029. **Honeypot and canary exclusion** — identify honeypot-like endpoints (canary tokens, trap paths) and exclude findings from them so decoys never pollute the queue.
0030. **Time-to-exploit estimation** — estimate hours-to-exploit from attack complexity and tooling availability, giving hunters a concrete urgency metric.
0031. **Attacker-cost modeling** — score findings by the cost to exploit (compute, accounts, social engineering) versus the payoff, prioritizing cheap high-payoff bugs.
0032. **Session-context sensitivity scoring** — weigh findings higher when they work in a victim's session versus only the attacker's, since session-riding bugs have wider blast radius.
0033. **Network-segment reachability mapping** — model which findings are reachable from which segments (internet, partner VPN, internal) and score by the weakest exposed segment.
0034. **Subdomain-takeover impact pre-scoring** — score takeover candidates by the parent domain's trust (cookies set, SSO) rather than treating all dangling DNS equally.
0035. **IDOR blast-radius estimation** — estimate how many records an IDOR exposes by sampling ID ranges, turning "IDOR exists" into "N records exposed."
0036. **SSRF cloud-metadata confirmation** — confirm SSRF by attempting to reach cloud metadata endpoints and score by the credentials or data actually retrievable.
0037. **XSS context exploitability grading** — grade XSS by sink context (script block, event handler, HTML injection point) since some contexts are trivially exploitable and others nearly impossible.
0038. **SQLi data-extraction proof scoring** — score SQLi by proven extraction depth (error-based < boolean-blind < full UNION dump), because demonstrated exfiltration beats theoretical injection.
0039. **Authentication-bypass impact chaining** — when auth bypass is found, automatically test what admin functions become reachable and fold that into the score.
0040. **Privilege-escalation path scoring** — score privesc findings by the highest privilege level actually reached in testing, not the level of the initial flaw.
0041. **RCE confirmation sandbox scoring** — confirm RCE in a sandboxed way (sleep/dns-callback) and score by command-output readability, separating true RCE from false command-injection echoes.
0042. **File-read sensitivity grading** — grade LFI/path-traversal by the sensitivity of files actually read (/etc/passwd < application config < private keys).
0043. **Open-redirect chain-to-account-takeover scoring** — escalate open redirects only when they chain into OAuth token theft or similar account-takeover primitives.
0044. **CSRF real-impact verification** — verify CSRF by checking for state-changing actions without token protection and score by the action's impact (password change > preference change).
0045. **Clickjacking framing-impact scoring** — score clickjacking by whether sensitive actions are framable and script-accessible, not merely by missing X-Frame-Options.
0046. **CORS misconfiguration data-risk scoring** — score CORS issues by whether credentials are allowed and sensitive data is readable cross-origin, ignoring harmless wildcard cases.
0047. **JWT algorithm-confusion confirmation** — confirm JWT flaws by forging tokens and testing acceptance, scoring by the privileges the forged token grants.
0048. **Rate-limit bypass impact scoring** — score rate-limit weaknesses by the abuse they enable (credential stuffing, SMS bombing, enumeration), measured with controlled tests.
0049. **Business-logic loss quantification** — quantify business-logic flaws in currency terms (price manipulation = max discount extractable), making impact concrete.
0050. **Race-condition window measurement** — measure the actual race window in milliseconds and score by exploit reliability, since wide windows are practically exploitable.
0051. **API mass-assignment field scoring** — score mass-assignment by the sensitivity of writable fields discovered (role, is_admin), not just parameter acceptance.
0052. **GraphQL introspection exposure scoring** — score GraphQL findings by the fraction of the schema exposed and whether mutations allow state changes.
0053. **Information-disclosure aggregation scoring** — combine individually low-severity disclosures (version leaks, stack traces) into an aggregate score when they jointly enable targeted attacks.
0054. **Verbose-error intelligence value scoring** — score verbose errors by the actionable intelligence they leak (SQL queries, internal paths, framework versions) for exploit planning.
0055. **Default-credential blast scoring** — score default credentials by the privileges of the account accessed and the number of hosts sharing them.
0056. **Exposed-admin-panel risk scoring** — score exposed admin interfaces by authentication strength and the destructive actions available inside.
0057. **Backup-file sensitivity scoring** — score exposed backups/archives by the secrets and data found inside after safe partial inspection.
0058. **Git-exposure completeness scoring** — score exposed .git directories by the proportion of source recoverable, since full source enables white-box follow-ups.
0059. **Dependency-vuln reachability analysis** — score vulnerable dependencies by whether the vulnerable function is actually reachable from application code, killing unreachable-CVE noise.
0060. **Container-escape precondition scoring** — score container misconfigurations by the verified escape preconditions (privileged, host mounts) rather than flagging every misconfig equally.
0061. **Cloud-metadata exposure scoring** — score cloud misconfigurations by the IAM permissions actually obtainable, tested through safe role enumeration.
0062. **S3-bucket data classification scoring** — classify exposed bucket contents (public PII, keys, backups) and score by the most sensitive object class found.
0063. **Subdomain-takeover service-risk tiers** — tier takeover risk by the claimable service's capabilities (JS execution, cookie access, phishing credibility).
0064. **DNS-zone-transfer record scoring** — score zone transfers by the internal hostnames and infrastructure details revealed, not as a flat medium.
0065. **Email-spoofing deliverability scoring** — score SPF/DKIM/DMARC gaps by actual spoofed-email deliverability tests to major providers.
0066. **Subdomain-enumeration completeness confidence** — attach a confidence metric for asset coverage (sources queried, wildcard handling) so scoring accounts for what might be missed.
0067. **Port-scan result relevance filtering** — filter open ports by service exploitability and version-matched CVEs, suppressing informational ports from scoring.
0068. **Service-version CVE correlation** — correlate fingerprinted versions against CVE feeds and score only by CVEs whose preconditions match the observed config.
0069. **TLS-configuration practical-risk scoring** — score TLS issues by practical exploitability (BEAST on modern browsers is near-zero) instead of flat cipher-suite grades.
0070. **Cookie-flag contextual scoring** — score missing cookie flags by the cookie's role (session vs analytics) and the XSS posture that would exploit it.
0071. **Security-header gap exploitability mapping** — map each missing header to the concrete attack it enables in this app's context, scoring only headers whose absence is actually exploitable.
0072. **HTTP-method verb-tampering verification** — verify dangerous HTTP methods with safe test requests and score by the state changes actually achievable.
0073. **Cache-poisoning impact scoring** — score cache issues by the fraction of users servable poisoned content and the content's sensitivity.
0074. **Host-header poisoning confirmability** — confirm host-header issues via password-reset poisoning tests and score by account-takeover feasibility.
0075. **Web-cache-deception data scoring** — score cache deception by the authenticated data actually cached and retrievable anonymously.
0076. **Prototype-pollution sink scoring** — score prototype pollution by the reachable dangerous sinks (fetch URLs, eval paths), not by pollution alone.
0077. **DOM-XSS source-sink trace scoring** — score DOM XSS by verified source-to-sink data flow with controllable input, eliminating tainted-but-unreachable sinks.
0078. **PostMessage handler risk scoring** — score postMessage flaws by origin-validation gaps combined with the sensitive actions handlers perform.
0079. **WebSocket hijacking feasibility scoring** — score WebSocket CSRF by origin-check behavior and the sensitivity of messages exchanged.
0080. **OAuth redirect-uri bypass scoring** — score OAuth flaws by whether token/code theft is demonstrable, weighting implicit-flow leaks highest.
0081. **SAML signature-bypass confirmation** — confirm SAML issues by forging assertions in a test harness and score by the roles assumable.
0082. **2FA-bypass method scoring** — score 2FA weaknesses by the bypass method's practicality (response manipulation > brute-force with rate limits).
0083. **Password-reset token entropy scoring** — score reset flows by measured token entropy and expiry, since low-entropy tokens are directly brute-forcible.
0084. **Account-enumeration scale scoring** — score enumeration by the oracle's speed and reliability, distinguishing theoretical from bulk-harvestable oracles.
0085. **Credential-stuffing exposure scoring** — score missing anti-automation by testing login-attempt throughput and lockout behavior under controlled load.
0086. **Session-fixation lifecycle scoring** — score session issues by whether fixation survives login and grants the victim's privileges.
0087. **Insecure-direct-download scoring** — score forced-browsing file access by the sensitivity of downloadable documents sampled safely.
0088. **Path-traversal sandbox escape scoring** — score traversal by the deepest sensitive file actually read, capping scores when jailed to harmless directories.
0089. **XXE out-of-band confirmation** — confirm XXE via controlled out-of-band callbacks and score by local file content actually exfiltrated.
0090. **SSRF internal-network mapping value** — score SSRF by the internal services fingerprinted through it, since network-mapping SSRF enables lateral movement.
0091. **Request-smuggling desync reliability** — score smuggling by desync reliability across repeated probes, since flaky desyncs rarely yield working exploits.
0092. **HTTP-splitting response-control scoring** — score response-splitting by the degree of response control achieved (header injection vs full body control).
0093. **LDAP-injection authentication-impact scoring** — score LDAP injection by whether authentication bypass or data extraction is demonstrable.
0094. **XPath-injection data-access scoring** — score XPath injection by the XML data actually retrievable, weighting credential stores highest.
0095. **NoSQL-injection operator scoring** — score NoSQL injection by the operators usable ($ne, $regex) and whether authentication bypass results.
0096. **SSTI sandbox-escape verification** — verify template injection by sandbox-escape attempts and score by code execution versus mere expression evaluation.
0097. **Command-injection output-channel scoring** — score command injection by the exfiltration channel established (blind vs output-visible), since visible output multiplies impact.
0098. **Deserialization gadget-chain scoring** — score deserialization by the gadget chain actually constructed and the code executed, not by library presence alone.
0099. **File-upload execution-context scoring** — score upload flaws by the execution context achieved (web-accessible path, handler mapping), separating stored files from true webshells.
0100. **MIME-sniffing drive-by scoring** — score upload MIME issues by whether the file renders as active content in target browsers, the drive-by precondition.
0101. **Reflected-XSS browser-filter bypass scoring** — test whether modern browser XSS auditors block the payload and score only filter-evading vectors as truly dangerous.
0102. **Stored-XSS persistence and audience scoring** — score stored XSS by the number of users who will render the payload (admin panels > user profiles > self-only notes).
0103. **Blind-XSS callback verification scoring** — confirm blind XSS via out-of-band callbacks and score by the privilege level of the admin session captured.
0104. **mXSS mutation-vector scoring** — test mutation-XSS payloads through the app's sanitizer and score by sanitizer-bypass reliability.
0105. **CSS-injection exfiltration scoring** — score CSS injection by demonstrable data exfiltration via attribute selectors, not by mere style injection.
0106. **Template-escape context scoring** — score SSTI-adjacent template escapes by the template engine's sandbox strength and known bypasses.
0107. **Log-injection forensic-impact scoring** — score log injection by whether forged entries can deceive SIEM parsing or cover attacker tracks.
0108. **CRLF-injection header-control scoring** — score CRLF by the headers actually injectable and whether session fixation or cache poisoning results.
0109. **Open-redirect allowlist-bypass scoring** — score redirects by allowlist-bypass techniques working (subdomain tricks, parameter pollution), since naive redirects are low value.
0110. **Tabnabbing reverse-tabnabbing scoring** — score reverse tabnabbing by the presence of opener access on external links handling sensitive flows.
0111. **Subresource-integrity gap scoring** — score missing SRI by whether the CDN-hosted script is actually compromised or attacker-replaceable.
0112. **Third-party-script trust scoring** — score third-party scripts by their privilege (full DOM access vs sandboxed iframe) and the vendor's breach history.
0113. **Dependency-confusion exploitability scoring** — score dependency confusion by whether internal package names are squattable on public registries.
0114. **Typosquat-dependency risk scoring** — score typosquat risk by install frequency of the lookalike package in the target's lockfiles.
0115. **Lockfile-integrity verification scoring** — verify lockfile hashes against registries and score mismatches by the code actually differing.
0116. **CI-secret exfiltration-path scoring** — score CI misconfigurations by the secrets actually extractable through log or artifact exfiltration tests.
0117. **GitHub-Actions injection scoring** — score workflow injection by whether attacker-controlled PR data reaches executable contexts.
0118. **Container-registry exposure scoring** — score exposed registries by the private images pullable and the secrets baked into layers.
0119. **Kubernetes-dashboard exposure scoring** — score exposed K8s dashboards by authentication state and the namespaces actually manageable.
0120. **etcd unauthenticated-access scoring** — score etcd exposure by the secrets retrievable via safe key-listing probes.
0121. **Docker-socket exposure scoring** — score exposed Docker sockets by container-creation capability, the direct host-compromise primitive.
0122. **Cloud-storage ACL drift scoring** — score storage ACLs by the delta from least-privilege and the data classes exposed.
0123. **IAM-privilege-escalation path scoring** — map IAM escalation paths and score by the shortest path to administrator, verified through policy simulation.
0124. **STS-token lifetime risk scoring** — score long-lived cloud tokens by their lifetime and the permissions attached.
0125. **Serverless-event injection scoring** — score serverless functions by event-source validation gaps and the downstream actions triggerable.
0126. **Cloud-logging blind-spot scoring** — score findings higher when CloudTrail/audit logging is disabled for the affected service, since undetected exploitation is worse.
0127. **Backup-retention gap scoring** — score backup issues by the recovery-point gap they create for ransomware scenarios.
0128. **Disaster-recovery test-evidence scoring** — check for evidence of tested restores and score untested backup claims as a governance risk.
0129. **Data-residency violation scoring** — score data flows crossing residency boundaries by the regulated data classes involved.
0130. **PII-field inventory scoring** — inventory PII fields across APIs and score endpoints by the count and sensitivity of PII returned.
0131. **GDPR right-to-erasure gap scoring** — test deletion endpoints for true data removal versus soft-delete flags and score the compliance gap.
0132. **Consent-bypass tracking scoring** — score tracking that fires before consent by the data transmitted pre-consent, measured in controlled sessions.
0133. **Payment-flow tampering quantification** — quantify payment bugs by the maximum monetary extraction per transaction under test constraints.
0134. **Coupon-abuse stacking scoring** — score promo-code flaws by the maximum stackable discount achievable in test transactions.
0135. **Loyalty-point manipulation scoring** — score point-system flaws by the points mintable per hour under rate limits.
0136. **Referral-fraud scale scoring** — score referral abuse by the fake accounts creatable per hour and the reward per account.
0137. **Inventory-hoarding impact scoring** — score cart/inventory locks by the revenue denial achievable during peak-sale simulations.
0138. **Price-oracle manipulation scoring** — score price feeds by the deviation inducible and the trades executable at manipulated prices.
0139. **Betting-odds timing scoring** — score timing flaws in odds/payout systems by the arbitrage window measured in milliseconds.
0140. **Auction-bid shading scoring** — score auction logic flaws by the information leaked about competing bids.
0141. **Vote-manipulation scale scoring** — score voting/poll flaws by the votes injectable per account and Sybil-account creation cost.
0142. **Review-fraud automation scoring** — score review systems by the fake reviews postable per hour and their ranking impact.
0143. **Content-moderation bypass scoring** — score moderation bypasses by the prohibited content postable and its persistence before takedown.
0144. **Spam-propagation velocity scoring** — score spam vectors by messages-per-minute achievable and the account cost per message.
0145. **Phishing-kit hosting risk scoring** — score user-content hosting by the phishing-kit deployability (arbitrary HTML, no sandboxing).
0146. **Malware-distribution vector scoring** — score upload vectors by the executables distributable and the download-trust indicators abused.
0147. **Drive-by-download precondition scoring** — score drive-by vectors by the user interaction actually required versus claimed.
0148. **Browser-exploit-kit fingerprint scoring** — score exploit-kit-like behavior by matching against known kit fingerprints to avoid misclassifying legitimately complex pages.
0149. **Cryptojacking resource-theft scoring** — score cryptojacking by the CPU/wattage stolen per visitor, measured in controlled loads.
0150. **Ad-fraud impression scoring** — score ad-fraud vectors by the fake impressions generatable and their payout rates.
0151. **API-quota theft scoring** — score API key leaks by the quota consumable and the cost per thousand calls to the key owner.
0152. **Scraping-defense bypass scoring** — score anti-scraping by the data harvestable per hour after bypass, the metric that matters to data owners.
0153. **Credential-market value scoring** — score credential exposures by dark-market price estimates for the credential type, grounding impact in economics.
0154. **Session-token black-market scoring** — score session leaks by the session's privileges and typical resale value for such access.
0155. **Ransomware-initial-access scoring** — score initial-access bugs by their fit to ransomware affiliate playbooks (RDP, VPN, phishing-adjacent).
0156. **Supply-chain blast-radius scoring** — score supply-chain issues by the downstream customer count affected, the multiplier that defines supply-chain incidents.
0157. **Watering-hole feasibility scoring** — score watering-hole potential by the target audience's visit frequency and the exploit reliability.
0158. **Insider-threat enablement scoring** — score flaws by how much they lower the bar for malicious insiders (audit-log tampering, privilege abuse).
0159. **Shadow-IT discovery confidence** — score shadow-IT findings by the evidence linking the asset to the organization (certificates, SSO, branding).
0160. **M&A inherited-risk scoring** — score acquired-company assets by their security debt (unpatched, unmonitored) during integration windows.
0161. **Legacy-system exploitability premium** — boost scores for unpatchable legacy systems where compensating controls are the only defense.
0162. **IoT-default-credential scale scoring** — score IoT credential issues by the device count sharing them, the botnet precondition.
0163. **Firmware-update hijack scoring** — score update mechanisms by signature-verification gaps and the device fleet reachable.
0164. **MQTT-broker exposure scoring** — score exposed brokers by the topics subscribable and the commands publishable to devices.
0165. **CoAP-resource enumeration scoring** — score CoAP exposures by the device resources enumerable without authentication.
0166. **UPnP-action abuse scoring** — score UPnP exposures by the administrative actions invocable (port mapping, reboot).
0167. **Telnet-service criticality scoring** — score Telnet by credential strength and the device functions accessible, the classic IoT takeover path.
0168. **Mobile-API backend scoring parity** — score mobile backend flaws with the same rigor as web, since mobile APIs often lack the web's protections.
0169. **Deep-link hijack scoring** — score deep-link flaws by the authenticated actions triggerable via crafted links.
0170. **Push-notification spoof scoring** — score push flaws by the spoofable content and the actions notifications trigger.
0171. **Biometric-bypass fallback scoring** — score biometric implementations by the strength of their PIN/password fallbacks, the real attack surface.
0172. **Certificate-pinning gap scoring** — score missing pinning by the MITM feasibility on the app's actual network paths.
0173. **Root-detection bypass scoring** — score root/jailbreak detection by bypass ease, since client-side checks only slow attackers.
0174. **App-secret extraction scoring** — score hardcoded secrets by the API privileges they grant after extraction from the binary.
0175. **OAuth mobile-flow scoring** — score mobile OAuth by custom-scheme hijackability and code-interception feasibility.
0176. **WebView-bridge abuse scoring** — score WebView bridges by the native functions exposed to web content and their privilege.
0177. **Intent-redirection scoring** — score intent flaws by the components reachable and the data extractable cross-app.
0178. **Clipboard-sensitivity scoring** — score clipboard usage by the sensitivity of data placed there (passwords, tokens).
0179. **Screenshot-prevention gap scoring** — score missing FLAG_SECURE by the sensitive screens exposed to screenshots and recent-apps previews.
0180. **Backup-extraction scoring** — score app backup exposure by the credentials recoverable from backup files.
0181. **Debug-build leakage scoring** — score debug artifacts by the verbose logging and test endpoints they expose.
0182. **ProGuard-mapping exposure scoring** — score exposed mapping files by the deobfuscation value for reverse engineers.
0183. **API-key rotation-evidence scoring** — check for key-rotation evidence and score long-lived keys by their age and scope.
0184. **Secret-commit history scoring** — score secrets found in git history by their validity (still-active keys score highest).
0185. **Env-file exposure scoring** — score exposed .env files by the production credentials and connection strings inside.
0186. **Config-backup scoring** — score config backups by the secrets and infrastructure details they reveal.
0187. **Swagger-exposure scoring** — score exposed API docs by the authenticated endpoints documented and the example credentials included.
0188. **GraphQL-schema sensitivity scoring** — score schema exposure by the admin mutations and PII types revealed.
0189. **Debug-endpoint scoring** — score debug endpoints by the actions they permit (cache clear, config dump, eval).
0190. **Status-page information scoring** — score status/health endpoints by the internal details leaked (versions, hostnames, dependency states).
0191. **Metrics-endpoint exposure scoring** — score exposed metrics by the business intelligence leaked (user counts, revenue-adjacent counters).
0192. **Pprof-debug scoring** — score Go pprof exposure by the profiling control granted and the DoS potential.
0193. **Actuator-endpoint scoring** — score Spring Actuator exposure by the endpoints enabled (env, heapdump) and the secrets within.
0194. **phpinfo-exposure scoring** — score phpinfo pages by the configuration secrets and path disclosures they provide.
0195. **Server-status exposure scoring** — score server-status pages by the request details leaked about other users.
0196. **Trace-method scoring** — score TRACE/TRACK by the header reflection enabling XST in legacy clients.
0197. **Options-method disclosure scoring** — score OPTIONS responses by the internal methods and endpoints they enumerate.
0198. **WebDAV-risk scoring** — score WebDAV by the write methods enabled and the authentication guarding them.
0199. **PUT-method upload scoring** — score PUT by the file types writable and their web-accessible execution.
0200. **Null-byte truncation scoring** — score null-byte issues by the access-control bypass actually achieved in the target's stack.
0201. **Unicode-normalization bypass scoring** — score normalization issues by the access-control or WAF bypass actually demonstrated with crafted Unicode.
0202. **Homograph-domain risk scoring** — score homograph registrations by visual similarity and the phishing-kit readiness of the lookalike.
0203. **IDN-display vulnerability scoring** — score IDN handling by the spoofable characters renderable in the app's UI contexts.
0204. **Right-to-left override scoring** — score RLO issues by the filename or URL spoofing actually achievable in downloads.
0205. **Zero-width-character filter scoring** — score filter bypasses using invisible characters by the WAF rules actually evaded.
0206. **HTTP/2 rapid-reset scoring** — score HTTP/2 implementations by rapid-reset DoS susceptibility under controlled request rates.
0207. **HTTP/3 handshake-abuse scoring** — score HTTP/3 by handshake-flooding resilience measured in safe load tests.
0208. **WebSocket-compression crash scoring** — score WebSocket compression by the memory exhaustion inducible with crafted frames.
0209. **gRPC-reflection exposure scoring** — score gRPC reflection by the services and methods enumerable without authentication.
0210. **gRPC-method authorization scoring** — score gRPC by testing authorization on each method, since transport security doesn't imply authz.
0211. **Protobuf-field injection scoring** — score protobuf handling by unknown-field acceptance and the downstream effects of injected fields.
0212. **GraphQL-batching bypass scoring** — score GraphQL by batching-enabled brute-force throughput against rate limits.
0213. **GraphQL-depth DoS scoring** — score GraphQL by the query depth/complexity actually processable before timeouts, measured safely.
0214. **Persisted-query bypass scoring** — score persisted-query allowlists by the ad-hoc queries still executable.
0215. **REST-versioning bypass scoring** — score API versioning by whether deprecated versions lack current security controls.
0216. **Content-negotiation smuggling scoring** — score content negotiation by the smuggled representations served to different parsers.
0217. **JSONP-callback scoring** — score JSONP by the sensitive data wrapped and the callback-validation strength.
0218. **CORS-preflight cache scoring** — score preflight caching by the duration stale permissive policies persist.
0219. **Referrer-policy leakage scoring** — score referrer policies by the sensitive tokens actually leaked in Referer headers during test flows.
0220. **Feature-policy gap scoring** — score permissions policies by the powerful features (camera, geolocation) left enabled on sensitive pages.
0221. **Trusted-types enforcement scoring** — score Trusted Types by the sinks still accepting raw strings, the enforcement gaps.
0222. **CSP-bypass technique scoring** — score CSP by the working bypass techniques (JSONP endpoints, Angular gadgets) rather than policy strictness alone.
0223. **Nonce-reuse detection scoring** — detect CSP nonce reuse across responses and score by the predictability enabling injection.
0224. **Base-uri hijack scoring** — score base-uri gaps by the script-src-equivalent impact of base-tag injection in the app.
0225. **Form-action hijack scoring** — score form-action gaps by the credential-harvesting forms actually hijackable.
0226. **Frame-ancestor bypass scoring** — score frame-ancestors by the nested-frame and sandbox bypasses working against it.
0227. **Sandbox-escape scoring** — score iframe sandboxing by the escape techniques applicable to the allowed permissions.
0228. **COOP-COEP isolation scoring** — score cross-origin isolation by the Spectre-class data access it actually prevents in the app's context.
0229. **CORP-resource protection scoring** — score CORP by the sensitive resources it actually shields from cross-origin reads.
0230. **Fetch-metadata enforcement scoring** — score resource isolation by testing sec-fetch-* enforcement on sensitive endpoints.
0231. **SameSite-cookie gap scoring** — score SameSite gaps by the cross-site state-changing requests actually exploitable.
0232. **Cookie-tossing impact scoring** — score cookie-tossing by the session-integrity impact of attacker-set cookies from subdomains.
0233. **Session-puzzle complexity scoring** — score session ID entropy by measured randomness, not by length alone.
0234. **Token-binding validation scoring** — score token binding by the replay resistance actually enforced.
0235. **DPoP-enforcement scoring** — score DPoP by the key-proof validation on each request, the replay defense.
0236. **MTLS-client-cert scoring** — score mTLS deployments by the certificate-validation strictness and revocation checking.
0237. **OCSP-stapling gap scoring** — score OCSP by the revocation-checking actually performed when stapling is absent.
0238. **HSTS-preload scoring** — score HSTS by preload-list inclusion and max-age, the SSL-stripping defenses.
0239. **Certificate-transparency monitoring scoring** — score rogue-certificate risk by CT-log coverage of the organization's domains.
0240. **CAA-record enforcement scoring** — score CAA by the unauthorized-CA issuance actually blocked.
0241. **DANE-validation scoring** — score DANE by the TLSA validation performed on supporting clients.
0242. **MTA-STS enforcement scoring** — score MTA-STS by the downgrade attacks actually prevented in mail flows.
0243. **TLS-RPT visibility scoring** — score TLS reporting by the visibility it gives into mail-security failures.
0244. **BIMI-impersonation scoring** — score BIMI by the logo-verification strength against lookalike senders.
0245. **ARC-chain trust scoring** — score ARC by the forwarded-mail authentication actually preserved.
0246. **DKIM-key strength scoring** — score DKIM by key length and rotation frequency, the forgery resistance.
0247. **DMARC-policy strictness scoring** — score DMARC by policy (none/quarantine/reject) and the spoofed-mail actually blocked.
0248. **SPF-record completeness scoring** — score SPF by the authorized senders covered and the softfail-vs-fail enforcement.
0249. **Subdomain-spoofing scoring** — score subdomain mail by the spoofable subdomains lacking their own DMARC policies.
0250. **Lookalike-domain mail scoring** — score lookalike domains by their mail-authentication posture and active MX records.
0251. **Catch-all enumeration scoring** — score catch-all configurations by the address-enumeration they permit.
0252. **Directory-harvest scoring** — score SMTP VRFY/EXPN by the valid addresses harvestable per hour.
0253. **Mail-relay openness scoring** — score relays by the third-party mail actually relayable in controlled tests.
0254. **Header-injection mail scoring** — score mail header injection by the BCC additions and content spoofing achievable.
0255. **Attachment-filter bypass scoring** — score attachment filtering by the malicious types actually deliverable.
0256. **Macro-execution scoring** — score macro policies by the code actually executable in delivered documents.
0257. **Link-rewriting bypass scoring** — score safe-link rewriting by the original-URL recovery techniques working.
0258. **QR-phishing vector scoring** — score QR code handling by the malicious URLs encodable and the preview bypasses.
0259. **Calendar-invite spoof scoring** — score calendar invites by the spoofable organizer fields and the phishing content renderable.
0260. **Voice-phishing enablement scoring** — score exposed phone/IVR by the vishing pretexts they enable (callback numbers, agent impersonation).
0261. **SMS-spoofing scoring** — score SMS by sender-ID spoofability and the phishing links deliverable.
0262. **SIM-swap exposure scoring** — score account recovery by the SIM-swap-ability of the recovery phone flows.
0263. **SS7-adjacent risk scoring** — score SMS-2FA by the interception feasibility given the threat model.
0264. **Push-fatigue scoring** — score MFA push by the fatigue-attack susceptibility (no number matching, unlimited prompts).
0265. **Number-matching enforcement scoring** — score number matching by the prompt-spoofing resistance it actually provides.
0266. **FIDO2-phishing resistance scoring** — score WebAuthn by the origin binding actually enforced against phishing proxies.
0267. **Passkey-sync risk scoring** — score passkey sync by the account-takeover impact of a compromised cloud account.
0268. **Recovery-code strength scoring** — score recovery codes by entropy and the rate limits guarding them.
0269. **Backup-code reuse scoring** — score backup codes by single-use enforcement, the replay precondition.
0270. **Trusted-device abuse scoring** — score trusted-device by the persistence granted and the revocation UX.
0271. **Session-lifetime risk scoring** — score session lifetimes by the theft-window they create for high-value accounts.
0272. **Concurrent-session scoring** — score concurrent sessions by the hijack-detection value of anomaly alerts.
0273. **Impossible-travel scoring** — score impossible-travel detection by the false-positive rate on legitimate VPN users.
0274. **Device-fingerprint stability scoring** — score device fingerprinting by the stability across legitimate device changes.
0275. **Behavioral-biometric scoring** — score behavioral signals by the account-takeover detection rate in controlled tests.
0276. **Risk-based-auth tuning scoring** — score step-up triggers by the fraud caught versus the friction added.
0277. **Fraud-rule bypass scoring** — score fraud rules by the bypass techniques (velocity splitting, device rotation) actually working.
0278. **Chargeback-fraud scoring** — score payment flows by the friendly-fraud indicators missing (device, velocity, AVS).
0279. **Account-takeover kill-chain scoring** — score ATO paths end-to-end from enumeration to persistence, the complete business impact.
0280. **Credential-leak correlation scoring** — correlate found credentials against breach datasets and score by the accounts still valid.
0281. **Password-spray susceptibility scoring** — score spray resistance by the attempts-per-hour achievable without lockout.
0282. **Password-policy strength scoring** — score policies by the crack-time of compliant passwords, not by rule complexity.
0283. **Breach-password blocking scoring** — score breached-password checks by the coverage of known-bad passwords.
0284. **Password-manager compatibility scoring** — score login forms by password-manager compatibility, the phishing-resistance enabler.
0285. **Autofill-abuse scoring** — score autofill by the credential-theft feasibility via hidden forms.
0286. **Clipboard-password scoring** — score password handling by the clipboard and shoulder-surfing exposures.
0287. **Password-visibility scoring** — score show-password toggles by the shoulder-surfing risk in the app's usage contexts.
0288. **Login-CSRF scoring** — score login CSRF by the session-fixation and analytics-poisoning impact.
0289. **Logout-CSRF scoring** — score logout CSRF by the denial-of-service and session-confusion impact.
0290. **Session-invalidation scoring** — score logout by the server-side invalidation actually performed.
0291. **Password-change session scoring** — score password changes by whether other sessions are revoked, the takeover-persistence defense.
0292. **Email-change verification scoring** — score email changes by the verification of both old and new addresses.
0293. **2FA-disable verification scoring** — score 2FA removal by the re-authentication strength required.
0294. **API-key exposure scoring** — score API keys by the permissions granted and the rotation evidence.
0295. **Webhook-secret scoring** — score webhooks by signature-verification enforcement, the forgery defense.
0296. **HMAC-validation scoring** — score HMAC by the constant-time comparison and key-secrecy practices.
0297. **Timestamp-replay scoring** — score timestamped requests by the acceptance window and the replay feasibility.
0298. **Nonce-uniqueness scoring** — score nonces by the replay-cache actually enforced server-side.
0299. **Idempotency-key scoring** — score idempotency by the duplicate-processing actually prevented under concurrent tests.
0300. **Double-submit scoring** — score double-submit patterns by the race conditions they actually prevent.
0301. **Optimistic-locking scoring** — score concurrency controls by the lost-update actually achievable under parallel tests.
0302. **Pessimistic-locking scoring** — score locking by the deadlock and timeout behaviors under contention.
0303. **Queue-poisoning scoring** — score message queues by the poison-message handling and the DLQ visibility.
0304. **Event-injection scoring** — score event buses by the forged events processable and their downstream effects.
0305. **Cache-key collision scoring** — score cache keys by the collision-induced data leakage between users.
0306. **Cache-stampede scoring** — score stampede protection by the thundering-herd actually inducible under load.
0307. **Negative-cache scoring** — score negative caching by the error-state persistence attackers can induce.
0308. **CDN-origin bypass scoring** — score CDN setups by the origin-IP discoverability and direct-origin access.
0309. **Origin-header validation scoring** — score origin validation by the bypass techniques (null origin, subdomain) working.
0310. **Edge-function injection scoring** — score edge functions by the code-injection surface in request-triggered logic.
0311. **WAF-bypass technique scoring** — score WAFs by the working bypass techniques per attack class, the residual risk.
0312. **Bot-detection bypass scoring** — score bot defenses by the automation actually achievable with headless browsers.
0313. **CAPTCHA-solver economics scoring** — score CAPTCHAs by the solve-cost per thousand versus the abuse value protected.
0314. **Proof-of-work scoring** — score PoW challenges by the asymmetry (client cost vs server cost) actually achieved.
0315. **Device-attestation scoring** — score attestation by the emulator-bypass feasibility.
0316. **App-integrity scoring** — score integrity checks by the repackaging actually detectable.
0317. **Anti-tamper scoring** — score tamper detection by the patching techniques that defeat it.
0318. **Anti-debug scoring** — score anti-debugging by the analyst-slowdown actually achieved versus determined bypass.
0319. **String-encryption scoring** — score string encryption by the key-recoverability from the binary.
0320. **Control-flow obfuscation scoring** — score obfuscation by the deobfuscation effort actually required.
0321. **Jailbreak-detection scoring** — score jailbreak detection by the bypass-tool compatibility.
0322. **Emulator-detection scoring** — score emulator detection by the false-positive rate on legitimate custom ROMs.
0323. **Hook-detection scoring** — score hook detection by the Frida-bypass techniques working.
0324. **SSL-pinning scoring** — score pinning by the bypass feasibility on rooted versus non-rooted devices.
0325. **Root-CA-install scoring** — score enterprise CA scenarios by the MITM feasibility with installed roots.
0326. **VPN-detection scoring** — score VPN detection by the false-positive rate on corporate VPN users.
0327. **Tor-exit scoring** — score Tor handling by the abuse actually originating from exit nodes.
0328. **Proxy-detection scoring** — score proxy detection by the residential-proxy bypass feasibility.
0329. **Datacenter-IP scoring** — score IP reputation by the false-positive rate on legitimate cloud users.
0330. **ASN-reputation scoring** — score ASN blocking by the collateral damage to legitimate hosting customers.
0331. **Geo-fencing scoring** — score geo controls by the VPN-bypass feasibility and the legitimate-traveler friction.
0332. **Time-based-access scoring** — score time restrictions by the timezone-spoofing bypass feasibility.
0333. **Just-in-time-access scoring** — score JIT elevation by the approval-workflow strength and the standing-privilege reduction.
0334. **Ephemeral-credential scoring** — score ephemeral credentials by the lifetime and the exfiltration window they create.
## T. Report quality — executive summaries, remediation code, compliance mapping
0335. **One-page executive brief generator** — distill any hunt into a single page with business risk, top 3 findings, and cost-of-inaction so executives read it in 60 seconds.
0336. **Audience-specific report variants** — render executive, developer, compliance-officer, and bounty-platform versions from one finding set, each with the depth and language its reader needs.
0337. **Developer-ticket auto-creation** — convert each finding into a Jira/Linear ticket with repro steps, severity, and acceptance criteria so remediation starts without copy-paste.
0338. **Remediation diff auto-generation** — produce unified diffs against the likely vulnerable code pattern for each finding, giving developers a starting patch instead of prose.
0339. **Stack-specific remediation snippets** — emit copy-paste fixes tailored to the detected stack (Node/Express, Django, Rails, Laravel, Spring) instead of generic advice.
0340. **OWASP Top 10 2021 mapping** — map every finding to its OWASP category with a justification sentence, making reports instantly navigable for appsec teams.
0341. **PCI DSS 4.0 requirement mapping** — link findings to the specific PCI DSS requirements they violate so payment-handling clients see compliance impact directly.
0342. **SOC 2 trust-criteria mapping** — map findings to SOC 2 criteria (CC6.1, CC7.2, etc.) so the report doubles as audit evidence.
0343. **HIPAA safeguard mapping** — map health-data findings to HIPAA administrative, physical, and technical safeguards for healthcare clients.
0344. **ISO 27001 Annex A mapping** — map findings to ISO 27001:2022 Annex A controls so certification efforts can cite the report.
0345. **GDPR article mapping** — link data-protection findings to GDPR articles (Art. 32, Art. 33 breach-notification triggers) for EU-facing organizations.
0346. **NIST CSF 2.0 function mapping** — organize findings under Govern/Identify/Protect/Detect/Respond/Recover so security leaders see framework coverage.
0347. **NIST 800-53 control mapping** — map technical findings to 800-53 controls for federal and enterprise compliance consumers.
0348. **CCPA/CPRA requirement mapping** — flag findings implicating California consumer-data rights (deletion, opt-out) for US privacy compliance.
0349. **FedRAMP control mapping** — map findings to FedRAMP baselines for cloud providers pursuing authorization.
0350. **MAS TRM guideline mapping** — map findings to Singapore MAS Technology Risk Management guidelines for financial-sector clients.
0351. **PSD2/SCA requirement mapping** — link payment-authentication findings to PSD2 strong-customer-authentication requirements.
0352. **CVSS 3.1 vector auto-computation** — compute full CVSS vectors from observed exploitability evidence with per-metric justification instead of guessed scores.
0353. **CVSS 4.0 vector auto-computation** — compute CVSS 4.0 vectors including supplemental metrics so reports match the current standard.
0354. **Attack-path visualization diagrams** — render chained findings as kill-chain graphs showing each hop from entry to objective, making complex chains instantly legible.
0355. **Finding timeline construction** — build a chronological timeline of discovery, confirmation, and retest events per finding for audit trails.
0356. **Fix-verification checklist per finding** — attach a concrete retest checklist (exact requests, expected responses) so developers can self-verify fixes.
0357. **Multilingual report generation** — generate the full report in the client's language (Hindi, Spanish, etc.) with security terminology correctly localized.
0358. **Evidence redaction for safe sharing** — automatically redact session tokens, PII, and credentials from evidence screenshots and logs before export.
0359. **White-label report branding** — apply the hunter's or firm's logo, colors, and fonts so reports look client-ready without design work.
0360. **Hunt-diff reports** — produce before/after reports between two hunts showing fixed, new, and persistent findings for regression storytelling.
0361. **Scope-coverage maps** — render which in-scope assets were tested, to what depth, and which were skipped, proving thoroughness.
0362. **Methodology appendix generation** — auto-write a methodology section listing tools, techniques, and test boundaries from the hunt's actual activity log.
0363. **False-positive dispute appendix** — include a dedicated appendix documenting rejected candidates and why, preempting client questions about thoroughness.
0364. **PDF design polish with charts** — generate PDFs with severity-distribution charts, risk heatmaps, and timelines, not walls of monospace text.
0365. **Markdown/HTML/PDF export parity** — guarantee identical content across markdown, HTML, and PDF exports so no format silently drops findings.
0366. **Executive risk-statement writer** — write a plain-language risk paragraph per finding ("an attacker could… costing…") that non-technical readers grasp.
0367. **Business-impact narrative builder** — translate each technical flaw into revenue, legal, and reputation consequences specific to the client's industry.
0368. **Cost-of-breach estimation** — estimate breach cost per critical finding using industry cost data and the records provably exposed.
0369. **Remediation-effort estimation** — estimate developer-hours per fix from the code-change size so teams can plan sprints.
0370. **Remediation-priority roadmap** — sequence fixes into 30/60/90-day phases balancing risk reduction against effort, giving teams an actionable plan.
0371. **Quick-win identification** — flag findings fixable in under an hour (header changes, flag flips) so teams get immediate risk reduction.
0372. **Compensating-control recommendations** — suggest WAF rules or config mitigations for findings that can't be code-fixed quickly, buying time safely.
0373. **Secure-code training pointers** — link each finding to the specific secure-coding lesson and CWE entry so developers learn while fixing.
0374. **CWE-weakness detail cards** — attach per-finding cards with CWE description, common consequences, and detection guidance for developer education.
0375. **CAPEC attack-pattern references** — reference the CAPEC attack patterns each finding enables, connecting bugs to adversary tradecraft.
0376. **ATT&CK technique mapping** — map findings to MITRE ATT&CK techniques so SOC teams can align detections with the report.
0377. **Kill-chain phase labeling** — label each finding with its kill-chain phase (recon, exploitation, actions on objectives) for defense planning.
0378. **Exploit-maturity labeling** — label whether each bug has public exploits, private tooling, or theoretical-only exploitation, informing patch urgency.
0379. **Affected-asset inventory table** — list every affected host, endpoint, and parameter in a sortable table for asset owners.
0380. **Data-exposure inventory** — enumerate exactly which data classes were proven exposed per finding, the record clients and regulators need.
0381. **Proof-of-concept appendix** — bundle all PoCs with step-by-step replay instructions in a dedicated appendix for validators.
0382. **Screenshot evidence curation** — select and annotate the single most convincing screenshot per finding instead of dumping dozens.
0383. **HTTP-transcript evidence blocks** — include minimal redacted request/response pairs proving each finding, the gold standard for bounty triagers.
0384. **Video-PoC storyboard** — generate a timestamped storyboard describing what a video PoC should show, guiding manual recording.
0385. **Reproduction-environment notes** — document the exact browser, tools, and preconditions used so anyone can reproduce each finding.
0386. **Non-reproducible finding disclosure** — honestly flag findings that couldn't be reproduced on retest, with hypotheses why, preserving credibility.
0387. **Out-of-scope observation log** — log interesting but out-of-scope observations separately so clients see value without scope violations.
0388. **Positive-security-findings section** — document strong controls observed (good headers, solid auth) so reports aren't purely negative.
0389. **Risk-acceptance documentation** — provide a template section for the client to formally accept residual risks the report identifies.
0390. **Retest-request workflow** — embed a retest request flow with per-finding verification status tracking for the fix cycle.
0391. **SLA-deadline table** — assign fix deadlines per severity (critical: 7 days, high: 30) in a trackable table for program management.
0392. **Compliance-gap summary table** — summarize all compliance mappings in one gap table with control IDs and pass/fail status.
0393. **Auditor-ready evidence packs** — bundle evidence per compliance control into signed, timestamped packs auditors can verify independently.
0394. **Board-level risk dashboard page** — render a board-ready page with risk trend, top exposures, and investment asks in business language.
0395. **CISO briefing slide export** — export findings as presentation slides with speaker notes for security-leadership briefings.
0396. **Developer standup summary** — generate a 5-bullet standup update (what's critical, what's assigned, what's blocked) for engineering teams.
0397. **Bounty-platform submission drafts** — draft HackerOne/Bugcrowd-ready submissions per finding with impact statements tuned to each platform's triage style.
0398. **Duplicate-submission risk note** — warn per finding how likely it duplicates known issues, with search terms to check before submitting.
0399. **Bounty-brief quality scoring** — score each draft submission's clarity and evidence completeness before the hunter sends it.
0400. **Report readability scoring** — score generated reports on grade-level and jargon density, rewriting passages executives won't understand.
0401. **Consistent-terminology enforcement** — enforce one term per concept across the report (e.g., always "cross-site scripting (XSS)") for professionalism.
0402. **Finding-title quality rules** — generate titles that name the flaw, location, and impact ("Stored XSS in checkout comment → session theft") instead of bare CWE names.
0403. **Severity-justification paragraphs** — write a justification paragraph per severity rating citing the specific evidence that earned it.
0404. **Confidence-level disclosure** — state the confidence behind each finding (confirmed/likely/possible) so readers calibrate trust.
0405. **Assumptions-and-limitations section** — document test limitations (no source access, time-boxed) so conclusions are properly bounded.
0406. **Threat-model context section** — describe the assumed attacker (internet opportunistic vs targeted) so severity makes sense.
0407. **Asset-criticality legend** — explain the asset tiers used in scoring so clients understand why identical bugs scored differently.
0408. **Scoring-methodology disclosure** — publish the exact scoring formula and weights in an appendix for transparency and repeatability.
0409. **Tool-and-version inventory** — list every tool and version used during the hunt for reproducibility and audit.
0410. **Test-account credential handling note** — document how test credentials were handled and rotated, the professionalism detail clients notice.
0411. **Data-handling attestation** — attest that client data was handled per the agreed rules (no exfiltration beyond PoC, secure deletion).
0412. **Rules-of-engagement compliance log** — log every action against the agreed rules of engagement, proving no boundary was crossed.
0413. **Safe-harbor reference section** — cite the program's safe-harbor terms in the report so legal teams see the testing was authorized.
0414. **Coordinated-disclosure timeline** — propose disclosure milestones (report, fix, public) for vulnerabilities needing coordinated handling.
0415. **CVE-request assistance** — draft CVE description text and affected-version details for findings deserving identifiers.
0416. **Advisory-style writeup mode** — render critical findings as vendor-advisory-style documents suitable for public disclosure after fixes.
0417. **Changelog-style fix notes** — generate release-note entries describing each fix in user-safe language for the client's changelog.
0418. **Customer-notification draft** — draft breach-notification-safe customer communications for findings involving user data exposure.
0419. **Regulator-notification assessment** — assess whether each data-exposure finding triggers regulator notification duties under applicable law.
0420. **Cyber-insurance relevance notes** — note which findings affect cyber-insurance questionnaires and attestations for the finance team.
0421. **M&A due-diligence summary** — render a due-diligence summary (security debt, critical exposures) for acquisition evaluations.
0422. **Vendor-risk assessment extract** — produce a vendor-risk extract (controls observed, gaps) for third-party risk teams.
0423. **Pen-test comparison section** — compare automated findings against what a manual pen test would add, setting expectations honestly.
0424. **Coverage-gap honesty section** — explicitly list what wasn't tested (mobile apps, internal network) so the report never overclaims.
0425. **Residual-risk statement** — state the remaining risk after recommended fixes, the honest closing executives need.
0426. **Next-hunt recommendation** — recommend the next hunt's focus (areas under-tested, new features) based on this hunt's coverage.
0427. **Quarterly-trend narrative** — write a narrative of how the security posture changed across hunts, not just numbers.
0428. **Benchmark-against-peers section** — compare the client's finding profile against anonymized industry peers for context.
0429. **Maturity-model placement** — place the organization on a security-maturity scale with concrete next-level criteria.
0430. **Security-champions program tie-in** — suggest which findings to use as training cases for internal security champions.
0431. **Tabletop-exercise scenario builder** — turn the top attack chain into a tabletop-exercise scenario for incident-response teams.
0432. **Detection-engineering mapping** — map each finding to SIEM detection rules that would catch its exploitation, helping blue teams.
0433. **Sigma-rule generation** — emit Sigma detection rules for the attack patterns proven during the hunt.
0434. **YARA-rule generation** — emit YARA rules for malicious artifacts (webshells, payloads) observed during testing.
0435. **Snort/Suricata rule drafts** — draft IDS rules for the exploit traffic patterns used, so exploitation attempts get detected.
0436. **WAF-rule recommendations** — provide ModSecurity/CRS-style rule snippets mitigating each finding class until code fixes land.
0437. **RASP-policy suggestions** — suggest runtime-protection policies for the frameworks in use, mapped to findings.
0438. **Security-header fix snippets** — emit exact header configurations (nginx, Apache, Cloudflare) fixing header-related findings.
0439. **CSP-policy builder** — generate a deployable Content-Security-Policy derived from the app's actual resource usage observed during the hunt.
0440. **Cookie-configuration fixes** — emit exact Set-Cookie directives (Secure, HttpOnly, SameSite, __Host-) for cookie findings.
0441. **CORS-policy fix snippets** — emit strict CORS configurations replacing wildcard policies per framework.
0442. **JWT-validation fix code** — emit correct JWT verification code (algorithm pinning, expiry, issuer checks) for the app's language.
0443. **Password-hashing migration snippets** — emit Argon2/bcrypt migration code with rehash-on-login logic for weak-hashing findings.
0444. **Parameterized-query rewrites** — rewrite the vulnerable query pattern into parameterized form for the detected ORM/raw driver.
0445. **Output-encoding fix snippets** — emit context-correct output-encoding fixes (HTML, attribute, JS, URL) per XSS sink type.
0446. **CSRF-token implementation snippets** — emit synchronizer-token and SameSite-based CSRF fixes for the app's framework and form patterns.
0447. **Rate-limit configuration snippets** — emit Redis/token-bucket rate-limit configs tuned to the abuse rates measured during testing.
0448. **File-upload validation snippets** — emit allowlist-based upload validation (magic bytes, extension, MIME, size) for the app's backend language.
0449. **Path-traversal safe-join snippets** — emit canonicalization plus safe-join fixes replacing the vulnerable file-access pattern.
0450. **SSRF-allowlist fix snippets** — emit DNS-rebinding-resistant SSRF guards (resolve-then-validate, allowlisted egress) for the app's HTTP client.
0451. **XXE-hardening snippets** — emit parser-hardening code disabling external entities for the exact XML library fingerprinted.
0452. **Deserialization-safe alternatives** — emit safe deserialization replacements (JSON schemas, signed tokens) for the vulnerable serializer.
0453. **Command-execution avoidance snippets** — rewrite shell invocations into argument-array exec calls eliminating injection in the app's language.
0454. **LDAP-filter escaping snippets** — emit proper LDAP filter escaping for the directory library in use.
0455. **NoSQL-operator sanitization snippets** — emit query-operator allowlisting for the Mongo/Mongoose patterns observed.
0456. **GraphQL depth-limiting snippets** — emit query-complexity and depth limits for the GraphQL server library detected.
0457. **OAuth redirect-uri validation snippets** — emit exact-match redirect validation replacing prefix/regex checks.
0458. **SAML-assertion validation snippets** — emit signature, audience, and skew validation for the SAML library in use.
0459. **Session-management fix snippets** — emit secure session configs (rotation on login, idle timeout, invalidation) for the framework.
0460. **2FA-enrollment fix snippets** — emit TOTP enrollment with backup-code handling for the app's auth stack.
0461. **Password-reset token snippets** — emit cryptographically random, expiring, single-use reset-token implementations.
0462. **Account-lockout policy snippets** — emit progressive-delay lockout logic balancing brute-force defense against user lockout DoS.
0463. **API-key scoping snippets** — emit scoped-key issuance (prefix, permissions, expiry) replacing the leaked coarse keys.
0464. **Webhook-signature verification snippets** — emit HMAC webhook verification with timestamp tolerance for the provider's scheme.
0465. **Secrets-management migration snippets** — emit vault/secret-manager integration code replacing hardcoded secrets found.
0466. **Dockerfile-hardening snippets** — emit hardened Dockerfiles (non-root, read-only FS, dropped capabilities) for container findings.
0467. **Kubernetes RBAC fix snippets** — emit least-privilege Role/RoleBinding YAML replacing over-broad cluster permissions.
0468. **S3-bucket policy fixes** — emit least-privilege bucket policies and Block Public Access configs for exposure findings.
0469. **IAM-policy least-privilege rewrites** — rewrite over-broad IAM policies into scoped versions preserving the app's actual API calls.
0470. **Terraform-secure module snippets** — emit secure Terraform for the misconfigured resource (encrypted storage, logging enabled).
0471. **CloudFormation guardrails** — emit hardened CloudFormation templates addressing the CIS-benchmark gaps found.
0472. **Nginx-security-hardening snippets** — emit nginx configs (headers, TLS, method limits) fixing the server findings.
0473. **Apache-hardening snippets** — emit Apache configs addressing the version-disclosure and method findings.
0474. **Express-security-middleware snippets** — emit helmet/csurf/rate-limit wiring for the Express version detected.
0475. **Django-security-settings snippets** — emit Django settings (SECURE_*, CSRF, sessions) correcting the misconfigurations found.
0476. **Rails-security snippets** — emit Rails force_ssl, CSP, and strong-parameter fixes for the findings.
0477. **Laravel-security snippets** — emit Laravel middleware and config fixes for the issues found.
0478. **Spring-Security snippets** — emit Spring Security configurations (CSRF, headers, method security) for Java findings.
0479. **ASP.NET-security snippets** — emit antiforgery, data-protection, and header fixes for .NET findings.
0480. **Go-secure-coding snippets** — emit Go fixes (template escaping, TLS config, path handling) for the findings.
0481. **Rust-secure snippets** — emit Rust fixes using the ecosystem's safe patterns for the issues found.
0482. **PHP-hardening snippets** — emit php.ini and code-level fixes for the PHP findings.
0483. **WordPress-hardening snippets** — emit wp-config and plugin-hygiene fixes for WordPress findings.
0484. **Next.js-security snippets** — emit Next.js middleware, headers, and server-action fixes for the findings.
0485. **Nuxt-security snippets** — emit Nuxt security-module configs for the Vue findings.
0486. **SvelteKit-security snippets** — emit SvelteKit hooks and CSP fixes for the findings.
0487. **Mobile-backend fix snippets** — emit certificate-pinning and token-storage fixes for mobile API findings.
0488. **GraphQL-authz snippets** — emit field-level authorization checks for the GraphQL schema's resolvers.
0489. **WebSocket-auth snippets** — emit origin-check plus token-auth patterns for WebSocket findings.
0490. **gRPC-auth interceptors** — emit authentication/authorization interceptors for the gRPC framework detected.
0491. **Event-driven fix snippets** — emit signed-event and schema-validation patterns for event-bus findings.
0492. **Queue-security snippets** — emit DLQ, encryption, and auth configs for message-queue findings.
0493. **Cache-security snippets** — emit authenticated-encryption cache patterns fixing cache-deception findings.
0494. **CDN-configuration fixes** — emit cache-key and origin-shield configs fixing CDN findings.
0495. **DNS-security snippets** — emit CAA, DNSSEC, and SPF/DKIM/DMARC records fixing mail/DNS findings.
0496. **Email-authentication records** — emit exact SPF/DKIM/DMARC TXT records correcting the mail-spoofing findings.
0497. **Subdomain-takeover remediation steps** — emit DNS-cleanup and claim-verification steps per dangling record found.
0498. **Certificate-management runbook** — emit renewal, monitoring, and CT-watch steps for certificate findings.
0499. **Key-rotation runbook** — emit step-by-step rotation procedures for each leaked credential type found.
0500. **Incident-response playbook extract** — turn the top attack chain into an IR playbook (detect, contain, eradicate) for the SOC.
0501. **Forensic-artifact collection guide** — list the logs and artifacts to preserve per finding type for investigations.
0502. **Threat-hunting hypothesis cards** — convert each finding into a threat-hunting hypothesis with data sources and queries.
0503. **Purple-team exercise brief** — package the attack chain as a purple-team exercise with red actions and blue detections.
0504. **Security-awareness training cases** — turn phishing-adjacent findings into awareness-training scenarios for employees.
0505. **Secure-SDLC integration notes** — map each finding to the SDLC phase where it should have been caught (design review, SAST gate).
0506. **SAST-rule suggestions** — suggest custom SAST rules that would catch each bug class in the client's codebase.
0507. **DAST-scan configuration** — export tuned DAST scan configs reproducing the hunt's coverage for the client's pipeline.
0508. **Pre-commit-hook suggestions** — suggest secret-scan and lint hooks preventing the secret/config findings found.
0509. **Dependency-policy recommendations** — recommend allowlists, pinning, and SCA gates addressing the dependency findings.
0510. **Container-policy recommendations** — recommend admission-controller policies (no privileged, signed images) for K8s findings.
0511. **Cloud-policy-as-code** — emit OPA/Conftest policies encoding the cloud misconfigurations as preventable-by-policy.
0512. **Branch-protection recommendations** — recommend branch protections and required reviews addressing the CI findings.
0513. **Secrets-rotation policy draft** — draft a rotation schedule and ownership policy for the secret types found exposed.
0514. **Vulnerability-disclosure policy review** — assess the client's disclosure policy against the findings' handling needs.
0515. **Bug-bounty-scope recommendations** — recommend scope expansions based on the shadow assets discovered during the hunt.
0516. **Safe-harbor language suggestions** — suggest safe-harbor wording improvements drawn from the testing actually performed.
0517. **Report-translation glossary** — maintain a security-term glossary per target language so multilingual reports stay consistent.
0518. **Right-to-left language layouts** — render Arabic/Hebrew reports with correct RTL layout and mirrored diagrams.
0519. **CJK-typography report polish** — typeset Chinese/Japanese/Korean reports with proper fonts and line-breaking rules.
0520. **Plain-language summaries** — include a plain-language (grade-8) summary for non-technical stakeholders alongside the technical body.
0521. **Visual-severity iconography** — use consistent, accessible iconography for severities that survives black-and-white printing.
0522. **Colorblind-safe palettes** — render all charts in colorblind-safe palettes so severity colors aren't ambiguous.
0523. **Print-optimized PDF layouts** — paginate with print margins, page numbers, and a table of contents for physical distribution.
0524. **Screen-reader accessible PDFs** — tag PDFs with reading order and alt text so assistive technology can navigate findings.
0525. **Digitally-signed PDF reports** — sign PDFs so clients can verify the report wasn't altered after delivery.
0526. **Watermarked draft reports** — watermark pre-final reports as DRAFT to prevent premature circulation.
0527. **Report-version tracking** — version reports (1.0, 1.1-retest) with changelogs so fix cycles stay organized.
0528. **Finding-ID stability** — assign stable finding IDs that persist across retests and diff reports for tracking.
0529. **Cross-reference linking** — hyperlink related findings, appendices, and evidence so readers navigate chains easily.
0530. **Glossary-of-terms appendix** — define every security term used, since client readers range from interns to CISOs.
0531. **Acronym-expansion pass** — expand all acronyms on first use automatically, the copy-editing detail that signals professionalism.
0532. **Grammar-and-tone normalization** — normalize the whole report to one professional voice regardless of how many engines contributed text.
0533. **British-vs-American spelling switch** — render reports in the client's locale spelling consistently.
0534. **Date-and-timezone localization** — render all timestamps in the client's timezone with unambiguous formatting.
0535. **Currency-localized impact figures** — express monetary impact in the client's currency using current rates.
0536. **Legal-disclaimer footer** — attach testing-boundary and liability disclaimers calibrated to the engagement terms.
0537. **Confidentiality marking** — mark classification (Confidential/Internal) on every page per the client's handling rules.
0538. **Distribution-list page** — record who received the report and when, the chain-of-custody detail auditors expect.
0539. **Acknowledgment-request workflow** — request and track client acknowledgment of critical findings for accountability.
0540. **Escalation-contact block** — list escalation contacts and SLAs on the cover page for critical-findings response.
0541. **Cover-page risk dial** — render an at-a-glance risk dial (overall posture score) on the cover for instant comprehension.
0542. **Heatmap-by-asset-class** — render severity heatmaps broken down by asset class (web, API, mobile backend, infra).
0543. **Finding-density treemap** — render treemaps showing where findings concentrate by application module.
0544. **Age-of-findings chart** — chart finding age (new vs long-standing) to show whether debt is growing.
0545. **Remediation-burndown projection** — project a burndown of open findings given the team's velocity for planning.
0546. **Risk-over-time sparkline** — embed sparklines of risk score across hunts on the executive page.
0547. **Top-attackers-view simulation** — illustrate what each attacker tier (script kiddie, criminal, APT) could achieve with the findings.
0548. **Likelihood-vs-impact matrix** — plot findings on a 5x5 risk matrix executives already understand.
0549. **Compliance-posture radar** — render radar charts of compliance coverage per framework mapped.
0550. **Before-after control charts** — chart control effectiveness before and after recommended fixes for investment cases.
0551. **Word-cloud of weak areas** — render weak-area word clouds from finding tags for memorable executive slides.
0552. **Infographic-style key stats** — present headline stats (MTTR, critical count, coverage %) as infographics.
0553. **Annotated-architecture diagram** — overlay findings on the inferred application architecture diagram.
0554. **Data-flow exposure diagram** — draw data flows marking where sensitive data was proven exposed.
0555. **Trust-boundary diagram** — draw trust boundaries with the findings that cross each one.
0556. **Deployment-topology map** — map findings onto the discovered infrastructure topology (CDN, LB, app, DB).
0557. **API-surface inventory diagram** — diagram every discovered API endpoint colored by auth requirements and finding density.
0558. **Authentication-flow diagram** — draw the login/MFA/session flows with the exact steps where bypasses succeeded.
0559. **Session-lifecycle diagram** — illustrate session creation, rotation, and invalidation with the gaps found marked.
0560. **Payment-flow diagram** — draw the payment flow marking each tampering point proven during testing.
0561. **CI/CD-pipeline diagram** — draw the build pipeline marking secret-exposure and injection points found.
0562. **Cloud-IAM graph extract** — render the IAM privilege graph highlighting escalation paths in the report.
0563. **Network-reachability diagram** — draw which findings are reachable from internet, partner, and internal networks.
0564. **Subdomain-ownership tree** — render the subdomain tree marking takeovers, exposures, and trust relationships.
0565. **Certificate-chain diagram** — draw certificate chains marking weak links (short keys, missing stapling).
0566. **Email-authentication flow diagram** — illustrate SPF/DKIM/DMARC evaluation with the failing hops marked.
0567. **DNS-resolution path diagram** — draw resolution paths marking hijackable delegations found.
0568. **Third-party-dependency graph** — graph third-party scripts and packages with the risky nodes highlighted.
0569. **Container-escape path diagram** — draw the container-to-host escape path with each precondition marked as met or missing.
0570. **Lateral-movement map** — map the SSRF/RCE-enabled lateral movement options across internal services.
0571. **Privilege-escalation ladder** — draw each privesc as a ladder from initial access to the highest privilege reached.
0572. **Data-exfiltration path diagram** — draw the proven exfiltration paths (XSS→admin, SSRF→metadata) end to end.
0573. **Incident-timeline infographic** — render the hunt's key events as an infographic timeline for presentations.
0574. **Evidence-gallery appendix** — curate an annotated evidence gallery with captions explaining what each artifact proves.
0575. **Side-by-side vulnerable-vs-fixed** — show vulnerable and fixed code side by side for each remediation snippet.
0576. **Diff-highlighted config fixes** — highlight exactly which config lines change in before/after config blocks.
0577. **Copy-button code blocks** — ensure every snippet in HTML exports has one-click copy, the usability detail developers expect.
0578. **Language-tabbed snippets** — present remediation snippets in tabs per language when the stack is ambiguous.
0579. **Framework-version-pinned snippets** — pin snippets to the exact framework version detected so APIs match.
0580. **Test-case generation per fix** — emit regression test cases (pytest/Jest/RSpec) validating each fix.
0581. **Negative-test suggestions** — suggest attack-style negative tests per finding for the client's test suite.
0582. **Fuzz-seed suggestions** — provide fuzzing seeds derived from the payloads that worked, for ongoing testing.
0583. **Contract-test additions** — suggest API contract tests locking the fixed behavior (authz checks, validation).
0584. **E2E-security test scripts** — emit Playwright/Cypress scripts replaying the exploit to verify the fix in CI.
0585. **Performance-impact notes** — note the performance cost of each recommended fix (hashing rounds, WAF latency) honestly.
0586. **Rollback-plan per fix** — include rollback steps for risky fixes (auth changes, crypto migrations).
0587. **Feature-flag rollout suggestion** — recommend flag-gated rollouts for behavioral fixes like new validation.
0588. **Canary-deploy verification steps** — specify canary metrics proving a security fix didn't break functionality.
0589. **Database-migration snippets** — emit migrations (new columns for password hashes, token tables) needed by the fixes.
0590. **Backfill-script guidance** — guide backfilling (rehashing passwords, invalidating sessions) after credential-related fixes.
0591. **Cache-invalidation runbook** — specify cache purges needed after fixes that change cached auth decisions.
0592. **CDN-purge checklist** — list the CDN purges required when fixing cache-deception or poisoning issues.
0593. **DNS-change runbook** — give exact record changes and TTL sequencing for DNS-related fixes.
0594. **Certificate-rotation runbook** — give rotation steps with zero-downtime sequencing for cert findings.
0595. **Secrets-rotation sequencing** — order multi-secret rotations to avoid outages (deploy new, dual-accept, retire old).
0596. **WAF-tuning verification steps** — specify how to verify WAF rules block the exploit without breaking legit traffic.
0597. **Monitoring-alert definitions** — define the alerts (queries, thresholds) that detect exploitation attempts per finding.
0598. **Log-source requirements** — list which logs must exist to detect each attack class, exposing logging gaps.
0599. **Audit-trail completeness check** — verify security-relevant actions are logged, and report the gaps as findings-with-fixes.
0600. **Retention-policy recommendations** — recommend log retention periods per data class for forensics and compliance.
0601. **Backup-verification steps** — specify restore tests proving backup-related fixes actually work.
0602. **DR-drill scenario** — convert ransomware-relevant findings into a disaster-recovery drill script.
0603. **Tabletop facilitator guide** — provide facilitator notes (injects, expected decisions) for the exercise scenario.
0604. **Executive-Q&A preparation** — draft anticipated board questions about the findings with suggested answers.
0605. **Press-statement template** — provide a holding statement template if a finding becomes public before fixes land.
0606. **Customer-FAQ draft** — draft customer FAQs addressing the user-data findings in plain language.
0607. **Status-page wording** — suggest status-page language for communicating security-maintenance windows.
0608. **Changelog-security section** — draft the security section of release notes without disclosing exploit details.
0609. **Deprecation-notice draft** — draft deprecation notices for insecure endpoints/versions the report recommends retiring.
0610. **Migration-guide outline** — outline user migration for breaking security fixes (new auth flows, deprecated APIs).
0611. **Developer-workshop agenda** — build a workshop agenda teaching the hunt's top bug classes with the client's own examples.
0612. **Secure-coding checklist** — emit a per-stack secure-coding checklist derived from the findings for the client's wiki.
0613. **Code-review checklist** — emit code-review checklists targeting the exact flaw patterns found.
0614. **Threat-model update notes** — propose threat-model updates (new actors, abuse cases) based on the findings.
0615. **Architecture-review findings brief** — brief architects on the systemic issues (missing authz layer, weak session design) behind clusters of bugs.
0616. **API-design guideline extract** — derive API design rules (authz patterns, ID formats) preventing the API findings found.
0617. **Frontend-security guideline extract** — derive frontend rules (encoding, postMessage hygiene) from the client-side findings.
0618. **Mobile-security guideline extract** — derive mobile rules (storage, pinning, deep links) from the mobile findings.
0619. **Cloud-security baseline extract** — derive the cloud baseline (policies, guardrails) from the misconfigurations found.
0620. **Container-security baseline extract** — derive container baselines from the container findings.
0621. **CI/CD-security baseline extract** — derive pipeline-security rules from the CI findings.
0622. **Data-classification recommendations** — recommend data classes and handling rules based on the PII actually observed.
0623. **Retention-schedule recommendations** — recommend data retention/deletion schedules addressing the over-retention observed.
0624. **Access-review trigger** — flag the over-privileged roles found as input to the client's access-recertification.
0625. **Vendor-questionnaire answers** — pre-answer security questionnaire items using the controls the hunt verified.
0626. **RFP-security appendix** — produce an RFP-ready security appendix from the positive findings and remediations.
0627. **Trust-center content draft** — draft trust-center updates (certifications, testing cadence) from the hunt results.
0628. **Security-page copy** — draft public security-page copy describing the testing program professionally.
0629. **Responsible-disclosure acknowledgment** — draft researcher acknowledgment text for the client's hall-of-fame.
0630. **Hall-of-fame formatting** — format researcher credits consistently for the client's disclosure page.
0631. **Bounty-amount justification** — write payout justifications per finding citing impact evidence for program managers.
0632. **Bounty-tier recommendation** — recommend which bounty tier each finding deserves under the program's published table.
0633. **Program-policy gap notes** — note where the program's scope or rules created testing friction, improving the program.
0634. **Triage-feedback summary** — summarize likely triager questions per finding with pre-written answers, speeding acceptance.
0635. **Appeal-argument builder** — draft appeal arguments with additional evidence for findings likely to be marked N/A or duplicate.
0636. **Mediation-brief generator** — build a mediation brief (evidence, impact, precedent payouts) for disputed bounty decisions.
0637. **Research-writeup outline** — outline a public research writeup for novel findings after coordinated disclosure.
0638. **Conference-talk abstract** — draft a talk abstract based on the novel technique, helping hunters build reputation.
0639. **Blog-post draft** — draft a technical blog post explaining the interesting chain with sanitized details.
0640. **Tweet-thread summary** — draft a concise thread summarizing the hunt's headline findings for community sharing.
0641. **CVE-description polish** — polish CVE descriptions to MITRE's style for accepted identifiers.
0642. **CWE-classification rationale** — write the CWE selection rationale, the detail CVE reviewers check.
0643. **CVSS-justification narrative** — write the CVSS metric-by-metric justification narrative for NVD submissions.
0644. **Affected-products enumeration** — enumerate affected products/versions precisely for advisory publication.
0645. **Workaround documentation** — document workarounds for users who can't patch immediately, the advisory section that reduces harm.
0646. **Patch-diff analysis notes** — analyze the vendor patch diff to describe exactly what changed for the advisory.
0647. **Exploit-status labeling** — label advisories with honest exploit status (in-the-wild, PoC public, theoretical).
0648. **Credit-and-timeline section** — write the discovery timeline and credit section for coordinated-disclosure advisories.
0649. **FAQ-for-defenders section** — answer defender questions (am I affected, how to detect) in the advisory format.
0650. **Remediation-priority guidance** — give patch-priority guidance distinguishing internet-facing from internal deployments.
0651. **Detection-guidance section** — write log-based detection guidance for the vulnerability's exploitation.
0652. **IoC-list generation** — extract indicators (payload strings, callback domains) from the testing for defenders.
0653. **Snort-rule advisory annex** — attach IDS rules to advisories so network defenders get immediate value.
0654. **Scanner-signature suggestion** — suggest detection signatures so scanner vendors cover the new bug class.
0655. **Hardening-guide extract** — extract a hardening guide chapter from the advisory's root-cause analysis.
0656. **Lessons-learned writeup** — write a blameless lessons-learned from the vulnerability's introduction for engineering orgs.
0657. **Post-mortem template fill** — pre-fill a post-mortem template with the finding's timeline and contributing factors.
0658. **OKR-proposal for security** — propose security OKRs (reduce critical MTTR, coverage %) grounded in the hunt's metrics.
0659. **Security-roadmap input** — convert systemic findings into roadmap items (authz framework, secrets migration) with business cases.
0660. **Budget-justification appendix** — build the budget case (tooling, headcount) from the risk quantified in the report.
0661. **Hiring-profile suggestion** — suggest the security-hire profile (appsec, cloud) matching the finding distribution.
0662. **Training-investment case** — build the training business case from the recurring bug classes developers keep writing.
0663. **Tooling-gap analysis** — identify which existing tools should have caught each finding, exposing tooling gaps.
0664. **Process-improvement recommendations** — recommend process changes (threat modeling gates, security review SLAs) per finding cluster.
0665. **Metrics-program design** — design the client's ongoing security metrics (definitions, targets, dashboards) from the hunt's data.
0666. **Executive-summary TL;DR box** — put a 3-sentence TL;DR box at the very top answering: how bad, what first, what it costs.
0667. **Report-feedback collection form** — embed a feedback form link so report quality improves from reader input each cycle.
## U. Continuous hunting — monitoring, diff-based retest, regression hunts
0668. **Scheduled change-only re-scans** — run light scans on a schedule that test only assets and endpoints changed since the last hunt, cutting cost and noise.
0669. **Certificate-transparency new-subdomain alerts** — watch CT logs for newly issued certificates on the target's domains and auto-queue the hosts for recon within minutes.
0670. **JS-bundle diff monitoring** — diff production JavaScript bundles between fetches and flag new endpoints, API paths, and secrets introduced in updates.
0671. **API-schema drift detection** — compare OpenAPI/Swagger or inferred schemas across polls and alert when new operations or parameters appear.
0672. **TLS-certificate change alerts** — alert when certificates change unexpectedly (new CA, key, or SANs), the early signal of infrastructure moves or hijacks.
0673. **DNS-record change tracking** — track A/AAAA/CNAME/TXT changes per monitored domain and alert on dangling or suspicious new records.
0674. **Technology-stack change detection** — fingerprint headers, scripts, and meta generators on each poll and alert when frameworks or versions change.
0675. **Regression retesting of fixed vulns** — automatically replay the original PoC requests for previously fixed findings on every cycle and reopen on regression.
0676. **Dark-web mention monitoring** — monitor paste sites, forums, and marketplaces for the target's domains, credentials, or data with authorized OSINT tooling.
0677. **Dependency-change alerts** — watch lockfiles and SBOMs for new or updated dependencies and trigger targeted CVE-reachability checks on changes.
0678. **Third-party-script change alerts** — hash third-party scripts on key pages and alert when vendors swap code, the supply-chain tripwire.
0679. **CI-deploy webhook hunt triggers** — trigger focused hunts from deployment webhooks so every release gets tested within minutes of shipping.
0680. **Fix-SLA deadline tracking** — track per-finding fix deadlines by severity and escalate automatically when SLAs breach.
0681. **Bounty-scope change syncing** — poll program scope pages/APIs and auto-adjust monitoring targets when scope expands or shrinks.
0682. **Baseline-vs-current finding diffs** — diff each cycle's findings against the rolling baseline and report only new, fixed, and regressed items.
0683. **Quiet-mode continuous recon** — run low-and-slow passive recon (CT, DNS, OSINT) that never touches the target directly for always-on asset awareness.
0684. **Severity-routed alerting** — route critical alerts to paging channels and lows to digest emails so continuous hunting doesn't cause alert fatigue.
0685. **Hunt-cadence recommendations** — recommend per-asset scan cadence from change velocity and criticality (daily for payment APIs, weekly for blogs).
0686. **Historical trend dashboards feeds** — feed every cycle's metrics into trend dashboards showing risk trajectory over quarters.
0687. **Auto-pause on scope removal** — automatically pause monitoring for assets removed from scope to stay within authorization at all times.
0688. **New-endpoint discovery alerts** — alert when crawls discover previously unseen endpoints, the highest-signal change for bug hunters.
0689. **Removed-endpoint retirement notes** — note when endpoints disappear so stale findings get retired instead of lingering as false opens.
0690. **HTTP-header drift detection** — diff security headers per endpoint across polls and alert when protections silently weaken.
0691. **Cookie-attribute drift detection** — watch Set-Cookie attributes and alert when Secure/HttpOnly/SameSite flags disappear in deploys.
0692. **Robots/sitemap diff alerts** — diff robots.txt and sitemaps for newly disclosed paths worth probing.
0693. **WAF-signature change detection** — detect WAF rule changes via probe-response deltas and re-run bypass suites when defenses shift.
0694. **Open-port delta alerts** — alert on newly opened or closed ports per monitored host, the infrastructure-change signal.
0695. **Service-banner change alerts** — alert when service banners change versions, indicating upgrades or replacements to re-fingerprint.
0696. **ASN/IP-range move detection** — detect when assets move hosting providers and re-run network-layer checks on the new infra.
0697. **CDN-configuration drift alerts** — detect CDN rule changes (caching, WAF, redirects) via edge-behavior probes.
0698. **Load-balancer behavior drift** — monitor LB routing and stickiness for changes that alter request smuggling or cache behavior.
0699. **Origin-IP rediscovery loop** — periodically re-attempt origin discovery since infra changes expose new direct-origin paths.
0700. **Subdomain-takeover revalidation** — re-check previously safe subdomains on every cycle since DNS and service claims change constantly.
0701. **Expired-domain watch** — watch the organization's domains for expiry and alert before attackers can re-register them.
0702. **Lookalike-domain registration alerts** — alert on newly registered typosquat/homograph domains for phishing-takedown workflows.
0703. **Nameserver-change alerts** — alert on NS changes, the precursor to DNS hijacking.
0704. **DNSSEC-status monitoring** — track DNSSEC validation status and alert when signing breaks or disappears.
0705. **SPF/DKIM/DMARC drift alerts** — re-evaluate mail-authentication posture each cycle and alert on weakening records.
0706. **BIMI-record monitoring** — watch BIMI records since logo-verified mail changes phishing economics.
0707. **MTA-STS policy monitoring** — track MTA-STS policies for downgrades that re-enable mail interception.
0708. **Certificate-expiry forecasting** — forecast expirations 30/7/1 days out so outages and last-minute renewals never surprise.
0709. **Certificate-key-reuse detection** — detect key reuse across renewals and flag the reduced rotation hygiene.
0710. **Weak-cipher reintroduction alerts** — alert when previously remediated weak ciphers or protocols reappear after infra changes.
0711. **HSTS-header disappearance alerts** — alert when HSTS vanishes, re-exposing users to SSL-stripping.
0712. **CSP-weakening alerts** — diff Content-Security-Policy headers and alert on weakened directives after deploys.
0713. **SRI-hash mismatch alerts** — alert when subresource-integrity hashes stop matching, indicating tampered third-party code.
0714. **Feature-policy drift alerts** — watch permissions policies for newly enabled powerful features on sensitive pages.
0715. **CORS-policy drift alerts** — alert when CORS policies loosen (new origins, credentials) between cycles.
0716. **OAuth-client change detection** — monitor OAuth client registrations and redirect URIs for newly added risky entries.
0717. **API-key scope-drift detection** — detect when API keys gain broader scopes or lose expiry, the privilege-creep signal.
0718. **Webhook-endpoint change alerts** — track webhook registrations for attacker-added exfiltration endpoints.
0719. **SAML-metadata change alerts** — watch IdP/SP metadata for certificate or endpoint changes needing re-validation.
0720. **Session-timeout drift detection** — verify session lifetimes each cycle and alert when they lengthen silently.
0721. **Password-policy weakening alerts** — re-test password rules each cycle and alert on relaxed complexity or removed breach checks.
0722. **MFA-enforcement drift detection** — verify MFA enforcement on privileged roles continuously and alert on bypasses.
0723. **Rate-limit relaxation alerts** — re-measure rate limits each cycle and alert when protections loosen after scaling changes.
0724. **CAPTCHA-removal detection** — detect when CAPTCHAs disappear from abuse-sensitive flows, re-opening automation.
0725. **Bot-defense drift detection** — probe bot defenses each cycle and alert when detection weakens.
0726. **GraphQL-schema expansion alerts** — alert on new GraphQL types, queries, and mutations, the API-growth attack surface.
0727. **REST-route expansion alerts** — alert on new REST routes discovered via OPTIONS, docs, or JS diffs.
0728. **WebSocket-endpoint discovery alerts** — detect newly exposed WebSocket endpoints and queue them for hijacking tests.
0729. **gRPC-service expansion alerts** — alert on new gRPC services via reflection or traffic analysis.
0730. **Webhook-receiver discovery** — discover new inbound webhook receivers that may lack signature verification.
0731. **Admin-panel appearance alerts** — alert when new admin or debug interfaces appear on monitored hosts.
0732. **Debug-endpoint reappearance alerts** — alert when previously removed debug endpoints return after deploys.
0733. **Backup-file reappearance alerts** — alert when backup/archive files reappear in web roots.
0734. **Git-exposure rechecks** — re-check for .git exposure each cycle since deploys frequently reintroduce it.
0735. **Env-file exposure rechecks** — re-check for .env and config exposures on every cycle.
0736. **Swagger-exposure monitoring** — watch for API docs appearing in production, the reconnaissance gift to attackers.
0737. **Status-page change alerts** — monitor health/status endpoints for newly leaked internals.
0738. **Error-verbosity regression alerts** — detect when verbose errors return after being fixed, the classic regression.
0739. **Directory-listing reappearance alerts** — alert when directory listings re-enable on previously fixed paths.
0740. **Default-credential rechecks** — re-test default credentials on infrastructure logins each cycle.
0741. **Exposed-dashboard monitoring** — watch for newly exposed Grafana/Kibana/K8s dashboards on the asset inventory.
0742. **Cloud-storage ACL rechecks** — re-evaluate bucket/object ACLs each cycle and alert on public re-exposure.
0743. **Cloud-logging gap rechecks** — verify audit logging stays enabled for monitored services and alert on blind spots.
0744. **IAM-policy drift alerts** — diff IAM policies each cycle and alert on privilege expansions.
0745. **Security-group drift alerts** — alert on security-group rules opening new ingress, especially 0.0.0.0/0.
0746. **Container-image change alerts** — alert on base-image or layer changes and re-run container-escape precondition checks.
0747. **K8s-RBAC drift alerts** — diff RBAC bindings each cycle and alert on new cluster-admin grants.
0748. **CI-secret rotation verification** — verify CI secrets rotate on schedule and alert on stale long-lived tokens.
0749. **Workflow-permission drift alerts** — watch CI workflow permissions for newly granted write access.
0750. **Artifact-retention monitoring** — verify build artifacts don't accumulate secrets and alert on exposed logs.
0751. **Package-publish monitoring** — watch the org's package namespaces for unauthorized publishes indicating compromise.
0752. **Dependency-vulnerability re-evaluation** — re-run reachability analysis when new CVEs publish against the monitored SBOM.
0753. **Transitive-dependency alerts** — alert when transitive dependencies introduce new vulnerable code paths.
0754. **License-change alerts** — alert on dependency license changes that create legal risk, the non-security drift worth tracking.
0755. **Vendor-breach correlation** — correlate vendor breach disclosures against the monitored third-party inventory automatically.
0756. **Subprocessor-change alerts** — track subprocessor lists for changes affecting data-processing compliance.
0757. **Privacy-policy change diffing** — diff privacy policies and alert on weakened data-handling commitments.
0758. **Cookie-banner behavior monitoring** — verify consent banners still block tracking pre-consent after site updates.
0759. **Tracker-inventory drift** — inventory third-party trackers each cycle and alert on new data recipients.
0760. **Data-retention verification** — periodically verify deletion endpoints truly delete, catching soft-delete regressions.
0761. **Export-feature abuse monitoring** — monitor bulk-export features for new unauthenticated or unthrottled access.
0762. **Search-endpoint enumeration monitoring** — watch search APIs for newly enumerable indexes or leaked filters.
0763. **Pagination-bypass regression checks** — re-test pagination limits each cycle since refactors often drop them.
0764. **IDOR-regression sweep** — re-run the IDOR test battery against previously fixed objects on every cycle.
0765. **Authz-matrix revalidation** — re-validate the role×resource authorization matrix each cycle and alert on new gaps.
0766. **Mass-assignment regression checks** — re-test previously fixed mass-assignment parameters after framework upgrades.
0767. **Business-logic invariant checks** — encode business invariants (price ≥ 0, balance consistency) as continuous assertions.
0768. **Payment-flow tamper rechecks** — re-run payment-tampering probes after every checkout-code deploy.
0769. **Coupon-logic regression checks** — re-test promo-code stacking after marketing-code changes.
0770. **Workflow-step-skipping rechecks** — re-test multi-step workflow enforcement after flow refactors.
0771. **Race-condition re-probing** — re-probe previously fixed race windows since concurrency refactors reopen them.
0772. **Cache-poisoning rechecks** — re-run cache-poisoning probes after CDN or cache-key changes.
0773. **Header-injection rechecks** — re-test header-injection points after framework or proxy upgrades.
0774. **Redirect-validation rechecks** — re-test open-redirect allowlists after URL-handling refactors.
0775. **Upload-validation rechecks** — re-test file-upload controls after storage or handler changes.
0776. **SSRF-guard revalidation** — re-test SSRF protections after HTTP-client library upgrades.
0777. **XXE-parser rechecks** — re-verify XML parser hardening after library updates.
0778. **Deserialization-guard rechecks** — re-test deserialization endpoints after serializer upgrades.
0779. **JWT-validation regression checks** — re-run algorithm-confusion and expiry tests after auth-library upgrades.
0780. **Session-fixation rechecks** — verify session rotation on login still holds after session-store changes.
0781. **2FA-bypass regression suite** — re-run the 2FA bypass battery after authentication-flow refactors.
0782. **Password-reset regression checks** — re-test reset-token entropy and expiry after auth changes.
0783. **Account-enumeration rechecks** — verify enumeration oracles stay closed after login-error-message redesigns.
0784. **Credential-stuffing defense rechecks** — re-measure lockout and throttling after auth-scaling changes.
0785. **OAuth-flow regression suite** — re-test redirect-uri validation and PKCE after identity-provider changes.
0786. **SAML-assertion revalidation** — re-validate SAML signature and audience checks after IdP metadata updates.
0787. **API-versioning sunset monitoring** — watch deprecated API versions for lingering availability past sunset dates.
0788. **Deprecated-endpoint lingering alerts** — alert when deprecated endpoints remain reachable, the forgotten attack surface.
0789. **Feature-flag exposure monitoring** — detect feature flags leaking unreleased functionality to production traffic.
0790. **Beta-endpoint monitoring** — watch beta/staging-labeled endpoints in production for weaker controls.
0791. **Canary-deploy security diffing** — diff security posture between canary and stable during rollouts to catch regressions early.
0792. **Blue-green parity checks** — verify security controls match across blue/green environments before traffic switches.
0793. **Multi-region parity monitoring** — verify security headers, WAF rules, and auth behave identically across regions.
0794. **Edge-vs-origin parity checks** — verify edge behavior matches origin expectations so CDN misconfigurations surface.
0795. **Mobile-API parity monitoring** — verify mobile backends keep pace with web security fixes across releases.
0796. **Partner-API change alerts** — monitor partner-facing APIs for changes since they carry third-party trust.
0797. **Public-API deprecation notices** — track public API deprecations so hunters retest migration endpoints.
0798. **SDK-release monitoring** — watch official SDK releases for new endpoints and auth patterns to test.
0799. **Changelog-driven test planning** — parse release changelogs and auto-plan tests for the security-relevant changes listed.
0800. **GitHub-release watch** — monitor the org's public repos for releases that change the attack surface.
0801. **Container-registry watch** — watch public image tags for new releases needing image-layer analysis.
0802. **Infrastructure-as-code drift alerts** — diff live cloud state against IaC definitions and alert on out-of-band changes.
0803. **Manual-console-change detection** — detect console-made cloud changes that bypass IaC review, the shadow-admin signal.
0804. **Backup-policy drift alerts** — verify backup schedules and retention still meet policy each cycle.
0805. **Disaster-recovery test tracking** — track whether DR tests actually ran on schedule and alert on skipped tests.
0806. **Incident-response contact freshness** — verify escalation contacts and runbooks are current each quarter.
0807. **Playbook-staleness alerts** — alert when IR playbooks reference decommissioned systems or contacts.
0808. **Threat-intel feed correlation** — correlate new threat-intel (exploited CVEs, ransomware TTPs) against the monitored stack automatically.
0809. **Exploit-publication tripwire** — trigger immediate retests when public exploits publish for the target's software versions.
0810. **Ransomware-target profiling** — re-score assets when ransomware groups shift targeting to the client's sector.
0811. **APT-campaign correlation** — correlate sector-targeted APT campaigns against the monitored infrastructure.
0812. **Zero-day rumor triage** — triage zero-day rumors for the target's stack and pre-position detection before patches land.
0813. **Patch-Tuesday impact analysis** — analyze each Patch Tuesday for the monitored stack and prioritize verification tests.
0814. **Emergency-patch verification** — verify out-of-band patches actually deployed correctly across the fleet.
0815. **Patch-rollback detection** — detect when patches get rolled back, re-exposing the vulnerability silently.
0816. **Vulnerability-age tracking** — track days-since-disclosure for unpatched known CVEs in the stack, the patch-debt metric.
0817. **Mean-time-to-remediate tracking** — measure MTTR per severity across cycles for the trend dashboard.
0818. **Finding-recurrence tracking** — track how often the same bug class recurs after fixes, the systemic-issue indicator.
0819. **Fix-verification pass rates** — measure what fraction of fixes pass first retest, the engineering-quality signal.
0820. **Coverage-growth tracking** — track asset and endpoint coverage growth per cycle to prove expanding protection.
0821. **Scan-health monitoring** — monitor the hunters themselves (blocked IPs, CAPTCHAs, WAF bans) and alert on degraded visibility.
0822. **Credential-health checks** — verify test credentials still work each cycle and alert on expired test accounts.
0823. **Scope-document freshness** — verify the scope document matches reality and flag drift for program owners.
0824. **Authorization-letter expiry alerts** — alert before testing authorizations expire so hunting never lapses into unauthorized territory.
0825. **Rules-of-engagement change sync** — sync RoE updates (new forbidden techniques, windows) into every scheduled hunt automatically.
0826. **Maintenance-window awareness** — pause intrusive tests during client maintenance windows parsed from status pages.
0827. **Rate-budget management** — manage request budgets per target so continuous hunting never resembles a DoS.
0828. **Politeness-backoff automation** — auto-throttle when targets show stress signals (5xx spikes, latency growth).
0829. **Distributed-scan coordination** — coordinate scan sources to avoid duplicate traffic and respect per-source limits.
0830. **Result-deduplication across cycles** — deduplicate findings across cycles with stable fingerprints so trends aren't inflated.
0831. **Finding-lifecycle state machine** — track new → open → fixed → verified → closed states per finding across cycles.
0832. **Stale-finding auto-expiry** — expire findings for decommissioned assets instead of carrying them forever.
0833. **Reopened-finding forensics** — capture the diff that reopened a finding (code change, config revert) for root-cause analysis.
0834. **Flaky-finding quarantine** — quarantine intermittently-reproducible findings into a separate review list instead of flapping states.
0835. **Confidence-decay over time** — decay confidence scores for findings not re-verified recently, reflecting staleness honestly.
0836. **Evidence-refresh scheduling** — schedule evidence re-capture for aging findings so reports never show stale screenshots.
0837. **Retest-priority queue** — prioritize retests by severity, SLA urgency, and regression likelihood each cycle.
0838. **Risk-based cycle planning** — allocate each cycle's test budget by current risk scores, not by round-robin.
0839. **Change-triggered micro-hunts** — launch 15-minute focused hunts on exactly the changed surface instead of waiting for the next full cycle.
0840. **Full-baseline quarterly hunts** — run comprehensive baseline hunts quarterly to catch what change-focused cycles miss.
0841. **Adversary-emulation spot checks** — run short emulation scenarios (phishing-adjacent, token theft) between cycles for realism.
0842. **Red-team objective rotation** — rotate simulated objectives (steal PII, mint funds, persist) so continuous hunting covers diverse goals.
0843. **Purple-team sync points** — schedule blue-team syncs where continuous-hunt findings become detection-engineering tasks.
0844. **Executive cadence reporting** — auto-send executive summaries on the cadence leaders expect (monthly), not per-scan.
0845. **Developer digest emails** — send developers per-team digests of new findings in their services only.
0846. **Compliance-calendar alignment** — align deep hunts with audit calendars so evidence is fresh for assessments.
0847. **Pen-test handoff packages** — package continuous-hunt context (coverage maps, open chains) for periodic manual pen tests.
0848. **Bug-bounty triage assistance** — feed continuous-hunt evidence into bounty triage to validate external reports faster.
0849. **Duplicate-prediction for bounty** — predict whether an external report duplicates known continuous-hunt findings before triage.
0850. **Safe-harbor compliance logging** — log all continuous activity against safe-harbor terms for legal defensibility.
0851. **Data-minimization enforcement** — enforce minimal evidence collection in continuous mode (no bulk PII pulls) automatically.
0852. **Evidence-retention policies** — auto-purge old evidence per retention policy while keeping finding metadata.
0853. **Cross-border data handling** — route evidence storage per data-residency rules for multinational targets.
0854. **Client-notification thresholds** — notify clients immediately only above configured severity/change thresholds.
0855. **False-alarm learning loop** — feed dismissed alerts back to tune thresholds, cutting repeat noise.
0856. **Alert-quality scoring** — score each alert on actionability and tune the pipeline toward high-signal notifications.
0857. **Seasonal-traffic awareness** — adjust baselines for seasonal traffic (sales, holidays) so alerts don't fire on normal spikes.
0858. **Deploy-freeze awareness** — intensify monitoring during deploy freezes when changes should be zero.
0859. **Incident-correlation** — correlate monitoring alerts with the client's incident feed to avoid duplicate investigations.
0860. **Status-page cross-checking** — cross-check anomalies against the client's status page before alerting on outages.
0861. **Multi-target portfolio view** — roll up continuous-hunt status across all monitored targets into one portfolio dashboard.
0862. **Program-health scoring** — score each monitored program's health (coverage, MTTR, recurrence) for comparative management.
0863. **Cost-per-finding tracking** — track hunting cost per validated finding to optimize cycle budgets.
0864. **Automation-coverage metrics** — measure what fraction of the test battery runs continuously versus needs manual work.
0865. **Manual-spot-check scheduling** — schedule human spot-checks on automation blind spots each quarter.
0866. **New-technique rollout** — roll new testing techniques into continuous cycles with A/B validation against baselines.
0867. **Retired-technique pruning** — retire techniques that stop producing findings to keep cycles lean.
0868. **Engine-performance tracking** — track per-engine precision/recall in continuous mode and rebalance accordingly.
0869. **Canary-target validation** — validate pipeline changes against canary targets before fleet-wide rollout.
0870. **Rollback-on-degradation** — auto-rollback pipeline updates that degrade finding quality metrics.
0871. **A/B testing of probes** — A/B test new probes on split traffic to measure FP impact before full deployment.
0872. **Shadow-mode new checks** — run new checks in shadow mode (log-only) until precision is proven.
0873. **Gradual-rollout scheduling** — roll out intrusive new tests gradually across the portfolio.
0874. **Target-feedback incorporation** — incorporate client feedback (false alarms, missed areas) into cycle plans automatically.
0875. **Coverage-attestation reports** — generate per-cycle attestation of what was tested for compliance files.
0876. **Continuous-compliance evidence** — stream control evidence continuously instead of assembling it at audit time.
0877. **Audit-window deep dives** — trigger deeper hunts automatically ahead of known audit windows.
0878. **Certification-maintenance tracking** — track the ongoing testing evidence needed to maintain certifications.
0879. **Insurance-renewal evidence packs** — assemble renewal evidence packs from continuous-hunt history automatically.
0880. **Board-report automation** — auto-generate board-ready security updates from the continuous pipeline each quarter.
0881. **OKR-progress tracking** — track security OKRs (MTTR, coverage, recurrence) from live pipeline data.
0882. **Risk-appetite alignment checks** — flag when residual risk exceeds the stated appetite, triggering exception workflows.
0883. **Exception-workflow tracking** — track risk acceptances with expiry dates and re-test on expiry.
0884. **Waiver-expiry alerts** — alert when security waivers expire so accepted risks get re-evaluated.
0885. **Compensating-control effectiveness checks** — continuously verify compensating controls still mitigate the accepted risks.
0886. **Third-party attestation monitoring** — track vendor SOC 2/ISO certificate expiries in the supply-chain inventory.
0887. **Contract-security-clause tracking** — monitor contract security requirements against actual control evidence.
0888. **Acquisition-target monitoring** — extend lightweight monitoring to acquisition targets during due diligence.
0889. **Divestiture-scope cleanup** — automatically remove divested assets from monitoring on deal close.
0890. **Joint-venture asset onboarding** — auto-onboard joint-venture assets with scoped authorization tracking.
0891. **Subsidiary-discovery sweeps** — periodically sweep for unmonitored subsidiaries via corporate-registry and CT data.
0892. **Brand-protection monitoring** — monitor app-store and social listings for fake apps abusing the brand continuously.
0893. **Fake-app takedown workflow** — trigger takedown workflows with evidence packs when impersonating apps appear.
0894. **Phishing-kit reuse tracking** — track phishing kits targeting the brand and extract their evolving TTPs.
0895. **Credential-dump correlation** — correlate new breach dumps against employee and customer credential hashes continuously.
0896. **Session-cookie leak monitoring** — watch paste sites and logs for leaked session tokens tied to the target.
0897. **API-key leak monitoring** — scan code-search and pastes for the org's API keys with authorized tooling.
0898. **Private-key leak monitoring** — watch for leaked private keys and certificates referencing the org's domains.
0899. **Database-dump monitoring** — alert when database dumps naming the org appear in underground sources.
0900. **Ransomware-leak-site monitoring** — watch ransomware leak sites for the org's name with authorized OSINT.
0901. **Extortion-email pattern tracking** — track extortion campaigns referencing the org's assets for early warning.
0902. **Executive-impersonation monitoring** — monitor for domains and accounts impersonating executives continuously.
0903. **Employee-targeted phishing tracking** — track phishing lures using the org's branding to harden mail defenses.
0904. **Helpdesk-social-engineering drills** — schedule authorized social-engineering resistance checks on support flows.
0905. **Callback-phishing number monitoring** — monitor for attacker phone numbers paired with the org's brand in lures.
0906. **QR-code lure tracking** — track malicious QR campaigns abusing the brand's visual identity.
0907. **Malicious-ad monitoring** — watch ad networks for malvertising using the org's creatives.
0908. **SEO-poisoning monitoring** — monitor search results for poisoned pages impersonating the org's services.
0909. **Typosquat-traffic estimation** — estimate traffic hitting typosquat domains to prioritize takedowns by victim count.
0910. **Homograph-attack monitoring** — continuously check for newly registered homograph domains of the brand.
0911. **Subdomain-reputation monitoring** — track blocklist and reputation signals for the org's subdomains.
0912. **IP-reputation monitoring** — monitor the org's IPs for blocklisting that signals compromise or abuse.
0913. **ASN-abuse monitoring** — watch for abuse reports tied to the org's netblocks.
0914. **BGP-hijack detection** — detect BGP anomalies affecting the org's prefixes via routing feeds.
0915. **Route-leak alerting** — alert on route leaks diverting the org's traffic unexpectedly.
0916. **DNS-hijack detection** — detect unauthorized DNS changes via multi-vantage resolution comparisons.
0917. **Registrar-lock verification** — verify registry/registrar locks stay enabled on critical domains.
0918. **Transfer-attempt alerting** — alert on domain transfer attempts, the takeover precursor.
0919. **WHOIS-change monitoring** — monitor WHOIS for unauthorized registrant or nameserver changes.
0920. **Privacy-proxy lapse alerts** — alert when WHOIS privacy lapses expose owner details.
0921. **Trademark-watch integration** — integrate trademark-watch feeds to catch infringing registrations early.
0922. **App-store impersonation sweeps** — sweep app stores periodically for impersonating apps.
0923. **Browser-extension impersonation checks** — check extension stores for malicious extensions mimicking the org's tools.
0924. **Package-namespace squat monitoring** — watch package registries for squats on the org's scope or names.
0925. **Container-image impersonation checks** — check registries for typosquat images of the org's official images.
0926. **Social-handle squat monitoring** — monitor social platforms for impersonating handles.
0927. **Verified-badge abuse tracking** — track fake verified accounts impersonating the org.
0928. **Deepfake-executive monitoring** — watch for deepfake media impersonating executives with authorized OSINT.
0929. **Voice-clone fraud monitoring** — track vishing campaigns using cloned executive voices.
0930. **Business-email-compromise pattern tracking** — track BEC lures referencing the org's vendors and executives.
0931. **Invoice-fraud pattern monitoring** — monitor for fake invoices using the org's branding in circulation.
0932. **Supply-chain email-compromise watch** — watch for compromised vendor mailboxes in the org's supply chain.
0933. **Vendor-impersonation monitoring** — monitor for domains impersonating key vendors.
0934. **Payment-redirection fraud tracking** — track payment-detail-change fraud targeting the org's customers.
0935. **Customer-support impersonation monitoring** — watch for fake support accounts targeting the org's users.
0936. **Crypto-scam brand-abuse tracking** — track giveaway scams abusing the brand's name and executives.
0937. **Fake-job-offer monitoring** — monitor for recruitment scams using the org's brand.
0938. **Romance-scam brand-abuse tracking** — track scams misusing employee identities where feasible.
0939. **Review-manipulation monitoring** — monitor for coordinated fake reviews targeting or praising the org manipulatively.
0940. **Disinformation-narrative tracking** — track false narratives about the org's security incidents for response readiness.
0941. **Breach-rumor verification** — rapidly verify or debunk breach rumors with evidence from continuous monitoring.
0942. **Media-mention security triage** — triage security-relevant press mentions for required responses.
0943. **Researcher-report intake monitoring** — watch disclosure channels for incoming researcher reports needing triage.
0944. **Hall-of-fame freshness** — verify the disclosure hall-of-fame stays updated to encourage researchers.
0945. **Disclosure-policy accessibility checks** — verify security.txt and disclosure pages stay reachable and current.
0946. **security.txt monitoring** — monitor security.txt for valid contacts, expiry, and policy alignment.
0947. **PGP-key freshness checks** — verify published PGP keys haven't expired so researchers can encrypt reports.
0948. **Bug-bounty scope-page monitoring** — watch the program's scope page for changes affecting continuous authorization.
0949. **Bounty-table change alerts** — alert when payout tables change so hunting priorities re-rank accordingly.
0950. **Program-brief update syncing** — sync brief updates (new targets, rules) into the continuous-hunt configuration.
0951. **Safe-harbor wording monitoring** — watch for safe-harbor changes that alter legal protection for continuous testing.
0952. **SLA-commitment tracking** — track the program's triage SLAs to predict payout timelines per finding.
0953. **Triage-pattern learning** — analyze triage outcomes over time to focus continuous hunting on accepted bug classes.
0954. **Payout-benchmark tracking** — track payout benchmarks per bug class to prioritize high-value continuous tests.
0955. **Duplicate-rate monitoring** — monitor duplicate rates per technique to retire over-farmed approaches.
0956. **Signal-to-noise reporting** — report the continuous pipeline's signal ratio to stakeholders each month.
0957. **Hunter-productivity analytics** — measure validated findings per hunt-hour to guide technique investment.
0958. **Technique-yield tracking** — track yield per technique over time and sunset declining ones.
0959. **Coverage-per-dollar metrics** — measure monitored assets per dollar to justify continuous-hunt budgets.
0960. **Risk-reduction attribution** — attribute risk-score reductions to specific fixes for ROI storytelling.
0961. **Prevented-breach estimation** — estimate breach likelihood reduction from continuous hunting for executive reporting.
0962. **Competitor-posture benchmarking** — benchmark continuous metrics against sector peers where data allows.
0963. **Maturity-progression tracking** — track security-maturity progression quarter over quarter from pipeline data.
0964. **Control-effectiveness trending** — trend control-effectiveness scores to show defense improvements.
0965. **Attack-surface growth tracking** — track attack-surface size over time so growth gets deliberate security investment.
0966. **Shadow-IT shrink tracking** — measure shadow-IT discovery and remediation rates as a governance KPI.
0967. **Mean-time-to-detect tracking** — measure detection speed for newly introduced issues, the continuous-hunting headline metric.
0968. **New-finding half-life** — track how quickly new findings get fixed, the responsiveness metric.
0969. **Critical-path clearance tracking** — track time to clear critical attack paths specifically, the metric boards care about.
0970. **Compliance-drift alerting** — alert when continuous evidence shows controls drifting from compliant states.
0971. **Control-regression alerts** — alert immediately when a previously passing control starts failing.
0972. **Evidence-chain integrity** — hash and timestamp every evidence artifact so continuous findings are court-defensible.
0973. **Chain-of-custody logging** — log every evidence access for forensic-grade accountability.
0974. **Tamper-evident finding records** — make finding records tamper-evident so fix disputes resolve on facts.
0975. **Multi-party finding sign-off** — support hunter, reviewer, and client sign-off states per finding lifecycle.
0976. **Dispute-resolution workflow** — provide a structured dispute flow with evidence comparison for contested findings.
0977. **Independent-verification sampling** — randomly sample findings for independent re-verification to audit pipeline accuracy.
0978. **Blind re-verification** — re-verify samples without showing the original verdict to prevent confirmation bias.
0979. **Inter-rater reliability tracking** — track agreement rates between reviewers to calibrate triage consistency.
0980. **Reviewer-calibration exercises** — inject known findings periodically to calibrate reviewer strictness.
0981. **Escalation-path testing** — test that critical alerts actually reach humans via scheduled canary alerts.
0982. **On-call rotation syncing** — sync alert routing with the client's on-call rotations automatically.
0983. **War-room auto-creation** — auto-create incident channels with finding context when critical regressions appear.
0984. **Stakeholder-notification matrix** — maintain who gets notified for each finding class and severity.
0985. **Communication-template library** — keep pre-approved notification templates for each alert type.
0986. **Post-incident hunting surge** — automatically intensify hunting on related assets after a client incident.
0987. **Lessons-learned automation** — convert incidents into new continuous checks so the same class never recurs silently.
0988. **Threat-model refresh triggers** — trigger threat-model reviews when continuous hunting reveals new attacker paths.
0989. **Architecture-review triggers** — trigger architecture reviews when systemic finding clusters emerge.
0990. **Security-champion notifications** — notify embedded champions of new findings in their domains for faster fixes.
0991. **Fix-pairing suggestions** — suggest pairing similar findings so one code change fixes the whole cluster.
0992. **Refactor-opportunity flagging** — flag when finding clusters indicate a component needs refactoring, not patching.
0993. **Tech-debt security tagging** — tag security findings into the client's tech-debt backlog with risk weights.
0994. **Sprint-planning integration** — export prioritized findings into sprint-planning formats with effort estimates.
0995. **Release-gate integration** — block releases automatically when critical regressions appear in pre-prod continuous hunts.
0996. **Progressive-delivery gates** — gate canary promotions on security-check pass rates.
0997. **Feature-flag kill switches** — recommend kill switches for risky features that continuous hunting flags.
0998. **Dark-launch security review** — auto-review dark-launched features for security before public exposure.
0999. **Launch-readiness scoring** — score launch readiness from continuous-hunt results for go/no-go decisions.
1000. **Continuous-hunt annual review** — compile the year's continuous-hunt data into an annual security-posture review for leadership.
