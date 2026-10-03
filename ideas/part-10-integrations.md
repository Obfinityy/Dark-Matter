## Z. Integrations
0001. **Two-way Burp finding sync** — sync issues between Burp Suite and Dark-Matter over the Burp REST API with SHA-256 dedup keys so severity or status edits in either tool propagate without creating duplicates.
0002. **Burp scope import/export** — export Dark-Matter target scope as Burp target-scope JSON and re-import Burp scope edits so both tools always test the identical attack surface.
0003. **Collaborator OOB integration** — route all out-of-band payloads through Burp Collaborator with per-hunt payload IDs and auto-poll interactions so blind XSS and SSRF evidence arrives with zero manual polling.
0004. **Intruder payload set sharing** — push Dark-Matter-generated payload lists into Burp Intruder as named reusable payload sets so manual testers start exactly where automation stopped.
0005. **BApp Store listing** — package the sync extension for the BApp Store with signed releases so Burp users discover and install the Dark-Matter integration in one click.
0006. **Repeater session export** — export any finding's request/response pair as a Burp Repeater tab bundle so a human retests instantly without rebuilding the request by hand.
0007. **Site map import** — import Burp's discovered site map into Dark-Matter's crawl frontier so automated hunts cover URLs the manual tester already found.
0008. **Site map export** — push Dark-Matter's crawled URLs into Burp's site map with discovery-source tags so manual testers see automated coverage inside Burp.
0009. **Session cookie injection** — inject Dark-Matter's authenticated session cookies into Burp's cookie jar so proxied manual testing inherits the logged-in state automatically.
0010. **Burp project file parsing** — parse .burp project files to extract scope, issues, and proxy history for offline evidence migration when no live Burp instance exists.
0011. **HTTP history diffing** — diff Dark-Matter's request log against Burp proxy history to surface requests the automation never made and queue them for testing.
0012. **Comparer result import** — import Burp Comparer word/byte diffs as annotated evidence attachments so response-difference findings carry visual proof.
0013. **Decoder preset sharing** — share Dark-Matter's encoding/decoding chains as Burp Decoder presets so manual payload crafting reuses the same transforms.
0014. **Session handling rules export** — export Dark-Matter's login macros as Burp session-handling rules so Burp scans stay authenticated the same way.
0015. **Proxy listener mirroring** — mirror Dark-Matter's outbound traffic through a Burp upstream proxy listener so every automated request is inspectable in Burp history.
0016. **Match-and-replace import** — import Burp match-and-replace rules into Dark-Matter's request pipeline so header or token rewrites apply identically in both tools.
0017. **Montoya extension hot-reload** — build the sync extension on the Montoya API with hot-reload so updates deploy without restarting Burp mid-engagement.
0018. **Extension health monitoring** — heartbeat the Burp extension every 30 seconds and auto-reconnect the REST session so long hunts survive Burp restarts.
0019. **Scanner confidence feedback** — feed Dark-Matter's false-positive verdicts back into Burp Scanner's issue confidence so future Burp scans deprioritize the same dead ends.
0020. **Passive scan ingestion** — ingest Burp's passive scan findings via the REST API and normalize them into Dark-Matter's finding schema with source attribution.
0021. **Active scan kickoff** — trigger Burp active scans on newly discovered hosts through the REST API with per-program scan windows so Burp scans obey bounty rules.
0022. **Scan queue polling** — poll Burp's scan queue status and surface live progress in the hunt timeline so users see Burp-side work without opening Burp.
0023. **Triage label sync** — two-way sync triage labels (confirmed, false positive, needs retest) between Burp issues and Dark-Matter findings so triage state never diverges.
0024. **Comment thread sync** — sync Burp issue comments with Dark-Matter finding notes chronologically so discussion history stays unified across tools.
0025. **Target analyzer import** — import Burp Target Analyzer metrics (dynamic URLs, parameters, forms) to weight Dark-Matter's attack-surface scoring.
0026. **Burp crawler merge** — merge Burp's crawler-discovered content into Dark-Matter's asset graph with crawl-depth metadata to avoid re-crawling the same paths.
0027. **Engagement tool bridging** — expose Burp engagement tools (Discover Content, Schedule Task) as callable Dark-Matter actions so hunts can invoke them programmatically.
0028. **Sequencer analysis import** — import Burp Sequencer token-entropy results to flag weak session IDs and CSRF tokens as findings with statistical evidence.
0029. **CSRF PoC pairing** — pair each CSRF-class finding with Burp's generated CSRF PoC HTML so the report ships a one-click reproducible proof.
0030. **Clickbandit script sync** — sync Clickbandit clickjacking scripts with Dark-Matter's UI-redressing findings so PoCs render in the victim-context preview.
0031. **Collaborator payload tagging** — tag every Collaborator payload with hunt ID, finding ID, and timestamp so interactions attribute to the exact test that caused them.
0032. **BCheck import** — import community BChecks into Dark-Matter as executable checks with their metadata preserved for provenance.
0033. **Finding-to-BCheck generation** — auto-generate a BCheck script from each confirmed finding so the check becomes reusable in every future Burp scan.
0034. **Macro recording export** — export Dark-Matter's recorded login sequences as Burp macros so Burp session handling replays the identical flow.
0035. **Session macro sync** — keep Burp session-handling macros and Dark-Matter auth playbooks version-synced so credential rotations update both at once.
0036. **Cookie jar import** — import Burp's cookie jar into Dark-Matter's session store so automation reuses tokens the manual tester already harvested.
0037. **Upstream proxy chaining** — chain Dark-Matter's traffic through Burp as an upstream proxy with per-hunt proxy profiles so egress stays auditable.
0038. **TLS certificate sync** — sync Burp's CA certificate into Dark-Matter's trust store so intercepted TLS sessions validate without manual cert installation.
0039. **Client certificate provisioning** — provision client-side certificates from Dark-Matter's vault into Burp's TLS settings so mTLS targets work in both tools.
0040. **One-click hunt launcher** — add a Burp context-menu action that launches a Dark-Matter hunt scoped to the selected request's host with one click.
0041. **Severity override propagation** — propagate manual severity overrides from Burp issues to Dark-Matter risk scores so analyst judgment wins over automation.
0042. **Burp Enterprise bridge** — bridge Burp Suite Enterprise scheduled scans into Dark-Matter hunt timelines so enterprise and autonomous results merge.
0043. **Enterprise report ingestion** — ingest Burp Enterprise scan reports and map their issue types onto Dark-Matter's taxonomy for unified reporting.
0044. **Scan config profile sync** — sync Burp Scanner configuration profiles (crawl limits, audit phases) with Dark-Matter hunt profiles so scans behave identically.
0045. **Crawl optimization import** — import Burp's crawl-optimization settings to cap Dark-Matter's crawler the same way and avoid overwhelming fragile targets.
0046. **Audit item filtering** — sync Burp audit-item enable/disable lists with Dark-Matter's check toggles so out-of-scope check classes stay off everywhere.
0047. **Insertion point sharing** — share Burp insertion-point configurations (parameter locations, header injection points) with Dark-Matter's fuzzer to align coverage.
0048. **Intruder result ingestion** — ingest Burp Intruder attack results with response-length/status clustering so Dark-Matter can promote anomalous rows to findings.
0049. **Payload position markup** — sync Intruder payload-position markers (§...§) with Dark-Matter's fuzz markers so positions transfer losslessly between tools.
0050. **Grep-extract import** — import Burp grep-extract rules into Dark-Matter's response parser so both tools pull the same tokens from responses.
0051. **Grep-match promotion** — auto-promote Burp grep-match hits that correlate with Dark-Matter probes into candidate findings for analyst review.
0052. **Logger-style ingestion** — ingest Burp Logger++-format extended logs into Dark-Matter's traffic store for full-fidelity request replay.
0053. **Turbo Intruder library** — maintain a shared Turbo Intruder script library (race conditions, smuggling) callable from Dark-Matter hunts with one parameter set.
0054. **Param Miner data exchange** — exchange Param Miner-discovered unlinked parameters with Dark-Matter's param miner so neither tool re-discovers the same params.
0055. **Autorize verdict import** — import Autorize authorization-test verdicts as AuthZ evidence so IDOR/BOLA findings carry the extension's bypass proof.
0056. **JS discovery merge** — merge JS-link-finder-style discovered endpoints from Burp extensions into Dark-Matter's API discovery queue.
0057. **Backslash scanner import** — import backslash-powered-scanner header findings into Dark-Matter's header-security checks with dedup against native checks.
0058. **Collaborator server self-host** — support a self-hosted private Collaborator server per tenant so OOB data never leaves the customer's infrastructure.
0059. **Private Collaborator namespacing** — namespace private Collaborator payloads per customer so interactions can't leak across tenants on shared infrastructure.
0060. **Adaptive polling intervals** — tune Collaborator polling intervals based on interaction arrival rates to cut API calls during quiet periods and catch bursts fast.
0061. **Site map snapshot diffing** — diff Burp site-map snapshots across hunts to detect new endpoints, removed pages, and changed parameters as regression signals.
0062. **Baseline project comparison** — compare each hunt against a baseline Burp project to highlight attack-surface drift before testing begins.
0063. **Finding lifecycle sync** — sync finding lifecycle states (new, triaged, reported, fixed, retested) with Burp issue states bidirectionally.
0064. **Retest request generation** — generate a Burp Repeater retest bundle for every fixed finding so analysts verify remediation in one click.
0065. **Saved item evidence export** — export Burp saved items linked to a finding as an evidence bundle attached to the PDF report.
0066. **Message editor presets** — sync Dark-Matter's request templates as Burp message-editor presets for consistent manual retesting.
0067. **API key rotation** — rotate Burp REST API keys automatically on a schedule and update Dark-Matter's vault without breaking in-flight syncs.
0068. **Extension version pinning** — pin the sync extension to tested Burp versions and block auto-updates during active hunts to avoid mid-hunt breakage.
0069. **User options templating** — template Burp user-options JSON per hunt profile (timeouts, threads, scope) so every hunt starts from a known-good config.
0070. **Scan window sync** — sync allowed scan windows from bounty program policies into Burp's scheduled tasks so Burp never scans outside permitted hours.
0071. **Live task status bridge** — bridge Burp's live-task execution status into the hunt activity feed so users watch Burp-side progress in real time.
0072. **New-subdomain scan trigger** — trigger a Burp active scan automatically when Dark-Matter discovers a new in-scope subdomain during a hunt.
0073. **Scope change webhooks** — emit webhooks when Burp target scope changes so Dark-Matter pauses tests that just fell out of scope within seconds.
0074. **Finding push to Burp** — push Dark-Matter findings into Burp's issue list with full request/response evidence so Burp remains the single triage surface.
0075. **Burp issue PDF attach** — attach Burp's native issue export PDF to the corresponding Dark-Matter finding for dual-format evidence.
0076. **Payload interaction dashboard** — stream Collaborator interaction events into a live dashboard feed filtered by hunt so analysts watch OOB callbacks arrive.
0077. **DNS evidence attachment** — attach raw DNS interaction logs from Collaborator to findings as tamper-evident OOB proof.
0078. **Burp Drive config sync** — sync Burp's scan configuration for drive-by-download detection with Dark-Matter's malware-adjacent checks.
0079. **Cache deception profile** — share a web-cache-deception scan profile between Burp Scanner and Dark-Matter so both probe the same cache keys.
0080. **GraphQL config exchange** — exchange GraphQL scan configurations (introspection queries, depth limits) between Burp and Dark-Matter's API tester.
0081. **API definition import** — import API definitions captured by Burp into Dark-Matter's API discovery engine for endpoint enumeration.
0082. **OpenAPI spec sync** — keep OpenAPI specs synchronized between Burp's API scan input and Dark-Matter's spec-driven tester.
0083. **WebSocket history import** — import Burp's WebSocket message history into Dark-Matter's WebSocket fuzzer with message-direction metadata.
0084. **WebSocket intercept sync** — sync WebSocket intercept rules between Burp and Dark-Matter so manual message edits replay in automation.
0085. **Mobile assistant bridge** — bridge Burp Mobile Assistant traffic captures into Dark-Matter's mobile-backend hunt pipeline.
0086. **Proxy history search sharing** — share saved Burp proxy-history search queries with Dark-Matter's traffic analytics for consistent filtering.
0087. **Saved filter sync** — sync Burp's saved display filters with Dark-Matter's traffic views so analysts see the same slices in both tools.
0088. **Task scheduler import** — import Burp's scheduled tasks into Dark-Matter's hunt scheduler to consolidate recurring scan definitions.
0089. **REST token vault** — store Burp REST API tokens in Dark-Matter's encrypted vault with per-target access scoping.
0090. **Enterprise folder mapping** — map Burp Enterprise's site-folder structure onto Dark-Matter's target groups so reporting hierarchies match.
0091. **Scan config audit log** — log every Burp scan-configuration change with actor and timestamp for compliance-grade audit trails.
0092. **Extension crash recovery** — detect Burp extension crashes via missed heartbeats and auto-reinstall plus resume sync from the last checkpoint.
0093. **Traffic retention policy** — enforce per-hunt Burp traffic sample retention policies so evidence storage stays within quota without manual cleanup.
0094. **Evidence packet bundle** — export a finding's full request packet bundle (original, replayed, OOB) from Burp as a signed evidence archive.
0095. **SSO session sharing** — share single-sign-on session tokens between Burp's browser and Dark-Matter's authenticated crawler so both inherit the same login.
0096. **Burp Suite DAST gating** — gate CI pipelines on Burp Enterprise DAST results pulled through Dark-Matter so builds fail on new criticals only.
0097. **Issue deduplication service** — run a central dedup service that merges Burp Scanner, Burp manual, and Dark-Matter findings on canonical request fingerprints.
0098. **Burp scan cost metering** — meter Burp Suite Enterprise scan-minutes per hunt so multi-tenant billing attributes DAST spend accurately.
0099. **Collaborator payload firewall** — filter Collaborator-bound payloads through an allowlist of OOB techniques per program policy so aggressive callbacks never fire on sensitive targets.
0100. **Burp state snapshot** — snapshot Burp's project state (scope, issues, history cursors) before each hunt so interrupted syncs resume exactly where they stopped.
0101. **Finding-to-Nuclei template generator** — auto-generate a valid Nuclei YAML template from each confirmed finding (request, matchers, extractors) so the vulnerability becomes a regression check in one click.
0102. **Curated template packs per target type** — bundle technology-specific template packs (WordPress, Laravel, Spring, Next.js) selected by fingerprint so hunts run only relevant checks and finish faster.
0103. **Template fuzzing engine** — mutate template payloads, matchers, and paths with grammar-aware fuzzing to discover bypass variants that the original template misses.
0104. **Private template registry** — host a private, access-controlled Nuclei template registry per tenant with versioning so proprietary checks stay secret while staying distributable.
0105. **Nuclei severity normalization** — map Nuclei severity labels onto Dark-Matter's risk taxonomy with per-program overrides so platform reports show consistent severities.
0106. **Template execution sandboxing** — run untrusted community templates in a network-egress-controlled sandbox so a malicious template can't exfiltrate data or pivot.
0107. **Matcher DSL translation** — translate Dark-Matter's internal match conditions into Nuclei matcher DSL automatically so any detection rule becomes a portable template.
0108. **Template reverse engineering** — convert a confirmed finding's request/response pair back into a minimal Nuclei template for regression scanning of the same flaw class.
0109. **Asset-tier scan scheduling** — schedule Nuclei scans per asset tier (critical hosts hourly, the rest daily) so high-value targets get fresher coverage.
0110. **Template update diff review** — diff community template updates before auto-applying and flag behavior changes (new payloads, wider paths) for analyst approval.
0111. **Template linting pipeline** — lint every custom template for YAML validity, matcher correctness, and destructive-payload markers before it can run in production hunts.
0112. **Nuclei config templating** — generate nuclei config files per hunt profile (threads, timeouts, retries, exclusions) from a single source of truth.
0113. **Exclusion tag sync** — sync program out-of-scope tags with Nuclei exclusion filters so disallowed checks never execute against restricted assets.
0114. **Nuclei workflow chaining** — chain Nuclei workflows so the output of a discovery template (e.g., admin panel found) feeds as input to exploitation templates.
0115. **Template authoring assistant** — guide analysts through template authoring with a form that emits valid YAML, test harnesses, and documentation stubs.
0116. **Nuclei dedup service** — dedup Nuclei results against existing Dark-Matter findings on canonical request fingerprints so reruns don't recreate closed issues.
0117. **Template performance profiling** — profile each template's runtime and request count per asset so slow outliers get optimized or quarantined.
0118. **Slow template quarantine** — automatically quarantine templates exceeding runtime budgets and alert the author with the offending profile data.
0119. **Collaborator OAST templates** — generate Nuclei templates wired to Burp Collaborator for out-of-band detection with per-finding interaction correlation.
0120. **Private OOB callbacks** — route Nuclei interactsh-style callbacks through a private OOB server so blind-detection data never transits public infrastructure.
0121. **Template version pinning** — pin template packs to tested versions per hunt so a bad upstream update can't silently change results mid-engagement.
0122. **Pack rollback** — roll back to the last-known-good template pack in one action when a new pack causes false-positive spikes.
0123. **CVE-to-template synthesis** — synthesize draft Nuclei templates automatically from new CVE disclosures affecting the target's fingerprinted stack.
0124. **NVD feed ingestion** — ingest NVD feeds daily and generate candidate templates for CVEs matching the customer's technology inventory.
0125. **Template coverage gaps** — report which asset technologies lack template coverage so analysts know exactly where custom templates are needed.
0126. **Asset-type auto-selection** — auto-select the template subset per asset from its fingerprint so a static site never runs database-exploitation templates.
0127. **Fingerprint-driven subsets** — build per-target template subsets from Wappalyzer-style fingerprints refreshed at hunt start.
0128. **Scan sharding** — shard large Nuclei scans across worker nodes by asset so thousand-host scopes finish in parallel.
0129. **Distributed runner pool** — maintain a pool of Nuclei runner containers with queue-based dispatch and per-runner health checks.
0130. **Result streaming** — stream Nuclei findings as JSONL events instead of batch output so triage starts while the scan still runs.
0131. **JSONL normalization** — normalize Nuclei JSONL output into Dark-Matter's finding schema with template-ID provenance on every record.
0132. **Tag taxonomy mapping** — map Nuclei template tags onto Dark-Matter's vulnerability taxonomy for unified filtering and reporting.
0133. **False-positive quarantine list** — maintain a per-tenant list of templates with chronic false positives and auto-skip them with a logged reason.
0134. **Community trust scoring** — score community templates by author history, test coverage, and FP rate so hunts prefer trustworthy checks.
0135. **Template signature verification** — verify cryptographic signatures on templates from the private registry before execution to block tampering.
0136. **AI template validation** — execute AI-generated templates in an isolated validation sandbox against a fixture app before promoting them to production.
0137. **Destructive payload flagging** — statically flag templates containing destructive payloads (DROP, rm, format) and require explicit approval per program.
0138. **Intrusive tagging** — tag templates as intrusive or non-intrusive from static analysis so safe-mode hunts auto-exclude the intrusive set.
0139. **Scan window enforcement** — enforce per-program scan windows on Nuclei execution so scans pause outside permitted hours automatically.
0140. **Rate-limit-aware throttling** — throttle Nuclei request rates dynamically when the target returns 429s so scans back off instead of getting blocked.
0141. **Interactsh integration** — integrate self-hosted interactsh for Nuclei OOB templates with per-hunt correlation IDs for interaction attribution.
0142. **Correlation ID tracking** — tag every OOB payload with hunt and template correlation IDs so callbacks attribute to the exact test.
0143. **Self-hosted interactsh** — deploy a self-hosted interactsh server per tenant so OOB interaction data stays inside customer infrastructure.
0144. **Headless requirement flagging** — flag templates requiring headless browsers at schedule time so the runner pool provisions browser-capable workers.
0145. **Headless orchestration** — orchestrate headless-browser Nuclei templates with isolated browser contexts per scan to prevent cross-target state leaks.
0146. **Screenshot evidence capture** — capture screenshots from headless template executions and attach them as visual evidence to findings.
0147. **Business-logic templates** — support multi-step business-logic Nuclei templates (add-to-cart → checkout → price tamper) with session state across requests.
0148. **Chained workflows** — build login-then-exploit Nuclei workflows where an auth template's session token feeds subsequent exploit templates.
0149. **Session reuse** — reuse authenticated sessions across templates within a scan to cut login overhead and avoid account lockouts.
0150. **Credential vault integration** — inject scan credentials from Dark-Matter's vault into Nuclei authenticated templates without exposing secrets in configs.
0151. **Environment variable injection** — inject per-hunt environment variables (API keys, tokens) into template execution contexts securely.
0152. **Secret redaction** — redact secrets from Nuclei template output and logs using the vault's known-secret patterns before storage.
0153. **Exploit-DB enrichment** — enrich Nuclei CVE findings with linked Exploit-DB entries and Metasploit modules for impact assessment.
0154. **MITRE mapping** — map Nuclei template tags to MITRE ATT&CK techniques so findings feed threat-model views.
0155. **Scan cost estimator** — estimate Nuclei scan cost in time and requests before launch from template count and asset count so users approve expensive scans knowingly.
0156. **Template dry-run** — dry-run templates against a mock target to validate matchers and extractors before they touch real assets.
0157. **Debug log retention** — retain per-finding Nuclei debug logs with the evidence bundle so analysts can audit exactly what the template did.
0158. **Failure triage feed** — feed template execution failures (timeouts, parse errors) into a triage queue with the failing template version attached.
0159. **Scan resume** — resume interrupted Nuclei scans from per-template checkpoints instead of restarting the whole pack.
0160. **Checkpoint execution** — checkpoint template execution state per asset so worker crashes lose minutes, not hours.
0161. **Offline pack bundling** — bundle template packs with all dependencies for offline/air-gapped runner deployment.
0162. **Air-gapped deployment** — support fully air-gapped Nuclei runners with sneakernet pack updates and signed manifests.
0163. **Template marketplace** — run an in-product marketplace where hunters publish, rate, and install Nuclei templates without leaving Dark-Matter.
0164. **Community ratings** — let hunters rate templates on accuracy and safety so the best community checks surface first.
0165. **Template author bounties** — pay template authors micro-bounties when their template finds confirmed vulnerabilities in production hunts.
0166. **Contribution workflow** — provide a pull-request-style contribution workflow for community templates with automated testing gates.
0167. **Regression comparison** — compare Nuclei results across time per asset to detect newly introduced vulnerabilities as regressions.
0168. **Delta-only scans** — run delta scans with only new or changed templates since the last run for fast continuous monitoring.
0169. **httpx prefilter pipeline** — prefilter targets through httpx (live, title, tech) before Nuclei so dead hosts never consume scan budget.
0170. **Result confidence scoring** — score Nuclei findings by matcher strength, template trust, and corroborating evidence to prioritize triage.
0171. **Template overlap detection** — detect overlapping templates that test the same flaw and skip redundancies to cut scan time.
0172. **Per-program scan policy** — enforce per-bounty-program Nuclei policies (allowed tags, intrusiveness, rate limits) automatically at schedule time.
0173. **Scope allowlisting** — allowlist Nuclei templates per program scope so checks only run against explicitly in-scope asset classes.
0174. **SARIF conversion** — convert Nuclei output to SARIF so results import into GitHub code scanning and other SARIF consumers.
0175. **Draft bounty reports** — auto-draft bounty platform reports from Nuclei findings with template evidence pre-attached for analyst review.
0176. **Evidence bundling** — bundle per-finding evidence (requests, responses, template YAML, logs) into a signed archive for audit.
0177. **Template attribution** — attribute every finding to the exact template name and version that produced it for reproducibility.
0178. **Author credit** — credit template authors in reports when their template found the vulnerability, driving marketplace participation.
0179. **Config drift detection** — detect drift between scheduled Nuclei configs and actual runner configs and alert on unauthorized changes.
0180. **Runner fleet management** — centrally manage the Nuclei runner fleet (versions, packs, health) from one control plane.
0181. **Autoscaling runners** — autoscale runner count on queue depth so scan backlogs clear without manual intervention.
0182. **Priority queues** — route urgent rescans through priority queues ahead of routine scheduled scans.
0183. **Canary deployment** — canary new templates on a single asset and require clean results before fleet-wide rollout.
0184. **Webhook fan-out** — fan out Nuclei result events to webhooks per severity so downstream systems react in real time.
0185. **Template metadata search** — index template metadata (tags, authors, CVEs, targets) for instant search when building custom packs.
0186. **Scan SLA tracking** — track scan completion SLAs per asset tier and alert when scans miss their windows.
0187. **Execution timeout policies** — enforce per-template execution timeouts so one hung check can't stall an entire scan.
0188. **Memory limits** — cap memory per template execution to contain runaway matchers on huge responses.
0189. **Egress control** — restrict template network egress to target scope plus approved OOB servers so templates can't phone home.
0190. **Proxy chaining** — route Nuclei scans through configurable proxy chains for geo-distributed or anonymized testing.
0191. **Authenticated proxy** — support authenticated upstream proxies for Nuclei scans in corporate egress environments.
0192. **Tor routing option** — optionally route Nuclei scans through Tor for blocklist-evasion testing with clear audit logging.
0193. **Geo-aware execution** — execute region-specific templates from runners in matching geographies to test geo-fenced behavior.
0194. **Multilingual normalization** — normalize non-English Nuclei template metadata and matcher output into the reporting language automatically.
0195. **Deprecation lifecycle** — manage template deprecation with sunset dates, replacements, and migration notices to pack maintainers.
0196. **Scan audit trail** — keep an immutable audit trail of every Nuclei scan (who, what pack, what scope, when) for compliance.
0197. **Change approval workflow** — require analyst approval for template pack changes above a risk threshold before they reach production.
0198. **Integration health checks** — run synthetic Nuclei scans against a canary target to prove the whole pipeline works end to end.
0199. **Pack SBOM** — generate a software bill of materials for each template pack so customers can audit what's running against their assets.
0200. **Result archival** — archive Nuclei results with retention policies per tenant so historical evidence stays queryable without unbounded growth.
0201. **ZAP API orchestration** — drive OWASP ZAP entirely through its API (spider, active scan, alerts) from hunt playbooks so ZAP becomes a headless engine inside Dark-Matter.
0202. **ZAP spider control** — tune ZAP's traditional and AJAX spiders per target (depth, thread count, exclusions) from hunt profiles and merge discovered URLs automatically.
0203. **ZAP scan policy sync** — sync ZAP scan policies (strength, threshold per rule) with Dark-Matter's check toggles so both engines respect the same aggressiveness.
0204. **ZAP alert normalization** — normalize ZAP alerts into Dark-Matter's finding schema with ZAP rule-ID provenance and dedup against native findings.
0205. **ZAP context import/export** — export Dark-Matter scope and auth as ZAP contexts and re-import ZAP context edits so authentication config stays in sync.
0206. **ZAP session persistence** — persist ZAP sessions per hunt in the evidence store so scans resume after restarts without losing spider state.
0207. **ZAP auth script sync** — sync ZAP authentication and session-management scripts with Dark-Matter's auth playbooks so credential changes update both.
0208. **ZAP automation plans** — generate ZAP automation-framework YAML plans from hunt profiles so complex ZAP jobs are reproducible and versioned.
0209. **sqlmap orchestration** — orchestrate sqlmap runs from injection candidates with automatic technique selection and normalize its findings into Dark-Matter's schema.
0210. **sqlmap tamper selection** — auto-select sqlmap tamper scripts based on WAF fingerprint so evasion tamper chains match the actual filter in front of the target.
0211. **sqlmap risk auto-tuning** — auto-tune sqlmap risk and level per target criticality so fragile hosts get gentle probing and hardened hosts get deep tests.
0212. **sqlmap session management** — manage sqlmap session files per target so interrupted injection tests resume instead of restarting from scratch.
0213. **nmap orchestration** — orchestrate nmap scans from recon with adaptive timing templates per network so scans stay fast without tripping IDS.
0214. **NSE result normalization** — normalize Nmap Scripting Engine outputs into structured findings with script-name provenance and severity mapping.
0215. **Service fingerprint enrichment** — feed nmap service fingerprints into asset records so every open port carries versioned software identity.
0216. **nmap diffing** — diff nmap results across hunts to surface new open ports and changed banners as change-driven findings.
0217. **ffuf orchestration** — orchestrate ffuf fuzzing jobs with per-target wordlists and auto-tune threads from response times to avoid rate-limit bans.
0218. **ffuf wordlist management** — manage versioned ffuf wordlists per technology with usage stats so the best-performing lists get prioritized.
0219. **ffuf result clustering** — cluster ffuf hits by response similarity to collapse thousands of soft-404 variants into a handful of real discoveries.
0220. **gobuster orchestration** — orchestrate gobuster directory and vhost busting with result streaming into the asset graph as discoveries arrive.
0221. **nikto orchestration** — orchestrate nikto scans with tuning profiles per server type and dedup its findings against Dark-Matter's header checks.
0222. **nikto database sync** — sync nikto's vulnerability database on a schedule and alert when new checks cover the customer's stack.
0223. **dirsearch integration** — run dirsearch with per-target extensions and recursion depth, streaming discovered paths into the crawl frontier.
0224. **wfuzz orchestration** — orchestrate wfuzz for parameter and header fuzzing with payload encoders matched to the target's input handling.
0225. **whatweb ingestion** — ingest whatweb fingerprints into asset tech stacks with confidence scores to drive template and check selection.
0226. **Retire.js import** — import Retire.js vulnerable-library detections from JS analysis and correlate with CVE data for instant vulnerable-dependency findings.
0227. **wpscan orchestration** — orchestrate WPScan against WordPress targets with API-token rotation and normalize its plugin/theme findings.
0228. **wpscan token vault** — store WPScan API tokens in the vault with usage metering so enumeration quotas are shared fairly across hunts.
0229. **droopescan integration** — run droopscan against Drupal and SilverStripe targets and map its module findings to CVE entries.
0230. **joomscan integration** — run joomscan against Joomla targets and normalize version-disclosure and component findings.
0231. **testssl.sh orchestration** — orchestrate testssl.sh for deep TLS analysis and convert its cipher and protocol findings into graded TLS reports.
0232. **sslyze normalization** — normalize sslyze JSON output into TLS findings (weak ciphers, certificate issues) with per-host grading.
0233. **dnsenum integration** — run dnsenum for DNS enumeration and feed discovered records into the subdomain asset graph.
0234. **dnsrecon integration** — run dnsrecon zone-transfer and SRV enumeration attempts and record successes as information-disclosure findings.
0235. **enum4linux bridging** — bridge enum4linux SMB enumeration results into internal-network asset records with share-permission findings.
0236. **smbmap integration** — ingest smbmap share listings and flag world-writable shares as findings with permission evidence.
0237. **LDAP enumeration bridge** — bridge LDAP enumeration outputs into identity-asset records so anonymous binds become findings automatically.
0238. **SNMP scanner integration** — run SNMP community-string checks and normalize exposed OID data into information-disclosure findings.
0239. **masscan orchestration** — orchestrate masscan for internet-scale port sweeps with rate caps per ASN so large scopes scan in minutes safely.
0240. **masscan-to-nmap handoff** — hand masscan's open-port hits to nmap for service fingerprinting automatically, closing the sweep-to-detail loop.
0241. **rustscan integration** — use RustScan for fast port discovery before nmap so full TCP sweeps finish in seconds on responsive networks.
0242. **naabu orchestration** — orchestrate naabu port scans with CDN and cloud exclusions so scans skip known-safe infrastructure.
0243. **feroxbuster integration** — run feroxbuster with automatic recursion and stateful filtering for thorough content discovery on large apps.
0244. **dirb wordlist sync** — sync curated dirb wordlists with usage analytics so stale lists get retired and effective ones promoted.
0245. **gobuster vhost mode** — run gobuster vhost enumeration against discovered IPs to find virtual hosts missed by DNS enumeration.
0246. **ffuf vhost fuzzing** — fuzz virtual hosts with ffuf using subdomain wordlists and cluster responses to identify real vhosts.
0247. **subdomain takeover chaining** — chain takeover-checker results into takeover exploitation attempts only where CNAME evidence is strong.
0248. **amass chaining** — chain Amass enumeration modes (passive, active, brute) progressively so expensive active techniques run only on promising domains.
0249. **subfinder chaining** — chain subfinder passive sources with API-key rotation and merge results into the asset graph with source attribution.
0250. **shuffledns chaining** — chain shuffledns mass-resolving after brute-forcing so wildcard filtering keeps the subdomain list clean.
0251. **httpx enrichment** — enrich every discovered host via httpx (status, title, tech, TLS) before deeper testing so dead hosts never consume budget.
0252. **httpx pipeline** — build an httpx-first pipeline (resolve → probe → fingerprint → screenshot) that gates all downstream scanners on liveness.
0253. **screenshot service** — capture screenshots of all httpx-live hosts with a headless service so analysts visually triage hundreds of assets fast.
0254. **favicon hashing** — hash favicons across assets to cluster same-framework deployments and spot forgotten staging instances.
0255. **cname tracking** — track CNAME changes across hunts to catch newly dangling records the moment DNS is repointed.
0256. **certspotter integration** — ingest CertSpotter CT alerts for target domains and auto-queue new certificates' hosts for testing.
0257. **censys enrichment** — enrich assets with Censys host data (certificates, banners, geolocation) to corroborate fingerprinting.
0258. **shodan enrichment** — enrich IPs with Shodan data (open ports, vulns, tags) and flag internet-exposed admin services as findings.
0259. **fofa integration** — query FOFA for target-organization assets to catch forgotten hosts outside the declared scope.
0260. **zoomeye integration** — use ZoomEye component fingerprints to identify vulnerable software versions on external assets.
0261. **binaryedge enrichment** — enrich assets with BinaryEdge passive data for historical banner and certificate context.
0262. **onyphe integration** — ingest Onyphe threat and exposure data to prioritize externally visible critical services.
0263. **leakix integration** — query LeakIX for leaked-service detections on target infrastructure and auto-create findings.
0264. **fullhunt integration** — pull FullHunt attack-surface data for target domains to seed the asset graph with known exposures.
0265. **chaos dataset import** — import ProjectDiscovery Chaos datasets for target organizations as seed subdomains with freshness timestamps.
0266. **github subdomain mining** — mine GitHub code search for target-domain references to discover undocumented subdomains and endpoints.
0267. **wayback machine import** — import Wayback Machine URLs for target domains to discover deprecated endpoints still serving traffic.
0268. **commoncrawl import** — mine Common Crawl indexes for target-domain URLs to find endpoints no crawler reaches anymore.
0269. **urlscan.io enrichment** — enrich assets with urlscan.io scan data (technologies, requests, verdicts) for corroborating evidence.
0270. **virustotal enrichment** — check discovered URLs and files against VirusTotal to flag known-malicious infrastructure in the target's supply chain.
0271. **abuseipdb checks** — check target IPs against AbuseIPDB so compromised infrastructure gets flagged before testing begins.
0272. **greynoise filtering** — use GreyNoise to distinguish internet background-noise scanning from targeted attacker activity in logs.
0273. **otx enrichment** — enrich indicators with AlienVault OTX pulses to add threat-intel context to findings.
0274. **misp integration** — sync findings as MISP events so the customer's threat-intel platform consumes hunt output natively.
0275. **theharvester chaining** — chain theHarvester email and subdomain results into phishing-surface and asset records.
0276. **spiderfoot orchestration** — orchestrate SpiderFoot modules for OSINT enrichment with per-module enablement per engagement type.
0277. **recon-ng bridging** — bridge recon-ng marketplace modules into Dark-Matter as callable OSINT actions with result normalization.
0278. **metasploit bridging** — bridge Metasploit auxiliary scanners for service enumeration with strict non-exploitation guardrails.
0279. **nessus import** — import Nessus scan results and map plugin IDs to Dark-Matter's taxonomy with dedup against dynamic findings.
0280. **openvas orchestration** — orchestrate OpenVAS/Greenbone scans for network-layer coverage and normalize results into the finding pipeline.
0281. **acunetix import** — import Acunetix scan results with vulnerability-template mapping for customers migrating to Dark-Matter.
0282. **qualys import** — import Qualys WAS scan results and reconcile them with Dark-Matter's continuous findings.
0283. **tenable.io sync** — sync Tenable.io asset and vulnerability data so network vuln context enriches web findings.
0284. **rapid7 insightvm** — pull InsightVM vulnerability data into asset records to correlate patch state with exploitability.
0285. **wazuh integration** — feed hunt events into Wazuh for SIEM correlation with endpoint and IDS telemetry.
0286. **suricata bridging** — bridge Suricata IDS alerts during hunts to detect when testing triggers customer defenses.
0287. **snort rule export** — export detection signatures for confirmed attack patterns as Snort rules so customers can detect real exploitation.
0288. **yara rule generation** — generate YARA rules from webshell and malware-adjacent findings for customer-side hunting.
0289. **sigma rule export** — export Sigma rules for attack patterns observed during hunts so SIEMs detect them generically.
0290. **nuclei-to-zap bridging** — convert high-confidence Nuclei findings into ZAP alert filters to suppress re-detection noise.
0291. **zap-to-nuclei feedback** — feed ZAP's confirmed alerts back as Nuclei template ideas for regression coverage.
0292. **scanner result fusion** — fuse results from all orchestrated scanners with weighted voting so corroborated findings outrank single-source ones.
0293. **scanner conflict resolution** — resolve conflicting scanner verdicts (one says vulnerable, one says clean) with targeted retests and evidence comparison.
0294. **tool output normalization** — normalize every scanner's output through a single schema adapter layer so new tools plug in without pipeline changes.
0295. **scanner health dashboard** — monitor every integrated scanner's availability, version, and last-successful-run from one health dashboard.
0296. **tool version pinning** — pin scanner tool versions per hunt profile so results stay reproducible across reruns.
0297. **scanner credential vault** — store all scanner API keys and tokens in one vault with per-tool rotation schedules.
0298. **scan artifact retention** — retain raw scanner outputs per hunt with configurable retention so evidence survives finding lifecycle.
0299. **distributed scan queue** — run all scanner orchestrations through a distributed queue with priority, retry, and dead-letter handling.
0300. **scan budget enforcement** — enforce per-hunt request and time budgets across every orchestrated scanner so one tool can't exhaust the allowance.
0301. **katana orchestration** — orchestrate katana headless crawling with per-target depth and JS parsing, streaming discovered endpoints into the crawl frontier in real time.
0302. **hakrawler bridging** — bridge hakrawler's fast link extraction into the discovery pipeline for quick wins on large scopes before heavier crawlers start.
0303. **gospider integration** — run gospider for concurrent site spidering and normalize its link, JS, and subdomain outputs into asset records.
0304. **gau integration** — query gau (GetAllUrls) for target domains to harvest historical URLs from AlienVault, Wayback, Common Crawl, and URLScan in one call.
0305. **waybackurls chaining** — chain waybackurls output through live-probing so only still-serving historical URLs enter the testing queue.
0306. **paramspider integration** — run ParamSpider to mine URLs with parameters from web archives and feed them to the injection testing queue.
0307. **arjun orchestration** — orchestrate Arjun HTTP parameter discovery with stability-based threading so hidden parameters surface without destabilizing the app.
0308. **x8 integration** — use x8 for fast hidden-parameter brute-forcing and normalize its confirmed parameters into the fuzzer's target list.
0309. **unfurl integration** — parse discovered URLs with unfurl to extract encoded timestamps, IDs, and tokens as structured intelligence for testers.
0310. **dnsx orchestration** — orchestrate dnsx for mass DNS resolution with wildcard filtering so brute-forced names resolve cleanly at scale.
0311. **puredns chaining** — chain Puredns mass resolving after wordlist brute-forcing to validate candidates against trusted resolvers quickly.
0312. **gotator permutations** — generate gotator permutations from known subdomains and validate them through the DNS pipeline for typosquat-style discoveries.
0313. **alterx integration** — run alterx wordlist permutations against target domains to find dev, staging, and regional variants automatically.
0314. **ripgen integration** — use ripgen's wordlist-permutation engine for DNS brute-forcing and feed hits into the subdomain graph.
0315. **dnsgen chaining** — chain dnsgen permutations from existing subdomains into the resolver pipeline for continuous variant discovery.
0316. **assetfinder bridging** — bridge assetfinder's multi-source subdomain results into the asset graph with per-source attribution.
0317. **findomain integration** — run Findomain for fast certificate-transparency and API-based subdomain discovery with API-key rotation.
0318. **sublist3r bridging** — bridge Sublist3r search-engine enumeration results into the graph for engines other tools don't cover.
0319. **knockpy integration** — run knockpy zone-transfer and wordlist attempts against target DNS servers and record successes as findings.
0320. **altdns chaining** — chain altdns alterations with multi-resolver validation to catch subdomain variants at internet scale.
0321. **massdns orchestration** — orchestrate MassDNS for high-speed brute-force resolution with custom resolvers and wildcard detection.
0322. **crt.sh automation** — poll crt.sh continuously for new certificates matching target patterns and auto-queue fresh hosts within minutes of issuance.
0323. **certstream ingestion** — ingest CertStream's real-time certificate feed filtered by target keywords for instant new-asset detection.
0324. **bufferoverun import** — import BufferOver's TLS and DNS datasets for target domains as seed assets with freshness metadata.
0325. **c99 subdomain API** — query the c99.nl subdomain API as an additional passive source and dedup against existing assets.
0326. **anubis import** — import Anubis (jldc.me) subdomain enumeration results for targets where other passive sources are thin.
0327. **threatminer import** — import ThreatMiner passive DNS and URI data for target domains into the asset timeline.
0328. **threatcrowd import** — pull ThreatCrowd subdomain and IP associations to expand the asset graph laterally.
0329. **hackertarget API** — use HackerTarget's hosted APIs (dnslookup, reverse IP, pagelinks) as fallback enumeration when local tools are blocked.
0330. **viewdns integration** — query ViewDNS.info tools for reverse IP and IP-history data to find co-hosted assets.
0331. **dnsdumpster import** — import DNSDumpster XLSX results for target domains into the subdomain graph with record-type preservation.
0332. **spyse enrichment** — enrich assets with Spyse's internet-wide scan data for banner and certificate corroboration.
0333. **netlas integration** — query Netlas.io for target infrastructure data as an additional exposure source.
0334. **ivre bridging** — bridge IVRE scan-result databases into Dark-Matter for customers already running IVRE network scans.
0335. **nrich integration** — parse Nrich IP-enrichment output into asset records with ASN, geolocation, and port context.
0336. **asnmap integration** — map target organization names to ASNs and IP ranges via asnmap to define network-scope boundaries.
0337. **mapcidr integration** — expand and filter CIDR ranges with mapcidr so network-scope hunts generate exact target lists.
0338. **bgpview integration** — pull BGP prefix data for target ASNs to catch newly announced ranges automatically.
0339. **whoisxml API** — enrich domains with WHOISXML API data (creation date, registrar, related domains) for ownership intelligence.
0340. **whoxy integration** — use Whoxy reverse-WHOIS to find sibling domains registered by the same organization.
0341. **builtwith enrichment** — enrich assets with BuiltWith technology profiles to prioritize checks for the detected stack.
0342. **wappalyzer API** — query the Wappalyzer API for technology fingerprints on hosts where local detection is uncertain.
0343. **nerdydata search** — search NerdyData's source-code index for target-domain code snippets revealing API keys or endpoints.
0344. **publicwww search** — search PublicWWW for code snippets (analytics IDs, JS markers) shared across target properties to map related assets.
0345. **ghostproject import** — check discovered credentials against GhostProject's breach aggregation to flag password reuse on target logins.
0346. **dehashed integration** — query Dehashed for breached credentials tied to target domains to seed credential-stuffing test cases.
0347. **leakcheck API** — check target emails against LeakCheck's breach API for compromised-account intelligence.
0348. **haveibeenpwned API** — check target-domain accounts against HaveIBeenPwned (k-anonymity) to prioritize credential-based tests.
0349. **snusbase integration** — query Snusbase for breached data tied to target organizations with strict scope controls.
0350. **intelx search** — search Intelligence X for target-domain mentions in leaks, pastes, and dark-web sources.
0351. **psbdmp integration** — monitor Pastebin dumps via psbdmp for target-domain credential or config leaks.
0352. **gitguardian bridging** — bridge GitGuardian-style secret detection on target GitHub orgs to catch leaked keys before attackers do.
0353. **trufflehog orchestration** — orchestrate TruffleHog scans over target GitHub organizations and normalize verified secrets into critical findings.
0354. **gitleaks integration** — run Gitleaks on target repositories with custom rules and dedup against TruffleHog results.
0355. **github dork automation** — automate GitHub code-search dorks for target domains (passwords, keys, internal URLs) on a schedule.
0356. **gitlab search integration** — search target GitLab instances for exposed secrets and internal references with token-scoped access.
0357. **bitbucket mining** — mine target Bitbucket workspaces for leaked credentials and hardcoded endpoints.
0358. **sourcegraph search** — use Sourcegraph to search target organizations' public code for secret patterns at scale.
0359. **grep.app search** — query grep.app for target-domain secret patterns across public repositories instantly.
0360. **sherlock integration** — run Sherlock username enumeration for target brand handles to map social and developer account exposure.
0361. **maigret integration** — run Maigret's deeper username search to profile employee account reuse across platforms.
0362. **holehe integration** — use Holehe to check target-domain emails against account-existence oracles for user-enumeration intelligence.
0363. **emailrep enrichment** — enrich discovered emails with EmailRep reputation data to prioritize high-value phishing-surface accounts.
0364. **hunter.io integration** — use Hunter.io to discover employee email patterns for the target organization within scope rules.
0365. **clearbit enrichment** — enrich target company records with Clearbit firmographics for engagement scoping.
0366. **censys search API** — query Censys Search for certificates and hosts tied to the target org to seed external assets.
0367. **shodan search API** — query Shodan for target-org netblocks and hostnames with API-credit metering per hunt.
0368. **fofa search API** — query FOFA's search API for target-organization assets with query templates per engagement.
0369. **zoomeye search API** — query ZoomEye for component fingerprints on target infrastructure.
0370. **binaryedge search** — query BinaryEdge's datastream for target-domain historical records.
0371. **leakix search API** — query LeakIX's API for service misconfigurations on target infrastructure on every hunt start.
0372. **onyphe search API** — query Onyphe for target-domain exposure data with API-key rotation.
0373. **fullhunt API** — pull FullHunt's attack-surface API for target domains as a pre-hunt seeding step.
0374. **chaos API** — query the Chaos bug-bounty dataset API for in-scope program assets automatically.
0375. **securitytrails API** — enrich domains with SecurityTrails historical DNS and WHOIS for asset timeline context.
0376. **riskiq illuminate** — pull RiskIQ Illuminate infrastructure links to map attacker-adjacent assets for the target org.
0377. **passivetotal API** — query RiskIQ PassiveTotal for passive DNS and certificate overlaps on target domains.
0378. **urlscan search API** — search urlscan.io for historical scans of target domains to harvest old endpoints and technologies.
0379. **virustotal API** — check discovered files and URLs against VirusTotal with quota-aware batching.
0380. **otx directconnect** — stream AlienVault OTX pulses relevant to the target's stack into the threat-context panel.
0381. **misp sync** — two-way sync findings with MISP (events out, sightings in) so threat intel and hunt output reinforce each other.
0382. **opencti connector** — push findings into OpenCTI as vulnerabilities linked to target infrastructure observables.
0383. **thehive integration** — create TheHive cases from critical findings with observables pre-populated for SOC handoff.
0384. **cortex analyzers** — trigger Cortex analyzers on finding observables (IP, domain, hash) for automated enrichment.
0385. **shuffle SOAR** — trigger Shuffle SOAR workflows on critical findings for automated containment playbooks.
0386. **n8n workflows** — expose hunt events to n8n so customers build custom no-code automation on findings.
0387. **tines integration** — send finding events to Tines stories for no-code triage automation.
0388. **torq integration** — trigger Torq remediation workflows from confirmed findings with evidence attached.
0389. **demisto/xsoar** — push findings into Cortex XSOAR incidents with full evidence for enterprise SOC pipelines.
0390. **splunk SOAR** — create Splunk SOAR (Phantom) containers from critical findings for automated response playbooks.
0391. **chronicle bridging** — bridge findings into Google Chronicle as curated detections for threat hunting.
0392. **sentinel integration** — push findings to Microsoft Sentinel incidents with entity mappings for SOC triage.
0393. **qradar offense sync** — create QRadar offenses from critical findings with offense-source tagging.
0394. **logrhythm alarms** — raise LogRhythm alarms from high-severity findings for on-prem SIEM customers.
0395. **arcsight ESM** — forward findings as ArcSight ESM events with CEF formatting for legacy SIEM estates.
0396. **rsa netwitness** — push findings into RSA NetWitness as meta-enriched events for network-context correlation.
0397. **exabeam** — feed findings into Exabeam's timeline engine for user-entity behavior correlation.
0398. **darktrace bridging** — bridge Dark-Matter's external findings with Darktrace's internal anomaly view for customers running both.
0399. **vectra integration** — correlate findings with Vectra attacker-behavior detections for prioritized response.
0400. **extrahop integration** — enrich findings with ExtraHop network-transaction evidence for packet-level proof.
0401. **HackerOne program discovery** — sync HackerOne's program directory into Dark-Matter so hunters browse and enroll in programs without leaving the platform.
0402. **HackerOne scope sync** — import HackerOne program scopes (in-scope assets, out-of-scope exclusions, rules) and auto-apply them as hunt boundaries.
0403. **HackerOne scope change detection** — poll program scopes for changes and pause affected hunts within minutes when assets move out of scope.
0404. **HackerOne draft submission** — auto-draft HackerOne reports from confirmed findings with severity, weakness, and evidence pre-filled for one-click submit.
0405. **HackerOne report state sync** — sync report states (new, triaged, resolved, duplicate) back into Dark-Matter so finding lifecycles mirror the platform.
0406. **HackerOne bounty tracking** — track awarded bounties per finding and per hunter so earnings attribute accurately across the team.
0407. **HackerOne signal analytics** — analyze the hunter's HackerOne signal history to recommend programs where their skills historically pay best.
0408. **HackerOne reputation sync** — surface the hunter's HackerOne reputation and percentile in Dark-Matter to contextualize their triage authority.
0409. **HackerOne asset sync** — import HackerOne's asset inventory for enrolled programs so hunts start from the platform's canonical asset list.
0410. **HackerOne policy import** — import program disclosure policies and safe-harbor terms so hunts enforce testing constraints automatically.
0411. **HackerOne bounty table mapping** — map program bounty tables onto Dark-Matter severity suggestions so expected payouts guide prioritization.
0412. **HackerOne duplicate prediction** — predict duplicate likelihood by comparing findings against the program's disclosed report patterns before submission.
0413. **HackerOne collaboration** — support HackerOne's report collaboration by syncing comments between platform threads and Dark-Matter notes.
0414. **HackerOne mediation tracking** — track reports in HackerOne mediation with timeline reminders so hunters respond before deadlines lapse.
0415. **HackerOne retest requests** — trigger HackerOne retest requests from Dark-Matter when a fix is verified locally, closing the loop automatically.
0416. **HackerOne thanks sync** — import HackerOne thanks and bonuses into hunter earnings records for complete compensation tracking.
0417. **HackerOne leaderboard** — show program leaderboard positions inside Dark-Matter so hunters see their standing while they work.
0418. **HackerOne invite sync** — surface private program invitations in Dark-Matter with one-click accept and scope import.
0419. **HackerOne API rate management** — manage HackerOne API rate limits centrally with backoff and queuing so bulk syncs never get throttled.
0420. **HackerOne webhook ingestion** — ingest HackerOne webhooks (report state changes, bounty awarded) for real-time lifecycle updates.
0421. **HackerOne severity alignment** — align Dark-Matter severities with HackerOne's severity guidance per program so submissions match triager expectations.
0422. **HackerOne weakness mapping** — map findings to HackerOne's weakness taxonomy automatically so reports categorize correctly on submit.
0423. **HackerOne CVSS calculator** — pre-fill HackerOne's CVSS calculator inputs from finding evidence so scores are consistent and defensible.
0424. **HackerOne impact statements** — generate program-tailored impact statements from finding evidence that match each program's bounty-table language.
0425. **HackerOne attachment upload** — upload PoC videos, packet captures, and screenshots as HackerOne report attachments directly from evidence bundles.
0426. **HackerOne structured scope** — parse HackerOne's structured scope (asset types, identifiers) into typed Dark-Matter targets with per-type rules.
0427. **HackerOne gold-standard sync** — sync HackerOne's gold-standard program requirements so hunts meet the quality bar private programs demand.
0428. **HackerOne hacktivity feed** — monitor Hacktivity for target-program disclosures to learn which bug classes triagers currently reward.
0429. **HackerOne disclosure assist** — assist with HackerOne's disclosure workflow by packaging agreed disclosures with timelines and redactions.
0430. **HackerOne program stats** — surface program response times and bounty stats in Dark-Matter so hunters pick programs with the best ROI.
0431. **HackerOne team sync** — sync HackerOne team memberships and roles so multi-hunter squads share scope and earnings correctly.
0432. **HackerOne payment tracking** — track HackerOne payouts from awarded to paid so hunters reconcile earnings without spreadsheet work.
0433. **HackerOne tax documents** — aggregate HackerOne earnings into tax-ready summaries per jurisdiction for hunter accounting.
0434. **Bugcrowd program discovery** — sync Bugcrowd's program directory so hunters discover briefs and enroll without context switching.
0435. **Bugcrowd brief import** — import Bugcrowd briefs (targets, rewards, rules) and convert them into hunt configurations automatically.
0436. **Bugcrowd target sync** — import Bugcrowd's target groups with reward ranges so hunts prioritize by payout tier.
0437. **Bugcrowd submission drafting** — draft Bugcrowd submissions from findings with vulnerability-type mapping to Bugcrowd's taxonomy.
0438. **Bugcrowd VRT mapping** — map findings to Bugcrowd's Vulnerability Rating Taxonomy automatically for correct categorization.
0439. **Bugcrowd state sync** — sync Bugcrowd submission states (new, accepted, rejected, duplicate) into Dark-Matter finding lifecycles.
0440. **Bugcrowd bounty tracking** — track Bugcrowd monetary rewards per submission with payout-status reconciliation.
0441. **Bugcrowd points tracking** — track Bugcrowd leaderboard points and kudos so hunters see gamified progress inside Dark-Matter.
0442. **Bugcrowd researcher stats** — surface Bugcrowd researcher stats (accuracy, impact) to guide which programs fit the hunter's strengths.
0443. **Bugcrowd private invites** — surface Bugcrowd private program invitations with brief import on accept.
0444. **Bugcrowd managed scope** — sync Bugcrowd Managed (NG) customer scopes for hunters on managed engagements.
0445. **Bugcrowd asset monitoring** — monitor Bugcrowd target lists for changes and re-seed hunts when customers add assets.
0446. **Bugcrowd webhook ingestion** — ingest Bugcrowd webhooks for submission state changes to update findings in real time.
0447. **Bugcrowd duplicate guard** — check new findings against Bugcrowd's known-issue patterns for the program before drafting submissions.
0448. **Bugcrowd priority mapping** — map Bugcrowd's P1–P4 priorities onto Dark-Matter severities with per-program calibration.
0449. **Bugcrowd comment sync** — sync Bugcrowd submission comments with Dark-Matter finding notes bidirectionally.
0450. **Bugcrowd retest flow** — request Bugcrowd retests from Dark-Matter after local fix verification with evidence attached.
0451. **Bugcrowd leaderboard** — display Bugcrowd leaderboard standings in Dark-Matter so hunters track rank while hunting.
0452. **Bugcrowd researcher onboarding** — guide new Bugcrowd researchers through profile setup and first-program enrollment inside Dark-Matter.
0453. **Bugcrowd API token vault** — store Bugcrowd API tokens per researcher with scoped permissions in the encrypted vault.
0454. **Bugcrowd rate limiting** — throttle Bugcrowd API calls centrally so bulk brief syncs respect platform limits.
0455. **Bugcrowd disclosure sync** — track Bugcrowd disclosure timelines and coordinate public write-ups after remediation.
0456. **Bugcrowd program analytics** — analyze Bugcrowd program response efficiency and reward density to recommend where to hunt next.
0457. **Cross-platform dedup** — dedup findings across HackerOne and Bugcrowd submissions on canonical fingerprints so the same bug isn't reported twice.
0458. **Unified bounty ledger** — maintain one ledger of earnings across HackerOne and Bugcrowd with currency normalization and payout reconciliation.
0459. **Platform report converter** — convert a drafted report between HackerOne and Bugcrowd formats so one finding serves both platforms' schemas.
0460. **Multi-platform scope merge** — merge scopes from all connected platforms into a unified target inventory with per-platform rule overlays.
0461. **Platform policy guardrails** — enforce each platform's testing policy (rate limits, forbidden techniques) automatically per hunt based on the target's program.
0462. **Submission queue** — queue drafted submissions across platforms with scheduled send times so hunters batch their reporting workflow.
0463. **Platform inbox triage** — triage platform messages (triager questions, bounty offers) inside Dark-Matter with templated replies.
0464. **Triager question assist** — draft answers to triager follow-up questions from finding evidence so responses go out in minutes.
0465. **Bounty negotiation helper** — suggest bounty renegotiation arguments from impact evidence when an award undervalues the finding.
0466. **Platform reputation dashboard** — show combined reputation across HackerOne and Bugcrowd with trend lines and percentile context.
0467. **Skill-to-program matcher** — match the hunter's historical finding types to programs currently paying premiums for those classes.
0468. **Program launch alerts** — alert hunters when new programs launch on connected platforms that match their skill profile.
0469. **Scope expansion alerts** — notify hunters when an enrolled program expands scope so new assets get hunted immediately.
0470. **Bounty increase alerts** — alert when programs raise bounties or add bonus multipliers so hunters reprioritize accordingly.
0471. **Platform downtime guard** — detect platform API outages and queue submissions locally until the platform recovers.
0472. **Submission receipt vault** — archive every platform submission with timestamps and receipts for dispute evidence.
0473. **Duplicate dispute assist** — assemble duplicate-dispute evidence packs (timestamps, scan logs) when a platform marks a valid report duplicate.
0474. **Report quality scoring** — score drafted platform reports against each platform's quality signals before submission to reduce needs-more-info cycles.
0475. **Auto severity justification** — attach severity justifications citing platform-specific bounty tables so triagers accept the rating faster.
0476. **PoC standardization** — standardize PoCs per platform's preferred format (video length, request dumps) from one evidence bundle.
0477. **Platform SSO** — authenticate hunters to connected platforms via OAuth so tokens refresh without manual re-entry.
0478. **Team earnings split** — split bounties across squad members by contribution with platform payout reconciliation.
0479. **Referral tracking** — track platform referral bonuses when hunters invite teammates through Dark-Matter.
0480. **Private program CRM** — manage private program relationships (contacts, scope notes, payout history) as a hunter CRM inside Dark-Matter.
0481. **Program comparison** — compare programs side by side on response time, bounty density, and scope breadth to pick the best targets.
0482. **Historical payout analysis** — analyze historical payouts per bug class per program so hunters chase the highest-EV vulnerabilities first.
0483. **Seasonal trend alerts** — alert on seasonal bounty trends (e.g., API programs paying premiums) from aggregated platform data.
0484. **New-asset-first hunting** — prioritize newly added program assets automatically since fresh scope historically yields the most novel bugs.
0485. **Stale program detection** — flag programs with dead scopes or unresponsive triagers so hunters stop wasting cycles there.
0486. **Platform API health** — monitor all connected platform APIs with synthetic calls and alert on auth or schema breakage.
0487. **Submission analytics** — analyze acceptance, duplicate, and N/A rates per platform to coach hunters on report quality.
0488. **Retest SLA tracking** — track platform retest turnaround times so hunters follow up before SLAs lapse.
0489. **Escalation assist** — draft escalation requests with full timelines when triagers go silent beyond program SLAs.
0490. **Platform changelog watch** — watch platform API changelogs and auto-adapt integrations before breaking changes take effect.
0491. **Sandbox program testing** — test the full submission pipeline against platform sandbox environments before going live.
0492. **Multi-account switching** — switch between multiple platform accounts (personal, team) with isolated tokens and audit logs.
0493. **Platform data export** — export all platform activity (submissions, earnings, messages) for personal backup and migration.
0494. **GDPR data requests** — automate platform data-export and deletion requests so hunters control their platform footprint.
0495. **Platform notification digest** — digest platform notifications (messages, state changes, payouts) into one daily summary instead of scattered emails.
0496. **Smart submission timing** — recommend submission times based on triager timezone and program activity patterns for faster triage.
0497. **Follow-up scheduler** — schedule polite follow-ups on stalled reports with escalating templates per program norms.
0498. **Bounty milestone alerts** — celebrate and log bounty milestones (first $10k, 100 accepted) to keep hunters motivated with real data.
0499. **Platform skill endorsements** — surface platform badges and achievements in the hunter profile for team credibility.
0500. **Unified hunter profile** — present one hunter profile aggregating HackerOne and Bugcrowd stats, earnings, and specialties for client-facing credibility.
0501. **Intigriti program sync** — sync Intigriti programs, scopes, and domains into Dark-Matter so European-focused hunters manage everything in one place.
0502. **Intigriti scope import** — import Intigriti's domain-based scopes with tier rules so hunts respect their domain-tier reward structure.
0503. **Intigriti submission drafting** — draft Intigriti submissions from findings mapped to their severity and category schema.
0504. **Intigriti state sync** — sync Intigriti report states (triage, accepted, closed) into Dark-Matter finding lifecycles automatically.
0505. **Intigriti bounty tracking** — track Intigriti payouts per report with invoice-status reconciliation for EU hunters.
0506. **Intigriti XSS validator** — use Intigriti's XSS challenge validator to prove payload execution before submitting XSS reports.
0507. **Intigriti leaderboard** — surface Intigriti leaderboard positions and streaks inside Dark-Matter for motivation and credibility.
0508. **Intigriti invite sync** — surface Intigriti private program invites with one-click scope import on accept.
0509. **Intigriti webhook ingestion** — ingest Intigriti webhooks for report updates so triage activity reflects instantly.
0510. **Intigriti duplicate guard** — check findings against Intigriti's program-specific duplicate patterns before drafting.
0511. **Intigriti severity mapping** — map Dark-Matter severities to Intigriti's tier system with per-program calibration data.
0512. **Intigriti retest flow** — request Intigriti retests from Dark-Matter with fix evidence attached.
0513. **Intigriti program analytics** — analyze Intigriti program responsiveness and reward density to recommend the best programs.
0514. **YesWeHack program sync** — sync YesWeHack programs and scopes for hunters targeting French and European programs.
0515. **YesWeHack scope import** — import YesWeHack scopes with their asset-type rules so hunts stay compliant.
0516. **YesWeHack submission drafting** — draft YesWeHack reports from findings in their expected format and language options.
0517. **YesWeHack state sync** — sync YesWeHack report workflow states into Dark-Matter lifecycles.
0518. **YesWeHack bounty tracking** — track YesWeHack rewards including their hunter-level bonus multipliers.
0519. **YesWeHack live hunting** — support YesWeHack's live-hunting event scopes with time-boxed hunt configurations.
0520. **YesWeHack webhook ingestion** — ingest YesWeHack webhooks for real-time report state updates.
0521. **YesWeHack duplicate guard** — pre-check findings against YesWeHack program duplicate history before submission.
0522. **YesWeHack severity mapping** — calibrate Dark-Matter severities to YesWeHack's rating expectations per program.
0523. **Synack engagement sync** — sync Synack engagement targets and rules for hunters on the Synack Red Team.
0524. **Synack target import** — import Synack's structured target lists with engagement windows so hunts only run when authorized.
0525. **Synack vulnerability drafting** — draft Synack vulnerability submissions from findings in their required evidence format.
0526. **Synack state sync** — sync Synack submission states (pending, accepted, paid) into Dark-Matter automatically.
0527. **Synack payout tracking** — track Synack payouts per vulnerability with their points and payout schedule.
0528. **Synack mission alerts** — alert hunters when Synack launches missions matching their skills and availability.
0529. **Synack webhook ingestion** — ingest Synack platform events for submission and payout updates.
0530. **Cobalt engagement sync** — sync Cobalt pentest engagements (scope, timeline, team) into Dark-Matter hunt projects.
0531. **Cobalt finding import** — import Cobalt pentest findings into Dark-Matter to unify pentest and bounty results.
0532. **Cobalt finding export** — export Dark-Matter findings into Cobalt's finding format for pentest report inclusion.
0533. **Cobalt retest tracking** — track Cobalt retest assignments from Dark-Matter with evidence linking.
0534. **Cobalt team sync** — sync Cobalt pentest team memberships so findings route to the right pentesters.
0535. **Cobalt scheduling** — surface Cobalt engagement schedules in Dark-Matter so hunters plan bounty work around pentests.
0536. **SafeHats integration** — sync SafeHats programs and scopes for hunters on the Indian platform.
0537. **BugBase integration** — sync BugBase programs for hunters targeting Indian bounty programs.
0538. **HackerOne BCH sync** — sync HackerOne's community bounty challenges so hunters practice on curated targets.
0539. **CTF platform bridge** — bridge HackTheBox and TryHackMe machine states so practice findings feed the learning engine.
0540. **PentesterLab progress** — import PentesterLab exercise progress to personalize check recommendations by demonstrated skill.
0541. **PortSwigger labs** — link Web Security Academy lab completions to finding types so hunters drill weak areas.
0542. **OWASP Juice Shop** — validate new detection checks against a local Juice Shop instance before production rollout.
0543. **DVWA regression** — run the full check suite against DVWA on every release to catch detection regressions.
0544. **bWAPP validation** — validate scanner changes against bWAPP's vulnerability catalog automatically.
0545. **XVWA checks** — cross-check detection logic against XVWA's intentionally vulnerable patterns.
0546. **Mutillidae pipeline** — run nightly detection validation against Mutillidae II for OWASP Top 10 coverage proof.
0547. **WebGoat integration** — test new auth checks against WebGoat's lesson apps before enabling them in hunts.
0548. **PyGoat validation** — validate Python-specific checks against PyGoat's vulnerable patterns.
0549. **NodeGoat validation** — validate Node.js-specific checks against NodeGoat's vulnerability set.
0550. **RailsGoat validation** — validate Ruby-on-Rails checks against RailsGoat's known flaws.
0551. **Goatlin coverage** — verify Kotlin/Java mobile-backend checks against Goatlin's patterns.
0552. **VAmPI testing** — test API vulnerability checks against VAmPI's vulnerable API catalog.
0553. **crAPI validation** — validate API security checks against OWASP crAPI's comprehensive flaw set.
0554. **Juice Shop API** — run API-focused regression tests against Juice Shop's REST endpoints.
0555. **Damn Vulnerable GraphQL** — validate GraphQL checks against DVGA's flaw catalog.
0556. **GraphQL Cop** — cross-validate GraphQL introspection checks with GraphQL Cop's detection logic.
0557. **vulnapi testing** — test REST API checks against the vulnapi project's endpoints.
0558. **SSRF lab** — validate SSRF checks against a dedicated SSRF lab environment with real cloud-metadata simulators.
0559. **XXE lab** — validate XXE detection against a lab with blind and error-based XXE fixtures.
0560. **SSTI lab** — validate template-injection checks against polyglot SSTI fixtures across engines.
0561. **Deserialization lab** — validate deserialization checks against Java, PHP, Python, and .NET fixtures.
0562. **Race condition lab** — validate race-condition detection against a purpose-built concurrent-balance lab.
0563. **IDOR lab** — validate IDOR/BOLA checks against a multi-tenant fixture API with object graphs.
0564. **OAuth lab** — validate OAuth/OIDC checks against a lab IdP with misconfiguration fixtures.
0565. **SAML lab** — validate SAML checks against a fixture IdP/SP pair with signature-bypass variants.
0566. **JWT lab** — validate JWT checks against a fixture issuer with alg-confusion and kid-injection variants.
0567. **CORS lab** — validate CORS checks against fixtures with wildcard, null-origin, and subdomain-trust variants.
0568. **CSP lab** — validate CSP-bypass checks against fixtures with weak-policy variants.
0569. **Clickjacking lab** — validate UI-redressing checks against fixtures with frame-busting variants.
0570. **Open redirect lab** — validate open-redirect checks against fixtures with allowlist-bypass variants.
0571. **Path traversal lab** — validate traversal checks against fixtures on Linux and Windows path semantics.
0572. **Command injection lab** — validate OS-command checks against fixtures with filter-evasion variants.
0573. **LDAP injection lab** — validate LDAP checks against a fixture directory with blind variants.
0574. **XPath injection lab** — validate XPath checks against fixtures with error and blind variants.
0575. **NoSQL injection lab** — validate NoSQL checks against MongoDB and Redis fixtures.
0576. **Header injection lab** — validate header-injection checks against fixtures with CRLF and cache-poisoning variants.
0577. **HTTP smuggling lab** — validate request-smuggling checks against fixtures with CL.TE and TE.CL variants.
0578. **Web cache lab** — validate cache-deception and cache-poisoning checks against a fixture CDN setup.
0579. **Prototype pollution lab** — validate prototype-pollution checks against fixtures with gadget chains.
0580. **DOM XSS lab** — validate DOM-XSS checks against fixtures with source/sink variants per framework.
0581. **PostMessage lab** — validate postMessage checks against fixtures with origin-validation variants.
0582. **WebSocket lab** — validate WebSocket checks against fixtures with CSRF and auth variants.
0583. **GraphQL lab** — validate GraphQL checks against fixtures with batching and introspection variants.
0584. **gRPC lab** — validate gRPC checks against fixtures with reflection and auth variants.
0585. **File upload lab** — validate upload checks against fixtures with polyglot and MIME-bypass variants.
0586. **XXE upload lab** — validate XXE-via-upload checks against SVG and DOCX fixtures.
0587. **ZIP slip lab** — validate archive-extraction checks against ZIP-slip fixtures.
0588. **PDF parser lab** — validate PDF-parsing checks against fixtures with XXE and JS variants.
0589. **Image parser lab** — validate image-parsing checks against polyglot and metadata fixtures.
0590. **Business logic lab** — validate logic-flaw checks against fixtures with coupon, quantity, and workflow variants.
0591. **2FA bypass lab** — validate 2FA-bypass checks against fixtures with brute-force and logic variants.
0592. **Password reset lab** — validate reset-flow checks against fixtures with token-leak and host-header variants.
0593. **Session fixation lab** — validate session-management checks against fixtures with fixation variants.
0594. **Subdomain takeover lab** — validate takeover checks against fixtures with dangling CNAME variants per provider.
0595. **Cloud misconfig lab** — validate cloud checks against fixtures with public-bucket and metadata variants.
0596. **K8s lab** — validate Kubernetes checks against a fixture cluster with RBAC-misconfig variants.
0597. **CI/CD lab** — validate pipeline checks against fixtures with secret-leak and injection variants.
0598. **Container lab** — validate container checks against fixtures with escape and misconfig variants.
0599. **IoT backend lab** — validate IoT-backend checks against fixtures with MQTT and firmware-update variants.
0600. **Mobile API lab** — validate mobile-backend checks against fixtures with cert-pinning and token variants.
0601. **GitHub issue sync** — create GitHub issues from confirmed findings with labels, milestones, and evidence so remediation tracks in the repo.
0602. **GitHub issue state sync** — sync GitHub issue open/close states back into finding lifecycles so fixed code marks findings remediated automatically.
0603. **GitHub code-scanning upload** — upload findings as GitHub code-scanning alerts via SARIF so they appear in the Security tab natively.
0604. **GitHub code-scanning sync** — sync code-scanning alert dismissals and fixes back into Dark-Matter to keep triage consistent.
0605. **GitHub Dependabot correlation** — correlate findings with Dependabot alerts on the same dependency so patch PRs reference the hunt evidence.
0606. **GitHub Actions plugin** — ship a GitHub Action that runs Dark-Matter hunts on pull requests and posts findings as PR annotations.
0607. **GitHub Actions fail gate** — fail CI builds on new critical findings with configurable severity thresholds per branch.
0608. **GitHub PR comments** — post finding summaries as PR review comments with file and line references where the flaw was introduced.
0609. **GitHub secret scanning** — feed Dark-Matter's secret-scanner hits into GitHub secret scanning partner alerts for coordinated revocation.
0610. **GitHub commit linking** — link findings to the commits that introduced them via blame data so owners get assigned automatically.
0611. **GitHub blame attribution** — attribute each finding to the introducing commit's author for precise remediation routing.
0612. **GitHub repo scoping** — define hunt scopes from GitHub repo metadata (languages, deployment URLs) so code and runtime stay linked.
0613. **GitHub org asset sync** — sync GitHub organization repositories and their deployed URLs into the target inventory.
0614. **GitHub Pages checks** — automatically test GitHub Pages sites for takeover and misconfiguration when repos go stale.
0615. **GitHub workflow scanning** — scan GitHub Actions workflows for injection and secret-exposure flaws as findings.
0616. **GitHub Codespaces** — provision Codespaces dev environments with Dark-Matter's remediation guidance pre-loaded for fixers.
0617. **GitHub Projects sync** — sync findings into GitHub Projects boards with automation rules per severity.
0618. **GitHub Discussions** — open GitHub Discussions for disputed findings so remediation debates stay near the code.
0619. **GitHub release gating** — block GitHub releases when unresolved criticals exist on the release branch.
0620. **GitHub advisory drafting** — draft GitHub Security Advisories from confirmed findings for coordinated disclosure.
0621. **GitHub private reports** — ingest GitHub's private vulnerability reports into Dark-Matter for unified triage.
0622. **GitHub token vault** — store GitHub App tokens and PATs in the vault with per-repo permission scoping.
0623. **GitLab issue sync** — create GitLab issues from findings with confidential flags and weight estimates for sprint planning.
0624. **GitLab issue state sync** — sync GitLab issue closures back into finding lifecycles so merged fixes resolve findings.
0625. **GitLab SAST import** — import GitLab SAST reports and correlate them with Dark-Matter's dynamic findings on the same code.
0626. **GitLab DAST bridging** — bridge GitLab's DAST job configuration so Dark-Matter hunts reuse its auth and site profiles.
0627. **GitLab CI plugin** — ship a GitLab CI component that runs hunts in pipelines and fails on new criticals.
0628. **GitLab MR comments** — post findings as merge-request notes with severity badges and remediation links.
0629. **GitLab dependency scanning** — correlate findings with GitLab Dependency Scanning alerts for unified patch prioritization.
0630. **GitLab container scanning** — link container-image findings to the deployed services they affect in the asset graph.
0631. **GitLab secret detection** — ingest GitLab Secret Detection results and dedup against Dark-Matter's secret scanner.
0632. **GitLab epic linking** — link related findings into GitLab epics for program-level remediation tracking.
0633. **GitLab milestone sync** — sync remediation milestones with finding SLAs so overdue fixes escalate visibly.
0634. **GitLab label taxonomy** — enforce a shared severity label taxonomy between GitLab issues and Dark-Matter findings.
0635. **GitLab token vault** — store GitLab tokens with per-group access scoping in the encrypted vault.
0636. **Bitbucket issue sync** — create Bitbucket issues from findings for Atlassian-centric teams.
0637. **Bitbucket Pipelines** — run Dark-Matter hunts in Bitbucket Pipelines with build-failure gates on criticals.
0638. **Azure DevOps boards** — sync findings into Azure Boards work items with area-path routing per service.
0639. **Azure Pipelines gate** — gate Azure Pipelines releases on Dark-Matter scan results with policy-based approvals.
0640. **Azure Repos linking** — link findings to Azure Repos commits for blame-based owner assignment.
0641. **Jira ticket sync** — create Jira issues from findings with custom fields (CVSS, CWE, evidence links) mapped per project.
0642. **Jira workflow sync** — sync Jira workflow transitions (To Do → Done) into finding lifecycles bidirectionally.
0643. **Jira SLA tracking** — track remediation SLAs in Jira with automatic escalation when findings breach fix deadlines.
0644. **Jira epic grouping** — group findings into Jira epics per hunt or per vulnerability class for program tracking.
0645. **Jira assignee routing** — route Jira tickets to service owners from CODEOWNERS-style mappings automatically.
0646. **Jira comment sync** — sync Jira comments with Dark-Matter finding notes so discussion stays unified.
0647. **Jira custom dashboards** — feed findings into Jira dashboard gadgets showing open criticals by team and age.
0648. **Jira automation rules** — trigger Jira automation (Slack alerts, escalations) from finding severity changes.
0649. **Jira token vault** — store Jira API tokens with per-project permission scoping.
0650. **Linear issue sync** — create Linear issues from findings with team routing and cycle assignment.
0651. **Linear state sync** — sync Linear workflow states into finding lifecycles so shipped fixes resolve findings.
0652. **Linear priority mapping** — map Dark-Matter severities to Linear priorities with per-team calibration.
0653. **Linear project linking** — link findings to Linear projects and initiatives for roadmap-level tracking.
0654. **Linear comment sync** — sync Linear comments with finding notes bidirectionally.
0655. **Asana task sync** — create Asana tasks from findings with project-section routing per severity.
0656. **Asana portfolio tracking** — roll findings into Asana portfolios so executives see security posture per initiative.
0657. **Asana rule triggers** — trigger Asana rules (reassignments, due dates) from finding lifecycle events.
0658. **Monday.com sync** — sync findings into monday.com boards with status-column mapping for non-technical stakeholders.
0659. **ClickUp sync** — create ClickUp tasks from findings with custom-field mapping for CVSS and evidence.
0660. **Notion ticket sync** — create Notion database entries from findings for teams tracking remediation in Notion.
0661. **ServiceNow VR sync** — sync findings into ServiceNow Vulnerability Response with assignment groups per CI.
0662. **ServiceNow ITSM** — create ServiceNow incidents from critical findings with P1 routing for emergency response.
0663. **ServiceNow change requests** — link findings to ServiceNow change requests so fixes deploy through CAB with evidence.
0664. **BMC Helix sync** — push findings into BMC Helix ITSM for enterprises on the Helix stack.
0665. **Cherwell sync** — sync findings into Cherwell service management with one-step actions for analysts.
0666. **Freshservice sync** — create Freshservice tickets from findings for mid-market IT teams.
0667. **Zendesk sync** — create Zendesk tickets from customer-impacting findings for support-linked remediation.
0668. **Trello sync** — sync findings into Trello cards with list automation per severity for lightweight teams.
0669. **Wrike sync** — create Wrike tasks from findings with folder-blueprint mapping per engagement.
0670. **Smartsheet sync** — feed findings into Smartsheet rows so PMs track remediation in sheets they already use.
0671. **Airtable sync** — sync findings into Airtable bases with linked asset tables for flexible triage views.
0672. **Coda sync** — push findings into Coda docs with formula-driven SLA calculations.
0673. **Jenkins plugin** — ship a Jenkins plugin that runs hunts post-deploy and fails builds on new criticals.
0674. **CircleCI orb** — ship a CircleCI orb for hunt steps with test-summary integration.
0675. **Travis CI** — support Travis CI hunt jobs with encrypted vault credential injection.
0676. **TeamCity plugin** — integrate hunt results into TeamCity build problems with investigation assignment.
0677. **Bamboo tasks** — run hunts as Bamboo tasks with Jira-linked build failures on criticals.
0678. **Drone CI** — run hunts as Drone pipeline steps with secret-safe configuration.
0679. **Buildkite plugin** — annotate Buildkite builds with finding summaries and block deploys on criticals.
0680. **Argo CD hooks** — run pre-sync hunts via Argo CD hooks so vulnerable images never reach the cluster.
0681. **Flux CD** — gate Flux CD reconciliations on hunt results for GitOps security.
0682. **Spinnaker pipelines** — insert hunt stages into Spinnaker deployment pipelines with manual-judgment gates on findings.
0683. **Harness STO** — feed findings into Harness Security Testing Orchestration for unified pipeline security.
0684. **Codefresh** — run hunts in Codefresh pipelines with test-report integration.
0685. **Semaphore CI** — block Semaphore promotions on new critical findings.
0686. **AppVeyor** — run Windows-target hunts in AppVeyor CI for .NET-heavy stacks.
0687. **Concourse resources** — model hunts as Concourse resources so pipelines trigger on new criticals.
0688. **Tekton tasks** — run hunts as Tekton tasks with results in task-run status for Kubernetes-native CI.
0689. **Woodpecker CI** — support Woodpecker CI hunt steps for lightweight self-hosted pipelines.
0690. **Sourcehut builds** — run hunts in Sourcehut builds with results posted to the build mailing list.
0691. **Cloud Build** — run hunts in Google Cloud Build with findings in Security Command Center.
0692. **CodeBuild** — run hunts in AWS CodeBuild with findings exported to Security Hub.
0693. **Azure DevOps pipelines** — gate Azure Pipelines with hunt results and publish findings to Advanced Security.
0694. **GitLab Auto DevOps** — inject hunt stages into GitLab Auto DevOps pipelines automatically.
0695. **Dependabot PR linking** — link Dependabot upgrade PRs to the findings they remediate for audit closure.
0696. **Renovate integration** — correlate Renovate dependency updates with vulnerable-library findings to auto-close them.
0697. **Snyk import** — import Snyk vulnerability data and correlate with Dark-Matter's runtime findings on the same services.
0698. **Snyk PR sync** — sync Snyk fix PRs with finding lifecycles so merged upgrades resolve findings.
0699. **Socket.dev import** — import Socket.dev supply-chain alerts for dependencies used by target apps.
0700. **OSV.dev correlation** — correlate findings with OSV.dev advisories for precise affected-version ranges.
0701. **Slack finding cards** — post rich Slack cards for new findings (severity color, asset, evidence link, triage buttons) so teams react without opening the app.
0702. **Slack triage actions** — handle Slack message buttons (confirm, false positive, assign) that update finding state directly from chat.
0703. **Slack hunt progress** — stream hunt progress bars into Slack threads so stakeholders watch long hunts without dashboard access.
0704. **Slack daily digest** — send a daily Slack digest of new findings, resolved counts, and hunt completions per channel subscription.
0705. **Slack critical alerts** — page Slack channels instantly on critical findings with @here mentions and evidence attachments.
0706. **Slack retest requests** — let developers request retests from Slack with one slash command after deploying fixes.
0707. **Slack scope changes** — notify Slack when hunt scope changes so everyone knows what just entered or left testing.
0708. **Slack bounty alerts** — celebrate bounty awards in Slack with payout amounts and hunter attribution for team morale.
0709. **Slack bot Q&A** — answer natural-language questions about findings in Slack (e.g., "show open criticals on api") via a bot.
0710. **Slack thread sync** — sync Slack thread replies on finding cards back into finding notes for unified discussion.
0711. **Slack channel routing** — route findings to different Slack channels by team, severity, or asset tag automatically.
0712. **Slack workflow builder** — expose finding events to Slack Workflow Builder so non-developers build custom alert flows.
0713. **Slack canvas reports** — publish weekly hunt summaries as Slack canvases with charts and top findings.
0714. **Slack Huddle alerts** — trigger Slack Huddle invitations for live war-room triage when multiple criticals land at once.
0715. **Discord finding cards** — post Discord embeds for findings with severity colors and action buttons for community hunter teams.
0716. **Discord triage reactions** — let hunters triage findings with Discord emoji reactions mapped to finding states.
0717. **Discord hunt feed** — stream live hunt events into Discord channels so distributed teams follow progress together.
0718. **Discord bounty board** — maintain a Discord bounty leaderboard channel updated automatically on awards.
0719. **Discord voice alerts** — announce critical findings in Discord voice channels via TTS for always-on ops teams.
0720. **Discord forum threads** — auto-create Discord forum threads per critical finding for structured remediation discussion.
0721. **Discord webhook fan-out** — fan out finding events to multiple Discord servers with per-server severity filters.
0722. **Discord role pings** — ping Discord roles (e.g., @backend-team) based on finding asset ownership.
0723. **Discord scheduled digests** — send scheduled Discord digests (daily, weekly) with finding stats and trends.
0724. **Discord bot commands** — expose slash commands (/hunt start, /findings open) so hunters drive Dark-Matter from Discord.
0725. **Teams adaptive cards** — post Microsoft Teams adaptive cards for findings with approve/assign actions for enterprise teams.
0726. **Teams triage actions** — handle Teams card button clicks to update finding state without leaving Teams.
0727. **Teams channel routing** — route findings to Teams channels by service ownership from the asset graph.
0728. **Teams meeting alerts** — schedule Teams meetings automatically for critical-finding war rooms with evidence pre-attached.
0729. **Teams daily digest** — deliver daily finding digests to Teams channels with trend charts.
0730. **Teams bot Q&A** — answer finding questions in Teams via a bot backed by the hunt knowledge base.
0731. **Teams Power Automate** — expose finding events to Power Automate so enterprises build custom flows without code.
0732. **Teams Shifts** — page on-call engineers via Teams Shifts integration when criticals arrive off-hours.
0733. **Google Chat cards** — post Google Chat cards for findings with triage buttons for Workspace-centric teams.
0734. **Google Chat spaces** — route findings into Google Chat spaces per team with threaded discussions.
0735. **Google Chat digest** — send scheduled finding digests to Google Chat spaces.
0736. **Mattermost posts** — post findings to self-hosted Mattermost for teams avoiding SaaS chat.
0737. **Mattermost playbooks** — trigger Mattermost playbooks on critical findings for incident-response runbooks.
0738. **Rocket.Chat alerts** — send finding alerts to Rocket.Chat with webhook-based triage actions.
0739. **Zulip streams** — route findings into Zulip streams and topics for threaded, searchable triage.
0740. **Webex cards** — post Webex adaptive cards for findings in Cisco-centric enterprises.
0741. **PagerDuty incidents** — create PagerDuty incidents from critical findings with urgency mapped from severity.
0742. **PagerDuty escalation** — escalate PagerDuty incidents automatically when findings stay unacknowledged past SLA.
0743. **PagerDuty resolve sync** — resolve PagerDuty incidents when findings are remediated and verified.
0744. **PagerDuty on-call routing** — route finding alerts to the correct PagerDuty on-call schedule by asset ownership.
0745. **PagerDuty change events** — send PagerDuty change events when hunts start so incident timelines show testing windows.
0746. **Opsgenie alerts** — create Opsgenie alerts from high-severity findings with responder teams per service.
0747. **Opsgenie escalation** — escalate Opsgenie alerts on SLA breach with finding evidence attached.
0748. **Opsgenie close sync** — close Opsgenie alerts when findings resolve so on-call noise stays accurate.
0749. **Opsgenie schedules** — page Opsgenie on-call rotations for criticals with follow-the-sun handoffs.
0750. **VictorOps bridging** — bridge critical findings into VictorOps (Splunk On-Call) timelines for legacy on-call teams.
0751. **xMatters alerts** — trigger xMatters alerts with finding context for enterprises on complex notification chains.
0752. **Everbridge** — page emergency response via Everbridge when findings indicate active exploitation.
0753. **SMS alerts** — send SMS alerts for critical findings via Twilio with short evidence links for on-call engineers.
0754. **Voice call alerts** — place automated voice calls for P1 findings so sleeping on-call engineers wake up.
0755. **Push notifications** — send mobile push notifications for assigned findings with deep links to triage views.
0756. **Email digest engine** — generate personalized email digests (new findings, SLA risks, hunt completions) per recipient role and schedule.
0757. **Critical email alerts** — send immediate rich-HTML emails for critical findings with evidence inline for executives.
0758. **Weekly executive summary** — email executives a weekly posture summary (risk trend, top findings, remediation velocity) automatically.
0759. **Developer fix emails** — email developers their assigned findings with fix guidance and retest instructions.
0760. **Hunt completion emails** — email stakeholders when hunts complete with attached summary reports.
0761. **SLA breach emails** — warn assignees by email before findings breach remediation SLAs with escalating urgency.
0762. **Bounty payout emails** — notify hunters by email when bounties are awarded with ledger details.
0763. **Scope change emails** — email program owners when hunt scopes change so authorization stays documented.
0764. **New asset emails** — alert asset owners when new in-scope assets are discovered on their services.
0765. **Retest result emails** — email requesters the outcome of retests with pass/fail evidence.
0766. **False positive feedback** — email hunters when their findings are marked false positive with the reasoning so they learn.
0767. **Duplicate notices** — notify hunters when findings are marked duplicate with links to the canonical report.
0768. **Platform message sync** — forward bounty-platform messages into email for hunters who prefer inbox triage.
0769. **Email-to-finding** — let users create findings by emailing a monitored inbox with evidence attachments parsed automatically.
0770. **Email threading** — keep finding-related emails in proper threads so long remediation discussions stay coherent.
0771. **Unsubscribe management** — honor per-user notification preferences across all channels from one subscription center.
0772. **Notification quiet hours** — suppress non-critical notifications during user-configured quiet hours with morning catch-up digests.
0773. **Alert deduplication** — dedup repeated alerts for the same finding across channels so on-call engineers get one page, not ten.
0774. **Alert correlation** — correlate related findings into a single notification bundle so teams see the attack chain, not scattered alerts.
0775. **Severity-based routing** — route notifications by severity through different channels (critical→PagerDuty, medium→Slack, low→digest).
0776. **Team-based routing** — route notifications to teams from asset-ownership mappings so the right people get paged first time.
0777. **Timezone-aware delivery** — deliver non-urgent notifications in each recipient's working hours from their profile timezone.
0778. **Language localization** — localize notification content per recipient language so global teams triage in their own language.
0779. **Notification audit log** — log every notification sent (channel, recipient, content hash) for compliance and debugging.
0780. **Delivery receipts** — track notification delivery and read receipts so critical alerts confirm human acknowledgment.
0781. **Fallback escalation** — escalate to backup channels when primary notifications go unacknowledged within the SLA window.
0782. **Webhook fan-out** — fan out every finding event to customer-configured webhooks with HMAC signatures and retry queues.
0783. **Webhook templates** — let customers template webhook payloads per receiver so integrations get exactly the fields they need.
0784. **Webhook replay** — replay past webhook events on demand for debugging receiver integrations.
0785. **Webhook circuit breaker** — pause webhooks to failing receivers automatically and alert owners instead of dropping events silently.
0786. **RSS feeds** — publish per-program finding RSS feeds so anyone can subscribe with standard readers.
0787. **Atom activity** — expose hunt activity as Atom feeds for integration with feed-based dashboards.
0788. **Calendar invites** — create calendar invites for remediation deadlines from finding SLAs automatically.
0789. **Status page sync** — update status pages when critical findings affect customer-facing services with coordinated messaging.
0790. **Changelog publishing** — publish anonymized fix confirmations to product changelogs so customers see security progress.
0791. **Social sharing** — let hunters share sanitized bounty wins to social platforms with one click after disclosure.
0792. **Blog draft assist** — draft technical write-ups from disclosed findings for hunter blogs with evidence redacted.
0793. **Conference CFP assist** — assemble conference talk proposals from novel finding chains with disclosure timelines.
0794. **Press release guard** — gate press communications about findings behind disclosure-approval workflows.
0795. **Customer notification** — notify affected customers of their vulnerabilities through branded, trackable notification portals.
0796. **Vendor disclosure** — manage vendor disclosure timelines for third-party components with automated follow-ups.
0797. **CERT coordination** — package findings for CERT/CC coordination when vulnerabilities affect critical infrastructure.
0798. **Law enforcement** — provide evidence-packaging workflows for law-enforcement referrals in criminal-hacking cases.
0799. **Insurance reporting** — generate cyber-insurance-ready reports proving due-diligence testing for policy renewals.
0800. **Board reporting** — compile board-level security summaries from hunt data with risk trends executives actually read.
0801. **SARIF export** — export findings as SARIF 2.1.0 so GitHub, VS Code, and any SARIF consumer displays them with rule metadata and locations.
0802. **SARIF rule metadata** — enrich SARIF output with full rule descriptors (descriptions, help URIs, CWE tags) so consumers render rich guidance.
0803. **JSON export** — export the complete finding graph as structured JSON with stable IDs for custom integrations and backups.
0804. **JSON schema publishing** — publish a versioned JSON schema for exports so integrators validate payloads in CI.
0805. **XML export** — export findings as XML for enterprises with XML-based GRC pipelines and legacy tooling.
0806. **CSV export** — export findings as CSV with configurable columns so analysts pivot in spreadsheets instantly.
0807. **Excel workbooks** — generate multi-sheet Excel workbooks (findings, assets, timeline, stats) with filters and pivot tables pre-built.
0808. **PDF evidence packs** — export per-finding evidence packs as PDFs with request/response pairs and screenshots for offline review.
0809. **Markdown export** — export findings as Markdown files (one per finding) for wiki and docs-site ingestion.
0810. **HTML reports** — generate standalone HTML reports with embedded evidence for sharing without platform access.
0811. **Splunk HEC export** — stream findings to Splunk via HTTP Event Collector with CIM-compliant field mappings for SOC correlation.
0812. **Splunk dashboard app** — ship a Splunk app with prebuilt dashboards (posture, SLA, trends) powered by the HEC feed.
0813. **Splunk alert actions** — provide Splunk alert actions that create Dark-Matter retests from notable events.
0814. **Elastic export** — index findings into Elasticsearch with ECS field mappings so they join existing security data lakes.
0815. **Kibana dashboards** — ship Kibana saved objects (dashboards, lenses) visualizing finding trends and SLA burn-down.
0816. **Elastic alerting** — trigger Elastic Stack alerts on critical findings with connector actions back to Dark-Matter.
0817. **Logstash pipeline** — provide a Logstash pipeline config that normalizes Dark-Matter webhooks into the customer's index templates.
0818. **OpenSearch export** — support Amazon OpenSearch with the same mappings as Elastic for AWS-native SIEM estates.
0819. **Datadog logs** — forward findings to Datadog Logs with facet-ready attributes for cloud-native observability teams.
0820. **Datadog monitors** — create Datadog monitors on finding metrics (new criticals per hour) with multi-alert routing.
0821. **New Relic events** — send findings as New Relic custom events so they appear alongside APM telemetry.
0822. **Grafana datasource** — expose findings through a Grafana datasource plugin for custom security dashboards.
0823. **Grafana alerts** — drive Grafana alerting rules from finding metrics with annotations linking back to evidence.
0824. **Prometheus metrics** — expose hunt and finding metrics (counts by severity, SLA breaches) as Prometheus endpoints.
0825. **InfluxDB export** — write finding time-series into InfluxDB for long-term trend analysis and capacity planning.
0826. **ClickHouse export** — stream findings into ClickHouse for sub-second analytics over millions of historical records.
0827. **BigQuery export** — sync findings into BigQuery datasets so data teams join security data with business metrics.
0828. **Snowflake share** — share findings via Snowflake Secure Data Sharing for enterprise analytics without ETL.
0829. **Athena queries** — land finding exports in S3 as Parquet so Athena queries run cost-effective historical analysis.
0830. **Parquet dumps** — dump historical findings as partitioned Parquet for data-lake ingestion and ML training.
0831. **Google Sheets export** — sync findings into Google Sheets with live two-way status updates for spreadsheet-driven teams.
0832. **Sheets pivot templates** — provide Sheets templates with pivot tables and charts wired to the live finding sync.
0833. **Excel Online sync** — sync findings into Excel Online workbooks for Microsoft-centric reporting workflows.
0834. **Airtable publish** — publish findings into Airtable with linked asset and timeline tables for flexible views.
0835. **Smartsheet publish** — publish findings into Smartsheet with Gantt views of remediation timelines.
0836. **Notion publishing** — publish hunt reports as Notion pages with synced finding databases that update as triage progresses.
0837. **Notion database sync** — two-way sync findings with a Notion database so edits in Notion reflect in Dark-Matter.
0838. **Notion templates** — provide Notion report templates (executive summary, technical appendix) pre-wired to hunt data.
0839. **Confluence publishing** — publish reports as Confluence pages with finding macros and versioned updates per hunt rerun.
0840. **Confluence blueprint** — ship a Confluence blueprint that scaffolds pentest-style reports from Dark-Matter data.
0841. **SharePoint export** — save reports into SharePoint document libraries with metadata columns for compliance filing.
0842. **Google Docs export** — generate Google Docs reports with linked evidence for collaborative review.
0843. **Coda publishing** — publish findings into Coda docs with interactive SLA calculators.
0844. **GitBook sync** — sync security documentation and reports into GitBook for developer-facing security docs.
0845. **Docusaurus export** — export findings as Docusaurus Markdown pages for docs-site-based disclosure portals.
0846. **MkDocs export** — generate MkDocs sites from hunt reports for self-hosted report portals.
0847. **Wiki.js sync** — publish findings into Wiki.js for teams standardizing on it.
0848. **BookStack sync** — organize reports into BookStack shelves and books per program for structured archives.
0849. **XWiki export** — export findings into XWiki with structured objects for enterprise knowledge bases.
0850. **ServiceNow KB** — publish remediation articles into ServiceNow Knowledge Base from recurring finding patterns.
0851. **Zendesk Guide** — publish customer-facing security advisories into Zendesk Guide from disclosed findings.
0852. **Freshdesk articles** — create Freshdesk solution articles from common misconfigurations found across hunts.
0853. **Intercom articles** — push security notices into Intercom's help center for in-app customer visibility.
0854. **Drata evidence** — export hunt evidence into Drata as compliance evidence for SOC 2 control testing.
0855. **Vanta integration** — sync continuous-monitoring results into Vanta so security tests satisfy framework requirements.
0856. **SecureFrame** — feed findings into SecureFrame for automated compliance remediation tracking.
0857. **Tugboat Logic** — export audit-ready evidence packs into Tugboat Logic for auditor review.
0858. **AuditBoard sync** — sync findings into AuditBoard for enterprise audit and risk workflows.
0859. **LogicGate** — push risk data into LogicGate GRC for quantified risk aggregation.
0860. **OneTrust** — feed findings into OneTrust GRC for privacy-adjacent vulnerability tracking.
0861. ** Archer integration** — export findings into RSA Archer for enterprise GRC risk registers.
0862. **ServiceNow GRC** — sync findings into ServiceNow GRC's vulnerability workspace with risk scoring.
0863. **MetricStream** — push findings into MetricStream for regulated-industry compliance tracking.
0864. **NAVEX IRM** — export findings into NAVEX IRM for integrated risk management reporting.
0865. **Resolver** — sync findings into Resolver's risk platform for incident-linked vulnerability tracking.
0866. **RiskLens FAIR** — quantify findings in FAIR terms via RiskLens for dollar-denominated risk reporting.
0867. **Safe Security** — feed findings into Safe Security's breach-likelihood models for cyber-risk quantification.
0868. **Bitsight** — correlate findings with Bitsight ratings so customers see hunt impact on their security score.
0869. **SecurityScorecard** — map findings to SecurityScorecard factors for external-rating improvement tracking.
0870. **UpGuard** — sync findings into UpGuard for vendor-risk assessors tracking customer posture.
0871. **Panorays** — feed findings into Panorays third-party risk assessments.
0872. **Prevalent** — export vendor-facing findings into Prevalent for supply-chain risk workflows.
0873. **Aravo** — push findings into Aravo for third-party lifecycle risk management.
0874. **Whistic** — share sanitized posture summaries via Whistic profiles for trust-center transparency.
0875. **SafeBase trust** — publish hunt attestations into SafeBase trust centers for buyer security reviews.
0876. **Conveyor** — answer Conveyor security questionnaires automatically from hunt evidence.
0877. **VISO TRUST** — sync posture data into VISO TRUST for NDA-gated buyer reviews.
0878. **DataGrail** — feed findings into DataGrail for privacy-program risk tracking.
0879. **Transcend** — correlate findings with Transcend's data-mapping for privacy-impact prioritization.
0880. **Ketch** — push findings into Ketch for consent-adjacent vulnerability tracking.
0881. **BigID** — join findings with BigID's data-discovery so PII-adjacent flaws prioritize automatically.
0882. **Securiti** — feed findings into Securiti's data-command center for unified data security.
0883. **Immuta** — correlate findings with Immuta's data-access policies for governed-data risk views.
0884. **Alation** — annotate Alation data catalogs with vulnerability context for data stewards.
0885. **Collibra** — push findings into Collibra's data-governance workflows for regulated data assets.
0886. **Atlan** — surface findings in Atlan's active-metadata platform for data-team awareness.
0887. **Monte Carlo** — correlate findings with Monte Carlo data-observability alerts for pipeline-adjacent flaws.
0888. **Starburst** — expose findings to Starburst Galaxy queries for SQL-based security analytics.
0889. **dbt exposures** — link findings to dbt exposures so data teams see which models sit on vulnerable services.
0890. **Fivetran** — land finding exports via Fivetran connectors for no-code warehouse sync.
0891. **Airbyte** — ship an Airbyte source connector for Dark-Matter so any warehouse ingests findings.
0892. **Meltano** — provide a Meltano extractor for findings in Singer-tap ecosystems.
0893. **Stitch** — stream findings through Stitch Data for managed ETL into warehouses.
0894. **Matillion** — orchestrate finding ETL in Matillion for cloud data-platform teams.
0895. **dbt models** — ship dbt models that transform raw finding exports into analytics-ready marts.
0896. **Looker blocks** — provide Looker blocks visualizing finding posture for BI-driven security teams.
0897. **Tableau connector** — publish a Tableau web-data connector for finding dashboards.
0898. **Power BI dataset** — publish a Power BI dataset template with DAX measures for finding analytics.
0899. **Metabase** — sync findings into Metabase collections for self-service security questions.
0900. **Superset** — provide Apache Superset dashboard templates for open-source BI stacks.
0901. **MCP hunt server** — expose hunt tools (start hunt, query findings, fetch evidence) as a Model Context Protocol server so any AI agent can drive Dark-Matter.
0902. **MCP finding resources** — expose findings, assets, and reports as MCP resources with URI schemes so AI assistants read live hunt data.
0903. **MCP auth scoping** — scope MCP tool access per API key (read-only vs hunt-control) so AI agents get least-privilege access.
0904. **MCP audit logging** — log every MCP tool call with caller identity for audit trails of AI-driven hunting.
0905. **Claude Desktop connector** — ship a one-click Claude Desktop MCP configuration so users hunt through conversational AI.
0906. **MCP prompt templates** — bundle MCP prompt templates (triage this finding, plan this hunt) that compose tool calls into workflows.
0907. **CLI hunt command** — ship a `dm hunt` CLI that starts hunts, streams progress, and prints findings from the terminal.
0908. **CLI report command** — add `dm report` generating PDF, SARIF, or JSON reports from the CLI for scripting.
0909. **CLI asset command** — add `dm assets` listing and filtering the target inventory from the terminal.
0910. **CLI triage command** — add `dm triage` for confirming or rejecting findings from the command line in bulk.
0911. **CLI scope command** — manage hunt scopes (`dm scope add/remove`) from the CLI for automation-friendly workflows.
0912. **CLI webhook command** — register and test webhooks via `dm webhooks` without touching the UI.
0913. **CLI shell completion** — provide shell completions (bash, zsh, fish) so the CLI feels native in every terminal.
0914. **CLI CI mode** — run the CLI in CI mode with machine-readable output and exit codes reflecting finding severity.
0915. **Homebrew distribution** — distribute the CLI via Homebrew so macOS hunters install with one command.
0916. **Scoop/Chocolatey** — distribute the CLI via Scoop and Chocolatey for Windows hunters.
0917. **APT/YUM repos** — publish Linux packages via APT and YUM repositories for server-side automation.
0918. **Docker CLI image** — ship the CLI as a minimal Docker image for containerized pipeline usage.
0919. **Python SDK** — publish a Python SDK wrapping the full API with typed finding, hunt, and asset models.
0920. **JavaScript SDK** — publish a JavaScript/TypeScript SDK with async iterators over findings for Node integrations.
0921. **Go SDK** — publish a Go SDK for infrastructure teams embedding hunts in Go tooling.
0922. **Rust SDK** — publish a Rust SDK for performance-sensitive integrations and security tooling.
0923. **Java SDK** — publish a Java SDK for enterprise teams on JVM stacks.
0924. **Ruby gem** — publish a Ruby gem for Rails-centric security teams.
0925. **PHP client** — publish a PHP client for WordPress and Laravel agencies integrating hunt data.
0926. **.NET client** — publish a .NET client library for Microsoft-stack enterprises.
0927. **SDK retry logic** — build exponential-backoff retries with idempotency keys into every SDK so integrations survive API blips.
0928. **SDK webhook helpers** — provide SDK helpers that verify webhook signatures and parse events into typed objects.
0929. **Terraform provider** — ship a Terraform provider managing hunts, scopes, schedules, and integrations as code.
0930. **Terraform hunt resource** — define `darkmatter_hunt` resources so continuous hunts are declared in infrastructure code.
0931. **Terraform schedule** — manage recurring hunt schedules via Terraform with drift detection on manual changes.
0932. **Terraform notifications** — declare Slack, PagerDuty, and webhook notification targets as Terraform resources.
0933. **Pulumi provider** — support Pulumi for teams managing hunts in general-purpose programming languages.
0934. **Crossplane provider** — expose hunts as Kubernetes custom resources via Crossplane for GitOps-managed security.
0935. **Ansible collection** — ship an Ansible collection that provisions hunts and pulls reports in playbooks.
0936. **Chef cookbook** — provide a Chef cookbook installing the CLI and scheduling hunts on managed nodes.
0937. **Puppet module** — provide a Puppet module managing hunt schedules across fleets.
0938. **SaltStack formula** — provide a Salt formula for hunt orchestration on Salt-managed infrastructure.
0939. **Browser extension capture** — build a browser extension that captures the current page as hunt scope with one click, including auth state.
0940. **Extension request export** — let the extension export any browser request into Dark-Matter as a test seed with cookies intact.
0941. **Extension finding overlay** — overlay finding markers on the browsed site so developers see vulnerabilities in page context.
0942. **Extension cookie sync** — sync the browser's session cookies into Dark-Matter so hunts inherit the user's login instantly.
0943. **Extension scope guard** — warn in the browser when navigation leaves the hunt scope so manual testers stay authorized.
0944. **Extension PoC replay** — replay finding PoCs directly in the browser from the extension with one click.
0945. **Extension screenshot evidence** — capture annotated screenshots from the extension and attach them to findings.
0946. **Firefox support** — ship the extension for Firefox with full feature parity to Chrome.
0947. **Safari support** — ship the extension for Safari so Apple-ecosystem hunters get the same workflow.
0948. **Edge support** — publish the extension in the Edge Add-ons store for enterprise Windows users.
0949. **VS Code extension** — build a VS Code extension showing findings inline on the vulnerable code with fix guidance.
0950. **VS Code remediation** — offer one-click fix suggestions in VS Code generated from finding evidence and secure-code patterns.
0951. **VS Code retest** — trigger retests from VS Code after applying fixes and show pass/fail inline.
0952. **JetBrains plugin** — ship a JetBrains IDE plugin with the same inline-finding experience for IntelliJ, PyCharm, and GoLand.
0953. **Neovim plugin** — provide a Neovim plugin surfacing findings as diagnostics via the language-server protocol.
0954. **Eclipse plugin** — support Eclipse-based enterprise teams with a finding-view plugin.
0955. **Sublime Text** — provide a Sublime Text package listing findings per project.
0956. **GitHub Codespaces ext** — make the VS Code extension work in Codespaces so cloud dev environments get inline findings.
0957. **Gitpod extension** — support Gitpod workspaces with the same inline remediation workflow.
0958. **StackBlitz** — surface findings in StackBlitz web containers for frontend-heavy targets.
0959. **Chrome DevTools** — integrate findings into Chrome DevTools' Issues panel via the DevTools protocol.
0960. **Burp-to-IDE bridge** — send Burp Repeater requests linked to findings straight into the IDE at the suspected code location.
0961. **Figma plugin** — flag UI-level findings (clickjacking, sensitive-data exposure) on the design files they affect via a Figma plugin.
0962. **Postman collection** — export API findings as Postman collections with failing requests pre-built for developer replay.
0963. **Postman monitors** — create Postman monitors from API findings for continuous regression checks.
0964. **Insomnia plugin** — provide an Insomnia plugin importing finding requests for API debugging.
0965. **Bruno collections** — export findings as Bruno collections for Git-friendly API collaboration.
0966. **SwaggerHub sync** — sync API definitions with SwaggerHub so findings link to the canonical spec.
0967. **Stoplight** — push findings into Stoplight workspaces alongside API design docs.
0968. **ReadMe docs** — publish API security notes into ReadMe developer docs from confirmed findings.
0969. **OpenAPI diffing** — diff OpenAPI specs across hunts and flag new endpoints as untested attack surface.
0970. **API gateway sync** — sync findings with Kong, Apigee, and AWS API Gateway configs to suggest gateway-level mitigations.
0971. **WAF rule export** — export virtual-patch WAF rules (ModSecurity, Cloudflare, AWS WAF) from findings for immediate mitigation.
0972. **Cloudflare rulesets** — push mitigations as Cloudflare rulesets directly for customers on Cloudflare.
0973. **Akamai controls** — translate findings into Akamai Kona rule suggestions for edge mitigation.
0974. **Imperva policies** — generate Imperva WAF policy recommendations from confirmed injection findings.
0975. **F5 ASM policies** — export F5 ASM/Advanced WAF policy updates for on-prem WAF estates.
0976. **Signal Sciences** — push findings as Signal Sciences (Fastly) rule candidates.
0977. **CDN cache purge** — trigger CDN cache purges via API when cache-poisoning findings are confirmed fixed.
0978. **DNS provider API** — update DNS records via provider APIs to remediate takeover findings (remove dangling CNAMEs).
0979. **Cloud provider remediation** — remediate cloud misconfigurations via AWS, GCP, and Azure APIs with approval gates.
0980. **Kubernetes admission** — enforce admission policies from findings so vulnerable images can't deploy until fixed.
0981. **Service mesh policy** — push mTLS and authz findings as Istio/Linkerd policy fixes.
0982. **Vault secret rotation** — rotate leaked secrets via HashiCorp Vault APIs when secret findings are confirmed.
0983. **Cloud KMS rotation** — trigger key rotation in AWS KMS, GCP KMS, and Azure Key Vault for exposed keys.
0984. **Pager rotation** — rotate database credentials via cloud provider APIs after credential-leak findings.
0985. **Certificate renewal** — trigger certificate renewal via ACME/CA APIs when weak-certificate findings are confirmed.
0986. **Feature flag kill** — disable vulnerable features via LaunchDarkly/Unleash flags as emergency mitigation.
0987. **Kill switch API** — expose an emergency kill-switch that halts all active hunts platform-wide within seconds.
0988. **Legal hold export** — export findings with chain-of-custody metadata for legal-hold preservation.
0989. **E-discovery** — support e-discovery searches over hunt evidence with litigation-ready export formats.
0990. **Data residency** — pin hunt data to customer-selected regions via region-aware integrations for sovereignty compliance.
0991. **Customer-managed keys** — encrypt all integration-stored data with customer-managed keys (BYOK) for regulated tenants.
0992. **PrivateLink endpoints** — expose integrations over AWS PrivateLink and Azure Private Link so traffic never crosses the public internet.
0993. **VPC peering** — peer with customer VPCs for scanner-to-target traffic that stays on private networks.
0994. **On-prem connector** — ship an on-prem connector agent that bridges cloud Dark-Matter to internal targets without inbound firewall rules.
0995. **Air-gap bundles** — package integrations as signed air-gap bundles for fully disconnected deployments.
0996. **Multi-cloud failover** — fail integration traffic across cloud providers automatically when one region degrades.
0997. **Integration marketplace** — run a marketplace where third parties publish Dark-Matter integrations with sandboxed permissions.
0998. **Integration SDK** — publish an integration-builder SDK so customers write custom connectors against a stable API.
0999. **Integration certification** — certify third-party integrations with security reviews and compatibility badges.
1000. **Integration health SLA** — monitor every integration's health with synthetic transactions and publish per-integration uptime SLAs.
