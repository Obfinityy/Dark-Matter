# Dark-Matter Ideation — Batch 3, Part 05: Advanced Automation Workflows
Ideas 24005–25004. Category: scheduling, triggers, campaigns, conditional logic, templates, governance.

## 1. Scheduled Hunts (24005–24104)

24005. **Visual cron builder UI** — drag-and-drop minute/hour/day/month/weekday pickers that generate a valid cron expression with a live human-readable summary so non-technical users can schedule hunts without cron syntax errors.
24006. **IANA-timezone wall-clock scheduling** — every schedule stores an IANA timezone and executes at the correct local wall-clock time, converting automatically so a 2am scan stays 2am local regardless of server location.
24007. **Automatic DST adjustment** — schedules detect daylight-saving transitions in their timezone and shift execution to keep the intended local time, with a warning badge when the next run falls in a skipped or repeated hour.
24008. **Blackout window manager** — define recurring blackout windows (e.g. Fridays 9am–6pm) during which no hunt may start, preventing accidental production testing during peak business hours.
24009. **One-click "never hunt prod on Fridays" preset** — a prebuilt blackout template that blocks Friday production hunts with one toggle, addressing the most common change-freeze policy directly.
24010. **Per-environment blackout rules** — separate blackout calendars for production, staging, and development so staging can be hunted aggressively while production stays protected.
24011. **Regional blackout calendars** — blackout windows scoped to geographic regions (e.g. no EU hunts during GDPR-audit week) with per-region holiday imports.
24012. **Holiday calendar import** — import public holidays per country into the scheduler so recurring hunts automatically skip national holidays when a "skip holidays" flag is set.
24013. **Recurring hunt preset: weekly full** — a one-click preset that schedules a comprehensive full-scope hunt every week with deep recon, active testing, and full reporting.
24014. **Recurring hunt preset: daily quick** — a one-click preset for a lightweight daily smoke scan (new endpoints, obvious misconfigurations) that completes in under 30 minutes.
24015. **Recurring hunt preset: monthly deep** — a one-click preset for a monthly exhaustive hunt including manual-review queues and chained attack paths.
24016. **Custom recurring preset builder** — save any hunt configuration as a named reusable preset (scope, profile, schedule, notifications) so teams standardize their cadences.
24017. **Schedule template library** — built-in templates like "SaaS weekly", "e-commerce nightly", "API hourly diff" with sensible defaults the user can apply and tweak.
24018. **Calendar view of upcoming hunts** — a month/week calendar showing every scheduled hunt with color coding by profile and severity target, filterable by team and target.
24019. **Drag-to-reschedule on calendar** — drag a scheduled hunt to a new slot to change its next run, with automatic blackout-window conflict detection on drop.
24020. **Bulk reschedule tool** — select multiple scheduled hunts and shift them by hours or days at once, useful after an incident or maintenance window change.
24021. **Overlapping-hunt conflict warner** — warns when two hunts target overlapping infrastructure at the same time, suggesting staggered starts to avoid self-inflicted load.
24022. **Randomized start jitter** — optional ±N minute random offset on each scheduled run so scans don't start at predictable times an attacker could correlate.
24023. **Natural-language schedule input** — type "every weekday at 9am IST" or "first Monday of each month" and get a parsed, editable cron with a preview of the next 5 runs.
24024. **Next-run preview simulator** — given a cron expression and timezone, show the next 20 execution times with blackout/holiday skips marked so users verify before saving.
24025. **Cron expression import/export** — paste any standard cron string to populate the builder, or copy the generated expression for use in external schedulers.
24026. **One-time delayed hunt** — schedule a single hunt to run once at a future date/time without creating a recurring schedule, with automatic cleanup after execution.
24027. **Chained schedules (hunt B after hunt A)** — define a dependency so the next scheduled hunt starts only after the previous one completes, passing its findings as context.
24028. **Schedule-based scope rotation** — rotate through scope segments on each run (e.g. week 1: /api/*, week 2: /admin/*) so full coverage accumulates across the cadence.
24029. **Incremental diff scheduling** — scheduled runs automatically diff the target against the last run and focus on changed assets, keeping daily runs cheap and fast.
24030. **Schedule quotas per tier** — enforce per-plan limits on concurrent scheduled hunts and runs per month, with clear upgrade prompts when a team hits the cap.
24031. **Concurrent hunt limiter** — cap how many scheduled hunts may run simultaneously per account or per target to protect both the agent fleet and the target.
24032. **Schedule-based profile switching** — run stealth profiles during business hours and aggressive profiles in approved overnight windows, switched automatically by the schedule.
24033. **Missed-run detection** — if the scheduler was down at a run time, flag the missed execution and apply the user's catch-up policy (run now, skip, or reschedule).
24034. **Catch-up run policy** — per-schedule setting choosing whether missed runs execute immediately, at the next slot, or are skipped, with an audit entry for each decision.
24035. **Non-destructive schedule pause** — pause any schedule without deleting it, preserving history and config, and resume with one click when ready.
24036. **0-100 schedule health scoring** — a 0–100 score per schedule based on success rate, duration drift, and finding yield, highlighting degrading schedules at a glance.
24037. **Schedule failure alerts** — notify owners via their chosen channel when a scheduled hunt fails to start or errors out, including the failure reason and a retry link.
24038. **Per-schedule retry policy** — configure automatic retries with backoff for failed scheduled runs, including max attempts and conditions that should not be retried.
24039. **Schedule ownership and transfer** — assign each schedule an owner and allow transferring ownership when someone leaves the team, with a pending-transfer state.
24040. **Schedule approval workflow** — require a manager's approval before a new production schedule goes live, with approve/reject and comment history.
24041. **Schedule tags and search** — tag schedules (e.g. "pci", "q3-audit") and search/filter across hundreds of schedules by tag, owner, target, or status.
24042. **Schedule grouping by team** — organize schedules into team folders with per-folder default notification channels and blackout inheritance.
24043. **Schedule audit log** — immutable log of every schedule create, edit, pause, resume, and delete with who/when/before-after values for compliance.
24044. **Schedule versioning** — every edit to a schedule creates a version; view history and roll back to any previous version with one click.
24045. **Next-10-runs schedule simulator** — simulate the next 10 runs of a schedule showing expected start times, estimated duration, and request volume without executing anything.
24046. **Per-run cost estimate** — show estimated compute/credit cost per scheduled run based on scope size and historical durations before the user enables the schedule.
24047. **Schedule digest reports** — a configurable daily/weekly email summarizing what ran, what was found, and what failed across all schedules the user owns.
24048. **ICS calendar export** — export any schedule or the full hunt calendar as an .ics file for import into Google Calendar or Outlook.
24049. **Google Calendar / Outlook sync** — two-way sync of scheduled hunts to the user's work calendar so the security team sees hunts alongside deployments.
24050. **Quiet hours override code** — an emergency break-glass code that lets an on-call engineer run a hunt inside a blackout window, logging the override and reason.
24051. **Blackout exception requests** — request a one-time exception to a blackout window with approver, reason, and expiry, tracked in the audit log.
24052. **Maintenance window alignment** — link schedules to target maintenance windows so hunts automatically shift when the target's maintenance calendar changes.
24053. **SLA-driven scheduling** — define "every critical asset hunted at least weekly" as an SLA and get alerts when any asset risks missing its cadence.
24054. **Per-target schedule overrides** — a target can override inherited team blackout or cadence rules with its own windows, clearly marked as overrides.
24055. **Schedule-based notification routing** — route findings from scheduled hunts to different channels than ad-hoc hunts (e.g. scheduled → digest email, ad-hoc → Slack).
24056. **Multi-region timezone display** — show each scheduled run's next execution in both the schedule's timezone and the viewer's local timezone side by side.
24057. **UTC-normalized schedule API** — the scheduling API accepts and returns UTC timestamps while the UI renders local time, preventing timezone bugs in integrations.
24058. **Schedule leaderboard** — rank schedules by findings per run, critical-find rate, and reliability to surface which cadences deliver the most value.
24059. **Auto-disable stale schedules** — flag schedules whose targets have been unreachable for N consecutive runs and suggest pausing or fixing them.
24060. **Schedule cloning** — duplicate any schedule with a new name and target, copying all settings, for fast rollout across similar assets.
24061. **Schedule templates with variables** — templates using {{target}}, {{team}}, {{severity}} placeholders so one template instantiates correctly per asset.
24062. **Per-template default scopes** — each schedule template ships with a recommended scope definition that adapts to the target's discovered technology.
24063. **Schedule start conditions** — only start a scheduled run if preconditions hold (target reachable, no active incident, deploy freeze not in effect).
24064. **Schedule end conditions** — auto-stop a scheduled run after a max duration or max request budget to bound overnight jobs.
24065. **Graceful schedule preemption** — when a higher-priority manual hunt starts, pause lower-priority scheduled runs and resume them afterward automatically.
24066. **Schedule priority tiers** — assign priority (P1–P4) to schedules so resource contention resolves deterministically instead of first-come-first-served.
24067. **Weekend vs weekday cadences** — define different profiles for weekday and weekend runs of the same schedule (lighter touch on weekends).
24068. **Business-hours-only mode** — restrict a schedule to run only within defined business hours for targets that forbid off-hours traffic.
24069. **Off-hours-only mode** — inverse: run only outside business hours for production targets where daytime load is unacceptable.
24070. **Schedule warmup probes** — before each scheduled run, send lightweight health probes; abort and alert if the target looks down or behaving abnormally.
24071. **Post-run cooldown** — enforce a minimum gap between a scheduled run's end and the next start so back-to-back overruns can't cascade.
24072. **Run history timeline** — per-schedule timeline of every execution with status, duration, findings count, and links to full reports.
24073. **Schedule diff between runs** — compare two executions of the same schedule (scope, config, findings delta) to see what changed run over run.
24074. **Finding trend charts per schedule** — chart findings by severity across the last N runs to show whether a target is getting safer or drifting.
24075. **Schedule-scoped deduplication** — findings from scheduled runs dedupe against the schedule's own history so the same issue isn't re-reported every week.
24076. **Auto-close fixed findings** — when a scheduled run no longer detects a previously found issue, mark it fixed and record the verifying run.
24077. **Regression alerts** — alert immediately if a scheduled run re-detects an issue previously marked fixed, indicating a regression.
24078. **Schedule-based asset inventory** — each scheduled run refreshes the target's asset inventory (subdomains, endpoints, certs) as a side effect of the hunt.
24079. **Certificate expiry watch in schedules** — scheduled hunts check TLS certificate expiry and alert when any cert expires within a configurable window.
24080. **DNS drift detection in schedules** — compare DNS records run-over-run and flag unexpected changes as potential hijack or misconfiguration.
24081. **Schedule notification throttling** — cap notifications per schedule per day so a flapping target doesn't spam the team with alerts.
24082. **Digest vs instant notification choice** — per-schedule toggle between instant finding alerts and batched digests, defaulting to digest for low-severity cadences.
24083. **Schedule run notes** — attach free-text notes to individual runs (e.g. "ran during deploy freeze exception") visible in history and reports.
24084. **Schedule run labels** — label runs (baseline, post-deploy, audit) to filter and compare runs by purpose later.
24085. **Baseline run designation** — mark one run as the baseline; all future runs diff against it for change-focused reporting.
24086. **Schedule export/import (JSON)** — export full schedule definitions as JSON for backup, migration between environments, or sharing between teams.
24087. **Schedule sharing links** — generate a read-only link showing a schedule's config and upcoming runs for auditors or clients without granting edit access.
24088. **Client-visible schedule portal** — a white-labeled page where clients see their scheduled hunts, upcoming runs, and resulting reports.
24089. **Schedule SLA countdown widget** — dashboard widget counting down to the next required run per asset under SLA, turning red when at risk.
24090. **Timezone picker with DST warning** — the timezone selector shows upcoming DST transitions for the chosen zone before the user saves.
24091. **Schedule execution regions** — choose which agent region executes each schedule to satisfy data-residency requirements.
24092. **Schedule data-retention policy** — per-schedule setting for how long run data and reports are kept, auto-purging old runs to control storage.
24093. **Schedule-linked hunt profiles** — bind a schedule to a specific hunt profile version so profile updates don't silently change production cadences.
24094. **Profile update propagation prompt** — when a linked profile gets a new version, prompt the schedule owner to review and adopt or stay pinned.
24095. **Schedule A/B testing** — run two profile variants on alternating schedule slots and compare finding yield to pick the better configuration.
24096. **Canary scheduled runs** — run a new schedule config against a canary target first; only roll out to production targets after N clean canary runs.
24097. **Schedule rollback on quality drop** — if finding yield or success rate drops after a config change, offer one-click rollback to the last good version.
24098. **Multi-target schedule fan-out** — one schedule definition fans out to dozens of targets with per-target variable substitution, managed as a single unit.
24099. **Fan-out progress dashboard** — track each target's run status within a fan-out schedule, with per-target retry and skip controls.
24100. **Schedule run webhooks** — fire webhooks on schedule run start, completion, and failure so external systems can react to cadence events.
24101. **Schedule performance baselines** — record expected duration and request counts per schedule; alert when a run deviates significantly.
24102. **Anomaly detection on run metrics** — flag runs whose duration, request count, or finding volume is anomalous versus history, suggesting target or config changes.
24103. **Schedule recommendation engine** — suggest schedules based on asset criticality, change frequency, and past findings ("this API changes weekly — recommend daily quick scans").
24104. **One-click schedule from hunt history** — turn any completed ad-hoc hunt into a recurring schedule, pre-filled with its exact configuration.

## 2. Trigger-Based Hunts (24105–24204)

24105. **CI webhook auto-hunt on deploy** — accept webhooks from CI systems to start a scoped hunt automatically whenever a deployment completes, testing exactly what just shipped.
24106. **Deploy-diff scoped triggering** — parse the deploy payload to scope the triggered hunt to changed services, endpoints, or files instead of the whole target.
24107. **Pipeline stage gating** — trigger a hunt at a specific pipeline stage (e.g. after staging deploy, before production promotion) and block promotion on critical findings.
24108. **Build artifact SBOM diff trigger** — trigger a hunt when the software bill of materials changes between builds, focusing on newly added or updated dependencies.
24109. **Dependency update trigger** — watch package manifests; when a dependency version changes, auto-hunt the features that depend on it.
24110. **Vulnerability feed trigger** — when a new CVE is published affecting the target's detected stack, automatically launch a targeted hunt for that CVE.
24111. **DNS change trigger** — monitor DNS records for the target; on any change (new A record, NS change), trigger a recon-focused hunt of the affected zone.
24112. **Certificate Transparency log trigger** — watch CT logs for new subdomains under the target's domains and auto-hunt each new subdomain within minutes of issuance.
24113. **New subdomain auto-enrollment** — newly discovered subdomains are automatically added to the target's scope and hunted, with an enrollment report.
24114. **WAF rule change trigger** — detect changes in WAF behavior or headers and trigger a hunt to verify the new rules don't break protections or block legitimate flows.
24115. **CDN configuration change trigger** — on detected CDN config changes (new edge rules, caching behavior), trigger a cache-poisoning and misconfiguration hunt.
24116. **Code push path filter** — trigger hunts only when pushes touch security-sensitive paths (auth/, payments/, api/) defined per repository.
24117. **Monorepo service mapping** — map monorepo directories to target services so a push to /billing triggers a hunt of the billing service only.
24118. **Incident ticket trigger** — when a security incident ticket is created, auto-start an evidence-gathering hunt scoped to the incident's indicators.
24119. **SIEM alert trigger** — ingest SIEM alerts and trigger focused hunts to validate whether the alert indicates a real exploitable weakness.
24120. **Bug bounty report trigger** — when an external report arrives, auto-hunt to reproduce the finding and check for the same bug class elsewhere.
24121. **Pen-test finding retest trigger** — when a remediation ticket closes, automatically trigger a retest hunt to verify the fix before the ticket is marked done.
24122. **Infra-as-code change trigger** — watch Terraform/CloudFormation repos; on infrastructure changes, hunt the affected cloud resources for misconfigurations.
24123. **Cloud config drift trigger** — when cloud asset configuration drifts from baseline (open S3 bucket, changed SG), trigger an immediate validation hunt.
24124. **Kubernetes manifest change trigger** — on changes to k8s manifests, trigger a hunt focused on the changed workloads' exposed surfaces.
24125. **API spec change trigger** — when an OpenAPI spec diff shows new endpoints or changed parameters, auto-hunt exactly those endpoints.
24126. **GraphQL schema change trigger** — detect GraphQL schema updates and trigger hunts covering new queries, mutations, and introspection exposure.
24127. **Mobile app release trigger** — when a new app version hits the store, trigger a mobile API backend hunt against the new version's endpoints.
24128. **Feature flag change trigger** — when a feature flag flips on, trigger a hunt of the newly exposed functionality before it reaches full rollout.
24129. **Secrets rotation trigger** — after a secrets rotation event, trigger a hunt verifying old secrets are invalidated and new ones aren't leaked.
24130. **Employee onboarding trigger** — when new engineers join (HR webhook), trigger an access-review hunt checking for over-permissioned defaults.
24131. **Third-party vendor change trigger** — when a vendor integration is added or updated, trigger a hunt scoped to the integration's data flows.
24132. **M&A domain trigger** — when new domains appear from an acquisition, auto-enroll and hunt them as a dedicated campaign.
24133. **Expired domain watch trigger** — if a company domain approaches expiry or lapses, trigger a takeover-risk hunt immediately.
24134. **BGP/route change trigger** — on unexpected BGP announcements affecting the target's prefixes, trigger an infrastructure validation hunt.
24135. **Uptime monitor trigger** — when uptime monitoring reports new endpoints or status changes, trigger a hunt of the changed surface.
24136. **Status page incident trigger** — when the target posts a status-page incident, trigger a post-incident hunt to verify the fix and look for related issues.
24137. **Traffic spike trigger** — on abnormal traffic spikes to the target, trigger a lightweight hunt to rule out abuse of an endpoint.
24138. **Error rate spike trigger** — when error rates spike (via APM webhook), trigger a hunt for newly exposed stack traces or debug endpoints.
24139. **New technology detection trigger** — when fingerprinting detects a new framework or service on the target, trigger a technology-specific hunt module.
24140. **Port change trigger** — when port scans show newly open ports, trigger a service-focused hunt of those ports before the next scheduled run.
24141. **Trigger condition builder** — visual builder combining event type, filters, thresholds, and cooldowns into a trigger rule without writing code.
24142. **Trigger cooldowns** — per-trigger cooldown (e.g. max one deploy-triggered hunt per hour) to prevent webhook storms from launching duplicate hunts.
24143. **Trigger deduplication** — identical trigger events within a window collapse into a single hunt instead of spawning many.
24144. **Trigger priority queue** — triggered hunts enter a priority queue where critical triggers (incident, CVE) jump ahead of routine ones (daily diff).
24145. **Trigger suppression rules** — suppress triggers during blackout windows or deploy freezes, queuing them for later instead of dropping them.
24146. **Trigger audit trail** — log every trigger event, the rule that matched, and the hunt it launched, with the raw event payload for forensics.
24147. **Trigger testing sandbox** — send a synthetic event to test a trigger rule end-to-end and see which hunt would launch, without running it.
24148. **Webhook signature verification** — verify HMAC signatures on incoming trigger webhooks to ensure only authentic CI/incident systems can launch hunts.
24149. **Per-trigger scope templates** — each trigger type ships with a recommended scope template (deploy → changed paths; CT log → new subdomain) editable per rule.
24150. **Trigger-specific hunt profiles** — run lightweight fast profiles for high-frequency triggers (DNS change) and deep profiles for rare ones (incident).
24151. **Trigger notification routing** — route triggered-hunt notifications to the team that owns the triggering system (deploy → owning dev team).
24152. **Trigger → campaign enrollment** — a trigger can enroll the target into a multi-stage campaign instead of a one-off hunt (e.g. new subdomain → 3-week campaign).
24153. **Trigger chaining** — the completion of a triggered hunt can fire another trigger (deploy hunt done → if clean, trigger promotion gate).
24154. **Trigger analytics dashboard** — show trigger volume, hunt outcomes, and finding yield per trigger type to tune noisy or useless triggers.
24155. **Noisy trigger auto-tuning** — if a trigger fires constantly with zero findings, suggest raising its threshold or narrowing its scope.
24156. **Trigger allowlist/blocklist** — per-trigger lists of branches, paths, or assets that always or never trigger hunts, for fine control.
24157. **Branch-specific triggers** — trigger hunts only for deploys from protected branches (main, release/*), ignoring feature-branch preview deploys.
24158. **Environment-scoped triggers** — the same deploy webhook triggers different hunt depths for staging vs production targets.
24159. **Multi-repo trigger aggregation** — aggregate deploy events across repos into one hunt per service per time window instead of one hunt per repo push.
24160. **Scheduled + trigger hybrid** — a target gets both a weekly scheduled hunt and event-triggered hunts, with the scheduler skipping its run if a triggered hunt covered the scope recently.
24161. **Trigger coverage credit** — a triggered hunt counts toward the asset's SLA cadence, preventing redundant scheduled runs right after a deploy hunt.
24162. **Trigger-based scope expansion** — if a triggered hunt finds something interesting, automatically expand scope to adjacent assets and continue.
24163. **Trigger context injection** — pass the triggering event's metadata (commit SHA, deploy ID, CVE ID) into the hunt so findings reference their trigger.
24164. **Commit-linked findings** — findings from deploy-triggered hunts link back to the exact commits in the deploy, speeding up developer triage.
24165. **PR-comment findings** — post findings from PR-triggered hunts as comments on the pull request that introduced them.
24166. **PR status checks** — report hunt results as CI status checks (pass/fail) so merges block on critical findings automatically.
24167. **GitHub Actions integration** — a first-class GitHub Action that triggers a Dark-Matter hunt and waits for results with configurable failure thresholds.
24168. **GitLab CI integration** — equivalent native integration for GitLab pipelines with merge-request widgets showing hunt status.
24169. **Jenkins build-step hunt plugin** — a Jenkins plugin wrapping the trigger API so legacy pipelines can launch hunts as build steps.
24170. **Generic webhook receiver** — a documented generic endpoint accepting any JSON event with field mapping, for systems without a native integration.
24171. **Trigger-event schema validation** — versioned schemas for each trigger event type with validation, so malformed events are rejected with clear errors.
24172. **Trigger payload redaction** — strip secrets and PII from stored trigger payloads automatically before they're written to the audit log.
24173. **Trigger rate limiting** — per-source rate limits on incoming trigger events to protect the scheduler from misconfigured or malicious senders.
24174. **Trigger source health monitoring** — track webhook delivery success per source and alert when a CI system's webhooks stop arriving.
24175. **Dead-letter queue for triggers** — failed trigger events land in a dead-letter queue with retry, inspect, and discard controls.
24176. **Trigger replay** — re-fire a past trigger event from the audit log to reproduce a hunt or recover from an outage.
24177. **Time-windowed triggers** — triggers only fire within allowed windows (e.g. deploy hunts only during business hours) and queue otherwise.
24178. **Business-hours trigger batching** — overnight trigger events batch into a single morning hunt instead of waking the on-call with many small hunts.
24179. **Trigger-based canary analysis** — after a deploy, run a short canary hunt; only if clean, run the full triggered hunt, saving resources on obviously broken deploys.
24180. **Progressive trigger depth** — first deploy of the day gets a deep hunt; subsequent deploys get lighter hunts unless the diff is large.
24181. **Diff-size-based scoping** — scale the triggered hunt's depth to the size of the change: 5-line diff → quick check, 5000-line diff → deep hunt.
24182. **Author-aware triggering** — route or scope triggered hunts based on the commit author (e.g. new contributors get deeper hunts on their changes).
24183. **Trigger → Slack thread** — each triggered hunt posts to a dedicated Slack thread with the triggering event summary and live progress.
24184. **Trigger → Jira auto-link** — findings from triggered hunts automatically link to the Jira epic or deploy ticket that triggered them.
24185. **Trigger templates marketplace** — shareable trigger rule templates (e.g. "Vercel deploy → hunt") installable in one click.
24186. **Trigger rule versioning** — version trigger rules like code; roll back a noisy rule change instantly.
24187. **Trigger dry-run** — simulate a trigger rule against the last 30 days of events to see how many hunts it would have launched before enabling it.
24188. **Trigger cost forecasting** — estimate monthly hunt cost from historical event volumes before enabling a high-frequency trigger.
24189. **Cross-account trigger fan-out** — one CI event triggers hunts across multiple Dark-Matter accounts or tenants (e.g. all subsidiaries' staging).
24190. **Trigger geofencing** — triggers from unexpected geographic sources or IPs are quarantined for review instead of auto-launching hunts.
24191. **Manual trigger approval** — high-risk triggers (production deploy) can require one-click approval before the hunt launches, with a 15-minute auto-expire.
24192. **Trigger escalation on findings** — if a triggered hunt finds a critical, automatically escalate by paging the on-call and opening a war-room channel.
24193. **Trigger-based retest loops** — when a fix PR merges for a finding, auto-trigger a retest hunt scoped to that finding and close the loop without human coordination.
24194. **Signed auto-retest reports** — each auto-retest produces a signed verification report suitable for auditors and customers.
24195. **Flaky-fix detection** — if a finding passes retest then reappears in the next scheduled run, flag the fix as flaky and reopen the ticket.
24196. **Trigger correlation** — correlate multiple triggers (deploy + WAF change + DNS change within an hour) into one combined hunt instead of three separate ones.
24197. **Event timeline per target** — a unified timeline showing deploys, DNS changes, triggers, hunts, and findings so analysts see cause and effect.
24198. **Trigger → asset inventory update** — every trigger event enriches the asset inventory (new service version, new endpoint) even if no hunt launches.
24199. **Stale trigger cleanup** — automatically disable trigger rules whose source hasn't sent an event in 90 days, with a notification before disabling.
24200. **Trigger ownership transfer** — reassign trigger rules when owners leave, with a grace period where old and new owners both get notifications.
24201. **Trigger documentation generator** — auto-generate a human-readable doc per trigger rule (when it fires, what it hunts, who gets notified) for runbooks.
24202. **Compliance-mapped triggers** — map trigger rules to compliance controls (e.g. "deploy-time testing" for SOC 2 CC7.1) for audit evidence.
24203. **Trigger evidence export** — export a trigger's full history (events, hunts, findings) as an audit package proving continuous testing.
24204. **One-click trigger from finding** — turn any finding into a standing trigger rule ("re-hunt this endpoint on every deploy") with one click.

## 3. Multi-Stage Campaigns (24205–24304)

24205. **Campaign builder canvas** — a visual timeline where stages are added as blocks (recon → vuln scan → exploitation → retest) with durations and dependencies.
24206. **Recon week 1 → deep test week 2 → retest week 3 preset** — a prebuilt 3-stage campaign template implementing the classic phased assessment cadence.
24207. **Stage gates with criteria** — each stage starts only when gate criteria pass (e.g. stage 2 requires stage 1 asset inventory complete with >95% coverage).
24208. **Manual stage-gate approval** — require a human to approve progression past a gate, with the stage's summary report attached to the approval request.
24209. **Automatic gate evaluation** — gates evaluate themselves from stage outputs (coverage %, finding counts) and auto-advance or hold without human input.
24210. **Gate hold notifications** — when a campaign holds at a gate, notify the campaign owner with exactly which criteria failed and suggested fixes.
24211. **Cross-target campaigns** — one campaign spanning all subsidiaries or business units, with per-target stage tracking under a unified dashboard.
24212. **Campaign dashboard** — executive view of all campaigns: progress bars per stage, findings by severity, days remaining, and health indicators.
24213. **Stage-level reporting** — each stage produces its own report on completion, plus a consolidated campaign report at the end.
24214. **Prebuilt assessment campaign templates** — prebuilt campaigns (web app assessment, API assessment, cloud review, M&A intake) with stages, gates, and durations ready to go.
24215. **One-click campaign duplication** — duplicate a past campaign (stages, gates, team) for a new target or quarter with one click.
24216. **Stage-1 campaign start scheduler** — schedule a campaign's stage 1 start date; subsequent stages auto-schedule from stage durations and gate outcomes.
24217. **Campaign blackout inheritance** — stages respect the account's blackout windows automatically, pausing stage execution during freezes.
24218. **Stage reassignment** — reassign a stage to a different team or owner mid-campaign, with handoff notes and context transfer.
24219. **Scoped campaign role permissions** — define roles (campaign owner, stage lead, reviewer, stakeholder) with scoped permissions per campaign.
24220. **Campaign stakeholder view** — read-only live view for executives or clients showing progress and high-level findings without technical detail.
24221. **Campaign milestones** — named milestones (e.g. "external recon complete") with dates, owners, and completion criteria tracked on the dashboard.
24222. **Campaign downtime-risk register** — log campaign risks (target downtime, scope disputes) with mitigations, visible to all campaign members.
24223. **Stage input/output contracts** — each stage declares what it needs from the previous stage and what it produces, making handoffs explicit and debuggable.
24224. **Cross-stage finding promotion** — a low finding in recon (interesting subdomain) can be promoted to a priority target for the exploitation stage.
24225. **Campaign-wide deduplication** — findings dedupe across all stages and targets in the campaign so the final report has no repeats.
24226. **Campaign finding lifecycle** — track each finding from discovery stage through verification, reporting, and retest stage in one view.
24227. **Stage retrospectives** — after each stage, capture what worked and what didn't; feed lessons into the campaign's remaining stages automatically.
24228. **Whole-campaign incident pause** — pause an entire campaign (all stages) for incidents or scope changes and resume with adjusted dates.
24229. **Campaign timeline view (Gantt)** — Gantt chart of stages, gates, milestones, and dependencies with drag-to-adjust scheduling.
24230. **Campaign critical path** — highlight the stages whose delay would push the campaign end date, focusing management attention.
24231. **Stage duration estimates** — estimate each stage's duration from target size and historical data before the campaign starts.
24232. **Campaign budget tracking** — track compute/credit spend per stage against a campaign budget, alerting at 50/80/100% thresholds.
24233. **Pre-launch campaign cost prediction** — predict total campaign cost from scope and stage plan before launch for approval workflows.
24234. **Multi-region campaigns** — run campaign stages across regions with data-residency controls per stage.
24235. **Campaign notifications hub** — one place configuring all campaign notifications (stage start/end, gate holds, critical findings) per role.
24236. **Campaign Slack channel provisioning** — auto-create a dedicated Slack channel per campaign with stage updates posted as threads.
24237. **Campaign Jira epic linking** — link a campaign to a Jira epic; stages become stories and findings become linked subtasks automatically.
24238. **Campaign calendar export** — export stage dates and milestones to team calendars as an .ics feed.
24239. **Campaign approval to launch** — require stakeholder approval of the campaign plan (scope, stages, dates) before stage 1 can start.
24240. **Campaign scope change control** — mid-campaign scope changes require approval and are versioned, with impact analysis on remaining stages.
24241. **Campaign version history** — every plan edit is versioned; compare versions and see who changed what and when.
24242. **Campaign templates marketplace** — share and install community campaign templates with ratings, like "SaaS annual pentest in 4 stages".
24243. **Campaign benchmarking** — compare campaign metrics (findings per stage, duration) against anonymized industry benchmarks.
24244. **Campaign post-mortem generator** — auto-draft a post-mortem from stage reports, gate outcomes, and retrospectives when the campaign closes.
24245. **Campaign success criteria** — define measurable success criteria at launch (e.g. "zero criticals unremediated"); the dashboard tracks them live.
24246. **Campaign health score** — composite score from schedule adherence, gate pass rate, and finding remediation velocity.
24247. **Stage-level SLAs** — set max durations per stage; breach alerts go to the stage lead and campaign owner.
24248. **Escalation paths per stage** — if a stage stalls, auto-escalate through a defined chain (lead → owner → exec sponsor).
24249. **Campaign dependency mapping** — declare dependencies between campaigns (campaign B starts after campaign A's retest stage) with automatic scheduling.
24250. **Nested sub-campaigns** — break a large campaign into sub-campaigns per business unit, each with its own stages, rolled up to the parent.
24251. **Campaign tagging** — tag campaigns by regulation, quarter, or initiative for portfolio-level filtering and reporting.
24252. **Portfolio view of campaigns** — see all campaigns across the organization in one portfolio view with roll-up metrics.
24253. **Campaign comparison** — side-by-side compare two campaigns' stages, durations, and outcomes to learn what works.
24254. **Campaign stage re-run** — re-run any completed stage (e.g. re-do recon after a scope expansion) without restarting the campaign.
24255. **Stage output archiving** — archive each stage's raw outputs with retention policies for audit and re-analysis.
24256. **Campaign evidence locker** — central repository of all PoCs, screenshots, and logs per campaign, organized by stage and finding.
24257. **Evidence access chain-of-custody** — track who accessed or exported each evidence artifact for legal defensibility.
24258. **Campaign report builder** — assemble the final campaign report from stage reports with drag-to-order sections and custom executive summary.
24259. **White-labeled campaign reports** — generate client-facing campaign reports with their branding for MSSP and consulting use.
24260. **Campaign sign-off workflow** — formal sign-off by owner and stakeholder with timestamps, required before a campaign is marked complete.
24261. **Incomplete stage handling** — if a stage can't finish (target decommissioned), formally close it as incomplete with a reason, keeping the campaign valid.
24262. **Campaign merge** — merge two overlapping campaigns into one, combining stages and deduping findings.
24263. **Campaign split** — split one campaign into two (e.g. by business unit) preserving history on both sides.
24264. **Campaign stage parallelization** — run independent stages for different targets in parallel while keeping dependent stages sequential.
24265. **Dynamic stage insertion** — insert a new stage mid-campaign (e.g. add a cloud-review stage after discovering cloud assets) with gate recalculation.
24266. **Stage skip with justification** — skip a stage with a required justification, recorded in the audit log and final report.
24267. **Full-campaign timeline simulator** — simulate the full campaign timeline, stage durations, and estimated findings without executing anything.
24268. **Campaign what-if planner** — model "what if recon finds 200 new hosts" to see impact on stage durations and budget before it happens.
24269. **Stage resource allocation** — assign compute budgets and concurrency limits per stage to prevent one stage starving others.
24270. **Campaign auto-scaling** — automatically scale agent concurrency up during deep-test stages and down during reporting stages.
24271. **Campaign notifications digest** — daily digest option summarizing all stage activity instead of per-event pings.
24272. **Campaign @mentions** — mention team members in campaign notes with notifications, keeping discussion in context.
24273. **Campaign decision log** — record key decisions (scope changes, gate overrides) with rationale, decider, and timestamp.
24274. **Gate override with approval** — allow overriding a failed gate with dual approval, fully logged for auditors.
24275. **Campaign lessons database** — retrospectives feed a searchable lessons database reused when planning future campaigns.
24276. **Campaign playbook export** — export a campaign's stages, gates, and configs as a reusable playbook file for other teams.
24277. **Playbook import validation** — validate imported playbooks against a schema and simulate them before allowing launch.
24278. **Campaign orchestration REST API** — full REST API for creating campaigns, advancing gates, and pulling stage reports for external orchestration.
24279. **Campaign lifecycle event webhooks** — webhooks for campaign created, stage started/completed, gate passed/held, and campaign completed.
24280. **Campaign → GRC sync** — push campaign status and findings to GRC platforms as control evidence automatically.
24281. **Campaign-to-PCI-SOC2 evidence mapping** — map stages to compliance requirements (PCI DSS 11.3, SOC 2) so the campaign doubles as audit evidence.
24282. **Campaign attestation** — generate a signed attestation of the campaign's execution (stages run, dates, coverage) for auditors.
24283. **Campaign coverage map** — visual map showing which assets were covered in which stage, highlighting gaps.
24284. **Coverage gap alerts** — alert when campaign coverage drops below target (e.g. assets added mid-campaign that no stage covered).
24285. **Campaign asset onboarding** — bulk-import assets into a campaign from CMDB, spreadsheets, or cloud accounts with deduplication.
24286. **Campaign decommission handling** — when an asset is decommissioned mid-campaign, formally remove it from remaining stages with a note.
24287. **Campaign time tracking** — track human hours per stage (reviews, approvals) alongside agent compute for true cost accounting.
24288. **Campaign invoicing support** — for MSSPs, generate invoice line items per campaign stage with hours and findings delivered.
24289. **Campaign client portal** — clients see their campaign's progress, stage reports, and findings in a branded portal with commenting.
24290. **Campaign finding SLAs** — per-severity remediation SLAs tracked from the stage the finding was reported in, with breach alerts.
24291. **Campaign retest automation** — the retest stage automatically re-tests every open finding from earlier stages and updates their status.
24292. **Retest sampling** — for large finding counts, support statistically valid sampling in the retest stage with documented methodology.
24293. **Campaign trend analysis** — compare the same campaign run quarter over quarter to show security posture trends to the board.
24294. **Campaign KPI dashboard** — configurable KPIs (MTTR, criticals per asset, gate pass rate) computed live from campaign data.
24295. **Campaign alerts routing** — route different campaign events to different channels (gates → email, criticals → PagerDuty, progress → Slack).
24296. **Campaign mobile view** — a mobile-optimized dashboard for approving gates and viewing progress on the go.
24297. **Campaign offline brief** — generate a printable/PDF brief of campaign status for meetings without screen access.
24298. **Campaign search** — full-text search across all campaigns, stages, notes, and decisions from one search bar.
24299. **Campaign favorites** — pin important campaigns to a favorites bar for one-click access.
24300. **Campaign archive** — archive completed campaigns out of the active list while keeping them fully searchable and reportable.
24301. **Campaign retention policies** — auto-archive or purge campaign data after configurable retention periods per data class.
24302. **Campaign data export** — export a campaign's complete dataset (stages, findings, evidence, logs) as a portable archive.
24303. **Campaign import** — import a campaign archive into another Dark-Matter instance for MSSP handoffs or migrations.
24304. **Campaign start-from-template wizard** — a guided wizard (goal → targets → stages → dates → team) that builds a campaign from a template in under two minutes.

## 4. Conditional Logic (24305–24404)

24305. **Visual if/then rule builder** — drag-and-drop canvas for building rules like "IF critical found THEN pause and notify" with condition blocks and action blocks.
24306. **Critical-found pause action** — automatically pause the hunt when a critical finding is confirmed, preventing further intrusive testing until a human reviews.
24307. **WAF-detected stealth switch** — if the agent detects a WAF, automatically switch to a stealth hunt profile (slower, low-noise) mid-run.
24308. **Else-branch support** — every condition supports an else branch (IF WAF detected THEN stealth ELSE aggressive) so both outcomes are handled explicitly.
24309. **Nested condition groups** — combine conditions with AND/OR nesting (IF critical AND production THEN page on-call) for precise control.
24310. **Loop-until conditions** — repeat a hunt step until a condition holds (e.g. keep retesting a fix until it passes or 5 attempts elapse).
24311. **Finding-count thresholds** — trigger actions when finding counts cross thresholds (e.g. more than 10 highs → escalate to security lead).
24312. **Time-based branches** — branch logic on elapsed time (IF hunt exceeds 4 hours THEN switch to quick-finish mode and report).
24313. **Severity-tiered workflow routing** — route each finding to different workflows by severity (critical → PagerDuty, low → backlog ticket).
24314. **Asset-criticality conditions** — conditions can reference asset criticality tags (IF asset is tier-1 AND finding is high THEN page).
24315. **Environment conditions** — branch on environment (IF production THEN require approval for intrusive steps ELSE proceed).
24316. **Time-of-day conditions** — allow intrusive actions only during approved windows; queue them otherwise (IF after hours THEN run intrusive module).
24317. **Day-of-week conditions** — different rules for weekdays vs weekends, aligning with change-freeze calendars.
24318. **Rate-limit detection branch** — if the target starts rate-limiting, automatically back off, reduce concurrency, and resume gracefully.
24319. **Block-detection branch** — if the agent's IP gets blocked, switch to a backup egress or pause and alert instead of hammering.
24320. **CAPTCHA-encounter branch** — on CAPTCHA detection, pause the affected flow and queue it for human-assisted continuation.
24321. **Login-failure branch** — if authenticated scans fail login repeatedly, fall back to unauthenticated recon and alert the credential owner.
24322. **Scope-expansion conditions** — IF an interesting finding appears on an in-scope host THEN auto-expand to adjacent hosts with approval.
24323. **Scope-contraction conditions** — IF a target proves out-of-scope or decommissioned THEN remove it and reallocate budget elsewhere.
24324. **Confidence-threshold actions** — IF finding confidence is below 70% THEN queue for human validation ELSE auto-report.
24325. **Duplicate-detection branch** — IF a finding matches a known issue THEN link it instead of creating a duplicate ticket.
24326. **Fix-verified branch** — IF retest passes THEN auto-close the ticket and notify the reporter ELSE reopen with new evidence.
24327. **SLA-breach branch** — IF a finding's remediation SLA breaches THEN escalate one level and notify the asset owner.
24328. **Business-hours notification branch** — IF critical found during business hours THEN Slack ELSE page the on-call.
24329. **Finding-age conditions** — IF a finding stays open 30 days THEN require a risk-acceptance decision or escalate.
24330. **Coverage-threshold branch** — IF recon coverage is below 80% THEN extend the recon stage before advancing.
24331. **New-asset branch** — IF new assets are discovered mid-hunt THEN add them to scope automatically (within policy limits).
24332. **Technology-match branch** — IF target runs WordPress THEN enable the WordPress module ELSE skip it, keeping hunts efficient.
24333. **Cloud-provider branch** — IF AWS detected THEN run cloud-misconfig checks ELSE skip, avoiding irrelevant tests.
24334. **Auth-state branch** — IF authenticated session is valid THEN run auth-required tests ELSE run only public-surface tests.
24335. **MFA-challenge branch** — IF MFA is challenged THEN pause and request human completion via the approval flow.
24336. **Honeypot-detection branch** — IF a honeypot is suspected THEN stop interacting with it and flag it to avoid polluting results.
24337. **Production-data branch** — IF production data is detected in a non-prod environment THEN halt and alert for data-handling review.
24338. **PII-exposure branch** — IF a finding exposes PII THEN trigger the privacy incident workflow instead of the standard one.
24339. **Third-party finding branch** — IF the vulnerable component belongs to a vendor THEN open a vendor ticket instead of an internal one.
24340. **Zero-day suspicion branch** — IF behavior suggests an unknown vulnerability THEN preserve full evidence and escalate to senior researchers.
24341. **Chained-exploit branch** — IF two medium findings combine into a high-impact chain THEN re-score and escalate as a single chained finding.
24342. **Rule testing sandbox** — test conditional rules against historical hunt data to see how often each branch would have fired before enabling.
24343. **Rule versioning** — version every conditional rule; see diffs and roll back when a rule change causes bad behavior.
24344. **Rule audit log** — log every rule evaluation (condition, result, action taken) for debugging and compliance.
24345. **Rule performance metrics** — track how often each rule fires, its false-positive rate, and average action latency.
24346. **Noisy rule detection** — automatically flag rules that fire excessively with low value and suggest tuning.
24347. **Rule templates library** — prebuilt rules like "pause on critical", "stealth on WAF", "page on production critical" installable in one click.
24348. **Rule marketplace sharing** — share effective conditional rules with the community, with ratings and usage counts.
24349. **Rule import/export (YAML)** — define rules as YAML files for version control in git alongside infrastructure code.
24350. **Rule linting** — validate rule logic for contradictions, unreachable branches, and infinite loops before activation.
24351. **Infinite-loop protection** — detect rules that could trigger each other cyclically and block activation with an explanation.
24352. **Rule execution order** — define explicit priority ordering when multiple rules could fire on the same event.
24353. **Rule conflict detector** — warn when two rules prescribe conflicting actions for the same condition.
24354. **Conditional notifications** — notification content and channel chosen by conditions (critical + prod → page with runbook link).
24355. **Conditional ticket fields** — set Jira priority, assignee, and labels based on finding attributes via rules.
24356. **Conditional report sections** — include or exclude report sections based on conditions (e.g. add "business impact" section for tier-1 assets).
24357. **Conditional hunt depth** — adjust scan depth dynamically: IF asset is internet-facing THEN deep ELSE standard.
24358. **Conditional module enablement** — enable expensive modules only when conditions justify them (e.g. cloud module only if cloud detected).
24359. **Budget-guard conditions** — IF spend exceeds 80% of budget THEN switch to low-cost modules and notify the owner.
24360. **Finding-velocity conditions** — IF findings per hour spikes THEN alert (possible misconfiguration) or slow down (possible WAF evasion loop).
24361. **Stagnation detection** — IF no new findings for N hours in an active hunt THEN suggest scope expansion or early termination.
24362. **Early-termination rules** — IF coverage is complete and findings plateau THEN end the hunt early and save budget, with a summary.
24363. **Auto-extend rules** — IF high-value findings keep appearing near the end THEN auto-extend the hunt within budget limits.
24364. **Human-in-the-loop checkpoints** — insert mandatory human review checkpoints at defined points (e.g. before exploitation stage) via conditions.
24365. **Checkpoint timeout policy** — IF a human doesn't respond to a checkpoint in N minutes THEN apply the configured default (proceed, hold, or abort).
24366. **Delegated checkpoint approvers** — checkpoints can be approved by delegates when the primary approver is unavailable.
24367. **Conditional evidence capture** — capture extra evidence (full traffic logs, screenshots) only when conditions indicate high-value findings.
24368. **Conditional data retention** — retain raw hunt data longer for hunts that found criticals; purge faster for clean hunts.
24369. **Geo-based conditions** — branch on the target's or the finding's geography for data-residency or regulatory routing.
24370. **Compliance-framework conditions** — IF asset is PCI-scoped THEN enforce PCI-mapped checks and evidence collection automatically.
24371. **Risk-appetite profiles** — organization-level risk appetite (conservative/balanced/aggressive) that conditional rules inherit as defaults.
24372. **Rule simulation mode** — run rules in shadow mode where they log what they would do without acting, for safe rollout.
24373. **Gradual rule rollout** — enable a new rule for 10% of hunts first, then expand, with automatic rollback on bad outcomes.
24374. **Rule kill switch** — one global switch to disable all conditional automation instantly during an incident, with audit logging.
24375. **Per-hunt rule overrides** — allow overriding specific rules for a single hunt with justification, without editing the global rule.
24376. **Rule override audit** — every per-hunt override is logged with who, why, and what changed for later review.
24377. **Conditional retest scheduling** — schedule retests based on finding severity and fix complexity rather than a fixed delay.
24378. **Flaky-target conditions** — IF a target is intermittently unreachable THEN switch to resilient mode (longer timeouts, more retries).
24379. **Maintenance-window conditions** — IF the target enters a maintenance window mid-hunt THEN pause gracefully and resume after.
24380. **Deploy-during-hunt branch** — IF a deploy is detected mid-hunt THEN snapshot current state, re-baseline, and continue on the new version.
24381. **Multi-condition triggers** — require multiple conditions across time (e.g. critical found AND not fixed in 7 days) before escalating.
24382. **Stateful rules** — rules can remember state across hunts (e.g. "this is the third consecutive clean run → reduce frequency").
24383. **Counter-based conditions** — fire after N occurrences (e.g. page only on the third consecutive failed login-test run).
24384. **Decay conditions** — reduce alert urgency if the same condition fires repeatedly without new information.
24385. **Correlation conditions** — IF finding A AND finding B exist on the same asset THEN create a combined risk item.
24386. **Suppression conditions** — suppress duplicate or low-value actions during incidents or maintenance to reduce noise.
24387. **Escalation ladders** — define multi-step escalation (notify → page → exec call) with time gaps, driven by conditions.
24388. **De-escalation rules** — automatically de-escalate when conditions clear (finding fixed → cancel the page, close the war room).
24389. **Working-hours escalation** — escalation ladders respect working hours and on-call rotations automatically.
24390. **On-call integration** — pull the current on-call from PagerDuty/Opsgenie so conditional pages always reach the right person.
24391. **Rule-based chatops** — trigger rules can post interactive messages to Slack/Teams with approve/deny buttons inline.
24392. **Plain-English conditional rule builder** — type "pause the hunt if we find a critical on production" and get a structured, editable rule.
24393. **Rule explanation view** — every rule shows a plain-English explanation of what it does and when it last fired, for non-technical stakeholders.
24394. **Rule impact preview** — before enabling, see which hunts, targets, and teams a rule would affect based on historical data.
24395. **Conditional SLA assignment** — assign remediation SLAs by rule (internet-facing critical → 24h; internal low → 90 days).
24396. **Exception workflows** — IF a team requests risk acceptance THEN route through an approval chain with expiry dates.
24397. **Risk-acceptance expiry** — accepted risks auto-expire and re-trigger review, preventing permanent silent acceptance.
24398. **Conditional access reviews** — trigger access recertification when a hunt finds excessive permissions, scoped to the affected system.
24399. **Data-classification conditions** — IF a finding involves "restricted" data THEN apply stricter handling, encryption, and notification rules.
24400. **Conditional evidence redaction** — automatically redact PII/secrets from evidence when the finding's data classification requires it.
24401. **Rule analytics dashboard** — visualize rule firings, actions taken, and outcomes to continuously improve automation logic.
24402. **A/B test automation rules** — run two rule variants on split traffic and compare outcomes (MTTR, noise) before standardizing.
24403. **Rule recommendation engine** — suggest new conditional rules based on patterns in manual actions ("you always pause on criticals — automate it?").
24404. **One-click rule from incident** — convert the manual steps taken during an incident into a reusable conditional rule with one click.

## 5. Hunt Templates Marketplace (24405–24504)

24405. **Prebuilt API hunt template** — a ready-to-install template with endpoint discovery, auth testing, IDOR/BOLA checks, and rate-limit probes tuned for REST and GraphQL APIs.
24406. **Prebuilt e-commerce hunt template** — template covering cart/checkout flows, payment logic, coupon abuse, and PII handling specific to online stores.
24407. **Prebuilt cloud hunt template** — template for AWS/Azure/GCP misconfiguration hunting: storage, IAM, network exposure, and logging gaps.
24408. **Prebuilt SaaS multi-tenant template** — template focused on tenant isolation, cross-tenant data leaks, and subscription logic flaws.
24409. **Prebuilt mobile-backend template** — template for mobile API backends: token handling, certificate pinning checks, and device-binding flaws.
24410. **Prebuilt WordPress template** — template with plugin/theme enumeration, known-vuln correlation, and wp-config exposure checks.
24411. **Prebuilt fintech template** — template emphasizing transaction integrity, race conditions, and regulatory data-handling checks.
24412. **Prebuilt healthcare template** — template with PHI-handling verification and HIPAA-mapped checks and evidence collection.
24413. **Prebuilt IoT template** — template for device web interfaces, firmware update flows, and default-credential sweeps.
24414. **Prebuilt network perimeter template** — template for external network ranges: service enumeration, weak credentials, and exposed admin panels.
24415. **Community template sharing** — users can publish their hunt templates to a shared marketplace with descriptions and screenshots.
24416. **Pre-install template quality ratings** — five-star ratings plus written reviews so users can judge template quality before installing.
24417. **One-click template install** — install any marketplace template into your workspace with one click, pre-configured and ready to schedule.
24418. **Semantic template versioning** — templates carry semantic versions; changelogs show what changed between versions.
24419. **Template auto-update opt-in** — choose to auto-update installed templates when publishers release new versions, with a diff preview.
24420. **Fork-and-customize** — fork any marketplace template into your private copy and modify it without affecting the original.
24421. **Faceted template category browser** — browse templates by category (web, API, cloud, mobile, network, compliance) with faceted search.
24422. **Template search with filters** — filter by target type, duration, intrusiveness, rating, and Dark-Matter version compatibility.
24423. **Template preview** — see a template's full stage list, checks, and estimated duration before installing.
24424. **Template compatibility badges** — badges showing which Dark-Matter versions and hunt profiles a template works with.
24425. **Verified publisher program** — templates from verified security teams carry a checkmark, signaling reviewed quality.
24426. **Template security scanning** — marketplace scans template definitions for malicious or unsafe configurations before listing.
24427. **Publisher install-yield analytics** — publishers see installs, runs, and finding yields for their templates to guide improvements.
24428. **Template issue tracker** — report bugs or request features on a template; publishers respond in a per-template thread.
24429. **Template discussions** — community Q&A per template for usage tips and troubleshooting.
24430. **Template collections** — curated bundles like "Startup security starter pack" grouping complementary templates.
24431. **Template of the week** — editorial spotlight surfacing high-quality new templates to the community.
24432. **Template author profiles** — publisher pages showing all their templates, ratings, and response activity.
24433. **Template monetization** — authors can sell premium templates with licensing, payouts, and trial modes.
24434. **Template trial mode** — try a paid template on a demo target before purchasing.
24435. **Template licensing** — clear license choices (MIT, commercial, custom) shown on every template page.
24436. **Private template sharing** — share templates within your organization only, without publishing publicly.
24437. **Template approval workflow** — organizations can require security-team approval before members install community templates.
24438. **Template blocklist** — admins can block specific templates or publishers org-wide.
24439. **Fork-vs-upstream template diff** — compare your fork against the upstream template to see what the publisher changed.
24440. **Merge upstream updates** — pull publisher updates into your fork with conflict resolution for your customizations.
24441. **Install-time template variables** — templates declare variables ({{domain}}, {{api_key_name}}) filled in at install or run time.
24442. **Template input validation** — validate variable inputs (URL format, CIDR ranges) before a template-based hunt launches.
24443. **Template secrets handling** — templates reference secrets by name from the vault; values never appear in the template definition.
24444. **Template scheduling presets** — templates ship with recommended schedules (daily quick + weekly full) applied on install.
24445. **Template notification presets** — templates include sensible default notification routing, adjustable after install.
24446. **Template compliance mapping** — templates declare which compliance frameworks their checks map to (PCI, SOC 2, HIPAA).
24447. **Template check inventory** — every template lists its individual checks with descriptions so users know exactly what will run.
24448. **Template intrusiveness rating** — each template shows a 1–5 intrusiveness score so users pick appropriately for production.
24449. **Template duration estimates** — estimated runtime ranges based on target size, from community run data.
24450. **Template request-volume estimates** — estimated HTTP request counts so users can warn WAF/CDN teams before running.
24451. **Template pre-execution simulator** — simulate a template against your target to preview stages, checks, and estimates without executing.
24452. **Template A/B comparison** — run two templates against similar targets and compare finding yields side by side.
24453. **Template effectiveness scores** — data-driven scores from aggregate runs: findings per run, false-positive rate, coverage.
24454. **Deprecated-template migration warnings** — deprecated templates show warnings and migration paths to their replacements.
24455. **Template changelog** — human-readable changelog per version so users decide whether to update.
24456. **Instant template version rollback** — revert an installed template to any previous version instantly.
24457. **Template export/import** — export templates as portable files for offline sharing or backup.
24458. **Template git sync** — sync private templates with a git repo so changes go through pull requests and code review.
24459. **Template CI validation** — automatically validate template definitions in CI on every commit to the synced repo.
24460. **Auto-generated template READMEs** — auto-generate a README from the template definition: stages, checks, variables, and schedules.
24461. **Template screenshots/videos** — publishers can attach demo runs showing the template in action.
24462. **Multi-language template UI** — template names and descriptions translatable; UI shows the user's language where available.
24463. **Template accessibility tags** — tags like "beginner-friendly" or "expert-only" guiding users to suitable templates.
24464. **Template prerequisites** — templates declare prerequisites (e.g. "requires authenticated credentials") checked at install.
24465. **Template post-install checklist** — guided checklist after install: set variables, connect secrets, review schedule, run dry-run.
24466. **Template run history** — see all hunts launched from a template with outcomes, filterable by target.
24467. **Template finding benchmarks** — compare your template runs' finding rates against the community average for that template.
24468. **Template feedback loop** — one-click "this check was noisy" feedback from hunt results back to the template publisher.
24469. **Template auto-tuning** — publishers can push tuning updates (thresholds, disabled noisy checks) that subscribers can accept.
24470. **Template branching** — maintain multiple variants (aggressive/conservative) of a template under one listing.
24471. **Base-template inheritance builder** — build a new template on top of a base template, inheriting its stages and overriding specifics.
24472. **Template composition** — combine multiple templates (API + cloud) into a composite template for complex targets.
24473. **Template dependency management** — composite templates declare dependencies; installing pulls compatible versions automatically.
24474. **Template sandbox testing** — test a template against a safe demo target before pointing it at production.
24475. **Template certification** — templates can earn certifications (e.g. "PCI-ready") after automated validation of their check coverage.
24476. **Template audit reports** — generate a report of which templates are installed org-wide, their versions, and last run dates for auditors.
24477. **Template usage policies** — define which template categories are allowed per environment (e.g. only low-intrusiveness on prod).
24478. **Template quota management** — limit how many hunts per month can launch from each template to control costs.
24479. **Template cost tracking** — track spend per template across all its runs to identify expensive templates.
24480. **Template ROI dashboard** — findings per dollar per template, helping teams invest in the highest-value templates.
24481. **Template recommendation engine** — suggest templates based on target technology fingerprint and past hunt history.
24482. **Smart template matching** — on adding a new target, automatically suggest the top 3 matching templates.
24483. **Template quick-start wizard** — a 3-step wizard (pick template → set target → review) launching a first hunt in under a minute.
24484. **Template playground** — an interactive editor to tweak template stages and immediately see the impact on estimates.
24485. **Template JSON schema** — a documented, versioned JSON schema for template definitions enabling third-party tooling.
24486. **Template best-practice validator** — validate templates for best practices: no hardcoded secrets, sane timeouts, defined variables.
24487. **Cryptographically signed templates** — cryptographically sign published templates; clients verify signatures before installing.
24488. **Template provenance** — show the full history of a template: original author, forks, and merged contributions.
24489. **Template contribution workflow** — propose improvements to a published template via pull-request-style contributions.
24490. **Template maintainer handoff** — transfer template maintainership with subscriber notification and continuity guarantees.
24491. **Template sunsetting** — graceful sunset flow: deprecation notice period, migration guide, and final archive.
24492. **Template analytics for admins** — org admins see which templates teams use most and which gather dust.
24493. **Template compliance guardrails** — block templates whose checks violate the org's testing policy (e.g. no DoS modules).
24494. **Template environment scoping** — restrict a template to specific environments (staging-only) regardless of user intent.
24495. **Template approval chains** — require multi-level approval to install high-intrusiveness templates on production targets.
24496. **Template change notifications** — notify subscribers when an installed template publishes a new version with a summary of changes.
24497. **Template staged rollouts** — publishers can roll out a new version to 10% of subscribers first, monitoring for issues.
24498. **Template incident response** — if a template version causes problems, publishers can issue an advisory and push a fix rapidly.
24499. **Template backup** — automatic versioned backups of all installed templates for disaster recovery.
24500. **Template disaster recovery** — restore all template installations and customizations from backup after an incident.
24501. **Template API** — programmatic install, update, and launch of template-based hunts for platform integrations.
24502. **Template webhooks** — events for template installed, updated, deprecated, and new review posted.
24503. **Template multi-language descriptions** — publishers can provide descriptions in multiple languages for global adoption.
24504. **Template starter quiz** — a short quiz ("what are you testing?") recommending the right template for first-time users.

## 6. Workflow Versioning (24505–24604)

24505. **Git-like version history for hunt configs** — every change to a hunt configuration creates a commit with author, timestamp, and message, browsable as a history timeline.
24506. **Visual diff between config versions** — side-by-side diff highlighting added, removed, and changed settings between any two versions.
24507. **One-click rollback** — restore any previous hunt config version instantly, with the rollback itself recorded as a new version.
24508. **Tagged releases (v1.0-stable)** — tag known-good configurations as releases (v1.0, v2.1-stable) for promotion across environments.
24509. **Branch-and-merge for team edits** — team members edit hunt configs on branches and merge via pull-request-style review, preventing conflicting edits.
24510. **Merge conflict resolution UI** — when two branches change the same setting, a visual resolver lets reviewers pick per-field winners.
24511. **Config commit messages** — require or suggest commit messages on every config change so history explains intent, not just deltas.
24512. **Blame view for configs** — click any setting to see who last changed it, when, and why, like git blame for hunt configurations.
24513. **Config version pinning per schedule** — pin a schedule to a specific config version so config experiments don't affect production cadences.
24514. **Environment promotion flow** — promote a config version dev → staging → production with approvals at each step.
24515. **Hunt-config drift alerter** — detect when a running hunt's effective config differs from its versioned definition and alert.
24516. **Version comparison across targets** — compare the active config versions across multiple targets to spot inconsistencies.
24517. **Config templates as code** — store hunt configs as YAML/JSON in git repos with full CI validation on pull requests.
24518. **Config schema versioning** — version the config schema itself; migrate old configs automatically with a visible migration log.
24519. **Material-config-edit warnings** — warn when a config edit changes behavior materially (e.g. scope reduction, disabled auth) before saving.
24520. **Config change impact preview** — simulate the next run with the new config versus the old one, showing estimated differences.
24521. **Approval-required config changes** — mark sensitive fields (scope, intrusiveness) as requiring approval before the change takes effect.
24522. **Config change notifications** — notify stakeholders when hunt configs change, with a diff summary in the notification.
24523. **Config audit trail** — immutable log of every config change with before/after values, actor, and source (UI, API, git sync).
24524. **Config restore from audit** — restore any historical state directly from the audit log even if version history was pruned.
24525. **Scheduled config reviews** — periodic reminders to review hunt configs for staleness (e.g. quarterly config health check).
24526. **Stale config detection** — flag configs untouched for 6+ months or referencing decommissioned assets.
24527. **Config health score** — score configs on completeness, freshness, and alignment with best practices.
24528. **Config best-practice linter** — lint configs against best practices (timeouts set, notifications configured, scope bounded) with fix suggestions.
24529. **Config dependency graph** — visualize which schedules, triggers, and campaigns depend on a config before editing it.
24530. **Safe config editing mode** — edits create a draft version first; the draft must be explicitly activated, preventing accidental live changes.
24531. **Config drafts** — save unfinished config edits as drafts, shareable with teammates for feedback before activation.
24532. **Config review assignments** — assign config change reviews to specific teammates with due dates and reminders.
24533. **Config change SLAs** — track time from config change proposal to activation, with SLAs per change risk level.
24534. **Emergency config hotfix flow** — fast-track critical config fixes with post-hoc review instead of pre-approval, fully logged.
24535. **Config version annotations** — attach notes to versions (e.g. "v2.3: tuned for Black Friday traffic") for future context.
24536. **Config version search** — search version history by message, author, date, or changed field.
24537. **Config version export** — export any version as a standalone file for backup or sharing.
24538. **Config version import** — import a config file as a new version, with validation and diff against current.
24539. **Cross-account config sync** — sync config versions across Dark-Matter accounts (e.g. MSSP master to client accounts).
24540. **Config inheritance** — child configs inherit from a parent; overrides are explicit and visible, reducing duplication.
24541. **Config override tracking** — see exactly which fields a child config overrides versus its parent.
24542. **Bulk config updates** — apply a change (e.g. new notification channel) across many configs at once, each getting its own version.
24543. **Bulk update dry-run** — preview which configs would change and how before applying a bulk update.
24544. **Bulk update rollback** — roll back a bulk update across all affected configs in one operation.
24545. **Config change calendar** — calendar view of scheduled config changes (e.g. "scope expansion goes live Monday") for coordination.
24546. **Config freeze windows** — freeze config changes during critical periods (product launches, audits) except via break-glass.
24547. **Break-glass config edits** — emergency edits during a freeze with mandatory justification and automatic post-incident review.
24548. **Config version retention** — configure how many versions to keep; prune old ones automatically with audit preservation.
24549. **Config archive** — archive retired configs with full history retained for compliance.
24550. **Config restore from archive** — reactivate an archived config as a new versioned entity.
24551. **Config comparison reports** — generate a PDF comparing two config versions for change-advisory-board review.
24552. **Config signing** — cryptographically sign released config versions; the runner verifies signatures before executing.
24553. **Config provenance** — track every config's origin: created from template, cloned, imported, or built from scratch.
24554. **Config ownership** — assign owners to configs with transfer workflows and stale-owner detection.
24555. **Config access control** — role-based permissions on who can view, edit, approve, or activate each config.
24556. **Config edit locking** — lock a config while someone edits it to prevent conflicting concurrent edits.
24557. **Config edit presence** — see who else is viewing or editing a config in real time.
24558. **Config comments** — thread comments on specific config fields for async discussion.
24559. **Config mentions** — @mention teammates in config comments with notifications.
24560. **Config task lists** — attach checklists to config changes (e.g. "notify WAF team before activating").
24561. **Config activation scheduling** — schedule a config version to go live at a future time (e.g. after the deploy freeze ends).
24562. **Config activation webhooks** — fire webhooks when a config version is activated or rolled back.
24563. **Config canary activation** — activate a new config version on a subset of targets first, expanding on success.
24564. **Config A/B testing** — run two config versions concurrently on split targets and compare outcomes.
24565. **Config performance tracking** — track finding yield and reliability per config version to identify the best-performing versions.
24566. **Config regression alerts** — alert when a new config version performs worse than its predecessor on key metrics.
24567. **Auto-revert on regression** — automatically roll back to the previous version if the new one fails health checks within N runs.
24568. **Config version dashboard** — see all configs, their active versions, pending drafts, and review status in one view.
24569. **Config version API** — programmatic access to versions, diffs, rollback, and activation for CI/CD integration.
24570. **Config-as-code CLI** — a CLI to pull, edit, diff, and push hunt configs from the terminal like any codebase.
24571. **Config IDE extensions** — editor extensions with schema validation and autocomplete for hunt config files.
24572. **Config pre-commit hooks** — validate configs locally before commit with the same linter the server uses.
24573. **Config CI pipeline** — run validation, dry-run simulation, and policy checks on config pull requests automatically.
24574. **Config policy engine** — define org policies (e.g. "prod configs must have approvals enabled") enforced on every change.
24575. **Policy violation blocking** — block config activation when it violates org policy, with clear remediation guidance.
24576. **Policy exception workflow** — request time-boxed exceptions to config policies with approval and audit.
24577. **Config compliance reports** — report on policy compliance across all configs for auditors.
24578. **Config secret references** — configs reference secrets by vault path; values never stored in version history.
24579. **Secret rotation awareness** — when a referenced secret rotates, configs using it are flagged for verification.
24580. **Config variable interpolation** — use {{variables}} in configs resolved at runtime from target metadata or vault.
24581. **Config environment overlays** — base config plus per-environment overlays (dev/staging/prod) merged at runtime.
24582. **Overlay diff viewer** — see exactly what each environment overlay changes versus the base config.
24583. **Config snapshot before hunts** — snapshot the exact config version used for each hunt run, stored with the run's results.
24584. **Run-to-config traceability** — from any hunt run, jump to the exact config version that produced it.
24585. **Config reproducibility** — re-run a historical hunt with its snapshotted config to reproduce results exactly.
24586. **Config change correlation** — correlate finding-rate changes with config version changes to measure tuning impact.
24587. **Config experiment tracking** — label config versions as experiments with hypotheses and success metrics.
24588. **Experiment results dashboard** — compare experiment config versions against control on findings, cost, and duration.
24589. **Config rollback drills** — scheduled drills verifying that rollback works within the recovery time objective.
24590. **Disaster recovery for configs** — restore all hunt configs from versioned backups after data loss.
24591. **Config backup verification** — automatically verify backup integrity daily and alert on failures.
24592. **Multi-region config replication** — replicate config versions across regions for resilience and local execution.
24593. **Config conflict alerts** — alert when the same config is edited in two regions concurrently.
24594. **Config merge strategies** — choose merge strategy per config (ours/theirs/union) for multi-region or multi-branch merges.
24595. **Config version webhooks** — events for version created, activated, rolled back, tagged, and branched.
24596. **Config version RSS feed** — subscribe to config changes via RSS for lightweight monitoring.
24597. **Config change digest** — daily/weekly digest of config changes across the org for situational awareness.
24598. **Config stewardship dashboard** — show config owners, review freshness, and policy compliance per team.
24599. **Orphaned config detection** — find configs with no owner, no schedule, and no recent runs; suggest archiving.
24600. **Config lifecycle states** — draft → review → active → deprecated → archived, with transitions enforced and logged.
24601. **Deprecated config warnings** — warn when hunts reference deprecated configs and suggest replacements.
24602. **Config migration assistant** — guided migration when the config schema changes major versions, with per-field mapping.
24603. **Config version tagging automation** — auto-tag versions that pass N clean runs as "stable" candidates.
24604. **Config release notes generator** — auto-generate release notes from version diffs and commit messages for stakeholder review.

## 7. Dry-Run Mode (24605–24704)

24605. **Hunt plan preview** — before launching, show the full planned sequence: recon steps, modules, order, and estimated requests, without sending any traffic.
24606. **Estimated request count** — calculate the approximate number of HTTP requests a hunt will make, broken down by module, so teams can warn infrastructure owners.
24607. **Estimated duration** — predict hunt duration from target size and historical module timings, shown as a range with confidence.
24608. **Risk preview (intrusiveness map)** — list which planned actions are intrusive (active exploitation, heavy fuzzing) versus passive, color-coded by risk.
24609. **Dry-run vs last real run diff** — compare the dry-run plan against the previous actual run to highlight what's new, removed, or changed.
24610. **Scope validation in dry-run** — verify that scope definitions resolve correctly (domains expand, CIDRs parse, exclusions apply) before any traffic.
24611. **Credential check in dry-run** — verify that referenced credentials and secrets exist and are accessible without using them against the target.
24612. **Connectivity pre-check** — confirm the target is reachable and DNS resolves during dry-run, catching typos before launch.
24613. **WAF presence pre-detection** — use passive fingerprinting in dry-run to predict WAF presence and suggest profile adjustments.
24614. **Technology fingerprint preview** — show detected technologies from passive signals so users can confirm module selection.
24615. **Module dependency check** — verify that all modules required by the plan are available and licensed in dry-run.
24616. **Budget check in dry-run** — confirm the estimated cost fits within remaining budget and warn if it would exceed limits.
24617. **Blackout conflict check** — verify the planned run window doesn't overlap blackout windows, suggesting alternatives if it does.
24618. **Schedule collision check** — detect overlapping hunts on the same target in dry-run and suggest staggering.
24619. **Approval requirement preview** — list which steps will require human approval during the run so approvers can prepare.
24620. **Per-stage notification routing preview** — show who would be notified at each stage and via which channel, catching misrouted alerts early.
24621. **Dry-run report export** — export the dry-run plan as a PDF for change-advisory-board approval before the real hunt.
24622. **Dry-run approval gate** — require approval of the dry-run plan before the real hunt can launch for sensitive targets.
24623. **Plan versioning** — save dry-run plans as versions; compare plans across config changes.
24624. **What-if scope editing** — adjust scope in dry-run and instantly see updated estimates without committing changes.
24625. **What-if profile switching** — switch hunt profiles in dry-run to compare request counts, duration, and risk side by side.
24626. **Module toggle impact** — toggle individual modules in dry-run and see immediate impact on estimates.
24627. **Step-level cost breakdown** — show estimated cost per stage and module so expensive steps can be trimmed before launch.
24628. **Request timeline visualization** — chart planned request volume over time to spot bursts that might trip rate limits.
24629. **Rate-limit safety analysis** — compare planned request rates against known target rate limits and flag risky periods.
24630. **Egress IP preview** — show which egress IPs/regions the hunt would use, for allowlisting with the target's firewall team.
24631. **User-agent preview** — display the user-agent strings the hunt would send, customizable before launch.
24632. **Dry-run for scheduled hunts** — preview the next scheduled run's plan, catching config drift before it executes overnight.
24633. **Dry-run for triggered hunts** — preview what a trigger rule would launch given a sample event payload.
24634. **Dry-run for campaigns** — simulate an entire multi-stage campaign timeline, stage plans, and total estimates.
24635. **Dry-run for template installs** — preview exactly what a marketplace template would do to your target before installing.
24636. **Historical accuracy tracking** — compare past dry-run estimates against actuals to show and improve prediction accuracy.
24637. **Estimate confidence intervals** — show estimates as ranges (p10/p50/p90) rather than single numbers, based on historical variance.
24638. **Target-size estimator** — estimate target size (hosts, endpoints) from passive signals to ground duration predictions.
24639. **Comparative dry-runs** — run dry-runs for two configs side by side to decide between approaches.
24640. **Dry-run sharing links** — share a read-only dry-run plan link with stakeholders for review without granting hunt access.
24641. **Dry-run comments** — reviewers can comment on specific planned steps, with threads resolved before launch.
24642. **Dry-run checklists** — attach pre-launch checklists (notify NOC, verify scope authorization) to the dry-run review.
24643. **Authorization evidence attachment** — attach testing authorization documents to the dry-run for audit trail completeness.
24644. **Legal review workflow** — route dry-run plans for high-risk targets through legal review with approve/reject tracking.
24645. **Dry-run SLA** — track time from dry-run request to approval, ensuring reviews don't bottleneck testing.
24646. **Auto-approve low-risk dry-runs** — dry-runs below intrusiveness and scope thresholds auto-approve without human review.
24647. **Risk scoring for plans** — compute a 0–100 risk score per plan from intrusiveness, target criticality, and timing.
24648. **Risk threshold policies** — org policies define risk score thresholds requiring additional approvals.
24649. **Plan risk mitigation suggestions** — when risk is high, suggest concrete mitigations (reduce concurrency, exclude intrusive modules).
24650. **Sensitive-data handling preview** — flag planned steps that might encounter PII or secrets and show handling controls.
24651. **High-risk-plan data attestation** — require attestation of data-handling procedures before high-risk plans execute.
24652. **Dry-run for config changes** — preview the impact of a config version change on the next run's plan before activating.
24653. **Regression risk in dry-run** — highlight planned checks that previously caused target issues, with incident links.
24654. **Incident-history check** — surface past incidents on the target during dry-run so planners avoid repeating problematic actions.
24655. **Dependency health in dry-run** — verify external dependencies (threat feeds, DNS resolvers) are healthy before launch.
24656. **License compliance in dry-run** — confirm all planned modules are covered by current licenses.
24657. **Dry-run audit log** — log every dry-run (who, when, plan hash) as evidence of due diligence.
24658. **Dry-run API** — programmatic dry-runs for CI pipelines to validate hunt configs on every change.
24659. **CI dry-run status checks** — report dry-run validation as CI checks on config-as-code pull requests.
24660. **Dry-run webhooks** — events for dry-run completed, approved, rejected, and expired.
24661. **Dry-run expiry** — dry-run approvals expire after N days, requiring re-validation for stale plans.
24662. **Plan staleness detection** — warn if the target changed significantly since the dry-run, recommending a fresh preview.
24663. **Continuous dry-run mode** — keep a standing dry-run refreshed for critical targets so an approved plan is always ready.
24664. **One-click launch from dry-run** — approved dry-run converts to a live hunt with one click, preserving the exact validated plan.
24665. **Plan lock on approval** — once approved, the plan locks; any config change invalidates the approval and requires re-review.
24666. **Emergency bypass with logging** — allow skipping dry-run approval in emergencies with mandatory justification and audit.
24667. **Dry-run templates** — save common dry-run configurations (reviewers, checklists) as templates for reuse.
24668. **Multi-target dry-run** — preview plans for all targets in a fan-out schedule in one consolidated view.
24669. **Dry-run cost comparison** — compare estimated costs across profiles to pick the most cost-effective approach meeting objectives.
24670. **Environmental impact estimate** — show estimated compute energy for the hunt, supporting sustainability reporting.
24671. **Dry-run for retests** — preview exactly which findings will be retested and how before launching the retest run.
24672. **Retest scope diff** — show which findings from the original hunt are included/excluded in the retest plan and why.
24673. **Dry-run notifications test** — send test notifications through all configured channels during dry-run to verify routing.
24674. **Integration smoke test** — verify Jira, Slack, and webhook integrations are reachable during dry-run.
24675. **Dry-run permission check** — verify the launching user has permission for the planned intrusiveness level.
24676. **Separation-of-duties check** — ensure the plan approver differs from the plan author where policy requires it.
24677. **Dry-run for cross-system actions** — preview Jira tickets, PRs, and Slack messages that conditional rules would create.
24678. **Side-effect inventory** — list every external side effect the plan would cause (tickets, messages, pages) for review.
24679. **Side-effect approval** — require explicit approval for plans with external side effects beyond the hunt itself.
24680. **Dry-run diff across versions** — compare dry-run plans between config versions to review exactly what changed.
24681. **Annotated plan explanations** — each planned step includes a plain-English explanation of what it does and why it's needed.
24682. **Plan glossary** — hover any technical term in the plan for a definition aimed at non-technical approvers.
24683. **Executive plan summary** — auto-generated one-paragraph summary of the plan for executive approvers.
24684. **Technical plan detail** — expandable full technical detail per step for security reviewers.
24685. **Dry-run video walkthrough** — auto-generated narrated walkthrough of the plan for stakeholder briefings.
24686. **Accessible dry-run review UI** — dry-run UI meets accessibility standards so all approvers can review effectively.
24687. **Multi-language plan summaries** — plan summaries available in the reviewer's preferred language.
24688. **Dry-run for AI-suggested changes** — when the AI suggests config changes, preview their impact via dry-run before accepting.
24689. **AI plan optimization** — the AI suggests plan tweaks (drop redundant modules, reorder steps) with estimated savings shown.
24690. **Plan benchmarking** — compare your plan's estimates against anonymized similar hunts to spot over- or under-scoping.
24691. **Dry-run leaderboard** — track which teams' plans are most accurate (estimate vs actual) to encourage good planning.
24692. **Dry-run gamification** — award accuracy scores to planners whose estimates match actuals, visible on team dashboards.
24693. **Plan reuse library** — save approved dry-run plans as reusable starting points for similar targets.
24694. **Plan cloning** — clone any past plan into a new dry-run for a different target with variable substitution.
24695. **Dry-run search** — search historical dry-runs by target, author, risk score, or outcome.
24696. **Dry-run analytics** — aggregate analytics on plan risk scores, approval times, and estimate accuracy org-wide.
24697. **Dry-run retention** — configure retention for dry-run plans and approvals per compliance needs.
24698. **Dry-run export for auditors** — export dry-run plans, approvals, and diffs as an audit package proving controlled testing.
24699. **Regulatory mapping in dry-run** — show which compliance controls each planned check satisfies for audit planning.
24700. **Dry-run sign-off records** — immutable records of who approved each plan, when, and with what comments.
24701. **Post-hunt plan accuracy review** — after each hunt, show estimate vs actual side by side to improve future planning.
24702. **Plan accuracy trends** — track estimation accuracy over time per team and per template.
24703. **Dry-run feedback loop** — one-click feedback when estimates were off, feeding the prediction models.
24704. **Zero-traffic guarantee badge** — dry-run mode carries a verifiable guarantee badge confirming no packets were sent to the target.

## 8. Approval Gates (24705–24804)

24705. **Human approval before intrusive actions** — pause the hunt and request approval before exploitation, heavy fuzzing, or any step marked intrusive.
24706. **Configurable intrusiveness thresholds** — define per-org what counts as intrusive (e.g. any POST to /payment/*) triggering approval gates.
24707. **Mobile approve/deny push** — approvers get push notifications with finding context and one-tap approve/deny, designed for on-call response.
24708. **Approval request context bundle** — each request includes the finding, evidence, planned action, risk assessment, and blast radius.
24709. **Approval SLAs with auto-escalation** — if no decision in N minutes, escalate to the next approver automatically, with the SLA visible on the request.
24710. **Delegated approvers** — approvers can delegate to teammates for vacations or incidents, with delegation start/end dates and audit.
24711. **Sequential multi-role approval chains** — require sequential approvals from multiple roles (security lead, then asset owner) for the highest-risk actions.
24712. **Quorum approvals** — require M-of-N approvers for critical actions, preventing single-person authorization of dangerous tests.
24713. **Audit log of every approval decision** — immutable record of who decided, when, what context they saw, and their justification.
24714. **Approval justification requirement** — denials and high-risk approvals require a written justification stored with the decision.
24715. **2-hour approval windows** — approvals grant permission for a limited window (e.g. 2 hours); expiry returns the hunt to a held state.
24716. **Scoped approvals** — approve a specific action on a specific target, not a blanket permission, limiting blast radius.
24717. **Mid-execution approval revocation** — approvers can revoke a granted approval mid-execution, immediately halting the approved action.
24718. **Pre-approvals** — grant standing approval for defined low-risk intrusive actions during approved windows, reducing interruptions.
24719. **Pre-approval templates** — reusable pre-approval definitions (e.g. "staging SQLi tests pre-approved weeknights") applied per target.
24720. **Approval policies per environment** — production requires human approval for intrusive steps; staging can auto-approve within policy.
24721. **Approval policies per severity** — critical findings always need approval before exploitation; lows can proceed automatically.
24722. **Business-hours approval routing** — route approvals to the primary during business hours and to on-call after hours automatically.
24723. **Approval load balancing** — distribute approval requests across the approver pool to avoid overloading one person.
24724. **Approver availability status** — approvers set available/busy/off; requests route around unavailable approvers.
24725. **Approval request expiry** — unanswered requests expire after a configurable time, with the hunt applying the configured default action.
24726. **Default-deny vs default-allow** — per-gate configuration of what happens on expiry: hold the hunt or proceed cautiously.
24727. **Approval via chatops** — approve or deny directly from Slack/Teams with threaded context and button actions.
24728. **Approval via email** — secure email approvals with signed links for approvers without chat access.
24729. **Approval via SMS fallback** — SMS with a secure link as a last-resort channel when push and chat fail.
24730. **Voice-call approval escalation** — for the most critical gates, escalate to an automated voice call reading the request summary.
24731. **Approval dashboard** — single queue of all pending approvals across hunts with aging, SLA, and one-click decisions.
24732. **Approval analytics** — track decision times, approval rates, and bottlenecks per approver and per gate type.
24733. **Slow-approver alerts** — notify when an approver consistently breaches SLAs so routing can be adjusted.
24734. **Approval batching** — group similar approval requests (e.g. 5 similar intrusive tests) into one decision to reduce fatigue.
24735. **Bulk approve/deny** — select multiple requests and decide once with a single justification.
24736. **Approval request prioritization** — sort the queue by risk, SLA urgency, and business impact so critical items surface first.
24737. **Approval context diff** — show what changed since a similar past approval to speed repeat decisions.
24738. **Similar past decisions** — surface how this request was decided historically ("approved 8/10 times") to guide approvers.
24739. **AI approval recommendation** — the AI recommends approve/deny with reasoning; the human still decides, but faster.
24740. **Approval decision templates** — canned justifications for common decisions, editable before submitting.
24741. **Conditional auto-approval** — auto-approve requests matching safe patterns (previously approved identical action on same target).
24742. **Auto-approval learning** — learn from approval history to suggest new auto-approval rules, requiring human confirmation to enable.
24743. **Approval simulation** — simulate a gate configuration against historical hunts to see how many requests it would generate.
24744. **Gate tuning recommendations** — suggest gate threshold adjustments when approval volume is unsustainable.
24745. **Emergency break-glass approval** — a break-glass path for critical incidents with mandatory post-hoc review within 24 hours.
24746. **Break-glass audit** — every break-glass use triggers an immediate audit notification and a scheduled review task.
24747. **Approval for scope expansion** — expanding hunt scope mid-run requires approval with the proposed new scope shown.
24748. **Approval for credential use** — using stored credentials against a target requires approval unless pre-approved.
24749. **Approval for data exfiltration tests** — any test that could extract data needs explicit approval with data-handling attestation.
24750. **Approval for production hunts** — launching any hunt against production requires approval, regardless of intrusiveness.
24751. **Approval for third-party targets** — hunts touching vendor or partner systems need approval with authorization evidence attached.
24752. **Approval for new templates** — installing a new marketplace template requires approval from the security architect.
24753. **Approval for config promotion** — promoting a config version to production requires approval with diff review.
24754. **Approval for campaign launch** — launching a campaign requires stakeholder approval of plan, scope, and dates.
24755. **Approval for bulk actions** — bulk config updates or bulk schedule changes need a single approval covering the batch.
24756. **Dual independent approver rule** — the most sensitive gates require two independent approvers who can't be the same person.
24757. **Separation of duties enforcement** — the requester can't approve their own gate; the system enforces distinct identities.
24758. **Approval delegation chains** — delegations can chain (A→B→C) with full visibility of the chain on each request.
24759. **Temporary elevation** — grant temporary approver rights for an incident, auto-expiring with full audit.
24760. **Approval roles** — define roles (security approver, business approver, legal approver) and require specific roles per gate type.
24761. **Gate definitions as code** — define approval gates in YAML versioned with configs, reviewable in pull requests.
24762. **Gate testing** — test gate configurations with synthetic requests to verify routing and SLAs before going live.
24763. **Gate versioning** — version gate definitions; roll back a gate change that causes approval storms.
24764. **Approval notification preferences** — approvers choose channels and quiet hours per gate severity.
24765. **Approval digest mode** — low-urgency approvals batch into a periodic digest instead of instant pings.
24766. **Approval calendar integration** — block approver out-of-office periods from routing using calendar integration.
24767. **Approval handoff notes** — approvers leaving a shift can leave handoff notes on pending requests for the next approver.
24768. **Approval request threads** — discuss a request in a thread with the requester before deciding, keeping context together.
24769. **Requester response SLA** — when an approver asks a question, the requester gets an SLA to respond before the request expires.
24770. **Approval evidence snapshots** — freeze the evidence bundle at decision time so later changes can't alter what was approved.
24771. **Approval replay** — replay the exact context an approver saw for post-incident review or training.
24772. **Approver training mode** — new approvers practice on historical requests with their decisions compared to actual outcomes.
24773. **Approval quality metrics** — track overturn rates and incident correlation to identify approval quality issues.
24774. **Approval feedback loop** — after the approved action completes, report the outcome back to the approver, closing the loop.
24775. **Regretted approval tracking** — flag approvals that led to incidents; feed into training and auto-approval tuning.
24776. **Approval policy simulator** — model policy changes ("what if we require two approvers for prod?") against historical data.
24777. **Compliance-mapped gates** — map each gate to compliance requirements (e.g. "change authorization" for SOC 2) for audit evidence.
24778. **Gate evidence export** — export gate definitions, requests, decisions, and justifications as an audit package.
24779. **Approval retention policies** — retain approval records per regulatory requirements with legal-hold support.
24780. **Legal hold on approvals** — place approval records under legal hold, preventing deletion during litigation.
24781. **Approval API** — programmatic approval decisions for integration with external GRC or ticketing workflows.
24782. **Approval webhooks** — events for request created, approved, denied, expired, escalated, and revoked.
24783. **Approval mobile offline queue** — approvers can queue decisions offline; they sync when connectivity returns, with conflict handling.
24784. **Approval biometric confirmation** — require biometric confirmation on mobile for the highest-risk approvals.
24785. **Critical-gate re-authentication** — require re-authentication before deciding on critical gates, even for logged-in approvers.
24786. **Approval session recording** — record the approver's review session (pages viewed, time spent) for high-assurance audits.
24787. **Geo-fenced approvals** — restrict critical approvals to specific network locations or device postures.
24788. **Approval device attestation** — require managed-device attestation for approving production intrusive actions.
24789. **Time-limited approval links** — secure approval links expire after first use or 30 minutes, preventing replay.
24790. **Approval link revocation** — revoke outstanding approval links instantly if a request is superseded.
24791. **Multi-channel delivery confirmation** — confirm the approver actually received the request across channels before starting the SLA clock.
24792. **Approval read receipts** — show when an approver viewed the request to distinguish "unseen" from "undecided".
24793. **Nudge mechanism** — send a polite nudge to approvers at 50% and 80% of SLA, escalating tone appropriately.
24794. **Approval delegation suggestions** — suggest the best delegate based on past decision patterns and current availability.
24795. **Cross-team approvals** — route requests requiring both security and business approval in parallel tracks.
24796. **Customer approvals** — for MSSPs, route production-gate approvals to the customer's designated approver in their portal.
24797. **Approval SLA reporting** — monthly reports on approval SLAs per team for management review.
24798. **Approval cost of delay** — show the hunt-delay cost of pending approvals to motivate timely decisions.
24799. **Gate bypass detection** — detect and alert on any attempt to circumvent approval gates via API or config edits.
24800. **Approval gate health dashboard** — monitor gate throughput, SLA compliance, and approver workload in real time.
24801. **Seasonal approval coverage** — plan approver coverage for holidays with automatic delegation and capacity alerts.
24802. **Approval post-mortems** — after incidents involving approvals, generate a timeline of requests and decisions for review.
24803. **Approval playbook integration** — link each gate type to a runbook so approvers follow consistent evaluation steps.
24804. **One-click gate from any hunt step** — insert an approval gate before any hunt step ad-hoc during a live run with two clicks.

## 9. Webhook & Event Bus (24805–24904)

24805. **Hunt lifecycle webhooks** — fire webhooks on hunt created, started, paused, resumed, completed, failed, and cancelled with rich payloads.
24806. **Finding event webhooks** — fire per-finding events (discovered, verified, severity-changed, fixed) for real-time downstream automation.
24807. **Custom event filters** — subscribe to events with filters (severity >= high, target in prod) so receivers only get relevant events.
24808. **Webhook retry with exponential backoff** — failed deliveries retry automatically with exponential backoff and jitter, up to a configurable limit.
24809. **Dead-letter queue for webhooks** — events that exhaust retries land in a dead-letter queue with manual replay and inspection.
24810. **Per-endpoint webhook latency dashboard** — see delivery status, latency, and retry history per endpoint and per event.
24811. **Webhook endpoint health checks** — periodically ping subscribed endpoints and alert owners when an endpoint is unhealthy.
24812. **Webhook signature (HMAC)** — sign every webhook payload so receivers can verify authenticity and reject forgeries.
24813. **Per-endpoint secrets** — each webhook subscription has its own signing secret, rotatable without affecting others.
24814. **Webhook payload versioning** — versioned event schemas with backward-compatible changes and deprecation notices.
24815. **Event catalog** — a browsable catalog of every event type Dark-Matter emits, with example payloads and schema docs.
24816. **Internal event bus** — a central event bus connecting all Dark-Matter subsystems so new automations subscribe without point-to-point wiring.
24817. **Event bus replay** — replay historical events through the bus to backfill new subscribers or recover from outages.
24818. **Event enrichment** — the bus enriches raw events with target metadata, asset criticality, and owner info before delivery.
24819. **Event transformation** — define per-subscription payload transformations (field mapping, redaction) without code.
24820. **Event routing rules** — route events to different endpoints based on content (criticals → PagerDuty webhook, lows → data warehouse).
24821. **Event sampling** — for high-volume events, configure sampling rates per subscription to control downstream load.
24822. **Event aggregation** — aggregate bursts (e.g. 50 findings in a minute) into summary events to avoid overwhelming receivers.
24823. **Event deduplication** — dedupe identical events within a window so receivers don't process the same finding twice.
24824. **Event ordering guarantees** — per-entity ordering (all events for hunt X arrive in order) for subscribers that need causality.
24825. **Event retention** — retain events on the bus for a configurable period for replay and audit.
24826. **Event archiving** — archive old events to cheap storage with searchable metadata for compliance.
24827. **Zapier connector** — a native Zapier app exposing Dark-Matter triggers (new critical finding) and actions (launch hunt).
24828. **Make (Integromat) connector** — equivalent native connector for Make with scenario templates.
24829. **n8n integration** — prebuilt n8n nodes for Dark-Matter events and actions for self-hosted automation.
24830. **Power Automate connector** — native connector for Microsoft Power Automate for enterprise workflow integration.
24831. **Workato connector** — enterprise iPaaS connector with prebuilt recipes for common security workflows.
24832. **Webhook.site-style debugger** — a built-in request inspector showing exactly what payloads your endpoint would receive, for integration development.
24833. **Event subscription testing** — send a synthetic test event to any subscription to verify the receiver handles it correctly.
24834. **Subscription pause/resume** — pause a noisy subscription without deleting it, resuming when the receiver is fixed.
24835. **Rate limits per subscription** — cap events per minute per subscription to protect downstream systems.
24836. **Circuit breaker per endpoint** — if an endpoint fails repeatedly, pause delivery automatically and alert, resuming after a cool-down.
24837. **Webhook IP allowlist publishing** — publish Dark-Matter's webhook egress IPs so receivers can allowlist them.
24838. **Mutual TLS for webhooks** — support mTLS for webhook delivery to high-security receivers.
24839. **Event payload encryption** — encrypt sensitive event payloads with the subscriber's public key for end-to-end confidentiality.
24840. **PII redaction in events** — automatically redact PII from event payloads based on data-classification policies.
24841. **Event field-level permissions** — control which fields each subscription can see (e.g. hide evidence URLs from the analytics warehouse).
24842. **Multi-tenant event isolation** — events are strictly isolated per tenant; a misconfigured filter can never leak another tenant's events.
24843. **Event bus metrics** — throughput, latency, error rates, and backlog per event type and subscription, exportable to Prometheus.
24844. **Event lag alerting** — alert when event delivery lag exceeds thresholds, indicating downstream or bus problems.
24845. **Webhook event-schema compatibility checks** — central registry of versioned event schemas with compatibility checks on changes.
24846. **Breaking-change detection for events** — block event schema changes that would break existing subscribers, with migration guidance.
24847. **Subscriber migration assistant** — guided migration when an event version is deprecated, with dual-delivery during transition.
24848. **Event-driven auto-remediation** — subscribe remediation runbooks to events (e.g. open S3 bucket event → auto-apply fix) with approval gates.
24849. **Event-triggered chatops** — post interactive event summaries to Slack/Teams with action buttons (acknowledge, create ticket, page).
24850. **Event → SIEM forwarding** — forward normalized security events to SIEMs in CEF/LEEF format with configurable mapping.
24851. **Event → data warehouse sync** — stream events to Snowflake/BigQuery for analytics and long-term trending.
24852. **Event → ticketing auto-creation** — create tickets from events with field mapping, deduping against existing tickets.
24853. **Bidirectional ticket sync** — ticket status changes flow back as events, keeping Dark-Matter findings in sync.
24854. **Event-driven reporting** — trigger report generation on events (campaign completed → generate and email the PDF).
24855. **Scheduled event digests** — batch events into hourly/daily digests per subscription for non-urgent consumers.
24856. **Event priority tiers** — mark events critical/high/normal; critical events bypass batching and retry more aggressively.
24857. **Event correlation engine** — correlate related events (deploy + finding + ticket) into a single timeline event for subscribers.
24858. **Anomaly events** — the bus emits anomaly events (unusual finding velocity, hunt failure spikes) that automations can subscribe to.
24859. **Custom event emission API** — users can emit custom events onto the bus from scripts or integrations, triggering downstream flows.
24860. **Event namespaces** — organize events into namespaces (hunts, findings, campaigns, admin) with per-namespace access control.
24861. **Namespace-level subscriptions** — subscribe to all events in a namespace with one subscription and fine-grained filters.
24862. **Event access audit** — log which subscriptions received which events for compliance and debugging.
24863. **GDPR event purging** — purge a data subject's events from the bus, archive, and dead-letter queue on request.
24864. **Event bus multi-region** — replicate the event bus across regions for resilience with local delivery.
24865. **Event bus failover** — automatic failover to a secondary region with no event loss during regional outages.
24866. **Webhook delivery receipts** — receivers can acknowledge events; unacknowledged critical events escalate.
24867. **Exactly-once delivery option** — idempotency keys per event enabling exactly-once processing for critical subscribers.
24868. **Event idempotency guidance** — documentation and SDK helpers for building idempotent receivers.
24869. **Webhook SDK** — official SDKs (Python, Node, Go) for verifying signatures and handling Dark-Matter webhooks.
24870. **Event playground** — an interactive UI to browse events, apply filters, and see matching historical events live.
24871. **Event query language** — a simple query language to filter events (severity:critical AND env:prod) used across subscriptions and search.
24872. **Saved event searches** — save frequent event queries and subscribe to them as alert rules.
24873. **Event alerts** — turn any saved event search into an alert with notification routing.
24874. **Event-driven SLA tracking** — start SLA clocks on events (finding discovered) and emit breach warnings as new events.
24875. **Event-sourced audit trail** — the entire audit log is built on the event bus, making every state change replayable.
24876. **Compliance event streams** — dedicated streams of compliance-relevant events (approvals, access changes) for auditors.
24877. **Real-time event stream UI** — a live tail view of events flowing through the bus, filterable in real time.
24878. **Event throughput dashboard** — visualize events per second by type to spot anomalies and plan capacity.
24879. **Event cost attribution** — attribute event processing and delivery costs to teams for chargeback.
24880. **Event subscription templates** — prebuilt subscriptions ("critical findings → PagerDuty") installable in one click.
24881. **Event subscription marketplace** — share subscription templates (filters + transformations + endpoint configs) with the community.
24882. **Event bus access tokens** — scoped tokens for event subscribers with least-privilege permissions per namespace.
24883. **Token rotation for subscribers** — rotate subscriber tokens without downtime, with overlap windows.
24884. **Event bus quotas** — per-tenant quotas on event volume and subscriptions to ensure fair use.
24885. **Bursty event smoothing** — smooth delivery of bursty event streams to protect receivers with limited throughput.
24886. **Event batching API** — receivers can pull events in batches via API as an alternative to push webhooks.
24887. **Long-poll event consumption** — long-polling endpoint for receivers behind strict firewalls that can't accept inbound webhooks.
24888. **WebSocket event streaming** — real-time WebSocket stream of filtered events for live dashboards.
24889. **Server-sent events (SSE)** — SSE endpoint as a lightweight alternative for browser-based live views.
24890. **Event fan-out monitoring** — track per-event fan-out (how many subscriptions each event reached) to detect misconfigurations.
24891. **Orphaned subscription detection** — find subscriptions whose endpoints haven't acknowledged events in 30 days and suggest cleanup.
24892. **Subscription ownership** — assign owners to subscriptions with transfer workflows and stale-owner alerts.
24893. **Event documentation generator** — auto-generate integration docs from the event catalog for developer onboarding.
24894. **Integration health score** — per-integration health combining delivery success, latency, and error trends.
24895. **End-to-end event tracing** — trace an event from emission through bus, filters, and delivery with timing breakdowns.
24896. **Event chaos testing** — deliberately inject duplicate, delayed, or malformed events to verify subscriber resilience.
24897. **Event contract testing** — verify that event payloads always match their registered schemas in CI.
24898. **Event versioning policy** — documented policy for how event schemas evolve, with guaranteed support windows.
24899. **Deprecated event sunset flow** — announce, dual-deliver, then sunset old event versions with subscriber migration tracking.
24900. **Event bus disaster recovery** — restore event bus configuration, subscriptions, and retained events from backup.
24901. **Cross-instance event bridging** — bridge events between separate Dark-Matter instances (e.g. MSSP to client) with filtering.
24902. **Event-driven ML retraining** — finding-verified events trigger retraining pipelines for detection models automatically.
24903. **Event feedback loops** — downstream outcomes (ticket closed as false positive) flow back as events to improve detection.
24904. **Unified notification center** — all event-driven notifications converge in one user inbox with filtering and bulk actions.

## 10. Cross-System Orchestration (24905–25004)

24905. **Auto-create Jira tickets per finding** — every verified finding creates a Jira issue with severity-mapped priority, labels, and evidence links automatically.
24906. **Jira field mapping designer** — visual mapper linking finding attributes (severity, CVSS, asset) to Jira fields (priority, components, custom fields).
24907. **Bidirectional Jira sync** — status, assignee, and comment changes sync both ways so the hunt view and Jira never disagree.
24908. **Jira dedup on creation** — before creating a ticket, check for existing open issues for the same finding to prevent duplicates.
24909. **Auto-open PRs with fixes** — for fixable findings (insecure headers, outdated libs), open a pull request with the remediating change and tests.
24910. **Fix-PR verification loop** — after a fix PR merges, automatically retest and close the finding, commenting the verification on the PR.
24911. **Slack thread per critical** — each critical finding opens a dedicated Slack thread with evidence, owner, and action buttons.
24912. **PagerDuty incidents for criticals** — auto-create PagerDuty incidents for critical findings with severity, runbook links, and escalation policies.
24913. **Auto-update CMDB** — discovered assets, technologies, and ownership flow into the CMDB automatically, keeping inventory current.
24914. **GRC platform sync** — push findings and campaign evidence to GRC tools (ServiceNow GRC, Archer) as control test results.
24915. **ServiceNow ITSM integration** — create incidents, problems, and change requests in ServiceNow from findings with full field mapping.
24916. **ServiceNow CMDB reconciliation** — reconcile discovered assets against the CMDB, flagging unknown or decommissioned assets.
24917. **Linear integration** — create Linear issues from findings with team routing and cycle assignment.
24918. **Asana integration** — push remediation tasks to Asana projects with due dates derived from finding SLAs.
24919. **Monday.com integration** — sync findings to Monday boards for non-technical stakeholder tracking.
24920. **Azure Boards area-path mapping** — create work items in Azure Boards with area paths mapped from asset ownership.
24921. **GitHub Issues sync** — create GitHub issues from findings in the target's repo with labels and milestone mapping.
24922. **GitLab issues sync** — equivalent integration for GitLab with weight and iteration mapping.
24923. **Opsgenie alerting** — route critical findings to Opsgenie with responder teams and alert policies.
24924. **VictorOps (Splunk On-Call) routing** — integrate with Splunk On-Call for paging with timeline annotations.
24925. **xMatters integration** — drive xMatters communication plans from critical finding events.
24926. **Teams channel per campaign** — auto-provision Microsoft Teams channels per campaign with tabbed dashboards.
24927. **Actionable Teams finding cards** — rich actionable finding cards in Teams with approve/assign buttons.
24928. **Email ticketing (Service Desk)** — email-based ticket creation for ITSM tools without APIs, with threaded updates.
24929. **Remedy integration** — create and sync tickets in BMC Remedy for enterprises on legacy ITSM.
24930. **Cherwell integration** — sync findings to Cherwell with business-object mapping.
24931. **Zendesk integration** — for customer-facing findings, create Zendesk tickets with public/private comment separation.
24932. **Freshservice integration** — create incidents in Freshservice with asset linking.
24933. **Trello remediation boards** — push findings to Trello cards on team boards with checklist templates for remediation steps.
24934. **Notion remediation hub** — sync findings to a Notion database with views per team and SLA countdowns.
24935. **Confluence evidence pages** — auto-generate Confluence pages per campaign with embedded evidence and reports.
24936. **SharePoint report publishing** — publish final reports to SharePoint libraries with metadata and retention labels.
24937. **Shared-Drive evidence export** — export reports and evidence to shared Drive folders with permission management.
24938. **SIEM detection content** — auto-generate SIEM detection rules (Sigma/SPL) from confirmed findings for continuous monitoring.
24939. **Cortex-Splunk SOAR finding triggers** — trigger SOAR playbooks (Cortex XSOAR, Splunk SOAR) from finding events with context payloads.
24940. **EDR isolate on critical** — for critical findings indicating active compromise, trigger EDR host isolation via SOAR with approval.
24941. **Firewall block automation** — push temporary blocks for attacker IPs discovered during hunts to firewalls via API, with expiry.
24942. **Confirmed-finding WAF rule snippets** — generate WAF rule snippets mitigating confirmed findings, ready for the WAF team to review and apply.
24943. **Ticket-to-hunt linking** — from any ITSM ticket, launch a scoped hunt with one click, linking results back to the ticket.
24944. **Change-ticket aware hunts** — hunts check related change tickets to avoid testing during approved changes and to scope to changed items.
24945. **Asset owner auto-resolution** — resolve finding assignees from CMDB ownership data automatically, falling back to team queues.
24946. **Escalation via org chart** — escalate unacknowledged findings up the management chain using HR/org-chart integration.
24947. **Remediation runbook linking** — attach relevant runbooks to auto-created tickets based on finding type.
24948. **Fix-commit linking** — when developers reference a finding ID in commits, link commits to the finding automatically.
24949. **Deployment correlation** — correlate finding discovery with recent deployments to suggest the introducing change.
24950. **Blameless postmortem generator** — for criticals, draft a postmortem doc linking timeline, findings, tickets, and remediation.
24951. **Status page automation** — for customer-impacting findings, draft status-page updates with severity-appropriate wording.
24952. **Customer notification workflow** — route customer-notification decisions through legal and comms with pre-approved templates.
24953. **Vulnerability disclosure workflow** — for third-party findings, manage coordinated disclosure timelines and communications.
24954. **Bug bounty platform sync** — sync in-scope findings to HackerOne/Bugcrowd as private reports with deduplication.
24955. **Pentest vendor handoff** — package campaign data for external pentest vendors, avoiding duplicate effort.
24956. **Audit evidence packaging** — bundle findings, tickets, retests, and approvals into auditor-ready evidence packs per control.
24957. **Compliance dashboard sync** — push control-status updates to compliance dashboards in real time as findings remediate.
24958. **Risk register sync** — sync accepted risks and open criticals to the enterprise risk register automatically.
24959. **Executive briefing generator** — generate board-ready slides from orchestration data: MTTR trends, open criticals, SLA compliance.
24960. **KPI pipeline to BI tools** — stream security metrics to Tableau/PowerBI for organization-wide dashboards.
24961. **Data warehouse ticket sync** — replicate ticket lifecycle data to the warehouse for DORA-style security metrics.
24962. **ChatOps remediation commands** — run approved remediation actions (rotate key, block IP) from Slack with confirmation prompts.
24963. **Approval-gated auto-remediation** — auto-remediation actions execute only after chatops approval, with full audit.
24964. **Remediation dry-run** — preview remediation actions (what would change) before executing them against infrastructure.
24965. **Remediation rollback** — automatically roll back auto-remediation that causes errors, with alerting.
24966. **Infrastructure-as-code fix PRs** — for cloud misconfigurations, open PRs against Terraform repos with the corrected configuration.
24967. **Policy-as-code updates** — propose updates to OPA/Sentinel policies that would have prevented the misconfiguration.
24968. **Secret rotation orchestration** — on leaked-secret findings, orchestrate rotation across vault, apps, and CI with verification.
24969. **Certificate renewal orchestration** — on expiring-cert findings, trigger renewal workflows with the certificate manager.
24970. **Patch orchestration** — create patching tasks in patch management tools with reboot windows and verification hunts scheduled after.
24971. **Container rebuild triggers** — for vulnerable base images, trigger container rebuild pipelines with the patched image.
24972. **Dependency update PRs** — open Dependabot-style PRs bumping vulnerable dependencies, with hunt verification after merge.
24973. **License compliance tickets** — route license-risk findings to legal queues instead of engineering backlogs.
24974. **Privacy review tasks** — route PII-related findings to privacy team workflows with data-mapping links.
24975. **Vendor risk tickets** — create vendor-risk assessments in third-party risk tools for vendor-attributed findings.
24976. **M&A integration tasks** — for acquired-asset findings, create integration tasks in the M&A program tracker.
24977. **Training assignments** — assign secure-coding training modules to developers linked to repeated finding patterns.
24978. **Security champion routing** — route findings to embedded security champions first for triage before engineering queues.
24979. **Gamified remediation leaderboard** — rank teams by MTTR and fix rate, pulling data from ticket integrations automatically.
24980. **Remediation SLA countdown in tickets** — tickets show live SLA countdowns synced from Dark-Matter, updating on status changes.
24981. **ITSM auto-page on SLA breach** — breached SLAs escalate tickets and page owners automatically via the ITSM integration.
24982. **Stale ticket nudges** — nudge assignees of tickets idle beyond thresholds, with escalation after repeated nudges.
24983. **Duplicate ticket merging** — detect tickets for the same underlying issue across systems and merge them with link preservation.
24984. **Ticket quality scoring** — score auto-created tickets on completeness; low scores trigger template improvements.
24985. **Cross-system integration health checks** — monitor every cross-system integration (Jira, Slack, PagerDuty) with health checks and alerts.
24986. **Integration credential rotation** — rotate integration API tokens on schedule with zero-downtime cutover.
24987. **Integration failure fallback** — if Jira is down, queue tickets locally and replay when it recovers, with operator visibility.
24988. **Multi-instance Jira support** — route tickets to different Jira instances per business unit or geography.
24989. **No-code integration field mapper** — build new integrations via a no-code mapper: pick trigger events, map fields, set auth.
24990. **Integration templates gallery** — one-click install prebuilt integrations for 50+ tools with sensible defaults.
24991. **Integration testing sandbox** — test integrations against sandbox tenants before connecting production systems.
24992. **Integration audit log** — log every cross-system action (ticket created, PR opened, message sent) with payloads for audit.
24993. **Integration permission scoping** — each integration uses least-privilege scoped credentials, reviewed periodically.
24994. **Data residency for integrations** — route integration traffic through regions matching data-residency requirements.
24995. **Integration cost tracking** — track API call volumes and costs per integration for budgeting.
24996. **Orchestration workflow designer** — visual designer chaining cross-system actions (finding → ticket → Slack → PR) into reusable workflows.
24997. **Step-by-step orchestration run history** — see every orchestration workflow run with step-by-step status and timing.
24998. **Workflow error handling** — define per-step retries, fallbacks, and compensation actions for orchestration workflows.
24999. **Orchestration analytics** — measure end-to-end time from finding to fix across all integrated systems.
25000. **MTTR attribution** — attribute MTTR improvements to specific automation steps, proving orchestration ROI.
25001. **Cross-system search** — search findings, tickets, PRs, and messages from one bar spanning all integrated systems.
25002. **Unified timeline per finding** — one timeline showing hunt events, tickets, PRs, chats, and deploys for a finding.
25003. **Orchestration kill switch** — instantly pause all cross-system automation during incidents, with per-integration granularity.
25004. **Quarterly orchestration review** — auto-generated quarterly report on automation coverage, MTTR trends, and integration health for leadership.
