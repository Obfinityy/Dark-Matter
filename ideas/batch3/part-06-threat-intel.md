# Dark-Matter Batch 3 — Threat Intel Integration (Part 6)

Ideas 25005–26004: correlating external threat intelligence with autonomous hunts.

## 1. CVE Feed Correlation (25005–25104)

25005. **Auto-ingest NVD CVE feed at hunt start** — pull every CVE published in the last 90 days matching the target's detected technology stack so the hunt opens with fresh intelligence instead of stale assumptions.
25006. **Banner-to-CPE resolver** — convert Server, X-Powered-By, and service banners into CPE strings automatically, then query NVD for exact-version CVE matches without manual lookup.
25007. **CVE-to-endpoint mapper** — for each CVE matching the stack, list the concrete URLs, ports, and services on the target where the vulnerable component is actually exposed.
25008. **CVSS-weighted hunt prioritization** — reorder the hunt's check queue so components with CVSS 9.0+ matches are probed first, maximizing critical-find probability early in the run.
25009. **CISA KEV cross-check badge** — flag any finding whose CVE appears in CISA's Known Exploited Vulnerabilities catalog, since KEV-listed flaws are actively exploited in the wild.
25010. **EPSS score ingestion** — pull Exploit Prediction Scoring System probabilities for matched CVEs and prioritize checks with EPSS above 0.5 ahead of theoretically severe but rarely exploited flaws.
25011. **Exploit-maturity tracker per CVE** — classify each matched CVE as no-exploit, proof-of-concept, functional, or weaponized by scanning Exploit-DB, GitHub, and Metasploit, and surface the maturity level on the hunt dashboard.
25012. **Affected-version detection from HTTP headers** — parse version strings from response headers and HTML meta tags, then diff them against CVE affected-version ranges to confirm exposure without intrusive probing.
25013. **JavaScript library version fingerprinting** — hash frontend bundles to identify exact jQuery, React, Angular, and lodash versions, then match against known-vulnerable releases from the GitHub Advisory Database.
25014. **SBOM extraction from frontend assets** — reconstruct a software bill of materials from source maps, chunk hashes, and license files, then run the whole SBOM against OSV.dev for CVE hits.
25015. **WordPress core/plugin/theme CVE feed** — subscribe to WPScan and Patchstack feeds, fingerprint the target's wp-content paths, and alert when any installed plugin version has a published CVE.
25016. **Vendor advisory RSS aggregator** — monitor vendor security advisories (Microsoft, Cisco, Apache, Nginx, F5) for the target's stack and inject new advisories into the active hunt plan within an hour.
25017. **Debian/Ubuntu security tracker lookup** — map detected distro packages via package banners to the Debian and Ubuntu CVE trackers to catch backported-patch nuances that raw version comparison misses.
25018. **RHEL/CentOS errata correlation** — check Red Hat security errata for detected RHEL-family services so hunts don't flag CVEs already fixed by backported RHSA patches.
25019. **npm advisory correlation for Node backends** — detect Node.js services, enumerate likely dependencies from error pages and bundle maps, and cross-reference the npm/GitHub advisory feed.
25020. **PyPI advisory matching for Python stacks** — fingerprint Django, Flask, and FastAPI versions from response behavior, then check the PyPI Advisory Database and GitHub Python advisories.
25021. **Go module vulnerability feed** — identify Go-built binaries via header and TLS fingerprinting, then query the Go vulnerability database (golang.org/x/vuln) for matched module CVEs.
25022. **RustSec advisory lookup** — detect Rust-based services and check RustSec advisories for vulnerable crate versions that could affect the target's backend.
25023. **Container base-image CVE scan** — when the target exposes registry or CI artifacts, pull image manifests and scan base layers against Docker Hub and GHCR vulnerability data.
25024. **API gateway CVE watch** — track CVEs for Kong, Apigee, AWS API Gateway edge components, and Tyk, mapping them to the target's detected gateway fingerprints.
25025. **CDN edge-component CVE mapping** — correlate detected CDN behaviors with CVEs in edge software (Varnish, Cloudflare Workers runtimes, Fastly VCL engine quirks).
25026. **WAF bypass-intel CVE feed** — maintain a feed of CVEs that are specifically WAF-bypass or WAF-rule-evasion flaws, and check whether the target's WAF version is affected.
25027. **Load balancer CVE correlation** — fingerprint HAProxy, F5 BIG-IP, Citrix ADC, and cloud LBs, then match against their dedicated CVE histories before planning injection tests.
25028. **VPN appliance CVE priority lane** — give Ivanti, Fortinet, Palo Alto GlobalProtect, and Citrix NetScaler CVEs their own priority lane since these are top initial-access vectors.
25029. **Email gateway CVE check** — detect Mimecast, Proofpoint, and Exchange edge versions and cross-check CVEs that enable mail-flow compromise or spoofing.
25030. **SSO/IdP CVE correlation** — fingerprint Okta, Auth0, Keycloak, and ADFS endpoints, then match CVEs affecting authentication flows that could yield account takeover.
25031. **Database engine CVE mapping** — identify MySQL, Postgres, MongoDB, Redis, and Elasticsearch versions from error messages and protocol banners, then pull their CVE histories.
25032. **Message-queue CVE watch** — check RabbitMQ, Kafka, NATS, and SQS-compatible endpoints against published CVEs for broker-level compromise paths.
25033. **CI/CD tool CVE feed** — fingerprint Jenkins, GitLab, GitHub Actions runners, and TeamCity instances exposed on the target, and prioritize their high-severity CVEs.
25034. **Secrets-manager CVE correlation** — detect Vault, AWS Secrets Manager integrations, and CyberArk endpoints, then match CVEs that could leak stored credentials.
25035. **Monitoring-stack CVE check** — fingerprint Grafana, Prometheus, Datadog agents, and ELK endpoints, since monitoring tools often run with broad network access.
25036. **Backup software CVE priority** — track Veeam, Acronis, and Commvault CVEs aggressively because backup systems are prime ransomware targets with domain-wide access.
25037. **RMM tool CVE alerting** — flag ConnectWise, Kaseya, NinjaOne, and AnyDesk exposures and correlate with their CVE histories, given RMM abuse in supply-chain attacks.
25038. **EDR agent version intel** — detect EDR agent versions from network behavior and check vendor advisories for bypass CVEs that affect detection coverage.
25039. **Hypervisor CVE mapping** — identify VMware ESXi, Hyper-V, and Proxmox management interfaces and correlate with hypervisor-escape CVE feeds.
25040. **BMC/iDRAC firmware CVE check** — fingerprint out-of-band management interfaces and match against firmware CVEs that give below-OS persistence.
25041. **IoT firmware CVE feed** — for targets with exposed cameras, printers, or smart devices, pull vendor firmware CVEs and map them to detected device models.
25042. **ICS/SCADA CVE correlation** — detect Modbus, DNP3, OPC-UA, and Siemens/Rockwell web interfaces, then match against ICS-CERT advisories.
25043. **Medical-device CVE watch** — fingerprint healthcare portals and device gateways, correlating with FDA and ICS-CERT medical advisories for regulated environments.
25044. **E-commerce platform CVE feed** — detect Magento, Shopify Plus customizations, WooCommerce, and BigCommerce stacks, then pull their CVE and Magecart-relevant advisories.
25045. **Headless CMS CVE mapping** — fingerprint Strapi, Contentful webhooks, Sanity, and Contentstack endpoints against their advisory feeds.
25046. **Forum software CVE check** — detect Discourse, phpBB, vBulletin, and XenForo versions and correlate with their CVE histories for stored-XSS-prone components.
25047. **Wiki/Collab CVE feed** — fingerprint Confluence, MediaWiki, Notion-like self-hosted tools, and match against RCE-heavy CVE histories (e.g., Confluence OGNL flaws).
25048. **Ticketing-system CVE correlation** — detect Jira, ServiceNow, Zendesk, and osTicket instances and pull CVEs affecting ticket workflows and auth.
25049. **CRM CVE watch** — fingerprint Salesforce-connected endpoints, HubSpot integrations, and self-hosted SuiteCRM for CVE matches.
25050. **ERP CVE mapping** — detect SAP, Oracle EBS, and Odoo web interfaces and correlate with their quarterly critical patch update CVEs.
25051. **LMS CVE check** — fingerprint Moodle, Canvas, and Blackboard versions against education-sector CVE feeds.
25052. **Video-conferencing CVE feed** — detect Zoom, Teams, and Jitsi self-hosted components and match meeting-join and recording CVEs.
25053. **File-sync CVE correlation** — fingerprint Nextcloud, ownCloud, Dropbox Business integrations, and Seafile against file-access CVE histories.
25054. **Password-manager CVE watch** — detect 1Password Connect, Bitwarden, and LastPass enterprise endpoints and correlate with vault-access CVEs.
25055. **Remote-desktop CVE priority lane** — fingerprint RDP, VNC, Guacamole, and Apache Guacamole gateways, prioritizing BlueKeep-class RCE CVEs.
25056. **DNS server CVE mapping** — detect BIND, PowerDNS, and Windows DNS versions and match against cache-poisoning and RCE CVE feeds.
25057. **Mail server CVE correlation** — fingerprint Postfix, Exim, Exchange, and Zimbra versions against mail-daemon RCE CVE histories.
25058. **FTP/SFTP CVE check** — detect vsftpd, ProFTPD, and FileZilla Server versions and correlate with auth-bypass CVE feeds.
25059. **Time-sync CVE watch** — fingerprint NTP and Chrony services since time manipulation aids Kerberos and certificate attacks, and match their CVEs.
25060. **Logging-pipeline CVE mapping** — detect Fluentd, Logstash, Loki, and Splunk forwarders and check log-injection-to-RCE CVE chains.
25061. **SIEM/SOAR CVE feed** — fingerprint Splunk, QRadar, Sentinel integrations, and Cortex XSOAR for CVEs that could blind detection during a hunt.
25062. **Threat-intel-platform CVE check** — detect MISP, OpenCTI, and ThreatConnect instances and correlate with their CVE histories.
25063. **Honeypot-fingerprint exclusion feed** — use CVE and behavior intel to detect when the target is actually a honeypot (e.g., T-Pot signatures), and warn before wasting hunt budget.
25064. **Deserialization-library CVE matrix** — map detected Java, .NET, PHP, and Python deserialization libraries (Jackson, Json.NET, pickle usage hints) against their CVE matrices.
25065. **PDF-library CVE correlation** — detect PDF generation endpoints and fingerprint TCPDF, wkhtmltopdf, Puppeteer versions against SSRF/RCE CVE feeds.
25066. **Image-processing CVE watch** — fingerprint ImageMagick, Pillow, and libvips via upload endpoints and match against ImageTragick-class CVE histories.
25067. **Crypto-library CVE mapping** — detect OpenSSL, LibreSSL, BoringSSL versions from TLS handshakes and correlate with Heartbleed-class CVE feeds.
25068. **Auth-library CVE feed** — fingerprint OAuth, SAML, and JWT library versions from login flows and match against algorithm-confusion and bypass CVEs.
25069. **GraphQL-engine CVE check** — detect Apollo, Hasura, and graphql-java versions and correlate with introspection and batching-attack CVE advisories.
25070. **Service-mesh CVE mapping** — detect Istio, Linkerd, and Consul Connect sidecars via headers and correlate with mTLS-bypass CVE feeds.
25071. **Orchestrator CVE priority** — fingerprint Kubernetes API, Docker Swarm, and Nomad endpoints and prioritize K8s RBAC-escape CVE checks.
25072. **Container-runtime CVE feed** — detect containerd, CRI-O, and Docker Engine versions and match against container-escape CVE histories.
25073. **IaC-tool CVE correlation** — detect Terraform Cloud, Pulumi, and Ansible Tower endpoints and check for state-file-exposure CVEs.
25074. **Git-server CVE mapping** — fingerprint GitLab, Gitea, Bitbucket, and GitHub Enterprise versions against source-code-theft CVE feeds.
25075. **Artifact-registry CVE check** — detect JFrog Artifactory, Nexus, and GHCR endpoints and correlate with supply-chain-poisoning CVEs.
25076. **Patch-diff monitoring for stack vendors** — watch vendor patch releases for the target's exact components and auto-generate hunt checks from the diff when a security patch drops.
25077. **CVE age-vs-exposure scoring** — weight CVEs by days-since-publication multiplied by internet-exposure of the affected service, so old unpatched internet-facing flaws outrank new internal ones.
25078. **Chained-CVE path builder** — link multiple lower-severity CVEs on the same target into plausible chains (e.g., info-disclosure CVE plus auth-bypass CVE) using intel on observed chaining.
25079. **Superseded-CVE pruning** — automatically drop CVEs superseded by later patches or marked disputed/rejected in NVD so the hunt plan stays clean.
25080. **CVE-to-CWE-to-check mapping** — translate each matched CVE into its CWE, then into Dark-Matter's concrete hunt checks, so intel becomes action without manual interpretation.
25081. **Vendor severity override layer** — let vendor advisories override NVD CVSS when they disagree (e.g., vendor rates it critical), and log which source drove prioritization.
25082. **Internet-wide scan correlation** — cross-check matched CVEs against Censys/Shodan exposure data to show how many other hosts share the flaw, indicating exploit-kit availability.
25083. **CVE discussion sentiment feed** — mine Twitter/X, Reddit r/netsec, and mailing lists for chatter volume per CVE as an early signal that exploitation is spreading.
25084. **Ransomware-associated CVE tagging** — tag CVEs known to be used by ransomware affiliates (per CISA AA advisories) with a distinct high-priority marker in the hunt plan.
25085. **Botnet-associated CVE tagging** — tag CVEs observed in Mirai-variant and botnet propagation to prioritize internet-facing service checks.
25086. **CVE exploit-video tracker** — monitor YouTube and security blogs for public exploit walkthroughs per CVE as a proxy for script-kiddie availability.
25087. **Nuclei-template availability check** — for each matched CVE, check whether a public Nuclei template exists, which signals commoditized exploitation.
25088. **Metasploit-module maturity flag** — check for Metasploit modules per CVE and rank those with reliable, cross-platform modules highest.
25089. **VulnCheck KEV enrichment** — ingest VulnCheck's community KEV data for exploit artifacts (PCAPs, Snort rules, YARA) tied to each CVE.
25090. **AttackerKB consensus scoring** — pull AttackerKB assessments for rapid7-style community consensus on exploitability and feed it into hunt prioritization.
25091. **CVE re-prioritization mid-hunt** — if a new CVE drops for the target's stack while a hunt is running, pause, re-score, and inject the new checks without restarting the hunt.
25092. **Stale-intel decay model** — decay the priority of CVEs over time when no new exploit activity is observed, keeping the hunt focused on live threats.
25093. **Duplicate-CVE dedup across feeds** — merge NVD, GitHub Advisory, OSV, and vendor entries for the same flaw into one canonical item so the plan isn't triple-counted.
25094. **CVE applicability confidence score** — score how confident the version detection is (banner vs. behavior vs. guess) and only auto-probe high-confidence matches.
25095. **Negative-intel filter** — suppress CVEs when intel confirms the vulnerable code path is unreachable on the target (e.g., feature disabled), cutting false-positive hunts.
25096. **CVE hunt-coverage receipt** — at hunt end, produce a receipt listing every stack-matched CVE, whether it was checked, and the verdict, for audit completeness.
25097. **Nightly CVE delta digest** — send a digest of new CVEs affecting previously hunted targets' stacks so users can re-hunt only when something material changed.
25098. **Stack-change-triggered re-correlation** — when a re-hunt detects the stack changed (new framework version), re-run CVE correlation and diff against the previous hunt's CVE set.
25099. **CVE SLA tracker** — track days since each matched CVE's publication against the target's patch cadence to estimate patch likelihood before probing.
25100. **Executive CVE exposure summary** — translate the CVE correlation into a one-page executive summary: how many known CVEs touch the target, how many are KEV-listed, and what that means in business terms.
25101. **CVE-to-asset-owner routing** — map each CVE-matched component to the likely owning team (via subdomain and service naming intel) and include owner hints in the report.
25102. **Compliance-mapped CVE view** — overlay PCI-DSS, HIPAA, and SOC 2 control mappings on matched CVEs so regulated targets get compliance-weighted prioritization.
25103. **CVE trend line per target** — chart matched-CVE counts across repeated hunts to show whether the target's known-vulnerability exposure is improving or decaying.
25104. **Offline CVE feed bundle** — ship a monthly offline bundle of the CVE feeds so air-gapped or rate-limited hunts still get correlation without live internet.

