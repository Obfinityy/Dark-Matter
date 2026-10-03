# Part 01 — Recon depth & breadth (40005–41004)

<!-- Sub-theme 1: Passive recon sources (40005–40104) -->
40005. **Five-minute CT issuance alert** — CT log fan-in monitor that flags certificates issued for in-scope domains within five minutes of log inclusion, with SCT timestamps as proof.
40006. **Multi-log CT redundancy checker** — ingests every known public CT log and cross-verifies inclusion so a subdomain missed by one log still surfaces from another.
40007. **Precertificate-to-final matcher** — pairs precertificates with their final certificates to catch issuance attempts that never completed but still leaked hostnames.
40008. **Redacted-label recovery engine** — reconstructs redacted CT labels by joining SAN entries across issuers and wildcard siblings for defensive asset inventory.
40009. **CT log operator health board** — tracks each CT log's uptime, inclusion lag, and shard coverage so recon confidence reflects which logs were actually healthy.
40010. **Issuer-behavior baseline alerter** — profiles which CAs normally issue for the target and flags first-time issuers as potential mis-issuance.
40011. **Wildcard-cert org mapper** — links wildcard certificates across domains to reveal sibling brands and subsidiaries sharing one certificate.
40012. **Cert-lifecycle gap analyzer** — infers service downtime windows and decommission events from expiry-without-renewal patterns in certificate history.
40013. **SCT timestamp drift detector** — flags certificates whose SCT timestamps diverge from log inclusion order as possible log anomalies.
40014. **CT-vs-DNS consistency auditor** — diffs CT-discovered hostnames against live DNS to surface issued-but-unpublished subdomains for review.
40015. **Mail-SAN infrastructure finder** — extracts mail and autodiscover SANs from certificates to map the target's email hosting providers.
40016. **Internal-hostname leak flagger** — detects RFC-1918 names, .local, and .internal labels in public CT logs as information-exposure findings.
40017. **crt.sh snapshot archiver** — stores periodic crt.sh snapshots per domain so historical certificate timelines survive upstream API changes.
40018. **CT shard awareness mapper** — tracks log shards per issuer so monitoring covers the shards the target's CAs actually write to.
40019. **CAA-record compliance verifier** — checks every newly logged certificate against the domain's CAA records and flags unauthorized issuers.
40020. **Cert-reuse fingerprint tracker** — clusters certificates sharing keys or serial patterns to map infrastructure managed by the same team.
40021. **Delayed-issuance anomaly detector** — flags certificates appearing in logs long after their not-before date as backdated or re-logged anomalies.
40022. **CT-derived subdomain age tracker** — records first-log-inclusion dates as asset birth dates for attack-surface aging analytics.
40023. **Acquisition signal detector** — watches CT logs for certificates issued to newly acquired brand domains under the target's org field.
40024. **Staging-host CT classifier** — labels certificate hostnames containing dev, stage, qa, or test patterns into a staging-asset inventory.
40025. **Historical A-record churn analyzer** — mines DNS history archives for IP changes that reveal hosting migrations and forgotten origin servers.
40026. **NS-change timeline builder** — reconstructs nameserver provider switches from historical NS records to map DNS outsourcing history.
40027. **Historical MX archaeology** — recovers past mail providers from archived MX records to identify legacy mail infrastructure still in scope.
40028. **CNAME-chain archaeology engine** — rebuilds retired CNAME chains from history to find dangling references to decommissioned services.
40029. **Passive-DNS first-seen tracker** — records first-seen and last-seen timestamps per hostname from passive DNS feeds as asset lifecycle evidence.
40030. **Historical TXT/SPF evolution viewer** — diffs archived TXT records to trace email-security posture changes and legacy include sprawl.
40031. **Forgotten-subdomain recovery from history** — resurrects subdomains present in DNS history but absent from current zone data for re-verification.
40032. **DNSSEC key-rollover timeline** — tracks historical DNSKEY and DS changes to detect rollover gaps and key-management anomalies.
40033. **SOA-serial drift monitor** — watches historical SOA serials for unexpected resets indicating zone-file rebuilds or provider moves.
40034. **Historical SRV-record miner** — extracts archived SRV records to map legacy SIP, XMPP, and directory services.
40035. **Parking-era detector** — identifies domains that historically resolved to parking pages before going live, flagging fresh attack surface.
40036. **TTL archaeology profiler** — infers past CDN and anycast usage from historical TTL distributions per hostname.
40037. **Old-IP ownership mapper** — joins historical A records with IP-ownership datasets to flag assets once hosted on third-party infrastructure.
40038. **Historical wildcard detector** — checks DNS history for wildcard records predating current explicit records, explaining enumeration noise.
40039. **Geo-IP history tracker** — maps where the target's assets were historically hosted to detect jurisdiction or provider shifts.
40040. **GitHub code-search domain harvester** — queries public code search for the target's domains to find leaked endpoints and internal hostnames in repos.
40041. **Sourcegraph public-code miner** — searches public source across forges for target hostnames and internal URL references.
40042. **npm metadata recon extractor** — mines package.json metadata of the target's published packages for repo URLs, maintainer emails, and homepage domains.
40043. **PyPI metadata asset mapper** — extracts project URLs and author contacts from the target's PyPI packages for infrastructure correlation.
40044. **Docker Hub config miner** — inspects public image layers and configs from the target's org for embedded hostnames and service references.
40045. **Public-gist exposure scanner** — monitors public gists mentioning target domains for accidentally pasted configs and URLs.
40046. **Terraform registry module auditor** — reviews the target's public Terraform modules for hardcoded endpoints and provider account hints.
40047. **Helm chart value miner** — parses public Helm charts from the target for ingress hosts and service naming conventions.
40048. **Chrome extension source analyzer** — unpacks the target's published browser extensions to harvest API endpoints and update-server domains.
40049. **Public Postman collection harvester** — collects the target's published Postman workspaces to inventory documented API endpoints.
40050. **SwaggerHub public-spec collector** — fetches the target's public API specs from spec hubs as structured endpoint inventories.
40051. **Stack Overflow snippet scanner** — finds code answers referencing the target's internal hosts, revealing tech stack and endpoint shapes.
40052. **Mobile-app string harvester** — extracts hardcoded domains and endpoints from the target's own published app binaries for asset inventory.
40053. **Package-lock URL extractor** — parses lockfiles in public repos for private registry URLs and scoped-package endpoints.
40054. **CI-config endpoint miner** — scans public CI configs for deployment targets and artifact server hostnames.
40055. **BigQuery public-dataset miner** — queries open BigQuery datasets for rows mentioning target domains, IPs, or ASNs.
40056. **Rapid7 Open Data joiner** — correlates forward-DNS and reverse-DNS open datasets against the target's netblocks for asset confirmation.
40057. **Common Crawl columnar URL miner** — scans the columnar index for historical URLs under target domains without full-crawl cost.
40058. **GH Archive event monitor** — watches GitHub Archive for repo events from the target's org referencing new services or domains.
40059. **BGP route-collector mapper** — uses RIPE RIS and RouteViews data to map the target's announced prefixes and peering changes.
40060. **WHOIS bulk-dataset correlator** — joins bulk WHOIS data on registrant organization to find domains owned by the same entity.
40061. **IPv4 census cross-checker** — verifies target IPs against internet-wide census datasets for banner and service confirmation.
40062. **Measurement-dataset importer** — ingests university internet-measurement datasets for third-party observations of target infrastructure.
40063. **Package-registry bulk miner** — processes bulk npm and PyPI metadata dumps for maintainer-to-domain relationships.
40064. **DNS census joiner** — matches target hostnames against open DNS census datasets for independent resolution confirmation.
40065. **CT-via-BigQuery historian** — runs historical certificate queries over public CT BigQuery mirrors for pre-2020 issuance archaeology.
40066. **Historical banner snapshot viewer** — reviews historical banners of the target's own IPs to track service evolution over time.
40067. **Certificate-dataset SAN grapher** — builds domain-relationship graphs from bulk certificate SAN datasets.
40068. **Open passive-DNS feed aggregator** — merges multiple open passive-DNS feeds with per-feed reliability weighting.
40069. **Wikipedia infra-mention extractor** — finds infrastructure and acquisition mentions of the target in encyclopedic sources for org-chart grounding.
40070. **Versioned dork library** — maintains a per-target dork collection with change history and effectiveness scores per dork.
40071. **Multi-engine dork fan-out** — runs each dork across Google, Bing, DuckDuckGo, Brave, Yandex, and Baidu and merges unique hits.
40072. **Dork-result change detector** — re-runs the dork set on schedule and alerts only on newly indexed pages since the last run.
40073. **Dork rotation scheduler** — spaces dork queries with jitter and engine rotation to avoid rate-limit blocks during automation.
40074. **Site-operator subdomain harvester** — automates site: queries with alphabet segmentation to enumerate indexed subdomains.
40075. **Inurl admin-panel inventory** — uses inurl: operators to inventory the target's own indexed admin interfaces.
40076. **Filetype exposure scanner** — automates filetype: queries for exposed documents, spreadsheets, and backups on target domains.
40077. **Negative-dork filter builder** — auto-generates exclusion operators from known-good results to keep dork runs focused.
40078. **Cache-operator fallback retriever** — falls back to cached copies when live pages are gone, preserving evidence of removed content.
40079. **LLM-assisted dork generator** — drafts new dorks from the target's tech profile and validates them against hit quality.
40080. **Dork-hit classifier** — labels dork results as asset, document, code, or noise and routes each to the right pipeline.
40081. **Dork-result screenshot archiver** — captures screenshots of dork hits at discovery time as tamper-evident evidence.
40082. **Intext exposure dorker** — searches indexed text for the target's domains adjacent to sensitive keywords for exposure review.
40083. **Dork dedup against asset inventory** — suppresses dork hits already in the asset database to surface only novel findings.
40084. **Regional-engine dork pack** — adds region-specific engines for targets with non-Western footprints.
40085. **Dork effectiveness dashboard** — scores each dork by novel-asset yield so low-value dorks retire automatically.
40086. **Time-bounded dork sweeps** — uses after: and before: operators to find newly indexed target content per week.
40087. **Dork-result language filter** — segments dork hits by detected language for localized subdomain and content discovery.
40088. **Wayback CDX bulk harvester** — pulls all archived URLs for target domains via the CDX API with collapse and filter parameters.
40089. **Wayback timemap differ** — diffs archived snapshots of key pages over time to detect removed endpoints and changed forms.
40090. **Archived JS bundle extractor** — recovers historical JavaScript bundles from Wayback for endpoint archaeology.
40091. **Archived robots/sitemap collector** — fetches historical robots.txt and sitemaps to find paths removed from current versions.
40092. **Wayback URL-keyed deduper** — normalizes archived URLs by key parameters to collapse near-duplicate historical entries.
40093. **First-archive asset ager** — uses earliest archive timestamps as asset creation dates for surface-age analytics.
40094. **Archive-frequency popularity proxy** — ranks assets by snapshot count to prioritize widely linked legacy pages.
40095. **Deleted-endpoint recovery engine** — restores API paths present in archives but missing live, for deprecation verification.
40096. **Archived error-page leak reviewer** — scans archived error pages for stack traces and debug output no longer visible live.
40097. **Memento aggregator fan-out** — queries arquivo.pt and other Memento archives beyond Wayback for broader historical coverage.
40098. **Wayback Save-Page-Now watcher** — monitors on-demand archiving of target pages as a signal of third-party interest.
40099. **CDX wildcard subdomain enumerator** — uses CDX wildcard queries to enumerate subdomains from archived URL data.
40100. **Archived mobile-variant collector** — harvests archived m-dot and responsive variants for endpoints missing from desktop crawls.
40101. **Archived API-doc restorer** — recovers old API documentation versions from archives to map deprecated-but-live endpoints.
40102. **Wayback response-body keyword searcher** — scans archived page bodies for internal hostnames and sensitive-adjacent strings.
40103. **Archive-gap analyzer** — identifies date ranges with missing snapshots to bound confidence in historical claims.
40104. **Archived redirect-chain reconstructor** — rebuilds historical redirect chains to find legacy domains still forwarding into scope.

