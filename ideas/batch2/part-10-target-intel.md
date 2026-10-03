# Part 10 — Target intelligence

0001. **Tech-stack change detector** — fingerprints the target's frameworks and versions on a weekly cadence and raises an alert when anything changes, since every new deploy is a new attack surface, auto-triggering a focused re-hunt on the changed components.
0002. **JavaScript bundle differ** — downloads and diffs the target's production JS bundles between crawls, flagging new API endpoints, new third-party integrations, and newly exposed internal paths hidden in the code.
0003. **Response-header drift monitor** — snapshots security headers (CSP, HSTS, X-Frame-Options) on every run and alerts when protections are weakened or removed, which often precedes a risky deploy.
0004. **Server banner change tracker** — records Server, X-Powered-By, and Via headers over time and flags version changes or server swaps that indicate infrastructure migration worth re-scoping.
0005. **TLS configuration watcher** — tracks negotiated TLS versions, cipher suites, and certificate issuers, alerting on downgrades or CA changes that signal proxy, WAF, or CDN swaps.
0006. **WAF fingerprint change alert** — detects when the target's WAF vendor or challenge behavior changes (e.g., Cloudflare to Akamai), because rule sets and bypass surface change with it.
0007. **CDN migration detector** — watches CNAME chains, edge response headers, and IP ownership to catch CDN migrations that reset caching behavior and expose origin servers.
0008. **Error-page verbosity monitor** — compares error pages across deploys and alerts when stack traces, debug info, or framework banners start leaking, indicating debug mode left on.
0009. **Login-page flow differ** — snapshots the authentication flow (fields, SSO buttons, MFA prompts) and flags new identity providers or passwordless options that expand the auth attack surface.
0010. **HTTP/2 to HTTP/3 enablement watcher** — detects newly enabled protocols like QUIC/HTTP-3, which bring fresh parser and configuration surface worth probing.
0011. **Robots.txt change feed** — diffs robots.txt on every crawl and alerts on newly disallowed paths, since newly hidden paths often mark newly deployed admin or staging areas.
0012. **Sitemap index differ** — tracks sitemap.xml additions and removals to discover newly published routes, deprecated sections, and forgotten endpoints still serving traffic.
0013. **Security.txt appearance monitor** — watches .well-known/security.txt for first appearance or contact changes, signaling a maturing disclosure program and new scope hints.
0014. **OpenAPI spec drift detector** — fetches published Swagger/OpenAPI documents on a schedule and diffs paths, parameters, and auth schemes to catch undocumented API growth.
0015. **GraphQL schema introspection differ** — snapshots the GraphQL schema via introspection where enabled and alerts on new types, mutations, and fields that widen query surface.
0016. **WSDL/XSD change tracker** — monitors SOAP service descriptors for new operations or changed bindings, since legacy SOAP endpoints are frequently forgotten during re-hunts.
0017. **gRPC reflection watcher** — polls gRPC reflection endpoints for newly registered services and methods, catching microservices that appear without any web announcement.
0018. **CORS policy drift monitor** — records Access-Control-Allow-Origin values per endpoint and flags wildcard or newly trusted origins that enable cross-origin data theft.
0019. **CSP policy tightness tracker** — diffs Content-Security-Policy headers over time, alerting when script-src or connect-src loosens, which directly enables XSS and data exfiltration paths.
0020. **Feature-flag endpoint discovery** — monitors for newly reachable feature-flag or remote-config endpoints (LaunchDarkly, Unleash) whose flag names reveal unreleased features and hidden routes.
0021. **A/B testing framework detector** — identifies newly injected experimentation scripts and flags the variant routes they expose, since test variants often lack production hardening.
0022. **Analytics and tag-manager container differ** — tracks GTM/Tealium container IDs and injected tags, alerting when new third-party tags appear that widen supply-chain exposure.
0023. **WebSocket endpoint inventory** — maintains a living list of ws/wss endpoints found in client code and re-checks them each cycle for new channels, auth changes, or removed origin checks.
0024. **Server-sent events watcher** — discovers EventSource endpoints and monitors for new event streams that may leak internal state or user data.
0025. **Service worker script differ** — downloads and diffs service worker code to catch new caching rules, push endpoints, and background sync URLs that persist across sessions.
0026. **PWA manifest change tracker** — diffs manifest.json for new scopes, shortcuts, and handlers that reveal additional app entry points and protocol handlers.
0027. **Favicon hash change alert** — treats favicon hash changes as a cheap rebrand/redeploy signal and triggers a light re-fingerprint of the whole site when it flips.
0028. **Structured data (JSON-LD) differ** — monitors schema.org markup for new organization, product, or API references that leak internal naming and partner integrations.
0029. **Meta and OG tag watcher** — diffs meta tags for new app IDs, verification tokens, and platform integrations that reveal connected third-party accounts.
0030. **Hreflang and locale rollout detector** — flags newly added language/region variants, since each localized deployment is a parallel attack surface with its own config drift.
0031. **Canonical URL change monitor** — tracks canonical link changes that signal URL restructuring, migrations, or new canonical hosts worth adding to scope.
0032. **Redirect chain differ** — records full redirect chains for key URLs and alerts on new hops, which often reveal newly inserted proxies, WAFs, or tracking domains.
0033. **Trailing-slash behavior watcher** — monitors normalization behavior changes that indicate framework or routing-layer swaps beneath the application.
0034. **HTTP method support differ** — replays OPTIONS and method probes per endpoint each cycle, flagging newly allowed PUT/DELETE/PATCH methods that enable direct object manipulation.
0035. **WebDAV capability watcher** — checks for newly enabled WebDAV verbs or endpoints, a classic forgotten file-management surface on migrated hosts.
0036. **Debug endpoint appearance scan** — watches for newly exposed /debug/pprof, /metrics, /actuator, and /health endpoints after each deploy, which leak internals and enable DoS.
0037. **Admin panel emergence detector** — correlates new paths like /admin, /console, /manage with auth behavior to flag admin interfaces that appear without announcement.
0038. **Staging and preview URL harvester** — learns the target's preview-deploy URL patterns (Vercel/Netlify style) and monitors for new preview hosts that expose pre-release code.
0039. **Environment naming pattern learner** — infers dev/stage/canary subdomain conventions from discovered hosts and proactively watches for new environments matching the pattern.
0040. **Maintenance page change tracker** — diffs maintenance and coming-soon pages, since countdown timers and launch copy reveal release dates for new surface.
0041. **Beta and waitlist flow monitor** — watches invite-only and early-access signup flows for changes that signal new features entering limited release.
0042. **Pricing page change intelligence** — diffs pricing tiers and feature lists, because a new "Enterprise SSO" or "API access" tier directly predicts new auth and API surface.
0043. **Changelog mining engine** — parses the target's changelog/release notes with NLP to extract security-relevant changes (new endpoints, new integrations, new auth methods) and maps each to hunt tasks.
0044. **Engineering blog surface extractor** — mines engineering blog posts for architecture reveals (new services, migrations, tech adoption) and converts each mention into a scoped reconnaissance target.
0045. **Status page change monitor** — watches the target's status page for new components, which enumerate the real production service inventory better than any scan.
0046. **Incident postmortem miner** — extracts architecture details from public postmortems (databases, queues, providers) to refine the target model after every incident.
0047. **Deploy frequency estimator** — infers release cadence from ETag/Last-Modified churn, JS bundle hashes, and header changes to schedule re-hunts right after deploys.
0048. **Docs site drift detector** — diffs developer documentation pages, since docs updates routinely precede or accompany new API endpoints and auth flows.
0049. **API changelog watcher** — monitors the target's API changelog or developer newsletter for breaking changes, new versions, and deprecation timelines that reshape scope.
0050. **Terms and privacy policy differ** — diffs legal pages for new data types, subprocessors, and integrations that reveal new data flows and third-party surface.
0051. **Cookie policy change tracker** — monitors cookie disclosures for newly listed tracking, functional, or auth cookies that map to new backend services.
0052. **Subprocessor list watcher** — tracks the target's published subprocessor list, since each new subprocessor is a new data-flow and supply-chain node to assess.
0053. **Careers page tech extractor** — scrapes job listings for tech-stack mentions (Kubernetes, GraphQL, React Native) and converts each into predicted attack surface for the hunt plan.
0054. **Job description stack profiler** — builds a per-team tech profile from open roles, predicting which internal tools and platforms exist before any packet is sent.
0055. **Interview-leak stack intelligence** — monitors public interview reports for the target's stack questions, corroborating the tech profile with ground truth from candidates.
0056. **Employee public-post miner** — scans public posts by the target's engineers for mentions of internal tools, dashboards, and platforms, mapping likely internal hostnames.
0057. **Conference talk slide miner** — extracts architecture diagrams and tech mentions from the target's conference talks to enrich the target model with confirmed internals.
0058. **Podcast appearance transcriber** — transcribes podcast interviews with the target's technical leaders, extracting stack and migration mentions into structured intel.
0059. **Webinar recording miner** — processes the target's webinar recordings for demoed URLs, admin panels, and integration names visible on screen.
0060. **Demo video endpoint extractor** — watches product demo videos frame-by-frame for visible URLs, API calls, and dashboard hostnames to add to scope.
0061. **Screenshot metadata harvester** — extracts EXIF and embedded metadata from the target's published screenshots and press images for tooling and environment hints.
0062. **Press kit asset URL mapper** — inventories brand-asset CDN URLs from press kits, revealing CDN configuration and storage bucket patterns.
0063. **Design system publication watcher** — monitors public Storybook or component libraries, whose component names and API examples reveal frontend architecture and endpoints.
0064. **Help center article miner** — diffs knowledge-base articles for new internal tool names, admin workflows, and integration guides that expose backend surface.
0065. **Community forum surface miner** — scans the target's public forums for staff-posted URLs, beta links, and troubleshooting steps that reveal infrastructure.
0066. **Video tutorial flow mapper** — converts tutorial click-paths into endpoint sequences, building an authenticated-flow map without credentials.
0067. **Release note security-section parser** — isolates security fixes in release notes to learn which components are fragile and deserve deeper re-hunting.
0068. **Patch cadence learner** — measures time between release-note security fixes to predict patch windows and schedule hunts when fresh code is live.
0069. **Emergency patch detector** — flags out-of-band releases as high-interest events, since rushed patches often introduce regressions worth testing.
0070. **SDK release monitor** — watches the target's published SDKs for new versions, diffing them to extract newly added client-callable endpoints.
0071. **Sample app repo watcher** — monitors the target's sample-code repositories, which contain hardcoded endpoints, demo credentials patterns, and API usage examples.
0072. **Postman public workspace tracker** — watches the target's public Postman workspaces and collections for newly published requests that document live endpoints.
0073. **API playground change detector** — diffs interactive API explorers for new operations, parameters, and example payloads that mirror production capabilities.
0074. **Webhook event catalog differ** — tracks published webhook event types, since each new event type implies a new backend workflow and retry endpoint.
0075. **Webhook signature scheme watcher** — monitors docs for signature algorithm changes that indicate webhook infrastructure rewrites.
0076. **Rate-limit documentation watcher** — diffs published rate limits, because newly documented limits reveal previously hidden endpoints and abuse controls.
0077. **API versioning scheme detector** — identifies versioning strategy (URL, header, media type) and watches for new version announcements that obsolete old scope.
0078. **Version deprecation timeline tracker** — records sunset dates for old API versions to prioritize hunting the replacement surface before migration completes.
0079. **Breaking-change announcement monitor** — flags announced breaking changes as re-hunt triggers, since rewritten endpoints carry fresh logic flaws.
0080. **Beta API program watcher** — tracks early-access API programs whose participants receive pre-release endpoints worth monitoring for public launch.
0081. **Migration guide miner** — parses v1-to-v2 migration guides to build a complete map of the new API surface before it fully replaces the old.
0082. **Egress IP list watcher** — monitors published outbound IP ranges, which enumerate the target's cloud footprint and webhook source addresses.
0083. **IP allowlist publication tracker** — diffs published allowlists for partner integrations, revealing new B2B endpoints and trust relationships.
0084. **Partner integration directory miner** — inventories listed integrations, since each partner connection is a third-party-mediated path into target data.
0085. **App marketplace listing watcher** — tracks the target's listings on app marketplaces, where permission scopes and webhook URLs document the integration surface.
0086. **Integration guide harvester** — extracts endpoint and auth details from partner integration guides published for third-party developers.
0087. **Customer logo addition tracker** — monitors new customer logos and case studies, whose tech mentions reveal deployment architectures and integrations.
0088. **Case study tech-mention extractor** — parses case studies for named infrastructure components that corroborate the target's stack model.
0089. **Solution architect blog miner** — extracts reference architectures from partner solution posts that describe how the target's platform is deployed.
0090. **Whitepaper infrastructure extractor** — mines technical whitepapers for named services, data flows, and security controls worth verifying.
0091. **Benchmark report infra miner** — extracts infrastructure details from performance benchmark reports the target publishes or sponsors.
0092. **Scaling story architecture extractor** — converts "how we scaled" posts into service inventory, queue, and database intel for the target model.
0093. **Replatform announcement tracker** — flags announced platform migrations (e.g., monolith to microservices) as scope-expansion events with new per-service subdomains.
0094. **Cloud region expansion watcher** — monitors announcements of new regions or PoPs, each of which is a new deployment to fingerprint for config drift.
0095. **Data residency announcement tracker** — flags new data-residency regions, which imply region-specific deployments with potentially divergent configurations.
0096. **Edge compute adoption detector** — identifies edge-function and edge-rendering adoption from headers and job posts, marking a new execution environment to assess.
0097. **Serverless adoption signal tracker** — correlates job posts, blogs, and headers to detect serverless migrations that change the trust boundary.
0098. **Service mesh adoption detector** — looks for mesh-specific headers and mTLS behaviors indicating Istio/Linkerd adoption and new sidecar surface.
0099. **API gateway migration watcher** — detects gateway vendor changes via header and behavior fingerprints, since routing, auth, and rate-limiting semantics change with it.
0100. **DNS provider migration detector** — watches NS records and SOA for provider changes that reset DNS-level protections and enable re-evaluation of zone hygiene.
0101. **DNS record drift monitor** — snapshots A, AAAA, CNAME, MX, TXT, and SRV records for the target's domains and alerts on any change, since DNS edits are the earliest signal of infrastructure moves.
0102. **SOA serial change watcher** — tracks zone serial increments as a lightweight heartbeat of DNS administration activity, triggering deeper checks when the zone is edited.
0103. **Nameserver delegation change alert** — flags NS record changes that indicate DNS provider migrations, which reset DNSSEC, CAA, and traffic-management behavior.
0104. **MX record change tracker** — monitors mail exchanger changes that reveal email provider migrations (Google Workspace to Microsoft 365), each with its own spoofing and phishing surface.
0105. **SPF include drift detector** — diffs SPF records for newly authorized senders, since each added include delegates email-sending trust to another third party.
0106. **DKIM selector rotation watcher** — detects new DKIM selectors appearing in DNS, signaling key rotations or new mail platforms coming online.
0107. **DMARC policy change monitor** — tracks DMARC policy tightening or loosening (none to quarantine to reject), which reflects the maturity and risk posture of the target's email security.
0108. **MTA-STS policy fetch monitor** — polls the target's MTA-STS policy for mode changes (testing to enforce), revealing mail transport security posture shifts.
0109. **BIMI record watcher** — monitors BIMI DNS records and logo changes that indicate verified-mark certificate issuance and brand-protection investment.
0110. **CAA record change alert** — diffs Certification Authority Authorization records, since newly permitted CAs expand who can issue certificates for the target's domains.
0111. **TLSA/DANE record monitor** — watches for DANE adoption or record changes that signal DNSSEC-secured mail and web deployments.
0112. **SSHFP record tracker** — monitors SSHFP records for new hosts, mapping SSH-exposed infrastructure the target chooses to advertise.
0113. **SRV record inventory watcher** — maintains a living inventory of SRV records (SIP, XMPP, LDAP, Kerberos) and flags new services the target publishes.
0114. **TXT verification token harvester** — catalogs domain-verification TXT tokens to enumerate which SaaS platforms the target has onboarded (Google, Atlassian, Zoom, Docusign).
0115. **DNSSEC enablement change detector** — flags zones gaining or losing DNSSEC, since validation changes affect cache-poisoning resistance and resolver behavior.
0116. **Wildcard DNS behavior watcher** — monitors wildcard record appearance and resolution behavior, which massively expands the brute-forceable hostname space.
0117. **Dangling DNS re-check scheduler** — re-resolves previously dangling CNAMEs on a cadence, alerting the moment a record becomes claimable or gets re-pointed.
0118. **Expired-domain re-registration watch** — monitors the target's expired or lapsed domains for re-registration by third parties, a prime phishing and takeover risk.
0119. **Typosquat registration monitor** — watches certificate transparency and new-domain feeds for lookalike registrations of the target's brand, feeding defensive brand-protection intel.
0120. **Homoglyph domain watcher** — tracks IDN homograph registrations mimicking the target's domains, correlating each with issued certificates for phishing readiness.
0121. **Certificate Transparency alerting engine** — streams CT logs for the target's domains and scores each new certificate for takeover risk, mis-issuance, and unexpected SANs.
0122. **CT precertificate anomaly detector** — flags precertificates with unusual issuers, short lifetimes, or odd SAN combinations that suggest automation errors or compromise.
0123. **Wildcard issuance event monitor** — alerts on newly issued wildcard certificates, which expand the set of hostnames an attacker can impersonate with a valid cert.
0124. **Multi-SAN change tracker** — diffs Subject Alternative Name lists across issuances to detect newly covered hostnames that may be new production assets.
0125. **SAN addition and removal alerts** — treats SAN additions as new-asset discovery and SAN removals as decommission signals, keeping the asset inventory current.
0126. **Certificate lifetime change watcher** — flags shifts between 90-day automated and multi-year manual certificates, revealing changes in certificate management maturity.
0127. **CA migration detector** — identifies when the target switches certificate authorities, which changes validation rigor, CT logging, and revocation behavior.
0128. **ACME automation signal detector** — detects ACME challenge patterns (DNS-01 TXT records, HTTP-01 paths) to map which assets use automated issuance versus manual processes.
0129. **OCSP and CRL behavior monitor** — tracks responder URLs and revocation freshness, since neglected revocation infrastructure undermines the whole PKI.
0130. **SCT and transparency compliance watcher** — verifies Signed Certificate Timestamps across issuances, flagging non-logged certificates that evade CT monitoring.
0131. **Issuer CAA compliance checker** — cross-references each new certificate's issuer against the domain's CAA records to catch policy-violating issuance.
0132. **Private CA leak detector** — watches public CT logs for certificates chaining to the target's internal CA, which would expose internal PKI to the internet.
0133. **Code-signing certificate transparency watcher** — monitors CT and public feeds for code-signing certs issued to the target org, mapping software distribution trust.
0134. **Phishing-certificate detector for lookalikes** — correlates newly issued certificates on typosquat domains with the target's brand for defensive takedown prioritization.
0135. **Port-scan diff engine** — runs periodic authorized port scans and diffs open ports, flagging newly exposed services like databases, admin consoles, or debug ports.
0136. **Service banner diff tracker** — records banners from every open port and alerts on version changes that indicate patching, upgrades, or quietly added services.
0137. **New IP appearance monitor** — watches the target's announced IP space for newly responsive hosts, treating each as a candidate asset for scope review.
0138. **ASN change detector** — flags when target IPs move between autonomous systems, signaling hosting provider or cloud migrations.
0139. **Hosting provider migration watcher** — correlates IP ownership, reverse DNS, and latency to detect cloud-to-cloud or on-prem-to-cloud moves.
0140. **Cloud region deployment detector** — identifies new cloud regions serving the target via latency triangulation and IP geolocation, each a new config to verify.
0141. **Anycast and edge PoP change tracker** — monitors edge presence changes that indicate CDN or DDoS-mitigation vendor swaps.
0142. **BGP announcement monitor** — watches BGP for new prefix announcements or withdrawals covering the target's space, catching hijacks and migrations alike.
0143. **PeeringDB update watcher** — tracks the target's PeeringDB entries for new IXPs, facilities, and ASNs that document network expansion.
0144. **Reverse DNS drift monitor** — diffs PTR records across the target's IP ranges, since new PTR hostnames leak internal naming conventions and asset purposes.
0145. **IPv6 enablement detector** — flags newly reachable IPv6 addresses for the target's domains, a parallel stack that often misses hardening applied to IPv4.
0146. **QUIC/UDP service discovery** — probes for newly enabled QUIC listeners that indicate HTTP/3 rollouts with fresh transport-layer surface.
0147. **SMTP banner diff monitor** — records mail server banners over time to detect MTA upgrades, migrations, or newly exposed submission ports.
0148. **STARTTLS behavior watcher** — monitors SMTP/IMAP/POP3 STARTTLS support changes that affect mail transport confidentiality posture.
0149. **Autodiscover and autoconfig tracker** — watches mail client autoconfiguration endpoints for provider changes that shift phishing and credential-harvesting surface.
0150. **Exchange/OWA version detector** — fingerprints mail web clients across cycles, flagging version changes tied to known vulnerability windows.
0151. **VPN endpoint change monitor** — tracks the target's published VPN gateways and client config endpoints for vendor or version changes.
0152. **WiFi/EAP certificate change watcher** — monitors enterprise wireless certificate changes that signal RADIUS or NAC infrastructure updates.
0153. **NTP infrastructure watcher** — inventories the target's public NTP servers, whose versions and configurations are frequently neglected.
0154. **Public resolver operation detector** — identifies if the target operates open resolvers, a DNS-amplification risk and reconnaissance goldmine.
0155. **Looking-glass and route-server watcher** — monitors the target's public network measurement endpoints for topology disclosures.
0156. **Speed-test server harvester** — catalogs Ookla-style speed test hosts run by the target, which confirm PoP locations and network identity.
0157. **RIPE Atlas probe host detector** — finds target-hosted measurement probes that corroborate network presence claims.
0158. **DNS measurement participation tracker** — monitors the target's involvement in public DNS measurement projects for infrastructure disclosures.
0159. **Subdomain brute-force wordlist learner** — learns the target's hostname naming conventions from discovered subdomains and generates custom wordlists that outperform generic ones.
0160. **Naming convention inference engine** — infers patterns like api-, auth-, admin-, region codes, and project codenames to predict undiscovered hostnames.
0161. **Project codename extractor** — mines job posts, blogs, and talks for internal project codenames, then watches DNS and CT logs for matching hostnames.
0162. **Internal tool name harvester** — collects internal dashboard and tool names from employee posts and predicts corresponding internal or accidentally-exposed hostnames.
0163. **Vendor name to hostname correlator** — maps named vendors (Okta, Datadog, PagerDuty) to expected SSO, telemetry, and status hostnames for the target.
0164. **Certificate SAN to asset mapper** — converts every SAN on the target's certificates into a tracked asset, closing the gap between DNS enumeration and real deployments.
0165. **Passive DNS new-hostname alerter** — subscribes to passive DNS feeds for the target's domains and alerts on first-seen hostnames within hours of activation.
0166. **Passive DNS new-IP alerter** — flags when known target hostnames resolve to new IPs, indicating migrations, failovers, or shadow infrastructure.
0167. **URLScan submission watcher** — monitors urlscan.io for scans of the target's domains, extracting discovered URLs, technologies, and third-party connections.
0168. **URLScan behavior differ** — diffs repeated urlscan results for the target to catch DOM, request, and technology changes between scans.
0169. **Censys exposure differ** — diffs Censys host and certificate data for the target's assets, catching newly exposed services and certificate changes.
0170. **Shodan exposure trend tracker** — tracks Shodan-indexed services for the target over time, flagging newly indexed ports and products.
0171. **FOFA and ZoomEye cross-checker** — correlates Chinese search-engine indexes for the target's assets to catch exposures missed by Western scanners.
0172. **LeakIX exposure watcher** — monitors LeakIX for newly indexed leaks, misconfigurations, and exposed services tied to the target.
0173. **BinaryEdge and Onyphe differ** — cross-references additional internet scanners for target asset changes, reducing single-source blind spots.
0174. **SecurityTrails history analyzer** — mines historical DNS data for the target to reconstruct past infrastructure and find forgotten but still-resolving assets.
0175. **RiskIQ-style artifact tracker** — maintains a timeline of the target's web components, certificates, and trackers from commercial telemetry where available.
0176. **Domain portfolio size trend monitor** — tracks the total count of domains associated with the target org, flagging sudden growth (acquisitions) or shrinkage (divestitures).
0177. **Registrar portfolio move detector** — flags bulk registrar transfers that indicate consolidation projects or brand-protection vendor changes.
0178. **Defensive domain strategy watcher** — monitors the target's defensive registrations to infer which brands and products they consider highest-risk.
0179. **TLD expansion monitor** — watches for the target registering new gTLD/ccTLD variants, which often precede regional launches with new localized surface.
0180. **IDN defensive registration tracker** — monitors the target's internationalized domain registrations as a signal of new market entry.
0181. **Domain expiry risk watcher** — tracks expiration dates across the target's portfolio and alerts on domains nearing lapse that could be hijacked.
0182. **WHOIS privacy change detector** — flags when the target enables or drops WHOIS privacy, which changes the OSINT available on ownership and contacts.
0183. **RDAP data change monitor** — diffs RDAP records for registrant, status, and nameserver changes that WHOIS privacy might otherwise hide.
0184. **Domain transfer event detector** — catches inter-registrar transfers that often accompany acquisitions, rebrands, or security incidents.
0185. **Abuse contact change tracker** — monitors published abuse contacts, since changes reveal SOC or brand-protection vendor transitions.
0186. **Phishing-reporting address watcher** — tracks the target's published phishing-report addresses as an indicator of anti-phishing program maturity.
0187. **BGP hijack detector for target prefixes** — watches for unauthorized origin announcements of the target's prefixes, a direct integrity threat to all hosted assets.
0188. **Route leak impact assessor** — evaluates route leaks affecting the target's prefixes for traffic-interception risk during the leak window.
0189. **DNS hijack signal correlator** — combines NS changes, DS record removals, and registrar events to detect possible domain hijacking early.
0190. **Nameserver compromise indicator** — flags unexpected glue record or delegation changes that suggest DNS provider account compromise.
0191. **Domain validation method watcher** — tracks which DCV methods the target's CAs use, since email-based validation is weaker than DNS or HTTP methods.
0192. **EV to OV to DV downgrade detector** — flags certificate validation-level downgrades that reduce identity assurance for customers.
0193. **Mass revocation event monitor** — watches for bulk revocations affecting the target's certificates, which signal CA incidents or key compromises.
0194. **Problematic certificate replacement tracker** — measures how quickly the target replaces mis-issued or weak certificates, indicating PKI operational maturity.
0195. **Root and intermediate rotation watcher** — monitors CA trust-chain changes affecting the target, which can break pinning and legacy clients.
0196. **Cross-signing change detector** — flags cross-sign changes in the target's chains that affect compatibility and trust-path redundancy.
0197. **Must-staple adoption tracker** — monitors OCSP must-staple adoption on the target's certificates as a revocation-hardening signal.
0198. **Delegated credentials watcher** — detects TLS delegated-credential usage indicating CDN edge-termination architectures.
0199. **Short-lived certificate adoption monitor** — tracks migration to short-lived certs, which shrinks the window of usefulness for stolen certificates.
0200. **Internal hostname leak detector** — scans certificates, headers, and error pages for internal-only hostnames (intranet, corp, dc01) that map the inside network.
0201. **Acquisition monitor** — watches news feeds and domain registration correlation for the target org acquiring companies, auto-proposing scope expansion for newly acquired assets the moment deals close.
0202. **Divestiture and spin-off tracker** — flags asset sales and spin-offs so out-of-scope systems are removed from hunts and newly independent entities get their own target profiles.
0203. **Merger IT integration signal detector** — looks for SSO merges, domain consolidations, and tenant migrations after M&A announcements, since integration periods create temporary misconfigurations.
0204. **Rebrand detection engine** — correlates trademark filings, new domain registrations, and brand announcements to catch rebrands that obsolete old asset inventories.
0205. **Subsidiary enumeration service** — maintains a living list of the target's subsidiaries from corporate registries, each mapped to its own domain portfolio and scope status.
0206. **DBA filing watcher** — monitors "doing business as" filings that reveal new brand names before domains or products launch publicly.
0207. **Trademark filing monitor** — tracks new trademark applications by the target, since product names in filings predict future domains, apps, and API namespaces.
0208. **Patent filing tech-direction analyzer** — extracts technology direction from patent applications to anticipate new product surface years before launch.
0209. **SEC filing tech extractor** — parses 10-K and 10-Q filings for outsourcing, cloud, and platform mentions that document the target's real infrastructure dependencies.
0210. **Earnings call transcript miner** — extracts platform migration and vendor mentions from executive remarks, which candidly reveal stack changes before engineering blogs do.
0211. **Investor deck infrastructure miner** — mines pitch and investor decks for architecture diagrams and partner logos that document production systems.
0212. **RFP and procurement notice watcher** — monitors public procurement postings by the target, since RFPs specify exact technologies being bought and deployed.
0213. **Vendor announcement correlator** — matches vendor press releases ("Company X selects Y") against the target to timestamp new third-party integrations.
0214. **Partnership announcement to API mapper** — converts partnership news into predicted integration endpoints, webhooks, and data-sharing flows to verify.
0215. **Reseller and OEM announcement tracker** — flags white-label and OEM deals that create parallel branded deployments of the target's platform with separate configs.
0216. **Integration partnership surface predictor** — maps each announced integration to likely OAuth scopes, webhook events, and API dependencies for scope review.
0217. **Hiring signal aggregator** — aggregates headcount growth by engineering function to predict where new code, and therefore new vulnerabilities, is being written.
0218. **Security team hiring watcher** — tracks AppSec, red-team, and detection hires, since a growing security team changes which bug classes get fixed fastest.
0219. **CISO announcement tracker** — flags CISO hires or departures, which historically correlate with security program resets and disclosure policy changes.
0220. **Layoff impact assessor** — correlates engineering layoffs with product areas to predict maintenance-mode code that will accumulate unpatched flaws.
0221. **Office expansion to data-residency mapper** — converts new office and region announcements into predicted data-residency deployments with region-specific configs.
0222. **Data center announcement tracker** — monitors new data center and PoP announcements that add physical infrastructure to the target's footprint.
0223. **Remote-work policy change monitor** — tracks RTO mandates and remote policy shifts that change VPN, VDI, and endpoint exposure for the workforce.
0224. **Contractor conversion signal** — watches for outsourcing and contractor announcements that shift code authorship and review rigor.
0225. **Managed security provider change detector** — identifies MSSP and SOC outsourcing changes from job posts and press, which reset detection and response behavior.
0226. **Pentest vendor rotation tracker** — monitors changes in the target's named pentest vendors, since new testers bring new methodology and fresh findings patterns.
0227. **Audit firm change monitor** — tracks auditor rotations that often precede compliance scope changes and control redesigns.
0228. **Certification announcement watcher** — flags new ISO 27001, SOC 2, or FedRAMP certifications whose audit scopes enumerate in-scope systems.
0229. **Certification scope change tracker** — diffs published certification scopes to learn which systems the target considers critical enough to audit.
0230. **Compliance calendar builder** — builds a calendar of the target's audit and recertification cycles, predicting freeze windows and post-audit config changes.
0231. **Regulatory fine tracker** — monitors DPA and FTC actions against the target, whose remediation commitments publicly specify security changes to verify.
0232. **Breach litigation monitor** — tracks lawsuits mentioning the target's breaches, since filings disclose technical details about compromised systems.
0233. **Executive testimony tech extractor** — mines congressional or parliamentary testimony for infrastructure details executives disclose under oath.
0234. **Shareholder suit disclosure miner** — extracts technical admissions from shareholder litigation documents about the target's security posture.
0235. **Insurance filing watcher** — monitors cyber-insurance applications and claims news that reveal the target's stated security controls.
0236. **All-hands leak monitor (public)** — tracks publicly leaked internal meetings and memos for reorg, migration, and incident details relevant to targeting.
0237. **Founder and executive social miner** — monitors founders' public posts for product teasers, launch dates, and stack hints that precede official announcements.
0238. **CTO blog architecture extractor** — converts CTO blog posts about platform strategy into a roadmap of upcoming infrastructure changes.
0239. **CISO blog control extractor** — extracts named security controls and vendors from CISO communications to map the defensive stack.
0240. **Analyst report tech extractor** — mines Gartner and Forrester profiles for validated technology lists the target provided under NDA-lite briefings.
0241. **Peer review site miner** — extracts feature and integration mentions from G2/Capterra reviews that reveal real deployment configurations.
0242. **Support ticket text miner (public)** — analyzes public support forum threads for staff-revealed URLs, workarounds, and infrastructure details.
0243. **Stack Overflow company tag monitor** — watches the target's Stack Overflow tags for employee questions that reveal exact library versions and architectures.
0244. **Conference sponsorship tracker** — monitors which conferences the target sponsors, since sponsored technologies correlate with adopted stack.
0245. **CTF sponsorship tech correlator** — maps CTF challenge technologies the target sponsors to their internal stack preferences.
0246. **University partnership monitor** — tracks research partnerships whose publications disclose the target's experimental platforms.
0247. **Open-source program office watcher** — monitors the target's OSPO announcements and contribution policies that govern public code releases.
0248. **Standards body participation tracker** — tracks IETF, W3C, and OWASP participation by the target's employees, revealing protocol and framework bets.
0249. **Tech talk CFP topic miner** — mines accepted talk proposals by the target's engineers for upcoming project disclosures.
0250. **Meetup talk slide harvester** — collects meetup presentations by target engineers, which are often more candid than conference talks.
0251. **Hiring manager post analyzer** — parses hiring managers' public posts for team missions that describe systems being built right now.
0252. **Team org-chart inference engine** — reconstructs engineering org structure from public profiles to map which teams own which products and services.
0253. **Salary band tech correlator** — extracts technology mentions from salary bands and leveling guides that document the official stack.
0254. **Contract role tech extractor** — mines contract job postings, which specify technologies more bluntly than full-time listings.
0255. **Glassdoor review tech miner** — extracts stack mentions from employee reviews that describe daily tooling and frustrations.
0256. **Onboarding doc leak watcher** — monitors public onboarding guides and handbooks that list internal tools, VPNs, and access procedures.
0257. **Alumni network intelligence** — tracks ex-employee public posts about former systems, which often describe legacy infrastructure still running.
0258. **Boomerang hire signal** — watches for returning employees whose public updates reference systems they are rejoining.
0259. **Referral program tech extractor** — mines referral bonus postings that name the teams and technologies with the most urgent hiring needs.
0260. **Employer brand content miner** — analyzes "life at" content and office tours for visible dashboards, architecture diagrams, and tooling on screens.
0261. **Town hall transcript watcher** — monitors published town halls for roadmap and reorg announcements that reshape the technology portfolio.
0262. **Board deck leak monitor (public)** — tracks publicly surfaced board materials for growth bets that predict new product surface.
0263. **Investor update leak catcher** — monitors leaked investor updates for metrics and launches that precede public announcements.
0264. **Deal pipeline signal detector** — infers acquisition targets from data-room provider usage and executive travel patterns reported publicly.
0265. **LOI announcement tracker** — flags letters of intent that precede acquisitions, giving early warning of scope expansion.
0266. **Due diligence tech signal** — watches for due-diligence-related hiring and tooling that indicates an acquisition is in final stages.
0267. **Day-one readiness post monitor** — analyzes post-merger integration announcements for systems being merged, a prime misconfiguration window.
0268. **Carve-out IT tracker** — monitors divestiture carve-outs whose transitional service agreements create temporary shared infrastructure.
0269. **Stranded asset identifier** — flags systems left behind after carve-outs, which often lose maintenance ownership and patching.
0270. **Tenant merge watcher** — tracks Microsoft 365 and Google Workspace tenant merges that consolidate identity providers and mail routing.
0271. **SSO merge monitor** — watches for identity provider consolidations post-M&A that rewrite authentication flows across both orgs.
0272. **Domain portfolio merge tracker** — monitors how acquired domain portfolios are consolidated, redirected, or left to expire.
0273. **Brand merge redirect strategist** — maps post-merger redirect strategies to catch legacy domains that remain active but unmaintained.
0274. **Support merge change detector** — flags helpdesk and status-page consolidations that reveal the surviving operational tooling.
0275. **Security program merge assessor** — evaluates how bug bounty programs, VDPs, and disclosure policies merge, since scope wording often changes.
0276. **Secret rotation wave detector** — infers post-merger credential rotation waves from job posts and status updates, marking a window of auth instability.
0277. **Network merge mapper** — tracks WAN, SD-WAN, and SASE consolidations that re-architect the combined network perimeter.
0278. **Overlapping RFC1918 resolver** — identifies private IP overlaps during mergers that force NAT strategies and create routing confusion worth mapping.
0279. **License reconciliation watcher** — monitors SaaS license consolidations that reveal the full application inventory of both orgs.
0280. **Shadow IT merge discoverer** — uses the merger inventory process to surface previously unknown SaaS and shadow infrastructure from the acquired org.
0281. **Procurement merge analyzer** — analyzes consolidated vendor lists to enumerate the combined third-party supply chain.
0282. **Risk register merge tracker** — watches for combined risk disclosures that enumerate the merged entity's critical systems.
0283. **Audit merge scope watcher** — tracks how audit scopes combine, revealing which systems leadership considers most critical.
0284. **Incident process merge monitor** — flags on-call, runbook, and status-tooling consolidations that change incident response behavior.
0285. **Threat intel merge assessor** — evaluates how threat intel feeds and hunting programs combine, indicating the new defensive baseline.
0286. **Detection merge gap analyzer** — identifies detection coverage gaps during SIEM and EDR consolidations, a window of reduced visibility.
0287. **Forensics readiness merger** — tracks eDiscovery and legal-hold consolidations that affect log retention across the merged estate.
0288. **Comms merge monitor** — watches executive, customer, and regulator communication consolidations for disclosure policy changes.
0289. **Trust center merge tracker** — monitors combined trust centers whose asset lists enumerate the merged security posture.
0290. **Changelog merge differ** — diffs how changelogs and release notes unify, revealing which products survive and their release cadences.
0291. **Docs merge mapper** — maps documentation consolidations to find surviving API references and deprecated-but-live endpoints.
0292. **API merge versioning watcher** — tracks how two API portfolios merge, flagging versioning conflicts and duplicate endpoints.
0293. **Developer portal consolidation tracker** — monitors portal merges that consolidate API keys, webhooks, and integration surface.
0294. **Community merge monitor** — watches forum, Discord, and Slack consolidations for staff-disclosed migration details.
0295. **Data merge mapper** — tracks warehouse, lake, and catalog consolidations that create new cross-system data flows.
0296. **FinOps merge tag watcher** — monitors cloud cost-tag consolidations that enumerate the combined cloud account structure.
0297. **Agile ritual merge observer** — watches squad and tribe reorganizations that reveal new team-to-system ownership mappings.
0298. **Onboarding merge doc miner** — mines merged onboarding docs for the combined internal tool inventory.
0299. **Offboarding process watcher** — tracks offboarding automation changes that affect how quickly ex-employee access is revoked.
0300. **Sector threat profile builder** — builds a sector-specific threat profile from peer breaches and ransomware trends to prioritize which target systems attackers hit first.
0301. **GitHub org leak monitor** — watches the target's public GitHub org for newly pushed secrets, exposed configs, and internal URLs, correlating each finding to hunt targets.
0302. **New repository creation alerter** — flags every new public repo under the target's orgs, since new repos usually mean new services, SDKs, or tools entering the surface.
0303. **Repository archival tracker** — monitors repo archival events, because archived projects often leave their deployments running unmaintained.
0304. **Fork activity anomaly detector** — flags unusual fork patterns on the target's repos that can indicate pre-disclosure vulnerability research by outsiders.
0305. **Star velocity monitor** — tracks star growth on the target's repos as a proxy for attacker attention, prioritizing popular projects for deeper review.
0306. **Contributor change watcher** — monitors contributor additions and departures on key repos, since new contributors introduce new code and departing ones leave unmaintained areas.
0307. **Security team contribution tracker** — watches the target's security engineers' public commits for hardening patterns that reveal which components they consider fragile.
0308. **SECURITY.md change monitor** — diffs security policy files across the org's repos for scope hints, supported versions, and disclosure process changes.
0309. **Workflow file disclosure miner** — extracts deployment targets, secrets names, and environment hostnames from public CI workflow files.
0310. **GitHub Actions usage profiler** — inventories third-party Actions the target uses, each a supply-chain node with its own compromise history.
0311. **Self-hosted runner detector** — identifies self-hosted runner labels in workflows, mapping CI infrastructure that may be reachable or fingerprintable.
0312. **Secret scanning alert correlator** — where the target publishes security advisories, correlates secret-leak timelines with hunt scope for credential exposure windows.
0313. **Push protection bypass watcher** — monitors public commits for high-entropy strings that slipped past push protection, indicating live secret exposure.
0314. **Custom secret pattern miner** — learns the target's internal token formats from public code to improve secret detection in subsequent hunts.
0315. **API token format learner** — extracts the target's API key prefixes and formats from SDKs and docs to recognize leaked credentials in paste sites.
0316. **Canary token deployment watcher** — detects Thinkst-style canary tokens in the target's public repos, mapping their deception coverage.
0317. **Honeytoken tripwire mapper** — catalogs fake credentials the target plants publicly to understand which repos are monitored traps.
0318. **Gist monitoring by employees** — tracks public gists from the target's engineers for pasted configs, logs, and internal URLs shared for debugging.
0319. **GitHub Discussions miner** — mines discussion threads for staff-disclosed architecture details, beta endpoints, and migration timelines.
0320. **Issue tracker intelligence** — analyzes public issue titles and labels for recurring component names that reveal fragile subsystems.
0321. **Pull request title miner** — extracts feature and refactor names from merged PRs to predict newly deployed functionality.
0322. **Release cadence learner** — measures release frequency per repo to schedule hunts immediately after major version drops.
0323. **Pre-release tag watcher** — monitors alpha, beta, and rc tags that indicate code about to reach production with fresh bugs.
0324. **Changelog file differ** — diffs CHANGELOG.md files for security-relevant entries that pinpoint recently touched attack surface.
0325. **Dependency update bot cadence** — measures Dependabot and Renovate merge rates to assess how quickly the target patches vulnerable dependencies.
0326. **Base image update tracker** — monitors Dockerfile base image bumps to learn the target's patch latency for containerized services.
0327. **Distroless adoption detector** — flags migrations to distroless or minimal images, which change the post-exploitation tooling available.
0328. **Multi-arch build watcher** — tracks new CPU architecture builds that indicate edge, IoT, or ARM deployments worth scoping.
0329. **SBOM publication monitor** — watches for published software bills of materials that enumerate every dependency of the target's products.
0330. **SBOM diff engine** — diffs successive SBOMs to flag newly added dependencies, each a new supply-chain node with its own CVEs.
0331. **SBOM signing verifier** — checks for Sigstore and cosign signatures on SBOMs as a supply-chain maturity signal.
0332. **SLSA provenance watcher** — monitors SLSA attestation publication that documents the target's build integrity level.
0333. **Rekor transparency log watcher** — searches Rekor for the target's signing entries to inventory released artifacts and their signers.
0334. **Fulcio certificate monitor** — tracks Fulcio-issued signing certificates tied to the target's CI identities.
0335. **OIDC issuer change detector** — flags changes in the OIDC issuers the target's workloads use, signaling identity federation redesigns.
0336. **Build provenance comparator** — compares build attestations across releases to detect toolchain or builder changes.
0337. **Reproducible build verifier** — checks whether the target's artifacts are reproducibly built, a strong supply-chain integrity indicator.
0338. **Hermetic build signal detector** — looks for hermetic build adoption in CI configs that reduce build-time compromise risk.
0339. **CI provider migration tracker** — detects moves between Jenkins, GitHub Actions, GitLab CI, and Buildkite that reset CI security posture.
0340. **Runner infrastructure mapper** — maps cloud versus self-hosted runner usage to assess CI attack surface.
0341. **Artifact registry watcher** — monitors the target's public artifact registries for new packages that indicate new services.
0342. **Container registry image tracker** — watches Docker Hub and GHCR orgs for new images, whose tags and layers reveal deployment architectures.
0343. **Image layer diff analyzer** — diffs container image layers between tags to identify changed binaries, configs, and added packages.
0344. **Helm chart publication monitor** — tracks published Helm charts whose values files document full Kubernetes deployment topologies.
0345. **Terraform module publication watcher** — monitors public Terraform modules that encode the target's cloud architecture as code.
0346. **npm org package monitor** — watches the target's npm scope for new packages, each potentially a new client library with embedded endpoints.
0347. **PyPI org package tracker** — monitors Python package releases for new SDKs and tools that document API surface.
0348. **Package version diff engine** — diffs SDK package contents between versions to extract newly added API methods and endpoints.
0349. **Transitive dependency risk mapper** — builds the full transitive dependency tree of the target's published packages to find deeply nested risky libraries.
0350. **Vendored code change detector** — flags vendored third-party code updates that may lag upstream security fixes.
0351. **Minified library version extractor** — identifies exact versions of minified libraries in the target's bundles to match against known CVEs.
0352. **jQuery EOL version detector** — specifically flags end-of-life jQuery versions in production bundles, a perennial XSS source.
0353. **CMS version and plugin differ** — tracks WordPress, Drupal, or Joomla core and plugin versions across crawls for patch-lag measurement.
0354. **Theme and plugin enumeration differ** — maintains a living inventory of CMS themes and plugins, flagging newly installed ones with known vulns.
0355. **Headless CMS detection engine** — identifies headless CMS usage and monitors its API exposure separately from the main site.
0356. **Static site generator detector** — fingerprints SSG frameworks to predict build-time versus runtime attack surface.
0357. **Edge function discovery** — detects edge-deployed functions via headers and routing behavior, mapping logic that runs outside the origin.
0358. **Middleware chain change detector** — infers middleware ordering changes from header and behavior diffs that alter request processing.
0359. **Rewrite and redirect rule differ** — extracts and diffs URL rewrite rules that reveal hidden routes and legacy mappings.
0360. **Vanity URL inventory** — catalogs marketing vanity URLs and shortlinks whose destinations document campaign infrastructure.
0361. **QR campaign destination monitor** — resolves QR-linked URLs from the target's campaigns to find campaign microsites with weaker hardening.
0362. **Link-in-bio change tracker** — monitors link aggregator pages for new campaign and product links that expand scope.
0363. **Source map appearance watcher** — alerts when .map files become publicly accessible, exposing full original source code for analysis.
0364. **Webpack chunk inventory differ** — catalogs lazy-loaded chunks and flags new ones that lazy-load admin or beta functionality.
0365. **Package.json exposure monitor** — checks for accidentally exposed manifests that enumerate exact dependency versions.
0366. **Lockfile exposure detector** — flags exposed lockfiles that pin every transitive dependency version for CVE matching.
0367. **Dependency manifest differ** — diffs exposed manifests over time to catch dependency changes between audited releases.
0368. **.well-known inventory differ** — maintains a complete inventory of .well-known URIs and flags new ones like wallet, security, or AI plugin manifests.
0369. **AI plugin manifest watcher** — monitors ai-plugin.json and similar manifests that expose AI feature endpoints and auth schemes.
0370. **MCP server publication tracker** — watches for published Model Context Protocol servers, a brand-new tool-calling attack surface.
0371. **LLMs.txt and AI crawler policy watcher** — diffs llms.txt and AI bot policies that document which content and endpoints feed AI systems.
0372. **Ads.txt and sellers.json differ** — tracks ad supply-chain files whose changes reveal new monetization partners and domains.
0373. **Humans.txt credit miner** — extracts team and technology credits from humans.txt for org and stack intelligence.
0374. **Browser extension release monitor** — watches the target's browser extensions for new versions, diffing manifests for new permissions and content scripts.
0375. **Extension permission growth tracker** — flags extensions requesting broader host permissions over time, widening the client-side attack surface.
0376. **Extension OAuth scope watcher** — monitors OAuth scopes requested by the target's extensions and apps for privilege creep.
0377. **Content script injection mapper** — maps which sites the target's extensions inject scripts into, revealing integration partnerships.
0378. **Mobile SDK inventory differ** — extracts embedded SDK lists from app releases and flags newly added analytics, ad, or auth SDKs.
0379. **Deep link scheme change tracker** — diffs custom URL schemes that expose new app entry points and inter-app communication.
0380. **Universal link association differ** — diffs apple-app-site-association files for newly claimed web paths that bridge web and app surface.
0381. **AssetLinks.json change monitor** — tracks Android asset link changes that declare new app-to-site trust relationships.
0382. **Exported component differ** — diffs Android exported activities, services, and providers between releases for new IPC attack surface.
0383. **Intent filter change tracker** — monitors intent filter additions that expose new deep-linkable app functionality.
0384. **Broadcast receiver inventory** — catalogs registered receivers that may accept intents from other apps.
0385. **Content provider exposure watcher** — flags newly exported content providers that expose app data to other applications.
0386. **Network security config differ** — diffs network security configs for cleartext allowances, debug overrides, and pinning changes.
0387. **Certificate pinning change detector** — flags pinning additions, removals, or rotations that change MITM testing requirements.
0388. **Backup allowance flag watcher** — monitors allowBackup and debuggable flag flips that enable data extraction from devices.
0389. **Root and tamper detection change tracker** — diffs anti-tamper implementations to understand which app versions resist instrumentation.
0390. **Obfuscation change detector** — flags ProGuard/R8 mapping changes that indicate refactored code worth re-analyzing.
0391. **Code push (OTA) update monitor** — watches CodePush and similar OTA endpoints for hot updates that bypass app-store review.
0392. **OTA update diff engine** — diffs over-the-air bundles to catch silently shipped code changes between store releases.
0393. **Hot-update endpoint watcher** — inventories update-check endpoints whose version logic can be manipulated.
0394. **Remote config value differ** — diffs Firebase Remote Config and similar payloads for flag flips that enable hidden features.
0395. **Kill-switch and force-update tracker** — monitors minimum-version enforcement that reveals which old app versions remain supported.
0396. **Feature flag remote payload miner** — extracts flag names and targeting rules from remote configs to enumerate unreleased functionality.
0397. **A/B test config differ** — tracks experiment assignments that expose variant-specific endpoints and UI flows.
0398. **Attribution and analytics config watcher** — monitors SDK configuration endpoints for new data collection that expands privacy surface.
0399. **Consent mode config differ** — diffs consent management configurations that reveal regional compliance deployments.
0400. **Server-side tagging endpoint mapper** — inventories first-party tagging endpoints that proxy third-party trackers through the target's own domain.
0401. **Wayback Machine diffing engine** — compares current pages against archived snapshots to find removed-but-still-accessible endpoints that lost their links but not their handlers.
0402. **Removed endpoint resurrection checker** — replays URLs found only in historical snapshots against the live site to catch forgotten routes still serving traffic.
0403. **Historical form action extractor** — extracts form actions from decade-old snapshots, since legacy form endpoints often survive redesigns unauthenticated.
0404. **Archive-derived parameter miner** — harvests query parameters from archived URLs to build a historical parameter list for modern fuzzing.
0405. **Old sitemap reconstructor** — rebuilds sitemaps from archived copies to enumerate site sections deleted from current navigation.
0406. **Historical robots.txt analyzer** — diffs archived robots.txt files to find paths that were once public, then hidden, but never actually removed.
0407. **Snapshot cadence change detector** — flags domains whose Wayback capture frequency suddenly changes, indicating crawler-visible site overhauls.
0408. **First-snapshot date profiler** — records each asset's earliest archive date to distinguish legacy systems from greenfield deployments.
0409. **Design era classifier** — classifies archived designs by era to predict underlying framework generations and their known vulnerability classes.
0410. **Legacy technology residue finder** — spots old tech markers (FrontPage, ColdFusion, Struts) in archives whose backends may still answer on the origin.
0411. **Historical DNS reconstructor** — rebuilds the target's past DNS from SecurityTrails and DNSDB to find decommissioned hostnames that still resolve.
0412. **Decommissioned hostname re-checker** — periodically re-resolves historically seen hostnames, alerting when one unexpectedly comes back alive.
0413. **Historical IP attribution mapper** — maps which IPs the target used over the years to identify retained infrastructure blocks worth scanning.
0414. **Forgotten subdomain reviver** — cross-references historical subdomain lists with current DNS to find subdomains removed from zone files but still configured on servers.
0415. **Historical MX reconstructor** — rebuilds past mail infrastructure to find legacy mail hosts that may still accept mail or relay.
0416. **Historical SPF include auditor** — audits old SPF includes for third parties the target stopped using but never de-authorized.
0417. **WHOIS history timeline builder** — constructs ownership and nameserver timelines from historical WHOIS to spot hijack windows and registrar changes.
0418. **Historical registrant correlator** — links past registrant organizations to the target's M&A history, validating subsidiary attributions.
0419. **Domain creation date profiler** — profiles asset ages across the portfolio to prioritize legacy domains with the longest unpatched histories.
0420. **Certificate history reconstructor** — rebuilds the target's full issuance history from CT logs to find retired hostnames that once had certificates.
0421. **Retired SAN hunter** — extracts SANs from expired certificates and checks whether those hostnames still resolve or serve content.
0422. **Historical CA usage profiler** — profiles which CAs the target used historically to detect validation-weak periods worth investigating.
0423. **Expired certificate responder** — checks whether expired certificates are still served, indicating abandoned TLS terminations.
0424. **Historical cipher support auditor** — compares past TLS configurations against present to verify weak protocols were actually disabled, not just hidden.
0425. **BGP history analyzer** — reviews historical BGP announcements for the target's prefixes to find previously used ASNs and providers.
0426. **Historical peering reconstructor** — rebuilds past peering relationships to identify former transit providers with lingering route access.
0427. **IP block transfer tracker** — monitors RIR transfer logs for the target's netblocks changing hands, which resets trust assumptions.
0428. **Historical reverse DNS miner** — mines old PTR records for internal naming schemes that predict current internal hostnames.
0429. **Netblock reassignment watcher** — flags when the target's former IP ranges get reassigned, since stale DNS may still point there.
0430. **Stale DNS to reassigned IP detector** — specifically hunts for target hostnames still resolving to IPs the target no longer owns.
0431. **Historical port-scan comparator** — compares current open ports against historical scan data to find services that were closed then quietly reopened.
0432. **Banner history differ** — tracks service banners over years to measure patch latency and identify chronically outdated components.
0433. **Historical WAF absence detector** — finds periods when the target had no WAF in front of assets, correlating with breach timelines.
0434. **CDN history reconstructor** — rebuilds CDN provider history to find origin IPs exposed during pre-CDN or migration periods.
0435. **Origin IP history harvester** — collects historically leaked origin IPs from pre-CDN eras for direct-origin testing.
0436. **Historical status page incident miner** — mines years of status history to enumerate every named component and its failure modes.
0437. **Incident recurrence analyzer** — finds components with repeated historical incidents, marking them as fragile and hunt-worthy.
0438. **Maintenance window pattern learner** — learns historical maintenance schedules to predict deploy windows for timed re-hunts.
0439. **Historical changelog aggregator** — aggregates years of changelogs into a feature timeline that maps when each current endpoint was introduced.
0440. **Feature introduction date mapper** — assigns each discovered endpoint an approximate birth date from archives, blogs, and changelogs.
0441. **Deprecation promise tracker** — records announced deprecation dates and verifies the endpoints actually died on schedule.
0442. **Zombie API detector** — finds APIs deprecated years ago that still respond, a classic forgotten-surface finding.
0443. **Historical API version enumerator** — reconstructs every API version ever documented to test which old versions remain live.
0444. **Historical auth flow reconstructor** — rebuilds past login flows from archives to find legacy auth endpoints that bypass modern MFA.
0445. **Legacy SSO endpoint hunter** — hunts for old SAML and OAuth endpoints from acquired products that still trust retired identity providers.
0446. **Historical mobile API mapper** — extracts API endpoints from old APK versions to find legacy mobile backends still serving traffic.
0447. **APK version timeline builder** — builds a version timeline of the target's apps to identify the oldest still-supported client versions.
0448. **Historical app permission auditor** — audits how app permissions evolved to spot over-privileged legacy versions still in use.
0449. **Old SDK endpoint extractor** — pulls endpoints from deprecated SDK versions whose backends may lack modern protections.
0450. **Historical webhook event reconstructor** — rebuilds past webhook event catalogs to find retired event types still firing.
0451. **Historical rate-limit profiler** — compares past and present rate limits to detect silently relaxed abuse controls.
0452. **Historical error message collector** — archives verbose historical error messages that documented internal paths and queries.
0453. **Debug artifact history scanner** — finds historical exposures of stack traces, phpinfo, and debug consoles in archived captures.
0454. **Historical open-directory finder** — locates past directory listings in archives whose paths may still be browsable.
0455. **Backup file history tracker** — correlates historical backup-file exposures (.bak, .old, .swp) with current deploy hygiene.
0456. **Historical .git exposure checker** — checks whether repos exposed in the past led to commit history still being reachable.
0457. **Wayback URL parameter archive** — builds a master list of every parameter ever seen in archived URLs for the target's domains.
0458. **Historical hidden field extractor** — extracts hidden form fields from old snapshots that may still be processed by backends.
0459. **Old admin path collector** — aggregates admin paths from all historical sources into a legacy-admin wordlist.
0460. **Historical tech-stack profiler** — profiles every framework version the target ever ran to predict residual vulnerable components.
0461. **Framework migration timeline** — maps framework migrations over time to find strangler-pattern remnants of the old stack.
0462. **Strangler remnant detector** — specifically hunts for old-stack endpoints left running alongside the new platform.
0463. **Historical third-party script auditor** — audits which trackers and widgets the target loaded historically to find lingering trust relationships.
0464. **Retired vendor residue checker** — verifies that retired vendors' scripts, pixels, and DNS entries were actually removed.
0465. **Historical CNAME chain reconstructor** — rebuilds past CNAME chains to find SaaS services once pointed at the target's subdomains.
0466. **SaaS deprovisioning verifier** — checks that deprovisioned SaaS hostnames no longer resolve to claimable accounts.
0467. **Historical takeover window finder** — identifies past periods when dangling records existed, correlating with known takeover claims.
0468. **Claimed-subdomain history tracker** — maintains a history of which subdomains were ever flagged as takeoverable and their remediation status.
0469. **Historical phishing domain correlator** — correlates past typosquat registrations with phishing campaigns against the target's customers.
0470. **Brand abuse timeline builder** — builds a timeline of brand-abuse incidents to predict which products attackers impersonate most.
0471. **Historical breach correlator** — maps the target's disclosed breaches to the infrastructure of that era for root-cause pattern learning.
0472. **Breach-era tech profiler** — profiles the exact stack versions in place during historical breaches to find unpatched survivors.
0473. **Post-breach remediation verifier** — checks whether security commitments made after historical breaches were actually implemented.
0474. **Historical pentest finding re-tester** — where the target published pentest summaries, re-tests those finding classes on current systems.
0475. **Disclosed report technique reuser** — mines the target's disclosed HackerOne/Bugcrowd reports for techniques that worked before and likely work again.
0476. **Researcher focus area learner** — learns which asset areas top researchers targeted historically to prioritize the same high-yield zones.
0477. **Duplicate pattern analyzer** — analyzes historical duplicate reports to find bug classes the target fixes slowly.
0478. **Severity rubric evolution tracker** — tracks how the target's severity ratings changed over time to predict current triage behavior.
0479. **Bounty payout trend analyzer** — analyzes historical payouts per bug class to focus hunts on the highest-reward vulnerability types.
0480. **Scope evolution reconstructor** — rebuilds every historical scope version to find assets that were in scope, removed, then possibly re-added.
0481. **Out-of-scope rationale miner** — mines historical out-of-scope justifications for sensitive systems worth understanding anyway.
0482. **Program pause history tracker** — records past program pauses that often preceded major platform changes.
0483. **Platform migration correlator** — correlates bug bounty platform migrations with scope rewrites that may have dropped assets.
0484. **Historical asset criticality scorer** — scores assets by how long they survived in scope and their bounty multipliers.
0485. **Hall-of-fame technique inferrer** — infers favored techniques from thanked researchers' public write-ups about the target.
0486. **Triage SLA history tracker** — measures historical triage and remediation times to predict current fix windows.
0487. **Retest policy evolution monitor** — tracks how retest policies changed, indicating which areas get verification attention.
0488. **Historical credential leak correlator** — maps past credential leaks to the systems of that era for password-reuse assessment.
0489. **Infostealer log era matcher** — correlates historical infostealer logs with the target's breach timeline for defensive awareness.
0490. **Combo list domain matcher** — checks historical combo lists for the target's domains to scope credential-stuffing risk windows.
0491. **Historical subdomain takeover ledger** — maintains a permanent ledger of every takeoverable subdomain ever found for the target and its fix date.
0492. **Expired domain capture historian** — records domains the target let expire and who captured them, for ongoing phishing risk.
0493. **Defensive registration lapse tracker** — tracks defensive domains the target failed to renew, marking them as impersonation risks.
0494. **Historical nameserver compromise check** — reviews past delegation anomalies for signs of historical DNS hijacking.
0495. **Archive-derived API key hunter** — searches archived JS and pages for API keys that may still be valid in production.
0496. **Historical token format profiler** — profiles token formats from historical leaks to recognize live ones faster.
0497. **Old mobile deep-link mapper** — maps deep links from historical app versions that may still route into current apps.
0498. **Historical push notification analyzer** — analyzes old push payloads and endpoints for notification infrastructure that persists.
0499. **Legacy protocol support verifier** — verifies whether legacy protocols found in historical configs (SSLv3, TLS 1.0) are truly disabled today.
0500. **Internet background radiation correlator** — uses historical scan data to distinguish the target's real assets from sinkholed or parked lookalikes.
0501. **Third-party script inventory mapper** — builds a complete inventory of every third-party script loaded by the target's pages, scoring each vendor's compromise history for supply-chain risk.
0502. **New third-party tag alerter** — flags newly added marketing, analytics, or chat tags between crawls, since each new tag is a new script-execution trust grant.
0503. **Tag manager container change differ** — diffs tag manager containers to catch silently added pixels and trackers that bypass code review.
0504. **Pixel tracker lineage tracker** — traces each tracking pixel to its ultimate data recipient, mapping where the target's visitor data actually flows.
0505. **Consent manager change watcher** — monitors consent platform changes that alter which third parties load before user consent.
0506. **Chat widget provider tracker** — identifies live-chat providers and monitors their script versions, since chat widgets run with full page privileges.
0507. **Support portal software detector** — fingerprints helpdesk platforms whose own vulnerabilities become the target's vulnerabilities.
0508. **Helpdesk integration enumerator** — maps helpdesk-connected apps and webhooks that bridge support tooling into production data.
0509. **Subprocessor addition alerter** — triggers a review workflow every time the target's published subprocessor list gains a new data recipient.
0510. **Subprocessor risk scorer** — scores each subprocessor by breach history and data sensitivity to prioritize supply-chain verification.
0511. **Data flow diagram reconstructor** — reconstructs likely data flows from privacy policies, subprocessors, and SDKs into a visual map for scoping.
0512. **Fourth-party risk mapper** — maps the vendors of the target's vendors from public integrations, extending supply-chain visibility one hop further.
0513. **Vendor breach blast-radius estimator** — when a vendor announces a breach, automatically lists which target assets and data flows depend on that vendor.
0514. **Vendor security advisory correlator** — matches vendor security advisories against the target's detected stack to flag urgently patchable components.
0515. **Upstream CVE to target mapper** — correlates newly published CVEs in the target's detected dependencies with deployed versions for instant impact assessment.
0516. **CISA KEV to stack matcher** — checks every CISA Known Exploited Vulnerability against the target's fingerprinted stack for exploited-in-the-wild risk.
0517. **Exploit-DB to target correlator** — matches public exploits against the target's exact product versions to prioritize verification.
0518. **Threat intel feed correlator (defensive)** — fuses commercial and open threat feeds to warn when the target's sector or stack faces active exploitation.
0519. **Ransomware group targeting monitor** — tracks which ransomware groups target the victim's sector on leak sites for defensive prioritization.
0520. **Sector breach lesson extractor** — distills peer breaches in the target's sector into attack patterns to test against the target's similar systems.
0521. **Payment processor change detector** — flags migrations between Stripe, Adyen, and Braintree, since each brings new webhook endpoints and key formats.
0522. **Fraud tooling change tracker** — monitors fraud-vendor swaps that change device fingerprinting, risk scoring, and challenge flows.
0523. **Identity provider migration watcher** — detects Okta, Entra ID, or Auth0 migrations that rewrite SSO, SCIM, and session behavior.
0524. **HR system change detector** — flags HRIS changes that drive identity lifecycle automation and provisioning behavior.
0525. **ITSM platform change tracker** — monitors ITSM migrations whose integrations often carry privileged API tokens.
0526. **MDM and EDR change detector** — tracks endpoint security vendor changes from job posts and network signals.
0527. **SIEM migration watcher** — detects SIEM changes that create detection gaps during log pipeline cutovers.
0528. **SOAR playbook change inferrer** — infers automation changes from job posts that alter incident response behavior.
0529. **Email provider migration tracker** — flags Google Workspace to Microsoft 365 moves that change mail auth, DLP, and phishing surface.
0530. **Marketing automation change detector** — monitors Marketo, HubSpot, and Braze migrations that move customer data between platforms.
0531. **CRM migration watcher** — tracks Salesforce and HubSpot CRM changes that rewire customer data integrations.
0532. **CDP adoption detector** — identifies customer data platform adoption that centralizes PII into a new high-value target.
0533. **Data warehouse mention tracker** — monitors Snowflake, BigQuery, and Databricks mentions that reveal analytics data centralization.
0534. **Reverse ETL tool detector** — flags reverse-ETL adoption that syncs warehouse data back into operational SaaS tools.
0535. **Orchestration platform tracker** — monitors Airflow, Dagster, and Prefect adoption whose UIs and APIs manage data pipelines.
0536. **Feature store detector** — identifies ML feature stores that concentrate sensitive training data.
0537. **ML platform adoption tracker** — monitors SageMaker, Vertex, and Databricks ML adoption that adds model registries and endpoints.
0538. **Model registry watcher** — tracks model registries whose APIs may expose training data and model artifacts.
0539. **LLM provider change detector** — flags switches between OpenAI, Anthropic, and open models that change prompt-handling and data-sharing behavior.
0540. **Vector database adoption tracker** — detects Pinecone, Weaviate, and pgvector adoption that creates new queryable knowledge stores.
0541. **RAG architecture post miner** — extracts retrieval-augmented generation designs from engineering posts to map document ingestion pipelines.
0542. **AI gateway adoption detector** — identifies AI gateway deployments that centralize prompt logging and key management.
0543. **AI feature launch tracker** — monitors new AI feature announcements, each implying new inference endpoints and prompt-injection surface.
0544. **Chatbot provider change watcher** — tracks conversational AI vendor swaps that change data retention and model routing.
0545. **Voice AI adoption detector** — flags voice agent deployments whose telephony integrations expand the attack surface.
0546. **Agent framework adoption tracker** — monitors LangChain, CrewAI, and AutoGen adoption that introduces tool-calling attack surface.
0547. **Function-calling schema extractor** — extracts published function schemas that document exactly which tools AI agents can invoke.
0548. **System prompt leak monitor (defensive)** — watches for the target's leaked system prompts to assess prompt-injection exposure.
0549. **Prompt firewall adoption detector** — identifies prompt-injection mitigation vendors that indicate AI security maturity.
0550. **Output filtering change tracker** — monitors content moderation changes on AI features that alter bypass difficulty.
0551. **PII redaction for AI watcher** — tracks redaction tooling for AI pipelines that determines what training data leaks are possible.
0552. **Model card publication monitor** — watches published model cards that document training data, limitations, and intended use.
0553. **Dataset publication tracker** — monitors dataset releases whose contents may include sensitive or scraped data.
0554. **HuggingFace org release monitor** — tracks the target's HuggingFace org for new models, spaces, and datasets.
0555. **Weights publication watcher** — flags open-weight releases whose licenses and capabilities reshape the threat model.
0556. **API pricing change analyzer** — diffs AI API pricing pages, since new models and endpoints appear there first.
0557. **Playground change detector** — monitors AI playground UIs for new parameters and models that mirror API capabilities.
0558. **Token counting behavior watcher** — tracks tokenizer changes that affect prompt-injection payload sizing.
0559. **Streaming API change tracker** — monitors streaming endpoint changes that alter partial-output leakage behavior.
0560. **Batch and fine-tuning API watcher** — tracks batch and fine-tuning APIs whose job management endpoints are often under-protected.
0561. **Embeddings API change monitor** — watches embedding endpoints that can leak training data through inversion.
0562. **Moderation API change tracker** — monitors moderation endpoints whose blocklists reveal policy boundaries.
0563. **Guardrail configuration inferrer** — infers AI guardrail rules from behavior testing to map the enforced policy surface.
0564. **Watermarking adoption detector** — tracks C2PA and watermark adoption that indicates synthetic-media governance maturity.
0565. **Provenance standard tracker** — monitors content provenance implementations for metadata-handling flaws.
0566. **Shadow AI discovery engine** — finds employee-adopted AI tools from job posts and reviews that create unmanaged data flows.
0567. **SaaS sprawl enumerator** — estimates the target's SaaS footprint from identity provider app catalogs and job mentions.
0568. **OAuth grant inventory differ** — tracks third-party OAuth grants in the target's tenant to flag over-privileged connected apps.
0569. **Connected app consent change watcher** — monitors consent policy changes that alter which third-party apps employees can authorize.
0570. **Service account inventory builder** — builds an inventory of machine identities from cloud configs and CI files for privilege review.
0571. **Machine identity federation tracker** — monitors workload identity federation setups that bridge cloud providers.
0572. **API token scope creep detector** — flags tokens and keys whose documented scopes grow over time.
0573. **Secrets manager adoption tracker** — monitors Vault, AWS Secrets Manager, and Doppler adoption that changes secret-handling posture.
0574. **KMS migration watcher** — tracks key management migrations that alter encryption boundaries.
0575. **BYOK and HYOK announcement tracker** — flags bring-your-own-key offerings whose key management APIs are high-value targets.
0576. **Key rotation cadence learner** — measures published or inferred rotation intervals to assess cryptographic hygiene.
0577. **Crypto agility post miner** — extracts post-quantum migration plans that reveal cryptographic inventory priorities.
0578. **PQC migration announcement tracker** — monitors hybrid certificate and PQC KEM deployments that change TLS negotiation.
0579. **CBOM publication watcher** — watches for cryptography bills of materials that enumerate every algorithm in use.
0580. **HSM usage mention tracker** — tracks HSM adoption mentions that indicate high-assurance key storage for critical systems.
0581. **Code signing certificate watcher** — monitors code-signing cert issuance and rotations that anchor software trust.
0582. **Document signing cert tracker** — tracks document signing deployments whose verification endpoints are often overlooked.
0583. **Email signing (S/MIME) deployment watcher** — monitors S/MIME rollouts that change mail authenticity guarantees.
0584. **Key ceremony announcement tracker** — flags root key ceremonies that indicate PKI governance maturity.
0585. **Private key leak monitor (defensive)** — scans public sources for the target's leaked private keys to trigger emergency rotation hunts.
0586. **GitHub secret scanning partnership watcher** — monitors whether the target partners with secret-scanning programs for leak response speed.
0587. **High-entropy string baseline builder** — builds per-repo entropy baselines to spot anomalous secret-like strings in new commits.
0588. **Deception coverage mapper** — maps honeypot and canary deployments from public mentions to avoid wasting hunt time on traps.
0589. **Adversary engagement post miner** — extracts deception program details from conference talks for defensive understanding.
0590. **Detection-as-code publication watcher** — monitors published Sigma, YARA, and Nuclei content that reveals what the target detects.
0591. **MITRE ATT&CK mapping publisher tracker** — tracks published ATT&CK mappings that document the target's assumed threat model.
0592. **Purple team report miner** — extracts adversary emulation results that reveal which attack paths the target already tested.
0593. **Breach and attack simulation vendor tracker** — monitors BAS vendor changes that alter continuous control validation.
0594. **Security control validation watcher** — tracks automated pentesting and PTaaS adoption that changes finding velocity.
0595. **Pentest report cadence learner** — measures how often the target commissions pentests to predict assessment windows.
0596. **Findings aging analyzer** — analyzes published remediation timelines to predict which vuln classes linger longest.
0597. **Vulnerability recurrence tracker** — flags bug classes that reappear after fixes, indicating systemic root causes.
0598. **Root cause category learner** — learns the target's dominant root causes from disclosures to prioritize hunt techniques.
0599. **Security champions program watcher** — monitors champion program growth that correlates with secure-coding improvements.
0600. **Secure coding training vendor tracker** — tracks training vendor changes that shift developer security awareness baselines.
0601. **Status page component inventory** — maintains a live inventory of the target's status page components, treating each as a confirmed production service for scope.
0602. **Status page provider change detector** — flags migrations between Statuspage, Instatus, and custom solutions that reset incident history.
0603. **Incident history severity profiler** — profiles years of incidents by severity and component to rank the most fragile services for hunting.
0604. **Maintenance window change alerter** — flags schedule changes that indicate new deploy processes or infrastructure work.
0605. **SLA page change tracker** — diffs SLA commitments whose tightened targets often follow reliability investments and architecture changes.
0606. **Uptime trend correlator** — correlates uptime trends with deploy frequency to find stability regressions after specific releases.
0607. **Failover drill detector** — identifies announced failover tests that temporarily re-architect traffic and expose DR infrastructure.
0608. **Chaos engineering post miner** — extracts chaos experiment scopes that enumerate services deemed safe to break.
0609. **Game day announcement tracker** — monitors game day schedules that reveal which systems get resilience testing.
0610. **Load testing vendor watcher** — tracks load-testing vendors whose test traffic patterns inform rate-limit understanding.
0611. **Performance budget post miner** — extracts performance budgets that document frontend architecture and third-party weight limits.
0612. **RUM vendor change detector** — flags real-user monitoring swaps that change what performance data leaves the browser.
0613. **Synthetic monitoring change tracker** — monitors synthetic check changes that enumerate critical user journeys.
0614. **APM migration watcher** — detects Datadog, New Relic, and Dynatrace migrations that change observability data flows.
0615. **Logging pipeline change tracker** — monitors ELK, Loki, and Splunk pipeline changes that affect log retention and detection.
0616. **Tracing vendor change detector** — flags distributed tracing changes that alter correlation ID formats and header propagation.
0617. **Profiling adoption tracker** — monitors continuous profiling adoption whose agents run with elevated privileges.
0618. **Error tracking migration watcher** — detects Sentry, Rollbar, and Bugsnag changes that move client-side error data between vendors.
0619. **On-call tool change detector** — flags PagerDuty and Opsgenie migrations that change alert routing and escalation data.
0620. **Alert routing change inferrer** — infers routing rule changes from job posts that alter who gets woken for which system.
0621. **Runbook publication miner** — extracts runbooks that document recovery procedures and infrastructure dependencies.
0622. **Bug bounty scope diff alerter** — diffs HackerOne and Bugcrowd scopes on every poll, since scope changes are the highest-signal events for hunters.
0623. **Scope expansion predictor** — predicts likely scope additions from acquisitions, launches, and job posts before programs update.
0624. **Scope removal verifier** — verifies removed assets actually went offline instead of lingering unmaintained outside the program.
0625. **Wildcard scope change tracker** — specifically monitors wildcard scope additions that massively expand eligible assets.
0626. **CIDR scope addition watcher** — flags newly added IP ranges that bring network-layer targets into scope.
0627. **Mobile scope addition detector** — catches newly added iOS and Android apps that open mobile-specific testing.
0628. **API scope addition tracker** — flags newly scoped API hosts and documentation portals.
0629. **GitHub scope addition monitor** — watches for source-code targets entering scope, enabling white-box review.
0630. **Acquisition scope integration tracker** — measures how quickly acquired assets enter the bounty scope after deals close.
0631. **Bounty table change analyzer** — diffs payout tables, since raised bounties signal which vulnerability classes the target fears most.
0632. **Bounty multiplier event tracker** — monitors limited-time multiplier events that indicate priority assets needing urgent attention.
0633. **Live hacking event announcer** — tracks live hacking events naming the target, which concentrate researcher attention and disclose techniques.
0634. **Policy page change differ** — diffs program policies for safe-harbor, disclosure, and testing-window changes.
0635. **Out-of-scope list evolution tracker** — monitors out-of-scope changes whose rationales reveal sensitive systems.
0636. **Safe harbor change monitor** — flags safe-harbor wording changes that alter legal protections for researchers.
0637. **Disclosure timeline change watcher** — tracks coordinated disclosure timeline changes that affect publication planning.
0638. **Retest policy change alerter** — flags retest SLA changes that indicate verification process maturity.
0639. **Credentials provisioning change tracker** — monitors test-account provisioning changes that alter authenticated testing depth.
0640. **VPN requirement change detector** — flags new VPN or IP-allowlisting requirements that change test setup.
0641. **Testing window change monitor** — tracks allowed testing hours that constrain hunt scheduling.
0642. **Rate limit guidance change watcher** — diffs published rate limits that bound automated testing intensity.
0643. **Report template change tracker** — monitors template changes that reveal which evidence the target values most.
0644. **Severity rubric change analyzer** — diffs severity guidance to predict how findings will be triaged.
0645. **Program manager change detector** — flags program manager transitions that often reset triage behavior.
0646. **Triage SLA trend tracker** — measures triage time trends to predict response speed for new reports.
0647. **NDA requirement change monitor** — tracks NDA changes affecting private program participation.
0648. **Private invite criteria watcher** — monitors invitation criteria changes that signal program selectivity shifts.
0649. **Program pause detector** — flags paused programs that often precede relaunches with rewritten scopes.
0650. **Program decommission watcher** — detects retired programs whose assets may lose all researcher attention.
0651. **Platform migration detector** — catches HackerOne to Bugcrowd moves that rewrite scope and policy from scratch.
0652. **VDP page change monitor** — tracks vulnerability disclosure policy pages for contact and scope updates.
0653. **PGP key rotation watcher** — monitors security contact PGP key changes that affect encrypted report submission.
0654. **Security contact change tracker** — flags security@ contact changes that indicate team transitions.
0655. **Transparency report cadence tracker** — monitors transparency report publication schedules for government request and takedown trends.
0656. **Law enforcement request trend analyzer** — analyzes request volumes that indicate regulatory scrutiny levels.
0657. **Content moderation transparency miner** — extracts enforcement data that reveals abuse-handling infrastructure.
0658. **Government takedown trend watcher** — tracks takedown demands by country that affect data localization decisions.
0659. **Warrant canary change detector** — monitors canary statements whose modification or removal is a critical trust signal.
0660. **NSL disclosure tracker** — tracks national security letter disclosures where published.
0661. **Pen-test summary publication watcher** — monitors published pentest summaries that name tested systems and finding counts.
0662. **Audit report publication tracker** — watches for published SOC 2 and ISO reports that enumerate controls and scope.
0663. **Security questionnaire response miner** — extracts control details from published questionnaire responses like CAIQ.
0664. **SIG questionnaire leak watcher** — monitors shared SIG responses that document the target's security architecture.
0665. **Trust & safety blog miner** — extracts integrity enforcement details that reveal abuse detection infrastructure.
0666. **Adversarial threat report correlator** — maps the target's published threat reports to defensive priorities.
0667. **Coordinated inauthentic behavior sector tracker** — monitors sector-wide influence operations for tactics that may target the victim's platforms.
0668. **Threat actor naming correlator** — maps named threat actors to the target's sector for defensive prioritization.
0669. **APT targeting trend watcher** — tracks APT interest in the target's sector from public reporting.
0670. **Dark-web mention correlator (defensive)** — correlates dark-web forum mentions of the target's domains for early breach or targeting warnings.
0671. **Ransomware leak site victim watcher** — monitors leak sites for the target's name as an early breach confirmation channel.
0672. **Extortion blog monitor** — tracks extortion blogs for data samples allegedly from the target.
0673. **Data auction listing watcher** — monitors criminal marketplaces for listings claiming the target's data.
0674. **Initial access broker listing detector** — flags broker listings offering access to the target's networks for defensive response.
0675. **Infostealer log mention tracker** — correlates infostealer log inventories mentioning the target's domains for credential exposure.
0676. **Combo list appearance monitor** — watches combo lists for the target's domains to scope credential-stuffing risk.
0677. **Credential dump correlation engine** — maps public breach dumps to the target's user base for password-reuse risk assessment.
0678. **Breach disclosure aggregator** — aggregates haveibeenpwned-style domain search results into a breach timeline for the target.
0679. **Paste site mention monitor** — scans Pastebin-like sites for the target's domains, keys, and internal URLs.
0680. **Phishing kit impersonation tracker** — monitors phishing kit feeds for kits impersonating the target's brand and login flows.
0681. **Fake app store listing detector** — flags fraudulent mobile apps impersonating the target for takedown prioritization.
0682. **Fake social account monitor** — tracks impersonating social accounts used in support scams against the target's customers.
0683. **Customer support impersonation watcher** — monitors scam support numbers and sites targeting the target's users.
0684. **Brand abuse certificate alerter** — correlates CT logs with typosquat domains for rapid phishing-site certificate detection.
0685. **Homograph attack readiness scorer** — scores IDN homograph risk per brand string to prioritize defensive registrations.
0686. **Lookalike domain TLS monitor** — watches certificate issuance on lookalike domains as a phishing-preparation signal.
0687. **Parked domain impersonation watcher** — flags parked lookalikes that suddenly become active with copied branding.
0688. **Redirector abuse monitor** — tracks abuse of the target's open redirectors in phishing campaigns.
0689. **Subdomain hijack reuse detector** — watches previously remediated subdomains for re-dangling after DNS edits.
0690. **Expired subdomain re-registration alerter** — flags expired subdomains or domains being re-registered by third parties.
0691. **Dormant asset reactivation watcher** — alerts when long-dormant target assets suddenly start responding.
0692. **Shadow IT rediscovery scheduler** — re-runs discovery on a quarterly cadence to catch shadow assets missed in previous cycles.
0693. **Deprovisioning verification cadence** — verifies retired services actually stay retired on a scheduled basis.
0694. **Certificate inventory reconciliation** — reconciles CT-derived certificate inventory against authorized asset lists monthly.
0695. **DNS inventory reconciliation** — reconciles passive DNS hostnames against the authorized asset inventory each cycle.
0696. **Cloud asset reconciliation** — reconciles cloud provider asset APIs against the known inventory for unmanaged resources.
0697. **SaaS inventory reconciliation** — reconciles SSO app catalogs against the authorized SaaS list quarterly.
0698. **Code inventory reconciliation** — reconciles org repos and packages against the authorized code inventory.
0699. **Monitoring coverage gap analyzer** — measures which known assets lack any monitoring coverage and prioritizes onboarding.
0700. **Intel freshness scorer** — scores every intelligence item by age and source reliability, expiring stale intel automatically.
0701. **Mobile app release monitor** — watches App Store and Play Store for new releases of the target's apps, since each release is a new client-side and API attack surface.
0702. **APK endpoint extraction differ** — decompiles each new APK and diffs extracted endpoints, keys, and hosts against the previous release.
0703. **IPA endpoint extraction differ** — performs the same endpoint diffing on iOS releases to catch platform-divergent backends.
0704. **App changelog security miner** — parses release notes for security fixes that pinpoint fragile components to re-test.
0705. **TestFlight and beta track watcher** — monitors beta distribution channels for pre-release builds that expose upcoming features.
0706. **Staged rollout version tracker** — tracks phased rollouts to identify which app versions remain in the wild and supported.
0707. **Minimum version enforcement watcher** — monitors forced-update thresholds that define the oldest testable client version.
0708. **App store metadata differ** — diffs store listings for new screenshots, permissions, and data-safety disclosures that reveal feature changes.
0709. **Data safety section change tracker** — monitors Play Data Safety and App Privacy labels for newly declared data collection.
0710. **ATT prompt change detector** — flags App Tracking Transparency prompt changes that alter identifier collection behavior.
0711. **New permission request alerter** — flags apps requesting new dangerous permissions between releases.
0712. **Third-party SDK disclosure differ** — diffs declared SDK lists in store privacy sections against binary-extracted SDKs.
0713. **App review response miner** — mines developer responses to reviews for staff-disclosed timelines and known-issue details.
0714. **Review text feature extractor** — extracts feature mentions from user reviews that reveal undocumented functionality.
0715. **Crash report version correlator** — correlates public crash discussions with versions to find unstable releases.
0716. **APK signing certificate watcher** — monitors signing cert changes that indicate key compromise or developer transitions.
0717. **Play App Signing migration detector** — flags migrations to Play-managed signing that change the trust chain.
0718. **Enterprise app distribution watcher** — monitors MDM-distributed enterprise app versions that diverge from public releases.
0719. **MDM-distributed config extractor** — analyzes managed app configurations for documented endpoints and feature flags.
0720. **Smart TV app release tracker** — monitors tvOS, Android TV, and Tizen releases whose backends often lag mobile hardening.
0721. **Watch app release monitor** — tracks watchOS and Wear OS companions that expose paired-device APIs.
0722. **Automotive app change tracker** — monitors connected-car apps whose vehicle APIs are high-value targets.
0723. **IoT companion app mapper** — inventories IoT companion apps and maps their device-provisioning flows.
0724. **IoT product launch tracker** — flags new IoT hardware launches that introduce firmware, BLE, and cloud API surface.
0725. **Hardware teardown blog miner** — extracts UART, JTAG, and flash details from public teardowns for hardware attack planning.
0726. **FCC filing internals extractor** — mines FCC exhibits for device photos, schematics, and manuals that document hardware interfaces.
0727. **Firmware release monitor** — watches vendor firmware portals for new releases, diffing binaries for changed services.
0728. **OTA firmware diff engine** — diffs over-the-air firmware updates to find patched vulnerabilities and new network services.
0729. **Firmware SBOM extractor** — extracts software bills of materials from firmware images for component CVE matching.
0730. **Hardcoded credential scanner for firmware** — scans firmware images for default credentials tied to the target's devices.
0731. **BLE service change tracker** — monitors Bluetooth GATT service definitions in app updates for new device commands.
0732. **Zigbee and Z-Wave change detector** — tracks smart-home protocol support changes that alter device pairing security.
0733. **Matter standard adoption watcher** — monitors Matter certification listings that document device capabilities and commissioning flows.
0734. **HomeKit accessory definition tracker** — diffs HomeKit accessory definitions for new characteristics and automations.
0735. **Alexa skill change monitor** — tracks skill manifest changes whose account-linking flows bridge voice to target accounts.
0736. **Google Action change tracker** — monitors Action releases for new intents that map to backend APIs.
0737. **Smart speaker firmware watcher** — tracks speaker firmware releases that change local network behavior.
0738. **Router and gateway firmware tracker** — monitors ISP and vendor gateway firmware for the target's managed devices.
0739. **Camera firmware change detector** — flags IP camera firmware updates that alter streaming and cloud-upload behavior.
0740. **Industrial IoT protocol watcher** — monitors Modbus, OPC-UA, and MQTT exposures for the target's operational technology.
0741. **MQTT broker exposure monitor** — checks for internet-reachable MQTT brokers tied to the target's device fleets.
0742. **CoAP endpoint discovery** — probes for constrained-application-protocol endpoints on the target's IoT footprint.
0743. **Device provisioning flow mapper** — maps QR, BLE, and SoftAP provisioning flows from app analysis for onboarding flaws.
0744. **Device certificate provisioning watcher** — monitors how devices obtain certificates, a critical supply-chain trust anchor.
0745. **Fleet management API tracker** — inventories device-management APIs whose bulk operations are high-impact targets.
0746. **Remote diagnostics endpoint watcher** — flags diagnostic endpoints that expose device telemetry and logs.
0747. **Telemetry ingestion endpoint mapper** — maps telemetry endpoints and their auth to assess data-injection risk.
0748. **Command-and-control channel analyzer** — documents legitimate device C2 channels to distinguish them from compromise.
0749. **Cloud asset inventory builder** — builds a multi-cloud asset inventory from the target's public cloud signals and certificate data.
0750. **Storage bucket discovery engine** — finds the target's cloud storage buckets from code, CT logs, and naming patterns for misconfiguration review.
0751. **Public bucket re-check scheduler** — re-checks known buckets on a cadence, since permissions drift with every deploy.
0752. **Cloud storage naming pattern learner** — learns bucket naming conventions to predict undiscovered storage assets.
0753. **Object listing exposure tester** — checks whether buckets allow object listing, the classic first step in storage data exposure.
0754. **Versioned object history reviewer** — examines bucket versioning for deleted-but-recoverable sensitive objects.
0755. **Cross-region replication watcher** — monitors replication configs that indicate data residency and backup strategies.
0756. **Serverless function enumerator** — inventories the target's Lambda, Cloud Functions, and Workers from DNS, headers, and code references.
0757. **Function URL exposure checker** — tests whether serverless function URLs are directly reachable bypassing API gateways.
0758. **Edge worker script differ** — diffs edge worker code where exposed to find request-manipulation logic.
0759. **Queue and topic inventory** — maps SQS, Pub/Sub, and EventBridge resources referenced in public code and docs.
0760. **Event bus schema watcher** — monitors published event schemas that document internal data structures.
0761. **API gateway stage differ** — diffs gateway stages and deployments for newly promoted APIs.
0762. **Custom domain attachment tracker** — monitors custom domains attached to cloud services that may bypass WAF coverage.
0763. **CloudFront distribution enumerator** — inventories CDN distributions from certificate and DNS data for origin discovery.
0764. **WAF association verifier** — verifies each public cloud asset actually sits behind the WAF, flagging gaps.
0765. **DDoS protection coverage mapper** — maps which assets have Shield, Armor, or equivalent protection enabled.
0766. **Egress IP range publisher watcher** — tracks published NAT and egress ranges that enumerate cloud footprints.
0767. **VPC endpoint exposure checker** — looks for PrivateLink and VPC endpoint DNS names leaking internal service names.
0768. **Service discovery namespace watcher** — monitors Cloud Map and similar namespaces for internal service enumeration.
0769. **Container orchestration API watcher** — checks for exposed Kubernetes, ECS, and Nomad APIs in the target's ranges.
0770. **Kubelet and etcd exposure tester** — tests for accidentally exposed orchestration internals on discovered hosts.
0771. **Service mesh ingress mapper** — maps mesh ingress gateways that consolidate external access to microservices.
0772. **GitOps repo change correlator** — correlates public GitOps manifests with deployed infrastructure for drift detection.
0773. **Infrastructure drift detector** — compares declared infrastructure-as-code against observed reality for unauthorized changes.
0774. **Policy-as-code change watcher** — monitors OPA, Kyverno, and Sentinel policies that encode security guardrails.
0775. **Guardrail effectiveness assessor** — evaluates whether cloud guardrails actually block the misconfigurations they claim to.
0776. **Permission boundary change tracker** — diffs IAM permission boundaries that cap role privileges.
0777. **Access analyzer finding aggregator** — aggregates IAM Access Analyzer-style findings into an external-access risk list.
0778. **Unused access reaper watcher** — tracks removal of unused permissions that shrinks the blast radius over time.
0779. **Credential report age analyzer** — analyzes key, password, and MFA ages from published practices for hygiene scoring.
0780. **Root account usage detector** — flags any signals of cloud root usage that indicate broken operational practices.
0781. **Cross-account role trust mapper** — maps trust policies that allow external accounts into the target's cloud.
0782. **External ID usage verifier** — verifies confused-deputy protections on third-party-assumed roles.
0783. **Flow log analysis scheduler** — where logs are accessible, analyzes VPC flow patterns for unexpected external connections.
0784. **DNS firewall policy watcher** — monitors DNS firewall rules that reveal blocked malicious domains and policies.
0785. **Hybrid DNS configuration mapper** — maps on-prem to cloud DNS integrations that bridge network boundaries.
0786. **Direct Connect and VPN change tracker** — monitors dedicated interconnect changes that alter network trust boundaries.
0787. **Transit gateway route watcher** — tracks transit routing changes that reshape inter-VPC and hybrid connectivity.
0788. **Peering connection inventory** — inventories VPC peerings that create lateral movement paths.
0789. **Resource share (RAM) monitor** — tracks cross-account resource shares that extend trust boundaries.
0790. **Organization policy change tracker** — monitors SCPs and organization policies that constrain entire cloud estates.
0791. **Control Tower drift detector** — flags landing-zone drift that indicates manual changes outside guardrails.
0792. **Account vending log watcher** — monitors new account creation patterns that reveal organizational growth areas.
0793. **Backup vault lock verifier** — checks immutability settings on backup vaults that determine ransomware recoverability.
0794. **Cross-account backup watcher** — monitors backup replication that defines the recovery trust boundary.
0795. **Isolated recovery environment detector** — identifies cyber-vault and clean-room setups from architecture posts.
0796. **Ransomware recovery drill tracker** — monitors announced recovery exercises that enumerate critical systems.
0797. **Legal hold and retention watcher** — tracks retention policies that determine forensic data availability.
0798. **DataSync and transfer watcher** — monitors managed file-transfer endpoints that move sensitive data.
0799. **SFTP and MFT endpoint inventory** — inventories file-transfer hosts whose credentials are high-value targets.
0800. **EFSS sharing link auditor** — audits Box, Dropbox, and Drive sharing patterns for publicly shared sensitive files.
0801. **Developer portal change monitor** — diffs the target's developer portal for new guides, references, and sandbox environments that expand the integration surface.
0802. **Developer newsletter miner** — extracts API changes, deprecations, and new features from developer newsletters into hunt tasks.
0803. **API webinar content extractor** — transcribes API-focused webinars for demoed endpoints and best practices that reveal internals.
0804. **Hackathon announcement tracker** — flags hackathons whose APIs and prize categories enumerate the target's most strategic endpoints.
0805. **Design partner announcement watcher** — monitors design-partner programs that grant early API access worth tracking to launch.
0806. **Early access program tracker** — watches early-access enrollments that precede public API launches.
0807. **API roadmap publication watcher** — monitors public API roadmaps that commit to future endpoints and versions.
0808. **Feature voting board miner** — analyzes upvoted feature requests that predict the next API surface additions.
0809. **Public roadmap change differ** — diffs roadmap statuses to catch features moving from planned to beta to general availability.
0810. **AsyncAPI spec watcher** — monitors published AsyncAPI documents that enumerate event-driven APIs and message schemas.
0811. **JSON Schema publication tracker** — tracks published schemas that validate request and response shapes for fuzzing.
0812. **OpenAPI overlay change detector** — diffs API overlays and extensions that customize the base specification.
0813. **API style guide publication watcher** — monitors style guides that reveal versioning, pagination, and error conventions.
0814. **Error format standardization tracker** — tracks error response standardization that documents internal error codes.
0815. **Pagination convention change detector** — flags pagination scheme changes that alter collection endpoint behavior.
0816. **Filtering and sorting capability mapper** — maps query capabilities that may enable filter-injection or data exfiltration.
0817. **Bulk operation endpoint watcher** — identifies bulk APIs whose mass operations amplify IDOR and injection impact.
0818. **Export endpoint inventory** — catalogs data-export endpoints that are prime exfiltration targets.
0819. **Import endpoint watcher** — flags import endpoints that accept files and external data for injection testing.
0820. **File upload capability mapper** — inventories upload endpoints across the API for malware and polyglot testing.
0821. **File conversion endpoint tracker** — monitors document and media conversion APIs with parser-heavy attack surface.
0822. **Preview generation endpoint watcher** — flags preview and thumbnail generators that fetch arbitrary URLs.
0823. **URL fetching service detector** — identifies services that fetch user-supplied URLs for SSRF assessment.
0824. **OEmbed provider endpoint mapper** — maps oEmbed endpoints that proxy third-party content.
0825. **Link unfurling service watcher** — monitors unfurlers that fetch and render arbitrary links.
0826. **Screenshot service endpoint tracker** — flags screenshot APIs that render attacker-controlled pages server-side.
0827. **PDF generation endpoint watcher** — monitors HTML-to-PDF services with template injection potential.
0828. **Email sending API tracker** — inventories transactional email APIs that may enable header injection or phishing.
0829. **SMS sending API watcher** — flags SMS APIs whose sender IDs and templates may be abusable.
0830. **Voice calling API tracker** — monitors voice APIs for spoofing and toll-fraud-relevant capabilities.
0831. **Push notification API watcher** — tracks push APIs that may allow cross-user notification injection.
0832. **In-app messaging endpoint mapper** — maps messaging endpoints for spoofing and injection testing.
0833. **Notification preference API watcher** — flags preference endpoints that control security-critical alerts.
0834. **Audit log API tracker** — monitors audit log APIs whose completeness determines forensic visibility.
0835. **Log export endpoint watcher** — flags log export capabilities that may leak sensitive operational data.
0836. **Search API capability mapper** — maps search syntax and operators that may enable injection or unauthorized discovery.
0837. **Autocomplete endpoint watcher** — flags typeahead APIs that leak directory and object enumerations.
0838. **Suggestion API data leak tester** — tests suggestion endpoints for cross-user data leakage.
0839. **Graph traversal endpoint mapper** — identifies relationship and graph APIs for excessive data exposure.
0840. **Reporting API inventory** — catalogs reporting endpoints whose filters may bypass authorization.
0841. **Dashboard API watcher** — monitors dashboard data APIs that aggregate cross-tenant metrics.
0842. **Analytics ingestion endpoint tracker** — flags analytics collectors that accept unauthenticated event data.
0843. **Metrics ingestion API watcher** — monitors metrics endpoints for injection into operational dashboards.
0844. **Tracing ingestion endpoint checker** — checks whether tracing collectors accept spoofed spans.
0845. **Log ingestion API watcher** — flags log collectors that may accept forged log entries.
0846. **Feature flag evaluation API tracker** — monitors flag evaluation endpoints that reveal targeting rules.
0847. **Experimentation assignment watcher** — tracks experiment APIs whose bucketing logic may be manipulable.
0848. **Remote config fetch endpoint mapper** — maps config endpoints that distribute feature flags to clients.
0849. **Kill switch status watcher** — monitors kill-switch states that indicate degraded or emergency modes.
0850. **Health check detail differ** — diffs verbose health endpoints that enumerate dependencies and versions.
0851. **Readiness probe information extractor** — extracts dependency lists from readiness probes for architecture mapping.
0852. **Liveness probe behavior watcher** — monitors liveness semantics that reveal restart and recovery behavior.
0853. **Dependency health aggregator mapper** — maps aggregated health dashboards that enumerate every backing service.
0854. **Version endpoint inventory** — catalogs /version endpoints that disclose exact build numbers.
0855. **Build info endpoint watcher** — flags actuator-style info endpoints leaking Git commits and build times.
0856. **Environment disclosure detector** — catches endpoints revealing staging, production, or region identifiers.
0857. **Configuration endpoint watcher** — monitors client config endpoints that distribute API keys and feature flags.
0858. **Bootstrap payload analyzer** — analyzes initial app bootstrap payloads for embedded tokens and endpoints.
0859. **Session initialization mapper** — maps session bootstrap calls that issue tokens and CSRF values.
0860. **CSRF token endpoint watcher** — monitors token issuance endpoints for fixation and entropy issues.
0861. **Nonce generation endpoint tracker** — flags nonce endpoints whose predictability undermines replay protection.
0862. **Captcha token flow mapper** — maps CAPTCHA verification flows for bypass testing.
0863. **Bot score endpoint watcher** — identifies risk-scoring endpoints that gate sensitive actions.
0864. **Device fingerprint collection mapper** — maps fingerprinting scripts and endpoints for privacy and bypass analysis.
0865. **Behavioral biometric signal tracker** — monitors behavioral data collection endpoints for sensitive inference.
0866. **Risk-based auth trigger mapper** — infers step-up authentication triggers from behavior testing.
0867. **Step-up auth flow watcher** — monitors re-authentication flows for session and token handling flaws.
0868. **Session binding change detector** — flags changes in session-to-device binding strictness.
0869. **Concurrent session policy watcher** — monitors multi-session policies that affect session hijacking impact.
0870. **Session timeout change tracker** — diffs idle and absolute timeouts that bound stolen-session usefulness.
0871. **Remember-me token watcher** — analyzes long-lived token issuance and rotation behavior.
0872. **Token refresh flow mapper** — maps refresh token flows for reuse and rotation flaws.
0873. **Token revocation endpoint tester** — verifies revocation endpoints actually invalidate tokens promptly.
0874. **Global logout propagation watcher** — tests whether logout revokes sessions across all devices and services.
0875. **SSO session bridging mapper** — maps how SSO sessions bridge to application sessions.
0876. **IdP-initiated flow watcher** — monitors IdP-initiated SSO that bypasses SP-side request validation.
0877. **SAML metadata change differ** — diffs IdP and SP metadata for certificate, endpoint, and binding changes.
0878. **OIDC discovery document differ** — diffs discovery documents for new endpoints and supported flows.
0879. **OAuth authorize parameter mapper** — maps supported OAuth parameters to find unvalidated or dangerous options.
0880. **PKCE enforcement verifier** — verifies PKCE requirements across public clients.
0881. **PAR (pushed auth request) adoption tracker** — monitors PAR adoption that hardens authorization requests.
0882. **DPoP adoption watcher** — tracks Demonstrating Proof of Possession deployments that bind tokens to keys.
0883. **mTLS client auth watcher** — monitors mutual TLS requirements for API clients.
0884. **Private key JWT adoption tracker** — flags private_key_jwt client authentication that replaces shared secrets.
0885. **Client assertion change monitor** — watches client authentication method changes across the API.
0886. **Token exchange endpoint watcher** — flags RFC 8693 token exchange endpoints with impersonation potential.
0887. **Delegation flow mapper** — maps on-behalf-of flows that chain user identities across services.
0888. **Service account impersonation watcher** — monitors impersonation APIs that are prime privilege-escalation targets.
0889. **Workload identity endpoint tracker** — maps metadata and identity endpoints available to workloads.
0890. **Instance metadata protection verifier** — verifies IMDSv2 enforcement that blocks SSRF-to-metadata attacks.
0891. **Cloud credential endpoint watcher** — monitors credential vending endpoints for over-broad permissions.
0892. **Temporary credential scope analyzer** — analyzes scoped-down credential policies for excess privilege.
0893. **Permission scope minimization tracker** — measures whether issued scopes shrink over time toward least privilege.
0894. **Just-in-time access flow mapper** — maps JIT elevation flows for approval bypass testing.
0895. **Break-glass account usage watcher** — monitors emergency access usage patterns for anomaly detection.
0896. **Privileged session recording verifier** — checks whether privileged sessions are actually recorded and immutable.
0897. **SSH certificate authority watcher** — monitors SSH CA deployments that replace static keys.
0898. **Short-lived SSH cert tracker** — tracks certificate lifetimes that bound stolen-credential usefulness.
0899. **Bastion host inventory** — inventories jump hosts that concentrate administrative access.
0900. **Admin console exposure watcher** — continuously checks administrative consoles for internet exposure and auth strength.
0901. **Passkey rollout tracker** — monitors WebAuthn and passkey deployment announcements that change phishing resistance across the user base.
0902. **Conditional mediation adoption watcher** — tracks autofill-style passkey UX that changes credential-handling flows.
0903. **Passwordless option differ** — diffs login pages for newly offered passwordless methods that alter account-takeover economics.
0904. **Magic link flow security mapper** — maps magic-link issuance, expiry, and single-use enforcement.
0905. **Social login provider change watcher** — flags added or removed social IdPs that change account-linking attack surface.
0906. **Account linking flow mapper** — analyzes how social, SSO, and password identities merge for takeover via linking.
0907. **Identifier-first flow change detector** — monitors username-enumeration implications of identifier-first login designs.
0908. **Username enumeration signal watcher** — tracks response differences that leak account existence across auth endpoints.
0909. **Credential stuffing defense mapper** — infers rate limiting, CAPTCHA, and lockout behavior on login endpoints.
0910. **Password spray indicator watcher** — monitors lockout thresholds and alerting that bound spray attacks.
0911. **MFA fatigue defense tracker** — flags number-matching and context-rich MFA prompts that resist push bombing.
0912. **MFA method inventory** — catalogs offered MFA methods to identify weak options like SMS or voice.
0913. **SMS OTP deprecation watcher** — tracks removal of SMS-based verification that hardens account recovery.
0914. **Voice OTP risk assessor** — flags voice-call verification that remains vulnerable to SIM swap and spoofing.
0915. **SIM swap defense tracker** — monitors carrier-verification and port-out protections for phone-based auth.
0916. **Number porting protection watcher** — tracks port-out PIN and lock adoption signals.
0917. **VoIP provider change detector** — flags telephony vendor swaps that reset voice verification security.
0918. **SMS provider migration tracker** — monitors Twilio, Vonage, and Sinch changes that alter OTP delivery paths.
0919. **Email verification vendor watcher** — tracks email validation services that gate registration abuse.
0920. **Phone verification vendor tracker** — monitors phone intelligence vendors that score number risk.
0921. **KYC vendor change detector** — flags identity verification vendor swaps that change document and liveness checks.
0922. **Document verification flow mapper** — analyzes ID document upload flows for forgery-relevant weaknesses.
0923. **Liveness detection change watcher** — monitors biometric liveness upgrades that raise deepfake barriers.
0924. **Age verification method tracker** — tracks age assurance methods that process sensitive identity documents.
0925. **Sanctions screening vendor watcher** — monitors denied-party screening integrations for compliance data flows.
0926. **Transaction monitoring vendor tracker** — flags AML transaction monitoring changes that alter fraud detection.
0927. **Fraud rules engine change inferrer** — infers rule changes from job posts that shift fraud decisioning.
0928. **ML fraud model update tracker** — monitors model retraining signals that change risk scoring behavior.
0929. **Device intelligence vendor watcher** — tracks device fingerprinting vendors that score transaction risk.
0930. **Network intelligence adoption tracker** — flags IP and network risk scoring integrations.
0931. **Email risk scoring watcher** — monitors email reputation checks at registration and checkout.
0932. **Synthetic identity trend correlator** — correlates sector synthetic-identity trends with the target's onboarding controls.
0933. **New account fraud control mapper** — maps velocity checks, device checks, and verification at signup.
0934. **Promo and referral abuse watcher** — monitors abuse-relevant promotion mechanics for fraud-pattern changes.
0935. **Loyalty fraud control tracker** — flags loyalty program changes that alter point-theft economics.
0936. **Return fraud signal watcher** — monitors return policy and verification changes for abuse-pattern shifts.
0937. **Chargeback trend analyzer** — analyzes dispute automation changes that affect fraudster cashout.
0938. **Order management migration watcher** — tracks OMS changes that rewire order and payment data flows.
0939. **Warehouse system change tracker** — monitors WMS changes whose APIs manage inventory and fulfillment.
0940. **Last-mile provider change detector** — flags delivery provider swaps that change tracking and notification integrations.
0941. **Address validation vendor watcher** — tracks validation services that process customer addresses.
0942. **Tax engine change tracker** — monitors Avalara and Vertex changes that process transaction data.
0943. **Trade compliance screening watcher** — flags export-control screening that handles sensitive customer data.
0944. **Data processing location tracker** — monitors published processing locations that define jurisdictional exposure.
0945. **SCC and transfer mechanism watcher** — tracks standard contractual clause updates affecting cross-border data flows.
0946. **DPIA publication monitor** — watches published data protection impact assessments that document high-risk processing.
0947. **RoPA change inferrer** — infers records-of-processing updates from privacy policy and subprocessor changes.
0948. **Retention schedule change tracker** — monitors data retention changes that define forensic and breach-notification windows.
0949. **DSAR fulfillment flow mapper** — maps data subject request flows that expose data export capabilities.
0950. **Consent withdrawal propagation watcher** — verifies consent withdrawal actually propagates to processors.
0951. **Do Not Sell signal tracker** — monitors GPC and opt-out signal handling changes.
0952. **Privacy engineering blog miner** — extracts PETs adoption like differential privacy and confidential computing from engineering posts.
0953. **Confidential computing adoption tracker** — monitors SGX, SEV, and TDX usage that changes the trust model for sensitive workloads.
0954. **Private inference deployment watcher** — flags on-device and enclave inference that keeps prompts out of vendor clouds.
0955. **Federated learning signal tracker** — monitors federated training that distributes model updates across devices.
0956. **Differential privacy parameter watcher** — tracks epsilon and noise parameters that quantify privacy guarantees.
0957. **Synthetic data generation tracker** — monitors synthetic data pipelines that replace real PII in testing.
0958. **Tokenization vault change watcher** — flags tokenization provider changes that protect cardholder and PII data.
0959. **Format-preserving encryption tracker** — monitors FPE deployments that indicate legacy format constraints.
0960. **Data clean room adoption watcher** — tracks clean-room partnerships that share aggregated data with third parties.
0961. **Privacy Sandbox API adoption tracker** — monitors Topics, Attribution Reporting, and Private Aggregation adoption that changes ad-tech data flows.
0962. **Third-party cookie readiness watcher** — tracks deprecation readiness that forces first-party data strategies.
0963. **First-party data strategy miner** — extracts server-side collection plans that create new first-party endpoints.
0964. **Related website sets watcher** — monitors First-Party Sets declarations that define cross-site cookie sharing.
0965. **FedCM adoption tracker** — flags Federated Credential Management adoption that changes federated login flows.
0966. **CHIPS and storage partitioning watcher** — tracks partitioned storage adoption affecting cross-site tracking.
0967. **Ad tech vendor change correlator** — maps header bidding, Prebid, and SSP changes that move auction data.
0968. **Supply-path transparency watcher** — monitors ads.txt and sellers.json changes that document ad supply chains.
0969. **Domain spoofing monitor** — watches for the target's domains appearing in spoofed bid requests.
0970. **SKAdNetwork and attribution change tracker** — monitors mobile attribution changes that alter install data flows.
0971. **Accessibility statement change tracker** — diffs accessibility statements that often accompany major frontend rebuilds.
0972. **VPAT publication watcher** — monitors published accessibility conformance reports that enumerate tested products.
0973. **European Accessibility Act readiness tracker** — flags EAA compliance work that drives frontend overhauls.
0974. **Accessibility overlay change detector** — monitors overlay widgets whose scripts add third-party risk.
0975. **Assistive technology testing signal** — tracks screen-reader testing mentions that indicate semantic HTML maturity.
0976. **Captioning and transcription vendor watcher** — monitors media accessibility vendors processing video content.
0977. **Design system accessibility tracker** — watches component library a11y improvements that signal frontend investment.
0978. **Automated a11y testing adoption watcher** — tracks axe and Lighthouse CI integration that gates deploys.
0979. **Localization platform change tracker** — monitors i18n platforms whose translation workflows expose content APIs.
0980. **Locale expansion predictor** — predicts new regional deployments from translator hiring and locale file additions.
0981. **RTL support rollout watcher** — flags right-to-left layout work that indicates Middle East market entry.
0982. **Machine translation vendor watcher** — tracks translation APIs processing user content.
0983. **Regional endpoint rollout detector** — detects region-specific API hosts launched for latency or compliance.
0984. **Geo-fencing change tracker** — monitors geographic restriction changes that alter content availability logic.
0985. **Data localization announcement watcher** — flags in-country data storage commitments that create new regional infrastructure.
0986. **Sovereign cloud adoption tracker** — monitors sovereign and government cloud deployments with distinct security boundaries.
0987. **GovCloud and classified offering watcher** — tracks government-specific environments with heightened assurance requirements.
0988. **FedRAMP marketplace listing tracker** — monitors FedRAMP authorizations whose packages document security architectures.
0989. **IRAP and ENS assessment watcher** — tracks Australian and European assessments that publish scope details.
0990. **ISO 42001 AI management tracker** — monitors AI management system certifications that document AI governance.
0991. **EU AI Act conformity watcher** — tracks conformity assessments for high-risk AI systems the target operates.
0992. **GPAI obligation tracker** — monitors general-purpose AI model obligations affecting the target's AI products.
0993. **AI incident reporting watcher** — tracks serious-incident reporting that reveals AI failure modes.
0994. **Model evaluation publication monitor** — watches published red-teaming and evaluation summaries for AI safety posture.
0995. **AI transparency obligation tracker** — monitors AI disclosure implementations like labeling and watermarking.
0996. **Human oversight implementation watcher** — tracks human-in-the-loop designs for high-stakes AI decisions.
0997. **Quantum risk assessment tracker** — monitors published quantum-readiness plans that prioritize cryptographic migration.
0998. **Entropy source change watcher** — flags RNG and entropy infrastructure changes that underpin all cryptography.
0999. **Trust store inclusion monitor** — tracks root program inclusion status that determines certificate ubiquity.
1000. **Target intelligence synthesis engine** — fuses every signal above into a single living target profile with confidence scores, staleness tracking, and auto-generated hunt plans ranked by expected yield.
