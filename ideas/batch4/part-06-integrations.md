# Batch 4 — Part 06: Integration ecosystem (35005–36004)

35005. **Severity-to-priority mapping tables** — let admins map each Dark-Matter severity to Jira priority and Linear priority values per project so tickets land with the right urgency automatically.
35006. **Evidence attachment bundling** — package screenshots, HAR files, and request/response pairs into a single ticket attachment set at creation time so triagers never chase missing proof.
35007. **Component-owner auto-assignment** — route tickets to the owning engineer by matching the affected component or service against a maintained ownership registry.
35008. **Per-project ticket routing** — send findings to different Jira projects or Linear teams based on target, asset tag, or business unit rules.
35009. **Custom field population** — fill Jira custom fields such as CVSS, CWE, and affected URL from finding metadata at ticket creation.
35010. **Epic linkage per hunt campaign** — attach every ticket from one hunt to a campaign epic so the full engagement is traceable in one view.
35011. **Remediation subtask generation** — create ordered subtasks for each remediation step (patch, retest, deploy) under the parent finding ticket.
35012. **Idempotency keys on creation** — stamp each ticket with the finding's hash as an idempotency key so retries and re-runs never duplicate tickets.
35013. **Dry-run ticket preview** — render the exact ticket title, fields, and attachments in a preview pane before anything is created in Jira or Linear.
35014. **JSM request-type mapping** — file tickets through Jira Service Management request types so they enter the security intake queue with the correct form fields.
35015. **Security-level assignment** — set Jira issue security levels on tickets containing sensitive exploit detail so only cleared viewers can open them.
35016. **Label taxonomy sync** — apply a controlled label vocabulary (vuln-class, environment, confidence) shared between Dark-Matter and the tracker.
35017. **Component auto-tagging** — tag tickets with the affected component derived from the URL path, service name, or repository mapping.
35018. **Fix-version suggestion** — propose a fix version based on the team's release calendar and the finding's severity SLA.
35019. **Sprint auto-enrollment** — add critical-severity tickets directly to the active sprint backlog with a capacity-impact warning.
35020. **Story-point auto-estimation** — estimate story points from remediation complexity signals so planning picks up security tickets without manual sizing.
35021. **Reporter identity mapping** — file tickets under a dedicated Dark-Matter service account while crediting the human researcher in a custom field.
35022. **Watcher auto-addition** — add the security lead and the asset owner as watchers on every ticket above a configurable severity threshold.
35023. **Retest-update comment threading** — post retest results as threaded comments on the original ticket so the full verification history stays in one place.
35024. **Status transition rules** — move tickets through triage workflows automatically when Dark-Matter confirms, retests, or closes a finding.
35025. **Bulk ticket creation** — create tickets for an entire filtered finding set in one operation with per-item success and failure reporting.
35026. **Finding-hash dedup guard** — check for existing tickets with the same finding hash before creating, and link instead of duplicating.
35027. **Ticket template library** — store per-severity and per-vuln-class description templates that authors can customize with merge fields.
35028. **SLA due-date calculation** — compute due dates from severity-based SLA policies and set them on the ticket at creation.
35029. **Exploit-proof priority escalation** — bump priority automatically when a working exploit or PoC video is attached to the finding.
35030. **Linear team routing rules** — direct findings to Linear teams by matching target domains or labels against team routing rules.
35031. **Linear cycle auto-add** — place critical and high tickets into the current Linear cycle so they appear in the team's active work.
35032. **Linear triage inbox routing** — send low-confidence findings to Linear's triage inbox instead of the main backlog for human sorting.
35033. **Linear workflow-state mapping** — map Dark-Matter finding states to the Linear team's custom workflow states on ticket creation and updates.
35034. **Linear milestone linking** — link tickets to Linear project milestones so security debt is visible against release milestones.
35035. **Linear issue relations** — create blocked-by and duplicate relations between related finding tickets to model chains and repeats.
35036. **Linear label synchronization** — mirror Dark-Matter tags into Linear labels with color coding per severity.
35037. **Linear estimate auto-set** — populate Linear's estimate field from remediation-complexity scoring at ticket creation.
35038. **Per-target project segregation** — keep tickets for different targets in separate projects so client or product data never mixes.
35039. **Multi-project fan-out** — create linked tickets in both the security project and the owning team's project for shared accountability.
35040. **Ticket title normalization** — generate consistent titles in the form `[SEVERITY] vuln-class on asset (path)` across every integration.
35041. **Markdown description templates** — render ticket bodies from Markdown templates with sections for summary, impact, evidence, and remediation.
35042. **CVSS vector field** — write the full CVSS vector string into a dedicated field so scoring is auditable in the tracker.
35043. **CWE identifier field** — populate the CWE ID and name so tickets join the organization's weakness taxonomy.
35044. **Affected-URL field** — record the exact vulnerable URL in a searchable custom field for quick lookup during incidents.
35045. **Evidence-link embedding** — embed deep links to the finding's evidence bundle in Dark-Matter inside the ticket description.
35046. **PDF report attachment** — attach the finding's generated PDF report to the ticket automatically at creation.
35047. **HAR capture attachment** — attach the raw HTTP archive of the vulnerable request flow for exact replay by developers.
35048. **Screenshot evidence attachment** — attach annotated screenshots proving the vulnerability with sensitive data redacted.
35049. **PoC video attachment** — attach screen-recorded proof-of-concept videos for findings that need visual demonstration.
35050. **Curl reproduction attachment** — attach a ready-to-run curl command file so developers reproduce the issue in one step.
35051. **Request-response pair attachment** — attach the exact vulnerable request and response as a text bundle for debugging.
35052. **Affected-asset inventory field** — list every affected host, service, and repository discovered during the hunt in a structured field.
35053. **First-seen timestamp field** — record when the finding was first detected to support aging and dwell-time metrics.
35054. **Last-seen timestamp field** — update the last-observed time on every re-detection so stale tickets are identifiable.
35055. **Reproducibility rating field** — store the reproducibility score so triagers know which findings verify reliably.
35056. **Exploitability score field** — store the exploitability assessment separately from impact for finer prioritization.
35057. **Business-impact narrative** — include a plain-language impact paragraph written for non-security stakeholders in every ticket.
35058. **Remediation guidance section** — embed framework-specific fix guidance with code examples in the ticket body.
35059. **Reference links section** — attach OWASP, CWE, and vendor advisory links relevant to the vulnerability class.
35060. **Related-findings backlinks** — list tickets for related findings on the same asset so fixers see the full local picture.
35061. **Attack-chain graph attachment** — attach a visual graph when the finding is part of a chained exploit path.
35062. **Risk-score field** — write Dark-Matter's computed risk score into the ticket for sorting and dashboarding.
35063. **Confidence-level field** — record the detection confidence so low-confidence tickets can be filtered in triage views.
35064. **OWASP category field** — tag tickets with the OWASP Top 10 category for compliance reporting.
35065. **Compliance tag fields** — apply PCI-DSS, HIPAA, or SOC 2 tags when the finding touches regulated data flows.
35066. **Environment field** — mark whether the finding is in production, staging, or development to drive urgency.
35067. **Target-host field** — store the canonical target hostname in a dedicated searchable field.
35068. **Port-service field** — record the affected port and service banner for infrastructure findings.
35069. **Authentication-state field** — note whether exploitation required authentication and which role was used.
35070. **User-role field** — record the lowest-privilege role that can trigger the vulnerability.
35071. **HTTP-method field** — capture the vulnerable request's HTTP method for quick filtering.
35072. **Parameter-name field** — name the exact vulnerable parameter for developer handoff.
35073. **Redacted payload sample** — include a sanitized payload sample that demonstrates the issue without leaking secrets.
35074. **Detection-engine attribution** — credit the engine or module that found the issue for tuning feedback loops.
35075. **Hunt-ID linkage** — link every ticket back to its originating hunt run for audit trails.
35076. **Agent-run metadata** — record the model, prompt version, and run ID that produced the finding.
35077. **Retest-ticket auto-creation** — open a child retest ticket when the parent moves to a fixed-pending-verification state.
35078. **Regression-ticket linking** — link re-appearing findings to their original tickets as suspected regressions.
35079. **Duplicate suppression rules** — suppress ticket creation when an open ticket already covers the same finding hash and asset.
35080. **Reopen on re-detection** — reopen closed tickets automatically if the same vulnerability is detected again after the fix.
35081. **FP-verdict auto-close** — close tickets with a comment when Dark-Matter's false-positive engine clears the finding.
35082. **State-change commenting** — post a comment on the ticket whenever the finding's lifecycle state changes.
35083. **Triage transition automation** — move tickets from intake to triage when a human acknowledges the finding in Dark-Matter.
35084. **SLA-breach reassignment** — reassign tickets to the security lead when severity SLAs are breached without progress.
35085. **Escalation chains (integration context)** — walk a defined escalation path (owner, lead, CISO) as tickets age past severity thresholds.
35086. **Critical on-call paging** — page the on-call engineer through the tracker's escalation when a critical lands after hours.
35087. **Manager digest emails** — send managers a daily digest of new tickets by severity with links and SLA status.
35088. **Weekly ticket rollup** — generate a weekly summary of created, closed, and aging tickets for security reviews.
35089. **Per-severity queues** — maintain separate tracker queues per severity so criticals never wait behind lows.
35090. **Triage board columns** — auto-create board columns matching the triage workflow for one-click state moves.
35091. **WIP-aware throttling** — pause auto-ticketing when a project's in-progress count exceeds a limit to avoid flooding teams.
35092. **Backlog grooming suggestions** — recommend ticket merges, splits, and priority changes based on finding clustering.
35093. **Ticket aging alerts** — notify owners when tickets sit untouched past half their SLA window.
35094. **Stale-ticket nudges** — post gentle reminders on tickets with no activity for a configurable number of days.
35095. **Fix-verification checklist** — attach a verification checklist to each ticket that retesters complete before closing.
35096. **Retest evidence upload** — upload retest request/response captures as comments on the original ticket.
35097. **Sign-off workflow (integration context)** — require security sign-off transitions before critical tickets can move to done.
35098. **Approval gates** — gate ticket creation for production assets behind a one-click approval for sensitive targets.
35099. **Change-advisory linkage** — link remediation tickets to change requests so fixes follow the change process.
35100. **Release-train mapping** — map fix versions to release trains so security fixes ride the normal deployment schedule.
35101. **Hotfix branch suggestion** — suggest a hotfix branch name and base commit in the ticket for urgent patches.
35102. **Code-owner suggestion** — propose reviewers from CODEOWNERS data for the files likely needing the fix.
35103. **PR auto-linkage** — link pull requests that mention the ticket key back into the ticket's development panel.
35104. **Ticket analytics export** — export ticket lifecycle metrics (time-to-triage, time-to-fix) for security program reporting.
35105. **Per-severity channel routing** — deliver critical findings to the incident channel, highs to the security channel, and lows to a digest channel based on severity rules.
35106. **Finding card rich formatting** — post structured cards with severity color bars, affected asset, CVSS, and evidence links in Slack Block Kit, Discord embeds, and Teams Adaptive Cards.
35107. **One-click triage buttons** — attach Confirm, False Positive, and Assign buttons to each notification so triage happens without opening the dashboard.
35108. **Threaded finding discussions** — open a thread per finding under the notification card so discussion stays attached to the alert.
35109. **Hunt lifecycle announcements** — post messages when hunts start, pause, resume, and complete with summary statistics.
35110. **Critical-finding @channel alerts** — mention the on-call role or channel only for criticals to prevent alert fatigue on lower severities.
35111. **Digest mode scheduling** — batch non-critical findings into hourly or daily digest messages instead of one message per finding.
35112. **Quiet hours enforcement** — hold non-critical notifications during configured quiet hours and deliver them when the window opens.
35113. **Per-target channel mapping** — route notifications for different targets to dedicated channels per product or client.
35114. **Per-team channel subscriptions** — let each team subscribe only to findings affecting their owned assets.
35115. **Severity threshold filters** — let channels opt into minimum severities so noise stays out of engineering channels.
35116. **Vuln-class filters** — subscribe channels to specific vulnerability classes like XSS or SSRF for specialist teams.
35117. **Asset-tag filters** — filter notifications by asset tags such as production, pci-scope, or external.
35118. **Confidence filters** — suppress notifications for findings below a confidence threshold until a human reviews them.
35119. **Duplicate suppression** — collapse repeated detections of the same finding into the original card with an updated count.
35120. **Finding state change pings** — notify the channel when a finding moves from open to confirmed, fixed, or false positive.
35121. **Retest result notifications** — post retest outcomes with pass or fail status and links to the new evidence.
35122. **PoC ready announcements** — announce when a proof-of-concept is generated with a link to the video or replay bundle.
35123. **Report ready notifications** — notify when the PDF or Markdown report for a hunt is ready for download.
35124. **Bounty awarded celebrations** — post a celebratory message with payout details when a platform marks a report as rewarded.
35125. **SLA breach warnings (integration context)** — warn the channel when a finding approaches its severity SLA deadline without a fix.
35126. **Stale finding reminders** — resurface findings with no activity for a week as a gentle reminder card.
35127. **New asset discovered** — announce newly discovered subdomains or services during recon with tech fingerprints.
35128. **Scope change alerts** — alert when a program's scope changes and hunts are paused or resumed automatically.
35129. **Brain offline alerts** — notify when the Kaggle brain disconnects so the team knows hunts are degraded.
35130. **Integration health alerts** — report when a Jira, SIEM, or platform integration fails authentication or rate limits.
35131. **Weekly security digest** — post a Monday summary of findings opened, closed, bounties earned, and MTTR trends.
35132. **Leaderboard snapshots** — share weekly hunter leaderboard updates to keep the team motivated.
35133. **Milestone messages** — celebrate milestones like 100 findings closed or a critical chain verified.
35134. **Custom emoji severity markers** — prefix messages with configured emoji per severity for instant visual scanning.
35135. **Message unfurl control** — configure which links unfurl with previews to keep channels readable.
35136. **Ephemeral triage messages** — send triage prompts as ephemeral messages visible only to the responder in Slack.
35137. **Modal triage forms** — open Slack modals or Teams task modules for structured triage input like assignee and notes.
35138. **Assignee picker in chat** — let responders pick an assignee from a dropdown attached to the finding card.
35139. **Snooze buttons** — snooze a finding's notifications for 24 hours or until the next hunt run.
35140. **Mute per finding** — mute all future notifications for a specific finding hash from the card itself.
35141. **Escalate buttons** — escalate a finding to the incident channel with one click from any card.
35142. **Create-ticket buttons** — create a Jira or Linear ticket from the notification card without leaving chat.
35143. **Create-incident buttons** — open a PagerDuty or Opsgenie incident directly from a critical finding card.
35144. **Request-retest buttons** — trigger a retest hunt for the finding's asset from the card.
35145. **Mark-duplicate buttons** — mark a finding as duplicate of another from the notification with a picker.
35146. **Add-note buttons** — append a note to the finding through a quick-reply input on the card.
35147. **Vote buttons** — let team members vote findings up or down to crowdsource prioritization.
35148. **Claim buttons** — let researchers claim a finding for manual follow-up with their name stamped on it.
35149. **Share-to-channel buttons** — forward a finding card to another channel with added context.
35150. **Export-card buttons** — export the finding as PDF or Markdown straight from the chat message.
35151. **Slash-command hunt start** — start a hunt on a target with `/dm hunt example.com` from any channel.
35152. **Slash-command hunt status** — check running hunts and their progress with `/dm status`.
35153. **Slash-command finding lookup** — pull up a finding's details with `/dm finding <id>`.
35154. **Slash-command pause and resume** — pause or resume hunts with `/dm pause <id>` and `/dm resume <id>`.
35155. **Slash-command scope check** — verify whether a target is in scope with `/dm scope <host>`.
35156. **Bot DM subscriptions** — let users DM the bot to subscribe to personal finding alerts.
35157. **Personal daily brief** — DM each researcher their assigned findings and SLA deadlines every morning.
35158. **Mention-on-assignment** — DM the assignee immediately when a ticket or finding is assigned to them.
35159. **Shift-handoff summaries** — post a handoff summary at shift change with open criticals and in-flight hunts.
35160. **Timezone-aware scheduling (notification-delivery context)** — schedule digests and quiet hours per user's timezone, not the server's.
35161. **Language preference per channel** — post notifications in the channel's configured language for global teams.
35162. **Message templating** — customize card layouts and fields per channel through a template editor.
35163. **Conditional blocks** — show or hide card sections based on finding attributes like having a PoC video.
35164. **Attachment previews** — render screenshot thumbnails directly inside the notification card.
35165. **Deep-link buttons** — include buttons that open the exact finding, hunt, or evidence view in Dark-Matter.
35166. **Mobile push parity** — ensure critical alerts trigger mobile push through the Slack, Discord, or Teams apps.
35167. **Discord role pings (integration context)** — ping configured Discord roles for criticals instead of @everyone.
35168. **Discord forum threads (integration context)** — create Discord forum posts per campaign so findings organize as browsable threads.
35169. **Discord stage announcements** — announce major disclosures in Discord stage channels for community programs.
35170. **Teams channel tabs** — add a Dark-Matter tab in Teams channels showing live findings for that channel's scope.
35171. **Teams meeting summaries** — post hunt review summaries into scheduled Teams meetings automatically.
35172. **Teams praise integration** — send Teams praise badges when researchers close critical findings.
35173. **Slack canvas reports (integration context)** — publish weekly reports as Slack canvases with charts and tables.
35174. **Slack workflow triggers** — expose finding events as triggers for Slack's Workflow Builder automations.
35175. **Slack connect sharing** — share sanitized finding summaries with client channels over Slack Connect.
35176. **Guest-safe redaction** — redact exploit details automatically when posting to channels with guest members.
35177. **Channel archiving rules** — archive per-campaign channels automatically after the disclosure window closes.
35178. **Notification audit log (integration context)** — log every sent notification with channel, content hash, and delivery status for compliance.
35179. **Delivery failure retries** — retry failed message deliveries with backoff and alert admins after repeated failures.
35180. **Rate-limit awareness** — throttle outbound messages to respect Slack, Discord, and Teams API rate limits.
35181. **Message edit updates** — edit the original card in place when a finding's severity or state changes instead of posting anew.
35182. **Message delete on FP** — delete or strikethrough the notification card when the finding is confirmed as a false positive.
35183. **Reaction-based triage** — count emoji reactions on cards as triage votes with configurable thresholds.
35184. **Poll integration** — launch quick polls on disclosure timing or severity disputes from the card.
35185. **Scheduled summaries** — post end-of-day summaries of hunt activity per subscribed channel.
35186. **Anomaly alerts** — notify when finding volume spikes anomalously, which may signal a scan misconfiguration.
35187. **Coverage gap notices** — alert when a subscribed asset has had no hunt coverage for a configured period.
35188. **Credential expiry warnings (integration context)** — warn in the admin channel before integration tokens expire.
35189. **Usage quota notices** — notify when API quotas for notification platforms approach their limits.
35190. **Onboarding channel messages** — greet new team members in the security channel with a how-to-use-the-bot guide.
35191. **Command help cards** — respond to `/dm help` with an interactive card listing every command and button.
35192. **Feedback collection** — ask for a quick rating after triage actions to improve notification relevance.
35193. **Do-not-disturb sync (integration context)** — respect each platform's DND status before sending non-critical DMs.
35194. **Priority inbox rules** — mark critical DMs as urgent so they bypass notification filters on mobile.
35195. **Cross-posting rules** — define which findings auto-cross-post between the security channel and engineering channels.
35196. **Announcement scheduling** — schedule disclosure announcements for coordinated release times across regions.
35197. **Read receipts tracking** — track which on-call members acknowledged critical alerts and escalate on no-ack.
35198. **Ack buttons** — let on-call acknowledge a critical directly from the card with a timestamp.
35199. **Escalation timers** — start a visible countdown on unacknowledged criticals and escalate when it expires.
35200. **Post-incident summaries** — post a timeline summary to the channel after a critical finding is remediated.
35201. **Integration setup wizard** — guide admins through connecting Slack, Discord, or Teams with OAuth and channel pickers.
35202. **Multi-workspace support** — connect multiple Slack workspaces or Discord servers with per-workspace routing rules.
35203. **Test notification button (integration context)** — send a sample finding card to verify formatting before going live.
35204. **Notification analytics (integration context)** — report open, ack, and triage-action rates per channel to tune the notification strategy.
35205. **Splunk HEC exporter** — push hunt telemetry and findings to Splunk via HTTP Event Collector as structured JSON events.
35206. **Elastic Bulk API exporter** — stream findings and hunt events into Elasticsearch indices using the bulk API with index templates.
35207. **QRadar LEEF formatter** — format security events in Log Event Extended Format for IBM QRadar ingestion.
35208. **Sentinel CEF connector** — send Common Event Format events to Microsoft Sentinel through the Log Analytics agent or API.
35209. **Chronicle UDM mapping** — map findings to Google Chronicle's Unified Data Model for native entity correlation.
35210. **Datadog log intake** — ship hunt logs and findings to Datadog with tags for severity, target, and hunt ID.
35211. **Wazuh agent events** — emit Wazuh-compatible JSON events so findings appear in the Wazuh dashboard.
35212. **Graylog GELF output** — send Graylog Extended Log Format messages over UDP or TCP with chunking.
35213. **Syslog RFC5424 emitter** — emit findings as structured syslog with SD-PARAMS for legacy SIEM collectors.
35214. **Kafka topic streaming** — publish hunt events to Kafka topics for downstream SIEM and data-lake consumers.
35215. **Finding-as-event schema** — define a canonical finding event schema with stable field names across every SIEM exporter.
35216. **Hunt-telemetry event stream** — emit granular telemetry (requests sent, endpoints covered, errors) as SIEM events for hunt observability.
35217. **Recon-discovery events** — log every discovered subdomain, port, and technology as an asset-discovery event.
35218. **Payload-sent events** — record each probe payload with a hash and target so defenders can correlate with WAF logs.
35219. **Detection events** — emit a detection event the moment a finding is confirmed, with confidence and evidence references.
35220. **FP-filter events** — log false-positive verdicts with reasons so SIEM rules can exclude matching patterns.
35221. **Retest events** — emit events when retests run and whether the finding persisted or was fixed.
35222. **Hunt-start events** — log hunt start with scope, profile, and operator identity for audit trails.
35223. **Hunt-complete events** — log hunt completion with duration, coverage, and finding counts.
35224. **Scope-violation events** — emit an alert event if a probe ever targets an out-of-scope asset, proving guardrails held.
35225. **Rate-limit events** — log when the hunt throttles itself so defenders can distinguish automation from attack.
35226. **Auth-session events** — log authenticated session creation and expiry during hunts for access auditing.
35227. **Credential-use events** — record which stored credential was used against which target without logging secrets.
35228. **Model-inference events** — log brain model calls with latency so SIEM dashboards show AI cost per hunt.
35229. **Error events** — emit structured error events with hunt context for operational monitoring.
35230. **Heartbeat events** — send periodic heartbeats during long hunts so the SIEM knows the agent is alive.
35231. **ECS field mapping** — map every event to Elastic Common Schema fields for out-of-the-box Kibana dashboards.
35232. **CEF extension fields** — populate CEF extension keys like cs1 and cn1 consistently for ArcSight-style parsers.
35233. **OCSF mapping** — emit findings in the Open Cybersecurity Schema Framework for vendor-neutral ingestion.
35234. **STIX 2.1 bundles** — package findings as STIX bundles with vulnerabilities, identities, and relationships.
35235. **TAXII collection publishing** — publish STIX bundles to a TAXII collection so threat-intel platforms can poll them.
35236. **Sigma rule export (integration context)** — generate Sigma detection rules from confirmed attack patterns for defender use.
35237. **YARA rule export** — export YARA rules from distinctive response markers found during hunts.
35238. **Snort/Suricata signatures** — generate IDS signatures for the exact payloads that triggered findings.
35239. **WAF rule suggestions (integration context)** — propose ModSecurity or cloud-WAF rules that would block the confirmed exploit.
35240. **Splunk CIM compliance** — align events with the Splunk Common Information Model for Enterprise Security content.
35241. **Splunk notable-event creation** — create notable events in Splunk ES with urgency derived from severity.
35242. **Splunk risk-score updates** — feed risk modifiers into Splunk ES risk notables per affected asset.
35243. **Splunk adaptive-response hooks** — trigger Splunk adaptive response actions on critical finding events.
35244. **Elastic detection rules** — ship prebuilt Elastic detection rules that fire on Dark-Matter event patterns.
35245. **Elastic alert actions** — wire Elastic alert actions to open Dark-Matter retests when detections fire.
35246. **Kibana dashboard pack** — provide importable Kibana dashboards for hunt coverage, findings, and MTTR.
35247. **Sentinel analytics rules** — deploy Sentinel KQL analytics rules that correlate findings with sign-in and network logs.
35248. **Sentinel incidents** — create Sentinel incidents from critical findings with entities and evidence links.
35249. **Sentinel workbooks** — ship workbooks visualizing hunt activity alongside SOC telemetry.
35250. **Sentinel playbook triggers** — expose Logic Apps triggers that start on Dark-Matter finding events.
35251. **QRadar offense creation** — open QRadar offenses for critical findings with magnitude from severity.
35252. **QRadar reference sets** — maintain reference sets of confirmed-vulnerable hosts for QRadar rules.
35253. **QRadar custom properties** — define extracted properties so QRadar rules can filter on finding fields.
35254. **Chronicle detection rules** — ship YARA-L rules that correlate Dark-Matter findings with enterprise telemetry.
35255. **Chronicle entity graph** — link findings to Chronicle entities for asset-centered investigation.
35256. **Datadog security signals** — raise Datadog Cloud SIEM signals from critical and high findings.
35257. **Datadog monitors (integration context)** — create monitors that alert when finding ingestion stops unexpectedly.
35258. **Datadog dashboards** — ship dashboard JSON for hunt KPIs inside Datadog.
35259. **Wazuh active-response** — trigger Wazuh active-response scripts that isolate hosts tied to critical findings.
35260. **Wazuh SCA checks** — generate Wazuh security-configuration-assessment checks from hardening findings.
35261. **Graylog alerts** — define Graylog event definitions that page on critical finding streams.
35262. **Graylog pipelines** — ship pipeline rules that enrich Dark-Matter events with asset context.
35263. **LogRhythm alarms (integration context)** — format alarms for LogRhythm with classification and common-event fields.
35264. **Securonix threat models** — feed findings as threat-model inputs for UEBA risk scoring.
35265. **Exabeam timelines** — emit events that Exabeam stitches into user and asset timelines.
35266. **Devo queries** — provide Devo LINQ queries for hunting Dark-Matter telemetry in the data lake.
35267. **Humio/Falcon LogScale parsers** — ship LogScale parsers for the Dark-Matter event format.
35268. **Mezmo pipelines** — provide Mezmo pipeline templates that redact and route hunt telemetry.
35269. **Cribl Stream packs** — publish Cribl packs that normalize Dark-Matter events at the edge.
35270. **Vector remap transforms** — ship Vector VRL transforms converting events to each SIEM's schema.
35271. **Fluent Bit parsers** — provide Fluent Bit parser configs for the JSON event format.
35272. **OpenTelemetry traces** — emit hunt execution as OTel traces so SIEM and APM tools share context.
35273. **OTel log bridge** — bridge structured logs through OpenTelemetry into any OTLP-compatible SIEM.
35274. **Asset-inventory sync** — push discovered assets into the SIEM's asset inventory with first-seen timestamps.
35275. **Vulnerability-index sync** — maintain a SIEM-side index of open findings for join queries with other telemetry.
35276. **Ticket-state enrichment** — enrich SIEM events with the linked Jira or Linear ticket status.
35277. **Threat-intel enrichment** — join findings with threat-intel matches before emitting SIEM events.
35278. **Geo-enrichment** — add geolocation of target infrastructure to events for map visualizations.
35279. **ASN enrichment** — attach ASN and hosting-provider context to target-related events.
35280. **Certificate enrichment** — include certificate details for TLS-related findings in the event payload.
35281. **Deduplication windows** — suppress repeat events for the same finding within a configurable window.
35282. **Event sampling (integration context)** — sample high-volume telemetry events while always sending finding events in full.
35283. **Backpressure handling** — queue events locally when the SIEM endpoint is slow and flush with priority ordering.
35284. **TLS mutual auth** — support mTLS client certificates for SIEM endpoints that require them.
35285. **Event signing** — sign emitted events with HMAC so the SIEM can verify they came from Dark-Matter.
35286. **PII redaction** — strip credentials, tokens, and personal data from events before export.
35287. **Field allowlists** — let admins choose exactly which fields leave Dark-Matter for the SIEM.
35288. **Retention hints** — tag events with suggested retention classes so SIEM lifecycle policies apply correctly.
35289. **Multi-SIEM fan-out** — send the same events to two SIEMs simultaneously during migrations.
35290. **Failover endpoints** — fail over to a secondary SIEM endpoint when the primary is unreachable.
35291. **Dry-run event preview** — show exactly which events would be sent for a sample hunt before enabling the exporter.
35292. **Replay from archive** — re-emit historical hunt events from the local archive into a new SIEM.
35293. **Scheduled batch export** — export daily finding snapshots as CSV or JSON for SIEMs without streaming APIs.
35294. **SIEM query-back** — query the SIEM for related alerts when triaging a finding to add defender context.
35295. **Alert-to-hunt trigger** — start a scoped Dark-Matter hunt automatically when a SIEM alert names an in-scope asset.
35296. **Bidirectional state sync** — update SIEM notable or incident status when the finding state changes in Dark-Matter.
35297. **Analyst-note sync** — mirror analyst notes between SIEM incidents and Dark-Matter findings.
35298. **Escalation sync** — reflect SIEM incident severity changes back onto the linked finding.
35299. **Closure sync** — close SIEM notables automatically when findings are verified fixed.
35300. **Reopen sync** — reopen SIEM incidents if a finding regresses on retest.
35301. **Dashboard deep links** — embed links from SIEM dashboards back to the exact finding in Dark-Matter.
35302. **Single sign-on passthrough** — pass the analyst's identity through so SIEM actions audit to the right user.
35303. **Multi-tenant separation** — tag events with tenant IDs so MSSP SIEMs keep client data isolated.
35304. **Exporter health dashboard** — show per-SIEM delivery rates, latency, and error counts inside Dark-Matter.
35305. **Critical-finding incident auto-open** — trigger a SOAR playbook that opens an incident with full finding context the moment a critical is confirmed.
35306. **On-call paging playbook** — page the on-call engineer through PagerDuty or Opsgenie when a critical finding event fires.
35307. **Severity-tiered playbook routing** — run different playbooks per severity: full incident for criticals, ticket-only for mediums, digest for lows.
35308. **Vuln-class playbook mapping** — map vulnerability classes to specialized playbooks, such as an SQLi playbook that snapshots the database first.
35309. **Asset-criticality gating** — require asset criticality tags before auto-opening incidents so lab findings never page anyone.
35310. **Confidence gating** — run containment playbooks only when finding confidence exceeds a threshold, otherwise route to analyst review.
35311. **Exploit-proof gating** — escalate to incident response only when a working exploit or PoC exists, not on scanner suspicion alone.
35312. **Production-only auto-response** — restrict automated containment actions to production assets with an explicit allowlist.
35313. **Business-hours gating** — page immediately during business hours but queue a morning incident for non-criticals overnight.
35314. **Change-freeze awareness (integration context)** — pause auto-remediation playbooks during declared change freezes and queue them instead.
35315. **Cortex XSOAR integration** — push findings into Cortex XSOAR as incidents with layouts mapped to Dark-Matter fields.
35316. **Splunk SOAR playbooks** — trigger Splunk SOAR playbooks via the REST API with finding JSON as the container artifact.
35317. **Sentinel Logic Apps** — start Azure Logic Apps playbooks from Sentinel incidents created by Dark-Matter findings.
35318. **Tines story triggers** — fire Tines stories on finding webhooks with the full event payload for no-code orchestration.
35319. **Shuffle workflows** — trigger Shuffle workflows that enrich, ticket, and notify on each new finding.
35320. **n8n workflow triggers** — start n8n workflows for teams that orchestrate response in self-hosted automation.
35321. **Torq hyperautomation** — launch Torq workflows that combine finding data with ChatOps for analyst-driven response.
35322. **ServiceNow SecOps** — create ServiceNow security incidents with SIR workflows from critical findings.
35323. **TheHive case creation** — open TheHive cases with observables auto-extracted from finding evidence.
35324. **Shuffle OpenFaaS actions** — run custom containment functions through Shuffle's serverless actions.
35325. **WAF block playbook** — push a temporary WAF block rule for the attacking pattern while the fix is developed.
35326. **IP blocklist playbook** — add malicious IPs observed during hunts to the edge blocklist automatically.
35327. **CDN rule deployment** — deploy a CDN edge rule mitigating the vulnerable endpoint pattern within minutes.
35328. **Rate-limit tightening** — temporarily tighten rate limits on the affected endpoint via the API gateway.
35329. **Feature-flag kill switch** — disable the vulnerable feature behind its feature flag when one exists.
35330. **Canary rollback playbook** — roll back the last deployment on the affected service if the finding correlates with a recent release.
35331. **Container quarantine** — isolate the affected container or pod in Kubernetes pending investigation.
35332. **Host isolation** — trigger EDR host isolation for findings indicating active compromise, not just vulnerability.
35333. **Credential rotation playbook** — rotate exposed credentials found by the secret scanner through the vault API.
35334. **Certificate revocation** — revoke and reissue certificates tied to TLS misconfiguration findings.
35335. **DNS sinkhole playbook** — sinkhole malicious domains discovered during phishing-adjacent recon.
35336. **Firewall rule staging** — stage firewall rules for analyst approval rather than applying them blindly.
35337. **Snapshot-before-remediation** — snapshot VMs or databases before any automated remediation runs.
35338. **Backup verification (integration context)** — verify recent backups exist before destructive remediation playbooks execute.
35339. **Approval-gated actions** — require one-click analyst approval in chat before any containment action executes.
35340. **Two-person rule (integration context)** — require two distinct approvers for production containment actions.
35341. **Dry-run playbook mode** — simulate the playbook's actions and show the plan without executing anything.
35342. **Blast-radius estimation** — compute and display the blast radius of a containment action before approval.
35343. **Automatic rollback** — roll back containment actions automatically if service health checks fail afterward.
35344. **Health-check verification** — verify service health after each playbook step and halt on degradation.
35345. **Evidence preservation** — capture forensic snapshots and logs before containment alters the environment.
35346. **Chain-of-custody logging (integration context)** — log every automated action with timestamps and approvers for audit.
35347. **Playbook runbooks as code** — version playbook definitions in git with pull-request review for changes.
35348. **Playbook test harness** — run playbooks against simulated findings in a sandbox before production use.
35349. **Playbook versioning (integration context)** — keep versioned playbook definitions with rollback to previous versions.
35350. **A/B playbook testing** — compare playbook variants on similar findings to optimize response time.
35351. **Playbook performance metrics** — track mean time to contain per playbook and surface regressions.
35352. **Enrichment playbook** — auto-enrich findings with threat intel, asset owner, and CMDB data before human review.
35353. **Vulnerability-intel lookup** — query vuln intel for known exploits matching the finding's CVE or pattern.
35354. **Exploit-availability check** — check exploit databases and flag findings with public exploits for faster response.
35355. **Patch-availability check** — check vendor patch availability and attach the patch link to the incident.
35356. **CISA KEV matching** — flag findings matching the CISA Known Exploited Vulnerabilities catalog for priority handling.
35357. **EPSS score enrichment** — attach EPSS exploitation-probability scores to prioritize likely-to-be-exploited findings.
35358. **Asset-owner lookup** — resolve the owning team from the CMDB and add them to the incident automatically.
35359. **CMDB relationship mapping** — pull upstream and downstream dependencies to assess incident blast radius.
35360. **Service-topology overlay** — overlay the vulnerable asset on the service map inside the incident view.
35361. **Past-incident correlation** — link the new incident to past incidents on the same asset or vuln class.
35362. **Similar-finding clustering** — group related findings into one incident instead of opening dozens.
35363. **Dedup against open incidents** — skip incident creation when an open incident already covers the finding.
35364. **Incident severity sync** — keep SOAR incident severity in sync when Dark-Matter re-scores the finding.
35365. **Incident priority mapping** — map finding severity to each SOAR platform's priority scale explicitly.
35366. **SLA timer start** — start the incident SLA clock from the moment of confirmed detection, not ticket creation.
35367. **SLA breach escalation** — escalate the incident automatically when the SLA timer breaches.
35368. **War-room creation** — spin up a dedicated Slack channel or Teams meeting for critical incidents.
35369. **Stakeholder notification** — notify product and compliance stakeholders per the incident communication plan.
35370. **Status-page drafting** — draft a status-page update for customer-facing incidents from the finding summary.
35371. **Customer-notification drafting** — draft breach-notification text when findings indicate possible data exposure.
35372. **Regulatory timer start** — start regulatory notification timers for findings in regulated data scopes.
35373. **Legal-hold triggers** — place relevant logs under legal hold when an incident suggests a breach.
35374. **Comms-template library** — use pre-approved communication templates for each incident severity.
35375. **Executive summary generation** — generate a one-paragraph executive summary for every critical incident.
35376. **Timeline auto-build** — build an incident timeline from hunt events, detections, and responder actions.
35377. **Responder assignment** — assign responders by rotation schedule and skill tags automatically.
35378. **Skill-based routing** — route database findings to DBAs and web findings to app engineers via skill tags.
35379. **Follow-the-sun handoff** — hand off open incidents across regional teams at shift boundaries.
35380. **Incident tagging** — tag incidents with vuln class, asset, and campaign for trend analysis.
35381. **Post-incident review scheduling** — schedule a blameless postmortem when the incident closes.
35382. **Lessons-learned capture** — prompt responders for lessons learned and store them with the incident.
35383. **Detection-gap analysis** — check whether existing SIEM rules would have caught the issue and flag gaps.
35384. **Retest-triggered closure** — close the incident only after Dark-Matter's retest confirms the fix.
35385. **Reopen on regression** — reopen the incident automatically if the vulnerability reappears.
35386. **Metrics export** — export MTTD, MTTR, and containment times per playbook for program reporting.
35387. **Cost attribution** — attribute incident response hours to findings for security ROI analysis.
35388. **Playbook marketplace** — browse and install community playbook templates for common vuln classes.
35389. **Custom action SDK** — let teams write custom playbook actions in Python or JavaScript against a documented API.
35390. **Webhook action steps** — call arbitrary webhooks as playbook steps for tools without native integrations.
35391. **Conditional branching (integration context)** — branch playbook flows on finding attributes like severity, asset, or exploit availability.
35392. **Parallel action fan-out** — run enrichment, ticketing, and notification steps in parallel to cut response time.
35393. **Loop over findings** — iterate playbook steps over every finding in a campaign with per-item error handling.
35394. **Human-in-the-loop steps** — pause playbooks at defined steps for analyst decisions with full context.
35395. **Timeout handling** — define timeouts and fallback paths for every external action in a playbook.
35396. **Idempotent actions** — design every action to be safely re-runnable so playbook retries never double-apply.
35397. **Compensation actions (integration context)** — define undo steps for each containment action for clean rollback.
35398. **Playbook audit trail** — record every playbook execution with inputs, decisions, and outcomes.
35399. **Compliance mapping (integration context)** — map playbook steps to NIST or ISO control requirements for auditors.
35400. **Tabletop mode** — run playbooks in discussion mode for drills without touching production.
35401. **Game-day scheduling** — schedule simulated critical findings to exercise the full playbook chain.
35402. **Playbook coverage report** — show which vuln classes and severities have playbook coverage and which do not.
35403. **Multi-SOAR support** — connect several SOAR platforms at once with per-platform playbook selection.
35404. **Playbook health monitoring** — monitor playbook success rates and alert when a playbook starts failing.
35405. **Advisory auto-drafting** — draft GitHub Security Advisories from validated findings on repositories the user owns, with severity and CWE pre-filled.
35406. **GHSA severity mapping** — map Dark-Matter severity and CVSS scores to GitHub's advisory severity levels automatically.
35407. **CVE ID reservation** — request CVE IDs through GitHub's CNA flow when drafting advisories for qualifying findings.
35408. **Affected-version ranges** — compute affected version ranges from the repository's tags and the vulnerable code's history.
35409. **Patched-version suggestion** — suggest the patched version based on the fix commit or release that resolves the issue.
35410. **Ecosystem package mapping** — link advisories to the correct package ecosystem (npm, PyPI, Maven, Go, RubyGems, crates).
35411. **Dependency-graph alerts** — surface which of the user's repositories depend on the vulnerable package version.
35412. **Dependabot alert linking** — link drafted advisories to existing Dependabot alerts on the same dependency.
35413. **Code-scanning alert linking** — attach related CodeQL or third-party code-scanning alerts to the advisory draft.
35414. **Secret-scanning cross-check** — check whether leaked secrets relate to the advisory and rotate them together.
35415. **Private fork creation** — create the private fork GitHub requires for coordinated fixes directly from the finding.
35416. **Embargo-date management** — set and track embargo dates so advisories publish only after the coordinated disclosure date.
35417. **Coordinated disclosure workflow** — manage the full timeline from private draft to public advisory with stakeholder reminders.
35418. **Credit attribution** — credit the researcher and Dark-Matter in the advisory credits section per policy.
35419. **Collaborator invites** — invite fix developers as advisory collaborators so they can edit the draft privately.
35420. **Draft review checklist** — require a review checklist (repro steps, affected versions, CVSS) before an advisory can be published.
35421. **Description templating** — generate the advisory description from the finding with summary, impact, and remediation sections.
35422. **PoC attachment** — attach the proof-of-concept as a private advisory attachment visible only to collaborators.
35423. **CVSS calculator pre-fill** — pre-fill GitHub's CVSS calculator inputs from the finding's evidence.
35424. **CWE selection** — set the advisory's CWE classification from the finding's weakness mapping.
35425. **CAPEC references** — include relevant CAPEC attack-pattern references in the advisory details.
35426. **Reference URL collection** — gather vendor advisories, blog posts, and fix commits as advisory references.
35427. **Patch-diff linking** — link the fix commit or pull request that resolves the vulnerability in the advisory.
35428. **Release-note generation** — generate security release notes from the advisory for the patched version.
35429. **Security policy check** — verify the repository has a SECURITY.md before publishing and prompt to add one.
35430. **Private vulnerability reporting** — enable GitHub private vulnerability reporting on repos missing it, from the integration.
35431. **Advisory publishing** — publish the advisory at the embargo time with one click after approvals complete.
35432. **GHSA ID capture** — record the assigned GHSA identifier back on the Dark-Matter finding for traceability.
35433. **NVD sync monitoring** — watch for the CVE's appearance in NVD and update the advisory with the link.
35434. **OSV export** — export advisory data in OSV format for consumption by vulnerability databases.
35435. **SARIF export (integration context)** — attach SARIF results linking the advisory to the exact vulnerable code locations.
35436. **SBOM linkage** — link the advisory to affected SBOMs so consumers can match their inventories.
35437. **VEX statements** — generate VEX statements declaring affected or not-affected status for product versions.
35438. **EPSS monitoring** — track the EPSS score of the published CVE and alert if exploitation likelihood spikes.
35439. **Exploit-publication watch** — monitor for public exploits referencing the GHSA ID and notify the team.
35440. **Fork-network scanning** — scan forks of the repository for unpatched copies of the vulnerable code.
35441. **Downstream notification** — identify downstream dependents and notify maintainers through advisory references.
35442. **Bulk advisory drafting** — draft advisories for multiple findings across a monorepo in one operation.
35443. **Monorepo package scoping** — scope each advisory to the specific package within a monorepo that is affected.
35444. **Multi-ecosystem advisories** — handle findings that affect packages published to several ecosystems at once.
35445. **Reverted-fix detection** — detect when a fix commit is reverted and reopen the advisory workflow.
35446. **Advisory withdrawal** — withdraw published advisories cleanly if the finding is later proven a false positive.
35447. **Advisory amendment** — publish amendments when the affected-version range changes after further analysis.
35448. **Translation support** — generate advisory summaries in multiple languages for global downstream users.
35449. **Severity-dispute handling** — manage disputes when maintainers disagree with the proposed severity, with evidence.
35450. **Bounty-eligibility check** — check whether the repository's bug-bounty program covers the finding before drafting.
35451. **Duplicate GHSA detection** — search existing advisories for the same vulnerability to avoid duplicate CVEs.
35452. **Related-advisory linking** — link advisories for the same vuln class across the organization's repositories.
35453. **Organization advisory dashboard** — show every draft, embargoed, and published advisory across the org in one view.
35454. **Org-wide policy enforcement** — require advisories for all critical findings on org-owned repos via policy.
35455. **SLA tracking** — track time from finding to advisory publication against disclosure SLAs.
35456. **Embargo-breach alerts** — alert immediately if embargoed detail appears publicly before the disclosure date.
35457. **Stale-draft nudges** — remind owners of advisory drafts untouched for more than a week.
35458. **Auto-publish scheduling** — schedule publication for the embargo moment with timezone-aware timing.
35459. **Social announcement drafting** — draft maintainer announcements for the disclosure from the advisory content.
35460. **Changelog entries** — insert security-fix entries into the repository changelog automatically.
35461. **Git tag signing** — sign the patched release tag so consumers can verify the security release.
35462. **Provenance attestation** — attach SLSA provenance to the patched release build.
35463. **Package republishing** — guide republishing patched versions to each affected package registry.
35464. **Deprecation of versions** — deprecate vulnerable versions on the registry with a pointer to the advisory.
35465. **Yanked-version handling** — handle registries that support yanking by yanking critically vulnerable releases.
35466. **Backport advisories** — create advisories for backported fixes on supported older release lines.
35467. **LTS branch tracking** — track which LTS branches need the fix and their advisory status.
35468. **Fix-commit verification** — verify the fix commit actually resolves the PoC before the advisory publishes.
35469. **Regression-test linking** — link the regression test added with the fix to the advisory.
35470. **Fuzz-target suggestions** — suggest fuzz targets covering the vulnerable code path for future prevention.
35471. **CodeQL query linking** — link or generate a CodeQL query detecting the vulnerability pattern.
35472. **Semgrep rule export** — export a Semgrep rule matching the vulnerable pattern for the org's repos.
35473. **Pre-commit hook suggestion** — suggest pre-commit checks that would catch the vulnerability class.
35474. **Secure-coding guidance** — attach language-specific secure-coding guidance to the advisory for developers.
35475. **Training-module linking** — link internal training modules covering the vulnerability class.
35476. **Blast-radius analysis** — estimate how many downstream projects are affected via dependency data.
35477. **Upgrade-path documentation** — document the upgrade path including breaking changes in the advisory.
35478. **Migration scripts** — attach migration scripts when the fix requires configuration changes.
35479. **Compatibility matrix** — publish which versions are vulnerable, patched, or unaffected in a clear matrix.
35480. **End-of-life notices** — flag when the vulnerable version is past end-of-life and no patch will ship.
35481. **Sponsor notification** — notify GitHub Sponsors or stakeholders of security releases per policy.
35482. **Security-advisory RSS** — publish an RSS feed of the org's advisories for downstream consumers.
35483. **Advisory API access** — expose the org's advisories through an API for internal tooling.
35484. **Webhook on publish** — fire a webhook when an advisory publishes so downstream systems react instantly.
35485. **Slack announcement** — post published advisories to the security channel automatically.
35486. **Email subscriber list** — maintain a subscriber list notified of every new advisory.
35487. **PGP-signed notifications** — sign advisory notification emails for verifiable authenticity.
35488. **Bug-bounty platform cross-post** — file the same finding on the bounty platform when the repo is in scope there.
35489. **Researcher payout tracking** — track bounty payouts tied to advisories the researcher earned.
35490. **Hall-of-fame updates** — update the project's security hall of fame when advisories credit external researchers.
35491. **Metrics dashboard** — show advisories published, mean time to publish, and CVEs per quarter.
35492. **Audit export (integration context)** — export the full advisory history with timestamps for compliance audits.
35493. **Data-retention policy** — apply retention rules to private advisory drafts containing exploit detail.
35494. **Access-control review** — periodically review who can view private advisory drafts.
35495. **Two-factor enforcement** — require 2FA for GitHub accounts authorized to publish advisories.
35496. **SSO integration (integration context)** — manage advisory collaborators through the org's SSO groups.
35497. **Audit-log streaming** — stream advisory actions into the SIEM for security monitoring.
35498. **Template versioning (integration context)** — version advisory description templates with change history.
35499. **Multi-org support** — manage advisories across several GitHub organizations from one view.
35500. **Enterprise Server support** — support GitHub Enterprise Server instances with the same advisory workflow.
35501. **GHEC data residency** — respect data-residency choices for advisory content in regulated regions.
35502. **Advisory search** — full-text search across all drafts and published advisories by CVE, CWE, or package.
35503. **Bulk embargo extension** — extend embargo dates across multiple advisories when fixes slip.
35504. **Advisory health score** — score each advisory's completeness and flag missing fields before publication.
35505. **Platform format engines** — render reports in each platform's exact expected structure, including field order and markdown dialect quirks, before submission.
35506. **Field-requirement matrix** — maintain a per-platform matrix of required versus optional report fields so drafts never submit incomplete.
35507. **Submission dry-run validator** — validate a report against each platform's API schema locally and show errors before anything is filed.
35508. **Program-specific checklists** — generate pre-submission checklists from each program's brief, such as required test accounts or excluded report types.
35509. **Safe-harbor pre-check** — verify the finding and testing method comply with the program's safe-harbor terms before drafting.
35510. **Scope-eligibility pre-check** — confirm the affected asset is in scope at submission time, catching scope changes since the hunt.
35511. **Report versioning** — keep versioned report drafts so amendments after triager questions create v2, v3 with diff views.
35512. **Amendment composer** — draft concise amendment notes with new evidence when triagers request clarification.
35513. **Triager-question templates** — answer common triager questions (impact, reproduction, environment) from finding data with one click.
35514. **Triage-chat drafting** — draft professional replies to triager comments in the platform's tone from evidence context.
35515. **Appeal workflow** — guide researchers through disputing not-applicable or duplicate verdicts with structured counter-evidence.
35516. **Duplicate counter-evidence** — assemble differentiation evidence when a report is marked duplicate, showing why it is distinct.
35517. **Severity-dispute helper** — build a severity justification pack with CVSS breakdown when triagers downgrade impact.
35518. **Bounty-negotiation helper** — draft polite renegotiation messages citing the program's bounty table and comparable payouts.
35519. **Report cloning for variants** — clone a report as a starting point for variant findings on the same asset with shared context.
35520. **Variant-linking** — link variant reports together so triagers see the full vulnerability family at once.
35521. **Multi-program submission** — file the same finding across several programs when the asset appears in multiple scopes, with per-program customization.
35522. **Submission scheduling** — queue reports to submit at optimal times, such as after embargo lift or during triager business hours.
35523. **Embargo-aware submission** — hold submissions until coordinated-disclosure embargoes expire automatically.
35524. **Staged disclosure** — submit first to the vendor program, then to public disclosure trackers on a schedule.
35525. **Submission calendar** — show all scheduled and submitted reports on a calendar with triage SLA countdowns.
35526. **Triage SLA tracking** — track each platform's response time against its stated SLA and flag overdue reports.
35527. **Escalation drafting** — draft escalation messages when triage exceeds the platform's SLA with timeline evidence.
35528. **Report-status polling** — poll report states on a schedule and update Dark-Matter without manual refreshes.
35529. **State-change notifications** — notify the researcher the moment a report moves to triaged, resolved, or paid.
35530. **Payout reconciliation** — match incoming bounty payments to reports and flag discrepancies against expected amounts.
35531. **Multi-currency normalization** — normalize payouts across currencies for accurate earnings totals.
35532. **Payout timeline (integration context)** — show expected versus actual payout dates per report for cash-flow planning.
35533. **Tax-report export** — export annual bounty earnings with per-platform breakdowns for tax filing.
35534. **Platform-fee accounting** — account for platform fees where applicable so net earnings are accurate.
35535. **Bonus tracking** — track discretionary bonuses separately from base bounties per report.
35536. **Swag tracking** — log non-monetary rewards like swag or hall-of-fame mentions per program.
35537. **Team attribution splits** — split bounty credit across team members who contributed to a report.
35538. **Team payout ledger** — maintain a ledger of who earned what across shared program work.
35539. **Program comparison dashboard** — compare programs by median payout, triage speed, and acceptance rate for the researcher's history.
35540. **Acceptance-rate analytics** — show per-program valid versus duplicate versus N/A rates to guide where to hunt.
35541. **Payout-per-hour estimates** — estimate effective hourly earnings per program from hunt time and payouts.
35542. **Best-asset recommendations** — recommend which in-scope assets historically yield the best payouts for the researcher's skills.
35543. **Program-health monitoring** — alert when a program's triage times degrade or its scope shrinks significantly.
35544. **New-program alerts** — notify when new programs launch matching the researcher's preferred technologies.
35545. **Invitation prioritization** — rank private-program invitations by expected value using bounty tables and scope size.
35546. **Application tracking** — track applications to invite-only programs with follow-up reminders.
35547. **Onboarding checklists** — generate per-program onboarding checklists covering scope reading and test accounts.
35548. **Program-brief digest** — summarize long program briefs into key rules, exclusions, and bounty highlights.
35549. **Brief-change diffing** — diff program briefs on each sync and highlight rule changes affecting open reports.
35550. **Out-of-scope guard** — block report drafting when the asset is out of scope with the exact exclusion cited.
35551. **Testing-method compliance** — warn when the hunt's methods (such as automated scanning) violate a program's testing rules.
35552. **Credential-use disclosure** — disclose provided test credentials usage in reports where programs require it.
35553. **Retest coordination** — schedule retests through each platform's retest flow with evidence of the claimed fix.
35554. **Fix-verification packs** — attach retest evidence packs formatted for each platform's verification step.
35555. **Disclosure-request workflow** — manage disclosure requests with platform-specific forms and timelines.
35556. **Disclosure countdown** — count down to disclosure eligibility dates per platform policy.
35557. **Public-disclosure drafting** — draft blog-ready disclosure write-ups once reports are resolved and cleared.
35558. **Write-up SEO helper** — suggest titles and tags for public write-ups to maximize visibility.
35559. **Report anonymization** — strip client-identifying details when exporting reports for portfolios.
35560. **Portfolio builder (platform-aggregated public profile)** — build a public portfolio of disclosed reports with platform links and payout totals.
35561. **Reference-letter requests** — draft reference requests to program managers for standout reports.
35562. **Conference-talk proposals** — outline talk proposals from novel findings with disclosure clearance tracking.
35563. **OAuth connection manager** — manage OAuth tokens for every connected platform with scoped permissions.
35564. **API-key rotation reminders** — remind researchers to rotate platform API keys on a schedule.
35565. **Token-scope auditing** — verify connected tokens have only the scopes Dark-Matter needs.
35566. **Connection health checks** — probe each platform's API periodically and report degraded connections.
35567. **Rate-budget dashboard** — show API consumption per platform against limits to plan bulk operations.
35568. **Bulk-operation queuing** — queue bulk scope syncs and status polls with progress bars and pause controls.
35569. **Offline report drafting** — let researchers draft reports offline and sync them when connectivity returns.
35570. **Mobile submission review** — approve and submit drafted reports from a mobile-friendly review view.
35571. **Voice-note reports** — attach voice memos to draft reports for later transcription into the write-up.
35572. **Screenshot annotation (integration context)** — annotate PoC screenshots with arrows and redactions inside the report composer.
35573. **Video hosting** — host PoC videos privately with expiring links accepted by each platform.
35574. **Attachment compression** — compress large evidence bundles to meet each platform's attachment size limits.
35575. **Attachment format conversion** — convert evidence into each platform's preferred formats automatically.
35576. **Link-expiry management** — track expiring evidence links on submitted reports and refresh them before triagers click.
35577. **Report templates per program** — save per-program report templates with the fields each program's triagers prefer.
35578. **Tone customization** — adjust report language formality per program based on past triager feedback.
35579. **Translation for programs** — translate reports for programs that triage in other languages.
35580. **Readability scoring** — score draft reports for clarity and suggest simplifications before submission.
35581. **Evidence-completeness check** — verify every claim in the report has attached evidence before allowing submit.
35582. **Reproduction-step linter** — check reproduction steps for missing prerequisites like test accounts or setup.
35583. **Impact-statement strength** — rate the impact narrative and suggest stronger business-impact framing.
35584. **CVSS consistency check** — verify the CVSS vector matches the described impact and flag contradictions.
35585. **Weakness-taxonomy check** — confirm the selected weakness exists in the platform's taxonomy version.
35586. **Asset-format validation** — validate asset identifiers match each platform's expected format.
35587. **Duplicate self-check** — search the researcher's own submitted reports for similar findings before filing.
35588. **Program-duplicate search** — search public disclosed reports on the program for similar issues to avoid known duplicates.
35589. **Submission confidence gate** — require a minimum confidence score before a report can be submitted.
35590. **Peer-review workflow (integration context)** — route drafts through a teammate's review with inline comments before submission.
35591. **Mentor-review mode** — let mentors review trainee reports with coaching annotations.
35592. **Submission approval chains** — require lead approval for reports above a bounty-value threshold.
35593. **Report archiving** — archive submitted reports with immutable snapshots for legal and portfolio use.
35594. **Data-export compliance** — export all platform data for a researcher on request for privacy compliance.
35595. **Account-deletion handling** — cleanly disconnect and purge platform tokens when a researcher leaves.
35596. **Platform-outage fallback** — queue submissions locally when a platform's API is down and retry automatically.
35597. **Changelog monitoring** — watch platform API changelogs and flag breaking changes affecting the integration.
35598. **Sandbox testing** — test submissions against platform sandbox environments where available.
35599. **Multi-account support** — manage several platform accounts, such as personal and team, with per-report account selection.
35600. **Team workspaces (integration context)** — share program connections and report drafts within a team workspace with roles.
35601. **Role-based permissions** — control who can draft, approve, and submit reports per platform connection.
35602. **Activity audit log** — log every platform action with actor, timestamp, and payload hash.
35603. **Integration usage analytics (integration context)** — report which platforms and features the team uses most to guide investment.
35604. **Platform roadmap sync** — track upcoming platform API features and plan integration upgrades accordingly.
35605. **Pipeline security gate** — fail the build when a hunt against the staging deploy finds a critical, with the finding linked in the failure log.
35606. **Severity-threshold gates** — configure per-pipeline thresholds so only findings at or above a severity block deployment.
35607. **Confidence-threshold gates** — block only on findings above a confidence level to avoid false-positive build breaks.
35608. **New-findings-only gates** — fail the pipeline only on findings introduced by the current change, not pre-existing debt.
35609. **Baseline comparison** — diff hunt results against the last green build's baseline and gate on the delta.
35610. **Grace-period windows** — allow merges with new mediums for a grace period while criticals always block.
35611. **Exemption workflows** — let security leads grant time-boxed exemptions with expiry dates and audit trails.
35612. **Break-glass merges** — permit emergency merges past the gate with mandatory post-merge hunt and review.
35613. **Per-branch policies** — enforce strict gates on main and release branches while keeping feature branches advisory-only.
35614. **Per-environment gates** — run full hunts against staging deploys and lighter checks on pull-request previews.
35615. **Preview-environment hunts** — trigger scoped hunts automatically against ephemeral PR preview deployments.
35616. **Staging-deploy triggers** — start a hunt every time the pipeline deploys to staging, scoped to the changed services.
35617. **Post-deploy verification (integration context)** — run a verification hunt after production deploys and alert on new exposures.
35618. **Canary analysis** — compare hunt results between canary and stable deployments before full rollout.
35619. **Blue-green diff hunts** — hunt both blue and green environments and gate the switch on the security delta.
35620. **GitHub Actions integration (integration context)** — ship a Dark-Matter GitHub Action that hunts the PR's preview URL and posts results as a check.
35621. **GitLab CI integration (integration context)** — provide a GitLab CI template that runs hunts and surfaces findings in merge-request widgets.
35622. **Jenkins plugin (integration context)** — publish a Jenkins plugin that triggers hunts and gates stages on results.
35623. **CircleCI orb (integration context)** — publish a CircleCI orb wrapping hunt triggers and gate evaluation.
35624. **Azure DevOps extension** — ship an Azure DevOps extension adding hunt tasks and gate policies to pipelines.
35625. **Bitbucket Pipe** — provide a Bitbucket Pipe for hunt execution inside Bitbucket Pipelines.
35626. **Buildkite plugin (integration context)** — offer a Buildkite plugin annotating builds with finding summaries.
35627. **TeamCity meta-runner** — supply a TeamCity meta-runner that gates build configurations on hunt outcomes.
35628. **Drone plugin** — provide a Drone CI plugin for container-native hunt steps.
35629. **Harness delegate tasks** — add Harness pipeline steps that run hunts and enforce gates.
35630. **Spinnaker webhooks** — trigger hunts from Spinnaker deployment events and gate pipeline stages.
35631. **Argo CD sync hooks** — run hunts as Argo CD sync-wave hooks before an application goes live.
35632. **Flux notifications** — react to Flux deployment notifications with automatic verification hunts.
35633. **Tekton tasks (integration context)** — ship Tekton task definitions for hunt execution in Kubernetes-native pipelines.
35634. **Check-run annotations** — annotate pull requests with finding details inline via GitHub check runs.
35635. **PR comment summaries** — post a concise hunt summary as a PR comment with severity counts and links.
35636. **PR status checks (integration context)** — report gate pass or fail as a required status check blocking merge.
35637. **Inline code annotations** — annotate the exact lines likely responsible for a finding in the PR diff view.
35638. **Suggested-fix comments** — post fix suggestions as review comments with code snippets on the PR.
35639. **Security-review assignment** — auto-request security-team review on PRs that introduce new findings.
35640. **Draft-PR early hunts** — run lightweight hunts on draft PRs to catch issues before review starts.
35641. **Monorepo scoping** — scope hunts to the packages changed in the PR using monorepo dependency graphs.
35642. **Changed-files targeting** — target the hunt's probes at endpoints owned by the changed files.
35643. **Dependency-change hunts** — trigger dependency-focused hunts when lockfiles change in the PR.
35644. **Dockerfile-change checks** — run container-hardening checks when Dockerfiles change.
35645. **IaC-change checks** — scan Terraform and CloudFormation changes for misconfigurations on every PR.
35646. **Secret-scan on push** — scan commits for leaked secrets and block the push when high-confidence leaks appear.
35647. **License-change alerts (integration context)** — flag license changes in dependencies that affect compliance posture.
35648. **SBOM generation** — generate an SBOM for every build and attach it to the pipeline artifact.
35649. **SBOM diffing** — diff SBOMs between builds and highlight newly introduced vulnerable components.
35650. **Vulnerability-scan stage** — add a dedicated pipeline stage combining SCA, container, and Dark-Matter hunt results.
35651. **Unified security report** — merge SAST, DAST, SCA, and hunt findings into one pipeline security report.
35652. **Dedup across scanners** — deduplicate Dark-Matter findings against SAST and SCA results in the pipeline view.
35653. **SARIF upload** — upload hunt findings as SARIF so GitHub code scanning displays them natively.
35654. **GitLab vulnerability report** — feed findings into GitLab's vulnerability report for the project.
35655. **DefectDojo sync** — push pipeline findings into DefectDojo for centralized vulnerability management.
35656. **Kenna prioritization** — send findings to Kenna-style prioritization with exploit-intel enrichment.
35657. **Ticket auto-creation** — create Jira or Linear tickets for gate-blocking findings with the build linked.
35658. **Build-to-ticket linking** — link every finding ticket back to the exact build and commit that introduced it.
35659. **Flaky-gate detection** — detect gates that flip between pass and fail without code changes and flag hunt instability.
35660. **Gate-performance metrics** — track hunt duration and gate decision time per pipeline to optimize speed.
35661. **Parallel hunt execution** — run hunts for multiple services in a monorepo pipeline in parallel.
35662. **Incremental hunts** — hunt only what changed since the last green build to keep pipeline times short.
35663. **Cached recon reuse** — reuse recon results across pipeline runs when the target infrastructure is unchanged.
35664. **Hunt timeout policies** — enforce maximum hunt durations in pipelines with graceful partial results.
35665. **Resource quotas** — cap CPU and memory for pipeline hunts so they never starve build agents.
35666. **Self-hosted runner support** — run hunts on self-hosted runners for pipelines that cannot reach the cloud.
35667. **Air-gapped pipelines** — support fully offline pipelines with pre-seeded brains and local evidence storage.
35668. **Artifact retention** — retain hunt evidence as pipeline artifacts with configurable retention periods.
35669. **Evidence download links** — expose evidence bundles as downloadable artifacts from the pipeline UI.
35670. **Hunt provenance attestation** — attest which brain version and hunt profile produced each pipeline result.
35671. **Reproducible hunts** — pin brain and profile versions so pipeline hunts reproduce exactly on rerun.
35672. **Pipeline secret handling** — inject test credentials into hunts from the pipeline's secret store without logging them.
35673. **Environment promotion gates (integration context)** — require a clean hunt before promoting builds from staging to production.
35674. **Release-branch hunts** — run full hunts on release branches on a schedule regardless of code changes.
35675. **Hotfix fast-track** — run an accelerated hunt profile for hotfix branches with results in minutes.
35676. **Rollback triggers** — trigger automatic rollback when a post-deploy hunt finds a critical regression.
35677. **Deployment freeze integration (integration context)** — respect deployment-freeze calendars and queue hunts instead of blocking.
35678. **Change-ticket linking** — link pipeline hunt results to change-management tickets for audit.
35679. **Compliance evidence** — export pipeline hunt logs as compliance evidence for SOC 2 and ISO audits.
35680. **Policy-as-code gates (integration context)** — define gate policies in versioned YAML with pull-request review for changes.
35681. **OPA integration** — evaluate gate decisions through Open Policy Agent for enterprise policy engines.
35682. **Conftest checks** — validate hunt configurations with Conftest before pipeline execution.
35683. **Signed pipeline configs** — require signed hunt configurations to prevent tampering in shared pipelines.
35684. **Multi-repo orchestration** — coordinate hunts across microservice repos deploying together.
35685. **Contract-test pairing** — pair API contract tests with security probes on the same preview deploy.
35686. **Load-test correlation** — correlate performance-test anomalies with security findings on the same build.
35687. **Feature-flag awareness** — hunt with feature flags in both states when a PR toggles them.
35688. **Database-migration checks** — verify migration scripts do not expose data or weaken constraints.
35689. **Seed-data scanning** — scan seed and fixture data for production-like secrets accidentally committed.
35690. **Test-account provisioning** — provision ephemeral test accounts for authenticated hunts in the pipeline.
35691. **Ephemeral-env teardown** — guarantee preview environments are destroyed after the hunt completes.
35692. **Cost controls (integration context)** — cap hunt compute cost per pipeline run with alerts on overruns.
35693. **Carbon-aware scheduling** — schedule heavy hunts in low-carbon grid windows where the provider supports it.
35694. **Notification routing** — send pipeline gate failures to the PR author, reviewers, and security channel.
35695. **ChatOps approvals** — approve exemptions or break-glass merges from Slack with identity verification.
35696. **Dashboard widgets** — embed pipeline security posture widgets in engineering dashboards.
35697. **Executive pipeline reports** — summarize pipeline security gates weekly for leadership.
35698. **Developer feedback loop** — show developers which of their past fixes prevented findings to reinforce good habits.
35699. **False-positive feedback** — let developers mark pipeline findings as false positives to tune future gates.
35700. **Gate-bypass auditing** — log every gate bypass with approver identity for security review.
35701. **Pipeline coverage map** — show which repos and branches have hunt gates enabled and which do not.
35702. **Adoption campaigns** — guide teams through enabling gates repo by repo with progress tracking.
35703. **Migration assistant** — migrate teams from legacy DAST pipeline steps to Dark-Matter hunts automatically.
35704. **Pipeline health score** — score each pipeline's security maturity from gate coverage, findings, and fix times.
35705. **Hunt-lifecycle events** — fire webhooks for hunt started, paused, resumed, completed, and failed with consistent envelopes.
35706. **Finding-lifecycle events** — fire webhooks when findings are created, confirmed, triaged, fixed, or marked false positive.
35707. **Retest webhook events** — emit webhooks when retests start and finish with pass or fail outcomes.
35708. **Report events** — fire webhooks when reports are generated, updated, or exported.
35709. **Ticket events** — emit webhooks when tickets are created, updated, or closed through integrations.
35710. **Integration-health events** — fire webhooks when any connected integration degrades or recovers.
35711. **Brain-status events** — emit webhooks when the Kaggle brain connects, disconnects, or switches models.
35712. **User-action events** — fire webhooks for researcher actions like triage decisions and note additions for audit mirrors.
35713. **HMAC-SHA256 signing** — sign every webhook payload with HMAC-SHA256 so receivers verify authenticity.
35714. **Signature-rotation support** — support dual active signing secrets during rotation without dropping events.
35715. **Timestamp tolerance** — include timestamps and let receivers reject deliveries outside a configurable skew window.
35716. **Idempotency keys** — attach unique event IDs so receivers can deduplicate retried deliveries safely.
35717. **Event sequencing** — include per-stream sequence numbers so receivers detect gaps and reorder correctly.
35718. **Schema versioning** — version every event schema and announce deprecations well before breaking changes.
35719. **JSON Schema publishing (integration context)** — publish machine-readable JSON Schemas for every event type.
35720. **OpenAPI webhook docs** — document all webhook events in the OpenAPI spec with example payloads.
35721. **Event catalog UI** — browse every event type with sample payloads and field descriptions in the settings UI.
35722. **Test-event sender** — fire synthetic test events to a new endpoint to validate parsing before going live.
35723. **Endpoint management** — create, edit, enable, disable, and delete webhook endpoints per workspace.
35724. **Per-event subscriptions** — subscribe each endpoint to only the event types it needs.
35725. **Event filtering** — filter deliveries by severity, target, tag, or confidence with rule builders.
35726. **Payload templates** — customize the JSON payload shape per endpoint with a templating language.
35727. **Header customization** — set custom headers per endpoint, such as authorization tokens for the receiver.
35728. **URL validation** — validate endpoint URLs at creation, rejecting non-HTTPS URLs except for explicit local allowances.
35729. **SSRF protection** — block webhook deliveries to private IP ranges and cloud metadata endpoints.
35730. **DNS-rebinding guards** — re-resolve endpoint hostnames at delivery time to prevent rebinding attacks.
35731. **Retry with backoff (integration context)** — retry failed deliveries with exponential backoff over 24 hours.
35732. **Dead-letter queue** — park events that exhaust retries in a dead-letter queue for manual inspection and replay.
35733. **Manual replay** — replay any historical event to an endpoint from the delivery log.
35734. **Bulk replay** — replay a filtered set of events, such as all findings from a hunt, after fixing a receiver.
35735. **Delivery log** — show every delivery attempt with status code, latency, and response snippet.
35736. **Endpoint health scores** — score endpoints by success rate and latency, alerting on degradation.
35737. **Circuit breakers** — pause deliveries to endpoints that fail repeatedly and resume automatically on recovery.
35738. **Rate limiting** — throttle deliveries per endpoint to protect receivers from bursts.
35739. **Burst batching** — batch high-frequency events into a single delivery during traffic spikes.
35740. **Ordering guarantees** — offer per-key ordered delivery for receivers that need strict sequencing.
35741. **At-least-once semantics** — document and implement at-least-once delivery with deduplication guidance.
35742. **Payload size limits** — cap payload sizes with truncation rules and links to full objects for large evidence.
35743. **Compression support** — gzip-compress large payloads when receivers advertise support.
35744. **Mutual TLS** — support mTLS client certificates for receivers that require them.
35745. **IP allowlisting (integration context)** — publish Dark-Matter's egress IPs so receivers can allowlist webhook traffic.
35746. **Custom CA support** — trust custom certificate authorities for on-premises receivers.
35747. **Proxy support** — route webhook deliveries through configured HTTP proxies for restricted networks.
35748. **Secret management** — store signing secrets and endpoint tokens encrypted with rotation reminders.
35749. **Secret-scoped endpoints** — restrict which events an endpoint can receive based on the secret's scope.
35750. **Workspace isolation** — keep webhook configurations isolated between workspaces and tenants.
35751. **Audit trail** — log every endpoint change with actor identity for compliance.
35752. **Change notifications** — notify admins when webhook endpoints are added, modified, or deleted.
35753. **PII redaction options** — strip or hash PII fields from payloads per endpoint policy.
35754. **Webhook payload field allowlists** — let endpoints receive only explicitly allowed fields for least-privilege data sharing.
35755. **Redaction preview** — preview exactly what a receiver will see after redaction rules apply.
35756. **Multi-region delivery** — deliver from the nearest region to reduce latency for global receivers.
35757. **Event archiving (integration context)** — archive all emitted events for a configurable period for replay and audit.
35758. **Event search** — search archived events by type, finding, hunt, or time range.
35759. **Analytics dashboard** — show delivery volumes, success rates, and latency per endpoint and event type.
35760. **Alert on failures** — notify admins when an endpoint's failure rate crosses a threshold.
35761. **Slack-compatible mode** — format payloads to post directly to Slack incoming webhooks without middleware.
35762. **Teams-compatible mode** — format payloads for Teams incoming webhooks and Power Automate triggers.
35763. **Discord-compatible mode** — format payloads for Discord webhook embeds natively.
35764. **Generic JSON mode** — send the canonical event JSON for custom receivers.
35765. **CloudEvents format** — emit events in CloudEvents format for Knative and event-mesh consumers.
35766. **AWS EventBridge partner** — publish as an EventBridge partner event source for AWS-native routing.
35767. **Azure Event Grid** — publish to Azure Event Grid topics for Azure-native consumers.
35768. **GCP Pub/Sub** — publish to Pub/Sub topics as an alternative to HTTPS delivery.
35769. **Kafka delivery** — write events to customer Kafka topics instead of HTTPS endpoints.
35770. **SQS delivery** — deliver events to SQS queues for AWS consumers that prefer polling.
35771. **Zapier triggers** — expose finding and hunt events as Zapier triggers for no-code automation.
35772. **Make.com scenarios** — provide Make.com modules that consume Dark-Matter events.
35773. **IFTTT applets** — offer simple IFTTT triggers for personal researcher notifications.
35774. **Pipedream sources** — publish Pipedream event sources for developer-friendly workflow building.
35775. **Workato recipes** — ship Workato recipes connecting findings to enterprise apps.
35776. **Tray.io connectors** — provide Tray.io connectors for visual workflow automation.
35777. **n8n nodes** — publish n8n trigger nodes for self-hosted automation users.
35778. **Activepieces pieces** — contribute Activepieces pieces for open-source automation.
35779. **Temporal signals** — send events as Temporal signals to drive durable workflow executions.
35780. **Cadence signals** — support Cadence workflows with event signals for long-running response processes.
35781. **Event-driven ticketing** — drive the Jira and Linear integrations themselves through the webhook bus internally.
35782. **Event-driven notifications** — power Slack, Discord, and Teams notifications from the same event stream.
35783. **Event-driven SIEM export** — feed SIEM exporters from the canonical event bus for consistency.
35784. **Plugin event hooks** — let custom plugins subscribe to internal events through the SDK.
35785. **Fan-out ordering** — guarantee consistent event ordering across all subscribed endpoints.
35786. **Event sampling controls** — sample high-volume telemetry events per endpoint while keeping findings complete.
35787. **Webhook delivery cost tracking** — track delivery costs per endpoint for usage-based billing in managed offerings.
35788. **Endpoint templates** — provide one-click endpoint templates for Jira, Slack, Splunk, and other common receivers.
35789. **Import-export configs** — export webhook configurations as YAML for version control and import elsewhere.
35790. **Environment promotion (integration context)** — promote webhook configs from staging to production workspaces safely.
35791. **Dry-run mode** — log what would be delivered without sending anything during configuration.
35792. **Shadow endpoints** — mirror production events to a shadow endpoint for receiver development.
35793. **Contract testing** — verify receiver compatibility against schema versions automatically.
35794. **Breaking-change warnings** — warn endpoint owners before deploying schema changes affecting their filters.
35795. **Deprecation timelines (integration context)** — publish clear deprecation timelines for old event versions.
35796. **Schema-version migration guide** — help receivers migrate between event schema versions with field-mapping guides.
35797. **SDK receiver libraries** — publish receiver SDKs in Python, Node.js, and Go that verify signatures and parse events.
35798. **Example receivers** — ship example receiver implementations for common stacks.
35799. **Local tunnel testing** — integrate with tunnel tools so developers test webhooks against localhost safely.
35800. **Request-bin debugging** — spin up temporary capture endpoints for debugging payload shapes.
35801. **Payload diffing** — diff payloads between schema versions to spot breaking changes.
35802. **Latency budgets** — set per-endpoint latency budgets and alert when deliveries slow down.
35803. **Regional failover** — fail webhook delivery over to another region if the primary egress fails.
35804. **Webhook status page** — publish a status page showing event-bus health and recent incidents.
35805. **Status-change ingestion** — watch Jira and Linear for ticket transitions and update the linked finding's state in Dark-Matter within a minute.
35806. **Comment mirroring** — copy ticket comments into the finding's note thread so conversations stay visible in both tools.
35807. **Bidirectional comment sync** — post Dark-Matter notes back to the ticket so neither side misses context.
35808. **Assignee sync** — reflect ticket assignee changes onto the finding's owner field automatically.
35809. **Priority-change sync** — update the finding's priority when a human reprioritizes the ticket.
35810. **Label-change sync** — mirror label additions and removals between tickets and findings.
35811. **Sprint-change awareness** — track when tickets move between sprints to adjust SLA expectations.
35812. **Fix-version sync** — record the ticket's fix version on the finding for release-note generation.
35813. **Resolution sync** — map ticket resolutions (done, won't fix, duplicate) to finding outcomes precisely.
35814. **Won't-fix handling** — mark findings as accepted-risk with expiry dates when tickets resolve as won't fix.
35815. **Duplicate-link sync** — follow ticket duplicate links to merge the corresponding findings in Dark-Matter.
35816. **Epic-change sync** — update campaign grouping when tickets move between epics.
35817. **Close-triggers-retest** — launch a retest hunt automatically when a ticket transitions to done or resolved.
35818. **Retest-on-fix-version** — trigger retests when the fix version deploys to staging, not just on ticket close.
35819. **Failed-retest reopen** — reopen the ticket with fresh evidence when the retest shows the vulnerability persists.
35820. **Passed-retest close** — move the finding to verified-fixed and comment the proof on the ticket when retests pass.
35821. **Partial-fix detection** — keep the ticket open with a partial-fix note when the retest shows reduced but remaining impact.
35822. **Regression auto-tickets** — open a new linked ticket if a previously fixed finding reappears in later hunts.
35823. **Reopen-reason stamping** — stamp the exact retest evidence that caused a reopen onto the ticket.
35824. **Stale-ticket retest** — schedule retests for tickets open beyond a threshold to check if the issue still exists.
35825. **Ticket-closure audit** — verify the linked finding is actually fixed before allowing sync to mark it closed.
35826. **Conflict detection (integration context)** — detect when a human edits a synced field in Dark-Matter while the ticket changes too.
35827. **Conflict resolution rules** — apply last-writer-wins or tracker-wins policies per field with clear precedence.
35828. **Conflict review queue** — surface sync conflicts in a review queue with side-by-side values for manual resolution.
35829. **Field-lock indicators** — show which fields are tracker-managed versus Dark-Matter-managed to prevent edit wars.
35830. **Sync-direction policies** — configure per-field sync direction: tracker-to-DM, DM-to-tracker, or bidirectional.
35831. **One-way mode** — support tracker-read-only mode for teams that forbid automation from writing tickets.
35832. **Sync pause controls** — pause sync per project during migrations without losing queued changes.
35833. **Change batching** — batch rapid successive changes into single ticket updates to avoid comment spam.
35834. **Quiet-sync windows** — apply bulk sync changes during off-hours to keep ticket histories clean.
35835. **Sync health dashboard** — show per-project sync status, lag, error rates, and last-successful-sync times.
35836. **Lag alerts** — alert when sync lag exceeds a threshold, indicating API or queue problems.
35837. **Error quarantine** — quarantine failing sync items with error details instead of blocking the whole queue.
35838. **Retry policies** — retry transient API failures with backoff and escalate persistent ones.
35839. **Rate-limit coordination** — share API rate budgets between outbound ticketing and inbound sync polling.
35840. **Webhook-first sync** — prefer tracker webhooks for instant updates with polling as a fallback.
35841. **Polling fallback** — poll on a schedule when webhooks are unavailable, with adaptive intervals.
35842. **Catch-up sync** — reconcile all changes since the last successful sync after outages.
35843. **Initial backfill** — backfill historical ticket states when first connecting an existing project.
35844. **Selective sync (integration context)** — sync only tickets linked to Dark-Matter findings, ignoring unrelated project issues.
35845. **Linkage discovery** — discover existing tickets that match findings by hash or title for retroactive linking.
35846. **Manual link tool** — let users manually link or unlink findings and tickets with search pickers.
35847. **Link-integrity checks** — detect broken links from deleted tickets and flag orphaned findings.
35848. **Multi-tracker support** — sync with Jira and Linear simultaneously for teams migrating between them.
35849. **Tracker migration** — move finding linkages from one tracker to another while preserving history.
35850. **Project-move handling** — follow tickets moved between projects and keep sync working.
35851. **Issue-type changes** — adapt when tickets change issue types, remapping fields accordingly.
35852. **Workflow-change adaptation** — detect tracker workflow changes and remap state transitions automatically.
35853. **Custom-field sync** — sync configured custom fields both ways with type conversion.
35854. **Attachment sync** — mirror new attachments added on either side to the other.
35855. **Watchers sync** — keep watcher lists aligned so the right people get notified everywhere.
35856. **Vote sync** — reflect ticket votes or Linear reactions on the finding's community-priority signal.
35857. **Time-tracking sync** — pull logged work time from tickets into finding remediation-cost metrics.
35858. **Estimate sync** — keep story-point or Linear estimates mirrored for planning accuracy.
35859. **Subtask sync** — mirror subtask completion states onto the finding's remediation checklist.
35860. **Parent-link sync** — follow parent-issue changes to keep campaign grouping accurate.
35861. **Release sync** — sync release and fix-version assignments to plan verification hunts per release.
35862. **Board-column mapping** — map kanban board columns to finding states for accurate status reflection.
35863. **Triage-inbox flow** — move findings out of triage when their Linear triage-inbox items are accepted or declined.
35864. **SLA sync** — mirror ticket SLA clocks onto findings for unified deadline tracking.
35865. **Ticket-escalation mirroring** — reflect ticket escalations on the finding and notify the security channel.
35866. **Approval sync** — track ticket approval steps and gate retests until approvals complete.
35867. **Reviewer sync** — show assigned reviewers from the tracker on the finding for accountability.
35868. **Mention sync** — convert @mentions between platforms so the right people get pinged.
35869. **Emoji-reaction sync** — treat emoji reactions on linked messages as lightweight triage signals.
35870. **Template sync** — keep ticket description templates aligned when finding templates change.
35871. **Automation-rule guard** — detect tracker automation rules that fight the sync and warn administrators.
35872. **Loop prevention** — stamp sync-origin markers so updates never bounce infinitely between systems.
35873. **Idempotent applies** — make every inbound change idempotent so duplicate webhook deliveries are harmless.
35874. **Event sourcing log** — keep an append-only log of every sync event for debugging and audit.
35875. **Point-in-time replay** — replay the sync log to reconstruct past states during incident investigation.
35876. **Data-residency compliance** — keep synced data within required regions for regulated customers.
35877. **PII minimization** — sync only the minimum ticket fields needed, excluding reporter personal data.
35878. **Redaction sync** — apply the same exploit-detail redaction rules to synced comments as to notifications.
35879. **Access-review sync** — reflect tracker permission changes by adjusting what finding data syncs outward.
35880. **Service-account scoping** — restrict the sync service account to only the projects it manages.
35881. **OAuth-scope minimization** — request only the tracker OAuth scopes the sync actually uses.
35882. **Token-expiry handling** — refresh expiring tracker tokens automatically and alert on refresh failures.
35883. **Multi-instance support** — sync with multiple Jira instances or Linear workspaces from one Dark-Matter tenant.
35884. **Sandbox sync** — test sync configurations against tracker sandboxes before production.
35885. **Sync simulation** — simulate a full sync cycle against recorded tracker data to preview changes.
35886. **Drift detection (integration context)** — detect when ticket and finding states drift apart and propose reconciliation.
35887. **Reconciliation jobs** — run scheduled reconciliation that heals drift without duplicating comments.
35888. **Orphan cleanup** — archive findings whose tickets were deleted after a grace period and owner notice.
35889. **Sync metrics export** — export sync latency, error, and volume metrics to the SIEM and dashboards.
35890. **Per-user sync attribution** — attribute inbound changes to the tracker user who made them for audit.
35891. **Bot-identity clarity** — mark all Dark-Matter-written ticket updates with a clear bot signature.
35892. **Human-override flag** — let humans flag a field as manually overridden to pause sync on it.
35893. **Bulk-link tool** — link many findings to existing tickets at once using hash matching.
35894. **Bulk-unlink tool** — unlink findings from tickets in bulk during project restructuring.
35895. **Sync-rule versioning** — version sync rules in git with review before activation.
35896. **Rule testing** — test sync rules against historical data before enabling them.
35897. **A/B rule testing** — compare sync-rule variants on mirrored projects to optimize behavior.
35898. **Notification consolidation** — consolidate sync-driven notifications so users get one digest, not a flood.
35899. **Mobile sync status** — check sync health and resolve conflicts from a mobile view.
35900. **Offline queue (integration context)** — queue outbound sync changes when the tracker is unreachable and flush on recovery.
35901. **Maintenance windows** — schedule sync pauses around tracker maintenance with automatic resume.
35902. **Disaster recovery** — rebuild linkages from the event-sourcing log after catastrophic sync failures.
35903. **Sync SLA reporting** — report sync timeliness against internal SLAs for the integration itself.
35904. **Maturity scoring** — score each project's bidirectional-sync maturity and recommend next improvements.
35905. **Public REST API** — expose a versioned REST API covering hunts, findings, tickets, reports, and integrations with OpenAPI documentation.
35906. **GraphQL endpoint** — offer a GraphQL API for flexible finding and hunt queries with precise field selection.
35907. **API key management** — issue scoped API keys per integration with expiry dates and usage dashboards.
35908. **OAuth2 app framework** — let third-party apps authenticate users via OAuth2 with granular scopes.
35909. **Scoped permissions** — define fine-grained scopes like findings:read and hunts:write for least-privilege integrations.
35910. **Rate-limit headers** — return standard rate-limit headers so clients back off gracefully.
35911. **Pagination standards** — use cursor-based pagination consistently across all list endpoints.
35912. **Filtering DSL** — support a consistent filter syntax across endpoints for severity, target, state, and time.
35913. **Bulk endpoints** — provide bulk create, update, and delete endpoints to cut chatty integrations' round trips.
35914. **Async job endpoints** — return job handles for long operations like report generation with status polling.
35915. **Idempotency headers** — accept idempotency keys on mutating endpoints so retries never double-apply.
35916. **ETag concurrency** — use ETags and conditional requests to prevent lost updates from concurrent clients.
35917. **API versioning** — version the API in the URL path with 12-month deprecation notices.
35918. **Changelog feed** — publish a machine-readable API changelog so integrators track changes.
35919. **SDK for Python** — publish an official Python SDK with typed models and retry logic.
35920. **SDK for JavaScript** — publish an official Node.js and browser SDK with TypeScript definitions.
35921. **SDK for Go** — publish an official Go SDK for infrastructure and CLI integrations.
35922. **SDK for Java** — publish an official Java SDK for enterprise consumers.
35923. **SDK for Ruby** — publish a Ruby SDK for DevOps and Rails-shop integrations.
35924. **SDK for .NET** — publish a C# SDK for Windows-centric enterprise teams.
35925. **SDK for Rust** — publish a Rust SDK for performance-sensitive agent integrations.
35926. **SDK for PHP** — publish a PHP SDK for WordPress and Laravel ecosystem tools.
35927. **CLI companion (integration context)** — ship a CLI that wraps the API for scripting hunts and findings from terminals.
35928. **Terraform provider (integration context)** — manage Dark-Matter projects, integrations, and policies as Terraform resources.
35929. **Pulumi provider (integration context)** — offer a Pulumi provider for infrastructure-as-code management in modern stacks.
35930. **Ansible collection (integration context)** — provide Ansible modules for configuring hunts and integrations in playbooks.
35931. **Chef cookbook (integration context)** — ship Chef resources for managing Dark-Matter configuration.
35932. **Puppet module (integration context)** — provide a Puppet module for declarative Dark-Matter setup.
35933. **Salt formulas** — offer Salt formulas for Dark-Matter agent configuration.
35934. **Helm chart values** — expose every integration setting through Helm values for Kubernetes deploys.
35935. **Docker Compose templates** — provide Compose templates wiring Dark-Matter to SIEM and ticketing sidecars.
35936. **Connector framework** — define a standard connector interface with lifecycle hooks for community integrations.
35937. **Connector manifest** — describe connectors with manifests declaring capabilities, config schema, and permissions.
35938. **Connector sandbox** — run third-party connectors in a sandbox with restricted network and filesystem access.
35939. **Connector permissions** — grant connectors only the API scopes their manifest declares.
35940. **Connector marketplace** — browse, install, and rate community connectors from inside Dark-Matter.
35941. **Connector signing** — require signed connector packages so tampered connectors refuse to load.
35942. **Connector auto-updates** — update connectors automatically with rollback on health-check failure.
35943. **Connector health checks** — probe installed connectors periodically and disable failing ones safely.
35944. **Example connectors** — ship reference connectors for Jira, Slack, Splunk, and GitHub as copy-paste starters.
35945. **Connector scaffolding** — generate a new connector project with tests and docs from a single command.
35946. **Connector testing kit** — provide fixtures and mocks simulating hunts and findings for connector tests.
35947. **Event subscription API** — let connectors subscribe to internal events with filter expressions.
35948. **Action registration** — let connectors register custom actions that appear in finding and hunt menus.
35949. **UI extension points** — allow connectors to inject panels, tabs, and buttons into the Dark-Matter UI.
35950. **Dashboard widgets API** — let connectors contribute widgets to team dashboards.
35951. **Report-section plugins** — let connectors add custom sections to generated PDF and Markdown reports.
35952. **Evidence-processor plugins** — let connectors transform or enrich evidence bundles during export.
35953. **Detection-rule plugins** — let connectors contribute custom detection rules to the hunt engine.
35954. **Scoring plugins** — let connectors plug in custom risk-scoring models alongside the built-in scorer.
35955. **Enrichment plugins** — let connectors enrich findings with external data during triage.
35956. **Notification-channel plugins** — let connectors add new notification channels beyond the built-ins.
35957. **Auth-provider plugins** — let connectors add SSO or MFA providers for login.
35958. **Storage-backend plugins** — let connectors add evidence storage backends like S3-compatible stores.
35959. **Secrets-backend plugins** — let connectors integrate alternative secret vaults for credential storage.
35960. **AI-provider plugins** — let connectors add new brain model providers behind the standard interface.
35961. **Tool-adapter plugins** — let connectors wrap external scanners as hunt steps with normalized output.
35962. **Playbook-action plugins** — let connectors add custom actions to SOAR playbook definitions.
35963. **Export-format plugins** — let connectors add new export formats for findings and reports.
35964. **Import-format plugins** — let connectors import findings from proprietary scanner formats.
35965. **Language-pack plugins** — let connectors contribute translations for the UI and notifications.
35966. **Theme plugins** — let connectors ship UI themes for customer branding.
35967. **Hot-reload plugins** — reload connector code without restarting Dark-Matter during development.
35968. **Plugin configuration UI** — auto-generate settings pages from each connector's config schema.
35969. **Plugin secrets UI** — collect connector credentials through a secure vault-backed form.
35970. **Plugin logging** — give each connector an isolated log stream visible in the admin console.
35971. **Plugin metrics** — expose per-connector call counts, errors, and latency for monitoring.
35972. **Plugin resource limits (connector-runtime context)** — cap CPU, memory, and network per connector to protect the host.
35973. **Plugin dependency isolation** — isolate connector dependencies so version conflicts cannot break the core.
35974. **Plugin API stability** — guarantee connector API stability within major versions with deprecation windows.
35975. **Developer portal** — host docs, guides, API references, and changelogs in a dedicated developer portal.
35976. **Interactive API explorer** — try API calls live from the docs with the user's own scoped token.
35977. **Code samples library** — provide copy-paste samples for common tasks in every supported language.
35978. **Postman collection (integration context)** — publish a maintained Postman collection covering the whole API.
35979. **Insomnia collection** — publish an Insomnia collection as an alternative API client pack.
35980. **OpenAPI validators** — validate requests and responses against the published spec in CI.
35981. **Mock API server** — run a mock API server from the OpenAPI spec for integration development.
35982. **Tutorial tracks** — offer guided tutorials from first API call to production connector.
35983. **Certification program** — certify community connectors that pass security and quality reviews.
35984. **Security review process** — document the security review every marketplace connector undergoes.
35985. **Vulnerability disclosure** — run a disclosure program specifically for the API and SDK.
35986. **Bug-bounty for API** — reward researchers who find API security issues through the disclosure program.
35987. **Deprecation policy (integration context)** — publish clear deprecation timelines and migration guides for API changes.
35988. **Sunset headers** — send Sunset and Deprecation headers for endpoints nearing removal.
35989. **Client telemetry** — collect opt-in SDK telemetry to prioritize API improvements.
35990. **Error-code catalog** — document every API error code with causes and fixes.
35991. **Status codes guide** — explain exactly when each HTTP status is returned with examples.
35992. **Retry guidance** — publish retry strategies per endpoint with idempotency notes.
35993. **Webhook verification helpers** — include signature-verification helpers in every SDK.
35994. **Pagination helpers** — auto-paginate list endpoints in SDKs with iterators.
35995. **Streaming helpers** — wrap SSE event streams in SDK-friendly async iterators.
35996. **File-upload helpers** — handle chunked evidence uploads with resume in the SDKs.
35997. **SDK proxy support** — respect standard proxy environment variables in all SDKs.
35998. **Custom CA bundles** — let SDK users supply custom CA bundles for on-prem TLS.
35999. **Timeout configuration** — expose per-operation timeouts in every SDK.
36000. **Telemetry opt-out (integration context)** — let SDK users disable all telemetry with a single flag.
36001. **Air-gapped SDK mode** — run SDKs fully offline against local Dark-Matter instances.
36002. **Integration blueprints** — publish end-to-end blueprints like Jira-to-Slack-to-SIEM reference architectures.
36003. **Solution accelerators** — ship prebuilt solution packs for MSSPs, enterprises, and bug-bounty teams.
36004. **Partner program** — run a technology-partner program with co-marketing for deep integrations.
