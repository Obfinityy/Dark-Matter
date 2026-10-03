# Batch 4 — Part 03: False-negative hunting (32005–33004)

32005. **Workflow-state graph visualizer** — renders every multi-step flow the crawler observed as an interactive state graph so skipped or unreachable steps become visually obvious to the hunting agent.
32006. **Step-skip anomaly detector** — replays captured workflows with each step omitted in turn and flags cases where the server still advances the workflow as a success.
32007. **Transition-matrix comparator** — builds the allowed state-transition matrix from observed behavior and flags any server-accepted transition not present in the matrix.
32008. **Step-order fuzzer** — submits multi-step forms in shuffled order to detect workflows whose backend never validates sequence.
32009. **Out-of-order completion probe** — executes the final step of a workflow first to find flows that process completion before prerequisites are met.
32010. **Step-replay validator** — re-executes an already-completed step with altered parameters and flags workflows that accept it as if it were new.
32011. **Cross-session step binder** — starts a workflow in one session and attempts to continue its steps in another to detect missing session-to-workflow binding.
32012. **Workflow-fork monitor** — branches the same workflow at each decision point in parallel sessions and compares server state to find divergent handling.
32013. **Decision-point enumerator** — catalogs every branch/conditional in an observed flow and tests the server response when branches receive impossible input combinations.
32014. **Timeout-window walker** — measures each step's validity window and probes the server just before and after expiry to catch windows that are never enforced.
32015. **Stale-token resubmission tester** — captures step tokens, waits for their nominal expiry, then resubmits them to detect workflows that ignore token age.
32016. **Concurrent-step submitter** — fires all steps of a workflow simultaneously in parallel sessions to find backends that process out-of-order steps as valid.
32017. **Partial-payload progressor** — sends incomplete data at each step and tracks whether the workflow still advances, surfacing missing server-side validation.
32018. **Step-hydration inspector** — checks whether each workflow step re-reads server-side state or trusts client-supplied progress markers.
32019. **Progress-cookie decoder** — decodes client-side workflow progress tokens and mutates the step index to detect client-trusted progression.
32020. **Hidden-step discoverer** — brute-forces sequential step identifiers to uncover undocumented intermediate steps the UI never exposes.
32021. **Step-side-channel sniffer** — measures response timing and size per step to infer hidden validation that only partially fires.
32022. **Multi-actor workflow interleaver** — interleaves steps from two different users into one workflow to detect missing ownership checks mid-flow.
32023. **Role-escalation step probe** — starts a flow as a low-privilege user and attempts the approval step as that same user to find missing role transitions.
32024. **Approval-bypass matrix** — maps every action requiring approval and tests each one without the approval token to surface unenforced gates.
32025. **Two-step-verification state machine builder** — models 2FA enrollment, challenge, and recovery as a formal state machine and flags transitions the server allows but the UI forbids.
32026. **Recovery-flow weak-link scorer** — scores each account-recovery path by number of server-side checks and highlights the weakest recovery route.
32027. **Invitation-lifecycle tracker** — follows invite tokens from creation through acceptance to detect invites that survive expiry, revocation, or role change.
32028. **Onboarding-gate gap finder** — tests whether post-onboarding-only features are reachable by accounts stuck in partial-onboarding states.
32029. **Checkout-state auditor** — walks cart → address → payment → confirm as a state machine and flags any step the server processes twice or out of sequence.
32030. **Payment-status desync detector** — compares the payment gateway callback state against the application's order state to find orders marked paid without payment.
32031. **Refund-flow loop finder** — traces refund requests through states to detect loops where refunding a refunded order generates new credit.
32032. **Subscription-state reconciler** — reconciles billing-system state with app-side entitlement state to find users holding active entitlements on canceled subscriptions.
32033. **Trial-expiry edge prober** — probes the exact trial-expiry boundary with requests timed around the cutoff to detect grace periods the server never closes.
32034. **Feature-flag bypass mapper** — enumerates feature-flagged endpoints and tests them with the flag disabled to find flags enforced only in the UI.
32035. **AB-test group crosser** — joins control and treatment cohorts in one account's sessions and tests whether treatment-only features leak to the control side.
32036. **Gradual-rollout leakage scanner** — probes percentage-gated endpoints from many identities to find gates evaluated per-request instead of per-user.
32037. **Kill-switch validator** — toggles disabled features via direct API calls to detect kill switches that only hide UI elements.
32038. **Maintenance-mode excluder** — tests authenticated endpoints during maintenance windows to find APIs that ignore the maintenance flag.
32039. **Rate-limit state visualizer** — maps rate-limit counters per endpoint and visualizes which actions share or reset counters unexpectedly.
32040. **Quota-reset hunter** — probes quota boundaries at reset moments to find counters that reset early or never decrement.
32041. **Idempotency-key gap detector** — replays requests with reused, missing, and malformed idempotency keys to find endpoints that ignore them.
32042. **Duplicate-submission window finder** — double-submits forms with microsecond offsets to detect missing double-submit protection the scanner's single requests never trigger.
32043. **Optimistic-locking verifier** — sends concurrent updates with stale version numbers to detect missing optimistic-locking checks on edit endpoints.
32044. **Last-write-wins auditor** — interleaves conflicting updates and verifies the final state matches the documented conflict-resolution policy.
32045. **Comment-thread state tracker** — follows comment moderation states to detect comments that render while still marked pending or deleted.
32046. **Draft-publish desync finder** — compares draft visibility against published visibility to find drafts accessible through direct URLs.
32047. **Soft-delete leakage scanner** — queries deleted objects by direct ID to detect soft-deleted records still served to unauthorized users.
32048. **Archive-restore race prober** — archives and restores objects while probing access in between to find permission gaps during transitional states.
32049. **Trash-retention validator** — verifies that trashed items are actually excluded from search, listing, and export endpoints.
32050. **Version-history access checker** — requests historical versions of documents to find versions that bypass current access controls.
32051. **Revision-diff exposure scanner** — diffs document revisions via the API to detect redacted content visible in older revisions.
32052. **Collaborative-editing lock tester** — opens the same document in two sessions and tests whether edit locks are enforced server-side.
32053. **Presence-state spoofer** — manipulates presence/typing indicators to detect user-activity signals leaking to unauthorized viewers.
32054. **Notification-trigger mapper** — maps which state changes fire notifications and tests whether silent state changes bypass audit logging.
32055. **Audit-log completeness verifier** — performs privileged actions and verifies each one appears in the audit log with correct actor attribution.
32056. **Log-tampering window finder** — tests whether actions performed during log-rotation or outage windows are recorded once logging resumes.
32057. **Webhook-state reconciler** — compares webhook delivery state with application state to find events the app records but never delivers.
32058. **Event-ordering validator** — publishes events out of order and verifies consumers reject or correctly reorder them.
32059. **Saga-compensation checker** — fails distributed transactions mid-saga and verifies compensating actions actually roll back every step.
32060. **Distributed-lock bypass tester** — attempts the same critical action from two nodes to detect locks held only in application memory.
32061. **Leader-election edge prober** — triggers failover during a hunt to find endpoints that serve stale leader state.
32062. **Cache-invalidation gap mapper** — updates objects and immediately reads them through every cache layer to find layers serving stale data past invalidation.
32063. **CDN-purge verifier** — purges a cached asset and measures how long edge nodes keep serving the old version.
32064. **Stale-while-revalidate abuser** — requests resources during revalidation windows to detect overly long stale-serving periods.
32065. **Session-fixation flow analyzer** — models login, privilege change, and logout as a state machine to find sessions that survive privilege transitions.
32066. **Privilege-transition revalidator** — upgrades and downgrades a test account's role mid-session and probes whether cached permissions update.
32067. **Impersonation-trail checker** — uses admin impersonation features and verifies the audit trail records both the impersonator and the target.
32068. **Delegated-access expiry prober** — grants temporary delegated access, waits for expiry, and tests whether the delegate's tokens still work.
32069. **API-key scope drift detector** — creates keys with minimal scopes and periodically re-tests them to detect scopes that silently expand.
32070. **Token-refresh chain auditor** — follows refresh-token chains across rotations to find old tokens that remain valid after rotation.
32071. **Device-trust state mapper** — models trusted-device enrollment and tests whether removing trust actually invalidates existing sessions.
32072. **Remember-me persistence tester** — verifies remember-me tokens expire and are bound to the original device fingerprint.
32073. **Single-sign-on state tracker** — initiates SSO from multiple service providers and tests whether logout at one terminates all sessions.
32074. **OAuth-consent drift detector** — modifies granted scopes after consent and tests whether the provider re-prompts or silently accepts.
32075. **PKCE-bypass flow tester** — walks the OAuth code exchange with missing or mismatched PKCE verifiers to find providers that skip the check.
32076. **Redirect-URI state confuser** — registers flows with mutated redirect URIs at each step to detect validation that only happens at registration.
32077. **State-parameter reuse detector** — replays OAuth state parameters across sessions to find providers that accept reused state values.
32078. **Consent-screen skip finder** — drives the OAuth flow programmatically to detect consent screens that can be bypassed with direct requests.
32079. **Granular-permission matrix builder** — builds the full permission-by-resource matrix from observed behavior and highlights cells the documentation omits.
32080. **Permission-inheritance tracer** — traces nested group and folder permissions to find resources inheriting broader access than their parent shows.
32081. **Deny-rule precedence tester** — places explicit denies above allows in test policies and verifies the server honors deny precedence.
32082. **Negative-permission gap scanner** — tests resources with only negative permissions defined to find default-allow fallbacks.
32083. **Break-glass usage auditor** — exercises emergency-access flows and verifies each use triggers alerts and time-boxed expiry.
32084. **Just-in-time access validator** — requests JIT elevation and tests whether access actually revokes when the time box ends.
32085. **Access-review staleness finder** — identifies entitlements granted long ago that no review process has re-certified.
32086. **Dormant-privilege reactivator** — disables then re-enables test accounts to detect privileges that resurrect after reactivation.
32087. **Service-account scope creep mapper** — inventories service-account permissions over time to detect gradual scope expansion.
32088. **Machine-identity lifecycle tracker** — follows workload identities from provisioning to decommission to find identities that outlive their workloads.
32089. **Cross-tenant state isolator** — creates parallel objects in two tenants and probes each tenant's APIs for cross-tenant state leakage.
32090. **Tenant-onboarding residue scanner** — provisions then deletes test tenants and probes for leftover data, DNS, or credentials.
32091. **Subdomain-takeover state watcher** — monitors claimed subdomains through DNS changes to detect dangling states during migration.
32092. **Custom-domain verification gap tester** — walks domain-verification flows to find states where a domain is marked verified without proof.
32093. **Multi-region state desync hunter** — writes in one region and reads in another to detect replication gaps scanners in a single region miss.
32094. **Failover-consistency verifier** — triggers regional failover during active sessions and verifies session and data consistency after.
32095. **Blue-green deployment overlap scanner** — probes both deployment colors during a release window to find endpoints serving mixed versions.
32096. **Canary-analysis blind-spot mapper** — maps which endpoints the canary analysis actually monitors to find unmonitored critical paths.
32097. **Feature-gate cleanup finder** — searches code and config for gates referencing removed features that still alter behavior.
32098. **Dead-code endpoint resurrecter** — finds routes still registered for removed UI pages and tests whether they still execute.
32099. **Commented-route scanner** — parses server configs for commented or disabled routes that remain active in production.
32100. **Shadow-flag detector** — discovers undocumented feature flags in client bundles and tests the behaviors they gate.
32101. **Environment-parity differ** — diffs staging and production behavior for the same requests to find protections present only in staging.
32102. **Debug-mode residue scanner** — probes production for debug endpoints, verbose errors, and stack traces the scanner's generic checks missed.
32103. **Health-check information discloser** — inspects health and readiness endpoints for internal topology details useful to an attacker.
32104. **Metrics-endpoint exposure mapper** — inventories Prometheus and metrics endpoints to find unauthenticated operational telemetry.
32105. **Business-rule miner** — extracts stated business rules from terms pages, help docs, and API descriptions, then builds a testable rule catalog for the hunt.
32106. **Invariant auto-extractor** — observes normal transaction flows and infers invariants (e.g., balance never negative) to test against later.
32107. **Policy-text to test-case compiler** — converts natural-language policy statements into concrete boundary test cases the agent executes.
32108. **Terms-of-service delta hunter** — diffs ToS versions over time to find newly added restrictions that the implementation never enforces.
32109. **Help-center promise verifier** — cross-checks documented limits and guarantees against actual API behavior to find documented-but-unenforced rules.
32110. **Error-message rule revealer** — collects validation error messages and reconstructs the hidden business rules they imply for targeted probing.
32111. **Client-side rule mirror** — extracts validation logic from frontend bundles and tests each rule server-side to find client-only enforcement.
32112. **Pricing-rule consistency checker** — compares prices shown in UI, cart, checkout, and invoice to detect tiers where the server computes differently.
32113. **Discount-stacking simulator** — models coupon, referral, and loyalty combinations and tests the combinations the UI prevents but the API accepts.
32114. **Currency-rounding gap finder** — submits amounts in multiple currencies and compares rounding behavior to find rounding the ledger never applies.
32115. **Tax-calculation verifier** — varies billing addresses across tax jurisdictions and verifies the server applies the correct tax rules per region.
32116. **Fee-waiver logic mapper** — maps every fee in the product and tests the waiver conditions to find waivers granted without meeting criteria.
32117. **Loyalty-point arbitrage detector** — tracks point earn/burn ratios across actions to find earn rates that exceed documented multipliers.
32118. **Referral-loop hunter** — creates referral chains among test accounts to detect referral rewards that compound beyond intended caps.
32119. **Credit-balance reconciler** — reconciles account credit movements against the transaction log to find credits created without a source event.
32120. **Negative-balance opportunity scanner** — probes debit flows with exact-balance amounts to detect accounts the system allows to go negative.
32121. **Overdraft-policy tester** — tests overdraft behavior against the documented policy to find silent overdrafts the UI hides.
32122. **Wallet-transfer rule verifier** — tests peer-to-peer transfer limits, fees, and holds to find transfers that skip documented constraints.
32123. **Escrow-release condition mapper** — maps escrow release triggers and tests each trigger in isolation to find releases that fire early.
32124. **Payout-threshold gap finder** — probes payout minimums and schedules to detect payouts processed below the stated threshold.
32125. **Chargeback-state tracker** — follows disputed transactions through states to find funds released while a chargeback is still open.
32126. **Partial-payment allocator** — makes partial payments and verifies the allocation logic matches the documented waterfall.
32127. **Installment-plan manipulator** — alters installment schedules mid-plan to detect recalculations that drop interest or fees.
32128. **Grace-period boundary walker** — times payments around grace-period edges to find grace logic that never actually expires.
32129. **Late-fee condition tester** — triggers each documented late-fee condition and verifies the fee posts with the correct amount and timing.
32130. **Interest-accrual verifier** — holds balances across accrual boundaries and verifies interest posts match the stated rate and compounding.
32131. **Promotional-rate expiry checker** — enrolls in promotional rates and tests whether the rate actually reverts when the promo window closes.
32132. **Rate-limit tier confuser** — switches between pricing tiers mid-billing-cycle and tests which tier's limits the server enforces.
32133. **Usage-metering reconciler** — compares metered usage against billed usage to find metering gaps that undercount consumption.
32134. **Seat-license counter verifier** — adds and removes seats while testing enforcement to detect license counts the server never validates.
32135. **Concurrent-session license tester** — opens sessions beyond the licensed seat count to find license enforcement that only exists in the UI.
32136. **Feature-entitlement matrix builder** — builds the plan-to-feature matrix from observed access and flags features reachable below their plan tier.
32137. **Trial-feature leakage scanner** — expires test trials and probes every trial feature to find features that remain accessible.
32138. **Downgrade-entitlement pruner** — downgrades plans and verifies premium entitlements are actually revoked rather than merely hidden.
32139. **Upgrade-proration verifier** — upgrades mid-cycle and verifies proration charges match the documented formula.
32140. **Add-on billing reconciler** — subscribes to add-ons and verifies each one bills independently with correct start dates.
32141. **Contract-term enforcer tester** — tests early-termination and renewal flows against contract terms to find unenforced lock-ins.
32142. **Auto-renewal boundary prober** — times cancellation requests around renewal cutoffs to detect renewals processed after cancellation.
32143. **Cooling-off period verifier** — exercises statutory cancellation windows and verifies refunds post within the required timeframe.
32144. **Price-lock guarantee checker** — changes plans under price-lock promises and verifies the locked price persists.
32145. **Grandfathered-plan drift detector** — compares legacy plan behavior against current enforcement to find grandfathered benefits that silently changed.
32146. **Quota-carryover rule tester** — rolls usage across billing periods and verifies carryover matches the documented policy.
32147. **Rollover-expiry verifier** — ages rolled-over quotas and tests whether expiry actually removes them.
32148. **Burst-allowance abuser** — exceeds burstable limits repeatedly to detect burst policies that never throttle.
32149. **Fair-use policy gap finder** — pushes usage far beyond fair-use thresholds to find policies with no enforcement mechanism.
32150. **Abuse-threshold calibrator** — ramps abusive-looking but legitimate traffic to map where automated abuse defenses actually trigger.
32151. **Velocity-check evader mapper** — varies transaction velocity and amounts to map the exact shape of fraud velocity rules.
32152. **Device-velocity tracker** — rotates devices per account to find velocity checks keyed to the wrong identifier.
32153. **Geo-velocity impossibility tester** — performs actions from geographically impossible locations in sequence to test travel-velocity enforcement.
32154. **New-account privilege escalator** — ages fresh accounts through trust tiers to detect privileges granted before trust requirements are met.
32155. **KYC-gate bypass mapper** — walks every gated action with unverified test identities to find gates enforced only at signup.
32156. **Document-verification state tester** — submits verification documents and tests gated actions while verification is still pending.
32157. **Sanctions-screening gap finder** — tests name variations against screening flows to find screening applied inconsistently.
32158. **Withdrawal-hold verifier** — deposits and immediately withdraws to test whether holding periods are enforced server-side.
32159. **Deposit-clearing race tester** — acts on deposits during the clearing window to detect provisional credit treated as settled.
32160. **Settlement-finality checker** — reverses settled transactions through edge APIs to find settlement states the server still mutates.
32161. **Ledger-immutability verifier** — attempts to modify historical ledger entries through every available API to confirm immutability.
32162. **Double-entry balance checker** — sums debits and credits across the visible ledger to detect entries that break double-entry accounting.
32163. **Reconciliation-gap hunter** — compares internal balances against external provider statements to find funds the app cannot account for.
32164. **Suspense-account monitor** — watches suspense and clearing accounts for balances that never resolve to a real account.
32165. **Fee-revenue leakage mapper** — models expected fee revenue per transaction type and flags flows where the fee silently drops to zero.
32166. **Commission-split verifier** — executes marketplace transactions and verifies each party's split matches the documented commission table.
32167. **Royalty-calculation checker** — generates royalty-bearing events and verifies payouts follow the stated royalty schedule.
32168. **Revenue-share drift detector** — tracks revenue-share percentages across partner tiers to detect shares that drift from contracts.
32169. **Affiliate-attribution tester** — walks affiliate click-to-conversion flows to find attribution windows the server extends beyond policy.
32170. **Coupon-abuse pattern miner** — mines coupon usage patterns to find single-use codes the server accepts repeatedly.
32171. **Gift-card balance reconciler** — reconciles gift-card issuance against redemption to find cards redeemable above face value.
32172. **Store-credit expiry tester** — ages store credit past its expiry and tests whether redemption still succeeds.
32173. **Return-window boundary walker** — times returns around window edges to detect windows the server never closes.
32174. **Warranty-claim logic tester** — files warranty claims with ineligible products to find eligibility checks missing server-side.
32175. **Insurance-claim state tracker** — follows claims through adjudication states to detect claims paid without required approvals.
32176. **Claim-duplication detector** — submits identical claims through different channels to find deduplication gaps.
32177. **Benefit-eligibility verifier** — tests benefit enrollment against eligibility rules to find benefits granted to ineligible accounts.
32178. **Enrollment-window tester** — enrolls outside open-enrollment periods through direct API calls to find window checks missing server-side.
32179. **Waiting-period enforcer checker** — uses benefits during waiting periods to detect waiting logic enforced only in the UI.
32180. **Preauthorization bypass finder** — requests services requiring preauthorization and tests whether the server validates the authorization reference.
32181. **Referral-requirement tester** — accesses specialist flows without referral records to find referral checks missing server-side.
32182. **Prescription-quantity limiter** — requests quantities above prescription limits to detect limit enforcement gaps.
32183. **Dosage-rule verifier** — submits dosage combinations against clinical rules to find rule engines that only warn without blocking.
32184. **Appointment-double-booking detector** — books overlapping appointments for the same resource to find scheduling conflicts the server allows.
32185. **Waitlist-priority verifier** — manipulates waitlist positions to detect priority logic that can be bypassed.
32186. **Capacity-limit tester** — books resources beyond stated capacity to find capacity checks missing server-side.
32187. **Booking-window boundary walker** — books outside allowed windows through direct API calls to find window enforcement gaps.
32188. **Cancellation-policy verifier** — cancels under each policy tier and verifies penalties and refunds match the documented schedule.
32189. **No-show policy tester** — triggers no-show conditions and verifies the documented consequences actually apply.
32190. **Rescheduling-rule checker** — reschedules repeatedly to detect limits on reschedule counts the server never enforces.
32191. **Grading-rubric consistency checker** — submits answers across rubric boundaries to detect scoring that deviates from the published rubric.
32192. **Attempt-limit enforcer tester** — exceeds quiz and exam attempt limits through direct API calls to find unenforced caps.
32193. **Time-limit bypass detector** — submits assessments after time expiry to detect timers enforced only client-side.
32194. **Proctoring-state verifier** — walks proctored flows with proctoring disabled to find assessments that accept unproctored submissions.
32195. **Plagiarism-gate tester** — submits known-duplicate content to detect similarity gates that never block.
32196. **Credential-issuance verifier** — completes partial requirements and tests whether credentials issue without full completion.
32197. **Certificate-revocation checker** — revokes test certificates and verifies dependent systems actually reject them.
32198. **Prerequisite-enforcement mapper** — enrolls in advanced courses without prerequisites to find prerequisite checks missing server-side.
32199. **Attendance-policy tester** — manipulates attendance records to detect policies with no server-side validation.
32200. **Grade-change audit verifier** — modifies grades through every available path and verifies each change lands in the audit trail.
32201. **Scholarship-eligibility checker** — applies with ineligible profiles to find eligibility logic enforced only in the application UI.
32202. **Financial-aid disbursement tracker** — follows aid from approval to disbursement to detect disbursements released without required milestones.
32203. **Housing-allocation rule tester** — submits housing preferences that violate allocation rules to find rules the server never checks.
32204. **Lottery-fairness verifier** — enters allocation lotteries repeatedly to detect duplicate entries the deduplication logic misses.
32205. **Low-severity clustering dashboard** — groups low findings by shared asset, session, and data flow so chain candidates surface visually instead of staying buried in a long list.
32206. **Shared-asset chain suggester** — takes every low finding and proposes which other findings on the same asset could combine into a higher-impact chain.
32207. **Data-flow bridge finder** — traces data from each low finding's sink to other findings' sources to detect bridges scanners evaluate in isolation.
32208. **Session-context correlator** — links low findings observed within the same authenticated session to suggest session-scoped exploit chains.
32209. **Privilege-ladder builder** — orders low findings by the privilege each one grants and computes the shortest ladder to full compromise.
32210. **Cross-endpoint token linker** — connects low findings that expose tokens across different endpoints into a single credential-assembly chain.
32211. **Information-disclosure aggregator** — merges individually harmless disclosures and scores the combined picture for sensitive-data reconstruction.
32212. **Username-enumeration amplifier** — pairs enumeration findings with password-spray and lockout weaknesses to surface account-takeover chains.
32213. **Verbose-error chain mapper** — links verbose errors to the endpoints they reveal and suggests authenticated probes built from the leaked paths.
32214. **Open-redirect chain composer** — combines open redirects with OAuth and session flows to propose token-theft chains.
32215. **Clickjacking-plus-action linker** — pairs clickjacking findings with state-changing GET endpoints to surface UI-redress attack chains.
32216. **CSRF-gap chain builder** — links missing-CSRF findings with session-riding opportunities to estimate real-world exploitability.
32217. **Cookie-flag chain scorer** — combines missing cookie flags with XSS or network-attacker findings to score session-theft chains.
32218. **CORS-misconfig amplifier** — pairs permissive CORS with authenticated endpoints to propose cross-origin data-exfiltration chains.
32219. **Subdomain-takeover chain linker** — connects dangling-DNS findings with cookie-scope and OAuth redirect configurations to build takeover chains.
32220. **IDOR-plus-enumeration composer** — links IDOR findings with predictable-ID enumeration to estimate mass data-access chains.
32221. **Mass-assignment bridge finder** — connects mass-assignment findings with role fields to propose privilege-escalation chains.
32222. **SSRF-blind chain builder** — pairs blind SSRF with internal-service discovery findings to propose internal-network pivot chains.
32223. **XXE-out-of-band linker** — connects XXE findings with collaborator callbacks to build data-exfiltration chains from blind XXE.
32224. **SSTI-context escalator** — links template-injection findings with the template engine's capabilities to propose RCE chains.
32225. **Deserialization-gadget mapper** — pairs deserialization findings with known gadget chains for the detected libraries.
32226. **File-upload chain composer** — links permissive upload findings with path and execution contexts to build webshell-upload chains.
32227. **Path-traversal amplifier** — pairs traversal findings with sensitive-file knowledge to propose config and key-theft chains.
32228. **LFI-to-RCE bridge suggester** — connects local-file-inclusion with log-poisoning or session-file opportunities to suggest RCE chains.
32229. **SQLi-privilege escalator** — links SQL injection with database-user privilege findings to propose full database-takeover chains.
32230. **Second-order chain tracker** — follows stored payloads from injection points to every later render context to build delayed-execution chains.
32231. **Stored-XSS distribution mapper** — maps every page that renders a stored payload to quantify the blast radius of a single injection.
32232. **DOM-clobbering bridge finder** — connects DOM-clobbering sources with sink gadgets in the same page to propose client-side chains.
32233. **PostMessage-chain composer** — links insecure postMessage handlers with sensitive actions to build cross-origin attack chains.
32234. **WebSocket-hijack linker** — pairs missing-origin-validation WebSockets with authenticated actions to propose hijack chains.
32235. **GraphQL-batch chain builder** — combines GraphQL batching with rate-limit gaps to propose brute-force and enumeration chains.
32236. **Introspection-amplifier** — pairs GraphQL introspection exposure with discovered mutations to suggest unauthorized-action chains.
32237. **JWT-weakness chain composer** — links weak JWT validation with privileged endpoints to build token-forgery chains.
32238. **Algorithm-confusion bridge** — connects algorithm-confusion findings with key-disclosure findings to propose signature-bypass chains.
32239. **Session-fixation chain builder** — pairs fixation findings with login CSRF or session-prediction to build session-hijack chains.
32240. **Password-reset chain composer** — links reset-token weaknesses with email-change flows to build account-takeover chains.
32241. **2FA-bypass chain linker** — connects 2FA gaps with recovery and session findings to propose authentication-bypass chains.
32242. **OAuth-misconfig chain builder** — pairs redirect and scope findings with client-secret leaks to build token-theft chains.
32243. **SAML-confusion composer** — links SAML validation gaps with identity-provider metadata to propose assertion-forgery chains.
32244. **API-key leakage amplifier** — pairs exposed keys with the scopes those keys grant to quantify the real blast radius.
32245. **Secret-in-JS chain mapper** — connects secrets found in bundles with the endpoints they authenticate to build authenticated-access chains.
32246. **Git-history secret linker** — pairs secrets in history with still-valid credentials to propose persistence chains.
32247. **CI-logic chain builder** — links CI misconfigurations with deployment credentials to build pipeline-compromise chains.
32248. **Webhook-secret chain composer** — pairs weak webhook validation with state-changing webhooks to build forged-event chains.
32249. **DNS-rebinding bridge finder** — connects rebinding-prone endpoints with internal services to propose browser-pivot chains.
32250. **Cache-poisoning chain linker** — pairs cache-key weaknesses with reflected input to build cache-poisoning chains.
32251. **Cache-deception composer** — links cache-deception findings with authenticated content to propose cached-PII exposure chains.
32252. **Host-header chain builder** — pairs host-header injection with password-reset and cache contexts to build poisoning chains.
32253. **Request-smuggling bridge mapper** — connects smuggling findings with backend topology to propose request-hijack chains.
32254. **HTTP-parameter-pollution linker** — pairs HPP findings with backend parsers to build filter-bypass chains.
32255. **Method-override chain finder** — links method-override support with verb-based access control to build authorization-bypass chains.
32256. **Content-type confusion composer** — pairs content-type confusion with parser differentials to build smuggling and bypass chains.
32257. **Encoding-bypass chain builder** — links encoding weaknesses with WAF and filter layers to propose filter-evasion chains.
32258. **Unicode-normalization bridge** — connects normalization gaps with path and auth checks to build bypass chains.
32259. **Race-condition chain amplifier** — pairs race windows with financial or state-changing endpoints to quantify double-spend chains.
32260. **TOCTOU chain composer** — links check-then-act gaps with the privileged actions they guard to build bypass chains.
32261. **Symbolic-link race mapper** — pairs symlink races with file-operation endpoints to build file-overwrite chains.
32262. **Insecure-direct-object chain linker** — connects predictable references across endpoints to build horizontal-traversal chains.
32263. **Function-level authz chain builder** — links missing function-level checks with admin actions to build vertical-escalation chains.
32264. **Broken-object-level chain composer** — pairs BOLA findings with object-graph traversal to build deep data-access chains.
32265. **Excessive-data-exposure aggregator** — merges over-exposed fields across endpoints to reconstruct sensitive records no single endpoint reveals.
32266. **Lack-of-resource-limit chain builder** — pairs missing rate limits with expensive operations to build DoS and cost-exhaustion chains.
32267. **Unrestricted-upload chain linker** — connects unrestricted file types with processing pipelines to build malware-distribution chains.
32268. **CSV-injection chain composer** — links formula-injection findings with export and admin-download flows to build admin-compromise chains.
32269. **Log-injection bridge finder** — pairs log-injection with log-viewer and SIEM contexts to build log-forgery chains.
32270. **Email-header injection linker** — connects header-injection with mail flows to build phishing-from-trusted-domain chains.
32271. **SMS-spoofing chain builder** — pairs SMS parameter control with notification flows to build social-engineering chains.
32272. **Notification-spoofing composer** — links notification content control with trusted-app contexts to build in-app phishing chains.
32273. **Deep-link chain mapper** — pairs insecure deep links with authenticated actions to build mobile-session chains.
32274. **Universal-link hijack linker** — connects universal-link gaps with domain verification to build app-impersonation chains.
32275. **Intent-redirection composer** — links Android intent redirections with privileged components to build privilege-escalation chains.
32276. **WebView-bridge chain builder** — pairs JavaScript bridges with sensitive native methods to build device-compromise chains.
32277. **Biometric-fallback chain linker** — connects weak biometric fallbacks with device-unlock flows to build authentication-bypass chains.
32278. **Clipboard-snooping bridge** — pairs clipboard access with sensitive-display flows to build data-theft chains.
32279. **Screenshot-prevention gap mapper** — links missing FLAG_SECURE with sensitive screens to build shoulder-surfing chains.
32280. **Backup-extraction chain composer** — pairs unencrypted backups with sensitive storage to build offline data-theft chains.
32281. **Keystore-misuse linker** — connects keystore misconfigurations with stored secrets to build key-extraction chains.
32282. **Root-detection bypass chain** — pairs weak root detection with sensitive actions to build tampered-device chains.
32283. **Certificate-pinning gap mapper** — links missing pinning with sensitive API traffic to build MITM chains.
32284. **Deep-freeze chain visualizer** — renders proposed chains as attack graphs with confidence per link so reviewers validate the whole path.
32285. **Chain-confidence scorer** — scores each proposed chain by link reliability and evidence strength to prioritize manual verification.
32286. **Chain-evidence packager** — bundles requests, responses, and screenshots per chain link into a single verifiable evidence pack.
32287. **Chain-replay validator** — replays each proposed chain end-to-end in a sandbox to confirm every link before reporting.
32288. **Alternative-path enumerator** — finds multiple routes to the same impact through different low findings to harden the chain against single-link failure.
32289. **Shortest-impact-path finder** — computes the minimal finding set achieving each impact level to focus verification effort.
32290. **Chain-divergence detector** — flags chains whose links behave differently on replay to catch environment-dependent false chains.
32291. **Cross-user chain tester** — verifies proposed chains work across different test users to rule out account-specific artifacts.
32292. **Time-decay chain monitor** — re-validates chains over hours to detect links that only work in narrow time windows.
32293. **Chain-impact quantifier** — estimates records, funds, or users affected per chain to rank chains by real-world impact.
32294. **Regulatory-mapping linker** — maps each chain's impact to compliance frameworks to prioritize chains with regulatory consequences.
32295. **Fix-dependency mapper** — identifies which single fix would break the most chains to recommend highest-leverage remediations.
32296. **Residual-risk estimator** — estimates remaining risk after each proposed fix to show which chains survive partial remediation.
32297. **Chain-template learner** — learns successful chain patterns per target type and suggests analogous chains on new targets.
32298. **Cross-target chain transfer** — applies chain templates discovered on one target to similar targets to find missed sibling chains.
32299. **Chain-coverage heatmap** — visualizes which assets and flows have chain coverage and which remain unexplored.
32300. **Unexplored-bridge prioritizer** — ranks untested finding pairs by bridge likelihood to direct the next hunting cycle.
32301. **Stale-chain revalidator** — re-tests previously confirmed chains after code changes to detect silently fixed or regressed links.
32302. **Chain-drift detector** — monitors confirmed chains for behavioral drift that indicates partial fixes or new bypasses.
32303. **Multi-chain convergence mapper** — finds assets where several independent chains converge to highlight systemic weakness.
32304. **Defense-in-depth gap visualizer** — overlays chains on the target's security controls to show exactly which layers each chain bypasses.
32305. **Cron-window re-tester** — re-runs time-sensitive probes on a schedule covering nights, weekends, and holidays to catch behaviors that only manifest off-hours.
32306. **Business-hours behavior differ** — diffs endpoint behavior inside versus outside business hours to find after-hours maintenance modes that weaken controls.
32307. **Timezone-boundary walker** — shifts request timestamps across timezone edges to detect date logic that breaks at midnight boundaries.
32308. **Daylight-saving transition prober** — tests time-sensitive flows during DST transitions to find duplicated or skipped validation windows.
32309. **Leap-second edge tester** — probes timestamp validation around leap seconds to detect parsers that reject or mishandle them.
32310. **Month-end batch hunter** — schedules hunts during month-end and quarter-end processing windows when batch jobs may weaken live controls.
32311. **Payroll-cycle prober** — times probes around payroll runs to detect temporary privilege or data exposures during processing.
32312. **Billing-cycle boundary tester** — tests subscription and metering logic exactly at cycle rollover to find off-by-one enforcement gaps.
32313. **Trial-expiry moment catcher** — fires requests in the seconds around trial expiry to detect the exact enforcement instant and any gap.
32314. **Certificate-expiry window scanner** — hunts during certificate renewal windows to find services that briefly serve with expired or mismatched certs.
32315. **DNS-TTL expiry hunter** — times requests around DNS record expiry to catch resolvers serving stale records past TTL.
32316. **Cache-TTL boundary prober** — requests cached objects just before and after TTL expiry to detect stale-serving past the deadline.
32317. **Token-expiry race tester** — uses tokens in the final seconds of validity to find acceptance windows that extend past expiry.
32318. **Refresh-token rotation timer** — measures rotation timing to detect windows where both old and new refresh tokens are valid.
32319. **Session-timeout edge walker** — probes session endpoints around the idle-timeout mark to find sessions that survive past expiry.
32320. **OTP-validity window mapper** — measures actual OTP acceptance windows versus documented ones to find extended validity.
32321. **Rate-limit reset timer** — maps exact reset instants per endpoint to detect resets that happen early or leak across windows.
32322. **Sliding-window edge tester** — probes rate limits at sliding-window edges to find counting implementations with boundary errors.
32323. **Burst-allowance timer** — measures burst refill timing to detect refill logic that grants more than the documented rate.
32324. **Cooldown-period verifier** — tests actions during documented cooldowns to find cooldowns enforced only in the UI.
32325. **Lockout-duration mapper** — maps actual lockout durations versus policy to detect lockouts that expire early.
32326. **Password-expiry boundary tester** — tests authentication just past password expiry to detect grace periods the policy never mentions.
32327. **API-key rotation gap finder** — rotates keys and tests old keys during the propagation window to find lingering validity.
32328. **Key-revocation propagation timer** — measures how long revoked keys keep working across regions and edge nodes.
32329. **Permission-change propagation mapper** — times how long permission changes take to propagate to every enforcement point.
32330. **Config-deploy lag hunter** — probes during config deployments to find windows where old and new rules mix unpredictably.
32331. **Feature-flag flip monitor (false-negative context)** — watches flag changes and tests endpoints during the transition to find inconsistent states.
32332. **Blue-green traffic-shift watcher** — hunts during deployment traffic shifts to find requests routed to mixed versions.
32333. **Canary-percentage prober** — varies request identity during canary rollouts to detect inconsistent canary assignment.
32334. **Rollback-window tester** — probes during rollback events to find controls that disappear when the previous version returns.
32335. **Maintenance-window excluder** — tests every endpoint during maintenance mode to catalog which ones ignore the flag.
32336. **Backup-window behavior differ** — diffs behavior during backup windows to find read-only modes that are not actually enforced.
32337. **Batch-job interference mapper** — runs hunts while batch jobs execute to detect locks and validations the batch path skips.
32338. **ETL-window data-leak hunter** — probes data pipelines during ETL runs to find intermediate datasets exposed mid-load.
32339. **Report-generation timing tester** — requests reports during generation cycles to detect partially generated reports served early.
32340. **Index-rebuild gap finder** — searches during index rebuilds to find stale or missing results the search layer serves.
32341. **Cache-warmup behavior mapper** — probes cold caches after deploys to find fallback paths that skip authorization.
32342. **Cold-start vulnerability window** — tests serverless cold starts for initialization races that skip security setup.
32343. **Scale-event race tester** — triggers autoscaling during a hunt to detect new instances serving with incomplete config.
32344. **Failover-timing prober** — measures failover duration and tests requests during the gap for dropped security checks.
32345. **Leader-election window hunter** — probes during leader elections to find writes accepted by multiple leaders.
32346. **Split-brain behavior tester** — simulates partition timing to detect both sides accepting conflicting writes.
32347. **Clock-skew exploit mapper** — varies client clock skew to find timestamp validations with overly generous tolerance.
32348. **NTP-sync gap tester** — tests time-dependent controls on hosts with skewed clocks to find tolerance windows.
32349. **Future-dated request tester** — submits future timestamps to detect logic that trusts client-supplied future dates.
32350. **Backdated-transaction hunter** — submits backdated records to find audit and ordering logic that accepts them silently.
32351. **Date-rollover fuzzer** — tests year, month, and epoch boundaries to find date arithmetic that overflows or wraps.
32352. **Fiscal-year boundary walker** — probes financial logic at fiscal year edges to detect year-boundary enforcement gaps.
32353. **Holiday-calendar gap finder** — tests date-sensitive rules on holidays to find calendars the server never loads.
32354. **Weekend-rule differ** — diffs weekday versus weekend behavior for rules documented as time-dependent.
32355. **After-hours privilege tester** — tests privileged actions at night to detect time-based access rules that are never enforced.
32356. **Scheduled-task impersonator** — invokes scheduled-job endpoints directly to find cron tasks exposed as unauthenticated APIs.
32357. **Cron-expression parser tester** — fuzzes scheduler inputs to detect injection into job scheduling.
32358. **Delayed-job queue inspector** — inspects delayed job payloads for sensitive data and tests unauthorized job manipulation.
32359. **Retry-storm window hunter** — triggers retry storms and measures whether backoff and circuit breakers actually engage.
32360. **Circuit-breaker timing tester** — trips breakers and measures recovery timing to detect half-open states that leak traffic.
32361. **Timeout-cascade mapper** — chains timeouts across services to find cascading failures that expose debug paths.
32362. **Deadline-propagation verifier** — verifies request deadlines propagate to downstream calls instead of being dropped.
32363. **Long-polling state tester** — holds long-poll connections past documented limits to detect connections that never time out.
32364. **WebSocket-idle timeout prober** — idles WebSocket connections to find missing idle timeouts on authenticated sockets.
32365. **SSE-stream expiry tester** — holds server-sent-event streams open to detect streams that outlive their authorization.
32366. **Subscription-renewal race tester** — renews subscriptions concurrently with expiry to detect double-entitlement windows.
32367. **Graceful-degradation timer** — measures how long degraded modes last during outages to find permanent-degradation states.
32368. **Incident-mode bypass hunter** — tests whether incident or break-glass modes disable controls beyond their documented scope.
32369. **Scheduled-downtime excluder** — catalogs endpoints that stay fully functional during announced downtime windows.
32370. **Time-boxed access verifier** — grants temporary access and verifies revocation happens at exactly the deadline, not later.
32371. **Just-in-time elevation timer** — measures JIT elevation windows to detect elevations that persist past their grant.
32372. **Temporary-token decay tester** — uses short-lived tokens past their TTL to map actual versus documented lifetimes.
32373. **Magic-link expiry mapper** — measures magic-link validity windows across resends to detect links that never expire.
32374. **Invite-expiry boundary walker** — tests invite acceptance at the exact expiry instant to find acceptance past the deadline.
32375. **Password-reset window mapper** — measures reset-token lifetimes and tests reuse after expiry.
32376. **Email-verification decay tester** — tests verification links long after sending to detect links with no expiry.
32377. **Phone-verification retry timer** — maps SMS code retry limits over time to detect limits that reset prematurely.
32378. **Captcha-age tester** — solves captchas then delays submission to detect captchas with no server-side age check.
32379. **Nonce-reuse window finder** — replays nonces after varying delays to map the actual replay-protection window.
32380. **Idempotency-key TTL tester** — reuses idempotency keys after long delays to detect keys that never expire.
32381. **Deduplication-window mapper** — submits duplicates after increasing delays to map the real deduplication horizon.
32382. **Eventual-consistency timer** — measures read-after-write delays across replicas to find windows serving stale authorization data.
32383. **Replication-lag abuser** — writes then immediately reads from replicas to detect lag windows that expose pre-write state.
32384. **Saga-timeout tester** — lets sagas time out mid-flow to detect compensations that never run.
32385. **Distributed-lock TTL hunter** — holds locks past their TTL to detect locks that are never released on expiry.
32386. **Lease-renewal race tester** — races lease renewals to detect double-grant windows.
32387. **Heartbeat-timeout mapper** — stops heartbeats and measures detection delay to find dead-peer windows.
32388. **Election-timeout prober** — triggers elections repeatedly to detect instability windows during leadership changes.
32389. **Quorum-loss behavior tester** — removes quorum during a hunt to detect writes accepted without quorum.
32390. **Fencing-token verifier** — tests whether stale fencing tokens are actually rejected by resource servers.
32391. **Epoch-boundary tester** — crosses epoch or term boundaries during operations to detect stale-term acceptance.
32392. **Log-rotation window hunter** — performs actions during log rotation to detect events lost in the gap.
32393. **Metric-flush timing tester** — tests whether security metrics are lost when flushes coincide with high load.
32394. **Alert-suppression window mapper** — triggers alerts during suppression windows to detect alerts that never fire.
32395. **On-call handoff gap tester** — tests escalation paths during shift changes to find unowned alert windows.
32396. **SLA-boundary verifier** — measures response handling at SLA edges to detect dropped actions past the deadline.
32397. **Retention-policy timer** — ages data past retention limits and verifies deletion actually occurs on schedule.
32398. **Legal-hold expiry tester** — releases legal holds and verifies data handling reverts correctly.
32399. **Consent-expiry enforcer checker** — lets consent expire and verifies processing actually stops.
32400. **Data-subject-request deadline tracker** — files access and deletion requests and verifies completion within regulatory deadlines.
32401. **Breach-notification timer** — simulates breach timelines to verify notification workflows trigger on schedule.
32402. **Patch-window exposure mapper** — hunts during patching windows to find services briefly exposed without protections.
32403. **Vulnerability-scan evasion timer** — detects targets that alter behavior during known scanner schedules and re-tests outside them.
32404. **Time-of-check scheduler** — randomizes hunt timing across days and weeks so time-dependent weaknesses cannot hide behind predictable scan schedules.
32405. **State-machine crawler** — systematically revisits every discovered endpoint under each observed user state (anonymous, trial, paid, suspended) to find state-gated weaknesses.
32406. **User-state matrix builder** — builds the full matrix of user states versus endpoint behaviors to highlight cells where controls vanish.
32407. **Lifecycle-stage enumerator** — enumerates account lifecycle stages (pending, active, dormant, banned) and tests every privileged action in each stage.
32408. **Dormant-account prober** — reactivates dormant test accounts and probes for residual permissions from before dormancy.
32409. **Suspended-account residue tester** — tests suspended accounts for API access that should have been revoked.
32410. **Pending-verification prober** — exercises every feature with unverified accounts to find verification gates missing server-side.
32411. **Locked-account escape tester** — tests locked accounts for password-reset, session, and API paths that still function.
32412. **Deactivated-account persistence checker** — verifies deactivated accounts lose API, token, and webhook access completely.
32413. **Trial-state boundary mapper** — maps exactly which features change state at trial start, mid-trial, and expiry.
32414. **Freemium-ceiling tester** — pushes free-tier accounts to every limit to find limits enforced only in the UI.
32415. **Over-limit state behavior tester** — exceeds quotas then tests whether the account degrades gracefully or keeps full function.
32416. **Payment-failed state prober** — puts accounts into failed-payment states and tests which features remain active.
32417. **Past-due entitlement checker** — verifies past-due accounts actually lose entitlements instead of retaining them silently.
32418. **Chargeback-state account tester** — tests accounts with open chargebacks for continued service access.
32419. **Fraud-flag state enumerator** — flags test accounts for fraud and catalogs which actions remain possible.
32420. **Under-review state prober** — tests accounts in manual-review states for actions that should be frozen.
32421. **KYC-pending capability mapper** — maps the exact capability set available while KYC is pending versus approved.
32422. **Document-rejected state tester** — tests accounts with rejected verification documents for continued privileged access.
32423. **Onboarding-incomplete prober** — abandons onboarding at each step and tests the reachable feature set from that state.
32424. **Profile-incomplete gate tester** — tests features requiring complete profiles with deliberately incomplete ones.
32425. **Email-unverified state mapper** — catalogs every action available before email verification completes.
32426. **Phone-unverified state mapper** — catalogs every action available before phone verification completes.
32427. **2FA-unenrolled state tester** — tests sensitive actions on accounts that never enrolled in 2FA where policy requires it.
32428. **Recovery-mode state prober** — enters account-recovery states and tests which normal actions stay available.
32429. **Password-expired state tester** — tests accounts with expired passwords for API and session paths that still work.
32430. **Must-change-password state bypass tester** — tests whether forced-password-change states can be bypassed via direct API calls.
32431. **Session-elevated state mapper** — elevates sessions with step-up auth and maps how long the elevated state persists.
32432. **Step-up-auth decay tester** — performs step-up auth then waits to find the exact moment elevated privileges decay.
32433. **Impersonation-state residue checker** — ends admin impersonation and verifies no impersonated permissions linger.
32434. **Delegate-access state tester** — tests delegated sessions for actions outside the delegation scope.
32435. **Service-account state enumerator** — tests service accounts for interactive-login and UI paths they should never reach.
32436. **Bot-account capability mapper** — maps what bot or integration accounts can do beyond their documented scope.
32437. **Test-account leakage scanner** — finds test, demo, and sandbox accounts that remain active in production.
32438. **Demo-mode state tester** — enters demo or showcase modes and tests for paths back into real data.
32439. **Sandbox-escape prober** — tests sandbox accounts for API paths that reach production resources.
32440. **Multi-tenant state crosser** — switches tenant context mid-session to detect tenant state leaking across requests.
32441. **Tenant-switch residue tester** — switches between tenants and verifies the previous tenant's data is fully cleared.
32442. **Cross-organization state prober** — tests organization-scoped actions while in cross-org states like invitations.
32443. **Invitation-pending state mapper** — catalogs capabilities available to users with only pending invitations.
32444. **Invitation-accepted residue tester** — tests whether expired or revoked invitations still grant access.
32445. **Team-removed state verifier** — removes test users from teams and verifies immediate loss of team-scoped access.
32446. **Role-changed propagation tester** — changes roles and measures how quickly every enforcement point reflects the new role.
32447. **Permission-revoked residue hunter** — revokes permissions and hunts for cached grants that survive revocation.
32448. **Group-membership state tester** — tests group-gated resources while membership is pending approval.
32449. **Nested-group expansion verifier** — verifies nested group memberships resolve correctly and do not grant unintended access.
32450. **External-collaborator state mapper** — maps the capability set of external collaborators versus internal members.
32451. **Guest-state boundary tester** — pushes guest accounts to every boundary to find guest-only restrictions missing server-side.
32452. **Anonymous-state capability enumerator** — catalogs every action reachable without authentication, including via direct API.
32453. **Logged-out residue tester** — logs out and tests whether tokens, cookies, or cached pages still grant access.
32454. **Concurrent-session state tester** — opens many sessions and tests whether security-state changes propagate to all of them.
32455. **Session-revoked residue hunter** — revokes sessions and hunts for endpoints that still honor the revoked tokens.
32456. **Password-changed session tester** — changes passwords and verifies all other sessions terminate immediately.
32457. **Device-removed state verifier** — removes trusted devices and verifies their sessions and tokens die.
32458. **Device-state spoofer** — manipulates device identifiers to test device-bound authorization.
32459. **New-device state prober** — logs in from new devices and tests whether step-up or notification flows actually trigger.
32460. **Rooted-device state tester** — tests whether rooted or jailbroken device states actually restrict sensitive actions.
32461. **Emulator-state detector tester** — tests whether emulator detection states gate any real functionality.
32462. **VPN-state behavior differ** — diffs behavior with and without VPN to find geo or network-state-dependent controls.
32463. **Tor-exit state tester** — tests from Tor exits to verify documented Tor policies are enforced.
32464. **Datacenter-IP state prober** — tests from datacenter IPs to find bot policies that are never enforced.
32465. **Geo-fenced state tester** — tests from disallowed regions to verify geo-fencing actually blocks.
32466. **Sanctioned-region state verifier** — verifies sanctioned-region blocks apply to API paths, not just the UI.
32467. **IP-reputation state tester** — tests from flagged IPs to detect reputation-based controls missing server-side.
32468. **Rate-limited state escaper** — enters rate-limited states and tests alternative endpoints for the same action.
32469. **Blocked-IP residue tester** — blocks test IPs and verifies all API surfaces honor the block.
32470. **WAF-bypass state differ** — compares WAF-on versus WAF-bypass behaviors to find protections that exist only at the edge.
32471. **Bot-score state mapper** — varies bot-score signals and maps which actions change state in response.
32472. **Captcha-triggered state tester** — triggers captcha states and tests whether solving is actually required to proceed.
32473. **Challenge-state bypass hunter** — enters security-challenge states and tests direct API paths around them.
32474. **Risk-score state enumerator** — manipulates risk signals and catalogs the resulting authentication states.
32475. **Adaptive-auth state verifier** — verifies adaptive authentication actually escalates under risky states.
32476. **Consent-state mapper** — maps consent states per data-processing purpose and tests processing under withdrawn consent.
32477. **Opt-out state verifier** — opts out of tracking and verifies data collection actually stops.
32478. **Do-not-track state tester** — tests whether DNT signals change any server behavior.
32479. **Cookie-consent state bypass tester** — rejects consent and tests whether tracking endpoints still fire.
32480. **Privacy-mode state differ** — diffs data handling in privacy modes versus normal modes.
32481. **Data-deletion state verifier** — requests deletion and verifies every state (search, cache, backup, export) actually purges.
32482. **Anonymized-state reidentifier** — tests anonymized datasets for states where re-identification becomes possible.
32483. **Pseudonymized-state linker** — tests whether pseudonymized records can be linked back across states.
32484. **Encrypted-at-rest state tester** — verifies encryption states actually change when data moves between tiers.
32485. **Backup-state exposure hunter** — tests backup and snapshot states for data accessible without production authorization.
32486. **Archive-state access tester** — tests archived data for access controls weaker than live data.
32487. **Cold-storage state prober** — requests cold-stored data and tests the authorization applied during retrieval.
32488. **Legal-hold state verifier** — places legal holds and verifies deletion and modification are actually blocked.
32489. **Retention-expired state tester** — tests data past retention for continued availability.
32490. **Versioned-state access checker** — tests historical versions for access controls matching current policy.
32491. **Draft-state exposure mapper** — catalogs draft, scheduled, and unpublished states reachable by direct URL.
32492. **Scheduled-publish state tester** — tests scheduled content before its publish time for premature access.
32493. **Embargoed-state prober** — tests embargoed content for access paths that ignore the embargo.
32494. **Staged-rollout state tester** — tests staged content from non-target cohorts for premature exposure.
32495. **Dark-launch state hunter** — finds dark-launched features and tests their readiness-state protections.
32496. **Beta-state boundary tester** — tests beta features for enrollment checks missing server-side.
32497. **Early-access state verifier** — verifies early-access gates apply to API paths, not just landing pages.
32498. **Waitlist-state bypass tester** — tests waitlisted products for direct-access paths around the waitlist.
32499. **Invite-only state prober** — tests invite-only features for unauthenticated or uninvited access paths.
32500. **Private-beta residue hunter** — finds private-beta endpoints that remain active after public launch.
32501. **Sunset-state tester** — tests sunset-announced features for continued operation past the sunset date.
32502. **Deprecated-state access verifier** — verifies deprecated features actually block new usage while honoring migrations.
32503. **Migration-state consistency checker** — tests accounts mid-migration for inconsistent states between old and new systems.
32504. **State-transition fuzzer** — automatically fires random state-changing requests to discover undocumented states and illegal transitions.
32505. **Stored-input taint tracker** — tags every stored user input with a unique canary and monitors all later render locations for its reappearance.
32506. **Delayed-render monitor** — revisits pages, emails, and exports hours after injection to catch payloads that render outside the scanner's time window.
32507. **Cross-context taint follower** — follows a single stored input as it moves between HTML, JavaScript, SQL, and shell contexts across the app.
32508. **Admin-panel render watcher** — monitors admin dashboards and moderation queues where stored user input renders with higher privilege.
32509. **Moderation-queue payload catcher** — injects canaries into user content and watches moderation interfaces for unsafe rendering.
32510. **Notification-render tracker** — follows stored input into push notifications, emails, and SMS to find injection in notification templates.
32511. **Email-template taint tester** — traces user input into transactional emails to detect template injection in mail rendering.
32512. **PDF-generation taint follower** — follows stored input into generated PDFs to find injection in PDF rendering pipelines.
32513. **CSV-export taint tracker** — tracks stored input into CSV exports to detect formula injection at download time.
32514. **Excel-export macro watcher** — monitors generated spreadsheets for macro or DDE content derived from stored input.
32515. **Report-builder injection mapper** — traces user input into custom report builders to find injection in report queries.
32516. **Dashboard-widget taint tester** — follows stored input into dashboard widgets and embedded analytics.
32517. **Search-index taint verifier** — checks whether stored payloads execute when surfaced through search results and autocomplete.
32518. **Autocomplete-render watcher** — monitors autocomplete suggestions for unsafe rendering of stored input.
32519. **Recently-viewed taint tracker** — follows input into recently-viewed and history features that re-render stored values.
32520. **Activity-feed injection mapper** — traces user actions into activity feeds to find stored XSS in feed rendering.
32521. **Comment-thread taint follower** — follows comment content through threading, quoting, and notification renders.
32522. **Mention-render tester** — traces @mentions from storage through profile cards, emails, and notifications.
32523. **Profile-field taint tracker** — follows profile fields into every surface that renders them: cards, exports, APIs, and embeds.
32524. **Avatar-metadata injector watcher** — tracks EXIF and metadata from uploaded avatars into gallery and profile renders.
32525. **Filename taint follower** — follows uploaded filenames into download headers, listings, and admin panels.
32526. **File-content render tracker** — monitors text and SVG uploads for content that renders unsafely when previewed.
32527. **Document-preview taint tester** — traces uploaded documents into preview renderers for server-side injection.
32528. **Image-caption injection mapper** — follows captions and alt text into gallery and API renders.
32529. **Video-metadata taint tracker** — tracks video titles, descriptions, and subtitles into player and listing renders.
32530. **Subtitle-file injection tester** — follows subtitle content into video players for client-side injection.
32531. **Playlist-title taint follower** — traces playlist and collection names into shared and embedded views.
32532. **Tag-render watcher** — monitors user-created tags for unsafe rendering in tag clouds and filters.
32533. **Category-name taint tracker** — follows category and label names into navigation and breadcrumbs.
32534. **Custom-field injection mapper** — traces custom fields through forms, APIs, and exports for second-order injection.
32535. **Form-builder taint tester** — follows form-builder field definitions into rendered forms for injection in generated markup.
32536. **Survey-response render watcher** — tracks survey answers into results dashboards and exports.
32537. **Poll-option taint follower** — follows poll options into results rendering and embeds.
32538. **Quiz-question injection mapper** — traces quiz content into player and results views.
32539. **Course-content taint tracker** — follows course materials into learner views and certificates.
32540. **Certificate-field injector watcher** — monitors certificate name fields for injection in generated certificates.
32541. **Badge-name taint follower** — traces badge and achievement names into profile renders.
32542. **Leaderboard-name injection mapper** — follows display names into leaderboards and public rankings.
32543. **Username taint tracker** — follows usernames into every render surface: mentions, emails, exports, and logs.
32544. **Display-name render watcher** — monitors display names in comments, chats, and notifications for unsafe rendering.
32545. **Bio-field injection mapper** — traces bio text into profile cards, search results, and API responses.
32546. **Status-message taint follower** — follows status messages into feeds and presence indicators.
32547. **Chat-message render tracker** — monitors chat messages for stored payloads that execute on later view.
32548. **Message-edit taint tester** — edits messages to inject payloads and watches edit-history renders.
32549. **Thread-title injection mapper** — traces thread and channel names into navigation and notifications.
32550. **Direct-message taint follower** — follows DM content into previews, notifications, and search.
32551. **Group-name render watcher** — monitors group and team names across member lists and invites.
32552. **Invite-message injection tester** — traces custom invite messages into emails and landing pages.
32553. **Calendar-event taint tracker** — follows event titles and descriptions into calendars, emails, and reminders.
32554. **Task-title injection mapper** — traces task names into boards, notifications, and reports.
32555. **Project-name render watcher** — monitors project names in dashboards, URLs, and exports.
32556. **Ticket-subject taint follower** — follows support ticket subjects into agent queues and customer emails.
32557. **Ticket-body injection mapper** — traces ticket bodies into knowledge-base suggestions and macros.
32558. **Canned-response taint tester** — follows canned responses into outgoing emails for template injection.
32559. **Macro-content render watcher** — monitors support macros for stored payloads that execute in agent views.
32560. **Knowledge-base taint tracker** — traces article content into help centers and chatbots.
32561. **FAQ-entry injection mapper** — follows FAQ content into search and widget renders.
32562. **Chatbot-training data poison watcher** — monitors chatbot responses for payloads injected via training content.
32563. **Auto-reply taint follower** — traces auto-reply templates into sent messages.
32564. **Signature-block injection tester** — follows email signatures into outgoing mail for HTML injection.
32565. **Footer-content render watcher** — monitors site footer content managed through CMS for stored injection.
32566. **Banner-message taint tracker** — follows announcement banners into every page render.
32567. **Popup-content injection mapper** — traces popup and modal content into page renders.
32568. **Tooltip-text taint follower** — follows tooltip content into hover renders.
32569. **Placeholder-text render watcher** — monitors form placeholders sourced from stored config for injection.
32570. **Help-text injection mapper** — traces contextual help text into form renders.
32571. **Error-message template tracker** — follows custom error messages into error pages for template injection.
32572. **Validation-message taint tester** — monitors validation messages sourced from stored rules.
32573. **Onboarding-copy injection mapper** — traces onboarding text into welcome flows and emails.
32574. **Email-subject taint follower** — follows custom email subjects into inboxes and previews.
32575. **Push-title render watcher** — monitors push notification titles for unsafe rendering on devices.
32576. **SMS-template taint tracker** — traces SMS templates into sent messages for injection.
32577. **Voice-script injection mapper** — follows IVR and voice-assistant scripts into audio rendering pipelines.
32578. **Chat-script taint follower** — traces scripted chat flows into live chat widgets.
32579. **Webhook-payload render watcher** — monitors webhook payloads that get rendered in integration dashboards.
32580. **Integration-log taint tracker** — follows integration logs into admin views for log-injection rendering.
32581. **API-log render tester** — monitors API request logs in dashboards for stored payload execution.
32582. **Audit-log viewer watcher** — checks audit-log viewers for unsafe rendering of logged user input.
32583. **Search-query log taint follower** — follows logged search queries into analytics dashboards.
32584. **Referrer-header render tester** — monitors referrer values rendered in analytics views.
32585. **User-agent log watcher** — checks user-agent strings rendered in session and device lists.
32586. **Device-name taint tracker** — follows device names into device-management views.
32587. **Location-label injection mapper** — traces custom location names into maps and lists.
32588. **Timezone-label render watcher** — monitors timezone display names for injection.
32589. **Language-name taint follower** — follows custom language labels into settings renders.
32590. **Currency-label injection tester** — traces currency display names into pricing views.
32591. **Unit-label render watcher** — monitors custom unit labels in measurement displays.
32592. **Status-label taint tracker** — follows custom status labels into workflow views.
32593. **Priority-label injection mapper** — traces priority names into ticket and task views.
32594. **Role-name render watcher** — monitors custom role names in permission views.
32595. **Permission-label taint follower** — follows permission descriptions into admin panels.
32596. **Plan-name injection tester** — traces plan names into billing and upgrade views.
32597. **Coupon-code render watcher** — monitors coupon codes in cart and checkout renders.
32598. **Gift-message taint tracker** — follows gift messages into order views and emails.
32599. **Order-note injection mapper** — traces order notes into fulfillment dashboards.
32600. **Shipping-instruction taint follower** — follows delivery instructions into driver and warehouse views.
32601. **Return-reason render watcher** — monitors return reasons in refund dashboards.
32602. **Review-text taint tracker** — follows product reviews into listings, emails, and exports.
32603. **Q&A-content injection mapper** — traces questions and answers into product pages.
32604. **Second-order coverage heatmap** — visualizes which stored-input sources have been traced to which render sinks to expose untested taint paths.
32605. **Export-file content analyzer** — downloads every generated export (CSV, PDF, XLSX) and scans the actual file bytes for injected content the API responses never show.
32606. **CSV formula-injection scanner** — opens exported CSVs and flags cells starting with =, +, -, or @ that spreadsheet apps would execute.
32607. **Spreadsheet macro hunter** — inspects exported XLSX files for embedded macros, DDE links, and external references derived from user input.
32608. **PDF JavaScript detector** — parses generated PDFs for embedded JavaScript, actions, and form fields sourced from stored input.
32609. **PDF metadata injector watcher** — checks PDF metadata fields (author, title, keywords) for unsanitized user content.
32610. **HTML-export script scanner** — opens HTML exports and flags inline scripts, event handlers, and javascript: URLs from stored data.
32611. **XML-export entity tester** — parses exported XML for external entities and DTD content derived from user input.
32612. **JSON-export prototype-pollution checker** — inspects JSON exports for __proto__ and constructor keys that could pollute consumers.
32613. **YAML-export deserialization tester** — checks YAML exports for tags that trigger deserialization in common parsers.
32614. **Markdown-export injection scanner** — opens Markdown exports for embedded HTML and script that renderers would execute.
32615. **Text-export control-character hunter** — scans plain-text exports for terminal escape sequences and control characters from user input.
32616. **Log-export injection detector** — downloads log exports and flags forged log lines injected via user-controlled fields.
32617. **Audit-export tamper checker** — verifies exported audit trails for injected entries that mimic legitimate events.
32618. **Report-template injection mapper** — traces user input into report templates to find server-side template injection in generation.
32619. **Chart-label injection tester** — checks exported charts for labels and tooltips containing executable content.
32620. **Dashboard-export snapshot scanner** — captures dashboard PDF/PNG exports and inspects embedded data for injection.
32621. **Invoice-line injection detector** — opens generated invoices and flags line-item descriptions containing formula or script payloads.
32622. **Receipt-content scanner** — inspects receipts for user-controlled fields rendered without sanitization.
32623. **Statement-export taint checker** — downloads account statements and scans transaction memos for injected content.
32624. **Tax-form field watcher** — checks generated tax documents for user input rendered into official forms.
32625. **Payroll-export scanner** — inspects payroll exports for employee-controlled fields that could inject into payroll systems.
32626. **HR-export PII checker** — scans HR data exports for over-exposed fields beyond the requester's authorization.
32627. **Roster-export injection tester** — checks shift and roster exports for staff-controlled names containing payloads.
32628. **Grade-export scanner** — inspects grade exports for student-controlled fields rendered unsafely.
32629. **Transcript-export taint checker** — downloads transcripts and scans course and note fields for injection.
32630. **Certificate-export content verifier** — checks generated certificates for name fields containing markup or script.
32631. **Badge-export image tester** — inspects badge exports for embedded metadata from user uploads.
32632. **Attendance-export scanner** — checks attendance exports for injected notes and names.
32633. **Medical-record export watcher** — scans medical exports for patient-controlled notes rendered into clinical documents.
32634. **Prescription-export checker** — inspects prescription documents for dosage fields containing unexpected content.
32635. **Lab-result export scanner** — checks lab exports for technician notes with embedded markup.
32636. **Discharge-summary taint tester** — scans discharge documents for patient-input fields rendered unsafely.
32637. **Insurance-claim export checker** — inspects claim exports for claimant-controlled descriptions.
32638. **Legal-document export scanner** — checks generated contracts for party-supplied fields containing injection.
32639. **Court-filing export watcher** — scans filing exports for litigant-controlled text rendered into official documents.
32640. **Evidence-export integrity checker** — verifies evidence exports for injected content that could taint chain of custody.
32641. **Shipping-label injection detector** — opens shipping labels and flags address fields containing barcode or script payloads.
32642. **Packing-slip scanner** — inspects packing slips for order-note injection.
32643. **Customs-form taint checker** — checks customs declarations for product descriptions with embedded content.
32644. **Inventory-export scanner** — inspects inventory exports for SKU and description fields containing formulas.
32645. **Purchase-order export watcher** — scans POs for vendor-controlled fields rendered into procurement documents.
32646. **Quote-export injection tester** — checks generated quotes for customer-controlled line items.
32647. **Contract-export content scanner** — inspects contract PDFs for counterparty fields with markup.
32648. **NDA-export field checker** — verifies NDA documents for party-name injection.
32649. **E-signature envelope scanner** — checks signature envelopes for document fields containing script.
32650. **Notarization-export watcher** — scans notarized exports for injected attestations.
32651. **Backup-file content scanner** — downloads user-data backups and scans for payloads that execute on restore or import.
32652. **Import-file roundtrip tester** — exports then re-imports files to detect payloads that activate during the import parse.
32653. **Migration-export taint checker** — inspects data-migration exports for fields that inject into the target system.
32654. **Sync-payload scanner** — monitors sync payloads for stored content that executes on the receiving device.
32655. **Offline-package inspector** — opens offline data packages for payloads targeting the offline reader.
32656. **Email-archive export scanner** — checks mailbox exports for message bodies containing active content.
32657. **Chat-export content tester** — inspects chat history exports for messages that execute when opened.
32658. **Ticket-export scanner** — downloads ticket exports and flags descriptions with embedded scripts.
32659. **CRM-export taint checker** — scans CRM exports for contact-controlled fields rendered unsafely.
32660. **Marketing-list export watcher** — checks subscriber exports for name fields containing formulas.
32661. **Campaign-report scanner** — inspects campaign reports for ad-copy fields with injected content.
32662. **Analytics-export injection tester** — checks analytics exports for page-title and event fields containing scripts.
32663. **Funnel-export content checker** — scans funnel reports for step names with embedded markup.
32664. **Cohort-export scanner** — inspects cohort exports for segment names containing payloads.
32665. **Survey-results export watcher** — checks survey exports for open-text answers rendered without sanitization.
32666. **Poll-results scanner** — inspects poll exports for option text containing formulas.
32667. **Form-submission export tester** — downloads form submissions and scans every field for active content.
32668. **Application-export checker** — scans application exports (jobs, loans) for applicant-controlled fields.
32669. **KYC-document export watcher** — checks KYC exports for document metadata containing injection.
32670. **Verification-report scanner** — inspects verification reports for subject-controlled fields.
32671. **Background-check export tester** — scans background-check exports for candidate fields rendered unsafely.
32672. **Reference-letter export checker** — checks reference exports for referee-controlled text.
32673. **Portfolio-export scanner** — inspects portfolio exports for creator-controlled descriptions.
32674. **Media-library export watcher** — checks media exports for title and caption injection.
32675. **Playlist-export content tester** — scans playlist exports for track metadata containing payloads.
32676. **E-book export scanner** — inspects generated e-books for chapter content with embedded scripts.
32677. **Course-export taint checker** — downloads course packages and scans lesson content for active payloads.
32678. **SCORM-package inspector** — opens SCORM exports for manifest and content injection.
32679. **LMS-export scanner** — checks LMS data exports for learner-controlled fields.
32680. **Library-catalog export watcher** — scans catalog exports for patron-controlled notes.
32681. **Museum-collection export tester** — checks collection exports for donor-controlled descriptions.
32682. **Real-estate listing export scanner** — inspects listing exports for agent-controlled descriptions with markup.
32683. **Vehicle-history export checker** — scans vehicle reports for owner-controlled notes.
32684. **Insurance-policy export watcher** — checks policy documents for holder-controlled fields.
32685. **Claim-attachment scanner** — inspects claim attachments for filenames and content containing payloads.
32686. **Warranty-export content tester** — scans warranty documents for claimant-controlled fields.
32687. **Service-record export checker** — checks service histories for technician notes with injection.
32688. **Inspection-report scanner** — inspects inspection PDFs for inspector-controlled findings rendered unsafely.
32689. **Compliance-report export watcher** — scans compliance exports for auditor notes containing active content.
32690. **Audit-finding export tester** — checks audit exports for finding descriptions with embedded markup.
32691. **Risk-register scanner** — inspects risk registers for risk descriptions containing scripts.
32692. **Incident-report export checker** — scans incident exports for reporter-controlled narratives.
32693. **Postmortem-export watcher** — checks postmortem documents for contributor text rendered unsafely.
32694. **Runbook-export scanner** — inspects runbook exports for step content with injection.
32695. **Playbook-export content tester** — checks playbook exports for analyst-controlled fields.
32696. **Threat-intel export scanner** — scans threat-intel exports for indicator descriptions containing payloads.
32697. **IOC-list export watcher** — checks IOC exports for attacker-controlled strings rendered in consoles.
32698. **Vulnerability-report export tester** — scans vuln exports for finding details with embedded scripts.
32699. **Pen-test report scanner** — inspects pen-test PDFs for tester-controlled evidence rendered unsafely.
32700. **Executive-summary export checker** — verifies executive exports for any user-derived content that renders actively.
32701. **Scheduled-export integrity monitor** — watches recurring exports over time for payloads injected between runs.
32702. **Export-permission verifier** — verifies export endpoints enforce the same authorization as the data views they summarize.
32703. **Export-parameter tamper tester** — mutates export filters, date ranges, and formats to detect unauthorized data in exports.
32704. **Export-format confusion detector** — requests exports in unexpected formats to find parsers that mishandle content-type mismatches.
32705. **API version-diff engine** — compares v1 versus v2 responses field-by-field to find security controls present in one version but missing in the other.
32706. **Version-parity matrix builder** — builds the endpoint-by-version matrix and highlights endpoints where newer versions weakened validation.
32707. **Auth-scheme version differ** — diffs authentication requirements across versions to find versions that accept weaker or no auth.
32708. **Scope-requirement version comparator** — compares OAuth scope enforcement per version to detect scopes dropped in newer releases.
32709. **Rate-limit version differ** — measures rate limits per version to find versions with missing or looser throttling.
32710. **Validation-strictness comparator** — sends identical malformed payloads to each version to find versions with weaker input validation.
32711. **Error-verbosity version differ** — compares error detail across versions to find versions leaking stack traces or internals.
32712. **Field-exposure version comparator** — diffs response schemas per version to find versions exposing extra sensitive fields.
32713. **Pagination-behavior differ** — compares pagination across versions to detect versions allowing unbounded page sizes.
32714. **Filtering-capability comparator** — tests filter parameters per version to find versions with unfiltered mass-data access.
32715. **Sorting-parameter differ** — compares sort behavior per version to detect versions vulnerable to sort-based injection.
32716. **Search-scope version comparator** — tests search endpoints per version to find versions searching across tenant boundaries.
32717. **Bulk-operation version differ** — compares bulk endpoints per version to find versions missing bulk-action authorization.
32718. **Webhook-version comparator** — diffs webhook signature verification across versions to find versions skipping verification.
32719. **Callback-URL version differ** — compares callback validation per version to find versions accepting arbitrary callback URLs.
32720. **Redirect-handling version comparator** — tests redirect validation per version to detect versions with open redirects fixed elsewhere.
32721. **CORS-policy version differ** — compares CORS headers per version to find versions with permissive cross-origin policies.
32722. **Content-type version comparator** — tests content-type handling per version to find versions vulnerable to type confusion.
32723. **Method-support version differ** — enumerates allowed HTTP methods per version to find versions accepting dangerous verbs.
32724. **Header-requirement comparator** — tests security headers per version to find versions missing required headers.
32725. **CSRF-protection version differ** — compares CSRF defenses per version to detect versions that dropped token validation.
32726. **Session-handling version comparator** — tests session binding per version to find versions with weaker session security.
32727. **Token-format version differ** — compares token validation per version to detect versions accepting legacy weak tokens.
32728. **Password-policy version comparator** — tests password rules per version to find versions with weaker complexity requirements.
32729. **MFA-enforcement version differ** — compares MFA requirements per version to detect versions that skip step-up auth.
32730. **Account-lockout version comparator** — tests lockout behavior per version to find versions without brute-force protection.
32731. **Password-reset version differ** — compares reset flows per version to detect versions with weaker token entropy.
32732. **Email-verification version comparator** — tests verification enforcement per version to find versions skipping verification.
32733. **Invitation-flow version differ** — compares invite validation per version to detect versions accepting forged invites.
32734. **Signup-validation version comparator** — tests registration controls per version to find versions missing CAPTCHA or verification.
32735. **Profile-update version differ** — compares profile mutation guards per version to detect versions allowing privileged field changes.
32736. **Permission-check version comparator** — tests authorization per version to find versions missing object-level checks.
32737. **Role-enforcement version differ** — compares role requirements per version to detect versions with flattened roles.
32738. **Tenant-isolation version comparator** — tests tenant scoping per version to find versions leaking cross-tenant data.
32739. **Data-retention version differ** — compares deletion behavior per version to detect versions that soft-delete instead of purging.
32740. **Audit-logging version comparator** — tests audit coverage per version to find versions that stopped logging sensitive actions.
32741. **Encryption-requirement version differ** — compares transport and field encryption per version to detect versions allowing plaintext.
32742. **PII-masking version comparator** — tests PII redaction per version to find versions returning unmasked data.
32743. **Consent-check version differ** — compares consent enforcement per version to detect versions processing without consent.
32744. **Export-control version comparator** — tests export authorization per version to find versions with weaker export guards.
32745. **Import-validation version differ** — compares import parsing per version to detect versions accepting malicious files.
32746. **File-upload version comparator** — tests upload restrictions per version to find versions missing type or size checks.
32747. **Image-processing version differ** — compares image handling per version to detect versions vulnerable to image-based attacks.
32748. **Document-parsing version comparator** — tests document parsers per version to find versions with unsafe parsing.
32749. **Archive-handling version differ** — compares archive extraction per version to detect versions vulnerable to zip-slip.
32750. **URL-fetch version comparator** — tests URL fetching per version to find versions missing SSRF protections.
32751. **DNS-handling version differ** — compares DNS validation per version to detect versions vulnerable to rebinding.
32752. **Redirect-chain version comparator** — tests redirect following per version to find versions following unsafe chains.
32753. **Proxy-behavior version differ** — compares proxy handling per version to detect versions with header-spoofing gaps.
32754. **Cache-key version comparator** — tests cache keys per version to find versions with poisoning-prone keys.
32755. **Cache-control version differ** — compares cache directives per version to detect versions caching private data.
32756. **Compression-handling version comparator** — tests compression per version to find versions vulnerable to decompression bombs.
32757. **Encoding-support version differ** — compares encoding handling per version to detect versions with bypass-prone decoders.
32758. **Charset-handling version comparator** — tests charset declarations per version to find versions vulnerable to charset attacks.
32759. **Language-negotiation version differ** — compares locale handling per version to detect versions with locale-based bypasses.
32760. **Timezone-handling version comparator** — tests timezone logic per version to find versions with date-boundary flaws.
32761. **Currency-handling version differ** — compares currency logic per version to detect versions with rounding or conversion gaps.
32762. **Number-parsing version comparator** — tests numeric parsing per version to find versions with overflow or precision flaws.
32763. **Date-parsing version differ** — compares date parsing per version to detect versions accepting ambiguous dates.
32764. **Boolean-coercion version comparator** — tests boolean handling per version to find versions with truthiness bypasses.
32765. **Null-handling version differ** — compares null handling per version to detect versions with null-byte or null-field bypasses.
32766. **Array-handling version comparator** — tests array parameters per version to find versions with parameter-pollution gaps.
32767. **Nested-object version differ** — compares deep-object parsing per version to detect versions with prototype-pollution flaws.
32768. **GraphQL-version comparator** — tests GraphQL schemas per version to find versions exposing new unprotected mutations.
32769. **REST-GraphQL parity checker** — compares protections between REST and GraphQL versions of the same operations.
32770. **gRPC-version differ** — compares gRPC service versions to detect versions missing auth interceptors.
32771. **WebSocket-version comparator** — tests socket protocol versions for authentication and origin-check regressions.
32772. **Webhook-version differ** — compares webhook payload validation across versions for signature-check regressions.
32773. **SDK-version behavior mapper** — tests official SDK versions against the API to find SDKs that bypass server controls.
32774. **Mobile-API version comparator** — compares mobile and web API versions for controls present in one but not the other.
32775. **Partner-API version differ** — tests partner-facing versions for weaker controls than public versions.
32776. **Internal-API version comparator** — compares internal versions exposed accidentally for missing authorization.
32777. **Beta-version exposure hunter** — finds beta API versions reachable in production with weaker controls.
32778. **Canary-version behavior differ** — diffs canary versions against stable to detect security regressions in flight.
32779. **Legacy-version sunset verifier** — verifies sunset versions actually stop serving instead of lingering with old flaws.
32780. **Version-discovery enumerator** — enumerates API versions via paths, headers, and content negotiation to map the full version surface.
32781. **Unannounced-version hunter** — finds versions never documented in changelogs or developer portals.
32782. **Version-routing confusion tester** — tests version routers for mismatches that serve the wrong version's logic.
32783. **Accept-header version negotiator** — negotiates versions via headers to find hidden version-specific behaviors.
32784. **Version-parameter tamper tester** — mutates version parameters to detect logic that trusts client-declared versions.
32785. **Downgrade-attack simulator** — forces clients onto older versions to test whether downgrade protections exist.
32786. **Mixed-version session tester** — mixes versions within one session to detect state handled inconsistently across versions.
32787. **Cross-version token tester** — uses tokens issued by one version against another to find token-validation gaps.
32788. **Cross-version IDOR tester** — tests object references across versions to find authorization checked in only one.
32789. **Schema-drift monitor** — continuously diffs version schemas to alert when new fields appear without access controls.
32790. **Deprecation-warning verifier** — checks that deprecated versions actually emit warnings and sunset headers.
32791. **Sunset-date enforcer tester** — tests versions past their announced sunset date for continued operation.
32792. **Migration-path security checker** — tests version-migration endpoints for authorization and validation gaps.
32793. **Backward-compat bypass hunter** — tests backward-compatibility shims for old flaws reintroduced through compat layers.
32794. **Version-specific WAF differ** — compares WAF coverage per version to find versions with missing rulesets.
32795. **Version-specific logging comparator** — tests security-event logging per version to find versions with blind spots.
32796. **Version-specific alerting tester** — verifies anomaly alerts fire consistently across all active versions.
32797. **Changelog-to-behavior verifier** — tests security claims in changelogs against actual version behavior.
32798. **Security-advisory version mapper** — maps disclosed CVEs to versions to find patched flaws still present in alternate versions.
32799. **Patch-parity verifier** — verifies security patches applied to one version are also applied to all parallel versions.
32800. **Hotfix-coverage checker** — tests whether emergency hotfixes reached every supported version.
32801. **LTS-version control auditor** — audits long-term-support versions for controls that diverged from mainline.
32802. **Preview-version data-leak hunter** — tests preview and RC versions for production data exposure.
32803. **Version-fingerprint evasion tester** — detects version-hiding measures and tests whether hidden versions still receive security scrutiny.
32804. **Version-coverage heatmap** — visualizes hunt coverage per API version to expose versions the scanner never tested.
32805. **Deprecated-endpoint finder** — discovers retired APIs still serving traffic by mining changelogs, old docs, SDKs, and sitemap history.
32806. **Retired-route liveness tester** — probes every documented-as-removed route to verify it actually returns 404 or 410 instead of executing.
32807. **Sunset-header verifier** — checks deprecated endpoints for Sunset and Deprecation headers and tests whether traffic continues past the sunset date.
32808. **Old-mobile-API hunter** — extracts API endpoints from outdated mobile app binaries still hitting production backends.
32809. **Legacy-SDK endpoint extractor** — parses old SDK versions for endpoints the current docs no longer list.
32810. **Archived-docs endpoint miner** — mines Wayback Machine and archived docs for endpoints that may still be live.
32811. **Git-history route resurrecter** — scans repository history for removed routes and tests each one against production.
32812. **Old-postman-collection tester** — imports legacy Postman collections and replays them to find endpoints that still respond.
32813. **Stale-openapi-spec differ** — diffs old OpenAPI specs against current ones to find removed paths still serving.
32814. **Deprecated-webhook hunter** — finds old webhook URLs still accepted by testing legacy webhook registrations.
32815. **Legacy-callback URL tester** — probes retired OAuth callback and notification URLs for continued processing.
32816. **Old-SSO endpoint prober** — tests retired SSO initiation and assertion endpoints for lingering functionality.
32817. **Retired-SAML endpoint checker** — probes old SAML ACS URLs for assertions still being honored.
32818. **Legacy-token endpoint tester** — tests retired token issuance endpoints for tokens still being minted.
32819. **Old-password-reset flow hunter** — walks retired reset flows to find reset links the old flow still honors.
32820. **Retired-signup endpoint tester** — tests old registration endpoints for accounts still being created.
32821. **Legacy-login form prober** — submits credentials to retired login endpoints to find auth still succeeding.
32822. **Old-session endpoint checker** — tests retired session management endpoints for active session control.
32823. **Deprecated-2FA endpoint hunter** — probes old 2FA verification endpoints for codes still being accepted.
32824. **Retired-API-key endpoint tester** — tests old key-management endpoints for keys still being issued or validated.
32825. **Legacy-permission endpoint prober** — tests retired permission APIs for access changes still taking effect.
32826. **Old-role endpoint checker** — probes retired role-assignment endpoints for roles still being granted.
32827. **Deprecated-tenant endpoint hunter** — tests old tenant-provisioning endpoints for tenants still being created.
32828. **Retired-billing endpoint tester** — probes old billing APIs for charges, refunds, or plan changes still processing.
32829. **Legacy-subscription endpoint prober** — tests retired subscription endpoints for state changes still applying.
32830. **Old-coupon endpoint checker** — tests retired coupon APIs for discounts still being applied.
32831. **Deprecated-payment endpoint hunter** — probes old payment endpoints for transactions still being processed.
32832. **Retired-payout endpoint tester** — tests old payout APIs for money movement still occurring.
32833. **Legacy-wallet endpoint prober** — probes retired wallet endpoints for balance changes still applying.
32834. **Old-transfer endpoint checker** — tests retired transfer APIs for funds still moving.
32835. **Deprecated-escrow endpoint hunter** — probes old escrow endpoints for releases still executing.
32836. **Retired-invoice endpoint tester** — tests old invoice APIs for invoices still being generated.
32837. **Legacy-report endpoint prober** — probes retired reporting endpoints for data still being returned.
32838. **Old-export endpoint checker** — tests retired export endpoints for files still being generated.
32839. **Deprecated-import endpoint hunter** — probes old import endpoints for data still being ingested.
32840. **Retired-search endpoint tester** — tests old search APIs for results still being served with old scoping.
32841. **Legacy-filter endpoint prober** — probes retired filter APIs for unfiltered data access.
32842. **Old-pagination endpoint checker** — tests old pagination for unbounded result access.
32843. **Deprecated-sort endpoint hunter** — probes retired sort parameters for injection still working.
32844. **Retired-upload endpoint tester** — tests old upload endpoints for files still being accepted.
32845. **Legacy-download endpoint prober** — probes retired download endpoints for files still being served.
32846. **Old-preview endpoint checker** — tests old preview endpoints for document rendering still active.
32847. **Deprecated-share endpoint hunter** — probes retired sharing endpoints for shares still being created.
32848. **Retired-permalink endpoint tester** — tests old permalink structures for content still accessible.
32849. **Legacy-embed endpoint prober** — probes retired embed endpoints for content still rendering cross-origin.
32850. **Old-widget endpoint checker** — tests old widget APIs for data still being served to third parties.
32851. **Deprecated-iframe endpoint hunter** — probes retired iframe endpoints for pages still rendering without frame protections.
32852. **Retired-redirect endpoint tester** — tests old redirect endpoints for open redirects still working.
32853. **Legacy-shortlink endpoint prober** — probes retired short-link services for links still resolving.
32854. **Old-QR endpoint checker** — tests old QR generation endpoints for codes still being created.
32855. **Deprecated-notification endpoint hunter** — probes retired notification APIs for messages still being sent.
32856. **Retired-email endpoint tester** — tests old email-sending endpoints for mail still going out.
32857. **Legacy-SMS endpoint prober** — probes retired SMS APIs for messages still being delivered.
32858. **Old-push endpoint checker** — tests old push endpoints for notifications still being pushed.
32859. **Deprecated-template endpoint hunter** — probes retired template APIs for templates still rendering.
32860. **Retired-scheduler endpoint tester** — tests old scheduling endpoints for jobs still being queued.
32861. **Legacy-cron endpoint prober** — probes retired cron triggers for jobs still executing.
32862. **Old-queue endpoint checker** — tests old queue APIs for messages still being processed.
32863. **Deprecated-worker endpoint hunter** — probes retired worker endpoints for tasks still running.
32864. **Retired-batch endpoint tester** — tests old batch APIs for bulk operations still executing.
32865. **Legacy-ETL endpoint prober** — probes retired ETL triggers for pipelines still running.
32866. **Old-sync endpoint checker** — tests old sync endpoints for data still synchronizing.
32867. **Deprecated-migration endpoint hunter** — probes retired migration endpoints for data moves still occurring.
32868. **Retired-backup endpoint tester** — tests old backup APIs for snapshots still being created or exposed.
32869. **Legacy-restore endpoint prober** — probes retired restore endpoints for data restoration still working.
32870. **Old-archive endpoint checker** — tests old archive APIs for data still being archived or retrieved.
32871. **Deprecated-purge endpoint hunter** — probes retired purge endpoints for deletions still executing.
32872. **Retired-wipe endpoint tester** — tests old wipe APIs for data destruction still running.
32873. **Legacy-anonymize endpoint prober** — probes retired anonymization endpoints for processing still occurring.
32874. **Old-consent endpoint checker** — tests old consent APIs for consent records still being written.
32875. **Deprecated-DSAR endpoint hunter** — probes retired data-subject-request endpoints for requests still being honored.
32876. **Retired-audit endpoint tester** — tests old audit APIs for logs still being written or exposed.
32877. **Legacy-log endpoint prober** — probes retired logging endpoints for log injection still possible.
32878. **Old-metrics endpoint checker** — tests old metrics endpoints for telemetry still exposed.
32879. **Deprecated-health endpoint hunter** — probes retired health checks for internal details still disclosed.
32880. **Retired-debug endpoint tester** — tests old debug endpoints for debug output still enabled.
32881. **Legacy-profiler endpoint prober** — probes retired profiler endpoints for performance data still exposed.
32882. **Old-trace endpoint checker** — tests old tracing endpoints for request traces still accessible.
32883. **Deprecated-feature-flag endpoint hunter** — probes retired flag APIs for flags still being evaluated.
32884. **Retired-config endpoint tester** — tests old config endpoints for configuration still being served.
32885. **Legacy-secret endpoint prober** — probes retired secret endpoints for credentials still being returned.
32886. **Old-key endpoint checker** — tests old key APIs for cryptographic keys still being exposed.
32887. **Deprecated-certificate endpoint hunter** — probes retired cert endpoints for certificates still being issued.
32888. **Retired-DNS endpoint tester** — tests old DNS APIs for records still being modified.
32889. **Legacy-domain endpoint prober** — probes retired domain APIs for domain changes still applying.
32890. **Old-subdomain endpoint checker** — tests old subdomain APIs for subdomains still being created.
32891. **Deprecated-SSL endpoint hunter** — probes retired TLS endpoints for weak configurations still served.
32892. **Retired-firewall endpoint tester** — tests old firewall APIs for rules still being modified.
32893. **Legacy-WAF endpoint prober** — probes retired WAF endpoints for protections still toggling.
32894. **Old-rate-limit endpoint checker** — tests old throttle APIs for limits still being changed.
32895. **Deprecated-blocklist endpoint hunter** — probes retired blocklist APIs for entries still enforced.
32896. **Retired-allowlist endpoint tester** — tests old allowlist APIs for entries still granting access.
32897. **Deprecation-coverage heatmap** — visualizes which deprecated endpoints were tested live and which remain unverified.
32898. **Zombie-endpoint monitor** — continuously re-tests known-deprecated endpoints to alert if any resurrect after deploys.
32899. **Deprecation-policy compliance checker** — verifies deprecated endpoints follow the announced sunset policy instead of lingering indefinitely.
32900. **Legacy-auth weakness scorer** — scores deprecated endpoints by the age of their auth mechanisms to prioritize the weakest.
32901. **Deprecated-endpoint blast-radius estimator** — estimates data and privilege reachable through each lingering deprecated endpoint.
32902. **Sunset-exception tracker** — catalogs endpoints granted sunset extensions and verifies the extensions actually expire.
32903. **Deprecation-communication verifier** — checks that deprecated endpoints were actually announced to consumers before hunting them.
32904. **Retired-endpoint honeytoken planter** — plants canary credentials in deprecated flows to detect if anyone still uses them.
32905. **Shadow-API detector** — finds undocumented endpoints by combining JS bundle analysis, mobile traffic capture, and sitemap gaps into one discovery pipeline.
32906. **JS-bundle endpoint extractor** — parses frontend bundles for API paths, then tests each one for authentication and authorization.
32907. **Source-map route miner** — downloads source maps and extracts API routes and internal paths the minified bundle hides.
32908. **Mobile-app traffic interceptor** — routes mobile app traffic through a proxy to capture undocumented endpoints the web app never calls.
32909. **APK endpoint decompiler** — decompiles Android APKs to extract hardcoded API URLs and keys.
32910. **IPA endpoint extractor** — analyzes iOS app binaries for embedded API endpoints and secrets.
32911. **Sitemap-gap analyzer** — diffs sitemaps against crawled pages to find URLs excluded from the sitemap but still live.
32912. **Robots.txt disallow prober** — tests every disallowed path in robots.txt for live endpoints the crawler was told to skip.
32913. **Security.txt path tester** — probes paths referenced in security.txt for endpoints outside normal discovery.
32914. **Favicon-hash pivot hunter** — pivots on favicon hashes to find related infrastructure with undocumented APIs.
32915. **Certificate-transparency subdomain enumerator** — mines CT logs for subdomains hosting undocumented API surfaces.
32916. **DNS-bruteforce API hunter** — brute-forces subdomains with API-oriented wordlists to find hidden API hosts.
32917. **VHost discovery prober** — tests virtual hosts on shared IPs to find APIs bound to unlisted hostnames.
32918. **Port-scan service mapper** — scans non-standard ports for HTTP services exposing undocumented APIs.
32919. **Path-bruteforce engine** — fuzzes paths with API-specific wordlists tuned by the target's tech stack.
32920. **Parameter-name bruteforcer** — fuzzes parameter names on known endpoints to find hidden parameters.
32921. **HTTP-method enumerator** — tests unusual methods per endpoint to find method-gated hidden functionality.
32922. **Header-based route discoverer** — varies Host, X-Forwarded, and custom headers to find header-routed hidden endpoints.
32923. **Content-negotiation prober** — requests alternate content types to find format-specific hidden endpoints.
32924. **GraphQL-field enumerator** — brute-forces GraphQL fields and mutations beyond what introspection reveals.
32925. **gRPC-method enumerator** — probes gRPC reflection and method names to find undocumented service methods.
32926. **WebSocket-message fuzzer** — fuzzes WebSocket message types to discover undocumented message handlers.
32927. **SSE-event type enumerator** — subscribes to event streams and catalogs undocumented event types.
32928. **Webhook-receiver discoverer** — finds inbound webhook endpoints by analyzing outbound integration configs.
32929. **Callback-URL enumerator** — discovers callback and notification endpoints from SDK and docs references.
32930. **OAuth-endpoint discoverer** — finds undocumented OAuth token, revoke, and userinfo endpoints via metadata probing.
32931. **SAML-endpoint enumerator** — discovers SAML endpoints beyond the published metadata.
32932. **SCIM-endpoint hunter** — probes for undocumented SCIM provisioning endpoints.
32933. **SSO-bypass endpoint finder** — finds authentication endpoints that bypass the main SSO flow.
32934. **Legacy-auth endpoint discoverer** — finds old basic-auth and token endpoints still active beside modern auth.
32935. **Debug-endpoint hunter** — probes common debug paths to find development endpoints left in production.
32936. **Actuator-endpoint enumerator** — tests Spring Boot actuator paths for exposed management endpoints.
32937. **Swagger-UI hunter** — finds exposed Swagger, Redoc, and API doc UIs revealing undocumented endpoints.
32938. **OpenAPI-spec discoverer** — hunts for exposed OpenAPI JSON/YAML specs listing hidden endpoints.
32939. **GraphiQL-interface finder** — probes for exposed GraphiQL and playground interfaces.
32940. **gRPC-reflection prober** — tests for enabled gRPC reflection exposing service definitions.
32941. **WSDL-file hunter** — finds exposed WSDL files revealing SOAP operations.
32942. **Health-endpoint enumerator** — discovers health, readiness, and status endpoints beyond the documented one.
32943. **Metrics-endpoint hunter** — finds exposed Prometheus and metrics endpoints with operational data.
32944. **Pprof-endpoint prober** — tests for exposed Go pprof endpoints.
32945. **Admin-panel path hunter** — brute-forces admin paths with CMS and framework-specific wordlists.
32946. **Staging-subdomain discoverer** — finds staging, dev, and QA subdomains with weaker protections.
32947. **Internal-hostname prober** — tests internal hostnames that resolve externally for hidden services.
32948. **Cloud-metadata endpoint tester** — probes for cloud metadata endpoints reachable from the app context.
32949. **Container-metadata hunter** — tests for exposed container orchestration APIs.
32950. **Kubelet-API prober** — hunts for exposed kubelet and Kubernetes API endpoints.
32951. **Docker-socket tester** — probes for exposed Docker sockets over HTTP.
32952. **CI-webhook discoverer** — finds CI webhook receivers that trigger builds without authentication.
32953. **Deploy-hook hunter** — discovers deployment hooks that accept unauthenticated deploy triggers.
32954. **Feature-flag API finder** — finds flag-evaluation endpoints that reveal unreleased features.
32955. **Experimentation-endpoint discoverer** — hunts for A/B testing endpoints exposing experiment configs.
32956. **Analytics-ingest prober** — finds analytics ingestion endpoints accepting unauthenticated events.
32957. **Telemetry-endpoint hunter** — discovers telemetry endpoints that accept arbitrary data.
32958. **Crash-report endpoint finder** — finds crash-report receivers that accept unauthenticated uploads.
32959. **Log-ingest endpoint discoverer** — hunts for log ingestion endpoints without authentication.
32960. **Backup-endpoint hunter** — finds backup download endpoints not linked from any UI.
32961. **Export-endpoint enumerator** — discovers data-export endpoints beyond the documented ones.
32962. **Import-endpoint finder** — hunts for bulk-import endpoints missing from docs.
32963. **Search-endpoint discoverer** — finds alternate search APIs with different scoping rules.
32964. **Autocomplete-endpoint hunter** — discovers suggestion endpoints that leak data beyond the main search.
32965. **Preview-endpoint finder** — hunts for document-preview endpoints with weaker auth.
32966. **Thumbnail-endpoint discoverer** — finds media-thumbnail endpoints serving originals without checks.
32967. **Transcode-endpoint hunter** — discovers media-transcoding endpoints accepting arbitrary URLs.
32968. **Proxy-endpoint finder** — hunts for open proxy or fetch endpoints hidden in the app.
32969. **URL-expander discoverer** — finds link-expansion endpoints vulnerable to SSRF.
32970. **OEmbed-endpoint hunter** — discovers oEmbed endpoints fetching arbitrary URLs.
32971. **Embed-endpoint enumerator** — finds embed endpoints rendering external content without sandboxing.
32972. **Widget-data endpoint finder** — hunts for widget data endpoints serving cross-origin data.
32973. **Chatbot-endpoint discoverer** — finds chatbot APIs with prompt-injection or data-leak potential.
32974. **Voice-assistant endpoint hunter** — discovers voice-processing endpoints accepting audio uploads.
32975. **Translation-endpoint finder** — hunts for translation APIs usable as SSRF or cost-abuse vectors.
32976. **OCR-endpoint discoverer** — finds OCR endpoints processing attacker-supplied images.
32977. **Barcode-endpoint hunter** — discovers barcode generation endpoints with injection potential.
32978. **QR-endpoint finder** — hunts for QR APIs encoding attacker-controlled URLs.
32979. **Captcha-bypass endpoint discoverer** — finds captcha-verification endpoints with validation flaws.
32980. **Rate-limit-status endpoint hunter** — discovers endpoints revealing rate-limit internals.
32981. **WAF-status endpoint finder** — hunts for WAF diagnostic endpoints exposing rule details.
32982. **Bot-score endpoint discoverer** — finds endpoints revealing bot-detection scoring.
32983. **Risk-score endpoint hunter** — discovers risk-evaluation endpoints leaking fraud-model details.
32984. **Fraud-check endpoint finder** — hunts for fraud-screening endpoints with bypassable checks.
32985. **Sanctions-check endpoint discoverer** — finds screening endpoints that can be probed for bypasses.
32986. **KYC-status endpoint hunter** — discovers verification-status endpoints leaking PII.
32987. **Document-verify endpoint finder** — hunts for document-verification endpoints accepting forged uploads.
32988. **Liveness-check endpoint discoverer** — finds biometric liveness endpoints with spoofable validation.
32989. **Device-attestation endpoint hunter** — discovers attestation endpoints with weak verification.
32990. **App-integrity endpoint finder** — hunts for integrity-check endpoints that can be spoofed.
32991. **License-check endpoint discoverer** — finds license-validation endpoints with bypassable checks.
32992. **Entitlement-endpoint hunter** — discovers entitlement APIs granting features without proper checks.
32993. **Trial-status endpoint finder** — hunts for trial-state endpoints that can be manipulated.
32994. **Subscription-status endpoint discoverer** — finds subscription endpoints leaking billing details.
32995. **Invoice-endpoint hunter** — discovers invoice APIs serving other users' invoices.
32996. **Receipt-endpoint finder** — hunts for receipt endpoints with predictable identifiers.
32997. **Refund-status endpoint discoverer** — finds refund-tracking endpoints leaking financial data.
32998. **Payout-endpoint hunter** — discovers payout APIs with missing authorization.
32999. **Ledger-endpoint finder** — hunts for ledger APIs exposing transaction histories.
33000. **Balance-endpoint discoverer** — finds balance endpoints without proper ownership checks.
33001. **Shadow-API inventory builder** — compiles every discovered undocumented endpoint into a living inventory with risk scores.
33002. **Shadow-API change monitor** — re-runs discovery continuously to alert when new undocumented endpoints appear.
33003. **Undocumented-endpoint auth tester** — systematically tests authentication and authorization on every shadow endpoint found.
33004. **Shadow-surface coverage reporter** — reports what fraction of the discovered shadow surface received full security testing.
