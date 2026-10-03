# Knowledge base (58005–59004)
58005. **Per-CWE encyclopedia entry pages** — dedicated page for every relevant CWE with definition, defensive context, and detection notes in one place.
58006. **CWE entry code examples before-and-after** — each entry ships a vulnerable snippet paired with a fixed snippet in the affected language.
58007. **CWE entry CVSS vector explainer** — interactive breakdown showing how each CVSS metric was scored for the entry's canonical example.
58008. **CWE entry affected-version tables** — version ranges of common frameworks/libraries historically prone to the weakness, with sources.
58009. **CWE entry "how the agent detects this" field** — plain-language note on which Dark-Matter engines and signals flag the weakness.
58010. **CWE entry MITRE ATT&CK cross-links** — each entry maps to the ATT&CK techniques the weakness enables for defenders.
58011. **CWE entry printable one-page cards** — downloadable single-page reference card per CWE for team briefings and reviews.
58012. **CWE relationship graph viewer** — visual graph of parent/child/peer CWE links with click-through navigation.
58013. **CWE entry severity rationale notes** — short write-up explaining why the entry carries its default severity band.
58014. **CWE entry platform tags** — web, API, mobile, cloud, and IoT tags so readers filter entries by their stack.
58015. **CWE entry language tags** — affected-language badges (PHP, Java, Node.js, Python, Go, Ruby) per entry.
58016. **CWE entry difficulty tags** — beginner/intermediate/advanced comprehension labels to guide reading order.
58017. **CWE entry prevalence statistics** — anonymized aggregate counts of how often the weakness appears across hunts.
58018. **CWE entry disclosure history timelines** — timeline of notable public disclosures illustrating the weakness over time.
58019. **CWE entry revision history** — dated changelog per entry showing what was corrected or expanded.
58020. **CWE entry feedback widget** — per-entry "was this helpful" rating that feeds editorial prioritization.
58021. **CWE entry bookmarking** — save entries to a personal reading list synced across devices.
58022. **CWE entry canonical URLs** — stable shareable links for every entry, safe to cite in reports and tickets.
58023. **CWE entry JSON API** — machine-readable entry data for integrations with ticketing and GRC tools.
58024. **CWE entry RSS update feed** — subscribe to new or materially updated entries by category.
58025. **CWE entry review SLA badges** — visible "reviewed on" date and next-review target per entry.
58026. **CWE entry ownership assignment** — named editor accountable for each entry's accuracy and freshness.
58027. **CWE entry approval workflow** — draft → technical review → publish pipeline before public visibility.
58028. **CWE entry QA checklist** — mandatory checks (examples compile, links live, severity justified) before publish.
58029. **CWE entry readability scores** — automated grade-level score with a target band for non-specialist readers.
58030. **CWE entry contributor attribution** — named credits for researchers who authored or improved an entry.
58031. **CWE entry translation status** — badge showing which languages the entry is available in.
58032. **CWE entry export-to-PDF** — one-click PDF of the full entry with formatting preserved for offline use.
58033. **CWE entry related-findings mapping** — how Dark-Matter finding types roll up to each CWE for traceability.
58034. **CWE-79 XSS encyclopedia entry** — canonical stored/reflected/DOM XSS entry with sanitization-pattern examples.
58035. **CWE-89 SQL injection encyclopedia entry** — canonical SQLi entry covering parameterized-query defenses per stack.
58036. **CWE-78 OS command injection entry** — entry on shell-invocation risks with allowlist and API-avoidance guidance.
58037. **CWE-94 code injection entry** — entry on dynamic code evaluation with safe-alternative patterns.
58038. **CWE-20 improper input validation entry** — entry on allowlisting, canonicalization, and validation layering.
58039. **CWE-22 path traversal entry** — entry on directory traversal with safe path-resolution examples.
58040. **CWE-200 information exposure entry** — entry on verbose errors, stack traces, and debug endpoints in production.
58041. **CWE-306 missing authentication entry** — entry on unauthenticated endpoints with authz-matrix review guidance.
58042. **CWE-287 improper authentication entry** — entry on broken login flows with MFA and session guidance.
58043. **CWE-352 CSRF encyclopedia entry** — entry on cross-site request forgery with token and SameSite defenses.
58044. **CWE-611 XXE encyclopedia entry** — entry on XML external entities with parser-hardening snippets.
58045. **CWE-918 SSRF encyclopedia entry** — entry on server-side request forgery with egress-filtering defenses.
58046. **CWE-798 hardcoded credentials entry** — entry on embedded secrets with vault-rotation remediation steps.
58047. **CWE-502 deserialization entry** — entry on insecure deserialization with integrity-check patterns.
58048. **CWE-862 missing authorization entry** — entry on absent access checks with policy-enforcement examples.
58049. **CWE-863 incorrect authorization entry** — entry on flawed permission logic with test matrices.
58050. **CWE-434 file upload entry** — entry on unrestricted uploads with type/extension/content validation.
58051. **CWE-639 authz bypass via user key entry** — entry on IDOR-style flaws with indirect-reference patterns.
58052. **CWE-732 permission assignment entry** — entry on overly broad permissions with least-privilege baselines.
58053. **CWE-917 expression language injection entry** — entry on template/EL injection with sandboxing guidance.
58054. **CWE-295 certificate validation entry** — entry on improper cert checks with pinning and verification code.
58055. **CWE-327 risky cryptography entry** — entry on broken/weak algorithms with modern-suite migration tables.
58056. **CWE-328 weak hash entry** — entry on unsalted/fast hashes with Argon2/bcrypt migration guidance.
58057. **CWE-330 insufficient randomness entry** — entry on predictable tokens with CSPRNG usage examples.
58058. **CWE-829 untrusted inclusion entry** — entry on including functionality from untrusted sources safely.
58059. **CWE-601 open redirect entry** — entry on unvalidated redirects with allowlist patterns.
58060. **CWE-918-related DNS rebinding note** — entry annex on DNS rebinding as an SSRF-adjacent defensive topic.
58061. **CWE-384 session fixation entry** — entry on session fixation with regeneration-on-login examples.
58062. **CWE-614 sensitive cookie without Secure entry** — entry on cookie flags with framework-specific config snippets.
58063. **CWE-1004 sensitive cookie without HttpOnly entry** — entry on HttpOnly usage with deployment checklists.
58064. **CWE-1270 generation of weak tokens entry** — entry on token entropy with rotation policy guidance.
58065. **CWE-1341 info leak via DNS entry** — defensive note on DNS-based data exposure in the encyclopedia.
58066. **CWE-770 allocation without limits entry** — entry on resource-exhaustion guards with rate-limit patterns.
58067. **CWE-400 uncontrolled resource consumption entry** — entry on DoS-via-input with timeout and quota designs.
58068. **CWE-404 improper resource shutdown entry** — entry on connection/handle leaks with cleanup patterns.
58069. **CWE-770-adjacent regex DoS annex** — annex on catastrophic backtracking with safe-regex guidance.
58070. **CWE-918-adjacent cloud metadata note** — defensive note on cloud metadata endpoints in SSRF context.
58071. **CWE-918-adjacent webhook validation note** — note on validating inbound webhooks alongside SSRF defenses.
58072. **CWE-20-adjacent mass assignment note** — annex on mass-assignment with explicit binding allowlists.
58073. **CWE-200-adjacent verbose banner note** — annex on service banner/version disclosure minimization.
58074. **CWE-307 brute-force entry** — entry on auth rate-limiting and account lockout design.
58075. **CWE-521 weak password requirements entry** — entry on password policy with NIST-aligned guidance.
58076. **CWE-256 plaintext storage entry** — entry on unencrypted credential storage with KMS migration steps.
58077. **CWE-311 missing encryption entry** — entry on sensitive data in transit with TLS-enforcement checklists.
58078. **CWE-319 cleartext transmission entry** — entry on plaintext protocols with upgrade-path guidance.
58079. **CWE-312 cleartext storage entry** — entry on secrets at rest with envelope-encryption patterns.
58080. **CWE-532 log injection entry** — entry on log forging with structured-logging defenses.
58081. **CWE-117 log neutralization entry** — entry on log-output neutralization with encoder examples.
58082. **CWE-209 error message info leak entry** — entry on error handling with safe-error design patterns.
58083. **CWE-548 directory listing entry** — entry on exposed listings with server-config fixes.
58084. **CWE-538 file path disclosure entry** — entry on path disclosure with config-hardening steps.
58085. **CWE-359 privacy violation entry** — entry on PII exposure with data-minimization checklists.
58086. **CWE-201 insertion of sensitive data entry** — entry on secrets in sent data with redaction patterns.
58087. **CWE-212 cross-boundary removal entry** — entry on improper sanitization across trust boundaries.
58088. **CWE-213 intentional info exposure entry** — entry on deliberate-but-risky exposure with review gates.
58089. **CWE entry newcomer onboarding path** — curated reading order of 12 entries for new security hires.
58090. **Per-finding-type remediation guides** — one authoritative fix guide linked from every Dark-Matter finding type.
58091. **Stack-specific remediation variants** — Node.js, Django, Laravel, Rails, and Spring variants of each fix guide.
58092. **Remediation guide difficulty ratings** — effort labels (quick fix / sprint / architecture change) per guide.
58093. **Remediation guide code diffs** — minimal diffs showing exactly what changes to ship the fix.
58094. **Remediation guide test plans** — regression-test steps proving the fix works and nothing broke.
58095. **Remediation guide rollback notes** — how to safely revert each fix if it causes side effects.
58096. **Remediation guide compliance mapping** — PCI DSS, SOC 2, and ISO 27001 control mappings per guide.
58097. **Remediation guide SLA suggestions** — recommended fix timelines by severity with business justification.
58098. **Remediation guide owner roles** — suggested owning team (backend, infra, mobile) per finding type.
58099. **XSS remediation guide** — output-encoding, CSP, and framework auto-escaping fixes in one place.
58100. **SQLi remediation guide** — parameterized queries, ORM usage, and least-privilege DB accounts.
58101. **IDOR remediation guide** — server-side authorization checks with object-level policy examples.
58102. **SSRF remediation guide** — allowlisting, egress filtering, and metadata-endpoint blocking.
58103. **XXE remediation guide** — disabling external entities per parser with config snippets.
58104. **CSRF remediation guide** — token patterns, SameSite cookies, and double-submit options.
58105. **Open redirect remediation guide** — allowlist-based redirect validation with framework helpers.
58106. **Path traversal remediation guide** — canonicalization and chroot-style containment patterns.
58107. **File upload remediation guide** — content-type sniffing, randomized names, and isolated storage.
58108. **Deserialization remediation guide** — signed tokens and schema-validated formats instead of native objects.
58109. **XXE-to-SSRF chained fix guide** — combined parser and egress hardening for chained weaknesses.
58110. **JWT remediation guide** — algorithm allowlists, expiry enforcement, and key-rotation procedures.
58111. **CORS remediation guide** — strict origin allowlists with credentialed-request rules.
58112. **Hardcoded secrets remediation guide** — vault adoption, rotation runbooks, and git-history cleanup.
58113. **Broken auth remediation guide** — MFA rollout, session invalidation, and brute-force defenses.
58114. **Sensitive data exposure guide** — field-level encryption and response-filtering checklists.
58115. **Missing rate limiting guide** — per-endpoint throttling design with gateway config examples.
58116. **Verbose error remediation guide** — safe error envelopes with correlation IDs for debugging.
58117. **Insecure direct object reference guide** — capability URLs versus server-side checks compared.
58118. **Subdomain takeover remediation guide** — DNS audit runbook with dangling-record cleanup steps.
58119. **Clickjacking remediation guide** — frame-ancestors CSP and X-Frame-Options deployment.
58120. **MIME sniffing remediation guide** — nosniff headers and content-type discipline.
58121. **Insecure TLS remediation guide** — TLS 1.2+ enforcement with cipher-suite baselines.
58122. **Certificate validation guide** — pinning and chain-verification code per platform.
58123. **Weak crypto remediation guide** — migration tables from legacy algorithms to modern suites.
58124. **Password storage guide** — Argon2/bcrypt adoption with pepper and upgrade-on-login patterns.
58125. **Session management guide** — secure flags, rotation, and absolute/idle timeout design.
58126. **OAuth misconfiguration guide** — redirect-URI validation and PKCE enforcement steps.
58127. **API key exposure guide** — scoped keys, rotation, and server-side proxying patterns.
58128. **GraphQL abuse remediation guide** — depth limits, cost analysis, and field-level authz.
58129. **NoSQL injection guide** — operator-injection defenses with typed query builders.
58130. **LDAP injection remediation guide** — escaping and parameterized directory queries.
58131. **XPath injection remediation guide** — compiled expressions with variable binding.
58132. **Template injection remediation guide** — sandboxing and logic-less template choices.
58133. **EL injection remediation guide** — expression-language hardening per engine.
58134. **Log injection remediation guide** — structured logging with field encoding.
58135. **HTTP header injection guide** — CRLF-safe header APIs and validation.
58136. **Host header poisoning guide** — absolute-URL allowlists and trusted-host middleware.
58137. **Cache poisoning remediation guide** — key normalization and unkeyed-input auditing.
58138. **Race condition remediation guide** — atomic operations and idempotency-key patterns.
58139. **Business logic flaw guide** — invariant documentation and negative-test design.
58140. **Mass assignment remediation guide** — explicit binding allowlists per framework.
58141. **Insecure randomness guide** — CSPRNG adoption with token-entropy checklists.
58142. **Time-based attack guide** — constant-time comparisons for secrets and tokens.
58143. **Information disclosure guide** — response auditing and debug-flag inventories.
58144. **Directory listing guide** — server config fixes with deployment verification.
58145. **Backup file exposure guide** — artifact cleanup and deploy-pipeline guards.
58146. **Git metadata exposure guide** — .git blocking rules and history-scrub procedures.
58147. **Debug endpoint guide** — environment-gated debug routes with access reviews.
58148. **Default credentials guide** — credential inventory and forced-rotation workflows.
58149. **Unpatched component guide** — dependency scanning cadence and upgrade playbooks.
58150. **Security misconfiguration guide** — baseline hardening checklists per server type.
58151. **Container escape hardening guide** — seccomp, read-only filesystems, and dropped capabilities.
58152. **Kubernetes RBAC guide** — least-privilege roles with audit-mode rollout.
58153. **Cloud storage exposure guide** — bucket policy audits with public-access blocks.
58154. **IAM privilege guide** — permission-boundary reviews with access-analyzer usage.
58155. **Secrets in CI guide** — masked variables and short-lived OIDC tokens.
58156. **Mobile insecure storage guide** — keychain/keystore usage with biometric gating.
58157. **Mobile deep-link guide** — verified links and intent-filter scoping.
58158. **Mobile cert pinning guide** — pinning implementation with backup-pin rotation.
58159. **WebView hardening guide** — JS-interface minimization and URL allowlists.
58160. **Biometric bypass guide** — fallback-auth design with attempt limits.
58161. **Remediation guide print packs** — bundled PDF packs per audit type (web, API, mobile).
58162. **Remediation guide ticket templates** — copy-ready Jira/Linear ticket text per guide.
58163. **Remediation guide acceptance criteria** — definition-of-done checklists for each fix.
58164. **Remediation guide effort estimator** — story-point guidance calibrated from anonymized fix data.
58165. **Remediation guide video walkthrough links** — each guide links its companion explainer video.
58166. **Remediation guide "ask the agent" prompts** — suggested Infinity AI prompts to draft the fix.
58167. **Remediation guide multilingual summaries** — key steps translated for distributed teams.
58168. **Remediation guide version badges** — framework-version applicability shown per snippet.
58169. **Remediation guide deprecation notices** — retired approaches marked with their replacements.
58170. **Remediation guide peer-review checklist** — what a reviewer should verify before approving the fix.
58171. **Remediation guide automated verification** — Dark-Matter re-test hooks confirming the fix holds.
58172. **Remediation guide false-fix warnings** — common incomplete fixes that look right but fail.
58173. **Remediation guide edge-case notes** — framework quirks where the standard fix needs adaptation.
58174. **Remediation guide link hub** — each guide cross-links encyclopedia entries, cheat sheets, and videos.
58175. **WordPress hardening knowledge notes** — wp-config lockdown, plugin audit cadence, and XML-RPC guidance.
58176. **WordPress plugin risk notes** — how to assess abandoned or low-install plugins before use.
58177. **WordPress user-enumeration notes** — REST/author-archive mitigations with config snippets.
58178. **Drupal hardening notes** — trusted-host patterns, update-manager discipline, and file permissions.
58179. **Joomla hardening notes** — admin-path obscurity limits and extension vetting checklists.
58180. **Laravel security notes** — mass-assignment guards, signed URLs, and queue-secret handling.
58181. **Django security notes** — settings hardening, CSRF/ORM defaults, and secret-key rotation.
58182. **Rails security notes** — strong parameters, CSP defaults, and credential-store usage.
58183. **Spring Boot security notes** — actuator exposure control and method-security patterns.
58184. **Express.js security notes** — helmet baselines, rate limiting, and dependency auditing.
58185. **Next.js security notes** — server-component data leaks and middleware auth patterns.
58186. **Nuxt security notes** — SSR secret handling and runtime-config scoping.
58187. **ASP.NET Core security notes** — Data Protection API usage and antiforgery patterns.
58188. **FastAPI security notes** — dependency-injected auth and OpenAPI exposure control.
58189. **Flask security notes** — session-cookie signing and extension vetting.
58190. **Nginx hardening notes** — header hygiene, TLS baselines, and location-block scoping.
58191. **Apache hardening notes** — directory directives, module minimization, and .htaccess discipline.
58192. **IIS hardening notes** — request filtering and handler-mapping lockdown.
58193. **Caddy security notes** — automatic TLS pitfalls and reverse-proxy header trust.
58194. **HAProxy security notes** — TLS termination baselines and ACL-driven access control.
58195. **Traefik security notes** — dashboard exposure and middleware-chain ordering.
58196. **Docker hardening notes** — non-root users, read-only mounts, and image provenance.
58197. **Kubernetes hardening notes** — PodSecurity admission and network-policy baselines.
58198. **AWS security notes** — S3 public-access blocks, IAM boundaries, and CloudTrail baselines.
58199. **Azure security notes** — storage firewalling, Managed Identity usage, and Defender baselines.
58200. **GCP security notes** — IAM deny policies, VPC Service Controls, and OS Login.
58201. **Cloudflare configuration notes** — WAF rule tuning and origin-protection patterns.
58202. **Akamai configuration notes** — edge-control hygiene for security headers.
58203. **MongoDB hardening notes** — auth enforcement, bind-IP scoping, and role design.
58204. **PostgreSQL hardening notes** — pg_hba discipline, RLS usage, and extension audits.
58205. **Redis hardening notes** — protected mode, AUTH, and command-renaming guidance.
58206. **Elasticsearch hardening notes** — X-Pack security enablement and index-level access.
58207. **MySQL hardening notes** — privilege minimization and secure installation checklists.
58208. **GraphQL platform notes** — introspection gating and persisted-query discipline.
58209. **REST framework notes** — versioning, pagination abuse, and error-shape hygiene.
58210. **gRPC security notes** — mTLS setup and metadata-auth patterns.
58211. **WebSocket security notes** — origin validation and per-message auth checks.
58212. **Server-sent events notes** — stream auth and reconnection-token hygiene.
58213. **OAuth provider notes** — scope design and consent-screen clarity guidance.
58214. **SAML configuration notes** — assertion validation and cert-rotation runbooks.
58215. **OIDC deployment notes** — discovery hardening and nonce/state handling.
58216. **JWT library notes** — per-language library pitfalls and safe defaults.
58217. **Session store notes** — Redis-backed sessions with rotation and invalidation.
58218. **CDN security notes** — cache-key design and origin-shield configuration.
58219. **WAF tuning notes** — rule modes, false-positive triage, and bypass-awareness.
58220. **SIEM onboarding notes** — log-source mapping for Dark-Matter finding types.
58221. **EDR coexistence notes** — running hunts alongside endpoint agents safely.
58222. **VPN concentrator notes** — hardening remote-access gateways used by testers.
58223. **Zero-trust architecture notes** — identity-aware proxy patterns for internal apps.
58224. **Service mesh notes** — mTLS and authorization policy baselines.
58225. **API gateway notes** — key plans, quotas, and request-validation plugins.
58226. **Message queue notes** — auth on brokers and payload-validation patterns.
58227. **Serverless security notes** — IAM-per-function and event-source validation.
58228. **Edge function notes** — secret handling and cold-start auth patterns.
58229. **IoT firmware notes** — update signing and debug-port disabling.
58230. **OT network notes** — segmentation guidance for operational tech environments.
58231. **SAP hardening notes** — transaction-code lockdown and default-account audits.
58232. **Salesforce security notes** — sharing-rule reviews and connected-app scoping.
58233. **SharePoint hardening notes** — permission inheritance audits and external sharing.
58234. **Exchange hardening notes** — EWS exposure and legacy-auth disabling.
58235. **Active Directory notes** — tiering, LAPS, and Kerberos hardening baselines.
58236. **Okta configuration notes** — policy ordering and app-integration reviews.
58237. **Auth0 configuration notes** — rule/action hygiene and tenant log monitoring.
58238. **Keycloak deployment notes** — realm hardening and client-scope design.
58239. **GitLab security notes** — runner isolation and token-scope minimization.
58240. **GitHub security notes** — branch protection, secret scanning, and OIDC-to-cloud.
58241. **Jenkins hardening notes** — controller isolation and credential-store usage.
58242. **Terraform security notes** — state-file protection and plan-review gates.
58243. **Ansible security notes** — vault usage and privilege-escalation scoping.
58244. **CI/CD pipeline notes** — artifact signing and provenance attestation.
58245. **Artifact registry notes** — image signing and retention-policy design.
58246. **Observability stack notes** — log redaction and dashboard access control.
58247. **Feature flag notes** — flag evaluation security and kill-switch design.
58248. **A/B testing notes** — experiment bucketing without PII leakage.
58249. **Payment integration notes** — PCI-scoped card handling with tokenization.
58250. **Email infrastructure notes** — SPF/DKIM/DMARC baselines for phishing resistance.
58251. **DNS infrastructure notes** — DNSSEC rollout and zone-transfer lockdown.
58252. **PKI operations notes** — CA hygiene and certificate lifecycle automation.
58253. **HSM usage notes** — key-custody procedures with quorum controls.
58254. **Backup system notes** — encrypted, tested restores with offline copies.
58255. **Disaster recovery notes** — RTO/RPO-aligned security control restoration.
58256. **MDM platform notes** — enrollment hardening and compliance-policy baselines.
58257. **VDI security notes** — golden-image patching and session watermarking.
58258. **BYOD policy notes** — containerization and selective-wipe guidance.
58259. **Technology note freshness badges** — per-note "last verified against version X" stamps.
58260. **Curated payload library index** — categorized defensive reference of proof-of-concept patterns.
58261. **Payload library categorization scheme** — by weakness, platform, and verification purpose.
58262. **Payload library safe-handling banner** — every page states defensive/testing-only use.
58263. **XSS verification pattern set** — benign canary patterns proving execution context.
58264. **SQLi verification pattern set** — time-based and boolean canaries without data extraction.
58265. **SSRF verification pattern set** — collaborator-style callbacks proving request origin.
58266. **XXE verification pattern set** — out-of-band canaries confirming parser behavior.
58267. **Command injection canary set** — sleep/dns canaries proving execution without harm.
58268. **Path traversal canary set** — known-file probes confirming read primitives safely.
58269. **Open redirect proof set** — redirect-target canaries for validation testing.
58270. **Header injection proof set** — response-splitting canaries for parser checks.
58271. **Template injection canary set** — arithmetic-eval probes identifying engine types.
58272. **LDAP injection canary set** — wildcard probes confirming filter manipulation.
58273. **XPath injection canary set** — boolean probes for query-structure testing.
58274. **NoSQL operator canary set** — type-juggling probes for query-injection checks.
58275. **JWT tampering proof set** — alg-confusion test vectors for validation audits.
58276. **CORS misconfiguration proof set** — origin-reflection checks for policy audits.
58277. **CSRF proof-of-concept set** — auto-submit forms demonstrating missing tokens.
58278. **Clickjacking proof set** — frame-embedding demos for header audits.
58279. **Deserialization canary set** — gadget-free probes confirming unserialize sinks.
58280. **File upload bypass set** — polyglot and double-extension samples for filter tests.
58281. **Race condition proof harness** — parallel-request scripts demonstrating timing windows.
58282. **IDOR enumeration set** — sequential-ID probes with authorization assertions.
58283. **Mass assignment proof set** — extra-field probes for binding audits.
58284. **Cache poisoning canary set** — unkeyed-input probes for cache audits.
58285. **Host header proof set** — password-reset poisoning demos for trusted-host audits.
58286. **Subdomain takeover proof set** — claim-check procedures per provider fingerprint.
58287. **S3 exposure proof set** — bucket-policy probes without data access.
58288. **Git metadata proof set** — .git exposure checks for deployment audits.
58289. **Backup file proof set** — common backup-name probes for artifact audits.
58290. **Debug endpoint proof set** — framework-specific debug-route probes.
58291. **Default credential matrix** — vendor default pairs for authorized change audits.
58292. **Information disclosure probe set** — banner and error-verbosity checks.
58293. **TLS configuration probe set** — cipher and protocol probes for baseline audits.
58294. **Cookie flag probe set** — Secure/HttpOnly/SameSite verification checks.
58295. **Security header probe set** — CSP/HSTS/X-Frame-Options presence checks.
58296. **HTTP method probe set** — dangerous-method checks for endpoint audits.
58297. **CORS preflight probe set** — OPTIONS-behavior checks for policy audits.
58298. **API versioning probe set** — old-version exposure checks.
58299. **GraphQL introspection probe set** — schema-exposure checks for API audits.
58300. **WebSocket origin probe set** — handshake-origin checks.
58301. **OAuth redirect probe set** — redirect-URI validation tests.
58302. **Password reset proof set** — token-entropy and expiry verification flows.
58303. **2FA bypass probe set** — enrollment and recovery-flow audit checks.
58304. **Session fixation probe set** — session-rotation verification procedures.
58305. **Rate limit probe set** — threshold-discovery checks for throttling audits.
58306. **Brute-force guard probe set** — lockout and CAPTCHA verification procedures.
58307. **Account enumeration probe set** — response-delta checks for user-existence leaks.
58308. **Business logic probe set** — negative-quantity and coupon-stacking test cases.
58309. **Privilege escalation probe set** — role-parameter tampering checks.
58310. **API key leakage probe set** — client-bundle and JS secret scans.
58311. **Mobile deep-link probe set** — intent/URL-scheme hijack checks.
58312. **WebView bridge probe set** — JS-interface exposure audits.
58313. **Biometric fallback probe set** — fallback-auth strength verification.
58314. **Push notification probe set** — deep-link and data-exposure checks.
58315. **Payload library versioning** — dated releases so tests stay reproducible.
58316. **Payload library changelog** — what was added, fixed, or retired per release.
58317. **Payload library deprecation policy** — retired patterns archived with rationale.
58318. **Payload library severity mapping** — each pattern links its CWE and severity.
58319. **Payload library search filters** — filter by weakness, platform, and risk level.
58320. **Payload library copy buttons** — one-click copy with safe-handling reminder.
58321. **Payload library curl generators** — turn a pattern into a ready curl command.
58322. **Payload library Python snippets** — requests-based verification scripts.
58323. **Payload library Burp notes** — how each pattern maps to manual proxy testing.
58324. **Payload library ZAP notes** — mapping patterns to ZAP scan rules.
58325. **Payload library Nuclei mapping** — which Nuclei templates cover each pattern.
58326. **Payload library false-positive notes** — when a pattern triggers without real risk.
58327. **Payload library environment tags** — lab-only versus production-safe markers.
58328. **Payload library contributor credits** — researcher attribution per pattern.
58329. **Payload library review queue** — community submissions awaiting editorial review.
58330. **Payload library export packs** — downloadable per-category packs for offline labs.
58331. **Payload library usage analytics** — anonymized counts guiding curation priorities.
58332. **Payload library "used by agent" tags** — marks patterns the Dark-Matter agent employs.
58333. **Payload library difficulty ratings** — beginner-to-advanced ordering for training.
58334. **Payload library related guides** — cross-links to remediation guides per pattern.
58335. **Payload library printable cheat cards** — per-category quick-reference cards.
58336. **Payload library API access** — machine-readable patterns for CI security gates.
58337. **Payload library license clarity** — explicit reuse terms on every page.
58338. **Payload library audit trail** — who changed what pattern and when.
58339. **Payload library translation status** — language coverage badges per category.
58340. **Payload library feedback loop** — report-a-bad-pattern button with triage SLA.
58341. **Payload library canary uniqueness** — every pattern uses unique canary tokens.
58342. **Payload library safe defaults** — patterns default to non-destructive variants.
58343. **Payload library scope reminders** — authorization checklist before any use.
58344. **Payload library ethics statement** — prominent defensive-purpose framing page.
58345. **Methodology documentation hub** — central index of how the Dark-Matter agent hunts.
58346. **Recon methodology write-up** — how the agent maps subdomains, ports, and tech stacks.
58347. **Enumeration methodology write-up** — endpoint and parameter discovery logic explained.
58348. **Fingerprinting methodology write-up** — tech-identification signals and confidence rules.
58349. **Vulnerability detection methodology** — per-engine detection logic in plain language.
58350. **Proof-of-concept methodology** — how the agent builds safe, minimal PoCs.
58351. **Risk scoring methodology** — CVSS-style scoring inputs and weighting explained.
58352. **False-positive filtering methodology** — filter rules and their rationale documented.
58353. **Chaining methodology write-up** — how findings combine into impact chains.
58354. **Learning methodology write-up** — how hunt outcomes improve future hunts.
58355. **Report writing methodology** — how findings become professional reports.
58356. **Mid-hunt Q&A methodology** — how the agent answers questions during a hunt.
58357. **Stealth methodology write-up** — rate discipline and low-noise design explained.
58358. **Scope adherence methodology** — how the agent stays inside authorized targets.
58359. **Evidence collection methodology** — what the agent saves and why it matters.
58360. **Hunt planning methodology** — how the agent prioritizes checks per target.
58361. **Hunt resumption methodology** — how paused hunts pick up without repeating work.
58362. **Multi-target methodology** — how parallel hunts share learning safely.
58363. **API hunting methodology** — OpenAPI-driven checks and auth handling explained.
58364. **Mobile backend methodology** — how the agent tests mobile API surfaces.
58365. **Cloud asset methodology** — cloud-specific recon and misconfiguration checks.
58366. **JavaScript analysis methodology** — how the agent mines client bundles for secrets.
58367. **Authentication testing methodology** — login-flow checks the agent performs.
58368. **Session testing methodology** — token and cookie checks explained.
58369. **Authorization testing methodology** — IDOR and privilege checks documented.
58370. **Input validation methodology** — fuzzing strategy and canary design.
58371. **Business logic methodology** — invariant-based testing approach.
58372. **Cryptography review methodology** — what the agent checks in crypto usage.
58373. **Dependency review methodology** — how known-vulnerable components are flagged.
58374. **Configuration review methodology** — header, TLS, and exposure checks.
58375. **Methodology versioning** — dated methodology releases matching agent versions.
58376. **Methodology change log** — what changed in the hunting approach per release.
58377. **Methodology diagrams** — visual hunt-lifecycle flowcharts.
58378. **Methodology glossary links** — terms in methodology link to glossary entries.
58379. **Methodology FAQ** — common questions about how the agent works.
58380. **Methodology for auditors** — compliance-friendly description of agent behavior.
58381. **Methodology for developers** — what devs should know when the agent hunts their app.
58382. **Methodology for executives** — non-technical summary of the hunt process.
58383. **Methodology whitepaper PDF** — downloadable formal methodology document.
58384. **Methodology peer review** — external experts review methodology annually.
58385. **Methodology feedback channel** — suggest improvements to documented methods.
58386. **Methodology training deck** — slide deck teaching the methodology to teams.
58387. **Methodology video series** — narrated walkthrough of each hunt phase.
58388. **Methodology interactive tour** — click-through demo of a sample hunt timeline.
58389. **Methodology limitations page** — honest statement of what the agent cannot do.
58390. **Methodology ethics page** — authorized-testing principles the agent follows.
58391. **Methodology benchmark notes** — how methodology maps to industry test standards.
58392. **Methodology comparison table** — agent approach versus manual pentest phases.
58393. **Methodology update notifications** — subscribers alerted to methodology changes.
58394. **Methodology translation plan** — priority languages for methodology docs.
58395. **Methodology search integration** — methodology pages indexed in KB search.
58396. **Methodology print styles** — clean print CSS for methodology documents.
58397. **Methodology citation format** — how to cite Dark-Matter methodology in reports.
58398. **Methodology API** — machine-readable methodology metadata for partners.
58399. **Methodology roadmap** — upcoming methodology improvements published openly.
58400. **Methodology incident notes** — how methodology gaps found in the field get fixed.
58401. **Methodology confidence labels** — per-technique maturity ratings (experimental/stable).
58402. **Methodology test coverage** — which techniques have automated self-tests.
58403. **Methodology rollback notes** — how a bad methodology change gets reverted.
58404. **Methodology onboarding checklist** — new team members read methodology in order.
58405. **Methodology quiz module** — self-test questions per hunt phase for training.
58406. **Methodology case links** — each phase links anonymized hunts that illustrate it.
58407. **Methodology accessibility** — WCAG-compliant docs with alt text on diagrams.
58408. **Methodology dark-mode docs** — readable code blocks in both themes.
58409. **Methodology offline pack** — downloadable ZIP of all methodology pages.
58410. **Methodology RSS feed** — subscribe to methodology updates.
58411. **Methodology contributor guide** — how researchers propose methodology edits.
58412. **Methodology editorial board** — named reviewers for methodology accuracy.
58413. **Methodology annual report** — yearly summary of methodology evolution.
58414. **Methodology maturity model** — stages from ad-hoc to autonomous hunting.
58415. **Methodology metrics dashboard** — coverage and effectiveness stats per phase.
58416. **Methodology red-team notes** — how methodology holds up under adversarial review.
58417. **Methodology blue-team notes** — detection guidance for defenders per phase.
58418. **Methodology legal notes** — authorization and scope documentation practices.
58419. **Methodology insurance notes** — how methodology maps to cyber-insurance questionnaires.
58420. **Methodology procurement notes** — RFP-ready description of the hunting approach.
58421. **Methodology SLA mapping** — hunt-phase timelines for managed-service offerings.
58422. **Methodology escalation paths** — when the agent hands off to a human expert.
58423. **Methodology human-in-the-loop** — documented checkpoints for analyst review.
58424. **Methodology automation boundaries** — what stays manual and why.
58425. **Methodology data retention** — what hunt data is kept per methodology.
58426. **Methodology privacy notes** — PII handling during hunts documented.
58427. **Methodology threat-model links** — per-phase threat-model references.
58428. **Methodology kill-chain mapping** — hunt phases mapped to the cyber kill chain.
58429. **Methodology MITRE mapping table** — full technique coverage matrix.
58430. **Anonymized case study library** — real hunt stories with targets anonymized.
58431. **Case study: e-commerce checkout flaw** — anonymized business-logic hunt narrative.
58432. **Case study: SaaS IDOR chain** — how chained low-severity findings became critical.
58433. **Case study: API mass assignment** — discovery-to-fix timeline narrative.
58434. **Case study: subdomain takeover** — dangling-record discovery walkthrough.
58435. **Case study: stored XSS via upload** — file-upload bypass leading to session theft.
58436. **Case study: SSRF to metadata** — cloud metadata access via request forgery.
58437. **Case study: JWT algorithm confusion** — none-alg acceptance in a mobile API.
58438. **Case study: OAuth redirect abuse** — token leakage via redirect-URI flaw.
58439. **Case study: GraphQL depth abuse** — DoS via nested queries.
58440. **Case study: race condition coupon** — double-spend via timing window.
58441. **Case study: verbose error leak** — stack traces revealing internals.
58442. **Case study: backup file exposure** — database dump via predictable backup name.
58443. **Case study: git history secrets** — API keys in public commit history.
58444. **Case study: default credentials** — admin panel with vendor defaults.
58445. **Case study: CORS wildcard** — credentialed cross-origin data theft.
58446. **Case study: CSRF on settings** — email-change without token protection.
58447. **Case study: open redirect chain** — redirect leading to OAuth token theft.
58448. **Case study: XXE in document import** — file exfiltration via XML parsing.
58449. **Case study: deserialization RCE path** — from unserialize sink to code execution.
58450. **Case study: NoSQL operator injection** — login bypass via query operators.
58451. **Case study: LDAP filter manipulation** — auth bypass via filter injection.
58452. **Case study: template injection** — SSTI in a marketing email builder.
58453. **Case study: host header poisoning** — password-reset link hijack.
58454. **Case study: cache poisoning** — poisoned CDN responses for phishing.
58455. **Case study: WebSocket auth gap** — missing auth on real-time channel.
58456. **Case study: mobile API key leak** — hardcoded keys in shipped app bundle.
58457. **Case study: deep-link hijack** — insecure intent handling in Android app.
58458. **Case study: biometric fallback weakness** — weak PIN fallback after biometric.
58459. **Case study: S3 bucket exposure** — public bucket with customer exports.
58460. **Case study: CI secret leak** — tokens in build logs.
58461. **Case study: Kubernetes dashboard** — exposed dashboard without auth.
58462. **Case study: container registry** — public images with embedded secrets.
58463. **Case study: webhook validation gap** — forged events triggering payouts.
58464. **Case study: rate-limit absence** — credential stuffing at scale.
58465. **Case study: 2FA enrollment flaw** — bypass during authenticator setup.
58466. **Case study: password reset entropy** — predictable tokens in reset flow.
58467. **Case study: session fixation** — session not rotated after login.
58468. **Case study: privilege escalation** — role parameter tampering.
58469. **Case study: mass assignment** — admin flag via extra JSON fields.
58470. **Case study: information disclosure** — internal API docs exposed.
58471. **Case study: debug endpoint live** — production debug console reachable.
58472. **Case study: TLS downgrade** — weak cipher negotiation accepted.
58473. **Case study: certificate validation gap** — mobile app skipping pinning.
58474. **Case study: weak password storage** — MD5 hashes in a breach table.
58475. **Case study: log injection** — forged entries confusing incident response.
58476. **Case study: supply-chain component** — vulnerable library via transitive dependency.
58477. **Case study: third-party script** — compromised tag manager exfiltrating data.
58478. **Case study: DNS takeover** — expired domain reclaiming mail flow.
58479. **Case study: email spoofing** — missing DMARC enabling phishing.
58480. **Case study: invoice fraud logic** — negative-line-item manipulation.
58481. **Case study: referral abuse** — self-referral farming via logic gap.
58482. **Case study: trial extension abuse** — clock manipulation extending trials.
58483. **Case study: coupon stacking** — combinable discounts beyond intent.
58484. **Case study: refund logic flaw** — double-refund via race window.
58485. **Case study: loyalty points flaw** — point minting via API replay.
58486. **Case study: booking manipulation** — seat-hold bypass in ticketing flow.
58487. **Case study: KYC bypass** — document-check circumvention narrative.
58488. **Case study: age-gate bypass** — client-side-only age verification.
58489. **Case study: geo-restriction bypass** — region checks enforced client-side only.
58490. **Case study: CAPTCHA bypass** — replayable challenge tokens.
58491. **Case study narrative template** — standard structure for every case study.
58492. **Case study timeline visuals** — discovery-to-fix timeline graphics.
58493. **Case study impact framing** — business-impact translation per story.
58494. **Case study fix verification** — how the fix was confirmed, documented.
58495. **Case study lessons section** — takeaways for developers and hunters.
58496. **Case study difficulty ratings** — how hard each hunt was, honestly rated.
58497. **Case study tool mapping** — which agent engines drove each discovery.
58498. **Case study anonymization standard** — documented process for removing identifiers.
58499. **Case study consent records** — permission trail for publishing each story.
58500. **Case study industry tags** — filter stories by fintech, health, retail, and more.
58501. **Case study severity mix** — balanced coverage from low to critical.
58502. **Case study video companions** — short narrated versions of top stories.
58503. **Case study discussion prompts** — team-review questions per story.
58504. **Case study quiz questions** — knowledge checks tied to each narrative.
58505. **Case study PDF exports** — printable versions for training sessions.
58506. **Case study RSS feed** — subscribe to newly published stories.
58507. **Case study "similar hunts" links** — related stories surfaced per case.
58508. **Case study search filters** — by weakness, industry, and hunt duration.
58509. **Case study bookmarking** — save stories to personal collections.
58510. **Case study sharing cards** — social-ready summaries with key stats.
58511. **Case study translation queue** — priority languages for top stories.
58512. **Case study annual anthology** — yearly "best hunts" compiled edition.
58513. **Case study classroom packs** — educator bundles with slides and handouts.
58514. **Case study ethics framing** — every story emphasizes authorized testing.
58515. **Training course catalog** — structured courses from beginner to advanced.
58516. **Web security fundamentals course** — HTTP, auth, and session basics for newcomers.
58517. **OWASP Top 10 course** — one module per category with labs.
58518. **API security course** — REST and GraphQL testing curriculum.
58519. **Mobile security course** — Android and iOS backend testing track.
58520. **Cloud security course** — AWS/Azure/GCP misconfiguration curriculum.
58521. **Secure coding course** — per-language defensive patterns track.
58522. **Threat modeling course** — structured design-review training.
58523. **Incident response course** — from finding to containment workflows.
58524. **Bug bounty methodology course** — how professional hunters scope and report.
58525. **Dark-Matter operator course** — running and interpreting agent hunts.
58526. **Report writing course** — turning findings into accepted bounty reports.
58527. **Remediation verification course** — confirming fixes actually hold.
58528. **Course progress tracking** — per-learner completion dashboards.
58529. **Course certificates** — verifiable completion credentials.
58530. **Course quizzes** — graded checks after every module.
58531. **Course hands-on labs** — safe sandbox targets for practice.
58532. **Course lab reset buttons** — one-click lab environment restore.
58533. **Course difficulty paths** — beginner, practitioner, and expert tracks.
58534. **Course prerequisites map** — what to learn before each course.
58535. **Course time estimates** — honest hour counts per module.
58536. **Course offline packs** — downloadable materials for low-bandwidth learners.
58537. **Course discussion forums** — per-module Q&A with expert answers.
58538. **Course mentor office hours** — scheduled live help sessions.
58539. **Course cohorts** — group start dates for team training.
58540. **Course team analytics** — manager view of team progress.
58541. **Course SCORM export** — LMS-compatible packages for enterprises.
58542. **Course accessibility** — captions, transcripts, and keyboard navigation.
58543. **Course multilingual subtitles** — priority-language subtitle tracks.
58544. **Interactive XSS playground** — safe browser sandbox demonstrating encoding fixes.
58545. **Interactive SQLi playground** — parameterized-query lab with live feedback.
58546. **Interactive JWT playground** — token decoder showing validation checks.
58547. **Interactive CORS playground** — origin-policy simulator for policy design.
58548. **Interactive CSP builder** — policy composer with violation preview.
58549. **Interactive regex tester** — ReDoS-safe pattern lab.
58550. **Interactive crypto chooser** — algorithm picker with security guidance.
58551. **Interactive header checker** — paste headers, get hardening feedback.
58552. **Interactive cookie analyzer** — flag-by-flag cookie assessment.
58553. **Interactive TLS explainer** — handshake visualizer with version guidance.
58554. **Interactive auth flow diagrams** — clickable OAuth/OIDC sequence charts.
58555. **Interactive session lifecycle** — login-to-logout state visualizer.
58556. **Interactive SSRF diagram** — request-flow visualizer with filter points.
58557. **Interactive XXE diagram** — parser-option visualizer.
58558. **Interactive deserialization demo** — safe format-comparison lab.
58559. **Interactive IDOR demo** — authorization-check simulator.
58560. **Interactive rate-limit simulator** — throttle-design playground.
58561. **Cheat sheet library** — one-page references per topic.
58562. **XSS cheat sheet** — contexts and encodings on one page.
58563. **SQLi cheat sheet** — per-database defensive notes condensed.
58564. **SSRF cheat sheet** — filter checklist on one page.
58565. **XXE cheat sheet** — parser configs per language condensed.
58566. **JWT cheat sheet** — validation checklist on one page.
58567. **CORS cheat sheet** — safe configurations condensed.
58568. **CSP cheat sheet** — directive quick reference.
58569. **Security headers cheat sheet** — header-by-header one-pager.
58570. **TLS cheat sheet** — cipher and version baselines condensed.
58571. **OAuth cheat sheet** — flows and pitfalls on one page.
58572. **API security cheat sheet** — top checks condensed.
58573. **Mobile security cheat sheet** — platform checks on one page.
58574. **Cloud security cheat sheet** — per-provider essentials condensed.
58575. **Container cheat sheet** — hardening flags on one page.
58576. **Kubernetes cheat sheet** — RBAC and policy essentials.
58577. **Git security cheat sheet** — secret-prevention one-pager.
58578. **CI/CD cheat sheet** — pipeline hardening condensed.
58579. **Incident response cheat sheet** — first-hour actions on one page.
58580. **Threat modeling cheat sheet** — STRIDE-per-element quick reference.
58581. **Cheat sheet print packs** — bundled PDFs for onboarding kits.
58582. **Cheat sheet wall posters** — large-format versions for offices.
58583. **Cheat sheet dark-mode** — readable in both themes.
58584. **Cheat sheet versioning** — dated editions with change notes.
58585. **Video explainer library** — short videos per core concept.
58586. **Video: how XSS happens** — animated encoding-failure explainer.
58587. **Video: how SQLi happens** — animated query-concatenation explainer.
58588. **Video: how SSRF happens** — animated server-request explainer.
58589. **Video: how IDOR happens** — animated authorization-gap explainer.
58590. **Video: reading a finding** — how to interpret a Dark-Matter report card.
58591. **Video: fixing a finding** — developer walkthrough of a real fix.
58592. **Video: verifying a fix** — re-test workflow demonstration.
58593. **Video: threat modeling basics** — whiteboard-style intro.
58594. **Video: secure code review** — reviewer workflow demonstration.
58595. **Video transcript search** — every video indexed and searchable.
58596. **Video chapter markers** — jump to sections within each explainer.
58597. **Video playback speed** — learner-controlled speed settings.
58598. **Certification study paths** — mapped routes for major security certs.
58599. **Security+ study path** — KB-mapped study plan for CompTIA Security+.
58600. **CEH study path** — KB-mapped plan for Certified Ethical Hacker.
58601. **OSCP study path** — methodology-aligned prep track.
58602. **CISSP study path** — domain-mapped reading plan.
58603. **GWAPT study path** — web-app cert preparation track.
58604. **Study path progress sync** — progress shared across devices.
58605. **Security glossary hub** — alphabetical index of every defined term.
58606. **Glossary: vulnerability** — precise definition with scope notes.
58607. **Glossary: exploit** — defensive framing of the term.
58608. **Glossary: payload** — verification-pattern meaning in Dark-Matter context.
58609. **Glossary: false positive** — definition with triage implications.
58610. **Glossary: false negative** — definition with coverage implications.
58611. **Glossary: CWE** — weakness-enumeration explainer.
58612. **Glossary: CVE** — vulnerability-identifier explainer.
58613. **Glossary: CVSS** — scoring-system explainer with metric glossary.
58614. **Glossary: EPSS** — exploitation-probability explainer.
58615. **Glossary: OWASP** — organization and project explainer.
58616. **Glossary: SAST** — static-analysis explainer.
58617. **Glossary: DAST** — dynamic-analysis explainer.
58618. **Glossary: IAST** — interactive-testing explainer.
58619. **Glossary: SCA** — composition-analysis explainer.
58620. **Glossary: pentest** — penetration-testing explainer.
58621. **Glossary: red team** — adversarial-emulation explainer.
58622. **Glossary: blue team** — defense-operations explainer.
58623. **Glossary: purple team** — collaboration-model explainer.
58624. **Glossary: threat model** — structured-analysis explainer.
58625. **Glossary: attack surface** — exposure-inventory explainer.
58626. **Glossary: attack vector** — entry-path explainer.
58627. **Glossary: TTP** — tactics-techniques-procedures explainer.
58628. **Glossary: IOC** — indicator-of-compromise explainer.
58629. **Glossary: kill chain** — phased-attack explainer.
58630. **Glossary: MITRE ATT&CK** — framework explainer.
58631. **Glossary: zero-day** — unknown-vulnerability explainer.
58632. **Glossary: N-day** — known-vulnerability explainer.
58633. **Glossary: RCE** — remote-code-execution explainer.
58634. **Glossary: LFI** — local-file-inclusion explainer.
58635. **Glossary: RFI** — remote-file-inclusion explainer.
58636. **Glossary: SSRF** — server-side-request-forgery explainer.
58637. **Glossary: CSRF** — cross-site-request-forgery explainer.
58638. **Glossary: XSS** — cross-site-scripting explainer with type distinctions.
58639. **Glossary: SQLi** — injection explainer with variant notes.
58640. **Glossary: IDOR** — insecure-direct-object-reference explainer.
58641. **Glossary: XXE** — XML-external-entity explainer.
58642. **Glossary: SSTI** — server-side-template-injection explainer.
58643. **Glossary: deserialization** — insecure-deserialization explainer.
58644. **Glossary: JWT** — token-structure explainer.
58645. **Glossary: OAuth** — delegation-framework explainer.
58646. **Glossary: OIDC** — identity-layer explainer.
58647. **Glossary: SAML** — federation-protocol explainer.
58648. **Glossary: MFA** — multi-factor explainer with method comparison.
58649. **Glossary: SSO** — single-sign-on explainer.
58650. **Glossary: RBAC** — role-based-access explainer.
58651. **Glossary: ABAC** — attribute-based-access explainer.
58652. **Glossary: zero trust** — architecture-principle explainer.
58653. **Glossary: CSP** — content-security-policy explainer.
58654. **Glossary: HSTS** — strict-transport-security explainer.
58655. **Glossary: CORS** — cross-origin-sharing explainer.
58656. **Glossary: SOP** — same-origin-policy explainer.
58657. **Glossary: TLS** — transport-security explainer.
58658. **Glossary: mTLS** — mutual-TLS explainer.
58659. **Glossary: HSM** — hardware-security-module explainer.
58660. **Glossary: KMS** — key-management explainer.
58661. **Glossary: SIEM** — security-information-management explainer.
58662. **Glossary: SOAR** — orchestration-and-response explainer.
58663. **Glossary: EDR** — endpoint-detection explainer.
58664. **Glossary: WAF** — web-application-firewall explainer.
58665. **Glossary: IDS/IPS** — detection/prevention explainer.
58666. **Glossary: honeypot** — deception-technology explainer.
58667. **Glossary: sandbox** — isolation explainer.
58668. **Glossary: fuzzing** — input-testing explainer.
58669. **Glossary: canary** — verification-token explainer.
58670. **Glossary: PoC** — proof-of-concept explainer with ethics note.
58671. **Glossary: CVE triage** — prioritization-workflow explainer.
58672. **Glossary: remediation** — fix-workflow explainer.
58673. **Glossary: disclosure** — coordinated-disclosure explainer.
58674. **Glossary: bug bounty** — program-model explainer.
58675. **Glossary: VDP** — vulnerability-disclosure-policy explainer.
58676. **Glossary: SLA** — fix-timeline explainer.
58677. **Glossary: risk acceptance** — formal-acceptance explainer.
58678. **Glossary: compensating control** — alternative-mitigation explainer.
58679. **Glossary: defense in depth** — layered-defense explainer.
58680. **Glossary: least privilege** — access-minimization explainer.
58681. **Glossary: allowlist** — permitted-set explainer.
58682. **Glossary: denylist** — blocked-set explainer with limitations note.
58683. **Glossary: input validation** — verification-discipline explainer.
58684. **Glossary: output encoding** — context-safe-rendering explainer.
58685. **Glossary: parameterized queries** — safe-database-access explainer.
58686. **Glossary: secret rotation** — credential-lifecycle explainer.
58687. **Glossary: certificate pinning** — trust-anchoring explainer.
58688. **Glossary: rate limiting** — abuse-throttling explainer.
58689. **Glossary term cross-links** — every term links related terms automatically.
58690. **FAQ hub with categories** — organized questions for hunters, devs, and managers.
58691. **FAQ: is this legal** — authorized-testing scope explained plainly.
58692. **FAQ: what can the agent test** — capability boundaries in plain language.
58693. **FAQ: what the agent cannot do** — honest limitations list.
58694. **FAQ: how findings are verified** — verification workflow explained.
58695. **FAQ: what is a false positive** — triage guidance for disputed findings.
58696. **FAQ: how to dispute a finding** — step-by-step dispute process.
58697. **FAQ: how severity is assigned** — scoring inputs explained.
58698. **FAQ: can severity change** — re-scoring triggers and process.
58699. **FAQ: how to read a report** — report-section walkthrough.
58700. **FAQ: exporting reports** — PDF/markdown export instructions.
58701. **FAQ: sharing findings** — safe sharing with redaction guidance.
58702. **FAQ: fixing order** — prioritization advice for long finding lists.
58703. **FAQ: re-testing fixes** — how to request verification of a fix.
58704. **FAQ: integration questions** — Jira, Slack, and SIEM setup answers.
58705. **FAQ: account and billing** — plans, limits, and invoicing answers.
58706. **FAQ: data retention** — what hunt data is kept and for how long.
58707. **FAQ: data export** — how to take your data elsewhere.
58708. **FAQ: deleting data** — erasure requests and timelines.
58709. **FAQ: team management** — roles, invites, and permissions.
58710. **FAQ: SSO setup** — enterprise login configuration steps.
58711. **FAQ: API usage** — rate limits and key management answers.
58712. **FAQ: webhook setup** — event delivery configuration.
58713. **FAQ: hunt scheduling** — recurring hunt configuration.
58714. **FAQ: pausing hunts** — pause/resume behavior explained.
58715. **FAQ: hunt history** — finding past hunts and reports.
58716. **FAQ: target onboarding** — adding and verifying targets.
58717. **FAQ: scope definition** — writing clear authorization scopes.
58718. **FAQ: out-of-scope hits** — what happens when the agent finds them.
58719. **FAQ: safe targets** — practicing on built-in lab targets.
58720. **FAQ: learning resources** — where to start learning security.
58721. **FAQ: certification paths** — which certs the KB supports.
58722. **FAQ: community contributions** — how to submit guides.
58723. **FAQ: content licensing** — reuse terms for KB material.
58724. **FAQ: translation help** — how to help translate the KB.
58725. **FAQ: accessibility** — screen-reader and keyboard support notes.
58726. **FAQ: mobile app** — companion app capabilities.
58727. **FAQ: browser support** — supported browsers and versions.
58728. **FAQ: offline access** — what works without connectivity.
58729. **FAQ: notifications** — alert configuration answers.
58730. **FAQ: finding duplicates** — how duplicates are detected and merged.
58731. **FAQ: finding states** — new/acknowledged/fixed lifecycle explained.
58732. **FAQ: SLAs** — fix-timeline guidance by severity.
58733. **FAQ: compliance mapping** — PCI/SOC2/ISO control answers.
58734. **FAQ: auditor access** — read-only auditor roles.
58735. **FAQ: evidence handling** — how evidence is stored and redacted.
58736. **FAQ: PII in findings** — minimization and masking practices.
58737. **FAQ: pentest comparison** — agent hunts versus manual tests.
58738. **FAQ: red-team use** — using the agent in adversarial exercises.
58739. **FAQ: blue-team use** — defender workflows with agent output.
58740. **FAQ: MSSP use** — multi-client operational answers.
58741. **FAQ: performance impact** — how hunts affect target load.
58742. **FAQ: stealth mode** — low-noise hunting explained.
58743. **FAQ: IP allowlisting** — agent egress ranges for firewalls.
58744. **FAQ: support channels** — how to reach human help.
58745. **FAQ: status page** — service health and incident history.
58746. **FAQ: security of Dark-Matter** — how the platform protects itself.
58747. **FAQ: vulnerability disclosure** — reporting issues in Dark-Matter itself.
58748. **FAQ: roadmap** — where the KB is heading.
58749. **FAQ: changelog** — recent KB changes summarized.
58750. **FAQ: glossary links** — every answer links relevant glossary terms.
58751. **FAQ: related guides** — every answer cross-links guides and entries.
58752. **FAQ: video answers** — short clips answering top questions.
58753. **FAQ: multilingual answers** — top FAQs translated to priority languages.
58754. **FAQ: printable handbook** — full FAQ as a downloadable PDF.
58755. **FAQ: search integration** — FAQs indexed in KB search with snippets.
58756. **FAQ: feedback per answer** — "did this answer help" ratings.
58757. **FAQ: freshness dates** — each answer shows last-verified date.
58758. **FAQ: troubleshooting tree** — guided decision tree for common problems.
58759. **Troubleshooting: hunt stuck** — diagnostics for stalled hunts.
58760. **Troubleshooting: no findings** — why a hunt may return clean.
58761. **Troubleshooting: too many findings** — tuning noise down.
58762. **Troubleshooting: login failures** — target auth troubleshooting.
58763. **Troubleshooting: WAF blocks** — handling blocked agent traffic.
58764. **Troubleshooting: slow hunts** — performance diagnostics.
58765. **Troubleshooting: report errors** — fixing malformed reports.
58766. **Troubleshooting: export failures** — PDF/markdown export fixes.
58767. **Troubleshooting: integration errors** — Jira/Slack/webhook diagnostics.
58768. **Troubleshooting: SSO issues** — enterprise login diagnostics.
58769. **Troubleshooting: API errors** — key and quota troubleshooting.
58770. **Troubleshooting: notification gaps** — missing alert diagnostics.
58771. **Troubleshooting: lab resets** — restoring training environments.
58772. **Troubleshooting: video playback** — streaming issue fixes.
58773. **Troubleshooting: search issues** — KB search diagnostics.
58774. **Troubleshooting: translation gaps** — reporting missing translations.
58775. **Community contribution portal** — researcher-submitted guides and notes.
58776. **Contribution style guide** — formatting and tone standards for submissions.
58777. **Contribution templates (knowledge)** — guide, note, and case-study templates.
58778. **Contribution review board** — named reviewers for community content.
58779. **Contribution review SLA** — 14-day decision promise on submissions.
58780. **Contribution feedback loop** — authors see reviewer comments inline.
58781. **Contribution revision workflow** — request-changes cycle with diff view.
58782. **Contributor profiles** — public pages with badges and stats.
58783. **Contributor reputation tiers** — bronze/silver/gold based on accepted work.
58784. **Contributor leaderboard (knowledge)** — monthly top contributors highlighted.
58785. **Contributor of the month** — featured interview and badge.
58786. **Bounty for guides** — paid rewards for accepted high-value guides.
58787. **Bounty for translations** — rewards for quality KB translations.
58788. **Bounty for videos** — rewards for accepted explainer videos.
58789. **Bounty for cheat sheets** — rewards for reference-card contributions.
58790. **Bounty for case studies** — rewards for anonymized hunt stories.
58791. **Community guide licensing** — clear CC terms on submissions.
58792. **Community content versioning** — community guides carry edition numbers.
58793. **Community content freshness** — stale community guides flagged for review.
58794. **Community Q&A** — ask researchers questions on guides.
58795. **Community comments** — moderated discussion under each guide.
58796. **Community ratings (knowledge)** — star ratings on community content.
58797. **Community bookmarks** — save community guides to collections.
58798. **Community collections** — curated playlists by top researchers.
58799. **Community tags** — folksonomy tagging with editorial cleanup.
58800. **Community search filters** — filter KB by community versus editorial.
58801. **Community translation teams** — per-language volunteer groups.
58802. **Community glossary suggestions** — propose new terms with definitions.
58803. **Community FAQ suggestions** — propose answers from real support threads.
58804. **Community payload proposals** — submit verification patterns for review.
58805. **Community methodology proposals** — suggest hunt-method improvements.
58806. **Community case-study submissions** — anonymized story intake form.
58807. **Community video submissions** — explainer video intake with specs.
58808. **Community cheat-sheet submissions** — one-pager intake template.
58809. **Community lab contributions** — donate training lab scenarios.
58810. **Community quiz contributions** — submit assessment questions.
58811. **Community event calendar** — meetups and KB edit-a-thons.
58812. **Community code of conduct (knowledge)** — behavior standards with enforcement.
58813. **Community moderation team** — named moderators with public logs.
58814. **Community appeal process** — contest moderation decisions transparently.
58815. **Community newcomer guide** — first-contribution walkthrough.
58816. **Community mentor matching** — pair new authors with experienced ones.
58817. **Community writing workshops** — monthly sessions improving submissions.
58818. **Community editorial office hours** — live help from KB editors.
58819. **Community annual report** — yearly summary of community contributions.
58820. **Community impact stats** — views and saves per contributor.
58821. **Community content API** — machine access to community guides.
58822. **Community RSS feeds** — per-author and per-topic feeds.
58823. **Community newsletters** — monthly digest of new community content.
58824. **Community social cards** — shareable graphics for new guides.
58825. **Community multilingual hub** — coordination space for translators.
58826. **Community review checklist** — public criteria reviewers apply.
58827. **Community plagiarism checks** — automated originality screening.
58828. **Community safety review** — defensive-framing check on submissions.
58829. **Community legal review** — licensing and liability screening.
58830. **Community archived authors** — retired contributors honored, content maintained.
58831. **Community content migration** — adopting orphaned high-value guides.
58832. **Community feedback surveys** — annual contributor satisfaction survey.
58833. **Community roadmap input** — vote on KB content priorities.
58834. **Community beta readers** — early access to draft KB sections.
58835. **Community localization QA** — native-speaker review of translations.
58836. **Community accessibility QA** — volunteer checks on new content.
58837. **Community link rot patrol** — volunteers fixing broken external links.
58838. **Community example audits** — verifying code samples still work.
58839. **Community screenshot updates** — refreshing outdated UI captures.
58840. **Community terminology alignment** — glossary consistency drives.
58841. **Community citation drives** — adding sources to unsourced claims.
58842. **Community freshness sprints** — quarterly review of aging content.
58843. **Community hall of fame** — all-time contributor recognition wall.
58844. **Community swag program** — merchandise for top contributors.
58845. **Community conference talks** — speaking slots for KB authors.
58846. **Community research grants** — funding deep-dive KB topics.
58847. **Community student chapters** — university KB clubs with resources.
58848. **Community educator packs** — classroom-ready KB bundles.
58849. **Community parent org** — nonprofit stewardship of community content.
58850. **Community transparency reports** — moderation and payout disclosures.
58851. **Community content backups** — public archive of community KB.
58852. **Community fork policy** — terms for mirroring community content.
58853. **Community API rate tiers** — fair-use levels for content API.
58854. **Community webhooks** — notify apps of new community content.
58855. **Community digest emails** — weekly new-content summaries.
58856. **Community mobile view** — contributions readable on phones.
58857. **Community dark mode** — consistent theming for community pages.
58858. **Community print styles** — clean printing of community guides.
58859. **Community offline packs** — downloadable community content bundles.
58860. **Versioned knowledge releases** — quarterly KB editions with version numbers.
58861. **KB edition changelog** — what changed in each quarterly release.
58862. **KB edition archive** — browse any past edition in full.
58863. **KB edition diff viewer** — compare editions side by side.
58864. **KB edition permalinks** — cite a specific edition permanently.
58865. **New-technique intake pipeline** — how emerging techniques enter the KB.
58866. **Technique maturity labels** — experimental/emerging/established per technique.
58867. **Technique deprecation flow** — retiring outdated techniques gracefully.
58868. **Technique supersession links** — old technique pages point to replacements.
58869. **Quarterly technique review** — editorial board vets new additions.
58870. **Threat-landscape sync** — KB updates track real-world trend reports.
58871. **CVE-to-KB mapping** — notable CVEs linked to relevant KB entries.
58872. **Advisory ingestion feed** — vendor advisories summarized into KB notes.
58873. **Framework-release tracking** — security-relevant framework changes noted.
58874. **Browser-change tracking** — browser security changes reflected in KB.
58875. **Standard-update tracking** — OWASP/W3C/IETF updates folded into KB.
58876. **Knowledge freshness indicators** — per-page "verified current" badges.
58877. **Freshness SLA by category** — review cadence differs by volatility.
58878. **Stale-content flags** — pages past review date marked visibly.
58879. **Stale-content queue** — editors work through aging pages systematically.
58880. **Freshness dashboard** — org-wide view of KB currency.
58881. **Freshness alerts (knowledge)** — subscribers notified when key pages refresh.
58882. **Freshness API** — machine-readable last-verified dates.
58883. **Auto-suggest refresh** — agent flags pages contradicting new findings.
58884. **Reader-reported staleness** — "this looks outdated" button with triage.
58885. **Editorial calendar** — public schedule of upcoming KB updates.
58886. **Release notes blog** — narrative summaries of each KB edition.
58887. **Edition highlight reels** — short videos on major KB updates.
58888. **Migration notes** — what readers must unlearn between editions.
58889. **Deprecated URL redirects** — old links resolve to current equivalents.
58890. **Versioned API responses** — API serves the edition you request.
58891. **Edition comparison exports** — PDF diff summaries for auditors.
58892. **Multi-language knowledge hub** — language picker across the KB.
58893. **Priority language list** — published translation roadmap.
58894. **Translation memory** — consistent terminology across languages.
58895. **Glossary-driven translation** — terms translated via glossary only.
58896. **Machine-translation drafts** — MT first pass, human review after.
58897. **Translation QA badges** — human-reviewed versus MT-only markers.
58898. **Right-to-left support** — full RTL layouts for Arabic/Hebrew.
58899. **CJK typography** — proper fonts and spacing for East Asian scripts.
58900. **Localized code comments** — examples annotated in the reader's language.
58901. **Localized screenshots** — UI captures in translated locales.
58902. **Locale-specific compliance** — regional regulation notes per language.
58903. **Language fallback chains** — missing pages fall back gracefully.
58904. **Translation contribution stats** — per-language coverage dashboards.
58905. **Regional editor roles** — native-speaker editors per priority language.
58906. **Translation style guides** — per-language tone and terminology rules.
58907. **Untranslatable-term policy** — when to keep English security terms.
58908. **Multilingual search (knowledge)** — queries in any supported language.
58909. **Cross-language links** — every page links its translations.
58910. **Translation freshness sync** — translations flagged when source updates.
58911. **Translation diff view** — see what changed since translation.
58912. **Community translation voting** — readers vote best translation variant.
58913. **Professional translation tiers** — paid review for critical pages.
58914. **Sign-language videos** — key explainers with sign interpretation.
58915. **Audio versions** — narrated editions of top guides.
58916. **Easy-read editions** — simplified-language versions for beginners.
58917. **Versioned cheat sheets** — cheat sheets carry edition numbers.
58918. **Versioned video captions** — captions updated with content revisions.
58919. **Annual KB audit** — external review of accuracy and coverage.
58920. **KB coverage matrix** — CWE/framework coverage completeness view.
58921. **KB gap nominations** — readers request missing topics.
58922. **KB roadmap voting** — community votes on content priorities.
58923. **KB editorial principles** — published standards for all KB content.
58924. **KB style guide** — public writing and formatting standards.
58925. **KB accessibility standard** — WCAG targets for all KB pages.
58926. **KB performance budget** — page-load targets for KB pages.
58927. **KB uptime SLA** — availability commitment for the knowledge base.
58928. **KB status page** — real-time KB service health.
58929. **KB incident history** — past KB outages and fixes disclosed.
58930. **KB feedback program** — structured reader-feedback cycles.
58931. **KB advisory board** — external experts guiding KB direction.
58932. **KB annual survey** — reader satisfaction and needs survey.
58933. **KB transparency log** — all editorial decisions publicly logged.
58934. **KB open metrics** — public stats on coverage and freshness.
58935. **Unified KB search** — one search across entries, guides, videos, and FAQs.
58936. **Search typo tolerance** — fuzzy matching for misspelled security terms.
58937. **Search synonym mapping** — "XSS" finds cross-site scripting content.
58938. **Search acronym expansion** — abbreviations resolve to full terms.
58939. **Search faceted filters** — filter by type, stack, severity, and language.
58940. **Search result snippets** — contextual excerpts with matched terms highlighted.
58941. **Search "did you mean"** — suggestions for near-miss queries.
58942. **Search autocomplete (knowledge)** — term suggestions as you type.
58943. **Search recent queries** — personal search history with quick rerun.
58944. **Search saved queries** — bookmark frequent searches.
58945. **Search alerts** — notify when new content matches a saved query.
58946. **Semantic search** — natural-language questions find relevant KB pages.
58947. **Search answer cards** — direct answers for definition queries.
58948. **Search code lookup** — paste a snippet, find matching weakness entries.
58949. **Search error-message lookup** — paste an error, find relevant KB notes.
58950. **Search CVE lookup** — enter a CVE, land on mapped KB content.
58951. **Search CWE lookup** — enter a CWE ID, jump to its entry.
58952. **Search framework lookup** — framework name surfaces its hardening notes.
58953. **Search by finding type** — finding names map to encyclopedia entries.
58954. **"Learn more" links from findings** — every finding card deep-links its KB entry.
58955. **"Learn more" in reports** — PDF reports link KB entries per finding.
58956. **"Learn more" in tickets** — exported tickets carry KB reference links.
58957. **Contextual KB sidebar** — relevant articles surface beside the hunt view.
58958. **KB recommendations engine** — "read next" suggestions based on hunt findings.
58959. **KB learning streaks** — gamified reading progress for teams.
58960. **KB reading lists** — shareable curated lists for onboarding.
58961. **KB collections by role** — developer, hunter, and manager starter packs.
58962. **KB collections by stack** — per-technology reading bundles.
58963. **KB collections by cert** — certification-aligned bundles.
58964. **Search analytics dashboard** — popular and zero-result queries reviewed.
58965. **Zero-result handling** — helpful suggestions when nothing matches.
58966. **Search result ranking feedback** — "not what I wanted" improves ranking.
58967. **Search multilingual** — results in the reader's language first.
58968. **Search keyboard shortcuts** — power-user navigation for KB search.
58969. **Search API (knowledge)** — programmatic KB search for integrations.
58970. **Search in IDE plugin** — KB lookup from the code editor.
58971. **Search in chat** — Infinity AI answers cite KB entries.
58972. **Chat citations** — agent answers link the KB pages used.
58973. **KB page analytics** — views and helpfulness per page for editors.
58974. **KB print CSS** — every page prints cleanly.
58975. **KB dark mode** — consistent theming across all KB pages.
58976. **KB mobile layout** — fully responsive KB reading.
58977. **KB offline PWA** — installable offline KB reader.
58978. **KB text-to-speech** — listen to any KB page.
58979. **KB reading time** — estimated minutes per page.
58980. **KB difficulty badges** — reading-level indicators on search results.
58981. **KB freshness in results** — last-verified dates shown in snippets.
58982. **KB content warnings** — scope and ethics notices where relevant.
58983. **KB share links** — short URLs for any KB page.
58984. **KB embed cards** — rich previews when KB links are shared.
58985. **KB QR codes** — printable codes linking to key pages.
58986. **KB sitemap** — full crawlable index for search engines.
58987. **KB structured data** — schema.org markup for rich results.
58988. **KB RSS per topic** — subscribe to topics, not just the whole KB.
58989. **KB email digests** — weekly new-content emails per interest.
58990. **KB Slack integration** — search the KB from Slack.
58991. **KB Teams integration** — search the KB from Teams.
58992. **KB Discord bot** — community KB lookup bot.
58993. **KB browser extension** — highlight a term, get the KB definition.
58994. **KB API rate limits (knowledge)** — documented fair-use tiers.
58995. **KB API authentication** — key-based access for partners.
58996. **KB webhook events** — new/updated content events for apps.
58997. **KB GraphQL endpoint** — flexible queries over KB content.
58998. **KB bulk export** — full KB download for enterprise mirrors.
58999. **KB licensing page** — clear reuse terms for all KB content.
59000. **KB attribution generator** — copy-ready citations for KB pages.
59001. **KB "was this helpful" rollup** — aggregate ratings guide curation.
59002. **KB search quality SLA** — relevance targets with quarterly review.
59003. **KB 404 recovery** — removed pages suggest closest matches.
59004. **KB homepage curation** — featured entries, new guides, and trending topics.