<!-- Sub-theme 2: Subdomain enumeration strategies (40105–40204) -->
40105. **ML naming-convention learner** — trains on the target's known subdomains to predict its dev, staging, and prod naming grammar.
40106. **Combo-permutation generator** — combines environment prefixes with service names using learned pair frequencies.
40107. **Grammar-based label model** — builds a probabilistic label grammar from CT-derived names for ranked candidate generation.
40108. **Permutation budget allocator** — ranks candidates by predicted hit probability and spends the DNS query budget top-down.
40109. **Cross-org pattern transfer** — applies naming patterns learned from similar companies in the same industry to a new target.
40110. **Language-aware permuter** — generates localized label variants for targets with regional engineering teams.
40111. **Service-name permuter** — derives candidates from Kubernetes service names and container ports found in public configs.
40112. **Cloud-resource permuter** — generates bucket- and account-style names from org naming patterns for cloud-asset crossover.
40113. **Homoglyph-aware permuter** — tests confusable-character variants of brand subdomains for defensive typosquat coverage.
40114. **Permutation feedback loop** — feeds hit and miss results back into the model to re-rank remaining candidates mid-run.
40115. **Numbered-host permuter** — expands numeric patterns like srv01–srv99 detected in existing inventory.
40116. **Acronym-expansion permuter** — expands org acronyms into full-word variants and vice versa.
40117. **Department-code permuter** — uses department and cost-center codes mined from public docs as label seeds.
40118. **Vendor-product permuter** — combines vendor product names with org prefixes for integration-subdomain discovery.
40119. **Geo-code permuter** — appends airport and region codes to service names for multi-region infrastructure mapping.
40120. **Date-pattern permuter** — generates year- and quarter-tagged hostnames for project-era assets.
40121. **Hyphenation-variant engine** — tests hyphenated, concatenated, and dotted forms of multi-word service names.
40122. **TLD-sibling permuter** — applies the subdomain grammar to the target's other registered domains automatically.
40123. **Permutation deduplication filter** — removes candidates already covered by wildcard DNS or existing inventory before querying.
40124. **Confidence-ranked candidate queue** — streams permutation candidates in likelihood order so early results are highest-value.
40125. **Regex-constrained permuter** — restricts generation with admin-defined regex guardrails to keep permutations in scope.
40126. **Permutation hit-rate analytics** — reports per-pattern hit rates so analysts tune the grammar between hunts.
40127. **Seed-expansion recursor** — treats each newly found subdomain as a seed for another permutation round until exhaustion.
40128. **Permutation sharding coordinator** — splits candidate space across workers with deterministic sharding for resumable runs.
40129. **Low-and-slow permuter** — spreads permutation queries over days with jitter for noise-sensitive targets.
40130. **Multi-list dedup merger** — merges 50+ public subdomain wordlists into one deduplicated, frequency-ranked master list.
40131. **Industry-specific wordlist builder** — assembles wordlists from terms common to the target's vertical.
40132. **Target-synthesized wordlist** — builds a wordlist from the target's own website vocabulary, product names, and team names.
40133. **Wordlist freshness scorer** — scores wordlist entries by recent hit rates across hunts, retiring stale terms.
40134. **Hit-rate analytics per wordlist** — tracks which source lists produce hits per industry to guide list selection.
40135. **Negative wordlist maintainer** — keeps a known-bad list of honeypot labels and sinkholes excluded from bruteforce runs.
40136. **Multilingual wordlist packs** — ships curated non-English label lists for regional targets.
40137. **Tech-stack-derived wordlist** — generates labels from detected technologies such as wordpress, jenkins, and grafana.
40138. **Wordlist versioning system** — versions wordlists with changelogs so hunts stay reproducible.
40139. **Recursive wordlist expander** — appends discovered subdomain labels back into the wordlist for the next target in the same org.
40140. **Compound-label splitter** — breaks hyphenated discoveries into components to seed further combinations.
40141. **Wordlist length profiler** — chooses short vs deep wordlist modes based on target size and time budget.
40142. **Crowd-sourced wordlist curator** — accepts community submissions with quality scoring and review queues.
40143. **Typosquat wordlist generator** — creates typo variants of the target's brand for defensive registration monitoring.
40144. **Service-default wordlist** — covers default hostnames shipped by common appliances and vendor products.
40145. **Cloud-console wordlist** — targets console, portal, and admin labels used by cloud providers' managed services.
40146. **Wordlist effectiveness simulator** — estimates expected hits before a run using historical yield data.
40147. **Per-ASN wordlist tuner** — adjusts wordlist depth based on the target ASN's historical responsiveness.
40148. **Wordlist overlap analyzer** — shows which lists contribute unique hits to avoid redundant multi-list runs.
40149. **Deprecated-term pruner** — removes terms tied to dead products using end-of-life product databases.
40150. **Scheduled AXFR re-attempter** — retries zone transfers whenever NS records change, catching newly misconfigured servers.
40151. **Hidden-primary discoverer** — probes non-advertised nameservers for zone-transfer misconfigurations.
40152. **IXFR monitoring probe** — requests incremental transfers to detect zone-content changes without full dumps.
40153. **Anycast-NS transfer tester** — tests each anycast nameserver instance individually for inconsistent transfer policies.
40154. **TSIG-less transfer flagger** — reports successful unauthenticated transfers as critical DNS misconfigurations.
40155. **Zone-transfer result differ** — diffs successive successful transfers to track zone growth over time.
40156. **Secondary-NS enumerator** — discovers unlisted secondary nameservers via SOA analysis for transfer testing.
40157. **Zone-walking NSEC enumerator** — walks DNSSEC NSEC chains to enumerate zones where transfers are blocked.
40158. **NSEC3 cost estimator** — flags NSEC3-only zones and estimates enumeration cost for analyst decision.
40159. **Transfer-policy consistency checker** — compares AXFR responses across all authoritative servers for policy drift.
40160. **Zone-serial change alerter** — alerts on unexpected SOA serial jumps, triggering a transfer re-attempt.
40161. **Delegation-point transfer tester** — attempts transfers at every delegation point, not just the apex.
40162. **Versioned takeover-signature database** — maintains 100+ service fingerprints with version history and confidence tiers.
40163. **Multi-signal takeover verifier** — requires DNS, HTTP, and TLS agreement before confirming a takeover-prone asset.
40164. **Dangling-CNAME lifecycle tracker** — follows CNAME targets from creation to deletion to catch the exact dangling window.
40165. **Takeover-risk scorer** — scores each dangling record by service popularity, claimability, and brand impact.
40166. **Scheduled re-verification loop** — re-checks previously safe records on cadence since cloud resources get released.
40167. **Cloud-resource takeover watcher** — monitors S3, Azure, and GCP references in DNS for released-bucket claimability.
40168. **Expired-domain takeover guard** — watches expiration dates of domains referenced by the target's DNS.
40169. **Takeover evidence packager** — bundles DNS, HTTP, and screenshot proof into a ready-to-report finding package.
40170. **Claimability safety simulator** — safely simulates claimability checks without completing hostile takeovers.
40171. **Forgotten-NS takeover detector** — finds NS delegations pointing at expired or unregistered nameservers.
40172. **MX-takeover misconfig flagger** — detects MX records pointing at unclaimed mail services.
40173. **TXT-verification leftover scanner** — finds abandoned domain-verification TXT records that aid hostile claims.
40174. **Takeover-safe remediation advisor** — generates provider-specific cleanup steps for each confirmed dangling record.
40175. **Wildcard-CNAME takeover auditor** — checks wildcard CNAME targets for claimable services behind the wildcard.
40176. **Takeover trend dashboard** — tracks takeover-prone asset counts per hunt to measure remediation progress.
40177. **CI-driven takeover gate** — fails builds when new DNS records introduce takeover-prone references.
40178. **Takeover-signature freshness monitor** — re-validates signatures against live service behavior to retire dead fingerprints.
40179. **Multi-CDN takeover checker** — covers CDN-specific dangling patterns per provider for unclaimed distributions.
40180. **Takeover blast-radius estimator** — maps which brand assets share the claimable service to prioritize fixes.
40181. **Registrar-hold takeover watcher** — flags domains in redemption or pending-delete referenced by live DNS.
40182. **Takeover false-positive suppressor** — learns provider-specific safe patterns to cut noise like parked-but-owned records.
40183. **Edge-case takeover corpus** — keeps adversarial test cases with unicode and long labels for signature QA.
40184. **Takeover SLA tracker** — measures time from detection to remediation per asset for security metrics.
40185. **Randomized wildcard prober** — uses high-entropy labels to detect wildcard DNS with statistical confidence.
40186. **Wildcard-aware bruteforce filter** — excludes wildcard-synthesized answers using response fingerprinting.
40187. **Wildcard-DNS vs wildcard-cert distinguisher** — separates DNS wildcards from certificate wildcards in asset classification.
40188. **Wildcard-scope mapper** — determines exactly which label depths the wildcard covers via nested probing.
40189. **Nested-label wildcard bypass prober** — tests whether deeper labels escape the wildcard for hidden-asset discovery.
40190. **Wildcard response fingerprinter** — hashes wildcard responses by IP, TTL, and page to filter them reliably at scale.
40191. **Multi-wildcard tier detector** — detects stacked wildcards with differing targets at different label depths.
40192. **Wildcard-change monitor** — alerts when wildcard records appear, disappear, or change targets between hunts.
40193. **Wildcard-exclusion bruteforcer** — bruteforces only labels that provably bypass the wildcard, saving query budget.
40194. **Wildcard-IP reputation checker** — assesses whether wildcard target IPs belong to parking, CDN, or sinkhole infrastructure.
40195. **Wildcard-with-exceptions mapper** — enumerates explicit records punched through a wildcard zone.
40196. **Wildcard TLS prober** — checks whether wildcard DNS names serve valid TLS, distinguishing real services from catch-alls.
40197. **Wildcard-induced noise meter** — quantifies enumeration noise caused by wildcards to calibrate confidence scores.
40198. **Selective wildcard filter learner** — learns per-zone wildcard response templates instead of using global heuristics.
40199. **Wildcard-DNSSEC interaction checker** — verifies NSEC and NSEC3 behavior around wildcards for enumeration planning.
40200. **Wildcard apex-behavior profiler** — documents how the wildcard handles apex, www, and deep labels differently.
40201. **Wildcard-target takeover reviewer** — assesses claimability of the service behind wildcard targets.
40202. **Wildcard-aware permutation planner** — skips permutation branches fully covered by wildcard synthesis.
40203. **Wildcard removal impact preview** — simulates which assets would surface if the wildcard were removed, for client reporting.
40204. **Cross-zone wildcard correlator** — finds the same wildcard target IP across sibling zones to map shared infrastructure.