## 2. Exploit-DB / PoC Matching (25105–25204)

25105. **Exploit-DB entry linker per finding** — automatically search Exploit-DB for each confirmed finding's CVE or software version and attach the matching EDB-ID links directly on the finding card.
25106. **Public-exploit availability badge** — show a green/amber/red badge on every finding indicating whether a public exploit exists, based on Exploit-DB, GitHub, and Metasploit coverage.
25107. **Exploit-upgrade suggester** — when a low-severity finding (e.g., reflected XSS) matches a known chain to RCE in public exploit write-ups, suggest the upgrade path with references.
25108. **Metasploit module auto-mapper** — map each CVE-backed finding to its Metasploit module name, rank, and reliability score so testers know exactly which module validates it.
25109. **Nuclei template matcher** — check the Nuclei template repository for templates covering the finding's CVE or misconfiguration, and link the template ID as a validation shortcut.
25110. **GitHub PoC-repo monitor** — track newly published PoC repositories for the target's stack CVEs and alert when a fresh weaponized PoC appears mid-hunt.
25111. **EDB verified-vs-unverified flag** — distinguish Exploit-DB verified exploits from unverified submissions on the finding card, since verified ones merit immediate escalation.
25112. **Exploit age timeline** — show a timeline from CVE publication to first public exploit to Metasploit module, indicating how commoditized the attack has become.
25113. **Multi-exploit aggregator** — merge Exploit-DB, Packet Storm, Vulners, and 0day.today entries for the same CVE into one canonical exploit record per finding.
25114. **PoC language filter** — filter matched exploits by language (Python, Ruby, Bash, PowerShell) so the agent picks PoCs compatible with the hunt's execution environment.
25115. **Remote-vs-local exploit classifier** — label matched exploits as remote, local, or webapp so the hunt plan only schedules remotely viable ones against the target.
25116. **Auth-required exploit flag** — mark exploits that need authentication and cross-check whether the hunt has valid credentials, avoiding dead-end exploit suggestions.
25117. **Exploit reliability scoring** — score public exploits by community feedback, stars, recent commits, and reported success to rank which PoC to try first.
25118. **Chained-exploit composer** — combine two public exploits (e.g., auth bypass EDB plus privilege-escalation EDB) into a staged validation plan with ordered steps.
25119. **EDB search-by-banner** — let analysts paste a service banner and get back ranked Exploit-DB entries, turning recon output directly into exploit candidates.
25120. **CVE-to-EDB freshness alert** — notify when a CVE previously without a public exploit gains one, triggering an automatic re-hunt of affected targets.
25121. **Exploit-kit inclusion check** — check whether the CVE's exploit is bundled in common kits or frameworks (CANVAS, Core Impact intel) as a sign of professional-grade weaponization.
25122. **PoC-to-detection rule pair** — for each matched exploit, also fetch the corresponding detection rule (Snort/Suricata/YARA) so the report includes defensive guidance.
25123. **Exploit variant differ** — when multiple PoCs exist for one CVE, diff them to identify the most reliable variant and note version-specific quirks.
25124. **Target-specific exploit tuner** — annotate matched exploits with the target's OS, architecture, and version to flag which PoCs need modification before use.
25125. **Exploit prerequisite checklist** — auto-generate a checklist from the exploit's README (open ports, required services, version constraints) and verify each against recon data.
25126. **Failed-exploit learning loop** — record which public exploits failed against which stack fingerprints so future hunts deprioritize known-dud PoCs.
25127. **Exploit-DB offline mirror** — maintain a local mirror of Exploit-DB metadata so exploit matching works even when the upstream site is unreachable.
25128. **EDB paper/write-up linker** — attach linked whitepapers and blog write-ups from Exploit-DB entries to findings for deeper root-cause analysis.
25129. **Shellcode-availability flag** — for memory-corruption CVEs, flag whether public shellcode exists for the target's architecture as an exploitability signal.
25130. **Web-shell variant matcher** — for RCE findings, match the target's stack against known web-shell compatibility matrices (PHP/ASPX/JSP) to suggest the right payload type.
25131. **Deserialization gadget-chain lookup** — for deserialization findings, query known gadget-chain databases (ysoserial, marshalsec) for chains matching the target's libraries.
25132. **SQLi-to-RCE exploit path** — when SQL injection is confirmed, check public exploit DBs for documented SQLi-to-RCE escalations specific to the detected DBMS version.
25133. **XSS-to-account-takeover playbook** — link stored-XSS findings to public ATO playbooks for the target's framework, showing the realistic next step.
25134. **Cloud-metadata SSRF write-up matcher** — match SSRF findings against public cloud-metadata exploitation write-ups for the target's cloud provider.
25135. **XXE-to-RCE public chain index** — index public XXE escalation chains by parser library so XXE findings get an immediate expected-impact rating.
25136. **JWT-attack PoC library** — maintain a curated library of public JWT attack PoCs (none-alg, JWKS spoofing, kid injection) matched to the target's JWT library.
25137. **OAuth-misconfig exploit gallery** — link OAuth findings to public exploit write-ups for the same IdP misconfiguration pattern.
25138. **GraphQL exploit-query collection** — match GraphQL findings against a collection of public malicious queries (introspection abuse, batching) for the detected engine.
25139. **CMS-specific exploit packs** — bundle Exploit-DB entries by CMS (WordPress, Drupal, Joomla) so a CMS fingerprint instantly loads its relevant exploit pack.
25140. **Router/IoT exploit cross-ref** — for exposed network devices, cross-reference RouterSploit modules with Exploit-DB entries for the detected firmware.
25141. **AD-attack technique linker** — link Active Directory findings (exposed LDAP, Kerberos) to public BloodHound/attack-path documentation for the observed misconfiguration.
25142. **Container-escape exploit index** — match container findings against public escape exploits indexed by runtime and version (runc, containerd CVEs).
25143. **Kubernetes exploit playbook links** — attach public K8s attack playbooks to findings involving exposed kubelet or API servers.
25144. **CI/CD exploit corpus** — link exposed Jenkins/GitLab findings to public pipeline-compromise write-ups for the detected version.
25145. **VPN-exploit one-click validator** — for VPN CVEs with public exploits, generate a safe non-destructive validation check referencing the EDB entry.
25146. **Email-server exploit matcher** — match Exchange/Postfix/Zimbra findings against public exploit entries with version-precision filtering.
25147. **File-upload RCE gallery** — link unrestricted-upload findings to public bypass technique collections for the detected stack (MIME, extension, polyglot).
25148. **LFI/RFI exploit archive** — match path-traversal findings against public LFI-to-RCE archives (log poisoning, PHP wrappers) for the target OS.
25149. **Template-injection payload DB** — link SSTI findings to public payload databases (SSTImap payloads) for the detected template engine.
25150. **Prototype-pollution PoC index** — match JS findings against public prototype-pollution PoCs indexed by library and version.
25151. **Dependency-confusion case linker** — link dependency findings to public dependency-confusion case studies for the target's package manager.
25152. **Typosquat-package incident feed** — correlate the target's dependency names against typosquatting incident reports to flag supply-chain risk.
25153. **Subdomain-takeover PoC archive** — match takeover findings against the public takeover-signature database (can-i-take-over-xyz) with service-specific PoC steps.
25154. **DNS-rebinding PoC collection** — link DNS findings to public rebinding PoC collections for the detected internal services.
25155. **CORS-exploit demo linker** — attach public CORS exploitation demos to misconfiguration findings showing realistic data-theft impact.
25156. **Clickjacking PoC generator** — for missing frame-ancestors findings, generate a clickjacking PoC referencing public UI-redressing techniques.
25157. **CSRF-to-ATO chain library** — link CSRF findings to public chains where CSRF enables account takeover on similar applications.
25158. **IDOR-to-mass-harvest write-ups** — attach public IDOR mass-harvest write-ups to IDOR findings to justify severity with precedent.
25159. **Broken-access-control case index** — link BAC findings to OWASP and public case studies of the same broken pattern for report credibility.
25160. **Race-condition exploit patterns** — match race-condition findings against public exploitation patterns (coupon abuse, balance manipulation) for the target's domain.
25161. **Business-logic abuse playbooks** — link logic flaws to public abuse playbooks from similar industries (fintech, e-commerce) for impact demonstration.
25162. **API mass-assignment PoC bank** — match mass-assignment findings against public PoC banks for the detected framework (Laravel, Rails, Django).
25163. **GraphQL authorization-bypass cases** — link GraphQL auth findings to public bypass case studies for the same engine.
25164. **WebSocket hijack PoC library** — attach public WebSocket hijacking PoCs to findings involving missing origin validation.
25165. **HTTP request-smuggling PoC matcher** — match smuggling findings against public TE.CL/CL.TE PoC collections for the detected frontend/backend server pair.
25166. **Cache-poisoning demo archive** — link cache findings to public cache-deception and poisoning demos for the detected CDN.
25167. **Host-header attack compendium** — attach public host-header attack write-ups (password-reset poisoning) to relevant findings.
25168. **Subdomain-bruteforce wordlist intel** — feed public subdomain wordlists ranked by recent takeover successes into the recon phase.
25169. **Credential-stuffing combo intel** — use public breach-combo statistics to inform credential-stuffing risk ratings without ever testing credentials.
25170. **Password-spray pattern library** — reference public password-spray TTP reports to assess the target's lockout and MFA posture risk.
25171. **MFA-bypass technique index** — link missing-MFA findings to public bypass technique reports (SIM swap, MFA fatigue) for the target's IdP.
25172. **Session-fixation PoC archive** — attach public session-fixation PoCs to session-management findings.
25173. **Cookie-tossing case studies** — link cookie findings to public cookie-tossing and cookie-bomb case studies for impact context.
25174. **SAML-attack PoC collection** — match SAML findings against public signature-wrapping and XXE-in-SAML PoC collections.
25175. **LDAP-injection exploit refs** — link LDAP injection findings to public LDAP exploitation references for the detected directory.
25176. **NoSQL-injection payload DB** — match NoSQL findings against public payload databases for MongoDB, Redis, and Cassandra operators.
25177. **XPath-injection PoC bank** — attach public XPath exploitation PoCs to XML-heavy findings.
25178. **Server-side prototype-pollution chains** — link Node.js findings to public server-side prototype-pollution RCE chains.
25179. **EL-injection payload index** — match expression-language findings against public EL payload indexes (SpEL, OGNL, MVEL).
25180. **Ruby/Python/Node RCE snippet DB** — maintain a language-indexed snippet database of public RCE one-liners mapped to finding types.
25181. **Exploit-DB CVE gap report** — list the target's CVEs that have NO public exploit yet, marking them as lower immediate risk but worth monitoring.
25182. **Private-exploit chatter monitor** — watch for forum claims of private exploits for the target's CVEs as an early-warning signal before public release.
25183. **Exploit-price tracker** — track dark-market asking prices for exploits affecting the target's stack as a proxy for attacker interest.
25184. **Bug-bounty duplicate predictor** — use public exploit availability to predict duplicate likelihood: widely-exploited CVEs are likely already reported.
25185. **Exploit-maturity SLA alerts** — alert when a CVE affecting a previously hunted target graduates from PoC to weaponized status.
25186. **Finding-to-CVE-to-EDB graph view** — render an interactive graph linking findings to CVEs to exploit entries for visual attack-path analysis.
25187. **Exploit attribution notes** — annotate exploits with known threat-actor usage (per public reports) so the report can cite who uses this technique.
25188. **Defensive-detection pairing** — for every matched exploit, suggest the Sigma or SIEM rule that would detect it, adding defender value to the report.
25189. **Patch-verification exploit replay** — after a target patches, replay the previously matched public exploit in a safe check-only mode to verify the fix.
25190. **Exploit-DB RSS per stack** — generate a per-target RSS feed of new Exploit-DB entries matching its stack for continuous monitoring.
25191. **Historical exploit success rates** — show, per CVE, the community-reported success rate of its public exploits to set realistic validation expectations.
25192. **Exploit dependency mapper** — map exploit dependencies (specific Python libs, tools) so the agent can auto-install what's needed for validation.
25193. **Sandbox-safe exploit tester** — run matched PoCs against a local sandbox replica first to confirm they work before any target interaction.
25194. **Exploit output parser** — parse public exploit outputs into structured evidence (proof of RCE vs. crash) for consistent finding validation.
25195. **Multi-CVE exploit bundler** — when one exploit covers multiple CVEs on the target, bundle them into a single validation task to save hunt time.
25196. **EDB author-reputation weighting** — weight exploits by author reputation and history to prefer trustworthy PoCs.
25197. **Exploit license checker** — flag exploits with restrictive licenses before the agent reuses their code in reports or automation.
25198. **Air-gapped exploit pack builder** — build an offline pack of matched exploits and PoCs for hunts in disconnected environments.
25199. **Exploit-to-patch-diff linker** — link each exploit to the vendor patch diff that fixes it, helping developers understand the root cause.
25200. **Report exploit-reference section** — auto-generate a references appendix in the PDF report with every matched EDB-ID, CVE, and write-up link.
25201. **Exploit-technique MITRE tagger** — tag each matched exploit with its MITRE ATT&CK technique IDs for downstream TTP correlation.
25202. **Finding severity auto-bump** — automatically raise a finding's severity when a weaponized public exploit exists, with the EDB evidence cited.
25203. **Stale-exploit archiver** — archive exploits for CVEs patched across the target's entire history so old PoCs don't resurface in new hunts.
25204. **Exploit-intel hunt debrief** — end each hunt with a debrief: which public exploits were relevant, which were tried, and which new ones to watch.

## 3. Threat Actor TTP Mapping (25205–25304)

