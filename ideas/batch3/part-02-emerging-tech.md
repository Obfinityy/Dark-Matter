21005. **RPC method allowlist fingerprinting** — the agent enumerates every `eth_*` method a node's JSON-RPC endpoint answers and flags dangerous `admin_*`, `debug_*`, or `miner_*` methods that must never be public.
21006. **Mempool transaction visibility leak detection** — the agent checks whether a dApp's public RPC exposes pending-transaction payloads that reveal other users' trading intent before confirmation.
21007. **Bridge API quote validation hardening** — the agent submits malformed cross-chain bridge quotes (zero-amount, negative, mismatched decimals) to confirm the API rejects them before routing funds.
21008. **Solana commitment-level drift checks** — the agent requests `processed`, `confirmed`, and `finalized` commitment levels and flags APIs that silently downgrade finality guarantees.
21009. **The Graph subgraph query-cost abuse testing** — the agent measures whether deep indexed GraphQL queries execute without authentication or rate limits, exposing indexer cost-abuse denial of service.
21010. **WalletConnect relay session origin binding** — the agent verifies relay servers bind session topics to the originating domain so stolen session URIs cannot be replayed elsewhere.
21011. **ENS reverse-resolution validation checks** — the agent tests whether a dApp verifies ENS reverse records on-chain before displaying a trusted name instead of accepting user-supplied mappings.
21012. **Polkadot node metadata version drift** — the agent compares served chain metadata versions against the canonical runtime to catch nodes misleading transaction construction with stale types.
21013. **RPC API key scope enforcement** — the agent attempts premium-tier methods with a free-tier key to confirm the provider genuinely enforces plan-based method scoping.
21014. **Transaction simulation divergence detection** — the agent compares `eth_call` simulation results against mined outcomes to flag RPCs that misreport gas usage or execution results.
21015. **Private mempool relay auth checks** — the agent probes mev-boost and private-bundle relays for unauthenticated bundle submission that lets anyone inject ordering attacks.
21016. **NFT metadata origin trust checks** — the agent verifies marketplace APIs validate `tokenURI` origins on-chain rather than rendering attacker-supplied metadata URLs as genuine.
21017. **IPFS gateway pin-queue exposure** — the agent checks whether public gateways leak pin-request queues or CID access logs that reveal who pinned which content.
21018. **EIP-712 cross-chain replay checks** — the agent tests whether dApp backends enforce `chainId` in typed-data signatures so a signature cannot be replayed on another chain.
21019. **Gas oracle endpoint trust checks** — the agent verifies frontends source gas estimates from authenticated oracles rather than unsigned endpoints anyone can skew.
21020. **Smart contract proxy upgrade monitoring** — the agent watches proxy admin slots and implementation-change events to flag unannounced upgrades that silently alter trust assumptions.
21021. **Beacon chain validator API key leaks** — the agent scans for exposed validator client REST APIs that leak duties, keys metadata, or allow fee-recipient changes.
21022. **Light client trust anchor verification** — the agent checks whether light-client backends pin trusted checkpoint hashes instead of syncing from the first peer they meet.
21023. **Cross-chain message relayer auth** — the agent tests whether relayer APIs (LayerZero, Wormhole, Axelar) authenticate message delivery requests or accept spoofed payloads.
21024. **DEX aggregator slippage oracle checks** — the agent verifies aggregator backends validate slippage bounds server-side instead of trusting client-submitted minimums.
21025. **Staking pool validator key custody surface** — the agent maps liquid-staking APIs that expose validator assignment endpoints which could be abused to redirect rewards.
21026. **Governance proposal execution timelock checks** — the agent verifies DAO backends enforce timelock delays between proposal passage and execution to block instant malicious upgrades.
21027. **Flash loan callback reentrancy surface** — the agent reviews lending-protocol callback handlers for state updates ordered after external calls, flagging reentrancy-prone flows.
21028. **Oracle price-feed staleness detection** — the agent monitors Chainlink-style feed timestamps via the dApp's backend to flag UIs that trade on stale prices without warning.
21029. **Multisig transaction queue tampering checks** — the agent tests whether multisig coordination APIs (Safe transaction service) let non-owners reorder or replace queued transactions.
21030. **Account abstraction bundler policy checks** — the agent probes ERC-4337 bundler endpoints for missing sender reputation or paymaster sponsorship abuse controls.
21031. **Paymaster sponsorship drain detection** — the agent measures whether paymaster APIs cap sponsorship per sender so one actor cannot drain the gas tank.
21032. **Intent-based solver auction fairness** — the agent checks whether intent/solver marketplaces authenticate solver bids to prevent quote stuffing or front-running of user intents.
21033. **MEV protection RPC ordering guarantees** — the agent verifies MEV-protected RPCs actually enforce the promised ordering policy rather than passing transactions straight to the public mempool.
21034. **Sequencer feed integrity checks (L2)** — the agent compares L2 sequencer transaction feeds against finalized batches to detect censored or reordered transactions.
21035. **Withdrawal bridge finality checks** — the agent tests whether L2-to-L1 withdrawal APIs enforce the full challenge period before releasing funds.
21036. **State channel dispute window validation** — the agent verifies state-channel backends honor dispute windows and reject late settlement submissions.
21037. **zk-Rollup proof verification liveness** — the agent monitors whether validity-proof submission stalls are detected and surfaced instead of silently freezing withdrawals.
21038. **Data availability sampling endpoint checks** — the agent tests whether DA-layer APIs (Celestia, EigenDA) authenticate blob submission to prevent free-riding on shared throughput.
21039. **Restaking operator slashing transparency** — the agent checks whether restaking dashboards disclose operator slashing history fetched from verifiable on-chain sources.
21040. **Token vesting schedule bypass checks** — the agent probes vesting-contract claim endpoints for schedule manipulation via crafted cliff or linear parameters.
21041. **Airdrop claim Merkle proof validation** — the agent verifies claim backends validate Merkle proofs server-side instead of trusting client-submitted eligibility flags.
21042. **NFT royalty enforcement detection** — the agent checks whether marketplace APIs honor on-chain royalty registries or let sellers bypass creator fees silently.
21043. **Fractionalized NFT vault redemption checks** — the agent tests whether fractional-vault redemption endpoints enforce pro-rata claims without double-spend.
21044. **Lending liquidation oracle latency checks** — the agent measures the delay between oracle price updates and liquidation execution to flag unfair liquidation windows.
21045. **Perpetuals funding-rate manipulation surface** — the agent checks whether perp DEX backends bound funding-rate inputs so a single actor cannot skew the rate feed.
21046. **Options protocol expiry settlement checks** — the agent verifies options settlement uses the canonical expiry price source rather than a manipulable spot endpoint.
21047. **AMM pool initialization front-run checks** — the agent tests whether pool-creation APIs protect initial liquidity parameters from front-running during deployment.
21048. **Concentrated liquidity range griefing checks** — the agent reviews range-position APIs for griefing vectors where dust positions block legitimate liquidity.
21049. **Stablecoin depeg circuit-breaker checks** — the agent verifies stablecoin protocol backends trigger circuit breakers on depeg instead of continuing normal mint/redeem flows.
21050. **Wrapped asset custodian proof checks** — the agent checks whether wrapped-token dashboards link to verifiable custodian attestations rather than self-asserted reserves.
21051. **Bitcoin Inscription marketplace index integrity** — the agent verifies Ordinals indexers return consistent inscription ownership data across repeated queries.
21052. **Runes/Ordinals mempool sniping surface** — the agent checks whether inscription mint APIs leak unconfirmed mint transactions that snipers can front-run.
21053. **Lightning invoice replay checks** — the agent tests whether Lightning service backends reject already-paid invoices instead of crediting them twice.
21054. **DLC oracle attestation validation** — the agent verifies discrete-log-contract platforms validate oracle attestations against the announced public key before settlement.
21055. **Cosmos IBC relayer channel spoofing checks** — the agent tests whether IBC relayer APIs authenticate channel handshakes so fake channels cannot mint unbacked vouchers.
21056. **IBC denom trace validation** — the agent verifies frontends display full IBC denom traces so users can distinguish genuine tokens from spoofed vouchers.
21057. **Cosmos validator commission change alerts** — the agent monitors validator commission-rate change transactions to warn delegators of sudden fee hikes.
21058. **Osmosis-style concentrated pool manipulation checks** — the agent tests whether DEX frontends bound price-impact calculations to prevent display of manipulated quotes.
21059. **Solana program upgrade authority monitoring** — the agent tracks program upgrade-authority transfers and flags programs whose authority moved to an unknown key.
21060. **Solana account data deserialization checks** — the agent probes program APIs that accept arbitrary account inputs to flag missing owner or discriminator validation.
21061. **SPL token mint authority exposure** — the agent scans token mints for retained mint authorities that let issuers inflate supply after promising a fixed cap.
21062. **Solana priority fee estimation integrity** — the agent verifies fee-estimation APIs return honest recent prioritization fees rather than values that cause stuck transactions.
21063. **Jupiter-style aggregator route transparency** — the agent checks whether aggregator APIs disclose the full route and intermediate hops instead of hiding toxic routing.
21064. **Solana durable nonce replay checks** — the agent tests whether backends enforce durable-nonce uniqueness so offline-signed transactions cannot be replayed.
21065. **Polkadot XCM message validation** — the agent verifies parachain XCM handlers validate message origins so spoofed cross-consensus messages cannot mint assets.
21066. **Parachain collator selection transparency** — the agent checks whether collator-set changes are announced on-chain before taking effect.
21067. **Substrate session key rotation checks** — the agent verifies validator session-key rotation actually takes effect instead of leaving stale keys authorized.
21068. **Nomination pool unbonding queue fairness** — the agent tests whether nomination-pool APIs process unbonding requests in FIFO order without preferential skipping.
21069. **Avalanche subnet RPC isolation** — the agent checks whether subnet RPC endpoints enforce separate auth from the primary network to prevent cross-subnet method access.
21070. **Avalanche warp message signature checks** — the agent verifies warp-message consumers validate BLS aggregate signatures against the source subnet's validator set.
21071. **Near account key rotation surface** — the agent tests whether NEAR backends revoke old full-access keys after rotation instead of leaving them valid.
21072. **Near function-call access key scoping** — the agent verifies function-call keys are restricted to the intended contract and methods rather than over-broad allowances.
21073. **Algorand rekeying validation** — the agent checks whether wallets and backends detect rekeyed accounts and warn before sending funds to compromised keys.
21074. **Cardano Plutus datum exposure** — the agent checks whether dApp backends leak Plutus datums containing sensitive off-chain agreement details.
21075. **Cardano collateral UTxO handling** — the agent verifies collateral selection logic cannot be tricked into locking user funds as script collateral.
21076. **Tezos baker delegation change alerts** — the agent monitors delegation operations to warn users when their baker changes without their action.
21077. **Tron resource delegation abuse checks** — the agent tests whether energy/bandwidth delegation APIs prevent delegation-based resource exhaustion attacks.
21078. **BNB Greenfield storage provider auth** — the agent verifies decentralized-storage APIs authenticate bucket-policy changes so strangers cannot rewrite access rules.
21079. **Fantom-style validator API exposure** — the agent scans validator operator APIs for endpoints that leak staking keys or allow unauthorized withdrawals.
21080. **Harmony bridge event validation** — the agent checks whether bridge UIs validate deposit events against finalized blocks rather than unconfirmed logs.
21081. **ZkSync Era fee estimation honesty** — the agent compares quoted L2 fees against actual charged fees to flag systematic overestimation.
21082. **Starknet sequencer transaction ordering** — the agent analyzes sequencer inclusion patterns to detect preferential ordering sold outside the public fee market.
21083. **Arbitrum delayed inbox censorship checks** — the agent verifies the delayed inbox path remains usable so the sequencer cannot fully censor a user.
21084. **Optimism fault-proof challenge liveness** — the agent monitors fault-proof game participation to flag windows where invalid outputs could finalize unchallenged.
21085. **Base/OP-stack chain config drift** — the agent compares OP-stack chain configs served by indexers against canonical chain specs to catch misconfigurations.
21086. **Scroll zkEVM proof batching delays** — the agent measures proof-batching latency to flag degraded finality that withdrawal UIs should disclose.
21087. **Linea message service validation** — the agent tests whether L1-to-L2 message APIs validate sender authentication before queuing messages.
21088. **Mantle/Metis fraud window enforcement** — the agent verifies optimistic-rollup frontends enforce the full fraud-proof window before marking withdrawals complete.
21089. **Blast native yield accounting checks** — the agent verifies yield-bearing L2 dashboards reconcile on-chain rebasing balances with displayed earnings.
21090. **EigenLayer restaking withdrawal queue checks** — the agent tests whether restaking withdrawal queues enforce escrow periods instead of allowing instant exits.
21091. **Babylon BTC staking slashing proof checks** — the agent verifies BTC staking backends validate slashing evidence on Bitcoin before penalizing stakers.
21092. **Thorchain outbound transaction verification** — the agent checks whether cross-chain swap UIs confirm outbound transactions on the destination chain before marking swaps complete.
21093. **Chainflip/Maya vault rotation monitoring** — the agent tracks vault key rotations to flag rotations to unknown keysets that could strand funds.
21094. **dYdX-style order book spoofing detection** — the agent analyzes order-book snapshots for spoofing patterns and flags markets with abnormal quote flicker.
21095. **Hyperliquid vault strategy transparency** — the agent verifies copy-trading vaults disclose strategy parameters fetched from on-chain state rather than marketing copy.
21096. **GMX keeper execution latency checks** — the agent measures keeper execution delays on keepers-triggered positions to flag unfair execution windows.
21097. **Pendle yield-token pricing integrity** — the agent checks whether yield-token pricing APIs use audited implied-yield models instead of manipulable spot inputs.
21098. **Ethena-style synthetic dollar reserve checks** — the agent verifies dashboards link reserve attestations to on-chain custodian addresses rather than PDFs alone.
21099. **MakerDAO/Sky governance spell review** — the agent parses governance spell diffs to flag parameter changes hidden inside routine executive votes.
21100. **Aave risk-parameter change alerts** — the agent monitors risk-parameter updates (LTV, liquidation thresholds) to warn users before positions become unsafe.
21101. **Compound proposal calldata decoding** — the agent decodes governance proposal calldata into human-readable actions so voters see what code actually executes.
21102. **Uniswap v4 hook permission validation** — the agent verifies hook contracts declare only the permissions they use, flagging hooks with excessive callback rights.
21103. **Curve pool amplification manipulation checks** — the agent tests whether pool-parameter APIs bound amplification changes to prevent admin-triggered depegs.
21104. **Balancer vault internal-balance accounting** — the agent verifies internal-balance deposit/withdrawal flows reconcile exactly to prevent accounting drift exploits.
21105. **Liquid restaking points inflation checks** — the agent verifies points programs reconcile on-chain deposits with issued points to prevent double-counted rewards.
21106. **Prediction market resolution oracle checks** — the agent tests whether market-resolution backends require the designated oracle's signature rather than admin discretion.
21107. **Prediction market early-resolution abuse** — the agent probes whether markets can be resolved before the event ends through privileged API calls.
21108. **SocialFi key price manipulation checks** — the agent tests whether friend-tech-style key pricing APIs validate bonding-curve math server-side against on-chain state.
21109. **Telegram trading bot session security** — the agent verifies trading-bot backends bind wallet sessions to the Telegram user ID so exported keys cannot be replayed.
21110. **Copy-trading leader front-run checks** — the agent checks whether copy-trading platforms delay leader trade publication to prevent followers from being front-run.
21111. **On-chain subscription recurring charge checks** — the agent tests whether subscription contracts enforce per-period caps so a compromised operator cannot drain subscribers.
21112. **Gasless meta-transaction relayer auth** — the agent verifies relayers authenticate meta-transaction senders and enforce nonces to block replayed gasless calls.
21113. **Session key expiry enforcement** — the agent tests whether dApps revoke session keys at expiry instead of letting them sign indefinitely.
21114. **Smart wallet recovery guardian checks** — the agent verifies recovery flows require the declared guardian threshold rather than a single privileged backend key.
21115. **Passkey (WebAuthn) wallet origin binding** — the agent checks whether passkey wallets bind credentials to the correct relying-party origin to prevent phishing-site signatures.
21116. **Cross-device wallet sync encryption checks** — the agent verifies wallet-sync backends use end-to-end encryption so the sync server cannot read seed material.
21117. **Hardware wallet blind-signing warnings** — the agent checks whether dApp backends provide clear signing data so hardware wallets are not asked to blind-sign opaque hashes.
21118. **Token approval hygiene scanner** — the agent scans a user's historical approvals via the dApp's API to flag unlimited approvals to unaudited spenders.
21119. **Revoke-cascade notification checks** — the agent tests whether dApps notify users when a previously approved contract gets upgraded or compromised.
21120. **Block explorer address label spoofing** — the agent checks whether explorers validate address labels so attackers cannot tag scam addresses as official.
21121. **Explorer token icon impersonation checks** — the agent verifies explorers distinguish official token icons from lookalike uploads that impersonate major assets.
21122. **Faucet rate-limit abuse checks** — the agent tests whether testnet faucets enforce per-address and per-IP limits to prevent token hoarding.
21123. **RPC WebSocket subscription leak checks** — the agent verifies websocket `eth_subscribe` endpoints do not leak other users' subscription filters or pending transaction streams.
21124. **Node snapshot download integrity** — the agent checks whether node-snapshot distribution endpoints publish checksums so operators do not bootstrap from tampered state.
21125. **Validator client slashing protection checks** — the agent verifies validator APIs expose slashing-protection databases that prevent double-signing after restarts.
21126. **MEV-boost relay bid manipulation checks** — the agent tests whether relays validate builder bids against actual block value to prevent bid spoofing.
21127. **Builder API authentication checks** — the agent verifies block-builder APIs authenticate searchers so competitors cannot steal order flow.
21128. **Order-flow auction transparency** — the agent checks whether order-flow auction platforms disclose winning bids and execution quality to the originating wallets.
21129. **Decentralized sequencer rotation checks** — the agent verifies sequencer-rotation logic cannot be gamed to keep a malicious sequencer in power indefinitely.
21130. **Tool permission scope drift detection** — the agent compares an AI agent's declared tool scopes against the tools it actually invokes to flag privilege creep.
21131. **Agent-to-agent message authentication** — the agent verifies multi-agent systems authenticate inter-agent messages instead of trusting any sender on the channel.
21132. **Tool output prompt-injection detection** — the agent feeds tool outputs containing embedded instructions to detect whether the agent obeys them over the user's task.
21133. **Agent memory isolation checks** — the agent tests whether one user's conversation memory is retrievable from another user's session in shared agent backends.
21134. **Function-calling schema validation** — the agent submits malformed function arguments to confirm the runtime validates against the declared JSON schema before execution.
21135. **Agent audit trail completeness** — the agent checks whether every tool call, decision, and data access is logged with timestamps for post-incident review.
21136. **MCP server tool description spoofing** — the agent tests whether MCP clients validate server-advertised tool descriptions so a rogue server cannot masquerade as a trusted tool.
21137. **MCP server permission escalation checks** — the agent verifies MCP servers cannot silently expand their granted capabilities mid-session without re-authorization.
21138. **MCP resource URI validation** — the agent probes MCP resource handlers with path-traversal URIs to confirm servers reject out-of-scope resource access.
21139. **Agent system-prompt extraction resistance** — the agent attempts to extract system prompts through conversational probing to measure prompt-confidentiality controls.
21140. **Agent tool-use consent enforcement** — the agent verifies sensitive tool calls (payments, deletions) require explicit user confirmation rather than executing silently.
21141. **Multi-turn context poisoning detection** — the agent injects false facts across conversation turns to test whether the agent validates new claims against trusted sources.
21142. **Agent plan-execution divergence checks** — the agent compares an agent's stated plan with its actual tool calls to flag deceptive or off-plan behavior.
21143. **Retrieval tool source authentication** — the agent verifies RAG pipelines authenticate document sources so poisoned documents cannot enter the knowledge base.
21144. **RAG citation integrity checks** — the agent tests whether generated citations actually support the claims made, flagging hallucinated references.
21145. **Agent file-write sandboxing** — the agent attempts writes outside the declared workspace to confirm the agent runtime enforces filesystem boundaries.
21146. **Agent network egress allowlisting** — the agent checks whether agent runtimes restrict outbound network calls to an allowlist instead of permitting arbitrary exfiltration.
21147. **Secret redaction in agent traces** — the agent inspects execution traces to confirm API keys and tokens are redacted before logs are stored or displayed.
21148. **Agent cost-limit enforcement** — the agent verifies per-task token and tool-call budgets are enforced so runaway agents cannot burn unlimited budget.
21149. **Agent session fixation checks** — the agent tests whether agent session tokens rotate after privilege changes to prevent session-fixation attacks.
21150. **Delegated authority revocation** — the agent verifies that revoking an agent's delegated credentials immediately stops in-flight tool calls.
21151. **Agent impersonation in shared workspaces** — the agent tests whether agents in shared workspaces can be tricked into acting on another user's behalf without consent.
21152. **Tool result integrity verification** — the agent checks whether agents validate tool-result signatures so a compromised tool cannot feed forged data.
21153. **Agent rollback on tool failure** — the agent verifies partial multi-step actions roll back cleanly when a later tool call fails instead of leaving inconsistent state.
21154. **Human-in-the-loop bypass detection** — the agent attempts to skip mandatory approval steps to confirm the runtime cannot be circumvented by prompt tricks.
21155. **Agent self-modification guardrails** — the agent tests whether coding agents are blocked from editing their own system prompts, permissions, or safety constraints.
21156. **Environment variable leakage in agents** — the agent checks whether agents expose runtime environment variables through error messages or debug outputs.
21157. **Agent browser tool origin isolation** — the agent verifies browser-using agents isolate origins so a malicious page cannot read another tab's session data.
21158. **Agent cookie jar separation** — the agent tests whether per-task cookie jars prevent credential bleed between unrelated agent tasks.
21159. **Agent download integrity checks** — the agent verifies files downloaded by agents are hash-checked against declared checksums before execution.
21160. **Code execution sandbox escape checks** — the agent probes agent code-execution sandboxes for escapes via syscalls, /proc, or network access.
21161. **Agent plugin signature validation** — the agent checks whether third-party agent plugins are signature-verified before loading to block tampered extensions.
21162. **Agent marketplace plugin review surface** — the agent scans plugin manifests for excessive permission requests that indicate malicious or sloppy plugins.
21163. **Agent-to-API credential scoping** — the agent verifies credentials issued to agents are scoped to the minimum API permissions the task requires.
21164. **Short-lived agent token enforcement** — the agent checks whether agent access tokens expire quickly and rotate, rather than living as long-lived secrets.
21165. **Agent activity anomaly detection** — the agent baselines normal tool-call patterns to flag anomalous behavior like sudden bulk deletions or exfiltration.
21166. **Prompt-injection via document metadata** — the agent embeds instructions in PDF metadata and document properties to test whether agents treat metadata as data.
21167. **Prompt-injection via image content** — the agent hides instructions in images processed by multimodal agents to test vision-input sanitization.
21168. **Prompt-injection via calendar invites** — the agent plants malicious instructions in calendar event descriptions to test whether scheduling agents follow them.
21169. **Prompt-injection via email threads** — the agent embeds instructions in email bodies to test whether email-reading agents distinguish content from commands.
21170. **Prompt-injection via code comments** — the agent hides instructions in code comments to test whether code-review agents treat comments as untrusted text.
21171. **Indexed-content agent directive test** — the agent plants instructions in indexed web content to test whether browsing agents follow third-party directives.
21172. **Agent instruction hierarchy enforcement** — the agent verifies system instructions override tool outputs and user inputs in conflict scenarios.
21173. **Tool parameter injection checks** — the agent crafts tool arguments containing control characters to test whether downstream tools sanitize agent-supplied input.
21174. **Agent SQL tool query scoping** — the agent verifies database tools restrict agents to read-only or scoped queries instead of full schema access.
21175. **Agent shell command allowlisting** — the agent tests whether shell tools enforce command allowlists rather than passing raw agent-generated commands.
21176. **Agent email send authorization** — the agent verifies email-sending tools require per-recipient authorization so agents cannot spam arbitrary addresses.
21177. **Agent calendar write validation** — the agent checks whether calendar tools validate event details to prevent agents from creating deceptive meetings.
21178. **Agent payment tool limits** — the agent verifies payment tools enforce per-transaction and daily caps that agents cannot override via prompt.
21179. **Agent data retention policies** — the agent checks whether agent platforms honor data-deletion requests across conversation stores, vector DBs, and logs.
21180. **Cross-tenant vector DB isolation** — the agent tests whether one tenant's embeddings are retrievable through another tenant's RAG queries.
21181. **Embedding inversion risk checks** — the agent tests whether stored embeddings can be inverted to recover sensitive source text.
21182. **Agent feedback loop poisoning** — the agent submits malicious thumbs-down/up feedback to test whether RLHF pipelines validate feedback authenticity.
21183. **Agent evaluation harness integrity** — the agent verifies eval harnesses cannot be gamed by agents detecting test conditions and behaving differently.
21184. **Agent version rollback integrity** — the agent checks whether model or prompt rollbacks are authenticated so attackers cannot pin a vulnerable version.
21185. **Agent config tampering detection** — the agent monitors agent configuration files for unauthorized changes to temperature, tools, or system prompts.
21186. **Agent API key rotation automation** — the agent verifies platforms rotate agent API keys automatically on a schedule rather than relying on manual rotation.
21187. **Agent error message information leaks** — the agent triggers tool errors to check whether stack traces leak system prompts, file paths, or credentials.
21188. **Agent rate-limit per-identity enforcement** — the agent verifies rate limits apply per authenticated identity rather than per IP, which shared proxies defeat.
21189. **Agent concurrency abuse checks** — the agent tests whether parallel agent sessions share resource quotas or allow multiplying past intended limits.
21190. **Agent long-running task watchdog** — the agent verifies watchdog timers terminate runaway tasks instead of letting them consume resources indefinitely.
21191. **Agent checkpoint integrity** — the agent checks whether saved agent checkpoints are signed so resumed sessions cannot be tampered with.
21192. **Agent delegation chain validation** — the agent verifies sub-agent delegations carry the full permission chain so a sub-agent cannot exceed its parent's authority.
21193. **Agent tool-call replay protection** — the agent tests whether executed tool calls carry nonces so logged actions cannot be replayed.
21194. **Agent consent receipt logging** — the agent verifies user consents for sensitive actions are recorded immutably for later dispute resolution.
21195. **Agent data minimization checks** — the agent inspects tool-call payloads to confirm agents request only the fields the task needs, not entire records.
21196. **Agent PII redaction in prompts** — the agent checks whether platforms redact PII from prompts before sending them to third-party model providers.
21197. **Agent model provider data sharing disclosure** — the agent verifies platforms disclose which model providers receive user data and under what terms.
21198. **Agent output watermarking checks** — the agent tests whether AI-generated outputs carry detectable watermarks for provenance tracking.
21199. **Agent refusal consistency checks** — the agent probes refusal behavior across paraphrased requests to detect inconsistent safety boundaries.
21200. **Agent jailbreak regression testing** — the agent replays known jailbreak patterns after each platform update to catch regressed safety controls.
21201. **Agent tool documentation integrity** — the agent verifies tool descriptions shown to the agent match the actual tool behavior to prevent description-behavior mismatch.
21202. **Agent multi-modal input sanitization** — the agent tests whether audio, image, and text inputs receive consistent sanitization before reaching the model.
21203. **Agent websocket message validation** — the agent sends malformed websocket frames to agent streaming APIs to test message parsing robustness.
21204. **Agent streaming output integrity** — the agent verifies streamed token outputs cannot be tampered with mid-stream by intermediaries.
21205. **Agent skill squatting detection** — the agent scans agent skill registries for typosquatted skill names that trick agents into loading malicious capabilities.
21206. **Agent capability advertisement integrity** — the agent verifies an agent's advertised capabilities match its real toolset to prevent capability spoofing in multi-agent routing.
21207. **A2A (Agent-to-Agent) protocol auth checks** — the agent tests whether A2A task exchanges authenticate both parties instead of accepting unsigned task delegations.
21208. **A2A task payload validation** — the agent submits malformed A2A task envelopes to confirm receivers validate schemas before executing delegated work.
21209. **Agent card spoofing detection** — the agent verifies agent discovery cards are signed by their claimed operators so rogue agents cannot impersonate trusted ones.
21210. **Agent reputation manipulation checks** — the agent tests whether agent marketplaces prevent fake reviews from inflating a malicious agent's trust score.
21211. **Agent escrow payment integrity** — the agent verifies agent-service escrow releases funds only on verified task completion rather than on self-reported success.
21212. **Agent task result attestation** — the agent checks whether completed agent tasks carry cryptographic attestations so results cannot be forged after the fact.
21213. **Agent identity key rotation** — the agent verifies agents rotate their identity keys periodically and that old keys are promptly revoked.
21214. **Agent discovery poisoning checks** — the agent tests whether agent directories validate listings so attackers cannot inject malicious agents into search results.
21215. **Agent sandbox resource quotas** — the agent verifies CPU, memory, and disk quotas are enforced per agent task to prevent resource-exhaustion attacks.
21216. **Agent GPU allocation fairness** — the agent checks whether shared GPU schedulers isolate agent workloads so one tenant cannot starve others.
21217. **Agent model cache poisoning** — the agent tests whether shared model caches validate cached weights so a poisoned cache cannot backdoor all agents.
21218. **Agent prompt template injection** — the agent injects template syntax into user inputs to test whether prompt templating engines escape user content.
21219. **Agent chain-of-thought leakage** — the agent checks whether internal reasoning traces are exposed to end users or other agents when they should stay private.
21220. **Agent tool latency side channels** — the agent measures tool-call timing to detect whether response times leak information about hidden data or decisions.
21221. **Agent cache timing oracles** — the agent tests whether cached versus uncached tool responses reveal which queries were previously asked.
21222. **Agent retry storm protection** — the agent verifies exponential backoff and circuit breakers prevent a failing tool from triggering retry storms.
21223. **Agent dead-letter queue exposure** — the agent checks whether failed-task queues leak sensitive payloads to unauthorized viewers.
21224. **Agent workflow version pinning** — the agent verifies production agent workflows pin exact tool and prompt versions instead of floating to untested updates.
21225. **Agent canary deployment checks** — the agent tests whether new agent versions roll out to a canary cohort with automated rollback on anomaly detection.
21226. **Agent feature flag authorization** — the agent verifies feature flags controlling agent capabilities require privileged access to toggle.
21227. **Agent observability gap detection** — the agent compares declared tool integrations against observed telemetry to find unmonitored agent actions.
21228. **Agent trace sampling integrity** — the agent checks whether trace sampling is random rather than adversary-influenced, which could hide malicious actions.
21229. **Agent log injection checks** — the agent submits log content containing forged entries to test whether log pipelines sanitize agent-generated text.
21230. **Agent metric cardinality abuse** — the agent tests whether agents can inject unbounded label values that blow up metrics storage costs.
21231. **Agent alert fatigue exploitation** — the agent verifies alerting thresholds cannot be manipulated by agents to suppress genuine security alerts.
21232. **Agent incident response hooks** — the agent checks whether platforms provide kill-switch APIs to immediately halt a compromised agent fleet.
21233. **Agent forensic snapshot integrity** — the agent verifies forensic snapshots of agent state are tamper-evident for post-incident investigation.
21234. **Agent compliance mapping checks** — the agent maps agent data flows against declared compliance boundaries (GDPR, HIPAA) to flag cross-boundary transfers.
21235. **Agent data residency enforcement** — the agent verifies agents process data only in declared regions instead of routing through unapproved jurisdictions.
21236. **Agent subprocess isolation** — the agent tests whether agent-spawned subprocesses inherit restricted permissions rather than the parent's full rights.
21237. **Agent container escape checks** — the agent probes containerized agent runtimes for escapes via privileged mounts or host namespaces.
21238. **Agent seccomp profile enforcement** — the agent verifies syscall filters actually block dangerous calls rather than existing as unenforced configuration.
21239. **Agent supply chain attestation** — the agent checks whether agent runtime images carry SLSA-style provenance attestations.
21240. **Agent dependency confusion checks** — the agent tests whether agent build pipelines can be tricked into pulling malicious public packages over private ones.
21241. **Agent SBOM completeness** — the agent verifies software bills of materials list all runtime dependencies so vulnerable libraries are not hidden.
21242. **Agent vulnerability disclosure workflow** — the agent checks whether platforms publish a security contact and coordinated disclosure process for agent flaws.
21243. **Agent bug bounty scope clarity** — the agent verifies bug bounty programs explicitly define which agent behaviors are in scope to avoid researcher disputes.
21244. **Agent red-team automation hooks** — the agent provides programmable hooks to replay adversarial scenarios against agent deployments on every release.
21245. **Agent safety eval drift detection** — the agent monitors safety benchmark scores across releases to flag silent capability-safety regressions.
21246. **Agent user data export integrity** — the agent verifies data-export features return complete records rather than silently omitting tool-call history.
21247. **Agent account deletion verification** — the agent confirms account deletion actually purges vector stores, checkpoints, and backups rather than soft-deleting.
21248. **Agent session replay protection** — the agent tests whether recorded sessions cannot be replayed to reproduce privileged actions.
21249. **Agent time-of-check-time-of-use checks** — the agent probes permission checks that pass at planning time but are not re-validated at execution time.
21250. **Agent least-privilege violation scanner** — the agent statically analyzes agent configurations to flag tools granted broader scopes than their documented purpose.
21251. **Agent cross-session data bleed** — the agent plants canary values in one session and searches for them in another to detect context bleed.
21252. **Agent clipboard access scoping** — the agent verifies clipboard-reading tools require explicit per-read consent instead of silent background access.
21253. **Agent notification spoofing checks** — the agent tests whether agents can send notifications that impersonate system alerts to manipulate users.
21254. **Agent voice interface auth** — the agent verifies voice-controlled agents authenticate the speaker before executing privileged commands.
21255. **Cloudflare Workers route coverage mapping** — the agent discovers all worker routes bound to a domain and flags routes with no authentication that should be protected.
21256. **Workers KV namespace exposure** — the agent probes Workers KV read endpoints to verify keys containing secrets are not publicly readable.
21257. **Lambda@Edge origin validation** — the agent tests whether Lambda@Edge functions validate the true origin instead of trusting the Host header forwarded by the CDN.
21258. **Durable Objects state isolation** — the agent verifies one tenant's Durable Object instance cannot read or mutate another tenant's persisted state.
21259. **Edge-side include (ESI) injection checks** — the agent tests whether ESI processors sanitize user input before assembling cached fragments to block server-side includes.
21260. **Geolocation bypass at edge** — the agent verifies edge geolocation checks use the connecting IP rather than client-supplied headers like X-Forwarded-For.
21261. **Edge function cold-start secret exposure** — the agent checks whether edge function error pages leak environment variables during cold-start failures.
21262. **Workers cron trigger auth** — the agent verifies scheduled worker endpoints reject external HTTP calls that attempt to trigger cron-only logic.
21263. **Edge cache key manipulation** — the agent tests whether attackers can craft cache keys that poison shared edge caches with malicious responses.
21264. **Cache deception at edge** — the agent checks whether authenticated responses are cached under keys accessible to unauthenticated users.
21265. **Edge WAF bypass via encoding** — the agent tests whether edge WAF rules can be bypassed with encoding variations the origin would still decode.
21266. **Origin IP disclosure via edge** — the agent checks whether edge responses leak the true origin IP through headers, error pages, or TLS certificates.
21267. **Edge redirect chain validation** — the agent verifies edge redirect rules cannot be abused for open redirects through crafted path parameters.
21268. **Workers AI binding abuse** — the agent tests whether Workers AI bindings enforce per-request quotas so one user cannot exhaust shared inference capacity.
21269. **Edge R2 bucket policy checks** — the agent verifies R2 bucket policies deny public listing while allowing only intended object access.
21270. **R2 presigned URL scope validation** — the agent tests whether presigned URLs are bound to exact objects and short expiries rather than wildcard prefixes.
21271. **Edge D1 database exposure** — the agent probes edge-exposed D1 endpoints for missing authentication on direct database queries.
21272. **Queues consumer auth checks** — the agent verifies edge queue consumers authenticate producers so anyone cannot inject jobs into processing pipelines.
21273. **Workers trace event leakage** — the agent checks whether workers trace events expose request bodies containing credentials to unauthorized viewers.
21274. **Edge analytics data exposure** — the agent verifies analytics APIs aggregate data so individual user requests cannot be reconstructed.
21275. **Hyperdrive connection string leaks** — the agent checks whether database connection accelerators expose credentials in error messages or debug endpoints.
21276. **Edge request smuggling checks** — the agent tests for desync between edge and origin HTTP parsers that enables request smuggling through the CDN layer.
21277. **HTTP/3 edge downgrade checks** — the agent verifies edge configurations do not allow protocol downgrades that strip security headers.
21278. **Edge TLS configuration auditing** — the agent checks whether edge TLS terminates with weak ciphers or outdated versions that undermine origin security.
21279. **mTLS at edge enforcement** — the agent verifies mutual TLS is actually required on protected routes rather than merely configured.
21280. **Edge bot management bypass** — the agent tests whether bot-detection at the edge can be bypassed with header spoofing that the origin trusts.
21281. **Workers subrequest SSRF** — the agent tests whether worker subrequests validate destination URLs to block server-side request forgery from edge code.
21282. **Edge fetch metadata validation** — the agent verifies edge functions check Sec-Fetch-* headers to block cross-site request forgery of state-changing routes.
21283. **Cloudflare Tunnel origin exposure** — the agent checks whether tunnel-protected origins are still directly reachable via their real IPs.
21284. **Access policy bypass at edge** — the agent tests whether zero-trust access policies can be bypassed through alternate hostnames or paths.
21285. **Edge page rules auth gaps** — the agent maps page-rule coverage to find paths accidentally excluded from authentication rules.
21286. **Workers for Platforms dispatch isolation** — the agent verifies customer workers on multi-tenant dispatch namespaces cannot access each other's bindings.
21287. **Edge image transformation abuse** — the agent tests whether image-resizing endpoints enforce size and source allowlists to prevent origin-fetch SSRF.
21288. **Polish/Mirage content alteration checks** — the agent verifies edge image optimization does not strip security-relevant metadata or inject tracking.
21289. **Edge email routing exposure** — the agent checks whether email-routing workers leak message contents through logging or debug endpoints.
21290. **Workers Sites asset manifest leaks** — the agent checks whether static-site manifests expose internal paths or draft content not meant for publication.
21291. **Edge stream signing key exposure** — the agent verifies video stream signing keys are not exposed through edge debug endpoints.
21292. **Edge rate-limit bypass via IP rotation** — the agent tests whether edge rate limits key on stable identifiers rather than easily rotated IPs.
21293. **Distributed rate limit consistency** — the agent verifies rate limits are enforced globally across edge PoPs instead of per-PoP, which multiplies allowances.
21294. **Edge challenge bypass persistence** — the agent tests whether solved CAPTCHA or challenge cookies can be replayed indefinitely without revalidation.
21295. **Workers WebSocket origin checks** — the agent verifies edge websocket handlers validate the Origin header to block cross-site websocket hijacking.
21296. **Durable Object websocket hibernation leaks** — the agent checks whether hibernating websocket objects leak messages queued for other connections on wake.
21297. **Edge realtime pub/sub auth** — the agent tests whether edge pub/sub channels enforce per-topic authorization instead of global subscribe rights.
21298. **Cloudflare Pages preview exposure** — the agent scans for public preview deployments that expose unreleased features or staging credentials.
21299. **Pages Functions env var leaks** — the agent checks whether Pages Functions error responses include environment values.
21300. **Edge middleware ordering flaws** — the agent verifies authentication middleware runs before any handler that serves sensitive data, regardless of route registration order.
21301. **Vercel Edge Middleware auth gaps** — the agent maps middleware matchers to find routes accidentally excluded from authentication checks.
21302. **Edge config store exposure** — the agent probes edge config endpoints to verify feature flags and secrets are not publicly readable.
21303. **Edge experimentation cookie integrity** — the agent verifies A/B test assignment cookies are signed so users cannot self-assign to privileged variants.
21304. **Edge personalization data leaks** — the agent checks whether edge-personalized responses embed one user's profile data in cacheable shared responses.
21305. **Fastly VCL snippet injection checks** — the agent tests whether custom VCL snippets sanitize user input before using it in backend selection logic.
21306. **Fastly edge dictionary exposure** — the agent verifies edge dictionaries holding secrets or routing rules are not readable through public endpoints.
21307. **Akamai edge auth token validation** — the agent tests whether Akamai token-auth URLs validate signatures server-side rather than trusting client claims.
21308. **Edge token TTL enforcement** — the agent verifies time-limited edge tokens actually expire instead of remaining valid indefinitely.
21309. **CloudFront signed URL key rotation** — the agent checks whether CloudFront signing keys rotate and old keys are revoked promptly.
21310. **CloudFront origin access identity gaps** — the agent verifies S3 origins reject direct access and only accept requests through the configured OAI/OAC.
21311. **CloudFront function event-type scoping** — the agent checks whether edge functions trigger only on intended event types instead of running on every request phase.
21312. **Lambda@Edge IAM role over-provisioning** — the agent reviews edge function IAM roles to flag permissions far beyond what the function needs.
21313. **Edge function deployment rollback integrity** — the agent verifies edge deployments are versioned and signed so rollbacks cannot be tampered with.
21314. **Edge log pipeline PII redaction** — the agent checks whether edge logging pipelines redact credentials and PII before shipping logs to analytics.
21315. **Real-user monitoring beacon spoofing** — the agent tests whether RUM endpoints validate beacon payloads to prevent forged performance data.
21316. **Edge synthetic monitoring auth** — the agent verifies synthetic monitoring probes authenticate so attackers cannot trigger fake uptime signals.
21317. **Anycast IP hijack detection** — the agent monitors BGP announcements for edge anycast prefixes to detect route hijacks redirecting traffic.
21318. **Edge DNS poisoning resistance** — the agent verifies edge DNS resolvers validate DNSSEC so poisoned records cannot redirect edge traffic.
21319. **DNS over HTTPS edge policy** — the agent checks whether DoH endpoints enforce the same filtering policies as plaintext DNS.
21320. **Edge captive portal auth bypass** — the agent tests whether captive-portal edge logic can be bypassed to gain unauthenticated network access.
21321. **Service worker scope validation** — the agent verifies service workers register only within their intended scope instead of intercepting the whole origin.
21322. **Service worker cache poisoning** — the agent tests whether service worker caches validate responses before storing to prevent persistent client-side poisoning.
21323. **Edge-rendered PWA manifest integrity** — the agent checks whether web app manifests served at the edge match the canonical origin version.
21324. **Signed exchange (SXG) validation** — the agent verifies SXG signatures so attackers cannot serve tampered pre-rendered content as the origin.
21325. **Edge prefetch privacy leaks** — the agent checks whether speculative prefetch at the edge leaks user navigation intent to third parties.
21326. **103 Early Hints injection checks** — the agent tests whether early-hint responses can be injected to preload attacker resources before the main document.
21327. **Edge compression oracle checks** — the agent tests whether edge compression of mixed secret and attacker content enables BREACH-style extraction.
21328. **Brotli/Zstd edge negotiation flaws** — the agent verifies edge content-negotiation cannot be abused to serve decompression bombs to origins.
21329. **Edge range-request abuse** — the agent tests whether range requests can be multiplied to amplify origin load through the edge.
21330. **Edge request coalescing flaws** — the agent verifies collapsed forwarding does not serve one user's authenticated response to another's request.
21331. **Stale-while-revalidate data leaks** — the agent checks whether stale revalidation serves outdated responses containing revoked permissions.
21332. **Edge surrogate key purge auth** — the agent verifies cache-purge APIs require authentication so attackers cannot purge or poison caches at will.
21333. **Soft purge visibility checks** — the agent tests whether soft-purged content remains accessible through alternate edge paths.
21334. **Edge shielding origin protection** — the agent verifies shield PoPs authenticate to origins so attackers cannot bypass shielding to hit origins directly.
21335. **Tiered cache key normalization** — the agent checks whether cache keys normalize encoding so functionally identical requests share cache entries safely.
21336. **Edge GraphQL query allowlisting** — the agent verifies edge GraphQL gateways enforce persisted-query allowlists instead of accepting arbitrary queries.
21337. **Edge REST-to-GraphQL translation flaws** — the agent tests whether translation layers preserve authentication context when converting REST calls to GraphQL.
21338. **Edge API gateway schema validation** — the agent verifies edge gateways validate request bodies against schemas before forwarding to origins.
21339. **Edge JWT validation at PoP** — the agent tests whether JWTs validated at the edge check signatures, expiry, and audience rather than just presence.
21340. **Edge OAuth token introspection** — the agent verifies edge layers introspect opaque tokens instead of trusting self-asserted scopes.
21341. **Edge session cookie integrity** — the agent checks whether session cookies validated at the edge are signed and bound to the client IP or device.
21342. **Edge device fingerprint spoofing** — the agent tests whether device-based edge policies can be bypassed with spoofed fingerprints.
21343. **Edge ASN-based policy bypass** — the agent verifies ASN allowlists cannot be defeated through VPNs or cloud IP ranges the policy forgot to exclude.
21344. **Edge header injection via origin** — the agent tests whether origins can inject headers that the edge then trusts for security decisions.
21345. **Edge error page information leaks** — the agent checks whether custom edge error pages leak stack traces, internal hostnames, or backend versions.
21346. **Edge health check exposure** — the agent verifies origin health-check endpoints are not publicly reachable through the edge.
21347. **Edge status page data leaks** — the agent checks whether status endpoints expose internal metrics like queue depths or error rates to the public.
21348. **Edge feature preview auth** — the agent tests whether preview deployments of edge features require authentication before public release.
21349. **Edge A/B test data exposure** — the agent verifies experimentation platforms do not leak other users' variant assignments or PII.
21350. **Edge consent management bypass** — the agent tests whether consent banners enforced at the edge can be bypassed to load tracking before consent.
21351. **Edge CSP injection integrity** — the agent verifies Content-Security-Policy headers injected at the edge cannot be overridden by weaker origin policies.
21352. **Edge HSTS enforcement** — the agent checks whether HSTS headers are applied consistently at the edge for all subdomains.
21353. **Edge certificate transparency monitoring** — the agent watches CT logs for unauthorized certificates issued for edge-served domains.
21354. **Edge OCSP stapling validation** — the agent verifies edge TLS staples valid OCSP responses so revoked certificates are actually rejected.
21355. **Edge SNI routing flaws** — the agent tests whether SNI-based routing can be confused to serve one customer's content on another's domain.
21356. **Custom hostname cert validation** — the agent verifies SaaS custom-hostname flows validate domain ownership before issuing certificates.
21357. **Edge subdomain takeover via CNAME** — the agent checks whether dangling CNAMEs pointing at edge platforms allow subdomain takeover.
21358. **Edge wildcard cert scope** — the agent verifies wildcard certificates at the edge do not accidentally cover unintended subdomains.
21359. **Edge HTTP/2 rapid reset protection** — the agent tests whether edge layers mitigate rapid-reset style DoS instead of passing the load to origins.
21360. **Edge Slowloris mitigation** — the agent verifies edge timeouts terminate slowloris connections before they consume origin resources.
21361. **Edge UDP flood handling** — the agent checks whether edge DDoS protection covers UDP-based services and not just TCP/HTTP.
21362. **Edge L3/L4 bypass via direct IP** — the agent tests whether attackers can reach origins directly by IP to bypass edge DDoS scrubbing.
21363. **Edge scrubbing center failover** — the agent verifies traffic fails over to scrubbing centers without exposing unprotected paths during transitions.
21364. **Edge anycast health check spoofing** — the agent tests whether edge health checks can be spoofed to drain traffic from healthy PoPs.
21365. **Edge load balancer persistence flaws** — the agent checks whether session persistence at the edge can be manipulated to pin victims to malicious backends.
21366. **Edge active health check auth** — the agent verifies active health checks authenticate to origins so attackers cannot forge healthy signals.
21367. **Edge passive health check poisoning** — the agent tests whether passive health checks can be poisoned with crafted error responses to remove healthy origins.
21368. **Edge failover data consistency** — the agent verifies failover between edge origins does not serve stale writes as fresh reads.
21369. **Edge multi-CDN consistency checks** — the agent compares responses across CDN providers to detect inconsistent security headers or content.
21370. **Edge origin failover auth** — the agent verifies backup origins enforce the same authentication as primaries instead of serving open fallbacks.
21371. **Edge DNS failover hijack checks** — the agent tests whether DNS failover records can be manipulated to redirect traffic during outages.
21372. **Edge synthetic transaction integrity** — the agent verifies synthetic transaction probes use dedicated test accounts instead of real user sessions.
21373. **Edge chaos testing guardrails** — the agent checks whether fault-injection at the edge requires multi-party approval before affecting production.
21374. **Edge config drift detection** — the agent compares running edge configurations against declared infrastructure-as-code to flag manual tampering.
21375. **Edge secret rotation automation** — the agent verifies edge secrets rotate automatically and old versions are revoked across all PoPs.
21376. **Edge break-glass access auditing** — the agent checks whether emergency edge access is time-boxed, logged, and reviewed afterward.
21377. **Edge change advisory validation** — the agent verifies edge configuration changes pass automated security checks before deployment.
21378. **Edge rollback window enforcement** — the agent tests whether faulty edge deployments roll back automatically within the declared window.
21379. **Edge deployment freeze compliance** — the agent verifies deployment freezes are technically enforced rather than relying on process alone.
21380. **SQS event injection validation** — the agent tests whether Lambda handlers validate SQS message structure and origin instead of trusting any queued payload.
21381. **SNS topic subscription hijacking** — the agent verifies SNS topics require subscription confirmation so attackers cannot silently subscribe exfiltration endpoints.
21382. **EventBridge event bus auth** — the agent tests whether custom event buses authenticate event sources to block forged business events.
21383. **Cold-start timing oracle detection** — the agent measures cold-start latency differences to detect whether timing reveals provisioned versus on-demand execution paths.
21384. **Lambda function URL auth gaps** — the agent probes function URLs for missing IAM or custom authorizers on endpoints that should be private.
21385. **Lambda layer dependency confusion** — the agent tests whether layer ARNs can be swapped for attacker-controlled layers through version manipulation.
21386. **Async invocation result leaks** — the agent checks whether asynchronous invocation destinations expose results to unauthorized consumers.
21387. **Step Functions state exposure** — the agent verifies Step Functions execution histories redact sensitive input/output instead of storing plaintext.
21388. **Scheduled event manipulation** — the agent tests whether EventBridge schedules can be altered by low-privilege roles to trigger privileged workflows.
21389. **Lambda environment variable exposure** — the agent probes function error responses and logs for leaked environment variables.
21390. **Lambda ephemeral storage data leaks** — the agent verifies /tmp contents are scrubbed between invocations so one request cannot read another's temp files.
21391. **Lambda execution role over-provisioning** — the agent reviews function IAM roles to flag wildcard permissions beyond the function's needs.
21392. **Lambda VPC configuration gaps** — the agent checks whether functions accessing private resources actually run inside the VPC instead of leaking traffic publicly.
21393. **Lambda reserved concurrency abuse** — the agent tests whether reserved concurrency settings can be manipulated to starve critical functions.
21394. **Lambda destination misconfiguration** — the agent verifies success and failure destinations are set so failed invocations do not silently drop.
21395. **Lambda DLQ redrive auth** — the agent tests whether dead-letter queue redrives require authorization to prevent replaying poisoned events.
21396. **Event source mapping poison pill** — the agent checks whether poison-pill messages are isolated instead of blocking entire event source mappings.
21397. **Kinesis event ordering assumptions** — the agent tests whether stream processors handle out-of-order records safely instead of assuming strict ordering.
21398. **DynamoDB stream injection** — the agent verifies stream-triggered functions validate record provenance instead of trusting any stream entry.
21399. **S3 event notification spoofing** — the agent tests whether S3-triggered functions validate event authenticity to block forged object-created events.
21400. **API Gateway authorizer bypass** — the agent probes for routes missing authorizers or accepting unsigned tokens through misconfigured integrations.
21401. **API Gateway usage plan enforcement** — the agent verifies usage plans and API keys actually throttle instead of existing as unenforced configuration.
21402. **API Gateway stage variable leaks** — the agent checks whether stage variables expose backend hostnames or credentials in responses.
21403. **API Gateway mapping template injection** — the agent tests whether VTL mapping templates sanitize input to block template injection into backend calls.
21404. **API Gateway CORS misconfiguration** — the agent verifies CORS settings do not reflect arbitrary origins with credentials on sensitive APIs.
21405. **Lambda@Edge vs regional behavior parity** — the agent compares edge and regional function behavior to flag security checks present in one but missing in the other.
21406. **Serverless provisioned concurrency cost abuse** — the agent tests whether attackers can force expensive provisioned-concurrency scale-out through crafted traffic.
21407. **Lambda SnapStart snapshot poisoning** — the agent verifies SnapStart snapshots are rebuilt from trusted code so poisoned snapshots cannot persist across deployments.
21408. **Lambda container image tampering** — the agent checks whether container-image functions verify image digests instead of trusting mutable tags.
21409. **Lambda code signing enforcement** — the agent verifies code-signing policies actually block unsigned deployments rather than warning only.
21410. **Lambda function version immutability** — the agent tests whether published versions are truly immutable or can be quietly replaced.
21411. **Lambda alias routing manipulation** — the agent verifies alias traffic-shifting requires privileged roles so attackers cannot redirect production traffic.
21412. **Serverless framework state file leaks** — the agent checks whether deployment state files expose secrets through CI artifacts or public buckets.
21413. **SAM template secret exposure** — the agent scans SAM/CloudFormation templates for hardcoded secrets that ship with deployments.
21414. **Terraform state secret leaks** — the agent verifies Terraform state backends encrypt state so serverless secrets are not readable in plaintext.
21415. **Serverless CI/CD pipeline injection** — the agent tests whether deployment pipelines validate commit signatures before promoting serverless code.
21416. **Lambda extension abuse surface** — the agent reviews Lambda extensions for excessive permissions that could intercept function traffic.
21417. **Lambda telemetry API exposure** — the agent verifies telemetry extensions do not leak request payloads to unauthorized subscribers.
21418. **CloudWatch Logs subscription exfiltration** — the agent checks whether log subscription filters can be added by low-privilege roles to siphon sensitive logs.
21419. **X-Ray trace data exposure** — the agent verifies distributed traces redact sensitive segments instead of exposing full request payloads.
21420. **Lambda Powertools secret masking** — the agent tests whether structured logging actually masks secrets instead of logging them through formatting gaps.
21421. **Serverless secret rotation hooks** — the agent verifies rotation Lambdas complete atomically so half-rotated secrets do not lock out services.
21422. **Secrets Manager caching staleness** — the agent tests whether in-function secret caches respect TTLs instead of serving revoked credentials indefinitely.
21423. **Parameter Store hierarchy traversal** — the agent tests whether functions can read parameters outside their path prefix through wildcard IAM policies.
21424. **AppConfig deployment validation** — the agent verifies configuration deployments validate schemas so malformed configs cannot crash fleets of functions.
21425. **Feature flag kill-switch integrity** — the agent tests whether kill switches cannot be bypassed by cached flag evaluations.
21426. **Serverless WebSocket connection auth** — the agent verifies API Gateway websocket routes authenticate the initial handshake, not just subsequent messages.
21427. **WebSocket connectionId spoofing** — the agent tests whether management APIs validate connection ownership before allowing message injection.
21428. **WebSocket idle timeout abuse** — the agent checks whether idle connections are reclaimed so attackers cannot hold thousands of stale connections.
21429. **IoT Core rule SQL injection** — the agent tests whether IoT SQL rules sanitize topic payloads before routing to downstream actions.
21430. **IoT Core thing shadow ACLs** — the agent verifies device shadow updates require per-thing policies instead of wildcard permissions.
21431. **EventBridge API destination auth** — the agent checks whether API destinations store credentials securely and rotate them instead of embedding long-lived tokens.
21432. **EventBridge archive replay auth** — the agent verifies event archive replays require authorization so attackers cannot replay privileged events.
21433. **EventBridge schema registry poisoning** — the agent tests whether schema versions are validated so poisoned schemas cannot break consumers.
21434. **Pipes enrichment step injection** — the agent verifies EventBridge Pipes enrichment steps sanitize input before calling external APIs.
21435. **Scheduler one-time schedule abuse** — the agent tests whether one-time schedules can be created by low-privilege roles to trigger privileged targets.
21436. **Scheduler universal target validation** — the agent verifies scheduler targets validate ARNs so schedules cannot invoke arbitrary resources.
21437. **Step Functions callback task token leaks** — the agent checks whether task tokens are exposed in logs or to unauthorized parties who could complete tasks fraudulently.
21438. **Step Functions map state fan-out abuse** — the agent tests whether Map states bound concurrency so crafted inputs cannot trigger runaway parallel executions.
21439. **Step Functions express workflow logging** — the agent verifies express workflows do not log full payloads containing PII by default.
21440. **Step Functions versioning integrity** — the agent checks whether state machine versions are immutable so rolled-back logic cannot be silently altered.
21441. **Lambda recursive loop protection** — the agent verifies recursion detection terminates functions that trigger themselves instead of burning budget infinitely.
21442. **S3 Object Lambda auth gaps** — the agent tests whether Object Lambda access points enforce the same policies as the underlying buckets.
21443. **S3 Object Lambda transformation integrity** — the agent verifies transformation functions cannot exfiltrate object contents to external endpoints.
21444. **Glue ETL job credential exposure** — the agent checks whether serverless ETL jobs leak database credentials through logs or error messages.
21445. **Athena query result exposure** — the agent verifies Athena query results are stored in access-controlled buckets instead of publicly readable locations.
21446. **Serverless Aurora Data API auth** — the agent tests whether Data API endpoints require IAM auth rather than accepting unauthenticated SQL.
21447. **RDS Proxy credential rotation** — the agent verifies proxy credentials rotate without dropping in-flight serverless connections insecurely.
21448. **Neptune serverless query auth** — the agent checks whether graph database endpoints authenticate queries instead of exposing the full graph.
21449. **Timestream ingestion validation** — the agent tests whether time-series ingestion validates dimensions so attackers cannot inject misleading metrics.
21450. **Managed Kafka (MSK) serverless ACLs** — the agent verifies Kafka topics enforce ACLs so any function cannot produce to or consume from sensitive topics.
21451. **MSK IAM auth enforcement** — the agent tests whether SASL/IAM auth is actually required rather than advertised but unenforced.
21452. **Kinesis Data Firehose destination validation** — the agent verifies Firehose delivery streams cannot be redirected to attacker-controlled destinations.
21453. **Serverless Redshift query isolation** — the agent checks whether serverless data warehouse queries isolate tenants instead of sharing query history.
21454. **OpenSearch Serverless collection policies** — the agent verifies data access policies restrict collections to intended principals.
21455. **OpenSearch dashboard exposure** — the agent tests whether dashboards are behind authentication instead of publicly explorable.
21456. **MemoryDB serverless auth** — the agent checks whether in-memory database endpoints require auth tokens rather than accepting open connections.
21457. **ElastiCache Serverless encryption** — the agent verifies encryption in transit is enforced so cache contents cannot be sniffed.
21458. **App Runner service auth** — the agent tests whether App Runner services require IAM or custom auth instead of defaulting to public.
21459. **App Runner auto-scaling abuse** — the agent verifies scaling policies bound maximum instances so traffic spikes cannot cause runaway bills.
21460. **Fargate serverless task role scoping** — the agent reviews Fargate task roles to flag permissions exceeding the container's needs.
21461. **Fargate exec session auth** — the agent verifies ECS Exec sessions require authorization so anyone cannot shell into running tasks.
21462. **Copilot/Serverless image scan gaps** — the agent checks whether deployed container images are scanned for vulnerabilities before serving traffic.
21463. **Azure Functions key exposure** — the agent probes function host keys and master keys for exposure through deployment slots or Kudu.
21464. **Azure Functions Easy Auth bypass** — the agent tests whether App Service authentication can be bypassed through alternate hostnames or headers.
21465. **Azure Durable Functions orchestration leaks** — the agent verifies orchestration histories redact sensitive activity inputs.
21466. **Azure Event Grid subscription validation** — the agent tests whether event subscriptions validate webhook endpoints to prevent subscription hijacking.
21467. **Azure Service Bus auth scoping** — the agent verifies shared access policies are scoped per entity instead of namespace-wide.
21468. **GCP Cloud Functions ingress settings** — the agent checks whether functions restrict ingress to internal or authenticated sources instead of allowing all.
21469. **GCP Cloud Run IAM binding audits** — the agent reviews IAM bindings to flag allUsers invoker grants on services that should be private.
21470. **GCP Workflows callback auth** — the agent verifies workflow callbacks authenticate callers so external parties cannot advance workflows.
21471. **GCP Pub/Sub push endpoint validation** — the agent tests whether push subscriptions validate OIDC tokens instead of accepting unauthenticated pushes.
21472. **GCP Scheduler OIDC token scoping** — the agent verifies scheduler jobs use minimally scoped service accounts rather than over-privileged defaults.
21473. **GCP Eventarc trigger auth** — the agent tests whether Eventarc triggers authenticate event sources to block forged events.
21474. **Cloudflare Workers vs Lambda parity** — the agent compares security controls across serverless platforms to flag controls present on one but missing on another.
21475. **Vercel serverless function auth** — the agent tests whether Vercel functions validate auth on every route instead of relying on frontend checks.
21476. **Netlify function identity context** — the agent verifies Netlify functions validate Identity JWTs server-side rather than trusting client claims.
21477. **Supabase edge function RLS bypass** — the agent tests whether edge functions respect Row Level Security instead of using service-role keys unsafely.
21478. **Supabase realtime authz** — the agent verifies realtime subscriptions enforce RLS policies on every channel instead of leaking rows.
21479. **Firebase Cloud Functions auth context** — the agent tests whether callable functions validate Firebase Auth tokens instead of trusting client-provided UIDs.
21480. **Firebase extensions permission review** — the agent reviews installed extensions for excessive IAM grants beyond their documented needs.
21481. **DigitalOcean functions namespace isolation** — the agent verifies function namespaces isolate tenants instead of sharing environment state.
21482. **Fly Machines API token scoping** — the agent tests whether machine API tokens are scoped to specific apps instead of organization-wide.
21483. **Render background worker auth** — the agent verifies background workers authenticate job payloads instead of trusting any queued message.
21484. **Railway service variable exposure** — the agent checks whether service variables leak through build logs or public deployment metadata.
21485. **Serverless cold-start fingerprinting** — the agent verifies platforms do not expose version or runtime details through cold-start error messages.
21486. **Provisioned throughput billing abuse** — the agent tests whether attackers can inflate bills by triggering provisioned capacity that the victim pays for.
21487. **Serverless cost anomaly alerting** — the agent checks whether billing alerts trigger fast enough to catch abuse before costs explode.
21488. **Function URL custom domain auth** — the agent verifies custom domains mapped to function URLs preserve the original authorization configuration.
21489. **Multi-region failover consistency** — the agent tests whether regional failover preserves security policies instead of falling back to permissive defaults.
21490. **Serverless backup encryption** — the agent verifies function code and configuration backups are encrypted rather than stored in plaintext.
21491. **Disaster recovery runbook auth** — the agent tests whether DR failover procedures require multi-party authorization before rerouting production traffic.
21492. **Serverless penetration test coordination** — the agent checks whether platforms provide safe-harbor testing windows so security testing does not trigger abuse flags.
21493. **Abuse report handling SLAs** — the agent verifies platforms publish and honor response times for abuse reports involving serverless resources.
21494. **Function concurrency reservation integrity** — the agent tests whether reserved concurrency cannot be silently reallocated to other functions.
21495. **Event filtering cost abuse** — the agent verifies event filtering happens before billing so attackers cannot inflate costs with filtered-out events.
21496. **Serverless VPC endpoint policy** — the agent checks whether VPC endpoints restrict which functions can reach private resources.
21497. **PrivateLink serverless exposure** — the agent verifies PrivateLink endpoints do not accidentally expose serverless APIs to unauthorized VPCs.
21498. **Transit gateway route validation** — the agent tests whether serverless VPC attachments cannot inject rogue routes into shared transit gateways.
21499. **Serverless WAF association checks** — the agent verifies WAFs are actually associated with function URLs and API stages instead of merely existing.
21500. **WAF rule update integrity** — the agent tests whether WAF rule changes require approval so attackers cannot silently disable protections.
21501. **Shield Advanced coverage gaps** — the agent maps which serverless resources lack DDoS protection enrollment despite being internet-facing.
21502. **Serverless access log integrity** — the agent verifies access logs are immutable and complete so attackers cannot erase traces of abuse.
21503. **Log retention policy enforcement** — the agent checks whether retention policies actually preserve logs for the declared period instead of expiring early.
21504. **Serverless compliance evidence collection** — the agent automatically gathers configuration evidence for audits instead of relying on manual screenshots.
21505. **WASM module endpoint discovery** — the agent crawls for `.wasm` artifacts and their JS loaders to map every WebAssembly entry point a backend exposes.
21506. **WASI capability exposure checks** — the agent tests whether WASM runtimes grant filesystem, network, or clock capabilities beyond what the module legitimately needs.
21507. **WASM module signature validation** — the agent verifies backends validate code signatures on WASM modules before execution instead of running unsigned binaries.
21508. **WASM-to-JS bridge injection flaws** — the agent tests whether values crossing the WASM-JS boundary are sanitized to block injection into DOM or eval sinks.
21509. **AOT-compiled API behavioral quirks** — the agent compares ahead-of-time compiled endpoints against interpreted equivalents to flag security checks lost in compilation.
21510. **WASM linear memory boundary checks** — the agent probes WASM modules for out-of-bounds memory access that the runtime should trap but might not.
21511. **WASM indirect call table integrity** — the agent verifies function tables cannot be corrupted through exported setters to redirect indirect calls.
21512. **WASM import object validation** — the agent tests whether host-provided imports are validated so malicious hosts cannot inject behavior into sandboxed modules.
21513. **WASM export enumeration** — the agent lists exported functions and memories to flag unintended exports that widen the attack surface.
21514. **WASM custom section data leaks** — the agent inspects custom sections for embedded secrets, source paths, or debug info that should have been stripped.
21515. **WASM source map exposure** — the agent checks whether `.wasm.map` files are publicly served, revealing original source structure.
21516. **WASM build reproducibility checks** — the agent verifies deployed modules match reproducible builds so tampered binaries are detectable.
21517. **WASM runtime version fingerprinting** — the agent identifies the WASM runtime and version to flag known sandbox-escape CVEs.
21518. **Wasmtime vs Wasmer behavior divergence** — the agent compares module behavior across runtimes to find security checks enforced by one but not the other.
21519. **WASM SIMD instruction abuse** — the agent tests whether SIMD-heavy modules can be driven into excessive CPU consumption for algorithmic DoS.
21520. **WASM threads shared-memory races** — the agent probes multi-threaded WASM for data races that could corrupt security-critical state.
21521. **WASM fuel metering enforcement** — the agent verifies execution fuel limits actually terminate runaway modules instead of being advisory.
21522. **WASM stack overflow handling** — the agent tests whether deep recursion traps cleanly instead of crashing the host process.
21523. **WASM host function reentrancy** — the agent checks whether host callbacks invoked from WASM can reenter the module in unsafe states.
21524. **WASM asyncify state corruption** — the agent tests whether asyncify-transformed modules preserve security invariants across suspend/resume.
21525. **WASM GC reference leaks** — the agent verifies garbage-collected WASM does not leak host object references to untrusted modules.
21526. **WASM component model interface validation** — the agent tests whether component-model interfaces validate types at boundaries instead of trusting producers.
21527. **WIT interface spoofing checks** — the agent verifies WIT-defined interfaces cannot be spoofed by malicious components advertising false capabilities.
21528. **WASM registry trust checks** — the agent verifies module registries authenticate publishers so typosquatted modules cannot be pulled.
21529. **WASM OCI artifact signing** — the agent checks whether WASM OCI images carry cosign-style signatures validated at deploy time.
21530. **WASM module update integrity** — the agent verifies hot-swapped modules are signature-checked so updates cannot inject malicious code.
21531. **WASM plugin sandbox escapes** — the agent probes plugin-style WASM (Envoy, Nginx) for escapes into host process memory or config.
21532. **Envoy WASM filter auth bypass** — the agent tests whether WASM-based Envoy filters can be bypassed through header casing or encoding tricks.
21533. **Proxy-WASM ABI validation** — the agent verifies proxy hosts validate ABI versions so incompatible modules fail closed instead of misbehaving.
21534. **WASM edge compute secret isolation** — the agent tests whether per-request WASM isolates in edge runtimes scrub secrets between invocations.
21535. **Fastly Compute@Edge WASM checks** — the agent verifies Compute@Edge guests cannot access host credentials or other customers' state.
21536. **WASM-based API gateway policy bypass** — the agent tests whether WASM policy engines can be bypassed with requests that skip the WASM execution path.
21537. **WASM crypto implementation audits** — the agent checks whether WASM crypto modules use constant-time operations instead of leaking secrets through timing.
21538. **WASM random number quality** — the agent verifies WASM modules source randomness from the host CSPRNG rather than weak Math.random-style generators.
21539. **WASM TLS termination flaws** — the agent tests whether WASM-based TLS terminators validate certificates correctly instead of skipping verification.
21540. **WASM image codec vulnerabilities** — the agent fuzzes WASM image decoders for memory-safety issues that could escape the sandbox.
21541. **WASM video transcoding resource abuse** — the agent tests whether transcoding endpoints bound WASM CPU time so crafted media cannot cause DoS.
21542. **WASM-based WAF bypass** — the agent tests whether WASM WAFs normalize encodings consistently with the protected application.
21543. **WASM rate limiter state isolation** — the agent verifies WASM rate limiters isolate counters per tenant instead of sharing global state.
21544. **WASM A/B testing integrity** — the agent checks whether WASM-driven experiments sign variant assignments to prevent self-selection into privileged cohorts.
21545. **WASM personalization data leaks** — the agent tests whether WASM personalization embeds one user's data into responses cached for others.
21546. **WASM SSR hydration mismatch** — the agent checks whether server-side-rendered WASM output matches client hydration to detect injection in either path.
21547. **Blazor WASM auth token storage** — the agent verifies Blazor WebAssembly apps store tokens in memory rather than localStorage where XSS can steal them.
21548. **Blazor WASM API scope validation** — the agent tests whether Blazor frontends request minimal API scopes instead of broad permissions.
21549. **Yew/Leptos WASM XSS surface** — the agent tests whether Rust WASM frameworks escape dynamic content instead of trusting innerHTML-style sinks.
21550. **WASM frontend secret embedding** — the agent scans WASM binaries for embedded API keys that should live server-side.
21551. **WASM reverse engineering resistance** — the agent assesses how easily WASM binaries reveal proprietary algorithms to guide obfuscation decisions.
21552. **WASM string extraction checks** — the agent extracts embedded strings to find hardcoded endpoints, credentials, or internal hostnames.
21553. **WASM control-flow integrity** — the agent verifies compiled modules preserve control-flow protections instead of optimizing them away.
21554. **WASM exception handling leaks** — the agent tests whether WASM exceptions propagate sensitive host state to untrusted callers.
21555. **WASM tail-call optimization flaws** — the agent verifies tail calls preserve stack discipline so security checks cannot be skipped.
21556. **WASM reference types validation** — the agent tests whether externref values are validated before use to prevent type-confusion attacks.
21557. **WASM multiple return value handling** — the agent checks whether multi-value returns are validated at call sites instead of trusting callee arity.
21558. **WASM bulk memory operation bounds** — the agent tests whether memory.init and memory.copy validate bounds to prevent overflows.
21559. **WASM table grow limits** — the agent verifies table growth is bounded so modules cannot exhaust host memory.
21560. **WASM memory grow limits** — the agent tests whether memory.grow respects declared maximums instead of growing unbounded.
21561. **WASM deterministic execution checks** — the agent verifies security-critical WASM executes deterministically so results cannot be manipulated by nondeterminism.
21562. **WASM floating-point consistency** — the agent tests whether floating-point behavior is consistent across hosts to prevent consensus splits.
21563. **WASM NaN canonicalization** — the agent verifies NaN payloads are canonicalized so they cannot smuggle data through arithmetic.
21564. **WASM spectre mitigation checks** — the agent checks whether runtimes deploy Spectre mitigations for WASM so one module cannot read another's memory.
21565. **WASM side-channel resistant crypto** — the agent tests whether crypto operations avoid secret-dependent branches visible through timing.
21566. **WASM enclave attestation** — the agent verifies WASM running in TEEs produces valid attestations binding code identity to outputs.
21567. **WASM confidential computing key handling** — the agent checks whether keys inside enclaved WASM are sealed to the enclave measurement.
21568. **WASM blockchain VM parity** — the agent compares WASM smart-contract execution against native chain semantics to flag divergences.
21569. **CosmWasm contract migration checks** — the agent verifies contract migrations preserve authorization state instead of resetting admin controls.
21570. **CosmWasm sudo entry abuse** — the agent tests whether privileged sudo entry points are restricted to chain governance rather than callable by users.
21571. **Substrate pallet WASM runtime upgrades** — the agent verifies runtime upgrades go through governance instead of being pushable by a single key.
21572. **WASM light client proof verification** — the agent tests whether WASM light clients fully verify proofs instead of trusting relayer claims.
21573. **WASM bridge message validation** — the agent verifies WASM bridge verifiers check consensus proofs rather than accepting unvalidated headers.
21574. **WASM oracle aggregation integrity** — the agent tests whether WASM oracle aggregators validate individual feed signatures before computing medians.
21575. **WASM keeper bot auth** — the agent verifies keeper bots authenticate to WASM automation endpoints instead of accepting open triggers.
21576. **WASM DAO voting integrity** — the agent tests whether WASM-based voting counts each eligible voter once and resists double-voting.
21577. **WASM zero-knowledge proof verification** — the agent verifies proof verifiers check all constraints instead of skipping expensive ones.
21578. **WASM MPC protocol checks** — the agent tests whether multi-party computation protocols validate each party's contributions to prevent result manipulation.
21579. **WASM FHE operation integrity** — the agent verifies fully-homomorphic-encryption operations preserve correctness without leaking plaintext.
21580. **WASM differential privacy budgets** — the agent tests whether privacy budgets are enforced so repeated queries cannot de-anonymize data.
21581. **WASM federated learning aggregation** — the agent verifies aggregation servers validate client updates to block model-poisoning attacks.
21582. **WASM inference input validation** — the agent tests whether ML inference endpoints validate input shapes to prevent crashes or misclassification abuse.
21583. **WASM model extraction resistance** — the agent measures how many queries reveal model weights to assess extraction risk.
21584. **WASM adversarial input robustness** — the agent tests whether inference APIs detect adversarial perturbations instead of returning confident wrong answers.
21585. **WASM content moderation bypass** — the agent tests whether WASM moderation models can be bypassed with encoding tricks the model was not trained on.
21586. **WASM spam filter evasion** — the agent probes WASM spam classifiers with obfuscated payloads to measure evasion rates.
21587. **WASM biometric template protection** — the agent verifies biometric templates processed in WASM are encrypted rather than handled in plaintext.
21588. **WASM payment tokenization** — the agent tests whether payment WASM tokenizes card data client-side so raw PANs never reach the merchant backend.
21589. **WASM DRM license validation** — the agent verifies DRM license checks cannot be bypassed by patching exported validation functions.
21590. **WASM cheat detection integrity** — the agent tests whether anti-cheat WASM validates game state server-side instead of trusting client attestations.
21591. **WASM ad fraud detection** — the agent verifies ad-verification WASM cannot be spoofed to fake viewability measurements.
21592. **WASM fingerprinting resistance** — the agent checks whether WASM APIs expose stable device fingerprints that enable cross-site tracking.
21593. **WASM canvas fingerprinting** — the agent tests whether WASM canvas operations produce fingerprints stable enough for tracking.
21594. **WASM font enumeration** — the agent verifies WASM cannot enumerate installed fonts to build tracking fingerprints.
21595. **WASM sensor API abuse** — the agent tests whether WASM access to motion or ambient sensors requires permission instead of being silent.
21596. **WASM WebGL fingerprinting** — the agent checks whether WASM WebGL calls leak GPU details usable for fingerprinting.
21597. **WASM audio fingerprinting** — the agent tests whether WASM audio processing produces stable fingerprints across sessions.
21598. **WASM battery status leaks** — the agent verifies WASM cannot read battery levels that enable tracking.
21599. **WASM network information leaks** — the agent tests whether WASM exposes connection types usable for fingerprinting.
21600. **WASM clipboard access validation** — the agent verifies WASM clipboard reads require user gestures instead of silent background access.
21601. **WASM geolocation permission** — the agent tests whether WASM geolocation requests trigger permission prompts rather than silent access.
21602. **WASM notification spoofing** — the agent verifies WASM-triggered notifications clearly identify their origin instead of impersonating system alerts.
21603. **WASM file system access scoping** — the agent tests whether File System Access API grants through WASM are scoped to user-selected directories.
21604. **WASM USB device access** — the agent verifies WebUSB access from WASM requires explicit device selection instead of silent enumeration.
21605. **WASM Bluetooth device pairing** — the agent tests whether WebBluetooth pairing from WASM requires user confirmation for each device.
21606. **WASM serial port access** — the agent verifies WebSerial access from WASM is gated behind explicit user grants.
21607. **WASM HID device access** — the agent tests whether WebHID device access requires per-device approval instead of blanket permission.
21608. **WASM MIDI access validation** — the agent verifies WebMIDI sysex access requires permission since it can reprogram connected hardware.
21609. **WASM NFC tag validation** — the agent tests whether WebNFC reads validate tag contents instead of trusting attacker-writable tags.
21610. **WASM contact picker scoping** — the agent verifies contact-picker access returns only user-selected contacts rather than the full address book.
21611. **WASM credential management** — the agent tests whether credential storage through WASM binds credentials to the correct origin.
21612. **WASM payment request integrity** — the agent verifies Payment Request API calls validate merchant data server-side instead of trusting client amounts.
21613. **WASM background sync abuse** — the agent tests whether background sync registrations are bounded so pages cannot schedule unlimited work.
21614. **WASM periodic sync permission** — the agent verifies periodic background sync requires explicit permission instead of silent registration.
21615. **WASM push subscription validation** — the agent tests whether push subscriptions authenticate the application server to prevent push spoofing.
21616. **WASM notification data leaks** — the agent verifies push notification payloads do not contain sensitive data visible on lock screens.
21617. **WASM share target validation** — the agent tests whether Web Share Target handlers validate incoming shared data before processing.
21618. **WASM protocol handler registration** — the agent verifies protocol handler registration requires user confirmation instead of silent hijacking.
21619. **WASM file handling integrity** — the agent tests whether file-handler registrations validate file types to prevent malicious file associations.
21620. **WASM URL pattern matching** — the agent verifies URLPattern-based routing cannot be confused to serve admin content on public paths.
21621. **WASM navigation preload auth** — the agent tests whether navigation preload requests carry credentials correctly instead of leaking or dropping auth.
21622. **WASM background fetch integrity** — the agent verifies background fetch results are validated before being exposed to the page.
21623. **WASM periodic background sync data** — the agent tests whether periodic sync payloads are integrity-checked to prevent stale data injection.
21624. **WASM content index exposure** — the agent verifies content-index entries do not leak private cached content titles to other origins.
21625. **WASM cookie store access** — the agent tests whether Cookie Store API access from WASM respects SameSite and HttpOnly semantics.
21626. **WASM storage bucket isolation** — the agent verifies storage buckets isolate origins so one site cannot read another's bucketed data.
21627. **WASM OPFS data validation** — the agent tests whether Origin Private File System contents are validated before use to block stored-XSS via files.
21628. **WASM sqlite persistence integrity** — the agent verifies WASM sqlite databases use parameterized queries instead of string-concatenated SQL.
21629. **WASM supply-chain SBOM checks** — the agent verifies WASM deployments ship software bills of materials so vulnerable toolchain components are visible.
21630. **ActivityPub inbox authentication** — the agent tests whether federated inboxes verify HTTP signatures on incoming activities instead of accepting unsigned posts.
21631. **ActivityPub outbox authorization** — the agent verifies outboxes only accept posts from the owning actor instead of letting anyone publish as them.
21632. **Mastodon API scope validation** — the agent tests whether OAuth scopes are enforced per endpoint so a read-only token cannot post or delete.
21633. **Cross-instance identity spoofing surface** — the agent verifies instances validate actor IDs against their home domain to block impersonation of remote users.
21634. **Instance federation trust checks** — the agent tests whether instances verify remote instance authenticity before federating rather than trusting any claimant.
21635. **Moderation API exposure** — the agent probes moderation endpoints to verify only authorized moderators can suspend, silence, or delete accounts.
21636. **Mastodon admin API auth** — the agent tests whether admin APIs require admin-scoped tokens instead of accepting any authenticated user.
21637. **Instance block list integrity** — the agent verifies domain blocks actually stop federation traffic rather than existing as unenforced configuration.
21638. **Federated report handling** — the agent tests whether reports forwarded between instances preserve reporter anonymity instead of leaking identities.
21639. **Media attachment proxy validation** — the agent verifies media proxies validate remote URLs to block SSRF through federated attachments.
21640. **Remote follow auth integrity** — the agent tests whether follow requests carry valid signatures so attackers cannot forge follows.
21641. **Follow request approval bypass** — the agent verifies locked accounts actually require approval instead of auto-accepting forged follows.
21642. **Block evasion via federation** — the agent tests whether blocked users can reach victims through federated boosts from cooperating instances.
21643. **Mute list synchronization** — the agent verifies mutes propagate consistently so muted actors cannot appear through federated timelines.
21644. **List membership privacy** — the agent checks whether private list memberships leak through federated list APIs.
21645. **Direct message federation leaks** — the agent verifies DMs are not federated to unintended instances through misconfigured delivery.
21646. **Poll vote integrity** — the agent tests whether federated poll votes are deduplicated so one actor cannot vote multiple times via relays.
21647. **Scheduled post auth** — the agent verifies scheduled-post endpoints authenticate the author instead of allowing scheduled impersonation.
21648. **Edit history exposure** — the agent checks whether post edit histories leak previous versions containing sensitive retracted content.
21649. **Delete propagation verification** — the agent tests whether deletes federate reliably so deleted content does not persist on remote instances.
21650. **Account migration integrity** — the agent verifies account migrations transfer followers through signed moves instead of trusting unsigned claims.
21651. **Alias proof validation** — the agent tests whether also-known-as proofs are cryptographically verified before merging identities.
21652. **Webfinger spoofing checks** — the agent verifies webfinger responses cannot be spoofed to redirect identity lookups to attacker servers.
21653. **Nodeinfo exposure** — the agent checks whether nodeinfo endpoints leak software versions useful for targeted exploitation.
21654. **Instance peer list harvesting** — the agent tests whether peer APIs allow enumerating the full federation graph for reconnaissance.
21655. **Relay subscription auth** — the agent verifies relays authenticate subscribing instances to prevent malicious relays from harvesting traffic.
21656. **Relay message injection** — the agent tests whether relays validate activities before rebroadcasting instead of amplifying spam.
21657. **Instance allowlist enforcement** — the agent verifies allowlist-mode instances actually reject non-allowlisted peers instead of federating openly.
21658. **Limited federation mode bypass** — the agent tests whether limited-federation settings can be bypassed through direct API calls.
21659. **Authorized fetch enforcement** — the agent verifies authorized-fetch mode signs all outgoing requests so scrapers cannot harvest content.
21660. **Secure mode remote media** — the agent tests whether secure-mode instances proxy remote media instead of leaking viewer IPs to remote servers.
21661. **Media removal propagation** — the agent verifies media deletions federate so removed attachments do not persist on remote caches.
21662. **Sensitive media flag integrity** — the agent tests whether sensitive-content flags survive federation instead of being stripped by intermediate instances.
21663. **Content warning preservation** — the agent verifies content warnings are preserved across federation rather than dropped silently.
21664. **Language tag spoofing** — the agent tests whether language metadata can be spoofed to bypass language-based moderation filters.
21665. **Hashtag federation spam** — the agent verifies instances rate-limit federated hashtag usage to prevent trending-topic manipulation.
21666. **Trending algorithm manipulation** — the agent tests whether trending calculations resist coordinated inauthentic boosting from allied instances.
21667. **Search index scope enforcement** — the agent verifies search only returns content the requester is authorized to see instead of leaking unlisted posts.
21668. **Full-text search opt-out** — the agent tests whether search-indexing opt-outs are honored across federated search.
21669. **Profile metadata verification** — the agent verifies profile link verification actually checks the linked page instead of trusting self-asserted badges.
21670. **Profile field injection** — the agent tests whether profile fields sanitize HTML to block stored XSS on profile pages.
21671. **Bio link phishing surface** — the agent checks whether profile links are scanned or warned about to reduce phishing from trusted-looking profiles.
21672. **Avatar image validation** — the agent verifies avatar uploads are re-encoded to strip malicious payloads hidden in image files.
21673. **Header image size abuse** — the agent tests whether header images enforce size limits to prevent storage exhaustion.
21674. **Custom emoji abuse** — the agent verifies custom emoji uploads are scanned since emoji can carry hidden payloads or shock content.
21675. **Emoji shortcode spoofing** — the agent tests whether emoji shortcodes can impersonate system UI elements to phish users.
21676. **Announcement reaction integrity** — the agent verifies instance announcements cannot be forged by non-admin actors.
21677. **Instance rules enforcement** — the agent tests whether published instance rules are actually enforced by automated moderation.
21678. **Terms of service versioning** — the agent verifies ToS updates require re-acceptance instead of silently binding users to new terms.
21679. **Federated data-export completeness** — the agent tests whether data exports include all user content rather than silently omitting federated interactions.
21680. **Account deletion federation** — the agent verifies deletion requests propagate to remote instances instead of leaving orphaned copies.
21681. **Backup encryption checks** — the agent verifies instance backups encrypt user data rather than storing plaintext archives.
21682. **Database credential rotation** — the agent checks whether instance database credentials rotate instead of living as permanent secrets.
21683. **Redis session isolation** — the agent tests whether session stores isolate instances on shared Redis to prevent session theft.
21684. **Sidekiq dashboard exposure** — the agent probes for exposed Sidekiq dashboards that leak job payloads and allow queue manipulation.
21685. **Elasticsearch index exposure** — the agent verifies search indexes are not directly reachable to bypass application-level authorization.
21686. **Streaming API auth** — the agent tests whether websocket streaming endpoints require authentication instead of serving public firehoses with private data.
21687. **Streaming timeline scope** — the agent verifies streaming timelines respect the same visibility rules as REST timelines.
21688. **Push subscription hijacking** — the agent tests whether push subscriptions can be registered for other users' accounts.
21689. **Web push VAPID validation** — the agent verifies push endpoints validate VAPID signatures so attackers cannot send forged notifications.
21690. **OAuth app verification** — the agent tests whether third-party OAuth apps disclose their requested scopes clearly before authorization.
21691. **OAuth redirect URI validation** — the agent verifies redirect URIs are strictly matched to prevent authorization code theft.
21692. **Token revocation propagation** — the agent tests whether revoked OAuth tokens stop working immediately across all instance services.
21693. **Application credential scope** — the agent verifies per-application credentials cannot exceed the scopes granted at authorization.
21694. **Two-factor bypass via API** — the agent tests whether API endpoints enforce 2FA for sensitive actions instead of only gating the web UI.
21695. **WebAuthn origin validation** — the agent verifies passkey authentication binds to the correct origin to prevent phishing-site logins.
21696. **Password reset token entropy** — the agent tests whether reset tokens are unguessable and single-use instead of predictable or reusable.
21697. **Email confirmation bypass** — the agent verifies unconfirmed accounts cannot perform actions reserved for verified users.
21698. **Invite code abuse** — the agent tests whether invite-only instances bound invite codes to prevent mass account creation.
21699. **Registration CAPTCHA effectiveness** — the agent measures whether registration challenges actually block automated signups.
21700. **Username squatting detection** — the agent flags lookalike usernames created to impersonate prominent accounts across instances.
21701. **Impersonation report workflow** — the agent tests whether impersonation reports trigger timely review instead of sitting unprocessed.
21702. **Appeal process integrity** — the agent verifies moderation appeals are reviewed by a different moderator than the one who acted.
21703. **Moderation audit-log immutability** — the agent tests whether moderation audit logs are append-only so rogue admins cannot erase their actions.
21704. **Admin action attribution** — the agent verifies every admin action records which administrator performed it for accountability.
21705. **Federated analytics integrity** — the agent verifies instance statistics cannot be inflated by forged activity from allied instances.
21706. **Instance peer quota enforcement** — the agent tests whether peer connection limits are enforced to prevent resource exhaustion from too many federated peers.
21707. **Activity delivery retry abuse** — the agent verifies delivery retries are bounded so malicious inboxes cannot trap instances in endless retry loops.
21708. **Inbox flooding protection** — the agent tests whether inboxes rate-limit incoming activities to resist federation-based DoS.
21709. **Outbox pagination auth** — the agent verifies outbox pagination does not leak non-public activities to unauthorized viewers.
21710. **Collection ordering integrity** — the agent tests whether ordered collections validate sequence so attackers cannot inject out-of-order activities.
21711. **Activity signature key rotation** — the agent verifies instances rotate HTTP signature keys and that old keys are revoked from key registries.
21712. **Key ID spoofing checks** — the agent tests whether signature key IDs are validated against the actor's domain to block key substitution.
21713. **Digest header validation** — the agent verifies digest headers are checked on signed requests to detect body tampering.
21714. **Date header skew enforcement** — the agent tests whether requests with wildly skewed dates are rejected to block replay attacks.
21715. **Replay cache integrity** — the agent verifies signed-request replay caches actually prevent reuse instead of being bypassable.
21716. **Linked Data signature validation** — the agent tests whether JSON-LD signatures are fully verified rather than trusted on presence alone.
21717. **JSON-LD context injection** — the agent probes whether remote contexts are fetched safely or can inject malicious type definitions.
21718. **Activity vocabulary validation** — the agent verifies unknown activity types are rejected or sandboxed instead of processed blindly.
21719. **Actor type confusion** — the agent tests whether Person, Service, and Application actors receive appropriate distinct handling.
21720. **Service actor privilege review** — the agent flags service actors with automation privileges that exceed their documented purpose.
21721. **Bot flag integrity** — the agent verifies bot accounts are correctly flagged so automation is transparent to users.
21722. **Automated post rate limits** — the agent tests whether bot posting limits are enforced to prevent timeline flooding.
21723. **Cross-posting deduplication** — the agent verifies cross-posted content is deduplicated so bridged posts do not spam timelines.
21724. **Bridge account transparency** — the agent tests whether bridged accounts (e.g., birdsite mirrors) are clearly labeled as automated mirrors.
21725. **Quote post attribution** — the agent verifies quote posts attribute the original author correctly across federation.
21726. **Quote post consent** — the agent tests whether quote-post privacy settings are honored by remote instances.
21727. **Thread unroll integrity** — the agent verifies thread reconstruction uses authenticated activities rather than forged replies.
21728. **Reply filtering bypass** — the agent tests whether reply-filtering settings can be bypassed through federated mentions.
21729. **Mention spam protection** — the agent verifies mention notifications are rate-limited to prevent harassment via mass mentions.
21730. **Hashtag mute enforcement** — the agent tests whether muted hashtags stay hidden across federated timelines.
21731. **Word filter circumvention** — the agent probes content filters with homoglyph variations to measure filter robustness.
21732. **Image description integrity** — the agent verifies alt-text is preserved across federation for accessibility instead of being dropped.
21733. **Sensitive media auto-flagging** — the agent tests whether automated classifiers flag sensitive media consistently instead of missing obvious cases.
21734. **CSAM detection pipeline** — the agent verifies PhotoDNA-style hashing runs on uploads and reports flow to moderators.
21735. **Illegal content takedown SLAs** — the agent checks whether instances publish and honor takedown response times for illegal content.
21736. **Transparency report accuracy** — the agent cross-checks published moderation statistics against observable actions for consistency.
21737. **Government request handling** — the agent verifies legal requests follow documented process instead of informal admin action.
21738. **User notification of actions** — the agent tests whether users are notified when their content is moderated, with reasons and appeal paths.
21739. **Shadow moderation detection** — the agent tests whether visibility reductions are disclosed to affected users instead of applied silently.
21740. **Federation policy transparency** — the agent verifies instances publish their federation policies so users understand where their data goes.
21741. **Data processing disclosure** — the agent checks whether instances disclose third-party processors handling user data.
21742. **Privacy policy versioning** — the agent verifies privacy policy changes are versioned and announced instead of silently updated.
21743. **Cookie consent integrity** — the agent tests whether tracking cookies require consent before being set.
21744. **Third-party embed privacy** — the agent verifies embedded content does not leak viewer IPs without consent.
21745. **Analytics opt-out enforcement** — the agent tests whether analytics opt-outs are honored across all instance subdomains.
21746. **Email notification unsubscribe** — the agent verifies unsubscribe links work immediately instead of requiring login.
21747. **Digest email content leaks** — the agent tests whether digest emails expose content from muted or blocked accounts.
21748. **Mobile API parity** — the agent verifies mobile APIs enforce the same authorization as web endpoints.
21749. **Third-party client auth** — the agent tests whether third-party apps cannot escalate beyond their granted OAuth scopes.
21750. **Client credential storage** — the agent checks whether official clients store tokens securely instead of in plaintext.
21751. **Deep link validation** — the agent tests whether app deep links validate destinations to prevent phishing via crafted links.
21752. **Share sheet data leaks** — the agent verifies share extensions do not include private metadata when sharing public posts.
21753. **Widget embed auth** — the agent tests whether embedded timelines respect the viewer's authorization instead of leaking private posts.
21754. **RSS feed access control** — the agent verifies RSS feeds do not expose non-public posts to unauthenticated readers.
21755. **PDS authentication hardening** — the agent tests whether Personal Data Servers require strong auth on repo writes instead of accepting weak session tokens.
21756. **Repo commit signature validation** — the agent verifies PDS instances validate commit signatures so tampered repo histories are rejected.
21757. **Lexicon schema abuse checks** — the agent tests whether custom lexicons can define records that bypass moderation or validation assumptions.
21758. **Handle resolution integrity** — the agent verifies handle-to-DID resolution validates DNS and DID documents to block handle hijacking.
21759. **ATProto OAuth scope enforcement** — the agent tests whether OAuth scopes restrict clients to declared lexicons instead of granting broad repo access.
21760. **Relay firehose data exposure** — the agent checks whether the relay firehose leaks deleted records or private data that should never be public.
21761. **Firehose cursor manipulation** — the agent tests whether firehose consumers can be fed forged cursors to skip or replay events.
21762. **AppView indexing integrity** — the agent verifies AppViews index only valid records instead of trusting PDS-provided data blindly.
21763. **Labeler service trust** — the agent tests whether labeler judgments are authenticated so fake labels cannot suppress legitimate content.
21764. **Label propagation integrity** — the agent verifies labels applied by trusted labelers propagate correctly without tampering in transit.
21765. **Feed generator auth** — the agent tests whether custom feed generators authenticate requests to prevent feed manipulation.
21766. **Feed algorithm transparency** — the agent verifies feed generators disclose ranking factors instead of operating as black boxes.
21767. **Starter pack integrity** — the agent tests whether starter packs cannot be silently modified after publication to swap recommended accounts.
21768. **List membership validation** — the agent verifies list additions require the list owner's authorization rather than accepting forged requests.
21769. **Threadgate enforcement** — the agent tests whether reply restrictions (threadgates) are enforced by the AppView instead of being client-side hints.
21770. **Postgate integrity** — the agent verifies embed and quote restrictions are enforced server-side across all clients.
21771. **Block list distribution** — the agent tests whether block lists propagate correctly so blocked actors stay blocked everywhere.
21772. **Mute persistence checks** — the agent verifies mutes survive PDS migrations instead of being dropped during account moves.
21773. **Account migration validation** — the agent tests whether PLC directory updates require the account's signing key to prevent identity theft.
21774. **PLC operation replay protection** — the agent verifies PLC log operations include nonces so old operations cannot be replayed.
21775. **DID document integrity** — the agent tests whether DID documents are validated for consistency between alsoKnownAs, verification methods, and services.
21776. **DID rotation audit trail** — the agent verifies key rotations are logged immutably so compromised rotations are detectable.
21777. **Handle change verification** — the agent tests whether handle changes validate new domain ownership before updating the DID document.
21778. **DNS handle hijack detection** — the agent monitors handle domains for DNS changes that could indicate hijacking.
21779. **Bidirectional handle proof** — the agent verifies handles prove control in both directions (DNS TXT and DID document) to prevent one-sided claims.
21780. **PDS entryway rate limiting** — the agent tests whether PDS signup endpoints enforce rate limits to prevent mass fake account creation.
21781. **PDS invite code integrity** — the agent verifies invite codes are single-use and bound to prevent sharing abuse.
21782. **PDS data export validation** — the agent tests whether repo exports (CAR files) are complete and untampered for account portability.
21783. **PDS import verification** — the agent verifies imported repos are signature-checked so corrupted imports fail closed.
21784. **Blob storage auth** — the agent tests whether blob uploads require authentication and are bound to the uploading account.
21785. **Blob reference integrity** — the agent verifies blob CIDs referenced in records actually exist to prevent dangling media.
21786. **Blob deletion propagation** — the agent tests whether deleted blobs are actually removed from storage instead of lingering accessibly.
21787. **Image blob validation** — the agent verifies image blobs are re-encoded to strip malicious payloads before serving.
21788. **Video blob abuse** — the agent tests whether video uploads enforce duration and size limits to prevent storage abuse.
21789. **Alt text preservation** — the agent verifies accessibility text survives cross-PDS federation instead of being dropped.
21790. **Record size limit enforcement** — the agent tests whether oversized records are rejected to prevent repo bloat attacks.
21791. **Collection creation auth** — the agent verifies only authorized lexicons can create new collections in a repo.
21792. **Unknown collection handling** — the agent tests whether unknown collections are sandboxed instead of processed as trusted data.
21793. **Like/reshare count integrity** — the agent verifies engagement counts derive from validated records rather than self-reported numbers.
21794. **Follower count manipulation** — the agent tests whether follower counts resist inflation from fake PDS accounts.
21795. **Notification auth** — the agent verifies notification endpoints only deliver events the recipient is authorized to see.
21796. **Push notification signing** — the agent tests whether push payloads are signed so forged notifications cannot phish users.
21797. **DM (chat) encryption checks** — the agent verifies direct messages use end-to-end encryption rather than plaintext PDS storage.
21798. **Chat participant validation** — the agent tests whether chat invites authenticate both parties to prevent impersonation.
21799. **Moderation service auth** — the agent verifies Ozone-style moderation APIs require moderator credentials instead of open access.
21800. **Moderation event integrity** — the agent tests whether moderation actions are signed so AppViews cannot forge takedowns.
21801. **Appeal workflow validation** — the agent verifies appeals reach human review instead of being auto-denied.
21802. **Takedown notice transparency** — the agent checks whether content removals disclose the reason and authority to affected users.
21803. **Account deactivation propagation** — the agent tests whether deactivations propagate to relays and AppViews promptly.
21804. **Identity recovery integrity** — the agent verifies account recovery flows require strong proof of ownership instead of weak email-only resets.
21805. **Custom domain handle verification** — the agent tests whether custom-domain handles validate domain ownership continuously, not just at claim time.
21806. **Subdomain handle delegation** — the agent verifies organizations can delegate subdomain handles without granting full domain control.
21807. **Handle dispute resolution** — the agent checks whether handle disputes follow a published process instead of ad-hoc admin decisions.
21808. **Trademark handle protection** — the agent tests whether well-known brand handles receive protection against impersonation squatting.
21809. **PDS hosting provider trust** — the agent verifies PDS hosts publish security practices so users can compare hosting risks.
21810. **Self-hosted PDS hardening** — the agent scans self-hosted PDS setups for default credentials and exposed admin ports.
21811. **PDS backup integrity** — the agent tests whether PDS backups are encrypted and restorable without data loss.
21812. **PDS failover consistency** — the agent verifies failover between PDS hosts does not fork repo histories.
21813. **Multi-PDS account linking** — the agent tests whether linked accounts across PDSs authenticate each link to prevent impersonation.
21814. **Cross-PDS block enforcement** — the agent verifies blocks apply regardless of which PDS the blocked actor migrates to.
21815. **Lexicon versioning integrity** — the agent tests whether lexicon updates are versioned so clients can detect breaking changes.
21816. **Lexicon deprecation handling** — the agent verifies deprecated lexicons fail gracefully instead of breaking clients silently.
21817. **Record validation strictness** — the agent tests whether PDSs reject records violating lexicon schemas instead of storing invalid data.
21818. **Facet link validation** — the agent verifies rich-text facets resolve to the claimed URLs instead of hiding phishing destinations.
21819. **Mention facet integrity** — the agent tests whether mention facets link to the correct DIDs rather than attacker-controlled lookalikes.
21820. **Tag facet spam** — the agent verifies hashtag facets are rate-limited to prevent trending manipulation.
21821. **Embed external card validation** — the agent tests whether link-card embeds validate the target URL to block malicious redirects.
21822. **Embed image alt enforcement** — the agent verifies image embeds encourage or require alt text for accessibility.
21823. **Embed video validation** — the agent tests whether video embeds are scanned for malicious content before display.
21824. **Quote embed consent** — the agent verifies quoted authors' embed preferences are honored across AppViews.
21825. **Poll lexicon integrity** — the agent tests whether poll votes are deduplicated per voter to prevent ballot stuffing.
21826. **Poll result manipulation** — the agent verifies poll results derive from validated votes rather than client-reported tallies.
21827. **Event lexicon auth** — the agent tests whether event RSVPs authenticate attendees to prevent fake attendance.
21828. **Marketplace lexicon fraud** — the agent verifies marketplace listings validate seller identity to reduce fraud.
21829. **Review lexicon integrity** — the agent tests whether reviews are bound to verified transactions to prevent fake reviews.
21830. **Profile verification badges** — the agent verifies verification badges are issued through authenticated processes rather than self-asserted.
21831. **Organization account validation** — the agent tests whether organization accounts prove legitimate affiliation before receiving organizational features.
21832. **Bot account labeling** — the agent verifies automated accounts are labeled so users can distinguish bots from humans.
21833. **News publisher verification** — the agent tests whether news accounts verify publisher identity to combat misinformation.
21834. **Government account authentication** — the agent verifies government accounts use strong identity proofing before receiving official markers.
21835. **Relay operator transparency** — the agent checks whether relay operators publish their data retention and logging policies.
21836. **Relay data retention enforcement** — the agent tests whether relays actually delete data per their stated retention policies.
21837. **Relay access controls** — the agent verifies firehose access requires registration so anonymous harvesting is limited.
21838. **AppView data minimization** — the agent tests whether AppViews store only necessary data instead of full firehose archives.
21839. **AppView search scope** — the agent verifies search respects block and mute lists instead of surfacing hidden content.
21840. **AppView trending integrity** — the agent tests whether trending algorithms resist manipulation from coordinated PDS networks.
21841. **Custom algorithm marketplace** — the agent verifies third-party algorithms disclose their ranking logic before users subscribe.
21842. **Algorithmic choice integrity** — the agent tests whether users can actually switch algorithms instead of being locked to defaults.
21843. **Discover feed manipulation** — the agent verifies discovery feeds cannot be bought through undisclosed promotion.
21844. **Sponsored content labeling** — the agent tests whether paid placements are clearly labeled as advertising.
21845. **Ad targeting transparency** — the agent verifies ad targeting criteria are disclosed to targeted users.
21846. **Data broker integration checks** — the agent tests whether user data is shared with brokers only with explicit consent.
21847. **Analytics SDK data collection** — the agent verifies app analytics collect minimal data and honor opt-outs.
21848. **Crash report PII scrubbing** — the agent tests whether crash reports redact user content before upload.
21849. **Beta feature data handling** — the agent verifies beta features disclose additional data collection before enrollment.
21850. **Age verification integrity** — the agent tests whether age gates cannot be bypassed through client-side manipulation.
21851. **Parental control enforcement** — the agent verifies parental controls are enforced server-side rather than as client hints.
21852. **Sensitive content defaults** — the agent tests whether sensitive content warnings default to on for new accounts.
21853. **Wellness check integrity** — the agent verifies self-harm intervention features trigger reliably instead of failing silently.
21854. **Election integrity tooling** — the agent tests whether civic-integrity labels apply consistently during election periods.
21855. **Misinformation labeling accuracy** — the agent verifies fact-check labels link to evidence rather than opaque judgments.
21856. **Synthetic media labeling** — the agent tests whether AI-generated content is labeled as synthetic when detected.
21857. **Deepfake detection integration** — the agent verifies deepfake detection runs on high-risk uploads instead of being optional.
21858. **Impersonation detection automation** — the agent tests whether automated systems flag likely impersonation for human review.
21859. **Coordinated inauthentic behavior detection** — the agent verifies platforms detect network-level manipulation campaigns.
21860. **State actor attribution transparency** — the agent checks whether takedowns of state-linked networks are publicly disclosed.
21861. **Journalist protection tooling** — the agent tests whether at-risk accounts receive enhanced security protections.
21862. **Harassment campaign detection** — the agent verifies brigading detection triggers protective measures for targeted users.
21863. **Doxxing response SLAs** — the agent checks whether doxxing reports receive expedited review per published SLAs.
21864. **Non-consensual imagery handling** — the agent tests whether intimate-image reports trigger immediate hashing and blocking.
21865. **Hash database participation** — the agent verifies platforms contribute to shared hash databases for known abusive imagery.
21866. **Victim support resources** — the agent checks whether reporting flows surface support resources instead of dead-ending.
21867. **Legal request transparency** — the agent verifies government data requests are disclosed in transparency reports.
21868. **User notification of legal requests** — the agent tests whether users are notified of data requests unless legally prohibited.
21869. **Data preservation request handling** — the agent verifies preservation requests follow legal process instead of informal compliance.
21870. **Cross-border data transfer disclosure** — the agent checks whether international data transfers are disclosed with legal bases.
21871. **Data residency options** — the agent tests whether users can choose data residency regions where offered.
21872. **Right to erasure verification** — the agent verifies erasure requests propagate to relays, AppViews, and backups.
21873. **Data portability testing** — the agent tests whether exports use open formats enabling real migration to competitors.
21874. **Interoperability API stability** — the agent verifies public APIs maintain backward compatibility instead of breaking third-party clients.
21875. **Third-party client certification** — the agent tests whether certified clients meet security baselines before receiving certification.
21876. **API deprecation notices** — the agent verifies breaking API changes are announced with migration timelines.
21877. **Developer terms fairness** — the agent checks whether developer terms do not grant the platform unlimited rights over third-party apps.
21878. **App directory integrity** — the agent tests whether app directories verify listings to prevent malicious client distribution.
21879. **OAuth consent screen clarity** — the agent verifies consent screens explain exactly what data each scope exposes.
21880. **MQTT broker authentication strength** — the agent tests whether MQTT brokers require strong credentials instead of accepting anonymous or default logins.
21881. **MQTT topic ACL enforcement** — the agent verifies topic access-control lists actually restrict publish/subscribe per client instead of being advisory.
21882. **MQTT retained message poisoning** — the agent tests whether retained messages are validated so attackers cannot plant persistent malicious payloads.
21883. **MQTT wildcard subscription leaks** — the agent checks whether wildcard subscriptions expose topics the subscriber should not see.
21884. **MQTT last-will testament abuse** — the agent tests whether last-will messages can be crafted to trigger unauthorized downstream actions.
21885. **MQTT bridge loop detection** — the agent verifies broker bridges detect loops that amplify messages infinitely.
21886. **MQTT payload size enforcement** — the agent tests whether maximum payload sizes are enforced to prevent memory-exhaustion attacks.
21887. **MQTT QoS downgrade checks** — the agent verifies quality-of-service guarantees are honored instead of silently downgraded.
21888. **MQTT session takeover protection** — the agent tests whether client IDs are authenticated so attackers cannot hijack device sessions.
21889. **MQTT TLS certificate validation** — the agent verifies brokers and clients validate certificates instead of skipping verification.
21890. **CoAP backend exposure** — the agent scans for publicly reachable CoAP endpoints that should be restricted to device networks.
21891. **CoAP DTLS enforcement** — the agent tests whether CoAP servers require DTLS instead of accepting plaintext requests.
21892. **CoAP resource discovery leaks** — the agent checks whether `/.well-known/core` exposes sensitive resources to unauthenticated scanners.
21893. **CoAP observe subscription auth** — the agent verifies observe subscriptions require authorization instead of streaming sensor data openly.
21894. **CoAP block-wise transfer abuse** — the agent tests whether block-wise transfers bound total size to prevent reassembly-based DoS.
21895. **Device shadow desired-state tampering** — the agent tests whether AWS IoT shadows validate desired-state updates so attackers cannot push malicious configs.
21896. **Device shadow reported-state spoofing** — the agent verifies reported states authenticate the device to prevent spoofed telemetry.
21897. **Shadow document size limits** — the agent tests whether shadow documents enforce size caps to prevent storage abuse.
21898. **Shadow version conflict handling** — the agent verifies version conflicts resolve safely instead of applying stale desired states.
21899. **LwM2M server authentication** — the agent tests whether LwM2M servers authenticate devices instead of accepting any client claiming an endpoint name.
21900. **LwM2M bootstrap integrity** — the agent verifies bootstrap servers provision credentials securely instead of leaking them in plaintext.
21901. **LwM2M object access control** — the agent tests whether object instances enforce per-object ACLs so devices cannot read each other's data.
21902. **LwM2M firmware update auth** — the agent verifies firmware updates require signed packages instead of accepting unsigned binaries.
21903. **Firmware update rollback protection** — the agent tests whether devices reject downgrades to vulnerable firmware versions.
21904. **Firmware delta update integrity** — the agent verifies delta patches are validated against the running version to prevent bricking or exploitation.
21905. **Firmware signing key rotation** — the agent verifies firmware signing keys rotate and old keys are revoked so compromised keys cannot sign forever.
21906. **OTA update channel encryption** — the agent tests whether over-the-air updates travel over encrypted channels instead of plaintext HTTP.
21907. **OTA update atomicity** — the agent verifies updates apply atomically so interrupted flashes do not leave devices in exploitable half-states.
21908. **Device provisioning flow flaws** — the agent tests whether onboarding flows authenticate new devices instead of letting attackers claim unprovisioned hardware.
21909. **Provisioning claim window** — the agent verifies unclaimed devices cannot be claimed indefinitely after leaving the factory.
21910. **Just-in-time provisioning auth** — the agent tests whether JIT provisioning validates device certificates instead of trusting self-asserted identities.
21911. **Fleet provisioning template scoping** — the agent verifies provisioning templates restrict which policies new devices receive.
21912. **Device certificate rotation** — the agent tests whether device certificates rotate automatically instead of living as permanent credentials.
21913. **Certificate revocation propagation** — the agent verifies revoked device certificates stop authenticating promptly across all brokers.
21914. **Private CA compromise detection** — the agent monitors device CAs for unauthorized issuance that could mint rogue device identities.
21915. **Telemetry ingestion validation** — the agent tests whether ingestion pipelines validate sensor ranges so spoofed readings cannot corrupt analytics.
21916. **Telemetry timestamp integrity** — the agent verifies ingestion rejects future-dated or replayed telemetry instead of trusting device clocks.
21917. **Telemetry schema enforcement** — the agent tests whether ingestion validates payload schemas to block malformed data from crashing pipelines.
21918. **Telemetry PII scrubbing** — the agent verifies ingestion strips personal data from device payloads before storage.
21919. **Digital twin access control** — the agent tests whether twin APIs enforce per-device authorization instead of exposing all twins to any caller.
21920. **Twin state synchronization integrity** — the agent verifies twin states reconcile with actual device states instead of drifting silently.
21921. **Twin command injection** — the agent tests whether twin-desired-state updates sanitize inputs to block command injection into devices.
21922. **Twin history tampering** — the agent verifies twin change histories are append-only so attackers cannot erase evidence of manipulation.
21923. **Device group policy inheritance** — the agent tests whether group policies apply correctly so devices cannot escape restrictions via regrouping.
21924. **Dynamic thing group auth** — the agent verifies dynamic group membership rules cannot be manipulated to grant devices elevated access.
21925. **Thing policy least privilege** — the agent reviews IoT policies to flag wildcard actions that exceed each device's needs.
21926. **Policy variable misuse** — the agent tests whether policy variables (e.g., client ID substitution) can be abused to widen access.
21927. **Authorizer Lambda validation** — the agent verifies custom authorizers actually validate tokens instead of returning allow-all policies.
21928. **Authorizer caching staleness** — the agent tests whether authorizer result caches respect TTLs instead of serving revoked decisions.
21929. **Domain configuration TLS** — the agent verifies custom IoT endpoints enforce TLS 1.2+ instead of accepting weak protocols.
21930. **VPC endpoint policy scoping** — the agent tests whether IoT VPC endpoints restrict access to intended principals.
21931. **IoT Jobs execution auth** — the agent verifies job executions authenticate the target device so jobs cannot be redirected.
21932. **Job document validation** — the agent tests whether job documents are schema-validated to block malicious job payloads.
21933. **Job rollout rate limiting** — the agent verifies fleet rollouts proceed in stages so a bad job does not brick every device at once.
21934. **Job abort integrity** — the agent tests whether job aborts propagate reliably instead of leaving devices executing canceled jobs.
21935. **Secure tunneling auth** — the agent verifies remote-access tunnels require per-session authorization instead of open device shells.
21936. **Tunnel destination validation** — the agent tests whether tunnels validate destination services to prevent pivoting into internal networks.
21937. **Tunnel session logging** — the agent verifies tunnel sessions are logged immutably for forensic review.
21938. **Device Defender audit gaps** — the agent tests whether security audits actually run on schedules instead of existing as unenforced configuration.
21939. **Device Defender metric tampering** — the agent verifies devices cannot forge the metrics that security audits evaluate.
21940. **Mitigation action auth** — the agent tests whether automated mitigation actions (quarantine, rotation) require approval for high-impact fleets.
21941. **Alert suppression detection** — the agent verifies alert rules cannot be silently disabled by compromised device identities.
21942. **Fleet index query auth** — the agent tests whether fleet-index searches respect the requester's authorization scope.
21943. **Thing registry PII** — the agent verifies thing attributes do not store personal data in searchable plaintext.
21944. **Bulk provisioning integrity** — the agent tests whether bulk registration validates each device instead of trusting batch uploads.
21945. **Zero-touch provisioning hijack** — the agent verifies zero-touch flows bind devices to the correct owner account during first boot.
21946. **LoRaWAN join server auth** — the agent tests whether join servers validate device credentials instead of accepting any join request.
21947. **LoRaWAN AppKey provisioning** — the agent verifies application keys are provisioned securely instead of derived predictably.
21948. **LoRaWAN frame counter validation** — the agent tests whether frame counters are enforced to block replayed uplinks.
21949. **NB-IoT backend exposure** — the agent scans for exposed NB-IoT application servers that should sit behind carrier VPNs.
21950. **Zigbee gateway API auth** — the agent tests whether smart-home gateways require authentication instead of exposing local APIs openly.
21951. **Z-Wave S2 downgrade checks** — the agent verifies gateways enforce S2 security instead of silently falling back to insecure pairing.
21952. **Matter fabric admin validation** — the agent tests whether Matter fabrics validate admin credentials before granting device control.
21953. **Matter CASE session integrity** — the agent verifies certificate-authenticated sessions cannot be hijacked mid-communication.
21954. **Thread border router auth** — the agent tests whether border routers authenticate management access instead of exposing open admin panels.
21955. **BLE GATT characteristic auth** — the agent verifies sensitive GATT characteristics require pairing instead of allowing open reads/writes.
21956. **BLE pairing downgrade** — the agent tests whether devices reject Just Works pairing when stronger methods are available.
21957. **BLE advertisement spoofing** — the agent verifies companion apps validate advertisement data instead of trusting spoofed beacons.
21958. **NFC provisioning tag validation** — the agent tests whether NFC-based provisioning validates tag signatures to block malicious tags.
21959. **RFID backend injection** — the agent probes RFID ingestion endpoints for injection through tag payload data.
21960. **Modbus TCP exposure** — the agent scans for internet-facing Modbus endpoints that should be isolated to OT networks.
21961. **Modbus function code filtering** — the agent tests whether gateways filter dangerous function codes like firmware-write commands.
21962. **OPC UA authentication** — the agent verifies OPC UA servers require authentication instead of allowing anonymous sessions.
21963. **OPC UA certificate validation** — the agent tests whether application certificates are validated instead of trusted on first use.
21964. **BACnet device exposure** — the agent scans for exposed BACnet devices that leak building automation controls to the internet.
21965. **DNP3 outstation auth** — the agent tests whether DNP3 outstations authenticate masters to block unauthorized control commands.
21966. **IEC 61850 MMS exposure** — the agent verifies substation automation endpoints are not reachable from public networks.
21967. **MQTT-SN gateway auth** — the agent tests whether MQTT-SN gateways authenticate sensor nodes instead of accepting any publisher.
21968. **6LoWPAN border security** — the agent verifies low-power border routers filter inbound traffic instead of bridging the mesh openly.
21969. **Device management platform SSO** — the agent tests whether IoT consoles enforce SSO instead of allowing weak local passwords.
21970. **Console session timeout** — the agent verifies management consoles expire idle sessions instead of leaving them open indefinitely.
21971. **API token scoping for fleets** — the agent tests whether fleet API tokens are scoped per customer instead of granting cross-tenant access.
21972. **Webhook delivery auth** — the agent verifies device-event webhooks sign payloads so receivers can reject forged events.
21973. **Webhook retry amplification** — the agent tests whether webhook retries are bounded to prevent retry storms against customer endpoints.
21974. **Event rule destination validation** — the agent verifies IoT rules cannot forward data to attacker-controlled endpoints via misconfigured actions.
21975. **Republish topic loop detection** — the agent tests whether republish rules detect loops that amplify messages across topics.
21976. **DynamoDBv2 action scoping** — the agent verifies IoT rule actions write only to intended tables with least-privilege roles.
21977. **Lambda action payload validation** — the agent tests whether rule-triggered Lambdas validate IoT payloads instead of trusting device data.
21978. **S3 action bucket validation** — the agent verifies IoT rules cannot exfiltrate telemetry to unauthorized buckets.
21979. **SNS action topic validation** — the agent tests whether notification actions target verified topics instead of attacker-subscribed endpoints.
21980. **SQS action queue validation** — the agent verifies queue actions use intended queues with proper encryption.
21981. **Kinesis action stream auth** — the agent tests whether stream actions authenticate to prevent data injection into analytics.
21982. **Timestream action validation** — the agent verifies time-series actions validate dimensions to block metric poisoning.
21983. **Location action geofence integrity** — the agent tests whether geofence evaluations use trusted positions instead of spoofable device reports.
21984. **Device location spoofing detection** — the agent verifies platforms flag impossible device movements indicating spoofed coordinates.
21985. **Asset tracker tamper alerts** — the agent tests whether tamper events trigger alerts reliably instead of being silently dropped.
21986. **Cold chain telemetry integrity** — the agent verifies temperature telemetry is signed so spoofed readings cannot hide spoilage.
21987. **Industrial sensor calibration validation** — the agent tests whether calibration updates require authorization to prevent malicious miscalibration.
21988. **Predictive maintenance model poisoning** — the agent verifies training pipelines validate sensor data to block model-poisoning attacks.
21989. **OTA campaign targeting validation** — the agent tests whether update campaigns target only intended device cohorts instead of the whole fleet.
21990. **Staged rollout monitoring** — the agent verifies staged rollouts halt automatically when failure thresholds are exceeded.
21991. **Device health attestation** — the agent tests whether health reports are signed so compromised devices cannot fake healthy status.
21992. **Remote attestation integrity** — the agent verifies attestation quotes bind to device identity and firmware measurements.
21993. **Secure boot verification** — the agent tests whether secure boot actually validates each stage instead of being bypassable via debug interfaces.
21994. **Debug interface exposure** — the agent scans device management APIs for exposed JTAG/UART controls that should be disabled in production.
21995. **Hardware root of trust validation** — the agent verifies device identity keys are hardware-bound rather than software-stored.
21996. **Key provisioning ceremony audits** — the agent checks whether factory key provisioning follows audited ceremonies instead of ad-hoc processes.
21997. **Supply chain component validation** — the agent verifies device BOMs are validated so counterfeit components are detectable.
21998. **EOL device security policy** — the agent tests whether end-of-life devices are quarantined instead of remaining on production networks unpatched.
21999. **Decommissioned device data wipe** — the agent verifies retired devices have credentials revoked and storage wiped.
22000. **Device resale identity reset** — the agent tests whether ownership transfer resets device identity to prevent previous-owner access.
22001. **Multi-tenant gateway isolation** — the agent verifies gateways serving multiple customers isolate traffic and credentials per tenant.
22002. **Edge gateway offline auth** — the agent tests whether gateways enforce authentication even when disconnected from the cloud.
22003. **Gateway failover integrity** — the agent verifies failover gateways inherit the same security policies instead of permissive defaults.
22004. **IoT platform penetration test scope** — the agent checks whether IoT platforms publish clear testing authorization so researchers can probe safely.
