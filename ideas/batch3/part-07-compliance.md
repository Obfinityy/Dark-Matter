# Batch 3 — Compliance & Audit Ideas (26005–27004)

## 1. SOC 2 Evidence (26005–26104)

26005. **Timestamped access-control evidence capture** — every authentication/authorization test during a hunt auto-records pass/fail results with UTC timestamps and signed request metadata for SOC 2 CC6.1 Type II evidence.
26006. **Immutable evidence vault with SHA-256 hash chains** — stores raw hunt evidence (screenshots, HTTP transcripts, logs) in an append-only vault where each artifact's hash links to the previous one so auditors can verify nothing was altered.
26007. **Auditor read-only workspace** — grants external auditors time-boxed, read-only access to evidence, mappings, and reports with MFA, without exposing credentials or giving them edit rights.
26008. **Control-to-finding mapping engine** — automatically tags each hunt finding to the relevant SOC 2 Trust Services Criteria (CC1–CC8, A1) so deficiencies roll up into the right control areas.
26009. **Type II observation-period dashboard** — aggregates evidence collected across the full audit observation window and flags controls with insufficient coverage before the audit starts.
26010. **Exception-only control reporting** — generates a SOC 2-ready evidence package that lists only failed or exceptional controls with full traceability, keeping clean controls summarized.
26011. **Evidence freshness monitor** — tracks the age of each evidence artifact and alerts when any control's evidence will expire outside the observation period.
26012. **Dual-purpose test tagging** — marks each automated test as satisfying both design (Type I) and operating-effectiveness (Type II) evidence so one hunt run feeds both audit types.
26013. **Vendor-control evidence reuse** — pulls subservice-organization control evidence (e.g., cloud provider scans) into the vault so the auditor sees the full control stack in one place.
26014. **CC7.2 anomaly evidence capture** — automatically documents any suspicious activity detected during hunts as monitoring-evidence for CC7.2, with detection timestamps and response notes.
26015. **Change-management evidence trail** — records every target configuration change observed during hunts as CC8.1 evidence, proving unauthorized changes would be detected.
26016. **Quarterly control self-assessment scheduler** — runs automated control-effectiveness checks on a calendar and stores results as recurring Type II evidence points.
26017. **Evidence request list auto-responder** — when an auditor uploads their evidence request list, the system maps each item to existing vault artifacts and packages missing ones into a hunt plan.
26018. **Signed evidence export packages** — produces auditor downloads with a cryptographic manifest (Merkle root) so the auditor can prove the package they reviewed is byte-identical to what was exported.
26019. **Control owner attestation workflow** — routes each control's evidence to its assigned owner for sign-off before the auditor reviews, with full timestamped approval history.
26020. **Availability-criteria monitoring evidence** — for CC7/A1, continuously probes the target's uptime and incident-response behavior during hunts and stores the results as availability evidence.
26021. **Encryption-in-transit evidence collector** — documents TLS configuration tests, certificate validity, and protocol versions as CC6.7 evidence with every scan.
26022. **Logical access review evidence** — during hunts, enumerates exposed authentication endpoints and permission models to support the periodic logical-access review requirement.
26023. **Incident-response drill evidence** — simulates a security event against the target's response workflows and records the timeline as CC7.3 evidence.
26024. **Backup-and-recovery verification evidence** — tests for exposed backup files and documents recovery-relevant findings as availability-control evidence.
26025. **Multi-period trend reports** — compares control-effectiveness evidence across consecutive observation periods so management and auditors can see improvement or regression.
26026. **Evidence sampling engine** — lets auditors select a sample (e.g., 25 of 100 auth tests) and the system exports the full detail for exactly those items with chain-of-custody metadata.
26027. **Control deficiency heat map** — visualizes which Trust Services Criteria have the weakest evidence coverage so remediation targets the riskiest audit areas first.
26028. **Walkthrough-ready narratives** — auto-generates plain-English control narratives from hunt logs describing exactly how each test was performed for auditor walkthroughs.
26029. **SOC 2 scope boundary validator** — verifies the hunt stayed within the agreed system boundary and produces proof of scope compliance for the auditor.
26030. **Third-party API evidence inclusion** — captures evidence about third-party integrations tested during hunts and links it to complementary user-entity controls.
26031. **Segregation-of-duties test evidence** — probes for privilege-escalation paths that would break SoD and documents results as CC6.3 evidence.
26032. **Session-timeout verification evidence** — tests session expiration behavior and records results against CC6.1 logical-access requirements.
26033. **Audit-log completeness verification** — checks that security-relevant actions on the target generate log entries, producing CC7.2/CC7.4 evidence.
26034. **Vulnerability-management cadence evidence** — timestamps every scan run to prove the organization meets its own scanning-frequency policy for CC7.1.
26035. **Risk-assessment input pack** — summarizes hunt findings by likelihood/impact as a ready-made input to the annual SOC 2 risk assessment.
26036. **Board-ready control summary** — one-page executive view of control health across all criteria with trend arrows and auditor notes.
26037. **Evidence de-duplication engine** — recognizes when one artifact satisfies multiple control requirements and cross-references it instead of duplicating storage.
26038. **Control gap auto-remediation tickets** — converts control deficiencies into prioritized remediation tickets assigned to control owners with SLAs.
26039. **Auditor Q&A thread per control** — lets auditors ask questions on specific evidence items; answers and attachments stay attached to that control's record.
26040. **CC6.6 encryption-key evidence** — documents key-management observations (key rotation, storage) found during hunts as encryption-control evidence.
26041. **Boundary-defense evidence tests** — records firewall/WAF/edge-control test results as CC6.6 boundary-protection evidence.
26042. **Data-classification evidence tags** — tags evidence artifacts with data classifications (public/internal/confidential) to support CC6.7 data-protection narratives.
26043. **Retention-policy enforcement proof** — proves evidence retention and disposal follow the documented policy with automated deletion certificates.
26044. **Pen-test evidence reuse for SOC 2** — formally maps penetration-test findings into SOC 2 control evidence so the annual pen test doubles as audit evidence.
26045. **Subservice monitoring cadence** — schedules periodic re-verification of vendor controls and files results into the evidence vault automatically.
26046. **Control-maturity scoring** — rates each control 1–5 on maturity using evidence depth and consistency, giving auditors a quantified baseline.
26047. **Deviation log with compensating controls** — when a control fails, records the deviation plus the compensating control that covers it, in auditor-accepted format.
26048. **System-description cross-reference** — links each evidence artifact to the relevant section of the SOC 2 system description for instant auditor navigation.
26049. **Evidence collection playbook generator** — produces a step-by-step plan of which hunts/tests to run to close evidence gaps before the audit window opens.
26050. **Readiness assessment snapshot** — one-click pre-audit report estimating pass likelihood per criterion based on current evidence completeness.
26051. **CC7.4 incident-correlation evidence** — shows how hunts detect, log, and correlate security events, packaged as incident-monitoring evidence.
26052. **Password-policy enforcement evidence** — tests password complexity, lockout, and rotation behavior and files results as CC6.1 evidence.
26053. **API-access control evidence** — documents authorization tests on every API endpoint as logical-access evidence for CC6.1.
26054. **Data-backup evidence verification** — probes for backup exposure and documents backup-related controls for availability criteria.
26055. **Secure-deployment evidence** — records CI/CD and deployment-security observations as CC8.1 change-management evidence.
26056. **Evidence watermarking** — embeds invisible forensic watermarks in exported evidence so leaked auditor copies can be traced to the recipient.
26057. **Control testing calendar sync** — syncs the evidence-collection schedule with the auditor's fieldwork dates so nothing is stale on arrival.
26058. **Multi-entity control rollup** — consolidates evidence across subsidiaries or business units into one SOC 2 evidence package.
26059. **Privacy-criteria (P) evidence pack** — extends collection to the Privacy criteria (notice, choice, access) for SOC 2+ engagements.
26060. **Confidentiality-criteria (C) evidence pack** — captures data-handling and NDA-related test evidence for the Confidentiality criteria.
26061. **Processing-integrity (PI) evidence pack** — documents input-validation and processing-accuracy tests as PI1 evidence.
26062. **Evidence approval chains** — requires manager approval before evidence is marked auditor-ready, with the full chain preserved.
26063. **Control test re-performance kit** — packages enough detail (commands, payloads, timestamps) for the auditor to independently re-perform any test.
26064. **SOC 2 bridge-letter support pack** — generates gap-period evidence summaries for bridge letters between audit periods.
26065. **Complementary user-entity control (CUEC) tracker** — tracks which customer-side controls the report relies on and verifies their documented status.
26066. **Evidence version control** — keeps every revision of an evidence artifact with diffs so auditors see exactly what changed and when.
26067. **Automated criteria crosswalk** — maps SOC 2 criteria to ISO 27001/PCI controls so one evidence set feeds multiple frameworks.
26068. **Control-failure root-cause notes** — attaches analyst/root-cause notes to failed controls in a format auditors can cite.
26069. **Evidence access audit log** — records every auditor view/download of vault artifacts for the audit's own chain of custody.
26070. **Mock-audit mode** — runs an internal simulated audit against current evidence and scores readiness before the real auditors arrive.
26071. **Type I point-in-time snapshot** — freezes a complete evidence snapshot at a single date for Type I design-suitability reporting.
26072. **Continuous-auditing feed** — streams new evidence into the vault in real time so the auditor always sees current-state coverage.
26073. **Exception remediation evidence linking** — links each remediated exception to its re-test evidence, closing the loop for the auditor.
26074. **Control narrative version history** — tracks changes to control descriptions across periods with auditor-visible change logs.
26075. **Evidence completeness scorecard** — percentage-complete per criterion, updated after every hunt, with drill-down to missing items.
26076. **Auditor comment resolution tracker** — tracks each auditor comment to resolution with evidence attachments and sign-offs.
26077. **Dual-control approval evidence** — documents where sensitive actions require two-person approval as CC6.3 evidence.
26078. **Network-segmentation test evidence** — records segmentation and lateral-movement test results for CC6.6 boundary evidence.
26079. **Data-loss-prevention evidence** — captures DLP-relevant observations (exfiltration paths, egress filtering) as CC6.7 evidence.
26080. **Endpoint-security evidence aggregation** — pulls endpoint posture findings into the vault as logical-access supporting evidence.
26081. **Cloud-configuration evidence snapshots** — stores point-in-time cloud security-posture snapshots as CC6.1/CC7.1 evidence.
26082. **Identity-lifecycle evidence** — documents joiner/mover/leaver access observations as CC6.2 evidence.
26083. **Privileged-access review evidence** — records privileged-account enumeration results to support periodic privileged-access reviews.
26084. **Secure-coding evidence from Build mode** — when Infinity AI Build fixes code, the before/after diff becomes CC8.1 evidence of secure change handling.
26085. **Evidence retention certificates** — auto-issues signed certificates proving evidence was retained (and then disposed) per policy.
26086. **Control-test automation registry** — a catalog of every automated test, its control mapping, and its last run, giving auditors the full testing inventory.
26087. **Risk-based evidence prioritization** — ranks missing evidence by audit risk so teams fill the highest-impact gaps first.
26088. **Auditor independence safeguards** — technical controls ensuring auditors cannot modify evidence, with tamper alarms if attempted.
26089. **Evidence metadata standardization** — enforces a consistent schema (control, date, tester, method, result) on every artifact so nothing arrives unlabeled.
26090. **Cross-period control comparison** — side-by-side view of control evidence this period vs. last, highlighting new gaps instantly.
26091. **SOC 2 scoping questionnaire** — interactive questionnaire that determines in-scope systems and auto-generates the evidence-collection plan.
26092. **Evidence-driven control tuning** — suggests control improvements based on patterns in failed evidence (e.g., repeated auth bypasses).
26093. **Subservice SOC report ingestion** — parses vendor SOC 2 reports (PDF) and extracts relevant control conclusions into the vault.
26094. **Control evidence API** — REST API so GRC tools can pull evidence artifacts and mappings programmatically.
26095. **Evidence redaction for auditors** — automatically redacts secrets/PII from evidence copies shared externally while keeping hash-linked originals intact.
26096. **Audit-fieldwork task board** — shared Kanban of auditor requests, assignees, and deadlines with evidence attachments inline.
26097. **Control-owner notification engine** — alerts control owners when their control's evidence is expiring, failing, or requested by the auditor.
26098. **Evidence-based SLA tracking** — measures how fast control deficiencies are remediated, with SLA reports for management and auditors.
26099. **SOC 2 report section auto-draft** — drafts the auditor's test-of-controls section prose from evidence records for the CPA firm to refine.
26100. **Post-audit lessons-learned pack** — after the audit, compiles which evidence was challenged and turns it into next-period collection improvements.
26101. **Continuous control-monitoring alerts** — pushes real-time alerts when a monitored control drifts out of compliance between audits.
26102. **Evidence integrity self-check** — nightly job re-verifies every hash in the vault and reports any corruption or tampering.
26103. **Multi-framework evidence tagging** — tags each artifact with all frameworks it satisfies (SOC 2, ISO, PCI) to eliminate duplicate collection.
26104. **Auditor-exit evidence freeze** — locks the vault at audit close with a signed manifest so the final evidence set is permanently referenceable.

## 2. PCI-DSS (26105–26204)