25205. **MITRE ATT&CK auto-tagger for findings** — assign ATT&CK technique IDs (e.g., T1190, T1078) to every finding automatically so hunts speak the same language as threat intel teams.
25206. **APT group overlap panel** — for each hunt, show which named APT groups are publicly reported to use the same techniques observed, with source citations.
25207. **TTP coverage heatmap per hunt** — render a MITRE heatmap of techniques the hunt tested versus techniques known to target the victim's industry, highlighting blind spots.
25208. **Technique prevalence scorer** — rank hunt checks by how frequently each ATT&CK technique appears in recent threat reports, prioritizing what real attackers actually use.
25209. **Tactic-stage progress tracker** — map hunt progress onto the 14 ATT&CK tactics (Recon through Impact) so users see which kill-chain stages were exercised.
25210. **Sub-technique precision mapping** — go beyond technique level to sub-techniques (e.g., T1190.001) when the finding matches a specific variant, improving intel fidelity.
25211. **ATT&CK-to-hunt-check reverse index** — let users pick an ATT&CK technique and instantly see which Dark-Matter checks cover it and which hunts tested it.
25212. **Threat-actor profile cards** — build cards for major APT and cybercrime groups (tools, malware, preferred TTPs) and surface the card when a hunt's TTPs overlap.
25213. **Industry-targeting overlay** — overlay threat-intel data on which sectors each APT group targets, warning when the hunt target sits in a hot sector.
25214. **Geography-targeting overlay** — show which regions the overlapping threat actors focus on, adding geopolitical context to the hunt's risk picture.
25215. **TTP novelty detector** — flag when a hunt uncovers a technique combination not previously associated with known groups, marking it as potentially novel tradecraft.
25216. **Campaign-to-hunt correlator** — match the hunt's observed techniques against named campaigns (per public reporting) and list the closest campaign matches.
25217. **Malware-family TTP linker** — link findings to malware families known for the same technique (e.g., web-shell families for RCE findings) with intel references.
25218. **Tool-to-actor attribution hints** — when recon detects attacker tools (cobalt-strike beacons, specific scanners), map them to the actors known to favor those tools.
25219. **TTP timeline comparator** — compare the sequence of techniques in the hunt against published attack timelines to estimate how far along a real attack would be.
25220. **Defensive-gap mapper** — for each ATT&CK technique the hunt validated, show the corresponding detection opportunities defenders are likely missing.
25221. **ATT&CK Navigator export** — export the hunt's technique coverage as a MITRE ATT&CK Navigator layer file for sharing with SOC teams.
25222. **Group-to-CVE affinity index** — index which CVEs each major threat actor exploits, and prioritize those CVEs when they match the target's stack.
25223. **Ransomware-affiliate TTP pack** — maintain TTP packs for active RaaS affiliates (initial access, lateral movement, exfiltration) and check the target's exposure to each stage.
25224. **Initial-access-broker TTP watch** — track IAB-preferred initial-access techniques (VPN exploits, RDP brute force, phishing) and weight hunt checks accordingly.
25225. **Living-off-the-land technique checks** — add LOLBAS/LOLBIN-aware checks mapping findings to legitimate-tool abuse techniques attackers prefer.
25226. **ATT&CK technique-to-CWE bridge** — bridge ATT&CK techniques to CWEs so a code-level finding instantly shows its operational technique equivalent.
25227. **Hunt-plan ATT&CK preview** — before a hunt runs, preview the ATT&CK coverage the plan will achieve so users can add missing techniques.
25228. **TTP coverage trend across hunts** — chart technique coverage across repeated hunts to show whether testing breadth is improving.
25229. **Peer-benchmark TTP comparison** — anonymously compare a target's TTP exposure against similar-industry targets to contextualize risk.
25230. **Red-team emulated adversary packs** — bundle hunt checks into emulated adversary profiles (e.g., emulated FIN7) for adversary-focused assessments.
25231. **ATT&CK data-source mapping** — map each hunt check to the ATT&CK data sources it would generate, helping defenders tune logging.
25232. **Technique detection-difficulty rating** — rate each validated technique by how hard it is for typical defenses to detect, informing severity.
25233. **TTP-to-business-impact translator** — translate technique findings into business-impact language (data theft, downtime, extortion) for executives.
25234. **Threat-actor chatter monitor** — watch public intel for chatter about the target's industry or tech stack from tracked actor groups.
25235. **TTP kill-chain position marker** — mark each finding with its kill-chain position so reports show whether issues cluster at initial access or lateral movement.
25236. **Multi-actor technique consensus** — highlight techniques used by five or more distinct groups as highest-priority, since they represent commoditized tradecraft.
25237. **Emerging-technique radar** — track newly added ATT&CK techniques and auto-create hunt checks for them before they become mainstream.
25238. **Deprecated-technique pruner** — retire hunt checks for ATT&CK techniques that intel shows are no longer used in the wild.
25239. **TTP-based hunt templates** — offer one-click hunt templates like "Ransomware initial access" or "APT29-style cloud" built from actor TTP packs.
25240. **Technique-pair co-occurrence intel** — use intel on which techniques co-occur to suggest follow-up checks when one technique is confirmed.
25241. **ATT&CK mitigations linker** — attach MITRE's published mitigations for each validated technique directly into the remediation section.
25242. **Detection-rule suggestion per technique** — suggest Sigma rules for each ATT&CK technique the hunt validated, giving defenders immediate value.
25243. **Threat-group infrastructure overlap** — check whether the target's IPs or domains appear in published threat-actor infrastructure reports.
25244. **TTP confidence scoring** — score how confidently each finding maps to a technique (exact vs. approximate) to avoid overclaiming attribution.
25245. **Actor-motivation classifier** — classify overlapping actors by motivation (espionage, financial, disruption) to frame the threat narrative correctly.
25246. **TTP hunt replay mode** — replay a past hunt's technique sequence against a new target to compare defensive posture across assets.
25247. **Cross-hunt technique frequency** — show which techniques appear across many hunts, revealing systemic weaknesses in the user's portfolio.
25248. **ATT&CK version tracker** — track MITRE CTI releases and auto-update technique mappings when IDs or names change.
25249. **Custom TTP pack builder** — let users build custom technique packs from their own threat intel and inject them into hunt plans.
25250. **TTP coverage SLA** — set coverage targets (e.g., 80% of relevant techniques tested quarterly) and track progress per target.
25251. **Technique-to-log-source advisor** — advise which logs would prove or disprove each technique's exploitability on the target's infrastructure.
25252. **Adversary emulation scheduler** — schedule periodic emulated-adversary hunts rotating through different actor profiles for continuous validation.
25253. **TTP gap-to-backlog converter** — convert untested high-priority techniques into backlog items with suggested checks for the next hunt.
25254. **Threat-actor tooling signatures** — maintain signatures of actor tooling (user agents, JA3, URL patterns) and scan recon data for matches.
25255. **TTP-based severity adjustment** — raise severity when a finding's technique is trending upward in threat reports for the target's sector.
25256. **Sector-specific technique packs** — auto-load technique packs tailored to the target's sector (finance, healthcare, government) from sector intel reports.
25257. **TTP intel digest per hunt** — attach a one-page intel digest to each hunt report: relevant actors, campaigns, and technique trends.
25258. **Technique-first hunt mode** — offer a mode where the user picks ATT&CK techniques first and the agent builds a hunt plan around them.
25259. **ATT&CK-to-compliance mapper** — map technique coverage to compliance frameworks (NIST 800-53, ISO 27001) for audit-ready reporting.
25260. **Threat-actor victimology matcher** — match the target's profile (size, sector, region) against actor victimology to estimate targeting likelihood.
25261. **TTP deception-awareness** — flag when a finding's technique is commonly used as a decoy, advising deeper investigation before concluding.
25262. **Multi-stage attack reconstructor** — reconstruct plausible multi-stage attacks from the hunt's findings using technique-transition intel.
25263. **ATT&CK technique explainer cards** — embed plain-language explainer cards for each technique in reports so non-technical readers follow along.
25264. **Technique-mitigation cost estimator** — estimate remediation cost per technique using industry data to help prioritize security spending.
25265. **TTP-driven retest triggers** — trigger retests when new intel shows an actor adopting a technique the target was previously vulnerable to.
25266. **Actor infrastructure fingerprint DB** — maintain fingerprints of known actor infrastructure (certificates, favicons, headers) and scan targets for matches.
25267. **TTP hunt scoring** — score each hunt by technique breadth, depth, and realism to gamify thorough testing.
25268. **Threat-intel confidence labels** — label every actor/TTP assertion with intel confidence (high/medium/low) and source reliability.
25269. **TTP false-attribution guardrails** — explicitly warn against attributing findings to specific actors, framing overlaps as TTP similarity only.
25270. **Campaign IOC cross-check** — check the target's domains and IPs against published campaign IOC lists during recon.
25271. **TTP-based check ordering** — order hunt checks to mirror real attack sequences (recon → initial access → execution) for realistic validation.
25272. **Technique variant enumerator** — for each technique, enumerate its known variants from intel and ensure the hunt tests the variant matching the target's stack.
25273. **ATT&CK matrix gap report** — produce a matrix-style gap report per target showing tested, vulnerable, and untested techniques.
25274. **Actor TTP diff viewer** — diff two actors' TTP profiles to help users understand which adversary model fits their threat picture.
25275. **TTP-to-patch priority** — prioritize patches by counting how many tracked actors exploit each underlying technique.
25276. **Hunt-technique attribution log** — log which techniques were tested, by which check, and with what result for forensic completeness.
25277. **Emerging actor watchlist** — maintain a watchlist of newly named threat groups and alert when their TTPs intersect a hunt's findings.
25278. **TTP intel API** — expose the TTP correlation engine as an API so external SOAR platforms can query technique mappings.
25279. **Technique-simulation sandbox** — simulate technique execution in a sandbox to validate detection logic without touching the target.
25280. **ATT&CK training-mode hunts** — run training hunts that teach junior testers each technique with guided intel context.
25281. **TTP correlation confidence decay** — decay actor-overlap confidence as intel ages, since groups evolve their tradecraft.
25282. **Multi-source TTP fusion** — fuse technique data from MITRE, vendor reports, and community intel into one normalized technique record.
25283. **Technique-to-asset criticality** — weight techniques by the criticality of assets they could reach from the finding's position.
25284. **TTP hunt debrief generator** — auto-generate a debrief mapping the hunt's journey onto ATT&CK with actor-overlap commentary.
25285. **Adversary-profile versioning** — version adversary packs as intel updates, and note which pack version each hunt used.
25286. **TTP coverage API badges** — provide embeddable badges showing a target's ATT&CK coverage score for dashboards.
25287. **Technique-risk heatmap by sector** — show sector-wide technique risk heatmaps so users see where their target stands.
25288. **Actor-tool CVE linker** — link actor-preferred tools to the CVEs those tools exploit, closing the loop between TTP and CVE intel.
25289. **TTP-based phishing relevance** — when phishing-related techniques overlap, assess the target's email-security posture relevance.
25290. **Supply-chain TTP overlay** — overlay supply-chain attack techniques when the target's vendor ecosystem matches known compromise patterns.
25291. **Cloud TTP pack** — maintain cloud-specific technique packs (AWS, Azure, GCP) mapped to the target's detected cloud footprint.
25292. **OT TTP pack** — maintain operational-technology technique packs for ICS-adjacent targets from ICS intel reports.
25293. **Mobile TTP pack** — maintain mobile technique packs when the target has mobile apps or MDM infrastructure.
25294. **Insider-threat TTP lens** — apply an insider-threat technique lens to findings involving excessive permissions or weak segregation.
25295. **TTP-to-insurance mapper** — map technique exposure to cyber-insurance risk factors for underwriting conversations.
25296. **Board-level TTP briefing** — generate a board-ready briefing translating TTP exposure into strategic risk language.
25297. **Technique-mitigation playbook links** — link each validated technique to public mitigation playbooks from CISA and vendors.
25298. **TTP intel freshness indicator** — show the age of the intel behind each actor-overlap claim so users judge currency.
25299. **Cross-platform technique normalizer** — normalize technique mappings across Windows, Linux, macOS, and cloud so mixed targets get coherent coverage.
25300. **TTP hunt comparison view** — side-by-side technique coverage comparison across multiple hunts or targets.
25301. **Actor-motivation trend tracker** — track how actor motivations shift over time and adjust the threat narrative in recurring hunts.
25302. **Technique-exploit-kit mapping** — map techniques to the exploit kits and frameworks that implement them, indicating commoditization.
25303. **TTP-driven executive alert** — send an executive alert when a hunt validates techniques currently trending in the target's sector.
25304. **ATT&CK correlation audit trail** — keep an audit trail of every intel source behind each technique mapping for defensible reporting.

## 4. Dark Web Monitoring Hooks (25305–25404)