<!-- Sub-theme 3: Port/service scanning approaches (40205–40304) -->
40205. **Jittered scan scheduler** — randomizes probe timing within configured windows to avoid pattern-based IDS detection.
40206. **Business-hours-aware planner** — schedules intrusive scans outside the target's business hours inferred from timezone and locale.
40207. **Per-ASN rate limiter** — throttles scan rates per autonomous system based on historical tolerance data.
40208. **RST-storm backoff controller** — slows scanning automatically when reset rates spike, indicating filtering or alarms.
40209. **Honeypot-aware pauser** — halts a scan when responses match known honeypot fingerprints, pending analyst review.
40210. **Distributed scan coordinator** — spreads probes across egress IPs with deterministic assignment to avoid single-source spikes.
40211. **Scan-window negotiator** — proposes scan windows derived from the target's published maintenance pages and status history.
40212. **Traffic-blending mixer** — interleaves scan probes with benign-looking requests to reduce anomaly scores.
40213. **Adaptive concurrency tuner** — adjusts parallel probes in real time based on packet loss and response latency.
40214. **Quiet-hours profile builder** — learns the target's low-traffic periods from historical response-time data.
40215. **Scan-noise budget tracker** — quantifies probes sent per target and enforces per-engagement noise caps.
40216. **Tarpit detector (recon)** — identifies tarpitted ports by response-time anomalies and deprioritizes them.
40217. **IDS-evasion audit mode** — runs scans in a fully logged mode documenting every evasion-relevant decision.
40218. **Stealth-vs-speed slider** — exposes one control trading scan duration against network noise with live estimates.
40219. **Geo-distributed source rotator** — rotates scan origin regions to measure geo-filtered service differences.
40220. **Maintenance-window correlator** — aligns heavy scans with the target's announced maintenance windows.
40221. **Scan-impact estimator** — predicts likely log volume and alerting impact before a scan starts.
40222. **Progressive scan escalator** — starts with the quietest techniques and escalates only where results are inconclusive.
40223. **Dark-space monitor** — watches unallocated target IPs during scans for backscatter indicating spoofed-source abuse.
40224. **Scan-fingerprint randomizer** — varies probe TTLs, window sizes, and options to avoid scanner-signature detection.
40225. **Consent-window enforcer** — hard-blocks scanning outside authorized windows defined in the engagement profile.
40226. **Neighbor-noise checker** — samples adjacent IPs first to gauge the network's baseline sensitivity.
40227. **Scan-pause persistence** — checkpoints scan state so pauses survive restarts without rescanning completed ranges.
40228. **Egress-IP reputation precheck** — verifies scan source IPs aren't blocklisted before starting.
40229. **Scan-completeness verifier** — re-probes a statistical sample to estimate missed-port rates.
40230. **Banner normalization database** — maps raw banners to canonical product and version pairs with 10k+ signatures.
40231. **Banner-hash clusterer** — groups unknown banners by similarity to spot custom or spoofed services.
40232. **Banner-to-product confidence scorer** — attaches a confidence value to every product identification.
40233. **Multi-probe disambiguator** — sends follow-up probes when banners are ambiguous to resolve product identity.
40234. **Spoofed-banner anomaly detector** — flags banners contradicting other fingerprints like Server header vs TLS.
40235. **Banner-change alerter** — diffs banners between hunts to catch upgrades, downgrades, and replacements.
40236. **Banner-language profiler** — identifies IoT and embedded devices by banner language and formatting quirks.
40237. **SSH-banner version extractor** — parses SSH version strings into product and version with backport-aware mapping.
40238. **SMTP-banner intelligence** — extracts mail software, TLS support, and auth mechanisms from SMTP greetings.
40239. **FTP-banner feature parser** — decodes FTP FEAT responses into capability profiles.
40240. **HTTP Server-header correlator** — joins Server headers with body fingerprints for higher-confidence identification.
40241. **Banner-timestamp analyzer** — uses banner-embedded build dates to estimate software age.
40242. **Custom-404 banner leak reviewer** — checks error pages for version disclosures missed by header analysis.
40243. **Banner-encoding anomaly flagger** — flags unusual encodings or control characters suggesting honeypots.
40244. **Service-banner timeline** — builds per-port banner history to visualize service evolution.
40245. **Banner-consistency auditor** — verifies the same service identifies identically across IPv4, IPv6, and hostname.
40246. **Obfuscated-banner handler** — records unparseable banners verbatim with raw bytes for manual review queues.
40247. **Banner-driven probe selector** — chooses next probes based on what the banner suggests the service is.
40248. **Default-banner misconfig flagger** — highlights factory-default banners as hardening findings.
40249. **Banner PII scrubber** — redacts hostnames and usernames from stored banners before report export.
40250. **CPE auto-generator** — synthesizes CPE strings from parsed banners for NVD lookup.
40251. **KEV-membership flagger** — marks services matching CISA Known Exploited Vulnerabilities as priority findings.
40252. **Version-range CVE matcher** — matches detected versions against CVE affected-ranges, not just exact versions.
40253. **Patch-lag estimator** — estimates days-since-patch-available from version dates and vendor release data.
40254. **CVE-feed ingestion pipeline** — ingests NVD, GitHub Advisories, and vendor feeds hourly into the correlation engine.
40255. **Backport-aware version normalizer** — accounts for distro backports like Ubuntu and Debian to avoid false CVE matches.
40256. **CVE-to-service mapping board** — visualizes which CVEs affect which discovered services per target.
40257. **Exploit-availability checker** — notes public exploit availability per matched CVE for risk prioritization.
40258. **CPE-confidence scorer** — scores auto-generated CPEs so low-confidence matches are labeled speculative.
40259. **Vendor-EOL flagger** — flags products past end-of-life as findings even without specific CVEs.
40260. **CVE-dedup across banners** — merges duplicate CVE hits when multiple banners identify the same service.
40261. **Superseded-patch tracker** — follows patch supersession chains to confirm the installed version is truly current.
40262. **CVE severity re-ranker** — re-ranks CVEs by asset criticality and exposure, not just CVSS.
40263. **Zero-day-gap monitor** — watches vendor advisories for the target's exact products between feed updates.
40264. **CVE evidence linker** — attaches the exact banner substring and CPE that triggered each CVE match.
40265. **Container-image CVE joiner** — correlates discovered container registries' image tags with image CVE databases.
40266. **Firmware-CVE correlator** — matches IoT firmware versions from banners against embedded-device CVE feeds.
40267. **CVE trend reporter** — charts the target's vulnerable-service counts across hunts for remediation tracking.
40268. **Unmatched-version queue** — routes banners with no CVE mapping to analysts for manual CPE research.
40269. **CVE notification digest** — sends per-target CVE delta digests when new matches appear between hunts.
40270. **Industry UDP-profile scanner** — uses per-vertical top-UDP-port lists for gaming, VoIP, and DNS instead of generic sweeps.
40271. **UDP service-probe library** — ships version-detection probes for DNS, SNMP, NTP, and 40+ UDP services.
40272. **UDP amplification-risk flagger** — identifies misconfigurable UDP services as DDoS-abuse findings.
40273. **UDP response fingerprinter** — classifies UDP responders by payload quirks for service identification.
40274. **UDP confidence tiering** — labels UDP results as confirmed, likely, or unconfirmed based on response quality.
40275. **UDP retransmission tuner** — adapts retry counts per port based on observed packet-loss rates.
40276. **ICMP-unreachable interpreter** — uses ICMP responses to distinguish filtered from closed UDP ports.
40277. **UDP scan-result differ** — diffs UDP findings between hunts to catch newly exposed datagram services.
40278. **SNMP community profiler** — tests only default and empty communities and reports weak SNMP as a finding.
40279. **mDNS exposure mapper** — inventories multicast-DNS responders leaking internal hostnames.
40280. **UDP scan-time estimator** — predicts UDP sweep duration from loss rates before committing.
40281. **DTLS-service detector** — identifies DTLS handshakes on UDP ports for VPN and WebRTC mapping.
40282. **Safe UDP payload fuzzer** — sends malformed-but-harmless datagrams to fingerprint via error responses.
40283. **QUIC-service enumerator** — detects QUIC and HTTP-3 on UDP 443 and extracts Alt-Svc and version info.
40284. **UDP source-port behavior profiler** — documents how targets respond to varied source ports for firewall inference.
40285. **Broadcast-domain UDP auditor** — flags UDP services answering from unexpected interfaces.
40286. **UDP-to-TCP service correlator** — links UDP and TCP findings on the same host into unified service records.
40287. **AAAA-record harvester** — collects IPv6 addresses from DNS as the primary IPv6 target source.
40288. **Dual-stack consistency auditor** — verifies services match across IPv4 and IPv6 for the same hostname.
40289. **IPv6 PTR miner** — walks ip6.arpa for the target's prefixes to enumerate named hosts.
40290. **SLAAC-pattern inference engine** — predicts interface identifiers from observed EUI-64 and privacy-extension patterns.
40291. **IPv6-only service detector** — finds services reachable solely over IPv6 that IPv4-only scans miss.
40292. **IPv6 firewall-gap analyzer** — compares filtered-port behavior between stacks to find IPv6 firewall omissions.
40293. **Prefix-delegation mapper** — infers customer prefix assignments from addressing patterns for scope validation.
40294. **Neighbor-cache harvester** — uses authorized-assessment neighbor data to map adjacent hosts.
40295. **DNS64/NAT64 behavior profiler** — documents how the target's DNS64 synthesizes AAAA records for IPv4-only assets.
40296. **IPv6 extension-header prober** — tests firewall handling of extension headers as a filtering-assessment signal.
40297. **ULA-leak detector** — flags Unique Local Addresses in public DNS as internal-addressing exposure.
40298. **IPv6 TLS-certificate joiner** — matches certificates served on IPv6 to those on IPv4 for asset unification.
40299. **Anycast-IPv6 instance mapper** — distinguishes anycast vs unicast IPv6 deployments via latency triangulation.
40300. **IPv6 scanning-budget allocator** — prioritizes DNS-derived IPv6 targets since brute-forcing 128-bit space is infeasible.
40301. **Temporary-address tracker** — follows privacy-extension address rotation to maintain host identity over time.
40302. **IPv6 geolocation verifier** — cross-checks IPv6 geolocation against IPv4 for the same asset.
40303. **6to4/Teredo legacy detector** — flags transitional tunnel endpoints as legacy attack surface.
40304. **IPv6-first recon mode** — runs the full recon pipeline preferring AAAA records for IPv6-mature targets.

