## V. Learning & memory
0001. **React reflected-XSS payload ledger** — record which payloads fire on React targets with escaping context and rank them by historical success rate so future scans try winners first.
0002. **Angular template-injection win table** — track interpolation and directive payloads against Angular versions to auto-prioritize the payloads that historically bypassed its sanitizer.
0003. **Vue v-html payload ranking** — log which XSS payloads execute inside Vue v-html and mustache contexts to bias future payload selection toward proven winners.
0004. **Svelte compile-context payload memory** — store payload outcomes against Svelte compile-time escaping to skip payload families that never survive its output encoding.
0005. **Next.js SSR XSS hit ledger** — track payload success split by server-rendered versus hydrated contexts so the agent picks payloads matched to the rendering path.
0006. **Nuxt hydration XSS stats** — record which payloads survive Nuxt SSR-to-client hydration to avoid re-firing payloads that die during rehydration.
0007. **Django autoescape bypass table** — keep per-version tallies of which XSS vectors beat Django template autoescaping to focus effort on historically weak spots.
0008. **Rails ERB escaping ledger** — track payload success against ERB and Erubi escaping modes so the agent learns which contexts still yield script execution.
0009. **Laravel Blade payload memory** — record bypasses of Blade double-brace versus raw output directives to prioritize payloads per output directive.
0010. **ASP.NET request-validation bypass log** — tally payloads that slipped past ASP.NET request validation by version to front-load historically successful encodings.
0011. **Flask Jinja2 SSTI payload ledger** — track which SSTI payloads achieve code execution per Jinja2 version so the agent escalates with proven gadget chains first.
0012. **Twig SSTI success table** — record Twig sandbox-bypass payloads by version to skip payload families patched in the target release.
0013. **Smarty template-injection memory** — log Smarty payload outcomes per version to prioritize delimiters and modifiers that previously executed.
0014. **Freemarker SSTI hit ledger** — track Freemarker gadget payloads by version so the agent reuses chains that historically reached code execution.
0015. **Velocity template payload stats** — record Velocity SSTI payload success to bias the agent toward directives that previously evaluated.
0016. **Handlebars injection memory** — track Handlebars helper-abuse payloads to front-load the helpers that historically gave code execution.
0017. **ERB SSTI ledger** — store server-side ERB injection outcomes to prioritize payloads that previously escaped the template sandbox.
0018. **Thymeleaf SSTI success table** — track Thymeleaf expression-injection payloads per Spring Boot version to reuse proven evaluation vectors.
0019. **Pug interpolation injection memory** — record Pug template payload outcomes to prioritize interpolation vectors that previously executed.
0020. **EJS injection hit ledger** — track EJS payload success to front-load the delimiters that historically yielded server-side execution.
0021. **MySQL error-based payload ledger** — tally which error-based SQLi payloads extract data per MySQL and MariaDB version to skip dead error vectors.
0022. **MySQL union column-match memory** — record union payload shapes that matched column counts to reuse successful column-count fingerprints per target.
0023. **PostgreSQL stacked-query ledger** — track stacked-query payload success per Postgres version to prioritize command-execution vectors that previously worked.
0024. **MSSQL xp_cmdshell payload table** — record xp_cmdshell re-enable chains by SQL Server version to front-load historically successful privilege paths.
0025. **Oracle UTL_HTTP exfil memory** — track Oracle out-of-band payload outcomes to prioritize the network packages that previously resolved externally.
0026. **SQLite blind-injection stats** — log boolean and time-based SQLite payload success to calibrate delay thresholds from past timing data.
0027. **MongoDB NoSQL injection ledger** — track operator-injection payloads per driver version to reuse the operators that historically bypassed authentication.
0028. **CQL injection success table** — record CQL payload outcomes per Cassandra version to front-load query shapes that previously broke out of filtering contexts.
0029. **GraphQL injection success table** — track which GraphQL-specific payloads yielded data per implementation to prioritize proven introspection and batching abuse.
0030. **LDAP injection directory ledger** — record LDAP filter-breakout payloads split by Active Directory versus OpenLDAP to use the syntax each historically accepted.
0031. **XPath parser payload table** — track XPath payload outcomes per parser to front-load functions that previously extracted nodes.
0032. **OS command-injection shell matrix** — record command-injection payload success per OS and shell combination to pick separators proven on that stack.
0033. **XXE parser capability ledger** — track XXE payload outcomes per XML parser to skip entity types the parser historically blocked.
0034. **Java deserialization gadget memory** — record which gadget chains executed per library version to prioritize chains proven against that stack.
0035. **PHP deserialization payload table** — track PHP object-injection payloads per framework to reuse pop chains that previously fired.
0036. **Python pickle payload ledger** — log pickle payload outcomes per Python version to front-load opcodes that historically executed.
0037. **Node.js deserialization memory** — track function-constructor payload success to prioritize vectors proven on the target Node version.
0038. **.NET ViewState payload stats** — record ViewState deserialization outcomes per .NET version to reuse gadget chains that previously decoded.
0039. **WordPress plugin-XSS payload bank** — track XSS payloads by plugin and version so repeat hunts on WordPress fleets start from historically firing payloads.
0040. **Drupal Twig sandbox ledger** — record Drupal-specific Twig bypasses per core version to skip payloads patched upstream.
0041. **Joomla context payload table** — track Joomla reflected-XSS payload success by version to front-load vectors that survived its filtering.
0042. **SharePoint payload memory** — record SharePoint XSS and postMessage payload outcomes to prioritize vectors proven in its web-part contexts.
0043. **Salesforce Lightning XSS ledger** — track component-context bypass payloads to focus on the contexts that historically leaked script execution.
0044. **SVG upload XSS hit table** — record which SVG payloads execute per sanitizer version to reuse the vectors that survived parsing.
0045. **PDF XSS payload memory** — track PDF-embedded JavaScript execution per viewer to prioritize the viewers that historically ran scripts.
0046. **CSV formula-injection ledger** — record CSV injection payloads per spreadsheet application to front-load formulas that previously executed on open.
0047. **Markdown renderer XSS table** — track XSS payloads per Markdown library to reuse the renderers historically missing sanitization.
0048. **WYSIWYG editor bypass memory** — record editor-specific XSS bypasses per editor version to front-load historically successful vectors.
0049. **Email HTML XSS ledger** — track payloads that execute per mail client to prioritize clients with historically weak sanitizers.
0050. **DOM sink-source pair memory** — record which source-to-sink pairs historically yielded execution to prioritize taint paths proven on similar codebases.
0051. **ModSecurity rule-hit fingerprinting** — log which rule IDs fire per payload family to auto-rewrite payloads that historically triggered the same rules.
0052. **Cloudflare block-signature ledger** — record Cloudflare block page signatures per payload mutation to learn which obfuscations previously slipped through.
0053. **Akamai evasion success table** — track payload mutations that bypassed Akamai rules to reuse the transformations proven against it.
0054. **AWS WAF bypass memory** — log AWS WAF managed-rule bypasses by rule group to front-load mutations that historically evaded each group.
0055. **Imperva signature learning** — record Imperva block and allow decisions per payload shape to steer future payloads away from its known signatures.
0056. **Case-tampering success stats** — track upper, lower, and mixed-case mutations per WAF to reuse the casing tricks that previously bypassed keyword filters.
0057. **Double-URL-encoding win ledger** — record double-encoding success per stack to auto-apply the encoding layers that historically decoded server-side.
0058. **Unicode normalization bypass table** — track unicode and overlong-UTF8 payloads per framework to reuse normalizations that previously collapsed into dangerous characters.
0059. **HTML-entity mutation memory** — log HTML-entity-encoded payload outcomes per sanitizer to front-load the entity tricks that historically decoded in sinks.
0060. **SQL comment-evasion ledger** — track inline-comment and whitespace-variant SQLi payloads per WAF to reuse the comment styles that previously broke keyword matching.
0061. **Polyglot payload effectiveness table** — record polyglot payload success per target type to prioritize payloads proven across multiple parsers.
0062. **Chunked-transfer WAF bypass memory** — log chunked-encoding smuggling outcomes per WAF to reuse the chunk shapes that previously desynchronized inspection.
0063. **HTTP/2 downgrade evasion stats** — track HTTP/2 to 1.1 translation quirks per edge server to front-load request shapes that historically bypassed inspection.
0064. **Time-delay calibration per WAF** — record observed WAF-induced latency per vendor to distinguish real time-based SQLi sleeps from WAF throttling.
0065. **JSON-encoding bypass ledger** — track JSON unicode-escape and duplicate-key tricks per API framework to reuse the mutations that previously passed validation.
0066. **Multipart boundary evasion table** — record multipart smuggling payloads per parser to front-load boundary tricks proven against that stack.
0067. **Header-case smuggling memory** — log header-name case mutations per server to reuse the casings that previously bypassed header-based WAF rules.
0068. **Parameter pollution WAF ledger** — track HTTP parameter pollution outcomes per framework to prioritize the join behaviors that historically slipped past filters.
0069. **Null-byte truncation stats** — record null-byte payload success per language runtime to reuse the truncation vectors proven on that stack.
0070. **Payload-length DOS-filter learning** — track which payload lengths trigger WAF rate rules to auto-throttle below historically observed block thresholds.
0071. **Bot-score correlation memory** — log how payload aggressiveness correlates with bot-score blocks per vendor to tune scan stealth from past sessions.
0072. **CAPTCHA-trigger threshold table** — record request patterns that historically triggered CAPTCHAs per target to pace future scans under those limits.
0073. **IP-reputation decay tracking** — track how long blocked IPs stay blocked per target to schedule retests after historically observed cooldowns.
0074. **Allowlist-path discovery memory** — record URL paths that historically bypassed WAF inspection to route probes through them first.
0075. **Method-override evasion ledger** — track method-override header outcomes per framework to reuse the tunnels that previously bypassed method-based rules.
0076. **Content-type confusion table** — log content-type mismatch payloads per API to front-load the mismatches that historically skipped body inspection.
0077. **Charset filter-bypass memory** — record charset-declaration tricks per parser to reuse the encodings that previously broke filter string matching.
0078. **Fragment-smuggling stats** — track URL-fragment payload outcomes per client-side router to prioritize fragments that historically reached sinks.
0079. **Second-order payload timing ledger** — record delay-to-execution for stored payloads per app to schedule verification checks at historically observed intervals.
0080. **WAF fingerprint versioning** — version each target's WAF fingerprint over time to detect vendor swaps that invalidate old evasion playbooks.
0081. **Evasion cost-benefit table** — track time spent per successful bypass to auto-abandon evasion families with historically poor ROI on similar targets.
0082. **Honeypot-response learning** — record tarpit and honeypot response signatures to auto-disengage from endpoints that historically wasted scan budget.
0083. **Canary-token trip memory** — log canary token formats per program to avoid re-triggering tripwires that previously burned the engagement.
0084. **Block-page classifier training** — train a classifier on historical block pages to instantly recognize new WAF blocks without burning extra requests.
0085. **Mutation-lineage tracking** — record parent-to-child payload mutations and their outcomes to breed new variants from historically successful lineages.
0086. **Bayesian technique priors** — maintain prior success probabilities per technique conditioned on tech-stack fingerprints to rank the plan before the first request.
0087. **Collaborative hunt filtering** — recommend techniques that succeeded on the most similar past hunts measured by asset and stack embeddings.
0088. **Cold-start starter packs** — serve a default fifteen-minute technique sequence for unseen stacks built from global success rates to guarantee early coverage.
0089. **Vertical-conditioned playbooks** — switch recommended technique sets by industry vertical based on historical win rates per vertical.
0090. **Scope-size technique scaling** — adjust recommended technique depth by scope size since historically large scopes reward breadth-first automation over deep manual chains.
0091. **Program-maturity tactic selector** — pick stealthy versus aggressive technique mixes based on the program's historical response to scan intensity.
0092. **First-finding fast-path engine** — order the opening technique sequence by historical time-to-first-finding to surface wins as early as possible.
0093. **Effort-yield technique ranking** — rank techniques by historical findings-per-minute to allocate the scan budget where it historically paid off.
0094. **Novelty-bonus scheduler** — periodically inject historically under-tested techniques to avoid the local optimum of only repeating past winners.
0095. **Technique fatigue detection** — retire techniques whose success rate decayed over recent hunts, signaling patched vuln classes or stale payloads.
0096. **Conditional technique chaining** — when technique A succeeds, auto-suggest technique B using historical A-to-B transition probabilities.
0097. **Stack-drift re-recommendation** — recompute technique rankings mid-hunt when newly discovered assets change the target's stack fingerprint.
0098. **Confidence-weighted recommendations** — blend historical success rates with current-hunt evidence strength so recommendations update as findings land.
0099. **Hunter-override learning** — record when hunters reject a recommendation to down-weight that technique for similar future contexts.
0100. **Recommendation explanation traces** — attach the historical hunts behind each recommendation so hunters can audit why a technique was suggested.
0101. **Multi-armed bandit scan scheduler** — treat scan modules as bandit arms and allocate requests by upper-confidence-bound scores updated from live hit rates.
0102. **Thompson sampling module picker** — sample module success posteriors per hunt to balance exploiting proven modules with exploring uncertain ones.
0103. **Contextual bandit with stack features** — condition bandit arm selection on tech-stack features so exploration adapts to the target in front of it.
0104. **Budget-aware technique planner** — solve a knapsack over techniques using historical cost and yield to maximize expected findings within the request budget.
0105. **Diminishing-returns cutoff** — stop a technique when its marginal hit rate falls below the historical floor for that technique on similar targets.
0106. **Parallel-technique portfolio** — run historically uncorrelated techniques concurrently since their joint coverage historically beats sequential depth.
0107. **Technique synergy scoring** — prioritize technique pairs whose historical co-occurrence in successful hunts exceeds chance, indicating complementary coverage.
0108. **Time-boxed technique sprints** — allocate fixed time boxes per technique sized from historical time-to-first-finding distributions.
0109. **Early-exit triggers** — abort a technique early when live signals match historical failure signatures, saving budget for higher-yield techniques.
0110. **Late-bloom technique memory** — remember techniques that historically pay off only after long runs and protect their budget from early cuts.
0111. **Cross-hunt technique transfer** — import technique rankings from hunts on sibling subdomains of the same organization.
0112. **Adversarial technique rotation** — rotate technique order per hunt using historical detection data to avoid triggering the target's anomaly baselines.
0113. **Seasonal technique weighting** — up-weight techniques tied to recently disclosed CVE classes since historical data shows fresh vuln classes cluster in time.
0114. **Vendor patch-lag exploitation** — prioritize techniques for vendors with historically slow patch cycles where old payloads keep working longer.
0115. **Geo-conditioned technique selection** — adjust techniques by target hosting region using historical success differences across providers and locales.
0116. **Authentication-state technique split** — maintain separate technique rankings for authenticated versus unauthenticated contexts from historical outcomes.
0117. **User-role technique matrix** — rank techniques per role (admin, user, guest) using historical privilege-specific win rates.
0118. **Mobile-backend technique pack** — load a dedicated technique ranking for mobile API backends derived from historical mobile-hunt outcomes.
0119. **GraphQL-target technique pack** — use a GraphQL-specific ranking built from past GraphQL hunts instead of generic API techniques.
0120. **Legacy-stack technique pack** — switch to legacy-focused techniques when fingerprinting detects historically vulnerable old stacks.
0121. **SPA versus MPA technique routing** — route technique selection by app architecture since historical win rates differ sharply between SPAs and server-rendered apps.
0122. **Microservice technique fan-out** — prioritize service-mesh and inter-service techniques when architecture signals indicate microservices, per historical data.
0123. **Serverless technique pack** — load serverless-specific techniques ranked by past serverless hunt outcomes.
0124. **CI/CD-adjacent technique pack** — prioritize pipeline-adjacent techniques when dev-tooling subdomains appear, based on historical pivot success.
0125. **IoT-backend technique pack** — switch rankings for IoT cloud backends using historical IoT-adjacent web findings.
0126. **Recommendation drift alerts** — notify when live hunt results diverge from historical recommendations, signaling a novel target or stale model.
0127. **Counterfactual technique logging** — log which techniques were not chosen and why, enabling offline evaluation of the recommender against historical hunts.
0128. **Offline recommender replay** — replay past hunts through new ranking models to measure improvement before deploying ranking changes.
0129. **Per-program technique blacklists** — auto-exclude techniques that historically caused incidents or bans on a given program.
0130. **Technique prerequisite graph** — only recommend advanced techniques after their historical prerequisites are satisfied in the current hunt.
0131. **HackerOne Hacktivity ingestion** — parse disclosed HackerOne reports into structured technique records with affected stack and impact for recommendation training.
0132. **Bugcrowd disclosure mining** — extract techniques, payloads, and bounty amounts from Bugcrowd disclosures to weight techniques by real-world payout.
0133. **Medium writeup technique extraction** — mine security blogs for novel technique descriptions and convert them into testable hunt procedures.
0134. **Researcher thread mining** — extract payload snippets and bypass tricks from researcher social threads into the payload effectiveness ledger.
0135. **CVE-to-technique mapping** — map new CVEs to the hunt techniques that would have caught them, keeping technique coverage aligned with disclosed vulns.
0136. **Conference slide mining** — extract attack techniques from published talk slides and transcribe them into step-by-step test cases.
0137. **CTF writeup harvesting** — convert CTF writeups into simplified technique seeds since CTF tricks often precede real-world adoption.
0138. **Academy lab mapping** — map Web Security Academy topics to hunt techniques to guarantee methodology coverage of known vuln classes.
0139. **GitHub PoC repository mining** — scan public PoC repos for fresh exploit patterns and convert them into safe, controlled test payloads.
0140. **Exploit-DB technique tagging** — tag Exploit-DB entries by technique and stack to auto-suggest relevant checks when that stack is fingerprinted.
0141. **Pentest methodology extraction** — extract methodology checklists from sanitized public pentest reports to fill coverage gaps in the hunt plan.
0142. **Technique first-seen dating** — timestamp every technique's first observation in the wild to prioritize recently emerged attack classes.
0143. **Attack-chain extraction from writeups** — parse multi-step writeups into ordered chain templates for the chain-pattern miner.
0144. **Bounty payout technique weighting** — weight techniques by median historical payout so the agent chases high-value vuln classes first.
0145. **Researcher style profiling** — profile top researchers' technique preferences from their writeups to diversify the agent's playbook beyond its own history.
0146. **Technique-of-the-month digest** — compile monthly emerging techniques from intel feeds into a review queue for playbook updates.
0147. **Deduplicated technique database** — maintain one canonical record per technique with merged evidence from all mined sources to avoid duplicate test logic.
0148. **Vendor advisory ingestion** — parse vendor security advisories into fingerprint-gated checks that fire only on affected versions.
0149. **Threat-actor TTP mapping** — map initial-access TTPs to external attack-surface checks the agent can safely run.
0150. **Exploit chatter monitoring** — track exploit marketplace chatter for the target's stack to preemptively test newly traded vectors.
0151. **Patch-diff technique derivation** — derive new test variations from vendor patch diffs that reveal the exact flaw class being fixed.
0152. **Regression-test pairing** — pair each mined technique with its vendor regression test to build self-verifying checks.
0153. **Technique difficulty grading** — grade mined techniques by required skill and prerequisites so the planner sequences them sensibly.
0154. **Writeup-to-payload compiler** — convert natural-language payload descriptions in writeups into executable, safely-scoped test payloads.
0155. **Intel contradiction resolution** — flag when two writeups disagree on a technique's effectiveness and test both variants to resolve it empirically.
0156. **Stale technique sunset** — retire mined techniques with no observed success in twelve months to keep the playbook lean and current.
0157. **Non-English writeup mining** — mine non-English writeups for techniques underrepresented in English sources.
0158. **Video walkthrough transcription** — transcribe hacking walkthrough videos into technique steps for the playbook.
0159. **Podcast intel extraction** — extract technique mentions from security podcasts into candidate test ideas for review.
0160. **Newsletter technique harvesting** — parse security newsletters into structured technique candidates.
0161. **Academic paper transfer** — convert usable ideas from web-security research papers into practical hunt checks.
0162. **Platform trend-report ingestion** — ingest bounty platform annual reports to shift technique investment toward rising vuln categories.
0163. **Zero-day writeup fast-track** — fast-track techniques from zero-day writeups into the playbook within twenty-four hours of disclosure.
0164. **Technique provenance tracking** — record every technique's source writeup so hunters can read the original research behind a test.
0165. **Intel confidence scoring** — score mined techniques by source reliability and corroboration count before they enter autonomous rotation.
0166. **Playbook diff viewer** — show hunters exactly which techniques were added or retired each week with their intel provenance.
0167. **Technique request voting** — let hunters upvote mined technique candidates to prioritize playbook additions by practitioner demand.
0168. **Duplicate writeup clustering** — cluster writeups describing the same underlying technique to avoid inflating its perceived novelty.
0169. **Exploit-variant family trees** — build family trees of payload variants from writeups to systematically test each branch.
0170. **Technique decay modeling** — model how a technique's real-world success decays after disclosure to time its use before patches land.
0171. **Patch-lag measurement** — measure days from disclosure to mass patching per vendor to schedule technique deployment inside the window.
0172. **Writeup stack-coverage audit** — audit which stacks lack writeup coverage and commission targeted research to fill the gaps.
0173. **Technique-to-engine mapping** — map each mined technique to the engine that should implement it, preventing orphan techniques.
0174. **Intel-driven scope expansion** — suggest scope additions when intel shows the target's stack is hit by a trending technique class.
0175. **Retired-technique archive** — keep retired techniques searchable with their sunset reason so they can be revived if the vuln class resurfaces.
0176. **Confirmed-FP fingerprint registry** — hash confirmed false positives by finding signature so identical future findings auto-suppress with the original verdict.
0177. **Per-endpoint FP memory** — remember endpoints that historically produced FPs and pre-mark their findings for review.
0178. **Finding-hash dedup across hunts** — dedup findings by stable content hash across hunts so the same FP never gets reported twice to the same program.
0179. **FP reason taxonomy learning** — classify FP causes and learn per-cause suppression rules from hunter verdicts.
0180. **Scanner-specific FP profiles** — track FP rates per detection module so high-FP modules get extra verification steps before reporting.
0181. **Error-page SQLi mimic memory** — remember apps whose error pages contain SQL keywords to stop flagging their generic 500s as injection.
0182. **Reflective-but-encoded FP table** — learn reflection contexts that look vulnerable but are safely encoded to suppress the whole class per template engine.
0183. **Intentional-behavior FP list** — record features hunters confirmed as intended to never re-flag them per program.
0184. **Test-pollution FP tagging** — tag findings caused by the agent's own test data so they never enter the report pipeline.
0185. **FP decay on code change** — expire FP suppressions when the endpoint's code fingerprint changes since the FP verdict may no longer hold.
0186. **Cross-program FP sharing** — share anonymized FP patterns across programs so a known scanner artifact is suppressed everywhere.
0187. **FP appeal learning** — learn from hunter-overturned FP verdicts to tighten the suppression rules that wrongly fired.
0188. **Near-miss FP memory** — record findings that were almost FPs to calibrate the verification steps that correctly caught them.
0189. **FP-prone parameter list** — maintain parameters that historically generate FPs and require stronger proof before flagging.
0190. **FP-prone header list** — track headers whose reflection historically produced FPs to raise the evidence bar for header-injection findings.
0191. **Timing-FP baseline memory** — remember endpoints with historically jittery response times to avoid flagging their variance as time-based injection.
0192. **WAF-block FP filtering** — learn WAF block page signatures per target to stop misclassifying blocks as successful exploitation.
0193. **Captcha-page FP suppression** — recognize CAPTCHA interstitials so blocked-scan artifacts never become findings.
0194. **Login-wall FP memory** — remember authenticated-only endpoints probed anonymously to avoid reporting auth-gated errors as vulns.
0195. **Rate-limit FP classification** — classify rate-limit responses distinctly so throttling is never reported as a vulnerability.
0196. **Maintenance-page FP filter** — detect maintenance-mode pages and pause finding generation until the app returns to normal.
0197. **Honeypot FP exclusion** — exclude findings from confirmed honeypot endpoints that exist to trap scanners.
0198. **Staging-versus-prod FP split** — keep separate FP memories for staging and production since their intended behaviors differ.
0199. **FP confidence calibration** — track suppression precision over time and auto-tighten rules whose precision drops.
0200. **FP feedback loop interface** — surface suppressed FPs with one-click overturn so hunter corrections continuously retrain the memory.
0201. **Cross-hunt FP lineage** — link recurring FPs across hunts on the same program to show hunters the full suppression history.
0202. **FP pattern generalization** — generalize a confirmed FP into a rule covering its sibling endpoints automatically.
0203. **Vendor-default FP catalog** — catalog vendor default pages that mimic vulns for instant suppression.
0204. **Framework-debug FP memory** — remember framework debug toolbars and error pages per stack to suppress their artifact findings.
0205. **FP severity downgrade rules** — learn findings that are real but historically low-impact and auto-downgrade rather than suppress.
0206. **Duplicate-report FP merging** — merge near-duplicate findings into one canonical record with all observed instances attached.
0207. **FP export for scanners** — export learned FP rules in scanner-native formats so external tools benefit from the memory.
0208. **FP memory audit trail** — keep an immutable log of every suppression with reason and evidence for hunter review.
0209. **FP cold-start defaults** — ship global FP rules learned across all hunts so new programs benefit from day one.
0210. **FP resurrection alerts** — alert when a suppressed FP's endpoint starts behaving differently, suggesting the underlying issue became real.
0211. **Persistent domain tech fingerprint** — store each domain's full stack fingerprint across hunts to detect changes and reuse past technique rankings.
0212. **Stack-change detection alerts** — diff the current fingerprint against the stored profile and alert hunters to added or removed technologies.
0213. **Historical finding ledger per asset** — keep every past finding per asset so repeat hunts start from known weaknesses and verify fixes.
0214. **Subdomain genealogy tracking** — record parent-child and alias relationships between subdomains to transfer learnings across the asset family.
0215. **Acquired-asset inheritance** — when a company acquires a domain, inherit its tech profile and finding history for continuity.
0216. **Deprecated-tech watchlist per target** — flag targets still running historically vulnerable end-of-life software for priority retesting.
0217. **CDN/WAF change alerts** — detect CDN or WAF vendor swaps between hunts since they invalidate old evasion playbooks.
0218. **Framework version drift tracking** — track framework version drift across hunts to auto-queue version-specific checks on upgrade or downgrade.
0219. **Third-party script inventory memory** — remember third-party scripts per target to spot newly added supply-chain risk between hunts.
0220. **DNS history memory** — store historical DNS records per domain to detect infrastructure moves that change the attack surface.
0221. **Certificate history ledger** — track certificate issuers and SANs over time to spot new subdomains from certificate changes.
0222. **Tech-profile confidence scoring** — score fingerprint confidence from corroborating signals so low-confidence profiles trigger deeper verification.
0223. **Shadow-IT asset memory** — remember previously discovered shadow-IT assets so they stay in scope across hunts even when DNS changes.
0224. **Decommissioned-asset pruning** — prune assets that consistently disappear across hunts to keep the profile focused on live surface.
0225. **Asset criticality memory** — learn per-asset criticality from past finding impact to prioritize high-value assets first.
0226. **Auth-surface evolution tracking** — track login and SSO endpoint changes across hunts since auth refactors historically introduce fresh vulns.
0227. **API version memory** — remember discovered API versions per target to detect deprecated-but-live versions that historically harbor vulns.
0228. **Mobile-app version tracking** — track app releases per target to queue fresh testing when a new version ships.
0229. **JS bundle change detection** — hash JS bundles between hunts and deep-dive only the changed bundles for new endpoints and secrets.
0230. **Discovery-file change memory** — diff robots.txt and sitemaps across hunts to catch newly exposed paths.
0231. **Header security posture history** — track security header drift over time to spot regressions like a dropped CSP.
0232. **TLS configuration history** — remember TLS scan results per host to alert on newly weakened cipher configurations.
0233. **Open-port history per host** — diff open ports across hunts to catch newly exposed services.
0234. **Cloud-asset mapping memory** — remember cloud resources attributed to the target to detect new buckets or instances between hunts.
0235. **Portal redesign tracking** — watch login and account portals for redesigns that historically reset auth vulnerabilities.
0236. **M&A surface merging** — merge tech profiles when two hunted companies merge to unify the attack-surface view.
0237. **Rebrand domain linking** — link old and new brand domains so finding history survives corporate rebrands.
0238. **Wildcard-scope asset memory** — remember which wildcard subdomains were actually live to avoid rescanning dead space.
0239. **Out-of-scope change alerts** — alert when previously out-of-scope assets move into scope via acquisition or DNS change.
0240. **Tech-profile sharing controls** — let hunters control which profile data is shared across programs to respect confidentiality boundaries.
0241. **Profile staleness scoring** — score how outdated a stored profile is and trigger refresh recon when it exceeds the threshold.
0242. **Multi-program asset dedup** — dedup assets appearing in multiple programs so findings and history stay unified.
0243. **Asset ownership inference** — infer asset owners from historical WHOIS, certificate, and contact patterns to route findings correctly.
0244. **Parked-domain memory** — remember parked domains per target to skip them until they become active.
0245. **Tech-profile export** — export a target's full tech profile as a portable file for offline review and team handoff.
0246. **Chain sequence mining** — mine successful hunts for ordered technique triples and suggest the next step when the first two match the current hunt.
0247. **Markov technique-transition model** — build a Markov model of technique transitions from hunt histories to predict the most likely productive next move.
0248. **Foothold-to-pivot suggestion engine** — when a low-severity foothold lands, suggest historically successful pivot techniques from the same foothold type.
0249. **Privilege-escalation path memory** — record privilege-escalation paths that worked per stack to chain low-severity findings into high-impact reports.
0250. **Token-reuse chain patterns** — learn how leaked tokens historically chained into further access and auto-attempt the chain.
0251. **Subdomain-takeover chain memory** — record post-takeover chains to maximize the demonstrated impact of takeovers.
0252. **XSS-to-account-takeover playbooks** — mine stored-XSS to session-theft chains to auto-build the full account-takeover narrative from an XSS finding.
0253. **SSRF-to-cloud-metadata chains** — remember SSRF to metadata to credential chains per cloud provider to auto-escalate SSRF findings.
0254. **IDOR chaining patterns** — learn IDOR-to-IDOR sequences from past hunts where one endpoint enabled exploitation of another.
0255. **Auth-bypass chain memory** — record multi-step auth bypasses as reusable chain templates.
0256. **File-upload-to-RCE chain ledger** — track upload-bypass to execution chains per stack to auto-complete the path from upload to shell.
0257. **SQLi-to-RCE escalation memory** — remember SQLi to OS-command paths per database to escalate injection findings automatically.
0258. **XXE-to-SSRF chain patterns** — learn XXE out-of-band chains that historically exfiltrated files for instant replay on similar parsers.
0259. **Open-redirect OAuth-theft chains** — record redirect to token-theft chains per OAuth implementation to complete the impact narrative.
0260. **CSRF-to-state-change chains** — mine CSRF findings that chained into account changes to prioritize CSRF on state-changing endpoints.
0261. **Cache-poisoning chain memory** — record poison to victim-impact chains per cache layer to demonstrate real impact from cache deception.
0262. **Pollution-to-XSS chain ledger** — learn prototype-pollution to execution gadget chains per library to auto-complete the exploit path.
0263. **JWT-confusion chain patterns** — record algorithm-confusion to privilege-escalation chains per implementation for instant replay.
0264. **CORS-to-data-theft chains** — mine CORS misconfigurations that historically chained into credential theft.
0265. **GraphQL chain patterns** — learn introspection to mutation-abuse chains per GraphQL implementation.
0266. **API-doc chaining memory** — remember how exposed API docs historically led to chained endpoint abuse.
0267. **Business-logic chain mining** — extract multi-step logic-abuse sequences from past findings.
0268. **Race-condition chain patterns** — learn race windows that historically chained into double-spend or state corruption.
0269. **Chain success-rate scoring** — score each mined chain by historical completion rate to prioritize chains that usually finish.
0270. **Chain length optimization** — learn the optimal chain depth per target type since overly long chains historically fail more often.
0271. **Dead-end chain pruning** — prune chain branches that historically dead-end to keep the search focused on productive paths.
0272. **Chain precondition checking** — verify each chain step's preconditions from current-hunt evidence before attempting the next step.
0273. **Parallel chain exploration** — explore multiple mined chains concurrently when they share the same foothold.
0274. **Chain evidence packaging** — auto-assemble the full multi-step evidence trail into a single coherent proof for the report.
0275. **Novel chain discovery rewards** — boost exploration of untested technique pairs since historical data shows novel chains yield the highest bounties.
0276. **Chain replay on sibling assets** — replay a completed chain on sibling subdomains where the same stack historically repeats the flaw.
0277. **Chain time-to-complete stats** — track how long chains take to complete to budget autonomous hunt time realistically.
0278. **Partial-chain salvage** — when a chain breaks mid-way, save the partial progress as standalone findings instead of discarding it.
0279. **Chain variant generation** — mutate successful chains by swapping equivalent steps to discover variant paths around fixed steps.
0280. **Cross-hunter chain sharing** — share anonymized successful chains across hunters so everyone benefits from discovered paths.
0281. **Chain defense mapping** — map each mined chain to its defensive mitigations so reports include precise remediation per step.
0282. **Chain impact amplification scoring** — score chains by combined impact to prioritize demonstrating full chains over isolated lows.
0283. **Chain detection-evasion memory** — remember which chains historically triggered defenses to prefer stealthier equivalent paths.
0284. **Chain documentation auto-generation** — generate step-by-step chain documentation from the execution trace for the report.
0285. **Chain regression testing** — re-run previously completed chains on retests to verify each step's fix, not just the final outcome.
0286. **Time-to-first-finding percentiles** — compute TTF distributions per vertical and stack to benchmark live hunt pacing.
0287. **Pacing deviation alerts** — alert hunters when a hunt's finding rate drops below the historical percentile for similar targets.
0288. **Session heatmap learning** — learn which hunt phases historically produce findings to rebalance time allocation.
0289. **Optimal hunt-duration stats** — model finding-rate decay over hunt duration to recommend when to wrap up versus push deeper.
0290. **Fatigue-aware break prompts** — suggest breaks when session patterns match historical fatigue-linked error spikes.
0291. **Finding-burst detection** — recognize the historical pattern of finding bursts after specific recon milestones and protect that workflow.
0292. **Slow-start recovery playbooks** — when TTF exceeds the historical median, auto-switch to the recovery playbook that historically rescued slow hunts.
0293. **Vertical TTF benchmarking** — compare a hunt's TTF against the vertical benchmark to set realistic expectations per engagement.
0294. **Technique-level TTF tracking** — track TTF per technique to front-load the techniques that historically find fast.
0295. **First-finding type prediction** — predict the most likely first-finding class from the target fingerprint to focus opening moves.
0296. **Hunt velocity dashboards** — show live velocity versus historical percentiles so hunters can see if they are ahead or behind.
0297. **Milestone-based pacing** — define recon, mapping, and testing milestones from historical data and track progress against them.
0298. **Diminishing-returns detection** — detect when the finding rate decays to the historical stop threshold and recommend pivoting.
0299. **Overtime value modeling** — model expected findings per extra hour from historical data to justify or cut extended hunts.
0300. **Post-hunt TTF retrospectives** — auto-generate pacing retrospectives comparing the hunt against historical benchmarks.
0301. **Quiet-period interpretation** — learn that historical quiet periods often precede major findings and avoid premature technique switching.
0302. **Finding-drought interventions** — trigger a curated intervention checklist when drought length exceeds historical norms for the target type.
0303. **Peak-hour scheduling** — learn which hours historically yield the most findings per hunter and suggest scheduling deep work then.
0304. **Multi-session TTF stitching** — stitch TTF metrics across paused and resumed sessions so pacing analysis survives hunt interruptions.
0305. **TTF by scope-size curves** — model how TTF scales with scope size to set per-engagement expectations.
0306. **TTF by program maturity** — track how TTF differs between new and heavily-hunted programs to calibrate opening strategy.
0307. **False-start detection** — recognize historical false-start patterns and recommend a methodology reset early.
0308. **Momentum scoring** — compute a live momentum score from recent finding velocity versus historical baselines.
0309. **Hunt-comparison reports** — compare pacing across a hunter's recent hunts to surface personal productivity patterns.
0310. **TTF prediction at kickoff** — predict expected TTF from the target fingerprint before the hunt starts for planning.
0311. **Thompson-sampling module scheduler** — allocate scan budget across modules by sampling from each module's historical success posterior.
0312. **UCB-based probe ordering** — order individual probes by upper-confidence-bound scores combining historical yield and uncertainty.
0313. **Contextual bandits with live features** — condition arm selection on live fingerprint features so ordering adapts mid-hunt.
0314. **Likely-winner-first sequencing** — run the historically top-yielding checks for the detected stack before generic coverage.
0315. **Dynamic reordering on evidence** — re-sort the remaining queue when new evidence changes historical yield estimates.
0316. **Exploration-budget guardrails** — reserve a fixed exploration fraction so adaptive ordering never fully starves novel techniques.
0317. **Cold-start ordering defaults** — use global historical rankings until enough hunt-specific data accumulates to personalize.
0318. **Per-phase ordering policies** — use different ordering strategies for recon, mapping, and testing phases based on historical phase yields.
0319. **Failure-triggered reordering** — when a module fails historically-predicted checks, demote its siblings and promote alternatives.
0320. **Success-triggered deepening** — when a module hits, immediately promote its historically correlated follow-ups to the front.
0321. **Request-budget optimizer** — distribute the request budget across modules proportionally to historical findings-per-request.
0322. **Time-budget optimizer** — allocate minutes per module from historical minutes-per-finding curves.
0323. **Parallel-lane scheduling** — run historically independent modules in parallel lanes to compress wall-clock time.
0324. **Dependency-aware sequencing** — respect historical prerequisite orderings in the adaptive queue.
0325. **Stealth-weighted ordering** — blend historical yield with historical detection risk to order stealthy high-yield checks first on sensitive programs.
0326. **Auth-state queue splitting** — maintain separate adaptive queues for unauthenticated and authenticated contexts.
0327. **Reorder explanation logs** — log why the queue reordered so hunters can see which historical signal fired.
0328. **Manual pin and override support** — let hunters pin techniques to the front while the learner adapts around the constraint.
0329. **Ordering A/B testing** — A/B test ordering policies across hunts and keep the winner by measured findings-per-hour.
0330. **Regret minimization tracking** — track the gap between the adaptive order and the optimal hindsight order to improve the policy.
0331. **Multi-objective ordering** — jointly optimize for findings, coverage, and stealth using historical Pareto data.
0332. **Deadline-aware compression** — when hunt time runs short, compress the queue to historically highest-yield checks only.
0333. **Checkpointed queue state** — persist the adaptive queue so paused hunts resume with learned ordering intact.
0334. **Queue starvation alarms** — alert when a module has not run for historically too long, preventing silent starvation.
0335. **Ordering policy versioning** — version ordering policies so hunts can pin a known-good policy for reproducibility.
0336. **Asset-vuln-technique knowledge graph** — build a persistent graph linking assets, historical findings, and successful techniques for traversal queries.
0337. **Graph-based next-target suggestion** — suggest the next asset to test by graph proximity to historically productive assets.
0338. **Embedding similarity search** — embed asset fingerprints and retrieve the most similar past assets with their winning techniques.
0339. **Centrality-based prioritization** — prioritize assets with high graph centrality since they historically bridge to the most findings.
0340. **Blast-radius graph analysis** — traverse the graph from a finding to show hunters the full reachable impact surface.
0341. **Two-hop admin-panel queries** — answer which assets sit two hops from an admin panel using stored relationship edges.
0342. **Shared-infrastructure clustering** — cluster assets by shared IPs, certificates, and code to transfer technique success within clusters.
0343. **Vendor-component graph nodes** — add third-party components as graph nodes so a vuln in one component flags all assets using it.
0344. **Technology-stack subgraphs** — maintain per-stack subgraphs showing which techniques historically worked on that stack.
0345. **Temporal graph versioning** — version the graph over time so hunters can query what the surface looked like last quarter.
0346. **Graph-driven scope suggestions** — propose scope additions for assets densely connected to in-scope productive assets.
0347. **Finding-propagation prediction** — predict which connected assets likely share a finding's root cause using graph diffusion.
0348. **Technique-coverage graph overlay** — overlay technique coverage on the asset graph to visualize untested regions.
0349. **Graph anomaly detection** — flag assets whose graph position changed abruptly for priority review.
0350. **Cross-program graph linking** — link the same company's assets across programs while respecting data-isolation rules.
0351. **Natural-language graph queries** — let hunters ask graph questions in plain language translated to traversals.
0352. **Shortest-path exploit planning** — compute the shortest technique path from entry asset to crown-jewel asset using historical edge weights.
0353. **Graph-based deduplication** — merge findings that the graph shows as the same root cause on different assets.
0354. **Community detection for campaigns** — detect asset communities that historically get hunted as one campaign unit.
0355. **Edge-weight learning** — learn edge weights from historical traversal success so path queries improve over time.
0356. **Graph export for reports** — export relevant subgraphs as visuals showing attack paths in the final report.
0357. **Stale-edge pruning** — prune edges that have not been corroborated in recent hunts to keep the graph trustworthy.
0358. **Graph-backed hunter onboarding** — show new hunters the target's graph so they absorb months of accumulated context instantly.
0359. **Federated graph queries** — query across hunters' graphs with privacy controls to find global patterns without exposing raw data.
0360. **Crown-jewel path monitoring** — continuously watch the graph paths to crown-jewel assets and alert when new edges shorten them.
0361. **Target similarity scoring** — score new targets against past hunts by stack, vertical, and size to import the most relevant learnings.
0362. **Zero-shot technique transfer** — apply techniques that worked on similar targets immediately, without waiting for local evidence.
0363. **Few-shot payload adaptation** — adapt payloads to a new target using a handful of probe responses plus similar-target history.
0364. **Sibling-subdomain transfer** — transfer technique rankings between subdomains of the same organization automatically.
0365. **Same-vendor transfer** — transfer finding patterns between different companies running the same vendor stack.
0366. **Vertical transfer packs** — package learnings per vertical for instant application to new vertical targets.
0367. **Framework-version transfer** — transfer payload effectiveness across minor framework versions with confidence decay by version distance.
0368. **Cloud-provider transfer** — transfer cloud-misconfiguration techniques between targets on the same provider.
0369. **WAF-vendor transfer** — transfer evasion playbooks between targets behind the same WAF vendor.
0370. **Negative-transfer guardrails** — detect when transferred techniques underperform and automatically fall back to target-specific learning.
0371. **Transfer confidence scoring** — score each transferred recommendation by source-target similarity so hunters see the basis.
0372. **Domain-adjacent learning** — learn from adjacent domains with appropriate data-isolation controls.
0373. **Cross-language stack transfer** — transfer technique insights between equivalent stacks in different languages.
0374. **Time-decayed transfer** — decay transferred knowledge by age since stack evolution erodes old learnings.
0375. **Transfer audit trails** — log which past hunts influenced current recommendations for transparency.
0376. **Meta-learned initialization** — meta-learn initial technique priors across all hunts so new hunts start smarter than any single source.
0377. **Transfer-driven cold start** — eliminate the cold-start problem by initializing every hunt from the most similar past hunts.
0378. **Counterfactual transfer evaluation** — measure whether transferred techniques actually outperformed defaults to refine similarity metrics.
0379. **Selective transfer filters** — transfer only techniques with sufficient evidence, avoiding one-off flukes polluting new hunts.
0380. **Transfer learning dashboards** — visualize which past hunts are currently influencing the active hunt's strategy.
0381. **Per-hunter technique affinity** — learn each hunter's most successful techniques and weight personal recommendations toward them.
0382. **Aggressive-versus-quiet style tuning** — infer a hunter's preferred scan intensity from past behavior and default new hunts to match.
0383. **Preferred vuln-class weighting** — boost the vuln classes a hunter historically pursues and reports successfully.
0384. **Notification cadence learning** — learn when a hunter wants alerts versus digests from their interaction patterns.
0385. **UI ordering by habit** — reorder dashboards and queues by the hunter's historical usage patterns.
0386. **Working-hours adaptation** — schedule autonomous activity around each hunter's historical active hours.
0387. **Report-style personalization** — learn each hunter's preferred report tone, depth, and structure from past edits.
0388. **Strength-based task routing** — in team hunts, route subtasks to hunters whose history shows strength in that technique.
0389. **Weakness-targeted practice** — identify a hunter's historically weak areas and suggest focused practice hunts.
0390. **Personal TTF baselines** — benchmark hunters against their own history rather than global averages for fairer pacing feedback.
0391. **Preferred evidence formats** — learn whether a hunter prefers screenshots, videos, or text logs and default evidence capture accordingly.
0392. **Language preference memory** — remember each hunter's preferred working language for chat, plans, and reports.
0393. **Risk-tolerance profiling** — infer risk tolerance from past technique choices and gate aggressive techniques accordingly.
0394. **Learning-goal tracking** — track a hunter's stated learning goals and bias recommendations toward techniques that teach them.
0395. **Mentorship matching** — match junior hunters with seniors whose historical strengths complement the junior's gaps.
0396. **Personal playbook export** — export each hunter's learned playbook as a portable personal methodology document.
0397. **Style-drift detection** — detect when a hunter's behavior shifts and adapt personalization accordingly.
0398. **Privacy-preserving personalization** — keep personalization models per-user with strict isolation from other hunters' data.
0399. **Personal retrospective generator** — generate per-hunter retrospectives showing skill growth across hunts.
0400. **Onboarding personalization** — tailor new-hunter onboarding using the technique affinities of similar experienced hunters.
0401. **Post-hunt retrospective generator** — auto-generate a critique of what the hunt missed by comparing coverage against the methodology matrix.
0402. **Red-team blue-team self-debate** — pit two internal agents (attacker versus defender) to stress-test each finding before it becomes a report.
0403. **Missed-vector backtesting** — replay the hunt's recon data through the full technique list offline to find vectors the live hunt skipped.
0404. **Devil's-advocate finding review** — assign an internal critic to argue each finding is a false positive, strengthening the survivors.
0405. **Coverage self-audit** — audit the hunt trace against the target's attack-surface inventory and list untested areas.
0406. **Strategy regret analysis** — compute which untested techniques would likely have paid off using historical data and feed it to the planner.
0407. **Payload diversity audit** — check whether the hunt over-relied on a narrow payload family and diversify next time.
0408. **Assumption challenging** — list the hunt's implicit assumptions and design tests to falsify each one.
0409. **Peer-hunt comparison critique** — compare the hunt's coverage against similar past hunts and flag systematically skipped areas.
0410. **Finding-quality self-scoring** — score each finding's evidence strength before human review and rework the weak ones autonomously.
0411. **Blind-spot pattern mining** — mine the agent's own miss history for recurring blind spots.
0412. **Critic-model fine-tuning** — fine-tune the internal critic on hunter-overturned findings so its objections match expert judgment.
0413. **Pre-report adversarial review** — run a final adversarial pass over the draft report attacking every claim's evidence.
0414. **Plan-versus-execution diff** — diff the planned methodology against what actually ran and explain every deviation.
0415. **Continuous self-improvement log** — maintain a persistent log of self-critique lessons that the planner must consult before each hunt.
0416. **Vertical coverage matrices** — maintain per-vertical methodology checklists and flag untested boxes.
0417. **Systematic-gap alerts** — alert hunters when their history shows a systematic gap such as never testing WebSockets on fintech targets.
0418. **Vuln-class coverage heatmaps** — visualize technique coverage per vuln class across recent hunts to spot neglected areas.
0419. **OWASP mapping audit** — map hunt activity to OWASP categories and flag categories with zero coverage.
0420. **API coverage completeness** — track which discovered API endpoints received security testing versus mere crawling.
0421. **Auth-matrix completeness** — verify every role-by-endpoint combination was tested using the authorization matrix.
0422. **Input-vector inventory** — inventory every input vector and track which received injection testing.
0423. **JavaScript coverage tracking** — track which JS-discovered endpoints and sinks were actually tested.
0424. **Subdomain coverage scoring** — score what fraction of live subdomains received meaningful testing beyond port scans.
0425. **Depth-versus-breadth balance alerts** — warn when a hunt goes too deep on one asset while siblings remain untouched, per historical optima.
0426. **Checklist-driven gap closure** — auto-generate the minimal checklist that would close the hunt's coverage gaps.
0427. **Coverage-weighted risk scoring** — weight uncovered areas by historical finding rates so gaps in risky areas shout loudest.
0428. **Methodology version tracking** — version the methodology checklist and show which hunts ran against which version.
0429. **Gap-trend analysis** — track whether coverage gaps are shrinking across hunts as the agent learns.
0430. **Mandatory-minimum coverage gates** — block hunt completion until historically critical checks all ran.
0431. **CVE-class trend ingestion** — track which vuln classes dominate new CVEs each quarter and shift technique investment accordingly.
0432. **Exploit-kit trend monitoring** — monitor which exploit kits trend in the wild to prioritize the vuln classes they target.
0433. **Conference-season technique spikes** — expect technique spikes after major conferences and pre-load the demonstrated techniques.
0434. **Patch-Tuesday response routines** — auto-generate checks for Patch-Tuesday disclosures affecting the active hunt's stack within twenty-four hours.
0435. **Framework-release radar** — watch framework releases for security-relevant changes and generate targeted checks immediately.
0436. **Browser-change adaptation** — adapt XSS and client-side techniques when browser releases change security behaviors.
0437. **Cloud-service launch tracking** — generate misconfiguration checks for newly launched cloud services before hunters encounter them.
0438. **AI-feature trend adaptation** — track the spread of AI features and grow the AI-specific technique set accordingly.
0439. **Regulatory-driven technique shifts** — adapt techniques when new regulations change what is testable.
0440. **Seasonal attack-pattern memory** — learn seasonal patterns for timely technique selection.
0441. **Trend half-life modeling** — model how fast trending techniques decay to time their deployment inside the effective window.
0442. **Hype-versus-substance scoring** — score trending techniques by actual historical yield to avoid chasing hype with no findings.
0443. **Emerging-stack early coverage** — build technique packs for emerging frameworks before they become common targets.
0444. **Trend-driven retraining triggers** — trigger model retraining when trend data shows the technique distribution has shifted.
0445. **Annual threat-landscape realignment** — realign the whole methodology yearly against aggregated threat-landscape data.
0446. **Hunter-feedback calibration curves** — plot predicted confidence versus hunter-confirmed accuracy and recalibrate scoring to match.
0447. **Reliability diagrams per module** — maintain per-module reliability diagrams so hunters see which modules' confidence to trust.
0448. **Overconfidence penalty learning** — penalize modules whose high-confidence findings hunters repeatedly overturn.
0449. **Underconfidence boost learning** — boost modules whose low-confidence findings hunters repeatedly confirm as real.
0450. **Confidence-bucketed review routing** — route low-confidence findings to deeper autonomous verification before human review.
0451. **Calibration by vuln class** — calibrate confidence separately per vuln class since some classes are inherently noisier.
0452. **Calibration by stack** — calibrate per tech stack because the same evidence strength means different things on different stacks.
0453. **Evidence-strength scoring** — score findings by independent evidence corroboration count, not just detector signal strength.
0454. **Corroboration requirement scaling** — require more corroborating evidence for historically noisy finding types.
0455. **Confidence explanation snippets** — attach plain-language reasons for each confidence score so hunters can judge it.
0456. **Calibration drift monitoring** — monitor calibration over time and alert when a module's scores drift from hunter verdicts.
0457. **Cross-hunter agreement weighting** — weight confidence by how often independent hunters agreed on similar findings.
0458. **Temporal calibration decay** — decay confidence in aging findings since code changes erode old evidence.
0459. **Calibration-aware prioritization** — sort the finding queue by calibrated rather than raw confidence so hunters see the most reliable first.
0460. **Feedback-driven threshold tuning** — auto-tune report-versus-suppress thresholds from hunter accept and reject history.
0461. **Per-program rule memory** — store each program's specific rules and enforce them automatically during hunts.
0462. **Out-of-scope pattern learning** — learn out-of-scope patterns per program and auto-exclude matching assets.
0463. **Rate-limit etiquette memory** — remember per-program rate limits and auto-throttle to stay within historically safe bounds.
0464. **Disclosure embargo tracking** — track embargo rules per program and gate report sharing until the embargo lifts.
0465. **Duplicate-submission memory** — remember already-reported issues per program to avoid duplicate submissions that waste hunter reputation.
0466. **Scope-expansion request templates** — auto-draft scope-expansion requests using the program's historical response patterns.
0467. **Safe-harbor clause memory** — record each program's safe-harbor terms and warn before techniques that approach the boundary.
0468. **Testing-window enforcement** — remember allowed testing windows per program and pause autonomous activity outside them.
0469. **Data-handling rule memory** — store per-program rules on handling accessed data and enforce post-hunt cleanup.
0470. **Bounty-table memory** — remember payout tables per program to prioritize vuln classes with the best historical payout there.
0471. **Triage-speed learning** — learn each program's triage speed to set hunter expectations and follow-up timing.
0472. **Communication-style memory** — remember each program's preferred communication style for report tone.
0473. **Retest-policy memory** — store retest expectations per program and auto-schedule verification accordingly.
0474. **Scope-quirk change alerts** — alert when a program's scope or rules change between hunts.
0475. **Multi-program rule conflict resolution** — resolve conflicts when one asset appears in multiple programs with different rules.
0476. **Tested-and-clean registry** — record every check that returned clean with its evidence so future hunts skip redundant retesting.
0477. **Clean-verdict expiry** — expire clean verdicts when code fingerprints change since clean on old code means nothing now.
0478. **Negative-result confidence levels** — distinguish deeply-tested-clean from lightly-probed so future hunts know the testing depth.
0479. **Clean-endpoint fast paths** — skip clean-verdict endpoints in repeat hunts and reallocate budget to untested surface.
0480. **Regression-test derivation** — convert negative results into regression checks that verify the area stays clean.
0481. **Negative-result sharing** — share anonymized clean verdicts across hunters to avoid duplicate testing of the same public surface.
0482. **Clean-but-fragile flagging** — flag areas tested clean but historically prone to regressions for lighter periodic rechecks.
0483. **Negative evidence packaging** — attach the actual clean evidence so hunters can audit the verdict.
0484. **Sampling-based re-verification** — re-verify a random sample of clean verdicts each hunt to catch methodology drift.
0485. **Negative-result driven scoping** — use clean registries to shrink repeat-hunt scope to genuinely new or changed surface.
0486. **Clean-verdict dispute flow** — let hunters challenge a clean verdict, triggering deeper autonomous retesting.
0487. **Cross-version clean tracking** — track clean verdicts per software version to retest only when versions change.
0488. **Negative-result analytics** — analyze which techniques most often return clean to rebalance the methodology.
0489. **Clean-streak anomaly alerts** — alert when an asset shows an unusually long clean streak, suggesting testing gaps rather than security.
0490. **Negative memory compression** — compress old negative results into statistical summaries to bound storage growth.
0491. **Episodic-versus-semantic memory split** — store raw hunt episodes separately from distilled lessons so retrieval serves both debugging and planning.
0492. **Vector memory indexing** — index all memories as embeddings for similarity retrieval during live hunts.
0493. **Memory consolidation routines** — run nightly jobs that distill raw hunt logs into durable lessons and prune noise.
0494. **Forgetting curves for tactics** — deliberately decay low-value memories so the system forgets stale tricks like humans do.
0495. **Per-user memory isolation** — strictly isolate each user's memories with encryption boundaries and access controls.
0496. **Memory export and import** — let users export their full learned memory and import it on a new device for continuity.
0497. **Memory conflict resolution** — resolve contradictions between old and new memories by evidence weight, keeping both with provenance.
0498. **Memory audit interface** — give users a browsable view of everything the agent remembers about their hunts.
0499. **Selective memory deletion** — let users delete specific memories with cascading cleanup.
0500. **Memory health dashboards** — show memory size, hit rates, and staleness so users can see the learning system working.
## W. Infinity AI Chat/Plan/Build/Control
0501. **Cited security Q&A** — answer security questions with citations to CVEs, CWEs, and writeups so hunters can verify every claim.
0502. **Payload-crafting assistant** — interactively build XSS, SQLi, and SSRF payloads tuned to the user's described filter with bypass iterations.
0503. **Exploit-explanation tutor** — walk through how an exploit works step by step, adapting depth to the user's skill level.
0504. **Report-writing copilot** — draft finding descriptions, impact statements, and remediation advice from the user's rough notes.
0505. **CVE lookup and summarization** — fetch a CVE and return a plain-language summary with affected versions and exploitation prerequisites.
0506. **Security code reviewer** — review pasted code for vulnerabilities per language, citing the exact sink and taint path.
0507. **Threat-modeling interviewer** — run a Socratic STRIDE threat-model interview and output a prioritized threat list.
0508. **Security interview prep coach** — conduct mock interviews for security roles with feedback on technical depth and communication.
0509. **Regex-for-hunting helper** — build and explain regexes for grepping codebases for vulnerability patterns.
0510. **Compliance mapping Q&A** — map findings to PCI-DSS, SOC 2, HIPAA, and ISO 27001 controls for audit-ready reporting.
0511. **MITRE ATT&CK mapper** — map described attacker activity to ATT&CK techniques with detection suggestions.
0512. **Malware analysis explainer** — explain malware behaviors from pasted sandbox reports in plain language.
0513. **Log forensics Q&A** — help interpret web, auth, and firewall logs to reconstruct attack timelines.
0514. **Crypto implementation reviewer** — review custom crypto usage for classical mistakes in modes, IVs, and key handling.
0515. **Red-team op planning Q&A** — help plan authorized red-team operations including phasing, objectives, and rules of engagement.
0516. **Blue-team detection advisor** — suggest detections and log sources for a given attack technique.
0517. **CTF hint engine** — give progressive hints for CTF challenges without spoiling the solution.
0518. **Certification study buddy** — quiz and explain concepts for OSCP, CEH, GPEN, and CISSP with spaced repetition.
0519. **Bounty-rules interpreter** — parse a program's scope and rules into plain-language do and don't lists.
0520. **Exploit-DB search assistant** — find relevant public exploits by product and version and summarize their requirements.
0521. **YARA and Sigma Q&A** — help write and debug detection rules with test-case suggestions.
0522. **SOC alert triage coach** — walk analysts through alert triage with questions that narrow benign versus malicious.
0523. **Incident-response playbook Q&A** — answer what-to-do-now questions during incidents with phase-appropriate steps.
0524. **Hardening guide Q&A** — produce OS, web-server, and database hardening checklists tailored to the user's stack.
0525. **API security Q&A** — answer OWASP API Top-10 questions with concrete test cases.
0526. **Mobile security Q&A** — explain Android and iOS storage, IPC, and transport pitfalls with fix guidance.
0527. **Cloud security Q&A** — answer IAM, storage, and network misconfiguration questions per provider.
0528. **Binary exploitation tutor** — teach stack overflows, ROP, and heap basics with worked examples.
0529. **Web exploitation tutor** — teach XSS, SQLi, and SSRF systematically with practice exercises.
0530. **Active Directory attack-path explainer** — explain AD attack paths from BloodHound-style findings in plain language.
0531. **Phishing analysis explainer** — dissect phishing emails by headers, URLs, and lures for training purposes.
0532. **Memory forensics Q&A** — guide memory-dump analysis toward injected code and rootkits.
0533. **Network forensics Q&A** — help read pcaps for C2 beacons, exfiltration, and lateral movement.
0534. **WAF-bypass brainstorming partner** — suggest filter-evasion ideas for a described WAF behavior during authorized testing.
0535. **SSRF filter-bypass ideation** — brainstorm parser differentials and redirect tricks against a described SSRF filter.
0536. **Auth-bypass brainstorming** — suggest authentication-logic test ideas for a described login flow.
0537. **Business-logic test ideator** — generate abuse-case ideas from a described feature such as coupons or pricing.
0538. **Scope-clarification drafter** — draft professional scope questions to bounty programs before testing.
0539. **Disclosure email drafter** — draft responsible-disclosure emails with severity framing vendors respect.
0540. **CVSS justification helper** — walk through CVSS vector selection and justify each metric choice.
0541. **Remediation advisor** — produce developer-ready fix guidance with code examples for each finding class.
0542. **Retest verification Q&A** — help verify a fix is complete and suggest bypass attempts for the patch.
0543. **Tool-output interpreter** — explain nmap, Burp, ZAP, and Nuclei output and suggest next steps.
0544. **Stack-trace decoder** — turn error messages and stack traces into vulnerability hypotheses.
0545. **HTTP oddity explainer** — explain strange status codes, headers, and behaviors observed during testing.
0546. **JavaScript deobfuscation guide** — walk through deobfuscating pasted JS to find hidden endpoints and logic.
0547. **Prototype-pollution tutor** — teach gadget hunting in JS libraries with hands-on examples.
0548. **GraphQL security Q&A** — explain introspection, batching, and authorization pitfalls in GraphQL APIs.
0549. **gRPC security Q&A** — cover gRPC reflection, metadata auth, and message-tampering test ideas.
0550. **WebSocket security Q&A** — explain origin validation, CSRF-over-websocket, and message-auth issues.
0551. **OAuth and OIDC flow explainer** — diagram and debug authorization-code, PKCE, and implicit flows.
0552. **SAML debugging Q&A** — help debug SAML responses, signatures, and common misconfigurations.
0553. **JWT debugger explainer** — decode tokens and explain each claim's security implications.
0554. **Kubernetes security Q&A** — answer RBAC, pod-security, and etcd exposure questions.
0555. **Docker security Q&A** — cover image, daemon, and container-escape hardening.
0556. **CI/CD security Q&A** — explain pipeline injection, secret handling, and artifact-signing pitfalls.
0557. **Terraform review Q&A** — review infrastructure-as-code for public resources, weak policies, and secret leaks.
0558. **Secrets-management Q&A** — compare vaults and review secret-handling designs.
0559. **Password-policy advisor** — design password and lockout policies balanced against usability.
0560. **Session-management Q&A** — review cookie flags, timeouts, and fixation defenses.
0561. **CORS misconfiguration explainer** — explain which CORS setups are actually exploitable and how to prove it.
0562. **Clickjacking Q&A** — assess frame-busting defenses and related UI-redress risks.
0563. **Open-redirect explainer** — distinguish harmless redirects from OAuth token-theft primitives.
0564. **XXE explainer** — teach parser-specific XXE with safe lab examples.
0565. **SSRF explainer** — teach cloud-metadata and internal-network SSRF impact chains.
0566. **SSTI engine tutor** — teach template injection per engine with sandbox-escape progressions.
0567. **SQLi technique tutor** — teach union, error-based, blind, and out-of-band SQLi with labs.
0568. **XSS context tutor** — teach HTML, JS, CSS, and URL contexts with escaping rules per context.
0569. **CSRF Q&A** — explain token designs, SameSite, and login-CSRF edge cases.
0570. **IDOR and BOLA tutor** — teach object-level authorization testing methodology.
0571. **Race-condition tutor** — explain time-of-check-time-of-use and single-packet concepts with practice targets.
0572. **File-upload bypass brainstorming** — suggest content-type, extension, and polyglot bypass ideas per validation type.
0573. **Deserialization explainer** — teach gadget chains per language with safe local labs.
0574. **Command-injection tutor** — teach blind OS-command techniques and out-of-band exfiltration.
0575. **LDAP and XPath injection Q&A** — explain directory and XML query breakout techniques.
0576. **Cache-poisoning tutor** — teach unkeyed-input and cache-deception with lab setups.
0577. **Request-smuggling tutor** — teach content-length versus transfer-encoding differentials with safe practice.
0578. **Host-header attack explainer** — explain poisoning, password-reset links, and cache interplay.
0579. **Subdomain-takeover explainer** — teach dangling-DNS identification and claiming.
0580. **Debugging assistant** — diagnose errors from pasted traces across languages with fix suggestions.
0581. **Code explainer** — explain unfamiliar codebases function by function in plain language.
0582. **Algorithm tutor** — teach data structures and algorithms with complexity analysis.
0583. **SQL query helper** — write and optimize queries with execution-plan explanations.
0584. **Git Q&A** — explain rebasing, merging, and recovery from repository mishaps.
0585. **Linux command helper** — compose pipelines and explain flags for system tasks.
0586. **Python Q&A** — answer standard-library, async, and packaging questions with idiomatic examples.
0587. **JavaScript and TypeScript Q&A** — explain the event loop, types, and framework pitfalls.
0588. **Go Q&A** — cover concurrency, modules, and error-handling idioms.
0589. **Rust Q&A** — explain ownership, lifetimes, and async with compiler-error translations.
0590. **Code refactoring advisor** — suggest safe refactorings with before-and-after diffs.
0591. **Unit-test writer** — generate tests from pasted functions with edge-case coverage.
0592. **Documentation writer** — turn code into clear README and API docs.
0593. **API design reviewer** — critique REST and GraphQL designs for consistency and security.
0594. **Database schema reviewer** — review schemas for normalization, indexing, and integrity.
0595. **Performance tuning Q&A** — diagnose slow code and queries with profiling guidance.
0596. **Architecture Q&A** — discuss monolith versus microservices trade-offs for the user's constraints.
0597. **Code-review checklist generator** — build review checklists tuned to the repo's language and risk areas.
0598. **Legacy-code navigator** — map legacy codebases and suggest safe modification strategies.
0599. **Dependency-risk Q&A** — assess third-party libraries for maintenance and vulnerability risk.
0600. **Build-system Q&A** — debug Webpack, Vite, Gradle, and Make configurations.
0601. **Container-dev Q&A** — help with Dockerfiles, compose files, and dev-container setups.
0602. **Shell-script reviewer** — review bash scripts for quoting, error handling, and injection bugs.
0603. **Cron and scheduling Q&A** — design reliable scheduled jobs with failure handling.
0604. **Data-pipeline Q&A** — review ETL designs for correctness and idempotency.
0605. **ML-security Q&A** — explain prompt injection, model theft, and training-data risks.
0606. **LLM-app security reviewer** — review RAG and agent designs for injection and data-leak risks.
0607. **Prompt-engineering Q&A** — craft robust system prompts with injection-resistant patterns.
0608. **Evaluation-design Q&A** — design evals for AI features with meaningful metrics.
0609. **Accessibility Q&A** — review UIs for WCAG issues with concrete fixes.
0610. **Internationalization Q&A** — plan internationalization without breaking layouts or logic.
0611. **Email-template Q&A** — build responsive, client-safe HTML emails.
0612. **PDF-generation Q&A** — solve HTML-to-PDF rendering quirks.
0613. **Webhook-design Q&A** — design retry, signing, and idempotency for webhooks.
0614. **Rate-limit design Q&A** — design fair rate limiting with clear client signaling.
0615. **Caching-strategy Q&A** — design cache keys, TTLs, and invalidation safely.
0616. **Search-implementation Q&A** — compare full-text options and relevance tuning.
0617. **Auth-system design Q&A** — design login, MFA, and recovery flows securely.
0618. **Multi-tenancy Q&A** — review tenant-isolation designs for leak risks.
0619. **Event-driven design Q&A** — design message schemas and ordering guarantees.
0620. **Testing-strategy Q&A** — balance unit, integration, and end-to-end testing for the user's stack.
0621. **Load-testing Q&A** — plan load-test scenarios and interpret results.
0622. **Chaos-engineering Q&A** — design safe failure-injection experiments.
0623. **Observability Q&A** — choose metrics, logs, and traces with cost awareness.
0624. **On-call playbook Q&A** — write runbooks for common production incidents.
0625. **Postmortem facilitator** — guide blameless postmortems with timeline reconstruction.
0626. **Web-app hunt-plan generator** — produce a phased methodology tailored to the target's stack and scope.
0627. **API hunt-plan generator** — build API-focused plans covering discovery, auth matrix, and business-logic abuse per API style.
0628. **Mobile-backend hunt-plan generator** — plan mobile API testing with device, transport, and backend phases.
0629. **Cloud hunt-plan generator** — plan cloud-configuration review with provider-specific misconfiguration checklists.
0630. **Network hunt-plan generator** — plan external network assessments with service-specific test tracks.
0631. **Scope-planning checklist builder** — turn a program's scope text into an asset-by-asset testing checklist.
0632. **Bounty-program selection advisor** — compare programs by payout history, scope breadth, and triage speed to recommend where to hunt.
0633. **Learning-roadmap builder** — build beginner-to-pro hunter roadmaps with milestones, labs, and reading per phase.
0634. **Pentest-proposal generator** — draft scoping, methodology, timeline, and pricing sections for client proposals.
0635. **Engagement-scoping wizard** — interview the user about the target and output a formal scope document.
0636. **Timeline estimation planner** — estimate hunt phases from scope size and historical velocity data.
0637. **Home-lab build planner** — plan a vulnerable-lab setup within the user's hardware budget.
0638. **Certification study planner** — build certification study schedules with lab hours and topic sequencing.
0639. **Red-team campaign planner** — plan multi-phase authorized campaigns with objectives, timelines, and rules of engagement.
0640. **Disclosure-coordination planner** — plan vendor-notification timelines, embargo handling, and follow-ups.
0641. **Bounty-income goal planner** — turn income targets into weekly hunt schedules by program and vuln class.
0642. **Team-hunt coordination planner** — split a large scope across hunters by skill match and track coverage.
0643. **Attack-surface review planner** — plan periodic surface reviews with asset-inventory and change-detection steps.
0644. **Retest planner** — build regression plans that verify every past finding's fix without retesting everything.
0645. **Compliance-audit planner** — plan compliance pentest engagements with control-mapping checkpoints.
0646. **Cloud-security review planner** — sequence IAM, storage, network, and logging reviews per provider.
0647. **M&A security review planner** — plan acquired-company assessments under tight deal timelines.
0648. **Product-security review planner** — embed threat modeling, code review, and testing into a product release plan.
0649. **Feature threat-model planner** — plan STRIDE sessions per feature with participant roles and outputs.
0650. **Sprint-security planner** — fit security tasks into agile sprints realistically.
0651. **Incident-response planner** — build IR plans with roles, communications, and phase checklists tailored to company size.
0652. **Purple-team exercise planner** — plan collaborative attack and defense exercises with shared objectives and metrics.
0653. **CTF competition planner** — plan team roles, tooling, and practice schedules for CTF events.
0654. **Conference-talk planner** — outline talk narratives, demos, and backup plans for security presentations.
0655. **Research-project planner** — scope vulnerability-research projects with milestones and publication plans.
0656. **Tool-development roadmap planner** — plan security-tool builds from MVP to release with feature phases.
0657. **Automation-pipeline planner** — design recon-to-report automation pipelines with stage gates.
0658. **Continuous-monitoring planner** — plan always-on monitoring with alerting tiers.
0659. **Quarterly hunt-calendar planner** — schedule hunts across programs by payout seasons and scope freshness.
0660. **Target-rotation scheduler** — rotate targets to avoid over-hunting fatigue using historical yield decay.
0661. **Skill-gap practice planner** — turn assessment results into focused lab exercises per weak area.
0662. **Mock-engagement planner** — simulate full client engagements for training with debrief criteria.
0663. **War-gaming planner** — design tabletop attack simulations for defense teams.
0664. **Bug-bash planner** — organize time-boxed team bug bashes with triage workflows.
0665. **Security-champion program planner** — plan champion networks with responsibilities and training tracks.
0666. **Hunter onboarding planner** — build thirty-sixty-ninety day plans for new team hunters.
0667. **Offboarding security planner** — plan access revocation and knowledge-transfer checklists.
0668. **Vendor-assessment planner** — plan third-party security reviews with questionnaire and testing phases.
0669. **Acquisition due-diligence planner** — compress security review into deal timelines with risk-ranked outputs.
0670. **Cloud-migration security planner** — sequence security controls across migration waves.
0671. **Zero-trust rollout planner** — phase identity, device, and network controls pragmatically.
0672. **SOC build planner** — plan people, process, and tooling for a new SOC.
0673. **Detection-engineering roadmap** — prioritize detection rules by ATT&CK coverage gaps.
0674. **Threat-intel program planner** — plan collection, analysis, and dissemination workflows.
0675. **Vulnerability-management planner** — design scan-to-remediation SLAs by severity.
0676. **Patch-management planner** — schedule patching windows with rollback plans.
0677. **Backup-and-recovery planner** — plan backup testing with restore-time objectives.
0678. **Business-continuity planner** — build continuity plans with dependency mapping.
0679. **Tabletop-exercise planner** — design scenario injects and evaluation criteria.
0680. **Red-team infrastructure planner** — plan redirectors and domains for authorized operations.
0681. **OSINT investigation planner** — plan authorized OSINT collection with source-tasking matrices.
0682. **Digital-forensics planner** — plan evidence handling from collection to chain-of-custody.
0683. **Malware-analysis lab planner** — plan safe detonation environments with containment.
0684. **Reverse-engineering project planner** — break binaries into analysis milestones.
0685. **Exploit-development study planner** — sequence exploit-dev topics from stack overflows to modern mitigations.
0686. **Fuzzing-campaign planner** — plan targets, harnesses, and corpus strategies for fuzzing runs.
0687. **Code-audit planner** — scope audits by attack surface with reviewer checklists.
0688. **Architecture-review planner** — plan security architecture reviews with threat-model outputs.
0689. **Container-security planner** — plan image, runtime, and orchestrator reviews.
0690. **Kubernetes-hardening planner** — sequence CIS-benchmark remediation pragmatically.
0691. **Serverless-security planner** — plan function, event-source, and IAM reviews.
0692. **API-security program planner** — build API inventory, testing, and gateway-control roadmaps.
0693. **Mobile-app review planner** — plan static, dynamic, and backend testing per release.
0694. **IoT-assessment planner** — plan hardware, firmware, and cloud-backend phases.
0695. **OT-security planner** — plan assessments respecting safety constraints of industrial systems.
0696. **SaaS-security review planner** — plan tenant-isolation and configuration reviews.
0697. **Data-privacy review planner** — map data flows and plan privacy control checks.
0698. **AI red-teaming planner** — plan adversarial testing of AI features for injection, extraction, and abuse.
0699. **LLM-deployment review planner** — review RAG pipelines, agents, and guardrails before launch.
0700. **Supply-chain review planner** — plan dependency, build-pipeline, and provenance audits.
0701. **SBOM-adoption planner** — phase SBOM generation and vulnerability monitoring.
0702. **DevSecOps rollout planner** — embed SAST, DAST, and SCA into pipelines incrementally.
0703. **Secure-coding training planner** — build role-based training with measurable outcomes.
0704. **Phishing-simulation planner** — plan authorized simulations with education follow-ups.
0705. **Insider-threat program planner** — balance monitoring with privacy and legal constraints.
0706. **Physical-security review planner** — plan site assessments with social-engineering boundaries.
0707. **Travel-security planner** — brief traveling staff with device and communications precautions.
0708. **Executive-protection briefing planner** — plan concise threat briefs for leadership.
0709. **Board-reporting planner** — translate security posture into board-ready risk narratives.
0710. **Metrics-program planner** — define security KPIs that drive decisions, not vanity.
0711. **Risk-register planner** — build risk registers with owners and treatment plans.
0712. **Policy-development planner** — draft security policies with stakeholder-review phases.
0713. **SOP planner** — write SOC and IT standard operating procedures with version control.
0714. **Playbook-library planner** — organize IR and triage playbooks for discoverability.
0715. **Runbook-automation planner** — prioritize runbooks for automation by frequency.
0716. **Threat-hunting program planner** — plan hypothesis-driven hunts with success metrics.
0717. **Deception-program planner** — plan honeypots and canaries with deployment maps.
0718. **Identity-governance planner** — plan access reviews and lifecycle automation.
0719. **PAM rollout planner** — phase privileged-access controls by risk tier.
0720. **MFA rollout planner** — plan enrollment campaigns with fallback procedures.
0721. **Passwordless-migration planner** — sequence passkey adoption with recovery paths.
0722. **Network-segmentation planner** — plan segmentation with traffic-baselining phases.
0723. **EDR rollout planner** — deploy endpoint agents with exclusion and tuning plans.
0724. **SIEM-tuning planner** — reduce noise with phased use-case prioritization.
0725. **Log-source onboarding planner** — prioritize log sources by detection value.
0726. **Disclosure-policy planner** — draft vulnerability disclosure policies with safe-harbor language.
0727. **Bug-bounty launch planner** — plan program launch including scope, rewards, and triage staffing.
0728. **Crowdsourced-testing planner** — choose between bounty, pentest, and hybrid models.
0729. **Pentest-calendar planner** — schedule annual and quarterly tests across the estate.
0730. **Security-budget planner** — allocate budget across prevention, detection, and response.
0731. **Security hiring planner** — define roles, levels, and interview loops.
0732. **Career-ladder planner** — map hunter and analyst growth paths with skill milestones.
0733. **Conference-attendance planner** — pick events by learning ROI and networking value.
0734. **Certification-roadmap planner** — sequence certifications by career stage and cost.
0735. **Research-publication planner** — plan disclosure-to-publication timelines.
0736. **Open-source release planner** — plan tool releases with docs and maintenance.
0737. **Community-building planner** — grow local security meetups with program formats.
0738. **Mentorship-program planner** — pair mentors and mentees with structured goals.
0739. **Internship-project planner** — scope intern projects that ship real value.
0740. **Capstone-project planner** — guide student security projects to completion.
0741. **Thesis-topic planner** — narrow security research topics to feasible scope.
0742. **Grant-proposal planner** — structure security-research funding proposals.
0743. **Startup-security planner** — prioritize security for early-stage companies pragmatically.
0744. **Freelance-hunting business planner** — plan client acquisition and pricing for independent hunters.
0745. **Personal-brand planner** — build researcher visibility through writing and talks.
0746. **Portfolio-project planner** — select projects that demonstrate hiring-ready skills.
0747. **Job-search planner** — target security roles with tailored preparation tracks.
0748. **Salary-negotiation planner** — prepare market data and talking points.
0749. **Performance-review planner** — document security impact for reviews.
0750. **Sabbatical-learning planner** — design focused deep-dives for time off.
0751. **Natural-language scanner builder** — turn a plain-English scan description into a working scanner script with request logic and parsing.
0752. **Nuclei template generator** — generate Nuclei YAML templates from a vulnerability description with matchers and severity.
0753. **PoC page builder** — build self-contained HTML PoC pages that demonstrate XSS, CSRF, and clickjacking with one click.
0754. **Security dashboard builder** — assemble findings dashboards with charts, filters, and exports from a data schema.
0755. **Targeted wordlist generator** — build custom wordlists from a target's JS, docs, and naming conventions.
0756. **Payload encoder-decoder studio** — create a multi-encoding workbench with chaining across URL, Base64, JWT, and unicode.
0757. **Burp extension scaffolder** — scaffold Montoya-API Burp extensions with boilerplate for common tasks.
0758. **ZAP add-on scaffolder** — scaffold ZAP add-ons with scan-rule templates.
0759. **Report-template builder** — build branded finding-report templates with severity styling.
0760. **Recon pipeline builder** — chain subdomain, port, and content discovery into one runnable pipeline.
0761. **Subdomain monitor builder** — build monitors that alert on new subdomains via certificate-transparency logs.
0762. **Change-detection monitor builder** — build site-change monitors that diff pages and alert on deltas.
0763. **Screenshot-diff tool builder** — build visual-regression tools comparing page screenshots over time.
0764. **Pre-commit secret-hook builder** — build git hooks that block commits containing secrets.
0765. **Vulnerable-lab builder** — spin up Docker-based vulnerable apps for practice.
0766. **CTF challenge builder** — scaffold challenges with flags, hints, and verification.
0767. **Honeypot builder** — build low-interaction honeypots that log attacker behavior safely.
0768. **OAST callback builder** — build out-of-band callback listeners for blind-vulnerability confirmation.
0769. **SSRF canary builder** — build canary servers that prove SSRF with request logging.
0770. **DNS-exfil listener builder** — build DNS listeners for authorized out-of-band data tests.
0771. **Fuzz harness generator** — generate libFuzzer and AFL harnesses from function signatures.
0772. **WAF-rule generator** — turn attack samples into ModSecurity-style blocking rules.
0773. **Sigma rule builder** — build Sigma detection rules from described attacker behavior.
0774. **YARA rule builder** — build YARA rules from malware or document samples.
0775. **Ffuf config generator** — generate ffuf configs tuned to the target's technology.
0776. **Burp macro builder** — build Burp macros for multi-step authenticated sequences.
0777. **Security browser-extension builder** — scaffold extensions for header checks and PoC helpers.
0778. **CLI tool builder** — turn a workflow description into a documented CLI tool.
0779. **API client builder** — generate typed API clients from OpenAPI specs for testing.
0780. **GraphQL query builder** — build complex GraphQL queries from schema introspection.
0781. **JWT toolkit builder** — build JWT crack, forge, and verify utilities for engagements.
0782. **OAuth test-harness builder** — scaffold harnesses that exercise OAuth flows with tampering hooks.
0783. **Session analyzer builder** — build tools that test session randomness and fixation.
0784. **Cookie-security checker builder** — build checkers for flags, prefixes, and scope issues.
0785. **Header-security checker builder** — build security-header auditors with graded output.
0786. **CSP evaluator builder** — build CSP parsers that flag bypassable directives.
0787. **TLS-config checker builder** — build TLS auditors grading protocols and ciphers.
0788. **Port-scanner builder** — build fast async port scanners with service banners.
0789. **Service fingerprinter builder** — build banner-to-product fingerprint matchers.
0790. **JS secret-extractor builder** — build tools that mine JS bundles for keys and endpoints.
0791. **API endpoint extractor builder** — build crawlers that harvest API routes from JS and docs.
0792. **Sitemap builder** — build sitemaps from crawl data for scope visualization.
0793. **Asset-inventory builder** — build inventories merging subdomains, IPs, and cloud assets.
0794. **Evidence organizer builder** — build tools that sort screenshots and logs per finding.
0795. **Timeline builder** — build attack timelines from log timestamps for reports.
0796. **Attack-flow diagram builder** — build diagrams of exploit chains from step lists.
0797. **CVSS calculator widget builder** — build interactive CVSS calculators with vector explanations.
0798. **Checklist-app builder** — build mobile-friendly testing checklists with progress sync.
0799. **Flashcard-app builder** — build spaced-repetition decks for security studying.
0800. **Vulnerable demo-app builder** — build intentionally vulnerable apps for training.
0801. **Exploit-dev sandbox builder** — build isolated VMs with debugging toolchains.
0802. **Password-policy tester builder** — build testers that audit policy strength.
0803. **Phishing-simulation builder** — build authorized phishing-simulation campaigns with tracking.
0804. **Training-module builder** — build interactive security lessons with quizzes.
0805. **SOC-FAQ chatbot builder** — build chatbots answering tier-1 SOC questions.
0806. **Log-parser builder** — build parsers turning raw logs into queryable tables.
0807. **Alert-formatter builder** — build tools that normalize alerts into tickets.
0808. **Ticket auto-filer builder** — build Jira and Linear filers from finding data.
0809. **PDF report assembler builder** — build assemblers merging findings into polished PDFs.
0810. **Markdown-to-report converter builder** — convert markdown findings into styled reports.
0811. **Screenshot annotator builder** — build annotators for redacting and marking PoC screenshots.
0812. **Demo video recorder builder** — build one-click recorders capturing PoC walkthroughs.
0813. **Git-hook builder** — build hooks enforcing security checks on push.
0814. **CI security-gate builder** — build pipeline gates running SAST and SCA with thresholds.
0815. **Dependency-audit builder** — build auditors flagging vulnerable dependencies.
0816. **License-checker builder** — build license-compliance scanners for dependencies.
0817. **SBOM generator builder** — build SBOM producers from manifests and containers.
0818. **Container-scan wrapper builder** — wrap container scanners into CI-friendly gates.
0819. **IaC-scan wrapper builder** — wrap infrastructure scanners into pre-merge checks.
0820. **Backup-verifier builder** — build tools that test backup restorability.
0821. **Certificate-expiry monitor builder** — build monitors alerting before TLS certificates expire.
0822. **Uptime-monitor builder** — build status monitors with incident hooks.
0823. **Status-page builder** — build public status pages from monitor data.
0824. **Hunter-portfolio builder** — build portfolio sites showcasing sanitized findings.
0825. **Blog scaffolder** — scaffold security blogs with writeup templates.
0826. **Writeup-template builder** — build structured templates for vulnerability writeups.
0827. **Tool-docs builder** — generate documentation sites from code comments.
0828. **API mock-server builder** — build mock servers simulating target APIs for safe practice.
0829. **Traffic-replay builder** — build tools replaying captured traffic with mutations.
0830. **Request-sequencer builder** — build sequencers automating multi-request flows.
0831. **Token-refresher builder** — build utilities keeping OAuth tokens fresh during long scans.
0832. **Rate-limit probe builder** — build careful probers mapping rate limits without bans.
0833. **Chaos-test builder** — build authorized failure-injection harnesses.
0834. **Load-test script builder** — build load-test scripts for authorized load tests.
0835. **Backup-restore tester builder** — build drills verifying restore procedures.
0836. **Input-validation tester builder** — build harnesses fuzzing validation routines.
0837. **Auth-flow tester builder** — build testers exercising login, MFA, and recovery.
0838. **File-upload tester builder** — build upload-bypass test suites per validator.
0839. **Payment-flow tester builder** — build safe harnesses testing pricing logic with test cards.
0840. **Webhook tester builder** — build tools verifying webhook signature validation.
0841. **Email-security tester builder** — build SPF, DKIM, and DMARC checkers.
0842. **DNS-security tester builder** — build DNSSEC and takeover checkers.
0843. **Subdomain-enum tool builder** — build enumerators combining passive and active sources.
0844. **Directory-bruteforcer builder** — build content-discovery tools with smart filtering.
0845. **Parameter-miner builder** — build tools mining hidden parameters from responses.
0846. **Crawler builder** — build polite crawlers mapping application structure.
0847. **Spider-visualizer builder** — build graph visualizations of crawled apps.
0848. **Form-analyzer builder** — build analyzers mapping forms to injection points.
0849. **JS-crawler builder** — build headless crawlers executing JS for SPA routes.
0850. **API-fuzzer builder** — build schema-driven API fuzzers.
0851. **GraphQL-fuzzer builder** — build introspection-driven GraphQL fuzzers.
0852. **WebSocket-tester builder** — build tools testing websocket auth and message validation.
0853. **gRPC-tester builder** — build reflection-driven gRPC test clients.
0854. **IDOR-tester builder** — build multi-user object-access testers.
0855. **Access-matrix builder** — build role-by-endpoint coverage matrices.
0856. **Session-tester builder** — build concurrent-session and fixation testers.
0857. **2FA-tester builder** — build TOTP and SMS flow test harnesses.
0858. **Password-reset tester builder** — build token-entropy and expiry testers.
0859. **OAuth-tester builder** — build redirect and PKCE validation testers.
0860. **SAML-tester builder** — build assertion-tampering test tools.
0861. **JWT-tester builder** — build algorithm-confusion and key-injection testers.
0862. **CORS-tester builder** — build origin-reflection and credential testers.
0863. **CSRF-tester builder** — build token-validation and SameSite testers.
0864. **Clickjacking-tester builder** — build framing-permission testers.
0865. **Open-redirect tester builder** — build redirect-validation testers.
0866. **XSS-tester builder** — build context-aware XSS probe suites.
0867. **SQLi-tester builder** — build DBMS-aware injection probe suites.
0868. **SSRF-tester builder** — build filter-bypass and cloud-metadata probe suites.
0869. **XXE-tester builder** — build parser-specific XXE probe suites.
0870. **SSTI-tester builder** — build engine-aware template-injection suites.
0871. **Deserialization-tester builder** — build gadget-probe suites per language.
0872. **Race-tester builder** — build parallel-request race harnesses.
0873. **Logic-tester builder** — build state-machine abuse testers.
0874. **Crypto-tester builder** — build padding-oracle and randomness testers.
0875. **Mobile-backend tester builder** — build device-attestation and certificate-pinning testers.
0876. **Burp-via-GUI driver** — drive Burp Suite's real interface through GUI automation for tasks needing the desktop app.
0877. **ZAP-via-GUI driver** — operate OWASP ZAP's desktop UI via computer control.
0878. **Browser-driven retester** — replay findings in a real browser to re-verify exploits visually after fixes.
0879. **Voice-command hunt control** — start, pause, and steer hunts with spoken commands mapped to safe actions.
0880. **Scheduled desktop retests** — run retest routines on the user's machine at scheduled times with result summaries.
0881. **Terminal-to-editor workflow** — run recon in the terminal, then open results in the editor for annotation automatically.
0882. **Screenshot-and-annotate flow** — capture PoC screenshots and open them in an annotator in one command.
0883. **VM snapshot manager** — snapshot lab VMs before exploit attempts and roll back after, keeping labs pristine.
0884. **Safe keystroke injector** — type into desktop apps with confirmation gates for destructive actions.
0885. **Clipboard automation** — copy PoCs into Burp and ZAP fields and pull responses back programmatically.
0886. **Window-tiling manager** — tile Burp, terminal, and browser into a hunt workspace layout on command.
0887. **PoC video recorder** — record narrated PoC walkthroughs with timestamped chapters.
0888. **OCR-driven app reader** — read text from desktop apps that lack APIs to verify states.
0889. **Evidence file organizer** — auto-sort screenshots, logs, and captures into per-finding folders.
0890. **Tool installer automation** — download and install lab tools with checksum verification.
0891. **Lab VM provisioner** — spin up preconfigured vulnerable VMs from templates.
0892. **Network-namespace switcher** — switch lab network profiles to isolate dangerous tests.
0893. **VPN profile switcher** — rotate VPN endpoints per engagement automatically.
0894. **Proxy configurator** — route desktop traffic through Burp with one command, including CA install.
0895. **Burp CA installer** — install the Burp CA certificate into system and browser stores.
0896. **Emulator controller** — drive Android emulators including APK installs, UI taps, and traffic capture.
0897. **iOS simulator driver** — control the iOS simulator for mobile-backend testing flows.
0898. **USB-lab handler** — manage USB passthrough for hardware security labs.
0899. **Serial-console automator** — interact with IoT serial consoles for firmware testing.
0900. **Firmware-flash automator** — flash lab firmware images with verification steps.
0901. **Router-admin automator** — drive router admin panels for lab network setup.
0902. **Wi-Fi lab automator** — run authorized wireless tests in isolated lab environments.
0903. **Password-manager autofill** — fill credentials from the vault into desktop login forms.
0904. **TOTP autofill** — pull time-based codes into 2FA prompts during testing.
0905. **Email-client automator** — triage bounty-program emails and file them per program.
0906. **Calendar automator** — schedule retests and block focus time for hunts.
0907. **Spreadsheet automator** — maintain finding trackers with formulas and charts.
0908. **Slide-deck automator** — assemble report decks from finding data.
0909. **PDF assembly automator** — merge evidence into final PDF reports.
0910. **Tmux session manager** — maintain named terminal sessions per hunt with restore.
0911. **SSH session manager** — open, multiplex, and monitor lab SSH sessions.
0912. **Remote-host controller** — execute lab commands on remote hosts over SSH.
0913. **Docker controller** — manage lab containers including start, snapshot, inspect, and reset.
0914. **Kubernetes dashboard driver** — navigate Kubernetes dashboards to verify lab deployments.
0915. **Cloud-console automator** — perform repetitive cloud-portal tasks.
0916. **IDE automator** — open findings in the editor at the exact vulnerable line.
0917. **Debugger automator** — attach debuggers to lab binaries with breakpoint scripts.
0918. **Wireshark automator** — start captures, apply display filters, and export streams.
0919. **Process-monitor automator** — watch lab processes for spawned shells or crashes.
0920. **Registry automator** — read and snapshot the Windows registry during lab analysis.
0921. **Event-log extractor** — pull Windows event logs into timelines.
0922. **Task-manager automator** — manage runaway lab processes safely.
0923. **Service controller** — start and stop lab services during testing.
0924. **Firewall-rule automator** — toggle lab firewall rules to test filtering.
0925. **Hosts-file automator** — manage hosts entries for lab domain simulation.
0926. **DNS-switch automator** — swap DNS configs between lab and normal profiles.
0927. **Browser-profile manager** — maintain isolated browser profiles per engagement.
0928. **Cookie-jar manager** — import and export cookie jars between tools.
0929. **Extension manager** — enable and disable browser extensions per testing profile.
0930. **DevTools automator** — capture performance traces and console logs automatically.
0931. **Hotspot toggler** — toggle mobile hotspots for network-switch tests.
0932. **Chaptered screen recorder** — record long sessions with auto-chaptered milestones.
0933. **Annotation overlay** — draw on screen during live demos without extra software.
0934. **Stream-setup automator** — configure streaming scenes for teaching sessions.
0935. **Hunt-data backup automator** — back up hunt folders on schedule with versioning.
0936. **Cloud-sync automator** — sync hunt data to private storage encrypted.
0937. **Desktop-alert automator** — push OS notifications when findings land.
0938. **Focus-mode automator** — block distracting apps during deep hunt sessions.
0939. **Pomodoro hunt timer** — run focus and break cycles controlling app states.
0940. **End-of-day shutdown routine** — close lab VMs, save state, and log the day.
0941. **Morning startup routine** — reopen the hunt workspace including tools, notes, and browser tabs.
0942. **Multi-monitor layout manager** — arrange hunt apps across monitors per saved layouts.
0943. **Audio-device switcher** — route audio for calls versus recordings automatically.
0944. **Webcam controller** — manage the camera for video reports and streams.
0945. **Microphone-level automator** — set mic levels per app for clean recordings.
0946. **File-watcher automator** — trigger actions when lab files change.
0947. **Download organizer** — sort tool downloads by type with malware-scan prompts.
0948. **Archive manager** — compress old hunts with searchable indexes.
0949. **Disk-space guardian** — alert and clean scratch space before long captures.
0950. **Battery-aware scheduler** — defer heavy tasks when on battery power.
0951. **Update coordinator** — schedule OS and tool updates outside hunt windows.
0952. **Snapshot-comparison automator** — diff VM snapshots to reveal exploit side effects.
0953. **Lab-reset orchestrator** — reset multi-VM labs to known-good state in one command.
0954. **Lab credential rotator** — rotate lab credentials on schedule.
0955. **Log-shipper automator** — forward lab logs to the analysis machine.
0956. **Time-sync verifier** — verify lab VM clocks for accurate timelines.
0957. **Port-forward manager** — manage SSH tunnels into lab networks.
0958. **Lab reverse-proxy configurator** — set up lab proxies for traffic inspection.
0959. **Certificate-manager automator** — issue lab TLS certificates for interception testing.
0960. **Traffic-mirror automator** — mirror lab traffic to the sniffer interface.
0961. **Packet-replay automator** — replay captured attack traffic in the lab.
0962. **Baseline-capture automator** — record known-good lab traffic for comparison.
0963. **Anomaly highlighter** — flag deviations from baseline during lab tests.
0964. **Crash-monitor automator** — detect and triage fuzzer crashes with deduplication.
0965. **Corpus-manager automator** — organize fuzzing corpora by coverage.
0966. **Coverage-viewer automator** — open coverage reports after fuzz runs.
0967. **Bisect automator** — binary-search lab commits that introduced bugs.
0968. **Patch-verifier automator** — apply vendor patches in the lab and rerun PoCs.
0969. **Config-diff automator** — diff lab configs before and after hardening.
0970. **Compliance-screenshot automator** — capture evidence screenshots for audits.
0971. **Report-evidence collector** — gather all artifacts into the report folder automatically.
0972. **Finding-video linker** — attach PoC videos to findings in the tracker.
0973. **Timeline-sync automator** — align timestamps across tools into one timeline.
0974. **Note-template filler** — populate hunt-note templates from recon data.
0975. **Checklist-progress automator** — tick methodology checklists as tools complete steps.
0976. **Standup-notes generator** — summarize hunt progress for team standups.
0977. **Handoff packager** — bundle everything a teammate needs to continue a hunt.
0978. **Client-demo rehearsal** — run through PoC demos checking every click works.
0979. **Dry-run validator** — validate full exploit chains in the lab before live use.
0980. **Safety-interlock manager** — enforce confirmation gates before destructive desktop actions.
0981. **Action-audit logger** — log every desktop control action for review.
0982. **Undo-stack manager** — track reversible desktop actions for one-click rollback.
0983. **Session-recording archiver** — archive full control sessions for accountability.
0984. **Permission-scope limiter** — constrain control actions to approved apps and folders.
0985. **Emergency-stop handler** — halt all automation instantly on voice or hotkey command.
0986. **Multi-app macro recorder** — record desktop workflows and replay them as macros.
0987. **Macro-library manager** — store and share vetted desktop macros.
0988. **Context-aware macro suggester** — suggest relevant macros based on the active app.
0989. **Scheduled-report sender** — email hunt summaries on schedule.
0990. **Meeting-notes automator** — capture and summarize security meeting notes.
0991. **Follow-up tracker** — track promised fixes and retests with reminders.
0992. **Contact-manager automator** — organize program contacts and communications history.
0993. **Invoice-helper automator** — assemble bounty and consulting invoices from tracked work.
0994. **Time-tracker automator** — log hunt hours per program automatically.
0995. **Expense-logger automator** — categorize security-tooling expenses.
0996. **Learning-log automator** — record techniques practiced with proficiency scores.
0997. **Goal-tracker automator** — track bounty goals with progress dashboards.
0998. **Habit-builder automator** — nudge daily recon or study habits.
0999. **Break enforcer** — lock distracting apps during scheduled focus blocks.
1000. **Shutdown-verification routine** — verify labs stopped, data saved, and secrets cleared at day end.
