# OAuth Auth Gaps — Scope Escalation (#319) & OIDC id_token Validation (#320)

Extension of the OAuth/OIDC probe (`backend/src/scanner/probes/oauth.js`).
The base probe (discovery, redirect_uri bypass, implicit flow, state, PKCE,
secret hygiene) is documented in `oauth.md`; this file covers only the two
auth-gap additions.

## #319 — OAuth scope escalation — HIGH if confirmed (lab-gated)

**Threat:** the authorization server honors scopes the client never
registered. A normal grant for `openid profile email` is escalated to
`admin read:all write:all` — the issued code inherits privileged API access.

**Method (differential, two requests):**
1. Baseline: `GET <auth-endpoint>?client_id=<canary>&redirect_uri=
   https://invalid.invalid/dm-cb-<canary>&response_type=code&state=<canary>
   &scope=openid+profile+email` — `redirect: 'manual'`, never followed.
2. Escalated: identical request with `scope=openid profile email admin
   read:all write:all`.

`invalid.invalid` is a canary-invalid redirect URI — it never resolves, so no
real target is ever hit; we only read the 302 `Location` header.

**Proof criteria (CONFIRMED HIGH `oauth_scope_escalation` only if ALL hold):**
- baseline 3xx with `code=` in Location (proves the endpoint accepted the
  request shape);
- escalated 3xx with `code=` in Location;
- the broader scope is REFLECTED in the escalated Location — a `scope=`
  parameter containing `admin` or `read:all`;
- no `invalid_scope` error in the escalated Location.

**Honest negatives:** an `invalid_scope` error on the escalated request =
correct server behavior = no finding. A code issued without any scope
reflection = no claim (the probe requires the echo, not just acceptance).
Depth `quick` and non-lab targets skip this test entirely — it touches the
authorization server, so it is LAB-GATED (host must be in `opts.labTargets`).

**Reference:** RFC 6749 §3.3 (scope), PortSwigger "OAuth authentication —
scope" labs.

## #320 — OIDC id_token validation gaps — HIGH / MEDIUM / INFO

**Passive core (discovery document, no lab gate):** `GET
/.well-known/openid-configuration`, then:

- (a) `id_token_signing_alg_values_supported` contains `none` →
  `oidc_alg_none_supported` **HIGH**: the issuer advertises unsigned
  id_tokens — any attacker can forge tokens with `alg=none` and impersonate
  users. (Direct read of the issuer's own config; no overclaim.)
- (b) `token_endpoint_auth_methods_supported` contains `none` →
  `oidc_token_endpoint_auth_none` **INFO**: contextual — matters for
  confidential clients; the scanner does not know the client type, so this
  never exceeds INFO.
- (c) `response_modes_supported` includes `query` while
  `response_types_supported` includes id_token/token types →
  `oidc_query_response_mode` **INFO**: tokens delivered in the query string
  leak through Referer headers and proxy logs.

**Active check (lab-gated + test client required):** only when
`opts.labCreds.clientId` is supplied AND the target is a lab host: POST the
discovered `token_endpoint` with `grant_type=client_credentials` for the test
client. If a real `id_token` comes back, its payload is DECODED (never
verified — we read our own canary response) and flagged **MEDIUM**
`oidc_id_token_weak` when: the token is unsigned (`alg=none`), `exp` is
missing, or `exp` is >24h out. A refused token endpoint (401/invalid_client)
is a silent skip — the passive findings remain the core.

**Honest limits:** config findings describe the issuer's advertised posture,
not an exploited forgery; the probe never mints or replays tokens. Nonce /
at_hash checks are not claimed without a full browser flow — the active check
is deliberately limited to the machine-readable token profile.

## Wiring & cost

Both live in `probeOauth(url, opts)`: #319a/320-passive run at any depth;
#319 test and #320 active need depth `standard`/`deep`. #319 adds exactly 2
requests; the #320 active check adds 1. All redirects manual. $0 AI, seconds.