25305. **Target-domain leak-forum watcher** — continuously monitor major leak forums for mentions of the target's domains and alert when new threads appear.
25306. **Credential-dump correlation engine** — check breach compilations for the target's corporate email domains and report what fraction of users appear in dumps.
25307. **Ransomware leak-site monitor** — watch active ransomware data-leak sites for the target's name and trigger an emergency alert on a match.
25308. **Combo-list domain scanner** — scan circulating combo lists for the target's domains to estimate credential-stuffing exposure without testing logins.
25309. **Stealer-log lookup** — query stealer-log databases (RedLine, Raccoon-style logs) for the target's domains to find compromised employee sessions.
25310. **Initial-access-broker listing alerts** — monitor IAB listings for access being sold to the target's network or VPN, with price and access-type details.
25311. **Database-sale tracker** — watch forums for databases claimed to belong to the target, capturing schema samples and row counts as evidence.
25312. **Source-code leak detector** — monitor GitHub, GitLab, and paste sites for leaked repositories matching the target's proprietary code fingerprints.
25313. **API-key leak scanner** — scan public pastes and dumps for API keys and tokens referencing the target's services, then advise rotation.
25314. **Internal-document leak watch** — monitor for leaked internal documents (pitch decks, employee lists) bearing the target's branding.
25315. **Employee PII exposure report** — aggregate public breach data to show which employee roles have exposed PII, informing spear-phishing risk.
25316. **Executive dox monitor** — watch for doxxing threads targeting the target's executives, which often precede targeted attacks.
25317. **Telegram channel intel feed** — monitor threat-actor Telegram channels for mentions of the target's industry, tools, or infrastructure.
25318. **Discord server leak watch** — track invite-only threat Discord servers (via intel partners) for target mentions and shared access.
25319. **Jabber/XMPP threat chatter** — ingest threat-actor chat summaries for chatter about the target's sector or technology stack.
25320. **Forum reputation tracker** — track which threat actors discuss the target's sector to anticipate TTPs likely to be used.
25321. **Ransom-negotiation leak watch** — monitor for leaked ransom negotiations involving similar companies to understand going ransom demands.
25322. **Double-extortion blog scraper** — scrape ransomware blogs for victim announcements and correlate victim profiles with the target.
25323. **Triple-extortion signal detector** — watch for DDoS-for-extortion chatter naming the target's sector as a pressure tactic indicator.
25324. **Data-auction monitor** — watch dark-web auction listings for data lots attributed to the target, including starting bids.
25325. **Access-as-a-service price tracker** — track going prices for the target's industry access to gauge attacker interest levels.
25326. **VPN-credential sale alerts** — alert when VPN or RDP credentials for the target's netblocks appear for sale.
25327. **Email-access sale detector** — monitor for corporate email account sales (O365/Gmail) under the target's domain.
25328. **Cloud-console access listings** — watch for AWS/Azure console access sales tied to the target's cloud footprint.
25329. **Domain-sale impersonation watch** — monitor domain marketplaces for lookalike domains of the target being sold, a phishing precursor.
25330. **SSL-certificate abuse monitor** — check Certificate Transparency and dark sources for rogue certificates issued for the target's domains.
25331. **Subdomain enumeration leak check** — compare the target's discovered subdomains against leaked subdomain lists to find forgotten assets.
25332. **GitHub dork-result archiver** — archive GitHub code-search results for the target's secrets and track whether leaked secrets get rotated.
25333. **Paste-site keyword watcher** — watch Pastebin, Ghostbin, and Rentry for the target's brand, domains, and employee names.
25334. **Breach-notification correlator** — correlate public breach disclosures with the target's vendor list to flag supply-chain breach exposure.
25335. **Vendor-breach ripple mapper** — when a vendor of the target is breached, map which of the target's integrations and data flows are affected.
25336. **Third-party credential spillover** — check whether the target's SaaS vendors appear in breach dumps, indicating SSO or integration risk.
25337. **Dark-web mention sentiment** — analyze sentiment of target mentions (for sale, free leak, discussion) to triage urgency.
25338. **Leak credibility scorer** — score leak claims by poster reputation, sample quality, and corroboration to filter fake leak claims.
25339. **Sample-data validator** — safely analyze free samples from leak posts (hashes, redacted rows) to assess claim credibility without touching stolen data.
25340. **Leak timeline reconstructor** — reconstruct when the breach likely occurred from file timestamps in samples to advise the incident-response window.
25341. **Attacker-OPSEC mistake tracker** — track OPSEC failures by actors targeting the sector (leaked IPs, reused handles) as bonus attribution intel.
25342. **Handle-to-actor linker** — link forum handles discussing the target to known actor profiles via public intel.
25343. **Forum-to-Telegram bridge tracker** — follow actors across platforms to catch target mentions that start on forums and move to private channels.
25344. **Leak-forum takedown monitor** — track forum seizures and migrations so monitoring coverage follows actors to new homes.
25345. **Mirror-site coverage checker** — ensure leak-site monitoring covers mirrors and onion alternates, not just the primary domain.
25346. **Ransomware victim-profile matcher** — match the target against published victim profiles (revenue, sector, region) of each active group.
25347. **Dwell-time estimator** — use leak-post timestamps and sample dates to estimate attacker dwell time for incident-response planning.
25348. **Exfiltration-size estimator** — estimate exfiltrated data volume from leak-post claims to scope potential impact.
25349. **Leak-post language analyzer** — analyze ransom-post language for group attribution when the leak site branding is ambiguous.
25350. **Countdown-timer tracker** — track ransomware leak-site countdown timers naming similar victims to predict publication and prepare comms.
25351. **Victim-removal watcher** — watch for victims disappearing from leak sites (paid or resolved) to infer ransom-payment trends in the sector.
25352. **Re-victimization risk flag** — flag targets previously listed on leak sites, since repeat victimization is statistically common.
25353. **Affiliate-recruitment monitor** — watch RaaS affiliate recruitment for the target's sector being explicitly sought.
25354. **RaaS update bulletin** — summarize RaaS platform updates (new encryptors, Linux/ESXi focus) relevant to the target's infrastructure.
25355. **ESXi-encryptor trend alert** — alert when ransomware groups shift to ESXi-focused encryptors if the target runs VMware.
25356. **Backup-deletion TTP advisory** — issue advisories when intel shows groups actively deleting the target's backup product before encryption.
25357. **EDR-killer tool tracker** — track EDR-killer tools circulating for the target's EDR product as a defense-evasion warning.
25358. **Zero-day broker chatter** — monitor exploit-broker chatter for zero-days affecting the target's stack, even before public disclosure.
25359. **Phishing-kit resale tracker** — track phishing kits impersonating the target's brand being resold, indicating campaign scale-up.
25360. **Brand-impersonation kit census** — count active phishing kits impersonating the target across kit repositories for a live threat census.
25361. **Smishing-kit brand watch** — extend brand monitoring to SMS phishing kits impersonating the target's services.
25362. **Fake-app impersonation monitor** — watch third-party app stores and APK sites for trojanized apps impersonating the target's brand.
25363. **Social-media impersonation scan** — scan for fake executive and support accounts impersonating the target ahead of social-engineering waves.
25364. **Customer-targeting scam tracker** — track scams targeting the target's customers (fake support, refund scams) that erode brand trust.
25365. **BEC-theme monitor** — monitor BEC theme reports for lures impersonating the target's executives or vendors.
25366. **Payroll-diversion chatter** — watch for chatter about payroll-diversion schemes hitting the target's sector.
25367. **Invoice-fraud kit tracker** — track invoice-fraud kits customized for the target's industry vertical.
25368. **Recruitment-scam monitor** — watch for fake job-offer scams using the target's brand, which harvest applicant PII.
25369. **Crypto-drainer brand abuse** — monitor crypto-drainer kits impersonating the target's fintech brand if applicable.
25370. **Malware-as-a-service price index** — track MaaS subscription prices relevant to the target's platform mix as an attacker-cost indicator.
25371. **Infostealer distribution tracker** — track which infostealers are being distributed via fake software matching the target's industry tools.
25372. **Loader-service monitor** — monitor loader services (for initial access) advertising the target's sector as a specialty.
25373. **Crypting-service abuse watch** — watch crypting services for samples impersonating the target's software installers.
25374. **Bulletproof-hosting intel** — track bulletproof hosts favored by actors targeting the sector for infrastructure-blocking recommendations.
25375. **Fast-flux domain tracker** — monitor fast-flux domains impersonating the target's services for takedown referrals.
25376. **Domain-generation-algorithm watcher** — watch DGA families with lures themed around the target's industry.
25377. **Dark-web search API** — expose the monitoring as a search API so analysts can query target mentions on demand.
25378. **Historical mention archive** — keep a timestamped archive of every target mention for trend analysis and legal evidence.
25379. **Mention-velocity alerting** — alert when mention velocity spikes, which often precedes a public leak or campaign.
25380. **Cross-forum entity resolution** — resolve the same leak or actor across forums to avoid double-counting and to build a unified picture.
25381. **Leak-notification workflow** — provide a one-click workflow to notify the target's security contact with a sanitized leak summary.
25382. **Takedown-request helper** — generate takedown-request drafts for phishing and leak content with evidence attachments.
25383. **Law-enforcement evidence pack** — compile leak evidence into a structured pack suitable for law-enforcement referral.
25384. **Breach-coach briefing generator** — generate a breach-coach-ready briefing summarizing exposure for legal counsel.
25385. **Customer-notification risk assessor** — assess whether leaked data triggers customer-notification obligations under relevant breach laws.
25386. **Regulatory-filing advisor** — advise which regulators likely require notification based on the leaked data types and jurisdictions.
25387. **Cyber-insurance notifier** — prepare the evidence summary an insurer needs when leaked data suggests a covered event.
25388. **Dark-web intel confidence labels** — label every dark-web assertion with source reliability and information credibility ratings.
25389. **Source-protection redaction** — automatically redact collection methods and source identities from any shared dark-web intel.
25390. **Legal-review queue** — route high-sensitivity leak findings through a legal-review queue before analyst action.
25391. **Monitoring-coverage dashboard** — show which forums, channels, and leak sites are covered, with last-successful-collection timestamps.
25392. **Coverage-gap recommender** — recommend new sources to monitor based on where similar targets' leaks first appeared.
25393. **Intel-sharing community opt-in** — let users opt into anonymized sharing of leak indicators to help protect similar organizations.
25394. **Dark-web hunt trigger** — automatically launch a focused hunt when dark-web intel indicates the target is being actively discussed.
25395. **Leak-to-hunt feedback loop** — feed confirmed leak details (e.g., leaked admin panel URL) back into the hunt as new scope.
25396. **Post-hunt dark-web sweep** — run a dark-web sweep after each hunt to check whether hunted vulnerabilities appear in exploit chatter.
25397. **Executive dark-web brief** — produce an executive-friendly brief of dark-web exposure without technical jargon or sensitive sources.
25398. **Board-level exposure score** — compute a single dark-web exposure score for board reporting, with trend over time.
25399. **Remediation-priority from leaks** — prioritize remediation using leaked data: if admin credentials leaked, force password-reset and MFA actions first.
25400. **Credential-reset campaign planner** — plan a targeted credential-reset campaign for users found in dumps, with comms templates.
25401. **MFA-enrollment push trigger** — trigger an MFA-enrollment push for departments with the highest dump exposure.
25402. **Security-awareness targeting** — target phishing simulations at departments most represented in stealer logs.
25403. **Vendor-risk dark-web score** — score the target's critical vendors by their own dark-web exposure for supply-chain risk ranking.
25404. **Dark-web intel retention policy** — enforce retention and deletion policies on collected dark-web data to stay within legal bounds.

## 5. Phishing Kit Detection (25405–25504)

25405. **Phishing-kit fingerprint database** — maintain hashes and structural fingerprints of known phishing kits and scan the target's infrastructure for hosted copies indicating compromise.
25406. **Kit source-code signature matcher** — match distinctive kit code patterns (obfuscation styles, exfil endpoints) against files found on the target's web servers.
25407. **New-domain typosquat early-warning alerts** — monitor new domain registrations for typosquats and homoglyphs of the target's brand and alert within hours of registration.
25408. **Certificate Transparency brand watch** — watch CT logs for certificates issued to lookalike domains of the target, catching phishing infrastructure at setup time.
25409. **Phishing-kit exfil endpoint extractor** — when a kit is found on target infrastructure, extract its exfiltration endpoints (Telegram bots, email dropboxes) for blocking.
25410. **Kit admin-panel detector** — detect phishing-kit admin panels hosted on the target's servers, which indicate the compromise is being actively managed.
25411. **Compromised-subdomain phishing check** — scan the target's own subdomains for phishing content, since attackers love abusing legitimate subdomains for credibility.
25412. **Open-redirect-to-kit chain alert** — flag when the target's open redirects are being used to launder phishing-kit URLs, with the redirect chains documented.
25413. **Kit version tracker** — track which kit versions impersonate the target over time to identify the most active kit developers targeting the brand.
25414. **Anti-phishing-kit cloaking detector** — detect kits using cloaking (showing benign content to scanners) and document the cloaking logic for takedown evidence.
25415. **Phishing-kit geofencing analyzer** — analyze kit geofencing rules to determine which victim geographies the campaign targets.
25416. **Kit victim-log parser** — parse victim logs left on compromised kit installs to estimate how many of the target's users were phished.
25417. **Credential-harvest flow mapper** — map the kit's full credential-harvest flow (pages, fields, exfil) to advise exactly what data was stolen.
25418. **2FA-bypass kit detector** — identify kits with real-time 2FA/MFA relay capabilities (Evilginx-style) impersonating the target's login.
25419. **Evilginx-config signature scan** — scan target infrastructure for Evilginx and Modlishka configuration artifacts indicating AiTM phishing operations.
25420. **QR-code phishing kit watch** — monitor for quishing kits impersonating the target, a fast-growing vector bypassing email link scanning.
25421. **Smishing-kit infrastructure mapper** — map SMS phishing infrastructure impersonating the target, including sender IDs and short codes.
25422. **Voice-phishing (vishing) kit tracker** — track vishing scripts and VoIP infrastructure impersonating the target's support lines.
25423. **Kit reuse across brands** — identify when the same kit backend serves phishing for multiple brands, revealing shared criminal infrastructure.
25424. **Phishing-kit hosting-provider report** — identify bulletproof or compromised hosts serving the kits and auto-generate abuse reports.
25425. **Fast takedown evidence pack** — compile screenshots, DNS records, and kit fingerprints into a takedown-ready evidence pack for registrars.
25426. **Registrar abuse-contact resolver** — resolve the correct abuse contacts for lookalike domains to accelerate takedown requests.
25427. **Brand-protection feed export** — export lookalike domains and kit indicators as a feed the target's email gateway can ingest for blocking.
25428. **DMARC-visibility correlator** — correlate phishing-kit activity with the target's DMARC reports to show which campaigns bypass authentication.
25429. **BEC-kit theme detector** — detect business-email-compromise kits themed around the target's invoicing and payment workflows.
25430. **Payroll-phishing seasonal alerts** — warn ahead of payroll and tax seasons when phishing kits impersonating HR/payroll spike for the target's sector.
25431. **Kit-blocked-by-target check** — verify whether the target's own email security blocks the kit's lures, testing defensive coverage with safe samples.
25432. **User-report triage accelerator** — ingest user-reported phishing emails and auto-match them against known kit fingerprints for instant triage.
25433. **Phishing-simulation kit reuse** — convert sanitized real-kit templates into authorized phishing-simulation lures for the target's awareness program.
25434. **Kit-obfuscation deobfuscator** — automatically deobfuscate kit JavaScript to reveal exfil endpoints and logic for analysts.
25435. **Kit developer attribution** — attribute kits to developers via code-style and reuse analysis, tracking which developers target the brand repeatedly.
25436. **Kit-panel credential hunter** — extract hardcoded credentials from kit admin panels to identify the operators' infrastructure.
25437. **Telegram-bot exfil mapper** — map the Telegram bots kits use for exfiltration and report them for platform takedown.
25438. **Email-dropbox identifier** — identify the email accounts kits exfiltrate to, supporting investigator follow-up.
25439. **Kit C2 overlap with malware** — check whether kit exfil infrastructure overlaps with known malware C2, indicating shared criminal services.
25440. **Phishing-kit lifespan tracker** — track how long kits impersonating the target stay live to measure takedown effectiveness.
25441. **Campaign-volume estimator** — estimate campaign email volume from kit victim logs and infrastructure scale.
25442. **Victim-demographic profiler** — profile phished victims by geography and role from kit logs to target awareness efforts.
25443. **Credential-reuse risk scorer** — score the risk that phished corporate credentials are reused on the target's VPN and SSO from kit field analysis.
25444. **Session-cookie theft detector** — identify kits stealing session cookies (not just passwords) to trigger session-invalidation responses.
25445. **Cookie-replay impact assessor** — assess which of the target's applications are vulnerable to replayed stolen sessions from kit analysis.
25446. **Kit-bypassed MFA methods** — catalog which MFA methods each kit defeats (SMS, push, TOTP) to advise stronger phishing-resistant MFA.
25447. **Passkey-adoption recommender** — recommend passkey rollout priority based on how effectively kits bypass the target's current MFA.
25448. **Login-page clone detector** — detect pixel-perfect clones of the target's login pages in kit repositories before campaigns launch.
25449. **Brand-asset abuse monitor** — monitor for the target's logos and CSS being bundled in kits, an early campaign indicator.
25450. **Favicon-impersonation scanner** — scan lookalike sites for the target's favicon hash, a quick phishing-site signal.
25451. **HTML-title impersonation watch** — watch for the target's brand in page titles of suspicious newly registered domains.
25452. **Screenshot-comparison engine** — visually compare suspected phishing pages against the real login page and score similarity.
25453. **Visual-brand-confusion scorer** — score how convincingly a kit mimics the target's brand to prioritize takedowns by deception quality.
25454. **Mobile-app phishing overlay** — detect Android overlay malware and fake apps impersonating the target's mobile login.
25455. **PWA-impersonation detector** — detect malicious progressive web apps mimicking the target's login for credential theft.
25456. **Browser-in-the-browser detector** — identify BiTB attack templates impersonating the target's SSO provider.
25457. **Consent-phishing kit watch** — monitor for OAuth consent-phishing kits abusing the target's app ecosystem.
25458. **Calendar-invite phishing tracker** — track malicious calendar invites impersonating the target's meeting workflows.
25459. **QR-code payload analyzer** — decode QR codes in quishing lures to extract final kit URLs for blocking.
25460. **URL-shortener laundering tracker** — trace kit URLs through shortener chains to find the true hosting for takedown.
25461. **Compromised-site kit host detector** — identify legitimate compromised sites hosting the target-impersonating kits for victim-site notification.
25462. **Shared-hosting kit cluster finder** — find clusters of kits on shared hosting to identify compromised providers needing outreach.
25463. **Kit-update cadence monitor** — monitor how fast kit developers update templates after the target changes its login page, measuring adversary agility.
25464. **Target-login-change tripwire** — advise the target when changing login-page design, since it temporarily breaks kits and forces adversary rework.
25465. **Honey-credential injector** — plant trackable honey credentials in suspected kit flows (via authorized testing) to trace exfil paths.
25466. **Kit-operator OPSEC profiler** — profile operator OPSEC from kit artifacts to support law-enforcement attribution.
25467. **Cross-kit code-reuse graph** — build a graph of code reuse across kits to map the developer ecosystem targeting the brand.
25468. **Kit-marketplace price tracker** — track prices of target-impersonating kits on criminal marketplaces as an interest indicator.
25469. **Custom-kit commission watcher** — watch for actors commissioning custom kits for the target, signaling a high-value targeted campaign.
25470. **Kit-tutorial monitor** — monitor tutorials for deploying the target's kits, which precede campaign scale-up by novices.
25471. **Phishing-kit YARA rule generator** — auto-generate YARA rules from confirmed kits for the target's gateway and endpoint teams.
25472. **Gateway-blocklist publisher** — publish confirmed kit URLs and hashes to the target's gateways via STIX for automated blocking.
25473. **DNS-firewall feed** — feed kit domains to DNS firewalls for network-level blocking of resolution.
25474. **Browser-safe-browsing reporter** — submit confirmed phishing URLs to Safe Browsing and SmartScreen for browser-level warnings.
25475. **Social-platform impersonation reporter** — report fake brand accounts used in phishing distribution for platform removal.
25476. **Ad-network malvertising check** — check whether kits are distributed via malvertising on ad networks for ad-platform abuse reports.
25477. **SEO-poisoning kit detector** — detect kits distributed via poisoned search results impersonating the target's support pages.
25478. **Typosquat-traffic estimator** — estimate traffic to lookalike domains from passive DNS to quantify exposure.
25479. **Defensive-domain recommender** — recommend which lookalike domains the target should defensively register based on typo models.
25480. **Lookalike-domain risk ranker** — rank lookalike domains by deception potential (visual similarity, TLD trust) for prioritized action.
25481. **Homoglyph-attack scanner** — scan for internationalized domain names visually identical to the target's domain.
25482. **Subdomain-spoof detector** — detect attacker subdomains like secure-target.com vs. target-secure.com confusion patterns.
25483. **Combo-squat domain watcher** — watch for combo-squatting domains (target-login.com, target-support.com) at registration.
25484. **Expired-domain hijack monitor** — monitor the target's expired domains for re-registration by phishers.
25485. **DNS-hijack indicator** — detect DNS changes suggesting the target's own domains were hijacked for phishing.
25486. **BGP-hijack phishing correlator** — correlate BGP anomalies with phishing waves as a sophisticated-attack indicator.
25487. **Email-header forensic helper** — provide header-analysis tooling to trace kit-distributed phish back to sending infrastructure.
25488. **SPF/DKIM-gap exploiter mapper** — map which of the target's mail gaps each kit campaign exploits to prioritize email-auth fixes.
25489. **Lookalike-sender detector** — detect display-name and cousin-domain spoofing in reported phish for rule creation.
25490. **Phishing-kit victim notifier** — help identify phished customers from kit logs for notification and remediation.
25491. **Fraud-loss estimator** — estimate fraud losses from kit victim counts and average transaction values for business cases.
25492. **Brand-trust impact survey trigger** — trigger customer trust surveys after major kit campaigns to measure brand damage.
25493. **Kit-campaign timeline builder** — build visual timelines of kit campaigns against the target for incident retrospectives.
25494. **Takedown SLA tracker** — track time from detection to takedown per kit to measure brand-protection performance.
25495. **Registrar-responsiveness scorecard** — score registrars by takedown speed to inform future domain-strategy choices.
25496. **Hosting-provider scorecard** — score hosts by how fast they remove kit content for abuse-escalation decisions.
25497. **Phishing-intel quarterly review** — generate quarterly reviews of kit trends against the target for security leadership.
25498. **Kit-TTP MITRE mapper** — map each kit's techniques to ATT&CK (T1566 etc.) linking phishing intel to the TTP program.
25499. **Cross-brand kit sharing** — share sanitized kit indicators with peer brands hit by the same kits via trusted communities.
25500. **Kit-DNA archive** — archive full kit samples (sanitized) for longitudinal research on adversary evolution.
25501. **Decoy-login honeypot** — deploy decoy login pages that waste kit operators' time and collect their tooling fingerprints.
25502. **Kit-operator infrastructure pivot** — pivot from kit artifacts to uncover the operator's broader infrastructure for blocking.
25503. **Phishing-kit threat-score** — compute a per-kit threat score (deception quality × scale × MFA bypass) for triage.
25504. **Executive phishing-risk brief** — deliver an executive brief quantifying phishing-kit risk to the brand with trend charts.