26105. **Automated PCI ASV scan report generator** — converts each hunt on a cardholder-data environment into an ASV-style scan report with pass/fail per host, ready for the QSA.
26106. **Requirement 11 test-to-requirement mapper** — tags every hunt test (external/internal scans, pen tests) to PCI DSS Req 11 sub-requirements (11.2, 11.3) automatically.
26107. **Card-data discovery crawler** — scans the target's pages, APIs, and logs for PAN-like patterns (Luhn-validated) and reports where cardholder data appears outside the CDE.
26108. **SAQ evidence pack builder** — assembles a self-assessment questionnaire evidence bundle (SAQ A, A-EP, D) mapped to each SAQ question from hunt observations.
26109. **Quarterly scan scheduler with attestation** — schedules automated external/internal scans every quarter and generates a signed attestation of scanning for each quarter.
26110. **PAN redaction verifier** — tests that PANs are masked/redacted in all UI surfaces and logs, producing Req 3.4 evidence.
26111. **CDE scoping validator** — verifies which hosts actually store/process/transmit cardholder data and flags out-of-scope systems touching PANs as scope-creep findings.
26112. **Requirement 6.6 WAF/code-review evidence** — documents WAF presence or code-review coverage as the Req 6.6 compensating control during hunts.
26113. **TLS 1.2+ enforcement checker** — verifies no weak TLS/SSL versions are accepted on in-scope systems (Req 4.1) with per-endpoint evidence.
26114. **Default-credential sweep for CDE** — tests in-scope systems for vendor defaults and documents results as Req 2.1 evidence.
26115. **Segmentation verification tests** — probes network segmentation between the CDE and out-of-scope networks and records pass/fail as Req 11.3.4 evidence.
26116. **Quarterly ASV attestation dashboard** — tracks all four quarterly scans, their pass status, and attestation signatures in one compliance calendar view.
26117. **SAQ D control gap analyzer** — cross-checks hunt findings against all SAQ D requirements and lists exactly which requirements are not yet satisfied.
26118. **Wireless-scope detector** — identifies wireless access points in scope of the CDE and tests them per Req 11.1/2.1.1.
26119. **Log-review automation evidence** — verifies daily log review is feasible by testing log availability and integrity (Req 10.6/11.4).
26120. **File-integrity monitoring evidence** — checks for FIM coverage on in-scope systems and documents gaps as Req 11.5 findings.
26121. **Anti-malware presence evidence** — detects anti-malware controls on in-scope systems during hunts for Req 5.x evidence.
26122. **Patch-cadence compliance checker** — correlates observed software versions against patch policy to evidence Req 6.2 timely patching.
26123. **Service-provider responsibility matrix** — maps shared-responsibility boundaries for PCI and verifies the provider's controls with targeted tests.
26124. **PAN in URL/log detector** — flags cardholder data transmitted in URLs, referrers, or logs as Req 4.2 violations with evidence.
26125. **Key-management observation tests** — probes key-storage and rotation practices observable externally for Req 3.5/3.6 evidence.
26126. **MFA enforcement verifier for CDE access** — tests that all remote/admin access to the CDE requires MFA (Req 8.4) and records bypasses.
26127. **Inactive-account lockout tester** — verifies 90-day inactive account disabling (Req 8.1.4) through observed account behaviors.
26128. **Password-policy compliance tests** — checks complexity, history, and rotation enforcement on in-scope auth endpoints (Req 8.3).
26129. **Service inventory validator** — confirms only necessary services run on CDE hosts (Req 2.2.2) via port/service enumeration evidence.
26130. **Secure-configuration evidence pack** — documents hardening observations per host as Req 2.2 evidence with benchmark comparisons.
26131. **Penetration-test methodology attestation** — generates the NIST-based pen-test methodology statement required for Req 11.3 sign-off.
26132. **Segmentation pen-test report** — dedicated report proving segmentation controls work, formatted for QSA review under Req 11.3.4.
26133. **Annual pen-test scheduler** — ensures the required annual (and post-change) penetration test is scheduled, executed, and attested.
26134. **Significant-change re-test tracker** — detects major infrastructure changes and triggers the required post-change pen test automatically.
26135. **Card-data flow diagram generator** — builds a visual data-flow diagram of PAN movement across systems for the QSA's scope review.
26136. **Third-party script risk assessor** — inventories payment-page scripts (Req 6.4.3 / 11.6.1 in v4.0) and flags unauthorized changes.
26137. **Payment-page tamper monitor** — continuously verifies payment-page script integrity and alerts on changes (PCI DSS 4.0 Req 11.6.1).
26138. **Targeted risk analysis pack** — generates the documented risk analyses required by PCI DSS 4.0 for customized-approach controls.
26139. **Customized-approach control validator** — tests bespoke controls against their documented objectives and records effectiveness evidence.
26140. **Multi-acquirer evidence splitting** — splits evidence packs per acquiring bank when different acquirers require separate attestations.
26141. **Compensating-control worksheet generator** — drafts the compensating-control worksheet (constraints, objectives, risk) for any failed requirement.
26142. **SAQ A eligibility verifier** — tests the e-commerce implementation to confirm SAQ A eligibility (fully outsourced payments) with evidence.
26143. **SAQ A-EP control tester** — runs the additional A-EP controls (script integrity, logging) for merchants with partial payment involvement.
26144. **Point-to-point encryption (P2PE) validator** — verifies P2PE solution scope-reduction claims with targeted tests.
26145. **Tokenization-scope validator** — confirms tokenized flows never expose PAN and documents scope-reduction evidence.
26146. **Requirement 12 policy cross-check** — verifies security policies exist and are acknowledged by testing policy-linked controls.
26147. **Incident-response plan test evidence** — documents IR testing observations as Req 12.10 evidence.
26148. **Security-awareness evidence linker** — links phishing/social-engineering test results to Req 12.6 awareness program evidence.
26149. **Vendor-risk evidence aggregator** — collects service-provider PCI attestations (AOCs) and flags expired ones.
26150. **AOC expiry tracker** — monitors Attestation of Compliance expiry dates for all vendors and alerts 90/30/7 days ahead.
26151. **Quarterly scan failure auto-retest** — when a quarterly scan fails, automatically schedules remediation verification and re-scan.
26152. **Scan dispute evidence pack** — packages full technical evidence for disputing false positives with the ASV.
26153. **Internal scan coverage mapper** — maps internal vulnerability scans to every CDE asset to prove 100% coverage.
26154. **Authenticated vs unauthenticated scan comparison** — runs both scan types and documents the delta as required scan-methodology evidence.
26155. **Vulnerability severity prioritization per PCI** — re-ranks findings using PCI's risk-ranking rules (not just CVSS) for remediation SLAs.
26156. **Six-month scan remediation SLA tracker** — tracks that scan-detected vulnerabilities are remediated within required timeframes.
26157. **CDE asset inventory reconciler** — reconciles discovered assets against the declared CDE inventory and flags unknowns.
26158. **De-scoping evidence collector** — when systems are removed from scope, documents the de-scoping tests proving no PAN contact.
26159. **Cloud CDE responsibility verifier** — tests cloud-provider vs merchant control boundaries for Req 12.8/12.9 evidence.
26160. **Requirement 3.2.1 PAN storage prohibition tests** — verifies sensitive authentication data is never stored post-authorization.
26161. **Cryptographic agility evidence** — documents supported cipher suites and migration readiness for Req 4.2 cryptographic standards.
26162. **HTTP security header audit for CDE** — records HSTS, CSP, and related headers on in-scope web apps as defense-in-depth evidence.
26163. **Session management tests for payment flows** — verifies session fixation/timeout controls on payment pages (Req 6.5.x/8.x).
26164. **Access-log tamper evidence** — verifies audit logs for CDE access are tamper-evident and reviewed (Req 10.x).
26165. **Time-synchronization verification** — checks NTP/time-sync across CDE systems as Req 10.4 evidence.
26166. **Log retention verification** — confirms one-year log retention with three months immediately available (Req 10.7).
26167. **Unique ID enforcement tests** — verifies every CDE access uses unique credentials, not shared accounts (Req 8.1).
26168. **Physical-access scope notes** — documents observed physical-security implications (e.g., exposed consoles) for QSA context.
26169. **Requirement 9 media-handling observations** — flags exposed backup media or printed PANs observed during OSINT/recon.
26170. **Pen-test scoping sign-off workflow** — routes the annual pen-test scope to stakeholders for approval before testing begins.
26171. **Threat-model input for PCI** — generates a threat model of the CDE from hunt data to support Req 11.3 methodology.
26172. **Application-layer pen-test evidence** — documents OWASP-style application tests as Req 11.3.1 evidence.
26173. **Network-layer pen-test evidence** — documents network-layer tests as Req 11.3.2 evidence.
26174. **Social-engineering scope guardrails** — enforces agreed social-engineering boundaries during hunts with audit-logged approvals.
26175. **QSA-ready finding write-ups** — formats each finding with PCI requirement reference, risk, and remediation in QSA-preferred language.
26176. **Remediation validation re-test** — automatically re-tests fixed findings and attaches proof to the PCI evidence pack.
26177. **Executive PCI summary letter** — one-page letter for executives stating scan/pen-test status and remaining gaps.
26178. **Acquirer submission pack** — bundles SAQ/AOC, scan reports, and pen-test attestation into the exact package acquirers expect.
26179. **PCI v3.2.1 to v4.0 migration tracker** — maps current compliance state to v4.0 new requirements and tracks migration progress.
26180. **v4.0 new-requirement test library** — pre-built tests for v4.0 additions (targeted risk analysis, authenticated scans, script inventory).
26181. **E-commerce redirect/iframe validator** — verifies payment redirect/iframe implementations meet SAQ A technical criteria.
26182. **PAN truncation verifier** — confirms only the first six/last four digits are displayed anywhere (Req 3.4).
26183. **Strong cryptography inventory** — inventories all cryptographic implementations in the CDE with algorithm/strength ratings.
26184. **Key-custodian evidence notes** — documents key-custodian form observations for Req 3.6 auditor interviews.
26185. **Dual-control key procedure tests** — verifies split-knowledge/dual-control for key operations where observable (Req 3.6.6).
26186. **Certificate lifecycle tracker** — monitors in-scope TLS certificate expiry and renewal as operational evidence.
26187. **Vulnerability scan cadence proof** — produces a calendar proving quarterly internal/external scans ran on schedule all year.
26188. **Risk-ranked remediation planner** — orders PCI remediation by a combination of requirement criticality and exploitability.
26189. **Management response templates** — pre-written management responses per PCI requirement for the ROC.
26190. **ROC section auto-draft** — drafts Report on Compliance testing-procedure narratives from hunt evidence for the QSA to finalize.
26191. **Service-provider listing validator** — verifies all third parties handling cardholder data are listed with current AOCs (Req 12.8).
26192. **Shared-hosting isolation tests** — where applicable, tests isolation between merchants on shared infrastructure.
26193. **Database activity monitoring evidence** — checks for DAM/FIM coverage on cardholder databases (Req 10/11.5).
26194. **Web-application firewall tuning evidence** — documents WAF rules tested and bypasses found as Req 6.6 evidence.
26195. **Change-ticket correlation** — correlates observed CDE changes with change tickets to evidence Req 6.4/11.3.4 re-testing triggers.
26196. **Pen-test clean-report archiver** — archives annual clean pen-test reports with attestation for multi-year auditor reference.
26197. **PCI readiness score** — single 0–100 score estimating audit readiness across all 12 requirements.
26198. **Requirement-level drill-down** — click any requirement to see its tests, evidence, findings, and remediation status.
26199. **Cross-QSA evidence portability** — exports evidence in a standard format so switching QSAs doesn't require re-collection.
26200. **Emergency change re-test workflow** — fast-tracks the required security testing after emergency changes to the CDE.
26201. **Container CDE compliance tests** — verifies containerized payment workloads meet PCI hardening and segmentation requirements.
26202. **Serverless payment-flow evidence** — documents serverless components in payment flows with their PCI control mappings.
26203. **API-only merchant evidence pack** — tailored evidence pack for API-driven payment integrations (SAQ D/API contexts).
26204. **PCI evidence retention manager** — retains scan reports and attestations for the required 3-year period with legal-hold support.

## 3. HIPAA (26205–26304)

