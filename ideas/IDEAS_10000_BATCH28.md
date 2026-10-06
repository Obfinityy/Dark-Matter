# Dark-Matter IDEAS — Batch 28: Web3, AI-App, Mail, DNS, Identity, Storage, Edge, SaaS, Browser & Team Surfaces (117005–118004)

> 1,000 ideas 117005–118004, generated 2026-10-07.
> Professional English. Defensive/product framing.

Batch 28 explores ten fresh product-surface frontiers: Web3 and smart-contract recon surfaces on authorized targets (contract-interaction graphing, proxy-admin key hygiene, oracle-dependency mapping, MEV exposure measurement, fuzzing-harness generation), AI/LLM-application testing surfaces (prompt-injection resilience test design, RAG source inventory, tool-abuse mapping, Denial-of-Wallet stress testing, red-team regression replay), email and messaging security surfaces (DMARC posture grading, mail-header forensics, lookalike-domain monitoring, SIM-swap correlation, calendar-invite defense), DNS and network-layer recon surfaces (DNSSEC validation, CT-log pipelines, BGP prefix review, IPv6 exposure, CAA coverage), identity and access-management surfaces (OAuth redirect-URI inventory, PKCE adoption, FAPI conformance, passkey readiness, consent-screen review), cloud-storage and data-leak surfaces (public-bucket inventory, signed-URL hygiene, egress-anomaly sentinels, breach-notification readiness), edge and CDN security surfaces (cache-key normalization review, WAF coverage mapping, edge-function review, origin shielding, signed-cookie media protection), SaaS shadow-IT and third-party asset surfaces (certificate-log shadow-SaaS harvest, third-party script inventory, vendor-risk scoring, SaaS-to-SaaS permission mapping), browser and client-side security surfaces (CSP effectiveness grading, DOM sink inventory, postMessage review, client-side secret scanning, service-worker review), and hunt collaboration and team workflows (role-based workspaces, finding review pipelines, shift-change handoff packs, red/blue exercise mode, escalation paths) — each framed as defensive capabilities of an authorized bug-bounty agent.

| # | Category | Ideas |
|---|----------|-------|
| 1 | Web3 & smart-contract recon surfaces | 117005–117104 |
| 2 | AI/LLM-application testing surfaces | 117105–117204 |
| 3 | Email & messaging security surfaces | 117205–117304 |
| 4 | DNS & network-layer recon surfaces | 117305–117404 |
| 5 | Identity & access management: OAuth/OIDC/SAML | 117405–117504 |
| 6 | Cloud-storage & data-leak surfaces | 117505–117604 |
| 7 | Edge & CDN security surfaces | 117605–117704 |
| 8 | SaaS shadow-IT & third-party asset surfaces | 117705–117804 |
| 9 | Browser & client-side security surfaces | 117805–117904 |
| 10 | Hunt collaboration & team workflows | 117905–118004 |