<!-- Sub-theme 4: Content discovery (40305–40404) -->
40305. **Response-similarity clusterer** — groups responses by content similarity to identify custom 404 templates automatically.
40306. **Dynamic 404 baseline learner** — learns the site's not-found signature per directory depth for accurate filtering.
40307. **Status-code intelligence engine** — interprets 403 vs 401 vs 404 vs 429 semantics to prioritize follow-up actions.
40308. **Content-length baseliner** — establishes per-path length baselines and flags anomalous deviations.
40309. **Recursive depth-budget allocator** — assigns recursion budgets by directory value instead of fixed depth.
40310. **Tech-stack wordlist switcher** — swaps to framework-specific wordlists on detection of WordPress, Laravel, or Django.
40311. **Rate-adaptive fuzzer** — slows automatically on 429 responses and resumes with backoff schedules.
40312. **Extension permutation engine** — tries .bak, .old, .orig, .swp, and tilde variants on discovered files.
40313. **Parameter fuzzing on discovery** — fuzzes query parameters on each discovered endpoint for hidden debug flags.
40314. **Backup-file hunter** — targets editor backups, SQL dumps, and archive extensions per directory.
40315. **Case-sensitivity prober** — tests case variants to detect case-insensitive servers hiding content.
40316. **HTTP-method permission mapper** — probes PUT, DELETE, and PATCH on discovered paths for method misconfigurations.
40317. **Trailing-slash behavior profiler (recon)** — documents slash-handling differences that hide duplicate content.
40318. **Soft-404 confidence scorer** — scores 200-OK-but-empty responses as likely soft 404s.
40319. **Redirect-chain content resolver** — follows redirect chains to final content for accurate classification.
40320. **Discovered-path value ranker** — ranks new paths by keyword value like admin, api, and config for triage.
40321. **Concurrent-host discovery coordinator** — discovers content across all subdomains in one coordinated pass.
40322. **Discovery deduplication engine** — suppresses paths already found via spider or sitemap sources.
40323. **Host-header content differ** — tests host-header variants for virtual-host content differences.
40324. **Session-aware bruteforcer** — maintains authenticated sessions during bruteforce for logged-in surface coverage.
40325. **Discovery result annotator** — tags each path with source, confidence, and tech context.
40326. **Encoding-rotation prober** — rotates path encodings for discovery where permitted by engagement rules.
40327. **Depth-budget crawl allocator** — assigns crawl depth per section based on link value and form density.
40328. **JS-rendered crawler** — executes JavaScript to discover client-rendered links and routes.
40329. **Crawl frontier prioritizer** — orders the URL queue by predicted finding value.
40330. **Duplicate-content detector** — fingerprints page content to skip near-duplicate crawl branches.
40331. **Crawl politeness profiler** — adapts request rates per host from observed tolerance.
40332. **Form-discovery crawler** — catalogs every form with method, action, and inputs during the crawl.
40333. **Authenticated crawl sessions** — replays login flows to crawl behind authentication.
40334. **Crawl-scope guardrail engine** — enforces include and exclude rules with scope-violation alerts.
40335. **Sitemap-first seeder** — seeds the crawl frontier from sitemaps before link-following.
40336. **SPA route extractor** — parses client-side router configs to enumerate SPA routes directly.
40337. **Infinite-scroll handler** — scrolls and paginates dynamic feeds to full depth.
40338. **Crawl-gap analyzer** — reports URL patterns in sitemaps never reached by link-following.
40339. **Link-rot mapper** — records broken internal links as maintenance and takeover signals.
40340. **External-link inventory** — catalogs outbound links for third-party dependency mapping.
40341. **Crawl snapshot differ** — diffs page snapshots between crawls for change detection.
40342. **Media-file crawler** — follows image, video, and document URLs for metadata harvesting.
40343. **Comment-and-meta harvester** — extracts HTML comments and meta tags during the crawl.
40344. **Crawl-completeness estimator** — estimates uncrawled surface from sitemap-vs-crawled ratios.
40345. **Priority re-crawl scheduler** — re-crawls high-value pages on shorter intervals.
40346. **Crawl trap detector** — identifies calendar traps and faceted-navigation loops, then bounds them.
40347. **Robots.txt change monitor** — diffs robots.txt on schedule and alerts on new disallows.
40348. **Sitemap-index recursion engine** — follows nested sitemap indexes to full depth.
40349. **News/video sitemap parser** — extracts specialized sitemaps for media endpoint discovery.
40350. **Disallow prioritization ranker** — ranks robots disallows by sensitivity keywords for review order.
40351. **llms.txt discovery probe** — checks for emerging llms.txt AI-directive files and parses their allowances.
40352. **Sitemap lastmod change detector** — uses lastmod timestamps to find recently changed high-value pages.
40353. **Robots.txt allow-list auditor** — reviews Allow directives that punch holes in Disallow rules.
40354. **Sitemap URL-pattern miner** — extracts URL templates from sitemap entries for parameter inference.
40355. **Orphaned sitemap finder** — discovers sitemaps not referenced by robots.txt via common paths.
40356. **Sitemap priority analyzer** — uses priority values to infer the site's own important pages.
40357. **Multilingual sitemap mapper** — parses hreflang sitemaps for locale-specific site variants.
40358. **Mobile sitemap extractor** — finds mobile-specific URLs missing from desktop sitemaps.
40359. **Sitemap-vs-crawl differ** — flags sitemap URLs the crawler never reached.
40360. **Deprecated sitemap detector** — finds sitemaps referencing long-dead hosts.
40361. **Robots.txt crawl-delay respecter** — honors crawl-delay per agent for polite automation.
40362. **Sitemap compression handler** — transparently handles gzipped sitemap indexes.
40363. **Sitemap frequency profiler** — uses changefreq values to schedule re-crawl intervals.
40364. **Cross-domain sitemap validator** — verifies sitemap hosts against scope before ingestion.
40365. **JS URL extraction pipeline** — harvests script src URLs from crawled pages into a JS inventory.
40366. **Inline-script harvester** — extracts inline scripts with their hosting page context.
40367. **Sourcemap-linked JS discoverer** — finds JS files via referenced .map URLs.
40368. **JS-from-archive extractor** — pulls historical JS URLs from Wayback for version archaeology.
40369. **JS bundle version tracker** — versions bundles by hash to detect deployments between hunts.
40370. **Third-party script inventory (recon)** — catalogs external scripts for supply-chain mapping.
40371. **JS size anomaly flagger** — flags unusually large bundles for manual review.
40372. **Duplicate-bundle deduper** — dedupes identical bundles served across subdomains.
40373. **JS load-order mapper** — records script execution order for dependency analysis.
40374. **Dynamic-import harvester** — captures lazily loaded chunks via rendered crawling.
40375. **Service-worker script collector** — inventories service workers and their cached routes.
40376. **Web-worker script finder** — discovers worker scripts for background endpoint usage.
40377. **JS error-page harvester** — collects JS referenced only on error pages.
40378. **Legacy-browser bundle finder** — finds nomodule and legacy bundles containing older code.
40379. **JS coverage profiler** — measures which bundle code actually executes during crawls.
40380. **Chunk-manifest parser** — parses webpack chunk manifests for full chunk inventories.
40381. **JS source-URL comment extractor** — reads sourceURL comments revealing original file paths.
40382. **Minified-vs-dev detector** — flags unminified bundles shipped to production as exposure findings.
40383. **JS inventory change alerter** — alerts on new or removed scripts between hunts.
40384. **Framework-chunk classifier** — labels chunks by framework for targeted analysis.
40385. **Wayback CDX URL harvester** — bulk-pulls historical URLs per domain with CDX filters.
40386. **Common Crawl index querier** — queries the CC index for URLs under target domains.
40387. **URLScan.io result miner** — searches urlscan for scanned target URLs with DOM snapshots.
40388. **OTX URL feed ingester** — ingests threat-intel URL pulses mentioning target domains.
40389. **Historical parameter miner** — extracts query parameters from archived URLs for param inventories.
40390. **Archived form-action collector** — recovers form endpoints from historical page snapshots.
40391. **Historical subdomain-from-URL extractor** — derives subdomains from archived URL hosts.
40392. **URL-age scorer** — scores URLs by first-seen dates across historical sources.
40393. **Dead-URL revalidator** — re-checks historical URLs for resurrection as live endpoints.
40394. **Historical API-path restorer** — rebuilds API path inventories from archived traffic.
40395. **Multi-archive URL merger** — merges Wayback, Common Crawl, and urlscan URLs with source attribution.
40396. **Historical URL confidence scorer** — scores archived URLs by corroboration across sources.
40397. **Snapshot-content differ** — diffs archived page content across snapshots for endpoint drift.
40398. **Historical redirect target collector** — gathers redirect destinations from archived responses.
40399. **URL-timeline builder** — builds per-URL first- and last-seen timelines across archives.
40400. **Archive-only endpoint flagger** — marks endpoints existing only in archives for deprecation review.
40401. **Historical file-download mapper** — finds archived downloadable files for content review.
40402. **Query-string evolution tracker** — tracks how URL parameters changed over archive history.
40403. **Historical mobile-URL collector** — harvests archived mobile-site URLs separately.
40404. **Archive-source freshness monitor** — tracks each historical source's index recency for confidence weighting.

