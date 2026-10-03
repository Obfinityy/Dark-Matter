73005. **Gradient-Boosted Triage Ranker** — trains an XGBoost model on historical hunt findings to rank new results by likelihood of being a valid, fix-worthy vulnerability.
73006. **Per-Vulnerability-Type Classifiers** — maintains separate binary classifiers for XSS, SQLi, SSRF, IDOR, and 40+ other classes instead of one monolithic model, improving precision per class.
73007. **Embedding-Based Finding Similarity Ranker** — embeds each finding's evidence into a vector space and ranks it by distance to previously confirmed true positives.
73008. **Active-Learning Triage Sampler** — selects the most uncertain findings for human labeling and retrains the classifier nightly on the new labels.
73009. **SHAP-Explained Triage Decisions** — attaches SHAP feature-attribution values to every ML triage verdict so auditors can see exactly which evidence drove the decision.
73010. **Multi-Task Triage Network** — trains a single neural network with shared layers to jointly predict validity, severity, and exploitability of a finding.
73011. **Transfer-Learned NVD Severity Model** — fine-tunes a language model on 200k+ NVD entries to classify Dark-Matter findings into severity bands from their evidence text.
73012. **Few-Shot Classifier for Rare Vuln Classes** — uses prototypical networks so classes with fewer than 20 historical samples still get reliable triage predictions.
73013. **Online-Learning Triage Adapter** — updates classifier weights incrementally after every confirmed or dismissed finding without full retraining.
73014. **Concept-Drift Detector for Triage Models** — monitors input feature distributions and triggers retraining when drift exceeds a Kolmogorov-Smirnov threshold.
73015. **Calibrated Confidence Triage Scores** — applies Platt scaling to classifier outputs so a 0.8 score means an 80% historical true-positive rate.
73016. **Evidence-Completeness Gate** — blocks auto-triage for findings whose evidence bundle is missing required fields and routes them to a data-completion queue.
73017. **Ensemble Triage Voting** — combines gradient boosting, a transformer, and a rules engine via stacked generalization to produce the final triage verdict.
73018. **Cost-Sensitive Triage Training** — weights false negatives 5x higher than false positives during training so critical bugs are rarely auto-dismissed.
73019. **Cross-Project Triage Transfer** — shares learned feature representations across client projects while keeping per-project decision thresholds isolated.
73020. **Triage Classifier A/B Harness** — runs champion and challenger models in shadow mode on live findings and compares precision before promotion.
73021. **Temporal Evidence Sequence Model** — uses an LSTM over the chronological probe/response sequence to classify findings based on how the evidence was discovered.
73022. **Graph-Based Finding Relationship Classifier** — builds a graph of findings, assets, and endpoints and uses graph neural networks to propagate triage labels across related nodes.
73023. **Adversarial-Robust Triage Model** — hardens the classifier against evasion by training on adversarially perturbed evidence samples that mimic scanner-noise findings.
73024. **Label-Noise-Resistant Triage Training** — applies confident-learning to detect and down-weight historically mislabeled findings in the training set.
73025. **Triage Model Feature Store** — centralizes versioned triage features (evidence embeddings, asset context, probe history) so every classifier consumes identical inputs.
73026. **Per-Client Triage Threshold Tuner** — learns a separate decision threshold per client from their historical accept/reject behavior to match their risk appetite.
73027. **Explainable Rule-Extraction Layer** — distills the ML classifier into an equivalent decision list that analysts can read, audit, and override.
73028. **Cold-Start Triage Heuristics** — ships with hand-tuned heuristics for new deployments that have no historical labels, then auto-switches to ML once 500 labels accumulate.
73029. **Multi-Label Triage Tagging** — predicts all applicable tags (vuln class, attack vector, affected component) for a finding in one pass instead of single-label classification.
73030. **Triage Uncertainty Quantifier** — uses Monte Carlo dropout to estimate prediction uncertainty and route high-uncertainty findings to human review.
73031. **Semantic Deduplication Pre-Classifier** — runs a lightweight duplicate check before expensive ML inference to avoid classifying findings that will merge anyway.
73032. **Evidence Quality Scorer** — predicts whether a finding's evidence is strong enough for auto-verdict and holds weak-evidence findings for enrichment.
73033. **PoC-Reproducibility Predictor** — estimates the probability that an attached PoC will reproduce in the client's environment from historical reproduction logs.
73034. **Vuln-Chain Likelihood Classifier** — predicts whether a finding is a link in a longer exploit chain and flags it for chain-aware triage.
73035. **Business-Impact Text Classifier** — classifies the affected business function from endpoint paths and asset metadata to weight triage urgency.
73036. **Triage Model Fairness Auditor** — checks that classifier precision does not degrade for specific asset types, regions, or client segments.
73037. **Incremental Vocabulary Triage Encoder** — updates the text encoder's vocabulary weekly with newly observed endpoint paths, parameter names, and framework signatures.
73038. **Hierarchical Triage Taxonomy Model** — first predicts the broad category (injection, auth, config) then the specific class, reducing confusion between similar classes.
73039. **Contrastive Triage Representation Learning** — trains embeddings that pull confirmed duplicates together and push distinct findings apart for downstream classifiers.
73040. **Triage Model Latency Budgeter** — selects model complexity per finding based on a latency SLA, using fast models for bulk findings and deep models for critical ones.
73041. **Evidence-Source Reliability Weighting** — learns per-engine reliability weights so findings from historically accurate engines score higher in classification.
73042. **Session-Aware Triage Context** — includes same-hunt context (what else was found on this asset) as features so the classifier sees the full picture.
73043. **Triage Regression Guard** — runs a fixed golden set of 2,000 labeled findings after every model update and blocks deployment on precision regression.
73044. **Natural-Language Triage Rationale Generator** — generates a one-paragraph plain-English justification for each ML verdict from the top SHAP features.
73045. **Probabilistic Severity Band Model** — outputs a full probability distribution over severity bands instead of a single label, enabling risk-aware downstream decisions.
73046. **Triage Model Version Pinning** — lets clients pin a specific model version for compliance runs while the fleet moves forward.
73047. **Cross-Engine Consensus Feature** — encodes how many independent engines flagged the same issue as a strong triage signal.
73048. **Time-Decay Triage Prior** — adjusts prior probabilities based on finding age so stale, unreproduced findings decay toward dismissal.
73049. **Triage Model Retraining Scheduler** — automatically retrains classifiers on a cadence driven by label volume and drift metrics rather than a fixed calendar.
73050. **Feature-Importance Triage Dashboard Feed** — publishes per-model top features so triage engineers can spot when the model latches onto spurious signals.
73051. **Synthetic Finding Augmentor** — generates synthetic labeled findings via templated mutations to balance training data for underrepresented classes.
73052. **Triage Labeler Agreement Tracker** — measures inter-analyst agreement on sampled findings and uses disagreement as a label-noise signal.
73053. **Distilled Edge Triage Model** — compresses the triage classifier to a 5MB model that runs on-device for air-gapped deployments.
73054. **Multilingual Evidence Classifier** — handles evidence text in Hindi, Spanish, and other languages common in client environments without translation loss.
73055. **Triage Model Canary Deploy** — rolls a new model to 5% of findings first and auto-rolls back if disagreement with the champion exceeds tolerance.
73056. **Evidence-Chain Completeness Model** — predicts whether the request/response chain in a finding is complete enough to support a confident verdict.
73057. **Exploit-Prereq Satisfaction Classifier** — predicts whether the prerequisites for exploitation (auth state, network position) are realistically satisfiable.
73058. **Triage Verdict Stability Monitor** — re-scores a sample of findings daily and alerts when the same finding flips verdicts between model versions.
73059. **Client-Specific Vocabulary Adapter** — fine-tunes the classifier on each client's internal terminology so custom app names don't confuse it.
73060. **Triage Model Lineage Tracker** — records the exact training data snapshot, hyperparameters, and code commit behind every deployed model version.
73061. **Counterfactual Triage Explainer** — shows the minimal evidence change that would flip a verdict, helping analysts challenge borderline calls.
73062. **Severity-Weighted Triage Loss** — trains the classifier with loss weights proportional to severity so misclassifying criticals is penalized most.
73063. **Triage Model Input Sanitizer** — strips credentials, tokens, and PII from evidence before it reaches the classifier to prevent leakage into model artifacts.
73064. **Batch Triage Inference Optimizer** — groups findings into GPU batches for inference, cutting per-finding scoring cost by 80% at scale.
73065. **Triage Confidence Calibration Curves** — publishes reliability diagrams per model version so teams can trust the confidence numbers they see.
73066. **Rare-Class Oversampling Engine** — applies SMOTE-style oversampling in embedding space for vuln classes with under 50 samples.
73067. **Triage Model Decommission Policy** — automatically retires models that haven't been retrained in 90 days or whose golden-set precision drops below floor.
73068. **Evidence-Text Normalizer** — canonicalizes URLs, parameter names, and stack traces before classification to reduce spurious vocabulary growth.
73069. **Triage Model Bias Bounty** — routes model-misclassified findings into a labeled bounty pool that feeds the next training cycle.
73070. **Zero-Day Novelty Detector** — flags findings whose embeddings are far from all known classes as potential novel vulnerability types for expert review.
73071. **Triage Model Hardware Profiler** — benchmarks inference latency per model on CPU and GPU targets to inform the latency budgeter.
73072. **Finding-Lifecycle-Aware Features** — includes reopen count, fix-attempt history, and age as features so chronic findings get different treatment.
73073. **Triage Model Prompt-Injection Guard** — detects evidence text that attempts to manipulate the classifier (e.g., embedded instructions) and quarantines it.
73074. **Per-Severity Calibration Bins** — calibrates confidence separately within each severity band since base rates differ dramatically.
73075. **Triage Model Data Retention Policy** — auto-expires raw evidence from training stores after the configured retention window while keeping aggregated features.
73076. **Shadow-Mode Triage Diff Viewer** — shows side-by-side champion vs challenger verdicts on the same findings for manual spot-checks.
73077. **Triage Model Rollback Switch** — provides a one-click rollback to the previous model version with full audit logging of who triggered it.
73078. **Evidence-Enrichment Trigger** — when classifier confidence is low due to missing data, automatically requests additional probes to fill the gaps.
73079. **Triage Model API Rate Limiter** — protects the inference endpoint from burst traffic during mega-hunts with per-project quotas.
73080. **Cross-Lingual Duplicate-Aware Training** — ensures training pairs include cross-language evidence so the classifier generalizes across regions.
73081. **Triage Model Output Schema Validator** — rejects model outputs that violate the verdict schema before they reach downstream automation.
73082. **Analyst-in-the-Loop Reward Signal** — converts analyst accept/reject actions into graded rewards that feed online-learning updates.
73083. **Triage Model Explainability SLA** — guarantees SHAP explanations render within 200ms so they never slow the triage UI.
73084. **Finding-Priority-Aware Inference Queue** — scores suspected-critical findings first in the inference queue instead of FIFO.
73085. **Triage Model Compression Auditor** — verifies the distilled edge model matches the full model on the golden set within a 1% tolerance.
73086. **Evidence-Similarity Graph Builder** — maintains a live similarity graph of findings to feed graph-based classifiers with fresh edges.
73087. **Triage Model Fallback Cascade** — falls back from transformer to gradient boosting to heuristics when inference fails, never blocking triage.
73088. **Class-Imbalance Alert** — warns when any vuln class drops below 30 training samples, prompting targeted data collection.
73089. **Triage Model Privacy Filter** — applies differential-privacy noise during training so client data can't be extracted from model weights.
73090. **Verdict-Consistency Enforcer** — ensures findings with identical evidence hashes always receive identical verdicts regardless of model version.
73091. **Triage Model Energy Budget** — tracks GPU-hours per model version to keep retraining costs predictable at scale.
73092. **Evidence-Window Selector** — learns which request/response pairs in a long chain are most informative and feeds only those to the classifier.
73093. **Triage Model Tenant Isolation** — guarantees one client's labels never influence another client's model in multi-tenant deployments.
73094. **Auto-Labeling Confidence Gate** — only promotes machine-generated labels to training data when two independent models agree with high confidence.
73095. **Triage Model Drift Dashboard** — visualizes feature-drift, label-drift, and performance-drift in one pane for model operators.
73096. **Verdict-Explanation Localizer** — renders SHAP-based rationales in the analyst's preferred language, including Hinglish.
73097. **Triage Model Stress Tester** — bombards the classifier with malformed, oversized, and adversarial evidence to verify graceful degradation.
73098. **Evidence-Provenance Tagger** — records which engine, hunt, and probe produced each feature so bad sources can be traced and excluded.
73099. **Triage Model SLA Monitor** — alerts when p99 inference latency exceeds the triage pipeline's per-finding budget.
73100. **Classifier-Override Learning Loop** — treats every manual override as a labeled example and measures how fast the model converges to the analyst's judgment.
73101. **Historical-Verdict Replay Engine** — replays past triage decisions through new models to quantify how verdicts would have changed.
73102. **Triage Model Approval Workflow** — requires a named model-owner sign-off before a new version scores production findings.
73103. **Evidence-Redundancy Pruner** — removes near-identical evidence snippets from the training corpus to prevent memorization.
73104. **Triage Classifier Health Score** — computes a single 0–100 health metric from precision, drift, latency, and label volume for ops dashboards.
73105. **Fuzzy-Hash Duplicate Clustering** — groups findings with identical or near-identical request payloads using TLSH fuzzy hashing before triage verdicts are assigned.
73106. **Embedding-Based Near-Duplicate Detector** — computes sentence-embedding similarity over evidence text and merges findings above a learned cosine threshold.
73107. **Canonical Finding Fingerprinter** — normalizes URLs, parameters, and payloads into a canonical form so the same bug found by different engines hashes identically.
73108. **Cross-Run Temporal Deduplication** — suppresses findings that match an already-triaged finding from a previous hunt on the same target within the configured window.
73109. **Cross-Asset Duplicate Linking** — links the same vulnerability class across multiple assets of one client so one triage decision propagates to all instances.
73110. **PoC-Trace Behavioral Dedup** — compares the sequence of probe actions, not just text, to detect duplicates that surface with different payloads.
73111. **Perceptual Screenshot Hashing** — uses pHash on rendered-page evidence screenshots to merge visually identical findings across engines.
73112. **Report-Text Clustering Engine** — applies HDBSCAN over finding descriptions to surface duplicate clusters the fingerprinters missed.
73113. **Transitive Duplicate Resolver** — merges A↔B and B↔C pairs into a single canonical finding even when A and C don't directly match.
73114. **Duplicate Merge/Split Auditor** — logs every merge and split operation with before/after evidence so analysts can undo bad merges.
73115. **Parameter-Position-Agnostic Matcher** — recognizes the same SQLi in `?id=` and `?user=` as duplicates when the vulnerable sink and table are identical.
73116. **Response-Diff Duplicate Filter** — discards a finding when its response body is byte-identical to an already-dismissed finding's response on the same endpoint.
73117. **Version-Aware Dedup Window** — re-opens previously merged duplicates automatically when the target's deployed version changes, since the fix may have regressed.
73118. **Multi-Engine Consensus Merger** — merges findings from different engines only when their vulnerable-parameter and sink evidence agree, avoiding over-merging.
73119. **Duplicate Confidence Scorer** — attaches a 0–1 confidence to every merge so low-confidence merges stay visible as linked rather than fully collapsed.
73120. **Canonical-Finding Election** — picks the most complete finding in a duplicate cluster as the canonical record and archives the rest as evidence variants.
73121. **Endpoint-Tree Duplicate Grouper** — groups findings by URL path tree so `/api/v1/users` and `/api/v2/users` variants triage together.
73122. **Sink-Based Dedup Key** — uses the vulnerable sink location (file, line, function) from stack traces as the primary dedup key for code-level findings.
73123. **Header-Only Finding Dedup** — normalizes security-header findings per (domain, header) pair so missing-HSTS across 200 subdomains becomes one triage item.
73124. **Certificate Finding Consolidator** — merges TLS/certificate issues per certificate fingerprint rather than per hostname.
73125. **Time-Boxed Duplicate Suppression** — suppresses re-detection of an in-progress finding for the SLA window instead of creating a new triage item each hunt.
73126. **Duplicate-Across-Clients Guard** — prevents cross-client dedup in multi-tenant mode while still allowing intra-client merging.
73127. **Evidence-Variant Diff Viewer** — shows side-by-side diffs of merged evidence variants so analysts can verify a merge was correct.
73128. **Auto-Split Detector** — re-splits a cluster when new evidence arrives showing two merged findings have different root causes.
73129. **Dedup Rule Versioning (triage)** — versions every dedup rule and fingerprint schema so old merges can be explained against the rules that created them.
73130. **Duplicate Storm Circuit Breaker** — caps auto-merging at 500 findings per cluster and pages an analyst when a runaway dedup storm is detected.
73131. **Subdomain-Wildcard Dedup** — collapses the same finding across `*.target.com` subdomains into one wildcard triage record with an affected-host list.
73132. **Payload-Family Dedup** — treats different XSS payloads triggering the same reflection point as one finding with multiple proof variants.
73133. **CWE-Anchored Dedup** — uses the assigned CWE as a hard partition so an XSS and an SQLi on the same endpoint never merge.
73134. **Fix-Verification Dedup Reset** — clears dedup memory for a finding once its fix is verified, so a genuine regression creates a fresh triage item.
73135. **Duplicate Graph Visualizer** — renders the merge graph of a cluster so analysts can see which findings merged into the canonical record.
73136. **Near-Duplicate Human Review Queue** — routes only borderline-similarity pairs (0.75–0.90) to humans while auto-merging high-similarity pairs.
73137. **Dedup Precision Monitor** — samples merged clusters weekly, measures analyst undo-rate, and tunes thresholds to keep precision above 98%.
73138. **Language-Agnostic Evidence Dedup** — normalizes non-English evidence text before similarity comparison so Hindi and English reports of the same bug merge.
73139. **Asset-Group Dedup Scoping** — lets clients define asset groups where dedup applies aggressively (CDN edges) vs conservatively (core banking).
73140. **Duplicate-Aware Priority Inheritance** — when a duplicate arrives for a high-priority finding, the cluster inherits the highest priority of any member.
73141. **Historical-Dedup Replay** — replays the last 90 days of findings through new dedup rules in dry-run to preview merge behavior before enabling.
73142. **Dedup-Key Explainability** — shows which canonical fields (URL, param, sink, CWE) produced each merge so analysts trust the automation.
73143. **Orphan-Finding Reclaimer** — re-attaches findings whose canonical record was deleted to the next-best matching cluster.
73144. **Port-Service Dedup Normalizer** — merges identical service misconfigurations across ports into one finding per (host, service) pair.
73145. **Cookie-Flag Dedup Aggregator** — consolidates missing Secure/HttpOnly flags across all cookies of a domain into a single triage item.
73146. **Redirect-Chain Dedup** — treats the same open redirect discovered at different points of a redirect chain as one finding.
73147. **Dedup-Throttle for Mega-Hunts** — switches to streaming approximate dedup (MinHash LSH) when a hunt exceeds 100k findings.
73148. **Client-Confirmed Duplicate Feedback** — feeds analyst "not a duplicate" corrections back into the similarity threshold tuner.
73149. **Dedup Audit Export** — exports every merge decision with evidence hashes for compliance reviews.
73150. **Zero-Evidence Dedup Guard** — refuses to merge findings that both lack evidence, preventing empty records from collapsing together.
73151. **Subdomain-Takeover Dedup Key** — dedups takeover findings by (CNAME target, dangling service) rather than by subdomain.
73152. **Secrets-Leak Dedup by Secret Hash** — merges identical leaked secrets found in multiple files into one finding per secret value.
73153. **JWT-Issue Dedup by Key ID** — groups JWT misconfigurations by signing-key identifier so one bad key is one triage item.
73154. **CORS Dedup by Origin Policy** — consolidates CORS misconfigurations per (domain, policy) instead of per endpoint.
73155. **Rate-Limit Finding Aggregator** — merges missing-rate-limit findings per API route family with a sample of affected endpoints.
73156. **Directory-Listing Dedup** — collapses directory-listing findings per web root rather than per directory.
73157. **Default-Credential Dedup** — merges default-credential findings per (service, credential pair) across all hosts.
73158. **Information-Disclosure Dedup by Pattern** — groups stack-trace and debug disclosures by the leaking framework signature.
73159. **Dedup-Safe Severity Propagation** — when cluster members disagree on severity, the canonical record takes the max and records the spread.
73160. **Evidence-Completeness Dedup Tie-Break** — when electing a canonical finding, prefers the member with the most complete evidence bundle.
73161. **Dedup Cluster Age-Out** — auto-archives duplicate clusters with no new members for 180 days to keep the triage store lean.
73162. **Cross-Hunt Duplicate Lineage** — shows the full lineage of a finding across every hunt that ever reported it.
73163. **Dedup Rule Simulator** — lets triage engineers test a new dedup rule against historical data before deploying it.
73164. **Duplicate-Count Telemetry** — tracks dedup ratio per engine so noisy engines can be tuned or quarantined.
73165. **Smart-Canonical Refresh** — re-elects the canonical finding when a new member arrives with stronger evidence than the current canonical.
73166. **Dedup Exclusion Patterns** — lets clients exclude specific paths (e.g., health checks) from dedup so they always triage separately.
73167. **Finding-Family Dedup Templates** — provides prebuilt dedup templates for common families (headers, TLS, cookies, disclosures) that clients can enable in one click.
73168. **Dedup Conflict Resolver** — when two clusters claim the same finding, resolves by highest merge-confidence and logs the conflict.
73169. **Probabilistic Dedup Record Linkage** — applies Fellegi-Sunter record linkage scoring across multiple weak signals for hard duplicate cases.
73170. **Dedup Performance Profiler** — measures dedup throughput and latency per rule so slow rules can be optimized or indexed.
73171. **Real-Time Dedup Stream** — dedups findings as they stream in from engines rather than in a post-hunt batch, keeping triage queues fresh.
73172. **Dedup Backfill Runner** — applies new dedup rules retroactively to the historical finding store in a background job.
73173. **Duplicate-Cluster SLA Inheritance** — cluster SLA is driven by the earliest member's discovery time, preventing SLA gaming via re-detection.
73174. **Dedup Webhook Events** — emits merge/split events so external ticketing systems stay synchronized with cluster changes.
73175. **Client-Dedup Analytics** — shows each client their dedup ratio, top merged families, and estimated analyst-hours saved.
73176. **Dedup Override API** — exposes endpoints to force-merge or force-split findings programmatically with audit logging.
73177. **Evidence-Hash Registry** — maintains a global registry of evidence hashes to make cross-run dedup O(1) lookups.
73178. **Dedup Cold-Start Defaults** — ships sensible default dedup rules for new clients derived from fleet-wide merge statistics.
73179. **Similarity-Threshold Auto-Tuner** — adjusts per-family similarity thresholds monthly based on analyst undo-rates.
73180. **Dedup Explanation Cards** — renders a compact card in the triage UI explaining why findings were merged, with evidence links.
73181. **Multi-Tenant Dedup Isolation Audit** — periodically verifies no cross-client merges exist in the dedup store.
73182. **Dedup Rule Impact Estimator** — predicts how many findings a proposed rule change would merge before it's applied.
73183. **Canonical-Finding Version History** — tracks every change to the canonical record as members join or leave the cluster.
73184. **Dedup-Aware Search (triage)** — search results collapse duplicates by default with an option to expand the full cluster.
73185. **Finding-Dedup Dry-Run Report** — generates a before/after report showing exactly which findings would merge under new rules.
73186. **Dedup Latency SLA** — guarantees dedup decisions complete within 500ms per finding even at 10k findings per minute.
73187. **Dedup Model Retrainer** — retrains the embedding-based similarity model quarterly on analyst-confirmed merge/split labels.
73188. **Edge-Case Dedup Playbook** — documents handling for tricky cases (same bug, different vuln class assigned) with one-click resolution actions.
73189. **Dedup Health Dashboard (triage)** — shows merge volume, undo rate, cluster size distribution, and rule performance in real time.
73190. **Duplicate-Priority Escalation** — auto-escalates a cluster when its member count crosses a threshold, indicating a systemic issue.
73191. **Dedup-Proof Evidence Bundles** — packages the evidence that justified a merge so it survives even if source findings are archived.
73192. **Cross-Project Dedup Opt-In** — lets a client opt into cross-project dedup within their own tenant for shared-platform findings.
73193. **Dedup Rule Linter** — statically checks new dedup rules for contradictions (e.g., a rule that can never match) before deployment.
73194. **Finding-Dedup API Bulk Endpoints** — supports bulk merge/split operations for programmatic cluster management.
73195. **Dedup Confidence Distribution Tracker** — monitors the distribution of merge confidences to detect threshold drift.
73196. **Canonical-Record Lock** — lets analysts lock a canonical finding so auto-dedup can't merge new members without review.
73197. **Dedup-Aware Notification Digest (triage)** — sends one notification per cluster instead of per finding to cut alert noise.
73198. **Duplicate-Discovery Leaderboard** — credits engines and analysts whose findings most often become canonical records.
73199. **Dedup Schema Migrator** — migrates dedup keys and clusters automatically when the canonical fingerprint schema changes versions.
73200. **Dedup Disaster Recovery** — snapshots cluster state hourly so a bad rule deployment can be rolled back without losing merge history.
73201. **Fingerprint Collision Monitor** — detects when distinct findings produce identical canonical hashes and refines the fingerprint schema.
73202. **Dedup-Aware SLA Clock** — pauses cluster SLA while awaiting analyst confirmation of a disputed merge.
73203. **Multi-Signal Dedup Scorer** — combines URL, parameter, sink, CWE, and embedding signals into one calibrated duplicate probability.
73204. **Dedup Feedback Widget** — embeds a one-click "wrong merge" button in the triage UI that feeds directly into threshold tuning.
73205. **CVSS Vector Predictor** — predicts the full CVSS 4.0 vector (AV/AC/PR/UI/S) from finding evidence so severity is computed, not guessed.
73206. **Exploitability Sub-Score Model** — estimates exploitability from prerequisites, payload reliability, and required privileges observed in the PoC.
73207. **Reachability-Weighted Severity** — downgrades severity when the vulnerable endpoint requires an unlikely network position, learned from asset topology.
73208. **Asset-Criticality Severity Multiplier** — multiplies base severity by the asset's business-criticality tier from the client's asset inventory.
73209. **Blast-Radius Severity Scorer** — estimates how many users, records, or hosts a successful exploit would affect and folds it into severity.
73210. **Chained-Impact Severity Booster** — raises severity when the finding participates in a known exploit chain (e.g., XSS → session theft → account takeover).
73211. **Data-Sensitivity Severity Adjuster** — scans the affected endpoint's data classification (PII, payment, health) and adjusts severity accordingly.
73212. **Exploit-in-the-Wild Severity Override** — automatically elevates severity when threat intel confirms active exploitation of the same CVE or pattern.
73213. **Patch-Availability Severity Decay** — reduces severity over time when a vendor patch exists and the client's patch window has passed without action.
73214. **Regulatory-Impact Severity Model** — predicts regulatory exposure (GDPR, PCI-DSS, HIPAA) from the finding's data scope and adjusts severity.
73215. **Revenue-Impact Severity Estimator** — models potential revenue loss from exploitation using the client's business-context annotations.
73216. **Severity Regression Model** — trains a gradient-boosted regressor to output a continuous 0–10 severity score instead of coarse bands.
73217. **Ordinal Severity Classifier** — uses ordinal regression so the model respects the ordering Critical > High > Medium > Low in its predictions.
73218. **Severity Uncertainty Bands** — outputs severity as a range (e.g., 7.2–8.6) with confidence, letting downstream rules decide on the band edges.
73219. **Historical-Severity Agreement Learner** — learns per-client severity adjustments from how analysts historically re-graded model-proposed severities.
73220. **Peer-Benchmark Severity Calibrator** — compares a client's severity distribution against industry peers to flag systematic over- or under-grading.
73221. **Temporal Severity Escalator** — automatically escalates severity if a finding remains unremediated past its SLA, reflecting growing exposure.
73222. **Compensating-Control Severity Reducer** — lowers severity when WAF rules, network segmentation, or other controls provably mitigate the finding.
73223. **Severity Explanation Generator** — produces a bullet-point rationale citing which factors (exploitability, asset value, data scope) set the severity.
73224. **Multi-Stakeholder Severity Views** — renders different severity lenses (security, compliance, business) from the same underlying score components.
73225. **Severity Drift Monitor** — tracks the fleet-wide severity distribution and alerts when a model update shifts it unexpectedly.
73226. **Zero-Day Severity Prior** — assigns provisional severity to novel findings using similarity to the nearest known severe vulnerabilities.
73227. **Severity Consensus Aggregator** — combines model severity, engine severity, and analyst history into a weighted consensus score.
73228. **Environment-Context Severity** — adjusts severity based on whether the finding is in production, staging, or development environments.
73229. **Internet-Exposure Severity Boost** — elevates severity for vulnerabilities on internet-facing assets versus internal-only ones.
73230. **Authentication-Barrier Severity Model** — quantifies how much the required auth level (none, user, admin) reduces practical severity.
73231. **User-Interaction Severity Discount** — models the probability a victim interacts (phishing click rates) to weight client-side findings.
73232. **Severity Backtesting Harness** — replays a year of findings through the severity model to verify it would have prioritized the real incidents.
73233. **CWE-Base Severity Priors** — seeds severity predictions with CWE-level base scores refined by per-finding evidence.
73234. **Severity Override Audit Trail (triage)** — records every manual severity change with the analyst, timestamp, and justification for compliance.
73235. **Severity Model A/B Diff** — shows how a candidate severity model would re-grade the current open backlog before promotion.
73236. **Business-Unit Severity Profiles** — lets each business unit define its own severity weighting (e.g., payments cares more about integrity).
73237. **Severity SLA Mapper** — maps the predicted severity to the client's contractual SLA matrix automatically.
73238. **Exploit-Maturity Severity Ladder** — steps severity up as exploit maturity progresses from theoretical → PoC → weaponized → in-the-wild.
73239. **Severity Confidence Gate** — routes findings to human review when the severity model's confidence falls below threshold instead of auto-grading.
73240. **Attack-Path Severity Propagator** — propagates severity along attack paths so a medium finding that enables a critical one gets escalated.
73241. **Severity De-duplication Guard** — ensures merged duplicate clusters take the maximum member severity, never an average.
73242. **Client Risk-Appetite Severity Tuner** — learns whether a client systematically grades up or down and pre-adjusts model outputs.
73243. **Severity Model Feature Audit** — lists the top predictive features per severity band so analysts can sanity-check the model's logic.
73244. **Time-to-Exploit Severity Factor** — incorporates estimated time-to-exploit from threat intel into the severity calculation.
73245. **Severity Recalculation Triggers** — re-scores severity automatically when asset criticality, exposure, or threat intel changes.
73246. **Severity Versioning** — versions every severity assignment with the model version and feature snapshot that produced it.
73247. **Severity Disagreement Resolver** — when model, engine, and rules disagree, routes to a weighted-vote with a human tiebreak queue.
73248. **Impact-Scope Severity Matrix** — cross-references confidentiality, integrity, and availability impact into a client-customizable severity matrix.
73249. **Severity-Aware Triage Routing** — sends predicted-critical findings to senior analysts and predicted-lows to the auto-triage lane.
73250. **Severity Prediction Latency Budget** — guarantees severity scoring completes within the triage pipeline's per-finding time budget.
73251. **Severity Model Cold-Start Priors** — uses CWE and industry data as priors for new clients with no historical severity labels.
73252. **Severity Calibration by Outcome** — recalibrates severity bands against actual breach and incident outcomes, not just analyst labels.
73253. **Severity Explanation Localizer** — renders severity rationales in the analyst's language with client-specific terminology.
73254. **Severity Trend Forecaster** — predicts how the open-finding severity mix will evolve over the next 30 days for capacity planning.
73255. **Severity Outlier Detector** — flags findings whose severity deviates sharply from similar historical findings for review.
73256. **Severity Model Fairness Check** — verifies severity predictions don't systematically differ by client size, region, or industry.
73257. **Post-Remediation Severity Archive** — freezes the final severity at remediation time for trend analysis and reporting.
73258. **Severity-Weighted Workload Planner** — converts predicted severities into analyst-hours to forecast triage capacity needs.
73259. **Severity API** — exposes a dedicated endpoint that scores any finding payload's severity on demand.
73260. **Severity Webhook Events (triage)** — emits events when a finding's severity changes, with old and new values and the reason.
73261. **Severity Change Digest** — sends a daily digest of severity re-grades so stakeholders aren't surprised by silent changes.
73262. **Severity Model Rollback** — reverts to the previous severity model version with one click and re-grades affected findings.
73263. **Severity Simulation Sandbox** — lets triage engineers test how a severity rule change would re-grade the entire backlog.
73264. **Severity Confidence Distribution** — monitors the distribution of severity confidences to detect model degradation early.
73265. **Severity Label Quality Scorer** — measures historical analyst severity-label consistency to weight training data quality.
73266. **Severity Model Documentation Generator** — auto-generates a model card (intended use, limits, metrics) for every severity model version.
73267. **Severity Appeals Queue** — gives finding owners a structured way to appeal an auto-assigned severity with evidence.
73268. **Severity Appeal Analytics** — tracks appeal rates and outcomes to identify systematically mis-graded finding families.
73269. **Severity Grading Playbook Links** — attaches the relevant severity-grading playbook section to every auto-graded finding.
73270. **Severity Model Input Validator** — rejects severity predictions when required evidence fields are missing rather than guessing.
73271. **Cross-Framework Severity Mapper** — translates Dark-Matter severity into CVSS, DREAD, and OWASP Risk Rating on demand.
73272. **Severity Normalization Service** — normalizes severity scales across engines that report on different scales (1–5, 1–10, Low–Critical).
73273. **Severity History Timeline** — shows every severity change for a finding as an interactive timeline with reasons.
73274. **Severity Prediction Explanations API** — returns SHAP-style feature contributions alongside every severity score via API.
73275. **Severity-Aware Deduplication** — prevents a high-severity finding from being merged into a low-severity cluster on weak evidence.
73276. **Severity Floor Enforcer** — enforces client-defined minimum severities for regulated finding types (e.g., auth bypass is never below High).
73277. **Severity Ceiling Guard** — caps auto-assigned severity for finding families with historically high false-positive rates pending verification.
73278. **Severity Re-Grade Scheduler** — periodically re-grades stale findings as threat intel and asset context evolve.
73279. **Severity Model Ensemble** — blends a rules-based grader, a gradient-boosted model, and an LLM judge for final severity.
73280. **Severity Benchmark Dataset** — maintains a curated 5,000-finding benchmark with expert severity labels for model evaluation.
73281. **Severity Label Adjudication** — resolves conflicting historical severity labels via a structured expert-adjudication workflow.
73282. **Severity Prediction Caching** — caches severity scores by evidence hash so identical findings score instantly.
73283. **Severity-Aware Export Filters** — lets report exports filter or group by predicted severity bands automatically.
73284. **Severity Model Cost Tracker** — tracks inference cost per severity prediction to optimize the ensemble's cost/accuracy tradeoff.
73285. **Severity Confidence Thresholds per Client** — lets each client set how confident the model must be before auto-grading applies.
73286. **Severity Model Shadow Scoring** — scores every finding with the challenger model in shadow mode and logs disagreements.
73287. **Severity Impact Simulator** — simulates breach scenarios to show stakeholders what a severity-9 finding could actually cost.
73288. **Severity Assignment Latency SLA** — guarantees severity is assigned within 60 seconds of finding ingestion.
73289. **Severity Model Retraining Triggers** — retrains when appeal rates spike or threat-intel distributions shift, not on a fixed schedule.
73290. **Severity Prediction Audit Export** — exports every severity decision with inputs and model version for auditor review.
73291. **Severity-Aware Priority Queue** — orders the triage queue by predicted severity blended with SLA urgency.
73292. **Severity Model Degradation Alerts** — pages the ML team when golden-set severity accuracy drops below the agreed floor.
73293. **Severity Context Enrichment** — auto-attaches asset, exposure, and threat-intel context to every severity decision record.
73294. **Severity Model Multi-Tenancy** — isolates per-client severity calibration so one client's grading habits don't leak into another's.
73295. **Severity Prediction Idempotency** — guarantees re-scoring the same evidence returns the same severity unless inputs changed.
73296. **Severity Change Approval** — requires a second analyst's approval for auto-severity changes on already-triaged critical findings.
73297. **Severity Model Explainability Report** — generates a quarterly report on what drives severity predictions for governance review.
73298. **Severity-Aware Auto-Assignment** — routes predicted-critical findings to on-call senior analysts immediately, bypassing the normal queue.
73299. **Severity Feedback Micro-Survey** — asks analysts for a one-tap agree/disagree on auto-severity, feeding the retraining loop.
73300. **Severity Prediction Version Pinning** — lets compliance runs pin a severity model version for reproducible audit trails.
73301. **Severity Outlier Auto-Quarantine** — holds severity predictions that deviate more than two bands from the engine's own rating for review.
73302. **Severity Correlation Analyzer** — finds which evidence features most correlate with severity upgrades to guide engine improvements.
73303. **Severity-Aware Deduplication Thresholds** — uses stricter merge thresholds for high-severity findings to avoid dangerous over-merging.
73304. **Severity Model Health Score** — rolls accuracy, calibration, latency, and appeal-rate into one operational health metric.
73305. **Skill-Based Finding Router** — matches findings to analysts by their certified skills (web, mobile, cloud, crypto) encoded in a skill matrix.
73306. **Workload-Aware Assignment Engine** — distributes findings using live analyst queue depths so no one exceeds their configured WIP limit.
73307. **SLA-Aware Priority Router** — assigns findings nearest their SLA breach to the analyst most likely to clear them in time, based on historical throughput.
73308. **Code-Ownership Mapper** — routes findings to the team that owns the affected repository or service, resolved from CODEOWNERS-style mappings.
73309. **Escalation-Chain Router** — automatically walks the on-call escalation chain when the primary assignee doesn't acknowledge within the configured window.
73310. **Weighted Round-Robin Assigner** — distributes findings round-robin weighted by each analyst's capacity fraction and shift schedule.
73311. **On-Call Calendar Integration** — pulls the live on-call rotation from PagerDuty/Opsgenie so critical findings always land on the right person.
73312. **Timezone-Aware Routing (triage)** — assigns findings to analysts currently in working hours, with follow-the-sun handoff for 24/7 coverage.
73313. **Language-Match Router** — routes findings with non-English evidence to analysts fluent in that language.
73314. **Client-Affinity Router** — prefers assigning a client's findings to analysts who previously triaged that client, preserving context.
73315. **Severity-Tiered Routing** — sends criticals to senior analysts, highs to mid-level, and lows to the auto-triage lane with spot-check sampling.
73316. **Vuln-Class Specialist Router** — routes crypto findings to crypto specialists and auth findings to identity specialists automatically.
73317. **New-Hire Ramp Router** — gives junior analysts a curated mix of low-severity findings with senior review until their accuracy passes the bar.
73318. **Assignment Load Balancer** — rebalances assignments hourly, moving queued findings from overloaded analysts to underutilized ones.
73319. **Vacation-Aware Reassignment** — automatically reassigns an analyst's queue when their calendar shows PTO, with context notes attached.
73320. **Assignment Staleness Detector** — flags findings sitting unacknowledged beyond the ack SLA and reassigns them with an escalation note.
73321. **Performance-Based Routing (triage)** — routes more findings to analysts with higher historical accuracy on that vuln class, fewer to struggling ones.
73322. **Assignment Conflict Resolver** — prevents the same analyst from triaging both a finding and its duplicate cluster's canonical record inconsistently.
73323. **Cross-Team Overflow Router** — spills findings to a secondary team pool when the primary team's queue exceeds its overflow threshold.
73324. **Assignment Fairness Monitor** — tracks distribution of criticals vs lows per analyst to prevent burnout from skewed assignments.
73325. **Temporary-Capacity Router** — spins up contractor or overflow pools during mega-hunts and routes bulk low-severity findings there.
73326. **Assignment Explanation Cards** — shows analysts why a finding was assigned to them (skill match, workload, affinity) to build trust in automation.
73327. **Reassignment Audit Trail** — logs every assignment change with actor, reason, and timestamp for SLA forensics.
73328. **Assignment SLA Predictor** — predicts whether the current assignee will clear the finding before its SLA based on their historical pace.
73329. **Smart Reassignment Suggester** — recommends the best new assignee when a finding needs reassignment, ranked by fit score.
73330. **Assignment Freeze for Disputes** — locks assignment changes while a severity appeal is open to avoid conflicting triage.
73331. **Team-Capacity Forecaster** — predicts each team's available triage hours for the next two weeks from calendars and historical velocity.
73332. **Assignment Rule Simulator** — dry-runs proposed routing rules against last month's findings to preview distribution effects.
73333. **Assignment Rule Versioning** — versions routing rules so assignment behavior is reproducible and auditable.
73334. **Emergency-Broadcast Router** — blasts critical zero-day findings to all qualified analysts simultaneously with first-claim assignment.
73335. **Assignment Acknowledgment Tracker** — measures time-to-acknowledge per analyst and feeds it into routing decisions.
73336. **Skill-Decay Model (triage)** — reduces an analyst's skill weight for a vuln class if they haven't triaged one in 90 days.
73337. **Assignment Preference Learner** — learns analyst preferences (e.g., prefers API findings) from accept/swap behavior and biases routing.
73338. **Swap-Market for Assignments** — lets analysts offer findings for swap with a fit-scored matching engine, keeping the swap audit-logged.
73339. **Assignment Quality Feedback** — asks finding owners to rate triage quality, feeding analyst skill profiles.
73340. **Router Health Dashboard** — shows assignment distribution, ack times, SLA risk, and rule hit-rates in real time.
73341. **Assignment Circuit Breaker** — stops auto-assigning to an analyst whose recent triage accuracy dropped below the quality floor.
73342. **Geo-Compliance Router** — routes findings with data-residency constraints to analysts in approved jurisdictions only.
73343. **Clearance-Level Router** — restricts assignment of findings on classified assets to analysts with the required clearance.
73344. **Assignment Batching** — groups related findings (same asset, same class) into one assignment batch to reduce context switching.
73345. **Assignment Digest Mode** — lets analysts receive batched assignment notifications hourly instead of per-finding pings.
73346. **Router Override API** — exposes endpoints for manual assignment with mandatory reason codes that feed the audit log.
73347. **Assignment Webhook Events** — emits assigned, reassigned, acknowledged, and escalated events for external workflow tools.
73348. **Assignment SLA Clocks** — starts per-assignment ack and resolution clocks the moment routing completes.
73349. **Router Fallback Chain** — falls back from skill-match to team-pool to overflow-pool so findings never sit unassigned.
73350. **Assignment Latency SLA** — guarantees routing completes within 30 seconds of a finding entering the triage queue.
73351. **Historical Assignment Replay** — replays past assignments through new routing rules to quantify fairness and SLA improvements.
73352. **Assignment Bias Auditor** — checks that routing doesn't systematically disadvantage any analyst or team.
73353. **Multi-Finding Campaign Router** — assigns all findings from one coordinated campaign to a single analyst for coherent triage.
73354. **Assignment Confidence Scores** — attaches a fit confidence to every assignment so low-confidence ones get a second look.
73355. **Router Canary Deploy** — rolls new routing rules to 10% of findings first and compares SLA outcomes before full rollout.
73356. **Assignment Cost Model** — estimates analyst-hours per assignment to support capacity planning and client billing.
73357. **After-Hours Routing Policy** — defines exactly which severities page on-call staff versus waiting for business hours.
73358. **Assignment Handoff Notes** — auto-generates context summaries when findings transfer between analysts or shifts.
73359. **Router Rule Linter** — statically validates routing rules for unreachable branches and conflicting priorities.
73360. **Assignment Outcome Tracker** — links assignment decisions to downstream outcomes (fix rate, reopen rate) per analyst.
73361. **Dynamic Skill Inference** — infers analyst skills from their triage accuracy history rather than relying only on self-declared skills.
73362. **Assignment Throttling** — caps assignments per analyst per hour to prevent queue flooding during mega-hunts.
73363. **Priority-Lane Router** — maintains separate fast-lane queues for criticals with dedicated senior capacity.
73364. **Assignment Rebalancing Alerts** — notifies team leads when rebalancing moves more than 20% of a queue.
73365. **Router Dry-Run Mode** — computes assignments without applying them so leads can review before a big hunt's findings land.
73366. **Assignment Template Library** — provides prebuilt routing templates (startup, enterprise, MSSP) deployable in one click.
73367. **Cross-Client Analyst Pools** — lets MSSPs pool analysts across clients while enforcing data-isolation boundaries.
73368. **Assignment Encryption** — encrypts assignment payloads containing client-sensitive context in transit and at rest.
73369. **Router Performance Profiler** — measures routing decision latency per rule to keep the 30-second SLA.
73370. **Assignment Satisfaction Pulse** — surveys analysts quarterly on routing fairness, feeding rule tuning.
73371. **Skill-Gap Analyzer** — identifies vuln classes with no qualified analyst and recommends hiring or training.
73372. **Assignment Forecast Export** — exports predicted assignment loads per analyst for sprint planning.
73373. **Router Incident Playbook** — defines exact steps when the router fails, including manual assignment fallback procedures.
73374. **Assignment Data Retention** — purges assignment history per client retention policy while keeping anonymized aggregates.
73375. **Multi-Region Router** — routes within region boundaries for clients with data-sovereignty requirements.
73376. **Assignment API Rate Limits** — protects the routing engine from bulk-reassignment storms via per-client quotas.
73377. **Router Chaos Tester** — simulates analyst outages to verify fallback chains reassign correctly.
73378. **Assignment Quality Gates** — blocks auto-assignment of disputed or appealed findings until resolution.
73379. **Team-Topology-Aware Routing** — understands squad structures so findings route to squads, not just individuals.
73380. **Assignment Streak Protector** — avoids assigning an analyst the same vuln class 20 times in a row to reduce fatigue errors.
73381. **Router Explainability API** — returns the ranked candidate list and scores behind every routing decision.
73382. **Assignment Simulation Sandbox** — lets leads simulate "what if we hire two analysts" on historical data.
73383. **Onboarding Assignment Tracks** — defines progressive assignment tracks that ramp new analysts from lows to highs automatically.
73384. **Assignment Compliance Reports** — generates per-client reports proving findings were assigned per the contracted routing policy.
73385. **Router Version Diff Viewer** — shows exactly what changed between routing-rule versions.
73386. **Assignment Latency Analytics** — breaks down routing latency by rule evaluation, skill lookup, and calendar checks.
73387. **Emergency Reassignment Broadcast** — lets incident commanders instantly reassign all of an unavailable analyst's criticals.
73388. **Assignment Context Packets** — bundles finding, asset, client, and SLA context into one packet the assignee receives.
73389. **Router Self-Healing** — detects when an analyst's queue is stuck and auto-escalates without human intervention.
73390. **Assignment Outcome Feedback Loop** — feeds fix-verification results back into analyst skill profiles monthly.
73391. **Capacity-Aware Due Dates** — sets internal due dates from real team capacity, not just the contractual SLA.
73392. **Assignment Rule Impact Forecast** — predicts SLA-breach reduction from a proposed routing change before deployment.
73393. **Router Audit Export** — exports the full routing decision log for client or regulator audits.
73394. **Assignment Notification Preferences (triage)** — lets analysts choose channels (email, Slack, SMS) and quiet hours for assignment pings.
73395. **Skill-Certification Tracker** — tracks analyst certifications and auto-updates routing eligibility when they expire.
73396. **Assignment Load Heatmap** — visualizes per-analyst load over time to spot chronic overload.
73397. **Router Failover** — runs a hot-standby routing engine that takes over within seconds of primary failure.
73398. **Assignment Quality Sampling** — auto-selects a stratified sample of routed findings for lead review each week.
73399. **Router Configuration Drift Guard** — alerts when production routing config diverges from the versioned source of truth.
73400. **Assignment Outcome Benchmarks** — compares team routing outcomes against fleet-wide benchmarks.
73401. **Dynamic Reassignment Triggers** — reassigns automatically on events like severity upgrade, SLA risk, or analyst PTO.
73402. **Assignment Collaboration Mode** — allows pairing two analysts on complex findings with shared credit and audit trail.
73403. **Router Cost Optimizer** — balances assignments across in-house and contractor pools to minimize cost while meeting SLAs.
73404. **Assignment Lifecycle Webhooks** — emits the full assignment lifecycle so BI tools can build custom routing analytics.
73405. **Composite Priority Score Engine** — blends severity, exploitability, asset value, SLA urgency, and threat intel into a single 0–100 priority number.
73406. **Exploit-in-the-Wild Priority Boost** — adds a fixed priority bump when CISA KEV or equivalent feeds confirm active exploitation.
73407. **Patch-Availability Priority Factor** — raises priority when a vendor patch exists but isn't applied, since the fix path is clear.
73408. **Threat-Intel Priority Feed** — ingests commercial and open threat feeds hourly to re-prioritize findings tied to trending attacker TTPs.
73409. **Asset-Exposure Priority Weight** — weights internet-facing assets higher than internal ones in the priority calculation.
73410. **Compliance-Deadline Priority** — spikes priority as audit or certification deadlines approach for findings in scope.
73411. **Revenue-Impact Priority Model** — estimates revenue at risk per finding from client business annotations and folds it into priority.
73412. **Priority Decay Function** — decays priority of long-open low-severity findings so the queue reflects current risk, not accumulation.
73413. **SLA-Urgency Priority Term** — adds an exponentially growing term as a finding approaches its SLA deadline.
73414. **Business-Criticality Priority Multiplier** — multiplies priority for assets tagged as crown jewels in the client's asset inventory.
73415. **User-Base Priority Factor** — scales priority by the number of users affected, from internal tools to customer-facing platforms.
73416. **Data-Classification Priority Boost** — elevates findings touching PII, payment, or health data per the client's data-classification map.
73417. **Chain-Position Priority** — boosts findings that sit on validated attack paths toward critical assets.
73418. **Priority Score Explainability** — breaks every priority score into its weighted components in the triage UI.
73419. **Priority Recalculation Triggers (triage)** — re-scores priority on threat-intel updates, asset changes, SLA shifts, and severity re-grades.
73420. **Priority Model Versioning** — versions the priority formula so historical scores remain reproducible for audits.
73421. **Priority Simulation Sandbox** — previews how a formula change would reorder the current backlog before deployment.
73422. **Priority Distribution Monitor** — alerts when the priority distribution skews unexpectedly, indicating a broken input signal.
73423. **Priority Calibration by Outcome** — tunes priority weights against which findings actually led to incidents.
73424. **Priority Floor for Regulated Findings** — enforces minimum priority for findings in regulated scopes regardless of other signals.
73425. **Priority Ceiling for Unverified** — caps priority for findings awaiting verification so unconfirmed bugs can't dominate the queue.
73426. **Priority Aging Policy** — defines how priority evolves with age per severity band, configurable per client.
73427. **Priority Inheritance for Duplicates** — duplicate clusters inherit the maximum member priority automatically.
73428. **Priority-Based Queue Ordering** — orders the triage queue by live priority score instead of static severity-then-age.
73429. **Priority Change Webhooks** — emits events when a finding's priority crosses configured thresholds.
73430. **Priority History Timeline** — records every priority change with the triggering signal for forensics.
73431. **Priority API Endpoint** — exposes on-demand priority scoring for any finding payload.
73432. **Priority Batch Rescorer** — re-scores the entire backlog nightly to incorporate fresh threat intel.
73433. **Priority Model A/B Test** — runs two priority formulas in parallel on mirrored queues and compares SLA outcomes.
73434. **Priority Override Audit (triage)** — logs manual priority changes with justification and measures override rates per analyst.
73435. **Priority Confidence Intervals** — reports priority as a range reflecting uncertainty in the input signals.
73436. **Priority Signal Health** — monitors each input signal (feeds, asset data) for staleness and degrades gracefully when one fails.
73437. **Priority-Aware Notifications (triage)** — only pages for priority jumps above threshold, not every minor re-score.
73438. **Priority Segmentation** — segments the backlog into P0–P4 bands with distinct handling playbooks per band.
73439. **Priority Forecast** — predicts the priority mix of incoming findings for the next sprint from hunt schedules.
73440. **Priority Fairness Across Clients** — ensures MSSP priority formulas don't systematically starve smaller clients.
73441. **Priority Model Documentation (triage)** — auto-generates a model card describing the formula, signals, and known limits.
73442. **Priority Backtesting** — replays historical findings through the priority engine to verify it would have surfaced real incidents first.
73443. **Priority Latency SLA** — guarantees re-scoring completes within 5 seconds of a trigger event.
73444. **Priority Signal Contribution API** — returns per-signal contributions so clients can build custom priority views.
73445. **Priority-Based Auto-Escalation** — auto-escalates findings whose priority crosses the P0 threshold with full context.
73446. **Priority Deduplication Guard** — prevents priority inflation when the same signal arrives from multiple feeds.
73447. **Priority Cold-Start Defaults** — ships fleet-derived default weights for new clients, then personalizes from their outcomes.
73448. **Priority Model Rollback** — reverts to the previous formula version instantly and re-scores affected findings.
73449. **Priority Change Digest** — sends stakeholders a daily summary of the biggest priority movers and why they moved.
73450. **Priority-Aware Capacity Planning** — converts the priority-weighted backlog into analyst-hours for hiring decisions.
73451. **Priority Score Caching** — caches scores by finding hash and invalidates only when input signals change.
73452. **Priority Formula Linter** — validates formula changes for circular references and out-of-range weights before deployment.
73453. **Priority Anomaly Detector (triage)** — flags findings whose priority jumps abnormally between re-scores for review.
73454. **Priority-Based Sampling for QA** — samples high-priority findings more heavily for triage quality audits.
73455. **Priority Export** — includes live priority scores and component breakdowns in all finding exports.
73456. **Priority Webhook Filters** — lets integrations subscribe only to priority bands they care about.
73457. **Priority Model Cost Tracker** — tracks compute cost per re-score to keep the batch rescorer economical.
73458. **Priority Confidence Gate** — holds findings with low-confidence priority signals for enrichment before queue placement.
73459. **Priority-Aware Deduplication** — uses stricter merge thresholds for P0/P1 findings.
73460. **Priority Trend Dashboard** — visualizes priority distribution shifts over time per client and fleet-wide.
73461. **Priority Signal Lineage** — traces every priority component back to its source data and timestamp.
73462. **Priority Override Analytics (triage)** — analyzes manual overrides to find systematically mis-weighted signals.
73463. **Priority Model Tenant Isolation** — keeps per-client priority tuning from leaking across tenants.
73464. **Priority Recalculation Audit** — logs every automated re-score with the triggering event for compliance.
73465. **Priority-Based Report Sections** — auto-generates executive reports organized by priority band with business impact summaries.
73466. **Priority Simulation API** — lets clients test "what would this finding's priority be if the asset were critical" via API.
73467. **Priority Degradation Fallback** — falls back to severity-only priority when threat-intel feeds are unreachable.
73468. **Priority Queue Watermarks** — sets high/low watermarks that trigger overflow routing when the P0 queue grows too large.
73469. **Priority Model Approval Workflow** — requires model-owner sign-off before a new priority formula goes live.
73470. **Priority Explanation Localizer** — renders priority breakdowns in the analyst's preferred language.
73471. **Priority-Aware SLA Mapping** — maps priority bands to internal response targets tighter than contractual SLAs.
73472. **Priority Signal Freshness SLA** — guarantees threat-intel inputs are no older than one hour for priority decisions.
73473. **Priority Outlier Quarantine** — holds findings with priority scores far outside historical norms for human verification.
73474. **Priority Model Stress Test** — feeds adversarial signal combinations to verify the formula can't produce dangerous inversions.
73475. **Priority-Based Hunt Scheduling** — schedules follow-up hunts sooner for assets with high-priority open findings.
73476. **Priority Correlation Insights** — surfaces which signals most drive P0 findings to guide proactive defense.
73477. **Priority Score Versioning in Exports** — stamps exports with the formula version so scores stay interpretable later.
73478. **Priority-Aware Ticket Sync** — syncs priority changes to Jira/ServiceNow in real time with field mapping.
73479. **Priority Threshold Tuner** — learns optimal P0–P4 cutoffs per client from their incident history.
73480. **Priority Model Health Score** — rolls accuracy, freshness, latency, and override-rate into one operational metric.
73481. **Priority-Based Analyst Briefings** — auto-generates shift-start briefings listing each analyst's top-priority items.
73482. **Priority Signal Contribution Drift** — monitors whether signal weights still match their real-world predictive power.
73483. **Priority Re-Score Storm Guard** — rate-limits mass re-scores during feed outages to avoid queue thrash.
73484. **Priority-Aware Archive Policy** — archives low-priority stale findings automatically while preserving their records.
73485. **Priority Explanation API (triage)** — returns the full component breakdown for any finding's priority on demand.
73486. **Priority Model Bias Audit** — checks priority doesn't systematically favor or punish specific asset types or clients.
73487. **Priority Change Approval for P0** — requires lead approval before a P0 finding's priority can be manually lowered.
73488. **Priority Forecast Accuracy Tracker** — measures how well priority forecasts matched actual incoming severity mix.
73489. **Priority Signal Onboarding Wizard** — guides new clients through connecting asset, threat-intel, and business-context signals.
73490. **Priority Formula Diff Viewer** — shows side-by-side formula changes with predicted backlog impact.
73491. **Priority-Aware Mobile Alerts** — pushes only P0/P1 priority changes to on-call mobile devices.
73492. **Priority Model Retraining Cadence** — retrains priority weights quarterly on incident-outcome data.
73493. **Priority Score Idempotency** — guarantees identical inputs always produce identical priority scores.
73494. **Priority-Based Gamification** — credits analysts for clearing high-priority findings in team performance views.
73495. **Priority Signal Quality Scorer** — grades each input feed on timeliness, coverage, and accuracy monthly.
73496. **Priority-Aware Data Retention** — keeps full signal history for P0/P1 findings longer for incident forensics.
73497. **Priority Model Sandbox Cloning** — clones production priority state into a sandbox for safe formula experimentation.
73498. **Priority Change Reason Codes** — enforces structured reason codes on manual priority changes for analytics.
73499. **Priority API Bulk Scoring** — scores up to 10k findings per API call for backlog migrations.
73500. **Priority Engine Chaos Testing** — simulates feed failures to verify graceful priority degradation.
73501. **Priority-Based Executive Summary** — auto-builds CISO-ready summaries from the current priority distribution.
73502. **Priority Signal Dependency Map** — visualizes which priority components depend on which upstream data sources.
73503. **Priority Model Lineage Tracker** — records training data, weights, and approval for every priority model version.
73504. **Priority Queue Simulation Replay** — replays a historical week through the current formula to validate queue behavior.
73505. **Contractual SLA Matrix Engine** — computes per-finding SLA deadlines from the client's contract matrix keyed by severity, asset tier, and finding class.
73506. **Business-Hours SLA Calculator** — calculates deadlines in business hours using the client's configured working calendar, holidays, and timezone.
73507. **Severity-Tiered SLA Defaults** — applies fleet-standard SLA targets (e.g., Critical 24h, High 7d) when a client hasn't defined their own matrix.
73508. **Asset-Tier SLA Multiplier** — shortens SLAs automatically for crown-jewel assets per the client's asset-criticality policy.
73509. **Regulatory SLA Overlays** — applies stricter deadlines for findings in PCI-DSS, HIPAA, or GDPR scope on top of the base matrix.
73510. **SLA Pause/Resume Engine** — pauses the SLA clock during client-caused blocks (awaiting credentials, change freeze) with full audit trail.
73511. **SLA Recalculation on Severity Change** — recomputes the deadline instantly when severity is re-graded, preserving elapsed-time fairness.
73512. **SLA Recalculation on Reassignment** — adjusts internal targets when a finding moves teams, without altering the contractual deadline.
73513. **Multi-Deadline SLA Model** — tracks separate ack, triage, remediation, and verification deadlines per finding instead of one monolithic date.
73514. **SLA Breach Predictor (triage)** — forecasts breach probability per finding from assignee velocity and queue position, updating hourly.
73515. **SLA Grace-Period Configurator** — lets clients define grace periods per severity before a breach is officially counted.
73516. **SLA Clock Visualization** — renders a live countdown per finding in the triage UI with color shifts as deadlines approach.
73517. **SLA Bulk Importer** — imports contractual SLA matrices from spreadsheets or PDF contracts via a guided mapping wizard.
73518. **SLA Versioning (triage)** — versions the SLA matrix so findings created under an old contract keep their original deadlines.
73519. **SLA Exception Workflow** — provides a structured exception request flow with approver chains for deadline extensions.
73520. **SLA Exception Analytics** — tracks exception rates by team and reason to spot chronic deadline problems.
73521. **SLA Auto-Escalation Mapping** — maps each deadline stage to an escalation action (notify lead, page on-call, notify CISO).
73522. **SLA Timezone Normalizer** — normalizes all SLA timestamps to the client's home timezone for consistent reporting.
73523. **SLA Holiday Calendar Sync** — syncs with the client's HR holiday calendar so deadlines skip non-working days automatically.
73524. **SLA Performance Baselines** — computes per-team historical SLA attainment to set realistic targets.
73525. **SLA Attainment Forecaster** — predicts end-of-quarter SLA attainment from current burn-down for client QBRs.
73526. **SLA Breach Root-Cause Analyzer** — classifies breaches by cause (late assignment, slow triage, blocked remediation) for process fixes.
73527. **SLA Credit Calculator (triage)** — computes service credits owed when contractual SLAs are breached, per the contract terms.
73528. **SLA Dashboard per Client** — shows real-time attainment, at-risk findings, and breach trends per client tenant.
73529. **SLA Alert Escalation Ladder** — sends warnings at 75%, 90%, and 100% of elapsed SLA with escalating recipients.
73530. **SLA-Aware Queue Sorting** — sorts triage queues by time-to-deadline blended with priority so urgent items surface first.
73531. **SLA Simulation for New Contracts** — simulates how a proposed SLA matrix would have performed on last year's findings.
73532. **SLA Negotiation Advisor** — recommends achievable SLA targets from the team's measured velocity data.
73533. **SLA Clock Audit Log** — records every pause, resume, recalculation, and exception with actor and reason.
73534. **SLA API (triage)** — exposes deadline computation, pause/resume, and breach prediction as REST endpoints.
73535. **SLA Webhook Events** — emits deadline-set, warning, breached, paused, and resumed events for external systems.
73536. **SLA Export for QBRs** — generates client-ready SLA attainment reports with breach narratives for quarterly reviews.
73537. **SLA Gamification (triage)** — shows teams their SLA streaks and attainment rankings to encourage healthy competition.
73538. **SLA Risk Heatmap** — visualizes at-risk findings by team, asset, and severity in a single heatmap.
73539. **SLA Auto-Prioritization** — boosts queue priority automatically as findings approach their deadlines.
73540. **SLA Breach Post-Mortem Templates** — auto-generates post-mortem drafts for breached SLAs with timeline and contributing factors.
73541. **SLA Policy Linter** — validates SLA matrix changes for impossible targets (e.g., 1-hour remediation for lows).
73542. **SLA Multi-Tenant Isolation** — keeps each client's SLA configuration and clocks fully isolated.
73543. **SLA Deadline Confidence** — reports the model's confidence in each breach prediction so teams trust the warnings.
73544. **SLA-Aware Assignment (triage)** — routes findings to analysts whose historical pace fits the remaining SLA window.
73545. **SLA Burn-Down Charts** — renders burn-down of open findings against SLA deadlines per team and client.
73546. **SLA Threshold Tuner** — learns optimal warning thresholds per client from their response patterns.
73547. **SLA Compliance Certifier** — produces auditor-ready evidence packs proving SLA compliance per finding.
73548. **SLA Change Approval** — requires lead approval for manual deadline changes with mandatory justification.
73549. **SLA Latency Monitor** — ensures deadline computations complete within 100ms of finding creation.
73550. **SLA Data Retention (triage)** — retains SLA histories per client policy for contract-dispute resolution.
73551. **SLA Formula Documentation** — auto-documents how each deadline was computed for transparency.
73552. **SLA Chaos Testing** — simulates calendar outages and clock skew to verify SLA correctness under failure.
73553. **SLA-Aware Notifications** — batches SLA warnings per analyst to avoid notification fatigue.
73554. **SLA Benchmark Comparisons** — compares a client's SLA attainment against anonymized industry benchmarks.
73555. **Deadline-Driven Escalation Rules** — fires escalations at configurable fractions of elapsed SLA (50%, 75%, 90%) with distinct actions per stage.
73556. **Severity-Jump Escalation** — auto-escalates when a finding's severity is upgraded two or more bands.
73557. **Stale-Finding Escalation** — escalates findings with no activity for N days, where N scales inversely with severity.
73558. **Reopen-Count Escalation** — escalates findings reopened more than twice to a senior analyst with full history.
73559. **Disputed-Verdict Escalation** — escalates to a lead when two analysts disagree on a triage verdict.
73560. **Low-Confidence Escalation** — escalates findings where the ML triage confidence falls below the auto-decision threshold.
73561. **Duplicate-Storm Escalation** — pages the triage lead when a dedup cluster grows past 200 members, signaling a systemic issue.
73562. **SLA-Breach Escalation** — triggers the contractual escalation chain the moment a deadline is breached.
73563. **SLA-At-Risk Escalation** — pre-escalates findings with >80% predicted breach probability before the deadline hits.
73564. **Unassigned-Critical Escalation** — immediately escalates any critical finding that remains unassigned after 15 minutes.
73565. **Unacknowledged Escalation** — escalates when the assignee hasn't acknowledged within the ack SLA.
73566. **Blocked-Finding Escalation** — escalates findings marked blocked for more than 48 hours to remove the blocker.
73567. **High-Priority-Jump Escalation** — escalates when a finding's priority score jumps two bands in a single re-score.
73568. **Threat-Intel Escalation** — escalates findings newly linked to active exploitation campaigns within one hour of intel arrival.
73569. **Zero-Day-Novelty Escalation** — routes novelty-detector hits directly to the research team instead of the normal queue.
73570. **Client-Escalation Requests** — lets clients escalate any finding with one click, starting a tracked escalation workflow.
73571. **Escalation Reason Codes** — enforces structured reason codes on every escalation for analytics.
73572. **Escalation Chain Visualizer** — shows the live escalation path and who's been notified for each escalated finding.
73573. **Escalation Fatigue Guard** — suppresses repeat escalations for the same finding within 24 hours unless severity changed.
73574. **Escalation Acknowledgment Tracking** — tracks whether escalated-to parties acknowledged and re-escalates on silence.
73575. **Escalation SLA Clocks** — starts separate clocks measuring escalation response time per stage.
73576. **Escalation Playbook Attacher** — attaches the relevant escalation playbook to every escalation notification.
73577. **Cross-Team Escalation Router** — routes escalations to the right team (security, engineering, compliance) by finding context.
73578. **Escalation-to-Incident Bridge** — converts escalated critical findings into incident-response tickets with one click.
73579. **Escalation Effectiveness Metrics** — measures whether escalations actually accelerated resolution versus non-escalated peers.
73580. **Escalation Rule Simulator** — dry-runs escalation rules against historical data to preview alert volumes.
73581. **Escalation Rule Versioning** — versions escalation rules so alert behavior is auditable and reproducible.
73582. **Escalation Quiet Hours** — batches non-critical escalations during quiet hours per analyst preferences.
73583. **Escalation Channel Router** — sends escalations via Slack, PagerDuty, SMS, or email based on severity and time of day.
73584. **Escalation Digest Mode** — consolidates multiple escalations into a single digest for leads during incident storms.
73585. **Escalation Override API** — lets authorized leads trigger or cancel escalations programmatically with audit logging.
73586. **Escalation Webhooks** — emits escalation-fired, acknowledged, and resolved events for external automation.
73587. **Escalation Audit Export** — exports the full escalation history per finding for compliance reviews.
73588. **Escalation Cost Tracker** — estimates the analyst-hours consumed by escalations to right-size thresholds.
73589. **Escalation Threshold Auto-Tuner** — adjusts escalation thresholds from historical effectiveness data to reduce noise.
73590. **Escalation Loop Detector** — detects findings bouncing between teams via repeated escalations and assigns a single owner.
73591. **Escalation Context Packets** — bundles finding, SLA, history, and recommended actions into every escalation alert.
73592. **Escalation Response Templates** — provides one-click response templates (accept, reassign, dispute) for escalated findings.
73593. **Escalation Performance Dashboard** — shows escalation volume, response times, and outcomes per team in real time.
73594. **Escalation Policy Compliance** — verifies escalations followed the client's contracted escalation matrix.
73595. **Escalation Simulation Drills** — runs scheduled drills that fire test escalations to verify the chain works end to end.
73596. **Escalation De-Duplication** — merges duplicate escalation alerts for the same finding across channels.
73597. **Escalation Priority Inheritance** — child escalations inherit the parent finding's priority band automatically.
73598. **Escalation Expiry** — auto-resolves escalations when the underlying finding is remediated or the SLA risk clears.
73599. **Escalation Analytics Export** — exports escalation metrics for management reporting and process improvement.
73600. **Escalation Rule Impact Forecast** — predicts alert-volume changes before a new escalation rule goes live.
73601. **Escalation-to-SLA Linkage** — ties every escalation to the specific SLA deadline that triggered it for forensics.
73602. **Escalation Recipient Resolver** — resolves the right human from on-call schedules, skill matrices, and escalation chains dynamically.
73603. **Escalation Feedback Loop** — asks escalation recipients whether the escalation was warranted, tuning future thresholds.
73604. **Escalation Storm Circuit Breaker** — caps escalations per hour during mega-hunts and switches to digest mode automatically.
73605. **Real-Time SLA Attainment Tracker** — computes live SLA attainment percentages per client, team, and severity band from streaming finding events.
73606. **SLA At-Risk Watchlist** — maintains a live list of findings predicted to breach within 48 hours, ranked by breach probability.
73607. **SLA Breach Forecaster** — uses survival analysis on historical resolution times to forecast breaches a week in advance.
73608. **SLA Trend Analyzer** — detects whether attainment is improving or degrading per team using control-chart statistics.
73609. **SLA Attribution Engine** — attributes each breach to assignment delay, triage delay, or remediation delay for targeted fixes.
73610. **SLA Pause Analytics** — tracks how often and why SLA clocks are paused to detect gaming of the metrics.
73611. **SLA Exception Tracker** — monitors approved deadline extensions and their impact on reported attainment.
73612. **SLA Compliance Heatmap (triage)** — renders attainment by asset group and finding class to spot weak spots.
73613. **SLA Peer Benchmarking** — compares each team's attainment against anonymized fleet benchmarks.
73614. **SLA Drill-Down Explorer** — lets leads click from attainment percentage down to the individual findings behind it.
73615. **SLA Alert Fatigue Monitor** — measures warning-to-action ratios to tune alert thresholds and reduce noise.
73616. **SLA Data Quality Checker** — validates that SLA clocks, pauses, and deadlines are consistent, flagging corrupted records.
73617. **SLA Retroactive Corrector** — recomputes historical attainment when SLA matrices are corrected, with a full change log.
73618. **SLA Export Scheduler** — emails weekly SLA reports to client stakeholders automatically in their timezone.
73619. **SLA API for BI Tools** — exposes attainment, at-risk, and breach data as queryable endpoints for custom dashboards.
73620. **SLA Webhook Stream** — streams every SLA state change to external data warehouses in real time.
73621. **SLA Gamified Leaderboard** — ranks teams by attainment with streak tracking to motivate performance.
73622. **SLA Breach Cost Estimator** — estimates contractual credit exposure from current at-risk findings.
73623. **SLA Capacity Correlator** — correlates attainment dips with staffing levels to justify hiring.
73624. **SLA Seasonality Model** — accounts for holiday and release-cycle seasonality in attainment forecasts.
73625. **SLA Audit Trail Exporter** — packages per-finding SLA histories into auditor-ready evidence bundles.
73626. **SLA Threshold Simulator** — shows how changing warning thresholds would have affected past alert volumes.
73627. **SLA Multi-Contract Tracker** — tracks attainment separately for each contract when a client has multiple active agreements.
73628. **SLA Breach Narrative Generator** — auto-drafts breach explanations citing the timeline and contributing factors.
73629. **SLA Recovery Planner** — recommends actions (reassign, expedite, exception) to rescue at-risk findings before breach.
73630. **SLA Performance Alerts** — notifies leads when a team's rolling 7-day attainment drops below target.
73631. **SLA Clock Skew Detector** — detects timezone or clock errors that would corrupt deadline calculations.
73632. **SLA Bulk Recalculator** — recomputes deadlines for thousands of findings after a matrix change in a background job.
73633. **SLA Attainment Confidence** — reports statistical confidence intervals on attainment percentages for small samples.
73634. **SLA-Linked Bonus Tracker** — ties team SLA performance to incentive calculations where contracts allow.
73635. **SLA Incident Correlator** — links SLA breaches to downstream security incidents to quantify business impact.
73636. **SLA Policy Diff Viewer** — shows exactly what changed between SLA policy versions and which findings are affected.
73637. **SLA Onboarding Checklist** — guides new clients through SLA matrix setup with validation at each step.
73638. **SLA Chaos Drills** — periodically injects synthetic at-risk findings to verify tracking and alerting work.
73639. **SLA Data Archiver** — archives detailed SLA event streams after the retention window, keeping aggregates.
73640. **SLA Cross-Region Tracker** — tracks attainment separately per region for clients with regional contracts.
73641. **SLA Breach Clustering** — clusters breaches by pattern (same team, same asset, same week) to find systemic causes.
73642. **SLA Forecast Accuracy** — measures how well breach forecasts matched reality and tunes the model.
73643. **SLA Stakeholder Views** — renders different SLA views for analysts, leads, and executives from the same data.
73644. **SLA API Rate Limiter** — protects the tracking engine from expensive ad-hoc queries during incidents.
73645. **SLA Tracking Health Monitor** — verifies the tracking pipeline itself is current, alerting on ingestion lag.
73646. **SLA Custom Metric Builder** — lets clients define custom SLA-derived metrics (e.g., P95 time-to-triage) without code.
73647. **SLA Breach Auto-Post-Mortem** — generates a post-mortem draft the moment a breach is confirmed.
73648. **SLA Attainment Predictor for Sales** — forecasts achievable SLA targets for prospective clients from fleet data.
73649. **SLA Event Replay** — replays the SLA event stream to reconstruct any historical attainment figure for disputes.
73650. **SLA Tracking Multi-Tenancy** — isolates tracking pipelines per tenant with separate alerting rules.
73651. **SLA Data Lineage** — traces every attainment figure back to the raw finding events that produced it.
73652. **SLA Anomaly Alerts** — flags sudden attainment drops that suggest a process breakdown or data issue.
73653. **SLA Improvement Recommender** — suggests the highest-leverage process changes from breach root-cause patterns.
73654. **SLA Tracking Documentation** — auto-generates docs explaining exactly how each metric is computed.
73655. **Triage Accuracy Scorer** — measures per-analyst triage accuracy against a gold-standard review sample monthly.
73656. **Verdict Consistency Metric** — tracks how often the same analyst gives the same verdict on duplicate findings.
73657. **Severity Grading Accuracy** — compares analyst severity grades against expert-adjudicated samples.
73658. **False-Negative Escape Rate** — estimates the rate at which dismissed findings later prove to be real via reopen and incident data.
73659. **Triage Cycle-Time Metrics** — measures time from finding creation to triage verdict per severity band and analyst.
73660. **Rework Rate Tracker** — tracks how often triage verdicts are overturned on review as a quality signal.
73661. **Analyst Calibration Score** — measures whether an analyst's confidence matches their actual accuracy.
73662. **Triage Throughput Metrics (triage)** — tracks findings triaged per analyst-hour with quality weighting.
73663. **First-Pass Yield** — measures the fraction of findings triaged correctly without rework or escalation.
73664. **Triage Quality Sampling Engine** — selects a stratified random sample of triaged findings for blind expert review weekly.
73665. **Reviewer Agreement Index** — computes inter-reviewer agreement (Cohen's kappa) on the quality sample.
73666. **Triage Defect Taxonomy** — classifies triage errors (wrong class, wrong severity, missed duplicate) for targeted coaching.
73667. **Quality Trend Dashboard** — visualizes accuracy, rework, and cycle-time trends per analyst and team.
73668. **Quality-Weighted Throughput** — ranks analysts by throughput multiplied by accuracy, not raw volume.
73669. **Triage Quality Alerts** — notifies leads when an analyst's rolling accuracy drops below the quality floor.
73670. **Coaching Recommendation Engine** — suggests specific training modules based on an analyst's error taxonomy profile.
73671. **Quality Gate for Auto-Triage** — requires the ML triage accuracy on the gold set to exceed the human baseline before enabling auto-verdicts.
73672. **Blind Review Workflow** — routes quality samples to reviewers without showing the original verdict to avoid bias.
73673. **Triage Quality Benchmarks** — compares team quality metrics against fleet-wide anonymized benchmarks.
73674. **Error-Cluster Analyzer** — finds clusters of similar triage errors indicating a systemic misunderstanding or bad guidance.
73675. **Quality-Adjusted Capacity** — adjusts capacity plans by each analyst's quality-weighted throughput.
73676. **Triage Quality Incentives** — feeds quality scores into performance reviews and incentive calculations.
73677. **New-Hire Quality Ramp Tracker** — tracks how quickly new analysts reach the quality bar with milestone alerts.
73678. **Quality Regression Detector** — alerts when team quality drops after process or tooling changes.
73679. **Triage Quality API** — exposes quality metrics for HR and management dashboards.
73680. **Quality Report Generator** — builds monthly quality reports with trends, benchmarks, and coaching actions.
73681. **Verdict-Explanation Quality** — scores the clarity of analysts' written triage rationales via an LLM judge.
73682. **Severity-Appeal Quality Signal** — treats upheld severity appeals as quality defects for the original grader.
73683. **Duplicate-Handling Quality** — measures precision of manual merge/split decisions against expert review.
73684. **Triage Consistency Heatmap** — shows verdict consistency across analysts for the same finding families.
73685. **Quality-Driven Routing** — routes fewer criticals to analysts with below-floor accuracy until coaching completes.
73686. **Triage Quality SLAs** — sets contractual targets for triage accuracy and rework rates where clients require them.
73687. **Quality Incident Linkage** — links triage errors to downstream incidents to quantify the cost of poor triage.
73688. **Continuous Calibration Sessions** — schedules monthly calibration exercises where analysts triage the same sample and discuss differences.
73689. **Quality Metric Versioning** — versions quality metric definitions so historical comparisons stay valid.
73690. **Triage Quality Export** — exports quality data for client audits and compliance reviews.
73691. **Analyst Self-Review Dashboard** — shows each analyst their own quality trends privately to encourage self-improvement.
73692. **Team Quality Retrospectives** — auto-generates retrospective agendas from the month's quality data.
73693. **Quality-Gated Promotions** — requires sustained quality-bar performance before analysts can triage criticals solo.
73694. **Triage Quality Webhooks** — emits events when quality thresholds are crossed for HR system integration.
73695. **Cross-Team Quality Comparison** — compares quality across teams to spread best practices.
73696. **Quality Sampling Bias Guard** — ensures the review sample represents the true finding mix, not just easy cases.
73697. **Triage Quality Cost Model** — estimates the cost of triage errors (rework hours, incident risk) for ROI discussions.
73698. **Quality Metric Documentation** — documents exactly how each quality metric is computed and its known limits.
73699. **Triage Quality Forecast** — predicts quality trends from hiring plans and workload forecasts.
73700. **Quality-Adjusted SLA Targets** — tightens SLA targets for teams with high quality and relaxes monitoring for struggling ones.
73701. **Triage Error Replay** — lets analysts replay their errors with expert commentary for learning.
73702. **Quality Champion Program** — identifies top-quality analysts and routes mentoring assignments to them.
73703. **Triage Quality Audit Trail** — logs every quality measurement with its sample and methodology for defensibility.
73704. **Quality Metric Anomaly Alerts** — flags sudden quality shifts that may indicate gaming or process breakage.
73705. **Calibrated Triage Confidence** — outputs Platt-scaled confidence for every triage verdict so scores match historical accuracy rates.
73706. **Confidence-Threshold Router (triage)** — routes findings below the auto-decision confidence threshold to human review and auto-processes the rest.
73707. **Per-Client Confidence Tuning** — learns the confidence cutoff that maximizes each client's precision/recall tradeoff from their feedback.
73708. **Confidence Decomposition** — breaks verdict confidence into evidence-strength, model-certainty, and historical-agreement components.
73709. **Low-Confidence Enrichment Trigger** — automatically requests additional probes or context when confidence is low due to missing evidence.
73710. **Confidence Trend Monitor** — tracks average triage confidence over time to detect model degradation or evidence-quality drops.
73711. **Confidence Calibration Curves (triage)** — publishes reliability diagrams per model and severity band for transparency.
73712. **Confidence-Gated Auto-Remediation** — only allows automated fix suggestions when triage confidence exceeds a high bar.
73713. **Confidence-Aware Queue Ordering** — surfaces low-confidence findings earlier in the human review queue.
73714. **Confidence Disagreement Detector** — flags findings where model confidence is high but analyst history suggests caution.
73715. **Confidence Decay on Stale Evidence** — reduces confidence as the underlying evidence ages without re-verification.
73716. **Multi-Model Confidence Fusion** — combines confidences from the classifier, rules engine, and LLM judge into one calibrated score.
73717. **Confidence Explanation Snippets (triage)** — attaches a one-line reason for the confidence level (e.g., "weak evidence: single response sample").
73718. **Confidence Benchmark Suite** — evaluates confidence calibration on a held-out set with known ground truth quarterly.
73719. **Confidence-Aware Sampling** — oversamples low-confidence verdicts in the quality-review sample.
73720. **Confidence Floor Enforcer** — blocks auto-dismissal of any finding below the confidence floor, regardless of verdict.
73721. **Confidence Ceiling for Novelty** — caps confidence on novelty-detector hits so novel findings always get human eyes.
73722. **Confidence History Tracker** — records how confidence evolved as evidence was enriched during triage.
73723. **Confidence API (triage)** — returns calibrated confidence and its components for any finding on demand.
73724. **Confidence Distribution Alerts** — warns when the confidence distribution shifts, indicating input or model problems.
73725. **Confidence-Weighted Voting** — weights ensemble members by their calibrated confidence in the final verdict.
73726. **Confidence Calibration by Analyst** — adjusts for analysts who are systematically over- or under-confident in manual triage.
73727. **Confidence-Aware Notifications** — only notifies stakeholders of verdicts above the notification confidence threshold.
73728. **Confidence Model Retrainer** — recalibrates confidence mappings monthly on fresh outcome data.
73729. **Confidence-Aware Deduplication** — requires higher merge confidence for high-severity clusters.
73730. **Confidence Export (triage)** — includes confidence scores and calibration metadata in all finding exports.
73731. **Confidence-Driven Retriage** — automatically re-triages findings when new evidence raises confidence above the decision threshold.
73732. **Confidence Anomaly Detector** — flags verdicts with suspiciously high confidence on thin evidence for review.
73733. **Confidence-Aware SLA** — gives low-confidence findings tighter internal review deadlines.
73734. **Confidence Threshold Simulator** — previews precision/recall at different cutoffs before changing the auto-decision threshold.
73735. **Confidence Documentation (triage)** — documents the calibration methodology and its limits for auditors.
73736. **Confidence-Aware Assignment** — routes low-confidence findings to senior analysts automatically.
73737. **Confidence Feedback Widget** — lets analysts rate whether the shown confidence felt right, feeding recalibration.
73738. **Confidence Model Versioning** — versions calibration mappings alongside the underlying classifiers.
73739. **Confidence-Aware Escalation** — escalates high-severity findings faster when confidence is also high.
73740. **Confidence Interval Display** — shows verdict confidence as an interval (e.g., 0.72–0.84) rather than a false-precision point.
73741. **Confidence Cross-Check** — compares ML confidence against a rules-based sanity score and flags large gaps.
73742. **Confidence-Aware Archiving** — archives low-confidence dismissed findings with richer context for later review.
73743. **Confidence Trend Forecaster** — predicts confidence distribution shifts from planned model or evidence-pipeline changes.
73744. **Confidence Quality Gates** — blocks model promotion when calibration error exceeds tolerance on the gold set.
73745. **Confidence-Aware Reporting** — marks low-confidence verdicts clearly in client reports with review recommendations.
73746. **Confidence Model Health Score** — rolls calibration error, coverage, and drift into one operational metric.
73747. **Confidence-Aware Webhooks** — includes confidence in triage webhook payloads so integrations can filter on it.
73748. **Confidence Threshold Audit** — logs every threshold change with approver and predicted impact.
73749. **Confidence-Based Auto-Labeling** — promotes high-confidence machine verdicts to training labels automatically.
73750. **Confidence-Aware Priority** — blends triage confidence into the priority score so shaky verdicts don't drive P0 actions.
73751. **Confidence Recalibration Scheduler (triage)** — recalibrates on a schedule driven by label volume rather than calendar time.
73752. **Confidence-Aware Deduplication Explanations** — shows merge confidence alongside every duplicate cluster.
73753. **Confidence Outlier Quarantine** — holds verdicts whose confidence is an outlier for their finding family.
73754. **Confidence-Aware Model Selection** — picks the inference model per finding based on which is best calibrated for that family.
73755. **Immutable Triage Decision Log** — appends every triage verdict to a tamper-evident hash-chained log for compliance.
73756. **Decision Provenance Recorder** — captures the model version, features, rules fired, and analyst identity behind every verdict.
73757. **Verdict Change Timeline** — renders the full history of verdict changes per finding with actors and reasons.
73758. **Audit Log Integrity Verifier** — periodically verifies the hash chain and alerts on any tampering.
73759. **Decision Replay Engine** — replays any historical verdict from its logged inputs to prove reproducibility.
73760. **Analyst Action Tracker** — logs every analyst interaction (view, comment, override, assign) with timestamps.
73761. **Automated-Decision Register** — maintains a registry of all fully automated triage decisions for AI-governance reporting.
73762. **Audit Log Search (triage)** — provides full-text and faceted search over the decision log for investigations.
73763. **Decision Export for Auditors** — packages decision histories into auditor-ready bundles with integrity proofs.
73764. **Retention-Policy Enforcer (triage)** — applies per-client retention rules to audit logs while preserving hash-chain integrity.
73765. **Audit Log Access Controls (triage)** — restricts who can read detailed decision logs, with access events themselves logged.
73766. **Decision Attribution Reports** — shows which decisions were made by ML, rules, or humans per period.
73767. **Override Justification Enforcer** — requires a structured justification for every manual override of an automated verdict.
73768. **Audit Log Anomaly Detector** — flags unusual decision patterns (e.g., mass dismissals) for investigation.
73769. **Cross-System Decision Sync** — mirrors triage decisions to the client's SIEM or GRC with integrity hashes.
73770. **Decision Confidence Archival** — archives the confidence and calibration version with every logged verdict.
73771. **Audit Log Performance** — guarantees log appends complete in under 50ms so they never slow triage.
73772. **Decision Log Compaction** — compacts old log segments while preserving the ability to verify the chain.
73773. **Regulatory Report Builder** — generates AI-decision transparency reports required by emerging regulations.
73774. **Decision Bias Audit** — analyzes the log for systematic bias in automated verdicts across client segments.
73775. **Audit Log Encryption (triage)** — encrypts decision logs at rest with per-tenant keys.
73776. **Decision Log Replication** — replicates the log to a secondary region for disaster recovery.
73777. **Tamper-Evident Export** — exports log segments with Merkle proofs so third parties can verify integrity.
73778. **Decision Latency Logging** — records how long each triage decision took, feeding performance analytics.
73779. **Analyst Session Reconstruction** — reconstructs exactly what an analyst saw when they made a verdict, for dispute resolution.
73780. **Audit Log Sampling for QA** — selects log entries for quality review with cryptographic proof of random selection.
73781. **Decision Schema Versioning** — versions the audit log schema so old entries remain interpretable.
73782. **Log Integrity Dashboard** — shows chain-verification status and log health in real time.
73783. **Decision Correlation IDs** — ties related decisions (finding, duplicate, escalation) with shared correlation IDs.
73784. **Audit Log API (triage)** — exposes queryable endpoints for decision history with pagination and filtering.
73785. **Decision Webhook Feed** — streams every logged decision to external compliance systems in real time.
73786. **Retention Exception Workflow** — handles legal-hold requests that override normal retention deletion.
73787. **Audit Log Cost Optimizer** — tiers log storage (hot/warm/cold) by age to control costs at scale.
73788. **Decision Explainability Archive** — stores the SHAP explanations alongside verdicts for later audit.
73789. **Multi-Tenant Log Isolation** — cryptographically isolates each tenant's decision log.
73790. **Audit Log Chaos Testing** — verifies the log survives node failures without losing or duplicating entries.
73791. **Decision Approval Chains** — logs multi-approver decisions (e.g., severity changes on criticals) as linked entries.
73792. **Audit Log Documentation** — auto-documents the log schema, retention, and verification procedures.
73793. **Decision Time-Travel Queries** — answers "what was the verdict on date X" from the immutable log.
73794. **Log-Based Metric Recomputation** — recomputes any historical metric purely from the log for dispute resolution.
73795. **Decision Notification Log** — records every notification sent about a decision for communication audits.
73796. **Audit Log Access Analytics** — tracks who queries the audit log to detect snooping.
73797. **Decision Integrity Attestations** — generates signed attestations of log integrity for client compliance teams.
73798. **Cross-Border Log Controls** — keeps audit logs in the required jurisdiction per client contract.
73799. **Decision Log Redaction** — redacts PII from log entries on export while preserving decision integrity.
73800. **Audit Log Health Score** — rolls integrity, latency, coverage, and retention compliance into one metric.
73801. **Decision Lineage Graph** — visualizes how one decision led to others (verdict → assignment → escalation).
73802. **Audit Log Bulk Export** — exports millions of log entries efficiently for e-discovery.
73803. **Decision Dispute Workflow** — provides a structured flow for disputing a logged decision with evidence.
73804. **Log-Driven Process Mining** — mines the decision log to discover actual triage workflows versus documented ones.
73805. **Analyst Verdict Feedback Ingestor** — converts every analyst accept/reject/override into labeled training data within minutes.
73806. **Feedback Quality Weighting** — weights feedback by the analyst's historical accuracy so expert corrections count more.
73807. **Delayed-Outcome Feedback** — feeds fix-verification and incident outcomes back as delayed labels for the triage models.
73808. **Client Feedback Portal** — lets clients mark findings as useful or noise, feeding a per-client preference model.
73809. **Feedback Deduplication (triage)** — collapses repeated feedback on duplicate-cluster members into a single cluster-level label.
73810. **Feedback Loop Latency Monitor** — measures time from analyst action to model update and alerts when the loop stalls.
73811. **Active Feedback Solicitation** — proactively asks analysts for labels on the findings the model is most uncertain about.
73812. **Feedback Incentive Tracker** — credits analysts whose feedback most improves model accuracy.
73813. **Feedback Bias Corrector** — adjusts for the fact that analysts review mostly uncertain cases, not a random sample.
73814. **Cross-Client Federated Feedback** — shares model improvements from feedback without sharing the underlying client data.
73815. **Feedback Audit Trail** — logs every feedback event with source and timestamp for training-data provenance.
73816. **Feedback-Driven Threshold Tuning (triage)** — retunes decision thresholds weekly from the latest feedback distribution.
73817. **Negative Feedback Amplifier** — gives extra weight to feedback correcting high-confidence model errors.
73818. **Feedback Coverage Analyzer** — identifies finding families with too little feedback and targets them for labeling.
73819. **Feedback Loop Health Dashboard** — shows feedback volume, latency, quality, and model-impact in one pane.
73820. **Stale Feedback Pruner** — expires feedback older than the configured window so the model tracks current analyst judgment.
73821. **Feedback Conflict Resolver** — adjudicates when two analysts give conflicting feedback on similar findings.
73822. **Implicit Feedback Miner** — mines implicit signals (dwell time, re-opens, escalations) as weak labels alongside explicit feedback.
73823. **Feedback-Driven Feature Discovery** — analyzes corrections to propose new features for the triage models.
73824. **Feedback Loop Circuit Breaker** — pauses online learning when feedback quality drops suddenly, preventing model poisoning.
73825. **Feedback Simulation** — tests how a batch of synthetic feedback would shift model behavior before applying real labels.
73826. **Multi-Task Feedback Router** — routes each feedback event to the classifier, severity model, and dedup tuner it affects.
73827. **Feedback Attribution Reports** — shows which feedback batches drove which model improvements for transparency.
73828. **Feedback Privacy Filter** — strips client-identifying details from feedback before it enters shared training pools.
73829. **Feedback Loop Documentation** — documents the full feedback lifecycle for ML governance reviews.
73830. **Feedback-Driven Model Cards** — updates model cards automatically with feedback-derived performance deltas.
73831. **Analyst Feedback Fatigue Guard** — limits active-learning prompts per analyst per day to avoid burnout.
73832. **Feedback Quality Sampling** — expert-reviews a sample of feedback labels to estimate label noise.
73833. **Feedback Loop Versioning** — versions the feedback pipeline so training runs are reproducible.
73834. **Real-Time Feedback Streaming** — streams feedback events to the online learner with sub-minute latency.
73835. **Feedback-Driven Alert Tuning** — uses feedback on escalations to tune escalation thresholds automatically.
73836. **Feedback Export for Research** — exports anonymized feedback datasets for internal ML research with privacy guarantees.
73837. **Feedback Loop Cost Tracker** — tracks the analyst-time cost of labeling versus the accuracy gains.
73838. **Feedback Consensus Builder** — requires two-analyst agreement before high-impact feedback enters training.
73839. **Feedback-Driven Rule Suggestions** — proposes new triage rules from clusters of similar analyst corrections.
73840. **Feedback Loop Anomaly Alerts** — flags sudden feedback spikes that may indicate a bad model deployment.
73841. **Long-Term Outcome Linker** — links triage feedback to 6-month incident outcomes to measure true feedback value.
73842. **Feedback-Driven Calibration** — uses agree/disagree micro-surveys to recalibrate confidence mappings.
73843. **Feedback Segmentation** — analyzes feedback separately per client, team, and finding family to avoid Simpson's paradox.
73844. **Feedback Loop Rollback** — reverts model updates derived from a bad feedback batch with one click.
73845. **Feedback-Driven Documentation** — turns common corrections into triage guidance docs automatically.
73846. **Feedback API (triage)** — lets external tools submit labeled outcomes programmatically.
73847. **Feedback Webhooks (triage)** — notifies ML pipelines the moment high-value feedback arrives.
73848. **Feedback-Driven Prioritization** — prioritizes labeling effort on the finding families with the highest error cost.
73849. **Feedback Loop SLA** — guarantees feedback is reflected in model behavior within the agreed window.
73850. **Feedback Effectiveness Score** — measures how much each feedback source improves gold-set accuracy.
73851. **Feedback-Driven Chaos Testing** — injects adversarial feedback in staging to verify the circuit breaker catches poisoning.
73852. **Feedback Retention Policy** — retains raw feedback per client policy while keeping aggregated learning signals.
73853. **Feedback Loop Multi-Tenancy** — isolates per-tenant feedback loops with separate models and thresholds.
73854. **Feedback-Driven UI Hints** — surfaces "analysts like you usually…" hints learned from feedback patterns.
73855. **Triage Dry-Run Sandbox** — replays historical findings through proposed triage changes without affecting production.
73856. **Rule-Change Impact Simulator** — predicts verdict, routing, and SLA effects of a rule change before deployment.
73857. **What-If Severity Simulator** — shows how re-grading one finding would cascade through priority, SLA, and assignment.
73858. **Threshold Sensitivity Analyzer (triage)** — sweeps decision thresholds and plots precision/recall/SLA tradeoffs.
73859. **Backlog Replay Engine** — replays the current backlog through a candidate pipeline to preview the new queue order.
73860. **Simulation Scenario Library** — provides prebuilt scenarios (zero-day surge, mega-hunt, staff shortage) for stress-testing triage.
73861. **Monte Carlo Triage Simulator** — runs thousands of randomized simulations to estimate SLA attainment under uncertainty.
73862. **Capacity What-If Planner** — simulates "what if we add two analysts" on historical load to justify hiring.
73863. **Escalation Storm Simulator** — models alert volumes from proposed escalation rules during worst-case hunt loads.
73864. **Dedup Rule Dry-Run** — previews exactly which findings would merge under new dedup rules.
73865. **Routing Simulation (triage)** — previews assignment distribution and fairness under proposed routing rules.
73866. **Priority Formula Sandbox** — lets analysts tweak priority weights and see the backlog reorder live.
73867. **SLA Matrix Simulator** — shows attainment impact of proposed SLA changes on historical data.
73868. **Model Swap Simulator** — compares champion vs challenger verdicts on the live backlog side by side.
73869. **Simulation Approval Workflow** — requires lead sign-off on simulation results before production deployment of changes.
73870. **Simulation Result Archival** — stores simulation inputs, outputs, and approvals for audit.
73871. **Confidence-Threshold Simulator** — previews auto-vs-manual volumes at different confidence cutoffs.
73872. **Feedback Injection Simulator** — models how a batch of labels would shift classifier behavior.
73873. **Cost-Benefit Simulator** — estimates analyst-hour savings versus quality risk for automation proposals.
73874. **Breach-Risk Simulator** — estimates how triage changes affect the probability of missing a real vulnerability.
73875. **Simulation Diff Viewer** — highlights exactly which findings change verdict under the simulated configuration.
73876. **Scheduled Simulation Runs** — runs the full simulation suite nightly and alerts on unexpected drift.
73877. **Simulation API** — exposes dry-run endpoints so CI pipelines can validate triage config changes.
73878. **Simulation Data Snapshots** — freezes the finding snapshot used in each simulation for reproducibility.
73879. **Multi-Scenario Comparator** — compares up to five candidate configurations side by side on the same data.
73880. **Simulation Performance Profiler** — ensures full-backlog simulations complete within the allotted compute budget.
73881. **Analyst-in-the-Loop Simulation** — lets analysts triage a simulated queue to validate UX changes.
73882. **Simulation Guardrails** — blocks simulations from accidentally writing to production queues or sending notifications.
73883. **Historical Incident Replay** — replays past incidents through the current pipeline to verify they'd be caught today.
73884. **Simulation Explainability** — explains why the simulation predicts each outcome, not just the numbers.
73885. **Load-Test Simulator** — simulates 10x finding volume to verify triage pipeline throughput.
73886. **Failover Simulator** — simulates router or model outages to verify fallback chains.
73887. **Simulation Result Sharing (triage)** — generates shareable simulation reports with interactive charts for stakeholders.
73888. **Canary Simulation** — runs the candidate config on 5% of live findings in shadow mode before full simulation sign-off.
73889. **Simulation Bias Checks** — verifies simulations don't systematically favor the proposed change.
73890. **Time-Travel Simulation** — runs "what would triage have done last quarter" for retrospective analysis.
73891. **Simulation-to-Production Promoter** — promotes a validated simulation config to production with one click and full audit.
73892. **Rollback Simulator** — previews the effect of rolling back a triage change before doing it.
73893. **Simulation Coverage Metrics (triage)** — measures what fraction of triage config changes go through simulation first.
73894. **Adversarial Simulation** — feeds worst-case finding mixes to verify the pipeline can't be gamed.
73895. **Simulation Cost Tracker** — tracks compute spend on simulations to keep experimentation economical.
73896. **Multi-Tenant Simulation Isolation** — ensures simulations for one client never touch another's data.
73897. **Simulation Result Versioning** — versions simulation outputs alongside the config that produced them.
73898. **Continuous Simulation Pipeline** — runs simulations on every triage-config pull request automatically.
73899. **Simulation Alerting** — alerts when a simulation predicts SLA degradation beyond tolerance.
73900. **Simulation Documentation Generator** — auto-documents each simulation's purpose, inputs, and conclusions.
73901. **Analyst Workload Simulator** — models per-analyst queue depths under proposed routing changes.
73902. **Notification Volume Simulator** — predicts alert and notification volumes from config changes to prevent fatigue.
73903. **Simulation Replay for Disputes** — replays the exact simulation that justified a change during post-incident reviews.
73904. **Triage Digital Twin** — maintains a live digital twin of the triage pipeline for continuous what-if experimentation.
73905. **Triage Rule Git Versioning** — stores every triage rule as versioned code in Git with pull-request review and rollback.
73906. **Rule Diff Viewer** — renders human-readable diffs between rule versions with predicted impact summaries.
73907. **Rule Rollback Switch** — reverts to any prior rule version instantly with full audit logging.
73908. **Rule Change Approval Chain** — requires security-lead approval for rule changes affecting auto-dismiss behavior.
73909. **Rule Effective Dating** — schedules rule versions to activate at a future date for coordinated rollouts.
73910. **Rule Deprecation Workflow** — marks old rules deprecated with migration guidance before removal.
73911. **Rule Test Suite** — runs every rule against a regression corpus of findings on each change.
73912. **Rule Coverage Analyzer** — shows which finding families each rule covers and where coverage gaps exist.
73913. **Rule Conflict Detector (triage)** — statically detects rules that contradict each other before deployment.
73914. **Rule Performance Attribution** — attributes precision/recall changes to specific rule edits.
73915. **Rule Documentation Generator** — auto-generates plain-English docs for each rule from its logic.
73916. **Rule Sandbox Testing** — tests new rules against production-like data without touching live findings.
73917. **Rule Version Pinning per Client** — lets regulated clients pin rule versions for audit reproducibility.
73918. **Rule Change Notifications** — notifies affected teams when rules governing their findings change.
73919. **Rule Audit Export** — exports the full rule history with approvals for compliance reviews.
73920. **Executive Triage Command Dashboard** — gives CISOs a single pane with backlog health, SLA attainment, and top risks.
73921. **Real-Time Triage Operations Board** — shows live queue depths, analyst status, and SLA clocks for triage leads.
73922. **Analyst Personal Dashboard** — shows each analyst their queue, SLA deadlines, quality scores, and feedback.
73923. **Client Triage Portal Dashboard** — gives clients a live view of their findings moving through triage stages.
73924. **ML Model Performance Dashboard** — tracks classifier precision, recall, calibration, and drift per model version.
73925. **Dedup Effectiveness Dashboard** — visualizes merge volumes, undo rates, and cluster sizes in real time.
73926. **Routing Fairness Dashboard** — shows assignment distribution, load balance, and ack times across analysts.
73927. **Escalation Analytics Dashboard** — tracks escalation volumes, response times, and effectiveness per team.
73928. **Feedback Loop Dashboard** — visualizes feedback volume, latency, and model-impact metrics.
73929. **Simulation Results Dashboard** — presents dry-run outcomes with diffs and approval actions.
73930. **Audit & Compliance Dashboard** — surfaces decision-log integrity, retention compliance, and export readiness.
73931. **Dashboard Custom Widget Builder** — lets users compose custom triage dashboards from 60+ metric widgets without code.
73932. **Dashboard TV Mode (triage)** — renders a wall-board view of triage operations for security operations centers.
73933. **Mobile Triage Dashboard** — provides a responsive executive summary optimized for phones.
73934. **Dashboard Alerting** — lets users set thresholds on any dashboard metric with multi-channel alerts.
73935. **Dashboard Snapshots** — captures point-in-time dashboard states for QBRs and incident reviews.
73936. **Cross-Client Fleet Dashboard** — gives MSSP operators a fleet-wide triage health view with tenant drill-down.
73937. **Dashboard Access Controls** — enforces row-level security so clients only see their own data.
73938. **Dashboard Export to PDF** — renders any dashboard as a presentation-ready PDF with one click.
73939. **Dashboard Embed API** — embeds live triage widgets into client portals via signed iframes.
73940. **Queue Bottleneck Detector** — identifies triage stages where findings pile up using queueing-theory thresholds.
73941. **Analyst Bottleneck Profiler** — pinpoints which analysts or teams are the constraint via throughput analysis.
73942. **Stage Dwell-Time Analyzer** — measures median dwell time per triage stage to find slow handoffs.
73943. **Bottleneck Root-Cause Classifier** — classifies bottlenecks as staffing, skill-gap, tooling, or process issues.
73944. **Bottleneck Forecast** — predicts where the next bottleneck will form from hunt schedules and staffing.
73945. **Bottleneck Alerting** — pages leads when queue depth exceeds the bottleneck threshold for a stage.
73946. **Bottleneck Resolution Playbooks** — attaches step-by-step playbooks (rebalance, expedite, hire-temp) to bottleneck alerts.
73947. **Bottleneck Impact Quantifier** — estimates SLA breaches attributable to each bottleneck for prioritization.
73948. **Historical Bottleneck Replay** — replays past bottleneck events to validate detection thresholds.
73949. **Bottleneck Trend Reports** — shows bottleneck frequency and duration trends per team monthly.
73950. **Cross-Stage Flow Visualizer** — renders the triage pipeline as a Sankey diagram showing flow and drop-off.
73951. **Bottleneck Simulation** — models the effect of adding capacity at the bottleneck stage before hiring.
73952. **Skill Bottleneck Detector** — flags vuln classes queuing because no qualified analyst is available.
73953. **Tooling Bottleneck Monitor** — detects when slow evidence enrichment or model inference blocks triage flow.
73954. **Bottleneck Auto-Mitigation** — automatically triggers overflow routing when a bottleneck is detected.
73955. **Dynamic Triage Load Balancer** — redistributes findings across analysts hourly based on live queue depths and velocities.
73956. **Skill-Constrained Load Balancing** — balances load while respecting skill-match constraints so quality doesn't drop.
73957. **SLA-Weighted Load Balancer** — gives overloaded analysts' at-risk findings priority in rebalancing.
73958. **Load Balance Fairness Index** — computes a Jain's fairness index over analyst loads and alerts on imbalance.
73959. **Predictive Load Balancer** — forecasts tomorrow's load per analyst from hunt schedules and pre-balances.
73960. **Load Balancer Dry-Run** — previews rebalancing moves before applying them, with lead approval for large moves.
73961. **Cross-Team Load Sharing** — enables temporary cross-team balancing during surge events with skill guards.
73962. **Load Balancer Audit Log** — records every automated rebalance with reason and impact.
73963. **Load Balancing Circuit Breaker** — stops rebalancing when moves exceed the churn threshold to avoid thrash.
73964. **Analyst Preference-Aware Balancing** — respects analyst preferences and quiet hours during rebalancing.
73965. **Load Balance Health Score** — rolls fairness, SLA risk, and churn into one operational metric.
73966. **Triage Findings API** — full CRUD plus verdict, assignment, and SLA operations on findings via REST.
73967. **Triage Bulk Operations API** — bulk verdict, assign, escalate, and merge endpoints handling 10k items per call.
73968. **Triage Search API** — faceted full-text search over findings with dedup-aware result collapsing.
73969. **Triage Scoring API** — on-demand endpoints for priority, severity, and confidence scoring.
73970. **Triage Simulation API** — dry-run endpoints for rules, routing, thresholds, and formulas.
73971. **Triage Feedback API** — programmatic submission of labels, appeals, and quality ratings.
73972. **Triage Audit API** — queryable decision-log endpoints with integrity proofs.
73973. **Triage Metrics API** — exposes SLA, quality, bottleneck, and throughput metrics for BI tools.
73974. **Triage Config API** — versioned management of rules, thresholds, SLA matrices, and routing policies.
73975. **Triage Webhook Management API** — subscribe, filter, replay, and test webhook subscriptions programmatically.
73976. **Finding Lifecycle Webhooks** — emits created, triaged, assigned, escalated, remediated, and verified events.
73977. **Verdict Webhooks** — emits every triage verdict with confidence and explanation payload.
73978. **Severity Change Webhooks** — emits severity re-grades with old/new values and reason codes.
73979. **SLA Webhooks (triage)** — emits deadline-set, warning, breached, paused, resumed, and exception events.
73980. **Dedup Webhooks** — emits finding-merged, cluster-split, and canonical-changed events.
73981. **Assignment Webhooks** — emits assigned, reassigned, acknowledged, and escalation-chain events.
73982. **Quality Webhooks** — emits quality-threshold breaches and calibration-drift alerts.
73983. **Model Webhooks** — emits model-deployed, canary-started, and rollback events for MLOps integration.
73984. **Simulation Webhooks** — emits simulation-completed events with result summaries and approval links.
73985. **Webhook Delivery Guarantees** — provides at-least-once delivery with retries, dead-letter queues, and replay.
73986. **Webhook Signature Verification (triage)** — signs every payload with HMAC so receivers can verify authenticity.
73987. **SARIF Triage Export** — exports triaged findings in SARIF 2.1.0 with verdict and severity extensions.
73988. **CSV Triage Export** — exports flattened finding data with configurable columns for spreadsheet analysis.
73989. **JSONL Streaming Export** — streams large finding exports as JSONL for data-warehouse ingestion.
73990. **PDF Triage Report Export** — generates branded PDF reports with verdicts, evidence, and SLA summaries.
73991. **Jira-Ready Export (triage)** — exports findings pre-mapped to Jira issue fields with labels and components.
73992. **ServiceNow Export** — exports in ServiceNow SecOps-compatible format with assignment mapping.
73993. **DefectDojo Import Export** — produces DefectDojo-compatible JSON for teams using it as their vuln manager.
73994. **Executive Summary Export** — generates CISO-ready summaries with risk posture and trend charts.
73995. **Audit Bundle Export** — packages findings, decisions, SLA histories, and integrity proofs into one tamper-evident archive.
73996. **Scheduled Export Jobs** — runs recurring exports (daily CSV, weekly PDF) delivered to S3, email, or SFTP.
73997. **Export Template Builder** — lets clients design custom export layouts with drag-and-drop fields.
73998. **Export Access Logging (triage)** — logs every export with requester, filters, and row counts for data-governance.
73999. **Incremental Delta Exports** — exports only findings changed since the last export using cursor-based pagination.
74000. **Export Format Versioning** — versions export schemas so downstream parsers don't break on changes.
74001. **Triage Config Export/Import** — moves rules, thresholds, and SLA matrices between environments as versioned bundles.
74002. **Model Artifact Export** — exports trained triage models with model cards for air-gapped deployments.
74003. **Feedback Dataset Export** — exports anonymized labeled datasets for client ML teams with privacy guarantees.
74004. **Triage Analytics Data Mart** — publishes a curated star-schema data mart (findings, verdicts, SLA, quality) for enterprise BI.
