# Batch 4 — Part 08: Data management (37005–38004)

37005. **Full-text hunt archive search** — search across every past hunt's findings, URLs, payloads, and researcher notes from a single query bar.
37006. **Payload substring index** — instant lookup of any payload string ever sent, showing which hunts, endpoints, and responses it appeared in.
37007. **Boolean query builder for history** — combine severity, target, date range, and technique filters with AND/OR/NOT logic without writing SQL.
37008. **Regex-capable history search** — allow regular expressions over response bodies and request logs with sane performance limits.
37009. **Fuzzy endpoint matcher** — find endpoints across hunts that differ only in IDs, slugs, or version prefixes using token-based similarity.
37010. **Response-snippet preview pane** — hover any history result to see the surrounding 200 characters of the raw response without opening the hunt.
37011. **Natural-language history queries** — type "show me all reflected XSS on staging targets from last quarter" and get a translated, editable query.
37012. **Search result clustering by technique** — group matching results by vulnerability class instead of flat listing so patterns stand out.
37013. **Time-range heatmap of findings** — visualize finding frequency over time behind any search query to spot testing cadence effects.
37014. **Search within a single hunt** — scope queries to one hunt with jump-to-match navigation through its timeline.
37015. **Cross-hunt URL comparison** — select two endpoints from different hunts and diff their parameters, headers, and response structures.
37016. **Saved search subscriptions** — save a query and get notified when new hunts match it, such as any new SSRF on API targets.
37017. **History search API endpoint** — expose the same full-text search via REST so CI pipelines can query past findings programmatically.
37018. **Semantic similarity search** — find findings whose descriptions or code contexts are semantically close to a selected finding.
37019. **Search by HTTP status signature** — query for hunts where a given endpoint returned a specific status sequence (e.g., 302→200→500).
37020. **Header-value history lookup** — search for every occurrence of a response header value (like a specific Server banner) across all hunts.
37021. **Cookie-name indexer** — list every cookie name ever observed, the targets that set them, and their flags (HttpOnly, Secure, SameSite).
37022. **Technology-stack timeline** — search how a target's detected stack evolved across hunts (e.g., nginx → Cloudflare, PHP → Node).
37023. **Payload effectiveness ranking** — for a given technique, rank payloads by how often they produced evidence across the history.
37024. **Search by researcher note tag** — filter history on free-form tags researchers attached to notes, like "false-positive" or "needs-retest".
37025. **Evidence screenshot gallery search** — visual grid of screenshots tagged by finding, searchable by target and severity.
37026. **Search by request timing anomaly** — find hunts where response times spiked beyond 3× baseline, indicating possible injection or DoS surface.
37027. **Parameter-name cross-hunt index** — see every parameter name ever tested, which targets accept it, and its top reflection contexts.
37028. **Historical redirect-chain explorer** — reconstruct full redirect chains observed on a target across hunts to spot open-redirect drift.
37029. **Search facets sidebar** — live facets (target, severity, technique, year, researcher) that narrow any history search without re-typing.
37030. **Query history and reuse** — keep a personal log of past searches with one-click rerun and fork.
37031. **Search result export to watchlist** — turn any search into a persistent watchlist that flags when similar findings recur.
37032. **Multi-target comparative search** — run one query across a chosen set of targets and compare hit counts side by side.
37033. **Error-message corpus search** — search stack traces and database error strings across hunts to find shared infrastructure weaknesses.
37034. **Search by certificate fingerprint** — find all hunts that touched a server presenting a given TLS certificate hash.
37035. **DNS record history lookup** — search past resolved A/AAAA/CNAME records per target to catch infrastructure changes between hunts.
37036. **Search by authentication scheme** — filter hunts by observed auth (JWT, OAuth2, session cookie, API key) to compare bypass attempts.
37037. **Finding-age timeline view** — for a search result set, plot first-seen versus last-seen dates to distinguish new from recurring issues.
37038. **Search result bulk tagging** — apply a tag to many results at once, e.g., tag all CORS findings on a vendor as "vendor-notified".
37039. **Inline evidence viewer** — open request/response pairs from search results in a side pane with syntax highlighting and diff mode.
37040. **Search by response content-type** — filter history for endpoints that returned unexpected types (e.g., JSON where HTML expected).
37041. **Autocomplete from history corpus** — search box suggests targets, payloads, and parameter names learned from past hunts.
37042. **Search by hunt duration and depth** — find hunts by how long they ran and how many requests they made to calibrate future scopes.
37043. **Payload-family drilldown** — expand a payload family (e.g., polyglot XSS) to see every variant tried and its hit rate per target.
37044. **Search across deleted hunts** — with proper permission, query tombstoned records of deleted hunts for audit purposes.
37045. **Geographic search filter** — restrict history search to targets hosted in a region or belonging to a client office.
37046. **Search by evidence size** — find findings whose evidence bundles exceed a threshold to review storage-heavy captures.
37047. **Collaborative search sessions** — share a live search session link so teammates see the same query, filters, and scroll position.
37048. **Search-driven retest planner** — pick history results and generate a retest checklist scoped to exactly those endpoints and payloads.
37049. **Noise-floor baseline per target** — show the historical false-positive rate for a target next to search results to calibrate trust.
37050. **Search by exploitability proof type** — filter for findings with PoC video, PoC script, or screenshot evidence versus text-only.
37051. **Versioned query language** — version the history query syntax so saved searches keep working after engine upgrades.
37052. **Search result permalinks** — every result row gets a stable link that survives hunts being renamed or moved.
37053. **Search by request method mix** — find endpoints where unusual methods (PUT, PATCH, TRACE) were accepted across hunts.
37054. **Historical WAF behavior lookup** — search how a target's WAF responded to probe families over time to plan evasion.
37055. **Search by session-handling quirk** — find targets with session fixation, concurrent-session, or logout flaws observed historically.
37056. **Rate-limit observation index** — query which endpoints historically rate-limited probes and at what thresholds.
37057. **Search by file-upload behavior** — find past hunts where uploads were accepted, with allowed extensions and storage paths.
37058. **Subdomain discovery history** — search all subdomains ever found per target with first-seen dates and discovery method.
37059. **Search by JavaScript bundle hash** — find hunts where a specific JS bundle SHA appeared, tracking shared codebases.
37060. **API schema drift search** — compare OpenAPI/Swagger snapshots captured across hunts to surface new endpoints.
37061. **Search by email or user enumeration** — find historical user-enumeration signals (timing, message differences) per target.
37062. **Search result confidence overlay** — show the model's confidence for each historical finding inline so old low-confidence items are obvious.
37063. **Historical scope-boundary log** — search the exact scope rules that applied to each past hunt for compliance audits.
37064. **Search by credential exposure** — find any historical evidence containing secrets, tokens, or keys for rotation review.
37065. **Search result deduplication toggle** — collapse near-duplicate results from repeated hunts with one switch.
37066. **Search by client or engagement** — filter history by client name or engagement code with access controls enforced.
37067. **Timeline scrubber for a target** — drag a time slider to see that target's hunt activity and findings at any point.
37068. **Search by network fingerprint** — query hunts by observed TCP/IP or TLS fingerprint to find shared hosting.
37069. **Historical request replay from search** — replay any historical request from the result pane against the current target state.
37070. **Search by business-logic flaw type** — filter historical findings by logic categories like price manipulation or workflow bypass.
37071. **Search result annotation threads** — attach discussion threads to results so context accumulates across retests.
37072. **Search by third-party script** — find targets historically loading a given third-party script for supply-chain review.
37073. **Historical CORS policy lookup** — search Access-Control-Allow-Origin values ever returned per target.
37074. **Search by GraphQL schema** — query captured GraphQL schemas and introspection results across hunts.
37075. **Search by WebSocket behavior** — find hunts with WebSocket endpoints, message formats, and auth quirks.
37076. **Search performance dashboard** — show index size, query latency percentiles, and shard health for the history search backend.
37077. **Search by finding state** — filter historical findings by open, fixed, verified, accepted-risk, or disputed status.
37078. **Historical fix-verification log** — search every fix-verification attempt with before/after evidence pairs.
37079. **Search by hunt trigger** — filter hunts by what started them: manual, scheduled, CI webhook, or retest request.
37080. **Cross-hunt payload diff** — compare how the same payload behaved on two targets with response side-by-side.
37081. **Search by response header anomaly** — find hunts where security headers disappeared between runs, indicating config drift.
37082. **Search by open port history** — query port-scan results per target across hunts to spot newly exposed services.
37083. **Historical screenshot OCR search** — OCR all evidence screenshots so text inside images becomes searchable.
37084. **Search by finding severity delta** — find findings whose severity changed between hunts (e.g., medium re-scored to critical).
37085. **Search-driven trend report** — turn any query into a one-page trend PDF showing counts, severities, and top targets over time.
37086. **Search by data-sensitivity tag** — filter findings by the sensitivity of exposed data (PII, financial, health, credentials).
37087. **Historical token-leak lookup** — search for JWTs, API keys, or session tokens captured in past evidence for rotation audits.
37088. **Search by mobile vs web** — split history between mobile-API and web-app hunts for the same target.
37089. **Search result relevance tuning** — adjust field weights (payload vs notes vs URL) and preview ranking changes live.
37090. **Search by hunt cost** — filter past hunts by compute cost or request count to budget future engagements.
37091. **Historical plugin-version log** — see which scanner plugin versions ran in each hunt to explain result differences.
37092. **Search by evidence redaction state** — find findings whose evidence is fully, partially, or not yet redacted.
37093. **Federated search across workspaces** — with permission, query hunt history across multiple workspaces in one go.
37094. **Search by language or locale** — filter hunts by target language/locale to reuse locale-specific payloads.
37095. **Historical session-token analysis** — search captured session token formats and entropy notes across targets.
37096. **Search by redirect target domain** — find all historical redirects pointing to a given domain for takeover review.
37097. **Search result change alerts** — get notified when a saved search's result set changes after new hunts complete.
37098. **Search by compliance mapping** — filter findings by mapped controls (OWASP, PCI, HIPAA) for audit-ready slices.
37099. **Historical chaos: query playground** — a sandbox mode to test complex queries against a sampled index before running on full history.
37100. **Search by researcher handoff note** — find hunts with handoff notes mentioning specific risks, clients, or follow-ups.
37101. **Evidence-chain reconstruction** — from any finding, walk back through the request chain that led to it across the hunt timeline.
37102. **Search by HTTP/2 vs HTTP/1.1** — filter hunts by negotiated protocol version to study protocol-specific issues.
37103. **Historical cache-behavior lookup** — search Cache-Control and CDN caching observations per endpoint across hunts.
37104. **One-click "show me everything about this URL"** — a single action that aggregates every hunt, finding, payload, and note touching a URL pattern.
37105. **Cross-hunt finding fingerprint** — hash findings on normalized endpoint, parameter, and technique so the same vuln is recognized across hunts.
37106. **Retest-aware deduper** — when a retest re-finds an open issue, link it to the original instead of creating a duplicate record.
37107. **Fix-regression detector** — flag a "fixed" finding that reappears in a later hunt as a regression with a linked fix history.
37108. **Dedup confidence score** — show how confident the deduper is that two findings are the same, with the matching signals listed.
37109. **Manual merge tool for findings** — let researchers merge near-duplicates by hand with a full audit trail of the merge.
37110. **Split-finding tool** — undo an over-aggressive merge by splitting a finding back into its originals without losing history.
37111. **Endpoint-normalized dedup keys** — normalize IDs, UUIDs, and slugs in URLs before fingerprinting so `/users/123` matches `/users/456`.
37112. **Parameter-set fingerprint** — dedupe findings by the set of involved parameters regardless of their order or values.
37113. **Response-signature dedup** — use response body structure hashes to catch the same bug surfacing on different endpoints.
37114. **Dedup across targets** — recognize the same vulnerable component (e.g., shared plugin) producing identical findings on different targets.
37115. **Dedup rule versioning** — version fingerprint rules so changing them re-runs dedup without corrupting historical links.
37116. **Dedup exception list** — allowlist specific finding pairs that must never be merged, with reasons recorded.
37117. **Duplicate-rate dashboard** — track what fraction of new findings are duplicates per target to measure retest churn.
37118. **Dedup dry-run preview** — simulate a fingerprint rule change and preview which findings would merge before applying.
37119. **Cross-engagement dedup** — dedupe findings across separate client engagements when the underlying target is the same asset.
37120. **Severity-drift guard in dedup** — prevent merging when severities differ materially unless a reviewer approves the resolution.
37121. **Dedup on import** — automatically dedupe findings when importing from Burp, Nuclei, or ZAP instead of blindly appending.
37122. **Evidence-weighted dedup** — prefer the finding with richer evidence as the canonical record when merging.
37123. **Dedup lineage view** — show the full merge tree of a finding: which records folded into it and when.
37124. **Time-window dedup policy** — only auto-dedupe within a configurable window (e.g., 90 days) to avoid merging stale issues.
37125. **Dedup suggestion inbox** — queue probable duplicates for researcher review instead of auto-merging uncertain pairs.
37126. **Bulk dedup review** — approve or reject dozens of suggested merges from a single triage screen.
37127. **Dedup API for pipelines** — expose a fingerprint-check endpoint so CI can ask "is this finding already known?" before filing.
37128. **Canonical finding IDs** — assign stable IDs that survive merges, splits, and retests for external tracking.
37129. **Dedup-aware metrics** — report unique-vulnerability counts alongside raw finding counts in every dashboard.
37130. **Cross-version dedup** — link findings across target version changes when the vulnerable code path persists.
37131. **Dedup by PoC equivalence** — treat two findings as duplicates when their PoCs exercise the identical sink and source.
37132. **Finding-cluster explorer** — visualize clusters of related findings as a graph with shared-parameter and shared-endpoint edges.
37133. **Dedup noise log** — record every rejected merge suggestion so the rules can be tuned from real mistakes.
37134. **Dedup policy per workspace** — let each workspace choose strict, balanced, or lenient dedup behavior.
37135. **Merge-conflict resolver UI** — when two findings disagree on severity or status, present a side-by-side resolution screen.
37136. **Dedup on retest scheduling** — when scheduling a retest, pre-mark expected duplicates so researchers focus on new issues.
37137. **Historical dedup backfill** — run new fingerprint rules over the full archive in a background job with progress tracking.
37138. **Dedup quality sampling** — randomly sample auto-merges for human audit and report precision metrics.
37139. **Finding-alias registry** — keep human-readable aliases ("the login XSS") mapped to canonical IDs across merges.
37140. **Dedup-safe export** — exports include both canonical records and their merged children for full traceability.
37141. **Cross-hunt false-positive memory** — if a finding was marked FP in one hunt, auto-suggest FP status when it recurs.
37142. **Dedup-aware SLA tracking** — age SLAs from the original finding's first-seen date, not the duplicate's creation date.
37143. **Sibling-finding linker** — link findings that share a root cause but differ in technique (XSS + open redirect on one page).
37144. **Dedup notification rules** — notify assignees when their finding absorbs a duplicate or gets merged away.
37145. **Retest diff against canonical set** — show retest results as new/fixed/regressed relative to the deduplicated baseline.
37146. **Dedup fingerprint inspector** — show exactly which normalized fields produced a finding's fingerprint for debugging.
37147. **Multi-language endpoint normalization** — normalize localized URL segments (/en/, /fr/) before dedup so regional duplicates merge.
37148. **Dedup across HTTP methods** — recognize the same vuln found via GET and POST variants as one finding.
37149. **Staging-vs-production dedup** — link staging findings to their production twins with an environment tag instead of merging.
37150. **Dedup-aware client reports** — client-facing reports show unique issues with retest occurrence counts, never raw duplicates.
37151. **Finding resurrection log** — when a duplicate reopens a closed finding, log who/what triggered the resurrection.
37152. **Dedup rule marketplace** — share community fingerprint rules for common stacks (WordPress, Laravel, Django).
37153. **AI-assisted merge review** — an LLM summarizes why two findings are likely the same and lists the risky differences.
37154. **Dedup exemption by engagement** — keep duplicates separate when two engagements require independent audit trails.
37155. **Canonical evidence aggregation** — merged findings pool their evidence bundles under the canonical record with provenance labels.
37156. **Dedup threshold simulator** — adjust similarity thresholds and see precision/recall estimates on labeled sample data.
37157. **Finding-identity timeline** — show every state change, merge, split, and retest of a canonical finding on one timeline.
37158. **Dedup-aware search** — history search defaults to canonical records with a toggle to expand duplicates.
37159. **Cross-workspace dedup (opt-in)** — dedupe across workspaces when teams collaborate on the same vendor asset.
37160. **Dedup performance monitor** — track dedup job runtime and index growth so the matcher scales with archive size.
37161. **Dedup on finding edit** — re-run fingerprinting when a researcher edits endpoint or parameter fields in case identity changed.
37162. **Duplicate-burst alert** — alert when a single hunt produces an unusual spike of duplicates, hinting at scope or config issues.
37163. **Finding-family pages** — one page per canonical finding with all occurrences, evidence, fixes, and retests aggregated.
37164. **Dedup-safe deletion** — deleting a duplicate never removes the canonical record or its shared evidence.
37165. **Dedup by vulnerable-library version** — group findings caused by the same library CVE across targets into one family.
37166. **Retest scope from dedup gaps** — suggest retest scope covering canonical findings that haven't been re-observed recently.
37167. **Dedup changelog feed** — a feed of all merges, splits, and identity changes for audit and team awareness.
37168. **Finding-equivalence API** — answer "are these two finding IDs the same issue?" for external ticketing integrations.
37169. **Dedup-aware assignment** — assign the canonical finding once instead of assigning each duplicate to different people.
37170. **Cross-scanner dedup normalization** — unify severity and naming from different importers before fingerprinting.
37171. **Dedup confidence decay** — reduce auto-merge aggressiveness for very old findings where the target likely changed.
37172. **Dedup review SLA** — track how long merge suggestions wait in the review inbox and escalate stale ones.
37173. **Finding DNA barcode** — a compact visual hash of a finding's fingerprint fields for quick visual comparison.
37174. **Dedup on target rename** — preserve dedup links when a target's domain or project name changes.
37175. **Duplicate-pattern analytics** — report which endpoints and techniques produce the most duplicates to tune scan config.
37176. **Dedup-aware leaderboard** — researcher stats count unique findings, not duplicates, to avoid gaming.
37177. **Canonical finding discussion thread** — one discussion per canonical finding so context isn't scattered across duplicates.
37178. **Dedup rule test harness** — unit-test fingerprint rules against labeled finding pairs before deploying.
37179. **Dedup impact preview on reports** — show how many raw findings collapse into how many unique issues before exporting a report.
37180. **Finding-identity verification task** — scheduled job that re-verifies a sample of canonical links against current evidence.
37181. **Dedup across subdomains** — merge identical findings on `www.` and bare domains when they serve the same app.
37182. **Dedup-safe anonymization** — anonymized exports preserve canonical IDs so external parties can track issues consistently.
37183. **Dedup for chained findings** — handle merges where a finding is part of an attack chain without breaking chain links.
37184. **Finding-split audit trail** — record who split a finding, why, and what the resulting identities are.
37185. **Dedup bulk-import reconciliation** — match a bulk import against the canonical set and report new/duplicate/updated counts.
37186. **Dedup-aware notification digest** — batch "your finding absorbed N duplicates" into a single digest instead of N alerts.
37187. **Cross-hunt evidence stitching** — when duplicates merge, stitch their evidence into a chronological attack narrative.
37188. **Dedup policy templates** — presets like "bug-bounty", "pentest-retest", and "continuous-monitoring" with tuned defaults.
37189. **Finding-identity export manifest** — export a manifest of canonical IDs and their merged children for client reconciliation.
37190. **Dedup anomaly review** — flag merges that look wrong (huge severity gaps, different targets) for priority human review.
37191. **Dedup-aware risk scoring** — score the canonical finding once, using the strongest evidence across duplicates.
37192. **Duplicate-source attribution** — track whether duplicates come from retests, imports, or repeated scans to fix the source.
37193. **Finding-merge undo window** — allow one-click undo of any merge within 30 days with full state restoration.
37194. **Dedup on API schema change** — re-fingerprint when an endpoint's schema changes to catch identity drift early.
37195. **Canonical finding watchers** — follow a canonical finding to get updates on any duplicate, retest, or status change.
37196. **Dedup-aware SLA exceptions** — duplicates don't reset SLAs; exceptions require explicit approval with a reason.
37197. **Finding-cluster health score** — score each cluster by evidence strength, fix status, and retest coverage.
37198. **Dedup rule documentation generator** — auto-document active fingerprint rules in plain language for auditors.
37199. **Dedup cross-check with tickets** — verify Jira/GitHub issues map to canonical findings, flagging orphaned tickets.
37200. **Dedup-aware data retention** — retention purges raw duplicates first while always preserving the canonical record.
37201. **Finding-identity QR codes** — printable QR labels for physical pentest reports that resolve to the canonical finding.
37202. **Dedup suggestion explanations** — every suggestion shows the matched fields and similarity scores in plain language.
37203. **Bulk canonical-ID reassignment** — reassign canonical IDs after a major rule change with a reversible migration plan.
37204. **Dedup health dashboard** — one screen showing merge precision, review queue depth, backfill progress, and rule versions.
37205. **Target dossier page** — one page per target aggregating every hunt, finding, tech-stack snapshot, and researcher note ever recorded.
37206. **Target tech-stack timeline** — track detected frameworks, servers, and CDNs per target across hunts with change markers.
37207. **Target risk-score history** — plot the target's aggregate risk score over time to show security posture trends.
37208. **Target ownership and contacts** — store client contacts, escalation paths, and authorized testers per target profile.
37209. **Target scope-rule versioning** — keep every historical scope definition with effective dates for audit clarity.
37210. **Target asset inventory (data-management context)** — auto-maintain the list of domains, subdomains, IPs, and ports discovered per target.
37211. **Target finding heatmap** — grid of endpoints versus vulnerability classes colored by severity for the target.
37212. **Target retest scheduler** — schedule retests per target with scope auto-derived from open canonical findings.
37213. **Target note timeline** — chronological researcher notes on a target, separate from per-hunt logs.
37214. **Target credential vault links** — link the target profile to its test accounts and API keys stored in the secrets vault.
37215. **Target environment splitter** — keep staging, production, and dev profiles under one target with environment tags.
37216. **Target compliance mappings** — map the target to applicable frameworks (PCI, HIPAA, SOC2) to scope compliance checks.
37217. **Target SLA policy** — per-target fix SLAs by severity with escalation rules and breach alerts.
37218. **Target hunt calendar** — calendar view of past and scheduled hunts for the target with owner assignments.
37219. **Target comparison view** — compare two targets' risk scores, finding counts, and tech stacks side by side.
37220. **Target tagging system** — tag targets (e.g., "fintech", "legacy", "acquired") and filter dossiers by tag.
37221. **Target data-sensitivity profile** — record what sensitive data the target handles to weight finding severity.
37222. **Target third-party inventory** — list third-party scripts, vendors, and integrations observed on the target.
37223. **Target certificate history** — track TLS certificates seen on the target with expiry alerts.
37224. **Target DNS history** — keep a versioned record of DNS answers per target for infrastructure-change detection.
37225. **Target WAF profile** — record the WAF vendor, observed rules, and bypass history per target.
37226. **Target authentication matrix** — document every login flow, SSO provider, and MFA setup observed on the target.
37227. **Target API catalog** — maintain the discovered REST/GraphQL endpoint catalog per target with schema snapshots.
37228. **Target business-logic notes** — capture workflows (checkout, refunds, onboarding) that matter for logic-flaw testing.
37229. **Target previous-report archive** — attach every past PDF report to the dossier with version and date.
37230. **Target stakeholder visibility** — per-target sharing settings controlling which stakeholders see which data.
37231. **Target hunt-template defaults** — default scan depth, plugins, and payloads preselected per target from history.
37232. **Target rate-limit profile** — recorded rate limits per endpoint to keep future hunts polite and efficient.
37233. **Target false-positive patterns** — remember FP signatures per target so repeat hunts skip known noise.
37234. **Target change-detection alerts** — notify when tech-stack, DNS, or certificate data changes between hunts.
37235. **Target onboarding checklist** — guided setup: scope, credentials, contacts, and baseline hunt for a new target.
37236. **Target offboarding flow** — archive a target's data per retention policy while keeping an audit stub.
37237. **Target health score** — composite score from open findings, retest coverage, and fix velocity per target.
37238. **Target engagement history** — list every engagement (pentest, bounty, retest) with dates and outcomes.
37239. **Target risk-acceptance log** — record accepted risks with approver, expiry, and compensating controls.
37240. **Target threat-model sketch** — attach a lightweight threat model (assets, trust boundaries) to guide hunts.
37241. **Target crown-jewel registry** — mark critical assets (admin panels, payment flows) for prioritized testing.
37242. **Target hunt-budget tracker** — track compute/request budgets per target across engagements.
37243. **Target researcher assignments** — assign primary and backup researchers per target with handoff notes.
37244. **Target communication log** — log client communications (approvals, scope changes) against the target.
37245. **Target evidence-retention override** — per-target exceptions to workspace retention rules for legal holds.
37246. **Target subdomain watchlist** — monitor the target's subdomains for new hosts between hunts.
37247. **Target JS-bundle tracker** — track frontend bundle hashes per target to detect redeploys worth retesting.
37248. **Target mobile-app linkage** — link the target's mobile apps (package IDs, versions) to the same dossier.
37249. **Target cloud-account mapping** — record cloud accounts, regions, and asset IDs associated with the target.
37250. **Target incident linkage** — link past security incidents to the target profile for context in future hunts.
37251. **Target pentest-readiness score** — readiness checklist (scope signed, creds working, contacts listed) before hunts start.
37252. **Target historical payload effectiveness** — which payload families worked best on this target historically.
37253. **Target language/locale profile** — locales and languages the target serves for locale-aware testing.
37254. **Target session-handling notes** — documented quirks (token lifetimes, concurrent sessions) per target.
37255. **Target file-upload policy** — allowed types, size limits, and storage paths observed per target.
37256. **Target error-page fingerprint** — baseline error pages to distinguish real vulnerabilities from default errors.
37257. **Target backup/disclosure notes** — known backup files, exposed .git, or debug endpoints previously seen.
37258. **Target GraphQL schema archive** — versioned GraphQL schemas captured per target across hunts.
37259. **Target WebSocket endpoint registry** — documented WS endpoints, message formats, and auth per target.
37260. **Target OAuth client registry** — registered OAuth clients, redirect URIs, and scopes observed per target.
37261. **Target email-domain policy** — which email domains the target accepts for signup (for account-based testing).
37262. **Target payment-flow notes** — documented payment providers, test cards, and refund flows per target.
37263. **Target search-functionality notes** — search endpoints and injection-relevant behaviors documented per target.
37264. **Target admin-panel inventory** — discovered admin interfaces with access requirements per target.
37265. **Target debug-flag history** — debug parameters and verbose modes ever observed on the target.
37266. **Target header-security baseline** — expected security headers per target to diff against in future hunts.
37267. **Target CORS policy record** — allowed origins and credentials settings documented per target.
37268. **Target CSP history** — Content-Security-Policy snapshots per target to track policy tightening or loosening.
37269. **Target cookie-policy baseline** — expected cookies and flags per target for session-security review.
37270. **Target redirect-policy notes** — legitimate redirect domains and open-redirect history per target.
37271. **Target user-role matrix** — roles (admin, user, guest) and their capabilities documented per target.
37272. **Target test-account registry** — test accounts per role with status (active, locked, rotated) per target.
37273. **Target notification-preference log** — how the client wants to be told about critical findings (Slack, email, call).
37274. **Target embargo policy** — disclosure embargoes and coordinated-release dates recorded per target.
37275. **Target bounty-scope sync** — import scope from HackerOne/Bugcrowd programs into the target profile automatically.
37276. **Target asset-priority tiers** — tier assets (P0–P3) so hunts allocate depth by business importance.
37277. **Target historical hunt replay** — replay a past hunt's request sequence against current target state for regression checks.
37278. **Target diff report between hunts** — auto-generate "what changed since last hunt" summaries per target.
37279. **Target researcher leaderboard** — per-target stats on who found what, for staffing decisions.
37280. **Target fix-velocity tracking** — measure days-to-fix per severity for the target to report to stakeholders.
37281. **Target recurring-issue report** — list issues that keep reappearing on the target across engagements.
37282. **Target zero-finding hunts log** — record hunts that found nothing with scope notes to avoid "untested" confusion.
37283. **Target scope-gap analysis** — identify asset areas never covered by any hunt for the target.
37284. **Target data-flow diagrams** — attach data-flow sketches showing where sensitive data moves through the target.
37285. **Target dependency inventory** — known libraries and versions per target with CVE watch integration.
37286. **Target container-image notes** — observed container images and registries for the target's infrastructure.
37287. **Target IaC references** — link infrastructure-as-code repos that define the target's deployment.
37288. **Target feature-flag awareness** — known feature flags that change attack surface per target.
37289. **Target A/B-test surface notes** — variant-dependent endpoints that need multi-variant testing per target.
37290. **Target maintenance-window calendar** — blackout windows when hunts must not run against the target.
37291. **Target legal-approval archive** — store signed authorization documents per target with expiry dates.
37292. **Target insurance-requirement mapping** — map cyber-insurance questionnaire items to evidence on the target.
37293. **Target board-report summary** — auto-generate executive summaries per target for board reporting.
37294. **Target peer-benchmarking** — compare the target's metrics against anonymized peers in the same industry.
37295. **Target maturity-model tracking** — track the target's security maturity level over engagements.
37296. **Target training-recommendation log** — log developer-training suggestions arising from repeated flaw patterns.
37297. **Target secure-coding patterns** — record positive patterns (good auth, good validation) to reinforce in reports.
37298. **Target handoff package generator** — one-click package (dossier, open findings, creds, notes) for researcher handoffs.
37299. **Target archival snapshot** — frozen point-in-time snapshot of the full dossier for legal or audit needs.
37300. **Target profile completeness meter** — show which dossier sections are filled versus missing to guide enrichment.
37301. **Target quick-actions bar** — start hunt, schedule retest, export dossier, or message contacts from the profile header.
37302. **Target relationship graph** — visualize related targets (subsidiaries, shared vendors, shared infra) as a graph.
37303. **Target acquisition-merge tool** — merge two target profiles after a corporate acquisition with conflict resolution.
37304. **Target profile activity feed** — chronological feed of every change to the dossier for team awareness.
37305. **Per-workspace retention rules** — configure how long raw responses, request logs, and screenshots are kept per workspace.
37306. **Findings-kept-forever default** — retention purges evidence but never canonical findings, keeping the security record intact.
37307. **Tiered retention: hot/warm/cold** — recent hunts stay queryable, older ones move to compressed cold storage with slower access.
37308. **Auto-purge raw responses after N days** — drop bulky response bodies on schedule while keeping metadata and findings.
37309. **Retention preview before purge** — show exactly what will be deleted and its size before any retention job runs.
37310. **Legal-hold override (retention-policy context)** — freeze retention for specific hunts or targets during litigation with an auditable hold record.
37311. **Retention policy templates** — presets like "30-day evidence", "1-year findings", and "compliance-7-year" for quick setup.
37312. **Per-data-type retention** — set different lifetimes for screenshots, request logs, PoC videos, and chat transcripts.
37313. **Retention exemption by severity** — critical-findings evidence is kept longer than informational noise automatically.
37314. **Client-contract retention mapping** — map each client's contract terms to enforced retention rules with reminders before expiry.
37315. **Retention audit log** — log every purge: what, when, under which policy, and who approved it.
37316. **Soft-delete with grace period** — purged data sits recoverable for 14 days before permanent deletion.
37317. **Retention for deleted workspaces** — define what happens to data when a workspace is deleted, with a final export option.
37318. **Retention dashboard** — show storage by age bracket and projected purge savings per workspace.
37319. **Retention policy inheritance** — child workspaces inherit parent rules unless explicitly overridden.
37320. **Purge-impact estimator** — estimate how retention changes affect storage costs and search completeness.
37321. **Retention for backups** — backups follow their own retention (e.g., keep 12 monthly snapshots) separate from live data.
37322. **Retention for sync conflicts** — resolve how long conflicting sync versions are kept before resolution.
37323. **Compliance-driven retention locks** — PCI/HIPAA/ISO rules auto-set minimum retention floors that users can't lower.
37324. **Retention change approval flow** — shortening retention requires a second approver with a recorded reason.
37325. **Data-subject deletion requests** — honor right-to-erasure requests by deleting personal data while keeping anonymized findings.
37326. **Retention for researcher notes** — notes follow a separate, usually longer, retention than raw traffic.
37327. **Retention for imported scans** — imported Burp/ZAP data inherits the workspace policy or a custom importer policy.
37328. **Retention notifications** — warn owners 7 days before a major purge with an option to extend.
37329. **Retention dry-run reports** — weekly dry-run showing what would be purged under current rules, no action taken.
37330. **Retention by engagement type** — bug-bounty data kept longer than one-off pentest data, configurable per type.
37331. **Retention for evidence redaction states** — unredacted evidence purged sooner than redacted copies.
37332. **Retention clock from hunt end** — age data from hunt completion, not creation, so long hunts aren't penalized.
37333. **Retention pause during active retest** — related data is exempt from purging while a retest is in flight.
37334. **Retention for archived targets** — archived targets drop to metadata-only storage automatically.
37335. **Cross-region retention compliance** — enforce data-residency rules (EU data stays in EU) within retention jobs.
37336. **Retention for AI training exclusions** — data opted out of learning pipelines is purged from training stores first.
37337. **Retention policy version history** — every rule change is versioned with author and effective date.
37338. **Retention simulation sandbox** — test new rules against a data sample before applying workspace-wide.
37339. **Retention for webhook deliveries** — keep delivery logs 90 days, payloads 30, configurable separately.
37340. **Retention for API tokens in logs** — scrubbed token occurrences purged aggressively even if logs are kept.
37341. **Scheduled retention jobs UI** — view, pause, and reschedule the purge jobs like any other background task.
37342. **Retention failure alerts** — alert if a purge job fails or deletes significantly more/less than expected.
37343. **Retention for multi-device sync** — synced devices converge on the same retention state, not divergent copies.
37344. **Retention certificate generator** — produce a signed certificate proving data was purged per policy for auditors.
37345. **Retention for PoC artifacts** — PoC scripts kept with findings; PoC videos follow the shorter evidence policy.
37346. **Per-target retention overrides** — high-sensitivity targets keep evidence longer via explicit override.
37347. **Retention for chat transcripts** — mid-hunt chat kept 1 year by default, separate from traffic logs.
37348. **Retention inheritance on target merge** — merged target profiles adopt the stricter of the two retention rules.
37349. **Retention for search indexes** — index entries for purged data are removed or anonymized consistently.
37350. **Retention-aware exports** — exports note which evidence was already purged so recipients know what's missing.
37351. **Retention for deduplication lineage** — merge/split history kept even after raw duplicates are purged.
37352. **Retention for notifications** — notification history kept 6 months, separate from the underlying data.
37353. **Retention for audit trails** — audit logs kept longest (7 years default) regardless of other policies.
37354. **Retention policy health check** — scheduled check that policies are internally consistent and compliant.
37355. **Retention for temporary shares** — shared links and their access logs expire with the share, not the data.
37356. **Retention for sandbox replays** — replay sandboxes and their captures auto-purge after 7 days.
37357. **Data-minimization mode** — a strict mode that keeps only findings + minimal metadata from the start.
37358. **Retention for biometric/voice data** — avatar voice recordings purged on a short, separate schedule.
37359. **Retention for file attachments** — uploaded files (specs, scope docs) follow document retention, not traffic retention.
37360. **Retention for scheduled hunts** — scheduled-hunt definitions kept even after their data ages out.
37361. **Retention cost attribution** — show storage cost per target so expensive targets can be tuned first.
37362. **Retention for error/debug logs** — verbose debug logs purged after 14 days automatically.
37363. **Retention policy export** — export the full policy set as JSON for compliance documentation.
37364. **Retention for third-party shares** — data shared with vendors gets its own expiry independent of source data.
37365. **Retention-aware search ranking** — search demotes or hides results whose evidence was purged, with clear labeling.
37366. **Retention for learning-engine data** — aggregated learning stats kept; raw per-request training data purged early.
37367. **Retention for session recordings** — control-mode session recordings follow the evidence policy with redaction.
37368. **Retention exception requests** — formal flow to request an exception with approver, expiry, and review date.
37369. **Retention for deleted findings** — tombstones of deleted findings kept 1 year for audit.
37370. **Retention for billing records** — usage/billing data kept per financial-regulation minimums, separate from hunt data.
37371. **Retention for support tickets** — support conversations about data kept 2 years after ticket close.
37372. **Auto-archive instead of purge option** — move aging data to cheap archive rather than deleting, per policy choice.
37373. **Retention for feature-flag experiments** — experiment assignments and outcomes kept for reproducibility windows.
37374. **Retention for mobile sync payloads** — transient sync payloads purged immediately after successful device sync.
37375. **Retention policy diff viewer** — compare policy versions side by side when rules change.
37376. **Retention for certificate transparency logs** — CT observations kept 2 years for infrastructure forensics.
37377. **Retention for DNS history** — DNS snapshots kept longer than traffic since they're small and valuable.
37378. **Retention for screenshot OCR text** — OCR text kept after the source screenshot is purged.
37379. **Retention for risk-score snapshots** — periodic risk snapshots kept indefinitely as tiny time-series.
37380. **Retention-aware dedup** — dedup fingerprints survive evidence purges so identity isn't lost.
37381. **Retention for API schema snapshots** — schemas kept per target version for drift analysis.
37382. **Retention for compliance evidence packs** — evidence assembled for an audit locked against purging until the audit closes.
37383. **Retention for penetration-test reports** — final reports kept 7 years even when raw data is gone.
37384. **Retention for client feedback** — client comments on findings kept with the finding's lifetime.
37385. **Emergency purge button** — one-click immediate purge of a target's raw data for breach-response scenarios, fully logged.
37386. **Retention for webhook secrets** — webhook signing secrets rotated and old values purged on rotation.
37387. **Retention for OAuth tokens** — connected-integration tokens purged immediately on disconnect.
37388. **Retention for geolocation data** — IP geolocation lookups cached briefly then purged.
37389. **Retention for test accounts** — test credential records purged when the target is offboarded.
37390. **Retention for onboarding data** — trial-workspace data auto-purged 30 days after trial end unless converted.
37391. **Retention for duplicate evidence** — duplicate evidence bundles purged first when space is tight.
37392. **Retention policy API** — manage all retention rules programmatically for IaC-managed deployments.
37393. **Retention for model artifacts** — downloaded model files follow a separate cache policy with LRU eviction.
37394. **Retention for training labels** — human labels on findings kept indefinitely as compact annotations.
37395. **Retention for A/B test configs** — scan-experiment configs kept 1 year for methodology review.
37396. **Retention for scheduled-report outputs** — generated report PDFs kept per report-retention, not hunt-retention.
37397. **Retention for deleted-user data** — define reassignment vs purge when a team member leaves.
37398. **Retention for shared-dossier snapshots** — snapshots shared externally expire independently of source.
37399. **Retention compliance calendar** — calendar showing upcoming purges, legal-hold expiries, and audit deadlines.
37400. **Retention for keyboard/mouse telemetry** — control-mode input telemetry purged after 24 hours by default.
37401. **Retention policy onboarding wizard** — guided setup asking about industry, clients, and contracts to suggest rules.
37402. **Retention for draft findings** — draft (unsubmitted) findings purged after 90 days of inactivity.
37403. **Retention for comment threads** — discussion threads kept with their finding's lifetime.
37404. **Retention attestation reports** — quarterly auto-generated report proving retention compliance for auditors.
37405. **One-click JSON export** — export any hunt, target, or finding set to a versioned JSON schema with a single action.
37406. **CSV export with flattened fields** — findings exported to CSV with nested evidence summarized into readable columns.
37407. **SARIF export for findings** — emit SARIF 2.1.0 so results flow into GitHub code scanning and other SARIF consumers.
37408. **Markdown report export** — clean Markdown with headings, tables, and embedded evidence links for wikis and repos.
37409. **PDF export with branding** — professional PDFs with client logo, cover page, and table of contents.
37410. **Consistent cross-format schemas** — JSON, CSV, SARIF, and Markdown exports share field names and severity scales.
37411. **Export schema versioning** — every export stamps its schema version so consumers can handle format evolution.
37412. **Selective-field export builder** — pick exactly which fields to include per export with saved field profiles.
37413. **Export with evidence bundles** — optionally include request/response pairs and screenshots in a ZIP alongside the report.
37414. **Export without evidence (summary)** — lightweight summary exports containing findings only, for quick sharing.
37415. **Scheduled recurring exports** — auto-generate weekly CSV/SARIF drops to an S3 bucket or SFTP server.
37416. **Export to Jira CSV format** — pre-mapped CSV columns that Jira's importer accepts without manual mapping.
37417. **Export to DefectDojo JSON** — native DefectDojo-compatible JSON for direct ingestion.
37418. **Export to ServiceNow format** — map findings to ServiceNow vulnerability-response fields on export.
37419. **Export diff between hunts** — export only what changed (new/fixed/regressed) between two hunts.
37420. **Export with CVSS vectors** — include full CVSS 3.1/4.0 vectors and scores in every structured export.
37421. **Export with CWE mappings** — every finding carries its CWE ID in all machine-readable formats.
37422. **Export with remediation guidance** — include fix steps, code samples, and references in exports by default.
37423. **Export redaction profiles** — apply named redaction profiles (client-safe, public, internal) before export.
37424. **Export watermarking (data-management context)** — stamp exports with recipient, date, and classification to trace leaks.
37425. **Export access logging** — log who exported what, when, and in which format for audit.
37426. **Export size estimator** — preview export size and row counts before generating large exports.
37427. **Export to Excel with pivot sheets** — multi-sheet XLSX with raw data plus prebuilt pivot tables and charts.
37428. **Export to HTML report** — self-contained HTML with searchable findings and collapsible evidence.
37429. **Export finding timeline** — chronological JSON/CSV of a finding's lifecycle events for auditors.
37430. **Export target dossier** — full target profile export (hunts, findings, notes, configs) as a portable package.
37431. **Export hunt replay bundle** — export the request sequence so the hunt can be replayed elsewhere.
37432. **Export to XML (generic)** — configurable XML export with XSLT-friendly structure for legacy tooling.
37433. **Export to STIX 2.1** — represent findings as STIX objects for threat-intel platform ingestion.
37434. **Export to OpenC2** — emit response-action playbooks in OpenC2 for SOAR automation.
37435. **Export API with pagination** — programmatic export endpoints supporting cursor pagination for huge datasets.
37436. **Export webhooks on completion** — notify a URL when a scheduled export finishes with a download link.
37437. **Export to Google Sheets** — push findings directly to a Sheet with one click via OAuth.
37438. **Export to Notion database** — sync findings into a Notion database with mapped properties.
37439. **Export to Confluence** — publish the report as a Confluence page under a chosen space.
37440. **Export to SharePoint** — upload reports to a SharePoint document library with metadata.
37441. **Export encryption (PGP)** — encrypt exports with the recipient's PGP key before delivery.
37442. **Export password-protected ZIP** — AES-256 ZIPs with the password delivered through a separate channel.
37443. **Export with digital signature** — sign exports so recipients can verify authenticity and integrity.
37444. **Export template gallery** — community and built-in report templates (pentest, bounty, executive, compliance).
37445. **Custom export template builder** — drag-and-drop sections to design bespoke report layouts.
37446. **Export in multiple languages** — generate reports in the client's language from a single finding set.
37447. **Export with severity distribution charts** — embed generated charts (donut, bar, trend) in PDF/HTML exports.
37448. **Export comparison dashboard** — side-by-side export of two targets' metrics for benchmarking decks.
37449. **Export hunt configuration** — export the exact scan config for reproducibility and peer review.
37450. **Export learning insights** — export aggregated, anonymized learning stats for methodology sharing.
37451. **Export researcher activity** — per-researcher contribution exports for performance reviews.
37452. **Export cost breakdown** — compute/request cost per hunt in the export for client billing.
37453. **Export SLA compliance** — per-finding SLA status and breach counts for status reports.
37454. **Export fix-verification evidence** — before/after evidence pairs bundled for fix sign-off.
37455. **Export risk-acceptance log** — accepted risks with approvers and expiries as a standalone document.
37456. **Export scope documentation** — the exact scope rules that applied, for engagement files.
37457. **Export chain visualizations** — attack-chain diagrams rendered as SVG/PNG inside exports.
37458. **Export evidence chain-of-custody** — hash-chained evidence manifest proving tamper-evidence.
37459. **Export with QR deep-links** — QR codes in PDFs linking back to live findings for reviewers.
37460. **Export redaction audit trail** — list exactly what was redacted from each export and why.
37461. **Export format validation** — validate generated SARIF/JSON against official schemas before delivery.
37462. **Export dry-run mode** — generate to a temp location for review without logging a formal export event.
37463. **Export to SIEM (CEF/LEEF)** — stream findings as CEF or LEEF events for ArcSight/QRadar ingestion.
37464. **Export to Splunk HEC** — push findings to Splunk HTTP Event Collector with sourcetype mapping.
37465. **Export to Elasticsearch** — bulk-index findings into an ES index with a provided mapping template.
37466. **Export to BigQuery** — stream findings into BigQuery tables for data-warehouse analytics.
37467. **Export to Snowflake** — stage findings as Parquet for Snowflake ingestion.
37468. **Export to Datadog** — send findings as Datadog events/logs with tags.
37469. **Export delta since last export** — incremental exports containing only new/changed records since a checkpoint.
37470. **Export checkpoint management** — track per-destination cursors so incremental exports never miss or repeat.
37471. **Export retry with backoff** — failed scheduled exports retry automatically with exponential backoff and alerts.
37472. **Export to encrypted S3** — write exports to S3 with SSE-KMS and bucket-policy enforcement.
37473. **Export to Azure Blob** — native Azure Blob delivery with SAS-token expiry.
37474. **Export to GCS** — Google Cloud Storage delivery with uniform bucket-level access.
37475. **Export manifest file** — every export ships a manifest listing files, hashes, row counts, and schema versions.
37476. **Export with data-classification labels** — stamp each export with its classification (Public/Internal/Confidential).
37477. **Export approval workflow** — sensitive exports require a second approver before generation.
37478. **Export to ticketing bulk-create** — generate importer files that bulk-create tickets in Jira/Linear/Asana.
37479. **Export anonymized dataset** — strip all target identifiers for safe methodology research sharing.
37480. **Export sample subset** — export a stratified sample (e.g., 10%) for quick reviews or demos.
37481. **Export with glossary** — append a glossary of vulnerability terms for non-technical readers.
37482. **Export executive summary page** — auto-written one-page summary leading every client report.
37483. **Export methodology appendix** — standard testing-methodology section auto-attached to formal reports.
37484. **Export limitation-of-liability page** — engagement-specific liability and scope-limitation text included by default.
37485. **Export with CVSS calculator links** — each finding links to its pre-filled CVSS calculator URL for verification.
37486. **Export to Faraday** — Faraday-compatible XML/JSON for team-server ingestion.
37487. **Export to Dradis** — Dradis-friendly HTML/CSV for collaborative report assembly.
37488. **Export to PlexTrac** — PlexTrac-mapped JSON for report-module ingestion.
37489. **Export to ThreadFix** — ThreadFix-compatible format for consolidated vulnerability management.
37490. **Export to Kenna/Cisco VM** — Kenna data-importer format with asset and scanner metadata.
37491. **Export to Brinqa** — Brinqa connector-ready finding payloads.
37492. **Export to Vulcan Cyber** — Vulcan-compatible CSV with remediation campaign fields.
37493. **Export to Nucleus** — Nucleus ingestion format with asset-group mapping.
37494. **Export to Seemplicity** — Seemplicity-ready prioritized finding feeds.
37495. **Export to Rezilion** — Rezilion-compatible software-inventory-linked findings.
37496. **Export to Wiz** — Wiz issue-format mapping for cloud-context enrichment.
37497. **Export to Orca** — Orca alert-compatible JSON for cloud security teams.
37498. **Export to Snyk Code** — Snyk-compatible JSON for developer-workflow ingestion.
37499. **Export to GitLab SAST format** — GitLab security-report JSON so findings appear in merge requests.
37500. **Export to GitHub code-scanning** — SARIF tuned for GitHub code-scanning annotations on PRs.
37501. **Export to Azure DevOps** — Azure DevOps-compatible SARIF/test-result uploads.
37502. **Export to Jenkins Warnings-NG** — SARIF/issues format consumable by Jenkins Warnings Next Generation.
37503. **Export with SBOM linkage** — link findings to SBOM components for software-supply-chain reports.
37504. **Export format deprecation notices** — warn consumers 90 days before an export schema version is retired.
37505. **Burp Suite XML importer** — ingest Burp Scanner/Pro XML and normalize issues into Dark-Matter findings with severity mapping.
37506. **Burp project-file importer** — import .burp project state including target scope, issues, and request history.
37507. **Nuclei JSONL importer** — stream Nuclei JSONL output into findings, mapping template IDs to CWE and severity.
37508. **Nuclei SARIF importer** — accept Nuclei's SARIF output as an alternative ingestion path with template metadata.
37509. **OWASP ZAP XML importer** — parse ZAP XML reports into normalized findings with risk/confidence mapping.
37510. **OWASP ZAP JSON importer** — ingest ZAP's JSON API output including alerts, URLs, and scan stats.
37511. **Nessus (.nessus) importer** — import Nessus scan files, mapping plugin IDs to CVEs and severities.
37512. **OpenVAS XML importer** — ingest OpenVAS/Greenbone XML reports into the unified finding model.
37513. **Nikto CSV importer** — normalize Nikto's CSV findings with OSVDB references preserved.
37514. **SQLMap log importer** — parse SQLMap logs into injection findings with DBMS and technique details.
37515. **WPScan JSON importer** — import WPScan results mapping WordPress core/plugin/theme vulns to findings.
37516. **SSLyze JSON importer** — turn SSLyze output into TLS-configuration findings with severity rules.
37517. **testssl.sh JSON importer** — normalize testssl.sh JSON findings into TLS posture records.
37518. **Nmap XML importer** — import Nmap XML for port/service inventory linked to the target profile.
37519. **Masscan JSON importer** — ingest masscan banners at scale into the asset inventory.
37520. **Amass JSON importer** — import Amass subdomain enumeration into the target's asset inventory.
37521. **Subfinder JSON importer** — merge Subfinder results with existing subdomain records, deduping automatically.
37522. **httpx JSONL importer** — import httpx probe data (status, title, tech) into target snapshots.
37523. **Katana/URL crawl importer** — ingest crawler URL lists into the target's endpoint catalog.
37524. **Gobuster/FFUF JSON importer** — import directory-bruteforce results as discovered endpoints with status codes.
37525. **Semgrep JSON importer** — normalize Semgrep SAST findings into code-level findings with file/line refs.
37526. **Bandit JSON importer** — ingest Bandit Python SAST results with issue-severity mapping.
37527. **Gosec JSON importer** — import Gosec Go SAST findings into the unified model.
37528. **Brakeman JSON importer** — normalize Brakeman Rails findings with confidence mapping.
37529. **Trivy JSON importer** — import Trivy container/image scan results linked to SBOM components.
37530. **Grype JSON importer** — ingest Grype vulnerability matches with fix-version data.
37531. **Snyk JSON importer** — import Snyk test JSON for open-source and code findings.
37532. **Dependabot alerts importer** — pull Dependabot alerts via API into dependency findings.
37533. **OSV API importer** — query OSV for affected packages and import matches as findings.
37534. **Shodan JSON importer** — import Shodan host data (ports, banners, vulns) into target profiles.
37535. **Censys JSON importer** — ingest Censys host/certificate data for infrastructure context.
37536. **Acunetix XML importer** — parse Acunetix reports into findings with threat/affected-item mapping.
37537. **Netsparker/Invicti importer** — import Invicti XML findings with classification mapping.
37538. **Qualys XML importer** — ingest Qualys WAS XML into normalized findings.
37539. **Rapid7 Nexpose XML importer** — import Nexpose XML with CVSS-based severity normalization.
37540. **Tenable.io API importer** — pull Tenable.io vulns via API on a schedule into findings.
37541. **Wapiti XML importer** — normalize Wapiti's XML report categories into findings.
37542. **Skipfish CSV importer** — import Skipfish samples as low-confidence informational findings.
37543. **Arachni XML importer** — parse Arachni AFR/XML reports into findings.
37544. **Vega XML importer** — ingest Vega scanner alerts with classification mapping.
37545. **Grabber/Arachni legacy importer** — support legacy scanner formats for historical data migration.
37546. **Importer severity-normalization engine** — one rules engine mapping every scanner's scale to Dark-Matter severities.
37547. **Importer field-mapping UI** — visual mapper to align an unknown CSV's columns to finding fields.
37548. **Generic CSV importer** — import any CSV with column mapping, validation, and dry-run preview.
37549. **Generic JSON importer with JSONPath** — point JSONPath expressions at fields in arbitrary scanner JSON.
37550. **Importer dry-run preview** — show the first 50 normalized records before committing any import.
37551. **Import dedup against existing** — every import runs the cross-hunt deduper before creating records.
37552. **Import source attribution** — every imported finding records its scanner, version, and import batch ID.
37553. **Import batch rollback** — undo an entire import batch with one action if the data was bad.
37554. **Scheduled API imports** — poll Tenable, Qualys, or Snyk APIs nightly and import deltas automatically.
37555. **Importer plugin SDK** — let teams write custom importers in JavaScript against a documented SDK.
37556. **Importer marketplace** — share community-built importers for niche scanners with ratings.
37557. **Import validation reports** — per-import report of rows accepted, rejected, deduped, and why.
37558. **Import field-conflict resolver** — when imports disagree with existing findings, queue a resolution UI.
37559. **Import evidence attachment** — attach the original scanner report file to the import batch for traceability.
37560. **Import with original-severity preserved** — keep the scanner's native severity alongside the normalized one.
37561. **Import asset reconciliation** — match imported hosts/URLs to existing target profiles or propose new ones.
37562. **Import tag injection** — auto-tag imported findings (e.g., "imported:nessus") for filtering.
37563. **Import confidence defaults** — assign per-scanner default confidence scores, tunable per workspace.
37564. **Import throttling for large files** — stream multi-GB imports in chunks with progress and resume.
37565. **Import from email attachments** — forward a scanner report to a per-workspace email to trigger import.
37566. **Import via API upload** — REST endpoint accepting scanner files for CI-driven ingestion.
37567. **Import status dashboard** — track every import batch: progress, errors, and resulting record counts.
37568. **Import error quarantine** — rows that fail validation go to quarantine for manual fix and re-import.
37569. **Import mapping templates** — save field mappings per scanner as reusable templates.
37570. **Import with timezone normalization** — normalize scanner timestamps to UTC with original offsets preserved.
37571. **Import duplicate-file detection** — warn if the same report file was already imported (hash check).
37572. **Import merge strategies** — choose per-import: create-new, update-existing, or upsert for each record type.
37573. **Import with finding-state mapping** — map scanner states (open/fixed) to Dark-Matter lifecycle states.
37574. **Import assignee mapping** — map scanner "owner" fields to workspace users where possible.
37575. **Import SLA clock start** — imported findings start SLA from first-seen, not import date, when evidence supports it.
37576. **Import with reference URLs** — preserve scanner reference links (NVD, vendor advisories) on imported findings.
37577. **Import CVSS passthrough** — keep the scanner's CVSS vector verbatim alongside normalized scores.
37578. **Import plugin-ID registry** — maintain a registry mapping scanner plugin/template IDs to internal technique IDs.
37579. **Import from DefectDojo** — pull findings from DefectDojo via its API with engagement mapping.
37580. **Import from Faraday** — ingest Faraday workspaces via API into target profiles.
37581. **Import from PlexTrac** — pull PlexTrac findings into the unified model.
37582. **Import from Dradis** — import Dradis projects via API with node/evidence mapping.
37583. **Import from HackerOne** — sync HackerOne reports (with permission) into findings for retest tracking.
37584. **Import from Bugcrowd** — import Bugcrowd submissions similarly for consolidated tracking.
37585. **Import from GitHub code scanning** — pull GitHub code-scanning alerts via API into findings.
37586. **Import from GitLab SAST** — ingest GitLab pipeline security reports via API.
37587. **Import from Jira (as findings)** — convert Jira security tickets into findings with status sync-back.
37588. **Import from ServiceNow VR** — pull ServiceNow vulnerability items into the unified model.
37589. **Import from Wiz** — ingest Wiz issues via API for cloud-context findings.
37590. **Import historical pentest PDFs** — extract findings from legacy PDF reports via structured parsing + review.
37591. **Import from spreadsheets** — guided import from Excel/Google Sheets tracker formats used by clients.
37592. **Import from ThreadFix** — pull ThreadFix applications and vulnerabilities via API.
37593. **Import from Kenna** — ingest Kenna assets and scores for risk-prioritized imports.
37594. **Import from Brinqa** — pull Brinqa findings with ticket linkage preserved.
37595. **Import from Nucleus** — ingest Nucleus projects and findings via API.
37596. **Import from Vulcan** — import Vulcan remediation campaigns as finding groups.
37597. **Import with data-residency check** — block imports that would move data across restricted regions.
37598. **Import PII scrubbing option** — scrub PII from imported evidence during ingestion per policy.
37599. **Import retention inheritance** — imported data adopts workspace retention or a per-importer override.
37600. **Import webhook receiver** — accept scanner webhooks (e.g., Snyk, Dependabot) for real-time ingestion.
37601. **Import with change detection** — compare each scheduled import against the last to create delta-only updates.
37602. **Import approval for external data** — imports from untrusted sources require reviewer approval before merging.
37603. **Import audit trail** — every import logged with uploader, source, timestamp, and record counts.
37604. **Importer health monitoring** — track per-importer success rates and alert on format drift (schema changes).
37605. **Encrypted workspace backups** — AES-256 encrypted full-workspace backups including hunts, findings, and memory.
37606. **One-click restore** — restore a workspace from backup with a guided wizard and pre-restore compatibility check.
37607. **Scheduled automatic backups** — daily/weekly automatic backups with configurable time windows.
37608. **Backup to S3/GCS/Azure** — store backups in the customer's own cloud bucket with their KMS keys.
37609. **Local-disk backup target** — write backups to a local path for air-gapped environments.
37610. **Incremental backups** — nightly incrementals plus weekly fulls to minimize backup time and size.
37611. **Backup integrity verification** — every backup is hash-verified and test-restored in a sandbox automatically.
37612. **Backup encryption-key management** — per-workspace keys with rotation support and HSM/KMS integration.
37613. **Granular restore (per-hunt)** — restore a single hunt or target from a backup without touching the rest.
37614. **Point-in-time restore** — pick any backup timestamp and preview the workspace state before restoring.
37615. **Backup retention policy** — keep N daily, M weekly, K monthly backups with automatic pruning.
37616. **Cross-region backup replication** — replicate backups to a second region for disaster recovery.
37617. **Backup size dashboard** — track backup sizes, growth trends, and compression ratios per workspace.
37618. **Pre-backup redaction option** — create redacted backups safe for off-site storage or vendor support.
37619. **Backup includes hunt memory** — the agent's working memory and learning state are part of every backup.
37620. **Backup excludes cache** — transient caches and model files excluded automatically to keep backups lean.
37621. **Disaster-recovery runbook generator** — auto-generate a step-by-step DR runbook from the backup configuration.
37622. **Backup restore dry-run** — simulate a restore to validate integrity without modifying live data.
37623. **Multi-workspace backup sets** — back up several workspaces into one encrypted set with per-workspace keys.
37624. **Backup access controls** — only workspace admins can create or restore backups, fully logged.
37625. **Backup failure alerts** — immediate alerts when a scheduled backup fails or exceeds its time window.
37626. **Backup to offline media manifest** — generate manifests for tape/USB archival with checksums.
37627. **Backup versioning** — every backup versioned; restore any generation, not just the latest.
37628. **Selective backup profiles** — profiles like "findings-only", "full", or "metadata-only" for different needs.
37629. **Backup before destructive ops** — auto-snapshot before bulk deletes, merges, or retention purges.
37630. **Backup encryption attestation** — signed attestation that backups are encrypted at rest for auditors.
37631. **Restore conflict resolution** — when restoring over live data, choose per-record keep-live/keep-backup/merge.
37632. **Backup of sync state** — multi-device sync cursors and device keys included so restored devices re-sync cleanly.
37633. **Backup bandwidth throttling** — cap backup upload bandwidth during business hours.
37634. **Backup compression levels** — tunable compression trading CPU time for backup size.
37635. **Deduplicated backup storage** — content-defined chunking so identical evidence across backups stores once.
37636. **Backup legal-hold integration** — legal holds pin related backups against pruning until released.
37637. **Backup for deleted workspaces** — deleted workspaces get a final backup retained per policy before purge.
37638. **Restore to new workspace** — restore a backup as a separate workspace for forensics without disturbing production.
37639. **Backup notification digest** — weekly digest of backup health: successes, sizes, and upcoming prunes.
37640. **Backup cost estimator** — project cloud-storage costs for the chosen backup schedule.
37641. **Backup with client-data segregation** — per-client encryption keys so one client's backup can't expose another's.
37642. **Backup restore permissions** — restoring requires the same role that could delete the data, enforced by policy.
37643. **Backup of export templates** — custom report templates and field profiles included in backups.
37644. **Backup of retention policies** — retention rules and their version history backed up with the data.
37645. **Backup of dedup rules** — fingerprint rules and merge lineage included so identity survives restore.
37646. **Backup of target profiles** — dossiers, credentials references, and notes fully captured.
37647. **Backup of API tokens (sealed)** — integration tokens backed up in sealed form, re-sealed on restore.
37648. **Backup verification reports** — downloadable PDF proving last successful verified restore for compliance.
37649. **Backup scheduling blackouts** — skip backups during hunts' peak hours or client blackout windows.
37650. **Backup to SFTP** — push backups to an SFTP server for legacy infrastructure compatibility.
37651. **Backup chunking for large workspaces** — split huge backups into resumable chunks for unreliable links.
37652. **Backup resume after interruption** — interrupted backups resume from the last completed chunk.
37653. **Backup encryption algorithm agility** — support AES-256-GCM today with a path to post-quantum ciphers.
37654. **Backup key-escrow option** — optional escrowed recovery key for business-continuity scenarios.
37655. **Backup restore audit trail** — every restore logged with restorer identity, source backup, and scope.
37656. **Backup data-sovereignty controls** — choose the region where backups are stored, enforced technically.
37657. **Backup of scheduled jobs** — hunt schedules, export schedules, and cron definitions included.
37658. **Backup of notification rules** — alert and digest configurations preserved across restores.
37659. **Backup of custom fields** — workspace custom-field definitions and values included.
37660. **Backup with integrity timeline** — per-backup timeline of verification checks for auditor review.
37661. **Backup storage lifecycle** — auto-transition old backups to cheaper storage classes (S3 Glacier).
37662. **Backup restore performance SLA** — measure and report restore times; alert if RTO targets are missed.
37663. **Backup of avatar/voice data** — avatar configs and voice preferences included with short retention.
37664. **Backup pre-flight checks** — verify disk space, key availability, and target reachability before starting.
37665. **Backup post-restore validation** — automated checks (record counts, index health) run after every restore.
37666. **Backup with redaction proofs** — when creating redacted backups, log exactly what was stripped.
37667. **Backup of webhook configs** — webhook endpoints and signing secrets (sealed) included.
37668. **Backup of SSO/SAML config** — identity-provider configuration backed up for DR rebuilds.
37669. **Backup of audit logs** — audit trails included in backups with tamper-evident chaining.
37670. **Emergency backup trigger** — API/one-click immediate backup before risky operations or incidents.
37671. **Backup of learning-engine state** — learned payload rankings and FP patterns preserved across restores.
37672. **Backup of search indexes** — optionally include search indexes to skip reindexing after restore.
37673. **Backup delta preview** — show what changed since the last backup before running the next one.
37674. **Backup of file attachments** — uploaded scope docs and specs included with deduplication.
37675. **Backup restore into sandbox** — restore into an isolated sandbox workspace for safe inspection.
37676. **Backup retention exceptions** — pin specific backups (e.g., pre-release) against automatic pruning.
37677. **Backup with parallel streams** — multi-threaded backup for large workspaces to meet tight windows.
37678. **Backup network-failure handling** — pause and resume on network drops with integrity re-verification.
37679. **Backup of dashboard layouts** — saved dashboards and widgets included in workspace backups.
37680. **Backup of saved searches** — saved queries and subscriptions preserved across restores.
37681. **Backup encryption-key rotation** — rotate backup keys with re-encryption of recent backups, old keys archived.
37682. **Backup compliance tagging** — tag backups with data classification and jurisdiction for policy enforcement.
37683. **Backup of user roles** — role definitions and assignments included (not the credentials themselves).
37684. **Backup restore rollback** — if a restore goes wrong, roll back to the pre-restore snapshot automatically.
37685. **Backup storage quota alerts** — warn before backup storage exceeds budget or quota.
37686. **Backup with bandwidth scheduling** — full backups at night, incrementals hourly, all configurable.
37687. **Backup of mobile-app state** — companion-app offline caches backed up with the workspace.
37688. **Backup verification scheduling** — test-restores run on a schedule independent of backup creation.
37689. **Backup of custom integrations** — integration configs and field mappings preserved.
37690. **Backup data-flow diagram** — visual map of where backup data flows (workspace → bucket → replica).
37691. **Backup incident playbook link** — link each workspace's backup set to its incident-response playbook.
37692. **Backup of threat-intel feeds** — cached intel and custom IoC lists included in backups.
37693. **Backup restore notifications** — notify workspace owners when any restore completes, with scope details.
37694. **Backup with immutable snapshots** — WORM-mode backups that can't be altered for ransomware resilience.
37695. **Backup of redaction profiles** — named redaction profiles included so restores keep export behavior.
37696. **Backup cross-account sharing** — securely share a backup with another account via delegated keys.
37697. **Backup lifecycle simulator** — simulate a year of backup/prune cycles to validate retention math.
37698. **Backup of hunt templates** — saved hunt configurations and plugin sets included.
37699. **Backup documentation export** — human-readable PDF describing what each backup contains and how to restore it.
37700. **Backup health score** — composite score from recency, verification status, and coverage gaps.
37701. **Backup of keyboard shortcuts** — user preference data (shortcuts, themes) included in personal backups.
37702. **Backup restore checklist** — interactive checklist guiding the restorer through validation steps.
37703. **Backup of API rate-limit state** — importer cursors and rate-limit state preserved to avoid duplicate pulls.
37704. **Zero-downtime restore** — restore into a shadow workspace and swap with no interruption to active hunts.
37705. **End-to-end encrypted device sync** — sync hunt state across desktop and laptop with keys only the user holds.
37706. **Per-device sync status dashboard** — see each device's last-sync time, pending changes, and sync health.
37707. **Selective sync profiles** — choose per device which workspaces, targets, or data types sync (e.g., no evidence on laptop).
37708. **Offline-first sync engine** — work fully offline; changes merge automatically when connectivity returns.
37709. **Sync conflict resolver UI** — when two devices edit the same finding, show a side-by-side merge screen.
37710. **Last-writer-wins with audit** — default conflict policy with a full log of which device's change won.
37711. **Field-level conflict merging** — merge non-overlapping field edits from two devices instead of picking one version.
37712. **Device pairing via QR** — pair a new device by scanning a QR code, with a short-lived pairing token.
37713. **Device trust revocation** — revoke a lost device's sync keys instantly, wiping its synced data remotely.
37714. **Sync encryption-key rotation** — rotate the sync key across all devices with a coordinated re-key protocol.
37715. **Bandwidth-aware sync** — defer large evidence uploads until on unmetered networks, syncing metadata first.
37716. **Sync over local network** — devices on the same LAN sync peer-to-peer without cloud round-trips.
37717. **Sync progress indicators** — per-workspace progress bars showing what's uploading, downloading, or pending.
37718. **Device-specific retention** — phones keep 30 days of data locally while desktops keep everything, all synced logically.
37719. **Sync exclusion by classification** — confidential findings never leave designated devices, enforced by policy.
37720. **Multi-device hunt handoff** — start a hunt on desktop, continue reviewing on laptop with state transferred seamlessly.
37721. **Real-time collaborative cursors** — see teammates' presence in shared workspaces with live cursors on findings.
37722. **Sync of draft findings** — in-progress drafts sync so work started on one device finishes on another.
37723. **Sync of researcher notes** — notes sync instantly across devices with per-note edit history.
37724. **Sync of saved searches** — saved queries and subscriptions follow the user across devices.
37725. **Sync of dashboard layouts** — custom dashboards look the same on every paired device.
37726. **Sync throttling controls** — cap sync CPU, bandwidth, and battery usage per device.
37727. **Sync error inbox** — failed sync items queue with reasons and one-click retry or skip.
37728. **Device storage quotas** — per-device caps with automatic eviction of oldest synced evidence.
37729. **Sync with delta compression** — only changed fields travel the wire, compressed, to minimize data use.
37730. **Sync checkpoint recovery** — interrupted syncs resume from checkpoints instead of restarting.
37731. **New-device bootstrap** — a new device pulls a consistent snapshot then catches up on deltas.
37732. **Device activity log** — per-device log of syncs, hunts run, and data accessed for security review.
37733. **Sync pause per workspace** — pause syncing a sensitive workspace on a travel device temporarily.
37734. **Sync over Tor/VPN awareness** — detect constrained networks and switch to minimal-sync mode automatically.
37735. **Cross-platform sync parity** — Windows, macOS, and Linux clients sync identically with platform-specific paths handled.
37736. **Sync of hunt memory** — the agent's working memory syncs so mid-hunt chat continues across devices.
37737. **Sync of voice/avatar prefs** — avatar gender, voice choice, and TTS settings follow the user.
37738. **Sync of API tokens (sealed)** — integration tokens sync in sealed form, unlocked per device with biometrics.
37739. **Sync conflict-free replicated types** — use CRDTs for notes and tags so concurrent edits merge without conflicts.
37740. **Sync schema migrations** — devices on different app versions negotiate schema upgrades during sync.
37741. **Sync of notification state** — read/dismissed notification state syncs so alerts don't re-fire on each device.
37742. **Sync of watchlists** — finding watchlists and their alert states stay consistent across devices.
37743. **Device capability negotiation** — low-RAM devices receive summaries while powerful ones get full evidence.
37744. **Sync with client-side dedup** — devices skip uploading evidence chunks the cloud already has.
37745. **Sync integrity verification** — Merkle-tree verification that both sides hold identical data after sync.
37746. **Sync rollback per device** — roll a single device back to its last good sync state without affecting others.
37747. **Guest-device mode** — temporary read-only sync to a borrowed device that self-wipes on expiry.
37748. **Sync of export templates** — custom report templates available on every device.
37749. **Sync of keyboard shortcuts** — personal shortcuts and UI preferences roam across devices.
37750. **Device fingerprinting for sync** — each device gets a stable fingerprint for audit and anomaly detection.
37751. **Anomalous-sync alerts** — alert when a device syncs from an unusual location or uploads anomalous volumes.
37752. **Sync data-residency pinning** — sync traffic and relay storage stay within the chosen region.
37753. **Sync without cloud relay** — direct device-to-device sync option for air-gapped or paranoid setups.
37754. **Sync of scheduled hunts** — schedules created on one device run and appear on all.
37755. **Sync of retention policies** — policy changes propagate so all devices purge consistently.
37756. **Sync of legal holds** — holds apply everywhere instantly, blocking deletes on all devices.
37757. **Sync of redaction profiles** — redaction rules stay identical across devices for consistent exports.
37758. **Device wipe on too many failures** — after N failed unlocks, synced data self-destructs per policy.
37759. **Sync of finding assignments** — task assignments and their status sync in real time.
37760. **Sync presence for hunts** — see which device is actively running or viewing each hunt.
37761. **Hunt control handoff** — pause a hunt on desktop and resume it on laptop with full context transfer.
37762. **Sync of chat transcripts** — mid-hunt agent chat history available on every device.
37763. **Sync of evidence annotations** — highlights and notes on evidence sync across devices.
37764. **Device battery-aware scheduling** — defer heavy sync operations until the device is charging.
37765. **Sync of custom fields** — workspace custom-field definitions and values roam with the user.
37766. **Sync compression statistics** — show bytes saved by delta compression and dedup per device.
37767. **Multi-user device separation** — two users sharing one machine keep separate encrypted sync profiles.
37768. **Sync of threat-intel caches** — IoC caches and feed states sync so all devices share fresh intel.
37769. **Sync of learning-engine state** — learned payload rankings available on every device.
37770. **Device sync diagnostics** — one-click diagnostics bundle for troubleshooting sync issues.
37771. **Sync with forward secrecy** — session keys rotate so a compromised key can't decrypt old sync traffic.
37772. **Sync of file attachments** — scope docs and attachments sync on demand, not by default.
37773. **Lazy evidence sync** — evidence downloads only when opened, keeping device storage lean.
37774. **Sync priority queues** — findings and notes sync before bulky screenshots and videos.
37775. **Device sync groups** — group devices (e.g., "field kit") with shared sync policies.
37776. **Sync of backup schedules** — backup configurations consistent across a user's devices.
37777. **Cross-device clipboard for findings** — copy a finding link on desktop, paste it on laptop via secure sync.
37778. **Sync of report drafts** — in-progress report edits sync so drafting continues anywhere.
37779. **Device authorization expiry** — paired devices re-authorize every 90 days or lose sync access.
37780. **Sync of audit-log views** — audit filters and saved views roam across devices.
37781. **Offline evidence capture queue** — evidence captured offline queues reliably and uploads in order.
37782. **Sync with data caps** — monthly sync data budgets per device with warnings at 80%.
37783. **Device location-aware sync** — stricter sync policies automatically apply when a device is abroad.
37784. **Sync of target dossiers** — full target profiles available offline on field devices.
37785. **Peer-verified device identity** — new devices must be approved from an existing trusted device.
37786. **Sync of SLA dashboards** — SLA views and escalations consistent everywhere.
37787. **Device-specific notification rules** — critical alerts to phone, digests to desktop, configured per device.
37788. **Sync of hunt templates** — saved scan configurations roam across devices.
37789. **Background sync service** — OS-level background sync keeps data fresh without the app open.
37790. **Sync with E2E key backup** — encrypted key backup (recovery phrase) so users never lose sync access.
37791. **Device decommission flow** — guided wipe and key revocation when retiring a device.
37792. **Sync of compliance evidence packs** — audit packs assembled on one device open identically on another.
37793. **Sync performance benchmarks** — measure sync latency and throughput per device, surfaced in settings.
37794. **Sync of redaction audit trails** — what-was-redacted logs stay consistent across devices.
37795. **Multi-device search federation** — search queries fan out to all paired devices' local stores when offline.
37796. **Sync of keyboard-macro library** — saved macros and snippets roam with the researcher.
37797. **Device health attestation (data-management context)** — require OS patch level / disk encryption before allowing sync of sensitive workspaces.
37798. **Sync with split tunneling** — sync traffic routes via VPN while hunt traffic stays direct, configurable.
37799. **Sync of incident-response playbooks** — playbooks and runbooks available on every device.
37800. **Device sync onboarding tour** — guided first-pairing flow explaining encryption, keys, and recovery.
37801. **Sync of custom severity scales** — workspace severity customizations apply on all devices.
37802. **Sync conflict analytics** — report which fields and devices conflict most to improve workflows.
37803. **Sync with selective wipe** — wipe only work data on a personal device, leaving personal files untouched.
37804. **Universal sync status API** — programmatic endpoint reporting per-device sync state for MDM integration.
37805. **Response-body deduplication** — store identical response bodies once with reference counting across hunts.
37806. **Evidence compression pipeline** — transparent zstd compression of stored traffic with zero query-time friction.
37807. **10x evidence-store shrink goal** — combined dedup + compression + columnar storage targeting an order-of-magnitude reduction.
37808. **Columnar request-log storage** — store request logs in columnar format for fast analytical queries at low cost.
37809. **Hot/warm/cold evidence tiers** — recent evidence on fast SSD, aging evidence on cheap object storage, automatic migration.
37810. **Screenshot WebP conversion** — convert evidence screenshots to WebP with quality tuned for readability versus size.
37811. **Video-evidence transcoding** — transcode PoC videos to efficient codecs with chapter markers for key moments.
37812. **Duplicate-screenshot detection** — perceptual hashing drops near-identical screenshots from repeated hunts.
37813. **Request-log sampling for huge hunts** — keep full logs for interesting requests, sampled logs for repetitive 200-OK noise.
37814. **Header-dictionary compression** — dictionary-encode repeated HTTP headers across stored traffic.
37815. **TLS-session data minimization** — store only negotiated parameters, not full handshakes, in traffic archives.
37816. **Evidence garbage collection** — background GC reclaims storage from deleted hunts, merged duplicates, and expired data.
37817. **Storage quota per workspace** — hard and soft quotas with graceful degradation when exceeded.
37818. **Storage quota per target** — cap evidence per target so one huge engagement can't starve others.
37819. **Storage usage breakdown UI** — treemap of storage by target, hunt, and data type with drill-down.
37820. **Auto-eviction of low-value evidence** — when near quota, evict redundant 200-OK bodies before unique findings' evidence.
37821. **Evidence value scoring** — score each artifact's analytical value to guide eviction and tiering decisions.
37822. **Chunked blob storage** — large artifacts split into content-addressed chunks enabling cross-hunt dedup.
37823. **Content-addressed evidence store** — every blob stored by its hash, making identical evidence free to reference.
37824. **Compression-benchmark dashboard** — show compression ratios per data type and tune algorithms accordingly.
37825. **Index-size optimization** — periodically rebuild search indexes to reclaim space from deleted records.
37826. **Time-series rollup for metrics** — raw per-request metrics rolled into minute/hour/day aggregates over time.
37827. **Sparse storage for empty fields** — schema-less sparse encoding so findings with few fields cost little.
37828. **String-interning for enums** — intern repeated strings (methods, severities, techniques) to shrink indexes.
37829. **Delta-encoding for timelines** — store hunt timelines as deltas against baselines rather than full snapshots.
37830. **Snapshot diffing for target profiles** — store only changed fields between tech-stack snapshots.
37831. **Binary-diff for schema snapshots** — API schema versions stored as binary diffs against the previous version.
37832. **Log-structured merge for writes** — LSM-style ingestion for high-throughput hunt traffic without write stalls.
37833. **Read-replica offloading** — heavy analytics queries hit replicas, keeping the primary fast for hunt ingestion.
37834. **Partitioning by time and target** — table partitioning so old data drops are instant and queries stay fast.
37835. **Aggressive archiving of raw traffic** — raw traffic older than N days auto-archives to cold storage.
37836. **Evidence-thumbnail generation** — tiny thumbnails for quick browsing; full images load on demand.
37837. **Lazy materialization of exports** — exports generated from cold storage without rehydrating everything to hot.
37838. **Query-result caching** — cache expensive analytics queries with invalidation on new data.
37839. **Approximate counts for huge sets** — HyperLogLog-based counts for dashboards over billions of requests.
37840. **Storage cost attribution** — show dollars per target/hunt so teams optimize what they store.
37841. **Cold-storage rehydration SLA** — rehydrate archived evidence within a promised time when requested.
37842. **Selective rehydration** — pull back only the specific hunt's evidence, not the whole archive.
37843. **Storage health monitoring** — track disk, object-store latency, and corruption checks continuously.
37844. **Corruption detection and repair** — checksums on every blob with automatic repair from replicas or backups.
37845. **Erasure coding for evidence** — erasure-coded storage for durability without full replication cost.
37846. **Storage encryption at rest** — AES-256 encryption for all stored data with per-workspace keys.
37847. **Transparent page compression** — database page-level compression for indexes and metadata.
37848. **WAL archiving controls** — tune write-ahead-log retention to balance recovery needs and disk use.
37849. **Vacuum and analyze scheduling** — automated maintenance windows keeping the database lean.
37850. **Connection-pool-aware ingestion** — hunt ingestion back-pressures gracefully instead of overwhelming the store.
37851. **Batch ingestion API** — bulk-insert findings and traffic in batches for 10x import throughput.
37852. **Stream-processing for live hunts** — process hunt traffic as a stream with bounded memory, not batch loads.
37853. **Evidence lifecycle policies** — declarative rules (keep, compress, archive, delete) per data type and age.
37854. **Storage simulator** — forecast storage growth from planned hunts and tune policies proactively.
37855. **Deduplication across workspaces** — opt-in global chunk dedup so shared vendor assets store once.
37856. **Reference-counted blobs** — deleting a hunt decrements references; blobs die only at zero.
37857. **Orphan-blob reaper** — scheduled job finding and removing blobs with no references.
37858. **Storage of diffs, not full pages** — for re-crawled pages, store only what changed versus the last fetch.
37859. **Canonicalized URL storage** — store one canonical URL form with variant mappings to cut index bloat.
37860. **Normalized parameter storage** — parameter names dictionary-encoded; values stored once per unique string.
37861. **Response-body truncation rules** — truncate huge bodies at ingest with a pointer to full capture on demand.
37862. **Smart sampling of 200-OK traffic** — keep 1-in-N routine responses with full fidelity for anomalies.
37863. **Anomaly-preserving compression** — compression tuned to never degrade timing or error-signal fidelity.
37864. **Storage for ML features** — compact feature vectors for the learning engine stored separately from raw data.
37865. **Feature-store versioning** — versioned features so model retraining stays reproducible.
37866. **Embedding storage optimization** — quantized embeddings for semantic search at a fraction of the size.
37867. **Graph-storage for relationships** — findings, endpoints, and assets in a graph store for traversal queries.
37868. **Graph-pruning policies** — prune weak/old edges to keep traversals fast.
37869. **Time-to-live on cache entries** — every cache layer has TTLs tuned per data type.
37870. **Cache-warming for dashboards** — precompute popular dashboards after data loads.
37871. **Materialized views for reports** — pre-aggregated views power standard reports without scanning raw data.
37872. **Incremental materialization** — views update incrementally as new hunts land.
37873. **Storage audit reports** — periodic reports on growth, waste, and optimization opportunities.
37874. **Data-temperature dashboard** — visualize hot/warm/cold distribution and migration activity.
37875. **Automated tiering recommendations** — ML-suggested tiering rules based on access patterns.
37876. **Storage encryption-key rotation** — rotate data-encryption keys with background re-encryption.
37877. **Per-tenant storage isolation** — multi-tenant deployments isolate storage cryptographically per tenant.
37878. **Storage performance SLOs** — defined latency/throughput targets with alerting on breach.
37879. **Hunt-ingest backpressure UI** — show ingestion queue depth and let operators pause low-priority hunts.
37880. **Priority ingestion lanes** — critical hunts' data ingests first during storage contention.
37881. **Storage failure drills** — scheduled chaos drills verifying the store survives node loss.
37882. **Cross-AZ replication** — evidence replicated across availability zones for durability.
37883. **Storage cost anomaly alerts** — alert on unexpected storage-cost spikes per workspace.
37884. **Lifecycle-policy dry runs** — preview what a lifecycle rule would archive/delete before enabling.
37885. **Evidence-access heatmaps** — see which evidence is actually viewed to tune retention and tiering.
37886. **Never-accessed evidence reports** — list evidence never opened to justify aggressive archiving.
37887. **Storage of redacted copies** — keep redacted and original under separate lifecycles and access controls.
37888. **Compression of JSON payloads** — schema-aware JSON compression exploiting repeated field names.
37889. **Dictionary sharing across hunts** — shared compression dictionaries per target for better ratios.
37890. **Storage for fuzzing corpora** — corpus files stored content-addressed with coverage metadata.
37891. **Corpus minimization storage** — minimized corpora kept; redundant inputs reference-counted away.
37892. **Crash-artifact dedup** — identical crash stacks stored once across fuzzing campaigns.
37893. **Storage for replay sandboxes** — sandbox snapshots thin-provisioned with copy-on-write.
37894. **Ephemeral scratch quotas** — scratch space for analysis auto-cleaned after TTL.
37895. **Storage for scheduled-report outputs** — generated reports lifecycle-managed separately from source data.
37896. **Multi-cloud storage backends** — pluggable backends (S3, GCS, Azure, MinIO) behind one interface.
37897. **Storage-backend migration tool** — move data between backends with verification and rollback.
37898. **Storage latency-aware routing** — route reads to the fastest replica automatically.
37899. **Write-amplification monitoring** — track and alert on excessive write amplification in the store.
37900. **Compaction scheduling** — schedule LSM compactions outside hunt peak hours.
37901. **Bloom-filter pre-checks** — avoid disk reads for definitely-absent keys in dedup lookups.
37902. **Storage for audit-trail hashes** — hash-chained audit logs stored immutably and compactly.
37903. **Capacity-planning forecasts** — ML forecasts of storage needs 90 days out per workspace.
37904. **Storage-efficiency leaderboard** — rank targets by evidence-value per gigabyte to guide policy tuning.
37905. **Per-finding visibility controls** — set each finding to public, team-only, or restricted with role-based enforcement.
37906. **Client-data redaction before export** — one-click redaction of hostnames, IPs, and usernames from any export.
37907. **PII auto-detection in evidence** — ML scans evidence for emails, phone numbers, and IDs, flagging them for redaction.
37908. **Secret auto-redaction** — API keys, tokens, and passwords masked automatically in stored evidence and exports.
37909. **Redaction profiles per client** — named profiles defining what counts as sensitive for each client's exports.
37910. **Manual redaction editor** — paint over regions of screenshots or text spans with an audit-logged redaction tool.
37911. **Redaction preview mode** — preview exactly what a recipient will see before finalizing an export.
37912. **Redaction audit trail** — log every redaction: what was hidden, by whom, and under which profile.
37913. **Irreversible redaction option** — cryptographically destroy original spans so redaction can't be undone.
37914. **Reversible redaction for internal use** — internal reviewers can toggle redactions off with proper permission.
37915. **Field-level access controls** — restrict who can see evidence bodies, credentials, or client notes per field.
37916. **Finding-level sharing links** — share a single finding externally with expiry and view-only access.
37917. **Watermarked shared views** — shared links render with the viewer's identity watermarked to deter leaks.
37918. **Screenshot face/license-plate blur** — auto-blur faces and plates in evidence photos before storage.
37919. **Voice-recording redaction** — bleep sensitive segments in avatar voice recordings per policy.
37920. **Data-classification labels** — label findings Public/Internal/Confidential/Restricted with handling rules attached.
37921. **Classification inheritance** — child records inherit the strictest classification of their parents automatically.
37922. **Classification upgrade workflow** — request reclassification with approver and reason when sensitivity changes.
37923. **Privacy-by-default for new workspaces** — new workspaces start maximally restrictive; sharing is explicit opt-in.
37924. **Client isolation guarantees** — cryptographic and logical separation ensuring one client's data never leaks to another.
37925. **Cross-client analytics anonymization** — aggregate metrics across clients only on fully anonymized data.
37926. **Anonymized benchmarking datasets** — publish industry benchmarks with k-anonymity guarantees.
37927. **Differential-privacy for aggregates** — add calibrated noise to shared statistics to prevent re-identification.
37928. **Data-residency enforcement** — technically enforce that EU workspaces never store data outside the EU.
37929. **Consent tracking for data use** — record client consent for each data use (testing, learning, benchmarking).
37930. **Consent withdrawal handling** — when consent is withdrawn, purge or anonymize affected data with proof.
37931. **Right-to-erasure workflow (data-management context)** — guided flow deleting a data subject's PII across hunts, exports, and backups.
37932. **Data-subject access requests** — generate a report of all stored data about a subject on request.
37933. **Privacy impact assessments (data-management context)** — built-in PIA templates for new data-processing features.
37934. **Sensitive-data discovery scan** — scheduled scans finding unredacted PII/secrets in the archive.
37935. **Quarantine for sensitive findings** — findings containing live credentials auto-quarantined until reviewed.
37936. **Credential-rotation reminders** — when live creds appear in evidence, trigger rotation tasks with deadlines.
37937. **Evidence access justification** — require a reason to open Restricted findings, logged for audit.
37938. **Break-glass access (data-access context)** — emergency access to restricted data with mandatory post-hoc review.
37939. **Access reviews (quarterly)** — certify who has access to what, with automatic revocation of stale grants.
37940. **Least-privilege role templates** — prebuilt roles (viewer, researcher, lead, admin) with minimal permissions.
37941. **Temporary elevated access** — time-boxed privilege grants that expire automatically with full logging.
37942. **API-token scoping** — tokens restricted to specific workspaces, actions, and IP ranges.
37943. **Audit log of all data access** — immutable log of who viewed or exported which records.
37944. **Anomaly detection on access** — alert on unusual access patterns (bulk exports at 3am, new locations).
37945. **Export DLP scanning** — scan outbound exports for secrets and PII, blocking or quarantining violations.
37946. **Clipboard-protection mode** — disable copy/paste of restricted evidence on managed devices.
37947. **Screenshot-protection mode** — block OS screenshots when viewing restricted findings (where platform allows).
37948. **Session timeout for sensitive views** — auto-lock restricted finding views after inactivity.
37949. **Privacy-preserving search** — search over encrypted indexes without exposing plaintext to the search service.
37950. **Tokenization of identifiers** — replace usernames and emails with reversible tokens in analytics stores.
37951. **Pseudonymization for research** — research datasets use pseudonyms with the mapping held separately.
37952. **K-anonymity checks on exports** — warn when an export's quasi-identifiers could re-identify individuals.
37953. **L-diversity for sensitive attributes** — ensure anonymized exports don't leak sensitive values via homogeneity.
37954. **Privacy budget tracking** — track cumulative disclosure risk across shared datasets.
37955. **Secure multi-party analytics (data-management context)** — compute cross-client benchmarks without any party seeing raw data.
37956. **Homomorphic-encryption pilot** — evaluate encrypted computation for the most sensitive aggregate queries.
37957. **Confidential-computing enclaves** — process restricted evidence inside hardware enclaves where available.
37958. **Data-clean-room for clients** — clients query their own data in an isolated clean room without seeing others'.
37959. **Privacy dashboard (data-management context)** — one screen showing PII inventory, redaction coverage, and open privacy tasks.
37960. **Redaction coverage metrics** — track what fraction of evidence is scanned, flagged, and redacted.
37961. **False-redaction review** — review over-redacted content to keep evidence useful.
37962. **Redaction rule versioning** — version detection rules so changes are auditable and reversible.
37963. **Custom redaction patterns** — per-client regex patterns (employee IDs, project codenames) for detection.
37964. **Redaction of AI-training data** — training pipelines only see redacted, consented data.
37965. **Opt-out of learning per finding** — exclude sensitive findings from the learning engine entirely.
37966. **Federated learning option** — train models on-device so raw data never centralizes.
37967. **Privacy-preserving dedup** — dedup fingerprints computed on redacted fields to avoid leaking via hashes.
37968. **Encrypted search indexes** — indexes encrypted at rest with per-workspace keys.
37969. **Zero-knowledge architecture goal** — roadmap toward the provider being unable to read client data.
37970. **Customer-held encryption keys (BYOK)** — clients supply their own KMS keys; provider can't decrypt without them.
37971. **Key-revocation data freeze** — revoking BYOK instantly renders data unreadable, with a documented recovery path.
37972. **Privacy-preserving backups** — backups encrypted with customer keys before leaving their boundary.
37973. **Secure data-deletion proofs** — cryptographic proof that deleted data is unrecoverable (key destruction receipts).
37974. **Data-processing agreements hub** — store DPAs per client with renewal reminders.
37975. **Subprocessor list management** — maintain and publish the subprocessor list with change notifications.
37976. **Privacy-notice generator** — generate client-facing privacy notices from actual data practices.
37977. **Cookie-consent for the app** — the Dark-Matter web app itself honors cookie consent properly.
37978. **Telemetry opt-out (workspace privacy settings)** — one switch disabling all product telemetry with no dark patterns.
37979. **Minimal-telemetry mode** — telemetry limited to crash reports and version checks when enabled.
37980. **Privacy-preserving telemetry** — aggregate telemetry with no identifiers, documented publicly.
37981. **Incident-breach notification flow** — if a privacy incident occurs, guided notification workflow with timelines.
37982. **Privacy champion role** — designate per-workspace privacy champions with a dedicated task queue.
37983. **Privacy training reminders** — nudge researchers on handling PII in evidence and notes.
37984. **Secure evidence-viewer sandbox** — restricted evidence opens in an isolated viewer without download rights.
37985. **Download-justification for evidence** — downloading restricted evidence requires a logged reason.
37986. **Print-protection for reports** — confidential PDFs resist printing/copying via DRM flags where supported.
37987. **Expiry on shared exports** — shared report links self-destruct after the embargo period.
37988. **Recipient authentication for shares** — shared links require email OTP or SSO before opening.
37989. **Share-access analytics** — see who opened a shared finding, when, and from where.
37990. **Revoke-share instantly** — kill a shared link immediately, invalidating cached copies where possible.
37991. **Privacy-safe demo mode** — demo workspaces use synthetic data so no real client data is ever shown.
37992. **Synthetic-data generator** — generate realistic fake hunts for training and demos.
37993. **Data-masking for screenshots in docs** — auto-mask sensitive parts when screenshots are used in documentation.
37994. **Privacy review for new integrations** — checklist before connecting any third-party integration.
37995. **Vendor-risk assessments** — assess each integration vendor's data handling before enabling.
37996. **Data-flow mapping** — visual map of where personal data flows through the system for DPIAs.
37997. **Records-of-processing (RoPA)** — auto-maintained record of processing activities for GDPR Article 30.
37998. **Privacy-by-design checklist** — required checklist for every new data-management feature.
37999. **Annual privacy audit pack** — one-click pack of policies, logs, and attestations for auditors.
38000. **Privacy SLA for deletion** — commit to erasure-request completion within 30 days, tracked publicly per workspace.
38001. **Cross-border transfer register** — log every cross-border data movement with its legal basis.
38002. **Standard contractual clauses manager** — attach SCCs to transfers requiring them, with version tracking.
38003. **Privacy incident simulation drills** — tabletop exercises for data-breach response built into the workspace.
38004. **Data-ethics review board queue** — route dual-use or sensitive data capabilities for ethics review before release.