<!-- Sub-theme 5: JavaScript analysis (40405–40504) -->
40405. **AST-based deobfuscator** — parses bundles into ASTs and applies transform passes for readability.
40406. **String-array decoder** — decodes rotated string-array lookups common in obfuscated bundles.
40407. **Control-flow flattening visualizer** — reconstructs flattened control flow into readable graphs.
40408. **Dead-code eliminator** — strips unreachable code to shrink bundles for analysis.
40409. **Identifier renamer** — assigns meaningful names to minified identifiers using usage context.
40410. **Constant propagator** — folds constant expressions to reveal hidden string values.
40411. **Proxy-function inliner** — inlines wrapper functions to expose direct API calls.
40412. **Anti-debug neutralizer** — neutralizes debugger traps and timing checks for safe analysis.
40413. **Beautification pipeline** — standardizes formatting across bundles for diffing.
40414. **Obfuscator fingerprint matcher** — identifies the obfuscator tool and version from code patterns.
40415. **Deobfuscation confidence scorer** — scores how completely each transform recovered original logic.
40416. **Incremental deobfuscation cache** — caches transform results per bundle hash for repeat hunts.
40417. **Manual-annotation layer** — lets analysts pin notes to deobfuscated functions across hunts.
40418. **Diff-friendly normalizer** — normalizes bundles so version diffs show logic changes, not formatting.
40419. **Encrypted-string decryptor** — detects and decodes runtime-decrypted strings with known routines.
40420. **Self-defending code handler** — handles integrity-checking wrappers that break on modification.
40421. **Bundle-split reassembler** — rejoins split chunks into a single analyzable unit.
40422. **Source-structure restorer** — recovers original module boundaries from bundle wrappers.
40423. **Deobfuscation recipe library** — stores per-obfuscator transform recipes with success rates.
40424. **Readability-ranked output** — orders deobfuscated output by analyst readability scores.
40425. **Regex endpoint extractor** — applies curated regex sets for URLs, paths, and IPs in bundles.
40426. **AST route extractor** — walks ASTs for router definitions and route registrations.
40427. **Fetch/axios call grapher** — builds call graphs of HTTP client invocations with URLs.
40428. **WebSocket endpoint extractor** — finds ws:// and wss:// URLs plus socket.io namespaces.
40429. **GraphQL query harvester** — extracts GraphQL queries and mutations embedded in bundles.
40430. **Hardcoded-IP extractor** — finds literal IPv4 and IPv6 addresses with surrounding context.
40431. **API-client SDK parser** — parses generated SDK clients for complete endpoint inventories.
40432. **Environment-config extractor** — reads bundled env configs for API base URLs per environment.
40433. **Dynamic-URL template resolver** — resolves template literals into concrete URL patterns.
40434. **Redirect-target extractor** — finds client-side redirect destinations and their conditions.
40435. **Third-party endpoint separator** — splits first-party from third-party endpoints for scope clarity.
40436. **Endpoint-method mapper** — pairs extracted URLs with HTTP methods from call sites.
40437. **Authenticated-endpoint flagger** — marks endpoints called with auth headers in the bundle.
40438. **Deprecated-endpoint spotter** — finds commented or legacy endpoints still present in code.
40439. **Endpoint-parameter extractor** — captures path and query parameters from call sites.
40440. **Error-handler endpoint revealer** — extracts fallback URLs from error-handling code.
40441. **Feature-flag endpoint mapper** — links feature flags to the endpoints they gate.
40442. **Micro-frontend route aggregator** — combines routes from federated module manifests.
40443. **Deep-link route extractor** — finds mobile deep-link schemes and their handlers.
40444. **Endpoint-change differ** — diffs extracted endpoints between bundle versions.
40445. **Endpoint-to-page mapper** — links each endpoint to the UI pages that call it.
40446. **Unreachable-endpoint lister** — lists endpoints in code never triggered during crawls.
40447. **Entropy-plus-pattern scanner** — combines Shannon entropy with regex for API-key detection.
40448. **Secret-context analyzer** — examines surrounding code to judge real secrets vs test fixtures.
40449. **Secret-to-service attributor** — maps key formats to providers for impact rating.
40450. **Test-key discriminator** — recognizes documented test keys and placeholders to cut noise.
40451. **Client-side secret risk scorer** — scores exposed secrets by privilege level implied by usage.
40452. **Secret rotation-lag detector** — checks if the same secret appears across bundle versions over time.
40453. **Comment-secret scanner** — scans code comments for pasted credentials and tokens.
40454. **Hardcoded-password finder** — finds literal passwords in auth flows and config objects.
40455. **JWT-in-JS extractor** — pulls hardcoded JWTs from bundles and analyzes their claims.
40456. **Private-key material detector** — flags PEM blocks and private-key assignments in bundles.
40457. **Webhook-secret finder** — locates webhook signing secrets in integration code.
40458. **Secret-usage tracer** — traces where each found secret is actually sent.
40459. **Env-file reference checker** — flags process.env reads of sensitive names without values present.
40460. **Secret-commit age estimator** — estimates exposure duration via bundle history.
40461. **Multi-format key parser** — handles base64, hex, and PEM encodings of key material.
40462. **Secret-dedup across bundles** — merges the same secret found in multiple bundles.
40463. **False-secret learning filter** — learns analyst-dismissed patterns to reduce repeat noise.
40464. **Secret remediation advisor** — generates rotation and revocation guidance per secret type.
40465. **Secret-exposure timeline** — charts when each secret first appeared in shipped bundles.
40466. **High-entropy string triager** — queues unexplained high-entropy strings for analyst review.
40467. **Sourcemap presence detector** — checks for sourceMappingURL comments and .map file availability.
40468. **Sourcemap URL inferrer** — guesses map URLs from bundle naming conventions when comments are stripped.
40469. **Original-source recoverer** — reconstructs original sources from exposed maps for inventory review.
40470. **Exposed-sourcemap alerter** — flags publicly accessible maps as information-exposure findings.
40471. **Sourcemap completeness scorer** — measures what fraction of the bundle the map covers.
40472. **Hidden-sourcemap prober** — tests common map paths even without sourceMappingURL hints.
40473. **Sourcemap-vs-bundle differ** — verifies maps match the served bundle version.
40474. **Internal-path leak reviewer** — extracts developer machine paths from map metadata.
40475. **Sourcemap secret re-scanner** — runs secret scanning on recovered original sources.
40476. **Sourcemap endpoint re-extractor** — re-runs endpoint extraction on unminified sources.
40477. **Map-file access-control tester** — checks whether maps require auth that bundles don't.
40478. **Sourcemap retention monitor** — watches whether exposed maps disappear after disclosure.
40479. **Inline-sourcemap detector** — finds base64 inline maps embedded in bundle tails.
40480. **Sourcemap-driven file inventory** — lists every original source file as a code-surface inventory.
40481. **Map-guided deobfuscation shortcut** — uses maps to skip heuristic deobfuscation when available.
40482. **Sourcemap exposure trend tracker** — charts map exposure across hunts per target.
40483. **Sourcemap CI gate** — fails builds when production maps are publicly accessible.
40484. **Partial-map handler** — works gracefully with truncated or corrupted maps.
40485. **Bundle signature matcher** — matches bundle hashes and markers to known framework builds.
40486. **Framework version extractor** — parses version strings from framework runtime code.
40487. **Known-vulnerable bundle detector** — matches bundle versions against vulnerable-release databases.
40488. **Framework EOL flagger** — flags frameworks past end-of-life regardless of version.
40489. **Plugin inventory builder** — enumerates framework plugins and versions from bundles.
40490. **Framework config exposure reviewer** — finds framework config objects with debug flags enabled.
40491. **Build-tool fingerprinter** — identifies webpack, Vite, Rollup, and esbuild from bundle artifacts.
40492. **Framework CVE joiner** — joins detected framework versions to CVE feeds automatically.
40493. **Deprecated-API usage spotter** — finds calls to deprecated framework APIs indicating stale code.
40494. **Framework migration signal detector** — spots mixed framework versions suggesting partial migrations.
40495. **SSR-vs-CSR classifier** — determines server- vs client-rendering from bundle and HTML evidence.
40496. **Framework security-header auditor** — checks framework-default security headers on responses.
40497. **State-management mapper** — identifies Redux, Vuex, and Zustand stores and their persisted keys.
40498. **Router-version extractor** — parses client-router versions for known route-handling issues.
40499. **UI-library inventory** — catalogs component libraries for supply-chain awareness.
40500. **Framework debug-mode detector** — flags development builds shipped to production.
40501. **Polyfill-bundle analyzer** — reviews polyfills for outdated shims with known issues.
40502. **Framework telemetry spotter** — identifies analytics and telemetry SDKs bundled in.
40503. **Version-drift tracker** — charts framework version changes across hunts.
40504. **Framework hardening advisor** — generates framework-specific hardening checklists from findings.

<!-- Sub-theme 6: API discovery (40505–40604) -->
40505. **Swagger path prober** — tests common spec paths like /swagger.json, /openapi.json, and /v2/api-docs per host.
40506. **Spec-from-JS extractor** — recovers embedded OpenAPI fragments from frontend bundles.
40507. **Versioned spec discoverer** — hunts v1, v2, and v3 spec variants per API host.
40508. **Spec-diff monitor** — diffs fetched specs between hunts to catch new or removed endpoints.
40509. **Spec-server URL harvester** — extracts servers[] entries as environment inventories.
40510. **Deprecated-operation flagger** — marks deprecated:true operations for deprecation verification.
40511. **Hidden-spec path guesser** — permutes non-standard spec locations from naming patterns.
40512. **Spec-auth requirement mapper** — records security schemes per operation for authz test planning.
40513. **Example-payload harvester** — collects spec examples as valid request templates for testing.
40514. **Spec-parameter inventory** — builds a global parameter catalog across all discovered specs.
40515. **Multi-spec merger** — merges specs from multiple hosts into one unified API inventory.
40516. **Spec-schema PII spotter** — flags schemas containing PII-named fields for data-exposure review.
40517. **Spec-change alerter** — notifies on operation additions, removals, and schema changes.
40518. **Undocumented-vs-spec differ** — flags live endpoints missing from the spec as shadow APIs.
40519. **Spec-version timeline** — tracks spec version bumps as deployment signals.
40520. **Internal-spec leak detector** — flags specs exposed without auth that describe internal APIs.
40521. **Spec-rate-limit reader** — extracts rate-limit hints from spec extensions and docs.
40522. **Webhook-definition extractor** — catalogs webhook callbacks defined in specs.
40523. **Spec-driven test seeder** — feeds spec operations into the vulnerability test planner.
40524. **Stale-spec detector** — finds specs describing endpoints that no longer respond.
40525. **Spec-host consistency checker** — verifies spec servers match the hosts actually serving traffic.
40526. **Doc-UI path finder** — locates interactive Redoc and Swagger UI pages that bundle the raw spec.
40527. **Introspection exposure detector** — checks whether introspection queries return full GraphQL schemas.
40528. **Introspection-off inference engine** — reconstructs schemas from error messages and field suggestions when introspection is disabled.
40529. **Persisted-query extractor** — harvests persisted query IDs and hashes from bundles and traffic.
40530. **GraphQL-from-mobile harvester** — extracts GraphQL documents from the target's mobile apps.
40531. **Schema-stitching inference** — detects gateway-stitched schemas via type-origin inconsistencies.
40532. **Field-suggestion enumerator** — uses did-you-mean suggestions to enumerate hidden fields safely.
40533. **Mutation inventory builder** — catalogs all mutations with their input types.
40534. **Subscription endpoint mapper** — finds WebSocket subscription endpoints and their topics.
40535. **GraphQL server fingerprinter** — identifies Apollo Server, Hasura, and graphql-js from behaviors.
40536. **Batching-support mapper** — documents batching support for rate-limit assessment.
40537. **Depth-limit prober** — measures query depth and complexity limits defensively.
40538. **Schema-diff monitor** — diffs introspected schemas between hunts.
40539. **Fragment harvester** — collects named fragments revealing reusable field sets.
40540. **Directive inventory** — catalogs custom directives hinting at auth and caching logic.
40541. **GraphQL-to-REST correlator** — links GraphQL fields to equivalent REST endpoints.
40542. **Playground exposure flagger** — flags enabled GraphiQL and Playground IDEs as information disclosure.
40543. **Schema-comment miner** — extracts descriptions revealing business logic and PII.
40544. **Deprecated-field tracker** — monitors deprecated fields that remain resolvable.
40545. **Federation-entity mapper** — enumerates _entities and _service in federated graphs.
40546. **Query-complexity estimator** — estimates cost scoring from schema shapes.
40547. **APK endpoint extractor** — decompiles the target's Android apps for hardcoded API hosts.
40548. **IPA endpoint extractor (recon)** — analyzes the target's iOS apps for API base URLs.
40549. **Mobile cert-pinning inventory** — documents pinning configs to plan authorized traffic interception.
40550. **Deep-link scheme mapper** — enumerates custom URL schemes and their parameter handlers.
40551. **Push-notification endpoint finder** — locates push registration endpoints in app code.
40552. **Mobile API-version tracker** — tracks v1 vs v2 usage across app releases.
40553. **App-config endpoint harvester** — reads remote-config URLs baked into apps.
40554. **Mobile analytics endpoint lister** — catalogs telemetry endpoints for data-collection review.
40555. **In-app WebView URL collector** — finds WebView-loaded URLs bridging web and mobile surfaces.
40556. **App-release API differ** — diffs endpoints between app versions for changelog inference.
40557. **Mobile auth-flow mapper** — documents OAuth and token endpoints used by apps.
40558. **Backend-for-frontend detector** — identifies BFF layers serving the mobile clients.
40559. **App-secret scanner** — finds API keys and tokens in app resources for defensive inventory.
40560. **Mobile GraphQL extractor** — pulls GraphQL documents from app binaries.
40561. **App-store metadata miner** — extracts support URLs and policy endpoints from store listings.
40562. **Beta-channel API watcher** — monitors beta tracks for pre-release endpoints.
40563. **App-binary string differ** — diffs strings between releases to spot new integrations.
40564. **Mobile WebSocket inventory** — catalogs real-time endpoints in mobile clients.
40565. **REST-convention guesser** — infers nested routes like /users/{id}/orders from observed patterns.
40566. **Version-prefix permuter** — tries v1–v5, api/v2, and date-versioned prefixes per host.
40567. **HTTP-method enumerator (recon)** — probes OPTIONS and method lists per endpoint for hidden verbs.
40568. **Parameter-name inference engine** — guesses parameter names from docs, JS, and error messages.
40569. **Pluralization-variant tester** — tries singular, plural, kebab, and camel variants of resource names.
40570. **Action-suffix permuter** — appends export, preview, publish, and archive style actions to resources.
40571. **ID-format prober** — maps ID formats like UUID, numeric, and slug to plan authz tests.
40572. **Content-negotiation explorer** — tries Accept variants revealing alternate representations.
40573. **Trailing-format guesser** — tests .json, .xml, and /format suffixes for hidden formats.
40574. **Admin-path inference engine** — derives admin variants from public routes using naming conventions.
40575. **Debug-endpoint guesser** — probes /debug, /status, /health, and /metrics style endpoints.
40576. **Internal-header discoverer** — tests X-Internal and debug headers that unlock hidden behaviors.
40577. **Subdomain-to-path correlator** — maps api-style subdomains to path-based equivalents.
40578. **Error-message oracle mapper** — catalogs error shapes that confirm endpoint existence.
40579. **Timing-based existence inferrer** — uses response-time differences to infer hidden routes.
40580. **Verb-override surface mapper** — documents verb-override headers and parameters per endpoint.
40581. **Case-variant endpoint tester** — tests case permutations for case-insensitive routers.
40582. **Encoding-variant prober** — tries encoded slashes and dots for router normalization gaps.
40583. **Locale-prefix permuter** — tries locale prefixes like /en and /fr on API routes.
40584. **Tenant-prefix inferrer** — guesses tenant-scoped path prefixes from SaaS patterns.
40585. **Legacy-path guesser** — tries /api, /rest, and /v0 legacy prefixes alongside current ones.
40586. **Endpoint-relationship grapher** — builds resource-relationship graphs from inference results.
40587. **Changelog feed watcher** — monitors changelogs, status pages, and dev blogs for API changes.
40588. **Deprecated-endpoint tracker** — follows sunset headers and deprecation notices to removal.
40589. **Version-sunset alerter** — alerts ahead of announced API version retirements.
40590. **Breaking-change classifier** — labels changelog entries as breaking vs additive.
40591. **SDK-release correlator** — joins SDK releases to API changes for timeline accuracy.
40592. **Developer-portal differ** — diffs dev-portal docs between crawls for undocumented changes.
40593. **Status-page incident correlator** — links API incidents to endpoint reliability data.
40594. **Migration-guide extractor** — parses migration guides for old-to-new endpoint mappings.
40595. **Beta-endpoint graduation tracker** — follows beta endpoints into general availability.
40596. **Rate-limit change monitor** — watches docs for quota and throttling policy changes.
40597. **Auth-change alerter** — flags announced auth scheme migrations such as key to OAuth.
40598. **Webhook-event changelog tracker** — monitors added or removed webhook event types.
40599. **API-roadmap miner** — extracts planned endpoints from public roadmaps.
40600. **SDK-release API watcher** — watches the target's SDK repos for release notes signaling API shifts.
40601. **Changelog-to-traffic verifier** — confirms announced endpoints actually respond.
40602. **Silent-change detector** — flags spec changes with no corresponding changelog entry.
40603. **Multi-region rollout tracker** — detects API versions differing by region during rollouts.
40604. **Changelog digest summarizer** — summarizes weekly API changes into analyst briefs.

