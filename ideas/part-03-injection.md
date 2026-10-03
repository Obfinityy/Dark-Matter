## G. Injection — SQLi, XSS, SSTI, Command, LDAP, XPath & Novel Vectors
0001. **Error-based SQLi via XML datatype casting** — force database error messages to leak table contents by casting query results into XML types whose error text echoes the values.
0002. **Union-based column-count discovery with ORDER BY bisection** — automate column enumeration using ORDER BY out-of-range errors instead of noisy repeated UNION probes.
0003. **GROUP BY and HAVING error oracle** — trigger grouped-aggregation errors to exfiltrate data where UNION keywords are filtered.
0004. **Double-query injection via COUNT, RAND and FLOOR** — abuse duplicate-key error techniques to extract data through error messages on filtered inputs.
0005. **ExtractValue and UpdateXML error exfiltration** — abuse MySQL XML functions to return query results inside XPATH syntax error messages.
0006. **Cast-to-int overflow exfiltration** — overflow integer casts so the database error echoes the truncated secret value.
0007. **Union with mismatched-type coercion mapping** — probe each column's type via type-coercion errors to build a typed schema map before exfiltrating.
0008. **Stacked-query detection via delayed DDL** — use benign stacked statements with timing delays to confirm multi-statement execution without destructive writes.
0009. **SQLi in ORDER BY via CASE expressions** — inject conditional sort expressions that leak boolean data through result ordering when output is filtered.
0010. **SQLi in LIMIT and OFFSET numeric contexts** — exploit unquoted numeric pagination parameters with arithmetic payloads that bypass string-focused filters.
0011. **Second-order SQLi in stored usernames** — register payload usernames that execute later when rendered into administrative queries.
0012. **SQLi via HTTP header values in logging queries** — inject through X-Forwarded-For or User-Agent when request metadata is inserted into audit tables unsanitized.
0013. **Wildcard LIKE injection for data exfiltration** — abuse LIKE pattern metacharacters in search fields to enumerate values character by character.
0014. **SQLi in JSON path expressions** — inject into JSON_EXTRACT path arguments where the path grammar itself becomes injectable.
0015. **Stored-procedure argument injection** — target EXEC calls with string-concatenated procedure arguments in legacy admin panels.
0016. **SQLi via array parameters in IN clauses** — exploit frameworks that interpolate arrays into IN (...) lists without per-element binding.
0017. **Comment-sequence filter-evasion mapping** — systematically map which comment styles survive each filter to enable reliable payload assembly.
0018. **Scientific-notation numeric smuggling** — pass values like 1e0 to bypass naive numeric checks while keeping the SQL numeric context.
0019. **SQLi in full-text search MATCH and AGAINST** — inject boolean-mode operators into full-text queries that concatenate user input.
0020. **Pivot via error-based DNS exfiltration** — use DNS-resolving database functions to exfiltrate blind SQLi results through DNS queries to a collaborator domain.
0021. **SQLi in bulk-import CSV staging tables** — inject through CSV upload columns that are bulk-inserted then queried with dynamic SQL.
0022. **Time-based inference with heavy-query weighting** — use CPU-heavy queries like cartesian joins for timing where SLEEP functions are blocked.
0023. **SQLi in reporting date-range filters** — target analytics endpoints where date strings are concatenated into GROUP BY date queries.
0024. **Out-of-band exfiltration via HTTP request functions** — abuse database HTTP UDFs to POST query results to an external endpoint where enabled.
0025. **SQLi in soft-delete restoration filters** — inject into restore endpoints that build dynamic WHERE clauses from archived-row identifiers.
0026. **Boolean-blind via response-length differential** — compare response sizes across true and false conditions instead of relying on content keywords.
0027. **Boolean-blind via status-code differential** — detect injected true/false states through 200 versus 500/404 status flips on edge endpoints.
0028. **Blind SQLi via redirect-target differential** — observe Location header changes when injected conditions alter query result counts.
0029. **Time-based blind with statistical timing analysis** — run repeated samples with median filtering to defeat jittery networks.
0030. **DNS exfiltration for blind SQLi on Windows stacks** — trigger DNS lookups via UNC-path functions to leak data label by label.
0031. **Blind SQLi via SLEEP in ORDER BY subqueries** — hide time delays inside sort expressions where statement-level filters miss them.
0032. **Bitwise binary-search exfiltration** — extract data bit by bit with bitwise functions to minimize request counts on blind endpoints.
0033. **Blind SQLi via error-timing side channels** — distinguish true/false by measuring error-handler latency differences rather than content.
0034. **Out-of-band HTTP exfiltration for blind SQL** — chain database HTTP functions with conditional triggers for single-request data theft.
0035. **Blind inference via cache-timing differentials** — conditionally warm query caches so response times reveal boolean answers.
0036. **Blind SQLi in GraphQL resolver arguments** — apply boolean and timing techniques to GraphQL fields backed by raw SQL resolvers.
0037. **Second-order blind SQLi via profile updates** — store payloads in editable fields that later execute inside batch-report queries.
0038. **Blind SQLi via JSON response key ordering** — detect true/false through changes in JSON key order or array length in API responses.
0039. **Heavy-query time-based without SLEEP keyword** — use recursive CTEs or large cross joins for delays where sleep functions are denylisted.
0040. **Blind SQLi via WebSocket message timing** — measure round-trip deltas on socket messages backed by database lookups.
0041. **Differential blind via PDF and report generation time** — time report-generation endpoints whose queries include injected conditions.
0042. **Blind SQLi via email-send latency** — exploit password-reset flows where query-driven mail sending delays reveal boolean state.
0043. **Out-of-band via SMTP DNS resolution** — force the database to resolve collaborator domains inside email-sending stored procedures.
0044. **Blind SQLi in search-suggestion endpoints** — use autocomplete APIs with tiny responses as fast boolean oracles.
0045. **Character-set coercion for filter bypass** — switch charsets so blocked keywords reassemble after database-side conversion.
0046. **JSON nested-object SQLi via dot-notation paths** — inject into ORM JSON-path filters where nested keys are concatenated into SQL.
0047. **MongoDB operator injection via $where** — submit $where payloads in JSON login bodies that bypass naive username/password checks.
0048. **MongoDB $ne and $gt authentication bypass** — send not-equal operators in auth fields to defeat equality checks.
0049. **NoSQL injection in aggregation pipelines** — inject pipeline stages through sort and filter parameters mapped to $match.
0050. **Elasticsearch query-DSL injection** — inject raw JSON DSL through search boxes that merge user JSON into query bodies.
0051. **Elasticsearch script-field injection** — target _search script_fields where user input reaches scripting contexts.
0052. **GraphQL argument injection into raw SQL** — fuzz GraphQL arguments with SQL metacharacters to find resolvers using string-built queries.
0053. **GraphQL nested-filter injection** — abuse deeply nested where/filter inputs that ORMs translate into SQL fragments.
0054. **GraphQL introspection-driven injection mapping** — use introspection to enumerate string arguments then mass-probe each for SQLi.
0055. **JSON array-index SQLi** — inject through array indices in JSON APIs that interpolate indexes into queries unquoted.
0056. **NoSQL regex-injection data exfiltration** — use anchored $regex patterns to brute-force secrets character by character.
0057. **Firestore query-operator abuse** — test orderBy and startAt parameters for operator injection in Firestore-backed apps.
0058. **DynamoDB expression-attribute injection** — probe FilterExpression builders that concatenate user input into expressions.
0059. **GraphQL alias-based filter bypass** — use aliased duplicate arguments to smuggle injection past per-field validation.
0060. **JSONB operator injection in Postgres** — inject through containment operators where keys come from user-controlled JSON.
0061. **Nested JSON SQLi via JSON_TABLE** — target JSON_TABLE column definitions built from user-supplied schemas.
0062. **NoSQL injection via content-type confusion** — send JSON operators to endpoints expecting form data to hit alternate parsers.
0063. **GraphQL mutation argument injection** — focus mutations whose arguments flow into raw UPDATE statements.
0064. **LDAP-backed GraphQL field injection** — test GraphQL fields resolved by LDAP filters for nested injection.
0065. **SQLi through GraphQL variables JSON** — inject via the variables object where resolvers interpolate variable values.
0066. **ORM raw-query fragment injection** — locate raw/execute calls reachable from user input via framework-specific taint patterns.
0067. **Sequelize literal injection via order and group** — abuse sort inputs that reach sequelize.literal in ordering clauses.
0068. **Django extra and RawSQL injection** — probe .extra(where=[...]) endpoints with SQL metacharacters.
0069. **SQLAlchemy text() clause injection** — find text() fragments built with f-strings from request parameters.
0070. **Hibernate HQL injection via sort fields** — inject HQL through sort and direction parameters in Spring Data endpoints.
0071. **ActiveRecord order-string injection** — exploit .order(params[:sort]) patterns with CASE-based payloads.
0072. **TypeORM query-builder injection** — target .where() fragments built by string concatenation.
0073. **Prisma raw-query injection** — probe $queryRaw template-string interpolations of user input.
0074. **Stored XSS-to-SQLi chains in admin exports** — combine stored payloads with export SQL builders for second-order execution.
0075. **Second-order SQLi via password-reset tokens** — inject into token fields later used in UPDATE queries unquoted.
0076. **SQLi in bulk-action ID lists** — exploit comma-joined ID arrays in mass-delete endpoints without per-ID binding.
0077. **ORM injection via JSON sort descriptors** — abuse datatable-style sort descriptors mapped to ORM order clauses.
0078. **SQLi in full-text rank expressions** — inject into relevance expressions built from search terms.
0079. **Second-order via webhook event payloads** — store attacker JSON in webhook logs later queried with dynamic SQL.
0080. **SQLi in analytics funnel definitions** — target user-defined funnel steps concatenated into analytic queries.
0081. **HTML-attribute breakout polyglot library** — maintain payloads escaping single-quoted, double-quoted, and unquoted attributes across form contexts.
0082. **JavaScript string-context escape sequences** — craft payloads using hex, unicode, and line-continuation tricks for quoted JS strings.
0083. **JavaScript template-literal injection** — exploit backtick contexts with ${} interpolation to execute without quote-breaking.
0084. **CSS context expression injection** — inject into style attributes and stylesheets using legacy expression fallbacks and javascript: URLs.
0085. **URL-context javascript: scheme smuggling** — find href and src sinks where user input lands before scheme validation.
0086. **SVG-context XSS via animate tags** — use animate onbegin as a scriptless vector in SVG upload contexts.
0087. **MathML namespace confusion XSS** — abuse math-element parsing differentials to smuggle event handlers past HTML sanitizers.
0088. **HTML comment-context breakout** — escape comment sinks in template engines that reflect input inside comments.
0089. **Title and meta-tag context injection** — inject into title and meta content attributes reflected from SEO fields.
0090. **Noscript-context XSS for JS-disabled crawlers** — target noscript fallbacks that render raw HTML when JS is off.
0091. **Style-tag context injection** — break out of style blocks reflected from theme-customization settings.
0092. **Textarea RCDATA breakout** — exploit early textarea closing in RCDATA elements for stored XSS.
0093. **Iframe srcdoc injection** — inject into srcdoc attributes where HTML reflects into nested browsing contexts.
0094. **Data-attribute to JS sink bridging** — find data-* attributes later read by libraries into .html() sinks.
0095. **Event-handler attribute smuggling via entities** — bypass quote filters with HTML entity-encoded quotes in event attributes.
0096. **Form-action javascript: injection** — hijack form action attributes reflected from redirect parameters.
0097. **Base-tag hijacking via injection** — inject base href to reroute relative script URLs to attacker hosts.
0098. **Meta-refresh injection** — abuse meta refresh URL reflection for phishing-grade redirects plus script contexts.
0099. **JSON-LD script-context injection** — break out of application/ld+json blocks in SEO plugins with script-closing sequences.
0100. **Import-map injection for script rerouting** — inject import maps that remap trusted module specifiers to malicious URLs.
0101. **Template-engine comment leakage XSS** — exploit server-comment versus HTML-comment confusion in mixed template stacks.
0102. **Markdown-link javascript: bypass** — test markdown renderers that allow javascript: or data: URLs in link destinations.
0103. **Markdown image-onerror vectors** — use image-syntax breakouts in custom markdown parsers.
0104. **BBCode parser XSS** — fuzz legacy forum BBCode tags for unescaped attribute reflection.
0105. **Wiki-syntax macro injection** — test wiki-style macro parameters for HTML injection.
0106. **mXSS via innerHTML round-trip mutation** — feed payloads through innerHTML serialize-parse cycles to find mutations that activate scripts.
0107. **DOM XSS source-to-sink taint tracing** — statically map fragment and postMessage inputs to innerHTML and eval sinks in SPA bundles.
0108. **React dangerouslySetInnerHTML audit** — enumerate dangerous props in bundles and trace each to user-controlled data flows.
0109. **Vue v-html directive tracing** — enumerate v-html usages and fuzz bound data with mutation payloads.
0110. **Angular bypassSecurityTrustHtml abuse** — find sanitizer-bypass calls reachable from route params or API data.
0111. **jQuery .html() sink mapping** — catalog .html() and .append() calls in legacy code and test each with DOM-clobbering payloads.
0112. **DOM clobbering via named elements** — use id and name collisions to shadow JavaScript variables and escalate to script execution.
0113. **postMessage handler XSS** — fuzz message event listeners that write event.data into DOM sinks without origin checks.
0114. **Location.hash fragment XSS** — test hash-driven routers that inject fragment values into page content.
0115. **Client-side redirect sink chaining** — chain open-redirect parameters into javascript: URLs via router sinks.
0116. **eval() sink discovery in minified bundles** — search for eval, Function, and setTimeout-string sinks reachable from URL params.
0117. **document.write sink exploitation** — find document.write calls fed by query strings in ad-tech integrations.
0118. **SPA router param injection** — inject into :id route params rendered by client-side templates.
0119. **History API state injection** — poison pushState state objects later rendered into the DOM.
0120. **Web Storage to DOM sink flows** — trace localStorage and sessionStorage reads into innerHTML writes across sessions.
0121. **MutationObserver-driven mXSS** — detect payloads that become executable only after framework re-render mutations.
0122. **Trusted Types bypass probing** — test Trusted Types policies for defaultPolicy or passthrough sinks.
0123. **Sanitizer differential testing** — compare sanitizer versions and configs to find bypassable allowlists.
0124. **SVG-in-HTML mXSS vectors** — embed SVG that mutates into executable form after HTML parsing.
0125. **Template-literal sink in lit-html** — audit lit-html unsafeHTML usages bound to user data.
0126. **innerHTML in Web Components shadow DOM** — test shadow-root innerHTML assignments for encapsulated XSS.
0127. **Import-attribute JSON XSS** — abuse import assertions where JSON data flows into template sinks.
0128. **Client-side search-index XSS** — poison local search indexes whose snippets render as HTML.
0129. **Hash-based JSON state injection** — inject into #state= JSON blobs parsed and rendered by SPAs.
0130. **Service-worker cache XSS persistence** — plant payloads in cached responses that execute on offline replays.
0131. **Profile-field stored XSS** — fuzz display names, bios, and avatars rendered across pages and emails.
0132. **Admin-panel second-order XSS** — store payloads in user fields rendered in admin dashboards with weaker escaping.
0133. **Export-filename stored XSS** — inject filenames that execute when listed in download managers or admin file lists.
0134. **Comment-thread stored XSS** — test nested comment renderers for inconsistent escaping at depth.
0135. **Ticketing-system stored XSS** — probe support ticket subjects and bodies rendered in agent consoles.
0136. **Review and rating stored XSS** — fuzz review text and reviewer names shown on product pages.
0137. **Chat-message stored XSS** — test WebSocket chat history rendering for stored vectors.
0138. **Notification-center stored XSS** — inject into notification titles rendered in dropdown panels.
0139. **Search-history stored XSS** — poison saved searches reflected in account dashboards.
0140. **Order-note stored XSS** — test checkout notes rendered in merchant order views.
0141. **Invoice-line stored XSS** — inject into invoice item descriptions rendered in PDF and HTML views.
0142. **Stored XSS in email templates** — poison transactional email content rendered in webmail previews.
0143. **Second-order via CSV import** — upload CSV with formula and HTML payloads rendered in import-preview tables.
0144. **Avatar alt-text stored XSS** — inject into image alt and title attributes in galleries.
0145. **Stored XSS in calendar events** — fuzz event titles and descriptions rendered in shared calendars.
0146. **Poll and survey stored XSS** — test poll options rendered in results charts and exports.
0147. **Stored XSS via markdown bios** — exploit markdown renderers used for user bios with raw-HTML allowances.
0148. **Second-order via API webhook logs** — store payloads in webhook payloads displayed in integration dashboards.
0149. **Stored XSS in PDF metadata viewers** — inject document titles rendered in browser PDF viewers.
0150. **Draft and autosave stored XSS** — test draft previews that render unsanitized content before final sanitization.
0151. **Jinja2 SSTI via email templates** — detect template injection in customizable welcome and reset emails with arithmetic probes.
0152. **Twig SSTI in CMS themes** — probe Twig-based themes for unescaped user variables in layout files.
0153. **Freemarker SSTI in invoice templates** — test invoice and PDF template editors for expression evaluation.
0154. **Thymeleaf SSTI in error pages** — inject into Thymeleaf error-page expressions via malformed inputs.
0155. **Blade SSTI in Laravel views** — test raw-output blocks fed by user data.
0156. **EJS SSTI in Node templates** — probe output blocks with user-controlled view variables.
0157. **Handlebars SSTI via helper injection** — abuse custom helpers where user input reaches helper arguments.
0158. **Mustache lambda SSTI** — test Mustache lambdas executing user-supplied functions server-side.
0159. **SSTI in PDF generator templates** — target server-side PDF templates with expression payloads.
0160. **SSTI in SMS and notification templates** — fuzz notification template variables for server-side evaluation.
0161. **SSTI via username in welcome banners** — inject template syntax into usernames rendered by server templates.
0162. **SSTI in report-builder templates** — test custom report templates for expression evaluation.
0163. **SSTI in CMS shortcodes** — probe shortcode attributes evaluated as template code.
0164. **Blind SSTI via time-delay expressions** — use sleep and loop constructs in template payloads to confirm blind evaluation.
0165. **SSTI sandbox-escape mapping** — catalog filter bypasses per engine for attribute filters and blacklist gaps.
0166. **SSTI via template inheritance** — inject into extends directives or layout names resolved from user input.
0167. **SSTI in error-message templates** — trigger errors whose messages interpolate user input through templates.
0168. **SSTI in i18n translation strings** — poison translation keys and values evaluated by template engines.
0169. **SSTI via filename in template includes** — traverse include paths with user-controlled filenames.
0170. **SSTI in webhook payload templates** — test integration payload templates for expression evaluation.
0171. **SSTI in sitemap and SEO template generation** — inject into auto-generated SEO templates.
0172. **SSTI via search-query reflection in templates** — test search pages rendering queries through template engines.
0173. **Polyglot SSTI detection probes** — use single payloads that trigger on multiple engines to fingerprint the stack fast.
0174. **SSTI in server-side markdown rendering** — test markdown-to-HTML pipelines that also evaluate template syntax.
0175. **SSTI-to-RCE chain mapping** — document which engine escapes yield code execution per version.
0176. **Command injection via image EXIF fields** — inject shell metacharacters into EXIF tags processed by converter wrappers.
0177. **Command injection via archive filenames** — craft zip and tar filenames with subshell syntax that executes during server-side extraction.
0178. **Command injection via webhook URLs** — inject into webhook endpoint URLs passed to curl or wget shell wrappers.
0179. **Command injection in video-thumbnail generation** — fuzz ffmpeg input filenames with leading-dash and metacharacter payloads.
0180. **Command injection via document-conversion CLIs** — test office-suite and pandoc wrappers with malicious filenames.
0181. **Argument injection via leading dashes** — pass option-style payloads to CLIs that treat filenames as flags.
0182. **Command injection in DNS-tool wrappers** — probe dig and nslookup web tools for subshell syntax in hostname fields.
0183. **Command injection via ping and traceroute utilities** — test network-diagnostic pages for shell metacharacters.
0184. **Command injection in backup filenames** — inject into backup job names passed to tar and dump commands.
0185. **Command injection via printer names** — test printer management for shell evaluation in device URIs.
0186. **Command injection in git-webhook handlers** — fuzz repo URLs and branch names executed by deployment scripts.
0187. **Command injection via cron-expression fields** — inject into scheduler UIs that write raw crontabs.
0188. **Command injection in log-rotation configs** — test logrotate UIs for shell evaluation in paths.
0189. **Command injection via email addresses in sendmail** — inject sendmail parameters through contact forms.
0190. **Command injection in PDF metadata tools** — fuzz exiftool and qpdf wrapper arguments.
0191. **Command injection via username in provisioning scripts** — test signup flows that shell out to provision accounts.
0192. **Command injection in image-resize dimensions** — inject into width and height params passed to ImageMagick CLI.
0193. **Command injection via locale and timezone settings** — test timezone wrappers with metacharacters in timezone fields.
0194. **Command injection in database-restore uploads** — fuzz SQL dump filenames executed by restore scripts.
0195. **Command injection via webhook secrets** — inject into HMAC secret fields used in shell-evaluated comparisons.
0196. **Node child_process exec injection** — find exec() calls with template-string commands built from user input.
0197. **Python os.system and subprocess shell audit** — trace shell=True sinks to request parameters.
0198. **PHP passthru and shell_exec probing** — test passthru-adjacent endpoints with backtick payloads.
0199. **Ruby backtick and system injection** — probe system() calls in web-reachable endpoints.
0200. **Java Runtime.exec argument splitting** — test ProcessBuilder commands built by string concatenation.
0201. **Go exec.Command shell wrapping** — find sh -c wrappers with interpolated arguments.
0202. **Perl open-pipe injection** — probe open() with pipe-mode filenames from uploads.
0203. **Environment-variable injection via env params** — test features that set env vars from user input before shelling out.
0204. **Command injection via template-delimiter confusion** — exploit template engines that shell out during rendering.
0205. **Blind command injection via timing** — use sleep and ping delays to confirm execution without output.
0206. **LDAP injection in login filters** — inject filter-closing sequences to bypass authentication filters.
0207. **LDAP wildcard enumeration** — use wildcards in search fields to enumerate directory entries.
0208. **LDAP attribute-injection for privilege data** — craft filters extracting mail and phone attributes blind.
0209. **LDAP blind boolean via filter errors** — detect true/false through LDAP error-code differentials.
0210. **LDAP injection in password-reset lookups** — target reset flows building filters from email input.
0211. **LDAP DN injection in bind operations** — inject into distinguished names during bind for auth bypass.
0212. **LDAP injection via group-membership checks** — fuzz memberOf filters in authorization logic.
0213. **XPath injection in XML search** — close predicates with tautologies in XML-backed search fields.
0214. **XPath blind exfiltration via substring** — extract node values character by character with substring() conditions.
0215. **XPath error-based via malformed axes** — trigger parser errors that echo node content.
0216. **XQuery FLWOR injection** — inject into XQuery flows built from user filters.
0217. **XPath injection in SOAP backends** — target SOAP services with XPath-backed lookups.
0218. **LDAP and XPath polyglot probes** — use payloads valid in both grammars to fingerprint the backend type.
0219. **XPath injection via namespace confusion** — abuse namespace prefixes to bypass filter validation.
0220. **LDAP injection in SSO attribute mapping** — test SAML and OIDC attribute-to-LDAP mappings for filter injection.
0221. **Host-header injection to password-reset poisoning** — poison reset links via the Host header for token theft.
0222. **Host-header cache poisoning** — inject a malicious Host to poison CDN caches with attacker content.
0223. **X-Forwarded-Host reset poisoning** — test X-Forwarded-Host handling in reset-email link generation.
0224. **X-Forwarded-For SQLi via logging** — inject SQL through X-Forwarded-For when IPs are logged unsanitized.
0225. **X-Forwarded-For XSS in admin panels** — reflect spoofed IPs into admin dashboards for stored XSS.
0226. **Header injection CRLF smuggling** — test carriage-return sequences in header values for response splitting where frameworks allow.
0227. **X-Original-URL and X-Rewrite-URL bypass** — smuggle internal paths via rewrite headers for auth bypass plus injection.
0228. **Forwarded-header cache-key poisoning** — poison cache keys via Forwarded headers on misconfigured caches.
0229. **Host-header injection in webhook signatures** — test signature validation that trusts Host for callback URLs.
0230. **X-Forwarded-Proto downgrade injection** — force http:// link generation for SSL-stripping chains.
0231. **Header-based SSTI via User-Agent templates** — test User-Agent reflection through server-side templates.
0232. **Referer-header stored XSS** — inject via Referer into analytics dashboards.
0233. **X-Requested-With injection in AJAX routers** — probe header-driven routing for logic injection.
0234. **Accept-Language header SQLi** — test locale lookups building SQL from Accept-Language.
0235. **Via-header log injection** — inject control characters via Via into log-viewed dashboards.
0236. **Log-injection XSS in admin log viewers** — inject scripts via usernames rendered in log tails.
0237. **ANSI-escape log-viewer attacks** — use terminal escape sequences in logs viewed via web terminals.
0238. **Log-injection via 404 paths** — request malicious paths that get logged and rendered raw.
0239. **Newline log forging** — inject newlines to forge fake log lines in audit trails.
0240. **Log-injection via email subjects** — poison logged subjects rendered in support dashboards.
0241. **JSON-log breakout injection** — break JSON log structure to inject fields rendered by log UIs.
0242. **Log-viewer XSS via stack traces** — trigger errors with payloads echoed into trace viewers.
0243. **Syslog priority spoofing** — inject priority prefixes to forge severity in SIEM views.
0244. **Log injection in download filenames** — poison Content-Disposition logs rendered in admin panels.
0245. **Audit-trail tampering via encoding** — use double-encoding so logs look benign but viewers execute.
0246. **CSV formula injection in exports** — prefix cells with DDE formulas to trigger execution on open.
0247. **CSV injection via leading plus, minus and at** — test all formula-trigger characters in export fields.
0248. **CSV injection in admin exports** — target user-list exports opened in Excel by staff.
0249. **TSV and pipe-delimited formula injection** — test non-comma delimiters that spreadsheets still evaluate.
0250. **CSV injection via second-order import** — upload malicious CSV that gets re-exported to admins.
0251. **Spreadsheet IMPORTXML exfiltration** — use IMPORTXML with attacker URLs for out-of-band data theft.
0252. **CSV formula via phone-number fields** — target numeric-looking fields that bypass naive sanitization.
0253. **CSV injection in report filenames** — poison exported filenames evaluated as formulas.
0254. **SYLK file formula injection** — test .slk exports for formula-execution variants.
0255. **CSV injection sanitization-bypass mapping** — catalog which quote and space prefixes defeat per-app sanitizers.
0256. **AngularJS expression injection** — probe double-curly expressions in legacy Angular apps for eval sinks.
0257. **Angular CSP-mode bypass vectors** — test ng-csp bypasses via event handlers in injected templates.
0258. **Vue.js delimiter injection** — exploit double-curly delimiters in Vue templates bound to user data.
0259. **Vue v-pre bypass probing** — test v-pre regions that skip compilation then re-render.
0260. **Svelte template injection** — probe {@html} blocks fed by user content.
0261. **Marko template injection** — test unescaped outputs in Marko apps.
0262. **Ember Handlebars injection** — probe triple-stash outputs in Ember templates.
0263. **Backbone and Underscore template injection** — test ERB-style tags in legacy Underscore templates.
0264. **Knockout data-bind injection** — fuzz data-bind attributes with binding syntax.
0265. **Aurelia interpolation injection** — test ${} interpolation in Aurelia-bound views.
0266. **Alpine.js x-data injection** — probe x-data attributes evaluated as JS expressions.
0267. **Petite-Vue directive injection** — test v-scope expressions with user input.
0268. **HTMX attribute injection** — inject hx-get and hx-trigger attributes for client-side request hijacking.
0269. **Stimulus controller injection** — probe data-controller values resolved to JS classes.
0270. **Client-side template sandbox escapes** — map per-framework filter bypasses for client-side template injection.
0271. **HTTP parameter pollution to SQLi** — duplicate params where backends concatenate values into queries.
0272. **HPP to XSS via array joining** — exploit frameworks joining duplicate params with commas into HTML.
0273. **HPP auth-bypass via first-wins versus last-wins** — test which occurrence wins in auth checks versus business logic.
0274. **HPP in array-style params** — abuse bracket-suffixed param parsing differentials.
0275. **HPP via query-plus-body duplication** — send the same param in query and body to trigger precedence bugs.
0276. **HPP in sort and filter to SQLi** — duplicate sort params to break allowlists then inject.
0277. **HPP cache-busting to poisoning** — use polluted params to poison cache keys.
0278. **HPP in redirect targets** — duplicate next-params for open-redirect plus script contexts.
0279. **HPP in email fields to header injection** — duplicate email params to smuggle header breaks.
0280. **HPP differential mapping per framework** — catalog first, last, and concat behavior across stacks.
0281. **Unicode normalization XSS bypass** — use NFC and NFKC variants of brackets and quotes that normalize post-filter.
0282. **Homoglyph keyword bypass** — substitute SQL and JS keywords with lookalike Unicode characters.
0283. **Fullwidth character filter bypass** — use fullwidth brackets against naive filters.
0284. **Overlong UTF-8 encoding bypass** — test overlong encodings where decoders are lenient.
0285. **Null-byte truncation bypass** — use encoded nulls to truncate denylist checks in legacy stacks.
0286. **Unicode case-mapping bypass** — exploit locale-specific case folding in keyword filters.
0287. **Combining-character filter evasion** — insert combining marks inside keywords to break signatures.
0288. **Right-to-left override in filenames** — use U+202E to disguise executable extensions.
0289. **Homoglyph domain in URL-parsing injection** — test IDN lookalikes in URL-parsing injection contexts.
0290. **Zero-width space injection** — hide payloads with zero-width spaces that survive filters but execute.
0291. **Unicode slash variants in path injection** — use fullwidth and division slashes to bypass path filters.
0292. **NFKC-normalized SQL keyword smuggling** — normalize exotic keyword spellings at the database layer.
0293. **Emoji-based JS identifier bypass** — use Unicode identifiers to dodge keyword denylists in JS contexts.
0294. **Mixed-script confusable probing** — automate confusable mapping per filter rule.
0295. **UTF-7 XSS in legacy contexts** — test UTF-7 decoding where charset is attacker-influenced.
0296. **WebSocket message SQLi** — fuzz JSON socket messages for SQL metacharacters in handlers.
0297. **WebSocket message XSS** — test broadcast messages rendered without escaping.
0298. **WebSocket STOMP destination injection** — inject into STOMP destinations and topics.
0299. **GraphQL directive injection** — abuse include/skip directives with injected variables.
0300. **GraphQL fragment injection** — smuggle fields via named fragments past validation.
0301. **Server-sent events injection** — test EventSource message rendering for XSS.
0302. **WebTransport datagram injection** — probe emerging WebTransport handlers.
0303. **gRPC-web field injection** — fuzz protobuf-derived JSON fields for SQLi and XSS.
0304. **JSON-RPC method injection** — test method names dispatched via string concatenation.
0305. **XML-RPC parameter injection** — probe XML-RPC struct members for XPath and SQLi.
0306. **OG meta-tag generator injection** — inject into Open Graph scrapers' titles and descriptions.
0307. **Sitemap-generator injection** — poison auto-generated sitemaps with script contexts.
0308. **Robots.txt reflection injection** — test reflected paths in generated robots files.
0309. **Markdown-to-PDF pipeline XSS** — chain markdown XSS into PDF renderer script contexts.
0310. **Email display-name XSS** — inject into quoted display-name formats rendered in inboxes.
0311. **vCard import XSS** — poison vCard fields rendered in contact managers.
0312. **ICS calendar injection** — inject into calendar invites rendered in webmail.
0313. **RSS feed item injection** — poison feed titles rendered in readers.
0314. **OPML import injection** — test feed-import lists for stored XSS.
0315. **Webhook event-type injection** — inject into event names rendered in dashboards.
0316. **Second-order command injection via scheduled reports** — store payloads in report names executed by cron workers.
0317. **Cron-field injection in scheduler UIs** — inject shell syntax into cron expressions saved by apps.
0318. **Second-order via hostname fields** — poison hostnames later used in SSH and monitoring scripts.
0319. **Second-order via API keys in scripts** — inject into keys interpolated into deployment scripts.
0320. **Delayed-execution command injection** — use queue-style schedulers where payloads run asynchronously.
0321. **Second-order via filename in transcoding queues** — poison media filenames processed by worker CLIs.
0322. **Second-order via username in logrotate** — inject into usernames used by maintenance scripts.
0323. **IoT device-name command injection** — test device names passed to shell in smart-home hubs.
0324. **Second-order via webhook payload keys** — store keys later used in shell-evaluated routing.
0325. **Build-pipeline variable injection** — test CI variables interpolated into shell steps.
0326. **SMTP header injection via contact forms** — inject Cc and Bcc through name and email fields.
0327. **Email subject CRLF injection** — smuggle headers via subject lines in feedback forms.
0328. **Envelope-from injection** — test MAIL FROM derived from user input.
0329. **Email template variable SSTI** — probe template vars in transactional mail for evaluation.
0330. **Bounce-address injection** — poison Return-Path for backscatter chains.
0331. **Email attachment filename injection** — inject filenames into MIME parts for client-side XSS.
0332. **Reply-To header injection** — hijack replies via injected Reply-To.
0333. **Email body HTML injection** — test HTML email composers for stored XSS.
0334. **Unsubscribe-token header injection** — poison List-Unsubscribe headers rendered in clients.
## H. SSRF / XXE / Request Smuggling — Novel Techniques
0335. **IMDSv1 metadata SSRF via avatar fetcher** — point profile-picture URL inputs at cloud metadata IPs to steal instance credentials.
0336. **IMDSv2 token-fetch SSRF chains** — test whether fetchers can first PUT for a token then GET metadata in two-step SSRF.
0337. **Azure metadata SSRF via webhook tester** — target Azure metadata endpoints with the required Metadata header injected.
0338. **GCP metadata SSRF via import-from-URL** — hit GCP metadata hosts with the Metadata-Flavor header.
0339. **AWS credential exfiltration via PDF generator** — route HTML-to-PDF fetchers at IAM credential endpoints.
0340. **DigitalOcean metadata SSRF** — probe DO metadata paths via link-preview features.
0341. **Oracle Cloud metadata SSRF** — test Oracle metadata endpoints through URL importers.
0342. **Alibaba Cloud metadata SSRF** — probe Alibaba metadata IPs via server-side fetch features.
0343. **Kubernetes service-account token theft** — SSRF to mounted secret paths via file scheme where fetchers allow it.
0344. **Cloud SQL proxy metadata abuse** — target cloud SQL admin endpoints via SSRF.
0345. **SSRF via URL-preview in chat** — test chat link-unfurlers against metadata endpoints.
0346. **SSRF via RSS importer** — point feed importers at internal metadata.
0347. **SSRF via translation proxy** — abuse translate-URL features to fetch metadata.
0348. **SSRF via screenshot service** — point URL-to-screenshot at internal endpoints and read rendered secrets.
0349. **SSRF via favicon fetcher** — use favicon grabbers to hit metadata since they are often less filtered.
0350. **SSRF via OG-tag scraper** — exploit Open Graph scrapers for internal requests.
0351. **SSRF via email-tracking pixel fetcher** — test email builders that fetch remote images server-side.
0352. **SSRF via document converter** — point doc-to-PDF converters at metadata URLs.
0353. **SSRF via QR-code generator** — test QR APIs that fetch logo URLs server-side.
0354. **SSRF via URL shortener preview** — abuse shortener preview fetches.
0355. **SSRF via ping and website monitor** — use uptime monitors to request internal URLs.
0356. **SSRF via search-engine ping** — test submit-URL features for internal fetches.
0357. **SSRF via social-share counters** — exploit share-count APIs fetching target URLs.
0358. **SSRF via accessibility checker** — point a11y checkers at internal hosts.
0359. **SSRF via SEO analyzer** — abuse SEO audit tools' URL fetching.
0360. **SSRF via malware-scan URL submission** — test scan-this-URL features.
0361. **SSRF via certificate-transparency monitor** — probe check-domain fetchers.
0362. **SSRF via DNS-lookup tool** — test dig-web tools that also HTTP-fetch.
0363. **SSRF via page-speed tester** — abuse speed-test URL inputs.
0364. **SSRF via redirect-checker tool** — use redirect tracers to follow into internal networks.
0365. **DNS-rebinding SSRF chains** — use short-TTL DNS to pivot from a public IP to localhost after validation.
0366. **Rebinding via wildcard DNS services** — automate rebinding with controllable DNS records.
0367. **Time-of-check-time-of-use SSRF** — exploit validation-then-fetch gaps with rebinding.
0368. **Rebinding against IMDSv2** — chain rebinding with token PUT for full metadata theft.
0369. **Rebinding via IPv6 and IPv4 alternation** — alternate A and AAAA records to bypass IP-allowlist checks.
0370. **DNS-rebinding firewall bypass mapping** — catalog which internal hosts respond post-rebind.
0371. **Rebinding in webhook signature flows** — rebind after HMAC validation of the initial URL.
0372. **Rebinding via CNAME chains** — use CNAMEs to internal names that resolve post-validation.
0373. **Multi-stage rebinding for blind SSRF** — confirm blind hits via collaborator timing.
0374. **Rebinding-resistant validation testing** — verify apps re-resolve DNS at fetch time as a defensive check.
0375. **SSRF via PDF generator HTML fetch** — inject internal image sources into HTML-to-PDF inputs.
0376. **SSRF via invoice PDF renderer** — target invoice template image URLs.
0377. **SSRF via webhook URL tester** — abuse test-webhook buttons to hit internal endpoints.
0378. **SSRF via avatar URL import** — point avatar importers at internal services.
0379. **SSRF via import-from-URL for datasets** — test CSV and JSON import URLs.
0380. **SSRF via theme import URLs** — abuse theme and plugin install-from-URL features.
0381. **SSRF via media-library URL upload** — test upload-from-URL media features.
0382. **SSRF via podcast-feed import** — point podcast importers internally.
0383. **SSRF via calendar subscription URLs** — abuse webcal subscription fetches.
0384. **SSRF via Git import URLs** — test import-repo-from-URL features.
0385. **SSRF via container-image pull** — probe image URL fields in PaaS UIs.
0386. **SSRF via SAML metadata URL** — point SAML config at internal metadata endpoints.
0387. **SSRF via OIDC discovery URL** — abuse issuer discovery fetching.
0388. **SSRF via JWKS URL fetching** — target jwks_uri fields.
0389. **SSRF via SCIM provisioning URLs** — test SCIM endpoint configs.
0390. **SSRF via payment webhook configs** — abuse payment-gateway webhook URL fields.
0391. **SSRF via shipping-tracking webhooks** — test carrier webhook URLs.
0392. **SSRF via SMS-gateway callbacks** — probe telephony callback URLs.
0393. **SSRF via email-webhook URLs** — test mail-provider event URLs.
0394. **SSRF via CI webhook triggers** — abuse build-trigger URLs.
0395. **SSRF via IoT device callback URLs** — test device webhook configs.
0396. **SSRF via backup destination URLs** — probe backup-to-URL features.
0397. **SSRF via log-shipping URLs** — test syslog and HTTP log destinations.
0398. **SSRF via metrics-endpoint configs** — abuse monitoring-target URL fields.
0399. **SSRF via status-page monitors** — use status-page URL monitors for internal scans.
0400. **Redirect-chain SSRF allowlist bypass** — chain open redirects from allowed domains into internal IPs.
0401. **0.0.0.0 SSRF bypass** — test 0.0.0.0 where 127.0.0.1 is blocked since it often routes to localhost.
0402. **Decimal-IP SSRF bypass** — use decimal-encoded loopback against string denylists.
0403. **Octal-IP SSRF bypass** — use octal-encoded loopback forms.
0404. **Hex-IP SSRF bypass** — use hex-encoded loopback forms.
0405. **Mixed-radix IP bypass** — combine decimal, octal, and hex octets.
0406. **IPv6 localhost bypass** — use ::1 and mapped IPv4 forms.
0407. **IPv6 alternative localhost spellings** — test expanded and compressed IPv6 loopback variants.
0408. **DNS wildcard subdomain bypass** — exploit wildcard DNS tricks via attacker-controlled zones.
0409. **At-sign credential URL trick** — abuse userinfo parsing with allowed.com@internal hosts.
0410. **Fragment-abuse SSRF** — append fragments confusing parsers about the real host.
0411. **URL parser differential exploitation** — find discrepancies between validator and fetcher URL parsing.
0412. **Backslash-as-slash confusion** — use backslashes as path separators on Windows stacks.
0413. **URL-encoded dot bypass** — use encoded dots for traversal in fetchers.
0414. **Case-sensitivity bypass in allowlists** — test uppercase domains against case-sensitive matching.
0415. **Port-confusion bypass** — smuggle userinfo and ports past allowlists.
0416. **Subdomain-takeover allowlist bypass** — claim expired subdomains of allowlisted domains.
0417. **DNS CNAME to internal** — point allowed-looking domains via CNAME to localhost.
0418. **Unicode domain confusion** — use IDN homographs of allowlisted domains.
0419. **Hex-zero localhost variants** — test hex-encoded zero loopback forms.
0420. **127.1 shorthand bypass** — use abbreviated loopback spellings.
0421. **Enclosed-alphanumerics IP bypass** — use circled-digit IPs where parsers normalize.
0422. **CIDR-misconfig bypass** — test allowlists permitting overly broad CIDRs.
0423. **Scheme-relative URL bypass** — use protocol-relative paths where validation expects absolute URLs.
0424. **Protocol-relative redirect bypass** — chain protocol-relative URLs via redirects.
0425. **Trailing-dot FQDN bypass** — use trailing dots on loopback addresses.
0426. **URL username-password confusion** — exploit userinfo parsing gaps.
0427. **Double-at-sign trick** — abuse double-@ parsing differentials.
0428. **Semicolon path-parameter bypass** — smuggle paths past filters with matrix params.
0429. **Tab and newline in URL bypass** — inject whitespace to break naive validators.
0430. **Blind SSRF via collaborator callbacks** — use out-of-band domains to confirm server-side fetches.
0431. **Blind SSRF timing differential** — measure response-time differences for internal versus dead hosts.
0432. **Blind SSRF via DNS-logging** — confirm exfiltration through DNS query logs.
0433. **Blind SSRF port-scan via timing** — enumerate internal ports by response-time signatures.
0434. **Blind SSRF via error-message differential** — distinguish refused versus timeout versus DNS-fail states.
0435. **Blind SSRF via content-length inference** — infer internal content through length oracles.
0436. **Blind SSRF via redirect following** — detect internal redirects through final-URL leaks.
0437. **Blind SSRF via PDF content reflection** — read internal responses rendered into generated PDFs.
0438. **Blind SSRF via image-dimension oracle** — infer fetched content via image-size error messages.
0439. **Blind SSRF via webhook retry timing** — use retry backoff patterns as oracles.
0440. **Blind SSRF via email-bounce oracle** — trigger bounces from fetched URLs.
0441. **Blind SSRF via cache-poisoning confirmation** — poison caches with markers to confirm the fetch happened.
0442. **Blind SSRF via log-injection confirmation** — fetch URLs that log visible markers.
0443. **OOB exfiltration via DNS for SSRF** — encode internal responses into DNS labels.
0444. **Blind SSRF via internal echo services** — use internal echo endpoints as content oracles.
0445. **Gopher-protocol SSRF to Redis** — use gopher to speak the Redis protocol for command execution.
0446. **Gopher SSRF to SMTP** — send emails via gopher to internal mail servers.
0447. **Gopher SSRF to Memcached** — write cache keys via gopher for poisoning.
0448. **Dict-protocol SSRF probing** — use dict for internal service fingerprinting.
0449. **File-protocol SSRF for local reads** — use file scheme for local file reads where fetchers allow.
0450. **File-protocol Windows paths** — test file URIs with Windows drive paths on Windows stacks.
0451. **Jar-protocol SSRF in Java apps** — abuse jar URLs for archive-entry reads.
0452. **TFTP protocol SSRF** — probe tftp for config exfiltration.
0453. **LDAP-protocol SSRF** — use ldap scheme to query internal directories.
0454. **Gopher-to-FTP bounce** — abuse FTP bounce via gopher for port scans.
0455. **SSH protocol confusion** — test ssh scheme handlers in fetchers.
0456. **PHP-filter wrapper SSRF** — use php://filter for local file reads in PHP apps.
0457. **Expect-wrapper command execution** — test expect wrappers where PHP wrappers are enabled.
0458. **Data-URL SSRF in fetchers** — use data URLs to smuggle content past validators.
0459. **Blob-URL confusion in server fetchers** — test blob scheme handling gaps.
0460. **XXE in SVG file parsers** — submit SVG with DOCTYPE entities to image processors.
0461. **XXE in DOCX parsers** — inject entities into word/document.xml of uploaded docs.
0462. **XXE in XLSX parsers** — target shared-strings XML for entity expansion.
0463. **XXE in SOAP endpoints** — fuzz SOAP envelopes with external entities.
0464. **XXE in SAML assertions** — test SAMLResponse XML parsing for entity evaluation.
0465. **XXE in RSS and Atom importers** — inject entities into feed XML.
0466. **XXE in sitemap.xml parsers** — poison sitemap uploads with entities.
0467. **XXE in SVG avatar uploads** — combine SVG XXE with stored-XSS vectors.
0468. **XXE in Office template merges** — test mail-merge XML for entity evaluation.
0469. **XXE in XHTML importers** — probe CMS HTML imports.
0470. **XXE in WebDAV PROPFIND** — test XML request bodies.
0471. **XXE in XML messaging APIs** — probe XML messaging endpoints.
0472. **XXE in spreadsheet formula parsers** — combine XXE with formula injection.
0473. **XXE in config-file uploads** — test XML config imports.
0474. **XXE in SVG filter primitives** — hide entities in filter chains.
0475. **XXE via DTD in XSLT** — test stylesheet uploads with external DTDs.
0476. **XXE in WSDL parsers** — probe API-import WSDL handling.
0477. **XXE in BPMN workflow imports** — test workflow XML uploads.
0478. **XXE in SCORM package parsers** — probe e-learning package manifests.
0479. **XXE in GPX and KML uploads** — test geospatial XML for entity evaluation.
0480. **XXE in MusicXML parsers** — probe niche XML formats.
0481. **XXE in XLIFF translation uploads** — test localization file imports.
0482. **XXE in JUnit XML report uploads** — probe CI report parsers.
0483. **XXE in plist uploads** — test Apple plist XML parsing.
0484. **XXE in SVG sprite builders** — probe icon-sprite generators.
0485. **Blind XXE with OOB exfiltration** — use parameter entities to exfiltrate file contents via HTTP.
0486. **Blind XXE via DNS exfiltration** — encode file data into DNS queries.
0487. **Blind XXE via error messages** — trigger parser errors echoing file content.
0488. **XXE via XInclude** — use xi:include where DOCTYPEs are blocked.
0489. **XXE via parameter entities** — bypass inline-entity blocks with external parameter entities.
0490. **XXE via external DTD** — host a malicious DTD for full file exfiltration.
0491. **Billion-laughs guard testing (safe)** — verify entity-expansion limits with tiny payloads.
0492. **Quadratic-blowup guard testing (safe)** — confirm expansion guards without harm.
0493. **XXE in SVG via xlink:href** — combine XInclude with SVG includes.
0494. **XXE SSRF via entities** — use SYSTEM entities pointing at metadata endpoints.
0495. **XXE via DTD in SOAP attachments** — hide entities in multipart XML.
0496. **Local DTD file exploitation** — abuse local DTDs for error-based exfiltration.
0497. **XXE via encoding tricks** — bypass filters with UTF-7 and entity encoding.
0498. **XXE in namespaced XML** — exploit namespace-aware parser gaps.
0499. **XXE confirmation via timing** — use slow external entities as blind oracles.
0500. **CL.TE request smuggling** — send Content-Length plus Transfer-Encoding with a smuggled TE prefix.
0501. **TE.CL request smuggling** — use the reverse variant where Content-Length wins at the backend.
0502. **TE.TE obfuscation smuggling** — duplicate Transfer-Encoding headers with obfuscated values.
0503. **CL.CL differential smuggling** — duplicate Content-Length with front/back disagreement.
0504. **CL.0 smuggling** — use zero Content-Length to desync.
0505. **Chunked-extension smuggling** — abuse chunk extensions to hide smuggled bytes.
0506. **TE header case-obfuscation** — use mixed-case Transfer-Encoding variants.
0507. **TE header whitespace obfuscation** — inject spaces and tabs around TE values.
0508. **X-HTTP-Method-Override smuggling** — combine method override with desync.
0509. **Duplicate Host header smuggling** — desync via conflicting Host headers.
0510. **Absolute-URI versus origin-form smuggling** — exploit request-target parsing gaps.
0511. **Line-folding obs-fold smuggling** — use folded headers to desync.
0512. **Trailing-dot header smuggling** — abuse Transfer-Encoding with trailing dots.
0513. **Underscore header smuggling** — test underscore versus hyphen header normalization.
0514. **Content-Length with chunked body** — send both with conflicting semantics.
0515. **Zero-chunk smuggling** — manipulate the terminating zero chunk.
0516. **Chunk-size hex confusion** — use 0x-prefixed versus plain hex chunk sizes.
0517. **Premature chunk termination** — end chunks early to desync.
0518. **Smuggled-prefix cache poisoning** — poison front-end caches with a smuggled prefix.
0519. **Web-cache poisoning via smuggling** — combine desync with cache deception.
0520. **Smuggling to bypass front-end auth** — route smuggled requests past auth checks.
0521. **404-differential smuggling detection** — detect desync via 404 response anomalies.
0522. **Timing-based smuggling detection** — use delay oracles to confirm desync.
0523. **Smuggling via OPTIONS and TRACE** — test exotic methods for parser gaps.
0524. **HTTP/1.0 versus 1.1 smuggling** — exploit version-handling differences.
0525. **H2.CL request smuggling** — HTTP/2 front-end with HTTP/1 backend Content-Length desync.
0526. **H2.TE request smuggling** — HTTP/2 front-end with Transfer-Encoding confusion at the backend.
0527. **HTTP/2 downgrade smuggling** — exploit h2-to-http1 translation gaps.
0528. **H2 pseudo-header smuggling** — abuse :method and :path confusion.
0529. **H2 CONTINUATION flood desync** — test continuation-frame handling.
0530. **WebSocket upgrade smuggling** — smuggle requests in upgrade handshakes.
0531. **WebSocket extended-handshake smuggling** — abuse 101-switching parser gaps.
0532. **H2 rapid-reset desync** — combine stream resets with smuggling.
0533. **H2 request-target smuggling** — exploit :authority versus host gaps.
0534. **H2 header-compression smuggling** — abuse HPACK edge cases.
0535. **H2 trailer smuggling** — hide smuggled data in trailers.
0536. **H2 priority-frame smuggling** — test priority handling gaps.
0537. **WebSocket masking smuggling** — exploit mask-key parsing.
0538. **H2C cleartext-upgrade smuggling** — test h2c upgrade flows.
0539. **HTTP/3-to-2 translation smuggling** — probe QUIC translation gaps.
0540. **H2 connection-preface smuggling** — abuse preface handling.
0541. **H2 flow-control desync** — exploit window-update gaps.
0542. **WebSocket close-frame smuggling** — hide data in close frames.
0543. **H2 server-push smuggling** — abuse pushed responses.
0544. **Upgrade-header chaining smuggling** — chain multiple Upgrade headers.
0545. **Chunked-extension parameter abuse** — hide data in chunk extensions.
0546. **Chunked trailer injection** — inject headers via trailers.
0547. **LF-only line-ending smuggling** — use bare line-feeds to desync strict parsers.
0548. **CR-only line-ending smuggling** — test carriage-return-only handling.
0549. **NUL-byte in chunk size** — truncate chunk-size parsing.
0550. **Chunk-size leading-zero confusion** — exploit padded versus plain sizes.
0551. **Chunk-size case confusion** — test uppercase versus lowercase hex sizes.
0552. **Semicolon-in-chunk-size smuggling** — abuse semicolons within sizes.
0553. **Space-in-chunk-size smuggling** — test padded chunk sizes.
0554. **Chunked body with GET** — send bodies on GET for parser confusion.
0555. **HEAD with body smuggling** — exploit HEAD handling gaps.
0556. **204 and 304 body smuggling** — test no-body status handling.
0557. **101-upgrade body smuggling** — exploit switching-protocol gaps.
0558. **CONNECT-method smuggling** — test proxy CONNECT parsing.
0559. **Absolute-form CONNECT smuggling** — abuse CONNECT targets.
0560. **404-page differential detection** — automate 404 anomaly detection for desync.
0561. **Response-queue poisoning detection** — detect poisoned queue responses.
0562. **Timing-oracle smuggling confirmation** — use sleeps in smuggled prefixes.
0563. **Differential header-echo detection** — compare echoed headers for desync.
0564. **Cache-key desync detection** — detect cache poisoning from smuggling.
0565. **Connection-reuse smuggling scan** — test keep-alive connection poisoning.
0566. **Front-back normalization mapping** — catalog per-hop header handling.
0567. **Desync via hop-by-hop headers** — test Connection-header stripping gaps.
0568. **TRACE-method desync detection** — use TRACE echoes as oracles.
0569. **Non-destructive smuggling probes** — design safe detection payloads that never poison others.
0570. **SSRF metadata creds to cloud takeover** — chain instance credentials to console access.
0571. **SSRF to internal admin panels** — pivot to unauthenticated admin UIs.
0572. **SSRF to Redis RCE via gopher** — write scheduled payloads via Redis.
0573. **SSRF to Jenkins script console** — target internal Jenkins for code execution.
0574. **SSRF to Kubernetes API** — use service-account tokens via SSRF.
0575. **SSRF to Docker socket** — hit proxied Docker APIs.
0576. **SSRF to cloud-function metadata** — abuse function identity endpoints.
0577. **SSRF to internal Git servers** — pivot to internal Git for code execution.
0578. **SSRF to Spring Boot Actuator** — target actuator endpoints for env dumping.
0579. **SSRF to Tomcat manager** — probe internal manager UIs.
0580. **SSRF to WebLogic console** — target internal middleware.
0581. **SSRF to Elasticsearch script endpoints** — abuse scripting APIs.
0582. **SSRF to Solr config APIs** — target Solr cores.
0583. **SSRF to CouchDB admin** — exploit internal DB admins.
0584. **SSRF to internal MongoDB** — probe internal database ports.
0585. **SSRF to Postgres via gopher** — speak the Postgres protocol for query execution.
0586. **SSRF to SMTP for phishing** — relay internal mail.
0587. **SSRF to LDAP for enumeration** — query internal directories.
0588. **SSRF to NTLM relay** — capture NetNTLM hashes via SMB SSRF.
0589. **SSRF to internal package registries** — poison internal packages.
0590. **SSRF in server-side image proxying** — test image-proxy endpoints against metadata.
0591. **Image-proxy redirect chains** — chain redirects from allowed CDNs internally.
0592. **Image-proxy SVG SSRF** — combine proxy fetch with SVG XXE.
0593. **Image-proxy dimension oracle** — infer internal content via resize errors.
0594. **Image-proxy format-confusion** — abuse format params to read non-images.
0595. **Image-proxy cache poisoning** — poison proxy caches with internal content.
0596. **Image-proxy watermark SSRF** — target watermark URL params.
0597. **Image-proxy placeholder SSRF** — abuse fallback-image URLs.
0598. **Image-proxy EXIF SSRF** — chain proxy with EXIF-based callbacks.
0599. **Image-proxy allowlist bypass mapping** — catalog per-proxy filter gaps.
0600. **Webhook SSRF with signature bypass** — test HMAC validation gaps on callback URLs.
0601. **Webhook secret leakage via SSRF** — exfiltrate signing secrets through error messages.
0602. **Webhook replay to internal** — replay signed webhooks at internal endpoints.
0603. **Webhook URL validation TOCTOU** — exploit check-then-fetch races.
0604. **Webhook SSRF via DNS rebinding** — rebind after the signature check.
0605. **Webhook custom-header injection** — inject headers into outbound webhook requests.
0606. **Webhook SSRF to metadata** — point webhooks at metadata endpoints.
0607. **Webhook method-override SSRF** — abuse method params for internal writes.
0608. **Webhook retry-amplification (safe)** — test retry handling within safe limits.
0609. **Webhook payload SSRF** — inject URLs inside webhook JSON bodies.
0610. **SSRF via open-redirect chains in fetchers** — chain allowed-domain redirects internally.
0611. **Open-redirect to metadata** — use the app's own redirects to reach metadata.
0612. **Redirect-chain depth bypass** — exceed max-redirect assumptions.
0613. **Protocol-downgrade redirects** — chain https to http to gopher where supported.
0614. **Redirect with credentials** — smuggle userinfo through redirects.
0615. **Redirect fragment smuggling** — abuse fragments in redirect chains.
0616. **Meta-refresh redirect chains** — use HTML meta refresh as redirect hops.
0617. **JS-redirect chains in fetchers** — exploit fetchers executing JS redirects.
0618. **Redirect to file scheme** — chain to local file reads.
0619. **Open-redirect allowlist confusion** — exploit subdomain versus domain matching.
0620. **SSRF in link-preview unfurlers** — test chat and social previews against internal hosts.
0621. **Unfurl oEmbed SSRF** — abuse oEmbed discovery fetches.
0622. **Unfurl Twitter-card SSRF** — target card-image fetches.
0623. **Unfurl favicon SSRF** — exploit favicon fetchers.
0624. **Preview screenshot SSRF** — use preview renderers to read internal pages.
0625. **Unfurl video-embed SSRF** — abuse video metadata fetches.
0626. **SSRF via document text-extraction** — point text-extract APIs at internal URLs.
0627. **SSRF via OCR services** — abuse OCR URL inputs.
0628. **SSRF via translation APIs** — use translate-URL features.
0629. **SSRF via URL-expanders** — test expand-short-URL tools.
0630. **SSRF via archive-save features** — abuse save-page functionality.
0631. **SSRF via readability extractors** — test reader-mode fetchers.
0632. **SSRF via AMP converters** — abuse AMP-cache fetchers.
0633. **SSRF via print-to-PDF** — target print CSS fetchers.
0634. **SSRF via HTML validators** — abuse validate-URL tools.
0635. **SSRF via mixed-content checkers** — test security scanners' fetching.
0636. **SSRF via broken-link checkers** — abuse link-check crawlers.
0637. **SSRF via sitemap generators** — test generate-sitemap fetches.
0638. **SSRF via uptime monitors** — use monitoring URL fields.
0639. **SSRF via synthetic monitoring** — abuse scripted browser checks.
0640. **SSRF via email open-tracking** — test tracking-pixel URL configs.
0641. **SSRF via push-notification icons** — abuse icon URL fetches.
0642. **SSRF via PWA manifest icons** — test manifest icon fetching.
0643. **SSRF via favicon generators** — abuse favicon-builder URL inputs.
0644. **SSRF via social-image generators** — test OG-image APIs.
0645. **SSRF via placeholder-image APIs** — abuse placeholder services.
0646. **SSRF via chart-image APIs** — test chart-render URL inputs.
0647. **SSRF via badge generators** — abuse badge APIs.
0648. **SSRF via avatar generators** — test generated-avatar fetchers.
0649. **SSRF via identicon services** — abuse hash-to-image URL fields.
0650. **SSRF via CAPTCHA image proxies** — test captcha relay fetching.
0651. **SSRF via ad-tag validators** — abuse ad-tech URL checks.
0652. **SSRF via feed validators** — test feed-validation fetching.
0653. **SSRF via JSON-LD validators** — abuse structured-data tools.
0654. **SSRF via CSP report collectors** — test report-uri fetching.
0655. **SSRF via certificate checkers** — abuse TLS-check URL inputs.
0656. **SSRF via WHOIS web tools** — test RDAP and WHOIS HTTP fallbacks.
0657. **SSRF via port-scanner web UIs** — abuse scan-my-site features.
0658. **SSRF via subdomain-enum tools** — test recon-tool URL inputs.
0659. **SSRF via tech-lookup tools** — abuse fingerprinting-style URL fetching.
0660. **SSRF via header-checker tools** — test check-headers features.
0661. **SSRF via mobile-friendly testers** — abuse rendering-service URLs.
0662. **SSRF via rich-results testers** — test validator-style tools.
0663. **SSRF via schema validators** — abuse schema fetchers.
0664. **SSRF via accessibility overlays** — test overlay service fetching.
0665. **SSRF via cookie-banner scanners** — abuse consent-check fetching.
0666. **SSRF via compliance scanners** — test compliance-tool URL inputs.
0667. **SSRF defense-in-depth validation audit** — verify allowlist, DNS-pinning, and no-redirects together as a defensive check.
## I. File Upload & Parsing Vulnerabilities
0668. **Double-extension bypass (.php.jpg)** — test servers that execute by the first extension.
0669. **Case-variation bypass (.pHp)** — exploit case-sensitive denylists on Windows.
0670. **Null-byte extension truncation** — use encoded nulls in filenames on legacy stacks.
0671. **Unicode extension confusion** — use fullwidth dots in filenames.
0672. **Trailing-dot bypass (file.php.)** — exploit Windows trailing-dot stripping.
0673. **Trailing-space bypass (file.php )** — test space-trimming execution.
0674. **Semicolon extension trick (file.php;.jpg)** — abuse IIS semicolon handling.
0675. **.htaccess upload for handler mapping** — upload .htaccess to map image extensions to script handlers.
0676. **web.config upload on IIS** — abuse config uploads for handler mapping.
0677. **.user.ini upload on PHP** — set auto_prepend_file via .user.ini.
0678. **Double-dot bypass (file.ph..p)** — test naive strip-once filters.
0679. **Extensionless CGI execution** — test cgi-bin uploads without extensions.
0680. **.phtml and .phar execution** — probe alternative PHP extensions.
0681. **.shtml SSI execution** — test server-side includes via .shtml.
0682. **.svg served as executable** — upload SVG served with script-capable content types.
0683. **.html upload for stored XSS** — test HTML uploads served inline.
0684. **MIME-plus-extension mismatch ladder** — systematically vary both for parser gaps.
0685. **Alternate data streams (file.jpg:evil)** — test NTFS ADS on Windows.
0686. **Short-name (8.3) bypass** — use 8.3 short names on Windows.
0687. **Right-to-left override filenames** — disguise executables as images via U+202E.
0688. **Homoglyph extension bypass** — use lookalike characters in extensions.
0689. **Percent-encoded extension** — test encoded-dot decoding gaps.
0690. **Double-URL-encoded extension** — test double-decoding gaps.
0691. **Overlong UTF-8 extension** — test legacy decoder leniency.
0692. **.jsp and .jspx on Java stacks** — probe Java extension execution.
0693. **.asp and .aspx on .NET** — test ASP extensions.
0694. **.cfm on ColdFusion** — probe CFM execution.
0695. **.pl and .cgi on Perl** — test CGI extensions.
0696. **.rb on Ruby stacks** — probe Ruby execution.
0697. **Extension allowlist inversion mapping** — catalog allowed versus executed extensions per stack.
0698. **Magic-byte spoofing (GIF89a plus script)** — prepend image headers to scripts.
0699. **Content-sniffing bypass** — exploit browsers sniffing HTML inside images.
0700. **MIME-type confusion client versus server** — send image MIME but store as HTML.
0701. **X-Content-Type-Options gap exploitation** — find uploads served without nosniff.
0702. **Polyglot magic-byte crafting** — build files valid as two types.
0703. **EXIF-header script injection** — hide scripts in JPEG headers passing magic checks.
0704. **ID3-tag script hiding** — embed payloads in MP3 metadata.
0705. **PNG chunk injection** — hide scripts in tEXt and iTXt chunks.
0706. **JPEG COM segment injection** — embed HTML in comment segments.
0707. **BMP header confusion** — exploit BMP parser leniency.
0708. **TIFF tag injection** — hide payloads in TIFF tags.
0709. **WEBP container injection** — exploit VP8X chunks.
0710. **ICO file script hiding** — test icon parsers.
0711. **WAV metadata injection** — hide payloads in RIFF INFO chunks.
0712. **MP4 box injection** — exploit metadata boxes.
0713. **Magic-byte allowlist mapping** — catalog accepted signatures per endpoint.
0714. **Server-side MIME re-detection gaps** — test where the server trusts client MIME.
0715. **Storage MIME versus serve MIME** — exploit CDNs serving with different types.
0716. **SVG MIME sniffing** — upload SVG labeled as PNG but served sniffable.
0717. **Charset-sniffing XSS** — exploit charset detection in text uploads.
0718. **SVG event-handler XSS** — use onload and onerror in SVG uploads.
0719. **SVG foreignObject HTML injection** — embed HTML inside foreignObject.
0720. **SVG script-tag XSS** — use script tags in SVG served inline.
0721. **SVG animate onbegin XSS** — scriptless vectors via animate.
0722. **SVG set onbegin XSS** — use set elements for event-driven JS.
0723. **SVG image xlink:href JS** — test javascript: in xlink:href.
0724. **SVG use-element XSS** — abuse use with external refs.
0725. **SVG filter feImage XSS** — exploit filter primitives.
0726. **SVG font-face XSS** — test font-face with JS URLs.
0727. **SVG style-tag XSS** — inject CSS with javascript: URLs.
0728. **SVG handler via XML entities** — hide handlers in entity expansions.
0729. **SVG in img-tag versus inline** — map contexts where SVG executes.
0730. **SVG favicon XSS** — test SVG favicons executing.
0731. **SVG CSS import XSS** — use @import in SVG styles.
0732. **SVG declarative-animation XSS** — SMIL-based vectors.
0733. **SVG foreignObject form phishing** — embed login forms in SVG.
0734. **SVG textPath XSS** — abuse textPath href.
0735. **SVG pattern XSS** — exploit pattern fills.
0736. **SVG mask XSS** — abuse mask content.
0737. **SVG clipPath XSS** — test clipPath refs.
0738. **SVG view XSS** — exploit view specs.
0739. **SVG metadata XSS** — hide scripts in metadata blocks.
0740. **SVG title and desc XSS** — test title tooltips rendering HTML.
0741. **SVG anchor javascript:** — test anchor xlink:href with javascript:.
0742. **SVG sanitization bypass mapping** — catalog per-sanitizer gaps.
0743. **GIF-plus-JS polyglot** — craft GIFAR-style files executing as JS.
0744. **PDF-plus-ZIP polyglot** — dual-format archives.
0745. **PNG-plus-PHP polyglot** — valid PNG executing as PHP.
0746. **JPEG-plus-HTML polyglot** — images rendering as HTML.
0747. **GIF-plus-HTML polyglot** — GIFs sniffed as HTML.
0748. **PDF-plus-HTML polyglot** — PDFs rendering scripts.
0749. **ZIP-plus-HTML polyglot** — archives as HTML.
0750. **MP4-plus-JS polyglot** — video boxes hiding JS.
0751. **BMP-plus-PHP polyglot** — BMP headers with PHP.
0752. **ICO-plus-HTML polyglot** — icons as HTML.
0753. **WAV-plus-HTML polyglot** — audio sniffed as HTML.
0754. **TIFF-plus-PHP polyglot** — TIFF with PHP payloads.
0755. **WEBP-plus-JS polyglot** — webp containers hiding JS.
0756. **OGG-plus-HTML polyglot** — audio as HTML.
0757. **7Z-plus-HTML polyglot** — archives sniffed as HTML.
0758. **RAR-plus-JS polyglot** — rar headers with JS.
0759. **DOCX-plus-HTML polyglot** — office XML as HTML.
0760. **XLSX-plus-JS polyglot** — spreadsheets hiding JS.
0761. **Polyglot detection fuzzing** — automate dual-parse validation.
0762. **Polyglot served-type oracle** — detect which type wins per content-type.
0763. **EXIF comment stored XSS** — inject scripts into EXIF comments rendered in galleries.
0764. **XMP title XSS** — poison XMP titles shown in media libraries.
0765. **EXIF GPS field injection** — inject into GPS tags rendered on maps.
0766. **EXIF artist and copyright XSS** — target attribution fields.
0767. **XMP description HTML injection** — exploit rich descriptions.
0768. **EXIF thumbnail XSS** — poison embedded thumbnails.
0769. **IPTC headline injection** — test newsroom metadata fields.
0770. **EXIF orientation logic abuse** — exploit orientation handling for parser bugs as a technique.
0771. **XMP namespace confusion** — bypass filters with namespace tricks.
0772. **EXIF field-length overflow (safe)** — test truncation bugs safely.
0773. **Multi-APP segment injection** — hide payloads across JPEG segments.
0774. **PNG tEXt XSS** — inject into PNG text chunks rendered in galleries.
0775. **PNG iTXt international XSS** — exploit compressed text chunks.
0776. **GIF comment extension XSS** — poison GIF comments.
0777. **Metadata-driven SSRF** — exploit thumbnailers fetching URLs from metadata.
0778. **ImageMagick delegate abuse (technique)** — test MVG and MSL delegate handling safely.
0779. **ImageMagick label: injection** — probe label pseudo-formats.
0780. **ImageMagick caption: injection** — test caption handling.
0781. **ImageMagick text: filename injection** — exploit text pseudo-images.
0782. **ImageMagick MSL file inclusion** — test MSL uploads as a technique safely.
0783. **ImageMagick SVG delegate SSRF** — chain SVG processing with SSRF.
0784. **ImageMagick PDF delegate command** — test PDF handling as a technique.
0785. **ImageMagick video delegate** — probe video thumbnails.
0786. **ImageMagick ephemeral: abuse** — test ephemeral pseudo-format.
0787. **ImageMagick null: handling** — probe null device writes.
0788. **ImageMagick histogram: exfil** — test histogram info leaks.
0789. **ImageMagick identify verbose leaks** — exploit verbose output revealing paths.
0790. **GraphicsMagick differential testing** — compare GM versus IM handling.
0791. **libvips differential testing** — test vips pipeline gaps.
0792. **Pillow differential testing** — compare Python Pillow behaviors.
0793. **DDE formula injection in XLSX** — test DDEAUTO payloads as a technique safely.
0794. **OLE object embedding** — probe embedded objects in DOCX.
0795. **Macro-enabled extension confusion** — upload .docm disguised as .docx.
0796. **Excel 4.0 macro sheets** — test XLM macros in uploaded sheets.
0797. **PowerPoint action XSS** — test hyperlink actions.
0798. **Word field-code injection** — exploit FIELD codes.
0799. **Excel external-link exfiltration** — use external refs to collaborator domains.
0800. **Office template injection** — probe .dotm templates.
0801. **RTF control-word injection** — test RTF parsers.
0802. **ODF macro embedding** — test LibreOffice formats.
0803. **Office metadata trust hints** — probe metadata influencing trust decisions.
0804. **Spreadsheet HYPERLINK XSS** — test HYPERLINK rendering.
0805. **CSV-to-XLSX conversion gaps** — test import converters.
0806. **Office clipboard HTML injection** — test paste-handling.
0807. **Macro-signature trust abuse** — test signature validation gaps.
0808. **Zip-slip path traversal** — upload zips with parent-directory entries.
0809. **Zip-slip absolute paths** — test absolute-path entries.
0810. **Zip-slip symlink entries** — exploit symlink extraction.
0811. **Zip-slip Windows paths** — test drive-letter entries.
0812. **Zip-slip Unicode traversal** — use Unicode dots.
0813. **Tar-slip variants** — test tar extraction.
0814. **7z-slip testing** — probe 7z handlers.
0815. **RAR-slip testing** — test RAR extraction.
0816. **Gzip filename traversal** — test gzip filename handling.
0817. **Zip bomb detection (safe)** — verify ratio limits with tiny bombs.
0818. **Decompression-bomb via nested zips** — test recursion limits.
0819. **XML bomb in DOCX (safe)** — test entity-expansion guards in office XML.
0820. **PNG decompression bomb** — test IDAT bomb handling.
0821. **JPEG progressive bomb** — test scan limits.
0822. **Gzip ratio-limit testing** — verify guards.
0823. **Zip entry-count limits** — test many-entry archives.
0824. **Zip filename-length limits** — test long-name handling.
0825. **Zip comment injection** — poison archive comments rendered in UIs.
0826. **Zip central-directory confusion** — exploit header mismatches.
0827. **Encrypted-zip handling (safe)** — test password-archive behavior safely.
0828. **Filename path traversal** — use parent-directory sequences in upload names.
0829. **Filename XSS in listings** — inject scripts into names rendered in file managers.
0830. **Content-Disposition header injection** — inject quotes and breaks into download filenames.
0831. **Filename SQLi** — test names inserted into databases.
0832. **Filename command injection** — test names passed to shells.
0833. **Filename null-byte truncation** — legacy truncation tests.
0834. **Filename Unicode normalization** — test NFC collisions overwriting files.
0835. **Filename case-collision overwrite** — exploit case-insensitive filesystems.
0836. **Filename length DoS (safe)** — test extreme lengths safely.
0837. **Filename control-character injection** — test newlines and returns in names.
0838. **Filename format-string probing** — test percent-sequences in names reaching printf.
0839. **Filename LDAP injection** — test names in directory queries.
0840. **Filename XXE via XML manifests** — test names in generated XML.
0841. **Filename SSTI** — test names rendered through templates.
0842. **Filename log injection** — test names in audit logs.
0843. **Filename email-header injection** — test names in MIME parts.
0844. **Filename JSON breakout** — test names in JSON APIs.
0845. **Filename open-redirect** — test names used in redirect URLs.
0846. **Filename SSRF via name-URLs** — test names treated as URLs.
0847. **Filename differential mapping** — catalog per-stack filename handling.
0848. **Chunked-upload session fixation** — hijack upload sessions via predictable IDs.
0849. **Resumable-upload offset confusion** — manipulate offsets to corrupt files.
0850. **Chunk-reorder attacks** — reorder chunks to bypass per-chunk validation.
0851. **Chunk-size mismatch abuse** — send declared versus actual size gaps.
0852. **Final-chunk validation bypass** — skip validation on the last chunk.
0853. **tus-protocol abuse** — exploit tus creation extensions.
0854. **Chunked-upload race** — win races between chunks and assembly.
0855. **Upload-session timeout abuse** — exploit stale sessions.
0856. **Concurrent-chunk overwrite** — overwrite chunks mid-upload.
0857. **Chunk-checksum bypass** — tamper with checksums.
0858. **Resumable-upload auth gaps** — test auth on PATCH versus POST.
0859. **Chunked metadata injection** — poison per-chunk metadata.
0860. **Assembly-order manipulation** — control final file assembly.
0861. **Partial-upload processing** — trigger processing of incomplete files.
0862. **Upload-ID enumeration** — enumerate others' upload sessions.
0863. **AV-scan race window** — access files before the scanner verdict.
0864. **Upload-then-execute race** — request files before validation moves them.
0865. **Thumbnail-race exploitation** — trigger thumbnailers on unvalidated files.
0866. **Transcode-race abuse** — exploit transcoders pre-validation.
0867. **Async-verdict race handling** — test async scanner verdict handling.
0868. **Metadata-extraction races** — race EXIF extractors.
0869. **Preview-generation races** — exploit preview workers.
0870. **CDN-propagation races** — fetch from CDN before origin validation.
0871. **Cache-fill races** — poison caches during processing.
0872. **Race-window measurement** — quantify validation delays.
0873. **Virus-scanner differential bypass (technique)** — compare scanner verdicts.
0874. **YARA-rule gap mapping (technique)** — find rule blind spots.
0875. **EICAR-adjacent probe (safe)** — verify scanning is active without malware.
0876. **Multi-engine verdict comparison** — test engines disagreeing.
0877. **Archive-nesting scanner gaps** — hide in nested archives as a technique.
0878. **Encryption-based scanner bypass (technique)** — test password-protected archives.
0879. **Polyglot scanner confusion** — dual-format evasion as a technique.
0880. **Metadata-only scanner gaps** — test scanners skipping metadata.
0881. **Chunked-encoding scanner gaps** — test streaming blind spots.
0882. **Scanner timeout abuse (safe)** — test large-but-safe files timing out scans.
0883. **CSV formula injection on re-download** — poison exports users re-download.
0884. **CSV DDE payload variants** — catalog DDE formula variants.
0885. **CSV HYPERLINK exfiltration** — use HYPERLINK to collaborator domains.
0886. **CSV WEBSERVICE exfiltration** — use WEBSERVICE for out-of-band theft.
0887. **CSV FILTERXML exfiltration** — exploit Excel XML functions.
0888. **CSV RTD exfiltration** — abuse RTD functions.
0889. **CSV formula in import-preview** — target admin previews.
0890. **CSV delimiter-confusion formulas** — exploit semicolon delimiters.
0891. **CSV quote-escape formulas** — break quoting to activate formulas.
0892. **CSV BOM-based activation** — use byte-order marks to change parsing.
0893. **CSV formula via API exports** — target JSON-to-CSV converters.
0894. **CSV injection in scheduled reports** — poison emailed reports.
0895. **CSV second-order via database** — store then export.
0896. **CSV formula sanitization mapping** — catalog per-app defenses.
0897. **Spreadsheet macro via CSV (technique)** — test SYLK and XLM paths safely.
0898. **PDF JavaScript actions** — test embedded JS in uploaded PDFs.
0899. **PDF OpenAction XSS** — exploit auto-run actions.
0900. **PDF launch actions (technique, safe)** — test launch payloads safely.
0901. **PDF URI actions** — abuse URI actions for phishing.
0902. **PDF form-field XSS** — test XFA forms.
0903. **PDF embedded-file XSS** — exploit embedded HTML.
0904. **PDF annotation XSS** — test link annotations.
0905. **PDF metadata XSS** — poison titles rendered in viewers.
0906. **PDF incremental-update smuggling** — hide payloads in updates.
0907. **PDF object-stream hiding** — conceal JS in streams.
0908. **PDF encryption-handler gaps** — test encrypted PDFs.
0909. **PDF linearization abuse** — exploit linearized parsing.
0910. **PDF cross-reference confusion** — corrupt xref for parser differentials.
0911. **PDF renderer differential testing** — compare viewer behaviors.
0912. **PDF-to-HTML conversion XSS** — test converters.
0913. **Font-file parsing attacks** — fuzz WOFF2 uploads.
0914. **OTF table injection** — exploit name tables.
0915. **TTF cmap abuse** — test character maps.
0916. **WOFF metadata XSS** — poison font metadata rendered in previews.
0917. **Font subsetting bugs (technique)** — test subsetters safely.
0918. **Variable-font parsing** — test fvar tables.
0919. **Color-font COLR abuse** — test color layers.
0920. **Font fallback XSS** — exploit fallback rendering.
0921. **EOT legacy parsing** — test old IE formats.
0922. **Font preview generation gaps** — test preview renderers.
0923. **Video-thumbnail command injection** — fuzz ffmpeg filename args.
0924. **Thumbnail SSRF via video URLs** — test remote video fetching.
0925. **Subtitle-file XSS** — inject into SRT and VTT rendered in players.
0926. **VTT cue XSS** — exploit cue payloads.
0927. **SSA and ASS subtitle injection** — test styled subtitles.
0928. **Video metadata XSS** — poison title tags in players.
0929. **Chapter-title injection** — test chapter lists.
0930. **HLS playlist injection** — poison m3u8 URLs.
0931. **DASH manifest injection** — test MPD files.
0932. **Thumbnail sprite poisoning** — exploit sprite generators.
0933. **GIF-preview XSS** — test animated previews.
0934. **Video poster XSS** — poison poster attributes.
0935. **Audio waveform injection** — test waveform renderers.
0936. **Video transcoding differentials** — compare transcoder versions.
0937. **Codec-confusion uploads** — mislabel codecs.
0938. **HEIC parser edge cases** — fuzz HEIF boxes.
0939. **HEIC EXIF XSS** — poison HEIC metadata.
0940. **HEIC thumbnail extraction** — test derived images.
0941. **WEBP VP8X injection** — exploit extended chunks.
0942. **WEBP animation XSS** — test animated webp.
0943. **WEBP lossless confusion** — test lossless versus lossy gaps.
0944. **AVIF parser testing** — probe AV1 images.
0945. **JXL parser testing** — test JPEG-XL.
0946. **Next-gen format fallback gaps** — test fallback chains.
0947. **Format-mismatch serving** — serve HEIC as image/jpeg.
0948. **Upload-quota bypass via chunks** — split files to evade per-file limits.
0949. **Storage-exhaustion logic (safe)** — test quota enforcement safely.
0950. **Quota-reset abuse** — exploit reset timing.
0951. **Multi-account quota pooling** — test shared limits.
0952. **Trash-retention quota gaps** — exploit soft-delete counting.
0953. **Version-history quota abuse** — test version counting.
0954. **Thumbnail-storage quota** — test derived-file counting.
0955. **Deduplication quota bypass** — exploit hash-dedup.
0956. **Compression-ratio quota abuse** — store highly compressible data.
0957. **Quota-error information leaks** — exploit error messages.
0958. **Stored content on trusted domain** — upload HTML served from the main domain.
0959. **CDN subdomain trust abuse** — serve payloads from trusted CDN hosts.
0960. **Cookie-scope abuse via uploads** — steal cookies via same-site uploads.
0961. **CORS trust via upload domains** — exploit permissive CORS on asset hosts.
0962. **postMessage trust via upload origin** — abuse trusted origins.
0963. **OAuth redirect to upload domain** — chain with trusted redirect URIs.
0964. **Service-worker scope via uploads** — register workers from upload paths.
0965. **AppCache legacy abuse** — test manifest uploads.
0966. **Trusted-type bypass via uploads** — exploit allowlisted upload origins.
0967. **CSP allowlist via upload domain** — bypass CSP with trusted hosts.
0968. **JSONP via uploaded files** — abuse callback params on asset hosts.
0969. **Open-redirect via uploaded HTML** — chain trusted-domain redirects.
0970. **Phishing via trusted uploads** — host phishing on trusted domains.
0971. **Subdomain cookie tossing** — set cookies from upload subdomains.
0972. **Upload-domain takeover after expiry** — claim dangling upload buckets.
0973. **YAML front-matter injection** — test markdown YAML parsing.
0974. **TOML config upload injection** — probe config parsers.
0975. **INI parser differentials** — test config handling.
0976. **JSON upload prototype pollution** — test JSON parsers for __proto__ keys.
0977. **XML plist parsing gaps** — test binary versus XML plist.
0978. **Binary plist parser bugs (technique)** — fuzz bplist safely.
0979. **SQLite file upload abuse** — test uploaded databases queried raw.
0980. **Access-DB upload injection** — test .mdb handling.
0981. **Parquet metadata injection** — test big-data formats.
0982. **Arrow IPC injection** — test columnar formats.
0983. **HDF5 attribute injection** — test scientific formats.
0984. **NetCDF metadata XSS** — test climate-data formats.
0985. **DICOM metadata injection** — test medical images.
0986. **NIfTI header injection** — test neuroimaging formats.
0987. **FASTA and FASTQ header injection** — test bioinformatics formats.
0988. **PDB file injection** — test protein structures.
0989. **MIDI metadata XSS** — test audio metadata.
0990. **glTF 3D-model injection** — test model viewers.
0991. **STL file injection** — test 3D-print formats.
0992. **OBJ and MTL injection** — test material libraries.
0993. **SVGZ gzip-SVG gaps** — test compressed SVG handling.
0994. **X3D injection** — test 3D web formats.
0995. **ePub HTML injection** — test ebook readers.
0996. **Mobi metadata injection** — test Kindle formats.
0997. **CBZ and CBR comic XSS** — test archive readers.
0998. **CHM help-file injection** — test compiled help.
0999. **HLP legacy parsing** — test old help formats.
1000. **Upload-pipeline end-to-end mapping** — catalog every processing stage per file type for chained exploitation.
