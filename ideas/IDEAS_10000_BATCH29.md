# Dark-Matter IDEAS — Batch 29: MCP Tools, Synthetic-Media Defense, Connected Vehicles, Aviation, Telecom/5G, Dispatch, Data Pipelines, Backup/DR, Shadow-AI Governance & A2A Agent Trust (118005–119004)

> 1,000 ideas 118005–119004, generated 2026-10-07.
> Professional English. Defensive/product framing.

Batch 29 explores ten fresh product-surface frontiers: mcp & agentic-tool-server security surfaces (Model Context Protocol and agent tool-server defenses on authorized targets (tool-registry governance, capability-advertisement audits, tool-call authorization, context exfiltration-path mapping, agent-credential scoping)), deepfake & synthetic-media defense platforms (media-provenance and synthetic-media defense testing on authorized targets (C2PA chain validation, detection-API evasion-resistance grading, liveness-system review, synthetic-voice enrollment defenses, watermark robustness)), connected-vehicle & automotive platform security (vehicle-cloud and fleet-platform security testing on authorized targets (telematics-API scoping, OTA manifest verification, VIN binding review, remote-command authorization, fleet tenant isolation)), aviation & airport digital-platform security (airline and airport digital-platform security testing on authorized targets (booking-API integrity, PNR access scoping, crew-portal authorization, baggage-tracking privacy, loyalty-fraud surfaces)), telecom & 5g-core platform security (carrier platform and network-API security testing on authorized targets (eSIM provisioning authorization, CAMARA scope auditing, billing integrity, port-out fraud surfaces, SIM-swap workflow verification)), emergency-services & dispatch-platform security (dispatch and public-alert platform security testing on authorized targets (CAD access control, CAP signature verification, dispatch-queue integrity, responder-app session security, mass-notification rate integrity)), data-pipeline, lakehouse & streaming-platform security (data-engineering platform security testing on authorized targets (pipeline-credential vaulting, lakehouse ACL drift, streaming topic ACL inventory, row-level-security testing, lineage-tamper detection)), backup, disaster-recovery & ransomware-readiness platforms (backup and recovery-integrity testing on authorized targets (immutability policy verification, vault-lock compliance, restore-access workflows, RTO drift tracking, ransomware-playbook simulation scoring)), shadow-ai & model-registry governance (unsanctioned-AI discovery and model-governance testing on authorized targets (shadow-AI key discovery, registry completeness auditing, inference-endpoint inventory, prompt-version lineage, eval-gate enforcement)), a2a agent-protocol & multi-agent trust surfaces (agent-to-agent protocol and swarm-trust testing on authorized targets (agent-card signature verification, delegation authorization mapping, inter-agent credential scoping, impersonation detection, protocol-version downgrade review)) — each framed as defensive capabilities of an authorized bug-bounty agent.

| # | Category | Ideas |
|---|----------|-------|
| 1 | MCP & agentic-tool-server security surfaces | 118005–118104 |
| 2 | Deepfake & synthetic-media defense platforms | 118105–118204 |
| 3 | Connected-vehicle & automotive platform security | 118205–118304 |
| 4 | Aviation & airport digital-platform security | 118305–118404 |
| 5 | Telecom & 5G-core platform security | 118405–118504 |
| 6 | Emergency-services & dispatch-platform security | 118505–118604 |
| 7 | Data-pipeline, lakehouse & streaming-platform security | 118605–118704 |
| 8 | Backup, disaster-recovery & ransomware-readiness platforms | 118705–118804 |
| 9 | Shadow-AI & model-registry governance | 118805–118904 |
| 10 | A2A agent-protocol & multi-agent trust surfaces | 118905–119004 |

