# JWT Authentication Attacks Probe

## What it is

JSON Web Tokens (`header.payload.signature`, base64url-encoded) are the most
common session/auth mechanism on modern web targets. This probe tests JWTs for
known CVE patterns using predefined requests — no AI, no browser required.

## Detection surface

The probe finds JWTs via regex `eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9._-]*` over:
1. Response bodies (login/auth endpoints)
2. `Authorization: Bearer <jwt>` headers
3. Cookies matching JWT pattern (name heuristic: sess|auth|token|jwt)

Each JWT is decoded locally (base64url, no network). Recorded: `alg`, `kid`,
`jku`, `x5u`, `jwk` presence, and claims (`exp`, `aud`, `iss`, `sub`, `role`).

## Sub-tests

### T1. `alg: none` acceptance — CRITICAL
Takes the captured token, sets header `alg` to `none`, drops the signature,
optionally escalates claims (`role: admin`).

**Oracle (differential, 100% truth rule):**
- Baseline: original token → 200 with protected content
- Control: token with garbage signature → expect 401/403
- Forged `alg:none` token → if 200 + protected content (same as baseline) while control is rejected → **CONFIRMED**

Variants tested: `none`, `None`, `NONE`, `nOnE` (case-insensitive parsers exist).

**Reference:** CVE-2015-9235, PortSwigger JWT labs.

### T2. Empty/garbage signature — HIGH
Same oracle as T1 with stripped signature, empty-string signature, and
single-char-mutated signature. Catches validators that check presence, not validity.

### T3. RS256 → HS256 algorithm confusion — HIGH
Only when `alg` is RS256/ES256. Fetches server public key from
`/.well-known/jwks.json`, re-signs forged token with HS256 using public key
bytes as HMAC secret. Same differential oracle as T1.

**Reference:** CVE-2016-10555, CVE-2026-22817 (Hono).

**Status:** Spec written, implementation pending (requires JWKS fetch + RSA key handling).

### T4. Weak HMAC secret — CRITICAL (fully OFFLINE)
HS256/HS384/HS512 only. Cracks locally by HMACing `header.payload` bytes with
each candidate secret and comparing to signature. **Zero target requests.**

Candidate list (~40 entries): `secret`, `password`, `123456`, `development`,
`staging`, `test`, `jwt`, `qwerty`, `changeme`, `admin`, `letmein`, etc.

If cracked: forges arbitrary claims with the real secret.

**Reference:** PortSwigger weak-key lab, CVE-2019-20933, hashcat mode 16500.

### T5. `kid` header injection — HIGH
Variants:
- `kid: ../../../../../../dev/null` (empty key → forge with empty HMAC secret)
- `kid: ../../etc/passwd` (error oracle)
- SQLi in kid: `x' UNION SELECT 'attacker_secret' --`

**Oracle:** Differential — forged token verifies only if injected kid path honored.

**Reference:** CVE-2021-46743.

**Status:** Spec written, implementation pending.

### T6. Embedded `jwk` / `jku` / `x5u` — HIGH
- `jwk` variant is self-contained: generates RSA keypair locally, embeds public
  JWK in token header, signs with private key.
- `jku`/`x5u` variants need a key hosted where target can fetch it — scanner has
  no public listener in v1 → documented as "needs egress listener", skipped in v1.

**Status:** Spec written, implementation pending.

### T7. Static claim hygiene — INFORMATIONAL/MEDIUM (no network)
- No `exp` claim → tokens never expire → **MEDIUM**
- Payload contains `password`, `email`, PII → **LOW** (payload is only base64)
- `aud`/`iss` absent → **LOW**

## What counts as proof

Per the 100% truth rule:
- **CONFIRMED:** Differential oracle passes (forged accepted, control rejected)
- **Weak secret:** Offline HMAC match (mathematical proof, zero requests)
- **Claim hygiene:** Static analysis (no network needed)

## References
- PortSwigger Web Security Academy: JWT attacks
- CVE-2015-9235 (alg:none), CVE-2016-10555 (RS256→HS256), CVE-2021-46743 (kid)
- Auth0 2019 JWT bypass, Hono 2026 (CVE-2026-22817)