## 6. Malware C2 Correlation (25505–25604)

25505. **Target-IP C2-feed checker** — check every IP in the target's netblocks against C2 feeds (AbuseIPDB, VirusTotal, AlienVault OTX) to flag compromised or abused infrastructure.
25506. **Domain C2-reputation lookup** — query the target's domains against malware-domain feeds to catch domains previously used as C2 before the target owned them.
25507. **Sinkhole-overlap detector** — detect when the target's IPs or domains appear in sinkhole datasets, indicating past or present malware association.
25508. **Compromised-infra indicator flagger** — flag web servers showing malware-C2 behaviors (odd beaconing, known C2 URL patterns) as potentially compromised hosts.
25509. **JA3/JA3S fingerprint matcher** — compare the target's TLS fingerprints against known malware JA3 databases to spot C2-like TLS clients on target infrastructure.
25510. **JARM fingerprint correlator** — use JARM fingerprints of the target's services to detect overlaps with known C2 server profiles.
25511. **Cobalt Strike beacon detector** — scan target infrastructure for Cobalt Strike beacon indicators (default certs, malleable-C2 profiles, known JA3s).
25512. **Beacon-interval analyzer** — analyze timing patterns of outbound-looking services for beacon-like regularity suggesting implanted C2.
25513. **DNS-tunneling indicator check** — look for DNS tunneling signatures on the target's DNS infrastructure that suggest data exfiltration or C2.
25514. **DGA-domain proximity scan** — check the target's DNS logs footprint for DGA-pattern domains indicating infected hosts inside the perimeter.
25515. **Fast-flux infrastructure detector** — detect fast-flux DNS behavior on target-associated domains, a hallmark of C2 resilience.
25516. **Domain-fronting abuse check** — check whether the target's CDN usage patterns match domain-fronting abuse for C2 concealment.
25517. **C2-over-DNS (DoH/DoT) watcher** — monitor for DNS-over-HTTPS tunneling indicators that bypass traditional DNS monitoring.
25518. **ICMP-tunnel detector** — check for ICMP tunneling tools' signatures on target edge devices.
25519. **HTTP/2 C2 channel detector** — look for HTTP/2 multiplexed C2 channels mimicking legitimate traffic on target web servers.
25520. **WebSocket C2 detector** — scan for malicious WebSocket C2 channels piggybacking on the target's legitimate WebSocket services.
25521. **C2-framework fingerprint DB** — maintain fingerprints for Metasploit, Empire, Covenant, Sliver, and Brute Ratel C2 frameworks and scan targets for matches.
25522. **Sliver-implant indicator scan** — check for Sliver C2 indicators (default certs, implant beacons) on target infrastructure.
25523. **Mythic-agent detector** — scan for Mythic C2 agent artifacts and profiles associated with target-facing services.
25524. **Havoc-framework matcher** — detect Havoc C2 indicators, a rising open-source framework in criminal use.
25525. **Nimplant and custom-C2 heuristics** — apply behavioral heuristics for custom/unknown C2 when no framework fingerprint matches.
25526. **RAT-family correlator** — correlate target findings with RAT families (AsyncRAT, Quasar, njRAT) via infrastructure and behavior overlaps.
25527. **Infostealer C2 mapper** — map stealer C2 panels (RedLine, Raccoon) and check for target data in associated exfil stores.
25528. **Ransomware-operator C2 tracker** — track C2 infrastructure of active ransomware operators for overlap with the target's netblocks.
25529. **Botnet-membership checker** — check whether target IPs appear in botnet trackers (Mirai, Emotet-heritage) indicating compromised devices.
25530. **IoT-botnet exposure assessor** — assess the target's IoT footprint against botnet recruitment patterns (default creds, exposed Telnet).
25531. **Cryptominer C2 detector** — detect miner C2 (stratum pools, XMRig configs) on target servers indicating resource-hijack compromise.
25532. **Proxy-botnet node detector** — check for residential-proxy malware (911-style) nodes within target infrastructure.
25533. **C2-as-a-service tracker** — track commercial C2 services abused by criminals and check for their infrastructure near the target.
25534. **Bulletproof-host proximity alert** — alert when the target's infrastructure shares hosting with known bulletproof providers favored by C2 operators.
25535. **Shared-ASN risk scorer** — score risk when target IPs share ASNs heavily abused for C2, affecting IP reputation.
25536. **Passive-DNS C2 pivot** — pivot from target domains through passive DNS to find co-hosted C2 domains for context.
25537. **Certificate-overlap pivot** — pivot on shared TLS certificates between target services and known C2 to find hidden relationships.
25538. **Favicon-hash C2 pivot** — use favicon hashes to pivot between target assets and known C2 panels using the same defaults.
25539. **HTTP-header C2 pivot** — pivot on unusual server headers shared between target infrastructure and known C2 kits.
25540. **SSH-key C2 pivot** — pivot on reused SSH host keys between target servers and reported C2 infrastructure.
25541. **C2-domain age analyzer** — analyze domain age patterns; fresh domains in target-adjacent infrastructure suggest staged C2.
25542. **Typosquat-C2 detector** — detect C2 domains typosquatting the target's brand, used for both phishing and malware staging.
25543. **Malware-sandbox report linker** — link target IPs/domains to ANY.RUN, Joe Sandbox, and Hybrid Analysis reports for behavioral context.
25544. **Malware-family attribution panel** — show which malware families have touched the target's infrastructure per sandbox and feed data.
25545. **Payload-delivery URL checker** — check URLs on the target against malware-delivery URL feeds to find compromised download paths.
25546. **Drive-by-download indicator scan** — scan target web assets for injected drive-by-download scripts per threat-feed IOCs.
25547. **Watering-hole compromise detector** — detect watering-hole script injections on the target's sites using known watering-hole IOCs.
25548. **Supply-chain script integrity** — verify third-party scripts on the target against known-good hashes to catch Magecart-style skimmer injections.
25549. **Magecart-skimmmer IOC matcher** — match the target's checkout pages against Magecart skimmer IOCs and exfil-domain feeds.
25550. **Formjacking detector** — detect formjacking injections on payment and login forms via script-behavior and IOC matching.
25551. **Web-shell signature scanner** — scan target web roots (via authorized checks) for web-shell signatures from public shell databases.
25552. **China-chopper variant matcher** — match against China Chopper and derivatives' signatures as a common web-shell indicator.
25553. **Behinder/Godzilla shell detector** — detect modern encrypted web shells (Behinder, Godzilla) via traffic and artifact signatures.
25554. **C2-panel web-fingerprint** — fingerprint web panels of C2 frameworks to detect operator panels accidentally exposed on target infra.
25555. **Exposed-C2-panel alert** — alert when a C2 operator panel is found on the target's netblock, indicating either compromise or researcher honeypot.
25556. **Honeypot-vs-compromise classifier** — classify suspicious C2-like findings as likely honeypot versus likely compromise using behavior analysis.
25557. **C2-takedown coordinator** — generate abuse reports with C2 evidence for hosts confirmed compromised within the target's infrastructure.
25558. **Network-isolation recommender** — recommend isolation steps when C2 indicators confirm an active compromise during a hunt.
25559. **Incident-response handoff pack** — compile C2 findings into an IR handoff pack with timelines, IOCs, and containment suggestions.
25560. **C2-dwell-time estimator** — estimate how long C2 indicators have been present using certificate, DNS, and file timestamps.
25561. **Lateral-movement indicator mapper** — map C2 findings to likely lateral-movement paths using the target's network topology from recon.
25562. **Data-exfiltration estimator** — estimate exfiltrated data volume from C2 channel characteristics for impact assessment.
25563. **C2-channel encryption analyzer** — analyze C2 channel encryption to advise on decryption or blocking feasibility.
25564. **DNS-sinkhole recommendation** — recommend sinkholing confirmed C2 domains with implementation steps for the target's DNS team.
25565. **Firewall-block rule generator** — auto-generate firewall rules for confirmed C2 IPs and domains in common firewall syntaxes.
25566. **EDR-hunt query builder** — build EDR hunting queries (Splunk, Sentinel, CrowdStrike) from confirmed C2 IOCs.
25567. **YARA-rule auto-generator** — generate YARA rules from C2-associated payloads found during the hunt.
25568. **Suricata-rule generator** — generate Suricata rules for confirmed C2 beaconing patterns.
25569. **Sigma-rule exporter** — export C2 detections as Sigma rules for SIEM ingestion.
25570. **STIX-bundle exporter** — package C2 findings as STIX 2.1 bundles for threat-intel platform sharing.
25571. **MISP-event creator** — create MISP events from confirmed C2 findings with proper taxonomy tags.
25572. **C2-feed contribution opt-in** — let users opt into contributing sanitized C2 IOCs back to community feeds.
25573. **Threat-intel-platform sync** — sync C2 findings bidirectionally with the target's TIP (MISP/OpenCTI).
25574. **C2-confidence scorer** — score C2 attributions by corroborating indicators to avoid false compromise alarms.
25575. **Benign-beacon excluder** — exclude known-benign beaconing (updaters, telemetry) from C2 alerts using an allowlist.
25576. **CDN-edge C2 caveat** — apply special handling when C2 indicators appear on shared CDN edges to avoid misattributing other tenants' activity.
25577. **Cloud-IP reputation caveat** — caveat C2 hits on shared cloud IPs with tenancy analysis before alarming.
25578. **Historical C2 associator** — show historical C2 associations of the target's IPs (previous tenants) to distinguish past from present compromise.
25579. **IP-reputation trend tracker** — track the target's IP reputation over time across C2 and abuse feeds.
25580. **ASN-abuse trend monitor** — monitor abuse trends in the target's ASN to anticipate collateral reputation damage.
25581. **C2-feed freshness indicator** — show the freshness of each C2 feed hit so analysts weight recent intel higher.
25582. **Multi-feed C2 corroborator** — require or highlight multi-feed corroboration before marking infrastructure as compromised.
25583. **C2-intel API** — expose C2 correlation as an API for the target's SOC to query on demand.
25584. **Retro-hunt C2 sweep** — re-scan historical hunt data against updated C2 feeds to catch compromises that were unknown at hunt time.
25585. **C2-watchlist per target** — maintain a per-target C2 watchlist that alerts on any new feed hits between hunts.
25586. **Executive C2 brief** — produce an executive brief when C2 compromise is confirmed, with business-impact framing.
25587. **C2-remediation playbook linker** — link confirmed C2 findings to IR playbooks for the specific malware family.
25588. **Containment-priority ranker** — rank C2 findings by containment priority using beacon frequency and data-access indicators.
25589. **Threat-hunting hypothesis generator** — generate threat-hunting hypotheses from C2 findings for the target's internal hunt team.
25590. **Purple-team exercise designer** — design purple-team exercises replicating the confirmed C2 TTPs to validate defenses.
25591. **C2-TTP MITRE mapper** — map confirmed C2 behaviors to ATT&CK for integration with the TTP program.
25592. **C2-intel quarterly trends** — produce quarterly trend reports on C2 activity touching the target's infrastructure.
25593. **Decoy-C2 honeypot deployer** — suggest honeypot placements based on observed C2 targeting patterns.
25594. **C2-operator profiling** — profile C2 operators from infrastructure patterns to support long-term tracking.
25595. **C2-infrastructure lifespan tracker** — track how long C2 infrastructure persists to measure takedown pressure effectiveness.
25596. **Cross-target C2 correlator** — correlate C2 indicators across all of a user's targets to find shared compromises or operators.
25597. **C2-to-ransomware predictor** — predict ransomware risk when C2 indicators match operators known to deploy ransomware.
25598. **C2-to-espionage classifier** — classify C2 as likely espionage versus crime based on TTPs and targeting for response framing.
25599. **C2-evidence chain-of-custody** — maintain chain-of-custody for C2 evidence collected during hunts for legal admissibility.
25600. **Legal-hold trigger** — trigger legal-hold guidance when C2 evidence suggests an active breach requiring preservation.
25601. **Regulatory-notification advisor** — advise on breach-notification obligations when C2 confirms compromise with data access.
25602. **C2 evidence insurer claim pack** — compile C2 evidence into the format insurers require for incident claims.
25603. **C2-lessons-learned generator** — generate lessons-learned summaries from C2 incidents to improve future hunt detection.
25604. **C2-intel program maturity scorer** — score the maturity of C2 monitoring per target and recommend program improvements.