26205. **Technical safeguard checklist automation** — runs the full HIPAA technical-safeguard checklist (164.312) against the target and produces a pass/fail matrix with evidence.
26206. **PHI access audit-trail verifier** — tests that every PHI access is logged with user identity and timestamp (164.312(b)) and flags unlogged access paths.
26207. **Encryption verification reports** — verifies AES-256/TLS encryption of ePHI at rest and in transit and generates a 164.312(a)(2)(iv) evidence report.
26208. **Minimum-necessary access tester** — probes whether users/roles can access more PHI than their role requires, documenting 164.502(b) violations.
26209. **Breach-risk scoring per finding** — scores each finding by HIPAA breach probability and the number of PHI records at risk to prioritize remediation.
26210. **ePHI discovery scanner** — crawls the target for SSN, medical record numbers, and health-data patterns to map where ePHI actually lives.
26211. **Access-control matrix tester (164.312(a)(1))** — verifies role-based access, emergency access procedures, and automatic logoff with timestamped tests.
26212. **Automatic logoff verification** — tests session timeout on ePHI systems (164.312(a)(2)(iii)) and records evidence.
26213. **Emergency access procedure validator** — documents and tests break-glass access workflows for 164.312(a)(2)(ii) compliance.
26214. **Integrity-control verification (164.312(c))** — tests mechanisms protecting ePHI from improper alteration or destruction.
26215. **Person-or-entity authentication tests** — verifies unique user authentication before ePHI access (164.312(d)) with bypass attempts documented.
26216. **Transmission-security evidence pack** — documents integrity controls and encryption for ePHI transmission (164.312(e)(1)).
26217. **Addressable-implementation decision log** — records which addressable safeguards were implemented vs. deemed not reasonable, with justification documentation.
26218. **Risk-analysis evidence generator** — produces the accurate/thorough risk analysis HIPAA requires, fed directly by hunt findings.
26219. **Risk-management plan tracker** — converts risk-analysis findings into a tracked remediation plan with HIPAA-appropriate timelines.
26220. **Business-associate control verifier** — tests vendor/BAA-covered systems for safeguard compliance and flags BA-related gaps.
26221. **BAA coverage mapper** — maps every third party touching ePHI to its Business Associate Agreement status and alerts on missing BAAs.
26222. **Device and media control tests** — verifies disposal, re-use, and accountability procedures for devices holding ePHI (164.310(d)).
26223. **Audit-control review cadence** — schedules periodic reviews of audit logs and documents the review as 164.312(b) evidence.
26224. **Workstation security observations** — documents workstation-use and physical-safeguard observations relevant to ePHI endpoints.
26225. **Facility-access control evidence** — records facility security plan observations tied to ePHI systems (164.310(a)).
26226. **Contingency-plan test evidence** — verifies data backup, disaster recovery, and emergency-mode operation plans (164.310(d)(2)(iv)/164.308(a)(7)).
26227. **Applications-and-data criticality analysis** — auto-generates the criticality analysis of ePHI systems for contingency planning.
26228. **Breach-notification rule classifier** — determines whether a finding constitutes a breach under the Breach Notification Rule and drafts the 4-factor risk assessment.
26229. **OCR audit-protocol mapper** — maps every hunt test to the HHS OCR audit protocol elements for audit readiness.
26230. **Security-awareness training evidence** — links safeguard test outcomes to the 164.308(a)(5) training program as effectiveness proof.
26231. **Sanction-policy test hooks** — documents workforce sanction-policy enforcement points relevant to safeguard failures.
26232. **Information-access management tests** — verifies access establishment/modification procedures (164.308(a)(4)) with evidence.
26233. **Workforce clearance verification** — tests that workforce members' ePHI access matches clearance procedures (164.308(a)(3)).
26234. **Termination-procedure evidence** — verifies access is revoked on workforce termination through account-lifecycle tests.
26235. **Password-management evidence (164.308(a)(5))** — tests password procedures on ePHI systems and documents compliance.
26236. **Log-in monitoring evidence** — verifies login monitoring and anomaly detection on ePHI systems (164.308(a)(5)(ii)(C)).
26237. **Response-and-reporting procedure tests** — tests the security-incident response and reporting workflow (164.308(a)(6)).
26238. **Evaluation cadence scheduler** — schedules the required periodic technical/non-technical evaluation (164.308(a)(8)).
26239. **De-identification verification tests** — verifies Safe Harbor/Expert Determination de-identification of datasets (164.514).
26240. **Re-identification risk scorer** — scores de-identified datasets for re-identification risk with documented methodology.
26241. **Limited-dataset validator** — verifies limited datasets contain only permitted identifiers with a data-use agreement check.
26242. **Patient-rights portal tests** — tests individual access, amendment, and accounting-of-disclosures workflows (164.524–528).
26243. **Accounting-of-disclosures log verifier** — confirms disclosures are logged for the six-year accounting requirement (164.528).
26244. **Authorization-form workflow tests** — verifies valid HIPAA authorizations are obtained before non-routine PHI uses.
26245. **Notice-of-privacy-practices checker** — verifies the NPP is published, current, and acknowledged where required (164.520).
26246. **Minimum-necessary policy evidence** — documents role-based PHI scoping policies and tests enforcement (164.502(b)/514(d)).
26247. **Marketing/fundraising consent tests** — verifies authorization requirements for marketing uses of PHI (164.508).
26248. **Psychotherapy-notes protection tests** — verifies heightened protections for psychotherapy notes where applicable.
26249. **Genetic-information safeguards** — checks GINA-aligned protections on genetic data within ePHI systems.
26250. **Telehealth safeguard pack** — tests video/remote-care platforms for HIPAA-eligible configurations and BAA coverage.
26251. **Mobile-device ePHI policy tests** — verifies MDM, encryption, and remote-wipe on devices accessing ePHI.
26252. **Email encryption verifier for PHI** — tests that PHI-containing emails are encrypted in transit and at rest.
26253. **Patient-portal authentication strength tests** — verifies portal auth meets 164.312(d) with MFA and lockout checks.
26254. **API PHI-exposure scanner** — scans FHIR/HL7 APIs for over-exposed PHI fields beyond minimum necessary.
26255. **FHIR endpoint safeguard tests** — verifies SMART-on-FHIR auth scopes and patient-data segmentation.
26256. **HL7 interface security review** — documents HL7v2/FHIR interface encryption and authentication controls.
26257. **EHR access-pattern anomaly tests** — tests whether anomalous ePHI access (e.g., celebrity snooping patterns) would be detected.
26258. **Break-glass audit completeness** — verifies emergency PHI access generates immutable audit entries reviewed afterward.
26259. **Data-retention policy evidence** — documents ePHI retention and secure disposal per policy (164.310(d)(2)(i-ii)).
26260. **Secure disposal verification** — tests that decommissioned systems/media had ePHI verifiably destroyed.
26261. **Backup-media encryption evidence** — verifies backup tapes/media containing ePHI are encrypted (164.312(a)(2)(iv)).
26262. **Cloud ePHI shared-responsibility mapper** — documents cloud provider vs covered-entity safeguard responsibilities with BAA linkage.
26263. **Subcontractor chain tracker** — maps BA-to-subcontractor chains and verifies BAAs exist at each link.
26264. **OCR complaint-response pack** — assembles the evidence bundle needed to respond to an OCR complaint investigation.
26265. **Corrective-action plan tracker** — tracks OCR-style corrective action plans with milestones and evidence of completion.
26266. **Willful-neglect risk flagger** — flags safeguard gaps that could be classified as willful neglect (highest penalty tier) for priority fixing.
26267. **Penalty-tier exposure estimator** — estimates potential OCR penalty exposure per unresolved safeguard gap by tier.
26268. **Annual HIPAA risk-assessment scheduler** — ensures the yearly risk analysis is scheduled, executed, and documented.
26269. **Safeguard effectiveness trend reports** — tracks technical-safeguard pass rates across quarters for management review.
26270. **Executive HIPAA dashboard** — one-page view of safeguard compliance, open gaps, and breach-risk exposure for leadership.
26271. **Board attestation support pack** — evidence bundle supporting board-level HIPAA compliance attestations.
26272. **M&A HIPAA diligence pack** — rapid safeguard assessment of an acquisition target's ePHI posture for deal diligence.
26273. **State-law overlay mapper** — maps state privacy laws stricter than HIPAA (e.g., CMIA) to additional required controls.
26274. **42 CFR Part 2 overlay** — adds substance-use-disorder record protections where applicable alongside HIPAA.
26275. **Research PHI authorization tests** — verifies IRB/authorization workflows for research uses of PHI.
26276. **Decedent PHI protection checks** — verifies 50-year post-mortem PHI protections in data-handling workflows.
26277. **Workforce training-gap analyzer** — correlates safeguard failures with training records to target retraining.
26278. **Incident-to-breach decision tree** — guided workflow applying the 4-factor test to every security incident.
26279. **Breach-notification letter drafter** — drafts individual, HHS, and media notifications per the Breach Notification Rule timelines.
26280. **Breach-log maintainer** — maintains the required log of breaches affecting fewer than 500 individuals for annual HHS submission.
26281. **500+ breach HHS portal pack** — assembles the submission package for the HHS breach portal within 60 days.
26282. **Media-notice trigger detector** — flags breaches affecting 500+ residents of a state/jurisdiction requiring prominent media notice.
26283. **HHS wall-of-shame exposure check** — estimates whether an incident would land on the OCR breach portal and its reputational impact.
26284. **Cyber-insurance HIPAA rider evidence** — packages safeguard evidence insurers require for HIPAA-related coverage.
26285. **Safeguard control inheritance tracker** — documents which safeguards are inherited from cloud/BA controls vs. directly implemented.
26286. **Hybrid-entity designation verifier** — verifies hybrid-entity documentation correctly scopes HIPAA to health-care components.
26287. **Affiliated-covered-entity mapper** — documents ACE designations and shared-safeguard responsibilities.
26288. **Organized-health-care-arrangement notes** — captures OHCA structures affecting joint compliance obligations.
26289. **ePHI flow-diagram generator** — builds visual ePHI flow diagrams from discovery scans for risk-analysis documentation.
26290. **Threat-to-safeguard traceability matrix** — links each identified threat to the safeguard(s) addressing it, OCR-audit style.
26291. **Vulnerability-to-safeguard mapper** — maps each technical finding to the specific HIPAA safeguard it violates.
26292. **Remediation-priority by PHI exposure** — orders fixes by number of PHI records exposed, not just CVSS.
26293. **Safeguard testing methodology statement** — documents the testing methodology for the risk analysis in OCR-accepted language.
26294. **Management-response templates (HIPAA)** — pre-written management responses per safeguard for audit documentation.
26295. **Policy-to-implementation gap finder** — compares written HIPAA policies against observed technical reality and lists gaps.
26296. **ePHI encryption exception log** — documents any approved exceptions to encryption with compensating controls and expiry dates.
26297. **Legacy-system safeguard waivers** — tracks legacy systems unable to meet safeguards, with risk acceptance and mitigation plans.
26298. **Medical-device (IoMT) safeguard tests** — tests connected medical devices for authentication, encryption, and patching safeguards.
26299. **PACS/imaging-system exposure checks** — scans for exposed DICOM/PACS systems leaking ePHI.
26300. **Prescription-system safeguard tests** — verifies e-prescribing workflows meet authentication and audit requirements.
26301. **Claims-system PHI minimization tests** — verifies claims/billing systems expose only minimum-necessary PHI.
26302. **Clearinghouse control verification** — tests clearinghouse/EDI interfaces for transmission-security compliance.
26303. **Patient-communication channel tests** — verifies SMS/portal/email patient communications meet PHI safeguards.
26304. **HIPAA evidence retention manager** — retains six years of HIPAA documentation with legal-hold and disposal workflows.

## 4. ISO 27001 (26305–26404)