<!-- Sub-theme 7: Cloud asset discovery (40605–40704) -->
40605. **Org-pattern bucket permuter** — generates bucket names from org naming conventions like acme-prod and acme-assets.
40606. **Bucket-region inference engine** — determines bucket regions from response headers and latency.
40607. **Bucket-policy misconfig detector** — checks ListBucket and GetObject grants as exposure findings.
40608. **Versioning/listing checker** — reports public listing and version-history exposure.
40609. **Bucket-name wordlist curator** — maintains cloud-specific bucket wordlists separate from DNS lists.
40610. **Permutation-yield tracker** — scores bucket-name patterns by hit rate for pattern tuning.
40611. **Bucket-ACL vs policy differ** — compares ACLs and bucket policies for conflicting grants.
40612. **Static-site bucket detector** — identifies website-enabled buckets and their index and error docs.
40613. **Bucket-notification harvester** — reads notification configs revealing Lambda and queue integrations.
40614. **Cross-account bucket correlator** — links buckets via shared policies to map org account sprawl.
40615. **Bucket-encryption auditor** — flags unencrypted buckets holding sensitive-named objects.
40616. **Logging-configuration reviewer** — checks access-logging enablement per bucket.
40617. **Bucket-tag intelligence** — extracts tags revealing environment, owner, and cost-center.
40618. **Object-naming convention miner** — infers key prefixes from listable buckets for targeted enumeration.
40619. **Bucket-creation date tracker** — uses creation dates to age cloud assets.
40620. **Transfer-acceleration prober** — detects acceleration endpoints as additional asset surface.
40621. **Bucket-CNAME joiner** — links DNS CNAMEs to bucket names for takeover-risk assessment.
40622. **Public-object sampler** — samples listable objects for sensitive content classification.
40623. **Bucket-policy simulator** — evaluates effective permissions from combined ACL and policy.
40624. **Dangling-bucket takeover watcher** — monitors DNS references to deleted buckets for claimability.
40625. **Bucket-versioning exposure reviewer** — checks versioned buckets for exposed historical object versions.
40626. **Multi-region bucket mapper** — maps replicated buckets across regions.
40627. **Storage-account name permuter** — generates Azure-compliant storage account names from org patterns.
40628. **Blob-container guesser** — enumerates common container names per storage account.
40629. **Azure AD tenant discoverer** — resolves tenant IDs from domains for Entra ID mapping.
40630. **Blob-access-tier profiler** — documents public-access levels per container.
40631. **Azure static-website detector** — finds $web containers serving static sites.
40632. **SAS-token leak scanner** — searches public sources for leaked shared-access signatures.
40633. **Azure Front Door mapper** — links Front Door endpoints to backend origins.
40634. **Storage key-rotation signal** — infers rotation posture from key-age metadata.
40635. **Azure CDN endpoint enumerator** — discovers CDN endpoints tied to the target's profiles.
40636. **Blob-soft-delete auditor** — checks soft-delete and versioning for data-recovery exposure.
40637. **Azure AD app-registration harvester** — finds app registrations via known client IDs.
40638. **Container-metadata miner** — extracts metadata revealing owners and environments.
40639. **Azure DNS-zone enumerator** — lists public Azure DNS zones for the target's domains.
40640. **Private-endpoint exposure checker** — flags storage accounts missing private-endpoint restrictions.
40641. **Azure policy-compliance reviewer** — checks storage accounts against encryption and TLS baselines.
40642. **Dangling-Azure-DNS watcher** — monitors CNAMEs to deleted Azure resources for takeover risk.
40643. **Azure region-affinity mapper** — maps accounts to regions for data-residency review.
40644. **Blob-index tag harvester** — uses blob index tags for content classification.
40645. **GCP bucket-name permuter** — generates bucket names from org patterns with GCP naming rules.
40646. **GCP project-ID inferrer** — derives project IDs from naming conventions and public references.
40647. **Bucket-IAM policy reviewer** — checks uniform vs fine-grained access for public grants.
40648. **GCP service-account enumerator** — finds service accounts via key IDs in public sources.
40649. **Cloud CDN endpoint mapper** — links Cloud CDN backends to origins.
40650. **GCP region profiler** — maps buckets and instances to regions for residency analysis.
40651. **Firebase project discoverer** — finds Firebase projects tied to the target's apps.
40652. **BigQuery dataset exposure checker** — flags public datasets under the target's projects.
40653. **GCP API-key leak scanner** — searches public sources for GCP API keys with service attribution.
40654. **Cloud Run service enumerator** — discovers run.app services for the target.
40655. **GKE cluster endpoint finder** — locates Kubernetes API endpoints from public references.
40656. **Artifact Registry enumerator** — finds container registries and image names.
40657. **Dangling-GCP-DNS watcher** — monitors references to deleted GCP resources.
40658. **GCP organization-policy reviewer** — checks org policies for public-sharing constraints.
40659. **Cloud Storage HMAC-key hunter** — finds HMAC keys in code and configs for defensive review.
40660. **GCP bucket-notification mapper** — reads notification configs for Pub/Sub integrations.
40661. **Project-number correlator** — joins project numbers across services into org graphs.
40662. **GCP label intelligence** — extracts labels revealing environment and ownership.
40663. **AWS range ingester** — ingests ip-ranges.json with service and region attribution.
40664. **Azure range ingester** — parses Azure ServiceTags for range-to-service mapping.
40665. **GCP range ingester** — ingests Google cloud.json ranges with scope labels.
40666. **Cloudflare range mapper** — maps Cloudflare ranges to distinguish proxied vs origin traffic.
40667. **Alt-provider range tracker** — covers smaller providers' published ranges like DigitalOcean and Linode.
40668. **Target-IP-to-provider classifier** — labels every discovered IP with its cloud provider.
40669. **Range-change monitor** — diffs provider range feeds for new netblocks to scan.
40670. **BYOIP prefix tracker** — follows bring-your-own-IP announcements for the target.
40671. **Cloud-metadata endpoint inventory** — documents provider metadata IPs for SSRF test scoping.
40672. **Egress-IP attributor** — attributes observed egress IPs to provider NAT gateways.
40673. **Anycast-vs-regional classifier** — distinguishes anycast ranges from regional ones.
40674. **Range-to-service correlator** — joins discovered IPs to provider service tags.
40675. **Unannounced-range detector** — flags target IPs outside all published provider ranges.
40676. **IPv6 cloud-range ingester** — covers provider IPv6 ranges for dual-stack mapping.
40677. **Government-cloud range watcher** — tracks GovCloud and sovereign-region ranges.
40678. **CDN-range behavior profiler** — documents how CDN ranges handle direct-IP requests.
40679. **Cloud-range scan planner** — prioritizes provider ranges overlapping target ASNs.
40680. **Reserved-range auditor** — flags target usage of documentation or reserved ranges.
40681. **Multi-cloud footprint dashboard** — visualizes the target's distribution across providers.
40682. **Range-attribution confidence scorer** — scores IP-to-provider mappings by evidence strength.
40683. **SAN-to-cloud joiner** — links certificate SANs to cloud resource names like buckets and accounts.
40684. **Cert-org to cloud-account mapper** — joins certificate org fields to cloud account IDs.
40685. **Wildcard-cert cloud correlator** — maps wildcard certs to the cloud distributions serving them.
40686. **ACM-cert inventory** — catalogs AWS Certificate Manager certs visible via CT for the target.
40687. **Cloud-issued cert timeline** — tracks cert issuance as a proxy for cloud-resource creation dates.
40688. **Multi-SAN org grapher** — builds org relationship graphs from shared SAN certificates.
40689. **Cert-transparency region inferrer** — infers regions from cert metadata and serving infrastructure.
40690. **Private-CA cloud linker** — maps private-CA-issued certs to internal cloud resources.
40691. **Cert-key cloud-service matcher** — matches key types and issuers to cloud-managed PKI.
40692. **Expired-cert cloud drift detector** — finds cloud resources serving expired certs.
40693. **Cert-subject cloud tagger** — tags assets by OU and CN patterns indicating cloud environments.
40694. **Cross-cloud cert correlator** — finds the same cert served from multiple providers.
40695. **Cert-rotation cloud signal** — uses rotation events to detect cloud redeployments.
40696. **Cloud-cert misissuance alerter** — flags certs for cloud hostnames from unexpected CAs.
40697. **SAN-count anomaly detector** — flags certs with unusual SAN counts indicating automation or sprawl.
40698. **Cert-based takeover-risk joiner** — joins dangling DNS with cert data to confirm resource deletion.
40699. **Cloud-provider CA profiler** — profiles which CAs each provider's managed certs use.
40700. **Cert-chain cloud validator** — validates chains served from cloud endpoints for config errors.
40701. **OCSP-responder cloud mapper** — maps OCSP responders to provider infrastructure.
40702. **Cert-fingerprint cloud clusterer** — clusters assets by cert fingerprint across providers.
40703. **SCT-embedded cloud signal** — uses SCT inclusion as proof of public-trust issuance for cloud hosts.
40704. **Cloud-cert expiry dashboard** — tracks upcoming expirations across all cloud-linked certs.

