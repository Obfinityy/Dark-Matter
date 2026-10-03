# Part 10 — Infrastructure & config (49005–50004)

49005. **Public S3 bucket exposure monitor** — Continuously probes bucket endpoints from an unauthenticated vantage point to flag any bucket that returns object listings or file contents publicly.
49006. **Bucket-policy wildcard-principal auditor** — Parses bucket policies for statements granting access to wildcard or any-authenticated-user principals and reports them as over-permissive.
49007. **ACL-vs-policy differential detector** — Compares per-object ACLs against the bucket policy to surface objects whose effective permissions are wider than the policy intends.
49008. **S3 Block Public Access verifier** — Checks all four S3 Block Public Access toggles at account and bucket level and flags any bucket where public access is not fully blocked.
49009. **Bucket versioning compliance checker** — Verifies versioning is enabled on production data buckets so accidental or malicious deletes remain recoverable.
49010. **MFA Delete enforcement auditor** — Confirms MFA Delete is enabled on versioned buckets holding critical data and flags buckets where permanent deletion needs no second factor.
49011. **Default encryption configuration verifier** — Validates that every bucket enforces server-side encryption by default and identifies buckets still accepting unencrypted objects.
49012. **SSE-KMS key-scope auditor** — Reviews which KMS keys encrypt bucket data, flagging buckets using the shared AWS-managed key where a customer-managed key is required by policy.
49013. **S3 Bucket Key configuration checker** — Verifies S3 Bucket Key is enabled for SSE-KMS buckets and confirms the setting matches the intended encryption posture.
49014. **TLS-only bucket policy enforcer check** — Audits bucket policies for an explicit aws:SecureTransport deny so unencrypted HTTP object access is impossible.
49015. **Server-access logging verifier** — Confirms S3 server access logging is enabled with a dedicated non-public logging bucket and flags data buckets with logging disabled.
49016. **CloudTrail S3 data-event logging audit** — Verifies CloudTrail records object-level data events for sensitive buckets and reports gaps in API activity visibility.
49017. **Object Lock compliance-mode verifier** — Checks that regulated buckets use Object Lock in Compliance mode with retention periods, flagging Governance-mode-only or missing retention setups.
49018. **Legal-hold status auditor** — Inventories objects under legal hold and flags regulated buckets where no holds or retention rules exist despite policy requirements.
49019. **Lifecycle-policy completeness checker** — Reviews lifecycle rules for transition and expiration coverage, flagging buckets accumulating stale data with no lifecycle management.
49020. **CORS policy over-permissiveness scanner** — Parses bucket CORS configurations for wildcard origins combined with credentialed methods and flags risky cross-origin exposure.
49021. **Static-website-hosting exposure detector** — Identifies buckets with static website hosting enabled and assesses whether the website endpoint is intentionally public or an accidental exposure.
49022. **CloudFront OAC migration auditor** — Detects distributions still using legacy Origin Access Identity instead of Origin Access Control and recommends migration for tighter origin security.
49023. **S3 origin direct-access exposure check** — Verifies bucket policies restrict access to the CloudFront origin identity so the S3 origin hostname cannot be read directly, bypassing CDN controls.
49024. **Referer-conditioned policy weakness auditor** — Flags bucket policies that rely solely on Referer conditions for protection, since Referer headers are trivially spoofable by clients.
49025. **IP-allowlist staleness reviewer** — Audits IP-based bucket policy conditions for stale or overly broad CIDR ranges, such as former office IPs or very large blocks.
49026. **Time-bombed policy condition detector** — Parses date-based Condition clauses to find temporary access grants whose expiry has passed but were never revoked.
49027. **Cross-account bucket trust auditor** — Lists cross-account principals in bucket policies and flags trusts to unknown, external, or dormant AWS accounts.
49028. **VPC-endpoint condition coverage check** — Verifies sensitive buckets require access via specific VPC endpoints and flags buckets reachable from any network path.
49029. **Object-ownership (BucketOwnerEnforced) verifier** — Confirms buckets use BucketOwnerEnforced ownership controls so object writers cannot retain ACL-based control over uploaded objects.
49030. **Access-point policy auditor** — Reviews S3 Access Point policies and their network-origin controls, flagging access points with broader permissions than the underlying bucket intends.
49031. **Multi-Region Access Point policy checker** — Audits global access point routing and failover policies for unintended cross-region data exposure.
49032. **S3 Access Grants inventory auditor** — Enumerates S3 Access Grants and their grantee mappings, flagging grants to overly broad IAM identities or stale directory users.
49033. **Presigned-URL expiry policy auditor** — Reviews application configurations and IAM policies for presigned-URL lifetimes, flagging URLs valid for days where minutes would suffice.
49034. **Inventory-report configuration verifier** — Confirms S3 Inventory is enabled with encrypted report delivery for regulated buckets, supporting ongoing auditability.
49035. **Replication configuration completeness check** — Verifies replication rules cover all required prefixes and that the replication IAM role follows least privilege.
49036. **Replication Time Control status auditor** — Checks whether RTC with its 15-minute SLA is enabled where recovery-point objectives demand predictable replication.
49037. **Delete-marker replication auditor** — Confirms delete-marker replication settings match data-protection policy so deletions propagate or are contained as intended.
49038. **Storage Lens dashboard coverage audit** — Verifies S3 Storage Lens is enabled at the organization level with activity metrics so storage posture is centrally visible.
49039. **Macie sensitive-data discovery status check** — Confirms Amazon Macie discovery jobs cover regulated buckets and that findings feed into the security workflow.
49040. **GuardDuty S3 protection status verifier** — Checks that GuardDuty S3 Protection is enabled in all regions and that threat findings for storage are actively monitored.
49041. **IAM Access Analyzer S3 findings reviewer** — Collects Access Analyzer findings for unintended public or cross-account bucket access and tracks them to resolution.
49042. **Trusted Advisor S3 security checks mapper** — Maps AWS Trusted Advisor storage findings for open access, logging, and versioning into the audit backlog with severity and owner.
49043. **AWS Config storage-rule conformance audit** — Verifies Config rules for bucket logging and versioning are deployed and reporting compliant across accounts.
49044. **Orphaned-bucket detector** — Identifies buckets with no owner tags, no recent access, and no associated application, flagging forgotten storage that escapes governance.
49045. **Dormant-public-policy detector** — Finds buckets whose policies allow public or cross-account access but show no legitimate traffic, prioritizing them for lockdown.
49046. **Console-created bucket drift auditor** — Compares manually created buckets against infrastructure-as-code baselines to catch configuration drift outside the approved pipeline.
49047. **Bucket-tag compliance auditor** — Verifies mandatory tags for owner, data classification, and environment exist on every bucket and flags untagged storage as unaudited.
49048. **Data-classification tag enforcement check** — Confirms buckets holding regulated data carry the correct classification tags that drive encryption and logging policies.
49049. **Notification-configuration security audit** — Reviews S3 event notifications for destinations outside approved accounts or unencrypted SNS/SQS targets.
49050. **S3 Select exposure reviewer** — Audits which principals may run S3 Select queries against sensitive objects, ensuring query access matches read-access policy.
49051. **Batch Operations job auditor** — Reviews S3 Batch Operations jobs and their IAM roles for least-privilege scope and flags jobs touching regulated prefixes.
49052. **Object Lambda access-point reviewer** — Audits S3 Object Lambda access points that transform data on retrieval, verifying transformation code and caller permissions.
49053. **Directory-bucket (S3 Express) policy auditor** — Checks S3 Express One Zone directory bucket policies and session-based authorization for overly broad access.
49054. **S3 Tables (Iceberg) policy auditor** — Reviews table-bucket policies and namespace permissions for analytics storage holding sensitive datasets.
49055. **Glacier Vault Lock compliance verifier** — Confirms Vault Lock policies are in Compliance mode for archival buckets with legal retention obligations.
49056. **Deep Archive retrieval-policy auditor** — Reviews expedited and bulk retrieval permissions on archive tiers to prevent unexpected data restoration by unauthorized roles.
49057. **Requester-Pays configuration reviewer** — Audits Requester Pays settings to ensure cost attribution matches policy and that anonymous requesters cannot trigger charges.
49058. **Transfer Acceleration exposure check** — Verifies transfer acceleration endpoints are enabled only where needed and covered by the same bucket policies as regional endpoints.
49059. **Dual-stack endpoint policy parity auditor** — Confirms IPv6 dual-stack bucket endpoints inherit identical policy controls as IPv4 endpoints.
49060. **Outposts bucket access auditor** — Reviews S3 on Outposts bucket policies and local gateway routing for on-premises storage exposure.
49061. **Mountpoint-for-S3 access reviewer** — Audits IAM roles and mount configurations for Mountpoint for S3 to ensure filesystem-style access honors bucket policies.
49062. **Analytics export configuration checker** — Verifies S3 analytics exports land in governed buckets with encryption rather than ad-hoc destinations.
49063. **CloudWatch storage-metrics coverage audit** — Confirms request metrics and daily storage metrics are enabled for buckets under active security monitoring.
49064. **Data-perimeter policy auditor for storage** — Validates SCPs and resource-control policies that confine S3 access to expected networks and identities.
49065. **PrivateLink S3 interface-endpoint policy audit** — Reviews VPC interface endpoint policies for S3, flagging endpoints that permit broader bucket access than intended.
49066. **GCP uniform bucket-level access auditor** — Verifies uniform bucket-level access is enabled so legacy object ACLs cannot silently widen permissions.
49067. **GCP public IAM binding detector** — Scans bucket IAM policies for allUsers or allAuthenticatedUsers bindings and flags them for immediate review.
49068. **GCP retention-policy verifier** — Confirms retention policies exist on regulated GCS buckets and that retention durations match compliance requirements.
49069. **GCP retention-policy lock auditor** — Checks whether retention policies are locked, preventing even admins from shortening retention on regulated data.
49070. **GCP soft-delete policy reviewer** — Verifies soft-delete retention windows on buckets so recently deleted objects remain recoverable during incident response.
49071. **GCP hierarchical-namespace folder IAM auditor** — Reviews folder-level IAM in hierarchical-namespace buckets for inherited permissions wider than intended.
49072. **GCP public-access-prevention enforcer check** — Verifies the organization policy constraint against public IAM grants is enforced on every project with storage.
49073. **GCP CMEK encryption auditor** — Confirms customer-managed encryption keys protect regulated GCS buckets rather than Google-managed keys.
49074. **GCP bucket logging verifier** — Checks that access and storage-usage logs are enabled for audited GCS buckets.
49075. **GCP object-versioning status checker** — Verifies object versioning is enabled on buckets where recovery from overwrite matters.
49076. **GCP lifecycle-management auditor** — Reviews lifecycle rules for stale-data cleanup and flags buckets with no lifecycle governance.
49077. **GCP CORS configuration reviewer** — Audits GCS CORS settings for wildcard origins on buckets serving sensitive content.
49078. **GCP signed-URL lifetime auditor** — Reviews signed-URL and signed-policy-document lifetimes in application configs, flagging excessive validity windows.
49079. **GCP VPC Service Controls storage audit** — Verifies storage buckets sit inside the correct VPC Service Controls perimeter to block data-exfiltration paths.
49080. **Azure Blob public-access-level auditor** — Checks the storage account allowBlobPublicAccess setting and per-container public access levels, flagging any anonymous read surface.
49081. **Azure storage network-rules auditor** — Reviews storage account firewall rules, trusted-services bypass, and private-endpoint coverage for data-plane lockdown.
49082. **Azure SAS-token scope and expiry auditor** — Inventories shared access signatures for excessive permissions, IP ranges, or lifetimes, flagging tokens valid for months.
49083. **Azure stored-access-policy reviewer** — Verifies SAS tokens are backed by revocable stored access policies rather than irrevocable ad-hoc signatures.
49084. **Azure encryption-scope auditor** — Confirms encryption scopes with customer-managed keys are applied to regulated containers.
49085. **Azure immutable-blob (WORM) policy verifier** — Checks time-based retention and legal-hold policies on compliance containers.
49086. **Azure soft-delete and versioning checker** — Verifies blob soft delete, container soft delete, and versioning are enabled for recovery readiness.
49087. **Azure Defender-for-Storage status auditor** — Confirms Microsoft Defender for Storage is enabled on high-value storage accounts with alert routing configured.
49088. **Azure private-endpoint DNS configuration audit** — Verifies private endpoints for storage resolve correctly and that public endpoint access is disabled where required.
49089. **Firebase Storage rules auditor** — Statically analyzes Firebase Storage security rules for allow-read or allow-write grants missing authentication or ownership checks.
49090. **Supabase Storage RLS policy auditor** — Reviews Supabase storage bucket RLS policies for permissive USING or WITH CHECK clauses that expose user files.
49091. **Cloudflare R2 public-bucket detector** — Audits R2 buckets with public development URLs or custom-domain bindings for unintended exposure.
49092. **Backblaze B2 bucket-privacy auditor** — Verifies B2 buckets are private by default and reviews application keys for excessive capabilities.
49093. **DigitalOcean Spaces CDN exposure reviewer** — Checks Spaces CDN enablement and edge-cache rules for sensitive objects served through the CDN.
49094. **MinIO deployment policy auditor** — Reviews self-hosted MinIO bucket policies, console exposure, and root-credential rotation for on-premises object storage.
49095. **OCI pre-authenticated-request auditor** — Inventories Oracle Cloud pre-authenticated requests for overly broad access scopes and excessive expiry times.
49096. **Alibaba OSS ACL and policy auditor** — Reviews OSS bucket ACLs, RAM policies, and hotlink-protection settings for public exposure.
49097. **Wasabi bucket-policy parity checker** — Confirms Wasabi buckets mirror the same policy rigor as primary AWS buckets in multi-cloud setups.
49098. **Bucket-discovery asset-inventory builder** — Builds a defensive inventory of organization-linked buckets from certificate transparency, DNS, and code references so every bucket is known and audited.
49099. **Code-referenced bucket cross-checker** — Correlates bucket names found in frontend bundles, mobile apps, and IaC against the governed inventory to catch shadow storage.
49100. **Terraform-state exposure detector** — Scans for Terraform state files stored in publicly readable buckets, which would leak infrastructure secrets and topology.
49101. **IaC-template leakage detector** — Flags CloudFormation, ARM, or Terraform templates stored in public buckets that disclose architecture and resource names.
49102. **Logging-bucket exposure verifier** — Specifically audits the buckets receiving access logs and CloudTrail output, since public log buckets leak full request history.
49103. **Backup-bucket cross-account auditor** — Reviews backup and snapshot buckets shared across accounts for least-privilege replication roles and encrypted copies.
49104. **Stale multipart-upload cleaner auditor** — Detects incomplete multipart uploads lingering in buckets, which waste cost and may hold partial sensitive data outside lifecycle rules.
49105. **Over-permissive IAM role detector** — Flags roles whose policies grant administrative or near-administrative scope far beyond the workload's documented need.
49106. **Wildcard-action policy flagger** — Scans IAM policies for wildcard actions such as iam:* or * and reports them as candidates for least-privilege reduction.
49107. **Admin-policy attachment auditor** — Inventories attachments of AWS-managed AdministratorAccess and equivalent admin policies, flagging each for justification review.
49108. **Unused access key flagger** — Identifies IAM access keys with no recorded use in the last 90 days and recommends disablement or deletion.
49109. **Access key age rotation auditor** — Flags access keys older than the rotation policy window and tracks them until rotated.
49110. **Access key last-used reviewer** — Correlates each key's last-used timestamp with its owner to confirm the key is still needed by an active workload.
49111. **Dormant IAM user detector** — Finds IAM users with no console or programmatic activity beyond the inactivity threshold for deprovisioning review.
49112. **Dormant role detector** — Identifies roles with no AssumeRole calls in the review window, flagging forgotten privilege that should be removed.
49113. **Unused managed policy detector** — Lists customer-managed policies attached to nothing or to dormant principals for cleanup.
49114. **Console password age auditor** — Flags IAM user passwords older than the maximum-age policy for forced rotation.
49115. **MFA-not-enabled user flagger** — Lists console-capable users without MFA enrolled and tracks remediation to full coverage.
49116. **MFA method-strength auditor** — Compares enrolled MFA methods across privileged users, flagging SMS-only enrollment where phishing-resistant methods are required.
49117. **Phishing-resistant MFA coverage checker** — Measures FIDO2 or smart-card MFA adoption among administrators against the target coverage percentage.
49118. **Root account MFA verifier** — Confirms hardware MFA is enabled on every AWS account root and that no root access keys exist.
49119. **Root access key existence detector** — Flags any active access key on an account root as a critical finding requiring immediate deletion.
49120. **Root usage alerting auditor** — Verifies CloudWatch/EventBridge alerting fires on any root sign-in or root API activity.
49121. **Password policy compliance checker** — Validates account password policies for length, complexity, rotation, and reuse against the benchmark standard.
49122. **Permission boundary coverage auditor** — Verifies permission boundaries are attached to all delegated roles and users to cap maximum privilege.
49123. **SCP deny-list completeness auditor** — Reviews service control policies for required guardrail denies such as leaving the organization or disabling logging.
49124. **IAM Access Analyzer unused-access reviewer** — Collects Access Analyzer unused-access findings and drives least-privilege policy tightening per principal.
49125. **Privilege-combination risk auditor** — Flags risky permission combinations such as PassRole paired with compute-launch rights that enable defensive privilege-escalation paths.
49126. **Cross-account trust inventory auditor** — Enumerates every cross-account role trust and maps it to a known business relationship for periodic recertification.
49127. **External-ID condition verifier** — Confirms cross-account trusts to third parties require a unique external ID so confused-deputy misuse is blocked.
49128. **Wildcard-principal trust detector** — Flags role trust policies with wildcard principals that accept assumption from any account.
49129. **SAML provider certificate expiry monitor** — Tracks IdP signing-certificate expiry dates and alerts before federation breaks or falls back insecurely.
49130. **OIDC provider thumbprint auditor** — Verifies OIDC provider thumbprints match the IdP's current signing certificates to prevent token-acceptance failures or spoofing.
49131. **SSO group-to-permission-set mapping auditor** — Reviews Identity Center assignments for groups granted broader permission sets than their job function needs.
49132. **Break-glass account readiness auditor** — Verifies emergency accounts exist, are monitored, use hardware MFA, and have sealed credentials stored per procedure.
49133. **JIT elevation workflow auditor** — Confirms privileged access is granted just-in-time with approval, time bounds, and full audit logging rather than standing.
49134. **Standing-admin vs ephemeral-access comparator** — Measures the ratio of standing administrative grants to JIT grants and drives it toward zero standing privilege.
49135. **Session duration policy auditor** — Verifies role session durations and federation token lifetimes match policy minimums to bound stolen-session impact.
49136. **Instance profile scope auditor** — Reviews EC2 instance-profile policies, flagging profiles with broader rights than the hosted application requires.
49137. **Lambda execution role least-privilege auditor** — Audits Lambda execution roles for unused permissions and flags functions running with wildcard resource scope.
49138. **ECS task role scope auditor** — Reviews ECS task and task-execution roles separately, ensuring application permissions never leak into the execution role.
49139. **EKS IRSA trust-condition auditor** — Verifies IRSA trust policies constrain the exact service account and namespace via OIDC subject conditions.
49140. **GCP primitive-role detector** — Flags Owner, Editor, and Viewer primitive-role grants as candidates for replacement with predefined or custom least-privilege roles.
49141. **GCP service-account key age auditor** — Flags user-managed service-account keys older than the rotation window and tracks migration to workload identity.
49142. **GCP workload-identity adoption verifier** — Measures replacement of long-lived service-account keys with workload identity federation across GKE and compute workloads.
49143. **GCP organization-policy constraint auditor** — Verifies preventive org-policy constraints such as domain-restricted sharing are enforced on every folder and project.
49144. **Azure PIM eligible-assignment reviewer** — Audits Privileged Identity Management eligible versus active assignments, driving privileged roles to eligible-only with approval.
49145. **Azure PIM activation MFA auditor** — Confirms PIM role activation requires MFA, approval, and justification with time-limited duration.
49146. **Azure service-principal secret expiry monitor** — Tracks service-principal client-secret and certificate expiries and flags secrets valid far beyond policy.
49147. **Azure managed-identity adoption auditor** — Measures replacement of stored service-principal secrets with system- or user-assigned managed identities.
49148. **Conditional Access policy gap analyzer** — Compares Conditional Access coverage against the required matrix of users, apps, and risk levels to find unprotected combinations.
49149. **Legacy-authentication protocol detector** — Flags sign-ins using legacy protocols such as basic auth, IMAP, or old Office clients for protocol blocking.
49150. **Guest-user access reviewer** — Periodically reviews B2B guest accounts for continued need, least-privilege group membership, and access-review completion.
49151. **Access-review cadence auditor** — Verifies recurring access reviews run on schedule for privileged roles, guests, and third-party apps with documented decisions.
49152. **OAuth app consent-grant auditor** — Inventories user-consented OAuth grants to third-party apps and flags high-privilege consents for admin review.
49153. **Third-party enterprise-app permission reviewer** — Reviews enterprise application API permissions against actual integration needs, flagging over-scoped app roles.
49154. **Admin-consent workflow auditor** — Verifies admin-consent requests route through an approval workflow and that risky permissions require security sign-off.
49155. **App-registration ownership auditor** — Flags app registrations with no active owner or with owners who left the organization.
49156. **Token lifetime policy auditor** — Reviews access-token, ID-token, and session lifetimes against policy maximums to bound replay and theft impact.
49157. **Refresh-token rotation verifier (infra-audit)** — Confirms refresh-token rotation is enabled so a stolen refresh token cannot be replayed indefinitely.
49158. **Device-compliance sign-in policy auditor** — Verifies sign-in policies require compliant or hybrid-joined devices for privileged and sensitive application access.
49159. **Risk-based sign-in policy coverage checker** — Confirms identity-protection risk policies cover all privileged users with appropriate remediation actions.
49160. **KMS key policy auditor** — Reviews KMS key policies for wildcard principals and confirms key-administrator and key-user roles are separated.
49161. **KMS grant inventory reviewer** — Enumerates KMS grants, flagging long-lived or overly broad grants that bypass key-policy controls.
49162. **KMS automatic rotation verifier** — Confirms automatic annual rotation is enabled for customer-managed keys and tracks keys with rotation disabled.
49163. **Secrets Manager rotation-enabled checker** — Verifies rotation is configured for database and service credentials in Secrets Manager with successful recent rotations.
49164. **Key Vault access-policy least-privilege auditor** — Reviews Azure Key Vault access policies and RBAC assignments for least-privilege secret, key, and certificate operations.
49165. **CloudTrail IAM-change trail auditor** — Verifies every IAM mutation is captured by an untampered, log-validated CloudTrail trail with restricted write access.
49166. **IAM policy version sprawl detector** — Flags policies with excessive versions or frequent unreviewed changes indicating uncontrolled privilege drift.
49167. **Inline-policy usage auditor** — Discourages inline policies by inventorying them and driving migration to versioned, reviewable managed policies.
49168. **Deny-statement coverage checker** — Verifies explicit deny statements guard critical actions such as disabling logging, leaving the organization, or deleting backups.
49169. **NotAction/NotResource risk reviewer** — Flags NotAction and NotResource elements that silently expand scope beyond what reviewers assume.
49170. **MFA-condition-key coverage auditor** — Verifies sensitive actions require aws:MultiFactorAuthPresent or MultiFactorAuthAge conditions in policy.
49171. **Tag-based ABAC policy auditor** — Reviews attribute-based access policies for consistent tag enforcement and flags principals missing required tags.
49172. **Federation session-tagging auditor** — Confirms federated sessions carry job-function tags so ABAC policies evaluate correctly for SSO users.
49173. **Role-chaining depth auditor** — Limits and audits chains of role assumptions that obscure the original identity in audit trails.
49174. **Vendor-access trust recertification tracker** — Schedules periodic recertification of every third-party cross-account trust with documented business justification.
49175. **Offboarding completeness auditor** — Cross-checks HR termination records against IAM to find dangling accounts, keys, and role assignments.
49176. **Contractor access expiry monitor** — Tracks contractor and temporary-worker access against contract end dates and flags access surviving past expiry.
49177. **Shared-credential usage detector** — Flags credentials used concurrently from disparate networks or by multiple identities as shared-credential violations.
49178. **Credential-use anomaly baseline auditor** — Verifies behavioral baselines exist for privileged credential use so anomalous logins generate alerts.
49179. **Alternate account contacts auditor** — Confirms security, billing, and operations contacts are set and current on every cloud account.
49180. **Organizations OU-structure auditor** — Reviews OU design for workload separation and confirms SCPs attach at the correct OU level.
49181. **Delegated-administrator scope auditor** — Reviews delegated administrator registrations to ensure each service's admin scope is minimal.
49182. **Identity Center permission-set auditor** — Audits permission sets for wildcard policies and confirms each maps to a single job function.
49183. **SCIM deprovisioning completeness auditor** — Verifies SCIM provisioning promptly disables SaaS accounts on HR termination events.
49184. **Joiner-mover-leaver automation auditor** — Confirms identity-lifecycle automation provisions, adjusts, and revokes access on HR events without manual gaps.
49185. **Emergency-access procedure auditor** — Tests that emergency-access accounts and procedures work under drill conditions with full logging.
49186. **Shared admin credential vaulting auditor** — Verifies shared administrative credentials live only in the vault with checkout logging and automatic rotation.
49187. **SSH key-pair inventory auditor** — Inventories EC2 key pairs, GitHub deploy keys, and authorized_keys entries, flagging keys with unknown owners.
49188. **Git commit-signing enforcement auditor** — Verifies required commit signing with GPG or SSH keys on protected branches and tracks unsigned-merge exceptions.
49189. **Code-signing certificate inventory auditor** — Tracks code-signing certificates, their expiries, and HSM-backed storage for release-signing keys.
49190. **CI service-account scope auditor** — Reviews machine identities used by CI systems for least-privilege scope and short credential lifetimes.
49191. **Machine-identity inventory builder** — Builds a complete inventory of service accounts, API keys, and workload identities so every machine credential has an owner.
49192. **Workload-identity federation adoption auditor** — Tracks migration from stored cloud credentials to workload identity federation across CI and compute platforms.
49193. **SPIFFE trust-bundle auditor** — Verifies SPIFFE trust bundles are current and that workload attestation policies match deployment reality.
49194. **Certificate-based auth expiry monitor** — Tracks client-certificate expiries used for service authentication and alerts before outages or fallback to weaker auth.
49195. **FIDO2 enforcement coverage checker** — Measures phishing-resistant authenticator enrollment across the workforce against the mandated rollout target.
49196. **Recovery-code storage policy auditor** — Verifies MFA recovery codes are stored securely per policy rather than in plaintext tickets or shared docs.
49197. **Help-desk MFA-reset procedure auditor** — Audits the identity-verification steps help-desk follows before resetting MFA, ensuring social-engineering resistance.
49198. **Session-revocation capability tester** — Periodically verifies that compromised sessions and tokens can actually be revoked across IdP, apps, and APIs.
49199. **Short-lived SSH certificate adoption auditor** — Tracks migration from static SSH keys to short-lived SSH certificates issued by the certificate authority.
49200. **Webhook secret rotation auditor** — Inventories webhook signing secrets and verifies rotation schedules so leaked secrets have bounded lifetimes.
49201. **Deploy-key scope auditor** — Reviews repository deploy keys for write access where read-only suffices and flags keys on archived repos.
49202. **PAT scope and expiry auditor** — Inventories personal access tokens for excessive scopes and expiries, flagging tokens valid for years.
49203. **Service-account sprawl detector** — Finds service accounts with no owner, no recent use, or duplicated purpose for consolidation or removal.
49204. **Dormant-admin detector** — Surfaces administrative accounts with no recent privileged activity for deprovisioning or conversion to JIT access.
49205. **Pipeline secret-in-env-var detector** — Scans CI workflow definitions for hardcoded secrets in environment variables and flags them for vault migration.
49206. **CI log secret-redaction verifier** — Verifies pipeline logs mask secrets and that accidental secret echoes trigger alerts rather than persisting in log history.
49207. **GITHUB_TOKEN permission-scoping auditor** — Checks that GitHub Actions workflows declare minimal token permissions instead of inheriting broad defaults.
49208. **OIDC-to-cloud adoption auditor** — Measures migration from long-lived cloud credentials in CI to short-lived OIDC federation for deployments.
49209. **Workflow script-injection surface auditor** — Reviews workflow files for untrusted input interpolated into run scripts, flagging injection-prone patterns for remediation.
49210. **Third-party Action pinning auditor** — Verifies all third-party GitHub Actions are pinned to full commit SHAs rather than mutable tags or branches.
49211. **Third-party Action trust reviewer** — Maintains an allowlist of vetted Actions and flags newly introduced or unreviewed third-party Actions.
49212. **pull_request_target trigger risk auditor** — Flags workflows using pull_request_target that check out untrusted code, requiring explicit security review.
49213. **Environment protection-rule auditor** — Verifies deployment environments require approvals, branch restrictions, and wait timers before production deploys.
49214. **Required-reviewer enforcement checker** — Confirms environment protection rules name required reviewers and that self-approval is blocked.
49215. **Branch-protection completeness auditor** — Verifies protected branches require pull requests, status checks, signed commits, and block force pushes.
49216. **CODEOWNERS coverage auditor** — Checks that security-sensitive paths have designated code owners so changes get expert review.
49217. **Secret-scanning push-protection status checker** — Confirms secret scanning with push protection is enabled on every repository and tracks bypass events.
49218. **Commit-signing enforcement auditor** — Verifies required commit signatures on protected branches so pipeline-triggering commits are attributable.
49219. **Build provenance attestation auditor** — Checks that builds emit SLSA provenance attestations recording source, builder, and materials.
49220. **Artifact signing coverage checker** — Verifies release artifacts are signed with Sigstore or Cosign and that signatures validate before deployment.
49221. **Build reproducibility verifier (infra-audit)** — Rebuilds artifacts from source to confirm byte-identical outputs, detecting tampered build environments.
49222. **Cache-poisoning scope auditor** — Reviews pipeline cache keys and scopes to ensure untrusted branches cannot poison caches consumed by protected branches.
49223. **Artifact retention-policy auditor** — Verifies artifact retention windows balance forensic needs against storage of potentially sensitive build outputs.
49224. **Deployment approval-gate auditor** — Confirms production deployments pass manual or policy-based approval gates with recorded approvers.
49225. **Separation-of-duties auditor** — Verifies the identities that build artifacts differ from those approving production deployment where policy requires it.
49226. **Break-glass deployment procedure auditor** — Reviews emergency deploy procedures for logging, post-hoc approval, and automatic revocation of elevated pipeline rights.
49227. **SBOM generation coverage auditor** — Verifies every build produces a complete SBOM in a standard format and stores it with the artifact.
49228. **Vulnerability-scan gate enforcement auditor** — Confirms pipeline quality gates fail builds on critical vulnerabilities rather than merely warning.
49229. **Container-scan gate auditor** — Verifies container images are scanned before registry push with blocking thresholds for fixable critical CVEs.
49230. **IaC-scan gate auditor** — Confirms infrastructure-as-code changes pass policy scans for misconfigurations before apply.
49231. **License-compliance gate auditor** — Verifies dependency license scans block copyleft or prohibited licenses from shipping.
49232. **DAST gate auditor** — Confirms dynamic scans run against staging builds with findings tracked before production release.
49233. **Pre-merge security-check auditor** — Verifies pull requests cannot merge until SAST, secret scanning, and dependency checks report clean.
49234. **Pipeline-as-code review coverage auditor** — Ensures workflow definition changes receive the same peer review as application code.
49235. **Pipeline template governance auditor** — Verifies centrally managed pipeline templates are used and that local overrides stay within guardrails.
49236. **Self-hosted runner isolation auditor** — Checks self-hosted runners for network segmentation, non-root execution, and single-tenant isolation.
49237. **Ephemeral-runner adoption checker** — Measures migration to single-job ephemeral runners that prevent cross-job secret residue.
49238. **Runner image hardening verifier** — Audits runner VM or container images for CIS hardening, minimal tooling, and timely patching.
49239. **Runner network-egress restriction auditor** — Verifies runners can only reach approved registries and APIs, limiting exfiltration during builds.
49240. **Runner disk-cleanup verification** — Confirms runners wipe workspaces, caches, and credentials between jobs on non-ephemeral hosts.
49241. **Orphaned-runner detector** — Finds registered runners that no longer exist or never check in, revoking their tokens.
49242. **Runner registration-token rotation auditor** — Verifies runner registration tokens rotate on schedule and that stale tokens are revoked.
49243. **Jenkins script-console access auditor** — Verifies Jenkins script console and Groovy access require admin authentication with audit logging.
49244. **Jenkins agent hardening checker** — Audits Jenkins agents for least-privilege labels, encrypted channels, and isolation from the controller.
49245. **GitLab protected-variable scope auditor** — Verifies CI variables are protected and masked, scoped to protected branches and environments only.
49246. **GitLab trigger-token inventory auditor** — Inventories pipeline trigger tokens, flagging tokens with broad scope or no expiry.
49247. **GitLab runner-token rotation auditor** — Verifies GitLab runner authentication tokens rotate and that offline runners are deauthorized.
49248. **Azure DevOps PAT scope auditor** — Reviews Azure DevOps personal access tokens for minimal scopes and short lifetimes.
49249. **Azure DevOps agent-pool isolation auditor** — Verifies agent pools separate production deployments from untrusted pull-request builds.
49250. **Bitbucket OIDC-pipeline adoption auditor** — Tracks migration of Bitbucket Pipelines from stored cloud keys to OIDC federation.
49251. **CircleCI context restriction auditor** — Verifies CircleCI contexts restrict secret access to specific projects and branches.
49252. **Buildkite agent-token scope auditor** — Reviews Buildkite agent tokens and cluster queues for least-privilege job assignment.
49253. **ArgoCD RBAC scope auditor** — Audits ArgoCD RBAC roles and project restrictions to ensure teams can only sync their own applications.
49254. **ArgoCD repository-credential auditor** — Reviews ArgoCD repository credentials and flags shared credentials or credentials with write access where read-only suffices.
49255. **FluxCD source-verification auditor** — Verifies Flux sources enforce signature verification and that helm releases pin chart versions from trusted repositories.
49256. **Tekton pipeline permission auditor** — Reviews Tekton task and pipeline RBAC so build tasks cannot escalate to cluster-level operations.
49257. **Spinnaker pipeline authorization auditor** — Audits Spinnaker application permissions and fiat role mappings so deployment targets stay restricted per team.
49258. **Harness delegate hardening auditor** — Checks Harness delegates for least-privilege cloud permissions, network isolation, and timely version updates.
49259. **Container image build-provenance auditor** — Verifies image builds record base image, build host, and source commit so provenance is traceable end to end.
49260. **Base-image pinning auditor** — Flags Dockerfiles using floating tags like latest in favor of pinned digests for reproducible, auditable builds.
49261. **Dockerfile secret (build-arg) detector** — Scans Dockerfiles for secrets passed as build arguments that persist in image history and layer metadata.
49262. **Multi-stage build secret-leakage checker** — Verifies secrets used in builder stages do not leak into final runtime images via copied files or layers.
49263. **.dockerignore completeness auditor** — Checks .dockerignore excludes .git, .env, credentials, and other sensitive paths from the build context.
49264. **Registry credential scope auditor** — Reviews container registry credentials for read-only scope where push rights are unnecessary.
49265. **Image pull-secret distribution auditor** — Audits Kubernetes image pull secrets for unnecessary breadth and verifies rotation schedules.
49266. **Helm values secret detector** — Scans Helm values files and release secrets for plaintext credentials that should live in a secrets manager.
49267. **Kustomize secret-generator auditor** — Verifies Kustomize secret generators reference external secret sources rather than embedding literals.
49268. **Terraform plan-approval gate auditor** — Confirms terraform plan output requires human or policy approval before apply in production workspaces.
49269. **Terraform state-locking verifier** — Verifies remote state backends enforce locking so concurrent applies cannot corrupt infrastructure state.
49270. **Terraform provider pinning auditor** — Checks provider version constraints are pinned to prevent unreviewed provider upgrades from changing infrastructure behavior.
49271. **Pulumi secrets-provider auditor** — Verifies Pulumi stacks use a proper secrets provider with encryption rather than plaintext stack outputs.
49272. **Ansible Vault usage auditor** — Checks that sensitive Ansible variables are vault-encrypted and that vault passwords are managed, not hardcoded.
49273. **Pre-commit secret-hook coverage auditor** — Verifies pre-commit secret scanning hooks are installed and enforced across all developer workstations.
49274. **Verified-commit enforcement auditor** — Confirms protected branches require verified signatures so pipeline triggers trace to authenticated authors.
49275. **Push-rule auditor** — Reviews repository push rules for blocked file types and size limits that prevent accidental large or sensitive uploads.
49276. **Repository visibility auditor** — Inventories repository visibility settings and flags internal code accidentally marked public.
49277. **Fork-PR secret-access auditor** — Verifies pull requests from forks cannot access repository secrets, preventing exfiltration via malicious workflow runs.
49278. **Codespaces secret-scope auditor** — Reviews Codespaces secret scoping so development secrets are not exposed to untrusted repositories.
49279. **Release artifact checksum publisher** — Verifies every release publishes checksums and that the checksum file itself is signed for integrity.
49280. **Release signing-key management auditor** — Audits custody, rotation, and HSM storage of release signing keys.
49281. **Release provenance attestation checker** — Confirms release attestations bind artifacts to their source commits and builders for consumer verification.
49282. **Staging-production parity auditor** — Verifies staging mirrors production configuration closely enough that security tests in staging are meaningful.
49283. **Database migration approval auditor** — Ensures schema migrations pass review and run in transactions with rollback plans before production apply.
49284. **Feature-flag kill-switch readiness auditor** — Verifies risky releases ship behind flags with tested kill switches for instant rollback.
49285. **Rollback procedure-tested auditor** — Confirms rollback procedures are rehearsed, not just documented, with measured recovery times.
49286. **Deployment-freeze policy auditor** — Verifies change freezes during critical periods are enforced by pipeline policy, not just announced.
49287. **Change-evidence completeness auditor** — Checks that change records include approvals, test evidence, and rollback plans for audit readiness.
49288. **Pipeline audit-log completeness verifier** — Verifies the CI system logs every build trigger, approval, secret access, and deployment with tamper-evident storage.
49289. **Pipeline timeout-configuration auditor** — Reviews job timeouts so hung or compromised jobs cannot run indefinitely consuming resources.
49290. **Concurrency and cancel-in-progress auditor** — Verifies concurrency groups cancel superseded runs to prevent stale deployments racing current ones.
49291. **Debug-logging-in-production detector** — Flags pipelines that enable verbose debug logging in production, which can leak secrets into log storage.
49292. **Package publish-token scope auditor** — Reviews npm, PyPI, and registry publish tokens for minimal scope and short lifetimes.
49293. **Published-package provenance auditor** — Verifies published packages carry provenance attestations linking them to trusted builds.
49294. **Dependency lockfile presence auditor** — Flags projects missing lockfiles where dependency versions would otherwise float unreviewed.
49295. **Typosquat-dependency guard auditor** — Verifies pipelines check new dependencies against typosquat and malicious-package feeds before install.
49296. **Pipeline metrics tampering-evidence auditor** — Ensures pipeline success metrics cannot be gamed by skipped or disabled security gates.
49297. **Self-service pipeline guardrail auditor** — Verifies self-service pipeline templates enforce security defaults that teams cannot silently disable.
49298. **Terraform Cloud run-task auditor** — Reviews Terraform Cloud run tasks and sentinel policies for consistent enforcement across workspaces.
49299. **Atlantis permission auditor** — Audits Atlantis PR-automation permissions so plan and apply rights stay scoped to intended repositories.
49300. **Spacelift/Env0 policy auditor** — Reviews policy-as-code stacks in Spacelift or Env0 for drift from organizational guardrails.
49301. **Dagger pipeline audit** — Verifies Dagger-based pipelines pin module versions and run with least-privilege engine permissions.
49302. **Earthly build secret auditor** — Checks Earthly builds use secret mounts rather than build args so secrets never enter layer history.
49303. **Nix build reproducibility auditor** — Verifies Nix-based builds produce bit-identical outputs from pinned inputs for tamper-evident artifacts.
49304. **Bazel remote-cache access auditor** — Reviews Bazel remote-cache credentials and flags caches writable by untrusted contributors.
49305. **Exposed Kubernetes dashboard detector** — Probes for Kubernetes dashboards reachable without authentication and flags them as critical exposures.
49306. **Rancher UI exposure auditor** — Checks Rancher management UIs for public reachability and verifies authentication and RBAC enforcement.
49307. **cluster-admin binding inventory auditor** — Enumerates every ClusterRoleBinding to cluster-admin and requires documented justification for each subject.
49308. **Wildcard RBAC role detector** — Flags ClusterRoles and Roles granting wildcard verbs or resources as candidates for least-privilege rewrite.
49309. **Default service-account usage auditor** — Detects workloads running as the default service account and drives migration to dedicated identities.
49310. **Service-account token automount auditor** — Verifies automountServiceAccountToken is disabled for pods that never call the Kubernetes API.
49311. **Bound service-account token auditor** — Confirms projected service-account tokens are audience- and time-bound rather than legacy long-lived tokens.
49312. **Token expiration verifier** — Checks that service-account token lifetimes follow policy minimums to bound the impact of token theft.
49313. **Image vulnerability correlation engine** — Correlates running container images against CVE feeds and prioritizes fixes by exploitability and exposure.
49314. **Registry scan enablement auditor** — Verifies the container registry scans every pushed image and that scan results gate deployment.
49315. **Admission-time image-scan gate auditor** — Confirms admission controllers block pods whose images failed vulnerability policy at deploy time.
49316. **Image signature verification auditor** — Verifies Cosign or Notary signatures are required by admission policy so only trusted images run.
49317. **Image allowlist enforcement auditor** — Checks that admission policy restricts images to approved registries and repositories.
49318. **Base-image age auditor** — Flags images built from base layers older than the patching SLA for rebuild.
49319. **Distroless adoption tracker** — Measures migration to distroless or minimal base images that shrink the attack surface and CVE count.
49320. **Image SBOM completeness auditor** — Verifies every deployed image ships a complete SBOM so vulnerability response can map packages to workloads instantly.
49321. **Secret-in-env-var (container) detector** — Scans pod specs and manifests for plaintext secrets in environment variables and flags them for secret-volume migration.
49322. **Secret-in-ConfigMap misuse detector** — Detects sensitive values stored in ConfigMaps, which lack encryption and access controls of real secrets.
49323. **External Secrets Operator adoption auditor** — Tracks migration from static Kubernetes Secrets to External Secrets Operator synced from the vault.
49324. **Sealed Secrets usage auditor** — Verifies Sealed Secrets are used for GitOps-stored secrets so only the cluster controller can decrypt them.
49325. **Vault Agent injector auditor** — Checks Vault Agent sidecar injection coverage so workloads fetch dynamic secrets instead of static ones.
49326. **etcd encryption-at-rest verifier** — Confirms the etcd encryption provider encrypts Secrets and that the KMS key is customer-managed.
49327. **etcd backup encryption auditor** — Verifies etcd snapshots are encrypted and stored with restricted access, since they contain all cluster secrets.
49328. **Kubernetes audit-log enablement verifier** — Confirms the API server audit policy captures authentication, RBAC, and secret-access events with durable storage.
49329. **API server anonymous-auth detector** — Flags API servers with anonymous authentication enabled as critical misconfigurations.
49330. **API server authentication-mode auditor** — Reviews enabled authentication modes, ensuring weak modes are disabled and OIDC or webhook auth is preferred.
49331. **Kubelet authentication/authorization auditor** — Verifies kubelet requires authentication and delegates authorization rather than allowing anonymous access.
49332. **Kubelet read-only port exposure checker** — Flags kubelets with the unauthenticated read-only port still enabled.
49333. **Pod Security Standards enforcement auditor** — Verifies Pod Security admission enforces baseline or restricted standards on every namespace.
49334. **Privileged container detector** — Flags pods running with privileged: true, which disables nearly all container isolation.
49335. **Host-namespace sharing detector** — Detects pods sharing hostPID, hostNetwork, or hostIPC, which break container isolation boundaries.
49336. **Added Linux capabilities auditor** — Reviews added capabilities such as SYS_ADMIN or NET_ADMIN and flags workloads that should run with dropped capabilities.
49337. **Read-only root filesystem enforcement checker** — Verifies containers run with read-only root filesystems to block runtime binary tampering.
49338. **Seccomp profile coverage auditor** — Confirms seccomp profiles, ideally RuntimeDefault, apply to all workloads.
49339. **AppArmor/SELinux profile auditor** — Verifies mandatory access-control profiles confine workloads on supporting nodes.
49340. **Resource limit auditor** — Flags containers without CPU and memory limits that risk noisy-neighbor denial of service.
49341. **NetworkPolicy default-deny verifier** — Confirms every namespace has default-deny ingress and egress NetworkPolicies as a baseline.
49342. **Namespace isolation auditor** — Reviews cross-namespace traffic allowances to ensure tenant or tier isolation holds.
49343. **Egress NetworkPolicy coverage auditor** — Verifies egress policies restrict pod destinations to required services, limiting data-exfiltration paths.
49344. **DNS policy auditor** — Reviews pod DNS policies and flags workloads that can reach external resolvers bypassing DNS filtering.
49345. **Service mesh mTLS strict-mode verifier** — Confirms the mesh enforces STRICT mutual TLS so no plaintext service-to-service traffic exists.
49346. **In-cluster plaintext-service detector** — Finds services accepting unencrypted traffic inside the cluster where mTLS should be mandatory.
49347. **Ingress TLS termination auditor** — Verifies every Ingress terminates TLS with valid certificates and redirects HTTP to HTTPS.
49348. **Ingress controller hardening checker** — Audits ingress controller configuration for secure defaults, updated versions, and restricted admin endpoints.
49349. **cert-manager certificate-expiry monitor** — Tracks cert-manager certificates and alerts well before expiry to prevent outages and fallback to insecure modes.
49350. **Workload certificate rotation auditor** — Verifies workload certificates rotate automatically with short lifetimes rather than static long-lived certs.
49351. **Admission webhook inventory auditor** — Enumerates validating and mutating webhooks, flagging webhooks that could silently alter security posture.
49352. **OPA/Kyverno policy coverage auditor** — Measures policy-engine coverage across namespaces and flags clusters running without admission policy.
49353. **Policy exception expiry tracker** — Tracks policy exceptions with expiry dates so temporary bypasses cannot become permanent.
49354. **Falco runtime-coverage auditor** — Verifies Falco or equivalent runtime detection runs on every node with rules tuned for container-escape behaviors.
49355. **Container runtime version auditor** — Flags nodes running outdated containerd, CRI-O, or Docker versions with known vulnerabilities.
49356. **Node OS CIS-hardening auditor** — Verifies node operating systems follow CIS benchmarks for the distribution in use.
49357. **Node auto-upgrade status checker** — Confirms managed node pools enable auto-upgrade so OS and Kubernetes patches apply on schedule.
49358. **Node pool segregation auditor** — Reviews node-pool separation between trusted system workloads and untrusted tenant workloads.
49359. **Taints and tolerations reviewer** — Audits taints and tolerations to ensure sensitive workloads schedule only on dedicated, hardened nodes.
49360. **ResourceQuota coverage auditor** — Verifies every namespace defines ResourceQuotas to prevent resource-exhaustion attacks.
49361. **LimitRange coverage auditor** — Confirms LimitRanges set sane defaults so no container launches without bounded resources.
49362. **PodDisruptionBudget coverage auditor** — Verifies critical workloads define PDBs so voluntary disruptions cannot take them fully offline.
49363. **ImagePullPolicy auditor** — Enforces imagePullPolicy: Always on mutable tags so nodes never run stale cached images.
49364. **Private registry enforcement auditor** — Verifies workloads pull only from private, scanned registries rather than public hubs.
49365. **Image pull-secret scope auditor** — Audits image pull secrets for unnecessary breadth and confirms rotation schedules.
49366. **kubectl exec audit-trail verifier** — Confirms exec sessions into pods are logged with user identity for forensic review.
49367. **Port-forward usage auditor** — Reviews kubectl port-forward usage, flagging forwards that bypass network policy to sensitive pods.
49368. **Ephemeral/debug container auditor** — Flags debug and ephemeral containers in production namespaces that grant shell access to running pods.
49369. **Node shell-access auditor** — Reviews who can obtain node shells via debug pods or SSH and verifies break-glass procedures.
49370. **CronJob schedule and history-limit auditor** — Verifies CronJobs set history limits and run on expected schedules, flagging unexpected jobs.
49371. **Job backoff and TTL auditor** — Checks Jobs define backoff limits and TTL-after-finished so failed jobs do not accumulate indefinitely.
49372. **Init-container image auditor** — Audits init container images with the same rigor as app containers, since they run with elevated trust.
49373. **Sidecar image auditor** — Reviews sidecar images for vulnerabilities and verifies they come from trusted registries.
49374. **DaemonSet privilege auditor** — Scrutinizes DaemonSets, which run on every node, for privileged access and host mounts.
49375. **Static pod inventory auditor** — Inventories static pods on nodes, which bypass the API server and its admission controls.
49376. **Operator RBAC scope auditor** — Reviews operator service accounts, ensuring each operator's permissions match only its managed resources.
49377. **CRD inventory and ownership auditor** — Catalogs custom resource definitions and their owners to prevent abandoned operators from becoming unpatched risk.
49378. **Aggregated API server auditor** — Reviews aggregated API servers for authentication, authorization, and audit-logging parity with the main API server.
49379. **Kubeconfig distribution hygiene auditor** — Verifies kubeconfig files are distributed securely, scoped per user, and never shared or committed.
49380. **EKS Pod Identity association auditor** — Verifies EKS Pod Identity associations bind least-privilege IAM roles to exact service accounts and namespaces via the pod-identity agent.
49381. **Workload Identity federation auditor** — Confirms GKE and AKS workload identity bindings map least-privilege cloud IAM to Kubernetes service accounts.
49382. **OIDC discovery hardening auditor** — Verifies the OIDC discovery endpoint is not exposing unnecessary metadata to unauthenticated callers.
49383. **Downward API exposure reviewer** — Audits downward API usage to ensure pod metadata exposed to containers contains no sensitive labels.
49384. **Projected volume token auditor** — Verifies projected service-account tokens use short expirations and correct audiences.
49385. **CSI driver version auditor** — Tracks CSI driver versions for known vulnerabilities, since storage drivers run with high privilege.
49386. **CNI plugin version auditor** — Audits CNI plugin versions and configurations that control all pod networking.
49387. **Cloud controller manager auditor** — Reviews cloud-controller-manager permissions that manage load balancers, routes, and node lifecycle.
49388. **Cluster autoscaler permission auditor** — Verifies the autoscaler's cloud permissions cannot be abused to provision oversized or unapproved resources.
49389. **HPA configuration reviewer** — Reviews horizontal pod autoscalers for sane min/max bounds that prevent runaway scaling costs or resource exhaustion.
49390. **PriorityClass usage auditor** — Audits PriorityClasses to ensure only system-critical workloads claim the highest preemption priority.
49391. **Runtime CVE-feed correlation monitor** — Continuously correlates newly published CVEs against running images and node components for rapid response.
49392. **Vulnerable-image quarantine workflow auditor** — Verifies a quarantine workflow blocks deployment of images violating vulnerability policy.
49393. **Helm release secret-storage auditor** — Checks Helm release secrets for embedded credentials and verifies storage backend encryption.
49394. **GitOps drift detector** — Compares live cluster state against GitOps desired state and alerts on out-of-band changes.
49395. **Namespace admin-binding auditor** — Reviews namespace-scoped admin RoleBindings that effectively grant broad control within a namespace.
49396. **Container escape monitoring coverage checker** — Verifies runtime monitoring covers known container-escape techniques on every node.
49397. **Control-plane component log auditor** — Confirms scheduler, controller-manager, and API server logs are collected centrally with retention.
49398. **Scheduler binding audit reviewer** — Reviews scheduler decisions and binding permissions for anomalous pod placement.
49399. **Kube-proxy mode auditor** — Verifies kube-proxy runs in the hardened mode matching the CNI's expectations with secure defaults.
49400. **CoreDNS configuration auditor** — Audits CoreDNS Corefiles for forwarding, caching, and plugin settings that could enable DNS-based exfiltration.
49401. **Metrics-server RBAC auditor** — Verifies metrics-server RBAC grants only the read access it needs for autoscaling.
49402. **cAdvisor endpoint exposure checker** — Flags cAdvisor endpoints exposed beyond localhost without authentication.
49403. **Kubelet /metrics exposure auditor** — Verifies kubelet metrics endpoints require authentication and are not scraped by unauthorized parties.
49404. **Node-exporter exposure auditor** — Checks node-exporter endpoints for authentication and network restrictions.
49405. **Full-history secret hunter** — Scans the entire Git history, including deleted branches and stashes, for secrets that were ever committed.
49406. **All-branch secret scanner** — Extends secret scanning beyond the default branch to feature, release, and archived branches.
49407. **Entropy-based secret detector** — Flags high-entropy strings characteristic of tokens and keys that pattern matching alone would miss.
49408. **Regex-plus-entropy hybrid detector** — Combines pattern matching with entropy scoring to cut false positives while catching novel secret formats.
49409. **Custom detector-pattern builder** — Lets security teams define organization-specific secret patterns for internal token formats.
49410. **AWS key-pattern detector** — Detects AWS access key IDs and flags accompanying secret keys in code and config.
49411. **GCP key-pattern detector** — Detects GCP service-account JSON keys and API keys committed to repositories.
49412. **Azure secret-pattern detector** — Detects Azure connection strings, storage keys, and service-principal secrets in code.
49413. **Stripe live-key detector** — Distinguishes live Stripe secret keys from test keys and escalates live-key findings.
49414. **Payment-gateway secret detector** — Covers Razorpay, PayPal, Braintree, and regional gateway secrets with rotation guidance.
49415. **Twilio/SendGrid key detector** — Detects communication-platform API keys that enable spam or phishing from the victim account.
49416. **Slack token/webhook detector** — Detects Slack bot tokens and incoming webhooks that would allow message injection or data theft.
49417. **Discord/Telegram token detector** — Detects chat-platform bot tokens that grant control of notification and community channels.
49418. **GitHub PAT detector** — Detects GitHub personal access tokens and classifies their likely scope from surrounding context.
49419. **GitLab token detector** — Detects GitLab personal, project, and group access tokens in code and CI configs.
49420. **NPM/PyPI publish-token detector** — Detects package-registry tokens that would allow publishing malicious package versions.
49421. **Docker Hub token detector** — Detects Docker Hub access tokens that grant image push and pull rights.
49422. **Cloudflare API-token detector** — Detects Cloudflare API tokens and flags tokens with zone-wide or account-wide permissions.
49423. **Vercel/Netlify deploy-token detector** — Detects hosting-platform tokens that allow redeploying or reconfiguring production sites.
49424. **OpenAI/Anthropic API-key detector** — Detects LLM provider API keys that incur cost and leak prompt data if abused.
49425. **HuggingFace/Replicate token detector** — Detects ML-platform tokens that grant model and inference-endpoint control.
49426. **Firebase/Google-Maps key detector** — Detects Firebase and Maps API keys and checks whether key restrictions are documented.
49427. **Database connection-string detector** — Detects full database URLs with embedded credentials across application configs.
49428. **Redis/MongoDB URI detector** — Detects cache and document-store URIs containing passwords in code and compose files.
49429. **SMTP credential detector** — Detects mail-server usernames and passwords that enable phishing from the organization's domain.
49430. **JWT secret detector** — Detects hardcoded JWT signing secrets that would allow forging authentication tokens.
49431. **OAuth client-secret detector** — Detects OAuth client secrets in frontend bundles and mobile apps where they cannot stay secret.
49432. **Webhook signing-secret detector** — Detects webhook signing secrets whose exposure would allow forging inbound events.
49433. **PEM private-key detector** — Detects PEM-encoded private keys of any algorithm committed to repositories.
49434. **SSH private-key detector** — Detects OpenSSH private keys that grant server access if the corresponding public key is deployed.
49435. **TLS private-key detector** — Detects certificate private keys that would allow impersonating the organization's services.
49436. **GPG key detector** — Detects exported GPG private keys used for commit or artifact signing.
49437. **Code-signing key detector** — Detects code-signing private keys whose compromise undermines software-supply-chain trust.
49438. **.env file exposure detector** — Detects committed .env files that conventionally hold the application's full secret set.
49439. **Config-file secret detector** — Scans YAML, TOML, INI, and JSON configs for credential fields regardless of file naming.
49440. **IaC secret detector** — Detects secrets embedded in Terraform, CloudFormation, ARM, and Pulumi definitions.
49441. **Helm chart secret auditor** — Audits Helm charts and rendered manifests for secrets that should be injected at deploy time instead.
49442. **Image build-context secret auditor** — Detects secrets copied into container build contexts where they persist in layer history.
49443. **Mobile app string secret detector** — Extracts hardcoded secrets from decompiled APK and IPA artifacts during the audit pipeline.
49444. **Frontend bundle secret detector** — Scans shipped JavaScript bundles for API keys and tokens visible to every visitor.
49445. **WebAssembly bundle secret detector** — Inspects WASM modules and their string tables for embedded credentials.
49446. **Jupyter notebook secret detector** — Scans notebook cells and outputs for credentials pasted during experimentation.
49447. **Wiki/docs secret detector** — Searches internal wikis and documentation for credentials shared as setup instructions.
49448. **Issue/PR comment secret detector** — Monitors issue and pull-request comments for accidentally pasted tokens and triggers revocation workflows.
49449. **CI log secret detector** — Scans historical CI logs for echoed secrets that persist in log storage after the leak.
49450. **Build artifact secret detector** — Inspects packaged artifacts such as zips and installers for embedded credentials.
49451. **Container image-layer secret detector** — Scans every image layer, including history, for secrets baked into files.
49452. **Test-fixture secret detector** — Flags production-like credentials in test fixtures that developers treat as harmless.
49453. **Seed-data secret detector** — Detects real credentials in database seed files shipped with the codebase.
49454. **Example-config secret detector** — Flags example configuration files containing real rather than placeholder secrets.
49455. **Screenshot OCR secret detector** — Applies OCR to screenshots in docs and tickets to find visible credentials.
49456. **Backup-file secret detector** — Scans backup archives for credential files that multiply the blast radius of a backup leak.
49457. **Database-dump secret detector** — Detects credential tables and secrets inside database dumps stored in the repo or artifacts.
49458. **Log-file secret detector** — Scans committed or shipped log files for tokens, passwords, and session IDs.
49459. **Chat-export secret detector** — Searches exported chat transcripts for credentials shared during incident response.
49460. **Ticket-attachment secret detector** — Scans support-ticket attachments for credentials customers or staff uploaded.
49461. **Shared-document secret detector** — Searches shared drives and docs for spreadsheets or notes holding credentials.
49462. **Password-manager export auditor** — Verifies password-manager exports are encrypted, access-logged, and never stored in shared locations.
49463. **Vendor-directory secret auditor** — Audits vendored third-party code for credentials the vendor accidentally shipped.
49464. **Malicious-package secret auditor** — Reviews dependencies for packages that exfiltrate environment secrets at install or runtime.
49465. **Typosquat exfiltration auditor** — Flags typosquat packages specifically designed to harvest secrets from build environments.
49466. **Pre-commit hook bypass-attempt monitor** — Detects commits pushed with --no-verify or hook-skipping flags and routes them for mandatory post-push secret review.
49467. **Push-protection enablement verifier** — Confirms push protection blocks secret-containing pushes across all repositories.
49468. **Secret-scanning alert SLA tracker** — Tracks time from secret-scanning alert to revocation against the incident SLA.
49469. **Leaked-secret rotation verifier** — Confirms every leaked secret was actually rotated, not just deleted from code, with evidence of rotation.
49470. **Leaked-secret revocation confirmer** — Verifies the leaked credential no longer authenticates anywhere after the incident.
49471. **Secret inventory and ownership mapper** — Builds a living inventory mapping every production secret to an owner and rotation schedule.
49472. **Secret expiry monitor** — Tracks static-secret expiries and drives rotation before credentials go stale.
49473. **Code-referenced certificate expiry monitor** — Finds certificate files referenced in code and alerts before they expire.
49474. **Vault dynamic-secret adoption auditor** — Measures replacement of static credentials with short-lived dynamic secrets from the vault.
49475. **Secret-zero bootstrap auditor** — Audits the initial authentication of workloads to the vault so the bootstrap secret itself is protected.
49476. **Break-glass secret procedure auditor** — Verifies emergency secret-access procedures work under drill with full logging and post-use rotation.
49477. **Rotation runbook completeness auditor** — Checks every secret type has a tested rotation runbook with rollback steps.
49478. **Revocation procedure auditor** — Verifies revocation procedures actually invalidate credentials across all consuming systems.
49479. **Leaked-secret incident playbook auditor** — Confirms the incident playbook covers detection, containment, rotation, and customer notification for secret leaks.
49480. **Canary-token deployment auditor** — Verifies honeytokens are planted in code, configs, and docs with alerting on any use.
49481. **Honeytoken alerting verifier** — Tests that using a honeytoken actually fires an alert to the security team within minutes.
49482. **Secret manager vs plaintext-env comparator** — Inventories secrets still in plaintext environment variables versus those migrated to a manager.
49483. **Kubernetes External Secrets adoption auditor** — Tracks migration of cluster secrets to External Secrets Operator synced from the vault.
49484. **Workload-identity adoption auditor** — Measures replacement of stored secrets with workload identity federation across services.
49485. **OIDC-federation adoption auditor** — Tracks elimination of stored cloud credentials in favor of short-lived OIDC federation.
49486. **Short-lived credential adoption tracker** — Measures the share of credentials with lifetimes under the policy maximum.
49487. **Shared-secret elimination tracker** — Drives elimination of secrets shared across services toward one-credential-per-workload.
49488. **DLP-for-code-exfiltration auditor** — Verifies data-loss-prevention controls cover source-code exfiltration channels including personal repos and pastes.
49489. **Commit-message secret detector** — Scans commit messages for pasted tokens, passwords, and connection strings.
49490. **Branch-name secret detector** — Flags secrets embedded in branch names, which persist in refs and CI metadata.
49491. **Tag/release-note secret detector** — Scans tags and release notes for credentials included in changelogs.
49492. **Code-review secret-spotting checklist auditor** — Verifies review checklists include secret-spotting so human reviewers catch what scanners miss.
49493. **Forked-repo secret-leakage monitor** — Monitors forks of private repositories for secrets that traveled with the fork.
49494. **Public-mirror secret scanner** — Scans public mirrors of internal repositories for secrets exposed by the mirroring.
49495. **Archived-repo secret auditor** — Audits archived repositories, which are often forgotten but remain readable with their full history.
49496. **Gist/paste secret monitor** — Monitors corporate gists and paste sites for employee-posted credentials.
49497. **Snippet-sharing secret detector** — Detects credentials in shared code snippets on internal snippet platforms.
49498. **AI-coding-assistant prompt secret auditor** — Reviews prompts sent to AI coding assistants for embedded secrets that leave the corporate boundary.
49499. **MCP/tool-config secret detector** — Scans Model Context Protocol server configs and AI tool settings for hardcoded API keys.
49500. **IDE-settings secret detector** — Detects credentials stored in IDE settings, run configurations, and synced profiles.
49501. **Browser-extension config secret auditor** — Audits managed browser-extension configurations for embedded tokens.
49502. **Local dev-environment secret hygiene checker** — Checks developer machines for plaintext secrets in shell profiles, history, and local configs.
49503. **Dotfiles-repo secret auditor** — Scans public dotfiles repositories for credentials in shell configs and tool settings.
49504. **Shell-history secret detector** — Detects secrets typed into shell history files on shared or audited machines.
49505. **Web-accessible backup-file discoverer** — Inventories backup, dump, and archive files reachable over HTTP on the organization's own web roots for removal or access control.
49506. **Database-dump file detector** — Flags .sql and database-export files exposed in web-accessible directories for immediate quarantine.
49507. **SQL-dump in webroot detector** — Specifically hunts database exports accidentally left inside the document root of production sites.
49508. **Compressed-archive exposure detector** — Finds .zip, .tar, .gz, and .bak archives served publicly that may bundle source code or data.
49509. **Config-backup exposure detector** — Detects .bak, .old, .orig, and ~ suffixed config files that disclose live configuration when served.
49510. **Editor-swap-file exposure detector** — Flags Vim swap, Emacs backup, and IDE temp files exposed by web servers.
49511. **.git directory exposure detector** — Detects publicly accessible .git directories that would leak full source history.
49512. **.svn/.hg metadata exposure detector** — Flags exposed Subversion and Mercurial metadata directories leaking source history.
49513. **.env file web-exposure detector** — Detects .env files served by the web server, which conventionally hold the application's full secret set.
49514. **phpinfo/test-script exposure detector** — Finds phpinfo pages and leftover test scripts that disclose server configuration.
49515. **Directory-listing on backup-path detector** — Flags directory listings enabled on backup, upload, or archive paths.
49516. **robots.txt backup-reference auditor** — Reviews robots.txt and sitemaps for disallowed paths that advertise backup locations.
49517. **Common backup-filename inventory prober** — Probes the organization's own hosts for conventional backup filenames to build a defensive exposure inventory.
49518. **CMS backup-plugin artifact detector** — Finds artifacts left by CMS backup plugins in web-accessible locations.
49519. **wp-config.php backup detector** — Detects backup copies of wp-config.php that would expose database credentials.
49520. **EBS snapshot public-sharing detector** — Flags EBS snapshots shared publicly or with unknown accounts.
49521. **RDS snapshot public-sharing detector** — Flags RDS and Aurora snapshots shared publicly, which would expose full database contents.
49522. **AMI public-sharing detector** — Detects machine images shared publicly that may contain credentials, keys, or proprietary code.
49523. **Shared-AMI trust auditor** — Reviews AMIs shared with the account from third parties for trustworthiness before use.
49524. **Snapshot age and sprawl auditor** — Flags ancient and numerous snapshots that escape lifecycle governance and cost control.
49525. **Orphaned-snapshot detector** — Finds snapshots whose source volumes no longer exist, indicating abandoned backup processes.
49526. **VM snapshot sprawl auditor** — Audits hypervisor-level VM snapshots for age, size, and consolidation status.
49527. **Storage snapshot encryption verifier** — Confirms volume and database snapshots inherit encryption from source volumes.
49528. **Backup encryption-at-rest verifier** — Verifies backup repositories encrypt data at rest with customer-managed keys where policy requires.
49529. **Backup encryption-key management auditor** — Reviews custody, rotation, and separation of backup encryption keys from production keys.
49530. **Backup immutability verifier** — Confirms backups use Object Lock or equivalent immutability so ransomware cannot encrypt or delete them.
49531. **Air-gapped backup copy auditor** — Verifies at least one backup copy is logically or physically isolated from the production network.
49532. **3-2-1 backup-rule compliance checker** — Validates three copies, two media types, and one offsite copy for each critical dataset.
49533. **Offsite backup copy verifier** — Confirms offsite copies actually transfer, complete, and remain restorable, not just scheduled.
49534. **Backup retention-policy auditor** — Verifies retention windows meet regulatory and business requirements per data class.
49535. **RPO/RTO compliance tracker** — Measures actual recovery-point and recovery-time performance against committed objectives.
49536. **Backup restoration-test cadence auditor** — Verifies restores are tested on schedule and that test results are documented with issues tracked.
49537. **Point-in-time recovery drill auditor** — Confirms point-in-time recovery is rehearsed for databases, not merely assumed from backup existence.
49538. **Backup integrity verifier** — Checks backup hashes or signatures so corrupted or tampered backups are detected before a crisis.
49539. **Backup catalog integrity auditor** — Verifies the backup catalog itself is protected and consistent so restores can locate the right media.
49540. **Failed-backup alerting verifier** — Confirms failed backups page the responsible team rather than silently aging.
49541. **Backup window compliance auditor** — Verifies backups complete within their windows and flags chronic overruns that risk incomplete protection.
49542. **Backup storage-growth anomaly detector** — Flags sudden backup-size changes that may indicate misconfiguration or data incidents.
49543. **Backup access-logging verifier** — Confirms every backup read, restore, and export is logged with identity for forensic review.
49544. **Backup admin separation-of-duties auditor** — Verifies backup administrators cannot unilaterally delete backups without a second approver.
49545. **Vault/secrets backup auditor** — Confirms the secrets manager itself is backed up with tested restore procedures and sealed recovery keys.
49546. **IaC state backup verifier** — Verifies Terraform and infrastructure state files are versioned and backed up against corruption.
49547. **Git mirror/offsite backup auditor** — Confirms source-code repositories have offsite mirrors so code survives platform outages.
49548. **Container registry backup auditor** — Verifies image registries replicate to a second region or registry for build continuity.
49549. **Artifact repository backup auditor** — Confirms artifact repositories back up packages and metadata with tested restore.
49550. **Database backup schedule auditor** — Verifies full, differential, and log backup schedules match the RPO for each database.
49551. **Transaction-log backup auditor** — Confirms transaction-log backups run frequently enough to support point-in-time recovery targets.
49552. **Replica-lag readiness monitor** — Monitors replication lag so standby databases are actually viable failover targets.
49553. **Failover drill cadence auditor** — Verifies database failover is rehearsed on schedule with measured promotion times.
49554. **Bare-metal recovery readiness auditor** — Confirms bare-metal recovery media and procedures are tested for critical physical or virtual hosts.
49555. **Golden-image pipeline auditor** — Verifies golden images build from hardened baselines with patching and scanning in the pipeline.
49556. **Backup-image vulnerability auditor** — Scans backup and golden images for vulnerabilities so restores do not reintroduce known flaws.
49557. **Log retention-policy auditor** — Verifies log retention meets security, compliance, and forensic requirements per log class.
49558. **Log integrity verifier** — Confirms logs are hash-chained or signed so tampering is detectable during investigations.
49559. **WORM log-storage verifier** — Verifies security logs land on write-once storage that even administrators cannot alter.
49560. **Log forwarding redundancy auditor** — Confirms log forwarding has redundant paths so a single collector failure does not blind detection.
49561. **SIEM ingestion coverage auditor** — Measures the share of expected log sources actually ingested and parsed by the SIEM.
49562. **Audit-log tamper-evidence auditor** — Verifies privileged-action audit logs are protected against modification by the actors they record.
49563. **CloudTrail log-file validation verifier** — Confirms CloudTrail log-file validation is enabled so tampered logs are detectable.
49564. **VPC flow-log coverage auditor** — Verifies flow logs cover all VPCs with retention sufficient for incident investigation.
49565. **DNS query-log coverage auditor** — Confirms DNS query logging is enabled for threat-hunting visibility into name resolution.
49566. **Application-log PII-redaction auditor** — Verifies application logs redact PII, credentials, and tokens before storage.
49567. **Debug-log-in-production detector** — Flags production services emitting debug-level logs that may leak internals.
49568. **Verbose error-log detector** — Flags error logs recording full request bodies or stack traces with sensitive data.
49569. **Heap-dump exposure detector** — Detects heap dumps reachable over the network, which contain in-memory secrets.
49570. **Thread-dump exposure detector** — Flags thread dumps exposed via endpoints, revealing internal class and package structure.
49571. **Core-dump exposure detector** — Detects core dumps left in web-accessible or shared locations.
49572. **Crash-report exposure detector** — Flags crash reports uploaded to public buckets or endpoints with memory contents.
49573. **APM data-retention auditor** — Reviews APM trace and span retention for PII and credential leakage in captured payloads.
49574. **Tracing PII-redaction auditor** — Verifies distributed traces redact sensitive attributes before export.
49575. **Metrics-label cardinality auditor** — Flags high-cardinality metric labels that leak user IDs or internal identifiers.
49576. **Public Grafana dashboard detector** — Finds Grafana dashboards accessible without authentication that may expose operational data.
49577. **Public Kibana exposure detector** — Detects Kibana instances reachable without authentication, exposing indexed log data.
49578. **Public Prometheus endpoint detector** — Flags Prometheus servers and exporters exposed without authentication.
49579. **Exposed metrics-endpoint inventory auditor** — Builds an inventory of all metrics endpoints and verifies each has authentication or network restriction.
49580. **Go pprof endpoint exposure detector** — Detects Go pprof debug endpoints exposed beyond localhost.
49581. **Spring Boot actuator exposure mapper** — Maps all exposed Spring Boot Actuator endpoints and classifies each by sensitivity.
49582. **Actuator env/heapdump sensitivity auditor** — Verifies the most sensitive actuator endpoints are disabled or require authentication.
49583. **Django debug-toolbar exposure detector** — Detects Django Debug Toolbar active in production deployments.
49584. **Laravel Telescope exposure detector** — Flags Laravel Telescope accessible in production, exposing requests and queries.
49585. **Symfony profiler exposure detector** — Detects Symfony profiler routes enabled outside development.
49586. **Rails web-console exposure detector** — Flags Rails web console accessible in production, which grants code execution.
49587. **phpMyAdmin/Adminer exposure detector** — Detects database web-admin tools exposed to the internet.
49588. **Database web-admin exposure inventory** — Builds a full inventory of database admin UIs and verifies each sits behind VPN or zero-trust access.
49589. **Nexus/Artifactory anonymous-access auditor** — Verifies artifact repositories disable anonymous access or restrict it to approved paths.
49590. **Private registry anonymous-pull auditor** — Checks container registries for anonymous pull access to private images.
49591. **ECR public-repository auditor** — Reviews ECR public repositories to confirm intentional publication and scan coverage.
49592. **Helm chart-repository exposure auditor** — Verifies chart repositories require authentication for private charts.
49593. **Terraform registry exposure auditor** — Audits private Terraform registries for authentication and module-signing enforcement.
49594. **MLflow model-registry exposure auditor** — Verifies MLflow registries restrict model access and that production models require approval to promote.
49595. **Jupyter server exposure detector** — Detects Jupyter servers reachable without authentication, exposing code-execution capability.
49596. **Airflow UI exposure auditor** — Verifies Airflow web UIs require authentication and RBAC with connections encrypted.
49597. **BI tool public-dashboard auditor** — Reviews Metabase, Superset, and similar dashboards shared publicly for data sensitivity.
49598. **Notebook snapshot exposure detector** — Detects shared notebook snapshots containing credentials or sensitive query results.
49599. **Data-warehouse snapshot-sharing auditor** — Reviews shared warehouse snapshots and clones for least-privilege recipient scoping.
49600. **Elasticsearch snapshot-repository exposure auditor** — Verifies snapshot repositories are encrypted and access-restricted.
49601. **Redis RDB backup exposure detector** — Detects Redis RDB files in accessible storage, which contain full dataset contents.
49602. **MongoDB dump exposure detector** — Flags mongodump archives in web-accessible or shared locations.
49603. **Kafka topic-data export auditor** — Reviews topic export and backup jobs for encryption and restricted destinations.
49604. **Message-queue backup exposure auditor** — Verifies message-queue backups and dead-letter stores are access-controlled.
49605. **Admin-panel path inventory builder** — Crawls the organization's own applications to inventory every administrative path for centralized hardening review.
49606. **Default admin-path auditor** — Flags administrative interfaces still served on vendor-default paths as candidates for relocation or extra gating.
49607. **CMS admin hardening auditor** — Verifies CMS admin areas enforce strong authentication, login throttling, and IP restrictions.
49608. **Admin login MFA-enforcement verifier** — Confirms every administrative login requires MFA without bypass or remember-device exceptions.
49609. **Admin login SSO-enforcement verifier** — Verifies administrative access federates through SSO so leavers lose admin rights automatically.
49610. **Admin-panel IP-allowlist verifier** — Checks that sensitive admin panels restrict source IPs to corporate ranges or VPN egress.
49611. **Admin-panel zero-trust gating checker** — Verifies admin interfaces sit behind zero-trust access proxies requiring device and identity verification.
49612. **Admin-panel WAF-coverage auditor** — Confirms admin paths are covered by WAF rules tuned for authentication-abuse patterns.
49613. **Login rate-limit presence detector** — Passively verifies login endpoints enforce rate limiting by observing response headers and documented controls.
49614. **Account-lockout policy verifier** — Reviews lockout thresholds and durations on admin logins to confirm brute-force deterrence without denial-of-service risk.
49615. **Admin session-timeout auditor** — Verifies administrative sessions expire after short idle and absolute timeouts.
49616. **Concurrent-session control auditor** — Checks that admin accounts limit concurrent sessions and alert on simultaneous logins from disparate locations.
49617. **Admin password-complexity auditor** — Reviews password policy enforcement specifically on administrative accounts against the privileged-account standard.
49618. **Login error-verbosity auditor** — Checks login error messages do not distinguish valid from invalid usernames, preventing account enumeration.
49619. **Password-reset enumeration-risk auditor** — Verifies password-reset flows respond identically for existing and non-existing accounts.
49620. **Registration enumeration-risk auditor** — Checks registration flows do not reveal whether an email or username is already registered.
49621. **Staging/dev admin-exposure detector** — Finds non-production admin interfaces exposed to the internet with production-like data or credentials.
49622. **Internal-tool exposure auditor** — Audits Retool, Appsmith, Budibase, and similar internal tools for authentication and network gating.
49623. **Feature-flag admin exposure auditor** — Verifies feature-flag consoles require authentication and that flag changes are audit-logged.
49624. **BI admin exposure auditor** — Checks Metabase, Superset, and BI admin consoles for SSO enforcement and network restriction.
49625. **Self-hosted database-admin exposure auditor** — Verifies self-hosted database admin tools sit behind VPN or zero-trust access with strong auth.
49626. **Server control-panel exposure auditor** — Audits cPanel, Plesk, DirectAdmin, and similar hosting panels for public exposure and hardening.
49627. **Webmin/Virtualmin exposure auditor** — Checks Webmin-family server admin panels for exposure, version currency, and two-factor enforcement.
49628. **NAS admin exposure auditor** — Verifies Synology, QNAP, and NAS admin interfaces are not internet-exposed with default configurations.
49629. **Hypervisor admin exposure auditor** — Audits Proxmox, ESXi, and hypervisor management interfaces for network isolation and MFA.
49630. **Backup console exposure auditor** — Verifies backup consoles such as Veeam require MFA and are unreachable from untrusted networks.
49631. **Monitoring admin exposure auditor** — Checks Grafana and monitoring admin endpoints for authentication strength and network gating.
49632. **Log admin exposure auditor** — Audits Graylog, Kibana, and log-platform admin consoles for SSO and restricted access.
49633. **Uptime-monitor admin exposure auditor** — Verifies uptime-monitoring admin panels require authentication and are not publicly writable.
49634. **SSO admin exposure auditor** — Audits Keycloak, Auth0 tenant, and SSO admin consoles as the highest-value targets for MFA and IP restriction.
49635. **Directory admin exposure auditor** — Checks LDAP admin tools like phpLDAPadmin for exposure and credential strength.
49636. **Certificate-authority admin exposure auditor** — Verifies internal CA admin interfaces have the strictest access controls given their trust power.
49637. **Secrets-manager UI exposure auditor** — Audits Vault and secrets-manager UIs for zero-trust gating and short session lifetimes.
49638. **API-gateway admin exposure auditor** — Verifies Kong, Tyk, and gateway admin APIs require authentication and are not publicly reachable.
49639. **Message-queue admin exposure auditor** — Checks RabbitMQ management and queue admin UIs for authentication and network restriction.
49640. **Cache admin exposure auditor** — Audits RedisInsight and cache admin tools for exposure and credential protection.
49641. **Search-engine admin exposure auditor** — Verifies Solr and Elasticsearch admin endpoints require authentication and are not internet-exposed.
49642. **Reverse-proxy admin exposure auditor** — Checks Nginx Proxy Manager, Traefik dashboards, and proxy admin UIs for authentication and gating.
49643. **Envoy admin-interface exposure auditor** — Verifies Envoy admin interfaces bind to localhost only in production deployments.
49644. **HAProxy stats exposure auditor** — Checks HAProxy stats pages for authentication and confirms they are not publicly reachable.
49645. **Mail admin exposure auditor** — Audits Mailcow, PostfixAdmin, and mail-server admin panels for hardening and MFA.
49646. **VPN admin-portal exposure auditor** — Verifies VPN admin portals enforce MFA and are not reachable from untrusted networks.
49647. **Firewall admin-portal exposure auditor** — Audits firewall management interfaces as critical assets requiring isolated access.
49648. **DNS admin exposure auditor** — Checks PowerDNS-Admin and DNS management UIs for authentication strength and change audit logging.
49649. **Remote-access admin exposure auditor** — Audits Guacamole, MeshCentral, and remote-access gateways for MFA and session recording.
49650. **RDP-gateway admin exposure auditor** — Verifies RDWeb and RDP gateway admin surfaces enforce MFA and network-level authentication.
49651. **Container admin exposure auditor** — Checks Portainer and container-management UIs for authentication and RBAC.
49652. **Git admin-area exposure auditor** — Audits GitLab admin area and Gitea site-admin pages for restricted access and audit logging.
49653. **CI admin exposure auditor** — Verifies Jenkins and CI admin consoles require SSO/MFA and sit behind network controls.
49654. **Artifact admin exposure auditor** — Audits Nexus and artifact-repository admin consoles for privileged-access controls.
49655. **Chat admin exposure auditor** — Checks Mattermost, Rocket.Chat, and chat-platform admin consoles for SSO and audit logging.
49656. **File-share admin exposure auditor** — Audits Nextcloud, ownCloud, and file-share admin panels for hardening and MFA.
49657. **Wiki admin exposure auditor** — Verifies Confluence, MediaWiki, and wiki admin areas restrict configuration changes to authorized staff.
49658. **Ticketing admin exposure auditor** — Checks Jira, Redmine, and ticketing admin consoles for privileged-access controls.
49659. **Helpdesk admin exposure auditor** — Audits Zammad, osTicket, and helpdesk admin panels for agent authentication strength.
49660. **Asset-management admin exposure auditor** — Verifies Snipe-IT and asset-management admin consoles protect inventory integrity.
49661. **LMS admin exposure auditor** — Checks Moodle and learning-platform admin areas for role separation and audit logging.
49662. **Forum admin exposure auditor** — Audits Discourse, phpBB, and forum admin panels for moderator-privilege controls.
49663. **E-commerce admin exposure auditor** — Verifies Magento, WooCommerce, and store admin panels enforce MFA and IP restriction.
49664. **Headless-CMS admin exposure auditor** — Checks Strapi, Directus, and headless-CMS admin UIs for authentication and API-token governance.
49665. **Static-site CMS admin exposure auditor** — Audits git-based CMS admin interfaces for OAuth scoping and branch-protection alignment.
49666. **Analytics admin exposure auditor** — Verifies Matomo, Plausible, and analytics admin consoles restrict data-export privileges.
49667. **Marketing-automation admin exposure auditor** — Checks marketing-platform admin access for SSO and campaign-change audit trails.
49668. **Survey admin exposure auditor** — Audits LimeSurvey and survey admin panels for response-data access controls.
49669. **Newsletter admin exposure auditor** — Verifies newsletter admin consoles protect subscriber lists with MFA and export logging.
49670. **Media-server admin exposure auditor** — Checks Plex, Jellyfin, and media-server admin pages for authentication and remote-access controls.
49671. **Download-manager admin exposure auditor** — Audits SABnzbd, qBittorrent web UIs, and download managers for authentication on exposed ports.
49672. **Home-automation admin exposure auditor** — Verifies Home Assistant and automation admin panels require strong auth when remotely accessible.
49673. **Ad-blocker admin exposure auditor** — Checks Pi-hole, AdGuard Home admin panels for password protection and network scoping.
49674. **Game-server panel exposure auditor** — Audits Pterodactyl and game-server panels for user isolation and admin MFA.
49675. **Voice-server admin exposure auditor** — Verifies voice-server admin interfaces restrict server-administrator privileges appropriately.
49676. **Webhook admin-endpoint inventory auditor** — Inventories administrative webhook endpoints and verifies each requires signed, authenticated calls.
49677. **API-docs exposure auditor** — Reviews Swagger UI and API documentation exposure, ensuring try-it consoles do not leak production credentials.
49678. **GraphQL playground exposure auditor** — Detects GraphQL playgrounds enabled in production, which aid schema exploration by outsiders.
49679. **Admin-API extra-auth verifier** — Verifies administrative API routes require stronger authentication than standard user APIs.
49680. **Mobile-backend admin exposure auditor** — Checks mobile backend admin consoles for the same hardening as web admin surfaces.
49681. **IoT device admin-panel exposure auditor** — Audits internet-facing IoT admin panels for default-configuration risks and credential strength.
49682. **Camera/NVR admin exposure auditor** — Verifies camera and NVR admin interfaces are not internet-exposed with weak credentials.
49683. **Printer admin-panel exposure auditor** — Checks network-printer admin panels for exposure and configuration hygiene.
49684. **Router/CPE admin exposure auditor** — Audits customer-premises router admin interfaces exposed on WAN interfaces.
49685. **Smart-device cloud-admin exposure auditor** — Reviews cloud admin consoles for smart-device fleets for SSO and role separation.
49686. **MDM console exposure auditor** — Verifies mobile-device-management consoles enforce MFA and restrict device-wipe privileges.
49687. **EDR console access auditor** — Audits EDR console access as a high-value target with MFA, IP restriction, and full audit logging.
49688. **SIEM admin-console exposure auditor** — Verifies SIEM admin consoles protect detection logic from tampering by unauthorized users.
49689. **Vulnerability-scanner admin exposure auditor** — Checks Nessus, OpenVAS, and scanner consoles for credential protection and scan-target scoping.
49690. **Password-manager admin-console exposure auditor** — Audits Bitwarden, 1Password, and vault admin consoles with the strictest access requirements.
49691. **Teleport web-UI exposure auditor** — Verifies Teleport web UIs enforce MFA, short sessions, and recorded sessions for privileged access.
49692. **Zero-trust admin coverage auditor** — Measures the share of admin interfaces protected by zero-trust access proxies versus exposed directly.
49693. **Bastion web-admin exposure auditor** — Checks web-based bastion consoles for MFA, session recording, and command audit trails.
49694. **Managed-Kubernetes console exposure auditor** — Audits managed Kubernetes dashboards and cloud-console Kubernetes views for RBAC and audit logging.
49695. **CloudStack/Horizon exposure auditor** — Verifies CloudStack and OpenStack Horizon admin portals enforce MFA and network restriction.
49696. **OpenNebula Sunstone exposure auditor** — Checks OpenNebula Sunstone portals for authentication strength and tenant isolation.
49697. **oVirt admin-portal exposure auditor** — Audits oVirt engine admin portals for SSO integration and role separation.
49698. **Virtualization admin API exposure auditor** — Verifies virtualization management APIs require authentication equivalent to their web consoles.
49699. **Admin-panel certificate-validity checker** — Flags admin panels served with expired, mismatched, or self-signed certificates.
49700. **Admin-panel security-header auditor** — Verifies admin responses carry hardening headers such as frame-ancestors and content-type protections.
49701. **Admin-panel version-disclosure auditor** — Flags admin login pages disclosing exact software versions that aid targeted attacks.
49702. **Admin-panel default-title fingerprint auditor** — Detects admin panels still showing vendor-default titles, indicating unhardened deployments.
49703. **Admin-panel subresource exposure auditor** — Checks admin subresources such as setup wizards, installers, and updaters are disabled post-install.
49704. **Admin inventory-to-CMDB reconciliation auditor** — Reconciles the discovered admin-panel inventory against the CMDB so every admin surface has an owner.
49705. **Django DEBUG-mode detector** — Detects Django applications running with DEBUG=True in production, which exposes tracebacks and settings.
49706. **Flask debug-mode detector** — Flags Flask apps with the debugger or reloader enabled outside development.
49707. **Laravel APP_DEBUG detector** — Detects Laravel deployments with APP_DEBUG=true, which renders detailed exception pages.
49708. **Rails development-mode exposure detector** — Flags Rails apps running in development mode in production environments.
49709. **ASP.NET customErrors-mode auditor** — Verifies ASP.NET customErrors is set to On or RemoteOnly so detailed errors never reach remote users.
49710. **PHP display_errors auditor** — Confirms PHP display_errors is off in production so errors go to logs, not responses.
49711. **Node.js stack-trace-in-response detector** — Detects Express and Node frameworks returning full stack traces in API error responses.
49712. **Java stack-trace-in-API detector** — Flags Java services serializing exception stack traces into API responses.
49713. **Verbose API-error response auditor** — Reviews API error payloads for internal paths, SQL fragments, or framework internals.
49714. **GraphQL error-verbosity auditor** — Checks GraphQL error extensions for stack traces, internal type names, or query-cost details.
49715. **gRPC error-detail auditor** — Verifies gRPC services do not return rich error details with internal metadata to untrusted clients.
49716. **SOAP fault-detail auditor** — Reviews SOAP fault strings for internal exception details exposed to callers.
49717. **Error-page info-leakage auditor** — Audits custom 404 and 500 pages for leaked paths, versions, or framework fingerprints.
49718. **OAuth error-verbosity auditor** — Checks OAuth and OIDC error responses for internal details beyond the standard error codes.
49719. **SAML error-verbosity auditor** — Reviews SAML error pages for IdP internals disclosed during failed authentications.
49720. **JWT error-verbosity auditor** — Verifies JWT validation errors do not distinguish expired, malformed, and signature-invalid tokens to callers.
49721. **Xdebug remote-debug exposure detector** — Detects Xdebug remote-debugging listeners exposed beyond developer machines.
49722. **Node.js inspector exposure detector** — Flags Node --inspect debug ports reachable over the network in production.
49723. **Python manhole exposure detector** — Detects Python manhole or console hooks left enabled in production services.
49724. **Rails better_errors exposure detector** — Flags better_errors pages accessible in production, which allow interactive debugging.
49725. **MiniProfiler exposure detector** — Detects MiniProfiler UI exposed to end users, revealing query and timing internals.
49726. **Glimpse legacy exposure detector** — Flags legacy Glimpse diagnostics still enabled on ASP.NET applications.
49727. **Flask debug-toolbar exposure detector** — Detects Flask-DebugToolbar active in production deployments.
49728. **Symfony web-debug-toolbar exposure detector** — Flags the Symfony web debug toolbar served to non-development clients.
49729. **Laravel Horizon dashboard exposure detector** — Verifies Laravel Horizon queue dashboards require authentication and are not public.
49730. **Drupal devel-module exposure detector** — Detects Drupal Devel module enabled in production, exposing diagnostic pages.
49731. **WordPress Query-Monitor exposure detector** — Flags Query Monitor output visible to non-administrators.
49732. **Magento developer-mode detector** — Detects Magento running in developer mode with verbose error display in production.
49733. **ASP.NET trace.axd exposure detector** — Flags trace.axd request tracing accessible remotely.
49734. **elmah.axd exposure detector** — Detects ELMAH error-log viewers reachable without authentication.
49735. **Spring developer-exception-page detector** — Flags Spring Boot Whitelabel error pages with debug details in production profiles.
49736. **Quarkus dev-UI exposure detector** — Detects Quarkus Dev UI enabled in production builds.
49737. **Dropwizard admin-servlet exposure detector** — Verifies Dropwizard admin servlets bind to internal interfaces with authentication.
49738. **FastAPI docs exposure auditor** — Reviews FastAPI /docs and /redoc availability in production and verifies authentication where needed.
49739. **OpenAPI JSON document exposure auditor** — Checks whether machine-readable OpenAPI documents are intentionally public or should be restricted.
49740. **GraphQL introspection-enabled detector** — Detects GraphQL introspection left enabled in production, exposing the full schema.
49741. **GraphiQL/Altair playground exposure detector** — Flags interactive GraphQL explorers served in production environments.
49742. **Hasura console exposure detector** — Detects Hasura consoles reachable without admin-secret protection.
49743. **gRPC reflection exposure detector** — Flags gRPC server reflection enabled in production, exposing service definitions.
49744. **Source-map exposure detector** — Detects .map files served publicly, which reconstruct original source code.
49745. **Framework version-in-HTML auditor** — Flags HTML comments, meta tags, and asset paths disclosing exact framework versions.
49746. **Generator meta-tag auditor** — Reviews generator meta tags that advertise CMS and version to scanners.
49747. **Server banner auditor** — Checks Server response headers for version disclosure and verifies banner minimization.
49748. **X-Powered-By header auditor** — Flags X-Powered-By and similar headers disclosing runtime technology stacks.
49749. **X-AspNet-Version header auditor** — Detects ASP.NET version headers that should be removed in production.
49750. **Debug query-parameter detector** — Flags debug=1 style parameters that toggle verbose output in production.
49751. **XDEBUG_SESSION trigger detector** — Detects Xdebug session triggers honored by production PHP deployments.
49752. **TRACE/TRACK method auditor** — Verifies HTTP TRACE and TRACK methods are disabled to prevent cross-site tracing.
49753. **OPTIONS-method disclosure auditor** — Reviews OPTIONS responses for excessive method and header disclosure.
49754. **Unnecessary-method auditor** — Flags PUT, DELETE, and other unneeded methods enabled on endpoints that only require GET and POST.
49755. **WebDAV/PROPFIND exposure auditor** — Verifies WebDAV methods are disabled where unused and that enabled instances require strong authentication.
49756. **.well-known inventory auditor** — Inventories .well-known URIs to confirm each serves an intended purpose without leaking internal endpoints.
49757. **security.txt presence verifier** — Confirms every public-facing property publishes a security.txt with current contact and policy fields.
49758. **phpinfo() exposure detector** — Detects phpinfo output reachable publicly, which discloses full PHP and server configuration.
49759. **Test-script exposure detector** — Finds leftover test.php, info.php, and diagnostic scripts in production document roots.
49760. **Diagnostics-page exposure detector** — Flags application diagnostics pages that report versions, paths, and environment details.
49761. **Health-endpoint exposure reviewer** — Reviews /health and /healthz endpoints to confirm they return minimal status without internal details.
49762. **Readiness/liveness detail-level auditor** — Verifies probe endpoints do not leak dependency versions or connection strings in failure output.
49763. **Actuator endpoint detail-level auditor** — Audits Spring Actuator exposure levels to confirm only intended endpoints are web-exposed.
49764. **Actuator heapdump/threaddump exposure detector** — Flags actuator dump endpoints that would expose memory and thread internals.
49765. **Jolokia exposure detector** — Detects Jolokia JMX-HTTP bridges reachable without authentication.
49766. **JMX RMI exposure auditor** — Verifies JMX remote ports require authentication with TLS and are not internet-exposed.
49767. **.NET diagnostic-port exposure detector** — Flags .NET diagnostic ports accessible over the network in production.
49768. **EventPipe exposure auditor** — Verifies EventPipe and dotnet-dump collection endpoints are restricted to authorized operators.
49769. **Java Flight Recorder streaming auditor** — Checks JFR streaming endpoints for authentication so profiling data stays private.
49770. **Arthas/Greys diagnostic exposure detector** — Detects Arthas, Greys, and similar JVM diagnostic agents attached in production.
49771. **IPython/Jupyter kernel exposure detector** — Flags interactive Python kernels reachable over the network outside development.
49772. **RStudio/Shiny debug exposure detector** — Detects RStudio Server and Shiny debug surfaces exposed without authentication.
49773. **Plumber API-docs exposure auditor** — Reviews Plumber API documentation endpoints for intentional versus accidental public exposure.
49774. **PostgREST OpenAPI exposure auditor** — Verifies PostgREST-generated API docs do not expose internal schema details unintentionally.
49775. **Prisma Studio exposure detector** — Detects Prisma Studio database browsers reachable without authentication.
49776. **Apollo Studio embedded-explorer auditor** — Reviews embedded Apollo explorers in production for authentication and query limits.
49777. **Jaeger/Zipkin UI exposure auditor** — Verifies distributed-tracing UIs require authentication since traces contain request payloads.
49778. **Continuous-profiler exposure auditor** — Checks Pyroscope and continuous-profiling UIs for authentication and data-retention controls.
49779. **AWS X-Ray daemon exposure auditor** — Verifies X-Ray daemon ports are not reachable from untrusted networks.
49780. **Application Insights snapshot-debugger auditor** — Reviews snapshot-debugger collection for PII handling and access controls.
49781. **New Relic browser-timing info auditor** — Checks browser-timing instrumentation for sensitive data in transmitted attributes.
49782. **Server-Timing header leakage auditor** — Reviews Server-Timing headers for internal metric names that aid fingerprinting.
49783. **X-Debug-Token header detector** — Detects debug-token headers that link responses to profiler snapshots.
49784. **Cache-status disclosure auditor** — Reviews X-Cache, Via, and CDN debug headers for infrastructure disclosure.
49785. **Deprecated API-version exposure auditor** — Flags deprecated API versions still serving traffic that should be sunset.
49786. **Beta/staging API exposure detector** — Detects beta or staging APIs reachable publicly with weaker controls than production.
49787. **Internal-API public-exposure auditor** — Finds APIs intended for internal use that respond to public internet traffic.
49788. **API version-inventory builder** — Builds a complete inventory of API versions in service to drive deprecation and hardening.
49789. **XML-RPC exposure auditor** — Verifies XML-RPC endpoints are disabled or hardened where the application does not need them.
49790. **WP REST API index exposure auditor** — Reviews WordPress REST API exposure against the site's actual headless or integration needs.
49791. **oEmbed/RSD/WLW disclosure auditor** — Checks WordPress discovery endpoints for unnecessary information disclosure.
49792. **Author-archive enumeration-surface auditor** — Verifies author archives and user enumeration surfaces are disabled where they serve no purpose.
49793. **Memcached stats exposure detector** — Detects Memcached stats interfaces reachable without authentication.
49794. **StatsD/Graphite exposure auditor** — Verifies metrics-ingestion endpoints require authentication or network restriction.
49795. **Netdata exposure detector** — Flags Netdata monitoring dashboards reachable without authentication.
49796. **Cockpit server-admin exposure detector** — Verifies Cockpit web consoles require strong authentication and are network-restricted.
49797. **Ajenti panel exposure detector** — Checks Ajenti server-admin panels for authentication strength and exposure scope.
49798. **OPcache/APCu status-page exposure detector** — Flags PHP opcode-cache status pages that disclose configuration and paths.
49799. **PHP-FPM status/ping exposure auditor** — Verifies PHP-FPM status and ping endpoints are restricted to monitoring sources.
49800. **Database test-script exposure detector** — Finds database connectivity test scripts left in production web roots.
49801. **Message-queue test-endpoint exposure auditor** — Verifies queue test and management endpoints are not publicly reachable.
49802. **Cache test-endpoint exposure auditor** — Checks cache flush and stats test endpoints for authentication.
49803. **Search-engine _cat API exposure auditor** — Verifies Elasticsearch _cat and cluster APIs require authentication.
49804. **Debug-header inventory auditor** — Builds an inventory of debug-related response headers across the estate for systematic removal.
49805. **Certificate-expiry monitoring pipeline** — Tracks every TLS certificate's expiry and alerts with enough lead time for orderly renewal.
49806. **Certificate hostname-mismatch detector** — Flags certificates whose SANs do not cover the hostnames actually served.
49807. **Wildcard-certificate scope auditor** — Reviews wildcard certificate deployment to confirm each host using it is authorized.
49808. **Self-signed certificate detector** — Flags self-signed certificates in production where publicly trusted CAs are required.
49809. **Expired-certificate detector** — Continuously detects expired certificates before users or monitors encounter them.
49810. **Certificate-authority trust auditor** — Reviews issuing CAs for trustworthiness and flags certificates from unexpected or untrusted authorities.
49811. **Certificate Transparency log monitor** — Watches CT logs for newly issued certificates for the organization's domains, including unauthorized issuance.
49812. **Unauthorized-issuance alerter** — Alerts within minutes when a certificate appears for organization domains from an unexpected CA.
49813. **TLS version-support auditor** — Inventories negotiated TLS versions across endpoints to confirm only supported versions are offered.
49814. **Deprecated TLS 1.0/1.1 detector** — Flags any endpoint still negotiating TLS 1.0 or 1.1 for immediate remediation.
49815. **TLS 1.3 adoption tracker** — Measures TLS 1.3 support across the estate as a hardening-progress metric.
49816. **Weak cipher-suite detector** — Flags cipher suites with known weaknesses in negotiated handshakes and server configurations.
49817. **RC4/3DES/CBC cipher flagger** — Specifically detects RC4, 3DES, and CBC-mode ciphers that should be disabled.
49818. **Forward-secrecy coverage auditor** — Verifies all negotiated cipher suites provide forward secrecy so past traffic stays safe if keys leak.
49819. **HSTS header verifier** — Confirms Strict-Transport-Security is present with a compliant max-age on every HTTPS response.
49820. **HSTS includeSubDomains checker** — Verifies HSTS policies include subdomains so insecure subdomains cannot undermine the parent.
49821. **HSTS preload-list status auditor** — Checks preload eligibility and submission status for domains requiring preload protection.
49822. **HSTS max-age policy auditor** — Verifies HSTS max-age meets the policy minimum, typically one to two years.
49823. **OCSP stapling verifier** — Confirms servers staple OCSP responses so clients can check revocation without extra connections.
49824. **Must-staple extension auditor** — Verifies must-staple certificates are deployed where revocation checking must be enforced.
49825. **Revocation-checking auditor** — Audits OCSP and CRL configurations to confirm revoked certificates are actually rejected.
49826. **CRL distribution-point reachability checker** — Verifies CRL distribution points are reachable and fresh so revocation data stays current.
49827. **SCT embedding auditor** — Confirms certificates embed signed certificate timestamps proving CT-log inclusion.
49828. **CAA record auditor** — Verifies CAA DNS records restrict issuance to authorized certificate authorities.
49829. **DANE/TLSA record auditor** — Checks DANE TLSA records where deployed to confirm they match served certificates.
49830. **MTA-STS policy auditor** — Verifies MTA-STS policies enforce TLS for inbound mail with valid policy files.
49831. **TLS-RPT reporting auditor** — Confirms TLS-RPT records exist so mail-TLS failures generate actionable reports.
49832. **SMTP STARTTLS enforcement auditor** — Verifies mail servers require STARTTLS and reject plaintext fallback where policy demands.
49833. **IMAP/POP3 TLS auditor** — Checks mailbox protocols enforce TLS so credentials never traverse the network in cleartext.
49834. **LDAPS enforcement auditor** — Verifies directory services require LDAPS or StartTLS for all binds.
49835. **RDP NLA/TLS enforcement auditor** — Confirms Remote Desktop requires Network Level Authentication with TLS encryption.
49836. **FTP plaintext-service detector** — Flags FTP services that should be replaced with SFTP or FTPS.
49837. **Telnet plaintext-service detector** — Flags any Telnet service as an immediate remediation priority for SSH replacement.
49838. **SNMPv3 adoption auditor** — Measures migration from SNMPv1/v2c community strings to authenticated, encrypted SNMPv3.
49839. **SSH hardening auditor** — Verifies SSH enforces key-only authentication, disables root login, and uses modern key exchange.
49840. **Cookie flag auditor** — Verifies Secure, HttpOnly, and SameSite attributes on all session and sensitive cookies.
49841. **Mixed-content detector** — Flags HTTPS pages loading HTTP subresources that undermine transport security.
49842. **Upgrade-Insecure-Requests auditor** — Verifies upgrade-insecure-requests directives guide browsers to HTTPS variants.
49843. **Referrer-Policy header auditor** — Checks Referrer-Policy settings prevent leaking internal URLs to third parties.
49844. **Permissions-Policy header auditor** — Verifies Permissions-Policy restricts powerful browser features to trusted origins.
49845. **X-Content-Type-Options auditor** — Confirms nosniff is set to block MIME-confusion attacks.
49846. **CSP header presence auditor** — Verifies Content-Security-Policy headers exist with restrictive directives on all applications.
49847. **X-Frame-Options auditor** — Confirms framing protections are set to prevent clickjacking of sensitive pages.
49848. **CORS misconfiguration auditor** — Reviews CORS policies for reflected origins or overly permissive credentialed access on APIs.
49849. **Subdomain-takeover detection pipeline** — Continuously monitors DNS records for dangling references to deprovisioned external services.
49850. **Dangling-CNAME detector (infra-audit)** — Flags CNAME records pointing to unclaimed or expired external hostnames.
49851. **Dangling-A-record detector (infra-audit)** — Flags A records pointing to deprovisioned cloud IPs that could be re-registered by others.
49852. **Expired-domain monitor** — Tracks domain expiries across the portfolio with renewal verification.
49853. **Registrar-lock status auditor** — Verifies registrar locks and transfer locks are enabled on critical domains.
49854. **Domain auto-renew auditor** — Confirms auto-renew is enabled with valid payment methods for all production domains.
49855. **WHOIS-privacy auditor** — Verifies WHOIS privacy or redaction protects registrant contact details.
49856. **DNSSEC validation auditor** — Confirms DNSSEC is enabled and validating on authoritative zones.
49857. **DNSSEC chain-integrity auditor** — Verifies the full DNSSEC chain from root to zone validates without breaks.
49858. **Zone-transfer exposure detector** — Flags DNS servers allowing AXFR zone transfers to unauthorized clients.
49859. **Open-resolver detector** — Detects the organization's own DNS servers answering recursive queries from the internet.
49860. **SPF record auditor** — Verifies SPF records exist, are syntactically valid, and end with a hard fail for owned domains.
49861. **DKIM record auditor** — Confirms DKIM selectors publish valid keys with adequate key lengths for sending domains.
49862. **DMARC policy auditor** — Verifies DMARC policies progress to p=reject with aggregate reporting enabled.
49863. **BIMI record auditor** — Checks BIMI records where deployed for valid certificates and logo compliance.
49864. **MX-record security auditor** — Reviews MX records for unexpected hosts that could intercept inbound mail.
49865. **Mail-server TLS auditor** — Verifies inbound and outbound mail servers negotiate modern TLS with valid certificates.
49866. **Autodiscover exposure auditor** — Checks Autodiscover endpoints for authentication and information disclosure.
49867. **CT-log subdomain inventory builder** — Builds a defensive subdomain inventory from Certificate Transparency logs for complete asset coverage.
49868. **Shadow-IT subdomain detector** — Flags subdomains with no CMDB record, indicating unmanaged or forgotten services.
49869. **Unclaimed-SaaS-subdomain detector** — Finds subdomains pointing at SaaS platforms with no active tenant claiming them.
49870. **SaaS-dangling signature library** — Maintains detection signatures for 50+ SaaS providers' dangling-record patterns for the takeover pipeline.
49871. **Origin-IP via DNS-history auditor** — Checks historical DNS records for origin IPs leaked before CDN or WAF adoption.
49872. **Origin-IP via CT-log auditor** — Reviews CT logs for certificates issued directly to origin IPs, bypassing edge protection.
49873. **Origin-IP via mail-header auditor** — Audits outbound mail headers for origin IPs disclosed in Received chains.
49874. **Origin-IP via favicon-hash auditor** — Checks whether origin servers are discoverable through favicon hashes in internet scanners.
49875. **WAF-bypass-via-origin auditor** — Verifies origins reject direct connections so attackers cannot bypass WAF and DDoS protection.
49876. **Origin TLS (Full Strict) verifier** — Confirms edge-to-origin connections use Full Strict TLS with valid origin certificates.
49877. **Authenticated-origin-pull auditor** — Verifies origins require authenticated origin pulls so only the edge network can connect.
49878. **Edge TLS-configuration auditor** — Reviews CDN and edge TLS settings for minimum version, cipher, and certificate hygiene.
49879. **Security-group open-ingress detector** — Flags security groups with 0.0.0.0/0 ingress on sensitive ports for justification or removal.
49880. **Overly-broad egress detector** — Reviews egress rules for unrestricted outbound access that enables data exfiltration.
49881. **Firewall-rule sprawl auditor** — Flags firewall rules with no owner, no recent hits, or overlapping coverage for cleanup.
49882. **NSG rule auditor** — Audits Azure network security group rules for least-privilege inbound and outbound flows.
49883. **NACL baseline auditor** — Verifies network ACLs provide stateless defense-in-depth consistent with security-group policy.
49884. **Expected-ports-only verifier** — Continuously verifies only documented ports are reachable on each host from each network zone.
49885. **Service-banner minimization auditor** — Checks service banners disclose minimal version information to unauthenticated clients.
49886. **Unnecessary-service detector** — Flags listening services with no business need for disablement.
49887. **IPv6 exposure-parity auditor** — Verifies IPv6 interfaces carry the same firewall and hardening controls as IPv4.
49888. **UPnP exposure detector** — Flags UPnP enabled on edge devices, which can open inbound ports without oversight.
49889. **LLMNR/NBNS/mDNS exposure auditor** — Verifies legacy name-resolution protocols are disabled or scoped to prevent spoofing.
49890. **BGP-hijack monitor** — Monitors BGP announcements for the organization's prefixes and alerts on unauthorized origin ASNs.
49891. **RPKI/ROA coverage auditor** — Verifies Route Origin Authorizations cover all announced prefixes with valid ROAs.
49892. **DDoS-protection coverage auditor** — Confirms every internet-facing asset sits behind DDoS mitigation with tested runbooks.
49893. **Rate-limiting presence auditor** — Verifies edge and application rate limiting protects authentication and expensive endpoints.
49894. **Bot-protection coverage auditor** — Checks bot-management coverage on login, signup, and abuse-prone endpoints.
49895. **VPN posture auditor** — Verifies VPN gateways run current software, require MFA, and log connections centrally.
49896. **ZTNA adoption tracker** — Measures migration from VPN to zero-trust network access with per-application policies.
49897. **Bastion-host hardening auditor** — Verifies bastion hosts enforce MFA, session recording, and allowlist-only egress.
49898. **IDS/IPS coverage auditor** — Confirms intrusion detection and prevention sensors cover all ingress and egress chokepoints.
49899. **NDR coverage auditor** — Verifies network detection and response covers east-west as well as north-south traffic.
49900. **NetFlow coverage auditor** — Checks NetFlow or VPC-flow collection covers all segments with retention for investigations.
49901. **DNS-filtering coverage auditor** — Verifies DNS-layer filtering blocks malicious domains for all endpoints including roaming devices.
49902. **Egress-filtering auditor** — Confirms egress filtering restricts outbound destinations to approved services and ports.
49903. **Proxy-coverage auditor** — Verifies web-proxy coverage with TLS inspection policy for managed endpoints.
49904. **Decoy/honeypot deployment auditor** — Confirms honeypots and decoys are deployed in key segments with alerting on any interaction.
49905. **Baseline-vs-current config differ** — Continuously diffs live configurations against approved baselines and alerts on any deviation.
49906. **Git-backed config versioning verifier** — Confirms all infrastructure and application configurations are versioned in Git with signed commits.
49907. **Immutable-infrastructure compliance checker** — Verifies servers and containers are replaced rather than patched in place, with no configuration drift.
49908. **IaC drift detector** — Runs plan-only checks in CI to detect infrastructure that drifted from its declared desired state.
49909. **ClickOps drift detector** — Correlates cloud-trail console activity against IaC to flag manual changes bypassing the pipeline.
49910. **Manual-change detection monitor** — Alerts on any production configuration change not linked to an approved change record.
49911. **Change-ticket correlation auditor** — Verifies every production change maps to a ticket with approval, testing, and rollback evidence.
49912. **Emergency-change review auditor** — Ensures emergency changes receive post-implementation review within the defined window.
49913. **Pre-change config-backup verifier** — Confirms automated configuration backups run before every change for reliable rollback.
49914. **Rollback-tested change auditor** — Verifies rollback procedures are tested per change type, not merely documented.
49915. **Environment-parity auditor** — Diffs dev, staging, and production configurations to ensure security controls are not weaker in lower environments handling real data.
49916. **CIS AWS Foundations mapper** — Maps cloud posture findings to CIS AWS Foundations Benchmark controls with pass/fail per control.
49917. **CIS Azure mapper** — Maps Azure posture findings to CIS Microsoft Azure Foundations Benchmark controls.
49918. **CIS GCP mapper** — Maps GCP posture findings to CIS Google Cloud Platform Foundations Benchmark controls.
49919. **CIS Kubernetes mapper** — Maps cluster findings to CIS Kubernetes Benchmark controls per node and control-plane component.
49920. **CIS Docker mapper** — Maps container-host findings to CIS Docker Benchmark controls.
49921. **CIS Linux mapper** — Maps host findings to the CIS Benchmark for the specific Linux distribution in use.
49922. **CIS Windows Server mapper** — Maps Windows host findings to CIS Windows Server Benchmark controls.
49923. **CIS web-server mapper** — Maps NGINX and Apache findings to their respective CIS Benchmark controls.
49924. **CIS database mapper** — Maps PostgreSQL, MySQL, MongoDB, and other database findings to CIS database benchmarks.
49925. **STIG control mapper** — Maps findings to DISA STIG controls for environments requiring US federal hardening standards.
49926. **NIST 800-53 control mapper (infra-audit)** — Maps audit findings to NIST 800-53 controls for federal and regulated-industry reporting.
49927. **ISO 27001 control mapper** — Maps findings to ISO 27001 Annex A controls for certification readiness.
49928. **SOC 2 control mapper (infra-audit)** — Maps findings to SOC 2 trust-services criteria for audit evidence.
49929. **PCI DSS control mapper** — Maps findings to PCI DSS requirements for cardholder-data environments.
49930. **HIPAA safeguard mapper (infra-audit)** — Maps findings to HIPAA administrative, physical, and technical safeguards.
49931. **Essential 8 maturity mapper** — Scores controls against the Australian Essential Eight maturity levels.
49932. **Cyber Essentials mapper** — Maps findings to UK Cyber Essentials controls for certification readiness.
49933. **Drift-alerting rule engine** — Evaluates configuration snapshots against rules and pages owners on high-severity drift.
49934. **Remediation-priority scoring engine** — Scores every finding by severity, exposure, exploitability, and asset value into one prioritized queue.
49935. **KEV-correlation scorer** — Boosts priority for findings matching CISA's Known Exploited Vulnerabilities catalog.
49936. **EPSS-integration scorer** — Incorporates EPSS exploit-probability scores so likely-to-be-exploited issues rank higher.
49937. **Asset-criticality scorer** — Weights findings by asset criticality tags so crown-jewel systems drive the top of the queue.
49938. **Internet-exposure multiplier** — Multiplies scores for internet-reachable assets to reflect real-world attack likelihood.
49939. **Exploit-maturity scorer** — Factors in public exploit availability, from proof-of-concept to weaponized, when ranking findings.
49940. **Threat-intel correlation scorer** — Correlates findings with active threat-actor campaigns targeting the organization's sector.
49941. **Business-impact scorer (infra-audit)** — Incorporates revenue, safety, and operational impact into remediation prioritization.
49942. **Data-classification scorer** — Weights findings by the classification of data on the affected asset.
49943. **Risk-acceptance expiry tracker** — Tracks accepted risks with expiry dates so acceptances cannot linger indefinitely.
49944. **Exception expiry monitor** — Monitors policy exceptions and drives re-approval or remediation before expiry.
49945. **Compensating-control auditor** — Verifies compensating controls are actually implemented and effective where primary controls are excepted.
49946. **Residual-risk scorer (infra-audit)** — Quantifies remaining risk after compensating controls for accurate reporting.
49947. **Security-debt dashboard builder** — Aggregates aging findings into a security-debt view with trend and paydown tracking.
49948. **MTTR tracker** — Measures mean time to remediate by severity to drive SLA accountability.
49949. **SLA-breach alerter (infra-audit)** — Alerts when findings exceed remediation SLAs with escalation to asset owners.
49950. **Finding-owner assignment auditor** — Verifies every finding has an accountable owner and flags orphaned findings.
49951. **Unowned-finding detector** — Surfaces findings tied to decommissioned teams or departed owners for reassignment.
49952. **Finding-deduplication engine** — Merges duplicate findings across scanners into single actionable items.
49953. **Suppression-rule auditor (infra-audit)** — Reviews finding suppressions for justification, expiry, and approver to prevent silent risk acceptance.
49954. **False-positive feedback-loop auditor** — Verifies false-positive reports tune detectors rather than accumulating as ignored noise.
49955. **Scanner-coverage auditor** — Measures the share of in-scope assets actually scanned by each scanner.
49956. **Scan-frequency auditor** — Verifies scan cadences meet policy for each asset class and data classification.
49957. **Scan-credential health checker** — Monitors authenticated-scan credentials for expiry and permission loss that silently degrade coverage.
49958. **Authenticated-vs-unauthenticated scan-gap auditor** — Quantifies the visibility gap between credentialed and uncredentialed scans per asset.
49959. **Agent-coverage auditor** — Measures EDR and security-agent deployment coverage across the fleet.
49960. **Cloud-API coverage auditor** — Verifies cloud security-posture APIs cover every account, subscription, and project.
49961. **SaaS-coverage auditor** — Confirms SaaS security-posture monitoring covers all sanctioned applications.
49962. **Shadow-IT discovery auditor** — Detects unsanctioned SaaS and cloud usage for governance review.
49963. **Asset-inventory completeness verifier** — Reconciles discovered assets against the CMDB to find unmanaged devices and services.
49964. **CMDB reconciliation auditor** — Verifies CMDB records match observed reality with ownership and lifecycle status.
49965. **IPAM reconciliation auditor** — Reconciles IP address management records against observed allocations to find rogue hosts.
49966. **DNS-inventory reconciliation auditor** — Reconciles DNS records against the asset inventory to find unrecorded services.
49967. **Certificate-inventory reconciliation auditor** — Reconciles observed certificates against the certificate inventory to find unmanaged issuance.
49968. **Domain-portfolio auditor** — Reviews the full domain portfolio for unnecessary, expired, or typo-variant domains to consolidate or defensively hold.
49969. **Cloud-account inventory auditor** — Maintains a complete inventory of cloud accounts with ownership and guardrail attachment.
49970. **Orphaned-resource detector** — Finds cloud resources with no owner, no recent use, and no IaC management for removal.
49971. **Zombie-resource detector** — Detects resources still incurring cost or exposure after their workloads were decommissioned.
49972. **Cost-anomaly security-signal monitor** — Treats unexpected cost spikes as potential compromise indicators for investigation.
49973. **Tag-compliance scorer** — Scores tag compliance across resources as a proxy for governance maturity.
49974. **Naming-convention auditor** — Verifies resource naming follows conventions that enable ownership and purpose identification.
49975. **Golden-image compliance verifier** — Confirms deployed images derive from hardened, scanned golden images within the patching SLA.
49976. **Container base-image policy auditor** — Verifies container builds use only approved base images from trusted registries.
49977. **Language-runtime version-policy auditor** — Flags end-of-life language runtimes for upgrade planning.
49978. **EOL-software detector** — Inventories end-of-life software across the estate with risk-ranked replacement plans.
49979. **Unsupported-OS detector** — Flags operating systems past vendor support for isolation or upgrade.
49980. **Firmware-version auditor** — Tracks firmware versions on network, storage, and server hardware against vendor security advisories.
49981. **Secure-boot verification checker** — Confirms Secure Boot is enabled so only signed bootloaders and kernels load.
49982. **Disk-encryption verification auditor** — Verifies full-disk encryption is enabled with keys escrowed per policy.
49983. **MITRE ATT&CK coverage mapper** — Maps detective and preventive controls to ATT&CK techniques to reveal coverage gaps.
49984. **Detection-as-code coverage auditor** — Verifies detection rules are versioned, tested, and deployed as code with peer review.
49985. **Log-source-per-technique auditor** — Confirms each in-scope ATT&CK technique has the log sources its detections require.
49986. **Purple-team exercise cadence auditor** — Verifies purple-team exercises run on schedule with findings tracked to control improvements.
49987. **Control-validation auditor** — Confirms breach-and-attack simulation validates that controls actually block the techniques they claim to cover.
49988. **Pentest-finding SLA tracker** — Tracks penetration-test findings from report to remediation against severity-based SLAs.
49989. **Bug-bounty scope auditor** — Verifies bounty scope stays current with the asset inventory so researchers test what matters.
49990. **Safe-harbor policy auditor** — Confirms the vulnerability-disclosure policy offers clear safe harbor to good-faith researchers.
49991. **Coordinated-disclosure SLA tracker** — Tracks researcher-reported issues from triage to fix with communication SLAs.
49992. **Hardening-checklist-per-asset auditor** — Verifies every asset class has a hardening checklist applied and attested at provisioning.
49993. **Runbook-coverage auditor** — Confirms operational runbooks exist and are current for every critical system.
49994. **Playbook-coverage auditor** — Verifies incident-response playbooks cover the organization's top threat scenarios.
49995. **Backup-restore drill cadence auditor** — Confirms restore drills run on schedule with success criteria and issue tracking.
49996. **Contact-tree/escalation auditor** — Verifies incident contact trees and escalation matrices are current and tested.
49997. **Alert-fatigue auditor** — Measures alert volumes per analyst and tunes noisy rules that cause real alerts to be missed.
49998. **On-call rotation auditor** — Verifies on-call rotations are staffed, fair, and equipped with runbook access.
49999. **Tabletop-exercise cadence auditor** — Confirms tabletop exercises run on schedule covering ransomware, data breach, and cloud-incident scenarios.
50000. **DR drill cadence auditor** — Verifies disaster-recovery drills test failover of critical systems with measured recovery times.
50001. **Config-backup auditor** — Confirms GitOps repositories, vaults, certificate authorities, and DNS zones are backed up with tested restores.
50002. **Patch-compliance dashboard builder** — Aggregates patch compliance by asset class with SLA tracking and exception visibility.
50003. **Vulnerability-SLA tracker** — Tracks every vulnerability from detection to verified remediation against severity-based SLAs.
50004. **Red-team finding remediation tracker** — Ensures red-team findings convert into control improvements with verified closure, not just reports.