26305. **Annex A control-to-finding mapper** — automatically maps every hunt finding to the relevant ISO 27001:2022 Annex A controls (A.5–A.8) with justification notes.
26306. **Statement of Applicability generator** — builds a draft SoA from hunt evidence: included/excluded controls, justifications, and implementation status.
26307. **Control effectiveness scorer** — rates each Annex A control 1–5 based on test results, evidence depth, and finding severity for the ISMS review.
26308. **Surveillance-audit evidence packs** — assembles focused evidence bundles for annual surveillance audits covering changed controls and prior nonconformities.
26309. **Clause 4–10 ISMS evidence collector** — gathers evidence for the management-system clauses (context, leadership, planning, support, operation, evaluation, improvement), not just Annex A.
26310. **Risk-treatment plan tracker** — links each finding to its risk-treatment option (mitigate/accept/avoid/transfer) with owner and deadline.
26311. **Residual-risk owner sign-off routing** — routes residual-risk acceptances to risk owners for formal sign-off with expiry dates.
26312. **Nonconformity tracker** — logs audit nonconformities (major/minor) with root-cause analysis and corrective-action tracking.
26313. **Corrective-action effectiveness verifier** — re-tests remediated nonconformities and records evidence that the fix actually works.
26314. **Continual-improvement log** — captures ISMS improvement actions from every hunt cycle for Clause 10 evidence.
26315. **Internal-audit program scheduler** — plans the ISO internal-audit program across the 3-year certification cycle with control coverage mapping.
26316. **Management-review input pack** — compiles hunt metrics, incidents, and control performance into the Clause 9.3 management-review inputs.
26317. **Context-of-organization mapper** — documents interested parties and their security requirements (Clause 4.2) informed by hunt scope.
26318. **ISMS scope validator** — verifies the certification scope boundary matches the actual hunted/tested environment.
26319. **Asset-inventory reconciler (A.5.9)** — reconciles discovered assets against the ISMS asset inventory for A.5.9 evidence.
26320. **Acceptable-use evidence linker** — links technical control tests to the A.5.10 acceptable-use policy coverage.
26321. **Threat-intelligence evidence (A.5.7)** — documents how hunt-derived threat intel feeds the ISMS for A.5.7 compliance.
26322. **Contact-with-authorities log (A.5.5)** — maintains the record of authority contacts relevant to incidents found during hunts.
26323. **Secure-development evidence (A.8.25–8.29)** — captures secure-coding, testing, and deployment observations for the A.8 development controls.
26324. **Change-management evidence (A.8.32)** — records change-control observations from hunts as A.8.32 evidence.
26325. **Capacity-management observations (A.8.6)** — flags capacity-related availability risks found during testing.
26326. **Redundancy verification (A.8.14)** — tests failover/redundancy of critical systems observed during hunts.
26327. **Logging evidence (A.8.15)** — verifies security logging coverage and protection as A.8.15 evidence.
26328. **Monitoring evidence (A.8.16)** — documents detection/monitoring capability observations for A.8.16.
26329. **Vulnerability-management evidence (A.8.8)** — timestamps scan/remediation cycles as A.8.8 evidence.
26330. **Network-security evidence (A.8.20–8.22)** — packages network segmentation, filtering, and secure-communication test results.
26331. **Cryptography evidence (A.8.24/A.10.1)** — documents cryptographic control usage and key-management observations.
26332. **Access-control evidence (A.5.15–5.18)** — compiles authentication, privilege-management, and access-review test results.
26333. **Supplier-security evidence (A.5.19–5.23)** — tests supplier-facing interfaces and documents supply-chain security observations.
26334. **Incident-management evidence (A.5.24–5.28)** — verifies incident response planning, learning, and evidence collection.
26335. **Business-continuity evidence (A.5.29–5.30)** — documents continuity and legal-compliance observations from hunts.
26336. **Privacy-control overlay (A.5.34)** — maps privacy-specific protections for ISO 27701-extended ISMS scopes.
26337. **Control-implementation status board** — Kanban of all 93 Annex A controls: implemented/partial/not-applicable with evidence links.
26338. **Applicability justification helper** — drafts exclusion justifications for non-applicable controls in certification-body language.
26339. **Stage 1 audit readiness pack** — documentation-review bundle for the Stage 1 certification audit.
26340. **Stage 2 audit fieldwork pack** — implementation-evidence bundle for the Stage 2 audit with test records.
26341. **Recertification evidence compiler** — 3-year evidence rollup for the recertification audit.
26342. **Certification-body evidence portal** — read-only auditor access scoped to the ISO audit with MFA and time limits.
26343. **Multi-site sampling planner** — plans control sampling across sites per certification-body sampling rules.
26344. **Control-owner RACI mapper** — assigns Responsible/Accountable/Consulted/Informed per control with evidence of assignment.
26345. **Policy-to-control traceability** — links each ISMS policy clause to the Annex A controls it implements.
26346. **ISMS metrics dashboard (Clause 9.1)** — control-performance metrics with trends for monitoring-and-measurement evidence.
26347. **Audit-finding aging tracker** — ages open nonconformities and escalates overdue corrective actions.
26348. **Opportunity-for-improvement log** — tracks OFIs separately from nonconformities with voluntary improvement plans.
26349. **Control-dependency graph** — visualizes which controls depend on others so one failure's blast radius is clear.
26350. **Risk-register auto-populator** — feeds hunt findings into the ISMS risk register with likelihood/impact scoring.
26351. **Risk-criteria documentation helper** — drafts the risk acceptance criteria (Clause 6.1.2) informed by hunt data.
26352. **Legal-requirement register linker** — links findings to contractual/legal/regulatory requirements (A.5.31–5.33).
26353. **Intellectual-property control notes** — documents IP-protection observations for A.5.32.
26354. **Records-protection evidence (A.5.33)** — verifies protection of ISMS records themselves (integrity, retention).
26355. **Secure-coding training evidence** — links Build-mode secure fixes to developer training effectiveness (A.5.4/A.8.28).
26356. **Background-verification control notes** — documents screening-procedure observations for A.5.4-adjacent HR controls.
26357. **Disciplinary-process evidence linker** — connects safeguard violations to the disciplinary process documentation.
26358. **Remote-working control tests (A.6.7)** — tests remote-access security controls for the remote-working topic.
26359. **Mobile-device policy tests** — verifies MDM/enrollment enforcement on devices accessing in-scope systems.
26360. **Teleworking evidence pack** — documents home-office security control observations.
26361. **Information-transfer evidence (A.5.14)** — tests secure-transfer controls (email, API, file-share) for A.5.14.
26362. **NDA coverage verifier** — checks that third parties with system access have NDA coverage documented (A.5.6).
26363. **Cloud-service control mapper** — maps cloud shared-responsibility to Annex A controls with provider evidence.
26364. **Supplier-incident notification tests** — verifies supplier incident-notification clauses are exercisable (A.5.24).
26365. **ICT-readiness evidence (A.5.29)** — documents ICT continuity test observations.
26366. **Red-team exercise evidence** — packages hunt campaigns as the Clause 9.1/A.5.27 testing evidence.
26367. **Pen-test scope-to-ISMS mapper** — shows how each pen-test activity maps to ISMS control verification.
26368. **Control-test automation catalog** — lists every automated test with its Annex A mapping for the auditor's test plan.
26369. **Evidence sampling support** — lets the certification auditor pick samples; exports full detail with chain of custody.
26370. **Integrated-audit evidence sharing** — shares one evidence set across ISO 27001 + 27701 + 27017/27018 audits.
26371. **27017 cloud-control overlay** — adds cloud-specific control tests for ISO 27017 scopes.
26372. **27018 PII-protection overlay** — adds public-cloud PII processor control tests for ISO 27018.
26373. **27701 privacy-control mapper** — maps findings to ISO 27701 PIMS controls for privacy-extended audits.
26374. **22301 continuity-control linker** — links availability findings to ISO 22301 business-continuity controls.
26375. **27002 implementation-guidance notes** — attaches 27002 guidance references to each control's evidence for auditor context.
26376. **Control-maturity benchmark** — benchmarks control maturity against industry peers (anonymized) for management review.
26377. **Certification-timeline planner** — project plan from gap assessment to certification with evidence milestones.
26378. **Gap-assessment report generator** — produces the pre-certification gap assessment from current evidence coverage.
26379. **Remediation-roadmap builder** — ordered remediation plan to close gaps before Stage 2, with effort estimates.
26380. **Mock Stage-2 audit mode** — simulates certification-body interviews and evidence challenges against current state.
26381. **Auditor-question bank** — likely certification-body questions per control with evidence-backed suggested answers.
26382. **Opening-meeting slide generator** — auto-builds the ISMS overview deck for the audit opening meeting.
26383. **Closing-meeting findings pack** — formats nonconformities and OFIs for the closing meeting in certification-body style.
26384. **Post-audit action tracker** — tracks actions from the audit report to closure with evidence.
26385. **Certificate-expiry monitor** — tracks ISO certificate validity and schedules recertification activities.
26386. **Scope-extension evidence pack** — evidence bundle for adding new sites/systems to the certification scope.
26387. **Scope-reduction justification helper** — documents scope reductions with risk analysis for the certification body.
26388. **Transfer-to-new-CB pack** — portable evidence package for transferring certification to a new certification body.
26389. **Integrated management-system linker** — links ISMS evidence with QMS/EMS (9001/14001) for integrated audits.
26390. **Control-effectiveness trend reports** — multi-period control scoring trends for continual-improvement evidence.
26391. **KPI/KRI security metrics** — defines and tracks key risk indicators from hunt data for Clause 9.1.
26392. **Security-culture survey linker** — connects technical control results with awareness-culture survey data.
26393. **Lessons-learned repository** — searchable log of incident/hunt lessons feeding Clause 10 improvement.
26394. **Documented-information version control** — versioned ISMS documents with approval history for Clause 7.5.
26395. **Competence-evidence linker (Clause 7.2)** — links control performance to workforce competence records.
26396. **Communication-plan evidence (Clause 7.4)** — documents security communication activities and their reach.
26397. **Operational-planning evidence (Clause 8.1)** — shows security requirements embedded in operational processes.
26398. **Outsourced-process control verifier** — verifies controls over outsourced processes (Clause 8.1.1).
26399. **Performance-evaluation scheduler** — schedules monitoring, internal audit, and management review per Clause 9.
26400. **Improvement-action effectiveness checks** — verifies improvement actions actually improved control performance.
26401. **Annex A 2022 transition tracker** — tracks migration from the 2013 to 2022 control set with mapping tables.
26402. **Control-attribute tagger** — tags controls by attribute (preventive/detective, cyber/physical) per 27002 for filtered views.
26403. **ISMS dashboard for leadership** — executive view of certification health, risks, and upcoming audit milestones.
26404. **ISO evidence retention manager** — retains certification evidence for the full 3-year cycle plus legal hold.

## 5. GDPR (26405–26504)

26405. **Data-flow mapping from hunt observations** — builds personal-data flow diagrams from crawled forms, APIs, and third-party calls observed during hunts.
26406. **DPO report generator** — produces a Data Protection Officer-ready report of processing activities, risks, and findings from hunt evidence.
26407. **Right-to-erasure verification tests** — submits erasure requests and verifies personal data is actually deleted across systems (Art. 17).
26408. **Consent-mechanism checker** — audits cookie banners and consent flows for freely-given, specific, informed, unambiguous consent (Art. 7).
26409. **Cross-border transfer detector** — identifies personal-data transfers outside the EEA via observed endpoints, CDNs, and subprocessors (Chapter V).
26410. **Records of processing (RoPA) builder** — auto-drafts Article 30 records of processing activities from data-flow observations.
26411. **Lawful-basis mapper** — maps each observed processing activity to its claimed lawful basis (Art. 6) and flags missing bases.
26412. **Data-minimization tester** — checks that forms/APIs collect only necessary personal data (Art. 5(1)(c)) and flags over-collection.
26413. **Purpose-limitation verifier** — detects personal data used beyond its stated purpose via observed secondary processing.
26414. **Storage-limitation checker** — verifies retention periods are defined and enforced for personal data stores (Art. 5(1)(e)).
26415. **Accuracy-control observations** — documents mechanisms for keeping personal data accurate and up to date (Art. 5(1)(d)).
26416. **Integrity-and-confidentiality evidence (Art. 5(1)(f))** — packages security test results as the Art. 5(1)(f) and Art. 32 evidence.
26417. **Accountability evidence pack (Art. 5(2))** — compiles proof the controller can demonstrate compliance across all principles.
26418. **DPIA trigger detector** — flags processing activities likely requiring a Data Protection Impact Assessment (Art. 35).
26419. **DPIA draft generator** — produces a DPIA skeleton (necessity, proportionality, risks, mitigations) from hunt observations.
26420. **DPIA consultation tracker** — tracks DPO consultation and data-subject views for DPIAs (Art. 35(2)(9)).
26421. **Prior-consultation flagger** — identifies high-risk processing requiring supervisory-authority consultation (Art. 36).
26422. **Data-protection-by-design evidence (Art. 25)** — documents privacy-by-design/default controls observed in the product.
26423. **Default-privacy-settings tester** — verifies the most privacy-friendly defaults are applied out of the box (Art. 25(2)).
26424. **Pseudonymization verifier** — tests that pseudonymization is applied where appropriate and keys are separated (Art. 32(1)(a)).
26425. **Encryption-of-personal-data evidence** — documents encryption of personal data at rest/in transit for Art. 32(1)(a).
26426. **Resilience-and-restore tester** — verifies backup/restore of personal-data systems for Art. 32(1)(b-c).
26427. **Regular-testing evidence (Art. 32(1)(d))** — packages hunt campaigns as the required regular effectiveness testing.
26428. **Processor-agreement verifier** — checks that processors operate under Art. 28 contracts with required clauses.
26429. **Sub-processor disclosure tracker** — inventories sub-processors observed in data flows and verifies disclosure to controllers.
26430. **Joint-controller arrangement checker** — identifies joint-controller scenarios and verifies Art. 26 arrangements exist.
26431. **Representative requirement checker** — flags non-EEA controllers needing an EU representative (Art. 27).
26432. **DPO designation verifier** — checks whether a DPO is required (Art. 37) and documents designation/contact publication.
26433. **Right-of-access workflow tester** — submits DSARs and verifies complete, timely responses (Art. 15).
26434. **DSAR response-time tracker** — tracks the one-month (extendable) deadline for each access request tested.
26435. **Right-to-rectification tester** — verifies inaccurate personal data can be corrected through provided workflows (Art. 16).
26436. **Right-to-restriction tester** — tests restriction-of-processing workflows (Art. 18) on the target.
26437. **Data-portability format verifier** — checks exports are in structured, machine-readable formats (Art. 20).
26438. **Right-to-object workflow tester** — verifies objection handling for direct marketing and legitimate-interest processing (Art. 21).
26439. **Automated-decision safeguards checker** — tests for Art. 22 safeguards where automated decision-making/profiling exists.
26440. **Profiling-transparency verifier** — checks meaningful information about profiling logic is provided (Art. 13(2)(f)/14(2)(g)).
26441. **Privacy-notice completeness checker** — audits privacy notices against Art. 13/14 required content.
26442. **Cookie-consent granularity tester** — verifies consent is per-purpose, not bundled, with equally-easy withdrawal (Art. 7(3)).
26443. **Pre-ticked-box detector** — flags pre-ticked consent boxes as invalid consent with screenshots.
26444. **Consent-record evidence** — verifies the controller keeps demonstrable consent records (Art. 7(1)).
26445. **Children's-data age-gate tester** — tests age verification and parental consent for information-society services (Art. 8).
26446. **Special-category data detector** — identifies processing of Art. 9 special-category data and verifies an Art. 9(2) condition.
26447. **Criminal-offence data checker** — flags Art. 10 criminal-conviction data processing without official authority.
26448. **SCC transfer-mechanism verifier** — checks Standard Contractual Clauses are in place for third-country transfers.
26449. **Transfer-impact-assessment helper** — drafts Transfer Impact Assessments for cross-border flows observed.
26450. **Adequacy-decision mapper** — maps destination countries against current EU adequacy decisions.
26451. **BCR evidence linker** — links Binding Corporate Rules to observed intra-group transfers.
26452. **Derogation-use tracker** — documents reliance on Art. 49 derogations with necessity evidence.
26453. **Supervisory-authority breach notifier** — drafts the 72-hour Art. 33 notification from incident findings.
26454. **Data-subject breach communicator** — drafts Art. 34 high-risk breach communications in plain language.
26455. **Breach-register maintainer** — maintains the Art. 33(5) internal breach documentation log.
26456. **Risk-to-rights scorer** — scores each finding by risk to data-subject rights and freedoms for DPIA/breach triage.
26457. **High-risk processing flagger** — flags processing meeting EDPB high-risk criteria for mandatory DPIA.
26458. **Legitimate-interest assessment helper** — drafts LIA (purpose/necessity/balancing) documentation for Art. 6(1)(f) reliance.
26459. **Employee-monitoring proportionality tests** — checks workplace monitoring against necessity/proportionality standards.
26460. **CCTV/data-retention policy checker** — verifies surveillance-data retention limits and signage where observed.
26461. **Marketing-consent (ePrivacy) checker** — tests PECR/ePrivacy consent for marketing cookies and direct marketing.
26462. **Cookie-policy accuracy verifier** — compares declared cookies against actually-set cookies and flags mismatches.
26463. **Tracker-inventory builder** — full inventory of third-party trackers, pixels, and SDKs with data destinations.
26464. **Fingerprinting-technique detector** — identifies canvas/audio/browser fingerprinting as potential consent-requiring storage.
26465. **Dark-pattern consent detector** — flags deceptive consent UX (roach motels, confirm-shaming) with evidence.
26466. **Withdrawal-ease tester** — verifies consent withdrawal is as easy as giving it, with one-click tests.
26467. **Granular-purpose toggles verifier** — checks users can accept/reject each purpose independently.
26468. **Consent-string (TCF) validator** — validates IAB TCF consent strings against actual processing observed.
26469. **Google-Analytics transfer checker** — flags GA/data transfers to non-adequate countries with remediation options.
26470. **US-cloud transfer risk assessor** — assesses Schrems II risk for US-cloud processing with mitigation documentation.
26471. **Data-residency verifier** — confirms personal data stays in declared regions via observed infrastructure.
26472. **Anonymization-effectiveness tester** — tests whether anonymized datasets resist re-identification (Recital 26).
26473. **Synthetic-data validation notes** — documents synthetic-data approaches as anonymization alternatives.
26474. **Privacy-notice version tracker** — tracks notice changes over time for accountability evidence.
26475. ** layered-notice UX tester** — verifies just-in-time notices at collection points (Art. 13).
26476. **Privacy-dashboard completeness** — tests user privacy dashboards expose all Art. 12–22 rights.
26477. **Deletion-propagation verifier** — confirms erasure propagates to backups, logs, and processors.
26478. **Backup-erasure scheduler** — verifies time-bound deletion from backups with documented schedules.
26479. **Log-data minimization checker** — flags excessive personal data in logs (full IPs, emails) as minimization failures.
26480. **IP-address personal-data handler** — verifies IP addresses are treated as personal data with appropriate safeguards.
26481. **Incident-to-breach GDPR classifier** — classifies every security incident as notifiable-or-not under Art. 33/34.
26482. **72-hour deadline tracker** — countdown tracker from breach awareness to supervisory notification.
26483. **Lead-supervisory-authority identifier** — determines the lead SA for cross-border processing cases.
26484. **One-stop-shop case pack** — bundles cross-border breach documentation for the lead-SA procedure.
26485. **EDPB-guideline cross-reference** — links findings to relevant EDPB guidelines for defensibility.
26486. **Fine-exposure estimator** — estimates GDPR fine exposure (up to 4% turnover tiers) per unresolved gap.
26487. **Accountability-framework scorer** — scores the Art. 5(2) accountability posture across policies, records, and evidence.
26488. **Records-retention schedule verifier** — checks retention schedules exist and are enforced per data category.
26489. **Data-protection training evidence** — links staff training records to observed control effectiveness.
26490. **Privacy-champion network tracker** — documents embedded privacy champions and their review activities.
26491. **Vendor-DPA status board** — tracks Data Processing Agreements per vendor with expiry and clause coverage.
26492. **Processor-audit right exerciser** — documents exercising Art. 28(3)(h) audit rights over processors.
26493. **Onward-transfer control verifier** — checks processors don't make unauthorized onward transfers.
26494. **Return-or-deletion at contract end** — verifies processor data return/deletion on termination (Art. 28(3)(g)).
26495. **International-org transfer checker** — flags transfers to international organizations without safeguards.
26496. **Public-authority request handler** — documents procedures for government data requests affecting personal data.
26497. **Data-subject complaint-response pack** — evidence bundle for responding to SA complaints.
26498. **Supervisory-audit readiness mode** — simulated SA investigation against current evidence with gap scoring.
26499. **GDPR evidence retention manager** — retains accountability evidence with defined retention and disposal.
26500. **Privacy-by-design review gate** — requires privacy review evidence before new features processing personal data ship.
26501. **Feature-flag privacy impact notes** — documents privacy impact of feature flags/experiments on personal data.
26502. **A/B-test consent verifier** — checks experimentation platforms have consent coverage for personal-data use.
26503. **ML-training data lawful-basis checker** — verifies lawful basis for personal data used in model training.
26504. **Model-output personal-data leak tester** — tests AI features for personal-data leakage in outputs.