<!-- Sub-theme 8: OSINT automation (40705–40804) -->
40705. **Org-chart reconstructor (recon)** — builds reporting structures from public professional profiles.
40706. **Email-format inferrer** — derives firstname.lastname vs flast patterns from public email samples.
40707. **Key-personnel tech mapper** — links engineers' public posts to the target's tech stack.
40708. **Security-team identifier** — finds the target's security staff for responsible-disclosure routing.
40709. **New-hire signal tracker** — watches profile updates for new security and infra hires.
40710. **Departure-risk monitor** — flags departing admins whose access may linger.
40711. **Executive digital-footprint mapper** — inventories executives' public accounts for impersonation defense.
40712. **Contractor-visibility auditor** — finds contractors listing target access in public resumes.
40713. **Email-pattern validator** — verifies inferred formats against breach-data domains defensively.
40714. **Phishing-surface heatmapper** — scores departments by public exposure for awareness prioritization.
40715. **Role-based target profiler** — groups employees by role for tailored awareness training.
40716. **Alumni-network mapper** — tracks ex-employees retaining knowledge of internal systems.
40717. **Conference-speaker tracker** — finds employees presenting on the target's infrastructure.
40718. **Open-source contributor linker** — links employees' OSS commits to internal tech choices.
40719. **Certification-signal miner** — extracts cert badges signaling tech adoption.
40720. **Team-page scraper** — harvests official team pages for names, roles, and photos as defensive inventory.
40721. **Email-harvest deduplicator** — merges emails from multiple OSINT sources with provenance.
40722. **VIP-account enumerator** — identifies high-privilege roles like C-suite and IT admins for monitoring.
40723. **Shadow-IT employee signal** — finds employees advertising unsanctioned tool usage.
40724. **Onboarding-doc leaker finder** — locates public onboarding docs revealing internal tooling.
40725. **Employee-tech-survey miner** — extracts stack mentions from public employee reviews.
40726. **Help-desk staff identifier** — finds support staff names used in social-engineering defense.
40727. **M&A personnel correlator** — maps personnel overlaps during acquisitions.
40728. **Remote-work exposure reviewer** — flags remote employees' home-lab posts leaking corp tech.
40729. **Employee-credential hygiene scorer** — scores public password-reuse signals per department.
40730. **Internal-tool mention tracker** — logs employees naming internal tools publicly.
40731. **Phishing-simulation seeder** — feeds org-chart data into authorized phishing simulations.
40732. **Contact-point verifier** — validates abuse and security contacts before disclosure.
40733. **Brand-mention monitor** — tracks mentions of the target across social platforms.
40734. **Executive-impersonation detector** — finds fake executive accounts via verification and behavior gaps.
40735. **Leaked-screenshot analyzer** — scans public screenshots for visible URLs, tickets, and dashboards.
40736. **Hashtag-campaign tracker** — follows campaign hashtags revealing product and infra names.
40737. **Employee-check-in mapper** — aggregates public check-ins at offices and data centers.
40738. **Social-bio tech miner** — extracts stack mentions from employee bios.
40739. **Conference-hashtag harvester** — collects talk titles revealing internal projects.
40740. **Job-title trend analyzer** — tracks title changes signaling reorgs and new teams.
40741. **Social-graph clusterer** — clusters employee connections to map hidden teams.
40742. **Posted-URL expander** — resolves shortened URLs in posts to find target properties.
40743. **Image-metadata extractor** — reads EXIF from public photos for location and device data.
40744. **Live-stream infra spotter** — reviews public streams for visible network diagrams and dashboards.
40745. **Community-forum monitor** — watches forums where employees discuss the target's stack.
40746. **Review-site tech miner** — extracts tooling mentions from employer reviews.
40747. **Social-account takeover watcher** — monitors the target's official accounts for compromise signals.
40748. **Fake-support-account detector** — finds scam support accounts impersonating the brand.
40749. **Viral-incident tracker** — captures social reports of outages revealing infra details.
40750. **Social-poll data miner** — analyzes poll replies for tech-preference signals.
40751. **Event-attendee lister** — uses public attendee lists for conference-based org mapping.
40752. **Social-archive searcher** — queries archived social content for deleted-but-cached posts.
40753. **Platform-policy change monitor** — tracks platform changes affecting the target's social presence.
40754. **Footprint-risk scorer** — scores the target's overall social exposure for reporting.
40755. **Credential-surface awareness mapper** — maps which employee emails appear in breach compilations for defensive review.
40756. **Breach-timeline correlator** — aligns breach dates with the target's incident history.
40757. **Password-reuse risk scorer** — estimates reuse likelihood from breach password patterns per department.
40758. **Third-party breach linker** — connects vendor breaches to the target's exposed employee accounts.
40759. **Breach-notification matcher** — verifies the target's notification coverage against public breach lists.
40760. **Combo-list hygiene auditor** — checks corporate domains against combo lists for policy enforcement.
40761. **Credential-stuffing surface estimator** — quantifies accounts at risk from known breaches.
40762. **Breach-source provenance tracker** — records which breach each credential record came from.
40763. **Plaintext-password breach flagger** — prioritizes breaches containing plaintext corporate passwords.
40764. **Internal-system credential matcher** — checks whether breached passwords violate internal password policy.
40765. **Breach-recency scorer** — weights recent breaches higher in risk calculations.
40766. **Department-breach heatmapper** — shows breach exposure by department for training focus.
40767. **Executive-breach alerter** — escalates breaches involving C-suite accounts.
40768. **Service-specific breach correlator** — links breaches to the specific services employees used.
40769. **Breach-dedup engine** — merges duplicate breach records across compilations.
40770. **Hash-type breach analyzer** — categorizes breaches by hash strength for crackability estimates.
40771. **Breach-to-phishing linker** — uses breach context to inform authorized phishing templates.
40772. **Stale-account breach reviewer** — flags breached accounts of departed employees.
40773. **Breach-disclosure verifier** — checks the target disclosed breaches within required windows.
40774. **Credential-monitoring enrollment checker** — verifies high-risk accounts are enrolled in monitoring.
40775. **Breach-trend reporter** — charts the target's breach exposure over time.
40776. **Dark-web mention correlator** — links dark-web chatter to known breach data for defensive intel.
40777. **Breach-impact estimator** — estimates accounts affected per breach for the target's domains.
40778. **Password-policy gap finder** — uses breach patterns to recommend policy changes.
40779. **Breach-data retention manager** — enforces retention limits on stored breach-derived data.
40780. **Legal-hold breach archiver** — preserves breach evidence under legal hold.
40781. **Tech-stack inference engine** — extracts languages, frameworks, and tools from job descriptions.
40782. **Infra-hiring signal detector** — spots Kubernetes, SRE, and platform roles signaling migrations.
40783. **Vendor-mention extractor** — finds named vendors revealing integrations.
40784. **Office-expansion signal tracker** — maps new office postings to infrastructure growth.
40785. **Security-posting analyzer** — reads security job reqs for tooling and maturity signals.
40786. **Cloud-migration signal detector** — finds cloud-architect roles indicating provider shifts.
40787. **Legacy-tech sunset spotter** — notes legacy skill requirements fading from postings.
40788. **Team-size estimator** — infers engineering org size from open requisition counts.
40789. **Posting-duration tracker** — measures time-to-fill as a hiring-difficulty signal.
40790. **Salary-band tech correlator** — joins salary data to tech demand for stack valuation.
40791. **Remote-policy inference** — derives remote-work posture from location fields.
40792. **Job-board aggregator** — merges postings across boards with dedup.
40793. **Req-ID change monitor** — tracks requisition edits revealing shifting priorities.
40794. **Interview-process miner** — extracts tech screens revealing stack details.
40795. **Contractor-vs-FTE classifier** — distinguishes contract roles signaling short-term projects.
40796. **Greenfield-project spotter** — finds zero-to-one role descriptions revealing new initiatives.
40797. **Acquisition-hiring correlator** — links hiring spikes to M&A activity.
40798. **Posting-language localizer** — segments postings by language for regional team mapping.
40799. **Skill-frequency trend reporter** — charts skill demand changes quarter over quarter.
40800. **Competitor-hiring comparator** — benchmarks the target's hiring against peers.
40801. **Job-posting archive differ** — diffs reposted jobs for changed requirements.
40802. **Stealth-startup role decoder** — decodes vague postings for hidden tech signals.
40803. **Internship-pipeline mapper** — tracks university pipelines revealing tech preferences.
40804. **Posting-to-asset verifier** — confirms inferred tech appears in actual recon findings.

<!-- Sub-theme 9: Recon result correlation (40805–40904) -->
40805. **Cross-source entity resolver** — merges subdomain, IP, and cert records into canonical assets.
40806. **Canonical asset-record builder** — creates one golden record per asset with all source evidence attached.
40807. **Alias-graph constructor** — links CNAMEs, IPs, and certs into alias graphs per asset.
40808. **Fuzzy-hostname matcher** — merges near-duplicate hostnames from noisy sources.
40809. **IP-to-hostname joiner** — unifies reverse-DNS, cert, and banner IPs into host records.
40810. **Port-service deduper** — merges port findings across scanners into one service record.
40811. **URL canonicalizer** — normalizes URLs across archives, crawls, and dorks.
40812. **ASN-org normalizer** — merges ASN naming variants into canonical org records.
40813. **Cloud-resource deduper** — unifies bucket and account findings across cloud sources.
40814. **Employee-record merger** — merges person records across OSINT sources with provenance.
40815. **Finding-level deduper** — suppresses duplicate findings from overlapping engines.
40816. **Source-priority resolver** — picks winning values when sources conflict, by source rank.
40817. **Temporal dedup window** — merges observations within time windows as one event.
40818. **Case-and-encoding normalizer** — normalizes hostname case and punycode before merging.
40819. **Subdomain-parent rollup** — rolls subdomain findings into domain-level summaries.
40820. **Certificate-identity joiner** — joins assets sharing certificate fingerprints.
40821. **Banner-identity matcher** — merges services with identical banner hashes.
40822. **Geo-IP deduper** — merges conflicting geolocation into consensus records.
40823. **Technology-stack unifier** — merges tech detections into one stack per asset.
40824. **API-operation deduper** — merges spec, JS, and traffic-derived API operations.
40825. **Historical-vs-live reconciler** — marks archived-only assets distinctly from live ones.
40826. **Multi-hunt asset stitcher** — carries asset identity across hunts via stable IDs.
40827. **Dedup-explanation logger** — records why records merged for auditability.
40828. **Split-decision reviewer** — flags merges with conflicting critical fields for manual review.
40829. **Dedup-quality dashboard** — measures merge precision via sampled analyst review.
40830. **Per-source reliability scorer** — assigns reliability weights to each recon source.
40831. **Corroboration booster** — raises confidence when independent sources agree.
40832. **Source-decay model** — reduces confidence of stale observations over time.
40833. **Contradiction penalizer (recon)** — lowers confidence when sources disagree.
40834. **Freshness-weighted scorer** — blends reliability with observation recency.
40835. **Analyst-feedback learner** — adjusts source weights from analyst confirmations.
40836. **Confidence-threshold router** — routes low-confidence assets to verification queues.
40837. **Per-asset confidence rollup** — computes overall asset confidence from evidence.
40838. **Per-finding confidence scorer** — scores each finding from its evidence chain.
40839. **Source-bias detector** — finds sources systematically over- or under-reporting.
40840. **Confidence-calibration reporter** — compares predicted vs confirmed rates per source.
40841. **New-source probation** — starts new sources at low weight until validated.
40842. **Cross-hunt confidence tracker** — watches confidence trends per asset over time.
40843. **Evidence-chain visualizer** — shows which sources contributed to each conclusion.
40844. **Uncertainty flagger** — marks conclusions resting on single weak sources.
40845. **Confidence-gated automation** — only auto-acts above configurable confidence thresholds.
40846. **Source-coverage scorer** — scores how many sources cover each asset.
40847. **Negative-evidence handler** — treats failed verifications as confidence-reducing evidence.
40848. **Confidence export annotator** — includes confidence scores in reports and API exports.
40849. **Ensemble reconciler** — combines ML and rule-based scores into final confidence.
40850. **Temporal-confidence decay curves** — models per-source-type decay rates empirically.
40851. **Confidence-backtest harness (recon)** — validates scoring against historical ground truth.
40852. **Low-confidence hunt mode** — runs extra verification passes on weak assets.
40853. **Confidence-explanation generator** — writes human-readable reasons for each score.
40854. **Source-retirement advisor** — recommends retiring sources with persistently low calibration.
40855. **Asset-appearance timeline** — logs first-seen timestamps for every asset.
40856. **Asset-disappearance tracker** — flags assets vanishing between hunts.
40857. **DNS-drift alerter** — alerts on A, AAAA, CNAME, MX, and NS record changes.
40858. **Cert-rotation tracker** — logs certificate replacements with issuer and key changes.
40859. **Banner-drift detector (recon)** — flags service version changes between observations.
40860. **Port-state change monitor** — alerts on newly opened or closed ports.
40861. **Technology-stack drift reporter** — reports framework and library changes.
40862. **Cloud-resource change feed** — tracks bucket, account, and policy changes.
40863. **Content-change differ** — diffs page content snapshots for significant changes.
40864. **API-surface change detector** — flags new or removed API operations.
40865. **Employee-roster differ** — tracks org-chart changes between OSINT refreshes.
40866. **Job-posting delta reporter** — reports new postings signaling stack shifts.
40867. **WHOIS-change alerter** — flags registrar and nameserver changes.
40868. **BGP-announcement watcher** — alerts on prefix announcement changes.
40869. **TLS-config change tracker** — logs cipher and protocol changes per host.
40870. **Header-change monitor** — diffs security headers between observations.
40871. **Redirect-change detector** — flags altered redirect chains.
40872. **Crawler-directive change alerter** — alerts on robots.txt and sitemap changes.
40873. **Takeover-status flip tracker** — logs assets moving in or out of takeover-prone state.
40874. **Exposure-change scorer** — scores whether each change increases or decreases exposure.
40875. **Change-attribution linker (recon)** — links changes to deployments, incidents, or M&A events.
40876. **Scheduled change digest** — sends periodic summaries of all detected changes.
40877. **Change-confidence scorer** — scores whether a change is real vs measurement noise.
40878. **Baseline-freeze manager** — pins baselines during known migration windows.
40879. **Change-webhook dispatcher** — pushes change events to SIEM and ticketing systems.
40880. **Hunt-to-hunt surface differ** — produces full attack-surface diffs between hunts.
40881. **New-exposure alerter** — alerts within minutes on newly exposed services.
40882. **Remediation verifier** — confirms fixed findings actually disappeared.
40883. **Scope-creep detector (recon)** — flags assets drifting outside defined scope.
40884. **Exposure-score differ** — quantifies risk delta between hunts.
40885. **Visual surface-diff map** — renders added, removed, and changed assets on a network map.
40886. **Scheduled diff reports** — emails periodic surface-diff summaries to stakeholders.
40887. **Diff-driven retest planner** — prioritizes changed assets for focused retesting.
40888. **Acquisition surface merger** — diffs pre- and post-acquisition surfaces during M&A.
40889. **Cloud-migration differ** — tracks surface changes during cloud migrations.
40890. **Incident-response differ** — snapshots surface before and after incidents.
40891. **Attacker-vs-defender differ** — compares attacker-visible vs defender-known surface.
40892. **Shadow-IT differ** — isolates unmanaged-asset changes from managed ones.
40893. **Compliance-surface differ** — maps surface changes to compliance control impacts.
40894. **Executive diff summarizer** — writes plain-language summaries of surface changes.
40895. **Diff-confidence annotator** — labels diff entries by measurement confidence.
40896. **False-diff suppressor** — filters diffs caused by scan variance, not real change.
40897. **Multi-target diff aggregator** — rolls diffs across portfolios into one view.
40898. **Diff-retention archiver** — stores historical diffs for forensic timelines.
40899. **Real-time diff streamer** — streams surface changes as they are detected.
40900. **Diff-to-ticket automator** — opens tickets for high-risk new exposures.
40901. **Peer-benchmark differ** — compares surface evolution against industry peers.
40902. **Diff-rollback planner** — suggests rollback steps for risky new exposures.
40903. **Attack-path impact estimator** — estimates how surface changes alter attack paths.
40904. **Diff-audit trail** — logs who viewed and actioned each diff for accountability.