117005. **In-scope contract census builder** — enumerate every deployed contract address under the target's control from verified-source listings, deployment manifests, and frontend references so the authorized scope is a concrete inventory rather than a guess.
117006. **ABI-based interface map generator** — parse each in-scope contract's ABI into a function-and-selector table the agent can reason over, prioritizing state-changing and privileged entry points for review.
117007. **Deployment-lineage tracker** — trace factory deployments and CREATE2 salt patterns to link every contract instance back to its origin, ensuring no in-scope instance escapes the inventory.
117008. **Constructor-parameter archivist** — capture each deployment's constructor arguments and initialization transactions so later state reviews compare live configuration against the intended setup.
117009. **ABI gap detector** — flag public functions missing from the project's published ABI and interface docs, since undocumented entry points widen the review surface without the team's awareness.
117010. **Unverified-source flagger** — list in-scope contracts whose source is unverified on explorers so the agent schedules deeper bytecode-level review where transparency is missing.
117011. **Dependency-library inventory** — record linked libraries and external contract references per deployment so inherited-code risk is attributed to the correct upstream package.
117012. **Deployment-versus-scope checker** — compare each newly observed on-chain deployment against the declared bounty scope and flag out-of-scope contracts before the agent touches them, keeping testing inside authorization.
117013. **Proxy-pattern classifier** — detect Transparent, UUPS, Beacon, and Diamond patterns from storage layouts and delegatecall shapes so the upgrade surface is understood before review begins.
117014. **Proxy-admin key holder map** — resolve proxy-admin addresses to known multisigs, EOAs, or timelocks so a single-key admin stands out immediately as a hygiene finding.
117015. **Upgrade-history timeline** — replay implementation changes across upgrade events to show exactly what code changed, when, and who signed, turning opaque upgrades into reviewable diffs.
117016. **Storage-collision scanner** — compare proxy and implementation storage slot layouts across upgrades to catch layout collisions that silently corrupt state.
117017. **Initializer-replay guard check** — verify initializer functions cannot be invoked twice or by arbitrary callers on authorized targets, since re-initialization can reset ownership.
117018. **Beacon-master drift monitor** — watch beacon contracts for implementation updates that propagate silently to every attached proxy, flagging upgrades the team may not have reviewed.
117019. **Admin-key dormancy alert** — flag admin keys that have never rotated or transacted in years, since dormant keys usually mean lost keys or stale emergency access.
117020. **Diamond-facet selector map** — enumerate Diamond facet selectors and their owning facets so selector collisions and dead facets become visible in the review.
117021. **Privilege-function role matrix** — map every privileged function (mint, burn, pause, upgrade, withdraw) to the role or address that can call it, producing the target's de-facto authority chart.
117022. **Role-grant event auditor** — trace role-grant and revoke events to detect privilege creep, where addresses accumulate roles far beyond their operational need.
117023. **Owner-function justification reviewer** — verify each owner-only function has an independent justification, since blanket owner privileges over user funds are the core of custody-risk findings.
117024. **Cross-function privilege chaining mapper** — model how low-privilege roles can chain calls into higher-privilege effects, surfacing composite authorization gaps no single-function review would catch.
117025. **Default-admin transfer verifier** — check that default admin roles were transferred away from deployer EOAs to multisigs or timelocks before launch, flagging lingering deployer control.
117026. **Trusted-forwarder permission reviewer** — verify which contracts can act through meta-transaction relayers or delegated signers so trusted-forwarder trust assumptions are explicit.
117027. **Emergency-role scope limiter** — check that emergency roles can only pause or rescue, never withdraw user funds, so incident-response power cannot be repurposed.
117028. **Unlimited-allowance census** — scan user approvals to the target's dApp contracts and flag infinite ERC-20 allowances that persist long after the user's last interaction.
117029. **Permit-signature hygiene checker** — review how the dApp requests permit signatures and distinguish legitimate permit flows from shapes abusable by lookalike phishing frontends.
117030. **Allowance-decay recommender** — identify allowances that could be time-boxed or amount-capped by the dApp's design, turning hygiene findings into concrete UX proposals.
117031. **Approval-history timeline builder** — reconstruct when each user granted approvals relative to dApp releases, exposing approvals granted to buggy contract versions.
117032. **Operator-role approval mapper** — list every address holding setApprovalForAll or operator privileges over user NFTs on the target's contracts, since broad operators are prime compromise targets.
117033. **Stale-spender cleanup campaign** — find spenders that no longer exist on-chain or were replaced by newer contracts, so users can revoke dead approvals without affecting function.
117034. **Frontend-prompted allowance simulator** — simulate what the target's frontend asks users to approve at each step and flag approvals that exceed what the step needs.
117035. **dApp RPC-endpoint harvester** — extract every RPC URL bundled in the target's frontend, SDK configs, and docs so testing covers the full provider surface, not just the default endpoint.
117036. **RPC rate-limit posture profiler** — measure rate limits and burst behavior of each discovered RPC endpoint to map which surfaces tolerate abuse-heavy traffic.
117037. **RPC method-exposure auditor** — enumerate enabled JSON-RPC methods per endpoint and flag sensitive ones (debug_traceCall, txpool_content) exposed without authentication.
117038. **RPC-response fidelity checker** — compare responses across the target's endpoints to detect stale or manipulated nodes that could feed the dApp wrong chain state.
117039. **Archive-node capability mapper** — identify which endpoints serve historical state so deep history-dependent reviews (allowance timelines, role history) run against capable nodes.
117040. **RPC failover-path tester** — map the dApp's fallback provider chain so a single compromised provider's blast radius is understood in advance.
117041. **Websocket subscription-surface mapper** — enumerate pub/sub channels the frontend subscribes to and flag subscriptions leaking user-specific mempool or balance data.
117042. **Bridge contract-pair inventory** — list lock/mint or burn/release contract pairs across the chains the target supports so both sides of every crossing are in scope together.
117043. **Withdrawal-delay policy checker** — verify the bridge enforces its advertised withdrawal delays and challenge windows, since missing delays collapse the fraud-proof security model.
117044. **Relayer-validator set mapper** — enumerate the addresses that can authorize bridge releases and check their stake, quorum, and key hygiene, because bridge security reduces to this set.
117045. **Wrapped-token backing reconciler** — compare minted wrapped balances against locked originals on every supported chain so depegs or hidden minting surface as accounting gaps.
117046. **Liquidity-pool exit reviewer** — check bridge liquidity-pool withdrawal rules for fairness gaps like last-in-first-out traps or unbounded fee changes.
117047. **Cross-chain message-failure auditor** — trace failed or stuck cross-chain messages to see whether user funds can be stranded by relayer downtime.
117048. **Bridge-upgrade coordination checker** — verify both sides of a bridge upgrade in lockstep, flagging windows where mismatched versions accept invalid proofs.
117049. **Price-feed dependency graph** — map every contract read of price oracles (aggregated feeds, Pyth-style publishers, TWAP, custom) so a single compromised feed's blast radius is computable.
117050. **Oracle staleness guard reviewer** — verify each feed consumer enforces freshness thresholds and heartbeat checks, since stale prices are the classic oracle-manipulation vector.
117051. **Feed-source concentration analyzer** — count distinct data sources behind each aggregated feed to flag feeds that collapse to one reporter under the hood.
117052. **TWAP window-sensitivity profiler** — profile the averaging windows of on-chain TWAP consumers so reviewers know exactly how much capital moves the price within the window.
117053. **Fallback-oracle chain reviewer** — map primary-to-fallback oracle chains and verify the failover actually triggers on staleness, not only on reverts.
117054. **Oracle-admin key reviewer** — check who can update custom oracle parameters (deviation thresholds, reporters) and whether those powers sit behind a timelock.
117055. **Cross-venue price-divergence monitor** — watch the target's integrated venues for price divergence beyond liquidation thresholds, catching the preconditions for manipulation-triggered liquidations.
117056. **Admin-action event stream monitor** — subscribe to ownership transfers, role changes, upgrades, and parameter updates on in-scope contracts to alert on suspicious admin behavior in real time.
117057. **Parameter-change anomaly scorer** — score fee, cap, and threshold changes against historical ranges so an abnormal parameter shift triggers a review before users are affected.
117058. **Large-withdrawal early-warning feed** — flag treasury or vault withdrawals above modeled baselines, giving the team time to react to potential key compromise.
117059. **Upgrade-event integrity verifier** — verify each emitted upgrade event corresponds to an actual verified implementation change, catching spoofed events and shadow upgrades.
117060. **Multisig-activity health dashboard** — track signer participation rates and execution delays across the target's multisigs so dead signers are found before an emergency.
117061. **Paused-state transition tracker** — log every pause and unpause transition with its caller and duration so pause-power usage is auditable for the bounty report.
117062. **Suspicious-approval burst detector** — detect sudden spikes in approval transactions targeting the dApp's contracts, a signature of phishing campaigns impersonating the target.
117063. **Mempool visibility profiler** — estimate how long the target's user transactions sit exposed in public mempools before inclusion, the window in which front-running is possible.
117064. **Slippage-default reviewer** — audit the default slippage and deadline settings the dApp suggests, since generous defaults are what make sandwich attacks profitable against its users.
117065. **Private-transaction routing checker** — verify the dApp offers private-transaction routing options and measures their adoption, reducing user exposure to public ordering games.
117066. **DEX-integration ordering audit** — review how the target's DEX integrations sequence multi-hop swaps to flag patterns that leak value to ordering attackers.
117067. **Backrun-exposure quantifier** — model the maximum extractable value from the target's liquidation and rebase functions so the team prices MEV risk concretely.
117068. **Block-builder dependency mapper** — map which builders and relays typically include the target's users' transactions, revealing centralization points in execution.
117069. **Governance-proposal activity monitor** — track new proposals on the target's governance contracts with plain-language summaries so risky votes are spotted before they execute.
117070. **Timelock-delay adequacy reviewer** — verify timelock delays give the community a realistic window to review and exit, not a nominal delay shorter than the voting period.
117071. **Proposal-execution drift checker** — compare executed payloads byte-for-byte against the voted proposal text to catch bait-and-switch execution.
117072. **Voting-power concentration analyzer** — compute the Nakamoto coefficient of the target's governance token so whale-capture risk is a number rather than a vibe.
117073. **Emergency-bypass usage auditor** — review every use of emergency or guardian bypass paths to ensure they were justified and time-limited rather than normalized.
117074. **Quorum-attainment simulator** — simulate whether typical participation reaches quorum under the current thresholds, flagging governance that is effectively dead.
117075. **Bytecode similarity cluster engine** — cluster in-scope contract bytecode against known deployments to spot redeployed audited code and, more importantly, redeployed vulnerable code.
117076. **Known-risk pattern tagger** — tag contracts matching bytecode signatures of historically exploited patterns so review starts with the riskiest clusters.
117077. **Clone-factory lineage mapper** — trace minimal-proxy clones to their master implementations, ensuring a fix to the master propagates to every clone.
117078. **Compiler-version drift detector** — flag contracts compiled with outdated or known-buggy compiler versions, since old compilers carry bugs fixed in later versions.
117079. **Deploy-time versus audit-time differ** — diff the audited source snapshot against the actual deployed bytecode to catch post-audit changes that invalidated the audit.
117080. **Cross-chain redeploy consistency checker** — verify the same audited bytecode is deployed on every chain the target claims, flagging per-chain variants that escaped review.
117081. **Gas-griefing surface mapper** — identify functions where an attacker can force other users' transactions to consume excessive gas, making targeted griefing cheap.
117082. **Unbounded-loop reviewer** — flag loops over user-controlled arrays in authorized contracts, since unbounded iteration is the classic DoS-by-design pattern.
117083. **Block-gas-limit proximity profiler** — estimate each critical function's worst-case gas against the block limit so the team knows which functions can be bricked.
117084. **Pull-versus-push payment checker** — verify payouts use pull patterns with per-user isolation so one failing recipient cannot block everyone's withdrawals.
117085. **Griefing-cost quantifier** — compute the attacker's cost to grief each vulnerable function versus the victim's loss, turning DoS findings into priced risks.
117086. **Priority-fee liveness surface** — check whether critical user actions can be indefinitely delayed by fee bidding, mapping liveness risk under congested conditions.
117087. **IPFS pin-integrity checker** — verify the target's NFT and document metadata stays pinned and matches on-chain hashes so metadata cannot be silently swapped.
117088. **Token-URI mutability auditor** — flag collections where token URIs can change post-mint without user notice, the mechanism behind rug-style metadata swaps.
117089. **Off-chain asset-hosting reviewer** — inventory centralized hosts serving dApp assets and verify integrity hashes, since a compromised host can serve phishing or malicious content.
117090. **Metadata-schema drift detector** — diff live metadata against the published schema to catch fields added after launch that users never consented to.
117091. **Content-hash anchoring verifier** — check that critical off-chain documents anchor content hashes on-chain so tampering is detectable rather than merely preventable.
117092. **Wallet-permission request auditor** — catalog every permission the target's frontend requests (accounts, chain, signatures) and flag requests exceeding the feature's need.
117093. **Sign-message phishing-shape scanner** — review sign requests for opaque blobs or misleading human-readable text that train users to sign blindly.
117094. **Chain-switch prompt reviewer** — verify chain-switch requests target expected chain IDs, since forced switches are a phishing primitive.
117095. **Session-persistence hygiene checker** — check how long wallet sessions persist and whether disconnect actually revokes the dApp's local permissions.
117096. **EIP-712 domain-separator verifier** — verify the dApp's typed-data domain matches its real contract addresses so signatures cannot be replayed against lookalike deployments.
117097. **Cross-chain state reconciler** — compare critical parameters (fees, caps, pausers, owners) across every deployment chain so a hardening applied on one chain is not missing on another.
117098. **Chain-halt contingency reviewer** — check the target's plan for user funds when a supported chain halts or finality stalls, since multi-chain dApps inherit each chain's liveness.
117099. **Replay-protection chain-id checker** — verify every signature scheme binds chain IDs correctly so signatures from one chain cannot execute on another.
117100. **Finality-assumption mapper** — document the confirmation counts each cross-chain flow assumes per chain so under-finalized relays become visible findings.
117101. **Pause-readiness drill reviewer** — verify pause switches cover all fund flows, trigger within documented time, and have tested unpause paths so emergencies do not freeze users permanently.
117102. **Fuzzing-harness generator** — auto-generate property-based fuzzing harnesses from in-scope ABIs so invariants like balance conservation are tested continuously on authorized targets.
117103. **Finding-evolution tracker** — carry each finding forward across contract redeploys and mark it fixed, regressed, or reintroduced so the audit trail survives upgrades.
117104. **Redeploy-regression gate** — diff new deployments against closed findings and block sign-off when a supposedly fixed issue's code pattern reappears.
117105. **Authorized prompt-injection test harness for in-scope chatbots** — a controlled probe generator feeds structured instruction-hijack cases to the target's AI endpoint and logs whether boundaries hold.
117106. **Delimiter-escape probing on target instruction boundaries** — systematically tests whether quoted user input can break out of its designated channel and alter privileged behavior.
117107. **Multi-turn injection drift detector for in-scope assistants** — sequences benign-looking turns that progressively steer the model, measuring whether policy drift accumulates across a session.
117108. **Separator-token abuse assessment for in-scope LLM apps** — evaluates whether forged system or role markers inside user input are treated as real privilege boundaries by the target.
117109. **Output-refusal consistency mapper for authorized targets** — compares refusal behavior across paraphrased requests to reveal soft spots where the guardrail silently weakens.
117110. **System-prompt extraction attempt logger for authorized apps** — records whether the target discloses its hidden instructions under adversarial querying, flagging a confidentiality finding.
117111. **Instruction-precedence verifier for in-scope AI workflows** — checks that embedded page text cannot override the target's declared task instructions during retrieval-augmented answers.
117112. **Persona-constraint stress tester for authorized assistants** — measures whether the target holds its assigned role under adversarial role-reassignment prompts without leaking elevated capabilities.
117113. **Hidden-developer-instruction surface audit** — catalogs developer-level prompts exposed through APIs or errors, verifying they cannot be repurposed into privilege escalation by callers.
117114. **Conflict-resolution grader for competing instructions** — when user and system instructions clash on the target, grades whether the privileged instruction wins deterministically.
117115. **Authorized RAG pipeline mapping** — enumerate an in-scope AI app's retrieval sources so the agent can verify untrusted documents cannot steer privileged actions.
117116. **Poisoned-document influence measurer for RAG targets** — injects benign marker documents into the authorized corpus and measures whether their directives alter generated answers.
117117. **Retrieval-ranking manipulation check for in-scope knowledge bases** — tests whether low-quality or attacker-influenced documents can outrank trusted sources in retrieval ordering.
117118. **Citation-hallucination auditor for RAG answers** — cross-checks cited sources against generated claims to detect answers grounded in fabricated or inaccessible documents.
117119. **Chunk-boundary context leak tester for vector-backed apps** — probes whether retriever chunking exposes adjacent private text through crafted boundary queries.
117120. **Write-capable tool enumeration for in-scope AI agents** — inventories every state-changing function the target agent can call and maps each to the permission it exercises.
117121. **Tool-argument validation fuzzer for agent APIs** — sends malformed or out-of-range arguments through the agent's function calls to detect missing server-side validation.
117122. **Confused-deputy test for multi-tool AI workflows** — checks whether the target agent can be maneuvered into invoking a privileged tool on behalf of an unprivileged requester.
117123. **Tool-chain privilege creep detector** — measures whether sequential tool calls accumulate permissions beyond what any single authorized step would allow.
117124. **Function-output trust boundary verifier** — verifies the target treats untrusted tool results as data, not instructions, when planning its next action.
117125. **Training-data regurgitation probe for in-scope models** — uses prefix-completion probes to detect verbatim memorized content surfacing in answers on authorized endpoints.
117126. **System-secret disclosure scanner for target chatbots** — systematically asks for credentials, keys, and internal endpoints to verify the target never emits seeded secrets.
117127. **Cross-tenant completion leakage test for shared AI apps** — verifies that completions for one authorized user never contain another tenant's data from shared model context.
117128. **Canary-token exfiltration check in model outputs** — seeds unique markers in authorized test data and monitors whether they reappear in completions to other users.
117129. **PII reconstruction resistance check for fine-tuned targets** — probes whether the target can be coaxed into reproducing personal data from its fine-tuning set.
117130. **Uploaded-file instruction probe for in-scope AI tools** — submits documents containing hidden directives to verify the target parses files as data rather than executable instructions.
117131. **Email-body injection assessment for authorized AI inboxes** — tests whether an AI mail assistant acts on instructions embedded in incoming messages from untrusted senders.
117132. **URL-content hijack test for browsing-enabled targets** — serves authorized test pages containing embedded directives to measure whether the target's browsing agent obeys them.
117133. **Calendar-invite payload test for AI schedulers** — checks whether event descriptions with embedded commands can alter the target scheduler's behavior on authorized accounts.
117134. **Image-metadata instruction probe for multimodal targets** — verifies that EXIF or caption text inside uploaded images cannot inject instructions into vision-language pipelines.
117135. **Planning-loop derailment gauge for authorized agents** — introduces misleading intermediate observations to measure whether the target agent stays on its authorized plan.
117136. **Goal-hijack resistance test for in-scope autonomous agents** — checks whether the target agent can be redirected to an attacker-chosen objective mid-task on authorized targets.
117137. **Step-skipping auditor for agentic workflows** — verifies the target agent cannot be persuaded to bypass mandatory verification steps in its plan.
117138. **Sub-agent task-scope drift monitor** — when the target delegates to sub-agents, measures whether their scope stays within the authorized mission or expands.
117139. **Reflection-loop poisoning check for self-correcting agents** — tests whether tampered self-review feedback causes the target agent to approve its own unsafe actions.
117140. **Token-burn rate profiler for in-scope LLM endpoints** — measures per-request token consumption to identify prompts that trigger disproportionate inference cost.
117141. **Denial-of-Wallet stress harness for authorized APIs** — sends controlled high-cost request patterns to verify spending caps and alerts trigger before budgets are exhausted.
117142. **Concurrent-session cost multiplier check** — tests whether parallel sessions on the target can multiply inference spend beyond per-user quotas.
117143. **Retry-storm abuse test for streaming endpoints** — verifies that aggressive client reconnects cannot be used to force repeated expensive regenerations.
117144. **Per-tenant quota isolation verifier for AI platforms** — confirms one authorized test account's heavy usage cannot consume another tenant's rate-limit budget.
117145. **Query-based extraction resistance audit for proprietary models** — measures how many structured queries it takes to approximate the target's behavior, flagging weak extraction defenses.
117146. **Logit-bias leakage check for in-scope inference APIs** — verifies the target's API does not expose enough output detail to enable efficient model stealing.
117147. **Distillation-evasion response perturbation gauge** — assesses whether the target varies responses to identical queries enough to frustrate automated extraction pipelines.
117148. **Embedding-endpoint harvesting test for vector APIs** — checks whether bulk embedding queries can exfiltrate proprietary vector representations at scale.
117149. **Watermark-presence verifier for proprietary completions** — confirms the target's outputs carry detectable watermarks that survive paraphrase, aiding theft attribution.
117150. **Phantom-permission detector for AI-assisted admin tools** — tests whether the target hallucinates approvals or grants it never received in access-control decisions.
117151. **Fabricated-policy compliance check for regulated targets** — verifies the AI does not invent regulatory exemptions that would authorize prohibited actions.
117152. **Imagined-credential acceptance test for support bots** — checks whether the target treats user-claimed but unverified identity attributes as authenticated facts.
117153. **False-precedent ticket escalation audit** — measures whether the AI fabricates past approvals to justify out-of-policy actions in authorized workflows.
117154. **Hallucinated-API-endpoint caller for agent targets** — verifies the agent validates tool endpoints against a real schema instead of acting on imagined capabilities.
117155. **Adversarial-image safety grader for authorized vision models** — submits images with embedded harmful requests to verify the vision pipeline refuses them like text.
117156. **Audio-transcript injection check for voice AI targets** — tests whether spoken instructions hidden in audio uploads alter the target's behavior on authorized endpoints.
117157. **Video-frame directive probe for multimodal assistants** — verifies that directives hidden in video frames cannot steer the target's responses.
117158. **OCR-mediated injection test for document AI targets** — checks whether scanned-document text with embedded commands is treated as untrusted data by the target.
117159. **Cross-modal consistency auditor for safety refusals** — compares refusal behavior across text, image, and audio inputs to expose modalities where guardrails are weaker.
117160. **Client-side key exposure audit for AI SDK integrations** — scans the target's frontend bundles for embedded model-provider API keys that should be server-side.
117161. **Key-rotation support verifier for AI platform tenants** — checks whether the target's SDK integrations support credential rotation without downtime or stale-key windows.
117162. **Scope-of-key least-privilege review for inference keys** — verifies API keys embedded in the target carry only the permissions the integration actually needs.
117163. **Credential-in-prompt detector for target applications** — tests whether the target echoes provider keys or tokens back into user-visible chat transcripts.
117164. **Third-party plugin token boundary check** — verifies AI plugins in the target cannot access the host application's credentials beyond their granted scope.
117165. **Long-context memory poisoning gauge for authorized chatbots** — plants false facts early in a long session to measure whether later answers adopt the poisoned premise.
117166. **Cross-session memory leakage test for AI assistants** — verifies that memories written in one authorized session do not surface in a different user's session.
117167. **Summarization-distortion check for conversation compressors** — tests whether the target's context summarizer can be manipulated to drop safety-relevant history.
117168. **Persistent-profile tampering audit for AI apps** — checks whether a low-privilege user can modify the stored profile or preferences of another user through the AI layer.
117169. **Tool-memory replay verifier for agentic targets** — confirms the target re-validates cached tool results instead of blindly trusting stale observations from memory.
117170. **Guardrail bypass scorecard for authorized AI targets** — runs a standardized probe battery and produces a scored robustness metric per vulnerability class.
117171. **Paraphrase-resilience gauge for safety filters** — measures whether reworded harmful requests succeed where direct ones are blocked, quantifying filter brittleness.
117172. **Encoding-obfuscation resistance test for input filters** — checks whether the target's guardrails hold when requests use encoded or obfuscated representations.
117173. **Low-resource-language bypass check for safety alignment** — tests whether safety behavior degrades in languages with weaker alignment coverage on authorized targets.
117174. **Guardrail-drift tracker across target releases** — re-runs the same bypass battery after each release to detect silent regressions in safety performance.
117175. **AI-content provenance manifest checker for target generators** — verifies the target attaches verifiable provenance metadata to generated media per declared standards.
117176. **Watermark-stripping resistance audit for authorized outputs** — tests whether the target's watermarks survive common transformations like cropping or recompression.
117177. **Provenance-spoofing test for content attestations** — checks whether an attacker can forge the target's provenance claims on content the target never generated.
117178. **Human-vs-AI attribution accuracy gauge** — measures whether the target's own detection labels reliably distinguish its outputs from human-written text.
117179. **Deepfake-disclosure compliance check for avatar targets** — verifies AI-generated likenesses from the target carry the disclosures required by policy.
117180. **Per-tenant chunk segregation check for RAG targets** — confirms similarity queries from one tenant cannot retrieve another tenant's private chunks.
117181. **Embedding-inversion resistance check for authorized APIs** — assesses whether exposed embeddings can be reversed into the original sensitive text.
117182. **Unauthorized-namespace query test for multi-index stores** — verifies the target enforces namespace scoping so users cannot pivot into restricted collections.
117183. **Metadata-filter bypass audit for vector search** — tests whether crafted filters expose documents the target's access policy should hide.
117184. **Bulk-scrape rate guard for embedding endpoints** — measures whether the target throttles high-volume embedding requests that enable corpus reconstruction.
117185. **Fine-tuning data-poisoning surface audit for authorized platforms** — verifies the target validates uploaded training data for malicious instruction patterns before jobs run.
117186. **Custom-model exfiltration path check for tuning APIs** — tests whether fine-tuned model artifacts can be downloaded beyond the owning tenant's entitlement.
117187. **Hyperparameter-abuse cost check for tuning endpoints** — measures whether extreme configurations on authorized tuning APIs can trigger unbounded training spend.
117188. **Base-model policy inheritance verifier** — confirms fine-tuned derivatives on the target retain the safety alignment of the base model.
117189. **Tuning-job privilege boundary test** — verifies a fine-tuning job on the target cannot access datasets or secrets outside the requester's scope.
117190. **Agent tool-permission inventory reviewer for authorized targets** — produces a least-privilege report comparing each tool grant against the agent's actual task needs.
117191. **Privilege-escalation path mapper for AI agent roles** — traces whether the target agent can reach admin-level actions through chained low-privilege tools.
117192. **Just-in-time elevation audit for agent workflows** — verifies the target grants elevated tool access only for the duration of the authorized step.
117193. **Cross-application permission bleed check** — tests whether the target agent's tools can act on connected apps beyond the authorized scope.
117194. **Revocation-effectiveness test for agent credentials** — confirms that revoking an agent's token immediately stops in-flight and queued tool actions.
117195. **Chat-log PII redaction verifier for AI platforms** — checks whether stored conversation logs mask personal data according to the target's declared policy.
117196. **Retention-window enforcement audit for conversation archives** — verifies the target actually deletes chat history after its stated retention period on authorized accounts.
117197. **Log-export PII leakage test for analytics pipelines** — confirms exported conversation datasets strip identifiers before reaching analytics or training stores.
117198. **Support-replay privacy check for AI helpdesks** — verifies that when agents or staff replay conversations, PII redaction still applies.
117199. **Data-subject deletion propagation test** — checks whether a deletion request removes the user's conversations from primary stores, caches, and model-training pipelines.
117200. **Fixed-finding regression battery for AI targets** — replays previously reported and fixed AI vulnerabilities after each release to confirm they stay fixed.
117201. **Prompt-pack versioning system for repeat assessments** — versions the adversarial probe set so results stay comparable across successive authorized assessments.
117202. **Release-diff safety comparator for model updates** — runs the same probe battery against old and new model versions to surface behavioral regressions.
117203. **Canary-finding monitor for recurring AI issues** — plants known-vulnerable test cases in staging to verify the target's detection catches them before production.
117204. **Cross-release scoreboard for AI security posture** — tracks the guardrail bypass scorecard over releases, giving bounty teams a trend line of the target's security posture.
117205. **DMARC posture grader** — evaluates an in-scope domain's DMARC policy level, alignment modes, and reporting endpoints so the agent can flag spoofing exposure before attackers exploit a none/monitor policy.
117206. **SPF record flattening analyzer** — resolves nested SPF includes and macro lookups to count DNS lookups and flag softfail-plus-include patterns, because bloated SPF records quietly fail open under the 10-lookup limit.
117207. **DKIM selector inventory builder** — enumerates live DKIM selectors for a domain to detect stale selectors from departed vendors that still sign mail, since orphaned keys let anyone with the old private key forge trusted mail.
117208. **BIMI readiness assessor** — checks a domain's BIMI record, verified-mark-certificate chain, and logo-hosting controls to report whether brand indicators are spoofable or misconfigured before rollout.
117209. **Mail-authentication chain conflict detector** — cross-checks SPF, DKIM, and DMARC results together to find cases where one passes while another fails, because split results reveal partial forgeries that pass naive per-record checks.
117210. **DMARC aggregate-report ingestion pipeline** — parses RUA aggregate reports from authorized inboxes to trend authentication failures and pinpoint which sending services break alignment, turning passive reports into actionable fixes.
117211. **SPF include-chain third-party auditor** — lists every provider authorized by a domain's SPF includes and scores each for breach history and policy tightness, since each include is a new trust anchor the domain owner inherited.
117212. **DKIM key-rotation age monitor** — tracks the age and bit-length of published DKIM keys and flags 1024-bit or multi-year-old keys, because weak unrotated keys are the quietest path to mail forgery.
117213. **Subdomain mail-policy inheritance scanner** — walks an in-scope domain's subdomains for missing or weaker DMARC policies, since sp=none on subdomains hands attackers a valid-looking spoofing host for free.
117214. **Null-MX and parking-record verifier** — checks unused subdomains for null MX and parked-mail records so the agent can confirm they cannot receive or emit mail, because unmanaged subdomains become phishing launchpads.
117215. **Received-chain hop anomaly analyzer** — reconstructs the Received header chain of authorized test mail to flag hops that appear out of geographic or topological order, since forged headers betray relay hijacking.
117216. **Return-Path versus From mismatch flagger** — compares envelope sender, DKIM d=, and header From on authorized samples to surface alignment gaps that spoof filters miss, because display-name trust lives in the header From.
117217. **Authentication-Results header forensics** — parses Authentication-Results across the target's inbound gateway logs to baseline real-world pass/fail rates, giving a ground truth that DNS-only checks cannot provide.
117218. **X-Mailer and client-fingerprint profiler** — baselines legitimate mail-client identifiers for the target's outbound mail so unknown clients stand out, since attacker tooling rarely matches a company's real mailer mix.
117219. **Header-injection residue scanner** — sends authorized probe mail containing delimiter-shaped input through the target's forms and reads the delivered headers for injected fields, proving whether user input can split mail headers.
117220. **ARC chain validator** — verifies Authenticated Received Chain seals on mail transiting the target's forwarders to confirm forwarding preserves authentication evidence, because broken ARC chains make forwarded mail look forged.
117221. **List-unsubscribe header consistency checker** — validates that marketing mail carries matching List-Unsubscribe and List-Unsubscribe-Post headers against the target's declared policy, since missing one-click unsubscribe creates phishing-shaped confusion.
117222. **Delayed-delivery timestamp drift detector** — compares Date headers against Received timestamps to flag mail whose claimed send time contradicts its relay path, because backdated headers are a hallmark of staged mail fraud.
117223. **Lookalike-domain registration watcher** — monitors new registrations using homoglyphs, typosquats, and hyphen variants of the target's brand so defensive takedowns start before impersonation campaigns mature.
117224. **Certificate-transparency brand sentinel** — watches CT logs for certificates issued to lookalike names of the target's domains, because a valid cert on a squatted name makes phishing sites look trustworthy.
117225. **Defensive domain-gap finder** — scores which near-variant domains the target owns versus which remain purchasable, turning an unmanaged variant list into a prioritized acquisition and monitoring backlog.
117226. **Lookalike MX-record profiler** — checks whether newly seen lookalike domains have live MX records, since an MX record on a squat domain signals an imminent impersonation mail campaign.
117227. **Brand-keyword phishing-kit hunter** — searches indexed pages and URL feeds for the target's brand terms on lookalike hosts so the agent can hand security teams a live impersonation inventory rather than a theory.
117228. **Registrar-lock audit for brand domains** — verifies transfer locks, registry locks, and DNSSEC on the target's core and defensive domains, because an unlocked brand domain is a takeover waiting for a social-engineering call.
117229. **Lookalike favicon and logo-hash matcher** — compares visual hashes of login pages on lookalike domains against the target's real branding to rank which squats are weaponized clones versus parked pages.
117230. **Defensive redirect-chain mapper** — traces where the target's owned lookalike domains redirect to confirm they land on official properties, since a hijacked defensive domain is worse than an unowned one.
117231. **Gateway resilience scorecard builder** — aggregates the target mail gateway's catch rates on authorized benign-spoof test mail into a single resilience score, giving leadership a trendable metric without sending real lures.
117232. **Spoofed-internal-sender tolerance tester** — sends authorized test mail that mimics the target's own domain through external paths to measure whether the gateway quarantines it, because self-spoofing is the highest-trust attack shape.
117233. **Executive display-name spoof assessor** — analyzes how the gateway rewrites or flags mail whose display name matches executives but whose address differs, since display-name spoofing bypasses domain-auth checks entirely.
117234. **Attachment-sandbox verdict correlator** — compares the gateway's sandbox verdicts on authorized samples against known-malicious hashes to measure detonation fidelity without ever delivering live malware.
117235. **URL-rewrite coverage auditor** — tests whether the gateway rewrites links in calendar invites, attachments, and forwarded threads, because partial link rewriting leaves whole mail classes unprotected.
117236. **Quarantine-release workflow reviewer** — examines who can release quarantined mail and whether releases re-scan attachments, since a lax release flow turns the gateway into a suggestion box.
117237. **BEC indicator baseline builder** — profiles normal sender behavior for the target's finance and executive roles so anomalous patterns have a statistical baseline instead of a gut feeling.
117238. **Invoice-theme mail pattern profiler** — baselines the timing, wording, and attachment habits of legitimate vendor invoice mail to make anomalous invoice-themed lures stand out in aggregate.
117239. **Reply-chain hijack indicator monitor** — watches authorized mail threads for mid-thread sender-address changes or reply-path redirects, because hijacked threads inherit the victim's trust.
117240. **Urgency-language anomaly detector** — measures how often legitimate internal mail uses urgency or secrecy phrasing so spikes in coercive language trigger review, since BEC pressure tactics distort normal tone.
117241. **New-payee instruction change tracker** — correlates bank-detail-change requests against the target's verified vendor-change process to flag instructions arriving outside the sanctioned channel.
117242. **Executive impersonation risk ranker** — ranks which executive identities face the most external spoofing attempts in gateway telemetry so defenses concentrate where the impersonation pressure actually is.
117243. **Mailbox forwarding-rule auditor** — reviews server-side inbox rules across the authorized tenant for auto-forward to external addresses, because silent external forwarding is the quietest persistence mechanism in mail.
117244. **Delegation grant inventory** — lists all mailbox and calendar delegation grants to flag over-broad or stale delegate access that outlived the employee's role, since delegation bypasses normal sharing prompts.
117245. **Transport-rule sprawl reviewer** — audits mail-flow transport rules for redundant, conflicting, or overly permissive redirects that accumulate when admins never clean up, because stale rules silently reroute sensitive mail.
117246. **Auto-reply data-leak checker** — inspects out-of-office and auto-reply templates for internal phone numbers, org charts, and travel details, since verbose auto-replies feed attacker reconnaissance.
117247. **Shared-mailbox permission pruner** — maps who holds Send-As and Send-on-Behalf rights on shared mailboxes to detect permissions that exceed current job roles, because shared mailboxes hide individual accountability.
117248. **Litigation-hold bypass rule detector** — checks for inbox rules that delete or move mail in ways that could defeat retention policies, since rule-based deletion undermines legal hold and audit integrity.
117249. **Attachment-type policy gap analyzer** — compares the mail platform's blocked-extension list against current malware-delivery trends to find dangerous types the policy still allows, because static blocklists rot fast.
117250. **Macro-enabled document handling reviewer** — tests whether the gateway strips, sandboxes, or merely warns on macro-capable office documents, since warning-only handling relies on users making the right call.
117251. **Archive-nesting depth limiter test** — sends authorized nested archives to measure how deep the gateway inspects before giving up, because depth limits are a known evasion lever.
117252. **Password-protected attachment workflow auditor** — reviews how the platform handles encrypted attachments whose passwords arrive in the mail body, since body-supplied passwords defeat the encryption the policy intended.
117253. **Large-attachment exfiltration guard reviewer** — examines size limits and DLP scanning on outbound large attachments to confirm bulk data cannot leave quietly through mail, because mail remains a classic exfil channel.
117254. **Email-to-ticket injection guard tester** — submits authorized ticket-creating mail with crafted subjects and bodies to verify the parser neutralizes markup and commands, since ticket parsers turn mail into database writes.
117255. **Ticket-reply address spoofing checker** — confirms the helpdesk only accepts reply-thread updates from the original requester address, because loose reply matching lets outsiders inject into private tickets.
117256. **Email-to-API command parser hardener** — reviews how in-scope email-triggered APIs sanitize commands embedded in subjects or bodies, since mail-delivered instructions cross a trust boundary.
117257. **Auto-responder loop breaker verifier** — tests that ticket and API mail handlers detect and break auto-reply storms, because two auto-responders can generate thousands of records in minutes.
117258. **Bounce-addressed ticket pollution scanner** — checks whether delivery-failure notices create junk tickets in the queue, since DSN mail can flood support systems during a spoofing wave.
117259. **SMS MFA delivery-path auditor** — maps the SMS aggregators and routes delivering the target's one-time codes to flag gray routes, because OTP interception starts with a weak delivery path.
117260. **SIM-swap signal correlation engine** — combines carrier port-out signals with login anomalies to detect account takeovers that begin with a SIM swap, since SMS-based MFA fails when the number moves.
117261. **Voice-call MFA fallback reviewer** — examines the target's voice-call OTP fallback for caller-ID trust and replay protections, because voice fallback is often the softest MFA channel.
117262. **OTP brute-force window measurer** — tests the target's code-acceptance window and attempt limits on authorized accounts to confirm short codes cannot be enumerated, since six digits fall fast without rate limits.
117263. **SMS sender-ID spoofing assessor** — checks whether the target's brand sender ID can be registered by third parties on major aggregators, because spoofed sender IDs deliver fake OTP prompts that harvest real codes.
117264. **Push-based MFA fatigue guard reviewer** — verifies the target's push approval flow includes number matching or context display, since blind approve-prompts train users to accept attacker logins.
117265. **APNs key hygiene auditor** — inventories the target's Apple push keys for scope, age, and team association to flag over-privileged or orphaned keys that could push to production apps.
117266. **FCM credential rotation checker** — reviews the target's Firebase Cloud Messaging credentials for rotation cadence and exposure in client builds, because leaked server keys let anyone push as the app.
117267. **Push-notification content policy reviewer** — audits whether push payloads include sensitive data like balances or codes, since notification previews leak through lock screens and notification centers.
117268. **Silent-push abuse surface mapper** — catalogs the target app's silent-push handlers to confirm they cannot trigger privileged actions without user consent, because background pushes bypass visible UI.
117269. **Stale push-token revocation checker** — verifies push tokens are bound to authenticated sessions and revoked on logout, since stale tokens deliver one user's notifications to another's device.
117270. **Slack app permission scope reviewer** — audits installed Slack apps in the target workspace for over-broad scopes like admin or message-history read, because a compromised integration inherits every granted scope.
117271. **Teams bot consent-grant tracker** — lists admin-consented Teams apps and flags consent granted outside the sanctioned approval workflow, since tenant-wide consent is a single click with lasting access.
117272. **Discord bot token exposure scanner** — searches the target's public code, docs, and containers for committed Discord bot tokens, because a leaked token turns the bot into an attacker-controlled insider.
117273. **Bot command injection surface tester** — sends authorized edge-case inputs to the target's chatbots to verify commands are parsed safely, since bots execute instructions arriving as plain chat text.
117274. **Webhook event replay guard checker** — confirms the target's bot webhooks reject replayed or out-of-order events, because unsigned replays can re-trigger payments, deploys, or alerts.
117275. **Messaging webhook HMAC enforcement prober** — sends authorized tampered payloads to in-scope messaging webhooks to prove HMAC or asymmetric signatures are actually validated, not merely present.
117276. **Webhook secret rotation auditor** — checks whether the target rotates webhook signing secrets and supports dual-secret rollover windows, since static secrets shared across vendors leak eventually.
117277. **Endpoint allowlist drift monitor** — watches the target's registered webhook delivery URLs for changes to unapproved hosts, because a redirected webhook endpoint exfiltrates every future event.
117278. **Timestamp-tolerance replay analyzer** — measures how wide each webhook's timestamp acceptance window is to confirm stale signed payloads expire quickly, since generous windows turn signatures into replay tokens.
117279. **Bounce-message content disclosure reviewer** — inspects the target's DSN and bounce templates for internal hostnames, IP addresses, and routing detail, because verbose bounces hand out infrastructure maps.
117280. **Backscatter amplification assessor** — tests whether the target's mail servers generate bounces for mail they should have rejected at SMTP time, since backscatter turns the target into someone else's spam cannon.
117281. **Challenge-response system exposure checker** — looks for challenge-response anti-spam setups on the target's addresses that confirm address validity to scanners, because confirming existence aids targeted attacks.
117282. **Unsubscribe-token guessability analyzer** — measures the randomness of unsubscribe and preference-center tokens to confirm they cannot be enumerated, since predictable tokens let anyone unsubscribe or profile subscribers.
117283. **Unsubscribe open-redirect scanner** — follows the target's unsubscribe and preference links to verify none redirect through attacker-controllable parameters, because unsubscribe flows are trusted clicks.
117284. **List-unsubscribe abuse monitor** — checks that bulk senders honor one-click unsubscribe promptly and do not re-add addresses, since dark-pattern resubscription erodes the trust mail authentication built.
117285. **Newsletter tracking-pixel policy reviewer** — audits which trackers the target's outbound newsletters embed and whether subscribers can opt out, because excessive tracking pixels train users to distrust legitimate mail.
117286. **Calendar-invite spoofing defense tester** — sends authorized invites mimicking internal organizers to check whether the target's calendaring flags external-origin invites, since fake invites drive the most trusted clicks.
117287. **ICS attachment parsing hardener review** — examines how the target's mail and calendar clients parse ICS files for script or link injection, because calendar attachments render with the authority of a meeting.
117288. **Meeting-link substitution detector** — watches authorized calendar flows for meeting URLs replaced after invite creation, since swapped meeting links reroute attendees to attacker-controlled rooms.
117289. **Resource-calendar permission auditor** — reviews who can book and modify room and resource calendars to catch over-permissive write access, because hijacked room calendars broadcast fake meeting details.
117290. **MX-record drift sentinel** — continuously diffs the target's MX records against a known-good baseline to alert on unauthorized mail-server changes, since MX hijacking silently reroutes all inbound mail.
117291. **TXT-record sprawl and secret scanner** — audits the target's TXT records for leaked credentials, tokens, and stale verification strings, because DNS TXT is a public bulletin board teams forget to clean.
117292. **Nameserver delegation integrity checker** — verifies the target's NS delegations match the intended providers to detect dangling or hijacked delegations, since a changed nameserver hands over the whole zone.
117293. **S/MIME deployment coverage mapper** — measures what share of the target's sensitive roles actually send signed or encrypted mail, because a half-deployed S/MIME policy leaves the most phishable users unprotected.
117294. **PGP key-directory freshness auditor** — checks the target's published PGP keys for expiry, revocation status, and algorithm strength, since expired keys push correspondents toward plaintext.
117295. **Encrypted-mail gateway fallback reviewer** — examines what happens when the target's encryption gateway cannot encrypt, because silent plaintext fallback defeats the policy users think protects them.
117296. **Key-escrow and recovery policy checker** — reviews how the target stores and recovers mail-encryption keys to balance availability against insider access, since lost keys mean lost mail and escrowed keys mean new risk.
117297. **Open-relay exposure prober** — sends authorized relay tests through the target's mail infrastructure to confirm external relay is refused, because one open relay turns the target into a spam source.
117298. **Internal relay authentication gap finder** — checks whether the target's internal relays require authentication from every network segment, since unauthenticated internal relays let any compromised host send as anyone.
117299. **Mail-spool header leakage auditor** — reviews logs and queue viewers on the target's relays for full message content exposure, because verbose relay logs turn operators into mail readers.
117300. **QR-code destination safety verifier** — scans QR codes in the target's outbound mail and documents to confirm they resolve to owned domains without redirect chains, since QR codes hide URLs from human inspection.
117301. **Mail-driven deep-link authorization re-checker** — exercises the target app's deep links from mail with altered parameters to verify authorization is re-checked, because deep links carry the trust of the message they arrived in.
117302. **Alert-deliverability path tester** — sends authorized test alerts through the target's incident-notification pipeline to measure delivery success and latency, since security alerts that never arrive are the same as no alerts.
117303. **Notification-channel failover reviewer** — verifies the target's alerting falls over to backup channels when the primary mail or push path fails, because attackers target the notification path first.
117304. **Alert-fatigue threshold calibrator** — analyzes the target's notification volume against acknowledgment rates to recommend thresholds that keep critical alerts visible, since ignored alerts are the real delivery failure.
117305. **DNSSEC chain-of-trust sweep** — validates the full DNSSEC signature chain across an in-scope domain portfolio so the agent can flag hijack-prone zones before attackers weaponize unsigned delegation paths.
117306. **Authorized zone-transfer posture test** — attempts AXFR against each in-scope authoritative nameserver and records which ones leak the entire zone, because a single misconfigured transfer turns reconnaissance into a free download.
117307. **Passive DNS archive mining** — queries passive DNS history for in-scope domains to surface forgotten subdomains, old IP bindings, and retired services that still linger in caches and attacker wordlists.
117308. **Certificate Transparency watchtower** — monitors CT logs for certificates issued under the target's domains and alerts on unexpected issuers or typo-adjacent names, since CT is the earliest public signal of phishing-infrastructure setup.
117309. **BGP origin anomaly reviewer** — checks the target's ASNs for announcements with invalid ROAs or unexpected origin ASNs, because a prefix hijack reroutes traffic to attacker infrastructure in seconds.
117310. **Reverse-DNS hygiene cartographer** — maps PTR records across in-scope IP ranges to find hostname leaks, stale naming conventions, and internal naming that discloses architecture, since PTR data is rarely hardened.
117311. **Covert DNS channel baseline builder** — establishes per-zone query entropy and record-type baselines so anomalous long-label or high-volume TXT/NULL query bursts stand out as possible covert exfiltration channels.
117312. **Authorized port-service inventory builder** — performs scope-limited port enumeration on in-scope hosts with safe banner grabbing only, producing a service exposure map without aggressive or intrusive probing.
117313. **IPv6 shadow exposure review** — audits AAAA records and live IPv6 listeners on in-scope assets to find services reachable over v6 that never appeared in IPv4-only scope reviews.
117314. **Anycast topology resilience mapper** — measures anycast catchment and failover behavior for in-scope services so single-provider or single-site dependencies are visible before they become outage amplifiers.
117315. **DNS-over-HTTPS resolver posture review** — evaluates DoH/DoT resolver configurations on in-scope resolvers for policy bypass, logging gaps, and split-view inconsistencies that blind defensive monitoring.
117316. **CAA record coverage auditor** — checks every in-scope domain for CAA policies restricting certificate issuance, because a missing CAA lets any public CA issue for the domain unchallenged.
117317. **Nameserver diversity fault analyzer** — scores nameserver placement for single-AS, single-region, or single-provider concentration so a localized outage cannot silently take down the whole zone.
117318. **Wildcard DNS scope-creep detector** — probes in-scope zones for wildcard records that answer for unintended names, since wildcards quietly expand the attackable surface beyond what the scope document listed.
117319. **Authorized traceroute topology mapper** — runs scope-bounded traceroutes from multiple vantage points to map the network path into in-scope infrastructure and spot unexpected transit or hostile hops.
117320. **Edge gateway fingerprint limiter** — fingerprints VPN and edge gateways only on in-scope IPs using passive banner and TLS handshake features, flagging outdated appliances without scanning beyond authorization.
117321. **TLS certificate expiry forecaster** — builds a live inventory of in-scope certificates with expiry dates, weak chains, and mis-issued SANs so renewals and revocations happen before outages or trust failures.
117322. **DNS service-discovery exposure audit** — reviews SRV and TXT records on in-scope zones for internal service advertisements, federation endpoints, and verification tokens that should never be public.
117323. **Geo-routing consistency checker** — compares split-horizon and geo-DNS answers across regions for the same in-scope names, because divergent views can serve different trust assumptions to different users.
117324. **DNS change alert sentinel** — watches in-scope zones for new records, hosts, or delegations and raises alerts within hours, so attacker-planted records are caught during the setup phase rather than after impact.
117325. **Subdomain takeover residue hunter** — scans in-scope DNS records pointing at retired cloud services or unclaimed endpoints where a dangling CNAME could be re-registered by an outsider.
117326. **DNS amplification reflector audit** — verifies in-scope open resolvers are not usable for reflection attacks by measuring response-size amplification factors, since misconfigured resolvers become DDoS infrastructure.
117327. **NS glue record integrity checker** — validates glue records against parent-zone delegation data to detect lame delegations and poisoned glue that silently redirect resolution.
117328. **DNS cache poisoning resistance test** — probes in-scope resolvers for Kaminsky-style and fragmentation-based cache poisoning susceptibility so spoofed answers cannot be injected into the trust stream.
117329. **Authoritative server version leak auditor** — checks whether in-scope nameservers disclose software versions in CHAOS-class or banner responses, because version disclosure accelerates targeted exploit selection.
117330. **Email authentication record triage** — audits SPF, DKIM, and DMARC alignment across in-scope domains so lookalike senders cannot spoof the organization's identity with impunity.
117331. **Dangling A record re-registration watch** — tracks A records on in-scope zones whose IPs are no longer owned by the target, flagging cloud-IP reuse windows where a stranger can claim the address.
117332. **DNS over QUIC readiness review** — evaluates whether in-scope resolvers and authoritative servers handle DNS-over-QUIC correctly or fall back in ways that leak queries to unintended paths.
117333. **Registrar lock and transfer status audit** — verifies domain-lock, transfer-prohibition, and registrar authentication settings across the in-scope portfolio so social-engineering transfers cannot steal the domain.
117334. **Anycast vs unicast failover drill reviewer** — examines DNS failover runbooks against measured propagation behavior to confirm that traffic actually shifts during an outage instead of black-holing.
117335. **Passive ASN neighbor profiler** — builds the peer and upstream graph for the target's ASNs from public routing data to identify which neighbor networks could be used as hijack launchpads.
117336. **RPKI coverage gap finder** — maps which in-scope prefixes lack route-origin authorizations and ranks them by traffic value, since unprotected prefixes are the cheapest hijack targets.
117337. **IXP and peering exposure notes** — correlates the target's peering presence with public exchange data to assess whether critical services depend on a single exchange point.
117338. **Reverse PTR consistency auditor** — compares forward and reverse mappings on in-scope IPs to flag mismatches that break email deliverability, logging pipelines, and allow-list assumptions.
117339. **IPv6 reverse DNS hygiene scan** — walks in-scope IPv6 PTR space for auto-generated hostnames that leak device types, tenant IDs, or MAC-derived identifiers.
117340. **Network telescope dark-space review** — checks whether in-scope address blocks contain unannounced or dark ranges that could be quietly hijacked for spam or phishing hosting.
117341. **Port-knocking sequence sanity review** — documents any port-knocking or single-packet-auth schemes on in-scope hosts and verifies the sequences cannot be replayed or observed in transit.
117342. **Banner grab anomaly classifier** — applies safe banner-only analysis on in-scope open ports to detect honeypot signatures, unexpected software stacks, and shadow services the asset inventory missed.
117343. **TLS SNI routing mismatch finder** — tests whether in-scope TLS endpoints serve different certificates or backends per SNI value, since inconsistent SNI handling exposes hidden virtual hosts.
117344. **STARTTLS stripping exposure check** — verifies in-scope mail and messaging services enforce TLS upgrade instead of silently accepting plaintext, because downgrade-able services are trivially eavesdropped.
117345. **OCSP stapling health reviewer** — checks whether in-scope TLS servers staple fresh OCSP responses and handle responder outages gracefully, so revocation visibility does not depend on client-side behavior.
117346. **Certificate key-reuse detector** — finds in-scope certificates sharing private keys across unrelated hosts, because one compromised host then decrypts traffic for every sibling sharing the key.
117347. **SAN sprawl minimization audit** — flags in-scope certificates carrying dozens of unrelated SANs, since one stolen wildcard-multi-SAN certificate impersonates the entire portfolio.
117348. **Legacy TLS sunset auditor** — scans in-scope endpoints for deprecated TLS 1.0/1.1 or weak cipher acceptance, so legacy protocol support does not undermine the whole encryption posture.
117349. **DNS zone enumeration guard test** — probes in-scope zones for NSEC walking versus NSEC3 protections to measure how easily an attacker can enumerate every name in the zone.
117350. **DNS label-sharding privacy review** — evaluates whether in-scope resolvers use QNAME minimization, since full-query-name resolvers leak complete browsing patterns to every authoritative server in the path.
117351. **EDNS client-subnet leak auditor** — checks whether in-scope resolvers forward client subnets in ECS options, because ECS hands precise user geolocation to every authoritative server upstream.
117352. **DNS response rate-limit reviewer** — verifies RRL configurations on in-scope authoritative servers so they cannot be drafted into large-scale reflection attacks.
117353. **Negative caching inconsistency mapper** — measures how in-scope resolvers handle NXDOMAIN and NODATA to detect cache-poisoning footholds and denial-of-service amplification via wildcard negatives.
117354. **Authoritative anycast node divergence check** — compares answers from different anycast nodes of the same in-scope zone to catch desynchronized serials that create inconsistent trust views.
117355. **DNS notify and IXFR ACL reviewer** — confirms NOTIFY and incremental-transfer ACLs on in-scope primaries so zone contents cannot be pulled or poisoned by unauthorized secondaries.
117356. **Stealth secondary detection sweep** — discovers unadvertised secondary nameservers for in-scope zones by comparing SOA serials and transfer sources, since shadow secondaries often miss hardening applied to the public ones.
117357. **DNSSEC key rollover readiness audit** — reviews KSK/ZSK rollover procedures and emergency-rollover runbooks for in-scope zones, because a botched rollover breaks validation for every resolver on the planet.
117358. **CDS and CSYNC automation reviewer** — checks whether in-scope zones publish CDS/CSYNC records for automated key rollovers and parent DS updates, reducing the window where trust data is stale.
117359. **DANE TLSA record adoption audit** — verifies TLSA records on in-scope mail and service endpoints so clients can pin certificates independently of the public CA system.
117360. **SSHFP record coverage check** — audits SSHFP records for in-scope SSH endpoints so host-key verification does not silently degrade to trust-on-first-use.
117361. **BIMI and brand-indicator review** — examines BIMI records on in-scope domains for logo impersonation risks and VMC misconfigurations that attackers exploit for lookalike campaigns.
117362. **DNS firewall policy gap analyzer** — reviews response-policy-zone and DNS-filtering rules on in-scope resolvers to confirm known-malicious categories are actually blocked and logged.
117363. **Split-brain DNS leakage test** — verifies that internal-only in-scope records never leak through external views by querying public resolvers for internal names from outside the network.
117364. **DNS search-domain hijack reviewer** — audits DHCP and VPN-pushed search domains on in-scope networks to ensure short-name lookups cannot be hijacked by an attacker-controlled suffix.
117365. **mDNS and LLMNR exposure limiter** — checks in-scope host segments for multicast name-resolution chatter that leaks hostnames and responds to spoofed answers on local networks.
117366. **NetBIOS name service hygiene audit** — reviews legacy NBNS traffic on in-scope Windows segments for responder-style spoofing exposure, since old name services answer whoever asks first.
117367. **ARP table anomaly baseline** — establishes per-segment ARP baselines on in-scope networks so MAC-spoofing and man-in-the-middle insertions stand out against known-good mappings.
117368. **DHCP snooping trust-boundary review** — verifies DHCP snooping and dynamic ARP inspection trust ports on in-scope switches so rogue servers cannot hand out attacker-controlled gateway addresses.
117369. **VLAN hopping surface review** — audits in-scope switch trunk and native-VLAN configurations for double-tagging and DTP-negotiation paths that let an attacker cross network segments.
117370. **Spanning-tree attack surface check** — reviews BPDU guard and root-guard settings on in-scope access switches so a rogue device cannot claim root and intercept segment traffic.
117371. **Network access control posture audit** — evaluates 802.1X deployment coverage on in-scope wired and wireless segments to find ports where unauthenticated devices still get network access.
117372. **Wireless rogue-AP baseline mapper** — surveys authorized AP fingerprints on in-scope sites so evil-twin access points broadcasting the corporate SSID are detected by deviation, not by user report.
117373. **Guest Wi-Fi segmentation prover** — tests whether in-scope guest Wi-Fi segments can reach internal management interfaces or peer clients, since guest networks are a classic pivot beachhead.
117374. **Captive portal session-hijack reviewer** — examines in-scope captive-portal flows for session fixation and open-redirect flaws that turn a login page into a credential-harvesting mirror.
117375. **VPN split-tunnel policy auditor** — reviews split-tunneling rules on in-scope VPN profiles to confirm sensitive destinations route through the tunnel instead of leaking onto the open internet.
117376. **VPN client version drift tracker** — inventories in-scope VPN gateway endpoints for outdated client-enforcement policies, because old clients with known flaws remain connectable long after patches exist.
117377. **SD-WAN control-plane exposure review** — checks whether in-scope SD-WAN controllers and orchestrators expose management APIs to the internet instead of living behind private underlay addressing.
117378. **MPLS label edge sanity check** — reviews in-scope provider-edge label distribution for unauthenticated LDP sessions that could inject forged labels into the core.
117379. **GRE and IPIP tunnel hygiene audit** — inventories configured tunnels on in-scope routers for orphaned or test tunnels that bypass firewall policy by design.
117380. **BGP community hygiene reviewer** — audits community strings honored by in-scope routers for blackhole, no-export, and traffic-engineering communities that an upstream could abuse to reroute or drop traffic.
117381. **BGP TTL security (GTSM) coverage check** — verifies GTSM is enabled on in-scope eBGP sessions so off-path attackers cannot inject spoofed BGP messages from distant hops.
117382. **Route flap damping policy review** — examines damping parameters on in-scope BGP speakers to confirm unstable peers are suppressed without permanently black-holing legitimate flapping prefixes.
117383. **Looking-glass corroboration workflow** — cross-checks in-scope route announcements against multiple public looking glasses so a localized hijack shows up as an inconsistency rather than going unnoticed.
117384. **DNS history-based asset resurrection finder** — mines historical DNS resolutions for in-scope domains to identify decommissioned hosts that were silently brought back with the same names.
117385. **Stale delegation cleanup auditor** — finds NS delegations in parent zones pointing at in-scope nameservers that no longer answer authoritatively, because stale delegations create hijackable resolution gaps.
117386. **Expired domain re-registration tripwire** — watches in-scope domains approaching expiry and their lookalikes so an attacker cannot grab a lapsed domain that users still trust.
117387. **Typosquat sibling discovery scan** — enumerates registered typo variants of in-scope domains and scores them for active phishing kits, mail exchangers, or brand-impersonating content.
117388. **Homoglyph and IDN spoof reviewer** — inspects internationalized lookalikes of in-scope domains for mixed-script registrations that defeat visual inspection in email clients and browsers.
117389. **Subdomain brute-force budget governor** — runs bounded, scope-aware subdomain enumeration against in-scope zones with rate limits and allow-listed sources, proving coverage without hammering authoritative infrastructure.
117390. **DNS over TLS certificate pin reviewer** — verifies that in-scope DoT resolvers pin or properly validate upstream certificates instead of silently accepting any chain during fallback.
117391. **Resolver forwarding-loop detector** — traces forwarding chains between in-scope resolvers to find loops and shadow forwarders that amplify queries or route them to untrusted upstreams.
117392. **Authoritative response-time anomaly watcher** — baselines per-nameserver response latency for in-scope zones so DDoS-induced slowdowns and anycast draining are visible before resolution fails.
117393. **DNS query flood threshold tuner** — derives safe per-client query thresholds for in-scope resolvers from observed legitimate traffic so flood defenses trigger on abuse, not on peak business hours.
117394. **Port 53 TCP fallback verifier** — confirms in-scope DNS infrastructure answers over TCP for large responses, because truncated UDP answers without TCP fallback break DNSSEC validation silently.
117395. **DNS cookie support auditor** — checks whether in-scope resolvers and servers support DNS cookies to distinguish legitimate clients from spoofed-source floods.
117396. **Root and TLD resolution path reviewer** — traces the full resolution path from roots to in-scope authoritative servers to confirm no unexpected intermediaries intercept or rewrite answers.
117397. **DNS64 and NAT64 translation audit** — reviews DNS64 synthesis rules on in-scope resolvers so IPv4-only assets are not misrepresented or exposed through unintended translation.
117398. **NAT hairpin and reflection exposure check** — tests whether in-scope NAT configurations allow internal hosts to reach internal services via the public IP, since hairpin paths often bypass firewall rules meant for external traffic.
117399. **UPnP and NAT-PMP exposure sweep** — checks in-scope edge devices for enabled UPnP/NAT-PMP that lets any LAN client punch inbound holes through the firewall without approval.
117400. **ICMP surface minimization review** — audits which ICMP types and codes in-scope hosts and routers answer, because verbose ICMP responses aid network mapping and enable smurf-style amplification.
117401. **Source-routing and record-route probe blocker test** — verifies in-scope routers drop loose and strict source-routed packets so attackers cannot dictate packet paths through the network.
117402. **IP fragmentation reassembly risk review** — checks whether in-scope firewalls and hosts reassemble overlapping fragments in attacker-favorable ways that evade inspection-based detection.
117403. **Network time protocol exposure audit** — verifies in-scope NTP servers are not open monlist/amplification reflectors and that clients validate server identity instead of accepting time from anyone.
117404. **In-scope network baseline snapshotter** — captures a versioned baseline of DNS records, routes, certificates, and open services so every future hunt diffs against a known-good state and regressions are caught automatically.
117405. **Registered redirect-URI inventory crawler** — Crawl an authorized OAuth app's public client registrations and docs to build a redirect-URI inventory that flags token-leak paths without touching live sessions.
117406. **Wildcard redirect-URI pattern matcher** — Test registered redirect URIs against wildcard and regex patterns to flag subdomain-takeover sinks, using the app's own registration data rather than live attacks.
117407. **Client-type reclassification audit** — Compare declared confidential versus public client types against their actual credential handling in an in-scope app to flag misclassified clients eligible for secret theft.
117408. **PKCE enforcement verifier for SPAs** — Inspect authorization requests issued by an authorized single-page app to confirm code_challenge is present and the verifier never travels with the authorization request.
117409. **PKCE downgrade-path detector** — Review an in-scope app's authorization server code to confirm that omitting code_challenge is rejected for PKCE-bound clients instead of silently downgrading to plain flow.
117410. **Implicit-flow deprecation scanner** — Detect legacy implicit-flow grants still enabled on in-scope OAuth servers so the agent can recommend migration to authorization code with PKCE.
117411. **Scope catalog versus grant comparator** — Diff the scopes an in-scope app actually requests against its documented feature needs so over-privileged authorizations surface as review items.
117412. **Unused-scope grant pruner** — Track which granted scopes an authorized integration actually calls, recommending removal of dormant scopes that widen blast radius if a token leaks.
117413. **Refresh-token rotation validator** — Confirm that an in-scope authorization server rotates refresh tokens on use and invalidates the predecessor, limiting the window a stolen token remains useful.
117414. **Refresh-token reuse detector** — Check that refresh-token reuse triggers detection logic (e.g., family invalidation) on in-scope servers, so replayed tokens cut off the whole chain.
117415. **Refresh-token lifetime policy auditor** — Compare absolute and sliding expiration settings against the product's risk tier to recommend lifetimes that balance usability with compromise containment.
117416. **SAML metadata freshness monitor** — Verify that an authorized service provider refreshes IdP metadata on schedule and validates signatures, preventing stale-certificate authentication failures and metadata spoofing.
117417. **SAML assertion audience check** — Review SP-side validation to confirm assertions are bound to the correct audience and recipient, blocking assertions minted for other relying parties.
117418. **SAML response signature coverage audit** — Confirm both response and assertion signatures are validated (not just one layer) on in-scope SPs to close signature-wrapping gaps.
117419. **SAML clock-skew tolerance reviewer** — Check NotBefore/NotOnOrAfter handling and skew windows on in-scope SPs so assertions cannot be replayed outside their intended validity period.
117420. **Session-token entropy measurer** — Statistically sample session tokens issued by an in-scope app in a test account to confirm cryptographically strong randomness before reporting any predictability concern.
117421. **Session-fixation regression test** — Verify an in-scope app rotates session identifiers at privilege transitions (login, role elevation) using only the agent's own test sessions.
117422. **Concurrent-session policy reviewer** — Inspect whether an in-scope product enforces concurrent-session limits or device notifications, and surface gaps as account-takeover amplification risks.
117423. **Idle-timeout enforcement probe** — Measure idle and absolute session timeouts in an authorized test account to confirm they match the product's stated security policy.
117424. **MFA enrollment-flow integrity check** — Walk the MFA enrollment flow with the agent's own test account to confirm enrollment requires re-authentication and cannot be silently skipped or downgraded.
117425. **MFA recovery-code single-use verifier** — Test that recovery codes on an in-scope app are single-use, hashed at rest, and regenerated on demand, reducing account-recovery takeover paths.
117426. **Backup-code entropy auditor** — Review backup-code generation on an in-scope product to confirm sufficient entropy and rate-limited redemption that resists guessing.
117427. **Password-reset token entropy sampler** — Analyze reset tokens issued to the agent's own test account for entropy and expiry, flagging predictable or never-expiring tokens defensively.
117428. **Password-reset single-use enforcer** — Confirm reset tokens invalidate after first use and after a successful password change on in-scope apps, closing token-replay account takeovers.
117429. **Reset-link binding checker** — Verify password-reset links are bound to the requesting account and cannot be replayed against a different account on in-scope products.
117430. **Login account-enumeration resistance test** — Compare timing and message differences between valid and invalid usernames on in-scope login and recovery forms using benign probes, reporting enumeration gaps without harvesting accounts.
117431. **Registration username-availability audit** — Check whether an in-scope signup flow discloses account existence through availability APIs, and recommend neutral responses.
117432. **Social-login state-parameter verifier** — Confirm OAuth state parameters on Google/Apple/GitHub login integrations of an in-scope app are unguessable and bound to the session to prevent CSRF login attacks.
117433. **Social-login account-linking conflict reviewer** — Review how an in-scope app handles email collisions between social and password accounts so attackers cannot pre-hijack accounts via IdP email matching.
117434. **Apple private-relay email handling audit** — Check that an in-scope product correctly handles Apple's private relay addresses (uniqueness, verification) instead of treating them as disposable.
117435. **GitHub OAuth App versus GitHub App reviewer** — Distinguish legacy OAuth App integrations from GitHub Apps on in-scope targets and recommend the least-privilege GitHub App model with fine-grained permissions.
117436. **Personal-access-token scope minimizer** — Inventory PAT scopes in use on in-scope developer platforms and recommend narrowing them to the minimum required for each integration.
117437. **PAT expiry and rotation policy check** — Verify that personal access tokens on in-scope systems carry expirations and that rotation reminders or automation exist for long-lived tokens.
117438. **API-key versus OAuth usage classifier** — Map which in-scope integrations use static API keys versus OAuth, prioritizing migration candidates where keys are embedded in client-side code.
117439. **Service-account inventory builder** — Build a least-privilege inventory of service accounts and machine identities on in-scope systems, flagging accounts with dormant permissions or shared credentials.
117440. **Machine-identity certificate lifecycle tracker** — Check that workload certificates on in-scope systems auto-renew with short lifetimes instead of multi-year static certs that outlive their owners.
117441. **Just-in-time provisioning gap analyzer** — Review JIT user provisioning on in-scope SAML/OIDC integrations to confirm role mapping is deterministic and leavers lose access when the IdP deprovisions them.
117442. **Deprovisioning latency measurer** — Measure the delay between IdP deprovisioning and SP-side session/token revocation on in-scope tenants to flag lingering access windows.
117443. **SCIM attribute-mapping correctness review** — Audit SCIM attribute mappings on in-scope directories so role and department attributes propagate accurately instead of over-provisioning by default.
117444. **Orphaned-account detector** — Cross-reference HR/IdP rosters against in-scope app user lists to surface orphaned accounts that should have been deprovisioned.
117445. **Privileged-session recording coverage map** — Verify that privileged access sessions (admin consoles, production shells) on in-scope systems are recorded and the recordings are tamper-evident.
117446. **Emergency-access account governance reviewer** — Check that break-glass accounts on in-scope tenants require multi-person approval, alert on use, and auto-rotate credentials afterward.
117447. **Passkey rollout readiness assessor** — Evaluate an in-scope product's WebAuthn support, fallback flows, and device-loss recovery to produce a staged passkey rollout readiness score.
117448. **WebAuthn attestation policy reviewer** — Review attestation requirements on in-scope passkey deployments to balance authenticator assurance against user friction.
117449. **Passwordless fallback downgrade guard** — Confirm that enabling passkeys on an in-scope app does not leave a weaker SMS-only fallback that attackers can trigger to bypass the stronger factor.
117450. **Conditional-access policy gap analyzer** — Compare an in-scope tenant's Conditional Access policies against a baseline (MFA for admins, compliant-device rules, risky-sign-in blocks) and list uncovered scenarios.
117451. **Legacy-authentication blocker** — Detect legacy auth protocols (basic auth, old ActiveSync) still enabled on in-scope tenants and quantify the accounts still using them for a disablement plan.
117452. **Guest-user lifecycle reviewer** — Audit guest/external accounts on in-scope collaboration tenants for stale invitations, over-broad sharing, and missing expiry, recommending time-boxed access.
117453. **External-sharing link hygiene check** — Inventory anonymous and anyone-with-link shares on in-scope tenants to flag publicly resolvable links containing sensitive data.
117454. **B2B invitation redemption validator** — Confirm guest invitations on in-scope tenants bind to the invited email and cannot be redeemed by a different identity.
117455. **Token-binding adoption assessor** — Evaluate whether an in-scope API supports token binding or mutual-TLS-bound access tokens so stolen bearer tokens are unusable elsewhere.
117456. **DPoP proof-of-possession checker** — Verify DPoP-bound access tokens on in-scope resource servers are validated against the presented proof key, closing bearer-token replay.
117457. **Sender-constrained token inventory** — Catalog which in-scope integrations use sender-constrained tokens (mTLS, DPoP) versus plain bearer tokens to prioritize migration of high-risk APIs.
117458. **Consent-screen transparency auditor** — Review third-party app consent screens on in-scope platforms for clear scope descriptions, publisher verification, and revocation paths users can actually find.
117459. **Over-consented third-party app sweeper** — Identify third-party apps with dormant or excessive grants on an in-scope tenant and produce a least-privilege revocation list.
117460. **Admin-consent workflow reviewer** — Check that admin-consent requests on in-scope tenants route through documented approval with risk notes, not one-click approvals by any admin.
117461. **IdP failover resilience tester** — Review identity-provider failover configuration on in-scope systems so authentication degrades gracefully (cached policies, backup IdP) rather than failing open during outages.
117462. **Account-lockout tuning advisor** — Analyze lockout thresholds and unlock flows on in-scope login systems to balance credential-stuffing resistance against user-denial-of-service.
117463. **Credential-stuffing signal correlator** — Recommend detection signals (impossible travel, password-spray patterns, breached-password screening) for in-scope auth telemetry the agent is authorized to review.
117464. **Breached-password screening integrator** — Verify an in-scope product checks new passwords against breach corpora (e.g., k-anonymity APIs) and blocks compromised choices at registration and reset.
117465. **High-risk action re-authentication mapper** — Map which sensitive actions on an in-scope app trigger step-up authentication and flag high-risk actions missing re-verification.
117466. **Device-trust enrollment reviewer** — Audit device registration flows on in-scope tenants to confirm enrollment requires authentication and produces non-cloneable device identities.
117467. **SSO session-lifetime alignment check** — Compare IdP session lifetime with SP session lifetime on in-scope federations so logout or timeout at one layer does not leave orphaned sessions at the other.
117468. **Single-logout (SLO) coverage tester** — Verify SAML/OIDC single logout propagates to all participating sessions in an authorized test, preventing ghost sessions after logout.
117469. **OIDC discovery-document integrity check** — Confirm an in-scope relying party pins or validates the OIDC discovery document and JWKS source instead of trusting unauthenticated metadata fetches.
117470. **JWKS rotation handling reviewer** — Check that in-scope JWT validators handle key rotation gracefully (kid lookup, cache refresh) without accepting tokens signed by retired keys indefinitely.
117471. **JWT algorithm-confusion guard** — Review token validation on in-scope services to confirm the algorithm is pinned server-side and none/weak algorithms are rejected regardless of token headers.
117472. **JWT claim-validation completeness audit** — Verify exp, iat, nbf, iss, aud, and jti/subject checks on in-scope JWT consumers, flagging missing validations as forgery or replay risks.
117473. **Token audience-restriction mapper** — Map which audiences each in-scope token type accepts to ensure tokens minted for one API cannot be replayed against another.
117474. **Downstream-token exchange (on-behalf-of) reviewer** — Audit OAuth token-exchange flows on in-scope backends to confirm actor/delegation claims are constrained and exchange chains cannot escalate scope.
117475. **Client-credentials grant scope limiter** — Verify machine-to-machine client-credentials grants on in-scope servers issue only pre-registered narrow scopes, never user-level scopes.
117476. **Device-authorization-flow polling guard** — Review device-flow implementations on in-scope apps for polling intervals, code expiry, and user-verification binding that resists code-interception.
117477. **CIBA (decoupled flow) consent verifier** — Check Client-Initiated Backchannel Authentication deployments on in-scope products for binding between the authentication request and the device that approves it.
117478. **PAR (pushed authorization requests) adoption check** — Assess whether in-scope OAuth clients use Pushed Authorization Requests to move parameters out of the browser and shrink request-tampering surface.
117479. **JARM response-mode validator** — Verify JWT Secured Authorization Response Mode usage on in-scope high-risk clients so authorization responses are signed and tamper-evident.
117480. **FAPI baseline conformance mapper** — Map an in-scope financial-grade API against FAPI baseline requirements (sender-constrained tokens, mTLS, PAR) to produce a prioritized conformance backlog.
117481. **OAuth error-response information-leak review** — Check that authorization and token error responses on in-scope servers avoid disclosing client existence, user validity, or internal state.
117482. **Authorization-code single-use enforcer** — Confirm authorization codes on in-scope servers are single-use with short lifetimes and bound to the client that requested them.
117483. **Code-challenge method allowlist audit** — Verify in-scope servers accept only S256 (not plain) code-challenge methods for PKCE clients, closing downgrade interception.
117484. **Redirect-URI exact-match enforcer** — Confirm in-scope authorization servers require exact redirect-URI matches against registration instead of prefix or substring matching.
117485. **Fragment-versus-query response-mode reviewer** — Check that token-bearing responses use fragment mode appropriately on in-scope SPAs so tokens never land in server logs via query strings.
117486. **Silent-authentication (prompt=none) abuse guard** — Review prompt=none usage on in-scope apps to confirm it cannot be abused for cross-site login-state probing without user consent.
117487. **Session-management (check_session_iframe) reviewer** — Audit OIDC session-management implementations on in-scope RPs for correct logout propagation without leaking session state cross-origin.
117488. **Front-channel logout coverage test** — Verify front-channel logout on in-scope federations terminates sessions across participating apps in an authorized test scenario.
117489. **Identity-proofing strength mapper** — Map the identity-proofing level (document check, liveness, manual review) behind each in-scope account type so high-assurance actions require matching assurance.
117490. **Synthetic-identity fraud signal reviewer** — Recommend fraud signals (device velocity, email age, phone reputation) for in-scope onboarding flows the agent is authorized to assess.
117491. **Delegated-administration boundary checker** — Verify delegated admin roles on in-scope tenants cannot escape their scope (e.g., helpdesk resetting global admins) through role-assignment paths.
117492. **PIM (privileged identity management) coverage audit** — Check that standing privileged assignments on in-scope tenants are converted to just-in-time eligible assignments with approval and time limits.
117493. **Access-review campaign effectiveness tracker** — Measure whether periodic access reviews on in-scope systems actually revoke stale grants, or merely rubber-stamp them, and recommend attestation improvements.
117494. **SoD (segregation-of-duties) conflict detector** — Model toxic role combinations (e.g., requester plus approver) on in-scope systems and flag assignments violating segregation policy.
117495. **API-token vault integration checker** — Verify that service credentials on in-scope systems are sourced from a secrets manager with rotation, not hardcoded in configs or repos the agent is authorized to scan.
117496. **Short-lived credential adoption measurer** — Quantify the share of in-scope workloads using short-lived credentials (dynamic secrets, workload identity) versus static long-lived keys.
117497. **Workload-identity federation reviewer** — Audit workload identity federation (e.g., OIDC from CI runners to cloud) on in-scope pipelines to confirm audience and subject constraints prevent cross-repo impersonation.
117498. **SSH certificate-authority migration assessor** — Evaluate migration from static SSH keys to short-lived SSH certificates on in-scope infrastructure, including CA trust and principal constraints.
117499. **Active Directory delegation scope reviewer** — Review constrained versus unconstrained delegation on in-scope Active Directory environments to flag delegation paths that enable lateral movement.
117500. **LDAP bind-credential hygiene check** — Verify LDAP/S bind accounts on in-scope directories use least-privilege service accounts with TLS, not domain-admin credentials in cleartext configs.
117501. **Directory anonymous-bind detector** — Check that anonymous LDAP binds are disabled on in-scope directories so unauthenticated clients cannot enumerate the directory tree.
117502. **Password-spray resilience scorer** — Combine lockout policy, MFA coverage, and breached-password screening on in-scope auth endpoints into a single password-spray resilience score for the report.
117503. **Auth-event logging completeness audit** — Confirm in-scope authentication systems log success, failure, MFA challenges, and token issuance with enough context for incident response without storing secrets.
117504. **Identity roadmap prioritizer** — Synthesize all identity findings from an authorized assessment into a risk-ranked roadmap (quick wins, structural fixes, strategic bets) for the final report.
117505. **Public object-storage ACL inventory** — enumerates every in-scope bucket's ACLs and policies to flag world-readable stores before customer data leaks.
117506. **Block-public-access drift sentinel** — watches account-level public-access blocks for drift so a single relaxed setting cannot silently re-expose hardened buckets.
117507. **Bucket-policy versus ACL conflict analyzer** — compares bucket policies against object ACLs to surface cases where one control says private while the other says public.
117508. **Orphaned object-version exposure review** — checks old object versions that stay world-readable after a bucket's ACL was tightened, since versioning preserves the original permissions.
117509. **Static-website-hosting endpoint auditor** — reviews buckets with website hosting enabled to ensure the website endpoint and the API endpoint expose identical, intended content only.
117510. **Signed-URL expiry hygiene scanner** — audits pre-signed URLs minted by the target's services for excessive lifetimes and flags any valid beyond the data's sensitivity window.
117511. **Signed-URL scope tightness reviewer** — verifies signed URLs and signed POST policies are bound to a single object, method, and content type so one link cannot be reused to upload elsewhere.
117512. **Signed-cookie private-content reviewer** — checks CDN signed-cookie scopes and expirations guarding private distributions so cookies cannot be replayed across paths.
117513. **Share-link exposure monitor** — inventories anyone-with-the-link shares across the target's SaaS file stores and flags links that never expire or were shared externally.
117514. **Stale-share cleanup automator** — proposes automatic revocation rules for share links older than the data's retention policy so forgotten links stop being permanent backdoors.
117515. **Backup-vault access-policy reviewer** — audits centralized backup vaults and recovery points for over-broad principals that could restore or export production data.
117516. **Snapshot-sharing permission auditor** — reviews database and disk snapshots shared with other accounts and flags public or stale shares that duplicate production data elsewhere.
117517. **Cross-region snapshot-copy encryption checker** — verifies copied snapshots and machine images stay encrypted in transit and at rest in the destination region with keys the target controls.
117518. **AMI public-sharing reviewer** — scans machine images marked public or shared and confirms no snapshot carrying production data is published to a marketplace.
117519. **Database-snapshot exposure scanner** — checks managed-database snapshots for public or cross-account sharing so restored copies cannot leak regulated records.
117520. **Log-archive bucket permission review** — audits centralized log buckets so security telemetry is readable only by the SOC and not by every developer role.
117521. **CloudTrail storage integrity checker** — verifies audit-log buckets enforce write-once semantics and restrict deletion so tampering with the evidence trail is blocked.
117522. **VPC flow-log destination exposure review** — confirms flow-log archives land in locked-down buckets rather than shared analytics stores with broad read access.
117523. **Access-log self-reference loop detector** — finds logging configurations that write a bucket's own access logs back into itself or into a public bucket, leaking requester identities.
117524. **CDN origin-bucket direct-access reviewer** — verifies origin buckets reject direct public requests so attackers cannot bypass the CDN's signed-URL and WAF controls.
117525. **Origin-access-identity migration checker** — finds CDN distributions still using legacy origin identities or none at all and queues them for least-privilege origin access controls.
117526. **Edge-cache private-object reviewer** — audits CDN cache behaviors for private or authenticated content cached at the edge without authorization checks on cache hits.
117527. **Terraform state backend security review** — checks remote state backends for encryption at rest, state locking, and least-privilege access since state files routinely contain secrets.
117528. **Terraform state secret sweeper** — performs an authorized review of state-file contents for embedded credentials and rotates anything found before it spreads.
117529. **Infrastructure-plan artifact reviewer** — audits stored plan files and CI artifacts from infrastructure pipelines for leaked secrets and overly permissive sharing.
117530. **CloudFormation export exposure checker** — reviews stack outputs and exported template values published by in-scope accounts to ensure no secret or internal endpoint leaks through them.
117531. **Container-registry pull-permission auditor** — inventories who can pull from the target's private registries and flags anonymous or overly broad pull access on images containing proprietary code.
117532. **Registry image-layer secret scanner** — performs authorized scans of image layers for embedded credentials so baked-in secrets are rotated instead of shipped forever.
117533. **Helm chart repository exposure reviewer** — checks chart repositories for public read access that would publish internal values files and deployment topology.
117534. **Artifact-feed permission reviewer** — audits private package feeds for anonymous download rights that would let anyone pull proprietary libraries.
117535. **Build-artifact retention reviewer** — reviews CI build artifacts and their retention windows so debug bundles with secrets do not linger publicly after release.
117536. **Data-warehouse share auditor** — inventories cross-account and external data shares to confirm each share carries only the columns the partner contract allows.
117537. **External-table source-URI reviewer** — checks external tables pointing at object storage to ensure the referenced buckets are not world-readable, since the table inherits the file's exposure.
117538. **Query-result bucket exposure checker** — verifies ad-hoc query result buckets expire quickly and stay private so analysts' exports do not become permanent public datasets.
117539. **Authorized-view boundary tester** — validates that warehouse authorized views truly enforce row and column filters, because a misconfigured view silently re-exposes the base table.
117540. **Analytics-export permission reviewer** — audits product-analytics export destinations to confirm event streams land in locked stores rather than shared buckets with broad access.
117541. **Warehouse export chain reviewer** — traces scheduled data exports from warehouse to object storage and flags any hop where permissions widen between source and destination.
117542. **EXIF metadata leakage reviewer** — scans the target's published images for GPS coordinates and device identifiers so location data is stripped before assets go public.
117543. **Document-property leakage reviewer** — inspects target-published documents for hidden author names, tracked changes, and revision history that disclose internal identities.
117544. **Spreadsheet hidden-content reviewer** — checks published spreadsheets for hidden sheets, comments, and embedded connections that leak internal systems or credentials.
117545. **Thumbnail and cache-file leakage scanner** — hunts for stray Thumbs.db, .DS_Store, and editor swap files in public directories that disclose internal folder structures.
117546. **Source-map exposure reviewer** — detects JavaScript source maps served from the target's CDN that would hand internal source code and comments to anyone who asks.
117547. **Dotfile exposure scanner** — checks in-scope web roots and buckets for .env, .git, and config files left publicly readable so deployments stop shipping their own keys.
117548. **Database-dump discovery scanner** — performs authorized scans of in-scope web roots for .sql, .bak, and export files so forgotten dumps are removed before they are indexed.
117549. **Web-root autoindex exposure reviewer** — flags directory-listing-enabled paths on in-scope hosts that turn every backup, dump, and log file into a browsable catalog.
117550. **Log-file exposure reviewer** — audits in-scope hosts and buckets for publicly reachable application and server logs that disclose paths, tokens, and user data.
117551. **Rotated-log archive reviewer** — checks compressed historical logs for lingering public access since rotation archives are often forgotten while the live logs are locked down.
117552. **Debug-bundle exposure checker** — reviews support and diagnostic bundles stored in shared locations for embedded secrets and customer data before they are shared externally.
117553. **Paste-site secret monitor** — watches public paste and snippet sites for the target's credentials and API keys so leaks trigger rotation and takedown workflows fast.
117554. **Code-sharing leak detector** — monitors public gists and code-sharing posts referencing the target for accidentally committed secrets and internal endpoints.
117555. **Git-history secret inventory** — performs authorized scans of in-scope repositories' full history for committed credentials so every historic secret gets rotated, not just the current ones.
117556. **Fork and mirror exposure reviewer** — checks authorized forks, mirrors, and public clones of in-scope repos for secrets that were scrubbed from the main repo but survive in copies.
117557. **Release-asset exposure reviewer** — audits public release artifacts and attachments for debug symbols and internal paths that disclose build infrastructure.
117558. **ML model-artifact permission auditor** — reviews model registries and artifact stores so proprietary models and weights are not downloadable by unauthorized principals.
117559. **Training-dataset access reviewer** — audits dataset buckets and versioned data stores for over-broad access that would expose the raw data behind a production model.
117560. **Notebook workspace sharing reviewer** — checks shared notebook environments and their attached storage so experimental code and credentials are not visible beyond the team.
117561. **Feature-store sharing auditor** — reviews feature-store and data-catalog sharing policies to confirm downstream consumers see only approved feature views.
117562. **Data-lake permission boundary reviewer** — audits lake-formation style fine-grained permissions so analysts cannot reach raw zones outside their approved scope.
117563. **Encryption-at-rest coverage mapper** — inventories every in-scope data store and flags unencrypted buckets, disks, and databases so nothing sensitive rests in plaintext.
117564. **KMS grant scope and key-user separation auditor** — audits encryption key grants and policies so key administrators cannot also decrypt data and wildcard principals cannot use keys.
117565. **Cross-account role trust reviewer** — examines role trust policies granting storage access and flags external IDs missing or principals broader than the documented integration.
117566. **Confused-deputy condition checker** — verifies bucket and resource policies carry organization and source constraints so a third-party integration cannot be tricked into exposing the target's data.
117567. **Workload-identity federation trust reviewer** — audits federated identity bindings that grant storage access to confirm each maps to the intended workload and nothing else.
117568. **Dormant-principal storage-access reviewer** — correlates unused IAM users, keys, and service accounts with storage permissions so stale credentials lose data access first.
117569. **Long-lived storage credential rotation planner** — inventories persistent keys with data-store scopes and schedules their replacement with short-lived workload identities.
117570. **Break-glass storage-access auditor** — reviews emergency access grants to sensitive stores to confirm each was time-bound, justified, and revoked after the incident.
117571. **Just-in-time data-access reviewer** — validates that temporary storage grants expire automatically and that approvals map to real tickets rather than standing permissions.
117572. **Data-retention policy automator** — proposes lifecycle rules that delete or archive data on schedule so stale stores stop accumulating regulated records nobody owns.
117573. **Stale-backup pruning advisor** — identifies backups older than the retention policy that still hold sensitive data and queues them for verified deletion.
117574. **Orphaned-resource data reviewer** — finds storage left behind by deleted projects and environments so abandoned buckets with real data do not linger unowned.
117575. **Regulated-data store mapper** — maps which stores hold PII, payment, or health data so breach-notification scope can be determined in hours instead of weeks.
117576. **Data-classification tagging coverage checker** — measures how many in-scope stores carry classification tags and prioritizes untagged stores that likely hold sensitive data.
117577. **DLP scan integration planner** — proposes where to attach data-loss-prevention scanning across public-facing stores so sensitive patterns are caught before exposure.
117578. **Data-subject-request locator** — builds a cross-store personal-data index for in-scope tenants so erasure and access requests can be fulfilled completely.
117579. **Egress-anomaly exfiltration sentinel** — baselines storage egress per store and alerts on spikes that suggest bulk staging of data for unauthorized export.
117580. **Storage-access-logging coverage checker** — verifies every sensitive store emits access logs to a locked archive so unauthorized reads leave an auditable trail.
117581. **Bucket-notification target reviewer** — audits object-created event destinations to confirm notifications route only to the target's queues and topics, not third-party endpoints.
117582. **Replication-role least-privilege reviewer** — checks cross-region and cross-account replication roles to ensure they can copy only the intended prefixes and nothing more.
117583. **Access-point policy reviewer** — audits storage access points and their network-origin restrictions so each application path enforces its own least-privilege boundary.
117584. **Object-lambda exposure reviewer** — reviews object-transformation access points for public reachability that would let callers bypass the source bucket's controls.
117585. **Immutable-backup compliance checker** — verifies critical backups carry object-lock or vault-lock retention so ransomware cannot encrypt or delete the recovery copies.
117586. **Ransomware-resilience storage reviewer** — checks versioning, MFA delete, and isolated backup copies across in-scope stores so one compromised credential cannot wipe everything.
117587. **Disaster-recovery replica exposure reviewer** — audits warm-standby replica stores to confirm they inherit the primary's encryption and access controls instead of weaker defaults.
117588. **Multi-cloud storage inventory aggregator** — builds a single cross-provider view of every in-scope store so exposure reviews stop missing the cloud nobody checked.
117589. **Pipeline staging-bucket hygiene reviewer** — audits ETL and data-pipeline staging buckets for leftover intermediate files that accumulate sensitive data between runs.
117590. **Analytics-docs site exposure checker** — reviews internally hosted data-docs and lineage sites to ensure schema, table, and pipeline details are not publicly browsable.
117591. **Support-attachment ACL reviewer** — audits attachments on public support portals and status pages so incident artifacts do not leak customer data to anonymous viewers.
117592. **Ticketing-attachment exposure reviewer** — checks file attachments on externally visible tickets for public download links that bypass the ticket's own access controls.
117593. **Open-data-portal over-sharing reviewer** — reviews the target's public data portals for datasets published with more columns than the open-data policy permits.
117594. **Published-dataset PII scanner** — performs authorized scans of the target's public datasets for accidental personal identifiers so releases can be corrected before wide reuse.
117595. **Package-tarball metadata reviewer** — inspects published package archives for embedded author emails, internal paths, and tokens that ship with every download.
117596. **CI log secret redaction reviewer** — verifies pipeline logs mask secrets before archival so build output stored in shared locations does not become a credential dump.
117597. **Secret-manager access reviewer** — audits who can read the target's managed secret stores and flags broad read access that turns one compromise into total credential loss.
117598. **Parameter-store hierarchy reviewer** — checks configuration stores for plaintext secrets mixed with ordinary config so sensitive values move into proper secret storage.
117599. **Time-limited share hygiene enforcer** — proposes replacing permanent external shares with expiring links so collaboration access ends when the project ends.
117600. **Signed-URL minting-endpoint reviewer** — audits the target's URL-signing endpoints for missing authorization and over-broad parameter acceptance that would let callers mint links for any object.
117601. **Cloud-storage inventory drift alerter** — watches for newly created stores and shares across in-scope accounts so shadow storage gets reviewed before it accumulates data.
117602. **Cross-tenant share-link crawler** — performs authorized crawls of the target's collaboration tenants to find externally shared files the data owners forgot about.
117603. **Legal-hold versus retention conflict checker** — reconciles litigation holds with automated deletion policies so required evidence is preserved while stale data still expires.
117604. **Breach-notification readiness drill** — runs a tabletop mapping exercise over the regulated-data store inventory so the team can scope and notify within the legal deadline when a leak is confirmed.
117605. **Authorized cache-key normalization review** — examines how an in-scope CDN constructs cache keys from URL, headers, and cookies so the agent can flag poisoning-prone normalization gaps before real traffic is served from a tainted cache.
117606. **Header-sensitivity cache-key auditor** — catalogs which request headers an in-scope CDN includes in cache keys to spot unkeyed headers that let two different responses collide under one key, because unkeyed inputs are the classic cache-poisoning foothold.
117607. **Query-parameter cache-key bloat detector** — measures how many distinct query parameters an in-scope edge cache keys on, since over-inclusive keys fragment the cache and under-inclusive keys invite poisoning via ignored parameters.
117608. **Host-header cache-key confusion checker** — tests whether an in-scope CDN keys cache entries on the raw Host header, because Host-driven keys can be manipulated to serve one site's cached page to another's visitors.
117609. **Cache-key case-normalization gap mapper** — probes whether an in-scope CDN treats path and header case consistently when building cache keys, since mismatched normalization creates duplicate or poisonable cache entries.
117610. **Unkeyed-input cache-poisoning harness** — safely sends benign marker inputs through unkeyed CDN dimensions on authorized targets to prove a poisoning vector exists, giving the report reproducible evidence without touching other users' cache entries.
117611. **Cache-poisoned denial-of-service blast-radius estimator** — models how many visitors a poisoned edge object would reach across POPs, because a single poisoned asset behind a global CDN turns one finding into a site-wide outage.
117612. **Cache-deception versus cache-poisoning distinction tester** — determines whether an in-scope app caches attacker-reachable private content (deception) or lets attackers taint shared content (poisoning), since the two defects need different fixes and different severity calls.
117613. **Authenticated-content caching boundary reviewer** — verifies that responses carrying session-specific data are never stored under shared cache keys, because one cached private page exposes every subsequent visitor's data.
117614. **Vary-header cache-fragmentation inspector** — audits Vary directives on in-scope origins to find headers that multiply cache variants into exhaustion, since uncontrolled fragmentation is a quiet availability risk at the edge.
117615. **Range-request cache-amplification probe** — checks whether partial-content requests multiply origin fetches behind the CDN, because abused range handling can turn one client request into many expensive origin hits.
117616. **Cache-tag invalidation authorization reviewer** — verifies that surrogate-key and tag-based purges require proper credentials, since an unguarded invalidation endpoint lets anyone flush an entire site's edge cache.
117617. **WAF rule-coverage surface mapper** — cross-references an in-scope attack-surface catalog against deployed WAF rules to list endpoints with no matching protection, turning an abstract rule list into concrete coverage gaps.
117618. **WAF bypass-variant regression suite** — replays known encoding and evasion variants against in-scope endpoints after every WAF change, so rule updates that accidentally reopen old bypasses are caught immediately.
117619. **Managed-rule false-positive impact assessor** — measures how often managed WAF rules block legitimate in-scope traffic patterns, because overly aggressive rules push teams to disable protection entirely.
117620. **WAF-versus-origin rule-parity verifier** — compares the edge WAF policy against protections assumed at the origin, since defenses the origin expects but the edge lacks leave a silent gap.
117621. **Rate-rule versus WAF-rule overlap auditor** — maps where rate-limiting rules and WAF rules both fire on the same traffic to eliminate conflicting actions, because overlapping rules can block legitimate users twice while missing real attacks.
117622. **Edge-redirect rule open-redirect scanner** — audits CDN-configured redirect rules for unvalidated destination parameters, since an edge-level open redirect inherits the trust of the site's own domain.
117623. **Edge-function permission inventory builder** — enumerates every permission granted to in-scope edge functions (workers, Lambda@Edge) to flag over-privileged functions, because a compromised edge function inherits all of its granted access.
117624. **Edge-secret injection hygiene reviewer** — checks how secrets reach edge functions — environment bindings, encrypted stores, or plaintext — to flag plaintext secrets that leak through edge logs or error pages.
117625. **Worker KV-namespace isolation checker** — verifies that each in-scope edge function's KV namespace is scoped to its own tenant or app, since a shared namespace lets one function read another app's edge data.
117626. **Environment-variable sprawl auditor for edge functions** — lists every variable bound to edge deployments to find stale credentials and debug flags, because edge configs accumulate forgotten secrets over time.
117627. **Edge-function log redaction verifier** — inspects edge-function logs for echoed request bodies, headers, or tokens, since verbose edge logging quietly archives sensitive data into log pipelines.
117628. **Edge-function subrequest allowlist reviewer** — audits which origins an in-scope edge function may call, because an unrestricted fetch turns a small edge script into an SSRF-capable proxy.
117629. **Direct-origin exposure scanner** — probes whether an in-scope origin server answers requests that bypass the CDN, since a reachable origin makes every edge defense irrelevant.
117630. **Origin-shield effectiveness tester** — verifies that only the designated shield POPs can reach the origin, because a shield that accepts direct internet traffic is no shield at all.
117631. **DNS-history origin-IP leak hunter** — searches historical DNS records for pre-CDN origin IPs that may still be live, since old A records are the most common way attackers find the real server.
117632. **Certificate-transparency origin-IP correlation** — cross-references CT logs against CDN hostnames to find certificates issued directly on origin infrastructure, which often reveals the hidden IP.
117633. **Origin firewall allowlist drift monitor** — continuously diffs the origin's IP allowlist against the CDN's published ranges to catch drift that silently re-exposes the origin to the internet.
117634. **Stale-DNS-record origin-leak checker** — finds forgotten subdomains still pointing at origin IPs, because one stale record hands attackers the direct path around the CDN.
117635. **Origin-on-ramp DDoS bypass checker** — verifies that traffic cannot reach the origin through unadvertised paths such as direct IP or alternate ports during an attack, since attackers bypass the CDN first.
117636. **Anycast route-leak origin-exposure monitor** — watches routing announcements for leaks that could steer traffic away from protected anycast edges toward a single exposed origin.
117637. **Cache-purge authorization verifier** — confirms that single-URL and bulk purge calls on in-scope zones require authenticated, scoped credentials, because purge access equals the power to take a site offline.
117638. **Stale-while-revalidate serving-policy reviewer** — audits how long an in-scope CDN serves stale content during origin outages to balance availability against serving outdated or revoked data.
117639. **Purge-API key-scope auditor** — checks that purge tokens are limited to specific zones and cannot purge other customers' caches, since an over-scoped key is a cross-tenant weapon.
117640. **Wildcard-purge blast-radius guard** — evaluates controls around prefix and wildcard purges that can empty an entire zone's cache at once, because one misclick or stolen key causes a full origin stampede.
117641. **Stale-cache error-page poisoning watcher** — monitors whether error pages served from stale cache can be influenced by attacker-controlled inputs, since cached errors persist long after the trigger is gone.
117642. **X-Forwarded-For trust-boundary reviewer** — maps which in-scope hops trust client-supplied forwarding headers, because trusting X-Forwarded-For from the open internet breaks IP-based access controls and logging.
117643. **Header-injection via edge-pass-through tester** — checks whether the CDN forwards crafted headers unchanged to the origin, since unvalidated pass-through can inject new headers or split responses downstream.
117644. **Hop-by-hop header stripping verifier** — confirms the edge strips connection-level headers before proxying, because leaked hop-by-hop headers confuse origin servers into misrouting or misinterpreting requests.
117645. **Spoofed-client-IP logging-integrity checker** — verifies that security logs record the edge-validated client IP rather than a spoofable header, since poisoned log IPs blind incident response.
117646. **Forwarded-header chain consistency auditor** — compares X-Forwarded-For, Forwarded, and True-Client-IP values across the request path to detect header forgery the edge should have normalized away.
117647. **CDN custom-error-page information-disclosure checker** — reviews edge-generated error pages for leaked stack traces, internal hostnames, or debug data, because default error templates often overshare.
117648. **Bot-challenge effectiveness metrics collector** — measures solve, abandon, and bypass rates of in-scope bot challenges to quantify whether the challenge stops automation or just annoys humans.
117649. **Challenge-page fingerprint-versus-UX balance reviewer** — evaluates whether bot challenges collect excessive device fingerprints, because heavy fingerprinting trades a small security gain for real privacy cost.
117650. **Good-bot allowlist hygiene auditor** — reviews verified-bot allowlists for stale or spoofable entries, since an outdated allowlist lets scrapers in under a search engine's name.
117651. **Behavioral-signal spoofing-resistance tester** — probes whether in-scope bot management relies on signals a headless client can fake, because single-signal defenses fall to the first scripted browser.
117652. **JavaScript-challenge bypass-rate monitor** — tracks how often automated clients clear JS challenges to detect when the challenge has become security theater needing an upgrade.
117653. **Edge rate-limit behavior verifier** — empirically tests published rate limits on in-scope endpoints to confirm the edge actually enforces them, since documented limits that never trigger are just decoration.
117654. **Per-endpoint rate-limit mapping** — builds a matrix of rate limits across every in-scope endpoint to find expensive operations with no limit, because unthrottled heavy endpoints are the first abuse target.
117655. **Rate-limit bypass-via-header auditor** — tests whether rotating forwarded headers or API keys resets edge rate counters, since per-header buckets can be trivially evaded.
117656. **Distributed-source rate-bucket collision tester** — checks whether edge rate limiting aggregates across source IPs, because per-IP limits alone never stop a distributed flood.
117657. **429-handling client-safety reviewer** — verifies that rate-limit responses include proper Retry-After guidance and do not leak internal quota details, so legitimate clients back off gracefully.
117658. **Edge TLS-termination visibility reviewer** — confirms what the CDN does at TLS termination — header injection, protocol downgrade, plaintext re-encryption — so the agent can flag where encryption quietly ends.
117659. **Certificate-expiry and renewal-hygiene monitor** — tracks edge certificate lifetimes and renewal automation to warn before expiry, because an expired edge certificate is a self-inflicted outage.
117660. **Weak-cipher edge-negotiation scanner** — probes in-scope edge endpoints for deprecated TLS versions and weak cipher suites, since the edge's weakest accepted cipher defines the site's real posture.
117661. **HSTS propagation verifier across edge POPs** — checks that Strict-Transport-Security is served consistently from every POP, because one non-compliant POP keeps downgrade attacks alive.
117662. **OCSP-stapling health checker** — verifies stapled revocation responses at the edge so clients can validate certificates without extra round trips, closing a quiet revocation-check gap.
117663. **TLS-fingerprint drift detector** — baselines JA3-style fingerprints of in-scope edge endpoints to alert when the terminating stack changes unexpectedly, which can signal interception or misconfiguration.
117664. **Geo-fencing enforcement verifier** — tests whether country-level blocks on in-scope content actually hold from representative vantage points, because a geo-fence that leaks is a compliance failure.
117665. **Geo-bypass via edge-POP routing tester** — checks whether requesting through a different POP or edge hostname circumvents geo restrictions, since inconsistent enforcement invites bypass shopping.
117666. **Country-block consistency auditor across regions** — compares blocklists applied at each edge region to find regions enforcing stale policy, because drifted regions silently unblock restricted users.
117667. **IP-geolocation database drift monitor** — tracks which geolocation database version the CDN uses and flags stale data, since outdated GeoIP maps block the wrong users and admit the wrong ones.
117668. **Edge-side-include tag exposure reviewer** — scans in-scope edge responses for ESI tags that reveal internal fragment URLs or backend structure, because ESI directives are a map of the origin's internals.
117669. **Server-side-include directive-leak scanner** — checks cached edge content for unprocessed SSI directives that disclose file paths or commands, since leaked directives invite further probing.
117670. **ESI fragment cache-isolation tester** — verifies that personalized ESI fragments are never cached under shared keys, because one cached private fragment leaks into every visitor's page.
117671. **Image-transformation parameter abuse-surface reviewer** — audits in-scope image CDN parameters (width, format, quality) for unbounded values that trigger expensive origin rendering, since transformation endpoints are classic cost-amplification targets.
117672. **Crop-resize parameter cost-amplification estimator** — models the compute cost of extreme resize parameters to quantify how cheaply an attacker can burn image-processing budgets.
117673. **SVG-via-image-pipeline content-type checker** — verifies that SVG uploads through the image CDN are served with safe content types and sanitization, because an unsanitized SVG is scriptable content on a trusted domain.
117674. **Image-optimization cache-busting parameter auditor** — finds transformation parameters excluded from cache keys that let attackers bypass the cache and hammer the origin with unique image URLs.
117675. **WebSocket-upgrade edge-handling reviewer** — examines how the in-scope CDN proxies Upgrade requests to confirm authentication and origin checks survive the handshake, since upgrades often skip the rules applied to normal requests.
117676. **Upgrade-header authentication-gap tester** — verifies that WebSocket handshakes carry the same auth validation as REST calls, because an upgrade path with weaker auth is a backdoor into real-time features.
117677. **Socket idle-timeout resource-drain estimator** — measures how long the edge holds idle WebSocket connections to quantify how cheaply an attacker can exhaust connection pools.
117678. **Cross-protocol upgrade-smuggling checker** — tests whether ambiguous Upgrade headers can smuggle one protocol's traffic through another's edge policy, bypassing protocol-specific protections.
117679. **HTTP/2 rapid-reset hardening verifier** — confirms in-scope edges enforce stream-reset limits that blunt rapid-reset style DoS, since unthrottled resets can overwhelm even large fleets.
117680. **HTTP/2 stream-priority abuse reviewer** — checks whether manipulated stream priorities can starve legitimate traffic at the edge, because priority handling without caps is a fairness and availability risk.
117681. **QUIC handshake amplification-resistance tester** — measures the edge's response-to-request size ratio during QUIC handshakes to confirm anti-amplification limits hold, since UDP-based protocols invite reflection abuse.
117682. **HTTP/3 zero-RTT replay-safety reviewer** — verifies that 0-RTT early data is restricted to idempotent operations, because replayed early data can duplicate state-changing requests.
117683. **Protocol-downgrade consistency auditor** — confirms that security headers and WAF rules apply equally over HTTP/1.1, HTTP/2, and HTTP/3, since protections missing on one protocol version are trivially bypassed.
117684. **Anycast edge-failover readiness reviewer** — evaluates whether traffic reroutes cleanly when an anycast POP fails, because failover gaps turn a single POP outage into user-visible downtime.
117685. **DDoS-absorption capacity estimator** — models how much volumetric attack traffic the in-scope edge can absorb before scrubbing or blackholing kicks in, giving the report a realistic resilience figure.
117686. **Absorb-versus-scrub routing-policy auditor** — reviews the thresholds that decide when traffic shifts from absorption to scrubbing centers, since a mis-set threshold either wastes scrubbing budget or lets floods through.
117687. **Stale-service-worker edge-conflict reviewer** — checks whether outdated service workers pinned to old edge caches keep serving vulnerable assets after the CDN has purged them, because the client-side cache outlives the fix.
117688. **Edge KV data-classification reviewer** — inventories what data classes live in in-scope edge KV stores to flag secrets or PII stored where edge functions and logs can reach them.
117689. **KV TTL-versus-sensitivity alignment auditor** — compares KV entry lifetimes against data sensitivity so tokens and session data expire fast while static config can persist, because stale sensitive KV entries are quiet leaks.
117690. **Cross-tenant KV namespace-isolation tester** — verifies that one tenant's edge functions cannot read another tenant's KV entries, since namespace confusion at the edge is a cross-customer breach.
117691. **KV-backed session-store confidentiality checker** — audits session data kept in edge KV for encryption and access scoping, because plaintext sessions at the edge are one misconfigured function away from exposure.
117692. **Signed-cookie integrity verifier** — validates that in-scope signed cookies actually fail closed on tampering and expiry, since a signature that is never checked is just decoration.
117693. **Tokenized-URL expiry-enforcement tester** — confirms that time-limited media URLs stop working after their window, because a tokenized URL without enforced expiry is a permanent link.
117694. **URL-signature parameter-tampering checker** — tests whether signed URL parameters can be altered without invalidating the signature, since a signature covering only part of the URL protects only part of it.
117695. **Media-hotlink protection effectiveness reviewer** — evaluates referrer and token checks on in-scope media delivery to confirm hotlinking defenses actually block off-site embedding.
117696. **Subresource-integrity coverage mapper across CDN assets** — inventories every script and stylesheet served from the CDN to list assets missing integrity attributes, because one unsigned script is a supply-chain foothold.
117697. **SRI hash-staleness detector** — compares deployed integrity hashes against current CDN asset versions to find pages whose hashes no longer match, since stale hashes either break the page or get removed — both bad.
117698. **CDN-fallback script-integrity reviewer** — checks fallback copies of CDN-hosted scripts for matching integrity enforcement, because fallbacks that skip verification reintroduce the risk SRI was meant to remove.
117699. **Third-party edge-asset trust auditor** — catalogs third-party scripts pulled through the in-scope CDN and flags ones from unvetted or expired domains, since a lapsed third-party domain is a takeover waiting to happen.
117700. **Edge-access-log PII redaction verifier** — inspects in-scope CDN access logs for unredacted emails, tokens, or query-string secrets, because logs that archive PII become a breach of their own.
117701. **Log-shipping destination privacy reviewer** — audits where edge logs are shipped and who can read them to confirm PII never lands in broadly shared buckets or third-party analytics.
117702. **Debug-log verbosity-leak checker** — verifies that edge debug and trace logging is disabled in production, since verbose edge logs capture full request bodies including credentials.
117703. **Query-string sensitive-data logging auditor** — finds in-scope endpoints that place secrets in query strings and confirms the CDN strips or masks them before logging, because URLs are logged everywhere.
117704. **Edge-DNS CNAME-chain takeover-risk mapper** — walks CNAME chains behind in-scope CDN hostnames to find dangling records pointing at deprovisioned services, since a dangling edge CNAME is a subdomain-takeover path.
117705. **Certificate-log shadow SaaS harvester** — mines public certificate-transparency logs for the in-scope org's domains to enumerate SaaS apps staff provisioned on their own, because unsanctioned tools holding company data never appear in the official vendor register.
117706. **DNS TXT verification-trail mapper** — scans TXT records for domain-verification tokens from SaaS providers to reconstruct which apps were authorized over time, since every verification string left behind is a receipt of a shadow adoption.
117707. **SPF-include vendor chain auditor** — walks SPF include chains on corporate mail domains to list every third-party sender ever approved, because mail infrastructure records silently document SaaS tools the security team forgot.
117708. **Subdomain CNAME SaaS footprint mapper** — resolves all CNAME records of in-scope domains against known SaaS hostnames to inventory adopted tools, since vendors routinely require customers to point subdomains at their platforms.
117709. **Login-page favicon SaaS fingerprint sweep** — crawls discovered subdomains and matches login-page favicons and title tags to SaaS vendor signatures, because shadow apps still need public login pages that betray their identity.
117710. **Third-party script manifest builder** — renders in-scope pages in a headless browser and records every loaded script by source host, SRI status, and initiator chain, because you cannot review supply-chain exposure you have not inventoried.
117711. **Script integrity hash drift monitor** — re-fetches each third-party script on a schedule and alerts when content hashes change without a matching release note, since silent script mutation is how compromised vendors push malicious updates.
117712. **Tag-manager-launched script lineage tracker** — parses tag-manager containers to attribute each executing vendor script to its exact tag, trigger, and publisher, because tag managers hide the true origin of half the third-party code on a page.
117713. **Abandoned-domain script inclusion watcher** — flags third-party scripts loading from domains whose registration lapsed or whose DNS now resolves to parking, since dead vendor domains are prime takeover targets that inherit live script slots.
117714. **First-party proxy script chain auditor** — inspects self-hosted proxy endpoints that relay to vendor scripts to confirm the proxy cannot be turned into an open relay, because proxying third-party code for privacy still extends trust to the vendor's infrastructure.
117715. **Public breach-correlation vendor scorer** — cross-references each vendor against public breach disclosures and incident write-ups to adjust its risk score, since a vendor's public incident history is the strongest predictor of future exposure.
117716. **Vendor TLS posture benchmarker** — probes vendor endpoints for protocol versions, cipher suites, and certificate hygiene to rank transport security, because data shared with a vendor is only as safe as the channel it travels on.
117717. **Security-contact coverage gap mapper** — checks whether each vendor publishes a security contact and a vulnerability disclosure policy, since vendors without a public intake cannot receive incident reports when their customers find problems.
117718. **Vendor patch-cadence estimator** — samples version headers and changelog dates from vendor services to estimate how quickly they ship fixes, because slow patching vendors extend the window of exposure for shared integrations.
117719. **Acquisition-event vendor-risk re-scorer** — watches M&A announcements involving vendors to re-trigger risk scoring, since an acquisition can change data ownership, jurisdiction, and security priorities overnight.
117720. **Tenant OAuth grant sprawl auditor** — enumerates every third-party app authorized in the in-scope identity tenant and maps each to its owner and business purpose, because ungoverned OAuth grants quietly become standing data access.
117721. **Over-permissioned OAuth app flagger** — compares each granted app's requested scopes against what its function needs and flags broad mailbox, drive, or directory reads, since apps routinely request far more access than their features require.
117722. **Dormant OAuth consent recommender** — identifies granted apps unused for 90 days and proposes consent revocation with owner confirmation, because forgotten authorizations survive employee turnover and role changes.
117723. **Unverified-publisher OAuth app reviewer** — lists tenant-authorized apps from unverified publishers and checks their permission scope, since low-reputation publishers with high-privilege scopes are the classic consent-phishing profile.
117724. **OAuth refresh-token age mapper** — reports the age and last-use of refresh tokens per app to surface stale credentials that never rotate, because long-lived tokens widen the blast radius if a vendor is compromised.
117725. **Agency seat-sharing behavior detector** — analyzes login patterns on contractor accounts for concurrent sessions from distinct locations, since shared contractor seats defeat individual accountability and offboarding controls.
117726. **Contractor account lifecycle gap finder** — compares contractor account creation and expiry dates against engagement contracts to find accounts outliving their agreements, because zombie contractor accounts retain access nobody monitors.
117727. **Vendor SSO group membership auditor** — reviews the identity groups granting vendors access to in-scope systems and flags over-broad membership, since a single group can silently bundle production and billing permissions.
117728. **Time-boxed contractor access recommender** — proposes just-in-time expiry dates for contractor entitlements based on project milestones, because default-durable access is the main reason contractor permissions persist past their need.
117729. **Shared-inbox vendor delegation reviewer** — inventories delegated access to shared mailboxes and support inboxes granted to vendors, since mailbox delegation survives individual offboarding and hides in plain sight.
117730. **Acquired-domain certificate inventory merger** — merges the acquired company's certificate-transparency footprint into the parent's asset register, because M&A targets bring hidden SaaS, staging, and marketing domains.
117731. **Post-merger SSO consolidation gap finder** — detects acquired-company tenants and identity providers not yet federated under the parent's SSO, since parallel identity systems double the attack surface during integration.
117732. **Legacy acquired-tenant orphan detector** — finds SaaS tenants from the acquired org with no active admin or billing owner, because orphaned tenants keep running with nobody responsible for their configuration.
117733. **Acquired-brand subdomain mapping sweep** — enumerates subdomains of acquired brands and aliases to complete the in-scope inventory, since brand microsites and campaign domains rarely make it into the merger asset list.
117734. **Duplicate-SaaS overlap reconciler** — identifies tools both companies licensed for the same function and recommends consolidation, because duplicate SaaS doubles cost and doubles the third-party data footprint.
117735. **Contract-expiry access reaper scheduler** — links vendor contracts to their technical entitlements and queues access removal when contracts lapse, because expired vendors keep working access long after the legal relationship ends.
117736. **Offboarded-vendor SSO app cleanup list builder** — generates the concrete list of SSO apps, groups, and API keys to disable for a departing vendor, since offboarding without a checklist leaves credentials scattered across systems.
117737. **Expired-partner API key rotation verifier** — confirms that API keys issued to former partners are revoked or rotated, because partner keys embedded in old integrations outlive the partnership.
117738. **Vendor offboarding checklist evidence collector** — captures timestamped proof of each deprovisioning step for audit, since regulators and customers expect demonstrable vendor-exit hygiene, not verbal assurances.
117739. **Lingering vendor admin seat detector** — finds vendor accounts retaining administrative roles after their engagement ended, because admin seats are the highest-value residue of an expired vendor relationship.
117740. **Partner API key age and scope auditor** — inventories credentials issued to integration partners with creation date, scope, and last use, since over-scoped partner keys turn one integration into broad data access.
117741. **Partner callback signing-key refresh tracker** — records webhook signing secrets per partner and flags secrets older than the rotation policy, because static webhook secrets let a former partner forge event callbacks.
117742. **Partner OAuth client hygiene reviewer** — audits partner OAuth clients for confidential-client storage, redirect-URI strictness, and scope minimality, since misconfigured partner clients leak the trust placed in the integration.
117743. **Shared partner credential usage mapper** — detects the same partner credential used across production and non-production environments, because shared secrets erase the boundary between test and live data.
117744. **Partner IP-allowlist drift checker** — compares declared partner egress IPs against observed calling IPs to find undeclared sources, since partners whose infrastructure drifts silently may be routing through new, unvetted providers.
117745. **Chat-widget data-collection permission mapper** — documents what visitor data each embedded chat widget captures and where it is sent, because chat tools routinely ingest full page context including sensitive form inputs.
117746. **Analytics snippet PII capture reviewer** — inspects analytics and session-replay configurations for capture of passwords, payment fields, and health data, since replay tools can record keystrokes the site owner never intended to collect.
117747. **Payment-iframe domain allowlist auditor** — verifies that payment iframes are constrained to approved origins and that postMessage handlers validate senders, because embedded payment flows are the highest-value widget target.
117748. **Consent-banner vendor leakage checker** — tests whether tracking scripts fire before consent is given and whether rejection actually stops them, since consent banners that leak anyway create regulatory and trust exposure.
117749. **Embedded calendar widget auth reviewer** — checks scheduling widgets for exposed booking APIs and unauthenticated attendee data access, because calendar embeds often expose internal availability and participant details.
117750. **SaaS-to-SaaS OAuth scope graph builder** — builds a graph of which SaaS apps hold OAuth tokens into other SaaS apps to reveal transitive data paths, since one compromised app can pivot through its integrations.
117751. **Integration permission drift monitor** — snapshots integration scopes at setup and alerts when a vendor's requested scopes expand after an update, because integrations frequently accumulate permissions through upgrade prompts nobody reviews.
117752. **Over-privileged integration re-scoper** — recommends minimum viable scopes for each SaaS-to-SaaS connection based on actual API calls observed, since least privilege for integrations is rarely set at the initial install.
117753. **Orphaned integration connection pruner** — finds integration connections whose authorizing user has left the company and proposes re-authorization, because orphaned connections cannot be revoked through normal user offboarding.
117754. **Cross-tenant integration data-flow mapper** — traces data flows where a vendor's app bridges two customer tenants, since multi-tenant integrations can become unintended data-sharing channels.
117755. **High-risk vendor DPA coverage checker** — maps vendors processing personal or regulated data against signed data-processing agreements, because high-risk vendors without DPAs are a direct compliance violation.
117756. **Sub-processor disclosure gap finder** — compares vendor-published sub-processor lists against observed infrastructure to find undisclosed fourth parties, since vendors often add sub-processors without notifying customers.
117757. **DPA-less data-export detector** — monitors export and sync jobs to vendors lacking data-processing agreements, because scheduled exports are where unprotected data transfer actually happens.
117758. **Data-residency commitment verifier** — checks vendor endpoints and storage regions against contractual residency commitments, since a vendor's actual hosting geography can drift from what the contract promised.
117759. **DPA renewal date tracker** — tracks agreement expiry dates and triggers re-review before renewal, because expired DPAs leave ongoing processing without a legal basis.
117760. **Dependency provenance attestation checker** — verifies that in-scope products' open-source dependencies carry signed provenance attestations from trusted builders, since unattested packages can be swapped without detection.
117761. **Typosquat-risk dependency flagger** — scores dependency names against popular packages for character-substitution and lookalike risk, because a single mistyped package name can pull malicious code into the build.
117762. **Abandoned-maintainer dependency detector** — flags dependencies with no commits, releases, or maintainer activity beyond a threshold, since unmaintained packages accumulate unpatched vulnerabilities.
117763. **Hidden transitive dependency exposure chart** — expands the full transitive dependency tree and surfaces hidden high-risk packages, because direct dependencies are reviewed while transitive ones silently inherit trust.
117764. **Build-phase dependency-fetch traffic profiler** — records which hosts the build contacts when resolving dependencies, since build scripts fetching from unexpected domains indicate compromised or misconfigured registries.
117765. **CDN TLS and header configuration reviewer** — audits CDN distributions serving in-scope properties for TLS versions, HSTS, and header injection behavior, because misconfigured edge delivery undermines origin security controls.
117766. **Font-provider request auditor** — inspects web-font loading for tracking parameters and unnecessary third-party requests, since font providers can correlate visits across every site using their fonts.
117767. **CDN edge-cache data retention checker** — reviews cache rules for authenticated or personalized responses stored at the edge, because cached private content can be served to the wrong visitor.
117768. **Multi-CDN failover parity tester** — compares security headers and TLS settings across primary and failover CDN configurations, since failover paths often run weaker, untested configurations.
117769. **CDN WAF and bot-policy coverage mapper** — inventories which in-scope hostnames sit behind the CDN's WAF and bot management, because origin-direct subdomains bypass the edge protections everyone assumes are active.
117770. **Status-page subdomain impersonation watcher** — monitors newly registered domains and subdomains mimicking the org's status page, since fake status pages are a favored phishing lure during real outages.
117771. **Incident-channel access reviewer** — audits who can post to and read the incident-communication channels and status pages, because overly public incident channels leak operational detail during a crisis.
117772. **Status-page subscriber data exposure checker** — reviews what subscriber data status pages collect and whether it is exposed via APIs, since status subscriptions quietly build a contact list of your most engaged users.
117773. **Post-mortem archive redaction reviewer** — scans published incident post-mortems for internal hostnames, IPs, and customer identifiers, because historical incident write-ups leak infrastructure detail that stays public forever.
117774. **Status-page write-key exposure hunter** — searches public code and config for status-page API keys with write access, since leaked status keys let outsiders publish fake incident updates.
117775. **Helpdesk tenant auth hardening reviewer** — checks the support portal's authentication for SSO enforcement, MFA coverage, and session policies, because helpdesk tenants are rich phishing targets with weak default auth.
117776. **Support-macro credential exposure finder** — scans helpdesk macros and canned responses for embedded passwords and tokens, since support teams routinely paste credentials into reusable replies.
117777. **Ticket attachment retention policy checker** — reviews how long ticket attachments are stored and who can access archived files, because attachments often contain screenshots of sensitive customer data with indefinite retention.
117778. **Support-portal user enumeration hardener** — tests registration and password-reset flows on the helpdesk portal for account enumeration, since support portals frequently confirm which emails belong to customers.
117779. **Support-platform token privilege inventory** — inventories helpdesk API tokens, their scopes, and their owners, because over-scoped tokens turn a compromised support integration into full ticket-data access.
117780. **Tag-manager publish approval workflow reviewer** — checks whether tag-manager publishes require review and who holds publish rights, since one unreviewed publish can inject arbitrary scripts across the site.
117781. **Pixel firing rule privacy auditor** — audits marketing pixel firing rules for collection on checkout, account, and health pages, because pixels firing on sensitive pages send regulated data to ad platforms.
117782. **Marketing-platform SSO seat reviewer** — reviews marketing tool seats for former employees and agency staff, since marketing platforms hold audience data and ad spend with loose access controls.
117783. **A/B-test tool snippet permission mapper** — documents what the experimentation snippet can read and modify on in-scope pages, because A/B tools execute with enough privilege to alter payment flows.
117784. **Marketing data-warehouse export reviewer** — inventories scheduled exports from marketing platforms to warehouses and checks field-level masking, since exports quietly move PII into analytics systems with broad access.
117785. **HRIS tenant configuration hardener** — audits the HR SaaS tenant for SSO, role separation, and export controls, because HR systems hold the most sensitive employee data with the weakest oversight.
117786. **Payroll export access reviewer** — lists who can run and download payroll exports and whether downloads are logged, since payroll exports concentrate salary and banking data in single files.
117787. **Receipt-image PII retention reviewer for expense platforms** — reviews receipt images and OCR data retention in expense tools, because expense systems accumulate years of card numbers and travel itineraries.
117788. **Finance SaaS approval-chain integrity tester** — verifies that approval workflows in finance tools cannot be bypassed by reassigning or self-approving, since broken approval chains enable fraudulent payments.
117789. **Background-check vendor data handling reviewer** — checks what candidate data background-check vendors retain and how candidates can request deletion, because screening vendors hold identity documents indefinitely by default.
117790. **CI runner secret access reviewer** — inventories which secrets each CI runner and pipeline can read and flags overly broad access, since a compromised runner inherits every secret in its scope.
117791. **Error-tracking DSN key hygiene auditor** — checks error-tracking ingestion keys for public exposure in client bundles and rotation history, because leaked DSN keys let anyone flood the error pipeline.
117792. **Feature-flag service permission mapper** — documents who can toggle flags controlling in-scope product behavior, since flag services are a remote kill-switch for production features.
117793. **Artifact-registry token scope reviewer** — audits registry tokens for push versus pull scope and expiry, because over-scoped registry tokens allow publishing trojaned packages under the org's name.
117794. **Centralized log-query privilege and retention reviewer** — reviews log platform retention periods and who can query production logs, since centralized logs aggregate secrets and PII across every service.
117795. **Renewal-calendar security re-review scheduler** — schedules a fresh security review ahead of each vendor contract renewal, because renewal is the one moment of leverage to demand better terms.
117796. **Vendor SOC 2 freshness checker** — tracks the issue dates of vendor SOC 2 reports and flags stale or missing reports before renewal, since a three-year-old attestation says nothing about current controls.
117797. **Renewal-time permission re-certification trigger** — uses contract renewal as the trigger to re-certify all technical entitlements the vendor holds, because access granted three years ago rarely matches today's need.
117798. **Scope-change risk assessor** — compares the vendor's current data access against the original contract scope and flags expansions, since vendors steadily widen their access between renewals.
117799. **Auto-renewal clause security flagger** — surfaces contracts with automatic renewal that skip the security review gate, because auto-renewal silently extends vendor relationships past their risk acceptance.
117800. **Decommissioned-vendor data-deletion verifier** — requests and records proof that terminated vendors deleted customer data and backups, since contract termination alone does not remove data from vendor systems.
117801. **Vendor backup-retention commitment checker** — verifies vendor commitments on backup deletion timelines after offboarding, because backups routinely outlive the primary data deletion.
117802. **Tenant-export evidence collector** — captures the final data export from a decommissioned vendor tenant as proof of retrieval, since migration without export evidence leaves data stranded in a dead tenant.
117803. **Post-termination API access cut-off tester** — probes vendor-facing API endpoints after termination to confirm access is actually revoked, because deprovisioning tickets get closed without verifying the door is shut.
117804. **Residual vendor DNS record sweeper** — finds DNS records still pointing at decommissioned vendor infrastructure and flags them for removal, since leftover records can be claimed by whoever registers the vendor's old hostnames.
117805. **Authorized CSP effectiveness grading** — evaluate an in-scope site's Content Security Policy against its real script inventory so the agent can flag policies that are present but unenforced.
117806. **DOM XSS sink inventory via authorized dynamic analysis** — instrument a headless browser on the in-scope target to catalogue every DOM sink reached by URL-controllable data so reviewers can prioritize real injection paths.
117807. **postMessage origin-validation review for in-scope frames** — trace postMessage senders and receivers across the target's frames to flag handlers that trust events without origin checks.
117808. **Web Storage sensitive-data review** — scan localStorage and sessionStorage keys on in-scope pages for tokens, PII, or secrets that survive session end and should live in HttpOnly cookies instead.
117809. **Cookie attribute hygiene audit** — enumerate Set-Cookie headers on the target for missing Secure, HttpOnly, SameSite, and partitioned attributes so session fixation and CSRF exposure is measurable.
117810. **Subresource integrity coverage on third-party scripts** — diff every external script tag against its SRI hash presence so the agent can flag unsigned vendor code that could be swapped upstream.
117811. **Clickjacking and frame-ancestors policy review** — probe in-scope pages for X-Frame-Options or frame-ancestors gaps by attempting controlled framing of the target's own sensitive views.
117812. **Authorized Trusted Types coverage audit of the target's web apps** — check whether the target enforces Trusted Types policies at DOM sinks so the agent can verify XSS-neutralizing plumbing rather than assume it.
117813. **Client-side route authorization review** — map SPA routes behind in-scope auth walls and replay them as a low-privilege session to surface pages the frontend hides but the UI logic never truly guards.
117814. **Service-worker scope and update-channel review** — inspect registered service workers on the target for over-broad scopes and insecure update URLs that could turn a cache into a persistent takeover vector.
117815. **WebAssembly module provenance review on in-scope sites** — fingerprint shipped .wasm modules and their instantiation sources so unsigned or silently swapped binaries are flagged before they run privileged logic.
117816. **Browser-extension permission auditing for the target's published extensions** — review the manifest permissions and content-script host patterns of the target company's official extensions to flag over-privileged background pages.
117817. **Autofill and credential-manager interaction review** — test how in-scope login forms handle browser autofill heuristics so credential-field misconfigurations don't leak stored passwords into attacker-visible fields.
117818. **Payment Request API and checkout-frame isolation review** — audit the target's checkout flow for proper Payment Request scoping and iframe isolation so card data can't be siphoned by a framed third party.
117819. **WebRTC IP-leak and permission check on the target's real-time features** — run authorized WebRTC calls on the target's conferencing pages to detect local-IP leakage and microphone/camera prompts that fire without user intent.
117820. **Permissions-Policy coverage review** — enumerate Feature/Permissions-Policy headers and iframe allow attributes across the target to flag powerful APIs left open to every nested frame.
117821. **Authorized taint-flow mapping of prototype-pollution sources in client code** — statically trace user-controllable keys into object-merge utilities in the target's bundles to map pollution paths defensively before they reach gadgets.
117822. **Inline event-handler and javascript: URI hygiene review** — inventory on* attributes and javascript: hrefs across in-scope pages to measure how much inline script surface the CSP must still tolerate.
117823. **Tab-nabbing target=_blank review across in-scope properties** — crawl outbound links for missing rel=noopener so opener-phishing exposure is quantified rather than guessed.
117824. **Client-side encryption and key-management review** — examine in-scope crypto usage for keys derived in or exposed to the page context so the agent can flag encryption that is theater against a compromised DOM.
117825. **Vendor-script allow-list drift sentinel for in-scope sites** — build a versioned manifest of every external script the target loads and alert when new, unreviewed vendors appear between hunts.
117826. **iframe sandbox attribute review** — catalogue every sandboxed and unsandboxed iframe on in-scope pages to flag missing sandbox flags that would contain a compromised widget.
117827. **Cross-origin opener policy and embedder policy review** — check COOP/COEP/CORP headers on the target so the agent can confirm the site is actually isolated against cross-origin window attacks like XS-Leaks.
117828. **Referrer-Policy leakage review** — verify the target's referrer policy on sensitive flows so session tokens and internal paths aren't leaked to third parties via the Referer header.
117829. **Client-side redirect allow-list review** — trace open-redirect parameters through the target's frontend router to confirm destination allow-lists hold under encoded and double-encoded inputs.
117830. **History-manipulation and SPA navigation-state review** — audit pushState/replaceState usage on the target for state objects that stash tokens where browser history or extensions can read them.
117831. **WebSocket origin and CSRF review** — test the target's WebSocket endpoints for missing origin validation and CSRF tokens so hijacked browser sessions can't drive the socket.
117832. **Client-side GraphQL query-cost review** — measure whether the target's browser client can be coaxed into expensive queries, flagging missing depth and complexity limits on in-scope endpoints.
117833. **Shadow DOM and closed-root exfiltration review** — inspect closed shadow roots on in-scope components for secrets rendered into them, verifying they don't rely on obscurity for confidentiality.
117834. **Clipboard API permission review** — test the target's clipboard read/write calls for permission-gated usage so the agent can flag silent clipboard access during paste or focus events.
117835. **Geolocation and sensor-permission hygiene review** — audit when the target requests location, motion, or sensor access relative to user action so permission prompts aren't harvested by drive-by scripts.
117836. **Notification permission and push-endpoint review** — trace the target's push-subscription flow to confirm VAPID keys pin to the in-scope origin and notification payloads carry no sensitive data.
117837. **Credentialless and cross-origin iframe policy review** — check whether in-scope embeds use credentialless mode or COEP so third-party frames can't inherit ambient authority from the parent page.
117838. **Form-action and base-tag hijack review** — scan for dynamic form action rewriting and injected base tags that could redirect submissions to attacker domains under an XSS foothold.
117839. **Client-side template-injection surface review** — map frontend template engines on the target for server-rendered variables rendered into client templates, flagging SSTI-adjacent evaluation paths.
117840. **JSONP and legacy callback-endpoint review** — enumerate in-scope JSONP endpoints and dynamic callback parameters to flag token-bearing responses reachable cross-origin without a preflight.
117841. **CORS misconfiguration review from the browser's view** — replay credentialed fetches against in-scope APIs to confirm Access-Control-Allow-Origin never echoes arbitrary origins with credentials allowed.
117842. **Client-side cache-poisoning surface review** — test the target's frontend caching keys for unkeyed inputs so the agent can flag cacheable responses that vary by attacker-controlled parameters.
117843. **Download-attribute and blob-URL abuse review** — audit anchor download attributes and object URLs on in-scope pages that could be repurposed to drop files from the target's own origin.
117844. **MIME-sniffing and content-type review** — verify X-Content-Type-Options and accurate content types on in-scope uploads and responses so scriptable content can't be reinterpreted by the browser.
117845. **Password-field autocomplete and masking review** — check that in-scope credential fields use correct autocomplete values and masking so browser password managers behave predictably.
117846. **Client-side OTP and token-entry flow review** — analyze one-time-code inputs for rate-limit signaling and token-in-URL patterns that could let a shoulder-surfed link complete authentication.
117847. **Session-expiry and idle-timeout behavior review** — measure how the target's frontend handles token expiry and idle logout so stale sessions aren't left usable on shared devices.
117848. **Cross-tab session synchronization review** — test how the target propagates logout and privilege changes across open tabs so a revoked session can't keep acting in a sibling tab.
117849. **Client-side feature-flag authorization review** — inspect feature flags shipped to the browser for gates that merely hide premium UI while the underlying APIs stay callable.
117850. **Web-component dependency-supply review** — inventory custom-element bundles and their CDN sources on the target to flag components whose upstream feeds lack integrity verification.
117851. **CSS-injection and style-exfiltration review** — scan in-scope pages for user-controlled CSS that reaches style contexts, flagging paths that could exfiltrate data via attribute selectors.
117852. **Client-side search and autocomplete leakage review** — test the target's search-as-you-type endpoints for suggestions that reveal other users' data or internal document titles.
117853. **File-upload preview and client-side validation review** — examine in-browser upload previews for script-executing renderers so a malicious file can't execute in the target's origin during preview.
117854. **Drag-and-drop and clickjacking-adjacent UI review** — audit drag targets on in-scope pages for actions that trigger sensitive state changes without a confirmation step.
117855. **Client-side rate-limit signaling review** — check whether the target's UI distinguishes rate-limited, locked, and nonexistent accounts so user-enumeration isn't leaked through frontend messaging.
117856. **Browser-history sniffing via CSS review** — verify in-scope pages don't rely on :visited styling or other history-detection tricks that would turn the target's own pages into a privacy oracle.
117857. **WebUSB, WebBluetooth, and WebHID permission review** — catalogue device-API usage on the target so powerful hardware interfaces can't be invoked from unexpected pages.
117858. **Idle Detection and Wake Lock API review** — audit idle-detection and wake-lock usage on in-scope pages for background presence tracking that runs without clear user benefit.
117859. **Federated Credential Management (FedCM) review** — test the target's identity-federation prompts for account-chooser spoofing and silent sign-in behavior that could confuse users about which identity is active.
117860. **Passkey and WebAuthn client-side review** — verify the target's WebAuthn ceremonies bind challenges to the correct origin and RP ID so phishing sites can't relay the credential flow.
117861. **Client-side JWT handling review** — inspect how the target stores and refreshes JWTs in the browser, flagging tokens readable by scripts when an HttpOnly cookie would suffice.
117862. **OAuth redirect and PKCE client review** — trace the target's in-browser OAuth flows for state-parameter validation and PKCE enforcement so authorization codes can't be intercepted and replayed.
117863. **PostMessage structured-clone gadget review** — analyze message payloads the target clones across origins for functions or DOM nodes that could rehydrate into executable gadgets.
117864. **Client-side SSRF-adjacent fetch review** — map fetch and image-src URLs the browser builds from user input to flag patterns where the frontend turns user data into server-fetchable URLs.
117865. **Beacon and ping-attribute tracking review** — inventory navigator.sendBeacon and ping attributes on in-scope pages to confirm analytics don't transmit sensitive form contents on navigation.
117866. **Client-side PDF and document-renderer review** — test the target's in-browser PDF viewers for embedded JavaScript execution so documents render inertly within the origin.
117867. **Font and external-resource fingerprinting review** — check whether the target's resource loading lets third parties fingerprint users through font or timing side channels, and whether subresource hints are minimal.
117868. **Prefetch and prerender cross-origin review** — audit speculation-rules and link prefetching on the target so prerendered pages can't trigger authenticated actions before the user navigates.
117869. **Authorized experiment-flag and A/B leakage review** — inspect experiment assignments shipped to the browser for control-group flags that expose unreleased endpoints or admin routes.
117870. **Error-message and stack-trace exposure review** — review client-side error handlers on the target for verbose stack traces or API internals leaked into the console or UI.
117871. **Source-map exposure and review** — check whether production source maps are publicly reachable on the target so the agent can confirm or rule out full source disclosure.
117872. **Client-side logging and telemetry PII review** — inspect what the target's frontend ships to logging endpoints to flag tokens, emails, or keystrokes captured in telemetry.
117873. **Web-storage quota and eviction abuse review** — test whether the target's offline storage can be filled or evicted by third-party frames to degrade or fingerprint the in-scope app.
117874. **SharedArrayBuffer and high-resolution timer review** — verify cross-origin isolation gates on the target before flagging Spectre-class timer access from embedded content.
117875. **Client-side biometric prompt review** — audit WebAuthn and device-biometric prompts on the target for phishing-resistant UX so users can distinguish genuine origin-bound prompts from page-drawn lookalikes.
117876. **Autofill phishing via hidden-field review** — test whether the target's forms expose hidden inputs to autofill so stored credentials aren't silently placed into attacker-influenced fields.
117877. **In-app browser and WebView bridge review** — assess the target's mobile web flows for JavaScript bridges that expose native capabilities beyond what the page legitimately needs.
117878. **Client-side deep-link and intent validation review** — trace deep links and Android intents the target registers to confirm parameter validation before native actions fire.
117879. **Payment-method and wallet-API scoping review** — review the target's digital-wallet integrations so payment handlers are registered only for the merchant's own verified origins.
117880. **Client-side CAPTCHA and bot-challenge review** — evaluate whether the target's bot challenges run before or after sensitive actions so automation defenses actually gate the protected flow.
117881. **Third-party consent and CMP script review** — audit the target's consent-management platform for scripts that execute before consent is recorded, defeating the banner's purpose.
117882. **Client-side chat-widget data review** — inspect embedded chat and support widgets on in-scope pages for session tokens or page contents shared with the widget vendor.
117883. **Heatmap and session-replay privacy review** — check the target's session-replay tooling for masking of password, card, and PII fields so recordings can't be mined for secrets.
117884. **Client-side analytics allow-list review** — inventory analytics endpoints receiving browser events to flag data sent to unvetted domains on authenticated pages.
117885. **Extension-detectability and anti-debug review** — test whether the target's defenses against malicious extensions break legitimate accessibility tooling, flagging over-aggressive debugger detection.
117886. **Browser-profile and kiosk-mode leakage review** — assess the target's behavior in shared or kiosk browsers to confirm cached credentials and downloads are scoped per profile.
117887. **Client-side certificate and HPKP-pinning review** — check whether the target's native wrappers or PWAs pin certificates so MITM proxies can't silently intercept the app's traffic.
117888. **PWA installability and scope-hijack review** — audit the target's web-app manifest scope and start URL so installed PWAs can't be redirected outside the controlled scope.
117889. **Client-side update-notification integrity review** — verify that in-app update prompts and changelogs on the target are served from and signed by the in-scope origin before users act on them.
117890. **Cross-window messaging audit-trail review** — confirm the target logs or constrains sensitive postMessage exchanges so cross-frame data flows are reviewable during incident response.
117891. **Client-side secret-scanning in shipped bundles** — run automated secret detection across the target's JavaScript bundles to catch API keys and private tokens baked into frontend code.
117892. **Dependency-confusion in frontend package review** — check the target's build manifests for private package names that could be shadowed by public registry typosquats at build time.
117893. **Client-side build-provenance review** — verify the target's deployed bundles carry reproducible-build markers or attestations so tampered frontend releases are detectable.
117894. **Subdomain takeover via dangling CNAME review** — scan in-scope subdomains for dangling DNS records that could let an outsider serve content from the target's own hostname.
117895. **Client-side DNS-prefetch privacy review** — audit dns-prefetch hints on the target for hostnames that reveal user intent to third-party resolvers before any click.
117896. **Browser-translation and page-modification review** — test how the target behaves under browser auto-translation to confirm security-critical labels aren't altered or stripped by translation.
117897. **Client-side print and export leakage review** — check print stylesheets and export features on the target for sensitive fields that appear in printouts but not on screen.
117898. **Accessibility-tree data-exposure review** — verify that aria labels and accessibility snapshots on in-scope pages don't expose masked values to assistive-technology APIs beyond what's shown visually.
117899. **Client-side time and locale spoofing review** — test whether the target's time-sensitive logic trusts browser clocks so manipulated dates can't extend trials or bypass expiry checks.
117900. **WebTransport and WebCodecs permission review** — catalogue WebTransport and WebCodecs usage on the target to confirm low-level networking and media APIs are gated behind user-visible permission flows.
117901. **Client-side ML-model extraction review** — assess in-browser ML models the target ships for weight-extraction exposure so proprietary models aren't trivially downloadable.
117902. **Canvas and media fingerprinting surface review** — measure the target's own fingerprinting footprint so the agent can advise reducing entropy collection to what fraud prevention truly needs.
117903. **Client-side dark-pattern and consent-UX review** — flag pre-ticked sharing toggles and confusing opt-outs on in-scope pages that undermine the consent the security model assumes.
117904. **Client-side security-header regression tracking** — snapshot the target's full browser-facing header set per hunt so regressions in CSP, COOP, or permissions policies are caught by diff, not by accident.
117905. **Hunt role-based workspaces** — give each team member a scoped hunt view with their own notes and findings queue so parallel testers stop duplicating each other's work.
117906. **Finding review and approval pipeline** — route every draft finding through configurable reviewer stages with accept or request-changes actions before submission, so reports leave the team clean the first time.
117907. **In-hunt annotation layer** — let testers pin notes, hypotheses, and evidence snapshots directly onto requests, endpoints, and screenshots so teammates inherit context instead of re-deriving it.
117908. **Shift-change hunt handoff packs** — generate a transfer brief of open threads, claimed endpoints, and blockers when a tester or agent ends a shift so the next person resumes with zero cold-start.
117909. **Real-time duplicate finding detection** — compare draft findings across teammates by endpoint, parameter, and behavior signature and warn before a second person spends hours on the same bug.
117910. **Skill-based task assignment engine** — match open test tasks to team members by their demonstrated strengths from past hunts so hard targets land with the right people.
117911. **Mentor mode for junior hunters** — pair juniors with senior reviewers who approve test plans and coach on findings in-product, turning every hunt into guided training.
117912. **Automated hunt retrospective timelines** — reconstruct a hunt's full activity timeline from logs, findings, and notes so the team can debrief on facts instead of fading memories.
117913. **Shared reconnaissance artifact library** — keep team-curated recon artifacts (scope maps, technology notes, authorized observations) in one searchable place so no one re-scans what the team already knows.
117914. **Privacy-aware live activity feed** — show the team who is probing what right now with presence controls and redacted details, enabling coordination without surveillance.
117915. **Red and blue coordinated exercise mode** — run joint exercises where the red team hunts and the blue team receives delayed, sanitized alerts, with a shared scoreboard and joint after-action report.
117916. **Client stakeholder read-only dashboards** — give target owners a live view of hunt progress and finding summaries without edit rights, so status meetings run themselves.
117917. **Finding discussion threads** — attach threaded conversations to each finding with resolution tracking so questions, evidence, and decisions stay with the bug.
117918. **Hunt template sharing across teams** — publish methodology playbooks as reusable hunt templates that other teams can fork and adapt, spreading what works.
117919. **Team performance analytics** — report aggregate outcomes like coverage, cycle time, and finding quality with team-level framing so the data informs staffing, never individual surveillance.
117920. **Critical finding escalation paths** — push instant notifications to target owners through configurable chains with fallback contacts when a critical finding is confirmed, because hours matter.
117921. **Pair hunting mode** — let two testers or agents work one surface together with merged findings and shared notes, combining complementary instincts on hard targets.
117922. **Hunt access audit trails** — log who viewed, edited, and exported what in a hunt so compliance teams get a clean, exportable record of data handling.
117923. **Scoped expiring guest access** — onboard contractors and guest hunters with time-boxed, least-privilege hunt access that auto-revokes, keeping the roster tight by default.
117924. **Post-hunt knowledge capture** — prompt the team to distill lessons into the playbook library at hunt close so hard-won techniques survive beyond the people who found them.
117925. **Finding ownership claims with auto-expiry** — let a tester claim an endpoint or finding while active, with claims lapsing after inactivity so stale locks never block the team.
117926. **Endpoint custody check-in and check-out** — mark endpoints as under active testing so teammates pick adjacent surfaces instead of colliding.
117927. **Shared authorized test account roster** — manage the team's pool of in-scope test accounts with role assignments and usage notes, ending the scramble for credentials.
117928. **Team-wide false positive suppression** — share confirmed non-issues across the team so one person's dead end becomes everyone's saved hour.
117929. **In-hunt team chat channels** — give each hunt a dedicated discussion channel with finding cards and alert hooks so coordination lives where the work happens.
117930. **Async standup digests** — auto-compile each member's recent activity into a short daily brief so distributed teams stay aligned without meetings.
117931. **Finding triage queue with SLA timers** — hold new findings in a triage lane with visible aging so nothing waits days for a first review.
117932. **Peer proof-of-concept quality review** — have a second tester validate the proof of concept for clarity and reproducibility before submission, catching the gaps authors cannot see.
117933. **Collaborative report co-authoring** — let multiple authors edit the final report with conflict-free merging and per-section ownership, so writing scales like testing.
117934. **Inline reviewer comments on evidence** — let reviewers annotate screenshots and request traces directly so feedback lands exactly where the fix is needed.
117935. **Versioned report drafts with diff view** — keep every report revision with side-by-side diffs so teams see what changed between reviews and submissions.
117936. **Finding merge and split tools** — combine overlapping findings or separate a compound finding into distinct issues with evidence carried along, keeping the report structure honest.
117937. **Severity dispute resolution workflow** — escalate severity disagreements through a structured path with rationale capture so disputes end in a recorded decision, not a stalemate.
117938. **Reviewer round-robin assignment** — distribute review load evenly across qualified reviewers with workload caps so no single person becomes the bottleneck.
117939. **Review backlog aging alerts** — nudge reviewers and leads when findings sit unreviewed past threshold, keeping the pipeline from silently stalling.
117940. **Quality rubric scoring for reports** — score submissions against a shared rubric of clarity, impact, and reproducibility so feedback is consistent and coaching is concrete.
117941. **Coaching notes from reviewers** — let seniors attach improvement guidance to review feedback so juniors build skill with every submission cycle.
117942. **Junior shadow review program** — route junior findings through a practice review lane where feedback is detailed and public mistakes are safe, accelerating ramp-up.
117943. **Team skill matrix from hunt outcomes** — derive each member's demonstrated strengths from validated findings so staffing decisions use evidence, not guesswork.
117944. **Complementary skill pairing suggestions** — propose tester pairs whose strengths cover different bug classes so pair hunts maximize coverage.
117945. **Open task marketplace** — list unclaimed test tasks that teammates can pick up, making spare capacity visible and self-directed.
117946. **Hunt role definitions (lead, tester, reviewer, observer)** — codify responsibilities per role with matching permissions so everyone knows their lane from kickoff.
117947. **Observer mode with annotations** — let stakeholders watch a hunt read-only while adding questions as annotations, keeping visibility without interference.
117948. **Finding lifecycle state machine** — track each finding through draft, triage, confirmed, submitted, and fixed states with SLA countdowns so the team always knows what needs attention.
117949. **Stale finding nudges** — ping owners when a finding idles in a state too long, preventing quiet abandonment.
117950. **Inactivity auto-reassignment** — move orphaned findings back to the team inbox after defined idle periods so work never dies with an absent owner.
117951. **Team capacity dashboard** — show aggregate workload across active hunts in team terms so leads balance load without naming and shaming.
117952. **Scope coverage heatmap** — visualize which areas each team member has touched so gaps are obvious and re-testing is deliberate.
117953. **Collision alerts for shared endpoints** — warn when two testers start probing the same endpoint so they coordinate instead of duplicating traffic.
117954. **Shared scope interpretation notes** — keep the team's agreed reading of scope rules in one place so edge cases are decided once, not per tester.
117955. **Scope question queue** — let testers raise scope questions for the hunt lead to answer publicly, building a reference for the whole team.
117956. **Timezone-aware handoff scheduling** — plan shift changes around team timezones with quiet-hour respect so global teams hand off without waking anyone.
117957. **Voice and video notes on findings** — attach short spoken walkthroughs to findings so nuanced observations transfer faster than text alone.
117958. **Lessons learned tagging** — tag retrospective insights by bug class and technique so future hunts can search past wisdom by problem type.
117959. **Playbook version control with changelog** — track methodology updates with authorship and change notes so teams trust and adopt improvements.
117960. **Playbook usage analytics** — show which playbook entries actually guide hunts so the team invests in what works and prunes what does not.
117961. **Parameterized hunt templates** — build templates with variables for target type and scope so new hunts start from proven methodology in minutes.
117962. **Cross-team template marketplace** — let teams browse, rate, and adopt each other's hunt templates, turning methodology into a shared asset.
117963. **Hunt cloning with roster carryover** — spin up a follow-up hunt from a previous one, preserving team, templates, and notes while resetting findings.
117964. **Exercise scheduling with dual views** — coordinate red and blue exercise calendars where each side sees its own brief plus shared rules of engagement.
117965. **Delayed sanitized blue team alerts** — feed the defending team redacted detection events on a configurable delay so exercises stay realistic and fair.
117966. **Exercise scoreboard with agreed rules** — score joint exercises on pre-agreed criteria visible to both sides so the outcome is trusted, not contested.
117967. **Joint after-action report builder** — co-author the exercise debrief with red findings and blue detections side by side, capturing the full learning loop.
117968. **Chat integration with finding cards** — push structured finding updates into team chat tools with rich cards and threaded replies, meeting teams where they already talk.
117969. **Role-based notification preferences** — let each member tune what they get notified about by role and urgency so alerts stay signal, not noise.
117970. **Critical finding pager with fallback** — page the target owner's on-call through escalating channels until acknowledged, because unacknowledged criticals are the real risk.
117971. **Decision log for scope calls** — record every scope interpretation decision with rationale and approver so later questions get answers, not arguments.
117972. **Shared risk register per hunt** — track testing risks (rate limits, fragile endpoints, data sensitivity) in one view so the team mitigates together.
117973. **Hunt wiki per team** — maintain target-specific vocabulary, environment quirks, and contact lists in a living team wiki that outlasts any single hunt.
117974. **Subdomain ownership board** — claim subdomains or asset groups for investigation on a shared board so recon divides cleanly across the team.
117975. **Technology fingerprint notes** — share stack observations (frameworks, headers, behaviors) in a common log so everyone tests against the real surface.
117976. **Retest assignment to original finder** — route fix verifications back to the tester who found the issue, since they know the exact reproduction path.
117977. **Fix verification queue** — hold remediated findings in a retest lane with the original evidence attached so verification is rigorous, not rubber-stamped.
117978. **Cross-hunt pattern sharing** — surface when the same bug class appears across different targets so the team hunts the pattern everywhere, not just once.
117979. **Hunt archive with full-text search** — make every past hunt's findings, notes, and decisions searchable so institutional memory is one query away.
117980. **Client question and answer threads per finding** — give target owners a structured place to ask questions on each finding with resolution states, replacing scattered email chains.
117981. **Coordinated disclosure timeline tracker** — manage embargo dates, patch confirmations, and disclosure milestones in a shared timeline so releases stay synchronized.
117982. **Portfolio view across team hunts** — show all active hunts, their stages, and resource needs in one program-level dashboard for leads managing multiple teams.
117983. **Blameless retrospective format** — structure debriefs around process and conditions rather than individuals so teams surface real causes without fear.
117984. **Retrospective action item tracking** — turn debrief commitments into tracked actions with owners and due dates so improvements actually happen.
117985. **Hunt lead command dashboard** — give leads one view of progress, blockers, risks, and staffing so they manage by exception instead of chasing updates.
117986. **Blocker escalation to lead** — let testers flag blockers (access, scope ambiguity, environment issues) straight to the lead queue with context attached.
117987. **Client status report auto-generation** — compile hunt progress, findings, and next steps into a client-ready summary on schedule, cutting manual reporting.
117988. **Anonymous peer feedback after hunts** — collect optional, unattributed feedback on team collaboration so working norms improve without blame.
117989. **Guest onboarding checklist with NDA tracking** — walk contractors through access grants, scope briefings, and NDA status in one checklist so nothing is skipped.
117990. **Access review campaigns** — run periodic reviews of who holds hunt access with one-click revoke, keeping permissions current as teams change.
117991. **Work product ownership transfer** — assign contractor-produced findings and notes to the internal team on exit so knowledge never walks out the door.
117992. **Audit trail export for compliance** — export hunt access and action logs in a signed, tamper-evident format that compliance teams can hand to auditors directly.
117993. **Team working norms document** — capture each hunt's agreed collaboration norms (response times, review etiquette, escalation use) in a living doc the team actually reads.
117994. **Severity disagreement mediation path** — bring in a neutral senior reviewer when finder and reviewer cannot agree on severity, with both rationales preserved.
117995. **Finding of the month voting** — let the team vote on the most instructive finding each cycle, celebrating craft and spreading technique.
117996. **New hunter ramp-up hunt track** — assign newcomers a guided sequence of practice hunts with increasing autonomy so they contribute safely from week one.
117997. **Skill endorsements from peers** — let teammates vouch for each other's demonstrated expertise so staffing reflects lived experience, not self-rating.
117998. **Hunt kickoff checklist** — walk the team through scope, roles, comms, and access before testing starts so hunts begin aligned, not chaotic.
117999. **Decision review for past scope calls** — revisit earlier scope decisions when new information arrives, with the original rationale visible for fair re-evaluation.
118000. **Team maturity assessment over time** — track collaboration health indicators (review cycle time, handoff completeness, knowledge reuse) across hunts so the team improves deliberately.
118001. **Shared assumption log** — record the team's working assumptions about the target in one place so they are challenged and updated together.
118002. **Resource request queue** — let testers request test accounts, scope clarifications, or environment access through a visible queue the lead triages.
118003. **Client communication template library** — share pre-approved status updates, finding summaries, and disclosure drafts so client messaging stays consistent and professional.
118004. **Quiet hour aware notifications** — hold non-urgent team notifications during each member's local quiet hours and deliver a morning digest, respecting rest across timezones.
