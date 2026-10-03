# Part 09 — Platform & collaboration

0001. **Bounty program manager** — defines scope, rules, payout tables, and SLAs per program; hunts auto-validate scope compliance and findings route to the right program with payout estimates.
0002. **Shared hunt workspaces** — multiple researchers collaborate on one target with live finding feed, claim-a-finding locking, and merged reports.
0003. **CI/CD gate integration** — blocks merges when a hunt finds critical issues on staging, with finding-to-commit attribution via deploy correlation.
0004. **Role-based dashboards** — separate researcher, developer, and CISO views with different KPIs, widgets, and drill-down permissions per role.
0005. **Team hunt competitions** — internal red-vs-blue hunts with scoring rules, time windows, and live standings broadcast to a competition page.
0006. **Mentorship mode** — senior researchers review junior hunts inline, leave annotated feedback on findings, and approve PoCs before report submission.
0007. **White-label reports** — client-branded PDF exports with custom logos, color themes, legal disclaimers, and cover pages per program.
0008. **SSO with SAML 2.0** — enterprise single sign-on with IdP-initiated and SP-initiated flows, attribute mapping to team roles, and forced re-auth for admin actions.
0009. **SCIM provisioning** — automatic user provisioning and deprovisioning synced from Okta, Entra ID, or Google Workspace with group-to-team mapping.
0010. **Immutable audit log** — every hunt action, finding change, export, and login recorded in an append-only log with hash chaining and tamper evidence.
0011. **Granular RBAC** — permission matrix across hunts, programs, findings, reports, billing, and integrations with custom role creation and inheritance.
0012. **Finding lifecycle states** — triage queue with New → Confirmed → Assigned → Fixing → Retest → Closed transitions and per-transition SLA timers.
0013. **SLA tracking per severity** — configurable response and remediation deadlines per severity with escalation emails and breach alerts to program owners.
0014. **Program scope validator** — automatically rejects out-of-scope targets at hunt creation using allow/deny lists, domain wildcards, and ASN rules.
0015. **Payout calculator** — severity × asset-criticality × program-multiplier matrix producing transparent payout estimates attached to each confirmed finding.
0016. **Duplicate detection engine** — fuzzy matching on vulnerability class, endpoint, and payload to auto-mark duplicates and link them to the canonical finding.
0017. **Triage assistant queue** — ML-ranked triage inbox sorted by exploitability and business impact with one-click confirm, duplicate, or N/A actions.
0018. **Researcher leaderboards** — season-based rankings with points for severity, novelty, and report quality plus skill badges like XSS Master or Auth Bypass Expert.
0019. **Skill badge system** — badges awarded on verified finding streaks in specific CWE classes, displayed on researcher profiles and used for hunt invitations.
0020. **Hunt templates marketplace** — shareable hunt configurations (target profile, engine pack, depth, exclusions) with versioning, ratings, and one-click import.
0021. **Plugin marketplace** — community and vendor recon/exploit plugins with signed packages, sandbox review, permission manifests, and per-team allowlists.
0022. **Webhook per event type** — distinct webhook subscriptions for finding.created, hunt.completed, sla.breached, payout.approved with HMAC signatures and retry queues.
0023. **REST API with OpenAPI spec** — full CRUD for hunts, findings, programs, and teams with rate-limited API keys scoped per workspace.
0024. **GraphQL API** — typed schema exposing hunts, findings, and analytics for custom dashboards with persisted queries and field-level authorization.
0025. **JIRA bidirectional sync** — findings create JIRA issues with custom field mapping, and status transitions sync back to the finding lifecycle automatically.
0026. **Linear sync** — mirror findings into Linear projects with team routing rules and cycle-aware priority mapping.
0027. **Asana sync** — push remediation tasks to Asana portfolios with subtask breakdowns per remediation step and completion callbacks.
0028. **Slack bot alerts** — per-channel finding alerts with severity filtering, thread-based discussion, and slash commands to claim or comment on findings.
0029. **Microsoft Teams bot** — adaptive-card alerts posted to team channels with approve/reject action buttons wired to triage actions.
0030. **Discord bot** — community server alerts, leaderboard announcements, and competition countdowns with role-gated researcher channels.
0031. **SIEM export to Splunk** — findings streamed as CIM-compliant events over HEC with sourcetype mapping for SOC correlation.
0032. **Elastic export** — bulk-index findings into Elasticsearch with ECS field mapping and prebuilt Kibana dashboards for vuln posture.
0033. **GitHub code scanning SARIF** — upload findings as SARIF to GitHub code scanning so they appear in the Security tab with PR annotations.
0034. **GitLab security dashboard** — push findings to GitLab vulnerability reports with pipeline-job linkage for MR blocking.
0035. **Pre-commit hook pack** — lightweight secret and dependency checks that run locally before commit with configurable blocking rules.
0036. **PR comment bot** — posts inline PR comments on changed lines that introduced a finding, with remediation hints and retest buttons.
0037. **Deploy correlation** — tags each finding with the deploy SHA and environment that introduced it using CI metadata and asset versioning.
0038. **Staging auto-hunt on deploy** — triggers a scoped hunt against the staging environment on every successful deploy with diff-aware targeting.
0039. **Canary finding alerts** — new critical findings on production trigger PagerDuty/Opsgenie incidents with runbook links and auto-created war rooms.
0040. **Multi-tenancy isolation** — per-organization data planes with separate encryption keys, storage buckets, and network policies on shared infrastructure.
0041. **Organization switcher** — users belonging to multiple orgs switch contexts with per-org role, quota, and billing visibility.
0042. **Team workspaces** — nested teams with their own hunts, programs, and member lists inheriting org-level policies and budgets.
0043. **Guest researcher access** — time-boxed, scope-limited external researcher seats for contractors with watermarked reports and session recording.
0044. **Invite links with expiry** — single-use or time-limited invite URLs with preset roles and automatic revocation on first use.
0045. **Approval workflows** — multi-step approvals for report publishing, payout release, and scope changes with delegations and audit trails.
0046. **Change request tickets** — scope expansion requests from researchers routed to program owners with diff view and one-click approve.
0047. **Retest request flow** — developers request retests on fixed findings; the platform re-runs the original PoC and updates the lifecycle automatically.
0048. **False-positive dispute flow** — developers contest findings with evidence; disputes route to the original researcher with a resolution SLA.
0049. **Finding comments and mentions** — threaded discussions on findings with @mentions, email digests, and resolution checklists.
0050. **Live hunt feed** — real-time event stream of recon steps, probes, and findings visible to workspace members with pause and filter controls.
0051. **Hunt replay mode** — step-through playback of a completed hunt showing each probe, response, and decision for training and review.
0052. **Claim-a-finding locking** — researchers claim unassigned findings to prevent duplicate work, with auto-release after configurable inactivity.
0053. **Hunt task board** — Kanban board of hunt subtasks (recon, auth testing, API fuzzing) with drag-drop assignment and progress rollups.
0054. **Shared recon notes** — collaborative markdown notes attached to hunts with live cursors, version history, and finding cross-links.
0055. **Target asset inventory** — per-program asset register with domains, IPs, apps, owners, and criticality tiers feeding scope and payout logic.
0056. **Asset discovery sync** — scheduled external-attack-surface scans keep the asset inventory fresh and flag shadow IT for program inclusion.
0057. **Program rules engine** — declarative rules for allowed testing hours, forbidden techniques, and data-handling constraints enforced by the hunt runner.
0058. **Safe-harbor policy pages** — per-program legal safe-harbor text, contact info, and disclosure policies published on public program pages.
0059. **Public program directory** — opt-in public listing of bounty programs with scope summaries, average payouts, and response-time stats to attract researchers.
0060. **Private program invitations** — invite-only programs with NDA-gated scope documents and researcher vetting questionnaires.
0061. **Researcher vetting pipeline** — identity verification, skill assessment hunts, and reference checks before granting private-program access.
0062. **KYC-lite for payouts** — collect tax and identity documents required for bounty payouts with encrypted storage and expiry reminders.
0063. **Payout approval chain** — finance review step with payout batching, currency conversion, and payment-provider dispatch (Wise, PayPal, crypto).
0064. **Bounty leaderboard payouts** — monthly payout summaries per researcher with downloadable statements for tax reporting.
0065. **Program health score** — composite metric of triage speed, payout timeliness, and researcher satisfaction shown to program owners.
0066. **Researcher satisfaction surveys** — post-payout micro-surveys feeding program health and owner coaching tips.
0067. **Escalation matrix** — per-program escalation paths for SLA breaches, disputes, and critical findings with on-call rotations.
0068. **On-call rotation sync** — import PagerDuty/Opsgenie schedules so critical finding alerts page the current security on-call automatically.
0069. **War-room channel auto-create** — critical findings spin up dedicated Slack/Teams channels with the finding context, owner, and timeline pinned.
0070. **Incident bridge to SOAR** — trigger SOAR playbooks on critical findings with finding context passed as playbook inputs.
0071. **Ticket auto-prioritization** — priority scores computed from severity, asset criticality, and exploit-in-the-wild signals applied to synced tickets.
0072. **Sprint planning integration** — push top findings into the next sprint backlog with story-point estimates derived from remediation complexity.
0073. **Fix commit linkage** — developers link fix commits to findings; the platform verifies the diff touches the vulnerable code path.
0074. **Regression retest scheduler** — automatically re-runs PoCs on a cadence after closure to catch regressions, reopening on failure.
0075. **Vulnerability aging report** — open findings bucketed by age with owner accountability views and executive summary exports.
0076. **MTTR analytics** — mean time to remediate sliced by team, severity, and asset type with trend lines and target benchmarking.
0077. **Triage throughput metrics** — triager decisions per day, overturn rates, and queue aging to staff triage capacity.
0078. **Coverage analytics** — which assets, endpoints, and CWE classes have been hunted recently versus never, highlighting blind spots.
0079. **Hunt cost accounting** — compute and API spend per hunt, program, and team with budget alerts and chargeback reports.
0080. **Quota management** — per-team monthly hunt-hour and finding-export quotas with soft warnings and hard caps.
0081. **Usage analytics dashboard** — active researchers, hunts per week, engine usage mix, and feature adoption for platform admins.
0082. **Executive risk posture view** — CISO-level rollup of open criticals, risk trend, program coverage, and benchmark comparisons.
0083. **Board-ready report generator** — one-click quarterly security posture decks with charts, narrative, and remediation progress.
0084. **Compliance mapping** — findings mapped to SOC 2, ISO 27001, PCI DSS, and HIPAA controls for audit evidence packs.
0085. **Audit evidence export** — timestamped bundle of findings, remediations, and attestations formatted for auditor review.
0086. **Data residency controls** — per-org region pinning for hunt data, reports, and logs with residency attestation.
0087. **Data retention policies** — configurable retention per data class with automatic purging and legal-hold overrides.
0088. **Right-to-erasure workflow** — researcher data deletion requests processed with dependency checks and completion certificates.
0089. **PII redaction in reports** — automatic detection and redaction of PII in PoC evidence before report sharing or export.
0090. **Evidence vault** — encrypted storage of raw PoC artifacts with access logging and per-finding retention rules.
0091. **Chain-of-custody log** — every evidence access recorded with who, when, and why for legal defensibility.
0092. **Legal hold mode** — freeze deletion and export for selected hunts or findings during investigations with custodian notifications.
0093. **Two-person rule for exports** — sensitive exports require a second approver before download links are issued.
0094. **IP allowlisting** — restrict platform access to corporate IP ranges or VPN egress with per-org enforcement.
0095. **Session management console** — admins view and revoke active sessions per user with device and location details.
0096. **API key scopes and rotation** — least-privilege scopes per key, automatic rotation schedules, and last-used auditing.
0097. **Service accounts** — non-human identities for CI and automation with scoped tokens and ownership attribution.
0098. **Break-glass access** — emergency admin access with mandatory justification, time limits, and post-hoc review tickets.
0099. **Privileged action logging** — admin operations like role changes and exports logged separately with alerting on anomalies.
0100. **Security contact directory** — per-program and per-asset security contacts with escalation order for urgent disclosures.