## 6. Audit Trails (26505–26604)

26505. **Hash-chained hunt activity log** — every hunt action (start, probe, finding, chat, report) is appended to a SHA-256 hash-chained log so any tampering breaks the chain.
26506. **Who-hunted-what-when registry** — immutable record of user identity, target, scope, start/end times, and tests run for every hunt.
26507. **Tamper-evident export bundles** — exports of audit trails include a signed manifest; any post-export modification is detectable.
26508. **Auditor timeline view** — chronological, filterable timeline of all hunt activity for auditors with drill-down to raw evidence.
26509. **Multi-level sign-off workflow** — routes hunts/reports through analyst → reviewer → approver sign-offs with timestamps and comments.
26510. **Retention-policy engine** — enforces configurable retention (e.g., 7 years) on audit logs with legal-hold overrides and certified disposal.
26511. **WORM storage backend** — writes audit logs to write-once-read-many storage so not even admins can alter history.
26512. **Log-integrity self-verifier** — nightly job re-validates the entire hash chain and alerts on any break.
26513. **Dual-control log export** — requires two authorized users to approve audit-log exports, logged itself.
26514. **Scope-authorization proof** — attaches the signed authorization for each hunt to its audit trail as proof of permission.
26515. **Out-of-scope attempt logger** — records every blocked out-of-scope probe as proof of restraint, signed and timestamped.
26516. **Credential-usage audit log** — logs every use of stored credentials during hunts (who, when, which system) without storing the secrets.
26517. **Evidence-access audit trail** — records every view, download, and share of evidence artifacts with user identity.
26518. **Report-version history** — every report revision is versioned with author, diff, and approval state.
26519. **Chat-transcript archiver** — mid-hunt and Infinity AI conversations are archived immutably as part of the audit trail.
26520. **Configuration-change log** — tracks every settings/scope/policy change with before/after values and approver.
26521. **User-access review log** — documents periodic reviews of who has hunt/admin/auditor access.
26522. **Failed-login attempt log** — records authentication failures with IP, timestamp, and lockout actions.
26523. **Privilege-escalation event log** — logs every elevation of privilege within the platform with justification.
26524. **API-call audit log** — every API request is logged with caller, endpoint, parameters (redacted), and result.
26525. **Data-export audit log** — logs every data export (reports, evidence, CSVs) with recipient and classification.
26526. **Deletion-event log** — records every deletion (evidence, reports, users) with approver and reason; deletions are soft by default.
26527. **Legal-hold manager** — places litigation holds that suspend retention disposal, with hold history.
26528. **Clock-synchronization proof** — documents NTP sync status so log timestamps are defensible.
26529. **Timezone-normalized timeline** — displays the audit timeline in the auditor's timezone with UTC source preserved.
26530. **Cross-system log correlation** — correlates platform audit logs with target-side logs for end-to-end proof.
26531. **Anomaly detector on audit logs** — flags unusual patterns (off-hours exports, mass downloads) for review.
26532. **Auditor annotation layer** — lets auditors add private notes to timeline events without modifying the log.
26533. **Bookmark and citation tool** — auditors can bookmark events and generate citations for their workpapers.
26534. **Workpaper export** — exports selected timeline events with evidence into auditor workpaper format.
26535. **Chain-of-custody certificates** — issues signed certificates tracking evidence from collection to auditor handoff.
26536. **Witness co-signing** — allows a second party to co-sign critical hunt milestones for high-assurance engagements.
26537. **Video-session recording log** — links recorded walkthrough sessions to the audit timeline.
26538. **Approval-delegation log** — records temporary delegation of approval authority with scope and expiry.
26539. **Segregation-of-duties enforcer** — prevents the same user from executing and approving the same hunt step.
26540. **Break-glass access log** — emergency access is logged with mandatory post-event justification review.
26541. **Session-replay for auditors** — reconstructs what the analyst saw/did during a hunt from event logs.
26542. **Diff-view for config changes** — visual before/after diffs for every configuration change in the trail.
26543. **Immutable finding lifecycle** — every finding state change (new → confirmed → remediated → closed) is chained and timestamped.
26544. **Remediation-evidence linkage** — links fix commits/re-tests to the original finding in the audit trail.
26545. **False-positive adjudication log** — records FP decisions with rationale and approver for auditor scrutiny.
26546. **Risk-acceptance log** — formal log of accepted risks with owner, expiry, and re-assessment dates.
26547. **Exception-approval log** — policy exceptions with business justification, approver, and expiry.
26548. **Pen-test authorization archive** — stores signed rules-of-engagement and authorization letters per engagement.
26549. **Scope-change audit log** — every scope change with requester, approver, and effective time.
26550. **Communication log** — client/analyst communications (approvals, scope questions) archived per engagement.
26551. **Billing-hour evidence linker** — links hunt activity timestamps to time-tracking for audit/billing transparency.
26552. **Multi-tenant isolation proof** — audit logs prove tenant data separation with per-tenant log partitioning.
26553. **Log-forwarding to SIEM** — streams audit events to the customer's SIEM in real time (CEF/JSON).
26554. **Syslog-signed transport** — signs forwarded logs so the SIEM can verify authenticity.
26555. **Audit-log backup verifier** — proves audit logs are backed up and restorable with tested restores.
26556. **Disaster-recovery log continuity** — documents that audit logging continued (or its gap) during DR events.
26557. **Offline-period gap attestation** — when logging was unavailable, generates a gap attestation with compensating evidence.
26558. **Log-source inventory** — catalog of every system feeding the audit trail with health status.
26559. **Parsing-failure alert** — alerts when log sources stop parsing so gaps are caught immediately.
26560. **Retention-expiry preview** — shows what will be disposed under retention policy before it happens.
26561. **Certified disposal receipts** — signed receipts proving compliant destruction of expired audit data.
26562. **Privacy-redaction in trails** — PII in audit logs is masked for viewers without clearance; originals stay sealed.
26563. **Auditor-role permission matrix** — fine-grained auditor permissions (view/export/annotate) per engagement.
26564. **Time-boxed auditor access** — auditor credentials auto-expire at engagement end with access logs.
26565. **Read-only enforcement proof** — technical proof auditors cannot modify logs (DB roles, WORM, tests).
26566. **Concurrent-audit isolation** — multiple auditors get isolated views so one's work doesn't affect another's.
26567. **Audit-trail search engine** — full-text search across all audit events with faceted filters.
26568. **Natural-language trail queries** — ask "show all exports by Alice in March" and get filtered results.
26569. **Scheduled trail-digest emails** — weekly digest of significant audit events to compliance owners.
26570. **Real-time trail webhooks** — pushes critical audit events (exports, deletions, approvals) to webhooks.
26571. **Compliance-calendar integration** — audit milestones (fieldwork, sign-offs) sync to the compliance calendar.
26572. **Trail-completeness checker** — verifies no expected events are missing (e.g., every hunt has start/end).
26573. **Duplicate-event deduplicator** — merges duplicate log entries from retries without losing fidelity.
26574. **Event-severity classifier** — classifies audit events by compliance significance for triage.
26575. **Quarterly trail-review workflow** — formal quarterly review of audit logs with sign-off.
26576. **Annual trail-effectiveness assessment** — assesses whether audit logging meets policy objectives yearly.
26577. **Log-format standardization** — normalizes all events to a common schema (actor, action, object, result, time).
26578. **MITRE-ATT&CK tagging for hunts** — tags hunt techniques with ATT&CK IDs in the audit trail for threat-informed review.
26579. **Engagement-letter linkage** — links each hunt to its engagement letter/contract in the trail.
26580. **Insurance-policy reference** — links hunts to the cyber-insurance policy covering the engagement.
26581. **Subcontractor-activity log** — logs actions by subcontracted testers separately with sponsor attribution.
26582. **Tool-version provenance** — records exact tool/engine versions used per hunt for reproducibility.
26583. **Brain-model version log** — logs which AI model version drove each hunt phase for auditability.
26584. **Prompt-archive (sanitized)** — archives key prompts (secrets redacted) used during hunts for methodology review.
26585. **Human-override log** — records every human override of AI decisions with rationale.
26586. **Autonomy-level indicator** — logs the autonomy mode per hunt phase (supervised/autonomous) for accountability.
26587. **Kill-switch event log** — logs every stop/pause/restart of hunts with actor and reason.
26588. **Data-residency audit proof** — proves audit logs reside in declared jurisdictions.
26589. **Encryption-of-audit-logs proof** — documents at-rest/in-transit encryption of the audit trail itself.
26590. **Access-to-audit-logs log** — meta-log of who accessed the audit logs themselves.
26591. **Forensic-readiness checklist** — verifies the trail meets forensic-readiness criteria (completeness, integrity, availability).
26592. **Litigation-export mode** — produces court-ready exports with affidavits of authenticity.
26593. **Regulator-request responder** — packages regulator-specific subsets of the trail on demand.
26594. **Internal-investigation mode** — restricted, logged access for internal investigations with case isolation.
26595. **Whistleblower-report linkage** — securely links whistleblower reports to related audit events.
26596. **Ethics-review flagger** — flags hunts touching sensitive areas for ethics review with audit notes.
26597. **Dual-use activity monitor** — flags potentially dual-use testing for additional authorization with logged review.
26598. **Export-control compliance log** — logs cross-border sharing of security tooling/results per export-control rules.
26599. **Sanctions-screening log** — records sanctions checks on targets/clients before hunts begin.
26600. **Conflict-of-interest declarations** — logs tester conflict declarations per engagement.
26601. **Independence attestation log** — annual independence attestations by testers, archived immutably.
26602. **Quality-review sign-off** — independent quality review of each engagement report, logged with reviewer identity.
26603. **Peer-review workflow** — routes findings through peer review before client delivery, all logged.
26604. **Audit-trail API for GRC** — REST API exposing the full audit trail to GRC platforms with pagination and filters.

