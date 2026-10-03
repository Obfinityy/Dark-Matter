## D. API discovery & testing — REST, GraphQL, gRPC, WebSocket
0001. **Swagger UI hidden path sweep** — probe /v3/api-docs, /swagger.json, /openapi.yaml and 40+ vendor-specific doc variants because exposed specs hand attackers the full route map for free.
0002. **FastAPI docs exposure check** — test /docs, /redoc and /openapi.json on every host since FastAPI serves interactive documentation by default unless explicitly disabled.
0003. **Spring Boot actuator enumeration** — walk /actuator, /actuator/env, /actuator/heapdump and mapped sub-paths because actuator endpoints frequently leak config, beans and heap memory.
0004. **Postman public workspace harvesting** — query Postman's public API for collections mentioning the target brand since developers publish request collections containing live endpoints and sample tokens.
0005. **AsyncAPI spec discovery** — hunt for asyncapi.json/yaml and EventCatalog portals because event-driven APIs document WebSocket and message topics attackers can subscribe to.
0006. **WSDL endpoint discovery** — probe /service?wsdl, /soap and .asmx variants since legacy SOAP services hide behind modern frontends with verbose operation listings.
0007. **WADL file probing** — request application.wadl and /wadl paths because Jersey/JAX-RS apps expose machine-readable resource listings there.
0008. **OData metadata extraction** — fetch /$metadata on suspected OData services since it enumerates every entity set, function import and navigation property.
0009. **OData batch endpoint test** — probe /$batch for multipart batch support because batching lets attackers bundle many operations past per-request rate limits.
0010. **GraphQL introspection enablement check** — send a __schema query to /graphql and aliases since enabled introspection dumps the entire type system in one response.
0011. **GraphQL field-suggestion bypass** — submit misspelled field names to trigger didYouMean suggestions because suggestion engines leak real field names when introspection is off.
0012. **GraphQL error-based schema inference** — feed malformed selections and parse validation errors since error text reveals valid types, fields and argument names.
0013. **GraphQL __typename mapping sweep** — query __typename across unions and interfaces because it enumerates concrete types without full introspection.
0014. **GraphQL GET-method variant test** — replay POST queries as GET with ?query= since GET-based GraphQL is CSRF-able and often logged in proxies.
0015. **GraphQL playground exposure scan** — probe /playground, /graphiql and /voyager because in-browser IDEs ship with introspection and query history enabled.
0016. **GraphQL persisted-query hash guessing** — test Automatic Persisted Queries with sha256 of common query strings since predictable hashes let attackers execute allowlisted operations.
0017. **GraphQL persisted-query version abuse** — flip version fields in extensions.persistedQuery because version confusion can downgrade hash verification.
0018. **GraphQL query batching probe** — send arrays of queries in one request since batching multiplies brute-force and enumeration throughput.
0019. **GraphQL alias overloading test** — stack dozens of aliased identical fields because aliasing amplifies single-request data extraction.
0020. **GraphQL directive fuzzing** — fuzz @include/@skip with non-boolean values since directive mishandling can bypass field-level gating.
0021. **GraphQL fragment cycle test** — submit self-referencing fragments because cyclic fragments can cause expensive resolver loops.
0022. **GraphQL depth-limit measurement** — nest selections incrementally to find the cutoff since missing depth limits enable deeply nested resource exhaustion.
0023. **GraphQL cost-analysis probing** — craft high-multiplier list queries to infer whether the server computes query cost before execution.
0024. **GraphQL federation _service probe** — query _service { sdl } because federated gateways expose the full composed supergraph schema.
0025. **GraphQL federation _entities abuse** — call _entities with crafted representations since entity resolution can reach subgraph objects directly.
0026. **Subgraph direct-access discovery** — extract subgraph URLs from supergraph SDL and hit them directly because subgraphs often skip gateway-level authorization.
0027. **Federation key-field extraction** — parse @key directives from SDL since key fields reveal the exact identifiers needed for cross-subgraph object references.
0028. **Schema-stitching vs federation fingerprint** — compare _service responses and header behavior because stitching gateways expose different metadata surfaces than Apollo federation.
0029. **gRPC server reflection probing** — call grpc.reflection.v1alpha.ServerReflection since reflection returns every service, method and proto descriptor.
0030. **gRPC reflection-disabled proto hunt** — search for .proto files and descriptor sets on web roots because teams disable reflection but leave protos publicly downloadable.
0031. **gRPC health-check protocol probe** — call grpc.health.v1.Health/Check for known service names since health responses confirm which services actually run.
0032. **gRPC-web support detection** — send gRPC-web framed requests with content-type application/grpc-web because gRPC-web endpoints are reachable from browsers and often CORS-misconfigured.
0033. **gRPC transcoding discovery** — test REST-style paths against gRPC backends since transcoding proxies translate HTTP/JSON to gRPC and may skip method-level checks.
0034. **gRPC error-detail leakage analysis** — trigger INVALID_ARGUMENT and parse google.rpc.Status details because rich error models leak field constraints and internal codes.
0035. **gRPC metadata leakage check** — inspect response trailers and headers since servers often reflect internal metadata like service versions and backend hosts.
0036. **gRPC deadline abuse test** — set extreme deadlines/timeouts because deadline handling differences can leave server-side work running after client disconnect.
0037. **gRPC max-message-size probing** — send incrementally larger messages to map limits since oversized-message handling reveals DoS thresholds and parser behavior.
0038. **Proto field-number guessing** — send unknown field numbers and observe tolerance because lenient parsers accept guessed fields that strict schemas would reject.
0039. **gRPC status-to-HTTP mapping analysis** — compare status codes across transports since inconsistent mappings leak whether an endpoint is native REST or transcoded.
0040. **gRPC keepalive behavior probe** — open idle streams with keepalive pings because keepalive policies reveal connection-lifecycle assumptions attackers can exploit.
0041. **WebSocket handshake fuzzing** — mutate Origin, Sec-WebSocket-Protocol and extensions during upgrade since handshake validation gaps allow cross-origin socket hijacking.
0042. **WebSocket token-in-URL detection** — flag ws:// URLs carrying ?token= or ?auth= because URL tokens leak into proxy logs, browser history and Referer headers.
0043. **WebSocket subprotocol negotiation test** — offer graphql-ws vs subscriptions-transport-ws alternately since servers may accept deprecated protocols with weaker auth.
0044. **WebSocket path fuzzing** — brute-force /ws, /socket.io, /realtime, /cable, /graphql-ws and framework defaults because socket endpoints rarely appear in REST docs.
0045. **Socket.IO namespace enumeration** — connect to guessed namespaces like /admin and /notifications since namespaces partition privilege and some lack auth.
0046. **Socket.IO event-name brute force** — emit common event names and watch for non-error responses because unlisted events often trigger privileged handlers.
0047. **Socket.IO polling fallback abuse** — force long-polling transport because the polling endpoint may enforce different auth than the WebSocket upgrade.
0048. **ActionCable channel enumeration** — subscribe to guessed channel names since Rails ActionCable channels frequently skip authorization on subscribe.
0049. **SignalR hub-method enumeration** — call /negotiate then invoke common hub methods because SignalR hubs expose server methods callable by any connected client.
0050. **SignalR negotiate analysis** — parse connectionToken and availableTransports from /negotiate since token format reveals session binding strength.
0051. **STOMP-over-WebSocket topic sweep** — SUBSCRIBE to wildcard and guessed destinations because STOMP brokers often allow subscribing to other users' queues.
0052. **MQTT-over-WebSocket topic brute force** — subscribe to # and + wildcards since MQTT ACLs are frequently misconfigured to allow broad subscriptions.
0053. **SockJS info endpoint probe** — request /info on SockJS prefixes because the info response discloses websocket support, origins and entropy settings.
0054. **WebSocket message-schema inference** — record request/response frame pairs and cluster shapes since inferred schemas reveal undocumented message types.
0055. **WebSocket binary-frame handling test** — send binary and text frames interchangeably because mixed-frame parsers often have deserialization gaps.
0056. **WebSocket compression abuse check** — negotiate permessage-deflate and send highly compressible payloads since compression can amplify memory usage per connection.
0057. **WebSocket max-frame-size probe** — send growing frames to find truncation points because oversized-frame handling reveals parser limits.
0058. **WebSocket ping/pong behavior map** — measure keepalive timeouts and pong requirements since idle-connection policies determine hijack windows.
0059. **WebSocket reconnection-token analysis** — capture resume tokens across reconnects because predictable resume tokens let attackers take over sessions.
0060. **WebSocket message-ordering assumption test** — send out-of-order dependent messages since servers assuming order may apply operations to wrong state.
0061. **GraphQL subscription handshake test** — open graphql-ws connections with varied auth payloads because subscription transports often validate auth differently than HTTP.
0062. **Server-Sent Events endpoint discovery** — probe /events, /stream and text/event-stream content types since SSE endpoints stream privileged updates with weak auth.
0063. **SSE event-type enumeration** — catalog event: field values because event types reveal internal workflows like payments and moderation.
0064. **SSE Last-Event-ID replay test** — replay old event IDs since servers may re-emit historical events containing other users' data.
0065. **Long-polling endpoint discovery** — detect hanging GET patterns on /poll and /updates because long-poll endpoints bypass standard request logging.
0066. **API version path enumeration** — brute-force /v1, /v2, /v3, /beta, /internal, /canary prefixes since old versions stay live with weaker validation.
0067. **API version header negotiation** — test Accept-version, X-API-Version and vendor MIME types because header-versioned APIs hide entire version surfaces.
0068. **API version query-param test** — try ?version=2 and ?apiVersion= across endpoints since param-versioned routes bypass path-based WAF rules.
0069. **API version subdomain sweep** — probe v2.api., api-v2. and beta-api. hosts because version subdomains often point at staging stacks.
0070. **Old-version security regression diff** — compare auth checks between v1 and v2 since deprecated versions routinely miss newer authorization fixes.
0071. **Old-version field-exposure diff** — diff response schemas across versions because retired versions frequently return fields later removed for privacy.
0072. **Beta endpoint weak-validation hypothesis** — fuzz beta paths harder than stable ones since beta code ships with looser input validation.
0073. **Deprecated-but-live endpoint hunt** — parse Sunset and Deprecation headers then retest sunset endpoints because "retired" routes often remain routable.
0074. **Sunset-header catalog building** — collect all Deprecation/Sunset header values to build a timeline of supposedly dead endpoints worth retesting.
0075. **Experimental-header feature unlock** — send X-Experimental-Features and labs flags since dark-launched endpoints activate on header presence alone.
0076. **Dark-launch detection via headers** — diff response headers with and without preview flags because dark features leak via Set-Cookie and diagnostic headers.
0077. **Canary routing header test** — try X-Canary and canary cookies because canary routers can steer attackers to unhardened new builds.
0078. **Shadow API detection via JS cross-reference** — extract fetch/XHR URLs from bundles and diff against documented specs since frontend code calls undocumented endpoints.
0079. **Orphan endpoint harvest from source maps** — parse .js.map files for API strings because source maps contain endpoint literals stripped from minified code.
0080. **TypeScript declaration endpoint mining** — scan .d.ts files in public SDKs since type declarations enumerate every client-callable method and path.
0081. **SDK source endpoint enumeration** — grep published npm/pip SDKs for path templates because SDKs encode the complete private API surface.
0082. **HATEOAS link harvesting** — follow _links and hypermedia controls recursively since hypermedia APIs self-document hidden state transitions.
0083. **Link-header pagination crawl** — walk rel=next Link headers to exhaustion because paginated collections expose object IDs at scale.
0084. **API changelog endpoint discovery** — probe /changelog, /release-notes and /whats-new since changelogs name newly added and removed endpoints.
0085. **Status-page API backend discovery** — query statuspage.io and custom status APIs since status endpoints often expose component IDs and internal service names.
0086. **Security.txt scope harvesting** — fetch /.well-known/security.txt because contact files sometimes list in-scope API hosts and testing policies.
0087. **Well-known URI enumeration** — probe /.well-known/* variants (openid-configuration, assetlinks, change-password) since discovery documents reveal auth and API endpoints.
0088. **Robots.txt API disallow harvest** — parse Disallow entries for /api, /admin and /internal paths because robots files enumerate routes operators wanted hidden.
0089. **Sitemap API route hints** — crawl sitemap.xml for API-ish URLs since sitemaps occasionally include JSON endpoints and feeds.
0090. **Wayback Machine API path harvest** — query the Wayback CDX API for the target's historical URLs because archived crawls preserve retired endpoints still live today.
0091. **Common Crawl API path harvest** — search Common Crawl indexes for target API paths since petabyte-scale crawls capture endpoints missed by live spidering.
0092. **GitHub code-search API dorking** — search public code for the target's API base URLs because leaked client code and Postman dumps contain private endpoints.
0093. **Build-ID to API-version mapping** — correlate frontend build IDs with backend behavior since build markers reveal which API version each deploy talks to.
0094. **JS bundle API-version strings** — grep bundles for /v\d/ literals and API_BASE constants because compiled frontends hardcode version prefixes.
0095. **API error framework fingerprinting** — classify error shapes (Django REST, Rails, FastAPI, Spring, Express) since framework identity unlocks framework-specific default routes.
0096. **Verbose validation-error schema leak** — trigger 422s with bad fields because detailed validation messages enumerate field names, types and constraints.
0097. **Field-name oracle via 400s** — submit unknown fields one at a time and diff errors since per-field messages confirm which fields exist.
0098. **422-vs-400 differential mapping** — compare status codes across malformed inputs because code differences reveal the validation pipeline's stages.
0099. **Nested-object validation depth probe** — send deeply nested objects to find recursion limits since deep-nesting cutoffs expose parser thresholds.
0100. **Array-length limit probing** — grow array payloads until rejection because length limits reveal batch-operation ceilings.
0101. **Duplicate JSON key handling test** — send {"a":1,"a":2} since first-wins vs last-wins parsing creates parameter smuggling opportunities.
0102. **JSON vs form-encoded differential** — submit the same data as JSON and form bodies because dual parsers often validate differently.
0103. **Multipart boundary quirk test** — mutate boundaries and part headers since multipart parsers have historically lenient edge cases.
0104. **Protobuf content-type probe** — send application/x-protobuf to JSON endpoints because some stacks silently accept binary protobuf.
0105. **MessagePack support detection** — try application/msgpack bodies since alternate serializers widen the parser attack surface.
0106. **YAML body support detection** — send application/yaml payloads because YAML parsers enable deserialization paths JSON lacks.
0107. **XML body on JSON endpoints** — post application/xml to REST routes since content-type confusion can route data into XML parsers.
0108. **GraphQL multipart upload support** — test graphql-multipart-request-spec uploads because file-upload mutations bypass REST upload controls.
0109. **OPTIONS method enumeration** — send OPTIONS to every discovered route and parse Allow headers since Allow lists the exact methods each endpoint supports.
0110. **Allow-header gap analysis** — diff Allow headers across sibling routes because inconsistent method lists reveal forgotten endpoints.
0111. **405-vs-404 route oracle** — use 405 Method Not Allowed vs 404 to confirm route existence since 405 proves the path is real.
0112. **401-vs-403 differential mapping** — compare auth failures across endpoints since 401-vs-403 patterns reveal which routes check auth at all.
0113. **Response-timing route oracle** — measure timing deltas between existing and non-existing paths because auth/database lookups make real routes slower.
0114. **HEAD method information probe** — send HEAD to API routes since HEAD responses leak Content-Length and headers without body rate limits.
0115. **TRACE method support check** — test TRACE because enabled TRACE echoes request data and aids header-injection analysis.
0116. **Custom HTTP method probing** — try PURGE, DEBUG and framework-specific verbs since custom methods sometimes bypass method-based access rules.
0117. **Method case-sensitivity test** — send get/post lowercase because case-sensitive routers may treat lowercase methods as unauthenticated fallthroughs.
0118. **HTTP method override header test** — send X-HTTP-Method-Override and _method params since override headers can turn a GET into a privileged POST.
0119. **Content-type negotiation abuse** — vary Accept headers (json, xml, html) because negotiation can return debug HTML or stack traces for APIs.
0120. **Vendor MIME version probing** — request application/vnd.api.v2+json variants since vendor MIME types hide versioned representations.
0121. **Charset negotiation quirks** — append ;charset= values because charset handling differences cause encoding-based filter bypasses.
0122. **REST route-conflict detection** — test trailing slashes, case variants and dot-segments since overlapping route definitions create auth-check gaps.
0123. **Path-parameter type-confusion test** — swap numeric IDs for strings and objects because loose parameter typing breaks downstream authorization.
0124. **Matrix-parameter support test** — insert ;param=value segments since matrix parameters can smuggle data past path-based filters.
0125. **URL-encoded slash handling** — test %2F inside path params because decoded slashes can shift routing to unintended handlers.
0126. **Double-encoding path test** — send %252F sequences since double decoding at different layers creates route confusion.
0127. **Encoded-dot bypass at gateway** — try %2e variants because gateways and backends normalize dots differently.
0128. **Semicolon-parameter bypass test** — append ;x=1 to paths since some frameworks strip semicolon params before auth checks.
0129. **API base-path confusion test** — compare /api vs /api/ handling because base-path normalization gaps expose unprotected duplicates.
0130. **Case-normalization gateway differential** — test /API/Users vs /api/users since gateway and backend may disagree on case folding.
0131. **Trailing-slash normalization differential** — probe redirect vs direct-serve behavior because normalization mismatches bypass path rules.
0132. **API gateway fingerprinting** — identify Kong, Apigee, AWS API Gateway and Azure APIM via headers because gateway identity reveals known path-normalization quirks.
0133. **Kong Admin API exposure check** — probe port 8001 and /admin paths since exposed Kong admin APIs allow full route reconfiguration.
0134. **AWS API Gateway stage enumeration** — brute-force stage names (dev, staging, prod, v1) because stages often have different auth settings.
0135. **Azure APIM developer portal check** — fetch the developer portal and its API listings since APIM portals document products, subscriptions and sample keys.
0136. **APIM management API probe** — test management.azure.com-style paths because exposed management APIs leak subscription keys.
0137. **Tyk gateway discovery** — probe Tyk-specific headers and /tyk/ paths since Tyk gateways expose key and policy APIs when misconfigured.
0138. **Traefik dashboard API check** — request /dashboard and /api/rawdata because exposed Traefik dashboards reveal routers and services.
0139. **Envoy admin interface probe** — test /admin on edge ports since Envoy admin exposes config dumps and stats.
0140. **Gateway route-overlap detection** — map overlapping route patterns because the winning route may skip auth the loser enforced.
0141. **Path-traversal in route matching** — test /api/../admin sequences since gateway path cleaning can desync from backend routing.
0142. **X-Internal-Request header trust test** — send internal-trust headers because gateways sometimes pass internal flags straight to backends.
0143. **Debug-header verbose mode test** — try X-Debug, X-Verbose and ?debug=1 since debug flags can enable stack traces and query logging.
0144. **Internal endpoint via Host header** — request with internal hostnames because virtual-host routing can expose intranet APIs externally.
0145. **X-Forwarded-Host routing test** — spoof forwarded hosts since apps generating links or routing from this header expose internal endpoints.
0146. **Alternative-port API sweep** — probe 3000, 5000, 8000, 8080 and 8443 because dev API servers frequently listen on alternate ports publicly.
0147. **gRPC default-port probe** — test port 50051 with reflection calls since gRPC services often run unencrypted beside the web tier.
0148. **Rate-limit threshold mapping** — burst each endpoint to find 429 cutoffs because per-endpoint limits reveal which routes are abuse-sensitive.
0149. **Rate-limit header parsing** — collect X-RateLimit-* and Retry-After values since headers disclose quota sizes and window logic.
0150. **Rate-limit bypass via method change** — retry limited POSTs as GET/PUT because limiters sometimes key only on specific methods.
0151. **Rate-limit bypass via path casing** — alternate /API and /api paths since case variants can evade limiter keying.
0152. **Rate-limit bypass via query junk** — append random query params because limiters keyed on full URL treat each variant separately.
0153. **Pagination abuse sweep** — test negative pages, page=0 and huge limits since pagination logic often lacks bounds checking.
0154. **Offset-overflow test** — request extreme offsets because offset overflow can wrap or dump unordered rows.
0155. **Cursor-token decode analysis** — base64-decode pagination cursors since cursors frequently embed raw IDs, timestamps or SQL fragments.
0156. **Pagination total-count disclosure** — read total/hits fields because totals leak dataset sizes competitors consider sensitive.
0157. **Batch endpoint discovery** — probe /batch, /bulk, /multi and /compose since batch endpoints multiplex operations past single-request controls.
0158. **Batch mixed-operation abuse** — mix GET and DELETE in one batch because batch handlers may apply weaker per-item authorization.
0159. **Batch partial-failure oracle** — study which sub-requests fail since per-item errors reveal authorization boundaries item by item.
0160. **Webhook receiver discovery** — hunt /webhooks, /hooks and /callbacks paths because inbound webhook URLs accept unauthenticated third-party calls.
0161. **Webhook signature-verification test** — send unsigned and wrongly-signed payloads since many receivers accept unsigned webhooks in practice.
0162. **Webhook replay test** — resend captured payloads because missing idempotency lets attackers replay payment or provisioning events.
0163. **Webhook timestamp-tolerance measurement** — skew timestamps to find acceptance windows since wide windows extend replay viability.
0164. **Webhook secret-entropy analysis** — assess signing-secret strength from docs and samples because short shared secrets are brute-forceable.
0165. **HMAC secret brute-force feasibility** — estimate keyspace from observed secret formats since low-entropy webhook secrets fall to offline cracking.
0166. **Outgoing-webhook URL validation map** — test what callback URLs the API accepts registering because lax validation turns webhook config into SSRF-adjacent primitives.
0167. **Webhook delivery-retry logic map** — observe retry counts and backoff since retry behavior determines how long a malicious endpoint gets hammered.
0168. **API key auth-scheme discovery** — test query-param vs header vs cookie key placement since supported schemes reveal the weakest accepted credential channel.
0169. **API key in URL detection** — flag ?api_key= and ?key= usage because URL keys leak into logs, history and Referer headers.
0170. **Basic-auth realm enumeration** — parse WWW-Authenticate realms since realm strings disclose environment names and product editions.
0171. **WWW-Authenticate scheme analysis** — catalog auth schemes offered per endpoint because scheme lists reveal fallback paths like Negotiate or Basic.
0172. **Multiple-auth precedence test** — send cookie plus Authorization header together since precedence bugs can let a weak credential override a strong one.
0173. **Auth-scheme fallback detection** — omit the primary credential but send a secondary one because fallbacks often skip MFA or device checks.
0174. **Anonymous access via method change** — retry authenticated endpoints with different verbs since auth middleware sometimes binds to specific methods.
0175. **Preflight CORS mapping per endpoint** — send OPTIONS with Origin headers across routes because per-route CORS configs reveal which endpoints trust which origins.
0176. **Response content-type sniffing check** — verify X-Content-Type-Options on API responses since missing nosniff lets browsers misinterpret JSON as HTML.
0177. **API HTML error-page detection** — trigger errors and check for HTML bodies because HTML error pages on APIs create reflected-content XSS footholds.
0178. **Stack-trace disclosure scan** — force 500s across endpoints since stack traces leak file paths, library versions and query fragments.
0179. **Request-ID format analysis** — study X-Request-ID values for sequentiality because predictable IDs enable log-correlation and enumeration attacks.
0180. **Server timestamp leakage** — extract Date and custom time headers since server clocks calibrate replay and token-expiry attacks.
0181. **Clock-skew measurement** — compare server time against local time because skew widens or narrows token validity windows.
0182. **Custom error-code catalog** — collect application error codes since code catalogs map to internal services and failure modes.
0183. **Error-code to service mapping** — cluster error formats by endpoint because distinct formats reveal microservice boundaries.
0184. **Non-standard status-code mapping** — catalog unusual codes like 419, 420 and 509 since custom codes document app-specific states.
0185. **Health-check info disclosure** — probe /health, /readyz and /livez for verbose output because health endpoints often report versions and dependency states.
0186. **Metrics endpoint discovery** — request /metrics and /stats since Prometheus-style metrics leak request counts, error rates and instance labels.
0187. **Debug endpoint sweep** — probe /debug/vars, pprof paths and /console because debug endpoints expose goroutine dumps and live config.
0188. **Feature-flag endpoint discovery** — hunt /flags, /features and /experiments since flag endpoints reveal unreleased functionality.
0189. **Feature-flag evaluation probe** — query flag endpoints with varied user contexts because evaluation logic discloses targeting rules.
0190. **A/B bucketing endpoint map** — find assignment endpoints since bucketing logic reveals experiment names and traffic splits.
0191. **Kill-switch endpoint detection** — search for disable/feature-off routes because kill switches are high-value unauthenticated targets.
0192. **Maintenance-mode bypass test** — request with maintenance-bypass headers or IPs since bypass mechanisms often rely on spoofable signals.
0193. **Config endpoint discovery** — probe /config, /env.json and /settings.json because frontend config endpoints leak API hosts and feature toggles.
0194. **API key in JS bundle** — grep bundles for apiKey and x-api-key literals since shipped keys grant direct API access.
0195. **Public demo-key harvesting** — collect documented demo keys because demo keys frequently work against production with real quotas.
0196. **Sandbox-vs-production parity check** — diff sandbox and prod responses since parity gaps reveal endpoints live in prod but undocumented.
0197. **Sandbox data-leakage test** — check whether sandbox returns real user data because sandboxes are often seeded from production snapshots.
0198. **Demo-tenant API access** — probe demo or trial tenant scopes since demo tenants sometimes share data stores with paying customers.
0199. **Public demo-credential test** — try documented demo logins against the API because demo accounts occasionally carry elevated scopes.
0200. **API docs version-history mining** — pull old spec versions from docs hosting since retired spec versions describe endpoints still reachable.
0201. **API docs auth-bypass via path** — request docs under /internal/docs paths directly because docs auth is often enforced only at the linked URL.
0202. **ReDoc and Scalar UI detection** — probe /redoc, /scalar and /stoplight since alternative doc UIs ship with try-it-now consoles hitting live APIs.
0203. **Hasura console exposure** — probe /console on GraphQL hosts since exposed Hasura consoles allow schema and metadata browsing.
0204. **Hasura metadata API test** — query /v1/metadata because metadata APIs export tables, relationships and permissions.
0205. **Hasura event-trigger webhook map** — enumerate configured triggers since event triggers reveal internal webhook URLs.
0206. **Supabase edge-function enumeration** — probe /functions/v1/* paths because edge functions deploy with per-function auth gaps.
0207. **PostgREST auto-API detection** — test PostgREST-style query params since auto-generated APIs expose full table surfaces.
0208. **Firebase REST discovery probe** — test /.json suffixes on Firebase hosts since misconfigured rules expose entire realtime databases.
0209. **Firestore REST probing** — query Firestore REST endpoints because weak IAM lets REST calls bypass client SDK rules.
0210. **AppSync endpoint discovery** — identify AWS AppSync GraphQL endpoints since AppSync APIs have distinct auth modes worth mapping per-field.
0211. **API Gateway usage-plan probe** — test endpoints without keys to map plan boundaries because usage plans define which routes are truly public.
0212. **Response-schema drift detection** — snapshot schemas and re-diff over time since silent field additions expand the data-exposure surface.
0213. **GraphQL schema drift tracking** — re-run introspection periodically because schema additions between deploys reveal new attack surface.
0214. **REST schema drift via OPTIONS** — re-poll Allow headers after deploys since method additions signal new functionality.
0215. **Breaking-change detection** — diff field removals against client usage because breaking changes push clients to legacy endpoints.
0216. **Deprecated-field resolvability test** — query @deprecated fields because deprecated fields often remain resolvable with sensitive data.
0217. **Deprecated-field data exposure** — compare deprecated vs replacement field output since deprecated fields may return unredacted values.
0218. **Field-deprecation still-live sweep** — enumerate all deprecated schema members because deprecation is documentation, not enforcement.
0219. **Labs and beta subdomain API** — probe labs. and beta. API hosts since experimental subdomains run pre-hardened code.
0220. **Feature-preview endpoint hunt** — search for /preview and /next paths because preview endpoints ship before security review.
0221. **Response-header framework fingerprint** — parse X-Powered-By, Server and Via values since version disclosure targets exploit selection.
0222. **Proxy-chain via-header mapping** — read Via and X-Forwarded-For chains because proxy topology reveals internal tiers.
0223. **Gateway request-ID tracing** — follow trace IDs across services since tracing headers map the microservice call graph.
0224. **Traceparent reflection test** — send W3C traceparent headers because reflected tracing data confirms distributed-tracing instrumentation.
0225. **B3 propagation handling** — test Zipkin B3 headers since propagation support reveals service-mesh internals.
0226. **Distributed-tracing endpoint leak** — probe /traces or Jaeger UIs because exposed tracing UIs show real request payloads.
0227. **Search-operator discovery** — fuzz q, filter, search and query params since search endpoints hide powerful query operators.
0228. **Filter-operator surface mapping** — test [gt], [in], [regex] style operators because operator support determines NoSQL-injection-adjacent risk.
0229. **Sort-field enumeration** — fuzz sort= values since sortable fields confirm database column names.
0230. **Sparse-fieldset support test** — try fields[]= selectors because field selection enables targeted data harvesting.
0231. **Include-expansion depth test** — nest include= relations since deep expansion bypasses per-endpoint field restrictions.
0232. **JSON:API include-limit probe** — measure max include depth because unlimited expansion causes expensive join queries.
0233. **Autocomplete endpoint harvesting** — brute-force prefixes on /suggest endpoints since typeahead indexes are enumerable dictionaries of private data.
0234. **Typeahead enumeration sweep** — walk a-z prefixes systematically because suggest endpoints leak names, emails and titles.
0235. **Search-index mapping** — determine which fields are indexed since indexed fields are the searchable — and enumerable — subset.
0236. **Export-format discovery** — probe ?format=csv/json/xlsx on list endpoints because export paths generate bulk data files.
0237. **Async report polling map** — trace report-generation job endpoints since async jobs expose status and download URLs.
0238. **Bulk-export endpoint hunt** — look for /export/all style routes because bulk exports bypass pagination controls.
0239. **Template-download enumeration** — fetch /templates since import templates reveal accepted schemas and internal field names.
0240. **Sample-file endpoint check** — download sample files because samples sometimes contain real production rows.
0241. **Polling-vs-webhook completion map** — compare job-completion channels since polling endpoints may skip the auth webhooks enforce.
0242. **Idempotency-Key support discovery** — test Idempotency-Key headers because idempotency handling determines replay safety.
0243. **Idempotency-Key replay behavior** — replay keys with different bodies since weak binding lets attackers swap payloads.
0244. **Idempotency-Key cross-user collision** — reuse another user's key because unscoped keys leak or replay others' operations.
0245. **ETag caching behavior map** — test If-None-Match flows since cache validators can serve stale privileged data.
0246. **Cache-key parameter discovery** — identify which params affect caching because unkeyed params enable cache-deception variants.
0247. **CDN cache-behavior differential** — compare cached vs fresh API responses since CDN caching of authenticated responses leaks data.
0248. **Conditional-request handling test** — fuzz If-Modified-Since values because conditional logic can skip authorization on 304 paths.
0249. **Range-request on API test** — send Range headers to JSON endpoints since partial-content support can bypass output filters.
0250. **OpenAPI discriminator mapping** — parse discriminator and oneOf/anyOf branches since polymorphism docs reveal hidden subtypes.
0251. **Polymorphic type-confusion test** — submit wrong subtypes in polymorphic fields because type confusion can route data into privileged handlers.
0252. **Nullable-vs-required behavior map** — flip nullability on fields since inconsistent null handling reveals optional security checks.
0253. **Server-side default exploitation** — omit fields to trigger defaults because default values sometimes grant broader access than explicit ones.
0254. **Read-only field write test** — attempt writes to documented read-only fields since mass-assignment gaps make read-only a suggestion.
0255. **Write-only field read test** — try reading password-style write-only fields because misconfigured serializers leak them.
0256. **Extra-field acceptance test** — inject unknown fields into bodies since accepted unknown fields confirm mass-assignment tolerance.
0257. **Enum value fuzzing** — submit undocumented enum members because hidden enum values unlock unlisted states and roles.
0258. **Enum case-sensitivity test** — vary enum casing since case-insensitive matching can accept unintended values.
0259. **Date-format parsing quirk map** — try ISO, epoch and locale formats per endpoint because lenient date parsing causes logic errors.
0260. **Timezone differential test** — submit times in conflicting zones since timezone mishandling shifts expiry and scheduling logic.
0261. **Locale-header behavior map** — vary Accept-Language because locale-dependent validation changes field requirements.
0262. **UUID strictness probe** — submit malformed UUIDs since lax UUID validation accepts attacker-controlled identifiers.
0263. **ID-format oracle** — test numeric, UUID and slug forms per resource because supported formats reveal identifier schemes.
0264. **Slug-to-ID resolution map** — resolve slugs to internal IDs since slug endpoints often skip the authz the ID endpoint enforces.
0265. **Numeric-ID predictability analysis** — measure ID sequentiality because sequential IDs make object enumeration trivial.
0266. **ULID timestamp extraction** — decode ULID timestamps since embedded timestamps leak creation order and timing.
0267. **ObjectId timestamp analysis** — parse Mongo ObjectId components because ObjectIds leak creation time and machine identity.
0268. **Hashid decode attempt** — try decoding obfuscated IDs with common salts because Hashids are obfuscation, not protection.
0269. **Base64 ID tamper test** — decode and mutate base64 IDs since encoded IDs often lack integrity protection.
0270. **Hypermedia state-transition map** — catalog allowed actions per resource state because state machines reveal skippable steps.
0271. **State-transition bypass test** — jump states (created→shipped) since transition guards are often client-side only.
0272. **Per-state Allow-header diff** — compare OPTIONS output across states because allowed methods change with state in buggy implementations.
0273. **DNS SRV record API discovery** — query SRV records for API services since DNS advertises service hosts and ports.
0274. **Certificate SAN API harvest** — parse certificate Subject Alternative Names because SANs list api, internal and staging hostnames.
0275. **Shodan API-port correlation** — cross-reference Shodan banners with web APIs since exposed ports reveal non-HTTP API listeners.
0276. **API analytics endpoint discovery** — find self-hosted tracking endpoints because analytics APIs accept unsanitized event data.
0277. **Request correlation-ID handling** — test X-Correlation-ID reflection since reflected IDs aid log-injection and tracing analysis.
0278. **HTTP/2 vs HTTP/1.1 differential** — compare API behavior across versions because HTTP/2-specific features change request smuggling and header handling.
0279. **HTTP/3 QUIC API probe** — test QUIC-enabled API hosts since new protocol stacks have immature edge-case handling.
0280. **Legacy SOAP-to-REST shim hunt** — look for /soap-rest bridges because shim layers translate with weaker validation.
0281. **GraphQL-to-REST fallback discovery** — find REST equivalents of GraphQL operations since fallbacks duplicate logic with different authz.
0282. **Admin API subdomain discovery** — probe admin-api. and internal-api. hosts because admin APIs frequently lack the WAF of the main site.
0283. **Internal docs in SDK changelogs** — read SDK release notes since changelogs name new internal endpoints before docs do.
0284. **API status-code state oracle** — map which codes each resource state returns because status codes leak workflow internals.
0285. **HTTP/2 rapid-reset API test** — assess stream-reset handling on API frontends since rapid resets can bypass per-request accounting.
0286. **API gateway request-smuggling guard** — verify gateway normalization of ambiguous requests because desync at the gateway reaches all backends (detection only, no exploitation).
0287. **Content-Length differential on OPTIONS** — compare OPTIONS body sizes across routes since size differences confirm route existence.
0288. **API docs crawler trap** — follow every link in published docs since docs link staging, internal and deprecated endpoints.
0289. **OpenAPI example-value harvesting** — extract examples from specs because example payloads contain realistic IDs, tokens and PII formats.
0290. **OpenAPI server-URL enumeration** — list all servers.* URLs in specs since specs enumerate prod, staging and dev base URLs.
0291. **Callback-URL discovery in specs** — parse OpenAPI callbacks sections because callbacks document the target's outbound webhook contracts.
0292. **Webhook signature-algorithm agility** — test which algorithms receivers accept since algorithm confusion downgrades HMAC to plain comparison.
0293. **API versioning via cookie** — try version cookies because cookie-versioned APIs hide version surfaces from URL scanners.
0294. **API versioning via JWT claim** — inspect version claims (careful: format analysis only) since versioned tokens route to different backends.
0295. **gRPC channelz alternative probe** — try channelz and admin services when reflection is off because debug services sometimes remain enabled.
0296. **gRPC service-config discovery** — request service configs via reflection alternatives since configs reveal load-balancing and retry policies.
0297. **gRPC load-balancer behavior** — observe routing across backends because balancer behavior reveals instance counts and stickiness.
0298. **REST Hooks subscription discovery** — probe rest-hook subscription endpoints since hook subscriptions let attackers register data exfiltration callbacks.
0299. **Subscription topic enumeration** — list subscribable topics because topic lists reveal event types like user.deleted.
0300. **Event-type to PII mapping** — correlate event types with payload fields since event schemas show exactly which PII each event carries.
0301. **API gateway key-leak via error** — trigger gateway errors because gateway error pages sometimes reflect backend keys and ARNs.
0302. **Backend-header passthrough detection** — identify backend headers surviving the gateway since passthrough headers leak internal IPs and versions.
0303. **API response-time SLO mapping** — measure p50/p99 per endpoint because latency profiles reveal expensive endpoints worth abusing.
0304. **Slow-endpoint DoS surface ranking** — rank endpoints by response cost since the slowest authenticated endpoints are the best DoS targets.
0305. **API concurrency-limit probe** — open parallel connections per endpoint because concurrency limits reveal abuse thresholds.
0306. **Connection-reuse behavior test** — test keep-alive limits since connection policies affect request-smuggling-adjacent testing scope.
0307. **API client-hint handling** — send Sec-CH-* headers because client-hint processing reveals device-fingerprinting logic.
0308. **API geo-header behavior** — spoof CF-IPCountry and CloudFront-Viewer-Country since geo headers drive region-gated features.
0309. **True-Client-IP trust test** — spoof True-Client-IP because trusted IP headers bypass geo and rate controls.
0310. **X-Forwarded-For feature abuse** — test features keyed on forwarded IP since spoofed IPs manipulate geo, language and fraud signals.
0311. **API key rotation propagation** — measure how fast revoked keys stop working because propagation delays leave revoked keys usable.
0312. **API key scope-drift detection** — re-check key permissions over time since scope changes silently expand key power.
0313. **Compromised-key canary test** — plant canary keys in monitored locations because canary usage alerts reveal attacker tooling.
0314. **Self-registration key abuse** — abuse free-tier key issuance since self-serve keys enable large-scale anonymous API abuse.
0315. **Key-quota exhaustion test** — burn through quotas to map limits because quota behavior reveals cost-based abuse ceilings.
0316. **API plan-tier differential** — compare free vs paid endpoint access since tier gates are often enforced client-side.
0317. **Trial-tier feature unlock** — test enterprise endpoints on trial keys because trial scopes frequently include unreleased features.
0318. **Expired-key grace behavior** — test recently expired keys since grace periods extend access beyond expiry.
0319. **API deprecation-notice parsing** — scrape docs and headers for deprecation timelines because timelines prioritize which dead endpoints to retest.
0320. **Stale SDK endpoint test** — call endpoints removed from latest SDKs since backends keep serving endpoints SDKs dropped.
0321. **Mobile-app-only endpoint discovery** — diff mobile vs web API traffic because mobile APIs expose endpoints the web never calls.
0322. **Smart-TV and IoT API variants** — probe device-specific API paths since embedded clients use simplified auth flows.
0323. **Partner API discovery** — hunt /partner and /reseller paths because partner APIs have distinct, often weaker, auth models.
0324. **Affiliate API enumeration** — probe affiliate endpoints since affiliate APIs expose commission and attribution data.
0325. **White-label API discovery** — find white-label tenant APIs because white-label instances share code with weaker per-tenant config.
0326. **API monetization-bypass test** — check whether paywalled endpoints enforce server-side since usage metering is often client-reported.
0327. **Usage-metering tamper test** — manipulate usage-reporting fields because self-reported usage enables billing fraud.
0328. **Quota-reset timing analysis** — measure quota window resets since reset timing enables precise quota-abuse scheduling.
0329. **Burst-vs-sustained limit mapping** — separate burst from sustained limits because the gap defines optimal abuse patterns.
0330. **Endpoint cost-ranking** — rank endpoints by CPU/DB cost per call since cost ranking prioritizes which endpoints to abuse-test first.
0331. **API abuse-pattern library** — maintain per-endpoint abuse playbooks because systematic abuse testing beats ad-hoc fuzzing.
0332. **Undocumented-parameter mining sweep** — fuzz debug, admin, test and internal params across all endpoints since hidden params toggle privileged behavior.
0333. **HTTP parameter pollution on APIs** — send duplicate params (id=1&id=2) because backend frameworks resolve duplicates inconsistently.
0334. **API response-shape fuzzer** — mutate requests and cluster response shapes since shape changes reveal hidden branches and error paths.
## E. AuthN attacks — brute-force logic, MFA bypass, session attacks
0335. **Breached-corpus credential stuffing** — replay username/password pairs from public breach compilations because password reuse makes stuffing the highest-yield login attack.
0336. **Target-specific password mutation** — generate candidates from brand, product and season words with leet transforms because users build passwords from their context.
0337. **Site-content wordlist scraping** — build spray lists from the target's own marketing copy since employees reuse company vocabulary in passwords.
0338. **Keyboard-walk spray ordering** — prioritize qwerty-walks and 123456 variants because spray lists ordered by real-world frequency beat alphabetical ones.
0339. **Password-spray lockout inference** — spray slowly while watching for lockout signals since inferred thresholds let sprayers stay just under lockout.
0340. **Lockout-threshold mapping** — count attempts until lockout per account because published thresholds let attackers budget attempts precisely.
0341. **Lockout-reset timer measurement** — time how long lockouts last since short windows make lockout-aware spraying practical.
0342. **Lockout bypass via username casing** — retry locked accounts as USER vs user because case-variant lookups can hit separate attempt counters.
0343. **Lockout bypass via whitespace padding** — pad usernames with spaces since trimming inconsistencies split one account into many counters.
0344. **Lockout-as-DoS test** — deliberately lock victim accounts because lockout mechanisms become account-denial weapons.
0345. **Lockout unlock via password reset** — reset a locked account's password since reset flows sometimes clear lockout state for attackers.
0346. **Username enumeration via login errors** — diff "invalid user" vs "wrong password" messages because distinct errors confirm account existence.
0347. **Enumeration via response length** — compare byte lengths of failure responses since templating differences leak user existence.
0348. **Enumeration via status codes** — map 200/401/404 across login attempts because code differences are the simplest oracle.
0349. **Enumeration via timing** — measure bcrypt-hash comparison delays since existing users trigger measurably slower responses.
0350. **Enumeration via password-reset responses** — diff reset-request replies because "email sent" vs "no account" confirms addresses.
0351. **Enumeration via registration conflicts** — test signup with candidate emails since "already registered" confirms accounts.
0352. **Enumeration via newsletter subscribe** — submit emails to newsletter forms because duplicate messages reveal registered users.
0353. **Enumeration via invitation flow** — invite candidate emails since "already a member" responses enumerate the user base.
0354. **Enumeration via resend-verification** — request verification re-sends because the response differs for existing vs unknown emails.
0355. **Enumeration via rate-limit messages** — trigger "too many attempts for this user" since per-user throttling only fires for real accounts.
0356. **Enumeration via identifier-first flow** — submit usernames to identifier-first logins because the next-step UI differs for existing users.
0357. **Identifier-first next-step differential** — analyze whether a password field renders since conditional rendering is a reliable oracle.
0358. **Enumeration via GraphQL login errors** — compare GraphQL error extensions because structured errors leak existence distinctly.
0359. **Enumeration via WebSocket close codes** — test auth over sockets since close-code differences reveal valid usernames.
0360. **Enumeration via gRPC status codes** — call login RPCs with candidate users because NOT_FOUND vs UNAUTHENTICATED splits the oracle.
0361. **Enumeration via profile-picture oracle** — check default vs custom avatars since avatar presence correlates with real accounts.
0362. **Enumeration via check-availability** — use username-availability endpoints because availability APIs are built to answer existence questions.
0363. **Password-reset token entropy analysis** — measure token length, charset and randomness since low-entropy tokens are guessable.
0364. **Reset-token predictability test** — check for sequential or timestamp-derived tokens because predictable tokens enable account takeover.
0365. **Reset-token expiry measurement** — time token validity windows since overlong windows extend the attacker's opportunity.
0366. **Reset-token single-use verification** — reuse a consumed token because non-single-use tokens survive interception.
0367. **Reset-token user-binding check** — try a token against a different account since unbound tokens reset arbitrary accounts.
0368. **Reset flow email-change race** — change the account email mid-reset because binding gaps let attackers redirect reset completion.
0369. **Reset-token replay after password change** — reuse old tokens post-change since stale tokens should die with the old credential.
0370. **Reset for nonexistent account** — request resets for unknown emails because the flow's behavior leaks enumeration data.
0371. **Reset-link Host-header poisoning** — send evil Host headers in reset requests since poisoned links send tokens to attacker domains.
0372. **Reset-link X-Forwarded-Host poisoning** — spoof forwarded hosts because apps building links from this header are equally poisonable.
0373. **Double Host-header confusion** — send conflicting Host headers since parsing differences pick the attacker value.
0374. **Absolute-URI vs Host confusion** — put the attacker host in the request line because some stacks prefer absolute-URI over Host.
0375. **Reset-token Referer leakage** — load third-party assets on the reset-landing page since Referer headers carry the token to outsiders.
0376. **Reset token in server logs** — trigger verbose errors on reset URLs because logged tokens are recoverable from log leaks.
0377. **Reset token in browser history** — check GET-based reset links since URL tokens persist in history and shared machines.
0378. **Reset over HTTP downgrade** — request reset links via http:// because downgraded links expose tokens on the wire.
0379. **Reset email snippet leakage** — inspect email preview text since clients and filters expose token prefixes.
0380. **MFA fatigue push-bombing test** — send repeated push approvals because users eventually approve out of annoyance.
0381. **Push without number-matching** — check whether pushes show context since contextless pushes are one tap from approval.
0382. **Push without app-context** — verify push content detail because bare "approve?" pushes enable social-engineering approval.
0383. **MFA enrollment bypass** — skip enrollment during signup flows since optional enrollment leaves accounts single-factor.
0384. **MFA re-enrollment attack** — enroll a new device on a compromised session because re-enrollment without step-up hands attackers MFA.
0385. **MFA disable without re-auth** — disable MFA with session alone since missing step-up makes session theft fully sufficient.
0386. **Backup-code entropy analysis** — measure code length and charset because short backup codes are brute-forceable.
0387. **Backup-code brute-force test** — attempt code guessing within rate limits since 8-digit numeric codes fall to distributed guessing.
0388. **Backup-code reuse check** — reuse a consumed backup code because single-use enforcement is often missing.
0389. **Backup-code invalidation on regenerate** — regenerate codes and test old ones since stale codes should die immediately.
0390. **TOTP seed QR leakage** — inspect HTML and API responses for otpauth:// URIs because leaked seeds let attackers clone TOTP.
0391. **TOTP seed in provisioning API** — check enrollment responses since APIs sometimes return the seed alongside the QR.
0392. **TOTP time-window tolerance abuse** — test how many 30s steps are accepted because wide windows multiply replay opportunity.
0393. **TOTP replay within window** — reuse a valid code since window-replay acceptance enables interception attacks.
0394. **TOTP enrollment without verification** — complete enrollment without entering a code because unverified enrollment lets attackers set known seeds.
0395. **TOTP seed re-display** — revisit enrollment pages since re-displayed seeds extend the exfiltration window.
0396. **SMS OTP brute-force** — guess 4–6 digit codes because short numeric OTPs are enumerable under weak rate limits.
0397. **SMS OTP rate-limit bypass** — rotate IPs and endpoints on verify calls since per-IP limits miss distributed guessing.
0398. **SMS OTP predictability** — look for sequential OTPs because counter-based codes are trivially predictable.
0399. **OTP reuse test** — replay consumed OTPs since missing single-use checks enable interception replay.
0400. **OTP resend counter reset** — resend then retry because resend flows often reset attempt counters.
0401. **OTP resend rate-limit gap** — hammer resend endpoints since unlimited resends enable SMS-bombing cost attacks.
0402. **SMS pumping via resend** — resend to premium numbers because toll-fraud via OTP resends costs victims real money.
0403. **OTP delivery-number tampering** — change the destination number parameter since unbound resends route codes to attackers.
0404. **Voice-call OTP fallback weakness** — test voice fallback because voice OTP often has weaker rate limiting than SMS.
0405. **Email OTP entropy analysis** — measure emailed code strength since email OTPs are frequently shorter than SMS ones.
0406. **OTP in push-notification preview** — check lock-screen previews because previewed codes are shoulder-surfable.
0407. **Session fixation test** — log in with a pre-set session ID since non-rotating sessions let attackers plant victim sessions.
0408. **Session ID in URL** — check for PHPSESSID-style URL sessions because URL sessions leak via Referer and sharing.
0409. **Session rotation on login** — compare pre/post-login session IDs since missing rotation is the classic fixation flaw.
0410. **Session rotation on privilege change** — escalate then compare IDs because privilege changes should rotate identifiers.
0411. **Session puzzling test** — mix session variables across flows since variable confusion can elevate privileges.
0412. **Concurrent-session limit test** — open many sessions because missing limits enable undetectable session farming.
0413. **Session-limit bypass** — exceed stated limits since enforcement is often cosmetic.
0414. **Remember-me token entropy** — analyze persistent-cookie randomness because weak remember-me tokens are forgeable.
0415. **Remember-me token expiry** — check for never-expiring tokens since immortal tokens are permanent backdoors.
0416. **Remember-me predictability** — look for user-ID-derived tokens because deterministic tokens are computable.
0417. **Remember-me invalidation on password change** — change passwords and retest tokens since surviving tokens defeat the reset.
0418. **Remember-me theft surface** — check HttpOnly and Secure flags since script-readable persistent cookies are stealable via XSS.
0419. **Session-ID entropy analysis** — measure session identifier randomness because low-entropy IDs are guessable.
0420. **Session ID in Referer leakage** — browse with URL sessions and inspect Referers since outbound links leak session IDs.
0421. **Multiple session-cookie precedence** — send conflicting session cookies because precedence bugs let attackers choose the weaker session.
0422. **Cookie name-confusion test** — try similarly-named cookies since name collisions can swap sessions.
0423. **Cookie tossing from subdomain** — set parent-domain cookies from a subdomain because tossed cookies can overwrite victim sessions.
0424. **Cookie-jar overflow test** — stuff browsers with cookies until eviction since overflow can drop security cookies like __Host-session.
0425. **__Host- prefix bypass** — test __Host- cookie requirements because missing enforcement allows subdomain cookie injection.
0426. **__Secure- prefix enforcement** — verify Secure-only acceptance since unenforced prefixes allow HTTP cookie injection.
0427. **SameSite=None without Secure** — flag cross-site cookies missing Secure because browsers reject them, breaking auth in detectable ways.
0428. **Over-broad cookie domain** — check for .example.com scoping since parent-domain cookies expose sessions to all subdomains.
0429. **Cookie path-scoping gaps** — test path-restricted cookies because mis-scoped paths leak cookies to unrelated apps.
0430. **Logout invalidation verification** — use tokens after logout since surviving sessions make logout theater.
0431. **Logout CSRF-adjacent state test** — verify logout actually clears server state because client-only logout leaves sessions live.
0432. **Sign-out-all-devices verification** — trigger global logout and retest every session since partial invalidation leaves backdoors.
0433. **Session list accuracy** — compare displayed sessions against real ones because hidden sessions evade user revocation.
0434. **Individual session revocation** — revoke one session and test others since broken revocation keeps attacker sessions alive.
0435. **Idle-timeout measurement** — idle until expiry to measure timeouts because overlong idle windows extend stolen-session utility.
0436. **Absolute-timeout measurement** — stay active past absolute limits since missing absolute timeouts grant indefinite sessions.
0437. **Sliding-expiration abuse** — keep sessions alive indefinitely because pure sliding expiration never forces re-auth.
0438. **Server-side timeout enforcement** — test whether expiry is client-only since client-enforced timeouts are trivially bypassed.
0439. **Login CSRF test** — forge cross-site login requests because login CSRF plants attacker sessions on victims.
0440. **Password-change CSRF test** — forge password changes since missing tokens let attackers rotate victim passwords.
0441. **Email-change CSRF test** — forge email updates because email takeover starts account takeover.
0442. **MFA-disable CSRF test** — forge MFA removal since CSRF-driven MFA removal collapses account security.
0443. **Referer validation on auth endpoints** — test state-changing auth calls because weak Referer checks are bypassable.
0444. **Origin-validation logic flaws** — fuzz Origin values on auth APIs since flawed validation enables cross-origin attacks.
0445. **Passkey downgrade test** — check for password fallback alongside WebAuthn because fallback options negate phishing resistance.
0446. **WebAuthn origin-validation bypass** — register with spoofed origins since lax origin checks enable relay attacks.
0447. **WebAuthn rpId subdomain confusion** — test subdomain rpIds because mis-scoped rpIds let sibling subdomains authenticate.
0448. **WebAuthn user-verification bypass** — check uv=discouraged acceptance since skipped verification removes biometric assurance.
0449. **WebAuthn exclusion-list bypass** — re-register existing credentials because ignored exclusion lists enable credential confusion.
0450. **WebAuthn attestation verification** — inspect attestation checks since unverified attestation accepts rogue authenticators.
0451. **WebAuthn clone-detection gap** — test counter handling because missing clone detection hides credential duplication.
0452. **Conditional-mediation confusion** — test autofill passkey flows since mediation bugs can select attacker credentials.
0453. **Passkey sync across devices** — evaluate synced passkeys because cloud-synced keys widen the compromise surface.
0454. **Shared-device biometric fallback** — test kiosk scenarios since shared devices with weak PIN fallback undermine biometrics.
0455. **Magic-link entropy analysis** — measure link token strength because emailed links are bearer credentials.
0456. **Magic-link replay test** — reuse consumed links since non-single-use links survive inbox compromise.
0457. **Magic-link expiry measurement** — time link validity because overlong windows aid interception.
0458. **Magic-link device binding** — use links from different IPs/devices since unbound links are fully portable.
0459. **Magic-link email-scanner prefetch** — check whether scanner clicks consume links because prefetched links break login for real users.
0460. **Magic-link plus password coexistence** — test both active simultaneously since dual methods add downgrade paths.
0461. **Social-login account-linking confusion** — link providers with mismatched emails because confused linking merges attacker and victim accounts.
0462. **Social-login unverified-email takeover** — register with a victim's unverified email at the provider since unverified emails enable pre-hijacking.
0463. **Cross-provider email collision** — link two providers sharing one email because collision handling can grant the wrong account.
0464. **SSO button enumeration** — probe which IdPs appear per user since per-user IdP lists enumerate enterprise customers.
0465. **Home-realm-discovery leakage** — fuzz HRD endpoints because realm responses disclose tenant mappings.
0466. **Login-hint parameter leak** — test login_hint reflection since hints can confirm account existence.
0467. **Account-chooser info leak** — inspect chooser responses because choosers enumerate previous sessions.
0468. **Brute-force via IP rotation** — distribute guesses across IPs since per-IP limits miss distributed attacks.
0469. **Brute-force via X-Forwarded-For spoofing** — spoof forwarded IPs because naive limiters trust the header.
0470. **Brute-force via endpoint variants** — cycle /login, /api/login and /v2/login since variant endpoints often have separate counters.
0471. **Brute-force via username variants** — alternate case and padding because variant keys split attempt counters.
0472. **Brute-force via parameter pollution** — send password as arrays since polluted params can bypass attempt counting.
0473. **Legacy-endpoint brute force** — attack old login paths because legacy endpoints frequently lack modern throttling.
0474. **GraphQL login batching brute force** — batch login mutations since batching multiplies guesses per request.
0475. **WebSocket auth brute force** — guess over socket handshakes because socket auth often skips HTTP rate limits.
0476. **gRPC login brute force** — hammer login RPCs since RPC endpoints may lack throttling entirely.
0477. **API-version login differential** — compare v1 vs v2 login because old versions skip MFA and CAPTCHA.
0478. **Mobile-API login differential** — test mobile login paths since mobile APIs often enforce weaker checks.
0479. **GET-login credential exposure** — try credentials in query strings because GET logins leak into logs and history.
0480. **Credentials in Referer from login** — inspect outbound Referers after login since form pages can leak credentials.
0481. **Low-and-slow spray scheduler** — randomize timing and order because stealthy sprays evade velocity detection.
0482. **Lockout-aware spray ordering** — schedule attempts around measured thresholds since threshold-aware spraying never trips lockout.
0483. **Distributed spray timing** — coordinate multi-source sprays because distributed patterns defeat IP-based detection.
0484. **Honeypot-account detection** — watch for canary responses since honeypot accounts alert defenders to spray campaigns.
0485. **Progressive-delay mapping** — measure growing login delays because delay curves reveal throttling algorithms.
0486. **Velocity-check evasion test** — vary attempt velocity since velocity thresholds define detectable attack shapes.
0487. **CAPTCHA backend-validation check** — submit logins without CAPTCHA tokens because missing server-side validation nullifies CAPTCHAs.
0488. **CAPTCHA token replay** — reuse solved tokens since non-single-use tokens are solvable once, usable forever.
0489. **CAPTCHA bypass via direct API** — call the underlying API endpoint because CAPTCHAs often guard only the HTML form.
0490. **CAPTCHA token prediction** — analyze token formats since predictable tokens are forgeable.
0491. **Password-policy weakness map** — test minimum lengths and complexity because weak policies permit guessable passwords.
0492. **Password-change without old password** — change passwords session-only since missing re-auth lets session thieves persist.
0493. **Password reuse allowed** — cycle through history because unenforced history permits immediate reuse.
0494. **Password-history enforcement gap** — test history depth since shallow history is trivially cycled.
0495. **Step-up auth gap on sensitive actions** — change email and disable MFA session-only because missing step-up makes sessions omnipotent.
0496. **Step-up bypass via API version** — repeat sensitive actions on v1 because old versions skip step-up checks.
0497. **Re-authentication timeout length** — measure step-up validity windows since overlong windows defeat the purpose.
0498. **New-device challenge gap** — log in from fresh fingerprints because missing device challenges aid credential stuffing.
0499. **Impossible-travel detection test** — log in from distant geos rapidly since missing detection aids stolen-credential use.
0500. **VPN and Tor challenge policy** — test anonymized logins because unchallenged anonymized access aids attackers.
0501. **Breached-password check gap** — try known-breached passwords since missing breach screening permits the weakest credentials.
0502. **Username-as-password allowed** — test identical pairs because username-password equality is trivially guessable.
0503. **Password truncation test** — submit overlong passwords since silent truncation shrinks the effective keyspace.
0504. **Null-byte password handling** — inject null bytes because C-style truncation can cut passwords short.
0505. **Unicode normalization confusion** — try é vs e+combining forms since normalization mismatches create equivalent-password collisions.
0506. **Case-insensitive password compare** — test Password vs password because case folding halves brute-force difficulty.
0507. **Whitespace trimming differential** — pad passwords with spaces since inconsistent trimming creates multiple valid forms.
0508. **Empty-password acceptance** — submit blank passwords because missing checks sometimes accept empty credentials.
0509. **Bcrypt max-length DoS** — send megabyte passwords since expensive hashing on huge inputs enables CPU exhaustion.
0510. **Username normalization confusion** — test case and unicode variants because normalization splits one identity into many.
0511. **Email plus-addressing duplication** — register user+tag variants since plus aliases create duplicate accounts for one inbox.
0512. **Gmail dot-insensitivity duplicates** — register dotted variants because dot-ignored duplicates bypass per-email limits.
0513. **Case-variant duplicate accounts** — register USER vs user since case-sensitive uniqueness creates shadow accounts.
0514. **Email-change without verification** — change emails without confirmation because unverified changes enable takeover.
0515. **Email-change without password** — change emails session-only since missing re-auth lets session thieves redirect recovery.
0516. **Old-email notification gap** — change emails and watch for alerts since silent changes hide takeovers from victims.
0517. **Phone-change without verification** — change numbers without OTP because unverified numbers hijack SMS recovery.
0518. **Account-deletion without re-auth** — delete accounts session-only since missing step-up enables destructive session abuse.
0519. **Registration email-verification bypass** — skip verification steps because bypassable verification enables fake accounts.
0520. **Registration token entropy** — measure verification-token strength since weak tokens are guessable.
0521. **Registration link Host poisoning** — poison Host on signup because poisoned verification links leak to attackers.
0522. **Account pre-hijacking** — register victims' emails before they do since pre-created accounts with attacker passwords enable takeover.
0523. **Unverified-account squatting** — squat high-value emails unverified because squatted accounts block legitimate registration.
0524. **Invite-token entropy analysis** — measure invite token strength since weak invites are enumerable.
0525. **Invite-token reuse** — accept invites twice because reusable invites spread unauthorized access.
0526. **Invite-only bypass** — reach registration without invites since bypassable gates are decorative.
0527. **Invite-code brute force** — guess short invite codes because low-entropy codes are enumerable.
0528. **Beta-access code brute force** — guess beta codes since beta gates are often trivially guessable.
0529. **Waitlist bypass test** — skip waitlist flows because client-side waitlists rarely enforce server-side.
0530. **Early-access token sharing** — share single-use tokens because unbound tokens spread access.
0531. **Plus-addressing account-takeover chain** — combine plus aliases with reset flows since alias confusion can route resets to attackers.
0532. **Dormant-account takeover** — reset passwords on ancient accounts because dormant accounts lack monitoring.
0533. **Expired-domain email takeover** — re-register expired domains used for accounts since domain re-registration captures reset emails.
0534. **Deactivation-reactivation token reuse** — reactivate with old tokens because stale reactivation links are bearer credentials.
0535. **Reactivation-link entropy** — measure reactivation token strength since weak links are guessable.
0536. **Username-change collision** — change usernames to taken ones because collision handling can merge or hijack accounts.
0537. **Profile-update enumeration** — use availability checks on profile edits since update flows double as oracles.
0538. **Duplicate-account merge confusion** — merge duplicate accounts because merge logic can combine attacker and victim data.
0539. **Password-reset security-question gate** — test question-based resets since guessable questions are weak gates.
0540. **Security-question brute force** — guess answers like pet names because KBA answers are low-entropy and researchable.
0541. **KBA bypass via direct endpoint** — call reset APIs skipping questions since question gates are often client-side.
0542. **Security-question answer enumeration** — probe answer-check responses because per-attempt feedback enables guessing.
0543. **Recovery via SMS only** — test SMS-only recovery since single-channel recovery is SIM-swap adjacent.
0544. **SIM-swap detection gap** — change SIMs without challenge because missing carrier-change detection aids number takeover.
0545. **Backup-email takeover chain** — compromise backup emails because backup channels inherit the primary's trust.
0546. **Recovery-phone change flow** — change recovery numbers weakly since weak change flows redirect all future recovery.
0547. **Recovery-code insecure channel** — check delivery channels because codes sent over insecure channels are interceptable.
0548. **Passwordless SMS fallback** — trigger SMS fallback on push failure since fallbacks are usually the weakest link.
0549. **TOTP enrollment secret re-display** — revisit setup pages because re-displayed secrets extend exposure.
0550. **QR code wrong-user rendering** — test session confusion on QR pages since cross-user QRs enroll attacker devices.
0551. **Provisioning-URI leakage** — search responses for otpauth:// because leaked URIs clone MFA instantly.
0552. **MFA remember-device token entropy** — analyze trusted-device cookies because weak device tokens bypass MFA persistently.
0553. **Trusted-device binding gap** — move device cookies across machines since unbound device flags are portable.
0554. **Device-ID parameter tampering** — forge device identifiers because tamperable IDs fake trusted devices.
0555. **Remember-device forgery** — craft device cookies from scratch since predictable formats are forgeable.
0556. **Email-change requires only password** — test step-up on email change because password-only changes miss MFA assurance.
0557. **API-token generation without MFA** — mint tokens session-only since token issuance without step-up creates persistent backdoors.
0558. **Personal-token scope mapping** — enumerate token scopes because over-scoped tokens exceed their purpose.
0559. **Impersonation feature abuse** — test login-as flows since impersonation without audit enables invisible access.
0560. **Support-impersonation audit gap** — check audit trails because unaudited impersonation hides attacker activity.
0561. **Login-as token predictability** — analyze impersonation token formats since predictable tokens are forgeable.
0562. **Team-invite token URL leakage** — inspect invite URLs because tokenized URLs leak via Referer and sharing.
0563. **Invitation accept without auth** — accept invites unauthenticated since token-only acceptance is bearer auth.
0564. **Invitation meant-for-other-email** — accept invites issued to different emails because unbound invites are transferable.
0565. **Post-login redirect tampering** — mutate next parameters since open redirects after login enable phishing.
0566. **Logout redirect open redirect** — test logout next params because logout redirects are rarely validated.
0567. **Registration redirect validation** — fuzz post-signup redirects since signup flows skip redirect validation.
0568. **Continue-URL double-encoding bypass** — encode redirect URLs twice because double decoding defeats allowlists.
0569. **Cached login-response test** — check Cache-Control on auth responses since cached authenticated pages leak via shared caches.
0570. **Back-button session resurrection** — test history navigation after logout because cached pages can resurrect sessions.
0571. **BFCache authenticated content** — test back-forward cache since BFCache can restore authenticated DOM post-logout.
0572. **Service-worker auth caching** — inspect worker caches because workers can serve stale authenticated responses.
0573. **CDN-cached login API** — test CDN behavior on auth endpoints since cached login responses leak credentials-adjacent data.
0574. **Vary-header gap on auth** — check Vary on authenticated responses because missing Vary poisons shared caches.
0575. **Token-compare timing attack** — measure reset-token comparison timing since non-constant-time compare leaks token bytes.
0576. **OTP-compare timing attack** — time OTP verification because timing leaks enable digit-by-digit recovery.
0577. **Autocomplete on password fields** — check autocomplete=off because stored passwords on shared machines are recoverable.
0578. **Session binding to IP** — test strict vs loose IP binding since unbound sessions are fully portable.
0579. **Session binding to User-Agent** — test UA binding because unbound sessions survive theft trivially.
0580. **Session binding to TLS fingerprint** — test JA3 binding since fingerprint-bound sessions resist replay.
0581. **Mutual-TLS client-cert bypass** — test optional client certs because password fallbacks negate mTLS assurance.
0582. **Client-cert optional fallback** — check fallback paths since fallback to passwords invites downgrade.
0583. **LDAP bind TLS enforcement** — verify StartTLS/LDAPS requirements because cleartext binds expose credentials.
0584. **SCIM deprovisioning lag** — test terminated-employee access persistence because slow deprovisioning leaves leaver sessions valid.
0585. **SCIM terminated-session persistence** — check sessions after deprovision since identity removal often misses active sessions.
0586. **Guest-account default credentials** — try guest/guest and demo pairs because guest accounts ship with documented defaults.
0587. **Default admin credentials** — test admin/admin on panels because default credentials remain the most common initial-access vector.
0588. **Setup-wizard re-access** — revisit /setup after install because re-accessible wizards allow reconfiguration.
0589. **API-key self-registration abuse** — automate free-tier key issuance since self-serve keys enable anonymous large-scale abuse.
0590. **Key-revocation propagation delay** — measure revoked-key death time because slow propagation leaves revoked keys usable.
0591. **Old-key validity after rotation** — test pre-rotation keys because overlapping validity windows extend compromise.
0592. **Compromised-key canary detection** — plant canary keys because canary hits reveal attacker tooling and timing.
0593. **Token storage audit** — map localStorage vs cookie vs memory storage since storage choice determines XSS theft viability.
0594. **Session token in localStorage** — flag localStorage tokens because any XSS becomes full session theft.
0595. **Auth-log tampering check** — test login-history integrity since editable logs hide attacker access.
0596. **Login-history accuracy** — compare history against actual logins because gaps reveal unlogged access paths.
0597. **Unknown-session visibility** — check whether all sessions display since hidden sessions evade user detection.
0598. **Concurrent cross-country logins** — test geo-velocity because missing checks aid credential-stuffing campaigns.
0599. **Biometric fallback PIN brute force** — guess 4-digit fallback PINs because weak PINs negate biometric assurance.
0600. **PIN rate-limit mapping** — measure PIN attempt limits since weak limits make short PINs enumerable.
0601. **Kiosk-mode session cleanup** — test shared-terminal logout because residual sessions on kiosks are trivially hijacked.
0602. **Shared-computer account switcher** — test "not you?" flows since switcher bugs can land in others' sessions.
0603. **Auth API verbose errors** — trigger login 500s because verbose errors leak stack traces and query logic.
0604. **Login timing oracle for bcrypt** — compare existing vs unknown users because hash-comparison timing is a precise oracle.
0605. **Password-reset token in email subject** — inspect subjects and snippets because clients expose subjects to filters and previews.
0606. **Reset-link prefetch by scanners** — test link scanners since prefetching consumes single-use tokens before users click.
0607. **Magic-link scanner consumption** — verify scanner behavior on magic links because consumed links lock out legitimate users.
0608. **Email-change verification bypass** — skip confirmation clicks because bypassable verification enables silent takeover.
0609. **Phone verification bypass** — skip OTP on phone change since bypasses redirect all SMS recovery.
0610. **TOTP window-replay acceptance** — replay codes within tolerance because accepted replays enable interception attacks.
0611. **TOTP shared across devices** — check per-device secrets since shared seeds mean one compromise clones all.
0612. **Push-approval context detail** — measure push information richness because contextless pushes are socially engineerable.
0613. **Number-matching bypass** — test whether matching is enforced since unenforced matching reduces to one-tap approval.
0614. **MFA method-downgrade** — switch from WebAuthn to SMS mid-flow because downgrade paths are the weakest available.
0615. **MFA method enumeration** — list available methods per user since method lists aid targeted downgrade.
0616. **Recovery-method enumeration** — enumerate recovery options because recovery methods are softer targets than primary MFA.
0617. **Account-recovery social path** — test support-assisted recovery because human recovery paths bypass technical controls.
0618. **Recovery-question guessability ranking** — rank KBA questions by entropy since "mother's maiden name" is researchable.
0619. **Document-based verification bypass** — test ID-upload flows because weak document checks are forgeable.
0620. **Video-selfie liveness gap** — test liveness checks since photo-of-photo attacks defeat naive liveness.
0621. **Recovery-link entropy** — measure account-recovery token strength because recovery links are master keys.
0622. **Recovery-link expiry** — time recovery validity since overlong recovery windows aid interception.
0623. **Recovery-link single-use** — reuse recovery links because reusable links survive compromise.
0624. **Stale recovery-session handling** — test old recovery sessions since stale sessions can be resumed by attackers.
0625. **Cross-device recovery binding** — start recovery on one device, finish on another because unbound recovery is portable.
0626. **New-email recovery hijack** — add attacker emails as recovery because recovery-email addition is account-takeover priming.
0627. **Recovery-email verification gap** — skip verification on recovery emails since unverified recovery channels are attacker-controlled.
0628. **Trusted-contact recovery abuse** — test social-recovery flows because trusted-contact mechanisms are manipulable.
0629. **Break-glass account discovery** — hunt emergency-access accounts since break-glass accounts bypass standard controls.
0630. **Break-glass credential strength** — test emergency passwords because break-glass credentials are often weak and shared.
0631. **Service-account password rotation** — check rotation practices since static service passwords are long-lived targets.
0632. **Service-account MFA exemption** — verify exemptions because exempt accounts become high-value targets.
0633. **Machine-account brute force** — target non-human accounts since machine accounts often lack lockout.
0634. **API-only user enumeration** — enumerate via API-specific errors because API users have distinct error paths.
0635. **Sub-account takeover via parent** — compromise parent accounts because parent access often implies child access.
0636. **Child-account privilege inheritance** — map inheritance rules since inheritance can escalate child to parent.
0637. **Organization invite-chain abuse** — chain invites across orgs because invite graphs can bridge trust boundaries.
0638. **Domain-claim account absorption** — claim email domains since domain claims can absorb existing accounts.
0639. **SSO JIT-provisioning confusion** — test just-in-time provisioning because JIT can create elevated accounts unexpectedly.
0640. **HR-system to IAM lag** — measure joiner/mover/leaver propagation since lag windows grant inappropriate access.
0641. **Contractor-account expiry** — check temporary account lifetimes because non-expiring contractor accounts persist.
0642. **Vendor-account review gap** — enumerate third-party accounts since vendor accounts escape regular review.
0643. **Shared-credential detection** — look for shared logins because shared credentials defeat attribution and MFA.
0644. **Password-vault integration gap** — check vault-managed rotation since unmanaged vaults hold stale credentials.
0645. **Credential-manager autofill abuse** — test autofill on phishing-adjacent flows because autofill can fill attacker pages.
0646. **Passkey autofill confusion** — test conditional mediation because autofill may select unintended credentials.
0647. **One-tap login abuse** — test one-tap prompts since one-tap reduces authentication to a single click.
0648. **Silent re-authentication** — test background re-auth because silent flows can refresh stolen sessions.
0649. **Refresh-token rotation** — verify rotation on use since non-rotating refresh tokens are long-lived bearer credentials.
0650. **Refresh-token reuse detection** — replay refresh tokens because missing reuse detection enables token theft.
0651. **Refresh-token binding** — test device binding since unbound refresh tokens are portable.
0652. **Refresh-token expiry** — measure refresh lifetimes because immortal refresh tokens defeat logout.
0653. **Refresh-token theft via XSS surface** — map storage of refresh tokens since stolen refresh means persistent access.
0654. **Session-cookie vs token precedence** — send both credential types because precedence bugs pick the weaker one.
0655. **Authorization-header injection** — test header smuggling since injected headers can override real credentials.
0656. **Proxy-auth header trust** — test X-Remote-User style headers because trusted proxy headers enable impersonation.
0657. **Pre-authenticated header abuse** — spoof SSO headers since apps trusting headers skip real authentication.
0658. **Client-certificate header spoof** — forge X-SSL-Client-Cert headers because header-based cert auth is spoofable.
0659. **IP-allowlist bypass via header** — spoof X-Forwarded-For past allowlists since header-trusting allowlists are decorative.
0660. **Admin-panel IP bypass** — test admin IP restrictions because bypassable restrictions expose admin auth.
0661. **VPN-only admin exposure** — check admin reachability because "internal-only" admins are often internet-facing.
0662. **Maintenance-token brute force** — guess maintenance bypass tokens since weak tokens unlock maintenance modes.
0663. **Preview-deployment auth gap** — test preview URLs because preview deploys often skip production auth.
0664. **Staging credential reuse** — try prod credentials on staging since shared credentials bridge environments.
0665. **Staging-to-prod session portability** — move staging sessions to prod because shared session stores bridge environments.
0666. **Environment parity auth diff** — diff auth across envs since weaker staging auth aids prod attacks.
0667. **Auth control-plane consistency** — verify authz/authn parity across regions because inconsistent regions are the weakest link.
## F. AuthZ attacks — IDOR/BOLA variants, privilege escalation paths
0668. **Numeric IDOR sweep** — increment and decrement object IDs across endpoints because sequential IDs make cross-user access trivial.
0669. **UUID IDOR via leakage** — harvest UUIDs from exports, emails and logs then replay them because unguessable IDs still leak.
0670. **GUID sequential analysis** — test GUIDs for time-based components since version-1 GUIDs are predictable.
0671. **ULID timestamp extraction** — decode ULID time prefixes because embedded timestamps enable targeted ID prediction.
0672. **ObjectId predictability test** — forge Mongo ObjectIds from timestamps since ObjectIds encode creation time and counters.
0673. **Hashid decode attempt** — decode obfuscated IDs with common salts because Hashids provide obscurity, not authorization.
0674. **Base64 ID tamper** — decode, mutate and re-encode IDs since encoded IDs usually lack integrity protection.
0675. **BOLA in nested order-items** — swap item IDs under others' orders because nested resources often skip parent-ownership checks.
0676. **BOLA in user-addresses** — access address IDs belonging to others since child collections rarely verify parent ownership.
0677. **BOLA in project-members** — enumerate member records across projects because membership endpoints trust the child ID alone.
0678. **BOLA in invoice line-items** — read line items of others' invoices since item-level checks are frequently absent.
0679. **BOLA in comment threads** — modify comments via thread-child IDs because threading logic often skips author verification.
0680. **IDOR via HTTP method change** — replay GET object fetches as POST/PUT/DELETE since method-specific handlers may skip authz.
0681. **IDOR via method-override header** — send X-HTTP-Method-Override variants because override routing can hit unprotected handlers.
0682. **IDOR in PDF export** — trigger exports for others' object IDs since export pipelines often bypass the UI's authz.
0683. **IDOR in CSV export** — request CSVs of foreign objects because bulk-export code paths duplicate logic without checks.
0684. **IDOR in async export jobs** — poll others' export job IDs since job-status endpoints rarely verify ownership.
0685. **Predictable export download URLs** — guess export file URLs because unguessable-looking URLs are often sequential.
0686. **IDOR in file download** — swap file IDs in download endpoints since direct object references are the classic IDOR.
0687. **IDOR in avatar overwrite** — upload avatars to others' profile IDs because media endpoints frequently skip ownership.
0688. **IDOR in document version history** — fetch versions of others' docs since history endpoints duplicate access logic poorly.
0689. **IDOR in trash restore** — restore others' deleted objects because soft-delete flows rarely check ownership.
0690. **IDOR in profile update** — PATCH others' profiles since update handlers often trust the path ID.
0691. **IDOR in notification settings** — modify others' preferences because settings endpoints key off mutable IDs.
0692. **IDOR in API-key management** — revoke or regenerate others' keys since key endpoints often miss ownership checks.
0693. **IDOR in webhook management** — delete others' webhooks because integration endpoints trust IDs alone.
0694. **IDOR in connected-apps** — revoke others' OAuth grants since grant endpoints rarely verify the grant owner.
0695. **IDOR in billing invoices** — fetch others' invoices because billing portals are notorious for missing authz.
0696. **IDOR in payment methods** — list others' cards since payment endpoints trust account IDs from requests.
0697. **IDOR in subscription changes** — modify others' plans because subscription handlers often skip tenant checks.
0698. **IDOR in payout accounts** — read others' bank details since payout endpoints are high-value IDOR targets.
0699. **IDOR in tax documents** — download others' tax forms because document endpoints key off predictable IDs.
0700. **IDOR in transaction history** — page others' transactions since history endpoints rarely scope by owner.
0701. **IDOR in support tickets** — read others' tickets because ticket IDs are sequential and support portals under-check.
0702. **IDOR in chat transcripts** — fetch others' support chats since chat history endpoints trust conversation IDs.
0703. **IDOR in call recordings** — download others' recordings because media URLs are often unauthenticated.
0704. **IDOR in voicemails** — play others' voicemails since telephony IDs are enumerable.
0705. **IDOR in SMS logs** — read others' message logs because logging endpoints skip per-record authz.
0706. **IDOR in direct messages** — read others' DMs since message endpoints are prime BOLA targets.
0707. **IDOR in comments edit** — edit others' comments because comment mutation often checks thread, not author.
0708. **IDOR in reviews and ratings** — modify others' reviews since review endpoints trust the review ID.
0709. **IDOR in votes and polls** — vote as others because voting endpoints rarely bind votes to sessions.
0710. **IDOR in likes and favorites** — act on others' behalf since social-action endpoints trust supplied user IDs.
0711. **IDOR in follow and block** — follow or block as another user because relationship endpoints take user IDs from bodies.
0712. **IDOR in cart access** — view and modify others' carts since cart IDs in cookies are swappable.
0713. **IDOR in wishlist** — read others' wishlists because wishlist endpoints lack ownership checks.
0714. **IDOR in order tracking** — track others' orders since tracking pages are designed to be shareable and under-protected.
0715. **IDOR in shipping-address change** — change others' addresses because address endpoints trust address IDs.
0716. **IDOR in refund requests** — file refunds on others' orders since refund flows key off order IDs.
0717. **IDOR in coupon access** — view others' coupons because promotion endpoints rarely scope by user.
0718. **IDOR in gift-card balances** — check others' balances since gift-card lookups are intentionally frictionless.
0719. **IDOR in loyalty points** — read and transfer others' points because loyalty ledgers trust account IDs.
0720. **IDOR in referral rewards** — claim others' rewards since referral endpoints key off guessable codes.
0721. **IDOR in wallet transactions** — inspect others' wallets because wallet endpoints are high-value and often IDOR-prone.
0722. **IDOR in KYC documents** — read others' identity documents since KYC portals handle the most sensitive files with simple IDs.
0723. **IDOR in verification status** — check others' verification because status endpoints leak onboarding state.
0724. **IDOR in 2FA settings of others** — disable victims' 2FA since settings endpoints that miss authz enable full takeover.
0725. **IDOR in email change** — change victims' emails because email-change endpoints with IDOR are account-takeover primitives.
0726. **IDOR in phone change** — change victims' numbers since phone endpoints with IDOR hijack SMS recovery.
0727. **IDOR in password change for others** — test admin password-reset endpoints exposed to non-admins because exposed reset is instant takeover.
0728. **IDOR in account deletion** — delete others' accounts since destructive endpoints with IDOR are catastrophic.
0729. **IDOR in account suspension** — suspend others because moderation endpoints exposed to users enable mass DoS.
0730. **IDOR in ban and unban** — ban arbitrary users since ban endpoints without role checks weaponize moderation.
0731. **IDOR in role assignment** — grant roles to arbitrary users because assignment endpoints are privilege-escalation gold.
0732. **IDOR in permission grants** — grant permissions directly since grant endpoints bypass role workflows.
0733. **IDOR in team-member removal** — remove others from teams because membership endpoints trust member IDs.
0734. **IDOR in team invitations** — invite users to others' teams since invite endpoints rarely verify inviter authority.
0735. **IDOR in team-ownership transfer** — transfer ownership of foreign teams because transfer endpoints with IDOR hand over organizations.
0736. **IDOR in organization settings** — modify others' org configs since org endpoints key off slugs or IDs.
0737. **IDOR in SSO configuration** — read or modify others' SSO because SSO config endpoints control authentication itself.
0738. **IDOR in domain verification** — verify others' domains since domain endpoints gate powerful features.
0739. **IDOR in DNS records** — view or modify others' DNS because DNS control enables full domain takeover.
0740. **IDOR in SSL certificates** — download others' private keys since cert endpoints with IDOR are critical.
0741. **IDOR in custom domains** — claim or remove others' domains because domain endpoints control routing.
0742. **IDOR in redirect rules** — modify others' redirects since redirect control enables phishing from victim domains.
0743. **IDOR in firewall rules** — change others' WAF settings because firewall endpoints with IDOR disable protections.
0744. **IDOR in IP allowlists** — edit others' allowlists since allowlist control determines access.
0745. **IDOR in rate-limit rules** — modify others' limits because limit control enables DoS or abuse.
0746. **IDOR in caching rules** — change others' cache configs since cache control aids deception attacks.
0747. **IDOR in edge-worker scripts** — modify others' workers because worker code runs with the victim's privileges.
0748. **IDOR in KV namespaces** — read others' key-value data since KV endpoints store secrets and sessions.
0749. **IDOR in queue access** — read others' queues because queues carry jobs with credentials.
0750. **IDOR in cron triggers** — modify others' schedules since cron control enables timed attacks.
0751. **IDOR in environment variables** — read others' env configs since env endpoints expose secrets directly.
0752. **IDOR in secrets manager** — fetch others' secrets because secret endpoints are the highest-value IDOR targets.
0753. **IDOR in deploy logs** — read others' build logs since logs contain tokens and credentials.
0754. **IDOR in build settings** — modify others' builds because build control enables supply-chain attacks.
0755. **IDOR in preview deployments** — access others' previews since preview URLs bypass production auth.
0756. **IDOR in production rollback** — roll back others' deploys because rollback control is destructive.
0757. **IDOR in git integrations** — disconnect others' repos since integration endpoints control code access.
0758. **IDOR in backup download** — download others' backups because backups contain full databases.
0759. **IDOR in backup restore** — restore over others' data since restore endpoints are destructive.
0760. **IDOR in import jobs** — import data into others' accounts because import endpoints write with victim privileges.
0761. **IDOR in analytics dashboards** — view others' metrics since analytics endpoints aggregate sensitive business data.
0762. **IDOR in saved reports** — open others' reports because report endpoints rarely re-check ownership.
0763. **IDOR in dashboard widgets** — read others' widgets since widget endpoints compose privileged data.
0764. **IDOR in saved searches** — view others' filters because search configs reveal business logic.
0765. **IDOR in audience lists** — download others' audiences since audience data is regulated PII.
0766. **IDOR in ad campaigns** — modify others' campaigns because ad endpoints control real spend.
0767. **IDOR in ad creatives** — change others' ads since creative control enables malvertising.
0768. **IDOR in conversion events** — read others' pixels because event data reveals business performance.
0769. **IDOR in attribution reports** — view others' attribution since reports contain revenue data.
0770. **IDOR in form submissions** — read others' leads because form endpoints collect PII at scale.
0771. **IDOR in survey responses** — read others' surveys since response endpoints aggregate private answers.
0772. **IDOR in job applications** — read others' applications because application portals hold resumes and PII.
0773. **IDOR in resumes and CVs** — download others' resumes since document endpoints are IDOR-prone.
0774. **IDOR in interview schedules** — view others' interviews because scheduling endpoints leak candidate data.
0775. **IDOR in offer letters** — read others' offers since offer endpoints contain compensation data.
0776. **IDOR in payroll records** — view others' salaries because payroll endpoints are the most sensitive HR targets.
0777. **IDOR in payslips** — download others' payslips since document IDs are predictable.
0778. **IDOR in expense reports** — approve own expenses because approval endpoints often skip approver checks.
0779. **IDOR in leave requests** — approve own leave since workflow endpoints trust requester IDs.
0780. **IDOR in performance reviews** — read others' reviews because review endpoints handle confidential evaluations.
0781. **IDOR in medical records** — read others' charts since patient portals are critical IDOR territory.
0782. **IDOR in prescriptions** — view others' prescriptions because health endpoints face strict regulatory scrutiny.
0783. **IDOR in lab results** — read others' results since result endpoints deliver life-impacting data.
0784. **IDOR in appointment booking** — cancel others' appointments because scheduling endpoints trust appointment IDs.
0785. **IDOR in insurance claims** — read others' claims since claim endpoints process financial and medical data.
0786. **IDOR in student records** — view others' grades because education portals are classic IDOR hunting grounds.
0787. **IDOR in exam submissions** — read others' exams since submission endpoints hold academic-integrity data.
0788. **IDOR in certificates** — download others' certificates because cert endpoints enable credential fraud.
0789. **IDOR in transcripts** — fetch others' transcripts since transcript endpoints contain full academic histories.
0790. **IDOR in legal documents** — read others' contracts because document endpoints handle privileged material.
0791. **IDOR in e-signatures** — sign as others since signature endpoints with IDOR forge legal consent.
0792. **IDOR in case files** — access others' cases because legal case endpoints are high-stakes IDOR targets.
0793. **IDOR in evidence uploads** — view others' evidence since evidence endpoints handle sensitive investigations.
0794. **IDOR in property listings** — edit others' listings because marketplace endpoints trust listing IDs.
0795. **IDOR in rental applications** — read others' applications since application endpoints collect financial PII.
0796. **IDOR in lease documents** — download others' leases because document endpoints leak addresses and terms.
0797. **IDOR in maintenance requests** — modify others' tickets since request endpoints skip tenant checks.
0798. **IDOR in vehicle records** — read others' service history because automotive portals store VIN-linked PII.
0799. **IDOR in warranty claims** — file claims on others' products since claim endpoints trust serial numbers.
0800. **IDOR in shipment tracking** — track others' parcels because tracking endpoints are designed shareable and under-protected.
0801. **IDOR in delivery instructions** — change others' instructions since delivery endpoints trust tracking IDs.
0802. **IDOR in returns initiation** — start returns for others because return flows key off order IDs.
0803. **IDOR in warehouse inventory** — view others' stock since inventory endpoints reveal business data.
0804. **IDOR in affiliate dashboards** — view others' earnings because affiliate endpoints aggregate commission data.
0805. **IDOR in creator payouts** — read others' payouts since payout endpoints handle real money.
0806. **IDOR in calendar events** — read others' events because calendar endpoints leak schedules and attendees.
0807. **IDOR in calendar sharing** — modify others' shares since sharing endpoints control visibility.
0808. **IDOR in document share links** — change others' link permissions because sharing endpoints with IDOR expose private docs.
0809. **IDOR in public-link disable** — disable others' links since link-management endpoints trust link IDs.
0810. **IDOR in embed codes** — fetch others' embeds because embed endpoints leak private content.
0811. **IDOR in tasks and todos** — read others' tasks since productivity endpoints are everyday IDOR targets.
0812. **IDOR in notes** — read others' notes because note endpoints store personal data with simple IDs.
0813. **IDOR in collaborative documents** — access others' docs since collab endpoints are complex and IDOR-prone.
0814. **IDOR in tags and labels** — modify others' tags because taxonomy endpoints rarely check ownership.
0815. **IDOR in custom fields** — read others' fields since field endpoints expose business schemas.
0816. **IDOR in templates** — use others' templates because template endpoints share across tenants loosely.
0817. **IDOR in drafts** — read others' drafts since draft endpoints are pre-publish and under-protected.
0818. **IDOR in scheduled content** — modify others' scheduled posts because scheduling endpoints trust content IDs.
0819. **IDOR in automations** — edit others' workflows since automation endpoints execute with owner privileges.
0820. **IDOR in alert rules** — modify others' alerts because alerting endpoints control notifications.
0821. **IDOR in monitoring checks** — change others' monitors since monitoring endpoints gate incident response.
0822. **IDOR in status-page subscribers** — manage others' subscriptions because subscriber endpoints leak customer lists.
0823. **IDOR in feature flags** — toggle others' flags since flag endpoints control rollouts.
0824. **IDOR in experiments** — modify others' tests because experiment endpoints affect production traffic.
0825. **IDOR in email templates** — edit others' templates since template endpoints enable phishing from victim brands.
0826. **IDOR in push subscriptions** — manage others' subscriptions because push endpoints control messaging.
0827. **IDOR in devices list** — view others' devices since device endpoints leak hardware fingerprints.
0828. **IDOR in session revocation** — revoke others' sessions because revocation endpoints with IDOR enable targeted DoS.
0829. **IDOR in login history** — view victims' IPs since history endpoints leak location data.
0830. **IDOR in audit-log export** — export others' audit trails because audit endpoints contain security-sensitive events.
0831. **IDOR in data-export requests** — download others' GDPR exports since export endpoints bundle entire accounts.
0832. **IDOR in consent records** — read others' consents because consent endpoints store regulatory data.
0833. **IDOR in notification preferences** — change others' preferences since preference endpoints trust user IDs.
0834. **IDOR in email-subscription management** — unsubscribe others since subscription endpoints trust email IDs.
0835. **BOLA in batch with mixed IDs** — submit batches mixing own and foreign IDs because batch handlers often check only the first item.
0836. **BOLA in GraphQL batched mutations** — batch mutations across users since GraphQL batching can skip per-mutation authz.
0837. **IDOR via ID array** — send ids[]=1,2,3 with foreign IDs because array endpoints often check none of the elements.
0838. **IDOR via comma-separated IDs** — try id=1,2,3 formats since CSV parsing paths duplicate authz poorly.
0839. **IDOR via wildcard ID** — try id=* since wildcard support can dump entire collections.
0840. **IDOR via negative IDs** — test id=-1 because negative IDs can wrap to privileged records.
0841. **IDOR via zero ID** — test id=0 since zero often maps to admin or first records.
0842. **IDOR via empty ID** — omit IDs entirely because missing IDs can default to privileged scopes.
0843. **IDOR via me-alias confusion** — mix /users/me with explicit IDs since alias resolution can confuse ownership checks.
0844. **Self-reference bypass** — send id=me alongside user_id=123 because dual identifiers let attackers pick the weaker check.
0845. **Nested-route authz gap** — compare /users/1/orders vs /orders?user_id=1 since equivalent routes often enforce differently.
0846. **Equivalent-endpoint authz differential** — test every alias of a resource because duplicates drift in protection over time.
0847. **Mobile-vs-web authz differential** — compare mobile and web APIs since mobile endpoints frequently enforce less.
0848. **v1-vs-v2 authz differential** — compare versions because old versions miss newer authorization fixes.
0849. **GraphQL-vs-REST authz differential** — test both interfaces since GraphQL resolvers often reimplement REST authz incompletely.
0850. **WebSocket-vs-REST authz differential** — compare socket and HTTP paths because socket handlers commonly skip checks.
0851. **Inconsistent authz error oracle** — study 403 vs 404 vs 200 patterns since inconsistent errors map the authorization matrix.
0852. **Forced browsing with parameter pollution** — combine forced paths with polluted params because pollution can satisfy naive path checks.
0853. **Search-endpoint object-level authz** — query search with foreign filters since search backends often skip per-hit authz.
0854. **Search filter by private fields** — filter on others' private attributes because filterable fields reveal schema and data.
0855. **Search sort oracle** — sort by hidden fields since sortable fields confirm column existence.
0856. **Search facet-count leakage** — read facet counts because aggregations leak existence of private records.
0857. **Cross-tenant search** — search across tenants since search indexes frequently ignore tenant boundaries.
0858. **Tenant enumeration via errors** — trigger tenant errors because error text distinguishes valid from invalid tenants.
0859. **Tenant enumeration via timing** — time tenant lookups since existing tenants resolve measurably faster.
0860. **Sequential tenant-ID enumeration** — iterate tenant IDs because sequential tenant identifiers are enumerable.
0861. **Tenant signup squatting** — try registering taken subdomains since squatting responses enumerate tenants.
0862. **X-Tenant-ID header swap** — swap tenant headers because header-based tenancy is trivially forgeable.
0863. **Tenant slug in path swap** — swap /t/acme/ slugs since path tenancy relies on user-supplied values.
0864. **Subdomain tenant swap** — request victim.tenant.example.com as attacker because subdomain tenancy trusts Host.
0865. **Tenant cookie swap** — modify tenant_id cookies since cookie tenancy is client-controlled.
0866. **Tenant query-param swap** — change ?tenant_id= values because param tenancy is the weakest form.
0867. **Default-tenant fallback** — omit tenant identifiers since missing-tenant fallbacks can expose all data.
0868. **Cross-tenant export** — export with swapped tenant IDs because export pipelines often miss tenant scoping.
0869. **Shared-resource confusion** — mix public and tenant resources since shared-resource logic leaks across boundaries.
0870. **Tenant onboarding race** — claim victim subdomains during signup because first-come tenancy enables squatting.
0871. **Role escalation via registration field** — submit role=admin at signup since registration mass-assignment is a classic privesc.
0872. **isAdmin mass assignment** — inject isAdmin flags because boolean privilege flags are the simplest escalation.
0873. **Plan and tier manipulation** — change plan fields since tier fields gate paid features.
0874. **Privilege field in profile PATCH** — patch role via /me because self-update endpoints often accept privilege fields.
0875. **Role in nested objects** — nest role inside profile objects since nested mass-assignment bypasses flat filters.
0876. **Permissions array injection** — submit permissions arrays because array-based grants bypass role workflows.
0877. **Type-field manipulation** — change type=user to admin since type fields drive authorization.
0878. **Group-membership manipulation** — add self to privileged groups because group endpoints trust member IDs.
0879. **Department field escalation** — change department values since department drives data access.
0880. **Invite-code tier escalation** — redeem admin-tier invite codes because tiered invites are guessable.
0881. **Trial-to-enterprise escalation** — activate enterprise features on trials since trial gates are often client-side.
0882. **Feature-flag self-enablement** — enable flags for own account because flag endpoints rarely verify eligibility.
0883. **Invitation role tampering** — modify role in invite acceptance since invite flows trust client-supplied roles.
0884. **Accept invite for other email** — accept invites issued elsewhere because unbound invites are transferable.
0885. **Invite-token role extraction** — decode invite tokens since tokens often embed the granted role.
0886. **Re-invite to escalate members** — re-invite existing members with higher roles because re-invites can overwrite roles.
0887. **Invite-expiry bypass** — use expired invites since expiry is often unenforced.
0888. **Mass assignment to privilege fields** — fuzz role, admin and permissions across endpoints because mass-assignment is systemic.
0889. **Query-param role injection** — try ?role=admin on GETs since some stacks bind query params to models.
0890. **Function-level hidden admin endpoints** — brute-force /admin paths because unlinked admin routes lack auth entirely.
0891. **Unlinked JS admin routes** — extract dead-code routes from bundles since shipped-but-unlinked admin UIs call live endpoints.
0892. **Robots-disallowed admin paths** — test Disallow entries because robots files point directly at hidden admin areas.
0893. **Method-gated admin actions** — test whether admin checks bind to methods since GET-accessible admin actions bypass POST guards.
0894. **Verb-tampering on admin** — swap POST to PUT on admin routes because verb-specific guards are bypassable.
0895. **Internal path enumeration** — brute-force /internal since internal prefixes are often routable externally.
0896. **Debug path enumeration** — probe /debug because debug routes ship with dangerous functionality.
0897. **GraphQL unlinked admin mutations** — introspect for admin mutations since schema-exposed mutations may lack UI links but stay callable.
0898. **JS dead-code route harvest** — parse unreachable code paths because dead code references live admin endpoints.
0899. **Admin panel without auth** — request admin UIs directly since some panels rely on obscurity alone.
0900. **Admin panel default-role access** — test low-priv users on admin panels because role checks are often missing.
0901. **Admin IP-allowlist header bypass** — spoof X-Forwarded-For past admin allowlists since header-trusting allowlists are decorative.
0902. **Admin via alternate hostname** — try admin on other hostnames because vhost-specific guards miss aliases.
0903. **Signed-URL signature strip** — remove signatures from signed URLs since some validators skip verification.
0904. **Signed-URL parameter injection** — append params after signing because naive validators ignore post-signature additions.
0905. **Signed-URL expiry tampering** — modify expiry fields since expiry is sometimes advisory.
0906. **Signed-URL IP-binding gap** — use signed URLs from other IPs because unbound URLs are shareable.
0907. **Signed-URL cross-resource reuse** — replay URLs against other resources since resource binding is often absent.
0908. **Presigned-POST policy tampering** — edit S3 POST policies because policy conditions are frequently loose.
0909. **Presigned-URL content-type swap** — change content types on presigned uploads since type confusion enables stored-XSS-adjacent abuse.
0910. **CDN signed-URL tampering** — mutate CDN signed URLs because CDN validators differ from origin validators.
0911. **CDN signed-cookie forgery** — analyze cookie formats since predictable signed cookies are forgeable.
0912. **GraphQL mutation IDOR** — run mutations on others' objects since mutation authz is the GraphQL IDOR frontier.
0913. **GraphQL nested-mutation BOLA** — nest mutations under foreign parents because nested resolvers skip ownership.
0914. **GraphQL field-level authz gap** — query sensitive fields on foreign objects since field resolvers often lack checks.
0915. **GraphQL __typename-gated fields** — probe type-conditional fields because gating logic varies by concrete type.
0916. **Introspection-revealed admin types** — catalog admin-only types from schemas since schema exposure guides targeted attacks.
0917. **WebSocket channel IDOR** — subscribe to others' channels since channel authz is frequently absent.
0918. **WebSocket publish as other user** — send messages with foreign sender IDs because message handlers trust client claims.
0919. **WebSocket arbitrary-room join** — join guessed rooms since room membership is rarely verified.
0920. **WebSocket admin-channel subscription** — subscribe to admin topics because topic names are guessable and unguarded.
0921. **WebSocket history of others** — request backlog for foreign channels since history endpoints skip authz.
0922. **Second-order automation privesc** — create automations that run as admin because low-priv users can plant high-priv execution.
0923. **Second-order webhook privesc** — register webhooks firing with service privileges since webhook contexts often exceed creator rights.
0924. **Second-order scheduled-job privesc** — schedule jobs running elevated because scheduler contexts inherit owner privileges loosely.
0925. **Second-order report privesc** — schedule reports emailed with others' data since report jobs run with broad access.
0926. **Second-order import privesc** — import data processed by privileged pipelines because import handlers run elevated.
0927. **Referer-based admin bypass** — omit or forge Referer since Referer-gated admin checks are trivially bypassed.
0928. **Origin-based check bypass** — send null Origin because null origins slip past naive allowlists.
0929. **Empty-Referer admin access** — test admin with no Referer since empty-Referer allowances are common.
0930. **Forced browsing to admin dashboard** — request /admin directly because forced browsing defeats link-hiding.
0931. **Backup-path admin access** — try /admin.bak and /old-admin since backup paths duplicate admin without guards.
0932. **Parameter-pollution precedence** — send id=1&id=2 because first-vs-last-wins determines which authz applies.
0933. **Array-vs-scalar pollution** — send id[]=1 vs id=1 since type confusion changes which check runs.
0934. **Privilege persistence after downgrade** — downgrade admin to user then retest because cached roles keep old privileges.
0935. **Role-cache staleness** — measure permission-cache TTLs since stale caches extend revoked privileges.
0936. **Downgraded API-key scopes** — test keys after role changes because keys often retain pre-downgrade scopes.
0937. **Downgraded session roles** — test sessions after demotion since sessions can carry stale roles.
0938. **Stale-permission token reuse** — reuse pre-downgrade tokens because token claims freeze privileges at issuance.
0939. **Support-ticket privesc via attachments** — attach files processed by privileged workers since worker contexts exceed requester rights.
0940. **Comment-mention privesc** — mention admins in comments because notification pipelines can trigger privileged actions.
0941. **Approval-workflow self-approval** — approve own requests since approver checks often miss self-approval.
0942. **Delegation-chain abuse** — chain delegations because transitive delegation can accumulate unintended rights.
0943. **Temporary-grant permanence** — test time-boxed grants after expiry since expiry enforcement is often missing.
0944. **Just-in-time grant abuse** — request JIT elevation repeatedly because JIT workflows can be socially or technically gamed.
0945. **Break-glass misuse** — trigger emergency access since break-glass paths bypass standard approval.
0946. **Service-account impersonation** — assume service identities because service accounts carry broad rights with weak auth.
0947. **API-key scope creep** — compare granted vs used scopes since over-scoped keys violate least privilege.
0948. **OAuth-scope over-grant** — request broad scopes (careful: mechanism-level, not token format) since users approve excessive scopes.
0949. **Scope-downgrade enforcement** — test reduced-scope requests because servers often ignore scope restrictions.
0950. **Horizontal privesc via shared IDs** — exploit shared or recycled IDs because ID reuse crosses user boundaries.
0951. **Vertical privesc via debug flags** — enable debug params because debug modes often disable authz.
0952. **Debug-flag privilege unlock** — test ?debug=1 on admin routes since debug flags can short-circuit checks.
0953. **Test-account privilege residue** — probe test accounts because test users frequently retain elevated fixtures.
0954. **Demo-mode restriction bypass** — escape demo sandboxes since demo restrictions are often client-side.
0955. **Read-only role write test** — attempt writes as viewer roles because read-only enforcement is frequently UI-deep.
0956. **Viewer-role export test** — export as viewers since export endpoints often miss role checks.
0957. **Guest-role enumeration** — map guest-accessible objects because guest scopes creep over time.
0958. **Anonymous-vs-authenticated differential** — diff responses with and without auth since gaps reveal missing checks.
0959. **Authenticated-vs-admin differential** — diff user and admin views because deltas map the privilege boundary.
0960. **Admin-vs-superadmin differential** — compare admin tiers since tier boundaries are inconsistently enforced.
0961. **Object-creation authz gap** — create objects in foreign scopes because creation endpoints often skip parent checks.
0962. **Object-clone authz gap** — clone others' objects since clone endpoints copy without ownership verification.
0963. **Object-transfer authz gap** — transfer objects between accounts because transfer endpoints trust supplied IDs.
0964. **Object-share authz gap** — share others' objects since sharing endpoints can expose private items.
0965. **Ownership-transfer hijack** — transfer ownership of foreign objects because transfer is account-takeover-adjacent.
0966. **Orphaned-object access** — access objects with deleted owners since orphan handling often defaults to open.
0967. **Soft-deleted object access** — read trashed objects of others because soft-delete filters are inconsistently applied.
0968. **Versioned-object authz drift** — test old versions of objects since version endpoints apply different checks.
0969. **Draft-vs-published authz** — access others' drafts because draft visibility controls are weaker.
0970. **Archived-object access** — read others' archives since archive endpoints are forgotten in authz reviews.
0971. **Pinned-featured manipulation** — pin others' content because curation endpoints lack ownership checks.
0972. **Moderation-action authz** — test approve/reject as non-moderators since moderation endpoints are high-value.
0973. **Content-takedown abuse** — report others' content maliciously because takedown flows can censor arbitrarily.
0974. **Appeal-process manipulation** — appeal others' cases since appeal endpoints trust case IDs.
0975. **Audit-log read authz** — read others' audit entries because audit visibility itself needs authorization.
0976. **Log-redaction bypass** — access unredacted logs since redaction is often presentation-layer only.
0977. **PII-field selective authz** — test per-field redaction because field-level rules vary by endpoint.
0978. **Masked-data unmasking** — request unmasked views since masking is frequently client-side.
0979. **Partial-response authz** — use sparse fieldsets to bypass because field filtering can dodge object-level checks.
0980. **Aggregation-endpoint authz** — query aggregates over others' data since aggregations skip row-level checks.
0981. **Stats-endpoint data leakage** — read stats because statistics reveal private distributions.
0982. **Leaderboard manipulation** — write to others' leaderboard entries since ranking endpoints trust score submissions.
0983. **Rating-aggregation poisoning** — submit ratings as others because aggregation inputs are weakly attributed.
0984. **Recommendation-engine probing** — infer others' behavior from recommendations since recommenders leak interaction history.
0985. **Activity-feed authz** — read others' feeds because feed endpoints aggregate private events.
0986. **Presence-status leakage** — check others' online status since presence is often over-shared.
0987. **Typing-indicator interception** — subscribe to others' typing events because realtime indicators leak activity.
0988. **Read-receipt manipulation** — mark others' messages read since receipt endpoints trust message IDs.
0989. **Delivery-status oracle** — use delivery receipts because receipts confirm account existence and activity.
0990. **Notification-content authz** — read others' notifications since notification endpoints bundle sensitive summaries.
0991. **Push-token hijack** — register push tokens for others because token endpoints enable notification interception.
0992. **Email-preference manipulation** — change others' email settings since preference endpoints trust user IDs.
0993. **Digest-content leakage** — read others' email digests because digest generation aggregates private data.
0994. **Weekly-report authz** — access others' reports since scheduled reports are generated with broad access.
0995. **Data-warehouse export authz** — test warehouse exports because bulk pipelines bypass application authz.
0996. **ETL-job data scope** — inspect ETL outputs since pipelines often lack tenant filtering.
0997. **Backup-snapshot authz** — access others' snapshots because snapshot endpoints are infrastructure-level.
0998. **Replication-lag exploitation** — read replicas during lag because replicas can serve pre-authz-check states.
0999. **Multi-region authz inconsistency** — compare regions because authz logic drifts between deployments.
1000. **AuthZ regression-test harness** — record every authz decision per endpoint across hunts so regressions surface automatically instead of being rediscovered manually.
