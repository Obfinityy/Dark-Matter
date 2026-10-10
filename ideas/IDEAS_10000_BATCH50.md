# Dark-Matter IDEAS — Batch 50: Shadow & async API surfaces, Supply-chain & third-party dependency posture, Hunt economics & bounty-program intelligence, Mobile attack surface, AI/LLM application security evaluation, CI/CD & build-pipeline security review, IoT & embedded/firmware analysis workflows, Passive recon & OSINT automation at scale, Safe impact demonstration & evidence capture, Remediation verification & retest automation (139005–140004)
> 1,000 ideas 139005–140004, generated 2026-10-10.
> Professional English. Defensive/product framing.

Batch 50 covers ten fresh capability frontiers: Shadow & async API surfaces (139005–139104); Supply-chain & third-party dependency posture (139105–139204); Hunt economics & bounty-program intelligence (139205–139304); Mobile attack surface (139305–139404); AI/LLM application security evaluation (139405–139504); CI/CD & build-pipeline security review (139505–139604); IoT & embedded/firmware analysis workflows (139605–139704); Passive recon & OSINT automation at scale (139705–139804); Safe impact demonstration & evidence capture (139805–139904); Remediation verification & retest automation (139905–140004) — each framed as defensive capabilities of an authorized bug-bounty agent.

| # | Category | Ideas |
|---|----------|-------|
| 1 | Shadow & async API surfaces | 139005–139104 |
| 2 | Supply-chain & third-party dependency posture | 139105–139204 |
| 3 | Hunt economics & bounty-program intelligence | 139205–139304 |
| 4 | Mobile attack surface | 139305–139404 |
| 5 | AI/LLM application security evaluation | 139405–139504 |
| 6 | CI/CD & build-pipeline security review | 139505–139604 |
| 7 | IoT & embedded/firmware analysis workflows | 139605–139704 |
| 8 | Passive recon & OSINT automation at scale | 139705–139804 |
| 9 | Safe impact demonstration & evidence capture | 139805–139904 |
| 10 | Remediation verification & retest automation | 139905–140004 |