## 7. Attestation Reports (26605–26704)

26605. **One-click pentest attestation letter** — generates a signed letter stating scope, methodology, dates, and tester credentials from hunt records.
26606. **Executive attestation summary** — one-page C-suite summary of security posture with attestation language suitable for board minutes.
26607. **Customer-facing security posture letter** — polished, non-technical letter customers can share with their own clients/procurement teams.
26608. **Insurance-ready cyber report** — formats hunt results into the evidence insurers require for underwriting and renewals.
26609. **SOC 2 auditor reliance letter** — letter the CPA firm can rely on describing testing performed for control evidence.
26610. **Clean-hunt attestation** — when no critical findings exist, issues a "no material findings" attestation with full methodology disclosure.
26611. **Remediation attestation** — certifies that previously reported findings were re-tested and verified remediated.
26612. **Quarterly security attestation** — recurring quarterly letter summarizing testing performed and posture trend.
26613. **Annual security attestation** — yearly rollup letter covering all hunts, findings, and remediation for the year.
26614. **Vendor security attestation** — attestation the company can send to its own customers' vendor-risk teams.
26615. **Procurement questionnaire pre-fill** — auto-fills security questionnaires (SIG, CAIQ-style) from hunt evidence.
26616. **RFP security appendix generator** — builds the security appendix for RFP responses from attestation records.
26617. **Due-diligence security pack** — investor/acquirer-ready pack: attestations, pen-test summaries, remediation proof.
26618. **M&A reps-and-warranties support** — evidence bundle supporting security representations in deal documents.
26619. **IPO readiness security pack** — compiles the security posture documentation IPO underwriters expect.
26620. **Board-report security section** — quarterly board-ready security section with attestation statements.
26621. **Regulatory attestation formatter** — formats attestations to specific regulators' templates (e.g., RBI, MAS, FCA styles).
26622. **Digitally-signed attestations** — every letter is cryptographically signed with signer identity and timestamp.
26623. **Signer-authority verifier** — verifies the signer holds authority to attest (role check) before issuance.
26624. **Attestation numbering registry** — unique, sequential attestation IDs preventing duplication or forgery.
26625. **Attestation revocation list** — if facts change, revokes prior attestations with a published revocation notice.
26626. **Verification portal for recipients** — recipients can verify an attestation's authenticity via a public verification link.
26627. **QR-coded attestation letters** — QR code on each letter links to its live verification status.
26628. **Multi-language attestation output** — generates attestation letters in the recipient's required language.
26629. **White-label attestation templates** — MSSP partners can brand attestation letters with their own identity.
26630. **Co-branded attestation mode** — joint attestations carrying both Dark-Matter and partner branding.
26631. **Scope-limitation disclosures** — automatically includes methodology limitations so letters are never misleading.
26632. **Negative-assurance wording engine** — uses proper "nothing came to our attention" language where full assurance isn't given.
26633. **Positive-assurance mode** — where evidence supports it, issues positive-assurance statements with cited evidence.
26634. **Point-in-time disclaimers** — every letter states its validity date and that posture may change.
26635. **Forward-looking statement guards** — prevents letters from promising future security states.
26636. **Materiality-threshold config** — defines what counts as material for attestation purposes per engagement.
26637. **Finding-severity attestation mapping** — maps severities to attestation language (clean / minor / material).
26638. **Compensating-control disclosures** — discloses where compensating controls were relied upon in the attestation.
26639. **Subsequent-events updater** — if major findings appear after issuance, triggers an attestation update workflow.
26640. **Attestation-request intake form** — structured intake for who needs what attestation, for whom, by when.
26641. **SLA-tracked attestation delivery** — tracks attestation turnaround SLAs with requester notifications.
26642. **Attestation-template library** — library of pre-approved letter templates per use case and jurisdiction.
26643. **Legal-review workflow** — routes draft attestations through legal before issuance, logged.
26644. **Versioned template control** — templates are versioned; issued letters reference the exact template version.
26645. **Client-approved wording lock** — once a client approves wording, it's locked against silent changes.
26646. **Redline comparison for renewals** — shows wording changes between this year's and last year's attestation.
26647. **Executive-summary infographics** — visual one-pagers (charts, gauges) accompanying executive attestations.
26648. **Posture-trend attestation annex** — annex showing security posture trend across periods with the letter.
26649. **Benchmark-comparison annex** — anonymized peer benchmarking attached to posture letters.
26650. **Remediation-velocity annex** — shows mean-time-to-remediate as proof of security maturity.
26651. **Coverage annex** — details what was tested (assets, techniques) as an appendix to every letter.
26652. **Tester-credential annex** — lists tester qualifications/certifications backing the attestation.
26653. **Methodology annex** — NIST/OWASP methodology description attached for credibility.
26654. **Glossary annex** — plain-language glossary so non-technical recipients understand the letter.
26655. **Translation-certification notes** — certifies translation accuracy for multi-language letters.
26656. **Notarization-support pack** — prepares the bundle a notary needs if notarized attestation is required.
26657. **Apostille-ready formatting** — formats letters to meet apostille/legalization requirements for cross-border use.
26658. **Regulator-filing cover letters** — cover letters tailored to each regulator's submission portal.
26659. **Filing-receipt tracker** — tracks submitted attestations and their regulator acknowledgments.
26660. **Customer-portal attestation shelf** — self-service portal where customers download current attestations.
26661. **Expiry and renewal reminders** — alerts before attestations expire with one-click renewal workflow.
26662. **Attestation-usage analytics** — tracks which letters are downloaded/shared to prioritize renewals.
26663. **NDA-gated attestation sharing** — requires recipient NDA acceptance before downloading sensitive letters.
26664. **Watermarked recipient copies** — each downloaded copy is watermarked with recipient identity to deter leaks.
26665. **Access-logged attestation shelf** — logs every download from the customer portal.
26666. **Emergency attestation mode** — expedited issuance workflow for urgent procurement/insurance deadlines.
26667. **Attestation-health dashboard** — shows all issued letters, their status, expiry, and verification hits.
26668. **Fraudulent-copy detector** — monitors for forged attestation copies via verification-portal mismatch alerts.
26669. **Take-down request workflow** — handles requests to remove misused attestation copies.
26670. **Press-release security claims verifier** — checks marketing security claims against issued attestations before publication.
26671. **Website trust-badge generator** — generates verifiable trust badges linked to current attestations.
26672. **Badge-expiry auto-removal** — trust badges automatically expire when the underlying attestation lapses.
26673. **Security-page auto-updater** — updates the public security page from current attestation records.
26674. **Status-page security section** — publishes attestation status on the status page for transparency.
26675. **Annual-report security excerpt** — drafts the cybersecurity disclosure section for annual reports.
26676. **SEC cyber-disclosure helper** — drafts Item 1.05/1C-style cyber incident/governance disclosures from hunt records.
26677. **Material-incident attestation** — rapid attestation of incident scope/containment for disclosure filings.
26678. **Earnings-call security Q&A prep** — prepares security posture talking points backed by attestations.
26679. **Analyst-briefing pack** — security briefing materials for industry analysts with attestation proof.
26680. **Partner-security attestation exchange** — bilateral attestation exchange workflow with business partners.
26681. **Supply-chain attestation cascade** — collects attestations down the supply chain and rolls them up.
26682. **Fourth-party attestation tracker** — tracks sub-processor attestations for completeness.
26683. **Attestation-gap escalation** — escalates missing partner attestations to vendor-risk owners.
26684. **Framework-specific attestation variants** — letter variants aligned to SOC 2, ISO 27001, PCI, HIPAA audiences.
26685. **Combined-assurance letter** — single letter referencing multiple frameworks' testing at once.
26686. **Continuous-assurance feed** — API/stream of current attestation status for always-on customer verification.
26687. **Attestation-change notifications** — notifies subscribers when an attestation is issued, updated, or revoked.
26688. **Historical attestation archive** — permanent, searchable archive of all issued letters with verification.
26689. **Comparative year-over-year letter** — highlights posture improvement vs. prior year in renewal letters.
26690. **Risk-appetite statement linker** — links attestations to the organization's stated risk appetite.
26691. **Control-framework mapping annex** — annex mapping tested controls to frameworks for multi-audience letters.
26692. **Formal pentest scope certificate** — formal certificate of penetration testing with scope and dates.
26693. **Vulnerability-disclosure attestation** — attests to the operation of the vulnerability disclosure program.
26694. **Bug-bounty program attestation** — attests to continuous testing via the bounty program with stats.
26695. **Secure-SDLC attestation** — attests to secure development practices evidenced by Build-mode records.
26696. **Incident-response readiness letter** — attests to IR capability based on drill and hunt evidence.
26697. **Backup-and-recovery attestation** — attests to backup/recovery testing from observed evidence.
26698. **Business-continuity attestation** — attests to continuity arrangements with test references.
26699. **Data-protection attestation** — privacy-focused attestation for DPO/customer privacy teams.
26700. **AI-security attestation** — attests to AI/ML security controls where AI features were tested.
26701. **Cloud-security attestation** — cloud-posture attestation referencing shared-responsibility evidence.
26702. **OT-security attestation** — operational-technology testing attestation for industrial clients.
26703. **Attestation API for procurement** — API letting customer procurement systems pull current attestations automatically.
26704. **Attestation-retention manager** — retains issued letters per legal requirements with superseded-version history.

## 8. Pentest Scoping Docs (26705–26804)