## 7. Ransomware Group Targeting (25605–25704)

25605. **Active-group industry heatmap** — show which ransomware groups are currently targeting the hunt target's industry, updated weekly from leak-site and intel data.
25606. **Target victim-profile matcher** — score how closely the target matches each active group's victimology (revenue band, sector, region, size).
25607. **Ransomware risk score per target** — compute a composite ransomware risk score from industry heat, victimology fit, and exposed initial-access vectors.
25608. **Group TTP profile cards** — maintain cards for active groups (initial access, tools, encryptors, leak-site URLs) and surface the relevant card per hunt.
25609. **Initial-access-broker listing correlator** — correlate IAB listings with the target's exposed services to estimate time-to-compromise if listed.
25610. **Ransom-note language pattern watch** — monitor for ransom-note text patterns and leak-site language that reference the target's sector for early warning.
25611. **Leak-site victim-announcement tracker** — track victim announcements by sector and alert when the target's sector sees a surge.
25612. **Double-extortion readiness assessor** — assess whether the target's data would be valuable for double extortion based on data-type exposure found in the hunt.
25613. **Backup-targeting advisory** — warn when the target runs backup products currently being deleted by active groups before encryption.
25614. **ESXi-focused group alert** — alert when groups with ESXi/Linux encryptors are active if the hunt finds VMware infrastructure.
25615. **RaaS affiliate toolkit mapper** — map each group's affiliate toolkits (Mimikatz variants, RMM abuse, PSExec) to checks validating the target's exposure.
25616. **EDR-evasion tool tracker** — track EDR-killer and defense-evasion tools per group and check the target's EDR coverage against them.
25617. **Group infrastructure overlap check** — check the target's IPs and domains against published group infrastructure IOCs.
25618. **Negotiation-chat leak monitor** — monitor leaked negotiation chats for ransom-demand benchmarks in the target's sector and size band.
25619. **Ransom-demand estimator** — estimate likely ransom demand from sector benchmarks and the target's revenue profile for preparedness planning.
25620. **Payment-trend analyzer** — analyze whether victims in the sector pay, using leak-site disappearance patterns as a proxy.
25621. **Decryptor-availability tracker** — track free decryptor releases per ransomware family so the report can note recovery options.
25622. **No-more-ransom linker** — link relevant No More Ransom resources for families threatening the target's sector.
25623. **Group rebrand tracker** — track ransomware rebrands (group renames, splinters) so monitoring follows the same actors under new names.
25624. **Affiliate-migration monitor** — monitor affiliate movement between RaaS programs to anticipate TTP shifts targeting the sector.
25625. **New-entrant group radar** — flag newly emerged ransomware groups and assess their early victimology for target fit.
25626. **Law-enforcement action tracker** — track takedowns and arrests affecting groups targeting the sector, adjusting risk scores downward accordingly.
25627. **Leak-site seizure monitor** — monitor leak-site seizures and mirror resurrections to maintain accurate victim counts.
25628. **Victim-count trend per group** — chart victim counts per group over time to show which threats are accelerating.
25629. **Sector surge detector** — detect sudden surges in a sector's victim listings and trigger proactive hunts for similar targets.
25630. **Geography-shift tracker** — track when groups pivot to new regions and warn targets in the newly targeted geography.
25631. **SMB-targeting group flag** — flag groups known for hitting mid-market companies when the target fits that profile.
25632. **Critical-infrastructure targeting alert** — issue elevated alerts when groups known for OT/ICS targeting match an industrial target.
25633. **Healthcare-targeting monitor** — special monitoring for healthcare targets given the life-safety stakes of ransomware there.
25634. **Education-sector wave tracker** — track ransomware waves against schools and universities timed to academic calendars.
25635. **Government-targeting advisory** — advise public-sector targets on groups with state-aligned or hacktivist-adjacent targeting.
25636. **Supply-chain ransomware correlator** — correlate MSP and vendor compromises with downstream risk to the target.
25637. **Triple-extortion DDoS warning** — warn when groups add DDoS pressure tactics and the target's DDoS protection was found lacking.
25638. **Data-auction exposure assessor** — assess exposure if the target's data were auctioned, using sector auction precedents.
25639. **Customer-notification trigger planner** — pre-plan customer-notification workflows for double-extortion scenarios specific to the target's data.
25640. **Cyber-insurance ransomware clause checker** — check the target's likely insurance posture against common ransomware coverage exclusions.
25641. **Incident-retainer readiness check** — verify whether the target shows signs of IR retainer readiness (or lack thereof) for report recommendations.
25642. **Tabletop-exercise scenario generator** — generate ransomware tabletop scenarios using the most relevant active group's TTPs.
25643. **Group-specific hunt pack** — build hunt check packs emulating each top group's initial-access playbook for the target's stack.
25644. **VPN-exploit group priority** — prioritize VPN-appliance CVE checks when active groups are known to exploit them for initial access.
25645. **RDP-exposure group correlator** — escalate RDP exposure findings when groups using RDP brute force are active in the sector.
25646. **Phishing-kit group linker** — link phishing kits impersonating the target to groups known for phishing-led initial access.
25647. **Malvertising-delivery tracker** — track groups using malvertising for initial access and check the target's ad-tech exposure.
25648. **SEO-poisoning delivery monitor** — monitor SEO-poisoning campaigns by ransomware affiliates for the target's software-download keywords.
25649. **Software-update hijack watcher** — watch for groups hijacking software updates, relevant when the target's update mechanisms were found weak.
25650. **Help-desk social-engineering advisory** — advise on help-desk social engineering when groups use it for initial access, with control recommendations.
25651. **MFA-fatigue attack warner** — warn when active groups use MFA-fatigue and the target's MFA lacks number-matching.
25652. **SIM-swap risk assessor** — assess SIM-swap risk for the target's executives when groups use it to defeat SMS MFA.
25653. **Token-theft (AiTM) readiness** — check readiness against adversary-in-the-middle token theft when groups deploy Evilginx-style kits.
25654. **Lateral-movement path validator** — validate the target's internal segmentation against the lateral-movement TTPs of relevant groups.
25655. **Credential-dumping exposure check** — check for LSASS-dumping prerequisites (weak EDR, local admin) that groups exploit post-access.
25656. **Domain-dominance path mapper** — map paths to domain dominance from the hunt's findings using group-favored techniques (ADCS, DCSync prerequisites).
25657. **GPO-abuse readiness** — assess GPO security against group techniques for mass deployment of ransomware.
25658. **Backup-immutability verifier** — verify backup immutability claims since groups actively destroy non-immutable backups.
25659. **Offline-backup gap finder** — find gaps in offline/air-gapped backup coverage, the last line of defense groups try to eliminate.
25660. **Recovery-time estimator** — estimate recovery time from the target's backup posture for business-continuity planning.
25661. **Exfiltration-channel validator** — validate whether the target's DLP and egress controls would catch the exfil tools groups currently use.
25662. **Data-staging detector** — check for staging locations and RAR/archive tooling abuse that precede exfiltration.
25663. **Cloud-exfiltration path checker** — check cloud storage exfil paths (S3, MEGA, Rclone) favored by current groups.
25664. **Ransomware-note deploy-sim** — simulate (safely, in report form) where ransom notes would land given the target's share topology.
25665. **Encryption-speed estimator** — estimate encryption speed from the target's storage performance to bound the response window.
25666. **Wiper-vs-encryptor classifier** — classify relevant groups' payloads as wiper or encryptor to set correct recovery expectations.
25667. **Partial-encryption trend note** — note groups using intermittent encryption for speed, affecting detection-strategy advice.
25668. **Linux/ESXi encryptor readiness** — check Linux and hypervisor defenses specifically when groups field those encryptors.
25669. **MacOS-targeting group flag** — flag the rare groups with macOS encryptors if the target has significant Mac fleets.
25670. **Group decryptor-bug tracker** — track buggy decryptors per group to warn against paying when decryption is unreliable.
25671. **Re-extortion risk flag** — flag groups known for re-extorting after payment to advise against paying.
25672. **Sanctions-risk checker** — check whether paying the relevant groups would violate sanctions (OFAC-listed actors) for legal guidance.
25673. **Ransomware-payment legality brief** — provide a jurisdiction-aware brief on payment legality considerations for the target's region.
25674. **Negotiator-contact readiness** — advise on pre-vetting ransom-negotiation firms before an incident occurs.
25675. **Crisis-comms template pack** — provide ransomware-specific crisis communication templates tailored to the target's sector.
25676. **Regulatory-notification mapper** — map which regulators require notification for ransomware events in the target's jurisdictions.
25677. **SEC-disclosure advisor** — advise US-listed targets on SEC 4-day material-incident disclosure implications.
25678. **GDPR-notification timer** — start a 72-hour notification planning aid for EU targets when ransomware risk is critical.
25679. **Sector-ISAC sharing helper** — format ransomware intel for sharing with the target's sector ISAC.
25680. **Threat-actor negotiation persona** — profile each group's negotiation style from leaked chats to prepare responders.
25681. **Group-victim support resources** — link victim-support resources and decryptor portals relevant to the threatening families.
25682. **Ransomware hunt debrief** — end hunts with a ransomware-specific debrief: top 3 groups, their likely entry, and the target's gaps.
25683. **Quarterly ransomware landscape brief** — generate quarterly briefs on the ransomware landscape for the target's sector.
25684. **Group-TTP MITRE overlay** — overlay relevant groups' TTPs on the hunt's ATT&CK heatmap for a unified view.
25685. **Ransomware-tabletop scheduler** — recommend tabletop exercise scheduling based on sector threat tempo.
25686. **Purple-team ransomware sim** — design purple-team simulations replicating the top group's full kill chain safely.
25687. **EDR-rule pack per group** — suggest EDR detection rules tuned to each relevant group's tooling.
25688. **Canary-file deployer** — recommend canary file placements that trip on ransomware encryption behavior.
25689. **Honeypot-credential planter** — plant honeypot credentials that alert when ransomware affiliates attempt lateral movement.
25690. **Network-telescope alert** — use network-telescope data to detect pre-attack scanning from group infrastructure.
25691. **Threat-hunting hypothesis pack** — generate threat-hunting hypotheses from each relevant group's recent campaigns.
25692. **YARA pack per family** — provide YARA rules for the encryptors and tools of relevant families.
25693. **Sigma pack per group** — provide Sigma rules for each group's TTPs for SIEM deployment.
25694. **STIX ransomware bundle** — export group profiles and IOCs as STIX bundles for TIP ingestion.
25695. **Executive ransomware brief** — deliver a one-page executive brief: which groups, why us, what to do first.
25696. **Board ransomware scenario** — build a board-level scenario exercise from the most likely group's playbook.
25697. **Cyber-insurance renewal brief** — prepare a ransomware-risk brief supporting the target's insurance renewal.
25698. **M&A ransomware diligence** — assess ransomware risk as part of due-diligence hunts on acquisition targets.
25699. **Vendor ransomware cascade mapper** — map how a ransomware hit on key vendors would cascade to the target.
25700. **Ransomware intel freshness badge** — show the freshness of group intel behind every claim to maintain trust.
25701. **Group-extinction verifier** — verify claims that a group disbanded before lowering risk scores, avoiding premature relief.
25702. **Copycat-group discriminator** — distinguish copycat leak sites from the real group to avoid misattribution.
25703. **Ransomware-as-a-distraction flag** — flag when ransomware TTPs may be a distraction for espionage, advising deeper investigation.
25704. **Post-incident ransomware review** — structure post-incident reviews around the group's known playbook to find missed detections.

## 8. Zero-Day Watch (25705–25804)

