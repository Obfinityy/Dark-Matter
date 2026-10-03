# Part 03 — False-positive elimination

0001. **Three-rung confirmation ladder** — every finding must pass detection, then independent re-verification with a different technique, then exploitability proof before reaching confirmed status, with failure at any rung triggering automatic confidence downgrade.
0002. **Canary-token non-destructiveness proof** — for destructive-test findings like SQLi or SSTI, the proof is re-run with a canary that detects the flaw without mutating data, cleanly separating vulnerable from actually-broken.
0003. **Human-review priority queue** — unconfirmed findings are ranked by impact times confidence times novelty, presenting the top five with one-click confirm or dismiss plus reason capture that trains the FP classifier.
0004. **Technique-diversity requirement** — ladder rungs must use orthogonal techniques, for example error-based then time-based SQLi, because two runs of the same probe share the same blind spots.
0005. **Time-separated re-verification** — confirmation probes re-run after a randomized fifteen to sixty minute delay so transient glitches, deploys, or poisoned cache entries cannot pass both rungs.
0006. **Independent-evidence scoring** — each rung receives an independence score based on code path and oracle diversity, and correlated evidence is discounted before any promotion decision.
0007. **Rung-failure auto-downgrade** — any rung failure drops the finding one full confidence tier and appends the failed probe transcript, instead of silently retrying until something passes.
0008. **Severity-tiered ladder depth** — Critical claims require four rungs, High three, and Medium two, so verification effort scales with the cost of a false alarm.
0009. **Ladder-bypass audit log** — any finding promoted without completing all rungs is flagged as ladder-bypassed with the bypassing identity recorded, making shortcuts permanently visible.
0010. **Negative-control rung** — every ladder includes a control probe known to be benign on the same endpoint, and if the control also fires, the detection technique is declared broken for that endpoint.
0011. **Cross-session rung** — the final rung replays the proof in a fresh session with rotated tokens and IP to rule out session-specific artifacts.
0012. **Exploitability-proof rung definition** — the last rung must demonstrate impact such as reading a marker file or triggering a callback, not merely anomalous behavior, separating odd behavior from real vulnerability.
0013. **Ladder timeout and staleness** — a finding that cannot complete its ladder within twenty-four hours is demoted to unverifiable, preventing zombie candidates from clogging the queue.
0014. **Parallel-ladder racing** — two different confirmation strategies run concurrently and the finding is confirmed only if both agree, cutting single-technique false positives.
0015. **Evidence-freshness stamp per rung** — each rung records its timestamp and network conditions so reviewers can see whether confirmation happened under comparable conditions.
0016. **Reflection-context mapper** — records the exact output context of HTML body, attribute, JavaScript string, CSS, or URL, because a payload that merely reflects without breaking context is not XSS.
0017. **Context-breakout minimal proof** — confirmation requires the smallest payload that breaks out of the identified context, ruling out coincidental string matches.
0018. **Execution-sink fire proof** — requires observable JavaScript execution via a benign DOM marker mutation rather than raw reflection, since reflection alone never equals execution.
0019. **Browser-parsing differential** — compares server-side reflection against actual browser DOM parsing to catch cases where encoding neutralizes the payload at render time.
0020. **Encoding-layer audit** — traces the payload through every encode and decode layer of URL, HTML entity, and JavaScript unicode to confirm the browser receives an executable form.
0021. **Attribute-context breakout verifier** — for reflections inside attributes, confirms the quote can actually be broken given the attribute quoting style, since unbreakable quoting means no exploitability.
0022. **JavaScript-string-context terminator check** — verifies the payload can terminate the JavaScript string without syntax errors in the surrounding script, because broken syntax means no execution.
0023. **Event-handler injection prover** — for tag-attribute contexts, proves an event handler can be injected and fires on a benign user action, which is the actual exploit primitive.
0024. **SVG/MathML namespace confirmer** — re-tests suspected XSS inside SVG and MathML namespaces where parsing rules differ, avoiding false positives built on HTML assumptions.
0025. **Double-reflection discriminator** — when input reflects twice such as in an error plus the page, verifies each sink independently since one may be encoded while the other is not.
0026. **WAF-block-page reflection filter** — fingerprints WAF block pages and discards supposed XSS where the payload only appears inside the block page echo of the attack.
0027. **Error-page reflection verifier** — checks whether reflection occurs only in a generic error template that is safely encoded versus the real application page.
0028. **JSON-response XSS disambiguator** — treats JSON reflections as XSS only if a sink renders them as HTML based on content type and consumer analysis, never on reflection alone.
0029. **Comment-context eliminator** — auto-dismisses reflections trapped inside HTML comments unless comment breakout is explicitly demonstrated.
0030. **Title and meta-tag context checker** — verifies whether reflections in title or meta tags are actually executable, since most such reflections are inert text.
0031. **Canonicalization pre-check** — normalizes Unicode, overlong UTF-8, and mixed encodings before judging breakouts, catching filter evasions that are not real execution.
0032. **mXSS reparse differential** — re-serializes the DOM after innerHTML round trips to confirm mutation XSS actually mutates rather than merely reflecting.
0033. **DOM-clobbering versus XSS separator** — distinguishes DOM clobbering primitives from executable XSS by requiring the clobbered value to reach a dangerous sink.
0034. **Template-delimiter confusion check** — separates server template injection from XSS when delimiters reflect, requiring proof of engine evaluation.
0035. **Stored-versus-reflected classifier** — traces whether reflected input persists server side across sessions before labeling it stored, since mislabeling inflates severity.
0036. **Multi-parameter reflection isolator** — when several parameters reflect, isolates each to identify exactly which one breaks context, avoiding blame assigned to the wrong parameter.
0037. **CSRF-token reflection excluder** — excludes anti-CSRF tokens and other random nonces from reflection analysis since their reflection is by design.
0038. **Length-truncation breakout check** — verifies the payload is not truncated by maxlength or database limits before the breakout point, which silently kills exploits.
0039. **Case-transformation trap detector** — detects server-side lowercasing or uppercasing that breaks payload keywords and confirms whether the transformed payload still executes.
0040. **Input-length versus sink-distance measurer** — measures characters available before the sink closes, and payloads longer than the budget are downgraded rather than reported as full XSS.
0041. **Nested-context resolver** — for reflections inside nested contexts like a JavaScript string inside an HTML attribute inside a template, resolves the full nesting chain before claiming exploitability.
0042. **Second-order reflection tracer** — follows stored input to every later render location and confirms execution at the actual sink rather than at the injection point.
0043. **Admin-view verification protocol** — for stored XSS visible only to admins, uses a safe canary with a unique marker and no exfiltration, never firing real payloads in privileged sessions.
0044. **Session-specific reflection check** — re-tests reflection in a logged-out session to rule out profile-data echoes that only the attacker own session renders.
0045. **Cache-poisoned reflection guard** — verifies reflection is not served from a poisoned cache entry by re-requesting with cache busters before confirming.
0046. **Source-to-sink taint mapper** — maps every DOM source such as location hash, postMessage, and localStorage to its sink to prove data actually flows rather than merely co-occurs.
0047. **Fragment-only trigger test** — confirms DOM XSS fires from the URL fragment alone without server involvement, separating client-side flaws from server reflections.
0048. **postMessage origin-validation prover** — for postMessage sinks, proves a cross-origin message reaches the sink, since same-origin-only listeners are not exploitable.
0049. **jQuery-sink version gate** — checks the loaded jQuery and DOM library versions because sinks like html behave differently across versions, and version-gated analysis avoids phantom findings.
0050. **Client-side template sink audit** — verifies client-side template engines actually evaluate the reflected expression under the application real configuration of CSP and strict contextual escaping settings.
0051. **History-API state pollution check** — confirms history pushState data reaches a sink, since state objects are frequently inert.
0052. **Web-message listener enumerator** — enumerates all message event listeners to confirm the vulnerable one is registered and reachable rather than dead code.
0053. **localStorage and sessionStorage flow prover** — proves stored client-side values are read back into a sink on a realistic navigation path.
0054. **DOM-XSS framework-guard detector** — detects framework auto-escaping at the sink in React or Vue that neutralizes the payload despite dangerous-looking code.
0055. **Trusted-Types enforcement check** — verifies whether Trusted Types blocks the sink at runtime, which kills DOM XSS even when the code looks vulnerable.
0056. **Sink-reachability path walk** — walks the actual user navigation path to the sink, and sinks reachable only through dead interface flows are downgraded.
0057. **Gadget-dependency verifier** — for DOM-clobbering and gadget chains, confirms the required gadget script is actually loaded on the page.
0058. **Iframe-sandbox escape check** — verifies the sink is not inside a sandboxed iframe that neuters script execution.
0059. **Shadow-DOM boundary test** — checks whether shadow DOM encapsulation prevents the payload from reaching the page-level sink.
0060. **Mutation-observer sink confirmer** — for mutation-based DOM XSS, confirms the observer actually fires on the injected mutation.
0061. **Client-side redirect sink prover** — proves open redirect through JavaScript actually navigates cross origin rather than assigning to a same-origin-constrained property.
0062. **Eval-alternative sink catalog** — checks non-obvious sinks such as string-based setTimeout and the Function constructor against the application actual code paths.
0063. **Dead-code sink eliminator** — uses coverage data to drop sinks in JavaScript never executed during realistic user flows.
0064. **A/B-variant sink consistency** — re-tests DOM XSS across A/B test variants since different bundles carry different sinks, and inconsistent results are flagged rather than averaged.
0065. **Service-worker interception check** — verifies a service worker does not rewrite or sanitize the payload before it reaches the sink.
0066. **Blind-XSS callback correlator** — requires the out-of-band callback to include a unique per-probe token so stray callbacks cannot be attributed to the wrong probe.
0067. **Callback-timing plausibility filter** — discards blind XSS callbacks arriving implausibly fast or slow relative to the expected admin-viewing workflow.
0068. **Callback-source attributor** — verifies the callback IP and ASN match the target infrastructure, ruling out callbacks triggered by the scanner own re-tests.
0069. **Blind payload non-destructiveness** — blind probes exfiltrate only a canary token and never cookies or session data, keeping confirmation ethical.
0070. **Admin-panel view-path validator** — confirms the injected data is actually rendered in an admin or review interface before claiming blind XSS, since data nobody views is not exploitable.
0071. **Email-rendering context check** — for blind XSS through email, verifies the victim mail client renders HTML and JavaScript, and plain-text-only pipelines are auto-dismissed.
0072. **PDF and CSV export sink check** — verifies exported-file XSS actually executes in the victim viewer rather than assuming export equals execution.
0073. **Webhook payload rendering audit** — checks whether webhook-received data is rendered as HTML in dashboards or safely rendered as text.
0074. **Log-viewer XSS validator** — confirms log-viewer interfaces render HTML unsanitized, since most modern viewers escape and assumption-based findings are dropped.
0075. **CSP effective-block analyzer** — parses the actual Content Security Policy including report-only versus enforce mode to determine whether the payload would execute, and blocked payloads are downgraded.
0076. **CSP bypass-necessity test** — claims CSP bypass only when the payload demonstrably executes under the enforced policy, not when the policy merely looks weak.
0077. **Nonce and hash presence verifier** — checks for script nonces or hashes that would neuter inline payloads even when unsafe-inline appears elsewhere.
0078. **Trusted-Types plus CSP combined gate** — requires bypassing both protections when both are present, since defeating only one is not a finding.
0079. **Base-URI hijack feasibility** — for base-tag injection, verifies relative script URLs actually resolve to attacker-controlled locations, since most pages use absolute URLs.
0080. **Dangling-markup exfiltration prover** — proves dangling markup actually exfiltrates the canary across the network rather than merely showing markup was injected.
0081. **CSS-injection versus XSS separator** — requires CSS injection to demonstrate data exfiltration or impactful interface redress, since pure style injection without exfiltration is informational.
0082. **Script-gadget availability audit** — for CSP-locked pages, confirms a script gadget such as a JSONP endpoint actually exists on the allowlisted origin before claiming bypass.
0083. **Report-only policy discriminator** — treats report-only CSP as no enforcement for exploitability judgments.
0084. **Meta-refresh versus script-context check** — verifies meta-refresh and JavaScript-URL vectors against actual browser behavior for the claimed context.
0085. **Deprecated-filter ignorelist** — never credits deprecated browser XSS filters as mitigation or as evidence, so findings stand or fall on real parsing behavior.
0086. **Payload-canary uniqueness** — every XSS probe uses a unique canary string so reflections from concurrent probes cannot be cross-attributed.
0087. **Reflection-source attributor** — determines whether the reflected string came from the probe parameter or from a coincidental dictionary word already in the page.
0088. **Concurrent-probe interference guard** — staggers probes so two payloads in flight cannot combine into a phantom breakout.
0089. **Baseline-page diffing** — diffs the response against a benign baseline to isolate exactly what the payload changed, ignoring template noise.
0090. **Benign-input control probe** — sends a harmless alphanumeric input first, and any XSS signals on the control invalidate the detector for that endpoint.
0091. **Charset-declaration verifier** — checks the page declared charset against actual bytes, and charset mismatches that neutralize payloads are documented rather than ignored.
0092. **X-Content-Type-Options gate** — verifies nosniff is absent before claiming content-sniffing-driven XSS, since with nosniff the vector is dead.
0093. **MIME-type execution gate** — confirms the response MIME type is actually script-executable such as text-html rather than assuming all reflections execute.
0094. **Download-versus-render discriminator** — treats Content-Disposition attachment responses as non-rendering, since reflected payloads in downloads are not XSS.
0095. **Iframe-embedding precondition** — for findings requiring framing, verifies the page is actually frameable through absent X-Frame-Options and frame-ancestors directives.
0096. **User-interaction realism check** — downgrades vectors requiring implausible interaction sequences such as pasting into devtools or manually disabling CSP.
0097. **Social-engineering dependency labeler** — labels findings needing victim paste actions as interaction-required rather than dropping or overstating them.
0098. **Browser-version sensitivity note** — records which browser engine confirmed execution, and WebKit-only quirks are labeled rather than generalized.
0099. **XSS finding merge key** — merges multiple payloads proving the same sink into one finding keyed by URL, parameter, and sink location.
0100. **Sink-fix verification hook** — after a fix is claimed, re-runs the exact original breakout payload rather than a weaker variant to confirm remediation.
0101. **DBMS error-fingerprint matcher** — matches error text against known database signatures for MySQL, Postgres, MSSQL, and Oracle, since generic 500 responses without database markers are not error-based SQLi.
0102. **Verbose-versus-generic error discriminator** — requires SQL-specific tokens such as syntax, query, or column in the error before classification, because frameworks throw generic 500 errors for any malformed input.
0103. **Error-message content prover** — confirms the error reflects query structure like table or column names rather than a plain invalid-input message, which input validation also produces.
0104. **Error-consistency check** — re-sends the same payload three times, and inconsistent errors suggest flaky application behavior rather than SQLi.
0105. **Error-differential versus control** — compares error output for malicious versus benign-but-malformed input, and identical errors mean the application is only doing bad-input handling.
0106. **Stack-trace source verifier** — verifies the stack trace implicates the database layer rather than a template or routing error that merely looks database related.
0107. **Database-vendor consistency** — the fingerprinted database vendor must stay consistent across all probes, since flip-flopping vendors indicate error-page mimicry.
0108. **Error-based extraction limiter** — extraction stops at schema metadata such as table and column names, and row data is never dumped during confirmation.
0109. **WAF-error-page discriminator** — fingerprints WAF and IDS error pages that echo SQL keywords and excludes them from error-based classification.
0110. **Custom-404 error trap** — detects when supposed SQL errors are actually the application custom 404 handler rendering the URL, which contains SQL keywords only because the payload put them there.
0111. **Debug-mode error qualifier** — labels error-based findings from debug-mode pages as environment dependent and requires re-confirmation with debug mode disabled.
0112. **ORM-error translator** — translates ORM exceptions from Hibernate or Django to confirm they wrap real SQL errors rather than query-builder misuse.
0113. **Second-query error attributor** — when errors appear on a subsequent request, traces them back to the injection point before claiming second-order SQLi.
0114. **Error-length oracle guard** — prevents mistaking error-message length variations from timestamps or request IDs for genuine data extraction.
0115. **Localized-error handler** — accounts for non-English error messages by matching multilingual database signatures, avoiding missed confirmations.
0116. **Error-suppression detector** — detects when the application suppresses database errors into blank 500 responses and routes confirmation to boolean or time techniques instead of forcing error-based claims.
0117. **Connection-error versus syntax-error separator** — distinguishes database connection failures from wrong credentials or down hosts versus injection-caused syntax errors.
0118. **Batch-error attributor** — for stacked-query errors, attributes each error to its own statement so the injection own error is not confused with the follow-on statement error.
0119. **Error-reflection versus error-generation** — determines whether the payload appears in the error because it was logged as reflection or because it broke the query as generation, and only generation counts.
0120. **Error-page cache guard** — re-requests with cache busters to ensure the error is not a cached response from an earlier probe.
0121. **True/false pair statistical gate** — requires at least twenty true/false pairs with significance below one percent before confirming boolean-blind SQLi, killing noise-driven false positives.
0122. **Response-differential stability** — the true/false differential must persist across three separate time windows, and transient differentials are discarded.
0123. **Content-length versus status-code oracle** — identifies which response property actually differs among length, status, timing, or redirect, and confirms the oracle is deterministic.
0124. **Oracle-determinism prover** — replays the exact true/false pair ten times, and any flip-flopping disqualifies the oracle entirely.
0125. **Benign-differential baseline** — measures the endpoint natural response variance with benign inputs first, and the SQLi differential must exceed it significantly.
0126. **Multi-condition corroboration** — confirms with several independent boolean conditions such as tautologies and substring checks rather than relying on a single pair.
0127. **Case-sensitivity control** — runs the same boolean logic with different casing, since WAF-normalized responses that kill case variants reveal filtering rather than SQLi.
0128. **Comment-style cross-check** — confirms across comment styles to rule out parser-specific artifacts.
0129. **Numeric-versus-string context resolver** — determines the injection context of numeric, single-quoted, or double-quoted input and requires the boolean logic to fit that context.
0130. **Logic-operator diversity** — uses AND, OR, and XOR variants for corroboration, since only one working operator suggests coincidence.
0131. **Subquery-versus-literal corroboration** — corroborates literal-based differentials with subquery-based ones to rule out string-matching artifacts.
0132. **Time-bounded differential** — each boolean pair must complete within a timeout, and hanging pairs are excluded rather than counted as false.
0133. **Load-aware scheduling** — pauses boolean probing when server load spikes are detected through baseline latency drift, since load skews differentials.
0134. **Differential-decay monitor** — aborts the run as likely adaptive filtering rather than SQLi if the differential shrinks over successive pairs.
0135. **Character-extraction cap** — confirmation extracts at most a few characters of a benign marker, and full data extraction is never part of false-positive elimination.
0136. **Known-safe tautology control** — injects a provably inert tautology as a control, and if it also produces a differential, the oracle is declared broken.
0137. **Session-state contamination check** — verifies the differential is not caused by session state changed by earlier probes such as cart contents or login state.
0138. **Pagination and cursor artifact guard** — rules out differentials caused by pagination cursors or result offsets shifting between requests.
0139. **Boolean-oracle independence score** — two different boolean techniques such as content-based and timing-based must agree before promotion to confirmed.
0140. **Differential-attribution logger** — logs the exact bytes that differed so reviewers can audit whether the difference is SQLi plausible.
0141. **Network-jitter baseline subtraction** — measures baseline latency distribution first and requires the injected delay to exceed the ninety-ninth percentile rather than just the mean.
0142. **Delay-distribution analysis** — observed delays must cluster around the injected sleep value such as five seconds plus or minus half a second, and random long tails are rejected.
0143. **Multi-delay corroboration** — confirms with at least two different sleep durations such as two and seven seconds to prove the delay is controlled rather than coincidental.
0144. **DB-specific sleep-function gate** — uses the fingerprinted database native sleep function since wrong-vendor functions failing proves nothing.
0145. **Conditional-delay proof** — the delay must occur only when the injected condition is true, proving actual SQL evaluation.
0146. **Concurrent-load guard** — aborts time-based confirmation when background load spikes, rescheduling the run rather than recording a false result.
0147. **Timeout-ceiling enforcer** — caps the total time-probe budget per endpoint so one slow endpoint cannot stall the hunt or produce timeout-mislabeled results.
0148. **DNS-versus-sleep disambiguator** — distinguishes database sleep delays from DNS-resolution delays caused by out-of-band payloads, attributing each correctly.
0149. **Connection-pool exhaustion guard** — detects when delays come from pool exhaustion caused by many open probes rather than SQL execution, using a control endpoint.
0150. **Query-cache invalidation check** — accounts for query caches that make the first delay real and repeats instant, requiring consistent delays for confirmation.
0151. **Replica-lag artifact filter** — on read replicas, filters delays caused by replication lag by comparing against a known-fast control query.
0152. **Heavy-query versus sleep separator** — distinguishes intentionally heavy queries from sleep calls, since both prove injection but imply different confidence levels.
0153. **Time-oracle statistical test** — applies a t-test between delay and control samples, and results at or above one percent significance remain unconfirmed.
0154. **Clock-skew guard** — verifies client and server clock assumptions when targets sit behind multi-region load balancers.
0155. **Sleep-in-comment trap** — detects payloads where the sleep call sits inside a SQL comment with no execution and refuses to count the absent delay as negative evidence.
0156. **WAF-delay trap** — fingerprints WAFs that artificially delay suspicious requests, and WAF-induced delays are excluded from time-based confirmation.
0157. **Async-job delay confounder** — rules out delays from background jobs that the request legitimately queues.
0158. **Retry-storm guard** — ensures the prober itself is not causing delays through aggressive retries, which would be self-inflicted denial of service masquerading as SQLi.
0159. **Delay-proportionality check** — injected two-second versus five-second sleeps must produce proportionally different delays, since flat delays indicate a fixed timeout rather than SQLi.
0160. **Time-proof canary token** — embeds a unique token in every timing probe so delayed responses can be matched to the exact probe that caused them.
0161. **OOB token-correlation requirement** — the out-of-band hit must carry a unique per-probe token, and unattributed DNS or HTTP hits do not count as confirmation.
0162. **DNS-egress plausibility check** — verifies the target network plausibly allows DNS egress through previously observed benign resolution before treating absent out-of-band signals as negative evidence.
0163. **OOB-versus-crawler attributor** — distinguishes collaborator hits caused by the injection from hits caused by security crawlers prefetching the payload URL.
0164. **HTTP-OOB content verifier** — for HTTP out-of-band channels, the callback must echo the token, since mere connection attempts can come from link prefetchers.
0165. **OOB firewall-caveat labeler** — labels out-of-band negative results as possibly egress-blocked rather than not vulnerable when egress cannot be verified.
0166. **UNION column-count proof** — requires determining the exact column count through ORDER BY and UNION null probes, since claimed UNION without a column count stays unconfirmed.
0167. **UNION type-compatibility check** — verifies at least one column accepts text output, and all-binary columns with no exfiltration path stay unconfirmed.
0168. **Benign-marker extraction limit** — UNION confirmation extracts a fixed harmless marker string and never real table data.
0169. **UNION-versus-error disambiguator** — ensures the supposed UNION success signal is not merely a different error page with similar length.
0170. **Stacked-query non-destructive proof** — stacked queries prove execution through SELECT into a canary and never through INSERT, UPDATE, DELETE, or DROP.
0171. **Second-order persistence prover** — proves the payload persists by re-reading from storage and executes at the later sink, since persistence alone is not second-order SQLi.
0172. **Second-order trigger mapper** — identifies the exact later action that triggers execution such as a report export or admin view, making the finding reproducible.
0173. **Stored-procedure execution gate** — for procedure-based injection, confirms the procedure actually executes attacker-controlled SQL rather than merely returning an error.
0174. **Out-of-band exfiltration cap** — out-of-band confirmation exfiltrates at most a short canary, and bulk exfiltration is out of scope for false-positive elimination.
0175. **OOB channel-independence** — out-of-band confirmation should use a different channel such as DNS versus HTTP than the one used for detection, providing independent evidence.
0176. **WAF-bypass necessity test** — determines whether the WAF actually blocks the attack class or the payloads were simply malformed, since unneeded bypasses are not findings.
0177. **WAF-off baseline comparison** — where legal and safe, compares behavior against a WAF-bypassed baseline to isolate WAF artifacts from application behavior.
0178. **IDS-signature echo filter** — drops supposed findings where the only signal is the intrusion detection system echoing the attack signature in its alert page.
0179. **Rate-limit-induced error guard** — distinguishes rate-limit 429 and 403 pages containing SQL keywords from real database errors.
0180. **SQLi merge key** — merges error-based, boolean-based, time-based, and out-of-band proofs of the same injection point into one finding keyed by endpoint, parameter, and context.
0181. **NoSQL operator-differential proof** — confirms NoSQL injection through true/false operator differentials with the same statistical gates as boolean SQLi.
0182. **NoSQL tautology control** — a benign tautology control must not produce a differential, or the oracle is declared invalid.
0183. **Where-clause JavaScript execution prover** — for dollar-where injection, proves JavaScript actually executes through sleep or conditional constructs rather than merely altering query semantics.
0184. **ORM-query-builder misuse separator** — distinguishes ORM API misuse from genuinely injectable query construction, since misuse without injection is a code smell rather than SQLi.
0185. **LDAP boolean-differential gate** — confirms LDAP injection through attribute-presence true/false differentials with statistical significance.
0186. **LDAP wildcard-control probe** — a benign wildcard control must behave identically to baseline, or the differential is meaningless.
0187. **LDAP-error fingerprint matcher** — matches LDAP-specific error codes rather than generic 500 responses before claiming error-based LDAP injection.
0188. **XPath boolean oracle** — confirms XPath injection through node-count true/false differentials on XML responses.
0189. **XPath-error versus app-error separator** — requires XPath-specific error tokens, since XML parsers throw generic errors for malformed input too.
0190. **XXE-in-XPath attributor** — when XPath probes trigger XXE-like out-of-band signals, attributes the finding to the correct class to avoid double reporting.
0191. **GraphQL-to-SQL layer attributor** — for GraphQL-backed SQLi, attributes the flaw to the resolver and data layer and confirms the GraphQL layer does not sanitize.
0192. **Stored-procedure versus dynamic-SQL labeler** — labels the injection subtype correctly since remediation differs, and mislabeled findings waste developer time.
0193. **Batch-query API separator** — distinguishes intentional batch-query APIs from stacked-query injection, since documented batch endpoints are not vulnerabilities.
0194. **Read-only query-interface qualifier** — labels injection in read-only analytics interfaces as limited impact, requiring write proof for any escalation.
0195. **Prepared-statement verification** — checks through edge probes whether the parameter is actually concatenated rather than assuming from code patterns.
0196. **Encoding-bypass versus real-injection check** — confirms the payload survives the application encoding layer as SQL rather than merely as a reflected string.
0197. **Truncation-kill check** — verifies overlong payloads are not truncated before the injectable clause, which would silently neuter exploits.
0198. **Multi-DBMS payload consistency** — the working payload set must be consistent with a single database family, since mixed-vendor successes indicate probing artifacts.
0199. **SQLi confidence-combiner** — fuses error-based, boolean-based, time-based, and out-of-band results with independence weighting into one calibrated confidence score.
0200. **Injection-point fix re-verification** — replays the exact confirming payload after a fix is claimed, and a weaker retest that passes is rejected as insufficient.
0201. **Time-delay command proof** — requires command substitution with sleep to produce a delay in the expected class with jitter baselining, which is the standard non-destructive remote-code-execution proof.
0202. **Conditional-delay command gate** — the delay must be conditional on the command substitution succeeding, ruling out ordinary application slowness.
0203. **OOB-DNS command prover** — uses DNS exfiltration of a canary through command substitution with strict token correlation.
0204. **Output-reflection verifier** — when command output reflects, verifies it contains actual command results such as user identifiers rather than merely echoed input.
0205. **Echo-versus-execution separator** — distinguishes the application echoing the payload from the operating system executing it, since echo alone is never command injection.
0206. **Argument-injection versus shell separator** — determines whether metacharacters reach a real shell or only an argument vector, since argument injection without a shell is a different and weaker class.
0207. **Blind-command timing statistics** — applies the same t-test gates as time-based SQLi so the delay must be statistically significant over baseline.
0208. **Command-separator diversity** — confirms across separators such as semicolons, double ampersands, pipes, and dollar parentheses, since one working separator may be a parser coincidence.
0209. **Newline-injection prover** — for newline-based injection, proves the second command effects through delay or marker rather than merely showing a truncated first command.
0210. **Backtick-versus-dollar corroboration** — corroborates dollar-parenthesis substitution with backticks to obtain independent evidence.
0211. **Environment-variable exfil guard** — never exfiltrates real environment variables during confirmation and instead uses a canary variable set by the probe itself.
0212. **Whoami-output redactor** — any reflected command output is redacted down to the canary marker in all stored evidence.
0213. **Sandbox-escape requirement** — detects container and sandbox boundaries first, and supposed remote code execution inside a locked sandbox is labeled with its actual escape status.
0214. **Shell-availability gate** — confirms which shell interprets the payload since syntax validity is shell dependent.
0215. **Windows-versus-Unix payload consistency** — the working payload family must match the fingerprinted operating system, and cross-OS successes are treated as suspect.
0216. **PowerShell-versus-cmd disambiguator** — on Windows stacks, identifies the actual interpreter before claiming syntax-dependent vectors.
0217. **Command-length truncation check** — verifies the full payload is not truncated by input limits before the metacharacter.
0218. **WAF-command-echo filter** — drops findings where the only supposed execution is the WAF echoing the payload in its block page.
0219. **Cron and scheduler confusion guard** — rules out delays caused by scheduled jobs that the request legitimately queues.
0220. **RCE merge key** — merges time-based, out-of-band, and output-based proofs of the same sink into one finding.
0221. **Template-engine fingerprint gate** — identifies the engine such as Jinja2, Twig, Freemarker, or Smarty before choosing probes, since wrong-engine failures prove nothing.
0222. **Non-destructive math-eval proof** — confirms server-side template injection through arithmetic evaluation such as seven times seven rendering as forty-nine, never through destructive calls.
0223. **Engine-versus-reflection separator** — distinguishes genuine template evaluation from plain reflection of delimiter characters.
0224. **Sandbox-detection qualifier** — detects engine sandboxes and labels the sandbox-escape status, since evaluation inside a sandbox carries lower severity.
0225. **Blind-SSTI timing proof** — for blind template injection, uses engine-native sleep or loop constructs with statistical delay gates.
0226. **OOB-SSTI token correlator** — out-of-band confirmation through template URL fetching requires token-correlated callbacks.
0227. **Context-type resolver** — determines whether the injection sits in plaintext, code, or comment context of the template, since comment context is usually inert.
0228. **SSTI-versus-XSS disambiguator** — when arithmetic renders as a number in HTML, confirms server-side evaluation as opposed to client-side framework evaluation.
0229. **SpEL and OGNL injection prover** — for Java expression languages, proves expression evaluation through arithmetic rather than through error messages alone.
0230. **EL-error fingerprint matcher** — requires expression-language-specific error tokens for error-based claims.
0231. **CVE-gadget versus live-proof separator** — a known-vulnerable engine version alone is never template injection, and live evaluation proof is mandatory.
0232. **Template-cache artifact guard** — rules out cached renders showing stale evaluation results through cache-busted re-probes.
0233. **Multi-engine differential** — probes with several engines syntaxes and expects exactly one to evaluate, confirming the fingerprint.
0234. **Attribute-access depth limiter** — confirmation stops at benign attribute reads without invoking dangerous dunder methods.
0235. **Config-object exposure check** — verifies whether evaluation can reach configuration or secret objects, and unreachable configuration earns a limited-impact label.
0236. **SSTI-to-RCE escalation gate** — remote code execution is claimed only with a working sandboxed non-destructive primitive, never assumed from template injection alone.
0237. **Email-template SSTI qualifier** — template injection in email templates is confirmed through canary rendering in test inboxes, never by sending to real recipients.
0238. **PDF-template SSTI validator** — confirms server-side template evaluation in PDF generators as opposed to client-side rendering artifacts.
0239. **Log-template injection separator** — distinguishes log format-string issues from template injection, since each needs its own proof.
0240. **SSTI merge key** — findings merge on endpoint, parameter, and identified engine.
0241. **OOB-XXE canary-file proof** — exfiltrates a canary through a local DTD and file read controlled by the probe, never placing real file contents in evidence.
0242. **Internal-DTD versus external-DTD separator** — confirms which entity type the parser resolves, since internal-only resolution limits impact.
0243. **Error-based XXE fingerprint** — requires parser-specific error tokens such as libxml2 or Xerces markers for error-based claims.
0244. **Billion-laughs safety guard** — never sends exponential entity expansion, and denial-of-service through XXE is assessed through entity-count limits rather than detonation.
0245. **DTD-retrieval prover** — proves the parser fetches external DTDs through token-correlated callbacks.
0246. **Parameter-entity gate** — determines whether parameter entities needed for out-of-band exfiltration are supported, since unsupported entities mean error-only XXE.
0247. **XXE-versus-SSRF attributor** — when XXE triggers server-side requests, attributes the primitive to the correct root cause and avoids double counting.
0248. **File-protocol support check** — verifies the file scheme is actually resolvable by the parser, since many parsers allow HTTP but not file access.
0249. **Encoding-bypass validator** — confirms the XXE payload survives transport encoding intact.
0250. **XInclude-versus-XXE separator** — distinguishes XInclude processing from classic XXE because remediation differs and each deserves its own finding.
0251. **SVG-XXE context check** — for SVG uploads, confirms the server-side parser processes entities rather than only the browser.
0252. **SOAP-XXE action mapper** — identifies the exact SOAP action and endpoint that parses XML, and endpoints that never parse are excluded.
0253. **XXE blind-timing proof** — uses conditional entity-triggered delays with statistical gates for blind XXE cases.
0254. **Parser-hardening detector** — detects disabled external entities and labels the parser hardened rather than claiming bypass without proof.
0255. **XXE merge key** — findings merge on endpoint, XML entry point, and entity type.
0256. **Deserialization-versus-decode separator** — proves actual object deserialization through gadget behavior as opposed to mere base64 or JSON decoding.
0257. **Gadget-chain proof requirement** — claims remote code execution through deserialization only with a working gadget chain in the application actual dependency versions, not theoretical chains.
0258. **Dependency-version gate** — verifies the vulnerable library version is actually on the classpath through error or version leaks rather than assumption.
0259. **Magic-byte and format validator** — confirms the endpoint actually parses the serialized format through magic bytes or opcodes.
0260. **Error-oracle deserialization check** — distinguishes deserialization errors from generic bad-input errors through class-specific tokens.
0261. **Timing-oracle deserialization proof** — uses gadget-triggered delays such as DNS lookups during object reads with statistical gates for blind cases.
0262. **OOB-deserialization correlator** — requires token-correlated callbacks from gadget execution.
0263. **PHP-object-injection sink prover** — proves the injected object reaches a dangerous magic method such as wakeup or destruct, not merely that unserialization succeeded.
0264. **Python-pickle reduce prover** — confirms the pickle reduce opcode actually executes a callable during confirmation using a sandboxed canary.
0265. **Node-serialization function-revival check** — verifies functions actually revive rather than merely parse in JavaScript deserialization.
0266. **DotNET-serialization binder gate** — checks binder and type restrictions before claiming exploitability, since restricted binders kill most gadget chains.
0267. **JSON-versus-native separator** — plain JSON parsing is not deserialization, and type-tag or object-revival semantics are required.
0268. **JWT-deserialization confusion guard** — never confuses JWT parsing with object deserialization.
0269. **Deserialization denial-of-service qualifier** — labels deep-nesting and billion-laughs variants as denial-of-service class with measured impact rather than remote code execution.
0270. **HMAC-signed blob verifier** — checks for integrity protection on serialized blobs, since properly signed blobs are not attacker controlled.
0271. **Deserialization merge key** — findings merge on endpoint, serialization format, and gadget.
0272. **Canonical file-read proof** — requires reading a known canary file outside the web root, since not-found variations alone are never local file inclusion.
0273. **Traversal-depth measurer** — determines how many parent-directory segments are needed, and insufficient depth that never escapes is not a finding.
0274. **Wrapper-support prover** — for filter wrappers, proves the wrapper actually executes by returning base64 of a canary.
0275. **Log-poisoning versus LFI separator** — poisoned logs included through file inclusion need both primitives proven, since log content alone is not file inclusion.
0276. **Null-byte handling check** — verifies null-byte behavior matches the runtime version, since modern runtimes ignore null bytes.
0277. **Path-normalization audit** — tests whether the application normalizes parent segments before or after validation, since post-validation normalization is the real flaw.
0278. **RFI-egress prover** — remote file inclusion requires token-correlated fetching of the attacker URL, and mere URL acceptance without fetching stays unconfirmed.
0279. **File-extension enforcement tester** — verifies the enforced extension actually constrains reads through null-byte and double-extension tests rather than assuming.
0280. **Directory-listing versus traversal separator** — open directory listing is its own finding, and traversal needs file-content proof.
0281. **Windows-drive traversal check** — tests drive-letter and UNC paths specifically on Windows stacks.
0282. **Zip-slip entry validator** — for archive uploads, proves path traversal on extraction with a canary entry rather than relying on suspicious names alone.
0283. **Traversal merge key** — findings merge on endpoint, parameter, and file accessed.
0284. **Upload-execution prover** — requires the uploaded file to be retrievable and interpreted or executed, since stored-but-inert files are informational.
0285. **MIME-versus-content sniffer check** — verifies the server sniffs content rather than only extensions before claiming bypass, since extension-only checks need extension proof.
0286. **Polyglot-confirmation gate** — polyglot files must demonstrably execute as the claimed type on retrieval.
0287. **Double-extension tester** — confirms the server extension parsing matches the claim, since many stacks safely take the last extension.
0288. **Config-upload behavior prover** — proves an uploaded server configuration actually changes behavior through a canary header rather than merely showing upload success.
0289. **SVG-upload script prover** — SVG cross-site scripting needs script execution in the victim browser context on direct navigation rather than mere file storage.
0290. **CSV-formula injection validator** — confirms the formula executes in the target spreadsheet application, since many viewers do not evaluate on open.
0291. **Log-injection versus log-forgery separator** — newline injection needs a demonstrated integrity impact such as fake entries parsed by monitoring, not just reflected newlines.
0292. **Log-viewer HTML-escape check** — verifies the viewer actually renders injected HTML before claiming log-viewer cross-site scripting.
0293. **CRLF-header-injection prover** — requires the injected header to appear in the actual response headers rather than only in a request echo.
0294. **Response-splitting body prover** — proves a second response body is actually split, since modern servers reject bare carriage-return and line-feed characters.
0295. **SMTP-header injection validator** — confirms the injected header reaches the sent email at a canary recipient rather than only appearing in a form echo.
0296. **Host-header cache prover** — host-header poisoning needs cache-backed proof with the poisoned response served to a second client, not single-response reflection.
0297. **Password-reset poisoning prover** — requires the poisoned reset link to be delivered to a canary inbox, since header reflection alone stays unconfirmed.
0298. **Upload and parse merge hygiene** — merges upload-vector findings by endpoint, file type, and execution context.
0299. **Second-order upload trigger mapper** — identifies the later action such as admin preview or batch job that triggers the uploaded payload.
0300. **Parser-differential upload check** — verifies the server-side parser interprets the file dangerously rather than trusting the uploader claim.
0301. **Internal-IP timing-differential proof** — compares response timing and behavior for internal versus external versus unroutable IPs to prove the request actually egresses the server.
0302. **Metadata-endpoint canary proof** — requests the cloud metadata endpoint for a canary path returning non-sensitive data, and credential exfiltration is never performed during confirmation.
0303. **DNS-rebinding SSRF validator** — confirms DNS-rebinding primitives actually resolve to attacker-controlled addresses at request time rather than only at validation time.
0304. **Redirect-chain SSRF prover** — proves the fetcher follows redirects to internal targets, and validators that check then fetch differently are labeled as time-of-check versus time-of-use issues.
0305. **Expected-behavior baseline** — documents what URLs the endpoint legitimately fetches, and deviations from that baseline define the anomaly rather than absolute rules.
0306. **Scheme-restriction tester** — verifies which schemes the fetcher supports among HTTP, gopher, file, and dict protocols, and unsupported schemes are excluded from claims.
0307. **Localhost-bypass matrix** — tests loopback representations including decimal, hex, and octal encodings systematically, with each bypass confirmed as its own primitive.
0308. **Cloud-metadata version gate** — checks whether token-required metadata service versions mitigate the issue, and findings are labeled according to the actual version behavior.
0309. **SSRF-versus-open-redirect separator** — distinguishes server-side fetching from client-side redirects, since only the former qualifies as server-side request forgery.
0310. **Webhook-URL SSRF qualifier** — request forgery through webhook configuration needs proof the server fetches on trigger rather than merely storing the URL.
0311. **PDF-generator SSRF prover** — confirms the server-side renderer issues the request through token-correlated callbacks rather than the browser.
0312. **Image-proxy SSRF validator** — proves the proxy fetches internal URLs while documenting its content-type restrictions.
0313. **XXE-SSRF attributor** — attributes server-side requests triggered through XXE to the correct root cause.
0314. **Request-smuggling SSRF guard** — never confuses smuggled-request artifacts with server-side request forgery.
0315. **SSRF blind-timing proof** — uses response-time differentials for internal versus blackholed hosts with statistical gates.
0316. **Port-scan through SSRF limiter** — port enumeration is capped to a handful of canary ports, and full port scans are out of scope for confirmation.
0317. **SSRF merge key** — findings merge on endpoint, parameter, and egress-target class.
0318. **Egress-filter detector** — detects egress filtering and labels findings as filtered rather than claiming full request forgery.
0319. **DNS-exfil versus HTTP-exfil separator** — labels the exfiltration channel actually proven rather than assuming one.
0320. **SSRF fix re-verification** — replays the exact bypass encoding after a fix rather than a weaker variant.
0321. **Two-account differential proof** — the same object must be accessible to the non-owner account with a reproducible differential, since single-account access proves nothing.
0322. **Owner-versus-nonowner response comparator** — diffs full responses rather than only status codes, since applications often return 200 with an error body.
0323. **Error-body versus data discriminator** — access returning an error JSON document is not insecure direct object reference, and actual object data is required.
0324. **Predictable-ID enumerability sampler** — samples a small identifier range to prove sequential predictability, since theoretical predictability without sampling stays unconfirmed.
0325. **UUID-unguessability verifier** — measures identifier entropy, and high-entropy unguessable identifiers earn a low-exploitability label even when technically referenceable.
0326. **Indirect-reference mapper** — maps indirect references such as hashes and slugs to prove they do not leak the direct identifier.
0327. **Cross-role access matrix** — tests every role against every object class, and findings are reported per role-and-object pair that actually leaks.
0328. **Function-level access prover** — hidden endpoints need proof of invocation with real effect rather than a mere 200 response on GET.
0329. **HTTP-method override tester** — verifies method-override headers actually change authorization outcomes.
0330. **Mass-assignment versus IDOR separator** — distinguishes writable-field abuse from readable-object abuse because each deserves its own finding.
0331. **IDOR-on-write prover** — write-side reference flaws need proof of modification through a canary field flip plus revert rather than a mere 200 OK.
0332. **Non-destructive write canary** — write proofs modify only a canary field and immediately revert, with the revert itself verified.
0333. **Bulk-enumeration feasibility estimator** — estimates records per minute and total exposure window, and infeasible enumeration is labeled accordingly.
0334. **Rate-limit IDOR gate** — checks whether rate limiting makes mass enumeration infeasible in practice.
0335. **Stale-cache IDOR guard** — rules out cached responses from another user session masquerading as insecure direct object reference.
0336. **Shared-device session artifact filter** — excludes findings caused by test accounts sharing browser state.
0337. **Tenant-isolation prover** — for multi-tenant applications, proves cross-tenant access specifically, since same-tenant access may be by design.
0338. **Public-by-design excluder** — excludes objects the application intentionally makes public such as shared links and public profiles through feature-flag analysis.
0339. **Soft-delete visibility check** — verifies whether deleted objects are intentionally visible through trash and restore interfaces before claiming reference flaws.
0340. **API-version authorization drift** — tests old API versions for missing authorization checks that newer versions enforce.
0341. **GraphQL-IDOR field prover** — proves the unauthorized field actually resolves data rather than merely appearing in the schema.
0342. **WebSocket authorization validator** — confirms subscription channels enforce authorization per topic, with cross-user message receipt as proof.
0343. **IDOR merge key** — findings merge on object type, endpoint, and victim role.
0344. **Authorization-fix re-verification** — replays both accounts requests after a fix is claimed.
0345. **Privilege-escalation chain gate** — privilege escalation is claimed only when the higher-privileged action demonstrably succeeds.
0346. **Credential-enumeration differential gate** — username enumeration needs statistically significant user-versus-nonuser differentials across both message content and timing.
0347. **Timing-enumeration jitter guard** — login timing differences must exceed network jitter baselines, and sub-fifty-millisecond differences on remote targets are rejected.
0348. **Generic-message verifier** — confirms the application messages are actually identical at byte level before ruling out enumeration.
0349. **Password-reset token entropy audit** — measures reset-token entropy, and low-entropy tokens need a guessing-feasibility proof rather than a looks-short judgment.
0350. **Token-expiry enforcement test** — verifies expired tokens are actually rejected, since non-expiry is the finding rather than token format.
0351. **Host-header reset-link prover** — requires the reset email at a canary inbox to contain the poisoned link, since header reflection alone stays unconfirmed.
0352. **Two-factor bypass state-machine proof** — proves the authenticated state is reached without the second factor through a minted session cookie rather than mere interface skipping.
0353. **Backup-code brute-force feasibility** — estimates attempts needed versus rate limits before claiming backup-code weakness.
0354. **Session-fixation prover** — proves the pre-login session identifier remains valid after login, since session rotation kills the finding.
0355. **Concurrent-session control tester** — verifies whether the application actually enforces its single-session promises.
0356. **Logout-invalidation verifier** — proves logout invalidates server side, since client-side cookie deletion alone is insufficient.
0357. **Session-entropy measurer** — measures session identifier entropy, and predictable identifiers need a prediction demonstration.
0358. **Cookie-tossing versus fixation separator** — distinguishes subdomain cookie tossing from true session fixation.
0359. **OAuth redirect-uri validator** — proves the redirect URI bypass actually delivers codes to an attacker origin through a canary rather than merely accepting the parameter.
0360. **OAuth state-parameter gate** — verifies state is absent or unvalidated and the flow is actually exploitable through login cross-site request forgery.
0361. **PKCE-enforcement check** — verifies the code challenge is actually validated server side.
0362. **JWT none-algorithm acceptance proof** — forges an algorithm-none token and proves privileged access, since library support without acceptance is not a finding.
0363. **JWT weak-secret crack gate** — cracks only with a small dictionary and proves the cracked key signs accepted tokens, since weak-looking alone is not proof.
0364. **JWT key-id traversal prover** — proves the key-id path actually reads attacker-influenced keys through a canary file rather than merely exhibiting path-like behavior.
0365. **JWT key-URL SSRF prover** — requires token-correlated fetching of the attacker key URL for key-URL header flaws.
0366. **JWT expiry-ignored test** — proves expired tokens are accepted, since a missing expiry claim alone is informational.
0367. **Auth-bypass versus auth-bug separator** — distinguishes complete bypass from logic bugs needing chaining, and severity follows the proof.
0368. **Default-credential blast limiter** — tests only documented default pairs and never brute forces, with success constituting the finding.
0369. **Credential-stuffing guard** — the agent never performs credential stuffing, and stuffing feasibility is assessed through rate-limit analysis only.
0370. **Auth merge key** — findings merge on authentication flow, endpoint, and bypass primitive.
0371. **API-key scope verifier** — proves the key accesses out-of-scope resources rather than merely proving the key exists.
0372. **Key-rotation staleness check** — verifies old keys are actually rejected after rotation.
0373. **Service-account privilege prover** — proves the service account effective permissions through canary actions.
0374. **Impersonation-feature audit** — distinguishes legitimate admin impersonation features with audit logs from insecure direct object reference.
0375. **Audit-log presence check** — verifies privileged actions are logged, and unlogged admin actions compound the finding severity.
0376. **Password-change CSRF gate** — proves the state-changing request lacks token protection and actually executes.
0377. **Email-change verification gap** — proves email can be changed without re-verification and the new address receives privileged communications.
0378. **Account-deletion authorization check** — proves non-owners cannot trigger deletion, since buttons hidden in the interface do not prove server-side authorization.
0379. **Invite-token reuse tester** — proves invite and registration tokens are actually reusable or predictable.
0380. **CAPTCHA-bypass necessity test** — determines whether CAPTCHA is enforced server side as opposed to client side only.
0381. **Rate-limit auth gate** — brute-force findings need measured attempt ceilings rather than assumed ones.
0382. **Account-lockout differential** — verifies lockout actually triggers and whether it enables user enumeration or denial of service.
0383. **SAML signature verifier** — proves assertions without valid signatures are accepted through a forged assertion carrying a canary.
0384. **SAML recipient-audience check** — verifies audience and recipient validation, and missing validation needs a cross-provider proof.
0385. **OIDC issuer-confusion test** — proves the application accepts tokens from a rogue issuer through a canary issuer rather than relying on documentation claims.
0386. **Subdomain-cookie-scope audit** — verifies cookie domain scope actually enables session riding from the compromised subdomain.
0387. **Cookie-prefix enforcement check** — verifies Host and Secure cookie prefixes are actually enforced by the claimed application logic.
0388. **Session-pinning detector** — detects device and session pinning that mitigates stolen-cookie impact, and findings are labeled with pinning status.
0389. **Refresh-token rotation verifier** — proves refresh tokens are actually rotated with reuse detection, since non-rotation is the finding.
0390. **Token-binding check** — verifies proof-of-possession or mutual-TLS binding is enforced rather than merely advertised.
0391. **Biometric-fallback tester** — verifies fallback authentication such as PIN or SMS is not weaker than the primary method, since weaker fallback is the finding.
0392. **Magic-link entropy and expiry** — measures magic-link entropy and verifies single-use and expiry enforcement.
0393. **Registration-race prover** — proves duplicate-registration races actually create inconsistent state through canary accounts.
0394. **Username-squatting similarity guard** — distinguishes lookalike-username social vectors from technical vulnerabilities and labels them rather than scoring them as high-severity flaws.
0395. **Deprovisioning lag check** — verifies departed users tokens are actually revoked, and the lag window is measured.
0396. **Privilege-cache invalidation test** — verifies role changes propagate, and cached-privilege windows are measured in minutes.
0397. **API-authorization parity check** — verifies mobile and API endpoints enforce the same authorization as web, since parity gaps are the finding.
0398. **Webhook-secret verifier** — proves webhook signatures are actually validated, since tampered payload acceptance is the finding.
0399. **HMAC-timing side-channel gate** — timing attacks need statistical significance over network jitter, and local-only nanosecond differences do not transfer to remote findings.
0400. **Auth-confidence combiner** — fuses multi-signal authentication findings into one calibrated confidence score.
0401. **State-change plus token-absence prover** — cross-site request forgery needs a demonstrably executed state change through a canary with no valid token, since a token present in the proof of concept invalidates it.
0402. **SameSite actual-behavior test** — verifies the cookie real SameSite enforcement in a cross-site test page rather than trusting the attribute value alone.
0403. **GET-based state-change qualifier** — labels GET-triggered changes as request forgery only when they are genuinely state changing, since analytics GET requests are not.
0404. **Token-validation prover** — proves the token is actually validated because wrong-token acceptance is the finding, while mere token existence means nothing.
0405. **Referer and Origin-check bypass tester** — verifies the actual validation logic of referer checks, since naive substring checks need a demonstrated bypass.
0406. **Double-submit consistency check** — verifies the two submitted tokens are actually compared server side.
0407. **CSRF-on-login qualifier** — login request forgery needs a demonstrated impact such as account linking rather than mere form submission.
0408. **JSON-CSRF content-type gate** — proves the endpoint accepts the smuggled content type, since text-plain preflight behavior must be tested rather than assumed.
0409. **CORS-and-CSRF interaction audit** — verifies whether permissive cross-origin policies already nullify request-forgery protections to avoid double reporting.
0410. **Multi-step CSRF chain prover** — multi-step flows need end-to-end execution proof because intermediate tokens frequently break the chain.
0411. **CSRF merge key** — findings merge on endpoint, action, and absent protection.
0412. **SameSite-None plus Secure audit** — verifies the cookie combination is actually set as claimed.
0413. **Token-per-session versus per-request** — determines token granularity, since per-request tokens that are never validated remain a finding.
0414. **CSRF-fix re-verification** — replays the proof of concept after a fix using the previously valid session.
0415. **Logout-CSRF impact labeler** — labels logout request forgery as low impact explicitly rather than inflating it.
0416. **External-navigation prover** — open redirect needs actual cross-origin navigation in a real browser rather than a mere Location header containing a URL.
0417. **Allowlist-bypass demonstrator** — bypasses need a working bypass URL rather than a suspicious-looking regular expression.
0418. **JavaScript-scheme gate** — verifies the javascript scheme actually executes in the redirect context, since many contexts neuter it.
0419. **Redirect-chain-to-OAuth prover** — OAuth token-theft chains need end-to-end proof with canary tokens.
0420. **Open-redirect merge key** — findings merge on endpoint, parameter, and bypass technique.
0421. **Credentialed-CORS read prover** — cross-origin findings need actual cross-origin credentialed reads of sensitive data, since wildcard origins without credentials are informational.
0422. **Null-origin gate** — verifies the application actually reflects a null origin and the browser sends it in the real attack context.
0423. **Trusted-subdomain CORS audit** — proves the trusted subdomain is actually attacker compromisable through takeover or scripting before escalating severity.
0424. **Vary-Origin cache guard** — checks whether cross-origin responses are cached and poisonable.
0425. **CORS merge key** — findings merge on endpoint and origin-policy flaw.
0426. **Frameable-plus-actionable clickjacking prover** — needs the page frameable and a sensitive one-click action present, since missing frame options alone are not the finding.
0427. **Frame-busting-code tester** — verifies the frame-busting code actually executes and is not neutered by sandbox attributes.
0428. **Drag-and-drop action prover** — drag-based vectors need a working drag-to-action demonstration since most are impractical.
0429. **postMessage-origin prover** — proves cross-origin messages reach the sink, since same-origin listeners are excluded.
0430. **postMessage merge key** — findings merge on listener, sink, and absent origin check.
0431. **CSWSH origin prover** — cross-site WebSocket hijacking needs an actual cross-origin connection performing actions, since a missing Origin check alone is insufficient.
0432. **WebSocket-authorization topic prover** — proves cross-user topic subscription actually delivers messages.
0433. **GraphQL-introspection exposure measurer** — measures the fraction of schema actually exposed rather than treating introspection as a binary on-off finding.
0434. **GraphQL-batching brute-force feasibility** — estimates attack attempts versus rate limits for batched attacks.
0435. **Field-suggestion info-leak qualifier** — labels suggestions as information leaks only when they reveal non-public fields.
0436. **GraphQL merge key** — findings merge on endpoint and flaw class.
0437. **Cache-poisoning two-client prover** — requires the poisoned response served to a second clean client, since single-client anomalies are not cache poisoning.
0438. **Cache-key injection demonstrator** — proves the injected key component actually busts or poisons the cache entry.
0439. **Cache-buster hygiene** — all cache tests use unique busting parameters to avoid self-poisoning artifacts.
0440. **Request-smuggling desync prover** — needs a demonstrably desynchronized second request carrying a canary prefix, since timing anomalies alone stay unconfirmed.
0441. **CL.TE versus TE.CL attributor** — attributes the exact variant proven, and unproven variants are never reported.
0442. **Smuggling safe-prefix discipline** — uses safe methods and prefixes that cannot harm other users requests during confirmation.
0443. **Race-window measurer** — measures the exploit window in milliseconds and requires demonstrated double-spend or state corruption with canary values.
0444. **Rate-limit versus race separator** — distinguishes rate-limit gaps from true race conditions through single-packet techniques.
0445. **Prototype-pollution sink prover** — proves the polluted property reaches a dangerous sink, since pollution of inert properties is informational.
0446. **Git-exposure completeness measurer** — measures the fraction of repository objects actually retrievable, and partial exposure is labeled rather than assumed complete.
0447. **Env-content redactor** — confirms environment-file exposure through canary keys while redacting real secrets in evidence.
0448. **Stack-trace intelligence qualifier** — scores traces by actionable content rather than mere presence.
0449. **Backup-file partial-inspection cap** — inspects only headers and file lists of exposed backups and never full dumps.
0450. **Subdomain-takeover claimability gate** — proves the external service actually allows claiming the dangling name, since non-claimable dangling DNS is informational.
0451. **Takeover non-claiming discipline** — never actually claims the resource during confirmation, and claimability is proven through the provider API or documentation check.
0452. **Secret-entropy plus context validator** — high-entropy strings need surrounding context such as key names or active prefixes before being labeled secrets.
0453. **Active-secret verification without use** — verifies secrets through provider validation APIs or metadata rather than by using the secret.
0454. **Canary-secret planter** — plants a canary secret to test detection pipelines without touching real ones.
0455. **Info-disclosure aggregation gate** — aggregation needs a demonstrated combined exploit path rather than a mere list of leaks.
0456. **Version-leak reachability check** — version strings need a reachable CVE to matter, since version disclosure alone is informational.
0457. **Directory-indexing sensitivity audit** — lists what is actually exposed rather than merely noting that indexing is enabled.
0458. **Source-map exposure analyzer** — verifies the map actually maps to original source rather than merely noting the file exists.
0459. **Debug-endpoint action prover** — debug endpoints need a demonstrated dangerous action rather than mere exposure.
0460. **Health-check info qualifier** — labels health endpoints by the data sensitivity actually returned.
0461. **TLS-handshake capture proof** — weak TLS needs an actual negotiated weak-handshake capture rather than a configuration claim.
0462. **Cipher-suite practicality gate** — a weak cipher needs a feasible attack rather than a theoretical one or it stays informational.
0463. **Certificate-validity checker** — verifies actual chain, expiry, and hostname failures through handshakes rather than scanner heuristics.
0464. **HSTS-preload versus header distinguisher** — labels preload and header-only policies correctly since header-only HSTS has known limits.
0465. **Missing-header impact gate** — missing security headers are reported only with a demonstrated bypass they enable.
0466. **Cookie-flag MITM practicality** — a missing Secure flag needs a realistic man-in-the-middle or adjacent-network scenario and is labeled accordingly.
0467. **HttpOnly-bypass necessity** — HttpOnly absence matters only when scripting is proven, and standalone it is defense in depth.
0468. **Dangerous-method prover** — methods such as TRACE, TRACK, and PUT need demonstrated dangerous behavior rather than mere method acceptance.
0469. **Method-override authorization recheck** — verifies override headers actually change authorization outcomes.
0470. **Host-header single-versus-cache separator** — single-response reflection without cache impact is low severity.
0471. **DOM-clobbering gadget prover** — needs the gadget script present and the clobbered value reaching a sink.
0472. **JSONP-callback hijack prover** — needs an actual cross-origin data-theft demonstration with canary data.
0473. **JSONP-removed qualifier** — verifies JSONP is actually still active rather than dead code.
0474. **AngularJS-expression sandbox gate** — verifies the framework version sandbox status before claiming expression injection.
0475. **Vue and React XSS sink audit** — verifies the framework escaping at the exact sink version in use.
0476. **jQuery-version sink gate** — old jQuery sinks need the vulnerable library version actually loaded.
0477. **Third-party-script audit** — verifies the third-party script is actually loaded and its compromise would matter.
0478. **SRI-absence impact gate** — missing subresource integrity matters only for high-risk third parties and is labeled accordingly.
0479. **Mixed-content active-versus-passive separator** — active mixed content is the finding while passive images are informational.
0480. **Referrer-policy leak prover** — proves sensitive data actually leaks through the Referer header to third parties.
0481. **Tabnabbing opener gate** — verifies window opener is actually exploitable through absent noopener protections in the real context.
0482. **Download-attribute drive-by check** — verifies the download actually triggers without user consent in the claimed browser.
0483. **Notification-API abuse qualifier** — labels by required permissions since permission-gated APIs are low severity.
0484. **Geolocation-permission gate** — verifies the permission-prompt behavior, since denied-by-default is not a finding.
0485. **WebRTC-IP-leak practicality** — verifies the leak occurs in default browser configurations, and extension-blocked leaks are labeled.
0486. **Clipboard-access prover** — proves programmatic clipboard reads without user gesture.
0487. **Fullscreen-UI-redress prover** — needs a demonstrated convincing phishing scenario rather than mere API availability.
0488. **Sensor-API privacy qualifier** — labels by the actual privacy impact demonstrated.
0489. **Payment-API abuse gate** — verifies the API actually processes without user confirmation.
0490. **Credential-management API audit** — verifies silent credential access is actually possible.
0491. **Bluetooth and USB device gate** — verifies the device chooser cannot be bypassed silently.
0492. **File-System-Access API prover** — proves silent file writes without a picker dialog.
0493. **PWA-install prompt abuse qualifier** — labels by the required user gestures.
0494. **Push-notification spam gate** — verifies subscription without visible permission.
0495. **Background-sync abuse check** — verifies synchronization actually exfiltrates without user awareness.
0496. **Client-side finding merge key** — findings merge on page, sink, and vector.
0497. **Browser-matrix confirmation** — records the confirming browser and engine versions.
0498. **Client-side fix re-verification** — replays the exact proof of concept after a fix.
0499. **Interaction-required labeler** — consistently labels user-interaction dependencies across all findings.
0500. **Defense-in-depth versus vulnerability separator** — distinguishes missing hardening labeled informational from exploitable flaws labeled as findings through a documented rubric, preventing hardening checklists from masquerading as vulnerability reports.
0501. **Per-class base-rate priors** — seeds each vulnerability class with its historical confirmation rate so novel claims start skeptical rather than at fifty-fifty.
0502. **Likelihood-ratio evidence weighting** — each probe type contributes a likelihood ratio of true-positive rate over false-positive rate instead of flat points.
0503. **Posterior-threshold promotion** — findings promote to confirmed only at posterior of at least point nine five and to probable at point eight, keeping the math explicit.
0504. **Prior-updating from program history** — priors shift per target program based on its historical false-positive rate, so noisy programs start more skeptical.
0505. **Class-conditional prior refinement** — priors split by fine context such as reflected scripting in JavaScript strings versus in HTML, since base rates differ wildly.
0506. **Evidence-independence discount** — correlated evidence from the same oracle or code path receives a correlation penalty before fusion.
0507. **Sequential Bayesian updating** — confidence updates probe by probe with a running posterior so the agent can stop early when thresholds are crossed.
0508. **Prior-robustness check** — re-computes the posterior under pessimistic priors, and findings that survive earn a prior-robust label.
0509. **Base-rate fallacy guard** — blocks the impressive-probe impossible-bug pattern by requiring extraordinary claims such as remote code execution to carry proportionally stronger evidence.
0510. **Hierarchical priors** — priors nest across program, asset, endpoint, and parameter levels so a historically clean endpoint starts more skeptical.
0511. **Prior-decay for new code** — recently changed endpoints get less benefit from historical priors since the slate is effectively clean.
0512. **Empirical-Bayes calibration** — priors are fit from the agent own confirmation history rather than guessed.
0513. **Prior-transparency record** — every finding stores the prior used so reviewers can audit the starting skepticism.
0514. **Adversarial-prior stress test** — re-scores top findings under hostile priors to expose conclusions that hinge on optimistic assumptions.
0515. **Prior-versus-evidence contribution split** — reports how much final confidence came from prior versus evidence, flagging prior-driven confirmations.
0516. **Cold-start prior protocol** — brand-new vulnerability classes use a conservative point-one prior until fifty labeled cases exist.
0517. **Prior-override audit** — any manual prior override is logged with justification and reviewer identity.
0518. **Multi-program prior pooling** — pools priors across programs with similarity weighting to avoid single-program overfitting.
0519. **Prior half-life** — old historical data decays in prior computation so the last quarter counts more than last year.
0520. **Prior-predictive check** — simulates expected confirmation counts from priors and flags hunts that deviate wildly as broken detectors or broken priors.
0521. **Confidence half-life decay** — un-reverified findings lose half their confidence every seven days, forcing re-verification or demotion.
0522. **Evidence-freshness weighting** — probe evidence decays exponentially with age so a thirty-day-old proof counts less than yesterday proof.
0523. **Re-verification refresh** — a fresh successful re-probe resets the decay clock to full confidence.
0524. **Decay-pause for fixed findings** — remediated findings stop decaying and archive at their final state.
0525. **Environment-change decay trigger** — deploys or configuration changes on the target instantly halve confidence pending re-verification.
0526. **Dempster-Shafer evidence fusion** — combines independent probe beliefs with explicit ignorance modeling instead of naive averaging.
0527. **Weighted-voter fusion** — each technique votes with weight equal to its historical precision, and the majority of weight rather than count decides.
0528. **Contradiction-resolution protocol** — when probes disagree, the finding drops to contested with disagreeing transcripts preserved rather than silently outvoted.
0529. **Diminishing-returns evidence cap** — the fifth identical-probe success adds less than one percent confidence, since repetition is not corroboration.
0530. **Oracle-diversity bonus** — confidence jumps only when a second different oracle agrees, so time-based plus out-of-band beats time-based plus time-based.
0531. **Negative-evidence integration** — failed probes are first-class evidence that lowers confidence rather than being ignored as inconclusive runs.
0532. **Absence-of-evidence labeler** — distinguishes tested-and-absent which lowers confidence from not-tested which changes nothing.
0533. **Confidence-interval reporting** — reports ninety-percent intervals such as point eight two to point nine four instead of point estimates, making uncertainty visible.
0534. **Monte-Carlo confidence simulation** — samples uncertain parameters like jitter and priors ten thousand times to produce the interval honestly.
0535. **Sensitivity analysis per finding** — identifies which single assumption the conclusion hinges on and stress-tests it.
0536. **Evidence-graph visualization** — renders the probe-to-conclusion dependency graph so reviewers see exactly what supports what.
0537. **Circular-evidence detector** — flags when probe B validity assumes probe A conclusion, blocking bootstrapped confirmations.
0538. **Double-counting guard** — prevents the same underlying observation from one response feeding two supposedly independent probes.
0539. **Conditional-independence audit** — documents why two probes are treated as independent, and unjustified independence claims are downgraded.
0540. **Fusion-formula versioning** — the exact fusion math version is stored per finding so old scores stay interpretable.
0541. **Confidence-floor for auto-report** — nothing below point nine posterior reaches the client report without human sign-off.
0542. **Confidence-ceiling for single-probe** — no single probe however strong can exceed point eight five alone, making corroboration mandatory.
0543. **Time-to-confidence estimator** — predicts probes needed to cross thresholds so the agent budgets verification effort.
0544. **Early-stopping rule** — probing stops when additional probes cannot mathematically cross the next threshold because the value of information is near zero.
0545. **Probe-budget allocator** — distributes verification probes by expected information gain rather than round robin.
0546. **Predicted-versus-empirical calibration curve** — plots binned predicted confidence against actual reviewer confirmation rates every month.
0547. **Calibration-drift alarm** — alerts when the curve deviates into overconfidence beyond tolerance, triggering threshold retuning.
0548. **Per-class calibration** — curves are computed per vulnerability class since scripting and request-forgery calibrate differently.
0549. **Per-technique precision tracking** — every probe technique precision is tracked, and sub-point-five techniques are quarantined.
0550. **Reviewer-agreement calibration** — compares agent confidence against inter-reviewer agreement, and low-agreement classes get wider intervals.
0551. **Brier-score tracking** — scores the confidence system with Brier scores over time, where lower is better and regressions page the team.
0552. **Reliability-diagram publishing** — includes the calibration diagram in internal quality reports for transparency.
0553. **Overconfidence-penalty tuner** — automatically widens intervals for classes with historical overconfidence.
0554. **Underconfidence detector** — flags classes where high-confidence predictions are always right but rare, indicating too-timid thresholds.
0555. **Calibration-by-severity** — verifies Critical-labeled findings are actually confirmed at Critical-worthy rates.
0556. **Temporal calibration stability** — checks calibration does not degrade as the target evolves, and drift triggers re-baselining.
0557. **Cross-program calibration transfer** — tests whether calibration holds on new programs before trusting it there.
0558. **Confidence-audit sampling** — samples findings across the confidence spectrum for blind re-review every month.
0559. **Score-explanation fidelity check** — verifies the human-readable why text actually matches the math that produced the score.
0560. **Rounding-discipline rule** — confidences report to two decimals maximum, and false precision such as five decimals is banned.
0561. **Confidence-versus-severity separation audit** — ensures severity is not smuggled into confidence or vice versa.
0562. **Threshold-justification record** — every promotion threshold has a documented cost-benefit justification.
0563. **Cost-of-FP versus cost-of-FN model** — thresholds derive from explicit false-positive and false-negative cost estimates per program rather than intuition.
0564. **Threshold-per-program tuning** — high-noise programs get higher auto-report thresholds.
0565. **Emergency-threshold override** — critical-infrastructure targets get lower auto-escalation thresholds that are documented and audited.
0566. **Threshold-change changelog** — every threshold change is versioned with before-and-after impact analysis.
0567. **A/B threshold experiments** — threshold changes are tested on shadow traffic before production rollout.
0568. **Confidence-compression guard** — prevents all findings clustering at point nine nine, since healthy systems show a spread.
0569. **Zero-evidence confidence ban** — findings with no probe evidence cannot exceed point three no matter how alarming the heuristic.
0570. **Heuristic-only labeler** — heuristic detections stay permanently labeled heuristic until probe evidence arrives.
0571. **Unknown-unknown reserve** — reserves an unmodeled-risk term so confidence never reaches exactly one point zero.
0572. **Model-uncertainty versus data-uncertainty split** — separates uncertainty about the math from noisy data in the report.
0573. **Adversarial-noise margin** — widens intervals for targets with active WAFs or adversarial responses.
0574. **Small-sample warning** — findings with fewer than five probes get a small-sample badge regardless of score.
0575. **Multiple-comparison correction** — when a thousand parameters are probed, significance thresholds tighten in Bonferroni style to control false-positive floods.
0576. **Look-elsewhere effect guard** — the more probes run, the stronger the final evidence must be, penalizing significance hunting through probing.
0577. **Stopping-rule bias correction** — accounts for probing having stopped exactly when significance appeared, correcting optional-stopping inflation.
0578. **Regression-to-the-mean guard** — extreme first-probe results are re-tested before belief since flukes regress.
0579. **Survivorship-bias audit** — tracks probes that were started but abandoned, since abandoned-probe patterns reveal systematic blind spots.
0580. **Selection-bias corrector** — adjusts for the agent probing interesting endpoints more heavily, since interesting does not equal vulnerable.
0581. **Confirmation-bias circuit breaker** — after three failed confirmations the agent must switch techniques or drop the hypothesis rather than keep hammering.
0582. **Sunk-cost probe limiter** — caps probes per hypothesis because having tried fifty payloads is not evidence.
0583. **Hypothesis-registry** — every hypothesis is registered before probing, and unregistered discoveries are treated as exploratory rather than confirmatory.
0584. **Pre-registered success criteria** — the confirmation bar is set before probing starts, preventing moving goalposts.
0585. **Exploratory-versus-confirmatory labeler** — reconnaissance-phase hunches stay labeled exploratory until a pre-registered confirmatory test passes.
0586. **HARKing detector** — flags hypotheses clearly formed after seeing the data and requires fresh-data confirmation.
0587. **Out-of-sample confirmation** — the confirming probe must use data and payloads not used during hypothesis formation.
0588. **Cross-validation for ML detectors** — machine-learning detectors are evaluated with proper cross-validation rather than training-set accuracy.
0589. **Detector-precision floor** — any detector below point seven precision is demoted to hint generator and never acts as a confirmer.
0590. **Ensemble-diversity metric** — measures whether ensemble members actually disagree sometimes, since clones add no value.
0591. **Confidence-backtest harness** — replays historical hunts through new confidence math to measure improvement before rollout.
0592. **Counterfactual-confidence check** — asks what confidence would be if the strongest probe were removed, and fragile findings are flagged.
0593. **Leave-one-probe-out robustness** — findings must survive removal of their strongest probe to earn a robust label.
0594. **Adversarial-evidence injection test** — tests whether a single malicious response could manufacture a false confirmation, probing the robustness of the math itself.
0595. **Confidence-math documentation standard** — every formula has a documentation page with assumptions, limits, and worked examples.
0596. **Uncertainty-budget report** — the PDF shows where uncertainty comes from, for example probe noise forty percent and prior thirty percent.
0597. **Decision-theoretic reporting rule** — reports include findings when expected value of impact times confidence exceeds the review cost.
0598. **Value-of-information probe ordering** — next probes are chosen by expected information gain per request cost.
0599. **Optimal-stopping for verification** — a formal stopping rule balances probe cost against false-positive cost.
0600. **Confidence-math peer review** — changes to the confidence math require a second-engineer review before deployment.
0601. **WAF-block-page fingerprint library** — maintains signatures for over forty WAF products so payload echoes in block pages are never mistaken for genuine reflections.
0602. **Block-page versus app-page discriminator** — compares response headers, titles, and DOM structure to decide whether the suspicious response came from the WAF at all.
0603. **WAF-echo quarantine** — any finding whose only evidence is WAF-echoed payload is auto-quarantined with the WAF signature attached.
0604. **Challenge-page detector** — identifies JavaScript and captcha bot-management challenges and excludes their echoed payloads from analysis.
0605. **Rate-limit-page discriminator** — fingerprints 429 pages so SQL keywords in rate-limit responses are not misread as error-based SQLi.
0606. **WAF-learning-mode detector** — detects WAFs in monitoring-only mode through header analysis to avoid assuming protection that is not active.
0607. **WAF-rule-ID extractor** — parses block pages for rule identifiers, and repeated rule IDs reveal which payload classes are filtered, guiding rather than faking confirmation.
0608. **False-block versus true-block separator** — distinguishes WAF blocks of the probe from application-level rejections, since only application behavior counts toward confirmation.
0609. **CDN-error-page library** — fingerprints major CDN error pages that echo request data.
0610. **Edge-redirect artifact filter** — excludes redirect responses generated at the edge rather than the application from open-redirect analysis.
0611. **Bot-score header auditor** — reads bot-management headers to know when responses are bot-tailored, discounting their evidence accordingly.
0612. **WAF-bypass versus WAF-absent labeler** — labels whether the payload succeeded because the WAF was bypassed or because no WAF inspected that path.
0613. **API-gateway error discriminator** — fingerprints gateway errors from common gateways that mimic application errors.
0614. **Load-balancer error filter** — excludes load-balancer-generated 502 and 503 pages from injection analysis.
0615. **WAF-canary probe** — sends a known-blocked canary first to map exactly what the WAF inspects, calibrating all later probes.
0616. **Geo-block page detector** — identifies geo-blocking pages so region-dependent behaviors are not reported as global vulnerabilities.
0617. **IP-reputation block discriminator** — distinguishes reputation-based blocks from vulnerability-relevant behavior.
0618. **WAF-response-time fingerprint** — uses WAF-specific timing to attribute slow responses to the WAF rather than to time-based injection.
0619. **Managed-ruleset version tracker** — tracks WAF ruleset versions, and finding validity is re-checked whenever rulesets change.
0620. **WAF-evasion necessity audit** — documents whether evasion was needed, and findings requiring exotic evasion get an evasion-dependent label.
0621. **False-positive WAF-rule reporter** — when a WAF rule blocks benign application functionality, reports it as a tuning issue rather than an application vulnerability.
0622. **WAF-header presence versus enforcement** — verifies the WAF actually blocks rather than merely adding headers before crediting it as mitigation.
0623. **Multi-CDN attribution** — attributes each response to the serving CDN layer so findings are filed against the correct component.
0624. **Edge-compute behavior mapper** — maps edge-worker transformations that alter payloads before the application sees them.
0625. **Anycast-routing variance guard** — accounts for anycast routing sending probes to different points of presence with different behaviors.
0626. **Stale-edge-cache guard** — verifies findings against origin with cache busters, and edge-cached anomalies are excluded.
0627. **WAF-log versus app-log correlator** — correlates block events with application logs to confirm which layer acted.
0628. **Shadow-WAF detector** — detects WAFs that only log without blocking to prevent false mitigation credit.
0629. **WAF-fingerprint confidence** — the WAF identification itself carries a confidence score, and low-confidence identifications do not trigger exclusions.
0630. **Environment-attribution summary** — every finding records which layers among WAF, CDN, and application touched the probe path.
0631. **Framework-debug-page library** — fingerprints major framework debug pages so their verbose output is not mistaken for information-disclosure vulnerabilities.
0632. **Debug-mode qualifier** — labels findings from debug-mode responses as environment dependent and requires production-mode re-confirmation.
0633. **Default-error-page catalog** — catalogs framework default 404 and 500 pages to exclude their supposed leaks, which are merely defaults.
0634. **Dev-toolbar detector** — identifies framework debug toolbars, treating their presence as a configuration note and their data as non-evidence.
0635. **Example-app detector** — fingerprints framework example applications and welcome pages, excluding their intentionally vulnerable-looking demos.
0636. **Docs-page excluder** — auto-excludes documentation and API specification paths from vulnerability analysis since they are meant to be descriptive.
0637. **Health-check excluder** — excludes health, readiness, and ping endpoints from finding generation.
0638. **Actuator-endpoint qualifier** — actuator findings require actual sensitive exposure, since mere actuator exposure is a configuration note.
0639. **GraphQL-playground detector** — playground interfaces are developer tools, and their presence alone is not a finding.
0640. **Default-credential-page discriminator** — distinguishes default login pages from actual default-credential acceptance, which needs a login proof.
0641. **Installer-wizard detector** — identifies installer and setup wizards, treating their presence as a configuration finding only when actually executable.
0642. **phpinfo exposure qualifier** — phpinfo output is information disclosure only when it reveals non-public secrets, and the page itself is a hardening note.
0643. **Server-status page audit** — server-status endpoints need actual sensitive data rather than merely having status modules enabled.
0644. **Stack-trace default versus custom** — default framework traces carry lower severity than custom traces leaking business data.
0645. **Version-header catalog** — server and powered-by headers are cataloged as hardening notes and never as vulnerabilities alone.
0646. **Default-file excluder** — excludes robots files, favicons, and well-known URIs from anomaly-detection baselines.
0647. **Framework-migration artifact detector** — identifies half-migrated stacks showing headers from two frameworks to avoid misattribution.
0648. **CMS-version fingerprint gate** — CMS vulnerabilities need version-specific proof rather than version detection alone.
0649. **Plugin-enumeration prudence** — enumerated plugins are leads rather than findings until a vulnerable version with a reachable flaw is proven.
0650. **Theme-editor exposure check** — CMS theme editors need an actual file-write proof rather than mere menu visibility.
0651. **JSON user-enumeration qualifier** — user-listing API endpoints are by design on many sites, and the finding needs a demonstrated abuse path.
0652. **XMLRPC-method audit** — XML-RPC endpoints need a working abusive-method proof rather than mere existence.
0653. **Admin-ajax action enumerator** — enumerates ajax actions but requires per-action authorization proof.
0654. **Default-API-key detector** — distinguishes example keys in documentation from live keys.
0655. **Sample-data excluder** — test records in responses are sample data rather than real personal-data leaks.
0656. **Lorem-ipsum content filter** — placeholder content is excluded from information-disclosure analysis.
0657. **Staging-banner detector** — staging and development banners route findings to environment-qualified status.
0658. **Feature-flag evaluator** — disabled features endpoints are labeled dormant rather than vulnerable unless actually reachable.
0659. **Maintenance-page detector** — maintenance-mode responses are excluded from analysis entirely.
0660. **Coming-soon page excluder** — placeholder sites generate zero findings and only a no-attack-surface note.
0661. **Honeypot-behavior profiler** — profiles responses for honeypot tells such as instant fake vulnerabilities, tarpitting, and overly eager banners, quarantining the target when found.
0662. **Canary-token trip detector** — detects when probes hit canary tokens and immediately halts that vector to avoid burning the engagement.
0663. **Tarpit-timing detector** — identifies artificially slow responses designed to trap scanners, and timing evidence from tarpits is discarded.
0664. **Fake-vulnerability honeypot filter** — honeypots faking SQLi or XSS reflections are fingerprinted and their supposed findings suppressed.
0665. **Deception-port excluder** — ports that accept everything and emulate services are excluded from service-vulnerability analysis.
0666. **Honeypot-software fingerprint** — matches known honeypot software signatures before reporting service flaws.
0667. **Greylist-behavior detector** — identifies greylisting mail servers so email-injection findings are not fabricated from deferrals.
0668. **Honey-user detector** — accounts that always succeed authentication are flagged as deception rather than authorization bypass.
0669. **Synthetic-monitoring endpoint excluder** — excludes uptime-monitor endpoints from anomaly baselines.
0670. **Security-scanner artifact filter** — detects residues of other scanners in logs and pages to avoid double-attributing their noise.
0671. **Bounty-platform probe detector** — identifies platform-injected test traffic and excludes it from baselines.
0672. **Client-side honeypot detector** — detects JavaScript traps that fake DOM sinks for bots, and findings from trap code are suppressed.
0673. **Fake-admin-panel filter** — honeypot admin panels accepting any credentials are fingerprinted rather than reported as authentication bypass.
0674. **Active-monitoring disclaimer** — notes when target behaviors suggest active monitoring and adjusts probe aggressiveness accordingly.
0675. **Deception-consistency check** — verifies the target claimed stack matches its behavior, and mismatches trigger honeypot suspicion.
0676. **Response-too-perfect detector** — flags responses that look crafted for scanners such as instant textbook SQL errors as likely deception.
0677. **Impossible-service banner filter** — banners advertising impossible version combinations are treated as deception markers.
0678. **Honeypot-confidence score** — every target gets a honeypot-likelihood score, and high scores route all findings to manual review.
0679. **Deception-aware probe budget** — reduces probe aggressiveness automatically as honeypot likelihood rises.
0680. **Post-honeypot evidence purge** — when a target is later identified as a honeypot, all its findings are purged with an audit note.
0681. **Scope-deception guard** — verifies the target actually belongs to the authorized scope, and out-of-scope lookalikes are never probed.
0682. **Typosquat-target guard** — detects lookalike domains in scope lists and requires explicit confirmation before probing.
0683. **Parked-domain detector** — parked pages generate no findings.
0684. **Domain-for-sale detector** — sale landing pages are excluded from analysis.
0685. **Expired-domain guard** — expired domains are flagged rather than hunted.
0686. **CDN-placeholder detector** — default CDN landing pages are excluded.
0687. **Webhost-default-page filter** — default hosting pages generate no findings.
0688. **Wildcard-DNS trap detector** — detects wildcard DNS that makes every subdomain resolve, since takeover claims need real dangling records.
0689. **DNS-sinkhole detector** — identifies sinkholed domains and halts probing.
0690. **Environment-fingerprint confidence** — the environment classification itself is scored, and low-confidence classifications do not suppress findings.
0691. **Multi-tenant shared-IP attributor** — attributes findings to the correct virtual host on shared IPs so neighbor-tenant behaviors are not filed as the target vulnerabilities.
0692. **SNI-routing verifier** — verifies requests actually reached the intended virtual host through SNI and Host consistency rather than a default host.
0693. **Default-vhost response filter** — excludes default virtual-host responses from the target findings.
0694. **Reverse-proxy header audit** — documents which headers the proxy strips or adds so findings are not attributed to stripped protections.
0695. **Proxy-versus-origin behavior diff** — diffs proxied against direct responses to attribute behaviors correctly.
0696. **Geo-fenced behavior labeler** — labels findings that only reproduce from certain regions.
0697. **Time-fenced behavior detector** — identifies behaviors occurring only in specific windows such as maintenance or batch jobs and labels them.
0698. **A/B-test variant attributor** — attributes findings to the specific variant or bucket that produced them.
0699. **Blue-green deployment guard** — detects mid-hunt deploys through version flips and re-baselines instead of mixing evidence across versions.
0700. **Environment-fingerprint report appendix** — the PDF documents the full environment classification so clients can dispute it.
0701. **Root-cause merge key** — findings merge on root cause and sink location rather than on URL and payload, so one flaw yields exactly one finding.
0702. **Redirect-chain collapser** — findings on every hop of a redirect chain collapse into the originating flaw.
0703. **Parameter-variant merger** — the same flaw reached through different parameter names merges into one finding with all vectors listed.
0704. **Payload-canonicalizer** — normalizes payloads across encoding, case, and whitespace before deduplication so trivial variants do not multiply findings.
0705. **HTTP and HTTPS duplicate merger** — the same flaw on both schemes merges with both URLs noted.
0706. **WWW versus apex merger** — findings merge across www and apex variants when they serve the same application.
0707. **Trailing-slash normalizer** — path variants with and without trailing slashes merge when they hit the same handler.
0708. **Case-variant path merger** — paths differing only in case merge when the server treats them identically.
0709. **Session-specific dedup guard** — findings differing only by session identifier merge, and session identifiers are stripped from merge keys.
0710. **Timestamp-noise stripper** — timestamps, nonces, and request identifiers are stripped before similarity comparison.
0711. **Error-message template merger** — different user inputs producing the same error template merge into one input-validation finding.
0712. **Subdomain-service merger** — the same vulnerable service on ten subdomains becomes one finding with an affected-hosts list.
0713. **Port-variant merger** — the same flaw on multiple ports merges into one finding.
0714. **API-version merger** — the same flaw across API versions merges unless the versions genuinely differ in code.
0715. **Mobile-versus-web parity merger** — the same backend flaw reached through app and web merges with both vectors documented.
0716. **Language-locale merger** — findings reproduced across locales merge into one.
0717. **Encoding-variant merger** — UTF-8, UTF-16, and double-encoded variants of one flaw merge.
0718. **Method-variant merger** — GET and POST variants of the same injection merge.
0719. **Fragment-versus-query merger** — DOM sinks reachable through hash or query merge when the sink is identical.
0720. **Near-duplicate fuzzy hasher** — similarity hashing over normalized evidence merges findings above point nine similarity for human review.
0721. **Merge-audit trail** — every merge records which findings merged and why, and reviewers can reverse any merge.
0722. **Merge-confidence propagation** — merged findings take the maximum confidence with all evidence attached rather than averaging down.
0723. **Severity-of-merged take-max** — merged severity is the maximum of members with documented rationale.
0724. **Unmerge request handler** — reviewers can unmerge with one click, and unmerges train the merger.
0725. **Cross-hunt root-cause linker** — links the same root cause across hunts into a persistent flaw record.
0726. **Flaw-lifecycle tracker** — tracks each flaw from first seen through confirmed, reported, fixed, and verified across hunts.
0727. **Regression re-opener** — when a supposedly fixed flaw reappears, it reopens with full history rather than filing as new.
0728. **Duplicate-threshold tuner** — merge thresholds are tuned per program from reviewer unmerge rates.
0729. **Merge-explanation generator** — each merged finding explains in one line why its members constitute the same flaw.
0730. **Dedup-precision monitor** — samples merged pairs for reviewer validation, and precision below point nine five triggers retuning.
0731. **CVE-version matcher** — matches detected software versions against CVE feeds so already-known CVEs are labeled rather than rediscovered.
0732. **Vendor-advisory correlator** — correlates findings with vendor security advisories to avoid reporting patched known issues as new.
0733. **Patch-presence verifier** — verifies the patch is actually applied through behavioral testing rather than version claims.
0734. **Already-reported detector** — checks the program disclosed-report history where available to avoid duplicate submissions.
0735. **Public-disclosure search** — searches public writeups for the same flaw class on the target before reporting.
0736. **Changelog-miner** — mines changelogs and release notes for silent fixes matching the finding.
0737. **Fix-commit attributor** — links findings to upstream fix commits when the code is public.
0738. **NVD-description matcher** — fuzzy-matches finding descriptions against NVD entries for the detected stack.
0739. **Exploit-database correlation** — correlates with public exploits for the version, and known-exploit plus unpatched escalates rather than reports as new.
0740. **Dependency-advisory cross-check** — checks dependency findings against package advisories with reachability analysis.
0741. **Reachability-gated dependency reporting** — unreachable vulnerable functions are labeled rather than reported as exploitable.
0742. **Transitive-dependency attributor** — attributes the flaw to the correct dependency in the tree.
0743. **Backport-patch detector** — detects backported patches that keep version numbers static through behavioral tests before claiming CVE applicability.
0744. **Distro-patch tracker** — accounts for distribution-backported security fixes that keep version numbers unchanged.
0745. **EOL-software qualifier** — end-of-life software is a risk note, and specific vulnerabilities still need proof.
0746. **Known-FP-signature library** — maintains signatures of scanner-known false positives and pre-filters them.
0747. **Vendor-FP-list subscriber** — ingests vendors published false-positive lists for their own products.
0748. **Upstream-fix re-verification** — re-tests after upstream patches with the original proof of concept.
0749. **Disclosure-timeline checker** — verifies whether the issue is already past its disclosure deadline and therefore public knowledge.
0750. **Upstream-attribution labeler** — labels findings as known-upstream versus novel explicitly in the report.
0751. **Cross-hunt flapping detector** — findings that appear and disappear across hunts trigger a stability investigation rather than silent re-reporting.
0752. **Baseline-drift monitor** — tracks endpoint behavior baselines across hunts, since drift explains supposed new findings that are actually environmental.
0753. **Finding-persistence scorer** — scores findings by consecutive confirming hunts, and one-hunt wonders are labeled.
0754. **Inter-hunt evidence linker** — links evidence across hunts so reviewers see the complete history.
0755. **Hunt-comparability gate** — compares only hunts with similar scope and configuration, normalizing configuration changes first.
0756. **Target-evolution tracker** — records target changes in tech stack and WAF between hunts to explain confidence shifts.
0757. **Seasonal-behavior guard** — accounts for time-of-day and day-of-week behavior differences before declaring changes.
0758. **Config-drift explainer** — when a finding vanishes, checks for configuration or WAF changes before declaring it fixed.
0759. **Silent-fix detector** — detects fixes with no changelog through behavioral diffing across hunts.
0760. **Regression-window measurer** — measures how long a fix stayed fixed before regressing.
0761. **Hunt-quality scorer** — scores each hunt verification rigor, and low-rigor hunts findings are re-verified before reporting.
0762. **Cross-hunt reviewer-consistency** — tracks whether different reviewers decide similar findings similarly, and divergence triggers calibration.
0763. **Inter-hunt FP-pattern learner** — mines false positives recurring across hunts into the pattern library automatically.
0764. **Program-FP-rate tracker** — tracks false-positive rate per program over time, and rising rates trigger detector audits.
0765. **Detector-version attributor** — attributes false-positive-rate changes to detector version changes.
0766. **Hunt-parameter recorder** — records every hunt configuration so results are reproducible and comparable.
0767. **Reproducibility verifier** — re-runs a sample of old hunts confirmations to verify the pipeline still agrees with itself.
0768. **Longitudinal-confidence plot** — plots each persistent finding confidence over time in internal dashboards.
0769. **Stale-finding reaper** — findings unconfirmed for ninety days are archived rather than carried forward silently.
0770. **Inter-hunt consistency report** — produces an internal monthly quality report on flapping, drift, and persistence.
0771. **Per-endpoint response profiler** — profiles status, length, and timing distributions per endpoint from benign traffic before any attack probing.
0772. **Baseline-warmup requirement** — no anomaly-based finding is raised until the baseline holds at least fifty benign samples.
0773. **Delta-threshold per endpoint** — anomaly thresholds derive from the endpoint own variance rather than global constants.
0774. **Benign-parameter fuzzer** — learns normal parameter shapes such as numeric identifiers and enums to distinguish malformed-input errors from injection.
0775. **Normal-error catalog** — catalogs the endpoint normal error responses so ordinary errors are not mistaken for injection oracles.
0776. **Timing-baseline per endpoint** — each endpoint gets its own latency distribution, and global timing thresholds are banned.
0777. **Length-baseline per endpoint** — response-length anomalies are judged against the endpoint own history.
0778. **Status-code norm tracker** — learns which statuses are normal per endpoint since some APIs legitimately return 404 responses.
0779. **Redirect-norm mapper** — learns normal redirect patterns so open-redirect detection is not fooled by normal flows.
0780. **Content-type norm enforcer** — flags only deviations from the endpoint normal content types.
0781. **Authentication-norm profiler** — learns which endpoints normally require authentication, and missing-authentication claims are judged against the norm.
0782. **Rate-limit norm learner** — learns normal rate-limit behavior to avoid mistaking throttling for vulnerability signals.
0783. **Baseline-contamination guard** — ensures attack probes do not pollute the benign baseline by keeping traffic classes separate.
0784. **Baseline-refresh cadence** — baselines refresh weekly, and stale baselines are labeled.
0785. **Concept-drift detector** — detects when an endpoint behavior distribution shifts after a deploy and triggers re-baselining.
0786. **Cold-start caution** — new endpoints with thin baselines get wider uncertainty intervals.
0787. **Multi-modal baseline handler** — endpoints with legitimately multimodal behavior such as fast cache hits and slow misses model both modes.
0788. **Baseline-explainability** — reviewers can inspect the baseline samples behind any anomaly claim.
0789. **Adversarial-baseline-poisoning guard** — detects attempts to poison baselines through slow-drip anomalous traffic.
0790. **Baseline-sharing across similar endpoints** — pools baselines for endpoints with identical handlers together with similarity justification.
0791. **Read-only re-verification mode** — re-verification replays use only GET and HEAD plus provably non-mutating requests.
0792. **Canary-token re-proof** — every re-verification uses fresh unique canaries so old artifacts cannot validate new claims.
0793. **Non-mutating SQLi re-proof** — re-proves SQLi with SELECT-only payloads, and any write primitive is re-tested in read-only form.
0794. **Revert-verified write proofs** — any mutating proof must demonstrate the revert succeeded before the finding is filed.
0795. **Rate-limited re-verification** — re-probes run at no more than ten percent of the original probe rate to avoid disrupting the target.
0796. **Off-hours re-verification scheduler** — heavy re-verification runs during the target off-hours where timezone is known.
0797. **Scope re-check pre-probe** — re-verification re-confirms the target remains in authorized scope before sending any packet.
0798. **Data-minimization in evidence** — stored evidence contains canaries and metadata but never real user data.
0799. **PII-scrubber for evidence** — automated scrubbing removes PII-shaped strings from all stored probe evidence.
0800. **Safe-mode attestation** — the report attests which proofs were non-destructive and which required mutation with authorization.
0801. **Expected-value queue ordering** — orders reviews by impact times confidence times novelty rather than arrival time.
0802. **Review-budget allocator** — distributes reviewer attention by expected value, so low-value findings get sampled rather than fully reviewed.
0803. **One-click confirm and dismiss** — reviewers decide in a single click because friction is the enemy of throughput.
0804. **Reason-capture on dismiss** — dismissals require a reason from the taxonomy, and reasonless dismissals are rejected by the interface.
0805. **Reason-capture on confirm** — confirmations record which evidence convinced the reviewer, training the system on success patterns.
0806. **Top-five daily digest** — reviewers receive the five highest-value unconfirmed findings daily rather than a firehose.
0807. **SLA-per-severity timer** — Critical reviews are due in four hours and High in twenty-four, with breaches escalating automatically.
0808. **Stale-review reaper** — reviews idle past SLA are reassigned rather than left to rot.
0809. **Review-context bundle** — each review shows evidence, baselines, similar past decisions, and the confidence math in one view.
0810. **Side-by-side evidence viewer** — shows probe versus control responses side by side for fast differential judgment.
0811. **Confidence-sorted batches** — reviewers work batches sorted by confidence so calibration stays anchored.
0812. **Blind-review mode** — hides the agent severity and confidence on a sample to measure reviewer independence.
0813. **Review-fatigue monitor** — tracks decisions per hour, and fatigued reviewers are routed low-stakes items.
0814. **Queue-health dashboard** — shows queue depth, age distribution, and false-positive rate in real time.
0815. **Auto-escalation on disagreement** — agent-high-confidence plus reviewer-dismiss triggers a second reviewer automatically.
0816. **Dismissal-appeal path** — the agent can appeal dismissals with new evidence, and appeals are tracked.
0817. **Reviewer-workload balancer** — distributes load evenly because overloaded reviewers make worse decisions.
0818. **Mobile-review triage** — critical findings are reviewable from a phone with the full evidence bundle.
0819. **Review-deadline negotiator** — reviewers can request evidence top-ups instead of deciding blind.
0820. **Queue-priority override audit** — manual priority overrides are logged with reasons.
0821. **Reviewer-reputation scorer** — tracks each reviewer precision and recall against ground truth, and reputation weights future votes.
0822. **New-reviewer probation** — new reviewers decisions are shadow-scored against seniors for fifty cases before counting fully.
0823. **Reviewer-calibration sessions** — monthly blind sets with known answers keep reviewers honest.
0824. **Inter-reviewer agreement tracker** — tracks agreement coefficients per finding class, and low-agreement classes get rubric rewrites.
0825. **Consensus-threshold rule** — Critical findings need two independent confirmations and High needs one, with no single-reviewer Criticals allowed.
0826. **Independent-second-review** — the second reviewer sees raw evidence rather than the first reviewer verdict.
0827. **Disagreement-resolution protocol** — tied reviews go to a senior arbiter with both rationales preserved.
0828. **Dissent-preservation rule** — minority opinions stay attached to the finding permanently.
0829. **Reviewer-bias detector** — detects reviewers who always confirm or always dismiss and recalibrates their weight.
0830. **Automation-bias guard** — reviewers must open the evidence bundle before the confirm button enables, blocking blind trust in the agent.
0831. **Seniority-weighted voting** — votes weight by reputation rather than title, so a sharp junior can outvote a careless senior.
0832. **Blind re-review sampler** — five percent of decided findings get a blind second review to measure decision quality.
0833. **Review-decision audit log** — every decision records who decided, when, which evidence version, and why.
0834. **Decision-reversal tracker** — tracks reversals, and high-reversal reviewers get coaching rather than punishment.
0835. **Reviewer-feedback latency** — measures time from review to agent-behavior change, and slow loops are escalated.
0836. **Expertise-router** — routes cryptography findings to cryptography reviewers and web findings to web reviewers, with mismatched routing measured and fixed.
0837. **Reviewer-confidence elicitation** — reviewers record their own confidence, and agent-versus-human confidence gaps are analyzed.
0838. **Abstention option** — reviewers can abstain with a reason, since forced decisions on unclear evidence produce noise.
0839. **Abstention-routing** — abstained findings route to specialists or automatically gather more evidence.
0840. **Review-quality scorecard** — produces a monthly per-reviewer quality report that stays private and coaching oriented.
0841. **Dismissal-reason to detector patch** — every dismissal reason maps to a detector-improvement ticket, and the loop is tracked to closure.
0842. **FP-pattern auto-miner** — clusters dismissal reasons into new false-positive-pattern library entries automatically.
0843. **Confirm-pattern reinforcer** — confirmed findings evidence patterns strengthen the corresponding detectors.
0844. **Reviewer-note NLP miner** — mines free-text reviewer notes for recurring false-positive themes.
0845. **Threshold auto-tuner** — dismissal rates per class automatically nudge promotion thresholds weekly.
0846. **Probe-technique deprecator** — techniques with sustained low precision are auto-deprecated with a migration note.
0847. **Detector-changelog per finding** — findings show which detector version found them so feedback lands on the right code.
0848. **A/B detector rollout** — new detectors run in shadow mode, and promotion needs precision at least matching the incumbent.
0849. **Feedback-latency SLA** — reviewer feedback must reach detector behavior within seven days, tracked publicly internally.
0850. **False-negative hunter** — periodically re-reviews dismissed findings with new techniques to catch reviewer-missed real bugs.
0851. **Dismissed-finding resurrection** — new evidence automatically reopens wrongly dismissed findings with full history.
0852. **Reviewer-suggested probes** — reviewers can request specific confirmation probes, and the agent runs them and reports back.
0853. **Probe-request tracker** — tracks reviewer-requested probes to completion, and dropped requests are flagged.
0854. **Explanation-quality feedback** — reviewers rate finding explanations, and low-rated explanations trigger rewrites.
0855. **Evidence-sufficiency voter** — reviewers vote when more evidence is needed, and two votes automatically trigger deeper probing.
0856. **Counterexample collector** — reviewers submit counterexamples that become regression tests for detectors.
0857. **Regression-test harness** — every false positive becomes a regression test, and detectors must pass the full suite before release.
0858. **Detector-scorecard publisher** — publishes internal precision and recall scorecards per detector weekly.
0859. **Kill-list for hopeless detectors** — detectors below the precision floor for four weeks are retired rather than tuned forever.
0860. **Feedback-loop health metric** — measures dismiss-to-fix cycle time as a top-level quality metric.
0861. **Stratified audit sampler** — audits sample across severity, confidence, and class strata rather than only the top of the queue.
0862. **Low-confidence audit boost** — over-samples low-confidence findings since that is where false positives hide.
0863. **Confirmed-finding audit** — even confirmed findings get sampled, since confirmation is not immunity from review.
0864. **Audit-independence rule** — auditors cannot audit their own reviews.
0865. **Audit-finding taxonomy** — classifies audit failures into detector, reviewer, and process causes.
0866. **Audit-action tracker** — every audit failure gets a corrective action with an owner and deadline.
0867. **Red-team the pipeline** — periodically injects synthetic vulnerabilities to measure end-to-end detection plus confirmation.
0868. **Synthetic-FP injection** — injects known false-positive patterns to verify the filters actually catch them.
0869. **Pipeline-precision dashboard** — shows end-to-end precision from probe to report, updated daily.
0870. **Precision-by-stage funnel** — shows precision at detection, confirmation, review, and report stages to find the leakiest stage.
0871. **Stage-gate effectiveness** — measures how many false positives each gate among ladder rungs and reviews actually kills.
0872. **Gate-bypass audit** — finds findings that skipped gates and measures their false-positive rate against gated ones.
0873. **Quality-gate for report inclusion** — findings below the quality bar cannot enter the PDF, with no exceptions.
0874. **Pre-report human sign-off** — a human signs off the final finding list, and the agent never self-publishes.
0875. **Sign-off scope limiter** — sign-off covers exactly the listed findings, and last-minute additions need new sign-off.
0876. **Report-freeze protocol** — the finding list freezes twenty-four hours before delivery, and late additions ship as addenda.
0877. **Addendum discipline** — post-freeze findings ship as dated addenda rather than silent edits.
0878. **Client-dispute handler** — client claims of false positives get a structured re-verification workflow rather than arguments.
0879. **Dispute-outcome tracker** — tracks dispute results, and lost disputes become training data.
0880. **Client-FP-rate SLA** — commits to a measured false-positive rate such as under five percent and reports it honestly.
0881. **On-call critical reviewer** — a paged human covers Critical confirmations around the clock, with no Critical auto-reports.
0882. **Reviewer-unavailable fallback** — when no reviewer is reachable, Criticals queue without auto-sending and show client-visible SLA status.
0883. **Emergency-override protocol** — a break-glass override exists but requires two humans and full audit.
0884. **Override-justification mandate** — overrides require written justification, and unjustified overrides are reverted.
0885. **Client-reviewer collaboration** — clients can confirm or dismiss in a shared portal, and their labels train the system too.
0886. **Client-label weight** — client dismissals weight heavily but do not auto-delete, since the agent re-verifies first.
0887. **Multi-client consensus** — the same flaw across clients builds cross-client ground truth.
0888. **Researcher-credit preserver** — human researchers who confirm agent findings get credited in the report.
0889. **Apprentice mode** — new reviewers decide alongside the visible agent recommendation before graduating to blind review.
0890. **Recommendation-visibility toggle** — reviewers can hide agent recommendations to de-bias themselves.
0891. **Decision-support framing** — the interface frames the agent as evidence gatherer while the human owns the verdict.
0892. **Reviewer-override of math** — reviewers can override confidence with a written reason, and overrides are analyzed for math gaps.
0893. **Math-gap miner** — clusters reviewer overrides to find systematic confidence-math blind spots.
0894. **Nudge-not-nag** — the agent suggests rather than pesters, with notification budgets per reviewer per day.
0895. **Review-context persistence** — reviewers resume exactly where they left off with prior context intact.
0896. **Handoff notes** — reviewers leave structured notes for the next reviewer rather than free-text chaos.
0897. **Shift-handoff protocol** — queue state survives reviewer shift changes without losing context.
0898. **Language-localized review UI** — reviewers work in their own language while evidence stays in original form.
0899. **Accessibility of review tools** — review interfaces meet accessibility standards because exclusionary tools produce worse decisions.
0900. **Reviewer-wellbeing guard** — caps daily critical-decision load because exhausted reviewers approve false positives.
0901. **Unconfirmed-auto-demote** — findings stuck below point eight posterior for fourteen days auto-demote to informational with full history preserved.
0902. **Single-evidence severity cap** — single-probe findings cap at Medium severity regardless of claimed impact.
0903. **Staging-only downgrade** — findings reproducible only on staging or development auto-downgrade one tier with an environment label.
0904. **WAF-mitigated downgrade** — a WAF demonstrably blocking the vector downgrades exploitability one tier while noting bypass as follow-up work.
0905. **Theoretical-only labeler** — findings with no working proof of concept are labeled theoretical and excluded from severity counts.
0906. **Interaction-heavy discount** — findings needing three or more improbable victim actions drop one tier automatically.
0907. **EOL-dependency qualifier** — vulnerabilities in end-of-life dependencies need reachability proof or drop to informational.
0908. **Defense-in-depth demotion** — missing hardening with no exploit path demotes to informational hardening notes.
0909. **Duplicate-of-known downgrade** — matches to known CVEs and advisories downgrade novelty while keeping severity honest.
0910. **Low-confidence auto-hold** — findings under point five posterior never reach human review and instead recycle to re-probing or die.
0911. **Contradictory-evidence hold** — contested findings hold at their current tier pending resolution and never auto-promote on conflict.
0912. **Expired-proof demotion** — proofs older than thirty days without re-verification drop one confidence tier.
0913. **Environment-changed reset** — target deploys reset confirmations to needs re-verification rather than leaving them confirmed.
0914. **Scope-narrowed downgrade** — findings outside the primary scope auto-cap at Low with scope notes.
0915. **Data-sensitivity re-tier** — findings touching only synthetic or test data drop one tier automatically.
0916. **Downgrade-audit trail** — every auto-downgrade logs the rule applied, before-and-after values, timestamp, and a reversible diff.
0917. **Downgrade-appeal path** — the agent or a reviewer can appeal auto-downgrades with new evidence.
0918. **Downgrade-rate monitor** — tracks auto-downgrade rates, and spikes indicate detector or environment problems.
0919. **Rule-version pinning** — downgrade rules are versioned, and findings record which version applied.
0920. **Downgrade-explanation renderer** — each downgrade gets a one-line human-readable explanation in the report appendix.
0921. **P0-rumor definition** — P0 means heuristic signal only with no probe evidence and never leaves the lab.
0922. **P1-signal definition** — P1 means a single probe anomaly unconfirmed and stays as an internal lead only.
0923. **P2-indicated definition** — P2 means two independent probes agree and the finding becomes human-review eligible.
0924. **P3-confirmed definition** — P3 means the full ladder passed with posterior of at least point nine five and the finding is reportable.
0925. **P4-weaponized definition** — P4 means end-to-end impact demonstrated safely through canary exfiltration and is reserved for the strongest claims.
0926. **Proof-level promotion criteria** — explicit versioned criteria govern each proof-level transition.
0927. **Proof-level demotion triggers** — explicit triggers such as failed re-probes and environment changes drop proof levels.
0928. **P-level in every report** — the PDF shows proof levels next to severities so clients see proof strength directly.
0929. **P-level versus severity matrix** — documents that P4-Low and P1-Critical are both possible, since proof strength does not equal impact.
0930. **Evidence-chain hasher** — hashes every probe request and response into a tamper-evident chain per finding.
0931. **Hash-chain verifier** — reviewers and clients can verify the evidence chain has not been altered.
0932. **Evidence-timestamp notary** — anchors evidence timestamps in timestamp-authority style for dispute resolution.
0933. **Raw-evidence retention** — raw probe transcripts are retained one year because summaries alone are insufficient for audits.
0934. **Evidence-redaction log** — every redaction of secrets or personal data is logged with a reason, and redacted regions are marked rather than silent.
0935. **Reproducibility packet** — each P3-plus finding ships a packet to reproduce the proof with payload, canary, and expected signals.
0936. **Independent-reproduction test** — a second agent instance reproduces P4 proofs from the packet alone before reporting.
0937. **Evidence-completeness checker** — blocks promotion when required evidence fields are missing.
0938. **Negative-evidence archiver** — failed probes are archived with the finding so cherry-picked successes are detectable.
0939. **Evidence-versioning** — re-probes create new evidence versions, and old versions are never overwritten.
0940. **Proof-level calibration** — tracks what fraction of P3 findings survive client disputes with a target above ninety-five percent.
0941. **Decision-log immutability** — all confirm, dismiss, and downgrade decisions append to an immutable log.
0942. **Who-decided-what tracer** — any finding full decision history is one click away.
0943. **Algorithmic-transparency record** — the exact detector and configuration version behind each finding is stored.
0944. **Config-diff attributor** — attributes behavior changes to configuration changes rather than mysteries.
0945. **Reviewer-attestation signer** — human sign-offs are cryptographically signed statements rather than checkbox clicks.
0946. **Attestation-scope binder** — attestations bind to the exact evidence hash reviewed, and new evidence needs a new attestation.
0947. **Separation-of-duties enforcer** — the reviewer who confirms cannot be the one who tuned the detector for that class.
0948. **Audit-trail exporter** — full audit trails export in a standard format for client compliance teams.
0949. **Retention-policy enforcer** — audit-data retention follows policy, and deletions are themselves logged.
0950. **Tamper-detection monitor** — monitors the audit store for gaps and edits and pages on anomalies.
0951. **External-audit support mode** — provides read-only auditor access with full evidence visibility.
0952. **Compliance-mapping table** — maps each verification step to SOC2 and ISO 27001 controls for enterprise clients.
0953. **Chain-of-custody for evidence** — evidence handling from probe to PDF follows a documented chain.
0954. **Finding-identifier stability** — finding identifiers stay stable across hunts, and renames are aliased rather than broken.
0955. **Report-diff generator** — generates diffs between report versions so clients see exactly what changed.
0956. **Silent-edit detector** — any post-delivery change to a finding triggers an addendum rather than a quiet edit.
0957. **Audit-sampling for automation** — samples automated decisions such as downgrades and merges for human audit monthly.
0958. **Automation-override log** — every human override of automation is logged with a reason.
0959. **Model-card for FP classifier** — the false-positive classifier carries a model card documenting training data, limits, and known failure modes.
0960. **Verification-playbook publisher** — the full verification methodology is published internally and versioned.
0961. **Pre-report verification checklist** — every finding passes a twelve-point checklist covering proof level, evidence, re-verification, scope, and safety before entering the PDF.
0962. **Checklist-exception handler** — exceptions need senior sign-off with expiry dates.
0963. **Verification-coverage meter** — tracks what fraction of attack surface received full-ladder verification versus heuristic-only treatment.
0964. **Coverage-gap reporter** — reports unverified areas explicitly instead of implying full coverage.
0965. **High-value-target deep-verify** — payment, authentication, and admin flows always get full ladders with no heuristic-only treatment on crown jewels.
0966. **Sampling-verification for low-value** — low-value endpoints get sampled deep verification, and the sampling is disclosed.
0967. **Verification-debt tracker** — tracks findings shipped at P2 with a plan to reach P3, keeping the debt visible rather than hidden.
0968. **Debt-paydown scheduler** — automatically schedules re-verification of P2 findings.
0969. **Stale-verification flagger** — flags P3 findings whose proofs aged past policy without re-verification.
0970. **Verification-SLA per tier** — P3 must be reached within seven days of P2 or the finding demotes.
0971. **Fast-lane for criticals** — suspected Criticals get dedicated verification resources immediately.
0972. **Verification-resource accounting** — tracks probe and engineering hours per finding for cost transparency.
0973. **Cost-of-verification reporter** — produces an internal report on verification spend versus false-positive-rate improvement.
0974. **Diminishing-returns cutoff** — stops deep verification when marginal false-positive reduction falls below cost, with the cutoff documented.
0975. **Risk-based verification depth** — verification depth scales with impact times uncertainty through a formalized rule.
0976. **Verification-method registry** — every verification method is registered with its precision statistics.
0977. **Method-deprecation process** — retiring a method requires migrating its findings to new methods or re-verifying them.
0978. **Cross-method agreement gate** — P4 requires two different methods, and single-method P4 is banned.
0979. **Novel-method validation** — new verification methods validate against the labeled corpus before use.
0980. **Method-bias auditor** — checks whether methods systematically over-confirm or under-confirm certain classes.
0981. **Benign-behavior regression suite** — a suite of known-benign endpoints must never produce findings, and failures page immediately.
0982. **Known-FP regression corpus** — five hundred labeled false positives that the pipeline must filter, with regressions blocking releases.
0983. **Adversarial-FP drill** — quarterly drills where red-teamers plant false-positive bait to test the filters.
0984. **Filter-evasion bounty** — an internal bounty rewards finding false-positive-filter bypasses.
0985. **Verification-maturity model** — a five-level maturity assessment for the verification program reviewed quarterly.
0986. **Maturity-gate for autonomy** — higher autonomy such as auto-reporting unlocks only at higher maturity levels.
0987. **Autonomy-level labeler** — every action is labeled with its autonomy level of human-approved versus autonomous.
0988. **Kill-switch for auto-report** — one command halts all autonomous reporting instantly.
0989. **Kill-switch drill** — quarterly tests verify the kill switch actually works.
0990. **Post-mortem for escaped FPs** — every client-reported false positive gets a blameless post-mortem with action items.
0991. **Escaped-FP rate tracker** — tracks the ultimate metric of false positives reaching clients per hundred findings with a target below two.
0992. **Escaped-FP pattern miner** — mines escaped false positives for filter gaps within forty-eight hours.
0993. **Client-trust dashboard** — an internal dashboard shows dispute rates, escape rates, and calibration health.
0994. **Verification-team charter** — documents the mission of no false positive reaching a client with measurable objectives.
0995. **Skeptic-in-residence role** — a rotating role whose job is to try to kill findings before they ship.
0996. **Pre-mortem ritual** — before big reports, the team imagines the report failed and lists why, giving top risks extra verification.
0997. **Finding-obituary writer** — retired and killed findings get a one-line obituary recording what each was and why it died for institutional memory.
0998. **Institutional-memory search** — reviewers can search all past obituaries before deciding similar findings.
0999. **Verification-handbook maintainer** — a living handbook of verification techniques is updated from every post-mortem.
1000. **Continuous-verification manifesto** — documents the program commitment that every finding is re-verified on every hunt until fixed, because yesterday proof is today rumor.