26705. **Auto-generated scope document** — builds a formal scope document from the pasted target, discovered assets, and rules of engagement with one click.
26706. **Rules-of-engagement builder** — guided wizard producing the RoE (allowed techniques, blackout windows, contacts) as a signed document.
26707. **Scope-change tracker** — logs every scope addition/removal mid-engagement with requester, approver, and timestamp.
26708. **Scope-restraint evidence for pentest report** — records blocked out-of-scope probes as proof of restraint for the final report.
26709. **Scoping questionnaire** — interactive questionnaire capturing business context, critical assets, and testing constraints before the hunt.
26710. **Asset-discovery scope reconciler** — compares discovered assets against declared scope and flags unknowns for inclusion/exclusion decisions.
26711. **IP-range scope validator** — validates CIDR/DNS scope definitions and warns on overlaps or overly broad ranges.
26712. **Third-party asset exclusion manager** — documents excluded third-party assets with justification and verification.
26713. **Cloud-scope boundary mapper** — defines cloud account/project boundaries in the scope document with resource filters.
26714. **API-scope definer** — captures API endpoints, versions, and keys in scope with rate-limit agreements.
26715. **Blackout-window scheduler** — defines no-test windows (peak hours, releases) enforced automatically by the hunt engine.
26716. **Testing-window enforcer** — hunts automatically pause outside approved windows with audit-logged enforcement.
26717. **Emergency-contact roster** — maintains client emergency contacts per engagement with escalation order.
26718. **Safe-word / kill-switch protocol** — documents the emergency stop procedure and tests it before the hunt starts.
26719. **Data-handling agreement attacher** — attaches the data-handling/retention agreement to the scope pack.
26720. **Evidence-retention clause setter** — defines how long hunt evidence is kept per engagement in the scope doc.
26721. **Destructive-test authorization matrix** — explicitly lists which destructive tests are allowed/denied with sign-offs.
26722. **SE pretext approval register** — documents approved SE pretexts, targets, and no-go personnel.
26723. **Physical-test scope module** — optional physical-security testing scope with site list and authorization letters.
26724. **Wireless-scope module** — defines wireless testing boundaries (SSIDs, sites, rogue-AP rules).
26725. **Internal-network scope module** — documents internal ranges, jump hosts, and segmentation-test permissions.
26726. **Assumed-breach scenario definer** — scopes assumed-breach exercises with starting access level and objectives.
26727. **Red-team objective cards** — defines red-team objectives (flags) with success criteria in the scope doc.
26728. **Blue-team notification rules** — documents whether/when the blue team is informed, logged per engagement.
26729. **Purple-team collaboration plan** — joint red/blue exercise plan with shared timelines and debrief scheduling.
26730. **Re-test scope auto-generator** — builds a focused re-test scope from previously found vulnerabilities.
26731. **Scope effort estimator** — estimates testing effort from scope size to support quoting and scheduling.
26732. **Scope-to-methodology mapper** — maps each in-scope asset class to the testing methodology (OWASP, NIST, PTES).
26733. **Technique-allowlist per asset** — defines which techniques are allowed per asset (e.g., no DoS on production).
26734. **Production-safety constraints** — documents production safeguards (rate limits, read-only modes) enforced by the engine.
26735. **Staging-vs-production scope splitter** — separates staging and production scope with different rules per environment.
26736. **Data-classification scope notes** — notes data classifications in scope to calibrate test aggressiveness.
26737. **Regulatory-scope overlays** — adds PCI/HIPAA/GDPR scope overlays onto the base scope document.
26738. **Multi-target scope pack** — manages scope across multiple targets in one engagement with per-target RoE.
26739. **Client-approval workflow** — routes the scope document for client signature before any testing starts.
26740. **Versioned scope documents** — every scope revision is versioned with diffs and re-approval tracking.
26741. **Scope-acknowledgment receipts** — records that all testers acknowledged the current scope version.
26742. **Tester-assignment matrix** — assigns testers to scope areas with skill matching and conflict checks.
26743. **Subcontractor scope carve-outs** — defines subcontractor testing boundaries within the master scope.
26744. **Insurance-coverage verifier** — confirms the engagement is covered by professional-indemnity insurance.
26745. **Liability-cap documentation** — records liability terms from the MSA in the engagement pack.
26746. **Indemnification clause linker** — links relevant indemnification terms to the scope document.
26747. **Jurisdiction and governing-law notes** — documents applicable law for cross-border engagements.
26748. **Export-control scope check** — verifies testing tools/techniques comply with export controls for the target's jurisdiction.
26749. **Sanctions re-screening** — re-screens targets/clients against sanctions lists at scope-signing time.
26750. **Conflict-of-interest scope check** — checks the target against existing clients for conflicts before scoping.
26751. **Pre-engagement checklist** — mandatory checklist (auth, scope, contacts, insurance) that must pass before hunts start.
26752. **Go/no-go decision log** — formal go/no-go record with criteria and approver before testing begins.
26753. **Kickoff-meeting agenda generator** — builds the kickoff agenda from the scope document automatically.
26754. **Kickoff-minutes archiver** — archives kickoff decisions as part of the engagement record.
26755. **Daily-standup scope tracker** — tracks daily progress against scope coverage during the engagement.
26756. **Scope-coverage meter** — live percentage of in-scope assets/techniques covered during the hunt.
26757. **Mid-engagement scope review** — scheduled checkpoint to adjust scope based on discoveries, logged.
26758. **Scope-creep alert** — alerts when testing approaches scope boundaries or unlisted assets.
26759. **Boundary-proximity warnings** — warns the operator before probes near scope edges execute.
26760. **Auto-pause on boundary breach** — halts the hunt if a probe would exceed scope, pending human review.
26761. **Post-breach scope review** — formal review workflow if a boundary was crossed, with corrective actions.
26762. **Client-notification templates** — pre-written notifications for scope issues, critical finds, and incidents.
26763. **Critical-finding escalation protocol** — defines how critical findings are reported mid-engagement (who, how fast).
26764. **Incident-during-test playbook** — steps if testing causes an incident, with roles and communications.
26765. **Rollback-plan documenter** — documents rollback steps for any state-changing tests performed.
26766. **Evidence-of-authorization wallet** — stores signed authorization letters accessible to testers during the hunt.
26767. **Law-enforcement liaison notes** — documents LE contacts in case testing triggers external reports.
26768. **Abuse-complaint response kit** — pre-built responses for abuse complaints triggered by scanning.
26769. **ISP notification templates** — notifies relevant ISPs/hosts of authorized testing windows where required.
26770. **WAF-whitelisting coordinator** — manages IP allowlisting requests with the client's WAF team, logged.
26771. **Scan-notification log** — logs notifications sent to SOC/NOC about testing activity to avoid false alarms.
26772. **Debrief-scheduling workflow** — schedules the post-engagement debrief with stakeholders automatically.
26773. **Draft-report review workflow** — routes the draft report for internal QA then client factual-accuracy review.
26774. **Factual-accuracy dispute log** — tracks client disputes on findings with evidence-based resolution.
26775. **Final-report sign-off** — formal client sign-off on the final report, archived with the engagement.
26776. **Lessons-learned session planner** — schedules and documents the internal lessons-learned review.
26777. **Engagement-closure checklist** — checklist confirming evidence archived, credentials revoked, access removed.
26778. **Credential-revocation verifier** — proves all test credentials/access were revoked at engagement end.
26779. **Data-destruction certificates** — issues certificates for client-data destruction per the data-handling agreement.
26780. **Retention-exception log** — documents any evidence retained beyond the agreement with justification.
26781. **Follow-up engagement scheduler** — schedules re-tests and next annual tests from the closed engagement.
26782. **Recurring-engagement scope inheritance** — new yearly scopes inherit from prior year with change highlighting.
26783. **Scope-benchmarking** — compares scope thoroughness against similar engagements for quoting accuracy.
26784. **Win/loss scope analysis** — analyzes how scope decisions affected finding yield for future scoping.
26785. **Template library for verticals** — pre-built scope templates for banking, healthcare, retail, SaaS.
26786. **Jurisdiction-specific RoE packs** — RoE variants adapted to US, EU, UK, APAC legal requirements.
26787. **Language-localized scope docs** — scope documents generated in the client's required language.
26788. **Accessibility-compliant documents** — scope docs meet accessibility standards for all stakeholders.
26789. **E-signature integration** — native e-signing of scope documents with audit trail.
26790. **Counter-signature tracker** — tracks both-party signatures with reminders and expiry.
26791. **Amendment workflow** — formal amendment process for mid-engagement RoE changes.
26792. **Side-letter manager** — manages side letters for sensitive scope items separately from the main doc.
26793. **Oral-authorization memorializer** — documents verbal authorizations in writing with confirmation workflow.
26794. **Scope-interpretation log** — logs how ambiguous scope items were interpreted, with client confirmation.
26795. **Scoping-assumption validation register** — records scoping assumptions (e.g., "staging mirrors prod") with validation status.
26796. **Dependency tracker** — tracks client dependencies (access, docs, windows) with SLA and delay impact.
26797. **Delay-impact assessor** — quantifies how client delays affect the testing schedule and report date.
26798. **Change-order generator** — formal change orders for scope expansions with pricing and approval.
26799. **Engagement-profitability tracker** — links scope effort to actual hours for margin analysis.
26800. **Scope-document API** — API to generate and manage scope documents from CRM/GRC integrations.
26801. **CRM opportunity linkage** — links scope docs to the sales opportunity for pipeline traceability.
26802. **Quote-to-scope converter** — converts approved quotes into draft scope documents automatically.
26803. **Scope-completeness scorer** — scores draft scopes for completeness before client review.
26804. **Scoping-knowledge base** — searchable library of past scopes, decisions, and lessons for scoping teams.

## 9. Compliance Gap Analysis (26805–26904)

26805. **Framework-vs-findings gap matrix** — cross-tabulates every framework requirement against current findings to show exactly what's uncovered.
26806. **Remediation priority by compliance impact** — ranks fixes by how many compliance requirements each finding blocks, not just CVSS.
26807. **"What blocks our SOC 2" view** — single dashboard listing precisely which findings stand between the org and SOC 2 readiness.
26808. **Multi-framework overlap analyzer** — shows that fixing one finding satisfies SOC 2, ISO, and PCI simultaneously, maximizing remediation ROI.
26809. **Fix-once-satisfy-many planner** — orders remediation so each fix closes gaps across the maximum number of frameworks.
26810. **Framework-readiness scores** — 0–100 readiness score per framework (SOC 2, PCI, HIPAA, ISO, GDPR) updated after every hunt.
26811. **Gap-aging tracker** — ages open compliance gaps and escalates those threatening upcoming audit dates.
26812. **Audit-date countdown planner** — works backward from the audit date to schedule remediation with buffer time.
26813. **Critical-path gap identifier** — identifies the sequence of gaps that must close first because others depend on them.
26814. **Compensating-control gap filler** — suggests compensating controls for gaps that can't be fixed before the audit.
26815. **Risk-acceptance gap pack** — bundles unfixable gaps into formal risk-acceptance packages with business justification.
26816. **Gap-owner assignment engine** — auto-assigns each gap to the right owner based on asset, team, and control area.
26817. **SLA-by-audit-urgency** — sets remediation SLAs based on proximity to audit dates, not generic severity.
26818. **What-if gap simulator** — simulates "if we fix these 10 findings" to preview readiness-score improvement.
26819. **Budget-to-readiness estimator** — estimates remediation cost vs. readiness gain to prioritize security spending.
26820. **Quick-win gap finder** — surfaces low-effort fixes that close disproportionate compliance gaps.
26821. **Gap-dependency graph** — visualizes which gaps block others (e.g., logging gaps block all detective controls).
26822. **Control-coverage heatmap** — heatmap of frameworks × controls colored by evidence strength.
26823. **Requirement-difficulty rater** — rates each requirement by historical fix effort to calibrate planning.
26824. **Peer-benchmark gap comparison** — anonymized comparison of gap counts vs. industry peers.
26825. **Maturity-model mapper** — maps gaps to a security maturity model (e.g., C2M2 levels) for strategic planning.
26826. **Gap-trend forecaster** — predicts future gap counts from remediation velocity and new-finding rates.
26827. **New-finding gap impact assessor** — instantly shows which frameworks a new finding affects when it lands.
26828. **Duplicate-gap consolidator** — merges the same underlying issue reported across frameworks into one remediation item.
26829. **Recurring-gap detector** — flags gaps that reappear after being closed, indicating systemic control failure.
26830. **Systemic-cause analyzer** — clusters gaps by root cause (e.g., "no WAF") to drive architectural fixes.
26831. **Architectural-gap flagger** — distinguishes gaps needing architecture changes from those needing config fixes.
26832. **Policy-gap detector** — identifies gaps caused by missing policies vs. missing implementations.
26833. **Process-gap vs tech-gap splitter** — separates people/process gaps from technology gaps for correct ownership.
26834. **Third-party-caused gap tracker** — attributes gaps to vendors with contract/SLA linkage for accountability.
26835. **Inherited-control gap verifier** — verifies gaps in inherited (cloud/provider) controls with provider evidence.
26836. **Scope-exclusion gap justifier** — documents why out-of-scope gaps don't affect the audit opinion.
26837. **Sampling-risk estimator** — estimates the chance an auditor samples a weak area, focusing effort there.
26838. **Auditor-focus predictor** — predicts which gaps the auditor will probe based on prior-year comments.
26839. **Prior-year comment resolver** — tracks last audit's comments to verified closure with evidence.
26840. **Management-letter point tracker** — tracks management-letter points separately from formal findings.
26841. **Gap-narrative generator** — writes auditor-ready narratives explaining each gap, its cause, and the plan.
26842. **Remediation-evidence linker** — links each closed gap to its fix evidence and re-test results.
26843. **Partial-remediation tracker** — tracks gaps that are partially remediated with remaining work itemized.
26844. **Interim-control documenter** — documents interim controls in place while permanent fixes are built.
26845. **Gap-exception workflow** — formal exception process for gaps that will remain open through the audit.
26846. **Board-level gap summary** — translates the gap matrix into board language: risk, cost, timeline.
26847. **CFO-ready remediation budget** — itemized remediation budget per gap with ROI in audit-risk terms.
26848. **Resource-planning estimator** — estimates engineer-hours per gap for sprint planning.
26849. **Sprint-planning gap exporter** — exports prioritized gaps into Jira/Linear sprints with compliance context.
26850. **OKR-linked gap goals** — ties gap-closure targets to security OKRs for accountability.
26851. **Gap-SLA breach alerter** — alerts when a gap's remediation SLA is breached with escalation.
26852. **Stale-gap reviewer** — flags gaps untouched for 90+ days for re-validation or closure.
26853. **Auto-closure verifier** — re-tests gaps marked fixed and only closes them on passing evidence.
26854. **Regression-gap monitor** — continuous monitoring to catch closed gaps that regress.
26855. **Environment-drift gap detector** — flags new gaps from infrastructure drift since the last assessment.
26856. **M&A gap consolidator** — merges gap analyses of acquirer and target into one integration plan.
26857. **Divestiture gap splitter** — separates gaps by business unit for carve-outs.
26858. **New-regulation gap importer** — when a new regulation applies, imports its requirements and diffs against current state.
26859. **Regulation-change impact analyzer** — assesses how framework updates (e.g., PCI v4.0) change the gap picture.
26860. **Cross-regulation conflict resolver** — flags where two regulations demand conflicting controls with resolution guidance.
26861. **Strictest-requirement highlighter** — where frameworks overlap, highlights the strictest requirement to satisfy all.
26862. **Unified-control library** — single library of controls mapped to all frameworks, eliminating duplicate work.
26863. **Control-rationalization advisor** — recommends consolidating overlapping controls to reduce audit burden.
26864. **Framework-onboarding wizard** — guided setup when the org adopts a new framework: scope, gaps, plan.
26865. **Framework-sunset planner** — plans evidence archival when dropping a framework certification.
26866. **Certification-roadmap builder** — multi-year roadmap sequencing SOC 2 → ISO → PCI with shared evidence.
26867. **Combined-audit planner** — plans a single fieldwork covering multiple frameworks with one evidence set.
26868. **Auditor-briefing gap deck** — auto-builds the gap-status deck for auditor planning meetings.
26869. **Pre-audit self-attestation** — management self-attestation of gap status before auditors arrive.
26870. **Mock-finding generator** — generates likely auditor findings from gaps to rehearse responses.
26871. **Response-playbook per gap** — pre-written auditor-response talking points for each open gap.
26872. **Evidence-sprint planner** — plans focused evidence-collection sprints for the weakest areas.
26873. **Control-testing calendar** — year-long calendar of control tests ensuring no gap goes untested.
26874. **Continuous-compliance monitor** — always-on checks that alert the moment a new gap appears.
26875. **Compliance-drift dashboard** — shows drift from the last known-good compliance state in real time.
26876. **Alert-fatigue tuner** — tunes gap alerts by audit relevance to avoid noise.
26877. **Executive gap newsletter** — monthly plain-language gap update for executives.
26878. **Department scorecards** — per-team gap ownership scorecards driving accountability.
26879. **Gamified gap closure** — team leaderboards and badges for closing compliance gaps.
26880. **Gap-closure celebration log** — records closed gaps with impact stats for morale and reporting.
26881. **Historical gap archive** — searchable history of all gaps ever found, useful for trend analysis.
26882. **Lessons-learned per gap** — captures what each gap taught about the control environment.
26883. **Control-design feedback loop** — feeds gap patterns back into control design improvements.
26884. **Policy-update recommender** — recommends policy updates based on recurring gap themes.
26885. **Training-need analyzer** — links gap clusters to specific training needs.
26886. **Hiring-signal detector** — identifies skill gaps implied by persistent control failures.
26887. **Tool-coverage gap mapper** — shows which gaps exist because no tool covers that control.
26888. **Build-vs-buy gap advisor** — recommends building vs. buying controls to close structural gaps.
26889. **Vendor-solution matcher** — matches open gaps to vendor solutions with evaluation criteria.
26890. **Open-source control alternatives** — suggests open-source tooling to close gaps cost-effectively.
26891. **Gap-insurance mapper** — maps unclosable gaps to cyber-insurance coverage decisions.
26892. **Risk-transfer recommender** — recommends insurance or outsourcing for gaps cheaper to transfer than fix.
26893. **Residual-risk quantifier** — quantifies residual risk per open gap in financial terms.
26894. **Risk-appetite alignment checker** — verifies open gaps sit within stated risk appetite, flagging breaches.
26895. **Board-risk-committee pack** — gap and residual-risk pack formatted for risk-committee meetings.
26896. **Regulator-inquiry simulator** — simulates regulator questions about open gaps with evidence-backed answers.
26897. **Whistleblower-risk assessor** — assesses whether known gaps create whistleblower/regulatory exposure.
26898. **Disclosure-obligation checker** — flags gaps that may trigger disclosure obligations (SEC, contractual).
26899. **Customer-notification trigger** — identifies gaps requiring customer notification under contracts.
26900. **Gap-remediation API** — API exposing gaps, priorities, and status to ticketing and GRC tools.
26901. **Two-way ticketing sync** — bi-directional sync between gaps and Jira/ServiceNow with status reconciliation.
26902. **ChatOps gap commands** — query and update gaps from Slack/Teams with audit logging.
26903. **Mobile gap approvals** — approve risk acceptances and exceptions from mobile with full audit trail.
26904. **Gap-report scheduler** — scheduled gap reports (daily/weekly/monthly) to stakeholders with trend charts.

