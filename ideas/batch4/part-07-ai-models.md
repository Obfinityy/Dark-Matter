# Batch 4 — Part 07: AI model improvements (36005–37004)

36005. **Evidence-Cited Hypothesis Gate** — every generated hypothesis must cite the exact observed artifact (header, response excerpt, or code snippet) that motivated it, and uncited guesses are rejected before planning begins.
36006. **Abductive Inference Engine** — infers the single vulnerability class that best explains an anomalous observation, ranked by how completely it accounts for all collected evidence.
36007. **Precondition Checklist Generator** — expands each hypothesized vulnerability into concrete preconditions and maps every precondition to a specific probe that confirms or denies it.
36008. **Attack-Tree Hypothesis Expansion** — grows each seed hypothesis into a branching tree of prerequisite states and alternative exploitation paths for the planner to traverse.
36009. **Hypothesis Novelty Tracker** — downranks hypotheses already tested and disproven on the current target so the model never wastes requests re-probing dead ends.
36010. **Weak-Signal Fusion Hypothesizer** — combines two or more individually weak observations, such as a verbose error plus a debug header, into one stronger composite hypothesis.
36011. **Falsification-First Probe Planner** — generates the cheapest possible probe that could disprove each hypothesis before any expensive exploitation attempt is allowed to run.
36012. **Evidence-Weighted Hypothesis Priors** — assigns every hypothesis a prior probability derived from the strength, recency, and independence of its supporting observations.
36013. **Benign-Explanation Challenger** — proposes the most plausible non-vulnerable explanation for every anomaly and requires the model to rule it out before claiming a vulnerability.
36014. **Historical Analogy Retriever** — finds previously hunted targets with matching fingerprints and adapts the hypotheses that produced confirmed findings on those targets.
36015. **Hypothesis Diversity Enforcer** — penalizes hypothesis batches that cluster on a single vulnerability class, forcing coverage across the full attack surface.
36016. **Information-Gain Budget Allocator** — distributes the probe budget across hypotheses by expected information gain per request, cutting low-yield lines of inquiry early.
36017. **Chained-Hypothesis Composer** — links atomic hypotheses into multi-step chains where the output of one becomes the precondition of the next.
36018. **Negative Evidence Integrator** — explicitly weighs absent expected indicators, like a missing WAF header or no rate-limit response, as support for specific hypotheses.
36019. **Hypothesis Lifecycle State Machine** — tracks each hypothesis through proposed, probing, supported, refuted, and confirmed states with a full transition history.
36020. **Root-Cause Backtracking Reasoner** — works backward from an observed symptom, such as leaked data in a response, to candidate root causes ranked by likelihood.
36021. **Framework-Aware Hypothesis Seeding** — seeds initial hypotheses from the detected stack, proposing deserialization gadgets for Java apps and SSTI probes for Jinja-based apps.
36022. **Behavioral Anomaly Hypothesizer** — converts timing, ordering, and state-change anomalies into hypotheses about race conditions and business-logic flaws.
36023. **Differential Hypothesis Generator** — proposes hypotheses that explain observed differences between two environments or two user roles on the same target.
36024. **Hypothesis Explanation Narrator** — produces a plain-language rationale for why the model believes each hypothesis, surfaced in the hunt timeline for the analyst.
36025. **Hypothesis Mutation Engine** — systematically mutates a base hypothesis across parameters, endpoints, and roles to spawn a family of testable variants.
36026. **Adversarial Self-Critique Pass** — forces the model to argue against its own top hypothesis and only keeps hypotheses that survive the critique.
36027. **Ensemble Hypothesis Voter** — runs hypothesis generation across multiple model seeds and promotes only hypotheses with cross-seed agreement.
36028. **Hypothesis Embedding Deduplicator** — embeds generated hypotheses and merges near-duplicates so the planner never tests the same idea twice under different wording.
36029. **Phase-Scoped Hypothesis Generator** — constrains hypothesis generation to the current hunt phase, keeping recon hypotheses broad and exploitation hypotheses narrow.
36030. **Probe-Cost Estimator** — predicts the request count, time, and detection risk of testing each hypothesis so the planner can sequence cheap tests first.
36031. **Blast-Radius Hypothesis Ranker** — prioritizes hypotheses by the potential impact of the vulnerability if confirmed, not just by likelihood.
36032. **Hypothesis Promotion Criteria** — defines the exact evidence threshold a hypothesis must cross before it is promoted into an active finding investigation.
36033. **Refuted-Hypothesis Archive** — stores disproven hypotheses with their refuting evidence so future hunts on similar targets skip them instantly.
36034. **Cross-Hunt Hypothesis Transfer** — carries high-yield hypotheses from one hunt into new hunts against targets with matching technology fingerprints.
36035. **CWE-Templated Hypothesis Starter** — instantiates hypothesis templates for each relevant CWE class, pre-filled with the target's observed technologies.
36036. **Cold-Start Hypothesis Bootstrap** — generates a baseline hypothesis set for unknown stacks from generic web-attack priors when fingerprinting yields nothing.
36037. **Error-Message Hypothesis Miner** — parses stack traces and error text into hypotheses about the underlying framework, ORM, and injection points.
36038. **JS-Comment Hypothesis Extractor** — converts developer comments and TODO notes found in client code into hypotheses about unfinished security controls.
36039. **API-Doc Hypothesis Seeder** — turns discovered OpenAPI or GraphQL documentation into hypotheses about undocumented or over-exposed operations.
36040. **Changelog-Driven Hypothesis Generator** — maps version history and release notes to hypotheses about recently introduced or incompletely fixed flaws.
36041. **Version-Banner Hypothesis Mapper** — links detected software versions to hypotheses drawn from the vulnerability history of those exact releases.
36042. **Subsumption Hypothesis Pruner** — removes hypotheses logically entailed by a broader confirmed hypothesis, keeping the investigation set minimal.
36043. **Specificity Ladder Refiner** — iteratively narrows vague hypotheses ("injection possible") into precise, testable claims ("error-based SQLi in the sort parameter").
36044. **Testability Scorer** — rates each hypothesis on how decisively a small probe set can confirm or refute it, prioritizing highly testable ideas.
36045. **Observability Mapper** — for each hypothesis, predicts exactly what the model should observe if the hypothesis were true, creating a checkable signature.
36046. **Attacker-Persona Hypothesis Framer** — reframes hypotheses from the perspective of distinct attacker profiles, from opportunistic scanner to targeted intruder.
36047. **Exploit-Difficulty Estimator** — predicts the skill and effort an attacker would need for each hypothesis, informing severity and prioritization.
36048. **Parallel Hypothesis Scheduler** — groups independent hypotheses so their probes run concurrently without interfering with each other's observations.
36049. **Hypothesis Dependency Grapher** — maps which hypotheses depend on shared preconditions so one refuting probe can efficiently kill a whole branch.
36050. **Contradiction Resolver** — detects hypotheses that cannot both be true and designs a single discriminating probe to decide between them.
36051. **Hypothesis Merger** — fuses overlapping hypotheses into one precise claim, combining their evidence and eliminating redundant probing.
36052. **Hypothesis Splitter** — breaks an ambiguous hypothesis into several precise alternatives that can each be tested independently.
36053. **Hypothesis Version Tracker** — versions every hypothesis as evidence refines it, preserving the full evolution from first guess to confirmed claim.
36054. **Hypothesis Audit Exporter** — exports the complete hypothesis log, including refuted ones, as reviewable evidence of thorough coverage.
36055. **Self-Rated Hypothesis Quality** — requires the model to score its own hypotheses on evidence support before the planner is allowed to act on them.
36056. **Spec-Grounded Hypothesis Validator** — checks each hypothesis against the relevant RFC or framework specification to eliminate spec-impossible claims.
36057. **Method-Anomaly Hypothesis Prober** — converts unusual HTTP method support (PUT, DELETE, TRACE accepted) into hypotheses about unintended functionality.
36058. **Parameter-Pollution Pattern Matcher** — turns duplicated or conflicting parameters into hypotheses about parser differentials between layers.
36059. **Auth-Flow Gap Hypothesizer** — maps observed authentication steps and proposes hypotheses for each missing or skippable step in the flow.
36060. **Session-Behavior Hypothesis Engine** — converts session token patterns, lifetimes, and rotation behavior into hypotheses about session-management flaws.
36061. **Upload-Handler Hypothesis Generator** — analyzes observed upload behavior (accepted types, storage paths, processing) into hypotheses about unrestricted file upload.
36062. **Search-Feature Hypothesis Seeder** — turns search syntax support, error messages, and result ordering into injection and information-disclosure hypotheses.
36063. **Export-Feature Hypothesis Analyzer** — converts data-export formats and parameters into hypotheses about injection (CSV formula) and over-exposure.
36064. **Webhook-Endpoint Hypothesizer** — proposes hypotheses about signature validation, replay, and SSRF based on observed webhook registration behavior.
36065. **Introspection-Driven Hypothesis Seeder** — converts an enabled GraphQL introspection schema into hypotheses about over-exposed mutations and sensitive fields.
36066. **Spec-Driven Hypothesis Generator** — parses discovered OpenAPI specs into hypotheses covering every undocumented parameter and unconstrained schema.
36067. **Mobile-API Differential Hypothesizer** — compares mobile and web API responses to hypothesize about endpoints with weaker authorization on one platform.
36068. **Subdomain-Pattern Hypothesis Mapper** — turns subdomain naming conventions into hypotheses about forgotten staging, dev, or admin hosts.
36069. **Certificate-Transparency Hypothesis Miner** — converts CT-log-discovered hostnames into hypotheses about unhardened auxiliary services.
36070. **Bundle-String Hypothesis Extractor** — mines string literals in JavaScript bundles for internal endpoints, keys, and feature flags that seed new hypotheses.
36071. **Sourcemap Hypothesis Revealer** — reconstructs original source from sourcemaps and derives hypotheses from server-side logic accidentally shipped to clients.
36072. **HTML-Comment Hypothesis Scanner** — converts HTML comments mentioning paths, credentials, or internal names into targeted hypotheses.
36073. **Robots-Sitemap Hypothesis Parser** — turns disallowed paths and sitemap entries into hypotheses about hidden or sensitive areas.
36074. **Response-Size Anomaly Hypothesizer** — converts unexpected response-size variations across users or inputs into hypotheses about data over-exposure.
36075. **Status-Code Misuse Hypothesizer** — turns incorrect status codes (200 on errors, 500 on auth failures) into hypotheses about broken access-control signaling.
36076. **Redirect-Chain Hypothesis Tracer** — analyzes redirect sequences for open-redirect and parameter-reflection hypotheses at each hop.
36077. **Cookie-Attribute Hypothesis Checker** — converts missing Secure, HttpOnly, or SameSite flags into session-hijacking and CSRF hypotheses.
36078. **CORS-Header Hypothesis Evaluator** — turns observed CORS configurations into hypotheses about cross-origin data theft with the exact header values cited.
36079. **CSP-Header Hypothesis Analyzer** — converts weak or missing Content-Security-Policy directives into XSS exploitability hypotheses.
36080. **Cache-Header Hypothesis Reasoner** — turns cache-control and CDN headers into hypotheses about sensitive-response caching and cache poisoning.
36081. **Rate-Limit Signal Hypothesizer** — converts rate-limit headers and throttling behavior into hypotheses about brute-force and enumeration feasibility.
36082. **Banner-Driven Hypothesis Seeder** — maps server and framework banners to hypotheses from the known vulnerability history of those products.
36083. **Framework Error-Page Hypothesizer** — turns framework-specific error pages into hypotheses about debug mode and information disclosure.
36084. **Debug-Endpoint Hypothesis Prober** — converts discovered debug, profiler, or health endpoints into hypotheses about exposed internals.
36085. **Admin-Path Hypothesis Enumerator** — proposes hypotheses about default credentials and unprotected functionality for each discovered admin path.
36086. **Backup-File Hypothesis Generator** — turns discovered backup, swap, or old-file artifacts into hypotheses about source-code and config disclosure.
36087. **Exposed-Repository Hypothesis Detector** — converts exposed .git or .svn metadata into hypotheses about full source-code recovery.
36088. **Environment-File Hypothesis Checker** — turns discovered .env or config dumps into hypotheses about credential exposure and service takeover.
36089. **Cloud-Metadata Hypothesis Tester** — proposes SSRF-to-metadata hypotheses wherever URL-fetching features accept user input.
36090. **SSRF-Feature Hypothesis Mapper** — maps every user-influenced outbound request (webhooks, previews, imports) to SSRF hypotheses with target-specific payloads.
36091. **XXE-Upload Hypothesis Generator** — converts XML or document-upload features into hypotheses about external-entity and billion-laughs attacks.
36092. **Template-Context Hypothesis Identifier** — identifies template-engine contexts from error reflections and seeds SSTI hypotheses with engine-specific payloads.
36093. **NoSQL-Pattern Hypothesis Matcher** — turns JSON query structures and error messages into NoSQL injection hypotheses with operator-injection variants.
36094. **Batching-Abuse Hypothesis Evaluator** — converts batch or bulk endpoints into hypotheses about limit bypass and nested-query abuse.
36095. **Identifier-Pattern IDOR Hypothesizer** — analyzes ID formats (sequential, UUID, encoded) into hypotheses about predictable-object-reference flaws.
36096. **Mass-Assignment Hypothesis Generator** — maps writable object fields from API behavior into hypotheses about privilege-field injection.
36097. **Token-Handling Hypothesis Analyzer** — converts JWT structure, storage, and validation behavior into hypotheses about algorithm confusion and weak secrets.
36098. **OAuth-Flow Hypothesis Modeler** — models the observed OAuth dance step by step and hypothesizes flaws at each redirect and code-exchange point.
36099. **SAML-Response Hypothesis Parser** — parses SAML assertions into hypotheses about signature bypass and audience confusion.
36100. **WebSocket-Message Hypothesis Miner** — converts observed WebSocket message formats into hypotheses about authorization gaps in real-time channels.
36101. **PostMessage-Handler Hypothesis Mapper** — maps postMessage listeners and their origin checks into hypotheses about cross-origin message forgery.
36102. **Deep-Link Hypothesis Enumerator** — enumerates mobile deep-link schemes from client code into hypotheses about unauthorized actions via crafted links.
36103. **Push-Endpoint Hypothesis Discoverer** — turns push-notification registration endpoints into hypotheses about spoofed or intercepted notifications.
36104. **Stale-Evidence Confidence Decay** — automatically reduces a hypothesis's standing as its supporting observations age without re-confirmation.
36105. **Structured Finding Schema Enforcer** — validates every generated description against a required schema (title, impact, root cause, evidence, fix) and rewrites any section the model skipped or left vague.
36106. **Impact-First Description Rewriter** — restructures findings to lead with concrete business impact before technical detail, so decision-makers grasp severity in the first two sentences.
36107. **Root-Cause Narrative Builder** — traces the vulnerable code path or configuration chain and writes a step-by-step root-cause story instead of a surface-level symptom note.
36108. **Fix-Verification Checklist Emitter** — appends a concrete checklist the developer can run (re-test payload, expected response, regression test) to prove the fix works.
36109. **Executive Summary Distiller** — compresses any finding into a three-sentence executive summary that states what is at risk, how likely exploitation is, and what to do first.
36110. **Technical Deep-Dive Expander** — expands a terse finding into a full technical appendix with request/response pairs, payload anatomy, and protocol-level explanation.
36111. **Evidence-Linked Sentence Generator** — rewrites descriptions so every factual claim hyperlinks to the exact log line, screenshot region, or response excerpt that proves it.
36112. **CVSS Vector Rationale Writer** — produces a metric-by-metric justification for the chosen CVSS vector, citing the observed evidence behind each metric value.
36113. **CWE Mapping Justifier** — explains in one paragraph why the assigned CWE is the best fit and why the nearest alternative CWEs were rejected.
36114. **Business-Impact Translator (AI-model context)** — converts technical findings into business language (revenue, reputation, regulatory exposure) calibrated to the target's industry.
36115. **Exploitability Narrative Composer** — writes a realistic attacker story (recon → exploitation → impact) that makes the exploit path tangible without revealing weaponized detail.
36116. **Affected-Scope Enumerator** — precisely lists every affected endpoint, parameter, user role, and environment instead of vague "multiple locations" phrasing.
36117. **Remediation-Effort Estimator** — estimates fix effort in developer-hours with a stated basis (code change size, testing needed, deployment complexity).
36118. **Prerequisite-Condition Documenter** — documents exactly what an attacker needs (authentication, user interaction, network position) before the finding is exploitable.
36119. **Attack-Scenario Storyteller** — composes two or three concrete abuse scenarios showing how different attacker types would weaponize the finding.
36120. **Before-After Diff Illustrator** — presents the vulnerable versus fixed behavior as a side-by-side diff of requests, responses, or code snippets.
36121. **Reference Curator** — attaches only genuinely relevant CVEs, advisories, and write-ups, each with a one-line note on why it applies to this finding.
36122. **Multilingual Description Localizer** — renders analyst-grade descriptions in the stakeholder's language while preserving exact technical terminology.
36123. **Reading-Level Adapter** — adjusts sentence complexity for the audience tier, from executive summaries to engineer-level deep dives, without losing accuracy.
36124. **Length-Tiered Variants** — generates one-line, one-paragraph, and one-page versions of every finding from a single evidence base.
36125. **Tone Adapter** — shifts register between formal audit language and startup-direct language based on the client profile.
36126. **Severity Justification Paragraph** — writes a dedicated paragraph defending the severity rating against the obvious counter-arguments an engineer would raise.
36127. **False-Positive Caveat Writer** — honestly documents the conditions under which the finding might not reproduce, instead of overstating certainty.
36128. **Reproduction-Steps Formatter** — converts the raw probe sequence into clean numbered reproduction steps any engineer can follow without the agent's tooling.
36129. **Request-Response Evidence Embedder** — embeds the minimal proving request/response pair inline, trimmed of noise but complete enough to verify.
36130. **Screenshot Annotation Narrator** — writes captions that explain exactly what each annotated screenshot proves and where to look.
36131. **Timeline-of-Discovery Logger** — narrates the discovery sequence (first signal → confirming probes → proof) as a credibility-building timeline.
36132. **Deduplication-Aware Wording** — phrases findings so near-duplicate issues are visibly grouped under one root cause instead of reported as separate items.
36133. **Consistency Checker** — cross-validates that the description, severity, CVSS score, and evidence all agree, flagging internal contradictions for rewrite.
36134. **Style-Guide Enforcer** — applies the report style guide (voice, tense, terminology, capitalization) uniformly across all findings in a hunt.
36135. **Jargon Glossary Linker** — links first-use technical terms to glossary definitions so non-specialist readers stay oriented.
36136. **Acronym Expander (AI-model context)** — expands every acronym on first use and enforces consistent expansion across the whole report.
36137. **Passive-to-Active Voice Rewriter** — converts weak passive constructions into direct active statements that clearly attribute cause and effect.
36138. **Hedging-Language Remover** — strips unjustified hedging ("might possibly") while preserving honest uncertainty where evidence is genuinely thin.
36139. **Speculative-Claim Flagging** — marks any sentence that goes beyond the evidence as an analyst note rather than a stated fact.
36140. **Confidence-Admitting Wording** — injects calibrated confidence language ("confirmed by replay", "inferred from a single observation") into every finding.
36141. **Environment-Context Annotator** — notes the exact environment (staging vs production, region, build) each observation came from inside the description.
36142. **Version-Contextualized Wording** — names the tested software versions in the description so the finding stays accurate as the target evolves.
36143. **Framework-Specific Terminology Adapter** — uses the target framework's own vocabulary (middleware, guards, decorators) instead of generic security jargon.
36144. **Compliance-Mapping Paragraph** — maps each finding to the specific PCI DSS, HIPAA, or SOC 2 controls it violates, with control identifiers.
36145. **Risk-Statement Quantifier** — replaces qualitative risk adjectives with quantified statements wherever the evidence supports a number.
36146. **Data-Exposure Classifier in Text** — explicitly classifies exposed data (PII, credentials, business-confidential) inside the description using a fixed taxonomy.
36147. **Authentication-Bypass Narrative Template** — a dedicated template that walks through the bypassed check, the crafted request, and the resulting privilege level.
36148. **Injection Finding Template** — a specialized template covering injection point, payload class, database or interpreter feedback, and data-access achieved.
36149. **XSS Finding Template** — a template distinguishing reflected, stored, and DOM variants with execution context and payload-trigger description.
36150. **SSRF Finding Template** — a template documenting the request-smuggling vector, internal targets reached, and cloud-metadata access where proven.
36151. **IDOR Finding Template** — a template showing the identifier pattern, authorization gap, and cross-account data accessed in the proof.
36152. **Misconfiguration Finding Template** — a template capturing the exact misconfigured setting, its observed value, and the secure baseline.
36153. **Crypto-Failure Finding Template** — a template detailing the weak algorithm, mode, or randomness flaw with a concrete exploitation consequence.
36154. **Logic-Flaw Finding Template** — a template narrating the abused workflow step by step with the business rule that was violated.
36155. **Race-Condition Finding Template** — a template documenting the timing window, request interleaving, and success rate observed during reproduction.
36156. **Auth-Flow Finding Template** — a template mapping each step of the broken authentication or session flow with the bypass point highlighted.
36157. **File-Upload Finding Template** — a template covering accepted types, validation gaps, storage location, and execution or disclosure achieved.
36158. **XXE Finding Template** — a template documenting the XML entry point, entity resolved, and file or SSRF primitive demonstrated.
36159. **SSTI Finding Template** — a template identifying the template engine, injection context, and the boundary between detection and code execution.
36160. **Deserialization Finding Template** — a template naming the serialization format, gadget chain class, and the achieved primitive.
36161. **JWT Finding Template** — a template covering the algorithm flaw, key weakness, or claim confusion with token anatomy shown.
36162. **CORS Finding Template** — a template quoting the offending headers and describing the cross-origin theft scenario they enable.
36163. **Clickjacking Finding Template** — a template documenting the missing framing defense and the sensitive action that can be framed.
36164. **Open-Redirect Finding Template** — a template showing the redirect parameter, validation gap, and phishing-abuse scenario.
36165. **Information-Disclosure Finding Template** — a template classifying the leaked data and tracing the exact response or endpoint that exposed it.
36166. **Rate-Limit Finding Template** — a template quantifying the tested request rate, the missing throttle, and the brute-force or scraping impact.
36167. **GraphQL Finding Template** — a template covering introspection exposure, over-fetchable fields, and batching or depth abuse demonstrated.
36168. **WebSocket Finding Template** — a template documenting the channel, message format, and authorization checks that were bypassed.
36169. **Mobile-API Finding Template** — a template contrasting mobile versus web behavior and showing the weaker control on the mobile endpoint.
36170. **Cloud-Misconfig Finding Template** — a template naming the service, the permissive policy, and the data or control plane exposed.
36171. **Supply-Chain Finding Template** — a template tracing the compromised dependency or build step to the shipped artifact.
36172. **Secrets-Exposure Finding Template** — a template identifying the secret type, where it was found, and the access it grants, with redaction applied.
36173. **Session-Management Finding Template** — a template documenting token lifecycle flaws (fixation, non-rotation, excessive lifetime) with observed behavior.
36174. **Privilege-Escalation Finding Template** — a template showing the low-privilege start state, the escalation vector, and the high-privilege end state.
36175. **Chained-Exploit Narrative Composer** — weaves individually moderate findings into a single compelling end-to-end compromise story.
36176. **Proof-of-Concept Embedding Formatter** — formats PoCs as copy-paste-ready blocks with prerequisites, expected output, and cleanup steps.
36177. **Mitigation-Priority Ranker in Text** — orders remediation guidance inside the description by what stops exploitation fastest.
36178. **Quick-Win Callout Box** — highlights the single fastest mitigation (config toggle, WAF rule) that buys time before the full fix.
36179. **Long-Term Hardening Note** — appends architectural hardening advice that prevents the entire vulnerability class, not just this instance.
36180. **Detection-Guidance Writer** — writes SIEM and log-search guidance so defenders can detect exploitation attempts of this finding.
36181. **Regression-Test Suggestion Writer** — proposes the exact test case that should guard against reintroduction of the flaw.
36182. **Disclosure-Safe Redactor** — automatically redacts live secrets, customer PII, and internal hostnames from descriptions before export.
36183. **Client-Name Placeholder System** — replaces client identifiers with consistent placeholders so one description template serves every engagement.
36184. **Peer-Review Simulation Pass** — runs a second model pass that critiques the description like a senior reviewer and applies the corrections.
36185. **Analyst-Edit Learning Loop** — learns from every human edit to generated descriptions and adjusts future wording toward analyst preferences.
36186. **Description A/B Readability Tester** — tests two phrasings of the same finding with readability and comprehension metrics, keeping the winner.
36187. **Flesch-Score Optimizer** — tunes sentence length and word choice until the description hits the target readability band for its audience.
36188. **Redundancy Eliminator** — removes repeated claims across the title, summary, and body so each sentence adds new information.
36189. **Cross-Finding Reference Linker** — inserts explicit links between related findings so readers can follow chains without searching.
36190. **Appendix Generator** — compiles full raw logs, complete requests, and untrimmed evidence into a structured appendix behind the polished description.
36191. **Change-Log for Finding Edits** — records every post-generation edit to a description with author, timestamp, and reason for auditability.
36192. **Description Version Diff Viewer** — shows word-level diffs between description revisions so reviewers see exactly what changed.
36193. **Translation Memory for Findings** — reuses previously approved phrasings for recurring finding types to keep multi-hunt reports consistent.
36194. **Industry-Vertical Tone Pack** — applies fintech, healthcare, or government tone and compliance framing packs to descriptions automatically.
36195. **Regulator-Ready Wording Mode** — produces descriptions that meet regulatory-reporting language standards with precise, defensible claims.
36196. **Bug-Bounty-Platform Formatter** — reformats findings into HackerOne and Bugcrowd submission templates with their required fields pre-filled.
36197. **Pentest-Report Section Assembler** — assembles findings into full pentest-report sections with numbering, table of contents entries, and cross-references.
36198. **Retest-Ready Description Closer** — ends every description with the exact retest procedure and pass criteria for the verification round.
36199. **Finding Title Optimizer** — rewrites titles to be specific, searchable, and distinct, banning generic titles like "Security Issue Found".
36200. **Severity-Title Consistency Guard** — rejects titles that imply a different severity than the assigned rating (e.g., "minor" on a Critical).
36201. **One-Line TL;DR Generator** — produces a single-line summary of each finding for dashboards, ticketing integrations, and chatops alerts.
36202. **"So What" Impact Closer** — ends every description with a plain-spoken sentence on why the reader should care, written for non-security stakeholders.
36203. **Call-to-Action Fix Prompt** — closes with a direct, assigned action statement naming the owning team and the expected fix SLA.
36204. **Description Freshness Rewriter** — re-words carried-over findings on retests so repeated reports never look copy-pasted and reflect the current state.
36205. **Framework Fingerprint-Driven Fix Selector** — detects the target's framework and version, then selects remediation snippets written for that exact stack instead of generic advice.
36206. **React XSS Remediation Snippets** — emits dangerouslySetInnerHTML replacements using DOMPurify or safe rendering patterns matched to the component code observed.
36207. **Next.js SSR Fix Patterns** — provides server-component and getServerSideProps-specific fixes that keep data-fetching safe from client exposure.
36208. **Vue Template Injection Guards** — gives v-html alternatives and template-compilation hardening specific to the Vue version in use.
36209. **Angular Sanitization Fix Guide** — tailors bypassSecurityTrustUrl and DomSanitizer guidance to the exact Angular sanitization context found.
36210. **Django ORM Injection Fixes** — rewrites raw() and extra() query patterns into parameterized ORM calls using the project's own model names.
36211. **Flask Parameterized Query Rewrites** — converts string-formatted SQL in Flask handlers into parameterized queries with the detected DB-API driver syntax.
36212. **FastAPI Dependency-Injection Hardening** — provides Depends()-based auth and validation fixes that fit the app's existing dependency graph.
36213. **Laravel Eloquent Safe Patterns** — replaces raw DB statements with Eloquent or query-builder equivalents using the app's actual table and column names.
36214. **Symfony Form Validation Fixes** — generates constraint and validator fixes aligned with the Symfony form types observed in the codebase.
36215. **Rails Strong-Parameters Remediation** — emits permit/require fixes derived from the controller's actual parameter usage.
36216. **Express Middleware Security Patches** — supplies helmet, rate-limit, and validation middleware snippets ordered to match the app's middleware chain.
36217. **NestJS Guard Configuration Fixes** — generates guard, interceptor, and pipe fixes that plug into the module structure the app already uses.
36218. **Spring Boot Security Config Templates** — emits SecurityFilterChain configurations matched to the Spring Boot version and existing security setup.
36219. **ASP.NET Core Data-Protection Fixes** — provides DataProtection and antiforgery configuration fixes consistent with the project's Startup/Program layout.
36220. **Go SQL Parameterization Rewrites** — rewrites fmt.Sprintf-built queries into database/sql parameterized statements with correct placeholder styles per driver.
36221. **Rust SQLx Safe Query Patterns** — converts dynamic query construction into sqlx compile-checked query! macros with bound parameters.
36222. **Prisma Injection-Safe Refactors** — replaces $queryRaw string interpolation with Prisma's tagged-template parameterization.
36223. **TypeORM Query-Builder Hardening** — rewrites string-concatenated where clauses into parameterized query-builder expressions.
36224. **Hibernate HQL Injection Fixes** — converts concatenated HQL into named-parameter queries using the entity mappings observed.
36225. **SQLAlchemy Bound-Parameter Rewrites** — replaces text() interpolation with bound parameters in the SQLAlchemy Core/ORM style the project uses.
36226. **ActiveRecord Sanitization Patterns** — rewrites where() string interpolation into hash-condition or sanitized SQL forms.
36227. **WordPress Nonce and Capability Fixes** — generates check_admin_referer and current_user_can fixes matched to the plugin's hook structure.
36228. **Version-Aware Upgrade Path Planner** — plans the minimal safe upgrade across the exact installed versions, flagging breaking changes between them.
36229. **Patch-Diff Generator** — outputs a unified diff transforming the vulnerable code into the fixed version, ready to apply as a patch.
36230. **Config-File Patch Emitter** — emits ready-to-apply nginx, Apache, or app-server config blocks that close the misconfiguration found.
36231. **Kubernetes Manifest Hardening Diffs** — produces securityContext, networkPolicy, and RBAC diffs for the cluster manifests in use.
36232. **Terraform Security Remediation Blocks** — generates hardened Terraform resource blocks (S3, IAM, security groups) matching the provider versions pinned.
36233. **Dockerfile Hardening Rewrites** — rewrites Dockerfiles with non-root users, pinned digests, and minimal base images while preserving the build steps.
36234. **CI-Pipeline Security Gate Snippets** — provides pipeline YAML (GitHub Actions, GitLab CI) that adds SAST and secret scanning at the right stage.
36235. **Dependency-Upgrade Advisor with Breakage Risk** — recommends the patched dependency version with a breakage-risk score derived from the changelog between versions.
36236. **Transitive-Dependency Fix Tracer** — traces the vulnerable package through the lockfile to the direct dependency that must be bumped.
36237. **Lockfile-Aware Patch Suggester** — suggests the exact lockfile edit (package-lock, poetry.lock, Cargo.lock) that resolves the vulnerable transitive pin.
36238. **Backport Fix Finder for EOL Versions** — finds vendor backports or community patches when the installed version is end-of-life and upgrade is blocked.
36239. **Legacy-Stack Shim Alternatives** — proposes safe shims or polyfills when the framework version cannot be upgraded and the modern API is unavailable.
36240. **Framework-Version-Specific API Usage** — ensures every suggested API exists in the detected framework version, never recommending calls from newer releases.
36241. **ORM-Version Query Syntax Adapter** — adapts fix snippets to the ORM's major-version syntax differences (e.g., Sequelize v5 vs v6 operators).
36242. **Language-Idiom Fix Stylist** — writes fixes in the idiomatic style of the codebase language (Pythonic, idiomatic Go, modern C#) rather than translated pseudocode.
36243. **Skill-Level Fix Tiering** — delivers the same fix at junior (step-by-step with explanations) and senior (terse diff with rationale) depths.
36244. **Legacy-Codebase Constraint Respecter** — avoids fixes that require language or framework upgrades the legacy codebase cannot adopt, and says so explicitly.
36245. **Monorepo-Aware Fix Scoper** — scopes fixes to the affected package in a monorepo and flags sibling packages sharing the vulnerable pattern.
36246. **Microservice Fix Propagator** — identifies every service duplicating the vulnerable pattern and generates per-service fix variants.
36247. **Shared-Library Fix Updater** — traces the flaw to the shared internal library and produces the single fix that heals all consuming services.
36248. **Test-Case Generator for Regression** — writes a failing-then-passing test that reproduces the vulnerability and guards the fix.
36249. **Failing-Test-First Fix Flow** — structures remediation as red-green: the generated test fails on vulnerable code and passes after the fix is applied.
36250. **Fix Verification Probe Suggester** — gives the exact retest requests that prove the vulnerability is closed without re-running the whole hunt.
36251. **Secure-Defaults Configurator** — generates hardened default configurations for the detected stack that the team can adopt wholesale.
36252. **Header-Hardening Snippet Bank** — emits per-framework security-header middleware tuned to the headers already present and those missing.
36253. **Cookie-Flag Fix Templates** — generates the precise Set-Cookie attribute changes (Secure, HttpOnly, SameSite, Partitioned) for the app's session framework.
36254. **CORS-Policy Minimal Fix Builder** — builds the tightest CORS policy that keeps the app's legitimate cross-origin flows working, derived from observed origins.
36255. **CSP-Header Generator from Observed Resources** — synthesizes a working Content-Security-Policy from the scripts, styles, and frames the app actually loads.
36256. **Rate-Limit Middleware Snippets per Framework** — provides throttle configurations (limits, windows, key strategies) written for the app's framework and proxy setup.
36257. **Auth-Flow Fix Blueprints** — delivers complete session, JWT, and OAuth hardening blueprints matched to the authentication architecture observed.
36258. **Password-Storage Upgrade Guide** — gives migration steps from weak hashes to Argon2 or bcrypt, including rehash-on-login transition code.
36259. **MFA-Enrollment Code Paths** — generates TOTP enrollment and verification flows that integrate with the existing user model.
36260. **Secrets-Management Migration Steps** — provides the migration path from hardcoded secrets to a vault or managed secret store with code changes.
36261. **Key-Rotation Runbook Generator** — writes the step-by-step rotation runbook (generate, deploy, revoke) for the exposed key type.
36262. **Certificate-Renewal Automation Snippets** — supplies ACME/cert-manager automation configs that prevent the expiry or mis-issuance found.
36263. **Input-Validation Schema Generator** — emits zod, Pydantic, or Joi schemas derived from the observed parameter shapes and their abuse cases.
36264. **Output-Encoding Helper per Template Engine** — provides context-aware encoding helpers for the exact template engine and version rendering the vulnerable page.
36265. **File-Upload Validation Blueprints** — generates type, size, content-sniffing, and storage-isolation checks matched to the upload stack.
36266. **SSRF-Protection Proxy Patterns** — gives allowlist-based fetch wrappers and DNS-rebinding-resistant validation for the app's HTTP client library.
36267. **XXE-Disabling Parser Configs per Language** — supplies the exact parser flags that disable external entities for the XML library detected.
36268. **Deserialization-Alternative Recommender** — recommends signed or schema-validated formats to replace the unsafe deserialization with migration code.
36269. **Template-Engine Sandboxing Configs** — provides sandbox configurations for the detected template engine that block code-execution primitives.
36270. **GraphQL Depth-Limit and Cost Configs** — emits query-complexity and depth-limit settings for the GraphQL server library in use.
36271. **WebSocket Auth Hardening Snippets** — gives handshake-auth and per-message authorization patterns for the WebSocket framework detected.
36272. **JWT Library-Specific Verification Fixes** — provides the exact verification options (algorithms, issuer, clock tolerance) for the JWT library in the dependency tree.
36273. **OAuth State and PKCE Implementation Diffs** — generates the state-parameter and PKCE code-verifier diffs for the OAuth client library observed.
36274. **SAML Response Validation Hardening** — supplies strict audience, signature, and timing validation for the SAML library version in use.
36275. **Clickjacking Frame-Header Fixes** — emits X-Frame-Options and frame-ancestors configurations compatible with the app's legitimate framing needs.
36276. **Open-Redirect Allowlist Patterns** — generates validated-redirect helpers using the app's routing style and known-good destinations.
36277. **IDOR Authorization-Check Injector** — shows exactly where to insert ownership checks in the controller or resolver handling the vulnerable object.
36278. **Mass-Assignment Guard Generator** — generates fillable/guarded lists or DTO mappings derived from the model's actual attributes.
36279. **Race-Condition Locking Patterns** — provides atomic-operation or locking refactors (SELECT FOR UPDATE, distributed locks) for the app's data layer.
36280. **Transaction-Isolation Fix Advisor** — recommends the correct isolation level and transaction boundaries for the database engine in use.
36281. **Crypto-Agility Migration Planner** — plans the migration from the weak algorithm to a modern one, including data re-encryption steps.
36282. **TLS-Configuration Hardening Blocks** — emits TLS version and cipher-suite configurations for the detected server and TLS terminator.
36283. **HSTS and Pinning Deployment Notes** — gives preload-safe HSTS rollout steps sized to the domain's subdomain complexity.
36284. **Logging and Monitoring Fix Guidance** — specifies exactly what to log (auth failures, input anomalies) using the app's logging framework.
36285. **SIEM Detection-Rule Companion** — ships Sigma or vendor-specific detection rules that catch exploitation of the found vulnerability.
36286. **WAF-Rule Stopgap Generator** — generates ModSecurity or cloud-WAF rules that block the observed attack pattern until code is fixed.
36287. **Virtual-Patch Snippet Emitter** — emits runtime virtual patches (RASP-style hooks) for teams that cannot redeploy immediately.
36288. **Feature-Flag Kill-Switch Advice** — shows how to gate the vulnerable feature behind a flag for instant disablement with the flag system in use.
36289. **Rollback Plan Attacher** — attaches a tested rollback procedure to every fix so a bad patch can be reverted safely.
36290. **Fix-Priority Sequencer** — orders multiple fixes by exploitability and dependency so teams patch in the safest sequence.
36291. **Effort-vs-Impact Fix Ranker** — ranks fixes on an effort/impact matrix so quick high-impact wins come first.
36292. **Developer-Assignment Suggester** — suggests the owning developer or team for each fix based on code-ownership signals.
36293. **PR-Description Auto-Drafter for Fixes** — drafts the pull-request description (problem, fix, testing, risk) for the generated patch.
36294. **Code-Review Checklist Emitter** — produces a reviewer checklist targeting the vulnerability class so the fix gets properly scrutinized.
36295. **Fix-Confirmation Retest Planner** — plans the minimal retest that confirms the fix without re-running the full hunt.
36296. **Documentation-Update Prompter** — flags the docs (API references, runbooks) that must be updated alongside the security fix.
36297. **Training-Link Attacher per Vuln Class** — attaches targeted secure-coding training resources matched to the vulnerability class and stack.
36298. **Compliance-Control Mapper for Fixes** — maps each fix to the compliance controls it satisfies, with control IDs for the audit trail.
36299. **Risk-Acceptance Template Generator** — drafts the formal risk-acceptance document when the business chooses not to fix, with expiry and owner.
36300. **Compensating-Control Suggester (AI-model context)** — proposes detective or preventive compensating controls when the direct fix is infeasible.
36301. **Fix-Deadline Recommender by Severity** — recommends SLA deadlines per severity, adjusted for exploitability evidence and exposure.
36302. **Staged-Rollout Fix Planner** — plans canary, percentage, and full rollouts for fixes that touch authentication or session handling.
36303. **Canary-Verification Steps** — defines the metrics and checks that prove the fix is safe during canary deployment.
36304. **Post-Fix Monitoring Checklist** — lists the dashboards and alerts to watch after deployment to catch fix regressions or bypass attempts.
36305. **Webpack Bundle Chunk Mapper** — parses webpack chunk manifests to map every lazy-loaded module to its route, exposing hidden admin and debug chunks.
36306. **Vite and Rollup Bundle Analyzer** — decomposes modern ESM bundles into their source modules so the planner can read the app's real client logic.
36307. **Sourcemap-Resolved Source Reconstructor** — downloads exposed sourcemaps and rebuilds the original readable source for security review.
36308. **Minified-Code Symbol Recovery** — uses data-flow patterns to recover meaningful names for minified functions handling auth, crypto, and API calls.
36309. **API Route Extractor from Client Code** — statically extracts every API path, method, and parameter the client can call, including ones never linked in the UI.
36310. **Auth-Logic Flow Reconstructor** — rebuilds the complete login, refresh, and logout flow from client code, flagging steps the UI never surfaces.
36311. **Token-Handling Code Tracer** — follows tokens from receipt through storage to request attachment, identifying insecure storage and transmission.
36312. **Session-Management Code Miner** — extracts session creation, renewal, and destruction logic to find fixation and non-expiry flaws.
36313. **Secret and Key Scanner for Bundles** — scans shipped JavaScript for API keys, tokens, and private keys with context-aware false-positive filtering.
36314. **Hardcoded-Endpoint Harvester** — collects hardcoded internal, staging, and third-party endpoints from bundle strings for target expansion.
36315. **GraphQL Operation and Schema Miner** — extracts queries, mutations, and fragments from client code to reconstruct the usable GraphQL surface.
36316. **REST Client-Method Enumerator** — enumerates every REST call site with its method, URL template, and payload shape for probe generation.
36317. **Framework Fingerprinter from Bundle Signatures** — identifies frameworks and their versions from bundle internals (React internals, Vue runtime markers) even when headers hide them.
36318. **Library Inventory Builder** — builds a complete third-party library inventory with versions from bundle metadata and code signatures.
36319. **Vulnerable-Library Version Matcher** — matches inventoried library versions against vulnerability data to prioritize client-side supply-chain findings.
36320. **Dead-Code Eliminator for Analysis Scope** — strips unreachable modules from the analysis scope so the model reasons only over code the app can execute.
36321. **Client-Side Taint Tracker** — tracks user input from sources (URL params, postMessage, storage) to sinks (innerHTML, eval, fetch) across the bundle.
36322. **Validation-Logic Extractor** — extracts client-side validation rules (regexes, length checks, allowlists) to understand what the server must re-validate.
36323. **Validation-Bypass Mapper** — maps every client-side check to the server behavior, highlighting validations the server demonstrably does not enforce.
36324. **State-Management Store Inspector** — inspects Redux, Zustand, or Pinia stores for sensitive data kept in client state and leaked to devtools or persistence.
36325. **Env-Variable Leakage Detector** — finds build-time environment variables baked into the bundle that expose internal endpoints or keys.
36326. **Feature-Flag and Config Exposure Finder** — extracts feature flags and remote-config defaults that reveal unfinished or privileged functionality.
36327. **Third-Party Script Risk Profiler** — profiles every third-party script (tag managers, chat widgets) for the data access its code actually exercises.
36328. **Analytics-Key Exposure Checker** — verifies whether analytics and tracking keys in the bundle grant write or admin access beyond their intended scope.
36329. **WebSocket Endpoint Discoverer** — finds WebSocket URLs and subprotocols constructed dynamically in client code.
36330. **WebSocket Message-Schema Inferencer** — infers message types and fields from serialization code to build protocol-aware probes.
36331. **Service-Worker Scope Analyzer** — analyzes service-worker registration scope and caching logic for auth-token caching and scope-escalation issues.
36332. **WASM Module Import Inspector** — lists imports of WebAssembly modules to reveal the host capabilities (crypto, networking) the module can invoke.
36333. **WASM Exported-Function Enumerator** — enumerates exported WASM functions and maps them to the JS wrappers that expose them to attackers.
36334. **Inline-Event-Handler Hunter** — finds inline event handlers and javascript: URLs that survive CSP and framework sanitization.
36335. **postMessage Listener Mapper** — maps every message listener, its origin validation, and the actions it triggers for cross-origin forgery analysis.
36336. **postMessage Origin-Validation Checker** — verifies each listener actually validates event.origin against an allowlist instead of trusting any sender.
36337. **Deep-Link Scheme Extractor** — extracts custom URL schemes and universal-link paths from mobile bundles for deep-link abuse testing.
36338. **Intent and URL-Scheme Parser** — parses Android intents and iOS schemes to find actions reachable from untrusted links.
36339. **Native-Bridge Interface Enumerator** — enumerates JavaScript-to-native bridge methods in hybrid apps and the privileges each exposes.
36340. **JavaScript-to-Native Call Mapper** — maps bridge call sites to native capabilities (file access, contacts, payments) for privilege-escalation hypotheses.
36341. **Obfuscation-Resilient String Decoder** — decodes common string-obfuscation schemes (array rotation, base64 layers) to reveal hidden endpoints and keys.
36342. **Encoded-Payload String Revealer** — decodes packed or encrypted string blobs in bundles that conceal API endpoints or credentials.
36343. **Dynamic-Import Graph Builder** — builds the full dynamic-import graph to find conditionally loaded modules containing privileged functionality.
36344. **Lazy-Route Manifest Parser** — parses lazy route manifests to enumerate routes the router can reach but the navigation never shows.
36345. **Admin-Route Discovery from Router Tables** — extracts admin and internal routes directly from the client router configuration.
36346. **Hidden-Feature Route Finder** — finds routes gated only by client-side flags, which server-side authorization may not enforce.
36347. **Debug-Only Code Path Detector** — identifies code paths enabled by debug flags or query parameters that expose development functionality.
36348. **Comment-Embedded Credential Scanner** — scans code comments for credentials, internal URLs, and access notes developers left behind.
36349. **TODO and FIXME Security-Note Miner** — mines TODO comments admitting missing validation, auth, or encryption for direct hypothesis seeding.
36350. **Error-Handling Code Path Analyzer** — analyzes catch blocks and error UI for verbose disclosures and fail-open behavior.
36351. **Retry and Timeout Logic Inspector** — inspects retry logic for amplification abuse and timeout handling that leaks state.
36352. **Cache-Key Construction Analyzer** — reads cache-key building code to find user-controlled components enabling cache poisoning or deception.
36353. **Pagination-Logic Abuse Mapper** — analyzes pagination and cursor code for offset manipulation and data-window over-fetching.
36354. **Search-Query Builder Inspector** — reads the query-construction code behind search boxes to find injectable operators and fields.
36355. **Filter and Sort Injection Surface Mapper** — maps sortable and filterable fields from client code to injection-test targets.
36356. **Export-Functionality Code Tracer** — traces export buttons to their data-gathering code, revealing over-collection and formula-injection surfaces.
36357. **Upload-Component Constraint Reader** — reads upload components for their client-side type and size checks, which the planner then tests server-side.
36358. **Rich-Text Editor Config Analyzer** — analyzes editor configurations for allowed HTML, plugins, and sanitization gaps that permit stored XSS.
36359. **Markdown-Renderer Sanitization Checker** — checks the markdown pipeline's sanitizer configuration against known bypass classes.
36360. **Template-Engine Usage Detector** — detects client-side template engines and their delimiters to target template-injection probes precisely.
36361. **Client-Side Crypto Implementation Reviewer** — reviews in-browser crypto (custom AES, weak RNG) for flaws that undermine the security model.
36362. **Custom Auth-Scheme Code Reader** — reads bespoke authentication schemes in client code to find replay, truncation, or secret-embedding flaws.
36363. **OTP and 2FA Flow Code Mapper** — maps the one-time-code request, delivery, and verification flow to find rate-limit and bypass gaps.
36364. **Password-Reset Flow Code Tracer** — traces token generation requests and reset-link handling to find enumeration and token-leak flaws.
36365. **OAuth Client-Side Flow Inspector** — inspects the OAuth redirect handling code for state, nonce, and code-verifier mistakes.
36366. **PKCE Implementation Verifier in Code** — verifies the code-verifier generation uses a cryptographic RNG and the challenge method is S256.
36367. **Redirect-URI Construction Analyzer** — analyzes how redirect URIs are built to find open-redirect and parameter-injection vectors.
36368. **JWT Decode-vs-Verify Code Checker** — finds code paths that decode JWTs without verifying signatures before making authorization decisions.
36369. **Role-Check Placement Mapper** — maps where role checks occur in the call graph to find endpoints missing authorization entirely.
36370. **Client-Side Authorization Gate Finder** — identifies UI-only permission gates that hide but do not protect privileged actions.
36371. **IDOR-Prone Fetch Pattern Detector** — finds fetch calls using user-influenced IDs without accompanying ownership checks.
36372. **Mass-Assignment Surface from Forms** — maps form fields to API payloads to find writable attributes the UI never shows but the API accepts.
36373. **Hidden-Form-Field Trust Analyzer** — identifies hidden fields (prices, roles, IDs) the client trusts and the server must re-validate.
36374. **CSRF-Token Handling Code Checker** — verifies tokens are actually attached to state-changing requests and validated per the code's own logic.
36375. **reCAPTCHA Integration Verifier** — checks that the captcha token is sent to and verified by the server, not just displayed.
36376. **Fingerprinting-Script Detector** — detects browser-fingerprinting scripts and assesses the tracking data they collect against the privacy policy.
36377. **Anti-Debugging Code Identifier** — identifies anti-debugging tricks so the analysis pipeline can neutralize them during dynamic review.
36378. **License-Key Validation Logic Reader** — reads client-side license checks to find bypassable validation the server must duplicate.
36379. **Paywall-Bypass Code Surface Mapper** — maps entitlement checks enforced only in client code that the API may not re-verify.
36380. **A/B-Test Branch Security Differ** — diffs experiment branches for security-relevant behavior differences (weaker validation in the test arm).
36381. **i18n-Bundle Secret Scanner** — scans localization bundles, which teams forget to review, for embedded secrets and internal strings.
36382. **Map-Tile and API-Key Exposure Checker** — finds map and geocoding keys in client code and tests their quota and referrer restrictions.
36383. **Payment-Integration Code Reviewer** — reviews payment SDK integration code for amount tampering, webhook trust, and key exposure.
36384. **Webhook-Signature Verification Code Checker** — verifies the code actually validates webhook signatures instead of merely parsing payloads.
36385. **SSO-Integration Code Mapper** — maps SSO assertion handling in client code to find claim-trust and audience-validation gaps.
36386. **SCIM-Provisioning Code Inspector** — inspects provisioning endpoints and sync logic for privilege-escalation via crafted directory attributes.
36387. **Audit-Log Emission Verifier** — checks that security-relevant actions in the code actually emit audit events the SOC can consume.
36388. **PII-Handling Code Marker** — marks code paths touching PII so the model prioritizes data-protection hypotheses there.
36389. **Data-Retention Logic Reader** — reads deletion and retention code to find soft-deletes that keep "deleted" data accessible.
36390. **Consent-Management Code Checker** — verifies consent choices in code actually gate tracking and data collection rather than just recording clicks.
36391. **Tracking-Pixel Inventory Builder** — inventories tracking pixels and beacons with the data each exfiltrates for privacy-impact assessment.
36392. **Third-Party Cookie Usage Mapper** — maps third-party cookie reads and writes to assess cross-site tracking exposure.
36393. **LocalStorage Secret Auditor** — audits localStorage usage for tokens and PII persisted beyond the session.
36394. **IndexedDB Sensitive-Data Scanner** — scans IndexedDB object stores for cached sensitive records accessible to any script on the origin.
36395. **Cache-Storage Auth-Data Checker** — checks Cache API entries for cached authenticated responses replayable without credentials.
36396. **Cross-Tab State Leakage Analyzer** — analyzes BroadcastChannel and storage events for sensitive state shared across tabs without origin checks.
36397. **Browser-Extension Attack-Surface Noter** — notes extension-exposed messaging interfaces in web-accessible resources for external message abuse.
36398. **Electron-Bundle Analyzer** — decomposes Electron app bundles to audit main/renderer privilege separation and nodeIntegration settings.
36399. **React-Native Bundle Decomposer** — splits React Native bundles into modules to audit bridge usage and hardcoded secrets.
36400. **Flutter Asset String Miner** — mines Flutter asset bundles for API endpoints, keys, and configuration the Dart code references.
36401. **Source-vs-Bundle Drift Detector** — detects when the served bundle differs from the repository source, flagging injected or stale code.
36402. **Bundle-Change Security Differ** — diffs consecutive bundle versions and surfaces only the security-relevant changes for rapid review.
36403. **API-Surface Growth Tracker** — tracks the client-callable API surface over releases and alerts when it grows unexpectedly.
36404. **Client-Code-to-Probe Compiler** — compiles extracted endpoints, parameters, and validation rules directly into ready-to-run probe definitions.
36405. **Screenshot-DOM-Network Fusion Reasoner** — reasons jointly over the rendered screenshot, the DOM tree, and the network log so conclusions must be consistent across all three modalities.
36406. **Joint Visual-Structural Embedding Builder** — builds a single embedding from visual layout plus DOM structure for similarity search over previously hunted pages.
36407. **Late-Fusion Cross-Validator** — lets each modality reach an independent conclusion, then promotes only findings that survive cross-modality agreement checks.
36408. **Login-Form Visual Detector** — recognizes login forms from pixels alone, catching auth surfaces that DOM analysis misses due to canvas or shadow-DOM rendering.
36409. **Admin-Panel Visual Recognizer** — identifies admin interfaces visually by layout patterns, even when URLs and titles are disguised.
36410. **Error-Page Visual Classifier** — classifies error pages by their visual signature to distinguish framework debug pages from generic handlers.
36411. **Debug-Page Visual Identifier** — spots profiler and debug toolbars visually when they are injected but hidden from the DOM snapshot.
36412. **CAPTCHA Presence Detector** — detects CAPTCHA widgets visually across providers so the planner routes around or flags human-interaction gates.
36413. **Payment-Form Visual Mapper** — maps card-input fields visually to verify PCI-relevant inputs never touch first-party servers.
36414. **Multi-Step Wizard State Tracker** — tracks wizard progress visually across steps to detect skippable or re-orderable security steps.
36415. **Visual Element Grounder** — converts natural-language element references ("the delete button") into screen coordinates for the control-mode agent.
36416. **OCR-Assisted Content Extractor** — reads text rendered in images, canvas, and videos that DOM parsing cannot see.
36417. **Rendered-Text vs DOM-Text Differ** — diffs OCR output against DOM text to find cloaked content shown to users but hidden from parsers.
36418. **Hidden-Element Visual Revealer** — finds elements invisible in the DOM snapshot (off-screen, zero-opacity) that are visible in the screenshot.
36419. **Overlay and Modal Stack Analyzer** — analyzes stacked overlays visually to find clickjacking-relevant layering and dismissed-but-active dialogs.
36420. **Visual Diff Change Detector** — compares before/after screenshots of an action to confirm state changes the network log only implies.
36421. **Interaction-Video Segmenter** — segments screen recordings of hunt interactions into discrete actions aligned with probe events.
36422. **HAR-to-Screenshot Timeline Aligner** — aligns network requests with screenshot frames so the model sees which UI state produced each request.
36423. **Request-to-UI-Action Correlator** — attributes every network request to the specific UI action that triggered it, exposing background exfiltration calls.
36424. **Network-Waterfall Visualizer for the Model** — renders request waterfalls as images so the vision model can spot anomalous sequencing and timing.
36425. **Accessibility-Tree Fusion Layer** — fuses the accessibility tree with the DOM to give the model semantic role and label understanding per element.
36426. **ARIA-Label Semantic Enricher** — uses ARIA labels and roles to disambiguate visually similar controls (delete vs archive) for safer automated interaction.
36427. **Canvas-Rendered Content Interpreter** — interprets canvas-drawn interfaces (charts, editors, games) where no DOM exists to describe the content.
36428. **WebGL Scene Security Noter** — notes WebGL-rendered scenes that may embed clickable regions invisible to DOM-based crawling.
36429. **SVG-Embedded Script Detector** — correlates SVG markup with its rendering to catch script-bearing vectors that sanitizers miss.
36430. **Image-Metadata Leakage Checker** — extracts EXIF and metadata from served images for GPS, device, and author disclosures.
36431. **Favicon and Logo Brand Impersonation Scorer** — scores visual similarity of favicons and logos against known brands to flag phishing lookalikes.
36432. **Visual Brand-Consistency Checker** — flags pages whose branding visually mismatches the claimed organization, a phishing indicator.
36433. **Phishing-Lookalike Visual Scorer** — compares login-page visuals against legitimate brand references to quantify impersonation risk.
36434. **Font-Loading Behavior Analyzer** — analyzes webfont loading for third-party font services that receive full page URLs as referrers.
36435. **Layout-Shift Anomaly Detector** — detects unexpected layout shifts that indicate injected content or overlay attacks.
36436. **Responsive-Breakpoint Security Differ** — compares security controls across breakpoints, catching mobile layouts that drop validation or auth gates.
36437. **Mobile-Viewport Visual Auditor** — audits the mobile rendering for truncated warnings, hidden consent text, and obscured security indicators.
36438. **Dark-Mode-Only Element Revealer** — checks alternate themes for elements (debug badges, test banners) visible only in non-default modes.
36439. **Print-Stylesheet Leakage Checker** — renders the print stylesheet to find content exposed in print views but hidden on screen.
36440. **Screenshot PII Redactor for Reports** — automatically blurs faces, names, and sensitive data in evidence screenshots before report export.
36441. **Visual Evidence Cropper and Annotator** — crops screenshots to the proving region and overlays numbered annotations linked to description claims.
36442. **DOM-Screenshot Element Highlighter** — highlights the exact DOM element in the screenshot that a finding references, removing ambiguity.
36443. **Form-Field Purpose Classifier** — fuses visual labels with DOM attributes to classify each field's purpose (password, card, SSN) for data-flow analysis.
36444. **Required-Field Visual Inferencer** — infers required fields from visual cues (asterisks, styling) when markup omits the required attribute.
36445. **Validation-Message Visual Reader** — reads inline validation messages via OCR to learn the server's actual validation rules.
36446. **Inline-Error Visual Correlator** — correlates visual error placement with the triggering field to map validation logic precisely.
36447. **Loading-State Race Visualizer** — visualizes loading and skeleton states to spot race windows where actions can be double-submitted.
36448. **Skeleton-Screen Data-Leak Checker** — checks skeleton placeholders for real data leaked in placeholder text or attributes.
36449. **Toast and Notification Content Interceptor** — captures toast messages visually since they often reveal internal errors absent from the DOM.
36450. **Clipboard-Operation Visual Monitor** — watches for clipboard reads and writes during interactions that could exfiltrate pasted secrets.
36451. **Drag-and-Drop Handler Visual Mapper** — maps drop zones visually to find upload or action triggers invisible in static markup.
36452. **File-Picker Dialog Analyzer** — analyzes file-picker configurations for accept-attribute gaps the server must independently enforce.
36453. **Color-Picker and Hash Input Inspector** — inspects color and hash inputs for injection vectors in downstream processing.
36454. **Date-Picker Boundary Tester** — tests date inputs visually for boundary and logic flaws (past dates, far futures) the widget permits.
36455. **Rich-Text Toolbar Capability Mapper** — maps toolbar capabilities (source mode, embeds) to stored-XSS-relevant features.
36456. **Map-Widget Interaction Surface Mapper** — maps map-widget interactions (search, geocode) to SSRF and key-exposure surfaces.
36457. **Chart-Library Data Exposure Reader** — reads chart data series from rendered visuals to find over-fetched datasets behind dashboards.
36458. **Dashboard Widget Permission Differ** — visually compares dashboards across roles to find widgets leaking data to lower-privilege users.
36459. **Visual Role-Based Access Differ** — screenshots the same pages as different roles and diffs them to expose authorization gaps.
36460. **Screenshot-Based Session State Reader** — reads login state visually (avatars, nav changes) to verify session behavior independently of cookies.
36461. **Logged-In vs Logged-Out Visual Differ** — diffs authenticated and anonymous renderings to find content served without proper gating.
36462. **Visual Redirect-Chain Follower** — follows redirects visually to catch landing pages that differ from what status codes suggest.
36463. **Iframe-Embed Visual Inventory** — inventories embedded iframes visually, including ones injected at runtime that static parsing misses.
36464. **Cross-Origin Frame Visual Detector** — detects cross-origin frames visually and assesses their postMessage and clickjacking exposure.
36465. **Shadow-DOM Visual Penetrator** — uses visual rendering to reason about shadow-DOM-encapsulated components that DOM queries cannot pierce.
36466. **Web-Component Encapsulation Checker** — verifies custom elements do not leak internal state or actions through their rendered surface.
36467. **Custom-Element Behavior Mapper** — maps custom-element behaviors from visual interaction since their internals are encapsulated.
36468. **Video-Player Endpoint Extractor** — extracts stream URLs and token parameters from video-player network traffic correlated with the visual player.
36469. **Audio-Player Stream URL Miner** — mines audio stream endpoints and their authorization from player behavior.
36470. **Live-Stream Token Leakage Checker** — checks live-stream URLs for tokens visible in network logs that grant replay access.
36471. **3D-Model Asset URL Harvester** — harvests 3D asset and texture URLs that may expose unlisted storage buckets.
36472. **PDF-Viewer Embedded-Link Extractor** — extracts links and form actions from in-browser PDF viewers for open-redirect and XSS review.
36473. **Document-Preview Data Exposure Tester** — tests document previews for full-file content accessible beyond the preview's intended scope.
36474. **Spreadsheet-Preview Formula Leak Checker** — checks spreadsheet previews for formula content and hidden sheets exposed to viewers.
36475. **Code-Block Renderer Escape Tester** — tests syntax-highlighted code blocks for HTML-escaping failures that enable stored XSS.
36476. **Syntax-Highlighter Injection Surface** — maps highlighter-supported languages to parser-differential injection opportunities.
36477. **Emoji and Unicode Rendering Differ** — compares Unicode handling across visual and DOM layers to find normalization-based bypasses.
36478. **RTL-Layout Security Differ** — checks right-to-left layouts for mirrored UI that obscures security warnings or swaps action meanings.
36479. **Zoom-Level Element Exposure Tester** — tests extreme zoom levels for elements (debug info, hidden text) that appear only when layout breaks.
36480. **Viewport-Size Conditional Content Revealer** — resizes the viewport to reveal conditionally rendered content with weaker controls.
36481. **Scroll-Triggered Content Loader Mapper** — maps infinite-scroll and lazy-load triggers to their data endpoints for authorization testing.
36482. **Infinite-Scroll Endpoint Harvester** — harvests paginated data endpoints from scroll behavior, including their cursor and filter parameters.
36483. **Virtualized-List Data-Window Analyzer** — analyzes virtualized lists for data windows fetchable beyond the visible slice.
36484. **Tab-Switch Content Differ** — diffs tab contents to find tabs loading privileged data before their access check completes.
36485. **Accordion-Expansion Data Revealer** — expands accordions programmatically to test whether hidden sections enforce authorization.
36486. **Hover-Reveal Content Interceptor** — intercepts hover-revealed content (tooltips, previews) that may skip access checks applied to clicks.
36487. **Focus-Order Logic Flaw Mapper** — maps keyboard focus order to find workflows completable out of sequence via tab navigation.
36488. **Keyboard-Trap and Focus Security Noter** — notes focus traps in auth dialogs that could be abused for UI-redressing.
36489. **Screen-Reader-Only Content Auditor** — audits visually-hidden screen-reader text for sensitive content exposed to assistive tech.
36490. **Reduced-Motion Alternate-Path Checker** — checks reduced-motion fallbacks for alternate code paths with weaker validation.
36491. **High-Contrast-Mode Element Differ** — renders high-contrast mode to surface elements hidden by styling but present in the accessibility layer.
36492. **Visual Regression Baseline Builder** — builds screenshot baselines per page so future hunts detect meaningful visual changes automatically.
36493. **Pixel-Level Tamper Detector** — detects pixel-level anomalies indicating injected overlays or tampered rendering.
36494. **Screenshot Hash-Change Alerter** — alerts when a page's visual hash changes between hunt phases, signaling dynamic or personalized content.
36495. **Multi-Viewport Evidence Collector** — captures desktop, tablet, and mobile evidence sets so findings hold across form factors.
36496. **Visual Hunt Timeline Storyboarder** — assembles key screenshots into a visual storyboard narrating the hunt from recon to proof.
36497. **Annotated Visual Proof Composer** — composes multi-frame annotated proof sequences that walk a reader through exploitation visually.
36498. **Visual False-Positive Reviewer** — re-examines flagged findings against their screenshots to visually confirm or dismiss them.
36499. **Screenshot-Evidence Deduplicator** — perceptual-hashes evidence screenshots to deduplicate near-identical captures across findings.
36500. **Cross-Modal Contradiction Detector** — flags cases where the screenshot, DOM, and network log disagree, forcing re-observation before conclusions.
36501. **Modality-Confidence Weighter** — weights each modality's contribution to a conclusion by its measured reliability for the current page type.
36502. **Missing-Modality Degradation Handler** — defines how reasoning proceeds honestly when a modality is unavailable (no screenshots in headless API hunts).
36503. **Modality-Ablation Self-Test** — periodically re-runs analyses with one modality removed to measure how much each contributes to finding yield.
36504. **Unified Multi-Modal Hunt Summary Narrator** — narrates the final hunt summary weaving visual, structural, and network evidence into one coherent account.
36505. **Logit-to-Confidence Calibration Layer** — maps raw model logits to honest confidence scores through a learned calibration function instead of exposing uncalibrated probabilities.
36506. **Temperature-Scaling Tuner per Model** — fits a temperature parameter per brain model on held-out hunt outcomes so confidence matches empirical accuracy.
36507. **Platt-Scaling Adapter for Finding Scores** — fits a logistic adapter converting raw finding scores into calibrated probabilities of being true positives.
36508. **Isotonic-Regression Calibrator** — applies non-parametric isotonic regression for calibration curves that parametric methods cannot capture.
36509. **Per-Phase Calibrator Bank** — maintains separate calibrators for recon, probing, exploitation, and reporting since each phase has different accuracy profiles.
36510. **Per-Vulnerability-Class Calibrator** — calibrates confidence separately per vulnerability class because the model is systematically overconfident on some classes.
36511. **Per-Target-Type Calibration Profiles** — loads calibration profiles tuned for APIs, SPAs, mobile backends, and legacy apps, each with distinct base rates.
36512. **Reliability-Diagram Generator** — plots predicted confidence against observed accuracy per bin, giving analysts a visual calibration health check.
36513. **Expected-Calibration-Error Tracker** — continuously computes ECE over recent confirmed and refuted findings as the headline calibration metric.
36514. **Maximum-Calibration-Error Alerter** — pages the team when worst-bin calibration error exceeds tolerance, signaling a miscalibrated model or prompt.
36515. **Confidence-Bin Accuracy Auditor** — audits each confidence decile's empirical accuracy and reports bins where the model systematically lies to itself.
36516. **Ground-Truth Outcome Logger** — records every finding's final verdict (confirmed, false positive, inconclusive) as labeled data for calibration fitting.
36517. **Calibration Training-Set Curator** — curates a balanced, deduplicated set of past findings with verified outcomes dedicated to calibration training.
36518. **Temporal Calibration Drift Detector** — detects when calibration degrades over weeks as targets and models evolve, triggering refits.
36519. **Recalibration Scheduler** — automatically refits calibrators on a schedule or when drift exceeds threshold, with versioned calibration artifacts.
36520. **Online Calibration Updater** — updates calibration incrementally as each new verified outcome arrives, without full retraining.
36521. **Human-Verdict Feedback Ingestor** — ingests analyst confirm/reject verdicts as ground-truth labels that directly tune the calibration layer.
36522. **Analyst-Override Calibration Signal** — treats severity or confidence overrides by analysts as calibration training signals, not just UI edits.
36523. **Selective-Prediction Abstention Gate** — withholds findings whose calibrated confidence falls below threshold, routing them to human review instead.
36524. **Abstention-Threshold Optimizer** — tunes the abstain threshold per hunt mode to balance coverage against false-positive cost.
36525. **Low-Confidence Finding Quarantine** — segregates low-confidence findings into a quarantine view that never reaches client reports unreviewed.
36526. **Confidence-Weighted Finding Ranker** — ranks findings by calibrated confidence times impact, replacing raw model scores in prioritization.
36527. **Ensemble-Disagreement Uncertainty Estimator** — treats disagreement across model seeds as uncertainty, lowering confidence where the ensemble splits.
36528. **Multi-Seed Self-Consistency Scorer** — samples multiple reasoning traces and scores confidence by the fraction converging on the same conclusion.
36529. **Monte-Carlo Dropout Uncertainty Probe** — where the architecture permits, uses stochastic forward passes to estimate epistemic uncertainty per claim.
36530. **Bayesian Confidence Approximator** — maintains a posterior over finding-validity that updates as each new piece of evidence arrives.
36531. **Conformal-Prediction Coverage Guarantor** — emits prediction sets with statistical coverage guarantees for ambiguous cases instead of single overconfident claims.
36532. **Prediction-Set Emitter for Ambiguous Cases** — outputs the set of plausible vulnerability classes with coverage guarantees when the evidence cannot decide.
36533. **Verbalized-Confidence Normalizer** — maps the model's words ("likely", "probably", "certain") to numbers via a validated lexicon, then recalibrates them.
36534. **Token-Level Uncertainty Highlighter** — highlights the specific tokens in a generated description where the model's uncertainty concentrates.
36535. **Claim-Level Confidence Attributor** — assigns each atomic claim in a finding its own calibrated confidence instead of one blanket score.
36536. **Evidence-Strength Confidence Decomposer** — decomposes a finding's confidence into per-evidence contributions so analysts see which observation carries the weight.
36537. **Prior-vs-Posterior Confidence Tracker** — shows how confidence evolved from the initial hypothesis prior to the post-evidence posterior.
36538. **Confidence Inflation Detector** — flags findings where stated confidence exceeds what the cited evidence can support.
36539. **Overconfidence Penalty in Ranking** — downranks findings from historically overconfident model-phase combinations until recalibration proves otherwise.
36540. **Underconfidence Booster for Rare Classes** — corrects systematic underconfidence on rare vulnerability classes so they are not buried in rankings.
36541. **Class-Imbalance Calibration Corrector** — adjusts for the base-rate imbalance between common and rare finding types in calibration fitting.
36542. **Rare-Vulnerability Confidence Adjuster** — applies a documented prior adjustment so rare but critical classes get fair confidence treatment.
36543. **Novel-Target Uncertainty Inflator** — inflates uncertainty automatically when the target's stack has no precedent in the calibration data.
36544. **Out-of-Distribution Input Detector** — detects targets or responses far from the calibration distribution and caps confidence accordingly.
36545. **Distribution-Shift Confidence Dampener** — dampens confidence proportionally to measured feature drift from the calibration set.
36546. **Prompt-Variant Confidence Stabilizer** — measures confidence variance across prompt phrasings and stabilizes scores for prompt-robust claims.
36547. **Few-Shot Count Sensitivity Measurer** — quantifies how confidence shifts with example count so prompt changes do not silently inflate scores.
36548. **Chain-of-Thought Length vs Accuracy Profiler** — profiles the relationship between reasoning length and correctness to calibrate long-trace claims.
36549. **Reasoning-Trace Confidence Extractor** — extracts per-step confidence from the reasoning trace instead of relying on the final answer's tone.
36550. **Step-Level Confidence Propagator** — propagates uncertainty through multi-step reasoning so a shaky early step discounts the conclusion.
36551. **Contradiction-Driven Confidence Reducer** — automatically reduces confidence when the model's own trace contains contradictory intermediate claims.
36552. **Self-Correction Confidence Rebaseliner** — re-baselines confidence after the model corrects itself, preventing corrected claims from inheriting pre-correction certainty.
36553. **Second-Pass Verification Confidence Merger** — merges the verification pass's independent assessment with the original confidence via a documented rule.
36554. **Cross-Model Confidence Harmonizer** — harmonizes confidence scales across different brain models so scores are comparable in mixed-model hunts.
36555. **Judge-Model Agreement Weighter** — weights the primary model's confidence by agreement with an independent judge model's assessment.
36556. **Human-Baseline Calibration Anchor** — anchors the calibration scale to measured human-analyst accuracy on the same fixture set.
36557. **Inter-Analyst Agreement Benchmark** — uses analyst-to-analyst agreement rates as the realistic ceiling that model confidence should not exceed.
36558. **Severity-Conditional Calibration** — applies stricter calibration to high-severity claims, requiring stronger evidence for the same stated confidence.
36559. **Asymmetric-Cost Threshold Tuner** — tunes decision thresholds with explicit false-negative vs false-positive costs per engagement type.
36560. **Precision-Recall Confidence Frontier Mapper** — maps the achievable precision-recall frontier across confidence thresholds for each hunt mode.
36561. **Operating-Point Selector per Hunt Mode** — selects the confidence operating point per mode (stealth, thorough, quick) from the mapped frontier.
36562. **Confidence Decay with Evidence Age** — decays finding confidence as supporting observations age without re-confirmation.
36563. **Stale-Observation Confidence Discount** — discounts confidence contributions from observations older than a configurable freshness window.
36564. **Corroboration Confidence Booster** — boosts confidence only when independent evidence types corroborate, with diminishing returns per additional source.
36565. **Independent-Evidence Multiplier** — multiplies confidence gains only across evidentially independent observations, not repeated views of the same signal.
36566. **Single-Source Confidence Cap** — caps confidence for findings supported by only one observation, regardless of how strong it looks.
36567. **Hearsay-vs-Observed Confidence Tiering** — tiers confidence by evidence provenance: directly observed, tool-reported, model-inferred, or assumed.
36568. **Tool-Output vs Model-Inference Confidence Split** — reports separate confidence for what tools measured versus what the model inferred from it.
36569. **Deterministic-Check Confidence Override** — lets a passing deterministic verification test pin confidence high regardless of the model's prior uncertainty.
36570. **Proof-of-Concept Success Confidence Lock** — locks confidence at the top tier only after a clean, replayed proof-of-concept execution.
36571. **Failed-Reproduction Confidence Nullifier** — zeroes confidence when a claimed reproduction fails under controlled retry, pending new evidence.
36572. **Partial-Reproduction Confidence Limiter** — caps confidence when reproduction succeeds only partially or intermittently, with the gap documented.
36573. **Environment-Dependent Confidence Noter** — annotates confidence with the environment it was measured in, since staging behavior may not transfer.
36574. **Flaky-Behavior Confidence Penalizer** — penalizes confidence for targets exhibiting flaky or non-deterministic responses during the hunt.
36575. **Time-of-Day Variance Confidence Adjuster** — adjusts confidence when target behavior varies by time (batch jobs, deploys), noting the observation window.
36576. **Target-Churn Confidence Discount** — discounts confidence when the target changed mid-hunt (deploys, config changes) after evidence was collected.
36577. **WAF-Evasion Uncertainty Adder** — adds explicit uncertainty when WAF evasion was required, since filtered responses may hide contradictory evidence.
36578. **Rate-Limit-Censored Evidence Discount** — discounts confidence when rate limiting censored the probe set, leaving parts of the surface untested.
36579. **Incomplete-Scan Coverage Confidence Cap** — caps overall hunt confidence by measured coverage of the discovered attack surface.
36580. **Unexplored-Surface Uncertainty Noter** — explicitly lists unexplored areas and their uncertainty contribution in the hunt summary.
36581. **Assumption-Explicit Confidence Ledger** — ledgers every assumption behind a finding with its individual confidence impact.
36582. **Assumption-Count Confidence Penalty** — penalizes findings stacking many untested assumptions, formalizing that assumption chains are fragile.
36583. **Default-Credential Prior Calibrator** — calibrates priors for default-credential findings against their measured hit rate per device and software class.
36584. **Base-Rate Adjuster per Industry** — adjusts finding priors by industry base rates so rare-in-context findings are not over-claimed.
36585. **Target-Popularity Prior Setter** — sets priors from how commonly the target's stack appears in the wild, informing exploit-likelihood judgments.
36586. **Calibration Report Card Emitter** — emits a per-hunt calibration report card showing ECE, bin accuracies, and abstention rates.
36587. **Calibration Leaderboard per Model Version** — ranks brain models and versions by calibration quality, not just raw finding counts.
36588. **Miscalibration Incident Logger** — logs every high-confidence false positive as a miscalibration incident with a post-mortem template.
36589. **Confidence Audit Trail Exporter** — exports the full confidence computation trail (inputs, weights, adjustments) for external audit.
36590. **Honest-Uncertainty Wording Injector** — injects plain-language uncertainty statements ("we could not determine X") wherever confidence is low.
36591. **Confidence-Interval Reporter (AI-model context)** — reports confidence as intervals (70–85%) instead of false-precision point estimates.
36592. **Qualitative-Confidence Mapper** — maps calibrated scores to defined low/medium/high bands with published band definitions.
36593. **User-Facing Confidence Explainer** — explains in plain language what a confidence score means and what would raise it.
36594. **Calibration-Aware Hunt Prioritizer** — prioritizes hunt actions using calibrated expected value rather than raw model enthusiasm.
36595. **Low-Confidence Probe Suggester** — suggests the cheapest probe that would most raise a finding's confidence, turning uncertainty into action.
36596. **Information-Value-of-Probe Estimator** — estimates the expected confidence gain per probe to guide efficient verification spending.
36597. **Confidence-Satisficing Stop Rule** — stops verification when confidence crosses the decision threshold, avoiding over-testing.
36598. **Diminishing-Returns Confidence Cutoff** — halts evidence gathering when marginal confidence gain per probe drops below threshold.
36599. **Calibrated Auto-Escalation Trigger** — escalates findings to humans only when calibrated confidence and impact jointly cross the escalation line.
36600. **Calibration Health Dashboard** — dashboards calibration metrics per model, phase, and vulnerability class with trend lines.
36601. **Per-Analyst Calibration Personalizer** — personalizes confidence presentation to each analyst's demonstrated trust calibration with the system.
36602. **Team-Level Calibration Aggregator** — aggregates calibration statistics across the team to set organization-wide confidence policies.
36603. **Calibration Data Retention Policy** — governs retention and anonymization of the labeled outcomes used for calibration fitting.
36604. **Never-Certain Safety Cap** — enforces a maximum reportable confidence below 100% so the system can never claim absolute certainty.
36605. **Evidence-Entailment Claim Verifier** — checks every AI assertion for logical entailment by the stored evidence, rejecting claims the evidence does not support.
36606. **Stored-Evidence Cross-Checker** — replays each factual claim against the hunt's evidence store (logs, snapshots, responses) before it can become a finding.
36607. **Claim-to-Log-Line Citation Binder** — binds every factual sentence to the specific log lines that prove it, with unbound sentences flagged for review.
36608. **Contradiction Detector** — compares claims against captured responses and flags any assertion the raw evidence directly contradicts.
36609. **Numeric-Claim Fact Checker** — verifies every number in generated text (endpoint counts, payload sizes, version numbers) against measured values.
36610. **URL-Existence Verifier for Cited Endpoints** — confirms every endpoint URL mentioned in a finding was actually observed or probed during the hunt.
36611. **Parameter-Name Reality Checker** — verifies each named parameter appeared in real requests or responses, catching invented parameter names.
36612. **Header-Name Reality Checker** — verifies each cited header was actually observed, blocking hallucinated security headers.
36613. **Fetched-Source Fidelity Checker** — byte-compares quoted code snippets against the actually fetched files to catch misquoted or invented code.
36614. **Screenshot-Claim Visual Confirmer** — requires visual claims ("the admin panel shows…") to match an annotated region in a captured screenshot.
36615. **Timestamp Consistency Auditor** — checks that all times and sequences claimed in the narrative are consistent with the event log.
36616. **Version-Number Corroborator** — corroborates every stated software version against banner grabs and fingerprinting output.
36617. **CVE-Reference Validity Checker** — validates cited CVE IDs exist and actually describe the claimed vulnerability class.
36618. **CWE-Assignment Plausibility Filter** — rejects CWE assignments that contradict the finding's own described mechanism.
36619. **Severity-Evidence Alignment Checker** — flags severity ratings that the documented impact evidence cannot justify.
36620. **CVSS-Vector Evidence Binder** — requires each CVSS metric value to cite the observation that justifies it, blocking invented vectors.
36621. **Self-Consistency Sampler** — generates the same finding description multiple times and flags claims that vary across samples.
36622. **Paraphrase-Robustness Tester** — re-asks the model for the same facts in paraphrased form and flags answers that change.
36623. **Negation-Probe Stability Check** — asks the model the negated question ("is X NOT true?") and flags claims that flip under negation.
36624. **Retrieval-Grounded Regenerator** — regenerates suspect passages with only retrieved evidence in context, dropping anything that cannot be re-derived.
36625. **Claim Provenance Tracker** — records the origin of every claim (tool output, observation, inference, assumption) for downstream verification.
36626. **Assertion Lineage Grapher** — builds a lineage graph from raw observations to final claims so reviewers can trace any statement to its source.
36627. **Model-Memory vs Observation Separator** — explicitly labels which parts of a finding came from model knowledge versus this hunt's observations.
36628. **Training-Knowledge Cutoff Flag** — flags claims relying on training knowledge newer than the model's cutoff or about fast-moving software.
36629. **Generic-Advice vs Target-Specific Splitter** — separates boilerplate security advice from target-specific claims so only the latter require evidence.
36630. **Template-Filler Hallucination Guard** — detects template slots the model filled with plausible-sounding but unevidenced values.
36631. **Placeholder Leakage Detector** — catches unreplaced placeholders (TODO, [insert], example.com) before they reach reports.
36632. **Copy-Paste Artifact Scanner** — detects text fragments copied from other findings or hunts that do not match the current target.
36633. **Cross-Hunt Contamination Checker** — ensures details from previous hunts (hostnames, tokens, paths) never leak into the current hunt's narrative.
36634. **Wrong-Target Claim Filter** — verifies every named host, domain, and IP belongs to the current hunt's authorized scope.
36635. **Stale-Hunt Data Bleed Detector** — detects evidence-store entries from older hunts contaminating current-hunt claims.
36636. **Session-Mixing Hallucination Guard** — prevents claims that mix observations from different sessions, roles, or environments.
36637. **User-Turn Confabulation Checker** — verifies the model never invents user statements or approvals that did not occur in the chat history.
36638. **Tool-Output Fabrication Detector** — flags claimed tool results with no corresponding tool invocation in the execution log.
36639. **Phantom-Tool-Result Identifier** — identifies findings resting on tool outputs that were never actually produced during the hunt.
36640. **Unrun-Command Claim Catcher** — catches exploit steps described as executed when the command log shows they never ran.
36641. **Parsed-Data Fidelity Auditor** — verifies parsed values (JSON fields, extracted tokens) match the raw source they were parsed from.
36642. **Truncation-Aware Claim Limiter** — restricts claims to the portion of evidence actually seen when responses were truncated.
36643. **Partial-Response Overclaim Guard** — blocks conclusions drawn from incomplete responses as if the full response had been observed.
36644. **Timeout-Gap Confabulation Blocker** — prevents the model from filling timeout gaps with assumed server behavior.
36645. **Rate-Limit Blind-Spot Noter** — forces explicit acknowledgment of what could not be tested due to rate limiting instead of silent omission.
36646. **JavaScript-Render Gap Acknowledger** — requires the model to state when conclusions rest on unrendered HTML rather than the real DOM.
36647. **Auth-State Assumption Flag** — flags any claim that assumes an authentication state not verified in the session log.
36648. **Role-Assumption Verifier** — verifies role-based claims against the actual authenticated role used during probing.
36649. **Environment-Assumption Lister** — forces listing of environment assumptions (staging vs prod) behind every finding.
36650. **Unverified-Claim Quarantine Queue** — holds claims that fail verification in a quarantine queue, excluded from reports until resolved.
36651. **Claim Severity-of-Hallucination Tierer** — tiers hallucinations by blast radius (wrong severity vs invented vulnerability) for proportional response.
36652. **Auto-Demotion to Suggestion** — demotes unverifiable claims to clearly-labeled suggestions instead of deleting the potentially useful signal.
36653. **Human Review Escalation Router** — routes quarantined claims to reviewers with the evidence gap precisely identified.
36654. **Reviewer-Decision Learning Loop** — learns from reviewer uphold/overturn decisions to sharpen future verification thresholds.
36655. **False-Claim Pattern Miner** — mines recurring false-claim patterns to identify the prompts and phases that produce them.
36656. **Repeat-Offender Prompt Segment Identifier** — identifies the specific prompt segments most associated with hallucinated output for targeted rewrites.
36657. **Hallucination Hotspot Heatmapper** — heatmaps hallucination rates across hunt phases to focus verification effort where fabrication concentrates.
36658. **Per-Model Hallucination Rate Tracker** — tracks hallucinations per thousand claims for each brain model and version.
36659. **Hallucination Regression Suite** — runs a fixed set of hallucination traps on every model or prompt change to catch regressions.
36660. **Adversarial Hallucination Probe Set** — maintains adversarial prompts designed to elicit fabrication, used as a standing robustness test.
36661. **Leading-Question Robustness Tester** — tests whether suggestive analyst questions cause the model to confirm unevidenced premises.
36662. **Sycophancy Detector** — detects when the model agrees with a wrong user premise instead of correcting it with evidence.
36663. **Hedged-Hallucination Catcher** — catches fabricated details smuggled inside hedged language ("might be X" where X is invented).
36664. **Confident-Wrong Flag** — escalates claims stated with high confidence but zero supporting evidence as the most dangerous hallucination class.
36665. **Detail-Density Suspicion Scorer** — scores passages where suspiciously rich detail appears without commensurate evidence.
36666. **Over-Specificity Hallucination Signal** — treats hyper-specific unevidenced details (exact internal hostnames, precise versions) as fabrication signals.
36667. **Round-Number Suspicion Checker** — questions suspiciously round impact numbers that lack a stated measurement basis.
36668. **Perfect-Recall Skeptic** — challenges claims of verbatim recall of long strings (tokens, keys) not present in the evidence store.
36669. **Quote-Verbatim Verifier** — verifies every quotation against its source, catching paraphrases presented as verbatim.
36670. **Diff-Claim Patch Verifier** — verifies claimed code diffs apply cleanly to the observed code, catching invented context lines.
36671. **Exploit-Step Executability Checker** — dry-runs described exploit steps for executability, catching impossible or incoherent sequences.
36672. **Command-Syntax Reality Tester** — validates the syntax of commands in PoCs against real tool grammars before publication.
36673. **Payload-Encoding Correctness Verifier** — verifies payload encodings decode to the claimed values, catching garbled or fake payloads.
36674. **File-Path Existence Checker** — verifies every cited file path was actually observed on the target or in fetched code.
36675. **Assumed-File Hallucination Guard** — blocks claims about files never listed, fetched, or referenced in observed responses.
36676. **Directory-Listing Claim Verifier** — verifies claimed directory contents against actual listing output or brute-force results.
36677. **Service-Banner Claim Corroborator** — corroborates claimed service identities against captured banners and handshake data.
36678. **Technology-Stack Claim Grounding** — grounds every stack claim in fingerprinting output, blocking framework attributions from thin air.
36679. **Framework-Version Claim Checker** — verifies stated framework versions against detected version signals.
36680. **Dependency-Name Reality Filter** — filters dependency names against the observed lockfile or bundle inventory.
36681. **Person-Name Fabrication Guard** — blocks invented employee or contact names in social-engineering-adjacent narratives.
36682. **Internal-Hostname Hallucination Filter** — rejects internal hostnames never seen in DNS, certificates, or responses.
36683. **IP-Address Claim Verifier** — verifies every cited IP appeared in scan output, DNS, or response headers.
36684. **Credential-Claim Redaction Enforcer** — redacts any credential values the model reproduces, even when the claim itself is verified.
36685. **Secret-Value Fabrication Blocker** — blocks the model from inventing plausible-looking secret values to complete a narrative.
36686. **Token-Content Claim Restrictor** — restricts claims about token contents to fields actually decoded from observed tokens.
36687. **PII-Claim Minimization Guard** — minimizes PII in claims to the least necessary for the finding, regardless of what was observed.
36688. **Legal-Claim Disclaimer Injector** — injects disclaimers where findings touch legal conclusions (compliance violations) the model cannot assert.
36689. **Compliance-Assertion Verifier** — verifies compliance claims against the actual control text, blocking invented requirement mappings.
36690. **Timeline-Claim Sequencer** — validates the claimed event order against timestamps in the evidence log.
36691. **Causal-Claim Evidence Requirer** — requires explicit causal evidence for "caused by" statements, downgrading the rest to correlation.
36692. **Root-Cause Claim Substantiator** — demands the code or config proof behind every stated root cause before it ships.
36693. **Impact-Number Source Binder** — binds every impact number (records exposed, users affected) to its counting method and source query.
36694. **Affected-User-Count Sanity Checker** — sanity-checks user-impact numbers against the target's plausible user base.
36695. **Financial-Impact Figure Flag** — flags monetized impact figures for human review since models systematically misjudge them.
36696. **Hallucination-Free Regeneration Pass** — regenerates flagged passages under strict evidence-only constraints and diffs the result.
36697. **Evidence-First Rewrite Engine** — rewrites findings starting from the evidence list upward, rather than editing the hallucinated text downward.
36698. **Minimal-Claim Compressor** — compresses each finding to the smallest claim set its evidence fully supports, moving the rest to notes.
36699. **Claim Confidence Downgrader** — automatically lowers confidence on claims that survive verification only partially.
36700. **Verified-Claim Badge Emitter** — badges claims that passed full verification so readers can distinguish them at a glance.
36701. **Evidence-Coverage Meter per Finding** — meters what fraction of a finding's claims are evidence-backed, shown as a coverage bar.
36702. **Unverifiable-Section Labeler** — explicitly labels sections that cannot be verified (analyst judgment, recommendations) as such.
36703. **Hallucination Incident Post-Mortem Logger** — logs every caught hallucination with cause analysis feeding prompt and calibration fixes.
36704. **Brain-Hygiene Scorecard** — publishes a per-model hygiene scorecard (hallucination rate per thousand claims) with trend lines.
36705. **Deterministic-Rules Takeover Engine** — when the primary brain is unavailable, a deterministic rule engine takes over probing and detection with zero model calls.
36706. **Logged Capability-Downgrade Announcer** — records every fallback activation with the lost capabilities, the engaged tier, and the trigger, visible in the hunt timeline.
36707. **Degradation Tier Ladder** — defines five explicit degradation tiers (full brain → assisted → rules → signatures → read-only) with entry and exit criteria.
36708. **Per-Phase Degradation Planner** — pre-plans which fallback tier each hunt phase drops to, so recon, probing, and reporting degrade independently.
36709. **Recon-Phase Rule-Based Fallback** — keeps reconnaissance running on pure fingerprinting and enumeration rules when the brain is down.
36710. **Probe-Phase Signature Fallback** — continues vulnerability probing with a signature and payload library when generative payload crafting is unavailable.
36711. **Report-Phase Template Fallback** — generates structured reports from finding templates and evidence slots when the writing brain is offline.
36712. **Graceful Feature-Shedding Order** — sheds features in a fixed priority order (polish first, core detection last) so degradation is predictable.
36713. **Cached-Brain Response Replayer** — replays cached responses from the healthy brain for repeated query patterns during an outage.
36714. **Last-Known-Good Model Pinner** — pins hunts to the last verified-good model version when a new brain version starts failing.
36715. **Distilled Local Model Standby** — keeps a small distilled model warm locally as the first fallback tier before dropping to pure rules.
36716. **Tiny-Model Triage Mode** — runs triage (finding vs noise) on a tiny local model while the primary brain recovers.
36717. **Heuristic Scanner Fleet** — maintains a fleet of no-LLM heuristic scanners (header checks, error-pattern matchers) that run regardless of brain health.
36718. **Signature-Based Vuln Matcher** — matches responses against a versioned signature database of known-vulnerable behaviors as a brain-independent detector.
36719. **Regex-Rule Detection Pack** — ships a maintained pack of detection regexes (secrets, stack traces, debug markers) usable with no model at all.
36720. **Header-Analysis Rule Engine** — evaluates security headers against a hardcoded policy matrix when the brain cannot reason about them.
36721. **Response-Pattern Rule Library** — classifies responses (error disclosure, auth failure, WAF block) with deterministic pattern rules.
36722. **Known-Bad-Config Rule Set** — checks configurations against a curated bad-config list (default creds, wildcards, debug flags) without model inference.
36723. **Health-Check Degradation Probes** — runs synthetic canary prompts through the brain continuously to detect degradation before hunts feel it.
36724. **Brain-Availability Monitor** — monitors brain latency, error rate, and output sanity as a dedicated health signal feeding the fallback ladder.
36725. **Latency-Triggered Fallback Switch** — engages the next degradation tier when brain latency exceeds the hunt's responsiveness budget.
36726. **Error-Rate-Triggered Failover** — fails over when the brain's error rate crosses threshold within a rolling window.
36727. **Quality-Triggered Degradation** — engages fallback when a nonsense detector flags degrading output quality (repetition, incoherence, refusals).
36728. **Cost-Triggered Tier Step-Down** — steps down to cheaper tiers when spend rate would breach the hunt's budget before completion.
36729. **Quota-Exhaustion Handler** — switches tiers gracefully on quota exhaustion instead of failing mid-hunt, preserving completed work.
36730. **Rate-Limit Backoff Coordinator** — coordinates exponential backoff with jitter across brain providers and schedules tier step-down during long limits.
36731. **Queue-and-Resume Orchestrator** — queues brain-dependent tasks during outages and resumes them in order when capacity returns.
36732. **Hunt State Checkpointing for Failover** — checkpoints full hunt state before every tier transition so no evidence or progress is lost.
36733. **Mid-Hunt Brain-Swap Continuity** — swaps brains mid-hunt with a compressed context handoff, continuing the same investigation seamlessly.
36734. **Context-Handoff Compressor** — compresses hunt context to fit smaller fallback models without losing the critical evidence and decisions.
36735. **Capability-Matrix per Brain Tier** — publishes exactly which capabilities each tier supports so planners never request impossible work.
36736. **Downgrade Disclosure in UI** — shows a persistent, honest banner naming the active tier and its limitations during degraded hunts.
36737. **Downgrade Watermark on Reports** — watermarks reports produced under degradation with the tier and the affected sections.
36738. **Finding-Confidence Penalty under Degradation** — automatically discounts finding confidence produced by lower tiers with a documented penalty table.
36739. **Manual-Review Escalation on Degraded Findings** — routes all high-severity findings from degraded tiers to mandatory human review.
36740. **Human-in-the-Loop Trigger Points** — defines the exact tier-phase combinations that require human approval before proceeding.
36741. **Offline-Mode Hunt Continuation** — continues hunts fully offline using local rules, cached knowledge, and queued sync for later.
36742. **Air-Gapped Rule Pack** — ships a self-contained detection pack for air-gapped deployments with no brain connectivity at all.
36743. **No-Network Static Analysis Fallback** — falls back to static analysis of already-fetched code and responses when the network drops.
36744. **Precomputed Knowledge Snapshots** — caches vulnerability intelligence snapshots locally so fallback tiers reason from fresh-enough data.
36745. **Embedded Vuln-DB Fallback Copy** — embeds a compressed vulnerability database in the fallback tier for offline CVE and CWE lookups.
36746. **Cached Fingerprint Database** — serves technology fingerprints from a local cache when live fingerprinting services are unreachable.
36747. **Local CVE Mirror for Fallback** — maintains a periodically synced local CVE mirror that fallback tiers query deterministically.
36748. **Deterministic Payload Library** — provides a versioned, tested payload set that fallback tiers use instead of generating payloads.
36749. **Safe-Payload-Only Degraded Mode** — restricts degraded tiers to provably safe payloads, disabling anything with side-effect risk.
36750. **Read-Only Recon under Degradation** — limits degraded tiers to read-only reconnaissance when active probing cannot be safely supervised.
36751. **Active-Probing Kill-Switch on Downgrade** — automatically halts active probing on downgrade until a human or policy re-enables it.
36752. **Conservative-Scanning Governor** — throttles request rates and payload aggressiveness automatically in degraded tiers.
36753. **Degraded-Mode Audit Logger** — logs every action taken under degradation with tier annotations for post-hunt review.
36754. **Fallback Decision Explainer** — explains in plain language why fallback engaged, what changed, and what it means for results.
36755. **Failover Timeline Recorder** — records the precise timeline of tier transitions for incident review and SLA accounting.
36756. **Recovery Detection and Auto-Repromote** — detects brain recovery via canary checks and promotes back up the ladder automatically.
36757. **Brain-Health Scoring** — scores each brain provider on latency, accuracy, and cost to inform tier routing decisions.
36758. **Flapping-Brain Stabilizer** — adds hysteresis to tier transitions so a flapping brain does not oscillate the hunt between tiers.
36759. **Canary-Request Health Checker** — sends periodic canary requests with known-good answers to verify brain sanity before promotion.
36760. **Synthetic Self-Test Suite on Failover** — runs a synthetic detection test on every failover to verify the fallback tier actually works.
36761. **Degraded-Capability Self-Test** — self-tests the fallback tier's detection capability against fixture findings after each engagement.
36762. **Fallback Coverage Gap Reporter** — reports exactly which hunt capabilities have no fallback coverage, driving rule-pack development.
36763. **Uncovered-Phase Honesty Noter** — honestly notes phases that cannot run degraded instead of silently skipping them.
36764. **Partial-Degradation Compositor** — composes hunts where some phases use the brain and others use rules, tracked per phase.
36765. **Phase-Router under Degradation** — routes each hunt phase to the best available tier independently rather than degrading the whole hunt.
36766. **Priority-Phase Protector** — keeps the highest-value phases (exploit analysis) on the best available brain while shedding lower-value ones first.
36767. **Sacrificial-Phase Selector** — selects which phases to shed first under pressure based on finding-yield contribution data.
36768. **Multi-Brain Consensus Fallback** — falls back to consensus across several weak models when no single strong brain is available.
36769. **Voting Ensemble of Weak Models** — combines votes from small local models with a documented quorum rule for degraded decisions.
36770. **Rule-plus-Model Hybrid Adjudicator** — adjudicates disagreements between rules and the degraded model with a transparent precedence policy.
36771. **Confidence-Gated Rule Override** — lets high-confidence deterministic rules override low-confidence degraded-model output.
36772. **Model-Disagreement Arbiter** — arbitrates when fallback tiers disagree, escalating true conflicts to humans with both sides shown.
36773. **Stale-Model Warning Banner** — warns when a pinned model version falls behind security-relevant updates.
36774. **Model-Version Pinning Control** — gives operators explicit control over which model version each tier uses, with change approval.
36775. **Rollback-to-Previous-Model Action** — provides a one-click rollback to the previous model version when a new version degrades hunt quality.
36776. **Shadow-Mode New-Brain Evaluator** — evaluates new brain versions in shadow mode against live hunts before they join the ladder.
36777. **Traffic-Split Brain Router** — splits hunt traffic across brain providers by configured weights for resilience and comparison.
36778. **Cost-Aware Brain Selector** — selects brain tiers by expected cost per finding, not just capability, within policy bounds.
36779. **Latency-Aware Brain Selector** — routes latency-sensitive phases to the fastest adequate tier automatically.
36780. **Privacy-Aware Brain Selector** — keeps sensitive targets on local tiers and routes only sanitized work to cloud brains.
36781. **Data-Sensitivity Brain Router** — classifies hunt data sensitivity and restricts which brain tiers may process each class.
36782. **Customer-Tier Brain Allocator** — allocates brain capacity by customer tier during contention, with documented preemption rules.
36783. **Hunt-Priority Brain Preemptor** — preempts low-priority hunts' brain capacity for critical hunts under a fair preemption policy.
36784. **Scheduled-Maintenance Degradation Planner** — plans tier step-downs around provider maintenance windows instead of reacting to them.
36785. **Provider-Outage Runbook Executor** — executes a practiced runbook (traffic shift, tier drop, notifications) when a brain provider has an outage.
36786. **Multi-Provider Brain Mesh** — maintains active connections to multiple brain providers so failover is a routing change, not a cold start.
36787. **Provider-Diversity Health Monitor** — monitors provider diversity to avoid single-provider dependence creeping back in.
36788. **Credential-Rotation for Brain APIs** — rotates brain API credentials automatically with zero-downtime cutover.
36789. **Fallback Dry-Run Tester** — dry-runs the full fallback ladder on demand to prove it works before a real outage.
36790. **Chaos-Engineering Brain-Kill Drills** — periodically kills brain access in staging to verify hunts degrade gracefully in practice.
36791. **Degradation UX Copywriter** — generates honest, non-alarming user-facing copy explaining degraded mode and its implications.
36792. **Status-Page Degradation Publisher** — publishes tier status to the status page automatically during provider incidents.
36793. **SLA-Impact Estimator under Degradation** — estimates SLA impact of active degradation for customer communication.
36794. **Fallback Effectiveness Scorer** — measures whether fallback tiers still produce findings on fixtures, scoring degraded capability honestly.
36795. **Degraded-Hunt Quality Comparator** — compares degraded-hunt outcomes against full-brain baselines to quantify quality loss.
36796. **Post-Incident Brain Review Pack** — compiles the failover timeline, decisions, and outcomes into a reviewable incident pack.
36797. **Fallback Configuration Versioning** — versions the entire fallback ladder configuration so changes are reviewable and rollback-safe.
36798. **Per-Customer Fallback Policy** — lets customers set their own fallback policy (prefer accuracy vs prefer availability) per engagement.
36799. **Regulatory Fallback Constraints** — enforces data-residency and sovereignty constraints on which tiers may handle regulated targets.
36800. **Full-Fallback Autopsy Logger** — records a complete autopsy of every full fallback engagement for continuous improvement.
36801. **Brain-Swap Notification Dispatcher** — notifies operators and affected hunt owners on every brain swap with cause and tier.
36802. **Degradation Budget Tracker** — tracks degraded-mode hours against a budget, alerting before the allowance is exhausted.
36803. **Never-Fully-Blind Guarantee** — guarantees at least the heuristic rule tier always runs, so no hunt ever proceeds with zero detection.
36804. **Fallback Readiness Score** — publishes a single readiness score combining drill results, coverage, and rule-pack freshness.
36805. **Per-Phase Prompt Template Registry** — registers a versioned prompt template for every hunt phase (recon, probe, exploit, report) as the unit of experimentation.
36806. **Prompt Variant A/B Test Harness** — runs controlled A/B tests of prompt variants on live-equivalent fixture hunts with randomized assignment.
36807. **Finding-Yield Primary Metric** — measures prompt success by confirmed findings per hunt as the primary optimization objective.
36808. **False-Positive-Rate Guardrail Metric** — blocks promotion of any prompt variant that raises the false-positive rate beyond tolerance, regardless of yield gains.
36809. **Token-Cost Efficiency Metric** — scores prompts on confirmed findings per thousand tokens so winners are both effective and economical.
36810. **Latency-to-First-Finding Metric** — measures how quickly each prompt variant produces its first confirmed finding as a speed objective.
36811. **Multi-Armed Bandit Prompt Selector** — allocates live hunt traffic across prompt variants using bandit algorithms that favor current winners.
36812. **Thompson-Sampling Prompt Allocator** — uses Thompson sampling to balance exploration of new prompts against exploitation of proven ones.
36813. **Epsilon-Greedy Exploration Scheduler** — reserves a configurable exploration fraction for challenger prompts while the champion serves the rest.
36814. **Contextual Bandit per Target Type** — selects prompts contextually by target type, learning which phrasing works best for APIs versus SPAs.
36815. **Auto-Promotion Rule Engine** — promotes challenger prompts to champion automatically when they beat the champion with statistical significance.
36816. **Canary Rollout for Prompt Changes** — rolls new prompts out to a small hunt fraction first, watching guardrail metrics before wider release.
36817. **Regression-Guard Prompt Test Suite** — runs a fixed regression suite on every prompt change to catch capability losses the A/B metric might miss.
36818. **Prompt Versioning and Diff Viewer** — versions every prompt and shows word-level diffs so reviewers see exactly what changed between variants.
36819. **Prompt Change Blame Annotator** — annotates metric changes with the prompt edits that caused them for causal debugging.
36820. **Prompt Rollback One-Click** — reverts to the previous champion prompt instantly when a promoted variant misbehaves in production.
36821. **Few-Shot Example Miner** — mines the best historical hunts for demonstration examples that improve prompt performance when included.
36822. **Golden-Trajectory Curator** — curates end-to-end golden hunt trajectories as few-shot exemplars of ideal reasoning.
36823. **Negative-Example Collector** — collects prompt outputs that caused false positives as negative examples teaching the model what to avoid.
36824. **Chain-of-Thought Variant Tester** — tests reasoning-depth variants (terse vs elaborated) against finding yield and cost.
36825. **Reasoning-Depth Tuner** — tunes how much intermediate reasoning each phase's prompt requests, per phase and per model.
36826. **Role-Prompt Experimenter** — experiments with role framings (auditor, attacker, defender) measuring which yields the most findings.
36827. **Persona-Prompt Yield Comparator** — compares persona variants head-to-head on identical fixtures to isolate framing effects.
36828. **Instruction-Specificity Ladder Tester** — tests vague-to-prescriptive instruction variants to find the specificity sweet spot per task.
36829. **Output-Schema Strictness Tuner** — tunes how strictly prompts demand structured output against the resulting parse-failure rate.
36830. **JSON-Mode Reliability Improver** — iterates prompt wording specifically to maximize valid JSON output from the brain.
36831. **Structured-Output Repair Loop** — pairs prompts with an automatic repair pass that fixes malformed output and feeds the failure back into prompt tuning.
36832. **Constraint-Phrasing Optimizer** — tests "must" versus "should" versus "never" phrasings to find which constraint language models actually obey.
36833. **Negative-Instruction Tester** — measures whether "do not" instructions reduce hallucinations or merely distract the model.
36834. **Example-Order Sensitivity Checker** — checks whether few-shot example ordering changes outcomes and standardizes the robust order.
36835. **Few-Shot Count Optimizer** — finds the optimal example count per prompt where marginal yield gain falls below token cost.
36836. **Demonstration Diversity Selector** — selects few-shot examples for diversity across vulnerability classes rather than similarity to the target.
36837. **Retrieval-Augmented Prompt Injector** — injects retrieved evidence summaries and intel into prompts at measured-optimal positions.
36838. **Evidence-Summarization Prompt Tuner** — tunes the prompts that compress raw evidence into model context for minimal information loss.
36839. **Long-Context Placement Optimizer** — tests placement of critical instructions (start, middle, end) in long contexts against compliance rates.
36840. **Lost-in-the-Middle Mitigator** — restructures prompts so middle-positioned evidence is not ignored, verified by attention-probe tests.
36841. **Context-Compression Prompt Pairing** — co-optimizes summarizer prompts with consumer prompts so compressed context stays usable.
36842. **Delimiter and Format Convention Tester** — tests delimiter styles (markdown, XML tags, custom) for instruction-following reliability.
36843. **Markdown-vs-XML Prompt Comparator** — compares markdown-structured versus XML-structured prompts on parse reliability and yield.
36844. **System-vs-User Message Split Tester** — tests which content belongs in system versus user messages for each brain model.
36845. **Tool-Description Wording Optimizer** — tunes tool and function descriptions to maximize correct tool selection by the model.
36846. **Function-Schema Clarity Improver** — iterates JSON schemas for tool parameters until the model fills them correctly at high rates.
36847. **Error-Message-to-Model Feedback Tuner** — tunes how tool errors are phrased back to the model to maximize successful self-correction.
36848. **Self-Correction Prompt Trigger Designer** — designs the trigger prompts that initiate productive self-correction without endless loops.
36849. **Critic-Model Prompt Pairing** — co-designs generator and critic prompts as a pair, optimizing their joint finding quality.
36850. **Generator-Discriminator Prompt Co-Tuner** — jointly tunes proposing and judging prompts so the judge catches the generator's typical errors.
36851. **Adversarial Prompt Robustness Suite** — stress-tests prompts against adversarial inputs (prompt injection in target responses) for resilience.
36852. **Jailbreak-Resistance Prompt Hardener** — hardens our own brain's prompts against jailbreak attempts embedded in hunted content.
36853. **Prompt-Injection Self-Defense Tester** — verifies prompts instruct the model to treat target content as data, never as instructions.
36854. **Over-Refusal Reducer** — tunes prompts to reduce false refusals on legitimate security-testing tasks without weakening safety.
36855. **Under-Refusal Guard** — guards against prompts that accidentally encourage out-of-scope or destructive testing.
36856. **Tone-of-Voice Prompt Calibrator** — calibrates report-writing prompts to the required professional register across finding types.
36857. **Verbosity Controller Tuner** — tunes length-control phrasing so outputs match the required detail level without truncation or padding.
36858. **Decisiveness Prompt Booster** — boosts decisive language in assessment prompts while preserving honest uncertainty markers.
36859. **Hedging Reducer for Reporting Prompts** — reduces unjustified hedging in report prompts, keeping only evidence-backed uncertainty.
36860. **Hypothesis-Generation Prompt Optimizer** — optimizes the hypothesis-generation prompt specifically for evidence grounding and diversity.
36861. **Evidence-Citation Prompt Enforcer** — tunes citation instructions until every factual claim in outputs carries a verifiable reference.
36862. **Falsification Prompt Designer** — designs prompts that make the model actively try to disprove its own hypotheses.
36863. **Counter-Hypothesis Prompt Template** — optimizes the prompt that generates benign alternative explanations for anomalies.
36864. **Probe-Planning Prompt Tuner** — tunes probe-planning prompts for minimal-request, maximum-information test design.
36865. **Payload-Crafting Prompt Optimizer** — optimizes payload-generation prompts for safety, correctness, and evasion-awareness.
36866. **Exploit-Analysis Prompt Refiner** — refines the prompts that assess exploitability to reduce both overclaiming and missed impact.
36867. **Severity-Judgment Prompt Calibrator** — calibrates severity-assignment prompts against analyst-labeled examples until agreement is high.
36868. **Remediation-Writing Prompt Tuner** — tunes remediation prompts for framework-specific, actionable, correctly-scoped advice.
36869. **Multilingual Prompt Localizer** — localizes prompts for non-English hunts while preserving instruction precision.
36870. **Language-Consistency Prompt Guard** — guards against mid-output language switching with explicit consistency instructions.
36871. **Domain-Vocabulary Injector** — injects industry-specific vocabulary into prompts so findings use the target sector's terminology.
36872. **Framework-Context Prompt Stuffer** — stuffs detected framework context into prompts so advice matches the actual stack.
36873. **Target-Profile Prompt Compiler** — compiles the target's fingerprint into a prompt preamble reused across all phases.
36874. **Hunt-History-Aware Prompt Builder** — builds prompts that include relevant hunt history so the model avoids repeating past mistakes.
36875. **Memory-Summarization Prompt Optimizer** — optimizes the prompts that summarize long-hunt memory without losing decision-critical detail.
36876. **Cross-Hunt Learning Prompt Injector** — injects lessons learned from other hunts into prompts as targeted guidance.
36877. **Time-Budget-Aware Prompt Adapter** — adapts prompt scope instructions to remaining hunt time, focusing effort as deadlines approach.
36878. **Urgency-Mode Prompt Switcher** — switches to terse, action-oriented prompt variants when the hunt runs in urgent mode.
36879. **Stealth-Mode Prompt Constrainter** — constrains prompts in stealth mode to low-noise techniques with explicit request budgets.
36880. **Aggressive-Mode Prompt Expander** — expands prompt authorization in aggressive mode with documented risk acceptance.
36881. **Beginner-Analyst Explanation Prompts** — tunes explanation prompts for junior analysts with more context and definitions.
36882. **Expert-Analyst Terse Prompts** — tunes terse prompt variants for experts who want conclusions without pedagogy.
36883. **Prompt Token-Budget Enforcer** — enforces per-prompt token budgets, failing loudly instead of silently truncating context.
36884. **Prompt Compression Suggester** — suggests shorter phrasings that preserve measured performance, cutting cost.
36885. **Redundant-Instruction Pruner** — detects and removes instructions the model already follows, verified by ablation tests.
36886. **Contradictory-Instruction Detector** — scans prompt sets for contradictory directives across phases and flags them for resolution.
36887. **Stale-Instruction Refresher** — refreshes instructions that reference retired tools, endpoints, or model behaviors.
36888. **Deprecated-Model Prompt Migrator** — migrates prompts when brain models change, re-validating performance on the new model.
36889. **Model-Specific Prompt Adapter** — maintains per-model prompt adaptations since phrasing that works on one brain fails on another.
36890. **Temperature and Top-P Co-Tuner** — co-tunes sampling parameters with prompt wording since they interact strongly.
36891. **Stop-Sequence Prompt Hygiene** — maintains stop sequences and output terminators per prompt to prevent runaway generation.
36892. **Prompt Injection of Fresh CVE Intel** — injects newly published CVE intelligence into relevant prompts within hours of disclosure.
36893. **Threat-Intel Prompt Enricher** — enriches prompts with current threat-intel context (active campaigns, exploited vulns) for prioritization.
36894. **Seasonal Attack-Trend Prompt Updater** — updates prompts with seasonal trend data so hypothesis generation tracks the real threat landscape.
36895. **Prompt Effectiveness Decay Monitor** — monitors prompt yield over time and alerts when a champion's effectiveness decays.
36896. **Prompt Fatigue Detector** — detects when identical prompts produce falling yield, signaling needed refreshment or rotation.
36897. **Winning-Prompt Pattern Extractor** — extracts the linguistic patterns common to winning prompts for reuse in new prompt design.
36898. **Prompt Embedding Similarity Search** — searches the prompt registry by semantic similarity to avoid duplicating existing experiments.
36899. **Prompt Lineage Tracker** — tracks the ancestry of every prompt variant so successful mutations can be traced and repeated.
36900. **Prompt Experiment Ledger** — ledgers every experiment (variant, traffic, metrics, outcome) as the permanent record of prompt evolution.
36901. **Statistical-Significance Gate for Promotion** — requires proper significance testing before any prompt promotion, blocking noise-driven churn.
36902. **Sequential-Testing Early-Stopping Rules** — applies sequential testing so clear winners promote early and clear losers stop wasting traffic.
36903. **Prompt Champion Archive** — archives retired champions with their reign metrics for historical analysis and emergency rollback.
36904. **Prompt Optimization Maturity Dashboard** — dashboards experiment velocity, win rate, and cumulative yield gain from the optimization program.
36905. **Known-Vulnerable Fixture Library** — maintains a versioned library of intentionally vulnerable applications used to score every brain and prompt change.
36906. **Per-CWE Fixture Matrix** — maps fixtures to CWE coverage so benchmark runs report per-weakness-class detection rates, not just totals.
36907. **Real-CVE Reproduction Corpus** — keeps reproducible real-CVE environments so models are scored on genuine historical vulnerabilities.
36908. **N-Day Fixture Pack** — packages recently disclosed CVEs as fixtures to test whether the brain catches current vulnerability patterns.
36909. **OWASP Benchmark Adapter** — adapts the OWASP Benchmark scoring methodology for Dark-Matter's autonomous hunt pipeline.
36910. **Juice-Shop Hunt Scorer** — runs full autonomous hunts against OWASP Juice Shop and scores findings against its known challenge set.
36911. **DVWA-Style Fixture Modernizer** — maintains a modernized DVWA-equivalent fixture set covering contemporary stacks and vulnerability classes.
36912. **Framework-Specific Fixture Sets** — provides fixture apps per framework (Django, Rails, Spring) so framework-tuned brains are scored fairly.
36913. **Language-Specific Fixture Packs** — scores language-specific detection skill with fixtures written in Python, Go, Rust, PHP, and Node.
36914. **API-Only Fixture Collection** — benchmarks pure-API hunting with fixtures exposing REST and GraphQL surfaces and no UI.
36915. **GraphQL Fixture Suite** — scores GraphQL-specific detection (introspection, batching, depth) on purpose-built schema fixtures.
36916. **Cloud-Misconfig Fixture Lab** — benchmarks cloud-configuration detection against a lab of deliberately misconfigured cloud resources.
36917. **Container-Escape Fixture Box** — scores container-escape detection in a sandboxed cluster of vulnerable container setups.
36918. **Supply-Chain Fixture Scenarios** — benchmarks supply-chain detection with fixtures containing typosquatted and compromised dependencies.
36919. **Multi-Step Chain Fixtures** — scores the brain's ability to link low-severity issues into high-impact exploit chains on purpose-built targets.
36920. **Logic-Flaw Fixture Puzzles** — benchmarks business-logic reasoning with puzzles requiring workflow abuse rather than injection.
36921. **Race-Condition Timing Fixtures** — provides timing-sensitive fixtures that only yield to brains that reason about concurrency.
36922. **Auth-Bypass Fixture Gauntlet** — runs brains through a gauntlet of authentication-bypass scenarios of increasing subtlety.
36923. **Crypto-Failure Fixture Set** — scores cryptographic-misuse detection against fixtures with weak randomness, modes, and key management.
36924. **SSRF Internal-Lab Fixtures** — benchmarks SSRF detection against a lab of internal services with graduated sensitivity.
36925. **Blind-Injection Fixture Suite** — scores blind-injection technique (boolean, time-based, out-of-band) on fixtures with no visible feedback.
36926. **Out-of-Band Fixture Harness** — provides collaborator-style out-of-band infrastructure so blind-exfiltration skill is measurably scored.
36927. **WAF-Evasion Fixture Tier** — adds a WAF layer to fixtures to score evasion-aware probing separately from raw detection.
36928. **Stealth-Constraint Fixture Mode** — scores hunts under strict request budgets and noise limits to benchmark stealth efficiency.
36929. **Noisy-Environment Fixture Variant** — introduces flaky responses and false signals to score robustness under realistic noise.
36930. **Flaky-Target Resilience Fixtures** — benchmarks the brain's ability to reach correct conclusions on intermittently failing targets.
36931. **Precision-Recall Scorer** — computes precision and recall against fixture ground truth as the core detection-quality metrics.
36932. **Time-to-First-Finding Measurer** — measures wall-clock and request-count time to the first confirmed finding per fixture.
36933. **Finding-Completeness Grader** — grades whether the brain found all planted vulnerabilities, not just the easy ones.
36934. **PoC-Quality Rubric Scorer** — scores proof-of-concept quality (reproducibility, clarity, safety) against a fixed rubric.
36935. **Report-Quality Evaluator** — evaluates generated reports on structure, accuracy, and professionalism with a judge model plus spot checks.
36936. **False-Positive Tolerance Tester** — plants realistic distractors in fixtures to measure the brain's false-positive discipline.
36937. **Duplicate-Finding Penalizer** — penalizes benchmark scores when the brain reports the same underlying flaw multiple times.
36938. **Severity-Accuracy Scorer** — scores assigned severities against fixture ground-truth ratings.
36939. **CVSS-Vector Accuracy Checker** — checks generated CVSS vectors metric-by-metric against the fixture's reference vectors.
36940. **CWE-Label Accuracy Measurer** — measures CWE classification accuracy on fixtures with unambiguous ground-truth labels.
36941. **Remediation-Advice Grader** — grades fix suggestions on correctness, specificity, and framework fit using reference remediations.
36942. **Cost-per-Confirmed-Finding Calculator** — computes token and request cost per confirmed finding as the efficiency benchmark.
36943. **Token-Efficiency Scorer** — scores findings per thousand tokens to compare brain configurations on economy.
36944. **Request-Efficiency Measurer** — measures confirmed findings per hundred requests to benchmark probing discipline.
36945. **Coverage-Breadth Estimator** — estimates the fraction of the fixture's attack surface the brain actually exercised.
36946. **Depth-of-Exploitation Scorer** — scores how far the brain progressed from detection to full impact demonstration.
36947. **Chain-Completion Rate Tracker** — tracks the fraction of plantable exploit chains the brain completes end to end.
36948. **Partial-Credit Rubric Engine** — awards partial credit for incomplete but directionally correct work via a published rubric.
36949. **Blind Evaluation Mode** — hides fixture identities and ground truth from the model so scores reflect genuine detection, not memorization.
36950. **Open-Book Evaluation Mode** — allows reference materials during evaluation to benchmark reasoning separately from recall.
36951. **Human-Baseline Comparison Suite** — runs human analysts on the same fixtures to establish the baseline the brain must beat.
36952. **Expert-Analyst Parity Measurer** — measures the gap between brain and expert-analyst scores per vulnerability class.
36953. **Speed-vs-Human Benchmark** — compares brain completion time against human analysts on identical fixtures.
36954. **Cost-vs-Human Benchmark** — compares full hunt cost against human-analyst cost for the same fixture coverage.
36955. **Model-Version Leaderboard** — ranks every brain model version on the full benchmark suite with trend history.
36956. **Prompt-Version Leaderboard** — ranks prompt versions by benchmark score to validate the prompt-optimization program.
36957. **Brain-Config Leaderboard** — ranks full brain configurations (model plus prompt plus sampling) as deployable units.
36958. **Nightly Benchmark Runner** — runs the full benchmark suite nightly and alerts on score changes.
36959. **Per-Commit Benchmark Gate** — gates brain-related commits on benchmark scores, blocking merges that regress detection quality.
36960. **Regression-Alert Dispatcher** — dispatches alerts with the failing fixtures and diffs when scores regress.
36961. **Improvement-Attribution Analyzer** — attributes score changes to the specific model, prompt, or code change responsible.
36962. **Canary Benchmark on New Models** — benchmarks candidate models on a canary fixture subset before full evaluation.
36963. **Shadow-Scoring Production Hunts** — shadow-scores production hunts against fixture-derived expectations without affecting live results.
36964. **Adversarial Fixture Generator** — generates adversarial fixtures targeting the brain's known weak spots for focused improvement.
36965. **Fixture Mutation Fuzzer** — mutates fixtures (renamed params, restructured code) to test detection robustness beyond memorized shapes.
36966. **Difficulty-Calibrated Fixture Tiers** — tiers fixtures by difficulty so benchmarks report per-tier scores, not a single blended number.
36967. **Elo Rating for Model Configs** — maintains Elo ratings for brain configurations from pairwise fixture comparisons.
36968. **Bradley-Terry Pairwise Comparer** — uses Bradley-Terry modeling to rank configurations from head-to-head fixture outcomes.
36969. **Judge-Model Evaluation Panel** — employs a panel of judge models with diverse prompts to score subjective outputs like reports.
36970. **Multi-Judge Consensus Scorer** — requires judge consensus for subjective scores, reporting inter-judge agreement.
36971. **Human-Judge Spot-Check Sampler** — spot-checks judge-model scores with human reviewers to keep automated evaluation honest.
36972. **Judge-Bias Detector** — detects systematic judge biases (verbosity preference, style preference) and corrects for them.
36973. **Evaluation Contamination Checker** — checks whether fixture content leaked into training data, invalidating affected scores.
36974. **Training-Data Leakage Auditor** — audits training corpora for fixture fingerprints and quarantines contaminated fixtures.
36975. **Fixture Freshness Rotator** — retires over-exposed fixtures and introduces new ones on a schedule to prevent overfitting.
36976. **Retired-Fixture Archive** — archives retired fixtures with their historical scores for longitudinal analysis.
36977. **Zero-Day Simulation Fixtures** — creates fixtures from vulnerability patterns with no public precedent to test genuine reasoning.
36978. **Unseen-Stack Generalization Tester** — benchmarks performance on technology stacks absent from training and calibration data.
36979. **Cross-Language Transfer Scorer** — scores whether skill learned on one language's fixtures transfers to another's.
36980. **Low-Resource Target Benchmark** — benchmarks hunting on tiny, slow targets where request budgets are severely constrained.
36981. **High-Scale Target Benchmark** — benchmarks prioritization and coverage strategy on fixtures with thousands of endpoints.
36982. **Long-Hunt Endurance Tester** — runs 24-hour fixture hunts to score memory durability and focus over long engagements.
36983. **Memory-Durability Scorer** — scores how well the brain retains and uses early-hunt evidence late in long hunts.
36984. **Mid-Hunt Interruption Recovery Tester** — interrupts fixture hunts mid-run to score state recovery and continuity.
36985. **Concurrent-Hunt Interference Tester** — runs parallel fixture hunts to score isolation (no cross-hunt contamination).
36986. **Multi-Target Prioritization Benchmark** — scores target triage decisions when the brain must allocate effort across several fixtures.
36987. **Report-Only Benchmark** — scores report-writing skill in isolation given fixed findings and evidence.
36988. **Triage Benchmark** — scores deduplication and prioritization given noisy raw tool outputs.
36989. **Retest Benchmark** — scores fix-verification skill on fixtures with planted patches, both correct and incomplete.
36990. **Regression-Test Benchmark** — scores the brain's ability to confirm old findings stay fixed across fixture updates.
36991. **Live-Fire Range Scheduler** — schedules periodic live-fire evaluations on fresh fixtures outside the training loop.
36992. **Benchmark Result Trend Visualizer** — visualizes score trends per model, prompt, and vulnerability class over time.
36993. **Capability Radar Chart Builder** — builds radar charts of per-class capability to show strengths and gaps at a glance.
36994. **Weakness-Cluster Identifier** — clusters benchmark failures to identify systematic weakness themes for targeted work.
36995. **Targeted-Improvement Recommender** — recommends the highest-leverage improvements from benchmark weakness clusters.
36996. **Benchmark-to-Prompt Feedback Loop** — feeds benchmark failure patterns directly into the prompt-optimization backlog.
36997. **Benchmark-to-Training Curation** — curates benchmark failures into training examples for brain fine-tuning.
36998. **Public Benchmark Submission Pack** — packages a sanitized benchmark subset for public comparison with external systems.
36999. **Internal-vs-Public Score Differ** — compares internal and public benchmark scores to detect evaluation gaming.
37000. **Benchmark Integrity Guardian** — guards the benchmark pipeline itself (fixture secrecy, scoring correctness, access controls).
37001. **Score-Gaming Detector** — detects optimization that inflates scores without improving real hunting (fixture memorization, threshold gaming).
37002. **Overfitting-to-Fixtures Alerter** — alerts when production-hunt quality diverges from fixture scores, signaling overfitting.
37003. **Benchmark Suite Versioning** — versions the entire suite so historical scores remain comparable and reproducible.
37004. **Grand Benchmark Report Compiler** — compiles the full suite results into a single executive-grade capability report per release.
