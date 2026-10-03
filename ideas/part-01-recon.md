## A. Subdomain & asset discovery
0001. **Certificate-transparency substring watch** — monitor CT logs for substrings of the target brand (typosquats, dev/staging prefixes) and auto-queue new hosts for takeover checks within 60 seconds of issuance.
0002. **Precertificate SCT timestamp mining** — harvest pre-certificates from CT logs before the final cert is issued to discover hosts that exist minutes to hours before they go live and probe them in that pre-launch window.
0003. **CT dev-prefix rotation tracking** — detect naming patterns like dev1, dev2, staging-blue in CT logs and predict the next rotation slot to pre-enumerate future environments.
0004. **Typosquat brand-pair generation** — generate keyboard-adjacent, homoglyph, and transposed variants of the target brand, query CT logs for any certificates, and flag squat domains that mimic the target.
0005. **Certificate SAN overlap clustering** — group certificates whose Subject Alternative Names share two or more hosts with the target to reveal sibling infrastructure the target never advertises.
0006. **Wildcard-certificate parent probing** — when a wildcard cert for *.example.com appears, systematically probe common labels plus wordlist-derived names to enumerate the wildcard's actual coverage.
0007. **Expired-cert host resurrection list** — collect hosts from expired certificates for the target org and re-probe them, since expired certs often mark forgotten assets that still respond.
0008. **CT log issuer anomaly flagging** — flag certificates for target domains issued by unexpected CAs or via ACME on unusual schedules, since rogue issuance often reveals attacker or devops side-infrastructure.
0009. **NSEC zone-walk automation** — walk DNSSEC-signed zones via NSEC chain traversal to enumerate every signed name without brute force.
0010. **NSEC3 hash-crack walking** — collect NSEC3 hashes via iterative queries and crack them with optimized wordlists to enumerate names in opt-out-disabled zones.
0011. **NSEC3PARAM salt-harvesting dictionary** — extract NSEC3PARAM salt and iteration counts to build targeted hash lists that make offline NSEC3 cracking feasible at scale.
0012. **AXFR over TCP fallback probing** — attempt zone transfers over plain TCP on every authoritative nameserver, including non-standard ports, since misconfigured secondaries still leak full zones.
0013. **AXFR over TLS/DoT attempt** — probe DNS-over-TLS port 853 for zone-transfer acceptance, which admins secure differently from port 53.
0014. **AXFR over DoH endpoints** — test discovered DNS-over-HTTPS endpoints for AXFR-style responses or zone-dump behavior behind misconfigured HTTPS DNS gateways.
0015. **ANY-query meta-record mining** — issue ANY queries against authoritative servers to collect HINFO, TXT, and legacy record types that reveal hostnames and internal naming.
0016. **DNS NOTIFY-triggered capture** — listen for unsolicited NOTIFY patterns and zone serial increments to time enumeration right after zone updates when new hosts appear.
0017. **HTTPS record (SVCB) alias harvesting** — query HTTPS/SVCB records to extract alpn, port, ipv4hint, ipv6hint, and target aliases that map hidden service endpoints.
0018. **SVCB echconfig extraction** — parse ECH configs from HTTPS records to identify backend service aliases used for encrypted-client-hello fronting.
0019. **ALPN record service inference** — enumerate advertised ALPN protocols per host to infer which services (h2, h3, custom) run behind each name without port scanning.
0020. **CAA record policy inference** — read CAA records to infer which CAs the org trusts and which account URIs issue certs, exposing the org's certificate issuance pipeline and related accounts.
0021. **CAA issuewild gap analysis** — compare CAA issue and issuewild policies to find wildcard issuance gaps that hint at unmanaged wildcard infrastructure.
0022. **Passive-DNS first-seen correlation** — cross-correlate first-seen timestamps of subdomains across multiple passive DNS feeds to order asset creation and spot recently spun-up staging hosts.
0023. **Passive-DNS co-occurrence pivoting** — find IPs that historically resolved to many target subdomains, then pull all other names ever seen on those IPs from passive DNS to expand the asset list.
0024. **Passive-DNS TTL-change tracking** — monitor TTL value changes in passive DNS for target names to detect infrastructure migrations that introduce new, less-hardened endpoints.
0025. **ASN enumeration via BGP origin** — enumerate all prefixes originated by the target's ASNs from BGP collectors and sweep them for live hosts tied to the org.
0026. **BGP MOAS anomaly detection** — detect Multiple Origin AS announcements for target prefixes, since MOAS often indicates cloud migrations or hijack attempts worth investigating.
0027. **IRR object mining** — parse Internet Routing Registry route, aut-num, and descr objects for the target's ASNs to extract referenced hostnames, contacts, and peer networks.
0028. **RPKI ROA prefix discovery** — read RPKI route-origin authorizations for the target ASN to list every prefix the org claims, including ones not yet advertised.
0029. **BGP community-string decoding** — decode BGP community strings on target prefixes to infer PoP locations and traffic-engineering setups that reveal edge infrastructure.
0030. **Reverse-WHOIS registrant pivoting** — pivot on registrant name, email, and org fields via reverse-WHOIS to find sibling domains registered by the same entity.
0031. **WHOIS creation-date clustering** — cluster domains by identical creation timestamps and registrar to find bulk-registered campaign domains linked to the target.
0032. **WHOIS nameserver-sharing graph** — build a graph of domains sharing the target's custom nameservers to uncover related properties using the same DNS infrastructure.
0033. **RDAP history chain traversal** — walk RDAP entity history and status changes to find previously associated domains and abandoned-but-still-resolving assets.
0034. **Search-engine dork pipeline at scale** — run batched site: and inurl: dorks across multiple engines with result dedup to surface indexed-but-unlinked subdomains.
0035. **Search-engine cache host extraction** — scrape cached page copies for absolute URLs pointing at subdomains that are no longer linked from the live site.
0036. **Search-engine image-alt host mining** — extract hostname references from image search metadata and alt text that leak internal CDN and staging hosts.
0037. **GitHub code-search hostname mining** — search GitHub code for the target's domain patterns to find hardcoded API hosts, webhooks, and internal endpoints in public repos.
0038. **GitLab snippet host extraction** — mine public GitLab snippets and gists for target hostnames leaked in pastes and debug dumps.
0039. **Git commit-history host archaeology** — scan full git histories of org repos for hostnames that existed in old commits but were later removed, then probe them as forgotten assets.
0040. **GitHub Actions log hostname leaks** — parse public CI logs for resolved hostnames, internal URLs, and artifact endpoints printed during builds.
0041. **Mobile APK host extraction** — decompile Android APKs of the target's apps and extract all hardcoded hosts, API base URLs, and socket endpoints from strings and configs.
0042. **iOS IPA plist host mining** — extract NSAppTransportSecurity exceptions and embedded URLs from iOS app bundles to find API and staging hosts.
0043. **Mobile app certificate-pinning host list** — read pinning configuration files in mobile apps, which enumerate every backend host the app trusts.
0044. **JS-bundle host string extraction** — parse JavaScript bundles for URL-like strings, API paths, and host constants to discover undocumented endpoints (host discovery only).
0045. **Source-map URL reconstruction** — consume published source maps to rebuild original file trees whose paths and comments reference internal hosts.
0046. **Webpack chunk manifest harvesting** — parse webpack runtime manifests to list every lazy-loaded chunk URL, exposing feature-specific subdomains.
0047. **Cloud IP-range to tenant mapping** — map discovered IPs against published cloud provider IP ranges to identify the hosting account's region and likely sibling tenants.
0048. **Cloud metadata-endpoint adjacent discovery** — identify cloud-hosted target assets by correlating provider IP ranges with DNS to prioritize metadata-service checks later.
0049. **Favicon-hash netblock pivoting** — compute favicon hashes on the target, then scan the target's netblocks for identical hashes to find cloned or related services.
0050. **Favicon-hash ASN-wide search** — search favicon-hash indexes across the target's whole ASN to find same-branded infrastructure outside known domains.
0051. **Expired-domain re-registration monitor** — watch domains previously owned by the target that expire, and alert when they become re-registrable since dangling DNS may still point at them.
0052. **Domain-drop catchlist building** — build a watchlist of target-linked domains nearing expiry from WHOIS data and queue takeover checks the moment they drop.
0053. **Dev/staging naming-convention brute force** — generate permutations from observed patterns (env-region-app) and resolve them to find unlinked staging hosts.
0054. **Environment-prefix matrix probing** — cross dev, staging, qa, uat, preprod prefixes against every discovered subdomain base to enumerate parallel environments.
0055. **Region-suffix permutation sweep** — append region codes (us-east, eu-west, ap-south) to known hostnames to find geo-distributed deployments.
0056. **DoH resolver differential probing** — query multiple DNS-over-HTTPS resolvers for the same names and diff answers to spot split-horizon DNS hiding internal hosts.
0057. **DoT vs Do53 answer comparison** — compare DNS-over-TLS answers with classic port-53 answers to detect views that conceal infrastructure.
0058. **Public-resolver wildcard fingerprinting** — send random-label queries through many public resolvers to map which resolvers and zones synthesize wildcard answers.
0059. **PTR sweep of acquired netblocks** — reverse-DNS sweep every IP in the target's announced prefixes to collect PTR hostnames that forward DNS never lists.
0060. **PTR pattern inference** — analyze PTR naming patterns to predict unlisted hostnames following the same convention.
0061. **Sibling-domain TLS SAN overlap** — fetch certificates from candidate hosts and cluster by shared SAN entries to find sibling domains under common management.
0062. **Takeover-candidate CNAME pre-screening** — resolve discovered subdomains, match CNAME targets against known dangling-service fingerprints, and queue only high-confidence candidates for takeover verification.
0063. **Dangling-SaaS CNAME cataloging** — maintain a fingerprint catalog of SaaS CNAME targets and scan every discovered CNAME against it to catch newly dangling records.
0064. **DNS wildcard behavior fingerprinting** — probe random labels to characterize wildcard synthesis (NXDOMAIN vs synthesized A) so enumeration tools don't mistake wildcards for real hosts.
0065. **Wildcard-exclusion wordlist filtering** — filter brute-force results through the measured wildcard signature to eliminate false positives at scale.
0066. **Email MX infrastructure mapping** — enumerate MX hosts and their resolved IPs to map the org's mail infrastructure and adjacent webmail portals.
0067. **SPF include-chain expansion** — recursively expand SPF include mechanisms to list every third-party mail sender, each a potential subdomain-spoofing or takeover surface.
0068. **DMARC rua/ruf mailbox mining** — extract report mailbox domains from DMARC records to discover mail-handling subdomains and outsourced security vendors.
0069. **BIMI record asset discovery** — parse BIMI DNS records for logo-hosting URLs that reveal marketing-asset subdomains and CDN hosts.
0070. **MTA-STS policy host extraction** — fetch MTA-STS policies to enumerate MX hostnames the org declares, including ones missing from MX records.
0071. **TLS-RPT endpoint discovery** — read TLS-RPT records for report URIs that expose monitoring and aggregation endpoints.
0072. **Package-registry forgotten-project discovery** — search npm/PyPI/RubyGems for package names matching the target brand whose repository URLs point at hosts, revealing forgotten project infrastructure.
0073. **npm maintainer-domain pivoting** — pivot on npm maintainer emails to find packages whose homepages reference target subdomains.
0074. **Container-registry namespace mining** — enumerate public container registries for the org's namespace to find image names that encode service and environment hostnames.
0075. **Docker Hub automated-build log mining** — parse public Docker build logs for hostnames baked into images at build time.
0076. **Certificate OCSP responder host mapping** — extract OCSP and CRL URLs from target certificates to map PKI infrastructure hosts.
0077. **LDAP SRV record enumeration** — query _ldap._tcp SRV records to discover directory-service hosts in the target's DNS.
0078. **Kerberos SRV record harvesting** — enumerate _kerberos._tcp and _kpasswd SRV records to map authentication infrastructure.
0079. **SIP SRV record discovery** — query _sip._tcp/_udp SRV records to find VoIP infrastructure tied to the target domain.
0080. **XMPP SRV record enumeration** — harvest _xmpp-server SRV records to discover messaging infrastructure.
0081. **Autodiscover record probing** — check autodiscover, _autodiscover._tcp SRV, and related records to map mail-client configuration endpoints.
0082. **DKIM selector brute forcing** — brute-force common DKIM selectors as TXT records to discover mail-signing infrastructure and its hostnames.
0083. **ADSP legacy record check** — query obsolete ADSP records that sometimes linger and reference old mail infrastructure.
0084. **SSHFP record host harvesting** — collect SSHFP records to enumerate hosts offering SSH, each a candidate for further fingerprinting.
0085. **TLSA record service mapping** — read TLSA records to find hosts with DANE deployments and their associated ports.
0086. **NAPTR service discovery** — parse NAPTR records for SIP, SIPS, and other service mappings tied to the domain.
0087. **LOC record facility inference** — read DNS LOC records to geolocate facilities and correlate with known office and datacenter assets.
0088. **RP record contact mining** — extract responsible-person mailbox names from RP records for OSINT pivoting on admin identities.
0089. **AFSDB record legacy mapping** — query AFSDB records that sometimes reference forgotten file-service hosts.
0090. **DNAME redirection chain following** — follow DNAME redirections to discover aliased subtrees the target uses for migrations.
0091. **DNSSEC DS-chain parent probing** — walk DS records up the delegation chain to find intermediate zone cuts that hide delegated subdomains.
0092. **Empty-non-terminal label enumeration** — detect empty non-terminals in DNS responses to infer the existence of deeper labels below them.
0093. **DNS label-count depth probing** — probe increasing label depths to find deeply nested internal names like a.b.c.internal.example.com.
0094. **Underscore-label service mining** — enumerate underscore-prefixed labels (_dmarc, _acme-challenge, _github-challenge) that expose service integrations.
0095. **ACME-challenge TXT residue** — query _acme-challenge labels for leftover TXT records that reveal which hosts recently requested certificates.
0096. **GitHub-challenge TXT discovery** — check _github-challenge TXT records that prove domain verification for GitHub Pages, exposing Pages-backed hosts.
0097. **Atlassian domain-verification TXT mining** — harvest _atlassian-domain-verification records that confirm SaaS tenancies tied to subdomains.
0098. **Google site-verification TXT enumeration** — collect google-site-verification TXT tokens to map Search Console-verified properties.
0099. **Bing site-verification record scan** — enumerate msvalidate TXT records for the same property-mapping purpose.
0100. **Facebook domain-verification TXT harvest** — collect facebook-domain-verification tokens that reveal Business Manager-linked domains.
0101. **Apple app-site-association host mining** — fetch .well-known/apple-app-site-association files to extract applinks domains that reveal mobile-linked web hosts.
0102. **Assetlinks.json host extraction** — parse .well-known/assetlinks.json for target package fingerprints and associated web domains.
0103. **Security.txt contact-host pivoting** — read security.txt files for contact URLs and policy links that point at security-team subdomains.
0104. **Humans.txt team-host leaks** — parse humans.txt for team site URLs and internal tool references.
0105. **Ads.txt seller-domain mapping** — harvest ads.txt seller domains and reseller entries that expose ad-tech partner subdomains.
0106. **App-ads.txt mobile host mapping** — parse app-ads.txt for developer domains linked to the org's mobile inventory.
0107. **Browserconfig.xml tile-URL mining** — extract tile image URLs from browserconfig.xml that reference CDN and asset hosts.
0108. **Manifest.json start-url analysis** — parse web app manifests for start_url, scope, and icon URLs that reveal PWA backend hosts.
0109. **OpenSearch description host extraction** — fetch opensearch.xml files for search URL templates pointing at search-service hosts.
0110. **Crossdomain.xml policy host mining** — parse crossdomain.xml for permitted domains that disclose partner and internal Flash-era hosts.
0111. **Clientaccesspolicy.xml domain mining** — extract allowed domains from Silverlight policy files that linger on legacy hosts.
0112. **Well-known change-password discovery** — probe .well-known/change-password redirects to map identity-provider hosts.
0113. **OpenID configuration host extraction** — fetch .well-known/openid-configuration to enumerate issuer, jwks_uri, and endpoint hosts of the identity provider.
0114. **OAuth authorization-server metadata mining** — parse .well-known/oauth-authorization-server documents for token and revocation endpoint hosts.
0115. **WebFinger host enumeration** — query WebFinger for acct: URIs to discover profile and federation hosts.
0116. **Nodeinfo federation host discovery** — fetch nodeinfo documents on suspected fediverse hosts to confirm and map federated instances.
0117. **Host-meta XRD mining** — parse host-meta XRD files for LRDD templates that reveal user-profile service hosts.
0118. **CalDAV/CardDAV well-known probing** — probe .well-known/caldav and carddav to discover groupware hosts.
0119. **Autoconfig XML host extraction** — fetch Thunderbird-style autoconfig XML files that list IMAP/SMTP hostnames.
0120. **Mobileconfig profile host mining** — parse Apple mobileconfig profiles for VPN, mail, and MDM server hostnames.
0121. **PAC file host extraction** — download proxy auto-config files and extract every host mentioned in proxy rules.
0122. **WPAD.dat internal host leaks** — fetch wpad.dat files whose proxy logic often names internal hosts and domains.
0123. **NTP server pool inference** — extract NTP server hostnames from time-sync configs exposed on hosts to map infrastructure time sources.
0124. **SNMP sysName harvesting** — read SNMP sysName/sysDescr from discovered agents to collect device hostnames.
0125. **LLDP/CDP neighbor disclosure** — where accessible, read link-layer neighbor tables to learn adjacent device hostnames.
0126. **mDNS .local name harvesting** — capture multicast DNS announcements to enumerate .local hostnames on adjacent networks.
0127. **NetBIOS name table mining** — query NetBIOS name services for registered machine names tied to the target org.
0128. **WINS server record extraction** — pull WINS database entries that map legacy Windows hostnames to IPs.
0129. **DNS-SD service browsing** — browse DNS service-discovery records to enumerate advertised services and their hosts.
0130. **UPnP device description mining** — fetch UPnP device XML descriptions for friendly names, model URLs, and presentation hosts.
0131. **SSDP M-SEARCH host discovery** — send SSDP discovery multicasts to enumerate responding devices and their description URLs.
0132. **WS-Discovery probe mining** — use WS-Discovery probes to find announcing endpoints and their XAddrs hostnames.
0133. **BGP looking-glass prefix sweep** — query public looking glasses for the target's prefixes and sweep announced-but-unscanned space.
0134. **Route-views MRT archive mining** — mine historical MRT dumps for prefixes the target announced in the past to find decommissioned-but-live netblocks.
0135. **PeeringDB network record mining** — extract PeeringDB net entries for the org's ASNs to find exchange points and facility hints.
0136. **PeeringDB IX participant pivoting** — list co-participants at the same exchanges to find partner networks worth pivoting into.
0137. **ARIN WHOIS net-handle traversal** — walk RIR net handles up and down the allocation tree to find sibling netblocks under the same org.
0138. **RIPE database person-object pivoting** — pivot on RIPE person/role objects to find other resources maintained by the same admins.
0139. **APNIC reverse-DNS delegation mapping** — map reverse-DNS delegations in APNIC space to find delegated sub-zones with distinct hostnames.
0140. **LACNIC resource history mining** — check LACNIC transfer logs for netblocks the org acquired or sold.
0141. **AFRINIC allocation list sweep** — sweep AFRINIC allocation lists for the org's newer African PoP netblocks.
0142. **RIR abuse-contact domain pivoting** — pivot on abuse-mailbox domains in RIR objects to find security-team infrastructure.
0143. **SSL certificate serial-number sequencing** — track sequential serial numbers from the same CA account to predict and probe the next issued hostnames.
0144. **CT log Merkle-tree consistency mining** — use consistency proofs to detect CT log forks or missing entries that hide certificate issuance.
0145. **CT precert poison-extension analysis** — analyze precertificate poison extensions to link precerts with final certs and their issuance timing.
0146. **Certificate authority-account URL mining** — extract ACME account URIs from certificate metadata where exposed to pivot on the issuing account.
0147. **SCT embedded-timestamp ordering** — order certificates by embedded SCT timestamps to reconstruct the exact sequence of infrastructure rollouts.
0148. **Multi-CT-log coverage cross-validation** — query all major CT logs and diff coverage to catch certificates visible in only one log.
0149. **Google Transparency Report pivoting** — use certificate search UIs to pivot on issuer, SAN, and validity windows for brand variants.
0150. **Censys certificate-index hostname pull** — pull every hostname ever seen in certificates for the target's IPs from certificate indexes.
0151. **Censys banner-hostname extraction** — extract hostnames from service banners (SMTP, FTP, SSH) indexed for the target's netblocks.
0152. **Shodan hostname-field aggregation** — aggregate the hostnames field across all Shodan records for the target's IPs and ASNs.
0153. **Shodan SSL-cert subject harvesting** — harvest certificate subjects from Shodan's SSL index for target netblocks.
0154. **Shodan HTTP-title clustering** — cluster HTTP titles across the target's IPs to find same-application deployments on unexpected hosts.
0155. **Fofa cert-subject pivoting** — pivot on certificate subjects in Fofa to expand from one known host to all hosts sharing certs.
0156. **Fofa banner-fingerprint expansion** — expand from a known banner to all matching hosts in Fofa within the target's ASNs.
0157. **ZoomEye app-component mapping** — use ZoomEye app/component fingerprints to find all deployments of the target's stack in their netblocks.
0158. **ZoomEye subdomain-field harvesting** — harvest subdomain fields from ZoomEye host records tied to the target org.
0159. **BinaryEdge sensor-data pivoting** — pivot on BinaryEdge's IP and domain datasets to correlate target assets.
0160. **Onyphe geolocation-ASN expansion** — expand from known IPs via Onyphe's ASN and geolocation correlations.
0161. **Netlas certificate SAN pull** — pull SAN lists from Netlas for target IPs to find co-hosted domains.
0162. **FullHunt attack-surface import** — import FullHunt's pre-mapped attack surface for the target domain as a seed list.
0163. **LeakIX service-index pivoting** — pivot on LeakIX's indexed services to find target subdomains with exposed software.
0164. **GreyNoise benign-IP filtering** — use GreyNoise to filter internet-scanner IPs out of logs so real asset traffic stands out.
0165. **URLScan.io domain-page harvesting** — harvest URLs from urlscan.io scans of the target to find subdomains and endpoints users actually visited.
0166. **URLScan screenshot-DOM host extraction** — extract host references from urlscan DOM snapshots and network request lists.
0167. **VirusTotal subdomain enumeration** — pull VirusTotal's subdomain list for the target domain as a passive enumeration source.
0168. **VirusTotal URL corpus mining** — mine VirusTotal's URL corpus for target-domain URLs submitted by analysts.
0169. **VirusTotal certificate pivot** — pivot on VirusTotal's certificate relationships to find related domains.
0170. **SecurityTrails DNS-history mining** — mine SecurityTrails historical DNS to find subdomains that existed in the past and may still resolve.
0171. **SecurityTrails reverse-IP expansion** — expand via reverse-IP to co-hosted domains, then filter by org signals.
0172. **RiskIQ passive-DNS pivoting** — pivot on RiskIQ/Micorosft passive DNS resolutions to expand the asset graph.
0173. **Recorded Future domain-risk pivoting** — use domain-risk feeds to find lookalike domains registered around the same campaigns.
0174. **DomainTools reverse-IP mining** — mine DomainTools reverse-IP data for co-hosted names on target IPs.
0175. **DomainTools Iris pivot graph** — pivot on shared IPs, emails, and nameservers in Iris to find related domains.
0176. **WhoisXML API bulk expansion** — bulk-expand via WhoisXML's reverse-IP and reverse-WHOIS APIs for large netblocks.
0177. **Farsight DNSDB flex-search** — use DNSDB flexible regex searches for patterns like *.staging under the target domain.
0178. **DNSDB RRSIG-coverage analysis** — analyze DNSSEC signature coverage in DNSDB to find signed names never seen in forward DNS.
0179. **Mnemonic passive-DNS wildcard search** — run wildcard searches in Mnemonic's passive DNS for deep label patterns.
0180. **Circl passive-DNS SSL correlation** — correlate CIRCL passive DNS with passive SSL to link IPs, certs, and names.
0181. **DNSRepo history mining** — mine DNSRepo's historical records for deleted subdomains that may still have dangling DNS.
0182. **DNSHistory.org change tracking** — track DNS history diffs over time to catch newly added or removed subdomains.
0183. **DNSDumpster graph expansion** — use DNSDumpster's mapping output as a seed and recursively expand each discovered host.
0184. **HackerTarget reverse-IP sweep** — sweep reverse-IP lookups across target netblocks via public APIs with result dedup.
0185. **ViewDNS.info tool-chain automation** — automate ViewDNS's reverse-IP, IP-history, and port-scan tools into one asset pipeline.
0186. **DNSChecker propagation-differential mining** — compare propagation-checker results across global resolvers to spot inconsistent answers hiding hosts.
0187. **WhatsMyDNS record-type sweep** — sweep every record type through propagation checkers to find records visible only in some regions.
0188. **BGP.he.net prefix-tree expansion** — expand the target's prefix tree from BGP.he.net and sweep child prefixes.
0189. **IPinfo ASN-hostname correlation** — correlate IPinfo's ASN and hostname data to expand from IPs to names.
0190. **IP-API reverse-pointer bulk pull** — bulk-pull reverse pointers for target netblocks via IP geolocation APIs.
0191. **MaxMind ASN-org name matching** — match org names in MaxMind data to find netblocks registered under brand variants.
0192. **DB-IP ASN expansion** — expand ASN lists via DB-IP's org-to-ASN mappings.
0193. **IP2Location netblock-to-org mapping** — map netblocks to org names to catch acquisitions under different legal entities.
0194. **Team Cymru IP-to-ASN bulk** — bulk-resolve target IPs to ASNs to confirm ownership boundaries before sweeping.
0195. **RIPEstat data-API prefix mining** — mine RIPEstat's data APIs for announced prefixes, routing history, and DNS chains.
0196. **RIPEstat reverse-DNS chain walk** — walk reverse-DNS chains via RIPEstat to find delegated sub-zones.
0197. **RIPE Atlas measurement targeting** — use RIPE Atlas probes to resolve target names from diverse vantage points and catch geo-split DNS.
0198. **RIPE Atlas DNS-chain visualization** — trace full DNS resolution chains from Atlas probes to uncover hidden CNAME hops.
0199. **Certificate-transparency honeytoken planting** — plant canary subdomains and watch CT logs for scanners that enumerate them, mapping adversary infrastructure.
0200. **DNS canary-token deployment** — deploy canary DNS records and monitor query sources to detect third-party enumeration of the target.
0201. **Common Crawl CDX subdomain mining** — query Common Crawl's CDX index for URLs under the target domain to extract subdomains from petabytes of crawled pages.
0202. **Common Crawl WARC header mining** — parse WARC response headers from Common Crawl for redirect chains that reveal alternate hosts.
0203. **Wayback Machine CDX wildcard pull** — pull the full Wayback CDX listing for *.target.com to enumerate every historically seen subdomain and URL.
0204. **Wayback timemap diff analysis** — diff Wayback captures over time to find subdomains that appeared or vanished, prioritizing vanished ones for dangling-DNS checks.
0205. **Wayback redirect-chain host extraction** — extract hosts from archived redirect chains that point at old infrastructure.
0206. **Arquivo.pt historical host mining** — mine the Portuguese web archive for target-domain captures that other archives missed.
0207. **UK Web Archive domain search** — search the UK Web Archive for target brand domains with different coverage than Wayback.
0208. **Bing cached-page host extraction** — scrape Bing's cached copies for absolute URLs referencing subdomains removed from live pages.
0209. **Yandex indexed-host harvesting** — harvest Yandex-indexed hosts under the target, since Yandex indexes different slices of the web.
0210. **Baidu indexed-subdomain pull** — pull Baidu-indexed subdomains for targets with APAC presence that Western engines miss.
0211. **DuckDuckGo HTML-endpoint scraping** — scrape DuckDuckGo's HTML endpoint with site: queries to enumerate indexed subdomains without API limits.
0212. **Brave Search Goggles host mining** — use Brave Search to find target subdomains with independent index coverage.
0213. **Mojeek independent-index dorking** — dork Mojeek's independent index for subdomains missed by major engines.
0214. **Marginalia old-web host discovery** — search Marginalia's index for text-heavy legacy subdomains like docs and wikis.
0215. **GitHub commit-email domain pivoting** — pivot on committer email domains in org repos to find corporate domains beyond the primary brand.
0216. **GitHub org-member domain analysis** — analyze public org members' profile domains and commit patterns to find subsidiary brands.
0217. **GitHub Pages CNAME file mining** — scan repos for CNAME files that map GitHub Pages sites to custom target subdomains.
0218. **GitHub Dependabot config host leaks** — parse dependabot.yml files for private registry URLs pointing at internal hosts.
0219. **GitHub Codespaces port-forward URLs** — mine public devcontainer configs for forwarded-port URL patterns that reveal staging hosts.
0220. **GitHub issue-attachment URL mining** — extract hostnames from image and file URLs in public issue threads.
0221. **GitLab CI variable host leaks** — parse public .gitlab-ci.yml files for environment URLs and registry hosts.
0222. **Bitbucket repo host mining** — mine public Bitbucket repos for target hostnames in configs and docs.
0223. **SourceForge project host extraction** — check SourceForge projects under the org's name for download and homepage hosts.
0224. **PyPI project-URL host mining** — extract Project-URL and Home-page fields from the org's PyPI packages to find docs and demo hosts.
0225. **npm package homepage pivoting** — pivot on npm package homepage and repository fields to map the org's web properties.
0226. **Go module proxy host extraction** — inspect Go module paths and proxy URLs for org-owned vanity import domains.
0227. **Maven Central POM URL mining** — parse POM files for project URLs and SCM connections naming org hosts.
0228. **NuGet package host extraction** — mine NuGet package metadata for project URLs tied to the target org.
0229. **Packagist repo host mining** — extract repository URLs from the org's Packagist packages.
0230. **Hex.pm package host extraction** — mine Hex package metadata for docs and repo hosts.
0231. **Crates.io repo URL pivoting** — pivot on crates.io repository fields to find org GitHub/GitLab hosts and their Pages sites.
0232. **Terraform registry module mining** — inspect public Terraform modules for provider endpoints and backend hosts.
0233. **Helm chart values host extraction** — parse public Helm charts for ingress hosts and service endpoints.
0234. **Ansible Galaxy role host mining** — mine Ansible roles for inventory hostnames and callback URLs.
0235. **Chef Supermarket cookbook mining** — extract node and server references from public Chef cookbooks.
0236. **Puppet Forge module host mining** — parse Puppet modules for master and fileserver hostnames.
0237. **Chrome Web Store developer pivoting** — pivot on the org's Chrome extensions to find update URLs and support-site hosts.
0238. **Firefox add-on host extraction** — mine Firefox add-on manifests for update and homepage hosts.
0239. **VS Code marketplace publisher pivoting** — pivot on the org's VS Code publisher page for repository and support hosts.
0240. **Atlassian Marketplace vendor mining** — extract vendor URLs from the org's Atlassian apps to map web properties.
0241. **Salesforce AppExchange listing mining** — mine AppExchange listings for the org's support and demo hosts.
0242. **ServiceNow store app host extraction** — extract support URLs from ServiceNow store listings.
0243. **Slack app directory host mining** — mine Slack app listings for redirect URLs and support hosts.
0244. **Teams app manifest host extraction** — parse Teams app manifests for tab and bot endpoint hosts.
0245. **Zoom Marketplace app mining** — extract OAuth redirect and webhook hosts from Zoom app listings.
0246. **OAuth app-store redirect mining** — mine public OAuth app directories for registered redirect URIs that enumerate callback hosts.
0247. **Status-page subdomain enumeration** — find the org's status page (status.*, statuspage.io) and extract component hostnames from its API.
0248. **Statuspage.io component API mining** — query the public Statuspage API for components that name internal services and hosts.
0249. **Instatus page host extraction** — parse Instatus pages for monitored service hostnames.
0250. **Cachet instance discovery** — find the org's Cachet status instances and read their component lists.
0251. **UptimeRobot public dashboard mining** — read public UptimeRobot dashboards for monitored hostnames.
0252. **Pingdom public report host extraction** — extract hostnames from public Pingdom uptime reports.
0253. **Datadog public dashboard mining** — parse public Datadog dashboards for host and service names.
0254. **Grafana public snapshot mining** — read public Grafana snapshots whose legends and queries name hosts.
0255. **Kibana public dashboard host leaks** — extract index patterns and host fields from publicly shared Kibana dashboards.
0256. **Netlify site-name enumeration** — discover Netlify-deployed sites via DNS CNAME patterns and Netlify's naming conventions.
0257. **Vercel deployment alias mining** — mine Vercel deployment aliases and _vercel CNAME targets for preview hosts.
0258. **Cloudflare Pages project discovery** — find Cloudflare Pages projects via pages.dev naming and custom-domain mappings.
0259. **GitHub Pages subdomain mapping** — map github.io user/org sites to custom domains via CNAME files and DNS.
0260. **GitLab Pages host discovery** — discover GitLab Pages sites through gitlab.io naming and custom-domain records.
0261. **Heroku app-name brute forcing** — probe herokuapp.com names derived from the brand to find forgotten Heroku apps with dangling DNS.
0262. **Render service-name enumeration** — enumerate onrender.com service names matching brand patterns.
0263. **Railway deployment host mining** — mine up.railway.app deployments for brand-derived service names.
0264. **Fly.io app-name discovery** — discover fly.dev apps via brand-derived names and DNS history.
0265. **DigitalOcean App Platform host mining** — find ondigitalocean.app hosts tied to the org via naming and certificate data.
0266. **AWS Elastic Beanstalk URL mining** — enumerate elasticbeanstalk.com environments from brand patterns and CT logs.
0267. **AWS S3 bucket-name permutation** — test S3 bucket names derived from the brand and subdomains, since bucket names often mirror hosts.
0268. **Azure Blob storage account mining** — enumerate Azure storage account names from brand patterns to find storage-backed hosts.
0269. **GCP storage bucket enumeration** — probe storage.googleapis.com bucket names derived from the brand.
0270. **CloudFront distribution discovery** — find CloudFront distributions via DNS and certificate data, then map their origins.
0271. **Azure Front Door host mapping** — discover Azure Front Door frontends and their backend pools via DNS and headers.
0272. **Fastly service host discovery** — map Fastly services through CNAME patterns and edge hostnames.
0273. **Akamai edge-hostname mining** — extract Akamai edge hostnames (edgesuite, edgekey) from DNS to map CDN-backed properties.
0274. **Incapsula/Imperva CNAME mining** — find Incapsula-protected hosts via their distinctive CNAME patterns.
0275. **Sucuri firewall host discovery** — identify Sucuri-fronted hosts via DNS and firewall headers.
0276. **WordPress.com subdomain mapping** — map wordpress.com and wpengine subdomains used for the org's blogs and marketing.
0277. **HubSpot COS host discovery** — find HubSpot-hosted marketing pages via hs-sites.com patterns and CT logs.
0278. **Marketo landing-page host mining** — discover Marketo landing-page hosts via mkto patterns.
0279. **Pardot tracker-domain enumeration** — enumerate Pardot tracker domains (go.*) from DNS and page source.
0280. **Mailchimp landing-page host mining** — find Mailchimp-hosted pages via mailchi.mp and list-manage patterns.
0281. **SendGrid click-tracking host discovery** — identify SendGrid click-tracking subdomains from email headers and DNS.
0282. **Zendesk help-center host mapping** — map zendesk.com help-center subdomains to the org via CNAME and branding.
0283. **Intercom messenger host discovery** — find Intercom-backed chat hosts via widget snippets and DNS.
0284. **Drift chat host enumeration** — discover Drift chat endpoints from page snippets and DNS.
0285. **Freshdesk portal host mapping** — map freshdesk.com portals to the org via CNAME records.
0286. **Service desk SaaS CNAME audit** — audit all SaaS helpdesk CNAMEs for dangling targets after contract churn.
0287. **LMS platform host discovery** — find Teachable/Thinkific/Kajabi course hosts tied to the org's training brand.
0288. **Webinar platform host mining** — discover Zoom webinar, GoToWebinar, and Demio hosts linked to the org.
0289. **Podcast hosting host extraction** — extract media host URLs from the org's podcast RSS feeds.
0290. **Video platform channel host mining** — map Wistia/Vidyard/Vimeo hosts used for the org's embedded videos.
0291. **CDN video-manifest host extraction** — parse HLS/DASH manifests for segment hosts that reveal media CDN infrastructure.
0292. **Live-stream RTMP host discovery** — find RTMP ingest hosts from streaming configs in page source.
0293. **Careers-page ATS host mapping** — map applicant-tracking hosts (Greenhouse, Lever, Workable) via careers-page CNAMEs.
0294. **Greenhouse board-token host extraction** — extract Greenhouse board tokens to enumerate job-board API hosts.
0295. **Lever postings API host mining** — query Lever's postings API for the org to find its careers hosts.
0296. **Investor-relations platform host discovery** — find Q4/Notified IR hosts via investor-page links.
0297. **Press-release wire host mining** — extract canonical hosts from press-release wire distributions.
0298. **Trademark database domain pivoting** — pivot on trademark filings to find defensive and brand-protection domains the org owns.
0299. **Certificate-brand watchlist automation** — maintain an automated CT watchlist for every brand variant and alert on new issuance in real time.
0300. **New-gTLD brand-variant sweep** — sweep new gTLDs for exact brand matches and near-variants that could be phishing or shadow IT.
0301. **Homoglyph domain registration check** — render brand variants in confusable Unicode scripts and check registration to catch IDN homograph squats.
0302. **Punycode variant enumeration** — enumerate xn-- punycode domains resembling the brand to find IDN-based phishing infrastructure.
0303. **ccTLD brand-protection audit** — check brand presence across major ccTLDs to find unprotected variants attackers could register.
0304. **Defensive-domain portfolio mapping** — map the org's known defensive registrations to distinguish them from attacker squats during triage.
0305. **Brand domain-auction watchlist** — monitor auction platforms for expiring domains matching brand patterns before attackers grab them.
0306. **Newly-registered-domain feed filtering** — filter NRD feeds for brand substrings daily to catch fresh phishing domains within hours of registration.
0307. **Phishing-kit hostname extraction** — extract C2 and exfil hostnames from phishing kits impersonating the brand to map attacker infrastructure.
0308. **Threat-intel brand-mention pivoting** — pivot on threat-intel reports mentioning the brand to find attacker domains for blocklist and takedown context.
0309. **Malware-config brand-host extraction** — extract brand-impersonating hosts from malware configs to separate attacker assets from org assets.
0310. **Sinkhole-data brand filtering** — filter sinkhole feeds for brand-like domains to catch active phishing campaigns early.
0311. **Email-authentication failure forensics** — analyze DMARC aggregate reports for unauthorized senders using brand subdomains.
0312. **Lookalike favicon detection** — find phishing sites copying the target's favicon via hash search to catch live impersonation.
0313. **Lookalike TLS-cert monitoring** — monitor CT logs for certs issued to lookalike domains to catch phishing sites at issuance.
0314. **Screenshot-based brand-impersonation sweep** — screenshot suspicious domains and compare visual layout to the target's site to confirm impersonation.
0315. **Subdomain permutation generation engine** — generate systematic permutations (prefix/suffix swaps, number increments) of every known subdomain and resolve them.
0316. **AI-generated subdomain guessing** — train a Markov/transformer model on the org's naming patterns to predict likely undiscovered subdomains.
0317. **Wordlist mutation with org jargon** — mutate generic wordlists with org-specific terms mined from job postings and press releases.
0318. **Job-posting tech-stack host mining** — extract hostnames and internal tool names from job descriptions to predict infrastructure.
0319. **Employee LinkedIn stack disclosure** — mine public employee profiles for named internal systems that hint at hostnames.
0320. **Conference-talk infrastructure disclosure** — extract architecture diagrams and hostnames from the org's conference talks and slides.
0321. **Engineering-blog endpoint disclosure** — mine engineering blog posts for API endpoints, hostnames, and architecture details.
0322. **OpenAPI spec host extraction** — fetch published OpenAPI/Swagger specs to enumerate servers, base URLs, and every documented path.
0323. **Postman public-workspace mining** — mine public Postman workspaces for the org's collections, environments, and base URLs.
0324. **Insomnia public-collection mining** — extract hosts from public Insomnia API collections.
0325. **API-changelog host tracking** — track API changelog pages for newly announced endpoints and their hosts.
0326. **Developer-portal sitemap mining** — crawl developer portal sitemaps for docs pages that document API hosts.
0327. **SDK release-notes endpoint tracking** — parse SDK changelogs for new endpoint URLs and deprecated hosts.
0328. **GraphQL introspection host discovery** — where introspection is open, extract schema types that name related services and hosts.
0329. **gRPC reflection service listing** — query gRPC reflection to list services whose names reveal backend hosts.
0330. **JSON-RPC method enumeration** — enumerate JSON-RPC methods that disclose backend service names.
0331. **WSDL service-address extraction** — parse WSDL files for soap:address locations naming SOAP hosts.
0332. **WADL resource host extraction** — parse WADL files for resource base URLs.
0333. **AsyncAPI broker host extraction** — parse AsyncAPI specs for message-broker hosts and channel names.
0334. **Service-mesh sidecar config leak mining** — probe for exposed Envoy/Istio admin and config-dump endpoints that list every upstream host.
## B. Port/service/fingerprinting innovations
0335. **Banner-ordering differential probes** — send identical probes with reordered options/headers and fingerprint services by how response ordering changes, distinguishing implementations behind identical banners.
0336. **Error-message differential fingerprinting** — trigger controlled errors (bad method, long URI, malformed headers) and fingerprint servers by exact error text and status-code choices.
0337. **HTTP/2 SETTINGS frame fingerprinting** — fingerprint HTTP/2 stacks by their SETTINGS frame values and order, which vary by server and version.
0338. **HTTP/2 WINDOW_UPDATE behavior profiling** — profile flow-control window behavior to distinguish CDN edge stacks from origins.
0339. **HTTP/3 QUIC handshake fingerprinting** — fingerprint QUIC stacks by version negotiation and transport-parameter ordering.
0340. **JA3 TLS client-hello cataloging** — catalog server-selected cipher suites across JA3 variants to fingerprint TLS terminators.
0341. **JA4/JA4H HTTP fingerprinting** — apply JA4/JA4H fingerprints to server responses to identify CDN and WAF layers.
0342. **JA4S server-hello fingerprinting** — fingerprint TLS servers by their ServerHello extensions and ordering.
0343. **TLS certificate-transparency timing analysis** — correlate certificate issuance timing with deployment events to fingerprint automated vs manual PKI.
0344. **SNI-based virtual-host discovery** — iterate SNI values on one IP to enumerate co-hosted TLS virtual hosts without DNS.
0345. **ALPN negotiation mapping** — test ALPN protocol lists per port to map which services (h2, h3, mqtt, custom) each endpoint offers.
0346. **TLS fallback-version probing** — probe deprecated TLS versions and weak ciphers to fingerprint legacy terminators and flag them.
0347. **Certificate-chain depth analysis** — analyze chain length and intermediate selection to fingerprint the issuing pipeline.
0348. **OCSP stapling behavior profiling** — profile OCSP stapling presence and freshness to distinguish CDN edges from origins.
0349. **Favicon MurmurHash3 service ID** — hash favicons with MurmurHash3 and match against a service-ID database to identify apps without banners.
0350. **Multi-path favicon harvesting** — fetch favicons from common alternate paths (/favicon.ico, /assets/, /static/) since apps hide them in different places.
0351. **Apple-touch-icon service correlation** — correlate apple-touch-icon images with known app icons for additional identification signal.
0352. **MQTT CONNECT handshake probing** — send MQTT CONNECT with varied client IDs to fingerprint brokers by CONNACK codes and behavior.
0353. **MQTT topic-enumeration via wildcard** — subscribe to # and $SYS/# where allowed to enumerate broker topics and version strings.
0354. **AMQP handshake version detection** — negotiate AMQP versions to fingerprint RabbitMQ vs other brokers by protocol-header responses.
0355. **AMQP management-plugin probing** — probe the AMQP management HTTP API to identify broker version and vhosts.
0356. **gRPC reflection probing** — call gRPC server reflection to list services and fingerprint the framework.
0357. **gRPC health-check probing** — query the standard gRPC health service to confirm liveness and infer deployment patterns.
0358. **RDP NLA handshake analysis** — analyze RDP negotiation (CredSSP vs native) to fingerprint Windows versions and gateways.
0359. **RDP cookie-field parsing** — parse RDP routing-token cookies that sometimes leak internal hostnames.
0360. **SMB protocol-negotiation fingerprinting** — negotiate SMB dialects to fingerprint Samba vs Windows and their versions.
0361. **SMB null-session share listing** — attempt null-session share enumeration where permitted to map exposed shares.
0362. **VNC handshake version parsing** — parse VNC RFB version strings and security types to fingerprint servers.
0363. **Redis INFO-command probing** — issue INFO to unauthenticated Redis instances to capture version and config (safe read-only probe).
0364. **Redis keyspace-sample analysis** — sample keyspace metadata to infer application purpose without reading values.
0365. **Memcached stats-slab analysis** — read Memcached stats to fingerprint version and usage patterns.
0366. **Elasticsearch cluster-health probing** — query /_cluster/health on exposed nodes to fingerprint version and cluster size.
0367. **Elasticsearch index-name harvesting** — list index names on exposed clusters since names reveal application data.
0368. **MongoDB hello-command fingerprinting** — send the hello/isMaster command to fingerprint MongoDB version and topology.
0369. **Postgres startup-packet analysis** — analyze Postgres startup responses to fingerprint version without authenticating.
0370. **MySQL handshake capability parsing** — parse MySQL initial handshake packets for version and capability flags.
0371. **LDAP rootDSE harvesting** — query rootDSE for naming contexts, supported controls, and vendor info.
0372. **SNMPv2c community-string rotation probe** — test a small set of common community strings read-only to identify devices (safe, non-intrusive).
0373. **SNMPv3 engine-ID fingerprinting** — fingerprint SNMPv3 agents by engine ID format to identify vendors.
0374. **CoAP resource-discovery probing** — query /.well-known/core on CoAP endpoints to enumerate IoT resources.
0375. **SIP OPTIONS capability probing** — send SIP OPTIONS to fingerprint PBX vendors by Allow headers and Server strings.
0376. **SIP REGISTER behavior analysis** — analyze REGISTER challenge responses to fingerprint SIP registrar implementations.
0377. **RTSP DESCRIBE method probing** — send RTSP DESCRIBE to fingerprint camera and media-server vendors.
0378. **RTSP transport-header analysis** — analyze SETUP transport responses to infer NAT and proxy topologies.
0379. **UDP service discovery via payload library** — match UDP responses against a payload library (DNS, NTP, SNMP, SSDP) to identify services without TCP.
0380. **UDP amplification-safety checks** — measure UDP response ratios to flag abusable reflectors without exploiting them.
0381. **IPv6 neighbor-discovery sweeping** — use IPv6 neighbor solicitation to enumerate live hosts on local-adjacent segments.
0382. **IPv6 router-advertisement analysis** — parse router advertisements to map prefixes, DNS servers, and network topology.
0383. **IPv6 SLAAC address-pattern inference** — analyze SLAAC address patterns to predict other hosts on the same segment.
0384. **Shodan API pivoting automation** — automate Shodan queries keyed by target IPs to pull banners, vulns, and hostnames into the asset graph.
0385. **Censys search-API correlation** — correlate Censys host and certificate records to expand from one IP to sibling services.
0386. **Fofa rule-based asset expansion** — expand assets using Fofa's fingerprint rules matched against target netblocks.
0387. **ZoomEye dork-driven discovery** — run ZoomEye dorks for the target's tech stack to find unlisted deployments.
0388. **WAF fingerprinting via header analysis** — identify WAF vendors by response headers, cookie names, and block-page markers.
0389. **WAF behavior-probing with canaries** — send benign canary payloads to map WAF block vs log behavior without attacking.
0390. **CDN edge-vs-origin differentiation** — differentiate CDN edge from origin by header, timing, and cache-behavior tests.
0391. **CDN cache-bypass probing** — use cache-busting techniques to reach origins and fingerprint the true backend stack.
0392. **Anycast vs unicast detection** — detect anycast deployments by latency triangulation from multiple vantage points.
0393. **Honeypot tarpitting detection** — detect tarpit behaviors (slow banners, fake services) and label them to avoid wasted effort.
0394. **Honeypot banner-anomaly flagging** — flag banners with honeypot-tool signatures to keep them out of the real asset inventory.
0395. **TCP/IP stack p0f-style fingerprinting** — fingerprint OSes by TCP SYN/ACK quirks (window size, options order, TTL).
0396. **TCP timestamp-clock skew analysis** — analyze TCP timestamp skew to estimate uptime and distinguish virtualized hosts.
0397. **IP ID sequence analysis** — analyze IP ID generation patterns to count hosts behind NAT and load balancers.
0398. **Service-version to CVE mapping** — map fingerprinted versions to known CVEs with exploitability context for prioritization.
0399. **CVE exploitability-check gating** — verify exploit prerequisites (reachability, auth requirements) before flagging a CVE as actionable.
0400. **Safe default-credential probes** — test a minimal set of vendor-default credentials on identified services using read-only logins only.
0401. **Screenshot-based service identification** — screenshot HTTP services and classify the application visually when banners are hidden.
0402. **Screenshot diffing for virtual hosts** — screenshot many hostnames on one IP and cluster visually to find distinct applications.
0403. **HTTP method enumeration** — test all methods (GET, POST, PUT, DELETE, PATCH, OPTIONS) per endpoint to map allowed verbs.
0404. **OPTIONS response Allow-header mining** — parse Allow headers from OPTIONS responses to enumerate supported methods.
0405. **TRACE method reflection test** — test TRACE for XST reflection behavior and proxy header leakage.
0406. **Method-override header testing** — test X-HTTP-Method-Override to find hidden verb handling.
0407. **Error-page stack-trace mining** — trigger 404/500 errors and mine stack traces for framework, paths, and versions.
0408. **Debug-mode error-page detection** — detect verbose debug error pages (Django, Laravel, Rails) that leak internals.
0409. **Timing-based service inference** — measure response-time distributions to infer backend languages and database round-trips.
0410. **TCP connect-timing OS inference** — infer OS from TCP handshake timing characteristics.
0411. **HTTP/2 rapid-reset behavior check** — observe HTTP/2 stream handling to fingerprint server implementations.
0412. **HTTP request-smuggling differential** — send ambiguous requests to detect frontend/backend desyncs (detection only, safe payloads).
0413. **Chunked-encoding behavior profiling** — profile chunked transfer handling to fingerprint proxies and servers.
0414. **Header-case sensitivity testing** — test header-name case handling to distinguish server frameworks.
0415. **Duplicate-header handling analysis** — analyze how servers merge or prioritize duplicate headers to fingerprint them.
0416. **HTTP whitespace-tolerance probing** — probe tolerance for whitespace anomalies in request lines to identify parsers.
0417. **HTTP version-fallback mapping** — test HTTP/1.0, 1.1, 2, 3 support per host to map protocol coverage.
0418. **Expect-100-continue behavior test** — test 100-continue handling to fingerprint server and proxy combinations.
0419. **Range-request behavior profiling** — test byte-range handling to identify servers and caching layers.
0420. **Conditional-request ETag analysis** — analyze ETag formats to fingerprint frameworks and detect inode leaks.
0421. **Set-Cookie attribute fingerprinting** — fingerprint frameworks by Set-Cookie naming, prefixes, and attributes.
0422. **Session-ID entropy analysis** — analyze session ID formats to identify generators and frameworks.
0423. **CSRF-token format identification** — identify frameworks by CSRF token structure and delivery.
0424. **JWT issuer fingerprinting** — fingerprint auth providers by JWT header claims and issuer URLs (no cracking).
0425. **OAuth discovery-document mining** — fetch OAuth metadata documents to map auth infrastructure.
0426. **SAML metadata host extraction** — parse SAML metadata for entity IDs and endpoint hosts.
0427. **WebSocket handshake analysis** — analyze WebSocket upgrade responses to fingerprint servers and frameworks.
0428. **Server-Sent Events endpoint detection** — detect SSE endpoints by content-type and stream behavior.
0429. **HTTP/3 discovery via Alt-Svc** — parse Alt-Svc headers to map HTTP/3 and alternate-service endpoints.
0430. **Alt-Svc alternate-port mapping** — enumerate alternate service ports advertised for each host.
0431. **HSTS preload-list checking** — check HSTS headers and preload status to infer security posture.
0432. **Security-header posture scoring** — score missing security headers as a fingerprint of maturity and framework defaults.
0433. **CORS preflight behavior mapping** — map CORS handling per endpoint to fingerprint frameworks and find misconfigs.
0434. **JSONP callback detection** — detect legacy JSONP endpoints by callback parameter reflection.
0435. **GraphQL endpoint fingerprinting** — identify GraphQL by introspection-shaped errors and typical paths.
0436. **REST framework error-shape analysis** — fingerprint REST frameworks by their error JSON shapes.
0437. **API version-header detection** — detect API versioning schemes from headers and URL patterns.
0438. **Rate-limit header analysis** — analyze rate-limit headers to identify gateway products (Kong, Apigee, AWS).
0439. **Gateway request-ID format mining** — mine request-ID formats to fingerprint API gateways.
0440. **Load-balancer cookie analysis** — identify load balancers by their persistence cookie names and formats.
0441. **Sticky-session behavior testing** — test session affinity to map load-balancer topologies.
0442. **Health-check endpoint discovery** — probe common health-check paths to confirm liveness and identify frameworks.
0443. **Readiness-probe output mining** — parse readiness probe outputs for dependency names and versions.
0444. **Prometheus metrics-endpoint discovery** — find exposed Prometheus /metrics endpoints to enumerate services and versions.
0445. **Prometheus label harvesting** — harvest metric labels for hostname, instance, and version data.
0446. **Expvar endpoint mining** — query Go expvar endpoints for package and version details.
0447. **Spring Boot actuator mapping** — enumerate Spring Boot actuator endpoints to fingerprint Java services.
0448. **Actuator env-redaction testing** — check actuator endpoint exposure levels to classify information disclosure.
0449. **Django debug-toolbar detection** — detect Django debug toolbar endpoints that leak query and config data.
0450. **Rails info-route detection** — detect Rails info routes that expose routes and app metadata.
0451. **Laravel Telescope exposure check** — check for exposed Laravel Telescope dashboards.
0452. **Symfony profiler detection** — detect Symfony profiler endpoints leaking request data.
0453. **PHP info-page discovery** — find phpinfo pages that disclose full server configuration.
0454. **Server-status page detection** — detect Apache server-status pages leaking worker and request data.
0455. **Nginx status-module detection** — detect nginx stub_status endpoints.
0456. **Tomcat manager probing** — probe Tomcat manager paths to fingerprint version via error pages.
0457. **JMX console exposure check** — check for exposed JMX consoles on Java services.
0458. **Kubernetes API anonymous check** — test for anonymously accessible Kubernetes API endpoints.
0459. **etcd unauthenticated probing** — probe etcd endpoints for unauthenticated version and key access.
0460. **Consul agent HTTP probing** — query Consul agent endpoints for datacenter and node data.
0461. **Nomad API exposure check** — check Nomad API endpoints for version and job data.
0462. **Vault status probing** — query Vault status endpoints for seal state and version.
0463. **Docker daemon socket probing** — test for exposed Docker API sockets via HTTP.
0464. **Portainer instance detection** — detect Portainer management UIs by title and API shape.
0465. **Jenkins script-console check** — check Jenkins instances for exposed script consoles.
0466. **GitLab runner registration probing** — probe GitLab runner registration endpoints for version disclosure.
0467. **SonarQube instance fingerprinting** — fingerprint SonarQube by its API version endpoints.
0468. **Nexus repository detection** — detect Nexus repos by their REST API version responses.
0469. **Artifactory instance identification** — identify Artifactory by its system-info endpoints.
0470. **Harbor registry detection** — detect Harbor registries by their API version responses.
0471. **MinIO console detection** — detect MinIO consoles by their login page and API.
0472. **phpMyAdmin version fingerprinting** — fingerprint phpMyAdmin by its login page assets and version strings.
0473. **Adminer instance detection** — detect Adminer database UIs by their distinctive single-file signatures.
0474. **Mongo Express detection** — detect mongo-express UIs by page title and routes.
0475. **Redis Commander detection** — detect Redis Commander web UIs.
0476. **pgAdmin instance discovery** — discover pgAdmin deployments by their login flow.
0477. **Elasticsearch Kibana correlation** — correlate Kibana versions with Elasticsearch clusters.
0478. **Grafana version fingerprinting** — fingerprint Grafana by its frontend asset hashes and API.
0479. **Prometheus UI detection** — detect Prometheus UIs by their query API shape.
0480. **Zabbix frontend detection** — detect Zabbix frontends by login page signatures.
0481. **Nagios/Icinga UI fingerprinting** — fingerprint monitoring UIs by their page structures.
0482. **Splunk web detection** — detect Splunk web interfaces by their login flow.
0483. **Kibana spaces enumeration** — enumerate Kibana spaces that reveal team and project names.
0484. **Jupyter notebook server detection** — detect Jupyter servers by their token-auth pages.
0485. **RStudio server detection** — detect RStudio servers by their login signatures.
0486. **Airflow UI fingerprinting** — fingerprint Airflow by its REST API version endpoints.
0487. **MLflow tracking-server detection** — detect MLflow servers by their experiment APIs.
0488. **Kubeflow dashboard detection** — detect Kubeflow central dashboards.
0489. **TensorBoard instance detection** — detect TensorBoard instances by their data APIs.
0490. **Weaviate/Qdrant vector-DB detection** — detect vector databases by their REST API shapes.
0491. **Neo4j browser detection** — detect Neo4j browsers by their Bolt/HTTP handshake.
0492. **RabbitMQ management detection** — detect RabbitMQ management UIs by their API overview.
0493. **Kafka REST proxy detection** — detect Kafka REST proxies by their topic-listing APIs.
0494. **NATS monitoring detection** — detect NATS monitoring endpoints.
0495. **MQTT WebSocket detection** — detect MQTT-over-WebSocket endpoints.
0496. **OPC-UA endpoint discovery** — discover OPC-UA endpoints by their discovery service.
0497. **Modbus TCP banner probing** — probe Modbus TCP for device identification registers (read-only).
0498. **BACnet device discovery** — discover BACnet devices via Who-Is broadcasts.
0499. **DNP3 outstation probing** — probe DNP3 outstations for device attributes (read-only).
0500. **IEC-60870-5-104 endpoint probing** — probe IEC-104 endpoints for ASDU responses.
0501. **S7comm PLC identification** — identify Siemens PLCs via S7comm SZL reads (read-only identification).
0502. **EtherNet/IP device listing** — list EtherNet/IP devices via CIP identity objects.
0503. **Profinet DCP discovery** — discover Profinet devices via DCP identify multicasts.
0504. **FTP banner nuance analysis** — fingerprint FTP servers by banner quirks and FEAT responses.
0505. **FTP SITE-command probing** — probe FTP SITE commands to identify server extensions.
0506. **SSH version-string cataloging** — catalog SSH version strings to map OpenSSH vs vendor implementations.
0507. **SSH KEX-algorithm fingerprinting** — fingerprint SSH servers by key-exchange algorithm ordering.
0508. **SSH host-key type analysis** — analyze offered host-key types to infer server age and config.
0509. **Telnet option-negotiation fingerprinting** — fingerprint Telnet servers by option negotiation sequences.
0510. **SMTP banner EHLO analysis** — fingerprint mail servers by EHLO capability responses.
0511. **SMTP VRFY/EXPN behavior check** — test VRFY/EXPN responses to classify user-enumeration posture.
0512. **STARTTLS stripping detection** — detect servers that advertise but mishandle STARTTLS.
0513. **IMAP CAPABILITY fingerprinting** — fingerprint IMAP servers by capability lists.
0514. **POP3 CAPA analysis** — analyze POP3 CAPA responses for server identification.
0515. **NNTP capability probing** — probe NNTP servers for capability-based fingerprinting.
0516. **IRC server version detection** — detect IRC servers by VERSION replies.
0517. **XMPP stream-feature analysis** — analyze XMPP stream features to fingerprint servers.
0518. **NTP mode-6 query analysis** — use NTP control queries where permitted to identify versions.
0519. **DNS version.bind probing** — query version.bind chaos records to fingerprint DNS software.
0520. **DNS EDNS compliance testing** — test EDNS compliance levels to fingerprint resolvers.
0521. **DNS QNAME-minimization detection** — detect QNAME minimization support to infer resolver software.
0522. **DNS aggressive-NSEC detection** — test aggressive NSEC caching to fingerprint validating resolvers.
0523. **mDNS service-type enumeration** — enumerate mDNS service types to map local service landscape.
0524. **DHCP fingerprinting via options** — fingerprint DHCP clients/servers by option-request ordering.
0525. **TFTP option-negotiation testing** — test TFTP option support to fingerprint servers.
0526. **NFS export-list probing** — list NFS exports where permitted to map file shares.
0527. **iSCSI target discovery** — discover iSCSI targets via SendTargets.
0528. **AFP server-info probing** — query AFP servers for version and UAM info.
0529. **SMB2 dialect-negotiation mapping** — map supported SMB2 dialects per host.
0530. **NetBIOS datagram analysis** — analyze NetBIOS datagram service responses for OS hints.
0531. **WSDAPI device probing** — probe Web Services Discovery for device metadata.
0532. **ONVIF device discovery** — discover ONVIF cameras via WS-Discovery.
0533. **RTSP auth-scheme analysis** — analyze RTSP auth schemes to fingerprint vendors.
0534. **SIP user-agent cataloging** — catalog SIP User-Agent strings across discovered PBXs.
0535. **H.323 gatekeeper discovery** — discover H.323 gatekeepers via RAS multicasts.
0536. **MGCP endpoint probing** — probe MGCP gateways for endpoint naming.
0537. **SCCP device identification** — identify Cisco SCCP phones by registration behavior.
0538. **Diameter capability-exchange analysis** — analyze Diameter CEA responses to fingerprint telecom nodes.
0539. **SS7 point-code inference** — infer SS7 topology from SIGTRAN handshake behavior.
0540. **GTP version probing** — probe GTP endpoints for version support.
0541. **PFCP node-report analysis** — analyze PFCP node reports from 5G user-plane functions.
0542. **CoAP observe-option testing** — test CoAP observe support to fingerprint IoT stacks.
0543. **MQTT-SN gateway detection** — detect MQTT-SN gateways via search-gateway multicasts.
0544. **LwM2M bootstrap probing** — probe LwM2M bootstrap servers for object listings.
0545. **Zigbee coordinator detection** — detect Zigbee coordinators via beacon requests.
0546. **Z-Wave node-info probing** — probe Z-Wave networks for node information frames.
0547. **Bluetooth SDP enumeration** — enumerate Bluetooth service discovery records.
0548. **BLE GATT service mapping** — map BLE GATT services to fingerprint IoT devices.
0549. **Wi-Fi beacon IE fingerprinting** — fingerprint APs by beacon information-element ordering.
0550. **EAP method-negotiation analysis** — analyze EAP negotiations to fingerprint RADIUS servers.
0551. **RADIUS status-server probing** — probe RADIUS status-server requests for version disclosure.
0552. **TACACS+ version detection** — detect TACACS+ by its distinctive header obfuscation.
0553. **Kerberos pre-auth analysis** — analyze Kerberos pre-authentication requirements to fingerprint KDCs.
0554. **NTLMSSP challenge parsing** — parse NTLMSSP challenges for OS and domain hints.
0555. **LDAP SASL-mechanism listing** — list SASL mechanisms to fingerprint directory servers.
0556. **AD Global Catalog detection** — detect AD Global Catalogs via port 3268 LDAP pings.
0557. **DNS SRV-based AD mapping** — map AD sites via _ldap._tcp SRV records.
0558. **Netlogon behavior analysis** — analyze Netlogon RPC behavior to fingerprint DCs.
0559. **SMB signing-requirement mapping** — map SMB signing requirements across hosts.
0560. **LLMNR/NBNS spoof-surface mapping** — detect LLMNR/NBNS responders to map spoofing surface (no spoofing performed).
0561. **WPAD PAC-file analysis** — analyze wpad.dat logic for internal host references.
0562. **Proxy auto-detect behavior** — test proxy auto-detection to find PAC infrastructure.
0563. **SOCKS version probing** — probe SOCKS proxies for version and auth methods.
0564. **HTTP proxy header-leak analysis** — analyze proxy-added headers (X-Forwarded-For chains) for topology hints.
0565. **Transparent-proxy header detection** — detect transparent proxies via IP TTL and header anomalies.
0566. **VPN concentrator fingerprinting** — fingerprint VPN concentrators by handshake behavior (IKE, OpenVPN, WireGuard).
0567. **IKE version-negotiation analysis** — analyze IKE_SA_INIT responses to fingerprint VPN gateways.
0568. **OpenVPN HMAC behavior probing** — probe OpenVPN tls-auth behavior to identify instances.
0569. **WireGuard handshake-initiation test** — test WireGuard handshake responses to confirm endpoints.
0570. **IPsec NAT-T detection** — detect NAT-T support to fingerprint IPsec gateways.
0571. **SSL-VPN portal detection** — detect SSL-VPN portals by login page signatures.
0572. **Citrix Gateway fingerprinting** — fingerprint Citrix gateways by their ICA and auth flows.
0573. **F5 BIG-IP version detection** — detect F5 devices by cookie formats and error pages.
0574. **Palo Alto GlobalProtect detection** — detect GlobalProtect portals by their prelogin endpoints.
0575. **Zscaler cloud-node mapping** — map Zscaler cloud nodes serving the target's users.
0576. **Cloudflare Warp egress mapping** — identify Cloudflare Warp egress IPs in logs to understand user paths.
0577. **Tor exit-node correlation** — correlate Tor exit nodes with login anomalies for account-takeover context.
0578. **CDN true-IP discovery via MX** — find origin IPs via MX records pointing outside the CDN.
0579. **CDN true-IP via SPF** — extract origin mail-server IPs from SPF records that bypass the CDN.
0580. **CDN true-IP via historical DNS** — pull pre-CDN A records from DNS history to find origin IPs.
0581. **CDN true-IP via certificate SANs** — find origin hostnames in certificate SANs that bypass CDN.
0582. **CDN true-IP via favicon hash** — match favicon hashes on non-CDN IPs to find origins serving identical apps.
0583. **CDN true-IP via error pages** — trigger errors that leak origin IPs or internal hostnames.
0584. **CDN true-IP via SSHFP** — use SSHFP records that sometimes point at origin hosts.
0585. **Cloud metadata-service detection** — detect cloud metadata endpoints reachable from SSRF-adjacent contexts (detection only).
0586. **Instance-identity document analysis** — analyze cloud instance-identity documents where exposed for account IDs.
0587. **Kubernetes kubelet probing** — probe kubelet read-only ports for pod listings.
0588. **Kubernetes API version disclosure** — read /version on K8s APIs for version fingerprinting.
0589. **Docker Registry v2 catalog** — query Docker registry catalogs for image listings.
0590. **Container image-layer analysis** — analyze image configs for embedded hostnames and secrets references.
0591. **Service-mesh mTLS fingerprinting** — fingerprint Istio/Linkerd by mTLS handshake characteristics.
0592. **Envoy admin-interface detection** — detect Envoy admin interfaces leaking clusters and routes.
0593. **Istio Pilot-discovery probing** — probe Istio discovery services for version disclosure.
0594. **Linkerd identity probing** — probe Linkerd identity services for trust-anchor info.
0595. **Consul Connect CA probing** — query Consul Connect CA endpoints for cluster info.
0596. **SPIFFE ID enumeration** — enumerate SPIFFE IDs where exposed to map service identities.
0597. **eBPF-based service mapping** — where an agent is deployed, use eBPF to map local service bindings.
0598. **NetFlow-based service inference** — infer services from flow records (ports, volumes, peers).
0599. **Darknet-telescope backscatter analysis** — analyze backscatter to the target's IPs for spoofed-attack context.
0600. **Sinkhole-query source analysis** — analyze which resolvers query sinkholed target domains to find infected clients.
0601. **DNS query-volume anomaly mapping** — map query volumes per subdomain from passive DNS to prioritize high-traffic assets.
0602. **Certificate-key reuse detection** — detect identical public keys across certificates to find cloned or migrated services.
0603. **TLS session-ticket analysis** — analyze session-ticket behavior to fingerprint TLS terminators.
0604. **HTTP/2 connection-coalescing test** — test connection coalescing to map which hosts share certificates and IPs.
0605. **HTTP/2 origin-frame analysis** — analyze ORIGIN frames to discover alternate origins for a host.
0606. **WebTransport endpoint detection** — detect WebTransport support to fingerprint modern edge stacks.
0607. **WebCodecs capability probing** — probe WebCodecs support as a browser-stack fingerprint (client-side context).
0608. **Client-hint response analysis** — analyze Accept-CH and Critical-CH headers to fingerprint server frameworks.
0609. **Viewport-based device fingerprinting** — use viewport and DPR signals to classify device-targeting infrastructure.
0610. **Font-fingerprinting service detection** — detect font-delivery services by their CSS API shapes.
0611. **Third-party script inventory** — inventory third-party scripts per page to map supply-chain dependencies.
0612. **Subresource-integrity gap analysis** — check SRI usage on third-party scripts to flag hijackable dependencies.
0613. **CSP report-uri endpoint mining** — extract report-uri endpoints that reveal security-monitoring infrastructure.
0614. **Feature-policy header analysis** — analyze Permissions-Policy headers to fingerprint frameworks.
0615. **Cross-origin-embedder-policy header mapping** — map COEP/COOP headers to infer isolation requirements and app types.
0616. **Service-worker scope analysis** — analyze service-worker scopes to map offline-capable app boundaries.
0617. **Web-app manifest icon harvesting** — harvest manifest icons for visual service identification.
0618. **Push-notification endpoint discovery** — discover push endpoints from service workers and manifests.
0619. **WebSocket subprotocol enumeration** — enumerate WebSocket subprotocols to fingerprint real-time frameworks.
0620. **Socket.IO handshake analysis** — analyze Socket.IO handshakes to fingerprint versions.
0621. **SignalR negotiation probing** — probe SignalR negotiate endpoints for version and transport info.
0622. **GraphQL subscription detection** — detect GraphQL subscriptions via WebSocket to map real-time APIs.
0623. **gRPC-Web endpoint detection** — detect gRPC-Web by content-type and framing.
0624. **Connect-protocol endpoint detection** — detect Buf Connect protocol endpoints by their headers.
0625. **JSON-RPC batch-handling analysis** — analyze batch handling to fingerprint JSON-RPC frameworks.
0626. **XML-RPC method listing** — list XML-RPC methods via system.listMethods where exposed.
0627. **SOAP action enumeration** — enumerate SOAP actions from WSDL to map legacy services.
0628. **OData metadata mining** — parse OData $metadata for entity sets that reveal data models.
0629. **HAL link-relation mapping** — map HAL _links to discover API navigation graphs.
0630. **JSON:API profile detection** — detect JSON:API profiles to fingerprint frameworks.
0631. **Hydra vocabulary mining** — parse Hydra vocabularies for API operation mappings.
0632. **OpenAPI callback-URL extraction** — extract callback URLs from OpenAPI specs to find webhook hosts.
0633. **AsyncAPI channel mapping** — map AsyncAPI channels to message-driven architectures.
0634. **Webhook.site-style catcher detection** — detect temporary webhook catchers left in configs.
0635. **RequestBin leftover detection** — find leftover RequestBin URLs in JS that reveal testing infrastructure.
0636. **ngrok tunnel leftover detection** — detect ngrok tunnel URLs hardcoded in configs pointing at dev machines.
0637. **Localtunnel URL discovery** — find localtunnel URLs exposing local dev servers.
0638. **Cloudflare Tunnel config leaks** — find cloudflared tunnel configs leaking internal hostnames.
0639. **Tailscale funnel detection** — detect Tailscale funnel endpoints exposing internal services.
0640. **ZeroTier network-ID mining** — extract ZeroTier network IDs from configs to map overlay networks.
0641. **Nebula certificate host mining** — parse Nebula certs for node names and IPs.
0642. **WireGuard peer-config leaks** — find WireGuard configs leaking peer endpoints.
0643. **Headscale coordination-server detection** — detect Headscale servers by their API shape.
0644. **Netmaker server detection** — detect Netmaker servers by their UI and API.
0645. **Innernet CIDR mapping** — map innernet CIDRs from coordinator configs.
0646. **VLAN hopping-surface mapping** — map trunk and native VLAN configs from switch disclosures (read-only).
0647. **STP topology inference** — infer spanning-tree topology from BPDU data where visible.
0648. **CDP/LLDP frame capture** — capture CDP/LLDP frames to map switch hostnames and ports.
0649. **ARP-table host harvesting** — harvest ARP tables from accessible devices to enumerate LAN hosts.
0650. **DHCP lease-pool inference** — infer lease pools from DHCP server disclosures.
0651. **DNS zone-transfer scheduling** — time AXFR attempts to zone serial increments for fresh data.
0652. **NSEC3 opt-out detection** — detect NSEC3 opt-out to identify unsigned delegations worth targeting.
0653. **DNSSEC key-rollover monitoring** — monitor DNSSEC key rollovers that briefly expose validation gaps.
0654. **DANE TLSA rotation tracking** — track TLSA record rotations to correlate with cert deployments.
0655. **SSHFP rotation monitoring** — monitor SSHFP changes to detect host key rotations and migrations.
0656. **BGP hijack-detection alerting** — alert on unexpected origin AS changes for target prefixes.
0657. **RPKI invalid-announcement flagging** — flag RPKI-invalid announcements affecting target prefixes.
0658. **Looking-glass path analysis** — analyze AS paths from looking glasses to map upstream providers.
0659. **Traceroute-based topology mapping** — build router-level topology via traceroutes from multiple vantage points.
0660. **MPLS label-stack inference** — infer MPLS deployments from TTL and label behaviors.
0661. **ICMP timestamp analysis** — analyze ICMP timestamps for OS and timezone hints.
0662. **ICMP address-mask probing** — probe address-mask requests for legacy router identification.
0663. **TCP SYN-cookie detection** — detect SYN cookies to infer kernel versions and load.
0664. **TCP Fast Open support mapping** — map TFO support to fingerprint modern stacks.
0665. **QUIC version-negotiation mapping** — map QUIC versions per endpoint for stack identification.
0666. **HTTP/3 Alt-Svc correlation** — correlate Alt-Svc advertisements with QUIC reachability.
0667. **Service-identity confidence scoring** — combine banner, behavior, TLS, and visual signals into one confidence score per identified service.
## C. Web crawling, spidering, JS analysis
0668. **React Router route extraction** — parse React Router route definitions in bundles to enumerate client-side paths.
0669. **Vue Router path harvesting** — extract Vue Router path maps from compiled bundles.
0670. **Angular route-config mining** — mine Angular route configurations for lazy-loaded module paths.
0671. **SvelteKit route-manifest parsing** — parse SvelteKit route manifests to list every page route.
0672. **Next.js page-manifest enumeration** — enumerate Next.js pages manifests to list routes and API paths.
0673. **Nuxt.js route auto-generation mapping** — map Nuxt file-based routing from bundle chunk names.
0674. **Remix route-module harvesting** — harvest Remix route modules and their loader paths.
0675. **Astro route-collection extraction** — extract Astro's collected routes from build output.
0676. **Gatsby page-data path mining** — mine Gatsby page-data JSON paths to enumerate all pages.
0677. **Webpack chunk-URL enumeration** — enumerate webpack chunk URLs from runtime manifests to find code-split features.
0678. **Vite manifest asset mapping** — parse Vite build manifests to map every emitted asset and its source route.
0679. **Rollup chunk-graph reconstruction** — reconstruct Rollup chunk graphs to find dynamically imported routes.
0680. **Source-map original-source recovery** — recover original sources from published source maps to read unminified routes and comments.
0681. **Source-map URL-reference chaining** — follow sourceMappingURL chains across chunks to collect every map the app publishes.
0682. **Hidden source-map discovery** — probe for .map files even when the reference comment is stripped, using predictable names.
0683. **JS framework fingerprinting** — identify React/Vue/Angular/Svelte versions from bundle signatures and global hooks.
0684. **Framework build-mode detection** — detect development vs production builds from warning strings and devtools hooks.
0685. **Dead-code endpoint extraction** — extract API endpoints from unreachable code branches that bundlers failed to tree-shake.
0686. **Commented-out endpoint harvesting** — harvest endpoints left in code comments of shipped bundles.
0687. **Event-handler URL mining** — extract URLs from onclick and addEventListener handlers across the DOM and bundles.
0688. **Callback-URL parameter mining** — find callback and redirect URL parameters in JS that reveal integration endpoints.
0689. **PostMessage target-origin cataloging** — catalog postMessage target origins to map cross-window integrations.
0690. **Message-event listener mapping** — map message event listeners to find expected origins and data shapes.
0691. **WebSocket URL extraction from JS** — extract ws:// and wss:// URLs from bundles (discovery; testing belongs to category D).
0692. **EventSource URL harvesting** — harvest EventSource URLs for server-sent event streams.
0693. **Fetch-call endpoint aggregation** — aggregate every fetch() call target across bundles into an endpoint inventory.
0694. **Axios baseURL resolution** — resolve Axios instances' baseURLs and merge with relative paths for full endpoint lists.
0695. **jQuery AJAX URL extraction** — extract $.ajax and $.get URLs from legacy bundles.
0696. **GraphQL-in-JS endpoint discovery** — find GraphQL endpoints from client queries and Apollo/Urql configs (testing is category D).
0697. **GraphQL query-name cataloging** — catalog operation names to map API capabilities without executing them.
0698. **Service-worker script mining** — fetch and parse service-worker scripts for cached routes and push endpoints.
0699. **Service-worker cache-key enumeration** — enumerate cache keys to list precached app routes.
0700. **WASM binary string extraction** — extract strings from WebAssembly binaries to find embedded endpoints and keys references.
0701. **WASM import-object analysis** — analyze WASM imports to map host-function dependencies.
0702. **WASM memory-segment scanning** — scan WASM linear-memory initializers for URL strings.
0703. **Minified-JS deobfuscation heuristics** — apply string-array and control-flow heuristics to recover readable endpoint lists.
0704. **JS string-concatenation resolver** — resolve split string literals concatenated at runtime to rebuild hidden URLs.
0705. **Base64-blob URL decoding** — decode base64 blobs in JS that hide endpoint URLs.
0706. **Dynamic import() target harvesting** — harvest dynamic import() specifiers to find lazy routes and their chunks.
0707. **Import-map URL resolution** — resolve import-map entries to map bare specifiers to CDN and internal URLs.
0708. **API client SDK detection** — detect bundled API client SDKs (Stripe, Twilio, AWS) to infer which third-party endpoints the app calls.
0709. **SDK version pinning analysis** — read SDK version pins to identify outdated client libraries.
0710. **Feature-flag endpoint discovery** — find feature-flag service endpoints (LaunchDarkly, Split) in configs.
0711. **Feature-flag key enumeration** — enumerate flag keys from client SDKs to map gated features.
0712. **Remote config-endpoint discovery** — find remote-config JSON endpoints that list backend hosts.
0713. **Error-monitoring DSN discovery** — extract Sentry/Bugsnag/Datadog DSNs that reveal project identifiers and hosts.
0714. **Analytics endpoint cataloging** — catalog analytics endpoints to map data-collection infrastructure.
0715. **A/B testing variant mapping** — map experiment variants from testing SDKs to find hidden feature routes.
0716. **Headless-browser interactive crawling** — drive a headless browser to click, fill forms, and scroll so SPA content renders before extraction.
0717. **Infinite-scroll pagination harvesting** — automate infinite scroll to harvest all paginated items and their URLs.
0718. **Form-fill state exploration** — fill forms with benign values to reach post-submit states and their routes.
0719. **Multi-step wizard traversal** — walk multi-step wizards to enumerate every step route.
0720. **Tab-interface content extraction** — activate every tab to extract lazy-loaded tab content and routes.
0721. **Modal-dialog link harvesting** — open modals to harvest links hidden behind dialogs.
0722. **Dropdown-menu deep crawling** — expand every dropdown to find nested navigation links.
0723. **Accordion content expansion** — expand accordions to reveal hidden links and endpoints.
0724. **Carousel slide URL mining** — extract URLs from every carousel slide, not just the first.
0725. **Lazy-image srcset harvesting** — harvest srcset URLs from lazy-loaded images for CDN host mapping.
0726. **Intersection-observer trigger automation** — programmatically trigger intersection observers to load lazy content.
0727. **Virtualized-list full extraction** — scroll virtualized lists programmatically to extract every row's links.
0728. **Canvas-rendered link recovery** — OCR canvas-rendered UIs to recover links invisible to DOM parsing.
0729. **Shadow-DOM link traversal** — pierce shadow DOM boundaries to extract encapsulated links and endpoints.
0730. **Web-component route mapping** — map custom-element routers to their route tables.
0731. **Iframe nested crawling** — recursively crawl same-origin iframes for their links.
0732. **Cross-origin iframe metadata** — record cross-origin iframe srcs for third-party integration mapping.
0733. **Sitemap.xml deep mining** — parse sitemap indexes recursively, including nested and paginated sitemaps.
0734. **Robots.txt disallow harvesting** — harvest Disallow entries as a priority list of sensitive paths.
0735. **Robots.txt sitemap directive following** — follow Sitemap: directives in robots.txt to alternate sitemaps.
0736. **Llms.txt documentation mining** — parse llms.txt files for documented routes and API descriptions.
0737. **Humans.txt-linked asset discovery** — follow links in humans.txt to team and tool hosts.
0738. **Security.txt path enumeration** — use security.txt-declared paths to confirm canonical contact endpoints.
0739. **Ads.txt-linked domain expansion** — expand crawler seeds with domains from ads.txt relationships.
0740. **Wayback URL corpus seeding** — seed the crawl frontier with Wayback's URL corpus for the target.
0741. **Common Crawl URL seeding** — seed crawls with Common Crawl's index for deep historical URLs.
0742. **HTML comment mining** — extract TODOs, disabled features, and internal URLs from HTML comments.
0743. **Conditional-comment legacy mining** — parse IE conditional comments for legacy asset hosts.
0744. **Server-side-include directive mining** — find SSI directives that reveal include paths.
0745. **Inline JSON-LD mining** — parse JSON-LD blocks for organization URLs and sameAs links.
0746. **Inline __NEXT_DATA__ extraction** — extract Next.js __NEXT_DATA__ payloads for page props and API routes.
0747. **Nuxt payload extraction** — parse Nuxt __NUXT__ state for route payloads and endpoints.
0748. **Bootstrapped initial-state object mining** — mine bootstrapped Redux/Vuex state for API hosts and user routes.
0749. **Embedded config-object extraction** — extract window.config objects that list environment-specific endpoints.
0750. **Meta-tag URL harvesting** — harvest og:url, canonical, and alternate link tags for canonical host mapping.
0751. **Link-header relation mapping** — parse HTTP Link headers for preload, alternate, and API relations.
0752. **DNS-prefetch hint harvesting** — collect dns-prefetch hints as a ready-made third-party host list.
0753. **Preconnect hint analysis** — analyze preconnect hints for critical third-party origins.
0754. **Prerender hint URL extraction** — extract prerender hints that name high-priority routes.
0755. **Resource-hint priority mapping** — map resource hints to understand critical rendering paths and their hosts.
0756. **Inline SVG script mining** — scan inline SVGs for embedded scripts and xlink:href URLs.
0757. **MathML endpoint references** — check MathML blocks for href references to asset hosts.
0758. **Template-tag content extraction** — extract <template> contents that hold unrendered routes.
0759. **Noscript-fallback link harvesting** — harvest links from noscript fallbacks that duplicate JS routes.
0760. **Data-attribute URL mining** — extract URLs from data-* attributes used by JS routers.
0761. **ARIA-describedby target mapping** — follow ARIA reference targets that point at hidden content sections.
0762. **Form-action endpoint cataloging** — catalog every form action URL as a candidate endpoint.
0763. **Form-method override detection** — detect _method overrides that reveal RESTful routing.
0764. **Input-name parameter harvesting** — harvest input names as parameter candidates for later testing.
0765. **Hidden-field value mining** — extract hidden fields for tokens, IDs, and internal references.
0766. **Select-option URL mining** — extract URLs from select options used for navigation.
0767. **Datalist value harvesting** — harvest datalist values that reveal search and filter endpoints.
0768. **Autocomplete endpoint discovery** — find autocomplete endpoints from input event bindings.
0769. **Search-suggestion API mapping** — map search-as-you-type endpoints from keyup handlers.
0770. **Pagination-link pattern inference** — infer pagination URL patterns to generate deep page URLs.
0771. **Calendar-widget date-URL mining** — extract date-parameterized URLs from calendar widgets.
0772. **Map-tile URL harvesting** — harvest map tile URLs to identify mapping providers and key usage.
0773. **Video-source URL extraction** — extract video source URLs for media-host mapping.
0774. **Audio-source URL mining** — mine audio element sources for media infrastructure.
0775. **Track-element caption harvesting** — harvest caption/subtitle file URLs.
0776. **Picture-element source mining** — extract responsive image sources for CDN mapping.
0777. **CSS url() reference harvesting** — parse stylesheets for url() references to fonts, images, and imports.
0778. **CSS @import chain following** — follow CSS @import chains to map stylesheet infrastructure.
0779. **Font-face source extraction** — extract @font-face src URLs for font-CDN mapping.
0780. **CSS custom-property URL mining** — find URLs stored in CSS custom properties.
0781. **Stylesheet comment mining** — mine CSS comments for disabled endpoints and TODOs.
0782. **Sourcemap comment in CSS** — follow sourceMappingURL comments in CSS to original Sass/Less sources.
0783. **Favicon-manifest link harvesting** — harvest icon link relations for asset-host mapping.
0784. **Apple-touch-icon path mapping** — map apple-touch-icon paths across sizes for asset inventory.
0785. **Mask-icon SVG harvesting** — extract Safari mask-icon SVGs that may embed scripts.
0786. **Theme-color meta analysis** — correlate theme-color metas across subdomains for brand clustering.
0787. **Open-Graph image host mapping** — map og:image hosts to CDN infrastructure.
0788. **Twitter-card URL extraction** — extract twitter:card URLs for media hosts.
0789. **oEmbed endpoint discovery** — discover oEmbed providers from link tags.
0790. **Webmention endpoint mining** — find webmention endpoints that reveal community infrastructure.
0791. **Pingback endpoint detection** — detect XML-RPC pingback endpoints on blogs.
0792. **RSS feed URL harvesting** — harvest RSS/Atom feed URLs for content-API mapping.
0793. **Feed autodiscovery link parsing** — parse feed autodiscovery links for feed-generator hosts.
0794. **JSON Feed endpoint mapping** — map JSON Feed endpoints as content-API candidates.
0795. **Sitemap-image extension mining** — parse image sitemap extensions for media hosts.
0796. **Sitemap-video extension mining** — parse video sitemap extensions for video-platform hosts.
0797. **Sitemap-news extension mining** — parse news sitemaps for article URL patterns.
0798. **Hreflang alternate mapping** — map hreflang alternates to regional site variants.
0799. **Canonical-chain loop detection** — detect canonical chains and loops that reveal duplicate deployments.
0800. **Redirect-chain full mapping** — follow every redirect chain to its final host, recording intermediate hosts.
0801. **Redirect-parameter host extraction** — extract target hosts from redirect parameters (?next=, ?return=) for mapping.
0802. **URL-shortener expansion mapping** — expand shortened URLs found on the site to their destination hosts.
0803. **Affiliate-link network mapping** — map affiliate link domains to third-party networks.
0804. **UTM-parameter campaign inference** — infer campaign infrastructure from UTM parameters.
0805. **Session-ID URL-rewriting detection** — detect session IDs in URLs that reveal stateful routing.
0806. **Trailing-slash redirect mapping** — map slash-handling redirects to infer framework routing.
0807. **Case-sensitivity path probing** — probe path case variations to fingerprint case-handling and find hidden routes.
0808. **URL-encoded path traversal mapping** — map how encoded characters are normalized to understand routing layers.
0809. **Double-encoding normalization analysis** — analyze double-encoding handling to fingerprint WAF and server combos.
0810. **Semicolon-parameter route splitting** — test semicolon parameters that split routes differently across layers.
0811. **Dot-segment normalization mapping** — map dot-segment handling to find path-confusion opportunities.
0812. **Unicode-normalization route testing** — test Unicode path variants to find normalization differentials.
0813. **HTTP-parameter pollution mapping** — map how duplicate parameters are merged per endpoint.
0814. **Array-parameter syntax detection** — detect [] and indexed parameter syntaxes to fingerprint backends.
0815. **JSON body-parameter inference** — infer JSON body schemas from client-side validation code.
0816. **Multipart boundary analysis** — analyze multipart handling from upload forms.
0817. **Chunked-upload endpoint discovery** — find resumable-upload endpoints from client code.
0818. **WebRTC signaling URL extraction** — extract signaling server URLs from WebRTC client code.
0819. **WebRTC ICE-server harvesting** — harvest STUN/TURN server lists that reveal real-time infrastructure.
0820. **DataChannel label cataloging** — catalog DataChannel labels to map P2P features.
0821. **Media-stream track analysis** — analyze getUserMedia constraints for device-fingerprinting code.
0822. **Screen-share endpoint mapping** — map screen-sharing session endpoints.
0823. **Clipboard-API usage mapping** — map clipboard API usage that may indicate paste-jacking features.
0824. **Notification-API endpoint extraction** — extract push-subscription endpoints from notification code.
0825. **Geolocation-API call mapping** — map geolocation calls to location-aware endpoints.
0826. **DeviceOrientation handler mining** — mine sensor handlers for device-specific routes.
0827. **Vibration-API usage detection** — detect vibration API usage indicating mobile-web features.
0828. **Battery-API data-exfil mapping** — map battery API reads that feed fingerprinting endpoints.
0829. **Network-information API mapping** — map Network Information API usage to adaptive-content endpoints.
0830. **Payment-Request API endpoint mining** — extract payment handler URLs from Payment Request API code.
0831. **Credential-Management API mapping** — map credential store/retrieve calls to auth endpoints.
0832. **WebAuthn relying-party mapping** — extract RP IDs and attestation endpoints from WebAuthn code.
0833. **WebOTP API endpoint discovery** — find SMS-retriever endpoints from WebOTP code.
0834. **Contact-picker data-flow mapping** — map contact-picker usage to sharing endpoints.
0835. **File-System-Access API mapping** — map File System Access API calls to local-file features.
0836. **WebUSB device-filter mining** — mine WebUSB filters for supported hardware identifiers.
0837. **WebBluetooth service-UUID mapping** — map Bluetooth service UUIDs to device integrations.
0838. **WebHID device-collection mining** — mine WebHID collections for supported devices.
0839. **WebSerial port-configuration mining** — extract serial port configs for hardware integrations.
0840. **WebNFC record-type mapping** — map NFC record handlers to physical-interaction features.
0841. **Barcode-detection format mapping** — map barcode formats to scanning features.
0842. **Shape-detection API mapping** — map face/text detection usage to media-processing endpoints.
0843. **WebXR session-mode mapping** — map XR session modes to immersive-content routes.
0844. **Gamepad-API feature mapping** — map gamepad usage to gaming features.
0845. **WebMIDI port enumeration** — enumerate MIDI ports referenced in music features.
0846. **AudioWorklet processor mapping** — map AudioWorklet processors to audio-processing endpoints.
0847. **WebCodecs encoder mapping** — map encoder configs to media-pipeline endpoints.
0848. **WebTransport stream mapping** — map WebTransport streams to real-time endpoints.
0849. **WebNN model-URL extraction** — extract on-device ML model URLs from WebNN code.
0850. **TensorFlow.js model harvesting** — harvest TF.js model.json URLs for model-host mapping.
0851. **ONNX-runtime model discovery** — find ONNX model URLs loaded in-browser.
0852. **WASM ML-inference mapping** — map WASM-based inference modules to AI feature endpoints.
0853. **Chat-widget backend discovery** — extract chat widget backend URLs and API keys references.
0854. **Chat-transcript endpoint mapping** — map chat transcript endpoints from widget code.
0855. **Canned-response API mining** — find canned-response APIs that reveal support infrastructure.
0856. **Ticket-creation endpoint discovery** — map support-ticket creation endpoints.
0857. **Knowledge-base search mapping** — map help-center search APIs.
0858. **FAQ structured-data mining** — parse FAQ schema for support URLs.
0859. **HowTo schema endpoint extraction** — extract tool URLs from HowTo structured data.
0860. **Recipe-schema URL mining** — mine recipe schema for content-API patterns (generic technique validation).
0861. **JobPosting schema host mapping** — extract hiring URLs from JobPosting structured data.
0862. **Event-schema venue mapping** — map event URLs from Event structured data.
0863. **Product-schema offer mapping** — extract offer and review URLs from Product schema.
0864. **Breadcrumb-schema path mining** — mine breadcrumb trails for site hierarchy.
0865. **Sitelinks searchbox action mining** — extract SearchAction targets from sitelinks schema.
0866. **Speakable-schema section mapping** — map speakable sections to content endpoints.
0867. **AMP-page canonical mapping** — map AMP pages to their canonical counterparts.
0868. **AMP-analytics endpoint extraction** — extract analytics endpoints from AMP configs.
0869. **Instant-Article URL mapping** — map Facebook Instant Articles to canonical hosts.
0870. **Apple-News URL mapping** — map Apple News channel URLs.
0871. **PWA install-prompt mapping** — map beforeinstallprompt flows to PWA entry routes.
0872. **Smart app-banner URL mapping** — extract smart app banner URLs for native-app linkage.
0873. **Universal-link AASA mapping** — map universal links from associated-domains entitlements.
0874. **Android App-Link mapping** — map Android applinks from assetlinks to web routes.
0875. **Deep-link scheme enumeration** — enumerate custom URL schemes that map to web routes.
0876. **Branch.io link mapping** — extract Branch deep-link domains.
0877. **Firebase Dynamic-Link mapping** — map Firebase Dynamic Link domains.
0878. **Adjust tracker-URL mining** — mine Adjust tracker URLs for attribution infrastructure.
0879. **AppsFlyer OneLink mapping** — map AppsFlyer OneLink domains.
0880. **Kochava tracker extraction** — extract Kochava tracker URLs.
0881. **Singular link mapping** — map Singular attribution links.
0882. **Email deep-link route mapping** — extract deep links from email templates that reveal app routes.
0883. **SMS-link short-domain mapping** — map SMS short domains to campaign infrastructure.
0884. **QR-code destination harvesting** — decode QR codes on the site for encoded URLs.
0885. **NFC-tag URL extraction** — extract URLs programmed in NFC tag references.
0886. **Print-stylesheet URL mining** — mine print stylesheets for print-specific routes.
0887. **Reader-mode content mapping** — map reader-mode extraction to article URL patterns.
0888. **Translation-proxy URL mapping** — map translated-page proxy URLs.
0889. **Textise text-proxy detection** — detect text-only proxy mirrors of the site.
0890. **Google-Webcache URL harvesting** — harvest webcache URLs for historical page versions.
0891. **Archive.today snapshot mining** — mine archive.today snapshots for historical URLs.
0892. **Cached-view source diffing** — diff cached vs live pages to find recently removed links.
0893. **Stale CDN-object harvesting** — request stale CDN objects via cache headers to find removed assets.
0894. **CDN-purge API discovery** — find CDN purge endpoints from deployment scripts.
0895. **Edge-function route mapping** — map edge-function routes from CDN configs.
0896. **Edge-include (ESI) tag mining** — mine ESI tags for backend fragment URLs.
0897. **Surrogate-key header analysis** — analyze surrogate keys for cache-group naming.
0898. **Vary-header behavior mapping** — map Vary headers to understand cache variants.
0899. **CDN cache-tag enumeration** — enumerate cache tags that reveal content groupings.
0900. **Stale-while-revalidate behavior mapping** — map SWR behavior to find background-refresh endpoints.
0901. **Client-side A/B assignment mapping** — map experiment assignment logic to find control vs variant routes.
0902. **Client-side personalization-rule extraction** — extract personalization rules that reveal segmented content routes.
0903. **Client-side geofencing-rule mapping** — map geo-fenced content rules to regional endpoints.
0904. **Consent-mode endpoint mapping** — map consent-management endpoints from CMP code.
0905. **Cookie-banner vendor mapping** — identify CMP vendors and their config hosts.
0906. **Privacy-policy version tracking** — track policy page versions for newly disclosed sub-processors.
0907. **Sub-processor list host mining** — extract sub-processor domains from privacy pages.
0908. **DPA-document URL harvesting** — harvest data-processing agreement URLs for legal-host mapping.
0909. **Terms-of-service version diffing** — diff terms versions for newly mentioned services.
0910. **Cookie-policy tracker inventory** — inventory trackers named in cookie policies.
0911. **Do-Not-Track behavior mapping** — map DNT handling to privacy endpoints.
0912. **Global Privacy-Control signal mapping** — map GPC signal handling endpoints.
0913. **Data-subject-request endpoint discovery** — find DSAR submission endpoints.
0914. **Deletion-request flow mapping** — map account-deletion flows to backend endpoints.
0915. **Export-data endpoint discovery** — find data-export endpoints that reveal data stores.
0916. **Accessibility-widget endpoint mapping** — map accessibility overlay endpoints.
0917. **Screen-reader-only link harvesting** — harvest sr-only links hidden from visual crawls.
0918. **Skip-navigation target mapping** — follow skip-links to main content anchors.
0919. **Focus-trap boundary mapping** — map modal focus traps to dialog routes.
0920. **Live-region update mapping** — map aria-live regions to dynamic content endpoints.
0921. **Keyboard-shortcut route mapping** — extract keyboard shortcuts that navigate to hidden routes.
0922. **Voice-control command mapping** — map voice commands to app actions and routes.
0923. **Gesture-handler route mapping** — map swipe and gesture handlers to navigation targets.
0924. **Haptic-feedback trigger mapping** — map haptic triggers to interactive elements.
0925. **Dark-mode asset mapping** — map dark-mode asset variants for full asset inventory.
0926. **Reduced-motion fallback mapping** — map reduced-motion fallbacks that load alternate assets.
0927. **High-contrast asset mapping** — map high-contrast stylesheets and assets.
0928. **Font-loading strategy mapping** — map font-display strategies to font hosts.
0929. **Critical-CSS URL extraction** — extract critical CSS URLs for above-fold asset mapping.
0930. **Deferred-script execution mapping** — map deferred scripts' execution order to dependency graphs.
0931. **Async-script dependency mapping** — map async script dependencies.
0932. **Module-preload graph extraction** — extract modulepreload graphs for JS dependency mapping.
0933. **Preload-scanner behavior analysis** — analyze preload scanner hints for priority assets.
0934. **Fetch-priority hint mapping** — map fetchpriority hints to critical endpoints.
0935. **Lazy-hydration boundary mapping** — map hydration boundaries in SSR apps to component routes.
0936. **Island-architecture component mapping** — map island components to their data endpoints.
0937. **Partial-hydration trigger mapping** — map triggers that hydrate components on demand.
0938. **Server-component payload mining** — mine React Server Component payloads for data endpoints.
0939. **RSC Flight-protocol analysis** — analyze RSC flight data for serialized route info.
0940. **Turbopack chunk mapping** — map Turbopack chunks in Next.js dev leaks.
0941. **SWC transform artifact mining** — mine SWC artifacts for original source hints.
0942. **Babel-plugin helper fingerprinting** — fingerprint Babel plugins from helper code.
0943. **Third-party polyfill-service mapping** — map polyfill.io-style services and their feature sets.
0944. **Core-js version detection** — detect core-js versions from polyfill bundles.
0945. **Regenerator-runtime bundle detection** — detect regenerator runtime indicating transpiled async code.
0946. **Zone.js patch mapping** — map Zone.js patches in Angular apps for async tracking.
0947. **RxJS operator mining** — mine RxJS operators for data-flow endpoints.
0948. **NgRx store-shape extraction** — extract NgRx store shapes for state and API mapping.
0949. **Vuex module mapping** — map Vuex modules to their API actions.
0950. **Pinia store extraction** — extract Pinia stores for endpoint mapping.
0951. **Redux middleware chain analysis** — analyze Redux middleware for API call patterns.
0952. **SWR key enumeration** — enumerate SWR cache keys that encode API URLs.
0953. **React-Query key mapping** — map React Query keys to backend endpoints.
0954. **Apollo cache-shape extraction** — extract Apollo cache shapes for GraphQL field mapping.
0955. **Urql exchange mapping** — map Urql exchanges to request pipelines.
0956. **Relay compiler-artifact mining** — mine Relay artifacts for GraphQL documents.
0957. **tRPC router-shape extraction** — extract tRPC router shapes for procedure mapping.
0958. **Zod-schema endpoint inference** — infer API shapes from Zod validation schemas.
0959. **Yup-schema field harvesting** — harvest form fields from Yup schemas.
0960. **Joi-schema API mapping** — map APIs from Joi validation schemas.
0961. **AJV-schema endpoint inference** — infer endpoints from AJV JSON schemas.
0962. **OpenAPI-client codegen detection** — detect generated API clients to recover full spec shapes.
0963. **MSW mock-handler mining** — mine Mock Service Worker handlers for mocked endpoints that mirror real ones.
0964. **Storybook story-URL enumeration** — enumerate Storybook stories that expose component variants and props.
0965. **Chromatic snapshot mapping** — map Chromatic snapshots for UI-state URLs.
0966. **Playwright-test artifact mining** — mine leaked Playwright test files for test URLs and credentials references.
0967. **Cypress spec URL harvesting** — harvest URLs from exposed Cypress specs.
0968. **Selenium-grid hub detection** — detect Selenium hubs that reveal test infrastructure.
0969. **Test-fixture data mining** — mine test fixtures for realistic IDs and endpoints.
0970. **Seed-data URL extraction** — extract seed-data URLs from database seed scripts.
0971. **Migration-file endpoint inference** — infer API shapes from database migration files.
0972. **GraphQL codegen artifact mining** — mine GraphQL codegen outputs for full operation lists.
0973. **Prisma-schema model extraction** — extract data models from exposed Prisma schemas.
0974. **Drizzle-schema table mapping** — map tables from Drizzle schema leaks.
0975. **TypeORM entity mining** — mine TypeORM entities for data-model endpoints.
0976. **Sequelize model extraction** — extract Sequelize models for API shape inference.
0977. **Mongoose schema harvesting** — harvest Mongoose schemas for document shapes.
0978. **Knex migration analysis** — analyze Knex migrations for table structures.
0979. **Hasura metadata mining** — mine Hasura metadata for tracked tables and actions.
0980. **Supabase config extraction** — extract Supabase project refs from client code.
0981. **Firebase config harvesting** — harvest Firebase configs for project IDs and API keys references.
0982. **Amplify backend-config mining** — mine Amplify configs for AppSync and S3 endpoints.
0983. **Appwrite endpoint extraction** — extract Appwrite endpoint URLs and project IDs.
0984. **PocketBase URL discovery** — discover PocketBase instances from client SDK configs.
0985. **Directus instance mapping** — map Directus instances from SDK usage.
0986. **Strapi API mapping** — map Strapi content-type endpoints from client code.
0987. **Contentful space-ID extraction** — extract Contentful space IDs and delivery hosts.
0988. **Sanity project-ID mining** — mine Sanity project IDs and dataset names.
0989. **Storyblok token-reference mapping** — map Storyblok references to CDN endpoints.
0990. **Hygraph endpoint extraction** — extract Hygraph content endpoints.
0991. **DatoCMS token mapping** — map DatoCMS API hosts from client code.
0992. **Prismic repo-name extraction** — extract Prismic repository names.
0993. **Ghost Content-API mapping** — map Ghost Content API endpoints.
0994. **WordPress REST discovery** — discover wp-json endpoints and their routes.
0995. **Drupal JSON:API mapping** — map Drupal JSON:API resource routes.
0996. **Headless-commerce endpoint mapping** — map Shopify/BigCommerce storefront API endpoints.
0997. **Payment-gateway client mapping** — map payment gateway client integrations to checkout endpoints.
0998. **Fraud-detection SDK mapping** — map fraud SDK endpoints (Sift, Riskified) from client code.
0999. **Bot-management signal mapping** — map bot-detection SDK signals to challenge endpoints.
1000. **Crawl-frontier deduplication engine** — normalize and dedupe the entire discovered URL frontier by canonical form so downstream testing never wastes cycles on duplicate routes.