## 10. Regulatory Reporting (26905–27004)

26905. **Breach-notification draft generator (72-hour GDPR)** — turns incident findings into a complete Art. 33 supervisory-authority notification draft within the 72-hour window.
26906. **Incident-severity classifier per regulation** — classifies each incident's severity under GDPR, HIPAA, PCI, and SEC rules simultaneously.
26907. **Regulator-specific report formatter** — renders incident reports in each regulator's required format (ICO, HHS OCR, card brands, SEC).
26908. **Filing-deadline tracker** — countdown dashboard of every regulatory filing deadline triggered by an incident.
26909. **Multi-jurisdiction notification planner** — determines which of 50+ jurisdictions require notification for one incident and their deadlines.
26910. **State-breach-law matrix** — maps the incident against all US state breach-notification laws with per-state requirements.
26911. **Attorney-general notification drafter** — drafts state AG notifications where thresholds require them.
26912. **Consumer-notification letter generator** — generates plain-language breach letters to affected individuals per state content rules.
26913. **Credit-monitoring offer tracker** — tracks complimentary credit-monitoring offers where legally or contractually required.
26914. **Media-notice drafter** — drafts prominent media notices for 500+ individual breaches (HIPAA) or state triggers.
26915. **HHS breach-portal submission pack** — assembles the OCR portal submission for breaches affecting 500+ individuals.
26916. **Annual small-breach log filer** — compiles the under-500 breach log for annual HHS submission.
26917. **Card-brand incident reporter** — formats PCI incident reports for Visa/Mastercard/Amex acquirer notification paths.
26918. **Acquirer-notification workflow** — manages the suspected-compromise notification to the acquiring bank with timelines.
26919. **PFI-investigation support pack** — evidence bundle supporting a PCI Forensic Investigator engagement.
26920. **SEC 8-K Item 1.05 drafter** — drafts the 4-business-day material-incident 8-K disclosure from incident findings.
26921. **Materiality-assessment helper** — guided workflow assessing incident materiality for SEC disclosure decisions.
26922. **8-K amendment tracker** — tracks required 8-K/A updates as incident facts evolve.
26923. **Regulation S-K cyber-governance drafter** — drafts the annual 10-K cybersecurity risk-management and governance disclosures.
26924. **CIRCIA 72-hour reporter** — drafts CISA incident reports for covered critical-infrastructure entities.
26925. **CIRCIA ransom-payment reporter** — drafts the 24-hour ransom-payment report where CIRCIA applies.
26926. **EU NIS2 incident reporter** — formats incident notifications under NIS2's 24h/72h/1-month staged timeline.
26927. **DORA incident reporter** — drafts DORA ICT-incident reports for financial entities with classification.
26928. **UK ICO breach reporter** — formats UK GDPR breach reports for the ICO portal.
26929. **Australian NDB reporter** — drafts Notifiable Data Breaches statements for the OAIC.
26930. **Canadian PIPEDA reporter** — drafts breach reports meeting PIPEDA's real-risk-of-significant-harm test.
26931. **Brazil LGPD reporter** — formats ANPD incident communications under LGPD.
26932. **India DPDP incident reporter** — drafts Data Protection Board of India breach notifications.
26933. **Singapore PDPA reporter** — formats PDPC breach notifications with the 3-day assessment workflow.
26934. **Japan APPI reporter** — drafts PPC breach reports under Japan's APPI thresholds.
26935. **South Korea PIPA reporter** — formats PIPC notifications within Korea's 72-hour/24-hour windows.
26936. **UAE PDPL reporter** — drafts UAE federal data-protection breach notifications.
26937. **Saudi PDPL reporter** — formats SDAIA breach notifications under Saudi law.
26938. **Israel PPL reporter** — drafts PPA breach notifications under Israel's amended privacy law.
26939. **Sectoral-regulator mapper** — identifies sectoral regulators (banking, telecom, health) requiring parallel notification.
26940. **RBI cyber-incident reporter** — formats incident reports for the Reserve Bank of India's timelines.
26941. **SEBI incident reporter** — drafts SEBI cybersecurity-incident reports for regulated entities.
26942. **IRDAI breach reporter** — formats insurance-sector breach reports for IRDAI.
26943. **TRAI/security-incident liaison** — documents telecom-sector incident reporting coordination.
26944. **CERT-In 6-hour reporter** — drafts CERT-In incident reports within India's 6-hour mandate.
26945. **Law-enforcement notification drafter** — drafts FBI/CISA/law-enforcement notifications with evidence handling notes.
26946. **Ransomware-payment legality checker** — checks sanctions/legality implications before any ransom-payment reporting.
26947. **OFAC-sanctions screening for payments** — screens ransom-payment scenarios against OFAC lists with documentation.
26948. **Evidence-preservation order tracker** — manages litigation-hold and evidence-preservation obligations post-incident.
26949. **Privilege-protection workflow** — routes incident communications through counsel to preserve privilege, logged.
26950. **Upjohn-warning documenter** — documents counsel's Upjohn warnings in internal investigations.
26951. **Forensic-image chain-of-custody** — tracks forensic image handling from collection to regulator handoff.
26952. **Regulator-interview prep pack** — briefing materials and likely questions for regulator interviews.
26953. **On-site examination support** — organizes evidence for regulator on-site examinations with request tracking.
26954. **Document-request responder** — manages regulator document requests with production logs and privilege review.
26955. **Subpoena-response workflow** — tracks subpoena compliance with deadlines and productions.
26956. **Consent-order compliance tracker** — tracks obligations under regulatory consent orders with evidence.
26957. **Corrective-action commitment tracker** — tracks commitments made to regulators with milestone evidence.
26958. **Per-regulator fine estimator** — estimates potential fines per regulator based on incident facts and history.
26959. **Settlement-scenario modeler** — models settlement ranges from comparable regulatory actions.
26960. **Cooperation-credit documenter** — documents cooperation steps that earn regulatory leniency credit.
26961. **Voluntary-disclosure advisor** — analyzes whether voluntary disclosure to a regulator is advantageous.
26962. **Whistleblower-SEC tip assessor** — assesses whistleblower-report risk and prepares response materials.
26963. **Class-action exposure scanner** — estimates class-action risk from breach facts for legal planning.
26964. **Litigation-hold notifier** — issues and tracks litigation-hold notices to custodians automatically.
26965. **Custodian-interview tracker** — manages custodian interviews for investigations with notes archived.
26966. **Timeline-reconstruction engine** — builds a regulator-ready incident timeline from hunt and log evidence.
26967. **Attack-path visualizer for regulators** — visual attack path diagrams suitable for regulator briefings.
26968. **Impact-quantification report** — quantifies records, systems, and individuals affected with methodology notes.
26969. **Data-exfiltration scope assessor** — determines what data left the environment from observed indicators.
26970. **Containment-evidence pack** — documents containment actions with timestamps for regulator review.
26971. **Eradication-verification report** — proves threat eradication with re-test evidence.
26972. **Recovery-timeline documenter** — documents recovery steps and service-restoration times.
26973. **Lessons-learned regulatory annex** — post-incident improvements formatted for regulator expectations.
26974. **Tabletop-to-filing bridge** — converts tabletop exercise results into filing-readiness improvements.
26975. **Incident-classification playbook** — decision tree classifying incidents into regulatory reporting buckets.
26976. **Severity-escalation matrix** — defines who is notified at each severity level with time targets.
26977. **War-room documentation mode** — structured, timestamped war-room notes admissible for regulators.
26978. **Decision-log for incidents** — logs every major incident decision with rationale for accountability.
26979. **Communication-approval workflow** — routes external incident statements through legal/comms with version control.
26980. **Holding-statement generator** — generates approved holding statements within the first hour of an incident.
26981. **FAQ-for-customers builder** — builds customer breach FAQs from incident facts with legal review.
26982. **Call-center briefing pack** — briefing materials for support teams handling breach inquiries.
26983. **Executive-briefing one-pager** — incident one-pager for the CEO/board within hours of discovery.
26984. **Board-notification tracker** — tracks board notification obligations and confirmations per charter.
26985. **D&O-insurance notifier** — manages directors-and-officers insurer notification with documentation.
26986. **Cyber-insurance claim pack** — assembles the breach documentation the cyber insurer requires.
26987. **Panel-counsel coordinator** — coordinates insurer panel counsel engagement with logged handoffs.
26988. **Forensic-vendor engagement kit** — rapid engagement pack for approved forensic firms.
26989. **PR-firm coordination log** — logs crisis-PR activities and approvals for the record.
26990. **Regulatory-calendar sync** — syncs all filing deadlines to calendars with escalation reminders.
26991. **Deadline-breach escalator** — escalates when a filing deadline is at risk with mitigation options.
26992. **Cross-border filing sequencer** — orders multi-jurisdiction filings to meet the tightest deadline first.
26993. **Translation-certified filings** — manages certified translations of filings for non-English regulators.
26994. **Filing-receipt archiver** — archives regulator acknowledgments as proof of timely filing.
26995. **Late-filing justification drafter** — drafts reasonable-cause explanations if a deadline is missed.
26996. **Regulatory-change monitor** — tracks changes in breach-notification laws and updates templates.
26997. **Template-version control** — versions all regulatory templates with change logs.
26998. **Jurisdiction-rule engine** — rules engine encoding 100+ jurisdictions' notification triggers and deadlines.
26999. **Threshold-calculator** — computes whether individual-count thresholds trigger notifications per jurisdiction.
27000. **Harm-assessment documenter** — documents risk-of-harm analyses supporting notification decisions.
27001. **Notification-decision memo** — formal memo recording why notification was/wasn't made, for the file.
27002. **Regulator-relationship log** — history of regulator interactions informing communication strategy.
27003. **Post-incident regulatory review** — structured review of filing performance feeding playbook improvements.
27004. **Regulatory-reporting API** — API exposing incident classifications, deadlines, and filing status to GRC/legal tools.
