# Batch 4 — Part 01: Hunt strategy & decision-making (30005–31004)

30005. **Scope-rule prose parser** — Converts a bounty program's written rules page into a machine-readable allow/forbid action list before any probe runs.
30006. **Target-type plan classifier** — Labels a target (SaaS, e-commerce, API-only, static site, mobile backend) from homepage structure and tech fingerprints to select a plan template.
30007. **Budget-to-time converter** — Translates a dollar or hour budget into per-phase minute allocations using historical cost-per-phase data from past hunts.
30008. **Payout-prior weighting table** — Weights plan focus toward vulnerability classes by the program's historical average payout per class.
30009. **Rules-constrained module filter** — Removes plan modules (e.g., subdomain brute-forcing, automated scanners) when program rules explicitly forbid them.
30010. **Plan simulation dry-run** — Estimates expected coverage of a generated plan by replaying it against a synthetic target graph without sending any traffic.
30011. **Multi-plan tournament** — Generates three candidate plans and scores each on predicted findings-per-hour before committing to one.
30012. **Stakeholder intent encoder** — Turns a one-line user goal ("find RCE only") into weighted plan objectives the planner must satisfy.
30013. **Plan version ledger** — Versions every generated plan and records which version each hunt ran, enabling plan-level A/B comparisons.
30014. **Cold-start plan bootstrapping** — Seeds plan modules from public bug-bounty writeups for the same target type when no prior hunt data exists.
30015. **Program-scope freshness monitor** — Re-parses the program rules page at plan time and flags diffs since the last hunt on that program.
30016. **Excluded-domain pruning** — Drops recon seeds whose apex domains match the program's out-of-scope list before plan execution begins.
30017. **Safe-harbor clause detector** — Identifies the program's safe-harbor wording and records which plan actions it legally protects.
30018. **Rate-limit-aware probe pacing** — Reads the program's stated rate limits and injects per-module request ceilings into the plan.
30019. **Plan completeness audit** — Checks that every in-scope asset class (web, API, mobile, infra) has at least one plan module assigned.
30020. **Dependency-ordered phase graph** — Orders plan phases so recon outputs feed recon-dependent test modules with explicit handoff contracts.
30021. **Plan risk budget allocator** — Assigns each risky action a "blast-radius budget" so high-impact probes are capped per hunt.
30022. **Time-boxed recon gate** — Caps recon at a fixed share of the plan; testing begins even if recon is incomplete when the gate closes.
30023. **Plan checkpoint scheduler** — Inserts review checkpoints at phase boundaries where the planner may revise the remaining plan.
30024. **Objective-function plan optimizer** — Optimizes the plan against a configurable objective (max expected bounty, max coverage, min time) chosen by the user.
30025. **Plan constraint solver** — Uses constraint solving to fit modules into the time budget while honoring must-run and forbidden constraints.
30026. **Historical plan retrieval** — Retrieves the plan used on the most similar past target and adapts it instead of planning from scratch.
30027. **Plan similarity deduplication** — Detects when a new plan is near-identical to a failed prior plan on a similar target and forces divergence.
30028. **Stakeholder question elicitation** — Asks the user up to three clarifying questions (bounty focus, exclusions, timebox) only when plan confidence is below threshold.
30029. **Plan confidence score** — Emits a 0–100 confidence per plan derived from target-data richness and prior-hunt success on similar targets.
30030. **Fallback plan library** — Maintains degraded plans (recon-only, shallow, emergency-stop) the planner can downgrade to mid-hunt.
30031. **Multi-objective plan Pareto frontier** — Produces the Pareto frontier of plans trading coverage vs. speed vs. cost and lets the user pick a point.
30032. **Plan cost estimator (hunt-strategy context)** — Predicts compute, API, and model-token cost of a plan before execution for budget approval.
30033. **Plan explainer generator** — Generates a human-readable rationale for each plan phase ("why recon gets 30%") for user review.
30034. **Regulatory-constraint injector** — Adds constraints from applicable regulations (e.g., no testing of payment flows during business hours) into the plan.
30035. **Plan-time threat-model sketch** — Auto-builds a one-page threat model of the target from recon previews and attaches it to the plan.
30036. **Module dependency validator** — Verifies every plan module's inputs will actually be produced by an earlier phase before approving the plan.
30037. **Plan rollback snapshot** — Snapshots plan state at each checkpoint so a revised plan can revert to the last good configuration.
30038. **Parallelizable-module splitter** — Marks plan modules with no data dependencies as parallel-safe to compress wall-clock time.
30039. **Plan bottleneck predictor** — Predicts which phase will consume the most time from target size metrics and pre-allocates extra budget.
30040. **Skill-matrix plan matcher** — Matches plan modules to the specific agent capabilities available in this deployment (brains, tools, plugins).
30041. **Plan-data requirement checker** — Lists the external data each module needs (wordlists, API keys) and verifies availability before launch.
30042. **Warm-cache plan reuse** — Reuses recon caches from recent hunts on the same target to shorten the plan's recon phase.
30043. **Plan adversarial review** — A second agent critiques the generated plan for blind spots before execution is authorized.
30044. **Scope-change plan re-trigger** — Re-runs planning automatically when the user edits scope mid-hunt instead of patching the old plan.
30045. **Plan token-budget guard** — Caps the planner's own reasoning token spend so planning never eats more than 5% of the hunt budget.
30046. **Timezone-aware scheduling (hunt-strategy context)** — Schedules intrusive plan phases for the target's off-peak hours derived from geolocated server timezone.
30047. **Plan language localizer** — Renders the plan and its rationale in the user's preferred language (default per user profile).
30048. **Plan export to ticket format** — Exports the approved plan as Jira/Linear tickets with phase checklists for human oversight.
30049. **Plan approval gate** — Holds execution until the user approves the plan, with an auto-approve option for trusted configurations.
30050. **Plan template marketplace** — Lets users save proven plans as templates and share them across their team with versioning.
30051. **Program-duplicate-aware planner** — Checks recent public disclosures for the program and de-prioritizes already-reported vulnerability classes.
30052. **Plan novelty injector** — Forces at least one unconventional module into every plan to counter planner conservatism.
30053. **Seasonal plan adjuster** — Adjusts plan emphasis based on calendar patterns (e.g., holiday code freezes reduce new-feature testing value).
30054. **Plan-side bounty calculator** — Estimates the expected bounty payout of the plan's focus areas from program payout tables.
30055. **Multi-program plan merger** — Builds one plan covering a target enrolled in several programs, unioning scope rules and resolving conflicts.
30056. **Plan conflict resolver** — When two program rules conflict, picks the stricter rule and logs the resolution for audit.
30057. **API-first plan bias** — Biases module selection toward API testing when the target exposes more API surface than web pages.
30058. **Plan staleness detector** — Flags plans older than 30 days as stale and requires regeneration before reuse.
30059. **Plan execution contract** — Writes a machine-readable contract of what the plan will and won't do, signed off before launch.
30060. **Plan drift monitor** — Compares actual execution against the plan in real time and alerts when drift exceeds a threshold.
30061. **Plan heat-map visualizer** — Renders planned effort as a heat map over the target's attack surface for user review.
30062. **Plan phase success criteria** — Defines explicit pass/fail criteria per phase (e.g., recon must find ≥80% of subdomains) before proceeding.
30063. **Plan abort criteria** — Defines conditions (target down, scope revoked, budget exhausted) that halt the hunt immediately.
30064. **Plan resumption protocol** — Specifies how a paused hunt resumes: which phases re-run, which reuse cached results.
30065. **Plan legal hold** — Pauses all testing if a scope-revocation notice or legal email is detected during the hunt.
30066. **Plan insurance estimator** — Estimates the probability that the plan finds at least one valid finding before any cost is spent.
30067. **Plan module cost profiler** — Profiles each module's historical time-per-finding to rank modules by efficiency.
30068. **Plan phase gate voting** — Requires the planner plus two critic agents to vote before advancing past high-risk phases.
30069. **Plan canary module** — Runs one low-risk module first as a canary; only continues if the target behaves normally.
30070. **Plan sandbox rehearsal** — Rehearses the full plan against a cloned staging target when the user provides one.
30071. **Plan data-retention policy** — Declares what hunt data is kept, for how long, and when it is purged, attached to every plan.
30072. **Plan PII minimization rule** — Instructs modules to avoid collecting user PII during recon and testing unless required for a PoC.
30073. **Plan evidence-quota setter** — Pre-allocates how many findings per class the plan will attempt to validate, preventing runaway validation.
30074. **Plan competitor-awareness** — Checks whether other researchers are actively hunting the same program and adjusts focus to less-crowded areas.
30075. **Plan time-of-day optimizer** — Schedules WAF-sensitive modules for hours when the target's defenses historically respond slowest.
30076. **Plan module kill-switch** — Gives every module an independent kill condition evaluated each minute during execution.
30077. **Plan re-plan trigger thresholds** — Defines quantitative triggers (coverage stall, finding drought) that force automatic re-planning.
30078. **Plan skill-gap flagger** — Flags plan modules requiring capabilities not present in this deployment and suggests downgrades.
30079. **Plan output schema contract** — Defines the exact JSON schema every module must emit so downstream scoring stays consistent.
30080. **Plan review SLA** — Sets a maximum planning time (e.g., 10 minutes); if exceeded, the best partial plan ships.
30081. **Plan hallucination guard** — Validates that every plan step references real discovered assets, blocking invented endpoints.
30082. **Plan user-override recorder** — Logs every user edit to an auto-generated plan to train the planner on human preferences.
30083. **Plan demographic bias check** — Reviews plan language and focus for bias toward certain user groups or regions.
30084. **Plan accessibility audit** — Ensures plan review UI is readable by screen readers and keyboard-navigable.
30085. **Plan carbon estimator** — Estimates compute carbon footprint of the plan and offers a low-energy variant.
30086. **Plan offline-capable variant** — Generates a variant that works with no external API calls for air-gapped deployments.
30087. **Plan red-team/blue-team split** — Splits the plan into attack modules and self-defense-evasion modules with separate budgets.
30088. **Plan honeypot detector** — Includes a pre-phase that detects likely honeypot assets and excludes them from the plan.
30089. **Plan decoy-traffic randomizer** — Inserts benign decoy requests into the plan schedule to blend testing traffic.
30090. **Plan legal-jurisdiction mapper** — Maps each planned action to the jurisdictions it touches and flags legally sensitive ones.
30091. **Plan third-party risk gate** — Requires extra approval before modules that touch third-party-owned assets in scope.
30092. **Plan credential-hygiene rule** — Forbids plans from using real user credentials; mandates dedicated test accounts.
30093. **Plan test-account provisioner** — Auto-provisions plan-required test accounts and rotates their credentials per hunt.
30094. **Plan session-isolation rule** — Requires each module to use isolated sessions so test actions can't contaminate each other.
30095. **Plan cleanup phase** — Appends a mandatory cleanup phase that removes test artifacts (accounts, uploaded files) from the target.
30096. **Plan post-cleanup verifier** — Verifies cleanup success by re-checking artifact locations after the cleanup phase.
30097. **Plan sign-off receipt** — Issues a cryptographic receipt of the approved plan for compliance audits.
30098. **Plan anomaly pre-scan** — Runs a 60-second baseline scan to detect target anomalies before committing the full plan.
30099. **Plan confidence re-check** — Recomputes plan confidence after recon completes and allows one free re-plan if confidence dropped.
30100. **Plan module maturity tags** — Tags each module as experimental, beta, or stable so plans can exclude immature modules on critical hunts.
30101. **Plan language-consistency check** — Ensures module prompts match the target's primary language to reduce false positives.
30102. **Plan vendor-fingerprint adapter** — Swaps in vendor-specific module variants when the target's stack (e.g., Salesforce, Shopify) is detected.
30103. **Plan multi-region variant** — Generates region-specific plan variants when the target serves different content per geography.
30104. **Plan outcome pre-registration** — Records the plan's predicted findings before execution to enable honest post-hunt calibration.
30105. **Subdomain-appearance adjudicator** — When a new subdomain appears mid-hunt, decides inclusion by checking it against parsed scope rules, DNS ownership, and certificate transparency.
30106. **Wildcard-scope auto-enroller** — If the program scope uses `*.target.com`, auto-enrolls newly discovered subdomains without human approval and logs each enrollment.
30107. **Acquired-company scope gate** — Holds newly found domains belonging to an acquired company in quarantine until the scope text explicitly covers acquisitions.
30108. **IP-range expansion evaluator** — Decides whether a discovered IP range belongs in scope by comparing ASN, org name, and reverse-DNS against the target's known infrastructure.
30109. **Cloud-bucket ownership prover** — Before expanding scope to a discovered S3/GCS bucket, proves target ownership via naming conventions, DNS, and certificate evidence.
30110. **Scope-expansion budget cap** — Limits auto-expansion to a fixed percentage of total hunt budget so scope creep can't consume the whole hunt.
30111. **Expansion confidence threshold** — Only auto-includes new assets above an ownership-confidence score; below it, they go to a human review queue.
30112. **Expansion audit trail** — Records every scope-expansion decision with the rule cited, evidence seen, and timestamp for program audits.
30113. **Out-of-scope pattern learner** — Learns from past expansion mistakes (assets later ruled out of scope) to tighten future adjudication.
30114. **Scope-drift dashboard** — Shows live in-scope asset count vs. plan baseline so the user sees how far scope has drifted mid-hunt.
30115. **Vendor-subdomain filter** — Auto-excludes discovered subdomains that clearly belong to third-party vendors (e.g., `status.target.com` hosted by a status-page vendor).
30116. **CDN-fronted origin re-scoper** — When an origin IP behind a CDN is found, re-evaluates scope since origins often fall under stricter rules.
30117. **API-version scope handler** — Treats newly discovered API versions (v1→v2) as scope-expansion candidates requiring version-level rule checks.
30118. **Mobile-app backend linker** — Links newly discovered mobile API hosts to the web scope decision by matching bundle IDs and signing certificates.
30119. **Shadow-IT domain adjudicator** — Evaluates domains found via certificate transparency that look like unapproved shadow IT against org-ownership signals.
30120. **Expansion rollback** — Removes an asset from scope and discards its partial results when later evidence shows it was out of scope.
30121. **Scope-rule diff responder** — When the program updates its scope page mid-hunt, re-adjudicates all enrolled assets against the new rules.
30122. **Expansion notification digest** — Sends the user a digest of scope-expansion decisions every 30 minutes instead of per-asset pings.
30123. **Geo-scope enforcer** — Excludes assets geolocated to regions the program explicitly excludes (e.g., sanctioned countries) even if DNS matches.
30124. **Expansion kill-switch** — A single toggle that freezes all automatic scope expansion and routes every decision to manual review.
30125. **Wildcard-DNS expansion blocker** — Prevents infinite expansion loops caused by wildcard DNS resolving every guessed subdomain.
30126. **Parking-page expansion filter** — Excludes newly found domains serving parking pages or registrar placeholders from scope enrollment.
30127. **Redirect-chain scope resolver** — Follows redirect chains from new assets and applies scope rules to the final destination, not just the entry URL.
30128. **Expansion-evidence packager** — Bundles the ownership evidence for each enrolled asset so a disputed finding can prove in-scope status.
30129. **Subdomain-takeover scope priority** — Fast-tracks scope enrollment for dangling subdomains since takeover windows are time-sensitive.
30130. **Expansion rate limiter** — Caps new asset enrollment at N per hour to keep testing depth from collapsing under breadth.
30131. **Scope-expansion cost model** — Estimates the marginal testing cost of each new asset before enrolling it, skipping low-value additions.
30132. **Asset-value pre-scorer** — Scores a new asset's likely value (tech stack, auth surface, data handled) before deciding to expand.
30133. **Expansion deduplication** — Detects when a "new" asset is an alias (CNAME, redirect, same cert) of an already-enrolled asset.
30134. **Scope-expansion time window** — Only allows auto-expansion during the first 60% of the hunt; later discoveries go to a deferred list.
30135. **Deferred-asset backlog** — Queues late-hunt discoveries for a follow-up hunt instead of disrupting the current plan.
30136. **Expansion stakeholder ping** — Asks the user once, with a bundled list, when accumulated ambiguous assets exceed a threshold.
30137. **Scope-rule precedent library** — Stores past scope decisions per program so identical assets get identical rulings automatically.
30138. **Expansion fairness auditor** — Checks that expansion decisions aren't systematically favoring low-effort assets over high-value ones.
30139. **Multi-program expansion router** — Routes a new asset to the correct program's scope rules when the target is enrolled in several programs.
30140. **Expansion confidence decay** — Lowers ownership confidence over time if no corroborating evidence appears, triggering re-adjudication.
30141. **Dark-web mention scope check** — Treats domains mentioned in dark-web chatter about the target as expansion candidates with elevated priority.
30142. **Expansion via passive DNS** — Uses passive-DNS history to decide whether a newly seen subdomain is genuinely new or just newly observed.
30143. **Scope-expansion game theory** — Models expansion as a resource game: enroll an asset only if its expected value beats the opportunity cost of current work.
30144. **Expansion batching** — Adjudicates new assets in batches every 15 minutes rather than interrupting the hunt per asset.
30145. **Scope-expansion dry-run** — Simulates expansion decisions against historical hunts to measure precision/recall before enabling auto-expansion.
30146. **Expansion-exclusion learner** — Records user rejections of proposed expansions and trains a classifier to stop proposing similar ones.
30147. **Parent-domain scope climber** — When a subdomain is in scope, evaluates whether its parent domain or sibling subdomains also qualify.
30148. **Scope-expansion for APIs** — Applies the same adjudication logic to newly discovered API hosts, versions, and gateway domains.
30149. **Expansion for acquired subdomains** — Checks domain WHOIS creation dates to detect recently acquired domains needing special scope handling.
30150. **Scope-expansion alerting** — Alerts the user immediately only for high-value expansions (payment, auth); batches the rest.
30151. **Expansion decision explainer** — Generates a one-line rationale per expansion decision citing the exact scope rule matched.
30152. **Scope-expansion rollback log** — Keeps an immutable log of enrollments and removals for post-hunt compliance review.
30153. **Expansion quota per source** — Caps how many assets each discovery source (CT logs, brute-force, passive DNS) can contribute to prevent source bias.
30154. **Scope-expansion A/B tester** — Randomly holds back some eligible assets to measure the marginal value of expansion decisions.
30155. **Expansion for staging environments** — Gives staging/dev subdomains a separate, lighter testing policy rather than full enrollment.
30156. **Scope-expansion for partner portals** — Quarantines partner/affiliate portals for manual review since scope rules often exclude them.
30157. **Expansion via job postings** — Treats infrastructure mentioned in the target's job postings as ownership evidence for ambiguous assets.
30158. **Expansion via code leaks** — Uses domains found in leaked code/configs as high-confidence expansion candidates.
30159. **Scope-expansion consensus vote** — Requires agreement between the ownership classifier, DNS evidence, and cert evidence before auto-enrollment.
30160. **Expansion shadow mode** — Runs expansion decisions in logging-only mode on the first hunt per program to calibrate thresholds safely.
30161. **Scope-expansion for IPv6** — Applies adjudication to discovered IPv6 ranges with adjusted heuristics since WHOIS data is sparser.
30162. **Expansion for CDN edge nodes** — Decides whether CDN edge hostnames count as in-scope assets or mere infrastructure.
30163. **Scope-expansion for webhooks** — Evaluates webhook/callback URLs as expansion candidates with data-flow risk weighting.
30164. **Expansion for documentation sites** — Auto-enrolls docs portals only when they expose interactive API consoles, not for static docs.
30165. **Scope-expansion for status pages** — Excludes pure status pages but enrolls them if they expose authenticated admin panels.
30166. **Expansion for marketing sites** — Gives marketing microsites a shallow-only testing policy instead of full enrollment.
30167. **Scope-expansion for acquired apps** — Detects mobile apps from acquired companies via store metadata and applies acquisition scope rules.
30168. **Expansion for open-source repos** — Treats the target's public repos as expansion sources for infrastructure hints, not as test targets.
30169. **Scope-expansion for support portals** — Enrolls support/helpdesk portals with a no-customer-data-touching constraint.
30170. **Expansion for community forums** — Gives forums a read-mostly testing policy to avoid disrupting real users.
30171. **Scope-expansion for careers pages** — Excludes pure careers pages unless they host file-upload or application-tracking functionality.
30172. **Expansion for investor portals** — Quarantines investor-relations subdomains for manual review due to sensitivity.
30173. **Scope-expansion for legacy domains** — Applies extra verification to legacy/retired-looking domains since ownership often lapsed.
30174. **Expansion for parked acquisitions** — Flags domains that redirect to the main site as low-priority expansion candidates.
30175. **Scope-expansion for country TLDs** — Evaluates country-code domains against the program's geographic scope clauses.
30176. **Expansion for typo-squat lookalikes** — Treats lookalike domains as potential phishing infrastructure to report, not as in-scope test targets.
30177. **Scope-expansion for internal tools** — Quarantines internal-tool-looking subdomains (vpn, jira, git) for explicit approval before testing.
30178. **Expansion for IoT endpoints** — Applies device-specific safety constraints when expanding to IoT/cloud-device endpoints.
30179. **Scope-expansion for email infrastructure** — Evaluates mail subdomains for spoofing-relevant findings with a no-spam-sending constraint.
30180. **Expansion for DNS infrastructure** — Treats nameserver/DNS assets as informational scope only, never as active test targets.
30181. **Scope-expansion for payment subdomains** — Fast-tracks payment-related subdomains with mandatory extra-care testing constraints.
30182. **Expansion for auth subdomains** — Auto-enrolls SSO/auth subdomains at high priority with credential-safety rules.
30183. **Scope-expansion for file-storage hosts** — Enrolls storage hosts with a read-metadata-only constraint until ownership is certain.
30184. **Expansion for analytics endpoints** — Excludes pure analytics/tracking endpoints from active testing scope.
30185. **Scope-expansion for chat widgets** — Gives third-party chat subdomains a vendor-exclusion check before any enrollment.
30186. **Expansion for A/B test domains** — Treats experiment subdomains as aliases of the main asset rather than independent targets.
30187. **Scope-expansion for CDN purge APIs** — Quarantines cache-purge endpoints for manual approval due to availability risk.
30188. **Expansion for GraphQL endpoints** — Auto-enrolls newly found GraphQL endpoints at any discovered host with schema-aware test plans.
30189. **Scope-expansion for websockets** — Enrolls websocket endpoints with connection-safety limits to avoid resource exhaustion.
30190. **Expansion for gRPC services** — Applies service-mesh ownership checks before enrolling discovered gRPC endpoints.
30191. **Scope-expansion for serverless functions** — Treats serverless function URLs as ephemeral assets with lighter enrollment criteria.
30192. **Expansion for container registries** — Quarantines discovered container registries for manual review due to supply-chain sensitivity.
30193. **Scope-expansion for CI/CD hosts** — Requires explicit user approval before enrolling any CI/CD-looking infrastructure.
30194. **Expansion for backup hosts** — Gives backup subdomains a read-only testing policy with no destructive checks.
30195. **Scope-expansion for monitoring dashboards** — Excludes monitoring dashboards unless they expose unauthenticated sensitive data.
30196. **Expansion for feature-flag services** — Treats feature-flag endpoints as configuration surface with limited test actions.
30197. **Scope-expansion for error-tracking** — Excludes error-tracking subdomains that only receive client-side telemetry.
30198. **Expansion for translation services** — Gives i18n/translation subdomains a shallow testing policy.
30199. **Expansion for survey tools** — Applies a no-fake-submission rule when enrolling survey/form subdomains.
30200. **Scope-expansion for job queues** — Quarantines queue/dashboard hosts for manual review due to side-effect risk.
30201. **Expansion for search infrastructure** — Enrolls search API hosts with query-rate safeguards.
30202. **Scope-expansion for recommendation engines** — Gives recommendation endpoints a read-only testing policy.
30203. **Expansion for ad-tech subdomains** — Excludes ad-tech subdomains owned by third parties from enrollment.
30204. **Expansion decision replay** — Replays every scope decision against the final hunt outcome to grade adjudication accuracy.
30205. **Exploitability signal scorer** — Scores every discovered endpoint 0–100 from signals like parameter count, auth state, reflected input, and error verbosity.
30206. **Parameter-count weighting** — Up-weights endpoints with many query/body parameters since each parameter is an independent injection surface.
30207. **Auth-boundary bonus** — Adds score to endpoints sitting exactly on authenticated/unauthenticated boundaries where access-control bugs cluster.
30208. **State-changing method bonus** — Scores POST/PUT/DELETE endpoints higher than GET endpoints for logic-flaw and CSRF potential.
30209. **Reflected-input detector** — Boosts endpoints whose responses reflect request input, a strong XSS/HTML-injection precursor signal.
30210. **Verbose-error bonus** — Adds points for endpoints leaking stack traces, SQL errors, or framework debug pages.
30211. **Admin-panel proximity score** — Up-weights endpoints under /admin, /internal, or /debug paths regardless of current auth state.
30212. **File-operation signal** — Boosts endpoints with download, upload, export, or path-like parameters for traversal and SSRF potential.
30213. **IDOR-shape detector** — Scores endpoints with numeric/UUID path IDs higher when sibling IDs return different users' data shapes.
30214. **Rate-limit absence signal** — Adds score to login, OTP, and password-reset endpoints lacking rate-limit headers or behaviors.
30215. **GraphQL-field complexity scorer** — Scores GraphQL endpoints by schema size, mutation count, and introspection availability.
30216. **API-version staleness penalty** — Down-weights old API versions already covered by prior hunts unless new endpoints appeared.
30217. **Endpoint freshness boost** — Boosts recently added endpoints (detected via JS bundle diffs or changelog) since new code has more bugs.
30218. **JS-bundle endpoint extractor score** — Scores endpoints found only in JS bundles higher, as they're often untested internal APIs.
30219. **Mobile-only endpoint bonus** — Up-weights endpoints used exclusively by mobile apps, which web-focused hunters often miss.
30220. **Deprecated-endpoint bonus** — Scores deprecated but still-live endpoints higher since they receive less security maintenance.
30221. **Third-party-integration score** — Boosts endpoints calling webhooks, OAuth, or payment gateways for logic-flaw potential.
30222. **Multi-tenant signal** — Adds score to endpoints with tenant/org IDs in paths, indicating multi-tenancy access-control risk.
30223. **Search-endpoint scorer** — Scores search endpoints by query-language richness (filters, sorting, wildcards) for injection potential.
30224. **Export-function scorer** — Up-weights export/report endpoints for SSRF (URL-fetching exports) and data-exposure risk.
30225. **Password-reset flow scorer** — Scores reset flows by token entropy, expiry, and host-header sensitivity.
30226. **Registration-flow scorer** — Scores signup endpoints for user-enumeration, role-assignment, and verification-bypass signals.
30227. **OAuth-callback scorer** — Scores OAuth redirect endpoints by redirect-uri validation strictness observed in responses.
30228. **Payment-flow scorer** — Scores checkout endpoints by price-parameter client-side trust signals and currency handling.
30229. **File-upload scorer** — Scores upload endpoints by allowed extensions, content-type validation, and storage location disclosure.
30230. **Comment/content scorer** — Scores user-content endpoints (comments, profiles, tickets) by stored-XSS rendering context.
30231. **Pagination-parameter scorer** — Up-weights endpoints with page/limit/offset params for SQLi and DoS-via-large-limit potential.
30232. **Sort-parameter scorer** — Scores sort/order parameters for SQL injection via column-name reflection.
30233. **Filter-parameter scorer** — Scores filter/query DSL parameters for NoSQL/LDAP injection shapes.
30234. **Redirect-parameter scorer** — Scores endpoints with next/return/url params for open-redirect and header-injection potential.
30235. **Email-parameter scorer** — Scores endpoints accepting emails for enumeration via timing and response differences.
30236. **Phone-parameter scorer** — Scores phone/OTP endpoints for enumeration and rate-limit gaps.
30237. **SSRF-shape scorer** — Scores endpoints accepting URLs, webhooks, or fetch targets for SSRF by parameter name and behavior.
30238. **XXE-shape scorer** — Scores XML-accepting endpoints by content-type and parser error messages.
30239. **Deserialization-shape scorer** — Scores endpoints accepting serialized blobs (Java, pickle, .NET) by framework fingerprints.
30240. **Template-parameter scorer** — Scores endpoints rendering user input into templates by SSTI error signatures.
30241. **JWT-handling scorer** — Scores endpoints consuming JWTs by algorithm confusion and key-confusion signals.
30242. **Session-handling scorer** — Scores session endpoints by fixation, entropy, and cookie-flag signals.
30243. **CORS-misconfig scorer** — Scores endpoints by Access-Control-Allow-Origin reflection of arbitrary origins.
30244. **Websocket scorer** — Scores websocket endpoints by auth-on-upgrade gaps and message-type richness.
30245. **gRPC-method scorer** — Scores gRPC methods by reflection availability and method count.
30246. **Serverless-function scorer** — Scores serverless endpoints by cold-start timing leaks and event-shape complexity.
30247. **Microservice-boundary scorer** — Up-weights endpoints at service boundaries (BFF, gateway) for auth-propagation bugs.
30248. **Legacy-protocol scorer** — Scores SOAP/XML-RPC endpoints higher as legacy stacks get less review.
30249. **Debug-endpoint scorer** — Scores /debug, /actuator, /metrics endpoints by exposed internals.
30250. **Health-check scorer** — Scores health endpoints by leaked version and dependency details.
30251. **Feature-flag scorer** — Scores flag-evaluation endpoints for authorization bypass on flag reads.
30252. **Webhook-receiver scorer** — Scores inbound webhook endpoints by signature-verification gaps.
30253. **Callback scorer** — Scores payment/auth callback endpoints by replay and tampering signals.
30254. **Bulk-operation scorer** — Scores bulk endpoints for IDOR-via-batch and mass-assignment potential.
30255. **Import-function scorer** — Scores CSV/Excel import endpoints for formula injection and parser bugs.
30256. **Preview-function scorer** — Scores preview/render endpoints (markdown, PDF) for SSRF and XSS.
30257. **Share-link scorer** — Scores share/invite endpoints by token entropy and permission granularity.
30258. **Notification scorer** — Scores notification endpoints for template injection and recipient control.
30259. **Audit-log scorer** — Scores log-view endpoints for log-injection and access-control gaps.
30260. **Backup-endpoint scorer** — Scores backup/export endpoints by data-sensitivity and auth strictness.
30261. **Migration-endpoint scorer** — Scores data-migration endpoints for auth gaps and mass data exposure.
30262. **Tenant-provisioning scorer** — Scores signup/provisioning endpoints for privilege-escalation signals.
30263. **API-key management scorer** — Scores key-creation endpoints by scope granularity and leakage.
30264. **Subdomain-takeover scorer** — Scores dangling subdomains by CNAME target claimability.
30265. **Cache-behavior scorer** — Scores endpoints by cache-poisoning signals (unkeyed inputs reflected in cached responses).
30266. **HTTP-method override scorer** — Scores endpoints honoring X-HTTP-Method-Override for access-control bypass potential.
30267. **Content-negotiation scorer** — Scores endpoints varying by Accept header for differential-response bugs.
30268. **Locale-parameter scorer** — Scores locale/lang parameters for path traversal via locale file inclusion.
30269. **Timezone-parameter scorer** — Scores tz parameters for injection into scheduled-job logic.
30270. **Currency-parameter scorer** — Scores currency params for price-manipulation logic flaws.
30271. **Quantity-parameter scorer** — Scores qty params for negative/decimal logic flaws in carts.
30272. **Coupon-parameter scorer** — Scores promo-code endpoints for enumeration and stacking flaws.
30273. **Referral-parameter scorer** — Scores referral endpoints for self-referral and reward-manipulation flaws.
30274. **Vote/rating scorer** — Scores voting endpoints for ballot-stuffing and rate-limit gaps.
30275. **Poll/survey scorer** — Scores poll endpoints for result-manipulation and enumeration.
30276. **Booking-slot scorer** — Scores reservation endpoints for race conditions and slot-holding abuse.
30277. **Queue-position scorer** — Scores queue endpoints for position-manipulation logic.
30278. **Leaderboard scorer** — Scores leaderboard endpoints for score-spoofing via client trust.
30279. **Matchmaking scorer** — Scores matchmaking endpoints for Elo-manipulation and smurfing signals.
30280. **Auction/bid scorer** — Scores bidding endpoints for race conditions and bid-shielding flaws.
30281. **Wallet-balance scorer** — Scores wallet endpoints by balance-update atomicity signals.
30282. **Loyalty-points scorer** — Scores points endpoints for accrual/redeem logic flaws.
30283. **Gift-card scorer** — Scores gift-card endpoints by code entropy and redemption idempotency.
30284. **Subscription scorer** — Scores subscription endpoints for plan-downgrade/upgrade proration flaws.
30285. **Trial-abuse scorer** — Scores trial endpoints for fingerprinting gaps enabling repeated trials.
30286. **Invoice scorer** — Scores invoice endpoints for IDOR and PDF-generation SSRF.
30287. **Tax-calculation scorer** — Scores tax endpoints for jurisdiction-spoofing logic flaws.
30288. **Shipping scorer** — Scores shipping endpoints for address-validation bypass and cost manipulation.
30289. **Return/refund scorer** — Scores refund endpoints for double-refund race conditions.
30290. **Dispute scorer** — Scores dispute endpoints for evidence-tampering and status-manipulation.
30291. **KYC scorer** — Scores KYC endpoints for verification-bypass and document-validation gaps.
30292. **Document-signing scorer** — Scores e-signature endpoints for signer-impersonation flaws.
30293. **Consent-management scorer** — Scores consent endpoints for consent-forgery and withdrawal-ignoring bugs.
30294. **Data-export scorer** — Scores GDPR-export endpoints for other-users'-data exposure.
30295. **Account-deletion scorer** — Scores deletion endpoints for incomplete-erasure and re-registration flaws.
30296. **Score-decay for tested endpoints** — Reduces an endpoint's score each time it's tested with no finding, preventing endless retesting.
30297. **Cross-hunt score persistence** — Carries endpoint scores across hunts on the same target so re-hunts start from learned priorities.
30298. **Score explanation generator** — Attaches a human-readable breakdown of which signals contributed to each endpoint's score.
30299. **Score calibration loop** — Compares predicted scores against actual findings to recalibrate signal weights after every hunt.
30300. **Endpoint-score heatmap** — Renders the target's scored endpoints as a heatmap so the user can see where effort is going.
30301. **Score-threshold auto-tuner** — Adjusts the minimum score for testing based on remaining budget, lowering the bar when time is plentiful.
30302. **Negative-signal penalty list** — Maintains explicit down-weight signals (static assets, health checks, known-safe) to keep scores honest.
30303. **Endpoint clustering by score** — Groups similarly-scored endpoints so one test strategy covers a whole cluster efficiently.
30304. **Score-driven test ordering** — Orders the entire test queue strictly by score, re-sorting live as new signals arrive.
30305. **Coverage-percentage stop-rule** — Stops testing an area when measured coverage reaches the plan's threshold (e.g., 90%) and reallocates effort elsewhere.
30306. **Finding-drought stop-rule** — Stops a module after N consecutive tests with zero findings, scaled by the module's historical hit rate.
30307. **Diminishing-returns detector (hunt-strategy context)** — Tracks findings-per-hour per area and stops when the marginal rate falls below the hunt-wide average.
30308. **Budget-exhaustion hard stop** — Halts all testing the instant the time or dollar budget is consumed, with a graceful state-save.
30309. **Duplicate-finding stop-rule** — Stops a test class when new findings are all duplicates of already-reported issues.
30310. **Target-behavior stop-rule** — Stops intrusive testing if the target starts returning errors, captchas, or blocks, switching to passive modes.
30311. **Scope-revocation stop-rule** — Immediately stops any module whose asset was just adjudicated out of scope.
30312. **WAF-escalation stop-rule** — Stops a module when WAF block rate exceeds 50%, since further probes are wasted.
30313. **Rate-limit stop-rule** — Pauses a module when rate-limit responses appear and resumes only after the backoff window.
30314. **False-positive-rate stop-rule** — Stops a detection module whose validation pass-rate drops below 10%, indicating broken heuristics.
30315. **Time-per-endpoint cap** — Stops testing an individual endpoint after its allocated minutes elapse, regardless of completion.
30316. **Time-per-area cap** — Caps total time per attack-surface area (auth, payments, search) to enforce breadth.
30317. **Request-count cap** — Stops a module after N requests to honor program-imposed or self-imposed traffic limits.
30318. **Depth-limit stop-rule** — Stops crawling or fuzzing beyond a configured depth (e.g., 5 path levels, 3 parameter layers).
30319. **Payload-exhaustion stop-rule** — Stops a fuzzing module when its payload list is exhausted rather than looping.
30320. **Mutation-round cap** — Limits mutation-based fuzzers to K rounds per input before moving on.
30321. **State-space explosion guard** — Stops combinatorial testing when the state space exceeds a threshold, switching to sampled testing.
30322. **Session-expiry stop-rule** — Stops authenticated testing when the test session expires and re-auth fails twice.
30323. **Test-account lockout stop-rule** — Stops immediately if a test account gets locked, to avoid triggering fraud systems.
30324. **IP-reputation stop-rule** — Stops outbound testing if the egress IP gets blocklisted, switching to a clean egress.
30325. **Business-hours stop-rule** — Stops intrusive modules during the target's business hours per plan constraints, resuming after.
30326. **Change-freeze stop-rule** — Stops testing when the target announces a maintenance window or code freeze.
30327. **Target-instability stop-rule** — Stops when response-time variance spikes, indicating the target is struggling under load.
30328. **Data-volume stop-rule** — Stops a module that has downloaded more than X MB, preventing accidental data hoarding.
30329. **PII-encounter stop-rule** — Stops and quarantines a module the moment real user PII appears in responses.
30330. **Credential-encounter stop-rule** — Stops when live credentials appear in responses and routes to a secure handling flow.
30331. **Honeypot-contact stop-rule** — Stops testing an asset when honeypot indicators appear, to avoid polluting the hunt.
30332. **Legal-notice stop-rule** — Stops everything on detection of a cease-and-desist or scope-revocation notice.
30333. **Duplicate-hunt stop-rule** — Stops when another researcher publicly discloses the same finding class on the same target.
30334. **Program-pause stop-rule** — Stops when the bounty program itself pauses or closes mid-hunt.
30335. **Finding-quota stop-rule** — Stops validation efforts for a class once its pre-set evidence quota is filled.
30336. **PoC-success stop-rule** — Stops further testing of a vulnerability class once a working PoC exists for it.
30337. **Critical-finding pivot rule** — Stops breadth testing and pivots all effort to impact assessment when a critical finding lands.
30338. **Chain-completion stop-rule** — Stops hunting additional links once a complete exploit chain reaches the target impact.
30339. **Coverage-stall detector** — Stops an area when coverage hasn't increased in the last 20% of its time allocation.
30340. **Signal-saturation stop-rule** — Stops recon when new discoveries per hour fall below 5% of the cumulative total.
30341. **Hypothesis-exhaustion rule** — Stops an area when all ranked hypotheses for it have been tested.
30342. **Model-confidence stop-rule** — Stops AI-driven probing when the brain's confidence in new hypotheses drops below threshold.
30343. **Token-budget stop-rule** — Stops brain-heavy modules when the hunt's AI token budget is exhausted.
30344. **Compute-budget stop-rule** — Stops GPU/CPU-heavy modules when the compute budget is consumed.
30345. **API-quota stop-rule** — Stops modules consuming third-party APIs when their quotas are exhausted.
30346. **Human-review backlog stop-rule** — Pauses finding generation when the human validation queue exceeds capacity.
30347. **Report-deadline stop-rule** — Stops testing at a fixed cutoff before the report deadline to reserve writing time.
30348. **Diminishing-novelty rule** — Stops a module when its outputs stop being novel compared to earlier outputs (embedding similarity).
30349. **Loop-detection stop-rule** — Stops when the agent revisits the same endpoint-state triple three times.
30350. **Plan-deviation stop-rule** — Stops and re-plans when actual execution has drifted beyond the plan's tolerance band.
30351. **User-interrupt rule** — Stops the current module within 60 seconds of a user stop command, checkpointing state.
30352. **Emergency-stop broadcast** — A single command that halts every running module across all targets in a campaign instantly.
30353. **Graceful-degradation ladder** — Defines ordered stop levels (pause intrusive → pause active → passive only → full stop) instead of binary halts.
30354. **Stop-rule override audit** — Requires a logged reason whenever a human overrides an automatic stop-rule.
30355. **Stop-rule effectiveness scorer** — Grades each stop-rule post-hunt by whether stopping early actually saved time without losing findings.
30356. **Adaptive stop thresholds** — Adjusts stop thresholds per hunt based on target size (bigger targets get looser stopping).
30357. **Stop-rule conflict resolver** — When two stop-rules disagree (one says stop, one says continue), applies a precedence order.
30358. **Per-module stop profiles** — Assigns each module a tailored stop profile instead of one global rule set.
30359. **Stop-rule simulation** — Simulates proposed stop-rules against historical hunt traces before enabling them.
30360. **Stop-event timeline** — Records every stop decision on the hunt timeline with cause and reclaimed budget.
30361. **Reclaimed-budget redistributor** — Automatically redistributes time saved by stop-rules to the highest-scoring untested areas.
30362. **Stop-rule notification policy** — Notifies the user only for hunt-level stops; module-level stops are logged silently.
30363. **Minimum-viable-coverage rule** — Never stops an area before its minimum coverage floor is reached, even under time pressure.
30364. **Critical-area exemption** — Exempts payment/auth areas from aggressive stop-rules, requiring explicit human stop.
30365. **Stop-rule dry-run mode** — Logs what would have stopped without actually stopping, for safe calibration on live hunts.
30366. **Stop-rule A/B test** — Randomly applies stricter stops to half of similar areas to measure finding loss.
30367. **Fatigue-aware stopping** — Stops brain-intensive reasoning loops when output quality degrades, measured by repetition and vagueness.
30368. **Context-window stop-rule** — Stops a module before its context window fills, forcing summarization and handoff.
30369. **Memory-pressure stop-rule** — Stops result-heavy modules when working-memory usage exceeds safe limits.
30370. **Disk-quota stop-rule** — Stops evidence collection when the hunt's disk quota is reached, keeping only high-value artifacts.
30371. **Network-cost stop-rule** — Stops high-bandwidth modules when metered-network cost exceeds budget.
30372. **Third-party-dependency stop** — Stops modules when a required external service (e.g., CT log API) goes down.
30373. **Stale-data stop-rule** — Stops using cached recon data older than the freshness threshold, forcing re-collection or area stop.
30374. **Contradictory-evidence stop** — Stops a hypothesis line when new evidence contradicts its core assumption twice.
30375. **Peer-review stop** — Stops auto-validation of a finding class when peer review overturns two consecutive validations.
30376. **Ethical-boundary stop** — Stops any action approaching the ethical boundary (real user data, production harm) for human review.
30377. **Jurisdiction stop-rule** — Stops testing assets discovered in jurisdictions excluded by the plan's legal mapping.
30378. **Vendor-asset stop-rule** — Stops when evidence shows an asset is vendor-operated and excluded by scope.
30379. **Decommissioned-asset stop** — Stops testing assets that return decommissioned/retired indicators.
30380. **Duplicate-target stop-rule** — Stops when the "new" target turns out to be an alias of an already-hunted target.
30381. **Seasonal stop-rule** — Stops retail-payment deep testing outside peak seasons per plan policy.
30382. **Incident-response stop** — Stops all testing if the target shows signs of an active security incident.
30383. **Media-attention stop** — Pauses intrusive testing when the target is under active media scrutiny to avoid misattribution.
30384. **Stop-rule documentation** — Auto-documents every stop-rule, its threshold, and rationale in the hunt's strategy appendix.
30385. **Stop-rule user education** — Explains to the user in plain language why the hunt stopped a particular area.
30386. **Stop-rule regret analyzer** — Post-hunt, estimates findings potentially lost to each stop decision using held-out data.
30387. **Stop-rule tuning advisor** — Recommends threshold adjustments per rule based on regret analysis across hunts.
30388. **Cross-hunt stop consistency** — Ensures the same stop-rule behaves consistently across hunts on similar targets.
30389. **Stop-rule exception list** — Maintains per-target exceptions where specific stop-rules are relaxed by user approval.
30390. **Stop-rule sunset policy** — Retires stop-rules that haven't triggered in 20 hunts to reduce configuration clutter.
30391. **Stop-rule dependency graph** — Maps which stop-rules depend on which signals so missing signals degrade gracefully.
30392. **Stop-rule latency budget** — Requires stop decisions to execute within 5 seconds of trigger to be effective.
30393. **Stop-rule idempotency** — Guarantees repeated stop triggers don't corrupt hunt state or double-count reclaimed budget.
30394. **Stop-rule recovery protocol** — Defines how a stopped area can be restarted (manual approval + fresh budget slice).
30395. **Partial-stop granularity** — Allows stopping one test class within a module while the module continues other classes.
30396. **Stop-rule fairness check** — Verifies stops aren't systematically starving low-score-but-high-novelty areas.
30397. **Stop-rule chaos test** — Periodically injects artificial stop triggers in staging to verify the stop machinery works.
30398. **Stop-rule versioning** — Versions stop-rule configurations so post-hunt analysis knows exactly which rules ran.
30399. **Stop-rule export** — Exports the active stop-rule set with the hunt report for program transparency.
30400. **Stop-rule marketplace** — Lets teams share proven stop-rule configurations as importable profiles.
30401. **Stop-rule for AI planning loops** — Caps planner re-planning at 3 iterations before forcing execution of the best available plan.
30402. **Stop-rule for scope expansion** — Halts auto-expansion when enrolled assets exceed 150% of the planned asset count.
30403. **Stop-rule for hypothesis generation** — Stops generating new hypotheses when the ranked list exceeds 3× the testable capacity.
30404. **Stop-rule retrospective integration** — Feeds every stop decision into the hunt retrospective for strategy grading.
30405. **Phase-budget splitter** — Splits total hunt time between recon, testing, validation, and reporting using target-size-adjusted ratios.
30406. **Target-size estimator (hunt-strategy context)** — Estimates target size from endpoint count, subdomain count, and JS bundle size before allocating any budget.
30407. **Recon/testing/PoC ratio optimizer** — Learns the optimal phase ratio per target type from historical findings-per-phase data.
30408. **Dynamic budget rebalancer** — Shifts budget from recon to testing early when recon saturates ahead of schedule.
30409. **Per-area time envelopes** — Gives each attack-surface area a time envelope proportional to its endpoint score mass.
30410. **Token-budget allocator** — Divides the AI token budget across planner, testers, and validators by their historical ROI.
30411. **Compute-budget allocator** — Assigns GPU/CPU slices to modules by their compute-intensity profiles.
30412. **Request-budget allocator** — Distributes the total request quota across modules to respect program rate limits.
30413. **Human-review budget** — Reserves a fixed slice of time for human validation of high-impact findings.
30414. **Reporting time reserve** — Locks the final 10% of the budget for report writing, immune to reallocation.
30415. **Contingency reserve** — Holds 5% of budget unallocated for critical-finding pivots and emergencies.
30416. **Opportunity-cost gate** — A module gets more budget only if its projected findings-per-hour beats the current best alternative.
30417. **Marginal-utility allocator** — Allocates the next budget slice to whichever area has the highest marginal expected findings.
30418. **Multi-armed-bandit scheduler** — Treats areas as bandit arms, balancing exploration of new areas with exploitation of productive ones.
30419. **Budget burn-rate monitor** — Tracks spend vs. plan in real time and alerts when burn exceeds 120% of the planned rate.
30420. **Forecast-based reallocation** — Reallocates when the forecasted final coverage falls short of the plan target.
30421. **Priority-lane reservation** — Reserves fast-lane budget for payment/auth areas that must never be starved.
30422. **Background-lane allocator** — Runs low-priority passive collection on spare capacity without touching main budget.
30423. **Burst-budget grants** — Lets a module request a one-time burst grant when it shows exceptional early results.
30424. **Budget auction** — Modules bid for freed-up budget with expected-findings estimates; the planner awards to the best bid.
30425. **Diminishing-budget taper** — Tapers an area's budget automatically as its findings-per-hour declines.
30426. **Fresh-area bootstrap grant** — Gives newly discovered areas a small bootstrap budget to prove their worth.
30427. **Cross-phase borrowing** — Allows testing to borrow from the reporting reserve only with explicit user approval.
30428. **Budget floor per phase** — Guarantees each phase a minimum budget so no phase is ever zeroed out.
30429. **Budget ceiling per module** — Caps any single module at 25% of total budget to enforce diversification.
30430. **Target-complexity multiplier** — Multiplies base budgets by a complexity factor derived from tech-stack diversity.
30431. **Bounty-value-weighted allocation** — Allocates more budget to areas whose vulnerability classes pay higher bounties on this program.
30432. **Risk-weighted allocation** — Weights allocation by business risk of the area (payments > marketing pages).
30433. **Novelty-weighted allocation** — Reserves budget for areas no prior hunt has covered, even at lower expected yield.
30434. **User-preference allocator** — Lets the user drag sliders (speed vs. depth vs. breadth) that reshape the whole allocation.
30435. **Deadline-driven compression** — Compresses all allocations proportionally when the user shortens the hunt deadline mid-run.
30436. **Extension-request advisor** — Recommends whether to request a deadline extension based on remaining high-value untested surface.
30437. **Pause-aware budgeting** — Freezes budget clocks during user pauses so pausing never wastes allocation.
30438. **Multi-session budget ledger** — Tracks budget across paused/resumed sessions as one continuous ledger.
30439. **Per-researcher budget splits** — Splits campaign budgets fairly across researchers by their historical efficiency.
30440. **Skill-matched allocation** — Gives more budget to modules matching the strongest available brain capabilities.
30441. **Tool-cost-aware allocation** — Reduces allocation to modules depending on expensive or quota-limited external tools.
30442. **Energy-aware allocation** — Shifts compute-heavy work to off-peak energy hours in cost-sensitive deployments.
30443. **Latency-aware allocation** — Gives distant/high-latency targets larger time budgets to compensate for slow responses.
30444. **WAF-tax allocator** — Adds extra budget to areas behind aggressive WAFs to cover evasion overhead.
30445. **Auth-overhead allocator** — Budgets extra time for areas requiring complex authenticated setups (MFA, SSO).
30446. **Data-sensitivity allocator** — Reduces intrusive-testing budget in areas handling sensitive data, shifting to logic review.
30447. **Compliance-area allocator** — Reserves budget for compliance-mandated checks (e.g., auth, encryption) regardless of bounty value.
30448. **Regression-area allocator** — Allocates budget to re-test previously found vulnerability classes for regressions.
30449. **Zero-day reserve** — Holds a small budget for pursuing unexpected novel vulnerability patterns discovered mid-hunt.
30450. **Learning-investment allocator** — Spends a slice of budget on experimental techniques to improve future hunts, tracked separately.
30451. **Allocation explainability** — Generates a plain-language breakdown of why each area got its budget.
30452. **Allocation vs. outcome audit** — Post-hunt, compares allocated vs. actual productive time per area.
30453. **Allocation bias detector** — Flags when allocation systematically favors the planner's preferred techniques over diverse ones.
30454. **Allocation fairness across areas** — Ensures no in-scope area gets zero budget without an explicit documented reason.
30455. **Emergency reallocation protocol** — Defines a 60-second path to move budget to a critical finding's impact assessment.
30456. **Allocation snapshot history** — Records every reallocation decision with timestamp, cause, and amount moved.
30457. **Predictive budget exhaustion** — Forecasts when each area's budget will run out and warns 15 minutes ahead.
30458. **Budget rollover (hunt-strategy context)** — Rolls unused module budget into a shared pool instead of letting it expire silently.
30459. **Shared-pool governance** — Governs the shared rollover pool with claim rules to prevent one module hoarding it.
30460. **Allocation dry-run** — Simulates an allocation against historical hunts to preview coverage before committing.
30461. **Allocation templates** — Provides named templates (balanced, deep-dive, broad-sweep, bounty-max) for one-click allocation.
30462. **Custom allocation profiles** — Lets users save and reuse their own budget-split profiles across hunts.
30463. **Allocation for tiny targets** — Uses a condensed allocation (recon 15%, testing 70%, report 15%) for targets under 50 endpoints.
30464. **Allocation for huge targets** — Switches to sampled-coverage allocation with explicit sampling strategy for 10k+ endpoint targets.
30465. **Allocation for API-only targets** — Skips crawl budget entirely and pours it into schema-driven API testing.
30466. **Allocation for SPAs** — Shifts budget from crawling to JS-bundle analysis and client-side logic review.
30467. **Allocation for multi-tenant SaaS** — Adds a dedicated tenant-isolation testing envelope.
30468. **Allocation for marketplaces** — Splits buyer-side and seller-side testing budgets explicitly.
30469. **Allocation for fintech** — Mandates minimum budgets for transaction-integrity and ledger-consistency testing.
30470. **Allocation for healthtech** — Caps intrusive testing and funds privacy-focused logic review instead.
30471. **Allocation for gov targets** — Adds compliance-documentation budget and restricts aggressive techniques.
30472. **Allocation for gaming targets** — Funds economy-manipulation and anti-cheat-bypass testing envelopes.
30473. **Allocation for IoT targets** — Splits device, cloud, and mobile-app testing budgets.
30474. **Allocation for AI targets** — Adds prompt-injection and model-abuse testing envelopes.
30475. **Allocation calendar view** — Shows the budget plan as a timeline so the user sees when each area runs.
30476. **Allocation conflict resolver** — Resolves competing claims on the same budget slice by expected-value ranking.
30477. **Allocation negotiation log** — Logs module budget requests and planner decisions for post-hunt review.
30478. **Under-allocation detector** — Flags areas whose allocation is below the minimum viable testing threshold.
30479. **Over-allocation detector** — Flags areas getting more budget than their score mass justifies.
30480. **Allocation sensitivity analysis** — Shows how findings projections change if allocation shifts ±10% per area.
30481. **Real-time allocation dashboard** — Live view of spent/remaining budget per phase, area, and module.
30482. **Allocation alerts** — Alerts the user when any area crosses 80% spend with low findings to show.
30483. **Allocation autopilot** — Fully automatic reallocation within guardrails, with user override at any time.
30484. **Allocation copilot mode** — Proposes reallocations and waits for one-click user approval.
30485. **Allocation manual mode** — Freezes automatic changes; the user moves budget via the dashboard.
30486. **Budget currency converter** — Converts between time, request-count, token, and dollar budgets consistently.
30487. **Multi-currency budget ledger** — Tracks all four budget currencies in one ledger with conversion rates.
30488. **Budget overrun guard** — Blocks new work orders when any budget currency is exhausted.
30489. **Budget top-up flow (hunt-strategy context)** — Lets the user add time or tokens mid-hunt with one action.
30490. **Sunk-cost ignore rule** — Forces reallocation decisions to use forward-looking expected value, ignoring already-spent budget.
30491. **Allocation post-mortem** — Grades every allocation decision against actual outcomes in the retrospective.
30492. **Allocation strategy library** — Stores winning allocation strategies per target type for reuse.
30493. **Allocation strategy recommender** — Recommends a strategy from the library based on the current target's fingerprint.
30494. **Allocation cold-start defaults** — Sensible default splits for first-time users with no history.
30495. **Allocation for re-hunts** — Biases budget toward changed areas and previously untested surface on repeat hunts.
30496. **Allocation for continuous hunting** — Manages a rolling budget for always-on hunts with weekly replenishment.
30497. **Allocation for time-boxed sprints** — Compresses the full strategy into 2-hour sprint allocations.
30498. **Allocation for bounty events** — Uses aggressive high-yield allocation during limited-time bounty events.
30499. **Allocation for private programs** — Adds discretion-focused constraints that reshape intrusive-test budgets.
30500. **Allocation for public programs** — Assumes crowded hunting and biases toward neglected areas.
30501. **Allocation for pentest contracts** — Adds fixed-scope compliance with contractual coverage minimums per area.
30502. **Allocation for red-team ops** — Funds objective-based allocation (reach the crown jewels) over coverage.
30503. **Allocation benchmarking** — Compares a hunt's allocation efficiency against anonymized community benchmarks.
30504. **Allocation decision replay** — Replays allocation decisions against final outcomes to grade the allocator.
30505. **Staggered-start scheduler** — Launches campaign targets in waves so early learnings reshape later targets' plans.
30506. **Shared-learning bus** — Propagates findings, fingerprints, and working payloads across campaign targets in real time.
30507. **Campaign target clusterer** — Groups the 50 targets by tech stack so similar targets share test strategies.
30508. **Campaign-wide technique rollout** — When a technique works on one target, auto-deploys it to all similar campaign targets.
30509. **Cross-target duplicate suppressor** — Suppresses re-reporting the same finding class already validated on a sibling target.
30510. **Campaign resource pool** — Manages one shared budget pool across targets with per-target minimum guarantees.
30511. **Campaign priority ranker** — Ranks campaign targets by expected bounty yield to order the staggered starts.
30512. **Campaign kill-switch per target** — Lets the user pause one target without disturbing the rest of the campaign.
30513. **Campaign health dashboard** — Shows per-target progress, findings, and budget burn in one live view.
30514. **Campaign-wide stop-rules** — Applies global stop conditions (total budget, deadline) above per-target rules.
30515. **Target-interference guard** — Prevents two campaign workers from testing the same shared backend simultaneously.
30516. **Shared credential vault** — Issues per-target test credentials from one campaign vault with automatic rotation.
30517. **Campaign fingerprint cache** — Caches tech fingerprints across targets so shared vendors are fingerprinted once.
30518. **Vendor-pattern propagator** — When a vendor-specific bug is found on one target, checks all campaign targets using that vendor.
30519. **Campaign-wide WAF learning** — Shares WAF evasion learnings across targets behind the same WAF provider.
30520. **Campaign payload library** — Builds a campaign-specific payload set from what actually worked, shared across targets.
30521. **Cross-target chain detector** — Detects exploit chains spanning multiple targets (e.g., SSO across sibling apps).
30522. **Campaign scope union manager** — Manages the union of all program scopes with per-target rule overlays.
30523. **Campaign reporting rollup** — Rolls individual target reports into one campaign-level executive summary.
30524. **Campaign bounty tracker** — Tracks submitted, accepted, and paid bounties per target and campaign-wide.
30525. **Campaign ROI analyzer** — Computes findings-per-dollar per target to guide mid-campaign reallocation.
30526. **Underperforming-target pruner** — Pauses targets with zero findings after 50% budget to fund productive ones.
30527. **Breakout-target booster** — Gives extra budget to targets showing early high-severity signals.
30528. **Campaign wave planner** — Plans waves by target similarity so wave 1's learnings maximally inform wave 2.
30529. **Campaign time-zone scheduler** — Staggers intrusive phases to each target's off-peak hours.
30530. **Campaign-wide rate limiter** — Enforces a global request ceiling so the campaign never trips collective defenses.
30531. **Campaign identity rotation** — Rotates egress identities across targets to avoid cross-target correlation.
30532. **Campaign stealth coordinator** — Coordinates low-profile modes across targets to keep the campaign under the radar.
30533. **Campaign-wide honeypot list** — Shares detected honeypots across targets to avoid repeat contact.
30534. **Campaign blocklist sync** — Syncs IP blocks and captcha triggers across targets in real time.
30535. **Campaign learning digest** — Sends the user a daily digest of cross-target learnings and strategy shifts.
30536. **Campaign strategy versioning** — Versions the campaign strategy so mid-campaign pivots are tracked and reversible.
30537. **Campaign A/B strategist** — Runs different strategies on matched target pairs to learn what works.
30538. **Campaign control group** — Holds back 10% of targets as a control to measure strategy effectiveness.
30539. **Campaign-wide hypothesis ranking** — Ranks hypotheses across all targets by global expected value.
30540. **Campaign evidence triage queue** — Merges all targets' findings into one prioritized validation queue.
30541. **Campaign decision-grade retrospective** — Grades each strategic campaign decision (wave order, prunes, boosts) against counterfactual outcomes rather than just listing lessons.
30542. **Campaign template exporter** — Exports a successful campaign's configuration as a reusable template.
30543. **Campaign cloning (hunt-strategy context)** — Clones a campaign's structure for a new target list with one action.
30544. **Campaign target importer** — Imports targets from CSV, program APIs, or asset-discovery feeds.
30545. **Campaign deduplication** — Detects overlapping targets (same company, different domains) and merges their hunts.
30546. **Campaign target enrichment** — Auto-enriches each target with tech fingerprint and scope rules before wave 1.
30547. **Campaign risk scoring** — Scores each target's legal/operational risk to set per-target aggression levels.
30548. **Campaign aggression profiles** — Assigns cautious/standard/aggressive profiles per target based on program type.
30549. **Campaign notification routing** — Routes per-target alerts to the right researcher or channel.
30550. **Campaign SLA tracker** — Tracks per-target milestones against the campaign timeline.
30551. **Campaign milestone celebrator** — Marks campaign milestones (first finding, 10 targets done) to keep momentum visible.
30552. **Campaign pause/resume (hunt-strategy context)** — Pauses the entire campaign with one action, preserving per-target state.
30553. **Campaign disaster recovery** — Restores all target states from snapshots after an infrastructure failure.
30554. **Campaign cost forecasting (hunt-strategy context)** — Forecasts total campaign cost from per-target burn rates.
30555. **Campaign budget alerts** — Alerts when the campaign crosses 50%, 80%, and 100% of total budget.
30556. **Campaign vendor consolidation** — Identifies when many targets share a vendor to justify vendor-focused deep dives.
30557. **Campaign-wide regression sweep** — Re-tests previously found bug classes across all targets after a vendor patch.
30558. **Campaign patch-gap hunter** — Prioritizes targets likely unpatched for recently disclosed vendor CVEs.
30559. **Campaign threat-intel feed** — Ingests threat intel to reprioritize campaign targets facing active exploitation.
30560. **Campaign competitor monitor** — Watches for public disclosures on campaign targets to avoid duplicate work.
30561. **Campaign-wide scope-change handler** — Re-adjudicates all targets when a shared program updates its rules.
30562. **Campaign legal review queue** — Queues legally sensitive targets for review before their wave starts.
30563. **Campaign data-residency guard** — Keeps each target's hunt data in its required jurisdiction.
30564. **Campaign multi-researcher mode** — Assigns targets to researchers by skill match and balances their loads.
30565. **Campaign researcher leaderboard** — Ranks researchers by findings-per-hour to motivate and to spot coaching needs.
30566. **Campaign skill-gap filler** — Identifies techniques no researcher is covering and assigns training or automation.
30567. **Campaign handoff protocol** — Defines how a target's state transfers when reassigned between researchers.
30568. **Campaign communication hub** — Centralizes per-target notes, decisions, and findings for the whole team.
30569. **Campaign-wide search** — Lets researchers search findings, payloads, and notes across all campaign targets.
30570. **Campaign anomaly detector** — Flags targets behaving anomalously (sudden blocks, scope changes) for attention.
30571. **Campaign-wide technique deprecation** — Retires techniques that fail across many targets to save campaign budget.
30572. **Campaign technique champion** — Promotes techniques with cross-target success to default-on status.
30573. **Campaign-wide false-positive learning** — Shares FP patterns across targets so one target's FP trains all validators.
30574. **Campaign report templating** — Applies consistent report branding and structure across all target reports.
30575. **Campaign submission tracker** — Tracks each finding's submission state per program (draft, submitted, triaged, paid).
30576. **Campaign duplicate-claim resolver** — Resolves which target gets credit when the same bug spans multiple targets.
30577. **Campaign-wide PoC reuse** — Reuses PoC scaffolding across similar findings on different targets.
30578. **Campaign video-PoC batcher** — Batches video PoC recording across targets for efficiency.
30579. **Campaign-wide retest scheduler** — Schedules retests of fixed findings across targets in coordinated waves.
30580. **Campaign fix-verification rollup** — Rolls up fix-verification results into a campaign remediation scorecard.
30581. **Campaign SLA breach predictor** — Predicts which targets will miss milestones from current velocity.
30582. **Campaign velocity tracker** — Tracks findings-per-day and coverage-per-day campaign-wide.
30583. **Campaign burn-down chart** — Shows remaining targets and budget over time against the plan.
30584. **Campaign risk register (hunt-strategy context)** — Maintains a live register of campaign risks (blocks, scope loss, budget) with mitigations.
30585. **Campaign decision log (hunt-strategy context)** — Logs every strategic campaign decision with rationale for audit.
30586. **Campaign strategy advisor** — Recommends mid-campaign pivots from live performance data.
30587. **Campaign endgame planner** — Plans the final 10% of the campaign: which targets get the remaining budget.
30588. **Campaign wind-down protocol** — Gracefully closes targets: cleanup, final reports, credential revocation.
30589. **Campaign archive (hunt-strategy context)** — Archives the full campaign (plans, data, decisions) for future reference.
30590. **Campaign comparison (hunt-strategy context)** — Compares the current campaign's metrics against past campaigns.
30591. **Campaign benchmark publisher** — Publishes anonymized campaign benchmarks for the community.
30592. **Campaign white-label reports** — Generates client-branded campaign reports for pentest-style engagements.
30593. **Campaign multi-program mode** — Runs targets across different bounty programs with per-program rule isolation.
30594. **Campaign currency normalizer** — Normalizes bounty values across programs and currencies for fair comparison.
30595. **Campaign timezone normalizer** — Normalizes all campaign timestamps to one timezone for coherent reporting.
30596. **Campaign language localizer** — Generates per-target reports in each program's preferred language.
30597. **Campaign API (hunt-strategy context)** — Exposes campaign management (targets, waves, budgets) via API for external orchestration.
30598. **Campaign webhook events** — Emits webhooks for campaign milestones to integrate with external tooling.
30599. **Campaign dry-run (hunt-strategy context)** — Simulates the full campaign against historical data to validate wave plans and budgets.
30600. **Campaign chaos drills** — Injects simulated failures (target down, scope revoked) to test campaign resilience.
30601. **Campaign auto-scaling (hunt-strategy context)** — Scales parallel workers up or down based on remaining targets and deadline.
30602. **Campaign spot-budget mode** — Uses spare/cheap compute for low-priority targets to cut campaign cost.
30603. **Campaign carbon tracker** — Tracks and reports the campaign's compute carbon footprint.
30604. **Campaign strategy marketplace** — Lets teams publish and import proven multi-target campaign strategies.
30605. **Business-risk tier mapper** — Maps every endpoint to a business-risk tier (payments, auth, PII, content, static) that sets its testing depth.
30606. **Payment-flow deep-dive protocol** — Assigns payment flows the maximum depth: logic-flaw matrices, race conditions, currency edge cases, and refund abuse.
30607. **Static-page shallow sweep** — Limits static/marketing pages to header, TLS, and info-disclosure checks with a hard time cap.
30608. **Depth-level definitions** — Defines five explicit depth levels (L1 surface → L5 stateful multi-step logic) with entry/exit criteria each.
30609. **Depth assignment engine** — Assigns a depth level per endpoint from its risk tier, score, and remaining budget.
30610. **Depth escalation trigger** — Escalates an endpoint to deeper testing when shallow tests reveal anomalies.
30611. **Depth de-escalation trigger** — Drops an endpoint to shallower testing when deep tests repeatedly come back clean.
30612. **Auth-area depth floor** — Guarantees authentication flows never test below L3 depth regardless of budget pressure.
30613. **Payment-area depth floor** — Guarantees payment flows never test below L4 depth regardless of budget pressure.
30614. **PII-handling depth floor** — Sets minimum L3 depth for any endpoint touching personal data.
30615. **Admin-panel depth mandate** — Forces L5 depth on admin panels due to their blast radius.
30616. **API depth by sensitivity** — Sets API testing depth from the sensitivity of data the API exposes, not just endpoint count.
30617. **Depth budget accounting** — Tracks spend per depth level to verify high-risk areas actually received deep testing.
30618. **Depth coverage verifier** — Verifies post-hunt that every tier-1 area reached its mandated depth.
30619. **Depth exception log** — Records every case where an area got less depth than its tier mandated, with the reason.
30620. **Risk-tier re-evaluator** — Re-evaluates an endpoint's tier mid-hunt when new evidence (e.g., it handles payments) appears.
30621. **Tier promotion alert** — Alerts the user when an endpoint is promoted to a higher risk tier mid-hunt.
30622. **Depth-aware scheduling** — Schedules deep-testing phases when the brain and compute are freshest.
30623. **Shallow-first breadth pass** — Runs L1 across the whole target first so nothing is entirely untested before deep dives begin.
30624. **Deep-dive candidate shortlist** — Shortlists the top 20 endpoints for deep dives from score × risk-tier ranking.
30625. **Deep-dive time boxing** — Caps each deep dive (e.g., 45 minutes) to prevent one endpoint consuming the hunt.
30626. **Deep-dive playbook library** — Maintains step-by-step deep-dive playbooks per area type (checkout, SSO, file upload).
30627. **Playbook compliance checker** — Verifies deep dives actually executed their playbook steps, not just claimed to.
30628. **Stateful-flow depth** — Adds extra depth levels for multi-step stateful flows (cart → checkout → refund) tested as sequences.
30629. **Business-logic depth matrix** — Generates a matrix of logic-flaw test cases per flow (negative qty, currency swap, race) for L4+.
30630. **Race-condition depth gate** — Only attempts race-condition testing at L5 with dedicated timing infrastructure.
30631. **Second-order depth gate** — Reserves stored/second-order testing (stored XSS, second-order SQLi) for L4 and above.
30632. **Chain-depth gate** — Only attempts multi-step exploit chaining at L5 with explicit planner approval.
30633. **Cryptographic depth gate** — Reserves crypto-analysis (JWT, token entropy) for endpoints at L3+.
30634. **Source-assisted depth** — Increases depth when source maps or JS bundles are available to guide white-box reasoning.
30635. **Depth vs. breadth optimizer** — Continuously optimizes the depth/breadth split from live findings-per-hour at each level.
30636. **Depth ROI tracker** — Measures findings-per-hour separately for each depth level to prove deep testing pays.
30637. **Depth starvation guard** — Prevents shallow breadth from consuming the entire budget before any deep dive starts.
30638. **Breadth starvation guard** — Prevents a single deep dive from starving all breadth coverage.
30639. **Risk-tier visualizer** — Renders the target as risk-tier-colored regions so depth allocation is visible at a glance.
30640. **Depth plan explainer** — Explains why each area got its depth level in user-reviewable language.
30641. **User depth override** — Lets the user force deeper or shallower testing on any area with one click.
30642. **Depth override audit** — Logs user depth overrides to learn their risk preferences.
30643. **Regulatory depth mandates** — Enforces minimum depths for regulated areas (auth, payments, health data) from compliance rules.
30644. **Depth for third-party areas** — Caps depth on vendor-operated areas to L2 unless the program explicitly allows more.
30645. **Depth for staging areas** — Allows maximum depth on staging environments since blast radius is minimal.
30646. **Depth for production areas** — Caps production depth at L4 without explicit user approval for L5.
30647. **Depth for legacy systems** — Assigns extra-careful deep testing to legacy systems with rollback plans.
30648. **Depth for new features** — Auto-assigns L4+ to recently shipped features detected via changelogs or bundle diffs.
30649. **Depth for deprecated features** — Assigns L3 to deprecated-but-live features, watching for unmaintained code.
30650. **Depth decay over re-hunts** — Reduces depth on areas deeply tested in prior hunts, shifting to change-focused testing.
30651. **Change-triggered depth reset** — Restores full depth when an area's code changes significantly between hunts.
30652. **Depth for GraphQL** — Sets GraphQL depth from schema complexity: introspection + mutation count drive L3–L5.
30653. **Depth for websockets** — Scales websocket depth by message-type richness and auth-on-upgrade findings.
30654. **Depth for file handling** — Forces L4+ on any file upload/download/convert flow.
30655. **Depth for search** — Scales search depth by query-language power (simple text L2, full DSL L4).
30656. **Depth for exports** — Forces L4 on data export endpoints due to SSRF and mass-exposure risk.
30657. **Depth for notifications** — Sets notification-endpoint depth by template-injection and recipient-control signals.
30658. **Depth for onboarding flows** — Assigns L4 to signup/KYC/onboarding for enumeration and bypass testing.
30659. **Depth for account recovery** — Forces L5 on password-reset and recovery flows.
30660. **Depth for session management** — Forces L4 on login/logout/session endpoints.
30661. **Depth for MFA flows** — Forces L5 on MFA enrollment, verification, and recovery.
30662. **Depth for API keys** — Forces L4 on API key issuance, scoping, and rotation endpoints.
30663. **Depth for webhooks** — Sets inbound-webhook depth by signature-verification strictness observed.
30664. **Depth for OAuth** — Forces L5 on OAuth authorize/callback/token endpoints.
30665. **Depth for SAML/SSO** — Forces L5 on SAML endpoints due to XML-signature complexity.
30666. **Depth for billing** — Forces L5 on invoicing, proration, and dunning flows.
30667. **Depth for refunds** — Forces L5 on refund flows for double-refund and state-confusion testing.
30668. **Depth for coupons** — Assigns L4 to promo/coupon logic for stacking and enumeration flaws.
30669. **Depth for loyalty** — Assigns L4 to points/miles accrual and redemption flows.
30670. **Depth for marketplace payouts** — Forces L5 on seller-payout flows.
30671. **Depth for escrow** — Forces L5 on escrow hold/release flows.
30672. **Depth for auctions** — Assigns L4 to bidding flows for race and shill-bidding logic.
30673. **Depth for voting** — Assigns L4 to voting/polling for ballot-stuffing resistance.
30674. **Depth for content moderation** — Assigns L3 to moderation endpoints for bypass testing.
30675. **Depth for reporting flows** — Assigns L3 to abuse-reporting for spam and evasion testing.
30676. **Depth for data export (privacy)** — Forces L4 on GDPR-style exports for cross-user data leaks.
30677. **Depth for deletion flows** — Assigns L4 to account/data deletion for incomplete-erasure testing.
30678. **Depth for consent flows** — Assigns L3 to consent grant/withdrawal for forgery testing.
30679. **Depth for audit logs** — Assigns L3 to log-view endpoints for injection and access-control testing.
30680. **Depth for feature flags** — Assigns L3 to flag evaluation for auth-bypass testing.
30681. **Depth for A/B testing** — Assigns L2 to experiment endpoints, watching for variant-manipulation.
30682. **Depth for recommendations** — Assigns L2 to recommendation endpoints for poisoning-signal testing.
30683. **Depth for ads** — Assigns L2 to ad endpoints for click-fraud and targeting-leak signals.
30684. **Depth for analytics** — Caps analytics ingestion endpoints at L1 (passive observation only).
30685. **Depth for status pages** — Caps status pages at L1 unless authenticated admin functions appear.
30686. **Depth for docs** — Caps static docs at L1; escalates only for interactive API consoles.
30687. **Depth for blogs** — Caps blogs at L2 (comment XSS, author impersonation).
30688. **Depth for forums** — Assigns L3 to forums for stored-XSS and moderation-bypass depth.
30689. **Depth for chat** — Assigns L4 to chat/messaging for XSS, spoofing, and attachment handling.
30690. **Depth for video** — Assigns L3 to video upload/streaming for processing-pipeline bugs.
30691. **Depth for live streaming** — Assigns L4 to live features for token-leak and access-control testing.
30692. **Depth for gaming** — Assigns L4 to game-economy endpoints for duplication and manipulation flaws.
30693. **Depth for IoT control** — Assigns L4 to device-control APIs with safety interlocks on actuation.
30694. **Depth for smart home** — Assigns L4 to home-automation endpoints for unauthorized-actuation testing.
30695. **Depth for vehicle APIs** — Forces L5 on vehicle-control endpoints with strict safety constraints.
30696. **Depth for medical devices** — Caps at L2 with read-only constraints and mandatory human approval beyond.
30697. **Depth for industrial control** — Caps at L1 passive; any active testing needs explicit written approval.
30698. **Depth for AI features** — Assigns L4 to LLM-powered features for prompt-injection and data-extraction testing.
30699. **Depth for RAG pipelines** — Assigns L4 to retrieval-augmented features for poisoning and leakage testing.
30700. **Depth calibration review** — Post-hunt review comparing assigned vs. deserved depth per area to tune the tier mapper.
30701. **Depth effectiveness report** — Reports findings-per-depth-level in the hunt summary to justify the strategy.
30702. **Depth strategy templates** — Named depth strategies (compliance-first, bounty-max, speed-run) selectable per hunt.
30703. **Depth advisor** — Recommends depth changes mid-hunt when risk signals shift.
30704. **Depth decision replay** — Replays depth assignments against final findings to grade the risk-tier mapper.
30705. **Expected-value ranker** — Ranks every AI-generated hypothesis by expected value = estimated probability × estimated impact in dollars.
30706. **Probability estimator** — Estimates each hypothesis's success probability from signal strength and historical base rates per technique.
30707. **Impact estimator** — Estimates bounty impact from severity priors and the program's payout table for the hypothesized class.
30708. **Cost-to-test estimator** — Estimates minutes and requests needed to test each hypothesis to compute ROI-ranked ordering.
30709. **ROI-ranked test queue** — Orders hypothesis testing strictly by expected value per unit cost.
30710. **Hypothesis deduplicator** — Merges semantically duplicate hypotheses (embedding similarity) before ranking to avoid wasted tests.
30711. **Hypothesis specificity scorer** — Up-ranks concrete hypotheses ("SQLi in sort param on /orders") over vague ones ("maybe XSS somewhere").
30712. **Falsifiability checker** — Down-ranks hypotheses with no clear falsification test, since untestable ideas waste budget.
30713. **Novelty bonus (hunt-strategy context)** — Boosts hypotheses using techniques rarely tried on this target type to counter ranking conservatism.
30714. **Base-rate prior table** — Maintains per-technique success base rates from all past hunts to ground probability estimates.
30715. **Target-adjusted priors** — Adjusts base rates by target fingerprint (e.g., Laravel targets raise mass-assignment priors).
30716. **Hypothesis provenance tracker** — Records which brain, signal, or past hunt generated each hypothesis for calibration.
30717. **Provenance-weighted ranking** — Weights hypotheses by their source's historical precision (brain A vs. signal B).
30718. **Contradiction penalizer** — Down-ranks hypotheses contradicting already-established facts about the target.
30719. **Evidence-support scorer** — Scores how much direct evidence (reflections, errors, behaviors) supports each hypothesis.
30720. **Hypothesis clustering** — Groups related hypotheses so one test can falsify or confirm several at once.
30721. **Test-sharing optimizer** — Orders tests to maximize hypotheses eliminated per request sent.
30722. **Sequential-testing planner** — Plans hypothesis tests in sequences where each result optimally informs the next.
30723. **Bayesian updater** — Updates hypothesis probabilities with Bayes' rule as test evidence arrives.
30724. **Hypothesis leaderboard** — Shows live ranked hypotheses with probabilities, letting the user boost or bury any of them.
30725. **User-boosted hypotheses** — Lets the user pin hypotheses to the top; the ranker learns from these overrides.
30726. **Hypothesis burying** — Lets the user kill bad hypotheses; burials train the generator to stop proposing similar ones.
30727. **Stale-hypothesis pruner** — Removes hypotheses whose supporting signals were invalidated by newer recon.
30728. **Hypothesis expiry** — Expires hypotheses untested after 2 hours, forcing regeneration from fresh state.
30729. **Cross-hunt hypothesis memory** — Remembers hypotheses that paid off on similar targets and pre-seeds them.
30730. **Failed-hypothesis memory** — Remembers falsified hypotheses per target fingerprint to avoid regenerating them.
30731. **Hypothesis generation budget** — Caps brain time spent generating hypotheses so generation never starves testing.
30732. **Diverse-hypothesis enforcer** — Forces the generator to cover at least 5 vulnerability classes per ranking round.
30733. **Adversarial hypothesis critic** — A critic agent tries to kill each hypothesis before it reaches the test queue.
30734. **Red-team hypothesis injection** — Periodically injects deliberately tricky hypotheses to keep the ranker honest.
30735. **Hypothesis calibration plot** — Plots predicted probability vs. actual hit rate to expose overconfident ranking.
30736. **Calibration-corrected ranker** — Applies Platt-style calibration to probability estimates from the calibration plot.
30737. **Impact-uncertainty bands** — Shows uncertainty ranges on impact estimates instead of point values.
30738. **Probability-uncertainty bands** — Shows uncertainty ranges on probability estimates to avoid false precision.
30739. **Risk-averse ranking mode** — Ranks by worst-case expected value for cautious hunts.
30740. **Risk-seeking ranking mode** — Ranks by best-case expected value when hunting for a single big bounty.
30741. **Balanced ranking mode** — Default mode blending probability, impact, cost, and novelty.
30742. **Hypothesis portfolio theory** — Selects a portfolio of hypotheses maximizing expected value under a variance constraint.
30743. **Correlated-hypothesis diversifier** — Avoids testing 10 highly correlated hypotheses when one representative test suffices.
30744. **Hypothesis dependency graph** — Maps which hypotheses must be confirmed before others become testable.
30745. **Prerequisite-aware ordering** — Orders tests so prerequisite hypotheses are tested before dependent ones.
30746. **Hypothesis time-decay** — Decays a hypothesis's rank the longer it sits untested, keeping the queue fresh.
30747. **Breaking-news booster** — Boosts hypotheses matching newly published CVEs or exploit techniques.
30748. **Program-focus aligner** — Boosts hypotheses in vulnerability classes the program explicitly prioritizes.
30749. **Duplicate-program penalizer** — Down-ranks hypothesis classes with recent public duplicates on this program.
30750. **Effort-fairness balancer** — Ensures low-probability moonshot hypotheses still get a small test allocation.
30751. **Hypothesis test templates** — Attaches a concrete minimal test plan to each hypothesis at generation time.
30752. **Minimal-viable-test extractor** — Derives the cheapest single request that could falsify each hypothesis.
30753. **Hypothesis batching** — Batches independent hypotheses into combined probe requests where safe.
30754. **Hypothesis result router** — Routes each test result to update all affected hypotheses, not just the one tested.
30755. **Partial-confirmation handler** — Handles tests that neither confirm nor deny, splitting the hypothesis into refined children.
30756. **Hypothesis refinement loop** — Refines confirmed-but-vague hypotheses into specific exploitable variants.
30757. **Counter-hypothesis generator** — For each top hypothesis, generates its strongest counter-hypothesis to test instead.
30758. **Null-hypothesis discipline** — Requires each test to also check the "nothing wrong here" explanation.
30759. **Hypothesis audit trail** — Logs every hypothesis's full lifecycle: generated, ranked, tested, confirmed/falsified.
30760. **Hypothesis hit-rate dashboard** — Shows per-generator hit rates so the user sees which brains produce winners.
30761. **Generator A/B tester** — Randomly assigns hypothesis generation to different brain configs to compare hit rates.
30762. **Hypothesis cost accounting** — Tracks actual vs. estimated test cost per hypothesis to improve the cost estimator.
30763. **Hypothesis value accounting** — Tracks realized bounty per confirmed hypothesis to improve the impact estimator.
30764. **Ranking regret analyzer** — Measures how much expected value was lost by testing in a suboptimal order.
30765. **Optimal-order simulator** — Simulates the optimal test order post-hunt to grade the ranker's live decisions.
30766. **Hypothesis queue depth guard** — Caps the queue at 200; beyond that, only hypotheses beating the 90th percentile enter.
30767. **Emergency hypothesis lane** — Fast-lanes hypotheses about critical impact regardless of probability.
30768. **Hypothesis aging report** — Reports average hypothesis age at test time; old queues indicate generation outpacing testing.
30769. **Generation-throttle controller** — Slows hypothesis generation when the queue is backlogged.
30770. **Hypothesis quality gate** — Blocks hypotheses below a minimum specificity score from entering the queue.
30771. **Multi-brain hypothesis merger** — Merges hypotheses from multiple brains, deduplicating and re-ranking the union.
30772. **Brain-disagreement flagger** — Flags hypotheses where brains strongly disagree on probability for human review.
30773. **Ensemble probability averager** — Averages probability estimates across brains weighted by their calibration.
30774. **Hypothesis natural-language renderer** — Renders each hypothesis as a one-line plain-English statement for user review.
30775. **Hypothesis evidence linker** — Links each hypothesis to the exact signals and responses that motivated it.
30776. **Hypothesis confidence badges** — Shows high/medium/low confidence badges derived from evidence strength.
30777. **Hypothesis tutorial mode** — Explains to new users why a hypothesis is ranked where it is, teaching ranking intuition.
30778. **Hypothesis export** — Exports the ranked hypothesis list with the hunt report for transparency.
30779. **Hypothesis import** — Lets researchers import hypothesis lists from external tools or teammates.
30780. **Hypothesis versioning** — Versions hypothesis definitions so refined children link back to parents.
30781. **Hypothesis genealogy viewer** — Shows the family tree of refined hypotheses for post-hunt analysis.
30782. **Hypothesis surprise scorer** — Scores how surprising a confirmed hypothesis was, feeding novelty research.
30783. **Serendipity logger (hunt-strategy context)** — Logs accidental discoveries separately so the ranker isn't credited for luck.
30784. **Hypothesis-driven stopping** — Stops an area when its hypothesis queue is exhausted and regeneration yields nothing new.
30785. **Hypothesis coverage mapper** — Maps hypotheses to attack-surface areas to spot untested regions.
30786. **Untested-area hypothesis quota** — Guarantees each area gets a minimum number of generated hypotheses.
30787. **Hypothesis language matcher** — Generates hypotheses in the target's primary language context to reduce mistranslation.
30788. **Hypothesis compliance filter** — Filters out hypotheses requiring actions forbidden by scope rules.
30789. **Hypothesis safety scorer** — Scores the safety of testing each hypothesis; unsafe ones need human approval.
30790. **Hypothesis blast-radius estimator** — Estimates the worst-case side effects of testing each hypothesis.
30791. **High-blast-radius approval gate** — Routes high-blast-radius hypotheses to human approval before testing.
30792. **Hypothesis rollback plan** — Attaches a cleanup plan to each hypothesis test before it runs.
30793. **Hypothesis canary test** — Runs a harmless canary variant before the real test for risky hypotheses.
30794. **Hypothesis sandbox rehearsal** — Rehearses risky hypothesis tests against a staging clone when available.
30795. **Hypothesis peer review** — Sends top-10 hypotheses to a peer-review agent before expensive testing.
30796. **Hypothesis betting market** — Lets team members bet reputation points on hypotheses to surface human intuition.
30797. **Market-weighted ranking** — Blends the prediction-market odds into the algorithmic ranking.
30798. **Hypothesis champion rotation** — Rotates which brain's hypotheses get priority to prevent single-brain dominance.
30799. **Hypothesis fairness auditor** — Checks the ranker isn't systematically ignoring certain vulnerability classes.
30800. **Hypothesis ranking marketplace** — Lets teams share and import proven ranking configurations.
30801. **Hypothesis cold-start pack** — A starter set of high-base-rate hypotheses for targets with zero recon data.
30802. **Hypothesis warm-start transfer** — Transfers ranked hypotheses from a finished hunt on a sibling target.
30803. **Hypothesis ranking dry-run** — Simulates ranking against historical hunts to validate a new ranking config.
30804. **Hypothesis ranking retrospective** — Grades the ranker's ordering against actual outcomes in the hunt retrospective.
30805. **Candidate validation queue** — Orders 200+ raw findings for validation by severity × confidence × bounty value.
30806. **Validation ROI scorer** — Scores each candidate by expected bounty divided by estimated validation effort.
30807. **Quick-win lane** — Fast-tracks candidates validatable in under 5 minutes to bank early wins.
30808. **Deep-validation lane** — Queues complex candidates needing multi-step PoCs separately so they don't block quick wins.
30809. **Confidence-tiered triage** — Splits candidates into auto-validate, human-review, and discard tiers by confidence score.
30810. **Severity-first triage** — Validates critical/high candidates before mediums regardless of confidence.
30811. **Bounty-first triage mode** — Reorders the queue by expected payout when the user wants maximum earnings.
30812. **Coverage-first triage mode** — Reorders to validate one candidate per vulnerability class first for breadth.
30813. **Duplicate-cluster triage** — Groups near-duplicate candidates and validates only the best exemplar per cluster.
30814. **Exemplar selector** — Picks the cluster exemplar with the cleanest evidence and highest severity.
30815. **Cluster-collapse reporter** — Reports one finding per cluster with the variant count noted, avoiding duplicate submissions.
30816. **FP-risk scorer** — Scores each candidate's false-positive risk from heuristic signals before spending validation effort.
30817. **High-FP quarantine** — Quarantines candidates with FP risk above threshold for batched human review.
30818. **Evidence-completeness scorer** — Scores whether a candidate has enough evidence (request, response, reproduction) to validate.
30819. **Evidence-gap filler** — Auto-collects missing evidence for incomplete candidates before human review.
30820. **Reproduction-difficulty estimator** — Estimates validation difficulty from the candidate's class and target behavior.
30821. **Auto-reproducibility tester** — Re-runs the triggering request to check the candidate reproduces before deeper validation.
30822. **Flaky-candidate detector** — Flags candidates that reproduce inconsistently for special handling.
30823. **Environment-sensitivity checker** — Checks whether a candidate depends on transient state (cache, timing) before validating.
30824. **Validation playbook assigner** — Attaches the right validation playbook to each candidate by its class.
30825. **Playbook-step tracker** — Tracks validation progress per candidate through playbook steps.
30826. **Validation time-boxer** — Caps validation time per candidate; unvalidated ones return to the queue with lower priority.
30827. **Validation escalation** — Escalates stuck candidates to a stronger brain or human after two failed attempts.
30828. **Human-review batching** — Batches human reviews into focused sessions instead of interrupting per candidate.
30829. **Review-context packager** — Packages each candidate with full context (evidence, similar past rulings) for fast human decisions.
30830. **One-click verdict UI** — Lets reviewers confirm, reject, or request-more-evidence with a single click.
30831. **Reviewer-calibration tracker** — Tracks each reviewer's overturn rate to calibrate their future queue priority.
30832. **Review SLA monitor** — Alerts when candidates wait in human review longer than the SLA.
30833. **Triage starvation guard** — Ensures low-severity candidates eventually get reviewed, not starved forever.
30834. **Triage fairness auditor** — Checks triage isn't systematically deprioritizing certain vulnerability classes.
30835. **Critical-candidate pager** — Immediately pages the user when a likely-critical candidate appears.
30836. **Candidate aging policy** — Ages out candidates unvalidated after 24 hours into a cold-review backlog.
30837. **Cold-backlog sweeper** — Periodically re-scores aged candidates in case priorities changed.
30838. **Triage throughput meter** — Shows candidates validated per hour to spot triage bottlenecks.
30839. **Bottleneck auto-scaler** — Spins up more validation workers when the queue grows faster than throughput.
30840. **Validation worker specialization** — Routes candidates to workers specialized in their class (XSS worker, auth worker).
30841. **Cross-candidate learning** — When one candidate validates, boosts priority of similar candidates; when rejected, demotes them.
30842. **Rejection-reason taxonomy** — Maintains structured rejection reasons (FP, duplicate, out-of-scope, insufficient-impact) for learning.
30843. **Rejection-feedback loop** — Feeds rejection reasons back to detectors to reduce future bad candidates.
30844. **Triage precision tracker** — Tracks what fraction of triaged candidates become valid findings.
30845. **Triage recall estimator** — Estimates valid findings lost to premature triage rejection via sampling.
30846. **Rejected-candidate sampler** — Human-reviews a random sample of auto-rejected candidates to measure recall.
30847. **Triage A/B tester** — Tests triage policy variants on split candidate streams.
30848. **Triage policy versioning** — Versions triage policies so outcomes are attributable to the policy that ran.
30849. **Triage dry-run** — Simulates a triage policy against historical candidates before deployment.
30850. **Triage explainability** — Shows why each candidate sits at its queue position in plain language.
30851. **User triage override** — Lets the user drag candidates to new positions; overrides train the ranker.
30852. **Triage override learner** — Learns persistent ranking adjustments from repeated user overrides.
30853. **Candidate enrichment pipeline** — Enriches candidates with CVE matches, exploit-db references, and severity data before triage.
30854. **Exploit-availability booster** — Boosts candidates with known public exploits since impact is clearer.
30855. **Wormability scorer** — Up-ranks candidates with wormable or self-propagating potential.
30856. **Data-sensitivity linker** — Links candidates to the data they'd expose, boosting PII/financial exposures.
30857. **Reachability analyzer** — Boosts candidates reachable without authentication over auth-required ones.
30858. **Pre-auth bonus** — Adds priority to any candidate exploitable pre-authentication.
30859. **Internet-exposed bonus** — Boosts candidates on internet-facing assets over internal ones.
30860. **Chained-impact estimator** — Estimates a candidate's value as part of a potential chain, not just standalone.
30861. **Chain-seed prioritizer** — Prioritizes candidates that could seed exploit chains (info disclosure, low-sev XSS).
30862. **Triage for re-hunts** — Prioritizes candidates in areas changed since the last hunt.
30863. **Regression-candidate lane** — Fast-lanes candidates matching previously reported-and-fixed findings.
30864. **Zero-day candidate lane** — Gives novel-pattern candidates a dedicated expert-review lane.
30865. **Compliance-candidate lane** — Prioritizes candidates in compliance-mandated areas regardless of bounty value.
30866. **Client-priority lane** — Lets pentest clients mark areas whose candidates jump the queue.
30867. **Triage for campaigns** — Merges multi-target candidates into one global queue with per-target fairness.
30868. **Per-target triage fairness** — Guarantees each campaign target a minimum validation share.
30869. **Triage for time-boxed hunts** — Switches to strict ROI ordering when the deadline is near.
30870. **Triage for continuous hunts** — Uses steady-state priority with aging to keep the queue flowing.
30871. **Candidate dedup across hunts** — Suppresses candidates already validated in prior hunts on the same target.
30872. **Candidate change detector** — Re-queues a previously rejected candidate only if new evidence changed its status.
30873. **Triage notification digest** — Sends periodic triage summaries instead of per-candidate alerts.
30874. **Triage dashboard** — Live view of queue depth, validation rate, and confirmed findings.
30875. **Triage forecasting** — Forecasts queue clearance time from current throughput.
30876. **Triage capacity planner** — Recommends reviewer staffing from forecasted candidate volume.
30877. **Validation cost ledger** — Tracks validation spend per candidate class to inform future triage.
30878. **Triage ROI report** — Reports bounty earned per validation-hour in the hunt summary.
30879. **Candidate lifetime tracker** — Tracks time from detection to validated finding per candidate.
30880. **Slow-lane analyzer** — Identifies which candidate classes consistently take longest to validate.
30881. **Fast-lane analyzer** — Identifies which classes validate fastest for quick-win planning.
30882. **Triage gamification** — Awards reviewers points for accurate fast verdicts to keep queues moving.
30883. **Reviewer disagreement resolver** — Escalates candidates where two reviewers disagree to a tie-breaker.
30884. **Consensus verdict recorder** — Records multi-reviewer consensus for borderline candidates.
30885. **Triage bias training** — Shows reviewers their personal bias stats (e.g., over-rejecting XSS) to improve calibration.
30886. **Candidate anonymizer** — Anonymizes target details in review packages when reviewers shouldn't know the client.
30887. **Triage access controls** — Restricts who can approve critical-candidate submissions.
30888. **Submission-readiness checker** — Verifies a validated candidate has everything the program's submission form requires.
30889. **Submission packager** — Bundles evidence, PoC, and impact statement into a submission-ready package.
30890. **Submission duplicate checker** — Checks program disclosure history once more before submitting to avoid duplicates.
30891. **Submission timing optimizer** — Times submissions for when triage teams are most responsive, based on program history.
30892. **Submission tracker** — Tracks each submitted candidate through triaged/accepted/paid states.
30893. **Bounty-negotiation advisor** — Suggests severity arguments when the program underrates a finding.
30894. **Triage retrospective** — Grades triage decisions (precision, recall, speed) in the hunt retrospective.
30895. **Triage strategy templates** — Named triage strategies (speed, thoroughness, bounty-max) selectable per hunt.
30896. **Triage autopilot** — Fully automatic triage within guardrails, escalating only borderline cases.
30897. **Triage copilot mode** — AI proposes verdicts; humans approve with one click.
30898. **Triage manual mode** — Disables auto-verdicts; every candidate needs a human decision.
30899. **Triage for AI-generated candidates** — Applies extra skepticism scoring to candidates from generative brains.
30900. **Triage for scanner candidates** — Fast-tracks scanner findings through FP-risk scoring first.
30901. **Triage for manual candidates** — Gives human-entered candidates priority review since a person already vetted them.
30902. **Candidate source attribution** — Tags each candidate with its detection source for source-quality tracking.
30903. **Source-quality leaderboard** — Ranks detection sources by validated-finding rate to guide future investment.
30904. **Triage decision replay** — Replays triage decisions against final outcomes to grade the triage policy.
30905. **Plan-vs-reality comparator** — Compares the generated plan against what actually happened, quantifying drift per phase.
30906. **Strategy decision ledger** — Reconstructs every strategic decision (plan choice, reallocations, stops) into a reviewable timeline.
30907. **Decision quality grader** — Grades each strategic decision against the counterfactual best choice computed post-hunt.
30908. **What-worked extractor** — Identifies the top 5 decisions most correlated with finding success for reinforcement.
30909. **What-was-wasted quantifier** — Quantifies budget spent on zero-yield activities with per-area waste percentages.
30910. **Stop-rule effectiveness review** — Grades each stop decision: time saved vs. findings potentially lost.
30911. **Allocation accuracy scorer** — Scores how well budget allocation matched actual productive areas.
30912. **Ranking calibration review** — Compares hypothesis ranking order against actual hit order to measure ranker skill.
30913. **Triage decision review** — Reviews triage precision/recall: valid findings rejected, FPs validated.
30914. **Depth-assignment review** — Checks whether high-risk areas actually received their mandated depth.
30915. **Scope-decision review** — Audits scope-expansion decisions for precision (in-scope rate) and recall (missed assets).
30916. **Coverage-gap identifier** — Identifies attack-surface areas that received zero testing and why.
30917. **Blind-spot detector (hunt-strategy context)** — Finds vulnerability classes never hypothesized despite being present in the target's stack.
30918. **Technique effectiveness table** — Ranks techniques by findings-per-hour on this hunt for future planning.
30919. **Brain performance review** — Compares brains' hypothesis hit rates and validation accuracy on this hunt.
30920. **Module ROI table** — Reports findings, cost, and ROI per module to guide future module selection.
30921. **Time-use waterfall** — Shows exactly where hunt hours went, phase by phase and module by module.
30922. **Budget variance analysis** — Explains planned-vs-actual spend variances above 15% per phase.
30923. **Finding timeline reconstructor** — Reconstructs when each finding could earliest have been found to spot delays.
30924. **Delay-cause analyzer** — Attributes finding delays to specific causes (late recon, wrong priority, slow validation).
30925. **Early-signal missed detector** — Finds signals present early that, if acted on, would have accelerated findings.
30926. **Pivot quality grader** — Grades mid-hunt pivots (e.g., critical-finding pivot) on whether they paid off.
30927. **Re-plan effectiveness** — Measures whether re-planning events improved subsequent findings-per-hour.
30928. **Checkpoint decision review** — Reviews decisions made at plan checkpoints for quality and timeliness.
30929. **User-override impact analysis** — Measures whether user overrides of AI decisions helped or hurt outcomes.
30930. **Override pattern learner** — Learns persistent lessons from user overrides to reduce future override need.
30931. **Luck-vs-skill separator (hunt-strategy context)** — Separates findings attributable to strategy from serendipitous ones using the serendipity log.
30932. **Counterfactual simulator** — Simulates "what if we had allocated differently" to estimate strategy upside.
30933. **Regret minimizer** — Computes total strategy regret in expected bounty terms for the hunt.
30934. **Strategy delta recommender** — Recommends the top 3 strategy changes for the next hunt on a similar target.
30935. **Personalized lesson cards** — Generates bite-sized lesson cards for the user from this hunt's mistakes and wins.
30936. **Team lesson broadcaster** — Shares anonymized hunt lessons with the team without exposing target details.
30937. **Lesson-action tracker** — Tracks whether retrospective action items were actually implemented in later hunts.
30938. **Retrospective action-item generator** — Auto-creates concrete action items (tune threshold X, add playbook Y) from findings.
30939. **Action-item accountability** — Assigns owners and due dates to retrospective actions with follow-up checks.
30940. **Hunt scorecard (hunt-strategy context)** — Produces a one-page scorecard: coverage, findings, ROI, decision grades, vs. targets.
30941. **Scorecard trend tracker** — Tracks scorecard metrics across hunts to show strategy improvement over time.
30942. **Peer-hunt comparator** — Compares this hunt's strategy metrics against similar past hunts.
30943. **Best-hunt cloner** — Identifies the best past hunt on a similar target and clones its strategy as the next baseline.
30944. **Worst-hunt avoider** — Flags strategy patterns from the worst past hunts to avoid repeating.
30945. **Retrospective depth selector** — Chooses retrospective depth (quick vs. deep) based on hunt importance and anomaly level.
30946. **Anomaly-triggered deep dive** — Triggers an extra-deep retrospective when hunt metrics deviate sharply from norms.
30947. **Retrospective interview bot** — Asks the user targeted questions about judgment calls the data can't explain.
30948. **Decision rationale capturer** — Captures the planner's stated rationale at decision time for later grading.
30949. **Rationale-vs-outcome matcher** — Checks whether decisions made for the stated reasons actually served those reasons.
30950. **Overconfidence detector** — Flags decisions where confidence was high but outcomes were poor.
30951. **Under-confidence detector** — Flags good decisions the planner was unsure about, to encourage bolder play.
30952. **Hindsight-bias guard** — Grades decisions on information available at the time, not on outcomes known later.
30953. **Process-vs-outcome scorer** — Scores decision process quality separately from outcome luck.
30954. **Strategy risk audit** — Audits whether the hunt took appropriate risks given its objectives (moonshots vs. safe bets).
30955. **Exploration-ratio review** — Reviews the explore/exploit balance against the optimal bandit-derived ratio.
30956. **Diversification review** — Checks technique and area diversification against concentration risk.
30957. **Single-point-of-failure finder** — Identifies hunt successes that depended on one lucky break vs. robust process.
30958. **Robustness scorer** — Scores how well the strategy would perform across a distribution of similar targets.
30959. **Strategy fragility report** — Lists strategy elements that break under small target variations.
30960. **Adaptability grader** — Grades how quickly the hunt adapted to surprises (new assets, blocks, findings).
30961. **Surprise log** — Catalogs every surprise encountered and whether the strategy handled it well.
30962. **Surprise preparedness planner** — Converts surprise-log patterns into contingency plans for future hunts.
30963. **Communication review** — Reviews whether the user was informed at the right moments (not too much, not too little).
30964. **Alert-fatigue analyzer** — Measures alert volume vs. actionability to tune notification policies.
30965. **Report quality review** — Grades the hunt report against program expectations and past accepted reports.
30966. **Submission outcome tracker** — Follows submitted findings to acceptance/payment and links outcomes to hunt decisions.
30967. **Bounty-attribution analyzer** — Attributes earned bounty to specific strategic decisions to prove strategy ROI.
30968. **Cost-per-finding benchmark** — Benchmarks this hunt's cost per valid finding against history.
30969. **Time-to-first-finding review** — Analyzes what drove time-to-first-finding and how to shorten it.
30970. **Time-to-critical review** — Specifically reviews the path to the first critical/high finding.
30971. **Dormant-period analyzer** — Finds long unproductive stretches and diagnoses their causes.
30972. **Momentum tracker** — Tracks findings momentum over the hunt to spot when energy should have been redirected.
30973. **Endgame review** — Reviews whether the final 10% of budget was spent wisely.
30974. **Wind-down quality check** — Verifies cleanup, credential revocation, and final reporting were completed.
30975. **Data-hygiene audit** — Audits whether PII and sensitive data were handled per the plan's policy.
30976. **Compliance checklist verifier** — Verifies all scope, legal, and program-rule constraints were honored.
30977. **Ethics review** — Reviews borderline actions for ethical compliance with a structured checklist.
30978. **Safety-incident log** — Records any safety-relevant events (accidental PII, near-miss disruptions) for process improvement.
30979. **Near-miss analyzer** — Studies near-misses as seriously as incidents to strengthen guardrails.
30980. **Retrospective participant poll** — Polls human participants on strategy quality to capture qualitative signal.
30981. **Retrospective sentiment tracker** — Tracks user sentiment about hunt strategy over time.
30982. **Retrospective report generator** — Generates a professional post-hunt strategy report for stakeholders.
30983. **Retrospective sharing controls** — Controls which retrospective details are shareable vs. confidential.
30984. **Retrospective archive search** — Makes all past retrospectives searchable for strategy research.
30985. **Retrospective insight miner** — Mines the retrospective archive for recurring strategy insights.
30986. **Insight-to-policy converter** — Converts validated retrospective insights into default strategy policy changes.
30987. **Policy-change impact tracker** — Tracks whether policy changes from retrospectives actually improved later hunts.
30988. **Retrospective cadence manager** — Schedules retrospectives: automatic quick ones always, deep ones on triggers.
30989. **Retrospective fatigue guard** — Skips retrospectives for trivial hunts to avoid process fatigue.
30990. **Retrospective quality scorer** — Scores retrospectives themselves on actionability to keep them useful.
30991. **Meta-retrospective** — Periodically reviews whether the retrospective process is improving strategy.
30992. **Strategy evolution timeline** — Shows how hunt strategy evolved across hunts as a visual timeline.
30993. **Strategy version diff viewer** — Shows exactly what changed between strategy versions and why.
30994. **Strategy rollback (hunt-strategy context)** — Reverts to a previous strategy version when a new one underperforms.
30995. **Strategy experiment tracker** — Tracks deliberate strategy experiments and their results separately from noise.
30996. **Experiment significance tester** — Applies statistical tests before declaring a strategy experiment a win.
30997. **Strategy knowledge base** — Maintains a living document of proven strategy principles from all retrospectives.
30998. **Onboarding from retrospectives** — Turns top retrospective lessons into training material for new researchers.
30999. **Retrospective API** — Exposes retrospective data via API for external analytics and dashboards.
31000. **Retrospective webhook events** — Emits webhooks when retrospectives complete for integration with team tools.
31001. **Cross-program strategy compare** — Compares strategy effectiveness across different bounty programs.
31002. **Cross-target-type strategy compare** — Compares strategy effectiveness across target types (SaaS vs. fintech vs. IoT).
31003. **Strategy maturity model** — Grades the team's hunting strategy maturity from ad-hoc to optimized across five levels.
31004. **Next-hunt strategy brief** — Auto-generates a strategy brief for the next hunt, applying this hunt's top lessons.
