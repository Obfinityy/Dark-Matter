# Post-hunt workflows (52005–53004)
52005. **Keyboard-driven triage queue** — Navigate, accept, dismiss, or escalate every finding with single-key shortcuts so a full hunt can be triaged without touching the mouse.
52006. **Severity-ranked triage inbox** — Findings land pre-sorted by a blended severity × exploitability × confidence score so reviewers always start with what matters most.
52007. **Progressive-disclosure reading cards** — Each finding opens as a one-line summary that expands into evidence, PoC, and remediation in stages, preventing cognitive overload on large hunts.
52008. **Vuln-class grouped inbox view** — Collapse all findings of the same weakness class (e.g., all XSS) into one group with per-instance drill-down for pattern-speed review.
52009. **Affected-asset grouped triage** — Pivot the inbox by asset or endpoint so an owner can review everything touching their service in one pass.
52010. **Inline evidence preview pane** — View HTTP request/response pairs, screenshots, and payloads inside the triage list without opening a separate detail page.
52011. **AI-generated finding TL;DR** — A two-sentence plain-English summary sits atop every technical finding so non-specialist reviewers grasp impact instantly.
52012. **Read/unread tracking per finding** — Mark findings read as reviewers scroll, with a persistent "12 of 48 reviewed" progress bar across sessions.
52013. **Saved triage filters** — Save filter combinations (e.g., "Critical + unauthenticated + payments") as named views reusable across hunts.
52014. **Triage checklist per finding** — A configurable checklist (reproduced? in scope? impact confirmed?) that must be ticked before a finding can be marked reviewed.
52015. **Confidence badges on findings** — Each finding shows the agent's confidence (High/Medium/Low) with the top two reasons, guiding how much scrutiny it deserves.
52016. **"Needs more evidence" flag** — Reviewers can flag a thin finding back to the agent, which then runs a targeted evidence-gathering pass and re-presents it.
52017. **Similar-findings sidebar** — While reading one finding, see linked similar findings from this and past hunts to spot duplicates and systemic issues.
52018. **Triage timer with analytics** — Track seconds spent per finding and surface team averages to identify bottlenecks in the review flow.
52019. **Quick-action hover bar** — Hovering any finding reveals one-click Accept / False-positive / Escalate / Assign buttons without opening it.
52020. **Review delegation (post-hunt)** — Reassign a subset of findings to a teammate with a note, keeping an audit trail of who reviewed what.
52021. **Exploitability-first sorting** — Sort the inbox by real-world exploitability score rather than raw CVSS, pushing theoretical issues down.
52022. **EPSS percentile badges** — Show each finding's EPSS exploitation-probability percentile inline to prioritize what attackers actually use.
52023. **Data-sensitivity badges** — Findings touching PII, payment data, or secrets get a visual badge reflecting the data classification at risk.
52024. **Regulatory mapping tags** — Each finding auto-tags relevant frameworks (PCI DSS, HIPAA, GDPR) so compliance reviewers can filter instantly.
52025. **Reading-time estimates** — Show "≈3 min review" per finding based on evidence length, helping reviewers plan triage sessions.
52026. **Distraction-free reading mode** — A full-screen, minimal-chrome view for reviewing one finding at a time with nothing else on screen.
52027. **Swipe-to-triage on mobile** — Swipe right to accept, left to dismiss findings from the phone app during commutes or on-call.
52028. **Voice notes on findings** — Record a spoken note attached to a finding; it is transcribed and stored alongside text comments.
52029. **Inline collaborator comments** — Threaded comments anchored to specific evidence lines, with @mentions that notify the right person.
52030. **Triage SLA countdown** — Each finding shows time remaining against its severity-based review SLA, turning red when breached.
52031. **Auto-prioritization rules** — User-defined rules (e.g., "auth bypass on prod = P0") that auto-tag and route findings as they arrive.
52032. **Custom triage columns** — Add, reorder, and resize inbox columns (owner, SLA, asset, tags) like a spreadsheet, saved per user.
52033. **Pinned findings** — Pin key findings to the top of the inbox so they stay visible while the rest of the queue is worked.
52034. **Starred findings for follow-up** — Star findings into a personal "revisit later" list without changing their triage state.
52035. **Handoff notes between reviewers** — Attach a structured handoff summary when passing a half-triaged hunt to another reviewer.
52036. **Severity override with audit log** — Change a finding's severity with a mandatory reason; the original score and override history remain visible.
52037. **Inline CVSS calculator** — Adjust CVSS vectors on the finding itself and watch the score and severity update live.
52038. **Impact estimator widget** — Answer three questions (data exposed? auth required? user interaction?) to get a plain-language impact statement.
52039. **Affected-user count estimate** — Show the estimated number of users or records exposed per finding, derived from endpoint traffic hints.
52040. **Triage session autosave** — Partial triage progress (filters, scroll position, open cards) restores exactly after logout or crash.
52041. **Review history timeline (post-hunt)** — Every view, comment, state change, and override on a finding appears in a chronological audit trail.
52042. **Multi-select finding comparison** — Select two or three findings to view their evidence and scores side by side for duplicate or chaining analysis.
52043. **Inbox dashboard widgets** — Embeddable counts (open criticals, unreviewed, SLA breaches) for team dashboards and wallboards.
52044. **Triage reminders** — Nudge reviewers with pending queues via in-app, email, or chat at configurable intervals.
52045. **Offline triage queue (post-hunt)** — Download a hunt's findings, triage on a plane, and sync decisions when back online with conflict resolution.
52046. **Duplicate collapse suggestions** — The inbox proposes which findings are likely duplicates and offers one-click merge with evidence union.
52047. **Cross-hunt findings explorer** — Search and filter findings across every hunt ever run from one unified inbox view.
52048. **Triage queue per team** — Findings auto-route into per-team queues based on asset ownership mapping.
52049. **Screen-reader accessible triage** — Full keyboard and screen-reader support with semantic landmarks so every reviewer can triage independently.
52050. **Finding annotation on screenshots** — Draw boxes and arrows on PoC screenshots to highlight the vulnerable element for developers.
52051. **Evidence chain viewer** — Step through multi-request exploit chains as a numbered sequence with per-step request/response.
52052. **"Explain like I'm new" toggle (post-hunt)** — Rewrite any finding's technical detail into beginner-friendly language with a glossary of terms.
52053. **Triage performance leaderboard** — Opt-in team stats on findings reviewed and accuracy, gamifying thorough review.
52054. **Review templates per vuln class (post-hunt)** — Pre-filled review checklists tailored to XSS, SQLi, auth issues, etc., applied automatically.
52055. **Bulk-select in inbox** — Checkbox multi-select directly in the triage list feeding all bulk actions.
52056. **Triage heatmap** — Visual map of which assets and vuln classes dominate the hunt, clickable to filter the inbox.
52057. **Finding relationship graph (post-hunt)** — Graph view linking findings by shared endpoint, parameter, or exploit chain for systemic review.
52058. **"First look" guided tour** — A first-time-per-hunt walkthrough highlighting the top 5 findings and how to triage them.
52059. **Reviewer workload balancer** — Auto-distribute unreviewed findings across reviewers based on current queue sizes.
52060. **Triage export of decisions** — Export who decided what and when as a CSV for audits and retrospectives.
52061. **Comment reactions (post-hunt)** — Emoji reactions on finding comments for lightweight agreement without new threads.
52062. **Finding watchers (post-hunt)** — Subscribe to updates on specific findings; get notified on state, comment, or evidence changes.
52063. **Triage inbox API** — Full REST access to queue, filters, and review actions so teams can build custom triage tooling.
52064. **Structured FP reason picker** — Marking false positive requires choosing from a taxonomy (not reproducible, out of scope, expected behavior, test artifact, duplicate of known issue) plus optional notes.
52065. **Free-text FP justification requirement** — High-severity dismissals require a written justification of at least a sentence, stored permanently.
52066. **Evidence-linked FP marking** — Attach the specific evidence snippet (e.g., the WAF block page) that proves the false positive, viewable by auditors.
52067. **FP confidence score** — The agent scores how likely each finding is an FP; reviewers sort by it to clear obvious FPs first.
52068. **"Marked by / when" attribution** — Every FP dismissal shows who marked it and when, with one-click contact for questions.
52069. **FP feedback loop to learning engine** — Each confirmed FP with its reason is fed back as labeled training data to reduce that FP class in future hunts.
52070. **Auto-suggested FP reason** — Based on patterns from past dismissals, the UI pre-selects the most likely FP reason for one-click confirm.
52071. **FP rate per vulnerability class** — Dashboard showing which vuln classes produce the most FPs, guiding engine tuning and reviewer expectations.
52072. **FP rate per target** — Track FP rates per asset to identify noisy targets that need scope or config adjustments.
52073. **FP leaderboard per detection engine** — Rank engines/models by FP rate so teams can choose or tune the cleanest pipeline.
52074. **One-click FP unmark** — Reversing an FP dismissal restores the finding to its prior state with the reversal logged.
52075. **Two-reviewer FP approval** — Dismissing Critical/High findings as FP requires a second reviewer's approval before it takes effect.
52076. **Bulk FP marking with shared reason** — Select dozens of same-pattern findings and dismiss them all under one documented reason.
52077. **FP reason templates** — Saved justification snippets ("WAF blocks this payload class — verified via manual replay") for one-click reuse.
52078. **"Teach the agent" button** — On FP marking, optionally record a 30-second explanation the agent uses to adjust future detection.
52079. **FP analytics dashboard** — Trends, top reasons, top reporters of FPs, and time-to-dismiss metrics in one view.
52080. **FP quarantine vs delete** — Dismissed FPs go to a quarantine list (excluded from reports but recoverable) rather than being deleted.
52081. **FP exclusion footnotes in reports** — Exported reports list dismissed FPs in an appendix with reasons, keeping the record complete.
52082. **FP dispute workflow** — Any team member can challenge an FP dismissal, reopening it into a "disputed" state for re-review.
52083. **FP SLA tracking** — Measure time from finding creation to FP decision, with targets per severity.
52084. **FP trend charts over hunts** — See whether FP rates are improving hunt-over-hunt as the learning loop takes effect.
52085. **Per-finding FP probability badge** — A small "72% likely FP" badge computed from historical dismissal patterns for that signature.
52086. **FP reason search** — Full-text search across all FP justifications to find precedent ("how did we justify this last time?").
52087. **Cross-hunt FP pattern detection** — Automatically surface recurring FP signatures across hunts and propose a standing rule.
52088. **User-defined auto-FP rules** — Create rules like "dismiss reflected XSS where payload appears only in a JSON error field" applied to future hunts.
52089. **Per-target FP allowlist** — Maintain an allowlist of known-benign behaviors per target so they never surface as findings again.
52090. **FP rule versioning** — Every auto-FP rule keeps a version history with diffs and rollback, so bad rules can be reverted.
52091. **FP rule sandbox testing** — Test a new FP rule against historical hunts to preview what it would have dismissed before enabling.
52092. **Shared team FP rules** — Publish FP rules to the team library with ownership and review dates.
52093. **FP false-negative guard** — Randomly sample a small percentage of auto-dismissed FPs for human spot-check to catch over-aggressive rules.
52094. **FP confidence threshold setting** — Configure the auto-dismiss threshold per severity (e.g., never auto-dismiss Criticals).
52095. **FP auto-expiry** — Time-boxed FP dismissals (e.g., "valid for 90 days") that resurface the finding pattern for re-review afterward.
52096. **FP tags** — Tag dismissals (waf-blocked, test-data, third-party) for sliced analytics.
52097. **FP digest email** — Weekly summary of what was dismissed as FP and why, sent to security leads for oversight.
52098. **FP reopen on target change** — If the target's code or config changes, expired or related FP dismissals are flagged for re-validation.
52099. **FP inheritance to future hunts** — Confirmed FP patterns automatically apply to the next hunt on the same target.
52100. **FP heatmap by endpoint** — Visual heatmap showing which endpoints generate the most false positives.
52101. **"Same as previous FP" one-click** — When a finding matches a previously dismissed FP, apply the same reason in one click.
52102. **FP review queue** — A dedicated queue of pending FP decisions for leads, separate from the main triage inbox.
52103. **FP bulk import** — Import FP decisions from external reviews (spreadsheets, auditors) with reason mapping.
52104. **FP custom reason fields** — Admins can extend the FP reason taxonomy with org-specific categories.
52105. **FP notification to hunt owner** — Alert the hunt requester when their findings are dismissed as FP, with the reason visible.
52106. **FP changelog per finding** — Every FP mark, unmark, reason edit, and dispute appears in the finding's history.
52107. **Screenshot attach on FP justification** — Attach proof screenshots (e.g., manual retest showing no issue) to the dismissal record.
52108. **"Likely FP — needs human check" state** — A distinct state for agent-suspected FPs that keeps them visible until a human confirms.
52109. **FP training-data export** — Export labeled FP/TP pairs in ML-ready format for custom model fine-tuning.
52110. **FP stats on team dashboard** — Widget showing this week's FP count, top reasons, and dismissals pending second review.
52111. **FP reason analytics by reviewer** — See which reviewers dismiss most and their overturn rate, for coaching and calibration.
52112. **FP review calibration sessions** — Built-in workflow for teams to jointly review a sample of FPs and align on standards.
52113. **FP impact on agent scoring** — FP rates feed the agent's quality scorecard, visible per model and engine version.
52114. **FP pattern clustering** — Group similar FP dismissals into clusters to reveal systemic detection weaknesses at a glance.
52115. **FP audit export for compliance** — One-click export of all FP decisions with who/when/why for auditor evidence packs.
52116. **FP by detection engine** — Filter FP analytics by the engine that produced the finding to target tuning efforts.
52117. **FP comment threads** — Discuss a dismissal with the marker before it becomes final, avoiding silent disagreements.
52118. **"Not a vuln but hardening note" middle state** — Dismiss as FP but keep a hardening recommendation attached so the insight isn't lost.
52119. **FP severity-downgrade alternative** — Instead of full dismissal, downgrade severity with reason (e.g., Critical → Low, "requires admin").
52120. **FP notification digest controls** — Choose which FP events trigger notifications to avoid alert fatigue.
52121. **FP rules impact simulator** — Preview how a proposed FP rule would affect open findings before it goes live.
52122. **FP decision export with evidence** — Export dismissed FPs bundled with their justification evidence for external review.
52123. **Per-finding retest request** — Request a targeted retest of a single finding with one click from its detail page.
52124. **Retest after fix deployed** — Mark a finding "fix deployed" to auto-queue a verification retest of that exact vulnerability.
52125. **Retest with mutated payloads** — Retests replay the original PoC plus agent-generated mutations to catch incomplete fixes.
52126. **Scheduled retest** — Book a retest for a future date/time (e.g., after the next release train) with automatic reminders.
52127. **Retest queue dashboard** — See all pending, running, and completed retests with status, owner, and ETA in one view.
52128. **Retest scope picker** — Limit a retest to specific endpoints, parameters, or payload classes instead of re-running everything.
52129. **Retest report diff** — Retest results render as a diff against the original finding: fixed, still vulnerable, or changed behavior.
52130. **Retest cost estimate** — Show estimated agent compute/time before confirming a retest request.
52131. **Retest priority levels** — Mark retests as urgent/normal/low to order the queue by business need.
52132. **One-click retest from triage** — A retest button directly in the triage quick-action bar for findings with thin evidence.
52133. **"Needs more evidence" auto-retest** — Findings flagged as thin-evidence automatically enter a retest flow that gathers deeper proof.
52134. **Retest with a different brain** — Re-run the check using an alternate model/engine to get an independent second opinion.
52135. **Retest stealth-mode toggle** — Run verification retests in low-noise mode for production targets with sensitive monitoring.
52136. **Retest concurrency limits** — Cap simultaneous retests per target to avoid overwhelming staging or production.
52137. **Retest completion notifications** — Notify the requester (and watchers) when a retest finishes, with the verdict in the message.
52138. **Retest history per finding** — Every retest attempt on a finding is logged with date, payload used, and outcome.
52139. **Retest SLA tracking (post-hunt)** — Track request-to-verdict time against per-severity targets and alert on breaches.
52140. **Bulk retest requests** — Select many findings (e.g., all Highs on an asset) and queue retests for all of them at once.
52141. **Retest request templates** — Saved retest configurations (scope, stealth, brain) for one-click reuse.
52142. **Retest on deploy webhook** — Auto-trigger retests of open findings when a deployment event fires for the target.
52143. **Retest approval workflow** — Require lead approval for retests against production targets before they run.
52144. **Retest budget caps** — Monthly caps on retest compute with warnings at 80% and hard stops configurable per team.
52145. **Retest evidence refresh** — Retests capture fresh request/response evidence, replacing stale PoC data with current proof.
52146. **Retest across environments** — Run the same verification against staging and production and compare outcomes side by side.
52147. **Off-hours retest windows** — Schedule retests only inside defined maintenance windows for sensitive targets.
52148. **Retest rate-limit awareness** — Retest engine respects observed rate limits and backs off automatically to avoid IP blocks.
52149. **Retest dry-run preview** — Preview exactly which requests a retest would send before executing, for change-control approval.
52150. **Retest with authenticated session** — Supply or reuse stored credentials so retests cover authenticated attack surface.
52151. **Retest session replay** — Replay the original hunt's exact request sequence for deterministic before/after comparison.
52152. **Retest parameter sweep** — Expand a retest to neighboring parameters and inputs around the original finding.
52153. **Retest depth setting** — Choose shallow (confirm fix) vs deep (re-explore the area) verification modes.
52154. **Retest engine selection** — Pick which detection engines participate in the retest, e.g., only the one that found it.
52155. **Retest execution logs** — Full step-by-step logs of what the retest agent did, viewable for audit and debugging.
52156. **Retest failure alerts** — If a retest errors out (target down, auth expired), alert immediately with the failure reason.
52157. **Retest assignment** — Assign retest execution oversight to a specific team member with due dates.
52158. **Retest vs regression distinction** — UI clearly separates single-finding retests from full regression hunts with different workflows.
52159. **"Still vulnerable" escalation** — If a retest shows the issue persists after a claimed fix, auto-escalate to the assignee and their manager.
52160. **Verification certificate** — Generate a signed "verified fixed on <date>" certificate per finding for compliance evidence.
52161. **Retest sign-off** — Formal sign-off step where a human approves the retest verdict before the finding closes.
52162. **Retest comments and attachments** — Discuss retest outcomes and attach manual verification notes or screenshots.
52163. **CI-integrated retest** — Trigger retests from CI pipelines via API and gate merges on "no reopened findings."
52164. **Retest API** — Programmatic request/status/cancel endpoints for retests to embed in custom workflows.
52165. **Retest from PDF report** — Deep links in exported PDFs that open the finding and offer one-click retest.
52166. **Retest on bounty-status change** — When a platform marks a submission "needs retest," auto-create the retest request.
52167. **Retest reminders** — Nudge assignees when a requested retest sits unexecuted past its scheduled window.
52168. **Retest analytics** — Fix-verification rates, retest turnaround, and "still vulnerable" rates per team and asset.
52169. **Chained-finding retest** — Retest all findings in an exploit chain together to verify the chain is fully broken.
52170. **Retest with proxy capture** — Route retest traffic through a logging proxy and attach the capture to the finding.
52171. **Retest evidence diff highlighting** — Highlight exactly what changed in responses between original and retest evidence.
52172. **Bulk retest by severity** — Queue retests for every open finding at or above a chosen severity in one action.
52173. **Bulk retest by asset** — Queue retests for all open findings on selected assets after an infra change.
52174. **Retest request export** — Export the retest queue (what, why, when, status) as CSV for status meetings.
52175. **Retest duplicate detection** — Warn when a retest request duplicates one already queued or recently completed for the same finding.
52176. **Retest auto-trigger on WAF change** — If monitoring detects a WAF rule change on the target, auto-queue retests for previously WAF-blocked findings.
52177. **Retest notification preferences** — Per-user control over which retest events (queued, started, completed, failed) trigger notifications.
52178. **Retest queue reordering** — Drag-and-drop reprioritization of pending retests by leads.
52179. **Retest scoped to fix commit** — Tie a retest to a specific code commit so verification is pinned to exactly what was deployed.
52180. **Retest evidence retention policy** — Configure how long retest evidence is kept, with automatic cleanup of old captures.
52181. **Retest verdict confidence** — Each retest verdict carries a confidence level, flagging inconclusive results for manual review.
52182. **Executive-summary PDF export** — One-page-per-hunt PDF with risk score, top findings, and remediation status, branded for leadership.
52183. **Technical deep-dive PDF** — Full-evidence PDF with every request/response, PoC steps, and CWE references for engineers.
52184. **Per-finding PDF export** — Generate a standalone PDF for a single finding to attach to tickets or bounty submissions.
52185. **Evidence-free PDF variant** — Export a PDF with findings and remediation but no raw payloads, safe for wider distribution.
52186. **Watermarked PDFs** — Apply "Confidential — <viewer>" watermarks to PDFs for traceability when shared externally.
52187. **Password-protected PDFs** — Encrypt exported PDFs with a password, with the password delivered via a separate channel option.
52188. **Digitally signed PDFs** — Sign export PDFs with an org certificate so recipients can verify authenticity.
52189. **Branded report letterhead** — Apply company logo, colors, and footer to all PDF exports via a branding profile.
52190. **Versioned JSON full dump** — Complete hunt data (findings, evidence, triage, lifecycle) as schema-versioned JSON for pipelines.
52191. **Per-finding JSON export** — Single-finding JSON for feeding individual issues into automation.
52192. **SIEM-ready JSON format** — Flattened JSON mapping finding fields to common SIEM schemas (ECS/CEF-friendly).
52193. **Findings CSV export** — Spreadsheet-friendly CSV with one row per finding and configurable columns.
52194. **Custom CSV column picker** — Choose exactly which fields appear in CSV exports and save the layout as a preset.
52195. **Excel pivot-ready CSV** — CSV with normalized, denormalized rows (one per affected asset) optimized for pivot tables.
52196. **SARIF 2.1.0 export** — Standards-compliant SARIF so results import into GitHub code scanning and other SARIF consumers.
52197. **Per-run SARIF files** — Split SARIF output per hunt run for repos that track one scan per commit.
52198. **GitHub code-scanning upload helper** — One-click package plus instructions to upload SARIF results to GitHub code scanning.
52199. **HTML report export** — Self-contained, styled HTML report with collapsible findings for sharing without the app.
52200. **Markdown report export (post-hunt)** — Clean Markdown for wikis, Notion, and developer docs.
52201. **DOCX report export** — Word-format report for clients and auditors who require editable documents.
52202. **Nessus-style XML export** — XML in a scanner-compatible shape for importing into legacy vuln-management tools.
52203. **JUnit XML for CI** — Findings as test cases (failures) so CI pipelines can gate on hunt results.
52204. **Filtered-subset export** — Export only the currently filtered findings (e.g., "open Criticals on payments") in any format.
52205. **Selected-findings-only export** — Export exactly the checked findings, in list order, for targeted reports.
52206. **Triage-state-aware export** — Include triage decisions, reviewers, and timestamps as columns/sections in exports.
52207. **FP-reason-inclusive export** — Dismissed findings appear in an appendix with their documented reasons.
52208. **Remediation-status export** — Exports carry fix state, assignee, and verification verdict per finding.
52209. **Scheduled exports (post-hunt)** — Auto-generate and email/SFTP exports on a schedule (e.g., weekly CSV to GRC).
52210. **Export to S3 / Google Drive** — Push generated reports directly to cloud storage buckets or shared drives.
52211. **Export API endpoint** — Generate any export format programmatically with a single API call for automation.
52212. **Export templates (post-hunt)** — Saved export configurations (format, filters, branding) reusable in one click.
52213. **Multi-language exports** — Generate reports in the stakeholder's language (Hindi, Spanish, etc.) from templates.
52214. **Redacted export mode** — Strip secrets, PII, and raw payloads automatically for external-safe exports.
52215. **Severity-threshold export** — Export only findings at or above a chosen severity.
52216. **Delta export (new since last)** — Export only findings created or changed since a previous export or date.
52217. **PoC bundle ZIP export** — Each finding's curl/Python PoC plus evidence packaged as a downloadable ZIP.
52218. **Evidence attachments export** — Bulk-download all screenshots and captures with a manifest CSV.
52219. **Audit-log export (post-hunt)** — Export the full decision history (who did what when) as CSV/PDF for compliance.
52220. **Comment-thread export** — Include all discussion threads in long-form exports for context preservation.
52221. **Lifecycle-history export** — Per-finding state-transition timelines included in detailed exports.
52222. **Comparison-data export** — Export before/after diff datasets for external analysis.
52223. **Chart PNG/SVG export** — Download dashboard charts as images for slides and docs.
52224. **PDF table of contents** — Auto-generated clickable TOC in long PDF reports.
52225. **Remediation checklist appendix** — PDF appendix listing every finding as a checkbox item for fix tracking meetings.
52226. **PGP-encrypted export** — Encrypt export files with a recipient's PGP key for secure handoff.
52227. **Export retention policy** — Auto-expire generated export files after N days to limit stale copies.
52228. **Export versioning** — Every generated export is versioned and retrievable; re-exports don't silently overwrite.
52229. **Export completion notifications** — Notify when a large export finishes generating, with a download link.
52230. **Large-hunt export chunking** — Split huge hunts into multiple files (e.g., per 500 findings) to keep exports manageable.
52231. **Export progress indicator** — Live progress bar for long-running export generation jobs.
52232. **Export retry on failure** — Failed exports retry automatically with backoff and alert if still failing.
52233. **Export history log** — Record of every export generated: who, when, format, filters, and file hash.
52234. **One-click export presets** — Buttons like "Exec pack," "Engineer pack," "Auditor pack" that bundle the right formats and filters.
52235. **Jira-compatible CSV export** — CSV shaped to Jira's bulk-import format with field mapping preview.
52236. **STIX 2.1 export for threat intel** — Findings as STIX observables for sharing with threat-intel platforms.
52237. **CVSS vector string export** — Include raw CVSS vector strings per finding for scoring-system interoperability.
52238. **CWE mapping export** — Every finding's CWE IDs exported in a machine-readable mapping file.
52239. **Export with custom cover page** — Upload a cover-page template (engagement details, tester, dates) applied to PDF exports.
52240. **Export approval workflow (post-hunt)** — Require lead approval before external-format exports (PDF/DOCX) can be generated for client hunts.
52241. **Expiring share links (post-hunt)** — Generate links to hunt results that auto-expire after a set duration, with optional one-time-view mode.
52242. **Password-protected share links** — Add a password to shared result links, delivered out-of-band.
52243. **Role-based link permissions** — Share links with view-only, comment, or triage-edit roles enforced per link.
52244. **Per-finding share links** — Share a single finding (not the whole hunt) via a scoped link for focused discussion.
52245. **Team workspaces (post-hunt)** — Group hunts, findings, and members into workspaces with shared permissions and activity feeds.
52246. **Email invite to results** — Invite teammates by email; they land directly on the shared hunt view after signup/login.
52247. **SSO group-synced sharing** — Map identity-provider groups to workspace roles so access follows HR systems automatically.
52248. **Share to Slack channel** — Post hunt summaries with top findings and a link to a chosen Slack channel via webhook.
52249. **Share to Microsoft Teams** — Adaptive-card summary of hunt results posted to a Teams channel.
52250. **Share to Discord webhook** — Formatted hunt summary with severity breakdown sent to a Discord channel.
52251. **Embeddable results widget** — Iframe widget showing live hunt stats for intranet dashboards and status pages.
52252. **Public vs private link toggle** — Explicit control distinguishing internal links from public ones, with warnings on public.
52253. **Share-link access logs** — See who opened a shared link, when, and from where, for sensitive-result tracking.
52254. **Instant link revocation** — Kill a share link immediately; already-loaded sessions are invalidated.
52255. **Filtered-view sharing** — Share a link that opens with specific filters applied (e.g., only open Highs).
52256. **External client portal** — A stripped-down, branded portal where clients see only their hunts with no app navigation.
52257. **NDA-gated share links** — Require clicking through an NDA acceptance screen before the shared results display.
52258. **Summary-only sharing** — Share counts, risk score, and remediation stats without exposing individual finding details.
52259. **Redacted sharing mode** — Shared views automatically hide secrets, payloads, and PII while keeping impact descriptions.
52260. **Threaded comments on shared views** — External viewers can comment (if permitted) in threads tied to findings.
52261. **@mention notifications** — Mentioning a teammate in a comment notifies them via their preferred channel.
52262. **Shared-view activity feed** — Chronological feed of views, comments, and decisions visible to workspace members.
52263. **Share analytics** — Dashboard of share-link opens, unique viewers, and most-viewed findings.
52264. **One-click copy link** — Copy a correctly permissioned share link with expiry from any hunt or finding page.
52265. **QR code for share links** — Generate a QR code for a result link for war-room screens and printed reports.
52266. **Share via email composer** — In-app email composer that sends a formatted summary with the link and optional PDF.
52267. **Role templates** — Predefined permission sets (Viewer, Reviewer, Remediator, Admin) applied in one click.
52268. **Time-boxed guest access (post-hunt)** — Grant external guests access that automatically expires at engagement end.
52269. **IP-restricted share links** — Limit shared-link access to corporate IP ranges for sensitive hunts.
52270. **Comparison-view sharing** — Share before/after diff views with stakeholders via dedicated links.
52271. **Remediation-board sharing** — Share the kanban fix-tracking board with engineering leads separately from findings.
52272. **Live shared triage sessions** — Multiple reviewers triage the same hunt simultaneously with presence cursors and live updates.
52273. **Presence indicators** — See who else is viewing a hunt right now to avoid duplicate review work.
52274. **Shared saved filters** — Publish useful filter views to the team library for consistent triage.
52275. **Shared FP rule library** — Team-wide false-positive rules with owners and review dates.
52276. **Shared hunt templates (post-hunt)** — Publish proven hunt configurations for the whole team to reuse.
52277. **Share to Jira/Asana/Linear** — Push findings as tickets with deep links back to the finding detail page.
52278. **Share manifest export** — Export a record of everything shared externally: what, with whom, when, under what permission.
52279. **Per-viewer watermarking** — Overlay the viewer's email on shared finding views to deter screenshot leaks.
52280. **Screenshot-deterrence notice** — Display a banner on sensitive shared views reminding viewers of confidentiality terms.
52281. **Bounty-collaborator sharing** — Share specific findings with co-researchers under a collaboration agreement scope.
52282. **Multi-team hunt sharing** — Share one hunt across teams with per-team filtered views and separate comment spaces.
52283. **Share notification center** — Central inbox of "X shared Y with you" events with accept/decline.
52284. **Link preview cards** — Rich unfurls (title, severity counts, risk score) when a share link is pasted in chat tools.
52285. **Share to Notion/Confluence** — Embed live finding tables or summaries into wiki pages that stay updated.
52286. **Shared digest emails** — Periodic team email summarizing shared hunts' new activity.
52287. **Mobile-friendly shared views** — Shared links render cleanly on phones for on-call reviewers.
52288. **Link expiry extension** — Extend an expiring share link's lifetime without regenerating and resending it.
52289. **Share approval workflow** — Require a lead's approval before results can be shared outside the workspace.
52290. **Delegated sharing rights** — Allow hunt owners to grant specific members permission to create share links.
52291. **Share-link usage quotas** — Cap the number of active external links per workspace to control exposure.
52292. **Custom link slugs** — Human-readable share URLs (e.g., /s/acme-q3-review) instead of random tokens.
52293. **Branded share pages** — Apply org logo and colors to externally shared result pages.
52294. **Shared team dashboard** — A workspace homepage aggregating all shared hunts, queues, and SLAs.
52295. **Share finding to chat** — Send a finding card with key details directly into the team's chat tool of choice.
52296. **Granular finding-field permissions** — Control per-role visibility of fields (e.g., reviewers can't see bounty estimates).
52297. **Share-link two-factor gate** — Require an emailed one-time code before opening highly sensitive shared results.
52298. **Shared-view print mode** — Clean print stylesheet for shared views used in meetings.
52299. **Share access request flow** — "Request access" button on denied links, routed to the hunt owner for approval.
52300. **HackerOne draft generator** — Auto-compose a HackerOne-formatted report (summary, steps, impact) from any finding.
52301. **Bugcrowd draft generator** — Auto-compose a Bugcrowd-formatted submission with its required fields pre-filled.
52302. **Intigriti draft generator** — Auto-compose an Intigriti-formatted report matching their submission template.
52303. **YesWeHack draft generator** — Auto-compose a YesWeHack-formatted submission from finding data.
52304. **Per-platform field mapping** — Map finding fields to each platform's schema so drafts need minimal editing.
52305. **Platform severity auto-mapping** — Convert internal severity/CVSS to each platform's scale (e.g., HackerOne's) automatically.
52306. **One-click copy formatted report** — Copy the platform-formatted writeup to clipboard with markdown intact.
52307. **Approval-gated API submission** — Submit drafts to platforms via API only after a human approves the exact payload.
52308. **Submission draft status tracking** — Track each draft: draft → submitted → triaged → resolved → paid, synced where APIs allow.
52309. **Pre-submission checklist** — Platform-specific checklist (scope verified, duplicates checked, evidence attached) before submit.
52310. **Duplicate check before submit** — Search the platform's disclosed reports and your history for likely duplicates first.
52311. **Platform scope validation** — Verify the finding's asset is in the program's current scope before drafting.
52312. **Bounty estimate display** — Show the program's historical payout range for the vuln class to set expectations.
52313. **Auto-attached PoC files** — Bundle curl/Python PoCs and evidence files as submission attachments automatically.
52314. **Screenshot attachment pack** — Collect annotated screenshots into a single attachment set for the submission.
52315. **Video PoC attachment** — Attach screen-recorded PoC videos with platform file-size handling.
52316. **CVSS-to-platform severity** — Translate the computed CVSS vector into the platform's severity with explanation.
52317. **CWE auto-tagging** — Tag submissions with CWE IDs from the finding's classification.
52318. **Affected-asset auto-fill** — Populate the submission's asset field from the finding's endpoint data.
52319. **Steps-to-reproduce formatter** — Numbered, minimal, copy-pasteable reproduction steps generated from the PoC trace.
52320. **Impact statement generator** — Draft a business-impact paragraph tailored to the finding and target.
52321. **Remediation suggestion insert** — Append a concise, correct fix recommendation to every submission draft.
52322. **Researcher handle branding** — Apply the researcher's handle and profile links consistently across drafts.
52323. **Batch draft creation** — Generate drafts for multiple findings at once, grouped per platform.
52324. **Submission queue (post-hunt)** — Ordered list of pending submissions with priority, owner, and scheduled send times.
52325. **Platform inbox sync** — Pull report statuses and triager messages from platform APIs into the finding timeline.
52326. **Status-change sync** — When a platform marks a report triaged/duplicate/informative, update the finding's lifecycle automatically.
52327. **Bounty-paid tracking** — Record payouts per finding and roll up earnings per hunt, program, and researcher.
52328. **Safe-harbor verification** — Check the program's safe-harbor terms and warn before submitting edge-case findings.
52329. **Out-of-scope warning** — Hard warning (with override reason) if the finding's asset isn't in program scope.
52330. **PII scrub before submit** — Automatically redact any PII or secrets captured in evidence before it leaves the org.
52331. **Internal review before submit** — Route drafts through an internal reviewer queue before they can be submitted.
52332. **Submitter approval chain** — Multi-step approval (researcher → lead → legal) configurable per program sensitivity.
52333. **Submission history log** — Immutable log of every submission attempt: what was sent, when, by whom, and the response.
52334. **Resubmission after fix** — One-click draft for retesting notes when a platform asks for fix verification.
52335. **Platform message templates** — Canned, professional replies for common triager questions and status updates.
52336. **Triager-question draft replies** — AI-drafted responses to triager questions, grounded in the finding's evidence, awaiting human send.
52337. **Mediation escalation draft** — Draft a mediation request with the full evidence trail when a report is unfairly closed.
52338. **Disclosure timeline tracker (post-hunt)** — Track agreed disclosure dates per report with reminders before they lapse.
52339. **Coordinated disclosure scheduler** — Schedule public disclosure writeups aligned with the vendor's fix release.
52340. **CVE request draft** — Generate a CVE assignment request with the required technical details pre-filled.
52341. **Submission analytics (post-hunt)** — Acceptance rate, median time-to-triage, and payout stats per platform and researcher.
52342. **Per-platform acceptance stats** — See which platforms accept your report styles best to tune future drafts.
52343. **Draft versioning** — Keep every draft revision so edits and reviewer changes are traceable.
52344. **Collaborative draft editing** — Multiple researchers co-edit a submission draft with change tracking.
52345. **Platform credential vault** — Store platform API tokens encrypted, scoped per researcher, never shown in plaintext.
52346. **Test-mode submission** — Validate a draft against platform APIs in sandbox/test mode without creating a real report.
52347. **Submission dry-run validation** — Pre-flight checks (attachments size, required fields, scope) with fix-it hints before sending.
52348. **Platform rate-limit handling (post-hunt)** — Queue submissions to respect per-platform API limits with automatic retry.
52349. **Submission notifications** — Notify the researcher on every status change pulled from the platform.
52350. **Platform webhook receiver** — Accept inbound webhooks from platforms to update finding statuses in real time.
52351. **Bounty earnings leaderboard** — Team leaderboard of bounties earned, with per-program and per-quarter breakdowns.
52352. **Bounty tax-report export** — Export annual earnings per researcher with dates and programs for tax reporting.
52353. **Duplicate-merge before submit** — Merge duplicate findings into one submission with combined evidence and affected assets.
52354. **Program discovery** — Search connected platforms for programs matching your targets and alert on new scope.
52355. **Scope-diff alerts** — Notify when a tracked program's scope changes (assets added/removed) affecting your drafts.
52356. **Submission SLA monitor** — Track platform response times against their stated SLAs and flag stalled reports.
52357. **Report-quality score** — Score each draft on completeness (evidence, impact, repro) before submission to raise acceptance rates.
52358. **Platform-specific disclosure check** — Verify the draft complies with each platform's disclosure policy before sending.
52359. **Finding lifecycle state machine** — Configurable states (New → Triaged → Confirmed → Assigned → Fixing → Verifying → Closed) with enforced transitions.
52360. **Custom lifecycle states** — Add org-specific states (e.g., "Pen-test review") with colors, icons, and rules.
52361. **State transition rules** — Define which transitions are legal (e.g., can't go Verified → New) to keep lifecycles clean.
52362. **Per-role state permissions** — Control who can move findings into sensitive states like Closed or Risk Accepted.
52363. **State-change audit log** — Immutable record of every state change with actor, timestamp, and reason.
52364. **State-change notifications (post-hunt)** — Notify watchers and assignees instantly when a finding they follow changes state.
52365. **Bulk state transitions** — Move many findings to a new state at once with a shared reason and confirmation preview.
52366. **State SLA timers** — Per-state time targets (e.g., Triaged within 48h) with breach alerts.
52367. **Lifecycle dashboard** — Counts and aging per state, per team, per severity, in one kanban-style view.
52368. **State timeline per finding** — Visual timeline of a finding's journey from discovery to closure.
52369. **Mandatory state-change reasons** — Require a reason note for key transitions (closing, risk-accepting) to preserve context.
52370. **State undo** — Revert an accidental state change within a grace window, fully restoring prior metadata.
52371. **"Needs info" state** — Park findings awaiting more data (from agent, reporter, or vendor) without losing them.
52372. **"Duplicate" state with link** — Mark duplicates while linking to the canonical finding, merging evidence automatically.
52373. **"Won't fix" state with reason** — Close with documented rationale (e.g., "legacy system, sunset in Q1") and approver.
52374. **"Risk accepted" state** — Formal risk-acceptance with owner, expiry date, and compensating controls noted.
52375. **"Deferred" state with date** — Postpone to a specific future date; the finding auto-reopens for review then.
52376. **"Blocked" state with reason** — Flag findings blocked on external dependencies (vendor patch, third party) with the blocker noted.
52377. **"Verified" vs "Closed" distinction** — Separate technical verification (fix works) from administrative closure (paperwork done).
52378. **"Reopened" state** — Distinct state for regressions with a link to the original closure for root-cause analysis.
52379. **Auto-transitions on retest** — A passing verification retest auto-moves the finding to Verified; a failing one reopens it.
52380. **State-transition webhooks** — Fire webhooks on state changes to sync external systems (ticketing, chatops).
52381. **Lifecycle API (post-hunt)** — Full programmatic control of states, transitions, and history for custom integrations.
52382. **State-based smart views** — Auto-generated views like "Stuck in Triaged > 7 days" or "Verifying now."
52383. **State-based email rules** — Trigger emails on entering/exiting states (e.g., daily "newly verified" digest).
52384. **State-based export filters** — Export exactly the findings in chosen states for status reports.
52385. **State aging reports** — Show how long findings sit in each state to find process bottlenecks.
52386. **Stuck-in-state alerts** — Proactive alerts when findings exceed state SLAs, escalating to managers.
52387. **Transition approval gates** — Require approval for high-impact transitions (e.g., closing a Critical).
52388. **State history export** — Export per-finding state timelines for audits and retrospectives.
52389. **State analytics** — Funnel analysis: how many findings reach each state and where they drop off.
52390. **Per-severity state rules** — Different SLAs and approval gates for Critical vs Low findings.
52391. **Terminal-state configuration** — Define which states count as "done" for reporting and archiving rules.
52392. **AI-suggested next state** — Recommend the most likely next state based on finding data and history, one click to apply.
52393. **State-transition checklists** — Required checks before key transitions (e.g., "evidence of fix attached" before Verified).
52394. **State-gated actions** — Block actions until prerequisites are met (can't mark Verified without a retest record).
52395. **State change mobile approval** — Approve pending transitions from the phone app with full context.
52396. **Lifecycle documentation** — Auto-generated docs describing your configured states, rules, and SLAs for onboarding.
52397. **State prediction** — ML estimate of time-to-close per finding based on similar historical findings.
52398. **State-based prioritization** — Boost priority of findings stuck in early states past their SLA.
52399. **Jira two-way state sync** — Map lifecycle states to Jira statuses and keep both systems in sync automatically.
52400. **Bounty-platform state sync** — Reflect platform report statuses (triaged, resolved) in the finding lifecycle.
52401. **Agent-suggested transitions** — The agent proposes state moves with reasoning; humans approve in one click.
52402. **State diagram visualization** — Render your configured lifecycle as an interactive diagram for training and audits.
52403. **Bulk state import** — Import state assignments from CSV for migrations from legacy trackers.
52404. **State migration tool** — Remap states when reconfiguring the lifecycle, with preview of affected findings.
52405. **Archived-finding states** — Preserve final states on archived findings for accurate historical reporting.
52406. **State search** — Find findings by current or past states ("was ever Risk Accepted").
52407. **State-based assignment rules** — Auto-assign findings when they enter states (e.g., entering Fixing assigns the asset owner).
52408. **Lifecycle throughput leaderboard** — Team stats on findings moved to terminal states per week, opt-in and anonymized options.
52409. **State transition comments** — Inline discussion on the transition itself, separate from general finding comments.
52410. **Scheduled state reviews** — Recurring calendar of findings in non-terminal states for leads to review.
52411. **State-based dashboard widgets** — Embeddable state counts and aging charts for status pages.
52412. **Fix assignment** — Assign each confirmed finding to an owner with role-based suggestions from asset mapping.
52413. **Fix due dates** — Per-severity default due dates, adjustable per finding, with calendar integration.
52414. **Fix verification retest link** — Every assigned fix carries a one-click "verify with retest" action for the fixer.
52415. **Remediation kanban board** — Drag findings across To fix / Fixing / Verifying / Done columns with WIP limits.
52416. **Per-finding fix notes** — Structured notes on what was changed (files, commits, config) attached to the finding.
52417. **Code commit linking** — Link fix commits (GitHub/GitLab) to findings; show diff stats inline.
52418. **One-click regression hunt** — Launch a regression hunt scoped to previously vulnerable endpoints from the remediation board.
52419. **Regression scope auto-builder** — Build regression scope from all open or recently fixed findings on a target automatically.
52420. **Deploy-triggered regression** — Webhook from CI/CD auto-starts a regression hunt when code ships to the target.
52421. **Cron-scheduled regression hunts** — Recurring hunts on a cron expression with timezone-aware scheduling.
52422. **Regression diff report** — Every regression hunt ends with a fixed / still-vulnerable / new-finding diff against baseline.
52423. **Regression cadence presets** — One-click weekly, bi-weekly, or monthly regression schedules per target.
52424. **Post-fix verification scheduling** — When a fix is marked deployed, auto-schedule its verification retest.
52425. **Regression hunt templates** — Saved regression configurations (depth, engines, scope rules) reusable across targets.
52426. **Regression notifications** — Alert owners when a regression starts, finishes, and what the verdict is.
52427. **Regression auto-compare** — Automatically diff regression results against the original hunt without manual setup.
52428. **Regression cost estimate** — Show estimated time/compute before launching a regression hunt.
52429. **Quick vs full regression depth** — Choose a fast check (known findings only) or full re-exploration per run.
52430. **Engine-pinned regression** — Re-run with the exact engine/model versions of the original hunt for apples-to-apples comparison.
52431. **New-engine regression** — Optionally include newly released engines to catch what older runs missed.
52432. **Cross-environment regression** — Run the regression against staging and production in one job and compare.
52433. **Regression queue** — Central queue of scheduled and pending regression hunts with priorities and owners.
52434. **Regression calendar view** — Calendar showing all upcoming regression hunts across targets.
52435. **Pause/resume scheduled hunts** — Temporarily halt a recurring regression without deleting its configuration.
52436. **Skip-if-no-change** — Skip a scheduled regression when change detection shows the target hasn't changed.
52437. **Target change-detection trigger** — Fingerprint the target; auto-trigger regression when tech stack or content shifts.
52438. **Git-push regression trigger** — Start a scoped regression when pushes touch watched repos/paths.
52439. **CI pipeline regression trigger** — API-driven regression starts from Jenkins/GitHub Actions/GitLab CI jobs.
52440. **Scheduled hunt naming conventions** — Auto-name recurring hunts ("acme-prod weekly #12") for easy history browsing.
52441. **Scheduled hunt ownership** — Assign an owner to each recurring schedule for accountability.
52442. **Scheduled hunt permissions** — Control who can create, edit, or pause recurring hunts per workspace.
52443. **Regression report auto-send** — Email the diff report to stakeholders automatically after each regression.
52444. **Regression SLA tracking** — Track time from fix-deploy to verified-fixed across regressions.
52445. **Regression history timeline** — Per-target timeline of every regression run with verdicts.
52446. **Regression analytics** — Fix success rates, mean time to verify, and regression-caught reintroductions per team.
52447. **Bulk schedule creation** — Apply the same regression schedule to many targets at once.
52448. **Schedule-from-triage** — Right-click a triaged finding to schedule its regression verification.
52449. **Schedule-from-remediation-board** — Drag a "fixing" card to a calendar date to schedule its verification.
52450. **Blackout windows** — Define no-hunt periods (peak sales, holidays) that scheduled hunts respect.
52451. **Timezone-aware scheduling (post-hunt)** — Schedules display and fire in the target's local timezone with DST handling.
52452. **Concurrency limits** — Cap simultaneous scheduled hunts to protect shared targets and budgets.
52453. **Budget caps for scheduled hunts** — Monthly compute caps with warnings and auto-pause on exceed.
52454. **Scheduled-hunt dry run** — Preview scope, engines, and estimated requests before the first scheduled run.
52455. **Scheduled-hunt run logs** — Full logs per scheduled execution for debugging missed or failed runs.
52456. **Schedule failure alerts (post-hunt)** — Immediate alert if a scheduled hunt fails to start or errors out.
52457. **Retry policy for scheduled hunts** — Configurable retries with backoff for transient failures.
52458. **Schedule templates (post-hunt)** — Reusable schedule blueprints (cadence, depth, notifications) applied to new targets.
52459. **Event-triggered schedules** — Fire regressions on events like certificate renewal or DNS changes.
52460. **FP spot-check regression** — Periodically re-validate a sample of FP-dismissed patterns to catch rule drift.
52461. **Regression scope-diff preview** — Show what the next regression will cover vs the last run before it starts.
52462. **Auto-archive old regressions** — Archive regression runs older than N months, keeping only their diff summaries.
52463. **Regression comparison dashboard** — Side-by-side verdicts of the last N regressions per target.
52464. **"All clear" certificate** — Generate a signed certificate when a regression finds zero open issues.
52465. **Schedule-via-API** — Create and manage recurring hunts programmatically.
52466. **Schedule-via-chat** — Tell the agent "regression every Monday at 2am" and it configures the schedule.
52467. **Regression reminders** — Remind owners before a scheduled regression and nudge if targets are unreachable.
52468. **Regression digest email** — Periodic summary of all regression outcomes across targets.
52469. **Multi-target regression campaigns** — Group regressions across an asset portfolio into one campaign with unified reporting.
52470. **PR linking for fixes** — Link pull requests to findings; show PR status (open/merged) on the remediation card.
52471. **Fix diff viewer** — View the actual code diff of a linked fix commit without leaving the finding page.
52472. **Verification evidence panel** — Retest evidence displayed alongside the fix notes for one-glance verification.
52473. **"Verified fixed" badge** — Prominent badge on findings that passed verification retest, with date and verifier.
52474. **Fix SLA per severity** — Configurable fix deadlines (Critical: 7d, High: 30d...) with breach escalation.
52475. **SLA breach alerts (post-hunt)** — Escalating notifications (assignee → lead → manager) as fix SLAs approach and pass.
52476. **Remediation progress percentage** — Per-hunt and per-target % of findings fixed and verified, shown on dashboards.
52477. **Before/after hunt diff view (post-hunt)** — Visual diff of two hunts: new, fixed, persistent, and severity-changed findings.
52478. **Target A vs target B compare** — Compare two different targets' hunts to benchmark security posture.
52479. **New-findings highlight** — In diffs, new findings get a prominent badge with "first seen" timestamps.
52480. **Fixed-findings highlight** — Celebrate remediated findings in diffs with fix dates and linked commits.
52481. **Persistent-findings list** — Findings present in both hunts, flagged with age to spotlight long-ignored issues.
52482. **Severity migration tracking** — Show findings whose severity changed between hunts and why (rescore, new evidence).
52483. **Diff summary counts** — Header stats: +12 new, −8 fixed, 34 persistent, 3 severity changes.
52484. **Side-by-side finding cards** — Compare the same finding across two hunts with evidence and scores adjacent.
52485. **Endpoint coverage diff** — Show which endpoints were covered in each hunt to explain finding differences.
52486. **Attack-surface diff** — Diff the discovered tech stack, subdomains, and parameters between hunts.
52487. **Risk-score trend line** — Chart the target's overall risk score across every hunt over time.
52488. **Multi-hunt overlay** — Overlay three or more hunts to see long-term trajectories, not just pairs.
52489. **Regression delta report** — Auto-generated PDF of the regression diff for stakeholders.
52490. **Diff export** — Download the comparison dataset as CSV/JSON for external analysis.
52491. **Shareable diff links** — Send stakeholders a link that opens the exact comparison view.
52492. **Diff filters** — Filter comparisons by severity, state, vuln class, or asset.
52493. **Diff by vulnerability class** — See which vuln classes grew or shrank between hunts.
52494. **Diff by asset** — Per-asset new/fixed/persistent breakdowns for owner accountability.
52495. **Visual diff charts** — Bar and donut charts contrasting finding distributions across hunts.
52496. **Field-level finding diff** — Highlight exactly which fields changed on a persistent finding (status, severity, evidence).
52497. **Evidence diff** — Side-by-side old vs new proof for findings whose evidence changed.
52498. **False-positive delta** — Track FP counts and rates across hunts to measure detection-quality improvement.
52499. **Remediation delta** — Fixed-and-verified counts between hunts with MTTR trends.
52500. **Coverage-map diff** — Visual map of crawled endpoints in hunt A vs hunt B.
52501. **Time-to-detect comparison** — Compare how quickly each hunt surfaced its critical findings.
52502. **Engine performance comparison** — Which engines found what in each hunt, for pipeline tuning.
52503. **Model A vs model B comparison** — Compare hunts run with different brains to evaluate model upgrades.
52504. **Hunt config comparison** — Diff the configurations (depth, payloads, scope) of two hunts.
52505. **Payload-count comparison** — Requests sent, payloads tried, and efficiency (findings per 1k requests) per hunt.
52506. **Duration comparison** — Hunt runtimes side by side with phase breakdowns.
52507. **Cost comparison** — Compute/time cost per hunt and cost per confirmed finding.
52508. **Target maturity score trend** — Composite maturity score (coverage, fix rate, FP rate) tracked over hunts.
52509. **Comparison dashboard** — Saved comparison views with all charts in one place.
52510. **Scheduled comparison reports (post-hunt)** — Auto-email monthly before/after comparisons to stakeholders.
52511. **Comparison annotations (post-hunt)** — Add notes to a comparison ("v2.4 deploy introduced 3 XSS") for future context.
52512. **AI "what changed" summary** — Natural-language summary of the meaningful differences between two hunts.
52513. **Change attribution (post-hunt)** — Link new findings to likely causes (deploy, config change, new feature) via timeline correlation.
52514. **Diff API** — Programmatic access to hunt comparisons for custom dashboards and gates.
52515. **Diff webhooks** — Fire webhooks with comparison results for CI gates ("fail build if new Criticals").
52516. **Comparison templates (post-hunt)** — Saved comparison setups (hunt pairs, filters, charts) for recurring reviews.
52517. **Saved comparisons** — Bookmark comparisons to revisit later without reconfiguring.
52518. **New-critical comparison alerts** — Alert immediately when a comparison reveals a new Critical not in the baseline.
52519. **Trend forecasting (post-hunt)** — Project future finding counts and risk scores from historical hunt trajectories.
52520. **Seasonality analysis (post-hunt)** — Detect patterns like post-release finding spikes across hunt history.
52521. **Triage-decision comparison** — Compare how two hunts' findings were triaged to spot reviewer inconsistency.
52522. **FP-rate comparison** — Hunt-over-hunt FP rates to validate detection improvements.
52523. **MTTR comparison across hunts** — See whether remediation is getting faster per target.
52524. **Bounty-outcome comparison** — Compare acceptance rates and payouts across hunts per program.
52525. **Staging vs production compare** — Diff staging and production hunts to catch environment drift issues.
52526. **Feature-branch compare** — Compare a branch-targeted hunt against main to gate merges.
52527. **Acquisition target compare** — Benchmark a newly acquired asset's hunt against your portfolio baseline.
52528. **Vendor comparison** — Compare hunts across third-party vendors' assets for procurement decisions.
52529. **Comparison PDF export (post-hunt)** — Branded PDF of the full comparison for board and client distribution.
52530. **Comparison CSV export (post-hunt)** — Tabular diff data for analysts and auditors.
52531. **Benchmark vs industry (post-hunt)** — Contextualize your hunt metrics against anonymized industry aggregates.
52532. **Benchmark vs own history** — Every comparison shows the target's historical best/worst for context.
52533. **Comparison of triage SLAs** — See whether review speed improved between hunts.
52534. **"Hunt replay" comparison** — Re-run the old hunt's scope with current engines to isolate engine vs target changes.
52535. **Executive comparison one-pager** — Auto-generated single-page summary of any comparison for leadership.
52536. **One-click hunt archive** — Archive a completed hunt with all data, preserving full fidelity for later restore.
52537. **Auto-archive by age** — Automatically archive hunts older than a configurable threshold (e.g., 12 months).
52538. **Auto-archive when all fixed** — Archive hunts whose findings are all closed/verified, keeping the summary visible.
52539. **Archive storage location choice** — Choose local disk, S3, or cold storage per archive policy.
52540. **Archive compression** — Compress archived hunt data (evidence, logs) to minimize storage footprint.
52541. **Archive encryption at rest** — Encrypt archives with org-managed keys for sensitive engagement data.
52542. **Archive metadata search** — Search across archives by target, date, severity counts, and tags without restoring.
52543. **One-click archive restore** — Bring an archived hunt back to full interactive state with re-indexing.
52544. **Archive summary preview** — View key stats and top findings of an archived hunt without a full restore.
52545. **Archive retention policies** — Define per-workspace retention (keep 2 years, then purge) with legal overrides.
52546. **Legal hold on archives** — Place litigation holds that block deletion or auto-purge of specific archives.
52547. **Archive access permissions** — Separate permission set for viewing/restoring archives vs active hunts.
52548. **Export-before-delete** — Require generating a final export bundle before an archive can be permanently deleted.
52549. **Archive vs delete distinction** — Clear UI separation: archiving preserves data, deleting destroys it, with different confirmations.
52550. **Bulk archive (post-hunt)** — Archive many hunts at once with shared reason and retention settings.
52551. **Archive tags** — Tag archives (q3-audit, client-acme, baseline) for organized retrieval.
52552. **Archive reason notes** — Record why a hunt was archived for future context.
52553. **Archive dashboard** — Overview of all archives: size, age, retention status, and restore activity.
52554. **Archive storage usage meter** — Track bytes per workspace with projections and cleanup suggestions.
52555. **Archive cost estimator** — Show storage cost implications before choosing archive tiers.
52556. **Cold-storage tiering** — Move old archives to cheaper cold storage automatically by policy.
52557. **Archive integrity checksums** — Hash every archive and verify integrity on restore to detect corruption.
52558. **Archive versioning** — If a hunt is re-archived, keep versions so nothing is silently overwritten.
52559. **Archive audit log** — Record every archive, restore, export, and delete action with actor and timestamp.
52560. **Read-only archived view** — Browse archived hunts in a clearly marked read-only mode without restoring.
52561. **Archive notifications** — Notify owners before auto-archive and after restore operations.
52562. **Archive approval workflow** — Require lead approval to archive hunts with open Critical findings.
52563. **Archive associated files** — Include PoC bundles, exports, and attachments in the archive package.
52564. **Separate evidence archiving** — Tier large evidence blobs to cheap storage while keeping metadata hot.
52565. **Partial archive option** — Archive findings and reports but drop raw traffic logs to save space.
52566. **Archive templates** — Saved archive configurations (what to include, retention, tier) applied in one click.
52567. **Scheduled archive sweeps** — Nightly job applying auto-archive rules with a preview report.
52568. **Cross-archive search** — Full-text search across all archived hunts' findings from one search box.
52569. **Archive analytics** — Trends in hunt volume, archive growth, and restore frequency.
52570. **Compliance retention mapping** — Map archive retention to regulatory requirements (e.g., PCI 1-year log retention).
52571. **Archive redaction option** — Redact secrets/PII during archiving for long-term safe storage.
52572. **Limited archive sharing** — Share an archived hunt's summary with external parties without restoring it.
52573. **Duplicate-archive detection** — Warn when archiving a hunt that duplicates an existing archive.
52574. **Archive naming conventions** — Auto-name archives consistently (target-date-id) with customizable patterns.
52575. **Archive folder structure** — Organize archives in browsable folders by client, year, or target.
52576. **Archive API** — Programmatic archive/restore/search for data-lifecycle automation.
52577. **Archive webhooks** — Notify external systems on archive, restore, and purge events.
52578. **Pre-archive review reminder** — Prompt owners to review open items before a scheduled auto-archive.
52579. **Archive restore request flow** — Team members can request a restore; owners approve with one click.
52580. **Archive ownership transfer** — Reassign archive ownership when team members leave.
52581. **Archive migration tool** — Move archives between storage backends without data loss.
52582. **Per-team archive stats** — Storage and retention metrics broken down by team.
52583. **Archive quota management** — Per-workspace archive quotas with warnings and cleanup workflows.
52584. **Archive cleanup suggestions** — AI-suggested archives safe to purge based on age, duplication, and policy.
52585. **Archive "time capsule" summary** — Auto-written narrative summary capturing what mattered in the hunt.
52586. **Linked-hunt preservation** — Archiving a hunt preserves links to its regressions and comparisons.
52587. **Chat transcript archiving** — Include mid-hunt and post-hunt agent Q&A transcripts in the archive.
52588. **Agent reasoning-trace archiving** — Preserve the agent's decision traces for future research and audits.
52589. **Report snapshot in archive** — Store the exact PDF/exports generated at archive time for immutability.
52590. **Archive restore testing** — Periodic automated test-restores proving archives are actually recoverable.
52591. **Archive export manifest** — Manifest listing every file in an archive with hashes for chain-of-custody.
52592. **Archive expiry warnings** — Warn owners 30/7/1 days before retention expiry and purge.
52593. **Archive search filters** — Filter archives by date range, target, severity profile, and tags.
52594. **Archive restore with re-index** — Restored hunts are fully re-indexed for search, diff, and analytics.
52595. **Auto email on hunt completion** — Send a formatted summary email to stakeholders the moment a hunt finishes.
52596. **Customizable email templates** — HTML email templates with drag-and-drop sections and variable placeholders.
52597. **Executive summary email** — Short, jargon-free email: risk score, critical count, what needs decisions.
52598. **Engineer detail email** — Technical email with top findings, endpoints, and links to full evidence.
52599. **Email with PDF attached** — Auto-attach the appropriate PDF (exec or technical) to the summary email.
52600. **Link-only email option** — Send just a secure link instead of details for sensitive hunts.
52601. **Severity-threshold emails** — Only send immediate emails if findings meet a severity bar; otherwise digest.
52602. **Scheduled digest emails (post-hunt)** — Daily/weekly rollups of hunt activity across targets per subscriber.
52603. **Per-team digest** — Each team gets a digest covering only their assets' hunts.
52604. **Per-stakeholder digest** — Executives, engineers, and auditors each get a digest tuned to their view.
52605. **Top-5 findings email** — Email spotlighting the five highest-risk findings with one-line impacts.
52606. **Remediation-stats email** — Weekly email on fix progress: fixed, verified, overdue, MTTR.
52607. **Trend sparkline in email** — Tiny inline charts showing risk-score and finding-count trends.
52608. **Plain-text and HTML versions** — Every email ships both, with the plain-text version fully readable.
52609. **Email branding** — Org logo, colors, and footer applied to all hunt emails.
52610. **Reply-to configuration** — Set reply-to addresses so responses route to the security team inbox.
52611. **Localized email language** — Generate emails in the recipient's preferred language.
52612. **Action buttons in email** — Approve, assign, or open-finding buttons embedded directly in the email.
52613. **Email read tracking (opt-in)** — Optional open/click tracking to confirm stakeholders saw critical summaries.
52614. **Unsubscribe management (post-hunt)** — Per-digest-type unsubscribe with one click and preference center.
52615. **Per-user email preferences** — Choose which hunt events trigger emails vs in-app only.
52616. **SLA-breach escalation emails** — Automatic escalation emails as triage and fix SLAs breach.
52617. **Regression "all clear" email** — Celebratory, signed email when a regression verifies zero open issues.
52618. **New-critical alert email** — Immediate email when a hunt or regression surfaces a new Critical.
52619. **False-positive oversight digest** — Periodic summary of false-positive dismissals for lead oversight.
52620. **Bounty payout email** — Notify researchers when platform payouts are recorded for their findings.
52621. **Weekly security-posture email** — Portfolio-level summary: hunts run, risk trends, top risks, fix velocity.
52622. **Monthly trend email** — Month-over-month charts with narrative on what's improving or degrading.
52623. **External client email** — Client-safe summary email with redacted content and branded portal link.
52624. **Redacted-content email mode** — Automatically strip payloads and secrets from any externally addressed email.
52625. **Email encryption option** — S/MIME or PGP-encrypted emails for sensitive summaries.
52626. **Email delivery logs** — Per-email send/deliver/bounce/open log for troubleshooting.
52627. **Email failure auto-retry** — Retry failed sends with backoff and alert admins on persistent failure.
52628. **Test-send email** — Preview any template by sending a test to yourself with sample data.
52629. **Template variable library** — Documented list of all available placeholders (hunt name, counts, links).
52630. **Conditional email sections** — Show/hide template blocks based on data (e.g., only if Criticals > 0).
52631. **Embedded charts in email** — Render severity donuts and trend sparklines as inline images.
52632. **CSV attachment option** — Attach the findings CSV alongside the summary for analysts.
52633. **Team-activity digest email** — Summarize comments, state changes, and decisions across shared hunts.
52634. **Pending-triage email** — "You have 14 findings awaiting review" nudges with direct links.
52635. **Pending-fixes email** — Assignees get their overdue and upcoming-due fixes listed weekly.
52636. **Pre-hunt notification email** — Warn stakeholders before a scheduled hunt runs against production.
52637. **Post-regression email** — Automatic diff summary email after every regression completes.
52638. **Archive notice email** — Inform owners before auto-archive with a "keep active" opt-out link.
52639. **Share-link access email** — Notify owners when someone opens a sensitive shared link.
52640. **Email timezone display** — All times rendered in the recipient's timezone with clear labels.
52641. **Calendar invite for review meeting** — One-click .ics invite for the post-hunt review meeting with agenda attached.
52642. **Email signature configuration** — Org-wide and per-user signatures for hunt-related emails.
52643. **Email allowlist/blocklist** — Control which domains can receive hunt emails to prevent leaks.
52644. **Email throttling** — Rate-limit outbound hunt emails to avoid spam-flagging and alert fatigue.
52645. **API-triggered email** — Send any hunt email template programmatically via API.
52646. **Custom sending domain** — Send from security@yourcompany.com with DKIM/SPF setup guidance.
52647. **Email preview pane** — See exactly how a template renders with real hunt data before enabling.
52648. **Template A/B testing (post-hunt)** — Try two summary formats and measure open/action rates.
52649. **Email analytics dashboard** — Open rates, click-throughs, and action-button conversions per template.
52650. **Quiet-hours email policy** — Hold non-urgent emails until business hours per recipient timezone.
52651. **Email threading (post-hunt)** — Keep all emails about one hunt in a single thread via consistent subjects and headers.
52652. **Reply-by-email triage** — Reply "accept" or "false positive" to a finding email to record the decision.
52653. **Email-to-finding deep links** — Every finding mentioned in an email links directly to its live detail page.
52654. **Executive dashboard view** — One-screen view: portfolio risk score, trend, top 5 risks, fix velocity, no jargon.
52655. **Engineer technical view** — Full evidence, payloads, reproduction steps, and code-level fix guidance.
52656. **Auditor compliance view** — Findings mapped to controls (SOC 2, ISO 27001, PCI DSS) with evidence trails.
52657. **Client-facing view** — Polished, redacted summary suitable for sharing with customers under NDA.
52658. **Board-slide auto-generation** — One-click PowerPoint/Google-Slides-ready slide: risk trend, criticals, remediation progress.
52659. **Business-risk translation** — Convert technical findings into business language: "checkout fraud possible, ~$X exposure."
52660. **Dollar-impact estimates** — Estimated financial exposure per finding from data value and exploitability inputs.
52661. **Likelihood × impact matrix** — Classic risk matrix view placing each finding on likelihood/impact axes.
52662. **Remediation roadmap view** — Findings ordered into phased fix plan with effort estimates and dependencies.
52663. **Developer ticket view** — Per-repo, per-service slice showing only what each dev team must fix.
52664. **DevOps infrastructure view** — Infra-class findings (TLS, headers, misconfig) grouped for platform teams.
52665. **Product-manager view** — Feature-level risk: which product areas carry the most security debt.
52666. **Legal disclosure view** — Findings with breach-notification and disclosure obligations flagged for counsel.
52667. **Marketing-safe summary** — High-level posture statement with zero technical detail for public comms.
52668. **Role-based default views** — Each role lands on its tailored view automatically on login.
52669. **View switcher** — One-click toggle between exec/engineer/auditor/client views of the same hunt.
52670. **Saved stakeholder views** — Save customized views (filters, columns, charts) and share them with stakeholder groups.
52671. **Exec one-pager PDF** — Single-page PDF: score, trend, top risks, decisions needed — nothing else.
52672. **Engineer full-detail PDF** — Exhaustive PDF with every evidence artifact for the fix team.
52673. **Control-coverage view** — Map findings against your security controls to show which controls failed.
52674. **SLA-compliance view** — Triage and fix SLA adherence per team, per severity, with breach counts.
52675. **Trend view for executives** — Multi-quarter risk trajectory with annotations for major initiatives.
52676. **Benchmark view** — Your posture vs anonymized peers, framed for leadership context.
52677. **"What we fixed" board view** — Showcase remediated findings with dates for board and client confidence.
52678. **"What remains" view** — Open risk inventory with owners and ETAs for accountability meetings.
52679. **Per-asset-owner view** — Each service owner sees only their assets' findings and SLAs.
52680. **Per-team rollup view** — Aggregated posture per engineering team for org-level reviews.
52681. **Vendor-risk view** — Findings on third-party assets framed for vendor management conversations.
52682. **M&A diligence view** — Target company's security posture packaged for acquisition due diligence.
52683. **Cyber-insurance view** — Control attestations and finding summaries formatted for insurers.
52684. **Pen-test-equivalence view** — Present hunt results in classic pen-test report structure for clients expecting it.
52685. **Red-team narrative view** — Findings woven into an attack-story narrative for red-team debriefs.
52686. **Blue-team detection view** — Each finding paired with suggested detections, log sources, and SIEM queries.
52687. **SOC triage view** — Compact, high-density table optimized for analysts working many hunts at once.
52688. **Incident-response handoff view** — Critical findings packaged with IOCs and containment steps for the IR team.
52689. **Threat-model linkage view** — Findings mapped onto the target's threat model components to show coverage gaps.
52690. **Architecture-review view** — Findings grouped by architecture layer (edge, app, data) for architects.
52691. **API-owner view** — API-specific findings with endpoint, method, and schema context for API teams.
52692. **Mobile-team view** — Mobile-backend findings with platform notes (iOS/Android impact) for app teams.
52693. **Data-team view** — Findings touching data stores, pipelines, and warehouses for data engineering.
52694. **Privacy (DPO) view** — Findings involving personal data with GDPR/CCPA implications highlighted.
52695. **Per-stakeholder annotations** — Each view supports private annotations visible only to that stakeholder group.
52696. **Per-stakeholder comments** — Separate comment threads per view so exec discussions don't clutter engineering.
52697. **Per-stakeholder exports** — Export buttons scoped to the current view's format and redaction level.
52698. **Per-stakeholder emails** — Digest emails generated from the stakeholder's own view.
52699. **Stakeholder view permissions** — Granular control over which roles can access each tailored view.
52700. **Stakeholder view audit log** — Record who accessed which sensitive views and when.
52701. **Custom stakeholder roles** — Define new personas (e.g., "Franchise partner") with their own view templates.
52702. **Stakeholder onboarding tour** — Guided first-run tour explaining what each view shows and why.
52703. **Stakeholder FAQ per view** — Contextual FAQs answering "what does this number mean?" inside each view.
52704. **Stakeholder view analytics** — See which views stakeholders actually open to focus communication effort.
52705. **Multi-stakeholder meeting mode** — Presenter mode switching between views live during review meetings.
52706. **Live presentation mode** — Full-screen, click-through deck mode generated from any stakeholder view.
52707. **Speaker notes per view** — Private presenter notes attached to views for meetings.
52708. **Print-optimized views** — Clean print stylesheets for every stakeholder view.
52709. **Stakeholder view API** — Embed any tailored view's data into external portals programmatically.
52710. **View-level watermarks** — Apply viewer-specific watermarks on sensitive stakeholder views.
52711. **Stakeholder view scheduling** — Auto-refresh and email stakeholder views on a cadence.
52712. **Stakeholder feedback widget** — "Was this useful?" feedback on views to improve tailoring over time.
52713. **Configurable lifecycle state machine** — Visual editor for states, transitions, SLAs, and permissions without code.
52714. **New → Triaged → Confirmed flow** — Default pipeline separating fresh findings, reviewed ones, and validated ones.
52715. **Confirmed → Assigned → Fixing flow** — Handoff states from validation to ownership to active remediation.
52716. **Fixing → Verifying → Closed flow** — Final stages ensuring fixes are tested before administrative closure.
52717. **State transition guardrails** — Illegal jumps (e.g., New → Closed) are blocked with an explanation of the required path.
52718. **Per-role transition permissions** — Only leads can risk-accept; only verifiers can mark Verified.
52719. **Immutable state-change log** — Append-only history of every transition for audit-proof records.
52720. **Lifecycle transition alerts** — Real-time alerts to watchers, assignees, and reporters on transitions.
52721. **Bulk transitions with preview** — Move dozens of findings at once after previewing exactly what will change.
52722. **State SLA engine** — Automatic timers per state with breach detection and escalation paths.
52723. **Kanban lifecycle board** — Drag-and-drop board of lifecycle states with WIP limits and aging badges.
52724. **Finding state timeline** — Horizontal timeline visualizing each finding's state journey with durations.
52725. **Required transition reasons** — Enforce justification text on sensitive transitions like closing or risk-accepting.
52726. **Transition undo window** — 15-minute grace period to revert mistaken state changes.
52727. **"Awaiting info" parking state** — Explicit state for findings blocked on missing information, with follow-up reminders.
52728. **Duplicate-linking state** — Duplicates point to their canonical finding while preserving their evidence.
52729. **Risk-acceptance with expiry** — Accepted risks carry review dates; expired acceptances auto-reopen.
52730. **Deferred-to-date state** — Findings resurface automatically on their scheduled review date.
52731. **Blocked-on-vendor state** — Track findings waiting on third-party patches with vendor ticket links.
52732. **Verified vs closed separation** — Technical proof-of-fix distinct from process closure, each with its own sign-off.
52733. **Reopened-with-context state** — Regressions reopen with links to original evidence and closure notes.
52734. **Retest-driven auto-transitions** — Passing retests advance to Verified; failures move back to Fixing automatically.
52735. **Transition webhooks** — Push state changes to Slack, ticketing, and data warehouses in real time.
52736. **Lifecycle REST API** — Full CRUD on states and transitions for custom automation.
52737. **Smart state views** — Auto-built views like "In Verifying > 5 days" or "Highs stuck in Triaged."
52738. **State-triggered emails** — Email rules firing on state entry/exit (e.g., daily verified-fixed digest).
52739. **State-filtered exports** — Export slices like "everything currently in Fixing" for standups.
52740. **State aging analytics** — Average and p95 dwell time per state to find process bottlenecks.
52741. **Breach escalation chains** — Notify assignee, then lead, then director as state SLAs progressively breach.
52742. **Transition approval queues** — Pending sensitive transitions await approver action with full context.
52743. **Historical state export** — Export complete state timelines for audits and postmortems.
52744. **Lifecycle funnel analytics** — Conversion rates between states reveal where findings stall or die.
52745. **Severity-aware state rules** — Criticals get shorter SLAs and stricter approval gates than Lows.
52746. **Terminal-state definitions** — Configure which states count as resolved for metrics and archive rules.
52747. **AI next-state suggestions** — One-click recommended transitions with supporting rationale.
52748. **Pre-transition checklists** — Required confirmations (evidence attached, retest passed) before key moves.
52749. **Action gating by state** — Disable invalid actions per state (no retest requests on Closed findings).
52750. **Mobile transition approvals** — Approve or reject pending transitions from the phone with full finding context.
52751. **Lifecycle documentation generator** — Auto-generated playbook of your states, SLAs, and rules for onboarding.
52752. **Time-to-close prediction** — Estimated closure dates per finding from historical patterns.
52753. **Priority boost for stalled** — Auto-escalate priority of findings aging in early states.
52754. **Ticketing two-way sync** — Jira/Linear statuses mirror lifecycle states bidirectionally.
52755. **Platform-status sync** — HackerOne/Bugcrowd report states reflected in the finding lifecycle.
52756. **Agent-proposed transitions** — The agent suggests state moves with evidence; humans approve.
52757. **Lifecycle diagram renderer** — Interactive diagram of your configured states for training.
52758. **CSV state import** — Bulk-assign states during migration from spreadsheets or legacy tools.
52759. **State-remap migration tool** — Reconfigure states safely with a preview of every affected finding.
52760. **Preserved states on archive** — Archived findings keep final states for accurate historical metrics.
52761. **Historical state search** — Query findings by states they previously held ("was reopened twice").
52762. **Auto-assign on state entry** — Entering Fixing auto-assigns the asset owner per mapping rules.
52763. **Throughput leaderboard** — Opt-in team stats on findings advanced to terminal states.
52764. **Transition comment threads** — Discuss the transition decision separately from general comments.
52765. **Recurring state-review meetings** — Auto-generated agenda of non-terminal findings for weekly reviews.
52766. **Embeddable state widgets** — State counts and aging charts for dashboards and status pages.
52767. **Transition reason templates** — One-click standard reasons ("fix verified in prod") for common moves.
52768. **State-based assignment rotation** — Round-robin assignment as findings enter Triaged.
52769. **Cross-hunt state rollups** — Portfolio-wide counts per state for leadership reporting.
52770. **State-change digest** — Daily summary of all state movements across watched hunts.
52771. **Lifecycle compliance mapping** — Map your states to framework requirements (e.g., "remediation tracked" for SOC 2).
52772. **Inbox multi-select checkboxes** — Select findings across pages with persistent selection for bulk work.
52773. **Filter-then-select-all** — Apply filters, then select all matching findings (not just the visible page).
52774. **Bulk severity reassignment** — Change severity on many findings at once with a shared justification.
52775. **Bulk owner assignment** — Assign many findings to one owner or round-robin across a team.
52776. **Bulk tagging (post-hunt)** — Add or remove tags across selected findings in one action.
52777. **Batch lifecycle transitions** — Move a selection through a lifecycle transition with one confirmation.
52778. **Bulk FP dismissal** — Dismiss a selection as false positives under a single documented reason.
52779. **Selection-wide retest queueing** — Queue verification retests for all selected findings at once.
52780. **Bulk export (post-hunt)** — Export the selection in any format with one click.
52781. **Bulk share-link creation** — Generate one share link covering exactly the selected findings.
52782. **Bulk delete with safeguards (post-hunt)** — Delete selections only after typing confirmation and with full audit logging.
52783. **Bulk finding archival** — Archive selected findings (or hunts) with shared settings.
52784. **Bulk commenting** — Post the same comment to many findings, each keeping its own thread.
52785. **Bulk bounty-draft creation** — Generate platform submission drafts for a whole selection.
52786. **Bulk ticket linking** — Link selected findings to Jira/Linear issues in one mapping step.
52787. **Bulk due-date setting** — Set or shift due dates across the selection, respecting severity defaults.
52788. **Bulk priority override (post-hunt)** — Set priority flags on many findings for sprint planning.
52789. **Bulk watcher subscription** — Add watchers to all selected findings at once.
52790. **Bulk notification mute** — Silence notifications for a selection during bulk triage sessions.
52791. **Bulk move between hunts** — Reassign findings to the correct hunt when scope was misattributed.
52792. **Bulk duplicate merging** — Merge a selection of duplicates into one canonical finding with unioned evidence.
52793. **Bulk unmerge** — Split previously merged findings back into individuals with history preserved.
52794. **Bulk verify-fixed** — Mark a selection verified after a regression confirms all are fixed.
52795. **Mass finding reopen** — Reopen many findings (e.g., after a bad deploy) with a shared reason.
52796. **Bulk print** — Print-friendly batch output of selected findings for offline review.
52797. **Bulk ID copy** — Copy finding IDs/URLs of the selection for pasting into chats and docs.
52798. **Bulk actions API** — Script any bulk operation programmatically with job tracking.
52799. **Bulk-action undo** — Reverse a bulk operation within a grace window, restoring all prior values.
52800. **Bulk-action approval gate** — Require lead approval for destructive bulk actions (delete, mass-close).
52801. **Bulk-action dry-run preview** — Preview exactly which findings and fields a bulk action will touch before running.
52802. **Bulk-action progress bar (post-hunt)** — Live progress for large bulk jobs with per-item success/failure.
52803. **Bulk-action failure handling** — Partial failures are reported per item with retry options, never silent.
52804. **Bulk-action audit log** — Every bulk operation logged with actor, scope, and before/after values.
52805. **Bulk-action macros** — Save sequences (tag + assign + set state) as one-click macros.
52806. **Scheduled bulk actions (post-hunt)** — Run bulk operations on a schedule (e.g., nightly auto-close of verified fixes).
52807. **Bulk-action permissions** — Granular roles controlling who can run which bulk operations.
52808. **Query-based bulk select** — Select findings via search query ("severity:critical asset:payments") for bulk ops.
52809. **Saved bulk selections** — Name and reuse complex selections across sessions.
52810. **Bulk actions from search** — Run bulk ops directly on cross-hunt search results.
52811. **Bulk actions from diff view** — Select all "new Criticals" in a comparison and act on them together.
52812. **Bulk custom-field editing** — Set org-specific custom fields across the selection.
52813. **Bulk finding linking** — Mark selections as related/chained with relationship types.
52814. **Bulk unlink** — Remove relationships from a selection in one step.
52815. **Bulk evidence ZIP** — Download all evidence for the selection as one organized ZIP.
52816. **Bulk redaction** — Apply redaction rules to evidence across selected findings.
52817. **Bulk team assignment** — Route selections to teams based on asset-mapping rules.
52818. **Bulk escalation** — Escalate a selection to leads with a shared context note.
52819. **Bulk info requests** — Ask reporters/owners for more info on many findings at once.
52820. **Bulk remediation notes** — Attach the same fix guidance to a family of similar findings.
52821. **Bulk fix-version tagging** — Tag selections with the release version that contains their fixes.
52822. **Bulk commit linking** — Link one fix commit to many findings it resolves.
52823. **Bulk close with reason** — Close selections (e.g., after program end) with documented rationale.
52824. **Bulk reopen with reason** — Reopen selections sharing a cause, like a reverted patch.
52825. **Bulk assignee notification** — Notify all assignees of the selection with a custom message.
52826. **Bulk PoC bundle generation** — Generate per-finding PoC bundles for the whole selection as one ZIP.
52827. **Bulk CVE-request drafts** — Draft CVE requests for all qualifying selected findings.
52828. **Bulk SLA recalculation** — Recompute due dates after severity or policy changes.
52829. **Bulk export of decision history** — Export who-decided-what for the selection for audits.
52830. **Bulk finding split by asset** — Split a mixed selection into per-asset groups for distributed ownership.
52831. **Post-hunt Q&A chat** — Ask the agent anything about a completed hunt in a persistent chat thread.
52832. **"Why is this critical?" explainer** — One-click plain-language explanation of any finding's severity rating.
52833. **Exploit-chain walkthrough** — The agent narrates multi-step chains step by step with evidence at each hop.
52834. **"What did you try that failed?"** — Ask for dead ends and negative results to understand coverage honestly.
52835. **Coverage-gap Q&A** — "Why didn't you find X?" answered with what was tested and what wasn't.
52836. **Per-finding confidence interrogation** — Probe the agent on exactly why it's confident (or not) in a finding.
52837. **Blast-radius estimator Q&A** — "What's the worst case here?" answered with data, users, and systems at risk.
52838. **Fix-suggestion follow-ups** — Ask "how do I fix this?" for tailored remediation with code examples.
52839. **Cross-hunt comparison questions** — "How does this compare to last quarter's hunt?" answered from history.
52840. **Bounty-writeup drafting** — "Draft my HackerOne report for this" producing a submission-ready writeup.
52841. **Boss-friendly summaries** — "Explain this to my CEO" generating non-technical impact summaries.
52842. **Fix-prioritization advice** — "What should I fix first?" answered with risk-ordered, effort-aware ranking.
52843. **Auth-requirement analysis** — "Is this exploitable without login?" answered from the PoC's auth context.
52844. **Data-at-risk inventory** — "What data is exposed?" listing data types evidenced in responses.
52845. **Similar past findings lookup** — "Show me similar findings from before" with links and outcomes.
52846. **FP-justification recall** — "Why was this marked false positive?" surfacing the recorded reason and evidence.
52847. **Step-by-step PoC narration** — The agent re-explains the PoC slowly, one request at a time, on demand.
52848. **Payload anatomy Q&A** — "What payload worked and why?" with the successful input broken down.
52849. **Next-step brainstorming** — "What would you try next?" for ideas on deeper manual testing.
52850. **Regression-checklist generation** — "Give me a checklist to verify all fixes" as an actionable list.
52851. **Ticket-text drafting** — "Write the Jira ticket for this" with summary, repro, and acceptance criteria.
52852. **Finding translation** — "Translate this to Hindi/Spanish" for multilingual teams and clients.
52853. **Compliance-mapping Q&A** — "Which controls does this violate?" mapped to SOC 2/ISO/PCI clauses.
52854. **Bounty-value estimation** — "What's this worth?" estimating payout from program history and severity.
52855. **Duplicate-suspicion Q&A** — "Is this a duplicate of X?" answered by comparing evidence and root causes.
52856. **Root-cause analysis Q&A** — "What's the underlying root cause?" tracing the finding to code or config origins.
52857. **Fix-verification guidance** — "How do I verify the fix?" with concrete test steps and expected outcomes.
52858. **Test-case suggestions** — "What regression tests should I add?" generating test ideas per finding.
52859. **Three-bullet hunt summary** — "Summarize this hunt in 3 bullets" for standups and status updates.
52860. **Unauthenticated-findings list** — "List everything exploitable without auth" as a prioritized answer.
52861. **Payment-flow risk Q&A** — "Which findings affect payments?" filtering to money-movement impact.
52862. **Real-world exploitability ranking** — "Rank by actual exploitability" reordering findings beyond CVSS.
52863. **Agent learning recap** — "What did you learn from this hunt?" summarizing new patterns the agent recorded.
52864. **Reasoning-trace browser** — "Show me how you found this" revealing the agent's decision trail.
52865. **Devil's-advocate challenge** — "Challenge this finding" with the agent arguing why it might be wrong.
52866. **Fix-option comparison** — "Give me three fix options" with trade-offs (effort, risk, completeness).
52867. **Cheapest-fix finder** — "What's the fastest mitigation?" suggesting minimal-effort containment.
52868. **Disclosure-timeline drafting** — "Draft a disclosure timeline" aligned with fix estimates and policy.
52869. **Fix-owner recommendation** — "Who should own this fix?" suggesting owners from asset mapping.
52870. **Scope-eligibility check** — "Is this in scope for our HackerOne program?" verified against current scope.
52871. **Non-technical rewrite** — "Rewrite for a non-technical reader" producing jargon-free versions.
52872. **Exec-slide generation** — "Make me one slide on this hunt" with title, bullets, and chart suggestions.
52873. **PR-description drafting** — "Write the remediation PR description" linking the fix to the finding.
52874. **Detection-suggestion Q&A** — "What monitoring would catch this?" with SIEM queries and log sources.
52875. **WAF-rule suggestion** — "Suggest a WAF rule as stopgap" with tested rule syntax and caveats.
52876. **Chain-membership Q&A** — "Is this part of a bigger chain?" revealing linked findings and combined impact.
52877. **CVSS vector breakdown** — "Explain this CVSS vector" decoding each metric's meaning for the finding.
52878. **Voice Q&A with avatar** — Ask follow-up questions by voice; the avatar answers aloud with lip-sync.
52879. **Evidence-cited answers** — Every agent answer links to the specific evidence supporting it.
52880. **Q&A history per hunt** — All follow-up conversations saved and searchable alongside the hunt.
52881. **Q&A export** — Export the Q&A transcript as PDF/Markdown for meeting records.
52882. **Q&A sharing** — Share interesting Q&A threads with teammates via link.
52883. **Suggested follow-up chips** — Contextual question suggestions after each answer to guide exploration.
52884. **Multi-turn context retention** — The agent remembers earlier questions in the thread for coherent deep-dives.
52885. **Multilingual Q&A** — Ask and receive answers in the user's preferred language, including Hinglish.
52886. **Answer feedback buttons** — Rate answers helpful/not to improve future Q&A quality.
52887. **Q&A over archived hunts** — Ask questions about archived hunts; the agent answers from the archive index.
52888. **Code-context Q&A** — "Show me the vulnerable code pattern" with linked snippets when source is available.
52889. **Hunt-statistics Q&A** — "How many requests did you send?" answering operational questions about the hunt itself.
52890. **One-click hunt reopen** — Reopen a closed hunt, restoring its full interactive state instantly.
52891. **Reopen reason requirement** — Reopening requires documenting why (new intel, regression, dispute).
52892. **State-snapshot restore on reopen** — Reopening restores findings, triage decisions, and comments exactly as closed.
52893. **Reopen from archive** — Archived hunts can be reopened directly, triggering restore plus reopen in one flow.
52894. **Reopen notifications** — Notify watchers, assignees, and stakeholders when a hunt reopens.
52895. **Reopen audit log** — Every reopen records who, when, and why for compliance.
52896. **Reopen permission control** — Only authorized roles can reopen closed or archived hunts.
52897. **Reopen-vs-new guidance** — The UI advises when to reopen vs start a fresh hunt based on what's changed.
52898. **Re-index on reopen** — Reopened hunts are re-indexed so search, diff, and analytics include them.
52899. **Extended-scope reopen** — Reopen with additional scope (new subdomains, endpoints) appended to the original.
52900. **Append-new-findings on reopen** — New discoveries merge into the reopened hunt while history stays intact.
52901. **History-preserving reopen** — Closure records remain visible; reopening adds a new chapter, not a rewrite.
52902. **Reopen reason templates** — One-click reasons: "regression detected," "new threat intel," "scope expanded."
52903. **Reopen approval workflow** — Sensitive hunts require lead approval before reopening.
52904. **Bulk reopen (post-hunt)** — Reopen multiple hunts at once (e.g., after org-wide infra change).
52905. **Reopen API** — Programmatic reopen for automation and integrations.
52906. **Reopen from email link** — Deep links in notification emails offer one-click reopen to authorized users.
52907. **Reopen from comparison view** — Spot a regression in a diff and reopen the baseline hunt directly.
52908. **Threat-intel-triggered reopen** — New threat intel matching the target's stack suggests reopening with context.
52909. **Code-change-triggered reopen** — Major deploys prompt a reopen recommendation for the last hunt.
52910. **Acquisition-triggered reopen** — Newly acquired assets trigger reopen suggestions for related hunts.
52911. **Incident-triggered reopen** — A security incident auto-suggests reopening the most recent hunt on the asset.
52912. **Reopen expiry policy** — Hunts closed longer than N months require "new hunt" instead of reopen, configurable.
52913. **Fresh-engine reopen** — Reopen runs new findings through current engines while preserving old results.
52914. **Reopen cost estimate** — Show expected compute/time before confirming a reopen with new scanning.
52915. **Scheduled reopen** — Book a hunt to reopen at a future date (e.g., after a planned migration).
52916. **Reopen discussion thread** — Dedicated thread for debating whether a hunt should reopen.
52917. **Reopened-hunt badge** — Clear visual marker distinguishing reopened hunts from never-closed ones.
52918. **Reopen search filter** — Find hunts by reopen count and history for process analysis.
52919. **Reopen analytics** — Track reopen rates and reasons to identify premature closures.
52920. **Reopen-vs-regression explainer** — In-UI guidance on choosing reopen, regression hunt, or new hunt.
52921. **Share-restoration on reopen** — Previously created share links can be reactivated on reopen.
52922. **Schedule-restoration on reopen** — Paused regression schedules resume when their hunt reopens.
52923. **Ticket-link preservation** — Reopened hunts keep all Jira/Linear links intact and note the reopen there.
52924. **Stakeholder-view refresh** — Tailored views update to reflect the reopened state automatically.
52925. **Q&A context restoration** — Prior post-hunt Q&A threads reload with the reopened hunt.
52926. **Agent briefing on reopen** — The agent summarizes "what changed since close" to orient reviewers.
52927. **Auto-suggest reopen on asset change** — Detected tech-stack changes prompt a reopen recommendation.
52928. **Reopen reminders** — Remind owners of hunts marked "reopen after release" when the date arrives.
52929. **Reopen digest** — Periodic list of recently reopened hunts for leadership visibility.
52930. **Mobile reopen** — Reopen hunts from the phone app with reason and approval flow.
52931. **Triage-decision preservation** — All prior accept/FP decisions survive reopening untouched.
52932. **SLA reset option on reopen** — Choose whether reopening restarts triage/fix SLAs or continues old ones.
52933. **Close-reopen history export** — Export the full close/reopen timeline for audits.
52934. **Compliance note on reopen** — Reopening generates a compliance-friendly record of continued due diligence.
52935. **Duplicate-reopen guard** — Warn if the hunt is already open or a reopen is pending.
52936. **Reopen conflict resolution** — Handle simultaneous reopen requests gracefully with a single merged record.
52937. **Platform-status reopen** — A bounty platform reopening a report can trigger the hunt reopen flow.
52938. **FP-dispute reopen** — Successful FP disputes automatically reopen the finding within its hunt.
52939. **Researcher-appeal reopen** — Appeals from researchers route into a structured reopen review.
52940. **Reopen templates** — Saved reopen configurations (scope extensions, engines, notifications).
52941. **Reopen webhooks** — Notify external systems when hunts reopen or close.
52942. **Reopen keyboard shortcut** — Power-user shortcut to reopen with a reason dialog.
52943. **Reopen confirmation details** — Confirmation dialog shows what will be restored before committing.
52944. **Team note on reopen** — Broadcast a custom note to the team explaining the reopen.
52945. **Activity-feed reopen entry** — Reopens appear prominently in workspace activity feeds.
52946. **Reopen reason analytics** — Most common reopen reasons inform process improvements.
52947. **Post-reopen health check** — Verify data integrity after reopen and report any inconsistencies.
52948. **"Save hunt as template"** — Turn any successful hunt's configuration into a reusable template in one click.
52949. **Template captures scope** — Templates store target scope patterns, inclusions, and exclusions.
52950. **Template captures engine selection** — Which detection engines and brains the template uses, with versions.
52951. **Template captures payload profile** — Aggressiveness, payload sets, and stealth settings saved in the template.
52952. **Template captures schedule** — Default cadence and windows for hunts created from the template.
52953. **Template captures triage rules** — Auto-prioritization and routing rules bundled with the template.
52954. **Template library browser** — Searchable gallery of all hunt templates with previews and usage stats.
52955. **Team template sharing (post-hunt)** — Publish templates to the workspace with descriptions and owners.
52956. **Template versioning (post-hunt)** — Every template edit creates a version; hunts record which version they used.
52957. **Template forking (post-hunt)** — Clone and customize a template without affecting the original.
52958. **Template ratings (post-hunt)** — Users rate templates on result quality to surface the best ones.
52959. **Template usage statistics (post-hunt)** — See how often each template is used and its average finding yield.
52960. **Template preview (post-hunt)** — Inspect a template's full configuration before creating a hunt from it.
52961. **Template import/export (post-hunt)** — Share templates across workspaces or orgs as portable files.
52962. **Auto-suggest template from best hunt** — The system proposes templating your highest-yield hunt configurations.
52963. **Template categories (post-hunt)** — Organize templates by use case: baseline, regression, bounty-prep, compliance.
52964. **Template search and tags** — Find templates by keyword, tag, target type, or vertical.
52965. **Cross-target template cloning** — Apply a template proven on one target to a new target with scope remapping.
52966. **Parameterized target variables** — Templates use {{target}} placeholders so one template serves many assets.
52967. **Secrets placeholders** — Templates reference secret vault entries instead of hardcoding credentials.
52968. **Template approval workflow (post-hunt)** — New or edited templates need lead approval before team-wide use.
52969. **Template deprecation (post-hunt)** — Mark outdated templates deprecated with a suggested replacement.
52970. **Template changelog (post-hunt)** — Human-readable history of what changed in each template version.
52971. **Template diff viewer (post-hunt)** — Compare two template versions side by side before upgrading.
52972. **Template dry-run test** — Validate a template with a quick scoped dry run before real use.
52973. **Template cost estimator** — Estimated time/compute for hunts created from the template.
52974. **Vertical-specific templates** — Pre-tuned templates for fintech, healthtech, SaaS, e-commerce, and more.
52975. **Asset-type templates** — Templates optimized for REST APIs, GraphQL, SPAs, and mobile backends.
52976. **Bounty-program templates** — Templates aligned to popular program scopes and rules of engagement.
52977. **Regression templates** — Templates pre-configured for fix-verification and periodic regression.
52978. **Compliance-audit templates** — Templates mapped to SOC 2, PCI DSS, and ISO 27001 audit needs.
52979. **Template notification defaults** — Who gets emailed on completion, pre-configured per template.
52980. **Template stakeholder-view defaults** — Which tailored views and exports each template produces.
52981. **Template triage-assignment defaults** — Default owners and routing rules for findings from the template.
52982. **Template SLA defaults** — Triage and fix SLAs bundled so new hunts start governed.
52983. **Template lifecycle defaults** — Which lifecycle states and transitions template hunts use.
52984. **Bulk-apply template to targets** — Launch templated hunts across many targets in one campaign.
52985. **Org template marketplace** — Internal marketplace where teams publish and discover templates.
52986. **Template effectiveness analytics** — Findings per hunt, FP rates, and MTTR broken down by template.
52987. **AI template recommendations** — Suggest the best template for a new target based on its fingerprint.
52988. **Template auto-improvement** — Feed hunt outcomes back to refine template defaults over time.
52989. **Template scope guardrails** — Hard limits preventing templates from scanning out-of-scope assets.
52990. **Template required fields** — Enforce mandatory inputs (owner, purpose) when launching from a template.
52991. **Template creation wizard** — Guided step-by-step builder for turning a hunt into a template.
52992. **Template quick-start** — Launch a hunt from a template in under 30 seconds with smart defaults.
52993. **Template duplication detection** — Warn when creating a template nearly identical to an existing one.
52994. **Template ownership** — Clear owners responsible for keeping each template current.
52995. **Template permission levels** — Control who can view, use, or edit each template.
52996. **Template audit log (post-hunt)** — Record of template creation, edits, uses, and deprecations.
52997. **Template rollback (post-hunt)** — Revert a template to any prior version instantly.
52998. **Template pre/post hooks** — Run custom webhooks before launch and after completion of templated hunts.
52999. **Auto-generated template docs** — Each template gets readable documentation of what it does and when to use it.
53000. **Template performance badges** — Badges like "Low FP" or "Fast" earned from historical performance data.
53001. **Template sharing via link** — Share a template with another workspace through a scoped link.
53002. **Template scheduled review (post-hunt)** — Periodic reminders for owners to review and refresh aging templates.
53003. **Template retirement archive** — Retired templates archived with their history, restorable if needed.
53004. **Template-to-playbook export** — Export a template as a human-readable SOP document for manual testers.