25705. **Zero-day chatter monitor for target stack** — continuously scan security Twitter/X, mailing lists, and researcher blogs for zero-day chatter mentioning the target's exact stack components.
25706. **Emergency hunt trigger on relevant zero-day** — automatically launch a focused emergency hunt when a zero-day drops affecting the target's detected stack, without waiting for a scheduled run.
25707. **Zero-day exposure dashboard** — show a live dashboard of zero-days affecting the target's stack: status, exploitability, patch availability, and exposure.
25708. **Vendor zero-day advisory aggregator** — aggregate vendor zero-day advisories (Microsoft, Apple, Cisco, Fortinet) filtered to the target's inventory.
25709. **CISA KEV zero-day fast lane** — fast-track any zero-day added to CISA KEV into the hunt plan within hours, with KEV-listed checks at top priority.
25710. **Google Project Zero tracker** — track Project Zero disclosures for the target's stack with their 90-day timelines to predict patch and exploit dates.
25711. **ZDI advisory correlator** — correlate Trend Micro ZDI advisories with the target's stack, noting the typical gap between ZDI disclosure and patch.
25712. **Exploit-broker listing watcher** — watch exploit-broker chatter for zero-days in the target's stack as a pre-disclosure warning signal.
25713. **Dark-web zero-day auction monitor** — monitor auction claims for zero-days affecting the target's vendors, treating credible claims as advance warning.
25714. **Researcher-teaser tracker** — track researcher conference teasers and tweet threads hinting at upcoming disclosures for the target's stack.
25715. **Patch-Tuesday delta analyzer** — analyze Patch Tuesday releases for the target's Microsoft footprint and auto-generate checks from silently patched vulnerabilities.
25716. **Silent-patch detector** — detect silently patched vulnerabilities in open-source components via commit analysis, revealing zero-days fixed without CVEs.
25717. **GitHub commit-message miner** — mine security-fix commits in the target's open-source dependencies for undisclosed vulnerability fixes.
25718. **Diff-based zero-day hunter** — diff consecutive releases of the target's components to spot security fixes that were never announced.
25719. **N-day-to-zero-day classifier** — classify whether a newly disclosed flaw is a true zero-day or an N-day for the target based on its patch state.
25720. **Zero-day vs N-day exposure scorer** — score exposure differently for zero-days (no patch exists) versus N-days (patch exists but unapplied) to drive the right response.
25721. **Virtual-patch recommender** — recommend WAF and IPS virtual patches for zero-days with no vendor fix, with rule suggestions.
25722. **WAF-bypass zero-day checker** — specifically check whether the zero-day bypasses the target's WAF, since many zero-days are chosen for that property.
25723. **EDR-detection gap assessor** — assess whether the target's EDR would detect the zero-day's exploitation primitives.
25724. **Threat-actor zero-day usage tracker** — track which APT groups stockpile or use zero-days in the target's stack for attribution context.
25725. **Zero-day-to-ransomware linker** — flag when a zero-day is adopted by ransomware affiliates, massively raising its urgency.
25726. **In-the-wild exploitation confirmer** — confirm in-the-wild exploitation via telemetry and vendor statements before escalating to emergency response.
25727. **Mass-scanning detector** — detect internet-wide scanning for the zero-day via telescope data to confirm active exploitation.
25728. **Honeypot-hit correlator** — correlate honeypot hits for the zero-day exploit with the target's exposure timeline.
25729. **Shodan-exposure checker** — check how many of the target's assets are exposed to the zero-day via Shodan-style scan data.
25730. **Censys-exposure validator** — validate exposure using Censys scan data for the vulnerable service banners.
25731. **Zero-day PoC-release tracker** — track the time from disclosure to public PoC release as a measure of commoditization speed.
25732. **Metasploit-module watch** — alert the moment a Metasploit module appears for the zero-day, signaling script-kiddie availability.
25733. **Nuclei-template watch** — alert when a Nuclei template is published for the zero-day for fast validation.
25734. **Emergency-scan template builder** — auto-build a safe scan template for the zero-day from the advisory and PoC analysis.
25735. **Safe-check vs exploit separator** — clearly separate safe detection checks from weaponized exploits for the zero-day to keep validation non-destructive.
25736. **Zero-day blast-radius mapper** — map every asset in the target's inventory affected by the zero-day for scoped response.
25737. **Internet-facing-first triage** — triage zero-day response internet-facing assets first, then internal, with the ordering justified in the report.
25738. **Compensating-control finder** — find compensating controls (network segmentation, disabled features) that reduce zero-day exposure without patching.
25739. **Feature-disable advisory** — advise disabling the vulnerable feature as an immediate mitigation when no patch exists.
25740. **Micropatch availability checker** — check micropatching services (0patch-style) for unofficial fixes while awaiting vendor patches.
25741. **Vendor-patch ETA tracker** — track vendor patch ETAs and update the exposure dashboard as fixes ship.
25742. **Patch-testing fast track** — provide a focused regression-test checklist so the target can deploy the emergency patch quickly and safely.
25743. **Rollback-plan template** — include a patch-rollback plan template since emergency patches carry higher regression risk.
25744. **Zero-day war-room checklist** — generate a war-room checklist (comms, IR, patching, monitoring) tailored to the specific zero-day.
25745. **Executive zero-day brief** — produce a jargon-free executive brief within an hour of a relevant zero-day disclosure.
25746. **Board-notification advisor** — advise whether the zero-day meets the bar for board notification under the target's governance.
25747. **Customer-comms drafter** — draft customer communications if the zero-day affects customer-facing services or data.
25748. **Regulatory-notification checker** — check whether the zero-day exposure triggers breach or incident notification duties.
25749. **Zero-day insurer incident notification** — prepare the incident notification the insurer requires for zero-day-driven events.
25750. **Threat-hunting query pack** — generate threat-hunting queries to find pre-patch exploitation of the zero-day in the target's logs.
25751. **Log-retention checker** — verify log retention covers the zero-day's likely exploitation window for retrospective hunting.
25752. **Retro-hunt scheduler** — schedule retrospective log hunts once exploitation timelines are published.
25753. **IOC pack per zero-day** — publish IOCs (IPs, hashes, URLs) associated with zero-day exploitation for the target's defenses.
25754. **YARA rule per zero-day** — provide YARA rules for zero-day payloads when samples are available.
25755. **Sigma rule per zero-day** — provide Sigma rules for zero-day exploitation behaviors for SIEM teams.
25756. **Snort/Suricata rule pack** — provide network rules for zero-day exploit traffic patterns.
25757. **EDR-behavioral rule suggester** — suggest EDR behavioral rules targeting the zero-day's exploitation primitives.
25758. **Deception-tripwire deployer** — recommend honeypot placements that trip on zero-day exploitation attempts.
25759. **Zero-day tabletop scenario** — build a tabletop exercise from the zero-day scenario for the target's IR team.
25760. **Lessons-learned capturer** — capture lessons from each zero-day response to improve the next one's speed.
25761. **Zero-day response-time tracker** — track time from disclosure to mitigation across zero-days to measure program maturity.
25762. **Mean-time-to-patch benchmark** — benchmark the target's patch speed against industry data for similar zero-days.
25763. **Patch-cadence advisor** — advise on patch-cadence changes if zero-days repeatedly catch the target unpatched.
25764. **Vulnerability-management gap report** — report systemic gaps revealed by the zero-day (e.g., unknown assets, unowned systems).
25765. **Asset-inventory reconciler** — use the zero-day response to reconcile and correct the asset inventory.
25766. **Shadow-IT exposure finder** — find shadow-IT instances of the vulnerable component the official inventory missed.
25767. **SaaS zero-day correlator** — check the target's SaaS vendors for the same zero-day, since supply-chain exposure is common.
25768. **Open-source dependency zero-day** — trace the zero-day into the target's transitive dependencies, not just direct ones.
25769. **Container-image rebuild advisor** — advise rebuilding container images when a base-image zero-day drops, with SBOM diffing.
25770. **Firmware zero-day tracker** — track firmware and BMC zero-days for the target's hardware footprint.
25771. **Mobile zero-day monitor** — monitor iOS/Android zero-days affecting the target's mobile fleet and MDM.
25772. **Browser zero-day fast lane** — fast-lane browser zero-days since they enable drive-by compromise of the target's users.
25773. **VPN-appliance zero-day warner** — give VPN-appliance zero-days the highest urgency as they bypass perimeter authentication.
25774. **Email-gateway zero-day checker** — prioritize email-gateway zero-days that enable pre-authentication compromise.
25775. **Backup-software zero-day alert** — alert urgently on backup-software zero-days since they precede ransomware encryption.
25776. **Hypervisor zero-day assessor** — assess hypervisor zero-days for cross-VM escape risk in the target's virtualization.
25777. **ICS zero-day advisory** — provide specialized advisories for ICS/SCADA zero-days with safety implications.
25778. **Medical-device zero-day tracker** — track medical-device zero-days with patient-safety framing for healthcare targets.
25779. **Automotive zero-day monitor** — monitor automotive and fleet-telematics zero-days for relevant targets.
25780. **Zero-day bounty-value estimator** — estimate the bug-bounty value of the zero-day class to contextualize researcher incentives.
25781. **Duplicate-zero-day predictor** — predict whether the zero-day is likely already reported on the target's bounty program.
25782. **Researcher-credit tracker** — track which researchers find zero-days in the target's stack to invite them to private programs.
25783. **Disclosure-timeline statement advisor** — reconstruct the coordinated-disclosure timeline to advise on public-statement timing.
25784. **Media-narrative monitor** — monitor media coverage of the zero-day to prepare the target's public-response posture.
25785. **Stock-impact assessor** — assess potential market impact for listed vendors when their zero-day affects the target.
25786. **Peer-exposure benchmark** — benchmark the target's zero-day exposure against sector peers for context.
25787. **Zero-day insurance-claim prep** — prepare documentation for insurance claims arising from zero-day incidents.
25788. **Legal-privilege advisor** — advise on engaging counsel under privilege during zero-day response.
25789. **Forensic-image guidance** — provide forensic-imaging guidance if zero-day exploitation is suspected before remediation.
25790. **Evidence-preservation checklist** — ensure logs and images are preserved before patching destroys forensic artifacts.
25791. **Zero-day attribution panel** — show which actors are reported exploiting the zero-day for response prioritization.
25792. **Nation-state usage flag** — flag zero-days used by nation-state actors for elevated response posture.
25793. **Zero-day-to-campaign linker** — link the zero-day to named campaigns using it for narrative completeness.
25794. **Exploit-kit integration tracker** — track when the zero-day is integrated into exploit kits, marking full commoditization.
25795. **Long-tail exposure monitor** — monitor long-tail exposure months later, since unpatched instances persist for years.
25796. **Zero-day anniversary review** — review each zero-day annually to confirm the target stayed patched through upgrades.
25797. **Hunt-plan zero-day injection** — inject zero-day checks into already-running hunts without restart when disclosures land mid-hunt.
25798. **Zero-day false-alarm filter** — filter hype-driven zero-day alarms by verifying technical details before triggering emergency workflows.
25799. **Severity-reassessment engine** — reassess the zero-day's severity for the specific target as new exploitability details emerge.
25800. **Zero-day intel confidence decay** — decay the urgency of zero-day intel as patches deploy and exploitation wanes.
25801. **Cross-vendor zero-day correlator** — correlate the same underlying flaw across vendors (e.g., shared libraries) for complete coverage.
25802. **Zero-day playbook library** — maintain per-product zero-day playbooks so response starts from a template, not a blank page.
25803. **Zero-day drill scheduler** — schedule simulated zero-day drills to test the emergency-hunt workflow before a real event.
25804. **Zero-day program maturity score** — score the target's zero-day readiness program and track improvement over time.

## 9. Vulnerability Disclosure Correlation (25805–25904)

25805. **HackerOne Hacktivity pattern matcher** — match each finding against disclosed HackerOne reports with the same vulnerability pattern to cite precedent and expected severity.
25806. **Bugcrowd disclosure correlator** — correlate findings with Bugcrowd's disclosed submissions for the same bug class and technology.
25807. **"Paid $X elsewhere" payout hints** — show the bounty amounts paid for similar disclosed reports so users understand the finding's market value.
25808. **Disclosure-to-finding linker** — attach the most similar disclosed write-ups to each finding as methodology references in the report.
25809. **Duplicate-likelihood predictor** — predict duplicate risk by checking how many similar reports were disclosed against comparable targets recently.
25810. **Novelty scorer** — score finding novelty by measuring distance from all disclosed reports, highlighting truly original discoveries.
25811. ** disclosed-technique replay** — replay techniques from high-value disclosed reports against the target when the stack matches, as an intel-driven check.
25812. **Bounty-table comparator** — compare the target's bounty table against payouts for similar bugs elsewhere to advise whether the program is competitive.
25813. **Underpaid-bug-class detector** — detect bug classes the target's program underpays relative to market, which predicts researcher disengagement.
25814. **High-signal researcher tracker** — track researchers who disclose high-signal reports in the target's stack and suggest inviting them to private programs.
25815. **Disclosure-timeline analyzer** — analyze time from disclosure to fix across similar reports to set realistic remediation expectations.
25816. **Fix-verification from disclosures** — learn from disclosed reports how vendors fixed the issue to suggest concrete remediation.
25817. **WAF-bypass disclosure feed** — maintain a feed of disclosed WAF-bypass reports to test whether the target's WAF falls to known bypasses.
25818. **Logic-flaw disclosure library** — build a library of disclosed business-logic flaws indexed by industry for targeted logic testing.
25819. **API-disclosure pattern index** — index disclosed API vulnerabilities (BOLA, mass assignment) by framework for API-focused hunts.
25820. **Mobile-disclosure correlator** — correlate mobile-app findings with disclosed mobile reports for the same SDKs and backends.
25821. **Cloud-disclosure pattern matcher** — match cloud-misconfiguration findings against disclosed cloud reports (S3, IAM, metadata).
25822. **SSO-disclosure case linker** — link SSO findings to disclosed SAML/OAuth cases with the same IdP for precedent.
25823. **Subdomain-takeover disclosure refs** — attach disclosed takeover reports for the same service to takeover findings.
25824. **Race-condition disclosure gallery** — maintain a gallery of disclosed race-condition reports indexed by application domain.
25825. **IDOR disclosure impact bank** — bank disclosed IDOR reports with demonstrated impact to justify severity ratings.
25826. **XSS-to-RCE disclosure chains** — collect disclosed chains where XSS escalated to RCE to support severity upgrades.
25827. **SSRF disclosure cloud-map** — map disclosed SSRF reports by cloud provider to predict the target's SSRF impact.
25828. **Deserialization disclosure index** — index disclosed deserialization reports by language and library for quick precedent lookup.
25829. **Template-injection disclosure refs** — link SSTI findings to disclosed reports for the same template engine.
25830. **GraphQL disclosure collection** — collect disclosed GraphQL reports (introspection, batching, authz) for pattern-based testing.
25831. **WebSocket disclosure cases** — link WebSocket findings to disclosed hijacking and CSWSH cases.
25832. **HTTP-smuggling disclosure refs** — attach disclosed request-smuggling reports for the same server pair to smuggling findings.
25833. **Cache-poisoning disclosure bank** — bank disclosed cache-deception reports by CDN for targeted cache testing.
25834. **JWT disclosure pattern library** — library of disclosed JWT attacks (none-alg, kid, jku) mapped to libraries.
25835. **OAuth disclosure playbook** — playbook of disclosed OAuth misconfigurations by provider for login-flow testing.
25836. **SAML disclosure case files** — case files of disclosed SAML attacks for enterprise SSO targets.
25837. **2FA-bypass disclosure tracker** — track disclosed 2FA-bypass reports to test the target's MFA implementation against known bypasses.
25838. **Password-reset disclosure index** — index disclosed password-reset flaws (token leakage, host-header) for auth-flow hunts.
25839. **Session-management disclosure refs** — link session findings to disclosed fixation and hijacking reports.
25840. **Crypto-failure disclosure bank** — bank disclosed crypto failures (padding oracle, weak randomness) for crypto-review hunts.
25841. **File-upload disclosure gallery** — gallery of disclosed upload-bypass reports by stack for upload testing.
25842. **XXE disclosure collection** — collect disclosed XXE reports by parser for XML-heavy targets.
25843. **LDAP-injection disclosure refs** — link LDAP findings to disclosed injection reports.
25844. **NoSQL-injection disclosure bank** — bank disclosed NoSQL injection reports by database for API targets.
25845. **Command-injection disclosure index** — index disclosed command-injection reports by language and context.
25846. **Path-traversal disclosure refs** — attach disclosed traversal reports (including LFI-to-RCE) to file-access findings.
25847. **Open-redirect disclosure chains** — link open redirects to disclosed OAuth-token-theft chains for impact demonstration.
25848. **CSRF disclosure impact cases** — cases where disclosed CSRF led to account takeover for severity justification.
25849. **Clickjacking disclosure gallery** — gallery of disclosed clickjacking with demonstrated impact for UI-redressing findings.
25850. **CORS disclosure exploit demos** — disclosed CORS exploits with data-theft demos for misconfiguration findings.
25851. **Information-disclosure value bank** — bank disclosed info-disclosure reports showing how minor leaks enabled bigger attacks.
25852. **Verbose-error disclosure cases** — cases where disclosed verbose errors led to full compromise for report narratives.
25853. **Git-exposure disclosure refs** — disclosed .git-exposure reports with source-theft impact for repo-leak findings.
25854. **Backup-file disclosure cases** — disclosed backup-file exposures with credential-theft outcomes.
25855. **Dependency-confusion disclosure index** — index disclosed dependency-confusion reports by ecosystem for supply-chain hunts.
25856. **Typosquat disclosure tracker** — track disclosed typosquatting incidents affecting similar companies.
25857. **CI/CD disclosure playbook** — playbook of disclosed CI/CD compromises (Jenkins, GitHub Actions) for pipeline targets.
25858. **Secrets-leak disclosure bank** — bank disclosed secret-leak reports (GitHub, logs, JS) for secrets-hunting.
25859. **Takeover-via-DNS disclosure refs** — disclosed DNS-based takeovers for DNS-configuration findings.
25860. **BGP-hijack disclosure cases** — rare disclosed BGP-hijack cases for infrastructure targets.
25861. **Email-spoofing disclosure refs** — disclosed SPF/DKIM/DMARC bypass reports for email-security findings.
25862. **Subdomain-enumeration disclosure methods** — disclosed subdomain-enumeration methodologies to improve recon coverage.
25863. **Port-scanning evasion disclosures** — disclosed evasion techniques to keep recon stealthy and effective.
25864. **WAF-fingerprinting disclosure methods** — disclosed WAF-identification methods to improve WAF detection.
25865. **Rate-limit bypass disclosures** — disclosed rate-limit bypass reports for brute-force and enumeration planning.
25866. **Captcha-bypass disclosure tracker** — track disclosed captcha bypasses relevant to the target's captcha provider.
25867. **Bot-mitigation bypass disclosures** — disclosed bypasses for bot-mitigation vendors (Cloudflare, Akamai, PerimeterX).
25868. **Disclosure-driven check generator** — auto-generate new hunt checks from each week's most interesting disclosures.
25869. **Weekly disclosure digest** — send a weekly digest of disclosures relevant to the user's targets with suggested follow-up checks.
25870. **Disclosure-to-ATT&CK mapper** — map disclosed reports to ATT&CK techniques, feeding the TTP correlation program.
25871. **Disclosure-to-CVE linker** — link disclosed reports to their CVEs (when assigned) for unified intel records.
25872. **Disclosure sentiment analyzer** — analyze researcher sentiment in disclosures to spot under-tested bug classes.
25873. **Bounty-program comparison engine** — compare the target's program scope and payouts against peers using disclosure data.
25874. **Scope-gap finder** — find assets researchers hit on peer programs that are out of scope (or untested) on the target's program.
25875. **Researcher-invitation recommender** — recommend researchers to invite based on their disclosed work in the target's stack.
25876. **Private-program benchmark** — benchmark private-program performance using disclosed-report velocity data.
25877. **Disclosure response-time tracker** — track vendor response times in disclosures to predict the target's likely triage speed.
25878. **Mediation-case learner** — learn from disclosed mediation cases what evidence standards the target's program likely expects.
25879. **Report-quality coach** — coach report writing using top-rated disclosed reports as exemplars.
25880. **PoC-standard extractor** — extract PoC quality standards from highly rated disclosures to guide the agent's PoC generation.
25881. **Impact-demonstration gallery** — gallery of how disclosed reports demonstrated impact, teaching the agent to prove severity.
25882. **Remediation-advice miner** — mine disclosed reports' remediation sections for vendor-approved fix guidance.
25883. **Retest-evidence standards** — learn retest evidence standards from disclosures to structure fix-verification hunts.
25884. **Disclosure-embargo tracker** — track embargoed disclosures that hint at upcoming public reports affecting the target's stack.
25885. **Coordinated-disclosure coordinator** — help coordinate disclosure timelines when the agent's finding overlaps an in-progress disclosure.
25886. **Safe-harbor verifier** — verify the target's safe-harbor policy against disclosed researcher experiences before aggressive testing.
25887. **Program-policy gap detector** — detect policy gaps (unclear scope, slow triage) from researcher complaints in disclosures.
25888. **Bounty-amount negotiator data** — provide payout-comparison data to support bounty-amount discussions with program owners.
25889. **Hall-of-fame tracker** — track hall-of-fame listings for the target's program as a reputation signal.
25890. **Researcher-thank-you monitor** — monitor acknowledgments to gauge the program's researcher relations.
25891. **Disclosure-driven threat model** — build threat models from the most common disclosed bug classes per industry.
25892. **Secure-coding lesson extractor** — extract secure-coding lessons from disclosed root causes for developer training.
25893. **Disclosure quiz generator** — generate training quizzes from disclosed reports for the target's developers.
25894. **Disclosed-report scenario builder** — build red-team scenarios from chains of disclosed reports against similar targets.
25895. **Tabletop disclosure cases** — convert major disclosures into tabletop exercise cases for the target's security team.
25896. **Board disclosure brief** — brief the board on landmark disclosures in the sector and the target's corresponding exposure.
25897. **Peer-breach lesson linker** — link peer disclosures to the target's identical code patterns for proactive fixes.
25898. **Disclosure-archive search** — provide full-text search across the disclosure archive by technique, product, and impact.
25899. **Disclosure-alert subscriptions** — let users subscribe to disclosure alerts filtered by product, technique, or bounty value.
25900. **Disclosure API** — expose the disclosure-correlation engine as an API for external tooling.
25901. **Disclosure confidence labels** — label disclosure-derived claims with verification status (vendor-confirmed vs. researcher-claimed).
25902. **Stale-disclosure archiver** — archive disclosures for products the target no longer runs to keep correlations relevant.
25903. **Disclosure-driven retest triggers** — trigger retests when a new disclosure reveals a variant of a previously found bug.
25904. **Disclosure program maturity score** — score the target's disclosure-handling maturity from triage speed and researcher sentiment.

