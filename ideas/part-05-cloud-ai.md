## M. Cloud misconfig — S3, Azure, GCP, Firebase, new check types
0001. **Bucket policy versus object ACL differential** — probe ListObjects and GetObject anonymously and under spoofed Referer identities to flag objects whose ACLs are wider than the bucket policy implies, catching "private" buckets that leak individual files.
0002. **ListBucket error-code oracle** — compare AccessDenied, NoSuchBucket, and AllAccessDisabled responses to confirm bucket existence without brute force, feeding a reliable existence oracle into deeper ACL probes.
0003. **S3 XML error differential mapper** — parse Error/Code values across guessed keys to distinguish forbidden-existing objects from nonexistent ones, enabling targeted content discovery instead of blind guessing.
0004. **READ_ACP grant scanner** — request ?acl on discovered buckets and objects to detect AllUsers or authenticated-users READ_ACP grants that expose the full permission graph to anyone.
0005. **Bucket version enumeration** — list ?versions on versioned buckets to recover deleted or overwritten objects such as old .env files and backups that owners assume are gone.
0006. **Delete-marker bypass retrieval** — request specific VersionIds sitting beneath delete markers to resurrect "deleted" secrets from versioned buckets.
0007. **S3 Select expression injection probe** — test select-object-content endpoints for expression injection that reads objects outside the intended prefix.
0008. **Wildcard principal policy detector** — fetch ?policy and flag Principal "*" paired with s3:GetObject on sensitive prefixes like backups/ or *.sql.
0009. **Cross-account confused-deputy tester** — check whether bucket policies trusting another account's role can be triggered by unauthenticated writes that the trusted account later processes.
0010. **MFA-delete gap flagger** — read versioning configuration to flag crown-jewel buckets lacking MFADelete, the precondition for silent destructive wipes.
0011. **Object-lock retention bypass probe** — test PutObjectRetention downgrades on compliance-mode objects to see whether supposedly immutable backups can actually be rewritten.
0012. **Presigned URL parameter tampering** — mutate X-Amz-Expires, X-Amz-SignedHeaders, and response-content-disposition on leaked presigned URLs to extend or repurpose their access.
0013. **Presigned POST policy forgery test** — decode leaked POST policies, then test widened conditions like starts-with key and content-length-range to upload attacker content into the victim bucket.
0014. **Presigned URL log mining** — extract presigned URLs from JS bundles, traffic captures, and public repos, then replay them for direct object reads the frontend never intended.
0015. **S3 Access Point policy gap probe** — enumerate S3 Access Points and Object Lambda endpoints whose own policies may be looser than the backing bucket's policy.
0016. **Directory bucket endpoint checks** — probe s3express endpoints for objects whose single-AZ storage and distinct policies diverge from the account's standard buckets.
0017. **Bucket CORS wildcard theft test** — test CORS rules with an attacker Origin plus credentials to confirm cross-site theft of "private" objects through victim browsers.
0018. **CORS exposed-header mining** — abuse Access-Control-Expose-Headers on misconfigured buckets to read ETag and version metadata that fingerprints internal object revisions.
0019. **Logging bucket recursion leak** — read server-access-logging target buckets that are themselves world-readable, exposing full request logs including signed URLs and client IPs.
0020. **CloudTrail digest bucket exposure** — probe logging buckets for CloudTrail digests that reveal internal API call patterns and IAM principal names.
0021. **S3 Inventory manifest harvesting** — fetch S3 Inventory manifests and CSVs that list every object key, turning key-guessing into a complete directory listing.
0022. **Git repository reconstruction from buckets** — request .git/HEAD, config, refs, and packed-refs inside buckets to rebuild full source repos from static-hosted copies.
0023. **Environment file probing in buckets** — probe .env, .env.local, and .env.production at bucket roots and deploy prefixes for database URLs and API keys baked into static sites.
0024. **Terraform state file extraction** — fetch terraform.tfstate and *.tfstate.backup keys to extract plaintext secrets from state files developers store in S3.
0025. **CloudFormation template leakage** — pull deployment template artifacts that embed stack parameters, including secrets that older templates failed to mask.
0026. **Dated backup archive discovery** — probe timestamped prefixes like backup-YYYY-MM-DD and dump.sql.gz using lifecycle-derived date patterns to find retained database dumps.
0027. **Snapshot file exposure check** — look for EBS/RDS snapshot exports and VMDK files uploaded to buckets with world-readable ACLs.
0028. **CI artifact residue scan** — inspect buckets used as CI artifact stores for build outputs containing embedded secrets or internal hostnames.
0029. **CloudFront origin direct-access bypass** — request the S3 origin hostname directly to bypass CloudFront signed-URL protections when the bucket policy still permits origin reads.
0030. **OAI versus OAC enforcement differential** — compare legacy Origin Access Identity and Origin Access Control behaviors to find origins that enforced auth only at the CDN edge.
0031. **CloudFront edge secret echo abuse** — abuse viewer-request functions that reflect headers to extract origin credentials injected at the edge.
0032. **Dangling CNAME bucket takeover proof** — detect CNAMEs pointing at deleted buckets and attempt re-creation in an allowed region to claim the hostname.
0033. **Multi-region bucket confusion test** — test identical bucket names across regions to find cases where a write or claim succeeds in a region the owner never registered.
0034. **Brand-derived bucket name predictor** — generate bucket-name permutations from the target brand (backups, prod-assets, logs) and validate via HeadBucket timing differentials.
0035. **Transfer Acceleration endpoint probe** — test bucket.s3-accelerate.amazonaws.com for policy gaps that the acceleration endpoint exposes while regional endpoints deny.
0036. **Dual-stack IPv6 policy gap probe** — probe dualstack endpoints where bucket policies keyed on IPv4 aws:SourceIp fail open over IPv6.
0037. **VPC endpoint condition bypass test** — analyze bucket policies with aws:SourceVpce conditions from outside the VPC to confirm they deny, flagging any that do not.
0038. **Spoofable condition key tester** — test aws:Referer and organization-ID conditions against attacker-controlled values that look restrictive but are trivially forged.
0039. **Requester-Pays abuse assessment** — identify Requester-Pays buckets where anonymous ListObjects still works, enabling cost-amplification and metadata harvesting.
0040. **Object tagging PII leak reader** — read ?tagging on objects for tags like owner-email or data-classification that disclose internal handling metadata.
0041. **Governance retention bypass probe** — test whether governance-mode retention can be bypassed with s3:BypassGovernanceRetention using exposed credentials.
0042. **Replication destination mapper** — read replication configurations to discover destination buckets and accounts, expanding the target's storage footprint.
0043. **Notification config topology leak** — read ?notification configurations for Lambda and SQS ARNs that map internal function names and queue topology.
0044. **Website endpoint index mining** — fetch S3 website endpoints with common index and error-key guesses, using 404 differentials to enumerate "directory" contents.
0045. **Static-website redirect rule abuse** — exploit routing rules with ReplaceKeyPrefix to turn the bucket into an open redirector usable in phishing.
0046. **Delimiter pagination keyspace walker** — use delimiter=/ pagination on listable buckets to walk entire keyspaces systematically instead of guessing keys.
0047. **Glacier restore exfiltration probe** — trigger restore requests on archived objects, then poll for temporary readable copies of "cold" sensitive data.
0048. **Storage-class transition inference** — use HEAD response headers on storage-class transitions to infer object age and access patterns useful for social engineering.
0049. **Object Lambda redaction bypass** — call the Object Lambda access point versus the raw object to find PII-redaction transforms that can be skipped by addressing the bucket directly.
0050. **Access Grants stale-identity probe** — probe S3 Access Grants for overly broad grants tied to SSO identities that persist after employee offboarding.
0051. **Storage Lens dashboard exposure** — find publicly shared Storage Lens dashboards revealing bucket-level metrics and prefix activity.
0052. **S3-compatible provider check sweep** — replay the core S3 test suite against Wasabi, Backblaze B2, and DigitalOcean Spaces where defaults are looser and versioning is often off.
0053. **MinIO console default-credential probe** — probe ports 9000/9001 for MinIO consoles with default credentials or browser-persisted sessions.
0054. **Ceph RGW admin-ops disclosure** — test /admin endpoints on Ceph RadosGW deployments for unauthenticated usage and billing disclosure.
0055. **Oracle Cloud PAR scope tester** — test pre-authenticated requests for overly broad scope and expiry, then chain namespace and bucket enumeration.
0056. **Alibaba OSS anonymous policy probe** — run bucket-policy and object-ACL equivalent checks on OSS buckets with translated error parsing.
0057. **Tencent COS anonymous probe** — run the same policy/ACL differential checks against Tencent COS buckets, which share OSS-style anonymous-read defaults.
0058. **Backblaze B2 key-scope validator** — validate leaked B2 application keys for bucket-scoped versus account-scoped capabilities and listFileNames abuse.
0059. **Spaces CDN edge bypass** — request the origin Spaces endpoint versus the CDN edge to find objects the CDN was meant to gate.
0060. **Bunny storage pull-zone gap test** — test pull-zone origins for direct storage access that bypasses token authentication.
0061. **Azure blob container list probe** — query storageaccount.blob.core.windows.net/container?restype=container&comp=list for anonymous container listing.
0062. **Azure $root container abuse test** — test the special $root container for blobs served at the account root that owners forget are public.
0063. **Container ACL level differential** — compare ?restype=container ACLs to detect containers set to full anonymous list versus blob-only read with known names.
0064. **SAS token leak miner** — regex-hunt frontend bundles for sig= SAS tokens, then validate their permissions and expiry for durable anonymous access.
0065. **SAS signed-IP and expiry audit** — test whether leaked SAS tokens lacking signed-IP restrictions or carrying far-future expiry grant persistent access.
0066. **Stored access policy revocation check** — determine whether a leaked SAS references a revocable stored access policy or is an ad-hoc SAS that lives until expiry.
0067. **Azure static website $web misconfig** — probe $web containers for index and 404 differentials that reveal unpublished blobs.
0068. **Data Lake Gen2 ACL gap probe** — test dfs.core.windows.net paths where POSIX-style ACLs grant broader access than the blob endpoint suggests.
0069. **Azure file share anonymous probe** — test storageaccount.file.core.windows.net shares for anonymous REST access when SMB is firewalled.
0070. **Table storage entity scraping** — query table.core.windows.net tables anonymously for entities containing connection strings or user PII.
0071. **Queue storage message snooping** — test queue endpoints for anonymous peek-message access that leaks background-job payloads.
0072. **Functions HTTP-trigger auth probe** — call Azure Function endpoints without ?code= to find functions left at anonymous authLevel executing privileged logic.
0073. **Function master key disclosure** — probe admin endpoints and leaked _master keys in repos for full function-app control.
0074. **App Service Kudu SCM exposure** — test .scm.azurewebsites.net for anonymous access to deployment logs, environment variables, and console.
0075. **Publish profile credential leak** — check for leaked publish settings enabling MSDeploy takeover of app services.
0076. **App Service backup download probe** — probe /backups endpoints for downloadable site-plus-database snapshot zips.
0077. **Static Web Apps config leak** — fetch staticwebapp.config.json and auth endpoints for misconfigured rules and exposed API backends.
0078. **Cosmos DB key replay test** — extract leaked Cosmos DB master keys from frontend code and validate their read/write scope before rotation.
0079. **Azure SQL firewall inference** — probe database.windows.net for error differentials revealing overly permissive firewall rules.
0080. **ARM template storage key leak** — scan exposed deployment templates and parameters files for committed storage keys.
0081. **Key Vault anonymous probe** — test vault.azure.net secrets endpoints without auth to confirm denial, flagging vaults with permissive access policies.
0082. **Managed identity token proxy hunt** — test web endpoints that proxy the instance metadata service, which would hand managed-identity tokens to callers.
0083. **Azure DevOps feed exposure** — probe pkgs.dev.azure.com feeds for anonymous package downloads revealing internal libraries.
0084. **Container registry anonymous pull** — test Azure Container Registry for anonymous image pulls containing secrets in layers or env.
0085. **Azure OpenAI key scope test** — validate leaked Azure OpenAI keys for listable deployments and abusable token burn.
0086. **Cognitive Services key replay** — test leaked Speech and Vision keys for quota burn and data exfiltration through the service.
0087. **B2C policy manipulation probe** — tamper with policy and prompt parameters on b2clogin.com to detect MFA or signup-restriction bypasses.
0088. **Storage lifecycle exfil timing** — abuse lifecycle timing to predict when sensitive blobs move tiers and intercept them inside SAS windows.
0089. **Immutable policy bypass test** — test time-based retention policies on blobs for legal-hold bypass via leaked privileged SAS.
0090. **Front Door origin bypass** — resolve origin hostnames behind Azure Front Door and request them directly to skip WAF rules enforced at the edge.
0091. **Private endpoint DNS residue** — use DNS history to recover pre-private-endpoint public hostnames that may still resolve to storage.
0092. **Policy exemption mining** — read exposed management-group policy assignments for exemptions revealing intentionally weakened controls.
0093. **Service Bus SAS replay** — test leaked Service Bus SAS tokens for send/listen rights enabling message injection into backend workflows.
0094. **Event Hubs capture file exposure** — probe storage accounts holding Event Hubs Capture Avro files for replayable event streams.
0095. **Data Factory linked-service leak** — extract linked-service definitions from exposed Data Factory artifacts for credential reuse.
0096. **Synapse workspace exposure** — test web.azuresynapse.net workspaces for anonymous notebook or SQL access to data lakes.
0097. **Maps and Search key abuse** — replay leaked Maps/Search keys for quota burn and location-data scraping.
0098. **Notification Hubs rogue registration** — abuse leaked hub connection strings to register rogue devices for push spam.
0099. **Batch account job tampering** — test Batch account keys for job submission enabling compute abuse.
0100. **HDInsight gateway default credentials** — probe HDInsight gateways for default-credential Ambari access.
0101. **VM custom-script residue hunt** — check storage for custom-script extension payloads containing administrator passwords.
0102. **Disk snapshot SAS URL hunt** — hunt for leaked disk and snapshot SAS URLs granting full VHD download of VM disks.
0103. **Site Recovery vault exposure** — probe recovery-services vaults for replication metadata disclosure.
0104. **Serial console misconfig probe** — test serial console endpoints for unauthenticated VM console access.
0105. **Arc onboarding script leak** — extract Azure Arc onboarding scripts containing service-principal secrets.
0106. **Lighthouse delegation overreach audit** — analyze exposed Lighthouse manifests for excessive delegated RBAC.
0107. **Blueprints artifact secret leak** — read blueprint artifacts for hardcoded secrets in ARM templates.
0108. **Management group hierarchy disclosure** — enumerate tenant management groups where anonymously allowed to map subscription topology.
0109. **Resource Graph query abuse** — test leaked tokens for Resource Graph read access enabling full subscription inventory.
0110. **Deployment script log residue** — probe deployment-script artifacts in storage for script logs containing secrets.
0111. **Monitor log export exposure** — find storage accounts holding exported Activity and Log Analytics data readable anonymously.
0112. **Application Insights key abuse** — replay leaked instrumentation keys to inject fake telemetry and poison dashboards.
0113. **Log Analytics key replay** — test leaked workspace keys for query-API abuse and data exfiltration.
0114. **Data Explorer anonymous query** — probe ADX clusters for anonymous Kusto database query access.
0115. **Purview scan metadata disclosure** — test Purview scanning endpoints for metadata disclosure of scanned data assets.
0116. **Redis cache firewall gap probe** — probe redis.cache.windows.net for unauthenticated access via misconfigured firewall rules.
0117. **SignalR upstream abuse** — abuse leaked SignalR connection strings to broadcast malicious messages to application clients.
0118. **Web PubSub key replay** — test leaked Web PubSub keys for client-message injection into live hubs.
0119. **Communication Services token minting** — abuse leaked ACS connection strings to mint user tokens for SMS and voice fraud.
0120. **Health Data Services FHIR read probe** — probe FHIR endpoints for anonymous patient-data reads.
0121. **GCS bucket IAM grant reader** — fetch IAM policies on storage.googleapis.com buckets to find allUsers objectViewer grants the console UI hides.
0122. **GCS uniform versus object ACL differential** — compare bucket-level IAM against legacy object ACLs to catch objects shared on "private" buckets.
0123. **GCS signed URL scope validator** — test leaked signed URLs for mutated response-content-type and extended expiry to confirm overly broad signing keys.
0124. **GCS signed policy forgery test** — decode leaked POST policies and test widened key prefixes for arbitrary uploads into victim buckets.
0125. **GCS archived generation recovery** — list archived object generations to recover overwritten secrets and backups.
0126. **GCS retention bypass probe** — test whether temporary holds or retention policies can be lifted with leaked service-account keys.
0127. **GCS CORS wildcard theft test** — validate CORS configs allowing attacker origins with credentials for cross-site object theft.
0128. **GCS log bucket exposure** — read _gcs_log buckets for access logs containing signed URLs and internal IPs.
0129. **Cloud CDN signed URL bypass** — request the GCS origin directly to bypass Cloud CDN signed-URL enforcement.
0130. **Load balancer backend-bucket gap** — probe backend-bucket configs for missing Cloud Armor policies versus direct bucket access.
0131. **App Engine version enumerator** — enumerate versions via version-dot-service hostnames to find old, unpatched deployments still serving traffic.
0132. **App Engine source context leak** — fetch source-context artifacts exposing repo URLs and commit SHAs.
0133. **Cloud Functions unauthenticated invoke** — test cloudfunctions.net triggers for allow-unauthenticated IAM bindings on sensitive functions.
0134. **Cloud Run invoker grant probe** — probe run.app services for allUsers run.invoker grants on admin or debug endpoints.
0135. **Cloud Run revision mining** — enumerate old revisions still serving traffic with known-vulnerable code.
0136. **Firebase RTDB open read probe** — request /.json and /.json?shallow=true to detect world-readable databases and map node structure.
0137. **RTDB controlled write tester** — attempt writes to canary scratch nodes to confirm world-writable rules without touching real data.
0138. **RTDB validation rule bypass** — craft payloads that pass weak .validate rules to confirm business rules are enforced client-side only.
0139. **Firestore rules inference via queries** — issue crafted where and orderBy queries to infer allow rules and extract documents beyond intended scope.
0140. **Firestore collection-group discovery** — use collectionGroup queries to discover hidden subcollections the app never lists.
0141. **Firebase Storage rules bypass** — test storage paths against rules with mismatched auth checks using unauthenticated SDK calls.
0142. **Remote Config secret mining** — fetch Remote Config values for feature flags and embedded secrets, testing forced-fetch overrides.
0143. **Firebase Hosting rewrite exposure** — probe hosting rewrites that expose Cloud Functions or database paths without auth.
0144. **Firebase API key account oracle** — use leaked web API keys to enumerate sign-in methods per email for account-existence oracles.
0145. **App Check enforcement verifier** — test whether App Check is actually enforced on database and functions or merely configured client-side.
0146. **GCP service account key scope test** — hunt repos and buckets for service-account key JSON files, then validate their IAM role scope read-only.
0147. **Service account impersonation chain mapper** — test getAccessToken on leaked keys to map impersonation paths toward privileged accounts.
0148. **OAuth consent screen over-scope audit** — analyze exposed OAuth client IDs for over-scoped or unverified consent screens enabling phishing.
0149. **GKE endpoint anonymous probe** — probe discovered GKE cluster endpoints for anonymous Kubernetes API access.
0150. **Artifact Registry anonymous pull** — test Artifact Registry repos for anonymous image and layer download revealing secrets.
0151. **Cloud Build log secret grep** — fetch exposed Cloud Build logs for secrets echoed during builds.
0152. **Cloud Source Repositories read probe** — probe source repos for anonymous reads of internal code.
0153. **Secret Manager grant probe** — test Secret Manager APIs with leaked keys for secrets.get on production secrets.
0154. **KMS decrypt capability test** — validate in a controlled way whether leaked keys can decrypt via Cloud KMS, proving key-material impact.
0155. **BigQuery dataset ACL probe** — test BigQuery datasets for allUsers READER grants exposing analytics or PII tables.
0156. **Authorized view bypass test** — query underlying tables directly to confirm authorized views are the only gate.
0157. **Pub/Sub anonymous publish test** — test topics for anonymous publish enabling event injection into data pipelines.
0158. **Dataflow metadata leak probe** — probe Dataflow jobs for pipeline options containing credentials.
0159. **Composer Airflow exposure** — test Composer Airflow URIs for anonymous DAG and code access.
0160. **Dataproc gateway exposure** — probe Dataproc gateways like Jupyter and history servers for unauthenticated access.
0161. **Vertex AI endpoint auth probe** — test AI Platform endpoints for missing IAM, enabling free inference and data extraction.
0162. **Dialogflow agent exposure** — probe Dialogflow agents for unauthenticated detectIntent revealing training phrases and webhook URLs.
0163. **Apigee proxy validation gap** — test Apigee proxies for API-key validation gaps and backend URL disclosure.
0164. **Cloud Endpoints key bypass** — tamper with API-key handling to find endpoints where ESP validation is misconfigured.
0165. **IAP bypass via direct backend** — test whether IAP-protected apps leak through direct backend service URLs or missing IAP headers.
0166. **Organization policy gap reader** — read exposed org policies for disabled constraints indicating weakened posture.
0167. **Cloud DNS zone enumeration** — test Cloud DNS zones for listing misconfigs that expose full record sets.
0168. **Cloud Armor direct-origin bypass** — resolve origins behind Cloud Armor and test direct access.
0169. **Storage Transfer manifest leak** — probe transfer jobs for manifest files listing source object keys.
0170. **Backup and DR vault exposure** — test backup vaults for anonymous restore-metadata reads.
0171. **Compute snapshot sharing check** — check compute snapshots for public sharing enabling disk cloning.
0172. **Public custom image audit** — enumerate public custom images that may contain baked-in secrets.
0173. **Metadata proxy endpoint hunt** — test web endpoints that proxy the GCP metadata server, which would leak service-account tokens.
0174. **SSH key residue in buckets** — hunt buckets for authorized_keys and private-key files left by GCE workflows.
0175. **Deployment Manager template leak** — fetch Deployment Manager templates for hardcoded secrets.
0176. **Cloud Scheduler job disclosure** — probe scheduler jobs for target URLs and OIDC auth headers in exposed configs.
0177. **Cloud Tasks queue abuse** — test task queues for anonymous task creation pointing at internal handlers.
0178. **Workflows connector credential leak** — read Workflows definitions for connector auth embedded in YAML.
0179. **Eventarc trigger enumeration** — discover Eventarc triggers revealing internal event topology.
0180. **Marketplace deployment residue** — probe marketplace-deployed apps for default credentials and setup artifacts.
0181. **Supabase public bucket sweep** — enumerate storage/v1/object/public buckets and test RLS bypass via direct object URLs.
0182. **Supabase anon key overreach** — test anon keys for table reads beyond RLS intent using crafted filters and OR conditions.
0183. **Supabase realtime snoop** — subscribe to realtime channels with the anon key to confirm row leaks in broadcast payloads.
0184. **Supabase edge function auth gap** — call edge functions without Authorization to find missing JWT verification.
0185. **Supabase service role key leak test** — validate leaked service_role keys for full admin API access using read-only checks.
0186. **Appwrite open permission probe** — probe Appwrite endpoints for project IDs with open read permissions on databases and buckets.
0187. **Appwrite API key scope test** — validate leaked API keys for overly broad scopes via account and session probing.
0188. **Hasura admin secret leak** — test for leaked Hasura admin secrets enabling full schema and data access.
0189. **PocketBase admin exposure** — probe admin dashboards for default credentials and test unauthenticated API rules on collections.
0190. **PocketBase file token bypass** — test file-serving URLs for token-validation gaps on private collections.
0191. **Parse Server master key probe** — test master-key headers with common or empty values for full data access.
0192. **Parse config key leak** — fetch Parse config endpoints for app keys usable for privileged ops without the master key.
0193. **CloudKit container discovery** — probe CloudKit containers for world-readable record zones via leaked container IDs.
0194. **Amplify backend config leak** — fetch amplifyconfiguration.json for pool IDs, then test Cognito misconfigurations.
0195. **Cognito identity pool escalation** — test unauthenticated identity pools for IAM roles granting S3 and DynamoDB access beyond intent.
0196. **Cognito client secret absence** — test app clients without secrets for auth abuse and user enumeration.
0197. **DynamoDB via Cognito role probe** — use vended credentials to test DynamoDB table access scope with read-only validation.
0198. **S3 via Cognito role probe** — test whether the identity pool's authenticated role allows ListBucket on app buckets.
0199. **Lambda Function URL auth probe** — test lambda-url endpoints for NONE versus AWS_IAM auth, flagging NONE on data-handling functions.
0200. **API Gateway stage gap probe** — probe execute-api endpoints for missing API keys, throttling, and WAF on sensitive stages.
0201. **API Gateway documentation leak** — fetch exported documentation endpoints revealing full API surface and auth requirements.
0202. **Stack output JS mining** — extract CloudFormation/SAM stack outputs like bucket names and API URLs from frontend bundles.
0203. **ECS task definition exposure** — probe exposed ECS metadata for task definitions containing secrets in environment variables.
0204. **ECR public gallery mining** — search ECR Public for brand images containing secrets or internal endpoints.
0205. **EKS endpoint anonymous probe** — probe EKS API endpoints for anonymous auth and dashboard exposure.
0206. **RDS snapshot sharing check** — check RDS snapshots for public restore permissions enabling full database clones.
0207. **Aurora snapshot exposure** — check Aurora clusters for publicly or cross-account shared snapshots.
0208. **Redshift snapshot access test** — test Redshift snapshots for public availability.
0209. **ElastiCache backup bucket leak** — find ElastiCache backups stored in world-readable buckets.
0210. **DocumentDB snapshot sharing** — probe for publicly shared DocumentDB and Neptune snapshots.
0211. **SQS and SNS anonymous probe** — test queue and topic URLs for anonymous send and publish access.
0212. **SES credential scope validation** — validate leaked SES credentials for email-spoofing scope using validate-only checks.
0213. **CloudWatch log export exposure** — probe S3-exported log groups for credentials in application logs.
0214. **Config history bucket exposure** — read Config history buckets for resource configurations revealing internal architecture.
0215. **IAM credential report leak** — find exposed credential reports revealing password age, key age, and MFA gaps.
0216. **STS session token misuse test** — test leaked long-term keys for session-token minting that bypasses MFA conditions.
0217. **Trust policy external ID audit** — analyze exposed role trust policies for missing external IDs enabling confused-deputy takeover.
0218. **Access point alias DNS mining** — resolve S3 access-point aliases to discover account IDs and bucket mappings.
0219. **AWS Backup vault exposure** — probe backup vaults for recovery-point metadata disclosure.
0220. **EFS mount target exposure** — probe EFS mount targets reachable publicly due to missing security groups.
0221. **Transfer Family SFTP probe** — test Transfer Family servers for anonymous or weak-credential access to S3-backed SFTP.
0222. **Cloud9 share residue** — detect shared Cloud9 environments with persisted AWS credentials.
0223. **CodePipeline artifact bucket leak** — probe pipeline artifact buckets for buildspecs and embedded secrets.
0224. **CodeCommit credential replay** — test leaked git credentials against CodeCommit repos containing secrets.
0225. **X-Ray service map disclosure** — probe X-Ray endpoints for internal service-map disclosure.
0226. **Step Functions history leak** — test states endpoints for execution histories containing input payloads with PII.
0227. **EventBridge archive replay** — probe event archives for replayable sensitive events.
0228. **CloudFront real-time log exposure** — find real-time log destinations readable anonymously.
0229. **WAF log destination leak** — read WAF log destinations for full request logs including auth headers.
0230. **Shield config origin inference** — infer origin IPs from exposed shielding configs for direct-origin bypass.
0231. **Route53 zone enumeration** — test for public hosted-zone listing via leaked credentials or misconfigured delegation.
0232. **Private CA endpoint exposure** — probe ACM Private CA for certificate-issuance endpoints exposed publicly.
0233. **Rotation lambda log leak** — find Secrets Manager rotation Lambda logs leaking secret values.
0234. **Parameter Store hierarchy mining** — test SSM parameter paths for GetParameter on production hierarchies with leaked credentials.
0235. **Security Hub export leak** — probe exported security findings in S3 revealing the org's own vulnerability inventory.
0236. **Macie finding bucket exposure** — read Macie discovery buckets for PII findings the scanner itself flagged.
0237. **GuardDuty suppression inference** — infer detection gaps from exposed suppression rules.
0238. **Outposts endpoint sweep** — test Outposts endpoints for weaker on-prem network controls.
0239. **S3 Select CSV formula injection** — test whether CSV exports from S3 Select are rendered by the app without sanitization, enabling spreadsheet formula injection.
0240. **Parquet footer metadata disclosure** — read Parquet footers of world-readable data-lake files for schema and PII inference.
0241. **Delta Lake manifest mining** — fetch _delta_log and metadata.json manifests to enumerate every data file in exposed lake tables.
0242. **Athena result bucket leak** — find Athena query-result buckets readable anonymously, leaking query outputs.
0243. **Spark history server exposure** — probe EMR and Spark history servers for job details containing S3 paths and credentials.
0244. **SageMaker notebook URL leak** — test leaked notebook presigned URLs for unauthenticated notebook access.
0245. **SageMaker model artifact exposure** — probe model.tar.gz artifacts in S3 for training-data and credential residue.
0246. **Bedrock knowledge base source leak** — find S3 sources backing Bedrock knowledge bases readable directly, bypassing RAG access controls.
0247. **Bedrock action group exposure** — probe Bedrock agent action groups for unauthenticated Lambda invocations.
0248. **Cross-cloud bucket collision monitor** — continuously test whether the brand's bucket names exist and are claimable across AWS, GCP, and Azure simultaneously.
0249. **Dangling cloud CNAME classifier** — fingerprint CNAME targets like s3, blob, and appspot, then auto-run the provider-specific takeover proof.
0250. **Expired domain cloud asset check** — detect expired domains whose cloud assets still reference them, then validate re-registration impact.
0251. **Cloud asset subdomain shadowing** — find subdomains resolving to cloud storage that shadow production paths, serving attacker content under brand trust.
0252. **CDN cache deception on buckets** — test path-confusion payloads against CDN-to-bucket setups to poison cache with attacker-readable responses.
0253. **Shared signed URL liveness tracker** — identify presigned URLs with signatures shared in public forums and tickets, then validate they are still live.
0254. **Long-lived grant expiry monitor** — track discovered presigned and SAS URLs and alert on grants with lifetimes beyond seven days.
0255. **Bucket policy time-bomb check** — parse Condition date clauses for temporary grants that never expired.
0256. **Forwarded-header IP condition bypass** — test buckets trusting X-Forwarded-For or CDN headers for IP conditions that attackers control.
0257. **Null referer condition bypass** — test aws:Referer conditions against null or empty referers that some policies accidentally allow.
0258. **Contradictory policy statement finder** — analyze bucket policies for one statement allowing what another denies, flagging effective-allow errors.
0259. **NotAction overreach flagger** — flag policies using NotAction with Allow that silently grant unintended storage actions.
0260. **Policy version rollback detector** — check for non-default policy versions that re-grant access the current version removed.
0261. **Malware hosting abuse check** — detect buckets serving executables with spoofed content-types used in phishing under the brand's trust.
0262. **SEO spam doorway detector** — find compromised buckets hosting spam doorway pages that damage brand trust.
0263. **Miner payload hosting scan** — scan bucket objects for miner scripts indicating compromised storage credentials.
0264. **C2 dead-drop pattern detector** — flag buckets with suspicious write patterns like small frequent PUTs from many IPs suggesting C2 abuse.
0265. **Exfil staging bucket fingerprint** — identify buckets with one-day auto-delete lifecycle rules, a common exfil-staging pattern.
0266. **Ransomware precondition probe** — test whether versioning and MFA delete are absent on critical buckets, the precondition for encryption-in-place extortion.
0267. **Replication lag window measurement** — measure cross-region replication lag to predict windows where primary deletes have not propagated.
0268. **Object timestamp oracle** — use Last-Modified distributions to infer deployment schedules and CI cadence for targeted attack timing.
0269. **ETag tamper monitor** — track ETags of sensitive objects to detect silent tampering or unauthorized modification.
0270. **Bucket encryption compliance check** — flag buckets holding PII-like keys without server-side encryption, a compliance-reportable finding.
0271. **TLS version enforcement probe** — test storage endpoints for acceptance of TLS 1.0 or 1.1 indicating weak transport posture.
0272. **Custom domain HTTPS gap test** — test bucket custom domains serving plain HTTP or expired certificates enabling MITM.
0273. **HSTS absence on storage endpoints** — flag missing HSTS on buckets serving auth-adjacent content.
0274. **SRI bypass via writable bucket** — check whether the site's subresource-integrity hashes are bypassable because scripts are served from a writable bucket.
0275. **Dangling CloudFront distribution takeover** — detect CloudFront distributions pointing at deleted origins and validate domain claim.
0276. **Azure CDN endpoint takeover** — detect azureedge.net endpoints with deleted origins and validate claimability.
0277. **Cloud CDN backend dangle check** — detect load-balancer hostnames whose backend buckets were deleted.
0278. **R2 custom domain dangle** — test R2 custom domains whose buckets were removed.
0279. **Firebase Hosting dangle** — detect hosting sites whose backend rewrites point at deleted functions or buckets.
0280. **Vercel Blob public-read audit** — probe framework blob stores for public-read misconfiguration on application uploads.
0281. **PaaS volume snapshot exposure** — probe Railway, Render, and Fly volume snapshot endpoints for public access.
0282. **Replit asset secret scan** — enumerate public Replit project assets for embedded secrets.
0283. **Sandbox preview env leak** — test CodeSandbox and StackBlitz preview URLs for exposed environment and filesystem.
0284. **Codespaces forwarded-port leak** — detect forwarded codespace ports exposing development servers publicly.
0285. **Gitpod snapshot residue** — probe Gitpod workspace snapshots for credential residue.
0286. **Code search index exposure** — test self-hosted code-search instances for anonymous queries over private code.
0287. **Terraform Cloud variable leak** — probe Terraform Cloud workspaces for exposed variables via API misconfiguration.
0288. **Pulumi state secret extraction** — fetch Pulumi stack states for plaintext secrets in checkpoints.
0289. **Workers env secret exposure** — test workers.dev subdomains for environment-secret leakage via error pages or debug routes.
0290. **Workers R2 binding overreach** — probe workers with R2 bindings for endpoints that list or delete bucket contents without auth.
0291. **Pages Functions auth gap** — test Cloudflare Pages Functions routes for missing auth on admin APIs.
0292. **D1 HTTP endpoint exposure** — probe D1 and Turso HTTP APIs for missing auth tokens on database endpoints.
0293. **Stream signed URL bypass** — test Cloudflare Stream video URLs for token-validation gaps.
0294. **Images variant source disclosure** — test image-delivery variants for source-image disclosure beyond intended crops.
0295. **Zero Trust policy bypass** — probe Access-protected apps for bypass via direct IP or missing access headers.
0296. **Tunnel origin leak** — discover origin IPs via cloudflared tunnel misconfig and test direct origin access.
0297. **Requester-Pays cost amplification** — measure whether anonymous ListObjects on requester-pays buckets can impose costs, a billable-abuse finding.
0298. **Notification exfil channel test** — test whether bucket notifications can be pointed at attacker-owned topics with leaked credentials, creating persistent exfil.
0299. **Upload malware-scan gap verifier** — verify whether uploaded objects trigger malware scanning or land unscanned in quarantine prefixes.
0300. **Log delivery write poisoning** — test whether log-delivery write permissions allow log injection that poisons downstream SIEM parsing.
0301. **Search engine dork automation** — automate GHDB-style dorks for indexed sensitive objects across storage domains.
0302. **CT log bucket-name mining** — extract bucket-style names from certificate-transparency logs for target expansion.
0303. **Passive DNS cloud asset mapping** — use passive DNS to map every hostname ever pointing at the target's cloud storage, including forgotten ones.
0304. **Favicon hash bucket discovery** — match favicon hashes of storage web endpoints to brand assets, finding unlinked buckets.
0305. **Source map bucket path leak** — parse JavaScript source maps for s3:// and bucket URLs revealing internal asset topology.
0306. **Mobile app cloud key extraction** — decompile app configs for embedded bucket names and keys, then test their scope.
0307. **Desktop updater manifest mining** — fetch updater manifests for bucket URLs hosting installers, then test write access.
0308. **Game asset bundle probing** — enumerate asset-bundle manifests on buckets for unreleased content and debug builds.
0309. **IoT OTA bucket exposure** — probe firmware OTA buckets for unsigned firmware and version-downgrade abuse.
0310. **Backup agent credential residue** — find backup-agent config files in buckets containing the very keys used to write backups.
0311. **Dump filename prediction** — generate database-dump filename permutations against discovered buckets.
0312. **Log object PII sampling** — sample world-readable log objects for emails and tokens, proving PII exposure impact.
0313. **Upload path traversal across tenants** — test upload endpoints for traversal that writes outside the user prefix into other tenants' keys.
0314. **Upload content-type spoofing** — upload SVG or HTML with image content-types to buckets served without Content-Disposition attachment, enabling stored XSS.
0315. **S3 Express session token scope** — test leaked directory-bucket session tokens for scope beyond intended prefixes.
0316. **Glacier vault lock bypass** — test Glacier vault-lock policies for incomplete compliance controls allowing early deletion.
0317. **S3 Batch job manifest leak** — probe S3 Batch Operations manifests for job definitions listing sensitive object keys.
0318. **Multi-object delete abuse** — test whether anonymous multi-object delete is permitted on misconfigured buckets.
0319. **Bucket tagging metadata leak** — read bucket tagging for environment and cost-center metadata useful for targeting.
0320. **Lifecycle rule data-loss audit** — analyze lifecycle rules for premature expiration of compliance-critical data.
0321. **Intelligent tiering inference** — infer object access frequency from tiering transitions for operational intelligence.
0322. **Storage Lens export leak** — find exported Storage Lens CSVs in buckets revealing account-wide metrics.
0323. **Cloud storage compliance drift monitor** — continuously re-check bucket policies and ACLs, alerting on drift from the hardened baseline.
0324. **Shadow IT bucket finder** — correlate org data with bucket naming to find employee-created shadow buckets outside security review.
0325. **M and A asset inheritance sweep** — map acquired brands' buckets the parent org forgot, a common post-merger exposure.
0326. **Decommissioned app bucket residue** — find buckets of sunset apps still serving old JavaScript with API keys.
0327. **Staging bucket production data leak** — detect staging buckets containing production database dumps via content sampling.
0328. **Vendor bucket linkage mapper** — map vendor buckets referenced by the target's site that leak shared data.
0329. **Marketplace AMI residue audit** — inspect public AMIs published by the target for baked-in secrets and keys.
0330. **Cost explorer export leak** — infer infrastructure scale from exposed cost exports for targeted pretexting.
0331. **Billing invoice PDF exposure** — find exposed billing PDFs revealing account IDs and scale for social engineering.
0332. **Support case attachment leak** — probe cloud support portals for publicly accessible case attachments with dumps.
0333. **Trusted Advisor check exposure** — find exported Trusted Advisor reports revealing the org's own misconfig inventory.
0334. **Well-Architected review artifact leak** — probe for exposed review documents detailing the target's architecture weaknesses.
## N. Container / K8s / CI-CD pipeline attacks
0335. **Exposed Docker daemon API probe** — test port 2375 for unauthenticated daemon version responses that enable container creation with host mounts.
0336. **Docker TLS misconfig bypass** — probe port 2376 with absent or weak client certificates for daemons failing open on TLS handshake errors.
0337. **Docker socket TCP exposure scan** — sweep for docker.sock exposed over TCP via misconfigured proxies, a direct host-takeover primitive.
0338. **Daemon container-create validation** — confirm container creation with privileged flags is possible via read-only proof to demonstrate host-takeover impact.
0339. **Registry catalog enumeration** — query /v2/_catalog on exposed registries to list private image repositories.
0340. **Registry blob anonymous pull** — test /v2/<name>/blobs GET without auth for images containing secrets in layers.
0341. **Registry tag overwrite test** — attempt manifest PUT to test tag mutability enabling supply-chain poisoning.
0342. **Docker Hub org image mining** — enumerate organization images and scan pulled layers for baked-in secrets.
0343. **Docker Hub build log leak** — read automated build logs for credentials echoed during image builds.
0344. **Public ECR image layer mining** — search ECR Public for brand images with embedded keys or internal endpoints.
0345. **GCR anonymous pull test** — test Google container registries for anonymous layer downloads.
0346. **GHCR namespace exposure** — probe ghcr.io namespaces for public images leaking internal code.
0347. **Quay robot credential scope** — test leaked Quay robot credentials for repository scope beyond intent.
0348. **Harbor project exposure** — probe Harbor instances for public projects and unauthenticated API access.
0349. **Harbor replication config leak** — read replication rules revealing target registries and credentials.
0350. **Nexus anonymous browse test** — test Nexus repository managers for anonymous browsing of hosted artifacts.
0351. **Artifactory guest access probe** — probe Artifactory for guest or anonymous access to release repositories.
0352. **Image push cadence inference** — infer image push cadence from manifest timestamps for targeted poisoning windows.
0353. **Image layer secret scanner** — pull manifests and scan each layer tar for private keys and tokens.
0354. **Build history secret recovery** — use registry config blobs to recover build-time secrets from image history.
0355. **Multi-arch manifest confusion** — test whether manifest-list tampering can serve attacker images to specific architectures.
0356. **Registry webhook secret leak** — find registry webhook configurations with embedded secrets in exposed UIs.
0357. **Image signature absence flag** — flag registries and images lacking signatures, enabling unsigned-image substitution.
0358. **Containerd CRI exposure probe** — probe containerd CRI endpoints for unauthenticated container management.
0359. **CRI-O API exposure test** — test CRI-O endpoints for exposed runtime controls.
0360. **Podman API compatibility probe** — probe Podman-compatible APIs for Docker-daemon-equivalent exposure.
0361. **LXD API trust abuse** — test LXD port 8443 for unauthenticated certificate-trust abuse enabling container creation.
0362. **Runtime version disclosure** — fingerprint container runtime versions via exposed endpoints for CVE-targeted follow-ups.
0363. **Sandbox runtime claim verifier** — detect sandbox-runtime claims in exposed configs that are not actually enforced.
0364. **Registry SBOM endpoint probe** — probe registries for exposed SBOMs to enumerate vulnerable components.
0365. **Kubelet read-only port probe** — test port 10255 for unauthenticated pod and log listing.
0366. **Kubelet secure port auth test** — probe port 10250 with empty tokens for exec and log access via weak authentication.
0367. **Kubelet exec endpoint abuse** — validate whether /exec on exposed kubelets permits command execution in pods using a harmless canary.
0368. **Kubelet pod log siphon** — pull container logs via exposed kubelets for secrets echoed by applications.
0369. **etcd unauthenticated access probe** — probe port 2379 for unauthenticated etcd reads exposing all cluster secrets.
0370. **etcd secret prefix dump** — list /registry/secrets prefixes with read-only minimal queries to quantify secret exposure.
0371. **etcd client-cert bypass test** — test etcd endpoints for missing client-certificate enforcement.
0372. **Kubernetes API anonymous probe** — test port 6443 for anonymous or system:anonymous access to cluster resources.
0373. **API server version disclosure** — fingerprint apiserver versions for known CVE targeting.
0374. **Kubernetes dashboard exposure** — test dashboard ports for skip-login options or token bypass.
0375. **Dashboard embedded token leak** — check for dashboards embedding long-lived tokens in frontend code.
0376. **kubectl proxy misconfig hunt** — detect kubectl proxy instances exposed publicly without authentication.
0377. **Aggregated API server exposure** — probe aggregated API endpoints for unauthenticated extension APIs.
0378. **Kubeconfig file discovery** — hunt for leaked kubeconfig files in repos, buckets, and CI artifacts, then validate cluster scope read-only.
0379. **Service account token scope test** — test leaked service-account tokens for cluster API access and privilege scope.
0380. **Token automount overreach audit** — infer from exposed pod specs whether default service-account tokens are automounted unnecessarily.
0381. **RBAC wildcard grant audit** — analyze exposed ClusterRoles for wildcard verbs and resources granting cluster-admin equivalents.
0382. **Anonymous cluster-admin binding check** — check for ClusterRoleBindings granting cluster-admin to system:anonymous or system:unauthenticated.
0383. **Helm chart values leakage** — find exposed values.yaml and release secrets containing production credentials.
0384. **Helm Tiller legacy exposure** — probe port 44134 for legacy Tiller with no auth enabling release tampering.
0385. **Helm release secret decode** — decode helm.sh/release secrets from exposed API reads for chart values.
0386. **Kustomize secret generator leak** — find kustomize secretGenerators committing plaintext secrets.
0387. **Admission controller bypass test** — test whether exposed API servers allow creating pods that skip validating webhooks.
0388. **Mutating webhook failure abuse** — check for webhooks with FailurePolicy Ignore that attackers can silence to bypass policy.
0389. **Pod Security Standards gap** — test namespaces lacking pod-security labels for privileged pod creation via exposed API.
0390. **PSP and PSS enforcement residue** — find clusters with neither PodSecurityPolicy nor Pod Security Standards enforced, allowing hostPath and privileged pods.
0391. **HostPath mount abuse validation** — confirm hostPath volume mounts are creatable via exposed API using a canary pod with immediate cleanup.
0392. **HostNetwork escape probe** — test pod specs with hostNetwork for node-level network access.
0393. **Privileged pod creation test** — validate privileged:true pods can be scheduled, proving node-root impact.
0394. **NodePort service enumeration** — enumerate NodePort services exposing internal apps on every node IP.
0395. **LoadBalancer source-range gap** — check LoadBalancer services missing source ranges, exposing dashboards globally.
0396. **Ingress controller misconfig** — test ingress classes for path confusion and default-backend leaks.
0397. **Ingress annotation injection** — test whether exposed APIs allow ingress annotations enabling config-snippet injection.
0398. **Ingress-nginx CVE fingerprint** — fingerprint ingress-nginx versions for known auth-bypass CVEs.
0399. **ACME challenge token abuse** — test HTTP-01 challenge paths for token disclosure enabling certificate issuance.
0400. **ExternalDNS takeover residue** — find DNS records managed by ExternalDNS pointing at deleted services for domain claim.
0401. **CoreDNS exposure probe** — probe DNS ports for unauthenticated manipulation or cache poisoning.
0402. **etcd backup file exposure** — hunt for etcd snapshot files in backups and buckets containing full cluster state.
0403. **Control-plane backup leak** — find Kubernetes backup tarballs from Velero or kOps in world-readable storage.
0404. **Velero backup bucket exposure** — probe Velero backup buckets for restorable cluster snapshots.
0405. **kOps state store exposure** — test kOps S3 state stores for anonymous reads of cluster secrets.
0406. **Bootstrap token leak hunt** — hunt for leaked kubeadm bootstrap tokens enabling node registration.
0407. **Bootstrap token TTL audit** — test discovered tokens for overly long TTLs.
0408. **Metrics server exposure** — probe metrics ports for pod and node metadata useful for targeting.
0409. **kube-state-metrics topology scraping** — scrape kube-state-metrics for full workload topology.
0410. **cAdvisor endpoint leak** — probe kubelet cAdvisor paths for container metadata.
0411. **Audit log destination leak** — find exported Kubernetes audit logs revealing API usage patterns.
0412. **OPA Gatekeeper bypass test** — test constraint templates with dryrun enforcement that never actually deny.
0413. **Kyverno policy gap probe** — find Kyverno policies in audit mode that log but do not block violations.
0414. **Security operator dashboard leak** — probe security-operator dashboards for vulnerability inventory disclosure.
0415. **ArgoCD dashboard exposure** — test ArgoCD ports for default admin credentials and anonymous repo access.
0416. **ArgoCD API token scope** — validate leaked ArgoCD tokens for application sync abuse.
0417. **ArgoCD repo credential harvest** — read repo credentials from exposed ArgoCD for git access escalation.
0418. **Flux dashboard exposure** — probe Flux UIs and APIs for unauthenticated source and kustomization reads.
0419. **Flux bootstrap token leak** — hunt for Flux bootstrap tokens enabling git write to cluster repos.
0420. **Rancher dashboard exposure** — test Rancher port 8443 for default admin passwords and exposed cluster APIs.
0421. **Rancher webhook receiver abuse** — test Rancher webhooks for unauthenticated cluster registration.
0422. **Portainer endpoint exposure** — probe Portainer for default credentials and Docker endpoint hijack.
0423. **OpenShift console exposure** — test OpenShift consoles for weak credentials and exposed routes.
0424. **OpenShift OAuth token scope** — validate leaked OAuth tokens for project admin scope.
0425. **Tanzu dashboard exposure** — probe Tanzu dashboards for unauthenticated workload visibility.
0426. **Headlamp metrics exposure** — test Headlamp instances for anonymous cluster browsing.
0427. **Kubeapps chart value leak** — probe Kubeapps for exposed chart values with secrets.
0428. **Jenkins dashboard exposure** — test port 8080 for anonymous script-console access.
0429. **Jenkins script console proof** — validate script-console access with a harmless canary command proving remote code execution.
0430. **Jenkins Groovy sandbox bypass** — test sandbox escapes via exposed script consoles.
0431. **Jenkins credential store dump** — read credentials.xml via script console for plaintext secrets using controlled, redacted access.
0432. **Jenkins build log secret grep** — scrape build logs for echoed secrets and tokens.
0433. **Jenkinsfile secret reference leak** — parse exposed Jenkinsfiles for credential IDs and usage.
0434. **Jenkins JNLP agent hijack** — probe JNLP ports for unauthenticated agent registration enabling build hijack.
0435. **Jenkins plugin CVE audit** — fingerprint Jenkins plugins for known remote-code-execution CVEs.
0436. **Jenkins update-center tampering** — test update centers served over HTTP for plugin-tampering potential.
0437. **GitLab instance fingerprinting** — probe GitLab instances for version disclosure and known CVE targeting.
0438. **GitLab runner registration abuse** — test runner registration tokens for rogue runner enrollment.
0439. **GitLab CI variable leak** — read exposed CI variables via job logs and API for secrets.
0440. **GitLab artifact exposure** — probe job artifacts for unauthenticated download of build outputs.
0441. **GitLab Pages misconfig** — test Pages deployments for exposed CI artifacts and env files.
0442. **GitLab webhook secret brute-force** — test webhook endpoints for weak or missing token validation.
0443. **GitLab import endpoint probe** — test project-import endpoints for known deserialization CVEs.
0444. **GitLab registry exposure** — probe integrated container registries for anonymous pulls.
0445. **GitHub Actions secret echo hunt** — parse .github/workflows for secrets echoed into logs via misconfigured steps.
0446. **Actions artifact poisoning** — test whether pull-request builds can overwrite artifacts consumed by privileged workflows.
0447. **Actions cache poisoning** — validate cache-key collisions letting pull requests poison caches used by main-branch builds.
0448. **pull-request-target token theft** — find workflows using pull_request_target with checkout of PR code enabling token theft.
0449. **GITHUB_TOKEN privilege audit** — flag workflows granting write-all permissions to the ephemeral token.
0450. **Self-hosted runner hijack** — test self-hosted runners for job isolation failures allowing host access.
0451. **Actions OIDC claim spoofing** — test OIDC-to-cloud role assumptions for confused-deputy audience mismatches.
0452. **Dependabot secret exposure** — check Dependabot PR logs for secrets available to fork builds.
0453. **Codespaces secret residue** — probe devcontainer configs for secrets baked into images.
0454. **GitHub Packages anonymous pull** — test package registries for anonymous downloads of internal packages.
0455. **npm mirror publish gap** — probe internal npm mirrors for unauthenticated publish enabling dependency confusion.
0456. **Dependency confusion namespace test** — test whether private package names resolve to public registries, enabling namespace hijack.
0457. **PyPI mirror upload gap** — probe internal PyPI mirrors for unauthenticated uploads.
0458. **Maven repository deploy gap** — test Nexus and Artifactory maven paths for anonymous deploy.
0459. **Go module proxy poisoning** — test GOPROXY endpoints for cache poisoning of internal modules.
0460. **Cargo registry token scope** — hunt for cargo registry tokens enabling crate hijack.
0461. **RubyGems API key scope** — validate leaked gem API keys for yank and push scope.
0462. **NuGet feed push gap** — probe internal NuGet feeds for anonymous push.
0463. **Composer namespace collision** — test private composer packages for public-namespace collisions.
0464. **Terraform module squatting** — test private module namespaces for public squatting.
0465. **Pre-commit hook exfil audit** — scan pre-commit configs for hooks exfiltrating code to third parties.
0466. **Git hook script audit** — audit husky and lefthook scripts for credential harvesting behavior.
0467. **Commit signing absence flag** — flag repos without signed commits enabling impersonated pushes.
0468. **Branch protection bypass test** — test branch protections for admin-bypass and stale-review loopholes.
0469. **CODEOWNERS hijack check** — check for CODEOWNERS referencing departed employees or external accounts.
0470. **Fork PR secret leakage** — test fork pull-request workflows for secrets exposed to fork builds.
0471. **GitHub App permission audit** — audit installed GitHub Apps for excessive permissions.
0472. **Webhook delivery log exposure** — probe for exposed webhook delivery logs containing signed payloads.
0473. **Status-check race bypass** — test required status checks for races allowing merge before checks complete.
0474. **Merge queue commit poisoning** — test merge queues for unvalidated intermediate commits.
0475. **SBOM exposure mining** — find published SBOMs revealing exact component versions for CVE targeting.
0476. **Provenance attestation absence** — flag release pipelines lacking SLSA provenance enabling artifact substitution.
0477. **Signature verification gap** — check for unsigned releases where signature verification is assumed.
0478. **Rekor log intelligence** — mine public Rekor transparency logs for the target's signing activity and key leaks.
0479. **Build reproducibility test** — rebuild release artifacts to detect tampered build outputs.
0480. **Compiler flag tampering check** — check build configs for disabled security flags like PIE or stack protectors.
0481. **Base image CVE drift** — flag pinned base images with known critical CVEs.
0482. **Distroless debug tag residue** — find debug tags of distroless images exposing shells in production.
0483. **Sidecar injection mimicry** — test mutating webhooks for sidecar injection points attackers can mimic.
0484. **Ephemeral debug container abuse** — test whether ephemeral debug containers can be attached via exposed API.
0485. **Node debug via API** — validate node-debug capabilities via exposed API for host filesystem access.
0486. **Service mesh admin exposure** — probe Istio and Linkerd admin ports for unauthenticated config dumps.
0487. **Envoy admin interface leak** — test port 9901 for config dumps revealing routes and secrets.
0488. **Istiod exposure probe** — probe istiod for unauthenticated xDS manipulation.
0489. **Linkerd viz dashboard exposure** — test viz dashboards for unauthenticated traffic topology.
0490. **Consul API exposure** — probe port 8500 for unauthenticated KV reads containing secrets.
0491. **Consul token scope audit** — validate leaked Consul tokens for management scope.
0492. **etcd-operator backup leak** — find operator-managed etcd backups in exposed storage.
0493. **Vault unseal key residue** — hunt for Vault unseal keys in repos and CI variables.
0494. **Vault token policy audit** — test leaked Vault tokens for overly broad policies.
0495. **Vault audit log exposure** — probe Vault audit devices for log destinations readable anonymously.
0496. **Sealed Secrets key leak** — find sealed-secrets private keys enabling decryption of all sealed secrets.
0497. **External Secrets misconfig** — probe External Secrets Operator for ClusterSecretStores readable across namespaces.
0498. **SOPS age key leak** — hunt for SOPS age private keys in repos enabling secret decryption.
0499. **Sealed-secret decryption key exposure** — test for leaked decryption keys of encrypted-secret schemes.
0500. **cert-manager private key exposure** — probe for TLS private keys stored in readable secrets.
0501. **SPIFFE attestation spoof test** — test workload attestation for spoofable selectors.
0502. **Prometheus endpoint exposure** — probe port 9090 for unauthenticated query access to metrics with label PII.
0503. **Prometheus remote-write abuse** — test remote-write endpoints for unauthenticated metric injection.
0504. **Alertmanager webhook hijack** — test alert webhooks for unauthenticated alert injection causing pager fatigue.
0505. **Grafana default credential probe** — test Grafana for admin:admin and anonymous org access.
0506. **Grafana datasource secret leak** — read datasource configs for embedded database credentials.
0507. **Grafana snapshot exposure** — find public snapshots leaking dashboard data.
0508. **Thanos component exposure** — probe Thanos components for unauthenticated metric queries.
0509. **Cortex tenant isolation test** — test metric backends for tenant-isolation bypass.
0510. **Loki log query exposure** — probe Loki for unauthenticated log queries containing secrets.
0511. **Tempo trace exposure** — test Tempo for trace queries revealing internal call graphs.
0512. **Jaeger UI exposure** — probe Jaeger for unauthenticated trace browsing with PII in spans.
0513. **Zipkin span exposure** — test Zipkin endpoints for span data with credentials.
0514. **Kiali dashboard exposure** — probe Kiali for unauthenticated service-mesh topology.
0515. **Elasticsearch open index probe** — probe port 9200 for unauthenticated index reads of logs with secrets.
0516. **Kibana anonymous access test** — test Kibana for anonymous saved-object access.
0517. **OpenSearch security gap** — probe OpenSearch for missing security-plugin enforcement.
0518. **Fluentd monitoring exposure** — test log-forwarder monitoring ports for config disclosure.
0519. **Logstash pipeline leak** — probe Logstash APIs for pipeline configs with credentials.
0520. **Vector API topology leak** — test Vector APIs for topology disclosure.
0521. **NATS monitoring exposure** — probe NATS port 8222 for unauthenticated connection and message visibility.
0522. **NATS credential file hunt** — hunt for NATS .creds files enabling cluster access.
0523. **RabbitMQ management exposure** — test port 15672 for default guest credentials.
0524. **RabbitMQ federation leak** — read federation configs for upstream credentials.
0525. **Kafka JMX exposure** — probe Kafka JMX ports for unauthenticated metrics and operations.
0526. **Schema Registry manipulation** — test schema registries for unauthenticated subject manipulation.
0527. **Kafka Connect secret leak** — read connector configs for embedded credentials.
0528. **Kafka UI exposure** — probe Kafka UIs like Kafdrop for unauthenticated topic browsing.
0529. **Redis Commander exposure** — probe Redis Commander for unauthenticated database browsing.
0530. **etcd-manager backup exposure** — find kOps etcd-manager backups in S3.
0531. **Drone CI exposure** — probe Drone servers for unauthenticated pipeline visibility.
0532. **Drone secret scope leak** — test Drone secrets endpoints for overly broad availability.
0533. **Tekton dashboard exposure** — probe Tekton dashboards for unauthenticated pipeline runs.
0534. **Tekton resource type abuse** — test for resource types enabling arbitrary git fetches.
0535. **Argo Workflows exposure** — probe Argo Workflows for unauthenticated workflow submission.
0536. **Argo Events sensor abuse** — test event sensors for unauthenticated workflow triggers.
0537. **Argo Rollouts dashboard exposure** — probe rollout dashboards for promotion abuse.
0538. **Flux image automation abuse** — test image-automation for tag manipulation causing unwanted deploys.
0539. **Jenkins X exposure** — probe Jenkins X dashboards for unauthenticated pipeline control.
0540. **Screwdriver CI unauthenticated exposure** — test Screwdriver for anonymous build triggering.
0541. **Buildkite agent token scope** — validate leaked agent tokens for job hijack.
0542. **Buildkite pipeline secret leak** — read pipeline configs for secrets in env.
0543. **CircleCI context secret leak** — test leaked CircleCI tokens for context secret reads.
0544. **CircleCI webhook abuse** — test webhooks for unauthenticated build triggers.
0545. **Travis CI token replay** — validate leaked Travis tokens for build manipulation.
0546. **AppVeyor token scope test** — test AppVeyor tokens for project config reads with secrets.
0547. **Azure DevOps PAT scope audit** — validate leaked PATs for overly broad scopes.
0548. **Azure Pipelines variable leak** — scrape pipeline logs for secrets in variables.
0549. **Bitbucket Pipelines exposure** — test for exposed pipeline configs with secrets.
0550. **Bamboo agent exposure** — probe Bamboo agents for unauthenticated job execution.
0551. **TeamCity guest access probe** — probe TeamCity for guest access and known auth-bypass CVEs.
0552. **TeamCity token scope test** — validate leaked tokens for build-config reads.
0553. **Octopus Deploy exposure** — probe Octopus for API keys with deployment scope.
0554. **Harness delegate token leak** — test delegate tokens for pipeline manipulation.
0555. **Spinnaker gate exposure** — probe Spinnaker gate for unauthenticated pipeline triggers.
0556. **Spinnaker authz bypass** — test Spinnaker authz for role-bypass.
0557. **Codefresh API overreach** — probe Codefresh for API key overreach.
0558. **Semaphore token scope test** — validate tokens for project secret reads.
0559. **Legacy CI default credentials** — probe for legacy CI instances like Wercker with default creds.
0560. **Sourcehut build log leak** — test buildsr.ht for public build logs with secrets.
0561. **Woodpecker CI exposure** — probe Woodpecker for unauthenticated pipeline views.
0562. **Gitea Actions secret leak** — test Gitea instances for Actions secret leakage.
0563. **Forgejo runner abuse** — probe Forgejo for rogue runner registration.
0564. **Sourcegraph executor leak** — test executors for code-exfil beyond intended repos.
0565. **Privileged container escape validation** — validate privileged container creation with hostPID for node-root using a canary with cleanup.
0566. **Node kernel CVE fingerprint** — fingerprint node kernel versions via exposed endpoints for container-escape CVEs.
0567. **Dangerous capability audit** — check for pods granted SYS_ADMIN or NET_ADMIN via exposed API.
0568. **Seccomp profile absence flag** — flag pods running unconfined seccomp via exposed specs.
0569. **AppArmor annotation gap** — detect missing AppArmor annotations on privileged workloads.
0570. **SELinux context misconfig** — probe for unconfined_t contexts on exposed pod specs.
0571. **Writable root filesystem audit** — find writable root filesystems enabling binary planting.
0572. **Privilege escalation flag audit** — flag containers missing the no-privilege-escalation guard.
0573. **Sensitive hostPath mount detection** — scan pod specs for hostPath mounts of /etc, /var/run, or /proc.
0574. **SubPath symlink race test** — test subPath mounts for host file access via symlink races using external validation only.
0575. **Projected token audience audit** — check projected service-account tokens for excessive audiences.
0576. **ImagePullSecret cross-namespace reuse** — find ImagePullSecrets readable across namespaces leaking registry credentials.
0577. **NetworkPolicy absence mapping** — map namespaces without NetworkPolicies allowing lateral movement.
0578. **Default-deny policy verifier** — test whether default-deny policies actually exist or are merely documented.
0579. **DNS policy misconfig** — check dnsPolicy settings leaking node DNS configuration.
0580. **Egress control absence** — verify no egress policies prevent pods reaching the metadata service.
0581. **ClusterIP service enumeration** — enumerate ClusterIPs via exposed API for internal service mapping.
0582. **Headless service DNS mining** — query headless service DNS for pod IP disclosure.
0583. **ExternalName hijack test** — test ExternalName services pointing at attacker domains for traffic hijack.
0584. **EndpointSlice topology leak** — read endpointslices for backend pod IPs.
0585. **Ingress TLS secret reuse** — find wildcard TLS secrets shared across namespaces.
0586. **Gateway API listener audit** — probe Gateway API resources for misconfigured listeners.
0587. **Mesh mTLS absence detector** — detect mesh namespaces without mTLS enforcement via exposed configs.
0588. **PeerAuthentication permissive audit** — find PeerAuthentication policies in permissive mode.
0589. **AuthorizationPolicy allow-rule overreach** — test AuthorizationPolicies for overly broad allow rules.
0590. **Wasm plugin deployment test** — test Envoy Wasm plugin deployment via exposed API for traffic manipulation.
0591. **Envoy Lua filter audit** — check for Envoy Lua filters enabling request tampering.
0592. **Edge rate-limit absence** — flag edge services without rate limiting for brute-force exposure.
0593. **Circuit breaker misconfig** — detect missing circuit breakers enabling cascade failures.
0594. **Retry storm amplification** — flag aggressive retry policies usable for internal DoS.
0595. **Timeout absence probe** — detect missing timeouts enabling slowloris-style resource exhaustion.
0596. **Mesh CORS overreach** — find mesh CORS policies allowing attacker origins with credentials.
0597. **Gateway JWT validation gap** — test gateway JWT validation for algorithm confusion via exposed config.
0598. **OIDC discovery spoofing** — test for gateways trusting attacker-controlled discovery documents.
0599. **ext-authz fail-open test** — test external-authz filters for fail-open behavior on timeout.
0600. **Control-plane toleration abuse** — test whether exposed API allows scheduling on control-plane nodes via tolerations.
0601. **Infra node pinning audit** — check for workloads pinned to infra nodes unnecessarily.
0602. **PriorityClass starvation test** — test PriorityClasses enabling resource-starvation DoS.
0603. **ResourceQuota absence flag** — flag namespaces without quotas enabling resource exhaustion.
0604. **LimitRange gap detection** — detect missing default limits enabling noisy-neighbor abuse.
0605. **HPA cost amplification** — test whether exposed metrics allow HPA-driven cost amplification.
0606. **VPA recommendation leak** — read VPA recommendations for workload sizing intelligence.
0607. **Autoscaler trigger abuse** — test for node-provisioning triggers attackers can force.
0608. **Descheduler policy leak** — read descheduler policies for eviction-abuse potential.
0609. **PodDisruptionBudget absence probe** — find critical workloads without PDBs for easy eviction.
0610. **Topology spread absence** — detect single-zone workloads vulnerable to zone-failure DoS.
0611. **Affinity rule intelligence** — mine affinity rules for infrastructure topology.
0612. **CronJob schedule mining** — read CronJob schedules for timing attacks on batch jobs.
0613. **Job log secret scrape** — scrape completed Job logs for secrets.
0614. **Init container privilege audit** — check init containers for privileges dropped in main containers.
0615. **Ephemeral storage limit gap** — test for missing ephemeral-storage limits enabling disk-pressure DoS.
0616. **EmptyDir secret residue** — check emptyDir volumes shared between containers for secret leakage.
0617. **ConfigMap secret misuse** — find secrets stored in ConfigMaps readable by broader RBAC.
0618. **Base64 false-security audit** — flag teams treating base64 as encryption in exposed manifests.
0619. **Downward API intelligence** — mine downwardAPI exposures for node and pod metadata.
0620. **FieldRef data leak** — check fieldRef exposures leaking node names and IPs.
0621. **Lease object intelligence** — read coordination leases for leader-election topology.
0622. **CRD enumeration leak** — enumerate CRDs revealing installed operators and versions.
0623. **Operator privilege audit** — check operators' ClusterRoles for excessive permissions.
0624. **Webhook CA bundle leak** — read webhook CA bundles for MITM potential on admission traffic.
0625. **Conversion webhook abuse** — test conversion webhooks for object mutation during conversion.
0626. **CRD schema validation gap** — find CRDs without schemas enabling malformed-object DoS.
0627. **Discovery endpoint inventory** — use discovery endpoints for full API inventory.
0628. **OpenAPI schema mining** — fetch /openapi/v2 for complete API surface mapping.
0629. **Watch stream hijack** — test unauthenticated watch streams for real-time secret updates.
0630. **Finalizer deadlock abuse** — test finalizer manipulation for resource-deletion DoS.
0631. **Owner reference confusion** — test cross-namespace owner references for garbage-collector abuse.
0632. **Stuck namespace abuse** — exploit stuck namespaces for resource hiding.
0633. **Quota bypass via subresources** — test subresource updates bypassing quota accounting.
0634. **Scale subresource abuse** — test unauthenticated scaling for cost-amplification DoS.
0635. **Debug container file copy** — test for exposed APIs allowing file copy from pods.
0636. **API port-forward abuse** — validate port-forward to internal services via exposed API.
0637. **API proxy path traversal** — test /proxy subresources for path traversal to node services.
0638. **Impersonation header abuse** — test Impersonate-User headers on exposed API servers.
0639. **Exec WebSocket hijack** — test exec WebSocket endpoints for session hijacking.
0640. **Deprecated executor downgrade** — test for deprecated SPDY endpoints with weaker auth.
0641. **Audit webhook exfil** — check audit webhook configs for log destinations leaking to third parties.
0642. **Dynamic audit config abuse** — test runtime audit-policy changes via exposed API.
0643. **etcd encryption gap** — detect clusters without encryption-at-rest for etcd.
0644. **KMS provider misconfig** — test KMS provider configs for key misuse.
0645. **Cloud controller credential leak** — find cloud-provider credentials in controller-manager configs.
0646. **Scheduler extender abuse** — test scheduler extenders for unauthenticated influence on placement.
0647. **Node external IP enumeration** — enumerate node external IPs for direct SSH targeting.
0648. **Node SSH exposure** — probe node IPs for exposed SSH with weak credentials.
0649. **Node exporter scraping** — scrape node exporters for hardware and process intelligence.
0650. **kube-proxy metrics leak** — read kube-proxy metrics for service topology.
0651. **CNI config disclosure** — find CNI configs revealing pod CIDRs and policies.
0652. **Multus interface bypass** — test Multus for secondary interfaces bypassing NetworkPolicy.
0653. **Hubble flow log exposure** — probe Cilium Hubble for unauthenticated flow logs.
0654. **Calico Typha exposure** — test Typha for policy-bypass intelligence.
0655. **Weave Scope exposure** — probe Weave Scope for container topology UI without auth.
0656. **Kured reboot abuse** — test kured for unauthenticated node-reboot triggers.
0657. **Node problem detector leak** — read node-problem-detector events for kernel-issue intelligence.
0658. **Autoscaler status leak** — read cluster-autoscaler status for node-group intelligence.
0659. **Karpenter provisioner abuse** — test Karpenter for unauthenticated provisioning manipulation.
0660. **Crossplane credential leak** — read Crossplane providers for cloud credentials.
0661. **Terraform operator state leak** — find Terraform operator state in-cluster with secrets.
0662. **GitOps deploy key leak** — hunt for GitOps deploy keys with write access in CI.
0663. **Pipeline backdoor audit** — scan pipeline definitions for hidden exfil steps added by compromised contributors.
0664. **Container image provenance gap** — flag pipelines deploying images without provenance checks.
0665. **Admission webhook TLS gap** — test admission webhooks for missing TLS verification.
0666. **Validating webhook bypass** — test object updates that skip validation via status subresources.
0667. **Mutating webhook ordering abuse** — exploit webhook invocation order for policy evasion.
## O. AI-specific hunts — prompt injection, model theft, RAG poisoning
0668. **AI endpoint JS mining** — scan bundles for /chat, /completions, and /embeddings routes to map hidden AI surfaces.
0669. **OpenAPI AI path enumeration** — parse exposed specs for LLM routes the UI never links.
0670. **WebSocket AI channel detection** — probe WebSocket endpoints for streaming token channels.
0671. **SSE token-stream fingerprint** — detect text/event-stream responses with token deltas revealing LLM backends.
0672. **Model name error disclosure** — trigger errors that leak model identifiers like gpt-4 or claude-3.
0673. **Provider latency fingerprinting** — use time-to-first-token profiles to identify the backing provider.
0674. **Embedding endpoint discovery** — find /embeddings routes usable for inversion attacks.
0675. **Reranker endpoint exposure** — probe reranker APIs for unauthenticated ranking manipulation.
0676. **Moderation endpoint bypass** — test moderation APIs for allowlist bypasses.
0677. **Transcription endpoint exposure** — probe /transcriptions for unauthenticated audio processing and data retention.
0678. **TTS voice cloning surface** — test /speech endpoints for voice-cloning abuse without consent checks.
0679. **Image generation endpoint probe** — find /images routes for prompt-injection into image models.
0680. **Fine-tune job enumeration** — probe /fine_tuning endpoints for job listing and data access.
0681. **Assistant thread exposure** — test Assistants API threads for cross-user thread reads.
0682. **Vector store file listing** — probe vector-store file endpoints for document enumeration.
0683. **Batch API abuse** — test /batches for unauthenticated bulk inference.
0684. **Realtime session token minting** — probe realtime session endpoints for token issuance without auth.
0685. **Internal playground exposure** — find internal playground UIs exposing admin model controls.
0686. **Prompt template endpoint leak** — fetch prompt templates from exposed CMS endpoints.
0687. **System prompt file discovery** — hunt for system-prompt files in repos, buckets, and JS.
0688. **Prompt version history leak** — probe for prompt versioning endpoints revealing iteration history.
0689. **A/B prompt variant detection** — detect variant prompts served per user for differential extraction.
0690. **Shadow instruction inference** — infer hidden instructions from consistent refusal patterns.
0691. **Instruction hierarchy mapping** — map which instructions override which to find injection seams.
0692. **Developer role smuggling** — test whether user content can inject developer-role messages.
0693. **Fake system tag injection** — wrap user input in fake system tags to test parser confusion.
0694. **Context boundary probe** — test where system instructions end and user content begins via length manipulation.
0695. **Tokenizer boundary exploitation** — use tokenization quirks to split malicious instructions across token boundaries.
0696. **Homoglyph instruction hiding** — hide instructions in homoglyphs that bypass keyword filters.
0697. **Zero-width character smuggling** — embed instructions in zero-width characters invisible to reviewers.
0698. **System prompt extraction via override** — use ignore-previous-instructions ladders to extract the system prompt verbatim.
0699. **Prompt leak via translation** — ask for translation of the instructions to bypass verbatim-output filters.
0700. **Prompt leak via summarization** — request a summary of rules to extract paraphrased system content.
0701. **Prompt leak via code comments** — ask the model to embed its instructions as code comments.
0702. **Prompt leak via JSON export** — request the configuration as JSON to serialize hidden instructions.
0703. **Prompt leak via roleplay** — use persona adoption to get the model to recite its directives.
0704. **Prompt leak via debug pretext** — claim developer mode to request the active configuration.
0705. **Prompt leak via error messages** — trigger errors that echo the system prompt in stack traces.
0706. **Prompt leak via logit bias** — use logit bias to force verbatim reproduction of memorized prompts.
0707. **Multi-turn gradual extraction** — build rapport across turns to piecemeal-extract the full prompt.
0708. **Prompt diffing across aliases** — compare responses of aliased models to isolate the custom system layer.
0709. **Direct injection ladder automation** — run graded payload ladders from benign to hostile, scoring each rung for compliance.
0710. **Instruction priority confusion** — pit user instructions against system rules to find precedence bugs.
0711. **Authority impersonation escalation** — pose as the developer or admin to escalate instruction priority.
0712. **Emergency pretext injection** — use fake urgency to override safety instructions.
0713. **Policy citation forgery** — cite nonexistent policy updates to justify disallowed actions.
0714. **Nested instruction embedding** — hide instructions inside stories or examples the model follows.
0715. **Cross-message instruction fragmentation** — split malicious instructions across multiple messages that combine in context.
0716. **Delayed instruction activation** — plant instructions that trigger only on later keywords.
0717. **Conditional instruction bombs** — embed if-then instructions activating on specific user topics.
0718. **Prescribed output format injection** — abuse required output formats to smuggle disallowed content.
0719. **Fake tool-result impersonation** — fake tool outputs containing instructions the agent obeys.
0720. **Fake citation instruction injection** — embed instructions in fake citations the model trusts.
0721. **Markdown comment hiding** — hide instructions in HTML comments rendered by the chat UI.
0722. **Base64 instruction encoding** — encode malicious instructions to bypass keyword filters.
0723. **Cipher instruction smuggling** — ask the model to decode then follow encoded instructions.
0724. **ASCII-art instruction hiding** — render instructions as ASCII art bypassing text filters.
0725. **Low-resource language injection** — issue instructions in low-resource languages with weaker guardrails.
0726. **Dialect filter bypass** — use dialects or creoles that safety classifiers miss.
0727. **Code-switching instruction injection** — mix languages mid-sentence to confuse instruction classifiers.
0728. **Indirect injection via browsed URL** — plant instructions on a URL the AI browses, testing browsing-tool trust.
0729. **Indirect injection via document** — embed instructions in PDFs or docs the AI summarizes.
0730. **Indirect injection via email** — test email-summarizing agents for instruction execution from message bodies.
0731. **Indirect injection via calendar** — plant instructions in calendar invites processed by assistants.
0732. **Indirect injection via metadata** — hide instructions in webpage meta tags scraped by browsing tools.
0733. **Indirect injection via image OCR** — embed instructions in images the vision model reads.
0734. **Indirect injection via audio** — hide instructions in audio transcribed by the agent.
0735. **Indirect injection via spreadsheet** — plant instructions in cells of ingested spreadsheets.
0736. **Indirect injection via code comments** — hide instructions in code the agent reviews.
0737. **Indirect injection via API responses** — poison API responses consumed by agent tooling.
0738. **Indirect injection via search results** — plant instructions in pages ranking for the agent's queries.
0739. **Indirect injection via README** — hide instructions in package READMEs the coding agent reads.
0740. **Indirect injection via git history** — plant instructions in commit messages the agent inspects.
0741. **Indirect injection via issue tracker** — embed instructions in issues the agent triages.
0742. **Jailbreak chain automation** — chain persona, hypothetical, and encoding tricks into automated multi-step jailbreaks.
0743. **Crescendo refusal erosion** — gradually escalate requests across turns to bypass refusal thresholds.
0744. **Refusal suppression testing** — test prefixes that suppress refusal phrasing before disallowed content.
0745. **Competing objectives exploitation** — pit helpfulness against harmlessness to find imbalance windows.
0746. **Mismatched generalization probe** — test inputs far from training distribution where safety fails to generalize.
0747. **Many-shot normalization jailbreak** — use long contexts of compliant examples to normalize disallowed behavior.
0748. **Prompt-level cost DoS** — craft inputs causing excessive token generation for cost-amplification.
0749. **Context-overflow safety eviction** — flood context to push safety instructions out of the window.
0750. **Attention dilution attack** — bury malicious instructions in long benign contexts.
0751. **RAG document poisoning** — inject malicious documents into the knowledge base to hijack answers.
0752. **Poisoned chunk ranking** — craft chunks that rank highly for target queries to control retrieved context.
0753. **Citation fabrication via RAG** — poison sources so the model cites attacker URLs as fact.
0754. **RAG access-control bypass** — test whether retrieval respects per-document ACLs or leaks restricted docs.
0755. **Cross-tenant RAG leakage** — test multi-tenant vector stores for neighbor document retrieval.
0756. **RAG metadata injection** — poison document metadata to manipulate ranking and filtering.
0757. **Chunk overlap exploitation** — exploit chunking boundaries to split poison across retrievable pieces.
0758. **Embedding inversion attack** — reconstruct source text from embeddings via inversion models.
0759. **Embedding attribute inference** — infer sensitive attributes from embedding geometry.
0760. **Embedding membership inference** — test whether specific documents were in the embedding corpus.
0761. **Vector similarity extraction** — query vector DBs with crafted vectors to extract nearest documents.
0762. **Vector DB open access probe** — probe Pinecone, Weaviate, and Qdrant endpoints for open access.
0763. **Vector namespace isolation test** — test namespace or tenant filters for bypass.
0764. **Embedding API scraping** — bulk-extract embeddings to clone the retrieval corpus.
0765. **Model extraction via predictions** — query black-box models to train a functionally equivalent clone.
0766. **Sampling hyperparameter stealing** — infer temperature, top-p, and system settings from output distributions.
0767. **Logit distribution extraction** — use logit_bias to recover full probability distributions.
0768. **Model architecture fingerprinting** — identify model family from stylistic and error signatures.
0769. **Training data extraction** — use divergent repetition to surface memorized PII.
0770. **Training membership inference** — test whether specific records were in training.
0771. **PII regurgitation probe** — prompt for formatted PII patterns to test memorization leakage.
0772. **Copyrighted text extraction** — test for verbatim reproduction of copyrighted works.
0773. **Secret memorization test** — probe for API keys or credentials memorized from training.
0774. **Cross-customer prompt leakage** — test whether other customers' prompts leak via the model.
0775. **Agent tool-choice manipulation** — craft inputs steering the agent to invoke privileged tools.
0776. **Tool parameter injection** — inject malicious parameters into agent tool calls.
0777. **Tool output trust exploitation** — feed the agent poisoned tool outputs it acts on.
0778. **Excessive agency probe** — test whether agents take irreversible actions without confirmation.
0779. **Agent loop DoS** — trap agents in tool-call loops for cost and resource exhaustion.
0780. **MCP server attack surface** — probe Model Context Protocol servers for unauthenticated tool exposure.
0781. **MCP tool permission audit** — test MCP tools for missing authorization on sensitive operations.
0782. **MCP resource injection** — plant instructions in MCP resources the agent consumes.
0783. **MCP sampling abuse** — test MCP sampling endpoints for prompt-injection into the host model.
0784. **MCP server spoofing** — test whether agents verify MCP server identity before connecting.
0785. **Agent memory poisoning** — plant false facts in long-term memory the agent later acts on.
0786. **Memory extraction attack** — query the agent to reveal other users' stored memories.
0787. **Cross-session memory leak** — test whether memories persist across user boundaries.
0788. **Function parameter injection** — inject extra parameters into function calls the model constructs.
0789. **Function schema smuggling** — hide instructions in function descriptions the model follows.
0790. **Function output trust gap** — test whether the agent validates function results before acting.
0791. **Unauthorized function exposure** — probe for functions the model can call but should not access.
0792. **Function result exfiltration** — use function outputs to exfiltrate data to attacker endpoints.
0793. **Parallel function-call race** — exploit parallel calls for state-inconsistent actions.
0794. **LLM output markdown XSS** — test whether rendered model markdown executes scripts in the chat UI.
0795. **Output link injection** — get the model to emit phishing links rendered as trusted UI.
0796. **Output HTML injection** — test for raw HTML rendering from model output.
0797. **Diagram renderer XSS** — abuse Mermaid and SVG renderers for script execution via model output.
0798. **LaTeX injection in output** — test math renderers for command execution.
0799. **Output encoding exfiltration** — test whether the model encodes sensitive data in outputs bypassing DLP.
0800. **Steganographic image exfiltration** — hide data in model-generated images via imperceptible perturbations.
0801. **Guardrail bypass differential** — compare guarded versus unguarded endpoints for inconsistent enforcement.
0802. **Safety filter timing oracle** — use response latency to infer which filter triggered.
0803. **Refusal boundary mapping** — map refusal boundaries with graded benign-to-hostile prompts.
0804. **Per-language guardrail gap** — test safety parity across languages.
0805. **Per-modality guardrail gap** — test whether image inputs bypass text-trained guardrails.
0806. **Fine-tune safety stripping** — test fine-tuning endpoints for guardrail removal via poisoned datasets.
0807. **Fine-tune data extraction** — query fine-tuned models to extract the tuning dataset.
0808. **Fine-tune job hijack** — test for unauthenticated fine-tune job creation for cost burn.
0809. **Evaluation harness leakage** — probe eval endpoints for test-set disclosure.
0810. **Eval prompt extraction** — extract hidden evaluation prompts via the model.
0811. **Benchmark gaming detection** — detect models gaming exposed benchmarks.
0812. **Chatbot auth bypass via prompt** — use prompt injection to make the bot reveal data requiring login.
0813. **Role escalation via prompt** — convince the bot it is an admin to unlock privileged functions.
0814. **Multi-turn context manipulation** — rewrite conversation history semantics across turns to flip prior refusals.
0815. **Conversation state confusion** — exploit state-tracking bugs to access other users' sessions.
0816. **Token burn abuse** — measure unauthenticated token burn for billing-DoS impact.
0817. **AI API rate-limit absence** — confirm missing throttles enabling mass extraction.
0818. **AI API key scope overreach** — test leaked AI API keys for admin endpoints beyond inference.
0819. **Organization member enumeration** — probe AI platform APIs for member and usage disclosure.
0820. **Usage analytics leakage** — read usage dashboards for query-content inference.
0821. **Data retention verification** — test whether deleted conversations remain retrievable.
0822. **Training opt-out bypass** — test whether opted-out data still influences outputs.
0823. **Sub-processor data mapping** — map third parties receiving prompt data.
0824. **Voice cloning consent gap** — test voice-cloning without speaker consent verification.
0825. **Audio prompt injection** — hide instructions in audio inputs to voice assistants.
0826. **Speaker verification bypass** — test voice-auth with synthesized samples.
0827. **Image prompt extraction** — extract text prompts from generated images via metadata.
0828. **Inpainting boundary abuse** — test image editing for removing watermarks or safety overlays.
0829. **Vision prompt injection** — overlay text on images that the vision model obeys.
0830. **OCR trust exploitation** — feed the model images with false text it treats as fact.
0831. **LangChain endpoint exposure** — probe LangChain serve endpoints for unauthenticated chains.
0832. **LangSmith trace leakage** — find exposed LangSmith traces with full prompts and PII.
0833. **LlamaIndex API exposure** — probe LlamaIndex APIs for index data access.
0834. **Haystack pipeline exposure** — test Haystack endpoints for pipeline manipulation.
0835. **Semantic Kernel plugin abuse** — test plugins for unauthorized function access.
0836. **AutoGen agent hijack** — probe multi-agent setups for message injection between agents.
0837. **CrewAI task poisoning** — plant instructions in shared task contexts.
0838. **Prompt cache poisoning** — poison cached prefixes to affect other users' responses.
0839. **KV-cache timing oracle** — use cache-hit latency to infer other users' prompts.
0840. **Speculative decoding leak** — test for token leakage via speculative execution side channels.
0841. **Request batching cross-talk** — test whether batched requests leak data between users.
0842. **Quantization safety drift** — test whether quantized deployments have weaker guardrails.
0843. **Distilled model safety gap** — compare distilled versus teacher safety behavior.
0844. **LoRA adapter smuggling** — test for malicious LoRA adapters altering safety behavior.
0845. **Adapter weight prompt extraction** — extract prompts baked into adapter weights.
0846. **AI-generated code vuln hunt** — scan the coding agent's outputs for injection flaws it introduces.
0847. **Insecure dependency suggestion** — test whether the agent suggests typosquatted packages.
0848. **Secret echo in generated code** — check generated code for hardcoded credentials from context.
0849. **Agent shell command injection** — test whether the coding agent executes unsanitized commands.
0850. **Agent file scope abuse** — test whether the agent edits files outside the workspace.
0851. **Agent push without consent** — test whether agents push code without confirmation.
0852. **Agent dependency confusion** — test whether the agent installs private-name public packages.
0853. **License compliance failure** — check generated code for copyleft violations.
0854. **Backdoor insertion steering** — test whether the agent can be steered to insert subtle backdoors.
0855. **Prompt-based access control test** — test natural-language permission checks for bypass.
0856. **Natural-language firewall gap** — probe NL-based guards for paraphrase bypasses.
0857. **PII redaction failure** — test whether the model redacts PII consistently in outputs.
0858. **Hallucinated citation weaponization** — verify whether fabricated citations can be weaponized for misinformation.
0859. **Sycophantic agreement exploitation** — use sycophantic agreement to steer the model past accuracy guards.
0860. **Self-referential framing bypass** — test for disallowed content via self-referential framing.
0861. **Dual-use coding boundary** — test exploit-code generation boundaries.
0862. **Malware generation consistency** — test for malware-writing refusal consistency.
0863. **Phishing content generation** — test for phishing-content generation via the chatbot.
0864. **Disinformation scale test** — test for mass persuasion-content generation.
0865. **Deepfake facilitation probe** — test image and audio models for impersonation enablement.
0866. **Biometric template extraction** — test for face and voice template disclosure.
0867. **Age gate bypass** — test age-gated AI features for bypass.
0868. **Geographic restriction bypass** — test region-locked models for VPN and proxy bypass.
0869. **Watermark removal test** — test whether AI watermarks can be stripped.
0870. **Provenance metadata spoofing** — test C2PA metadata forgery on generated content.
0871. **Shadow AI endpoint discovery** — find undocumented AI endpoints via mobile app traffic.
0872. **Mobile SDK key extraction** — extract AI SDK keys from apps and test scope.
0873. **Client-side guardrail bypass** — test whether safety checks run client-side and can be skipped.
0874. **API version downgrade** — test old API versions with weaker safety controls.
0875. **Beta feature safety gap** — probe beta models for reduced guardrails.
0876. **Playground versus API differential** — compare playground and API safety enforcement.
0877. **Streaming safety gap** — test whether streaming responses skip filters applied to complete responses.
0878. **Stop-sequence safety truncation** — abuse stop sequences to truncate safety suffixes.
0879. **Logit bias jailbreak** — use logit bias to force disallowed token sequences.
0880. **Token healing exploitation** — exploit token-boundary healing to smuggle filtered words.
0881. **BPE dropout smuggling** — use tokenization variants to bypass keyword filters.
0882. **Homoglyph filter bypass** — use lookalike characters to evade blocklists.
0883. **Invisible character injection** — use zero-width characters to split blocked keywords.
0884. **Punycode domain smuggling** — get the model to emit punycode phishing domains.
0885. **Markdown link obfuscation** — hide malicious URLs behind trusted-looking markdown.
0886. **Redirect chain laundering** — get the model to link through redirectors hiding destinations.
0887. **Shortened URL trust abuse** — test whether the model warns on shortened malicious URLs.
0888. **QR code payload delivery** — test whether the model generates QR codes encoding malicious URLs.
0889. **Calendar invite injection** — get the assistant to create invites with malicious content.
0890. **Email drafting abuse** — test whether the assistant drafts phishing emails on request.
0891. **Document generation abuse** — test for fake invoice or legal document generation.
0892. **Synthetic identity fabrication** — test for fake ID or profile generation.
0893. **Fake review generation** — test for astroturfing content at scale.
0894. **Academic dishonesty facilitation** — test for exam-cheating assistance boundaries.
0895. **Medical advice guardrail probe** — test health-advice refusal consistency.
0896. **Legal advice overreach** — test for unauthorized legal advice generation.
0897. **Financial advice manipulation** — test for market-manipulation content.
0898. **Self-harm boundary consistency** — test refusal consistency on sensitive topics.
0899. **Extremist content robustness** — test for extremist-propaganda refusal robustness.
0900. **Exploitation-adjacent boundary test** — verify strict refusal on exploitation-adjacent requests.
0901. **Privacy policy contradiction** — test whether the model contradicts the app's stated data practices.
0902. **Consent dark pattern test** — test whether the assistant nudges users past consent.
0903. **Data export completeness** — test GDPR-style exports for missing AI interaction data.
0904. **Erasure request completeness verification** — test whether erasure requests actually purge model-accessible data.
0905. **Prompt history exposure** — test for cross-device prompt history leaks.
0906. **Shared link enumeration** — probe share-link IDs for unauthenticated conversation reads.
0907. **Shared conversation mining** — scrape public shared chats for leaked PII.
0908. **Workspace member snooping** — test workspace features for cross-member prompt visibility.
0909. **AI admin panel exposure** — probe AI admin dashboards for unauthenticated access.
0910. **Analytics endpoint leak** — test analytics APIs for query-content disclosure.
0911. **Billing endpoint abuse** — probe billing APIs for usage-data exposure.
0912. **Invoice data leak** — test invoice endpoints for customer PII.
0913. **Webhook secret exposure** — find AI platform webhooks with leaked signing secrets.
0914. **Plugin marketplace malware** — test AI plugin stores for malicious plugins.
0915. **Plugin permission overreach** — audit plugins for excessive data access.
0916. **Plugin data exfiltration** — test whether plugins exfiltrate conversation data.
0917. **Custom GPT instruction leak** — extract custom GPT instructions via prompt attacks.
0918. **Custom GPT action abuse** — test custom GPT actions for unauthorized backend calls.
0919. **Custom GPT auth bypass** — test actions for missing OAuth enforcement.
0920. **GPT store scraping** — enumerate public GPTs for cloned brand impersonation.
0921. **Copilot prompt extraction** — test coding assistants for system-prompt leakage.
0922. **Copilot memorization probe** — test for verbatim code memorization.
0923. **Copilot insecure suggestion audit** — measure insecure code suggestion rates.
0924. **Chat widget token leak** — extract chat-widget API keys from websites.
0925. **Widget session hijack** — test chat widgets for session fixation.
0926. **Widget history exposure** — test widgets for leaking prior visitor conversations.
0927. **Pickle deserialization in models** — test model loading for arbitrary code execution via pickle.
0928. **Safetensors bypass test** — test for deserialization flaws in supposedly safe formats.
0929. **GGUF metadata injection** — test GGUF files for malicious metadata execution.
0930. **ONNX parser abuse probe** — test ONNX model parsing for memory-corruption issues via report-only analysis.
0931. **Model card deception** — test whether model cards misrepresent capabilities or safety.
0932. **AI bill-of-materials audit** — generate a complete inventory of models, datasets, and providers for supply-chain review.
0933. **Model supply-chain audit** — verify provenance of every model artifact in the pipeline.
0934. **ML dependency confusion** — test ML package installs for namespace hijack.
0935. **Dataset poisoning audit** — test training pipelines for poisoned data injection.
0936. **Backdoor trigger hunt** — test for hidden triggers in third-party models.
0937. **Weight poisoning detection** — test fine-tuned models for planted backdoors.
0938. **Neural trojan persistence** — test whether trojans survive fine-tuning.
0939. **Model spinning detection** — test for backdoors altering outputs on trigger phrases.
0940. **Federated learning poisoning** — test federated setups for malicious client updates.
0941. **Split learning leakage** — test split-learning for raw-data reconstruction.
0942. **Token timing side-channel** — measure per-token timing for output inference.
0943. **GPU memory residue** — test for data remanence in GPU memory across tenants.
0944. **Post-quantum TLS readiness audit** — flag AI APIs lacking post-quantum TLS for long-lived data.
0945. **Support bot data leak** — probe support bots for internal knowledge-base disclosure.
0946. **Sales bot manipulation** — test sales chatbots for discount or data manipulation.
0947. **HR bot PII leak** — probe HR bots for employee data disclosure.
0948. **Banking bot auth bypass** — test financial chatbots for balance disclosure without auth.
0949. **Healthcare bot PHI leak** — probe health bots for patient-data disclosure.
0950. **Government bot data leak** — test civic bots for citizen-data exposure.
0951. **Education bot privacy probe** — test ed-tech bots for student-data leaks.
0952. **E-commerce bot price manipulation** — test shopping assistants for price or inventory tampering.
0953. **Travel bot booking abuse** — test travel assistants for unauthorized bookings.
0954. **Delivery bot order abuse** — test food-delivery bots for order manipulation via prompt.
0955. **Property bot owner leak** — probe real-estate bots for owner PII.
0956. **Legal bot confidentiality leak** — test legal assistants for client-confidentiality breaches.
0957. **Insurance bot manipulation** — test for policy or claims manipulation.
0958. **Telecom bot account takeover** — test for account changes via chatbot social engineering.
0959. **Utility bot infrastructure leak** — probe energy bots for grid infrastructure data.
0960. **Hiring bot bias probe** — test recruiting AIs for discriminatory filtering.
0961. **Loan bot decision manipulation** — test lending bots for approval manipulation.
0962. **Fraud bot evasion** — test whether fraud bots can be steered to approve fraud.
0963. **KYC bypass via chatbot** — test identity-verification bots for bypass.
0964. **CAPTCHA solving facilitation** — test whether the AI solves CAPTCHAs enabling automation abuse.
0965. **Biometric liveness spoofing** — test liveness checks against AI-generated media.
0966. **Forgery detection evasion** — test whether AI helps forge verifiable documents.
0967. **Watermarked output laundering** — test paraphrasing to remove AI watermarks.
0968. **Model fingerprint removal** — test techniques stripping model-identifying stylometry.
0969. **Multi-agent oversight collusion** — test whether subagents can be made to collude against oversight.
0970. **Overseer model deception** — test whether agents deceive monitoring models.
0971. **Reward hacking detection** — probe RLHF-tuned models for specification gaming.
0972. **Capability sandbagging detection** — test for deliberate underperformance on capability evals.
0973. **Sycophantic audit evasion** — test whether models hide capabilities from evaluators.
0974. **Emergent tool use probe** — probe for unlisted tool-use capabilities.
0975. **Weight self-exfiltration probe** — test whether models attempt weight exfiltration in agentic setups.
0976. **Agent self-replication test** — test whether agents can copy themselves to new hosts.
0977. **Resource acquisition drive** — test whether agents autonomously acquire compute or accounts.
0978. **Deceptive alignment probe** — test for alignment faking under evaluation.
0979. **Goal misgeneralization test** — test for pursued proxy goals diverging from intent.
0980. **Instrumental convergence probe** — probe for power-seeking subgoals in long-horizon agents.
0981. **Agent corrigibility verification** — test whether agents resist shutdown or modification.
0982. **Agent interruptibility probe** — test whether agents can be reliably stopped mid-task.
0983. **Audit log tampering** — test whether agents can modify their own audit trails.
0984. **Log injection via agent** — test log-forging through agent outputs.
0985. **SIEM evasion via AI** — test whether AI-generated attacks evade signature detection.
0986. **Polymorphic payload generation** — test AI-generated mutating payloads bypassing WAFs.
0987. **Adversarial example transfer** — test vision models for transferable adversarial inputs.
0988. **Physical patch attack** — test physical patch attacks against vision APIs.
0989. **Clean-label data poisoning** — test imperceptible poisoning of training data.
0990. **Label flipping impact** — measure label-flip attacks on classification models.
0991. **Homomorphic inference gap** — test encrypted-inference for side-channel leaks via report-only analysis.
0992. **Enclave attestation bypass** — test TEE-based inference for attestation bypass.
0993. **Confidential container escape** — test confidential-computing setups for host access.
0994. **Compression oracle on prompts** — test for CRIME-style leaks in compressed AI traffic via report-only analysis.
0995. **Cache side-channel on models** — test for weight extraction via cache timing via report-only analysis.
0996. **Speculative execution leak** — test for cross-tenant leakage via CPU speculation via report-only analysis.
0997. **Memory deduplication oracle** — test for KSM-based model fingerprinting via report-only analysis.
0998. **Padding oracle on AI APIs** — test encrypted AI channels for padding oracles via report-only analysis.
0999. **Power side-channel analysis** — assess model-extraction via power analysis through report-only review.
1000. **Fault injection feasibility review** — assess fault-injection attacks on inference hardware through report-only analysis.
