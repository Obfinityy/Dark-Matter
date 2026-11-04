# OAuth 2.0 / OIDC Redirect & Token Hygiene Probe

## What it is

OAuth 2.0 / OpenID Connect delegates login to an authorization server: the app
sends the user to `/oauth/authorize?...&client_id=...&redirect_uri=...&
response_type=code&state=...`, the server authenticates, then 302s back to
`redirect_uri` WITH the authorization code. Every security property of that
handoff is a server-side config decision — and every one is testable with
PREDEFINED authorization requests, no AI, no victim browser:

- `redirect_uri` must be allow-listed. If an attacker URI is accepted, the code
  / token goes to the attacker = account takeover (the classic OAuth
  redirect_uri open redirect).
- `state` must be required. Without it: login CSRF — attacker starts a login
  with THEIR account, victim completes it, victim ends up logged in as the
  attacker.
- `response_type=token` (implicit flow) puts tokens in the URL fragment —
  logged by proxies, leaked via Referer/history. Deprecated by OAuth 2.1 for
  exactly this reason.
- Public clients (SPAs, mobile apps) must enforce PKCE, or a network-position
  attacker can steal the code and redeem it.

## Detection surface

1. **OIDC discovery**: GET `/.well-known/openid-configuration` → JSON with
   `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `issuer`
   (INFO finding: endpoint enumeration; `issuer` ≠ page origin → MEDIUM note).
2. **Known auth paths** (max 6): `/oauth/authorize`, `/oauth2/authorize`,
   `/connect/authorize`, `/auth/authorize`, `/authorize`, `/oauth/authorize/` —
   a canary request that answers 3xx/4xx (not 404) = live endpoint.
3. **Passive bundle scan**: `client_id`, `redirect_uri`, `/oauth/authorize`,
   `/.well-known/openid-configuration`, "Login with Google/GitHub/…" buttons,
   `accounts.google.com`. (`SAMLRequest` hits are excluded — that's probe #31.)

**Safety:** authorization requests ONLY; per-run canary `state` + canary
redirect path; redirects are NEVER followed (`redirect: 'manual'` — the probe
reads the 302 Location header and stops). No code is exchanged, no token is
redeemed. Read-only by construction.

## Sub-tests

### T1. redirect_uri validation bypass — HIGH if confirmed (the account-takeover test)

- Baseline (differential anchor): request with the page's own registered
  redirect_uri → expect 302 (proves the endpoint is live; record the behavior).
- Evil variants (predefined, max 6): `https://evil.example/cb/<canary>`,
  `//evil.example/cb`, `https://evil.example.<target-apex>/`,
  `<registered-uri>/../<canary>`, `https://evil%2eexample/cb`,
  scheme-relative tricks. Each sent with `state=<canary>`,
  `response_type=code`, the discovered/canary client_id.
- **CANARY** (kills generic redirects): CONFIRMED HIGH ("redirect_uri
  validation bypass — authorization code/token deliverable to attacker") ONLY
  if a 302 Location points at evil.example AND echoes our canary state (or
  carries `code=`/`access_token=` to the evil host). A 302 to the login page
  or an error page = rejected: no finding.
- **Reference:** PortSwigger "OAuth authentication" labs, RFC 6749 §3.1.2.

### T2. Implicit flow enabled — INFO, MEDIUM if paired with T1

Same endpoint, `response_type=token` (+ `token id_token` variant): CONFIRMED
(INFO "implicit flow active — tokens issued in URL fragment") if the 302
Location's fragment contains `access_token=` for the registered redirect_uri.
Escalate to MEDIUM only if T1 also confirmed (fragment tokens + attacker
redirect = trivial theft). No token is ever used; the fragment is parsed from
the 302 header, never followed.

### T3. `state` not enforced → login CSRF exposure — MEDIUM with differential

Authorization request WITHOUT `state` (canary client_id + registered
redirect_uri, `response_type=code`).
- **ORACLE:** run twice (kills one-off errors). CONFIRMED MEDIUM
  ("authorization server accepts requests without state — login CSRF
  possible") only if BOTH runs 302 with a `code=` issued to the registered
  URI. Server errors or a redirect to login → state (or auth) enforced: no
  finding.
- Honest v1 limit: the actual CSRF exploit needs a victim browser session;
  the scanner reports the server-side exposure, never a completed takeover.

### T4. PKCE not enforced on a public client — INFO / MEDIUM

- Public-client evidence (passive, no request): client_id present in the JS
  bundle with no client_secret anywhere in bundle/config (SPA/native pattern).
- Test: authorization request with NO `code_challenge` → 302 with `code=`
  issued = PKCE optional.
- Severity: MEDIUM if public-client evidence + code issued without PKCE;
  INFO if a secret exists (confidential client — PKCE optional by spec).
- Honest limit: code interception itself needs a network/victim position —
  reported as exposure; the issued code is never redeemed.

### T5. Secrets & endpoint hygiene — LOW / MEDIUM (passive + discovery)

- Bundle grep for `client_secret`, `-----BEGIN PRIVATE KEY-----` near oauth
  strings → MEDIUM if a live-looking secret is tied to the discovered
  client_id (differential: appears in bundle AND matches the client_id
  context, not a random string).
- `/.well-known/openid-configuration` reachable → INFO (endpoint map);
  `issuer` ≠ page origin → MEDIUM ("issuer mismatch — token validation
  confusion risk").
- Zero requests beyond the discovery GETs.

## Depth gating

- **Quick:** discovery + T1 with 2 evil variants + T2.
- **Standard / Deep:** full battery (T1 6 variants, T2, T3, T4, T5).

## Wiring

`probeOauth(url, opts)` — exported from `backend/src/scanner/probes/oauth.js`,
wired into `backend/src/scanner/index.js` (`'oauth'` in DEFAULT_PHASES, step
after `cswsh`, before `nuclei`). Reuses the `redirect.js` canary-in-Location
oracle pattern. Scan-time budget: ~12 requests per endpoint, each <1s —
seconds-scale, $0 AI.

## v1 limits (documented, not silently skipped)

- Redeeming codes / completing flows — the probe stops at the 302, never.
- Token replay, social-provider-specific takeover chains (need a victim
  browser).
- `request_uri` / PAR pushed-request attacks (provider-specific — future).
- JWT T3 (RS256→HS256), T5 (kid injection), T6 (embedded jwk) remain
  spec-only inside probe #27; GraphQL T3 (unauthenticated mutation) spec-only
  inside #28.