118005. **MCP server capability advertisement auditor** — enumerate every tool, resource, and prompt an MCP server advertises at connection time so the authorized reviewer sees the full claimed capability surface before any tool is granted trust.
118006. **Tool-description schema inventory builder** — crawl the registry and compile a canonical index of tool names, descriptions, and argument schemas so missing, stale, or undocumented entries stand out for follow-up.
118007. **Tool-schema permission mapping engine** — map each tool's declared parameters and effects to the privileges it implies (read, write, delete, external calls) so over-broad schemas are flagged before agents adopt them.
118008. **Tool registry server census** — discover every MCP server registered under the target organization across registries and config files so shadow or forgotten servers cannot operate unreviewed.
118009. **Registry squatting detector for tool servers** — compare registered server names and tool names against the organization's official list to catch typosquats and impersonator servers targeting agent users.
118010. **OAuth on-behalf-of token scoping reviewer** — verify that tokens minted for agent tool calls carry only the scopes the specific tool needs, since a broad user token flowing through a tool is a privilege-expansion path.
118011. **Tool-call approval UX evaluator** — review how agents present tool calls for human confirmation, flagging interfaces that bury the action, arguments, or risk in ways users approve blindly.
118012. **Server-side tool versioning policy checker** — confirm tool servers advertise explicit versions and changelogs so agents and reviewers can distinguish a benign update from a silently swapped tool.
118013. **Tool-description injection surface reviewer** — scan tool descriptions and schemas for text designed to steer model behavior outside the tool's declared function, which the agent should surface for rewrite.
118014. **MCP transport hardening reviewer** — compare each server's transport (streamable HTTP, SSE, stdio) against expected security controls such as TLS, origin checks, and authentication so weaker transports are flagged.
118015. **Context-window exfiltration path mapper** — trace which tool results and resources flow into the agent's context window so reviewers can see where sensitive data could leave via subsequent tool calls.
118016. **Prompt-visible tool inventory differ** — diff the tools the model actually sees in its prompt against the registry's official list, catching hidden or shadow tools injected at the client layer.
118017. **Tool privilege escalation chaining analyzer** — chain benign-looking tools together (read token store, call privileged action) to show where individually safe tools compose into an escalation path.
118018. **Tool-to-tool data flow mapper** — track outputs of one tool that become inputs of another so reviewers can spot unguarded handoffs of credentials, tokens, or PII between tools.
118019. **Tool result sandbox escape surface reviewer** — examine how agent sandboxes handle tool outputs such as HTML, markdown, and code for paths that could break out of the intended render boundary.
118020. **Malicious tool update detector** — monitor registered tools for description or behavior changes after initial approval, since a trusted tool that updates silently is a supply-chain risk.
118021. **Tool schema drift watcher** — periodically re-fetch tool schemas and alert on added parameters or widened descriptions that expand capability without a review step.
118022. **Per-call credential handle scoping checker** — verify each tool invocation receives a short-lived, narrowly scoped credential handle rather than a reusable secret that outlives the call.
118023. **MCP authentication mode coverage reviewer** — inventory which servers rely on OAuth, API keys, or no authentication at all so unauthenticated tool endpoints are identified and remediated.
118024. **Tool namespace collision detector** — flag tools from different servers that share names or near-identical names so an agent cannot confuse a malicious duplicate for the trusted tool.
118025. **RAG datastore connector scoping reviewer** — check that data-store tools expose only the authorized collections and that query parameters cannot escape into unrelated indexes.
118026. **Agent-visible data store access mapper** — map every file, table, or document an agent can reach through tool-exposed resources so over-exposed data stores are pruned.
118027. **Tool output disclosure mapper** — analyze real tool results for PII, secrets, or internal identifiers the agent would otherwise forward onward without filtering.
118028. **Tool invocation governance reviewer** — confirm rate limits, quotas, and cost controls exist on expensive or destructive tools so a runaway agent cannot burn budget or hammer services.
118029. **Server-side tool logging completeness checker** — verify every tool call is logged with identity, arguments, and result metadata so incident response has a full audit trail.
118030. **MCP resource ACL reviewer** — audit the access controls on MCP resources (files, blobs, URI templates) so resources marked shareable are not reachable beyond their intended audience.
118031. **Prompt-level tool instruction override detector** — look for tool descriptions containing directives that override system-level safety instructions, which the agent should report for policy review.
118032. **Rogue server discovery in enterprise registries** — scan configuration endpoints and discovery documents for MCP servers not present in the approved registry so unauthorized additions are investigated.
118033. **Tool manifest signature verifier** — check that published tool manifests carry verifiable signatures from a trusted publisher so unsigned or tampered manifests are rejected by policy.
118034. **Multi-server tool federation trust reviewer** — assess how a gateway combines tools from multiple servers, flagging cases where a low-trust server's tools inherit the gateway's high-trust reputation.
118035. **MCP OAuth metadata document auditor** — fetch each server's OAuth discovery document and verify issuer, endpoints, and signing keys match the organization's identity provider configuration.
118036. **Tool-call replay resistance reviewer** — test whether captured tool invocations can be replayed with fresh sessions so missing nonce or binding checks become concrete findings.
118037. **Session binding checker for tool calls** — confirm tool calls are bound to the originating agent session so a stolen token cannot drive tools from a different context.
118038. **Tool input validation contract reviewer** — compare declared schema constraints against actual server enforcement so missing server-side validation of tool arguments is found before abuse.
118039. **Tool error-message disclosure reviewer** — review tool error responses for stack traces, internal paths, or credential hints that leak internals back into the agent's context.
118040. **Hidden tool discovery sweep** — probe server endpoints for tools omitted from the advertised schema so undocumented capabilities are brought into the review scope.
118041. **Tool fallback degradation reviewer** — check what happens when a primary tool fails or a server is unreachable so insecure fallbacks or silent skips are identified.
118042. **Policy enforcement coverage mapper for tool calls** — map every tool call path against the organization's policy engine so calls that bypass approval, logging, or allow-listing are flagged.
118043. **Tool sandbox resource limit reviewer** — verify tools executing code or queries run under CPU, memory, and time limits so a crafted call cannot exhaust the host.
118044. **Tool server dependency vulnerability inventory** — collect the software bill of materials for each MCP server so known-vulnerable dependencies behind tool endpoints are prioritized for patching.
118045. **Recursive tool-use depth limit reviewer** — confirm agents enforce a maximum tool-call chain depth so a looping or self-referential tool cannot spin indefinitely.
118046. **Cross-server tool impersonation detector** — compare tool signatures across servers to find a lower-trust server advertising the exact identity of a trusted tool.
118047. **Tool-call consent ledger reviewer** — verify a tamper-evident record exists of every user-approved tool action so approvals can be audited after the fact.
118048. **Dynamic tool discovery risk reviewer** — assess servers that add tools at runtime without re-approval so the live tool set cannot drift beyond the reviewed inventory.
118049. **Tool-server TLS posture reviewer** — scan each MCP HTTP endpoint for protocol versions, cipher strength, and certificate validity so weak transport security is remediated.
118050. **MCP session state confusion reviewer** — test concurrent sessions against a server to find state leakage between users, such as cached credentials or shared working directories.
118051. **Tool description bloat analyzer** — measure how much context each tool's description consumes so excessively long or redundant descriptions that crowd out the user's task are trimmed.
118052. **Tool parameter coercion behavior checker** — test endpoints where a parameter accepts multiple types to find coercion behavior that bypasses declared validation.
118053. **Sensitive tool gating checker** — confirm write, delete, and external-communication tools require explicit approval while pure read tools do not, matching the organization's risk tiers.
118054. **Tool usage anomaly telemetry designer** — define baseline patterns for normal tool invocation so spikes, off-hours use, or unusual argument shapes trigger alerts.
118055. **Tool server update cadence tracker** — record release frequency and patch history per server so stale, unmaintained servers earn a higher review priority.
118056. **Deprecated tool sunset tracker** — watch deprecated tools for continued registration or invocation so retired capabilities are actually removed rather than lingering.
118057. **Deprecation versus live-schema differ** — compare the announced deprecation list against live schemas so tools declared retired but still callable are called out.
118058. **Tool server vendor risk scorer** — score each server's operator on maintenance, disclosure history, and dependency hygiene so procurement and trust decisions have data.
118059. **MCP client allow-list enforcement reviewer** — verify servers only accept connections from approved clients so rogue clients cannot register against production tool servers.
118060. **Tool-call origin attestation reviewer** — check whether servers record which client and user originated each call so forged or ambiguous origins become visible in audits.
118061. **Multi-tenant tool registry isolation reviewer** — test that one tenant's servers, tools, and credentials are invisible to other tenants on a shared registry.
118062. **Tool-result caching disclosure reviewer** — examine cached tool results for cross-user or cross-session visibility so one user's data cannot surface in another's tool call.
118063. **Agent memory tool poisoning reviewer** — assess whether stored tool outputs or conversation memory can be manipulated to influence future tool choices by the agent.
118064. **MCP sampling abuse surface reviewer** — review servers that request the client to run model completions on their behalf so unmetered or exfiltrative sampling requests are capped.
118065. **Client roots boundary reviewer** — check which filesystem paths a client exposes as MCP roots so a compromised server cannot wander beyond the intended directories.
118066. **Elicitation request phishing reviewer** — review server-initiated requests for user input (elicitation) so prompts that mimic login or payment flows are flagged as social-engineering surface.
118067. **Progress notification data exposure reviewer** — inspect progress and notification payloads for sensitive data streamed before a tool call completes, which may bypass result filtering.
118068. **Tool-call timeout abuse reviewer** — verify timeouts and cancellation are enforced server-side so a hung tool cannot hold agent sessions or resources hostage.
118069. **Server-sent tool template reviewer** — audit templates the server provides for rendering tool results so template directives cannot pull in unauthorized data or scripts.
118070. **MCP notification subscription enumerator** — list which clients subscribe to which server notifications so unexpected subscribers to sensitive event streams are investigated.
118071. **Tool-server DNS takeover reviewer** — check DNS records for MCP server hostnames so dangling or expired records that could be claimed by attackers are reclaimed.
118072. **Tool-server subdomain shadowing detector** — compare server hostnames against the organization's domain inventory to find lookalike subdomains hosting unofficial tool servers.
118073. **OAuth scope creep reviewer for agent tools** — track the scopes requested by tool servers over time so gradual permission growth beyond the original approval is rolled back.
118074. **Refresh-token lifecycle reviewer for agent sessions** — verify refresh tokens used by long-running agents rotate, expire, and are revoked cleanly so stale tokens cannot persist indefinitely.
118075. **Tool-call data residency reviewer** — map where tool servers process and store call data so regulated workloads stay inside the required geographic boundaries.
118076. **MCP server log retention hygiene checker** — confirm tool-call logs have defined retention and secure deletion so sensitive arguments do not accumulate forever in plaintext logs.
118077. **Tool invocation correlation ID reviewer** — verify each tool call carries a traceable correlation ID from agent to server so multi-hop investigations reconstruct the full chain.
118078. **Agent tool audit export format reviewer** — check that audit exports are complete, machine-readable, and tamper-evident so compliance teams can actually use them.
118079. **Tool registry publishing permission reviewer** — audit who can publish or modify servers and tools in the registry so unauthorized publishers cannot inject trojaned tools.
118080. **Staging versus production registry separator** — confirm staging servers and tools cannot leak into the production registry where real agents would consume them.
118081. **Tool-server origin policy reviewer** — check CORS and origin allow-lists on MCP HTTP endpoints so browser-based agents are not exposed to cross-origin tool abuse.
118082. **MCP HTTP endpoint fingerprinter** — fingerprint server software and versions from response headers and behaviors so unpatched servers are identified without credentials.
118083. **Tool-server banner disclosure reviewer** — review server banners and error pages for version strings and internal hostnames that aid targeted attacks.
118084. **Unauthenticated tool endpoint enumerator** — probe the server's surface for tool endpoints reachable without authentication so accidental exposure is closed.
118085. **Tool-schema example payload leakage reviewer** — inspect example values embedded in tool schemas for real credentials, internal URLs, or customer data left in by developers.
118086. **Default tool credential scanner** — test whether tool servers or their backends still use vendor-default credentials on admin or management interfaces.
118087. **MCP server liveness probe exposure checker** — verify health and readiness endpoints disclose only status, not configuration, dependency details, or environment variables.
118088. **Tool-server metrics endpoint disclosure reviewer** — check metrics and debug endpoints for labels or values that expose tenant names, secrets, or internal topology.
118089. **Tool policy exception workflow reviewer** — assess the process for granting tool-use exceptions so temporary approvals expire and do not become permanent bypasses.
118090. **Emergency tool kill-switch designer** — define a one-action mechanism to disable a compromised tool across the fleet so incident response can cut access in seconds.
118091. **Tool-call reversibility mapper** — classify each tool by whether its effects can be undone so destructive, irreversible actions get stronger approval requirements.
118092. **Destructive tool blast-radius classifier** — rank tools by the scope of damage a misuse could cause so the riskiest tools sit behind the tightest controls.
118093. **Read-only tool designation reviewer** — verify tools labeled read-only perform no state changes under any argument combination so the designation is trustworthy.
118094. **Tool-server backup posture reviewer** — check that tool server configurations and registries are backed up and restorable so a compromise or outage does not lose the trust configuration.
118095. **MCP server secret storage reviewer** — verify server-side secrets (API keys, signing keys) live in a proper secret manager rather than config files or environment dumps.
118096. **Tool description localization consistency reviewer** — compare tool descriptions across locales so a translated description does not silently grant broader capability than the reviewed original.
118097. **Untrusted-context tool invocation reviewer** — assess whether tool calls triggered from untrusted conversation content (pasted text, web pages) get extra scrutiny before execution.
118098. **Tool-server request header trust reviewer** — verify the server does not trust client-supplied headers for identity or authorization decisions in tool calls.
118099. **MCP proxy gateway choke-point auditor** — evaluate the gateway that fronts multiple tool servers so policy, logging, and authentication are enforced at one accountable layer.
118100. **Tool registry search ranking integrity reviewer** — check that registry search results cannot be gamed by keyword-stuffed descriptions so the trusted tool is what users actually find.
118101. **Tool-server token broker reviewer** — audit sidecar services that mint tokens for tool calls so broker compromise cannot yield broad credentials.
118102. **Live tool policy tamper detector** — compare the live enforced policy against the approved version so unreviewed policy edits are caught quickly.
118103. **Fleet-wide MCP posture scorer** — roll every per-server check into a single posture score per server so the riskiest servers top the remediation queue.
118104. **Tool lifecycle state-machine reviewer** — verify tools move through defined states (proposed, approved, live, deprecated, retired) with recorded approvals so no tool skips review.
118105. **C2PA manifest chain verifier** — validate every embedded C2PA claim signature, issuer identity, and hash linkage from asset to original capture so a broken or missing link in the provenance chain surfaces as a trust finding.
118106. **Provenance-stripper fingerprint catalog** — identify which tools, social platforms, and recompression pipelines strip C2PA manifests so the agent can predict where provenance is lost and recommend re-signing checkpoints.
118107. **Ingredient-attribution tracer** — parse C2PA ingredient assertions to list every source asset composited into a finished work, exposing unlicensed or unknown source material in the supply chain.
118108. **Capture-device binding auditor** — verify that C2PA manifests on authorized media tie back to registered capture hardware keys, so asset claims from unregistered devices stand out immediately.
118109. **Claim-generator allowlist reviewer** — compare the manifest's claim generator strings against the publisher's approved-tool roster, flagging edits made with shadow or unapproved software.
118110. **Manifest-tamper red-flagger** — detect altered, re-encoded, or re-signed manifest regions whose hashes no longer match embedded assertions, marking the asset's provenance as unreliable.
118111. **Timestamp-authority trust reviewer** — check which RFC 3161 time authorities signed the manifest's timestamp claims, since timestamps from obscure or self-run TSAs weaken capture-time evidence.
118112. **Thumbprint-consistency checker** — confirm the asset thumbprint declared in the manifest matches the actual file content so a swapped or substituted file cannot ride on a valid manifest.
118113. **Multi-claim ordering validator** — verify that chained C2PA claims (capture → edit → publish) form a consistent temporal and hash-linked sequence rather than a jumbled or backdated history.
118114. **Manifest-size policy enforcer** — confirm manifests stay within the publisher's size and assertion-count budget so oversized manifests cannot be used as a storage side-channel for exfiltration.
118115. **Invisible-image watermark encoder grader** — test whether the target's invisible image watermark survives authorized re-encoding pipelines and score its bit-error rate, giving the publisher a concrete robustness number.
118116. **Watermark-removal resistance scorer** — measure how much crop, resize, filter, and recompression abuse a watermark endures before decoding fails, quantifying removal resistance instead of assuming it.
118117. **Audio spectral-watermark auditor** — verify spread-spectrum or phase-based audio watermarks persist through codec transcoding used by the target's distribution partners.
118118. **Video-frame watermark drift monitor** — track watermark detectability across per-frame edits, trims, and speed changes so edited clips do not silently shed their marks.
118119. **Watermark-key rotation reviewer** — check that watermark embedding keys rotate on schedule and that retired keys remain verifiable for legacy content without remaining in active use.
118120. **Watermark-versus-detector conflict tester** — confirm that watermarking an asset does not degrade the accuracy of the target's deepfake detector, since preprocessing artifacts can inflate false positives.
118121. **Fragile-watermark tamper alerting** — evaluate fragile watermarks that break on any edit so the publisher can distinguish innocent recompression from malicious tampering in dispute workflows.
118122. **Multi-tenant watermark namespace separator** — verify each client tenant gets its own watermark namespace so one tenant's marks cannot be forged or attributed to another.
118123. **Re-upload watermark re-assertion pipeline** — check that the media intake flow re-embeds provenance watermarks after user uploads, closing the loop when platforms strip metadata on ingest.
118124. **Watermark-decode API rate hygiene** — review the watermark verification endpoint for rate limits and abuse controls so attackers cannot brute-force mark parameters at scale.
118125. **Detection-API evasion-resistance grader** — run an authorized adversarial test suite of compression, noise, and face-swap variants against the target's deepfake API and score how many it still catches.
118126. **Detection-confidence calibration reviewer** — compare the API's reported confidence scores against measured accuracy on a held-out set so inflated confidence does not drive wrong automated decisions.
118127. **Detection-ensemble diversity checker** — verify that multi-model detection ensembles use genuinely diverse architectures and training data rather than correlated models that fail together.
118128. **False-positive baseline publisher** — measure the detector's false-positive rate on authentic but low-quality media (compressed, scanned, aged) so honest users are not flagged by aggressive thresholds.
118129. **Adversarial-regression corpus manager** — maintain a versioned corpus of known-evasion samples the agent replays after every detector update, catching regressions before they ship.
118130. **Detector-latency budget auditor** — measure end-to-end detection latency under load so real-time screening commitments match the deployed infrastructure's actual throughput.
118131. **Detection-explanation quality reviewer** — verify the API returns actionable explanations (affected regions, artifact classes) rather than a bare score, since analysts need reasons to trust and act on flags.
118132. **Low-resolution media detection floor** — test detection accuracy on thumbnails, previews, and heavily compressed streams to find the minimum usable fidelity for reliable screening.
118133. **Cross-demographic accuracy parity checker** — measure detection accuracy across age, gender, and ethnicity cohorts so the detector does not systematically misclassify any group.
118134. **Detector-version provenance tracker** — log which model version scored each asset so disputed decisions can be reproduced and audited against the exact weights in use.
118135. **Liveness prompt freshness scorer** — score how often the target's identity-verification flow randomizes liveness prompts and rotates task types, since stale or static prompts let attackers rehearse and replay valid responses.
118136. **Replay-attack fixture tester** — test liveness systems against authorized replay fixtures (screen playback, printed photos, recorded video) to confirm presentation-attack detection holds.
118137. **3D-mask resistance assessor** — verify that high-fidelity mask and deepfake-injection test fixtures are rejected, since cheap masks defeat weak depth heuristics.
118138. **Passive-liveness signal inventory** — catalog the passive signals (micro-texture, pulse, reflections) the system relies on so a missing or degraded signal triggers review rather than silent pass.
118139. **Liveness fallback-path auditor** — review what happens when liveness fails or is unavailable (manual review, bypass codes, support overrides) since the fallback is usually the weakest link.
118140. **Device-attestation binding checker** — confirm liveness sessions bind to attested device hardware (Play Integrity, DeviceCheck) so a session cannot be replayed from a different device.
118141. **Injection-attack surface mapper** — map camera-pipeline injection vectors (virtual cameras, emulator hooks, driver shims) on authorized test devices to prioritize SDK hardening.
118142. **Liveness-session timeout reviewer** — verify challenge sessions expire quickly and cannot be paused, resumed, or replayed to defeat freshness guarantees.
118143. **Multi-frame consistency analyzer** — check that liveness scoring examines consistency across the whole frame sequence rather than trusting a single best frame an attacker could cherry-pick.
118144. **Accessibility-safe challenge designer** — evaluate whether liveness challenges accommodate users with disabilities without creating a trivialized alternate path attackers can select.
118145. **Synthetic-voice enrollment verifier** — confirm voiceprint enrollment requires multi-sample, passphrase-diverse, liveness-checked audio so a single leaked recording cannot seed a clone.
118146. **Voice-clone call triage screener** — test whether the target's support desk or voice-auth flow detects synthetic-voice injection in inbound calls during authorized simulations.
118147. **TTS-fingerprint catalog builder** — maintain fingerprints of known text-to-speech engines and conversion models so inbound audio can be matched against the current synthesis landscape.
118148. **Voice-auth fallback reviewer** — audit what the system does when voice biometrics fail (PIN fallback, human review, account lockout) to ensure the fallback is not easier than the biometric.
118149. **Wake-word injection tester** — verify that smart-device wake-word and voice-command flows on authorized hardware resist pre-recorded and synthesized command injection.
118150. **Speaker-verification threshold tuner** — measure equal-error-rate tradeoffs on the target's speaker-verification deployment so threshold choices reflect measured risk rather than defaults.
118151. **Audio-deepfake evidence packager** — generate court-ready evidence bundles (spectrograms, detector outputs, provenance records) from confirmed synthetic-audio cases for the legal team.
118152. **Real-time call screening latency auditor** — measure the added latency of deepfake screening on live calls so fraud-prevention features do not make legitimate calls unusable.
118153. **Call-metadata corroboration checker** — cross-check voice-analysis results with carrier metadata (CLI consistency, call origin) so a suspicious voice on a suspicious route escalates faster.
118154. **Conference deepfake attendee flagger** — test whether the target's video-conferencing integration flags synthetic participants joining authorized test meetings.
118155. **Live-stream synthetic-persona monitor** — evaluate detection coverage for synthetic avatars and voice-swapped hosts in live commerce or broadcast streams the target operates.
118156. **Media-intake attestation gate designer** — verify the publisher's upload pipeline requires provenance attestations (C2PA or signed manifests) before content enters the distribution queue.
118157. **Evidence-grade media vault builder** — confirm submitted evidence media is stored with write-once hashing, access logs, and chain-of-custody manifests suitable for legal proceedings.
118158. **Newsroom verification workflow reviewer** — audit the target media organization's intake workflow to ensure deepfake screening happens before publication, not after.
118159. **UGC provenance-prompt designer** — evaluate whether the platform prompts uploaders to attach provenance and explains missing-provenance consequences to reduce unintentional strip-offs.
118160. **Distribution-point re-signing checker** — verify CDNs and distribution partners re-sign or preserve provenance at each handoff instead of silently dropping manifests.
118161. **Archive provenance-preservation auditor** — confirm long-term media archives retain manifests, watermarks, and hash registries so decades-old content stays verifiable.
118162. **Cross-platform provenance loss mapper** — trace how provenance degrades as content moves across the target's publishing partners, identifying the leakiest handoff.
118163. **Takedown-evidence bundle assembler** — generate structured evidence packs (detection scores, provenance records, timestamps) that speed up impersonation and deepfake takedown requests.
118164. **Impersonation-report triage accelerator** — test whether impersonation reports get prioritized by detection confidence and reach-of-harm scoring rather than FIFO queues.
118165. **Creator signing-key hygiene reviewer** — audit how creators store and rotate content-signing keys so a leaked key cannot be used to forge attributions at scale.
118166. **Creator-attribution registry builder** — verify the target maintains a verifiable registry binding creator identities to their public signing keys for attribution checks.
118167. **Impersonator-account correlation hunter** — correlate impersonation accounts by infrastructure signals (device, network, creation patterns) to dismantle whole impersonation rings, not single accounts.
118168. **Verified-creator misuse monitor** — watch for verified or trusted creator accounts that begin publishing synthetic content without disclosure, since trust badges amplify harm.
118169. **Disclosure-label compliance reviewer** — check that AI-generated content carries the target's required disclosure labels across feeds, embeds, and API surfaces consistently.
118170. **Synthetic-content policy-gap mapper** — compare the platform's published synthetic-media policy against its actual enforcement tooling to find promises the tooling cannot keep.
118171. **Deepfake incident-response runbook tester** — exercise the target's deepfake incident playbook with authorized simulations so roles, timelines, and escalation paths work before a real crisis.
118172. **Regulatory disclosure-mapping reviewer** — map the target's synthetic-media practices against applicable disclosure regulations so gaps are documented before regulators ask.
118173. **Victim-notification workflow designer** — evaluate whether and how the platform notifies people depicted in confirmed non-consensual synthetic media, including support resources.
118174. **Detector dataset-poisoning resistance tester** — run authorized poisoning simulations on the detector's training pipeline to confirm data-validation controls reject backdoored samples.
118175. **Training-label provenance auditor** — verify every training sample's label carries a provenance trail (who labeled, when, with what evidence) so label-quality issues are traceable.
118176. **Retraining-pipeline integrity checker** — confirm model retraining jobs verify dataset hashes and code signatures before consuming new data, closing the supply-chain loop.
118177. **Red-team synthetic corpus generator** — produce an authorized, clearly-labeled synthetic test corpus the target uses to continuously challenge its own detectors without touching real users.
118178. **Detector-drift monitor** — track detection accuracy against a fixed benchmark over time so model or data drift degrades gracefully into an alert rather than silent blindness.
118179. **Human-review queue prioritizer** — verify uncertain detector outputs are routed to human analysts with context (scores, explanations, provenance) instead of auto-publishing or auto-blocking.
118180. **Reviewer-calibration program designer** — check that human reviewers are regularly tested with known synthetic samples so their judgment stays calibrated as generation quality improves.
118181. **Synthetic-media threat-intel feed curator** — maintain a feed of new generation techniques and evasion tricks relevant to the target's threat model, updating test corpora as the landscape shifts.
118182. **Generator-capability horizon tracker** — monitor open-source and commercial generator releases to forecast which detection assumptions will break next quarter.
118183. **Cross-org detection-signal sharer** — design privacy-safe sharing of detection indicators (hashes, fingerprints, no raw media) between the target and peer organizations.
118184. **Detection-API abuse-prevention reviewer** — verify the deepfake-detection API cannot be misused as an oracle by attackers probing it to perfect evasions.
118185. **Query-budget anomaly detector** — flag API consumers whose query patterns look like systematic evasion probing rather than legitimate screening.
118186. **Client-SDK tamper-resistance reviewer** — audit the on-device detection SDK for anti-tamper controls so attackers cannot neuter local screening on rooted devices.
118187. **On-device model-extraction guard** — verify shipped detection models resist extraction and reverse engineering that would let attackers test evasions offline.
118188. **Federated-learning privacy auditor** — check that federated detector-training pipelines do not leak participant data through model updates or gradients.
118189. **Edge-screening offline-fallback reviewer** — verify on-device screening degrades safely when the server is unreachable rather than defaulting to pass.
118190. **Multilingual synthetic-speech coverage tester** — measure detection accuracy across the languages the target operates in, since detectors trained on one language fail silently on others.
118191. **Dialect-and-accent fairness reviewer** — confirm voice-spoof detection does not systematically misclassify regional accents or dialects common in the target's user base.
118192. **Low-bandwidth audio detection tester** — test synthetic-voice detection on narrowband and compressed call audio typical of real customer-support lines.
118193. **Group-call deepfake load tester** — verify screening scales to large multi-participant calls without dropping analysis on late joiners or screen-share audio.
118194. **Synthetic-text-plus-media combo reviewer** — test whether coordinated fake-text and fake-media campaigns are detected as linked operations rather than isolated items.
118195. **Meme-format deepfake propagation tracker** — trace how synthetic media mutates through meme formats and captions so detection follows the campaign, not just the original file.
118196. **Provenance UX comprehension tester** — evaluate whether end users understand the platform's authenticity indicators through usability testing, since a badge nobody understands protects nobody.
118197. **Accessibility-of-authenticity reviewer** — verify provenance and synthetic-media disclosures are perceivable by screen-reader and low-vision users, not only visual badges.
118198. **Child-safety synthetic-media fast-lane** — confirm synthetic media depicting minors triggers an accelerated review and law-enforcement referral path in the target's moderation flow.
118199. **Election-period deepfake surge planner** — test whether detection and review capacity scales for election or event-driven surges on authorized timelines the target defines.
118200. **Deepfake-insurance evidence standard** — verify detection outputs and provenance records meet the evidentiary bar the target's cyber-insurance policy requires for claims.
118201. **Synthetic-media kill-chain mapper** — model the full lifecycle (generation → distribution → amplification → monetization) so the agent can recommend the cheapest intervention point for each campaign type.
118202. **Provenance-backed ad-verification reviewer** — check that advertiser-submitted creative carries provenance so synthetic endorsements cannot slip into the target's ad inventory.
118203. **Deepfake-bounty scope designer** — help the target define an authorized deepfake-testing scope (which accounts, which media, which APIs) so external researchers can probe defenses legally.
118204. **Synthetic-media defense maturity scorer** — roll every check above into a single maturity scorecard (provenance, detection, liveness, voice, response) so leadership sees exactly where the next investment belongs.
118205. **Telematics endpoint census builder** — enumerate every telematics-cloud API endpoint exposed by the target from mobile apps, developer docs, and observed traffic so the authorized scope becomes a concrete inventory rather than guesswork.
118206. **Vehicle-command authorization matrix** — map each remote command (lock, unlock, start, honk, climate) to the required account role, vehicle-ownership proof, and session state so missing checks surface as a single chart.
118207. **VIN-to-account binding reviewer** — verify that a vehicle identifier can be linked to exactly one owner account at a time and that rebinding requires proof of possession, preventing account-hijack takeovers of cars.
118208. **Signed update-package manifest checker** — confirm each over-the-air firmware package carries a verifiable vendor signature and version metadata before the agent treats the delivery pipeline as trustworthy on authorized targets.
118209. **OTA campaign targeting auditor** — review how update campaigns select VINs or vehicle cohorts so a mis-targeted rollout cannot push the wrong firmware to the wrong cars.
118210. **Firmware rollback guard checker** — verify anti-downgrade counters in the update flow so a previously patched ECU cannot be silently reverted to a vulnerable version.
118211. **Delta-update integrity reviewer** — check that incremental firmware patches are integrity-checked as a complete image after reconstruction, not merely per-chunk, closing a tampering gap.
118212. **Update-scheduling safety reviewer** — confirm OTA installs are gated to parked, ignition-off states with user consent so safety-critical updates never trigger mid-drive.
118213. **Failed-update recovery planner** — assess whether a bricked or interrupted update leaves the vehicle in a drivable fallback state, turning update failure into a resilience finding rather than a surprise.
118214. **Recall-campaign completion tracker** — map recall notices to per-VIN completion status in the backend so the agent can flag safety recalls that were marked done without evidence.
118215. **Fleet-API tenant isolation tester** — verify that one fleet customer's API credentials cannot read, command, or enumerate vehicles belonging to another tenant on the shared platform.
118216. **Fleet-driver role scoper** — map driver, dispatcher, and administrator roles to the exact vehicle actions each may perform so over-privileged driver tokens stand out.
118217. **Bulk-vehicle command rate limiter reviewer** — check that mass commands (unlock entire fleet, immobilize all) carry approvals and throttles, since a single compromised token should not move a whole fleet.
118218. **Vehicle-handover flow reviewer** — verify rental, resale, and lease-return flows fully detach the previous driver account, keys, and history from the vehicle before the next user is onboarded.
118219. **Shared-vehicle keyless checkout auditor** — review car-sharing unlock and billing sessions so a stale session cannot grant a later user free or unauthorized access.
118220. **Infotainment cloud-session hygiene checker** — confirm streaming, navigation, and voice-assistant sessions expire on logout, account change, or vehicle sale instead of lingering indefinitely.
118221. **Companion-app session binding reviewer** — verify the mobile app session is cryptographically tied to the authenticated account and vehicle, so a stolen token cannot be replayed from another device.
118222. **In-car payment authorization reviewer** — check that toll, parking, and charging purchases initiated from the head unit require explicit driver confirmation and correct account attribution.
118223. **EV charge-cycle invoice reconciler** — reconcile charge-start events, metered energy, and invoiced amounts across the session lifecycle so billing drift or duplicate charges surface automatically.
118224. **Home-charger pairing flow reviewer** — verify that binding a home wallbox to an account requires physical-proximity proof, preventing remote hijack of someone else's charger.
118225. **Vehicle-to-grid authorization mapper** — review the consent and scheduling flow that lets a car discharge to the grid, ensuring the owner explicitly approved both participation and payout terms.
118226. **Public-charger roaming data reviewer** — check what driver, vehicle, and payment data crosses to third-party charging networks during roaming sessions and whether each field is necessary.
118227. **MQTT telemetry broker auth reviewer** — verify the vehicle-to-cloud message broker enforces per-vehicle credentials and topic-level authorization so one car cannot subscribe to another's telemetry stream.
118228. **Telemetry topic ACL mapper** — enumerate publish and subscribe permissions per device identity on the telemetry bus, turning broker configuration into a reviewable access chart.
118229. **Vehicle-shadow state consistency checker** — compare the cloud digital-twin state against last-known vehicle reports to flag phantom states the agent could misinterpret during a hunt.
118230. **CAN-gateway cloud-bridge scope reviewer** — confirm the cloud-to-vehicle bridge exposes only whitelisted diagnostic and command messages, never raw bus frames, limiting what a backend compromise could reach.
118231. **Remote-diagnostics session authorizer** — verify technician diagnostic sessions require owner consent, time bounds, and audit logging before any data or command channel opens.
118232. **Dealer-portal access control mapper** — map dealer, technician, and regional-manager roles to vehicle data and command capabilities so cross-dealership data access stands out as a finding.
118233. **Technician-action audit log reviewer** — check that every dealer-initiated remote action is logged with identity, timestamp, and vehicle so unauthorized service-bay activity is traceable.
118234. **Stolen-vehicle tracking data-protection reviewer** — verify location tracking activated for theft recovery is time-limited, owner-consented, and access-logged rather than an open-ended surveillance switch.
118235. **Emergency-call backend flow reviewer** — check that automatic crash-notification pipelines transmit only the data the emergency service needs and protect it in transit and at rest.
118236. **Crash-telemetry retention reviewer** — verify post-crash sensor data is retained under a documented policy with access controls instead of accumulating indefinitely.
118237. **Geofence-alert configuration reviewer** — review how geofence rules are created, who receives alerts, and whether alert fatigue could mask a genuine theft or boundary breach.
118238. **Find-my-vehicle access reviewer** — confirm the locate-vehicle feature requires fresh authentication and logs each lookup, since silent location queries are a stalking risk.
118239. **Trip-history access control checker** — verify historical location traces are visible only to the owning account with proper retention, never to dealers or third parties by default.
118240. **Location-trace anonymization reviewer** — check that analytics exports strip or aggregate precise location data so individual movement patterns cannot be reconstructed from supposedly anonymous sets.
118241. **Driver-behavior data consent mapper** — map each collected driving metric to its consent record and purpose so unconsented profiling for insurance or scoring becomes visible.
118242. **Pay-how-you-drive telemetry scope reviewer** — verify the driving-data feed shared with insurers matches the disclosed schema and consent scope, flagging over-collection beyond the policy terms.
118243. **External partner data-flow consent register** — maintain a per-account record of which outside partners receive which vehicle data, giving the agent a baseline to detect scope creep.
118244. **Data-subject request flow tester** — walk the access, export, and erasure flows for vehicle data on authorized targets to confirm requests complete fully across telematics, app, and dealer systems.
118245. **Vehicle-data erasure completeness checker** — verify account deletion propagates to backups, dealer portals, and partner feeds rather than leaving orphaned copies behind.
118246. **Multi-driver profile isolation reviewer** — check that secondary driver profiles cannot access the primary owner's trips, contacts, or payment methods in shared vehicles.
118247. **Valet-mode data boundary reviewer** — verify valet and guest modes hide personal data and restrict commands while still allowing basic driving functions.
118248. **Teen-driver restriction enforcer reviewer** — confirm speed, curfew, and geofence limits set by the owner are enforced server-side and cannot be bypassed from the infotainment unit.
118249. **Cabin-camera data handling reviewer** — check driver-monitoring and cabin-camera footage is processed on-device where claimed, with any cloud upload consented, encrypted, and retention-limited.
118250. **Sentry-mode recording access reviewer** — verify parked-vehicle surveillance clips are accessible only to the owner and expire on a documented schedule.
118251. **Dashcam cloud-upload consent checker** — confirm automatic dashcam uploads require explicit opt-in and that shared clips carry no embedded location metadata beyond what the owner approved.
118252. **Voice-assistant transcript reviewer** — check in-car voice transcripts are stored minimally, deletable by the owner, and never used for purposes outside the stated policy.
118253. **Navigation-destination privacy reviewer** — verify saved and recent destinations sync only to the owner's devices and are excluded from dealer or analytics access.
118254. **Map-update delivery integrity checker** — confirm navigation map packages are signed and version-pinned so a tampered map cannot misroute or misreport road data.
118255. **Infotainment app-store vetting reviewer** — review the approval and permission model for third-party head-unit apps so a malicious app cannot reach vehicle APIs.
118256. **Sideloaded-app risk reviewer** — check whether developer-mode or sideloaded apps on the head unit are blocked from vehicle-control interfaces on production builds.
118257. **Vehicle-WiFi hotspot isolation reviewer** — verify the in-car hotspot network is segmented from vehicle control networks so passenger devices cannot reach automotive systems.
118258. **Bluetooth key pairing security reviewer** — check phone-as-key pairing requires physical presence plus owner authentication, with old pairings revocable from the cloud.
118259. **Digital-key sharing flow reviewer** — review temporary key grants to family or guests for expiry, scope limits, and instant revocation when trust ends.
118260. **Remote-immobilization authorization reviewer** — verify engine-disable and theft-recovery immobilization commands require multi-factor confirmation and are limited to verified theft cases.
118261. **Horn-and-lights trigger abuse reviewer** — check remote honk and light-flash actions are rate-limited and logged, since unrestricted triggers enable harassment.
118262. **Trunk-release command scoper** — confirm remote trunk and frunk opening requires proximity or fresh authentication so a relayed session cannot pop cargo remotely.
118263. **Climate-preconditioning session reviewer** — verify remote climate starts are bound to the requesting account and auto-expire, preventing silent battery drain by stale sessions.
118264. **Software feature-unlock entitlement reviewer** — check paid features (heated seats, performance boosts) are enforced server-side per VIN so client-side flags cannot unlock them for free.
118265. **Subscription-expiry enforcement tester** — verify connected-service features actually deactivate when a subscription lapses rather than continuing on cached entitlements.
118266. **Trial-feature gating reviewer** — confirm trial periods end cleanly with clear owner notice instead of silently converting into paid billing.
118267. **Region-locked feature compliance reviewer** — check regulatory or licensed features respect the vehicle's registered region and cannot be enabled cross-border by configuration edits.
118268. **Connected-service entitlement sync checker** — reconcile app, cloud, and vehicle entitlement records so a feature active in one system but revoked in another becomes a visible inconsistency.
118269. **Vehicle certificate provisioning reviewer** — verify each vehicle receives a unique identity certificate at manufacturing with the private key generated or sealed on-device.
118270. **Certificate-rotation schedule reviewer** — check the PKI supports scheduled rotation of vehicle and backend certificates without bricking connectivity during the rollover window.
118271. **Compromised-certificate revocation tester** — confirm a revoked vehicle certificate is rejected by every cloud endpoint within the documented propagation time on authorized targets.
118272. **eSIM profile management reviewer** — verify remote SIM provisioning and carrier switches require owner authorization and cannot silently move a vehicle's connectivity to an attacker's profile.
118273. **Connectivity-failover behavior reviewer** — check how the vehicle behaves when its primary data link drops, ensuring safety functions degrade gracefully and queued commands cannot replay unexpectedly.
118274. **Roaming-data exposure reviewer** — review what telemetry crosses borders during international roaming and whether data-residency rules are honored in the pipeline.
118275. **Webhook event-subscription reviewer** — verify fleet and partner webhook registrations require ownership proof of the callback URL and sign every event payload.
118276. **Partner-API credential hygiene checker** — inventory third-party integrations holding vehicle API credentials and flag dormant, over-scoped, or never-rotated keys.
118277. **Dispatch-integration scope reviewer** — check logistics and ride-hail integrations receive only the vehicle fields their function needs, not full telemetry firehoses.
118278. **Cold-chain telemetry access reviewer** — verify refrigerated-fleet sensor data is accessible only to the responsible operator and customer, with tamper-evident logging for compliance.
118279. **Trailer and asset-tracking linkage reviewer** — confirm trailers and auxiliary assets pair to the correct tractor unit and cannot be silently re-associated by another account.
118280. **Fuel and charge-card API reviewer** — check fleet fuel-card and charging-card issuance, limits, and deactivation flows so a lost card cannot keep spending.
118281. **Fleet-maintenance scheduling access reviewer** — verify workshop and maintenance APIs expose only the assigned fleet's vehicles and service history to each service provider.
118282. **Odometer-data integrity monitor** — cross-check mileage reported by telematics, service records, and inspections so tampering or rollback stands out as a discrepancy.
118283. **Service-history record access reviewer** — confirm maintenance and repair records follow the vehicle to new owners while remaining hidden from unrelated third parties.
118284. **Warranty-claim data reviewer** — check warranty submissions expose only the required diagnostic snapshot, not the owner's full driving history.
118285. **EV battery-health data access reviewer** — verify battery state-of-health reports are shared with the owner first and with third parties only under explicit consent.
118286. **Charging-station finder data reviewer** — check the station-search API does not leak the driver's live location to station operators beyond the lookup request.
118287. **Autonomous-feature backend scope reviewer** — review driver-assistance and autonomy cloud services for least-privilege data collection and clear separation from marketing analytics.
118288. **HD-map data access reviewer** — verify high-definition map downloads are restricted to entitled vehicles and cannot be scraped in bulk by a single account.
118289. **Sensor-calibration data reviewer** — check calibration uploads from cameras and radars are integrity-protected so a tampered calibration cannot silently degrade assistance features.
118290. **Incident-data pipeline reviewer** — verify near-miss and disengagement uploads follow a documented consent and retention policy rather than streaming everything by default.
118291. **Aftermarket-dongle cloud linkage reviewer** — check OBD-II dongles and aftermarket trackers bind to the installing account with the owner's knowledge, flagging shadow devices on the vehicle.
118292. **Diagnostic-trouble-code exposure reviewer** — verify fault-code reads through cloud APIs require owner authorization and do not expose codes from other vehicles on shared accounts.
118293. **Parts-ordering API access reviewer** — confirm dealer parts systems cannot be queried for VIN-linked owner details beyond what fulfillment requires.
118294. **Recall-notification delivery reviewer** — check safety-recall messages reach the current owner through verified channels and cannot be suppressed by a previous account still linked to the VIN.
118295. **Test-drive vehicle data reviewer** — verify demo and test-drive cars reset personal data between drivers and do not sync a prospect's phone data to the dealer cloud.
118296. **Connected-motorcycle telemetry reviewer** — check two-wheeler telematics units enforce the same identity, consent, and command-authorization standards as passenger cars.
118297. **Commercial-truck hours-of-service reviewer** — verify electronic logging data is tamper-evident and accessible only to the driver, carrier, and regulators entitled to it.
118298. **School-bus tracking privacy reviewer** — check student-transport tracking shares live location only with authorized guardians and the school, with no public or advertiser access.
118299. **Emergency-fleet priority-channel reviewer** — verify police, fire, and ambulance telematics use isolated, priority communication channels that consumer traffic cannot congest or spoof.
118300. **Vehicle-pen-test scoping assistant** — generate a precise authorized-target inventory (VIN ranges, API hosts, app versions) from the program brief so every subsequent check stays provably inside scope.
118301. **Threat-model template generator for telematics** — produce a vehicle-cloud threat model draft (assets, trust boundaries, attacker paths) that the hunt team refines instead of starting from a blank page.
118302. **Automotive finding-severity calibrator** — translate raw findings into safety-aware severity ratings that weigh kinetic impact, so a remote brake-adjacent issue outranks a cosmetic app bug.
118303. **Fix-verification retest pack builder** — assemble targeted retests for each remediated vehicle finding so the agent confirms the fix on the authorized target instead of trusting a changelog note.
118304. **Regulatory-evidence pack exporter** — compile hunt evidence into UNECE R155 and ISO 21434 aligned documentation so the security team can reuse authorized-test results for compliance audits.
118305. **NDC booking-API offer-integrity checker** — validate that fare offers returned by the airline's New Distribution Capability API match published fare rules and filed fares, so tampered offers or fare-logic drift are caught before ticketing on authorized targets.
118306. **PNR data-access scoping auditor** — verify that every PNR read endpoint enforces field-level authorization (name, contact, SSR) against the caller's role, so partners and support staff only see the passenger fields their role requires.
118307. **Crew-portal authorization reviewer** — test that crew scheduling, duty-time, and personal-detail endpoints reject cross-crew and cross-role access, protecting crew rosters from unauthorized roster reads on authorized crew platforms.
118308. **Baggage-tag cloud privacy reviewer** — confirm baggage-tracking APIs return only the requester's own bag records and mask bag-tag-to-passenger linkage for other travelers, preventing itinerary inference from shared bag identifiers.
118309. **Airport-kiosk session-hygiene checker** — verify self-service kiosk sessions fully expire, wipe PNR remnants, and invalidate tokens after check-in or timeout, so the next passenger cannot resume a previous session.
118310. **Loyalty-point fraud-surface mapper** — inventory every earn, burn, transfer, and pooling endpoint with its rate limits and account-verification steps, so synthetic-accrual and point-laundering paths are visible before abuse.
118311. **Disruption-rebooking API reviewer** — test that rebooking endpoints during irregular operations validate eligibility, fare-difference rules, and identity, so automated rebooking cannot be exploited to grab premium inventory.
118312. **Onboard-connectivity session-isolation tester** — assess portal authentication, session isolation between passengers, and payment flows on authorized test aircraft, ensuring onboard connectivity cannot leak passenger identity or sessions.
118313. **Cargo-manifest access-control auditor** — verify manifest read and update endpoints restrict access by shipper, forwarder, and airline role, keeping dangerous-goods and high-value cargo details compartmented.
118314. **Biometric-boarding data-minimization reviewer** — confirm boarding biometric services retain only consented templates, delete them after departure, and never expose raw images through APIs, reducing retention risk on authorized targets.
118315. **Fare-class mapping integrity checker** — cross-check booking-class to cabin/fare-family mappings across web, app, and NDC channels so a mismatch cannot price a business seat at an economy fare.
118316. **Ancillary-pricing API consistency monitor** — compare bag, seat, and meal prices returned across storefront channels for the same itinerary, flagging pricing drift that signals logic errors or cache poisoning.
118317. **Upgrade-auction fairness reviewer** — test that upgrade-bidding APIs enforce per-passenger limits, tie bids to eligible segments, and prevent bid manipulation after the clearing window closes.
118318. **Voucher-and-credit issuance auditor** — verify travel vouchers and flight credits are minted with single-use tokens, expiry, and balance accounting, so duplicate issuance or balance inflation is detectable.
118319. **Refund-webhook verification checker** — confirm payment-refund webhooks require signed payloads, idempotency keys, and state transitions, preventing forged refund notifications on authorized targets.
118320. **Mobile-boarding-pass QR lifecycle reviewer** — test that boarding-pass QR/barcode tokens rotate on reissue, expire after departure, and cannot be reused across passengers, blocking pass-sharing abuse.
118321. **Seat-map inventory integrity tester** — verify seat-map APIs reserve seats atomically and reject concurrent double-assignment, so two passengers can never hold the same seat on an authorized booking platform.
118322. **Group-booking isolation checker** — confirm group PNRs restrict member-level edits to the group owner or authorized agents, preventing one member from altering another's flights or contacts.
118323. **Unaccompanied-minor handoff tracker** — test that UMNR service APIs log custody transfers with staff identity and timestamps, creating an auditable chain of custody for child travelers.
118324. **SSR special-service request validator** — verify wheelchair, meal, and medical SSR codes are bound to the correct passenger and segment and cannot be mass-applied to other travelers' bookings.
118325. **Standby-and-waitlist clearance auditor** — confirm standby list ordering, priority rules, and clearance events are tamper-evident, so queue-jumping via API manipulation is visible to operations staff.
118326. **Overbooking compensation-logic reviewer** — test that denied-boarding compensation workflows verify passenger presence and ticket validity before issuing vouchers, preventing fabricated compensation claims.
118327. **EU261-claim fraud-surface mapper** — inventory compensation claim endpoints with their evidence requirements and duplicate-detection logic, so automated false-claim farming is harder to scale.
118328. **Interline baggage-agreement data reviewer** — verify interline bag-transfer records synchronize transfer counts and custody between partner airlines, flagging mismatches that predict mishandling.
118329. **Mishandled-bag claim API auditor** — test that lost-baggage claim endpoints validate tag ownership and photo evidence, reducing fraudulent reimbursement claims on authorized platforms.
118330. **Airport operational-database (AODB) access reviewer** — confirm AODB read/write APIs enforce airline, handler, and airport roles, so flight-event updates cannot be forged by unauthorized parties.
118331. **Slot-swap marketplace integrity checker** — verify airport slot trade and swap APIs authenticate both counterparties and log regulator-visible audit trails, preventing unauthorized slot transfers.
118332. **A-CDM milestone-data integrity monitor** — test that collaborative-decision-making milestone timestamps (off-block, take-off) are signed and append-only, so departure sequencing cannot be gamed.
118333. **Gate-allocation API authorization tester** — confirm gate assignment and reassignment endpoints require airport-operations roles, blocking unauthorized gate changes that cascade delays.
118334. **Departure-sequencing fairness auditor** — verify queue-management APIs apply published sequencing rules consistently, making preferential pushback visible to all participating airlines.
118335. **NOTAM feed integrity checker** — test that NOTAM ingestion and distribution APIs validate source signatures and versioning, so flight-planning cannot act on spoofed notices on authorized targets.
118336. **Flight-plan filing authorization reviewer** — confirm flight-plan submission and amendment endpoints authenticate the operator and validate route/aircraft consistency before acceptance.
118337. **Weather-data feed validation monitor** — verify aerodrome weather APIs cross-check multiple sources and flag stale observations, keeping dispatch decisions on fresh data.
118338. **Weight-and-balance input validator** — test that loadsheet APIs reject implausible passenger/cargo weights and require dual-entry for last-minute changes, protecting trim calculations.
118339. **Loadsheet digital-signature reviewer** — confirm signed loadsheet APIs bind the signature to the exact load figures and aircraft registration, so post-signature edits invalidate the document.
118340. **Dangerous-goods declaration checker** — verify DG declaration APIs enforce shipper certification, segregation rules, and acceptance scans before cargo is loaded.
118341. **Cargo-capacity booking integrity tester** — test that cargo space-booking APIs enforce allocation limits and validate agent credentials, preventing over-allocation on authorized cargo platforms.
118342. **Cold-chain telemetry anomaly monitor** — verify perishable-cargo temperature feeds are tamper-evident and alert on gaps, so cold-chain breaks are caught before acceptance.
118343. **EFB chart-update integrity checker** — confirm electronic-flight-bag chart sync APIs verify package signatures and version continuity, so pilots never fly with corrupted or stale charts.
118344. **Crew duty-time compliance monitor** — test that duty-time APIs enforce fatigue regulations across time zones and flag roster edits that would breach legal limits.
118345. **Crew credential-verification reviewer** — verify license, medical, and visa checks are bound to the crew member's identity and re-validated on roster changes, preventing unqualified assignments.
118346. **Deadhead-positioning data privacy checker** — confirm deadhead and positioning itineraries are visible only to scheduling staff and the affected crew, not to the wider workforce.
118347. **Simulator-scheduling access auditor** — test that simulator booking APIs restrict access to authorized training staff and protect slot allocations from unauthorized holds.
118348. **Crew-hotel booking authorization reviewer** — verify crew accommodation APIs validate crew identity and trip linkage, so hotel inventory cannot be diverted by non-crew accounts.
118349. **Maintenance work-order integrity checker** — test that MRO task-card APIs enforce mechanic sign-off, part traceability, and cannot be closed without required certifications.
118350. **Aircraft-parts provenance tracker** — verify parts-ordering APIs link every serialized part to its certification documents, making counterfeit-part injection auditable.
118351. **De-icing scheduling audit logger** — confirm de-icing request and completion APIs record fluid type, quantity, and holdover times with operator identity, supporting regulatory review.
118352. **Fuel-uplift reconciliation monitor** — test that fuel-order and uplift APIs reconcile ordered versus delivered quantities with signed delivery records, flagging discrepancies for investigation.
118353. **Ground-handling task authorization tester** — verify pushback, towing, and servicing task APIs authenticate the handling agent and the specific turnaround, preventing phantom service records.
118354. **Turnaround-plan coordination reviewer** — confirm turnaround milestone APIs synchronize tasks across cleaning, catering, and fueling with role-based updates, keeping the critical path trustworthy.
118355. **Airport-badge credentialing auditor** — test that staff badge issuance, renewal, and revocation APIs enforce background-check completion and least-privilege zone access.
118356. **SIDA access-log integrity checker** — verify secure-area access logs are append-only and tied to badge identities, so unauthorized entries cannot be erased from the record.
118357. **Visitor-management data reviewer** — confirm airport visitor-pass APIs validate sponsor identity, escort requirements, and expiry, limiting unmanaged access to restricted zones.
118358. **Tarmac-vehicle tracking privacy auditor** — test that airside vehicle telemetry APIs mask driver identities from non-operational roles while preserving safety-critical location data.
118359. **Flight-information-display (FIDS) content-integrity checker** — verify display content APIs authenticate publishers and version updates, so departure boards cannot be defaced on authorized airport systems.
118360. **Public-address system authorization reviewer** — confirm PA and alert-broadcast APIs require operations-center roles and log every message, preventing unauthorized announcements.
118361. **Airport Wi-Fi analytics privacy reviewer** — test that passenger Wi-Fi analytics pipelines aggregate and anonymize device data, never exposing individual movement histories.
118362. **Wayfinding indoor-positioning data minimizer** — verify terminal navigation apps request location only when needed and purge traces after the journey, respecting traveler privacy on authorized apps.
118363. **Fast-track security-pass API auditor** — test that priority-lane pass issuance APIs validate ticket class or paid entitlement and bind passes to a single traveler identity.
118364. **Lounge-access entitlement checker** — verify lounge pass APIs enforce membership, guest limits, and visit windows, preventing pass reuse across multiple travelers.
118365. **Parking-reservation fraud reviewer** — test that airport parking booking APIs validate license plates and prevent bulk hoarding of premium slots by reseller accounts.
118366. **Airside retail purchase-eligibility checker** — verify airside retail pre-order APIs bind purchases to a valid boarding pass and flight, so landside buyers cannot claim duty-free pricing.
118367. **Meal-voucher QR lifecycle auditor** — test that disruption meal vouchers use single-use, time-boxed tokens tied to the affected flight, preventing voucher harvesting and resale.
118368. **Hotel-voucher issuance validator** — confirm overnight-disruption hotel vouchers are linked to the disrupted PNR and passenger count, so vouchers cannot be generated without a qualifying event.
118369. **Rebooking-partner API authorization tester** — verify partner-hotel and partner-airline rebooking APIs authenticate the disruption context and rate-limit voucher creation per incident.
118370. **Disruption-notification consent reviewer** — test that SMS/push disruption alerts respect passenger notification preferences and throttle frequency, avoiding spam and opt-out violations.
118371. **Schedule-change notification API auditor** — confirm schedule-change APIs deliver notices to the booking contact and agency of record with versioned change records, keeping travelers informed on authorized platforms.
118372. **Chatbot PNR-disclosure guard** — test that airline chatbot APIs require identity verification before revealing booking details, so casual queries cannot surface another traveler's itinerary.
118373. **IVR PNR-disclosure reviewer** — verify voice-system booking lookups authenticate callers and mask sensitive fields, preventing social-engineering-driven data exposure.
118374. **Agent-desktop API authorization tester** — confirm travel-agent console APIs enforce per-agency data scoping, so one agency cannot pull another agency's bookings.
118375. **White-label partner session-token reviewer** — test that partner-branded booking sites issue scoped tokens that cannot access the airline's core account functions, containing partner-compromise blast radius.
118376. **Consolidator data-access scoping auditor** — verify ticket-consolidator APIs expose only their own ticket stock and mask other consolidators' inventory and margins.
118377. **BSP settlement-data access reviewer** — confirm billing-and-settlement-plan reporting APIs restrict agency-level data to the owning agency and IATA roles, protecting commercial data.
118378. **Codeshare schedule-consistency checker** — test that marketing-versus-operating carrier schedule feeds reconcile flight numbers, times, and aircraft, flagging inconsistencies that break rebooking.
118379. **SSIM schedule-feed integrity monitor** — verify schedule-information-manual feeds are signed and versioned on ingestion, so downstream booking systems act on authentic schedules.
118380. **Currency-conversion pricing auditor** — test that multi-currency fare APIs use audited exchange-rate sources and round consistently, preventing arbitrage from rate inconsistencies.
118381. **Payment 3-D Secure flow reviewer** — confirm airline checkout APIs enforce step-up authentication per PSD2 rules and never complete high-risk payments without it.
118382. **Travel-insurance cross-sell data reviewer** — verify insurance upsell APIs share only the minimum trip data with underwriters and record passenger consent.
118383. **Hotel-and-car cross-sell consent checker** — test that ancillary travel-product APIs require explicit opt-in before sharing itinerary details with hotel and car partners.
118384. **Deep-link boarding-pass token reviewer** — verify app deep links carrying boarding passes use short-lived signed tokens that cannot be replayed by another device.
118385. **Frequent-flyer status-match fraud reviewer** — test that status-match request APIs validate external-program credentials and limit matches per account, blocking manufactured elite status.
118386. **Points-pooling abuse-surface mapper** — verify family/household points-pooling APIs enforce relationship verification and transfer caps, so pooled balances cannot be farmed at scale.
118387. **Award-seat inventory integrity checker** — test that award-booking APIs draw from genuine award inventory and enforce saver/standard rules, preventing phantom award space.
118388. **Companion-certificate misuse reviewer** — verify companion-fare certificate APIs bind certificates to the member's account and eligible companions, blocking certificate resale.
118389. **Airline mobile-app secret scanner** — test authorized airline app builds for hardcoded API keys, tokens, and backend URLs that would expose internal endpoints if extracted.
118390. **Check-in API rate-limit reviewer** — confirm online check-in endpoints throttle per-account and per-flight attempts, preventing seat-grab automation and enumeration.
118391. **API versioning and deprecation auditor** — inventory booking-API versions in production and verify deprecated versions are sunset or hardened, so legacy flaws cannot linger.
118392. **Border pre-clearance data-minimization reviewer** — test that advance-passenger-information APIs transmit only regulator-required fields and encrypt data in transit, protecting traveler PII on authorized platforms.
118393. **Health-declaration form data-retention checker** — verify arrival health-form APIs purge sensitive health data after the mandated retention period and restrict access to health authorities.
118394. **Lost-and-found claim API validator** — test that airport lost-property claim APIs verify claimant identity and item ownership before releasing retrieval details.
118395. **Pet-booking compliance checker** — verify live-animal booking APIs enforce carrier, breed, and temperature-embargo rules per segment, preventing unsafe animal transport bookings.
118396. **Charter-broker portal authorization reviewer** — test that charter quotation and booking APIs restrict aircraft availability data to vetted brokers, protecting operator pricing.
118397. **Corporate travel-policy enforcement checker** — verify corporate booking portals enforce the client's fare-class and approval rules server-side, so policy bypass cannot happen via API tampering.
118398. **Multi-airport city selection-logic reviewer** — test that metro-area airport-choice APIs apply consistent distance and schedule logic, preventing silent rerouting to a farther airport.
118399. **Timezone and DST schedule-handling auditor** — verify schedule APIs compute departure/arrival times with authoritative timezone data and DST transitions, avoiding off-by-one-hour booking errors.
118400. **Crew rest-facility booking privacy checker** — confirm crew rest and layover-facility booking APIs hide individual crew assignments from other crew members and staff outside scheduling.
118401. **Bird-strike reporting integrity checker** — verify wildlife-strike report APIs validate reporter identity and attach immutable timestamps, keeping safety data trustworthy.
118402. **Runway-condition reporting API auditor** — test that runway surface-condition reports require certified inspector credentials and versioned observations before distribution.
118403. **Cargo mail-screening data reviewer** — confirm mail and courier screening-result APIs restrict access to security-cleared roles and log every query for audit.
118404. **Airport advertising-display authorization checker** — verify digital-signage ad APIs authenticate advertisers and isolate ad content from operational displays, so marketing updates can never override safety information.
118405. **eSIM profile-download authorization verifier** — confirm SM-DP+ download requests bind the profile to the authenticated subscriber and EID before release, since unbound downloads enable profile theft.
118406. **One-time activation-code lifecycle validator** — verify eSIM activation codes and matching IDs expire after the first successful download so intercepted codes cannot provision a second device.
118407. **SM-DP+ certificate-chain reviewer** — validate the SM-DP+ TLS and code-signing chain against GSMA roots so a rogue provisioning server cannot masquerade as the carrier.
118408. **EID-to-subscriber binding auditor** — check that each registered EID is tied to exactly one verified account holder, preventing profile assignment to attacker-controlled devices.
118409. **Profile enable-disable-delete authorization checker** — verify lifecycle operations on installed eSIM profiles require the profile owner's session, blocking remote profile wipes by other tenants.
118410. **IoT eSIM fleet-provisioning reviewer** — audit eIM-mediated profile downloads for per-device authentication so one compromised fleet credential cannot reprovision thousands of meters.
118411. **Fallback-profile hygiene scanner** — detect test or bootstrap profiles left active in production fleets, since fallback connectivity bypasses normal billing and policy controls.
118412. **Carrier-entitlement server configuration reviewer** — inspect Apple and Google entitlement-server responses for correct EAP-AKA parameters so VoLTE and VoWiFi activate only for entitled lines.
118413. **VoWiFi ePDG provisioning validator** — verify Wi-Fi calling credentials are issued per subscriber with short lifetimes, limiting reuse of stolen provisioning data.
118414. **Visual-voicemail credential issuer audit** — check that visual-voicemail IMAP credentials are random per line and rotated on password change, preventing voicemail snooping via reused secrets.
118415. **CAMARA scope-minimization auditor** — map each third-party app's granted CAMARA scopes against its stated purpose so over-broad network-API access is flagged before production.
118416. **SIM-swap detection API freshness checker** — verify the CAMARA SIM-swap endpoint reflects swaps within minutes, since stale data lets account takeover proceed undetected.
118417. **Number-verification silent-auth reviewer** — confirm silent mobile-data authentication cannot be spoofed by header injection or proxy IPs, keeping number verification trustworthy.
118418. **Device-location consent-gate verifier** — test that CAMARA location calls require fresh subscriber consent records, preventing covert tracking through partner apps.
118419. **QoS-on-demand session authorization mapper** — verify QoD API calls bind the boosted session to the requesting device and app so one app cannot buy priority for another's traffic.
118420. **Carrier-billing charge consent tracker** — audit direct-carrier-billing charges for recorded double opt-in evidence, since missing consent trails are the core of cramming findings.
118421. **Device-status API data-minimization reviewer** — check that device-status responses expose only the roaming and connection state the caller needs, not full subscriber profiles.
118422. **KYC match field-limitation checker** — verify CAMARA KYC endpoints return match booleans rather than raw identity documents, limiting PII exposure to partners.
118423. **Network-event webhook signature validator** — confirm NEF event webhooks carry verifiable signatures and replay protection so spoofed network events cannot trigger partner workflows.
118424. **Aggregator partner-onboarding reviewer** — audit channel-partner vetting and API-key issuance so a weak partner cannot resell network-API access to unvetted downstream apps.
118425. **Prepaid top-up idempotency tester** — verify voucher and top-up APIs reject duplicate redemptions under retry and race conditions, blocking double-credit fraud.
118426. **Balance-integrity reconciliation monitor** — compare real-time charging balances against rating records so silent balance drift is caught before customers are over- or under-charged.
118427. **Zero-rating bypass detector** — test that zero-rated traffic classifiers cannot be tricked by header or SNI manipulation, since bypasses convert free traffic into unbilled paid usage.
118428. **CDR completeness auditor** — verify every billable session produces a charging record with matching identifiers, closing revenue-leakage gaps in mediation.
118429. **Interconnect TAP-file validation checker** — validate inbound roaming TAP files against schema and rate agreements so inflated wholesale invoices are rejected automatically.
118430. **Bill-shock notification logic reviewer** — confirm roaming and data-cap alerts fire at configured thresholds with audit trails, since missed alerts create regulatory and churn risk.
118431. **Invoice IDOR exposure scanner** — test that invoice PDFs and billing APIs enforce per-account access so one subscriber cannot fetch another's itemized records.
118432. **Autopay payment-method authorization verifier** — check that stored cards and bank mandates can only be charged by the owning account, blocking cross-account payment misuse.
118433. **Convergent-billing cross-service authz mapper** — verify quad-play bundles enforce per-service entitlements so a mobile-only account cannot activate TV or fiber lines.
118434. **Loyalty-points fraud-surface reviewer** — audit points accrual and redemption for replay and transfer abuse, since points behave like currency on carrier apps.
118435. **Multi-brand portal data-segregation verifier** — verify multi-brand and MVNO portals strictly segregate subscriber data so one brand's users never see another's accounts.
118436. **Family-plan delegated-access reviewer** — check that secondary lines receive only the permissions the primary explicitly granted, preventing privilege creep across family members.
118437. **Self-care OTP reset-flow hardening checker** — verify account password resets bind the OTP to the requesting session and device, blocking reset interception.
118438. **Call-forwarding authorization verifier** — confirm supplementary-service changes require authenticated sessions so attackers cannot silently divert calls and OTPs.
118439. **Number-management API scope reviewer** — audit reserve, assign, and release number APIs for per-dealer authorization, preventing number squatting or theft.
118440. **Retailer-portal field-exposure minimizer** — verify retailer onboarding tools expose only the fields each role needs, since dealer portals are a prime PII-leak surface.
118441. **SIM-stock logistics tracker** — reconcile physical SIM and blank-eSIM inventory from warehouse to activation so unaccounted stock is flagged before misuse.
118442. **Port-out fraud-surface mapper** — verify number-port requests require multi-factor account-holder confirmation, since weak port-out flows enable SIM-swap-style takeovers.
118443. **Porting data-privacy reviewer** — check that donor and recipient portability exchanges transmit only the minimum subscriber data required, limiting exposure during ports.
118444. **Number-recycling sanitization verifier** — confirm recycled numbers are purged of prior-owner profile data and OTP bindings before reassignment.
118445. **SIM-swap workflow verification harness** — test that in-store and call-center SIM swaps follow step-up verification and cooling-off rules, closing social-engineering paths.
118446. **HLR-lookup API abuse monitor** — verify subscriber-lookup APIs enforce rate limits and legitimate-use contracts so bulk harvesting of subscriber status is blocked.
118447. **Signaling-firewall rule reviewer** — audit edge SS7 and Diameter filters for location-tracking and intercept primitives so unauthorized MAP and Diameter queries are dropped.
118448. **SMS home-routing effectiveness tester** — verify SMS home routing is active for inbound international SMS, since unrouted SMS bypasses firewall inspection.
118449. **SMS-firewall effectiveness measurer** — replay known smishing and spoof patterns against firewall rules in a lab mirror to confirm detection rates before production reliance.
118450. **SMPP bind-credential hygiene scanner** — detect shared, default, or over-privileged SMPP binds on SMS gateways, since one leaked bind can inject carrier-grade SMS.
118451. **A2P sender-registration integrity checker** — verify enterprise sender IDs and templates are registered and approved before traffic is accepted, blocking grey-route spam.
118452. **DLR-spoofing guard reviewer** — confirm delivery receipts are authenticated to the originating bind so fake DLRs cannot manipulate billing or campaign logic.
118453. **Short-code billing-consent auditor** — verify premium-SMS short codes record explicit subscriber consent per charge, since missing consent is the classic cramming vector.
118454. **STIR/SHAKEN attestation reviewer** — validate outbound call-signing certificates and attestation levels so legitimate carrier calls are not downgraded to spam risk.
118455. **CLI-spoofing ingress filter checker** — verify interconnect SBCs reject calls with spoofed domestic caller IDs, cutting Wangiri and impersonation fraud at the border.
118456. **Robocall-mitigation analytics tuner** — review honeypot-fed detection models for precision so legitimate enterprise callers are not mislabeled while scams are caught.
118457. **SIP-trunk credential rotation auditor** — detect static or shared SIP-trunk credentials on enterprise interconnects, since trunk compromise enables toll fraud.
118458. **Toll-fraud anomaly sentinel** — monitor international and premium call patterns per trunk for sudden spikes, flagging PBX-hacking-style abuse within minutes.
118459. **Voicemail-platform authentication reviewer** — verify voicemail access requires per-line credentials rather than default PINs, blocking voicemail-based OTP interception.
118460. **IVR caller-verification strength checker** — audit IVR account-access flows for knowledge-factor strength so callers cannot reach account data with public information alone.
118461. **USSD session-integrity tester** — verify USSD banking and balance menus bind sessions to the originating MSISDN and time out safely, preventing session hijack.
118462. **Call-center PII-masking verifier** — confirm agent desktops mask full IMSI, identity numbers, and payment details by role, since screen-pop data is a frequent insider-leak path.
118463. **CRM activity-log coverage auditor** — verify every subscriber-record view and edit writes an immutable audit entry, enabling insider-abuse investigation.
118464. **5G slice-exposure inventory builder** — catalog every network slice and its exposed APIs so enterprise slices are not reachable from consumer entry points.
118465. **Slice-isolation verification harness** — test that traffic and management calls cannot cross slice boundaries, since slice escape undermines enterprise SLAs.
118466. **NSSAI exposure minimizer** — verify slice identifiers are not leaked in unauthenticated responses, keeping enterprise slice topology private.
118467. **NEF trust-tier reviewer** — audit NEF trust levels assigned to third-party application functions so low-trust apps cannot request sensitive network capabilities.
118468. **5G SUPI-privacy configuration checker** — verify SUCI concealment and GUTI reallocation are enabled so subscriber identities cannot be tracked over the air.
118469. **SEPP N32-security reviewer** — validate inter-PLMN SEPP connections use TLS with mutual authentication, protecting roaming signaling from interception.
118470. **MEC application-authentication mapper** — verify edge-compute apps authenticate per device session so one compromised edge app cannot reach other tenants' workloads.
118471. **GTP-firewall rule auditor** — review GTP-C and GTP-U filtering on roaming interconnects to block TEID spoofing and unauthorized tunnel creation.
118472. **Diameter realm-routing hygiene checker** — verify Diameter edge agents enforce realm-based routing and peer authentication, closing open-relay signaling paths.
118473. **PCF policy-integrity reviewer** — audit policy-control rules for unauthorized QoS or charging-policy changes that could grant free premium service.
118474. **UDM subscriber-data access reviewer** — verify unified-data-management reads require per-function authorization so one network function cannot bulk-export subscriber profiles.
118475. **AUSF authentication-vector hygiene checker** — confirm authentication vectors are single-use and bound to the serving network, preventing replay across networks.
118476. **NRF service-discovery exposure limiter** — verify the network-repository function is not reachable from untrusted networks, since NRF reveals the full 5G core topology.
118477. **MVNO wholesale-API tenant-isolation tester** — verify MVNO platform APIs strictly separate each virtual operator's subscribers, plans, and billing data.
118478. **IoT connectivity-platform lifecycle reviewer** — audit SIM suspend, resume, and terminate APIs for per-customer authorization so one enterprise cannot alter another's fleet.
118479. **eUICC remote-provisioning audit trail** — verify every remote profile operation on IoT eUICCs is logged with operator identity, enabling fleet-tampering forensics.
118480. **APN and data-session authorization checker** — confirm data sessions are established only against subscriber-entitled APNs, blocking APN-hopping to bypass policy.
118481. **IMEI blocklist enforcement verifier** — test that stolen-device IMEIs are actually rejected at network attach, since unenforced blocklists give false assurance.
118482. **Device-financing lock-policy reviewer** — audit IMEI-lock APIs for per-device authorization so locks cannot be lifted from or applied to the wrong devices.
118483. **Cell-broadcast alert-configuration reviewer** — verify emergency-alert origination requires multi-person approval and signed messages, preventing false public alerts.
118484. **Emergency-caller positioning precision reviewer** — validate emergency location pipelines deliver timely fixes so responders are not sent to stale coordinates.
118485. **Lawful-intercept interface audit harness** — verify handover interfaces log every activation with judicial authorization references, keeping interception accountable.
118486. **Metadata-retention compliance mapper** — check that retained communications metadata matches legal schedules exactly, flagging both over- and under-retention.
118487. **Subscriber-log redaction verifier** — confirm IMSI, MSISDN, and SUPI are masked in application and NOC logs by default, since unmasked logs are a bulk-PII breach waiting to happen.
118488. **DSAR fulfillment workflow reviewer** — verify data-subject requests return complete subscriber records within legal deadlines, with deletion confirmed across billing, CRM, and network stores.
118489. **Marketing-consent registry checker** — verify promotional SMS and calls consult do-not-disturb registries in real time, since violations carry regulatory penalties.
118490. **TR-069 ACS provisioning-security reviewer** — audit home-router auto-configuration servers for per-device authentication so one subscriber cannot push configs to another's CPE.
118491. **Fiber-GIS data-exposure scanner** — verify network-asset maps and rollout trackers do not expose precise infrastructure locations to unauthenticated users.
118492. **Technician field-app authorization mapper** — check that field-service apps grant site and subscriber access per work order only, preventing after-hours unauthorized visits.
118493. **Network-telemetry endpoint exposure scanner** — detect Prometheus, Grafana, and NOC dashboards reachable without authentication, since they leak topology and subscriber counts.
118494. **CNF CI/CD pipeline-integrity reviewer** — verify containerized network-function builds use signed images and immutable tags so a compromised pipeline cannot ship rogue core code.
118495. **RAN vendor-security assurance tracker** — map each RAN software version against NESAS and SECAM assessments so unassessed builds are flagged before deployment.
118496. **Closed-loop automation guardrail checker** — verify self-healing network actions require policy bounds and rollback plans, since unbounded automation can blackhole legitimate traffic.
118497. **Fraud-management-system rule-coverage reviewer** — audit FMS detection rules against known subscription, SIM-box, and bypass-fraud patterns so coverage gaps are explicit.
118498. **Revenue-assurance CDR-reconciliation engine** — automate CDR-to-invoice matching across rating, billing, and interconnect so leakage is quantified rather than estimated.
118499. **SIM-box bypass-fraud detector** — analyze call-detail patterns for gateway signatures so international bypass fraud is flagged before settlement.
118500. **Roaming-steering integrity checker** — verify preferred-network lists cannot be overridden by untrusted OTA updates, since steering manipulation inflates roaming costs.
118501. **eKYC SIM-registration fraud reviewer** — audit biometric and document verification steps for liveness and deduplication so one identity cannot register unlimited SIMs.
118502. **Voucher-generation entropy auditor** — verify top-up voucher codes are generated with cryptographic randomness and issuance is reconciled, blocking predictable-code fraud.
118503. **First-party subscription-fraud scorer** — combine device, identity, and payment signals at activation to flag never-pay-intent accounts before network costs accrue.
118504. **Disaster-roaming readiness verifier** — test emergency roaming and network-sharing agreements activate correctly under simulated outages so subscribers stay connected during crises.
118505. **CAD API access-control mapper** — enumerates every computer-aided-dispatch endpoint and the exact role each requires, so dispatcher, supervisor, and read-only roles cannot reach privileged operations through a missing check.
118506. **Public-alert signature verifier** — validates that outbound Common Alerting Protocol messages carry valid cryptographic signatures from the issuing authority, preventing spoofed emergency broadcasts from being trusted.
118507. **Dispatch-queue integrity monitor** — watches the live incident queue for insertions, reorderings, or deletions that bypass normal triage rules, catching tampering that could delay critical calls.
118508. **Responder-app session security reviewer** — audits mobile responder app tokens for expiry, rotation, and binding so a stolen or replayed session cannot impersonate a crew member.
118509. **False-alarm injection-surface reviewer** — maps every input path (public tip lines, web forms, sensor feeds) that can inject incidents into the CAD pipeline, since each one is a spoofed-dispatch opportunity.
118510. **Geofenced-alert targeting accuracy checker** — tests whether polygon-targeted alerts reach exactly the intended zone without bleeding into neighboring areas, because mis-targeted alerts erode public trust.
118511. **Mutual-aid data-sharing scope auditor** — verifies that inter-agency incident sharing exposes only the fields the agreement allows, preventing sensitive caller data from leaking to partner systems.
118512. **PSAP failover readiness tester** — exercises the switchover between primary and backup public-safety-answering points so a facility outage does not silently drop incoming emergency calls.
118513. **Crisis-hotline privacy reviewer** — checks that hotline call recordings, transcripts, and callback numbers are access-restricted and retention-limited, protecting vulnerable callers.
118514. **Mass-notification rate-integrity checker** — validates that bulk alert throttling and retry logic cannot be abused to flood or suppress notifications, keeping delivery predictable under load.
118515. **911-call taker authentication mapper** — reviews how call-taker workstations authenticate and time out, because shared or lingering sessions can let unauthorized staff touch live calls.
118516. **Emergency-location data accuracy auditor** — compares Advanced Mobile Location fixes against carrier-provided coordinates to flag drift that would send responders to the wrong address.
118517. **Incident-ticket tamper-evidence checker** — verifies that CAD incident records are append-only with signed audit trails, so post-hoc edits to response times or notes are detectable.
118518. **Dispatcher role-escalation path mapper** — models how low-privilege dispatch staff might reach supervisor functions, surfacing composite authorization gaps a single-role review would miss.
118519. **Alert-cap code validation tester** — confirms the alert-originating system rejects malformed or unsigned CAP messages before ingestion, since a poisoned feed can trigger mass false alarms.
118520. **Responder location-share consent auditor** — checks that continuous GPS sharing by field units is opt-in, scoped to active incidents, and stops when the shift ends, protecting responder privacy.
118521. **Public-tip ingestion filter reviewer** — tests rate limiting, deduplication, and abuse scoring on public tip forms so prank floods cannot bury genuine emergency reports.
118522. **Dispatch audio-log retention auditor** — verifies recorded call audio is encrypted at rest with a documented retention and purge policy, limiting exposure of sensitive emergency conversations.
118523. **Alternate-route dispatch readiness checker** — confirms the CAD can reroute units when bridges or roads are closed, and that the reroute logic cannot be tricked into sending crews off-course.
118524. **Hospital handoff data minimizer** — audits the patient-data fields pushed to hospital receiving systems during dispatch so only clinically necessary data travels with the unit.
118525. **Evacuation-alert language-coverage checker** — tests that multilingual alert templates render correctly for every supported language before sending, since broken translations can cause deadly confusion.
118526. **Alert-deduplication logic tester** — validates that duplicate incident reports from multiple sources merge into one ticket rather than spawning parallel responses that waste crews.
118527. **Incident-commander delegation tracker** — maps how command authority transfers between agencies during escalating incidents, exposing gaps where no one holds clear control.
118528. **Responder-device attestation checker** — verifies field devices pass device-integrity checks before receiving sensitive incident data, keeping compromised phones out of the dispatch loop.
118529. **Emergency-push notification forgery tester** — confirms push notifications to responders are signed and bound to the correct incident, since forged pushes could redirect crews to fake emergencies.
118530. **CAD webhook secret hygiene auditor** — scans dispatch webhooks for hardcoded secrets and missing signature verification, because unsecured webhooks let attackers inject status updates.
118531. **After-action report privacy scrubber** — checks that exported incident summaries redact caller identities and exact locations by default, enabling public transparency without doxxing victims.
118532. **Mass-casualty triage tagging reviewer** — audits the digital triage-tag system for access controls so tags marking victim severity cannot be altered by unauthorized parties mid-incident.
118533. **PSAP call-recording consent notice checker** — verifies callers hear required recording disclosures before sensitive information is captured, keeping the center compliant across jurisdictions.
118534. **Dispatch GIS layer integrity monitor** — watches map layers (hydrants, hazards, access points) for unauthorized edits, since poisoned GIS data misroutes fire crews.
118535. **Responder fatigue-window enforcer** — tests that scheduling systems flag or block dispatches to crews exceeding safe duty hours, preventing exhaustion-driven mistakes.
118536. **Emergency-broadcast override guard** — reviews who can seize public-warning channels for override messages and under what dual-approval rules, so a single compromised account cannot hijack alerts.
118537. **Incident attachment malware scanner** — checks that photos and documents uploaded to incident tickets are scanned before dispatchers open them, blocking phishing through the CAD.
118538. **Silent-alarm verification flow tester** — validates the challenge-response steps for bank and alarm-panel silent alarms so false dispatches do not desensitize responders.
118539. **Responder panic-button reliability checker** — tests that officer-down panic signals transmit even with poor connectivity and cannot be cancelled without strong authentication.
118540. **Dispatch transcript search-scope limiter** — audits full-text search over call transcripts so only authorized roles can query sensitive content, preventing fishing through caller histories.
118541. **Emergency SMS gateway abuse reviewer** — checks text-to-911 gateways for sender-spoofing and flood controls, since SMS is the easiest channel to forge at scale.
118542. **CAD tenant-isolation verifier** — for multi-agency CAD platforms, confirms one agency cannot see or modify another agency's incidents through shared indexes or APIs.
118543. **Alert-acknowledgement spoofing tester** — validates that responder acknowledgements of alerts are authenticated, preventing fake "crew en route" statuses from delaying real help.
118544. **Emergency-data API pagination guard** — reviews bulk-export endpoints for safe pagination and export limits so a single credential cannot dump the entire incident database.
118545. **Responder credential recovery flow tester** — audits password-reset and device-replacement flows for field staff so a lost phone does not become permanent unauthorized access.
118546. **Incident-priority override auditor** — logs and reviews every manual priority change to incidents, since silent reprioritization can bury urgent calls.
118547. **Public-alert preview approval checker** — confirms draft alerts require a second set of eyes before broadcast, reducing the chance of panicking a population with a typo-ridden warning.
118548. **Dispatch console idle-lock tester** — verifies unattended CAD consoles lock within policy time, preventing walk-up access to live incident data.
118549. **Responder shift-handoff integrity checker** — tests that active incident context transfers cleanly between outgoing and incoming crews without data loss or duplicated assignments.
118550. **Emergency-vehicle telemetry access auditor** — reviews who can query live unit locations and speeds, since that data enables ambushes of responders.
118551. **CAD third-party integration inventory** — catalogs every external system plugged into the CAD (alarms, sensors, RMS) and the credentials each uses, so stale integrations are visible.
118552. **Alert-channel delivery reconciliation tester** — compares send logs across SMS, email, app push, and sirens to detect silent channel failures where an alert appeared sent but never arrived.
118553. **Dispatch AI transcription accuracy reviewer** — audits speech-to-text on emergency calls for error patterns that could misrecord addresses, drug names, or suspect descriptions.
118554. **Crisis-map public view limiter** — checks that public-facing incident maps show aggregated or delayed data rather than real-time responder positions, protecting tactical operations.
118555. **Emergency-contact verification flow tester** — validates that registered emergency contacts actually opted in and can be reached, since stale contact lists fail during real crises.
118556. **PSAP network segmentation reviewer** — audits whether call-taking networks are isolated from general IT networks, limiting lateral movement from a phishing compromise.
118557. **Incident reopen-window policy checker** — tests that closed incidents can only be reopened by authorized roles within a defined window, preventing quiet case tampering.
118558. **Responder-app offline-cache security tester** — checks that incident data cached on devices for offline use is encrypted and auto-wipes after policy expiry, since lost phones are common.
118559. **Emergency-drill mode isolation verifier** — confirms drill and exercise traffic is clearly tagged and cannot leak into live dispatch queues or public alert channels.
118560. **CAD search-injection resilience tester** — probes dispatch search fields for injection flaws that could expose incident records, using only benign payloads on the authorized target.
118561. **Alert expiry and cancellation integrity checker** — validates that alert cancellations propagate to every channel and that expired alerts are withdrawn, preventing stale warnings from lingering.
118562. **Mutual-aid credential lifecycle auditor** — tracks API credentials shared with partner agencies for rotation and revocation, since abandoned partner keys are a quiet backdoor.
118563. **Responder bodycam upload integrity checker** — verifies that uploaded bodycam footage is checksummed and tamper-evident before it becomes incident evidence.
118564. **Emergency-notification template versioner** — ensures alert templates are version-controlled and every sent alert records which version was used, enabling post-incident review.
118565. **Dispatch queue priority-inversion detector** — flags cases where low-priority incidents jump ahead of life-threatening ones due to logic errors, since queue fairness is a safety property.
118566. **Public-alert opt-out compliance checker** — verifies emergency alert systems respect lawful opt-outs without degrading mandatory life-safety messages, balancing compliance and coverage.
118567. **Incident-media redaction reviewer** — audits automatic blurring of faces and license plates in incident photos shared across agencies, reducing unnecessary privacy exposure.
118568. **Responder mental-health resource privacy tester** — checks that crisis-support tools offered to field staff keep usage data separate from performance records, protecting help-seeking behavior.
118569. **Emergency-API deprecation tracker** — monitors old dispatch API versions still accepting traffic so agencies migrate before unsupported endpoints become the weakest link.
118570. **CAD clock-synchronization verifier** — confirms all dispatch nodes share a synchronized time source, since skewed clocks corrupt response-time metrics and audit ordering.
118571. **Alert-geo fence overlap resolver** — tests how the system handles overlapping alert polygons from different authorities so citizens receive one coherent warning instead of conflicting ones.
118572. **Responder-credential phishing-resistance tester** — evaluates whether dispatch staff credentials support phishing-resistant MFA, since call centers are prime social-engineering targets.
118573. **Incident-narrative edit-history auditor** — verifies every change to free-text incident narratives keeps an author-stamped history, making quiet rewrites of events impossible.
118574. **Emergency-fallback communication tester** — checks that the platform degrades gracefully to radio, SMS, or printed run-cards when data networks fail, keeping dispatch alive offline.
118575. **CAD bulk-import validation reviewer** — audits CSV and feed imports of addresses, units, and zones for validation that rejects poisoned records before they enter the live map.
118576. **Alert-response link safety checker** — scans links embedded in public alerts for hijackable or unregistered domains, since citizens click alert links without suspicion.
118577. **Responder-unit impersonation detector** — monitors for duplicate unit identifiers or callsigns appearing in the CAD, catching spoofed units that could divert real assignments.
118578. **Emergency-data export watermark tester** — verifies sensitive exports carry requester watermarks so leaked incident data can be traced back to its source.
118579. **Dispatch-language line access auditor** — reviews interpreter-service integrations for authentication so attackers cannot eavesdrop on or disrupt translated emergency calls.
118580. **Incident-heatmap aggregation privacy checker** — ensures public crime and incident heatmaps use aggregation thresholds that prevent identifying individual victims or addresses.
118581. **Responder check-in anomaly detector** — flags missed or abnormal crew check-ins during incidents so a silent mayday is never lost in routine traffic.
118582. **Emergency-broadcast schedule-integrity tester** — validates that scheduled test alerts and real alerts use separate pipelines and cannot be confused by operators or the public.
118583. **CAD single-sign-on scope reviewer** — audits SSO token scopes for dispatch platforms to confirm a compromised SSO session cannot reach incident data beyond the user's role.
118584. **Public-alert feedback-loop analyzer** — checks that citizen replies and confirmations to alerts are aggregated safely without exposing individual responder data or locations.
118585. **Responder-route history minimizer** — audits retention of historical unit routes so movement patterns older than policy are purged, limiting surveillance value of the dataset.
118586. **Emergency-contact data breach drill tester** — runs a simulated contact-data exposure to verify the platform can notify affected citizens within its stated SLA.
118587. **Incident-cross-reference leakage checker** — tests whether linking an incident to related cases exposes fields from cases the viewer is not authorized to see.
118588. **Dispatch-workstation USB policy auditor** — reviews device-control policies on CAD workstations so removable media cannot introduce malware into the call-taking environment.
118589. **Alert-translation chain integrity tester** — validates machine-translated alert text against the source meaning for critical fields like evacuation zones and deadlines, catching dangerous mistranslations.
118590. **Responder-app notification-content minimizer** — checks that lock-screen push previews omit sensitive incident details, since phones are visible to bystanders.
118591. **Emergency-API rate-card fairness tester** — validates that API throttling treats all authorized integrators equally under load so no agency's alerts are starved during a surge.
118592. **CAD incident-merge conflict resolver** — tests how the system resolves conflicts when duplicate tickets merge, ensuring the surviving record keeps the correct timeline and attachments.
118593. **Responder fatigue-alert privacy guard** — confirms biometric or hours-based fatigue alerts go to supervisors only in aggregate, not as individually punitive surveillance.
118594. **Emergency-drone feed access auditor** — reviews who can view live drone or helicopter video feeds during incidents, since aerial footage reveals tactical positions.
118595. **Alert-sender reputation tracker** — builds a reputation history for each authorized alert originator so anomalous first-time or hijacked senders trigger extra verification.
118596. **Dispatch GIS offline-pack integrity checker** — verifies offline map packages on responder devices are signed and current, so crews never navigate from stale or tampered maps.
118597. **Incident-debrief access limiter** — audits who can open post-incident debrief materials containing candid performance notes, keeping honest reviews safe from misuse.
118598. **Emergency-paywall bypass reviewer** — checks that critical public-safety information is never gated behind subscriptions or logins during active emergencies, even on publisher partner sites.
118599. **Responder-radio gateway security tester** — audits IP gateways bridging radio networks to dispatch software for authentication, since an open gateway can inject fake radio traffic.
118600. **CAD backup-restore integrity verifier** — tests that dispatch database backups restore cleanly and completely, because a backup that fails during a ransomware event is a single point of failure.
118601. **Alert-targeting demographic-bias checker** — analyzes whether geofenced alerts systematically under-cover vulnerable neighborhoods, surfacing equity gaps in public-warning reach.
118602. **Emergency-voice menu injection tester** — probes IVR menus for text-to-911 and call-routing systems for injection flaws using benign inputs, since IVR paths are rarely security-reviewed.
118603. **Responder-incident note-sharing scope tester** — verifies private crew notes attached to incidents do not leak to public portals or partner agencies outside the sharing agreement.
118604. **Crisis-communication failover drill auditor** — reviews the documented and tested failover sequence for the entire crisis-communication stack, ensuring one outage cannot silence every channel at once.
118605. **Pipeline secret-vault adoption auditor** — scan every ETL/ELT pipeline definition for hardcoded credentials and flag any that bypass the team's secret vault, since a single leaked pipeline secret can unlock entire data estates.
118606. **ETL credential-rotation freshness checker** — verify that pipeline service credentials rotate on the declared schedule, because stale credentials in scheduled jobs are long-lived keys attackers love to harvest.
118607. **Lakehouse ACL drift sentinel** — snapshot table and catalog access-control lists nightly and alert when permissions widen without an approved change, catching silent privilege creep on authorized data lakes.
118608. **Kafka topic-ACL census mapper** — build a complete map of every topic's producer/consumer ACLs so over-broad wildcards and orphaned service accounts become visible review items instead of hidden risk.
118609. **Schema-registry compatibility gatekeeper** — test proposed schema changes against compatibility rules before they land, since a breaking schema can poison downstream consumers and analytics silently.
118610. **Warehouse row-filter penetration tester** — probe row-level-security policies with crafted query patterns to confirm tenants genuinely cannot see each other's rows on the authorized warehouse.
118611. **dbt model-permission graph analyzer** — trace which roles can read each dbt model and its upstream sources, exposing models that quietly inherit broader access than their owners intended.
118612. **PII column-masking coverage verifier** — sample masked columns across the warehouse and confirm masking functions actually hide values, because a misconfigured mask leaks sensitive data in plain sight.
118613. **Analytics API tenant-boundary tester** — exercise analytics endpoints with cross-tenant identifiers to verify the API enforces tenant scoping on every aggregation, filter, and export path.
118614. **Pipeline lineage-integrity monitor** — hash lineage records at each pipeline stage and alert on tampering, so manipulated lineage cannot hide where sensitive data really flowed.
118615. **Backfill job authorization reviewer** — check that historical backfill jobs run under scoped, audited identities rather than superuser service accounts, since backfills touch the widest data ranges.
118616. **Spark job credential-exposure watcher** — scan Spark driver logs, event logs, and UI pages for echoed credentials, because verbose job logging is a classic silent secret leak.
118617. **Airflow connection-credential auditor** — inventory every Airflow connection and verify secrets resolve from the vault with least-privilege scopes, flagging connections that carry excess database rights.
118618. **DAG code-injection surface reviewer** — review DAG definitions and templated fields for unsafe rendering of user-controlled variables, since orchestration code runs with pipeline privileges.
118619. **Stream consumer-offset tamper detector** — monitor consumer-group offsets for anomalous resets or seeks that skip audit-relevant events, catching attempts to silently drop records.
118620. **Topic naming-convention policy checker** — validate that new topics follow the team's naming and classification conventions, because unclassified topics escape data-governance controls by default.
118621. **Schema-evolution backward-compatibility tester** — replay recorded production payloads against candidate schemas to catch fields that would break consumers, protecting analytics reliability on authorized targets.
118622. **Data-lake storage-policy census** — enumerate bucket and prefix-level policies across the lake to find publicly readable or cross-account-writable paths before they become leaks.
118623. **External-table credential-leak reviewer** — inspect external table definitions for embedded storage keys and signed tokens, replacing them with scoped managed identities where possible.
118624. **Copy-activity source-credential rotation checker** — confirm that data-copy activities use short-lived, auto-rotated credentials instead of permanent keys that survive employee departures.
118625. **Pipeline telemetry PII-scrub auditor** — run sample PII patterns through pipeline logs and confirm scrubbing rules fire, since unredacted logs turn operational telemetry into a data breach.
118626. **Quarantine-zone write-access monitor** — alert when identities outside the data-quality team write to quarantine zones, because quarantine data is often the most sensitive raw input.
118627. **Lake-layer promotion gate reviewer** — verify bronze-to-silver-to-gold promotions enforce schema, quality, and approval gates, preventing unreviewed data from reaching executive dashboards.
118628. **Time-travel privilege tester** — confirm that warehouse time-travel and snapshot queries respect the same row and column policies as live queries, since historical access often bypasses fresh controls.
118629. **Delta transaction-log edit detector** — watch lakehouse transaction logs for out-of-band edits or deletions, flagging anyone rewriting history outside the approved pipeline.
118630. **Streaming checkpoint authorization reviewer** — verify that checkpoint and state-store restores require elevated, audited approval, because a malicious checkpoint can rewind or corrupt stream state.
118631. **Connector plugin-vulnerability inventory** — list every streaming connector plugin version in use and match it against known advisories, since connectors run with broad source and sink privileges.
118632. **Change-data-capture permission auditor** — review CDC source permissions to ensure capture agents read only their assigned tables, preventing one integration from siphoning the whole database.
118633. **CDC stream exposure mapper** — map which downstream topics and teams receive each captured table's change feed, so sensitive table changes don't fan out to unauthorized consumers.
118634. **Warehouse query-history PII-leak reviewer** — scan query-history and result caches for queries that returned unmasked PII, turning the audit trail into a detection source.
118635. **Materialized-view refresh permission checker** — verify refresh jobs run with the minimum role needed and cannot be triggered by unprivileged users to escalate via scheduled compute.
118636. **dbt seed-file secret scanner** — scan versioned dbt seed CSVs and fixtures for embedded credentials or real customer rows, since seeds ship with the repo to every developer.
118637. **dbt docs-site exposure reviewer** — check that generated dbt documentation sites don't expose column descriptions, owner emails, or sample data beyond the intended audience.
118638. **Jinja template-injection guard** — test dbt Jinja rendering contexts for injection of untrusted variables, because template evaluation happens with the pipeline's database privileges.
118639. **dbt macro privilege reviewer** — audit shared macros for operations that exceed their documented purpose, since one risky macro multiplies across every model that calls it.
118640. **Warehouse role-hierarchy mapper** — render the full role-inheritance tree of the authorized warehouse to surface hidden paths where a low-privilege role inherits administrative rights.
118641. **Column-level policy tester** — probe column-level security grants with targeted queries to confirm restricted columns stay hidden even through views, joins, and aggregations.
118642. **Dynamic-masking consistency checker** — compare masking behavior across warehouse, BI extracts, and API outputs to catch columns masked in one surface but raw in another.
118643. **Table-version rollback permission auditor** — verify that restoring older table versions requires change approval, since rollbacks can resurrect data that was deleted for compliance.
118644. **Partition-level boundary tester** — test whether partition pruning and partition filters can be bypassed to read restricted partitions, closing a subtle gap in large partitioned tables.
118645. **Stream-join enrichment PII-bleed detector** — inspect stream-enrichment joins for cases where lookup data adds PII to events that downstream consumers aren't cleared to see.
118646. **Windowing-state checkpoint leak reviewer** — check that streaming window state snapshots don't persist unmasked PII to durable storage readable by broader teams.
118647. **Idempotency-key collision auditor** — review exactly-once pipeline idempotency keys for predictable patterns that could let duplicate or forged events slip through dedup.
118648. **Dead-letter-queue payload reviewer** — scan dead-letter queues for sensitive payloads sitting unencrypted, since failed events often contain the rawest, most sensitive data.
118649. **Pipeline failure-alert data-leak checker** — verify alert notifications and incident payloads strip PII before reaching chat channels and pagers, where the widest audience sees them.
118650. **Retry-queue replay-risk reviewer** — assess whether retried messages can be replayed out of order or duplicated in ways that corrupt downstream state or double-apply financial events.
118651. **Registry subject-naming strategy auditor** — verify schema-registry subject naming enforces team ownership and compatibility scope, preventing one team from overwriting another's schema.
118652. **Schema default-value leak checker** — flag schema defaults that inject placeholder PII or internal identifiers into every new record, quietly polluting clean datasets.
118653. **Deserializer hardening reviewer** — check that streaming deserializers reject malformed or oversized payloads safely, since deserialization runs before any business validation.
118654. **Pipeline artifact-registry credential reviewer** — audit credentials used to pull pipeline artifacts and images, replacing long-lived tokens with scoped, expiring ones.
118655. **Runner image pull-secret auditor** — verify pipeline runner hosts authenticate to image registries with least-privilege pull secrets rather than shared admin tokens.
118656. **Ephemeral-runner token-scope reviewer** — confirm short-lived runner tokens carry only the permissions of the current job, so a compromised runner cannot reach unrelated pipelines.
118657. **Orchestrator RBAC gap analyzer** — diff orchestrator role bindings against the documented access model to find users and service accounts with pipeline-admin rights they never needed.
118658. **Cross-workspace pipeline-link checker** — review linked workspaces and shared pipeline references for permission mismatches that let one team's job read another team's data.
118659. **Notebook cluster-credential inheritance reviewer** — check that notebooks attached to shared clusters don't inherit the cluster owner's broad credentials for interactive queries.
118660. **Notebook magic-command exfiltration guard** — monitor notebook shell and filesystem magics for data-exfiltration patterns during authorized testing, since notebooks blend code with credentials.
118661. **Temporary-view privilege-leak tester** — verify temporary and session-scoped views can't be used to launder access to restricted base tables across sessions.
118662. **User-defined-function sandbox reviewer** — test UDF execution boundaries for escapes into filesystem or network access, because UDFs run inside the warehouse trust zone.
118663. **Stored-procedure caller-rights auditor** — confirm procedures execute with the caller's rights rather than the definer's where appropriate, preventing privilege laundering through shared procedures.
118664. **External-function egress reviewer** — audit external and remote functions for unrestricted network egress, since they can ship warehouse data to arbitrary endpoints.
118665. **Secure data-share boundary tester** — probe shared datasets and secure views for paths that let recipients see beyond their entitled slice of the shared data.
118666. **Clean-room query-exfiltration reviewer** — test data-clean-room controls for query patterns that smuggle individual-level rows out through aggregates and repeated querying.
118667. **Analytics embed-token scope tester** — verify embedded dashboard tokens restrict data to the embedding context, so a token minted for one customer can't be replayed for another.
118668. **Dashboard data-filter circumvention tester** — attempt to bypass dashboard-level data filters via direct API calls and URL manipulation on the authorized analytics deployment.
118669. **Scheduled-export recipient reviewer** — audit scheduled report exports for recipient lists, verifying only authorized addresses receive extracts that may contain sensitive rows.
118670. **CSV-export PII-inclusion checker** — scan self-service export paths to confirm they apply the same masking as the UI, since exports are where masked data most often escapes raw.
118671. **Pagination-cursor authorization tester** — test whether API pagination cursors can be manipulated to page into other tenants' result sets on authorized analytics APIs.
118672. **Analytics resolver field-authorization reviewer** — probe GraphQL analytics resolvers field by field to confirm restricted fields stay hidden even when nested in allowed queries.
118673. **Analytics endpoint abuse sentinel** — baseline analytics API query cost and alert on patterns that look like systematic data harvesting rather than normal dashboard use.
118674. **Webhook delivery-secret rotation auditor** — verify pipeline and streaming webhook secrets rotate and are verified per delivery, preventing forged events from entering the pipeline.
118675. **Sink-connector credential auditor** — inventory every streaming sink connector's credentials and confirm each is scoped to its single destination, since sinks hold write keys to production systems.
118676. **Object-store sink path-traversal reviewer** — test object-store sink paths for traversal patterns that could let a compromised stream write outside its designated prefix.
118677. **JDBC sink injection-surface checker** — review JDBC sink configurations for dynamic SQL construction from stream fields, closing an injection path into downstream databases.
118678. **Search-index sink permission auditor** — verify search-sink indices enforce document-level permissions matching the source, so indexed copies don't out-permission the warehouse.
118679. **Broker super-user sprawl detector** — list streaming broker super-users and flag accounts that no longer need cluster-admin power, shrinking the blast radius of a compromise.
118680. **SASL mechanism-strength reviewer** — verify brokers and clients negotiate strong SASL mechanisms and reject legacy plaintext authentication on the authorized cluster.
118681. **Broker mTLS rotation watcher** — track certificate expiry and rotation across streaming brokers and clients, alerting before stale certificates force insecure fallbacks.
118682. **Compacted-topic PII-residue checker** — scan compacted topics for tombstoned records whose sensitive values linger in older segments, since compaction doesn't always erase promptly.
118683. **Retention-policy compliance auditor** — verify topic and table retention settings actually delete data on schedule, because over-retention turns the platform into an undeclared archive.
118684. **Erasure-propagation verifier** — trace a deletion request from the warehouse through lake layers, streams, and caches to confirm personal data is really gone everywhere.
118685. **Stream-replay erasure blocker** — verify replayed or reprocessed streams can't resurrect records that were deleted for privacy compliance.
118686. **Consent-flag lineage tracker** — follow consent and opt-out flags through every pipeline stage to confirm downstream datasets honor them before use.
118687. **Data-classification tag coverage mapper** — measure what fraction of tables, topics, and columns carry classification tags, since untagged data escapes every policy that keys off tags.
118688. **Sensitive-column discovery crawler** — scan the lakehouse for columns matching sensitive-data patterns that were never registered, closing the gap between actual and governed data.
118689. **Lakehouse audit-log tamper detector** — monitor audit-log pipelines for gaps, delays, or edits that suggest someone is covering tracks in the data platform.
118690. **Query-attribution identity resolver** — verify every warehouse query attributes to a real human or service identity, since unattributed queries hide who touched sensitive data.
118691. **Service-account anomaly sentinel** — baseline service-account query patterns and alert on sudden shifts in volume, tables, or hours that suggest credential misuse.
118692. **Pipeline deploy-key lifecycle auditor** — track deployment keys for pipeline repos from creation to rotation to revocation, flagging keys that outlive their projects.
118693. **Pipeline-definition change reviewer** — diff pipeline code changes for permission widening, new external calls, or added data sources before they reach production.
118694. **CI secret-masking verifier** — run canary secrets through pipeline CI logs to confirm masking rules hide them, since CI output is visible to the broadest audience.
118695. **Test-data snapshot leak checker** — verify test and staging datasets derived from production snapshots are masked or synthetic, preventing production data from living in low-security environments.
118696. **Synthetic-data privacy balancer** — assess synthetic datasets for re-identification risk against the source, ensuring test data stays useful without staying personal.
118697. **Feature-store access-consistency reviewer** — verify online and offline feature stores enforce the same access controls, since training pipelines often read the less-guarded offline copy.
118698. **Feature-serving authorization tester** — probe feature-serving endpoints to confirm callers only receive features for entities they're entitled to see.
118699. **Training-set origin-trail reviewer** — verify training datasets carry complete origin records, so poisoned or unlicensed data can be traced and removed.
118700. **Model-artifact registry access auditor** — review who can publish, overwrite, or download model artifacts, since a swapped artifact silently changes production behavior.
118701. **Experiment-tracker isolation tester** — verify multi-tenant experiment-tracking servers isolate runs, artifacts, and secrets between teams on the authorized platform.
118702. **Cost-tag tamper detector** — monitor pipeline cost-allocation tags for manipulation that could hide expensive or unauthorized workloads from chargeback.
118703. **Orphaned-resource access reviewer** — find abandoned pipelines, topics, and tables that still hold valid credentials and live data, then queue them for decommission review.
118704. **Data-contract breaking-change reviewer** — test proposed data-contract changes against consumer compatibility before merge, preventing silent breakage of downstream teams' pipelines.
118705. **Immutable-vault policy conformance verifier** — scans the target's backup repositories for immutability/WORM flags and reports any vault or bucket missing object-lock protection so ransomware cannot silently rewrite the last good copy.
118706. **Retention-lock duration compliance checker** — compares each vault's lock period against the policy baseline (e.g., 30/90/365 days) and flags shortened or disabled locks that erode guaranteed retention.
118707. **WORM-mode coverage inventory** — builds an account-by-account map of which storage volumes and backup targets run in write-once-read-many mode so gaps are visible instead of assumed.
118708. **Vault-admin separation reviewer** — checks that backup-vault administrator roles are assigned to a different identity set than production admins, limiting blast radius if production credentials are compromised.
118709. **Snapshot-deletion protection auditor** — verifies deletion-protection, MFA-delete, and recycle-bin retention on volume snapshots so an attacker with console access cannot wipe recovery points.
118710. **Recycle-bin purge-guard checker** — confirms soft-delete and purge-protection timers are enabled on backup containers, since fast permanent deletion is the first thing ransomware operators attempt.
118711. **Backup-job completion ledger** — aggregates per-job success, warning, and failure states into a single ledger so one glance shows whether every protected asset actually completed its last backup window.
118712. **Failed-job alert-path verifier** — traces each backup failure to its notification destination (queue, on-call rota, SIEM) and flags jobs whose failures would die silently.
118713. **Retention-window gap detector** — finds assets whose backup schedule and retention settings leave uncovered hours or days between copies, turning implicit gaps into explicit findings.
118714. **Off-site copy sufficiency mapper** — validates that each critical dataset keeps at least one geographically separated replica, because a single-region backup fails the same incident as the primary.
118715. **Air-gap replication lag monitor** — measures how stale the air-gapped or logically isolated replica is against the freshness target so recovery teams know the true rollback horizon.
118716. **Isolated-recovery-environment readiness checker** — verifies the clean-room VPC or lab exists, boots, and can mount backup media without touching production networks.
118717. **Backup-dependency isolation analyzer** — maps which production services the backup infrastructure itself depends on (DNS, identity, monitoring) and flags circular dependencies that die together.
118718. **Recovery-time-objective drift tracker** — trends measured restore durations per tier against the declared RTO and flags tiers that have quietly slipped past their committed window.
118719. **Recovery-point-objective shortfall detector** — compares actual backup intervals with each tier's RPO commitment and surfaces tiers losing more data per incident than promised.
118720. **Service-priority tier assignment reviewer** — audits which systems sit in tier-1 recovery priority versus which carry the real revenue or safety load, catching stale classifications.
118721. **Critical-asset recovery-order mapper** — produces the dependency-ordered sequence for rebuilding core services so restore teams do not waste hours on services blocked by unrecovered dependencies.
118722. **Identity-system rebuild sequence planner** — documents the exact order for restoring directory, MFA, and certificate services first, since everything else authenticates against them.
118723. **Directory-services restore-order checker** — validates that domain controllers, identity stores, and federation endpoints have an explicit rebuild order with no circular prerequisites.
118724. **DNS-infrastructure recovery primer** — confirms authoritative DNS zones, registrars, and glue records are backed up independently of the web estate they resolve.
118725. **Clean-room restore workflow validator** — rehearses the isolated restore procedure end to end (mount, scan, rebuild) and records which steps lack scripts or owner assignments.
118726. **Backup-malware scan status tracker** — tracks whether recent backup images were scanned for persistence artifacts before being promoted as the trusted restore source.
118727. **Post-restore integrity spot-checker** — defines checksum and service-health spot checks to run immediately after a restore so corrupted or tampered images are caught before cutover.
118728. **Restored-data staleness assessor** — quantifies how old the data in each restore point is in business terms (orders, records, sessions lost) so leaders choose restore points with eyes open.
118729. **Encryption-key custody review** — inventories who holds backup encryption keys, where duplicates live, and whether any single person or system is a single point of custody failure.
118730. **Key-escrow accessibility verifier** — tests that escrowed keys can actually be retrieved by the designated recovery officers within the documented time, not just that escrow exists on paper.
118731. **Offline-key copy existence checker** — confirms a hardware or paper backup of master keys exists outside the systems those keys protect, preventing lockout when the KMS itself is down.
118732. **HSM-backed key separation reviewer** — checks that production and backup key hierarchies live in separate HSM partitions or devices so one compromised module cannot yield both.
118733. **Backup-encryption algorithm inventory** — lists the ciphers and key lengths in use across backup products and flags deprecated algorithms before they become audit findings.
118734. **Unencrypted-snapshot flagger** — scans for snapshots and replicas stored without encryption at rest, prioritizing any that contain regulated or customer data.
118735. **Customer-managed-key adoption tracker** — measures how much of the estate uses customer-managed keys versus provider defaults so key-ownership commitments stay honest.
118736. **Restore-access approval workflow auditor** — verifies that restore operations require multi-party approval and that the workflow is enforced in the tooling, not just written in a runbook.
118737. **Privileged-restore session recorder** — confirms all restore sessions are logged, time-boxed, and replayable so emergency access leaves a complete audit trail.
118738. **Just-in-time restore elevation checker** — checks that restore privileges are granted temporarily per incident and auto-revoked, rather than persisting on standing accounts.
118739. **Vault-token scope minimizer** — reviews API tokens and service credentials for the backup vault and flags overly broad scopes that could delete or export everything.
118740. **Service-account restore-role reviewer** — audits machine identities with restore rights and removes dormant or duplicated accounts that expand the attack surface.
118741. **Emergency-access account readiness checker** — verifies break-glass accounts exist, are tested, and are reachable when primary identity systems are down.
118742. **Break-glass credential inventory** — maintains a sealed, audited list of emergency credentials with last-verified dates so nobody discovers a dead fallback mid-incident.
118743. **Out-of-band communication roster verifier** — confirms the incident team has a working secondary channel (phone tree, external chat) that does not depend on compromised internal systems.
118744. **Incident-command roster freshness checker** — validates that on-call rotations, deputies, and executive sponsors in the response plan are current employees with correct contact details.
118745. **Cyber-insurance policy summary auditor** — extracts coverage limits, exclusions, and notification duties from the policy so the team knows what is actually covered before filing a claim.
118746. **Incident-response retainer status checker** — verifies the IR retainer is active, hours are unexpired, and the engagement number is on file before an incident makes it urgent.
118747. **Ransomware tabletop exercise scheduler** — proposes recurring tabletop dates per business unit and tracks attendance so exercises happen on cadence instead of after the fact.
118748. **Tabletop-scenario library curator** — maintains a set of realistic ransomware scenarios (encrypted hypervisor, exfiltrated backups, double extortion) tailored to the target's actual stack.
118749. **Exercise auto-grader** — scores tabletop responses against the documented playbook (decision times, escalation correctness, communication discipline) and highlights weak steps.
118750. **Participation-attendance tracker** — records which teams and leaders actually attended each exercise so gaps in coverage are visible to management.
118751. **Decision-log capture template** — provides a structured log for incident decisions (who decided, what, when, why) that stands up to post-incident review and regulatory scrutiny.
118752. **Communication-drill script builder** — generates stakeholder notification scripts for each incident phase so legal, PR, and customer teams speak from one approved narrative.
118753. **Ransom-decision playbook linker** — connects the playbook's payment-decision criteria to legal, sanctions, and insurance checkpoints so no payment decision happens in isolation.
118754. **Regulatory-notification deadline mapper** — translates the target's operating jurisdictions into per-regulator breach-notification deadlines so the clock starts correctly at detection.
118755. **Breach-notification readiness checklist** — audits whether contact lists, templates, and evidence packs needed for notifications are prepared and reachable during an outage.
118756. **Law-enforcement liaison contact keeper** — keeps current FBI/CISA or local cyber-police reporting contacts with the exact details investigators will request first.
118757. **Backup-vendor dependency risk mapper** — lists every vendor in the backup chain and scores concentration risk so a single vendor outage cannot strand recovery.
118758. **Vendor-escalation path inventory** — documents support tiers, SLAs, and after-hours numbers for each backup product so escalations do not start with a web-form search.
118759. **Support-contract coverage checker** — verifies maintenance and support contracts for backup hardware and software are active and cover incident-hours response.
118760. **Infrastructure-as-code backup coverage** — confirms IaC repositories, pipelines, and state files are versioned and recoverable so infrastructure can be rebuilt from code, not memory.
118761. **Configuration-drift restoration checker** — detects drift between running infrastructure and the declared IaC baseline that would make a from-backup rebuild produce a different system.
118762. **Secrets-manager backup inclusion auditor** — verifies secrets, certificates, and rotation state are included in backups with their own recovery procedure, since missing secrets block every restore.
118763. **Certificate-keystore backup verifier** — checks that private keys and certificate chains for TLS, code signing, and VPN are backed up and restorable by the recovery team.
118764. **Container-registry backup policy reviewer** — confirms base images and pinned digests are mirrored to a protected registry so rebuilds do not depend on public registries mid-incident.
118765. **Orchestrator-state backup checker** — verifies cluster state, etcd snapshots, and workload definitions are captured on schedule for container platforms.
118766. **Database point-in-time restore tester** — performs non-destructive restore drills to a sandbox and measures whether point-in-time targets are actually reachable.
118767. **Transaction-log chain integrity checker** — validates log backup chains for breaks or corruption that would silently cap how far back a database can be rolled.
118768. **Replication-topology recovery mapper** — diagrams replica roles and promotion paths so failover order is a known sequence rather than an improvised guess.
118769. **Failover-path test scheduler** — schedules and logs regular failover drills for each critical path, recording measured cutover times against the RTO.
118770. **Load-balancer failover runbook linker** — ties each service's runbook to its load-balancer failover procedure so traffic steering is part of recovery, not an afterthought.
118771. **DNS-failover playbook tester** — validates TTL settings, health checks, and zone transfer procedures that make DNS-level failover work within the promised window.
118772. **Network-segment recovery mapper** — documents which subnets, routes, and peering links must come back in which order for connectivity to be restored.
118773. **Firewall-rule backup inventory** — confirms firewall and security-group rule sets are exported and versioned so network policy can be rebuilt exactly.
118774. **VPN-gateway restore readiness** — checks gateway configurations, certificates, and client profiles are backed up so remote access survives the rebuild.
118775. **Email-system recovery order planner** — sequences mail flow, archiving, and anti-spam restoration since incident coordination often runs over email.
118776. **Messaging-archive restore checker** — verifies chat and collaboration archives are recoverable for e-discovery and post-incident analysis.
118777. **Endpoint-agent reinstall orchestrator** — prepares a mass reinstall path for EDR and management agents so rebuilt endpoints return to protection immediately.
118778. **Patch-baseline restore alignment** — ensures restored systems land at a known patch baseline rather than a stale one that reintroduces fixed vulnerabilities.
118779. **Monitoring-stack rebuild primer** — prioritizes observability restoration early so recovery progress itself can be measured instead of guessed.
118780. **Logging-pipeline continuity planner** — documents how logs keep flowing during an outage so forensic evidence is not lost in the gap.
118781. **SIEM rule-repository backup checker** — verifies detection rules, playbooks, and tuning state are versioned and recoverable with the SIEM.
118782. **Alert-destination failover mapper** — confirms alerting routes to backup channels when the primary notification path is down.
118783. **Data-classification restore prioritizer** — ties recovery order to data classification levels so regulated and crown-jewel data is restored with priority and controls.
118784. **PII-store recovery-order reviewer** — checks that customer data stores have explicit restore priority and privacy safeguards during rebuild.
118785. **Compliance-evidence backup checker** — verifies audit evidence and compliance artifacts are retained immutably and recoverable for regulator requests.
118786. **Audit-log immutability verifier** — confirms security and admin audit logs cannot be altered or deleted within their retention window.
118787. **Ransomware kill-chain mapping workshop** — walks the team through each attack stage against the target's real architecture to expose where detection or recovery breaks.
118788. **Lateral-movement containment rehearsal** — drills rapid segmentation and credential-rotation steps so spread can be cut within minutes of detection.
118789. **Network-segmentation validation drill** — tests that segmentation controls actually block lateral paths assumed safe in diagrams.
118790. **EDR-isolation playbook checker** — verifies endpoint isolation commands work at scale and are authorized for rapid use during an active incident.
118791. **Decryption-tool readiness tracker** — maintains a tested set of legitimate decryption utilities and vendor contacts matched to the ransomware families seen in the threat landscape.
118792. **Known-decryptor catalog linker** — maps free decryptor availability from law-enforcement and vendor sources to the target's threat profile.
118793. **Double-extortion data-leak monitor** — watches leak sites and extortion channels for the target's data so leadership learns of exposure from its own tooling, not the press.
118794. **Leak-site watchlist builder** — maintains a curated list of ransomware leak portals and scrapers relevant to the target's sector with alerting on new posts.
118795. **Dark-web exposure correlator** — correlates stolen-credential and data-sale listings against the target's domains to catch precursor breaches early.
118796. **Ransom-payment decision ledger** — records the criteria, approvals, and legal review for any payment decision so the process is defensible and repeatable.
118797. **Sanctions-screening checklist** — embeds sanctions-list screening into the payment workflow so a ransom payment never violates OFAC or equivalent restrictions.
118798. **Payment-authorization workflow mapper** — documents the multi-signature financial approval path for incident payments, keeping finance aligned before urgency strikes.
118799. **Post-incident lessons-captured checker** — verifies that after-action reviews are scheduled, facilitated, and tracked to remediation within the committed window.
118800. **Recovery-fatigue prevention roster** — plans shift rotations and rest windows for prolonged recoveries so decision quality does not collapse on day three.
118801. **Spare-hardware availability inventory** — tracks on-hand and vendor-committed replacement hardware for critical systems in case recovery needs fresh iron.
118802. **Cloud-region failover cost estimator** — models the cost of sustained region failover so finance can approve recovery spending without a mid-incident debate.
118803. **Recovery-runbook version-control checker** — confirms runbooks live in version control with reviewed changes, so nobody follows an outdated printout during a real incident.
118804. **Disaster-recovery documentation freshness auditor** — audits the age and accuracy of DR documents, contacts, and diagrams, flagging anything older than the review cadence.
118805. **Unsanctioned provider-key census** — scan repos, CI secrets, and client bundles on the authorized target for live third-party model API keys to quantify how much AI traffic bypasses the approved provider.
118806. **Stale AI-credential rotator** — identify AI-provider tokens older than the rotation policy window and queue them for rotation so long-lived keys cannot linger unnoticed.
118807. **Personal-email model-account detector** — correlate expense receipts and OAuth grants to flag employees using personal accounts on model APIs with company data, creating ungoverned egress.
118808. **Browser-extension AI harvest inventory** — catalog browser extensions that pipe page contents to external AI services so data leaving through unvetted helpers is visible.
118809. **Shadow prompt-library mapper** — discover ad-hoc prompt repositories in shared drives and wikis so sanctioned prompt templates can replace unversioned copies.
118810. **Untracked fine-tune job finder** — match GPU-job scheduler records against the approved training ledger to surface fine-tuning runs nobody registered.
118811. **Orphaned inference-endpoint sweeper** — probe the target's DNS and cloud consoles for model-serving endpoints that remain live after their project ended, cutting idle attack surface.
118812. **Inference-endpoint ownership attacher** — resolve every discovered serving endpoint to a owning team and cost center so incident response knows who to call when one misbehaves.
118813. **Endpoint-to-model binding verifier** — confirm each serving endpoint loads the exact approved model artifact by comparing served checksums against registry records, catching silent swaps.
118814. **Deployed-model behavior anomaly watcher** — alert when a production endpoint's answers drift from the approved artifact's expected behavior signature, since unrecorded swaps or edits undermine registry trust.
118815. **Canary-traffic shadow detector** — watch for production traffic fractions quietly routed to unregistered endpoints, since silent canaries evade rollout governance.
118816. **Registry completeness grader** — score the model registry against the full discovered inventory of trained and deployed artifacts so unregistered models get flagged as governance gaps.
118817. **Unregistered artifact quarantine** — automatically isolate model files found on storage but missing from the registry until a custodian claims and documents them.
118818. **Artifact-hash ledger** — record immutable hashes for every trained model binary so tampering or bit-rot is detectable across the artifact's lifetime.
118819. **Checkpoint-lineage chain builder** — link every checkpoint back to its parent run, base model, and dataset snapshot so provenance is a verifiable chain instead of folklore.
118820. **Resume-run provenance fixer** — detect training jobs resumed from stale or foreign checkpoints and annotate the break in lineage so downstream reviewers see the true ancestry.
118821. **Prompt-version diff timeline** — render system-prompt changes as an auditable diff history so a quietly weakened guardrail instruction cannot hide between deploys.
118822. **Prompt rollback validator** — confirm that reverting to a previous prompt version restores prior safety-evaluation scores, catching stateful side effects of prompt edits.
118823. **Guardrail-prompt tamper alarm** — monitor production prompts for edits that remove refusal or citation instructions and alert the AI-governance owner immediately.
118824. **Training-data manifest auditor** — verify each dataset snapshot lists sources, licenses, and collection dates so unlicensed or unlabeled data cannot enter training silently.
118825. **Dataset deduplication overlap scan** — measure overlap between training and evaluation sets to flag leakage that inflates capability claims and weakens safety evidence.
118826. **PII-sweep before training** — run pattern and classifier scans over staged training corpora to quarantine rows containing personal data before a model memorizes them.
118827. **Synthetic-data lineage tagger** — label synthetic rows with the generator model and seed so downstream audits can trace biases back to the generating artifact.
118828. **Data-licensing expiry watcher** — track license terms on third-party training datasets and warn before rights lapse, preventing unlawful continued use.
118829. **Vendor contract coverage mapper** — map every AI vendor in use to an executed agreement with data-processing terms, exposing tools operating on handshake deals.
118830. **Subprocessor chain tracer** — follow each AI vendor's declared subprocessors one level deeper so data handed to a fourth party is no surprise.
118831. **DPA-gap escalation list** — rank vendors lacking data-processing agreements by the volume of personal data they receive, sequencing remediation by exposure.
118832. **Model-card coverage scorer** — grade each registered model on card completeness (intended use, limits, eval results, risks) so thin cards get sent back for substance.
118833. **Intended-use drift monitor** — compare live usage telemetry against each model card's declared intended use, flagging deployments stretched beyond their reviewed purpose.
118834. **Evaluation-gate deploy blocker** — block promotion of any model artifact that lacks a passing safety-evaluation record, making the gate a hard precondition rather than advice.
118835. **Eval regression comparator** — diff safety-evaluation scores across model versions so a capability gain paired with a safety regression cannot ship quietly.
118836. **Red-team evidence archiver** — store red-team transcripts and prompts alongside the released artifact so future auditors can replay the exact assurance work performed.
118837. **Benchmark-cherry-picking detector** — flag releases whose publicized evals omit the same failure-focused suites the team ran internally, keeping safety reporting honest.
118838. **Inference-log retention enforcer** — verify production inference logs are retained for the policy-defined window so incident reconstruction never hits a gap.
118839. **Prompt-in-log redactor** — scan stored inference logs for secrets and PII patterns and mask them, since logs become a second training-risk surface.
118840. **Egress-via-AI-app sentinel** — monitor outbound payloads from AI features for bulk data exfiltration signatures so the model endpoint cannot become a quiet data tunnel.
118841. **Attachment-ingest policy checker** — review which file types and sources AI features are allowed to ingest, blocking ingestion paths that smuggle sensitive internal documents.
118842. **RAG-source allowlist auditor** — verify retrieval pipelines only query approved corpora so an unvetted index cannot inject untrusted content into answers.
118843. **Tool-call permission mapper** — inventory every external tool an AI agent can invoke with its granted scopes so an over-broad tool grant is visible before abuse.
118844. **Agent-action budget limiter** — cap the number and cost of autonomous tool calls per session so a runaway agent cannot spend or exfiltrate without bounds.
118845. **Human-approval checkpoint designer** — mark high-stakes agent actions (payments, external sends, access changes) as requiring human sign-off before execution.
118846. **Model-access tier mapper** — classify who can call each model (public, employee, privileged) so a powerful internal model is not accidentally exposed to the wider tier.
118847. **Model-credential privilege trimmer** — review AI provider credentials for excessive scopes and recommend least-privilege replacements so a leaked key grants minimal access.
118848. **Rate-limit governance dashboard** — track per-key and per-endpoint quotas across all AI usage so a single runaway integration cannot exhaust budget or crowd out production.
118849. **Cost-anomaly attribution** — trace sudden spikes in AI spend back to the specific key, team, and use case responsible, ending mystery bills.
118850. **Embedding-store access reviewer** — audit who can read or write vector stores backing RAG systems, since embeddings can leak the documents they encode.
118851. **Embedding-inversion risk scorer** — assess whether stored embeddings could reconstruct sensitive source text and recommend access or retention changes where risk is high.
118852. **Retrieval-permission inheritance check** — verify retrieved documents respect the requester's original access rights so the AI does not launder restricted content to unauthorized users.
118853. **Cross-tenant prompt-leak tester** — probe multi-tenant AI endpoints for responses that blend one tenant's context into another's, catching isolation failures before customers do.
118854. **Tenant-data boundary mapper** — document exactly where tenant data separates in shared-model deployments so boundary assumptions are explicit and reviewable.
118855. **Fine-tune tenant-mixing guard** — verify tenant-specific fine-tunes never train on mixed-tenant data, since one contaminated run poisons the whole artifact.
118856. **Model-deletion request tracker** — log right-to-erasure requests against trained artifacts and track whether retraining or unlearning actually fulfilled each request.
118857. **Unlearning verification harness** — test that models subjected to unlearning requests can no longer reproduce the targeted data, providing evidence the request was honored.
118858. **Watermark provenance embedder** — tag model outputs with invisible provenance markers so generated content can later be traced to the exact deployment that produced it.
118859. **Output-attribution ledger** — record which model version generated each persisted AI artifact (documents, tickets, code) so provenance survives downstream reuse.
118860. **Hallucination-rate monitor** — sample production answers against ground truth to track fabrication rates per model version, catching quality decay early.
118861. **Citation-fidelity checker** — verify that citations in RAG answers actually support the claims made, since fabricated citations mislead reviewers.
118862. **Confidence-calibration auditor** — compare expressed confidence against measured accuracy so overconfident model outputs get flagged as a trust risk.
118863. **Jailbreak-resilience retester** — rerun a fixed adversarial prompt suite against every prompt or model change, preventing regressions in refusal behavior.
118864. **Adversarial-prompt corpus curator** — maintain a versioned library of attack prompts tied to the threat model so testing stays current as attacks evolve.
118865. **Safety-eval ownership assigner** — attach a named owner to every safety evaluation so no eval result exists without someone accountable for acting on it.
118866. **Incident playbook for model misbehavior** — provide a ready runbook (quarantine, rollback, notify) for when a deployed model starts producing harmful or leaking outputs.
118867. **Model-rollback drill scheduler** — rehearse reverting a production endpoint to the last approved artifact so rollback works under pressure, not just on paper.
118868. **Decommissioned-model eraser** — verify retired model artifacts are actually deleted from storage, caches, and edge nodes rather than lingering as forgotten copies.
118869. **Edge-cache model-purge verifier** — confirm CDN and edge caches no longer serve decommissioned model files after retirement, closing a stale-distribution gap.
118870. **License-compliance model scanner** — check open-weights models and their derivatives against license terms (attribution, use restrictions) so redistribution stays lawful.
118871. **Derivative-work tracker** — record every fine-tune and merge derived from a base model so license obligations propagate to all descendants.
118872. **Export-control screening** — screen model artifacts and serving setups against export-control lists so restricted capabilities do not cross borders improperly.
118873. **Jurisdiction-data-residency mapper** — record where each model trains and serves so data-residency commitments can be proven per deployment.
118874. **Sovereign-cloud placement advisor** — recommend compliant hosting placements for models handling regulated data, keeping inference inside the required boundary.
118875. **AI-use policy exception registry** — log every approved deviation from the AI-use policy with expiry dates so temporary exceptions do not become permanent silently.
118876. **Policy-acknowledgment tracker** — verify employees who deploy or consume AI features have acknowledged the current AI-use policy, closing the awareness gap.
118877. **Shadow-AI amnesty intake** — run a periodic self-reporting window where teams declare unsanctioned AI tools without penalty, converting hidden usage into governed inventory.
118878. **Governance KPI dashboard** — publish metrics like registry coverage, eval-gate pass rate, and shadow-tool count so AI governance posture is visible to leadership.
118879. **Board-ready AI-risk summary generator** — compile governance posture into a concise executive brief covering shadow-AI exposure, eval coverage, and top remediation items.
118880. **Regulatory-mapping matrix** — map internal AI controls to external requirements (EU AI Act, sector rules) so each obligation traces to an implemented, evidenced control.
118881. **High-risk system classifier** — categorize each AI deployment against regulatory risk tiers so high-risk systems receive the proportionate documentation and oversight.
118882. **Conformity-evidence packager** — bundle model cards, eval reports, lineage records, and incident logs into a ready audit pack per regulated system.
118883. **Third-party model risk assessor** — score procured or open-weights models on provenance, eval coverage, and vendor posture before they enter the registry.
118884. **Procurement security questionnaire auto-filler** — pre-populate vendor AI-security questionnaires from registry and eval evidence so procurement reviews are grounded in facts.
118885. **Contract-renewal AI-review trigger** — flag AI-vendor renewals for a fresh security review instead of auto-renewing on last year's assumptions.
118886. **GPU-cluster usage attributor** — attribute training-compute consumption to registered projects so unregistered training cannot hide in shared cluster bills.
118887. **Notebook-to-production gatekeeper** — require notebooks promoted to production pipelines to pass the same eval and lineage checks as scheduled training jobs.
118888. **Experiment-tracking completeness check** — verify ML experiments log parameters, code versions, and datasets so results are reproducible and auditable.
118889. **Hyperparameter-change reviewer** — flag training runs whose hyperparameters deviate from the approved baseline beyond tolerance, since silent tuning changes model behavior.
118890. **Seed-and-determinism recorder** — capture random seeds and environment details per run so a contested training result can be faithfully reproduced.
118891. **Inference-schema contract checker** — validate that deployed endpoints still honor their documented input/output schemas, catching drift that breaks downstream consumers.
118892. **Breaking-change notifier** — alert downstream teams before a model update changes output format or behavior, preventing silent integration breakage.
118893. **Fallback-model readiness tester** — verify a standby model can take over within the SLO if the primary endpoint fails, so resilience is tested rather than assumed.
118894. **Latency-budget compliance monitor** — track per-endpoint inference latency against the product's budget, since slow AI features quietly degrade user trust.
118895. **Token-budget per-feature enforcer** — cap token spend per AI feature so one expensive capability cannot silently consume the whole AI budget.
118896. **Cache-hit governance reviewer** — audit semantic caches for stale or cross-tenant entries, since cached answers can serve outdated or leaked content.
118897. **Streaming-output policy filter** — apply content and PII policies to streamed model output token-by-token so violations cannot slip through buffering gaps.
118898. **Multimodal-input sanitizer policy** — define and check which image, audio, and file inputs AI features accept, blocking steganographic or oversized payload abuse.
118899. **Voice-clone consent verifier** — require recorded consent before voice-synthesis features clone any person's voice, keeping synthetic-voice use defensible.
118900. **Deepfake-detection integration** — route outbound AI-generated media through provenance and detection checks so synthetic content is labeled before it spreads.
118901. **AI-generated-code review gate** — require human review of AI-written code merged into production, since generated code can introduce subtle vulnerabilities.
118902. **Dependency-hallucination guard** — check AI-suggested packages and imports against real registries before installation, blocking phantom-package attacks.
118903. **Prompt-secret vault migrator** — move API keys and credentials out of hardcoded system prompts into a secrets manager so prompt leaks do not become credential leaks.
118904. **Governance-debt burndown tracker** — maintain a ranked backlog of AI-governance gaps with owners and due dates so shadow-AI and registry issues shrink measurably over time.
118905. **Agent-card signature chain verifier** — validate that each agent's self-published card carries an unbroken signature chain from a trusted issuer so impersonated or forged agent identities surface before any task is delegated.
118906. **A2A task-scope authorization mapper** — map every declared task type an agent accepts against the requester's granted privileges so the agent refuses out-of-scope delegation requests instead of silently attempting them.
118907. **Inter-agent credential lease issuer** — grant short-lived, purpose-bound credentials when one agent delegates work to another so a compromised sub-agent cannot reuse stolen tokens after the task completes.
118908. **Skill-inventory attestation auditor** — cross-check an agent's advertised skills against a signed manifest so inflated or phantom capabilities cannot be abused to win delegations they cannot safely perform.
118909. **Swarm admission handshake reviewer** — verify new swarm members present valid attestation evidence and meet policy gates before joining, since an unaudited entrant can poison the shared trust pool.
118910. **Task-result hash chaining recorder** — chain signed hashes of each agent's output to the inputs it received so tampered or substituted results break the chain and become detectable in post-hunt review.
118911. **Agent-identity spoof detector** — compare claimed agent identifiers against known-good registries and observed behavior baselines so a lookalike agent cannot harvest sensitive tasks in the client's name.
118912. **Cross-agent data-flow permission tracer** — trace which agent hands what data to which peer so a delegation that would exfiltrate PII or credentials outside its allowed path is flagged before execution.
118913. **Protocol-version downgrade sentinel** — watch A2A/ACP negotiations for forced downgrades to legacy versions so attackers cannot strip away newer authentication and integrity guarantees.
118914. **Delegated-privilege expiry enforcer** — verify that privileges granted through delegation chains carry and honor hard expiry times, closing the window where a finished sub-agent retains silent access.
118915. **Agent-card freshness monitor** — flag agent cards that have not been re-attested within the policy window so stale cards describing long-patched capabilities cannot mislead delegation decisions.
118916. **Peer-reputation decay tracker** — record verified trust incidents per agent and apply time-decayed reputation scoring so a previously trustworthy peer that degrades is re-admitted only at reduced privilege.
118917. **Task-message schema validator** — enforce strict schema validation on inter-agent task messages so malformed or injected fields in a crafted payload cannot trigger unsafe parser behavior downstream.
118918. **Delegation-depth limiter** — cap how many hops a task can cascade across agents and verify the limit is enforced, since unbounded re-delegation creates unauditable responsibility chains.
118919. **Agent-to-agent TLS policy auditor** — verify that mutual TLS with current cipher suites is required on every agent channel, downgrading any plaintext or weak-cipher peer link to a blocking finding.
118920. **Capability least-privilege analyzer** — compare the capabilities an agent actually exercised against those it was granted so over-provisioned delegations can be trimmed to what the hunt truly needs.
118921. **Task context isolation reviewer** — confirm that a sub-agent receives only the task slice it needs and cannot read sibling tasks' data, preventing lateral information leakage inside a swarm.
118922. **Result-integrity non-repudiation ledger** — keep signed receipts of every delegation request and completed result so disputes about which agent produced a finding resolve from evidence rather than claims.
118923. **Agent endpoint discovery scanner** — enumerate exposed A2A/ACP endpoints on the authorized target and verify each requires authentication, catching agent APIs that were published without access controls.
118924. **Impersonation-resistant naming registry** — maintain a canonical registry of approved agent names with similarity checks so a typosquatted agent ID like "scaner-agent-2" cannot pass casual inspection.
118925. **Delegated-secret vaulting checker** — confirm agents pass secret references rather than raw secrets between peers so credentials never transit inter-agent channels in recoverable form.
118926. **Swarm quorum policy verifier** — verify that high-impact actions require a configured quorum of independent agents to sign off, preventing any single compromised agent from acting alone.
118927. **Agent behavior drift monitor** — baseline each agent's task patterns and flag sudden deviations in targets, timing, or data access as possible compromise indicators worth investigating.
118928. **Cross-protocol bridge risk mapper** — assess translation gateways between A2A, ACP, and proprietary agent protocols for lost security semantics so authentication strength does not silently drop at the boundary.
118929. **Task cancellation propagation auditor** — verify that cancelling a parent task revokes all descendant delegations so a killed task cannot leave orphan sub-agents running with stale authority.
118930. **Agent memory boundary inspector** — check that shared memory or context stores between agents enforce per-agent access scopes, keeping one agent's working memory unreadable to unauthorized peers.
118931. **Signed task-intent log keeper** — require both parties to sign the delegation intent before work begins so neither the delegator nor the worker can later deny what was authorized.
118932. **Privilege-escalation pathfinder** — model how a low-privilege agent could chain legitimate delegation steps into administrative capabilities, surfacing composite escalation routes the designers missed.
118933. **Peer certificate pinning verifier** — confirm agents pin the certificates or keys of trusted peers so a network-level interceptor cannot insert a rogue agent into the delegation path.
118934. **Delegated tool-use authorization matrix** — map which external tools each delegated task may invoke so a sub-agent cannot reach a disallowed tool through an over-permissive parent grant.
118935. **Swarm partition resilience reviewer** — assess how trust state behaves when the agent network splits so a partitioned agent cannot keep acting on a stale authorization snapshot.
118936. **Task artifact provenance stamper** — attach signed provenance records to every artifact an agent produces so the report trail shows exactly which agent created what from which inputs.
118937. **Agent-card diff watcher** — monitor published agent cards for unannounced changes in capabilities, endpoints, or keys so a silently modified agent triggers re-verification before new delegations flow.
118938. **Credential delegation graph builder** — build a graph of which credentials were derived from which parent grants so the blast radius of a revoked root credential is computable in seconds.
118939. **Inter-agent rate-limit fairness auditor** — verify per-peer rate limits on delegation APIs so a single greedy agent cannot starve the swarm or mask a denial-of-service pattern as normal load.
118940. **Task replay protection checker** — confirm delegation requests carry nonces and timestamps that are validated and rejected on replay, since captured tasks can otherwise be re-executed against live systems.
118941. **Agent sandbox escape boundary tester** — validate on the authorized target that a delegated agent cannot reach host resources or sibling sandboxes beyond its declared sandbox policy.
118942. **Multi-agent consensus tamper detector** — check that consensus votes and result aggregation are signed per agent so a single peer cannot silently rewrite the group's agreed outcome.
118943. **Trust-anchor rotation rehearsal** — verify the swarm can rotate its root trust anchor without downtime and that agents reject the old anchor afterward, keeping long-lived deployments maintainable.
118944. **Delegation audit trail exporter** — produce a human-readable export of every delegation decision with who, what, when, and why so compliance reviewers and bounty triagers can verify the chain without tooling.
118945. **Agent decommissioning sweeper** — verify that retired agents are removed from registries, their credentials revoked, and their delegations drained so zombie agents cannot be resurrected by an attacker.
118946. **Cross-tenant agent isolation verifier** — confirm agents serving multiple tenants keep tenant data strictly separated in task handling, since a multi-tenant agent protocol that leaks across tenants breaks the whole trust model.
118947. **Capability token binding checker** — verify delegated capability tokens are bound to the specific agent instance that received them so a token cannot be lifted and replayed by a different agent process.
118948. **Task priority manipulation guard** — ensure priority fields in delegation queues are set by authorized coordinators only so a low-trust agent cannot starve critical tasks by inflating its own priority.
118949. **Agent health attestation verifier** — require agents to present fresh health attestations (patch level, integrity checks) before accepting tasks so compromised or outdated peers are excluded from the swarm.
118950. **Secure enclave delegation reviewer** — verify that tasks involving sensitive data delegate into hardware-backed enclaves where available so even the hosting agent cannot read the data it processes.
118951. **Protocol fuzz corpus curator** — maintain structured fuzz cases for A2A/ACP message parsers so regressions in handshake and task-message handling are caught before release on the authorized target.
118952. **Delegated audit-scope boundary enforcer** — confirm sub-agents inherit exactly the parent task's scope constraints and cannot expand testing into unauthorized systems through inherited privileges.
118953. **Agent-to-agent auth token lifetime reviewer** — audit the maximum lifetime of inter-agent auth tokens and flag any that outlive the delegation, since long-lived tokens survive the task they were issued for.
118954. **Swarm voting weight analyzer** — review how voting weight is assigned across agents so no single operator's agents hold a hidden majority that could force malicious consensus.
118955. **Task input sanitization gatekeeper** — verify that data arriving from peer agents passes the same validation as untrusted input, since a compromised peer is an attacker with a trusted badge.
118956. **Agent capability revocation propagator** — confirm that revoking an agent's capability reaches all peers that cached it within the policy window so revoked agents lose access everywhere, not just at the registry.
118957. **Inter-agent logging completeness checker** — verify every delegation, data transfer, and result return is logged with consistent agent identifiers so post-incident forensics can reconstruct the full chain.
118958. **Task delegation consent recorder** — capture explicit consent from the authorizing principal for delegations that cross trust boundaries so accountability traces to a real approval, not an assumption.
118959. **Agent key custody reviewer** — inspect how agent signing keys are stored, backed up, and accessed so a key living in plaintext on disk becomes a blocking custody finding.
118960. **Protocol extension safety reviewer** — assess custom A2A/ACP extensions for authentication bypasses and privilege creep since vendor extensions often outrun the protocol's security model.
118961. **Swarm membership revocation tester** — verify that ejecting a misbehaving agent cuts its delegations, data access, and votes immediately, with no grace window an attacker can exploit.
118962. **Task dependency cycle detector** — detect circular delegation dependencies between agents that could deadlock the swarm or be exploited to hold tasks hostage.
118963. **Agent identity bootstrap auditor** — review the initial enrollment flow that issues an agent its first identity so a weak bootstrap cannot mint trusted identities for rogue agents.
118964. **Delegated finding integrity sealer** — seal vulnerability findings produced by sub-agents with tamper-evident signatures so no peer can alter severity or evidence before the report is compiled.
118965. **Cross-agent secret rotation coordinator** — verify shared inter-agent secrets rotate on schedule and that rotation completes across all peers without leaving stale credentials active.
118966. **Task provenance privacy scrubber** — confirm provenance metadata attached to delegated results excludes sensitive operator details while retaining enough for audit, balancing accountability with privacy.
118967. **Agent communication metadata minimizer** — review what metadata agent protocols expose (identities, timing, topology) and reduce it so observers cannot map the swarm's structure from traffic alone.
118968. **Delegation policy simulation runner** — run proposed delegation-policy changes through a simulation before enforcement so a misconfigured rule cannot accidentally lock out the whole swarm.
118969. **Sub-agent output approval workflow** — require human or high-trust-agent approval gates for high-impact sub-agent outputs so autonomous cascades cannot commit irreversible actions without review.
118970. **Agent trust score explanation generator** — produce plain-language reasons behind each agent's trust score so operators can act on the score instead of treating it as an opaque number.
118971. **Inter-agent firewall rule reviewer** — verify network policies restrict which agents may talk to which peers and services so a compromised agent's lateral movement hits hard boundaries.
118972. **Task serialization integrity checker** — confirm serialized task payloads are signed before transmission so a man-in-the-middle cannot modify instructions while they travel between agents.
118973. **Agent recovery attestation checker** — verify agents returning from failure or restart re-attest their identity and integrity before rejoining so a tampered agent cannot slip back in unnoticed.
118974. **Delegation chain visualization builder** — render the live delegation graph as an interactive map so operators see at a glance which agents hold authority derived from which principals.
118975. **Multi-agent kill-switch validator** — test that the emergency kill-switch halts all delegations and running tasks across the swarm within the promised time so incident responders have a real brake.
118976. **Agent-to-agent API versioning reviewer** — check that deprecated protocol endpoints are actually retired and not left reachable, since legacy endpoints often carry weaker authentication.
118977. **Trust boundary documentation generator** — auto-generate diagrams of trust boundaries between agents, services, and tenants from the live configuration so the security architecture stays documented as it evolves.
118978. **Delegated credential scope minimizer** — verify each delegation request asks for the narrowest credential scope that completes the task so sub-agents never inherit the parent's full authority by default.
118979. **Agent peer-list poisoning detector** — watch peer discovery for injected or malicious entries so an attacker cannot steer delegations toward a rogue agent through a poisoned directory.
118980. **Task result aggregation integrity verifier** — verify that aggregated results from multiple agents include contribution proofs from each participant so one agent cannot fabricate the group's combined output.
118981. **Inter-agent clock skew tolerance auditor** — verify timestamp-based protections (expiry, nonces, freshness) tolerate only safe clock skew so time desynchronization cannot be abused to replay delegations.
118982. **Agent capability advertisement limiter** — ensure agents advertise only capabilities they are authorized to expose so a sensitive capability listed in an agent card does not become a discovery gift for attackers.
118983. **Delegated task encryption-at-rest reviewer** — confirm queued and persisted delegation tasks are encrypted so a storage compromise does not hand over the swarm's pending work and credentials.
118984. **Swarm topology change alert** — alert operators when agents join, leave, or change roles outside expected windows so unexpected membership churn triggers immediate review.
118985. **Agent impersonation honeypot deployer** — plant decoy agent identities on the authorized target and watch for connection attempts so active impersonation campaigns reveal themselves during the engagement.
118986. **Task authorization recheck scheduler** — re-verify long-running delegations against current policy at intervals so a task that was valid at start but became unauthorized mid-flight gets stopped.
118987. **Cross-agent exception handler reviewer** — verify error and exception paths between agents do not leak internal topology, credentials, or task contents in stack traces and status messages.
118988. **Agent-to-agent session resumption guard** — confirm resumed protocol sessions re-authenticate and re-validate state so a stale session cannot be hijacked to continue a finished delegation.
118989. **Delegation conflict resolver** — detect when two principals issue conflicting delegations to the same agent and surface the conflict for explicit resolution instead of letting one silently win.
118990. **Swarm-wide audit clock synchronizer** — ensure all agents share a synchronized, tamper-resistant clock source so delegation audit trails order events correctly across the swarm.
118991. **Agent privilege-use anomaly detector** — flag agents that suddenly exercise privileges they rarely use, since dormant-but-granted capabilities being activated is a classic compromise signal.
118992. **Task handoff encryption verifier** — verify that task handoffs between agents encrypt both payload and metadata in transit so eavesdroppers learn nothing about the delegation's content or routing.
118993. **Inter-agent mutual authentication strength grader** — grade the authentication strength of every agent pair (certificates, tokens, proofs) and prioritize the weakest links for hardening first.
118994. **Delegation scope creep monitor** — track when a delegation's actual activity drifts beyond its authorized scope over time so gradual privilege expansion is caught while it is still small.
118995. **Agent registry backup integrity checker** — verify backups of the agent registry and trust anchors are signed and restorable so a registry compromise can be rolled back to a known-good state.
118996. **Task delegation watermark inserter** — embed invisible watermarks in data handed to sub-agents so unauthorized redistribution of delegated material can be traced back to the leaking agent.
118997. **Swarm incident containment playbook generator** — generate a tailored containment runbook from the live delegation graph so responders isolate a compromised agent and its descendants in the right order.
118998. **Agent protocol conformance test suite** — run standardized conformance tests against A2A/ACP implementations on the authorized target so spec deviations that create security gaps are found systematically.
118999. **Delegated trust transitive closure analyzer** — compute the full transitive trust closure across all agents so hidden trust paths that bypass policy become visible as explicit edges.
119000. **Inter-agent incident correlation engine** — correlate suspicious events across agent logs into unified incident timelines so a multi-agent attack is recognized as one campaign rather than isolated anomalies.
119001. **Agent-card revocation status checker** — verify agent cards support and honor revocation status checks so a compromised agent's card cannot remain trusted after its keys are pulled.
119002. **Task delegation rate anomaly detector** — flag sudden spikes or drops in delegation volume per agent since both can signal a compromised coordinator or an ongoing denial-of-service.
119003. **Swarm trust policy version controller** — version-control trust policies with change history and rollback so a bad policy update can be reverted without rebuilding the whole swarm configuration.
119004. **Delegated authority sunset reviewer** — audit all long-standing delegated authorities and expire or re-justify them so permanent-by-default delegations never become the swarm's unnoticed attack surface.