<!-- Sub-theme 10: Recon orchestration UX (40905–41004) -->
40905. **Live recon map** — renders discovered assets on an interactive graph as they arrive.
40906. **Per-source progress bars** — shows completion per recon source with item counts.
40907. **ETA estimator** — predicts remaining time from historical source speeds.
40908. **Bottleneck highlighter** — flags the slowest sources holding up completion.
40909. **Asset-funnel visualizer** — shows subdomain-to-alive-to-fingerprinted-to-tested funnel stages.
40910. **Source-yield leaderboard** — ranks sources by assets found in the current hunt.
40911. **Real-time log tailer** — streams recon engine logs with severity coloring.
40912. **Coverage heatmap** — maps scanned vs unscanned IP space visually.
40913. **Phase timeline** — displays recon phases on a Gantt-style timeline.
40914. **Worker-status board** — shows distributed worker health and throughput.
40915. **Live-finding ticker** — streams new findings as cards in real time.
40916. **Confidence-distribution chart** — plots asset confidence across the hunt.
40917. **Geo-map plotter** — plots assets on a world map by geolocation.
40918. **Tech-stack treemap** — visualizes detected technologies by prevalence.
40919. **Port-distribution histogram** — charts open ports across the target.
40920. **Certificate-timeline view** — plots cert issuance events over time.
40921. **Change-pulse monitor** — pulses the UI when new assets appear mid-hunt.
40922. **Progress-share linker** — generates shareable read-only progress links.
40923. **Mobile progress companion** — mirrors hunt progress on a phone-friendly view.
40924. **Dark-mode recon console** — full dark theme for the recon operations view.
40925. **Milestone markers (recon)** — marks 25/50/75/100% completion with subtle UI feedback.
40926. **Stuck-source detector** — highlights sources with no output beyond expected time.
40927. **Checkpointing engine** — persists scan state every N items for crash recovery.
40928. **One-click pause/resume** — freezes and resumes any recon job from the UI.
40929. **Partial-result preserver** — keeps completed results when a job is cancelled.
40930. **Crash-recovery wizard** — guides analysts through resuming interrupted hunts.
40931. **State-export/import** — moves in-progress hunts between machines via state files.
40932. **Incremental continuation** — resumes only unfinished sources on restart.
40933. **Checkpoint-integrity verifier** — validates checkpoints before resuming.
40934. **Resume-point preview** — shows what will re-run before confirming resume.
40935. **Auto-checkpoint scheduler** — checkpoints long jobs on time intervals.
40936. **Resource-aware pauser** — pauses automatically on memory or disk pressure.
40937. **Network-loss tolerator** — survives connectivity drops and resumes cleanly.
40938. **Per-source resume granularity** — resumes individual failed sources, not whole jobs.
40939. **Resume-audit logger** — logs every pause and resume event with actor and reason.
40940. **Checkpoint-pruning manager** — deletes old checkpoints by retention policy.
40941. **Resume-from-diff** — restarts hunts seeded with previous results to skip redo.
40942. **Graceful-shutdown handler** — checkpoints cleanly on SIGTERM and deploys.
40943. **Resume-conflict resolver** — handles overlapping resume attempts safely.
40944. **Checkpoint-encryption option** — encrypts checkpoints containing sensitive data.
40945. **Recon profile builder** — saves source selections, depth, and schedules per target.
40946. **Industry preset packs** — one-click profiles for fintech, healthcare, SaaS, and gov.
40947. **Depth presets** — quick, standard, and deep modes with documented trade-offs.
40948. **Profile-version control** — versions profiles with diff and rollback.
40949. **Profile-sharing library** — shares anonymized profiles across teams.
40950. **Profile-effectiveness scorer** — scores profiles by findings per hour.
40951. **Auto-profile recommender** — suggests profiles from target size and industry.
40952. **Stealth-profile pack** — pre-tuned low-noise profiles for sensitive targets.
40953. **Compliance-profile pack** — profiles aligned to PCI, HIPAA, and SOC 2 needs.
40954. **M&A-profile pack** — profiles optimized for acquisition target assessment.
40955. **Profile-clone customizer** — clones and tweaks presets without starting over.
40956. **Per-asset-type depth tuner** — sets depth per asset class like web, API, cloud, and network.
40957. **Profile-schedule binder** — attaches cron schedules to profiles.
40958. **Profile-approval workflow** — requires review before high-impact profile runs.
40959. **Profile-diff viewer** — compares two profiles side by side.
40960. **Profile-usage analytics** — tracks which profiles teams actually use.
40961. **Target-fingerprint auto-matcher** — matches new targets to similar past profiles.
40962. **Profile-import/export** — moves profiles between environments as files.
40963. **Child-profile inheritor** — lets sub-targets inherit and override parent profiles.
40964. **Profile-simulation mode** — dry-runs a profile to estimate duration and noise.
40965. **Profile-compliance checker** — warns when profiles violate engagement rules.
40966. **Deprecated-profile archiver** — retires unused profiles with history preserved.
40967. **Cron re-recon scheduler** — runs recon on flexible schedules per target.
40968. **Change-triggered re-recon** — re-runs focused recon when CT or DNS signals fire.
40969. **Drift-alert dispatcher** — sends alerts when scheduled runs detect drift.
40970. **Business-hours scheduler** — constrains scheduled runs to approved windows.
40971. **Schedule-calendar view** — shows all upcoming recon runs on a calendar.
40972. **Run-history browser** — browses past scheduled runs with result links.
40973. **Schedule-pause manager** — pauses schedules during freezes and holidays.
40974. **Priority-queue scheduler** — orders scheduled runs by target criticality.
40975. **Missed-run catcher (recon)** — backfills runs missed during outages.
40976. **Schedule-conflict resolver** — staggers overlapping runs to avoid overload.
40977. **Adaptive-frequency tuner** — adjusts cadence from observed change rates.
40978. **Event-driven triggers (recon)** — fires recon on webhooks for deploys, M&A, and incidents.
40979. **Schedule-ownership tracker** — assigns owners to each schedule for accountability.
40980. **Run-budget enforcer** — caps compute and query budgets per schedule.
40981. **Schedule-templates library** — reusable cadence templates like daily delta and weekly deep.
40982. **Notification-routing rules** — routes schedule alerts to the right channels.
40983. **Schedule-health monitor** — alerts on repeatedly failing scheduled runs.
40984. **One-off scheduled runs** — schedules single future runs without recurring setup.
40985. **Recon coverage scorecard** — grades source coverage, asset counts, and confidence.
40986. **Source-yield analytics** — reports assets and findings per source for ROI.
40987. **Executive recon summary** — one-page plain-language recon brief.
40988. **Analyst deep-dive report** — full evidence-linked recon detail per asset.
40989. **Coverage-gap finder** — lists unscanned areas with reasons.
40990. **Recon-quality scorer** — scores hunt thoroughness against profile expectations.
40991. **Before/after scorecards** — compares scorecards across hunts.
40992. **Peer-benchmark scorecard** — benchmarks coverage against similar targets.
40993. **Report-card exporter** — exports scorecards as PDF and markdown.
40994. **Scorecard-trend plotter** — charts scorecard metrics over time.
40995. **Finding-density mapper** — maps findings per asset for hot-spot analysis.
40996. **Recon-cost reporter** — reports queries, time, and compute per hunt.
40997. **SLA-compliance checker** — verifies recon SLAs met per engagement.
40998. **Report-card templating** — customizable scorecard layouts per audience.
40999. **Automated-narrative writer** — generates prose summaries from recon data.
41000. **Evidence-link embedder** — links every claim to raw evidence.
41001. **Scorecard-diff alerter** — alerts on scorecard regressions between hunts.
41002. **Stakeholder-digest sender** — emails tailored digests per stakeholder role.
41003. **Report-card API** — exposes scorecards programmatically for dashboards.
41004. **Recon-maturity grader** — grades the target's recon-readiness maturity over time.