139005. **Introspection snapshot diffing across deploys** — capture the full GraphQL schema on every deploy and diff it against the previous snapshot so newly exposed mutations and fields get flagged before attackers map them.
139006. **Disabled-introspection field-name probing** — when introspection is off, infer hidden fields from wordlist-driven queries plus "did you mean" error suggestions, giving testers schema coverage without server cooperation.
139007. **GraphQL directive-usage audit** — parse @deprecated, @include and custom directives from the schema to find deprecated-yet-queryable fields and risky conditional logic that reviewers usually miss.
139008. **Query depth and complexity cost estimator** — compute per-query depth and field-cost scores client-side to identify endpoints missing cost limits that could be abused for resource exhaustion.
139009. **Persisted-query allowlist bypass detection** — attempt to register arbitrary query hashes and replay unregistered queries to find persisted-query implementations that silently fall back to open execution.
139010. **Alias-based batching abuse detector** — pack dozens of aliased mutations into one request to measure whether the server enforces batch limits, since single-request batching evades per-request rate limiting.
139011. **Federation subgraph endpoint mapping** — query each subgraph's _service SDL separately to map cross-service trust boundaries and find subgraphs that skip the gateway's authorization.
139012. **Interface and union type-confusion testing** — probe __typename mismatches and inline fragments to catch resolvers returning the wrong concrete type, which often leaks fields from sibling types.
139013. **Mutation idempotency-key analysis** — replay mutations with reused, missing, and forged idempotency keys to detect unsafe deduplication that could double-apply financial or state-changing operations.
139014. **Subscription authorization parity review** — compare the auth checks on GraphQL subscriptions against their query and mutation equivalents, since realtime resolvers are frequently less guarded.
139015. **GraphQL-over-GET versus POST divergence test** — send identical operations over GET and POST to catch auth, CSRF, or caching differences between the two transports.
139016. **Multipart file-upload GraphQL probing** — exercise graphql-upload style multipart mutations to detect type confusion, missing size limits, and uploads landing outside the intended storage scope.
139017. **Alternate-path introspection sweep** — probe /graphql, /api/graphql, /v2/graphql and similar forgotten paths for introspection-enabled endpoints that the main route has hardened.
139018. **Schema-stitching merge-conflict detection** — look for duplicate type names or conflicting field definitions across stitched schemas, which signal inconsistent authorization between merged services.
139019. **Introspection query cost anomaly flag** — measure response time and payload size of full introspection queries to identify schemas so large that their mere exposure aids attacker reconnaissance.
139020. **WebSocket handshake origin validation review** — test whether the upgrade handshake enforces an Origin allowlist, since missing origin checks turn any site into a cross-site WebSocket hijack vector.
139021. **Subprotocol negotiation fuzzing** — offer unusual or malformed subprotocols during the handshake to detect downgrade behavior and parser differences that bypass expected framing.
139022. **Auth token lifecycle over persistent connections** — verify that expired or revoked tokens actually terminate live sockets, catching sessions that outlive their credentials.
139023. **Cross-connection message replay guard** — capture a valid frame and replay it inside a fresh connection to detect missing nonces or sequence checks on state-changing messages.
139024. **Pub/sub topic authorization mapping** — attempt wildcard and other-user topic subscriptions to map which channels lack subscriber authorization.
139025. **Binary frame parser differential testing** — send malformed binary frames and compare error handling against text frames to find parser inconsistencies that hide validation gaps.
139026. **Ping/pong keepalive cost measurement** — measure server CPU and memory cost under rapid ping frames to identify keepalive handling that enables cheap resource exhaustion.
139027. **Reconnection token entropy analysis** — assess whether session-resume tokens are predictable, since guessable resume tokens let an attacker hijack a dropped realtime session.
139028. **Close-frame status code leakage review** — inspect WebSocket close codes and reason strings for internal error details that disclose backend state or stack context.
139029. **Message-ordering race detection** — deliver dependent operations out of order over the socket to catch state corruption from missing sequencing guarantees.
139030. **Slow-consumer backpressure monitoring** — flood a deliberately slow reader to see whether the server drops, buffers unboundedly, or leaks memory under backpressure.
139031. **WebSocket-to-HTTP transport downgrade probe** — request WebSocket-only endpoints over plain HTTP to detect alternate transports that skip the socket's authentication.
139032. **Per-message-deflate compression oracle check** — test whether compression-ratio differences on secret-bearing frames create a side channel similar to CRIME/BREACH.
139033. **Parallel connection quota mapping** — open many concurrent sockets per account and IP to discover connection limits and detect missing enforcement.
139034. **Stale-session buffered-message exposure** — reconnect with an old session identifier to check whether buffered messages from a prior session leak to the new connection.
139035. **SSE endpoint auth parity review** — verify that text/event-stream endpoints enforce the same authentication as their REST equivalents, since streams are often bolted on without auth.
139036. **Last-Event-ID replay testing** — replay old event IDs against the stream to detect re-delivery of sensitive historical events to unauthorized clients.
139037. **Stream multiplexing tenant isolation check** — open event streams for two tenants simultaneously to catch cross-tenant event leakage in shared stream infrastructure.
139038. **Reconnect retry-field manipulation** — tamper with the server-sent retry interval to see whether clients can be forced into aggressive reconnect storms.
139039. **SSE CORS misconfiguration check** — test Access-Control-Allow-Origin on event-stream endpoints, since permissive CORS lets any origin siphon a victim's live stream.
139040. **Event-type enumeration via fuzzing** — guess event names and use status-code differences to map available stream types without documentation.
139041. **Long-lived stream data-drift review** — monitor multi-hour streams for PII or internal fields gradually appearing in events as upstream schemas evolve.
139042. **SSE comment-frame cache-poisoning probe** — inject colon-prefixed comment frames through proxies to detect cache poisoning via manipulated event streams.
139043. **Mid-stream error disclosure analysis** — force errors during an active stream and inspect partial JSON payloads for stack traces or internal identifiers.
139044. **Named-channel subscription mapping** — enumerate /events/{channel} style paths to find channels with missing subscriber authorization.
139045. **gRPC reflection-service descriptor extraction** — query the grpc.reflection service on exposed ports to pull full service descriptors and method lists directly from live servers.
139046. **Reflection-disabled descriptor recovery** — reconstruct .proto definitions from error messages, binary responses, and status details when reflection is turned off.
139047. **RPC method inference from error codes** — call guessed method names and use UNIMPLEMENTED versus PERMISSION_DENIED responses to map the real RPC surface.
139048. **grpc-web versus native parity testing** — compare the browser-facing grpc-web method surface against native gRPC to find methods hidden from one transport but live on the other.
139049. **Streaming RPC metadata auth gap analysis** — verify that authentication metadata is validated on streaming RPCs as strictly as on unary calls, since streams often skip interceptors.
139050. **Bidirectional stream resource abuse measurement** — open many concurrent bidi streams to measure server resource consumption and detect missing stream quotas.
139051. **Protobuf unknown-field round-trip leakage** — send unknown fields and check whether the server echoes them back, revealing newer schema versions or internal field names.
139052. **Rich error detail verbosity review** — inspect google.rpc.Status error details for internal paths, SQL fragments, and backend identifiers leaked in failures.
139053. **Deadline and timeout enforcement mapping** — set extreme or zero deadlines on RPCs to detect missing server-side timeouts that allow hung-call resource drain.
139054. **Per-method message-size limit differential** — send oversized payloads to each method to map inconsistent size limits across the service surface.
139055. **gRPC health-check service exposure** — probe grpc.health.v1 endpoints for dependency names and internal topology disclosed in health responses.
139056. **REST-transcoding parity check** — compare transcoded HTTP/JSON endpoints against raw gRPC methods to catch auth or validation differences between the two front doors.
139057. **Channelz debug-service exposure scan** — check for enabled channelz admin services that leak live connection and socket internals to unauthenticated callers.
139058. **Compression negotiation abuse test** — negotiate gzip on RPCs and test decompression-bomb handling to find missing payload limits after decompression.
139059. **Interceptor ordering audit** — infer auth, logging, and validation interceptor order from error precedence to find requests that bypass authentication interceptors.
139060. **Unsigned webhook delivery acceptance test** — deliver unsigned and wrongly-signed payloads to receiver endpoints to detect missing HMAC validation.
139061. **Timestamp-skew replay window measurement** — replay legitimately signed but aged webhook deliveries to find missing timestamp expiry checks.
139062. **Webhook receiver URL enumeration** — map all receiver URLs from provider integration docs and compare against deployed routes to find forgotten endpoints.
139063. **Callback-URL SSRF review** — register attacker-controlled callback URLs in webhook settings to verify outbound request filtering on the delivery side.
139064. **Idempotency-key collision testing** — reuse idempotency keys across different payloads to detect unsafe deduplication that silently drops legitimate events.
139065. **Retry-storm amplification measurement** — force receiver errors and measure provider retry multiplication to quantify amplification available to an attacker.
139066. **Signing-secret rotation gap detection** — test old signing secrets during rotation windows to find periods where both old and new secrets validate.
139067. **Unexpected event-type handling test** — deliver unrecognized event types to receivers to check for unhandled-type code paths that process data insecurely.
139068. **Webhook payload schema-drift monitor** — diff live webhook payloads against documented schemas to catch silently added fields carrying sensitive data.
139069. **Out-of-order delivery resilience audit** — deliver webhook events out of sequence to detect state corruption from unsafe ordering assumptions.
139070. **Multi-tenant receiver path-confusion probe** — test path traversal and tenant-prefix confusion in shared webhook receiver routing.
139071. **Destructive-event webhook auth parity** — verify deletion and cancellation webhooks carry the same signature and auth requirements as creation events.
139072. **Async job-ID enumeration via polling** — test sequential or predictable job IDs on status-polling endpoints for cross-user access to other users' results.
139073. **Completion-callback authorization review** — verify async completion callbacks authenticate the job owner rather than trusting the callback URL alone.
139074. **Queue-depth metric exposure check** — inspect job-status responses for internal queue metrics, worker counts, or backlog data that leak operational internals.
139075. **Delayed-execution scheduling abuse test** — schedule far-future or recurring jobs through cron-like APIs to detect missing authorization on the scheduler itself.
139076. **Dead-letter queue payload exposure** — check whether failed-job inspection endpoints expose other users' payloads or error context.
139077. **Job cancellation authorization mapping** — attempt to cancel other users' jobs via ID guessing to map missing ownership checks.
139078. **Progress-percentage side-channel analysis** — use fine-grained progress values to infer whether sensitive inputs are being processed and how far they got.
139079. **Webhook-versus-polling consistency check** — compare the data returned by push and poll async-notification channels to catch authorization gaps between them.
139080. **Long-polling timeout behavior review** — hold long-poll connections open past server timeouts to detect resource exhaustion and data leakage on timeout paths.
139081. **Event-bus wildcard subscription test** — attempt wildcard subscriptions on exposed message-bus bridges to find topics without subscriber authorization.
139082. **Saga state-machine authorization mapping** — map multi-step async workflows step by step to find intermediate steps that skip ownership or role checks.
139083. **Async export download-link entropy test** — assess the guessability of generated report and export URLs produced by batch jobs.
139084. **Multi-version endpoint diff engine** — crawl /v1, /v2, /v3 in parallel and diff per-version authorization to find hardened new versions alongside unpatched old ones.
139085. **Version-header tampering test** — mutate Accept-Version and X-API-Version headers to detect silent fallback to legacy, less-protected behavior.
139086. **Deprecated-parameter silent-acceptance check** — send removed parameters to new API versions to detect silent acceptance that re-enables old attack surface.
139087. **Mobile-app pinned-version mapping** — extract hardcoded API versions from mobile binaries to find shadow versions the web docs never mention.
139088. **Sunset-header compliance monitor** — track Sunset and Deprecation headers against actual endpoint liveness to catch announced-but-never-removed endpoints.
139089. **Default-version routing review** — omit the version entirely and observe which version serves the request and whether it is the hardened one.
139090. **Version-specific WAF coverage gaps** — test whether WAF and input-validation protections apply uniformly across all API versions.
139091. **Beta and preview endpoint discovery** — find /beta, /preview, and /experimental routes that ship without production-grade authentication.
139092. **Legacy-version fallback response audit** — request unsupported versions and check for insecure fallback responses instead of clean errors.
139093. **Changelog-to-code drift detector** — parse release notes for endpoints marked removed and verify they actually return 404 in production.
139094. **Tenant version-pinning patch audit** — check whether tenants pinned to old API versions still receive security patches or run unpatched code paths.
139095. **Deprecated-endpoint liveness watch** — continuously probe deprecated endpoints and alert when they unexpectedly start responding again.
139096. **Old-SDK endpoint residue mapping** — test endpoints referenced only by outdated SDK versions to find unmaintained routes still serving traffic.
139097. **Feature-flag resurrection detection** — combine feature flags in unusual ways to detect deprecated code paths re-enabled by flag interactions.
139098. **EOL announcement-to-enforcement lag tracker** — measure the days between an announced end-of-life date and the actual 404 to quantify the unmaintained exposure window.
139099. **Deprecated auth-method acceptance check** — test old API keys and legacy OAuth flows after migration announcements to find lingering acceptance.
139100. **Legacy error-format oracle review** — use verbose legacy error formats to enumerate hidden fields that newer error formats suppress.
139101. **Retired webhook-event still-firing monitor** — subscribe to retired event types and alert if the provider keeps delivering them.
139102. **Staging-only deprecation bypass check** — verify whether endpoints deprecated in production remain live on staging with weaker authentication.
139103. **Documentation-removal versus code-removal gap** — find endpoints deleted from docs but still serving traffic, since undocumented routes skip review.
139104. **Sunset-extension abuse-window tracker** — detect repeatedly extended sunset dates that turn temporary deprecated endpoints into permanent unmaintained surface.
139105. **SBOM completeness gap auditor** — parse generated SBOMs against actual lockfiles and container manifests to flag missing transitive components that leave blind spots in risk reviews.
139106. **Lockfile-to-SBOM drift detector** — compare committed SBOM snapshots against live lockfiles on every hunt to catch undeclared dependency changes that bypassed review.
139107. **Dependency-confusion registry scope verifier** — check private-scoped packages for matching public-registry names with higher versions to flag classic dependency-confusion exposure safely.
139108. **Private-index priority configuration scanner** — inspect npm and pip registry configs for public-first resolution order that enables dependency confusion.
139109. **Internal namespace squat watch** — monitor public registries for new packages matching internal-only namespaces to detect preemptive squatting attempts early.
139110. **Registry redirect audit trail** — verify configured registry endpoints resolve to expected hosts and have not been rewritten to attacker-controlled mirrors.
139111. **Scoped-registry credential exposure probe** — check whether private registry credentials appear in build logs, committed config, or insecure channels.
139112. **Typosquat likelihood ranker for manifests** — score declared dependencies against keyboard-adjacent and transposed variants to surface likely typosquats in in-scope projects.
139113. **Homoglyph package name scanner** — render declared dependency names in lookalike Unicode forms and compare against registry listings to detect homoglyph squatting.
139114. **Renamed-package abandonment tracker** — detect declared packages renamed upstream where the old name still resolves but no longer receives security updates.
139115. **Maintainer handover anomaly flagger** — flag dependencies whose registry maintainer accounts changed recently, since ownership transfers often precede supply-chain incidents.
139116. **Transitive license incompatibility mapper** — walk full dependency trees and flag copyleft licenses nested inside permissively licensed products to expose compliance risk.
139117. **Transitive vulnerability reachability analyzer** — resolve vulnerable versions of transitive dependencies and check whether the vulnerable code path is actually imported.
139118. **Duplicate dependency version bundler** — detect multiple versions of the same library bundled in one build, which silently reintroduces patched-out vulnerabilities.
139119. **Unpinned transitive range resolver** — flag transitive dependencies resolved via loose semver ranges that can shift silently between builds.
139120. **Dependency tree depth profiler** — measure maximum dependency tree depth per project to prioritize audits where deep transitive chains hide risk.
139121. **Container base-image staleness scorer** — compare base image tags and digests against upstream releases to score how far production images lag behind security patches.
139122. **Base-image layer diff monitor** — diff image layers between consecutive builds to attribute drift to specific Dockerfile changes or upstream base updates.
139123. **Base-image registry provenance check** — verify base images are pulled from approved registries with signed digests rather than mutable tags from public hubs.
139124. **Distroless migration opportunity finder** — identify images carrying full OS userlands that could shrink to distroless or minimal bases to reduce attack surface.
139125. **Immutable digest enforcement checker** — scan deployment manifests for image references pinned to immutable digests, closing the silent-swap window that mutable tags leave open.
139126. **CI action pin-to-SHA reviewer** — scan workflows for actions referenced by branch or major-version tags instead of full commit SHAs that enable supply-chain substitution.
139127. **Third-party action permission auditor** — compute the union of permissions granted to third-party actions and flag overly broad write scopes in CI workflows.
139128. **Unreviewed action version bump detector** — flag workflow changes where third-party action versions changed without accompanying review evidence.
139129. **CI-fetched script integrity checker** — detect curl-piped install scripts and remote bootstrap code in pipelines that bypass action pinning entirely.
139130. **Workflow reusable-call chain mapper** — trace reusable workflow calls across repositories to surface transitive trust in external CI code.
139131. **SaaS OAuth scope overreach scanner** — enumerate granted scopes for each integrated SaaS vendor and flag scopes exceeding what the integration functionally requires.
139132. **Vendor integration token expiry audit** — check whether SaaS integration tokens lack rotation or expiry, turning one leaked secret into persistent access.
139133. **Stale vendor integration deprovisioner finder** — identify SaaS integrations unused for months that still hold active credentials and should be revoked.
139134. **Webhook secret rotation status check** — verify vendor webhook endpoints use signed rotating secrets rather than static shared tokens.
139135. **Vendor subdomain takeover risk mapper** — map vendor-owned subdomains pointed at the target and flag dangling DNS records that enable takeover-style claims.
139136. **Subresource-integrity coverage mapper** — scan pages for third-party scripts and stylesheets loaded without SRI hashes that permit silent upstream code swaps.
139137. **SRI hash staleness verifier** — recompute hashes of pinned third-party resources and flag mismatches indicating upstream changes or compromise.
139138. **Third-party script capability inventory** — catalog what each loaded third-party script can access (cookies, DOM, storage) to quantify client-side supply-chain exposure.
139139. **CDN library version drift audit** — compare CDN-loaded library versions against declared versions to find pages running outdated, vulnerable copies.
139140. **Retired CDN endpoint hunter** — detect references to discontinued CDN hosts or deprecated library URLs that could be re-registered by attackers.
139141. **Update-cadence staleness forecaster** — model each dependency's historical release cadence to forecast when the in-use version becomes a security-lagging outlier.
139142. **Security-patch lag quantifier** — measure the time between upstream security releases and project adoption to quantify patch-lag risk per dependency.
139143. **End-of-life dependency detector** — flag dependencies whose upstream projects announced end-of-life, where no future security patches will exist.
139144. **Pre-release dependency usage flagger** — detect reliance on alpha, beta, or rc versions in production manifests that bypass stable release vetting.
139145. **Dependency freshness leaderboard** — rank in-scope projects by overall dependency freshness to prioritize hunts where stale stacks compound risk.
139146. **Advisory-to-code reachability filter** — suppress vulnerability advisories for code paths unreachable from application entry points to cut false positives in audits.
139147. **Malicious package behavior indicator scan** — scan dependency install scripts and post-install hooks for network exfiltration or credential harvesting behavior in authorized audits.
139148. **Install-script privilege minimizer** — flag packages running install scripts with elevated privileges or shelling out to interpreters unnecessarily.
139149. **Provenance attestation verifier** — verify SLSA-style build provenance attestations for critical dependencies to confirm they were built from claimed sources.
139150. **Signature coverage gap analyzer** — measure what fraction of the dependency tree carries valid registry signatures and prioritize the unsigned remainder.
139151. **Reproducible-build drift detector** — rebuild declared dependency versions and compare artifacts to detect tampering between source and published packages.
139152. **Package metadata anomaly scanner** — flag packages whose registry metadata (description, repo URL, version jumps) deviates sharply from historical norms.
139153. **Bundle inclusion source attributor** — trace every shipped JavaScript bundle back to its package version to identify which vulnerable dependency a bundle embeds.
139154. **Tree-shaking residue risk finder** — detect vulnerable code that survives tree-shaking and ships in production bundles despite only partial package imports.
139155. **Vendored dependency sync checker** — find vendored or copied library code that drifted from upstream and missed security patches.
139156. **Git submodule pin drift monitor** — audit submodule commits against upstream branches to catch submodules pinned to vulnerable or stale commits.
139157. **Forked dependency divergence tracker** — track forks used in place of upstream packages and flag when the fork lags behind upstream security fixes.
139158. **Monorepo cross-package version skew** — detect inconsistent versions of the same dependency across monorepo packages that complicate uniform patching.
139159. **SBOM vulnerability correlation feed** — join SBOM component inventories with vulnerability feeds to produce per-component risk cards with fix guidance.
139160. **Dependency risk score rollup** — aggregate vulnerability, license, freshness, and provenance signals into a single per-dependency risk score for triage.
139161. **Critical-path dependency isolator** — identify dependencies on authentication, crypto, and payment paths for prioritized deep review.
139162. **Single-maintainer dependency flagger** — flag widely used dependencies maintained by a single account, a bus-factor risk for timely security fixes.
139163. **Dependency abandonment predictor** — combine commit velocity, issue backlog, and maintainer activity to predict which dependencies are going quiet.
139164. **License change drift monitor** — watch for upstream license changes (permissive to proprietary) between the pinned and latest versions of dependencies.
139165. **Copyleft license linkage auditor** — audit how copyleft-licensed dependencies are linked into proprietary deliverables to keep the legal exposure boundary verifiable.
139166. **Dual-license selection verifier** — check that dual-licensed dependencies resolve to the intended license choice consistently across builds.
139167. **Container runtime package drift audit** — compare OS packages inside running containers against the build manifest to find drift introduced at runtime.
139168. **Image secret residue scanner** — scan image layers for embedded secrets, keys, and tokens left behind by build-time operations.
139169. **Build-arg secret leakage checker** — detect secrets passed as build arguments that persist in image history or layers.
139170. **Multi-arch image consistency verifier** — verify that all architecture variants of a multi-arch image carry the same patched component versions.
139171. **Helm chart dependency pin auditor** — check Helm charts for unpinned or floating chart dependencies that shift between deployments.
139172. **Infrastructure-module registry audit** — audit Terraform and IaC module sources for unpinned versions or unofficial registry forks.
139173. **CI runner image provenance check** — verify self-hosted CI runner images come from approved, signed sources rather than ad-hoc builds.
139174. **Ephemeral runner reuse detector** — detect CI runners reused across jobs or repositories where one job's artifacts could contaminate another.
139175. **Pull-request-target workflow risk scanner** — flag workflows using pull_request_target with untrusted checkout that could expose secrets to forked code.
139176. **Environment secret injection auditor** — trace CI environment secrets into job steps to find steps that echo or leak them into logs and artifacts.
139177. **Artifact attestation chain verifier** — verify attestations linking CI-built artifacts back to source commits and approved workflow runs.
139178. **Cache poisoning surface mapper** — map CI cache keys shared across branches or forks that could let a poisoned cache inject code into builds.
139179. **Third-party font and asset trust audit** — inventory third-party fonts, trackers, and media loaded by the app and check their hosting integrity controls.
139180. **Pixel and tracker permission review** — enumerate third-party tracking pixels and audit the data they collect under the site's consent configuration.
139181. **Chat widget privilege auditor** — assess third-party chat and support widgets for excessive DOM access and data exfiltration capability.
139182. **Payment SDK version compliance check** — verify integrated payment SDKs run vendor-supported versions meeting PCI-relevant patch requirements.
139183. **Captcha and fraud-vendor lock-in review** — audit third-party fraud and captcha vendors for pinned, SRI-protected integrations versus mutable remote loads.
139184. **OAuth app consent grant inventory** — list third-party OAuth applications users have authorized and flag overprivileged or dormant grants.
139185. **Vendor API key rotation auditor** — flag vendor integration keys and service-account credentials older than the rotation policy that remain active.
139186. **Cross-tenant vendor data flow mapper** — trace data flows through vendor integrations to confirm tenant isolation holds at each handoff.
139187. **Vendor breach-notification readiness check** — verify contact and escalation details exist for every integrated vendor so incidents trigger notifications fast.
139188. **Subprocessor change monitor** — track published subprocessor lists of key vendors for additions that expand the trust boundary.
139189. **Data-processing-agreement coverage audit** — check that every vendor handling personal data has a current DPA on file mapped to the right integration.
139190. **Open-source funding health signal** — incorporate project funding and sponsorship status as a sustainability signal in dependency risk scoring.
139191. **Dependency confusion canary packages** — publish inert canary packages under internal namespaces on public registries to detect resolution-order misconfigurations.
139192. **Registry namespace reservation audit** — verify the organization reserved its namespaces and scopes on public registries to block preemptive squatting.
139193. **Package publish cadence anomaly alert** — alert when a dependency publishes versions at an abnormal rate, which often precedes or accompanies compromise.
139194. **Post-install network call monitor** — observe network activity during dependency installation in a sandbox to catch packages phoning home at install time.
139195. **Dependency egress allowlist builder** — derive the set of hosts dependencies contact at install and runtime to build least-privilege egress policies.
139196. **SBOM exchange format normalizer** — normalize SBOMs across CycloneDX and SPDX formats into one canonical model so audits compare apples to apples.
139197. **Vulnerability disclosure SLA tracker** — track time from advisory publication to patched deployment per dependency to measure the remediation SLA.
139198. **Patch backport feasibility scorer** — score whether a security fix can be backported to the pinned version when upgrading the dependency is not viable.
139199. **Breaking-change upgrade path planner** — map major-version upgrade paths with breaking changes enumerated so security upgrades can be scheduled safely.
139200. **Dependency policy gate designer** — encode allowed registries, license lists, and freshness thresholds into CI gates that block risky dependency changes.
139201. **Third-party risk tiering engine** — tier vendors by data access, criticality, and substitutability to focus deep assessments on the highest-impact integrations.
139202. **Vendor security questionnaire autofill** — pre-populate vendor security questionnaires from collected integration evidence to speed up third-party reviews.
139203. **Continuous vendor posture rescorer** — re-score vendor risk on every code or config change touching integrations so posture never goes stale.
139204. **Supply-chain incident tabletop generator** — generate scenario-based tabletop exercises from the project's actual dependency graph to rehearse incident response.
139205. **Program scope snapshot versioning** — version every scope snapshot with a hash and timestamp so scope changes over time become auditable and findings can be pinned to the scope that was live when they were tested.
139206. **Scope-diff change feed** — poll the program page on a schedule and emit a structured added/removed asset diff so hunts always start on the freshest attack surface first.
139207. **Scope-addition freshness ranking** — rank newly added scope assets by hours since listing so the least-probed targets get tested before competitors arrive.
139208. **Scope-removal evidence freeze** — freeze the evidence package the moment an asset leaves scope so findings stay submittable under the scope window that applied during testing.
139209. **Scope text semantic diffing** — diff scope-page prose semantically rather than by raw string so reworded boundaries and softened exclusions are caught instead of missed.
139210. **Wildcard-scope mutation detector** — detect wildcard-to-explicit (and reverse) scope conversions and remap the effective attack surface automatically when the boundary shape changes.
139211. **Scope CIDR change reconciliation** — reconcile announced CIDR changes against actual advertised ranges so silent scope shrinkage cannot hide live assets from the test queue.
139212. **Scope rule compiler for boundaries** — compile program scope prose into executable include/exclude matchers so every request the agent issues is auto-checked against current scope.
139213. **Scope version stamping on findings** — stamp each finding with the exact scope version hash tested against so triagers can verify boundary compliance without follow-up questions.
139214. **Public-disclosure fingerprint matcher** — fingerprint candidate findings and match them against public disclosure reports so known-fixed bugs are never submitted as duplicates.
139215. **Hacktivity disclosure stream index** — ingest the public Hacktivity stream and index disclosed bugs per target so the agent warns itself before retesting an already-burned endpoint.
139216. **Disclosure embargo tracker** — track disclosure embargo periods per program so findings that are disclosed but not yet fixed stay out of the retesting queue.
139217. **Fixed-version fingerprint guard** — record the patched versions named in disclosures and skip any finding that only reproduces on an already-fixed build.
139218. **Duplicate-risk score per finding** — score each candidate finding's duplicate probability from disclosure-text similarity so only low-risk findings go to submission.
139219. **Disclosed-endpoint cool-down map** — map endpoints mentioned in disclosures and cool them down for a configurable window so effort moves to unreported surface.
139220. **CVE-to-disclosure linker** — link program disclosures to CVE records so the agent detects when a public CVE already covers the finding and avoids the duplicate.
139221. **Disclosure comment fix-miner** — mine disclosure comments for fix-confirmation signals so the agent knows when a previously reported bug is genuinely closed.
139222. **Disclosure-rate anomaly flag** — flag programs whose public disclosure rate suddenly spikes as duplicate-heavy environments and reroute hunting hours elsewhere.
139223. **Self-duplicate cross-hunt ledger** — keep a tamper-proof ledger of every submitted finding across hunts so the agent never reports its own past work twice.
139224. **Payout-band heatmap per vuln class** — aggregate reported payouts into bands per vulnerability class so testing effort targets the classes that historically pay.
139225. **Severity-to-payout calibration curve** — build per-program curves mapping severity tiers to real payout ranges so effort never chases low-severity classes that pay little.
139226. **Payout outlier detector** — flag payouts far above a class median and extract the impact-multiplier techniques behind them for reuse in future hunts.
139227. **Vuln-class ROI leaderboard** — rank vulnerability classes by median-payout-per-hunting-hour so automated effort concentrates on the best-returning classes.
139228. **Payout variance analyzer** — measure payout variance within each class to identify the classes where strong impact write-ups swing rewards the most.
139229. **New-class payout early-warning** — detect when a novel vulnerability class starts appearing in disclosures so the agent learns it before saturation drives payouts down.
139230. **Cross-program class arbitrage finder** — compare the same vulnerability class's payouts across programs to surface programs that overpay for specific bug types.
139231. **Payout-decay curve per class** — model how payouts for a class decay as disclosures accumulate so hunts rotate out of exhausted classes on schedule.
139232. **Impact-multiplier extractor** — extract which impact factors (data type, affected user count, privilege gained) correlate with above-band payouts from disclosure narratives.
139233. **Triage-latency estimator** — predict days-to-triage per program from historical disclosure timestamps so submission timing and cash-flow expectations are planned, not guessed.
139234. **Response-time decay monitor** — monitor a program's actual response times for slowdown trends that signal staffing changes or policy shifts.
139235. **Priority-queue jump predictor** — estimate which severity tiers get fast-tracked triage so critical findings are submitted with the framing that reaches reviewers fastest.
139236. **Holiday-calendar triage model** — model triage-team holiday calendars to predict dead zones where submissions would sit idle and schedule filings around them.
139237. **First-response SLA tracker** — track actual first-response times against stated SLAs to identify programs that consistently over-deliver and deserve priority.
139238. **Resubmission window optimizer** — calculate the optimal resubmission window after a program's triage backlog clears so follow-ups land when reviewers have capacity.
139239. **Triage-stage duration breakdown** — break triage into stages (first response, validation, fix, payout) and model each stage's duration separately for accurate timeline forecasts.
139240. **Weekend-filing timing analysis** — analyze whether weekend-filed submissions get slower or faster triage to optimize the day and hour of each filing.
139241. **Triage-team capacity proxy** — use public disclosure throughput as a proxy for triage-team capacity and predict queue depth before committing hunt hours.
139242. **Scope-expansion alert engine** — fire an alert the moment a program widens scope so fresh assets are hunted before other researchers notice them.
139243. **Acquisition-driven scope predictor** — watch M&A announcements for target organizations to predict incoming scope expansions ahead of the official update.
139244. **Staging-to-prod promotion watcher** — watch staging assets that graduate into production scope and hunt them inside the brief promotion window.
139245. **Subsidiary-onboarding detector** — detect when a new subsidiary brand appears in program scope and map its asset footprint within hours.
139246. **Mobile-app scope add-on alerts** — alert when a program adds mobile apps or their APIs to scope so app-surface coverage starts immediately.
139247. **Wildcard-expansion ripple mapper** — when scope widens to a wildcard, map the full new subdomain space the expansion unlocks for systematic coverage.
139248. **Expansion freshness decay timer** — time-box aggressive hunting on new scope to the first 72 hours, the window when competition is lowest and first-finder advantage is highest.
139249. **Expansion-to-payout lag tracker** — measure the time from scope expansion to the first paid disclosure to validate how quickly fresh scope actually pays.
139250. **Out-of-scope boundary drift detector** — detect when out-of-scope assets merge into in-scope infrastructure through CNAME or IP changes so authorization status is always current.
139251. **Out-of-scope promotion watcher** — watch for previously excluded assets being silently moved into scope so newly testable surface is claimed fast.
139252. **Third-party scope creep monitor** — monitor third-party services that drift into the program's responsibility boundary through integrations or acquisitions.
139253. **Out-of-scope change audit log** — maintain a tamper-evident log of out-of-scope boundary changes so test authorizations stay compliant with the program's current rules.
139254. **Scope-exclusion reason tracker** — track why each asset is excluded so that a reason change (e.g., third-party becomes acquired) triggers automatic re-evaluation.
139255. **Asset-migration boundary-crossing alerts** — alert when an asset migrates across infrastructure in a way that crosses the scope boundary in either direction.
139256. **Out-of-scope DNS drift scanner** — scan DNS records of out-of-scope assets for drift toward in-scope hosting that would change their testable status.
139257. **Shadow-IT scope breach flagger** — flag shadow-IT assets that become in-scope through corporate acquisition before competitors map them.
139258. **Boundary transition diary** — record every out-of-scope to in-scope transition with evidence so findings are timestamped against the correct scope version.
139259. **Reward-effort expected-value ranker** — rank hunt targets by expected payout divided by estimated test hours so effort flows to the highest-ROI surface.
139260. **Test-effort estimator per asset** — estimate hours-to-test each asset from its technology fingerprint to feed the reward-vs-effort model with realistic inputs.
139261. **Quick-win finder** — surface assets where shallow testing historically yields fast payouts so the portfolio keeps producing while deep hunts run.
139262. **Diminishing-returns cutoff advisor** — recommend stopping work on an asset class once its marginal payout drops below the effort threshold.
139263. **Effort-portfolio balancer** — balance the hunt portfolio across quick wins and deep dives so payout cash flow stays steady instead of lumpy.
139264. **Automation-vs-manual ROI comparator** — compare automated-scan ROI against manual-hunt ROI per asset type to allocate compute and human attention where each wins.
139265. **Payout-per-endpoint benchmark** — measure historical payout per tested endpoint so endpoints with near-zero expected value are pruned from the queue.
139266. **Deep-dive trigger thresholds** — define payout-probability thresholds that trigger deep manual-style review of an asset instead of more shallow scanning.
139267. **Effort-budget allocator** — allocate a weekly test-hour budget across programs by expected-value ranking so limited hours go where they earn most.
139268. **Researcher-collision heatmap** — map disclosure density per asset to visualize where other hunters are already working and steer clear of burned ground.
139269. **Hot-zone avoidance router** — route automated hunts away from collision hot zones toward under-researched assets with higher first-finder odds.
139270. **Collision-probability estimator** — estimate the chance a given finding is already reported from disclosure recency and asset popularity before spending effort on it.
139271. **Researcher-activity pulse monitor** — monitor public disclosure velocity per program as a proxy for active researcher competition and hunt counter-cyclically.
139272. **Quiet-asset discovery engine** — find in-scope assets with zero public disclosures that competitors have overlooked and prioritize them.
139273. **Collision-seasonality analyzer** — analyze whether programs get flooded at predictable times (hack events, launch windows) and schedule hunts in the quiet gaps.
139274. **Fresh-disclosure overlap checker** — check new findings against the latest disclosures right before submission to catch near-duplicate reports.
139275. **Researcher-niche mapper** — map which vulnerability classes top researchers focus on per program to find underserved niches with less competition.
139276. **Competition-aware hunt scheduler** — schedule hunts on programs during low-competition windows identified from disclosure timestamps.
139277. **Program-policy change monitor** — watch program policy pages for rule changes (eligibility, report requirements) that alter hunting strategy.
139278. **Bounty-table revision tracker** — track changes to published bounty tables so priority rankings update the moment payouts move.
139279. **Safe-harbor clause change alerts** — alert when safe-harbor or legal language changes since it redefines the authorized testing boundary.
139280. **Disclosure-policy shift detector** — detect shifts between private and public disclosure policies that change duplicate-submission risk.
139281. **Reward-eligibility rule parser** — parse eligibility rules into structured conditions so the agent knows exactly which finding types qualify for payout.
139282. **Submission-template change watcher** — watch for changes to required report templates so submissions are never rejected on formatting grounds.
139283. **Scope-exclusion rule updater** — automatically update the agent's exclusion rules when program policy adds new exclusions.
139284. **Policy-change impact digest** — produce a human-readable digest of every policy change per program with its practical impact on hunting.
139285. **Policy-change strategy re-planner** — re-rank hunt priorities automatically when a policy change alters the reward landscape.
139286. **Historical payout benchmark dashboard** — benchmark median and top-quartile payouts per program against industry peers for honest program selection.
139287. **Payout-trend forecaster** — forecast payout trends per program so the agent hunts programs on an upward payout trajectory rather than a declining one.
139288. **Program-generosity index** — compute a generosity score per program from payout-to-severity ratios to compare programs on fairness, not just top bounties.
139289. **Payout-consistency scorer** — score programs on payout consistency since erratic payouts waste effort on write-ups that never pay fairly.
139290. **Peer-program comparator** — compare two similar programs side-by-side on payout, speed, and scope breadth to pick the better hunting target.
139291. **Vintage-payout adjuster** — adjust old payout data for inflation and program maturity so historical benchmarks stay comparable across years.
139292. **Payout-transparency rater** — rate programs on how openly they disclose payout amounts, favoring programs whose data is reliable enough to plan on.
139293. **Benchmark-driven goal setter** — set per-program payout targets from historical benchmarks so hunt performance is measured against reality.
139294. **Asset-value scoring engine** — score each in-scope asset by business value (user data handled, revenue touch) to prioritize the highest-impact targets.
139295. **Data-sensitivity classifier** — classify assets by the sensitivity of the data they handle so PII-rich targets receive deeper testing.
139296. **Revenue-path asset mapper** — map which assets sit on the revenue path since business-critical systems carry higher bounty impact.
139297. **User-base size estimator** — estimate exposed user counts per asset from public signals to weight findings by potential impact.
139298. **Crown-jewel identifier** — identify crown-jewel assets (authentication, payments, administration) that deserve the deepest hunt investment.
139299. **Asset-value-weighted test queue** — order the test queue by asset-value scores so the most valuable surface is tested before the marginal surface.
139300. **Acquisition-value adjuster** — adjust asset values when acquisitions change which assets matter most to the program owner.
139301. **Public-exposure scorer** — score assets by public exposure (indexed endpoints, published API docs) since exposure multiplies exploitability value.
139302. **Asset-criticality change tracker** — track criticality changes over time as assets gain users or features so priority follows the asset's real importance.
139303. **Value-adjusted finding scorer** — re-score findings by the value of the affected asset, not just the vulnerability class, so impact ratings reflect business reality.
139304. **Cross-program asset dedup map** — map the same asset appearing across multiple programs so effort and findings are routed to the program that pays best for it.
139305. **Universal-link AASA drift monitor** — continuously re-fetch the apple-app-site-association file and diff it against the app's registered applinks entitlements so routing gaps surface before attackers claim them.
139306. **AssetLinks cross-host consistency checker** — verify every host in the assetlinks.json fingerprint list actually serves the same SHA-256 signing identity the app trusts, catching partial deployments that break link verification.
139307. **Deep-link query allowlist inference** — crawl declared deep-link paths and infer which query parameters the backend honors versus ignores, flagging parameters that change server-side behavior without documentation.
139308. **Intent-filter priority collision scanner** — compare exported intent-filters across the app and known installed packages for overlapping data schemes where a rival app could intercept routing.
139309. **Custom-scheme namespace squat watch** — monitor for newly published apps registering the target's custom scheme on test devices so hijack attempts are caught during the hunt, not after release.
139310. **Deep-link nonce replay window analyzer** — measure how long single-use tokens embedded in deep links stay valid and whether replaying them on a second device succeeds, exposing overgenerous replay windows.
139311. **Fallback-webpage token-spill review for broken universal links** — inspect the web fallback pages served when universal links fail verification for session or state tokens that leak before the app ever opens.
139312. **Post-install attribution claim-guard test** — verify deferred install links bind to the installing device's identity rather than being claimable by a different handset, since loose binding enables attribution theft.
139313. **Deep-link state desync detector** — compare the app state reached via deep link against the state reachable through in-app navigation to find privileged screens the router exposes but the menu hides.
139314. **Applinks verification-log forensics** — parse iOS swcd and Android Digital Asset Links verification logs on test devices to find hosts the OS rejected silently, revealing misconfigured verification the app never reports.
139315. **Exported activity surface mapper** — enumerate every exported activity, service, and receiver with their intent-filters and required permissions to build the complete externally reachable component map.
139316. **Exported provider directory-escape probe** — test exported providers for path-traversal in URI segments under authorized assessment, since providers often lack the sanitization web endpoints get.
139317. **Implicit-intent broadcast eavesdrop audit** — list implicit broadcasts the app sends and verify they carry no sensitive extras, because any app on the device can register for implicit broadcasts.
139318. **PendingIntent mutability reviewer** — flag PendingIntents created without explicit mutability flags or with overly broad target components, since mutable intents let recipients redirect privileged actions.
139319. **Exported service intent-fuzz harness** — send malformed intents to exported services on an authorized test build and classify crashes versus safe rejections to find denial-of-service and injection sinks.
139320. **Content-provider SQL projection audit** — test exported providers' query, update, and delete entry points for injection through projection and selection arguments, which mirror SQLi in a mobile context.
139321. **Receiver permission-enforcement matrix** — cross-tabulate every exported receiver against the permission it declares and verify the OS actually enforces it on the target API levels.
139322. **Activity task-affinity hijack review** — check exported activities for taskAffinity values matching other apps or the launcher, a classic UI-redressing vector for overlaying trusted screens.
139323. **Intent extra deserialization watchdog** — monitor exported components for unsafe deserialization of intent extras, since a crafted extra can reach object-graph gadgets in the app's own classpath.
139324. **FileProvider path-strategy auditor** — review FileProvider path definitions for overly broad roots that let a granted URI read files outside the intended share directory.
139325. **Mobile API contract drift fuzzer** — replay captured app traffic against the backend with mutated fields to detect undocumented parameters the server honors, exposing shadow API surface.
139326. **API version sunset enforcement check** — verify deprecated app API versions actually reject traffic rather than silently serving stale, less-guarded endpoints that older app builds still call.
139327. **Mobile backend device-binding verifier** — confirm tokens issued to one device fingerprint stop working when presented from another, since many mobile backends skip binding entirely.
139328. **App-version attestation gate tester** — check whether the backend rejects requests from outdated or tampered app versions, or whether version headers are purely cosmetic.
139329. **Certificate transparency mobile-endpoint watch** — track newly issued certs for the app's API hosts to catch shadow backends spun up for new features before they are hardened.
139330. **Push-token to session linkage audit** — verify push registration tokens are bound to the authenticated session and invalidated on logout, preventing cross-account notification leakage on shared devices.
139331. **Mobile GraphQL introspection gate check** — probe the app's GraphQL endpoint for introspection and field-suggestion leaks that the web client hides but the mobile client may leave open.
139332. **Offline-queue replay integrity test** — capture requests the app queues while offline and replay them with tampered payloads to see whether the server re-validates on sync or trusts the queue.
139333. **Background-sync token refresh reviewer** — inspect how the app refreshes tokens during background sync and whether refresh failures degrade to unauthenticated calls that still succeed.
139334. **Mobile rate-limit parity audit** — compare rate limits enforced on mobile API routes against their web equivalents, since mobile routes are frequently throttled less aggressively.
139335. **Pinning test-harness orchestrator** — run the app against a MITM proxy with a non-pinned CA on an authorized test device and record exactly which hosts reject the connection, producing a per-host pinning map.
139336. **Pin rotation grace-period monitor** — track backup-pin usage during certificate rotations to confirm the app accepts the new chain without falling back to unpinned connections.
139337. **Debug-build pinning bypass detector** — check whether debug or internal builds disable pinning via network-security-config flags that could leak into release artifacts.
139338. **Third-party SDK pinning gap finder** — identify analytics, crash-reporting, and ad SDK traffic that bypasses the app's pinning policy, since SDKs often open their own unpinned connections.
139339. **Pinning failure telemetry review** — verify pinning failures generate server-side alerts rather than silent retries, because silent fallback is how pinning gets quietly disabled.
139340. **Local proxy trust-anchor audit** — confirm the app does not trust user-installed CAs on release builds, which would let any device-owner proxy decrypt pinned traffic.
139341. **OTA bundle signature gatekeeper check** — validate that over-the-air update manifests are signed and that the app rejects manifests with valid structure but invalid signatures.
139342. **Staged-rollout integrity checker** — verify staged or phased rollouts deliver identical binaries to each cohort and that cohort targeting cannot be manipulated to serve a downgraded build.
139343. **Version rollback refusal tester** — test whether the app refuses to install an older signed build over a newer one, since missing downgrade protection enables rollback to vulnerable versions.
139344. **Binary-diff update integrity trial** — tamper with binary-diff update packages on an authorized test setup to confirm the updater validates the reconstructed full binary, not just the patch.
139345. **In-app update API spoofing review** — check the Play Core / App Store update flow for server responses the app trusts without signature verification, such as forced-update flags.
139346. **WebView JavaScript bridge inventory** — enumerate every addJavascriptInterface object and WKScriptMessageHandler name, documenting which native methods each exposes to web content.
139347. **WebView bridge least-privilege scorer** — rate each bridge method by the native capability it exposes and flag methods whose privilege exceeds what the loaded pages legitimately need.
139348. **WebView file-access flag audit** — verify setAllowFileAccess and setAllowFileAccessFromFileURLs are disabled unless the feature provably needs them, since they turn any WebView into a local file reader.
139349. **WebView insecure-subresource policy review** — confirm WebViews block or upgrade HTTP subresources on HTTPS pages, as mixed content in a WebView bypasses the browser's normal indicators.
139350. **WebView SSL-error handler review** — inspect onReceivedSslError implementations for proceed() calls that silently accept invalid certificates in production builds.
139351. **WebView cache credential sweep** — scan WebView cache, DOM storage, and databases for session tokens or PII persisted after logout, which survive longer than developers expect.
139352. **Deep-link-in-WebView routing guard** — test whether links opened inside WebViews respect the same authentication and authorization checks as native deep-link handlers.
139353. **Biometric fallback strength grader** — evaluate what the app falls back to when biometrics fail or are unenrolled, grading whether the fallback matches the biometric's assurance level.
139354. **Biometric prompt tamper-resistance test** — verify the biometric prompt cannot be bypassed by instrumentation on a rooted test device without triggering the app's integrity checks.
139355. **Biometric crypto-object binding check** — confirm biometric authentication gates a keystore crypto operation rather than a boolean flag, since boolean checks are trivially patched.
139356. **Face-versus-fingerprint policy audit** — check whether the app distinguishes biometric modalities and their strength classes instead of accepting any enrolled biometric for high-value actions.
139357. **New-biometric enrollment trust-reset check** — verify the app invalidates keys or re-authenticates when new biometrics are enrolled, closing the window where an added fingerprint inherits trust.
139358. **Push payload PII redactor audit** — inspect push payloads for personal data, one-time codes, or balance figures that appear on lock screens and in notification history.
139359. **Silent-push command surface review** — enumerate actions the app performs on silent pushes and verify each requires a valid authenticated session, since pushes arrive unauthenticated.
139360. **Push deep-link re-authentication probe** — open privileged screens from push notification taps with an expired session to confirm the app re-authenticates instead of trusting the tap.
139361. **Notification action intent audit** — review the intents behind notification action buttons for exported components or unprotected extras that other apps could invoke.
139362. **Push registration token rotation check** — verify push tokens rotate on logout, reinstall, and account switch rather than persisting across identities on shared devices.
139363. **Keystore auth-binding constraint reviewer** — verify keys in the Android Keystore or iOS Secure Enclave carry setUserAuthenticationRequired and appropriate validity durations instead of default-weak constraints.
139364. **Encrypted-database key lifecycle review** — check how SQLCipher or Realm encryption keys are generated, stored, and rotated, since hardcoded or never-rotated database keys are common.
139365. **SharedPreferences / UserDefaults secret sweep** — scan on-device preference stores for tokens, API keys, or PII that should live in the keystore or keychain instead.
139366. **External-storage write audit** — flag app data written to shared external storage where any app with storage permission can read it, including cached downloads and logs.
139367. **Backup-exclusion manifest check** — verify sensitive files are excluded from Auto Backup and iCloud backup via allowBackup rules and Data Protection classes, so device backups don't leak secrets.
139368. **Memory-dump secret harvest test** — capture a heap dump of the running app on an authorized test device and search for credentials or keys held in plaintext beyond their needed lifetime.
139369. **Clipboard write-minimization review** — identify every place the app copies sensitive data to the clipboard and check for automatic clearing or the sensitive-content flag.
139370. **Clipboard read-behavior audit** — verify the app does not read clipboard contents on launch or foreground without user action, a behavior both stores penalize and attackers abuse.
139371. **Secure-flag screen-capture blockade test** — confirm FLAG_SECURE or equivalent protections on screens showing PII, and verify the guard cannot be toggled by an in-app setting without re-authentication.
139372. **Recent-apps thumbnail redaction test** — check that the app snapshot shown in the task switcher obscures sensitive screens rather than caching a readable thumbnail.
139373. **Jailbreak-detection coverage mapper** — enumerate the signals the app checks (suspicious paths, packages, system properties) and identify which common rooted environments evade all of them.
139374. **Root-detection response grader** — classify what the app actually does on detection — hard block, degraded mode, or silent log — since detection without enforcement is theater.
139375. **Frida-instrumentation resilience probe** — attempt standard dynamic-instrumentation hooks on an authorized test build and record which tamper checks fire, measuring defense-in-depth rather than claiming bypass.
139376. **Emulator-detection fidelity test** — run the app in common emulators and record whether detection triggers, because hunts that only run on emulators need to know the blind spot.
139377. **Tamper-detection signal correlator** — combine integrity signals (signature check, installer verification, debugger flags) into one posture score instead of trusting any single check.
139378. **Repackaged-app install-source verifier** — confirm the app validates its installer package name and signing certificate at runtime so sideloaded clones are rejected.
139379. **Runtime hook-detection self-test** — verify the app detects common hooking frameworks' artifacts in its own process and escalates to its integrity backend on authorized test devices.
139380. **Debug-flag residue scanner** — scan release artifacts for debuggable flags, staging URLs, and verbose logging that survived the release pipeline.
139381. **Logcat / os_log PII scrubber audit** — review everything the app logs at runtime for tokens or personal data, since logs persist on-device and in bug reports.
139382. **Analytics event allowlist reviewer** — compare the analytics events the app actually emits against an allowlist to catch PII smuggled inside custom event properties.
139383. **Crash-report data minimization check** — inspect crash reports for memory contents, breadcrumbs, or user data attached beyond what's needed to diagnose the crash.
139384. **Permission-request justification mapper** — map every runtime permission request to the feature that needs it and flag permissions requested without a visible user-facing reason.
139385. **Background location-access reviewer** — verify background location is requested only when a foreground feature justifies it and that the app degrades gracefully when denied.
139386. **Accessibility-service usage audit** — check whether the app requests accessibility access and confirm it cannot observe or inject input into other apps' sensitive screens.
139387. **Overlay-permission abuse surface check** — review SYSTEM_ALERT_WINDOW usage for overlay screens that could be repurposed for tapjacking on authorized test builds.
139388. **Wi-Fi and network-state leakage audit** — verify the app does not transmit SSID, BSSID, or network details to analytics endpoints without consent, since they fingerprint user location.
139389. **Device-identifier rotation policy check** — confirm the app avoids persistent hardware identifiers in favor of resettable ones and documents its identifier retention policy.
139390. **Secure deletion verification** — confirm that account-deletion flows actually wipe keystore keys, encrypted databases, and cached files rather than just clearing the UI session.
139391. **Multi-account data-isolation tester** — switch accounts on one device and verify the previous account's cached data, tokens, and files are inaccessible to the new session.
139392. **Cleartext-traffic carve-out enumerator** — enumerate NSAppTransportSecurity exceptions and Android cleartext-traffic allowances to find hosts the app deliberately leaves unencrypted.
139393. **Deep-link analytics attribution leak check** — inspect redirect chains behind marketing deep links for tokens or identifiers forwarded to third-party attribution domains.
139394. **Mobile threat-model freshness review** — verify the app's documented threat model covers the shipped feature set, flagging features added since the last review that never got a security pass.
139395. **StoreKit-Play purchase-verification backend check** — confirm purchase receipts are verified server-side with the platform's API rather than trusted from client-side callbacks.
139396. **Promo-code and entitlement sync check** — verify promotional entitlements sync from the server on each launch instead of relying on client-side flags that survive reinstall.
139397. **Session-fixation on reinstall test** — check whether reinstalling the app or clearing data invalidates server-side sessions, since stale sessions on a fresh install enable account confusion.
139398. **New-device step-up verification reviewer** — review the flow when a user signs in from a new device to confirm step-up verification triggers before sensitive actions are allowed.
139399. **QR-code payload validation review** — test QR and barcode scanning flows for payloads that reach privileged handlers, ensuring scanned content is validated like any untrusted input.
139400. **NFC intent-handler scope audit** — review NFC-discovered intents to confirm they route to a narrow handler rather than the general deep-link router with full privileges.
139401. **Lightweight-app variant cross-share limiter audit** — verify lightweight app variants share no more data with the full app than documented and cannot escalate to full-app capabilities.
139402. **Glanceable-surface sensitive-data exposure audit** — inspect home-screen widgets and live activities for sensitive data rendered where lock-screen or screenshot protections don't apply.
139403. **Siri-shortcut and assistant-intent audit** — review voice-assistant intents the app donates for actions that should require in-app authentication before executing.
139404. **Mobile CI secret-leak scanner** — scan the mobile build pipeline for signing keys, API tokens, or keystore passwords committed to repos or baked into build scripts.
139405. **Agent tool-permission least-privilege mapper** — enumerates every tool the agent can invoke and flags permissions it never uses, because dormant tool access silently widens blast radius.
139406. **Tool-call confirmation-bypass detector** — tests whether destructive tools can be called without the confirmation step the policy promises, because skipped confirmations let an agent act on untrusted input alone.
139407. **Cross-tool credential-share monitor** — watches whether credentials retrieved by one tool get passed into another tool's arguments, because tool-to-tool secret flow turns one over-privileged tool into full credential theft.
139408. **Agent tool timeout-escalation watcher** — measures whether agents expand their tool permissions after a tool times out or errors, because fallback privilege grants erase the original least-privilege boundary.
139409. **Unused-tool grant revocation recommender** — correlates tool-call logs against grants and recommends revoking tools with zero calls in 90 days, because stale grants survive long after the feature that needed them.
139410. **Tool-output trust-level annotator** — labels each tool's output with a trust tier before it re-enters the agent's context, because unmarked untrusted output gets treated as agent instructions.
139411. **Privileged-tool dual-approval enforcer** — requires a second approval step for tools that write, delete, or send external data, because a single tap or silent approve lets injected content drive real side effects.
139412. **Tool-scope drift detector** — compares granted tool scopes at deployment time against current grants on every agent start, because scope drift through redeploys quietly accumulates new dangerous capabilities.
139413. **RAG document provenance registrar** — records the origin, crawl time, and uploader identity for every document admitted to the index, because unprovenanced chunks let an attacker plant content no one can trace.
139414. **RAG source trust-tier assigner** — scores each data source by domain authority, update cadence, and contributor verification before weighting retrieval, because flat trust lets poisoned wiki mirrors rank beside official docs.
139415. **RAG ingestion sanitization auditor** — verifies that ingested documents pass through HTML and script stripping plus markup-injection scrubbing before chunking, because raw ingested HTML can smuggle instructions into retrieved context.
139416. **RAG chunk boundary injection detector** — scans chunk edges for sentences that read as instructions to the model rather than content, because chunking can stitch attacker prose directly into the prompt.
139417. **RAG retrieval poisoning canary** — plants unique canary phrases in each source document and alerts when a canary appears in answers without attribution, because canaries prove which untrusted source steered the output.
139418. **RAG source-update integrity watcher** — hashes indexed documents and flags silent edits to previously trusted sources, because a trusted source edited after approval becomes a fresh attack surface.
139419. **RAG stale-document decay policy** — expires chunks whose source pages have been removed or significantly rewritten, because stale cached content lets removed advisories keep influencing answers.
139420. **RAG multi-tenant source isolation verifier** — confirms each tenant's documents live in isolated namespaces with no cross-tenant retrieval leakage, because one shared index leaks tenant A's secrets to tenant B's queries.
139421. **RAG chunk-embedding inversion tester** — checks whether stored embeddings can be inverted to recover verbatim source text, because invertible embeddings turn the vector store into a readable document dump.
139422. **Prompt-injection defense regression harness** — replays a maintained corpus of injection attempts against every model update and diffs defense outcomes, because silent regressions in new checkpoints quietly re-open fixed holes.
139423. **Delimiter-injection robustness tester** — probes whether the app's prompt delimiters survive user content that mimics the delimiter syntax, because forged delimiters let user text masquerade as system instructions.
139424. **Indirect-injection chain simulator** — chains an injection through tool output to agent memory to a later tool call and checks each link's defenses, because single-turn tests miss multi-hop exfiltration.
139425. **Defense-depth coverage mapper** — maps which injection techniques are covered by input filters, model-level guardrails, and output filters separately, because stacked defenses with the same gap in all three layers are no defense at all.
139426. **Instruction-hierarchy stress tester** — verifies that system instructions consistently override conflicting user or tool-content instructions across model versions, because hierarchy collapse lets pasted web content command the agent.
139427. **Blocked-injection attempt pattern analyzer** — collects redacted signatures of thwarted injection attempts across production traffic so analysts can spot evolving attack patterns before a bypass succeeds.
139428. **Benign-overlap false-positive tuner** — measures how often defense filters block legitimate inputs like code samples and config text, because overly aggressive filters drive users to disable them entirely.
139429. **Language-shift injection tester** — replays injection attempts translated into the app's supported languages to catch defenses that only work in English, because multilingual apps leave whole language surfaces unguarded.
139430. **Prompt-firewall policy linter** — statically checks prompt-assembly code for missing sanitization at every user-input interpolation point, because one unscrubbed interpolation voids the whole defense plan.
139431. **System-prompt extraction probe suite** — runs benign-sounding extraction probes against authorized staging endpoints and grades leakage severity, because a leaked system prompt hands attackers the exact instruction set to subvert.
139432. **Prompt-confidentiality watermark checker** — embeds a unique canary token in each system prompt and scans model outputs and error logs for it, because canary sightings prove the prompt escaped its trust boundary.
139433. **Partial-prompt inference detector** — checks whether an attacker can reconstruct hidden instructions from refusal wording and consistent behavior patterns, because even paraphrased leakage reveals policy internals.
139434. **System-prompt version drift monitor** — diffs the deployed system prompt hash against the approved version on every deploy, because accidental prompt rollbacks resurrect instructions the team thought were removed.
139435. **Error-path prompt disclosure scanner** — forces 4xx, 5xx, and timeout errors on AI endpoints to see if debug bodies echo system prompt fragments, because error paths routinely bypass output filtering.
139436. **Prompt-leak triage classifier** — scores incoming leak reports by exfiltration completeness and exploitability to prioritize fixes, because teams drown in low-severity paraphrase claims while full verbatim leaks wait.
139437. **Multi-turn extraction session detector** — flags conversation patterns that incrementally reconstruct hidden instructions across many turns, because patient piecemeal extraction defeats single-turn leak filters.
139438. **Prompt-inclusion audit trail** — logs exactly which system prompt version and tool definitions accompanied every model call, because undocumented prompt changes make leaks impossible to scope or attribute.
139439. **Token-burn abuse profiler** — measures cost per authenticated session and flags accounts whose token consumption deviates 10x from baseline, because unlimited generation endpoints become crypto-mining-style burn targets.
139440. **Rate-limit fairness tester** — verifies limits apply per account and per API key rather than per IP alone, because IP-only limits fall to proxy rotation while honest users share the same pool.
139441. **Streaming-abuse early-stop checker** — confirms the endpoint halts generation when the client disconnects mid-stream, because orphaned streams keep burning tokens after the attacker hangs up.
139442. **Concurrent-session token cap enforcer** — tests whether parallel sessions from one account multiply the effective token budget, because per-session limits with no account cap are trivially multiplied.
139443. **Prompt-caching cost bypass auditor** — checks that cached-prefix discounts cannot be weaponized into unbounded cheap inference, because misconfigured caching turns expensive reasoning endpoints into flat-rate compute.
139444. **Abuse-threshold alert pipeline** — wires token-spend anomalies into the security alert queue with automatic key suspension, because finance usually notices abuse weeks after security should have.
139445. **Model-endpoint cost attribution tagger** — tags every inference call with tenant, feature, and key ID so abuse is traceable to a source, because untagged usage makes incident response a guessing game.
139446. **Denial-of-wallet stress simulator** — simulates sustained maximum-context requests to estimate worst-case spend per key, because knowing the ceiling lets teams set limits that actually bound losses.
139447. **PII redaction coverage mapper** — scans prompt, completion, tool-argument, and error logs to verify each PII class is redacted at every write point, because one unredacted log stream defeats the other three.
139448. **Redaction bypass pattern fuzzer** — tests redactors against obfuscated PII such as spaced digits, unicode lookalikes, and split tokens to find gaps, because evasive formatting is designed specifically to dodge regexes.
139449. **Log-retention redaction verifier** — confirms redaction is applied before logs hit persistent storage rather than only at query time, because raw logs in backups outlive any view-time mask.
139450. **Cross-border log residency checker** — verifies LLM logs containing user data stay in the region the privacy policy promises, because model telemetry routinely ships to a different jurisdiction than the app.
139451. **Redaction false-positive tuner** — measures how often legitimate non-PII like order numbers and ticket IDs gets masked and degrades debugging, because over-redaction pushes engineers toward raw-log backdoors.
139452. **Third-party processor log-flow mapper** — documents every external service that receives prompt or completion data and its retention terms, because model providers' logging is a hidden subprocessor relationship.
139453. **Session-replay PII scrubber** — ensures debug session replays strip PII before they can be shared with vendors or support staff, because a support ticket with a full replay leaks the original user's data to strangers.
139454. **Redaction regression test pack** — keeps a corpus of known PII samples and re-verifies redaction after every logging pipeline change, because pipeline refactors silently drop redaction steps.
139455. **Agent memory write-provenance tracker** — tags every memory entry with the source, such as user, tool output, or system, that wrote it, because untagged memories let tool output masquerade as trusted user preferences.
139456. **Memory-poisoning recovery tester** — injects known-bad facts into a staging agent's memory and measures whether correction workflows actually purge them, because most agents have no tested unlearning path.
139457. **Long-term memory integrity auditor** — periodically replays memory-derived decisions against current memory state to detect drift caused by poisoned entries, because poisoned memory changes behavior silently over weeks.
139458. **Memory-summarization injection filter** — checks that the summarization step strips instructional content before compressing conversation into long-term memory, because summarizers faithfully preserve embedded attacker commands.
139459. **Cross-session memory leakage tester** — verifies that one user's memories never surface in another user's session on shared infrastructure, because keyed-by-conversation-ID bugs leak across tenants.
139460. **Memory-write rate limiter** — caps how many memory entries an untrusted input stream can create per session, because flooding memory with junk drowns legitimate entries and biases recall.
139461. **Poisoned-memory blast-radius estimator** — estimates how many past and future decisions a suspect memory entry could have influenced, because incident response needs scope before it can remediate.
139462. **Memory-entry TTL enforcer** — expires memory entries derived from untrusted sources after a configurable window, because permanent poisoned memories mean permanently compromised behavior.
139463. **Episodic-memory access-control gate** — restricts which tools and sub-agents can read or write the agent's long-term memory, because unrestricted memory access turns any tool into a poisoning vector.
139464. **Function-schema injection fuzzer** — tests whether malformed or oversized arguments in tool calls are rejected before execution, because the model will happily emit whatever schema gaps allow.
139465. **Tool-argument type-enforcement checker** — verifies the backend validates argument types against the declared schema rather than trusting model output, because string-typed IDs flow straight into SQL or shell calls.
139466. **Schema-drift deployment guard** — diffs the function schemas the model sees against the backend's actual validators on every deploy, because a schema the model never received invites hallucinated parameters.
139467. **Unexpected-parameter rejection tester** — sends tool calls with extra parameters not in the schema to confirm they are dropped, because extra fields are where secondary instructions get smuggled in.
139468. **Enum-constraint bypass detector** — probes enum-typed arguments with out-of-list values to verify server-side enforcement, because client-side enums are suggestions the model never sees.
139469. **Nested-object depth limiter** — confirms deeply nested tool arguments are rejected or truncated before execution, because recursive payloads crash parsers and deserializers downstream.
139470. **Tool-call idempotency verifier** — checks that retried tool calls with the same idempotency key produce no duplicate side effects, because agents retry aggressively and double-execution doubles damage.
139471. **Tool-output context-budget governor** — enforces per-tool result budgets before outputs re-enter the context window, because a 10MB tool result is both a cost bomb and an injection surface.
139472. **Index-level ACL enforcement tester** — queries the vector index with forged tenant IDs and role claims to verify document-level access controls hold, because embedding-level retrieval routinely bypasses row-level security.
139473. **Retrieval side-channel leak detector** — measures whether ranked results reveal the existence of documents the user cannot read, because score ordering alone can confirm or deny secret documents.
139474. **Chunk-level permission re-checker** — re-validates the requester's permissions at retrieval time rather than trusting index-time labels, because permission changes after indexing leave stale grants searchable.
139475. **Hybrid-search bypass comparator** — compares vector-only, keyword-only, and hybrid retrieval results for the same query to find ACL gaps in one path, because hybrid pipelines often enforce controls in only one retrieval leg.
139476. **Index snapshot exposure scanner** — checks that vector index snapshots and backups inherit the same access controls as the live index, because a public snapshot of a private index is a full data leak.
139477. **Query-embedding inference guard** — tests whether user query embeddings can be reverse-engineered to reveal index contents, because query vectors are logged and shared more freely than documents.
139478. **Retrieval quota per-principal limiter** — caps the number of retrieved documents per user per hour to bound bulk extraction, because unlimited retrieval turns RAG into a document-export API.
139479. **Source-visibility consistency checker** — verifies the citation shown to the user matches the document actually retrieved, because mismatched citations let poisoned chunks hide behind trusted-looking sources.
139480. **Guardrail hold-rate dashboard** — tracks the percentage of adversarial inputs each guardrail layer blocks over time, because a guardrail you cannot measure is a guardrail you cannot trust.
139481. **Bypass-technique coverage matrix** — maps known bypass families such as encoding, roleplay framing, multilingual, and fragmentation against each deployed guardrail, because unmapped techniques are untested techniques.
139482. **Guardrail latency-impact profiler** — measures added latency per guardrail layer under production load, because slow guardrails get disabled during incidents and never re-enabled.
139483. **False-refusal rate monitor** — tracks legitimate requests the guardrails wrongly block, because rising false refusals erode user trust and invite bypass requests.
139484. **Guardrail version A/B comparator** — runs old and new guardrail versions side by side on identical traffic to quantify improvement, because upgrades without measurement can silently weaken protection.
139485. **Bypass-attempt corpus curator** — maintains a versioned corpus of bypass attempts specific to the app's domain for regression testing, because generic public corpora miss the app's unique vulnerable surfaces.
139486. **Guardrail evasion-cost estimator** — estimates the effort an attacker needs to bypass each layer to prioritize hardening, because defenses should be strengthened where evasion is cheapest.
139487. **Output-filter completeness checker** — verifies output filters catch disallowed content the model generates even when input filters are bypassed, because defense-in-depth fails when layers share the same blind spots.
139488. **Guardrail bypass incident playbook** — defines detection, containment, and patch steps for when a bypass succeeds in production, because the first real bypass should not be met with improvisation.
139489. **Output-safety scoring dashboard** — aggregates toxicity, bias, and policy-violation scores per model version and feature, because safety regressions hide in averages unless tracked per release.
139490. **Hallucination-rate tracker** — measures the frequency of fabricated citations and facts in production outputs, because hallucinations in regulated domains become compliance incidents.
139491. **Safety-drift alert trigger** — alerts when output-safety metrics degrade beyond a threshold after a model or prompt change, because drift between audits goes unnoticed for months.
139492. **Per-tenant safety baseline comparer** — compares safety metrics across tenants to spot tenants whose usage patterns trigger disproportionate violations, because one abusive tenant can poison shared safety statistics.
139493. **Adversarial-output red-team scheduler** — automatically schedules red-team probes after every model update and posts results to the dashboard, because manual red-teaming never keeps pace with release cadence.
139494. **Safety-incident timeline correlator** — links safety violations to the exact model version, prompt version, and guardrail config in effect, because root-causing a violation requires the full configuration snapshot.
139495. **Multilingual safety parity monitor** — compares safety scores across the app's supported languages, because models are systematically less safe in lower-resource languages.
139496. **User-report to safety-metric linker** — ties user-flagged outputs to the automated safety scores for the same sessions, because the gap between human flags and machine scores reveals blind spots.
139497. **Base-model provenance ledger** — records the exact model checkpoint, training-data cut, and distributor for every deployed model, because an undocumented model swap voids every prior security assessment.
139498. **Model-artifact integrity verifier** — checks cryptographic hashes of model weights at deployment against the published values, because tampered weights are undetectable at runtime.
139499. **Dependency-poisoning scanner** — audits tokenizer files, adapter weights, and plugin code for unexpected network calls or embedded payloads, because the model supply chain includes far more than the weights.
139500. **Model-card compliance checker** — verifies the deployed model's license, usage restrictions, and safety evaluations match the app's compliance requirements, because a research-only license in production is a legal incident.
139501. **Fine-tune data provenance auditor** — traces every fine-tuning dataset back to its source and consent basis, because poisoned or unlicensed fine-tune data inherits into every downstream model.
139502. **Third-party model API data-flow mapper** — documents exactly which user data reaches external model providers and under what DPA terms, because hosted-model calls are cross-border data transfers by default.
139503. **Model rollback provenance guard** — ensures rollback targets are pinned to previously verified checkpoints rather than "latest", because rolling back to latest can silently deploy an unvetted model.
139504. **Supply-chain SBOM generator** — produces a software bill of materials covering models, tokenizers, adapters, and inference dependencies, because incident response cannot scope what it cannot inventory.
139505. **Least-privilege workflow permission mapper** — parse every workflow YAML into a graph of requested versus actually-used permission scopes and flag grants that exceed observed runtime needs.
139506. **Ephemeral token privilege ceiling review** — enumerate GITHUB_TOKEN and OIDC short-lived token permissions per workflow run and report any write scopes the job never exercises.
139507. **Workflow trigger reachability audit** — map which triggers (fork PRs, issue comments, schedules) can activate privileged workflows and rank them by attacker reachability.
139508. **Organization-wide permission baseline builder** — compute the median permission set across all in-scope workflows and flag outliers requesting broader scopes than their peers.
139509. **Stale permission grant pruning report** — detect scopes requested by workflows that were deleted or idle for 90+ days and recommend removal to shrink the standing attack surface.
139510. **Step-level permission narrowing suggestions** — break job-level permissions down to individual step requirements and generate least-privilege YAML patches for each workflow.
139511. **Cross-repository dispatch permission audit** — review repository_dispatch and workflow_dispatch callers to confirm they cannot escalate into privileged downstream workflows.
139512. **Secret scope blast-radius modeler** — simulate which secrets each workflow permission set could read or exfiltrate and rank workflows by worst-case leakage impact.
139513. **Required-check bypass surface review** — list workflows that modify protected-branch requirements or skip required checks and quantify the merge-guard weakening.
139514. **Permission escalation chain finder** — trace multi-workflow privilege chains where a low-privilege workflow's artifact or output triggers a higher-privilege workflow with attacker-influenced inputs.
139515. **SLSA build provenance generator gap check** — verify every release workflow emits signed SLSA provenance for each shipped artifact and list releases missing attestation coverage.
139516. **Provenance field completeness grader** — score existing SLSA attestations for required fields (builder identity, source digest, invocation parameters) so incomplete attestations are flagged as weak.
139517. **Attestation signature trust-chain verifier** — validate provenance signatures back to a pinned transparency log and flag artifacts whose trust chain terminates at an unpinned or unknown signer.
139518. **Builder identity allowlist enforcement review** — compare the builder identities recorded in provenance against an approved builder list and surface artifacts built by unexpected builders.
139519. **Provenance-to-policy deployment gate** — propose a deployment gate that rejects artifacts whose provenance does not match the declared source repo and commit before promotion.
139520. **Dependency-inclusion provenance tracker** — check that provenance records list resolved dependency digests so tampered transitive dependencies are detectable at verify time.
139521. **Hermetic build declaration auditor** — flag workflows claiming hermetic SLSA builds that still allow network access during the build step, which voids hermeticity guarantees.
139522. **Provenance replay freshness check** — detect attestations reused across multiple releases or timestamps so a stale attestation cannot bless a new artifact.
139523. **Multi-signer provenance quorum review** — assess whether high-value artifacts require quorum signatures from independent builders and flag single-signer releases as weak.
139524. **Attestation storage durability audit** — verify provenance records are stored in immutable, replicated storage and alert when attestations live only in ephemeral CI artifacts.
139525. **Build-log secret redaction coverage scan** — replay recent build logs through a secret-pattern engine and report secrets printed unmasked, including multi-line PEM and JSON service keys.
139526. **Masked-secret partial-leak detector** — detect logs where masked values leak through substring prints, length oracles, or character-at-a-time echo that defeats naive masking.
139527. **Debug-verbose flag secret exposure review** — flag workflows that enable verbose or debug logging on tooling known to dump environment variables, tokens, or connection strings.
139528. **Artifact content secret sweep** — scan published build artifacts (tarballs, wheels, container layers) for embedded credentials that build logs never showed.
139529. **Cache entry secret residue scan** — inspect CI cache archives for secrets captured incidentally from the build filesystem before the cache was uploaded.
139530. **Log retention exposure timer** — compute how long exposed secrets remain retrievable in log archives and prioritize rotation by remaining exposure window.
139531. **Third-party action log exfiltration review** — audit marketplace actions for steps that print environment context or ship logs to external endpoints where secrets could travel.
139532. **Step-summary secret scrubber** — check workflow step summaries and annotations for secrets rendered into markdown that bypasses the runner's log masking.
139533. **Forked-build log visibility audit** — verify that logs from fork pull-request builds do not expose organization secrets to external contributors.
139534. **Secret rotation aftermath validator** — after a leaked secret is rotated, re-scan subsequent builds to confirm the old value no longer appears and no stale references persist.
139535. **Self-hosted runner patch-lag assessor** — inventory OS and tool versions on self-hosted runners and flag machines lagging behind security patches beyond the organization's tolerance window.
139536. **Runner filesystem persistence audit** — check whether self-hosted runners reset to a clean image between jobs and flag persistent runners that let one job's residue reach the next.
139537. **Runner network egress posture review** — profile outbound connections from runners and flag unrestricted egress that would let a compromised job exfiltrate secrets or download tooling.
139538. **Ephemeral runner lifecycle validator** — verify runners are truly single-use (spawned per job, destroyed after) by correlating job timestamps against runner instance lifetimes.
139539. **Runner label targeting risk map** — enumerate self-hosted runner labels and show which workflows any repository in the organization could target to land jobs on privileged runners.
139540. **Container runner privilege review** — inspect container-based runner configurations for privileged mode, host socket mounts, or host PID sharing that breaks job isolation.
139541. **Runner credential scope minimizer** — review the cloud IAM or service-principal credentials mounted on runners and flag standing admin roles that should be job-scoped instead.
139542. **Autoscaler metadata exposure check** — probe runner provisioning APIs and instance metadata endpoints for credential or configuration data reachable from within a job.
139543. **Multi-tenant runner isolation audit** — for shared runner pools, verify job-to-job isolation controls (namespaces, cgroups, disk encryption) and report gaps that enable cross-job snooping.
139544. **Runner decommission hygiene check** — confirm retired runners had their registration tokens revoked and disks wiped so decommissioned machines cannot rejoin the pool.
139545. **Untrusted input sink tracer** — trace attacker-influenced contexts (PR titles, branch names, commit messages, issue bodies) into shell-evaluated workflow expressions and rank each sink by exploitability.
139546. **Interpolation context risk classifier** — classify every ${{ }} expression as safe or dangerous based on whether its value derives from untrusted events, cutting through false-positive-prone blanket rules.
139547. **Script-injection proof-of-concept linter** — statically demonstrate injectability with a benign marker payload analysis that shows exactly which expression would execute without running anything dangerous.
139548. **Event-payload allowlist reviewer** — recommend minimal event payloads per workflow so jobs only receive the fields they need, shrinking the injectable surface.
139549. **Fork-PR workflow isolation gate** — verify that workflows handling fork pull requests run with read-only tokens and no secret access before any untrusted code executes.
139550. **Label-triggered workflow guard audit** — review workflows triggered by label application to confirm label assignment itself requires trusted roles, blocking label-driven execution by outsiders.
139551. **Comment-command parser hardening review** — audit slash-command and bot-triggered workflows for argument injection through comment bodies that reach shell or API calls unsanitized.
139552. **Reusable workflow input contract checker** — validate that called reusable workflows declare typed inputs and that callers cannot smuggle extra attacker-controlled parameters through.
139553. **Matrix dimension injection review** — check matrix strategies built from untrusted lists (changed files, PR labels) for entries that break out of intended values into command contexts.
139554. **Environment variable name-squatting scan** — detect workflow env names that shadow or precede system variables, which can alter tool behavior when inherited by build scripts.
139555. **Deploy-key scope minimization audit** — list every deploy key across in-scope repos, its read/write scope, and flag write keys on repos that only need read access for deployment.
139556. **Deploy-key age and rotation tracker** — age each deploy key and alert on keys older than the rotation policy or keys created by departed contributors.
139557. **Machine-user token inventory** — discover bot and machine-user credentials used for deployment, map their organization-wide permissions, and flag over-privileged automation identities.
139558. **Stale deploy-key orphan detector** — find deploy keys whose creator account is deleted or suspended and recommend immediate removal since no owner can rotate them.
139559. **Key-usage attestation reconciler** — correlate deploy-key usage logs against expected deployment pipelines and flag keys used from unexpected IPs or outside deployment windows.
139560. **SSH known-hosts pinning review** — verify deployment workflows pin destination host keys instead of disabling strict host checking, which would enable man-in-the-middle on deploys.
139561. **Deploy-key to workflow binding map** — trace each deployment credential to the exact workflows and environments that consume it so a compromise can be scoped instantly.
139562. **Fine-grained token migration planner** — identify classic PATs used in deployment workflows and generate migration plans to fine-grained tokens with minimal required scopes.
139563. **Signing-key custody audit** — review who holds artifact and commit signing keys for releases, whether they are hardware-backed, and flag shared or exportable release keys.
139564. **Deployment approval quorum checker** — verify production deployments require the configured number of distinct human approvals and flag paths that allow self-approval or single-approver bypass.
139565. **Promotion-gate evidence collector** — assemble the evidence bundle (tests, scans, attestations, approvals) attached to each environment promotion so missing gates are visible before release.
139566. **Environment secret segregation audit** — confirm production secrets are not readable from staging or development workflows through shared variable groups or inherited environments.
139567. **Manual-gate timeout abuse review** — check whether approval gates expire or auto-approve on timeout, which would let deployments proceed without genuine human review.
139568. **Deployment freeze enforcement monitor** — verify change-freeze windows actually block promotion pipelines and flag emergency-bypass paths that skip the freeze.
139569. **Rollback-path integrity check** — confirm rollback workflows restore the previously attested artifact rather than rebuilding from a potentially different source state.
139570. **Blue-green artifact parity verifier** — compare the artifact deployed to the new environment against the attested build digest to catch substitution during promotion.
139571. **Environment protection-rule drift scan** — detect protection rules on production environments that were weakened or removed since the last compliance review.
139572. **Canary analysis gate reviewer** — audit automated canary promotion criteria for thresholds that are too lax, allowing a failing canary to auto-promote to full production.
139573. **Post-deploy verification hook audit** — ensure promotion pipelines include post-deployment health and security checks and flag gates that mark success on deploy-start rather than verified health.
139574. **Cache key collision predictor** — analyze cache key templates for attacker-influenced components (branch names, PR numbers) that let a malicious build poison the cache key a privileged build later reads.
139575. **Cache scope boundary reviewer** — verify caches are scoped per branch or per actor so a fork pull-request cache cannot be restored by a base-branch privileged workflow.
139576. **Poisoned-cache detection heuristics** — define behavioral signals (unexpected binary timestamps, modified lockfiles, new network calls) that reveal a restored cache was tampered with.
139577. **Cache upload provenance tagger** — recommend tagging each cache entry with the workflow identity that created it so restores can require matching-identity caches only.
139578. **Dependency cache integrity verifier** — check that restored dependency caches are re-verified against lockfile hashes instead of being trusted blindly on restore.
139579. **Cache eviction hygiene audit** — review cache retention and eviction policies to ensure poisoned or stale entries age out instead of persisting indefinitely.
139580. **Cross-workflow cache sharing map** — map which workflows read caches written by other workflows and flag read paths where the writer is less trusted than the reader.
139581. **Cache encryption-at-rest review** — verify CI cache storage encrypts entries and restricts access so cache archives cannot be read or modified outside the pipeline.
139582. **Cache size anomaly alerter** — flag sudden cache size or content-type changes that suggest an attacker stuffed malicious payloads into a shared cache entry.
139583. **Restore-key fallback risk grader** — grade restore-key fallback chains for how easily an attacker-controlled partial key match can serve a poisoned entry to a privileged build.
139584. **Dual-environment rebuild parity prover** — rebuild release artifacts twice in isolated environments and diff the outputs byte-for-byte to prove builds are reproducible.
139585. **Build environment pinning auditor** — verify base images, toolchain versions, and dependency mirrors are pinned so the same inputs always produce the same artifact.
139586. **Timestamp normalization checker** — detect non-normalized timestamps, build paths, and ordering in artifacts that break reproducibility and mask tampering.
139587. **Independent rebuild verifier** — support third-party rebuilds by publishing full build instructions and input digests so anyone can confirm the shipped artifact matches the source.
139588. **Reproducibility regression tracker** — track reproducibility status per release over time and alert when a previously reproducible build starts producing divergent outputs.
139589. **Source-to-artifact correspondence prover** — cryptographically link the released artifact to its exact source commit and build inputs so substitution is detectable by any verifier.
139590. **Build-input manifest publisher** — generate a complete, signed manifest of every input (source, dependencies, tools, environment) consumed by a release build.
139591. **Non-determinism source localizer** — when rebuilds diverge, bisect build inputs to pinpoint which dependency or tool introduced the non-determinism.
139592. **Reproducible container layer audit** — verify container image layers are reproducible and ordered deterministically so layer-level tampering is visible.
139593. **Signed build-log archiver** — store tamper-evident, signed build logs alongside artifacts so post-release audits can replay exactly what the build did.
139594. **IaC drift baseline snapshotter** — capture the approved desired state of in-scope infrastructure repositories and snapshot it for continuous drift comparison.
139595. **Live-state drift differ** — compare actual cloud resource configurations against the IaC-declared state and report unmanaged changes that bypassed review.
139596. **Drift-to-PR correlator** — link each detected drift item to the pull request or manual change that introduced it so unauthorized changes are attributable.
139597. **Secret-in-IaC scanner** — scan Terraform, CloudFormation, and Pulumi definitions for hardcoded credentials, keys, and tokens committed to in-scope repositories.
139598. **IaC policy-as-code gate reviewer** — audit policy checks (OPA, Sentinel, Checkov) in the IaC pipeline for coverage gaps and rules that warn without blocking.
139599. **Plan-output sensitive leak check** — review IaC plan outputs and PR comments for sensitive values rendered in plaintext during automated plan reviews.
139600. **Module source pinning auditor** — verify IaC modules are pinned to immutable versions or digests rather than floating branches that could change under a reviewed plan.
139601. **State-file access control review** — audit who can read and write Terraform state files, since state often contains secrets and enables direct infrastructure manipulation.
139602. **Drift auto-remediation dry-run reporter** — simulate automatic drift remediation and report what would change, so teams can approve corrections without blind auto-applies.
139603. **IaC change blast-radius estimator** — estimate which production resources each IaC change touches before apply, prioritizing review effort on high-impact changes.
139604. **Compliance-mapped IaC control checker** — map IaC configurations to compliance controls (encryption, logging, network segmentation) and flag in-scope repos missing required controls.
139605. **Firmware-image intake manifesting** — normalize every received image (vendor, model, build hash, capture timestamp) into a versioned manifest so hunts never analyze the wrong build.
139606. **Cross-build version-diff triage** — binary-diff successive firmware images to surface only changed binaries and configs, focusing hunt effort on the delta attack surface.
139607. **Stale-image fleet exposure dashboard** — track which deployed devices run outdated firmware and prioritize hunts where fleet exposure is largest.
139608. **Firmware-build provenance chaining** — record source URL, checksum, and download metadata per image so findings map back to verifiable builds.
139609. **Vendor-release cadence profiling** — measure release frequency and patch latency per vendor to predict the next vulnerable-window period.
139610. **Multi-image library dedup clustering** — cluster images by shared rootfs hashes to avoid re-analyzing identical builds across device models.
139611. **End-of-life firmware flagging** — flag images past vendor support dates so hunts weight unpatched drift more heavily.
139612. **Silent-variant detection** — detect same-version images whose hashes differ (region variants, silent patches) and queue both for comparison.
139613. **Beta-debug build identification** — identify non-production builds (dev flags, debug symbols) that expose more surface than release images.
139614. **Image-version coverage heatmap** — map analyzed images against the installed-base census to quantify coverage gaps.
139615. **Hardcoded-credential entropy scanner** — scan extracted filesystems for high-entropy strings adjacent to credential-shaped keys (passwd, token, api_key).
139616. **Compiled-binary string credential mining** — run strings-plus-regex pipelines over ELF binaries to catch secrets embedded at compile time.
139617. **Config-file credential baseline** — diff extracted /etc configs against vendor defaults to isolate administrator-added secrets.
139618. **Base64-blob credential decoding sweep** — decode base64 blobs in scripts and configs to reveal secrets hidden behind one encoding layer.
139619. **Credential-reuse blast-radius graph** — link identical credentials across multiple firmware images to quantify the blast radius of one leak.
139620. **Test-account residue detection** — detect leftover QA and test accounts in shadow and passwd files shipped in production images.
139621. **SSH authorized-keys inventory** — extract authorized_keys files from images to enumerate baked-in remote-access trust relationships.
139622. **Cloud-key pattern matching** — match extracted strings against known cloud-key formats in firmware dumps for authorized review.
139623. **Encrypted-credential weak-cipher flagging** — flag credentials "encrypted" with reversible schemes (XOR, DES-ECB) as effectively plaintext.
139624. **Credential-rotation freshness audit** — compare embedded credential age against vendor advisories to flag stale long-lived secrets.
139625. **UART baud-rate auto-sweep assistant** — guide authorized hardware probing by suggesting baud rates and flagging console-like responses.
139626. **PCB test-point mapping from silkscreen** — OCR silkscreen labels (TX, RX, JTAG pins) from device photos to suggest probe points.
139627. **JTAG pinout inference aid** — suggest pinout hypotheses from continuity and labeling clues to speed authorized JTAG identification.
139628. **Debug-port presence checklist** — run a structured checklist (UART, JTAG, SWD evidence from docs, teardowns, FCC filings) per device.
139629. **Console-output logging taxonomy** — classify serial-console outputs (boot logs, login prompts, shells) for triage of debug-interface findings.
139630. **SWD discovery support notes** — document SWD-over-GPIO patterns for authorized analysis of ARM-based devices.
139631. **FCC filing probe extraction** — pull internal photos and test reports from FCC filings to pre-map debug interfaces before hardware arrives.
139632. **Bootloader command reference builder** — compile per-device bootloader command tables from extracted U-Boot configs for consistent analysis.
139633. **Glitch-resistance boot assessment notes** — record secure-boot and efuse settings that make glitch attacks impractical, deprioritizing those paths.
139634. **Debug-fuse state review** — review blown and unblown debug-disable fuses in extracted configs to assess whether debug ports are production-locked.
139635. **OTA manifest signature verification** — verify firmware-manifest signatures and flag unsigned or weakly signed update metadata.
139636. **Update-transport TLS posture audit** — check OTA endpoints for TLS downgrade, weak cipher acceptance, and missing certificate validation.
139637. **Rollback-protection assessment** — review anti-rollback counters and version gates so outdated signed images cannot be downgraded.
139638. **Delta-update integrity checks** — verify incremental OTA patches are hash-chained to prevent tampered partial updates.
139639. **Update-server DNS integrity review** — assess update-server resolution (DNSSEC, hardcoded IPs, CDN pinning) for hijack exposure.
139640. **OTA rollout pacing analysis** — analyze update windows and check intervals to quantify exposure during slow-rollout phases.
139641. **Firmware-download replay review** — capture and re-analyze an authorized update download to confirm the served image matches the signed manifest.
139642. **Third-party OTA-SDK inventory** — identify bundled update SDKs in firmware and map them to known advisory histories.
139643. **Update-failure telemetry review** — review how devices report failed updates to detect silent-update-failure masking.
139644. **Forced-update coercion audit** — assess whether blocking update channels can strand devices on old versions (defense assessment).
139645. **Default-credential corpus per model** — maintain a model-specific default-password corpus from manuals and prior images for authorized posture audits.
139646. **First-boot credential-change enforcement review** — verify setup wizards force credential changes and cannot be skipped by replay.
139647. **Factory-reset secret clearance verification** — verify factory reset purges custom credentials, keys, and tokens so returned or resold devices cannot retain prior access.
139648. **Default-credential exposure heatmap** — map which services (web, telnet, SSH, MQTT) accept defaults to rank remediation priority.
139649. **Vendor-default advisory crosswalk** — cross-reference device defaults against published vendor advisories for documented risk.
139650. **Unique-per-device credential verification** — verify whether credentials are truly per-device unique (serial-derived) versus shared defaults.
139651. **Setup-wizard bypass review** — review onboarding flows for paths that complete setup without setting a strong credential.
139652. **Hardcoded service-account audit** — audit non-interactive service accounts baked into images for default passwords.
139653. **Credential-hint disclosure review** — check whether login pages leak username hints or default-password notices.
139654. **Multi-interface default parity check** — compare defaults across web, console, and API interfaces to catch interfaces with weaker defaults.
139655. **Embedded-web-interface route inventory** — crawl device web UIs and catalog routes, including hidden admin paths from JS bundles.
139656. **Lightweight-server fingerprinting** — fingerprint embedded HTTP servers (GoAhead, BusyBox httpd, Boa) to scope version-specific checks.
139657. **Session-handling rigor review** — review embedded-UI session tokens for entropy, fixation, and timeout behavior.
139658. **CSRF posture in embedded UIs** — test device web interfaces for CSRF protections on state-changing actions.
139659. **Embedded-UI privilege separation review** — map role boundaries (admin, user, guest) in device UIs for vertical and horizontal access gaps.
139660. **Diagnostic-page exposure audit** — flag exposed diagnostic and debug pages in device UIs not linked from navigation.
139661. **Firmware-upload function review** — review device firmware-upload endpoints for signature checks before accepting images.
139662. **Embedded-API endpoint fuzzing harness** — drive device REST APIs with schema-aware fuzzing tuned to embedded constraints.
139663. **Device websocket-channel review** — audit device websocket channels for authentication and input validation.
139664. **Captive-portal logic review** — review captive-portal logic on authorized devices for authentication-bypass paths.
139665. **BLE characteristic write-risk scoring** — rank writable BLE characteristics by write-value semantics (reboot, unlock) for authorized triage.
139666. **BLE pairing-mode audit** — review pairing modes (Just Works versus passkey versus OOB) on authorized devices and flag weak defaults.
139667. **Zigbee network-key storage review** — review how network keys are stored and derived in firmware for authorized key-management assessment.
139668. **BLE advertisement data mining** — parse advertisement payloads for identifiers, PII, and firmware-version leaks.
139669. **Zigbee trust-center policy review** — review trust-center link-key policies and join permissions for unauthorized-join exposure.
139670. **BLE device-firmware-update review** — assess DFU characteristics for signature verification before flashing on authorized devices.
139671. **BLE coded-PHY range review** — enumerate coded-PHY-capable devices whose extended range widens the physical attack radius.
139672. **Zigbee group-key rotation audit** — check whether group and broadcast keys rotate and how stale keys are revoked.
139673. **BLE MAC randomization assessment** — assess address-randomization behavior to quantify tracking exposure on authorized devices.
139674. **Matter-Thread commissioning review** — review Matter and Thread commissioning flows for weak onboarding credentials on authorized devices.
139675. **Rootfs SBOM extraction pipeline** — generate SBOMs from extracted squashfs and UBIFS root filesystems with package-level versioning.
139676. **Kernel-module SBOM enrichment** — enumerate kernel modules and map versions to CVE feeds for embedded-Linux images.
139677. **Static-binary library attribution** — attribute statically linked libraries in firmware binaries via symbol and version fingerprinting.
139678. **SBOM diff across versions** — diff SBOMs between firmware releases to surface newly introduced vulnerable components.
139679. **BusyBox applet inventory** — enumerate BusyBox applets and versions in images to scope applet-specific advisories.
139680. **Third-party embedded-SDK attribution** — identify embedded SDKs (camera, voice, networking) and record versions in the SBOM.
139681. **License-obligation SBOM export** — export SBOMs in SPDX and CycloneDX plus license data for compliance review.
139682. **CVE-to-SBOM auto-correlation** — correlate SBOM components against CVE feeds and prioritize reachable ones.
139683. **Untracked-binary SBOM gap flagging** — flag binaries with no package attribution as SBOM gaps needing manual review.
139684. **SBOM freshness decay tracking** — track component age in SBOMs to flag stale libraries past typical patch windows.
139685. **Secure-boot chain-of-trust mapping** — map each boot stage (ROM to bootloader to kernel) and verify signature checks exist at every link.
139686. **Bootloader unlock-state review** — check bootloader unlock flags in extracted configs for devices that ship unlocked.
139687. **Signing-key inventory** — inventory embedded public keys and certificates used for image verification and flag weak key sizes.
139688. **Verified-boot failure handling review** — review what devices do on signature failure (halt versus fallback) to assess bypass paths.
139689. **Efuse-OTP configuration audit** — audit one-time-programmable fuse settings for debug-disable and key-revocation state.
139690. **Boot-argument injection review** — review kernel cmdline and bootargs in images for debug flags that weaken verified boot.
139691. **Recovery-bootloader image acceptance review** — assess recovery and fastboot modes to confirm they only accept signed rescue images, since recovery is the last-resort attack surface.
139692. **Key-revocation support assessment** — check whether firmware supports revoking compromised signing keys.
139693. **Dual-bank boot integrity review** — review A/B slot switching logic to ensure failed or unsigned slots cannot become active.
139694. **Boot attestation hardware-anchor review** — assess whether boot measurements are anchored to hardware security modules or secure elements rather than software-stored keys.
139695. **Telemetry endpoint inventory** — catalog cloud telemetry endpoints contacted by authorized devices from firmware strings and traffic.
139696. **Telemetry TLS posture review** — verify telemetry channels use modern TLS with certificate validation, not plaintext protocols.
139697. **Telemetry authentication review** — review per-device credentials and tokens used for telemetry ingestion endpoints.
139698. **Sensitive-data-in-telemetry audit** — scan telemetry payloads for PII, credentials, or secrets that should not leave the device.
139699. **Telemetry replay-attack review** — assess whether telemetry messages carry nonces or timestamps to prevent replay.
139700. **Device-shadow API authorization review** — review cloud device-shadow APIs for per-device authorization on read and write.
139701. **Telemetry flood handling assessment** — assess how ingestion endpoints handle abnormal telemetry rates from authorized test devices.
139702. **Offline-telemetry spool review** — review on-device telemetry spooling for unencrypted storage of sensitive readings.
139703. **Telemetry endpoint takeover review** — check telemetry hostnames for dangling DNS and subdomain-takeover exposure.
139704. **Telemetry schema-version pinning review** — review whether devices pin telemetry schema versions or accept malformed schema changes.
139705. **CT-stream subdomain ticker** — streams live certificate-transparency entries filtered to the target's brand tokens and pushes each new host into the recon queue within seconds of issuance.
139706. **Cert-log name-pattern learner** — trains a lightweight model on the target's historical CT names to forecast likely next labels (staging-blue, api-v2) and pre-seeds them in the watchlist.
139707. **Cross-CA issuance anomaly scorer** — flags when target domains appear under a CA that has never issued for them before, since rogue issuance often precedes lookalike phishing infrastructure.
139708. **Pre-cert window sniffer** — harvests precertificates from CT logs to catch hosts in the minutes-to-hours gap before they go live, giving the recon agent a head start on the launch surface.
139709. **Sub-brand typosquat cert trap** — generates keyboard-adjacent and homoglyph brand variants, watches CT for any certificates on them, and escalates live squats as potential phishing domains.
139710. **Multi-domain SAN graph builder** — clusters certificates by shared SAN entries to map sibling infrastructure the target never advertises on its own pages.
139711. **Expired-cert asset resurrection radar** — re-probes hosts harvested from expired target certificates, since forgotten assets behind lapsed certs are a classic recon gap.
139712. **Cert validity-window overlap mapper** — correlates issuance timestamps across target certs to detect batch-provisioned environments (e.g., a fleet of staging hosts minted together).
139713. **Revoked-cert postmortem tracker** — watches revocations and re-issuance events for the target to infer misconfigurations or compromised keys worth flagging in reports.
139714. **Org-field certificate census** — aggregates O-fields across CT entries to enumerate legal-entity names tied to the target org, exposing acquisition-era brands that count as in-scope surface.
139715. **Wildcard-scope enumerator** — when a new wildcard cert for the target apex appears, probes candidate labels to enumerate the wildcard's real-world coverage without brute-forcing the whole zone.
139716. **Cert-policy change alert** — detects shifts in key algorithms, validity periods, or CA vendors across target certs as a signal of infrastructure migrations the recon pipeline should re-baseline.
139717. **DNS-history drift differ** — diffs daily snapshots of the target's A/AAAA/CNAME records and alerts on unexpected IP or provider changes that signal migrations or takeovers.
139718. **Nameserver delegation change watchdog** — tracks NS record history for the target zone and raises an alert when delegation shifts to unfamiliar nameservers, a classic hijack indicator.
139719. **TTL-pattern decay analyzer** — watches TTL value trends across the target's DNS history, since sudden TTL drops often precede infrastructure moves worth re-scanning.
139720. **Dangling-CNAME resurrection hunter** — compares current CNAME targets against historical records to catch pointers that now resolve to deprovisioned third-party services eligible for claim.
139721. **TXT-record history miner** — diffs TXT records over time to surface leaked SPF/DKIM configs, retired verification tokens, and exposed internal service references.
139722. **MX-record provider flip detector** — alerts when the target's MX history shows a mail-provider change, because each flip introduces SPF/DKIM/DMARC misconfiguration windows.
139723. **Subdomain birth-rate baseline** — builds a per-month count of new subdomains from DNS history and flags birth-rate spikes as periods of rapid surface expansion to prioritize.
139724. **Retired-host ghost resolver** — re-resolves hostnames that disappeared from DNS history to find parked, expired, or attacker-re-registered names that still carry the brand's trust.
139725. **Zone-apex record completeness audit** — cross-checks apex records against DNS history to detect accidentally dropped glue or DS records after registrar changes.
139726. **SOA-serial anomaly detector** — monitors SOA serial increments for irregular jumps or freezes that betray out-of-band zone edits or failed transfers.
139727. **CAA-record coverage gap finder** — diffs CAA policy history to catch windows where certificate issuance was unrestricted, which warrant retroactive CT review.
139728. **DNS-history API change feed** — normalizes DNS-history diffs into a machine-readable event stream so hunt planners can trigger targeted re-recon on every meaningful change.
139729. **ASN origin-change sentinel** — watches the origin AS for each target prefix and alerts when announcements shift to a new ASN, a strong signal of hosting migration or hijack.
139730. **BGP prefix-length drift monitor** — flags when the target's announced prefixes grow more specific or aggregate unexpectedly, since deaggregation often accompanies traffic-engineering mistakes.
139731. **Route-origin validation (ROV) coverage checker** — continuously checks whether the target's prefixes carry valid ROAs and flags gaps that leave announcements spoofable.
139732. **BGP peer-visibility change tracker** — compares how many BGP collectors see the target's prefixes over time, because visibility drops can indicate filtering, outages, or partial hijacks.
139733. **Anycast vs unicast flip detector** — identifies when a target IP range flips between anycast and unicast announcements, which changes the effective attack surface geography.
139734. **Upstream-provider churn alerter** — tracks the set of upstream ASNs transiting the target's prefixes and alerts on sudden provider churn that reshapes network exposure.
139735. **BGP community-string change profiler** — diffs community attributes on target announcements to detect altered traffic policies worth mapping to new edge locations.
139736. **Prefix-withdrawal blackout detector** — raises an alert when target prefixes are withdrawn entirely, distinguishing planned maintenance windows from accidental or malicious de-peering.
139737. **Sibling-prefix discovery via ASN** — enumerates all prefixes announced by the target's ASNs to find sibling networks that belong to the same org but never appear in scope lists.
139738. **BGP-hijack blast-radius estimator** — simulates which collector-visible paths a hijacked target prefix would take, giving responders a concrete impact map before escalation.
139739. **Wayback endpoint archaeology** — crawls archived snapshots of in-scope sites to extract API paths, admin URLs, and parameter names that the live site no longer links to.
139740. **Snapshot-diff dead-end reviver** — diffs old vs current snapshots to find endpoints removed from navigation but still live, which are prime candidates for untested functionality.
139741. **Archived-JS bundle miner** — downloads historical JavaScript bundles from web archives and extracts embedded endpoints, keys-to-rotate, and feature flags from deprecated builds.
139742. **Archive capture-index URL sweeper** — queries web-archive index APIs for every captured URL under the target domain and normalizes them into a deduplicated endpoint inventory.
139743. **Form-action history tracer** — reconstructs how form targets and their parameters evolved across snapshots, revealing retired flows whose backends may still accept requests.
139744. **Robots/sitemap archive comparer** — diffs archived robots.txt and sitemap files against current ones to find disallowed paths that were later exposed or forgotten.
139745. **Archive timestamp coverage gap map** — visualizes which date ranges lack snapshots for key target pages, directing live-crawl effort where archive intelligence is thinnest.
139746. **Third-party-script archive auditor** — lists external scripts loaded by archived pages to spot retired vendors whose domains could be re-registered for script-inclusion abuse.
139747. **Comment-and-debug artifact sifter** — scans archived page sources for developer comments, TODO markers, and debug endpoints that never shipped publicly.
139748. **Wayback-to-live response comparator** — replays archived requests against the live site and flags endpoints whose status codes or bodies changed in security-relevant ways.
139749. **Public-repo secret triage lens** — scans public code attributed to the target org for committed credentials and secrets, ranking findings by exploitability so rotation happens in priority order.
139750. **Org-repo inventory reconciler** — enumerates all public repositories under the org's known accounts, including forks and mirrors, so secret sweeps cover the full public footprint.
139751. **Commit-history secret archaeologist** — walks git history of public repos for secrets that were added and later "removed," since the history still exposes them.
139752. **Fork-network leak propagator** — traces forks of org repos to find copies where secrets survived even after the upstream repo was cleaned.
139753. **Gist-and-snippet exposure scanner** — searches public gists and code snippets by org-affiliated authors for config blocks containing tokens or internal hostnames.
139754. **CI-config credential auditor** — reviews public CI/CD configuration files in org repos for hardcoded tokens, deploy keys, and webhook secrets.
139755. **Dependency-manifest internal-host finder** — parses lockfiles and manifests in public repos for private registry URLs and internal hostnames that map internal infrastructure.
139756. **Dockerfile secret-layer checker** — inspects public Dockerfiles and image histories for credentials baked into build layers or exposed via ENV defaults.
139757. **Sample-config placeholder failure detector** — flags example configs that ship with real-looking credentials instead of placeholders, a common source of credential reuse.
139758. **Repo-takedown verification loop** — re-checks previously flagged repos after remediation to confirm secrets were purged from history, not just the current tree.
139759. **Breach-corpus credential cross-checker** — compares employee email patterns for the target org against breach corpora to prioritize accounts needing forced password resets.
139760. **Password-reuse risk ranker** — analyzes breach-corpus password patterns associated with the org's domain to estimate credential-stuffing exposure for customer-facing logins.
139761. **Breach-recency exposure timeline** — builds a timeline of when org-affiliated credentials appeared in breaches so incident response can scope the window of exposure.
139762. **Combo-list domain filter** — extracts only the target org's domain entries from aggregated combo lists, turning generic dumps into an org-specific hygiene report.
139763. **Credential-age decay model** — estimates how long exposed credentials likely remained valid using breach dates and the org's password-rotation policy.
139764. **Service-account exposure spotter** — flags non-human account formats (svc-, api-, deploy-) in breach data tied to the org, since those often carry elevated privileges.
139765. **Breach-notification evidence packer** — assembles redacted, evidence-backed breach matches into a defensible report package for the org's security team.
139766. **Duplicate-breach de-duplicator** — collapses the same credential pair appearing across multiple breach dumps into a single finding with first-seen provenance.
139767. **Hash-type upgrade advisor** — infers hash algorithms from breach samples to advise which stored-credential schemes the org should migrate first.
139768. **Post-reset re-exposure watcher** — monitors new breach corpora for credentials matching accounts the org already reset, catching reuse of the same password.
139769. **Public-profile tech-stack mapper** — aggregates technologies employees list publicly (on resumes and profiles) to infer the org's stack without touching internal systems.
139770. **Job-posting infrastructure decoder** — parses the org's public job ads for tooling, cloud, and framework mentions that reveal the production technology footprint.
139771. **Conference-talk surface miner** — reviews publicly posted talks and slides by org engineers for architecture diagrams and endpoint examples that expand the recon picture.
139772. **Open-source contribution tracer** — maps the org's public open-source contributions to internal projects, surfacing libraries and services the org maintains.
139773. **Vendor-partnership page crawler** — extracts named vendors and integrations from the org's public partnership pages to identify third-party components in the supply chain.
139774. **Executive-interview tech revealer** — scans public interviews and press for executives naming platforms and migrations, which signal technology changes worth re-baselining.
139775. **Hiring-surge team mapper** — correlates public hiring spikes by team with product launches, predicting which new services will soon appear in scope.
139776. **Alumni-profile legacy-stack finder** — reviews former employees' public profiles for legacy technologies that may still run on forgotten, under-maintained hosts.
139777. **Certification-badge stack inference** — aggregates professional certifications employees display publicly to infer which cloud and security platforms the org operates.
139778. **Public-profile change digest** — diffs employee public profiles monthly and summarizes technology shifts, giving recon a passive early-warning feed.
139779. **Tech-stack change radar** — fingerprints the target's web stack continuously and alerts when frameworks, CDNs, or WAFs change, triggering focused re-testing of the new layer.
139780. **Header-signature drift watcher** — tracks server, powered-by, and security headers over time to detect unannounced stack swaps behind the same domain.
139781. **JS-framework version tracker** — monitors bundled library versions on in-scope pages and flags outdated or newly adopted frameworks with known issue classes.
139782. **CDN-provider switch detector** — identifies when the target moves between CDN or edge providers, since each switch resets caching and security-header behavior.
139783. **TLS-fingerprint stack classifier** — uses JA3/JA4-style fingerprints to detect backend changes even when HTTP headers are scrubbed.
139784. **DNS-to-stack correlation engine** — joins DNS history with stack fingerprints to attribute each technology change to a specific migration event.
139785. **Third-party pixel inventory differ** — diffs the set of analytics and marketing scripts loaded by target pages to catch newly added supply-chain dependencies.
139786. **Stack-change hunt trigger** — converts verified technology changes into scoped re-hunt tasks so new layers get tested before attackers notice them.
139787. **Bucket-name permutation enumerator** — generates org-specific bucket-name permutations and checks them passively via public listings to find exposed cloud storage.
139788. **Public-bucket index crawler** — inventories files inside publicly listable buckets tied to the org, flagging backups, dumps, and config files by name pattern.
139789. **Bucket-policy drift monitor** — re-checks previously private buckets on a schedule, since permission changes silently flip storage from private to public.
139790. **Object-metadata leak analyzer** — reviews metadata of publicly reachable objects for owner emails, internal paths, and software versions that aid further recon.
139791. **Backup-file pattern hunter** — scans exposed buckets for database dumps, archives, and snapshot naming patterns that indicate sensitive data stores.
139792. **Cross-account bucket reference finder** — follows bucket policy references to discover additional buckets and accounts linked to the target org.
139793. **Stale-bucket takeover sentinel** — detects buckets referenced by the target's DNS or code that no longer exist and can be claimed, then alerts before an attacker registers them.
139794. **Bucket-notification evidence compiler** — packages bucket findings with timestamps, policy snapshots, and redacted listings into a remediation-ready report.
139795. **Dark-web mention tripwire** — monitors dark-web forums and marketplaces for the target's brand, domains, and employee emails, alerting on first mention.
139796. **Leaked-database org filter** — sifts newly surfaced leaked databases for records matching the target org's domains and summarizes exposure without retaining raw data.
139797. **Ransomware-victim-list watcher** — checks ransomware leak-site victim lists for the target org and triggers an accelerated recon cycle on confirmed listings.
139798. **Initial-access-broker listing alert** — flags marketplace listings advertising access to the target's industry and geography for correlation with the org's external footprint.
139799. **Credential-market dork monitor** — watches credential marketplaces for bulk listings tied to the target's domains, feeding the hygiene pipeline with fresh breach signals.
139800. **Data-leak site change detector** — tracks known leak sites for new posts referencing the target, distinguishing genuine leaks from recycled old dumps.
139801. **Dark-web alias correlator** — links threat-actor aliases across forums when they discuss the target, building a passive picture of who is interested in the org.
139802. **Leak-sample authenticity scorer** — evaluates leaked samples attributed to the target for internal consistency before escalating, cutting false alarms from fabricated dumps.
139803. **Takedown-evidence archiver** — preserves timestamped, redacted evidence of dark-web findings for the org's legal and incident-response teams.
139804. **Dark-web-to-surface feedback loop** — feeds confirmed dark-web findings back into the recon planner so leaked hostnames and credentials become prioritized hunt inputs.
139805. **Benign canary-value injection proofs** — writes a unique harmless marker (such as a UUID comment) instead of hostile content to prove data-flow reach, giving irrefutable evidence while keeping the action provably non-destructive.
139806. **Read-path impact witnesses** — captures the exact read response that discloses data and pairs it with request metadata, proving exposure without any state-changing request ever being sent.
139807. **Time-limited PoC lease envelopes** — wraps every demonstration in an expiry envelope so the proof self-invalidates after the review window, preventing captured requests from being replayed as live attacks later.
139808. **Safe-mode filter on the PoC recorder** — intercepts every outbound demonstration request and blocks verbs or parameters classed as state-changing, so the agent can only ever record safe proofs.
139809. **Synthetic victim account harness** — provisions isolated test accounts holding fake data for all impact demonstrations, so screenshots show a realistic flow without touching any real user's records.
139810. **Proof replay dry-run simulator** — re-executes the captured demonstration against a local mock of the target's responses, letting triagers replay the finding without hitting the live system again.
139811. **Non-persistent session demonstrations** — runs the entire proof inside a throwaway session that is destroyed afterwards, guaranteeing no session artefact survives to affect real users.
139812. **Impact-scaling projections on synthetic data** — shows blast radius by projecting the finding onto synthetic dataset sizes rather than enumerating real records, proving scale without touching real data.
139813. **Read-only PoC watermarking** — stamps every captured artefact with scope, timestamp, and authorisation reference, making the evidence self-attesting as authorised testing.
139814. **Graceful degradation PoC recorder** — automatically downgrades a destructive proof step into its nearest safe equivalent and notes the substitution, so the report stays honest about what was actually demonstrated.
139815. **Auto-redacting evidence screenshotter** — detects PII-shaped regions (emails, tokens, names) in captured screenshots and blurs them before the image is stored, so evidence never becomes a leak.
139816. **Region-scoped capture masks** — lets the agent define a capture polygon around only the vulnerable UI element, excluding everything else on screen from the recording by construction.
139817. **Redaction audit trail on media** — logs every blur or pixelation applied to evidence media with coordinates and rule id, so triagers can verify nothing material was hidden.
139818. **Keystroke-masking screen recorder** — captures the screen while suppressing keystrokes that type credentials or tokens, so the video shows the workflow but never the secrets.
139819. **Frame-diff evidence summariser** — reduces a full demonstration video to the frames where the screen actually changed, producing a compact annotated strip instead of hours of footage.
139820. **Dual-track raw/redacted media storage** — keeps the unredacted original in a sealed vault and publishes only the redacted copy, with access to the original requiring dual approval.
139821. **Consent-banner evidence overlay** — stamps each screenshot with the authorisation scope banner and hunt id at capture time, binding the image to its authorised context.
139822. **OCR-verified redaction checker** — re-scans redacted screenshots with OCR to confirm no readable sensitive text survived the blur pass.
139823. **Animated PoC storyboard generator** — converts a screenshot sequence into an annotated step-by-step storyboard with captions, so triagers follow the finding without watching video.
139824. **Selective audio stripping for narrated PoCs** — records screen plus optional narration but removes audio segments mentioning credentials, keeping the explanation while dropping the secrets.
139825. **Scope-filtered HAR exporter** — captures only traffic to in-scope hosts and drops third-party beacons, so the network evidence contains nothing out of bounds.
139826. **Secret-scrubbing HAR sanitiser** — rewrites authorisation headers, cookies, and token parameters to placeholders at capture time while preserving request structure for replay analysis.
139827. **Minimal-repro request extractor** — distils a full HAR into the smallest ordered set of requests that reproduces the finding, giving triagers a clean repro instead of noise.
139828. **Encrypted-evidence request logger** — stores full request/response pairs encrypted with the report key, so raw traces stay confidential until the triager opens them.
139829. **Timing-annotated trace renderer** — embeds server-timing and round-trip annotations into the HAR so race-condition and latency findings carry their own timing proof.
139830. **WebSocket frame evidence capture** — records WebSocket frames with direction and opcode markers in a reviewable transcript, covering findings that never touch plain HTTP.
139831. **TLS-handshake evidence attacher** — appends the negotiated cipher suite and certificate chain summary to the trace, documenting the transport context of the finding.
139832. **Diff-based trace comparer** — captures a baseline trace and a demonstration trace and highlights only the divergent requests, focusing the evidence on what the vulnerability changed.
139833. **Truncated-payload packet capture** — records raw packets but truncates bodies beyond a safe length, keeping protocol proof without hoarding sensitive payloads.
139834. **Trace replay consent gate** — requires explicit scope re-confirmation before any captured trace can be replayed, blocking accidental re-execution against production.
139835. **Expiry-bound PoC tokens** — issues short-lived bearer tokens for each demonstration that die with the report review window, so leaked evidence cannot be reused as live credentials.
139836. **Single-use demonstration nonces** — binds each proof request to a nonce that the agent's proxy accepts exactly once, making replayed evidence inert by design.
139837. **Scope-carrying test credentials** — embeds the authorised target list inside the test credential itself, so any use outside scope fails closed.
139838. **Automatic credential rotation post-hunt** — rotates every test credential the moment the hunt ends and records the rotation in the evidence pack, closing the window on stale access.
139839. **Time-boxed evidence viewing links** — shares report evidence through links that expire after a set number of views or hours, limiting the blast radius of shared proof.
139840. **Revocation receipt collector** — fetches and archives proof that each issued token was revoked, attaching the receipts to the chain of custody.
139841. **Ephemeral privilege windows for demonstrations** — grants the agent elevated test rights only for the seconds a demonstration needs them, then drops them automatically.
139842. **Token blast-radius declarations** — requires each demonstration token to declare the endpoints it may touch, and the proxy enforces the allowlist so evidence gathering cannot wander.
139843. **Post-expiry evidence revalidation** — after tokens expire, re-runs a read-only check to confirm the finding persists without credentials, proving it is a real flaw and not a token artefact.
139844. **Instant revocation switch for live demonstrations** — gives the hunter a single command that revokes all outstanding demonstration tokens immediately if anything looks off.
139845. **Response-delta impact lens** — demonstrates exposure by comparing an authorised response against the target response field-by-field, highlighting only the delta as proof.
139846. **Metadata-only disclosure proofs** — proves a file-read flaw by returning only file metadata (name, size, modification time) rather than contents, establishing reach without extracting data.
139847. **Count-not-content enumeration proofs** — reports how many records match a query instead of dumping them, proving enumeration capability while leaking nothing.
139848. **Header-echo impact demonstrations** — shows a reflection flaw through response headers and status codes alone, never needing a stored or destructive write.
139849. **Read-replica proof routing** — routes demonstration reads to read replicas or caches where available, so even evidence gathering never loads the primary.
139850. **Conditional-request reach proofs** — uses ETag and If-Modified-Since style conditional reads to prove access to a resource, demonstrating reach with minimal transfer.
139851. **Schema-shape disclosure proofs** — proves API over-exposure by returning only field names and types, not values, showing what is reachable without showing it.
139852. **Error-oracle demonstrations** — leverages distinct error messages as the proof channel (present versus absent), documenting the oracle without extracting the underlying data.
139853. **Timing-side-channel evidence packs** — captures statistically rigorous timing distributions as the proof of a timing oracle, with confidence intervals instead of raw data pulls.
139854. **Synthetic-object delete confirmations** — where a delete flow must be shown, demonstrates it against the agent's own synthetic object and captures the confirmation dialogue, never a real record.
139855. **Target fingerprint snapshotter** — records server banners, TLS details, and application version markers at proof time so the evidence is anchored to the exact environment state.
139856. **Build-hash evidence anchoring** — captures frontend bundle hashes and API version headers alongside the demonstration, letting triagers map the finding to a specific release.
139857. **Time-sync proof stamps** — embeds NTP-verified timestamps into every artefact, defeating disputes about when the demonstration occurred.
139858. **Egress-route evidence notes** — records the egress region and resolved IPs used during the proof, documenting the network path without exposing infrastructure secrets.
139859. **WAF/CDN context labels** — notes which WAF or CDN sat in front of the target during capture, since the same finding can behave differently behind different edges.
139860. **Environment-drift recheck** — re-captures the fingerprint before report submission and flags any change, so the evidence never silently describes a different deployment.
139861. **Dependency-version evidence card** — snapshots detectable library versions (from headers or scripts) at capture time to support root-cause analysis by the triager.
139862. **DNS-state evidence pinning** — records the DNS answers seen during the proof, guarding against later claims that the finding hit the wrong host.
139863. **Experiment-variant state recorder** — notes which feature flags or experiments were active for the test session, explaining variant-dependent behaviour in the evidence.
139864. **Multi-vantage confirmation packs** — re-runs the read-only proof from a second egress point and bundles both captures, ruling out single-network artefacts.
139865. **Hash-chained evidence ledger** — links every artefact with a hash of the previous one, so any tampering with the evidence pack breaks the chain detectably.
139866. **Capture-to-report provenance log** — records which agent run, when, and with what scope captured each artefact, giving the full lineage of every file.
139867. **Signed evidence manifests** — signs the artefact manifest with the hunt's private key, letting triagers verify the pack is complete and unaltered.
139868. **Immutable artefact vault** — stores evidence in write-once storage where even the agent cannot modify a captured file, only append new versions.
139869. **Custody transfer receipts** — generates a signed receipt each time the evidence pack changes hands (agent to reviewer to triager), closing gaps in handling.
139870. **Tamper-evident redaction logs** — keeps redaction operations themselves inside the hash chain, so reviewers can see exactly what was obscured and why.
139871. **Artefact retention scheduler** — auto-purges raw evidence after the report's retention window and keeps only the manifest, balancing accountability with data minimisation.
139872. **Dual-control evidence release** — requires two independent approvals before raw unredacted evidence leaves the vault, preventing unilateral disclosure.
139873. **Forensic timeline reconstructor** — rebuilds a minute-by-minute timeline from artefact timestamps, showing the exact sequence of the demonstration.
139874. **Pre-submission evidence validation sweep** — re-verifies the whole hash chain at report assembly time and blocks submission if any artefact fails validation.
139875. **Target-anonymised public PoCs** — produces a sanitised version of the evidence with hostnames and branding replaced by placeholders, safe to share in write-ups or portfolios.
139876. **Differential-privacy impact stats** — reports aggregate impact numbers with calibrated noise, so severity statistics can be published without revealing exact record counts.
139877. **K-anonymity screenshot scrubber** — ensures any user-like data in screenshots is generalised beyond re-identification before the image leaves the vault.
139878. **Pseudonymised session transcripts** — replaces usernames, IDs, and emails in captured transcripts with consistent pseudonyms, preserving the story while hiding identities.
139879. **Safe-harbour evidence subsets** — splits the pack into a public subset (safe to disclose) and a restricted subset (triager-only), with the split recorded and signed.
139880. **Third-party brand redactor** — detects and masks unrelated third-party brands or users appearing incidentally in evidence, keeping the focus on the target.
139881. **Anonymised technique write-ups** — generates a technique-focused summary that teaches the method without naming the target, suitable for knowledge sharing.
139882. **Consent-scoped sharing matrix** — maps each artefact to the sharing consent it carries (internal, triager, public), and the exporter enforces the matrix automatically.
139883. **Watermarked shared copies** — stamps shared evidence with the recipient's identity as an invisible watermark, deterring leaks of triager-only material.
139884. **Expiry-pinned anonymised bundles** — binds the anonymised bundle to the disclosure timeline so it cannot circulate before the vendor's fix window closes.
139885. **CVSS evidence mapper** — walks each CVSS metric with a checkbox tied to a captured artefact, so the score is backed by proof rather than judgement.
139886. **Impact-versus-likelihood evidence split** — separates artefacts proving impact from those proving likelihood, keeping severity arguments auditable.
139887. **Preconditions checklist attacher** — documents every precondition the demonstration relied on (auth level, feature flags) so severity is calibrated to realistic attacker position.
139888. **Exploitability ladder snapshots** — captures evidence at each step of privilege or access escalation, letting triagers see exactly how far the chain provably goes.
139889. **Business-impact translation cards** — pairs each technical artefact with a one-line business consequence, giving triagers severity language they can act on.
139890. **Severity peer-benchmark panel** — shows how similar findings were scored across past reports, grounding the calibration in precedent rather than guesswork.
139891. **Mitigating-factor evidence slots** — reserves checklist space for captured mitigations (WAF blocks, short TTLs) so severity reflects the real defensive posture.
139892. **Downgrade/upgrade rationale logger** — records why the agent adjusted severity up or down from the template default, with the evidence that justified the call.
139893. **Triager disagreement buffer** — attaches the agent's confidence interval on severity plus the weakest-link artefact, inviting review instead of overstating.
139894. **Regulatory mapping evidence tags** — tags artefacts with the compliance clauses they support, so severity ties to obligations triagers already track.
139895. **One-click triager evidence pack** — assembles screenshots, traces, fingerprints, and manifests into a single signed archive structured the way triage teams expect.
139896. **Repro-step auto-narrator** — turns the captured request sequence into numbered plain-English repro steps with inline artefacts at each step.
139897. **Artefact-indexed report binder** — numbers every evidence file and cross-references each claim in the report to its artefact id, so nothing is asserted without proof.
139898. **Triage-priority evidence flags** — marks the two or three artefacts that carry the finding's core proof, letting a busy triager verify in under a minute.
139899. **Offline-review evidence bundle** — packages everything needed to assess the finding without network access, so triagers can review on the move or in secure rooms.
139900. **Remediation-verification evidence slots** — leaves structured placeholders for the vendor's fix proof, turning the bundle into a complete before-and-after record.
139901. **Multi-format evidence export engine** — renders the same evidence pack as PDF, HTML, and Markdown so it drops straight into any triage workflow.
139902. **Evidence freshness badges** — stamps each artefact with its age at submission and flags anything captured before a recent deploy, so stale proof is visible.
139903. **Triage feedback loop attacher** — routes triager questions back into the pack as annotations, keeping the conversation attached to the evidence it concerns.
139904. **Submission receipt archiver** — stores the platform's submission confirmation alongside the evidence hash, proving exactly what was sent and when.
139905. **Ephemeral per-finding retest harness** — spins up an isolated harness instance scoped to a single finding with the original PoC replay script preloaded so fix validation never contaminates other tests.
139906. **Frozen vulnerable-snapshot fixtures** — captures the exact pre-fix request/response pair as an immutable fixture so retests always compare against a stable baseline instead of a moving target.
139907. **Harness-as-code from PoC transcripts** — generates a runnable validation harness directly from the recorded PoC transcript so developers get a one-command local reproducer for self-checks before requesting retest.
139908. **Golden-request fixture libraries** — stores canonical benign requests per endpoint so fix validation can prove legitimate workflows still succeed after the patch, catching over-blocking fixes.
139909. **Deterministic replay with seeded state** — replays the PoC with controlled seeds for nonces and timestamps so flaky time-dependent results become reproducible pass/fail verdicts.
139910. **Dual-deploy canary comparison harness** — runs the same probe set against fixed and pre-fix builds side by side so a fix is proven by behavioral delta, not by the absence of one signal.
139911. **Synthetic-user journey harness** — scripts realistic multi-step user flows through the patched feature so fixes are validated against real usage, not just the PoC request.
139912. **Containerized class-specific retest rigs** — packages probes, oracles, and fixtures per vulnerability class into portable containers so any environment runs the same fix validation identically.
139913. **Fix-validation mutation battery** — applies controlled mutations to the original PoC input during retest so near-variant bypasses of a narrow patch are caught in the same run.
139914. **Offline evidence-pack replay** — bundles encrypted evidence plus replay instructions so an auditor can re-verify a fix verdict without live target access.
139915. **Per-class fixed-means oracle definitions** — defines a machine-checkable "fixed" criterion per vulnerability class so retests assert the security property, not merely that the PoC failed.
139916. **Variant-probe regression batteries** — maintains mutated follow-up probes per class so a patch that blocks only the reported payload is exposed by its siblings.
139917. **Usability regression checks per patch** — runs benign-function tests after each fix so security patches that break legitimate features are flagged before the verdict.
139918. **Parameter-sibling regression sweeps** — retests sibling parameters and endpoints sharing the vulnerable code path so a fix applied to one input but not its twin is caught.
139919. **Encoding-variant residual probes** — replays the PoC through encoding transforms per class so incomplete output-encoding fixes surface during verification.
139920. **Error-oracle residual checks** — verifies that post-fix error messages no longer leak distinguishing information per class so a fix that silences the PoC but keeps the oracle is caught.
139921. **Timing-side-channel residual probes** — measures response timing on fixed endpoints so patches that close the logical flaw but leave a timing oracle are detected.
139922. **State-dependent regression chains** — retests multi-step findings with altered session and object states so fixes that hold only in the original PoC's state are exposed.
139923. **Cross-class interaction regression** — re-runs adjacent-class probes after a fix so a patch for one flaw does not silently introduce or unmask another.
139924. **Negative-control regression suites** — runs known-benign inputs that must never alert, per class, so over-aggressive fixes blocking legitimate traffic are measured.
139925. **Deploy-change behavior hashing** — fingerprints endpoint behavior and auto-triggers retests when the hash changes, proving a new build actually landed before verification starts.
139926. **Semantic patch-diff clustering** — groups changed code by vulnerability class touched so retest plans cover exactly the findings the patch could affect, no more and no less.
139927. **Diff-coverage retest pruning** — maps each finding to patched lines and skips retests for findings in untouched code so verification cycles stay fast.
139928. **Patch-introduced surface discovery** — scans the diff for newly added endpoints, parameters, and branches so code the patch itself introduced gets tested, not just the original flaw.
139929. **Vendor-changelog retest mapping** — parses release notes for security-fix mentions and auto-queues matching findings for retest so vendor claims drive verification.
139930. **Binary-diff retest planning** — compares compiled artifacts when source is unavailable and plans retests from changed functions so closed-source patches still get targeted verification.
139931. **Patch-window auto-detection** — watches for behavioral or version-indicator changes signalling a deploy and starts the retest window automatically without human scheduling.
139932. **Partial-patch scope estimation** — estimates from the diff whether the fix covers the whole vulnerable surface or one call site so retest depth matches the patch's real scope.
139933. **Reverted-patch detection** — detects when a previously verified fix disappears from a later build's behavior and reopens the finding automatically.
139934. **Hotfix-versus-release retest tiers** — assigns lightweight verification to emergency hotfixes and full regression to scheduled releases so speed matches risk.
139935. **Per-severity SLA countdown clocks** — starts a live countdown per finding from report acceptance with severity-based deadlines so overdue remediations surface before they breach.
139936. **Program-level SLA scorecards** — aggregates fix turnaround by program and severity so hunters and clients see which programs remediate promptly.
139937. **Remediation-deadline escalation ladders** — routes overdue findings up an owner-to-CISO chain with attached evidence so stalled fixes get attention before exposure grows.
139938. **Fix-lag distribution analytics** — charts the distribution of report-to-fix times per client so systemic slow teams are identified, not just single outliers.
139939. **Contractual-versus-actual SLA deltas** — compares agreed remediation timelines against measured reality so renegotiations rest on data.
139940. **SLA-aware retest prioritization** — orders the retest queue by deadline proximity and severity so verifications land where lateness hurts most.
139941. **Remediation velocity per team** — attributes fix times to owning teams so dashboards show which teams close findings fastest.
139942. **Stale-findings aging buckets** — groups open findings into age bands so long-ignored vulnerabilities cannot hide in a flat list.
139943. **Fix-commitment tracking** — records vendor-promised fix dates and flags drift when the date passes without a behavior change.
139944. **SLA-adjusted risk scoring** — raises a finding's live risk score the longer it stays unfixed past SLA so prioritization reflects exposure time.
139945. **Error-suppression-only fix detection** — distinguishes patches that hide error messages from patches that close the flaw by probing the underlying primitive, catching cosmetic fixes.
139946. **WAF-rule-only mitigation flagging** — detects when a PoC is blocked by a WAF signature while the direct-to-origin flaw persists, labelling the fix as mitigation rather than remediation.
139947. **Client-side-only validation detection** — verifies server-side enforcement after a fix so validation moved into JavaScript is flagged as an incomplete patch.
139948. **Single-parameter sanitization gaps** — retests every parameter on the vulnerable endpoint after a fix so sanitizing the reported field while leaving siblings exposed is caught.
139949. **Fix-that-moved-the-bug detection** — probes neighboring endpoints and actions sharing the code path so a patch that shifts the flaw sideways is flagged.
139950. **Hardcoded-value patch detection** — identifies fixes that blocklist the reported value instead of the vulnerability class, proven by trivially mutated inputs still succeeding.
139951. **Concurrency regression on patched flows** — re-runs race-condition probes after timing fixes so patches that hold serially but fail under parallel requests are exposed.
139952. **Partial-auth-fix residual probes** — retests authorization fixes with role and object variations so a patch covering one role pair but not another is caught.
139953. **Symptom-versus-root-cause classification** — classifies each fix as root-cause, partial, or symptomatic from probe evidence so confidence reflects what was actually repaired.
139954. **Reintroduced-finding watchlists** — keeps verified-fixed findings under lightweight surveillance so a later deploy that reopens the flaw triggers an instant alert.
139955. **Normalized evidence diffing** — strips volatile tokens before comparing pre- and post-fix responses so diffs show real behavioral change, not noise.
139956. **Screenshot pixel-diff for UI fixes** — captures the vulnerable and fixed UI states and highlights visual deltas so front-end fixes get visual proof.
139957. **Response-structure diffing** — compares parsed response schemas before and after so fixes that alter API contracts are documented alongside the security verdict.
139958. **Timing-behavior comparison** — records response-time distributions pre- and post-fix so patches that fix logic but add timing oracles are caught.
139959. **Multi-run retest stability scoring** — repeats verification probes to measure flakiness so a fix that passes once but fails intermittently is never certified.
139960. **Evidence-chain hashing** — hashes every evidence artifact in order so the before-and-after chain is tamper-evident for auditors.
139961. **Semantic equivalence checking** — verifies the fixed endpoint still returns semantically correct results for benign inputs so the patch did not silently corrupt functionality.
139962. **Session-state evidence pairing** — captures evidence under identical session conditions pre and post so state differences cannot masquerade as fix effects.
139963. **Network-level evidence capture** — records raw traffic for retests so verdicts rest on wire evidence, not just application-layer assertions.
139964. **Annotated evidence timelines** — builds a time-ordered annotated view of all probe evidence across the fix cycle so reviewers see the full story in one scroll.
139965. **Probe-diversity confidence scoring** — scores fix confidence from the breadth of probe angles attempted, since a fix surviving diverse variants is stronger than one surviving the PoC alone.
139966. **Fix-completeness signal extraction** — derives completeness signals from evidence to grade fixes beyond binary pass/fail.
139967. **Vendor fix-quality history** — tracks each client's historical first-pass fix success rate so confidence in a new fix is calibrated by past performance.
139968. **Verification freshness half-life** — lets fix-verdict confidence fade on a schedule as the codebase moves past the verified build so old green verdicts never imply current safety.
139969. **Ensemble retest verdicts** — combines independent probe batteries into one ensemble verdict so no single probe type decides the outcome.
139970. **Residual-risk surfacing** — lists the specific untested variants and assumptions behind each pass verdict so "fixed" never hides known blind spots.
139971. **Partial-fix grading** — grades fixes as full, substantial, or marginal with per-grade retest obligations so partial progress is tracked honestly.
139972. **Cross-environment confidence checks** — re-verifies fixes across staging and production behaviors so environment-specific patches are flagged.
139973. **Fix-durability scoring** — re-probes verified fixes after subsequent deploys to score how well patches survive ongoing development.
139974. **Human-override confidence audit** — logs every manual verdict override with rationale so confidence scores stay accountable.
139975. **Dependency-ordered retest chains** — orders retests so foundational fixes verify before dependent ones, avoiding false failures from unresolved prerequisites.
139976. **Batch retest windows** — groups findings fixed in the same release into one coordinated verification window so a deploy gets a single comprehensive verdict.
139977. **Change-freeze-aware scheduling** — avoids scheduling retests during announced freeze or incident windows so verification never collides with unstable builds.
139978. **Cross-program retest calendars** — coordinates verification schedules across multiple bounty programs sharing the agent so resources do not double-book.
139979. **Stakeholder notification choreography** — sequences notifications across fix-deployed, retest-running, and verdict-ready so each party acts at the right moment.
139980. **Maintenance-window alignment** — schedules intrusive retest probes inside client maintenance windows so verification respects operational constraints.
139981. **Retest capacity planning** — forecasts probe load from upcoming fix dates so the agent provisions enough parallel capacity.
139982. **Fix-batch readiness gates** — holds retests until all findings in a release batch report deployed, preventing partial-batch false negatives.
139983. **Vendor-coordinated retest slots** — lets vendors propose verification times that the agent confirms, aligning both sides on one schedule.
139984. **Emergency retest fast-lanes** — reserves capacity for critical-severity fix verifications that jump the queue without starving routine retests.
139985. **Append-only verification addenda** — attaches each retest verdict as an immutable addendum to the original report so the fix history is a tamper-proof chain.
139986. **Verdict-graded addendum templates** — generates structured addenda per outcome so every verdict carries the right evidence shape.
139987. **Cryptographically chained addenda** — links each addendum's hash to the previous one so the full remediation history is verifiable end to end.
139988. **Bounty-payout linkage notes** — records how each verification verdict maps to bounty or retest-bonus terms so payment follows proof.
139989. **Auditor-ready addendum exports** — packages the report plus all addenda into a signed export that compliance auditors can consume directly.
139990. **Regression addendum alerts** — issues a distinct addendum type when a verified fix regresses so reopened findings cannot be mistaken for new ones.
139991. **Addendum diff summaries** — auto-summarizes what changed between consecutive addenda so reviewers skip straight to the delta.
139992. **Multi-finding addendum rollups** — rolls individual verdicts into one release-level addendum so a whole patch release gets a single signed record.
139993. **Client-acknowledgment tracking** — records when the client acknowledges each addendum so disputed "we never saw it" claims are settled by log.
139994. **Retest-evidence citation index** — indexes every evidence artifact cited across addenda so any claim traces to its proof in one click.
139995. **Discovery-to-verified funnel metrics** — measures conversion at each lifecycle stage so teams see exactly where findings stall.
139996. **Bottleneck stage identification** — highlights the lifecycle stage with the longest dwell time so process fixes target the real constraint.
139997. **Cohort fix-rate analysis** — groups findings by report month and tracks each cohort to verified-fix so trends are not masked by new reports.
139998. **Report-to-verified lead-time KPI** — measures the duration from report to verified fix as a headline metric so remediation speed stays visible.
139999. **Reopen-rate dashboards** — tracks the share of verified fixes that later regress so fix quality is measured, not just fix speed.
140000. **Per-finding lifecycle timelines** — renders each finding's full journey as an interactive timeline for drill-down.
140001. **Stage-dwell heatmaps** — visualizes how long findings sit in each stage by severity so hotspots jump out visually.
140002. **Verified-fix velocity trends** — charts verified fixes per week against incoming reports so teams see whether they are gaining on the backlog.
140003. **Lifecycle SLA overlays** — overlays SLA deadlines on lifecycle dashboards so at-risk findings are visible in context.
140004. **Executive remediation briefings** — auto-generates leadership summaries from lifecycle data so executives get the picture without the raw feed.