## 10. Intel-Driven Hunt Planning (25905–26004)

25905. **STIX/TAXII feed ingestor** — ingest STIX 2.1 bundles via TAXII 2.1 servers and convert indicators and TTPs into hunt-plan inputs automatically.
25906. **TAXII-collection scheduler** — poll TAXII collections on a schedule and diff new objects against the target's profile to trigger plan updates.
25907. **STIX-indicator-to-scope mapper** — map STIX indicators (domains, IPs, URLs) to in-scope hunt targets, expanding scope only where intel justifies it.
25908. **STIX-attack-pattern-to-check converter** — convert STIX attack patterns into concrete Dark-Matter hunt checks with preconditions and validation steps.
25909. **YARA-rule-to-hunt-check converter** — parse YARA rules from intel feeds and generate hunt checks that look for the same malicious artifacts on the target.
25910. **Sigma-rule coverage mapper** — map Sigma detection rules to hunt checks to show which attacker behaviors the hunt validates versus which defenses detect.
25911. **Sigma-to-hunt gap finder** — find Sigma rules with no corresponding hunt check and generate the missing checks for full behavior coverage.
25912. **Snort-rule-to-probe translator** — translate Snort/Suricata rules for the target's stack into active probes that test the same vulnerability conditions.
25913. **IOC-driven scoping engine** — automatically adjust hunt scope when IOCs implicate additional subdomains, IPs, or cloud assets tied to the target.
25914. **Campaign-report plan builder** — parse threat-intel campaign reports and auto-build a hunt plan replicating the campaign's initial-access and TTP sequence.
25915. **TTP-sequence planner** — order hunt checks to mirror the exact TTP sequences in recent intel reports for realistic adversary emulation.
25916. **Intel-confidence-weighted planner** — weight plan items by intel confidence so high-confidence TTPs get deep testing and low-confidence ones get light probing.
25917. **Freshness-decay planner** — decay the priority of intel-derived checks as the underlying intel ages, keeping plans focused on current threats.
25918. **Multi-source intel fuser** — fuse STIX, YARA, Sigma, and vendor reports into a single normalized plan input, deduplicating overlapping guidance.
25919. **Intel-to-ATT&CK normalizer** — normalize all incoming intel to ATT&CK techniques so planning speaks one language regardless of source format.
25920. **Plan-coverage heatmap** — render which intel items the plan covers and which are unaddressed, with one-click check generation for gaps.
25921. **Adversary-emulation plan packs** — ship prebuilt plan packs emulating named adversaries, generated from their published intel profiles.
25922. **Sector-threat plan templates** — auto-select plan templates based on sector-threat intel for the target's industry vertical.
25923. **Geopolitical-risk plan adjuster** — adjust plan emphasis (espionage TTPs vs. crime TTPs) based on geopolitical intel relevant to the target.
25924. **Vulnerability-intel plan injector** — inject CVE and exploit intel directly into the plan builder so vulnerability checks reflect live exploitability.
25925. **Dark-web-intel plan hooks** — trigger plan additions when dark-web monitoring finds the target discussed (e.g., add IAB-access validation checks).
25926. **Ransomware-intel plan pack** — auto-add a ransomware-readiness plan module when sector intel shows active targeting.
25927. **Zero-day plan injection** — inject zero-day-specific checks into running plans within minutes of disclosure, without restarting the hunt.
25928. **Phishing-kit plan signals** — add brand-impersonation and lookalike-domain checks to the plan when kit intel shows active campaigns.
25929. **C2-intel plan triggers** — add compromise-assessment checks when C2 intel implicates the target's infrastructure.
25930. **Disclosure-intel plan refresh** — refresh plans weekly from new vulnerability disclosures affecting the target's stack.
25931. **Threat-feed health monitor** — monitor the health and freshness of every intel feed feeding the planner, alerting on stale or dead sources.
25932. **Feed-quality scorer** — score feeds by precision (true-positive rate) and recall to prefer high-quality intel in planning.
25933. **Intel-source deconflictor** — resolve conflicts between intel sources (e.g., contradictory TTP claims) with provenance tracking.
25934. **Plan-version tracker** — version every plan change driven by intel so users can audit what intel caused which check.
25935. **Intel-driven plan diff viewer** — show a diff of plan changes between hunts with the intel deltas that caused them.
25936. **Hunt-plan intel receipt** — attach an intel receipt to each plan listing every source and item that shaped it.
25937. **Custom-intel uploader** — let users upload their own STIX bundles, YARA rules, or IOC lists to shape plans with private intel.
25938. **Intel-tagging taxonomy** — apply a consistent tagging taxonomy (TLP, confidence, sector) to all plan-driving intel.
25939. **TLP-aware plan sharing** — respect Traffic Light Protocol markings when sharing intel-derived plans with third parties.
25940. **Plan-sensitivity classifier** — classify plans containing sensitive intel and restrict their export accordingly.
25941. **Intel-retention enforcer** — enforce retention policies on intel used in planning to meet legal and sharing-agreement duties.
25942. **Anonymized-intel sharing opt-in** — let users contribute anonymized plan-effectiveness data back to the intel community.
25943. **Plan-effectiveness feedback loop** — feed hunt outcomes back into intel scoring: intel that predicted real findings gets upweighted.
25944. **False-positive intel reporter** — report intel items that repeatedly generate false-positive checks so sources can be tuned.
25945. **Intel-gap reporter** — report threat behaviors with no available intel to guide collection priorities.
25946. **Planner-learning engine** — learn which intel types most often lead to findings per sector and bias future plans accordingly.
25947. **Cross-target intel correlator** — correlate intel effectiveness across all of a user's targets to find portfolio-wide patterns.
25948. **Time-to-plan metric** — measure time from intel ingestion to plan update as a key agility metric.
25949. **Plan-agility scorecard** — score how quickly plans adapt to new intel, benchmarking against best practice.
25950. **Emergency-plan playbook** — maintain a one-click emergency plan template for zero-day and active-exploitation scenarios.
25951. **Plan-rollback capability** — roll back intel-driven plan changes if the underlying intel is retracted or disproven.
25952. **Intel-retraction handler** — automatically flag and quarantine plan items when their driving intel is retracted.
25953. **Duplicate-intel deduper** — deduplicate the same intel arriving via multiple feeds before it spawns duplicate checks.
25954. **Intel-priority arbitrator** — arbitrate when multiple intel items demand conflicting plan priorities using severity and confidence.
25955. **Resource-aware planner** — fit intel-driven checks into the hunt's time and request budget, prioritizing by expected value.
25956. **Stealth-aware plan tuner** — tune intel-derived check aggressiveness to the hunt's stealth setting to avoid detection.
25957. **Scope-aware intel filter** — filter intel-derived checks to authorized scope, queuing out-of-scope items as recommendations.
25958. **Safe-harbor intel gate** — gate intrusive intel-derived checks behind safe-harbor verification for the target.
25959. **Plan-explainer generator** — generate plain-language explanations of why each intel item shaped the plan for stakeholder trust.
25960. **Intel-plan executive brief** — summarize the intel-driven plan for executives: what threats, why these checks, expected outcomes.
25961. **Hunt-plan approval workflow** — route intel-driven plans through approval when they include high-intrusion checks.
25962. **Plan-simulation mode** — simulate the plan against a model of the target to estimate duration and finding yield before running.
25963. **What-if intel sandbox** — let users test how hypothetical intel (e.g., "what if this zero-day drops?") would reshape the plan.
25964. **Intel-driven retest planner** — build retest plans from intel on fix-bypass techniques for previously found issues.
25965. **Continuous-hunt intel loop** — run hunts continuously, with the planner reprioritizing in real time as new intel arrives.
25966. **Intel-driven asset discovery** — use intel (cert logs, passive DNS, leaks) to discover target assets the initial recon missed.
25967. **Shadow-asset intel finder** — find shadow IT assets via intel sources like leaked subdomain lists and certificate transparency.
25968. **M&A intel due-diligence pack** — build acquisition due-diligence plans from intel on the acquisition target's sector threats.
25969. **Vendor-risk intel planner** — build vendor-assessment plans from intel on threats targeting the vendor's sector and stack.
25970. **Supply-chain intel overlay** — overlay supply-chain compromise intel on the plan when the target's vendors are implicated.
25971. **Cloud-intel plan module** — add cloud-specific plan modules driven by cloud-threat intel for the target's providers.
25972. **OT-intel plan module** — add OT-specific modules from ICS intel for industrial targets.
25973. **Mobile-intel plan module** — add mobile modules from mobile-threat intel when the target has apps or MDM.
25974. **Insider-threat plan lens** — apply an insider-threat lens to planning when intel suggests insider recruitment in the sector.
25975. **Fraud-intel plan hooks** — hook fraud-intel (account-takeover trends, mule networks) into plans for fintech targets.
25976. **Disinformation-intel monitor** — monitor disinformation campaigns targeting the brand as a plan input for reputational-risk hunts.
25977. **Physical-threat intel bridge** — bridge physical-threat intel (protests, facility threats) into cyber plans when convergence risk exists.
25978. **Event-driven plan triggers** — trigger plan updates on real-world events (mergers, layoffs, product launches) that change the threat picture.
25979. **News-sentiment plan adjuster** — adjust plan focus based on news sentiment that might motivate hacktivist attention.
25980. **Regulatory-change plan updater** — update plans when new regulations change which findings matter most for the target.
25981. **Intel-community plan exchange** — exchange anonymized plan templates with trusted peers facing the same threats.
25982. **ISAC-feed plan integration** — integrate sector ISAC feeds directly into the planner for member organizations.
25983. **Government-advisory plan mapper** — map CISA/NCSC advisories to plan checks automatically on publication.
25984. **Vendor-threat-report ingestor** — ingest vendor threat reports (Mandiant, CrowdStrike, Talos) and extract plan-relevant TTPs via NLP.
25985. **Report-to-plan NLP pipeline** — use NLP to turn unstructured threat reports into structured plan items with confidence scores.
25986. **Intel-entity extractor** — extract IOCs, TTPs, and victimology from reports automatically for plan enrichment.
25987. **Plan-item evidence linker** — link every plan item back to the exact intel passage that motivated it for auditability.
25988. **Intel-citation formatter** — format intel citations in reports consistently with source, date, and confidence.
25989. **Planner API** — expose the intel-driven planner as an API so SOAR platforms can request plans programmatically.
25990. **Plan-as-code exporter** — export plans as version-controlled code (YAML) for review and reuse.
25991. **Plan-template marketplace** — share and discover community plan templates for common threat scenarios.
25992. **Plan-benchmark comparer** — compare a plan's intel coverage against community benchmarks for similar targets.
25993. **Planner-bias detector** — detect when the planner over-weights certain intel sources and rebalance automatically.
25994. **Adversarial-intel detector** — detect poisoned or manipulated intel (fake leaks, decoy IOCs) before it shapes plans.
25995. **Intel-integrity verifier** — verify feed signatures and source authenticity for all plan-driving intel.
25996. **Plan-redundancy eliminator** — eliminate redundant checks that multiple intel items independently suggested.
25997. **Plan-depth optimizer** — optimize how deep each intel-derived check goes based on expected value and cost.
25998. **Multi-hunt intel scheduler** — schedule intel refreshes across a fleet of hunts so shared intel updates propagate everywhere.
25999. **Intel-driven hunt calendar** — build a hunt calendar from intel tempo (e.g., monthly ransomware-sector rotations).
26000. **Quarterly intel-plan review** — generate quarterly reviews of how intel shaped plans and what it found.
26001. **Annual threat-landscape planner** — build the annual hunt program from the year's threat-landscape intel.
26002. **Planner-maturity assessor** — assess the maturity of intel-driven planning per organization with improvement roadmaps.
26003. **Intel-ROI calculator** — calculate the ROI of intel feeds by attributing findings to the intel that drove their checks.
26004. **Autonomous intel-to-action loop** — close the loop fully: ingest intel, plan, hunt, report, and feed outcomes back into intel scoring with no human touchpoints.
