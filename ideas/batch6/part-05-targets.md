# Target management (54005–55004)

54005. **Single-field quick-add bar** — Paste any URL, domain, IP, or CIDR into one input that normalizes and classifies the target type automatically.
54006. **Paste-and-detect onboarding** — Detects whether pasted text is a URL, bare domain, IP address, ASN, mobile app link, or cloud resource and routes it to the right flow.
54007. **Guided onboarding wizard** — A five-step wizard (identify → verify → scope → organize → review) that walks new users through adding their first target.
54008. **Duplicate target detector** — Warns when a normalized domain, IP, or alias already exists in inventory before creating a duplicate entry.
54009. **Target type presets** — One-click presets for Web App, API, Mobile App, Cloud Account, Network Range, and IoT Device that pre-fill relevant fields.
54010. **Draft targets queue** — Saves half-finished target entries as drafts that can be resumed later without losing entered data.
54011. **Onboarding checklist tracker (targets)** — Shows per-target setup progress (added → verified → scoped → tagged → first hunt) as a visual checklist.
54012. **Skip-and-verify-later mode** — Lets users add a target immediately and defers ownership verification to a clearly flagged pending state.
54013. **DNS pre-check on add** — Resolves the domain during onboarding and flags NXDOMAIN, parked, or unresolvable hosts before saving.
54014. **Live screenshot capture on add** — Takes a homepage screenshot during onboarding so the target card shows a visual thumbnail instantly.
54015. **Technology guess preview** — Shows detected server, framework, and CDN hints on the review step so users can confirm before saving.
54016. **Redirect chain preview** — Displays the full redirect chain (http→https, www→apex) during onboarding to pick the canonical entry URL.
54017. **Program linking at add time** — Attaches a bug-bounty program (HackerOne, Bugcrowd, Intigriti) to the target while creating it.
54018. **Team assignment at add time** — Assigns an owner and team during onboarding so responsibility is never ambiguous.
54019. **Tag assignment at add time** — Applies tags from a suggested set during creation to keep the inventory organized from day one.
54020. **Client association at add time** — Links the target to a client record during onboarding for agency and MSSP workflows.
54021. **Scope pre-fill from program** — Auto-populates in-scope rules from the linked bounty program's published scope during onboarding.
54022. **Verification file download** — Generates the ownership-verification HTML file or token during onboarding for one-click download.
54023. **DNS TXT instructions generator** — Produces copy-paste DNS TXT record instructions tailored to the user's registrar during onboarding.
54024. **Meta tag snippet generator** — Provides a ready-to-paste ownership meta tag for the verify-by-HTML-tag method.
54025. **Subdomain count preview** — Shows how many subdomains certificate transparency reveals before the target is even saved.
54026. **IP resolution preview** — Displays resolved IPv4/IPv6 addresses and hosting ASN on the onboarding review screen.
54027. **WAF/CDN preview** — Flags detected WAF or CDN presence during onboarding so hunt configuration can account for it.
54028. **robots.txt and sitemap preview** — Fetches and summarizes robots.txt and sitemap.xml during onboarding to hint at scope breadth.
54029. **Security header preview** — Grades response security headers on the review step to seed the initial risk profile.
54030. **Cookie and auth preview** — Notes session cookies and login page presence to flag authenticated-surface complexity early.
54031. **Onboarding audit log** — Records who added each target, when, and via which method (manual, import, API, program sync).
54032. **Bulk draft promotion** — Converts multiple draft targets to active inventory in one action after review.
54033. **Onboarding undo** — Lets users undo a just-created target within a grace window, removing it cleanly with its scaffolding.
54034. **Contact details capture** — Collects security contact name, email, and escalation path during onboarding for incident routing.
54035. **Notification preferences per target** — Configures who gets health, change, and finding alerts for the target at creation time.
54036. **Hunt SLA setting** — Sets expected hunt cadence (e.g., weekly) during onboarding to drive scheduling later.
54037. **Quick-start hunt suggestion** — Recommends a first hunt configuration based on the target's detected type and size.
54038. **Browser extension import** — Adds the currently open site as a target directly from a browser extension button.
54039. **Mobile app binding** — Links iOS App Store or Google Play listings to a target during onboarding for mobile scope.
54040. **Cloud account binding** — Attaches AWS/GCP/Azure account context to a target for cloud-scoped hunts.
54041. **WHOIS preview** — Shows registrar, creation date, and expiry during onboarding to catch typo-squats and expiring domains.
54042. **Certificate preview** — Displays the live TLS certificate's issuer, SANs, and expiry on the review step.
54043. **Rate-limit discovery note** — Probes gently for rate-limiting signals during onboarding and records them for hunt throttling.
54044. **Language and locale detection** — Records the site's primary language to localize future reports and communications.
54045. **JS bundle inventory preview** — Counts first-party JavaScript bundles during onboarding to estimate client-side attack surface.
54046. **Form count preview** — Tallies forms and file-upload inputs found on key pages to hint at interaction complexity.
54047. **Port pre-scan lite** — Runs a fast top-ports check during onboarding and lists unexpected open services for review.
54048. **Onboarding progress API (targets)** — Exposes checklist state via API so external provisioning scripts can drive target setup.
54049. **Welcome tour per target type** — Launches a contextual product tour the first time each target type is added.
54050. **Attestation checkbox** — Requires confirming "I am authorized to test this target" with a timestamped record before saving.
54051. **Notes prompt at add** — Offers an optional first-note field during onboarding for context like credentials or VPN needs.
54052. **Screenshot gallery seed** — Captures homepage, login, and robots.txt views during onboarding to seed the target's media gallery.
54053. **Canonical alias confirmation** — Asks the user to confirm which of www/apex/http/https variants is canonical to prevent duplicate entries.
54054. **Onboarding completion webhook** — Fires a webhook when a target finishes onboarding so external systems can trigger provisioning.
54055. **Dual-pane scope editor** — Shows in-scope rules on the left and out-of-scope exclusions on the right with a live effective-scope preview.
54056. **Wildcard syntax support** — Accepts `*.example.com` style wildcards with inline documentation of exactly what each pattern matches.
54057. **Regex scope rules** — Allows regular-expression scope rules for complex patterns, with a built-in tester and syntax highlighting.
54058. **CIDR range scoping** — Defines scope with IPv4/IPv6 CIDR blocks and validates that ranges don't overlap unintentionally.
54059. **Port-level scoping** — Restricts scope to specific ports or port ranges per host for network-style targets.
54060. **Path-prefix scoping** — Limits scope to URL path prefixes like `/api/v2/*` for partial-application engagements.
54061. **HTTP method scoping** — Includes or excludes specific HTTP methods per scope rule for API-focused targets.
54062. **Visual scope tree** — Renders scope rules as an expandable domain tree so nested includes and excludes are easy to grasp.
54063. **"Is this URL in scope?" tester** — A test box where pasting any URL instantly shows which rule includes or excludes it and why.
54064. **Wildcard expansion preview** — Expands `*.example.com` against known subdomains to show concretely what the wildcard covers.
54065. **Overbroad wildcard warnings** — Flags patterns like `*` or `*.com` with a severity warning before they can be saved.
54066. **Exclusion reason codes** — Requires picking a reason (third-party, out-of-bounty, sensitive, duplicate) for every out-of-scope rule.
54067. **Exclusion templates library** — One-click templates for common exclusions: logout endpoints, static assets, status pages, marketing sites.
54068. **Scope syntax validator** — Validates every rule on keystroke and explains errors in plain language with fix suggestions.
54069. **Scope rule drag-drop reorder** — Reorders rules by drag and drop with a preview of how precedence changes the effective scope.
54070. **Rule shadowing indicator** — Highlights rules that can never match because an earlier rule already covers or excludes them.
54071. **Scope version history** — Keeps every saved scope version with author, timestamp, and diff for rollback.
54072. **Scope diff viewer (targets)** — Shows added, removed, and modified rules side by side when scope changes.
54073. **Scope change approval flow** — Routes scope edits above a risk threshold to a second approver before taking effect.
54074. **Scope rollback** — Restores any previous scope version in one click with an audit entry.
54075. **Scope import from program** — Pulls the bounty program's published scope text and converts it into structured rules.
54076. **Scope export as JSON** — Exports the full rule set as versioned JSON for backup or migration.
54077. **Copy scope between targets** — Clones a scope rule set from one target to another with conflict review.
54078. **Scope templates library** — Saves named scope templates (e.g., "Standard SaaS", "API-only") for reuse across targets.
54079. **Scope inheritance from program** — Targets linked to a program inherit its scope by default with visible override markers.
54080. **Per-rule enable toggle** — Disables individual rules without deleting them, useful for temporary testing windows.
54081. **Time-boxed scope rules** — Gives rules an optional start/end date for limited-time testing permissions.
54082. **Scope rule comments** — Attaches discussion threads to individual rules for team review.
54083. **Scope rule @mentions** — Notifies teammates from inside a rule comment during scope review.
54084. **Scope statistics header** — Shows rule counts, estimated covered hosts, and exclusion counts at the top of the editor.
54085. **Uncovered asset warnings** — Lists discovered subdomains and endpoints not matched by any rule so gaps get closed.
54086. **Scope coverage meter** — Displays the percentage of known assets covered by in-scope rules as a live gauge.
54087. **Scope simulation against inventory** — Runs the rule set against all discovered assets and reports match counts per rule.
54088. **Scope search** — Finds rules by text, pattern, or reason across large rule sets instantly.
54089. **Punycode/IDN handling** — Normalizes internationalized domain names so Unicode and punycode forms match consistently.
54090. **Case-insensitivity toggle** — Controls whether host matching ignores case, with the safe default clearly explained.
54091. **Trailing-slash normalization** — Treats `/api` and `/api/` identically unless the user explicitly opts out.
54092. **Query-parameter scoping** — Includes or excludes URLs based on query parameter presence or values.
54093. **Geo-based scoping** — Restricts scope to assets resolving in specific countries or regions.
54094. **ASN-based scoping** — Includes or excludes assets by their hosting ASN for cloud-migration scenarios.
54095. **Scope notes per rule** — Adds free-text justification to each rule for future reviewers and auditors.
54096. **Scope audit trail** — Logs every rule create, edit, disable, and delete with actor and timestamp.
54097. **Scope change notifications** — Alerts subscribed teammates when scope rules change, with the diff attached.
54098. **Scope conflict highlighting** — Marks rules that contradict each other directly in the editor with resolution hints.
54099. **Scope rule scheduling** — Activates rules only during defined windows, e.g., business-hours testing permissions.
54100. **Header-based scoping** — Matches scope by request or response header values for header-gated features.
54101. **Cookie-based scoping** — Scopes rules to sessions carrying specific cookies for authenticated-area testing.
54102. **Third-party exclusion helper** — Scans page resources and suggests third-party hosts to exclude in one click.
54103. **Scope review reminders** — Nudges owners to re-confirm scope quarterly or after major asset changes.
54104. **Scope sign-off record** — Captures formal client sign-off on the scope with timestamp for compliance evidence.
54105. **Card grid view** — Displays targets as rich cards with screenshot, health badge, risk score, and owner avatar.
54106. **Dense table view** — Switches to a sortable table with configurable columns for power users managing hundreds of targets.
54107. **Kanban by lifecycle** — Organizes targets into Active, Paused, Pending Verification, and Archived columns with drag-drop transitions.
54108. **Risk heatmap view** — Plots targets on a severity-by-exposure heatmap to spotlight the riskiest inventory at a glance.
54109. **Geo map view** — Pins targets by hosting geography to reveal concentration and jurisdictional patterns.
54110. **Health summary widget** — Shows counts of healthy, degraded, and down targets with one-click drill-down.
54111. **Needs-verification widget** — Surfaces targets stuck in unverified state sorted by age for quick action.
54112. **Stale targets widget** — Lists targets with no hunt or change activity beyond a configurable threshold.
54113. **Expiring scopes widget** — Flags targets whose time-boxed scope rules expire within 30 days.
54114. **Top risky targets widget** — Ranks the ten highest risk-scored targets with trend arrows.
54115. **Recent activity feed** — Streams hunts, findings, changes, and notes across all targets in reverse chronological order.
54116. **Hunt coverage gauge** — Shows what percentage of active targets received a hunt in the selected period.
54117. **Findings-by-severity mini bars** — Embeds per-target severity breakdown bars directly in cards and table rows.
54118. **Trend sparklines** — Adds tiny risk and finding-count sparklines to each target row for at-a-glance momentum.
54119. **Quick filters bar** — One-click chips for lifecycle, health, verification, risk band, and "my targets".
54120. **Saved dashboard layouts** — Lets users save and switch between named card/table/kanban arrangements.
54121. **Per-team dashboards** — Scopes the dashboard to a team's targets with team-level rollup widgets.
54122. **Per-client dashboards** — Presents a client-ready dashboard view safe to share in status meetings.
54123. **Customizable columns** — Adds, removes, and reorders table columns including custom fields.
54124. **Density toggle (targets)** — Switches between comfortable and compact row spacing for different screen sizes.
54125. **Target favicons and screenshots** — Pulls live favicons and cached screenshots so targets are visually scannable.
54126. **Uptime badges** — Shows 30-day uptime percentage badges computed from health monitoring.
54127. **Certificate expiry badges** — Warns directly on the card when a target's TLS certificate expires within 30 days.
54128. **Owner avatars** — Displays assigned owner photos with fallback initials for fast responsibility scanning.
54129. **Last-hunt timestamps** — Shows relative "hunted 3d ago" labels with color coding for overdue targets.
54130. **Bulk action toolbar** — Applies tag, group, lifecycle, or hunt-schedule actions to multi-selected targets.
54131. **Dashboard search (targets)** — Instantly filters visible targets as you type across names, domains, tags, and notes.
54132. **Sort options** — Sorts by risk, health, last hunt, name, date added, finding count, or custom fields.
54133. **Score leaderboard** — Ranks targets by risk score with percentile bands for prioritization meetings.
54134. **Program compliance widget** — Checks that each program-linked target's scope matches the platform's current published scope.
54135. **Scope coverage widget** — Aggregates the percentage of discovered assets covered by scope rules portfolio-wide.
54136. **Change digest widget** — Summarizes the week's subdomain, endpoint, and certificate changes across inventory.
54137. **Verification status widget** — Breaks down verified, pending, expired, and failed verifications with action links.
54138. **Onboarding progress widget** — Tracks how many targets sit at each onboarding checklist stage.
54139. **Archive browser** — Browses archived targets separately with restore and permanent-delete options.
54140. **Export dashboard to CSV** — Downloads the currently filtered target list with chosen columns for reporting.
54141. **Scheduled dashboard email** — Sends a weekly PDF or CSV inventory summary to stakeholders automatically.
54142. **Dashboard share links** — Creates read-only shareable links with expiry for client or auditor viewing.
54143. **Comparison pinning** — Pins up to four targets from the dashboard for side-by-side comparison.
54144. **Quick-add from dashboard** — Opens the onboarding flow in a slide-over without leaving the dashboard.
54145. **Inline note adding** — Adds a quick note to a target from its card without opening the detail page.
54146. **Inline tag editing** — Edits tags directly on cards and rows with autocomplete.
54147. **Health refresh button** — Triggers an on-demand health re-check for selected targets from the dashboard.
54148. **Dashboard date-range picker** — Scopes activity, findings, and change widgets to custom time windows.
54149. **Dashboard keyboard shortcuts** — Provides shortcuts for search, view switching, selection, and bulk actions.
54150. **Mobile dashboard layout** — Reflows cards, widgets, and filters into a touch-friendly single column.
54151. **Widget drill-down (targets)** — Clicking any widget number opens the pre-filtered target list behind it.
54152. **Empty-state guidance (targets)** — Shows contextual next steps when filters return nothing or inventory is new.
54153. **Dashboard performance mode (targets)** — Virtualizes long lists so ten thousand targets render without lag.
54154. **Custom dashboard widgets** — Lets users build widgets from any target field or metric via a no-code builder.
54155. **HTTP status monitoring** — Checks each target's key URLs on a schedule and records status codes over time.
54156. **Uptime ping checks** — Runs lightweight ICMP/TCP pings for network-level reachability independent of HTTP.
54157. **TLS handshake checks** — Verifies the TLS handshake completes and records negotiated version and cipher.
54158. **Certificate expiry alerts (targets)** — Warns 30, 14, and 7 days before a target's certificate expires via chosen channels.
54159. **Certificate chain validation** — Confirms the full chain validates against system trust stores on every check.
54160. **DNS resolution checks** — Monitors that domains still resolve and flags unexpected NXDOMAIN or record changes.
54161. **Response time tracking** — Records TTFB and full-load percentiles to spot performance degradation early.
54162. **Homepage content-hash checks** — Alerts when the homepage hash changes beyond the noise threshold, hinting at defacement or deploys.
54163. **Keyword presence checks** — Verifies expected keywords remain on key pages to catch placeholder or parked pages.
54164. **Maintenance page detection** — Recognizes common maintenance-mode patterns and marks health as "maintenance" instead of "down".
54165. **Redirect loop detection** — Flags redirect chains exceeding limits or cycling back on themselves.
54166. **WAF block detection** — Distinguishes WAF challenge/block responses from genuine outages in health status.
54167. **Rate-limit signal detection** — Detects 429 responses during checks and backs off instead of reporting downtime.
54168. **5xx spike alerts** — Triggers incidents when server-error rates cross a configurable threshold.
54169. **Login page availability checks** — Monitors that authentication entry points respond for targets with auth surface.
54170. **API endpoint checks** — Polls critical API routes (health, version, status) and validates response schemas.
54171. **Synthetic transaction checks** — Runs scripted multi-step flows like search or signup to verify real user journeys.
54172. **WebSocket health checks** — Confirms WebSocket endpoints accept connections for real-time applications.
54173. **GraphQL health queries** — Executes a lightweight introspection-safe query to verify GraphQL availability.
54174. **JS-rendered page checks** — Renders pages headlessly to catch failures invisible to raw HTTP checks.
54175. **Multi-region checks** — Probes targets from several geographic regions to detect geo-specific outages.
54176. **IPv6 reachability checks** — Verifies AAAA records and IPv6 connectivity separately from IPv4.
54177. **HTTP/2 and HTTP/3 checks** — Confirms advertised protocol versions actually negotiate.
54178. **OCSP stapling checks** — Validates revocation-status delivery for certificates where expected.
54179. **HSTS header checks** — Monitors HSTS presence and max-age to catch security posture regressions.
54180. **Port health checks** — Verifies expected TCP ports stay open for network and IoT targets.
54181. **Dependency health rollup** — Tracks CDN, DNS provider, and SSO dependency status alongside the target itself.
54182. **Scheduled maintenance windows** — Suppresses alerts during declared windows and labels the timeline accordingly.
54183. **Flapping detection** — Identifies rapidly oscillating up/down states and consolidates them into one incident.
54184. **Degraded vs down states** — Distinguishes slow or partial failures from full outages in status and alerting.
54185. **Health score 0–100** — Computes a composite health score from uptime, latency, TLS, and error signals.
54186. **Health history charts** — Plots uptime, latency, and incident markers on zoomable per-target charts.
54187. **SLA compliance percentage (targets)** — Calculates uptime against per-target SLA objectives with breach highlighting.
54188. **Downtime annotations** — Lets users annotate incidents with root cause for postmortem records.
54189. **Auto-pause hunts on outage** — Pauses running hunts automatically when a target goes down and resumes on recovery.
54190. **Recovery notifications** — Sends "back up" alerts with downtime duration when incidents resolve.
54191. **Incident timeline (targets)** — Shows detection, acknowledgment, and resolution events for every outage.
54192. **Alert channel routing** — Routes health alerts to email, Slack, PagerDuty, or webhooks per target or group.
54193. **Configurable check intervals** — Sets per-target frequencies from 1 minute to 24 hours based on criticality.
54194. **Per-region status page** — Publishes a simple status page per target or client showing current health.
54195. **Health check logs** — Retains raw check results with timings for debugging and evidence.
54196. **Health-based target sorting** — Sorts inventory by health score so the sickest targets surface first.
54197. **Health API for integrations** — Exposes current status and history via API for external dashboards.
54198. **User-selected check regions** — Lets users pick which regions probe each target for compliance needs.
54199. **SSO provider checks** — Monitors the identity provider endpoints that gated login depends on.
54200. **Mobile API checks** — Probes the API hosts backing mobile apps separately from web frontends.
54201. **Database-backed page checks** — Verifies dynamic pages render with fresh data, not cached error shells.
54202. **Webhook receiver checks** — Confirms inbound webhook endpoints accept and acknowledge test payloads.
54203. **Business-hours check schedule** — Restricts health checks to business hours for targets that sleep overnight.
54204. **Health alert acknowledgment** — Lets on-call users acknowledge incidents to stop repeat notifications.
54205. **Subdomain diff alerts** — Compares subdomain enumerations between runs and alerts on additions and removals.
54206. **New endpoint discovery alerts** — Notifies when previously unseen API routes or pages appear in crawl data.
54207. **Certificate transparency monitoring (targets)** — Watches CT logs for new certificates issued for the target's domains.
54208. **DNS record change alerts** — Flags A, AAAA, CNAME, MX, TXT, and NS record changes with before/after values.
54209. **IP address change alerts** — Detects hosting IP changes that may indicate migration or takeover risk.
54210. **ASN change alerts** — Flags when a target moves to a different autonomous system or hosting provider.
54211. **Nameserver change alerts** — Warns on NS delegation changes that could signal DNS hijacking.
54212. **SOA serial tracking** — Monitors zone serial increments as a lightweight signal of DNS zone edits.
54213. **Technology stack change alerts** — Detects server, framework, or CDN swaps between profile refreshes.
54214. **JavaScript bundle change alerts** — Hashes JS bundles and flags new, removed, or heavily modified scripts.
54215. **Page content diff** — Shows word-level diffs of monitored pages between snapshots.
54216. **HTTP header change alerts** — Flags added, removed, or altered security and infrastructure headers.
54217. **New open ports alerts** — Reports newly reachable ports discovered during periodic re-scans.
54218. **Removed endpoint alerts** — Notes when previously known endpoints disappear, hinting at deprecations or breakage.
54219. **Redirect target changes** — Alerts when redirect destinations change, catching hijack or migration issues.
54220. **robots.txt change alerts** — Diffs robots.txt to spot newly disallowed or newly exposed paths.
54221. **Sitemap change alerts** — Tracks sitemap.xml additions and removals as a proxy for site structure changes.
54222. **Favicon change alerts** — Flags favicon swaps that sometimes accompany rebrands or phishing clones.
54223. **Title and meta change alerts** — Detects homepage title or meta description changes worth a human look.
54224. **Form change detection** — Alerts when forms gain or lose fields, especially login and payment forms.
54225. **New login page detection** — Flags newly discovered authentication entry points for scope review.
54226. **New file-upload detection** — Highlights newly exposed upload functionality as high-interest change.
54227. **WAF on/off change detection** — Notes when WAF presence appears or disappears between checks.
54228. **CDN change detection** — Flags CDN provider switches that alter edge behavior and caching.
54229. **TLS version change alerts** — Warns if supported TLS versions change, especially downgrades.
54230. **Cipher suite change alerts** — Reports cipher list changes that weaken or strengthen transport security.
54231. **Certificate issuer change alerts** — Flags unexpected CA changes that can indicate mis-issuance.
54232. **SAN list change alerts** — Diffs certificate Subject Alternative Names to catch new hostnames early.
54233. **WHOIS change alerts** — Monitors registrar, contact, and expiry changes for domain hijack signals.
54234. **Hosting geolocation shifts** — Alerts when resolved geolocation moves countries unexpectedly.
54235. **Response time shift detection** — Flags statistically significant latency changes suggesting infra changes.
54236. **Status code shift detection** — Reports when key URLs start returning different status code classes.
54237. **New subdomains with screenshots** — Captures a screenshot of each newly found subdomain for quick triage.
54238. **Change severity scoring** — Grades each detected change low/medium/high so noisy diffs don't drown signals.
54239. **Change digest emails** — Sends daily or weekly rollups of changes per target or group.
54240. **Per-target change timeline** — Shows every detected change on the target's timeline with filters by type.
54241. **Baseline snapshot management** — Lets users set, label, and compare named baselines instead of only last-run.
54242. **Scheduled re-baselining** — Automatically accepts the current state as baseline after N quiet days.
54243. **Ignore list for noisy changes** — Mutes specific change patterns (e.g., rotating CSRF tokens) with reason codes.
54244. **Change approval workflow (targets)** — Routes high-severity changes to an owner for acknowledge-or-investigate triage.
54245. **Change-triggered hunts (targets)** — Auto-queues a focused hunt when high-interest changes like new endpoints appear.
54246. **Change annotations** — Lets analysts note "planned deploy" on changes to build institutional memory.
54247. **Change comparison screenshots** — Shows before/after screenshots side by side for visual page changes.
54248. **Change webhooks and API** — Pushes structured change events to external SOAR or ticketing systems.
54249. **Change retention policy** — Configures how long raw change evidence is kept per client or program.
54250. **Bulk change review** — Triages dozens of changes across targets with multi-select acknowledge and snooze.
54251. **Change filters by type** — Narrows the change feed to DNS, cert, content, tech, or network categories.
54252. **Cross-target change correlation** — Groups simultaneous similar changes across targets as likely platform-wide deploys.
54253. **Change-to-finding linkage** — Links findings discovered shortly after a change to that change for root-cause context.
54254. **Quiet-hours change batching** — Holds low-severity change alerts overnight and delivers one morning summary.
54255. **Composite risk score 0–100** — Combines surface, tech, exposure, and history factors into one sortable score per target.
54256. **Attack surface size factor** — Weighs subdomain, endpoint, and port counts so sprawling targets score higher.
54257. **Technology risk factor** — Raises scores for EOL frameworks, old CMS versions, and risky default stacks.
54258. **Exposure factor** — Scores internet-facing production higher than staging or internal assets.
54259. **Data sensitivity factor** — Boosts targets handling payments, health, identity, or financial data.
54260. **Bounty value factor** — Incorporates program reward ranges so high-payout targets rank higher.
54261. **Finding history factor** — Rewards targets with past valid findings as proven productive ground.
54262. **Change velocity factor** — Scores fast-changing targets higher since churn introduces fresh bugs.
54263. **Authentication complexity factor** — Accounts for multi-role, SSO, and OAuth surfaces that hide logic flaws.
54264. **API richness factor** — Weighs GraphQL, REST breadth, and undocumented endpoints in the score.
54265. **Third-party risk factor** — Penalizes heavy third-party script and integration sprawl.
54266. **Certificate hygiene factor** — Adjusts scores based on chain validity, expiry handling, and issuer reputation.
54267. **Security header factor** — Adjusts scores based on missing or misconfigured protective headers.
54268. **Subdomain sprawl factor** — Weighs unmanaged-looking subdomain counts as increased takeover and exposure risk.
54269. **Cloud footprint factor** — Scores targets with broad cloud asset exposure higher for misconfiguration likelihood.
54270. **Score breakdown explainer** — Shows exactly which factors contributed how many points to every score.
54271. **Score trend chart** — Plots score movement over time with annotations for what drove changes.
54272. **Manual score override** — Lets analysts pin a score with justification when the model misses context.
54273. **Score confidence indicator (targets)** — Displays how much evidence backs each score so thin-data scores aren't overtrusted.
54274. **Peer percentile ranking** — Shows where each target sits versus the portfolio (e.g., "riskier than 82% of targets").
54275. **Program tier weighting** — Lets programs define how much bounty value influences their targets' scores.
54276. **Client SLA weighting** — Applies per-client importance multipliers for MSSP prioritization.
54277. **Score-based hunt queue** — Orders the hunt scheduler by risk score so the juiciest targets get hunted first.
54278. **Auto-hunt score thresholds** — Triggers hunts automatically when a target's score crosses a configured line.
54279. **Recently-hunted dampener decay** — Reduces the "just hunted" score dampener over time so stale targets climb back up the queue.
54280. **Score boost on new changes** — Temporarily lifts scores when high-interest changes are detected.
54281. **Score jump alerts** — Notifies owners when a target's score moves more than a set delta in either direction.
54282. **Score in list columns** — Adds sortable risk-score columns to table views and dashboard cards.
54283. **Score badges** — Renders color-coded Critical/High/Medium/Low badges from score bands.
54284. **Score history log** — Keeps an auditable record of every score recomputation with inputs snapshot.
54285. **What-if score simulator** — Previews how adding scope, fixing headers, or archiving subdomains would move the score.
54286. **Scoring model versioning** — Versions the scoring formula so historical scores stay comparable after updates.
54287. **Scoring changelog** — Documents what changed in each model version in plain language.
54288. **Custom scoring weights** — Lets teams tune factor weights per group or client to match their threat model.
54289. **Per-client scoring profiles** — Saves named weight presets for different clients' risk appetites.
54290. **Bounty likelihood predictor** — Estimates probability of a valid finding per target from portfolio patterns.
54291. **Exploitability index** — Separates "likely to have bugs" from "bugs likely to matter" as a second dimension.
54292. **Crown-jewel tagging boost** — Lets users mark business-critical targets that always sort to the top.
54293. **Compliance scope boost** — Raises priority for targets in active audit or certification scope.
54294. **Score documentation links** — Links each factor to docs explaining how it's measured and improved.
54295. **Score export** — Includes scores and breakdowns in CSV/PDF exports for client reporting.
54296. **Score-based smart groups** — Auto-groups targets into Critical/High/Medium/Low bands that stay current.
54297. **Score notifications** — Subscribes stakeholders to weekly top-movers summaries.
54298. **Risk score leaderboard** — Ranks all targets with movement arrows for prioritization reviews.
54299. **Score vs findings correlation** — Charts whether high-scored targets actually yield findings to calibrate the model.
54300. **Patch cadence factor** — Rewards targets that ship fixes quickly and penalizes long-unpatched stacks.
54301. **Port exposure factor** — Weighs unexpected open services like databases or admin panels in the score.
54302. **Score recalculation triggers** — Recomputes scores on hunt completion, change detection, and scope edits automatically.
54303. **Score API** — Exposes current scores and factor breakdowns for external prioritization tools.
54304. **New-target provisional scoring** — Assigns a clearly-marked provisional score from onboarding signals until real data arrives.
54305. **Rich-text notes editor** — Formats notes with headings, lists, links, and callouts without leaving the target page.
54306. **Markdown support** — Writes notes in Markdown with live preview for technical documentation.
54307. **Note pinning** — Pins critical notes to the top of the target's notes panel so context is never buried.
54308. **Note templates** — Starts notes from templates like "Access credentials", "Scope caveats", or "Client contacts".
54309. **Timestamped annotations** — Attaches notes to specific timeline events with one click from the event row.
54310. **Screenshot attachments** — Embeds annotated screenshots directly inside notes with drag and drop.
54311. **File attachments** — Attaches PDFs, scope letters, and VPN configs to notes with access controls.
54312. **Code snippet blocks** — Pastes curl commands, configs, and payloads with syntax highlighting inside notes.
54313. **Checklists inside notes** — Tracks multi-step setup tasks like credential provisioning as checkable lists.
54314. **@mentions in notes** — Notifies teammates from a note and links the mention to their inbox.
54315. **Note comment threads** — Discusses a note inline without spawning separate chat channels.
54316. **Note version history** — Restores earlier note revisions with per-edit diffs and authorship.
54317. **Full-text note search** — Searches across all notes in inventory with highlighted snippets.
54318. **Note tags** — Labels notes (credential, scope, access, contact) for filtering.
54319. **Private vs shared notes** — Marks sensitive notes visible only to their author or a restricted role.
54320. **Note authorship display** — Shows who wrote and last edited each note with relative timestamps.
54321. **Note export per target** — Downloads all notes for a target as Markdown or PDF for handoffs.
54322. **Quick-note from dashboard** — Adds a note to any target from its card via keyboard shortcut.
54323. **Quick-note during hunt** — Captures observations mid-hunt that land on the target's timeline automatically.
54324. **Note linking between targets** — References another target with `[[target]]` syntax to build cross-target context.
54325. **Note reminders** — Sets a follow-up date on a note that pings the author when due.
54326. **Note archiving** — Archives outdated notes out of the main view while keeping them searchable.
54327. **Note trash and restore** — Soft-deletes notes with 30-day restore instead of permanent loss.
54328. **Note permissions** — Controls who can create, edit, or delete notes per target or group.
54329. **Annotation on scope rules** — Pins explanatory notes directly onto individual scope rules.
54330. **Annotation on findings** — Adds analyst context notes onto findings from the target view.
54331. **Annotation on changes** — Marks detected changes with "expected deploy" or "investigating" notes.
54332. **Annotation on health incidents** — Records root-cause notes on downtime incidents for postmortems.
54333. **Drawing on screenshots** — Sketches arrows and boxes on attached screenshots to highlight areas.
54334. **Voice note attachments** — Records short audio notes for hands-busy field observations.
54335. **AI note summarization** — Generates a one-paragraph brief from a target's full note history on demand.
54336. **Note duplication** — Copies a note's structure to another target when setups repeat.
54337. **Note move between targets** — Relocates a misfiled note to the correct target preserving history.
54338. **Bulk note export** — Exports notes across a group or client selection for audits.
54339. **Note print view** — Renders a clean printable briefing from selected notes.
54340. **Note keyboard shortcut** — Opens the note composer from anywhere with a global shortcut.
54341. **Note word count** — Shows length stats to keep handoff notes appropriately detailed.
54342. **Last-edited indicator** — Badges notes edited in the last 24 hours so fresh context stands out.
54343. **Collaborative editing** — Shows live cursors when two teammates edit the same note.
54344. **Edit conflict resolution** — Merges or picks versions when simultaneous edits collide.
54345. **Notes API** — Creates and reads notes programmatically for migration and automation.
54346. **Note activity log** — Records note views, edits, and shares for sensitive-target auditing.
54347. **Note translation** — Translates notes between team languages while keeping the original.
54348. **Pinned-note digest** — Emails owners a weekly digest of pinned notes across their targets.
54349. **Note templates library** — Shares organization-wide note templates with versioning.
54350. **Scheduled note prompts** — Nudges owners monthly to refresh stale access notes.
54351. **Note anchoring to URLs** — Ties a note to a specific URL or endpoint within the target.
54352. **Note severity flags** — Marks notes as info, warning, or blocker for triage visibility.
54353. **Cross-target note search** — Finds every note mentioning a keyword across the whole inventory.
54354. **Note completeness suggestions** — Suggests missing note types per target (credentials? contacts? caveats?).
54355. **Client folders** — Organizes targets under client records with client-level dashboards and rollups.
54356. **Program folders** — Groups targets by bounty program with program rules inherited downward.
54357. **Custom groups** — Creates free-form groups like "Q4 focus" or "APAC retail" with drag-drop membership.
54358. **Nested group hierarchy** — Nests groups (Client → Program → Environment) with breadcrumb navigation.
54359. **Smart groups by query** — Auto-populates groups from saved search queries that re-evaluate on change.
54360. **Smart groups by tag** — Keeps groups in sync automatically as tags are added or removed.
54361. **Smart groups by risk band** — Maintains live Critical/High/Medium/Low collections from risk scores.
54362. **Smart groups by technology** — Auto-groups targets sharing a stack, e.g., all WordPress estates.
54363. **Smart groups by health** — Collects currently degraded or down targets for incident focus.
54364. **Smart groups by verification** — Gathers unverified or expired-verification targets for compliance sweeps.
54365. **Group drag-drop** — Moves targets between groups by dragging cards or rows.
54366. **Group color coding** — Assigns colors that tint member target cards for visual scanning.
54367. **Group icons and descriptions** — Gives each group an icon and purpose statement for shared understanding.
54368. **Group owners** — Names an accountable owner per group with escalation routing.
54369. **Group health rollup** — Aggregates member health into a single group status indicator.
54370. **Group risk rollup** — Shows average, max, and distribution of member risk scores.
54371. **Group findings rollup** — Totals findings by severity across the group for status reports.
54372. **Group activity feed** — Streams member-target events into one group-level timeline.
54373. **Group-level scope defaults** — Defines baseline scope rules inherited by member targets unless overridden.
54374. **Group tag inheritance** — Applies group tags to members automatically with visible inheritance markers.
54375. **Group hunt scheduling** — Schedules hunts across all member targets with stagger and concurrency controls.
54376. **Group dashboards** — Renders the standard dashboard widgets scoped to one group's inventory.
54377. **Group comparison** — Compares two groups side by side on risk, findings, health, and coverage.
54378. **Group search** — Finds groups by name, owner, tag, or member target instantly.
54379. **Group bulk actions** — Tags, pauses, schedules, or exports all member targets at once.
54380. **Group archiving** — Archives a group and optionally its member targets with restore support.
54381. **Group permissions and teams** — Restricts group visibility and actions to assigned teams or roles.
54382. **Group notifications** — Subscribes members to group-level digests for changes, findings, and health.
54383. **Group reports** — Generates rollup PDF reports per group for client or management reviews.
54384. **Group change digests** — Sends combined change-detection summaries across member targets.
54385. **Group templates** — Saves group structures (subgroups, defaults, schedules) as reusable blueprints.
54386. **Group cloning** — Duplicates a group's structure and settings for a new client or season.
54387. **Group merge** — Combines two groups, resolving tag and scope-default conflicts interactively.
54388. **Group split** — Divides a group by filter criteria into two with membership preview.
54389. **Group audit log** — Records membership changes, setting edits, and bulk actions per group.
54390. **Group favorites** — Stars frequently used groups for a personal quick-access list.
54391. **Group sharing links** — Shares read-only group dashboards with clients via expiring links.
54392. **Group export** — Downloads group definition plus member list as JSON or CSV.
54393. **Group import** — Recreates groups from exported definitions during migrations.
54394. **Group statistics** — Shows member counts, avg risk, open findings, and hunt coverage per group.
54395. **Group timeline** — Merges member timelines into one chronological group view.
54396. **Group notes** — Keeps shared notes at group level visible across member targets.
54397. **Group hunt calendar** — Displays scheduled hunts for member targets on a shared calendar.
54398. **Group SLA tracking** — Tracks hunt-cadence and response SLAs aggregated per group.
54399. **Group API keys** — Issues scoped API credentials limited to a group's targets.
54400. **Move targets between groups** — Transfers targets with history, notes, and scope intact.
54401. **Group membership preview** — Previews which targets a smart-group query would include before saving.
54402. **Group-level verification status** — Shows verification coverage across members for compliance.
54403. **Group onboarding checklist** — Tracks setup completeness averaged across member targets.
54404. **Default system groups** — Auto-maintains "All targets", "Unverified", and "Recently added" groups.
54405. **Global search bar** — Searches targets, notes, scope rules, and findings from one persistent header input.
54406. **Command palette (Cmd+K)** — Jumps to targets, actions, and pages from a keyboard-first palette.
54407. **Fuzzy name matching** — Finds targets despite typos and partial names with ranked results.
54408. **Search by domain** — Matches exact domains, subdomains, and parent domains intelligently.
54409. **Search by IP address** — Finds targets by any resolved IP, including historical resolutions.
54410. **CIDR search** — Returns all targets with assets inside a given IP range.
54411. **Search by ASN** — Lists targets hosted on a specific autonomous system number.
54412. **Search by tag (targets)** — Filters to targets carrying any or all of selected tags.
54413. **Search by technology** — Finds targets running a framework, CMS, or server with version filters.
54414. **Search by owner** — Lists targets assigned to a person or team, including unassigned.
54415. **Search inside notes** — Full-text searches note bodies with highlighted match snippets.
54416. **Search inside scope rules** — Finds targets whose scope rules mention a host or pattern.
54417. **Advanced query builder** — Builds complex filters with AND/OR/NOT groups in a visual editor.
54418. **Search operators (targets)** — Supports `tag:`, `tech:`, `owner:`, `risk:>70` style operators in the search box.
54419. **Regex search** — Allows regular expressions for power-user pattern matching across fields.
54420. **Saved searches (targets)** — Saves named filter sets with one-click re-run and sharing.
54421. **Filter by lifecycle state** — Narrows to active, paused, draft, pending verification, or archived.
54422. **Filter by health status** — Shows only healthy, degraded, down, or maintenance targets.
54423. **Filter by risk band** — Slices inventory into Critical/High/Medium/Low score bands.
54424. **Filter by verification status** — Isolates verified, pending, expired, or failed targets.
54425. **Filter by program** — Limits results to targets linked to chosen bounty programs.
54426. **Filter by client or group** — Scopes search to selected organizational groupings.
54427. **Filter by date added** — Finds targets onboarded in custom ranges like "last 30 days".
54428. **Filter by last hunt** — Surfaces targets not hunted since a chosen date for coverage gaps.
54429. **Filter by change recency** — Lists targets with detected changes in the last N days.
54430. **Filter combinations** — Stacks multiple filters with clear chips and per-chip removal.
54431. **Filter presets** — One-click presets like "Needs attention", "Ready to hunt", "Client review".
54432. **Quick filter chips** — Toggles common filters above the list without opening the builder.
54433. **Search result highlighting (targets)** — Highlights matched terms in names, domains, and snippets.
54434. **Result ranking** — Orders results by relevance with exact matches first.
54435. **Autocomplete suggestions** — Suggests targets, tags, and operators as you type.
54436. **Recent searches** — Recalls your last searches for quick re-runs.
54437. **Search within group** — Constrains any search to the currently viewed group.
54438. **Search result columns config** — Chooses which fields appear in search result tables.
54439. **Export search results** — Downloads filtered results with selected columns to CSV.
54440. **Bulk act on results** — Tags, groups, or schedules hunts directly from the result set.
54441. **Sub-100ms search** — Keeps search snappy on ten-thousand-target inventories via indexing.
54442. **Keyboard shortcut (/)** — Focuses search instantly from anywhere in the app.
54443. **IDN/punycode search** — Matches internationalized domains in either Unicode or punycode form.
54444. **Certificate fingerprint search** — Finds targets sharing a TLS certificate fingerprint.
54445. **Technology version search** — Filters like "WordPress < 6.0" for vulnerable-stack sweeps.
54446. **Empty-state search tips** — Suggests broader queries and filter removals when nothing matches.
54447. **Phonetic client search** — Matches client names despite spelling variations.
54448. **Search history (targets)** — Keeps a personal log of past queries with re-run links.
54449. **Search API (targets)** — Runs saved and ad-hoc searches programmatically for integrations.
54450. **Cross-field search** — Matches a term across name, domain, IP, tags, and notes simultaneously.
54451. **Negation filters** — Excludes criteria with NOT, e.g., all targets not tagged "legacy".
54452. **Date-range quick picks** — Offers today, 7d, 30d, 90d presets on date filters.
54453. **Filter share links** — Shares a filtered view via URL that reproduces the exact filter set.
54454. **Search analytics** — Shows which queries teams run most to inform taxonomy improvements.
54455. **Lifecycle state machine** — Models Draft → Pending Verification → Active → Paused → Archived with guarded transitions.
54456. **Active state** — Marks targets eligible for hunts, monitoring, and change detection.
54457. **Paused state** — Suspends hunts and alerts while preserving all history and configuration.
54458. **Archived state** — Moves retired targets to read-only cold storage excluded from active views.
54459. **Draft state** — Holds incomplete onboarding entries out of operational views until finished.
54460. **Pending-verification state** — Flags targets awaiting ownership proof with hunt execution blocked.
54461. **Retired state** — Marks decommissioned assets distinctly from archived client work.
54462. **Transition reason codes** — Requires selecting a reason (client request, outage, completed, duplicate) on state changes.
54463. **Transition audit log** — Records every state change with actor, timestamp, and reason.
54464. **Pause with resume date** — Schedules automatic reactivation when pausing for known maintenance.
54465. **Auto-resume scheduler** — Reactivates paused targets at the set date and notifies the owner.
54466. **Pause drains hunt queues** — Gracefully stops queued hunts when a target pauses, with resume markers.
54467. **Archive retention choice** — Chooses per-archive whether to keep findings, logs, and screenshots or purge them.
54468. **Archived read-only mode** — Prevents edits to archived targets while keeping full historical browsing.
54469. **Lifecycle badges** — Shows color-coded state badges on cards, rows, and headers everywhere.
54470. **Lifecycle filters** — Slices dashboards and searches by any lifecycle state combination.
54471. **Lifecycle change notifications** — Alerts owners and subscribers on every state transition.
54472. **Bulk lifecycle transitions** — Pauses or archives many targets at once with per-item reason defaults.
54473. **Lifecycle automation rules** — Auto-pauses targets after N days of downtime or auto-archives after a year idle.
54474. **Scheduled state changes** — Queues future transitions, e.g., archive a campaign target on contract end date.
54475. **Expiry-based auto-archive** — Archives targets whose program ended or domain expired, with warning first.
54476. **Reactivation checklist** — Walks through verification, scope review, and health check before re-activating.
54477. **Reactivation verification re-check** — Re-runs ownership verification when a long-archived target returns.
54478. **Reactivation scope review** — Forces a scope diff review against the current program before going active again.
54479. **Duplicate handling on reactivate** — Detects if a similar target was created during archival and offers merge.
54480. **Lifecycle timeline per target** — Visualizes all state changes on the target's timeline.
54481. **Lifecycle permissions** — Restricts who can archive or delete versus who can pause and resume.
54482. **Lifecycle undo** — Reverts the last transition within a grace period with one click.
54483. **Lifecycle API (targets)** — Drives state changes from external asset-management or CMDB systems.
54484. **Lifecycle webhooks** — Emits events on transitions for ticketing and ChatOps integrations.
54485. **State-based notification routing** — Sends alerts only for active targets, digests for paused ones.
54486. **State-based dashboard sections** — Separates active operations from paused and archived inventory visually.
54487. **Verification-gated activation** — Blocks the Draft → Active transition until ownership verification passes.
54488. **Lifecycle comments** — Attaches discussion to transitions, e.g., why a client asked to pause.
54489. **State change approval** — Requires a second approver for archiving targets with open critical findings.
54490. **Lifecycle SLA tracking** — Measures time-in-state to spot targets stuck pending verification too long.
54491. **Lifecycle reports** — Summarizes transitions, active counts, and churn for management reviews.
54492. **Onboarding-to-active flow** — Chains wizard completion directly into activation with no dead ends.
54493. **Decommissioned asset handling** — Guides NXDOMAIN or parked targets into retired state with evidence.
54494. **Lifecycle templates per client** — Defines custom allowed transitions and approvers per client policy.
54495. **Stale-paused nudges** — Reminds owners of targets paused longer than 90 days to decide: resume or archive.
54496. **Archive browsing** — Searches and previews archived targets without restoring them.
54497. **Archive restore** — Brings archived targets back with scope, notes, and history intact.
54498. **Permanent delete with safeguards** — Requires typing the target name and a second approval to hard-delete.
54499. **Lifecycle event annotations** — Notes context on transitions for future audits.
54500. **Cross-target lifecycle rules** — Applies "pause all targets of client X" as one governed action.
54501. **Lifecycle-based hunt scheduling** — Only schedules hunts for active targets; paused ones queue on resume.
54502. **State transition emails** — Sends templated emails to clients on pause, resume, and archive events.
54503. **Lifecycle compliance view** — Proves to auditors that testing only ran against active, verified, in-scope targets.
54504. **Re-verification on ownership change** — Resets verification when WHOIS or program signals suggest the owner changed.
54505. **CSV file upload** — Drags in a CSV of domains, IPs, or URLs with automatic encoding detection.
54506. **CSV template download** — Provides a pre-formatted template with example rows and column docs.
54507. **Column mapping UI** — Maps arbitrary CSV headers to target fields with live preview.
54508. **Delimiter auto-detection** — Handles comma, semicolon, tab, and pipe-delimited files transparently.
54509. **Asset list paste** — Pastes newline-separated hosts directly into an import box for quick bulk adds.
54510. **JSON import** — Accepts structured JSON arrays for scripted provisioning pipelines.
54511. **Spreadsheet (xlsx) import** — Reads Excel workbooks including multi-sheet files with sheet picker.
54512. **Google Sheets link import** — Syncs from a shared sheet URL on demand or schedule.
54513. **Import from URL** — Fetches a hosted asset list over HTTP(S) for recurring syncs.
54514. **HackerOne asset sync (targets)** — Pulls in-scope assets directly from connected HackerOne programs.
54515. **Bugcrowd asset sync** — Imports Bugcrowd program targets via API with scope mapping.
54516. **Intigriti asset sync** — Syncs Intigriti program domains into inventory automatically.
54517. **YesWeHack asset sync** — Imports YesWeHack program scope into the target inventory.
54518. **Import preview table** — Shows the first 100 parsed rows with detected issues before committing.
54519. **Inline validation errors** — Highlights bad rows (invalid domains, bad IPs) in the preview with fix hints.
54520. **Duplicate detection on import** — Matches incoming rows against existing inventory by normalized domain/IP.
54521. **Merge vs skip duplicates** — Chooses per-run whether duplicates merge metadata or are skipped.
54522. **Dedup key configuration** — Defines which fields identify duplicates (domain, IP+port, custom ID).
54523. **Tag assignment on import** — Applies tags to every imported target, e.g., "imported-2026-10".
54524. **Group assignment on import** — Places all imported targets into a chosen group or client.
54525. **Client assignment on import** — Attributes bulk imports to the correct client for MSSP billing.
54526. **Scope defaults on import** — Applies a scope template to every target in the batch.
54527. **Owner assignment on import** — Sets a default owner for the batch with per-row override column.
54528. **Verification queue for imports** — Routes imported targets into pending-verification with bulk verify tools.
54529. **Ownership attestation checkbox** — Requires confirming authorization for the whole batch before import runs.
54530. **Import dry-run mode** — Simulates the import showing creates, merges, and skips without writing anything.
54531. **Import rollback (targets)** — Reverts a completed import batch entirely from the import history log.
54532. **Import history log** — Records every import with source, row counts, user, and timestamp.
54533. **Import progress bar** — Shows live progress for large imports with cancel support.
54534. **Chunked large imports** — Processes 100k-row files in background chunks without timing out.
54535. **Partial success handling** — Commits valid rows and reports failures separately instead of all-or-nothing.
54536. **Error report download** — Downloads failed rows with reasons as CSV for correction and retry.
54537. **Field normalization** — Lowercases domains, strips protocols and trailing slashes automatically.
54538. **Import scheduling** — Re-runs URL or sheet imports nightly to keep inventory synced.
54539. **Import API endpoint** — Accepts bulk target payloads programmatically with API key auth.
54540. **Import webhooks** — Notifies external systems when scheduled imports complete with summary stats.
54541. **Import completion notifications** — Emails the importer a summary of created, merged, and skipped rows.
54542. **Saved import templates** — Stores column mappings and defaults as reusable named templates.
54543. **Sample-first mode** — Imports 10 rows, pauses for review, then continues on approval.
54544. **Conflict resolution UI** — Resolves field-level conflicts when merging duplicates interactively.
54545. **Import audit trail (targets)** — Logs every row-level create, merge, and skip for compliance.
54546. **Import permissions** — Restricts bulk import to authorized roles to prevent inventory pollution.
54547. **Import rate limiting** — Throttles import API calls to protect backend processing.
54548. **Clipboard import** — Pastes directly from spreadsheet copy-paste with tab handling.
54549. **Import from CMDB** — Connectors pull asset lists from ServiceNow or similar CMDBs.
54550. **Import field validation rules** — Defines required fields and formats enforced on every import.
54551. **Default lifecycle for imports** — Sets imported targets to draft or pending-verification automatically.
54552. **Import tagging by source** — Auto-tags rows with their source system for traceability.
54553. **Scheduled import diff alerts** — Notifies when a recurring import adds or removes assets versus last run.
54554. **Import deduplication preview** — Shows which incoming rows match existing targets before committing.
54555. **DNS TXT record verification** — Verifies ownership by detecting a unique token in the domain's TXT records.
54556. **File upload verification** — Confirms ownership via a token file placed at a well-known URL path.
54557. **Meta tag verification** — Checks for an ownership meta tag in the site's homepage HTML.
54558. **HTML comment verification** — Detects an ownership token inside an HTML comment for tag-averse teams.
54559. **Email to security contact** — Sends a confirmation link to security@ or abuse@ derived from the domain.
54560. **WHOIS registrant email verification** — Mails the registrant contact on file for private registrations.
54561. **Bounty platform attestation** — Accepts program membership on HackerOne/Bugcrowd as ownership evidence.
54562. **Signed attestation upload** — Accepts a client-signed authorization letter stored as verification evidence.
54563. **OAuth domain verification** — Uses Google Workspace or Microsoft 365 domain admin OAuth as proof.
54564. **SSL organization match** — Matches OV/EV certificate organization fields against the claimed owner.
54565. **ASN ownership check** — Verifies IP ranges against the organization's announced ASNs.
54566. **Cloud account ownership** — Confirms via AWS/GCP/Azure account linkage for cloud-hosted targets.
54567. **Registrar API verification** — Uses registrar APIs to confirm domain control where supported.
54568. **Manual review queue** — Routes edge cases to a human reviewer with evidence packet attached.
54569. **Verification method picker** — Recommends the fastest applicable method based on detected DNS and hosting.
54570. **Guided verification steps** — Walks users through each method with copy-paste commands and screenshots.
54571. **Verification code generator** — Issues unique per-target tokens that expire after 30 days.
54572. **One-click verification check** — Re-checks the token presence on demand with clear pass/fail feedback.
54573. **Verification retry with backoff** — Retries DNS-based checks honoring TTL propagation delays automatically.
54574. **Verification troubleshooting tips** — Shows DNS propagation checkers and common failure fixes inline.
54575. **Verification status badges** — Displays verified, pending, expired, or failed states across the UI.
54576. **Verification expiry and renewal** — Expires verifications annually with renewal reminders and grace periods.
54577. **Re-verification triggers** — Re-checks ownership on registrar, nameserver, or program-link changes.
54578. **Subdomain inheritance** — Verifies subdomains automatically once the parent domain is verified.
54579. **Wildcard verification** — Covers `*.example.com` with a single parent-domain proof.
54580. **Verification delegation** — Lets owners assign the verification task to a teammate with instructions.
54581. **Verification evidence storage** — Keeps screenshots and DNS dig outputs as tamper-evident proof.
54582. **Verification audit trail** — Logs method, actor, timestamps, and evidence for every verification.
54583. **Verification webhooks** — Emits events when targets verify, expire, or fail for downstream automation.
54584. **Verification API** — Triggers checks and reads status programmatically for provisioning flows.
54585. **Bulk verification actions** — Starts checks for many pending targets and tracks them on one screen.
54586. **Verification reminders** — Nudges assignees of stale pending verifications on a schedule.
54587. **Verification SLA tracking** — Measures time-to-verify per team to spot onboarding bottlenecks.
54588. **Verification dashboard widget** — Summarizes verification coverage with drill-down action lists.
54589. **Hunt blocked banner** — Shows an unmissable banner on unverified targets explaining hunts are blocked.
54590. **Verification-gated hunt start** — Prevents hunt execution until verification passes, with override audit for emergencies.
54591. **Verification-gated report export** — Blocks external report sharing for unverified targets.
54592. **Verification for imported targets** — Auto-queues bulk-imported assets into the verification pipeline.
54593. **Verification notes** — Records context like "CNAME to vendor, verifying via platform attestation".
54594. **Approver role for verification** — Requires a second role to approve manual-review verifications.
54595. **Acquired-domain verification** — Handles newly acquired domains with registrar-change evidence flow.
54596. **Verification via platform API** — Confirms scope membership directly through bounty platform APIs.
54597. **Verification history timeline** — Shows every verification attempt, method, and outcome chronologically.
54598. **Multi-method fallback** — Suggests the next-best method automatically when the first fails.
54599. **Verification for IP ranges** — Supports ASN letters and rDNS evidence for network-range targets.
54600. **Verification check scheduling** — Re-validates a sample of verified targets monthly to catch silent changes.
54601. **Verification certificate download** — Issues a dated verification certificate PDF for client records.
54602. **Verification status badge embed** — Provides a live verification badge for external dashboards.
54603. **Cross-target verification reuse** — Reuses one DNS proof across multiple targets on the same domain.
54604. **Verification failure playbook** — Links each failure reason to a step-by-step remediation guide.
54605. **Overlapping rule detection** — Finds scope rules whose patterns cover the same hosts and flags redundancy.
54606. **Include/exclude contradiction alerts** — Warns when a host is both included and excluded with no clear precedence.
54607. **Wildcard vs explicit conflicts** — Highlights `*.example.com` includes fighting `app.example.com` excludes.
54608. **Cross-target scope overlap** — Detects two targets claiming the same hosts, common after acquisitions.
54609. **Cross-program scope overlap** — Flags assets appearing in two bounty programs' scopes simultaneously.
54610. **Out-of-scope inside in-scope warning** — Catches exclusions that swallow the entire included area.
54611. **Overbroad wildcard alerts** — Blocks or warns on patterns like `*` that would authorize unintended testing.
54612. **Scope vs discovered assets mismatch** — Compares rules against real inventory and lists assets no rule matches.
54613. **Scope vs program rules mismatch** — Diffs local rules against the platform's published scope for drift.
54614. **Conflict severity levels** — Grades conflicts as blocking, warning, or informational for triage.
54615. **One-click conflict resolution** — Applies the suggested fix (reorder, narrow, or remove) with preview.
54616. **Conflict resolution suggestions** — Explains each conflict in plain language with two or three fix options.
54617. **Conflict list view** — Centralizes all scope conflicts across inventory with filters and assignment.
54618. **Conflict badges on targets** — Shows a visible badge on targets carrying unresolved scope conflicts.
54619. **Conflict notifications** — Alerts rule authors and target owners when new conflicts appear.
54620. **Conflict audit log** — Records detection, assignment, resolution, and ignore actions.
54621. **Conflict resolution history** — Keeps past resolutions to inform similar future conflicts.
54622. **CIDR overlap detection** — Finds intersecting IP ranges across rules and targets.
54623. **Port range overlap detection** — Flags overlapping port inclusions that duplicate coverage.
54624. **Path prefix overlap detection** — Spots `/api/*` vs `/api/v1/*` redundancies in path-scoped rules.
54625. **Case-sensitivity conflicts** — Warns when case handling differs between overlapping rules.
54626. **Trailing-slash conflicts** — Flags rules that disagree only on trailing-slash normalization.
54627. **Punycode conflicts** — Detects Unicode vs punycode rule pairs that overlap silently.
54628. **Third-party exclusion conflicts** — Warns when an exclusion removes a host another rule explicitly includes.
54629. **Rule shadowing detection (targets)** — Identifies rules that can never fire due to earlier broader rules.
54630. **Redundant rule detection** — Finds rules fully covered by others and offers safe removal.
54631. **Rule order impact preview** — Simulates how reordering changes effective scope before saving.
54632. **Effective-scope recompute** — Rebuilds the match-everything view instantly after any rule edit.
54633. **Pre-save conflict simulation** — Checks a rule for conflicts as it's typed, before it enters the set.
54634. **Conflict dashboard widget** — Summarizes open conflicts by severity with direct links.
54635. **Bulk conflict review** — Triages many conflicts with multi-select resolve, assign, or ignore.
54636. **Conflict assignment** — Assigns conflicts to owners with due dates and escalation.
54637. **Conflict SLA tracking** — Measures days-to-resolve to keep scope hygiene healthy.
54638. **Conflict comments** — Discusses tricky overlaps inline with the conflicting rules visible.
54639. **Conflict export** — Downloads open conflicts for review meetings or audits.
54640. **Ignore with reason** — Dismisses false-positive conflicts only with a documented justification.
54641. **Conflict auto-fix rules** — Defines policies like "explicit beats wildcard" applied automatically.
54642. **Scheduled conflict scans** — Re-runs conflict detection nightly across the whole inventory.
54643. **Conflict vs change interplay** — Re-checks conflicts when change detection adds new assets.
54644. **Conflict documentation links** — Links each conflict type to docs explaining the semantics.
54645. **Conflict API** — Exposes open conflicts for external governance dashboards.
54646. **Conflict webhooks** — Pushes new-conflict events to Slack or ticketing on detection.
54647. **Method overlap detection** — Flags HTTP-method rules that contradict host-level includes.
54648. **Geo/ASN rule conflicts** — Catches geo or ASN rules that nullify each other.
54649. **Time-box overlap conflicts** — Warns when scheduled rules create coverage gaps between windows.
54650. **Inherited vs override conflicts** — Highlights program-inherited rules fighting target-level overrides.
54651. **Duplicate rule detection** — Finds byte-identical or semantically identical rules across the set.
54652. **Stale exclusion review** — Surfaces exclusions older than a year for re-confirmation.
54653. **Conflict-free certification** — Stamps a scope "conflict-free" with date for audit evidence.
54654. **Scope lint score** — Grades overall rule-set hygiene 0–100 with improvement tips.
54655. **Technology profile page** — Presents every target's detected stack on one organized profile tab.
54656. **Framework and version list** — Shows web frameworks with detected versions and confidence levels.
54657. **CMS identification display** — Lists CMS platforms like WordPress or Drupal with version where known.
54658. **Server software display** — Records web server and version banners observed in responses.
54659. **Language and runtime display** — Notes PHP, Node.js, Python, Java, or .NET signals per target.
54660. **JavaScript library inventory** — Catalogs frontend libraries with versions for supply-chain awareness.
54661. **Third-party script list** — Enumerates external scripts loaded by key pages with their providers.
54662. **CDN usage display** — Shows which CDN serves the target and which assets it fronts.
54663. **Analytics and tracking tools** — Lists detected analytics, tag managers, and pixels.
54664. **Payment provider display** — Notes Stripe, Adyen, or other payment integrations on checkout flows.
54665. **Auth provider display** — Records SSO, OAuth, and identity providers in use.
54666. **WAF fingerprint display** — Shows detected WAF vendor to inform hunt configuration.
54667. **Cloud provider mapping** — Maps assets to AWS, GCP, Azure, or others with region hints.
54668. **Container hints** — Notes Kubernetes, Docker, or orchestration signals where visible.
54669. **Database hints** — Records database technology clues from error pages or headers.
54670. **Mobile SDK list** — Catalogs SDKs detected in linked mobile apps.
54671. **Profile confidence scores** — Grades each detected technology high/medium/low confidence.
54672. **Profile last-updated stamp** — Shows when the profile was last refreshed to judge freshness.
54673. **One-click profile refresh** — Re-runs technology profiling on demand for a target.
54674. **Profile change history (targets)** — Diffs profile snapshots over time like a stack changelog.
54675. **Profile completeness meter (targets)** — Scores how much of the stack is identified vs unknown.
54676. **Missing-data prompts** — Suggests manual inputs where automated profiling came up empty.
54677. **Manual profile overrides** — Lets analysts correct wrong detections with an audit trail.
54678. **Profile correction workflow** — Routes disputed detections to a reviewer before they change.
54679. **Profile notes** — Annotates profile entries, e.g., "custom fork of Laravel".
54680. **Profile source attribution** — Shows which scan or observation produced each data point.
54681. **Profile merge from scans** — Combines multiple profiling runs into one deduplicated view.
54682. **Profile diff view** — Compares two snapshots side by side with added/removed highlights.
54683. **Profile timeline** — Plots stack changes chronologically alongside deploys.
54684. **Profile verification toggle** — Marks profile entries as human-confirmed for hunt planning.
54685. **EOL technology alerts** — Warns when profiles contain end-of-life frameworks or runtimes.
54686. **Profile-based risk factors** — Feeds risky stack choices directly into the target risk score.
54687. **Profile-based grouping** — Powers smart groups like "all Laravel targets" from profile data.
54688. **Profile-based hunt hints** — Suggests hunt focus areas based on the detected stack.
54689. **Profile-based scope suggestions** — Recommends scope additions when profiles reveal new sub-applications.
54690. **Profile search and filter** — Finds targets by any stack component across inventory.
54691. **Bulk profile refresh** — Re-profiles many targets on a schedule or on demand.
54692. **Profile refresh scheduling** — Sets per-target or per-group re-profile cadences.
54693. **Profile export as JSON** — Downloads structured stack data for external tooling.
54694. **Profile API (targets)** — Reads profile data programmatically for integrations.
54695. **Profile widgets** — Embeds stack summaries on dashboard cards and rows.
54696. **Profile icons** — Shows recognizable technology logos for fast visual scanning.
54697. **Profile sharing (targets)** — Shares read-only stack summaries with clients via link.
54698. **Profile documentation links** — Links each technology to its official docs and security guides.
54699. **Technology tag auto-suggest** — Proposes inventory tags derived from profile entries.
54700. **Profile comparison across targets** — Diffs stack profiles of selected targets side by side.
54701. **Profile-driven onboarding** — Pre-fills onboarding review screens from an initial profile pass.
54702. **Profile quality badges** — Marks profiles as rich, partial, or sparse based on coverage.
54703. **Deprecated tech migration tracker** — Tracks targets still on flagged stacks across quarters.
54704. **Profile changelog digest** — Emails weekly stack-change summaries per group.
54705. **Hunt history timeline** — Lists every hunt run on the target chronologically with status and outcomes.
54706. **Hunt list table** — Shows hunts in a sortable table with duration, findings, and coverage columns.
54707. **Hunt status badges** — Marks runs as completed, failed, aborted, or running at a glance.
54708. **Hunt duration display** — Records wall-clock time per hunt for effort analysis.
54709. **Findings count per hunt** — Shows valid findings each hunt produced, linked to the findings.
54710. **Coverage percentage per hunt** — Displays what share of in-scope assets each hunt exercised.
54711. **Hunt configuration snapshot** — Freezes the exact settings, scope, and agent version used per run.
54712. **Triggered-by attribution** — Records whether a hunt was manual, scheduled, or change-triggered.
54713. **Hunt log links** — Jumps from history entries into full execution logs.
54714. **Hunt report links** — Opens the PDF or web report generated for each hunt.
54715. **Hunt-to-hunt comparison** — Diffs two runs on coverage, findings, and duration side by side.
54716. **Findings trend chart** — Plots findings per hunt over time to show security posture trajectory.
54717. **Coverage trend chart** — Tracks whether hunt coverage is improving run over run.
54718. **Hunt frequency stats** — Shows hunts per month and average gap between runs.
54719. **Last hunt widget** — Surfaces recency, outcome, and top finding of the most recent hunt.
54720. **Next scheduled hunt** — Displays the upcoming run with countdown and editable schedule.
54721. **Per-target hunt scheduling** — Sets cadence (weekly, monthly, on-change) individually per target.
54722. **Hunt cadence config** — Defines default cadences per group or risk band with overrides.
54723. **Hunt notes per run** — Lets analysts annotate runs with context like "used new creds".
54724. **Hunt rating** — Rates run quality to feed scheduler and agent tuning.
54725. **Hunt cost and time stats** — Tracks compute time and estimated cost per hunt for budgeting.
54726. **Hunt depth indicator** — Records how deep (quick, standard, deep) each run went.
54727. **Scope snapshot per hunt** — Stores the exact effective scope at hunt time for reproducibility.
54728. **Verification status at hunt time** — Captures whether the target was verified when each hunt ran.
54729. **Change context per hunt** — Lists asset changes detected since the previous hunt alongside results.
54730. **Hunt annotations** — Pins analyst notes onto specific hunt events in history.
54731. **Hunt history export** — Downloads run history as CSV for client reporting.
54732. **Hunt history API** — Queries past runs programmatically for external dashboards.
54733. **Hunt search and filter** — Finds runs by date, status, findings, or triggering user.
54734. **Hunt calendar view (targets)** — Shows past and scheduled hunts on a per-target calendar.
54735. **Hunt failure alerts** — Notifies owners when runs fail with error summaries and retry links.
54736. **One-click hunt retry** — Re-queues a failed hunt with identical configuration.
54737. **Hunt config cloning** — Copies a past run's settings as the starting point for a new hunt.
54738. **Hunt gap analysis** — Highlights in-scope assets no hunt has covered in the selected period.
54739. **Hunt coverage map (targets)** — Visualizes which subdomains and endpoints past hunts actually exercised.
54740. **Hunt deletion with audit** — Removes test runs from history only with reason and audit entry.
54741. **Hunt archiving (targets)** — Moves old runs to cold storage while keeping summary stats.
54742. **Hunt history retention** — Configures per-client how long detailed run data is kept.
54743. **Hunt sharing links** — Shares read-only run summaries with clients via expiring links.
54744. **Hunt notifications** — Alerts subscribers on hunt start, completion, and finding milestones.
54745. **Hunt vs findings correlation** — Shows which hunt characteristics precede the most findings.
54746. **Scheduled hunt pause on target pause** — Skips scheduled runs while a target is paused, resuming after.
54747. **Hunt streak tracking** — Counts consecutive successful hunts per target for reliability views.
54748. **First-hunt onboarding** — Guides the very first hunt per target with recommended settings.
54749. **Hunt dry-run preview** — Shows what a scheduled hunt would cover before it executes.
54750. **Hunt blackout windows** — Prevents scheduling during client-defined freeze periods.
54751. **Hunt priority per target** — Sets per-target priority that the scheduler respects.
54752. **Hunt concurrency limits** — Caps simultaneous hunts per target to avoid overload.
54753. **Hunt history in target profile** — Embeds the latest runs summary on the target overview tab.
54754. **Cross-target hunt benchmarking** — Compares a target's hunt stats against portfolio averages.
54755. **Side-by-side target compare** — Places two to four targets next to each other with aligned sections.
54756. **Comparison table** — Renders chosen metrics as rows and targets as columns for scanning.
54757. **Risk score comparison** — Charts risk scores with factor breakdowns per target.
54758. **Technology stack comparison** — Diffs frameworks, servers, and libraries across targets.
54759. **Findings comparison** — Contrasts finding counts by severity across selected targets.
54760. **Health comparison** — Shows uptime, latency, and incident counts side by side.
54761. **Change velocity comparison** — Compares detected-change volumes over the same period.
54762. **Scope size comparison** — Contrasts rule counts and covered-asset estimates.
54763. **Hunt coverage comparison** — Shows which target gets hunted most thoroughly.
54764. **Radar chart comparison** — Plots risk dimensions on a radar chart for up to four targets.
54765. **Bar chart comparison** — Visualizes any numeric metric across targets as grouped bars.
54766. **Delta highlighting** — Colors cells where targets differ significantly from the group.
54767. **Best and worst badges** — Labels the top and bottom performer per compared metric.
54768. **Persistent comparison tray** — Pins targets from anywhere into a persistent comparison tray.
54769. **Saved comparison views** — Stores named target sets with chosen metrics for repeat reviews.
54770. **Comparison sharing** — Shares read-only comparison links with clients or teammates.
54771. **Comparison PDF export (targets)** — Generates a printable comparison report for meetings.
54772. **Comparison CSV export (targets)** — Downloads the comparison matrix for spreadsheets.
54773. **Compare from search results** — Selects result rows and launches comparison in one click.
54774. **Compare from groups** — Compares all members of a group or two groups head to head.
54775. **Comparison templates (targets)** — Starts from presets like "Risk review" or "Client QBR".
54776. **Comparison annotations (targets)** — Adds analyst commentary onto saved comparisons.
54777. **Comparison history** — Recalls past comparisons with their target sets and dates.
54778. **Comparison drill-down** — Clicks any cell to open the underlying target detail.
54779. **Comparison filters** — Narrows compared metrics to risk, health, findings, or activity.
54780. **Comparison sorting** — Orders target columns by any metric ascending or descending.
54781. **Timeline comparison** — Overlays target activity timelines to spot correlated events.
54782. **Tag overlap comparison** — Shows shared and unique tags across compared targets.
54783. **Program comparison (targets)** — Contrasts bounty terms and scope across program-linked targets.
54784. **Verification status comparison** — Lines up verification methods and expiry dates.
54785. **Lifecycle comparison** — Shows current states and recent transitions side by side.
54786. **Owner comparison** — Groups compared targets by owner to spot workload imbalance.
54787. **Bounty value comparison** — Contrasts reward ranges and payout history.
54788. **SLA comparison** — Lines up hunt cadence and response commitments.
54789. **Activity comparison** — Compares event volumes by type over the selected window.
54790. **Certificate hygiene comparison** — Grades TLS posture across targets in one table.
54791. **Target swap in comparison** — Replaces one compared target without rebuilding the view.
54792. **Comparison date-range selector** — Recomputes all compared metrics for custom windows.
54793. **Custom metric comparison** — Adds any target field or formula as a comparison row.
54794. **Benchmark vs portfolio average** — Shows each target against the portfolio mean per metric.
54795. **Percentile ranks** — Displays where each target sits percentile-wise among all targets.
54796. **Divergence alerts** — Notifies when compared targets' risk scores drift apart sharply.
54797. **Comparison keyboard shortcuts** — Adds, removes, and exports comparisons without the mouse.
54798. **Mobile comparison layout** — Stacks compared targets vertically with sticky metric labels.
54799. **Comparison print view** — Renders a clean print stylesheet for the comparison matrix.
54800. **Scheduled comparison reports (targets)** — Emails recurring comparison PDFs to stakeholders.
54801. **Comparison API** — Fetches comparison matrices programmatically for external reporting.
54802. **Comparison widgets** — Embeds live comparison charts on dashboards.
54803. **Notes comparison** — Shows pinned notes from each target side by side for context.
54804. **Comparison empty states** — Guides users to pick targets when fewer than two are selected.
54805. **HackerOne program sync** — Connects via API and imports program scope, rewards, and rules.
54806. **Bugcrowd program sync** — Pulls Bugcrowd program targets and bounty tables into inventory.
54807. **Intigriti program sync (targets)** — Syncs Intigriti program scope and severity guidance automatically.
54808. **YesWeHack program sync (targets)** — Imports YesWeHack program assets with scope mapping.
54809. **Platform OAuth connect** — Links bounty platform accounts via OAuth instead of pasting tokens.
54810. **API token vault storage** — Stores platform tokens encrypted with rotation reminders.
54811. **Program selector UI** — Browses connected programs and picks which to import with search.
54812. **Scope auto-parse** — Converts program policy text into structured include/exclude rules.
54813. **Bounty table import** — Captures reward ranges per severity for prioritization and reporting.
54814. **Out-of-scope auto-extraction** — Parses exclusion lists from program pages into exclusion rules.
54815. **Safe-harbor clause detection** — Flags whether the program offers legal safe harbor protections.
54816. **Disclosure policy import** — Records coordinated-disclosure timelines and requirements.
54817. **Program tier display** — Shows managed vs classic and program maturity indicators.
54818. **Program status tracking** — Monitors whether programs are active, paused, or closed.
54819. **Auto-refresh scheduling** — Re-syncs program data nightly or weekly to catch scope edits.
54820. **Manual refresh button** — Pulls the latest program state on demand with change summary.
54821. **Program change alerts** — Notifies owners when a program edits scope, rewards, or rules.
54822. **Program diff viewer** — Shows exactly what changed in the program since the last sync.
54823. **Rule mapping preview** — Previews how program text maps to structured rules before applying.
54824. **Manual mapping overrides** — Lets analysts fix mis-parsed rules with the original text preserved.
54825. **Program-to-target linking** — Connects imported programs to existing or new target records.
54826. **Multiple programs per target** — Supports targets listed on several platforms with per-program rules.
54827. **Program switch detection** — Alerts when a target moves between programs or platforms.
54828. **Program URL validation** — Verifies program links resolve before importing.
54829. **Asset type mapping** — Maps platform asset types (URL, CIDR, mobile, hardware) to target types.
54830. **Severity mapping** — Aligns platform severity scales with internal ratings.
54831. **Program SLA import** — Captures response-time expectations for triage planning.
54832. **Program contact import** — Stores program manager contacts for escalation.
54833. **Program logo display** — Shows platform and program branding on linked targets.
54834. **Program notes** — Keeps analyst notes about program quirks alongside the import.
54835. **Program tags** — Tags targets by platform and program automatically.
54836. **Program grouping** — Builds smart groups per program from imported data.
54837. **Program dashboard widget** — Summarizes linked programs with scope-match status.
54838. **Scope compliance check** — Verifies local rules still match the platform's current published scope.
54839. **Program report templates** — Uses platform-specific formats for exported findings.
54840. **Import audit log** — Records every program sync with changes applied.
54841. **Import error handling** — Surfaces API failures with retry and partial-import recovery.
54842. **Credential rotation reminders** — Nudges before platform API tokens expire.
54843. **Program deactivation handling** — Pauses linked targets gracefully when a program closes.
54844. **Program archive handling** — Moves ended programs' targets through the archive flow.
54845. **Reward change tracking** — Logs bounty table changes over time for value analysis.
54846. **Scope effective-date tracking** — Records when program scope edits take effect.
54847. **Program eligibility checks** — Flags researcher requirements like invite-only or identity verification.
54848. **Duplicate program detection** — Warns when the same program is connected twice via different tokens.
54849. **Program merge** — Consolidates duplicate program records preserving links and history.
54850. **Platform rate-limit handling (targets)** — Backs off gracefully on API limits with queued retries.
54851. **Selective program import** — Chooses which asset types or sections to import per program.
54852. **Program import dry-run** — Previews creates, links, and rule changes before applying.
54853. **Program webhooks** — Receives platform push events for scope or program changes instantly.
54854. **Program health check** — Verifies each platform connection on a schedule and alerts on failures.
54855. **Tag creation UI** — Creates tags with name, color, icon, and description in one dialog.
54856. **Tag color picker** — Assigns colors that render consistently on cards, rows, and filters.
54857. **Tag icons** — Adds emoji or icon markers for fast visual tag recognition.
54858. **Tag descriptions** — Documents what each tag means to keep usage consistent.
54859. **Tag categories** — Organizes tags into families like Technology, Priority, and Compliance.
54860. **Bulk tag apply** — Adds tags to many selected targets at once.
54861. **Bulk tag remove** — Strips tags from selections without touching other metadata.
54862. **Tag auto-suggest** — Recommends tags based on tech profile, program, and naming patterns.
54863. **Tag autocomplete** — Suggests existing tags as you type to prevent duplicates.
54864. **Tag filtering** — Narrows inventory to targets with any or all selected tags.
54865. **Tag search** — Finds tags by name across the organization.
54866. **Tag cloud view** — Visualizes tag popularity with sized, clickable labels.
54867. **Tag usage counts** — Shows how many targets carry each tag for taxonomy health.
54868. **Tag management page** — Centralizes rename, merge, delete, and color edits.
54869. **Tag rename propagation** — Updates the tag everywhere instantly when renamed.
54870. **Tag merge** — Combines duplicate tags, moving all assignments to the survivor.
54871. **Tag delete with reassignment** — Removes tags while optionally moving targets to a replacement.
54872. **Tag synonyms** — Maps alternate spellings to a canonical tag.
54873. **Tag permissions** — Restricts who can create or manage the shared tag taxonomy.
54874. **Tag audit log** — Records tag creation, assignment, and removal events.
54875. **Tag API** — Manages tags and assignments programmatically.
54876. **Tags in CSV import** — Assigns tags from import file columns during bulk import.
54877. **Tags on target cards** — Displays tags prominently with overflow handling.
54878. **Tags as table columns** — Shows tag lists in sortable inventory tables.
54879. **Tag-based smart groups** — Auto-maintains groups from tag membership.
54880. **Tag-based hunt scheduling** — Schedules hunts for all targets carrying specific tags.
54881. **Tag-based notifications** — Routes alerts by tag, e.g., all "pci" targets to compliance.
54882. **Tag-based reports** — Generates findings and inventory reports filtered by tag.
54883. **Tag-based dashboards** — Scopes dashboard widgets to a tag selection.
54884. **Tag templates** — Applies recommended tag sets per target type on creation.
54885. **Required tags policy** — Enforces mandatory tags (e.g., client, data-class) before activation.
54886. **Tag validation rules** — Blocks malformed or reserved tag names at creation.
54887. **Recent tags list** — Surfaces recently used tags for quick application.
54888. **Favorite tags** — Stars personal go-to tags for one-click filtering.
54889. **Tag sharing across teams** — Publishes team tags to the org taxonomy with approval.
54890. **Tag export and import** — Migrates the taxonomy between workspaces as JSON.
54891. **Tag analytics** — Charts findings and risk distribution per tag for insight.
54892. **Tag timeline** — Shows when tags were applied or removed per target.
54893. **Tag comments** — Discusses tag meaning and usage on the tag's own page.
54894. **Tag archiving** — Retires outdated tags while preserving historical assignments.
54895. **Tag deprecation** — Marks tags as deprecated with a suggested replacement.
54896. **Tag migration tool** — Moves assignments from deprecated tags in bulk with preview.
54897. **Tag documentation** — Maintains a living glossary of the tag taxonomy.
54898. **Risk-band auto-tags** — Applies and updates Critical/High/Medium/Low tags from risk scores.
54899. **Technology auto-tags** — Tags targets from profile data like "wordpress" or "cloudflare".
54900. **Program auto-tags** — Tags targets with their bounty platform and program slug.
54901. **Verification auto-tags** — Marks "unverified" automatically until verification passes.
54902. **Lifecycle auto-tags** — Reflects paused or archived states as tags for filtering.
54903. **Tag change notifications** — Alerts subscribers when watched tags are applied or removed.
54904. **Tag quick-apply shortcut** — Applies favorite tags from the keyboard without opening dialogs.
54905. **Unified activity timeline (targets)** — Merges hunts, findings, changes, notes, and admin events into one chronological view.
54906. **Event type filters** — Toggles hunts, findings, changes, health, notes, and scope events independently.
54907. **Timeline search** — Finds events by keyword across the full history.
54908. **Timeline date-range zoom** — Zooms the timeline to custom windows from hours to years.
54909. **Timeline zoom controls** — Switches between day, week, and month granularity.
54910. **Event detail drawer** — Opens any event for full context without leaving the timeline.
54911. **Actor attribution (targets)** — Shows who or what (user, scheduler, system) produced each event.
54912. **Relative timestamps** — Displays "2h ago" with absolute timestamps on hover.
54913. **Day grouping** — Collapses events under date headers for long histories.
54914. **Infinite scroll** — Loads older events on demand without pagination clicks.
54915. **Event permalinks** — Links directly to individual timeline events for sharing.
54916. **Timeline annotations (targets)** — Pins analyst notes onto any event for institutional memory.
54917. **Milestone markers (targets)** — Flags launches, audits, and major releases on the timeline.
54918. **Scheduled event preview** — Shows upcoming hunts and renewals as future timeline entries.
54919. **Timeline export (targets)** — Downloads the filtered timeline as CSV or PDF for audits.
54920. **Timeline sharing** — Shares read-only timeline links with clients via expiry.
54921. **Change-to-finding correlation** — Visually links findings to the changes that preceded them.
54922. **Hunt result markers** — Plots hunt completions with finding counts as timeline milestones.
54923. **Health incident markers** — Shows outages and recoveries inline with other activity.
54924. **Scope change markers** — Records rule edits so result shifts can be explained.
54925. **Verification markers** — Logs verification passes, failures, and expiries.
54926. **Lifecycle markers** — Shows pause, resume, and archive transitions chronologically.
54927. **Tag change markers** — Records tag applications and removals with actors.
54928. **Note markers** — Places note creation events with preview snippets.
54929. **Comment threads on events** — Discusses individual timeline events inline.
54930. **Timeline subscriptions** — Follows a target's timeline with digest or realtime notifications.
54931. **Notification preferences** — Chooses which event types trigger alerts per target.
54932. **Timeline digest emails** — Sends daily or weekly activity summaries per target or group.
54933. **Group timeline rollup** — Merges member-target timelines into one group view.
54934. **Client timeline rollup** — Aggregates all client targets' events for status meetings.
54935. **Timeline audit mode** — Shows immutable, tamper-evident event records for compliance.
54936. **Timeline attachments** — Attaches files and screenshots to any timeline event.
54937. **Timeline density toggle** — Switches between detailed and compact event rendering.
54938. **Color coding by type** — Assigns consistent colors to hunts, findings, changes, and health.
54939. **Icons per event type** — Uses distinct icons so event kinds scan instantly.
54940. **Timeline keyboard navigation** — Moves between events and expands details without a mouse.
54941. **Mobile timeline layout** — Reflows the timeline for touch with collapsible event cards.
54942. **Virtualized rendering** — Keeps ten-thousand-event timelines smooth via windowing.
54943. **Timeline print view** — Produces a clean printable chronology for reports.
54944. **Timeline API** — Reads events programmatically for SIEM and data-warehouse sync.
54945. **Timeline webhooks** — Pushes new events to external systems in real time.
54946. **Event retention policy** — Configures how long detailed events are kept per client.
54947. **Bulk event annotation** — Annotates many selected events at once, e.g., "Q3 audit window".
54948. **Timeline empty states** — Guides new targets with prompts to run the first hunt.
54949. **Cross-target event search** — Finds events mentioning a keyword across the whole inventory.
54950. **Timeline correlation hints** — Suggests related events, like a deploy preceding a finding spike.
54951. **Follow-up flags** — Marks events needing action with assignee and due date.
54952. **Timeline snapshots** — Saves named timeline views (filters + range) for recurring reviews.
54953. **Event type management** — Enables or disables custom event types per workspace.
54954. **Timeline performance stats** — Shows event counts by type to keep noisy targets tunable.
54955. **Target deduplication engine** — Scores candidate duplicates by domain, IP, cert, and content similarity.
54956. **Target merge UI** — Combines duplicates interactively, choosing surviving fields with full audit.
54957. **Target split UI** — Separates a merged record back into distinct targets preserving histories.
54958. **Canonical URL management** — Designates one canonical entry URL with aliases recorded beneath.
54959. **Alias management** — Tracks alternate domains, IPs, and app IDs pointing at the same target.
54960. **Duplicate warning on add** — Blocks or warns during onboarding when similarity crosses thresholds.
54961. **Data quality score** — Grades each target's completeness (verified? scoped? tagged? owned?) 0–100.
54962. **Missing-field prompts** — Surfaces exactly which fields to fill to reach 100% data quality.
54963. **Completeness checklist** — Shows per-target setup completeness as a progress ring.
54964. **Target access control (RBAC)** — Restricts view, edit, hunt, and delete per target or group by role.
54965. **Target sharing links** — Grants time-boxed read-only access to external stakeholders.
54966. **Target transfer between users** — Reassigns ownership with handoff notes and notification.
54967. **Target transfer between clients** — Moves targets across clients preserving full history.
54968. **Favorite targets** — Stars key targets for a personal quick-access list.
54969. **Recently viewed list** — Recalls the last targets you opened for fast return.
54970. **Pinned targets** — Pins critical targets to the top of dashboards and lists.
54971. **Global keyboard shortcuts** — Provides shortcuts for add, search, note, tag, and hunt actions.
54972. **Command palette target actions** — Runs pause, tag, schedule, and export from Cmd+K.
54973. **Bulk edit** — Edits owner, tags, group, or SLA across many targets in one dialog.
54974. **Bulk delete with safeguards (targets)** — Deletes selections only after typing confirmation and impact preview.
54975. **Target trash and restore** — Soft-deletes with 30-day recovery before permanent purge.
54976. **Target audit log** — Records every field change, view of sensitive data, and export.
54977. **Target CRUD API** — Manages the full inventory programmatically with scoped keys.
54978. **Target webhooks** — Emits create, update, delete, and state-change events to integrations.
54979. **Target one-pager PDF** — Generates a client-ready summary sheet per target on demand.
54980. **Target print profile** — Renders a clean printable dossier of any target.
54981. **Target QR code** — Encodes a share link as QR for field-team handoffs.
54982. **Target onboarding email** — Sends new-target summaries to owners and stakeholders automatically.
54983. **Target SLA dashboard** — Tracks hunt-cadence and verification SLAs across inventory.
54984. **Target compliance checklist** — Verifies authorization, scope sign-off, and data handling per target.
54985. **Data retention policies (targets)** — Purges logs, screenshots, and notes per client schedule.
54986. **Full inventory export** — Downloads the entire inventory with history as encrypted archive.
54987. **Full inventory import** — Restores or migrates workspaces from exported archives.
54988. **Target template library** — Saves fully configured target blueprints for repeatable onboarding.
54989. **Contextual help tooltips** — Explains every inventory concept inline where users encounter it.
54990. **Guided empty states** — Turns "no targets yet" into a three-step getting-started flow.
54991. **Loading skeletons** — Shows structured placeholders while inventory data loads.
54992. **Accessibility compliance (targets)** — Ensures keyboard, screen-reader, and contrast support across inventory UI.
54993. **Target activity heatmap** — Visualizes event density per target over the year like a contribution graph.
54994. **Inventory growth chart** — Plots target counts over time by lifecycle state.
54995. **Stale ownership review** — Flags targets whose owner left or hasn't logged in recently.
54996. **Orphan target detection** — Finds targets with no owner, group, or client for cleanup.
54997. **Target naming conventions** — Enforces or suggests consistent naming with validation.
54998. **Custom fields** — Adds organization-defined fields (contract ID, cost center) to target records.
54999. **Custom field validation** — Enforces formats and required values on custom fields.
55000. **Field-level permissions** — Hides sensitive custom fields from unauthorized roles.
55001. **Inventory snapshots** — Captures point-in-time inventory states for audits and rollbacks.
55002. **Snapshot comparison (targets)** — Diffs two inventory snapshots to show adds, removes, and moves.
55003. **Multi-workspace inventory** — Separates inventories per business unit with controlled sharing.
55004. **Inventory health score** — Rolls data quality, verification, and coverage into one portfolio-grade metric.
